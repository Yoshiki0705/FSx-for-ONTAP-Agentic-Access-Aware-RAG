/**
 * POST /api/voice/signaling/credentials
 * KVS GetSignalingChannelEndpoint + GetIceServerConfig を呼び出し、
 * SigV4 署名付き WSS URL と TURN サーバー資格情報を返却する。
 */

import { NextResponse } from 'next/server';
import {
  KinesisVideoClient,
  GetSignalingChannelEndpointCommand,
} from '@aws-sdk/client-kinesis-video';
import {
  KinesisVideoSignalingClient,
  GetIceServerConfigCommand,
} from '@aws-sdk/client-kinesis-video-signaling';
import type { SignalingCredentialsResponse } from '@/types/voice';

export async function POST() {
  try {
    const channelArn = process.env.KVS_SIGNALING_CHANNEL_ARN || '';
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    const voiceChatMode = process.env.VOICE_CHAT_MODE || 'rest';

    if (voiceChatMode !== 'webrtc' || !channelArn) {
      return NextResponse.json(
        { error: 'WebRTC mode is not enabled or channel not configured' },
        { status: 400 }
      );
    }

    // KVS Client でエンドポイントを取得
    const kvsClient = new KinesisVideoClient({ region });
    const endpointResponse = await kvsClient.send(
      new GetSignalingChannelEndpointCommand({
        ChannelARN: channelArn,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ['WSS', 'HTTPS'],
          Role: 'VIEWER',
        },
      })
    );

    const endpoints = endpointResponse.ResourceEndpointList || [];
    const wssEndpoint = endpoints.find(e => e.Protocol === 'WSS')?.ResourceEndpoint || '';
    const httpsEndpoint = endpoints.find(e => e.Protocol === 'HTTPS')?.ResourceEndpoint || '';

    // ICE Server Config を取得（TURN サーバー資格情報）
    const signalingClient = new KinesisVideoSignalingClient({
      region,
      endpoint: httpsEndpoint,
    });

    const iceServerResponse = await signalingClient.send(
      new GetIceServerConfigCommand({
        ChannelARN: channelArn,
      })
    );

    const turnServers: RTCIceServer[] = (iceServerResponse.IceServerList || []).map(server => ({
      urls: server.Uris || [],
      username: server.Username || '',
      credential: server.Password || '',
    }));

    const response: SignalingCredentialsResponse = {
      wssEndpoint,
      turnServers,
      ttl: 300, // 5分
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Signaling Credentials] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get signaling credentials' },
      { status: 500 }
    );
  }
}
