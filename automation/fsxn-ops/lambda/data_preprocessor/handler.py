"""
AI/分析向けデータ前処理 Lambda

FSx for NetApp ONTAP 上のデータを対象に、AI/分析パイプラインの
前処理を実行する。NFS マウントは行わず、S3 Access Point を
"境界" として扱い、S3 経由でデータにアクセスする。

処理フロー:
1. S3 Access Point 経由で FSx for ONTAP のデータ一覧を取得
2. 対象ファイルのメタデータを収集 (ONTAP REST API)
3. 前処理タスクを生成 (Step Functions の Map ステート用)
4. 処理結果を S3 に出力

環境変数:
    S3_ACCESS_POINT_ARN : S3 Access Point ARN
    ONTAP_SECRET_ID     : Secrets Manager シークレット ID
    MANAGEMENT_LIF      : ONTAP 管理 LIF IP アドレス
    OUTPUT_BUCKET       : 処理結果出力先 S3 バケット
    OUTPUT_PREFIX        : 出力先プレフィックス
    SNS_TOPIC_ARN       : 通知先 SNS トピック ARN (オプション)
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from common.ontap_client import OntapClient, OntapClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class DataPreprocessor:
    """FSx for ONTAP データの前処理を管理"""

    def __init__(
        self,
        s3_access_point_arn: str,
        output_bucket: str,
        output_prefix: str,
        ontap_client: Optional[OntapClient] = None,
    ):
        self.s3_access_point_arn = s3_access_point_arn
        self.output_bucket = output_bucket
        self.output_prefix = output_prefix
        self.ontap = ontap_client
        self.s3 = boto3.client("s3")

    def list_source_objects(
        self,
        prefix: str = "",
        suffix_filter: Optional[list[str]] = None,
        max_keys: int = 1000,
    ) -> list[dict[str, Any]]:
        """
        S3 Access Point 経由でソースオブジェクト一覧を取得

        S3 Access Point は FSx for ONTAP のデータへの "境界" として機能する。
        Lambda から直接 NFS マウントせず、S3 API 経由でアクセスする。
        """
        objects = []
        continuation_token = None

        while True:
            kwargs: dict[str, Any] = {
                "Bucket": self.s3_access_point_arn,
                "Prefix": prefix,
                "MaxKeys": min(max_keys - len(objects), 1000),
            }
            if continuation_token:
                kwargs["ContinuationToken"] = continuation_token

            try:
                response = self.s3.list_objects_v2(**kwargs)
            except ClientError as e:
                logger.error("S3 Access Point からのオブジェクト一覧取得失敗: %s", e)
                raise

            for obj in response.get("Contents", []):
                key = obj["Key"]

                # サフィックスフィルタ
                if suffix_filter:
                    if not any(key.endswith(s) for s in suffix_filter):
                        continue

                objects.append({
                    "key": key,
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "etag": obj.get("ETag", ""),
                })

            if not response.get("IsTruncated") or len(objects) >= max_keys:
                break
            continuation_token = response.get("NextContinuationToken")

        logger.info(
            "ソースオブジェクト取得: %d 件 (prefix=%s)", len(objects), prefix
        )
        return objects

    def collect_ontap_metadata(
        self, volume_name: str, svm_name: Optional[str] = None
    ) -> dict[str, Any]:
        """
        ONTAP REST API からボリュームメタデータを収集

        ファイルの ACL 情報やセキュリティスタイルなど、
        S3 API では取得できない ONTAP 固有のメタデータを収集する。
        """
        if not self.ontap:
            return {"warning": "ONTAP クライアント未設定"}

        try:
            volumes = self.ontap.list_volumes(svm_name=svm_name)
            target_vol = next(
                (v for v in volumes if v.get("name") == volume_name), None
            )

            if not target_vol:
                return {"error": f"ボリューム '{volume_name}' が見つかりません"}

            vol_uuid = target_vol["uuid"]
            vol_detail = self.ontap.get_volume(vol_uuid)

            # NAS 設定からセキュリティスタイルを取得
            nas_config = vol_detail.get("nas", {})
            security_style = nas_config.get("security_style", "unknown")
            export_policy = nas_config.get("export_policy", {}).get("name", "")

            # スナップショット情報
            snapshots = self.ontap.list_snapshots(vol_uuid)

            return {
                "volume_name": volume_name,
                "volume_uuid": vol_uuid,
                "svm": vol_detail.get("svm", {}).get("name", ""),
                "security_style": security_style,
                "export_policy": export_policy,
                "state": vol_detail.get("state", ""),
                "space": vol_detail.get("space", {}),
                "snapshot_count": len(snapshots),
                "latest_snapshot": (
                    snapshots[-1].get("name") if snapshots else None
                ),
            }
        except OntapClientError as e:
            logger.error("ONTAP メタデータ収集失敗: %s", e)
            return {"error": str(e)}

    def generate_preprocessing_tasks(
        self,
        objects: list[dict],
        task_type: str = "embedding",
        batch_size: int = 10,
    ) -> list[dict[str, Any]]:
        """
        前処理タスクを生成 (Step Functions Map ステート用)

        タスクタイプ:
        - embedding: テキスト埋め込み生成 (Bedrock 用)
        - metadata_extraction: メタデータ抽出
        - format_conversion: フォーマット変換
        """
        tasks = []
        batch = []

        for i, obj in enumerate(objects):
            batch.append(obj)

            if len(batch) >= batch_size or i == len(objects) - 1:
                task = {
                    "task_id": f"{task_type}-{len(tasks):04d}",
                    "task_type": task_type,
                    "objects": batch.copy(),
                    "object_count": len(batch),
                    "s3_access_point_arn": self.s3_access_point_arn,
                    "output_bucket": self.output_bucket,
                    "output_prefix": (
                        f"{self.output_prefix}/{task_type}/"
                        f"{datetime.now(timezone.utc).strftime('%Y%m%d')}"
                    ),
                }
                tasks.append(task)
                batch = []

        logger.info(
            "前処理タスク生成: %d タスク (%d オブジェクト, batch_size=%d)",
            len(tasks),
            len(objects),
            batch_size,
        )
        return tasks

    def write_manifest(
        self, tasks: list[dict], manifest_key: str
    ) -> str:
        """処理マニフェストを S3 に書き出し"""
        manifest = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "total_tasks": len(tasks),
            "total_objects": sum(t["object_count"] for t in tasks),
            "tasks": tasks,
        }

        self.s3.put_object(
            Bucket=self.output_bucket,
            Key=manifest_key,
            Body=json.dumps(manifest, indent=2, default=str),
            ContentType="application/json",
        )

        logger.info("マニフェスト書き出し: s3://%s/%s", self.output_bucket, manifest_key)
        return f"s3://{self.output_bucket}/{manifest_key}"


def handler(event: dict, context: Any) -> dict[str, Any]:
    """
    Lambda ハンドラー

    入力:
        {
            "action": "scan" | "generate_tasks" | "collect_metadata",
            "prefix": "documents/",
            "suffix_filter": [".pdf", ".docx", ".md"],
            "volume_name": "vol1",
            "svm_name": "svm1",
            "task_type": "embedding",
            "batch_size": 10
        }
    """
    logger.info("データ前処理開始: %s", json.dumps(event, default=str))

    action = event.get("action", "scan")

    s3_access_point_arn = event.get(
        "s3_access_point_arn", os.environ.get("S3_ACCESS_POINT_ARN", "")
    )
    output_bucket = event.get(
        "output_bucket", os.environ.get("OUTPUT_BUCKET", "")
    )
    output_prefix = event.get(
        "output_prefix", os.environ.get("OUTPUT_PREFIX", "preprocessing")
    )

    # ONTAP クライアント (メタデータ収集用、オプション)
    ontap_client = None
    management_lif = event.get(
        "management_lif", os.environ.get("MANAGEMENT_LIF", "")
    )
    secret_id = event.get(
        "secret_id", os.environ.get("ONTAP_SECRET_ID", "")
    )
    if management_lif and secret_id:
        try:
            ontap_client = OntapClient(
                management_lif=management_lif,
                secret_id=secret_id,
                verify_ssl=os.environ.get("ONTAP_VERIFY_SSL", "false").lower() == "true",
                ca_cert_path=os.environ.get("ONTAP_CA_CERT_PATH"),
            )
        except OntapClientError as e:
            logger.warning("ONTAP クライアント初期化失敗 (続行): %s", e)

    preprocessor = DataPreprocessor(
        s3_access_point_arn=s3_access_point_arn,
        output_bucket=output_bucket,
        output_prefix=output_prefix,
        ontap_client=ontap_client,
    )

    timestamp = datetime.now(timezone.utc)

    if action == "scan":
        # S3 Access Point 経由でオブジェクト一覧を取得
        objects = preprocessor.list_source_objects(
            prefix=event.get("prefix", ""),
            suffix_filter=event.get("suffix_filter"),
            max_keys=event.get("max_keys", 1000),
        )
        return {
            "action": "scan",
            "object_count": len(objects),
            "objects": objects,
            "timestamp": timestamp.isoformat(),
        }

    elif action == "generate_tasks":
        # オブジェクト一覧からタスクを生成
        objects = event.get("objects", [])
        if not objects:
            objects = preprocessor.list_source_objects(
                prefix=event.get("prefix", ""),
                suffix_filter=event.get("suffix_filter"),
            )

        tasks = preprocessor.generate_preprocessing_tasks(
            objects=objects,
            task_type=event.get("task_type", "embedding"),
            batch_size=event.get("batch_size", 10),
        )

        # マニフェスト書き出し
        manifest_key = (
            f"{output_prefix}/manifests/"
            f"{timestamp.strftime('%Y%m%d-%H%M%S')}.json"
        )
        manifest_uri = preprocessor.write_manifest(tasks, manifest_key)

        return {
            "action": "generate_tasks",
            "task_count": len(tasks),
            "total_objects": sum(t["object_count"] for t in tasks),
            "manifest_uri": manifest_uri,
            "tasks": tasks,
            "timestamp": timestamp.isoformat(),
        }

    elif action == "collect_metadata":
        # ONTAP メタデータ収集
        volume_name = event.get("volume_name", "")
        svm_name = event.get("svm_name")

        if not volume_name:
            return {"error": "volume_name は必須です"}

        metadata = preprocessor.collect_ontap_metadata(
            volume_name=volume_name, svm_name=svm_name
        )
        return {
            "action": "collect_metadata",
            "metadata": metadata,
            "timestamp": timestamp.isoformat(),
        }

    else:
        return {
            "error": f"不明なアクション: '{action}'",
            "available_actions": ["scan", "generate_tasks", "collect_metadata"],
        }
