"""
ONTAP 管理 API 汎用実行 Lambda

ONTAP REST API を Lambda 経由で安全に実行するための汎用ハンドラー。
API Gateway や Step Functions から呼び出し、任意の ONTAP REST API を実行できる。

ユースケース:
- ボリューム作成・削除・変更
- スナップショット管理
- CIFS 共有 / NFS エクスポート管理
- SVM 管理
- SnapMirror 操作

環境変数:
    ONTAP_SECRET_ID     : Secrets Manager シークレット ID
    MANAGEMENT_LIF      : ONTAP 管理 LIF IP アドレス
    ALLOWED_OPERATIONS  : 許可する操作のカンマ区切りリスト (デフォルト: GET)
    MAX_TIMEOUT_SEC     : 最大タイムアウト秒 (デフォルト: 60)
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from common.ontap_client import OntapClient, OntapClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 許可する HTTP メソッド (セキュリティ制御)
ALLOWED_METHODS = set(
    os.environ.get("ALLOWED_OPERATIONS", "GET").upper().split(",")
)

# 危険な API パスのブロックリスト
BLOCKED_PATHS = [
    "/security/accounts",       # アカウント操作
    "/security/login",          # ログイン操作
    "/cluster/licensing",       # ライセンス操作
]


def validate_request(request: dict) -> tuple[str, str, dict | None, dict | None]:
    """
    リクエストを検証し、メソッド・パス・ボディ・パラメータを返す

    Args:
        request: {
            "method": "GET",
            "path": "/storage/volumes",
            "body": {...},       # optional
            "params": {...}      # optional
        }

    Returns:
        (method, path, body, params)

    Raises:
        ValueError: 不正なリクエスト
    """
    method = request.get("method", "GET").upper()
    path = request.get("path", "")
    body = request.get("body")
    params = request.get("params")

    if not path:
        raise ValueError("'path' は必須です (例: /storage/volumes)")

    if not path.startswith("/"):
        path = f"/{path}"

    if method not in ALLOWED_METHODS:
        raise ValueError(
            f"メソッド '{method}' は許可されていません。"
            f"許可: {', '.join(sorted(ALLOWED_METHODS))}"
        )

    # 危険なパスのブロック
    for blocked in BLOCKED_PATHS:
        if path.startswith(blocked):
            raise ValueError(
                f"パス '{path}' はセキュリティ上の理由でブロックされています"
            )

    if method in ("POST", "PATCH", "PUT") and body is None:
        raise ValueError(f"メソッド '{method}' には 'body' が必要です")

    return method, path, body, params


def handler(event: dict, context: Any) -> dict[str, Any]:
    """
    Lambda ハンドラー

    入力形式 (直接呼び出し):
        {
            "method": "GET",
            "path": "/storage/volumes",
            "params": {"fields": "name,size,space"},
            "management_lif": "10.0.1.100",  # optional (env var override)
            "secret_id": "fsxn/admin"         # optional (env var override)
        }

    入力形式 (API Gateway 経由):
        {
            "body": "{\"method\": \"GET\", \"path\": \"/storage/volumes\"}"
        }

    入力形式 (Step Functions 経由):
        {
            "operation": {
                "method": "GET",
                "path": "/storage/volumes",
                "params": {"fields": "name,size"}
            },
            "management_lif": "10.0.1.100",
            "secret_id": "fsxn/admin"
        }
    """
    logger.info("ONTAP API Executor 開始")

    # API Gateway 経由の場合、body を解析
    if "body" in event and isinstance(event["body"], str):
        try:
            request = json.loads(event["body"])
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "不正な JSON ボディ"}),
            }
    elif "operation" in event:
        # Step Functions 経由
        request = event["operation"]
    else:
        request = event

    # 設定の取得 (リクエストで上書き可能)
    management_lif = request.get(
        "management_lif", os.environ.get("MANAGEMENT_LIF", "")
    )
    secret_id = request.get(
        "secret_id", os.environ.get("ONTAP_SECRET_ID", "")
    )

    if not management_lif or not secret_id:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "management_lif と secret_id (ONTAP_SECRET_ID) は必須です"
            }),
        }

    # リクエスト検証
    try:
        method, path, body, params = validate_request(request)
    except ValueError as e:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": str(e)}),
        }

    logger.info("ONTAP API 実行: %s %s", method, path)

    # ONTAP クライアント初期化
    try:
        ontap = OntapClient(
            management_lif=management_lif,
            secret_id=secret_id,
        )
    except OntapClientError as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"ONTAP クライアント初期化失敗: {e}"}),
        }

    # API 実行
    try:
        if method == "GET":
            result = ontap.get(path, params=params)
        elif method == "POST":
            result = ontap.post(path, body=body)
        elif method == "PATCH":
            result = ontap.patch(path, body=body)
        elif method == "DELETE":
            result = ontap.delete(path)
        else:
            return {
                "statusCode": 405,
                "body": json.dumps({"error": f"未対応メソッド: {method}"}),
            }
    except OntapClientError as e:
        logger.error("ONTAP API エラー: %s (status=%d)", e, e.status_code)
        return {
            "statusCode": e.status_code or 500,
            "body": json.dumps({
                "error": str(e),
                "ontap_status": e.status_code,
                "ontap_response": e.response_body[:1000] if e.response_body else None,
            }),
        }

    logger.info("ONTAP API 実行完了: %s %s", method, path)

    return {
        "statusCode": 200,
        "body": json.dumps(result, default=str),
        "headers": {"Content-Type": "application/json"},
    }
