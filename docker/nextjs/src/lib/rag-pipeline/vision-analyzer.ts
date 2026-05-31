/**
 * RAG Pipeline — Vision Analyzer
 *
 * Handles image analysis via Bedrock Vision API (Claude Haiku 4.5).
 * Returns null on failure (caller falls back to text-only query).
 *
 * Features:
 * - 15-second timeout with AbortController
 * - CloudWatch EMF metrics (invocations, timeouts, fallbacks, latency)
 * - Graceful degradation (never blocks the RAG pipeline)
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createMetricsLogger } from '@/lib/monitoring/metrics';

const VISION_MODEL_ID = 'anthropic.claude-haiku-4-5-20251001-v1:0';
const VISION_TIMEOUT_MS = 15_000;

/**
 * Analyze an image using Bedrock Vision API.
 *
 * @param client - BedrockRuntimeClient instance
 * @param imageBase64 - Base64-encoded image data
 * @param imageMimeType - MIME type (image/jpeg, image/png, image/gif, image/webp)
 * @param query - User's text query for context
 * @returns Analysis text or null on failure
 */
export async function analyzeImage(
  client: BedrockRuntimeClient,
  imageBase64: string,
  imageMimeType: string,
  query: string,
): Promise<string | null> {
  const metrics = createMetricsLogger(process.env.ENABLE_MONITORING === 'true');
  metrics.setDimension('Operation', 'vision');
  metrics.putMetric('VisionApiInvocations', 1, 'Count');
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const format = imageMimeType.split('/')[1] as 'jpeg' | 'png' | 'gif' | 'webp';
    console.log('[Vision] Calling Converse API with image, model:', VISION_MODEL_ID, 'format:', format);

    const resp = await client.send(
      new ConverseCommand({
        modelId: VISION_MODEL_ID,
        messages: [{
          role: 'user',
          content: [
            { image: { format, source: { bytes: Buffer.from(imageBase64, 'base64') } } },
            { text: `画像を分析してください。ユーザーの質問: ${query}` },
          ],
        }],
        inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
      }),
      { abortSignal: controller.signal },
    );

    const outputContent = resp.output?.message?.content?.[0];
    const text = (outputContent && 'text' in outputContent) ? (outputContent.text || '') : '';
    console.log('[Vision] Analysis complete, result length:', text.length);
    metrics.putMetric('VisionApiLatency', Date.now() - startTime, 'Milliseconds');
    metrics.flush();
    return text;
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (isTimeout) {
      metrics.putMetric('VisionApiTimeouts', 1, 'Count');
    }
    metrics.putMetric('VisionApiFallbacks', 1, 'Count');
    metrics.putMetric('VisionApiLatency', Date.now() - startTime, 'Milliseconds');
    metrics.flush();
    console.error('[Vision] Failed:', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
