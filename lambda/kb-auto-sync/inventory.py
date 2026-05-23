"""
DynamoDB inventory operations module.

インベントリテーブルの読み取り・更新を行う。
Pending/Commit 2フェーズモデル対応。
"""

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from models import FileMetadata


class InventoryStatus:
    """インベントリレコードのステータス定数."""

    COMMITTED = "committed"
    PENDING = "pending"
    FAILED_RETRYABLE = "failed_retryable"


def get_inventory(
    table: Any, *, status_filter: Optional[str] = None
) -> Dict[str, FileMetadata]:
    """
    DynamoDB インベントリテーブルから前回のファイルメタデータを取得する。

    Args:
        table: boto3 DynamoDB Table resource
        status_filter: ステータスでフィルタ（None=全件、"committed"=確定済みのみ）
                       デフォルト None は後方互換性のため。
                       新しい呼び出し元は status_filter=InventoryStatus.COMMITTED を推奨。

    Returns:
        dict mapping file key to FileMetadata
    """
    from boto3.dynamodb.conditions import Attr

    files: Dict[str, FileMetadata] = {}

    scan_kwargs: dict = {}
    if status_filter is not None:
        scan_kwargs["FilterExpression"] = Attr("status").eq(status_filter)

    response = table.scan(**scan_kwargs)
    items = response.get("Items", [])

    while response.get("LastEvaluatedKey"):
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))

    for item in items:
        key = item["fileKey"]
        files[key] = FileMetadata(
            key=key,
            size=int(item.get("size", 0)),
            last_modified=item.get("lastModified", ""),
            e_tag=item.get("eTag", ""),
        )

    return files


def mark_inventory_pending(
    table: Any,
    current_files: Dict[str, FileMetadata],
    job_id: str,
) -> int:
    """
    インベントリレコードを pending ステータスで書き込む。

    StartIngestionJob が受理された直後に呼び出す。
    ジョブが SUCCEEDED に到達したら commit_inventory() で確定する。

    Args:
        table: boto3 DynamoDB Table resource
        current_files: 現在のファイル一覧（変更検出されたもの）
        job_id: StartIngestionJob が返した ingestionJobId

    Returns:
        書き込んだレコード数

    Raises:
        ValueError: job_id が空の場合
    """
    if not job_id:
        raise ValueError("job_id must be non-empty")

    now = datetime.now(timezone.utc).isoformat()
    count = 0

    with table.batch_writer() as batch:
        for key, meta in current_files.items():
            batch.put_item(
                Item={
                    "fileKey": key,
                    "size": meta.size,
                    "lastModified": meta.last_modified,
                    "eTag": meta.e_tag,
                    "status": InventoryStatus.PENDING,
                    "jobId": job_id,
                    "firstDetectedAt": now,
                    "updatedAt": now,
                }
            )
            count += 1

    return count


def commit_inventory(table: Any, job_id: str) -> int:
    """
    pending レコードを committed に遷移する。

    GetIngestionJob で SUCCEEDED を確認した後に呼び出す。

    Args:
        table: boto3 DynamoDB Table resource
        job_id: 対象の ingestionJobId

    Returns:
        更新したレコード数
    """
    from boto3.dynamodb.conditions import Attr

    # pending レコードを検索（GSI がない場合は Scan + Filter）
    response = table.scan(
        FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
        & Attr("jobId").eq(job_id)
    )
    items = response.get("Items", [])

    while response.get("LastEvaluatedKey"):
        response = table.scan(
            FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
            & Attr("jobId").eq(job_id),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    now = datetime.now(timezone.utc).isoformat()
    count = 0

    with table.batch_writer() as batch:
        for item in items:
            item["status"] = InventoryStatus.COMMITTED
            item["updatedAt"] = now
            # jobId を監査証跡として保持
            batch.put_item(Item=item)
            count += 1

    return count


def mark_inventory_failed(table: Any, job_id: str) -> int:
    """
    pending レコードを failed_retryable に遷移する。

    GetIngestionJob で FAILED を確認した後に呼び出す。
    TTL を 7日後に設定し、自動削除されるようにする。

    Args:
        table: boto3 DynamoDB Table resource
        job_id: 対象の ingestionJobId

    Returns:
        更新したレコード数
    """
    from boto3.dynamodb.conditions import Attr

    response = table.scan(
        FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
        & Attr("jobId").eq(job_id)
    )
    items = response.get("Items", [])

    while response.get("LastEvaluatedKey"):
        response = table.scan(
            FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
            & Attr("jobId").eq(job_id),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    now = datetime.now(timezone.utc).isoformat()
    ttl_epoch = int(time.time()) + (7 * 24 * 60 * 60)  # 7 days
    count = 0

    with table.batch_writer() as batch:
        for item in items:
            item["status"] = InventoryStatus.FAILED_RETRYABLE
            item["updatedAt"] = now
            item["ttlEpoch"] = ttl_epoch
            batch.put_item(Item=item)
            count += 1

    return count


def cleanup_stale_pending(table: Any, max_age_hours: int = 24) -> int:
    """
    古い pending レコードを failed_retryable に遷移する。

    max_age_hours 以上前に作成された pending レコードを検出し、
    failed_retryable に遷移して TTL を設定する。

    Args:
        table: boto3 DynamoDB Table resource
        max_age_hours: pending 状態の最大許容時間（デフォルト: 24時間）

    Returns:
        クリーンアップしたレコード数
    """
    from boto3.dynamodb.conditions import Attr

    cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()

    response = table.scan(
        FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
        & Attr("updatedAt").lt(cutoff_iso)
    )
    items = response.get("Items", [])

    while response.get("LastEvaluatedKey"):
        response = table.scan(
            FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
            & Attr("updatedAt").lt(cutoff_iso),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    now = datetime.now(timezone.utc).isoformat()
    ttl_epoch = int(time.time()) + (7 * 24 * 60 * 60)
    count = 0

    with table.batch_writer() as batch:
        for item in items:
            item["status"] = InventoryStatus.FAILED_RETRYABLE
            item["updatedAt"] = now
            item["ttlEpoch"] = ttl_epoch
            batch.put_item(Item=item)
            count += 1

    return count


# --- 後方互換性のための旧関数 ---


def update_inventory(
    table: Any,
    current_files: Dict[str, FileMetadata],
    previous_files: Dict[str, FileMetadata],
    job_id: str,
) -> None:
    """
    インベントリテーブルを最新のファイルメタデータで更新する（後方互換）。

    NOTE: この関数は後方互換性のために残しています。
    新しいコードでは mark_inventory_pending() + commit_inventory() を使用してください。

    Args:
        table: boto3 DynamoDB Table resource
        current_files: 現在のファイル一覧
        previous_files: 前回のファイル一覧
        job_id: インジェスションジョブ ID
    """
    now = datetime.now(timezone.utc).isoformat()
    previous_keys = set(previous_files.keys())
    current_keys = set(current_files.keys())

    deleted_keys = previous_keys - current_keys

    with table.batch_writer() as batch:
        for key, meta in current_files.items():
            item: dict[str, Any] = {
                "fileKey": key,
                "size": meta.size,
                "lastModified": meta.last_modified,
                "eTag": meta.e_tag,
                "lastSyncedJobId": job_id,
                "status": InventoryStatus.COMMITTED,
                "updatedAt": now,
            }
            if key not in previous_keys:
                item["firstDetectedAt"] = now
            batch.put_item(Item=item)

        for key in deleted_keys:
            batch.delete_item(Key={"fileKey": key})
