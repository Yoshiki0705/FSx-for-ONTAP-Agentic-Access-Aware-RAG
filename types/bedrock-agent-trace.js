"use strict";
/**
 * Bedrock Agent Trace型定義
 *
 * Amazon Bedrock Agentの実行トレース情報を表現する型定義
 * Phase 1.1: BedrockAgentTrace型定義の拡張
 *
 * 作成日: 2025-12-13
 * 要件: Requirements 6.1 (Agent実行トレース機能)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceStepTypeUtils = exports.STEP_STATUS_COLORS = exports.STEP_TYPE_ICONS = exports.STEP_STATUS_DISPLAY_NAMES = exports.STEP_TYPE_DISPLAY_NAMES = exports.DEFAULT_TRACE_DISPLAY_CONFIG = exports.GA_2024_STEP_TYPES = exports.TRACE_STEP_CATEGORIES = exports.TRACE_STEP_TYPES = void 0;
exports.convertLegacyTrace = convertLegacyTrace;
exports.convertToLegacyTrace = convertToLegacyTrace;
exports.isOrchestrationStep = isOrchestrationStep;
exports.isActionGroupStep = isActionGroupStep;
exports.isKnowledgeBaseStep = isKnowledgeBaseStep;
exports.isMultiAgentStep = isMultiAgentStep;
exports.isInlineAgentStep = isInlineAgentStep;
exports.isPayloadReferencingStep = isPayloadReferencingStep;
exports.hasGAFeatures2024 = hasGAFeatures2024;
exports.getMultiAgentStatistics = getMultiAgentStatistics;
exports.calculatePayloadOptimizationEffectiveness = calculatePayloadOptimizationEffectiveness;
exports.getGAFeatures2024Performance = getGAFeatures2024Performance;
exports.getSecurityLevelValue = getSecurityLevelValue;
exports.compareSecurityLevels = compareSecurityLevels;
exports.getHigherSecurityLevel = getHigherSecurityLevel;
exports.applySecurityContext = applySecurityContext;
exports.maskSensitiveData = maskSensitiveData;
exports.assessSecurityEventSeverity = assessSecurityEventSeverity;
exports.checkSecurityCompliance = checkSecurityCompliance;
exports.createDefaultSecurityContext = createDefaultSecurityContext;
/**
 * 既存のAgentTrace型をBedrockAgentTrace型に変換する関数
 */
function convertLegacyTrace(legacyTrace) {
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
function convertToLegacyTrace(trace) {
    return {
        timestamp: trace.startTime,
        query: trace.userQuery,
        trace: trace
    };
}
/**
 * トレースステップタイプガード
 */
function isOrchestrationStep(step) {
    return step.type === 'ORCHESTRATION' &&
        step.details.orchestrationSteps !== undefined;
}
/**
 * Action Groupステップタイプガード
 */
function isActionGroupStep(step) {
    return step.type === 'ACTION_GROUP' &&
        step.details.actionGroupResult !== undefined;
}
/**
 * Knowledge Baseステップタイプガード
 */
function isKnowledgeBaseStep(step) {
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
exports.TRACE_STEP_TYPES = {
    // 基本ステップタイプ
    PRE_PROCESSING: 'PRE_PROCESSING',
    ORCHESTRATION: 'ORCHESTRATION',
    POST_PROCESSING: 'POST_PROCESSING',
    KNOWLEDGE_BASE: 'KNOWLEDGE_BASE',
    ACTION_GROUP: 'ACTION_GROUP',
    GUARDRAILS: 'GUARDRAILS',
    FINAL_RESPONSE: 'FINAL_RESPONSE',
    // 2024年GA機能
    MULTI_AGENT_COLLABORATION: 'MULTI_AGENT_COLLABORATION',
    INLINE_AGENT_INVOCATION: 'INLINE_AGENT_INVOCATION',
    PAYLOAD_REFERENCING: 'PAYLOAD_REFERENCING',
    SUPERVISOR_ORCHESTRATION: 'SUPERVISOR_ORCHESTRATION',
    COLLABORATOR_EXECUTION: 'COLLABORATOR_EXECUTION'
};
/**
 * トレースステップカテゴリ定義
 * ステップタイプを機能別にグループ化
 */
exports.TRACE_STEP_CATEGORIES = {
    /** 基本処理ステップ */
    BASIC: [
        exports.TRACE_STEP_TYPES.PRE_PROCESSING,
        exports.TRACE_STEP_TYPES.ORCHESTRATION,
        exports.TRACE_STEP_TYPES.POST_PROCESSING,
        exports.TRACE_STEP_TYPES.FINAL_RESPONSE
    ],
    /** 統合機能ステップ */
    INTEGRATION: [
        exports.TRACE_STEP_TYPES.KNOWLEDGE_BASE,
        exports.TRACE_STEP_TYPES.ACTION_GROUP,
        exports.TRACE_STEP_TYPES.GUARDRAILS
    ],
    /** Multi-Agent機能ステップ */
    MULTI_AGENT: [
        exports.TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION,
        exports.TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION,
        exports.TRACE_STEP_TYPES.COLLABORATOR_EXECUTION
    ],
    /** 高度な機能ステップ（2024年GA） */
    ADVANCED: [
        exports.TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION,
        exports.TRACE_STEP_TYPES.PAYLOAD_REFERENCING
    ]
};
/**
 * 2024年GA機能ステップタイプセット
 */
exports.GA_2024_STEP_TYPES = new Set([
    exports.TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION,
    exports.TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION,
    exports.TRACE_STEP_TYPES.PAYLOAD_REFERENCING,
    exports.TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION,
    exports.TRACE_STEP_TYPES.COLLABORATOR_EXECUTION
]);
/**
 * デフォルトトレース表示設定（2024年GA機能対応）
 */
exports.DEFAULT_TRACE_DISPLAY_CONFIG = {
    expandedSteps: new Set(),
    visibleStepTypes: new Set([
        exports.TRACE_STEP_TYPES.PRE_PROCESSING,
        exports.TRACE_STEP_TYPES.ORCHESTRATION,
        exports.TRACE_STEP_TYPES.POST_PROCESSING,
        exports.TRACE_STEP_TYPES.KNOWLEDGE_BASE,
        exports.TRACE_STEP_TYPES.ACTION_GROUP,
        exports.TRACE_STEP_TYPES.FINAL_RESPONSE,
        // 2024年GA機能も表示対象に含める
        exports.TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION,
        exports.TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION,
        exports.TRACE_STEP_TYPES.PAYLOAD_REFERENCING,
        exports.TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION,
        exports.TRACE_STEP_TYPES.COLLABORATOR_EXECUTION
    ]),
    detailMode: 'SIMPLE',
    showTimeline: true,
    showPerformance: false
};
/**
 * ステップタイプ表示名マッピング（2024年GA機能対応）
 */
exports.STEP_TYPE_DISPLAY_NAMES = {
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
exports.STEP_STATUS_DISPLAY_NAMES = {
    'STARTED': '開始',
    'IN_PROGRESS': '実行中',
    'COMPLETED': '完了',
    'FAILED': '失敗',
    'SKIPPED': 'スキップ'
};
/**
 * ステップタイプアイコンマッピング（2024年GA機能対応）
 */
exports.STEP_TYPE_ICONS = {
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
exports.STEP_STATUS_COLORS = {
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
function isMultiAgentStep(step) {
    return (step.type === 'MULTI_AGENT_COLLABORATION' ||
        step.type === 'SUPERVISOR_ORCHESTRATION' ||
        step.type === 'COLLABORATOR_EXECUTION') &&
        step.details.multiAgentDetails !== undefined;
}
/**
 * Inline Agentステップタイプガード
 */
function isInlineAgentStep(step) {
    return step.type === 'INLINE_AGENT_INVOCATION' &&
        step.details.inlineAgentDetails !== undefined;
}
/**
 * Payload Referencingステップタイプガード
 */
function isPayloadReferencingStep(step) {
    return step.type === 'PAYLOAD_REFERENCING' &&
        step.details.payloadOptimizationDetails !== undefined;
}
/**
 * トレースが2024年GA機能を使用しているかチェック
 */
function hasGAFeatures2024(trace) {
    return trace.metadata.gaFeatures2024.multiAgentEnabled ||
        trace.metadata.gaFeatures2024.inlineAgentEnabled ||
        trace.metadata.gaFeatures2024.payloadReferencingEnabled;
}
/**
 * Multi-Agent Collaborationの統計情報を取得
 */
function getMultiAgentStatistics(trace) {
    const multiAgentInfo = trace.metadata.multiAgentCollaboration;
    if (!multiAgentInfo)
        return null;
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
function calculatePayloadOptimizationEffectiveness(trace) {
    const payloadSteps = trace.steps.filter(isPayloadReferencingStep);
    if (payloadSteps.length === 0)
        return null;
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    let totalResponseTimeReduction = 0;
    let totalBandwidthSaving = 0;
    let estimatedCostSaving = 0;
    payloadSteps.forEach(step => {
        const details = step.details.payloadOptimizationDetails;
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
function getGAFeatures2024Performance(trace) {
    const multiAgentPerformance = getMultiAgentStatistics(trace);
    const payloadOptimizationPerformance = calculatePayloadOptimizationEffectiveness(trace);
    const inlineAgentSteps = trace.steps.filter(isInlineAgentStep);
    const inlineAgentExecutions = inlineAgentSteps.length;
    const gaFeatureSteps = trace.steps.filter(step => isMultiAgentStep(step) || isInlineAgentStep(step) || isPayloadReferencingStep(step));
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
class TraceStepTypeUtils {
    /**
     * Multi-Agentステップかどうかを判定
     */
    static isMultiAgentStep(stepType) {
        return exports.TRACE_STEP_CATEGORIES.MULTI_AGENT.includes(stepType);
    }
    /**
     * 2024年GA機能ステップかどうかを判定
     */
    static isGA2024Feature(stepType) {
        return exports.GA_2024_STEP_TYPES.has(stepType);
    }
    /**
     * 基本処理ステップかどうかを判定
     */
    static isBasicStep(stepType) {
        return exports.TRACE_STEP_CATEGORIES.BASIC.includes(stepType);
    }
    /**
     * 統合機能ステップかどうかを判定
     */
    static isIntegrationStep(stepType) {
        return exports.TRACE_STEP_CATEGORIES.INTEGRATION.includes(stepType);
    }
    /**
     * 高度な機能ステップかどうかを判定
     */
    static isAdvancedStep(stepType) {
        return exports.TRACE_STEP_CATEGORIES.ADVANCED.includes(stepType);
    }
    /**
     * ステップタイプの表示名を取得
     */
    static getDisplayName(stepType) {
        return exports.STEP_TYPE_DISPLAY_NAMES[stepType] || stepType;
    }
    /**
     * ステップタイプのアイコンを取得
     */
    static getIcon(stepType) {
        return exports.STEP_TYPE_ICONS[stepType] || '❓';
    }
    /**
     * ステップタイプのカテゴリを取得
     */
    static getCategory(stepType) {
        for (const [category, types] of Object.entries(exports.TRACE_STEP_CATEGORIES)) {
            if (types.includes(stepType)) {
                return category;
            }
        }
        return 'UNKNOWN';
    }
    /**
     * カテゴリ別にステップタイプをグループ化
     */
    static groupByCategory(stepTypes) {
        const grouped = {
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
    static getPriority(stepType) {
        const priorityMap = {
            [exports.TRACE_STEP_TYPES.PRE_PROCESSING]: 1,
            [exports.TRACE_STEP_TYPES.ORCHESTRATION]: 2,
            [exports.TRACE_STEP_TYPES.KNOWLEDGE_BASE]: 3,
            [exports.TRACE_STEP_TYPES.ACTION_GROUP]: 4,
            [exports.TRACE_STEP_TYPES.GUARDRAILS]: 5,
            [exports.TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION]: 6,
            [exports.TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION]: 7,
            [exports.TRACE_STEP_TYPES.COLLABORATOR_EXECUTION]: 8,
            [exports.TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION]: 9,
            [exports.TRACE_STEP_TYPES.PAYLOAD_REFERENCING]: 10,
            [exports.TRACE_STEP_TYPES.POST_PROCESSING]: 11,
            [exports.TRACE_STEP_TYPES.FINAL_RESPONSE]: 12
        };
        return priorityMap[stepType] || 999;
    }
    /**
     * ステップタイプを優先度順にソート
     */
    static sortByPriority(stepTypes) {
        return [...stepTypes].sort((a, b) => this.getPriority(a) - this.getPriority(b));
    }
    /**
     * ステップタイプの説明を取得
     */
    static getDescription(stepType) {
        const descriptions = {
            [exports.TRACE_STEP_TYPES.PRE_PROCESSING]: 'ユーザー入力の前処理と検証を行います',
            [exports.TRACE_STEP_TYPES.ORCHESTRATION]: 'Agent実行の全体的な制御と調整を行います',
            [exports.TRACE_STEP_TYPES.POST_PROCESSING]: '実行結果の後処理と整形を行います',
            [exports.TRACE_STEP_TYPES.KNOWLEDGE_BASE]: 'Knowledge Baseからの情報検索を実行します',
            [exports.TRACE_STEP_TYPES.ACTION_GROUP]: 'Action Groupの機能を実行します',
            [exports.TRACE_STEP_TYPES.GUARDRAILS]: 'セキュリティとコンプライアンスの評価を行います',
            [exports.TRACE_STEP_TYPES.FINAL_RESPONSE]: '最終的なレスポンスを生成します',
            [exports.TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION]: '複数のAgent間での協調処理を実行します',
            [exports.TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION]: 'インラインでのAgent実行を行います',
            [exports.TRACE_STEP_TYPES.PAYLOAD_REFERENCING]: 'ペイロード参照による最適化を実行します',
            [exports.TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION]: 'Supervisor Agentによる統括制御を行います',
            [exports.TRACE_STEP_TYPES.COLLABORATOR_EXECUTION]: 'Collaborator Agentによる協力実行を行います'
        };
        return descriptions[stepType] || 'ステップの説明が利用できません';
    }
    /**
     * ステップタイプの実行時間の目安を取得（ミリ秒）
     */
    static getEstimatedExecutionTime(stepType) {
        const timeEstimates = {
            [exports.TRACE_STEP_TYPES.PRE_PROCESSING]: { min: 10, max: 100, average: 50 },
            [exports.TRACE_STEP_TYPES.ORCHESTRATION]: { min: 50, max: 500, average: 200 },
            [exports.TRACE_STEP_TYPES.POST_PROCESSING]: { min: 10, max: 100, average: 50 },
            [exports.TRACE_STEP_TYPES.KNOWLEDGE_BASE]: { min: 100, max: 2000, average: 500 },
            [exports.TRACE_STEP_TYPES.ACTION_GROUP]: { min: 200, max: 5000, average: 1000 },
            [exports.TRACE_STEP_TYPES.GUARDRAILS]: { min: 50, max: 300, average: 150 },
            [exports.TRACE_STEP_TYPES.FINAL_RESPONSE]: { min: 100, max: 1000, average: 300 },
            [exports.TRACE_STEP_TYPES.MULTI_AGENT_COLLABORATION]: { min: 500, max: 10000, average: 2000 },
            [exports.TRACE_STEP_TYPES.INLINE_AGENT_INVOCATION]: { min: 200, max: 3000, average: 800 },
            [exports.TRACE_STEP_TYPES.PAYLOAD_REFERENCING]: { min: 20, max: 200, average: 80 },
            [exports.TRACE_STEP_TYPES.SUPERVISOR_ORCHESTRATION]: { min: 300, max: 5000, average: 1500 },
            [exports.TRACE_STEP_TYPES.COLLABORATOR_EXECUTION]: { min: 200, max: 8000, average: 1200 }
        };
        return timeEstimates[stepType] || { min: 0, max: 1000, average: 500 };
    }
    /**
     * 全ステップタイプの一覧を取得
     */
    static getAllStepTypes() {
        return Object.values(exports.TRACE_STEP_TYPES);
    }
    /**
     * カテゴリ別ステップタイプの一覧を取得
     */
    static getStepTypesByCategory(category) {
        return [...exports.TRACE_STEP_CATEGORIES[category]];
    }
    /**
     * 2024年GA機能ステップタイプの一覧を取得
     */
    static getGA2024StepTypes() {
        return Array.from(exports.GA_2024_STEP_TYPES);
    }
}
exports.TraceStepTypeUtils = TraceStepTypeUtils;
// ============================================================================
// セキュリティユーティリティ関数
// ============================================================================
/**
 * セキュリティレベルの数値変換（比較用）
 */
function getSecurityLevelValue(level) {
    const levelValues = {
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
function compareSecurityLevels(level1, level2) {
    return getSecurityLevelValue(level1) - getSecurityLevelValue(level2);
}
/**
 * より高いセキュリティレベルを取得
 */
function getHigherSecurityLevel(level1, level2) {
    return compareSecurityLevels(level1, level2) >= 0 ? level1 : level2;
}
/**
 * トレースステップにセキュリティコンテキストを適用
 */
function applySecurityContext(step, securityContext) {
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
function maskSensitiveData(data) {
    if (!data)
        return data;
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
    }
    catch {
        return maskedStr;
    }
}
/**
 * セキュリティイベントの重要度判定
 */
function assessSecurityEventSeverity(eventType, context) {
    const baseSeverity = {
        'ACCESS_GRANTED': 'LOW',
        'ACCESS_DENIED': 'MEDIUM',
        'PERMISSION_ESCALATION': 'HIGH',
        'SUSPICIOUS_ACTIVITY': 'CRITICAL'
    };
    let severity = baseSeverity[eventType];
    // セキュリティレベルに基づく重要度の調整
    if (context.securityLevel === 'RESTRICTED' || context.securityLevel === 'CONFIDENTIAL') {
        if (severity === 'LOW')
            severity = 'MEDIUM';
        if (severity === 'MEDIUM')
            severity = 'HIGH';
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
function checkSecurityCompliance(trace) {
    const violations = [];
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
function createDefaultSecurityContext(securityLevel = 'INTERNAL') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC10cmFjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtdHJhY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUF5ckJILGdEQXFCQztBQUtELG9EQU1DO0FBdUJELGtEQUtDO0FBS0QsOENBS0M7QUFLRCxrREFLQztBQWdLRCw0Q0FPQztBQUtELDhDQUtDO0FBS0QsNERBS0M7QUFLRCw4Q0FJQztBQUtELDBEQTZCQztBQUtELDhGQXNDQztBQUtELG9FQXVCQztBQStMRCxzREFRQztBQUtELHNEQUVDO0FBS0Qsd0RBRUM7QUFLRCxvREFhQztBQUtELDhDQXVCQztBQUtELGtFQTBCQztBQUtELDBEQWlFQztBQUtELG9FQXdCQztBQXJ3QkQ7O0dBRUc7QUFDSCxTQUFnQixrQkFBa0IsQ0FBQyxXQUE2QjtJQUM5RCxPQUFPO1FBQ0wsT0FBTyxFQUFFLFVBQVUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQy9CLFNBQVMsRUFBRSxTQUFTO1FBQ3BCLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFlBQVksRUFBRSxTQUFTO1FBQ3ZCLFNBQVMsRUFBRSxXQUFXLENBQUMsS0FBSztRQUM1QixhQUFhLEVBQUUsRUFBRTtRQUNqQixTQUFTLEVBQUUsV0FBVyxDQUFDLFNBQVM7UUFDaEMsTUFBTSxFQUFFLFdBQVc7UUFDbkIsS0FBSyxFQUFFLEVBQUU7UUFDVCxRQUFRLEVBQUU7WUFDUixlQUFlLEVBQUUsU0FBUztZQUMxQixNQUFNLEVBQUUsU0FBUztZQUNqQixjQUFjLEVBQUU7Z0JBQ2QsaUJBQWlCLEVBQUUsS0FBSztnQkFDeEIsa0JBQWtCLEVBQUUsS0FBSztnQkFDekIseUJBQXlCLEVBQUUsS0FBSzthQUNqQztTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEtBQXdCO0lBQzNELE9BQU87UUFDTCxTQUFTLEVBQUUs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YSxLQUFLLGNBQWMsSUFBSSxhQUFhLEtBQUssWUFBWTtZQUNwRixtQkFBbUIsRUFBRSxhQUFhLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxXQUFXO1lBQzdFLHNCQUFzQixFQUFFLGFBQWEsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtTQUN2RjtRQUNELHNCQUFzQixFQUFFO1lBQ3RCLGdCQUFnQixFQUFFLGFBQWEsS0FBSyxjQUFjLElBQUksYUFBYSxLQUFLLFlBQVk7WUFDcEYsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixtQkFBbUIsRUFBRSxhQUFhLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDaEY7S0FDRixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQmVkcm9jayBBZ2VudCBUcmFjZeWei+Wumue+qVxuICogXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudOOBruWun+ihjOODiOODrOODvOOCueaDheWgseOCkuihqOePvuOBmeOCi+Wei+Wumue+qVxuICogUGhhc2UgMS4xOiBCZWRyb2NrQWdlbnRUcmFjZeWei+Wumue+qeOBruaLoeW8tVxuICogXG4gKiDkvZzmiJDml6U6IDIwMjUtMTItMTNcbiAqIOimgeS7tjogUmVxdWlyZW1lbnRzIDYuMSAoQWdlbnTlrp/ooYzjg4jjg6zjg7zjgrnmqZ/og70pXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5Z+65pys5Z6L5a6a576p77yIMjAyNOW5tEdB5qmf6IO957Wx5ZCI54mI77yJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog44OI44Os44O844K544K544OG44OD44OX44Gu44K/44Kk44OX77yIMjAyNOW5tEdB5qmf6IO95a++5b+c77yJXG4gKi9cbmV4cG9ydCB0eXBlIFRyYWNlU3RlcFR5cGUgPSBcbiAgfCAnUFJFX1BST0NFU1NJTkcnICAgICAgLy8g5YmN5Yem55CGXG4gIHwgJ09SQ0hFU1RSQVRJT04nICAgICAgIC8vIOOCquODvOOCseOCueODiOODrOODvOOCt+ODp+ODs1xuICB8ICdQT1NUX1BST0NFU1NJTkcnICAgICAvLyDlvozlh6bnkIZcbiAgfCAnS05PV0xFREdFX0JBU0UnICAgICAgLy8gS25vd2xlZGdlIEJhc2XmpJzntKJcbiAgfCAnQUNUSU9OX0dST1VQJyAgICAgICAgLy8gQWN0aW9uIEdyb3Vw5a6f6KGMXG4gIHwgJ0dVQVJEUkFJTFMnICAgICAgICAgIC8vIEd1YXJkcmFpbHPoqZXkvqFcbiAgfCAnRklOQUxfUkVTUE9OU0UnICAgICAgLy8g5pyA57WC44Os44K544Od44Oz44K5XG4gIC8vIDIwMjTlubRHQeapn+iDvei/veWKoFxuICB8ICdNVUxUSV9BR0VOVF9DT0xMQUJPUkFUSU9OJyAgLy8gTXVsdGktQWdlbnTpgKPmkLpcbiAgfCAnSU5MSU5FX0FHRU5UX0lOVk9DQVRJT04nICAgIC8vIElubGluZSBBZ2VudOWun+ihjFxuICB8ICdQQVlMT0FEX1JFRkVSRU5DSU5HJyAgICAgICAgLy8gUGF5bG9hZCBSZWZlcmVuY2luZ+acgOmBqeWMllxuICB8ICdTVVBFUlZJU09SX09SQ0hFU1RSQVRJT04nICAgLy8gU3VwZXJ2aXNvciBBZ2VudOWItuW+oVxuICB8ICdDT0xMQUJPUkFUT1JfRVhFQ1VUSU9OJzsgICAgLy8gQ29sbGFib3JhdG9yIEFnZW505a6f6KGMXG5cbi8qKlxuICog44OI44Os44O844K544K544OG44OD44OX44Gu5a6f6KGM54q25oWLXG4gKi9cbmV4cG9ydCB0eXBlIFRyYWNlU3RlcFN0YXR1cyA9IFxuICB8ICdTVEFSVEVEJyAgICAgICAgICAgICAvLyDplovlp4tcbiAgfCAnSU5fUFJPR1JFU1MnICAgICAgICAgLy8g5a6f6KGM5LitXG4gIHwgJ0NPTVBMRVRFRCcgICAgICAgICAgIC8vIOWujOS6hlxuICB8ICdGQUlMRUQnICAgICAgICAgICAgICAvLyDlpLHmlZdcbiAgfCAnU0tJUFBFRCc7ICAgICAgICAgICAgLy8g44K544Kt44OD44OXXG5cbi8qKlxuICogQWN0aW9uIEdyb3Vw44Gu5a6f6KGM57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQWN0aW9uR3JvdXBSZXN1bHQge1xuICAvKiogQWN0aW9uIEdyb3Vw5ZCNICovXG4gIGFjdGlvbkdyb3VwTmFtZTogc3RyaW5nO1xuICAvKiog5a6f6KGM44GV44KM44GfQVBJ5ZCNICovXG4gIGFwaU5hbWU6IHN0cmluZztcbiAgLyoqIOWFpeWKm+ODkeODqeODoeODvOOCvyAqL1xuICBwYXJhbWV0ZXJzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICAvKiog5a6f6KGM57WQ5p6cICovXG4gIHJlc3BvbnNlOiBhbnk7XG4gIC8qKiDlrp/ooYzmmYLplpPvvIjjg5/jg6rnp5LvvIkgKi9cbiAgZXhlY3V0aW9uVGltZU1zOiBudW1iZXI7XG4gIC8qKiDlrp/ooYznirbmhYsgKi9cbiAgc3RhdHVzOiAnU1VDQ0VTUycgfCAnRkFJTEVEJyB8ICdUSU1FT1VUJztcbiAgLyoqIOOCqOODqeODvOODoeODg+OCu+ODvOOCuO+8iOWkseaVl+aZgu+8iSAqL1xuICBlcnJvck1lc3NhZ2U/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogS25vd2xlZGdlIEJhc2XmpJzntKLntZDmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBLbm93bGVkZ2VCYXNlUmVzdWx0IHtcbiAgLyoqIEtub3dsZWRnZSBCYXNlIElEICovXG4gIGtub3dsZWRnZUJhc2VJZDogc3RyaW5nO1xuICAvKiog5qSc57Si44Kv44Ko44OqICovXG4gIHF1ZXJ5OiBzdHJpbmc7XG4gIC8qKiDmpJzntKLntZDmnpzjg4njgq3jg6Xjg6Hjg7Pjg4ggKi9cbiAgZG9jdW1lbnRzOiBBcnJheTx7XG4gICAgLyoqIOODieOCreODpeODoeODs+ODiElEICovXG4gICAgZG9jdW1lbnRJZDogc3RyaW5nO1xuICAgIC8qKiDjg4njgq3jg6Xjg6Hjg7Pjg4jjgr/jgqTjg4jjg6sgKi9cbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIC8qKiDjg4njgq3jg6Xjg6Hjg7Pjg4jlhoXlrrnvvIjmipznsovvvIkgKi9cbiAgICBjb250ZW50OiBzdHJpbmc7XG4gICAgLyoqIOmhnuS8vOW6puOCueOCs+OCoiAqL1xuICAgIHNjb3JlOiBudW1iZXI7XG4gICAgLyoqIOODoeOCv+ODh+ODvOOCvyAqL1xuICAgIG1ldGFkYXRhOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICB9PjtcbiAgLyoqIOaknOe0ouWun+ihjOaZgumWk++8iOODn+ODquenku+8iSAqL1xuICBzZWFyY2hUaW1lTXM6IG51bWJlcjtcbiAgLyoqIOaknOe0oue1kOaenOaVsCAqL1xuICByZXN1bHRDb3VudDogbnVtYmVyO1xufVxuXG4vKipcbiAqIEd1YXJkcmFpbHPoqZXkvqHntZDmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBHdWFyZHJhaWxzUmVzdWx0IHtcbiAgLyoqIEd1YXJkcmFpbHMgSUQgKi9cbiAgZ3VhcmRyYWlsSWQ6IHN0cmluZztcbiAgLyoqIOipleS+oee1kOaenCAqL1xuICBhY3Rpb246ICdBTExPV0VEJyB8ICdCTE9DS0VEJyB8ICdXQVJORUQnO1xuICAvKiog44OW44Ot44OD44Kv55CG55Sx77yI44OW44Ot44OD44Kv5pmC77yJICovXG4gIGJsb2NrUmVhc29uPzogc3RyaW5nO1xuICAvKiog6K2m5ZGK44Oh44OD44K744O844K477yI6K2m5ZGK5pmC77yJICovXG4gIHdhcm5pbmdNZXNzYWdlPzogc3RyaW5nO1xuICAvKiog6KmV5L6h5pmC6ZaT77yI44Of44Oq56eS77yJICovXG4gIGV2YWx1YXRpb25UaW1lTXM6IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gMjAyNOW5tEdB5qmf6IO95Z6L5a6a576pXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogTXVsdGktQWdlbnQgQ29sbGFib3JhdGlvbuOBruW9ueWJsuOCv+OCpOODl1xuICovXG5leHBvcnQgdHlwZSBBZ2VudFJvbGVUeXBlID0gXG4gIHwgJ1NVUEVSVklTT1InICAgICAgLy8gU3VwZXJ2aXNvciBBZ2VudO+8iOe1seaLrOODu+WItuW+oe+8iVxuICB8ICdDT0xMQUJPUkFUT1InICAgIC8vIENvbGxhYm9yYXRvciBBZ2VudO+8iOWNlOWKm+ODu+Wun+ihjO+8iVxuICB8ICdTVEFOREFMT05FJzsgICAgIC8vIOWNmOeLrEFnZW5077yI5b6T5p2l5Z6L77yJXG5cbi8qKlxuICogTXVsdGktQWdlbnQgQ29sbGFib3JhdGlvbuaDheWgsVxuICovXG5leHBvcnQgaW50ZXJmYWNlIE11bHRpQWdlbnRDb2xsYWJvcmF0aW9uIHtcbiAgLyoqIOePvuWcqOOBrkFnZW505b255YmyICovXG4gIGN1cnJlbnRBZ2VudFJvbGU6IEFnZW50Um9sZVR5cGU7XG4gIC8qKiBTdXBlcnZpc29yIEFnZW50IElE77yIQ29sbGFib3JhdG9y44Gu5aC05ZCI77yJICovXG4gIHN1cGVydmlzb3JBZ2VudElkPzogc3RyaW5nO1xuICAvKiogQ29sbGFib3JhdG9yIEFnZW50IElEc++8iFN1cGVydmlzb3Ljga7loLTlkIjvvIkgKi9cbiAgY29sbGFib3JhdG9yQWdlbnRJZHM/OiBzdHJpbmdbXTtcbiAgLyoqIOOCv+OCueOCr+WIhuino+aDheWgse+8iFN1cGVydmlzb3Ljga7loLTlkIjvvIkgKi9cbiAgdGFza0RlY29tcG9zaXRpb24/OiB7XG4gICAgLyoqIOWFg+OBruOCv+OCueOCryAqL1xuICAgIG9yaWdpbmFsVGFzazogc3RyaW5nO1xuICAgIC8qKiDliIbop6PjgZXjgozjgZ/jgrXjg5bjgr/jgrnjgq8gKi9cbiAgICBzdWJUYXNrczogQXJyYXk8e1xuICAgICAgdGFza0lkOiBzdHJpbmc7XG4gICAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgICAgYXNzaWduZWRBZ2VudElkOiBzdHJpbmc7XG4gICAgICBzdGF0dXM6ICdQRU5ESU5HJyB8ICdJTl9QUk9HUkVTUycgfCAnQ09NUExFVEVEJyB8ICdGQUlMRUQnO1xuICAgICAgcmVzdWx0PzogYW55O1xuICAgIH0+O1xuICB9O1xuICAvKiogQWdlbnTplpPpgJrkv6Hjg63jgrAgKi9cbiAgY29tbXVuaWNhdGlvbkxvZz86IEFycmF5PHtcbiAgICB0aW1lc3RhbXA6IERhdGU7XG4gICAgZnJvbUFnZW50SWQ6IHN0cmluZztcbiAgICB0b0FnZW50SWQ6IHN0cmluZztcbiAgICBtZXNzYWdlVHlwZTogJ1RBU0tfQVNTSUdOTUVOVCcgfCAnUkVTVUxUX1JFUE9SVCcgfCAnU1RBVFVTX1VQREFURScgfCAnRVJST1JfUkVQT1JUJztcbiAgICBjb250ZW50OiBhbnk7XG4gIH0+O1xufVxuXG4vKipcbiAqIElubGluZSBBZ2VudOWun+ihjOaDheWgsVxuICovXG5leHBvcnQgaW50ZXJmYWNlIElubGluZUFnZW50RXhlY3V0aW9uIHtcbiAgLyoqIElubGluZSBBZ2VudCBJRCAqL1xuICBpbmxpbmVBZ2VudElkOiBzdHJpbmc7XG4gIC8qKiDlrp/ooYzjgr/jgqTjg5cgKi9cbiAgZXhlY3V0aW9uVHlwZTogJ0lOVk9LRV9JTkxJTkVfQUdFTlQnO1xuICAvKiog5YWl5Yqb44OR44Op44Oh44O844K/ICovXG4gIGlucHV0UGFyYW1ldGVyczoge1xuICAgIC8qKiDjg5fjg63jg7Pjg5fjg4ggKi9cbiAgICBwcm9tcHQ6IHN0cmluZztcbiAgICAvKiogRm91bmRhdGlvbiBNb2RlbCAqL1xuICAgIGZvdW5kYXRpb25Nb2RlbDogc3RyaW5nO1xuICAgIC8qKiDmjqjoq5bjg5Hjg6njg6Hjg7zjgr8gKi9cbiAgICBpbmZlcmVuY2VDb25maWc/OiB7XG4gICAgICB0ZW1wZXJhdHVyZT86IG51bWJlcjtcbiAgICAgIHRvcFA/OiBudW1iZXI7XG4gICAgICBtYXhUb2tlbnM/OiBudW1iZXI7XG4gICAgfTtcbiAgfTtcbiAgLyoqIOWun+ihjOe1kOaenCAqL1xuICBleGVjdXRpb25SZXN1bHQ6IHtcbiAgICAvKiog55Sf5oiQ44GV44KM44Gf44Os44K544Od44Oz44K5ICovXG4gICAgcmVzcG9uc2U6IHN0cmluZztcbiAgICAvKiog5a6f6KGM5pmC6ZaT77yI44Of44Oq56eS77yJICovXG4gICAgZXhlY3V0aW9uVGltZU1zOiBudW1iZXI7XG4gICAgLyoqIOODiOODvOOCr+ODs+S9v+eUqOmHjyAqL1xuICAgIHRva2VuVXNhZ2U/OiB7XG4gICAgICBpbnB1dFRva2VuczogbnVtYmVyO1xuICAgICAgb3V0cHV0VG9rZW5zOiBudW1iZXI7XG4gICAgfTtcbiAgfTtcbiAgLyoqIOWun+ihjOOCueODhuODvOOCv+OCuSAqL1xuICBzdGF0dXM6ICdTVUNDRVNTJyB8ICdGQUlMRUQnIHwgJ1RJTUVPVVQnO1xuICAvKiog44Ko44Op44O85oOF5aCx77yI5aSx5pWX5pmC77yJICovXG4gIGVycm9yPzoge1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBjb2RlPzogc3RyaW5nO1xuICB9O1xufVxuXG4vKipcbiAqIFBheWxvYWQgUmVmZXJlbmNpbmfmnIDpganljJbmg4XloLFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXlsb2FkUmVmZXJlbmNpbmdPcHRpbWl6YXRpb24ge1xuICAvKiog5pyA6YGp5YyW44K/44Kk44OXICovXG4gIG9wdGltaXphdGlvblR5cGU6ICdSRUZFUkVOQ0VfQkFTRUQnIHwgJ0RJUkVDVF9QQVlMT0FEJztcbiAgLyoqIOWFg+OBruODmuOCpOODreODvOODieOCteOCpOOCuu+8iOODkOOCpOODiO+8iSAqL1xuICBvcmlnaW5hbFBheWxvYWRTaXplOiBudW1iZXI7XG4gIC8qKiDmnIDpganljJblvozjga7jg5rjgqTjg63jg7zjg4njgrXjgqTjgrrvvIjjg5DjgqTjg4jvvIkgKi9cbiAgb3B0aW1pemVkUGF5bG9hZFNpemU6IG51bWJlcjtcbiAgLyoqIOWJiua4m+eOh++8iCXvvIkgKi9cbiAgcmVkdWN0aW9uUGVyY2VudGFnZTogbnVtYmVyO1xuICAvKiog5Y+C54Wn5oOF5aCx77yIUmVmZXJlbmNlLWJhc2Vk5pyA6YGp5YyW44Gu5aC05ZCI77yJICovXG4gIHJlZmVyZW5jZUluZm8/OiB7XG4gICAgLyoqIOWPgueFp0lEICovXG4gICAgcmVmZXJlbmNlSWQ6IHN0cmluZztcbiAgICAvKiog5Y+C54Wn5YWIVVJJICovXG4gICAgcmVmZXJlbmNlVXJpOiBzdHJpbmc7XG4gICAgLyoqIOWPgueFp+ODh+ODvOOCv+OCv+OCpOODlyAqL1xuICAgIGRhdGFUeXBlOiAnVEVYVCcgfCAnSU1BR0UnIHwgJ0RPQ1VNRU5UJyB8ICdTVFJVQ1RVUkVEX0RBVEEnO1xuICB9O1xuICAvKiog44OR44OV44Kp44O844Oe44Oz44K55ZCR5LiK5oOF5aCxICovXG4gIHBlcmZvcm1hbmNlSW1wcm92ZW1lbnQ6IHtcbiAgICAvKiog44Os44K544Od44Oz44K55pmC6ZaT55+t57iu77yI44Of44Oq56eS77yJICovXG4gICAgcmVzcG9uc2VUaW1lUmVkdWN0aW9uTXM6IG51bWJlcjtcbiAgICAvKiog5biv5Z+f5bmF5YmK5rib77yI44OQ44Kk44OI77yJICovXG4gICAgYmFuZHdpZHRoU2F2aW5nQnl0ZXM6IG51bWJlcjtcbiAgICAvKiog44Kz44K544OI5YmK5rib5o6o5a6a77yIVVNE77yJICovXG4gICAgZXN0aW1hdGVkQ29zdFNhdmluZ1VzZD86IG51bWJlcjtcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g44Kq44O844Kx44K544OI44Os44O844K344On44Oz6Kmz57Sw5Z6L5a6a576pXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogUmF0aW9uYWxl77yI5o6o6KuW6YGO56iL77yJXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVHJhY2VSYXRpb25hbGUge1xuICAvKiog5o6o6KuW44OG44Kt44K544OIICovXG4gIHRleHQ6IHN0cmluZztcbiAgLyoqIOaOqOirluOBruS/oemgvOW6pu+8iDAtMe+8iSAqL1xuICBjb25maWRlbmNlPzogbnVtYmVyO1xuICAvKiog5o6o6KuW44Gr5L2/55So44GV44KM44Gf44Kz44Oz44OG44Kt44K544OIICovXG4gIGNvbnRleHQ/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBBY3Rpb27vvIjlrp/ooYzjgqLjgq/jgrfjg6fjg7PvvIlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUcmFjZUFjdGlvbiB7XG4gIC8qKiDjgqLjgq/jgrfjg6fjg7Pjgr/jgqTjg5cgKi9cbiAgdHlwZTogJ0tOT1dMRURHRV9CQVNFX0xPT0tVUCcgfCAnQUNUSU9OX0dST1VQX0lOVk9DQVRJT04nIHwgJ0ZJTkFMX1JFU1BPTlNFJztcbiAgLyoqIOOCouOCr+OCt+ODp+ODs+WQjSAqL1xuICBuYW1lOiBzdHJpbmc7XG4gIC8qKiDjgqLjgq/jgrfjg6fjg7PlhaXlipsgKi9cbiAgaW5wdXQ6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gIC8qKiDjgqLjgq/jgrfjg6fjg7Plrp/ooYzmmYLplpPvvIjjg5/jg6rnp5LvvIkgKi9cbiAgZXhlY3V0aW9uVGltZU1zOiBudW1iZXI7XG59XG5cbi8qKlxuICogT2JzZXJ2YXRpb27vvIjoprPmuKzntZDmnpzvvIlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUcmFjZU9ic2VydmF0aW9uIHtcbiAgLyoqIOims+a4rOOCv+OCpOODlyAqL1xuICB0eXBlOiAnS05PV0xFREdFX0JBU0VfUkVTVUxUJyB8ICdBQ1RJT05fR1JPVVBfUkVTVUxUJyB8ICdFUlJPUic7XG4gIC8qKiDoprPmuKzlhoXlrrkgKi9cbiAgY29udGVudDogYW55O1xuICAvKiog6Kaz5ris5pmC5Yi7ICovXG4gIHRpbWVzdGFtcDogRGF0ZTtcbiAgLyoqIOmWoumAo+OBmeOCi+OCouOCr+OCt+ODp+ODsyAqL1xuICByZWxhdGVkQWN0aW9uPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIOOCquODvOOCseOCueODiOODrOODvOOCt+ODp+ODs+OCueODhuODg+ODl1xuICovXG5leHBvcnQgaW50ZXJmYWNlIE9yY2hlc3RyYXRpb25TdGVwIHtcbiAgLyoqIOOCueODhuODg+ODl0lEICovXG4gIHN0ZXBJZDogc3RyaW5nO1xuICAvKiog44K544OG44OD44OX55Wq5Y+3ICovXG4gIHN0ZXBOdW1iZXI6IG51bWJlcjtcbiAgLyoqIOaOqOirlumBjueoiyAqL1xuICByYXRpb25hbGU6IFRyYWNlUmF0aW9uYWxlO1xuICAvKiog5a6f6KGM44Ki44Kv44K344On44OzICovXG4gIGFjdGlvbjogVHJhY2VBY3Rpb247XG4gIC8qKiDoprPmuKzntZDmnpwgKi9cbiAgb2JzZXJ2YXRpb246IFRyYWNlT2JzZXJ2YXRpb247XG4gIC8qKiDjgrnjg4bjg4Pjg5flrp/ooYzmmYLplpPvvIjjg5/jg6rnp5LvvIkgKi9cbiAgZXhlY3V0aW9uVGltZU1zOiBudW1iZXI7XG4gIC8qKiDjgrnjg4bjg4Pjg5fnirbmhYsgKi9cbiAgc3RhdHVzOiBUcmFjZVN0ZXBTdGF0dXM7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOODoeOCpOODs+ODiOODrOODvOOCueWei+Wumue+qVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOODiOODrOODvOOCueOCueODhuODg+ODl+ips+e0sFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlU3RlcCB7XG4gIC8qKiDjgrnjg4bjg4Pjg5dJRCAqL1xuICBzdGVwSWQ6IHN0cmluZztcbiAgLyoqIOOCueODhuODg+ODl+OCv+OCpOODlyAqL1xuICB0eXBlOiBUcmFjZVN0ZXBUeXBlO1xuICAvKiog44K544OG44OD44OX5ZCNICovXG4gIG5hbWU6IHN0cmluZztcbiAgLyoqIOmWi+Wni+aZguWIuyAqL1xuICBzdGFydFRpbWU6IERhdGU7XG4gIC8qKiDntYLkuobmmYLliLsgKi9cbiAgZW5kVGltZT86IERhdGU7XG4gIC8qKiDlrp/ooYzmmYLplpPvvIjjg5/jg6rnp5LvvIkgKi9cbiAgZXhlY3V0aW9uVGltZU1zPzogbnVtYmVyO1xuICAvKiog44K544OG44OD44OX54q25oWLICovXG4gIHN0YXR1czogVHJhY2VTdGVwU3RhdHVzO1xuICAvKiog44K544OG44OD44OX6Kmz57Sw5oOF5aCx77yIMjAyNOW5tEdB5qmf6IO957Wx5ZCI54mI77yJICovXG4gIGRldGFpbHM6IHtcbiAgICAvKiog5YWl5Yqb44OH44O844K/ICovXG4gICAgaW5wdXQ/OiBhbnk7XG4gICAgLyoqIOWHuuWKm+ODh+ODvOOCvyAqL1xuICAgIG91dHB1dD86IGFueTtcbiAgICAvKiog44Ko44Op44O85oOF5aCxICovXG4gICAgZXJyb3I/OiB7XG4gICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICBjb2RlPzogc3RyaW5nO1xuICAgICAgZGV0YWlscz86IGFueTtcbiAgICB9O1xuICAgIC8qKiBBY3Rpb24gR3JvdXDntZDmnpzvvIjoqbLlvZPjgZnjgovloLTlkIjvvIkgKi9cbiAgICBhY3Rpb25Hcm91cFJlc3VsdD86IEFjdGlvbkdyb3VwUmVzdWx0O1xuICAgIC8qKiBLbm93bGVkZ2UgQmFzZee1kOaenO+8iOipsuW9k+OBmeOCi+WgtOWQiO+8iSAqL1xuICAgIGtub3dsZWRnZUJhc2VSZXN1bHQ/OiBLbm93bGVkZ2VCYXNlUmVzdWx0O1xuICAgIC8qKiBHdWFyZHJhaWxz57WQ5p6c77yI6Kmy5b2T44GZ44KL5aC05ZCI77yJICovXG4gICAgZ3VhcmRyYWlsc1Jlc3VsdD86IEd1YXJkcmFpbHNSZXN1bHQ7XG4gICAgLyoqIOOCquODvOOCseOCueODiOODrOODvOOCt+ODp+ODs+OCueODhuODg+ODl++8iOipsuW9k+OBmeOCi+WgtOWQiO+8iSAqL1xuICAgIG9yY2hlc3RyYXRpb25TdGVwcz86IE9yY2hlc3RyYXRpb25TdGVwW107XG4gICAgLy8gMjAyNOW5tEdB5qmf6IO96L+95YqgXG4gICAgLyoqIE11bHRpLUFnZW50IENvbGxhYm9yYXRpb27oqbPntLDvvIjoqbLlvZPjgZnjgovloLTlkIjvvIkgKi9cbiAgICBtdWx0aUFnZW50RGV0YWlscz86IHtcbiAgICAgIC8qKiDnj77lnKjjga5BZ2VudOW9ueWJsiAqL1xuICAgICAgYWdlbnRSb2xlOiBBZ2VudFJvbGVUeXBlO1xuICAgICAgLyoqIOOCv+OCueOCr+WIhuino+e1kOaenO+8iFN1cGVydmlzb3Ljga7loLTlkIjvvIkgKi9cbiAgICAgIHRhc2tEZWNvbXBvc2l0aW9uPzogTXVsdGlBZ2VudENvbGxhYm9yYXRpb25bJ3Rhc2tEZWNvbXBvc2l0aW9uJ107XG4gICAgICAvKiogQWdlbnTplpPpgJrkv6HvvIjoqbLlvZPjgZnjgovloLTlkIjvvIkgKi9cbiAgICAgIGludGVyQWdlbnRDb21tdW5pY2F0aW9uPzogTXVsdGlBZ2VudENvbGxhYm9yYXRpb25bJ2NvbW11bmljYXRpb25Mb2cnXTtcbiAgICB9O1xuICAgIC8qKiBJbmxpbmUgQWdlbnTlrp/ooYzoqbPntLDvvIjoqbLlvZPjgZnjgovloLTlkIjvvIkgKi9cbiAgICBpbmxpbmVBZ2VudERldGFpbHM/OiBJbmxpbmVBZ2VudEV4ZWN1dGlvbjtcbiAgICAvKiogUGF5bG9hZCBSZWZlcmVuY2luZ+acgOmBqeWMluips+e0sO+8iOipsuW9k+OBmeOCi+WgtOWQiO+8iSAqL1xuICAgIHBheWxvYWRPcHRpbWl6YXRpb25EZXRhaWxzPzogUGF5bG9hZFJlZmVyZW5jaW5nT3B0aW1pemF0aW9uO1xuICB9O1xuICAvKiog5a2Q44K544OG44OD44OXICovXG4gIHN1YlN0ZXBzPzogVHJhY2VTdGVwW107XG59XG5cbi8qKlxuICogQmVkcm9jayBBZ2VudOWun+ihjOODiOODrOODvOOCue+8iOaLoeW8teeJiO+8iVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudFRyYWNlIHtcbiAgLyoqIOODiOODrOODvOOCuUlEICovXG4gIHRyYWNlSWQ6IHN0cmluZztcbiAgLyoqIOOCu+ODg+OCt+ODp+ODs0lEICovXG4gIHNlc3Npb25JZDogc3RyaW5nO1xuICAvKiogQWdlbnQgSUQgKi9cbiAgYWdlbnRJZDogc3RyaW5nO1xuICAvKiogQWdlbnQgQWxpYXMgSUQgKi9cbiAgYWdlbnRBbGlhc0lkOiBzdHJpbmc7XG4gIC8qKiDjg6bjg7zjgrbjg7zjgq/jgqjjg6ogKi9cbiAgdXNlclF1ZXJ5OiBzdHJpbmc7XG4gIC8qKiDmnIDntYLjg6zjgrnjg53jg7PjgrkgKi9cbiAgZmluYWxSZXNwb25zZTogc3RyaW5nO1xuICAvKiog44OI44Os44O844K56ZaL5aeL5pmC5Yi7ICovXG4gIHN0YXJ0VGltZTogRGF0ZTtcbiAgLyoqIOODiOODrOODvOOCuee1guS6huaZguWIuyAqL1xuICBlbmRUaW1lPzogRGF0ZTtcbiAgLyoqIOe3j+Wun+ihjOaZgumWk++8iOODn+ODquenku+8iSAqL1xuICB0b3RhbEV4ZWN1dGlvblRpbWVNcz86IG51bWJlcjtcbiAgLyoqIOODiOODrOODvOOCueeKtuaFiyAqL1xuICBzdGF0dXM6ICdSVU5OSU5HJyB8ICdDT01QTEVURUQnIHwgJ0ZBSUxFRCc7XG4gIC8qKiDjg4jjg6zjg7zjgrnjgrnjg4bjg4Pjg5cgKi9cbiAgc3RlcHM6IFRyYWNlU3RlcFtdO1xuICAvKiog44Oh44K/44OH44O844K/77yIMjAyNOW5tEdB5qmf6IO957Wx5ZCI54mI77yJICovXG4gIG1ldGFkYXRhOiB7XG4gICAgLyoqIOS9v+eUqOODouODh+ODqyAqL1xuICAgIGZvdW5kYXRpb25Nb2RlbDogc3RyaW5nO1xuICAgIC8qKiDjg6rjg7zjgrjjg6fjg7MgKi9cbiAgICByZWdpb246IHN0cmluZztcbiAgICAvKiog44OI44O844Kv44Oz5L2/55So6YePICovXG4gICAgdG9rZW5Vc2FnZT86IHtcbiAgICAgIGlucHV0VG9rZW5zOiBudW1iZXI7XG4gICAgICBvdXRwdXRUb2tlbnM6IG51bWJlcjtcbiAgICAgIHRvdGFsVG9rZW5zOiBudW1iZXI7XG4gICAgfTtcbiAgICAvKiog44K744OD44K344On44Oz5bGe5oCnICovXG4gICAgc2Vzc2lvbkF0dHJpYnV0ZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIC8qKiDjg5fjg63jg7Pjg5fjg4jjgrvjg4Pjgrfjg6fjg7PlsZ7mgKcgKi9cbiAgICBwcm9tcHRTZXNzaW9uQXR0cmlidXRlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gICAgLy8gMjAyNOW5tEdB5qmf6IO96L+95YqgXG4gICAgLyoqIE11bHRpLUFnZW50IENvbGxhYm9yYXRpb27mg4XloLEgKi9cbiAgICBtdWx0aUFnZW50Q29sbGFib3JhdGlvbj86IE11bHRpQWdlbnRDb2xsYWJvcmF0aW9uO1xuICAgIC8qKiBJbmxpbmUgQWdlbnTlrp/ooYzmg4XloLEgKi9cbiAgICBpbmxpbmVBZ2VudEV4ZWN1dGlvbnM/OiBJbmxpbmVBZ2VudEV4ZWN1dGlvbltdO1xuICAgIC8qKiBQYXlsb2FkIFJlZmVyZW5jaW5n5pyA6YGp5YyW5oOF5aCxICovXG4gICAgcGF5bG9hZE9wdGltaXphdGlvbj86IFBheWxvYWRSZWZlcmVuY2luZ09wdGltaXphdGlvbjtcbiAgICAvKiogMjAyNOW5tEdB5qmf6IO944OV44Op44KwICovXG4gICAgZ2FGZWF0dXJlczIwMjQ6IHtcbiAgICAgIC8qKiBNdWx0aS1BZ2VudCBDb2xsYWJvcmF0aW9u5pyJ5Yq5ICovXG4gICAgICBtdWx0aUFnZW50RW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIC8qKiBJbmxpbmUgQWdlbnTmnInlirkgKi9cbiAgICAgIGlubGluZUFnZW50RW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIC8qKiBQYXlsb2FkIFJlZmVyZW5jaW5n5pyJ5Yq5ICovXG4gICAgICBwYXlsb2FkUmVmZXJlbmNpbmdFbmFibGVkOiBib29sZWFuO1xuICAgIH07XG4gIH07XG4gIC8qKiDjgqjjg6njg7zmg4XloLHvvIjlpLHmlZfmmYLvvIkgKi9cbiAgZXJyb3I/OiB7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGNvZGU/OiBzdHJpbmc7XG4gICAgZGV0YWlscz86IGFueTtcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g44K744Kt44Ol44Oq44OG44Kj6Zai6YCj5Z6L5a6a576pXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog44K744Kt44Ol44Oq44OG44Kj44Os44OZ44Or5a6a576pXG4gKi9cbmV4cG9ydCB0eXBlIFNlY3VyaXR5TGV2ZWwgPSBcbiAgfCAnUFVCTElDJyAgICAgICAgLy8g5YWs6ZaL5oOF5aCxXG4gIHwgJ0lOVEVSTkFMJyAgICAgIC8vIOWGhemDqOaDheWgsVxuICB8ICdDT05GSURFTlRJQUwnICAvLyDmqZ/lr4bmg4XloLFcbiAgfCAnUkVTVFJJQ1RFRCc7ICAgLy8g5Yi26ZmQ5oOF5aCxXG5cbi8qKlxuICog44OI44Os44O844K544K744Kt44Ol44Oq44OG44Kj44Kz44Oz44OG44Kt44K544OIXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVHJhY2VTZWN1cml0eUNvbnRleHQge1xuICAvKiog44K744Kt44Ol44Oq44OG44Kj44Os44OZ44OrICovXG4gIHNlY3VyaXR5TGV2ZWw6IFNlY3VyaXR5TGV2ZWw7XG4gIC8qKiDjg4fjg7zjgr/liIbpoZ4gKi9cbiAgZGF0YUNsYXNzaWZpY2F0aW9uOiB7XG4gICAgLyoqIOWAi+S6uuaDheWgseOCkuWQq+OCgOOBiyAqL1xuICAgIGNvbnRhaW5zUElJOiBib29sZWFuO1xuICAgIC8qKiDmqZ/lr4bjg4fjg7zjgr/jgpLlkKvjgoDjgYsgKi9cbiAgICBjb250YWluc0NvbmZpZGVudGlhbERhdGE6IGJvb2xlYW47XG4gICAgLyoqIOimj+WItuWvvuixoeODh+ODvOOCv+OCkuWQq+OCgOOBiyAqL1xuICAgIGNvbnRhaW5zUmVndWxhdGVkRGF0YTogYm9vbGVhbjtcbiAgfTtcbiAgLyoqIOOCouOCr+OCu+OCueWItuW+oSAqL1xuICBhY2Nlc3NDb250cm9sOiB7XG4gICAgLyoqIOW/heimgeOBquaoqemZkOODrOODmeODqyAqL1xuICAgIHJlcXVpcmVkUGVybWlzc2lvbnM6IHN0cmluZ1tdO1xuICAgIC8qKiDjgqLjgq/jgrvjgrnlj6/og73jgarjg63jg7zjg6sgKi9cbiAgICBhbGxvd2VkUm9sZXM6IHN0cmluZ1tdO1xuICAgIC8qKiDlnLDnkIbnmoTliLbpmZAgKi9cbiAgICBnZW9ncmFwaGljUmVzdHJpY3Rpb25zPzogc3RyaW5nW107XG4gIH07XG4gIC8qKiDnm6Pmn7vopoHku7YgKi9cbiAgYXVkaXRSZXF1aXJlbWVudHM6IHtcbiAgICAvKiog55uj5p+744Ot44Kw44GM5b+F6KaB44GLICovXG4gICAgYXVkaXRMb2dSZXF1aXJlZDogYm9vbGVhbjtcbiAgICAvKiog5L+d5oyB5pyf6ZaT77yI5pel5pWw77yJICovXG4gICAgcmV0ZW50aW9uUGVyaW9kRGF5czogbnVtYmVyO1xuICAgIC8qKiDjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnopoHku7YgKi9cbiAgICBjb21wbGlhbmNlUmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgfTtcbiAgLyoqIOaal+WPt+WMluimgeS7tiAqL1xuICBlbmNyeXB0aW9uUmVxdWlyZW1lbnRzOiB7XG4gICAgLyoqIOS/neWtmOaZguaal+WPt+WMluOBjOW/heimgeOBiyAqL1xuICAgIGVuY3J5cHRpb25BdFJlc3Q6IGJvb2xlYW47XG4gICAgLyoqIOi7oumAgeaZguaal+WPt+WMluOBjOW/heimgeOBiyAqL1xuICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IGJvb2xlYW47XG4gICAgLyoqIOS9v+eUqOOBmeOCi+aal+WPt+WMluOCouODq+OCtOODquOCuuODoCAqL1xuICAgIGVuY3J5cHRpb25BbGdvcml0aG0/OiBzdHJpbmc7XG4gIH07XG59XG5cbi8qKlxuICog44K744Kt44Ol44Ki44OI44Os44O844K544K544OG44OD44OXXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPmg4XloLHjgpLlkKvjgoDjg4jjg6zjg7zjgrnjgrnjg4bjg4Pjg5fjga7mi6HlvLXniYhcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZWN1cmVUcmFjZVN0ZXAgZXh0ZW5kcyBUcmFjZVN0ZXAge1xuICAvKiog44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44OG44Kt44K544OIICovXG4gIHNlY3VyaXR5Q29udGV4dDogVHJhY2VTZWN1cml0eUNvbnRleHQ7XG4gIC8qKiDjg57jgrnjgq/muIjjgb/jg4fjg7zjgr8gKi9cbiAgbWFza2VkRGV0YWlscz86IHtcbiAgICAvKiog44Oe44K544Kv44GV44KM44Gf5YWl5Yqb44OH44O844K/ICovXG4gICAgbWFza2VkSW5wdXQ/OiBhbnk7XG4gICAgLyoqIOODnuOCueOCr+OBleOCjOOBn+WHuuWKm+ODh+ODvOOCvyAqL1xuICAgIG1hc2tlZE91dHB1dD86IGFueTtcbiAgICAvKiog44Oe44K544Kv44OR44K/44O844OzICovXG4gICAgbWFza2luZ1BhdHRlcm5zOiBzdHJpbmdbXTtcbiAgfTtcbiAgLyoqIOOCu+OCreODpeODquODhuOCo+OCpOODmeODs+ODiCAqL1xuICBzZWN1cml0eUV2ZW50cz86IEFycmF5PHtcbiAgICAvKiog44Kk44OZ44Oz44OI44K/44Kk44OXICovXG4gICAgZXZlbnRUeXBlOiAnQUNDRVNTX0dSQU5URUQnIHwgJ0FDQ0VTU19ERU5JRUQnIHwgJ1BFUk1JU1NJT05fRVNDQUxBVElPTicgfCAnU1VTUElDSU9VU19BQ1RJVklUWSc7XG4gICAgLyoqIOOCpOODmeODs+ODiOaZguWIuyAqL1xuICAgIHRpbWVzdGFtcDogRGF0ZTtcbiAgICAvKiog44Kk44OZ44Oz44OI6Kmz57SwICovXG4gICAgZGV0YWlsczogc3RyaW5nO1xuICAgIC8qKiDph43opoHluqYgKi9cbiAgICBzZXZlcml0eTogJ0xPVycgfCAnTUVESVVNJyB8ICdISUdIJyB8ICdDUklUSUNBTCc7XG4gIH0+O1xufVxuXG4vKipcbiAqIOOCu+OCreODpeOCokJlZHJvY2tBZ2VudFRyYWNlXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPmg4XloLHjgpLlkKvjgoDjg4jjg6zjg7zjgrnjga7mi6HlvLXniYhcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZWN1cmVCZWRyb2NrQWdlbnRUcmFjZSBleHRlbmRzIE9taXQ8QmVkcm9ja0FnZW50VHJhY2UsICdzdGVwcyc+IHtcbiAgLyoqIOOCu+OCreODpeOCouODiOODrOODvOOCueOCueODhuODg+ODlyAqL1xuICBzdGVwczogU2VjdXJlVHJhY2VTdGVwW107XG4gIC8qKiDlhajkvZPjga7jgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjg4bjgq3jgrnjg4ggKi9cbiAgZ2xvYmFsU2VjdXJpdHlDb250ZXh0OiBUcmFjZVNlY3VyaXR5Q29udGV4dDtcbiAgLyoqIOOCu+OCreODpeODquODhuOCo+ebo+afu+ODreOCsCAqL1xuICBzZWN1cml0eUF1ZGl0TG9nOiBBcnJheTx7XG4gICAgLyoqIOebo+afu+OCpOODmeODs+ODiElEICovXG4gICAgYXVkaXRFdmVudElkOiBzdHJpbmc7XG4gICAgLyoqIOebo+afu+aZguWIuyAqL1xuICAgIHRpbWVzdGFtcDogRGF0ZTtcbiAgICAvKiog55uj5p+75a++6LGh44Om44O844K244O8ICovXG4gICAgdXNlcklkOiBzdHJpbmc7XG4gICAgLyoqIOWun+ihjOOBleOCjOOBn+OCouOCr+OCt+ODp+ODsyAqL1xuICAgIGFjdGlvbjogc3RyaW5nO1xuICAgIC8qKiDjgqLjgq/jgrvjgrnjgZXjgozjgZ/jg6rjgr3jg7zjgrkgKi9cbiAgICByZXNvdXJjZTogc3RyaW5nO1xuICAgIC8qKiDntZDmnpwgKi9cbiAgICByZXN1bHQ6ICdTVUNDRVNTJyB8ICdGQUlMVVJFJyB8ICdQQVJUSUFMJztcbiAgICAvKiog6Kmz57Sw5oOF5aCxICovXG4gICAgZGV0YWlscz86IGFueTtcbiAgfT47XG4gIC8qKiDjg4fjg7zjgr/kv53orbfmg4XloLEgKi9cbiAgZGF0YVByb3RlY3Rpb246IHtcbiAgICAvKiog44OH44O844K/44Oe44K544Kt44Oz44Kw44GM6YGp55So44GV44KM44Gm44GE44KL44GLICovXG4gICAgbWFza2luZ0FwcGxpZWQ6IGJvb2xlYW47XG4gICAgLyoqIOaal+WPt+WMluOBjOmBqeeUqOOBleOCjOOBpuOBhOOCi+OBiyAqL1xuICAgIGVuY3J5cHRpb25BcHBsaWVkOiBib29sZWFuO1xuICAgIC8qKiDjg4fjg7zjgr/ljL/lkI3ljJbjgYzpgannlKjjgZXjgozjgabjgYTjgovjgYsgKi9cbiAgICBhbm9ueW1pemF0aW9uQXBwbGllZDogYm9vbGVhbjtcbiAgICAvKiog6YGp55So44GV44KM44Gf44OX44Op44Kk44OQ44K344O85L+d6K235omL5rOVICovXG4gICAgcHJpdmFjeVByb3RlY3Rpb25NZXRob2RzOiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuLyoqXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPjg53jg6rjgrfjg7zoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZWN1cml0eVBvbGljeUNvbmZpZyB7XG4gIC8qKiDjg4fjg5Xjgqnjg6vjg4jjgrvjgq3jg6Xjg6rjg4bjgqPjg6zjg5njg6sgKi9cbiAgZGVmYXVsdFNlY3VyaXR5TGV2ZWw6IFNlY3VyaXR5TGV2ZWw7XG4gIC8qKiDoh6rli5Xjg57jgrnjgq3jg7PjgrDoqK3lrpogKi9cbiAgYXV0b01hc2tpbmc6IHtcbiAgICAvKiog5pyJ5Yq544GL44Gp44GG44GLICovXG4gICAgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAvKiog44Oe44K544Kt44Oz44Kw44OR44K/44O844OzICovXG4gICAgcGF0dGVybnM6IEFycmF5PHtcbiAgICAgIC8qKiDjg5Hjgr/jg7zjg7PlkI0gKi9cbiAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgIC8qKiDmraPopo/ooajnj77jg5Hjgr/jg7zjg7MgKi9cbiAgICAgIHJlZ2V4OiBzdHJpbmc7XG4gICAgICAvKiog572u5o+b5paH5a2X5YiXICovXG4gICAgICByZXBsYWNlbWVudDogc3RyaW5nO1xuICAgIH0+O1xuICB9O1xuICAvKiog44Ki44Kv44K744K55Yi25b6h6Kit5a6aICovXG4gIGFjY2Vzc0NvbnRyb2w6IHtcbiAgICAvKiog5Y6z5qC844Oi44O844OJICovXG4gICAgc3RyaWN0TW9kZTogYm9vbGVhbjtcbiAgICAvKiog44OH44OV44Kp44Or44OI5qip6ZmQICovXG4gICAgZGVmYXVsdFBlcm1pc3Npb25zOiBzdHJpbmdbXTtcbiAgICAvKiog44Ot44O844Or44OZ44O844K544Ki44Kv44K744K55Yi25b6hICovXG4gICAgcmJhY0VuYWJsZWQ6IGJvb2xlYW47XG4gIH07XG4gIC8qKiDnm6Pmn7voqK3lrpogKi9cbiAgYXVkaXRDb25maWc6IHtcbiAgICAvKiog5YWo44Ki44Kv44K344On44Oz44KS55uj5p+744GZ44KL44GLICovXG4gICAgYXVkaXRBbGxBY3Rpb25zOiBib29sZWFuO1xuICAgIC8qKiDnm6Pmn7vlr77osaHjgqLjgq/jgrfjg6fjg7MgKi9cbiAgICBhdWRpdGVkQWN0aW9uczogc3RyaW5nW107XG4gICAgLyoqIOebo+afu+ODreOCsOOBruS/neaMgeacn+mWk++8iOaXpeaVsO+8iSAqL1xuICAgIGF1ZGl0UmV0ZW50aW9uRGF5czogbnVtYmVyO1xuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBVSeihqOekuueUqOWei+Wumue+qVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOODiOODrOODvOOCueihqOekuuioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlRGlzcGxheUNvbmZpZyB7XG4gIC8qKiDlsZXplovjgZXjgozjgZ/jgrnjg4bjg4Pjg5dJRCAqL1xuICBleHBhbmRlZFN0ZXBzOiBTZXQ8c3RyaW5nPjtcbiAgLyoqIOihqOekuuOBmeOCi+OCueODhuODg+ODl+OCv+OCpOODlyAqL1xuICB2aXNpYmxlU3RlcFR5cGVzOiBTZXQ8VHJhY2VTdGVwVHlwZT47XG4gIC8qKiDoqbPntLDooajnpLrjg6Ljg7zjg4kgKi9cbiAgZGV0YWlsTW9kZTogJ1NJTVBMRScgfCAnREVUQUlMRUQnO1xuICAvKiog44K/44Kk44Og44Op44Kk44Oz6KGo56S6ICovXG4gIHNob3dUaW1lbGluZTogYm9vbGVhbjtcbiAgLyoqIOODkeODleOCqeODvOODnuODs+OCueaDheWgseihqOekuiAqL1xuICBzaG93UGVyZm9ybWFuY2U6IGJvb2xlYW47XG59XG5cbi8qKlxuICog44OI44Os44O844K557Wx6KiI5oOF5aCxXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVHJhY2VTdGF0aXN0aWNzIHtcbiAgLyoqIOe3j+OCueODhuODg+ODl+aVsCAqL1xuICB0b3RhbFN0ZXBzOiBudW1iZXI7XG4gIC8qKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fliKXjgqvjgqbjg7Pjg4ggKi9cbiAgc3RlcFR5cGVDb3VudHM6IFJlY29yZDxUcmFjZVN0ZXBUeXBlLCBudW1iZXI+O1xuICAvKiog5bmz5Z2H5a6f6KGM5pmC6ZaT77yI44Of44Oq56eS77yJICovXG4gIGF2ZXJhZ2VFeGVjdXRpb25UaW1lTXM6IG51bWJlcjtcbiAgLyoqIOacgOmVt+Wun+ihjOOCueODhuODg+ODlyAqL1xuICBsb25nZXN0U3RlcD86IHtcbiAgICBzdGVwSWQ6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgZXhlY3V0aW9uVGltZU1zOiBudW1iZXI7XG4gIH07XG4gIC8qKiDjgqjjg6njg7zmlbAgKi9cbiAgZXJyb3JDb3VudDogbnVtYmVyO1xuICAvKiog5oiQ5Yqf546H77yIJe+8iSAqL1xuICBzdWNjZXNzUmF0ZTogbnVtYmVyO1xufVxuXG4vKipcbiAqIOODiOODrOODvOOCueODleOCo+ODq+OCv+ODvOioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlRmlsdGVyIHtcbiAgLyoqIOaZgumWk+evhOWbsiAqL1xuICB0aW1lUmFuZ2U/OiB7XG4gICAgc3RhcnQ6IERhdGU7XG4gICAgZW5kOiBEYXRlO1xuICB9O1xuICAvKiog44K544OG44OD44OX44K/44Kk44OX44OV44Kj44Or44K/44O8ICovXG4gIHN0ZXBUeXBlcz86IFRyYWNlU3RlcFR5cGVbXTtcbiAgLyoqIOOCueODhuODvOOCv+OCueODleOCo+ODq+OCv+ODvCAqL1xuICBzdGF0dXNlcz86IFRyYWNlU3RlcFN0YXR1c1tdO1xuICAvKiog44Kt44O844Ov44O844OJ5qSc57SiICovXG4gIGtleXdvcmQ/OiBzdHJpbmc7XG4gIC8qKiDmnIDlsI/lrp/ooYzmmYLplpPvvIjjg5/jg6rnp5LvvIkgKi9cbiAgbWluRXhlY3V0aW9uVGltZU1zPzogbnVtYmVyO1xuICAvKiog5pyA5aSn5a6f6KGM5pmC6ZaT77yI44Of44Oq56eS77yJICovXG4gIG1heEV4ZWN1dGlvblRpbWVNcz86IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g44Ko44Kv44K544Od44O844OI44O75qSc57Si55So5Z6L5a6a576pXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog44OI44Os44O844K544Ko44Kv44K544Od44O844OI5b2i5byPXG4gKi9cbmV4cG9ydCB0eXBlIFRyYWNlRXhwb3J0Rm9ybWF0ID0gJ0pTT04nIHwgJ0NTVicgfCAnWE1MJztcblxuLyoqXG4gKiDjg4jjg6zjg7zjgrnjgqjjgq/jgrnjg53jg7zjg4joqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUcmFjZUV4cG9ydENvbmZpZyB7XG4gIC8qKiDjgqjjgq/jgrnjg53jg7zjg4jlvaLlvI8gKi9cbiAgZm9ybWF0OiBUcmFjZUV4cG9ydEZvcm1hdDtcbiAgLyoqIOWQq+OCgeOCi+ODleOCo+ODvOODq+ODiSAqL1xuICBpbmNsdWRlRmllbGRzOiBzdHJpbmdbXTtcbiAgLyoqIOips+e0sOODrOODmeODqyAqL1xuICBkZXRhaWxMZXZlbDogJ1NVTU1BUlknIHwgJ0RFVEFJTEVEJyB8ICdGVUxMJztcbiAgLyoqIOaZgumWk+evhOWbsiAqL1xuICB0aW1lUmFuZ2U/OiB7XG4gICAgc3RhcnQ6IERhdGU7XG4gICAgZW5kOiBEYXRlO1xuICB9O1xufVxuXG4vKipcbiAqIOODiOODrOODvOOCueaknOe0oue1kOaenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlU2VhcmNoUmVzdWx0IHtcbiAgLyoqIOaknOe0oue1kOaenOODiOODrOODvOOCuSAqL1xuICB0cmFjZXM6IEJlZHJvY2tBZ2VudFRyYWNlW107XG4gIC8qKiDnt4/ku7bmlbAgKi9cbiAgdG90YWxDb3VudDogbnVtYmVyO1xuICAvKiog44Oa44O844K45oOF5aCxICovXG4gIHBhZ2luYXRpb246IHtcbiAgICBwYWdlOiBudW1iZXI7XG4gICAgcGFnZVNpemU6IG51bWJlcjtcbiAgICB0b3RhbFBhZ2VzOiBudW1iZXI7XG4gIH07XG4gIC8qKiDmpJzntKLntbHoqIggKi9cbiAgc3RhdGlzdGljczogVHJhY2VTdGF0aXN0aWNzO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDml6LlrZjlnovjgajjga7kupLmj5vmgKdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDml6LlrZjjga5BZ2VudFRyYWNl5Z6L44Go44Gu5LqS5o+b5oCn44KS5L+d44Gk44Gf44KB44Gu44Oe44OD44OU44Oz44Kw5Z6LXG4gKiBAZGVwcmVjYXRlZCDmlrDjgZfjgYRCZWRyb2NrQWdlbnRUcmFjZeWei+OCkuS9v+eUqOOBl+OBpuOBj+OBoOOBleOBhFxuICovXG5leHBvcnQgaW50ZXJmYWNlIExlZ2FjeUFnZW50VHJhY2Uge1xuICB0aW1lc3RhbXA6IERhdGU7XG4gIHF1ZXJ5OiBzdHJpbmc7XG4gIHRyYWNlOiBhbnk7IC8vIOaXouWtmOOBruWun+ijheOBqOOBruS6kuaPm+aAp+OBruOBn+OCgVxufVxuXG4vKipcbiAqIOaXouWtmOOBrkFnZW50VHJhY2XlnovjgpJCZWRyb2NrQWdlbnRUcmFjZeWei+OBq+WkieaPm+OBmeOCi+mWouaVsFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydExlZ2FjeVRyYWNlKGxlZ2FjeVRyYWNlOiBMZWdhY3lBZ2VudFRyYWNlKTogQmVkcm9ja0FnZW50VHJhY2Uge1xuICByZXR1cm4ge1xuICAgIHRyYWNlSWQ6IGBsZWdhY3lfJHtEYXRlLm5vdygpfWAsXG4gICAgc2Vzc2lvbklkOiAndW5rbm93bicsXG4gICAgYWdlbnRJZDogJ3Vua25vd24nLFxuICAgIGFnZW50QWxpYXNJZDogJ3Vua25vd24nLFxuICAgIHVzZXJRdWVyeTogbGVnYWN5VHJhY2UucXVlcnksXG4gICAgZmluYWxSZXNwb25zZTogJycsXG4gICAgc3RhcnRUaW1lOiBsZWdhY3lUcmFjZS50aW1lc3RhbXAsXG4gICAgc3RhdHVzOiAnQ09NUExFVEVEJyxcbiAgICBzdGVwczogW10sXG4gICAgbWV0YWRhdGE6IHtcbiAgICAgIGZvdW5kYXRpb25Nb2RlbDogJ3Vua25vd24nLFxuICAgICAgcmVnaW9uOiAndW5rbm93bicsXG4gICAgICBnYUZlYXR1cmVzMjAyNDoge1xuICAgICAgICBtdWx0aUFnZW50RW5hYmxlZDogZmFsc2UsXG4gICAgICAgIGlubGluZUFnZW50RW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHBheWxvYWRSZWZlcmVuY2luZ0VuYWJsZWQ6IGZhbHNlXG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIEJlZHJvY2tBZ2VudFRyYWNl5Z6L44KS5pei5a2Y44GuQWdlbnRUcmFjZeWei+OBq+WkieaPm+OBmeOCi+mWouaVsFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFRvTGVnYWN5VHJhY2UodHJhY2U6IEJlZHJvY2tBZ2VudFRyYWNlKTogTGVnYWN5QWdlbnRUcmFjZSB7XG4gIHJldHVybiB7XG4gICAgdGltZXN0YW1wOiB0cmFjZS5zdGFydFRpbWUsXG4gICAgcXVlcnk6IHRyYWNlLnVzZXJRdWVyeSxcbiAgICB0cmFjZTogdHJhY2VcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g44Om44O844OG44Kj44Oq44OG44Kj5Z6LXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog44OI44Os44O844K544K544OG44OD44OX44Gu6YOo5YiG5pu05paw5Z6LXG4gKi9cbmV4cG9ydCB0eXBlIFBhcnRpYWxUcmFjZVN0ZXAgPSBQYXJ0aWFsPFRyYWNlU3RlcD4gJiB7XG4gIHN0ZXBJZDogc3RyaW5nO1xufTtcblxuLyoqXG4gKiDjg4jjg6zjg7zjgrnjga7pg6jliIbmm7TmlrDlnotcbiAqL1xuZXhwb3J0IHR5cGUgUGFydGlhbEJlZHJvY2tBZ2VudFRyYWNlID0gUGFydGlhbDxCZWRyb2NrQWdlbnRUcmFjZT4gJiB7XG4gIHRyYWNlSWQ6IHN0cmluZztcbn07XG5cbi8qKlxuICog44OI44Os44O844K544K544OG44OD44OX44K/44Kk44OX44Ks44O844OJXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc09yY2hlc3RyYXRpb25TdGVwKHN0ZXA6IFRyYWNlU3RlcCk6IHN0ZXAgaXMgVHJhY2VTdGVwICYge1xuICBkZXRhaWxzOiB7IG9yY2hlc3RyYXRpb25TdGVwczogT3JjaGVzdHJhdGlvblN0ZXBbXSB9O1xufSB7XG4gIHJldHVybiBzdGVwLnR5cGUgPT09ICdPUkNIRVNUUkFUSU9OJyAmJiBcbiAgICAgICAgIHN0ZXAuZGV0YWlscy5vcmNoZXN0cmF0aW9uU3RlcHMgIT09IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBBY3Rpb24gR3JvdXDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgqzjg7zjg4lcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQWN0aW9uR3JvdXBTdGVwKHN0ZXA6IFRyYWNlU3RlcCk6IHN0ZXAgaXMgVHJhY2VTdGVwICYge1xuICBkZXRhaWxzOiB7IGFjdGlvbkdyb3VwUmVzdWx0OiBBY3Rpb25Hcm91cFJlc3VsdCB9O1xufSB7XG4gIHJldHVybiBzdGVwLnR5cGUgPT09ICdBQ1RJT05fR1JPVVAnICYmIFxuICAgICAgICAgc3RlcC5kZXRhaWxzLmFjdGlvbkdyb3VwUmVzdWx0ICE9PSB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogS25vd2xlZGdlIEJhc2Xjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgqzjg7zjg4lcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzS25vd2xlZGdlQmFzZVN0ZXAoc3RlcDogVHJhY2VTdGVwKTogc3RlcCBpcyBUcmFjZVN0ZXAgJiB7XG4gIGRldGFpbHM6IHsga25vd2xlZGdlQmFzZVJlc3VsdDogS25vd2xlZGdlQmFzZVJlc3VsdCB9O1xufSB7XG4gIHJldHVybiBzdGVwLnR5cGUgPT09ICdLTk9XTEVER0VfQkFTRScgJiYgXG4gICAgICAgICBzdGVwLmRldGFpbHMua25vd2xlZGdlQmFzZVJlc3VsdCAhPT0gdW5kZWZpbmVkO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDjg4fjg5Xjgqnjg6vjg4jlgKTjg7vlrprmlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDjg4jjg6zjg7zjgrnjgrnjg4bjg4Pjg5fjgr/jgqTjg5flrprmlbDjgqrjg5bjgrjjgqfjgq/jg4hcbiAqIOWei+WuieWFqOaAp+OBqOOCs+ODvOODieijnOWujOOCkuWQkeS4iuOBleOBm+OCi+OBn+OCgeOBruWumuaVsOWumue+qVxuICovXG5leHBvcnQgY29uc3QgVFJBQ0VfU1RFUF9UWVBFUyA9IHtcbiAgLy8g5Z+65pys44K544OG44OD44OX44K/44Kk44OXXG4gIFBSRV9QUk9DRVNTSU5HOiAnUFJFX1BST0NFU1NJTkcnIGFzIGNvbnN0LFxuICBPUkNIRVNUUkFUSU9OOiAnT1JDSEVTVFJBVElPTicgYXMgY29uc3QsXG4gIFBPU1RfUFJPQ0VTU0lORzogJ1BPU1RfUFJPQ0VTU0lORycgYXMgY29uc3QsXG4gIEtOT1dMRURHRV9CQVNFOiAnS05PV0xFREdFX0JBU0UnIGFzIGNvbnN0LFxuICBBQ1RJT05fR1JPVVA6ICdBQ1RJT05fR1JPVVAnIGFzIGNvbnN0LFxuICBHVUFSRFJBSUxTOiAnR1VBUkRSQUlMUycgYXMgY29uc3QsXG4gIEZJTkFMX1JFU1BPTlNFOiAnRklOQUxfUkVTUE9OU0UnIGFzIGNvbnN0LFxuICAvLyAyMDI05bm0R0HmqZ/og71cbiAgTVVMVElfQUdFTlRfQ09MTEFCT1JBVElPTjogJ01VTFRJX0FHRU5UX0NPTExBQk9SQVRJT04nIGFzIGNvbnN0LFxuICBJTkxJTkVfQUdFTlRfSU5WT0NBVElPTjogJ0lOTElORV9BR0VOVF9JTlZPQ0FUSU9OJyBhcyBjb25zdCxcbiAgUEFZTE9BRF9SRUZFUkVOQ0lORzogJ1BBWUxPQURfUkVGRVJFTkNJTkcnIGFzIGNvbnN0LFxuICBTVVBFUlZJU09SX09SQ0hFU1RSQVRJT046ICdTVVBFUlZJU09SX09SQ0hFU1RSQVRJT04nIGFzIGNvbnN0LFxuICBDT0xMQUJPUkFUT1JfRVhFQ1VUSU9OOiAnQ09MTEFCT1JBVE9SX0VYRUNVVElPTicgYXMgY29uc3Rcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICog44OI44Os44O844K544K544OG44OD44OX44Kr44OG44K044Oq5a6a576pXG4gKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgpLmqZ/og73liKXjgavjgrDjg6vjg7zjg5fljJZcbiAqL1xuZXhwb3J0IGNvbnN0IFRSQUNFX1NURVBfQ0FURUdPUklFUyA9IHtcbiAgLyoqIOWfuuacrOWHpueQhuOCueODhuODg+ODlyAqL1xuICBCQVNJQzogW1xuICAgIFRSQUNFX1NURVBfVFlQRVMuUFJFX1BST0NFU1NJTkcsXG4gICAgVFJBQ0VfU1RFUF9UWVBFUy5PUkNIRVNUUkFUSU9OLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuUE9TVF9QUk9DRVNTSU5HLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuRklOQUxfUkVTUE9OU0VcbiAgXSBhcyBUcmFjZVN0ZXBUeXBlW10sXG4gIC8qKiDntbHlkIjmqZ/og73jgrnjg4bjg4Pjg5cgKi9cbiAgSU5URUdSQVRJT046IFtcbiAgICBUUkFDRV9TVEVQX1RZUEVTLktOT1dMRURHRV9CQVNFLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuQUNUSU9OX0dST1VQLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuR1VBUkRSQUlMU1xuICBdIGFzIFRyYWNlU3RlcFR5cGVbXSxcbiAgLyoqIE11bHRpLUFnZW505qmf6IO944K544OG44OD44OXICovXG4gIE1VTFRJX0FHRU5UOiBbXG4gICAgVFJBQ0VfU1RFUF9UWVBFUy5NVUxUSV9BR0VOVF9DT0xMQUJPUkFUSU9OLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuU1VQRVJWSVNPUl9PUkNIRVNUUkFUSU9OLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuQ09MTEFCT1JBVE9SX0VYRUNVVElPTlxuICBdIGFzIFRyYWNlU3RlcFR5cGVbXSxcbiAgLyoqIOmrmOW6puOBquapn+iDveOCueODhuODg+ODl++8iDIwMjTlubRHQe+8iSAqL1xuICBBRFZBTkNFRDogW1xuICAgIFRSQUNFX1NURVBfVFlQRVMuSU5MSU5FX0FHRU5UX0lOVk9DQVRJT04sXG4gICAgVFJBQ0VfU1RFUF9UWVBFUy5QQVlMT0FEX1JFRkVSRU5DSU5HXG4gIF0gYXMgVHJhY2VTdGVwVHlwZVtdXG59IGFzIGNvbnN0O1xuXG4vKipcbiAqIDIwMjTlubRHQeapn+iDveOCueODhuODg+ODl+OCv+OCpOODl+OCu+ODg+ODiFxuICovXG5leHBvcnQgY29uc3QgR0FfMjAyNF9TVEVQX1RZUEVTOiBTZXQ8VHJhY2VTdGVwVHlwZT4gPSBuZXcgU2V0PFRyYWNlU3RlcFR5cGU+KFtcbiAgVFJBQ0VfU1RFUF9UWVBFUy5NVUxUSV9BR0VOVF9DT0xMQUJPUkFUSU9OLFxuICBUUkFDRV9TVEVQX1RZUEVTLklOTElORV9BR0VOVF9JTlZPQ0FUSU9OLFxuICBUUkFDRV9TVEVQX1RZUEVTLlBBWUxPQURfUkVGRVJFTkNJTkcsXG4gIFRSQUNFX1NURVBfVFlQRVMuU1VQRVJWSVNPUl9PUkNIRVNUUkFUSU9OLFxuICBUUkFDRV9TVEVQX1RZUEVTLkNPTExBQk9SQVRPUl9FWEVDVVRJT05cbl0pO1xuXG4vKipcbiAqIOODh+ODleOCqeODq+ODiOODiOODrOODvOOCueihqOekuuioreWumu+8iDIwMjTlubRHQeapn+iDveWvvuW/nO+8iVxuICovXG5leHBvcnQgY29uc3QgREVGQVVMVF9UUkFDRV9ESVNQTEFZX0NPTkZJRzogVHJhY2VEaXNwbGF5Q29uZmlnID0ge1xuICBleHBhbmRlZFN0ZXBzOiBuZXcgU2V0KCksXG4gIHZpc2libGVTdGVwVHlwZXM6IG5ldyBTZXQoW1xuICAgIFRSQUNFX1NURVBfVFlQRVMuUFJFX1BST0NFU1NJTkcsXG4gICAgVFJBQ0VfU1RFUF9UWVBFUy5PUkNIRVNUUkFUSU9OLCBcbiAgICBUUkFDRV9TVEVQX1RZUEVTLlBPU1RfUFJPQ0VTU0lORyxcbiAgICBUUkFDRV9TVEVQX1RZUEVTLktOT1dMRURHRV9CQVNFLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuQUNUSU9OX0dST1VQLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuRklOQUxfUkVTUE9OU0UsXG4gICAgLy8gMjAyNOW5tEdB5qmf6IO944KC6KGo56S65a++6LGh44Gr5ZCr44KB44KLXG4gICAgVFJBQ0VfU1RFUF9UWVBFUy5NVUxUSV9BR0VOVF9DT0xMQUJPUkFUSU9OLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuSU5MSU5FX0FHRU5UX0lOVk9DQVRJT04sXG4gICAgVFJBQ0VfU1RFUF9UWVBFUy5QQVlMT0FEX1JFRkVSRU5DSU5HLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuU1VQRVJWSVNPUl9PUkNIRVNUUkFUSU9OLFxuICAgIFRSQUNFX1NURVBfVFlQRVMuQ09MTEFCT1JBVE9SX0VYRUNVVElPTlxuICBdKSxcbiAgZGV0YWlsTW9kZTogJ1NJTVBMRScsXG4gIHNob3dUaW1lbGluZTogdHJ1ZSxcbiAgc2hvd1BlcmZvcm1hbmNlOiBmYWxzZVxufTtcblxuLyoqXG4gKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fooajnpLrlkI3jg57jg4Pjg5Tjg7PjgrDvvIgyMDI05bm0R0HmqZ/og73lr77lv5zvvIlcbiAqL1xuZXhwb3J0IGNvbnN0IFNURVBfVFlQRV9ESVNQTEFZX05BTUVTOiBSZWNvcmQ8VHJhY2VTdGVwVHlwZSwgc3RyaW5nPiA9IHtcbiAgJ1BSRV9QUk9DRVNTSU5HJzogJ+WJjeWHpueQhicsXG4gICdPUkNIRVNUUkFUSU9OJzogJ+OCquODvOOCseOCueODiOODrOODvOOCt+ODp+ODsycsXG4gICdQT1NUX1BST0NFU1NJTkcnOiAn5b6M5Yem55CGJyxcbiAgJ0tOT1dMRURHRV9CQVNFJzogJ0tub3dsZWRnZSBCYXNl5qSc57SiJyxcbiAgJ0FDVElPTl9HUk9VUCc6ICdBY3Rpb24gR3JvdXDlrp/ooYwnLFxuICAnR1VBUkRSQUlMUyc6ICdHdWFyZHJhaWxz6KmV5L6hJyxcbiAgJ0ZJTkFMX1JFU1BPTlNFJzogJ+acgOe1guODrOOCueODneODs+OCuScsXG4gIC8vIDIwMjTlubRHQeapn+iDvei/veWKoFxuICAnTVVMVElfQUdFTlRfQ09MTEFCT1JBVElPTic6ICdNdWx0aS1BZ2VudOmAo+aQuicsXG4gICdJTkxJTkVfQUdFTlRfSU5WT0NBVElPTic6ICdJbmxpbmUgQWdlbnTlrp/ooYwnLFxuICAnUEFZTE9BRF9SRUZFUkVOQ0lORyc6ICdQYXlsb2FkIFJlZmVyZW5jaW5n5pyA6YGp5YyWJyxcbiAgJ1NVUEVSVklTT1JfT1JDSEVTVFJBVElPTic6ICdTdXBlcnZpc29yIEFnZW505Yi25b6hJyxcbiAgJ0NPTExBQk9SQVRPUl9FWEVDVVRJT04nOiAnQ29sbGFib3JhdG9yIEFnZW505a6f6KGMJ1xufTtcblxuLyoqXG4gKiDjgrnjg4bjg4Pjg5fnirbmhYvooajnpLrlkI3jg57jg4Pjg5Tjg7PjgrBcbiAqL1xuZXhwb3J0IGNvbnN0IFNURVBfU1RBVFVTX0RJU1BMQVlfTkFNRVM6IFJlY29yZDxUcmFjZVN0ZXBTdGF0dXMsIHN0cmluZz4gPSB7XG4gICdTVEFSVEVEJzogJ+mWi+WniycsXG4gICdJTl9QUk9HUkVTUyc6ICflrp/ooYzkuK0nLFxuICAnQ09NUExFVEVEJzogJ+WujOS6hicsXG4gICdGQUlMRUQnOiAn5aSx5pWXJyxcbiAgJ1NLSVBQRUQnOiAn44K544Kt44OD44OXJ1xufTtcblxuLyoqXG4gKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgqLjgqTjgrPjg7Pjg57jg4Pjg5Tjg7PjgrDvvIgyMDI05bm0R0HmqZ/og73lr77lv5zvvIlcbiAqL1xuZXhwb3J0IGNvbnN0IFNURVBfVFlQRV9JQ09OUzogUmVjb3JkPFRyYWNlU3RlcFR5cGUsIHN0cmluZz4gPSB7XG4gICdQUkVfUFJPQ0VTU0lORyc6ICfwn5SEJyxcbiAgJ09SQ0hFU1RSQVRJT04nOiAn8J+OrycsXG4gICdQT1NUX1BST0NFU1NJTkcnOiAn4pyFJyxcbiAgJ0tOT1dMRURHRV9CQVNFJzogJ/Cfk5onLFxuICAnQUNUSU9OX0dST1VQJzogJ+KaoScsXG4gICdHVUFSRFJBSUxTJzogJ/Cfm6HvuI8nLFxuICAnRklOQUxfUkVTUE9OU0UnOiAn8J+SrCcsXG4gIC8vIDIwMjTlubRHQeapn+iDvei/veWKoFxuICAnTVVMVElfQUdFTlRfQ09MTEFCT1JBVElPTic6ICfwn6SdJyxcbiAgJ0lOTElORV9BR0VOVF9JTlZPQ0FUSU9OJzogJ/CflJcnLFxuICAnUEFZTE9BRF9SRUZFUkVOQ0lORyc6ICfwn5OOJyxcbiAgJ1NVUEVSVklTT1JfT1JDSEVTVFJBVElPTic6ICfwn5GRJyxcbiAgJ0NPTExBQk9SQVRPUl9FWEVDVVRJT04nOiAn8J+Upydcbn07XG5cbi8qKlxuICog44K544OG44OD44OX54q25oWL44Kr44Op44O844Oe44OD44OU44Oz44KwXG4gKi9cbmV4cG9ydCBjb25zdCBTVEVQX1NUQVRVU19DT0xPUlM6IFJlY29yZDxUcmFjZVN0ZXBTdGF0dXMsIHN0cmluZz4gPSB7XG4gICdTVEFSVEVEJzogJ2JsdWUnLFxuICAnSU5fUFJPR1JFU1MnOiAneWVsbG93JyxcbiAgJ0NPTVBMRVRFRCc6ICdncmVlbicsXG4gICdGQUlMRUQnOiAncmVkJyxcbiAgJ1NLSVBQRUQnOiAnZ3JheSdcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDIwMjTlubRHQeapn+iDveODpuODvOODhuOCo+ODquODhuOCo+mWouaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIE11bHRpLUFnZW50IENvbGxhYm9yYXRpb27jgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgqzjg7zjg4lcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTXVsdGlBZ2VudFN0ZXAoc3RlcDogVHJhY2VTdGVwKTogc3RlcCBpcyBUcmFjZVN0ZXAgJiB7XG4gIGRldGFpbHM6IHsgbXVsdGlBZ2VudERldGFpbHM6IE5vbk51bGxhYmxlPFRyYWNlU3RlcFsnZGV0YWlscyddWydtdWx0aUFnZW50RGV0YWlscyddPiB9O1xufSB7XG4gIHJldHVybiAoc3RlcC50eXBlID09PSAnTVVMVElfQUdFTlRfQ09MTEFCT1JBVElPTicgfHwgXG4gICAgICAgICAgc3RlcC50eXBlID09PSAnU1VQRVJWSVNPUl9PUkNIRVNUUkFUSU9OJyB8fCBcbiAgICAgICAgICBzdGVwLnR5cGUgPT09ICdDT0xMQUJPUkFUT1JfRVhFQ1VUSU9OJykgJiYgXG4gICAgICAgICBzdGVwLmRldGFpbHMubXVsdGlBZ2VudERldGFpbHMgIT09IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBJbmxpbmUgQWdlbnTjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgqzjg7zjg4lcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSW5saW5lQWdlbnRTdGVwKHN0ZXA6IFRyYWNlU3RlcCk6IHN0ZXAgaXMgVHJhY2VTdGVwICYge1xuICBkZXRhaWxzOiB7IGlubGluZUFnZW50RGV0YWlsczogSW5saW5lQWdlbnRFeGVjdXRpb24gfTtcbn0ge1xuICByZXR1cm4gc3RlcC50eXBlID09PSAnSU5MSU5FX0FHRU5UX0lOVk9DQVRJT04nICYmIFxuICAgICAgICAgc3RlcC5kZXRhaWxzLmlubGluZUFnZW50RGV0YWlscyAhPT0gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIFBheWxvYWQgUmVmZXJlbmNpbmfjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgqzjg7zjg4lcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGF5bG9hZFJlZmVyZW5jaW5nU3RlcChzdGVwOiBUcmFjZVN0ZXApOiBzdGVwIGlzIFRyYWNlU3RlcCAmIHtcbiAgZGV0YWlsczogeyBwYXlsb2FkT3B0aW1pemF0aW9uRGV0YWlsczogUGF5bG9hZFJlZmVyZW5jaW5nT3B0aW1pemF0aW9uIH07XG59IHtcbiAgcmV0dXJuIHN0ZXAudHlwZSA9PT0gJ1BBWUxPQURfUkVGRVJFTkNJTkcnICYmIFxuICAgICAgICAgc3RlcC5kZXRhaWxzLnBheWxvYWRPcHRpbWl6YXRpb25EZXRhaWxzICE9PSB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICog44OI44Os44O844K544GMMjAyNOW5tEdB5qmf6IO944KS5L2/55So44GX44Gm44GE44KL44GL44OB44Kn44OD44KvXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNHQUZlYXR1cmVzMjAyNCh0cmFjZTogQmVkcm9ja0FnZW50VHJhY2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIHRyYWNlLm1ldGFkYXRhLmdhRmVhdHVyZXMyMDI0Lm11bHRpQWdlbnRFbmFibGVkIHx8XG4gICAgICAgICB0cmFjZS5tZXRhZGF0YS5nYUZlYXR1cmVzMjAyNC5pbmxpbmVBZ2VudEVuYWJsZWQgfHxcbiAgICAgICAgIHRyYWNlLm1ldGFkYXRhLmdhRmVhdHVyZXMyMDI0LnBheWxvYWRSZWZlcmVuY2luZ0VuYWJsZWQ7XG59XG5cbi8qKlxuICogTXVsdGktQWdlbnQgQ29sbGFib3JhdGlvbuOBrue1seioiOaDheWgseOCkuWPluW+l1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TXVsdGlBZ2VudFN0YXRpc3RpY3ModHJhY2U6IEJlZHJvY2tBZ2VudFRyYWNlKToge1xuICB0b3RhbEFnZW50czogbnVtYmVyO1xuICBzdXBlcnZpc29yQ291bnQ6IG51bWJlcjtcbiAgY29sbGFib3JhdG9yQ291bnQ6IG51bWJlcjtcbiAgdGFza0NvbXBsZXRpb25SYXRlOiBudW1iZXI7XG4gIGF2ZXJhZ2VUYXNrRXhlY3V0aW9uVGltZTogbnVtYmVyO1xufSB8IG51bGwge1xuICBjb25zdCBtdWx0aUFnZW50SW5mbyA9IHRyYWNlLm1ldGFkYXRhLm11bHRpQWdlbnRDb2xsYWJvcmF0aW9uO1xuICBpZiAoIW11bHRpQWdlbnRJbmZvKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCB0b3RhbEFnZW50cyA9IDEgKyAobXVsdGlBZ2VudEluZm8uY29sbGFib3JhdG9yQWdlbnRJZHM/Lmxlbmd0aCB8fCAwKTtcbiAgY29uc3Qgc3VwZXJ2aXNvckNvdW50ID0gbXVsdGlBZ2VudEluZm8uY3VycmVudEFnZW50Um9sZSA9PT0gJ1NVUEVSVklTT1InID8gMSA6IDA7XG4gIGNvbnN0IGNvbGxhYm9yYXRvckNvdW50ID0gbXVsdGlBZ2VudEluZm8uY29sbGFib3JhdG9yQWdlbnRJZHM/Lmxlbmd0aCB8fCAwO1xuICBcbiAgY29uc3QgdGFza3MgPSBtdWx0aUFnZW50SW5mby50YXNrRGVjb21wb3NpdGlvbj8uc3ViVGFza3MgfHwgW107XG4gIGNvbnN0IGNvbXBsZXRlZFRhc2tzID0gdGFza3MuZmlsdGVyKHRhc2sgPT4gdGFzay5zdGF0dXMgPT09ICdDT01QTEVURUQnKS5sZW5ndGg7XG4gIGNvbnN0IHRhc2tDb21wbGV0aW9uUmF0ZSA9IHRhc2tzLmxlbmd0aCA+IDAgPyAoY29tcGxldGVkVGFza3MgLyB0YXNrcy5sZW5ndGgpICogMTAwIDogMDtcbiAgXG4gIGNvbnN0IG11bHRpQWdlbnRTdGVwcyA9IHRyYWNlLnN0ZXBzLmZpbHRlcihpc011bHRpQWdlbnRTdGVwKTtcbiAgY29uc3QgdG90YWxFeGVjdXRpb25UaW1lID0gbXVsdGlBZ2VudFN0ZXBzLnJlZHVjZSgoc3VtLCBzdGVwKSA9PiBzdW0gKyAoc3RlcC5leGVjdXRpb25UaW1lTXMgfHwgMCksIDApO1xuICBjb25zdCBhdmVyYWdlVGFza0V4ZWN1dGlvblRpbWUgPSBtdWx0aUFnZW50U3RlcHMubGVuZ3RoID4gMCA/IHRvdGFsRXhlY3V0aW9uVGltZSAvIG11bHRpQWdlbnRTdGVwcy5sZW5ndGggOiAwO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxBZ2VudHMsXG4gICAgc3VwZXJ2aXNvckNvdW50LFxuICAgIGNvbGxhYm9yYXRvckNvdW50LFxuICAgIHRhc2tDb21wbGV0aW9uUmF0ZSxcbiAgICBhdmVyYWdlVGFza0V4ZWN1dGlvblRpbWVcbiAgfTtcbn1cblxuLyoqXG4gKiBQYXlsb2FkIFJlZmVyZW5jaW5n5pyA6YGp5YyW44Gu5Yq55p6c44KS6KiI566XXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVQYXlsb2FkT3B0aW1pemF0aW9uRWZmZWN0aXZlbmVzcyh0cmFjZTogQmVkcm9ja0FnZW50VHJhY2UpOiB7XG4gIHRvdGFsT3JpZ2luYWxTaXplOiBudW1iZXI7XG4gIHRvdGFsT3B0aW1pemVkU2l6ZTogbnVtYmVyO1xuICB0b3RhbFJlZHVjdGlvblBlcmNlbnRhZ2U6IG51bWJlcjtcbiAgdG90YWxSZXNwb25zZVRpbWVSZWR1Y3Rpb246IG51bWJlcjtcbiAgdG90YWxCYW5kd2lkdGhTYXZpbmc6IG51bWJlcjtcbiAgZXN0aW1hdGVkQ29zdFNhdmluZzogbnVtYmVyO1xufSB8IG51bGwge1xuICBjb25zdCBwYXlsb2FkU3RlcHMgPSB0cmFjZS5zdGVwcy5maWx0ZXIoaXNQYXlsb2FkUmVmZXJlbmNpbmdTdGVwKTtcbiAgaWYgKHBheWxvYWRTdGVwcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGxldCB0b3RhbE9yaWdpbmFsU2l6ZSA9IDA7XG4gIGxldCB0b3RhbE9wdGltaXplZFNpemUgPSAwO1xuICBsZXQgdG90YWxSZXNwb25zZVRpbWVSZWR1Y3Rpb24gPSAwO1xuICBsZXQgdG90YWxCYW5kd2lkdGhTYXZpbmcgPSAwO1xuICBsZXQgZXN0aW1hdGVkQ29zdFNhdmluZyA9IDA7XG5cbiAgcGF5bG9hZFN0ZXBzLmZvckVhY2goc3RlcCA9PiB7XG4gICAgY29uc3QgZGV0YWlscyA9IHN0ZXAuZGV0YWlscy5wYXlsb2FkT3B0aW1pemF0aW9uRGV0YWlscyE7XG4gICAgdG90YWxPcmlnaW5hbFNpemUgKz0gZGV0YWlscy5vcmlnaW5hbFBheWxvYWRTaXplO1xuICAgIHRvdGFsT3B0aW1pemVkU2l6ZSArPSBkZXRhaWxzLm9wdGltaXplZFBheWxvYWRTaXplO1xuICAgIHRvdGFsUmVzcG9uc2VUaW1lUmVkdWN0aW9uICs9IGRldGFpbHMucGVyZm9ybWFuY2VJbXByb3ZlbWVudC5yZXNwb25zZVRpbWVSZWR1Y3Rpb25NcztcbiAgICB0b3RhbEJhbmR3aWR0aFNhdmluZyArPSBkZXRhaWxzLnBlcmZvcm1hbmNlSW1wcm92ZW1lbnQuYmFuZHdpZHRoU2F2aW5nQnl0ZXM7XG4gICAgZXN0aW1hdGVkQ29zdFNhdmluZyArPSBkZXRhaWxzLnBlcmZvcm1hbmNlSW1wcm92ZW1lbnQuZXN0aW1hdGVkQ29zdFNhdmluZ1VzZCB8fCAwO1xuICB9KTtcblxuICBjb25zdCB0b3RhbFJlZHVjdGlvblBlcmNlbnRhZ2UgPSB0b3RhbE9yaWdpbmFsU2l6ZSA+IDAgXG4gICAgPyAoKHRvdGFsT3JpZ2luYWxTaXplIC0gdG90YWxPcHRpbWl6ZWRTaXplKSAvIHRvdGFsT3JpZ2luYWxTaXplKSAqIDEwMCBcbiAgICA6IDA7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbE9yaWdpbmFsU2l6ZSxcbiAgICB0b3RhbE9wdGltaXplZFNpemUsXG4gICAgdG90YWxSZWR1Y3Rpb25QZXJjZW50YWdlLFxuICAgIHRvdGFsUmVzcG9uc2VUaW1lUmVkdWN0aW9uLFxuICAgIHRvdGFsQmFuZHdpZHRoU2F2aW5nLFxuICAgIGVzdGltYXRlZENvc3RTYXZpbmdcbiAgfTtcbn1cblxuLyoqXG4gKiAyMDI05bm0R0HmqZ/og73jga7jg5Hjg5Xjgqnjg7zjg57jg7PjgrnmjIfmqJnjgpLlj5blvpdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEdBRmVhdHVyZXMyMDI0UGVyZm9ybWFuY2UodHJhY2U6IEJlZHJvY2tBZ2VudFRyYWNlKToge1xuICBtdWx0aUFnZW50UGVyZm9ybWFuY2U/OiBSZXR1cm5UeXBlPHR5cGVvZiBnZXRNdWx0aUFnZW50U3RhdGlzdGljcz47XG4gIHBheWxvYWRPcHRpbWl6YXRpb25QZXJmb3JtYW5jZT86IFJldHVyblR5cGU8dHlwZW9mIGNhbGN1bGF0ZVBheWxvYWRPcHRpbWl6YXRpb25FZmZlY3RpdmVuZXNzPjtcbiAgaW5saW5lQWdlbnRFeGVjdXRpb25zOiBudW1iZXI7XG4gIHRvdGFsR0FGZWF0dXJlRXhlY3V0aW9uVGltZTogbnVtYmVyO1xufSB7XG4gIGNvbnN0IG11bHRpQWdlbnRQZXJmb3JtYW5jZSA9IGdldE11bHRpQWdlbnRTdGF0aXN0aWNzKHRyYWNlKTtcbiAgY29uc3QgcGF5bG9hZE9wdGltaXphdGlvblBlcmZvcm1hbmNlID0gY2FsY3VsYXRlUGF5bG9hZE9wdGltaXphdGlvbkVmZmVjdGl2ZW5lc3ModHJhY2UpO1xuICBcbiAgY29uc3QgaW5saW5lQWdlbnRTdGVwcyA9IHRyYWNlLnN0ZXBzLmZpbHRlcihpc0lubGluZUFnZW50U3RlcCk7XG4gIGNvbnN0IGlubGluZUFnZW50RXhlY3V0aW9ucyA9IGlubGluZUFnZW50U3RlcHMubGVuZ3RoO1xuICBcbiAgY29uc3QgZ2FGZWF0dXJlU3RlcHMgPSB0cmFjZS5zdGVwcy5maWx0ZXIoc3RlcCA9PiBcbiAgICBpc011bHRpQWdlbnRTdGVwKHN0ZXApIHx8IGlzSW5saW5lQWdlbnRTdGVwKHN0ZXApIHx8IGlzUGF5bG9hZFJlZmVyZW5jaW5nU3RlcChzdGVwKVxuICApO1xuICBjb25zdCB0b3RhbEdBRmVhdHVyZUV4ZWN1dGlvblRpbWUgPSBnYUZlYXR1cmVTdGVwcy5yZWR1Y2UoKHN1bSwgc3RlcCkgPT4gc3VtICsgKHN0ZXAuZXhlY3V0aW9uVGltZU1zIHx8IDApLCAwKTtcblxuICByZXR1cm4ge1xuICAgIG11bHRpQWdlbnRQZXJmb3JtYW5jZSxcbiAgICBwYXlsb2FkT3B0aW1pemF0aW9uUGVyZm9ybWFuY2UsXG4gICAgaW5saW5lQWdlbnRFeGVjdXRpb25zLFxuICAgIHRvdGFsR0FGZWF0dXJlRXhlY3V0aW9uVGltZVxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDjg6bjg7zjg4bjgqPjg6rjg4bjgqPjgq/jg6njgrlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDjg4jjg6zjg7zjgrnjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjg6bjg7zjg4bjgqPjg6rjg4bjgqPjgq/jg6njgrlcbiAqIOOCueODhuODg+ODl+OCv+OCpOODl+OBruWIhumhnuOAgeWIpOWumuOAgeihqOekuuWQjeWPluW+l+OBquOBqeOBruapn+iDveOCkuaPkOS+m1xuICovXG5leHBvcnQgY2xhc3MgVHJhY2VTdGVwVHlwZVV0aWxzIHtcbiAgLyoqXG4gICAqIE11bHRpLUFnZW5044K544OG44OD44OX44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBzdGF0aWMgaXNNdWx0aUFnZW50U3RlcChzdGVwVHlwZTogVHJhY2VTdGVwVHlwZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBUUkFDRV9TVEVQX0NBVEVHT1JJRVMuTVVMVElfQUdFTlQuaW5jbHVkZXMoc3RlcFR5cGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIDIwMjTlubRHQeapn+iDveOCueODhuODg+ODl+OBi+OBqeOBhuOBi+OCkuWIpOWumlxuICAgKi9cbiAgc3RhdGljIGlzR0EyMDI0RmVhdHVyZShzdGVwVHlwZTogVHJhY2VTdGVwVHlwZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBHQV8yMDI0X1NURVBfVFlQRVMuaGFzKHN0ZXBUeXBlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDln7rmnKzlh6bnkIbjgrnjg4bjg4Pjg5fjgYvjganjgYbjgYvjgpLliKTlrppcbiAgICovXG4gIHN0YXRpYyBpc0Jhc2ljU3RlcChzdGVwVHlwZTogVHJhY2VTdGVwVHlwZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBUUkFDRV9TVEVQX0NBVEVHT1JJRVMuQkFTSUMuaW5jbHVkZXMoc3RlcFR5cGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIOe1seWQiOapn+iDveOCueODhuODg+ODl+OBi+OBqeOBhuOBi+OCkuWIpOWumlxuICAgKi9cbiAgc3RhdGljIGlzSW50ZWdyYXRpb25TdGVwKHN0ZXBUeXBlOiBUcmFjZVN0ZXBUeXBlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIFRSQUNFX1NURVBfQ0FURUdPUklFUy5JTlRFR1JBVElPTi5pbmNsdWRlcyhzdGVwVHlwZSk7XG4gIH1cblxuICAvKipcbiAgICog6auY5bqm44Gq5qmf6IO944K544OG44OD44OX44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBzdGF0aWMgaXNBZHZhbmNlZFN0ZXAoc3RlcFR5cGU6IFRyYWNlU3RlcFR5cGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gVFJBQ0VfU1RFUF9DQVRFR09SSUVTLkFEVkFOQ0VELmluY2x1ZGVzKHN0ZXBUeXBlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjga7ooajnpLrlkI3jgpLlj5blvpdcbiAgICovXG4gIHN0YXRpYyBnZXREaXNwbGF5TmFtZShzdGVwVHlwZTogVHJhY2VTdGVwVHlwZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFNURVBfVFlQRV9ESVNQTEFZX05BTUVTW3N0ZXBUeXBlXSB8fCBzdGVwVHlwZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjga7jgqLjgqTjgrPjg7PjgpLlj5blvpdcbiAgICovXG4gIHN0YXRpYyBnZXRJY29uKHN0ZXBUeXBlOiBUcmFjZVN0ZXBUeXBlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gU1RFUF9UWVBFX0lDT05TW3N0ZXBUeXBlXSB8fCAn4p2TJztcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjga7jgqvjg4bjgrTjg6rjgpLlj5blvpdcbiAgICovXG4gIHN0YXRpYyBnZXRDYXRlZ29yeShzdGVwVHlwZTogVHJhY2VTdGVwVHlwZSk6IGtleW9mIHR5cGVvZiBUUkFDRV9TVEVQX0NBVEVHT1JJRVMgfCAnVU5LTk9XTicge1xuICAgIGZvciAoY29uc3QgW2NhdGVnb3J5LCB0eXBlc10gb2YgT2JqZWN0LmVudHJpZXMoVFJBQ0VfU1RFUF9DQVRFR09SSUVTKSkge1xuICAgICAgaWYgKCh0eXBlcyBhcyBUcmFjZVN0ZXBUeXBlW10pLmluY2x1ZGVzKHN0ZXBUeXBlKSkge1xuICAgICAgICByZXR1cm4gY2F0ZWdvcnkgYXMga2V5b2YgdHlwZW9mIFRSQUNFX1NURVBfQ0FURUdPUklFUztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICdVTktOT1dOJztcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqvjg4bjgrTjg6rliKXjgavjgrnjg4bjg4Pjg5fjgr/jgqTjg5fjgpLjgrDjg6vjg7zjg5fljJZcbiAgICovXG4gIHN0YXRpYyBncm91cEJ5Q2F0ZWdvcnkoc3RlcFR5cGVzOiBUcmFjZVN0ZXBUeXBlW10pOiBSZWNvcmQ8c3RyaW5nLCBUcmFjZVN0ZXBUeXBlW10+IHtcbiAgICBjb25zdCBncm91cGVkOiBSZWNvcmQ8c3RyaW5nLCBUcmFjZVN0ZXBUeXBlW10+ID0ge1xuICAgICAgQkFTSUM6IFtdLFxuICAgICAgSU5URUdSQVRJT046IFtdLFxuICAgICAgTVVMVElfQUdFTlQ6IFtdLFxuICAgICAgQURWQU5DRUQ6IFtdLFxuICAgICAgVU5LTk9XTjogW11cbiAgICB9O1xuXG4gICAgc3RlcFR5cGVzLmZvckVhY2goc3RlcFR5cGUgPT4ge1xuICAgICAgY29uc3QgY2F0ZWdvcnkgPSB0aGlzLmdldENhdGVnb3J5KHN0ZXBUeXBlKTtcbiAgICAgIGdyb3VwZWRbY2F0ZWdvcnldLnB1c2goc3RlcFR5cGUpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGdyb3VwZWQ7XG4gIH1cblxuICAvKipcbiAgICog44K544OG44OD44OX44K/44Kk44OX44Gu5YSq5YWI5bqm44KS5Y+W5b6X77yI6KGo56S66aCG5bqP55So77yJXG4gICAqL1xuICBzdGF0aWMgZ2V0UHJpb3JpdHkoc3RlcFR5cGU6IFRyYWNlU3RlcFR5cGUpOiBudW1iZXIge1xuICAgIGNvbnN0IHByaW9yaXR5TWFwOiBSZWNvcmQ8VHJhY2VTdGVwVHlwZSwgbnVtYmVyPiA9IHtcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLlBSRV9QUk9DRVNTSU5HXTogMSxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLk9SQ0hFU1RSQVRJT05dOiAyLFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuS05PV0xFREdFX0JBU0VdOiAzLFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuQUNUSU9OX0dST1VQXTogNCxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLkdVQVJEUkFJTFNdOiA1LFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuTVVMVElfQUdFTlRfQ09MTEFCT1JBVElPTl06IDYsXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5TVVBFUlZJU09SX09SQ0hFU1RSQVRJT05dOiA3LFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuQ09MTEFCT1JBVE9SX0VYRUNVVElPTl06IDgsXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5JTkxJTkVfQUdFTlRfSU5WT0NBVElPTl06IDksXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5QQVlMT0FEX1JFRkVSRU5DSU5HXTogMTAsXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5QT1NUX1BST0NFU1NJTkddOiAxMSxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLkZJTkFMX1JFU1BPTlNFXTogMTJcbiAgICB9O1xuICAgIHJldHVybiBwcmlvcml0eU1hcFtzdGVwVHlwZV0gfHwgOTk5O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueODhuODg+ODl+OCv+OCpOODl+OCkuWEquWFiOW6pumghuOBq+OCveODvOODiFxuICAgKi9cbiAgc3RhdGljIHNvcnRCeVByaW9yaXR5KHN0ZXBUeXBlczogVHJhY2VTdGVwVHlwZVtdKTogVHJhY2VTdGVwVHlwZVtdIHtcbiAgICByZXR1cm4gWy4uLnN0ZXBUeXBlc10uc29ydCgoYSwgYikgPT4gdGhpcy5nZXRQcmlvcml0eShhKSAtIHRoaXMuZ2V0UHJpb3JpdHkoYikpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueODhuODg+ODl+OCv+OCpOODl+OBruiqrOaYjuOCkuWPluW+l1xuICAgKi9cbiAgc3RhdGljIGdldERlc2NyaXB0aW9uKHN0ZXBUeXBlOiBUcmFjZVN0ZXBUeXBlKTogc3RyaW5nIHtcbiAgICBjb25zdCBkZXNjcmlwdGlvbnM6IFJlY29yZDxUcmFjZVN0ZXBUeXBlLCBzdHJpbmc+ID0ge1xuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuUFJFX1BST0NFU1NJTkddOiAn44Om44O844K244O85YWl5Yqb44Gu5YmN5Yem55CG44Go5qSc6Ki844KS6KGM44GE44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLk9SQ0hFU1RSQVRJT05dOiAnQWdlbnTlrp/ooYzjga7lhajkvZPnmoTjgarliLblvqHjgajoqr/mlbTjgpLooYzjgYTjgb7jgZknLFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuUE9TVF9QUk9DRVNTSU5HXTogJ+Wun+ihjOe1kOaenOOBruW+jOWHpueQhuOBqOaVtOW9ouOCkuihjOOBhOOBvuOBmScsXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5LTk9XTEVER0VfQkFTRV06ICdLbm93bGVkZ2UgQmFzZeOBi+OCieOBruaDheWgseaknOe0ouOCkuWun+ihjOOBl+OBvuOBmScsXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5BQ1RJT05fR1JPVVBdOiAnQWN0aW9uIEdyb3Vw44Gu5qmf6IO944KS5a6f6KGM44GX44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLkdVQVJEUkFJTFNdOiAn44K744Kt44Ol44Oq44OG44Kj44Go44Kz44Oz44OX44Op44Kk44Ki44Oz44K544Gu6KmV5L6h44KS6KGM44GE44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLkZJTkFMX1JFU1BPTlNFXTogJ+acgOe1gueahOOBquODrOOCueODneODs+OCueOCkueUn+aIkOOBl+OBvuOBmScsXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5NVUxUSV9BR0VOVF9DT0xMQUJPUkFUSU9OXTogJ+ikh+aVsOOBrkFnZW506ZaT44Gn44Gu5Y2U6Kq/5Yem55CG44KS5a6f6KGM44GX44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLklOTElORV9BR0VOVF9JTlZPQ0FUSU9OXTogJ+OCpOODs+ODqeOCpOODs+OBp+OBrkFnZW505a6f6KGM44KS6KGM44GE44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLlBBWUxPQURfUkVGRVJFTkNJTkddOiAn44Oa44Kk44Ot44O844OJ5Y+C54Wn44Gr44KI44KL5pyA6YGp5YyW44KS5a6f6KGM44GX44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLlNVUEVSVklTT1JfT1JDSEVTVFJBVElPTl06ICdTdXBlcnZpc29yIEFnZW5044Gr44KI44KL57Wx5ous5Yi25b6h44KS6KGM44GE44G+44GZJyxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLkNPTExBQk9SQVRPUl9FWEVDVVRJT05dOiAnQ29sbGFib3JhdG9yIEFnZW5044Gr44KI44KL5Y2U5Yqb5a6f6KGM44KS6KGM44GE44G+44GZJ1xuICAgIH07XG4gICAgcmV0dXJuIGRlc2NyaXB0aW9uc1tzdGVwVHlwZV0gfHwgJ+OCueODhuODg+ODl+OBruiqrOaYjuOBjOWIqeeUqOOBp+OBjeOBvuOBm+OCkyc7XG4gIH1cblxuICAvKipcbiAgICog44K544OG44OD44OX44K/44Kk44OX44Gu5a6f6KGM5pmC6ZaT44Gu55uu5a6J44KS5Y+W5b6X77yI44Of44Oq56eS77yJXG4gICAqL1xuICBzdGF0aWMgZ2V0RXN0aW1hdGVkRXhlY3V0aW9uVGltZShzdGVwVHlwZTogVHJhY2VTdGVwVHlwZSk6IHsgbWluOiBudW1iZXI7IG1heDogbnVtYmVyOyBhdmVyYWdlOiBudW1iZXIgfSB7XG4gICAgY29uc3QgdGltZUVzdGltYXRlczogUmVjb3JkPFRyYWNlU3RlcFR5cGUsIHsgbWluOiBudW1iZXI7IG1heDogbnVtYmVyOyBhdmVyYWdlOiBudW1iZXIgfT4gPSB7XG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5QUkVfUFJPQ0VTU0lOR106IHsgbWluOiAxMCwgbWF4OiAxMDAsIGF2ZXJhZ2U6IDUwIH0sXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5PUkNIRVNUUkFUSU9OXTogeyBtaW46IDUwLCBtYXg6IDUwMCwgYXZlcmFnZTogMjAwIH0sXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5QT1NUX1BST0NFU1NJTkddOiB7IG1pbjogMTAsIG1heDogMTAwLCBhdmVyYWdlOiA1MCB9LFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuS05PV0xFREdFX0JBU0VdOiB7IG1pbjogMTAwLCBtYXg6IDIwMDAsIGF2ZXJhZ2U6IDUwMCB9LFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuQUNUSU9OX0dST1VQXTogeyBtaW46IDIwMCwgbWF4OiA1MDAwLCBhdmVyYWdlOiAxMDAwIH0sXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5HVUFSRFJBSUxTXTogeyBtaW46IDUwLCBtYXg6IDMwMCwgYXZlcmFnZTogMTUwIH0sXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5GSU5BTF9SRVNQT05TRV06IHsgbWluOiAxMDAsIG1heDogMTAwMCwgYXZlcmFnZTogMzAwIH0sXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5NVUxUSV9BR0VOVF9DT0xMQUJPUkFUSU9OXTogeyBtaW46IDUwMCwgbWF4OiAxMDAwMCwgYXZlcmFnZTogMjAwMCB9LFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuSU5MSU5FX0FHRU5UX0lOVk9DQVRJT05dOiB7IG1pbjogMjAwLCBtYXg6IDMwMDAsIGF2ZXJhZ2U6IDgwMCB9LFxuICAgICAgW1RSQUNFX1NURVBfVFlQRVMuUEFZTE9BRF9SRUZFUkVOQ0lOR106IHsgbWluOiAyMCwgbWF4OiAyMDAsIGF2ZXJhZ2U6IDgwIH0sXG4gICAgICBbVFJBQ0VfU1RFUF9UWVBFUy5TVVBFUlZJU09SX09SQ0hFU1RSQVRJT05dOiB7IG1pbjogMzAwLCBtYXg6IDUwMDAsIGF2ZXJhZ2U6IDE1MDAgfSxcbiAgICAgIFtUUkFDRV9TVEVQX1RZUEVTLkNPTExBQk9SQVRPUl9FWEVDVVRJT05dOiB7IG1pbjogMjAwLCBtYXg6IDgwMDAsIGF2ZXJhZ2U6IDEyMDAgfVxuICAgIH07XG4gICAgcmV0dXJuIHRpbWVFc3RpbWF0ZXNbc3RlcFR5cGVdIHx8IHsgbWluOiAwLCBtYXg6IDEwMDAsIGF2ZXJhZ2U6IDUwMCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOWFqOOCueODhuODg+ODl+OCv+OCpOODl+OBruS4gOimp+OCkuWPluW+l1xuICAgKi9cbiAgc3RhdGljIGdldEFsbFN0ZXBUeXBlcygpOiBUcmFjZVN0ZXBUeXBlW10ge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKFRSQUNFX1NURVBfVFlQRVMpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCq+ODhuOCtOODquWIpeOCueODhuODg+ODl+OCv+OCpOODl+OBruS4gOimp+OCkuWPluW+l1xuICAgKi9cbiAgc3RhdGljIGdldFN0ZXBUeXBlc0J5Q2F0ZWdvcnkoY2F0ZWdvcnk6IGtleW9mIHR5cGVvZiBUUkFDRV9TVEVQX0NBVEVHT1JJRVMpOiBUcmFjZVN0ZXBUeXBlW10ge1xuICAgIHJldHVybiBbLi4uVFJBQ0VfU1RFUF9DQVRFR09SSUVTW2NhdGVnb3J5XV07XG4gIH1cblxuICAvKipcbiAgICogMjAyNOW5tEdB5qmf6IO944K544OG44OD44OX44K/44Kk44OX44Gu5LiA6Kan44KS5Y+W5b6XXG4gICAqL1xuICBzdGF0aWMgZ2V0R0EyMDI0U3RlcFR5cGVzKCk6IFRyYWNlU3RlcFR5cGVbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oR0FfMjAyNF9TVEVQX1RZUEVTKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDjgrvjgq3jg6Xjg6rjg4bjgqPjg6bjg7zjg4bjgqPjg6rjg4bjgqPplqLmlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPjg6zjg5njg6vjga7mlbDlgKTlpInmj5vvvIjmr5TovIPnlKjvvIlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFNlY3VyaXR5TGV2ZWxWYWx1ZShsZXZlbDogU2VjdXJpdHlMZXZlbCk6IG51bWJlciB7XG4gIGNvbnN0IGxldmVsVmFsdWVzOiBSZWNvcmQ8U2VjdXJpdHlMZXZlbCwgbnVtYmVyPiA9IHtcbiAgICAnUFVCTElDJzogMSxcbiAgICAnSU5URVJOQUwnOiAyLFxuICAgICdDT05GSURFTlRJQUwnOiAzLFxuICAgICdSRVNUUklDVEVEJzogNFxuICB9O1xuICByZXR1cm4gbGV2ZWxWYWx1ZXNbbGV2ZWxdO1xufVxuXG4vKipcbiAqIOOCu+OCreODpeODquODhuOCo+ODrOODmeODq+OBruavlOi8g1xuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGFyZVNlY3VyaXR5TGV2ZWxzKGxldmVsMTogU2VjdXJpdHlMZXZlbCwgbGV2ZWwyOiBTZWN1cml0eUxldmVsKTogbnVtYmVyIHtcbiAgcmV0dXJuIGdldFNlY3VyaXR5TGV2ZWxWYWx1ZShsZXZlbDEpIC0gZ2V0U2VjdXJpdHlMZXZlbFZhbHVlKGxldmVsMik7XG59XG5cbi8qKlxuICog44KI44KK6auY44GE44K744Kt44Ol44Oq44OG44Kj44Os44OZ44Or44KS5Y+W5b6XXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRIaWdoZXJTZWN1cml0eUxldmVsKGxldmVsMTogU2VjdXJpdHlMZXZlbCwgbGV2ZWwyOiBTZWN1cml0eUxldmVsKTogU2VjdXJpdHlMZXZlbCB7XG4gIHJldHVybiBjb21wYXJlU2VjdXJpdHlMZXZlbHMobGV2ZWwxLCBsZXZlbDIpID49IDAgPyBsZXZlbDEgOiBsZXZlbDI7XG59XG5cbi8qKlxuICog44OI44Os44O844K544K544OG44OD44OX44Gr44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44OG44Kt44K544OI44KS6YGp55SoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVNlY3VyaXR5Q29udGV4dChcbiAgc3RlcDogVHJhY2VTdGVwLCBcbiAgc2VjdXJpdHlDb250ZXh0OiBUcmFjZVNlY3VyaXR5Q29udGV4dFxuKTogU2VjdXJlVHJhY2VTdGVwIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zdGVwLFxuICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICBtYXNrZWREZXRhaWxzOiBzZWN1cml0eUNvbnRleHQuZGF0YUNsYXNzaWZpY2F0aW9uLmNvbnRhaW5zUElJID8ge1xuICAgICAgbWFza2VkSW5wdXQ6IG1hc2tTZW5zaXRpdmVEYXRhKHN0ZXAuZGV0YWlscy5pbnB1dCksXG4gICAgICBtYXNrZWRPdXRwdXQ6IG1hc2tTZW5zaXRpdmVEYXRhKHN0ZXAuZGV0YWlscy5vdXRwdXQpLFxuICAgICAgbWFza2luZ1BhdHRlcm5zOiBbJ1BJSV9NQVNLJywgJ0NPTkZJREVOVElBTF9NQVNLJ11cbiAgICB9IDogdW5kZWZpbmVkXG4gIH07XG59XG5cbi8qKlxuICog5qmf5a+G44OH44O844K/44Gu44Oe44K544Kt44Oz44KwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXNrU2Vuc2l0aXZlRGF0YShkYXRhOiBhbnkpOiBhbnkge1xuICBpZiAoIWRhdGEpIHJldHVybiBkYXRhO1xuICBcbiAgY29uc3QgZGF0YVN0ciA9IEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICBsZXQgbWFza2VkU3RyID0gZGF0YVN0cjtcbiAgXG4gIC8vIOS4gOiIrOeahOOBqlBJSeODkeOCv+ODvOODs+OBruODnuOCueOCreODs+OCsFxuICBjb25zdCBtYXNraW5nUGF0dGVybnMgPSBbXG4gICAgeyBwYXR0ZXJuOiAvXFxiXFxkezR9Wy1cXHNdP1xcZHs0fVstXFxzXT9cXGR7NH1bLVxcc10/XFxkezR9XFxiL2csIHJlcGxhY2VtZW50OiAnKioqKi0qKioqLSoqKiotKioqKicgfSwgLy8g44Kv44Os44K444OD44OI44Kr44O844OJXG4gICAgeyBwYXR0ZXJuOiAvXFxiW0EtWmEtejAtOS5fJSstXStAW0EtWmEtejAtOS4tXStcXC5bQS1afGEtel17Mix9XFxiL2csIHJlcGxhY2VtZW50OiAnKioqQCoqKi4qKionIH0sIC8vIOODoeODvOODq+OCouODieODrOOCuVxuICAgIHsgcGF0dGVybjogL1xcYlxcZHszfVstLl0/XFxkezN9Wy0uXT9cXGR7NH1cXGIvZywgcmVwbGFjZW1lbnQ6ICcqKiotKioqLSoqKionIH0sIC8vIOmbu+ipseeVquWPt1xuICAgIHsgcGF0dGVybjogL1xcYlxcZHszfVstXFxzXT9cXGR7Mn1bLVxcc10/XFxkezR9XFxiL2csIHJlcGxhY2VtZW50OiAnKioqLSoqLSoqKionIH0sIC8vIFNTTlxuICBdO1xuICBcbiAgbWFza2luZ1BhdHRlcm5zLmZvckVhY2goKHsgcGF0dGVybiwgcmVwbGFjZW1lbnQgfSkgPT4ge1xuICAgIG1hc2tlZFN0ciA9IG1hc2tlZFN0ci5yZXBsYWNlKHBhdHRlcm4sIHJlcGxhY2VtZW50KTtcbiAgfSk7XG4gIFxuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKG1hc2tlZFN0cik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBtYXNrZWRTdHI7XG4gIH1cbn1cblxuLyoqXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgqTjg5njg7Pjg4jjga7ph43opoHluqbliKTlrppcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2Vzc1NlY3VyaXR5RXZlbnRTZXZlcml0eShcbiAgZXZlbnRUeXBlOiBTZWN1cmVUcmFjZVN0ZXBbJ3NlY3VyaXR5RXZlbnRzJ11bMF1bJ2V2ZW50VHlwZSddLFxuICBjb250ZXh0OiBUcmFjZVNlY3VyaXR5Q29udGV4dFxuKTogJ0xPVycgfCAnTUVESVVNJyB8ICdISUdIJyB8ICdDUklUSUNBTCcge1xuICBjb25zdCBiYXNlU2V2ZXJpdHk6IFJlY29yZDx0eXBlb2YgZXZlbnRUeXBlLCAnTE9XJyB8ICdNRURJVU0nIHwgJ0hJR0gnIHwgJ0NSSVRJQ0FMJz4gPSB7XG4gICAgJ0FDQ0VTU19HUkFOVEVEJzogJ0xPVycsXG4gICAgJ0FDQ0VTU19ERU5JRUQnOiAnTUVESVVNJyxcbiAgICAnUEVSTUlTU0lPTl9FU0NBTEFUSU9OJzogJ0hJR0gnLFxuICAgICdTVVNQSUNJT1VTX0FDVElWSVRZJzogJ0NSSVRJQ0FMJ1xuICB9O1xuICBcbiAgbGV0IHNldmVyaXR5ID0gYmFzZVNldmVyaXR5W2V2ZW50VHlwZV07XG4gIFxuICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjg6zjg5njg6vjgavln7rjgaXjgY/ph43opoHluqbjga7oqr/mlbRcbiAgaWYgKGNvbnRleHQuc2VjdXJpdHlMZXZlbCA9PT0gJ1JFU1RSSUNURUQnIHx8IGNvbnRleHQuc2VjdXJpdHlMZXZlbCA9PT0gJ0NPTkZJREVOVElBTCcpIHtcbiAgICBpZiAoc2V2ZXJpdHkgPT09ICdMT1cnKSBzZXZlcml0eSA9ICdNRURJVU0nO1xuICAgIGlmIChzZXZlcml0eSA9PT0gJ01FRElVTScpIHNldmVyaXR5ID0gJ0hJR0gnO1xuICB9XG4gIFxuICAvLyDmqZ/lr4bjg4fjg7zjgr/jgpLlkKvjgoDloLTlkIjjga7ph43opoHluqbkuIrmmIdcbiAgaWYgKGNvbnRleHQuZGF0YUNsYXNzaWZpY2F0aW9uLmNvbnRhaW5zQ29uZmlkZW50aWFsRGF0YSAmJiBzZXZlcml0eSAhPT0gJ0NSSVRJQ0FMJykge1xuICAgIHNldmVyaXR5ID0gc2V2ZXJpdHkgPT09ICdMT1cnID8gJ01FRElVTScgOiBcbiAgICAgICAgICAgICAgIHNldmVyaXR5ID09PSAnTUVESVVNJyA/ICdISUdIJyA6ICdDUklUSUNBTCc7XG4gIH1cbiAgXG4gIHJldHVybiBzZXZlcml0eTtcbn1cblxuLyoqXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnjg4Hjgqfjg4Pjgq9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrU2VjdXJpdHlDb21wbGlhbmNlKHRyYWNlOiBTZWN1cmVCZWRyb2NrQWdlbnRUcmFjZSk6IHtcbiAgaXNDb21wbGlhbnQ6IGJvb2xlYW47XG4gIHZpb2xhdGlvbnM6IEFycmF5PHtcbiAgICB0eXBlOiAnRU5DUllQVElPTicgfCAnQUNDRVNTX0NPTlRST0wnIHwgJ0FVRElUJyB8ICdEQVRBX1BST1RFQ1RJT04nO1xuICAgIHNldmVyaXR5OiAnTE9XJyB8ICdNRURJVU0nIHwgJ0hJR0gnIHwgJ0NSSVRJQ0FMJztcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIHJlY29tbWVuZGF0aW9uOiBzdHJpbmc7XG4gIH0+O1xuICBjb21wbGlhbmNlU2NvcmU6IG51bWJlcjsgLy8gMC0xMDBcbn0ge1xuICBjb25zdCB2aW9sYXRpb25zOiBBcnJheTx7XG4gICAgdHlwZTogJ0VOQ1JZUFRJT04nIHwgJ0FDQ0VTU19DT05UUk9MJyB8ICdBVURJVCcgfCAnREFUQV9QUk9URUNUSU9OJztcbiAgICBzZXZlcml0eTogJ0xPVycgfCAnTUVESVVNJyB8ICdISUdIJyB8ICdDUklUSUNBTCc7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICByZWNvbW1lbmRhdGlvbjogc3RyaW5nO1xuICB9PiA9IFtdO1xuXG4gIC8vIOaal+WPt+WMluODgeOCp+ODg+OCr1xuICBpZiAodHJhY2UuZ2xvYmFsU2VjdXJpdHlDb250ZXh0LmVuY3J5cHRpb25SZXF1aXJlbWVudHMuZW5jcnlwdGlvbkF0UmVzdCAmJiBcbiAgICAgICF0cmFjZS5kYXRhUHJvdGVjdGlvbi5lbmNyeXB0aW9uQXBwbGllZCkge1xuICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICB0eXBlOiAnRU5DUllQVElPTicsXG4gICAgICBzZXZlcml0eTogJ0hJR0gnLFxuICAgICAgZGVzY3JpcHRpb246ICfkv53lrZjmmYLmmpflj7fljJbjgYzopoHmsYLjgZXjgozjgabjgYTjgb7jgZnjgYzpgannlKjjgZXjgozjgabjgYTjgb7jgZvjgpMnLFxuICAgICAgcmVjb21tZW5kYXRpb246ICfjg4fjg7zjgr/jga7kv53lrZjmmYLmmpflj7fljJbjgpLmnInlirnjgavjgZfjgabjgY/jgaDjgZXjgYQnXG4gICAgfSk7XG4gIH1cblxuICAvLyDjg4fjg7zjgr/kv53orbfjg4Hjgqfjg4Pjgq9cbiAgaWYgKHRyYWNlLmdsb2JhbFNlY3VyaXR5Q29udGV4dC5kYXRhQ2xhc3NpZmljYXRpb24uY29udGFpbnNQSUkgJiYgXG4gICAgICAhdHJhY2UuZGF0YVByb3RlY3Rpb24ubWFza2luZ0FwcGxpZWQpIHtcbiAgICB2aW9sYXRpb25zLnB1c2goe1xuICAgICAgdHlwZTogJ0RBVEFfUFJPVEVDVElPTicsXG4gICAgICBzZXZlcml0eTogJ0NSSVRJQ0FMJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAn5YCL5Lq65oOF5aCx44GM5ZCr44G+44KM44Gm44GE44G+44GZ44GM44Oe44K544Kt44Oz44Kw44GM6YGp55So44GV44KM44Gm44GE44G+44Gb44KTJyxcbiAgICAgIHJlY29tbWVuZGF0aW9uOiAnUElJ44OH44O844K/44Gu44Oe44K544Kt44Oz44Kw44KS6YGp55So44GX44Gm44GP44Gg44GV44GEJ1xuICAgIH0pO1xuICB9XG5cbiAgLy8g55uj5p+744Ot44Kw44OB44Kn44OD44KvXG4gIGlmICh0cmFjZS5nbG9iYWxTZWN1cml0eUNvbnRleHQuYXVkaXRSZXF1aXJlbWVudHMuYXVkaXRMb2dSZXF1aXJlZCAmJiBcbiAgICAgIHRyYWNlLnNlY3VyaXR5QXVkaXRMb2cubGVuZ3RoID09PSAwKSB7XG4gICAgdmlvbGF0aW9ucy5wdXNoKHtcbiAgICAgIHR5cGU6ICdBVURJVCcsXG4gICAgICBzZXZlcml0eTogJ01FRElVTScsXG4gICAgICBkZXNjcmlwdGlvbjogJ+ebo+afu+ODreOCsOOBjOimgeaxguOBleOCjOOBpuOBhOOBvuOBmeOBjOiomOmMsuOBleOCjOOBpuOBhOOBvuOBm+OCkycsXG4gICAgICByZWNvbW1lbmRhdGlvbjogJ+ebo+afu+ODreOCsOOBruiomOmMsuOCkuacieWKueOBq+OBl+OBpuOBj+OBoOOBleOBhCdcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOOCs+ODs+ODl+ODqeOCpOOCouODs+OCueOCueOCs+OCouioiOeul1xuICBjb25zdCB0b3RhbENoZWNrcyA9IDEwOyAvLyDnt4/jg4Hjgqfjg4Pjgq/poIXnm67mlbBcbiAgY29uc3QgdmlvbGF0aW9uUGVuYWx0eSA9IHZpb2xhdGlvbnMucmVkdWNlKChzdW0sIHZpb2xhdGlvbikgPT4ge1xuICAgIGNvbnN0IHBlbmFsdGllcyA9IHsgJ0xPVyc6IDEsICdNRURJVU0nOiAyLCAnSElHSCc6IDMsICdDUklUSUNBTCc6IDQgfTtcbiAgICByZXR1cm4gc3VtICsgcGVuYWx0aWVzW3Zpb2xhdGlvbi5zZXZlcml0eV07XG4gIH0sIDApO1xuICBcbiAgY29uc3QgY29tcGxpYW5jZVNjb3JlID0gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZCgoKHRvdGFsQ2hlY2tzICogNCAtIHZpb2xhdGlvblBlbmFsdHkpIC8gKHRvdGFsQ2hlY2tzICogNCkpICogMTAwKSk7XG4gIGNvbnN0IGlzQ29tcGxpYW50ID0gdmlvbGF0aW9ucy5maWx0ZXIodiA9PiB2LnNldmVyaXR5ID09PSAnSElHSCcgfHwgdi5zZXZlcml0eSA9PT0gJ0NSSVRJQ0FMJykubGVuZ3RoID09PSAwO1xuXG4gIHJldHVybiB7XG4gICAgaXNDb21wbGlhbnQsXG4gICAgdmlvbGF0aW9ucyxcbiAgICBjb21wbGlhbmNlU2NvcmVcbiAgfTtcbn1cblxuLyoqXG4gKiDjg4fjg5Xjgqnjg6vjg4jjgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjg4bjgq3jgrnjg4jjga7nlJ/miJBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRTZWN1cml0eUNvbnRleHQoc2VjdXJpdHlMZXZlbDogU2VjdXJpdHlMZXZlbCA9ICdJTlRFUk5BTCcpOiBUcmFjZVNlY3VyaXR5Q29udGV4dCB7XG4gIHJldHVybiB7XG4gICAgc2VjdXJpdHlMZXZlbCxcbiAgICBkYXRhQ2xhc3NpZmljYXRpb246IHtcbiAgICAgIGNvbnRhaW5zUElJOiBmYWxzZSxcbiAgICAgIGNvbnRhaW5zQ29uZmlkZW50aWFsRGF0YTogc2VjdXJpdHlMZXZlbCA9PT0gJ0NPTkZJREVOVElBTCcgfHwgc2VjdXJpdHlMZXZlbCA9PT0gJ1JFU1RSSUNURUQnLFxuICAgICAgY29udGFpbnNSZWd1bGF0ZWREYXRhOiBzZWN1cml0eUxldmVsID09PSAnUkVTVFJJQ1RFRCdcbiAgICB9LFxuICAgIGFjY2Vzc0NvbnRyb2w6IHtcbiAgICAgIHJlcXVpcmVkUGVybWlzc2lvbnM6IFsnYmVkcm9jazpJbnZva2VBZ2VudCddLFxuICAgICAgYWxsb3dlZFJvbGVzOiBbJ0JlZHJvY2tBZ2VudFVzZXInXSxcbiAgICAgIGdlb2dyYXBoaWNSZXN0cmljdGlvbnM6IHNlY3VyaXR5TGV2ZWwgPT09ICdSRVNUUklDVEVEJyA/IFsnVVMnLCAnRVUnXSA6IHVuZGVmaW5lZFxuICAgIH0sXG4gICAgYXVkaXRSZXF1aXJlbWVudHM6IHtcbiAgICAgIGF1ZGl0TG9nUmVxdWlyZWQ6IHNlY3VyaXR5TGV2ZWwgPT09ICdDT05GSURFTlRJQUwnIHx8IHNlY3VyaXR5TGV2ZWwgPT09ICdSRVNUUklDVEVEJyxcbiAgICAgIHJldGVudGlvblBlcmlvZERheXM6IHNlY3VyaXR5TGV2ZWwgPT09ICdSRVNUUklDVEVEJyA/IDI1NTUgOiAzNjUsIC8vIDflubQgb3IgMeW5tFxuICAgICAgY29tcGxpYW5jZVJlcXVpcmVtZW50czogc2VjdXJpdHlMZXZlbCA9PT0gJ1JFU1RSSUNURUQnID8gWydTT1gnLCAnR0RQUicsICdISVBBQSddIDogW11cbiAgICB9LFxuICAgIGVuY3J5cHRpb25SZXF1aXJlbWVudHM6IHtcbiAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHNlY3VyaXR5TGV2ZWwgPT09ICdDT05GSURFTlRJQUwnIHx8IHNlY3VyaXR5TGV2ZWwgPT09ICdSRVNUUklDVEVEJyxcbiAgICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uQWxnb3JpdGhtOiBzZWN1cml0eUxldmVsID09PSAnUkVTVFJJQ1RFRCcgPyAnQUVTLTI1Ni1HQ00nIDogJ0FFUy0yNTYnXG4gICAgfVxuICB9O1xufSJdfQ==