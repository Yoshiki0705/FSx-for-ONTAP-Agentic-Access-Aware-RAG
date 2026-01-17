/**
 * 統合ファイル整理システム - 権限検証・修復機能
 * 
 * ファイル権限の検証、修復、レポート生成機能を提供し、
 * セキュリティ要件の継続的な遵守を保証します。
 */

import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { 
  FileInfo,
  ClassificationResult,
  Environment,
  FileType,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { PermissionManager, PermissionResult, PermissionSummary } from './permission-manager.js';

const execAsync = promisify(exec);

/**
 * 権限検証結果
 */
export interface ValidationResult {
  /** ファイルパス */
  filePath: string;
  /** 期待される権限 */
  expectedPermissions: string;
  /** 実際の権限 */
  actualPermissions: string;
  /** 検証結果 */
  isValid: boolean;
  /** 問題の種類 */
  issueType?: 'incorrect_permissions' | 'missing_file' | 'access_denied' | 'unknown_error';
  /** 問題の詳細 */
  issueDescription?: string;
  /** セキュリティリスクレベル */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 推奨アクション */
  recommendedAction: string;
}

/**
 * 検証サマリー
 */
export interface ValidationSummary {
  /** 検証したファイル数 */
  totalFiles: number;
  /** 有効なファイル数 */
  validFiles: number;
  /** 無効なファイル数 */
  invalidFiles: number;
  /** リスクレベル別統計 */
  riskLevelStats: Record<string, number>;
  /** 問題タイプ別統計 */
  issueTypeStats: Record<string, number>;
  /** 検証時間 */
  validationTime: number;
  /** 環境 */
  environment: Environment;
  /** 詳細結果 */
  results: ValidationResult[];
}

/**
 * 修復計画
 */
export interface RepairPlan {
  /** 修復対象ファイル */
  targetFiles: Array<{
    filePath: string;
    currentPermissions: string;
    targetPermissions: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  /** 推定修復時間 */
  estimatedRepairTime: number;
  /** 修復順序 */
  repairOrder: string[];
  /** 注意事項 */
  warnings: string[];
}

/**
 * 権限検証・修復機能
 * 
 * 包括的な権限検証と自動修復機能を提供します。
 */
export class PermissionValidator {
  private readonly permissionManager: PermissionManager;
  private readonly sshConfig?: SSHConfig;

  constructor(sshConfig?: SSHConfig) {
    this.sshConfig = sshConfig;
    this.permissionManager = new PermissionManager(sshConfig);
  }

  /**
   * 包括的権限検証を実行
   */
  public async validatePermissions(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    environment: Environment
  ): Promise<ValidationSummary> {
    const startTime = Date.now();
    console.log(`🔍 ${environment}環境で${files.length}個のファイル権限を検証中...`);

    try {
      const results: ValidationResult[] = [];
      const riskLevelStats: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      const issueTypeStats: Record<string, number> = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const classification = classifications[i];

        try {
          const result = await this.validateSingleFile(file, classification, environment);
          results.push(result);

          // 統計更新
          riskLevelStats[result.riskLevel]++;
          if (result.issueType) {
            issueTypeStats[result.issueType] = (issueTypeStats[result.issueType] || 0) + 1;
          }
        } catch (error) {
          const errorResult: ValidationResult = {
            filePath: file.path,
            expectedPermissions: 'unknown',
            actualPermissions: 'unknown',
            isValid: false,
            issueType: 'unknown_error',
            issueDescription: error instanceof Error ? error.message : String(error),
            riskLevel: 'medium',
            recommendedAction: '手動で権限を確認してください'
          };
          results.push(errorResult);
          riskLevelStats.medium++;
          issueTypeStats.unknown_error = (issueTypeStats.unknown_error || 0) + 1;
        }
      }

      const validationTime = Date.now() - startTime;
      const validFiles = results.filter(r => r.isValid).length;
      const invalidFiles = results.filter(r => !r.isValid).length;

      console.log(`${invalidFiles === 0 ? '✅' : '⚠️'} ${environment}権限検証完了: ${validFiles}/${files.length}個有効 (${validationTime}ms)`);

      return {
        totalFiles: files.length,
        validFiles,
        invalidFiles,
        riskLevelStats,
        issueTypeStats,
        validationTime,
        environment,
        results
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.VALIDATION_FAILED,
        `${environment}環境の権限検証に失敗しました: ${error}`,
        undefined,
        environment,
        error as Error
      );
    }
  }

  /**
   * 単一ファイルの権限を検証
   */
  private async validateSingleFile(
    file: FileInfo, 
    classification: ClassificationResult, 
    environment: Environment
  ): Promise<ValidationResult> {
    try {
      // 期待される権限を取得
      const expectedPermissions = this.determineExpectedPermissions(file, classification);
      
      // 実際の権限を取得
      const actualPermissions = await this.getCurrentPermissions(file.path, environment);
      
      // 権限の比較
      const isValid = actualPermissions === expectedPermissions;
      
      if (isValid) {
        return {
          filePath: file.path,
          expectedPermissions,
          actualPermissions,
          isValid: true,
          riskLevel: 'low',
          recommendedAction: 'アクション不要'
        };
      }

      // 問題の分析
      const analysis = this.analyzePermissionIssue(file, expectedPermissions, actualPermissions);
      
      return {
        filePath: file.path,
        expectedPermissions,
        actualPermissions,
        isValid: false,
        issueType: analysis.issueType,
        issueDescription: analysis.description,
        riskLevel: analysis.riskLevel,
        recommendedAction: analysis.recommendedAction
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return {
          filePath: file.path,
          expectedPermissions: 'unknown',
          actualPermissions: 'missing',
          isValid: false,
          issueType: 'missing_file',
          issueDescription: 'ファイルが存在しません',
          riskLevel: 'high',
          recommendedAction: 'ファイルの存在を確認し、必要に応じて復元してください'
        };
      }

      throw error;
    }
  }

  /**
   * 権限問題を分析
   */
  private analyzePermissionIssue(
    file: FileInfo, 
    expected: string, 
    actual: string
  ): {
    issueType: 'incorrect_permissions';
    description: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendedAction: string;
  } {
    const expectedOctal = parseInt(expected, 8);
    const actualOctal = parseInt(actual, 8);

    // セキュリティリスクの評価
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let description = `権限が期待値と異なります (期待: ${expected}, 実際: ${actual})`;
    let recommendedAction = `権限を${expected}に変更してください`;

    // 実行権限の不適切な付与
    if ((actualOctal & 0o111) > (expectedOctal & 0o111)) {
      riskLevel = 'high';
      description += ' - 不要な実行権限が付与されています';
      recommendedAction = `セキュリティリスクのため、即座に権限を${expected}に修正してください`;
    }

    // 書き込み権限の不適切な付与
    if ((actualOctal & 0o222) > (expectedOctal & 0o222)) {
      riskLevel = riskLevel === 'high' ? 'critical' : 'high';
      description += ' - 不要な書き込み権限が付与されています';
    }

    // 他者読み取り権限の問題（機密ファイル）
    if (file.path.includes('secret') || file.path.includes('key') || file.path.includes('password')) {
      if ((actualOctal & 0o044) > 0) {
        riskLevel = 'critical';
        description += ' - 機密ファイルに他者読み取り権限があります';
        recommendedAction = `緊急: 機密ファイルの権限を600に変更してください`;
      }
    }

    // 権限が緩すぎる場合
    if (actualOctal > expectedOctal) {
      if (riskLevel === 'low') riskLevel = 'medium';
      description += ' - 権限が緩すぎます';
    }

    // 権限が厳しすぎる場合
    if (actualOctal < expectedOctal) {
      description += ' - 権限が厳しすぎる可能性があります';
      recommendedAction += ' (機能に影響する可能性があります)';
    }

    return {
      issueType: 'incorrect_permissions',
      description,
      riskLevel,
      recommendedAction
    };
  }

  /**
   * 修復計画を作成
   */
  public createRepairPlan(validationSummary: ValidationSummary): RepairPlan {
    console.log('📋 権限修復計画を作成中...');

    const invalidResults = validationSummary.results.filter(r => !r.isValid);
    
    // 優先度別にファイルを分類
    const targetFiles = invalidResults.map(result => ({
      filePath: result.filePath,
      currentPermissions: result.actualPermissions,
      targetPermissions: result.expectedPermissions,
      priority: result.riskLevel as 'low' | 'medium' | 'high' | 'critical'
    }));

    // 修復順序を決定（リスクレベル順）
    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    const repairOrder = targetFiles
      .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority))
      .map(f => f.filePath);

    // 推定修復時間を計算
    const estimatedRepairTime = targetFiles.length * 100; // 100ms per file

    // 注意事項を生成
    const warnings: string[] = [];
    
    const criticalFiles = targetFiles.filter(f => f.priority === 'critical');
    if (criticalFiles.length > 0) {
      warnings.push(`${criticalFiles.length}個の重要なセキュリティ問題があります。即座に修復してください。`);
    }

    const scriptFiles = targetFiles.filter(f => f.filePath.endsWith('.sh') || f.filePath.endsWith('.py'));
    if (scriptFiles.length > 0) {
      warnings.push(`${scriptFiles.length}個のスクリプトファイルの権限を変更します。実行に影響する可能性があります。`);
    }

    if (targetFiles.length > 50) {
      warnings.push('大量のファイルを修復します。処理に時間がかかる可能性があります。');
    }

    console.log(`📋 修復計画作成完了: ${targetFiles.length}個のファイルが対象`);

    return {
      targetFiles,
      estimatedRepairTime,
      repairOrder,
      warnings
    };
  }

  /**
   * 自動修復を実行
   */
  public async executeAutoRepair(
    validationSummary: ValidationSummary,
    files: FileInfo[],
    classifications: ClassificationResult[]
  ): Promise<PermissionSummary> {
    console.log(`🔧 ${validationSummary.environment}環境で自動修復を実行中...`);

    // 修復計画を作成
    const repairPlan = this.createRepairPlan(validationSummary);

    if (repairPlan.targetFiles.length === 0) {
      console.log('✅ 修復対象なし: 全ての権限が正常です');
      return {
        totalFiles: 0,
        successfulUpdates: 0,
        failedUpdates: 0,
        skippedFiles: 0,
        totalProcessingTime: 0,
        environment: validationSummary.environment,
        results: [],
        errorSummary: {}
      };
    }

    // 警告の表示
    if (repairPlan.warnings.length > 0) {
      console.warn('⚠️ 修復実行前の注意事項:');
      repairPlan.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    // 修復対象のファイル情報を取得
    const repairFiles = repairPlan.targetFiles.map(target => 
      files.find(f => f.path === target.filePath)!
    ).filter(Boolean);

    const repairClassifications = repairPlan.targetFiles.map(target => 
      classifications[files.findIndex(f => f.path === target.filePath)]
    ).filter(Boolean);

    // 権限修復を実行
    return await this.permissionManager.setPermissions(
      repairFiles, 
      repairClassifications, 
      validationSummary.environment
    );
  }

  /**
   * 継続的監視を実行
   */
  public async performContinuousMonitoring(
    files: FileInfo[],
    classifications: ClassificationResult[],
    environment: Environment,
    intervalMinutes: number = 60
  ): Promise<void> {
    console.log(`🔄 ${environment}環境で継続的権限監視を開始 (間隔: ${intervalMinutes}分)`);

    const monitoringLoop = async () => {
      try {
        const validationResult = await this.validatePermissions(files, classifications, environment);
        
        if (validationResult.invalidFiles > 0) {
          console.warn(`⚠️ 権限問題を検出: ${validationResult.invalidFiles}個のファイル`);
          
          // 重要な問題がある場合は自動修復
          const criticalIssues = validationResult.results.filter(r => r.riskLevel === 'critical');
          if (criticalIssues.length > 0) {
            console.warn(`🚨 重要な権限問題を自動修復中: ${criticalIssues.length}個`);
            await this.executeAutoRepair(validationResult, files, classifications);
          }
        }
      } catch (error) {
        console.error(`❌ 継続的監視エラー: ${error}`);
      }
    };

    // 初回実行
    await monitoringLoop();

    // 定期実行の設定
    setInterval(monitoringLoop, intervalMinutes * 60 * 1000);
  }

  /**
   * 権限検証レポートを生成
   */
  public generateValidationReport(validationSummary: ValidationSummary): string {
    const validationRate = Math.round((validationSummary.validFiles / validationSummary.totalFiles) * 100);
    
    // リスクレベル別統計
    const riskStats = Object.entries(validationSummary.riskLevelStats)
      .map(([level, count]) => `- **${level.toUpperCase()}**: ${count}件`)
      .join('\n');

    // 問題タイプ別統計
    const issueStats = Object.entries(validationSummary.issueTypeStats)
      .map(([type, count]) => `- **${type}**: ${count}件`)
      .join('\n');

    // 重要な問題のリスト
    const criticalIssues = validationSummary.results
      .filter(r => r.riskLevel === 'critical')
      .slice(0, 10)
      .map(r => `- **${r.filePath}**: ${r.issueDescription}`)
      .join('\n');

    return `
# ${validationSummary.environment.toUpperCase()}環境 権限検証レポート

## 検証サマリー
- **検証日時**: ${new Date().toLocaleString('ja-JP')}
- **環境**: ${validationSummary.environment}
- **検証ファイル数**: ${validationSummary.totalFiles}個
- **有効**: ${validationSummary.validFiles}個
- **無効**: ${validationSummary.invalidFiles}個
- **検証率**: ${validationRate}%
- **検証時間**: ${Math.round(validationSummary.validationTime / 1000)}秒

## リスクレベル別統計
${riskStats}

## 問題タイプ別統計
${issueStats || '- 問題なし'}

## 重要な権限問題（上位10件）
${criticalIssues || '- 重要な問題なし'}

## 推奨アクション
${validationSummary.invalidFiles === 0 ? 
  '- 全ての権限が適切に設定されています。継続的な監視を推奨します。' :
  `- ${validationSummary.invalidFiles}個のファイルで権限問題が検出されました。自動修復の実行を検討してください。`
}

${validationSummary.riskLevelStats.critical > 0 ? 
  `\n⚠️ **緊急**: ${validationSummary.riskLevelStats.critical}個の重要なセキュリティ問題があります。即座に対応してください。` : ''
}

## パフォーマンス統計
- **平均検証時間**: ${Math.round(validationSummary.validationTime / validationSummary.totalFiles)}ms/ファイル
- **検証スループット**: ${Math.round(validationSummary.totalFiles / (validationSummary.validationTime / 1000))}ファイル/秒
`;
  }

  /**
   * 期待される権限を決定
   */
  private determineExpectedPermissions(file: FileInfo, classification: ClassificationResult): string {
    // PermissionManagerと同じロジックを使用
    if (classification.fileType === 'script') {
      return '755';
    }
    
    if (classification.fileType === 'config') {
      if (file.path.includes('secret') || file.path.includes('env') || 
          file.path.includes('key') || file.path.includes('password')) {
        return '600';
      }
      return '644';
    }
    
    return '644'; // デフォルト
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