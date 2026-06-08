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
  InvokeModelCommand,
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
 * Check if a model ID is a Claude model (supports Messages API + Prompt Caching).
 */
function isClaudeModel(modelId: string): boolean {
  return modelId.includes('anthropic.claude');
}

/**
 * Call Claude via Messages API (InvokeModel) with Prompt Caching support.
 * This is required because Converse API does not process cacheControl.
 */
async function callMessagesAPI(
  client: BedrockRuntimeClient,
  modelId: string,
  prompt: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): Promise<{ text: string; usage: Record<string, number> }> {
  const messages: Array<{ role: string; content: string }> = [];
  for (const m of conversationHistory) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: 'user', content: prompt });

  const body: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    temperature: 0.1,
    messages,
  };

  // Apply Prompt Caching via system block with cache_control
  if (PROMPT_CACHING_ENABLED) {
    body.system = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
  } else {
    body.system = [{ type: 'text', text: systemPrompt }];
  }

  const resp = await client.send(new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body),
  }));

  const result = JSON.parse(new TextDecoder().decode(resp.body));
  const text = result.content?.[0]?.text || '';
  const usage = result.usage || {};

  return { text, usage };
}

/**
 * Emit token usage metrics in CloudWatch EMF format (Messages API response).
 */
function emitMessagesAPIMetrics(usage: Record<string, number>, modelId: string): void {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheCreate = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheStatus = cacheRead > 0 ? 'hit' : cacheCreate > 0 ? 'write' : 'miss';

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
              { Name: 'CacheCreationTokens', Unit: 'Count' },
            ],
          },
        ],
      },
      ModelId: modelId,
      CacheStatus: cacheStatus,
      InputTokens: inputTokens,
      OutputTokens: outputTokens,
      CachedInputTokens: cacheRead,
      CacheCreationTokens: cacheCreate,
    })
  );

  if (cacheRead > 0) {
    console.log(`[Messages] Cache hit: ${cacheRead} tokens read from cache (${Math.round(cacheRead / (inputTokens + cacheRead) * 100)}% cached)`);
  } else if (cacheCreate > 0) {
    console.log(`[Messages] Cache write: ${cacheCreate} tokens written (available for 5min)`);
  }
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
      // Use Messages API for Claude models (supports Prompt Caching)
      // Use Converse API for non-Claude models (Nova, etc.)
      if (isClaudeModel(mid) && systemPrompt && PROMPT_CACHING_ENABLED) {
        console.log('[Messages] Trying:', mid, '(Messages API + Prompt Caching)');
        try {
          const { text, usage } = await callMessagesAPI(client, mid, prompt, conversationHistory || [], systemPrompt);
          emitMessagesAPIMetrics(usage, mid);
          return { text, usedModel: mid };
        } catch (messagesErr: unknown) {
          const errMsg = messagesErr instanceof Error ? messagesErr.message : String(messagesErr);
          console.warn('[Messages] Failed, falling back to Converse API:', errMsg.substring(0, 100));
          // Fall through to Converse API below
        }
      }

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
        const cacheWrite = (usage as any).cacheWriteInputTokenCount ?? 0;
        const total = usage.inputTokens ?? 0;
        if (cached > 0) {
          console.log(`[Converse] Cache hit: ${cached}/${total} input tokens cached (${Math.round(cached / total * 100)}%)`);
        } else if (cacheWrite > 0) {
          console.log(`[Converse] Cache write: ${cacheWrite} tokens written to cache (will be available for next request within 5min)`);
        } else {
          console.log(`[Converse] Cache: no write/read (system prompt may be below 1024-token minimum or cacheControl not processed)`);
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
