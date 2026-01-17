/**
 * CPOS (Continuous Project Organization System) Main Entry Point
 * 継続的プロジェクト整理システムのメインエントリーポイント
 */
import { EnvironmentManager } from './core/configuration/environment-manager';
import { DatabaseManager } from './core/database';
import { EncryptionManager } from './utils/encryption';
import { FileScanner } from './core/file-scanner';
import { FileScannerEventHandler } from './core/file-scanner/scanner-events';
import { FileClassificationEngine } from './core/classification';
import { ClassificationManager } from './core/classification/classification-manager';
import { DirectoryStructureValidator } from './core/structure-validator';
export declare class CPOSSystem {
    private configManager;
    private environmentManager;
    private databaseManager;
    private encryptionManager;
    private fileScanner;
    private scannerEventHandler;
    private classificationEngine;
    private classificationManager;
    private structureValidator;
    private initialized;
    constructor();
    /**
     * システムを初期化
     */
    initialize(environment?: string): Promise<void>;
    /**
     * システムが初期化されているかチェック
     */
    private checkInitialized;
    /**
     * 現在の設定を取得
     */
    getConfig(): import("./core/configuration").CPOSConfig;
    /**
     * 環境マネージャーを取得
     */
    getEnvironmentManager(): EnvironmentManager;
    /**
     * データベースマネージャーを取得
     */
    getDatabaseManager(): DatabaseManager;
    /**
     * 暗号化マネージャーを取得
     */
    getEncryptionManager(): EncryptionManager;
    /**
     * ファイルスキャナーを取得
     */
    getFileScanner(): FileScanner | null;
    /**
     * スキャナーイベントハンドラーを取得
     */
    getScannerEventHandler(): FileScannerEventHandler | null;
    /**
     * 分類エンジンを取得
     */
    getClassificationEngine(): FileClassificationEngine | null;
    /**
     * 分類マネージャーを取得
     */
    getClassificationManager(): ClassificationManager | null;
    /**
     * 構造検証機能を取得
     */
    getStructureValidator(): DirectoryStructureValidator | null;
    /**
     * ファイルスキャンを開始
     */
    startFileScanning(): Promise<void>;
    /**
     * ファイルスキャンを停止
     */
    stopFileScanning(): void;
    /**
     * ファイルを分類
     */
    classifyFile(filePath: string, autoApply?: boolean): Promise<any>;
    /**
     * ディレクトリ全体を分類
     */
    classifyDirectory(dirPath: string, recursive?: boolean, autoApply?: boolean): Promise<any[]>;
    /**
     * 分類統計を取得
     */
    getClassificationStatistics(): any;
    /**
     * プロジェクト構造を検証
     */
    validateProjectStructure(): Promise<any>;
    /**
     * 構造違反を自動修正
     */
    autoFixStructure(): Promise<any>;
    /**
     * システム統計を表示
     */
    private displaySystemStatistics;
    /**
     * システムをシャットダウン
     */
    shutdown(): Promise<void>;
    /**
     * システムの健全性をチェック
     */
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    /**
     * システム情報を取得
     */
    getSystemInfo(): any;
}
export * from './interfaces';
export * from './models';
export * from './core/configuration';
export * from './core/configuration/environment-manager';
export * from './core/database';
export * from './utils/encryption';
export * from './core/file-scanner';
export * from './core/file-scanner/scanner-factory';
export * from './core/file-scanner/scanner-events';
export * from './core/classification';
export * from './core/classification/classification-factory';
export * from './core/classification/classification-manager';
export * from './core/structure-validator';
export * from './core/structure-validator/validator-factory';
export declare const cpos: CPOSSystem;
