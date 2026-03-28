/**
 * Property-Based Test: 折りたたみ状態の永続化ラウンドトリップ (P6)
 *
 * Feature: sidebar-workflow-agent-redesign, Property 6: collapsible state persistence round-trip
 *
 * For any boolean state, JSON.stringify → JSON.parse round-trip preserves the value.
 * Tests the store's persist serialization.
 *
 * **Validates: Requirements 7.1, 7.2**
 */

import * as fc from 'fast-check';
import { useSidebarStore } from '../../store/useSidebarStore';

describe('Feature: sidebar-workflow-agent-redesign, Property 6: collapsible state persistence round-trip', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useSidebarStore.setState({ systemSettingsExpanded: false });
  });

  it('任意のboolean状態がJSON.stringify → JSON.parseラウンドトリップで保持される', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (state: boolean) => {
          // Set state in the store
          useSidebarStore.getState().setSystemSettingsExpanded(state);

          // Simulate persist serialization round-trip
          const storeState = useSidebarStore.getState();
          const serialized = JSON.stringify({
            state: { systemSettingsExpanded: storeState.systemSettingsExpanded },
          });
          const deserialized = JSON.parse(serialized);

          // Verify round-trip preserves the boolean value
          expect(deserialized.state.systemSettingsExpanded).toBe(state);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ストアに状態を設定後、getStateで同じ値が取得できる', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (state: boolean) => {
          // Set state via the action
          useSidebarStore.getState().setSystemSettingsExpanded(state);

          // Read back from store
          const actual = useSidebarStore.getState().systemSettingsExpanded;

          expect(actual).toBe(state);
        }
      ),
      { numRuns: 100 }
    );
  });
});
