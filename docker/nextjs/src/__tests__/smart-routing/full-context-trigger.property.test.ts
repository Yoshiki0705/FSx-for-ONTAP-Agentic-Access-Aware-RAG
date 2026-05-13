/**
 * Property Tests: Full-Context Trigger Conditions (Properties 2, 3)
 *
 * Property 2: Full-Context Classification Trigger
 * - For any query containing a Document_Analysis_Intent keyword AND context size > threshold,
 *   classification is 'full-context'
 *
 * Property 3: Full-Context Requires Both Conditions
 * - For any query lacking intent keywords OR context ≤ threshold,
 *   classification is NOT 'full-context'
 *
 * **Validates: Requirements 1.2, 1.3, 1.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyQuery } from '@/lib/complexity-classifier';

/** Japanese Document Analysis Intent keywords */
const JAPANESE_INTENT_KEYWORDS = [
  'この文書を要約',
  'レポート全体を分析',
  '文書全体',
  'ドキュメントを要約',
  '全文を分析',
  '資料全体',
  '報告書を要約',
  'ファイル全体',
];

/** English Document Analysis Intent keywords */
const ENGLISH_INTENT_KEYWORDS = [
  'summarize this document',
  'analyze the full report',
  'summarize the entire',
  'analyze the whole',
  'full document analysis',
  'review the complete',
  'process the entire',
];

/** All intent keywords combined */
const ALL_INTENT_KEYWORDS = [...JAPANESE_INTENT_KEYWORDS, ...ENGLISH_INTENT_KEYWORDS];

/**
 * Arbitrary: generates a query string that contains at least one intent keyword.
 * Wraps a randomly chosen keyword with optional prefix/suffix text.
 */
const queryWithIntentKeyword = fc
  .tuple(
    fc.constantFrom(...ALL_INTENT_KEYWORDS),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 50 })
  )
  .map(([keyword, prefix, suffix]) => `${prefix}${keyword}${suffix}`);

/**
 * Arbitrary: generates a query string that does NOT contain any intent keyword.
 * Uses a filtered arbitrary string that excludes all keywords.
 */
const queryWithoutIntentKeyword = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => {
    const lower = s.toLowerCase();
    for (const kw of JAPANESE_INTENT_KEYWORDS) {
      if (s.includes(kw)) return false;
    }
    for (const kw of ENGLISH_INTENT_KEYWORDS) {
      if (lower.includes(kw)) return false;
    }
    return true;
  });

/** Default threshold used in tests */
const DEFAULT_THRESHOLD = 4000;

describe('Property 2: Full-Context Classification Trigger', () => {
  // **Validates: Requirements 1.2**

  it('query with intent keyword AND contextSize > threshold → classification is full-context (default threshold)', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: DEFAULT_THRESHOLD + 1, max: 100000 }),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(result.classification).toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('query with intent keyword AND contextSize > custom threshold → classification is full-context', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: 100, max: 50000 }),
        (query, threshold) => {
          const contextSize = threshold + 1;
          const result = classifyQuery(query, contextSize, threshold);
          expect(result.classification).toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('full-context classification always has confidence 0.9', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: DEFAULT_THRESHOLD + 1, max: 100000 }),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(result.confidence).toBe(0.9);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Full-Context Requires Both Conditions', () => {
  // **Validates: Requirements 1.3, 1.4**

  it('query WITHOUT intent keyword → classification is NOT full-context (regardless of context size)', () => {
    fc.assert(
      fc.property(
        queryWithoutIntentKeyword,
        fc.integer({ min: 0, max: 100000 }),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(result.classification).not.toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('query WITH intent keyword but contextSize ≤ threshold → classification is NOT full-context', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: 0, max: DEFAULT_THRESHOLD }),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(result.classification).not.toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('query WITH intent keyword but contextSize ≤ custom threshold → classification is NOT full-context', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: 100, max: 50000 }),
        (query, threshold) => {
          // contextSize exactly at threshold (not exceeding)
          const result = classifyQuery(query, threshold, threshold);
          expect(result.classification).not.toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('query WITHOUT intent keyword AND contextSize ≤ threshold → classification is simple or complex', () => {
    fc.assert(
      fc.property(
        queryWithoutIntentKeyword,
        fc.integer({ min: 0, max: DEFAULT_THRESHOLD }),
        (query, contextSize) => {
          const result = classifyQuery(query, contextSize);
          expect(['simple', 'complex']).toContain(result.classification);
        }
      ),
      { numRuns: 200 }
    );
  });
});
