/**
 * Classification Manager
 * 分類エンジンの管理とファイルスキャナーとの統合
 */
import { EventEmitter } from 'events';
import { FileClassificationEngine } from './index';
import { FileScanner } from '../file-scanner';
import { DatabaseManager } from '../database';
import { ClassificationResult } from '../../interfaces';
export interface ClassificationEvent {
    filePath: string;
    result: ClassificationResult;
    applied: boolean;
    timestamp: Date;
}
export interface ClassificationStats {
    totalClassified: number;
    autoApplied: number;
    manualReview: number;
    averageConfidence: number;
    categoryDistribution: {
        [category: string]: number;
    };
}
export declare class ClassificationManager extends EventEmitter {
    private engine;
    private databaseManager;
    private stats;
    private classificationQueue;
    private isProcessing;
    private processingInterval;
    constructor(engine: FileClassificationEngine, databaseManager: DatabaseManager);
    /**
     * 分類マネージャーを初期化
     */
    initialize(): Promise<void>;
    /**
     * ファイルスキャナーと統合
     */
    integrateWithScanner(scanner: FileScanner): void;
    /**
     * ファイル変更イベントを処理
     */
    private handleFileChanged;
    /**
     * 分類が必要なファイルのイベントを処理
     */
    private handleFileNeedsClassification;
    /**
     * ファイルを分類キューに追加
     */
    queueForClassification(filePath: string): Promise<void>;
    /**
     * ファイルを即座に分類
     */
    classifyFile(filePath: string, autoApply?: boolean): Promise<ClassificationResult>;
    /**
     * 分類結果を適用
     */
    applyClassification(filePath: string, result: ClassificationResult): Promise<boolean>;
    /**
     * 処理キューを開始
     */
    private startProcessingQueue;
    /**
     * 処理キューを停止
     */
    private stopProcessingQueue;
    /**
     * キューを処理
     */
    private processQueue;
    /**
     * 統計を初期化
     */
    private initializeStats;
    /**
     * 統計を更新
     */
    private updateStats;
    /**
     * 複数ファイルを一括分類
     */
    classifyBatch(filePaths: string[], autoApply?: boolean): Promise<ClassificationResult[]>;
    /**
     * ディレクトリ全体を分類
     */
    classifyDirectory(dirPath: string, recursive?: boolean, autoApply?: boolean): Promise<ClassificationResult[]>;
    /**
     * 分類統計を取得
     */
    getStatistics(): ClassificationStats;
    /**
     * 分類エンジンの統計を取得
     */
    getEngineStatistics(): any;
    /**
     * キューの状態を取得
     */
    getQueueStatus(): {
        queueLength: number;
        isProcessing: boolean;
    };
    /**
     * 統計をリセット
     */
    resetStatistics(): void;
    /**
     * シャットダウン
     */
    shutdown(): void;
}
