/**
 * Property tests for Cost Estimation Accuracy
 * Feature: multi-agent-collaboration, Property 11: Cost Estimation Accuracy
 *
 * Validates: Requirements 15.2, 15.3
 *
 * Verifies that:
 * - Total cost equals sum of individual collaborator costs
 * - Cost is always non-negative
 * - Cost is zero when all token counts are zero
 * - Cost scales linearly with token counts
 */

import * as fc from 'fast-check';
import {
  calculateEstimatedCost,
  type AgentTeamTraceEvent,
  type ModelPricing,
  type CollaboratorRole,
} from '@/types/multi-agent';

// ===== Constants =====

const COLLABORATOR_ROLES: CollaboratorRole[] = [
  'permission-resolver',
  'retrieval',
  'analysis',
  'output',
  'vision',
];

// ===== Generators =====

/** Generates a valid CollaboratorRole */
const collaboratorRoleArb = fc.constantFrom(...COLLABORATOR_ROLES);

/** Generates non-negative integer token counts */
const tokenCountArb = fc.nat({ max: 1_000_000 });

/** Generates a minimal AgentTeamTraceEvent with random token counts */
const traceEventArb = fc.record({
  collaboratorAgentId: fc.string({ minLength: 1, maxLength: 20 }),
  collaboratorRole: collaboratorRoleArb,
  collaboratorName: fc.string({ minLength: 1, maxLength: 30 }),
  taskDescription: fc.string({ minLength: 0, maxLength: 50 }),
  executionTimeMs: fc.nat({ max: 30_000 }),
  startTimeMs: fc.nat({ max: 100_000 }),
  inputTokens: fc.option(tokenCountArb, { nil: undefined }),
  outputTokens: fc.option(tokenCountArb, { nil: undefined }),
  accessDenied: fc.boolean(),
  status: fc.constantFrom('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED') as fc.Arbitrary<AgentTeamTraceEvent['status']>,
});

/** Generates an array of trace events (0 to 10 collaborators) */
const traceEventsArb = fc.array(traceEventArb, { minLength: 0, maxLength: 10 });

/** Generates positive model pricing */
const modelPricingArb = fc.record({
  inputPricePerToken: fc.double({ min: 0.000001, max: 0.01, noNaN: true }),
  outputPricePerToken: fc.double({ min: 0.000001, max: 0.1, noNaN: true }),
});

/** Generates a trace event with explicitly zero tokens */
const zeroTokenTraceEventArb = fc.record({
  collaboratorAgentId: fc.string({ minLength: 1, maxLength: 20 }),
  collaboratorRole: collaboratorRoleArb,
  collaboratorName: fc.string({ minLength: 1, maxLength: 30 }),
  taskDescription: fc.string({ minLength: 0, maxLength: 50 }),
  executionTimeMs: fc.nat({ max: 30_000 }),
  startTimeMs: fc.nat({ max: 100_000 }),
  inputTokens: fc.constant(0),
  outputTokens: fc.constant(0),
  accessDenied: fc.boolean(),
  status: fc.constantFrom('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED') as fc.Arbitrary<AgentTeamTraceEvent['status']>,
});

// ===== Helper =====

/** Manually compute cost for a single trace event */
function computeIndividualCost(
  trace: AgentTeamTraceEvent,
  pricing: ModelPricing,
): number {
  const inputCost = (trace.inputTokens ?? 0) * pricing.inputPricePerToken;
  const outputCost = (trace.outputTokens ?? 0) * pricing.outputPricePerToken;
  return inputCost + outputCost;
}

// ===== Property 11: Cost Estimation Accuracy =====

describe('Feature: multi-agent-collaboration, Property 11: Cost Estimation Accuracy', () => {

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * Total cost must equal the sum of each collaborator's individual cost.
   * Each collaborator cost = (inputTokens × inputPricePerToken + outputTokens × outputPricePerToken)
   */
  it('total cost equals sum of individual collaborator costs', () => {
    fc.assert(
      fc.property(traceEventsArb, modelPricingArb, (traces, pricing) => {
        const totalCost = calculateEstimatedCost(
          traces as AgentTeamTraceEvent[],
          pricing,
        );
        const expectedSum = traces.reduce(
          (sum, trace) => sum + computeIndividualCost(trace as AgentTeamTraceEvent, pricing),
          0,
        );
        expect(totalCost).toBeCloseTo(expectedSum, 10);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * Cost must always be non-negative for any set of non-negative token counts
   * and non-negative pricing.
   */
  it('cost is always non-negative', () => {
    fc.assert(
      fc.property(traceEventsArb, modelPricingArb, (traces, pricing) => {
        const totalCost = calculateEstimatedCost(
          traces as AgentTeamTraceEvent[],
          pricing,
        );
        expect(totalCost).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * When all token counts are zero, total cost must be zero regardless of pricing.
   */
  it('cost is zero when all token counts are zero', () => {
    fc.assert(
      fc.property(
        fc.array(zeroTokenTraceEventArb, { minLength: 0, maxLength: 10 }),
        modelPricingArb,
        (traces, pricing) => {
          const totalCost = calculateEstimatedCost(
            traces as AgentTeamTraceEvent[],
            pricing,
          );
          expect(totalCost).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * Cost scales linearly: doubling all token counts should double the total cost.
   */
  it('cost scales linearly with token counts', () => {
    fc.assert(
      fc.property(traceEventsArb, modelPricingArb, (traces, pricing) => {
        const originalCost = calculateEstimatedCost(
          traces as AgentTeamTraceEvent[],
          pricing,
        );

        // Double all token counts
        const doubledTraces = traces.map((t) => ({
          ...t,
          inputTokens: t.inputTokens != null ? t.inputTokens * 2 : undefined,
          outputTokens: t.outputTokens != null ? t.outputTokens * 2 : undefined,
        }));

        const doubledCost = calculateEstimatedCost(
          doubledTraces as AgentTeamTraceEvent[],
          pricing,
        );

        expect(doubledCost).toBeCloseTo(originalCost * 2, 10);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * Empty trace array should produce zero cost.
   */
  it('empty trace array produces zero cost', () => {
    fc.assert(
      fc.property(modelPricingArb, (pricing) => {
        const totalCost = calculateEstimatedCost([], pricing);
        expect(totalCost).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * Traces with undefined token counts should be treated as zero tokens.
   */
  it('undefined token counts are treated as zero', () => {
    const traceWithUndefinedTokens: AgentTeamTraceEvent = {
      collaboratorAgentId: 'agent-1',
      collaboratorRole: 'analysis',
      collaboratorName: 'Analysis Agent',
      taskDescription: 'test',
      executionTimeMs: 100,
      startTimeMs: 0,
      inputTokens: undefined,
      outputTokens: undefined,
      accessDenied: false,
      status: 'COMPLETED',
    };

    fc.assert(
      fc.property(modelPricingArb, (pricing) => {
        const cost = calculateEstimatedCost([traceWithUndefinedTokens], pricing);
        expect(cost).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
