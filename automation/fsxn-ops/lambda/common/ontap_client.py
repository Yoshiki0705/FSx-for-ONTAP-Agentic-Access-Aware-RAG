"""
ONTAP REST API クライアント共通モジュール

FSx for NetApp ONTAP の管理 LIF に対して REST API を実行する。
Lambda から NFS マウントは行わず、すべて REST API 経由で操作する。

認証情報は AWS Secrets Manager から取得する。
"""

from __future__ import annotations

import json
import logging
import urllib3
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ONTAP の自己署名証明書に対する警告を抑制
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class OntapClientError(Exception):
    """ONTAP REST API 呼び出しで発生するエラー"""

    def __init__(self, message: str, status_code: int = 0, response_body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class OntapClient:
    """
    ONTAP REST API クライアント

    FSx for ONTAP の管理 LIF に対して REST API を実行する。
    認証情報は Secrets Manager から取得し、HTTPS で通信する。

    TLS 検証:
        デフォルトでは TLS 証明書検証が有効 (verify_ssl=True)。
        FSx for ONTAP の管理 LIF は自己署名証明書を使用するため、
        本番環境では ca_cert_path に CA バンドルを指定するか、
        ラボ/PoC 環境でのみ verify_ssl=False を明示的に設定する。

    Usage:
        # 本番環境 (CA バンドル指定)
        client = OntapClient(
            management_lif="10.0.1.100",
            secret_id="fsxn/admin-credentials",
            ca_cert_path="/path/to/ca-bundle.crt",
        )

        # ラボ/PoC 環境 (証明書検証を明示的に無効化)
        client = OntapClient(
            management_lif="10.0.1.100",
            secret_id="fsxn/admin-credentials",
            verify_ssl=False,  # ⚠️ ラボ/PoC 環境のみ
        )
    """

    ONTAP_API_BASE = "/api"

    def __init__(
        self,
        management_lif: str,
        secret_id: str,
        region: Optional[str] = None,
        verify_ssl: bool = True,
        ca_cert_path: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.management_lif = management_lif
        self.base_url = f"https://{management_lif}"
        self.verify_ssl = verify_ssl
        self.ca_cert_path = ca_cert_path
        self.timeout = timeout

        if not verify_ssl:
            logger.warning(
                "TLS 証明書検証が無効です。本番環境では verify_ssl=True + "
                "ca_cert_path を使用してください。"
            )

        # Secrets Manager から認証情報を取得
        self._username, self._password = self._get_credentials(secret_id, region)

        # urllib3 HTTP プールマネージャ
        pool_kwargs: dict[str, Any] = {
            "timeout": urllib3.Timeout(connect=10.0, read=timeout),
            "retries": urllib3.Retry(total=3, backoff_factor=0.5),
        }
        if verify_ssl:
            pool_kwargs["cert_reqs"] = "CERT_REQUIRED"
            if ca_cert_path:
                pool_kwargs["ca_certs"] = ca_cert_path
        else:
            pool_kwargs["cert_reqs"] = "CERT_NONE"

        self._http = urllib3.PoolManager(**pool_kwargs)

    def _get_credentials(
        self, secret_id: str, region: Optional[str] = None
    ) -> tuple[str, str]:
        """Secrets Manager から ONTAP 管理者認証情報を取得"""
        try:
            session = boto3.session.Session()
            client = session.client(
                service_name="secretsmanager",
                region_name=region or session.region_name,
            )
            response = client.get_secret_value(SecretId=secret_id)
            secret = json.loads(response["SecretString"])
            return secret["username"], secret["password"]
        except ClientError as e:
            raise OntapClientError(
                f"Secrets Manager からの認証情報取得に失敗: {e}"
            ) from e
        except (KeyError, json.JSONDecodeError) as e:
            raise OntapClientError(
                f"認証情報のフォーマットが不正 (username/password キーが必要): {e}"
            ) from e

    def _make_headers(self) -> dict[str, str]:
        """認証ヘッダーを生成"""
        return urllib3.make_headers(
            basic_auth=f"{self._username}:{self._password}"
        ) | {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict[str, Any]:
        """ONTAP REST API リクエストを実行"""
        url = f"{self.base_url}{self.ONTAP_API_BASE}{path}"

        if params:
            query_string = "&".join(f"{k}={v}" for k, v in params.items())
            url = f"{url}?{query_string}"

        logger.info("ONTAP API %s %s", method, path)

        try:
            response = self._http.request(
                method,
                url,
                headers=self._make_headers(),
                body=json.dumps(body).encode("utf-8") if body else None,
            )
        except urllib3.exceptions.MaxRetryError as e:
            raise OntapClientError(
                f"ONTAP API への接続に失敗 ({self.management_lif}): {e}"
            ) from e

        if response.status >= 400:
            raise OntapClientError(
                f"ONTAP API エラー: {response.status}",
                status_code=response.status,
                response_body=response.data.decode("utf-8", errors="replace"),
            )

        if response.data:
            return json.loads(response.data.decode("utf-8"))
        return {}

    # --- 便利メソッド ---

    def get(self, path: str, params: Optional[dict] = None) -> dict[str, Any]:
        """GET リクエスト"""
        return self._request("GET", path, params=params)

    def post(self, path: str, body: dict) -> dict[str, Any]:
        """POST リクエスト"""
        return self._request("POST", path, body=body)

    def patch(self, path: str, body: dict) -> dict[str, Any]:
        """PATCH リクエスト"""
        return self._request("PATCH", path, body=body)

    def delete(self, path: str) -> dict[str, Any]:
        """DELETE リクエスト"""
        return self._request("DELETE", path)

    # --- ONTAP 操作ショートカット ---

    def list_volumes(self, svm_name: Optional[str] = None) -> list[dict]:
        """ボリューム一覧を取得"""
        params = {"fields": "name,size,space,svm,state,type,nas"}
        if svm_name:
            params["svm.name"] = svm_name
        result = self.get("/storage/volumes", params=params)
        return result.get("records", [])

    def get_volume(self, volume_uuid: str) -> dict:
        """ボリューム詳細を取得"""
        return self.get(
            f"/storage/volumes/{volume_uuid}",
            params={"fields": "name,size,space,svm,state,type,nas,snapmirror"},
        )

    def resize_volume(self, volume_uuid: str, new_size_bytes: int) -> dict:
        """ボリュームサイズを変更"""
        return self.patch(
            f"/storage/volumes/{volume_uuid}",
            body={"size": new_size_bytes},
        )

    def list_snapmirror_relationships(
        self, svm_name: Optional[str] = None
    ) -> list[dict]:
        """SnapMirror 関係一覧を取得"""
        params = {
            "fields": "source,destination,state,healthy,transfer,policy,lag_time"
        }
        if svm_name:
            params["destination.svm.name"] = svm_name
        result = self.get("/snapmirror/relationships", params=params)
        return result.get("records", [])

    def snapmirror_transfer(self, relationship_uuid: str) -> dict:
        """SnapMirror 転送を開始"""
        return self.post(
            f"/snapmirror/relationships/{relationship_uuid}/transfers",
            body={},
        )

    def snapmirror_break(self, relationship_uuid: str) -> dict:
        """SnapMirror 関係をブレーク (フェイルオーバー)"""
        return self.patch(
            f"/snapmirror/relationships/{relationship_uuid}",
            body={"state": "broken_off"},
        )

    def snapmirror_resync(self, relationship_uuid: str) -> dict:
        """SnapMirror 関係を再同期"""
        return self.patch(
            f"/snapmirror/relationships/{relationship_uuid}",
            body={"state": "snapmirrored"},
        )

    def list_cifs_shares(self, svm_name: Optional[str] = None) -> list[dict]:
        """CIFS 共有一覧を取得"""
        params = {"fields": "name,path,acls,svm"}
        if svm_name:
            params["svm.name"] = svm_name
        result = self.get("/protocols/cifs/shares", params=params)
        return result.get("records", [])

    def list_nfs_exports(self, svm_name: Optional[str] = None) -> list[dict]:
        """NFS エクスポートポリシー一覧を取得"""
        params = {"fields": "name,rules,svm"}
        if svm_name:
            params["svm.name"] = svm_name
        result = self.get("/protocols/nfs/export-policies", params=params)
        return result.get("records", [])

    def get_svm(self, svm_name: str) -> dict:
        """SVM 情報を取得"""
        result = self.get(
            "/svm/svms",
            params={"name": svm_name, "fields": "name,state,ip_interfaces,cifs,nfs"},
        )
        records = result.get("records", [])
        if not records:
            raise OntapClientError(f"SVM '{svm_name}' が見つかりません")
        return records[0]

    def list_snapshots(
        self, volume_uuid: str, older_than_days: Optional[int] = None
    ) -> list[dict]:
        """スナップショット一覧を取得"""
        params = {"fields": "name,create_time,size"}
        result = self.get(
            f"/storage/volumes/{volume_uuid}/snapshots", params=params
        )
        return result.get("records", [])

    def get_cluster_info(self) -> dict:
        """クラスタ情報を取得"""
        return self.get("/cluster", params={"fields": "name,version,uuid"})

    # --- AD DC 到達性チェック ---

    def is_cifs_enabled(self, svm_name: str) -> bool:
        """
        SVM で CIFS (AD参加) が有効かどうかを確認する。

        CIFS が有効な SVM では、S3 Access Point のデータ操作
        (ListObjectsV2, GetObject, PutObject) に AD DC 到達性が必須。
        HeadBucket は成功するが、データ操作は AccessDenied になる。

        Args:
            svm_name: SVM 名

        Returns:
            True if CIFS is enabled (SVM is AD-joined)
        """
        try:
            result = self.get(
                "/protocols/cifs/services",
                params={"svm.name": svm_name, "fields": "enabled,ad_domain.fqdn"},
            )
            records = result.get("records", [])
            if records and records[0].get("enabled", False):
                return True
            return False
        except OntapClientError:
            # CIFS エンドポイントへのクエリ失敗はCIFS無効と見なす
            return False

    def check_ad_dc_reachability(self, svm_name: str) -> dict[str, Any]:
        """
        AD DC 到達性を確認する（S3 AP データ操作の前提条件チェック）。

        AD参加 SVM では、全ての S3 AP データ操作で ONTAP が unix→win
        逆引きネームマッピングを実行するため、AD DC への LDAP/Kerberos
        接続が必須。AD DC 到達不能時は AccessDenied が返るが、
        HeadBucket は成功するため、誤った層でのトラブルシューティングを
        招きやすい。

        Returns:
            {
                "cifs_enabled": bool,
                "ad_domain": str or None,
                "dc_reachable": bool,
                "discovered_servers": list[dict],
                "error": str or None,
            }

        Usage:
            # S3 AP データ操作前の pre-flight チェック
            health = ontap.check_ad_dc_reachability("svm1")
            if health["cifs_enabled"] and not health["dc_reachable"]:
                raise RuntimeError(
                    f"AD DC 到達不能: S3 AP データ操作は AccessDenied になります。"
                    f" AD domain: {health['ad_domain']}"
                )
        """
        result: dict[str, Any] = {
            "cifs_enabled": False,
            "ad_domain": None,
            "dc_reachable": False,
            "discovered_servers": [],
            "error": None,
        }

        # Step 1: CIFS サービスの有効状態を確認
        try:
            cifs_resp = self.get(
                "/protocols/cifs/services",
                params={"svm.name": svm_name, "fields": "enabled,ad_domain.fqdn"},
            )
            cifs_records = cifs_resp.get("records", [])
            if not cifs_records or not cifs_records[0].get("enabled", False):
                # CIFS 無効 = AD 非参加 → S3 AP に AD DC 到達性は不要
                return result

            result["cifs_enabled"] = True
            result["ad_domain"] = (
                cifs_records[0].get("ad_domain", {}).get("fqdn")
            )
        except OntapClientError as e:
            result["error"] = f"CIFS サービス確認失敗: {e}"
            return result

        # Step 2: CIFS ドメイン検出 (DC 到達性の実効チェック)
        # /protocols/cifs/domains は SVM が認識している DC 一覧を返す。
        # discovered_servers が空 = AD DC 到達不能
        try:
            domain_resp = self.get(
                "/protocols/cifs/domains",
                params={
                    "svm.name": svm_name,
                    "fields": "name,discovered_servers",
                },
            )
            domain_records = domain_resp.get("records", [])
            if domain_records:
                servers = domain_records[0].get("discovered_servers", [])
                result["discovered_servers"] = servers
                result["dc_reachable"] = len(servers) > 0
            else:
                result["dc_reachable"] = False
        except OntapClientError as e:
            # ドメイン検出 API 呼び出し失敗 → DC 到達不能と見なす
            result["error"] = f"CIFS ドメイン検出失敗: {e}"
            result["dc_reachable"] = False

        return result
