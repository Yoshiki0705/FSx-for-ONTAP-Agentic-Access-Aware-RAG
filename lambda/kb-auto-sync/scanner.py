"""
S3 Access Point scanner module.

ListObjectsV2 を使用して S3 Access Point の全ファイルを取得する。
ページネーション対応で 1000 件超のファイルにも対応。
"""

from typing import Any, Dict, Optional

from models import FileMetadata


def scan_s3_access_point(
    s3_ap_arn: str,
    *,
    s3_client: Any = None,
) -> Dict[str, FileMetadata]:
    """
    S3 Access Point の全ファイルを ListObjectsV2 で取得する。

    Args:
        s3_ap_arn: S3 Access Point ARN
        s3_client: boto3 S3 client (injectable for testing)

    Returns:
        dict mapping file key to FileMetadata
    """
    if s3_client is None:
        import boto3
        from botocore.config import Config

        s3_client = boto3.client(
            "s3", config=Config(retries={"max_attempts": 3, "mode": "adaptive"})
        )

    files: Dict[str, FileMetadata] = {}
    continuation_token = None  # type: Optional[str]

    while True:
        params: dict[str, Any] = {"Bucket": s3_ap_arn}
        if continuation_token:
            params["ContinuationToken"] = continuation_token

        response = s3_client.list_objects_v2(**params)

        for obj in response.get("Contents", []):
            last_modified = obj["LastModified"]
            # Convert datetime to ISO string if needed
            if hasattr(last_modified, "isoformat"):
                last_modified = last_modified.isoformat()

            files[obj["Key"]] = FileMetadata(
                key=obj["Key"],
                size=obj["Size"],
                last_modified=last_modified,
                e_tag=obj["ETag"],
            )

        if not response.get("IsTruncated"):
            break
        continuation_token = response["NextContinuationToken"]

    return files
