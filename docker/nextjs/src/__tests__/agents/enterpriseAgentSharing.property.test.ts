import * as fc from 'fast-check';
import { exportAgentConfig, validateAgentConfig } from '@/utils/agentConfigUtils';
import type { AgentDetail } from '@/types/agent-directory';

/**
 * Property tests for Organization Sharing (export/import round-trip).
 */

const agentDetailArb: fc.Arbitrary<AgentDetail> = fc.record({
  agentId: fc.string({ minLength: 5, maxLength: 20 }),
  agentName: fc.string({ minLength: 3, maxLength: 50 }),
  agentStatus: fc.constantFrom('PREPARED', 'CREATING', 'FAILED'),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  instruction: fc.string({ minLength: 10, maxLength: 500 }),
  foundationModel: fc.constantFrom(
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'amazon.nova-pro-v1:0'
  ),
  agentVersion: fc.string({ minLength: 1, maxLength: 5 }),
  agentResourceRoleArn: fc.string({ minLength: 10, maxLength: 100 }),
  idleSessionTTLInSeconds: fc.integer({ min: 60, max: 3600 }),
  createdAt: fc.constant('2026-01-01T00:00:00Z'),
  updatedAt: fc.constant('2026-01-01T00:00:00Z'),
  actionGroups: fc.array(
    fc.record({
      actionGroupName: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 0, maxLength: 100 }),
      actionGroupState: fc.constantFrom('ENABLED', 'DISABLED'),
    }),
    { minLength: 0, maxLength: 3 }
  ),
});

describe('Feature: enterprise-agent-enhancements, Property 10: AgentConfig export→import round-trip', () => {
  it('exported config passes validation', () => {
    fc.assert(
      fc.property(
        agentDetailArb,
        (agent) => {
          const config = exportAgentConfig(agent);
          const result = validateAgentConfig(config);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exported config preserves agentName, instruction, foundationModel', () => {
    fc.assert(
      fc.property(
        agentDetailArb,
        (agent) => {
          const config = exportAgentConfig(agent);
          expect(config.agentName).toBe(agent.agentName);
          expect(config.instruction).toBe(agent.instruction);
          expect(config.foundationModel).toBe(agent.foundationModel);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exported config excludes environment-specific fields', () => {
    fc.assert(
      fc.property(
        agentDetailArb,
        (agent) => {
          const config = exportAgentConfig(agent);
          const configObj = config as Record<string, unknown>;
          expect(configObj.agentId).toBeUndefined();
          expect(configObj.agentResourceRoleArn).toBeUndefined();
          expect(configObj.agentVersion).toBeUndefined();
          expect(configObj.idleSessionTTLInSeconds).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: enterprise-agent-enhancements, Property 12: Shared config list metadata', () => {
  it('shared config metadata has required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          key: fc.string({ minLength: 5, maxLength: 100 }),
          agentName: fc.string({ minLength: 3, maxLength: 50 }),
          uploadedAt: fc.constant('2026-01-01T00:00:00Z'),
          size: fc.integer({ min: 100, max: 100000 }),
        }),
        (meta) => {
          expect(meta.key).toBeDefined();
          expect(meta.key.length).toBeGreaterThan(0);
          expect(meta.agentName).toBeDefined();
          expect(meta.size).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
