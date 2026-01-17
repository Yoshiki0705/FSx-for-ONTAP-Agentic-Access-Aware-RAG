/**
 * 統合ファイル整理システム - 権限検証・修復機能
 *
 * ファイル権限の検証、修復、レポート生成機能を提供し、
 * セキュリティ要件の継続的な遵守を保証します。
 */
import { FileInfo, ClassificationResult, Environment } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { PermissionSummary } from './permission-manager.js';
/**
 * 権限検証結果
 */
export interface ValidationResult {
    /** ファイルパス */
    filePath: string;
    /** 期待される権限 */
    expectedPermissions: string;
    /** 実際の権限 */
    actualPermissions: string;
    /** 検証結果 */
    isValid: boolean;
    /** 問題の種類 */
    issueType?: 'incorrect_permissions' | 'missing_file' | 'access_denied' | 'unknown_error';
    /** 問題の詳細 */
    issueDescription?: string;
    /** セキュリティリスクレベル */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    /** 推奨アクション */
    recommendedAction: string;
}
/**
 * 検証サマリー
 */
export interface ValidationSummary {
    /** 検証したファイル数 */
    totalFiles: number;
    /** 有効なファイル数 */
    validFiles: number;
    /** 無効なファイル数 */
    invalidFiles: number;
    /** リスクレベル別統計 */
    riskLevelStats: Record<string, number>;
    /** 問題タイプ別統計 */
    issueTypeStats: Record<string, number>;
    /** 検証時間 */
    validationTime: number;
    /** 環境 */
    environment: Environment;
    /** 詳細結果 */
    results: ValidationResult[];
}
/**
 * 修復計画
 */
export interface RepairPlan {
    /** 修復対象ファイル */
    targetFiles: Array<{
        filePath: string;
        currentPermissions: string;
        targetPermissions: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
    }>;
    /** 推定修復時間 */
    estimatedRepairTime: number;
    /** 修復順序 */
    repairOrder: string[];
    /** 注意事項 */
    warnings: string[];
}
/**
 * 権限検証・修復機能
 *
 * 包括的な権限検証と自動修復機能を提供します。
 */
export declare class PermissionValidator {
    private readonly permissionManager;
    private readonly sshConfig?;
    constructor(sshConfig?: SSHConfig);
    /**
     * 包括的権限検証を実行
     */
    validatePermissions(files: FileInfo[], classifications: ClassificationResult[], environment: Environment): Promise<ValidationSummary>;
    /**
     * 単一ファイルの権限を検証
     */
    private validateSingleFile;
    /**
     * 権限問題を分析
     */
    private analyzePermissionIssue;
    /**
     * 修復計画を作成
     */
    createRepairPlan(validationSummary: ValidationSummary): RepairPlan;
    /**
     * 自動修復を実行
     */
    executeAutoRepair(validationSummary: ValidationSummary, files: FileInfo[], classifications: ClassificationResult[]): Promise<PermissionSummary>;
    /**
     * 継続的監視を実行
     */
    performContinuousMonitoring(files: FileInfo[], classifications: ClassificationResult[], environment: Environment, intervalMinutes?: number): Promise<void>;
    /**
     * 権限検証レポートを生成
     */
    generateValidationReport(validationSummary: ValidationSummary): string;
    /**
     * 期待される権限を決定
     */
    private determineExpectedPermissions;
    /**
     * 現在の権限を取得
     */
    private getCurrentPermissions;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
}
