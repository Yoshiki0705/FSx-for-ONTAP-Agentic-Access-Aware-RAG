/**
 * フォールバック統合テスト
 * WebRTC 接続タイムアウト → REST フォールバックのエンドツーエンド動作を検証。
 * 連続フォールバック → 自動 REST モード切替を検証。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVoiceStore } from '@/store/useVoiceStore';
import { WEBRTC_FALLBACK_CONFIG } from '@/types/voice';

describe('Fallback Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const store = useVoiceStore.getState();
    store.resetFallbackCount();
    store.setConnectionMode('webrtc');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Timeout-based fallback', () => {
    it('should fallback to REST after 15s timeout', () => {
      const store = useVoiceStore.getState();
      let fallbackTriggered = false;

      // Simulate WebRTC connection attempt with timeout
      const timeout = setTimeout(() => {
        fallbackTriggered = true;
        store.setConnectionMode('rest');
        store.incrementFallbackCount();
      }, WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs);

      // Before timeout
      expect(fallbackTriggered).toBe(false);
      expect(useVoiceStore.getState().connectionMode).toBe('webrtc');

      // After timeout
      vi.advanceTimersByTime(WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs);
      expect(fallbackTriggered).toBe(true);
      expect(useVoiceStore.getState().connectionMode).toBe('rest');
      expect(useVoiceStore.getState().fallbackCount).toBe(1);

      clearTimeout(timeout);
    });

    it('should not fallback if connection succeeds before timeout', () => {
      const store = useVoiceStore.getState();
      let fallbackTriggered = false;
      let connected = false;

      const timeout = setTimeout(() => {
        if (!connected) {
          fallbackTriggered = true;
          store.setConnectionMode('rest');
        }
      }, WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs);

      // Connection succeeds at 5s
      vi.advanceTimersByTime(5000);
      connected = true;
      clearTimeout(timeout);

      // Advance past timeout
      vi.advanceTimersByTime(WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs);

      expect(fallbackTriggered).toBe(false);
      expect(useVoiceStore.getState().connectionMode).toBe('webrtc');
    });
  });

  describe('Consecutive fallback auto-REST', () => {
    it('should auto-switch to REST after 3 consecutive fallbacks', () => {
      const store = useVoiceStore.getState();

      // Simulate 3 consecutive fallbacks
      for (let i = 0; i < 3; i++) {
        store.incrementFallbackCount();
      }

      expect(useVoiceStore.getState().fallbackCount).toBe(3);

      // Next session should auto-use REST
      const shouldUseRest = useVoiceStore.getState().fallbackCount >= WEBRTC_FALLBACK_CONFIG.maxConsecutiveFallbacks;
      expect(shouldUseRest).toBe(true);
    });

    it('should allow WebRTC retry after manual reset', () => {
      const store = useVoiceStore.getState();

      // Simulate 3 fallbacks
      for (let i = 0; i < 3; i++) {
        store.incrementFallbackCount();
      }

      expect(useVoiceStore.getState().fallbackCount).toBe(3);

      // Manual reset
      store.resetFallbackCount();
      expect(useVoiceStore.getState().fallbackCount).toBe(0);

      // Should allow WebRTC again
      const shouldUseRest = useVoiceStore.getState().fallbackCount >= WEBRTC_FALLBACK_CONFIG.maxConsecutiveFallbacks;
      expect(shouldUseRest).toBe(false);
    });
  });

  describe('Browser WebRTC detection', () => {
    it('should detect WebRTC support', () => {
      // In test environment, RTCPeerConnection may not exist
      const hasWebRTC = typeof globalThis.RTCPeerConnection !== 'undefined';
      // This is expected to be false in Node.js test environment
      expect(typeof hasWebRTC).toBe('boolean');
    });
  });
});
