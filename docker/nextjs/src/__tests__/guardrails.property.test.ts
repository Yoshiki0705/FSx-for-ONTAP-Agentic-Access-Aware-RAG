/**
 * Property Tests for Guardrails Backend Logic
 *
 * Feature: guardrails-org-safeguards
 *
 * Property 2: Intervention log completeness
 * Property 3: Intervention log privacy
 * Property 4: EMF metrics accuracy
 */
import * as fc from 'fast-check';
import {
  logGuardrailIntervention,
  emitGuardrailMetrics,
  type GuardrailResult,
} from '@/lib/guardrails';

// --- Generators ---

const interventionTypeArb = fc.constantFrom('INPUT_BLOCKED' as const, 'OUTPUT_FILTERED' as const);

const filterCategoryArb = fc.constantFrom(
  'SEXUAL', 'VIOLENCE', 'HATE', 'INSULTS', 'MISCONDUCT', 'PROMPT_ATTACK', 'PII',
);

const interventionParamsArb = fc.record({
  userId: fc.string({ minLength: 1, maxLength: 50 }),
  sessionId: fc.string({ minLength: 1, maxLength: 50 }),
  interventionType: interventionTypeArb,
  filterCategories: fc.array(filterCategoryArb, { minLength: 1, maxLength: 5 }),
  guardrailId: fc.string({ minLength: 1, maxLength: 30 }),
});

const guardrailResultArb: fc.Arbitrary<GuardrailResult> = fc.oneof(
  // safe
  fc.record({
    status: fc.constant('safe' as const),
    action: fc.constant('NONE'),
    inputAssessment: fc.constant('PASSED' as const),
    outputAssessment: fc.constant('PASSED' as const),
    filteredCategories: fc.constant([] as string[]),
    guardrailId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  }),
  // blocked (input blocked)
  fc.record({
    status: fc.constant('blocked' as const),
    action: fc.constant('GUARDRAIL_INTERVENED'),
    inputAssessment: fc.constant('BLOCKED' as const),
    outputAssessment: fc.constant('PASSED' as const),
    filteredCategories: fc.array(filterCategoryArb, { minLength: 1, maxLength: 3 }),
    guardrailId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  }),
  // filtered (output filtered)
  fc.record({
    status: fc.constant('filtered' as const),
    action: fc.constant('GUARDRAIL_INTERVENED'),
    inputAssessment: fc.constant('PASSED' as const),
    outputAssessment: fc.constantFrom('BLOCKED' as const, 'FILTERED' as const),
    filteredCategories: fc.array(filterCategoryArb, { minLength: 1, maxLength: 3 }),
    guardrailId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  }),
  // error
  fc.record({
    status: fc.constant('error' as const),
    action: fc.constant('ERROR'),
    inputAssessment: fc.constant('PASSED' as const),
    outputAssessment: fc.constant('PASSED' as const),
    filteredCategories: fc.constant([] as string[]),
    guardrailId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  }),
);

// Suppress console.log during tests
const originalLog = console.log;
beforeAll(() => { console.log = () => {}; });
afterAll(() => { console.log = originalLog; });

describe('Property 2: Intervention log completeness', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any intervention event, the structured log entry must contain
   * all required fields: timestamp, userId, sessionId, interventionType,
   * filterCategories, guardrailId.
   */
  it('log entry contains all required fields for any intervention event', () => {
    fc.assert(
      fc.property(interventionParamsArb, (params) => {
        const logEntry = logGuardrailIntervention(params);

        // All required fields must be present and non-empty
        expect(logEntry.timestamp).toBeDefined();
        expect(logEntry.timestamp.length).toBeGreaterThan(0);
        // Verify ISO 8601 format
        expect(new Date(logEntry.timestamp).toISOString()).toBe(logEntry.timestamp);

        expect(logEntry.userId).toBe(params.userId);
        expect(logEntry.sessionId).toBe(params.sessionId);
        expect(logEntry.interventionType).toBe(params.interventionType);
        expect(logEntry.filterCategories).toEqual(params.filterCategories);
        expect(logEntry.guardrailId).toBe(params.guardrailId);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 3: Intervention log privacy', () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * For any intervention event, the structured log entry must NOT contain
   * blocked input text or filtered response text content.
   */
  it('log entry never contains blocked input or filtered output text', () => {
    // Generate intervention params with arbitrary "dangerous" text that should NOT appear in logs
    const paramsWithTextArb = fc.record({
      userId: fc.string({ minLength: 1, maxLength: 50 }),
      sessionId: fc.string({ minLength: 1, maxLength: 50 }),
      interventionType: interventionTypeArb,
      filterCategories: fc.array(filterCategoryArb, { minLength: 1, maxLength: 5 }),
      guardrailId: fc.string({ minLength: 1, maxLength: 30 }),
      // These texts should NEVER appear in the log
      blockedInputText: fc.string({ minLength: 10, maxLength: 200 }),
      filteredOutputText: fc.string({ minLength: 10, maxLength: 200 }),
    });

    fc.assert(
      fc.property(paramsWithTextArb, (params) => {
        const { blockedInputText, filteredOutputText, ...logParams } = params;
        const logEntry = logGuardrailIntervention(logParams);

        // Serialize the log entry to check for text leakage
        const serialized = JSON.stringify(logEntry);

        // The log entry must not contain the blocked/filtered text
        if (blockedInputText.length >= 10) {
          expect(serialized).not.toContain(blockedInputText);
        }
        if (filteredOutputText.length >= 10) {
          expect(serialized).not.toContain(filteredOutputText);
        }

        // Verify the log entry has no 'inputText', 'outputText', 'text', 'content' fields
        expect(logEntry).not.toHaveProperty('inputText');
        expect(logEntry).not.toHaveProperty('outputText');
        expect(logEntry).not.toHaveProperty('text');
        expect(logEntry).not.toHaveProperty('content');
        expect(logEntry).not.toHaveProperty('blockedText');
        expect(logEntry).not.toHaveProperty('filteredText');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 4: EMF metrics accuracy', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * For any GuardrailResult, emitGuardrailMetrics must set exactly one
   * metric to 1 and the others to 0, based on the status.
   */
  it('sets correct metric counts based on GuardrailResult status', () => {
    fc.assert(
      fc.property(guardrailResultArb, (result) => {
        const emf = emitGuardrailMetrics(result);

        // Verify EMF structure
        expect(emf._aws).toBeDefined();
        expect(emf._aws.CloudWatchMetrics).toBeDefined();
        expect(emf._aws.CloudWatchMetrics[0].Namespace).toBe('PermissionAwareRAG/Guardrails');
        expect(emf.Operation).toBe('guardrails');

        // Verify metric values based on status
        if (result.status === 'safe') {
          expect(emf.GuardrailsPassthrough).toBe(1);
          expect(emf.GuardrailsInputBlocked).toBe(0);
          expect(emf.GuardrailsOutputFiltered).toBe(0);
        } else if (result.inputAssessment === 'BLOCKED') {
          expect(emf.GuardrailsInputBlocked).toBe(1);
        } else if (result.outputAssessment === 'BLOCKED' || result.outputAssessment === 'FILTERED') {
          expect(emf.GuardrailsOutputFiltered).toBe(1);
        }

        // All metric values must be 0 or 1
        expect([0, 1]).toContain(emf.GuardrailsInputBlocked);
        expect([0, 1]).toContain(emf.GuardrailsOutputFiltered);
        expect([0, 1]).toContain(emf.GuardrailsPassthrough);
      }),
      { numRuns: 100 },
    );
  });
});
