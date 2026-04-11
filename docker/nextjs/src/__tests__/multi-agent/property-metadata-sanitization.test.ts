/**
 * Property tests for Metadata Sanitization
 * Feature: multi-agent-collaboration, Property 3: Metadata Sanitization
 *
 * Validates: Requirements 5.4
 *
 * Verifies that:
 * - For any search result, after sanitization, SID/UID/GID raw permission info should NOT be present
 * - The metadata field is always removed from sanitized results
 * - The source and score fields are preserved unchanged
 */

import * as fc from 'fast-check';
import {
  sanitizeSearchResults,
  type SearchResult,
  type SanitizedSearchResult,
} from '@/utils/multi-agent/kb-filter-builder';

// ===== Regex patterns (mirrors the patterns used in sanitizeContent) =====

const SID_PATTERN = /S-1-\d+-\d+(-\d+)*/;
const UID_GID_PATTERN = /\b(uid|gid|uidNumber|gidNumber)\s*[:=]\s*\d+/i;
const NTFS_ACL_PATTERN = /\b(DACL|SACL|ACE|ACL)\s*[:=]\s*\S+/i;
const SID_REF_PATTERN = /\b(sid|objectSid|groupSid|securityIdentifier)\s*[:=]\s*\S+/i;

// ===== Generators =====

/** Generates realistic Windows SID strings */
const sidArb = fc
  .tuple(
    fc.integer({ min: 1, max: 5 }),
    fc.integer({ min: 1, max: 99 }),
    fc.array(fc.integer({ min: 1000, max: 999999999 }), { minLength: 1, maxLength: 5 }),
  )
  .map(([rev, auth, subs]) => `S-1-${rev}-${auth}-${subs.join('-')}`);

/** Generates UID/GID assignment patterns like uid=1001, gid=500 */
const uidGidArb = fc
  .tuple(
    fc.constantFrom('uid', 'gid', 'uidNumber', 'gidNumber'),
    fc.constantFrom('=', ': '),
    fc.integer({ min: 0, max: 65535 }),
  )
  .map(([key, sep, val]) => `${key}${sep}${val}`);

/** Generates NTFS ACL patterns like DACL:Allow, SACL:Deny */
const ntfsAclArb = fc
  .tuple(
    fc.constantFrom('DACL', 'SACL', 'ACE', 'ACL'),
    fc.constantFrom('=', ': '),
    fc.constantFrom('Allow', 'Deny', 'Audit', 'ReadWrite', 'FullControl'),
  )
  .map(([type, sep, val]) => `${type}${sep}${val}`);

/** Generates SID reference patterns like sid=S-1-5-21-..., objectSid: S-1-5-... */
const sidRefArb = fc
  .tuple(
    fc.constantFrom('sid', 'objectSid', 'groupSid', 'securityIdentifier'),
    fc.constantFrom('=', ': '),
    sidArb,
  )
  .map(([key, sep, sid]) => `${key}${sep}${sid}`);

/** Generates safe content text without permission patterns */
const safeContentArb = fc
  .array(
    fc.constantFrom(
      'The document describes', 'financial data for Q3', 'project plan overview',
      'meeting notes from', 'technical specification', 'user guide section',
      'summary of findings', 'analysis report', 'budget allocation',
      'team performance review', 'quarterly results', 'product roadmap',
    ),
    { minLength: 1, maxLength: 5 },
  )
  .map((parts) => parts.join(' '));

/** Generates content with injected permission patterns */
const contentWithPermissionPatternsArb = fc
  .tuple(
    safeContentArb,
    fc.array(
      fc.oneof(sidArb, uidGidArb, ntfsAclArb, sidRefArb),
      { minLength: 1, maxLength: 4 },
    ),
    safeContentArb,
  )
  .map(([prefix, patterns, suffix]) => `${prefix} ${patterns.join(' ')} ${suffix}`);

/** Generates arbitrary metadata objects */
const metadataArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
);

/** Generates a SearchResult with injected permission patterns */
const searchResultWithPatternsArb: fc.Arbitrary<SearchResult> = fc.record({
  content: contentWithPermissionPatternsArb,
  source: fc.webUrl(),
  score: fc.double({ min: 0, max: 1, noNaN: true }),
  metadata: fc.option(metadataArb, { nil: undefined }),
});

/** Generates a clean SearchResult without permission patterns */
const cleanSearchResultArb: fc.Arbitrary<SearchResult> = fc.record({
  content: safeContentArb,
  source: fc.webUrl(),
  score: fc.double({ min: 0, max: 1, noNaN: true }),
  metadata: fc.option(metadataArb, { nil: undefined }),
});

// ===== Helpers =====

/** Checks if a string contains any raw permission metadata patterns */
function containsPermissionPatterns(text: string): boolean {
  return (
    SID_PATTERN.test(text) ||
    UID_GID_PATTERN.test(text) ||
    NTFS_ACL_PATTERN.test(text) ||
    SID_REF_PATTERN.test(text)
  );
}

// ===== Property 3: Metadata Sanitization in Filtered Context =====

describe('Feature: multi-agent-collaboration, Property 3: Metadata Sanitization', () => {

  // --- Property: SID/UID/GID patterns are removed after sanitization ---

  describe('SID/UID/GID raw permission info is removed from sanitized content', () => {
    it('removes all SID patterns from content (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(SID_PATTERN.test(result.content)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('removes all UID/GID patterns from content (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(UID_GID_PATTERN.test(result.content)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('removes all NTFS ACL patterns from content (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(NTFS_ACL_PATTERN.test(result.content)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('removes all SID reference patterns from content (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(SID_REF_PATTERN.test(result.content)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('no permission patterns remain after sanitization of any input (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(containsPermissionPatterns(result.content)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: metadata field is always removed ---

  describe('metadata field is always removed from sanitized results', () => {
    it('sanitized results never contain a metadata field (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(result).not.toHaveProperty('metadata');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('metadata is removed even when present in input (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              content: safeContentArb,
              source: fc.webUrl(),
              score: fc.double({ min: 0, max: 1, noNaN: true }),
              metadata: metadataArb,
            }) as fc.Arbitrary<SearchResult>,
            { minLength: 1, maxLength: 5 },
          ),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            for (const result of sanitized) {
              expect(result).not.toHaveProperty('metadata');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // --- Property: source and score are preserved unchanged ---

  describe('source and score are preserved unchanged after sanitization', () => {
    it('source is preserved exactly (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            expect(sanitized.length).toBe(results.length);
            for (let i = 0; i < results.length; i++) {
              expect(sanitized[i].source).toBe(results[i].source);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('score is preserved exactly (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultWithPatternsArb, { minLength: 1, maxLength: 5 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);

            expect(sanitized.length).toBe(results.length);
            for (let i = 0; i < results.length; i++) {
              expect(sanitized[i].score).toBe(results[i].score);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('result count is preserved (Validates: Requirements 5.4)', () => {
      fc.assert(
        fc.property(
          fc.array(cleanSearchResultArb, { minLength: 0, maxLength: 10 }),
          (results) => {
            const sanitized = sanitizeSearchResults(results);
            expect(sanitized.length).toBe(results.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
