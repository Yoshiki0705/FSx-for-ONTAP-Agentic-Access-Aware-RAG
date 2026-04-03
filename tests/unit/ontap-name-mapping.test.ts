/**
 * ONTAP Name-Mapping テスト
 *
 * Tasks 7.1-7.3: Name-Mappingルール取得、resolveWindowsUser、Permission Resolver統合
 */

import {
  NameMappingRule,
  resolveWindowsUser,
} from '../../lambda/permissions/ontap-rest-api-client';
import {
  applyNameMapping,
  PermissionResolutionStrategy,
  UserAccessRecord,
} from '../../lambda/permissions/metadata-filter-handler';

// ========================================
// resolveWindowsUser テスト (Task 7.2)
// ========================================

describe('resolveWindowsUser', () => {
  it('UNIX→Windowsルールにマッチ → Windowsユーザー名を返す', () => {
    const rules: NameMappingRule[] = [
      { direction: 'unix-win', pattern: '(.+)', replacement: 'DOMAIN\\$1' },
    ];
    expect(resolveWindowsUser('john', rules)).toBe('DOMAIN\\john');
  });

  it('複数ルールで最初にマッチしたルールを適用', () => {
    const rules: NameMappingRule[] = [
      { direction: 'unix-win', pattern: 'admin', replacement: 'DOMAIN\\Administrator' },
      { direction: 'unix-win', pattern: '(.+)', replacement: 'DOMAIN\\$1' },
    ];
    expect(resolveWindowsUser('admin', rules)).toBe('DOMAIN\\Administrator');
    expect(resolveWindowsUser('john', rules)).toBe('DOMAIN\\john');
  });

  it('マッチするルールなし → null', () => {
    const rules: NameMappingRule[] = [
      { direction: 'unix-win', pattern: 'specific-user', replacement: 'DOMAIN\\mapped' },
    ];
    expect(resolveWindowsUser('other-user', rules)).toBeNull();
  });

  it('win-unixルールは無視される', () => {
    const rules: NameMappingRule[] = [
      { direction: 'win-unix', pattern: '(.+)', replacement: '$1' },
    ];
    expect(resolveWindowsUser('john', rules)).toBeNull();
  });

  it('空のルール配列 → null', () => {
    expect(resolveWindowsUser('john', [])).toBeNull();
  });

  it('不正な正規表現パターンはスキップ', () => {
    const rules: NameMappingRule[] = [
      { direction: 'unix-win', pattern: '[invalid', replacement: 'bad' },
      { direction: 'unix-win', pattern: '(.+)', replacement: 'DOMAIN\\$1' },
    ];
    // 不正パターンをスキップして次のルールにマッチ
    expect(resolveWindowsUser('john', rules)).toBe('DOMAIN\\john');
  });

  it('完全一致パターン（^...$）で部分マッチしない', () => {
    const rules: NameMappingRule[] = [
      { direction: 'unix-win', pattern: 'admin', replacement: 'DOMAIN\\admin' },
    ];
    // 'admin-user' は 'admin' に完全一致しないのでnull
    expect(resolveWindowsUser('admin-user', rules)).toBeNull();
  });

  it('unix-winとwin-unixが混在するルール配列', () => {
    const rules: NameMappingRule[] = [
      { direction: 'win-unix', pattern: 'DOMAIN\\\\(.+)', replacement: '$1' },
      { direction: 'unix-win', pattern: 'john', replacement: 'DOMAIN\\john.doe' },
      { direction: 'unix-win', pattern: '(.+)', replacement: 'DOMAIN\\$1' },
    ];
    expect(resolveWindowsUser('john', rules)).toBe('DOMAIN\\john.doe');
  });
});

// ========================================
// applyNameMapping テスト (Task 7.3)
// ========================================

describe('applyNameMapping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('ONTAP_NAME_MAPPING_ENABLED=false → 戦略変更なし', async () => {
    process.env.ONTAP_NAME_MAPPING_ENABLED = 'false';
    const strategy: PermissionResolutionStrategy = {
      type: 'uid-gid',
      uid: 1001,
      gid: 1001,
    };
    const record: UserAccessRecord = {
      userId: 'john',
      userSID: '',
      groupSIDs: [],
      uid: 1001,
      gid: 1001,
    };
    const result = await applyNameMapping(strategy, record);
    expect(result).toEqual(strategy);
  });

  it('SVM_UUIDが空 → 戦略変更なし', async () => {
    process.env.ONTAP_NAME_MAPPING_ENABLED = 'true';
    process.env.SVM_UUID = '';
    const strategy: PermissionResolutionStrategy = {
      type: 'uid-gid',
      uid: 1001,
      gid: 1001,
    };
    const record: UserAccessRecord = {
      userId: 'john',
      userSID: '',
      groupSIDs: [],
      uid: 1001,
      gid: 1001,
    };
    const result = await applyNameMapping(strategy, record);
    expect(result).toEqual(strategy);
  });

  it('SID戦略 → name-mapping不要、戦略変更なし', async () => {
    process.env.ONTAP_NAME_MAPPING_ENABLED = 'true';
    process.env.SVM_UUID = 'test-svm-uuid';
    const strategy: PermissionResolutionStrategy = {
      type: 'sid',
      userSIDs: ['S-1-5-21-123-500'],
    };
    const record: UserAccessRecord = {
      userId: 'john',
      userSID: 'S-1-5-21-123-500',
      groupSIDs: [],
    };
    const result = await applyNameMapping(strategy, record);
    expect(result).toEqual(strategy);
  });

  it('ONTAP API接続失敗 → name-mappingなしで継続', async () => {
    process.env.ONTAP_NAME_MAPPING_ENABLED = 'true';
    process.env.SVM_UUID = 'test-svm-uuid';
    // FSX_MANAGEMENT_ENDPOINT未設定でConfigurationErrorが発生する
    delete process.env.FSX_MANAGEMENT_ENDPOINT;

    const strategy: PermissionResolutionStrategy = {
      type: 'uid-gid',
      uid: 1001,
      gid: 1001,
    };
    const record: UserAccessRecord = {
      userId: 'john',
      userSID: '',
      groupSIDs: [],
      uid: 1001,
      gid: 1001,
    };

    // resetOntapClient to ensure fresh instance
    const { resetOntapClient } = require('../../lambda/permissions/ontap-rest-api-client');
    resetOntapClient();

    const result = await applyNameMapping(strategy, record);
    // エラー時は元の戦略を返す
    expect(result.type).toBe('uid-gid');
    expect(result.uid).toBe(1001);
  });
});
