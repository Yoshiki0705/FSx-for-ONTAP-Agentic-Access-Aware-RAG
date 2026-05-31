/**
 * RAG Pipeline — Converse API Client
 *
 * Handles Bedrock Converse API calls with:
 * - Model fallback chain (retries with alternative models on failure)
 * - Conversation history support (AgentCore Memory integration)
 * - On-demand model blocking (routes to fallback)
 *
 * Inspired by MOCA's StreamTerminationRetryStrategy pattern.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { KB_CONVERSE_FALLBACK_MODELS } from '@/config/model-defaults';
import type { ConversationMessage, ConverseResult } from './types';

const ON_DEMAND_BLOCKED = new Set([
  'amazon.nova-pro-v1:0', 'amazon.nova-micro-v1:0', 'amazon.nova-2-lite-v1:0',
  'nvidia.nemotron-super-3-120b',
]);

const CONVERSE_FALLBACK_MODELS = [...KB_CONVERSE_FALLBACK_MODELS];

/**
 * Resolve model ID for Converse API.
 * - Cross-region inference profiles (apac.*, us.*, eu.*) pass through
 * - On-demand blocked models fall back to Haiku
 */
export function resolveConverseModelId(rawModelId: string): string {
  if (/^(apac|us|eu)\./i.test(rawModelId)) return rawModelId;
  if (ON_DEMAND_BLOCKED.has(rawModelId)) return 'anthropic.claude-3-haiku-20240307-v1:0';
  return rawModelId;
}

/**
 * Call Converse API with model fallback chain.
 *
 * Tries the primary model first, then falls back through CONVERSE_FALLBACK_MODELS.
 * Retryable errors: Legacy model, ResourceNotFound, on-demand throughput, ValidationException.
 *
 * @param client - BedrockRuntimeClient instance
 * @param modelId - Primary model ID to try
 * @param prompt - Full prompt (system + context + question)
 * @param conversationHistory - Optional prior conversation messages (AgentCore Memory)
 */
export async function callConverse(
  client: BedrockRuntimeClient,
  modelId: string,
  prompt: string,
  conversationHistory?: ConversationMessage[],
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
      console.log('[Converse] Trying:', mid);
      const resp = await client.send(new ConverseCommand({
        modelId: mid,
        messages,
        inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
      }));
      const outputContent = resp.output?.message?.content?.[0];
      const text = (outputContent && 'text' in outputContent) ? (outputContent.text || '') : '';
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
