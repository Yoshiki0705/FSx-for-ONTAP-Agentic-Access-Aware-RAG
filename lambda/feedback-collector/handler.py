"""
User Feedback Collector Lambda (#11)
RAG回答に対するユーザーフィードバック（👍/👎）を収集し、
DynamoDB テーブルに保存する。週次集計でRAG品質改善に活用。
呼び出し方式: WebApp API Route (POST /api/feedback) が RequestResponse で呼ぶ。
環境変数:
    FEEDBACK_TABLE: フィードバックテーブル名
    TTL_DAYS: レコード保持日数（デフォルト: 90）
保存するもの: 評価、任意のコメントと質問文（上限つき）、モデル名、根拠にした文書の
不透明な ID（ハッシュ）。回答の本文、文書の本文、文書の名前は保存しない。
"""
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})

DEFAULT_TTL_DAYS = 90
MAX_COMMENT = 1000
MAX_QUERY = 500
MAX_LABEL = 128
MAX_SOURCE_DOCS = 20

# 画面が付ける回答 ID、モデル名、ルーティング名、文書 ID の形。
RESPONSE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
LABEL = re.compile(r"^[A-Za-z0-9._:/@-]{0,128}$")
DOC_ID = re.compile(r"^[0-9a-f]{24}$")


def _bad(message: str) -> Dict[str, Any]:
    return {"statusCode": 400, "error": message}


def validate(event: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """入力を検査し、保存する値と、拒否の理由（なければ空）を返す。"""
    rating = event.get("rating", "")
    if rating not in ("positive", "negative"):
        return {}, "rating must be 'positive' or 'negative'"
    user_id = event.get("userId", "")
    if not isinstance(user_id, str) or not user_id or user_id == "anonymous":
        return {}, "userId is required"
    response_id = event.get("responseId", "")
    if not isinstance(response_id, str) or not RESPONSE_ID.match(response_id):
        return {}, "responseId must match [A-Za-z0-9_-]{1,64}"
    for key in ("modelId", "routingTier"):
        value = event.get(key, "")
        if not isinstance(value, str) or not LABEL.match(value):
            return {}, f"{key} has an unsupported form"
    docs = event.get("sourceDocIds", [])
    if not isinstance(docs, list) or len(docs) > MAX_SOURCE_DOCS or not all(isinstance(d, str) and DOC_ID.match(d) for d in docs):
        return {}, f"sourceDocIds must be at most {MAX_SOURCE_DOCS} ids of 24 hex characters"
    comment = event.get("comment", "")
    query = event.get("query", "")
    if not isinstance(comment, str) or not isinstance(query, str):
        return {}, "comment and query must be strings"
    return {
        "userId": user_id,
        "responseId": response_id,
        "rating": rating,
        "comment": comment[:MAX_COMMENT],
        "query": query[:MAX_QUERY],
        "modelId": event.get("modelId", ""),
        "routingTier": event.get("routingTier", ""),
        "sourceDocIds": list(dict.fromkeys(docs)),
    }, ""


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    ユーザーフィードバックを保存する。

    イベント構造:
    {
        "responseId": "resp-xxx",
        "rating": "positive" | "negative",
        "userId": "<署名検証済みのセッションから Web アプリが付ける>",
        "comment": "任意",
        "query": "元の質問（500 文字まで）",
        "modelId": "使用モデル",
        "routingTier": "simple|complex|full-context",
        "sourceDocIds": ["<24 桁の 16 進>", ...]
    }
    """
    fields, rejected = validate(event)
    if rejected:
        return _bad(rejected)

    table_name = os.environ["FEEDBACK_TABLE"]
    ttl_days = int(os.environ.get("TTL_DAYS", str(DEFAULT_TTL_DAYS)))
    table = boto3.resource("dynamodb", config=RETRY_CONFIG).Table(table_name)

    now = datetime.now(timezone.utc)
    feedback_id = str(uuid.uuid4())
    record: Dict[str, Any] = {
        "feedbackId": feedback_id,
        "timestamp": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "ttlEpoch": int(now.timestamp()) + ttl_days * 24 * 60 * 60,
        **fields,
    }
    if not record["sourceDocIds"]:
        # DynamoDB は空のリストを許すが、集計で扱いやすいよう属性ごと省く。
        del record["sourceDocIds"]
    try:
        table.put_item(Item=record)
    except Exception:  # noqa: BLE001 - 理由は呼び出し側に返さず、ログにだけ残す
        logger.exception("Failed to save feedback %s", feedback_id)
        return {"statusCode": 500, "error": "failed to save feedback"}

    _emit_metrics(record["rating"])
    # 利用者の ID と質問文はログに出さない。
    logger.info(json.dumps({"message": "Feedback saved", "feedbackId": feedback_id, "rating": record["rating"]}))
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
