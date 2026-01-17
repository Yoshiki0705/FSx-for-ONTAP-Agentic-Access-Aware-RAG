/**
 * 統合ファイル整理システム - EC2バックアップ管理
 * 
 * EC2環境でのSSH接続によるリモートファイルバックアップ作成、復元、管理機能を提供します。
 * SSH経由での安全なファイル操作をサポートします。
 */

import { exec } from 'child_process';
import { promisify } from 'util';
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
import { SSHConfig } from '../scanners/ec2-scanner.js';

const execAsync = promisify(exec);

/**
 * EC2バックアップ管理
 * 
 * SSH接続を使用してEC2環境でのファイルバックアップ機能を提供し、
 * リモート環境での安全なファイル操作をサポートします。
 */
export class EC2BackupManager implements BackupManager {
  private readonly sshConfig: SSHConfig;
  private readonly backupRootDir: string;
  private readonly maxBackupSize: number;

  constructor(
    sshConfig: SSHConfig,
    backupRootDir: string = '/home/ubuntu/backups',
    maxBackupSize: number = 1024 * 1024 * 1024 // 1GB
  ) {
    this.sshConfig = {
      port: 22,
      timeout: 30000,
      ...sshConfig
    };
    this.backupRootDir = backupRootDir;
    this.maxBackupSize = maxBackupSize;
  }

  /**
   * バックアップを作成
   */
  public async createBackup(files: string[], backupId: string): Promise<BackupResult> {
    const startTime = Date.now();
    console.log(`💾 EC2バックアップを作成中: ${backupId}`);

    try {
      // リモートバックアップディレクトリの作成
      const backupPath = path.posix.join(this.backupRootDir, backupId);
      const escapedBackupPath = this.escapeFilePath(backupPath);
      await this.executeSSHCommand(`mkdir -p ${escapedBackupPath}/files`);

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
      console.log(`✅ EC2バックアップ作成完了: ${backupFiles.length}ファイル (${processingTime}ms)`);

      return {
        backupId,
        timestamp: new Date(),
        files: backupFiles,
        totalSize,
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        environment: 'ec2',
        backupPath
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップ作成に失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * バックアップを復元
   */
  public async restoreBackup(backupId: string): Promise<RestoreResult> {
    const startTime = Date.now();
    console.log(`🔄 EC2バックアップを復元中: ${backupId}`);

    try {
      const backupPath = path.posix.join(this.backupRootDir, backupId);
      
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
      console.log(`✅ EC2バックアップ復元完了: ${restoredFiles.length}ファイル (${processingTime}ms)`);

      return {
        restoreId: `restore-${Date.now()}`,
        success: errors.length === 0,
        restoredFileCount: restoredFiles.length,
        restoredFiles,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        restoreTime: new Date(),
        environment: 'ec2'
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップ復元に失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * バックアップ一覧を取得
   */
  public async listBackups(): Promise<BackupInfo[]> {
    try {
      // リモートバックアップディレクトリの存在確認
      try {
        const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
        await this.executeSSHCommand(`test -d ${escapedBackupRootDir}`);
      } catch {
        return []; // ディレクトリが存在しない場合は空配列を返す
      }

      const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
      const { stdout } = await this.executeSSHCommand(`find ${escapedBackupRootDir} -maxdepth 1 -type d -not -path ${escapedBackupRootDir}`);
      const backupDirs = stdout.trim().split('\n').filter(line => line.length > 0);
      const backups: BackupInfo[] = [];

      for (const backupDir of backupDirs) {
        try {
          const backupId = path.basename(backupDir);
          const metadata = await this.loadBackupMetadata(backupDir);
          
          backups.push({
            backupId,
            createdAt: new Date(metadata.timestamp),
            fileCount: metadata.files.length,
            totalSize: metadata.totalSize,
            description: `EC2バックアップ (${metadata.files.length}ファイル)`,
            environment: 'ec2',
            backupPath: backupDir
          });
        } catch (error) {
          console.warn(`バックアップメタデータ読み込みエラー: ${backupDir}`, error);
        }
      }

      // 作成日時でソート（新しい順）
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップ一覧取得に失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * 古いバックアップを削除
   */
  public async cleanupOldBackups(retentionDays: number): Promise<void> {
    console.log(`🧹 EC2環境で${retentionDays}日より古いバックアップを削除中...`);

    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          try {
            await this.deleteBackup(backup.backupId);
            deletedCount++;
            console.log(`🗑️  古いEC2バックアップを削除: ${backup.backupId}`);
          } catch (error) {
            console.warn(`EC2バックアップ削除エラー: ${backup.backupId}`, error);
          }
        }
      }

      console.log(`✅ EC2バックアップクリーンアップ完了: ${deletedCount}個削除`);
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップクリーンアップに失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * バックアップを削除
   */
  public async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupPath = path.posix.join(this.backupRootDir, backupId);
      
      if (await this.backupExists(backupPath)) {
        const escapedBackupPath = this.escapeFilePath(backupPath);
        await this.executeSSHCommand(`rm -rf ${escapedBackupPath}`);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップ削除に失敗しました: ${backupId}`,
        undefined,
        'ec2',
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
      const backupPath = path.posix.join(this.backupRootDir, backupId);
      const metadata = await this.loadBackupMetadata(backupPath);
      const errors: string[] = [];
      let checkedFiles = 0;

      for (const fileInfo of metadata.files) {
        try {
          const backupFileName = path.basename(fileInfo.originalPath);
          const backupFilePath = path.posix.join(backupPath, 'files', backupFileName);
          
          // ファイルの存在確認
          const escapedBackupFilePath = this.escapeFilePath(backupFilePath);
          await this.executeSSHCommand(`test -f ${escapedBackupFilePath}`);
          
          // チェックサムの検証
          const actualChecksum = await this.calculateRemoteChecksum(backupFilePath);
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
        `EC2バックアップ検証に失敗しました: ${backupId}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * SSH接続テスト
   */
  public async testConnection(): Promise<boolean> {
    try {
      const { stdout } = await this.executeSSHCommand('echo "connection_test"');
      return stdout.trim() === 'connection_test';
    } catch (error) {
      console.error('EC2 SSH接続テストに失敗しました:', error);
      return false;
    }
  }

  /**
   * ファイルパスをSSHコマンド用にエスケープ
   */
  private escapeFilePath(filePath: string): string {
    // シングルクォートでエスケープし、内部のシングルクォートは特別処理
    return `'${filePath.replace(/'/g, "'\"'\"'")}'`;
  }

  /**
   * 単一ファイルをバックアップ
   */
  private async backupSingleFile(filePath: string, backupPath: string): Promise<BackupFileInfo | null> {
    try {
      // ファイルパスをエスケープ
      const escapedFilePath = this.escapeFilePath(filePath);
      
      // ファイルの存在確認とサイズ取得
      const { stdout: statOutput } = await this.executeSSHCommand(`stat -c "%s" ${escapedFilePath} 2>/dev/null || echo "ERROR"`);
      
      if (statOutput.trim() === 'ERROR') {
        return null;
      }

      const fileSize = parseInt(statOutput.trim(), 10);
      const fileName = path.basename(filePath);
      const backupFilePath = path.posix.join(backupPath, 'files', fileName);
      const escapedBackupFilePath = this.escapeFilePath(backupFilePath);

      // ファイルをコピー
      await this.executeSSHCommand(`cp ${escapedFilePath} ${escapedBackupFilePath}`);

      // チェックサムを計算
      const checksum = await this.calculateRemoteChecksum(backupFilePath);

      return {
        originalPath: filePath,
        backupPath: backupFilePath,
        size: fileSize,
        checksum,
        backupTime: new Date()
      };
    } catch (error) {
      console.warn(`EC2ファイルバックアップエラー: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 単一ファイルを復元
   */
  private async restoreSingleFile(fileInfo: BackupFileInfo, backupPath: string): Promise<void> {
    try {
      // ファイルパスをエスケープ
      const escapedBackupPath = this.escapeFilePath(fileInfo.backupPath);
      const escapedOriginalPath = this.escapeFilePath(fileInfo.originalPath);
      
      // バックアップファイルの存在確認
      await this.executeSSHCommand(`test -f ${escapedBackupPath}`);

      // チェックサムの検証
      const actualChecksum = await this.calculateRemoteChecksum(fileInfo.backupPath);
      if (actualChecksum !== fileInfo.checksum) {
        throw new Error('チェックサム不一致');
      }

      // 復元先ディレクトリの作成
      const targetDir = path.dirname(fileInfo.originalPath);
      const escapedTargetDir = this.escapeFilePath(targetDir);
      await this.executeSSHCommand(`mkdir -p ${escapedTargetDir}`);

      // ファイルを復元
      await this.executeSSHCommand(`cp ${escapedBackupPath} ${escapedOriginalPath}`);
    } catch (error) {
      throw new Error(`EC2ファイル復元エラー: ${error}`);
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
      environment: 'ec2',
      version: '1.0.0'
    };

    const metadataContent = JSON.stringify(metadata, null, 2);
    const metadataPath = path.posix.join(backupPath, 'metadata.json');
    
    // リモートファイルに書き込み
    const escapedMetadataPath = this.escapeFilePath(metadataPath);
    await this.executeSSHCommand(`cat > ${escapedMetadataPath} << 'EOF'\n${metadataContent}\nEOF`);
  }

  /**
   * バックアップメタデータを読み込み
   */
  private async loadBackupMetadata(backupPath: string): Promise<any> {
    const metadataPath = path.posix.join(backupPath, 'metadata.json');
    const escapedMetadataPath = this.escapeFilePath(metadataPath);
    const { stdout } = await this.executeSSHCommand(`cat ${escapedMetadataPath}`);
    return JSON.parse(stdout);
  }

  /**
   * バックアップの存在確認
   */
  private async backupExists(backupPath: string): Promise<boolean> {
    try {
      const metadataPath = path.posix.join(backupPath, 'metadata.json');
      const escapedMetadataPath = this.escapeFilePath(metadataPath);
      await this.executeSSHCommand(`test -f ${escapedMetadataPath}`);
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
      // バックアップディレクトリの権限設定
      const escapedBackupPath = this.escapeFilePath(backupPath);
      await this.executeSSHCommand(`chmod 755 ${escapedBackupPath}`);
      
      // メタデータファイルの権限設定
      const metadataPath = path.posix.join(backupPath, 'metadata.json');
      const escapedMetadataPath = this.escapeFilePath(metadataPath);
      await this.executeSSHCommand(`chmod 644 ${escapedMetadataPath}`);
      
      // バックアップファイルディレクトリの権限設定
      const filesPath = path.posix.join(backupPath, 'files');
      const escapedFilesPath = this.escapeFilePath(filesPath);
      await this.executeSSHCommand(`chmod -R 644 ${escapedFilesPath}`);
    } catch (error) {
      console.warn('EC2バックアップ権限設定エラー:', error);
    }
  }

  /**
   * リモートファイルのチェックサムを計算
   */
  private async calculateRemoteChecksum(filePath: string): Promise<string> {
    try {
      const escapedFilePath = this.escapeFilePath(filePath);
      const { stdout } = await this.executeSSHCommand(`sha256sum ${escapedFilePath} | cut -d' ' -f1`);
      return stdout.trim();
    } catch (error) {
      throw new Error(`リモートチェックサム計算エラー: ${error}`);
    }
  }

  /**
   * SSH コマンドを実行
   */
  private async executeSSHCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const sshCommand = `ssh -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout! / 1000} -o StrictHostKeyChecking=no -p ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host} "${command}"`;
    
    try {
      const result = await execAsync(sshCommand, { 
        timeout: this.sshConfig.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });
      return result;
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT') {
        throw new OrganizationError(
          OrganizationErrorType.SSH_CONNECTION_FAILED,
          `SSH接続がタイムアウトしました: ${this.sshConfig.host}`,
          undefined,
          'ec2',
          error
        );
      }
      throw error;
    }
  }

  /**
   * EC2環境のディスク使用量を確認
   */
  public async checkDiskSpace(): Promise<{
    available: number;
    used: number;
    total: number;
    usagePercentage: number;
  }> {
    try {
      const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
      const { stdout } = await this.executeSSHCommand(`df ${escapedBackupRootDir} | tail -1 | awk '{print $2,$3,$4,$5}' | sed 's/%//'`);
      const [total, used, available, usagePercentage] = stdout.trim().split(' ').map(Number);
      
      return {
        available: available * 1024, // KB to bytes
        used: used * 1024,
        total: total * 1024,
        usagePercentage
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2ディスク容量確認に失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * バックアップサイズを取得
   */
  public async getBackupSize(backupId: string): Promise<number> {
    try {
      const backupPath = path.posix.join(this.backupRootDir, backupId);
      const metadata = await this.loadBackupMetadata(backupPath);
      return metadata.totalSize;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップサイズ取得に失敗しました: ${backupId}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * バックアップの圧縮
   */
  public async compressBackup(backupId: string): Promise<void> {
    try {
      const backupPath = path.posix.join(this.backupRootDir, backupId);
      const compressedPath = `${backupPath}.tar.gz`;
      
      // バックアップディレクトリを圧縮
      const escapedCompressedPath = this.escapeFilePath(compressedPath);
      const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
      const escapedBackupId = this.escapeFilePath(backupId);
      const escapedBackupPath = this.escapeFilePath(backupPath);
      await this.executeSSHCommand(`tar -czf ${escapedCompressedPath} -C ${escapedBackupRootDir} ${escapedBackupId}`);
      
      // 元のディレクトリを削除
      await this.executeSSHCommand(`rm -rf ${escapedBackupPath}`);
      
      console.log(`✅ EC2バックアップを圧縮しました: ${backupId}`);
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップ圧縮に失敗しました: ${backupId}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * 圧縮されたバックアップを展開
   */
  public async decompressBackup(backupId: string): Promise<void> {
    try {
      const compressedPath = path.posix.join(this.backupRootDir, `${backupId}.tar.gz`);
      
      // 圧縮ファイルを展開
      const escapedCompressedPath = this.escapeFilePath(compressedPath);
      const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
      await this.executeSSHCommand(`tar -xzf ${escapedCompressedPath} -C ${escapedBackupRootDir}`);
      
      // 圧縮ファイルを削除
      await this.executeSSHCommand(`rm -f ${escapedCompressedPath}`);
      
      console.log(`✅ EC2バックアップを展開しました: ${backupId}`);
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `EC2バックアップ展開に失敗しました: ${backupId}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }
}