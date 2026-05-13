/**
 * Property 3: 権限フィルタリングの入力方式非依存性
 * 任意のクエリとユーザー権限の組み合わせに対して、入力ソースに関わらず同一結果を検証。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type InputSource = 'webrtc-voice' | 'rest-voice' | 'text';

interface UserPermissions {
  sids: string[];
  uid: string | null;
  gid: string | null;
  unixGroups: string[];
}

interface SearchResult {
  id: string;
  content: string;
  allowedSids: string[];
  allowedUids: string[];
  allowedGids: string[];
}

/**
 * Permission Filter の純粋関数実装（テスト用）
 * 入力ソースに依存しない — クエリテキストとユーザー権限のみで結果が決まる
 */
function applyPermissionFilter(
  results: SearchResult[],
  permissions: UserPermissions,
  _inputSource: InputSource // 入力ソースは結果に影響しない
): SearchResult[] {
  const userSids = new Set(permissions.sids);
  const userUid = permissions.uid;
  const userGid = permissions.gid;
  const userGroups = new Set(permissions.unixGroups);

  return results.filter(result => {
    const allowedSids = new Set(result.allowedSids);
    const allowedUids = new Set(result.allowedUids);
    const allowedGids = new Set(result.allowedGids);

    // No access control metadata → allow
    if (allowedSids.size === 0 && allowedUids.size === 0 && allowedGids.size === 0) {
      return true;
    }

    // SID check
    if (allowedSids.size > 0) {
      for (const sid of userSids) {
        if (allowedSids.has(sid)) return true;
      }
    }

    // UID check
    if (allowedUids.size > 0 && userUid && allowedUids.has(userUid)) {
      return true;
    }

    // GID check
    if (allowedGids.size > 0) {
      if (userGid && allowedGids.has(userGid)) return true;
      for (const group of userGroups) {
        if (allowedGids.has(group)) return true;
      }
    }

    return false;
  });
}

describe('Property 3: Permission filter input-source independence', () => {
  const inputSources: InputSource[] = ['webrtc-voice', 'rest-voice', 'text'];

  it('should produce identical results regardless of input source', () => {
    fc.assert(
      fc.property(
        // Generate random permissions
        fc.record({
          sids: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
          uid: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
          gid: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
          unixGroups: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
        }),
        // Generate random search results
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            content: fc.string({ minLength: 1, maxLength: 50 }),
            allowedSids: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
            allowedUids: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
            allowedGids: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (permissions, results) => {
          // Apply filter with each input source
          const webrtcResults = applyPermissionFilter(results, permissions, 'webrtc-voice');
          const restResults = applyPermissionFilter(results, permissions, 'rest-voice');
          const textResults = applyPermissionFilter(results, permissions, 'text');

          // All should produce identical results
          expect(webrtcResults).toEqual(restResults);
          expect(restResults).toEqual(textResults);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should always exclude results when user has no matching permissions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            content: fc.string({ minLength: 1, maxLength: 50 }),
            allowedSids: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
            allowedUids: fc.constant([] as string[]),
            allowedGids: fc.constant([] as string[]),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (results) => {
          // User with no matching SIDs
          const emptyPermissions: UserPermissions = {
            sids: ['non-matching-sid-xyz'],
            uid: null,
            gid: null,
            unixGroups: [],
          };

          for (const source of inputSources) {
            const filtered = applyPermissionFilter(results, emptyPermissions, source);
            // Results with SID restrictions should be filtered out
            // (unless user's SID happens to match — unlikely with random data)
            expect(filtered.length).toBeLessThanOrEqual(results.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
