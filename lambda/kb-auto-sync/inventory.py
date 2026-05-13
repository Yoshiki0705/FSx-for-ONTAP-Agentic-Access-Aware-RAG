"""
DynamoDB inventory operations module.

インベントリテーブルの読み取り・更新を行う。
"""

from datetime import datetime, timezone
from typing import Any, Dict, Set

from models import FileMetadata


def get_inventory(table: Any) -> Dict[str, FileMetadata]:
    """
    DynamoDB インベントリテーブルから前回のファイルメタデータを取得する。

    Args:
        table: boto3 DynamoDB Table resource

    Returns:
        dict mapping file key to FileMetadata
    """
    files: Dict[str, FileMetadata] = {}

    # DynamoDB Scan with pagination
    response = table.scan()
    items = response.get("Items", [])

    while response.get("LastEvaluatedKey"):
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
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


def update_inventory(
    table: Any,
    current_files: Dict[str, FileMetadata],
    previous_files: Dict[str, FileMetadata],
    job_id: str,
) -> None:
    """
    インベントリテーブルを最新のファイルメタデータで更新する。

    - 現在存在するファイル: upsert
    - 現在存在しないファイル（削除済み）: delete
    - 新規ファイルには firstDetectedAt を設定

    Args:
        table: boto3 DynamoDB Table resource
        current_files: 現在のファイル一覧
        previous_files: 前回のファイル一覧
        job_id: インジェスションジョブ ID
    """
    now = datetime.now(timezone.utc).isoformat()
    previous_keys = set(previous_files.keys())
    current_keys = set(current_files.keys())

    # 削除対象
    deleted_keys = previous_keys - current_keys

    with table.batch_writer() as batch:
        # Upsert: 現在のファイル
        for key, meta in current_files.items():
            item: dict[str, Any] = {
                "fileKey": key,
                "size": meta.size,
                "lastModified": meta.last_modified,
                "eTag": meta.e_tag,
                "lastSyncedJobId": job_id,
            }
            # firstDetectedAt は新規のみ設定
            if key not in previous_keys:
                item["firstDetectedAt"] = now
            batch.put_item(Item=item)

        # Delete: 削除されたファイル
        for key in deleted_keys:
            batch.delete_item(Key={"fileKey": key})
