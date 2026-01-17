/**
 * Bedrock Agent Trace型定義
 * 
 * Amazon Bedrock Agentの実行トレース情報を表現する型定義
 * Phase 1.1: BedrockAgentTrace型定義の拡張
 * 
 * 作成日: 2025-12-13
 * 要件: Requirements 6.1 (Agent実行トレース機能)
 */

// ============================================================================
// 基本型定義（2024年GA機能統合版）
// ============================================================================

/**
 * トレースステップのタイプ（2024年GA機能対応）
 */
export type TraceStepType = 
  | 'PRE_PROCESSING'      // 前処理
  | 'ORCHESTRATION'       // オーケストレーション
  | 'POST_PROCESSING'     // 後処理
  | 'KNOWLEDGE_BASE'      // Knowledge Base検索
  | 'ACTION_GROUP'        // Action Group実行
  | 'GUARDRAILS'          // Guardrails評価
  | 'FINAL_RESPONSE'      // 最終レスポンス
  // 2024年GA機能追加
  | 'MULTI_AGENT_COLLABORATION'  // Multi-Agent連携
  | 'INLINE_AGENT_INVOCATION'    // Inline Agent実行
  | 'PAYLOAD_REFERENCING'        // Payload Referencing最適化
  | 'SUPERVISOR_ORCHESTRATION'   // Supervisor Agent制御
  | 'COLLABORATOR_EXECUTION';    // Collaborator Agent実行

/**
 * トレースステップの実行状態
 */
export type TraceStepStatus = 
  | 'STARTED'             // 開始
  | 'IN_PROGRESS'         // 実行中
  | 'COMPLETED'           // 完了
  | 'FAILED'              // 失敗
  | 'SKIPPED';            // スキップ

/**
 * Action Groupの実行結果
 */
export interface ActionGroupResult {
  /** Action Group名 */
  actionGroupName: string;
  /** 実行されたAPI名 */
  apiName: string;
  /** 入力パラメータ */
  parameters: Record<string, any>;
  /** 実行結果 */
  response: any;
  /** 実行時間（ミリ秒） */
  executionTimeMs: number;
  /** 実行状態 */
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  /** エラーメッセージ（失敗時） */
  errorMessage?: string;
}

/**
 * Knowledge Base検索結果
 */
export interface KnowledgeBaseResult {
  /** Knowledge Base ID */
  knowledgeBaseId: string;
  /** 検索クエリ */
  query: string;
  /** 検索結果ドキュメント */
  documents: Array<{
    /** ドキュメントID */
    documentId: string;
    /** ドキュメントタイトル */
    title: string;
    /** ドキュメント内容（抜粋） */
    content: string;
    /** 類似度スコア */
    score: number;
    /** メタデータ */
    metadata: Record<string, any>;
  }>;
  /** 検索実行時間（ミリ秒） */
  searchTimeMs: number;
  /** 検索結果数 */
  resultCount: number;
}

/**
 * Guardrails評価結果
 */
export interface GuardrailsResult {
  /** Guardrails ID */
  guardrailId: string;
  /** 評価結果 */
  action: 'ALLOWED' | 'BLOCKED' | 'WARNED';
  /** ブロック理由（ブロック時） */
  blockReason?: string;
  /** 警告メッセージ（警告時） */
  warningMessage?: string;
  /** 評価時間（ミリ秒） */
  evaluationTimeMs: number;
}

// ============================================================================
// 2024年GA機能型定義
// ============================================================================

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
  /** 参照情報（Reference-based最適化の場合） */
  referenceInfo?: {
    /** 参照ID */
    referenceId: string;
    /** 参照先URI */
    referenceUri: string;
    /** 参照データタイプ */
    dataType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'STRUCTURED_DATA';
  };
  /** パフォーマンス向上情報 */
  performanceImprovement: {
    /** レスポンス時間短縮（ミリ秒） */
    responseTimeReductionMs: number;
    /** 帯域幅削減（バイト） */
    bandwidthSavingBytes: number;
    /** コスト削減推定（USD） */
    estimatedCostSavingUsd?: number;
  };
}

// ============================================================================
// オーケストレーション詳細型定義
// ============================================================================

/**
 * Rationale（推論過程）
 */
export interface TraceRationale {
  /** 推論テキスト */
  text: string;
  /** 推論の信頼度（0-1） */
  confidence?: number;
  /** 推論に使用されたコンテキスト */
  context?: string[];
}

/**
 * Action（実行アクション）
 */
export interface TraceAction {
  /** アクションタイプ */
  type: 'KNOWLEDGE_BASE_LOOKUP' | 'ACTION_GROUP_INVOCATION' | 'FINAL_RESPONSE';
  /** アクション名 */
  name: string;
  /** アクション入力 */
  input: Record<string, any>;
  /** アクション実行時間（ミリ秒） */
  executionTimeMs: number;
}

/**
 * Observation（観測結果）
 */
export interface TraceObservation {
  /** 観測タイプ */
  type: 'KNOWLEDGE_BASE_RESULT' | 'ACTION_GROUP_RESULT' | 'ERROR';
  /** 観測内容 */
  content: any;
  /** 観測時刻 */
  timestamp: Date;
  /** 関連するアクション */
  relatedAction?: string;
}

/**
 * オーケストレーションステップ
 */
export interface OrchestrationStep {
  /** ステップID */
  stepId: string;
  /** ステップ番号 */
  stepNumber: number;
  /** 推論過程 */
  rationale: TraceRationale;
  /** 実行アクション */
  action: TraceAction;
  /** 観測結果 */
  observation: TraceObservation;
  /** ステップ実行時間（ミリ秒） */
  executionTimeMs: number;
  /** ステップ状態 */
  status: TraceStepStatus;
}

// ============================================================================
// メイントレース型定義
// ============================================================================

/**
 * トレースステップ詳細
 */
export interface TraceStep {
  /** ステップID */
  stepId: string;
  /** ステップタイプ */
  type: TraceStepType;
  /** ステップ名 */
  name: string;
  /** 開始時刻 */
  startTime: Date;
  /** 終了時刻 */
  endTime?: Date;
  /** 実行時間（ミリ秒） */
  executionTimeMs?: number;
  /** ステップ状態 */
  status: TraceStepStatus;
  /** ステップ詳細情報（2024年GA機能統合版） */
  details: {
    /** 入力データ */
    input?: any;
    /** 出力データ */
    output?: any;
    /** エラー情報 */
    error?: {
      message: string;
      code?: string;
      details?: any;
    };
    /** Action Group結果（該当する場合） */
    actionGroupResult?: ActionGroupResult;
    /** Knowledge Base結果（該当する場合） */
    knowledgeBaseResult?: KnowledgeBaseResult;
    /** Guardrails結果（該当する場合） */
    guardrailsResult?: GuardrailsResult;
    /** オーケストレーションステップ（該当する場合） */
    orchestrationSteps?: OrchestrationStep[];
    // 2024年GA機能追加
    /** Multi-Agent Collaboration詳細（該当する場合） */
    multiAgentDetails?: {
      /** 現在のAgent役割 */
      agentRole: AgentRoleType;
      /** タスク分解結果（Supervisorの場合） */
      taskDecomposition?: MultiAgentCollaboration['taskDecomposition'];
      /** Agent間通信（該当する場合） */
      interAgentCommunication?: MultiAgentCollaboration['communicationLog'];
    };
    /** Inline Agent実行詳細（該当する場合） */
    inlineAgentDetails?: InlineAgentExecution;
    /** Payload Referencing最適化詳細（該当する場合） */
    payloadOptimizationDetails?: PayloadReferencingOptimization;
  };
  /** 子ステップ */
  subSteps?: TraceStep[];
}

/**
 * Bedrock Agent実行トレース（拡張版）
 */
export interface BedrockAgentTrace {
  /** トレースID */
  traceId: string;
  /** セッションID */
  sessionId: string;
  /** Agent ID */
  agentId: string;
  /** Agent Alias ID */
  agentAliasId: string;
  /** ユーザークエリ */
  userQuery: string;
  /** 最終レスポンス */
  finalResponse: string;
  /** トレース開始時刻 */
  startTime: Date;
  /** トレース終了時刻 */
  endTime?: Date;
  /** 総実行時間（ミリ秒） */
  totalExecutionTimeMs?: number;
  /** トレース状態 */
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  /** トレースステップ */
  steps: TraceStep[];
  /** メタデータ（2024年GA機能統合版） */
  metadata: {
    /** 使用モデル */
    foundationModel: string;
    /** リージョン */
    region: string;
    /** トークン使用量 */
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    /** セッション属性 */
    sessionAttributes?: Record<string, string>;
    /** プロンプトセッション属性 */
    promptSessionAttributes?: Record<string, string>;
    // 2024年GA機能追加
    /** Multi-Agent Collaboration情報 */
    multiAgentCollaboration?: MultiAgentCollaboration;
    /** Inline Agent実行情報 */
    inlineAgentExecutions?: InlineAgentExecution[];
    /** Payload Referencing最適化情報 */
    payloadOptimization?: PayloadReferencingOptimization;
    /** 2024年GA機能フラグ */
    gaFeatures2024: {
      /** Multi-Agent Collaboration有効 */
      multiAgentEnabled: boolean;
      /** Inline Agent有効 */
      inlineAgentEnabled: boolean;
      /** Payload Referencing有効 */
      payloadReferencingEnabled: boolean;
    };
  };
  /** エラー情報（失敗時） */
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

// ============================================================================
// セキュリティ関連型定義
// ============================================================================

/**
 * セキュリティレベル定義
 */
export type SecurityLevel = 
  | 'PUBLIC'        // 公開情報
  | 'INTERNAL'      // 内部情報
  | 'CONFIDENTIAL'  // 機密情報
  | 'RESTRICTED';   // 制限情報

/**
 * トレースセキュリティコンテキスト
 */
export interface TraceSecurityContext {
  /** セキュリティレベル */
  securityLevel: SecurityLevel;
  /** データ分類 */
  dataClassification: {
    /** 個人情報を含むか */
    containsPII: boolean;
    /** 機密データを含むか */
    containsConfidentialData: boolean;
    /** 規制対象データを含むか */
    containsRegulatedData: boolean;
  };
  /** アクセス制御 */
  accessControl: {
    /** 必要な権限レベル */
    requiredPermissions: string[];
    /** アクセス可能なロール */
    allowedRoles: string[];
    /** 地理的制限 */
    geographicRestrictions?: string[];
  };
  /** 監査要件 */
  auditRequirements: {
    /** 監査ログが必要か */
    auditLogRequired: boolean;
    /** 保持期間（日数） */
    retentionPeriodDays: number;
    /** コンプライアンス要件 */
    complianceRequirements: string[];
  };
  /** 暗号化要件 */
  encryptionRequirements: {
    /** 保存時暗号化が必要か */
    encryptionAtRest: boolean;
    /** 転送時暗号化が必要か */
    encryptionInTransit: boolean;
    /** 使用する暗号化アルゴリズム */
    encryptionAlgorithm?: string;
  };
}

/**
 * セキュアトレースステップ
 * セキュリティ情報を含むトレースステップの拡張版
 */
export interface SecureTraceStep extends TraceStep {
  /** セキュリティコンテキスト */
  securityContext: TraceSecurityContext;
  /** マスク済みデータ */
  maskedDetails?: {
    /** マスクされた入力データ */
    maskedInput?: any;
    /** マスクされた出力データ */
    maskedOutput?: any;
    /** マスクパターン */
    maskingPatterns: string[];
  };
  /** セキュリティイベント */
  securityEvents?: Array<{
    /** イベントタイプ */
    eventType: 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'PERMISSION_ESCALATION' | 'SUSPICIOUS_ACTIVITY';
    /** イベント時刻 */
    timestamp: Date;
    /** イベント詳細 */
    details: string;
    /** 重要度 */
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

/**
 * セキュアBedrockAgentTrace
 * セキュリティ情報を含むトレースの拡張版
 */
export interface SecureBedrockAgentTrace extends Omit<BedrockAgentTrace, 'steps'> {
  /** セキュアトレースステップ */
  steps: SecureTraceStep[];
  /** 全体のセキュリティコンテキスト */
  globalSecurityContext: TraceSecurityContext;
  /** セキュリティ監査ログ */
  securityAuditLog: Array<{
    /** 監査イベントID */
    auditEventId: string;
    /** 監査時刻 */
    timestamp: Date;
    /** 監査対象ユーザー */
    userId: string;
    /** 実行されたアクション */
    action: string;
    /** アクセスされたリソース */
    resource: string;
    /** 結果 */
    result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    /** 詳細情報 */
    details?: any;
  }>;
  /** データ保護情報 */
  dataProtection: {
    /** データマスキングが適用されているか */
    maskingApplied: boolean;
    /** 暗号化が適用されているか */
    encryptionApplied: boolean;
    /** データ匿名化が適用されているか */
    anonymizationApplied: boolean;
    /** 適用されたプライバシー保護手法 */
    privacyProtectionMethods: string[];
  };
}

/**
 * セキュリティポリシー設定
 */
export interface SecurityPolicyConfig {
  /** デフォルトセキュリティレベル */
  defaultSecurityLevel: SecurityLevel;
  /** 自動マスキング設定 */
  autoMasking: {
    /** 有効かどうか */
    enabled: boolean;
    /** マスキングパターン */
    patterns: Array<{
      /** パターン名 */
      name: string;
      /** 正規表現パターン */
      regex: string;
      /** 置換文字列 */
      replacement: string;
    }>;
  };
  /** アクセス制御設定 */
  accessControl: {
    /** 厳格モード */
    strictMode: boolean;
    /** デフォルト権限 */
    defaultPermissions: string[];
    /** ロールベースアクセス制御 */
    rbacEnabled: boolean;
  };
  /** 監査設定 */
  auditConfig: {
    /** 全アクションを監査するか */
    auditAllActions: boolean;
    /** 監査対象アクション */
    auditedActions: string[];
    /** 監査ログの保持期間（日数） */
    auditRetentionDays: number;
  };
}

// ============================================================================
// UI表示用型定義
// ============================================================================

/**
 * トレース表示設定
 */
export interface TraceDisplayConfig {
  /** 展開されたステップID */
  expandedSteps: Set<string>;
  /** 表示するステップタイプ */
  visibleStepTypes: Set<TraceStepType>;
  /** 詳細表示モード */
  detailMode: 'SIMPLE' | 'DETAILED';
  /** タイムライン表示 */
  showTimeline: boolean;
  /** パフォーマンス情報表示 */
  showPerformance: boolean;
}

/**
 * トレース統計情報
 */
export interface TraceStatistics {
  /** 総ステップ数 */
  totalSteps: number;
  /** ステップタイプ別カウント */
  stepTypeCounts: Record<TraceStepType, number>;
  /** 平均実行時間（ミリ秒） */
  averageExecutionTimeMs: number;
  /** 最長実行ステップ */
  longestStep?: {
    stepId: string;
    name: string;
    executionTimeMs: number;
  };
  /** エラー数 */
  errorCount: number;
  /** 成功率（%） */
  successRate: number;
}

/**
 * トレースフィルター設定
 */
export interface TraceFilter {
  /** 時間範囲 */
  timeRange?: {
    start: Date;
    end: Date;
  };
  /** ステップタイプフィルター */
  stepTypes?: TraceStepType[];
  /** ステータスフィルター */
  statuses?: TraceStepStatus[];
  /** キーワード検索 */
  keyword?: string;
  /** 最小実行時間（ミリ秒） */
  minExecutionTimeMs?: number;
  /** 最大実行時間（ミリ秒） */
  maxExecutionTimeMs?: number;
}

// ============================================================================
// エクスポート・検索用型定義
// ============================================================================

/**
 * トレースエクスポート形式
 */
export type TraceExportFormat = 'JSON' | 'CSV' | 'XML';

/**
 * トレースエクスポート設定
 */
export interface TraceExportConfig {
  /** エクスポート形式 */
  format: TraceExportFormat;
  /** 含めるフィールド */
  includeFields: string[];
  /** 詳細レベル */
  detailLevel: 'SUMMARY' | 'DETAILED' | 'FULL';
  /** 時間範囲 */
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * トレース検索結果
 */
export interface TraceSearchResult {
  /** 検索結果トレース */
  traces: BedrockAgentTrace[];
  /** 総件数 */
  totalCount: number;
  /** ページ情報 */
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
  /** 検索統計 */
  statistics: TraceStatistics;
}

// ============================================================================
// 既存型との互換性
// ============================================================================

/**
 * 既存のAgentTrace型との互換性を保つためのマッピング型
 * @deprecated 新しいBedrockAgentTrace型を使用してください
 */
export interface LegacyAgentTrace {
  timestamp: Date;
  query: string;
  trace: any; // 既存の実装との互換性のため
}

/**
 * 既存のAgentTrace型をBedrockAgentTrace型に変換する関数
 */
export function convertLegacyTrace(legacyTrace: LegacyAgentTrace): BedrockAgentTrace {
  return {
    traceId: `legacy_${Date.now()}`,
    sessionId: 'unknown',
    agentId: 'unknown',
    agentAliasId: 'unknown',
    userQuery: legacyTrace.query,
    finalResponse: '',
    startTime: legacyTrace.timestamp,
    status: 'COMPLETED',
    steps: [],
    metadata: {
      foundationModel: 'unknown',
      region: 'unknown',
      gaFeatures2024: {
        multiAgentEnabled: false,
        inlineAgentEnabled: false,
        payloadReferencingEnabled: false
      }
    }
  };
}

/**
 * BedrockAgentTrace型を既存のAgentTrace型に変換する関数
 */
export function convertToLegacyTrace(trace: BedrockAgentTrace): LegacyAgentTrace {
  return {
    timestamp: trace.startTime,
    query: trace.userQuery,
    trace: trace
  };
}

// ============================================================================
// ユーティリティ型
// ============================================================================

/**
 * トレースステップの部分更新型
 */
export type PartialTraceStep = Partial<TraceStep> & {
  stepId: string;
};

/**
 * トレースの部分更新型
 */
export type PartialBedrockAgentTrace = Partial<BedrockAgentTrace> & {
  traceId: string;
};

/**
 * トレースステップタイプガード
 */
export function isOrchestrationStep(step: TraceStep): step is TraceStep & {
  details: { orchestrationSteps: OrchestrationStep[] };
} {
  return step.type === 'ORCHESTRATION' && 
         step.details.orchestrationSteps !== undefined;
}

/**
 * Action Groupステップタイプガード
 */
export function isActionGroupStep(step: TraceStep): step is TraceStep & {
  details: { actionGroupResult: ActionGroupResult };
} {
  return step.type === 'ACTION_GROUP' && 
         step.details.actionGroupResult !== undefined;
}

/**
 * Knowledge Baseステップタイプガード
 */
export function isKnowledgeBaseStep(step: TraceStep): step is TraceStep & {
  details: { knowledgeBaseResult: KnowledgeBaseResult };
} {
  return step.type === 'KNOWLEDGE_BASE' && 
         step.details.knowledgeBaseResult !== undefined;
}

// ============================================================================
// デフォルト値・定数
// ============================================================================

/**
 * トレースステップタイプ定数オブジェクト
 * 型安全性とコード補完を向上させるための定数定義
 */
export const TRACE_STEP_TYPES = {
  // 基本ステップタイプ
  PRE_PROCESSING: 'PRE_PROCESSING' as const,
  ORCHESTRATION: 'ORCHESTRATION' as const,
  POST_PROCESSING: 'POST_PROCESSING' as const,
  KNOWLEDGE_BASE: 'KNOWLEDGE_BASE' as const,
  ACTION_GROUP: 'ACTION_GROUP' as const,
  GUARDRAILS: 'GUARDRAILS' as const,
  FINAL_RESPONSE: 'FINAL_RESPONSE' as const,
  // 2024年GA機能
  MULTI_AGENT_COLLABORATION: 'MULTI_AGENT_COLLABORATION' as const,
  INLINE_AGENT_INVOCATION: 'INLINE_AGENT_INVOCATION' as const,
  PAYLOAD_REFERENCING: 'PAYLOAD_REFERENCING' as const,
  SUPERVISOR_ORCHESTRATION: 'SUPERVISOR_ORCHESTRATION' as const,
  COLLABORATOR_EXECUTION: 'COLLABORATOR_EXECUTION' as const
} as const;

/**
 * トレースステップカテゴリ定義
 * ステップタイプを機能別にグループ化
 */
export const TRACE_STEP_CATEGORIES = {
  /** 基本処理ステップ */
  BASIC: [
    TRACE_STEP_TYPES.PRE_PROCESSING,
    TRACE_STEP_TYPES.ORCHESTRATION,
    TRACE_STEP_TYPES.POST_PROCESSING,
    TRACE_STEP_TYPES.FINAL_RESPONSE
  ] as TraceStepType[],
  /** 統合機能ステップ */
  INTEGRATION: [
    TRACE_STEP_TYPES.KNOWLEDGE_BASE,
    TRACE_STEP_TYPES.ACTION_GROUP,
    TRACE_STEP_TYPES.GUARDRAILS
  ] as TraceStepType[],
  /** Multi-Agent機能ステップ */
  MULTI_AGENT: [
    TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION,
    TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION,
    TRACE_STEP_TYPES.COLLABORATOR_EXECUTION
  ] as TraceStepType[],
  /** 高度な機能ステップ（2024年GA） */
  ADVANCED: [
    TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION,
    TRACE_STEP_TYPES.PAYLOAD_REFERENCING
  ] as TraceStepType[]
} as const;

/**
 * 2024年GA機能ステップタイプセット
 */
export const GA_2024_STEP_TYPES: Set<TraceStepType> = new Set<TraceStepType>([
  TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION,
  TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION,
  TRACE_STEP_TYPES.PAYLOAD_REFERENCING,
  TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION,
  TRACE_STEP_TYPES.COLLABORATOR_EXECUTION
]);

/**
 * デフォルトトレース表示設定（2024年GA機能対応）
 */
export const DEFAULT_TRACE_DISPLAY_CONFIG: TraceDisplayConfig = {
  expandedSteps: new Set(),
  visibleStepTypes: new Set([
    TRACE_STEP_TYPES.PRE_PROCESSING,
    TRACE_STEP_TYPES.ORCHESTRATION, 
    TRACE_STEP_TYPES.POST_PROCESSING,
    TRACE_STEP_TYPES.KNOWLEDGE_BASE,
    TRACE_STEP_TYPES.ACTION_GROUP,
    TRACE_STEP_TYPES.FINAL_RESPONSE,
    // 2024年GA機能も表示対象に含める
    TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION,
    TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION,
    TRACE_STEP_TYPES.PAYLOAD_REFERENCING,
    TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION,
    TRACE_STEP_TYPES.COLLABORATOR_EXECUTION
  ]),
  detailMode: 'SIMPLE',
  showTimeline: true,
  showPerformance: false
};

/**
 * ステップタイプ表示名マッピング（2024年GA機能対応）
 */
export const STEP_TYPE_DISPLAY_NAMES: Record<TraceStepType, string> = {
  'PRE_PROCESSING': '前処理',
  'ORCHESTRATION': 'オーケストレーション',
  'POST_PROCESSING': '後処理',
  'KNOWLEDGE_BASE': 'Knowledge Base検索',
  'ACTION_GROUP': 'Action Group実行',
  'GUARDRAILS': 'Guardrails評価',
  'FINAL_RESPONSE': '最終レスポンス',
  // 2024年GA機能追加
  'MULTI_AGENT_COLLABORATION': 'Multi-Agent連携',
  'INLINE_AGENT_INVOCATION': 'Inline Agent実行',
  'PAYLOAD_REFERENCING': 'Payload Referencing最適化',
  'SUPERVISOR_ORCHESTRATION': 'Supervisor Agent制御',
  'COLLABORATOR_EXECUTION': 'Collaborator Agent実行'
};

/**
 * ステップ状態表示名マッピング
 */
export const STEP_STATUS_DISPLAY_NAMES: Record<TraceStepStatus, string> = {
  'STARTED': '開始',
  'IN_PROGRESS': '実行中',
  'COMPLETED': '完了',
  'FAILED': '失敗',
  'SKIPPED': 'スキップ'
};

/**
 * ステップタイプアイコンマッピング（2024年GA機能対応）
 */
export const STEP_TYPE_ICONS: Record<TraceStepType, string> = {
  'PRE_PROCESSING': '🔄',
  'ORCHESTRATION': '🎯',
  'POST_PROCESSING': '✅',
  'KNOWLEDGE_BASE': '📚',
  'ACTION_GROUP': '⚡',
  'GUARDRAILS': '🛡️',
  'FINAL_RESPONSE': '💬',
  // 2024年GA機能追加
  'MULTI_AGENT_COLLABORATION': '🤝',
  'INLINE_AGENT_INVOCATION': '🔗',
  'PAYLOAD_REFERENCING': '📎',
  'SUPERVISOR_ORCHESTRATION': '👑',
  'COLLABORATOR_EXECUTION': '🔧'
};

/**
 * ステップ状態カラーマッピング
 */
export const STEP_STATUS_COLORS: Record<TraceStepStatus, string> = {
  'STARTED': 'blue',
  'IN_PROGRESS': 'yellow',
  'COMPLETED': 'green',
  'FAILED': 'red',
  'SKIPPED': 'gray'
};

// ============================================================================
// 2024年GA機能ユーティリティ関数
// ============================================================================

/**
 * Multi-Agent Collaborationステップタイプガード
 */
export function isMultiAgentStep(step: TraceStep): step is TraceStep & {
  details: { multiAgentDetails: NonNullable<TraceStep['details']['multiAgentDetails']> };
} {
  return (step.type === 'MULTI_AGENT_COLLABORATION' || 
          step.type === 'SUPERVISOR_ORCHESTRATION' || 
          step.type === 'COLLABORATOR_EXECUTION') && 
         step.details.multiAgentDetails !== undefined;
}

/**
 * Inline Agentステップタイプガード
 */
export function isInlineAgentStep(step: TraceStep): step is TraceStep & {
  details: { inlineAgentDetails: InlineAgentExecution };
} {
  return step.type === 'INLINE_AGENT_INVOCATION' && 
         step.details.inlineAgentDetails !== undefined;
}

/**
 * Payload Referencingステップタイプガード
 */
export function isPayloadReferencingStep(step: TraceStep): step is TraceStep & {
  details: { payloadOptimizationDetails: PayloadReferencingOptimization };
} {
  return step.type === 'PAYLOAD_REFERENCING' && 
         step.details.payloadOptimizationDetails !== undefined;
}

/**
 * トレースが2024年GA機能を使用しているかチェック
 */
export function hasGAFeatures2024(trace: BedrockAgentTrace): boolean {
  return trace.metadata.gaFeatures2024.multiAgentEnabled ||
         trace.metadata.gaFeatures2024.inlineAgentEnabled ||
         trace.metadata.gaFeatures2024.payloadReferencingEnabled;
}

/**
 * Multi-Agent Collaborationの統計情報を取得
 */
export function getMultiAgentStatistics(trace: BedrockAgentTrace): {
  totalAgents: number;
  supervisorCount: number;
  collaboratorCount: number;
  taskCompletionRate: number;
  averageTaskExecutionTime: number;
} | null {
  const multiAgentInfo = trace.metadata.multiAgentCollaboration;
  if (!multiAgentInfo) return null;

  const totalAgents = 1 + (multiAgentInfo.collaboratorAgentIds?.length || 0);
  const supervisorCount = multiAgentInfo.currentAgentRole === 'SUPERVISOR' ? 1 : 0;
  const collaboratorCount = multiAgentInfo.collaboratorAgentIds?.length || 0;
  
  const tasks = multiAgentInfo.taskDecomposition?.subTasks || [];
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
  const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  
  const multiAgentSteps = trace.steps.filter(isMultiAgentStep);
  const totalExecutionTime = multiAgentSteps.reduce((sum, step) => sum + (step.executionTimeMs || 0), 0);
  const averageTaskExecutionTime = multiAgentSteps.length > 0 ? totalExecutionTime / multiAgentSteps.length : 0;

  return {
    totalAgents,
    supervisorCount,
    collaboratorCount,
    taskCompletionRate,
    averageTaskExecutionTime
  };
}

/**
 * Payload Referencing最適化の効果を計算
 */
export function calculatePayloadOptimizationEffectiveness(trace: BedrockAgentTrace): {
  totalOriginalSize: number;
  totalOptimizedSize: number;
  totalReductionPercentage: number;
  totalResponseTimeReduction: number;
  totalBandwidthSaving: number;
  estimatedCostSaving: number;
} | null {
  const payloadSteps = trace.steps.filter(isPayloadReferencingStep);
  if (payloadSteps.length === 0) return null;

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let totalResponseTimeReduction = 0;
  let totalBandwidthSaving = 0;
  let estimatedCostSaving = 0;

  payloadSteps.forEach(step => {
    const details = step.details.payloadOptimizationDetails!;
    totalOriginalSize += details.originalPayloadSize;
    totalOptimizedSize += details.optimizedPayloadSize;
    totalResponseTimeReduction += details.performanceImprovement.responseTimeReductionMs;
    totalBandwidthSaving += details.performanceImprovement.bandwidthSavingBytes;
    estimatedCostSaving += details.performanceImprovement.estimatedCostSavingUsd || 0;
  });

  const totalReductionPercentage = totalOriginalSize > 0 
    ? ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100 
    : 0;

  return {
    totalOriginalSize,
    totalOptimizedSize,
    totalReductionPercentage,
    totalResponseTimeReduction,
    totalBandwidthSaving,
    estimatedCostSaving
  };
}

/**
 * 2024年GA機能のパフォーマンス指標を取得
 */
export function getGAFeatures2024Performance(trace: BedrockAgentTrace): {
  multiAgentPerformance?: ReturnType<typeof getMultiAgentStatistics>;
  payloadOptimizationPerformance?: ReturnType<typeof calculatePayloadOptimizationEffectiveness>;
  inlineAgentExecutions: number;
  totalGAFeatureExecutionTime: number;
} {
  const multiAgentPerformance = getMultiAgentStatistics(trace);
  const payloadOptimizationPerformance = calculatePayloadOptimizationEffectiveness(trace);
  
  const inlineAgentSteps = trace.steps.filter(isInlineAgentStep);
  const inlineAgentExecutions = inlineAgentSteps.length;
  
  const gaFeatureSteps = trace.steps.filter(step => 
    isMultiAgentStep(step) || isInlineAgentStep(step) || isPayloadReferencingStep(step)
  );
  const totalGAFeatureExecutionTime = gaFeatureSteps.reduce((sum, step) => sum + (step.executionTimeMs || 0), 0);

  return {
    multiAgentPerformance,
    payloadOptimizationPerformance,
    inlineAgentExecutions,
    totalGAFeatureExecutionTime
  };
}

// ============================================================================
// ユーティリティクラス
// ============================================================================

/**
 * トレースステップタイプユーティリティクラス
 * ステップタイプの分類、判定、表示名取得などの機能を提供
 */
export class TraceStepTypeUtils {
  /**
   * Multi-Agentステップかどうかを判定
   */
  static isMultiAgentStep(stepType: TraceStepType): boolean {
    return TRACE_STEP_CATEGORIES.MULTI_AGENT.includes(stepType);
  }

  /**
   * 2024年GA機能ステップかどうかを判定
   */
  static isGA2024Feature(stepType: TraceStepType): boolean {
    return GA_2024_STEP_TYPES.has(stepType);
  }

  /**
   * 基本処理ステップかどうかを判定
   */
  static isBasicStep(stepType: TraceStepType): boolean {
    return TRACE_STEP_CATEGORIES.BASIC.includes(stepType);
  }

  /**
   * 統合機能ステップかどうかを判定
   */
  static isIntegrationStep(stepType: TraceStepType): boolean {
    return TRACE_STEP_CATEGORIES.INTEGRATION.includes(stepType);
  }

  /**
   * 高度な機能ステップかどうかを判定
   */
  static isAdvancedStep(stepType: TraceStepType): boolean {
    return TRACE_STEP_CATEGORIES.ADVANCED.includes(stepType);
  }

  /**
   * ステップタイプの表示名を取得
   */
  static getDisplayName(stepType: TraceStepType): string {
    return STEP_TYPE_DISPLAY_NAMES[stepType] || stepType;
  }

  /**
   * ステップタイプのアイコンを取得
   */
  static getIcon(stepType: TraceStepType): string {
    return STEP_TYPE_ICONS[stepType] || '❓';
  }

  /**
   * ステップタイプのカテゴリを取得
   */
  static getCategory(stepType: TraceStepType): keyof typeof TRACE_STEP_CATEGORIES | 'UNKNOWN' {
    for (const [category, types] of Object.entries(TRACE_STEP_CATEGORIES)) {
      if ((types as TraceStepType[]).includes(stepType)) {
        return category as keyof typeof TRACE_STEP_CATEGORIES;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * カテゴリ別にステップタイプをグループ化
   */
  static groupByCategory(stepTypes: TraceStepType[]): Record<string, TraceStepType[]> {
    const grouped: Record<string, TraceStepType[]> = {
      BASIC: [],
      INTEGRATION: [],
      MULTI_AGENT: [],
      ADVANCED: [],
      UNKNOWN: []
    };

    stepTypes.forEach(stepType => {
      const category = this.getCategory(stepType);
      grouped[category].push(stepType);
    });

    return grouped;
  }

  /**
   * ステップタイプの優先度を取得（表示順序用）
   */
  static getPriority(stepType: TraceStepType): number {
    const priorityMap: Record<TraceStepType, number> = {
      [TRACE_STEP_TYPES.PRE_PROCESSING]: 1,
      [TRACE_STEP_TYPES.ORCHESTRATION]: 2,
      [TRACE_STEP_TYPES.KNOWLEDGE_BASE]: 3,
      [TRACE_STEP_TYPES.ACTION_GROUP]: 4,
      [TRACE_STEP_TYPES.GUARDRAILS]: 5,
      [TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION]: 6,
      [TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION]: 7,
      [TRACE_STEP_TYPES.COLLABORATOR_EXECUTION]: 8,
      [TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION]: 9,
      [TRACE_STEP_TYPES.PAYLOAD_REFERENCING]: 10,
      [TRACE_STEP_TYPES.POST_PROCESSING]: 11,
      [TRACE_STEP_TYPES.FINAL_RESPONSE]: 12
    };
    return priorityMap[stepType] || 999;
  }

  /**
   * ステップタイプを優先度順にソート
   */
  static sortByPriority(stepTypes: TraceStepType[]): TraceStepType[] {
    return [...stepTypes].sort((a, b) => this.getPriority(a) - this.getPriority(b));
  }

  /**
   * ステップタイプの説明を取得
   */
  static getDescription(stepType: TraceStepType): string {
    const descriptions: Record<TraceStepType, string> = {
      [TRACE_STEP_TYPES.PRE_PROCESSING]: 'ユーザー入力の前処理と検証を行います',
      [TRACE_STEP_TYPES.ORCHESTRATION]: 'Agent実行の全体的な制御と調整を行います',
      [TRACE_STEP_TYPES.POST_PROCESSING]: '実行結果の後処理と整形を行います',
      [TRACE_STEP_TYPES.KNOWLEDGE_BASE]: 'Knowledge Baseからの情報検索を実行します',
      [TRACE_STEP_TYPES.ACTION_GROUP]: 'Action Groupの機能を実行します',
      [TRACE_STEP_TYPES.GUARDRAILS]: 'セキュリティとコンプライアンスの評価を行います',
      [TRACE_STEP_TYPES.FINAL_RESPONSE]: '最終的なレスポンスを生成します',
      [TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION]: '複数のAgent間での協調処理を実行します',
      [TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION]: 'インラインでのAgent実行を行います',
      [TRACE_STEP_TYPES.PAYLOAD_REFERENCING]: 'ペイロード参照による最適化を実行します',
      [TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION]: 'Supervisor Agentによる統括制御を行います',
      [TRACE_STEP_TYPES.COLLABORATOR_EXECUTION]: 'Collaborator Agentによる協力実行を行います'
    };
    return descriptions[stepType] || 'ステップの説明が利用できません';
  }

  /**
   * ステップタイプの実行時間の目安を取得（ミリ秒）
   */
  static getEstimatedExecutionTime(stepType: TraceStepType): { min: number; max: number; average: number } {
    const timeEstimates: Record<TraceStepType, { min: number; max: number; average: number }> = {
      [TRACE_STEP_TYPES.PRE_PROCESSING]: { min: 10, max: 100, average: 50 },
      [TRACE_STEP_TYPES.ORCHESTRATION]: { min: 50, max: 500, average: 200 },
      [TRACE_STEP_TYPES.POST_PROCESSING]: { min: 10, max: 100, average: 50 },
      [TRACE_STEP_TYPES.KNOWLEDGE_BASE]: { min: 100, max: 2000, average: 500 },
      [TRACE_STEP_TYPES.ACTION_GROUP]: { min: 200, max: 5000, average: 1000 },
      [TRACE_STEP_TYPES.GUARDRAILS]: { min: 50, max: 300, average: 150 },
      [TRACE_STEP_TYPES.FINAL_RESPONSE]: { min: 100, max: 1000, average: 300 },
      [TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION]: { min: 500, max: 10000, average: 2000 },
      [TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION]: { min: 200, max: 3000, average: 800 },
      [TRACE_STEP_TYPES.PAYLOAD_REFERENCING]: { min: 20, max: 200, average: 80 },
      [TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION]: { min: 300, max: 5000, average: 1500 },
      [TRACE_STEP_TYPES.COLLABORATOR_EXECUTION]: { min: 200, max: 8000, average: 1200 }
    };
    return timeEstimates[stepType] || { min: 0, max: 1000, average: 500 };
  }

  /**
   * 全ステップタイプの一覧を取得
   */
  static getAllStepTypes(): TraceStepType[] {
    return Object.values(TRACE_STEP_TYPES);
  }

  /**
   * カテゴリ別ステップタイプの一覧を取得
   */
  static getStepTypesByCategory(category: keyof typeof TRACE_STEP_CATEGORIES): TraceStepType[] {
    return [...TRACE_STEP_CATEGORIES[category]];
  }

  /**
   * 2024年GA機能ステップタイプの一覧を取得
   */
  static getGA2024StepTypes(): TraceStepType[] {
    return Array.from(GA_2024_STEP_TYPES);
  }
}

// ============================================================================
// セキュリティユーティリティ関数
// ============================================================================

/**
 * セキュリティレベルの数値変換（比較用）
 */
export function getSecurityLevelValue(level: SecurityLevel): number {
  const levelValues: Record<SecurityLevel, number> = {
    'PUBLIC': 1,
    'INTERNAL': 2,
    'CONFIDENTIAL': 3,
    'RESTRICTED': 4
  };
  return levelValues[level];
}

/**
 * セキュリティレベルの比較
 */
export function compareSecurityLevels(level1: SecurityLevel, level2: SecurityLevel): number {
  return getSecurityLevelValue(level1) - getSecurityLevelValue(level2);
}

/**
 * より高いセキュリティレベルを取得
 */
export function getHigherSecurityLevel(level1: SecurityLevel, level2: SecurityLevel): SecurityLevel {
  return compareSecurityLevels(level1, level2) >= 0 ? level1 : level2;
}

/**
 * トレースステップにセキュリティコンテキストを適用
 */
export function applySecurityContext(
  step: TraceStep, 
  securityContext: TraceSecurityContext
): SecureTraceStep {
  return {
    ...step,
    securityContext,
    maskedDetails: securityContext.dataClassification.containsPII ? {
      maskedInput: maskSensitiveData(step.details.input),
      maskedOutput: maskSensitiveData(step.details.output),
      maskingPatterns: ['PII_MASK', 'CONFIDENTIAL_MASK']
    } : undefined
  };
}

/**
 * 機密データのマスキング
 */
export function maskSensitiveData(data: any): any {
  if (!data) return data;
  
  const dataStr = JSON.stringify(data);
  let maskedStr = dataStr;
  
  // 一般的なPIIパターンのマスキング
  const maskingPatterns = [
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '****-****-****-****' }, // クレジットカード
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '***@***.***' }, // メールアドレス
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '***-***-****' }, // 電話番号
    { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: '***-**-****' }, // SSN
  ];
  
  maskingPatterns.forEach(({ pattern, replacement }) => {
    maskedStr = maskedStr.replace(pattern, replacement);
  });
  
  try {
    return JSON.parse(maskedStr);
  } catch {
    return maskedStr;
  }
}

/**
 * セキュリティイベントの重要度判定
 */
export function assessSecurityEventSeverity(
  eventType: SecureTraceStep['securityEvents'][0]['eventType'],
  context: TraceSecurityContext
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const baseSeverity: Record<typeof eventType, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    'ACCESS_GRANTED': 'LOW',
    'ACCESS_DENIED': 'MEDIUM',
    'PERMISSION_ESCALATION': 'HIGH',
    'SUSPICIOUS_ACTIVITY': 'CRITICAL'
  };
  
  let severity = baseSeverity[eventType];
  
  // セキュリティレベルに基づく重要度の調整
  if (context.securityLevel === 'RESTRICTED' || context.securityLevel === 'CONFIDENTIAL') {
    if (severity === 'LOW') severity = 'MEDIUM';
    if (severity === 'MEDIUM') severity = 'HIGH';
  }
  
  // 機密データを含む場合の重要度上昇
  if (context.dataClassification.containsConfidentialData && severity !== 'CRITICAL') {
    severity = severity === 'LOW' ? 'MEDIUM' : 
               severity === 'MEDIUM' ? 'HIGH' : 'CRITICAL';
  }
  
  return severity;
}

/**
 * セキュリティコンプライアンスチェック
 */
export function checkSecurityCompliance(trace: SecureBedrockAgentTrace): {
  isCompliant: boolean;
  violations: Array<{
    type: 'ENCRYPTION' | 'ACCESS_CONTROL' | 'AUDIT' | 'DATA_PROTECTION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    recommendation: string;
  }>;
  complianceScore: number; // 0-100
} {
  const violations: Array<{
    type: 'ENCRYPTION' | 'ACCESS_CONTROL' | 'AUDIT' | 'DATA_PROTECTION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    recommendation: string;
  }> = [];

  // 暗号化チェック
  if (trace.globalSecurityContext.encryptionRequirements.encryptionAtRest && 
      !trace.dataProtection.encryptionApplied) {
    violations.push({
      type: 'ENCRYPTION',
      severity: 'HIGH',
      description: '保存時暗号化が要求されていますが適用されていません',
      recommendation: 'データの保存時暗号化を有効にしてください'
    });
  }

  // データ保護チェック
  if (trace.globalSecurityContext.dataClassification.containsPII && 
      !trace.dataProtection.maskingApplied) {
    violations.push({
      type: 'DATA_PROTECTION',
      severity: 'CRITICAL',
      description: '個人情報が含まれていますがマスキングが適用されていません',
      recommendation: 'PIIデータのマスキングを適用してください'
    });
  }

  // 監査ログチェック
  if (trace.globalSecurityContext.auditRequirements.auditLogRequired && 
      trace.securityAuditLog.length === 0) {
    violations.push({
      type: 'AUDIT',
      severity: 'MEDIUM',
      description: '監査ログが要求されていますが記録されていません',
      recommendation: '監査ログの記録を有効にしてください'
    });
  }

  // コンプライアンススコア計算
  const totalChecks = 10; // 総チェック項目数
  const violationPenalty = violations.reduce((sum, violation) => {
    const penalties = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    return sum + penalties[violation.severity];
  }, 0);
  
  const complianceScore = Math.max(0, Math.round(((totalChecks * 4 - violationPenalty) / (totalChecks * 4)) * 100));
  const isCompliant = violations.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length === 0;

  return {
    isCompliant,
    violations,
    complianceScore
  };
}

/**
 * デフォルトセキュリティコンテキストの生成
 */
export function createDefaultSecurityContext(securityLevel: SecurityLevel = 'INTERNAL'): TraceSecurityContext {
  return {
    securityLevel,
    dataClassification: {
      containsPII: false,
      containsConfidentialData: securityLevel === 'CONFIDENTIAL' || securityLevel === 'RESTRICTED',
      containsRegulatedData: securityLevel === 'RESTRICTED'
    },
    accessControl: {
      requiredPermissions: ['bedrock:InvokeAgent'],
      allowedRoles: ['BedrockAgentUser'],
      geographicRestrictions: securityLevel === 'RESTRICTED' ? ['US', 'EU'] : undefined
    },
    auditRequirements: {
      auditLogRequired: securityLevel === 'CONFIDENTIAL' || securityLevel === 'RESTRICTED',
      retentionPeriodDays: securityLevel === 'RESTRICTED' ? 2555 : 365, // 7年 or 1年
      complianceRequirements: securityLevel === 'RESTRICTED' ? ['SOX', 'GDPR', 'HIPAA'] : []
    },
    encryptionRequirements: {
      encryptionAtRest: securityLevel === 'CONFIDENTIAL' || securityLevel === 'RESTRICTED',
      encryptionInTransit: true,
      encryptionAlgorithm: securityLevel === 'RESTRICTED' ? 'AES-256-GCM' : 'AES-256'
    }
  };
}