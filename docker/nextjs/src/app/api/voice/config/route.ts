import { NextResponse } from 'next/server';
import type { VoiceConfigResponse } from '@/types/voice';

/**
 * GET /api/voice/config
 * 音声チャット設定の取得エンドポイント
 */
export async function GET() {
  const enabled = process.env.VOICE_CHAT_ENABLED === 'true';
  const modelId = process.env.NOVA_SONIC_MODEL_ID || 'amazon.nova-sonic-v1:0';

  const config: VoiceConfigResponse = {
    enabled,
    modelId,
    supportedLanguages: ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'],
    maxRecordingDuration: 480, // 8 minutes (Nova Sonic limit)
    silenceTimeout: 30,
  };

  return NextResponse.json(config);
}
