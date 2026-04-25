/**
 * Property-Based Test: 折りたたみトグル状態反転 (P1)
 *
 * Feature: sidebar-workflow-agent-redesign, Property 1: collapsible toggle inverts state
 *
 * For any initial state (bool) and any number of clicks N (1-100),
 * after N toggles the state equals `initialState XOR (N % 2 === 1)`.
 * Odd clicks invert the state, even clicks restore it.
 *
 * Tests the useSidebarStore toggle logic directly (not the React component).
 *
 * **Validates: Requirements 1.3**
 */

import * as fc from 'fast-check';
import { useSidebarStore } from '../../../store/useSidebarStore';

describe('Feature: sidebar-workflow-agent-redesign, Property 1: collapsible toggle inverts state', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useSidebarStore.getState().setExpanded('system-settings', false);
  });

  it('N回トグル後の状態は initialState XOR (N % 2 === 1) と等しい', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 1, max: 100 }),
        (initialState: boolean, clickCount: number) => {
          // Set initial state via setExpanded
          useSidebarStore.getState().setExpanded('system-settings', initialState);

          // Perform N toggles
          for (let i = 0; i < clickCount; i++) {
            useSidebarStore.getState().toggleSystemSettings();
          }

          // Verify: after N toggles, state === initialState XOR (N is odd)
          const expectedState = clickCount % 2 === 1 ? !initialState : initialState;
          const actualState = useSidebarStore.getState().isExpanded('system-settings');

          expect(actualState).toBe(expectedState);
        }
      ),
      { numRuns: 100 }
    );
  });
});
