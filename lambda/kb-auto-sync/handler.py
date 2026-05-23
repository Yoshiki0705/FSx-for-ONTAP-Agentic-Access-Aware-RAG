"""
KB Auto Sync Lambda Handler.

FSx ONTAP S3 Access Point のファイル変更をポーリングで検出し、
Bedrock KB StartIngestionJob を自動トリガーする。

2フェーズインベントリモデル:
  - scan: ファイル変更検出 → StartIngestionJob → mark_inventory_pending
  - status-check: GetIngestionJob → commit_inventory / mark_inventory_failed

環境変数:
    S3_ACCESS_POINT_ARN  : FSx ONTAP S3 Access Point ARN
    KNOWLEDGE_BASE_ID    : Bedrock Knowledge Base ID
    DATA_SOURCE_ID       : Bedrock KB Data Source ID
    INVENTORY_TABLE_NAME : DynamoDB インベントリテーブル名
"""

import json
import logging
import math
import os
import time
from typing import Any, Optional

import boto3
from botocore.config import Config

from diff import compute_diff
from inventory import (
    InventoryStatus,
    cleanup_stale_pending,
    commit_inventory,
    get_inventory,
    mark_inventory_failed,
    mark_inventory_pending,
)
from metrics import emit_metrics
from scanner import scan_s3_access_point
from trigger import trigger_ingestion_if_needed

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Adaptive retry configuration
RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})

# Status check constants
MAX_RETRIES = 10
BASE_BACKOFF_SECONDS = 30
MAX_BACKOFF_SECONDS = 300


def lambda_handler(event: dict, context: Any) -> dict:
    """メインハンドラー — action に基づいてディスパッチ."""
    action = event.get("action", "scan")

    if action == "status-check":
        return _handle_status_check(event, context)
    else:
        return _handle_scan(event, context)


def _handle_scan(event: dict, context: Any) -> dict:
    """スキャンアクション: ファイル変更検出 → トリガー → pending マーク."""
    start_time = time.time()

    s3_ap_arn = os.environ["S3_ACCESS_POINT_ARN"]
    kb_id = os.environ["KNOWLEDGE_BASE_ID"]
    ds_id = os.environ["DATA_SOURCE_ID"]
    table_name = os.environ["INVENTORY_TABLE_NAME"]

    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    table = dynamodb.Table(table_name)

    s3_client = boto3.client("s3", config=RETRY_CONFIG)
    bedrock_agent = boto3.client("bedrock-agent", config=RETRY_CONFIG)

    # 0. Stale pending レコードのクリーンアップ
    cleaned = cleanup_stale_pending(table)
    if cleaned > 0:
        logger.info(f"Cleaned {cleaned} stale pending records")

    # 1. S3 AP から現在のファイル一覧を取得
    current_files = scan_s3_access_point(s3_ap_arn, s3_client=s3_client)

    # 2. DynamoDB インベントリから committed レコードのみ取得
    previous_files = get_inventory(table, status_filter=InventoryStatus.COMMITTED)

    # 3. 差分計算
    diff = compute_diff(current_files, previous_files)

    # 4. 変更判定 + インジェスショントリガー
    job_id = None
    if diff.has_changes:
        job_id = trigger_ingestion_if_needed(
            kb_id, ds_id, diff, bedrock_client=bedrock_agent
        )
        if job_id:
            # 5. pending としてマーク（確定は status-check で行う）
            mark_inventory_pending(table, current_files, job_id)
            logger.info(
                json.dumps(
                    {
                        "message": "Inventory marked as pending",
                        "jobId": job_id,
                        "pendingCount": len(current_files),
                    }
                )
            )
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
        "action": "scan",
        "scannedFiles": len(current_files),
        "changedFiles": diff.change_count,
        "ingestionJobId": job_id,
        "durationMs": duration_ms,
    }


def _handle_status_check(event: dict, context: Any) -> dict:
    """ステータスチェックアクション: ジョブ完了確認 → commit/fail."""
    job_id = event.get("job_id", "")
    retry_count = event.get("retry_count", 0)

    if not job_id:
        return {"statusCode": 400, "error": "job_id is required for status-check"}

    kb_id = os.environ["KNOWLEDGE_BASE_ID"]
    ds_id = os.environ["DATA_SOURCE_ID"]
    table_name = os.environ["INVENTORY_TABLE_NAME"]

    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    table = dynamodb.Table(table_name)
    bedrock_agent = boto3.client("bedrock-agent", config=RETRY_CONFIG)

    # GetIngestionJob でステータス確認
    try:
        response = bedrock_agent.get_ingestion_job(
            knowledgeBaseId=kb_id,
            dataSourceId=ds_id,
            ingestionJobId=job_id,
        )
        status = response["ingestionJob"]["status"]
    except Exception as e:
        logger.error(f"Failed to get ingestion job status: {e}")
        status = "UNKNOWN"

    result: dict = {
        "statusCode": 200,
        "action": "status-check",
        "jobId": job_id,
        "jobStatus": status,
        "retryCount": retry_count,
    }

    if status == "COMPLETE":
        # ジョブ成功 → commit
        committed = commit_inventory(table, job_id)
        logger.info(
            json.dumps(
                {
                    "message": "Inventory committed",
                    "jobId": job_id,
                    "committedCount": committed,
                }
            )
        )
        result["committed"] = committed

    elif status in ("FAILED", "STOPPED"):
        # ジョブ失敗 → failed_retryable
        failed = mark_inventory_failed(table, job_id)
        logger.warning(
            json.dumps(
                {
                    "message": "Ingestion job failed, inventory marked for retry",
                    "jobId": job_id,
                    "failedCount": failed,
                    "jobStatus": status,
                }
            )
        )
        result["failedCount"] = failed

    elif status in ("IN_PROGRESS", "STARTING"):
        # まだ進行中 → リスケジュール
        if retry_count >= MAX_RETRIES:
            # 最大リトライ超過 → 失敗扱い
            failed = mark_inventory_failed(table, job_id)
            logger.error(
                json.dumps(
                    {
                        "message": "Max retries exceeded, marking as failed",
                        "jobId": job_id,
                        "retryCount": retry_count,
                        "failedCount": failed,
                    }
                )
            )
            result["failedCount"] = failed
            result["maxRetriesExceeded"] = True
        else:
            # 指数バックオフで次回チェックをスケジュール
            backoff = _calculate_backoff(retry_count)
            result["nextCheckAfterSeconds"] = backoff
            result["needsReschedule"] = True
            logger.info(
                json.dumps(
                    {
                        "message": "Job still in progress, needs reschedule",
                        "jobId": job_id,
                        "retryCount": retry_count,
                        "nextCheckAfterSeconds": backoff,
                    }
                )
            )
    else:
        # UNKNOWN or unexpected status
        logger.warning(f"Unexpected job status: {status} for job {job_id}")
        result["unexpected"] = True

    return result


def _calculate_backoff(retry_count: int) -> int:
    """指数バックオフを計算する（30s, 60s, 120s, ... max 300s）."""
    backoff = BASE_BACKOFF_SECONDS * (2**retry_count)
    return min(backoff, MAX_BACKOFF_SECONDS)
