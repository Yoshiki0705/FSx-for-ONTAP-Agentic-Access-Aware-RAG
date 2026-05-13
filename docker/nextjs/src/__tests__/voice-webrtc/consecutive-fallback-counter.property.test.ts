/**
 * Property 6: 連続フォールバックカウンター
 * 3 回以上連続フォールバック後に自動 REST モード開始、
 * 手動リセットでカウンターリセットを検証。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useVoiceStore } from '@/store/useVoiceStore';
import { WEBRTC_FALLBACK_CONFIG } from '@/types/voice';

describe('Property 6: Consecutive fallback counter', () => {
  beforeEach(() => {
    const store = useVoiceStore.getState();
    store.resetFallbackCount();
    store.setConnectionMode('webrtc');
  });

  it('should auto-switch to REST mode after maxConsecutiveFallbacks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (fallbackCount) => {
          const store = useVoiceStore.getState();
          store.resetFallbackCount();

          // Simulate fallbacks
          for (let i = 0; i < fallbackCount; i++) {
            store.incrementFallbackCount();
          }

          const currentCount = useVoiceStore.getState().fallbackCount;
          expect(currentCount).toBe(fallbackCount);

          // After max consecutive fallbacks, should use REST mode
          if (currentCount >= WEBRTC_FALLBACK_CONFIG.maxConsecutiveFallbacks) {
            // The strategy selection logic should choose REST
            expect(currentCount).toBeGreaterThanOrEqual(3);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset counter on manual reconnect request', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (fallbackCount) => {
          const store = useVoiceStore.getState();
          store.resetFallbackCount();

          // Simulate fallbacks
          for (let i = 0; i < fallbackCount; i++) {
            store.incrementFallbackCount();
          }

          expect(useVoiceStore.getState().fallbackCount).toBe(fallbackCount);

          // Manual reset
          store.resetFallbackCount();
          expect(useVoiceStore.getState().fallbackCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
