/**
 * 統合ファイル整理システム - 分類マネージャー
 * 
 * ローカル環境とEC2環境の両方でファイル分類処理を統合管理し、
 * 分類結果の検証とレポート生成を行います。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileClassifier } from '../classification/file-classifier.js';
import { LocalFileScanner } from '../scanners/local-scanner.js';
import { EC2FileScanner, SSHConfig } from '../scanners/ec2-scanner.js';
import { 
  FileInfo, 
  ClassificationResult, 
  ClassificationConfig,
  Environment,
  FileType,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

/**
 * 分類レポート
 */
export interface ClassificationReport {
  /** レポートID */
  reportId: string;
  /** 生成時刻 */
  generatedAt: Date;
  /** 環境別結果 */
  environmentResults: Record<Environment, EnvironmentClassificationResult>;
  /** 全体統計 */
  overallStatistics: ClassificationStatistics;
  /** 推奨事項 */
  recommendations: string[];
  /** 警告 */
  warnings: string[];
}

/**
 * 環境別分類結果
 */
export interface EnvironmentClassificationResult {
  /** 実行環境 */
  environment: Environment;
  /** 処理されたファイル数 */
  totalFiles: number;
  /** 分類結果 */
  classifications: ClassificationResult[];
  /** 統計情報 */
  statistics: ClassificationStatistics;
  /** エラー */
  errors: string[];
  /** 処理時間 */
  processingTime: number;
}

/**
 * 分類統計
 */
export interface ClassificationStatistics {
  /** ファイルタイプ別統計 */
  byFileType: Record<FileType, number>;
  /** 信頼度別統計 */
  byConfidence: Record<string, number>;
  /** レビュー必要数 */
  requiresReview: number;
  /** 平均信頼度 */
  averageConfidence: number;
  /** 成功率 */
  successRate: number;
}

/**
 * 分類マネージャー
 * 
 * 両環境の分類処理を統合管理し、結果の検証とレポート生成を行います。
 */
export class ClassificationManager {
  private readonly config: ClassificationConfig;
  private readonly localClassifier: FileClassifier;
  private readonly ec2Classifier: FileClassifier;
  private readonly localScanner: LocalFileScanner;
  private readonly ec2Scanner: EC2FileScanner;

  constructor(
    config: ClassificationConfig,
    localRootPath: string = process.cwd(),
    sshConfig: SSHConfig
  ) {
    this.config = config;
    this.localClassifier = new FileClassifier(config, 'local');
    this.ec2Classifier = new FileClassifier(config, 'ec2');
    this.localScanner = new LocalFileScanner(localRootPath);
    this.ec2Scanner = new EC2FileScanner(sshConfig);
  }

  /**
   * 統合分類処理を実行
   */
  public async executeIntegratedClassification(): Promise<ClassificationReport> {
    const reportId = `classification-${Date.now()}`;
    const startTime = Date.now();

    console.log('🔍 統合ファイル分類を開始します...');

    try {
      // 並列で両環境の分類を実行
      const [localResult, ec2Result] = await Promise.allSettled([
        this.classifyEnvironment('local'),
        this.classifyEnvironment('ec2')
      ]);

      // 結果の処理
      const environmentResults: Record<Environment, EnvironmentClassificationResult> = {
        local: this.processSettledResult(localResult, 'local'),
        ec2: this.processSettledResult(ec2Result, 'ec2')
      };

      // 全体統計の生成
      const overallStatistics = this.generateOverallStatistics(environmentResults);

      // 推奨事項と警告の生成
      const recommendations = this.generateRecommendations(environmentResults);
      const warnings = this.generateWarnings(environmentResults);

      const report: ClassificationReport = {
        reportId,
        generatedAt: new Date(),
        environmentResults,
        overallStatistics,
        recommendations,
        warnings
      };

      const totalTime = Date.now() - startTime;
      console.log(`✅ 統合ファイル分類が完了しました (${totalTime}ms)`);

      // レポートを保存
      await this.saveReport(report);

      return report;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.CLASSIFICATION_FAILED,
        `統合分類処理に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 環境別分類処理
   */
  public async classifyEnvironment(environment: Environment): Promise<EnvironmentClassificationResult> {
    const startTime = Date.now();
    console.log(`📂 ${environment}環境のファイル分類を開始...`);

    try {
      // ファイルスキャン
      const files = await this.scanEnvironmentFiles(environment);
      console.log(`${environment}環境で ${files.length} 個のファイルを検出`);

      // 分類実行
      const classifier = environment === 'local' ? this.localClassifier : this.ec2Classifier;
      const classifications: ClassificationResult[] = [];
      
      for (const file of files) {
        try {
          const classification = await classifier.classifyFile(file);
          classifications.push(classification);
        } catch (error) {
          console.warn(`ファイル分類エラー: ${file.path}`, error);
          // エラーが発生したファイルは不明タイプとして分類
          classifications.push({
            file,
            targetPath: `archive/${file.name}`,
            fileType: FileType.UNKNOWN,
            confidence: 0.1,
            reasoning: ['分類エラーが発生'],
            requiresReview: true
          });
        }
      }

      // 統計生成
      const statistics = this.generateStatisticsForClassifications(classifications);

      const processingTime = Date.now() - startTime;
      console.log(`✅ ${environment}環境の分類完了 (${processingTime}ms)`);

      return {
        environment,
        totalFiles: files.length,
        classifications,
        statistics,
        errors: [],
        processingTime
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ ${environment}環境の分類でエラー:`, error);

      return {
        environment,
        totalFiles: 0,
        classifications: [],
        statistics: this.createEmptyStatistics(),
        errors: [error instanceof Error ? error.message : String(error)],
        processingTime
      };
    }
  }

  /**
   * 分類結果の検証
   */
  public async validateClassifications(results: ClassificationResult[]): Promise<{
    valid: ClassificationResult[];
    invalid: ClassificationResult[];
    validationErrors: string[];
  }> {
    const valid: ClassificationResult[] = [];
    const invalid: ClassificationResult[] = [];
    const validationErrors: string[] = [];

    for (const result of results) {
      try {
        // 基本的な検証ロジック
        if (this.isValidClassification(result)) {
          valid.push(result);
        } else {
          invalid.push(result);
          validationErrors.push(`検証失敗: ${result.file.path}`);
        }
      } catch (error) {
        invalid.push(result);
        validationErrors.push(`検証エラー: ${result.file.path} - ${error}`);
      }
    }

    return { valid, invalid, validationErrors };
  }

  /**
   * 分類結果のフィルタリング
   */
  public filterClassifications(
    results: ClassificationResult[],
    filters: {
      fileType?: FileType[];
      minConfidence?: number;
      maxConfidence?: number;
      requiresReview?: boolean;
      environment?: Environment;
    }
  ): ClassificationResult[] {
    return results.filter(result => {
      if (filters.fileType && !filters.fileType.includes(result.fileType)) {
        return false;
      }

      if (filters.minConfidence !== undefined && result.confidence < filters.minConfidence) {
        return false;
      }

      if (filters.maxConfidence !== undefined && result.confidence > filters.maxConfidence) {
        return false;
      }

      if (filters.requiresReview !== undefined && result.requiresReview !== filters.requiresReview) {
        return false;
      }

      if (filters.environment && result.file.environment !== filters.environment) {
        return false;
      }

      return true;
    });
  }

  /**
   * 分類結果のソート
   */
  public sortClassifications(
    results: ClassificationResult[],
    sortBy: 'confidence' | 'fileType' | 'path' | 'size' = 'confidence',
    order: 'asc' | 'desc' = 'desc'
  ): ClassificationResult[] {
    return [...results].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'fileType':
          comparison = a.fileType.localeCompare(b.fileType);
          break;
        case 'path':
          comparison = a.file.path.localeCompare(b.file.path);
          break;
        case 'size':
          comparison = a.file.size - b.file.size;
          break;
      }

      return order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * 環境ファイルをスキャン
   */
  private async scanEnvironmentFiles(environment: Environment): Promise<FileInfo[]> {
    if (environment === 'local') {
      return await this.localScanner.detectLocalFlatFiles();
    } else {
      const projectFiles = await this.ec2Scanner.detectEC2FlatFiles();
      const homeFiles = await this.ec2Scanner.detectHomeFlatFiles();
      return [...projectFiles, ...homeFiles];
    }
  }

  /**
   * SettledResult を処理
   */
  private processSettledResult(
    result: PromiseSettledResult<EnvironmentClassificationResult>,
    environment: Environment
  ): EnvironmentClassificationResult {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`${environment}環境の分類処理が失敗:`, result.reason);
      return {
        environment,
        totalFiles: 0,
        classifications: [],
        statistics: this.createEmptyStatistics(),
        errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
        processingTime: 0
      };
    }
  }

  /**
   * 全体統計を生成
   */
  private generateOverallStatistics(
    environmentResults: Record<Environment, EnvironmentClassificationResult>
  ): ClassificationStatistics {
    const allClassifications = Object.values(environmentResults)
      .flatMap(result => result.classifications);

    if (allClassifications.length === 0) {
      return this.createEmptyStatistics();
    }

    // ファイルタイプ別統計
    const byFileType: Record<FileType, number> = {} as Record<FileType, number>;
    for (const classification of allClassifications) {
      byFileType[classification.fileType] = (byFileType[classification.fileType] || 0) + 1;
    }

    // 信頼度別統計
    const byConfidence = {
      'high (0.8+)': 0,
      'medium (0.5-0.8)': 0,
      'low (0.0-0.5)': 0
    };

    let totalConfidence = 0;
    let requiresReview = 0;

    for (const classification of allClassifications) {
      totalConfidence += classification.confidence;

      if (classification.confidence >= 0.8) {
        byConfidence['high (0.8+)']++;
      } else if (classification.confidence >= 0.5) {
        byConfidence['medium (0.5-0.8)']++;
      } else {
        byConfidence['low (0.0-0.5)']++;
      }

      if (classification.requiresReview) {
        requiresReview++;
      }
    }

    const averageConfidence = totalConfidence / allClassifications.length;
    const successRate = allClassifications.filter(c => c.confidence >= 0.5).length / allClassifications.length;

    return {
      byFileType,
      byConfidence,
      requiresReview,
      averageConfidence,
      successRate
    };
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(
    environmentResults: Record<Environment, EnvironmentClassificationResult>
  ): string[] {
    const recommendations: string[] = [];
    const stats = this.generateOverallStatistics(environmentResults);

    // 信頼度に基づく推奨事項
    if (stats.averageConfidence < 0.6) {
      recommendations.push('分類ルールの見直しを推奨します（平均信頼度が低い）');
    }

    // レビュー必要ファイルに基づく推奨事項
    if (stats.requiresReview > 10) {
      recommendations.push(`${stats.requiresReview}個のファイルがレビューを必要としています`);
    }

    // 環境別推奨事項
    for (const [env, result] of Object.entries(environmentResults)) {
      if (result.errors.length > 0) {
        recommendations.push(`${env}環境でエラーが発生しています。接続設定を確認してください`);
      }

      if (result.totalFiles > 100) {
        recommendations.push(`${env}環境に多数のファイルがあります。段階的な整理を推奨します`);
      }
    }

    // ファイルタイプ別推奨事項
    const unknownCount = stats.byFileType[FileType.UNKNOWN] || 0;
    if (unknownCount > 5) {
      recommendations.push(`${unknownCount}個の不明ファイルがあります。分類ルールの追加を検討してください`);
    }

    return recommendations;
  }

  /**
   * 警告を生成
   */
  private generateWarnings(
    environmentResults: Record<Environment, EnvironmentClassificationResult>
  ): string[] {
    const warnings: string[] = [];

    for (const [env, result] of Object.entries(environmentResults)) {
      // エラーがある場合
      if (result.errors.length > 0) {
        warnings.push(`${env}環境で${result.errors.length}個のエラーが発生しました`);
      }

      // 処理時間が長い場合
      if (result.processingTime > 30000) { // 30秒
        warnings.push(`${env}環境の処理時間が長すぎます (${result.processingTime}ms)`);
      }

      // 機密ファイルの警告
      const sensitiveFiles = result.classifications.filter(c => 
        c.fileType === FileType.SECURITY_KEYS || c.fileType === FileType.SECURITY_SECRETS
      );
      if (sensitiveFiles.length > 0) {
        warnings.push(`${env}環境で${sensitiveFiles.length}個の機密ファイルが検出されました`);
      }
    }

    return warnings;
  }

  /**
   * 空の統計を作成
   */
  private createEmptyStatistics(): ClassificationStatistics {
    return {
      byFileType: {} as Record<FileType, number>,
      byConfidence: {
        'high (0.8+)': 0,
        'medium (0.5-0.8)': 0,
        'low (0.0-0.5)': 0
      },
      requiresReview: 0,
      averageConfidence: 0,
      successRate: 0
    };
  }

  /**
   * レポートを保存
   */
  private async saveReport(report: ClassificationReport): Promise<void> {
    try {
      const reportDir = 'development/logs/organization';
      await fs.mkdir(reportDir, { recursive: true });

      const reportPath = path.join(reportDir, `classification-report-${report.reportId}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      console.log(`📋 分類レポートを保存しました: ${reportPath}`);
    } catch (error) {
      console.warn('レポート保存に失敗しました:', error);
    }
  }

  /**
   * 分類結果の妥当性を検証
   */
  private isValidClassification(result: ClassificationResult): boolean {
    // 基本的な検証
    if (!result.file || !result.targetPath || !result.fileType) {
      return false;
    }

    // 信頼度の範囲チェック
    if (result.confidence < 0 || result.confidence > 1) {
      return false;
    }

    // ターゲットパスの妥当性チェック
    if (result.targetPath.includes('..') || result.targetPath.startsWith('/')) {
      return false;
    }

    // ファイルタイプの妥当性チェック
    if (!Object.values(FileType).includes(result.fileType)) {
      return false;
    }

    return true;
  }

  /**
   * 分類結果から統計を生成
   */
  private generateStatisticsForClassifications(classifications: ClassificationResult[]): ClassificationStatistics {
    if (classifications.length === 0) {
      return this.createEmptyStatistics();
    }

    // ファイルタイプ別統計
    const byFileType: Record<FileType, number> = {} as Record<FileType, number>;
    for (const classification of classifications) {
      byFileType[classification.fileType] = (byFileType[classification.fileType] || 0) + 1;
    }

    // 信頼度別統計
    const byConfidence = {
      'high (0.8+)': 0,
      'medium (0.5-0.8)': 0,
      'low (0.0-0.5)': 0
    };

    let totalConfidence = 0;
    let requiresReview = 0;

    for (const classification of classifications) {
      totalConfidence += classification.confidence;

      if (classification.confidence >= 0.8) {
        byConfidence['high (0.8+)']++;
      } else if (classification.confidence >= 0.5) {
        byConfidence['medium (0.5-0.8)']++;
      } else {
        byConfidence['low (0.0-0.5)']++;
      }

      if (classification.requiresReview) {
        requiresReview++;
      }
    }

    const averageConfidence = totalConfidence / classifications.length;
    const successRate = classifications.filter(c => c.confidence >= 0.5).length / classifications.length;

    return {
      byFileType,
      byConfidence,
      requiresReview,
      averageConfidence,
      successRate
    };
  }

  /**
   * レポートをCSV形式でエクスポート
   */
  public async exportReportToCSV(report: ClassificationReport, outputPath: string): Promise<void> {
    try {
      const csvLines: string[] = [];
      
      // ヘッダー
      csvLines.push([
        'Environment', 'FilePath', 'FileName', 'FileType', 'TargetPath', 
        'Confidence', 'RequiresReview', 'FileSize', 'LastModified', 'Reasoning'
      ].join(','));

      // データ行
      for (const [env, result] of Object.entries(report.environmentResults)) {
        for (const classification of result.classifications) {
          const row = [
            env,
            `"${classification.file.path}"`,
            `"${classification.file.name}"`,
            classification.fileType,
            `"${classification.targetPath}"`,
            classification.confidence.toFixed(3),
            classification.requiresReview.toString(),
            classification.file.size.toString(),
            classification.file.lastModified.toISOString(),
            `"${classification.reasoning.join('; ')}"`
          ];
          csvLines.push(row.join(','));
        }
      }

      await fs.writeFile(outputPath, csvLines.join('\n'));
      console.log(`📊 CSVレポートを保存しました: ${outputPath}`);
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.CLASSIFICATION_FAILED,
        `CSVエクスポートに失敗しました: ${error}`,
        outputPath,
        undefined,
        error as Error
      );
    }
  }
}