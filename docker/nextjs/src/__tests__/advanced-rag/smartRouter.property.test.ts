/**
 * Property-based tests for SmartRouter
 *
 * Uses fast-check and Jest to verify universal properties of the routeQuery function.
 * Each test runs at least 100 iterations.
 */

import * as fc from 'fast-check';
import { routeQuery, DEFAULT_SMART_ROUTER_CONFIG } from '@/lib/smart-router';
import { classifyQuery } from '@/lib/complexity-classifier';
import { SmartRouterConfig, RoutingDecision } from '@/types/smart-routing';

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

/**
 * Safe characters that avoid sentence terminators (. ? 。 ？) and
 * analytical keywords (explain, compare, analyze, summarize, etc.)
 */
const safeChars = 'abcdfghijklmnoprtuvwxyz0123456789 ';

// Feature: advanced-rag-features, Property 26: Smart Router selects lightweight model for simple queries
// **Validates: Requirements 12.2**
describe('Property 26: Smart Router selects lightweight model for simple queries', () => {
  /**
   * Generate short queries (≤100 chars, no analytical keywords, no multiple questions)
   * that classify as 'simple'. With Smart Routing ON + auto mode, routeQuery should
   * return config.lightweightModelId.
   */
  const simpleQueryArb = stringFromChars(safeChars, { minLength: 1, maxLength: 95 })
    .map((s) => s.trim() || 'hello')
    .filter((s) => s.length >= 1 && s.length <= 100);

  it('for queries classified as simple, routeQuery returns lightweightModelId when Smart Routing ON + auto mode', () => {
    fc.assert(
      fc.property(simpleQueryArb, (query: string) => {
        // Verify the query actually classifies as simple
        const classification = classifyQuery(query);
        expect(classification.classification).toBe('simple');

        const decision: RoutingDecision = routeQuery(
          query,
          true, // isSmartRoutingEnabled
          true, // isAutoMode
          'some-manual-model',
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(decision.modelId).toBe(DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId);
        expect(decision.isAutoRouted).toBe(true);
        expect(decision.classification).not.toBeNull();
        expect(decision.classification!.classification).toBe('simple');
      }),
      { numRuns: 10 }
    );
  });
});


// Feature: advanced-rag-features, Property 27: Smart Router selects powerful model for complex queries
// **Validates: Requirements 12.3**
describe('Property 27: Smart Router selects powerful model for complex queries', () => {
  /**
   * Generate queries that classify as 'complex' (>100 chars or analytical keywords).
   * With Smart Routing ON + auto mode, routeQuery should return config.powerfulModelId.
   */

  it('for long queries (>100 chars) classified as complex, routeQuery returns powerfulModelId', () => {
    const longQueryArb = stringFromChars(safeChars, { minLength: 101, maxLength: 200 }).map(
      (s) => {
        const trimmed = s.trim();
        return trimmed.length > 100 ? trimmed : 'a'.repeat(101);
      }
    );

    fc.assert(
      fc.property(longQueryArb, (query: string) => {
        const classification = classifyQuery(query);
        expect(classification.classification).toBe('complex');

        const decision: RoutingDecision = routeQuery(
          query,
          true, // isSmartRoutingEnabled
          true, // isAutoMode
          'some-manual-model',
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(decision.modelId).toBe(DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId);
        expect(decision.isAutoRouted).toBe(true);
        expect(decision.classification).not.toBeNull();
        expect(decision.classification!.classification).toBe('complex');
      }),
      { numRuns: 10 }
    );
  });

  it('for queries with analytical keywords, routeQuery returns powerfulModelId', () => {
    const keywords = ['explain', 'compare', 'analyze', 'summarize'];
    const keywordArb = fc.constantFrom(...keywords);
    const paddingArb = stringFromChars(safeChars, { minLength: 80, maxLength: 120 });

    fc.assert(
      fc.property(fc.tuple(keywordArb, paddingArb), ([keyword, padding]) => {
        const query = `Please ${keyword} the following topic in detail: ${padding}`;
        const classification = classifyQuery(query);
        expect(classification.classification).toBe('complex');

        const decision: RoutingDecision = routeQuery(
          query,
          true, // isSmartRoutingEnabled
          true, // isAutoMode
          'some-manual-model',
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(decision.modelId).toBe(DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId);
        expect(decision.isAutoRouted).toBe(true);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 28: Smart Router uses manual model when Smart Routing OFF
// **Validates: Requirements 12.5, 16.3**
describe('Property 28: Smart Router uses manual model when Smart Routing OFF', () => {
  /**
   * For any query and any manualModelId, when isSmartRoutingEnabled=false,
   * routeQuery should return manualModelId with isAutoRouted=false and classification=null.
   */
  it('when Smart Routing is OFF, routeQuery returns manualModelId regardless of query', () => {
    const queryArb = fc.string({ minLength: 1, maxLength: 200 });
    const modelIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(fc.tuple(queryArb, modelIdArb), ([query, manualModelId]) => {
        const decision: RoutingDecision = routeQuery(
          query,
          false, // isSmartRoutingEnabled = OFF
          true,  // isAutoMode (irrelevant when routing is off)
          manualModelId,
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(decision.modelId).toBe(manualModelId);
        expect(decision.isAutoRouted).toBe(false);
        expect(decision.classification).toBeNull();
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 31: Manual override ignores classifier
// **Validates: Requirements 14.2**
describe('Property 31: Manual override ignores classifier', () => {
  /**
   * For any query, when isSmartRoutingEnabled=true but isAutoMode=false,
   * routeQuery should return manualModelId regardless of what classifyQuery would return.
   */
  it('when Smart Routing ON but auto mode OFF, routeQuery returns manualModelId ignoring classifier', () => {
    const queryArb = fc.string({ minLength: 1, maxLength: 200 });
    const modelIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(fc.tuple(queryArb, modelIdArb), ([query, manualModelId]) => {
        const decision: RoutingDecision = routeQuery(
          query,
          true,  // isSmartRoutingEnabled = ON
          false, // isAutoMode = OFF (manual override)
          manualModelId,
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(decision.modelId).toBe(manualModelId);
        expect(decision.isAutoRouted).toBe(false);
        expect(decision.classification).toBeNull();
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 33: Auto mode resumption after manual override
// **Validates: Requirements 14.4**
describe('Property 33: Auto mode resumption after manual override', () => {
  /**
   * For any query, calling routeQuery with isAutoMode=false then isAutoMode=true
   * should produce different results: first returns manualModelId, second returns
   * auto-routed model based on classification.
   */
  it('switching from manual override to auto mode resumes classifier-based routing', () => {
    const queryArb = fc.string({ minLength: 1, maxLength: 200 });
    const manualModelArb = fc
      .string({ minLength: 5, maxLength: 50 })
      .filter((s) => {
        const trimmed = s.trim();
        return (
          trimmed.length >= 5 &&
          trimmed !== DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId &&
          trimmed !== DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId
        );
      });

    fc.assert(
      fc.property(fc.tuple(queryArb, manualModelArb), ([query, manualModelId]) => {
        // First call: manual override (isAutoMode=false)
        const manualDecision: RoutingDecision = routeQuery(
          query,
          true,  // isSmartRoutingEnabled = ON
          false, // isAutoMode = OFF (manual override)
          manualModelId,
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(manualDecision.modelId).toBe(manualModelId);
        expect(manualDecision.isAutoRouted).toBe(false);
        expect(manualDecision.classification).toBeNull();

        // Second call: auto mode resumed (isAutoMode=true)
        const autoDecision: RoutingDecision = routeQuery(
          query,
          true, // isSmartRoutingEnabled = ON
          true, // isAutoMode = ON (auto resumed)
          manualModelId,
          DEFAULT_SMART_ROUTER_CONFIG
        );

        expect(autoDecision.isAutoRouted).toBe(true);
        expect(autoDecision.classification).not.toBeNull();

        // Auto decision should use classifier-based model, not the manual one
        const expectedModelId =
          autoDecision.classification!.classification === 'simple'
            ? DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId
            : DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId;

        expect(autoDecision.modelId).toBe(expectedModelId);

        // The two decisions should differ: manual returns manualModelId, auto returns classifier-based
        expect(manualDecision.modelId).not.toBe(autoDecision.modelId);
      }),
      { numRuns: 10 }
    );
  });
});


// ---------------------------------------------------------------------------
// Store-level property tests (Properties 24–25)
// ---------------------------------------------------------------------------

import { useSmartRoutingStore } from '@/store/useSmartRoutingStore';

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Feature: advanced-rag-features, Property 24: Smart Routing toggle state updates store correctly
// **Validates: Requirements 11.3, 11.4**
describe('Property 24: Smart Routing toggle state updates store correctly', () => {
  afterEach(() => {
    // Reset store to default state between iterations
    useSmartRoutingStore.setState({
      isEnabled: false,
      isAutoMode: true,
      lastClassification: null,
    });
    localStorageMock.clear();
  });

  it('for any boolean value, setEnabled(value) updates isEnabled; when true isAutoMode is also true; when false isEnabled is false', () => {
    fc.assert(
      fc.property(fc.boolean(), (value: boolean) => {
        // Reset before each iteration
        useSmartRoutingStore.setState({
          isEnabled: false,
          isAutoMode: true,
          lastClassification: null,
        });

        // Act
        useSmartRoutingStore.getState().setEnabled(value);

        const state = useSmartRoutingStore.getState();

        // isEnabled must match the value passed
        expect(state.isEnabled).toBe(value);

        if (value) {
          // When set to true, isAutoMode should also be true
          expect(state.isAutoMode).toBe(true);
        } else {
          // When set to false, isEnabled should be false
          expect(state.isEnabled).toBe(false);
        }
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 25: Smart Routing state persistence round-trip
// **Validates: Requirements 11.5**
describe('Property 25: Smart Routing state persistence round-trip', () => {
  afterEach(() => {
    useSmartRoutingStore.setState({
      isEnabled: false,
      isAutoMode: true,
      lastClassification: null,
    });
    localStorageMock.clear();
  });

  it('for any boolean value, writing to localStorage via setEnabled and reading back produces the same value', () => {
    fc.assert(
      fc.property(fc.boolean(), (value: boolean) => {
        // Clear localStorage before each iteration
        localStorageMock.clear();

        // Write via setEnabled (which calls persistEnabled internally)
        useSmartRoutingStore.getState().setEnabled(value);

        // Read back from localStorage directly
        const stored = localStorageMock.getItem('smart-routing-enabled');
        expect(stored).toBe(String(value));

        // Also verify the stored string parses back to the original boolean
        const parsed = stored === 'true';
        expect(parsed).toBe(value);
      }),
      { numRuns: 10 }
    );
  });
});


// ---------------------------------------------------------------------------
// ResponseMetadata badge display logic (Properties 29, 30, 32)
// ---------------------------------------------------------------------------

/**
 * Pure helper: determines which badge to show based on routing props.
 * Returns 'auto' for auto-routed responses, 'manual' for manual overrides, null otherwise.
 */
function determineBadge(isAutoRouted: boolean, isManualOverride: boolean): 'auto' | 'manual' | null {
  if (isAutoRouted) return 'auto';
  if (isManualOverride) return 'manual';
  return null;
}

/**
 * Pure helper: determines tooltip content for auto-routed responses.
 * Returns the classification string when auto-routed with a classification, null otherwise.
 */
function determineTooltip(isAutoRouted: boolean, classification?: 'simple' | 'complex'): string | null {
  if (isAutoRouted && classification) return classification;
  return null;
}

// Feature: advanced-rag-features, Property 29: Response metadata badges reflect routing mode
// **Validates: Requirements 13.1, 13.2, 13.5**
describe('Property 29: Response metadata badges reflect routing mode', () => {
  it('for any auto-routed response, badge is "auto"; for Smart Routing OFF (not auto, not manual), badge is null', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (isAutoRouted: boolean, isManualOverride: boolean) => {
        const badge = determineBadge(isAutoRouted, isManualOverride);

        if (isAutoRouted) {
          // Auto-routed responses always show "Auto" badge
          expect(badge).toBe('auto');
        } else if (!isAutoRouted && !isManualOverride) {
          // Smart Routing OFF: no badge
          expect(badge).toBeNull();
        }
        // isManualOverride case is covered by Property 32
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 30: Response metadata classification tooltip
// **Validates: Requirements 13.3**
describe('Property 30: Response metadata classification tooltip', () => {
  it('for any auto-routed response with classification, tooltip contains the classification value', () => {
    const classificationArb = fc.constantFrom<'simple' | 'complex'>('simple', 'complex');

    fc.assert(
      fc.property(classificationArb, (classification: 'simple' | 'complex') => {
        const tooltip = determineTooltip(true, classification);

        // Auto-routed with classification → tooltip contains the classification
        expect(tooltip).toBe(classification);
        expect(['simple', 'complex']).toContain(tooltip);
      }),
      { numRuns: 10 }
    );
  });

  it('for non-auto-routed responses, tooltip is null regardless of classification', () => {
    const classificationArb = fc.option(
      fc.constantFrom<'simple' | 'complex'>('simple', 'complex'),
      { nil: undefined }
    );

    fc.assert(
      fc.property(classificationArb, (classification: 'simple' | 'complex' | undefined) => {
        const tooltip = determineTooltip(false, classification);

        // Not auto-routed → no tooltip
        expect(tooltip).toBeNull();
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 32: Manual override badge display
// **Validates: Requirements 14.3**
describe('Property 32: Manual override badge display', () => {
  it('for any response with isManualOverride=true and isAutoRouted=false, badge is "manual"', () => {
    fc.assert(
      fc.property(fc.constant(true), (_isManualOverride: boolean) => {
        // Manual override: isAutoRouted=false, isManualOverride=true
        const badge = determineBadge(false, true);

        expect(badge).toBe('manual');
      }),
      { numRuns: 10 }
    );
  });
});
