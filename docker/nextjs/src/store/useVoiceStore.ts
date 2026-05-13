/**
 * 音声チャット状態管理用Zustandストア
 * セッション状態、音量、エラーをグローバルに管理する。
 * Phase 2: WebRTC 接続モード、ICE 状態、接続品質、フォールバックカウンターを追加。
 */

import { create } from 'zustand';
import type { VoiceError, VoiceChatMode, ConnectionQuality } from '@/types/voice';

interface VoiceStore {
  // --- Phase 1 プロパティ ---
  /** 音声セッションがアクティブか */
  isVoiceSessionActive: boolean;
  setVoiceSessionActive: (active: boolean) => void;

  /** 音量（0.0〜1.0） */
  volume: number;
  setVolume: (volume: number) => void;

  /** ミュート状態 */
  isMuted: boolean;
  setMuted: (muted: boolean) => void;

  /** 最後のエラー */
  lastError: VoiceError | null;
  setLastError: (error: VoiceError | null) => void;
  clearError: () => void;

  // --- Phase 2 プロパティ ---
  /** 現在の接続モード */
  connectionMode: VoiceChatMode;
  setConnectionMode: (mode: VoiceChatMode) => void;

  /** ICE 接続状態 */
  iceConnectionState: RTCIceConnectionState | null;
  setIceConnectionState: (state: RTCIceConnectionState | null) => void;

  /** 接続品質メトリクス */
  connectionQuality: ConnectionQuality | null;
  setConnectionQuality: (quality: ConnectionQuality | null) => void;

  /** フォールバック回数 */
  fallbackCount: number;
  incrementFallbackCount: () => void;
  resetFallbackCount: () => void;
}

export const useVoiceStore = create<VoiceStore>()((set) => ({
  // --- Phase 1 ---
  isVoiceSessionActive: false,
  setVoiceSessionActive: (active) => set({ isVoiceSessionActive: active }),

  volume: 1.0,
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  isMuted: false,
  setMuted: (muted) => set({ isMuted: muted }),

  lastError: null,
  setLastError: (error) => set({ lastError: error }),
  clearError: () => set({ lastError: null }),

  // --- Phase 2 ---
  connectionMode: 'rest',
  setConnectionMode: (mode) => set({ connectionMode: mode }),

  iceConnectionState: null,
  setIceConnectionState: (state) => set({ iceConnectionState: state }),

  connectionQuality: null,
  setConnectionQuality: (quality) => set({ connectionQuality: quality }),

  fallbackCount: 0,
  incrementFallbackCount: () => set((state) => ({ fallbackCount: state.fallbackCount + 1 })),
  resetFallbackCount: () => set({ fallbackCount: 0 }),
}));
