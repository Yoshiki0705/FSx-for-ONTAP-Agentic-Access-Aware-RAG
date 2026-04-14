/**
 * 音声チャット（Nova Sonic）型定義
 */

/** 音声セッションの状態 */
export type VoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'recording'
  | 'processing'
  | 'streaming_response'
  | 'playing'
  | 'error';

/** 音声エラー種別 */
export type VoiceErrorCode =
  | 'MIC_NOT_SUPPORTED'
  | 'MIC_PERMISSION_DENIED'
  | 'WS_CONNECTION_FAILED'
  | 'WS_DISCONNECTED'
  | 'RECOGNITION_EMPTY'
  | 'API_ERROR'
  | 'SESSION_TIMEOUT';

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

/** 音声メッセージ（ChatMessage の拡張） */
export interface VoiceChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  inputType: 'voice' | 'text';
  audioRef?: string;
  responseAudioRef?: string;
  citations?: Array<{ uri: string; title?: string }>;
}

/** WebSocket メッセージプロトコル（クライアント → サーバー） */
export interface VoiceClientMessage {
  type: 'sessionConfig' | 'audioInput' | 'contentEnd';
  payload: VoiceSessionConfig | VoiceAudioInput | Record<string, never>;
}

export interface VoiceSessionConfig {
  mode: 'kb' | 'agent-single' | 'agent-multi';
  agentId?: string;
  language: string;
  sessionId: string;
}

export interface VoiceAudioInput {
  audioData: string; // base64 encoded PCM 16kHz mono
  sequenceNumber: number;
}

/** WebSocket メッセージプロトコル（サーバー → クライアント） */
export interface VoiceServerMessage {
  type: 'sessionReady' | 'transcription' | 'textOutput' | 'audioOutput' | 'citations' | 'error' | 'sessionEnd';
  payload: Record<string, unknown>;
}

/** Nova Sonic 音声設定 */
export interface NovaSonicAudioConfig {
  inputSampleRate: 16000;
  outputSampleRate: 24000;
  channels: 1;
  encoding: 'pcm';
  chunkIntervalMs: 100;
}

/** 音声設定レスポンス */
export interface VoiceConfigResponse {
  enabled: boolean;
  modelId: string;
  supportedLanguages: string[];
  maxRecordingDuration: number;
  silenceTimeout: number;
}

/** Nova Sonic 音声設定定数 */
export const NOVA_SONIC_AUDIO_CONFIG: NovaSonicAudioConfig = {
  inputSampleRate: 16000 as const,
  outputSampleRate: 24000 as const,
  channels: 1 as const,
  encoding: 'pcm' as const,
  chunkIntervalMs: 100 as const,
};

/** チャンクサイズ（16kHz × 100ms = 1600 サンプル） */
export const CHUNK_SAMPLE_COUNT = 1600;

/** 無音タイムアウト（秒） */
export const SILENCE_TIMEOUT_SECONDS = 30;

/** 最大再接続試行回数 */
export const MAX_RECONNECT_ATTEMPTS = 3;

/** Nova Sonic 接続制限（分） */
export const NOVA_SONIC_CONNECTION_LIMIT_MINUTES = 8;

/**
 * PCM 音声バッファをチャンクに分割する
 * 各チャンクは正確に CHUNK_SAMPLE_COUNT サンプル（100ms分）を含む。
 * 最後のチャンクのみそれ以下のサイズを許容する。
 */
export function splitAudioIntoChunks(buffer: Float32Array): Float32Array[] {
  const chunks: Float32Array[] = [];
  for (let offset = 0; offset < buffer.length; offset += CHUNK_SAMPLE_COUNT) {
    const end = Math.min(offset + CHUNK_SAMPLE_COUNT, buffer.length);
    chunks.push(buffer.slice(offset, end));
  }
  return chunks;
}

/**
 * 無音検出: 指定された振幅配列がすべて閾値以下かどうかを判定する
 */
export function isSilent(amplitudes: number[], threshold: number = 0.01): boolean {
  return amplitudes.every(a => Math.abs(a) <= threshold);
}
