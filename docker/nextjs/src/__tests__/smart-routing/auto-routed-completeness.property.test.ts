/**
 * Property 7: Auto-Routed Decisions Include Complete Classification
 *
 * For any auto-routed query (Smart Routing ON, auto mode ON), the `routeQuery`
 * function SHALL return a `RoutingDecision` where:
 * - `classification` is non-null
 * - `classification.classification` matches the tier used for model selection
 * - `reason` is a non-empty string containing the confidence score
 *
 * **Validates: Requirements 2.4, 8.1, 8.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { routeQuery, DEFAULT_SMART_ROUTER_CONFIG } from '@/lib/smart-router';
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
 * Arbitrary: generates a SmartRouterConfig with valid model IDs.
 */
const arbConfig: fc.Arbitrary<SmartRouterConfig> = fc
  .record({
    lightweightModelId: fc.string({ minLength: 1, maxLength: 50 }),
    powerfulModelId: fc.string({ minLength: 1, maxLength: 50 }),
    heavyModelId: fc.string({ minLength: 1, maxLength: 50 }),
    contextSizeThreshold: fc.integer({ min: 100, max: 50000 }),
  });

/**
 * Arbitrary: generates a query string that contains at least one intent keyword.
 */
const queryWithIntentKeyword = fc
  .tuple(
    fc.constantFrom(...ALL_INTENT_KEYWORDS),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 50 })
  )
  .map(([keyword, prefix, suffix]) => `${prefix}${keyword}${suffix}`);

describe('Property 7: Auto-Routed Decisions Include Complete Classification', () => {
  // **Validates: Requirements 2.4, 8.1, 8.2**

  it('auto-routed decisions always have non-null classification', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.nat({ max: 100000 }),
        (query, contextSize) => {
          const decision = routeQuery(
            query,
            true,  // Smart Routing enabled
            true,  // Auto mode ON
            'manual-model-id',
            DEFAULT_SMART_ROUTER_CONFIG,
            contextSize
          );

          // classification must be non-null for auto-routed decisions
          expect(decision.classification).not.toBeNull();
          expect(decision.isAutoRouted).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('classification.classification matches the tier used for model selection', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.nat({ max: 100000 }),
        arbConfig,
        (query, contextSize, config) => {
          const decision = routeQuery(
            query,
            true,  // Smart Routing enabled
            true,  // Auto mode ON
            'manual-model-id',
            config,
            contextSize
          );

          expect(decision.classification).not.toBeNull();
          const tier = decision.classification!.classification;

          // The model selected must correspond to the classification tier
          switch (tier) {
            case 'simple':
              expect(decision.modelId).toBe(config.lightweightModelId);
              break;
            case 'complex':
              expect(decision.modelId).toBe(config.powerfulModelId);
              break;
            case 'full-context':
              expect(decision.modelId).toBe(config.heavyModelId ?? config.powerfulModelId);
              break;
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('reason is a non-empty string containing the confidence score', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.nat({ max: 100000 }),
        (query, contextSize) => {
          const decision = routeQuery(
            query,
            true,  // Smart Routing enabled
            true,  // Auto mode ON
            'manual-model-id',
            DEFAULT_SMART_ROUTER_CONFIG,
            contextSize
          );

          // reason must be a non-empty string
          expect(decision.reason).toBeTruthy();
          expect(typeof decision.reason).toBe('string');
          expect(decision.reason.length).toBeGreaterThan(0);

          // reason must contain the confidence score (formatted as X.XX)
          const confidence = decision.classification!.confidence;
          const formattedConfidence = confidence.toFixed(2);
          expect(decision.reason).toContain(formattedConfidence);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('full-context auto-routed decisions include classification and confidence in reason', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: DEFAULT_SMART_ROUTER_CONFIG.contextSizeThreshold! + 1, max: 100000 }),
        (query, contextSize) => {
          const decision = routeQuery(
            query,
            true,  // Smart Routing enabled
            true,  // Auto mode ON
            'manual-model-id',
            DEFAULT_SMART_ROUTER_CONFIG,
            contextSize
          );

          // Must be auto-routed with full-context classification
          expect(decision.isAutoRouted).toBe(true);
          expect(decision.classification).not.toBeNull();
          expect(decision.classification!.classification).toBe('full-context');

          // Reason must contain 'full-context' and confidence score
          expect(decision.reason).toContain('full-context');
          expect(decision.reason).toContain(decision.classification!.confidence.toFixed(2));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reason contains the classification tier name for all auto-routed decisions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.nat({ max: 100000 }),
        (query, contextSize) => {
          const decision = routeQuery(
            query,
            true,  // Smart Routing enabled
            true,  // Auto mode ON
            'manual-model-id',
            DEFAULT_SMART_ROUTER_CONFIG,
            contextSize
          );

          const tier = decision.classification!.classification;

          // Reason must contain the classification tier name
          expect(decision.reason.toLowerCase()).toContain(tier);
        }
      ),
      { numRuns: 200 }
    );
  });
});
