/**
 * File Scanner
 * ファイルシステムの変更監視と分析を担当
 */
import { EventEmitter } from 'events';
import { FileMetadata } from '../../interfaces';
export interface FileScannerConfig {
    watchPaths: string[];
    excludePatterns: string[];
    scanInterval: number;
    enableRealTimeWatch: boolean;
    maxFileSize: number;
}
export interface FileChangeEvent {
    type: 'added' | 'modified' | 'deleted';
    filePath: string;
    metadata?: FileMetadata;
    timestamp: Date;
}
export declare class FileScanner extends EventEmitter {
    private config;
    private isScanning;
    private scanInterval;
    private fileCache;
    constructor(config: FileScannerConfig);
    /**
     * ファイルスキャンを開始
     */
    startScanning(): Promise<void>;
    /**
     * ファイルスキャンを停止
     */
    stopScanning(): void;
    /**
     * 完全スキャンを実行
     */
    private performFullScan;
    /**
     * 増分スキャンを実行
     */
    private performIncrementalScan;
    /**
     * ディレクトリをスキャン
     */
    private scanDirectory;
    /**
     * ファイルを処理
     */
    private processFile;
    /**
     * ファイルメタデータを生成
     */
    private generateFileMetadata;
    /**
     * ファイルのハッシュ値を計算
     */
    private calculateFileHash;
    /**
     * MIMEタイプを推定
     */
    private guessMimeType;
    /**
     * ファイルが除外対象かチェック
     */
    private shouldExclude;
    /**
     * 削除されたファイルを検出
     */
    detectDeletedFiles(): Promise<FileChangeEvent[]>;
    /**
     * 特定のファイルを強制スキャン
     */
    scanFile(filePath: string): Promise<FileMetadata | null>;
    /**
     * スキャン統計を取得
     */
    getScanStatistics(): any;
    /**
     * キャッシュをクリア
     */
    clearCache(): void;
}
