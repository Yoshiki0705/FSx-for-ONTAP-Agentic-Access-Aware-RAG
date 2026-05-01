"""
SnapMirror 操作 Lambda のユニットテスト
"""

import json
import pytest
from unittest.mock import MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda"))


class TestSnapMirrorOpsHandler:
    """SnapMirror 操作ハンドラーテスト"""

    @pytest.fixture(autouse=True)
    def mock_ontap(self, mock_secrets_manager, mock_ontap_http):
        """ONTAP クライアントのモック"""
        self.mock_http = mock_ontap_http

    def _make_response(self, data, status=200):
        """モックレスポンスを生成"""
        resp = MagicMock()
        resp.status = status
        resp.data = json.dumps(data).encode()
        return resp

    def test_discover_relationships(self, sample_snapmirror_relationships):
        """SnapMirror 関係の検出"""
        self.mock_http.request.return_value = self._make_response(
            {"records": sample_snapmirror_relationships}
        )

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "discover",
                "management_lif": "10.0.1.100",
                "svm_name": "prod-svm",
            },
            None,
        )

        assert result["success"] is True
        assert result["total_count"] == 2
        assert result["healthy_count"] == 2

    def test_discover_shares(self, sample_cifs_shares):
        """CIFS 共有の検出"""
        # list_cifs_shares の応答
        self.mock_http.request.side_effect = [
            self._make_response({"records": sample_cifs_shares}),
            self._make_response({"records": []}),  # NFS exports
        ]

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "discover_shares",
                "management_lif": "10.0.1.100",
                "svm_name": "prod-svm",
            },
            None,
        )

        assert result["success"] is True
        # c$ はスキップされるので 1 件
        assert result["total_shares"] == 1
        assert result["shares"][0]["name"] == "share1"

    def test_break_relationship(self):
        """SnapMirror ブレーク"""
        self.mock_http.request.return_value = self._make_response(
            {"state": "broken_off"}
        )

        from snapmirror_ops.handler import handler

        with patch("snapmirror_ops.handler.send_notification"):
            result = handler(
                {
                    "action": "break",
                    "management_lif": "10.0.1.100",
                    "relationship_uuid": "sm-uuid-001",
                },
                None,
            )

        assert result["success"] is True
        assert result["break_status"] == "success"
        assert result["state"] == "broken_off"

    def test_resync_relationship(self):
        """SnapMirror 再同期"""
        self.mock_http.request.return_value = self._make_response(
            {"state": "snapmirrored"}
        )

        from snapmirror_ops.handler import handler

        with patch("snapmirror_ops.handler.send_notification"):
            result = handler(
                {
                    "action": "resync",
                    "management_lif": "10.0.1.100",
                    "relationship_uuid": "sm-uuid-001",
                },
                None,
            )

        assert result["success"] is True
        assert result["resync_status"] == "success"

    def test_check_transfer_complete(self):
        """転送完了チェック"""
        self.mock_http.request.return_value = self._make_response(
            {
                "state": "snapmirrored",
                "healthy": True,
                "transfer": {"state": "idle"},
            }
        )

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "check_transfer",
                "management_lif": "10.0.1.100",
                "relationship_uuid": "sm-uuid-001",
            },
            None,
        )

        assert result["success"] is True
        assert result["is_transfer_complete"] is True

    def test_check_transfer_in_progress(self):
        """転送中チェック"""
        self.mock_http.request.return_value = self._make_response(
            {
                "state": "snapmirrored",
                "healthy": True,
                "transfer": {"state": "transferring"},
            }
        )

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "check_transfer",
                "management_lif": "10.0.1.100",
                "relationship_uuid": "sm-uuid-001",
            },
            None,
        )

        assert result["is_transfer_complete"] is False

    def test_validate_state_success(self):
        """状態検証 — 成功"""
        self.mock_http.request.return_value = self._make_response(
            {"state": "broken_off", "healthy": True}
        )

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "validate",
                "management_lif": "10.0.1.100",
                "relationship_uuid": "sm-uuid-001",
                "expected_state": "broken_off",
            },
            None,
        )

        assert result["success"] is True
        assert result["is_valid"] is True

    def test_validate_state_mismatch(self):
        """状態検証 — 不一致"""
        self.mock_http.request.return_value = self._make_response(
            {"state": "snapmirrored", "healthy": True}
        )

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "validate",
                "management_lif": "10.0.1.100",
                "relationship_uuid": "sm-uuid-001",
                "expected_state": "broken_off",
            },
            None,
        )

        assert result["is_valid"] is False

    def test_unknown_action(self):
        """不明なアクション"""
        from snapmirror_ops.handler import handler

        result = handler({"action": "nonexistent"}, None)
        assert "error" in result
        assert "available_actions" in result

    def test_cleanup_shares(self, sample_cifs_shares):
        """DR 共有クリーンアップ"""
        self.mock_http.request.side_effect = [
            # list_cifs_shares
            self._make_response({"records": sample_cifs_shares}),
            # delete share1 (c$ はスキップ)
            self._make_response({}),
        ]

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "cleanup_shares",
                "management_lif": "10.0.1.100",
                "svm_name": "dr-svm",
            },
            None,
        )

        assert result["success"] is True
        assert "share1" in result["deleted_shares"]
        assert "c$" in result["skipped"]


    def test_initialize_relationship(self):
        """SnapMirror 関係の初期化 (state=snapmirrored パス)"""
        self.mock_http.request.return_value = self._make_response(
            {"uuid": "sm-uuid-new", "state": "snapmirrored"}
        )

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "initialize",
                "management_lif": "10.0.1.100",
                "source_path": "svm1:vol_src",
                "destination_path": "svm1:vol_dp",
            },
            None,
        )

        assert result["success"] is True
        assert result["initialize_status"] == "initiated"

    def test_final_transfer_already_current(self):
        """転送不要 (409 already current)"""
        from common.ontap_client import OntapClientError

        resp_409 = self._make_response({"error": "already current"}, status=409)
        self.mock_http.request.return_value = resp_409

        from snapmirror_ops.handler import handler

        result = handler(
            {
                "action": "final_transfer",
                "management_lif": "10.0.1.100",
                "relationship_uuid": "sm-uuid-001",
            },
            None,
        )

        assert result["success"] is True
        assert result["transfer_status"] == "already_current"
