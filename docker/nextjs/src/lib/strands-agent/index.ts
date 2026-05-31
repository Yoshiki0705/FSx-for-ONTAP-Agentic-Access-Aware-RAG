/**
 * Strands Agents SDK Integration — Public API
 *
 * Provides a Strands-based alternative to the Bedrock Agent (InvokeAgent API)
 * for permission-aware RAG. Benefits over Bedrock Agent:
 *
 * - Locally testable without AWS deployment
 * - Custom tools as TypeScript functions (type-safe, unit-testable)
 * - Streaming via async iterators
 * - Model-agnostic (swap providers without code changes)
 * - AgentCore Runtime deployable for production
 *
 * Migration path:
 *   Bedrock Agent + Action Group → Strands Agent + permission_aware_search tool
 */

export { permissionAwareSearch } from './permission-aware-search-tool';
export { createRagAgent, invokeRagAgent } from './create-rag-agent';
export type { CreateRagAgentOptions } from './create-rag-agent';
