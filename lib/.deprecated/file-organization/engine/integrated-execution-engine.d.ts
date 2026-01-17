/**
 * 統合ファイル整理システム - 統合実行エンジン
 *
 * 全体プロセスの統合実行制御機能を提供し、
 * 並列処理制御とエラーハンドリングを実行します。
 */
import { EventEmitter } from 'events';
import { Environment, ClassificationConfig } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * 実行オプション
 */
export interface ExecutionOptions {
    /** 実行モード */
    mode: 'full' | 'scan_only' | 'classify_only' | 'move_only' | 'sync_only';
    /** 対象環境 */
    environments: Environment[];
    /** ドライランモード */
    dryRun: boolean;
    /** 並列実行を有効にするか */
    enableParallel: boolean;
    /** 最大並列数 */
    maxParallel: number;
    /** バックアップを作成するか */
    createBackup: boolean;
    /** 権限設定を実行するか */
    setPermissions: boolean;
    /** 同期を実行するか */
    enableSync: boolean;
    /** 継続実行（エラー時も続行） */
    continueOnError: boolean;
    /** 進捗コールバック */
    progressCallback?: (progress: ExecutionProgress) => void;
}
/**
 * 実行進捗
 */
export interface ExecutionProgress {
    /** 実行ID */
    executionId: string;
    /** 現在のフェーズ */
    currentPhase: ExecutionPhase;
    /** 全体進捗率（0-100） */
    overallProgress: number;
    /** フェーズ進捗率（0-100） */
    phaseProgress: number;
    /** 処理済みファイル数 */
    processedFiles: number;
    /** 総ファイル数 */
    totalFiles: number;
    /** 現在処理中のファイル */
    currentFile?: string;
    /** 開始時刻 */
    startTime: Date;
    /** 推定残り時間（ミリ秒） */
    estimatedTimeRemaining?: number;
    /** エラー数 */
    errorCount: number;
    /** 警告数 */
    warningCount: number;
}
/**
 * 実行フェーズ
 */
export type ExecutionPhase = 'initializing' | 'scanning' | 'classifying' | 'creating_directories' | 'creating_backup' | 'moving_files' | 'setting_permissions' | 'syncing' | 'validating' | 'generating_report' | 'completed' | 'failed';
/**
 * 実行結果
 */
export interface ExecutionResult {
    /** 実行ID */
    executionId: string;
    /** 成功したかどうか */
    success: boolean;
    /** 実行開始時刻 */
    startTime: Date;
    /** 実行終了時刻 */
    endTime: Date;
    /** 総処理時間 */
    totalProcessingTime: number;
    /** 環境別結果 */
    environmentResults: Record<Environment, EnvironmentResult>;
    /** 統合統計 */
    overallStatistics: OverallStatistics;
    /** エラー */
    errors: ExecutionError[];
    /** 警告 */
    warnings: string[];
    /** 生成されたレポート */
    reports: GeneratedReport[];
}
/**
 * 環境別結果
 */
export interface EnvironmentResult {
    /** 環境 */
    environment: Environment;
    /** 成功したかどうか */
    success: boolean;
    /** スキャンされたファイル数 */
    scannedFiles: number;
    /** 分類されたファイル数 */
    classifiedFiles: number;
    /** 移動されたファイル数 */
    movedFiles: number;
    /** 権限設定されたファイル数 */
    permissionUpdates: number;
    /** 処理時間 */
    processingTime: number;
    /** エラー数 */
    errorCount: number;
}
/**
 * 統合統計
 */
export interface OverallStatistics {
    /** 総スキャンファイル数 */
    totalScannedFiles: number;
    /** 総移動ファイル数 */
    totalMovedFiles: number;
    /** 総作成ディレクトリ数 */
    totalCreatedDirectories: number;
    /** 総権限更新数 */
    totalPermissionUpdates: number;
    /** 平置きファイル削減数 */
    flatFileReduction: number;
    /** 構造準拠率 */
    structureComplianceRate: number;
    /** 環境間一致率 */
    environmentMatchRate: number;
}
/**
 * 実行エラー
 */
export interface ExecutionError {
    /** フェーズ */
    phase: ExecutionPhase;
    /** 環境 */
    environment?: Environment;
    /** エラーメッセージ */
    message: string;
    /** 詳細 */
    details?: any;
    /** 発生時刻 */
    timestamp: Date;
}
/**
 * 生成されたレポート
 */
export interface GeneratedReport {
    /** レポートタイプ */
    type: 'execution_summary' | 'environment_comparison' | 'error_analysis' | 'performance_analysis';
    /** ファイルパス */
    filePath: string;
    /** 生成時刻 */
    generatedAt: Date;
}
/**
 * 統合実行エンジン
 *
 * 全体プロセスを統合制御し、並列処理とエラーハンドリングを提供します。
 */
export declare class IntegratedExecutionEngine extends EventEmitter {
    private readonly config;
    private readonly sshConfig?;
    private readonly components;
    private currentExecution?;
    private scanResults?;
    private classificationResults?;
    constructor(config: ClassificationConfig, sshConfig?: SSHConfig);
    /**
     * 統合実行を開始
     */
    execute(options?: ExecutionOptions): Promise<ExecutionResult>;
    /**
     * フェーズ別実行
     */
    private executePhases;
    /**
     * 個別フェーズを実行
     */
    private executePhase;
    /**
     * 初期化フェーズ
     */
    private initializePhase;
    /**
     * スキャニングフェーズ
     */
    private scanningPhase;
    /**
     * 分類フェーズ
     */
    private classifyingPhase;
    /**
     * ディレクトリ作成フェーズ
     */
    private creatingDirectoriesPhase;
    /**
     * バックアップ作成フェーズ
     */
    private creatingBackupPhase;
    /**
     * ファイル移動フェーズ
     */
    private movingFilesPhase;
    /**
     * 権限設定フェーズ
     */
    private settingPermissionsPhase;
    /**
     * 同期フェーズ
     */
    private syncingPhase;
    /**
     * 検証フェーズ
     */
    private validatingPhase;
    /**
     * レポート生成フェーズ
     */
    private generatingReportPhase;
    /**
     * コンポーネントを初期化
     */
    private initializeComponents;
    /**
     * 実行を初期化
     */
    private initializeExecution;
    /**
     * 実行フェーズを取得
     */
    private getExecutionPhases;
    /**
     * 進捗を更新
     */
    private updateProgress;
    /**
     * エラーを追加
     */
    private addError;
    /**
     * 警告を追加
     */
    private addWarning;
    /**
     * 実行結果を生成
     */
    private generateExecutionResult;
    /**
     * 統合統計を生成
     */
    private generateOverallStatistics;
    private scanEnvironment;
    private getScannedFiles;
    private storeClassifications;
    private createEnvironmentBackup;
    private moveEnvironmentFiles;
    private getMovedFiles;
    private getScanResults;
    private getClassificationResults;
    private storeMoveResults;
    private getMoveResults;
    private validateConfiguration;
    private generateExecutionSummaryReport;
    private generateEnvironmentComparisonReport;
    private generateErrorAnalysisReport;
    private saveReport;
}
