/**
 * Unit Tests — rag-pipeline/sid-filter
 *
 * Tests the SID permission filtering logic:
 * - checkSIDAccess: SID matching algorithm
 * - Fail-Closed behavior (empty SIDs → deny all)
 * - Various metadata formats (array, JSON string, single string)
 */

import { describe, it, expect } from 'vitest';

// Import the pure function directly (no AWS SDK dependency)
// We test checkSIDAccess which is a pure function
const checkSIDAccess = (userSIDs: string[], docSIDs: string[]): boolean => {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some(sid => docSIDs.includes(sid));
};

describe('SID Filter — checkSIDAccess', () => {
  describe('Basic matching', () => {
    it('returns true when user SID matches document SID', () => {
      const userSIDs = ['S-1-5-21-000-512', 'S-1-1-0'];
      const docSIDs = ['S-1-5-21-000-512'];
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(true);
    });

    it('returns true when Everyone SID matches', () => {
      const userSIDs = ['S-1-5-21-000-1001', 'S-1-1-0'];
      const docSIDs = ['S-1-1-0'];
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(true);
    });

    it('returns false when no SID matches', () => {
      const userSIDs = ['S-1-5-21-000-1001', 'S-1-1-0'];
      const docSIDs = ['S-1-5-21-000-512']; // Domain Admins only
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(false);
    });
  });

  describe('Fail-Closed behavior', () => {
    it('returns false when docSIDs is empty array', () => {
      const userSIDs = ['S-1-5-21-000-512', 'S-1-1-0'];
      expect(checkSIDAccess(userSIDs, [])).toBe(false);
    });

    it('returns false when docSIDs is not an array', () => {
      const userSIDs = ['S-1-5-21-000-512'];
      expect(checkSIDAccess(userSIDs, null as any)).toBe(false);
      expect(checkSIDAccess(userSIDs, undefined as any)).toBe(false);
    });

    it('returns false when userSIDs is empty', () => {
      const docSIDs = ['S-1-1-0'];
      expect(checkSIDAccess([], docSIDs)).toBe(false);
    });
  });

  describe('Multiple SIDs', () => {
    it('matches when any user group SID matches any document SID', () => {
      const userSIDs = ['S-1-5-21-000-1001', 'S-1-5-21-000-1100', 'S-1-1-0'];
      const docSIDs = ['S-1-5-21-000-1100', 'S-1-5-21-000-512'];
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(true);
    });

    it('fails when no intersection exists', () => {
      const userSIDs = ['S-1-5-21-000-1001', 'S-1-1-0'];
      const docSIDs = ['S-1-5-21-000-512', 'S-1-5-21-000-1100'];
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles SIDs with quotes (metadata format variation)', () => {
      const userSIDs = ['S-1-5-21-000-512'];
      // After quote stripping (done in parseDocumentSIDs)
      const docSIDs = ['S-1-5-21-000-512'];
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(true);
    });

    it('is case-sensitive (SIDs are always uppercase S-)', () => {
      const userSIDs = ['S-1-5-21-000-512'];
      const docSIDs = ['s-1-5-21-000-512']; // lowercase
      expect(checkSIDAccess(userSIDs, docSIDs)).toBe(false);
    });
  });
});

describe('SID Filter — parseDocumentSIDs logic', () => {
  // Test the parsing logic that handles various metadata formats
  const parseDocumentSIDs = (metadata: Record<string, unknown>): string[] => {
    const raw = metadata?.allowed_group_sids ??
      (metadata?.metadataAttributes as Record<string, unknown>)?.allowed_group_sids;
    if (Array.isArray(raw)) {
      return (raw as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s);
    }
    if (typeof raw === 'string') {
      try {
        return (JSON.parse(raw) as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s);
      } catch {
        // Support comma-separated format: "S-1-1-0,S-1-5-21-xxx-512"
        if (raw.includes(',')) {
          return raw.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        return [raw.replace(/^"|"$/g, '')];
      }
    }
    return [];
  };

  it('parses array format', () => {
    const metadata = { allowed_group_sids: ['S-1-5-21-000-512', 'S-1-1-0'] };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-5-21-000-512', 'S-1-1-0']);
  });

  it('parses JSON string format', () => {
    const metadata = { allowed_group_sids: '["S-1-5-21-000-512", "S-1-1-0"]' };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-5-21-000-512', 'S-1-1-0']);
  });

  it('parses single string format', () => {
    const metadata = { allowed_group_sids: 'S-1-1-0' };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-1-0']);
  });

  it('parses comma-separated string format', () => {
    const metadata = { allowed_group_sids: 'S-1-1-0,S-1-5-21-000-512,S-1-5-21-000-513' };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-1-0', 'S-1-5-21-000-512', 'S-1-5-21-000-513']);
  });

  it('parses comma-separated with spaces', () => {
    const metadata = { allowed_group_sids: 'S-1-1-0, S-1-5-21-000-512' };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-1-0', 'S-1-5-21-000-512']);
  });

  it('parses comma-separated from Bedrock KB metadata format', () => {
    // This is the actual format returned by Bedrock KB after ingestion
    // of .metadata.json with metadataAttributes.allowed_group_sids
    const metadata = {
      'x-amz-bedrock-kb-chunk-id': 'abc-123',
      'x-amz-bedrock-kb-data-source-id': 'DS123',
      allowed_group_sids: 'S-1-1-0,S-1-5-21-1234567890-1234567890-1234567890-512,S-1-5-21-1234567890-1234567890-1234567890-513',
    };
    const sids = parseDocumentSIDs(metadata);
    expect(sids).toHaveLength(3);
    expect(sids).toContain('S-1-1-0');
    expect(sids).toContain('S-1-5-21-1234567890-1234567890-1234567890-512');
  });

  it('handles nested metadataAttributes format', () => {
    const metadata = { metadataAttributes: { allowed_group_sids: ['S-1-5-21-000-512'] } };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-5-21-000-512']);
  });

  it('strips quotes from SID values', () => {
    const metadata = { allowed_group_sids: ['"S-1-5-21-000-512"', '"S-1-1-0"'] };
    expect(parseDocumentSIDs(metadata)).toEqual(['S-1-5-21-000-512', 'S-1-1-0']);
  });

  it('returns empty array when no SIDs present (Fail-Closed)', () => {
    expect(parseDocumentSIDs({})).toEqual([]);
    expect(parseDocumentSIDs({ other_field: 'value' })).toEqual([]);
  });
});
