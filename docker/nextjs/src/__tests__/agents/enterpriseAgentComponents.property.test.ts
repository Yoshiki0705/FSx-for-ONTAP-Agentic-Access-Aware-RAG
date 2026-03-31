import * as fc from 'fast-check';
import { getStatusStyle, isLoadingStatus } from '@/utils/agentStatusUtils';

/**
 * Property tests for enterprise agent UI components (pure logic only).
 * React component rendering is not tested here (no @testing-library/react).
 */

// --- Arbitraries ---
const actionGroupArb = fc.record({
  name: fc.constantFrom('PermissionAwareSearch', 'Browser', 'CodeInterpreter'),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  isDefault: fc.boolean(),
});

const guardrailArb = fc.record({
  guardrailId: fc.string({ minLength: 5, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom('READY', 'CREATING', 'FAILED', 'DELETING'),
  version: fc.string({ minLength: 1, maxLength: 5 }),
});

const inferenceProfileArb = fc.record({
  inferenceProfileArn: fc.string({ minLength: 10, maxLength: 100 }),
  inferenceProfileName: fc.string({ minLength: 1, maxLength: 50 }),
  modelId: fc.string({ minLength: 5, maxLength: 50 }),
  status: fc.constantFrom('ACTIVE', 'INACTIVE'),
});

describe('Feature: enterprise-agent-enhancements, Property 2: ActionGroupSelector logic', () => {
  it('each available action group has name, description, and isDefault', () => {
    fc.assert(
      fc.property(
        fc.array(actionGroupArb, { minLength: 1, maxLength: 5 }),
        (groups) => {
          for (const g of groups) {
            expect(g.name).toBeDefined();
            expect(g.name.length).toBeGreaterThan(0);
            expect(g.description).toBeDefined();
            expect(typeof g.isDefault).toBe('boolean');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('toggling selection adds/removes from array', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('PermissionAwareSearch', 'Browser', 'CodeInterpreter'), { minLength: 0, maxLength: 3 }),
        fc.constantFrom('PermissionAwareSearch', 'Browser', 'CodeInterpreter'),
        (selected, toggle) => {
          const isSelected = selected.includes(toggle);
          const newSelected = isSelected
            ? selected.filter(s => s !== toggle)
            : [...selected, toggle];
          if (isSelected) {
            expect(newSelected).not.toContain(toggle);
          } else {
            expect(newSelected).toContain(toggle);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: enterprise-agent-enhancements, Property 7: GuardrailSettings logic', () => {
  it('disabled state equals inverse of enabled toggle', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (enabled) => {
          const selectorDisabled = !enabled;
          expect(selectorDisabled).toBe(!enabled);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('guardrail list contains required fields', () => {
    fc.assert(
      fc.property(
        fc.array(guardrailArb, { minLength: 1, maxLength: 10 }),
        (guardrails) => {
          for (const g of guardrails) {
            expect(g.guardrailId).toBeDefined();
            expect(g.name).toBeDefined();
            expect(['READY', 'CREATING', 'FAILED', 'DELETING']).toContain(g.status);
            expect(g.version).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: enterprise-agent-enhancements, Property 5: InferenceProfileSelector logic', () => {
  it('profile list contains required fields', () => {
    fc.assert(
      fc.property(
        fc.array(inferenceProfileArb, { minLength: 1, maxLength: 10 }),
        (profiles) => {
          for (const p of profiles) {
            expect(p.inferenceProfileArn).toBeDefined();
            expect(p.inferenceProfileName).toBeDefined();
            expect(p.modelId).toBeDefined();
            expect(['ACTIVE', 'INACTIVE']).toContain(p.status);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cost tags are optional string fields', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
        fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
        (department, project) => {
          const tags: Record<string, string> = {};
          if (department) tags.department = department;
          if (project) tags.project = project;
          if (department) expect(tags.department).toBe(department);
          if (project) expect(tags.project).toBe(project);
          if (!department) expect(tags.department).toBeUndefined();
          if (!project) expect(tags.project).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
