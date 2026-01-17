/**
 * 統合ファイル整理システム - 同期マネージャー
 * 
 * 環境間同期実行機能を提供し、
 * 整合性検証とレポート生成を実行します。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  Environment,
  FileInfo,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { StructureComparator, StructureComparison, StructureDifference } from './structure-comparator.js';
import { DirectoryCreator } from '../structure/directory-creator.js';

const execAsync = promisify(exec);

/**
 * 同期オプション
 */
export interface SyncOptions {
  /** 同期方向 */
  direction: 'local_to_ec2' | 'ec2_to_local' | 'bidirectional';
  /** ドライランモード */
  dryRun: boolean;
  /** 既存ファイルを上書きするか */
  overwriteExisting: boolean;
  /** 権限も同期するか */
  syncPermissions: boolean;
  /** バックアップを作成するか */
  createBackup: boolean;
  /** 除外パターン */
  excludePatterns: string[];
  /** 同期対象のファイルタイプ */
  includeFileTypes?: string[];
}

/**
 * 同期結果
 */
export interface SyncResult {
  /** 同期ID */
  syncId: string;
  /** 同期時刻 */
  syncTime: Date;
  /** 成功したかどうか */
  success: boolean;
  /** 同期方向 */
  direction: string;
  /** 同期統計 */
  statistics: SyncStatistics;
  /** 同期されたアイテム */
  syncedItems: SyncedItem[];
  /** 失敗したアイテム */
  failedItems: FailedItem[];
  /** エラー */
  errors: string[];
  /** 処理時間 */
  processingTime: number;
}

/**
 * 同期統計
 */
export interface SyncStatistics {
  /** 処理したディレクトリ数 */
  processedDirectories: number;
  /** 処理したファイル数 */
  processedFiles: number;
  /** 作成したディレクトリ数 */
  createdDirectories: number;
  /** 同期したファイル数 */
  syncedFiles: number;
  /** 削除したアイテム数 */
  deletedItems: number;
  /** 権限を更新したアイテム数 */
  permissionUpdates: number;
  /** 総データサイズ */
  totalDataSize: number;
  /** スキップしたアイテム数 */
  skippedItems: number;
}

/**
 * 同期されたアイテム
 */
export interface SyncedItem {
  /** アイテムタイプ */
  type: 'directory' | 'file';
  /** ソースパス */
  sourcePath: string;
  /** ターゲットパス */
  targetPath: string;
  /** アクション */
  action: 'created' | 'updated' | 'deleted' | 'permission_updated';
  /** サイズ（ファイルの場合） */
  size?: number;
  /** 処理時間 */
  processingTime: number;
}

/**
 * 失敗したアイテム
 */
export interface FailedItem {
  /** アイテムパス */
  path: string;
  /** エラーメッセージ */
  error: string;
  /** 試行回数 */
  attempts: number;
}

/**
 * 整合性検証結果
 */
export interface ConsistencyVerification {
  /** 検証ID */
  verificationId: string;
  /** 検証時刻 */
  verificationTime: Date;
  /** 整合性が取れているか */
  isConsistent: boolean;
  /** 不整合項目 */
  inconsistencies: InconsistencyItem[];
  /** 検証統計 */
  statistics: {
    totalItems: number;
    consistentItems: number;
    inconsistentItems: number;
    verificationTime: number;
  };
}

/**
 * 不整合項目
 */
export interface InconsistencyItem {
  /** パス */
  path: string;
  /** 不整合タイプ */
  type: 'missing' | 'size_mismatch' | 'permission_mismatch' | 'content_mismatch';
  /** 詳細 */
  details: string;
  /** 重要度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 同期マネージャー
 * 
 * 環境間の同期実行と整合性検証を提供します。
 */
export class SyncManager {
  private readonly structureComparator: StructureComparator;
  private readonly directoryCreator: DirectoryCreator;
  private readonly sshConfig?: SSHConfig;
  private readonly maxRetries: number = 3;

  constructor(sshConfig?: SSHConfig) {
    this.sshConfig = sshConfig;
    this.structureComparator = new StructureComparator(sshConfig);
    this.directoryCreator = new DirectoryCreator({} as any, sshConfig); // 簡略化
  }

  /**
   * 環境間同期を実行
   */
  public async executeSync(
    localRootPath: string = '.',
    ec2RootPath: string = '/home/ubuntu',
    options: SyncOptions = {
      direction: 'bidirectional',
      dryRun: false,
      overwriteExisting: false,
      syncPermissions: true,
      createBackup: true,
      excludePatterns: ['node_modules', '.git', 'cdk.out']
    }
  ): Promise<SyncResult> {
    const syncId = `sync-${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`🔄 環境間同期を開始: ${options.direction} (${options.dryRun ? 'ドライラン' : '実行'})`);

    try {
      // 事前構造比較
      const comparison = await this.structureComparator.compareStructures(localRootPath, ec2RootPath);
      console.log(`📊 事前比較完了: 一致率${comparison.matchPercentage.toFixed(1)}%, 差分${comparison.differences.length}個`);

      // バックアップ作成（オプション）
      if (options.createBackup && !options.dryRun) {
        await this.createSyncBackup(localRootPath, ec2RootPath);
      }

      // 同期実行
      const syncResult = await this.performSync(comparison, options, syncId, startTime);

      // 事後検証
      if (!options.dryRun && syncResult.success) {
        await this.verifySyncResult(localRootPath, ec2RootPath, syncResult);
      }

      console.log(`${syncResult.success ? '✅' : '⚠️'} 環境間同期完了: ${syncResult.statistics.syncedFiles}ファイル同期 (${syncResult.processingTime}ms)`);

      return syncResult;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SYNC_FAILED,
        `環境間同期に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 同期を実行
   */
  private async performSync(
    comparison: StructureComparison,
    options: SyncOptions,
    syncId: string,
    startTime: number
  ): Promise<SyncResult> {
    const syncedItems: SyncedItem[] = [];
    const failedItems: FailedItem[] = [];
    const errors: string[] = [];

    // 同期対象の差分をフィルタリング
    const targetDifferences = this.filterSyncTargets(comparison.differences, options);

    console.log(`🎯 同期対象: ${targetDifferences.length}個の差分`);

    // 差分を処理
    for (const difference of targetDifferences) {
      try {
        const result = await this.processSyncDifference(difference, options);
        if (result) {
          syncedItems.push(result);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        failedItems.push({
          path: difference.path,
          error: errorMsg,
          attempts: 1
        });
        errors.push(`${difference.path}: ${errorMsg}`);
      }
    }

    // 統計情報の生成
    const statistics = this.generateSyncStatistics(syncedItems, failedItems);
    const processingTime = Date.now() - startTime;

    return {
      syncId,
      syncTime: new Date(),
      success: failedItems.length === 0,
      direction: options.direction,
      statistics,
      syncedItems,
      failedItems,
      errors,
      processingTime
    };
  }

  /**
   * 同期対象をフィルタリング
   */
  private filterSyncTargets(differences: StructureDifference[], options: SyncOptions): StructureDifference[] {
    return differences.filter(diff => {
      // 除外パターンのチェック
      for (const pattern of options.excludePatterns) {
        if (diff.path.includes(pattern)) {
          return false;
        }
      }

      // 同期方向のチェック
      if (options.direction === 'local_to_ec2' && diff.environment === 'local') {
        return false;
      }
      if (options.direction === 'ec2_to_local' && diff.environment === 'ec2') {
        return false;
      }

      // ファイルタイプのチェック
      if (options.includeFileTypes && options.includeFileTypes.length > 0) {
        const ext = path.extname(diff.path);
        if (!options.includeFileTypes.includes(ext)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 個別差分を処理
   */
  private async processSyncDifference(
    difference: StructureDifference,
    options: SyncOptions
  ): Promise<SyncedItem | null> {
    const itemStartTime = Date.now();

    if (options.dryRun) {
      console.log(`🔍 [ドライラン] ${difference.type}: ${difference.path}`);
      return {
        type: difference.type.includes('directory') ? 'directory' : 'file',
        sourcePath: difference.path,
        targetPath: difference.path,
        action: 'created', // 仮の値
        processingTime: Date.now() - itemStartTime
      };
    }

    switch (difference.type) {
      case 'missing_directory':
        return await this.syncMissingDirectory(difference, options, itemStartTime);
      
      case 'missing_file':
        return await this.syncMissingFile(difference, options, itemStartTime);
      
      case 'permission_mismatch':
        return await this.syncPermissions(difference, options, itemStartTime);
      
      case 'size_mismatch':
        return await this.syncFileContent(difference, options, itemStartTime);
      
      default:
        console.warn(`⚠️ 未対応の差分タイプ: ${difference.type}`);
        return null;
    }
  }

  /**
   * 不足ディレクトリを同期
   */
  private async syncMissingDirectory(
    difference: StructureDifference,
    options: SyncOptions,
    startTime: number
  ): Promise<SyncedItem> {
    const targetEnv = difference.environment;
    
    if (targetEnv === 'ec2') {
      await this.executeSSHCommand(`mkdir -p "${difference.path}"`);
    } else {
      await fs.mkdir(difference.path, { recursive: true });
    }

    console.log(`📁 ディレクトリ作成: ${difference.path} (${targetEnv})`);

    return {
      type: 'directory',
      sourcePath: difference.path,
      targetPath: difference.path,
      action: 'created',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * 不足ファイルを同期
   */
  private async syncMissingFile(
    difference: StructureDifference,
    options: SyncOptions,
    startTime: number
  ): Promise<SyncedItem> {
    const targetEnv = difference.environment;
    
    if (targetEnv === 'ec2') {
      // ローカルからEC2へ
      await this.copyFileToEC2(difference.path, difference.path);
    } else {
      // EC2からローカルへ
      await this.copyFileFromEC2(difference.path, difference.path);
    }

    console.log(`📄 ファイル同期: ${difference.path} → ${targetEnv}`);

    return {
      type: 'file',
      sourcePath: difference.path,
      targetPath: difference.path,
      action: 'created',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * 権限を同期
   */
  private async syncPermissions(
    difference: StructureDifference,
    options: SyncOptions,
    startTime: number
  ): Promise<SyncedItem | null> {
    if (!options.syncPermissions) {
      return null;
    }

    const targetEnv = difference.environment;
    const expectedPermissions = difference.details.expected;

    if (targetEnv === 'ec2') {
      await this.executeSSHCommand(`chmod ${expectedPermissions} "${difference.path}"`);
    } else {
      await fs.chmod(difference.path, parseInt(expectedPermissions, 8));
    }

    console.log(`🔒 権限同期: ${difference.path} → ${expectedPermissions} (${targetEnv})`);

    return {
      type: 'file',
      sourcePath: difference.path,
      targetPath: difference.path,
      action: 'permission_updated',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * ファイル内容を同期
   */
  private async syncFileContent(
    difference: StructureDifference,
    options: SyncOptions,
    startTime: number
  ): Promise<SyncedItem> {
    const targetEnv = difference.environment;
    
    if (!options.overwriteExisting) {
      throw new Error(`ファイル上書きが無効です: ${difference.path}`);
    }

    if (targetEnv === 'ec2') {
      await this.copyFileToEC2(difference.path, difference.path);
    } else {
      await this.copyFileFromEC2(difference.path, difference.path);
    }

    console.log(`🔄 ファイル更新: ${difference.path} (${targetEnv})`);

    return {
      type: 'file',
      sourcePath: difference.path,
      targetPath: difference.path,
      action: 'updated',
      size: difference.details.expected || 0,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * ローカルファイルをEC2にコピー
   */
  private async copyFileToEC2(localPath: string, ec2Path: string): Promise<void> {
    if (!this.sshConfig) {
      throw new Error('SSH設定が必要です');
    }

    const scpCommand = `scp -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout! / 1000} -o StrictHostKeyChecking=no -P ${this.sshConfig.port} "${localPath}" ${this.sshConfig.user}@${this.sshConfig.host}:"${ec2Path}"`;
    
    await execAsync(scpCommand, { timeout: this.sshConfig.timeout });
  }

  /**
   * EC2ファイルをローカルにコピー
   */
  private async copyFileFromEC2(ec2Path: string, localPath: string): Promise<void> {
    if (!this.sshConfig) {
      throw new Error('SSH設定が必要です');
    }

    // ローカルディレクトリを作成
    const localDir = path.dirname(localPath);
    await fs.mkdir(localDir, { recursive: true });

    const scpCommand = `scp -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout! / 1000} -o StrictHostKeyChecking=no -P ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host}:"${ec2Path}" "${localPath}"`;
    
    await execAsync(scpCommand, { timeout: this.sshConfig.timeout });
  }

  /**
   * 同期統計を生成
   */
  private generateSyncStatistics(syncedItems: SyncedItem[], failedItems: FailedItem[]): SyncStatistics {
    const directories = syncedItems.filter(item => item.type === 'directory');
    const files = syncedItems.filter(item => item.type === 'file');
    
    return {
      processedDirectories: directories.length,
      processedFiles: files.length,
      createdDirectories: directories.filter(item => item.action === 'created').length,
      syncedFiles: files.filter(item => item.action === 'created' || item.action === 'updated').length,
      deletedItems: syncedItems.filter(item => item.action === 'deleted').length,
      permissionUpdates: syncedItems.filter(item => item.action === 'permission_updated').length,
      totalDataSize: files.reduce((sum, item) => sum + (item.size || 0), 0),
      skippedItems: failedItems.length
    };
  }

  /**
   * 同期バックアップを作成
   */
  private async createSyncBackup(localRootPath: string, ec2RootPath: string): Promise<void> {
    console.log('💾 同期前バックアップを作成中...');
    
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // ローカルバックアップ
    const localBackupPath = `backup-local-${backupTimestamp}`;
    await execAsync(`cp -r "${localRootPath}" "${localBackupPath}"`);
    
    // EC2バックアップ
    const ec2BackupPath = `/tmp/backup-ec2-${backupTimestamp}`;
    await this.executeSSHCommand(`cp -r "${ec2RootPath}" "${ec2BackupPath}"`);
    
    console.log('✅ 同期前バックアップ作成完了');
  }

  /**
   * 同期結果を検証
   */
  private async verifySyncResult(
    localRootPath: string,
    ec2RootPath: string,
    syncResult: SyncResult
  ): Promise<void> {
    console.log('🔍 同期結果を検証中...');
    
    const postComparison = await this.structureComparator.compareStructures(localRootPath, ec2RootPath);
    
    if (postComparison.matchPercentage > 95) {
      console.log(`✅ 同期検証成功: 一致率${postComparison.matchPercentage.toFixed(1)}%`);
    } else {
      console.warn(`⚠️ 同期検証で問題を検出: 一致率${postComparison.matchPercentage.toFixed(1)}%`);
    }
  }

  /**
   * 整合性検証を実行
   */
  public async verifyConsistency(
    localRootPath: string = '.',
    ec2RootPath: string = '/home/ubuntu'
  ): Promise<ConsistencyVerification> {
    const verificationId = `verification-${Date.now()}`;
    const startTime = Date.now();
    
    console.log('🔍 環境間整合性検証を開始...');

    try {
      const comparison = await this.structureComparator.compareStructures(localRootPath, ec2RootPath);
      
      const inconsistencies: InconsistencyItem[] = comparison.differences.map(diff => ({
        path: diff.path,
        type: this.mapDifferenceToInconsistency(diff.type),
        details: diff.details.description,
        severity: diff.severity
      }));

      const verificationTime = Date.now() - startTime;
      const isConsistent = inconsistencies.length === 0;

      console.log(`${isConsistent ? '✅' : '⚠️'} 整合性検証完了: ${inconsistencies.length}個の不整合 (${verificationTime}ms)`);

      return {
        verificationId,
        verificationTime: new Date(),
        isConsistent,
        inconsistencies,
        statistics: {
          totalItems: comparison.summary.totalItems,
          consistentItems: comparison.summary.matchingItems,
          inconsistentItems: inconsistencies.length,
          verificationTime
        }
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.VALIDATION_FAILED,
        `整合性検証に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 差分タイプを不整合タイプにマップ
   */
  private mapDifferenceToInconsistency(diffType: string): 'missing' | 'size_mismatch' | 'permission_mismatch' | 'content_mismatch' {
    switch (diffType) {
      case 'missing_directory':
      case 'missing_file':
      case 'extra_directory':
      case 'extra_file':
        return 'missing';
      case 'size_mismatch':
        return 'size_mismatch';
      case 'permission_mismatch':
        return 'permission_mismatch';
      case 'content_mismatch':
        return 'content_mismatch';
      default:
        return 'missing';
    }
  }

  /**
   * 同期レポートを生成
   */
  public generateSyncReport(syncResult: SyncResult): string {
    const { statistics, syncedItems, failedItems } = syncResult;
    const successRate = Math.round(((statistics.syncedFiles + statistics.createdDirectories) / 
      (statistics.processedFiles + statistics.processedDirectories)) * 100);

    return `
# 環境間同期レポート

## 同期サマリー
- **同期日時**: ${syncResult.syncTime.toLocaleString('ja-JP')}
- **同期ID**: ${syncResult.syncId}
- **同期方向**: ${syncResult.direction}
- **成功**: ${syncResult.success ? 'はい' : 'いいえ'}
- **処理時間**: ${Math.round(syncResult.processingTime / 1000)}秒

## 同期統計
- **処理ディレクトリ数**: ${statistics.processedDirectories}個
- **処理ファイル数**: ${statistics.processedFiles}個
- **作成ディレクトリ数**: ${statistics.createdDirectories}個
- **同期ファイル数**: ${statistics.syncedFiles}個
- **権限更新数**: ${statistics.permissionUpdates}個
- **総データサイズ**: ${Math.round(statistics.totalDataSize / 1024 / 1024)}MB
- **成功率**: ${successRate}%

## 同期されたアイテム（上位10件）
${syncedItems.slice(0, 10).map(item => 
  `- **${item.type}**: ${item.sourcePath} (${item.action})`
).join('\n') || '- 同期アイテムなし'}
${syncedItems.length > 10 ? `\n... 他${syncedItems.length - 10}個` : ''}

## 失敗したアイテム
${failedItems.map(item => 
  `- **${item.path}**: ${item.error}`
).join('\n') || '- 失敗なし'}

## パフォーマンス
- **平均処理時間**: ${Math.round(syncResult.processingTime / (statistics.processedFiles + statistics.processedDirectories))}ms/アイテム
- **スループット**: ${Math.round((statistics.processedFiles + statistics.processedDirectories) / (syncResult.processingTime / 1000))}アイテム/秒
- **データ転送速度**: ${Math.round(statistics.totalDataSize / 1024 / (syncResult.processingTime / 1000))}KB/秒

## エラー詳細
${syncResult.errors.length > 0 ? 
  syncResult.errors.map(error => `- ${error}`).join('\n') : 
  '- エラーなし'
}
`;
  }

  /**
   * SSH コマンドを実行
   */
  private async executeSSHCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.sshConfig) {
      throw new Error('SSH設定が必要です');
    }

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
}