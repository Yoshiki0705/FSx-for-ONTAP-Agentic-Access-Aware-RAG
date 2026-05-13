/**
 * POST /api/voice/signaling/exchange
 * SDP Offer/Answer 交換エンドポイント。
 * ブラウザからの SDP Offer を AgentCore Runtime に転送し、SDP Answer を返却する。
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const voiceChatMode = process.env.VOICE_CHAT_MODE || 'rest';
    const agentEndpoint = process.env.VOICE_AGENT_ENDPOINT || '';

    if (voiceChatMode !== 'webrtc') {
      return NextResponse.json(
        { error: 'WebRTC mode is not enabled' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { sdp, type } = body;

    if (!sdp || !type) {
      return NextResponse.json(
        { error: 'Missing sdp or type in request body' },
        { status: 400 }
      );
    }

    // AgentCore Runtime にSDP Offer を転送
    if (!agentEndpoint) {
      // 開発環境: エコーバック（テスト用）
      return NextResponse.json({
        type: 'answer',
        sdp: sdp, // 実際の実装では AgentCore Runtime からの応答
      });
    }

    const agentResponse = await fetch(`${agentEndpoint}/sdp/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp, type }),
    });

    if (!agentResponse.ok) {
      return NextResponse.json(
        { error: `Agent SDP exchange failed: ${agentResponse.status}` },
        { status: 502 }
      );
    }

    const answer = await agentResponse.json();
    return NextResponse.json(answer);
  } catch (error) {
    console.error('[SDP Exchange] Error:', error);
    return NextResponse.json(
      { error: 'SDP exchange failed' },
      { status: 500 }
    );
  }
}
