/**
 * Database Manager
 * SQLiteデータベースの初期化と管理を担当
 */

// SQLite3の代わりにファイルベースの簡易実装を使用
// 本格的な実装では better-sqlite3 を推奨
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileMetadataModel, SyncStateModel, BackupHistoryModel, OperationLogModel } from '../../models';

export class DatabaseManager {
  private initialized: boolean = false;
  private dbPath: string;
  private dataStore: Map<string, any> = new Map();

  constructor(dbPath: string = './data/cpos.db') {
    this.dbPath = dbPath;
  }

  /**
   * データベースを初期化
   */
  async initialize(): Promise<void> {
    try {
      // データベースディレクトリを作成
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // 既存のデータを読み込み（存在する場合）
      try {
        const existingData = await fs.readFile(this.dbPath, 'utf-8');
        const parsedData = JSON.parse(existingData);
        this.dataStore = new Map(Object.entries(parsedData));
      } catch {
        // ファイルが存在しない場合は新規作成
        this.dataStore = new Map();
      }

      this.initialized = true;
      console.log('データベースの初期化が完了しました');
    } catch (error) {
      console.error('データベースの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * データベースが初期化されているかチェック
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('データベースが初期化されていません。initialize()を先に実行してください。');
    }
  }

  /**
   * データを永続化
   */
  private async persist(): Promise<void> {
    const data = Object.fromEntries(this.dataStore);
    await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
  }

  /**
   * データベース接続を閉じる
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.persist();
      this.initialized = false;
    }
  }

  /**
   * ファイルメタデータを挿入または更新
   */
  async upsertFileMetadata(metadata: FileMetadataModel): Promise<void> {
    this.checkInitialized();
    
    const key = `file_metadata:${metadata.path}`;
    this.dataStore.set(key, metadata.toObject());
    await this.persist();
  }

  /**
   * ファイルメタデータを取得
   */
  async getFileMetadata(filePath: string): Promise<FileMetadataModel | null> {
    this.checkInitialized();
    
    const key = `file_metadata:${filePath}`;
    const data = this.dataStore.get(key);
    
    return data ? FileMetadataModel.fromObject(data) : null;
  }

  /**
   * 環境別のファイルメタデータを取得
   */
  async getFileMetadataByEnvironment(environment: 'local' | 'ec2'): Promise<FileMetadataModel[]> {
    this.checkInitialized();
    
    const results: FileMetadataModel[] = [];
    
    this.dataStore.forEach((value, key) => {
      if (key.startsWith('file_metadata:') && value.environment === environment) {
        results.push(FileMetadataModel.fromObject(value));
      }
    });
    
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * 同期状態を挿入または更新
   */
  async upsertSyncState(syncState: SyncStateModel): Promise<void> {
    this.checkInitialized();
    
    const key = `sync_state:${syncState.filePath}`;
    this.dataStore.set(key, syncState.toObject());
    await this.persist();
  }

  /**
   * 同期状態を取得
   */
  async getSyncState(filePath: string): Promise<SyncStateModel | null> {
    this.checkInitialized();
    
    const key = `sync_state:${filePath}`;
    const data = this.dataStore.get(key);
    
    return data ? SyncStateModel.fromObject(data) : null;
  }

  /**
   * バックアップ履歴を挿入
   */
  async insertBackupHistory(backup: BackupHistoryModel): Promise<void> {
    this.checkInitialized();
    
    const key = `backup_history:${backup.backupId}`;
    this.dataStore.set(key, backup.toObject());
    await this.persist();
  }

  /**
   * バックアップ履歴を取得
   */
  async getBackupHistory(limit: number = 50): Promise<BackupHistoryModel[]> {
    this.checkInitialized();
    
    const results: BackupHistoryModel[] = [];
    
    this.dataStore.forEach((value, key) => {
      if (key.startsWith('backup_history:')) {
        results.push(BackupHistoryModel.fromObject(value));
      }
    });
    
    return results
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * 操作ログを挿入
   */
  async insertOperationLog(log: OperationLogModel): Promise<void> {
    this.checkInitialized();
    
    const id = Date.now().toString();
    log.id = parseInt(id);
    const key = `operation_log:${id}`;
    this.dataStore.set(key, log.toObject());
    await this.persist();
  }

  /**
   * 操作ログを更新
   */
  async updateOperationLog(id: number, status: string, completedAt?: Date, errorMessage?: string): Promise<void> {
    this.checkInitialized();
    
    const key = `operation_log:${id}`;
    const existing = this.dataStore.get(key);
    
    if (existing) {
      existing.status = status;
      if (completedAt) existing.completed_at = completedAt.toISOString();
      if (errorMessage) existing.error_message = errorMessage;
      
      this.dataStore.set(key, existing);
      await this.persist();
    }
  }

  /**
   * 操作ログを取得
   */
  async getOperationLogs(limit: number = 100): Promise<OperationLogModel[]> {
    this.checkInitialized();
    
    const results: OperationLogModel[] = [];
    
    this.dataStore.forEach((value, key) => {
      if (key.startsWith('operation_log:')) {
        results.push(OperationLogModel.fromObject(value));
      }
    });
    
    return results
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * データベースの統計情報を取得
   */
  async getStatistics(): Promise<any> {
    this.checkInitialized();
    
    const stats = {
      fileCount: 0,
      syncStateCount: 0,
      backupCount: 0,
      operationLogCount: 0
    };

    this.dataStore.forEach((value, key) => {
      if (key.startsWith('file_metadata:')) stats.fileCount++;
      else if (key.startsWith('sync_state:')) stats.syncStateCount++;
      else if (key.startsWith('backup_history:')) stats.backupCount++;
      else if (key.startsWith('operation_log:')) stats.operationLogCount++;
    });

    return stats;
  }
}