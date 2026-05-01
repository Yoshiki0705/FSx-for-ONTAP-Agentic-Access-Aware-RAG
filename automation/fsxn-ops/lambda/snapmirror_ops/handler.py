"""
SnapMirror 操作 Lambda (Step Functions 用)

Step Functions のステートマシンから呼び出され、
SnapMirror フェイルオーバー/フェイルバックの各ステップを実行する。

各操作は独立した Lambda 呼び出しとして設計し、
Step Functions 側でオーケストレーションする。

環境変数:
    ONTAP_SECRET_ID     : Secrets Manager シークレット ID
    SNS_TOPIC_ARN       : 通知先 SNS トピック ARN (オプション)
"""

import json
import logging
import os
from typing import Any

import boto3

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from common.ontap_client import OntapClient, OntapClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def send_notification(subject: str, message: str) -> None:
    """SNS 通知"""
    topic_arn = os.environ.get("SNS_TOPIC_ARN", "")
    if not topic_arn:
        return
    try:
        boto3.client("sns").publish(
            TopicArn=topic_arn, Subject=subject[:100], Message=message
        )
    except Exception as e:
        logger.warning("SNS 通知失敗: %s", e)


def get_ontap_client(event: dict) -> OntapClient:
    """イベントから ONTAP クライアントを生成"""
    management_lif = event["management_lif"]
    secret_id = event.get("secret_id", os.environ["ONTAP_SECRET_ID"])
    return OntapClient(
        management_lif=management_lif,
        secret_id=secret_id,
        verify_ssl=os.environ.get("ONTAP_VERIFY_SSL", "false").lower() == "true",
        ca_cert_path=os.environ.get("ONTAP_CA_CERT_PATH"),
    )


# ============================================================
# Step 1: SnapMirror 関係の検出
# ============================================================
def discover_relationships(event: dict) -> dict[str, Any]:
    """
    SnapMirror 関係を検出し、フェイルオーバー対象を特定する

    Input:
        {
            "action": "discover",
            "management_lif": "10.0.1.100",
            "svm_name": "prod-svm"
        }

    Output:
        {
            "relationships": [...],
            "total_count": N,
            "healthy_count": N,
            "unhealthy_count": N
        }
    """
    ontap = get_ontap_client(event)
    svm_name = event.get("svm_name")

    relationships = ontap.list_snapmirror_relationships(svm_name=svm_name)

    healthy = [r for r in relationships if r.get("healthy")]
    unhealthy = [r for r in relationships if not r.get("healthy")]

    result = {
        "relationships": relationships,
        "total_count": len(relationships),
        "healthy_count": len(healthy),
        "unhealthy_count": len(unhealthy),
    }

    logger.info(
        "SnapMirror 関係検出: total=%d, healthy=%d, unhealthy=%d",
        result["total_count"],
        result["healthy_count"],
        result["unhealthy_count"],
    )

    return result


# ============================================================
# Step 1b: CIFS 共有 / NFS エクスポートの検出
# ============================================================
def discover_shares(event: dict) -> dict[str, Any]:
    """
    本番 SVM の CIFS 共有と NFS エクスポートを検出し、
    フェイルオーバー後の再作成に必要な設定を収集する。

    Input:
        {
            "action": "discover_shares",
            "management_lif": "10.0.1.100",
            "svm_name": "prod-svm"
        }

    Output:
        {
            "shares": [...],
            "exports": [...],
            "total_shares": N,
            "total_exports": N
        }
    """
    ontap = get_ontap_client(event)
    svm_name = event.get("svm_name")

    shares = []
    exports = []

    try:
        cifs_shares = ontap.list_cifs_shares(svm_name=svm_name)
        for share in cifs_shares:
            # デフォルト共有 (c$, admin$, ipc$) はスキップ
            name = share.get("name", "")
            if name.lower().endswith("$"):
                continue
            shares.append({
                "name": name,
                "path": share.get("path", ""),
                "acls": share.get("acls", []),
                "svm": share.get("svm", {}).get("name", ""),
            })
    except OntapClientError as e:
        logger.warning("CIFS 共有検出失敗 (続行): %s", e)

    try:
        nfs_exports = ontap.list_nfs_exports(svm_name=svm_name)
        for export in nfs_exports:
            exports.append({
                "name": export.get("name", ""),
                "rules": export.get("rules", []),
                "svm": export.get("svm", {}).get("name", ""),
            })
    except OntapClientError as e:
        logger.warning("NFS エクスポート検出失敗 (続行): %s", e)

    result = {
        "shares": shares,
        "exports": exports,
        "total_shares": len(shares),
        "total_exports": len(exports),
    }

    logger.info(
        "共有検出: CIFS=%d, NFS=%d", result["total_shares"], result["total_exports"]
    )

    return result


# ============================================================
# Step 2: 最終転送の実行
# ============================================================
def execute_final_transfer(event: dict) -> dict[str, Any]:
    """
    フェイルオーバー前の最終 SnapMirror 転送を実行

    SnapMirror 関係が uninitialized 状態の場合は初期転送として機能する。
    snapmirrored 状態の場合は最終転送（差分同期）を実行する。

    Input:
        {
            "action": "final_transfer",
            "management_lif": "10.0.1.100",
            "relationship_uuid": "uuid-xxx"
        }
    """
    ontap = get_ontap_client(event)
    rel_uuid = event["relationship_uuid"]

    logger.info("最終転送開始: %s", rel_uuid)

    try:
        result = ontap.snapmirror_transfer(rel_uuid)
        return {
            "relationship_uuid": rel_uuid,
            "transfer_status": "initiated",
            "transfer_details": result,
        }
    except OntapClientError as e:
        # 転送が不要な場合 (既に最新) は成功として扱う
        if e.status_code == 409:
            logger.info("転送不要 (既に最新): %s", rel_uuid)
            return {
                "relationship_uuid": rel_uuid,
                "transfer_status": "already_current",
            }
        logger.error("最終転送失敗: %s", e)
        return {
            "relationship_uuid": rel_uuid,
            "transfer_status": "failed",
            "error": str(e),
        }


# ============================================================
# Step 3: 転送完了の待機
# ============================================================
def check_transfer_status(event: dict) -> dict[str, Any]:
    """
    SnapMirror 転送の完了状態を確認

    Input:
        {
            "action": "check_transfer",
            "management_lif": "10.0.1.100",
            "relationship_uuid": "uuid-xxx"
        }
    """
    ontap = get_ontap_client(event)
    rel_uuid = event["relationship_uuid"]

    try:
        result = ontap.get(f"/snapmirror/relationships/{rel_uuid}")
        state = result.get("state", "unknown")
        transfer = result.get("transfer", {})
        transfer_state = transfer.get("state", "idle") if transfer else "idle"

        is_idle = transfer_state in ("idle", "success", "")
        return {
            "relationship_uuid": rel_uuid,
            "state": state,
            "transfer_state": transfer_state,
            "is_transfer_complete": is_idle,
            "healthy": result.get("healthy", False),
        }
    except OntapClientError as e:
        return {
            "relationship_uuid": rel_uuid,
            "state": "error",
            "transfer_state": "error",
            "is_transfer_complete": False,
            "error": str(e),
        }


# ============================================================
# Step 4: SnapMirror ブレーク (フェイルオーバー)
# ============================================================
def break_relationship(event: dict) -> dict[str, Any]:
    """
    SnapMirror 関係をブレークしてフェイルオーバーを実行

    Input:
        {
            "action": "break",
            "management_lif": "10.0.1.100",
            "relationship_uuid": "uuid-xxx"
        }
    """
    ontap = get_ontap_client(event)
    rel_uuid = event["relationship_uuid"]

    logger.info("SnapMirror ブレーク実行: %s", rel_uuid)

    try:
        ontap.snapmirror_break(rel_uuid)

        send_notification(
            "🔄 SnapMirror フェイルオーバー実行",
            f"SnapMirror 関係 {rel_uuid} をブレークしました。\n"
            f"DR ボリュームが読み書き可能になります。",
        )

        return {
            "relationship_uuid": rel_uuid,
            "break_status": "success",
            "state": "broken_off",
        }
    except OntapClientError as e:
        logger.error("SnapMirror ブレーク失敗: %s", e)
        return {
            "relationship_uuid": rel_uuid,
            "break_status": "failed",
            "error": str(e),
        }


# ============================================================
# Step 5: CIFS 共有 / NFS エクスポートの再作成
# ============================================================
def recreate_shares(event: dict) -> dict[str, Any]:
    """
    DR 側で CIFS 共有と NFS エクスポートを再作成

    Input:
        {
            "action": "recreate_shares",
            "management_lif": "10.0.1.100",  # DR 側の管理 LIF
            "svm_name": "dr-svm",
            "shares_config": [...]  # discover で取得した共有設定
        }
    """
    ontap = get_ontap_client(event)
    svm_name = event.get("svm_name", "")
    shares_config = event.get("shares_config", [])

    results = {"created_shares": [], "failed_shares": [], "skipped": []}

    for share in shares_config:
        share_name = share.get("name", "")
        share_path = share.get("path", "")

        if not share_name or not share_path:
            results["skipped"].append(share)
            continue

        try:
            ontap.post(
                "/protocols/cifs/shares",
                body={
                    "svm": {"name": svm_name},
                    "name": share_name,
                    "path": share_path,
                },
            )
            results["created_shares"].append(share_name)
            logger.info("CIFS 共有作成: %s → %s", share_name, share_path)
        except OntapClientError as e:
            if e.status_code == 409:
                # 既に存在する場合はスキップ
                results["skipped"].append(share_name)
            else:
                results["failed_shares"].append({
                    "name": share_name,
                    "error": str(e),
                })
                logger.error("CIFS 共有作成失敗: %s — %s", share_name, e)

    return results


# ============================================================
# Step 6: SnapMirror 再同期 (フェイルバック)
# ============================================================
def resync_relationship(event: dict) -> dict[str, Any]:
    """
    SnapMirror 関係を再同期してフェイルバックを実行

    Input:
        {
            "action": "resync",
            "management_lif": "10.0.1.100",
            "relationship_uuid": "uuid-xxx"
        }
    """
    ontap = get_ontap_client(event)
    rel_uuid = event["relationship_uuid"]

    logger.info("SnapMirror 再同期実行: %s", rel_uuid)

    try:
        ontap.snapmirror_resync(rel_uuid)

        send_notification(
            "✅ SnapMirror フェイルバック実行",
            f"SnapMirror 関係 {rel_uuid} を再同期しました。\n"
            f"本番環境への復帰が開始されます。",
        )

        return {
            "relationship_uuid": rel_uuid,
            "resync_status": "success",
            "state": "snapmirrored",
        }
    except OntapClientError as e:
        logger.error("SnapMirror 再同期失敗: %s", e)
        return {
            "relationship_uuid": rel_uuid,
            "resync_status": "failed",
            "error": str(e),
        }


# ============================================================
# Step 7: DR 側共有のクリーンアップ (フェイルバック時)
# ============================================================
def cleanup_shares(event: dict) -> dict[str, Any]:
    """
    フェイルバック後に DR 側の一時 CIFS 共有を削除する。

    Input:
        {
            "action": "cleanup_shares",
            "management_lif": "10.0.1.100",  # DR 側の管理 LIF
            "svm_name": "dr-svm"
        }
    """
    ontap = get_ontap_client(event)
    svm_name = event.get("svm_name", "")

    results = {"deleted_shares": [], "failed_deletes": [], "skipped": []}

    try:
        cifs_shares = ontap.list_cifs_shares(svm_name=svm_name)
    except OntapClientError as e:
        logger.error("DR 共有一覧取得失敗: %s", e)
        return {"error": str(e), **results}

    for share in cifs_shares:
        name = share.get("name", "")
        # デフォルト共有はスキップ
        if name.lower().endswith("$"):
            results["skipped"].append(name)
            continue

        svm_info = share.get("svm", {})
        svm_uuid = svm_info.get("uuid", "")

        try:
            ontap.delete(
                f"/protocols/cifs/shares/{svm_uuid}/{name}"
            )
            results["deleted_shares"].append(name)
            logger.info("DR CIFS 共有削除: %s", name)
        except OntapClientError as e:
            results["failed_deletes"].append({"name": name, "error": str(e)})
            logger.error("DR CIFS 共有削除失敗: %s — %s", name, e)

    logger.info(
        "DR 共有クリーンアップ: deleted=%d, failed=%d, skipped=%d",
        len(results["deleted_shares"]),
        len(results["failed_deletes"]),
        len(results["skipped"]),
    )

    return results


# ============================================================
# Step 8: 状態検証
# ============================================================
def validate_state(event: dict) -> dict[str, Any]:
    """
    フェイルオーバー/フェイルバック後の状態を検証

    Input:
        {
            "action": "validate",
            "management_lif": "10.0.1.100",
            "relationship_uuid": "uuid-xxx",
            "expected_state": "broken_off" | "snapmirrored"
        }
    """
    ontap = get_ontap_client(event)
    rel_uuid = event["relationship_uuid"]
    expected_state = event.get("expected_state", "")

    try:
        result = ontap.get(f"/snapmirror/relationships/{rel_uuid}")
        actual_state = result.get("state", "unknown")
        healthy = result.get("healthy", False)

        is_valid = actual_state == expected_state if expected_state else True

        return {
            "relationship_uuid": rel_uuid,
            "actual_state": actual_state,
            "expected_state": expected_state,
            "healthy": healthy,
            "is_valid": is_valid,
        }
    except OntapClientError as e:
        return {
            "relationship_uuid": rel_uuid,
            "actual_state": "error",
            "expected_state": expected_state,
            "is_valid": False,
            "error": str(e),
        }


# ============================================================
# ルーター (Lambda ハンドラー)
# ============================================================

def initialize_relationship(event: dict) -> dict[str, Any]:
    """
    SnapMirror 関係を作成し、初期転送を含めて初期化する。

    ONTAP REST API では 2 つの初期化パスがある:
    1. 関係作成 + 明示的 POST /transfers (final_transfer アクション)
    2. 関係作成時に state="snapmirrored" を指定 (本アクション)

    パス 2 は ONTAP がサポートするフローで、関係作成と初期転送を
    1 回の API 呼び出しで実行する。ただし、検証環境 (ONTAP 9.17.1P4D3)
    では関係作成のジョブが失敗し、別途 POST /transfers が必要だった。
    この動作は ONTAP バージョンや構成に依存する可能性がある。

    Input:
        {
            "action": "initialize",
            "management_lif": "10.0.1.100",
            "source_path": "svm1:vol_src",
            "destination_path": "svm1:vol_dp",
            "policy": "MirrorAllSnapshots"  # optional
        }
    """
    ontap = get_ontap_client(event)
    source_path = event["source_path"]
    destination_path = event["destination_path"]
    policy = event.get("policy")

    logger.info("SnapMirror 初期化: %s → %s", source_path, destination_path)

    body: dict[str, Any] = {
        "source": {"path": source_path},
        "destination": {"path": destination_path},
        "state": "snapmirrored",
    }
    if policy:
        body["policy"] = {"name": policy}

    try:
        result = ontap.post("/snapmirror/relationships", body=body)
        sm_uuid = result.get("uuid", "")
        return {
            "relationship_uuid": sm_uuid,
            "initialize_status": "initiated",
            "source_path": source_path,
            "destination_path": destination_path,
        }
    except OntapClientError as e:
        logger.error("SnapMirror 初期化失敗: %s", e)
        return {
            "initialize_status": "failed",
            "source_path": source_path,
            "destination_path": destination_path,
            "error": str(e),
        }


ACTION_MAP = {
    "discover": discover_relationships,
    "discover_shares": discover_shares,
    "initialize": initialize_relationship,
    "final_transfer": execute_final_transfer,
    "check_transfer": check_transfer_status,
    "break": break_relationship,
    "recreate_shares": recreate_shares,
    "cleanup_shares": cleanup_shares,
    "resync": resync_relationship,
    "validate": validate_state,
}


def handler(event: dict, context: Any) -> dict[str, Any]:
    """
    Lambda ハンドラー — action フィールドで操作を振り分け

    Step Functions から呼び出される際、各ステートが
    action フィールドを指定して個別の操作を実行する。
    """
    action = event.get("action", "")

    if action not in ACTION_MAP:
        return {
            "error": f"不明なアクション: '{action}'",
            "available_actions": list(ACTION_MAP.keys()),
        }

    logger.info("SnapMirror 操作実行: action=%s", action)

    try:
        result = ACTION_MAP[action](event)
        result["action"] = action
        result["success"] = "error" not in result
        return result
    except Exception as e:
        logger.exception("SnapMirror 操作で予期しないエラー: %s", e)
        return {
            "action": action,
            "success": False,
            "error": str(e),
        }
