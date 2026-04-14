/**
 * Unit tests for useVoiceStore
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceStore } from '@/store/useVoiceStore';

describe('useVoiceStore', () => {
  beforeEach(() => {
    // Reset store state
    useVoiceStore.setState({
      isVoiceSessionActive: false,
      volume: 1.0,
      isMuted: false,
      lastError: null,
    });
  });

  it('should initialize with default values', () => {
    const state = useVoiceStore.getState();
    expect(state.isVoiceSessionActive).toBe(false);
    expect(state.volume).toBe(1.0);
    expect(state.isMuted).toBe(false);
    expect(state.lastError).toBeNull();
  });

  it('should set voice session active', () => {
    useVoiceStore.getState().setVoiceSessionActive(true);
    expect(useVoiceStore.getState().isVoiceSessionActive).toBe(true);

    useVoiceStore.getState().setVoiceSessionActive(false);
    expect(useVoiceStore.getState().isVoiceSessionActive).toBe(false);
  });

  it('should clamp volume between 0 and 1', () => {
    useVoiceStore.getState().setVolume(0.5);
    expect(useVoiceStore.getState().volume).toBe(0.5);

    useVoiceStore.getState().setVolume(-0.5);
    expect(useVoiceStore.getState().volume).toBe(0);

    useVoiceStore.getState().setVolume(1.5);
    expect(useVoiceStore.getState().volume).toBe(1);
  });

  it('should set muted state', () => {
    useVoiceStore.getState().setMuted(true);
    expect(useVoiceStore.getState().isMuted).toBe(true);
  });

  it('should set and clear errors', () => {
    const error = {
      code: 'API_ERROR' as const,
      message: 'Test error',
      timestamp: new Date(),
      recoverable: false,
    };

    useVoiceStore.getState().setLastError(error);
    expect(useVoiceStore.getState().lastError).toEqual(error);

    useVoiceStore.getState().clearError();
    expect(useVoiceStore.getState().lastError).toBeNull();
  });
});
