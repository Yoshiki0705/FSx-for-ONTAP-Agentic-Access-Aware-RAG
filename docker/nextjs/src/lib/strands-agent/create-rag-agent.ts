/**
 * Strands Agents SDK — RAG Agent Factory
 *
 * Creates a Permission-Aware RAG Agent using the Strands Agents SDK.
 * This is the Strands equivalent of the Bedrock Agent + Action Group pattern,
 * but with more flexibility:
 *
 * - Locally testable (no AWS deployment needed for agent logic)
 * - Custom tools as TypeScript functions (type-safe)
 * - Streaming support via async iterators
 * - Model-agnostic (Bedrock, OpenAI, Google via model providers)
 * - AgentCore Runtime deployable
 *
 * Inspired by MOCA's createAgent() facade pattern.
 */

import { Agent, BedrockModel, SlidingWindowConversationManager } from '@strands-agents/sdk';
import { permissionAwareSearch } from './permission-aware-search-tool';

export interface CreateRagAgentOptions {
  /** Model ID (default: Claude Haiku 4.5 for cost efficiency) */
  modelId?: string;
  /** AWS Region */
  region?: string;
  /** System prompt override */
  systemPrompt?: string;
  /** Conversation window size (default: 10) */
  conversationWindowSize?: number;
  /** User ID for permission context */
  userId: string;
  /** Disable console output (default: true for API usage) */
  quiet?: boolean;
}

/**
 * Default system prompt for the Permission-Aware RAG Agent.
 */
const DEFAULT_SYSTEM_PROMPT = `You are a Permission-Aware RAG Assistant. You help users find and understand information from their organization's documents.

Key behaviors:
- Always use the permission_aware_search tool to find relevant documents before answering
- Only reference information from documents the user has permission to access
- If no accessible documents are found, clearly state that no relevant information is available
- Respond in the same language as the user's question
- Cite document names when referencing specific information
- If the user asks about documents they don't have access to, explain that the information is restricted

You have access to the following tool:
- permission_aware_search: Searches the knowledge base with automatic permission filtering`;

/**
 * Create a Permission-Aware RAG Agent using Strands SDK.
 *
 * This factory function creates an Agent instance configured for
 * permission-aware document search and Q&A.
 *
 * @example
 * ```typescript
 * const agent = createRagAgent({ userId: 'admin@example.com' });
 * const result = await agent.invoke('What are the Q4 financial results?');
 * console.log(result.lastMessage);
 * ```
 */
export function createRagAgent(options: CreateRagAgentOptions): Agent {
  const {
    modelId = 'anthropic.claude-haiku-4-5-20251001-v1:0',
    region = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1',
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    conversationWindowSize = 10,
    quiet = true,
  } = options;

  // Create Bedrock model provider
  const model = new BedrockModel({
    modelId,
    region,
    temperature: 0.1,
  });

  // Create conversation manager for multi-turn context
  const conversationManager = new SlidingWindowConversationManager({
    windowSize: conversationWindowSize,
    shouldTruncateResults: true,
  });

  // Create the Agent with permission-aware search tool
  const agent = new Agent({
    model,
    tools: [permissionAwareSearch],
    systemPrompt,
    conversationManager,
    printer: !quiet,
  });

  return agent;
}

/**
 * Invoke the RAG Agent with a user query.
 *
 * Convenience function that creates an agent and invokes it in one call.
 * For multi-turn conversations, create the agent once and invoke multiple times.
 */
export async function invokeRagAgent(
  query: string,
  options: CreateRagAgentOptions,
): Promise<{ answer: string; toolResults: unknown[] }> {
  const agent = createRagAgent(options);

  // Inject userId into the query context for the tool
  const enrichedQuery = query;

  const result = await agent.invoke(enrichedQuery);

  return {
    answer: result.lastMessage || 'No response generated.',
    toolResults: result.messages?.filter(m => m.role === 'tool') || [],
  };
}
