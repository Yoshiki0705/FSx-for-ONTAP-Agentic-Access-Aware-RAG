/**
 * 統合ファイル整理システム - ローカルファイル移動器
 *
 * ローカル環境でのファイル移動機能を提供し、
 * Agent Steering準拠の構造への安全な移動を実行します。
 */
import { FileMover, FileInfo, ClassificationResult, MoveResult, MoveOptions } from '../types/index.js';
/**
 * 移動進捗情報
 */
export interface MoveProgress {
    /** 現在の処理ファイル */
    currentFile: string;
    /** 処理済みファイル数 */
    processedFiles: number;
    /** 総ファイル数 */
    totalFiles: number;
    /** 進捗率（0-100） */
    progressPercentage: number;
    /** 成功したファイル数 */
    successfulMoves: number;
    /** 失敗したファイル数 */
    failedMoves: number;
    /** 開始時刻 */
    startTime: Date;
    /** 推定残り時間（ミリ秒） */
    estimatedTimeRemaining?: number;
}
/**
 * 移動統計情報
 */
export interface MoveStatistics {
    /** 総処理ファイル数 */
    totalFiles: number;
    /** 成功したファイル数 */
    successfulMoves: number;
    /** 失敗したファイル数 */
    failedMoves: number;
    /** スキップしたファイル数 */
    skippedFiles: number;
    /** 処理時間（ミリ秒） */
    processingTime: number;
    /** 移動したファイルサイズ合計（バイト） */
    totalMovedSize: number;
    /** 平均移動時間（ミリ秒/ファイル） */
    averageMoveTime: number;
    /** エラー詳細 */
    errors: Array<{
        file: string;
        error: string;
    }>;
}
/**
 * ローカルファイル移動器
 *
 * ローカル環境でのファイル移動を安全に実行し、
 * 進捗追跡と詳細な統計情報を提供します。
 */
export declare class LocalFileMover implements FileMover {
    private readonly environment;
    private moveProgress?;
    private progressCallback?;
    /**
     * 複数ファイルを一括移動
     */
    moveFiles(files: FileInfo[], classifications: ClassificationResult[], options?: MoveOptions): Promise<MoveResult>;
    /**
     * 単一ファイルを移動
     */
    moveSingleFile(file: FileInfo, classification: ClassificationResult, options?: MoveOptions): Promise<{
        success: boolean;
        newPath?: string;
        error?: string;
    }>;
    /**
     * 移動操作の検証
     */
    validateMoveOperation(files: FileInfo[], classifications: ClassificationResult[], options: MoveOptions): Promise<void>;
    /**
     * 進捗コールバックを設定
     */
    setProgressCallback(callback: (progress: MoveProgress) => void): void;
    /**
     * 現在の進捗を取得
     */
    getCurrentProgress(): MoveProgress | undefined;
    /**
     * 移動をキャンセル（実装簡略化）
     */
    cancelMove(): Promise<void>;
    /**
     * 移動先パスを生成
     */
    private generateTargetPath;
    /**
     * ディレクトリの存在確認・作成
     */
    private ensureDirectoryExists;
    /**
     * ファイル名の重複を解決
     */
    private resolveFileNameConflict;
    /**
     * ファイル移動を実行
     */
    private executeFileMove;
    /**
     * ファイル権限を設定
     */
    private setFilePermissions;
    /**
     * ディスク容量をチェック
     */
    private checkDiskSpace;
    /**
     * 進捗追跡を初期化
     */
    private initializeProgress;
    /**
     * 進捗を更新
     */
    private updateProgress;
    /**
     * ドライラン結果を作成
     */
    private createDryRunResult;
    /**
     * 移動結果を検証
     */
    verifyMoveResults(moveResult: MoveResult): Promise<{
        verified: boolean;
        missingFiles: string[];
        corruptedFiles: string[];
        permissionIssues: string[];
    }>;
    /**
     * 移動統計レポートを生成
     */
    generateMoveReport(moveResult: MoveResult): string;
}
