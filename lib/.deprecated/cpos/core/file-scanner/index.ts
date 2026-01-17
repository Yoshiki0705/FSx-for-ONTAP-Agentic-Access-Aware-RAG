/**
 * File Scanner
 * ファイルシステムの変更監視と分析を担当
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { FileMetadata } from '../../interfaces';
import { FileMetadataModel } from '../../models';

export interface FileScannerConfig {
  watchPaths: string[];
  excludePatterns: string[];
  scanInterval: number; // milliseconds
  enableRealTimeWatch: boolean;
  maxFileSize: number; // bytes
}

export interface FileChangeEvent {
  type: 'added' | 'modified' | 'deleted';
  filePath: string;
  metadata?: FileMetadata;
  timestamp: Date;
}

export class FileScanner extends EventEmitter {
  private config: FileScannerConfig;
  private isScanning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private fileCache: Map<string, FileMetadata> = new Map();

  constructor(config: FileScannerConfig) {
    super();
    this.config = config;
  }

  /**
   * ファイルスキャンを開始
   */
  async startScanning(): Promise<void> {
    if (this.isScanning) {
      console.warn('ファイルスキャンは既に実行中です');
      return;
    }

    console.log('ファイルスキャンを開始します...');
    this.isScanning = true;

    // 初回スキャン
    await this.performFullScan();

    // 定期スキャンの設定
    if (this.config.scanInterval > 0) {
      this.scanInterval = setInterval(async () => {
        await this.performIncrementalScan();
      }, this.config.scanInterval);
    }

    this.emit('scanStarted');
  }

  /**
   * ファイルスキャンを停止
   */
  stopScanning(): void {
    if (!this.isScanning) {
      return;
    }

    console.log('ファイルスキャンを停止します...');
    this.isScanning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.emit('scanStopped');
  }

  /**
   * 完全スキャンを実行
   */
  private async performFullScan(): Promise<void> {
    console.log('完全スキャンを実行中...');
    const startTime = Date.now();
    let scannedFiles = 0;

    try {
      for (const watchPath of this.config.watchPaths) {
        await this.scanDirectory(watchPath, true);
        scannedFiles++;
      }

      const duration = Date.now() - startTime;
      console.log(`完全スキャン完了: ${scannedFiles} ファイル (${duration}ms)`);
      
      this.emit('fullScanCompleted', {
        scannedFiles,
        duration,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('完全スキャン中にエラーが発生しました:', error);
      this.emit('scanError', error);
    }
  }

  /**
   * 増分スキャンを実行
   */
  private async performIncrementalScan(): Promise<void> {
    if (!this.isScanning) {
      return;
    }

    const startTime = Date.now();
    let changedFiles = 0;

    try {
      for (const watchPath of this.config.watchPaths) {
        const changes = await this.scanDirectory(watchPath, false);
        changedFiles += changes;
      }

      const duration = Date.now() - startTime;
      if (changedFiles > 0) {
        console.log(`増分スキャン完了: ${changedFiles} 件の変更 (${duration}ms)`);
      }

      this.emit('incrementalScanCompleted', {
        changedFiles,
        duration,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('増分スキャン中にエラーが発生しました:', error);
      this.emit('scanError', error);
    }
  }

  /**
   * ディレクトリをスキャン
   */
  private async scanDirectory(dirPath: string, isFullScan: boolean): Promise<number> {
    let changeCount = 0;

    try {
      // ディレクトリの存在確認
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return 0;
      }

      // ディレクトリ内のファイル一覧を取得
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // 除外パターンのチェック
        if (this.shouldExclude(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // サブディレクトリを再帰的にスキャン
          changeCount += await this.scanDirectory(fullPath, isFullScan);
        } else if (entry.isFile()) {
          // ファイルを処理
          const hasChanged = await this.processFile(fullPath, isFullScan);
          if (hasChanged) {
            changeCount++;
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`ディレクトリスキャンエラー (${dirPath}):`, error);
      }
    }

    return changeCount;
  }

  /**
   * ファイルを処理
   */
  private async processFile(filePath: string, isFullScan: boolean): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);

      // ファイルサイズチェック
      if (stats.size > this.config.maxFileSize) {
        console.warn(`ファイルサイズが上限を超えています: ${filePath} (${stats.size} bytes)`);
        return false;
      }

      // ファイルメタデータを生成
      const metadata = await this.generateFileMetadata(filePath, stats);
      
      // キャッシュと比較して変更を検出
      const cachedMetadata = this.fileCache.get(filePath);
      const hasChanged = isFullScan || !cachedMetadata || 
                        cachedMetadata.checksum !== metadata.checksum ||
                        cachedMetadata.modified.getTime() !== metadata.modified.getTime();

      if (hasChanged) {
        // キャッシュを更新
        this.fileCache.set(filePath, metadata);

        // 変更イベントを発行
        const eventType = cachedMetadata ? 'modified' : 'added';
        const changeEvent: FileChangeEvent = {
          type: eventType,
          filePath,
          metadata,
          timestamp: new Date()
        };

        this.emit('fileChanged', changeEvent);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`ファイル処理エラー (${filePath}):`, error);
      return false;
    }
  }

  /**
   * ファイルメタデータを生成
   */
  private async generateFileMetadata(filePath: string, stats: any): Promise<FileMetadata> {
    // ファイルのハッシュ値を計算
    const checksum = await this.calculateFileHash(filePath);
    
    // MIMEタイプを推定
    const mimeType = this.guessMimeType(filePath);

    return {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      checksum,
      mimeType,
      tags: [],
      environment: 'local' // デフォルトはローカル環境
    };
  }

  /**
   * ファイルのハッシュ値を計算
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error(`ハッシュ計算エラー (${filePath}):`, error);
      return '';
    }
  }

  /**
   * MIMEタイプを推定
   */
  private guessMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.xml': 'text/xml',
      '.sh': 'text/x-shellscript',
      '.py': 'text/x-python',
      '.sql': 'text/x-sql',
      '.dockerfile': 'text/x-dockerfile',
      '.gitignore': 'text/plain',
      '.env': 'text/plain'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * ファイルが除外対象かチェック
   */
  private shouldExclude(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    
    return this.config.excludePatterns.some(pattern => {
      // 簡単なグロブパターンマッチング
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(normalizedPath);
      }
      
      // 直接マッチング
      return normalizedPath.includes(pattern);
    });
  }

  /**
   * 削除されたファイルを検出
   */
  async detectDeletedFiles(): Promise<FileChangeEvent[]> {
    const deletedFiles: FileChangeEvent[] = [];

    this.fileCache.forEach((metadata, filePath) => {
      (async () => {
        try {
          await fs.access(filePath);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // ファイルが削除されている
            deletedFiles.push({
              type: 'deleted',
              filePath,
              metadata,
              timestamp: new Date()
            });

            // キャッシュから削除
            this.fileCache.delete(filePath);
          }
        }
      })();
    });

    // 削除イベントを発行
    deletedFiles.forEach(event => {
      this.emit('fileChanged', event);
    });

    return deletedFiles;
  }

  /**
   * 特定のファイルを強制スキャン
   */
  async scanFile(filePath: string): Promise<FileMetadata | null> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const metadata = await this.generateFileMetadata(filePath, stats);
        this.fileCache.set(filePath, metadata);
        return metadata;
      }
    } catch (error) {
      console.error(`ファイルスキャンエラー (${filePath}):`, error);
    }
    
    return null;
  }

  /**
   * スキャン統計を取得
   */
  getScanStatistics(): any {
    return {
      isScanning: this.isScanning,
      cachedFiles: this.fileCache.size,
      watchPaths: this.config.watchPaths,
      excludePatterns: this.config.excludePatterns,
      scanInterval: this.config.scanInterval
    };
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.fileCache.clear();
    console.log('ファイルキャッシュをクリアしました');
  }
}