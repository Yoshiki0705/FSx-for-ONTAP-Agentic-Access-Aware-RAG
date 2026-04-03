/**
 * Permission Resolver テスト
 *
 * Tasks 6.1-6.4: UID/GIDフィルタリング、戦略選択、ドキュメントマッチング、ハンドラー統合
 */

import {
  UserAccessRecord,
  PermissionResolutionStrategy,
  resolvePermissionStrategy,
  checkUidGidAccess,
  extractDocumentUidGidPermissions,
} from '../../lambda/permissions/metadata-filter-handler';

// ========================================
// resolvePermissionStrategy テスト (Task 6.2)
// ========================================

describe('resolvePermissionStrategy', () => {
  it('SIDのみ → sid戦略', () => {
    const record: UserAccessRecord = {
      userId: 'user1',
      userSID: 'S-1-5-21-123-500',
      groupSIDs: ['S-1-5-21-123-512'],
    };
    const strategy = resolvePermissionStrategy(record);
    expect(strategy.type).toBe('sid');
    expect(strategy.userSIDs).toEqual(['S-1-5-21-123-500', 'S-1-5-21-123-512']);
    expect(strategy.uid).toBeUndefined();
    expect(strategy.gid).toBeUndefined();
  });

  it('UID/GIDのみ → uid-gid戦略', () => {
    const record: UserAccessRecord = {
      userId: 'user2',
      userSID: '',
      groupSIDs: [],
      uid: 1001,
      gid: 1001,
      unixGroups: [{ name: 'developers', gid: 1001 }],
    };
    const strategy = resolvePermissionStrategy(record);
    expect(strategy.type).toBe('uid-gid');
    expect(strategy.uid).toBe(1001);
    expect(strategy.gid).toBe(1001);
    expect(strategy.unixGroups).toEqual([{ name: 'developers', gid: 1001 }]);
    expect(strategy.userSIDs).toBeUndefined();
  });

  it('SID + UID/GID → hybrid戦略', () => {
    const record: UserAccessRecord = {
      userId: 'user3',
      userSID: 'S-1-5-21-123-500',
      groupSIDs: ['S-1-5-21-123-512'],
      uid: 1001,
      gid: 1001,
      unixGroups: [{ name: 'developers', gid: 1001 }],
    };
    const strategy = resolvePermissionStrategy(record);
    expect(strategy.type).toBe('hybrid');
    expect(strategy.userSIDs).toEqual(['S-1-5-21-123-500', 'S-1-5-21-123-512']);
    expect(strategy.uid).toBe(1001);
    expect(strategy.gid).toBe(1001);
  });

  it('権限情報なし → エラー (Fail-Closed)', () => {
    const record: UserAccessRecord = {
      userId: 'user4',
      userSID: '',
      groupSIDs: [],
    };
    expect(() => resolvePermissionStrategy(record)).toThrow('No permission data available');
  });

  it('userSIDが空文字でgroupSIDsが空 + UID/GIDなし → エラー', () => {
    const record: UserAccessRecord = {
      userId: 'user5',
      userSID: '',
      groupSIDs: [],
      uid: undefined,
      gid: undefined,
    };
    expect(() => resolvePermissionStrategy(record)).toThrow('No permission data available');
  });

  it('groupSIDsがundefined → SID戦略でuserSIDのみ', () => {
    const record: UserAccessRecord = {
      userId: 'user6',
      userSID: 'S-1-5-21-123-500',
      groupSIDs: undefined as unknown as string[],
    };
    const strategy = resolvePermissionStrategy(record);
    expect(strategy.type).toBe('sid');
    expect(strategy.userSIDs).toEqual(['S-1-5-21-123-500']);
  });
});

// ========================================
// checkUidGidAccess テスト (Task 6.3)
// ========================================

describe('checkUidGidAccess', () => {
  it('UIDがallowed_uidsに含まれる → true', () => {
    expect(checkUidGidAccess(1001, 1001, [], [1001, 1002], [])).toBe(true);
  });

  it('UIDがallowed_uidsに含まれない → GIDチェックへ', () => {
    expect(checkUidGidAccess(1003, 1001, [], [1001, 1002], [])).toBe(false);
  });

  it('プライマリGIDがallowed_gidsに含まれる → true', () => {
    expect(checkUidGidAccess(9999, 1001, [], [], [1001, 999])).toBe(true);
  });

  it('unixGroupsのGIDがallowed_gidsに含まれる → true', () => {
    const groups = [{ name: 'docker', gid: 999 }, { name: 'developers', gid: 1001 }];
    expect(checkUidGidAccess(9999, 9999, groups, [], [1001])).toBe(true);
  });

  it('UID/GIDいずれもマッチしない → false', () => {
    const groups = [{ name: 'docker', gid: 999 }];
    expect(checkUidGidAccess(1003, 1003, groups, [1001], [1001])).toBe(false);
  });

  it('allowed_uids/allowed_gidsが空 → false', () => {
    expect(checkUidGidAccess(1001, 1001, [], [], [])).toBe(false);
  });

  it('unixGroupsがundefined → GIDのみチェック', () => {
    expect(checkUidGidAccess(9999, 1001, undefined, [], [1001])).toBe(true);
  });
});

// ========================================
// extractDocumentUidGidPermissions テスト (Task 6.1)
// ========================================

describe('extractDocumentUidGidPermissions', () => {
  it('トップレベルのallowed_uids/allowed_gidsを抽出', () => {
    const metadata = {
      allowed_uids: [1001, 1002],
      allowed_gids: [1001, 999],
      allowed_oidc_groups: ['developers', 'project-alpha'],
    };
    const result = extractDocumentUidGidPermissions(metadata);
    expect(result.allowedUids).toEqual([1001, 1002]);
    expect(result.allowedGids).toEqual([1001, 999]);
    expect(result.allowedOidcGroups).toEqual(['developers', 'project-alpha']);
  });

  it('metadataAttributes内のフィールドを抽出', () => {
    const metadata = {
      metadataAttributes: {
        allowed_uids: [1001],
        allowed_gids: [999],
        allowed_oidc_groups: ['admin'],
      },
    };
    const result = extractDocumentUidGidPermissions(metadata);
    expect(result.allowedUids).toEqual([1001]);
    expect(result.allowedGids).toEqual([999]);
    expect(result.allowedOidcGroups).toEqual(['admin']);
  });

  it('JSON文字列をパース', () => {
    const metadata = {
      allowed_uids: '[1001, 1002]',
      allowed_gids: '[999]',
      allowed_oidc_groups: '["dev", "ops"]',
    };
    const result = extractDocumentUidGidPermissions(metadata);
    expect(result.allowedUids).toEqual([1001, 1002]);
    expect(result.allowedGids).toEqual([999]);
    expect(result.allowedOidcGroups).toEqual(['dev', 'ops']);
  });

  it('フィールドが存在しない → 空配列', () => {
    const metadata = { allowed_group_sids: ['S-1-1-0'] };
    const result = extractDocumentUidGidPermissions(metadata);
    expect(result.allowedUids).toEqual([]);
    expect(result.allowedGids).toEqual([]);
    expect(result.allowedOidcGroups).toEqual([]);
  });

  it('不正なJSON文字列 → 空配列', () => {
    const metadata = {
      allowed_uids: 'not-json',
      allowed_gids: '{invalid}',
    };
    const result = extractDocumentUidGidPermissions(metadata);
    expect(result.allowedUids).toEqual([]);
    expect(result.allowedGids).toEqual([]);
  });
});
