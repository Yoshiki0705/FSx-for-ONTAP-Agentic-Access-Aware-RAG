/**
 * useVoiceStore Phase 2 拡張のユニットテスト
 * connectionMode 切替、fallbackCount インクリメント/リセット、connectionQuality 更新を検証。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceStore } from '@/store/useVoiceStore';

describe('useVoiceStore Phase 2 extensions', () => {
  beforeEach(() => {
    // Reset store to initial state
    const store = useVoiceStore.getState();
    store.setConnectionMode('rest');
    store.setIceConnectionState(null);
    store.setConnectionQuality(null);
    store.resetFallbackCount();
  });

  describe('connectionMode', () => {
    it('should default to "rest"', () => {
      expect(useVoiceStore.getState().connectionMode).toBe('rest');
    });

    it('should switch to "webrtc"', () => {
      useVoiceStore.getState().setConnectionMode('webrtc');
      expect(useVoiceStore.getState().connectionMode).toBe('webrtc');
    });

    it('should switch back to "rest"', () => {
      useVoiceStore.getState().setConnectionMode('webrtc');
      useVoiceStore.getState().setConnectionMode('rest');
      expect(useVoiceStore.getState().connectionMode).toBe('rest');
    });
  });

  describe('iceConnectionState', () => {
    it('should default to null', () => {
      expect(useVoiceStore.getState().iceConnectionState).toBeNull();
    });

    it('should update ICE state', () => {
      useVoiceStore.getState().setIceConnectionState('checking');
      expect(useVoiceStore.getState().iceConnectionState).toBe('checking');

      useVoiceStore.getState().setIceConnectionState('connected');
      expect(useVoiceStore.getState().iceConnectionState).toBe('connected');
    });

    it('should reset to null', () => {
      useVoiceStore.getState().setIceConnectionState('connected');
      useVoiceStore.getState().setIceConnectionState(null);
      expect(useVoiceStore.getState().iceConnectionState).toBeNull();
    });
  });

  describe('connectionQuality', () => {
    it('should default to null', () => {
      expect(useVoiceStore.getState().connectionQuality).toBeNull();
    });

    it('should update quality metrics', () => {
      const quality = { rtt: 50, packetLoss: 0.01, jitter: 5, isWarning: false };
      useVoiceStore.getState().setConnectionQuality(quality);
      expect(useVoiceStore.getState().connectionQuality).toEqual(quality);
    });

    it('should set isWarning when thresholds exceeded', () => {
      const degraded = { rtt: 600, packetLoss: 0.1, jitter: 50, isWarning: true };
      useVoiceStore.getState().setConnectionQuality(degraded);
      expect(useVoiceStore.getState().connectionQuality?.isWarning).toBe(true);
    });
  });

  describe('fallbackCount', () => {
    it('should default to 0', () => {
      expect(useVoiceStore.getState().fallbackCount).toBe(0);
    });

    it('should increment', () => {
      useVoiceStore.getState().incrementFallbackCount();
      expect(useVoiceStore.getState().fallbackCount).toBe(1);

      useVoiceStore.getState().incrementFallbackCount();
      expect(useVoiceStore.getState().fallbackCount).toBe(2);

      useVoiceStore.getState().incrementFallbackCount();
      expect(useVoiceStore.getState().fallbackCount).toBe(3);
    });

    it('should reset to 0', () => {
      useVoiceStore.getState().incrementFallbackCount();
      useVoiceStore.getState().incrementFallbackCount();
      useVoiceStore.getState().resetFallbackCount();
      expect(useVoiceStore.getState().fallbackCount).toBe(0);
    });
  });

  describe('Phase 1 compatibility', () => {
    it('should maintain Phase 1 properties', () => {
      const store = useVoiceStore.getState();

      // Phase 1 properties should still work
      store.setVoiceSessionActive(true);
      expect(useVoiceStore.getState().isVoiceSessionActive).toBe(true);

      store.setVolume(0.5);
      expect(useVoiceStore.getState().volume).toBe(0.5);

      store.setMuted(true);
      expect(useVoiceStore.getState().isMuted).toBe(true);

      store.setLastError({ code: 'API_ERROR', message: 'test', timestamp: new Date(), recoverable: false });
      expect(useVoiceStore.getState().lastError?.code).toBe('API_ERROR');

      store.clearError();
      expect(useVoiceStore.getState().lastError).toBeNull();
    });
  });
});
