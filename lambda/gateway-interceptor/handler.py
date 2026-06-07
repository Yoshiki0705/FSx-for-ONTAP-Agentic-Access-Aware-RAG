"""
AgentCore Gateway Permission Interceptor

エージェントのツール実行前にユーザーのPermission（SID/UID/GID）を検証し、
権限外の操作をブロックする Lambda Interceptor。

セキュリティ原則:
- Fail-safe: DynamoDB読み取り失敗時はDENY（安全側フォールバック）
- 最小権限: ツールごとに必要な権限レベルを定義
- 監査: 全判定結果を構造化ログに出力

@see docs/design/2026q2-ai-update-roadmap.md — Phase 2
@see .kiro/specs/agentcore-gateway-modernization/requirements.md — Requirement 2
"""

import json
import logging
import os
import time
from typing import Any

import boto3
from botocore.config import Config

# ─── Configuration ─────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
USER_ACCESS_TABLE_NAME = os.environ.get("USER_ACCESS_TABLE_NAME", "")

logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

dynamodb = boto3.resource(
    "dynamodb",
    config=Config(retries={"max_attempts": 3, "mode": "adaptive"}),
)

# ─── Tool Permission Rules ─────────────────────────────────
# Each tool maps to required permission level and optional scope constraints.
# Permission levels: read < write < admin
TOOL_PERMISSION_RULES: dict[str, dict[str, Any]] = {
    # FSx ONTAP Operations
    "list_volumes": {"required_level": "read"},
    "get_capacity": {"required_level": "read"},
    "list_files": {"required_level": "read", "scope": "sid_matched_directory"},
    "get_file_metadata": {"required_level": "read", "scope": "sid_matched_file"},
    "expand_volume": {"required_level": "admin"},
    "delete_file": {"required_level": "admin", "scope": "owner_only"},
    # KB Query Tools
    "search_kb": {"required_level": "read"},
    "get_document_meta": {"required_level": "read"},
    # Capacity Guardrails
    "evaluate_expansion": {"required_level": "read"},
    "get_daily_usage": {"required_level": "read"},
    "record_expansion": {"required_level": "admin"},
}

# Permission level hierarchy
PERMISSION_HIERARCHY = {"read": 1, "write": 2, "admin": 3}


def get_user_permission_level(user_sids: list[str]) -> str:
    """
    SIDリストからユーザーの権限レベルを判定する。

    - Domain Admins SID パターン → admin
    - 有効なSIDが存在 → read (デフォルト)
    - SIDなし → deny
    """
    if not user_sids:
        return "deny"

    # Domain Admins: SID ending in -512
    for sid in user_sids:
        if sid.endswith("-512"):
            return "admin"

    # Any valid SID → at least read access
    return "read"


def check_permission(
    user_id: str,
    user_sids: list[str],
    tool_name: str,
    tool_input: dict[str, Any],
) -> dict[str, Any]:
    """
    ツール実行に対するPermission判定を行う。

    Returns:
        {"decision": "ALLOW"|"DENY", "reason": str}
    """
    # Unknown tool → DENY
    rule = TOOL_PERMISSION_RULES.get(tool_name)
    if not rule:
        return {
            "decision": "DENY",
            "reason": f"Unknown tool: {tool_name}. Not registered in permission rules.",
        }

    # Get user's effective permission level
    user_level = get_user_permission_level(user_sids)
    if user_level == "deny":
        return {
            "decision": "DENY",
            "reason": "No valid SIDs found for user. Fail-safe: DENY all.",
        }

    # Check permission level
    required_level = rule["required_level"]
    if PERMISSION_HIERARCHY.get(user_level, 0) < PERMISSION_HIERARCHY.get(required_level, 99):
        return {
            "decision": "DENY",
            "reason": f"Insufficient permission: user has '{user_level}', tool '{tool_name}' requires '{required_level}'.",
        }

    # Scope-based checks (optional, tool-specific)
    scope = rule.get("scope")
    if scope == "owner_only":
        # For delete operations, check if user owns the target file
        target_owner = tool_input.get("owner_uid")
        user_uid = tool_input.get("user_uid")
        if target_owner and user_uid and str(target_owner) != str(user_uid):
            return {
                "decision": "DENY",
                "reason": f"Owner-only scope: user UID '{user_uid}' does not match file owner '{target_owner}'.",
            }

    return {"decision": "ALLOW", "reason": "Permission check passed."}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AgentCore Gateway Interceptor ハンドラー。

    Event structure (from Gateway BEFORE_TOOL_INVOCATION):
    {
        "toolName": "list_volumes",
        "toolInput": {...},
        "userContext": {
            "userId": "user@example.com",
            "sessionId": "session-xxx"
        },
        "requestId": "req-xxx"
    }

    Response structure:
    {
        "decision": "ALLOW" | "DENY",
        "reason": "...",
        "modifiedInput": {...}  // optional, for input transformation
    }
    """
    start_time = time.time()
    request_id = event.get("requestId", "unknown")
    tool_name = event.get("toolName", "unknown")
    tool_input = event.get("toolInput", {})
    user_context = event.get("userContext", {})
    user_id = user_context.get("userId", "")

    logger.info(
        json.dumps(
            {
                "event": "interceptor_invoked",
                "requestId": request_id,
                "toolName": tool_name,
                "userId": user_id,
            }
        )
    )

    try:
        # Step 1: Retrieve user SIDs from DynamoDB
        user_sids: list[str] = []
        if user_id and USER_ACCESS_TABLE_NAME:
            table = dynamodb.Table(USER_ACCESS_TABLE_NAME)
            response = table.get_item(Key={"userId": user_id})
            item = response.get("Item")
            if item:
                user_sids = item.get("SID", [])
            else:
                logger.warning(f"User not found in access table: {user_id}")

        # Step 2: Evaluate permission
        result = check_permission(user_id, user_sids, tool_name, tool_input)

        # Step 3: Emit structured audit log
        duration_ms = (time.time() - start_time) * 1000
        log_entry = {
            "event": "permission_decision",
            "requestId": request_id,
            "toolName": tool_name,
            "userId": user_id,
            "decision": result["decision"],
            "reason": result["reason"],
            "userSidCount": len(user_sids),
            "durationMs": round(duration_ms, 2),
        }
        logger.info(json.dumps(log_entry))

        # Step 4: Emit CloudWatch EMF metrics
        _emit_metrics(tool_name, result["decision"], duration_ms)

        return result

    except Exception as e:
        # Fail-safe: DynamoDB error or any exception → DENY
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            json.dumps(
                {
                    "event": "interceptor_error",
                    "requestId": request_id,
                    "toolName": tool_name,
                    "userId": user_id,
                    "error": str(e),
                    "durationMs": round(duration_ms, 2),
                }
            )
        )
        _emit_metrics(tool_name, "DENY", duration_ms)
        return {
            "decision": "DENY",
            "reason": f"Internal error (fail-safe DENY): {str(e)[:100]}",
        }


def _emit_metrics(tool_name: str, decision: str, duration_ms: float) -> None:
    """CloudWatch EMF形式でメトリクスを出力。"""
    print(
        json.dumps(
            {
                "_aws": {
                    "Timestamp": int(time.time() * 1000),
                    "CloudWatchMetrics": [
                        {
                            "Namespace": "AgentCore/Gateway",
                            "Dimensions": [["ToolName", "Decision"]],
                            "Metrics": [
                                {"Name": "InterceptorInvocations", "Unit": "Count"},
                                {"Name": "InterceptorLatency", "Unit": "Milliseconds"},
                            ],
                        }
                    ],
                },
                "ToolName": tool_name,
                "Decision": decision,
                "InterceptorInvocations": 1,
                "InterceptorLatency": round(duration_ms, 2),
            }
        )
    )
