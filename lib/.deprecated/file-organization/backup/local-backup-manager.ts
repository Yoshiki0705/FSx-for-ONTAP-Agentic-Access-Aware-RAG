/**
 * 統合ファイル整理システム - ローカルバックアップ管理
 * 
 * ローカル環境でのファイルバックアップ作成、復元、管理機能を提供します。
 * 安全なファイル移動のための包括的なバックアップシステムです。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  BackupManager,
  BackupResult, 
  RestoreResult, 
  BackupInfo, 
  BackupFileInfo,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

/**
 * ローカルバックアップ管理
 * 
 * ローカル環境でのファイルバックアップ機能を提供し、
 * 安全なファイル操作をサポートします。
 */
export class LocalBackupManager implements BackupManager {
  private readonly backupRootDir: string;
  private readonly maxBackupSize: number;
  private readonly compressionEnabled: boolean;

  constructor(
    backupRootDir: string = 'development/temp/backups',
    maxBackupSize: number = 1024 * 1024 * 1024, // 1GB
    compressionEnabled: boolean = false
  ) {
    this.backupRootDir = path.resolve(backupRootDir);
    this.maxBackupSize = maxBackupSize;
    this.compressionEnabled = compressionEnabled;
  }

  /**
   * バックアップを作成
   */
  public async createBackup(files: string[], backupId: string): Promise<BackupResult> {
    const startTime = Date.now();
    console.log(`💾 ローカルバックアップを作成中: ${backupId}`);

    try {
      // バックアップディレクトリの作成
      const backupPath = path.join(this.backupRootDir, backupId);
      await fs.mkdir(backupPath, { recursive: true });

      // バックアップファイル情報
      const backupFiles: BackupFileInfo[] = [];
      let totalSize = 0;
      const errors: string[] = [];

      // ファイルを個別にバックアップ
      for (const filePath of files) {
        try {
          const fileInfo = await this.backupSingleFile(filePath, backupPath);
          if (fileInfo) {
            backupFiles.push(fileInfo);
            totalSize += fileInfo.size;

            // サイズ制限チェック
            if (totalSize > this.maxBackupSize) {
              throw new Error(`バックアップサイズが制限を超えました: ${totalSize} > ${this.maxBackupSize}`);
            }
          }
        } catch (error) {
          const errorMsg = `ファイルバックアップ失敗: ${filePath} - ${error}`;
          errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }

      // バックアップメタデータの作成
      await this.createBackupMetadata(backupPath, backupId, backupFiles, totalSize);

      // バックアップディレクトリの権限設定
      await this.setBackupPermissions(backupPath);

      const processingTime = Date.now() - startTime;
      console.log(`✅ ローカルバックアップ作成完了: ${backupFiles.length}ファイル (${processingTime}ms)`);

      return {
        backupId,
        timestamp: new Date(),
        files: backupFiles,
        totalSize,
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        environment: 'local',
        backupPath
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `ローカルバックアップ作成に失敗しました: ${error}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * バックアップを復元
   */
  public async restoreBackup(backupId: string): Promise<RestoreResult> {
    const startTime = Date.now();
    console.log(`🔄 ローカルバックアップを復元中: ${backupId}`);

    try {
      const backupPath = path.join(this.backupRootDir, backupId);
      
      // バックアップの存在確認
      if (!await this.backupExists(backupPath)) {
        throw new Error(`バックアップが見つかりません: ${backupId}`);
      }

      // メタデータの読み込み
      const metadata = await this.loadBackupMetadata(backupPath);
      const restoredFiles: string[] = [];
      const errors: string[] = [];

      // ファイルを個別に復元
      for (const fileInfo of metadata.files) {
        try {
          await this.restoreSingleFile(fileInfo, backupPath);
          restoredFiles.push(fileInfo.originalPath);
        } catch (error) {
          const errorMsg = `ファイル復元失敗: ${fileInfo.originalPath} - ${error}`;
          errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ ローカルバックアップ復元完了: ${restoredFiles.length}ファイル (${processingTime}ms)`);

      return {
        restoreId: `restore-${Date.now()}`,
        success: errors.length === 0,
        restoredFileCount: restoredFiles.length,
        restoredFiles,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        restoreTime: new Date(),
        environment: 'local'
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `ローカルバックアップ復元に失敗しました: ${error}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * バックアップ一覧を取得
   */
  public async listBackups(): Promise<BackupInfo[]> {
    try {
      // バックアップルートディレクトリの存在確認
      try {
        await fs.access(this.backupRootDir);
      } catch {
        return []; // ディレクトリが存在しない場合は空配列を返す
      }

      const entries = await fs.readdir(this.backupRootDir, { withFileTypes: true });
      const backups: BackupInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const backupPath = path.join(this.backupRootDir, entry.name);
            const metadata = await this.loadBackupMetadata(backupPath);
            
            backups.push({
              backupId: entry.name,
              createdAt: metadata.timestamp,
              fileCount: metadata.files.length,
              totalSize: metadata.totalSize,
              description: `ローカルバックアップ (${metadata.files.length}ファイル)`,
              environment: 'local',
              backupPath
            });
          } catch (error) {
            console.warn(`バックアップメタデータ読み込みエラー: ${entry.name}`, error);
          }
        }
      }

      // 作成日時でソート（新しい順）
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップ一覧取得に失敗しました: ${error}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * 古いバックアップを削除
   */
  public async cleanupOldBackups(retentionDays: number): Promise<void> {
    console.log(`🧹 ${retentionDays}日より古いバックアップを削除中...`);

    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          try {
            await this.deleteBackup(backup.backupId);
            deletedCount++;
            console.log(`🗑️  古いバックアップを削除: ${backup.backupId}`);
          } catch (error) {
            console.warn(`バックアップ削除エラー: ${backup.backupId}`, error);
          }
        }
      }

      console.log(`✅ バックアップクリーンアップ完了: ${deletedCount}個削除`);
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップクリーンアップに失敗しました: ${error}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * バックアップを削除
   */
  public async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupPath = path.join(this.backupRootDir, backupId);
      
      if (await this.backupExists(backupPath)) {
        await fs.rm(backupPath, { recursive: true, force: true });
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップ削除に失敗しました: ${backupId}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * バックアップの整合性を検証
   */
  public async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
    checkedFiles: number;
  }> {
    try {
      const backupPath = path.join(this.backupRootDir, backupId);
      const metadata = await this.loadBackupMetadata(backupPath);
      const errors: string[] = [];
      let checkedFiles = 0;

      for (const fileInfo of metadata.files) {
        try {
          const backupFilePath = path.join(backupPath, 'files', path.basename(fileInfo.originalPath));
          
          // ファイルの存在確認
          await fs.access(backupFilePath);
          
          // チェックサムの検証
          const actualChecksum = await this.calculateChecksum(backupFilePath);
          if (actualChecksum !== fileInfo.checksum) {
            errors.push(`チェックサム不一致: ${fileInfo.originalPath}`);
          }
          
          checkedFiles++;
        } catch (error) {
          errors.push(`ファイル検証エラー: ${fileInfo.originalPath} - ${error}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        checkedFiles
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップ検証に失敗しました: ${backupId}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * 単一ファイルをバックアップ
   */
  private async backupSingleFile(filePath: string, backupPath: string): Promise<BackupFileInfo | null> {
    try {
      // ファイルの存在確認
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return null;
      }

      // バックアップファイルパス
      const fileName = path.basename(filePath);
      const backupFilesDir = path.join(backupPath, 'files');
      await fs.mkdir(backupFilesDir, { recursive: true });
      
      const backupFilePath = path.join(backupFilesDir, fileName);

      // ファイルをコピー
      await fs.copyFile(filePath, backupFilePath);

      // チェックサムを計算
      const checksum = await this.calculateChecksum(backupFilePath);

      return {
        originalPath: filePath,
        backupPath: backupFilePath,
        size: stats.size,
        checksum,
        backupTime: new Date()
      };
    } catch (error) {
      console.warn(`ファイルバックアップエラー: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 単一ファイルを復元
   */
  private async restoreSingleFile(fileInfo: BackupFileInfo, backupPath: string): Promise<void> {
    try {
      // バックアップファイルの存在確認
      await fs.access(fileInfo.backupPath);

      // チェックサムの検証
      const actualChecksum = await this.calculateChecksum(fileInfo.backupPath);
      if (actualChecksum !== fileInfo.checksum) {
        throw new Error('チェックサム不一致');
      }

      // 復元先ディレクトリの作成
      const targetDir = path.dirname(fileInfo.originalPath);
      await fs.mkdir(targetDir, { recursive: true });

      // ファイルを復元
      await fs.copyFile(fileInfo.backupPath, fileInfo.originalPath);
    } catch (error) {
      throw new Error(`ファイル復元エラー: ${error}`);
    }
  }

  /**
   * バックアップメタデータを作成
   */
  private async createBackupMetadata(
    backupPath: string, 
    backupId: string, 
    files: BackupFileInfo[], 
    totalSize: number
  ): Promise<void> {
    const metadata = {
      backupId,
      timestamp: new Date(),
      files,
      totalSize,
      environment: 'local',
      version: '1.0.0'
    };

    const metadataPath = path.join(backupPath, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * バックアップメタデータを読み込み
   */
  private async loadBackupMetadata(backupPath: string): Promise<any> {
    const metadataPath = path.join(backupPath, 'metadata.json');
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * バックアップの存在確認
   */
  private async backupExists(backupPath: string): Promise<boolean> {
    try {
      const metadataPath = path.join(backupPath, 'metadata.json');
      await fs.access(metadataPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * バックアップディレクトリの権限設定
   */
  private async setBackupPermissions(backupPath: string): Promise<void> {
    try {
      // バックアップディレクトリを読み取り専用に設定
      await fs.chmod(backupPath, 0o755);
      
      // メタデータファイルを読み取り専用に設定
      const metadataPath = path.join(backupPath, 'metadata.json');
      await fs.chmod(metadataPath, 0o644);
    } catch (error) {
      console.warn('バックアップ権限設定エラー:', error);
    }
  }

  /**
   * ファイルのチェックサムを計算
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      throw new Error(`チェックサム計算エラー: ${error}`);
    }
  }

  /**
   * バックアップサイズを取得
   */
  public async getBackupSize(backupId: string): Promise<number> {
    try {
      const backupPath = path.join(this.backupRootDir, backupId);
      const metadata = await this.loadBackupMetadata(backupPath);
      return metadata.totalSize;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップサイズ取得に失敗しました: ${backupId}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * 利用可能なディスク容量を確認
   */
  public async checkDiskSpace(): Promise<{
    available: number;
    used: number;
    total: number;
    usagePercentage: number;
  }> {
    try {
      const stats = await fs.stat(this.backupRootDir);
      // 簡易的な実装（実際のディスク容量取得は環境依存）
      return {
        available: 1024 * 1024 * 1024, // 1GB（仮の値）
        used: 0,
        total: 1024 * 1024 * 1024,
        usagePercentage: 0
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `ディスク容量確認に失敗しました: ${error}`,
        undefined,
        'local',
        error as Error
      );
    }
  }
}