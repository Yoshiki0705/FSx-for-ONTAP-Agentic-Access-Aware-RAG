/**
 * 統合ファイル整理システム - 権限マネージャー
 *
 * ファイルタイプ別の権限設定機能を提供し、
 * セキュリティ要件に応じた適切な権限管理を実行します。
 */
import { FileInfo, ClassificationResult, Environment, FileType } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * 権限設定ルール
 */
export interface PermissionRule {
    /** ファイルタイプ */
    fileType: FileType;
    /** 権限（8進数文字列） */
    permissions: string;
    /** 説明 */
    description: string;
    /** 条件（オプション） */
    condition?: (filePath: string) => boolean;
}
/**
 * 権限設定結果
 */
export interface PermissionResult {
    /** ファイルパス */
    filePath: string;
    /** 設定前の権限 */
    previousPermissions: string;
    /** 設定後の権限 */
    newPermissions: string;
    /** 成功したかどうか */
    success: boolean;
    /** エラーメッセージ */
    error?: string;
    /** 処理時間（ミリ秒） */
    processingTime: number;
}
/**
 * 権限設定サマリー
 */
export interface PermissionSummary {
    /** 処理したファイル数 */
    totalFiles: number;
    /** 成功したファイル数 */
    successfulUpdates: number;
    /** 失敗したファイル数 */
    failedUpdates: number;
    /** スキップしたファイル数 */
    skippedFiles: number;
    /** 総処理時間 */
    totalProcessingTime: number;
    /** 環境 */
    environment: Environment;
    /** 詳細結果 */
    results: PermissionResult[];
    /** エラー統計 */
    errorSummary: Record<string, number>;
}
/**
 * 権限マネージャー
 *
 * ファイルタイプ別の権限設定と環境別権限調整を提供します。
 */
export declare class PermissionManager {
    private readonly sshConfig?;
    private readonly permissionRules;
    constructor(sshConfig?: SSHConfig);
    /**
     * 複数ファイルの権限を一括設定
     */
    setPermissions(files: FileInfo[], classifications: ClassificationResult[], environment: Environment): Promise<PermissionSummary>;
    /**
     * 単一ファイルの権限を設定
     */
    setSingleFilePermission(file: FileInfo, classification: ClassificationResult, environment: Environment): Promise<PermissionResult>;
    /**
     * 権限設定ルールを初期化
     */
    private initializePermissionRules;
    /**
     * 適切な権限を決定
     */
    private determineTargetPermissions;
    /**
     * 現在の権限を取得
     */
    private getCurrentPermissions;
    /**
     * 権限を適用
     */
    private applyPermissions;
    /**
     * 権限設定の検証
     */
    validatePermissions(files: FileInfo[], classifications: ClassificationResult[], environment: Environment): Promise<{
        valid: boolean;
        issues: Array<{
            filePath: string;
            expectedPermissions: string;
            actualPermissions: string;
            issue: string;
        }>;
    }>;
    /**
     * 権限修復を実行
     */
    repairPermissions(files: FileInfo[], classifications: ClassificationResult[], environment: Environment): Promise<PermissionSummary>;
    /**
     * 権限設定レポートを生成
     */
    generatePermissionReport(summary: PermissionSummary): string;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
    /**
     * 権限設定の統計情報を取得
     */
    getPermissionStatistics(summary: PermissionSummary): {
        byFileType: Record<FileType, {
            total: number;
            success: number;
            failed: number;
        }>;
        byPermission: Record<string, number>;
        processingTimeStats: {
            min: number;
            max: number;
            average: number;
            median: number;
        };
    };
}
