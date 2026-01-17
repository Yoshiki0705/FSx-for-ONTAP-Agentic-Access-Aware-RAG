/**
 * 統合ファイル整理システム - バックアップ復元管理
 *
 * ローカル・EC2両環境でのバックアップ復元機能を統合管理し、
 * エラー時の自動ロールバック機能を提供します。
 */
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { BackupResult, RestoreResult, BackupInfo, Environment } from '../types/index.js';
/**
 * 復元オプション
 */
export interface RestoreOptions {
    /** 復元前にバックアップを作成するか */
    createPreRestoreBackup: boolean;
    /** 既存ファイルを上書きするか */
    overwriteExisting: boolean;
    /** 復元後に検証を実行するか */
    verifyAfterRestore: boolean;
    /** ドライランモード */
    dryRun: boolean;
}
/**
 * 統合復元結果
 */
export interface IntegratedRestoreResult {
    /** 復元ID */
    restoreId: string;
    /** 成功したかどうか */
    success: boolean;
    /** 環境別結果 */
    environmentResults: Record<Environment, RestoreResult>;
    /** 復元されたファイル総数 */
    totalRestoredFiles: number;
    /** エラー */
    errors: string[];
    /** 復元実行時刻 */
    restoreTime: Date;
    /** 処理時間 */
    processingTime: number;
}
/**
 * バックアップ復元管理
 *
 * 両環境のバックアップ復元を統合管理し、
 * エラー時の自動ロールバック機能を提供します。
 */
export declare class BackupRestoreManager {
    private readonly localBackupManager;
    private readonly ec2BackupManager;
    constructor(localBackupDir: string, sshConfig: SSHConfig, ec2BackupDir?: string);
    /**
     * 統合バックアップ作成
     */
    createIntegratedBackup(localFiles: string[], ec2Files: string[], backupId: string): Promise<{
        local: BackupResult;
        ec2: BackupResult;
        success: boolean;
    }>;
    /**
     * 統合バックアップ復元
     */
    restoreIntegratedBackup(backupId: string, options?: RestoreOptions): Promise<IntegratedRestoreResult>;
    /**
     * 自動ロールバック機能
     */
    executeAutoRollback(originalBackupId: string, reason?: string): Promise<IntegratedRestoreResult>;
    /**
     * バックアップ一覧を取得（統合）
     */
    listIntegratedBackups(): Promise<{
        local: BackupInfo[];
        ec2: BackupInfo[];
        paired: Array<{
            backupId: string;
            localBackup?: BackupInfo;
            ec2Backup?: BackupInfo;
            complete: boolean;
        }>;
    }>;
    /**
     * 古いバックアップの統合クリーンアップ
     */
    cleanupOldIntegratedBackups(retentionDays: number): Promise<{
        localDeleted: number;
        ec2Deleted: number;
        totalDeleted: number;
    }>;
    /**
     * バックアップの整合性検証（統合）
     */
    verifyIntegratedBackup(backupId: string): Promise<{
        local: {
            valid: boolean;
            errors: string[];
            checkedFiles: number;
        };
        ec2: {
            valid: boolean;
            errors: string[];
            checkedFiles: number;
        };
        overall: {
            valid: boolean;
            totalErrors: number;
            totalCheckedFiles: number;
        };
    }>;
    /**
     * 環境別バックアップ復元
     */
    private restoreEnvironmentBackup;
    /**
     * 復元結果を処理
     */
    private processRestoreResult;
    /**
     * 復元結果を検証
     */
    private verifyRestoreResults;
    /**
     * ペアになったバックアップを特定
     */
    private identifyPairedBackups;
    /**
     * 環境別バックアップクリーンアップ
     */
    private cleanupEnvironmentBackups;
    /**
     * 緊急復旧機能
     */
    emergencyRestore(backupId: string, targetEnvironment?: Environment): Promise<IntegratedRestoreResult>;
}
