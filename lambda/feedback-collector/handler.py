"""
User Feedback Collector Lambda (#11)

RAG回答に対するユーザーフィードバック（👍/👎）を収集し、
DynamoDB テーブルに保存する。週次集計でRAG品質改善に活用。

呼び出し方式: WebApp API Route (POST /api/feedback)
環境変数:
    FEEDBACK_TABLE: フィードバックテーブル名
    TTL_DAYS: レコード保持日数（デフォルト: 365）
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    ユーザーフィードバックを保存する。

    イベント構造:
    {
        "responseId": "resp-uuid-xxx",
        "rating": "positive" | "negative",
        "comment": "optional text",
        "userId": "user@example.com",
        "query": "元の質問",
        "modelId": "使用モデル",
        "routingTier": "simple|complex|full-context"
    }
    """
    table_name = os.environ["FEEDBACK_TABLE"]
    ttl_days = int(os.environ.get("TTL_DAYS", "365"))

    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    table = dynamodb.Table(table_name)

    # バリデーション
    response_id = event.get("responseId", "")
    rating = event.get("rating", "")
    user_id = event.get("userId", "anonymous")

    if rating not in ("positive", "negative"):
        return {
            "statusCode": 400,
            "error": "rating must be 'positive' or 'negative'",
        }

    now = datetime.now(timezone.utc)
    ttl_epoch = int(now.timestamp()) + (ttl_days * 24 * 60 * 60)
    feedback_id = str(uuid.uuid4())

    record = {
        "feedbackId": feedback_id,
        "responseId": response_id or "unknown",
        "timestamp": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "userId": user_id,
        "rating": rating,
        "comment": event.get("comment", "")[:1000],
        "query": event.get("query", "")[:500],
        "modelId": event.get("modelId", ""),
        "routingTier": event.get("routingTier", ""),
        "ttlEpoch": ttl_epoch,
    }

    try:
        table.put_item(Item=record)
    except Exception as e:
        logger.error(f"Failed to save feedback: {e}")
        return {"statusCode": 500, "error": str(e)}

    # EMF メトリクス
    _emit_metrics(rating)

    logger.info(
        json.dumps({
            "message": "Feedback saved",
            "feedbackId": feedback_id,
            "rating": rating,
            "userId": user_id,
        })
    )

    return {"statusCode": 200, "feedbackId": feedback_id}


def _emit_metrics(rating: str) -> None:
    """フィードバックメトリクスを発行."""
    import sys

    emf_payload = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [{
                "Namespace": "RAGFeedback",
                "Dimensions": [["Rating"]],
                "Metrics": [{"Name": "FeedbackCount", "Unit": "Count"}],
            }],
        },
        "Rating": rating,
        "FeedbackCount": 1,
    }
    print(json.dumps(emf_payload), file=sys.stdout, flush=True)
