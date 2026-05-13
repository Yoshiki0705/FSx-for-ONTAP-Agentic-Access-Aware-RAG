/**
 * 音声セッション管理フック
 * Strategy パターンにより voiceChatMode に応じて REST / WebRTC を切り替える。
 * コンポーネント側インターフェース（UseVoiceSessionReturn）は Phase 1 と同一。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceStore } from '@/store/useVoiceStore';
import {
  type VoiceSessionState,
  type VoiceError,
  type VoiceChatMode,
  type WebRTCStats,
  SILENCE_TIMEOUT_SECONDS,
  WEBRTC_FALLBACK_CONFIG,
} from '@/types/voice';
import type { VoiceSessionStrategy } from './strategies/VoiceSessionStrategy';
import { RESTVoiceStrategy } from './strategies/RESTVoiceStrategy';

interface UseVoiceSessionReturn {
  sessionState: VoiceSessionState;
  isRecording: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  transcribedText: string | null;
  error: VoiceError | null;
  inputAnalyserNode: AnalyserNode | null;
  outputAnalyserNode: AnalyserNode | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelSession: () => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  setVolume: (volume: number) => void;
  /** Phase 2: 手動で WebRTC モードに再接続を試行する */
  retryWebRTC: () => void;
}

/**
 * 環境変数から voiceChatMode を取得する
 */
function getVoiceChatMode(): VoiceChatMode {
  if (typeof window === 'undefined') return 'rest';
  const mode = process.env.NEXT_PUBLIC_VOICE_CHAT_MODE;
  if (mode === 'webrtc') return 'webrtc';
  return 'rest';
}

export function useVoiceSession(): UseVoiceSessionReturn {
  const [sessionState, setSessionState] = useState<VoiceSessionState>('idle');
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [error, setError] = useState<VoiceError | null>(null);
  const [inputAnalyserNode, setInputAnalyserNode] = useState<AnalyserNode | null>(null);
  const [outputAnalyserNode, setOutputAnalyserNode] = useState<AnalyserNode | null>(null);

  const strategyRef = useRef<VoiceSessionStrategy | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);

  const store = useVoiceStore();

  const createError = useCallback((code: VoiceError['code'], message: string, recoverable = false): VoiceError => ({
    code,
    message,
    timestamp: new Date(),
    recoverable,
  }), []);

  /**
   * Strategy を作成する。WebRTC モードの場合は動的インポートを使用。
   */
  const createStrategy = useCallback(async (mode: VoiceChatMode): Promise<VoiceSessionStrategy> => {
    if (mode === 'webrtc') {
      // WebRTC 非対応ブラウザチェック
      if (typeof RTCPeerConnection === 'undefined') {
        // フォールバック: REST モードを使用
        store.setConnectionMode('rest');
        store.incrementFallbackCount();
        return new RESTVoiceStrategy();
      }

      // 連続フォールバック 3 回以上 → 自動 REST モード
      if (store.fallbackCount >= WEBRTC_FALLBACK_CONFIG.maxConsecutiveFallbacks) {
        store.setConnectionMode('rest');
        return new RESTVoiceStrategy();
      }

      try {
        // 動的インポート
        const { WebRTCVoiceStrategy } = await import('./strategies/WebRTCVoiceStrategy');
        const strategy = new WebRTCVoiceStrategy({
          onIceConnectionStateChange: (state) => {
            store.setIceConnectionState(state);
          },
          onQualityUpdate: (stats: WebRTCStats) => {
            store.setConnectionQuality({
              rtt: stats.rtt,
              packetLoss: stats.packetLoss,
              jitter: stats.jitter,
              isWarning: stats.packetLoss > WEBRTC_FALLBACK_CONFIG.qualityWarningThresholds.packetLossRate ||
                stats.rtt > WEBRTC_FALLBACK_CONFIG.qualityWarningThresholds.rttMs,
            });
          },
          onError: (code, message) => {
            const voiceError = createError(code as VoiceError['code'], message, true);
            setError(voiceError);
            store.setLastError(voiceError);
          },
          onFallbackNeeded: (_reason) => {
            // フォールバック: REST モードに切り替え
            store.incrementFallbackCount();
            store.setConnectionMode('rest');
            fallbackToRest();
          },
        });
        store.setConnectionMode('webrtc');
        return strategy;
      } catch {
        // WebRTC モジュールロード失敗 → REST フォールバック
        store.setConnectionMode('rest');
        store.incrementFallbackCount();
        return new RESTVoiceStrategy();
      }
    }

    store.setConnectionMode('rest');
    return new RESTVoiceStrategy();
  }, [store, createError]);

  /**
   * WebRTC → REST フォールバック
   */
  const fallbackToRest = useCallback(async () => {
    // 既存の WebRTC 接続をクリーンアップ
    if (strategyRef.current) {
      strategyRef.current.disconnect();
      strategyRef.current = null;
    }

    // REST Strategy で再接続
    const restStrategy = new RESTVoiceStrategy();
    try {
      await restStrategy.connect();
      strategyRef.current = restStrategy;
      setInputAnalyserNode(restStrategy.getInputAnalyser());
      setOutputAnalyserNode(restStrategy.getOutputAnalyser());
      setSessionState('recording');
    } catch (err) {
      const voiceError = createError('WS_CONNECTION_FAILED', 'Fallback to REST also failed', false);
      setError(voiceError);
      store.setLastError(voiceError);
      setSessionState('error');
      cleanup();
    }
  }, [createError, store]);

  const cleanup = useCallback(() => {
    if (strategyRef.current) {
      strategyRef.current.disconnect();
      strategyRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setInputAnalyserNode(null);
    setOutputAnalyserNode(null);
    isPlayingRef.current = false;
    store.setVoiceSessionActive(false);
    store.setIceConnectionState(null);
    store.setConnectionQuality(null);
  }, [store]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (sessionState === 'recording') {
        stopRecording();
      }
    }, SILENCE_TIMEOUT_SECONDS * 1000);
  }, [sessionState]);

  const startRecording = useCallback(async () => {
    // 単一セッション不変条件: 既にアクティブなら開始しない
    if (store.isVoiceSessionActive) return;

    try {
      setSessionState('connecting');
      store.setVoiceSessionActive(true);
      store.clearError();
      setError(null);

      const mode = getVoiceChatMode();
      const strategy = await createStrategy(mode);
      strategyRef.current = strategy;

      await strategy.connect();

      setInputAnalyserNode(strategy.getInputAnalyser());
      setOutputAnalyserNode(strategy.getOutputAnalyser());
      setSessionState('recording');

      // 無音検出タイマー開始
      resetSilenceTimer();
    } catch (err) {
      const voiceError = err instanceof DOMException && err.name === 'NotAllowedError'
        ? createError('MIC_PERMISSION_DENIED', 'Microphone access denied', false)
        : createError('MIC_NOT_SUPPORTED', 'Microphone not available', false);
      setError(voiceError);
      store.setLastError(voiceError);
      setSessionState('error');
      cleanup();
    }
  }, [store, cleanup, createError, createStrategy, resetSilenceTimer]);

  const stopRecording = useCallback(async () => {
    if (sessionState !== 'recording') return;

    setSessionState('processing');

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Strategy の接続を切断
    if (strategyRef.current) {
      strategyRef.current.disconnect();
      strategyRef.current = null;
    }

    setInputAnalyserNode(null);
    setOutputAnalyserNode(null);

    // 処理完了後にidle状態に戻す
    setTimeout(() => {
      setSessionState('idle');
      store.setVoiceSessionActive(false);
      store.setIceConnectionState(null);
      store.setConnectionQuality(null);
    }, 500);
  }, [sessionState, store]);

  const cancelSession = useCallback(() => {
    cleanup();
    setSessionState('idle');
    setTranscribedText(null);
    setError(null);
  }, [cleanup]);

  const pausePlayback = useCallback(() => {
    isPlayingRef.current = false;
  }, []);

  const resumePlayback = useCallback(() => {
    isPlayingRef.current = true;
  }, []);

  const setVolume = useCallback((volume: number) => {
    store.setVolume(volume);
  }, [store]);

  /**
   * Phase 2: 手動で WebRTC モードに再接続を試行する
   * フォールバックカウンターをリセットし、WebRTC 接続を再試行する。
   */
  const retryWebRTC = useCallback(() => {
    store.resetFallbackCount();
    store.setConnectionMode('webrtc');
  }, [store]);

  // ページ離脱時のクリーンアップ
  useEffect(() => {
    const handleBeforeUnload = () => cleanup();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [cleanup]);

  return {
    sessionState,
    isRecording: sessionState === 'recording',
    isProcessing: sessionState === 'processing',
    isPlaying: sessionState === 'playing',
    transcribedText,
    error,
    inputAnalyserNode,
    outputAnalyserNode,
    startRecording,
    stopRecording,
    cancelSession,
    pausePlayback,
    resumePlayback,
    setVolume,
    retryWebRTC,
  };
}
