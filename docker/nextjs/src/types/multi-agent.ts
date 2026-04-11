/**
 * Multi-Agent Collaboration 型定義
 *
 * Amazon Bedrock Agents のマルチエージェント協調（Supervisor + Collaborator パターン）
 * に必要な型定義を提供する。
 *
 * 既存の BedrockAgentTrace 型の MultiAgentCollaboration インターフェースとの
 * 互換性を維持しつつ、Agent Team 固有の型を定義する。
 */

import type { MultiAgentCollaboration, AgentRoleType } from './bedrock-agent-trace';

// ===== Tool Profile / Trust Level / Data Boundary =====

/**
 * Agent に割り当てられるツール能力の分類。
 * `external-mcp:${string}` パターンで MCP コネクタ拡張をサポート。
 */
export type ToolProfile =
  | 'kb-retrieve'
  | 'vision-analyze'
  | 'access-check'
  | 'schedule-run'
  | 'share-agent'
  | `external-mcp:${string}`;

/** Agent の操作信頼レベル */
export type TrustLevel = 'user-safe' | 'team-safe' | 'admin-only';

/** Agent がアクセス可能なデータ範囲の分類 */
export type DataBoundary = 'public' | 'team-scoped' | 'user-scoped' | 'sensitive-admin';

/** Collaborator Agent の役割 */
export type CollaboratorRole =
  | 'permission-resolver'
  | 'retrieval'
  | 'analysis'
  | 'output'
  | 'vision';

/** Supervisor Agent のルーティング方式 */
export type RoutingMode = 'supervisor_router' | 'supervisor';

// ===== Allowed value sets (used by validators) =====

const KNOWN_TOOL_PROFILES: readonly string[] = [
  'kb-retrieve',
  'vision-analyze',
  'access-check',
  'schedule-run',
  'share-agent',
] as const;

const TRUST_LEVELS: readonly TrustLevel[] = [
  'user-safe',
  'team-safe',
  'admin-only',
] as const;

const DATA_BOUNDARIES: readonly DataBoundary[] = [
  'public',
  'team-scoped',
  'user-scoped',
  'sensitive-admin',
] as const;

const COLLABORATOR_ROLES: readonly CollaboratorRole[] = [
  'permission-resolver',
  'retrieval',
  'analysis',
  'output',
  'vision',
] as const;

const ROUTING_MODES: readonly RoutingMode[] = [
  'supervisor_router',
  'supervisor',
] as const;

// ===== Agent Team Configuration =====

export interface AgentTeamConfig {
  teamId: string;
  teamName: string;
  description: string;
  supervisorAgentId: string;
  supervisorAliasId: string;
  routingMode: RoutingMode;
  autoRouting: boolean;
  collaborators: CollaboratorConfig[];
  versionLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorConfig {
  agentId: string;
  agentAliasId: string;
  agentName: string;
  role: CollaboratorRole;
  foundationModel: string;
  toolProfiles: ToolProfile[];
  trustLevel: TrustLevel;
  dataBoundary: DataBoundary;
  instruction?: string;
}

// ===== Agent Team Trace =====

export interface AgentTeamTraceEvent {
  collaboratorAgentId: string;
  collaboratorAgentAliasId?: string;
  collaboratorRole: CollaboratorRole;
  collaboratorName: string;
  taskDescription: string;
  inputContext?: Record<string, unknown>;
  outputContext?: Record<string, unknown>;
  executionTimeMs: number;
  startTimeMs: number;
  inputTokens?: number;
  outputTokens?: number;
  kbFiltersApplied?: Record<string, string[]>;
  citationsReturned?: number;
  citationsFiltered?: number;
  accessDenied: boolean;
  accessDeniedReason?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  error?: string;
}

export interface MultiAgentTraceResult {
  traceId: string;
  sessionId: string;
  teamId: string;
  routingMode: RoutingMode;
  routingReason?: string;
  routingOverheadMs: number;
  supervisorAgentId: string;
  collaboratorTraces: AgentTeamTraceEvent[];
  guardrailResult?: {
    inputAssessment: 'PASSED' | 'BLOCKED';
    outputAssessment: 'PASSED' | 'BLOCKED' | 'FILTERED';
    filteredCategories?: string[];
  };
  totalExecutionTimeMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  abTestVersion?: string;
}

// ===== MCP Connector =====

export type McpConnectorType = 'ontap-ops' | 'identity-access' | 'document-workflow';

export interface McpConnectorConfig {
  connectorType: McpConnectorType;
  endpointUrl: string;
  allowedOperations: string[];
  trustLevel: TrustLevel;
}

// ===== Multi-Agent Execution Status (リアルタイム UI 用) =====

export interface MultiAgentExecutionStatus {
  isExecuting: boolean;
  currentPhase: 'routing' | 'executing' | 'aggregating' | 'completed' | 'error';
  collaboratorStatuses: Map<
    string,
    {
      role: CollaboratorRole;
      name: string;
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
      elapsedMs: number;
    }
  >;
  elapsedMs: number;
  estimatedCostUsd: number;
}

// ===== Team Template (Export/Import) =====

export interface AgentTeamTemplate {
  schemaVersion: '1.0';
  teamName: string;
  description: string;
  routingMode: RoutingMode;
  autoRouting: boolean;
  supervisorInstruction: string;
  supervisorModel: string;
  collaborators: Array<{
    role: CollaboratorRole;
    agentName: string;
    instruction: string;
    foundationModel: string;
    toolProfiles: ToolProfile[];
    trustLevel: TrustLevel;
    dataBoundary: DataBoundary;
    actionGroups?: Array<{
      name: string;
      description: string;
    }>;
  }>;
  exportedAt: string;
  exportedBy?: string;
}

// ===== A/B Testing =====

export interface ABTestConfig {
  enabled: boolean;
  trafficSplitPercent: number;
  controlVersion: string;
  experimentVersion: string;
}

export interface ABTestMetrics {
  version: string;
  totalRequests: number;
  avgLatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  errorRate: number;
  avgCostUsd: number;
}

// ===== Compatibility re-exports =====

/**
 * 既存の BedrockAgentTrace 型との互換性のための re-export。
 * TraceStep.details.multiAgentDetails で使用される MultiAgentCollaboration と
 * 本ファイルの AgentTeamTraceEvent / MultiAgentTraceResult は補完関係にある。
 *
 * - MultiAgentCollaboration: 低レベルの Agent 間通信・タスク分解情報（Bedrock API レスポンス由来）
 * - MultiAgentTraceResult: 高レベルの Team 実行トレース（フロントエンド表示用）
 */
export type { MultiAgentCollaboration, AgentRoleType } from './bedrock-agent-trace';

// ===== Validation Helpers =====

/**
 * 値が有効な ToolProfile かどうかを判定する。
 * 既知のプロファイル名、または `external-mcp:` プレフィックス付きの文字列を許可する。
 */
export function isValidToolProfile(value: string): value is ToolProfile {
  if (KNOWN_TOOL_PROFILES.includes(value)) {
    return true;
  }
  // external-mcp: プレフィックスの場合、コロン以降に1文字以上必要
  if (value.startsWith('external-mcp:') && value.length > 'external-mcp:'.length) {
    return true;
  }
  return false;
}

/** 値が有効な TrustLevel かどうかを判定する */
export function isValidTrustLevel(value: string): value is TrustLevel {
  return (TRUST_LEVELS as readonly string[]).includes(value);
}

/** 値が有効な DataBoundary かどうかを判定する */
export function isValidDataBoundary(value: string): value is DataBoundary {
  return (DATA_BOUNDARIES as readonly string[]).includes(value);
}

/** 値が有効な CollaboratorRole かどうかを判定する */
export function isValidCollaboratorRole(value: string): value is CollaboratorRole {
  return (COLLABORATOR_ROLES as readonly string[]).includes(value);
}

/** 値が有効な RoutingMode かどうかを判定する */
export function isValidRoutingMode(value: string): value is RoutingMode {
  return (ROUTING_MODES as readonly string[]).includes(value);
}

// ===== Cost Estimation =====

/** モデル別のトークン単価設定 */
export interface ModelPricing {
  inputPricePerToken: number;
  outputPricePerToken: number;
}

/** デフォルトのモデル単価（Claude Sonnet 東京リージョン） */
const DEFAULT_MODEL_PRICING: ModelPricing = {
  inputPricePerToken: 3 / 1_000_000,   // $3 / 1M tokens
  outputPricePerToken: 15 / 1_000_000,  // $15 / 1M tokens
};

/**
 * AgentTeamTraceEvent 配列から合計推定コストを算出する。
 * 各 Collaborator の (inputTokens × inputPrice + outputTokens × outputPrice) の合計を返す。
 */
export function calculateEstimatedCost(
  traces: AgentTeamTraceEvent[],
  modelPricing: ModelPricing = DEFAULT_MODEL_PRICING,
): number {
  let totalCost = 0;
  for (const trace of traces) {
    const inputCost = (trace.inputTokens ?? 0) * modelPricing.inputPricePerToken;
    const outputCost = (trace.outputTokens ?? 0) * modelPricing.outputPricePerToken;
    totalCost += inputCost + outputCost;
  }
  return totalCost;
}
