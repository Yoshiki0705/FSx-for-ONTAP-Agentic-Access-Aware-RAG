// Feature: oidc-ldap-permission-mapping, Property 12: Permission Resolver戦略選択
// Feature: oidc-ldap-permission-mapping, Property 13: UID/GIDドキュメントマッチング
/**
 * Property 12: Permission Resolver戦略選択
 * For any UserAccessRecord, correct strategy selection (sid/uid-gid/hybrid/deny).
 * **Validates: Requirements 6.2, 6.3, 6.4**
 *
 * Property 13: UID/GIDドキュメントマッチング
 * For any UID/GID + document metadata, correct access decision.
 * **Validates: Requirements 6.1**
 */

import * as fc from 'fast-check';
import {
  resolvePermissionStrategy,
  checkUidGidAccess,
  UserAccessRecord,
} from '../../lambda/permissions/metadata-filter-handler';

// ========================================
// Generators
// ========================================

const sidArb = fc.stringMatching(/^S-1-5-21-\d{1,10}-\d{1,10}-\d{1,10}-\d{1,5}$/);
const uidArb = fc.integer({ min: 1000, max: 65534 });
const gidArb = fc.integer({ min: 1000, max: 65534 });

const unixGroupArb = fc.record({
  name: fc.stringMatching(/^[a-z][a-z0-9_-]{1,15}$/),
  gid: gidArb,
});

describe('Property 12: Permission Resolver戦略選択', () => {
  it('SID-only record → sid strategy', async () => {
    await fc.assert(
      fc.property(
        sidArb,
        fc.array(sidArb, { minLength: 0, maxLength: 5 }),
        (userSID: string, groupSIDs: string[]) => {
          const record: UserAccessRecord = {
            userId: 'user1',
            userSID,
            groupSIDs,
            // no uid/gid
          };
          const strategy = resolvePermissionStrategy(record);
          expect(strategy.type).toBe('sid');
          expect(strategy.userSIDs).toContain(userSID);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('UID/GID-only record → uid-gid strategy', async () => {
    await fc.assert(
      fc.property(
        uidArb,
        gidArb,
        fc.array(unixGroupArb, { minLength: 0, maxLength: 3 }),
        (uid: number, gid: number, unixGroups) => {
          const record: UserAccessRecord = {
            userId: 'user1',
            userSID: '',  // empty = no SID
            groupSIDs: [],
            uid,
            gid,
            unixGroups,
          };
          const strategy = resolvePermissionStrategy(record);
          expect(strategy.type).toBe('uid-gid');
          expect(strategy.uid).toBe(uid);
          expect(strategy.gid).toBe(gid);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('both SID and UID/GID → hybrid strategy', async () => {
    await fc.assert(
      fc.property(
        sidArb,
        fc.array(sidArb, { minLength: 0, maxLength: 3 }),
        uidArb,
        gidArb,
        (userSID: string, groupSIDs: string[], uid: number, gid: number) => {
          const record: UserAccessRecord = {
            userId: 'user1',
            userSID,
            groupSIDs,
            uid,
            gid,
          };
          const strategy = resolvePermissionStrategy(record);
          expect(strategy.type).toBe('hybrid');
          expect(strategy.userSIDs).toContain(userSID);
          expect(strategy.uid).toBe(uid);
          expect(strategy.gid).toBe(gid);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('no SID and no UID/GID → throws error (deny)', async () => {
    await fc.assert(
      fc.property(fc.constant(null), () => {
        const record: UserAccessRecord = {
          userId: 'user1',
          userSID: '',
          groupSIDs: [],
          // no uid, no gid
        };
        expect(() => resolvePermissionStrategy(record)).toThrow('No permission data available');
      }),
      { numRuns: 20 }
    );
  });
});

describe('Property 13: UID/GIDドキュメントマッチング', () => {
  it('user UID in allowed_uids → access granted', async () => {
    await fc.assert(
      fc.property(
        uidArb,
        gidArb,
        fc.array(uidArb, { minLength: 0, maxLength: 5 }),
        (uid: number, gid: number, otherUids: number[]) => {
          const allowedUids = [...otherUids, uid]; // include user's uid
          const result = checkUidGidAccess(uid, gid, undefined, allowedUids, []);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('user primary GID in allowed_gids → access granted', async () => {
    await fc.assert(
      fc.property(
        uidArb,
        gidArb,
        fc.array(gidArb, { minLength: 0, maxLength: 5 }),
        (uid: number, gid: number, otherGids: number[]) => {
          const allowedGids = [...otherGids, gid]; // include user's gid
          const result = checkUidGidAccess(uid, gid, undefined, [], allowedGids);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('unix group GID in allowed_gids → access granted', async () => {
    await fc.assert(
      fc.property(
        uidArb,
        gidArb,
        unixGroupArb,
        (uid: number, gid: number, group) => {
          // Primary gid is different, but group gid matches
          const differentGid = gid === 65534 ? gid - 1 : gid + 1;
          const result = checkUidGidAccess(uid, differentGid, [group], [], [group.gid]);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('no matching UID or GID → access denied', async () => {
    await fc.assert(
      fc.property(
        uidArb,
        gidArb,
        (uid: number, gid: number) => {
          // Use UIDs/GIDs that definitely don't match
          const nonMatchingUids = [uid + 10000];
          const nonMatchingGids = [gid + 10000];
          const result = checkUidGidAccess(uid, gid, undefined, nonMatchingUids, nonMatchingGids);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('empty allowed lists → access denied', async () => {
    await fc.assert(
      fc.property(uidArb, gidArb, (uid: number, gid: number) => {
        const result = checkUidGidAccess(uid, gid, undefined, [], []);
        expect(result).toBe(false);
      }),
      { numRuns: 20 }
    );
  });
});
