/**
 * RAG Pipeline — Public Facade
 *
 * Inspired by MOCA's agent.ts facade pattern:
 * A single, discoverable entry point that orchestrates the permission-aware
 * RAG pipeline. Each concern is delegated to a dedicated module.
 *
 * Modules:
 * - sid-filter.ts       — SID-based permission filtering (Lambda + inline fallback)
 * - converse-client.ts  — Bedrock Converse API with model fallback chain
 * - vision-analyzer.ts  — Image analysis via Vision API
 * - memory-fetcher.ts   — AgentCore Memory conversation history retrieval
 * - routing-metrics.ts  — Smart Routing CloudWatch EMF metrics
 * - types.ts            — Shared type definitions
 */

export { filterByPermissions, getUserSIDs, checkSIDAccess } from './sid-filter';
export { callConverse, resolveConverseModelId } from './converse-client';
export { analyzeImage } from './vision-analyzer';
export { fetchConversationHistory, normalizeActorId } from './memory-fetcher';
export { emitRoutingMetrics } from './routing-metrics';
export type {
  RetrieveRequest,
  ConversationMessage,
  UserAccessRecord,
  ParsedRetrievalResult,
  AllowedDocument,
  FilterResult,
  ConverseResult,
} from './types';
