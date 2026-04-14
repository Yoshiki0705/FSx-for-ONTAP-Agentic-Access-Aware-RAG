/**
 * 音声チャット状態管理用Zustandストア
 * セッション状態、音量、エラーをグローバルに管理する。
 */

import { create } from 'zustand';
import type { VoiceError } from '@/types/voice';

interface VoiceStore {
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
}

export const useVoiceStore = create<VoiceStore>()((set) => ({
  isVoiceSessionActive: false,
  setVoiceSessionActive: (active) => set({ isVoiceSessionActive: active }),

  volume: 1.0,
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  isMuted: false,
  setMuted: (muted) => set({ isMuted: muted }),

  lastError: null,
  setLastError: (error) => set({ lastError: error }),
  clearError: () => set({ lastError: null }),
}));
