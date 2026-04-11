/**
 * Property tests for KB Metadata Filter Construction
 * Feature: multi-agent-collaboration, Property 4: KB Metadata Filter Construction
 *
 * Validates: Requirements 3.3, 3.4
 *
 * Verifies that for any valid filter condition set (SIDs, UIDs/GIDs, OIDC groups),
 * the constructed filter includes all provided criteria:
 * 1. When accessDenied=true → filter is null
 * 2. When all fields empty → filter is null
 * 3. When SIDs present → filter contains SID conditions
 * 4. When UID/GID present → filter contains UID/GID conditions
 * 5. When groups present → filter contains group conditions
 * 6. Total condition count = sum of non-empty SIDs + groupSIDs + (uid ? 1 : 0) + (gid ? 1 : 0) + non-empty groups
 */

import * as fc from 'fast-check';
import { buildKbMetadataFilter } from '@/utils/multi-agent/kb-filter-builder';
import type { FilteredContext } from '@/utils/multi-agent/permission-resolver';

// ===== Generators =====

/** Generates realistic Windows SID strings (non-empty, trimmed) */
const sidArb = fc
  .tuple(
    fc.integer({ min: 1, max: 5 }),
    fc.integer({ min: 1, max: 99 }),
    fc.array(fc.integer({ min: 1000, max: 999999999 }), { minLength: 1, maxLength: 4 }),
  )
  .map(([rev, auth, subs]) => `S-1-${rev}-${auth}-${subs.join('-')}`);

/** Generates a non-empty SID array */
const nonEmptySidsArb = fc.array(sidArb, { minLength: 1, maxLength: 5 });

/** Generates a non-empty group SID array */
const nonEmptyGroupSidsArb = fc.array(sidArb, { minLength: 1, maxLength: 5 });

/** Generates a non-empty UID string */
const nonEmptyUidArb = fc.integer({ min: 1, max: 65535 }).map(String);

/** Generates a non-empty GID string */
const nonEmptyGidArb = fc.integer({ min: 1, max: 65535 }).map(String);

/** Generates a non-empty UNIX group name */
const groupNameArb = fc.stringMatching(/^[a-z][a-z0-9_-]{1,15}$/);

/** Generates a non-empty UNIX groups array */
const nonEmptyGroupsArb = fc.array(groupNameArb, { minLength: 1, maxLength: 5 });

/** Generates a FilteredContext with accessDenied=true */
const accessDeniedContextArb: fc.Arbitrary<FilteredContext> = fc.record({
  sids: fc.array(sidArb, { minLength: 0, maxLength: 3 }),
  groupSids: fc.array(sidArb, { minLength: 0, maxLength: 3 }),
  uid: fc.oneof(fc.constant(''), nonEmptyUidArb),
  gid: fc.oneof(fc.constant(''), nonEmptyGidArb),
  unixGroups: fc.array(groupNameArb, { minLength: 0, maxLength: 3 }),
  accessDenied: fc.constant(true),
  accessDeniedReason: fc.option(fc.string(), { nil: undefined }),
});

/** Generates a FilteredContext with all fields empty and accessDenied=false */
const allEmptyContextArb: fc.Arbitrary<FilteredContext> = fc.constant({
  sids: [],
  groupSids: [],
  uid: '',
  gid: '',
  unixGroups: [],
  accessDenied: false,
});

/** Generates a FilteredContext with at least some non-empty fields */
const arbitraryFilteredContextArb: fc.Arbitrary<FilteredContext> = fc.record({
  sids: fc.array(fc.oneof(sidArb, fc.constant(''), fc.constant('  ')), { minLength: 0, maxLength: 5 }),
  groupSids: fc.array(fc.oneof(sidArb, fc.constant(''), fc.constant('  ')), { minLength: 0, maxLength: 5 }),
  uid: fc.oneof(fc.constant(''), fc.constant('  '), nonEmptyUidArb),
  gid: fc.oneof(fc.constant(''), fc.constant('  '), nonEmptyGidArb),
  unixGroups: fc.array(fc.oneof(groupNameArb, fc.constant(''), fc.constant('  ')), { minLength: 0, maxLength: 5 }),
  accessDenied: fc.constant(false),
});

// ===== Helpers =====

/** Counts the expected number of OR conditions from a FilteredContext */
function countExpectedConditions(ctx: FilteredContext): number {
  const nonEmptySids = ctx.sids.filter((s) => s.trim() !== '').length;
  const nonEmptyGroupSids = ctx.groupSids.filter((s) => s.trim() !== '').length;
  const hasUid = ctx.uid && ctx.uid.trim() !== '' ? 1 : 0;
  const hasGid = ctx.gid && ctx.gid.trim() !== '' ? 1 : 0;
  const nonEmptyGroups = ctx.unixGroups.filter((g) => g.trim() !== '').length;
  return nonEmptySids + nonEmptyGroupSids + hasUid + hasGid + nonEmptyGroups;
}

// ===== Property 4: KB Metadata Filter Construction =====

describe('Feature: multi-agent-collaboration, Property 4: KB Metadata Filter Construction', () => {

  // --- Property: accessDenied=true → filter is null ---

  describe('accessDenied=true produces null filter', () => {
    it('returns null when accessDenied is true regardless of other fields (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(accessDeniedContextArb, (ctx) => {
          const filter = buildKbMetadataFilter(ctx);
          expect(filter).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: all fields empty → filter is null ---

  describe('all empty fields produce null filter', () => {
    it('returns null when all permission fields are empty (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(allEmptyContextArb, (ctx) => {
          const filter = buildKbMetadataFilter(ctx);
          expect(filter).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: SIDs present → filter contains SID conditions ---

  describe('SIDs present produces SID conditions in filter', () => {
    it('includes listContains conditions for each non-empty SID (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(nonEmptySidsArb, (sids) => {
          const ctx: FilteredContext = {
            sids,
            groupSids: [],
            uid: '',
            gid: '',
            unixGroups: [],
            accessDenied: false,
          };
          const filter = buildKbMetadataFilter(ctx);

          expect(filter).not.toBeNull();
          expect(filter!.orAll).toBeDefined();

          // Each SID should produce a listContains condition with key 'allowedSids'
          for (const sid of sids) {
            const found = filter!.orAll!.some(
              (c) => c.listContains?.key === 'allowedSids' && c.listContains?.value === sid,
            );
            expect(found).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: UID/GID present → filter contains UID/GID conditions ---

  describe('UID/GID present produces UID/GID conditions in filter', () => {
    it('includes equals condition for UID when present (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(nonEmptyUidArb, (uid) => {
          const ctx: FilteredContext = {
            sids: [],
            groupSids: [],
            uid,
            gid: '',
            unixGroups: [],
            accessDenied: false,
          };
          const filter = buildKbMetadataFilter(ctx);

          expect(filter).not.toBeNull();
          expect(filter!.orAll).toBeDefined();

          const uidCondition = filter!.orAll!.find(
            (c) => c.equals?.key === 'allowedUid',
          );
          expect(uidCondition).toBeDefined();
          expect(uidCondition!.equals!.value).toBe(uid);
        }),
        { numRuns: 100 },
      );
    });

    it('includes equals condition for GID when present (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(nonEmptyGidArb, (gid) => {
          const ctx: FilteredContext = {
            sids: [],
            groupSids: [],
            uid: '',
            gid,
            unixGroups: [],
            accessDenied: false,
          };
          const filter = buildKbMetadataFilter(ctx);

          expect(filter).not.toBeNull();
          expect(filter!.orAll).toBeDefined();

          const gidCondition = filter!.orAll!.find(
            (c) => c.equals?.key === 'allowedGid',
          );
          expect(gidCondition).toBeDefined();
          expect(gidCondition!.equals!.value).toBe(gid);
        }),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: groups present → filter contains group conditions ---

  describe('UNIX groups present produces group conditions in filter', () => {
    it('includes listContains conditions for each non-empty group (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(nonEmptyGroupsArb, (groups) => {
          const ctx: FilteredContext = {
            sids: [],
            groupSids: [],
            uid: '',
            gid: '',
            unixGroups: groups,
            accessDenied: false,
          };
          const filter = buildKbMetadataFilter(ctx);

          expect(filter).not.toBeNull();
          expect(filter!.orAll).toBeDefined();

          for (const group of groups) {
            const found = filter!.orAll!.some(
              (c) => c.listContains?.key === 'allowedGroups' && c.listContains?.value === group,
            );
            expect(found).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: total condition count matches expected ---

  describe('total condition count equals sum of all non-empty fields', () => {
    it('orAll length = non-empty SIDs + groupSIDs + (uid?1:0) + (gid?1:0) + non-empty groups (Validates: Requirements 3.3, 3.4)', () => {
      fc.assert(
        fc.property(arbitraryFilteredContextArb, (ctx) => {
          const filter = buildKbMetadataFilter(ctx);
          const expectedCount = countExpectedConditions(ctx);

          if (expectedCount === 0) {
            expect(filter).toBeNull();
          } else {
            expect(filter).not.toBeNull();
            expect(filter!.orAll).toBeDefined();
            expect(filter!.orAll!.length).toBe(expectedCount);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
