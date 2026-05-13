/**
 * Property Tests: Routing Logic (Properties 4, 5, 6)
 *
 * Property 4: Full-Context Routes to Heavy Model
 * - When classification is 'full-context' with Smart Routing ON + auto mode,
 *   routeQuery returns heavyModelId (or fallback to powerfulModelId)
 *
 * Property 5: Manual Selection Always Overrides
 * - When Smart Routing OFF or auto mode OFF, routeQuery returns manualModelId
 *   with isAutoRouted: false
 *
 * Property 6: GPT-5.5 Never Auto-Routed
 * - When Smart Routing ON + auto mode, routeQuery never returns GPT-5.5 model ID
 *
 * **Validates: Requirements 2.1, 2.5, 5.2, 5.3, 10.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { routeQuery, GPT_5_5_MODEL_ID } from '@/lib/smart-router';
import { SmartRouterConfig } from '@/types/smart-routing';

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
 * Forces full-context classification when combined with contextSize > threshold.
 */
const queryWithIntentKeyword = fc
  .tuple(
    fc.constantFrom(...ALL_INTENT_KEYWORDS),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 50 })
  )
  .map(([keyword, prefix, suffix]) => `${prefix}${keyword}${suffix}`);

/**
 * Arbitrary: generates a non-empty model ID string (alphanumeric with dots/dashes).
 */
const arbitraryModelId = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789.-:'.split('')), {
    minLength: 3,
    maxLength: 50,
  })
  .map((chars) => chars.join(''))
  .filter((s) => s !== GPT_5_5_MODEL_ID);

/**
 * Arbitrary: generates a SmartRouterConfig with heavyModelId defined.
 */
const configWithHeavyModel: fc.Arbitrary<SmartRouterConfig> = fc
  .tuple(arbitraryModelId, arbitraryModelId, arbitraryModelId, fc.integer({ min: 100, max: 10000 }))
  .map(([lightweight, powerful, heavy, threshold]) => ({
    lightweightModelId: lightweight,
    powerfulModelId: powerful,
    heavyModelId: heavy,
    contextSizeThreshold: threshold,
  }));

/**
 * Arbitrary: generates a SmartRouterConfig WITHOUT heavyModelId (undefined).
 */
const configWithoutHeavyModel: fc.Arbitrary<SmartRouterConfig> = fc
  .tuple(arbitraryModelId, arbitraryModelId, fc.integer({ min: 100, max: 10000 }))
  .map(([lightweight, powerful, threshold]) => ({
    lightweightModelId: lightweight,
    powerfulModelId: powerful,
    heavyModelId: undefined,
    contextSizeThreshold: threshold,
  }));

/**
 * Arbitrary: generates a SmartRouterConfig that never uses GPT-5.5 as any model ID.
 */
const configWithoutGpt55: fc.Arbitrary<SmartRouterConfig> = fc
  .tuple(arbitraryModelId, arbitraryModelId, arbitraryModelId, fc.integer({ min: 100, max: 10000 }))
  .map(([lightweight, powerful, heavy, threshold]) => ({
    lightweightModelId: lightweight,
    powerfulModelId: powerful,
    heavyModelId: heavy,
    contextSizeThreshold: threshold,
  }));

/** Default threshold for tests */
const DEFAULT_THRESHOLD = 4000;

describe('Property 4: Full-Context Routes to Heavy Model', () => {
  // **Validates: Requirements 2.1, 10.1**

  it('full-context query with heavyModelId configured → routes to heavyModelId', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        configWithHeavyModel,
        (query, config) => {
          const contextSize = (config.contextSizeThreshold ?? DEFAULT_THRESHOLD) + 1;
          const result = routeQuery(query, true, true, 'manual-model', config, contextSize);

          expect(result.modelId).toBe(config.heavyModelId);
          expect(result.isAutoRouted).toBe(true);
          expect(result.classification).not.toBeNull();
          expect(result.classification!.classification).toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('full-context query without heavyModelId → falls back to powerfulModelId', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        configWithoutHeavyModel,
        (query, config) => {
          const contextSize = (config.contextSizeThreshold ?? DEFAULT_THRESHOLD) + 1;
          const result = routeQuery(query, true, true, 'manual-model', config, contextSize);

          expect(result.modelId).toBe(config.powerfulModelId);
          expect(result.isAutoRouted).toBe(true);
          expect(result.classification).not.toBeNull();
          expect(result.classification!.classification).toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property 5: Manual Selection Always Overrides', () => {
  // **Validates: Requirements 2.5, 5.3**

  it('Smart Routing OFF → returns manualModelId with isAutoRouted: false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        arbitraryModelId,
        configWithHeavyModel,
        fc.boolean(),
        fc.integer({ min: 0, max: 100000 }),
        (query, manualModelId, config, isAutoMode, contextSize) => {
          const result = routeQuery(query, false, isAutoMode, manualModelId, config, contextSize);

          expect(result.modelId).toBe(manualModelId);
          expect(result.isAutoRouted).toBe(false);
          expect(result.classification).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Smart Routing ON but auto mode OFF → returns manualModelId with isAutoRouted: false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        arbitraryModelId,
        configWithHeavyModel,
        fc.integer({ min: 0, max: 100000 }),
        (query, manualModelId, config, contextSize) => {
          const result = routeQuery(query, true, false, manualModelId, config, contextSize);

          expect(result.modelId).toBe(manualModelId);
          expect(result.isAutoRouted).toBe(false);
          expect(result.classification).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('GPT-5.5 as manualModelId with Smart Routing OFF → returns GPT-5.5', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        configWithHeavyModel,
        fc.integer({ min: 0, max: 100000 }),
        (query, config, contextSize) => {
          const result = routeQuery(query, false, true, GPT_5_5_MODEL_ID, config, contextSize);

          expect(result.modelId).toBe(GPT_5_5_MODEL_ID);
          expect(result.isAutoRouted).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('GPT-5.5 as manualModelId with auto mode OFF → returns GPT-5.5', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        configWithHeavyModel,
        fc.integer({ min: 0, max: 100000 }),
        (query, config, contextSize) => {
          const result = routeQuery(query, true, false, GPT_5_5_MODEL_ID, config, contextSize);

          expect(result.modelId).toBe(GPT_5_5_MODEL_ID);
          expect(result.isAutoRouted).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: GPT-5.5 Never Auto-Routed', () => {
  // **Validates: Requirements 5.2**

  it('Smart Routing ON + auto mode → routeQuery never returns GPT-5.5 model ID', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        configWithoutGpt55,
        fc.integer({ min: 0, max: 100000 }),
        (query, config, contextSize) => {
          const result = routeQuery(query, true, true, 'any-manual-model', config, contextSize);

          expect(result.modelId).not.toBe(GPT_5_5_MODEL_ID);
          expect(result.isAutoRouted).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('auto-routed full-context queries never return GPT-5.5', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        configWithoutGpt55,
        (query, config) => {
          const contextSize = (config.contextSizeThreshold ?? DEFAULT_THRESHOLD) + 1;
          const result = routeQuery(query, true, true, GPT_5_5_MODEL_ID, config, contextSize);

          expect(result.modelId).not.toBe(GPT_5_5_MODEL_ID);
          expect(result.isAutoRouted).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('even if GPT-5.5 is set as manualModelId, auto-routing ignores it', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        configWithoutGpt55,
        fc.integer({ min: 0, max: 100000 }),
        (query, config, contextSize) => {
          // manualModelId is GPT-5.5 but Smart Routing ON + auto mode → should NOT use it
          const result = routeQuery(query, true, true, GPT_5_5_MODEL_ID, config, contextSize);

          expect(result.modelId).not.toBe(GPT_5_5_MODEL_ID);
          expect(result.isAutoRouted).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
