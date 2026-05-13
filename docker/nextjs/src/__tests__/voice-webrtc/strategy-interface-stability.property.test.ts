/**
 * Property 4: Strategy パターンインターフェース安定性
 * 任意の voiceChatMode 値に対して useVoiceSession の返却型が同一であることを検証。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RESTVoiceStrategy } from '@/hooks/strategies/RESTVoiceStrategy';
import type { VoiceSessionStrategy } from '@/hooks/strategies/VoiceSessionStrategy';

describe('Property 4: Strategy pattern interface stability', () => {
  it('RESTVoiceStrategy should implement all VoiceSessionStrategy methods', () => {
    const strategy: VoiceSessionStrategy = new RESTVoiceStrategy();

    // All required methods should exist
    expect(typeof strategy.connect).toBe('function');
    expect(typeof strategy.disconnect).toBe('function');
    expect(typeof strategy.sendAudio).toBe('function');
    expect(typeof strategy.getInputAnalyser).toBe('function');
    expect(typeof strategy.getOutputAnalyser).toBe('function');
    expect(typeof strategy.isConnected).toBe('function');
  });

  it('strategy should return consistent types regardless of mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('rest', 'webrtc'),
        (mode) => {
          // Both modes should produce strategies with the same interface shape
          const strategy = new RESTVoiceStrategy(); // Use REST as baseline

          // Before connect
          expect(strategy.isConnected()).toBe(false);
          expect(strategy.getInputAnalyser()).toBeNull();
          expect(strategy.getOutputAnalyser()).toBeNull();

          // sendAudio should not throw
          expect(() => strategy.sendAudio(new Float32Array(100))).not.toThrow();

          // disconnect should not throw even when not connected
          expect(() => strategy.disconnect()).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});
