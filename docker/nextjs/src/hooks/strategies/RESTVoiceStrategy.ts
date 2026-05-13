/**
 * RESTVoiceStrategy
 * Phase 1 の REST ベース音声チャットロジックを Strategy パターンとして実装。
 * POST /api/voice/stream 経由で Nova Sonic API と通信する。
 */

import { NOVA_SONIC_AUDIO_CONFIG } from '@/types/voice';
import type { VoiceSessionStrategy } from './VoiceSessionStrategy';

export class RESTVoiceStrategy implements VoiceSessionStrategy {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private connected = false;

  async connect(): Promise<void> {
    // マイクアクセス要求
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: NOVA_SONIC_AUDIO_CONFIG.inputSampleRate,
        channelCount: NOVA_SONIC_AUDIO_CONFIG.channels,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.mediaStream = stream;

    // AudioContext セットアップ
    const ctx = new AudioContext({ sampleRate: NOVA_SONIC_AUDIO_CONFIG.inputSampleRate });
    this.audioContext = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    this.inputAnalyser = analyser;

    // 出力用 AnalyserNode
    const outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 256;
    this.outputAnalyser = outAnalyser;

    this.connected = true;
  }

  disconnect(): void {
    // マイクストリーム解放
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    // AudioContext クローズ
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.connected = false;
  }

  sendAudio(_data: Float32Array): void {
    // REST モードでは WebSocket/fetch 経由で送信
    // 実際の送信ロジックは useVoiceSession 側で管理
  }

  getInputAnalyser(): AnalyserNode | null {
    return this.inputAnalyser;
  }

  getOutputAnalyser(): AnalyserNode | null {
    return this.outputAnalyser;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
