"""
KB Auto Sync Lambda Handler.

FSx ONTAP S3 Access Point のファイル変更をポーリングで検出し、
Bedrock KB StartIngestionJob を自動トリガーする。

環境変数:
    S3_ACCESS_POINT_ARN  : FSx ONTAP S3 Access Point ARN
    KNOWLEDGE_BASE_ID    : Bedrock Knowledge Base ID
    DATA_SOURCE_ID       : Bedrock KB Data Source ID
    INVENTORY_TABLE_NAME : DynamoDB インベントリテーブル名
"""

import json
import logging
import os
import time
from typing import Any

import boto3
from botocore.config import Config

from diff import compute_diff
from inventory import get_inventory, update_inventory
from metrics import emit_metrics
from scanner import scan_s3_access_point
from trigger import trigger_ingestion_if_needed

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Adaptive retry configuration
RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})


def lambda_handler(event: dict, context: Any) -> dict:
    """メインハンドラー."""
    start_time = time.time()

    s3_ap_arn = os.environ["S3_ACCESS_POINT_ARN"]
    kb_id = os.environ["KNOWLEDGE_BASE_ID"]
    ds_id = os.environ["DATA_SOURCE_ID"]
    table_name = os.environ["INVENTORY_TABLE_NAME"]

    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    table = dynamodb.Table(table_name)

    s3_client = boto3.client("s3", config=RETRY_CONFIG)
    bedrock_agent = boto3.client("bedrock-agent", config=RETRY_CONFIG)

    # 1. S3 AP から現在のファイル一覧を取得（ページネーション対応）
    current_files = scan_s3_access_point(s3_ap_arn, s3_client=s3_client)

    # 2. DynamoDB インベントリから前回状態を取得
    previous_files = get_inventory(table)

    # 3. 差分計算
    diff = compute_diff(current_files, previous_files)

    # 4. 変更判定 + インジェスショントリガー
    job_id = None
    if diff.has_changes:
        job_id = trigger_ingestion_if_needed(
            kb_id, ds_id, diff, bedrock_client=bedrock_agent
        )
        if job_id:
            # 5. インベントリ更新（成功時のみ）
            update_inventory(table, current_files, previous_files, job_id)
    else:
        logger.info("No changes detected, skipping ingestion")

    # 6. メトリクス発行 + 構造化ログ
    duration_ms = int((time.time() - start_time) * 1000)
    emit_metrics(
        scanned_file_count=len(current_files),
        changed_file_count=diff.change_count,
        ingestion_triggered=1 if job_id else 0,
        scan_duration_ms=duration_ms,
        function_name=os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "kb-auto-sync"),
    )

    # 構造化ログ出力
    log_payload = {
        "message": "Scan completed",
        "scannedFiles": len(current_files),
        "addedFiles": len(diff.added),
        "updatedFiles": len(diff.updated),
        "deletedFiles": len(diff.deleted),
        "ingestionJobId": job_id,
        "durationMs": duration_ms,
    }
    logger.info(json.dumps(log_payload))

    return {
        "statusCode": 200,
        "scannedFiles": len(current_files),
        "changedFiles": diff.change_count,
        "ingestionJobId": job_id,
        "durationMs": duration_ms,
    }
