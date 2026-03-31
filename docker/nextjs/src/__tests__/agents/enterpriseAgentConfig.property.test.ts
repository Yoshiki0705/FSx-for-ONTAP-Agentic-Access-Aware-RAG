/**
 * Property tests for AgentConfig validation and export
 * Feature: enterprise-agent-enhancements
 *
 * Property 9: AgentConfig export contains required fields and excludes environment-specific fields
 * Property 11: AgentConfig JSON validation rejects invalid schemas
 * Property 14: Cron expression validation accepts valid and rejects invalid expressions
 * Validates: Requirements 6.3, 6.4, 6.5, 7.5, 9.4, 9.6
 */

import * as fc from 'fast-check';
import { validateAgentConfig, exportAgentConfig, validateCronExpression, hasExcludedFields } from '@/utils/agentConfigUtils';
import type { AgentDetail } from '@/types/agent-directory';

// --- Generators ---

const agentDetailArb: fc.Arbitrary<AgentDetail> = fc.record({
  agentId: fc.string({ minLength: 5, maxLength: 15 }),
  agentName: fc.string({ minLength: 3, maxLength: 50 }),
  agentStatus: fc.constantFrom('PREPARED', 'CREATING', 'FAILED'),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  instruction: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  foundationModel: fc.option(fc.constantFrom(
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'amazon.nova-pro-v1:0'
  ), { nil: undefined }),
  agentVersion: fc.option(fc.string({ minLength: 1, maxLength: 5 }), { nil: undefined }),
  createdAt: fc.option(fc.constant('2025-01-01T00:00:00.000Z'), { nil: undefined }),
  updatedAt: fc.option(fc.constant('2025-06-01T00:00:00.000Z'), { nil: undefined }),
  agentResourceRoleArn: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  idleSessionTTLInSeconds: fc.option(fc.integer({ min: 60, max: 3600 }), { nil: undefined }),
  actionGroups: fc.option(
    fc.array(fc.record({
      actionGroupId: fc.string({ minLength: 3, maxLength: 15 }),
      actionGroupName: fc.string({ minLength: 1, maxLength: 30 }),
      actionGroupState: fc.constantFrom('ENABLED', 'DISABLED'),
      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    }), { minLength: 0, maxLength: 3 }),
    { nil: undefined }
  ),
});

const validAgentConfigArb = fc.record({
  schemaVersion: fc.constant('1.0' as const),
  agentName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  description: fc.string({ maxLength: 200 }),
  instruction: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
  foundationModel: fc.constantFrom(
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'amazon.nova-pro-v1:0'
  ),
  actionGroups: fc.array(fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ maxLength: 200 }),
  }), { maxLength: 3 }),
  exportedAt: fc.constant('2025-01-01T00:00:00.000Z'),
});

// --- Property 9: AgentConfig export contains required fields and excludes environment-specific fields ---

describe('Feature: enterprise-agent-enhancements, Property 9: AgentConfig export', () => {
  it('exported config contains schemaVersion, agentName, description, instruction, foundationModel, actionGroups, exportedAt', () => {
    fc.assert(
      fc.property(agentDetailArb, (agent) => {
        const config = exportAgentConfig(agent);
        expect(config.schemaVersion).toBe('1.0');
        expect(config.agentName).toBe(agent.agentName);
        expect(typeof config.description).toBe('string');
        expect(typeof config.instruction).toBe('string');
        expect(typeof config.foundationModel).toBe('string');
        expect(Array.isArray(config.actionGroups)).toBe(true);
        expect(typeof config.exportedAt).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('exported config does NOT contain agentId, agentResourceRoleArn, agentVersion, idleSessionTTLInSeconds', () => {
    fc.assert(
      fc.property(agentDetailArb, (agent) => {
        const config = exportAgentConfig(agent) as Record<string, unknown>;
        expect(hasExcludedFields(config)).toBe(false);
        expect('agentId' in config).toBe(false);
        expect('agentResourceRoleArn' in config).toBe(false);
        expect('agentVersion' in config).toBe(false);
        expect('idleSessionTTLInSeconds' in config).toBe(false);
        expect('agentStatus' in config).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 11: AgentConfig JSON validation rejects invalid schemas ---

describe('Feature: enterprise-agent-enhancements, Property 11: AgentConfig validation', () => {
  it('valid AgentConfig passes validation', () => {
    fc.assert(
      fc.property(validAgentConfigArb, (config) => {
        const result = validateAgentConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects objects missing required fields', () => {
    const requiredFields = ['schemaVersion', 'agentName', 'instruction', 'foundationModel'];
    fc.assert(
      fc.property(
        validAgentConfigArb,
        fc.constantFrom(...requiredFields),
        (config, fieldToRemove) => {
          const incomplete = { ...config } as Record<string, unknown>;
          delete incomplete[fieldToRemove];
          const result = validateAgentConfig(incomplete);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes(fieldToRemove))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects non-object inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.string(), fc.integer(), fc.constant([])),
        (input) => {
          const result = validateAgentConfig(input);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects incompatible schema versions', () => {
    fc.assert(
      fc.property(
        validAgentConfigArb,
        fc.string({ minLength: 1, maxLength: 5 }).filter(s => s !== '1.0'),
        (config, badVersion) => {
          const modified = { ...config, schemaVersion: badVersion };
          const result = validateAgentConfig(modified);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('schema version') || e.includes('Incompatible'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 14: Cron expression validation ---

describe('Feature: enterprise-agent-enhancements, Property 14: Cron expression validation', () => {
  it('accepts valid EventBridge cron expressions', () => {
    const validCrons = [
      'cron(0 12 * * ? *)',
      'cron(15 10 ? * MON *)',
      'cron(0 8 1 * ? 2025)',
      'cron(30 9 ? * MON,WED,FRI *)',
      'cron(0 0 * * ? *)',
    ];
    for (const cron of validCrons) {
      expect(validateCronExpression(cron)).toBe(true);
    }
  });

  it('rejects invalid cron expressions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.startsWith('cron(')),
        (expr) => {
          expect(validateCronExpression(expr)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects cron with wrong number of fields', () => {
    const badCrons = [
      'cron(0 12 * *)',
      'cron(0 12 * * ? * extra)',
      'cron()',
      'cron(0)',
    ];
    for (const cron of badCrons) {
      expect(validateCronExpression(cron)).toBe(false);
    }
  });

  it('rejects null, undefined, and empty strings', () => {
    expect(validateCronExpression('')).toBe(false);
    expect(validateCronExpression(null as any)).toBe(false);
    expect(validateCronExpression(undefined as any)).toBe(false);
  });
});
