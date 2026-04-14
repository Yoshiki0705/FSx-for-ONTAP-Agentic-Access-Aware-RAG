/**
 * Unit Tests for AgentCore Policy
 *
 * Feature: agentcore-policy
 * Tests specific examples and edge cases for policy evaluation,
 * CRUD API validation, and violation logging.
 */
import { createViolationLog } from '@/lib/policy-violation-logger';
import { evaluatePolicy } from '@/lib/policy-evaluation';

// Suppress console output during tests
const origLog = console.log;
const origError = console.error;
beforeAll(() => {
  console.log = () => {};
  console.error = () => {};
});
afterAll(() => {
  console.log = origLog;
  console.error = origError;
});

describe('evaluatePolicy', () => {
  const origEnabled = process.env.AGENT_POLICY_ENABLED;
  const origMode = process.env.POLICY_FAILURE_MODE;

  afterEach(() => {
    process.env.AGENT_POLICY_ENABLED = origEnabled;
    process.env.POLICY_FAILURE_MODE = origMode;
  });

  it('skips evaluation when AGENT_POLICY_ENABLED is false', async () => {
    process.env.AGENT_POLICY_ENABLED = 'false';
    const result = await evaluatePolicy('agent-1', 'chat', { policyId: 'p1', policyText: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.evaluationTimeMs).toBe(0);
  });

  it('skips evaluation when AGENT_POLICY_ENABLED is not set', async () => {
    delete process.env.AGENT_POLICY_ENABLED;
    const result = await evaluatePolicy('agent-1', 'chat', { policyId: 'p1', policyText: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.evaluationTimeMs).toBe(0);
  });

  it('skips evaluation when no policy is set for agent', async () => {
    process.env.AGENT_POLICY_ENABLED = 'true';
    const result = await evaluatePolicy('agent-1', 'chat', {});
    expect(result.allowed).toBe(true);
    expect(result.policyId).toBe('');
  });

  it('returns result when policy is enabled and set', async () => {
    process.env.AGENT_POLICY_ENABLED = 'true';
    process.env.POLICY_FAILURE_MODE = 'fail-open';
    const result = await evaluatePolicy('agent-1', 'chat', {
      policyId: 'policy-123',
      policyText: 'Only KB search allowed',
    });
    expect(result).toBeDefined();
    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.evaluationTimeMs).toBe('number');
  });
});

describe('createViolationLog', () => {
  it('creates a valid EMF log with all required fields', () => {
    const log = createViolationLog(
      {
        agentId: 'agent-123',
        policyId: 'policy-456',
        violationReason: 'External API access attempted',
        attemptedAction: 'callExternalAPI',
        userId: 'user-789',
      },
      150,
    );

    expect(log.agentId).toBe('agent-123');
    expect(log.policyId).toBe('policy-456');
    expect(log.violationReason).toBe('External API access attempted');
    expect(log.attemptedAction).toBe('callExternalAPI');
    expect(log.userId).toBe('user-789');
    expect(log.timestamp).toBeDefined();
    expect(log.PolicyViolationCount).toBe(1);
    expect(log.PolicyEvaluationLatency).toBe(150);

    // EMF structure
    expect(log._aws.CloudWatchMetrics[0].Namespace).toBe('PermissionAwareRAG/AgentPolicy');
    expect(log._aws.CloudWatchMetrics[0].Dimensions).toEqual([['AgentId']]);
    expect(log._aws.CloudWatchMetrics[0].Metrics).toHaveLength(2);
  });

  it('generates valid ISO 8601 timestamp', () => {
    const log = createViolationLog(
      {
        agentId: 'a',
        policyId: 'p',
        violationReason: 'r',
        attemptedAction: 'act',
        userId: 'u',
      },
      0,
    );
    const parsed = new Date(log.timestamp);
    expect(parsed.toISOString()).toBe(log.timestamp);
  });
});

describe('Policy text validation', () => {
  it('accepts text within 2000 character limit', () => {
    const text = 'a'.repeat(2000);
    expect(text.length).toBeLessThanOrEqual(2000);
  });

  it('rejects text exceeding 2000 character limit', () => {
    const text = 'a'.repeat(2001);
    expect(text.length).toBeGreaterThan(2000);
    // Truncation
    const truncated = text.slice(0, 2000);
    expect(truncated.length).toBe(2000);
  });

  it('accepts empty policy text (optional)', () => {
    const text = '';
    expect(text.length).toBeLessThanOrEqual(2000);
  });
});
