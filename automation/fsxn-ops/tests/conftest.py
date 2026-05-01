"""
テスト共通フィクスチャ

ONTAP REST API のモックと AWS サービスのモックを提供する。
"""

import json
import os
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def env_vars(monkeypatch):
    """テスト用環境変数を設定"""
    monkeypatch.setenv("FSX_FILESYSTEM_ID", "fs-0123456789abcdef0")
    monkeypatch.setenv("ONTAP_SECRET_ID", "fsxn/test-credentials")
    monkeypatch.setenv("MANAGEMENT_LIF", "10.0.1.100")
    monkeypatch.setenv("SNS_TOPIC_ARN", "arn:aws:sns:ap-northeast-1:123456789012:test-topic")
    monkeypatch.setenv("FS_THRESHOLD_PCT", "85")
    monkeypatch.setenv("VOL_THRESHOLD_PCT", "80")
    monkeypatch.setenv("FS_GROW_PCT", "20")
    monkeypatch.setenv("VOL_GROW_PCT", "20")
    monkeypatch.setenv("AUTO_RESIZE_ENABLED", "false")
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setenv("ALLOWED_OPERATIONS", "GET,POST,PATCH,DELETE")
    monkeypatch.setenv("S3_ACCESS_POINT_ARN", "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap")
    monkeypatch.setenv("OUTPUT_BUCKET", "test-output-bucket")
    monkeypatch.setenv("OUTPUT_PREFIX", "preprocessing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-northeast-1")


@pytest.fixture
def mock_secrets_manager():
    """Secrets Manager のモック"""
    with patch("boto3.session.Session") as mock_session_cls:
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.region_name = "ap-northeast-1"

        mock_client = MagicMock()
        mock_session.client.return_value = mock_client
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps({
                "username": "fsxadmin",
                "password": "test-password-123",
            })
        }
        yield mock_client


@pytest.fixture
def mock_ontap_http():
    """ONTAP REST API HTTP 通信のモック"""
    with patch("urllib3.PoolManager") as mock_pool_cls:
        mock_pool = MagicMock()
        mock_pool_cls.return_value = mock_pool
        yield mock_pool


@pytest.fixture
def sample_volumes():
    """テスト用ボリュームデータ"""
    return [
        {
            "uuid": "vol-uuid-001",
            "name": "vol1",
            "size": 107374182400,  # 100 GiB
            "type": "rw",
            "state": "online",
            "svm": {"name": "svm1", "uuid": "svm-uuid-001"},
            "space": {
                "size": 107374182400,
                "used": 85899345920,  # 80 GiB (80%)
                "available": 21474836480,
            },
        },
        {
            "uuid": "vol-uuid-002",
            "name": "vol2",
            "size": 53687091200,  # 50 GiB
            "type": "rw",
            "state": "online",
            "svm": {"name": "svm1", "uuid": "svm-uuid-001"},
            "space": {
                "size": 53687091200,
                "used": 48318382080,  # 45 GiB (90%)
                "available": 5368709120,
            },
        },
    ]


@pytest.fixture
def sample_snapmirror_relationships():
    """テスト用 SnapMirror 関係データ"""
    return [
        {
            "uuid": "sm-uuid-001",
            "source": {
                "path": "svm1:vol1",
                "svm": {"name": "prod-svm"},
            },
            "destination": {
                "path": "svm2:vol1_dr",
                "svm": {"name": "dr-svm"},
            },
            "state": "snapmirrored",
            "healthy": True,
            "policy": {"name": "MirrorAllSnapshots"},
            "lag_time": "PT1H",
        },
        {
            "uuid": "sm-uuid-002",
            "source": {
                "path": "svm1:vol2",
                "svm": {"name": "prod-svm"},
            },
            "destination": {
                "path": "svm2:vol2_dr",
                "svm": {"name": "dr-svm"},
            },
            "state": "snapmirrored",
            "healthy": True,
            "policy": {"name": "MirrorAllSnapshots"},
            "lag_time": "PT30M",
        },
    ]


@pytest.fixture
def sample_cifs_shares():
    """テスト用 CIFS 共有データ"""
    return [
        {
            "name": "share1",
            "path": "/vol1/share1",
            "acls": [],
            "svm": {"name": "prod-svm", "uuid": "svm-uuid-001"},
        },
        {
            "name": "c$",
            "path": "/",
            "acls": [],
            "svm": {"name": "prod-svm", "uuid": "svm-uuid-001"},
        },
    ]
