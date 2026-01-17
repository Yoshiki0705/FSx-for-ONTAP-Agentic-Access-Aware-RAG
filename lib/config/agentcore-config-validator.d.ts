/**
 * AgentCore設定バリデーター
 *
 * cdk.context.jsonのagentCore設定をバリデーションします。
 * 設定値の範囲チェック、必須項目チェック、論理的整合性チェックを実施します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */
import { AgentCoreConfig } from '../../types/agentcore-config';
/**
 * バリデーション結果
 */
export interface ValidationResult {
    /**
     * バリデーション成功フラグ
     */
    readonly valid: boolean;
    /**
     * エラーメッセージリスト
     */
    readonly errors: string[];
    /**
     * 警告メッセージリスト
     */
    readonly warnings: string[];
}
/**
 * AgentCore設定バリデータークラス
 */
export declare class AgentCoreConfigValidator {
    /**
     * AgentCore設定をバリデーション
     *
     * @param config AgentCore設定
     * @returns バリデーション結果
     */
    static validate(config: AgentCoreConfig): ValidationResult;
    /**
     * Runtime設定のバリデーション
     */
    private static validateRuntime;
    /**
     * Gateway設定のバリデーション
     */
    private static validateGateway;
    /**
     * Memory設定のバリデーション
     */
    private static validateMemory;
    /**
     * Identity設定のバリデーション
     */
    private static validateIdentity;
    /**
     * Browser設定のバリデーション
     */
    private static validateBrowser;
    /**
     * Code Interpreter設定のバリデーション
     */
    private static validateCodeInterpreter;
    /**
     * Observability設定のバリデーション
     */
    private static validateObservability;
    /**
     * Evaluations設定のバリデーション
     */
    private static validateEvaluations;
    /**
     * Policy設定のバリデーション
     */
    private static validatePolicy;
}
