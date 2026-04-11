/**
 * Unit tests for KB Metadata Filter Builder
 *
 * Validates: Requirements 3.3, 5.4
 */

import {
  buildKbMetadataFilter,
  sanitizeSearchResults,
  type SearchResult,
} from '../kb-filter-builder';
import type { FilteredContext } from '../permission-resolver';

// ===== Helpers =====

function makeContext(overrides: Partial<FilteredContext> = {}): FilteredContext {
  return {
    sids: [],
    groupSids: [],
    uid: '',
    gid: '',
    unixGroups: [],
    accessDenied: false,
    ...overrides,
  };
}

// ===== buildKbMetadataFilter =====

describe('buildKbMetadataFilter', () => {
  it('returns null when accessDenied is true', () => {
    const ctx = makeContext({ accessDenied: true });
    expect(buildKbMetadataFilter(ctx)).toBeNull();
  });

  it('returns null when all permission fields are empty', () => {
    const ctx = makeContext();
    expect(buildKbMetadataFilter(ctx)).toBeNull();
  });

  it('builds OR conditions from SIDs', () => {
    const ctx = makeContext({ sids: ['S-1-5-21-1234', 'S-1-5-21-5678'] });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    expect(filter!.orAll).toHaveLength(2);
    expect(filter!.orAll![0]).toEqual({
      listContains: { key: 'allowedSids', value: 'S-1-5-21-1234' },
    });
    expect(filter!.orAll![1]).toEqual({
      listContains: { key: 'allowedSids', value: 'S-1-5-21-5678' },
    });
  });

  it('builds OR conditions from group SIDs', () => {
    const ctx = makeContext({ groupSids: ['S-1-5-21-9999'] });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    expect(filter!.orAll).toHaveLength(1);
    expect(filter!.orAll![0]).toEqual({
      listContains: { key: 'allowedGroupSids', value: 'S-1-5-21-9999' },
    });
  });

  it('builds equals condition from UID', () => {
    const ctx = makeContext({ uid: '1001' });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    expect(filter!.orAll!.some((c) => c.equals?.key === 'allowedUid' && c.equals?.value === '1001')).toBe(true);
  });

  it('builds equals condition from GID', () => {
    const ctx = makeContext({ gid: '2001' });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    expect(filter!.orAll!.some((c) => c.equals?.key === 'allowedGid' && c.equals?.value === '2001')).toBe(true);
  });

  it('builds listContains conditions from OIDC/UNIX groups', () => {
    const ctx = makeContext({ unixGroups: ['developers', 'staff'] });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    expect(filter!.orAll).toHaveLength(2);
    expect(filter!.orAll![0]).toEqual({
      listContains: { key: 'allowedGroups', value: 'developers' },
    });
    expect(filter!.orAll![1]).toEqual({
      listContains: { key: 'allowedGroups', value: 'staff' },
    });
  });

  it('combines all permission types into a single OR filter', () => {
    const ctx = makeContext({
      sids: ['S-1-5-21-1234'],
      groupSids: ['S-1-5-21-5678'],
      uid: '1001',
      gid: '2001',
      unixGroups: ['developers'],
    });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    // 1 SID + 1 groupSID + 1 UID + 1 GID + 1 group = 5
    expect(filter!.orAll).toHaveLength(5);
  });

  it('skips empty/whitespace-only values', () => {
    const ctx = makeContext({
      sids: ['S-1-5-21-1234', '', '  '],
      uid: '  ',
      unixGroups: ['developers', ''],
    });
    const filter = buildKbMetadataFilter(ctx);

    expect(filter).not.toBeNull();
    // 1 valid SID + 1 valid group = 2
    expect(filter!.orAll).toHaveLength(2);
  });
});

// ===== sanitizeSearchResults =====

describe('sanitizeSearchResults', () => {
  it('removes metadata field from results', () => {
    const results: SearchResult[] = [
      {
        content: 'Document content here',
        source: 's3://bucket/doc.pdf',
        score: 0.95,
        metadata: { allowedSids: ['S-1-5-21-1234'], someKey: 'value' },
      },
    ];

    const sanitized = sanitizeSearchResults(results);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).not.toHaveProperty('metadata');
    expect(sanitized[0].content).toBe('Document content here');
    expect(sanitized[0].source).toBe('s3://bucket/doc.pdf');
    expect(sanitized[0].score).toBe(0.95);
  });

  it('removes SID patterns from content', () => {
    const results: SearchResult[] = [
      {
        content: 'Access granted to S-1-5-21-3623811015-3361044348-30300820-1013 for this document',
        source: 's3://bucket/doc.pdf',
        score: 0.9,
      },
    ];

    const sanitized = sanitizeSearchResults(results);
    expect(sanitized[0].content).not.toMatch(/S-1-\d+-\d+/);
  });

  it('removes UID/GID patterns from content', () => {
    const results: SearchResult[] = [
      {
        content: 'File owned by uid=1001 gid=2001 with permissions',
        source: 's3://bucket/doc.pdf',
        score: 0.85,
      },
    ];

    const sanitized = sanitizeSearchResults(results);
    expect(sanitized[0].content).not.toMatch(/uid=\d+/);
    expect(sanitized[0].content).not.toMatch(/gid=\d+/);
  });

  it('removes NTFS ACL patterns from content', () => {
    const results: SearchResult[] = [
      {
        content: 'Document with DACL:O:BAG:BAD:AI ACE:ALLOW permissions applied',
        source: 's3://bucket/doc.pdf',
        score: 0.8,
      },
    ];

    const sanitized = sanitizeSearchResults(results);
    expect(sanitized[0].content).not.toMatch(/DACL:\S+/);
  });

  it('removes SID reference patterns from content', () => {
    const results: SearchResult[] = [
      {
        content: 'User with objectSid=S-1-5-21-1234 and groupSid=S-1-5-21-5678 accessed this',
        source: 's3://bucket/doc.pdf',
        score: 0.75,
      },
    ];

    const sanitized = sanitizeSearchResults(results);
    expect(sanitized[0].content).not.toMatch(/objectSid=\S+/);
    expect(sanitized[0].content).not.toMatch(/groupSid=\S+/);
  });

  it('handles empty results array', () => {
    expect(sanitizeSearchResults([])).toEqual([]);
  });

  it('preserves non-permission content intact', () => {
    const results: SearchResult[] = [
      {
        content: 'The quarterly financial report shows revenue growth of 15% year-over-year.',
        source: 's3://bucket/report.pdf',
        score: 0.92,
      },
    ];

    const sanitized = sanitizeSearchResults(results);
    expect(sanitized[0].content).toBe(
      'The quarterly financial report shows revenue growth of 15% year-over-year.',
    );
  });

  it('handles results without metadata field', () => {
    const results: SearchResult[] = [
      {
        content: 'Clean content',
        source: 's3://bucket/doc.pdf',
        score: 0.88,
      },
    ];

    const sanitized = sanitizeSearchResults(results);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).not.toHaveProperty('metadata');
    expect(sanitized[0].content).toBe('Clean content');
  });
});
