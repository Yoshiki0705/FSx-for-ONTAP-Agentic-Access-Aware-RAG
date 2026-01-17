/**
 * Bedrock Agent Trace 型定義
 */

export interface BedrockAgentTrace {
  traceId: string;
  sessionId: string;
  agentId: string;
  agentAliasId?: string;
  timestamp?: string;
  userQuery?: string;
  finalResponse?: string;
  startTime?: Date;
  endTime?: Date;
  totalDuration?: number;
  totalExecutionTimeMs?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  steps?: TraceStep[];
  events?: TraceEvent[];
  metadata?: {
    foundationModel?: string;
    region?: string;
    gaFeatures2024?: {
      multiAgentEnabled?: boolean;
      inlineAgentEnabled?: boolean;
      payloadReferencingEnabled?: boolean;
    };
  };
}

export interface TraceEvent {
  eventType: 'PRE_PROCESSING' | 'ORCHESTRATION' | 'KNOWLEDGE_BASE_LOOKUP' | 'POST_PROCESSING';
  timestamp: string;
  details: Record<string, any>;
}

export interface AgentTraceRequest {
  agentId: string;
  sessionId: string;
  startTime?: string;
  endTime?: string;
}

export interface AgentTraceResponse {
  success: boolean;
  traces: BedrockAgentTrace[];
  error?: string;
}

export const TRACE_STEP_TYPES = {
  PRE_PROCESSING: 'PRE_PROCESSING',
  ORCHESTRATION: 'ORCHESTRATION',
  KNOWLEDGE_BASE_LOOKUP: 'KNOWLEDGE_BASE_LOOKUP',
  POST_PROCESSING: 'POST_PROCESSING',
  ACTION_GROUP: 'ACTION_GROUP',
  KNOWLEDGE_BASE: 'KNOWLEDGE_BASE',
  MULTI_AGENT_COLLABORATION: 'MULTI_AGENT_COLLABORATION',
  INLINE_AGENT_INVOCATION: 'INLINE_AGENT_INVOCATION',
  PAYLOAD_REFERENCING: 'PAYLOAD_REFERENCING',
  GUARDRAILS: 'GUARDRAILS',  // 追加: Guardrails評価
  BASIC: 'BASIC',
  INTEGRATION: 'INTEGRATION',
  MULTI_AGENT: 'MULTI_AGENT',
  ADVANCED: 'ADVANCED',
} as const;

export type TraceStepType = typeof TRACE_STEP_TYPES[keyof typeof TRACE_STEP_TYPES];

export const TRACE_STEP_STATUSES = {
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export type TraceStepStatus = typeof TRACE_STEP_STATUSES[keyof typeof TRACE_STEP_STATUSES];

export const TRACE_STEP_CATEGORIES = {
  PREPROCESSING: 'PREPROCESSING',
  ORCHESTRATION: 'ORCHESTRATION',
  KNOWLEDGE_BASE: 'KNOWLEDGE_BASE',
  POSTPROCESSING: 'POSTPROCESSING',
  BASIC: 'BASIC',
  INTEGRATION: 'INTEGRATION',
  MULTI_AGENT: 'MULTI_AGENT',
  ADVANCED: 'ADVANCED',
} as const;

export type TraceStepCategory = typeof TRACE_STEP_CATEGORIES[keyof typeof TRACE_STEP_CATEGORIES];

export interface TraceStep {
  id: string;
  stepId?: string;  // 追加: ステップID
  type: TraceStepType;
  status: TraceStepStatus;
  timestamp: string;
  duration?: number;
  executionTimeMs?: number;  // 追加: 実行時間（ミリ秒）
  startTime?: Date;
  endTime?: Date;
  name?: string;
  details?: {
    input?: any;
    output?: any;
    actionGroupResult?: ActionGroupResult;
    knowledgeBaseResult?: KnowledgeBaseResult;
    multiAgentDetails?: MultiAgentCollaboration;
    inlineAgentDetails?: InlineAgentExecution;
    payloadOptimizationDetails?: PayloadReferencingOptimization;
  };
}

export interface ActionGroupResult {
  actionGroupName: string;
  function: string;
  parameters: Record<string, any>;
  result: any;
  response?: {
    statusCode?: number;
    body?: any;
  };
  executionTime?: number;
}

export interface KnowledgeBaseResult {
  knowledgeBaseId: string;
  query: string;
  results: Array<{
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  retrievalTime?: number;
}

export interface MultiAgentDetails {
  agentId: string;
  agentName: string;
  role: string;
  status: TraceStepStatus;
  interactions: Array<{
    timestamp: string;
    message: string;
    type: 'request' | 'response';
  }>;
}

/**
 * Multi-Agent Collaborationの役割タイプ
 */
export type AgentRoleType = 
  | 'SUPERVISOR'      // Supervisor Agent（統括・制御）
  | 'COLLABORATOR'    // Collaborator Agent（協力・実行）
  | 'STANDALONE';     // 単独Agent（従来型）

/**
 * Multi-Agent Collaboration情報
 */
export interface MultiAgentCollaboration {
  /** 現在のAgent役割 */
  currentAgentRole: AgentRoleType;
  /** Supervisor Agent ID（Collaboratorの場合） */
  supervisorAgentId?: string;
  /** Collaborator Agent IDs（Supervisorの場合） */
  collaboratorAgentIds?: string[];
  /** タスク分解情報（Supervisorの場合） */
  taskDecomposition?: {
    /** 元のタスク */
    originalTask: string;
    /** 分解されたサブタスク */
    subTasks: Array<{
      taskId: string;
      description: string;
      assignedAgentId: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
      result?: any;
    }>;
  };
  /** Agent間通信ログ */
  communicationLog?: Array<{
    timestamp: Date;
    fromAgentId: string;
    toAgentId: string;
    messageType: 'TASK_ASSIGNMENT' | 'RESULT_REPORT' | 'STATUS_UPDATE' | 'ERROR_REPORT';
    content: any;
  }>;
}

export interface InlineAgentDetails {
  agentId: string;
  prompt: string;
  response: string;
  model: string;
  parameters?: Record<string, any>;
  executionTime?: number;
}

/**
 * Inline Agent実行情報
 */
export interface InlineAgentExecution {
  /** Inline Agent ID */
  inlineAgentId: string;
  /** 実行タイプ */
  executionType: 'INVOKE_INLINE_AGENT';
  /** 入力パラメータ */
  inputParameters: {
    /** プロンプト */
    prompt: string;
    /** Foundation Model */
    foundationModel: string;
    /** 推論パラメータ */
    inferenceConfig?: {
      temperature?: number;
      topP?: number;
      maxTokens?: number;
    };
  };
  /** 実行結果 */
  executionResult: {
    /** 生成されたレスポンス */
    response: string;
    /** 実行時間（ミリ秒） */
    executionTimeMs: number;
    /** トークン使用量 */
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
    };
  };
  /** 実行ステータス */
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  /** エラー情報（失敗時） */
  error?: {
    message: string;
    code?: string;
  };
}

export interface PayloadReferencingDetails {
  payloadId: string;
  payloadType: 'input' | 'output' | 'intermediate';
  size: number;
  contentType?: string;
  metadata?: Record<string, any>;
}

/**
 * Payload Referencing最適化情報
 */
export interface PayloadReferencingOptimization {
  /** 最適化タイプ */
  optimizationType: 'REFERENCE_BASED' | 'DIRECT_PAYLOAD';
  /** 元のペイロードサイズ（バイト） */
  originalPayloadSize: number;
  /** 最適化後のペイロードサイズ（バイト） */
  optimizedPayloadSize: number;
  /** 削減率（%） */
  reductionPercentage: number;
  /** 参照ID（Reference-basedの場合） */
  referenceId?: string;
  /** 参照情報 */
  referenceInfo?: {
    referenceId: string;
    dataType: string;
    referenceUri: string;
  };
  /** パフォーマンス改善情報 */
  performanceImprovement?: {
    responseTimeReductionMs: number;
  };
  /** S3バケット情報（該当する場合） */
  s3Location?: {
    bucket: string;
    key: string;
  };
}

export class TraceStepTypeUtils {
  static isValidType(type: string): boolean {
    return Object.values(TRACE_STEP_TYPES).includes(type as any);
  }

  static getDisplayName(type: string): string {
    switch (type) {
      case TRACE_STEP_TYPES.PRE_PROCESSING:
        return 'Pre-processing';
      case TRACE_STEP_TYPES.ORCHESTRATION:
        return 'Orchestration';
      case TRACE_STEP_TYPES.KNOWLEDGE_BASE_LOOKUP:
        return 'Knowledge Base Lookup';
      case TRACE_STEP_TYPES.POST_PROCESSING:
        return 'Post-processing';
      case TRACE_STEP_TYPES.ACTION_GROUP:
        return 'Action Group';
      case TRACE_STEP_TYPES.KNOWLEDGE_BASE:
        return 'Knowledge Base';
      case TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION:
        return 'Multi-Agent Collaboration';
      case TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION:
        return 'Inline Agent Invocation';
      case TRACE_STEP_TYPES.PAYLOAD_REFERENCING:
        return 'Payload Referencing';
      default:
        return 'Unknown';
    }
  }
}

export interface SecurityContext {
  userId?: string;
  sessionId: string;
  permissions: string[];
}

export function createDefaultSecurityContext(sessionId: string): SecurityContext {
  return {
    sessionId,
    permissions: ['read', 'write'],
  };
}

export function applySecurityContext(trace: BedrockAgentTrace, context: SecurityContext): BedrockAgentTrace {
  return {
    ...trace,
    sessionId: context.sessionId,
  };
}