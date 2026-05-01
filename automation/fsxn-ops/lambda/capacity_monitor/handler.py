"""
FSx for NetApp ONTAP 容量監視・自動拡張 Lambda

EventBridge Scheduler (5分間隔) でトリガーされ、以下を実行する:
1. FSx ONTAP ファイルシステムのストレージ容量使用率を監視
2. 各ボリュームの使用率を監視
3. 閾値超過時に自動拡張を実行
4. SNS 通知を送信

環境変数:
    FSX_FILESYSTEM_ID   : FSx ファイルシステム ID
    ONTAP_SECRET_ID     : Secrets Manager シークレット ID (ONTAP 認証情報)
    MANAGEMENT_LIF      : ONTAP 管理 LIF IP アドレス
    SNS_TOPIC_ARN       : 通知先 SNS トピック ARN
    FS_THRESHOLD_PCT    : ファイルシステム容量閾値 (デフォルト: 85)
    VOL_THRESHOLD_PCT   : ボリューム容量閾値 (デフォルト: 80)
    FS_GROW_PCT         : ファイルシステム拡張率 (デフォルト: 20)
    VOL_GROW_PCT        : ボリューム拡張率 (デフォルト: 20)
    AUTO_RESIZE_ENABLED : 自動拡張有効化 (デフォルト: false)
    DRY_RUN             : ドライラン (デフォルト: true)
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3

# Lambda Layer または同梱の共通モジュール
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from common.ontap_client import OntapClient, OntapClientError
from common.fsx_helpers import FsxHelper, FsxHelperError

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get_config() -> dict[str, Any]:
    """環境変数から設定を取得"""
    return {
        "filesystem_id": os.environ["FSX_FILESYSTEM_ID"],
        "secret_id": os.environ["ONTAP_SECRET_ID"],
        "management_lif": os.environ["MANAGEMENT_LIF"],
        "sns_topic_arn": os.environ.get("SNS_TOPIC_ARN", ""),
        "fs_threshold_pct": float(os.environ.get("FS_THRESHOLD_PCT", "85")),
        "vol_threshold_pct": float(os.environ.get("VOL_THRESHOLD_PCT", "80")),
        "fs_grow_pct": float(os.environ.get("FS_GROW_PCT", "20")),
        "vol_grow_pct": float(os.environ.get("VOL_GROW_PCT", "20")),
        "auto_resize_enabled": os.environ.get(
            "AUTO_RESIZE_ENABLED", "false"
        ).lower() == "true",
        "dry_run": os.environ.get("DRY_RUN", "true").lower() == "true",
    }


def send_notification(
    sns_topic_arn: str, subject: str, message: str
) -> None:
    """SNS 通知を送信"""
    if not sns_topic_arn:
        logger.info("SNS トピック未設定 — 通知スキップ")
        return
    try:
        sns = boto3.client("sns")
        sns.publish(
            TopicArn=sns_topic_arn,
            Subject=subject[:100],
            Message=message,
        )
        logger.info("SNS 通知送信完了: %s", subject)
    except Exception as e:
        logger.error("SNS 通知送信失敗: %s", e)


def check_filesystem_capacity(
    fsx: FsxHelper, config: dict[str, Any]
) -> dict[str, Any]:
    """ファイルシステムレベルの容量チェック"""
    fs_id = config["filesystem_id"]
    fs_info = fsx.describe_filesystem(fs_id)

    ontap_config = fs_info.get("OntapConfiguration", {})
    storage_capacity_gib = fs_info.get("StorageCapacity", 0)

    # SSD ストレージ使用量を CloudWatch から取得
    metrics = fsx.get_storage_capacity_metrics(fs_id, hours=1)
    utilization_points = metrics.get("StorageCapacityUtilization", [])

    if utilization_points:
        # 最新のデータポイントを使用
        latest = max(utilization_points, key=lambda x: x["Timestamp"])
        utilization_pct = latest.get("Maximum", latest.get("Average", 0))
    else:
        # CloudWatch メトリクスが取得できない場合
        # 注: FSx ONTAP の StorageCapacityUtilization メトリクスは
        # ファイルシステム作成直後やデータが少ない場合に取得できないことがある。
        # この場合は 0% として扱い、ボリュームレベルの監視に委ねる。
        logger.warning(
            "CloudWatch StorageCapacityUtilization メトリクス取得不可 — "
            "FS レベル使用率は 0%% として扱います (ボリュームレベルは ONTAP API で監視)"
        )
        utilization_pct = 0

    result = {
        "filesystem_id": fs_id,
        "storage_capacity_gib": storage_capacity_gib,
        "utilization_pct": round(utilization_pct, 2),
        "threshold_pct": config["fs_threshold_pct"],
        "exceeded": utilization_pct >= config["fs_threshold_pct"],
        "action_taken": None,
    }

    if result["exceeded"] and config["auto_resize_enabled"]:
        grow_factor = 1 + (config["fs_grow_pct"] / 100)
        new_capacity_gib = int(storage_capacity_gib * grow_factor)

        # FSx ONTAP の最小増分: 10% or 1 TiB
        min_increase = max(int(storage_capacity_gib * 0.1), 1024)
        if new_capacity_gib - storage_capacity_gib < min_increase:
            new_capacity_gib = storage_capacity_gib + min_increase

        if config["dry_run"]:
            result["action_taken"] = (
                f"[DRY RUN] ファイルシステム拡張: "
                f"{storage_capacity_gib} GiB → {new_capacity_gib} GiB"
            )
            logger.info(result["action_taken"])
        else:
            try:
                fsx.update_filesystem_storage_capacity(fs_id, new_capacity_gib)
                result["action_taken"] = (
                    f"ファイルシステム拡張実行: "
                    f"{storage_capacity_gib} GiB → {new_capacity_gib} GiB"
                )
                logger.info(result["action_taken"])
            except FsxHelperError as e:
                result["action_taken"] = f"拡張失敗: {e}"
                logger.error(result["action_taken"])

    return result


def check_volume_capacity(
    ontap: OntapClient, fsx: FsxHelper, config: dict[str, Any]
) -> list[dict[str, Any]]:
    """ボリュームレベルの容量チェック (ONTAP REST API 使用)"""
    results = []

    try:
        volumes = ontap.list_volumes()
    except OntapClientError as e:
        logger.error("ボリューム一覧取得失敗: %s", e)
        return [{"error": str(e)}]

    for vol in volumes:
        vol_name = vol.get("name", "unknown")
        vol_uuid = vol.get("uuid", "")
        space = vol.get("space", {})

        # root ボリュームと dp ボリュームはスキップ
        if vol.get("type") in ("dp",) and vol_name.endswith("_root"):
            continue

        total_bytes = space.get("size", 0) or vol.get("size", 0)
        used_bytes = space.get("used", 0)
        available_bytes = space.get("available", 0)

        if total_bytes == 0:
            continue

        utilization_pct = (used_bytes / total_bytes) * 100

        vol_result = {
            "volume_name": vol_name,
            "volume_uuid": vol_uuid,
            "svm": vol.get("svm", {}).get("name", "unknown"),
            "total_gib": round(total_bytes / (1024**3), 2),
            "used_gib": round(used_bytes / (1024**3), 2),
            "available_gib": round(available_bytes / (1024**3), 2),
            "utilization_pct": round(utilization_pct, 2),
            "threshold_pct": config["vol_threshold_pct"],
            "exceeded": utilization_pct >= config["vol_threshold_pct"],
            "action_taken": None,
        }

        if vol_result["exceeded"] and config["auto_resize_enabled"]:
            grow_factor = 1 + (config["vol_grow_pct"] / 100)
            new_size_bytes = int(total_bytes * grow_factor)

            if config["dry_run"]:
                vol_result["action_taken"] = (
                    f"[DRY RUN] ボリューム拡張: {vol_name} "
                    f"{vol_result['total_gib']} GiB → "
                    f"{round(new_size_bytes / (1024**3), 2)} GiB"
                )
                logger.info(vol_result["action_taken"])
            else:
                try:
                    ontap.resize_volume(vol_uuid, new_size_bytes)
                    vol_result["action_taken"] = (
                        f"ボリューム拡張実行: {vol_name} "
                        f"{vol_result['total_gib']} GiB → "
                        f"{round(new_size_bytes / (1024**3), 2)} GiB"
                    )
                    logger.info(vol_result["action_taken"])
                except OntapClientError as e:
                    vol_result["action_taken"] = f"拡張失敗: {e}"
                    logger.error(vol_result["action_taken"])

        results.append(vol_result)

    return results


def handler(event: dict, context: Any) -> dict[str, Any]:
    """
    Lambda ハンドラー

    EventBridge Scheduler から定期実行される。
    ファイルシステムとボリュームの容量を監視し、
    閾値超過時に自動拡張と通知を行う。
    """
    logger.info("容量監視開始: %s", json.dumps(event, default=str))

    config = get_config()
    timestamp = datetime.now(timezone.utc).isoformat()

    # クライアント初期化
    fsx = FsxHelper()
    ontap = OntapClient(
        management_lif=config["management_lif"],
        secret_id=config["secret_id"],
    )

    # ファイルシステム容量チェック
    fs_result = check_filesystem_capacity(fsx, config)

    # ボリューム容量チェック
    vol_results = check_volume_capacity(ontap, fsx, config)

    # 閾値超過ボリュームの抽出
    exceeded_volumes = [v for v in vol_results if v.get("exceeded")]

    # 結果サマリー
    summary = {
        "timestamp": timestamp,
        "filesystem": fs_result,
        "volumes_checked": len(vol_results),
        "volumes_exceeded": len(exceeded_volumes),
        "exceeded_volumes": exceeded_volumes,
        "config": {
            "auto_resize_enabled": config["auto_resize_enabled"],
            "dry_run": config["dry_run"],
            "fs_threshold_pct": config["fs_threshold_pct"],
            "vol_threshold_pct": config["vol_threshold_pct"],
        },
    }

    # 閾値超過時に通知
    if fs_result.get("exceeded") or exceeded_volumes:
        subject = (
            f"⚠️ FSx ONTAP 容量警告 — {config['filesystem_id']}"
        )
        message_lines = [
            f"FSx for NetApp ONTAP 容量監視レポート",
            f"タイムスタンプ: {timestamp}",
            f"ファイルシステム: {config['filesystem_id']}",
            "",
        ]

        if fs_result.get("exceeded"):
            message_lines.extend([
                "【ファイルシステム容量】",
                f"  使用率: {fs_result['utilization_pct']}% "
                f"(閾値: {fs_result['threshold_pct']}%)",
                f"  容量: {fs_result['storage_capacity_gib']} GiB",
                f"  アクション: {fs_result.get('action_taken', 'なし')}",
                "",
            ])

        if exceeded_volumes:
            message_lines.append("【閾値超過ボリューム】")
            for vol in exceeded_volumes:
                message_lines.extend([
                    f"  - {vol['volume_name']} ({vol['svm']})",
                    f"    使用率: {vol['utilization_pct']}% "
                    f"(閾値: {vol['threshold_pct']}%)",
                    f"    使用量: {vol['used_gib']} / {vol['total_gib']} GiB",
                    f"    アクション: {vol.get('action_taken', 'なし')}",
                ])

        send_notification(
            config["sns_topic_arn"],
            subject,
            "\n".join(message_lines),
        )

    logger.info(
        "容量監視完了: FS=%s, Vol=%d checked / %d exceeded",
        "EXCEEDED" if fs_result.get("exceeded") else "OK",
        len(vol_results),
        len(exceeded_volumes),
    )

    return summary
