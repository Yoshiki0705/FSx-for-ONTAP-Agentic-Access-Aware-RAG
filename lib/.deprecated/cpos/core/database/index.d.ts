/**
 * Database Manager
 * SQLiteデータベースの初期化と管理を担当
 */
import { FileMetadataModel, SyncStateModel, BackupHistoryModel, OperationLogModel } from '../../models';
export declare class DatabaseManager {
    private initialized;
    private dbPath;
    private dataStore;
    constructor(dbPath?: string);
    /**
     * データベースを初期化
     */
    initialize(): Promise<void>;
    /**
     * データベースが初期化されているかチェック
     */
    private checkInitialized;
    /**
     * データを永続化
     */
    private persist;
    /**
     * データベース接続を閉じる
     */
    close(): Promise<void>;
    /**
     * ファイルメタデータを挿入または更新
     */
    upsertFileMetadata(metadata: FileMetadataModel): Promise<void>;
    /**
     * ファイルメタデータを取得
     */
    getFileMetadata(filePath: string): Promise<FileMetadataModel | null>;
    /**
     * 環境別のファイルメタデータを取得
     */
    getFileMetadataByEnvironment(environment: 'local' | 'ec2'): Promise<FileMetadataModel[]>;
    /**
     * 同期状態を挿入または更新
     */
    upsertSyncState(syncState: SyncStateModel): Promise<void>;
    /**
     * 同期状態を取得
     */
    getSyncState(filePath: string): Promise<SyncStateModel | null>;
    /**
     * バックアップ履歴を挿入
     */
    insertBackupHistory(backup: BackupHistoryModel): Promise<void>;
    /**
     * バックアップ履歴を取得
     */
    getBackupHistory(limit?: number): Promise<BackupHistoryModel[]>;
    /**
     * 操作ログを挿入
     */
    insertOperationLog(log: OperationLogModel): Promise<void>;
    /**
     * 操作ログを更新
     */
    updateOperationLog(id: number, status: string, completedAt?: Date, errorMessage?: string): Promise<void>;
    /**
     * 操作ログを取得
     */
    getOperationLogs(limit?: number): Promise<OperationLogModel[]>;
    /**
     * データベースの統計情報を取得
     */
    getStatistics(): Promise<any>;
}
