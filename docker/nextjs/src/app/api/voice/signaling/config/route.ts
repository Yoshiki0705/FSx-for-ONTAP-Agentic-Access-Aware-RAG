/**
 * GET /api/voice/signaling/config
 * WebRTC シグナリング設定を返却する。
 * Cognito JWT 認証が必要。
 */

import { NextResponse } from 'next/server';
import type { SignalingConfigResponse } from '@/types/voice';

export async function GET() {
  try {
    // 環境変数から設定を取得
    const voiceChatMode = process.env.VOICE_CHAT_MODE || 'rest';
    const channelArn = process.env.KVS_SIGNALING_CHANNEL_ARN || '';
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    const agentEndpoint = process.env.VOICE_AGENT_ENDPOINT || '';

    if (voiceChatMode !== 'webrtc') {
      return NextResponse.json(
        { error: 'WebRTC mode is not enabled' },
        { status: 400 }
      );
    }

    if (!channelArn) {
      return NextResponse.json(
        { error: 'KVS Signaling Channel not configured' },
        { status: 500 }
      );
    }

    const response: SignalingConfigResponse = {
      channelArn,
      region,
      iceServers: [
        { urls: `stun:stun.kinesisvideo.${region}.amazonaws.com:443` },
      ],
      agentEndpoint,
      mode: 'webrtc',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Signaling Config] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
