/**
 * Property tests for Agent Name Deduplication
 * Feature: multi-agent-collaboration, Property 8: Agent Name Deduplication on Import
 *
 * Validates: Requirements 9.4
 *
 * Verifies that:
 * - For any set of existing names and import names, all resulting names are unique
 * - Original names are preserved when no conflicts exist
 * - Deduplication appends numeric suffixes
 * - Result length always matches input length
 */

import * as fc from 'fast-check';
import { deduplicateNames } from '@/utils/multi-agent/team-template';

// ===== Generators =====

/** Generates a safe name string */
const nameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,18}[a-z0-9]$/);

/** Generates a list of names (may contain duplicates) */
const nameListArb = fc.array(nameArb, { minLength: 0, maxLength: 15 });

/** Generates a non-empty list of names to import */
const importNamesArb = fc.array(nameArb, { minLength: 1, maxLength: 10 });

// ===== Property 8: Agent Name Deduplication =====

describe('Feature: multi-agent-collaboration, Property 8: Agent Name Deduplication on Import', () => {
  /**
   * **Validates: Requirements 9.4**
   *
   * All resulting names must be unique — no duplicates among themselves
   * and no collisions with existing names.
   */
  it('all resulting names are unique', () => {
    fc.assert(
      fc.property(importNamesArb, nameListArb, (importNames, existingNames) => {
        const result = deduplicateNames(importNames, existingNames);
        const uniqueResult = new Set(result);

        // All result names must be unique among themselves
        expect(uniqueResult.size).toBe(result.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * No resulting name should collide with any existing name.
   */
  it('no resulting name collides with existing names', () => {
    fc.assert(
      fc.property(importNamesArb, nameListArb, (importNames, existingNames) => {
        const result = deduplicateNames(importNames, existingNames);
        const existingSet = new Set(existingNames);

        for (const name of result) {
          // If the original name was in existing, the result should be different
          // But if the original was NOT in existing, it could be the same
          // The key property: no result name is in the existing set
          // UNLESS it was already unique (not in existing and not a duplicate)
          // Actually the stronger property: result names don't collide with existing
          expect(existingSet.has(name)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * Result length always matches input length — no names are dropped.
   */
  it('result length matches input length', () => {
    fc.assert(
      fc.property(importNamesArb, nameListArb, (importNames, existingNames) => {
        const result = deduplicateNames(importNames, existingNames);
        expect(result.length).toBe(importNames.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * When no conflicts exist (all import names are unique and not in existing),
   * original names are preserved as-is.
   */
  it('preserves original names when no conflicts exist', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(nameArb, { minLength: 1, maxLength: 5 }),
        fc.uniqueArray(nameArb, { minLength: 0, maxLength: 5 }),
        (uniqueImportNames, rawExistingNames) => {
          // Filter out any overlap between import and existing
          const existingNames = rawExistingNames.filter(
            (e) => !uniqueImportNames.includes(e),
          );

          const result = deduplicateNames(uniqueImportNames, existingNames);
          expect(result).toEqual(uniqueImportNames);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * Each deduplicated name starts with the original name (suffix is appended).
   */
  it('each deduplicated name starts with the original name', () => {
    fc.assert(
      fc.property(importNamesArb, nameListArb, (importNames, existingNames) => {
        const result = deduplicateNames(importNames, existingNames);

        for (let i = 0; i < importNames.length; i++) {
          expect(result[i].startsWith(importNames[i])).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * Combined set of existing names and result names has no duplicates.
   */
  it('combined existing + result names are all unique', () => {
    fc.assert(
      fc.property(importNamesArb, nameListArb, (importNames, existingNames) => {
        const result = deduplicateNames(importNames, existingNames);
        const combined = [...existingNames, ...result];
        const uniqueCombined = new Set(combined);

        expect(uniqueCombined.size).toBe(combined.length);
      }),
      { numRuns: 100 },
    );
  });
});
