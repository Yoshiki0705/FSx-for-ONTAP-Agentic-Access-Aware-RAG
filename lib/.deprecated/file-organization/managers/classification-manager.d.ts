/**
 * 統合ファイル整理システム - 分類マネージャー
 *
 * ローカル環境とEC2環境の両方でファイル分類処理を統合管理し、
 * 分類結果の検証とレポート生成を行います。
 */
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { ClassificationResult, ClassificationConfig, Environment, FileType } from '../types/index.js';
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
export declare class ClassificationManager {
    private readonly config;
    private readonly localClassifier;
    private readonly ec2Classifier;
    private readonly localScanner;
    private readonly ec2Scanner;
    constructor(config: ClassificationConfig, localRootPath: string, sshConfig: SSHConfig);
    /**
     * 統合分類処理を実行
     */
    executeIntegratedClassification(): Promise<ClassificationReport>;
    /**
     * 環境別分類処理
     */
    classifyEnvironment(environment: Environment): Promise<EnvironmentClassificationResult>;
    /**
     * 分類結果の検証
     */
    validateClassifications(results: ClassificationResult[]): Promise<{
        valid: ClassificationResult[];
        invalid: ClassificationResult[];
        validationErrors: string[];
    }>;
    /**
     * 分類結果のフィルタリング
     */
    filterClassifications(results: ClassificationResult[], filters: {
        fileType?: FileType[];
        minConfidence?: number;
        maxConfidence?: number;
        requiresReview?: boolean;
        environment?: Environment;
    }): ClassificationResult[];
    /**
     * 分類結果のソート
     */
    sortClassifications(results: ClassificationResult[], sortBy?: 'confidence' | 'fileType' | 'path' | 'size', order?: 'asc' | 'desc'): ClassificationResult[];
    /**
     * 環境ファイルをスキャン
     */
    private scanEnvironmentFiles;
    /**
     * SettledResult を処理
     */
    private processSettledResult;
    /**
     * 全体統計を生成
     */
    private generateOverallStatistics;
    /**
     * 推奨事項を生成
     */
    private generateRecommendations;
    /**
     * 警告を生成
     */
    private generateWarnings;
    /**
     * 空の統計を作成
     */
    private createEmptyStatistics;
    /**
     * レポートを保存
     */
    private saveReport;
    /**
     * 分類結果の妥当性を検証
     */
    private isValidClassification;
    /**
     * 分類結果から統計を生成
     */
    private generateStatisticsForClassifications;
    /**
     * レポートをCSV形式でエクスポート
     */
    exportReportToCSV(report: ClassificationReport, outputPath: string): Promise<void>;
}
