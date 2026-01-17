/**
 * 統合ファイル整理システム - 権限マネージャー
 * 
 * ファイルタイプ別の権限設定機能を提供し、
 * セキュリティ要件に応じた適切な権限管理を実行します。
 */

import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  FileInfo,
  ClassificationResult,
  Environment,
  FileType,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';

const execAsync = promisify(exec);

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
export class PermissionManager {
  private readonly sshConfig?: SSHConfig;
  private readonly permissionRules: PermissionRule[];

  constructor(sshConfig?: SSHConfig) {
    this.sshConfig = sshConfig;
    this.permissionRules = this.initializePermissionRules();
  }

  /**
   * 複数ファイルの権限を一括設定
   */
  public async setPermissions(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    environment: Environment
  ): Promise<PermissionSummary> {
    const startTime = Date.now();
    console.log(`🔒 ${environment}環境で${files.length}個のファイル権限を設定中...`);

    try {
      const results: PermissionResult[] = [];
      const errorSummary: Record<string, number> = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const classification = classifications[i];

        try {
          const result = await this.setSingleFilePermission(file, classification, environment);
          results.push(result);

          if (!result.success && result.error) {
            errorSummary[result.error] = (errorSummary[result.error] || 0) + 1;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.push({
            filePath: file.path,
            previousPermissions: 'unknown',
            newPermissions: 'unknown',
            success: false,
            error: errorMsg,
            processingTime: 0
          });
          errorSummary[errorMsg] = (errorSummary[errorMsg] || 0) + 1;
        }
      }

      const totalProcessingTime = Date.now() - startTime;
      const successfulUpdates = results.filter(r => r.success).length;
      const failedUpdates = results.filter(r => !r.success).length;

      console.log(`${successfulUpdates > 0 ? '✅' : '⚠️'} ${environment}権限設定完了: ${successfulUpdates}/${files.length}個成功 (${totalProcessingTime}ms)`);

      return {
        totalFiles: files.length,
        successfulUpdates,
        failedUpdates,
        skippedFiles: 0,
        totalProcessingTime,
        environment,
        results,
        errorSummary
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.PERMISSION_FAILED,
        `${environment}環境の権限設定に失敗しました: ${error}`,
        undefined,
        environment,
        error as Error
      );
    }
  }

  /**
   * 単一ファイルの権限を設定
   */
  public async setSingleFilePermission(
    file: FileInfo, 
    classification: ClassificationResult, 
    environment: Environment
  ): Promise<PermissionResult> {
    const startTime = Date.now();

    try {
      // 現在の権限を取得
      const previousPermissions = await this.getCurrentPermissions(file.path, environment);

      // 適切な権限を決定
      const targetPermissions = this.determineTargetPermissions(file, classification);

      // 権限が既に正しい場合はスキップ
      if (previousPermissions === targetPermissions) {
        return {
          filePath: file.path,
          previousPermissions,
          newPermissions: targetPermissions,
          success: true,
          processingTime: Date.now() - startTime
        };
      }

      // 権限を設定
      await this.applyPermissions(file.path, targetPermissions, environment);

      // 設定後の権限を確認
      const newPermissions = await this.getCurrentPermissions(file.path, environment);

      const success = newPermissions === targetPermissions;
      if (success) {
        console.log(`🔒 権限設定完了: ${file.path} (${previousPermissions} → ${newPermissions})`);
      } else {
        console.warn(`⚠️ 権限設定が不完全: ${file.path} (期待値: ${targetPermissions}, 実際: ${newPermissions})`);
      }

      return {
        filePath: file.path,
        previousPermissions,
        newPermissions,
        success,
        error: success ? undefined : `権限設定が不完全: 期待値${targetPermissions}, 実際${newPermissions}`,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ 権限設定エラー: ${file.path} - ${errorMsg}`);

      return {
        filePath: file.path,
        previousPermissions: 'unknown',
        newPermissions: 'unknown',
        success: false,
        error: errorMsg,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 権限設定ルールを初期化
   */
  private initializePermissionRules(): PermissionRule[] {
    return [
      // スクリプトファイル
      {
        fileType: 'script',
        permissions: '755',
        description: '実行可能スクリプト',
        condition: (filePath) => filePath.endsWith('.sh') || filePath.endsWith('.py') || filePath.endsWith('.js')
      },
      
      // 機密設定ファイル
      {
        fileType: 'config',
        permissions: '600',
        description: '機密設定ファイル',
        condition: (filePath) => 
          filePath.includes('secret') || 
          filePath.includes('env') || 
          filePath.includes('key') ||
          filePath.includes('password') ||
          filePath.includes('credential')
      },
      
      // 一般設定ファイル
      {
        fileType: 'config',
        permissions: '644',
        description: '一般設定ファイル'
      },
      
      // ドキュメントファイル
      {
        fileType: 'document',
        permissions: '644',
        description: 'ドキュメントファイル'
      },
      
      // テストファイル
      {
        fileType: 'test',
        permissions: '644',
        description: 'テストファイル'
      },
      
      // ログファイル
      {
        fileType: 'log',
        permissions: '644',
        description: 'ログファイル'
      },
      
      // その他のファイル
      {
        fileType: 'other',
        permissions: '644',
        description: 'その他のファイル'
      }
    ];
  }

  /**
   * 適切な権限を決定
   */
  private determineTargetPermissions(file: FileInfo, classification: ClassificationResult): string {
    // 分類結果に基づいてルールを検索
    for (const rule of this.permissionRules) {
      if (rule.fileType === classification.fileType) {
        // 条件がある場合は条件をチェック
        if (rule.condition) {
          if (rule.condition(file.path)) {
            return rule.permissions;
          }
        } else {
          return rule.permissions;
        }
      }
    }

    // デフォルト権限
    return '644';
  }

  /**
   * 現在の権限を取得
   */
  private async getCurrentPermissions(filePath: string, environment: Environment): Promise<string> {
    try {
      if (environment === 'local') {
        const stats = await fs.stat(filePath);
        return (stats.mode & parseInt('777', 8)).toString(8);
      } else {
        const result = await this.executeSSHCommand(`stat -c "%a" "${filePath}"`);
        return result.stdout.trim();
      }
    } catch (error) {
      throw new Error(`権限取得に失敗: ${error}`);
    }
  }

  /**
   * 権限を適用
   */
  private async applyPermissions(filePath: string, permissions: string, environment: Environment): Promise<void> {
    try {
      if (environment === 'local') {
        await fs.chmod(filePath, parseInt(permissions, 8));
      } else {
        await this.executeSSHCommand(`chmod ${permissions} "${filePath}"`);
      }
    } catch (error) {
      throw new Error(`権限設定に失敗: ${error}`);
    }
  }

  /**
   * 権限設定の検証
   */
  public async validatePermissions(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    environment: Environment
  ): Promise<{
    valid: boolean;
    issues: Array<{
      filePath: string;
      expectedPermissions: string;
      actualPermissions: string;
      issue: string;
    }>;
  }> {
    console.log(`🔍 ${environment}環境の権限設定を検証中...`);

    const issues: Array<{
      filePath: string;
      expectedPermissions: string;
      actualPermissions: string;
      issue: string;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const classification = classifications[i];

      try {
        const expectedPermissions = this.determineTargetPermissions(file, classification);
        const actualPermissions = await this.getCurrentPermissions(file.path, environment);

        if (actualPermissions !== expectedPermissions) {
          issues.push({
            filePath: file.path,
            expectedPermissions,
            actualPermissions,
            issue: `権限が期待値と異なります`
          });
        }
      } catch (error) {
        issues.push({
          filePath: file.path,
          expectedPermissions: 'unknown',
          actualPermissions: 'unknown',
          issue: `権限確認に失敗: ${error}`
        });
      }
    }

    const valid = issues.length === 0;

    if (valid) {
      console.log('✅ 権限設定検証完了: 問題なし');
    } else {
      console.warn(`⚠️ 権限設定検証で${issues.length}個の問題を検出`);
    }

    return { valid, issues };
  }

  /**
   * 権限修復を実行
   */
  public async repairPermissions(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    environment: Environment
  ): Promise<PermissionSummary> {
    console.log(`🔧 ${environment}環境の権限修復を実行中...`);

    // 検証を実行
    const validation = await this.validatePermissions(files, classifications, environment);

    if (validation.valid) {
      console.log('✅ 権限修復不要: 全て正常です');
      return {
        totalFiles: files.length,
        successfulUpdates: 0,
        failedUpdates: 0,
        skippedFiles: files.length,
        totalProcessingTime: 0,
        environment,
        results: [],
        errorSummary: {}
      };
    }

    // 問題のあるファイルのみ修復
    const problematicFiles = validation.issues.map(issue => 
      files.find(f => f.path === issue.filePath)!
    ).filter(Boolean);

    const problematicClassifications = validation.issues.map(issue => 
      classifications[files.findIndex(f => f.path === issue.filePath)]
    ).filter(Boolean);

    return await this.setPermissions(problematicFiles, problematicClassifications, environment);
  }

  /**
   * 権限設定レポートを生成
   */
  public generatePermissionReport(summary: PermissionSummary): string {
    const successRate = Math.round((summary.successfulUpdates / summary.totalFiles) * 100);
    
    // エラー統計の整理
    const errorDetails = Object.entries(summary.errorSummary)
      .map(([error, count]) => `- ${error}: ${count}件`)
      .join('\n');

    // 権限変更の統計
    const permissionChanges: Record<string, number> = {};
    summary.results
      .filter(r => r.success && r.previousPermissions !== r.newPermissions)
      .forEach(r => {
        const change = `${r.previousPermissions} → ${r.newPermissions}`;
        permissionChanges[change] = (permissionChanges[change] || 0) + 1;
      });

    const changeDetails = Object.entries(permissionChanges)
      .map(([change, count]) => `- ${change}: ${count}件`)
      .join('\n');

    return `
# ${summary.environment.toUpperCase()}環境 権限設定レポート

## 実行サマリー
- **実行日時**: ${new Date().toLocaleString('ja-JP')}
- **環境**: ${summary.environment}
- **処理ファイル数**: ${summary.totalFiles}個
- **成功**: ${summary.successfulUpdates}個
- **失敗**: ${summary.failedUpdates}個
- **スキップ**: ${summary.skippedFiles}個
- **成功率**: ${successRate}%
- **処理時間**: ${Math.round(summary.totalProcessingTime / 1000)}秒

## 権限変更統計
${changeDetails || '- 権限変更なし'}

## エラー統計
${errorDetails || '- エラーなし'}

## パフォーマンス
- **平均処理時間**: ${Math.round(summary.totalProcessingTime / summary.totalFiles)}ms/ファイル
- **処理スループット**: ${Math.round(summary.totalFiles / (summary.totalProcessingTime / 1000))}ファイル/秒

## 権限設定ルール適用状況
${this.permissionRules.map(rule => 
  `- **${rule.fileType}**: ${rule.permissions} (${rule.description})`
).join('\n')}

## 詳細結果（失敗のみ）
${summary.results
  .filter(r => !r.success)
  .slice(0, 20)
  .map(r => `- ${r.filePath}: ${r.error}`)
  .join('\n') || '- 失敗なし'}
${summary.results.filter(r => !r.success).length > 20 ? 
  `\n... 他${summary.results.filter(r => !r.success).length - 20}件` : ''}
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

  /**
   * 権限設定の統計情報を取得
   */
  public getPermissionStatistics(summary: PermissionSummary): {
    byFileType: Record<FileType, { total: number; success: number; failed: number }>;
    byPermission: Record<string, number>;
    processingTimeStats: {
      min: number;
      max: number;
      average: number;
      median: number;
    };
  } {
    // ファイルタイプ別統計（簡略化）
    const byFileType: Record<FileType, { total: number; success: number; failed: number }> = {
      script: { total: 0, success: 0, failed: 0 },
      document: { total: 0, success: 0, failed: 0 },
      config: { total: 0, success: 0, failed: 0 },
      test: { total: 0, success: 0, failed: 0 },
      log: { total: 0, success: 0, failed: 0 },
      other: { total: 0, success: 0, failed: 0 }
    };

    // 権限別統計
    const byPermission: Record<string, number> = {};
    
    // 処理時間統計
    const processingTimes = summary.results.map(r => r.processingTime).sort((a, b) => a - b);
    const processingTimeStats = {
      min: processingTimes[0] || 0,
      max: processingTimes[processingTimes.length - 1] || 0,
      average: processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length || 0,
      median: processingTimes[Math.floor(processingTimes.length / 2)] || 0
    };

    // 権限別カウント
    summary.results.forEach(result => {
      if (result.success && result.newPermissions) {
        byPermission[result.newPermissions] = (byPermission[result.newPermissions] || 0) + 1;
      }
    });

    return {
      byFileType,
      byPermission,
      processingTimeStats
    };
  }
}