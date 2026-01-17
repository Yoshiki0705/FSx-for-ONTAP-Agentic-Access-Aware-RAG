/**
 * File Scanner Event Handlers
 * ファイルスキャナーのイベントハンドラー
 */

import { FileScanner, FileChangeEvent } from './index';
import { DatabaseManager } from '../database';
import { FileMetadataModel } from '../../models';

export class FileScannerEventHandler {
  private scanner: FileScanner;
  private databaseManager: DatabaseManager;
  private eventLog: FileChangeEvent[] = [];
  private maxEventLogSize: number = 1000;

  constructor(scanner: FileScanner, databaseManager: DatabaseManager) {
    this.scanner = scanner;
    this.databaseManager = databaseManager;
    this.setupEventHandlers();
  }

  /**
   * イベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    // ファイル変更イベント
    this.scanner.on('fileChanged', this.handleFileChanged.bind(this));
    
    // スキャン開始イベント
    this.scanner.on('scanStarted', this.handleScanStarted.bind(this));
    
    // スキャン停止イベント
    this.scanner.on('scanStopped', this.handleScanStopped.bind(this));
    
    // 完全スキャン完了イベント
    this.scanner.on('fullScanCompleted', this.handleFullScanCompleted.bind(this));
    
    // 増分スキャン完了イベント
    this.scanner.on('incrementalScanCompleted', this.handleIncrementalScanCompleted.bind(this));
    
    // スキャンエラーイベント
    this.scanner.on('scanError', this.handleScanError.bind(this));
  }

  /**
   * ファイル変更イベントを処理
   */
  private async handleFileChanged(event: FileChangeEvent): Promise<void> {
    try {
      // イベントログに追加
      this.addToEventLog(event);

      // データベースに保存
      if (event.metadata) {
        const fileMetadata = new FileMetadataModel(
          undefined,
          event.metadata.path,
          event.metadata.size,
          event.metadata.checksum,
          event.metadata.mimeType,
          event.metadata.category,
          event.metadata.created,
          event.metadata.modified,
          event.metadata.environment
        );

        await this.databaseManager.upsertFileMetadata(fileMetadata);
      }

      // ログ出力
      console.log(`ファイル${this.getEventTypeText(event.type)}: ${event.filePath}`);

      // 分類が必要なファイルの場合は分類イベントを発行
      if (event.type === 'added' || event.type === 'modified') {
        this.scanner.emit('fileNeedsClassification', {
          filePath: event.filePath,
          metadata: event.metadata
        });
      }

    } catch (error) {
      console.error('ファイル変更イベント処理エラー:', error);
    }
  }

  /**
   * スキャン開始イベントを処理
   */
  private handleScanStarted(): void {
    console.log('📁 ファイルスキャンが開始されました');
    this.logOperation('scan_started', 'ファイルスキャン開始');
  }

  /**
   * スキャン停止イベントを処理
   */
  private handleScanStopped(): void {
    console.log('⏹️  ファイルスキャンが停止されました');
    this.logOperation('scan_stopped', 'ファイルスキャン停止');
  }

  /**
   * 完全スキャン完了イベントを処理
   */
  private handleFullScanCompleted(result: any): void {
    console.log(`✅ 完全スキャン完了: ${result.scannedFiles} ファイル (${result.duration}ms)`);
    this.logOperation('full_scan_completed', `完全スキャン完了: ${result.scannedFiles} ファイル`, result);
  }

  /**
   * 増分スキャン完了イベントを処理
   */
  private handleIncrementalScanCompleted(result: any): void {
    if (result.changedFiles > 0) {
      console.log(`🔄 増分スキャン完了: ${result.changedFiles} 件の変更 (${result.duration}ms)`);
      this.logOperation('incremental_scan_completed', `増分スキャン完了: ${result.changedFiles} 件の変更`, result);
    }
  }

  /**
   * スキャンエラーイベントを処理
   */
  private handleScanError(error: Error): void {
    console.error('❌ スキャンエラー:', error.message);
    this.logOperation('scan_error', `スキャンエラー: ${error.message}`, { error: error.message });
  }

  /**
   * イベントログに追加
   */
  private addToEventLog(event: FileChangeEvent): void {
    this.eventLog.push(event);
    
    // ログサイズ制限
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxEventLogSize);
    }
  }

  /**
   * 操作ログを記録
   */
  private async logOperation(operationType: string, description: string, details?: any): Promise<void> {
    try {
      const operationLog = new (await import('../../models')).OperationLogModel(
        undefined,
        operationType,
        'completed',
        new Date(),
        new Date(),
        JSON.stringify(details || {}),
        undefined
      );

      await this.databaseManager.insertOperationLog(operationLog);
    } catch (error) {
      console.error('操作ログ記録エラー:', error);
    }
  }

  /**
   * イベントタイプのテキストを取得
   */
  private getEventTypeText(type: string): string {
    switch (type) {
      case 'added': return '追加';
      case 'modified': return '変更';
      case 'deleted': return '削除';
      default: return type;
    }
  }

  /**
   * 最近のイベントログを取得
   */
  getRecentEvents(limit: number = 50): FileChangeEvent[] {
    return this.eventLog.slice(-limit);
  }

  /**
   * 特定のファイルのイベント履歴を取得
   */
  getFileEventHistory(filePath: string): FileChangeEvent[] {
    return this.eventLog.filter(event => event.filePath === filePath);
  }

  /**
   * イベント統計を取得
   */
  getEventStatistics(): any {
    const stats = {
      totalEvents: this.eventLog.length,
      addedFiles: 0,
      modifiedFiles: 0,
      deletedFiles: 0,
      recentActivity: this.eventLog.slice(-10)
    };

    this.eventLog.forEach(event => {
      switch (event.type) {
        case 'added': stats.addedFiles++; break;
        case 'modified': stats.modifiedFiles++; break;
        case 'deleted': stats.deletedFiles++; break;
      }
    });

    return stats;
  }

  /**
   * イベントログをクリア
   */
  clearEventLog(): void {
    this.eventLog = [];
    console.log('イベントログをクリアしました');
  }
}