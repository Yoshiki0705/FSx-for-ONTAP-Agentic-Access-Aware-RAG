/**
 * VoiceSessionStrategy インターフェース
 * Phase 1 REST モードと Phase 2 WebRTC モードの共通インターフェースを定義する。
 * Strategy パターンにより、useVoiceSession のコンポーネント側インターフェースを変更せずに
 * 内部実装を切り替える。
 */

export interface VoiceSessionStrategy {
  /** 接続を確立する */
  connect(): Promise<void>;

  /** 接続を切断し、リソースを解放する */
  disconnect(): void;

  /**
   * 音声データを送信する
   * WebRTC モードでは addTrack で自動送信されるため no-op
   */
  sendAudio(data: Float32Array): void;

  /** 入力音声の AnalyserNode を取得する */
  getInputAnalyser(): AnalyserNode | null;

  /** 出力音声の AnalyserNode を取得する */
  getOutputAnalyser(): AnalyserNode | null;

  /** 現在の接続状態を取得する */
  isConnected(): boolean;
}

export type VoiceStrategyFactory = () => VoiceSessionStrategy;
