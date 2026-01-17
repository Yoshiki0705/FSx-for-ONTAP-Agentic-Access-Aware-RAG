/**
 * 統合ファイル整理システム - ローカルバックアップ管理
 *
 * ローカル環境でのファイルバックアップ作成、復元、管理機能を提供します。
 * 安全なファイル移動のための包括的なバックアップシステムです。
 */
import { BackupManager, BackupResult, RestoreResult, BackupInfo } from '../types/index.js';
/**
 * ローカルバックアップ管理
 *
 * ローカル環境でのファイルバックアップ機能を提供し、
 * 安全なファイル操作をサポートします。
 */
export declare class LocalBackupManager implements BackupManager {
    private readonly backupRootDir;
    private readonly maxBackupSize;
    private readonly compressionEnabled;
    constructor(backupRootDir?: string, maxBackupSize?: number, // 1GB
    compressionEnabled?: boolean);
    /**
     * バックアップを作成
     */
    createBackup(files: string[], backupId: string): Promise<BackupResult>;
    /**
     * バックアップを復元
     */
    restoreBackup(backupId: string): Promise<RestoreResult>;
    /**
     * バックアップ一覧を取得
     */
    listBackups(): Promise<BackupInfo[]>;
    /**
     * 古いバックアップを削除
     */
    cleanupOldBackups(retentionDays: number): Promise<void>;
    /**
     * バックアップを削除
     */
    deleteBackup(backupId: string): Promise<void>;
    /**
     * バックアップの整合性を検証
     */
    verifyBackup(backupId: string): Promise<{
        valid: boolean;
        errors: string[];
        checkedFiles: number;
    }>;
    /**
     * 単一ファイルをバックアップ
     */
    private backupSingleFile;
    /**
     * 単一ファイルを復元
     */
    private restoreSingleFile;
    /**
     * バックアップメタデータを作成
     */
    private createBackupMetadata;
    /**
     * バックアップメタデータを読み込み
     */
    private loadBackupMetadata;
    /**
     * バックアップの存在確認
     */
    private backupExists;
    /**
     * バックアップディレクトリの権限設定
     */
    private setBackupPermissions;
    /**
     * ファイルのチェックサムを計算
     */
    private calculateChecksum;
    /**
     * バックアップサイズを取得
     */
    getBackupSize(backupId: string): Promise<number>;
    /**
     * 利用可能なディスク容量を確認
     */
    checkDiskSpace(): Promise<{
        available: number;
        used: number;
        total: number;
        usagePercentage: number;
    }>;
}
