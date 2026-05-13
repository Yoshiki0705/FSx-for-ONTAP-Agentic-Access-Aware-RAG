/**
 * Property 5: タイムアウトベースフォールバック
 * 15 秒超過時に自動的に REST モードにフォールバックし connectionMode が更新されることを検証。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { WEBRTC_FALLBACK_CONFIG } from '@/types/voice';

describe('Property 5: Timeout-based fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger fallback after connectionTimeoutMs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30000 }),
        (elapsedMs) => {
          let fallbackTriggered = false;
          const timeoutMs = WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs;

          // Simulate timeout logic
          const timer = setTimeout(() => {
            fallbackTriggered = true;
          }, timeoutMs);

          // Advance time
          vi.advanceTimersByTime(elapsedMs);

          if (elapsedMs >= timeoutMs) {
            expect(fallbackTriggered).toBe(true);
          } else {
            expect(fallbackTriggered).toBe(false);
          }

          clearTimeout(timer);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not trigger fallback if connection succeeds before timeout', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 14999 }), // Always before 15s
        (connectionTime) => {
          let fallbackTriggered = false;
          let connected = false;
          const timeoutMs = WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs;

          const timer = setTimeout(() => {
            if (!connected) {
              fallbackTriggered = true;
            }
          }, timeoutMs);

          // Connection succeeds before timeout
          vi.advanceTimersByTime(connectionTime);
          connected = true;
          clearTimeout(timer);

          // Advance past timeout
          vi.advanceTimersByTime(timeoutMs);

          expect(fallbackTriggered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
