/**
 * WebRTCVoiceStrategy
 * Phase 2 WebRTC ベース音声チャットロジックを Strategy パターンとして実装。
 * RTCPeerConnection + KVS Signaling Channel 経由で AgentCore Runtime と通信する。
 */

import {
  NOVA_SONIC_AUDIO_CONFIG,
  WEBRTC_FALLBACK_CONFIG,
  type WebRTCStats,
  type SignalingConfigResponse,
  type SignalingCredentialsResponse,
  isQualityDegraded,
} from '@/types/voice';
import type { VoiceSessionStrategy } from './VoiceSessionStrategy';

export interface WebRTCStrategyCallbacks {
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onQualityUpdate: (stats: WebRTCStats) => void;
  onError: (code: string, message: string) => void;
  onFallbackNeeded: (reason: string) => void;
}

export class WebRTCVoiceStrategy implements VoiceSessionStrategy {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private connected = false;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private callbacks: WebRTCStrategyCallbacks;

  constructor(callbacks: WebRTCStrategyCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    // 1. ブラウザ WebRTC 対応チェック
    if (typeof RTCPeerConnection === 'undefined') {
      this.callbacks.onError('WEBRTC_NOT_SUPPORTED', 'Browser does not support WebRTC');
      this.callbacks.onFallbackNeeded('WEBRTC_NOT_SUPPORTED');
      return;
    }

    // 2. シグナリング設定を取得
    let config: SignalingConfigResponse;
    let credentials: SignalingCredentialsResponse;
    try {
      const configRes = await fetch('/api/voice/signaling/config');
      if (!configRes.ok) throw new Error(`Config fetch failed: ${configRes.status}`);
      config = await configRes.json();

      const credRes = await fetch('/api/voice/signaling/credentials', { method: 'POST' });
      if (!credRes.ok) throw new Error(`Credentials fetch failed: ${credRes.status}`);
      credentials = await credRes.json();
    } catch (err) {
      this.callbacks.onError('SIGNALING_FAILED', `Signaling setup failed: ${(err as Error).message}`);
      this.callbacks.onFallbackNeeded('SIGNALING_FAILED');
      return;
    }

    // 3. 接続タイムアウト設定（15秒）
    this.connectionTimeout = setTimeout(() => {
      if (!this.connected) {
        this.callbacks.onError('ICE_FAILED', 'WebRTC connection timeout (15s)');
        this.callbacks.onFallbackNeeded('CONNECTION_TIMEOUT');
        this.disconnect();
      }
    }, WEBRTC_FALLBACK_CONFIG.connectionTimeoutMs);

    // 4. RTCPeerConnection 作成
    const iceServers: RTCIceServer[] = [
      ...config.iceServers,
      ...credentials.turnServers,
    ];

    this.peerConnection = new RTCPeerConnection({ iceServers });

    // 5. ICE 状態監視
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (!state) return;
      this.callbacks.onIceConnectionStateChange(state);

      if (state === 'connected' || state === 'completed') {
        this.connected = true;
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.startQualityMonitoring();
      } else if (state === 'failed') {
        this.callbacks.onError('ICE_FAILED', 'ICE connection failed');
        this.callbacks.onFallbackNeeded('ICE_FAILED');
        this.disconnect();
      } else if (state === 'disconnected') {
        // 一時的な切断 — 自動再接続を待つ
        this.connected = false;
      }
    };

    // 6. リモートストリーム受信
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.setupOutputAnalyser(event.streams[0]);
      }
    };

    // 7. マイクアクセス + addTrack
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: NOVA_SONIC_AUDIO_CONFIG.inputSampleRate,
          channelCount: NOVA_SONIC_AUDIO_CONFIG.channels,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      this.localStream = stream;
      this.setupInputAnalyser(stream);

      for (const track of stream.getAudioTracks()) {
        this.peerConnection.addTrack(track, stream);
      }
    } catch (err) {
      const errMsg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : 'Microphone not available';
      this.callbacks.onError('MIC_PERMISSION_DENIED', errMsg);
      this.disconnect();
      return;
    }

    // 8. SDP Offer 生成・送信
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // ICE Candidate 収集完了を待つ（trickle ICE の代わりに vanilla ICE）
      await this.waitForIceCandidates();

      // シグナリングチャネル経由で SDP を交換
      const answerRes = await fetch('/api/voice/signaling/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: this.peerConnection.localDescription?.sdp,
          type: this.peerConnection.localDescription?.type,
        }),
      });

      if (!answerRes.ok) {
        throw new Error(`SDP exchange failed: ${answerRes.status}`);
      }

      const answer = await answerRes.json();
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: answer.type, sdp: answer.sdp })
      );
    } catch (err) {
      this.callbacks.onError('SIGNALING_FAILED', `SDP exchange failed: ${(err as Error).message}`);
      this.callbacks.onFallbackNeeded('SIGNALING_FAILED');
      this.disconnect();
    }
  }

  disconnect(): void {
    // 接続タイムアウトクリア
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 品質モニタリング停止
    this.stopQualityMonitoring();

    // RTCPeerConnection クローズ
    if (this.peerConnection) {
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // ローカルメディアストリーム解放
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
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
    // WebRTC では addTrack で自動送信されるため no-op
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

  // --- Private methods ---

  private setupInputAnalyser(stream: MediaStream): void {
    const ctx = new AudioContext({ sampleRate: NOVA_SONIC_AUDIO_CONFIG.inputSampleRate });
    this.audioContext = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    this.inputAnalyser = analyser;
  }

  private setupOutputAnalyser(stream: MediaStream): void {
    if (!this.audioContext) return;
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    // 出力をスピーカーに接続
    const destination = this.audioContext.destination;
    source.connect(destination);
    this.outputAnalyser = analyser;
  }

  private async waitForIceCandidates(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve();
        return;
      }
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timeout = setTimeout(resolve, 5000); // 5秒で打ち切り
      this.peerConnection.onicegatheringstatechange = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  private startQualityMonitoring(): void {
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection || !this.connected) return;

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 0;
        let packetLoss = 0;
        let jitter = 0;
        let bytesReceived = 0;
        let bytesSent = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetLoss = report.packetsLost && report.packetsReceived
              ? report.packetsLost / (report.packetsLost + report.packetsReceived)
              : 0;
            jitter = report.jitter ? report.jitter * 1000 : 0;
            bytesReceived = report.bytesReceived || 0;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            bytesSent = report.bytesSent || 0;
          }
        });

        const webrtcStats: WebRTCStats = {
          rtt,
          packetLoss,
          jitter,
          bytesReceived,
          bytesSent,
          timestamp: Date.now(),
        };

        this.callbacks.onQualityUpdate(webrtcStats);

        if (isQualityDegraded(webrtcStats)) {
          this.callbacks.onError('QUALITY_DEGRADED', 'Connection quality degraded');
        }
      } catch {
        // Stats collection failed — non-critical
      }
    }, WEBRTC_FALLBACK_CONFIG.statsPollingIntervalMs);
  }

  private stopQualityMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}
