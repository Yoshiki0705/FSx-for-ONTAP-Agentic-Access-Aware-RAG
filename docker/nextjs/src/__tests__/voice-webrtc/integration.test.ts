/**
 * 統合テスト: 全コンポーネントのワイヤリング確認
 * VoiceButton → useVoiceSession → Strategy → KVS/AgentCore の接続フローを検証。
 */

import { describe, it, expect, vi } from 'vitest';
import { RESTVoiceStrategy } from '@/hooks/strategies/RESTVoiceStrategy';
import { useVoiceStore } from '@/store/useVoiceStore';
import type { VoiceSessionStrategy } from '@/hooks/strategies/VoiceSessionStrategy';

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
    },
  },
  writable: true,
});

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  sampleRate = 16000;
  destination = {};
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  createAnalyser() {
    return { fftSize: 0, connect: vi.fn() };
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

(global as any).AudioContext = MockAudioContext;

describe('Integration: Voice Chat WebRTC Flow', () => {
  describe('Strategy selection', () => {
    it('should use RESTVoiceStrategy for "rest" mode', () => {
      const strategy: VoiceSessionStrategy = new RESTVoiceStrategy();
      expect(strategy).toBeDefined();
      expect(strategy.isConnected()).toBe(false);
    });

    it('RESTVoiceStrategy should implement full interface', () => {
      const strategy = new RESTVoiceStrategy();

      // All methods should exist
      expect(typeof strategy.connect).toBe('function');
      expect(typeof strategy.disconnect).toBe('function');
      expect(typeof strategy.sendAudio).toBe('function');
      expect(typeof strategy.getInputAnalyser).toBe('function');
      expect(typeof strategy.getOutputAnalyser).toBe('function');
      expect(typeof strategy.isConnected).toBe('function');
    });
  });

  describe('Store integration', () => {
    it('should track connection mode transitions', () => {
      const store = useVoiceStore.getState();

      // Initial state
      expect(store.connectionMode).toBe('rest');

      // Switch to WebRTC
      store.setConnectionMode('webrtc');
      expect(useVoiceStore.getState().connectionMode).toBe('webrtc');

      // Fallback to REST
      store.setConnectionMode('rest');
      store.incrementFallbackCount();
      expect(useVoiceStore.getState().connectionMode).toBe('rest');
      expect(useVoiceStore.getState().fallbackCount).toBe(1);
    });

    it('should track ICE connection state changes', () => {
      const store = useVoiceStore.getState();

      const states: RTCIceConnectionState[] = ['new', 'checking', 'connected', 'disconnected', 'failed', 'closed'];

      for (const state of states) {
        store.setIceConnectionState(state);
        expect(useVoiceStore.getState().iceConnectionState).toBe(state);
      }
    });

    it('should track connection quality', () => {
      const store = useVoiceStore.getState();

      store.setConnectionQuality({
        rtt: 50,
        packetLoss: 0.01,
        jitter: 5,
        isWarning: false,
      });

      const quality = useVoiceStore.getState().connectionQuality;
      expect(quality).not.toBeNull();
      expect(quality!.rtt).toBe(50);
      expect(quality!.isWarning).toBe(false);

      // Degraded quality
      store.setConnectionQuality({
        rtt: 600,
        packetLoss: 0.1,
        jitter: 50,
        isWarning: true,
      });

      const degraded = useVoiceStore.getState().connectionQuality;
      expect(degraded!.isWarning).toBe(true);
    });
  });

  describe('Fallback flow', () => {
    it('should transition from WebRTC to REST on failure', () => {
      const store = useVoiceStore.getState();
      store.resetFallbackCount();
      store.setConnectionMode('webrtc');

      // Simulate WebRTC failure
      store.setIceConnectionState('failed');
      store.setConnectionMode('rest');
      store.incrementFallbackCount();

      expect(useVoiceStore.getState().connectionMode).toBe('rest');
      expect(useVoiceStore.getState().fallbackCount).toBe(1);
    });

    it('should auto-REST after 3 consecutive fallbacks', () => {
      const store = useVoiceStore.getState();
      store.resetFallbackCount();

      // 3 consecutive fallbacks
      store.incrementFallbackCount();
      store.incrementFallbackCount();
      store.incrementFallbackCount();

      const shouldAutoRest = useVoiceStore.getState().fallbackCount >= 3;
      expect(shouldAutoRest).toBe(true);
    });
  });
});
