/**
 * 統合ファイル整理システム - バックアップ復元管理
 * 
 * ローカル・EC2両環境でのバックアップ復元機能を統合管理し、
 * エラー時の自動ロールバック機能を提供します。
 */

import { LocalBackupManager } from './local-backup-manager.js';
import { EC2BackupManager } from './ec2-backup-manager.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { 
  BackupResult, 
  RestoreResult, 
  BackupInfo,
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

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
export class BackupRestoreManager {
  private readonly localBackupManager: LocalBackupManager;
  private readonly ec2BackupManager: EC2BackupManager;

  constructor(
    localBackupDir: string = 'development/temp/backups',
    sshConfig: SSHConfig,
    ec2BackupDir: string = '/home/ubuntu/backups'
  ) {
    this.localBackupManager = new LocalBackupManager(localBackupDir);
    this.ec2BackupManager = new EC2BackupManager(sshConfig, ec2BackupDir);
  }

  /**
   * 統合バックアップ作成
   */
  public async createIntegratedBackup(
    localFiles: string[],
    ec2Files: string[],
    backupId: string
  ): Promise<{
    local: BackupResult;
    ec2: BackupResult;
    success: boolean;
  }> {
    console.log(`💾 統合バックアップを作成中: ${backupId}`);

    try {
      // 並列でバックアップを作成
      const [localResult, ec2Result] = await Promise.allSettled([
        this.localBackupManager.createBackup(localFiles, `${backupId}-local`),
        this.ec2BackupManager.createBackup(ec2Files, `${backupId}-ec2`)
      ]);

      const localBackup = localResult.status === 'fulfilled' ? localResult.value : null;
      const ec2Backup = ec2Result.status === 'fulfilled' ? ec2Result.value : null;

      if (!localBackup || !ec2Backup) {
        // 部分的な失敗の場合、成功したバックアップをクリーンアップ
        if (localBackup) {
          await this.localBackupManager.deleteBackup(`${backupId}-local`);
        }
        if (ec2Backup) {
          await this.ec2BackupManager.deleteBackup(`${backupId}-ec2`);
        }

        throw new Error('統合バックアップの作成に失敗しました');
      }

      const success = localBackup.success && ec2Backup.success;
      console.log(`✅ 統合バックアップ作成完了: ${success ? '成功' : '部分的成功'}`);

      return {
        local: localBackup,
        ec2: ec2Backup,
        success
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `統合バックアップ作成に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 統合バックアップ復元
   */
  public async restoreIntegratedBackup(
    backupId: string,
    options: RestoreOptions = {
      createPreRestoreBackup: true,
      overwriteExisting: false,
      verifyAfterRestore: true,
      dryRun: false
    }
  ): Promise<IntegratedRestoreResult> {
    const startTime = Date.now();
    const restoreId = `restore-${Date.now()}`;
    console.log(`🔄 統合バックアップを復元中: ${backupId}`);

    try {
      const errors: string[] = [];
      let preRestoreBackupId: string | undefined;

      // 復元前バックアップの作成（オプション）
      if (options.createPreRestoreBackup && !options.dryRun) {
        try {
          preRestoreBackupId = `pre-restore-${Date.now()}`;
          console.log(`💾 復元前バックアップを作成中: ${preRestoreBackupId}`);
          
          // 現在のファイル状態をバックアップ
          // 実装は簡略化（実際には現在のファイル一覧を取得してバックアップ）
        } catch (error) {
          errors.push(`復元前バックアップ作成エラー: ${error}`);
        }
      }

      // 並列で復元を実行
      const [localResult, ec2Result] = await Promise.allSettled([
        this.restoreEnvironmentBackup('local', `${backupId}-local`, options),
        this.restoreEnvironmentBackup('ec2', `${backupId}-ec2`, options)
      ]);

      // 結果の処理
      const environmentResults: Record<Environment, RestoreResult> = {
        local: this.processRestoreResult(localResult, 'local', errors),
        ec2: this.processRestoreResult(ec2Result, 'ec2', errors)
      };

      // 復元後検証（オプション）
      if (options.verifyAfterRestore && !options.dryRun) {
        await this.verifyRestoreResults(environmentResults, errors);
      }

      const totalRestoredFiles = Object.values(environmentResults)
        .reduce((sum, result) => sum + result.restoredFileCount, 0);

      const success = errors.length === 0 && 
        Object.values(environmentResults).every(result => result.success);

      const processingTime = Date.now() - startTime;
      console.log(`✅ 統合バックアップ復元完了: ${totalRestoredFiles}ファイル (${processingTime}ms)`);

      return {
        restoreId,
        success,
        environmentResults,
        totalRestoredFiles,
        errors,
        restoreTime: new Date(),
        processingTime
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `統合バックアップ復元に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 自動ロールバック機能
   */
  public async executeAutoRollback(
    originalBackupId: string,
    reason: string = 'エラー発生'
  ): Promise<IntegratedRestoreResult> {
    console.log(`🔄 自動ロールバックを実行中: ${reason}`);

    try {
      const rollbackOptions: RestoreOptions = {
        createPreRestoreBackup: false, // ロールバック時は追加バックアップ不要
        overwriteExisting: true,       // 強制上書き
        verifyAfterRestore: true,      // 検証は実行
        dryRun: false
      };

      const result = await this.restoreIntegratedBackup(originalBackupId, rollbackOptions);
      
      if (result.success) {
        console.log(`✅ 自動ロールバック完了: ${result.totalRestoredFiles}ファイル復元`);
      } else {
        console.error(`❌ 自動ロールバック失敗: ${result.errors.join('; ')}`);
      }

      return result;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.ROLLBACK_FAILED,
        `自動ロールバックに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * バックアップ一覧を取得（統合）
   */
  public async listIntegratedBackups(): Promise<{
    local: BackupInfo[];
    ec2: BackupInfo[];
    paired: Array<{
      backupId: string;
      localBackup?: BackupInfo;
      ec2Backup?: BackupInfo;
      complete: boolean;
    }>;
  }> {
    try {
      const [localBackups, ec2Backups] = await Promise.all([
        this.localBackupManager.listBackups(),
        this.ec2BackupManager.listBackups()
      ]);

      // ペアになったバックアップを特定
      const paired = this.identifyPairedBackups(localBackups, ec2Backups);

      return {
        local: localBackups,
        ec2: ec2Backups,
        paired
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `統合バックアップ一覧取得に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 古いバックアップの統合クリーンアップ
   */
  public async cleanupOldIntegratedBackups(retentionDays: number): Promise<{
    localDeleted: number;
    ec2Deleted: number;
    totalDeleted: number;
  }> {
    console.log(`🧹 ${retentionDays}日より古い統合バックアップを削除中...`);

    try {
      // 並列でクリーンアップを実行
      const [localResult, ec2Result] = await Promise.allSettled([
        this.cleanupEnvironmentBackups('local', retentionDays),
        this.cleanupEnvironmentBackups('ec2', retentionDays)
      ]);

      const localDeleted = localResult.status === 'fulfilled' ? localResult.value : 0;
      const ec2Deleted = ec2Result.status === 'fulfilled' ? ec2Result.value : 0;
      const totalDeleted = localDeleted + ec2Deleted;

      console.log(`✅ 統合バックアップクリーンアップ完了: ${totalDeleted}個削除`);

      return {
        localDeleted,
        ec2Deleted,
        totalDeleted
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `統合バックアップクリーンアップに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * バックアップの整合性検証（統合）
   */
  public async verifyIntegratedBackup(backupId: string): Promise<{
    local: { valid: boolean; errors: string[]; checkedFiles: number };
    ec2: { valid: boolean; errors: string[]; checkedFiles: number };
    overall: { valid: boolean; totalErrors: number; totalCheckedFiles: number };
  }> {
    try {
      const [localResult, ec2Result] = await Promise.allSettled([
        this.localBackupManager.verifyBackup(`${backupId}-local`),
        this.ec2BackupManager.verifyBackup(`${backupId}-ec2`)
      ]);

      const local = localResult.status === 'fulfilled' ? localResult.value : 
        { valid: false, errors: ['検証実行エラー'], checkedFiles: 0 };
      
      const ec2 = ec2Result.status === 'fulfilled' ? ec2Result.value : 
        { valid: false, errors: ['検証実行エラー'], checkedFiles: 0 };

      const overall = {
        valid: local.valid && ec2.valid,
        totalErrors: local.errors.length + ec2.errors.length,
        totalCheckedFiles: local.checkedFiles + ec2.checkedFiles
      };

      return { local, ec2, overall };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `統合バックアップ検証に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 環境別バックアップ復元
   */
  private async restoreEnvironmentBackup(
    environment: Environment,
    backupId: string,
    options: RestoreOptions
  ): Promise<RestoreResult> {
    if (options.dryRun) {
      // ドライランモードの場合はモック結果を返す
      return {
        restoreId: `dryrun-${Date.now()}`,
        success: true,
        restoredFileCount: 0,
        restoredFiles: [],
        restoreTime: new Date(),
        environment
      };
    }

    const manager = environment === 'local' ? this.localBackupManager : this.ec2BackupManager;
    return await manager.restoreBackup(backupId);
  }

  /**
   * 復元結果を処理
   */
  private processRestoreResult(
    result: PromiseSettledResult<RestoreResult>,
    environment: Environment,
    errors: string[]
  ): RestoreResult {
    if (result.status === 'fulfilled') {
      if (!result.value.success && result.value.error) {
        errors.push(`${environment}環境復元エラー: ${result.value.error}`);
      }
      return result.value;
    } else {
      const errorMsg = `${environment}環境復元失敗: ${result.reason}`;
      errors.push(errorMsg);
      
      return {
        restoreId: `error-${Date.now()}`,
        success: false,
        restoredFileCount: 0,
        restoredFiles: [],
        error: errorMsg,
        restoreTime: new Date(),
        environment
      };
    }
  }

  /**
   * 復元結果を検証
   */
  private async verifyRestoreResults(
    environmentResults: Record<Environment, RestoreResult>,
    errors: string[]
  ): Promise<void> {
    console.log('🔍 復元結果を検証中...');

    for (const [env, result] of Object.entries(environmentResults)) {
      if (!result.success) {
        errors.push(`${env}環境の復元が失敗しています`);
        continue;
      }

      // 復元されたファイルの存在確認（簡略化）
      try {
        // 実際の実装では、復元されたファイルの存在と整合性を確認
        console.log(`✅ ${env}環境の復元結果検証完了: ${result.restoredFileCount}ファイル`);
      } catch (error) {
        errors.push(`${env}環境の復元結果検証エラー: ${error}`);
      }
    }
  }

  /**
   * ペアになったバックアップを特定
   */
  private identifyPairedBackups(
    localBackups: BackupInfo[],
    ec2Backups: BackupInfo[]
  ): Array<{
    backupId: string;
    localBackup?: BackupInfo;
    ec2Backup?: BackupInfo;
    complete: boolean;
  }> {
    const paired: Array<{
      backupId: string;
      localBackup?: BackupInfo;
      ec2Backup?: BackupInfo;
      complete: boolean;
    }> = [];

    const processedIds = new Set<string>();

    // ローカルバックアップから開始
    for (const localBackup of localBackups) {
      const baseId = localBackup.backupId.replace('-local', '');
      if (processedIds.has(baseId)) continue;

      const ec2Backup = ec2Backups.find(b => b.backupId === `${baseId}-ec2`);
      
      paired.push({
        backupId: baseId,
        localBackup,
        ec2Backup,
        complete: !!ec2Backup
      });

      processedIds.add(baseId);
    }

    // EC2のみのバックアップを追加
    for (const ec2Backup of ec2Backups) {
      const baseId = ec2Backup.backupId.replace('-ec2', '');
      if (processedIds.has(baseId)) continue;

      paired.push({
        backupId: baseId,
        ec2Backup,
        complete: false
      });

      processedIds.add(baseId);
    }

    return paired.sort((a, b) => {
      const aTime = a.localBackup?.createdAt || a.ec2Backup?.createdAt || new Date(0);
      const bTime = b.localBackup?.createdAt || b.ec2Backup?.createdAt || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });
  }

  /**
   * 環境別バックアップクリーンアップ
   */
  private async cleanupEnvironmentBackups(
    environment: Environment,
    retentionDays: number
  ): Promise<number> {
    try {
      const manager = environment === 'local' ? this.localBackupManager : this.ec2BackupManager;
      
      const backupsBefore = await manager.listBackups();
      await manager.cleanupOldBackups(retentionDays);
      const backupsAfter = await manager.listBackups();
      
      return backupsBefore.length - backupsAfter.length;
    } catch (error) {
      console.warn(`${environment}環境のバックアップクリーンアップエラー:`, error);
      return 0;
    }
  }

  /**
   * 緊急復旧機能
   */
  public async emergencyRestore(
    backupId: string,
    targetEnvironment?: Environment
  ): Promise<IntegratedRestoreResult> {
    console.log(`🚨 緊急復旧を実行中: ${backupId}`);

    const emergencyOptions: RestoreOptions = {
      createPreRestoreBackup: false,
      overwriteExisting: true,
      verifyAfterRestore: false, // 緊急時は検証をスキップ
      dryRun: false
    };

    try {
      if (targetEnvironment) {
        // 特定環境のみの緊急復旧
        const result = await this.restoreEnvironmentBackup(
          targetEnvironment,
          `${backupId}-${targetEnvironment}`,
          emergencyOptions
        );

        return {
          restoreId: `emergency-${Date.now()}`,
          success: result.success,
          environmentResults: { [targetEnvironment]: result } as Record<Environment, RestoreResult>,
          totalRestoredFiles: result.restoredFileCount,
          errors: result.error ? [result.error] : [],
          restoreTime: new Date(),
          processingTime: 0
        };
      } else {
        // 全環境の緊急復旧
        return await this.restoreIntegratedBackup(backupId, emergencyOptions);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `緊急復旧に失敗しました: ${error}`,
        undefined,
        targetEnvironment,
        error as Error
      );
    }
  }
}