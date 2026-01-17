/**
 * File Scanner Event Handlers
 * ファイルスキャナーのイベントハンドラー
 */
import { FileScanner, FileChangeEvent } from './index';
import { DatabaseManager } from '../database';
export declare class FileScannerEventHandler {
    private scanner;
    private databaseManager;
    private eventLog;
    private maxEventLogSize;
    constructor(scanner: FileScanner, databaseManager: DatabaseManager);
    /**
     * イベントハンドラーを設定
     */
    private setupEventHandlers;
    /**
     * ファイル変更イベントを処理
     */
    private handleFileChanged;
    /**
     * スキャン開始イベントを処理
     */
    private handleScanStarted;
    /**
     * スキャン停止イベントを処理
     */
    private handleScanStopped;
    /**
     * 完全スキャン完了イベントを処理
     */
    private handleFullScanCompleted;
    /**
     * 増分スキャン完了イベントを処理
     */
    private handleIncrementalScanCompleted;
    /**
     * スキャンエラーイベントを処理
     */
    private handleScanError;
    /**
     * イベントログに追加
     */
    private addToEventLog;
    /**
     * 操作ログを記録
     */
    private logOperation;
    /**
     * イベントタイプのテキストを取得
     */
    private getEventTypeText;
    /**
     * 最近のイベントログを取得
     */
    getRecentEvents(limit?: number): FileChangeEvent[];
    /**
     * 特定のファイルのイベント履歴を取得
     */
    getFileEventHistory(filePath: string): FileChangeEvent[];
    /**
     * イベント統計を取得
     */
    getEventStatistics(): any;
    /**
     * イベントログをクリア
     */
    clearEventLog(): void;
}
