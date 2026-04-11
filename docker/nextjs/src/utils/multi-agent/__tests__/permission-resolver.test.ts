/**
 * Unit tests for Permission Resolution utility
 *
 * Validates: Requirements 2.3, 2.5, 2.6
 */

import {
  resolvePermissions,
  type FilteredContext,
  type UserAccessEntry,
  type UserAccessLookup,
} from '../permission-resolver';

// ===== Helper: mock lookup that returns a given entry =====

function mockLookup(entry: UserAccessEntry | null): UserAccessLookup {
  return async () => entry;
}

function throwingLookup(error: Error): UserAccessLookup {
  return async () => {
    throw error;
  };
}

// ===== Tests =====

describe('resolvePermissions', () => {
  // --- Happy path: entry exists ---

  it('returns populated FilteredContext when user entry exists', async () => {
    const entry: UserAccessEntry = {
      userId: 'user-001',
      sids: ['S-1-5-21-1234'],
      groupSids: ['S-1-5-21-5678'],
      uid: '1001',
      gid: '1001',
      unixGroups: ['developers', 'staff'],
    };

    const result = await resolvePermissions('user-001', mockLookup(entry));

    expect(result.accessDenied).toBe(false);
    expect(result.accessDeniedReason).toBeUndefined();
    expect(result.sids).toEqual(['S-1-5-21-1234']);
    expect(result.groupSids).toEqual(['S-1-5-21-5678']);
    expect(result.uid).toBe('1001');
    expect(result.gid).toBe('1001');
    expect(result.unixGroups).toEqual(['developers', 'staff']);
  });

  it('defaults optional fields to empty arrays/strings when entry has partial data', async () => {
    const entry: UserAccessEntry = {
      userId: 'user-002',
      // sids, groupSids, uid, gid, unixGroups all undefined
    };

    const result = await resolvePermissions('user-002', mockLookup(entry));

    expect(result.accessDenied).toBe(false);
    expect(result.sids).toEqual([]);
    expect(result.groupSids).toEqual([]);
    expect(result.uid).toBe('');
    expect(result.gid).toBe('');
    expect(result.unixGroups).toEqual([]);
  });

  // --- Fail-Closed: no entry ---

  it('returns Fail-Closed context when lookup returns null (Requirement 2.6)', async () => {
    const result = await resolvePermissions('unknown-user', mockLookup(null));

    expect(result.accessDenied).toBe(true);
    expect(result.accessDeniedReason).toContain('No entry found');
    expect(result.accessDeniedReason).toContain('unknown-user');
    expect(result.sids).toEqual([]);
    expect(result.groupSids).toEqual([]);
    expect(result.uid).toBe('');
    expect(result.gid).toBe('');
    expect(result.unixGroups).toEqual([]);
  });

  // --- Fail-Closed: lookup error ---

  it('returns Fail-Closed context when lookup throws an error', async () => {
    const result = await resolvePermissions(
      'user-err',
      throwingLookup(new Error('DynamoDB timeout')),
    );

    expect(result.accessDenied).toBe(true);
    expect(result.accessDeniedReason).toContain('Failed to resolve permissions');
    expect(result.accessDeniedReason).toContain('DynamoDB timeout');
    expect(result.sids).toEqual([]);
  });

  it('handles non-Error thrown values gracefully', async () => {
    const lookup: UserAccessLookup = async () => {
      throw 'string error';
    };

    const result = await resolvePermissions('user-x', lookup);

    expect(result.accessDenied).toBe(true);
    expect(result.accessDeniedReason).toContain('Unknown error');
  });

  // --- Edge cases: empty/invalid userId ---

  it('returns Fail-Closed context for empty userId', async () => {
    const result = await resolvePermissions('', mockLookup(null));

    expect(result.accessDenied).toBe(true);
    expect(result.accessDeniedReason).toContain('empty');
  });

  it('returns Fail-Closed context for whitespace-only userId', async () => {
    const result = await resolvePermissions('   ', mockLookup(null));

    expect(result.accessDenied).toBe(true);
    expect(result.accessDeniedReason).toContain('empty');
  });

  // --- FilteredContext structure validation ---

  it('always returns all required fields in FilteredContext', async () => {
    const cases: Array<[string, UserAccessLookup]> = [
      ['valid-user', mockLookup({ userId: 'valid-user', sids: ['S-1'] })],
      ['missing-user', mockLookup(null)],
      ['error-user', throwingLookup(new Error('fail'))],
    ];

    for (const [userId, lookup] of cases) {
      const result = await resolvePermissions(userId, lookup);

      // All required fields must exist
      expect(result).toHaveProperty('sids');
      expect(result).toHaveProperty('groupSids');
      expect(result).toHaveProperty('uid');
      expect(result).toHaveProperty('gid');
      expect(result).toHaveProperty('unixGroups');
      expect(result).toHaveProperty('accessDenied');

      // Array fields must be arrays
      expect(Array.isArray(result.sids)).toBe(true);
      expect(Array.isArray(result.groupSids)).toBe(true);
      expect(Array.isArray(result.unixGroups)).toBe(true);

      // String fields must be strings
      expect(typeof result.uid).toBe('string');
      expect(typeof result.gid).toBe('string');
      expect(typeof result.accessDenied).toBe('boolean');
    }
  });
});
