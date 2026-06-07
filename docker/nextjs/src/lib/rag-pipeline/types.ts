/**
 * RAG Pipeline — Shared type definitions
 *
 * Centralizes types used across the permission-aware RAG pipeline modules.
 */

import type { MediaType, ActiveKBType } from '@/types/multimodal';

export interface RetrieveRequest {
  query: string;
  knowledgeBaseId?: string;
  modelId?: string;
  userId: string;
  region?: string;
  agentMode?: boolean;
  agentId?: string;
  imageData?: string;
  imageMimeType?: string;
  isAutoRouted?: boolean;
  routingClassification?: 'simple' | 'complex';
  memorySessionId?: string;
  activeKbType?: ActiveKBType;
  mediaTypeFilter?: string;
  searchType?: 'SEMANTIC' | 'HYBRID';
  /** User explicitly requests web search fallback */
  useWebSearch?: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserAccessRecord {
  userId: string;
  userSID: string;
  groupSIDs: string[];
  accessSchedule?: import('@/lib/permissions/schedule-evaluator').AccessSchedule;
}

export interface ParsedRetrievalResult {
  content: string;
  s3Uri: string;
  score?: number;
  metadata: Record<string, unknown>;
  mediaType?: MediaType;
}

export interface AllowedDocument {
  fileName: string;
  s3Uri: string;
  content: string;
  metadata: Record<string, unknown>;
  mediaType?: MediaType;
}

export interface FilterResult {
  allowed: AllowedDocument[];
  filterLog: Record<string, unknown>;
}

export interface ConverseResult {
  text: string;
  usedModel: string;
}
