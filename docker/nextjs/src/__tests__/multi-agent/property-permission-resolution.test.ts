/**
 * Property tests for Permission Resolution
 * Feature: multi-agent-collaboration, Property 1: Permission Resolution produces valid Filtered Context
 *
 * Validates: Requirements 2.3, 2.5, 2.6
 *
 * Verifies that:
 * - For any valid userId and User Access Table state, resolvePermissions returns a FilteredContext with all required fields
 * - Array fields (sids, groupSids, unixGroups) are always arrays
 * - When user has no entry (null), accessDenied=true with empty permission arrays
 * - When user has an entry, accessDenied=false
 * - When lookup throws an error, accessDenied=true (Fail-Closed)
 */

import * as fc from 'fast-check';
import {
  resolvePermissions,
  type FilteredContext,
  type UserAccessEntry,
  type UserAccessLookup,
} from '@/utils/multi-agent/permission-resolver';

// ===== Generators =====

/** Generates arbitrary non-empty userId strings */
const userIdArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

/** Generates arbitrary UserAccessEntry objects with optional fields */
const userAccessEntryArb = fc.record({
  userId: userIdArb,
  sids: fc.option(fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 10 }), { nil: undefined }),
  groupSids: fc.option(fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 10 }), { nil: undefined }),
  uid: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: undefined }),
  gid: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: undefined }),
  unixGroups: fc.option(fc.array(fc.string({ minLength: 0, maxLength: 30 }), { minLength: 0, maxLength: 10 }), { nil: undefined }),
}) as fc.Arbitrary<UserAccessEntry>;

// ===== Helpers =====

/** Asserts that a FilteredContext has all required fields with correct types */
function assertValidFilteredContext(ctx: FilteredContext): void {
  expect(ctx).toBeDefined();
  expect(ctx).toHaveProperty('sids');
  expect(ctx).toHaveProperty('groupSids');
  expect(ctx).toHaveProperty('uid');
  expect(ctx).toHaveProperty('gid');
  expect(ctx).toHaveProperty('unixGroups');
  expect(ctx).toHaveProperty('accessDenied');

  expect(Array.isArray(ctx.sids)).toBe(true);
  expect(Array.isArray(ctx.groupSids)).toBe(true);
  expect(typeof ctx.uid).toBe('string');
  expect(typeof ctx.gid).toBe('string');
  expect(Array.isArray(ctx.unixGroups)).toBe(true);
  expect(typeof ctx.accessDenied).toBe('boolean');
}

// ===== Property 1: Permission Resolution produces valid Filtered Context =====

describe('Feature: multi-agent-collaboration, Property 1: Permission Resolution produces valid Filtered Context', () => {

  // --- Property: Result always has all required fields ---

  describe('resolvePermissions always returns a valid FilteredContext', () => {
    it('returns valid FilteredContext when entry exists (Validates: Requirements 2.3, 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, userAccessEntryArb, async (userId, entry) => {
          const lookup: UserAccessLookup = async () => ({ ...entry, userId });
          const result = await resolvePermissions(userId, lookup);
          assertValidFilteredContext(result);
        }),
        { numRuns: 100 }
      );
    });

    it('returns valid FilteredContext when entry is null (Validates: Requirements 2.6)', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          const lookup: UserAccessLookup = async () => null;
          const result = await resolvePermissions(userId, lookup);
          assertValidFilteredContext(result);
        }),
        { numRuns: 100 }
      );
    });

    it('returns valid FilteredContext when lookup throws (Validates: Requirements 2.6)', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, fc.string({ minLength: 1, maxLength: 100 }), async (userId, errorMsg) => {
          const lookup: UserAccessLookup = async () => { throw new Error(errorMsg); };
          const result = await resolvePermissions(userId, lookup);
          assertValidFilteredContext(result);
        }),
        { numRuns: 100 }
      );
    });
  });

  // --- Property: When entry is null → accessDenied=true ---

  describe('Fail-Closed: null entry produces accessDenied=true', () => {
    it('sets accessDenied=true with empty arrays when entry is null (Validates: Requirements 2.6)', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          const lookup: UserAccessLookup = async () => null;
          const result = await resolvePermissions(userId, lookup);

          expect(result.accessDenied).toBe(true);
          expect(result.sids).toEqual([]);
          expect(result.groupSids).toEqual([]);
          expect(result.unixGroups).toEqual([]);
          expect(result.uid).toBe('');
          expect(result.gid).toBe('');
        }),
        { numRuns: 100 }
      );
    });
  });

  // --- Property: When entry exists → accessDenied=false ---

  describe('Entry exists produces accessDenied=false', () => {
    it('sets accessDenied=false when a valid entry is returned (Validates: Requirements 2.3, 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, userAccessEntryArb, async (userId, entry) => {
          const lookup: UserAccessLookup = async () => ({ ...entry, userId });
          const result = await resolvePermissions(userId, lookup);

          expect(result.accessDenied).toBe(false);
          expect(result.accessDeniedReason).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  // --- Property: When lookup throws → accessDenied=true (Fail-Closed) ---

  describe('Fail-Closed: lookup error produces accessDenied=true', () => {
    it('sets accessDenied=true when lookup throws an error (Validates: Requirements 2.6)', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, fc.string({ minLength: 1, maxLength: 100 }), async (userId, errorMsg) => {
          const lookup: UserAccessLookup = async () => { throw new Error(errorMsg); };
          const result = await resolvePermissions(userId, lookup);

          expect(result.accessDenied).toBe(true);
          expect(result.sids).toEqual([]);
          expect(result.groupSids).toEqual([]);
          expect(result.unixGroups).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });
  });
});
