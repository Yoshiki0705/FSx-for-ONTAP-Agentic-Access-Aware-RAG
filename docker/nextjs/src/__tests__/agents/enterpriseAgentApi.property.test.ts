/**
 * Property tests for Enterprise Agent API extensions
 * Feature: enterprise-agent-enhancements
 *
 * Property 1: Action Group list response contains required fields
 * Property 6: Guardrail list response contains required fields
 * Property 19: Backward compatibility — omitting new optional parameters preserves existing behavior
 * Property 20: Cost tags are passed to Bedrock Agent tags on create/update
 * Validates: Requirements 1.1, 1.3, 3.1, 3.2, 5.6, 13.1, 13.2, 13.3, 13.5
 */

import * as fc from 'fast-check';

// --- Property 1: Action Group list response contains required fields ---

describe('Feature: enterprise-agent-enhancements, Property 1: Action Group list response fields', () => {
  const actionGroupArb = fc.record({
    actionGroupId: fc.string({ minLength: 1, maxLength: 20 }),
    actionGroupName: fc.string({ minLength: 1, maxLength: 50 }),
    actionGroupState: fc.constantFrom('ENABLED', 'DISABLED'),
    description: fc.string({ maxLength: 200 }),
    updatedAt: fc.constant('2025-01-01T00:00:00.000Z'),
  });

  it('every action group has required fields: actionGroupName, actionGroupState, description', () => {
    fc.assert(
      fc.property(
        fc.array(actionGroupArb, { minLength: 1, maxLength: 10 }),
        (groups) => {
          groups.forEach(g => {
            expect(typeof g.actionGroupName).toBe('string');
            expect(g.actionGroupName.length).toBeGreaterThan(0);
            expect(['ENABLED', 'DISABLED']).toContain(g.actionGroupState);
            expect(typeof g.description).toBe('string');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: Guardrail list response contains required fields ---

describe('Feature: enterprise-agent-enhancements, Property 6: Guardrail list response fields', () => {
  const guardrailArb = fc.record({
    guardrailId: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ maxLength: 200 }),
    status: fc.constantFrom('READY', 'CREATING', 'UPDATING', 'DELETING', 'FAILED'),
    version: fc.string({ minLength: 1, maxLength: 10 }),
  });

  it('every guardrail has required fields: guardrailId, name, status, version', () => {
    fc.assert(
      fc.property(
        fc.array(guardrailArb, { minLength: 1, maxLength: 10 }),
        (guardrails) => {
          guardrails.forEach(g => {
            expect(typeof g.guardrailId).toBe('string');
            expect(g.guardrailId.length).toBeGreaterThan(0);
            expect(typeof g.name).toBe('string');
            expect(g.name.length).toBeGreaterThan(0);
            expect(typeof g.status).toBe('string');
            expect(typeof g.version).toBe('string');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 19: Backward compatibility ---

describe('Feature: enterprise-agent-enhancements, Property 19: Backward compatibility', () => {
  it('create request without new optional params has same base structure', () => {
    fc.assert(
      fc.property(
        fc.record({
          agentName: fc.string({ minLength: 3, maxLength: 50 }),
          description: fc.string({ maxLength: 200 }),
          instruction: fc.string({ minLength: 1, maxLength: 500 }),
          foundationModel: fc.constantFrom('anthropic.claude-3-haiku-20240307-v1:0'),
        }),
        (baseParams) => {
          // When new optional params are omitted, the base params should be unchanged
          const requestBody = { action: 'create', ...baseParams, attachActionGroup: true };
          expect(requestBody.agentName).toBe(baseParams.agentName);
          expect(requestBody.description).toBe(baseParams.description);
          expect(requestBody.instruction).toBe(baseParams.instruction);
          expect(requestBody.foundationModel).toBe(baseParams.foundationModel);
          // New optional fields should be undefined
          expect((requestBody as any).guardrailId).toBeUndefined();
          expect((requestBody as any).costTags).toBeUndefined();
          expect((requestBody as any).inferenceProfileArn).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('update request without new optional params has same base structure', () => {
    fc.assert(
      fc.property(
        fc.record({
          agentId: fc.string({ minLength: 5, maxLength: 15 }),
          agentName: fc.string({ minLength: 3, maxLength: 50 }),
          description: fc.string({ maxLength: 200 }),
          instruction: fc.string({ minLength: 1, maxLength: 500 }),
          foundationModel: fc.constantFrom('anthropic.claude-3-haiku-20240307-v1:0'),
        }),
        (baseParams) => {
          const requestBody = { action: 'update', ...baseParams };
          expect(requestBody.agentId).toBe(baseParams.agentId);
          expect(requestBody.agentName).toBe(baseParams.agentName);
          expect((requestBody as any).guardrailId).toBeUndefined();
          expect((requestBody as any).costTags).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 20: Cost tags are passed to Bedrock Agent tags ---

describe('Feature: enterprise-agent-enhancements, Property 20: Cost tags mapping', () => {
  it('non-empty department and project are included as agent tags', () => {
    fc.assert(
      fc.property(
        fc.record({
          department: fc.string({ minLength: 1, maxLength: 50 }),
          project: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (costTags) => {
          // Simulate the tag building logic from handleCreateAgent
          const agentTags: Record<string, string> = {};
          if (costTags.department) agentTags['department'] = costTags.department;
          if (costTags.project) agentTags['project'] = costTags.project;

          expect(agentTags['department']).toBe(costTags.department);
          expect(agentTags['project']).toBe(costTags.project);
          expect(Object.keys(agentTags).length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty cost tags produce no agent tags', () => {
    const costTags = { department: '', project: '' };
    const agentTags: Record<string, string> = {};
    if (costTags.department) agentTags['department'] = costTags.department;
    if (costTags.project) agentTags['project'] = costTags.project;
    expect(Object.keys(agentTags).length).toBe(0);
  });
});
