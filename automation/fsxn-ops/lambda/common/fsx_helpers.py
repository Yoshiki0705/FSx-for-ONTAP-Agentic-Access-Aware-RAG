"""
FSx API ヘルパーモジュール

AWS FSx API を使用して FSx for NetApp ONTAP ファイルシステムの
AWS レベル操作（容量変更、情報取得など）を行う。

ONTAP REST API ではなく AWS API 側の操作を担当する。
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class FsxHelperError(Exception):
    """FSx API 操作で発生するエラー"""
    pass


class FsxHelper:
    """
    FSx for NetApp ONTAP の AWS API ヘルパー

    AWS FSx API を使用してファイルシステムレベルの操作を行う。
    ONTAP REST API とは異なり、AWS 管理プレーンの操作を担当する。

    Usage:
        helper = FsxHelper(region="ap-northeast-1")
        fs_info = helper.describe_filesystem("fs-0123456789abcdef0")
    """

    def __init__(self, region: Optional[str] = None):
        self.client = boto3.client("fsx", region_name=region)
        self.cw_client = boto3.client("cloudwatch", region_name=region)

    def describe_filesystem(self, filesystem_id: str) -> dict[str, Any]:
        """ファイルシステム情報を取得"""
        try:
            response = self.client.describe_file_systems(
                FileSystemIds=[filesystem_id]
            )
            filesystems = response.get("FileSystems", [])
            if not filesystems:
                raise FsxHelperError(
                    f"ファイルシステム '{filesystem_id}' が見つかりません"
                )
            return filesystems[0]
        except ClientError as e:
            raise FsxHelperError(
                f"ファイルシステム情報の取得に失敗: {e}"
            ) from e

    def describe_volumes(
        self, filesystem_id: Optional[str] = None, volume_ids: Optional[list[str]] = None
    ) -> list[dict[str, Any]]:
        """ボリューム情報を取得"""
        try:
            filters = []
            if filesystem_id:
                filters.append({
                    "Name": "file-system-id",
                    "Values": [filesystem_id],
                })
            kwargs: dict[str, Any] = {}
            if filters:
                kwargs["Filters"] = filters
            if volume_ids:
                kwargs["VolumeIds"] = volume_ids

            volumes = []
            paginator = self.client.get_paginator("describe_volumes")
            for page in paginator.paginate(**kwargs):
                volumes.extend(page.get("Volumes", []))
            return volumes
        except ClientError as e:
            raise FsxHelperError(f"ボリューム情報の取得に失敗: {e}") from e

    def describe_svms(
        self, filesystem_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """SVM 情報を取得"""
        try:
            filters = []
            if filesystem_id:
                filters.append({
                    "Name": "file-system-id",
                    "Values": [filesystem_id],
                })
            kwargs: dict[str, Any] = {}
            if filters:
                kwargs["Filters"] = filters

            svms = []
            paginator = self.client.get_paginator(
                "describe_storage_virtual_machines"
            )
            for page in paginator.paginate(**kwargs):
                svms.extend(page.get("StorageVirtualMachines", []))
            return svms
        except ClientError as e:
            raise FsxHelperError(f"SVM 情報の取得に失敗: {e}") from e

    def update_filesystem_storage_capacity(
        self,
        filesystem_id: str,
        new_capacity_gib: int,
    ) -> dict[str, Any]:
        """
        ファイルシステムのストレージ容量を更新

        FSx for ONTAP のストレージ容量は増加のみ可能。
        最小増分は 10% または 1 TiB のいずれか大きい方。
        """
        try:
            response = self.client.update_file_system(
                FileSystemId=filesystem_id,
                StorageCapacity=new_capacity_gib,
            )
            return response.get("FileSystem", {})
        except ClientError as e:
            raise FsxHelperError(
                f"ストレージ容量の更新に失敗: {e}"
            ) from e

    def update_volume_size(
        self, volume_id: str, new_size_mib: int
    ) -> dict[str, Any]:
        """ボリュームサイズを更新 (AWS API 経由)"""
        try:
            response = self.client.update_volume(
                VolumeId=volume_id,
                OntapConfiguration={
                    "SizeInMegabytes": new_size_mib,
                },
            )
            return response.get("Volume", {})
        except ClientError as e:
            raise FsxHelperError(
                f"ボリュームサイズの更新に失敗: {e}"
            ) from e

    def get_storage_capacity_metrics(
        self,
        filesystem_id: str,
        period_seconds: int = 300,
        hours: int = 1,
    ) -> dict[str, Any]:
        """
        CloudWatch から FSx ONTAP のストレージ容量メトリクスを取得

        Returns:
            {
                "StorageCapacity": [...],
                "StorageUsed": [...],
                "StorageCapacityUtilization": [...]
            }
        """
        from datetime import datetime, timedelta, timezone

        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)

        metrics = {}
        metric_names = [
            "StorageCapacity",
            "StorageUsed",
            "StorageCapacityUtilization",
        ]

        for metric_name in metric_names:
            try:
                response = self.cw_client.get_metric_statistics(
                    Namespace="AWS/FSx",
                    MetricName=metric_name,
                    Dimensions=[
                        {
                            "Name": "FileSystemId",
                            "Value": filesystem_id,
                        }
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=period_seconds,
                    Statistics=["Average", "Maximum"],
                )
                metrics[metric_name] = response.get("Datapoints", [])
            except ClientError as e:
                logger.warning(
                    "メトリクス %s の取得に失敗: %s", metric_name, e
                )
                metrics[metric_name] = []

        return metrics

    def get_volume_metrics(
        self,
        volume_id: str,
        filesystem_id: str,
        period_seconds: int = 300,
        hours: int = 1,
    ) -> dict[str, Any]:
        """CloudWatch からボリュームメトリクスを取得"""
        from datetime import datetime, timedelta, timezone

        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)

        metrics = {}
        metric_names = [
            "StorageUsed",
            "StorageCapacity",
        ]

        for metric_name in metric_names:
            try:
                response = self.cw_client.get_metric_statistics(
                    Namespace="AWS/FSx",
                    MetricName=metric_name,
                    Dimensions=[
                        {"Name": "FileSystemId", "Value": filesystem_id},
                        {"Name": "VolumeId", "Value": volume_id},
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=period_seconds,
                    Statistics=["Average", "Maximum"],
                )
                metrics[metric_name] = response.get("Datapoints", [])
            except ClientError as e:
                logger.warning(
                    "ボリュームメトリクス %s の取得に失敗: %s",
                    metric_name, e,
                )
                metrics[metric_name] = []

        return metrics

    def create_backup(
        self, volume_id: str, tags: Optional[list[dict]] = None
    ) -> dict[str, Any]:
        """ボリュームのバックアップを作成"""
        try:
            kwargs: dict[str, Any] = {"VolumeId": volume_id}
            if tags:
                kwargs["Tags"] = tags
            response = self.client.create_backup(**kwargs)
            return response.get("Backup", {})
        except ClientError as e:
            raise FsxHelperError(
                f"バックアップの作成に失敗: {e}"
            ) from e
