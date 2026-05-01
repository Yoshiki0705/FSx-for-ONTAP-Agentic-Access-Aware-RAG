"""
容量監視 Lambda のユニットテスト
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda"))


class TestCapacityMonitor:
    """容量監視ハンドラーテスト"""

    @pytest.fixture(autouse=True)
    def mock_deps(self, mock_secrets_manager, mock_ontap_http):
        """依存のモック"""
        self.mock_http = mock_ontap_http

    def _make_response(self, data, status=200):
        resp = MagicMock()
        resp.status = status
        resp.data = json.dumps(data).encode()
        return resp

    @patch("capacity_monitor.handler.FsxHelper")
    @patch("capacity_monitor.handler.send_notification")
    def test_no_threshold_exceeded(self, mock_notify, mock_fsx_cls, sample_volumes):
        """閾値未超過"""
        # ONTAP API: ボリューム一覧 (使用率 80% — 閾値 80% 未満にする)
        low_usage_volumes = []
        for vol in sample_volumes:
            v = dict(vol)
            v["space"] = {
                "size": 107374182400,
                "used": 53687091200,  # 50%
                "available": 53687091200,
            }
            low_usage_volumes.append(v)

        self.mock_http.request.return_value = self._make_response(
            {"records": low_usage_volumes}
        )

        # FSx Helper モック
        mock_fsx = MagicMock()
        mock_fsx_cls.return_value = mock_fsx
        mock_fsx.describe_filesystem.return_value = {
            "StorageCapacity": 1024,
            "OntapConfiguration": {},
        }
        mock_fsx.get_storage_capacity_metrics.return_value = {
            "StorageCapacityUtilization": [
                {
                    "Timestamp": datetime.now(timezone.utc),
                    "Maximum": 50.0,
                    "Average": 48.0,
                }
            ]
        }

        from capacity_monitor.handler import handler

        result = handler({"source": "test"}, None)

        assert result["filesystem"]["exceeded"] is False
        assert result["volumes_exceeded"] == 0
        mock_notify.assert_not_called()

    @patch("capacity_monitor.handler.FsxHelper")
    @patch("capacity_monitor.handler.send_notification")
    def test_volume_threshold_exceeded(self, mock_notify, mock_fsx_cls, sample_volumes):
        """ボリューム閾値超過 — 通知が送信される"""
        # vol2 は 90% 使用率 → 閾値 80% 超過
        self.mock_http.request.return_value = self._make_response(
            {"records": sample_volumes}
        )

        mock_fsx = MagicMock()
        mock_fsx_cls.return_value = mock_fsx
        mock_fsx.describe_filesystem.return_value = {
            "StorageCapacity": 1024,
            "OntapConfiguration": {},
        }
        mock_fsx.get_storage_capacity_metrics.return_value = {
            "StorageCapacityUtilization": [
                {
                    "Timestamp": datetime.now(timezone.utc),
                    "Maximum": 70.0,
                    "Average": 68.0,
                }
            ]
        }

        from capacity_monitor.handler import handler

        result = handler({"source": "test"}, None)

        assert result["volumes_exceeded"] >= 1
        mock_notify.assert_called_once()

    @patch("capacity_monitor.handler.FsxHelper")
    @patch("capacity_monitor.handler.send_notification")
    def test_filesystem_threshold_exceeded(self, mock_notify, mock_fsx_cls):
        """ファイルシステム閾値超過"""
        self.mock_http.request.return_value = self._make_response(
            {"records": []}
        )

        mock_fsx = MagicMock()
        mock_fsx_cls.return_value = mock_fsx
        mock_fsx.describe_filesystem.return_value = {
            "StorageCapacity": 1024,
            "OntapConfiguration": {},
        }
        mock_fsx.get_storage_capacity_metrics.return_value = {
            "StorageCapacityUtilization": [
                {
                    "Timestamp": datetime.now(timezone.utc),
                    "Maximum": 90.0,
                    "Average": 88.0,
                }
            ]
        }

        from capacity_monitor.handler import handler

        result = handler({"source": "test"}, None)

        assert result["filesystem"]["exceeded"] is True
        assert result["filesystem"]["utilization_pct"] == 90.0
        mock_notify.assert_called_once()

    @patch("capacity_monitor.handler.FsxHelper")
    @patch("capacity_monitor.handler.send_notification")
    def test_dry_run_no_actual_resize(self, mock_notify, mock_fsx_cls, monkeypatch):
        """ドライラン — 実際のリサイズは行わない"""
        monkeypatch.setenv("AUTO_RESIZE_ENABLED", "true")
        monkeypatch.setenv("DRY_RUN", "true")

        self.mock_http.request.return_value = self._make_response(
            {"records": []}
        )

        mock_fsx = MagicMock()
        mock_fsx_cls.return_value = mock_fsx
        mock_fsx.describe_filesystem.return_value = {
            "StorageCapacity": 1024,
            "OntapConfiguration": {},
        }
        mock_fsx.get_storage_capacity_metrics.return_value = {
            "StorageCapacityUtilization": [
                {
                    "Timestamp": datetime.now(timezone.utc),
                    "Maximum": 90.0,
                }
            ]
        }

        from capacity_monitor.handler import handler

        result = handler({"source": "test"}, None)

        assert result["filesystem"]["exceeded"] is True
        assert "DRY RUN" in (result["filesystem"]["action_taken"] or "")
        mock_fsx.update_filesystem_storage_capacity.assert_not_called()
