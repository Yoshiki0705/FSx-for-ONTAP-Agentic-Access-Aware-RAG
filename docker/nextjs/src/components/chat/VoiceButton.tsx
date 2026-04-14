'use client';

import { useEffect, useCallback } from 'react';
import { useVoiceCapability } from '@/hooks/useVoiceCapability';

interface VoiceButtonProps {
  disabled?: boolean;
  isRecording?: boolean;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
}

type VoiceButtonState = 'idle' | 'recording' | 'processing' | 'error';

/**
 * 🎤 マイクボタンコンポーネント
 * VOICE_CHAT_ENABLED=false 時は非表示。
 */
export function VoiceButton({
  disabled = false,
  isRecording = false,
  onRecordingStart,
  onRecordingStop,
}: VoiceButtonProps) {
  const { canUseVoice } = useVoiceCapability();

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (isRecording) {
      onRecordingStop();
    } else {
      onRecordingStart();
    }
  }, [disabled, isRecording, onRecordingStart, onRecordingStop]);

  // キーボードショートカット: Ctrl+Shift+V / Cmd+Shift+V
  useEffect(() => {
    if (!canUseVoice) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        handleClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUseVoice, handleClick]);

  if (!canUseVoice) return null;

  const state: VoiceButtonState = isRecording ? 'recording' : 'idle';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative p-2 rounded-full transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'}
        ${isRecording
          ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
          : 'text-gray-500 dark:text-gray-400'
        }
      `}
      aria-label={isRecording ? '音声入力を停止' : '音声入力を開始'}
      title={isRecording ? '音声入力を停止 (Ctrl+Shift+V)' : '音声入力を開始 (Ctrl+Shift+V)'}
    >
      {/* マイクアイコン */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5"
      >
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>

      {/* 録音中パルスアニメーション */}
      {isRecording && (
        <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-30" />
      )}
    </button>
  );
}
