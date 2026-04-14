/**
 * Unit Tests for Guardrails Backend Logic
 *
 * Tests parseGuardrailTrace, safeGuardrailCheck, and Org Safeguards detection.
 */
import {
  parseGuardrailTrace,
  safeGuardrailCheck,
  logGuardrailIntervention,
  emitGuardrailMetrics,
  type GuardrailResult,
} from '@/lib/guardrails';

// Suppress console.log/error during tests
beforeAll(() => {
  console.log = () => {};
  console.error = () => {};
});

describe('parseGuardrailTrace', () => {
  it('returns safe for action=NONE', () => {
    const result = parseGuardrailTrace({ action: 'NONE', guardrailId: 'gr-123' });
    expect(result.status).toBe('safe');
    expect(result.action).toBe('NONE');
    expect(result.inputAssessment).toBe('PASSED');
    expect(result.outputAssessment).toBe('PASSED');
    expect(result.filteredCategories).toEqual([]);
    expect(result.guardrailId).toBe('gr-123');
  });

  it('returns blocked for GUARDRAIL_INTERVENED with input blocked', () => {
    const result = parseGuardrailTrace({
      action: 'GUARDRAIL_INTERVENED',
      guardrailId: 'gr-456',
      inputAssessments: [{
        contentPolicy: {
          filters: [{ type: 'VIOLENCE', action: 'BLOCKED' }],
        },
      }],
    });
    expect(result.status).toBe('blocked');
    expect(result.inputAssessment).toBe('BLOCKED');
    expect(result.filteredCategories).toContain('VIOLENCE');
  });

  it('returns filtered for GUARDRAIL_INTERVENED with output filtered', () => {
    const result = parseGuardrailTrace({
      action: 'GUARDRAIL_INTERVENED',
      guardrailId: 'gr-789',
      outputAssessments: [{
        contentPolicy: {
          filters: [{ type: 'HATE', action: 'BLOCKED' }],
        },
      }],
    });
    expect(result.status).toBe('filtered');
    expect(result.outputAssessment).toBe('BLOCKED');
    expect(result.filteredCategories).toContain('HATE');
  });

  it('returns error for null/undefined trace', () => {
    expect(parseGuardrailTrace(null).status).toBe('error');
    expect(parseGuardrailTrace(undefined).status).toBe('error');
    expect(parseGuardrailTrace('invalid').status).toBe('error');
  });

  it('returns error for unknown action', () => {
    const result = parseGuardrailTrace({ action: 'UNKNOWN_ACTION' });
    expect(result.status).toBe('error');
  });

  it('handles PII detection in input assessments', () => {
    const result = parseGuardrailTrace({
      action: 'GUARDRAIL_INTERVENED',
      inputAssessments: [{
        sensitiveInformationPolicy: {
          piiEntities: [{ type: 'EMAIL', action: 'ANONYMIZED' }],
        },
      }],
    });
    expect(result.filteredCategories).toContain('PII');
  });

  it('handles topic policy blocks', () => {
    const result = parseGuardrailTrace({
      action: 'GUARDRAIL_INTERVENED',
      inputAssessments: [{
        topicPolicy: {
          topics: [{ name: 'CompetitorInfo', action: 'BLOCKED' }],
        },
      }],
    });
    expect(result.filteredCategories).toContain('CompetitorInfo');
  });
});

describe('safeGuardrailCheck', () => {
  it('returns parsed result on success', async () => {
    const result = await safeGuardrailCheck(async () => ({
      action: 'NONE',
      guardrailId: 'gr-test',
    }));
    expect(result.status).toBe('safe');
  });

  it('returns error result on timeout (Fail-Open)', async () => {
    const result = await safeGuardrailCheck(async () => {
      await new Promise(resolve => setTimeout(resolve, 6000));
      return { action: 'NONE' };
    });
    expect(result.status).toBe('error');
    expect(result.inputAssessment).toBe('PASSED');
    expect(result.outputAssessment).toBe('PASSED');
  }, 10000);

  it('returns error result on API error (Fail-Open)', async () => {
    const result = await safeGuardrailCheck(async () => {
      throw new Error('500 Internal Server Error');
    });
    expect(result.status).toBe('error');
    expect(result.inputAssessment).toBe('PASSED');
    expect(result.outputAssessment).toBe('PASSED');
  });
});

describe('emitGuardrailMetrics', () => {
  it('emits passthrough=1 for safe result', () => {
    const emf = emitGuardrailMetrics({
      status: 'safe', action: 'NONE',
      inputAssessment: 'PASSED', outputAssessment: 'PASSED',
      filteredCategories: [],
    });
    expect(emf.GuardrailsPassthrough).toBe(1);
    expect(emf.GuardrailsInputBlocked).toBe(0);
    expect(emf.GuardrailsOutputFiltered).toBe(0);
  });

  it('emits inputBlocked=1 for blocked result', () => {
    const emf = emitGuardrailMetrics({
      status: 'blocked', action: 'GUARDRAIL_INTERVENED',
      inputAssessment: 'BLOCKED', outputAssessment: 'PASSED',
      filteredCategories: ['VIOLENCE'],
    });
    expect(emf.GuardrailsInputBlocked).toBe(1);
    expect(emf.GuardrailsPassthrough).toBe(0);
  });

  it('emits outputFiltered=1 for filtered result', () => {
    const emf = emitGuardrailMetrics({
      status: 'filtered', action: 'GUARDRAIL_INTERVENED',
      inputAssessment: 'PASSED', outputAssessment: 'BLOCKED',
      filteredCategories: ['HATE'],
    });
    expect(emf.GuardrailsOutputFiltered).toBe(1);
    expect(emf.GuardrailsPassthrough).toBe(0);
  });
});
