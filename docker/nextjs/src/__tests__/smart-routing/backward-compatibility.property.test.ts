/**
 * Property Tests: Backward Compatibility (Properties 10, 11)
 *
 * Property 10: Default Threshold Behavior
 * - Query with Document_Analysis_Intent keywords + context 4001 chars + no explicit threshold
 *   → classified as 'full-context' (using the default threshold of 4000)
 *
 * Property 11: Backward Compatibility of 2-Tier Routing
 * - Queries not meeting full-context criteria route to lightweightModelId or powerfulModelId only
 *
 * **Validates: Requirements 10.2, 10.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyQuery } from '@/lib/complexity-classifier';
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
 * Arbitrary: generates a query string that contains at least one intent keyword.
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

/** Default threshold value */
const DEFAULT_THRESHOLD = 4000;

describe('Property 10: Default Threshold Behavior', () => {
  // **Validates: Requirements 10.2**

  it('query with intent keyword + context 4001 chars + no explicit threshold → classified as full-context', () => {
    fc.assert(
      fc.property(queryWithIntentKeyword, (query) => {
        // contextSize = 4001, no explicit threshold (uses default 4000)
        const result = classifyQuery(query, 4001);
        expect(result.classification).toBe('full-context');
      }),
      { numRuns: 200 }
    );
  });

  it('query with intent keyword + context exactly at default threshold (4000) → NOT full-context', () => {
    fc.assert(
      fc.property(queryWithIntentKeyword, (query) => {
        // contextSize = 4000, exactly at threshold (not exceeding)
        const result = classifyQuery(query, DEFAULT_THRESHOLD);
        expect(result.classification).not.toBe('full-context');
      }),
      { numRuns: 200 }
    );
  });

  it('query with intent keyword + context above default threshold → full-context (various sizes above 4000)', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: 4001, max: 100000 }),
        (query, contextSize) => {
          // No explicit threshold parameter → uses default 4000
          const result = classifyQuery(query, contextSize);
          expect(result.classification).toBe('full-context');
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property 11: Backward Compatibility of 2-Tier Routing', () => {
  // **Validates: Requirements 10.3**

  it('queries without intent keywords route to lightweightModelId or powerfulModelId only', () => {
    fc.assert(
      fc.property(
        queryWithoutIntentKeyword,
        fc.integer({ min: 0, max: 100000 }),
        (query, contextSize) => {
          const config: SmartRouterConfig = {
            lightweightModelId: DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId,
            powerfulModelId: DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId,
            heavyModelId: DEFAULT_SMART_ROUTER_CONFIG.heavyModelId,
            contextSizeThreshold: DEFAULT_SMART_ROUTER_CONFIG.contextSizeThreshold,
          };

          const decision = routeQuery(
            query,
            true, // Smart Routing enabled
            true, // Auto mode
            'manual-model-id',
            config,
            contextSize
          );

          // Should only route to lightweight or powerful, never heavy
          expect([config.lightweightModelId, config.powerfulModelId]).toContain(
            decision.modelId
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it('queries with intent keywords but context ≤ threshold route to lightweightModelId or powerfulModelId only', () => {
    fc.assert(
      fc.property(
        queryWithIntentKeyword,
        fc.integer({ min: 0, max: DEFAULT_THRESHOLD }),
        (query, contextSize) => {
          const config: SmartRouterConfig = {
            lightweightModelId: DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId,
            powerfulModelId: DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId,
            heavyModelId: DEFAULT_SMART_ROUTER_CONFIG.heavyModelId,
            contextSizeThreshold: DEFAULT_SMART_ROUTER_CONFIG.contextSizeThreshold,
          };

          const decision = routeQuery(
            query,
            true, // Smart Routing enabled
            true, // Auto mode
            'manual-model-id',
            config,
            contextSize
          );

          // Should only route to lightweight or powerful, never heavy
          expect([config.lightweightModelId, config.powerfulModelId]).toContain(
            decision.modelId
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it('2-tier routing preserves simple → lightweight mapping', () => {
    fc.assert(
      fc.property(
        queryWithoutIntentKeyword,
        fc.integer({ min: 0, max: 100000 }),
        (query, contextSize) => {
          const config: SmartRouterConfig = {
            lightweightModelId: DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId,
            powerfulModelId: DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId,
            heavyModelId: DEFAULT_SMART_ROUTER_CONFIG.heavyModelId,
            contextSizeThreshold: DEFAULT_SMART_ROUTER_CONFIG.contextSizeThreshold,
          };

          const decision = routeQuery(
            query,
            true,
            true,
            'manual-model-id',
            config,
            contextSize
          );

          // If classified as simple, must route to lightweight
          if (decision.classification?.classification === 'simple') {
            expect(decision.modelId).toBe(config.lightweightModelId);
          }
          // If classified as complex, must route to powerful
          if (decision.classification?.classification === 'complex') {
            expect(decision.modelId).toBe(config.powerfulModelId);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('non-full-context queries never route to heavyModelId', () => {
    fc.assert(
      fc.property(
        queryWithoutIntentKeyword,
        fc.integer({ min: 0, max: 100000 }),
        (query, contextSize) => {
          const config: SmartRouterConfig = {
            lightweightModelId: 'lightweight-model',
            powerfulModelId: 'powerful-model',
            heavyModelId: 'heavy-model',
            contextSizeThreshold: DEFAULT_THRESHOLD,
          };

          const decision = routeQuery(
            query,
            true,
            true,
            'manual-model-id',
            config,
            contextSize
          );

          expect(decision.modelId).not.toBe('heavy-model');
        }
      ),
      { numRuns: 200 }
    );
  });
});
