/**
 * 統合ファイル整理システム - 進捗管理・レポート機能
 *
 * リアルタイム進捗表示、実行結果レポート、統合レポート生成機能を提供します。
 */
import { EventEmitter } from 'events';
import { Environment } from '../types/index.js';
import { ExecutionResult, ExecutionProgress, ExecutionPhase } from './integrated-execution-engine.js';
/**
 * レポート設定
 */
export interface ReportConfig {
    /** 出力ディレクトリ */
    outputDirectory: string;
    /** レポート形式 */
    formats: ReportFormat[];
    /** 詳細レベル */
    detailLevel: 'summary' | 'detailed' | 'verbose';
    /** 画像を含めるか */
    includeCharts: boolean;
    /** 自動保存するか */
    autoSave: boolean;
}
/**
 * レポート形式
 */
export type ReportFormat = 'markdown' | 'html' | 'json' | 'csv';
/**
 * 進捗表示設定
 */
export interface ProgressDisplayConfig {
    /** 表示モード */
    mode: 'console' | 'file' | 'both';
    /** 更新間隔（ミリ秒） */
    updateInterval: number;
    /** 詳細表示するか */
    showDetails: boolean;
    /** カラー表示するか */
    useColors: boolean;
}
/**
 * レポートデータ
 */
export interface ReportData {
    /** 実行結果 */
    executionResult: ExecutionResult;
    /** システム情報 */
    systemInfo: SystemInfo;
    /** パフォーマンス分析 */
    performanceAnalysis: PerformanceAnalysis;
    /** 推奨事項 */
    recommendations: Recommendation[];
}
/**
 * システム情報
 */
export interface SystemInfo {
    /** OS情報 */
    platform: string;
    /** Node.jsバージョン */
    nodeVersion: string;
    /** メモリ使用量 */
    memoryUsage: NodeJS.MemoryUsage;
    /** 実行時刻 */
    executionTime: Date;
    /** 作業ディレクトリ */
    workingDirectory: string;
}
/**
 * パフォーマンス分析
 */
export interface PerformanceAnalysis {
    /** フェーズ別処理時間 */
    phaseTimings: Record<ExecutionPhase, number>;
    /** 環境別処理時間 */
    environmentTimings: Record<Environment, number>;
    /** ボトルネック分析 */
    bottlenecks: BottleneckAnalysis[];
    /** スループット統計 */
    throughputStats: ThroughputStats;
}
/**
 * ボトルネック分析
 */
export interface BottleneckAnalysis {
    /** フェーズ */
    phase: ExecutionPhase;
    /** 処理時間 */
    duration: number;
    /** 全体に占める割合 */
    percentage: number;
    /** 改善提案 */
    improvementSuggestion: string;
}
/**
 * スループット統計
 */
export interface ThroughputStats {
    /** ファイル処理速度（ファイル/秒） */
    filesPerSecond: number;
    /** データ処理速度（MB/秒） */
    mbPerSecond: number;
    /** 平均ファイルサイズ */
    averageFileSize: number;
    /** 最大処理時間 */
    maxProcessingTime: number;
    /** 最小処理時間 */
    minProcessingTime: number;
}
/**
 * 推奨事項
 */
export interface Recommendation {
    /** カテゴリ */
    category: 'performance' | 'security' | 'maintenance' | 'structure';
    /** 優先度 */
    priority: 'low' | 'medium' | 'high' | 'critical';
    /** タイトル */
    title: string;
    /** 説明 */
    description: string;
    /** 実装方法 */
    implementation: string;
    /** 期待効果 */
    expectedBenefit: string;
}
/**
 * 進捗管理・レポート機能
 *
 * リアルタイム進捗表示と包括的なレポート生成を提供します。
 */
export declare class ProgressReporter extends EventEmitter {
    private readonly reportConfig;
    private readonly progressConfig;
    private currentProgress?;
    private progressHistory;
    private progressInterval?;
    constructor(reportConfig?: ReportConfig, progressConfig?: ProgressDisplayConfig);
    /**
     * 進捗追跡を開始
     */
    startProgressTracking(initialProgress: ExecutionProgress): void;
    /**
     * 進捗を更新
     */
    updateProgress(progress: ExecutionProgress): void;
    /**
     * 進捗追跡を停止
     */
    stopProgressTracking(): void;
    /**
     * 統合レポートを生成
     */
    generateIntegratedReport(executionResult: ExecutionResult): Promise<string[]>;
    /**
     * リアルタイム進捗表示
     */
    private displayProgress;
    /**
     * コンソール進捗表示
     */
    private displayConsoleProgress;
    /**
     * 進捗バーを生成
     */
    private generateProgressBar;
    /**
     * フェーズの色を取得
     */
    private getPhaseColor;
    /**
     * 時間をフォーマット
     */
    private formatDuration;
    /**
     * コンソール進捗を開始
     */
    private startConsoleProgress;
    /**
     * ファイル進捗を開始
     */
    private startFileProgress;
    /**
     * レポートデータを準備
     */
    private prepareReportData;
    /**
     * パフォーマンス分析を実行
     */
    private analyzePerformance;
    /**
     * 推奨事項を生成
     */
    private generateRecommendations;
    /**
     * 形式別レポート生成
     */
    private generateReportByFormat;
    /**
     * Markdownレポートを生成
     */
    private generateMarkdownReport;
    /**
     * HTMLレポートを生成
     */
    private generateHtmlReport;
    /**
     * CSVレポートを生成
     */
    private generateCsvReport;
}
