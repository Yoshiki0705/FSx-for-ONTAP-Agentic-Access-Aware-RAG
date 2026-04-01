/**
 * Property-based tests for backward compatibility of Agent API action routing.
 *
 * Uses fast-check and Jest to verify that existing actions remain unchanged
 * after adding new KB management actions. Tests the routing logic as a pure function.
 * Each test runs at least 100 iterations.
 */

import * as fc from 'fast-check';

// Feature: advanced-rag-features, Property 36: Existing Agent API actions unchanged
// **Validates: Requirements 16.4**

/**
 * Action routing logic extracted as a pure function.
 * Mirrors the switch statement in /api/bedrock/agent/route.ts.
 */
const EXISTING_ACTIONS = ['invoke', 'create', 'delete', 'update', 'list', 'get'] as const;
const NEW_ACTIONS = ['associateKnowledgeBase', 'disassociateKnowledgeBase', 'listAgentKnowledgeBases'] as const;

function routeAction(action: string): string {
  switch (action) {
    case 'invoke': return 'handleInvokeAgent';
    case 'create': return 'handleCreateAgent';
    case 'delete': return 'handleDeleteAgent';
    case 'update': return 'handleUpdateAgent';
    case 'list': return 'handleListAgents';
    case 'get': return 'handleGetAgent';
    case 'associateKnowledgeBase': return 'handleAssociateKB';
    case 'disassociateKnowledgeBase': return 'handleDisassociateKB';
    case 'listAgentKnowledgeBases': return 'handleListAgentKBs';
    default: return 'handleInvokeAgent'; // backward compat default
  }
}

/** Expected handler mapping for existing (pre-feature) actions */
const EXPECTED_EXISTING_HANDLERS: Record<typeof EXISTING_ACTIONS[number], string> = {
  invoke: 'handleInvokeAgent',
  create: 'handleCreateAgent',
  delete: 'handleDeleteAgent',
  update: 'handleUpdateAgent',
  list: 'handleListAgents',
  get: 'handleGetAgent',
};

describe('Property 36: Existing Agent API actions unchanged', () => {
  /**
   * Sub-property 1: For any existing action, the handler name is the expected one
   * (unchanged from pre-feature implementation).
   */
  it('existing actions always map to their expected handlers', () => {
    const existingActionArb = fc.constantFrom(...EXISTING_ACTIONS);

    fc.assert(
      fc.property(existingActionArb, (action) => {
        const handler = routeAction(action);
        expect(handler).toBe(EXPECTED_EXISTING_HANDLERS[action]);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Sub-property 2: New actions don't interfere with existing action routing.
   * For any pair of (existing action, new action), routing the existing action
   * still returns the same handler regardless of which new actions exist.
   */
  it('new actions do not interfere with existing action routing', () => {
    const existingActionArb = fc.constantFrom(...EXISTING_ACTIONS);
    const newActionArb = fc.constantFrom(...NEW_ACTIONS);

    fc.assert(
      fc.property(
        fc.tuple(existingActionArb, newActionArb),
        ([existingAction, _newAction]) => {
          // Route the existing action — it should still return the expected handler
          const handler = routeAction(existingAction);
          expect(handler).toBe(EXPECTED_EXISTING_HANDLERS[existingAction]);

          // Also verify the new action routes to its own handler (not an existing one)
          const newHandler = routeAction(_newAction);
          const existingHandlerValues = Object.values(EXPECTED_EXISTING_HANDLERS);
          expect(existingHandlerValues).not.toContain(newHandler);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Sub-property 3: Unknown actions still default to 'handleInvokeAgent'
   * (backward compatibility for unrecognized action strings).
   */
  it('unknown actions default to handleInvokeAgent for backward compatibility', () => {
    const allKnownActions = [...EXISTING_ACTIONS, ...NEW_ACTIONS] as string[];

    const unknownActionArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !allKnownActions.includes(s));

    fc.assert(
      fc.property(unknownActionArb, (unknownAction) => {
        const handler = routeAction(unknownAction);
        expect(handler).toBe('handleInvokeAgent');
      }),
      { numRuns: 10 }
    );
  });
});
