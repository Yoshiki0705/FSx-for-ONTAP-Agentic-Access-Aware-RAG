"""
Permission Cache Invalidator Lambda (#13)

DynamoDB Streams から user-access テーブルの変更を検出し、
permission-cache テーブルの該当ユーザーレコードを自動削除する。

トリガー: DynamoDB Streams (user-access テーブル, NEW_AND_OLD_IMAGES)
環境変数:
    PERMISSION_CACHE_TABLE: 権限キャッシュテーブル名
"""

import json
import logging
import os
import time
from typing import Any, Dict, List

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    DynamoDB Streams イベントを処理し、権限キャッシュを無効化する。

    処理フロー:
    1. Streams レコードから変更されたユーザーIDを抽出
    2. permission-cache テーブルから該当レコードを削除
    3. CloudWatch EMF メトリクスを発行
    """
    cache_table_name = os.environ["PERMISSION_CACHE_TABLE"]
    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    cache_table = dynamodb.Table(cache_table_name)

    records = event.get("Records", [])
    if not records:
        return {"statusCode": 200, "invalidated": 0}

    # 変更されたユーザーIDを収集（重複排除）
    user_ids = set()
    for record in records:
        event_name = record.get("eventName", "")
        if event_name in ("INSERT", "MODIFY", "REMOVE"):
            # Keys から userId を取得
            keys = record.get("dynamodb", {}).get("Keys", {})
            user_id = keys.get("userId", {}).get("S", "")
            if user_id:
                user_ids.add(user_id)

    if not user_ids:
        logger.info("No user IDs found in stream records")
        return {"statusCode": 200, "invalidated": 0}

    # permission-cache テーブルから該当レコードを削除
    invalidated = 0
    errors = 0

    for user_id in user_ids:
        try:
            # permission-cache のキー構造を確認して削除
            # キーは userId (パーティションキー)
            cache_table.delete_item(Key={"userId": user_id})
            invalidated += 1
            logger.info(f"Cache invalidated for userId={user_id}")
        except Exception as e:
            errors += 1
            logger.error(f"Failed to invalidate cache for userId={user_id}: {e}")

    # 構造化ログ + EMF メトリクス
    _emit_metrics(invalidated, errors, len(records))

    log_payload = {
        "message": "Cache invalidation completed",
        "streamRecords": len(records),
        "uniqueUsers": len(user_ids),
        "invalidated": invalidated,
        "errors": errors,
    }
    logger.info(json.dumps(log_payload))

    return {
        "statusCode": 200,
        "invalidated": invalidated,
        "errors": errors,
        "userIds": list(user_ids),
    }


def _emit_metrics(invalidated: int, errors: int, record_count: int) -> None:
    """CloudWatch EMF メトリクスを発行."""
    import sys

    emf_payload = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "PermissionCache",
                    "Dimensions": [["FunctionName"]],
                    "Metrics": [
                        {"Name": "CacheInvalidations", "Unit": "Count"},
                        {"Name": "InvalidationErrors", "Unit": "Count"},
                        {"Name": "StreamRecordsProcessed", "Unit": "Count"},
                    ],
                }
            ],
        },
        "FunctionName": os.environ.get(
            "AWS_LAMBDA_FUNCTION_NAME", "cache-invalidator"
        ),
        "CacheInvalidations": invalidated,
        "InvalidationErrors": errors,
        "StreamRecordsProcessed": record_count,
    }
    print(json.dumps(emf_payload), file=sys.stdout, flush=True)
