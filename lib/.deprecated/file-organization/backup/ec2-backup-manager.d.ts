/**
 * 統合ファイル整理システム - EC2バックアップ管理
 *
 * EC2環境でのSSH接続によるリモートファイルバックアップ作成、復元、管理機能を提供します。
 * SSH経由での安全なファイル操作をサポートします。
 */
import { BackupManager, BackupResult, RestoreResult, BackupInfo } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * EC2バックアップ管理
 *
 * SSH接続を使用してEC2環境でのファイルバックアップ機能を提供し、
 * リモート環境での安全なファイル操作をサポートします。
 */
export declare class EC2BackupManager implements BackupManager {
    private readonly sshConfig;
    private readonly backupRootDir;
    private readonly maxBackupSize;
    constructor(sshConfig: SSHConfig, backupRootDir?: string, maxBackupSize?: number);
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
     * SSH接続テスト
     */
    testConnection(): Promise<boolean>;
    /**
     * ファイルパスをSSHコマンド用にエスケープ
     */
    private escapeFilePath;
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
     * リモートファイルのチェックサムを計算
     */
    private calculateRemoteChecksum;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
    /**
     * EC2環境のディスク使用量を確認
     */
    checkDiskSpace(): Promise<{
        available: number;
        used: number;
        total: number;
        usagePercentage: number;
    }>;
    /**
     * バックアップサイズを取得
     */
    getBackupSize(backupId: string): Promise<number>;
    /**
     * バックアップの圧縮
     */
    compressBackup(backupId: string): Promise<void>;
    /**
     * 圧縮されたバックアップを展開
     */
    decompressBackup(backupId: string): Promise<void>;
}
