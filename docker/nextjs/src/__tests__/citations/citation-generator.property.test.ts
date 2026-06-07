/**
 * Citation Generator — Property-Based Tests
 *
 * Properties verified:
 * 1. Citation indices are always sequential starting from 1
 * 2. Citation count ≤ input result count (deduplication)
 * 3. All citations have valid boundaryType
 * 4. KB sources always have permissionVerified=true
 * 5. Excerpt length never exceeds 200 characters
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateCitations, type RetrieveResult } from '@/lib/citations/citation-generator';
import type { PermissionBoundaryType } from '@/types/permission-boundary';

// Arbitrary for RetrieveResult
const retrieveResultArb = fc.record({
  fileName: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 0, maxLength: 500 }),
  sourceUri: fc.option(fc.webUrl(), { nil: undefined }),
  score: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  sourceType: fc.option(fc.constantFrom('kb', 'web') as fc.Arbitrary<'kb' | 'web'>, { nil: undefined }),
});

describe('Citation Generator — Property Tests', () => {
  it('Property 1: Citation indices are sequential starting from 1', () => {
    fc.assert(
      fc.property(fc.array(retrieveResultArb, { minLength: 1, maxLength: 20 }), (results) => {
        const citations = generateCitations(results);
        for (let i = 0; i < citations.length; i++) {
          expect(citations[i].index).toBe(i + 1);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('Property 2: Citation count ≤ input result count (deduplication)', () => {
    fc.assert(
      fc.property(fc.array(retrieveResultArb, { minLength: 0, maxLength: 30 }), (results) => {
        const citations = generateCitations(results);
        expect(citations.length).toBeLessThanOrEqual(results.length);
      }),
      { numRuns: 50 },
    );
  });

  it('Property 3: All citations have valid boundaryType', () => {
    const validTypes: PermissionBoundaryType[] = ['verified', 'reference', 'expanded', 'memory'];
    fc.assert(
      fc.property(fc.array(retrieveResultArb, { minLength: 1, maxLength: 10 }), (results) => {
        const citations = generateCitations(results);
        for (const citation of citations) {
          expect(validTypes).toContain(citation.boundaryType);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('Property 4: KB sources always have permissionVerified=true', () => {
    fc.assert(
      fc.property(fc.array(retrieveResultArb, { minLength: 1, maxLength: 10 }), (results) => {
        const citations = generateCitations(results);
        for (const citation of citations) {
          if (citation.sourceType === 'kb') {
            expect(citation.permissionVerified).toBe(true);
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('Property 5: Excerpt length never exceeds 200 characters', () => {
    fc.assert(
      fc.property(fc.array(retrieveResultArb, { minLength: 1, maxLength: 10 }), (results) => {
        const citations = generateCitations(results);
        for (const citation of citations) {
          expect(citation.excerpt.length).toBeLessThanOrEqual(200);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('Property 6: Same fileName results are deduplicated (one citation per unique file)', () => {
    fc.assert(
      fc.property(
        fc.array(retrieveResultArb, { minLength: 1, maxLength: 20 }),
        (results) => {
          const citations = generateCitations(results);
          const uniqueFiles = new Set(results.map(r => r.fileName));
          expect(citations.length).toBeLessThanOrEqual(uniqueFiles.size);
        },
      ),
      { numRuns: 50 },
    );
  });
});
