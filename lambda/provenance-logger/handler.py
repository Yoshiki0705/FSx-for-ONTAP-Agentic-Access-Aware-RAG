"""
RAG Response Provenance Logger (#7)

RAG回答の根拠（どのドキュメントのどの部分から生成されたか）を
DynamoDB 監査テーブルに記録する。

呼び出し方式: WebApp Lambda から非同期呼び出し（InvocationType: Event）
環境変数:
    PROVENANCE_TABLE: 根拠追跡テーブル名
    TTL_DAYS: レコード保持日数（デフォルト: 90）
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    RAG回答の根拠情報を監査テーブルに記録する。

    イベント構造:
    {
        "userId": "admin@example.com",
        "query": "会社の売上は？",
        "responseId": "resp-uuid-xxx",
        "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "routingTier": "complex",
        "citations": [
            {
                "documentKey": "confidential/financial-report.md",
                "chunkIndex": 3,
                "relevanceScore": 0.92,
                "permissionCheck": "ALLOWED",
                "matchedSids": ["S-1-5-21-xxx-512"]
            }
        ],
        "suppressedDocuments": [
            {
                "documentKey": "restricted/project-plan.md",
                "reason": "PERMISSION_DENIED",
                "requiredSids": ["S-1-5-21-xxx-1100"]
            }
        ],
        "totalTokens": 1536,
        "responseTimeMs": 3800
    }
    """
    table_name = os.environ["PROVENANCE_TABLE"]
    ttl_days = int(os.environ.get("TTL_DAYS", "90"))

    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    table = dynamodb.Table(table_name)

    # イベントからデータを抽出
    user_id = event.get("userId", "unknown")
    query = event.get("query", "")
    response_id = event.get("responseId", str(uuid.uuid4()))
    model_id = event.get("modelId", "")
    routing_tier = event.get("routingTier", "")
    citations = event.get("citations", [])
    suppressed = event.get("suppressedDocuments", [])
    total_tokens = event.get("totalTokens", 0)
    response_time_ms = event.get("responseTimeMs", 0)

    now = datetime.now(timezone.utc)
    ttl_epoch = int(now.timestamp()) + (ttl_days * 24 * 60 * 60)

    # 監査レコードを構築
    audit_record = {
        "responseId": response_id,
        "timestamp": now.isoformat(),
        "userId": user_id,
        "eventType": "RAG_RESPONSE_GENERATED",
        "query": query[:500],  # クエリは500文字まで保存
        "modelId": model_id,
        "routingTier": routing_tier,
        "citationCount": len(citations),
        "suppressedCount": len(suppressed),
        "totalTokens": total_tokens,
        "responseTimeMs": response_time_ms,
        "citations": json.dumps(citations, ensure_ascii=False)[:5000],
        "suppressedDocuments": json.dumps(suppressed, ensure_ascii=False)[:2000],
        "ttlEpoch": ttl_epoch,
    }

    # DynamoDB に書き込み
    try:
        table.put_item(Item=audit_record)
        logger.info(
            json.dumps(
                {
                    "message": "Provenance record saved",
                    "responseId": response_id,
                    "userId": user_id,
                    "citationCount": len(citations),
                    "suppressedCount": len(suppressed),
                }
            )
        )
    except Exception as e:
        logger.error(f"Failed to save provenance record: {e}")
        return {"statusCode": 500, "error": str(e)}

    # 権限拒否イベントがある場合は追加メトリクスを発行
    if suppressed:
        _emit_suppression_metrics(len(suppressed), user_id)

    return {
        "statusCode": 200,
        "responseId": response_id,
        "citationCount": len(citations),
        "suppressedCount": len(suppressed),
    }


def _emit_suppression_metrics(count: int, user_id: str) -> None:
    """権限拒否イベントのメトリクスを発行."""
    import sys

    emf_payload = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "RAGProvenance",
                    "Dimensions": [["EventType"]],
                    "Metrics": [
                        {"Name": "DocumentSuppressedByPermission", "Unit": "Count"},
                    ],
                }
            ],
        },
        "EventType": "PERMISSION_DENIED",
        "DocumentSuppressedByPermission": count,
    }
    print(json.dumps(emf_payload), file=sys.stdout, flush=True)
