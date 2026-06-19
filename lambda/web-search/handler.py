"""
AgentCore Web Search Lambda Handler

ap-northeast-1 の API Gateway / Lambda Function URL から呼び出され、
us-east-1 の AgentCore Gateway Web Search Tool を実行する。

入力: { "query": "...", "userId": "...", "maxResults": 5 }
出力: { "success": true, "text": "...", "citations": [...], "metadata": {...} }

セキュリティ:
- クエリのサニタイズは呼び出し側（Next.js route.ts）の責務
- 本 Lambda は Gateway 呼び出し + レスポンス整形のみ担当
- CloudWatch Logs にクエリ本文を記録しない（長さのみ）

@see docs/investigations/agentcore-web-search-integration.md — §5
"""

import json
import logging
import os
import time
from typing import Any

from web_search_client import (
    WebSearchResult,
    invoke_web_search,
    invoke_web_search_http,
)

# ─── Configuration ─────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
# 呼び出し方式: "sdk" (invoke_web_search) or "http" (invoke_web_search_http)
INVOCATION_MODE = os.environ.get("WEB_SEARCH_INVOCATION_MODE", "http")

logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Lambda エントリポイント。

    Event shape (API Gateway proxy / direct invoke):
    {
      "query": "検索クエリ",
      "userId": "user-123",
      "maxResults": 5
    }

    Or API Gateway proxy format:
    {
      "body": "{\"query\": \"...\", \"userId\": \"...\"}",
      "httpMethod": "POST"
    }
    """
    start_time = time.time()

    try:
        # Parse input (support both direct invoke and API Gateway proxy)
        body = _parse_event(event)
        query = body.get("query", "").strip()
        user_id = body.get("userId", "anonymous")
        max_results = int(body.get("maxResults", 5))

        if not query:
            return _response(400, {
                "success": False,
                "error": "query is required",
            })

        # Length guard (prevent abuse)
        if len(query) > 1000:
            return _response(400, {
                "success": False,
                "error": "query exceeds maximum length (1000 characters)",
            })

        logger.info(
            "Web Search request",
            extra={
                "user_id": user_id,
                "query_length": len(query),
                "max_results": max_results,
                "invocation_mode": INVOCATION_MODE,
            },
        )

        # Invoke Web Search
        if INVOCATION_MODE == "sdk":
            result = invoke_web_search(query, max_results=max_results)
        else:
            result = invoke_web_search_http(query, max_results=max_results)

        # Build response
        if result.error:
            logger.warning(
                "Web Search returned error",
                extra={"error": result.error, "latency_ms": result.latency_ms},
            )
            return _response(502, {
                "success": False,
                "error": result.error,
                "metadata": {
                    "latencyMs": round(result.latency_ms, 1),
                    "invocationMode": INVOCATION_MODE,
                },
            })

        # Format citations for frontend consumption
        citations = [
            {
                "index": i + 1,
                "fileName": c.title,
                "s3Uri": c.url,  # Re-uses s3Uri field for URL (frontend CitationItem contract)
                "content": c.snippet[:500],
                "metadata": {},
                "boundaryType": "reference",
                "permissionVerified": False,
            }
            for i, c in enumerate(result.citations)
        ]

        total_latency_ms = (time.time() - start_time) * 1000

        logger.info(
            "Web Search success",
            extra={
                "user_id": user_id,
                "citation_count": len(citations),
                "gateway_latency_ms": round(result.latency_ms, 1),
                "total_latency_ms": round(total_latency_ms, 1),
            },
        )

        return _response(200, {
            "success": True,
            "text": result.text,
            "citations": citations,
            "metadata": {
                "model": result.model,
                "webSearchUsed": True,
                "boundaryTypes": ["reference"],
                "invocationPath": f"agentcore-gateway-{INVOCATION_MODE}",
                "latencyMs": round(result.latency_ms, 1),
                "totalLatencyMs": round(total_latency_ms, 1),
                "citationCount": len(citations),
            },
        })

    except Exception as e:
        logger.exception("Unhandled error in web-search handler")
        return _response(500, {
            "success": False,
            "error": "Internal server error",
        })


def _parse_event(event: dict[str, Any]) -> dict[str, Any]:
    """API Gateway proxy or direct invoke の body を解析"""
    # Direct invoke (already a dict with query/userId)
    if "query" in event:
        return event

    # API Gateway proxy format
    body = event.get("body", "{}")
    if isinstance(body, str):
        return json.loads(body)

    return body if isinstance(body, dict) else {}


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    """API Gateway proxy response format"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }
