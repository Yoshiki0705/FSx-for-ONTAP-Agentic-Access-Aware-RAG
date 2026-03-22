/**
 * Permission Service プロパティテスト
 * 
 * Property 2: SID/ACL権限照合の正確性 (要件 3.1)
 * Property 3: Permission-awareフィルタリングの完全性 (要件 3.2, 3.4, 3.5)
 * Property 5: 異なる権限レベルのユーザーで検索結果が異なる (要件 6.5)
 */

import * as fc from 'fast-check';
import { calculateEffectivePermissions, buildDirectoryPermission } from '../../../lambda/permissions/permission-calculator';
import { OntapAclRecord, CalculatedPermissions } from '../../../lambda/permissions/types';

// ========================================
// Arbitrary定義
// ========================================

/** SID形式の文字列を生成 */
const sidArb = fc.tuple(
  fc.integer({ min: 1000, max: 9999 }),
  fc.integer({ min: 1000, max: 9999 }),
  fc.integer({ min: 1000, max: 9999 }),
  fc.integer({ min: 1000, max: 9999 }),
).map(([a, b, c, d]) => `S-1-5-21-${a}-${b}-${c}-${d}`);

/** 権限レベルを生成 */
const permissionLevelArb = fc.constantFrom<OntapAclRecord['permission']>(
  'full_control', 'change', 'read', 'no_access',
);

/** ACLレコードを生成 */
const aclRecordArb = fc.tuple(sidArb, permissionLevelArb).map(
  ([sid, permission]): OntapAclRecord => ({
    user_or_group: sid,
    permission,
    type: 'allow',
  }),
);

/** ACLレコード配列を生成（1〜10件） */
const aclRecordsArb = fc.array(aclRecordArb, { minLength: 1, maxLength: 10 });

/** SID配列を生成（1〜5件） */
const userSIDsArb = fc.array(sidArb, { minLength: 1, maxLength: 5 });

// ========================================
// Property 2: SID/ACL権限照合の正確性
// ========================================

describe('Property 2: SID/ACL権限照合の正確性', () => {
  it('マッチするSIDがない場合、全権限がfalse', () => {
    fc.assert(
      fc.property(userSIDsArb, aclRecordsArb, (userSIDs, aclRecords) => {
        // userSIDsとaclRecordsのSIDが重複しないようにする
        const disjointAcls = aclRecords.map(acl => ({
          ...acl,
          user_or_group: acl.user_or_group + '-other',
        }));

        const result = calculateEffectivePermissions(userSIDs, disjointAcls);
        expect(result.read).toBe(false);
        expect(result.write).toBe(false);
        expect(result.admin).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('full_controlのACLにマッチすると全権限がtrue', () => {
    fc.assert(
      fc.property(sidArb, (sid) => {
        const acls: OntapAclRecord[] = [
          { user_or_group: sid, permission: 'full_control', type: 'allow' },
        ];
        const result = calculateEffectivePermissions([sid], acls);
        expect(result.read).toBe(true);
        expect(result.write).toBe(true);
        expect(result.admin).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('readのACLにマッチするとreadのみtrue', () => {
    fc.assert(
      fc.property(sidArb, (sid) => {
        const acls: OntapAclRecord[] = [
          { user_or_group: sid, permission: 'read', type: 'allow' },
        ];
        const result = calculateEffectivePermissions([sid], acls);
        expect(result.read).toBe(true);
        expect(result.write).toBe(false);
        expect(result.admin).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('changeのACLにマッチするとread+writeがtrue、adminはfalse', () => {
    fc.assert(
      fc.property(sidArb, (sid) => {
        const acls: OntapAclRecord[] = [
          { user_or_group: sid, permission: 'change', type: 'allow' },
        ];
        const result = calculateEffectivePermissions([sid], acls);
        expect(result.read).toBe(true);
        expect(result.write).toBe(true);
        expect(result.admin).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('no_accessのACLにマッチすると全権限がfalse', () => {
    fc.assert(
      fc.property(sidArb, (sid) => {
        const acls: OntapAclRecord[] = [
          { user_or_group: sid, permission: 'no_access', type: 'allow' },
        ];
        const result = calculateEffectivePermissions([sid], acls);
        expect(result.read).toBe(false);
        expect(result.write).toBe(false);
        expect(result.admin).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('複数ACLマッチ時は最も強い権限が採用される', () => {
    fc.assert(
      fc.property(sidArb, sidArb, (userSid, groupSid) => {
        // userSidにread、groupSidにfull_controlを付与
        const acls: OntapAclRecord[] = [
          { user_or_group: userSid, permission: 'read', type: 'allow' },
          { user_or_group: groupSid, permission: 'full_control', type: 'allow' },
        ];
        const result = calculateEffectivePermissions([userSid, groupSid], acls);
        // full_controlが最も強いので全権限true
        expect(result.read).toBe(true);
        expect(result.write).toBe(true);
        expect(result.admin).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

// ========================================
// Property 3: Permission-awareフィルタリングの完全性
// ========================================

describe('Property 3: Permission-awareフィルタリングの完全性', () => {
  it('権限計算結果のread/write/adminは常にboolean', () => {
    fc.assert(
      fc.property(userSIDsArb, aclRecordsArb, (userSIDs, aclRecords) => {
        const result = calculateEffectivePermissions(userSIDs, aclRecords);
        expect(typeof result.read).toBe('boolean');
        expect(typeof result.write).toBe('boolean');
        expect(typeof result.admin).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });

  it('writeがtrueならreadも必ずtrue（権限の包含関係）', () => {
    fc.assert(
      fc.property(userSIDsArb, aclRecordsArb, (userSIDs, aclRecords) => {
        const result = calculateEffectivePermissions(userSIDs, aclRecords);
        if (result.write) {
          expect(result.read).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('adminがtrueならread+writeも必ずtrue（権限の包含関係）', () => {
    fc.assert(
      fc.property(userSIDsArb, aclRecordsArb, (userSIDs, aclRecords) => {
        const result = calculateEffectivePermissions(userSIDs, aclRecords);
        if (result.admin) {
          expect(result.read).toBe(true);
          expect(result.write).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('空のACLリストでは全権限がfalse', () => {
    fc.assert(
      fc.property(userSIDsArb, (userSIDs) => {
        const result = calculateEffectivePermissions(userSIDs, []);
        expect(result.read).toBe(false);
        expect(result.write).toBe(false);
        expect(result.admin).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('buildDirectoryPermissionがread権限を正しく変換する', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (path) => {
          const perms: CalculatedPermissions = { read: true, write: false, admin: false };
          const dir = buildDirectoryPermission(path, perms);
          expect(dir.path).toBe(path);
          expect(dir.permissions).toContain('read');
          expect(dir.permissions).not.toContain('write');
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ========================================
// Property 5: 異なる権限レベルのユーザーで検索結果が異なる
// ========================================

describe('Property 5: 異なる権限レベルのユーザーで検索結果が異なる', () => {
  it('admin SIDを持つユーザーはfull_control ACLのドキュメントにアクセスできる', () => {
    fc.assert(
      fc.property(sidArb, sidArb, (adminSid, restrictedSid) => {
        const acls: OntapAclRecord[] = [
          { user_or_group: adminSid, permission: 'full_control', type: 'allow' },
        ];

        const adminResult = calculateEffectivePermissions([adminSid], acls);
        const restrictedResult = calculateEffectivePermissions([restrictedSid], acls);

        // adminはアクセス可能
        expect(adminResult.read).toBe(true);
        // restrictedはSIDが異なるためアクセス不可
        expect(restrictedResult.read).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('グループSIDを共有するユーザーは同じ権限を持つ', () => {
    fc.assert(
      fc.property(sidArb, sidArb, sidArb, permissionLevelArb, (user1Sid, user2Sid, groupSid, perm) => {
        const acls: OntapAclRecord[] = [
          { user_or_group: groupSid, permission: perm, type: 'allow' },
        ];

        // 両ユーザーが同じグループSIDを持つ
        const result1 = calculateEffectivePermissions([user1Sid, groupSid], acls);
        const result2 = calculateEffectivePermissions([user2Sid, groupSid], acls);

        expect(result1.read).toBe(result2.read);
        expect(result1.write).toBe(result2.write);
        expect(result1.admin).toBe(result2.admin);
      }),
      { numRuns: 50 },
    );
  });
});
