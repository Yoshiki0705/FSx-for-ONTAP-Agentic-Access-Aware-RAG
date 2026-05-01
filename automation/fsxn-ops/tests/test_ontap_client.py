"""
ONTAP REST API クライアントのユニットテスト
"""

import json
import pytest
from unittest.mock import MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda"))

from common.ontap_client import OntapClient, OntapClientError


class TestOntapClientInit:
    """OntapClient 初期化テスト"""

    def test_init_success(self, mock_secrets_manager, mock_ontap_http):
        """正常な初期化"""
        client = OntapClient(
            management_lif="10.0.1.100",
            secret_id="fsxn/test",
        )
        assert client.management_lif == "10.0.1.100"
        assert client.base_url == "https://10.0.1.100"

    def test_init_secret_not_found(self):
        """Secrets Manager からシークレットが見つからない場合"""
        with patch("boto3.session.Session") as mock_session_cls:
            mock_session = MagicMock()
            mock_session_cls.return_value = mock_session
            mock_session.region_name = "ap-northeast-1"
            mock_client = MagicMock()
            mock_session.client.return_value = mock_client

            from botocore.exceptions import ClientError
            mock_client.get_secret_value.side_effect = ClientError(
                {"Error": {"Code": "ResourceNotFoundException", "Message": "not found"}},
                "GetSecretValue",
            )

            with pytest.raises(OntapClientError, match="認証情報取得に失敗"):
                OntapClient(management_lif="10.0.1.100", secret_id="bad-secret")

    def test_init_invalid_secret_format(self):
        """シークレットのフォーマットが不正な場合"""
        with patch("boto3.session.Session") as mock_session_cls:
            mock_session = MagicMock()
            mock_session_cls.return_value = mock_session
            mock_session.region_name = "ap-northeast-1"
            mock_client = MagicMock()
            mock_session.client.return_value = mock_client
            mock_client.get_secret_value.return_value = {
                "SecretString": json.dumps({"user": "admin"})  # wrong keys
            }

            with pytest.raises(OntapClientError, match="フォーマットが不正"):
                OntapClient(management_lif="10.0.1.100", secret_id="bad-format")


class TestOntapClientRequests:
    """OntapClient API リクエストテスト"""

    @pytest.fixture
    def client(self, mock_secrets_manager, mock_ontap_http):
        """テスト用クライアント"""
        return OntapClient(
            management_lif="10.0.1.100",
            secret_id="fsxn/test",
        )

    def test_get_success(self, client, mock_ontap_http):
        """GET リクエスト成功"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"records": [{"name": "vol1"}]}).encode()
        mock_ontap_http.request.return_value = mock_response

        result = client.get("/storage/volumes")
        assert result["records"][0]["name"] == "vol1"

    def test_get_with_params(self, client, mock_ontap_http):
        """GET リクエスト (パラメータ付き)"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"records": []}).encode()
        mock_ontap_http.request.return_value = mock_response

        client.get("/storage/volumes", params={"fields": "name,size"})

        call_args = mock_ontap_http.request.call_args
        url = call_args[0][1]
        assert "fields=name,size" in url

    def test_api_error_raises_exception(self, client, mock_ontap_http):
        """API エラー時に例外が発生"""
        mock_response = MagicMock()
        mock_response.status = 404
        mock_response.data = b'{"error": "not found"}'
        mock_ontap_http.request.return_value = mock_response

        with pytest.raises(OntapClientError) as exc_info:
            client.get("/storage/volumes/bad-uuid")
        assert exc_info.value.status_code == 404

    def test_post_success(self, client, mock_ontap_http):
        """POST リクエスト成功"""
        mock_response = MagicMock()
        mock_response.status = 201
        mock_response.data = json.dumps({"uuid": "new-uuid"}).encode()
        mock_ontap_http.request.return_value = mock_response

        result = client.post("/storage/volumes", body={"name": "new-vol"})
        assert result["uuid"] == "new-uuid"

    def test_list_volumes(self, client, mock_ontap_http, sample_volumes):
        """ボリューム一覧取得"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"records": sample_volumes}).encode()
        mock_ontap_http.request.return_value = mock_response

        volumes = client.list_volumes()
        assert len(volumes) == 2
        assert volumes[0]["name"] == "vol1"

    def test_list_snapmirror_relationships(
        self, client, mock_ontap_http, sample_snapmirror_relationships
    ):
        """SnapMirror 関係一覧取得"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps(
            {"records": sample_snapmirror_relationships}
        ).encode()
        mock_ontap_http.request.return_value = mock_response

        rels = client.list_snapmirror_relationships()
        assert len(rels) == 2
        assert rels[0]["healthy"] is True

    def test_snapmirror_break(self, client, mock_ontap_http):
        """SnapMirror ブレーク"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"state": "broken_off"}).encode()
        mock_ontap_http.request.return_value = mock_response

        result = client.snapmirror_break("sm-uuid-001")
        assert result["state"] == "broken_off"

    def test_connection_failure(self, client, mock_ontap_http):
        """接続失敗"""
        import urllib3
        mock_ontap_http.request.side_effect = urllib3.exceptions.MaxRetryError(
            pool=None, url="https://10.0.1.100", reason="Connection refused"
        )

        with pytest.raises(OntapClientError, match="接続に失敗"):
            client.get("/cluster")
