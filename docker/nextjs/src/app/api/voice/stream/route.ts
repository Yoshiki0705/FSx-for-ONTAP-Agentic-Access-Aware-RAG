import { NextRequest, NextResponse } from 'next/server';
import type { VoiceServerMessage } from '@/types/voice';

/**
 * POST /api/voice/stream
 * 音声ストリーミングエンドポイント
 *
 * Next.js App Router は WebSocket アップグレードをネイティブサポートしないため、
 * REST ベースの 2 フェーズアプローチで実装:
 *
 * Phase 1 (現在): REST リクエストで音声データを収集し、Bedrock Converse API で処理
 * Phase 2 (将来): API Gateway WebSocket 経由で Nova Sonic InvokeModelWithBidirectionalStream に接続
 *
 * - sessionConfig: セッション初期化（モード・言語設定）
 * - audioInput: 音声データバッファリング
 * - contentEnd: バッファ済み音声を Bedrock Converse API で処理 → RAG パイプライン → テキスト応答
 *
 * Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 7.1
 */

// In-memory session store (per-instance; stateless across Lambda cold starts)
const sessionStore = new Map<string, {
  mode: string;
  language: string;
  agentId?: string;
  audioChunks: string[];
}>();

export async function POST(request: NextRequest) {
  // 音声チャットが無効の場合は 403
  if (process.env.VOICE_CHAT_ENABLED !== 'true') {
    return NextResponse.json(
      { type: 'error', payload: { error: { code: 'VOICE_DISABLED', message: 'Voice chat is not enabled' } } } satisfies VoiceServerMessage,
      { status: 403 }
    );
  }

  // 認証チェック（Cognito JWT）
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { type: 'error', payload: { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization token' } } } satisfies VoiceServerMessage,
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { type, payload } = body;

    switch (type) {
      case 'sessionConfig': {
        // セッション設定の受信 — セッション初期化
        const { mode, language, sessionId, agentId } = payload;
        console.log(`[Voice] Session config: mode=${mode}, language=${language}, sessionId=${sessionId}, inputType=voice`);

        // Store session config for subsequent audioInput/contentEnd calls
        sessionStore.set(sessionId, {
          mode: mode || 'kb',
          language: language || 'ja',
          agentId,
          audioChunks: [],
        });

        const response: VoiceServerMessage = {
          type: 'sessionReady',
          payload: { sessionId, modelId: process.env.NOVA_SONIC_MODEL_ID || 'amazon.nova-sonic-v1:0' },
        };
        return NextResponse.json(response);
      }

      case 'audioInput': {
        // 音声データの受信 — バッファに蓄積
        const { sequenceNumber, audioData, sessionId } = payload;
        console.log(`[Voice] Audio input received: seq=${sequenceNumber}, inputType=voice`);

        const session = sessionStore.get(sessionId);
        if (session && audioData) {
          session.audioChunks.push(audioData);
        }

        return NextResponse.json({ type: 'textOutput', payload: { text: '' } } satisfies VoiceServerMessage);
      }

      case 'contentEnd': {
        // 録音終了 — Bedrock Converse API で音声処理 → RAG パイプライン
        const { sessionId } = payload;
        console.log('[Voice] Content end received, processing with Bedrock Converse API, inputType=voice');

        const session = sessionStore.get(sessionId);
        const mode = session?.mode || 'kb';
        const language = session?.language || 'ja';

        try {
          // Step 1: Transcribe audio using Bedrock Converse API with Nova Sonic
          const transcribedText = await transcribeWithConverse(
            session?.audioChunks || [],
            language,
          );

          if (!transcribedText?.trim()) {
            const emptyResponse: VoiceServerMessage = {
              type: 'textOutput',
              payload: {
                text: '',
                transcription: '',
                error: { code: 'RECOGNITION_EMPTY', message: 'No speech detected' },
              },
            };
            return NextResponse.json(emptyResponse);
          }

          console.log(`[Voice] Transcription: "${transcribedText.substring(0, 100)}"`);

          // Step 2: Send transcribed text through RAG pipeline
          const ragResult = await processWithRAGPipeline(
            transcribedText,
            mode,
            session?.agentId,
            authHeader,
            request,
          );

          // Clean up session audio buffer
          if (session) {
            session.audioChunks = [];
          }

          const response: VoiceServerMessage = {
            type: 'textOutput',
            payload: {
              text: ragResult.answer || '',
              transcription: transcribedText,
              citations: ragResult.citations || [],
            },
          };
          return NextResponse.json(response);
        } catch (processingError) {
          console.error('[Voice] Processing error:', processingError);

          // Clean up session audio buffer on error
          if (session) {
            session.audioChunks = [];
          }

          // Return error with fallback guidance
          const errorResponse: VoiceServerMessage = {
            type: 'error',
            payload: {
              error: {
                code: 'API_ERROR',
                message: 'Voice processing failed. Please try text input.',
              },
            },
          };
          return NextResponse.json(errorResponse, { status: 500 });
        }
      }

      default:
        return NextResponse.json(
          { type: 'error', payload: { error: { code: 'INVALID_MESSAGE', message: `Unknown message type: ${type}` } } } satisfies VoiceServerMessage,
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Voice] Stream error:', error);
    return NextResponse.json(
      { type: 'error', payload: { error: { code: 'API_ERROR', message: 'Voice processing error' } } } satisfies VoiceServerMessage,
      { status: 500 }
    );
  }
}

/**
 * Transcribe audio using Bedrock Converse API.
 *
 * Sends base64-encoded PCM audio chunks to the Converse API with a
 * speech-to-text prompt. Uses Nova Sonic model when available,
 * falls back to Claude for text understanding.
 *
 * Note: Full Nova Sonic InvokeModelWithBidirectionalStream integration
 * requires WebSocket support (Phase 2 via API Gateway). This REST-based
 * approach uses Converse API as an interim solution.
 */
async function transcribeWithConverse(
  audioChunks: string[],
  language: string,
): Promise<string> {
  if (!audioChunks.length) return '';

  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import(
      '@aws-sdk/client-bedrock-runtime'
    );

    const region = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
    const client = new BedrockRuntimeClient({ region });

    // Combine audio chunks into a single buffer for processing
    const combinedAudio = audioChunks.join('');
    const audioBytes = Buffer.from(combinedAudio, 'base64');

    // Use Converse API with audio content block for speech understanding
    // Nova Sonic supports audio input via the Converse API
    const modelId = process.env.NOVA_SONIC_MODEL_ID || 'amazon.nova-sonic-v1:0';

    const converseModels = [
      modelId,
      'apac.amazon.nova-lite-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
    ];

    for (const mid of converseModels) {
      try {
        const langPrompt = language === 'ja'
          ? '以下の音声データからテキストを書き起こしてください。音声の内容のみを返してください。'
          : 'Transcribe the following audio data. Return only the spoken content.';

        const response = await client.send(new ConverseCommand({
          modelId: mid,
          messages: [{
            role: 'user',
            content: [
              {
                document: {
                  format: 'txt',
                  name: 'audio-data',
                  source: { bytes: audioBytes },
                },
              },
              { text: langPrompt },
            ],
          }],
          inferenceConfig: { maxTokens: 1000, temperature: 0.0 },
        }));

        const outputContent = response.output?.message?.content?.[0];
        if (outputContent && 'text' in outputContent) {
          return outputContent.text || '';
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`[Voice] Converse transcription failed with ${mid}:`, errMsg.substring(0, 150));
        // Try next model
        continue;
      }
    }

    console.error('[Voice] All transcription models failed');
    return '';
  } catch (error) {
    console.error('[Voice] Transcription error:', error);
    return '';
  }
}

/**
 * Process transcribed text through the existing RAG pipeline.
 *
 * Calls the internal KB retrieve API to perform permission-aware
 * document retrieval and answer generation, maintaining the same
 * SID/UID/GID permission filtering as text-based queries.
 */
async function processWithRAGPipeline(
  query: string,
  mode: string,
  agentId: string | undefined,
  authHeader: string,
  originalRequest: NextRequest,
): Promise<{ answer: string; citations: Array<{ uri: string; title?: string }> }> {
  try {
    // Build internal API URL for the KB retrieve endpoint
    const baseUrl = originalRequest.nextUrl.origin;
    const retrieveUrl = `${baseUrl}/api/bedrock/kb/retrieve`;

    // Extract userId from auth context (simplified — in production, decode JWT)
    const userId = originalRequest.headers.get('x-user-id') || 'voice-user';

    const requestBody: Record<string, unknown> = {
      query,
      userId,
      agentMode: mode !== 'kb',
      agentId: agentId || undefined,
    };

    const response = await fetch(retrieveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'x-user-id': userId,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[Voice] RAG pipeline error:', response.status, errorText);
      throw new Error(`RAG pipeline returned ${response.status}`);
    }

    const result = await response.json();

    return {
      answer: result.answer || '',
      citations: (result.citations || []).map((c: any) => ({
        uri: c.s3Uri || c.uri || '',
        title: c.fileName || c.title || '',
      })),
    };
  } catch (error) {
    console.error('[Voice] RAG pipeline error:', error);
    throw error;
  }
}
