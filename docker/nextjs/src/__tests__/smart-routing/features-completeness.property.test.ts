/**
 * Property 8: Features Structure Completeness
 *
 * For any query string and any context size, the `classifyQuery` function SHALL return
 * a `features` object containing `hasDocumentAnalysisIntent` as a boolean and
 * `contextCharCount` as a non-negative number equal to the provided context size.
 *
 * **Validates: Requirements 4.2, 4.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyQuery } from '@/lib/complexity-classifier';

describe('Property 8: Features Structure Completeness', () => {
  it('features.hasDocumentAnalysisIntent is always a boolean for any query and context size', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(typeof result.features.hasDocumentAnalysisIntent).toBe('boolean');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('features.contextCharCount is always a non-negative number equal to the provided context size', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(typeof result.features.contextCharCount).toBe('number');
          expect(result.features.contextCharCount).toBeGreaterThanOrEqual(0);
          expect(result.features.contextCharCount).toBe(contextSize);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('features structure completeness holds with explicit contextSizeThreshold', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.nat({ max: 100000 }),
        (query, contextSize, threshold) => {
          const result = classifyQuery(query, contextSize, threshold);

          // hasDocumentAnalysisIntent must be a boolean
          expect(typeof result.features.hasDocumentAnalysisIntent).toBe('boolean');

          // contextCharCount must equal the provided contextSize
          expect(result.features.contextCharCount).toBe(contextSize);
          expect(result.features.contextCharCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
