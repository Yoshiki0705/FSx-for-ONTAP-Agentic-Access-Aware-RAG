"""
Permission Matrix Test Fixtures

テストユーザーとドキュメントのフィクスチャ定義。
SID ベース権限フィルタリングのエッジケーステスト用。
"""

import pytest
from typing import Any


# --- Well-known SIDs ---
SID_EVERYONE = "S-1-1-0"
SID_DOMAIN_ADMINS = "S-1-5-21-0000000000-0000000000-0000000000-512"
SID_ADMINISTRATOR = "S-1-5-21-0000000000-0000000000-0000000000-500"
SID_REGULAR_USER = "S-1-5-21-0000000000-0000000000-0000000000-1001"
SID_ENGINEERING = "S-1-5-21-0000000000-0000000000-0000000000-1100"
SID_FINANCE = "S-1-5-21-0000000000-0000000000-0000000000-1200"
SID_HR = "S-1-5-21-0000000000-0000000000-0000000000-1300"
SID_MANAGERS = "S-1-5-21-0000000000-0000000000-0000000000-1400"


@pytest.fixture
def admin_user() -> dict[str, Any]:
    """管理者ユーザー（Domain Admins + Everyone）"""
    return {
        "userId": "admin@example.com",
        "userSID": SID_ADMINISTRATOR,
        "groupSIDs": [SID_DOMAIN_ADMINS, SID_EVERYONE],
    }


@pytest.fixture
def regular_user() -> dict[str, Any]:
    """一般ユーザー（Everyone のみ）"""
    return {
        "userId": "user@example.com",
        "userSID": SID_REGULAR_USER,
        "groupSIDs": [SID_EVERYONE],
    }


@pytest.fixture
def engineering_user() -> dict[str, Any]:
    """エンジニアリングユーザー（Engineering + Everyone）"""
    return {
        "userId": "engineer@example.com",
        "userSID": "S-1-5-21-0000000000-0000000000-0000000000-1501",
        "groupSIDs": [SID_ENGINEERING, SID_EVERYONE],
    }


@pytest.fixture
def multi_group_user() -> dict[str, Any]:
    """複数グループ所属ユーザー（Engineering + Finance + Everyone）"""
    return {
        "userId": "manager@example.com",
        "userSID": "S-1-5-21-0000000000-0000000000-0000000000-1502",
        "groupSIDs": [SID_ENGINEERING, SID_FINANCE, SID_MANAGERS, SID_EVERYONE],
    }


@pytest.fixture
def no_sid_user() -> dict[str, Any]:
    """SID 未設定ユーザー（Fail-Closed テスト用）"""
    return {
        "userId": "nosid@example.com",
        "userSID": None,
        "groupSIDs": [],
    }


@pytest.fixture
def public_document() -> dict[str, Any]:
    """公開ドキュメント（Everyone アクセス可）"""
    return {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "metadata": {
            "allowed_group_sids": [SID_EVERYONE],
            "access_level": "public",
        },
    }


@pytest.fixture
def confidential_document() -> dict[str, Any]:
    """機密ドキュメント（Domain Admins のみ）"""
    return {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "metadata": {
            "allowed_group_sids": [SID_DOMAIN_ADMINS],
            "access_level": "confidential",
        },
    }


@pytest.fixture
def engineering_document() -> dict[str, Any]:
    """エンジニアリングドキュメント（Engineering + Domain Admins）"""
    return {
        "sourceUri": "s3://bucket/restricted/project-plan.md",
        "metadata": {
            "allowed_group_sids": [SID_ENGINEERING, SID_DOMAIN_ADMINS],
            "access_level": "restricted",
        },
    }


@pytest.fixture
def multi_group_document() -> dict[str, Any]:
    """複数グループアクセス可ドキュメント"""
    return {
        "sourceUri": "s3://bucket/shared/cross-team-report.md",
        "metadata": {
            "allowed_group_sids": [SID_ENGINEERING, SID_FINANCE, SID_HR],
            "access_level": "internal",
        },
    }


@pytest.fixture
def no_metadata_document() -> dict[str, Any]:
    """メタデータなしドキュメント（Fail-Closed テスト用）"""
    return {
        "sourceUri": "s3://bucket/unknown/orphan-file.md",
        "metadata": {},
    }


@pytest.fixture
def empty_sids_document() -> dict[str, Any]:
    """空 SID リストドキュメント（Fail-Closed テスト用）"""
    return {
        "sourceUri": "s3://bucket/broken/empty-sids.md",
        "metadata": {
            "allowed_group_sids": [],
            "access_level": "unknown",
        },
    }


@pytest.fixture
def all_documents(
    public_document,
    confidential_document,
    engineering_document,
    multi_group_document,
    no_metadata_document,
    empty_sids_document,
) -> list[dict[str, Any]]:
    """全テストドキュメント"""
    return [
        public_document,
        confidential_document,
        engineering_document,
        multi_group_document,
        no_metadata_document,
        empty_sids_document,
    ]
