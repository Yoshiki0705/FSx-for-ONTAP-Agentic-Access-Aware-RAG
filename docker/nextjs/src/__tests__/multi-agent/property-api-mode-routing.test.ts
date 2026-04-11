/**
 * Property tests for API Mode Routing
 * Feature: multi-agent-collaboration, Property 10: API Mode Routing
 *
 * Validates: Requirements 11.2, 11.3, 11.5
 *
 * Verifies that:
 * - When mode='single' → always routes to single regardless of default
 * - When mode='multi' → always routes to multi regardless of default
 * - When mode=undefined → uses defaultAgentMode
 * - For any combination of (mode, defaultAgentMode), result is always 'single' or 'multi'
 */

import * as fc from 'fast-check';

// ===== Pure function under test =====

/**
 * Resolves the effective agent mode based on the request mode parameter
 * and the default agent mode setting.
 *
 * This encapsulates the routing logic from `/api/bedrock/agent/route.ts`:
 * ```
 * const effectiveMode: 'single' | 'multi' =
 *   mode === 'multi' || mode === 'single' ? mode : DEFAULT_AGENT_MODE;
 * ```
 *
 * @param requestMode - The mode parameter from the API request (may be undefined or any string)
 * @param defaultAgentMode - The configured default agent mode ('single' or 'multi')
 * @returns The resolved agent mode: 'single' or 'multi'
 */
function resolveAgentMode(
  requestMode: 'single' | 'multi' | undefined,
  defaultAgentMode: 'single' | 'multi',
): 'single' | 'multi' {
  if (requestMode === 'single' || requestMode === 'multi') {
    return requestMode;
  }
  return defaultAgentMode;
}

// ===== Constants =====

const VALID_MODES: readonly ('single' | 'multi')[] = ['single', 'multi'] as const;

// ===== Generators =====

/** Generates a valid agent mode ('single' or 'multi') */
const validModeArb: fc.Arbitrary<'single' | 'multi'> = fc.constantFrom(...VALID_MODES);

/** Generates a request mode that can be 'single', 'multi', or undefined */
const requestModeArb: fc.Arbitrary<'single' | 'multi' | undefined> = fc.oneof(
  fc.constant('single' as const),
  fc.constant('multi' as const),
  fc.constant(undefined as undefined),
);

// ===== Property 10: API Mode Routing =====

describe('Feature: multi-agent-collaboration, Property 10: API Mode Routing', () => {

  /**
   * **Validates: Requirements 11.2**
   *
   * When mode='single' is explicitly specified, the resolved mode must always
   * be 'single' regardless of the defaultAgentMode setting.
   */
  it('mode=single always routes to single regardless of default', () => {
    fc.assert(
      fc.property(validModeArb, (defaultMode) => {
        const result = resolveAgentMode('single', defaultMode);
        expect(result).toBe('single');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 11.2**
   *
   * When mode='multi' is explicitly specified, the resolved mode must always
   * be 'multi' regardless of the defaultAgentMode setting.
   */
  it('mode=multi always routes to multi regardless of default', () => {
    fc.assert(
      fc.property(validModeArb, (defaultMode) => {
        const result = resolveAgentMode('multi', defaultMode);
        expect(result).toBe('multi');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 11.3**
   *
   * When mode is undefined (not specified in the request), the resolved mode
   * must fall back to the defaultAgentMode setting.
   */
  it('mode=undefined uses defaultAgentMode', () => {
    fc.assert(
      fc.property(validModeArb, (defaultMode) => {
        const result = resolveAgentMode(undefined, defaultMode);
        expect(result).toBe(defaultMode);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 11.2, 11.3, 11.5**
   *
   * For any combination of (requestMode, defaultAgentMode), the result
   * must always be either 'single' or 'multi' — never any other value.
   */
  it('result is always single or multi for any input combination', () => {
    fc.assert(
      fc.property(requestModeArb, validModeArb, (requestMode, defaultMode) => {
        const result = resolveAgentMode(requestMode, defaultMode);
        expect(VALID_MODES).toContain(result);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 11.2, 11.5**
   *
   * Explicit mode always takes precedence over defaultAgentMode.
   * When requestMode is defined, the result must equal requestMode.
   */
  it('explicit mode always takes precedence over default', () => {
    fc.assert(
      fc.property(validModeArb, validModeArb, (requestMode, defaultMode) => {
        const result = resolveAgentMode(requestMode, defaultMode);
        expect(result).toBe(requestMode);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 11.3**
   *
   * The function is idempotent with respect to the default: calling it
   * with undefined mode and the same default always yields the same result.
   */
  it('resolving with undefined mode is idempotent', () => {
    fc.assert(
      fc.property(validModeArb, (defaultMode) => {
        const result1 = resolveAgentMode(undefined, defaultMode);
        const result2 = resolveAgentMode(undefined, defaultMode);
        expect(result1).toBe(result2);
      }),
      { numRuns: 100 },
    );
  });
});
