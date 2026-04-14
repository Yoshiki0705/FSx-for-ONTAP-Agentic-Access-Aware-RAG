/**
 * 音声セッション管理フック
 * WebSocket接続、マイクストリーム、音声再生を統合管理する。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceStore } from '@/store/useVoiceStore';
import {
  type VoiceSessionState,
  type VoiceError,
  NOVA_SONIC_AUDIO_CONFIG,
  SILENCE_TIMEOUT_SECONDS,
  MAX_RECONNECT_ATTEMPTS,
  splitAudioIntoChunks,
  isSilent,
} from '@/types/voice';

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
}

export function useVoiceSession(): UseVoiceSessionReturn {
  const [sessionState, setSessionState] = useState<VoiceSessionState>('idle');
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [error, setError] = useState<VoiceError | null>(null);
  const [inputAnalyserNode, setInputAnalyserNode] = useState<AnalyserNode | null>(null);
  const [outputAnalyserNode, setOutputAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const isPlayingRef = useRef(false);

  const store = useVoiceStore();

  const cleanup = useCallback(() => {
    // マイクストリーム解放
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    // AudioContext クローズ
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    // 無音タイマークリア
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setInputAnalyserNode(null);
    setOutputAnalyserNode(null);
    isPlayingRef.current = false;
    store.setVoiceSessionActive(false);
  }, [store]);

  const createError = useCallback((code: VoiceError['code'], message: string, recoverable = false): VoiceError => ({
    code,
    message,
    timestamp: new Date(),
    recoverable,
  }), []);

  const startRecording = useCallback(async () => {
    // 単一セッション不変条件: 既にアクティブなら開始しない
    if (store.isVoiceSessionActive) return;

    try {
      setSessionState('connecting');
      store.setVoiceSessionActive(true);
      store.clearError();
      setError(null);
      reconnectCountRef.current = 0;

      // マイクアクセス要求
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: NOVA_SONIC_AUDIO_CONFIG.inputSampleRate,
          channelCount: NOVA_SONIC_AUDIO_CONFIG.channels,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // AudioContext セットアップ
      const ctx = new AudioContext({ sampleRate: NOVA_SONIC_AUDIO_CONFIG.inputSampleRate });
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setInputAnalyserNode(analyser);

      // 出力用 AnalyserNode
      const outAnalyser = ctx.createAnalyser();
      outAnalyser.fftSize = 256;
      setOutputAnalyserNode(outAnalyser);

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
  }, [store, cleanup, createError]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      // 無音タイムアウト — 自動停止
      if (sessionState === 'recording') {
        stopRecording();
      }
    }, SILENCE_TIMEOUT_SECONDS * 1000);
  }, [sessionState]);

  const stopRecording = useCallback(async () => {
    if (sessionState !== 'recording') return;

    setSessionState('processing');

    // マイクストリーム停止
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // スタブ: 処理完了後にidle状態に戻す
    setTimeout(() => {
      setSessionState('idle');
      store.setVoiceSessionActive(false);
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
  };
}
