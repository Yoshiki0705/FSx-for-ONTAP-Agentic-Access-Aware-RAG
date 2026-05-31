/**
 * RAG Pipeline — Memory Fetcher
 *
 * Retrieves conversation history from AgentCore Memory for context enrichment.
 * Inspired by MOCA's memory-fetcher.ts pattern:
 * - Graceful degradation (returns empty on failure)
 * - Lazy SDK import (no overhead when Memory is disabled)
 * - Actor ID normalization (email → AgentCore-compatible format)
 */

import type { ConversationMessage } from './types';

const ENABLE_AGENTCORE_MEMORY = process.env.ENABLE_AGENTCORE_MEMORY === 'true';
const AGENTCORE_MEMORY_ID = process.env.AGENTCORE_MEMORY_ID || '';

/**
 * Normalize email-based userId to AgentCore-compatible actorId.
 * AgentCore actorId pattern: [a-zA-Z0-9][a-zA-Z0-9-_/]*
 */
export function normalizeActorId(userId: string): string {
  return userId.replace(/@/g, '_at_').replace(/\./g, '_dot_');
}

/**
 * Retrieve recent conversation history from AgentCore Memory.
 *
 * Returns empty array when:
 * - Memory is disabled (ENABLE_AGENTCORE_MEMORY !== 'true')
 * - AGENTCORE_MEMORY_ID is not configured
 * - sessionId is not provided
 * - Retrieval fails (non-fatal, KB search continues without context)
 *
 * @param sessionId - AgentCore Memory session ID
 * @param userId - User email (will be normalized to actorId)
 * @param maxResults - Maximum number of conversation events to retrieve (default: 10)
 */
export async function fetchConversationHistory(
  sessionId: string | undefined,
  userId: string,
  maxResults: number = 10,
): Promise<ConversationMessage[]> {
  if (!ENABLE_AGENTCORE_MEMORY || !AGENTCORE_MEMORY_ID || !sessionId) {
    return [];
  }

  const actorId = normalizeActorId(userId);

  try {
    // Lazy import — no overhead when Memory is disabled
    const { BedrockAgentCoreClient, ListEventsCommand } = await import(
      '@aws-sdk/client-bedrock-agentcore'
    );

    const client = new BedrockAgentCoreClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
    });

    const command = new ListEventsCommand({
      memoryId: AGENTCORE_MEMORY_ID,
      sessionId,
      actorId,
      includePayloads: true,
      maxResults,
    });

    const response = await client.send(command);
    const events = response.events || [];

    const messages: ConversationMessage[] = events
      .map((event) => {
        const conversational = event.payload?.[0]?.conversational;
        if (!conversational?.content?.text || !conversational?.role) return null;
        return {
          role: (conversational.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: conversational.content.text,
        };
      })
      .filter((m): m is ConversationMessage => m !== null);

    console.log('[Memory] Conversation history retrieved:', {
      sessionId,
      messageCount: messages.length,
    });

    return messages;
  } catch (error) {
    // Non-fatal — continue KB search without conversation context
    console.warn('[Memory] Failed to retrieve history (non-fatal):',
      error instanceof Error ? error.message : error);
    return [];
  }
}
