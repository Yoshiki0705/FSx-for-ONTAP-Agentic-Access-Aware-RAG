"""
ONTAP API Executor Lambda のユニットテスト
"""

import json
import pytest
from unittest.mock import MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda"))


class TestOntapApiExecutor:
    """ONTAP API Executor テスト"""

    @pytest.fixture(autouse=True)
    def mock_ontap(self, mock_secrets_manager, mock_ontap_http):
        """ONTAP クライアントのモック"""
        self.mock_http = mock_ontap_http

    def _make_response(self, data, status=200):
        resp = MagicMock()
        resp.status = status
        resp.data = json.dumps(data).encode()
        return resp

    def test_get_volumes(self):
        """GET /storage/volumes"""
        self.mock_http.request.return_value = self._make_response(
            {"records": [{"name": "vol1"}]}
        )

        from ontap_api_executor.handler import handler

        result = handler(
            {
                "method": "GET",
                "path": "/storage/volumes",
                "management_lif": "10.0.1.100",
                "secret_id": "fsxn/test",
            },
            None,
        )

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["records"][0]["name"] == "vol1"

    def test_missing_path(self):
        """path が未指定"""
        from ontap_api_executor.handler import handler

        result = handler(
            {
                "method": "GET",
                "path": "",
                "management_lif": "10.0.1.100",
                "secret_id": "fsxn/test",
            },
            None,
        )

        assert result["statusCode"] == 400

    def test_blocked_path(self):
        """ブロックされたパス"""
        from ontap_api_executor.handler import handler

        result = handler(
            {
                "method": "GET",
                "path": "/security/accounts",
                "management_lif": "10.0.1.100",
                "secret_id": "fsxn/test",
            },
            None,
        )

        assert result["statusCode"] == 400
        body = json.loads(result["body"])
        assert "ブロック" in body["error"]

    def test_disallowed_method(self, monkeypatch):
        """許可されていないメソッド"""
        monkeypatch.setenv("ALLOWED_OPERATIONS", "GET")

        # モジュールをリロードして環境変数を反映
        import importlib
        import ontap_api_executor.handler as mod
        importlib.reload(mod)

        result = mod.handler(
            {
                "method": "DELETE",
                "path": "/storage/volumes/xxx",
                "management_lif": "10.0.1.100",
                "secret_id": "fsxn/test",
            },
            None,
        )

        assert result["statusCode"] == 400
        body = json.loads(result["body"])
        assert "許可されていません" in body["error"]

    def test_api_gateway_input(self):
        """API Gateway 経由の入力"""
        self.mock_http.request.return_value = self._make_response(
            {"records": []}
        )

        from ontap_api_executor.handler import handler

        result = handler(
            {
                "body": json.dumps({
                    "method": "GET",
                    "path": "/storage/volumes",
                    "management_lif": "10.0.1.100",
                    "secret_id": "fsxn/test",
                })
            },
            None,
        )

        assert result["statusCode"] == 200

    def test_step_functions_input(self):
        """Step Functions 経由の入力"""
        self.mock_http.request.return_value = self._make_response(
            {"records": []}
        )

        from ontap_api_executor.handler import handler

        result = handler(
            {
                "operation": {
                    "method": "GET",
                    "path": "/storage/volumes",
                },
                "management_lif": "10.0.1.100",
                "secret_id": "fsxn/test",
            },
            None,
        )

        assert result["statusCode"] == 200

    def test_missing_credentials(self, monkeypatch):
        """認証情報が未設定"""
        monkeypatch.delenv("MANAGEMENT_LIF", raising=False)
        monkeypatch.delenv("ONTAP_SECRET_ID", raising=False)

        from ontap_api_executor.handler import handler

        result = handler(
            {
                "method": "GET",
                "path": "/storage/volumes",
            },
            None,
        )

        assert result["statusCode"] == 400
