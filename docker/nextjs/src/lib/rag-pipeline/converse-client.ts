/**
 * RAG Pipeline — Converse API Client
 *
 * Handles Bedrock Converse API calls with:
 * - Prompt Caching (static system prompt cached, dynamic context per-request)
 * - Model fallback chain (retries with alternative models on failure)
 * - Conversation history support (AgentCore Memory integration)
 * - On-demand model blocking (routes to fallback)
 * - Token usage metrics (EMF format for CloudWatch)
 *
 * @see docs/design/2026q2-ai-update-roadmap.md — Phase 1: Prompt Caching
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { KB_CONVERSE_FALLBACK_MODELS, ON_DEMAND_BLOCKED_MODELS, INFERENCE_PROFILE_MAP } from '@/config/model-defaults';
import type { ConversationMessage, ConverseResult } from './types';

const CONVERSE_FALLBACK_MODELS = [...KB_CONVERSE_FALLBACK_MODELS];

/** Prompt Caching feature toggle (env var) */
const PROMPT_CACHING_ENABLED = process.env.ENABLE_PROMPT_CACHING !== 'false'; // default: true

/**
 * Resolve model ID for Converse API.
 * - Cross-region inference profiles (jp.*, global.*, apac.*, us.*, eu.*) pass through
 * - Base model IDs are mapped to regional inference profiles (required for ap-northeast-1)
 * - On-demand blocked models fall back to Haiku
 */
export function resolveConverseModelId(rawModelId: string): string {
  // Already an inference profile — pass through
  if (/^(jp|global|apac|us|eu)\./i.test(rawModelId)) return rawModelId;
  // On-demand blocked — fall back
  if (ON_DEMAND_BLOCKED_MODELS.has(rawModelId)) return 'anthropic.claude-haiku-4-5-20251001-v1:0';
  // Map base model ID to regional inference profile
  const profileId = INFERENCE_PROFILE_MAP[rawModelId];
  if (profileId) {
    console.log(`[Converse] Resolved inference profile: ${rawModelId} → ${profileId}`);
    return profileId;
  }
  return rawModelId;
}

/**
 * Emit token usage metrics in CloudWatch EMF format.
 * Tracks input/output/cached tokens for cost optimization monitoring.
 */
function emitTokenMetrics(response: ConverseCommandOutput, modelId: string): void {
  const usage = response.usage;
  if (!usage) return;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  // cacheReadInputTokenCount is available when prompt caching is active
  const cachedInputTokens = (usage as any).cacheReadInputTokenCount ?? 0;
  const cacheStatus = cachedInputTokens > 0 ? 'hit' : 'miss';

  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'RAG/TokenUsage',
            Dimensions: [['ModelId', 'CacheStatus']],
            Metrics: [
              { Name: 'InputTokens', Unit: 'Count' },
              { Name: 'OutputTokens', Unit: 'Count' },
              { Name: 'CachedInputTokens', Unit: 'Count' },
            ],
          },
        ],
      },
      ModelId: modelId,
      CacheStatus: cacheStatus,
      InputTokens: inputTokens,
      OutputTokens: outputTokens,
      CachedInputTokens: cachedInputTokens,
    })
  );
}

/**
 * Call Converse API with Prompt Caching and model fallback chain.
 *
 * When ENABLE_PROMPT_CACHING=true (default), the system prompt is sent
 * as a separate system message with cacheControl marker. Bedrock caches
 * the static portion (5-min TTL) and subsequent requests within the window
 * only pay for cache-read tokens (significantly cheaper).
 *
 * @param client - BedrockRuntimeClient instance
 * @param modelId - Primary model ID to try
 * @param prompt - Full user prompt (context + question)
 * @param conversationHistory - Optional prior conversation messages
 * @param systemPrompt - Optional system prompt (static, cacheable)
 */
export async function callConverse(
  client: BedrockRuntimeClient,
  modelId: string,
  prompt: string,
  conversationHistory?: ConversationMessage[],
  systemPrompt?: string,
): Promise<ConverseResult> {
  const historyMessages = (conversationHistory || []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: [{ text: m.content }],
  }));
  const currentMessage = { role: 'user' as const, content: [{ text: prompt }] };
  const messages = [...historyMessages, currentMessage];

  if (historyMessages.length > 0) {
    console.log('[Converse] Request with conversation history:', { historyCount: historyMessages.length });
  }

  const modelsToTry = [modelId, ...CONVERSE_FALLBACK_MODELS.filter(m => m !== modelId)];

  for (const mid of modelsToTry) {
    try {
      console.log('[Converse] Trying:', mid, PROMPT_CACHING_ENABLED ? '(caching enabled)' : '');

      const input: ConverseCommandInput = {
        modelId: mid,
        messages,
        inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
      };

      // Prompt Caching: send system prompt with cacheControl
      if (systemPrompt && PROMPT_CACHING_ENABLED) {
        input.system = [
          {
            text: systemPrompt,
            // cacheControl instructs Bedrock to cache this content block
            // TTL is managed by Bedrock (default: 5 minutes for ephemeral)
            cacheControl: { type: 'ephemeral' },
          } as any, // SDK types may lag behind API — cacheControl is supported
        ];
      } else if (systemPrompt) {
        // Caching disabled — send as plain system message
        input.system = [{ text: systemPrompt }];
      }

      const resp = await client.send(new ConverseCommand(input));

      // Emit token usage metrics
      emitTokenMetrics(resp, mid);

      const outputContent = resp.output?.message?.content?.[0];
      const text = (outputContent && 'text' in outputContent) ? (outputContent.text || '') : '';

      // Log cache effectiveness
      const usage = resp.usage;
      if (usage) {
        const cached = (usage as any).cacheReadInputTokenCount ?? 0;
        const total = usage.inputTokens ?? 0;
        if (cached > 0) {
          console.log(`[Converse] Cache hit: ${cached}/${total} input tokens cached (${Math.round(cached / total * 100)}%)`);
        }
      }

      return { text, usedModel: mid };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isRetryable = errMsg.includes('Legacy') ||
        errMsg.includes('ResourceNotFoundException') ||
        errMsg.includes('on-demand throughput') ||
        errMsg.includes('ValidationException');
      console.warn('[Converse] Failed:', mid, '-', errMsg.substring(0, 150));
      if (!isRetryable) throw err;
    }
  }
  throw new Error('All Converse models failed');
}
