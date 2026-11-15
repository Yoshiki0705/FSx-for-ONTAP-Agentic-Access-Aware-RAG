import { NextResponse } from 'next/server';
import type { VoiceConfigResponse } from '@/types/voice';
import { getTierModels } from '@/lib/model-catalog';

/**
 * GET /api/voice/config
 * 音声チャット設定の取得エンドポイント
 */
export async function GET() {
  const enabled = process.env.VOICE_CHAT_ENABLED === 'true';
  // The voice tier: the newest model of the voice family in the region (model catalog).
  let modelId = process.env.NOVA_SONIC_MODEL_ID || '';
  if (enabled && !modelId) {
    modelId = await getTierModels().then((t) => t.voice?.invokeId ?? '').catch(() => '');
  }

  const config: VoiceConfigResponse = {
    enabled,
    modelId,
    supportedLanguages: ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'],
    maxRecordingDuration: 480, // 8 minutes (Nova Sonic limit)
    silenceTimeout: 30,
  };

  return NextResponse.json(config);
}
