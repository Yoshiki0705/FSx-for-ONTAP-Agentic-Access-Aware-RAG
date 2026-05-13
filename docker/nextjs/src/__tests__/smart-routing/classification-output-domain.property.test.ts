/**
 * Property 1: Classification Output Domain
 *
 * For any query string and non-negative context size, `classifyQuery` returns
 * exactly one of `'simple'`, `'complex'`, or `'full-context'`.
 *
 * Feature: smart-routing-model-expansion, Property 1: Classification Output Domain
 *
 * **Validates: Requirements 1.1, 4.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyQuery } from '@/lib/complexity-classifier';

const VALID_CLASSIFICATIONS = ['simple', 'complex', 'full-context'] as const;

describe('Feature: smart-routing-model-expansion, Property 1: Classification Output Domain', () => {
  it('classifyQuery returns exactly one of simple, complex, or full-context for any query and non-negative contextSize', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);

          // The classification must be exactly one of the three valid values
          expect(VALID_CLASSIFICATIONS).toContain(result.classification);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('classifyQuery returns exactly one of simple, complex, or full-context with explicit threshold', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.nat(),
        (query, contextSize, contextSizeThreshold) => {
          const result = classifyQuery(query, contextSize, contextSizeThreshold);

          // The classification must be exactly one of the three valid values
          expect(VALID_CLASSIFICATIONS).toContain(result.classification);
        }
      ),
      { numRuns: 200 }
    );
  });
});
