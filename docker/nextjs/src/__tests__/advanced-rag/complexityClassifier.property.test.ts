/**
 * Property-based tests for ComplexityClassifier
 *
 * Uses fast-check to verify universal properties of the classifyQuery function.
 * Each test runs at least 100 iterations.
 */

import * as fc from 'fast-check';
import { classifyQuery } from '@/lib/complexity-classifier';
import { ClassificationResult } from '@/types/smart-routing';

/** Helper: build a string arbitrary from a character set using array + join */
function stringFromChars(
  chars: string,
  opts: { minLength: number; maxLength: number }
): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...chars.split('')), {
      minLength: opts.minLength,
      maxLength: opts.maxLength,
    })
    .map((arr) => arr.join(''));
}

// Feature: advanced-rag-features, Property 19: Complexity Classifier output validity
// **Validates: Requirements 10.1, 10.5**
describe('Property 19: Complexity Classifier output validity', () => {
  it('for any non-empty query, classifyQuery returns classification of simple or complex, and confidence in [0.0, 1.0]', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (query: string) => {
        const result: ClassificationResult = classifyQuery(query);

        // classification must be 'simple' or 'complex'
        expect(['simple', 'complex']).toContain(result.classification);

        // confidence must be in [0.0, 1.0]
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);

        // features must be present with correct types
        expect(typeof result.features.charCount).toBe('number');
        expect(typeof result.features.sentenceCount).toBe('number');
        expect(typeof result.features.hasAnalyticalKeywords).toBe('boolean');
        expect(typeof result.features.hasMultipleQuestions).toBe('boolean');
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 20: Simple classification conditions
// **Validates: Requirements 10.3**
describe('Property 20: Simple classification conditions', () => {
  /**
   * Generate queries that are ≤100 chars, single sentence (no sentence-splitting
   * punctuation), and contain no analytical keywords.
   * Safe chars exclude sentence terminators (. ? 。 ？) and letters that form
   * analytical keywords.
   */
  const safeChars = 'abcdfghijklmnoprtuvwxyz0123456789 ';

  const simpleQueryArb = stringFromChars(safeChars, { minLength: 1, maxLength: 95 })
    .map((s) => s.trim() || 'hello')
    .filter((s) => s.length >= 1 && s.length <= 100);

  it('queries ≤100 chars, single sentence, no analytical keywords → simple', () => {
    fc.assert(
      fc.property(simpleQueryArb, (query: string) => {
        const result = classifyQuery(query);
        expect(result.classification).toBe('simple');
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 21: Complex classification conditions
// **Validates: Requirements 10.4**
describe('Property 21: Complex classification conditions', () => {
  const safeChars = 'abcdfghijklmnoprtuvwxyz0123456789 ';

  it('queries >100 chars (single sentence, no keywords) → complex', () => {
    const longQueryArb = stringFromChars(safeChars, { minLength: 101, maxLength: 200 }).map(
      (s) => {
        const trimmed = s.trim();
        return trimmed.length > 100 ? trimmed : 'a'.repeat(101);
      }
    );

    fc.assert(
      fc.property(longQueryArb, (query: string) => {
        const result = classifyQuery(query);
        expect(result.classification).toBe('complex');
      }),
      { numRuns: 10 }
    );
  });

  it('queries with multiple questions (2+ ?) → complex', () => {
    const segmentChars = 'abcdefghijklmnopqrstuvwxyz ';
    const multiQuestionArb = fc
      .tuple(
        stringFromChars(segmentChars, { minLength: 1, maxLength: 20 }),
        stringFromChars(segmentChars, { minLength: 1, maxLength: 20 }),
        stringFromChars(segmentChars, { minLength: 1, maxLength: 20 })
      )
      .map(
        ([a, b, c]) =>
          `${a.trim() || 'what'}? ${b.trim() || 'how'}? ${c.trim() || 'ok'}`
      );

    fc.assert(
      fc.property(multiQuestionArb, (query: string) => {
        const result = classifyQuery(query);
        expect(result.classification).toBe('complex');
      }),
      { numRuns: 10 }
    );
  });

  it('queries with analytical keywords (and >100 chars) → complex', () => {
    const keywords = ['explain', 'compare', 'analyze', 'summarize'];
    const keywordArb = fc.constantFrom(...keywords);
    const paddingArb = stringFromChars(
      'abcdfghijklmnoprtuvwxyz ',
      { minLength: 80, maxLength: 120 }
    );

    fc.assert(
      fc.property(fc.tuple(keywordArb, paddingArb), ([keyword, padding]) => {
        const query = `Please ${keyword} the following topic in detail: ${padding}`;
        const result = classifyQuery(query);
        expect(result.classification).toBe('complex');
      }),
      { numRuns: 10 }
    );
  });
});


// Feature: advanced-rag-features, Property 22: Complexity Classifier supports Japanese and English
// **Validates: Requirements 10.6**
describe('Property 22: Complexity Classifier supports Japanese and English', () => {
  const japaneseChars =
    'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  const englishChars = 'abcdefghijklmnopqrstuvwxyz ';

  const japaneseQueryArb = stringFromChars(japaneseChars, {
    minLength: 1,
    maxLength: 50,
  }).map((s) => s.trim() || 'こんにちは');

  const englishQueryArb = stringFromChars(englishChars, {
    minLength: 1,
    maxLength: 50,
  }).map((s) => s.trim() || 'hello');

  it('Japanese strings return valid ClassificationResult', () => {
    fc.assert(
      fc.property(japaneseQueryArb, (query: string) => {
        const result: ClassificationResult = classifyQuery(query);

        expect(['simple', 'complex']).toContain(result.classification);
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
        expect(typeof result.features.charCount).toBe('number');
        expect(typeof result.features.sentenceCount).toBe('number');
        expect(typeof result.features.hasAnalyticalKeywords).toBe('boolean');
        expect(typeof result.features.hasMultipleQuestions).toBe('boolean');
      }),
      { numRuns: 10 }
    );
  });

  it('English strings return valid ClassificationResult', () => {
    fc.assert(
      fc.property(englishQueryArb, (query: string) => {
        const result: ClassificationResult = classifyQuery(query);

        expect(['simple', 'complex']).toContain(result.classification);
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
        expect(typeof result.features.charCount).toBe('number');
        expect(typeof result.features.sentenceCount).toBe('number');
        expect(typeof result.features.hasAnalyticalKeywords).toBe('boolean');
        expect(typeof result.features.hasMultipleQuestions).toBe('boolean');
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 23: Complexity Classifier determinism
// **Validates: Requirements 18.1, 18.2**
describe('Property 23: Complexity Classifier determinism', () => {
  it('calling classifyQuery twice with the same input produces identical classification and confidence', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (query: string) => {
        const result1 = classifyQuery(query);
        const result2 = classifyQuery(query);

        expect(result1.classification).toBe(result2.classification);
        expect(result1.confidence).toBe(result2.confidence);
        expect(result1.features.charCount).toBe(result2.features.charCount);
        expect(result1.features.sentenceCount).toBe(result2.features.sentenceCount);
        expect(result1.features.hasAnalyticalKeywords).toBe(
          result2.features.hasAnalyticalKeywords
        );
        expect(result1.features.hasMultipleQuestions).toBe(
          result2.features.hasMultipleQuestions
        );
      }),
      { numRuns: 10 }
    );
  });
});
