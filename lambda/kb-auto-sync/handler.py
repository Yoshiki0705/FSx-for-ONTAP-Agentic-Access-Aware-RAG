"""
KB Auto Sync Lambda Handler.

FSx for ONTAP S3 Access Point のファイル変更をポーリングで検出し、
Bedrock KB StartIngestionJob を自動トリガーする。

2フェーズインベントリモデル:
  - scan: ファイル変更検出 → StartIngestionJob → mark_inventory_pending
  - status-check: GetIngestionJob → commit_inventory / mark_inventory_failed

環境変数:
    S3_ACCESS_POINT_ARN  : FSx for ONTAP S3 Access Point ARN
    KNOWLEDGE_BASE_ID    : Bedrock Knowledge Base ID
    DATA_SOURCE_ID       : Bedrock KB Data Source ID
    INVENTORY_TABLE_NAME : DynamoDB インベントリテーブル名
    SVM_ID               : (オプション) FSx for ONTAP SVM ID — AD DC 到達性チェック用

前提条件 (AD参加 SVM):
    AD参加 SVM (CIFS有効) 上の S3 Access Point では、全てのデータ操作
    (ListObjectsV2, GetObject) に AD DC 到達性が必須。AD DC 到達不能時は
    AccessDenied が返るが、HeadBucket は成功するため誤診断しやすい。
    詳細: docs/s3ap-ad-prerequisites.md
"""

import json
import logging
import math
import os
import time
from typing import Any, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

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


class S3ApAdConnectivityError(Exception):
    """
    AD DC 到達性に起因する S3 AP AccessDenied エラー。

    AD参加 SVM では ONTAP が S3 AP データ操作時に unix→win
    逆引きネームマッピングを実行するため、AD DC 到達性が必須。
    HeadBucket は成功するが ListObjectsV2/GetObject は
    AccessDenied になるパターン。
    """

    pass


def _check_ad_dc_reachability_via_fsx(svm_id: str) -> dict[str, Any]:
    """
    FSx API 経由で SVM の AD 参加状態を確認する（オプショナル診断）。

    ONTAP REST API アクセスが無い場合のフォールバック。
    SVM の ActiveDirectoryConfiguration を確認し、AD参加状態を返す。

    Returns:
        {"ad_joined": bool, "domain_name": str or None, "error": str or None}
    """
    result: dict[str, Any] = {
        "ad_joined": False,
        "domain_name": None,
        "error": None,
    }
    try:
        fsx_client = boto3.client("fsx", config=RETRY_CONFIG)
        response = fsx_client.describe_storage_virtual_machines(
            StorageVirtualMachineIds=[svm_id]
        )
        svms = response.get("StorageVirtualMachines", [])
        if svms:
            ad_config = svms[0].get("ActiveDirectoryConfiguration", {})
            self_managed = ad_config.get(
                "SelfManagedActiveDirectoryConfiguration", {}
            )
            domain = self_managed.get("DomainName")
            if domain:
                result["ad_joined"] = True
                result["domain_name"] = domain
    except ClientError as e:
        result["error"] = f"FSx API エラー: {e}"
        logger.warning(f"SVM AD状態確認失敗 (non-fatal): {e}")
    except Exception as e:
        result["error"] = f"予期しないエラー: {e}"
        logger.warning(f"SVM AD状態確認で予期しないエラー (non-fatal): {e}")

    return result


def _diagnose_s3ap_access_denied(s3_ap_arn: str) -> dict[str, Any]:
    """
    S3 AP の AccessDenied を診断する。

    HeadBucket が成功するか確認し、AD DC 到達性問題を判別する。
    HeadBucket 成功 + ListObjectsV2 失敗 = AD DC 到達不能の強い兆候。

    Returns:
        {"head_bucket_ok": bool, "likely_ad_issue": bool, "svm_ad_info": dict}
    """
    diagnosis: dict[str, Any] = {
        "head_bucket_ok": False,
        "likely_ad_issue": False,
        "svm_ad_info": {},
    }

    try:
        s3_client = boto3.client("s3", config=RETRY_CONFIG)
        s3_client.head_bucket(Bucket=s3_ap_arn)
        diagnosis["head_bucket_ok"] = True
        # HeadBucket OK + ListObjectsV2 AccessDenied = AD DC問題の兆候
        diagnosis["likely_ad_issue"] = True
    except ClientError:
        # HeadBucket も失敗 → IAM/ポリシー/ネットワーク問題の可能性
        diagnosis["likely_ad_issue"] = False

    # SVM_ID があれば FSx API で AD 状態を確認
    svm_id = os.environ.get("SVM_ID", "")
    if svm_id:
        diagnosis["svm_ad_info"] = _check_ad_dc_reachability_via_fsx(svm_id)

    return diagnosis


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
    #    AD参加 SVM の場合、AD DC 到達不能時に AccessDenied が発生する。
    #    HeadBucket は成功するため、IAM/ポリシー問題と誤診断しやすい。
    try:
        current_files = scan_s3_access_point(s3_ap_arn, s3_client=s3_client)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "AccessDenied":
            # AccessDenied 診断: AD DC 到達性問題の可能性を確認
            diagnosis = _diagnose_s3ap_access_denied(s3_ap_arn)
            logger.error(
                json.dumps(
                    {
                        "message": "S3 AP AccessDenied — AD DC到達性問題の可能性",
                        "s3ApArn": s3_ap_arn,
                        "headBucketOk": diagnosis["head_bucket_ok"],
                        "likelyAdIssue": diagnosis["likely_ad_issue"],
                        "svmAdInfo": diagnosis["svm_ad_info"],
                        "guidance": (
                            "HeadBucketが成功しListObjectsV2がAccessDeniedの場合、"
                            "AD DC到達性問題が原因です。SVM ENIからAD DCへの"
                            "ネットワーク接続(port 53/88/389/445/636)を確認してください。"
                            if diagnosis["likely_ad_issue"]
                            else "IAMポリシーまたはS3 APリソースポリシーを確認してください。"
                        ),
                    }
                )
            )
            if diagnosis["likely_ad_issue"]:
                raise S3ApAdConnectivityError(
                    f"S3 AP データ操作が AccessDenied (AD DC到達性問題の可能性)。"
                    f" HeadBucket=OK, ListObjectsV2=AccessDenied。"
                    f" SVM AD info: {diagnosis['svm_ad_info']}"
                ) from e
        raise

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
