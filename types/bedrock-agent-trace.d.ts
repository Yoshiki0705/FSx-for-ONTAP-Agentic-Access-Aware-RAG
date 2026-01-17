/**
 * Bedrock Agent Trace型定義
 *
 * Amazon Bedrock Agentの実行トレース情報を表現する型定義
 * Phase 1.1: BedrockAgentTrace型定義の拡張
 *
 * 作成日: 2025-12-13
 * 要件: Requirements 6.1 (Agent実行トレース機能)
 */
/**
 * トレースステップのタイプ（2024年GA機能対応）
 */
export type TraceStepType = 'PRE_PROCESSING' | 'ORCHESTRATION' | 'POST_PROCESSING' | 'KNOWLEDGE_BASE' | 'ACTION_GROUP' | 'GUARDRAILS' | 'FINAL_RESPONSE' | 'MULTI_AGENT_COLLABORATION' | 'INLINE_AGENT_INVOCATION' | 'PAYLOAD_REFERENCING' | 'SUPERVISOR_ORCHESTRATION' | 'COLLABORATOR_EXECUTION';
/**
 * トレースステップの実行状態
 */
export type TraceStepStatus = 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
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
/**
 * Multi-Agent Collaborationの役割タイプ
 */
export type AgentRoleType = 'SUPERVISOR' | 'COLLABORATOR' | 'STANDALONE';
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
/**
 * セキュリティレベル定義
 */
export type SecurityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
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
/**
 * 既存のAgentTrace型との互換性を保つためのマッピング型
 * @deprecated 新しいBedrockAgentTrace型を使用してください
 */
export interface LegacyAgentTrace {
    timestamp: Date;
    query: string;
    trace: any;
}
/**
 * 既存のAgentTrace型をBedrockAgentTrace型に変換する関数
 */
export declare function convertLegacyTrace(legacyTrace: LegacyAgentTrace): BedrockAgentTrace;
/**
 * BedrockAgentTrace型を既存のAgentTrace型に変換する関数
 */
export declare function convertToLegacyTrace(trace: BedrockAgentTrace): LegacyAgentTrace;
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
export declare function isOrchestrationStep(step: TraceStep): step is TraceStep & {
    details: {
        orchestrationSteps: OrchestrationStep[];
    };
};
/**
 * Action Groupステップタイプガード
 */
export declare function isActionGroupStep(step: TraceStep): step is TraceStep & {
    details: {
        actionGroupResult: ActionGroupResult;
    };
};
/**
 * Knowledge Baseステップタイプガード
 */
export declare function isKnowledgeBaseStep(step: TraceStep): step is TraceStep & {
    details: {
        knowledgeBaseResult: KnowledgeBaseResult;
    };
};
/**
 * トレースステップタイプ定数オブジェクト
 * 型安全性とコード補完を向上させるための定数定義
 */
export declare const TRACE_STEP_TYPES: {
    readonly PRE_PROCESSING: "PRE_PROCESSING";
    readonly ORCHESTRATION: "ORCHESTRATION";
    readonly POST_PROCESSING: "POST_PROCESSING";
    readonly KNOWLEDGE_BASE: "KNOWLEDGE_BASE";
    readonly ACTION_GROUP: "ACTION_GROUP";
    readonly GUARDRAILS: "GUARDRAILS";
    readonly FINAL_RESPONSE: "FINAL_RESPONSE";
    readonly MULTI_AGENT_COLLABORATION: "MULTI_AGENT_COLLABORATION";
    readonly INLINE_AGENT_INVOCATION: "INLINE_AGENT_INVOCATION";
    readonly PAYLOAD_REFERENCING: "PAYLOAD_REFERENCING";
    readonly SUPERVISOR_ORCHESTRATION: "SUPERVISOR_ORCHESTRATION";
    readonly COLLABORATOR_EXECUTION: "COLLABORATOR_EXECUTION";
};
/**
 * トレースステップカテゴリ定義
 * ステップタイプを機能別にグループ化
 */
export declare const TRACE_STEP_CATEGORIES: {
    /** 基本処理ステップ */
    readonly BASIC: TraceStepType[];
    /** 統合機能ステップ */
    readonly INTEGRATION: TraceStepType[];
    /** Multi-Agent機能ステップ */
    readonly MULTI_AGENT: TraceStepType[];
    /** 高度な機能ステップ（2024年GA） */
    readonly ADVANCED: TraceStepType[];
};
/**
 * 2024年GA機能ステップタイプセット
 */
export declare const GA_2024_STEP_TYPES: Set<TraceStepType>;
/**
 * デフォルトトレース表示設定（2024年GA機能対応）
 */
export declare const DEFAULT_TRACE_DISPLAY_CONFIG: TraceDisplayConfig;
/**
 * ステップタイプ表示名マッピング（2024年GA機能対応）
 */
export declare const STEP_TYPE_DISPLAY_NAMES: Record<TraceStepType, string>;
/**
 * ステップ状態表示名マッピング
 */
export declare const STEP_STATUS_DISPLAY_NAMES: Record<TraceStepStatus, string>;
/**
 * ステップタイプアイコンマッピング（2024年GA機能対応）
 */
export declare const STEP_TYPE_ICONS: Record<TraceStepType, string>;
/**
 * ステップ状態カラーマッピング
 */
export declare const STEP_STATUS_COLORS: Record<TraceStepStatus, string>;
/**
 * Multi-Agent Collaborationステップタイプガード
 */
export declare function isMultiAgentStep(step: TraceStep): step is TraceStep & {
    details: {
        multiAgentDetails: NonNullable<TraceStep['details']['multiAgentDetails']>;
    };
};
/**
 * Inline Agentステップタイプガード
 */
export declare function isInlineAgentStep(step: TraceStep): step is TraceStep & {
    details: {
        inlineAgentDetails: InlineAgentExecution;
    };
};
/**
 * Payload Referencingステップタイプガード
 */
export declare function isPayloadReferencingStep(step: TraceStep): step is TraceStep & {
    details: {
        payloadOptimizationDetails: PayloadReferencingOptimization;
    };
};
/**
 * トレースが2024年GA機能を使用しているかチェック
 */
export declare function hasGAFeatures2024(trace: BedrockAgentTrace): boolean;
/**
 * Multi-Agent Collaborationの統計情報を取得
 */
export declare function getMultiAgentStatistics(trace: BedrockAgentTrace): {
    totalAgents: number;
    supervisorCount: number;
    collaboratorCount: number;
    taskCompletionRate: number;
    averageTaskExecutionTime: number;
} | null;
/**
 * Payload Referencing最適化の効果を計算
 */
export declare function calculatePayloadOptimizationEffectiveness(trace: BedrockAgentTrace): {
    totalOriginalSize: number;
    totalOptimizedSize: number;
    totalReductionPercentage: number;
    totalResponseTimeReduction: number;
    totalBandwidthSaving: number;
    estimatedCostSaving: number;
} | null;
/**
 * 2024年GA機能のパフォーマンス指標を取得
 */
export declare function getGAFeatures2024Performance(trace: BedrockAgentTrace): {
    multiAgentPerformance?: ReturnType<typeof getMultiAgentStatistics>;
    payloadOptimizationPerformance?: ReturnType<typeof calculatePayloadOptimizationEffectiveness>;
    inlineAgentExecutions: number;
    totalGAFeatureExecutionTime: number;
};
/**
 * トレースステップタイプユーティリティクラス
 * ステップタイプの分類、判定、表示名取得などの機能を提供
 */
export declare class TraceStepTypeUtils {
    /**
     * Multi-Agentステップかどうかを判定
     */
    static isMultiAgentStep(stepType: TraceStepType): boolean;
    /**
     * 2024年GA機能ステップかどうかを判定
     */
    static isGA2024Feature(stepType: TraceStepType): boolean;
    /**
     * 基本処理ステップかどうかを判定
     */
    static isBasicStep(stepType: TraceStepType): boolean;
    /**
     * 統合機能ステップかどうかを判定
     */
    static isIntegrationStep(stepType: TraceStepType): boolean;
    /**
     * 高度な機能ステップかどうかを判定
     */
    static isAdvancedStep(stepType: TraceStepType): boolean;
    /**
     * ステップタイプの表示名を取得
     */
    static getDisplayName(stepType: TraceStepType): string;
    /**
     * ステップタイプのアイコンを取得
     */
    static getIcon(stepType: TraceStepType): string;
    /**
     * ステップタイプのカテゴリを取得
     */
    static getCategory(stepType: TraceStepType): keyof typeof TRACE_STEP_CATEGORIES | 'UNKNOWN';
    /**
     * カテゴリ別にステップタイプをグループ化
     */
    static groupByCategory(stepTypes: TraceStepType[]): Record<string, TraceStepType[]>;
    /**
     * ステップタイプの優先度を取得（表示順序用）
     */
    static getPriority(stepType: TraceStepType): number;
    /**
     * ステップタイプを優先度順にソート
     */
    static sortByPriority(stepTypes: TraceStepType[]): TraceStepType[];
    /**
     * ステップタイプの説明を取得
     */
    static getDescription(stepType: TraceStepType): string;
    /**
     * ステップタイプの実行時間の目安を取得（ミリ秒）
     */
    static getEstimatedExecutionTime(stepType: TraceStepType): {
        min: number;
        max: number;
        average: number;
    };
    /**
     * 全ステップタイプの一覧を取得
     */
    static getAllStepTypes(): TraceStepType[];
    /**
     * カテゴリ別ステップタイプの一覧を取得
     */
    static getStepTypesByCategory(category: keyof typeof TRACE_STEP_CATEGORIES): TraceStepType[];
    /**
     * 2024年GA機能ステップタイプの一覧を取得
     */
    static getGA2024StepTypes(): TraceStepType[];
}
/**
 * セキュリティレベルの数値変換（比較用）
 */
export declare function getSecurityLevelValue(level: SecurityLevel): number;
/**
 * セキュリティレベルの比較
 */
export declare function compareSecurityLevels(level1: SecurityLevel, level2: SecurityLevel): number;
/**
 * より高いセキュリティレベルを取得
 */
export declare function getHigherSecurityLevel(level1: SecurityLevel, level2: SecurityLevel): SecurityLevel;
/**
 * トレースステップにセキュリティコンテキストを適用
 */
export declare function applySecurityContext(step: TraceStep, securityContext: TraceSecurityContext): SecureTraceStep;
/**
 * 機密データのマスキング
 */
export declare function maskSensitiveData(data: any): any;
/**
 * セキュリティイベントの重要度判定
 */
export declare function assessSecurityEventSeverity(eventType: SecureTraceStep['securityEvents'][0]['eventType'], context: TraceSecurityContext): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
/**
 * セキュリティコンプライアンスチェック
 */
export declare function checkSecurityCompliance(trace: SecureBedrockAgentTrace): {
    isCompliant: boolean;
    violations: Array<{
        type: 'ENCRYPTION' | 'ACCESS_CONTROL' | 'AUDIT' | 'DATA_PROTECTION';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        description: string;
        recommendation: string;
    }>;
    complianceScore: number;
};
/**
 * デフォルトセキュリティコンテキストの生成
 */
export declare function createDefaultSecurityContext(securityLevel?: SecurityLevel): TraceSecurityContext;
