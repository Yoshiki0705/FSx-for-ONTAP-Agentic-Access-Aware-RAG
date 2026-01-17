/**
 * Classification Manager
 * 分類エンジンの管理とファイルスキャナーとの統合
 */

import { EventEmitter } from 'events';
import { FileClassificationEngine } from './index';
import { ClassificationEngineFactory } from './classification-factory';
import { FileScanner, FileChangeEvent } from '../file-scanner';
import { DatabaseManager } from '../database';
import { FileMetadataModel } from '../../models';
import { ClassificationResult } from '../../interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  categoryDistribution: { [category: string]: number };
}

export class ClassificationManager extends EventEmitter {
  private engine: FileClassificationEngine;
  private databaseManager: DatabaseManager;
  private stats: ClassificationStats;
  private classificationQueue: string[] = [];
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(engine: FileClassificationEngine, databaseManager: DatabaseManager) {
    super();
    this.engine = engine;
    this.databaseManager = databaseManager;
    this.stats = this.initializeStats();
  }

  /**
   * 分類マネージャーを初期化
   */
  async initialize(): Promise<void> {
    try {
      // 分類エンジンを初期化
      await this.engine.initialize();
      
      // 処理キューを開始
      this.startProcessingQueue();
      
      console.log('分類マネージャーを初期化しました');
    } catch (error) {
      console.error('分類マネージャーの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ファイルスキャナーと統合
   */
  integrateWithScanner(scanner: FileScanner): void {
    // ファイル変更イベントをリッスン
    scanner.on('fileChanged', this.handleFileChanged.bind(this));
    
    // 分類が必要なファイルのイベントをリッスン
    scanner.on('fileNeedsClassification', this.handleFileNeedsClassification.bind(this));
    
    console.log('ファイルスキャナーとの統合が完了しました');
  }

  /**
   * ファイル変更イベントを処理
   */
  private async handleFileChanged(event: FileChangeEvent): Promise<void> {
    if (event.type === 'added' || event.type === 'modified') {
      await this.queueForClassification(event.filePath);
    }
  }

  /**
   * 分類が必要なファイルのイベントを処理
   */
  private async handleFileNeedsClassification(event: any): Promise<void> {
    await this.queueForClassification(event.filePath);
  }

  /**
   * ファイルを分類キューに追加
   */
  async queueForClassification(filePath: string): Promise<void> {
    if (!this.classificationQueue.includes(filePath)) {
      this.classificationQueue.push(filePath);
      console.log(`分類キューに追加: ${filePath}`);
    }
  }

  /**
   * ファイルを即座に分類
   */
  async classifyFile(filePath: string, autoApply: boolean = false): Promise<ClassificationResult> {
    try {
      console.log(`ファイルを分類中: ${filePath}`);
      
      // ファイルの分類を実行
      const result = await this.engine.classifyFile(filePath);
      
      // 統計を更新
      this.updateStats(result, autoApply && result.confidence >= 0.7);
      
      // 分類イベントを発行
      const classificationEvent: ClassificationEvent = {
        filePath,
        result,
        applied: false,
        timestamp: new Date()
      };
      
      // 自動適用の判定
      if (autoApply && result.confidence >= 0.7) {
        const applied = await this.applyClassification(filePath, result);
        classificationEvent.applied = applied;
      }
      
      this.emit('fileClassified', classificationEvent);
      
      return result;
    } catch (error) {
      console.error(`ファイル分類エラー (${filePath}):`, error);
      throw error;
    }
  }

  /**
   * 分類結果を適用
   */
  async applyClassification(filePath: string, result: ClassificationResult): Promise<boolean> {
    try {
      const targetPath = result.suggestedPath;
      const fileName = path.basename(filePath);
      const newFilePath = path.join(targetPath, fileName);
      
      // ターゲットディレクトリが存在しない場合は作成
      await fs.mkdir(path.dirname(newFilePath), { recursive: true });
      
      // ファイルが既に正しい場所にある場合はスキップ
      if (path.resolve(filePath) === path.resolve(newFilePath)) {
        console.log(`ファイルは既に正しい場所にあります: ${filePath}`);
        return true;
      }
      
      // ファイルを移動
      await fs.rename(filePath, newFilePath);
      
      // データベースのメタデータを更新
      const metadata = await this.databaseManager.getFileMetadata(filePath);
      if (metadata) {
        metadata.path = newFilePath;
        metadata.category = result.category;
        await this.databaseManager.upsertFileMetadata(metadata);
      }
      
      console.log(`ファイルを移動しました: ${filePath} → ${newFilePath}`);
      
      // 適用イベントを発行
      this.emit('classificationApplied', {
        originalPath: filePath,
        newPath: newFilePath,
        result,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      console.error(`分類適用エラー (${filePath}):`, error);
      return false;
    }
  }

  /**
   * 処理キューを開始
   */
  private startProcessingQueue(): void {
    if (this.processingInterval) {
      return;
    }
    
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, 5000); // 5秒間隔で処理
  }

  /**
   * 処理キューを停止
   */
  private stopProcessingQueue(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * キューを処理
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.classificationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // キューから最大5件を処理
      const batch = this.classificationQueue.splice(0, 5);
      
      for (const filePath of batch) {
        try {
          await this.classifyFile(filePath, true); // 自動適用有効
        } catch (error) {
          console.error(`キュー処理エラー (${filePath}):`, error);
        }
      }
      
      if (batch.length > 0) {
        console.log(`分類キューを処理しました: ${batch.length} ファイル`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 統計を初期化
   */
  private initializeStats(): ClassificationStats {
    return {
      totalClassified: 0,
      autoApplied: 0,
      manualReview: 0,
      averageConfidence: 0,
      categoryDistribution: {}
    };
  }

  /**
   * 統計を更新
   */
  private updateStats(result: ClassificationResult, applied: boolean): void {
    this.stats.totalClassified++;
    
    if (applied) {
      this.stats.autoApplied++;
    } else {
      this.stats.manualReview++;
    }
    
    // 平均信頼度を更新
    const totalConfidence = this.stats.averageConfidence * (this.stats.totalClassified - 1) + result.confidence;
    this.stats.averageConfidence = totalConfidence / this.stats.totalClassified;
    
    // カテゴリ分布を更新
    const category = result.category || 'unknown';
    this.stats.categoryDistribution[category] = (this.stats.categoryDistribution[category] || 0) + 1;
  }

  /**
   * 複数ファイルを一括分類
   */
  async classifyBatch(filePaths: string[], autoApply: boolean = false): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    console.log(`一括分類を開始: ${filePaths.length} ファイル`);
    
    for (const filePath of filePaths) {
      try {
        const result = await this.classifyFile(filePath, autoApply);
        results.push(result);
      } catch (error) {
        console.error(`一括分類エラー (${filePath}):`, error);
      }
    }
    
    console.log(`一括分類が完了: ${results.length}/${filePaths.length} ファイル`);
    
    return results;
  }

  /**
   * ディレクトリ全体を分類
   */
  async classifyDirectory(dirPath: string, recursive: boolean = true, autoApply: boolean = false): Promise<ClassificationResult[]> {
    const filePaths: string[] = [];
    
    const scanDirectory = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isFile()) {
            filePaths.push(fullPath);
          } else if (entry.isDirectory() && recursive) {
            await scanDirectory(fullPath);
          }
        }
      } catch (error) {
        console.error(`ディレクトリスキャンエラー (${currentPath}):`, error);
      }
    };
    
    await scanDirectory(dirPath);
    return await this.classifyBatch(filePaths, autoApply);
  }

  /**
   * 分類統計を取得
   */
  getStatistics(): ClassificationStats {
    return { ...this.stats };
  }

  /**
   * 分類エンジンの統計を取得
   */
  getEngineStatistics(): any {
    return this.engine.getClassificationStatistics();
  }

  /**
   * キューの状態を取得
   */
  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.classificationQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * 統計をリセット
   */
  resetStatistics(): void {
    this.stats = this.initializeStats();
    console.log('分類統計をリセットしました');
  }

  /**
   * シャットダウン
   */
  shutdown(): void {
    this.stopProcessingQueue();
    console.log('分類マネージャーをシャットダウンしました');
  }
}