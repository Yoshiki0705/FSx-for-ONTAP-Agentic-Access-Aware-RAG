"""
Permission Matrix Tests — SID ベース権限フィルタリングのエッジケーステスト

テストカテゴリ:
1. 基本権限フィルタリング
2. グループネスティング
3. 継承権限
4. Fail-Closed
5. 権限変更反映
6. エッジケース
"""

import pytest
from typing import Any

from conftest import (
    SID_EVERYONE,
    SID_DOMAIN_ADMINS,
    SID_ENGINEERING,
    SID_FINANCE,
    SID_HR,
    SID_MANAGERS,
    SID_REGULAR_USER,
)


def filter_documents_by_sid(
    user_sids: list[str], documents: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    SID フィルタリングロジック（アプリケーションの route.ts と同等）

    ルール:
    - ユーザー SID リストとドキュメントの allowed_group_sids の積集合が空でなければ ALLOW
    - メタデータなし or allowed_group_sids なし → DENY（Fail-Closed）
    - ユーザー SID リストが空 → 全 DENY（Fail-Closed）
    """
    if not user_sids:
        return []

    allowed = []
    for doc in documents:
        metadata = doc.get("metadata", {})
        doc_sids = metadata.get("allowed_group_sids")

        # Fail-Closed: メタデータなし or SID リストなし → DENY
        if not doc_sids:
            continue

        # SID マッチング: 積集合が空でなければ ALLOW
        if set(user_sids) & set(doc_sids):
            allowed.append(doc)

    return allowed


def get_all_user_sids(user: dict[str, Any]) -> list[str]:
    """ユーザーの全 SID リストを取得（userSID + groupSIDs）"""
    sids = []
    if user.get("userSID"):
        sids.append(user["userSID"])
    sids.extend(user.get("groupSIDs", []))
    return sids


# =============================================================================
# 1. 基本権限フィルタリング
# =============================================================================


class TestBasicPermissionFiltering:
    """基本的な SID マッチングのテスト"""

    def test_everyone_access(self, regular_user, public_document):
        """1.1: Everyone SID でアクセス可能"""
        user_sids = get_all_user_sids(regular_user)
        result = filter_documents_by_sid(user_sids, [public_document])
        assert len(result) == 1
        assert result[0]["sourceUri"] == public_document["sourceUri"]

    def test_group_match(self, admin_user, confidential_document):
        """1.2: グループ SID でアクセス可能"""
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [confidential_document])
        assert len(result) == 1

    def test_no_match(self, regular_user, confidential_document):
        """1.3: SID 不一致でアクセス拒否"""
        user_sids = get_all_user_sids(regular_user)
        result = filter_documents_by_sid(user_sids, [confidential_document])
        assert len(result) == 0

    def test_partial_match_multiple_user_sids(
        self, engineering_user, engineering_document
    ):
        """1.4: 複数ユーザー SID の部分マッチ"""
        user_sids = get_all_user_sids(engineering_user)
        result = filter_documents_by_sid(user_sids, [engineering_document])
        assert len(result) == 1

    def test_multiple_document_sids(self, admin_user, engineering_document):
        """1.5: 複数ドキュメント SID のいずれかにマッチ"""
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [engineering_document])
        assert len(result) == 1

    def test_empty_user_sids(self, public_document):
        """1.6: 空ユーザー SID → 全拒否"""
        result = filter_documents_by_sid([], [public_document])
        assert len(result) == 0


# =============================================================================
# 2. グループネスティング
# =============================================================================


class TestGroupNesting:
    """ネストされたグループの SID 解決テスト"""

    def test_direct_group_member(self, engineering_user, engineering_document):
        """2.1: 直接グループメンバーのアクセス"""
        user_sids = get_all_user_sids(engineering_user)
        result = filter_documents_by_sid(user_sids, [engineering_document])
        assert len(result) == 1

    def test_nested_group_via_expanded_sids(self, multi_group_document):
        """2.2: ネストグループ（展開済み SID リスト）"""
        # Managers グループが Engineering の親グループの場合、
        # AD Sync で展開済みの SID リストに Engineering SID が含まれる
        nested_user_sids = [SID_MANAGERS, SID_ENGINEERING, SID_EVERYONE]
        result = filter_documents_by_sid(nested_user_sids, [multi_group_document])
        assert len(result) == 1

    def test_deep_nesting(self, engineering_document):
        """2.3: 深いネスト（A → B → C）— AD が全展開済み"""
        # AD Sync Lambda が全ネストを展開して groupSIDs に含める
        deep_nested_sids = [
            "S-1-5-21-0000000000-0000000000-0000000000-2000",  # Level C
            SID_MANAGERS,  # Level B
            SID_ENGINEERING,  # Level A (ドキュメントの SID)
            SID_EVERYONE,
        ]
        result = filter_documents_by_sid(deep_nested_sids, [engineering_document])
        assert len(result) == 1

    def test_no_match_without_expansion(self, engineering_document):
        """2.4: ネスト未展開の場合はマッチしない"""
        # Managers SID のみで Engineering ドキュメントにはアクセス不可
        # （AD Sync が Engineering SID を展開していない場合）
        unexpanded_sids = [SID_MANAGERS, SID_EVERYONE]
        result = filter_documents_by_sid(unexpanded_sids, [engineering_document])
        assert len(result) == 0


# =============================================================================
# 3. 継承権限
# =============================================================================


class TestInheritedPermissions:
    """フォルダ継承と明示権限の組み合わせテスト"""

    def test_inherited_from_parent(self):
        """3.1: 親フォルダの権限が子ファイルに継承"""
        # /confidential/ フォルダの ACL が子ファイルに継承
        child_doc = {
            "sourceUri": "s3://bucket/confidential/sub/nested-file.md",
            "metadata": {
                "allowed_group_sids": [SID_DOMAIN_ADMINS],  # 親から継承
            },
        }
        admin_sids = [SID_DOMAIN_ADMINS, SID_EVERYONE]
        result = filter_documents_by_sid(admin_sids, [child_doc])
        assert len(result) == 1

    def test_explicit_overrides_inherited(self):
        """3.2: 明示権限が継承を上書き"""
        # ファイルに明示的に Everyone を追加
        explicit_doc = {
            "sourceUri": "s3://bucket/confidential/public-exception.md",
            "metadata": {
                "allowed_group_sids": [SID_EVERYONE],  # 明示的に Everyone
            },
        }
        regular_sids = [SID_REGULAR_USER, SID_EVERYONE]
        result = filter_documents_by_sid(regular_sids, [explicit_doc])
        assert len(result) == 1

    def test_inheritance_blocked(self):
        """3.3: 継承無効化 — ファイル固有の SID のみ"""
        blocked_doc = {
            "sourceUri": "s3://bucket/confidential/isolated-file.md",
            "metadata": {
                "allowed_group_sids": [SID_ENGINEERING],  # 継承ブロック、独自 SID
            },
        }
        admin_sids = [SID_DOMAIN_ADMINS, SID_EVERYONE]
        result = filter_documents_by_sid(admin_sids, [blocked_doc])
        # Domain Admins は Engineering ではないのでアクセス不可
        assert len(result) == 0

    def test_moved_file_new_inheritance(self):
        """3.4: 移動後の継承変更（メタデータ再生成後）"""
        # /public/ → /confidential/ に移動後、メタデータが更新された場合
        moved_doc = {
            "sourceUri": "s3://bucket/confidential/moved-from-public.md",
            "metadata": {
                "allowed_group_sids": [SID_DOMAIN_ADMINS],  # 移動先の継承
            },
        }
        regular_sids = [SID_REGULAR_USER, SID_EVERYONE]
        result = filter_documents_by_sid(regular_sids, [moved_doc])
        assert len(result) == 0  # 移動後は一般ユーザーからアクセス不可


# =============================================================================
# 4. Fail-Closed
# =============================================================================


class TestFailClosed:
    """エラー時の安全側フォールバックテスト"""

    def test_dynamodb_error_simulation(self, all_documents):
        """4.1: DynamoDB 接続エラー → 全拒否"""
        # DynamoDB エラー時は user_sids が空リストとして扱われる
        result = filter_documents_by_sid([], all_documents)
        assert len(result) == 0

    def test_user_record_not_found(self, no_sid_user, all_documents):
        """4.2: ユーザーレコードなし → 全拒否"""
        user_sids = get_all_user_sids(no_sid_user)
        result = filter_documents_by_sid(user_sids, all_documents)
        assert len(result) == 0

    def test_no_metadata_document(self, admin_user, no_metadata_document):
        """4.3: メタデータなしドキュメント → 該当ドキュメント拒否"""
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [no_metadata_document])
        assert len(result) == 0

    def test_empty_allowed_group_sids(self, admin_user, empty_sids_document):
        """4.4: 空の allowed_group_sids → 該当ドキュメント拒否"""
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [empty_sids_document])
        assert len(result) == 0

    def test_invalid_sid_format(self, admin_user):
        """4.5: 不正な SID 形式 → マッチしないため拒否"""
        invalid_doc = {
            "sourceUri": "s3://bucket/broken/invalid-sid.md",
            "metadata": {
                "allowed_group_sids": ["invalid-sid-format"],
            },
        }
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [invalid_doc])
        assert len(result) == 0


# =============================================================================
# 5. 権限変更反映
# =============================================================================


class TestPermissionChangeReflection:
    """ACL 変更後の検索結果変化テスト"""

    def test_group_added(self, engineering_document):
        """5.1: グループ追加後 — 新グループの文書が表示"""
        # Before: Regular User (Everyone のみ)
        before_sids = [SID_REGULAR_USER, SID_EVERYONE]
        result_before = filter_documents_by_sid(before_sids, [engineering_document])
        assert len(result_before) == 0

        # After: Engineering グループに追加
        after_sids = [SID_REGULAR_USER, SID_ENGINEERING, SID_EVERYONE]
        result_after = filter_documents_by_sid(after_sids, [engineering_document])
        assert len(result_after) == 1

    def test_group_removed(self, engineering_document):
        """5.2: グループ削除後 — 旧グループの文書が非表示"""
        # Before: Engineering メンバー
        before_sids = [SID_REGULAR_USER, SID_ENGINEERING, SID_EVERYONE]
        result_before = filter_documents_by_sid(before_sids, [engineering_document])
        assert len(result_before) == 1

        # After: Engineering から削除
        after_sids = [SID_REGULAR_USER, SID_EVERYONE]
        result_after = filter_documents_by_sid(after_sids, [engineering_document])
        assert len(result_after) == 0

    def test_document_acl_changed(self, admin_user):
        """5.3: ドキュメント ACL 変更 — KB 再同期後に反映"""
        # Before: Everyone アクセス可
        doc_before = {
            "sourceUri": "s3://bucket/shared/report.md",
            "metadata": {"allowed_group_sids": [SID_EVERYONE]},
        }
        regular_sids = [SID_REGULAR_USER, SID_EVERYONE]
        result_before = filter_documents_by_sid(regular_sids, [doc_before])
        assert len(result_before) == 1

        # After: Domain Admins のみに変更（KB 再同期後）
        doc_after = {
            "sourceUri": "s3://bucket/shared/report.md",
            "metadata": {"allowed_group_sids": [SID_DOMAIN_ADMINS]},
        }
        result_after = filter_documents_by_sid(regular_sids, [doc_after])
        assert len(result_after) == 0

    def test_emergency_revocation(self, all_documents):
        """5.4: 緊急権限剥奪 — DynamoDB から SID 削除で即時全拒否"""
        # DynamoDB から SID データを削除 → 空リストとして扱われる
        revoked_sids: list[str] = []
        result = filter_documents_by_sid(revoked_sids, all_documents)
        assert len(result) == 0


# =============================================================================
# 6. エッジケース
# =============================================================================


class TestEdgeCases:
    """特殊ケースのテスト"""

    def test_unresolvable_sid(self, admin_user):
        """6.1: SID 解決不能 — マッチしないため DENY"""
        doc_with_unknown_sid = {
            "sourceUri": "s3://bucket/orphan/unknown-owner.md",
            "metadata": {
                "allowed_group_sids": [
                    "S-1-5-21-9999999999-9999999999-9999999999-9999"
                ],
            },
        }
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [doc_with_unknown_sid])
        assert len(result) == 0

    def test_large_sid_list(self, public_document):
        """6.2: 超長 SID リスト（100+ グループ所属）"""
        large_sids = [
            f"S-1-5-21-0000000000-0000000000-0000000000-{i}" for i in range(100)
        ]
        large_sids.append(SID_EVERYONE)
        result = filter_documents_by_sid(large_sids, [public_document])
        assert len(result) == 1

    def test_unicode_filename(self, admin_user):
        """6.3: Unicode ファイル名のドキュメント"""
        unicode_doc = {
            "sourceUri": "s3://bucket/公開/製品カタログ.md",
            "metadata": {
                "allowed_group_sids": [SID_EVERYONE],
            },
        }
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, [unicode_doc])
        assert len(result) == 1

    def test_concurrent_requests_consistency(
        self, admin_user, all_documents
    ):
        """6.4: 同時リクエスト — 一貫した結果"""
        user_sids = get_all_user_sids(admin_user)
        # 同じ入力で複数回実行しても同じ結果
        results = [
            filter_documents_by_sid(user_sids, all_documents) for _ in range(10)
        ]
        assert all(len(r) == len(results[0]) for r in results)
        assert all(
            set(d["sourceUri"] for d in r)
            == set(d["sourceUri"] for d in results[0])
            for r in results
        )

    def test_mixed_security_styles(self):
        """6.5: SMB と NFS の混在 — セキュリティスタイルに依存"""
        # NTFS スタイル: SID ベース
        ntfs_doc = {
            "sourceUri": "s3://bucket/ntfs/windows-file.docx",
            "metadata": {
                "allowed_group_sids": [SID_DOMAIN_ADMINS],
            },
        }
        # UNIX スタイル: UID/GID ベース（本テストでは SID に変換済みと仮定）
        unix_doc = {
            "sourceUri": "s3://bucket/unix/linux-file.txt",
            "metadata": {
                "allowed_group_sids": [SID_ENGINEERING],  # GID → SID マッピング済み
            },
        }
        engineering_sids = [SID_ENGINEERING, SID_EVERYONE]
        result = filter_documents_by_sid(engineering_sids, [ntfs_doc, unix_doc])
        # Engineering は UNIX ファイルのみアクセス可
        assert len(result) == 1
        assert result[0]["sourceUri"] == unix_doc["sourceUri"]


# =============================================================================
# 統合テスト: 全ドキュメントに対するフィルタリング
# =============================================================================


class TestIntegrationFiltering:
    """全ドキュメントに対する統合フィルタリングテスト"""

    def test_admin_sees_most_documents(self, admin_user, all_documents):
        """管理者は公開 + 機密 + エンジニアリングドキュメントにアクセス可能"""
        user_sids = get_all_user_sids(admin_user)
        result = filter_documents_by_sid(user_sids, all_documents)
        # public(Everyone) + confidential(DomainAdmins) + engineering(DomainAdmins)
        # + multi_group(Engineering/Finance/HR — Admin は含まれない)
        # no_metadata と empty_sids は Fail-Closed で除外
        allowed_uris = {d["sourceUri"] for d in result}
        assert "s3://bucket/public/product-catalog.md" in allowed_uris
        assert "s3://bucket/confidential/financial-report.md" in allowed_uris
        assert "s3://bucket/restricted/project-plan.md" in allowed_uris
        # メタデータなし・空 SID は除外
        assert "s3://bucket/unknown/orphan-file.md" not in allowed_uris
        assert "s3://bucket/broken/empty-sids.md" not in allowed_uris

    def test_regular_user_sees_only_public(self, regular_user, all_documents):
        """一般ユーザーは公開ドキュメントのみアクセス可能"""
        user_sids = get_all_user_sids(regular_user)
        result = filter_documents_by_sid(user_sids, all_documents)
        assert len(result) == 1
        assert result[0]["sourceUri"] == "s3://bucket/public/product-catalog.md"

    def test_engineering_user_sees_public_and_engineering(
        self, engineering_user, all_documents
    ):
        """エンジニアリングユーザーは公開 + エンジニアリング + マルチグループにアクセス可能"""
        user_sids = get_all_user_sids(engineering_user)
        result = filter_documents_by_sid(user_sids, all_documents)
        allowed_uris = {d["sourceUri"] for d in result}
        assert "s3://bucket/public/product-catalog.md" in allowed_uris
        assert "s3://bucket/restricted/project-plan.md" in allowed_uris
        assert "s3://bucket/shared/cross-team-report.md" in allowed_uris
        assert "s3://bucket/confidential/financial-report.md" not in allowed_uris
