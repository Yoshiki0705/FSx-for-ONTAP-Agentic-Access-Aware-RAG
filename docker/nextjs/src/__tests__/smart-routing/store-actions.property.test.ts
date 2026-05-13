/**
 * Property 9: Store Actions Update State Correctly
 *
 * For any string value passed to `setHeavyModelId` and any positive number
 * passed to `setContextSizeThreshold`, the Zustand store SHALL update its
 * corresponding state field to exactly that value.
 *
 * Feature: smart-routing-model-expansion, Property 9: Store Actions Update State Correctly
 *
 * **Validates: Requirements 7.3, 7.4**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useSmartRoutingStore } from '@/store/useSmartRoutingStore';

describe('Feature: smart-routing-model-expansion, Property 9: Store Actions Update State Correctly', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    const store = useSmartRoutingStore.getState();
    store.setHeavyModelId('anthropic.claude-opus-4-0-20250514-v1:0');
    store.setContextSizeThreshold(4000);
  });

  it('setHeavyModelId updates heavyModelId to exactly the provided string value', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const { setHeavyModelId } = useSmartRoutingStore.getState();
          setHeavyModelId(value);

          const { heavyModelId } = useSmartRoutingStore.getState();
          expect(heavyModelId).toBe(value);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('setContextSizeThreshold updates contextSizeThreshold to exactly the provided positive number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        (threshold) => {
          const { setContextSizeThreshold } = useSmartRoutingStore.getState();
          setContextSizeThreshold(threshold);

          const { contextSizeThreshold } = useSmartRoutingStore.getState();
          expect(contextSizeThreshold).toBe(threshold);
        }
      ),
      { numRuns: 200 }
    );
  });
});
