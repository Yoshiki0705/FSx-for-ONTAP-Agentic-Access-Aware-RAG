/**
 * CPOS (Continuous Project Organization System) Main Entry Point
 * 継続的プロジェクト整理システムのメインエントリーポイント
 */

import { ConfigurationManager } from './core/configuration';
import { EnvironmentManager } from './core/configuration/environment-manager';
import { DatabaseManager } from './core/database';
import { EncryptionManager } from './utils/encryption';
import { FileScanner } from './core/file-scanner';
import { FileScannerFactory } from './core/file-scanner/scanner-factory';
import { FileScannerEventHandler } from './core/file-scanner/scanner-events';
import { FileClassificationEngine } from './core/classification';
import { ClassificationEngineFactory } from './core/classification/classification-factory';
import { ClassificationManager } from './core/classification/classification-manager';
import { DirectoryStructureValidator } from './core/structure-validator';
import { StructureValidatorFactory } from './core/structure-validator/validator-factory';

export class CPOSSystem {
  private configManager: ConfigurationManager;
  private environmentManager: EnvironmentManager;
  private databaseManager: DatabaseManager;
  private encryptionManager: EncryptionManager;
  private fileScanner: FileScanner | null = null;
  private scannerEventHandler: FileScannerEventHandler | null = null;
  private classificationEngine: FileClassificationEngine | null = null;
  private classificationManager: ClassificationManager | null = null;
  private structureValidator: DirectoryStructureValidator | null = null;
  private initialized: boolean = false;

  constructor() {
    this.configManager = new ConfigurationManager();
    this.environmentManager = new EnvironmentManager();
    this.databaseManager = new DatabaseManager();
    this.encryptionManager = new EncryptionManager();
  }

  /**
   * システムを初期化
   */
  async initialize(environment: string = 'local'): Promise<void> {
    try {
      console.log('CPOS システムを初期化中...');

      // 環境を設定
      this.environmentManager.setCurrentEnvironment(environment);

      // 環境設定を読み込み
      const config = await this.environmentManager.loadEnvironmentConfig();
      console.log(`環境 ${environment} の設定を読み込みました`);

      // データベースを初期化
      await this.databaseManager.initialize();
      console.log('データベースの初期化が完了しました');

      // 設定を検証
      if (!this.configManager.validateConfig(config)) {
        throw new Error('設定の検証に失敗しました');
      }

      // ファイルスキャナーを初期化
      this.fileScanner = FileScannerFactory.createFromConfig(config);
      this.scannerEventHandler = new FileScannerEventHandler(this.fileScanner, this.databaseManager);
      console.log('ファイルスキャナーを初期化しました');

      // 分類エンジンを初期化
      this.classificationEngine = ClassificationEngineFactory.createFromConfig(config);
      this.classificationManager = new ClassificationManager(this.classificationEngine, this.databaseManager);
      await this.classificationManager.initialize();
      
      // スキャナーと分類マネージャーを統合
      this.classificationManager.integrateWithScanner(this.fileScanner);
      console.log('分類エンジンを初期化しました');

      // 構造検証機能を初期化
      this.structureValidator = StructureValidatorFactory.createFromConfig(config);
      await this.structureValidator.initialize();
      console.log('構造検証機能を初期化しました');

      this.initialized = true;
      console.log('CPOS システムの初期化が完了しました');

      // システム統計を表示
      await this.displaySystemStatistics();

    } catch (error) {
      console.error('CPOS システムの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * システムが初期化されているかチェック
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('システムが初期化されていません。initialize()を先に実行してください。');
    }
  }

  /**
   * 現在の設定を取得
   */
  getConfig() {
    this.checkInitialized();
    return this.configManager.getConfig();
  }

  /**
   * 環境マネージャーを取得
   */
  getEnvironmentManager(): EnvironmentManager {
    return this.environmentManager;
  }

  /**
   * データベースマネージャーを取得
   */
  getDatabaseManager(): DatabaseManager {
    this.checkInitialized();
    return this.databaseManager;
  }

  /**
   * 暗号化マネージャーを取得
   */
  getEncryptionManager(): EncryptionManager {
    return this.encryptionManager;
  }

  /**
   * ファイルスキャナーを取得
   */
  getFileScanner(): FileScanner | null {
    return this.fileScanner;
  }

  /**
   * スキャナーイベントハンドラーを取得
   */
  getScannerEventHandler(): FileScannerEventHandler | null {
    return this.scannerEventHandler;
  }

  /**
   * 分類エンジンを取得
   */
  getClassificationEngine(): FileClassificationEngine | null {
    return this.classificationEngine;
  }

  /**
   * 分類マネージャーを取得
   */
  getClassificationManager(): ClassificationManager | null {
    return this.classificationManager;
  }

  /**
   * 構造検証機能を取得
   */
  getStructureValidator(): DirectoryStructureValidator | null {
    return this.structureValidator;
  }

  /**
   * ファイルスキャンを開始
   */
  async startFileScanning(): Promise<void> {
    this.checkInitialized();
    
    if (!this.fileScanner) {
      throw new Error('ファイルスキャナーが初期化されていません');
    }

    await this.fileScanner.startScanning();
    console.log('ファイルスキャンを開始しました');
  }

  /**
   * ファイルスキャンを停止
   */
  stopFileScanning(): void {
    if (this.fileScanner) {
      this.fileScanner.stopScanning();
      console.log('ファイルスキャンを停止しました');
    }
  }

  /**
   * ファイルを分類
   */
  async classifyFile(filePath: string, autoApply: boolean = false): Promise<any> {
    this.checkInitialized();
    
    if (!this.classificationManager) {
      throw new Error('分類マネージャーが初期化されていません');
    }

    return await this.classificationManager.classifyFile(filePath, autoApply);
  }

  /**
   * ディレクトリ全体を分類
   */
  async classifyDirectory(dirPath: string, recursive: boolean = true, autoApply: boolean = false): Promise<any[]> {
    this.checkInitialized();
    
    if (!this.classificationManager) {
      throw new Error('分類マネージャーが初期化されていません');
    }

    return await this.classificationManager.classifyDirectory(dirPath, recursive, autoApply);
  }

  /**
   * 分類統計を取得
   */
  getClassificationStatistics(): any {
    this.checkInitialized();
    
    if (!this.classificationManager) {
      return null;
    }

    return this.classificationManager.getStatistics();
  }

  /**
   * プロジェクト構造を検証
   */
  async validateProjectStructure(): Promise<any> {
    this.checkInitialized();
    
    if (!this.structureValidator) {
      throw new Error('構造検証機能が初期化されていません');
    }

    return await this.structureValidator.validateStructure();
  }

  /**
   * 構造違反を自動修正
   */
  async autoFixStructure(): Promise<any> {
    this.checkInitialized();
    
    if (!this.structureValidator) {
      throw new Error('構造検証機能が初期化されていません');
    }

    const validationResult = await this.structureValidator.validateStructure();
    return await this.structureValidator.autoFix(validationResult.suggestions);
  }

  /**
   * システム統計を表示
   */
  private async displaySystemStatistics(): Promise<void> {
    try {
      const stats = await this.databaseManager.getStatistics();
      console.log('=== CPOS システム統計 ===');
      console.log(`ファイル数: ${stats.fileCount}`);
      console.log(`同期状態数: ${stats.syncStateCount}`);
      console.log(`バックアップ数: ${stats.backupCount}`);
      console.log(`操作ログ数: ${stats.operationLogCount}`);
      
      if (this.fileScanner) {
        const scanStats = this.fileScanner.getScanStatistics();
        console.log(`キャッシュファイル数: ${scanStats.cachedFiles}`);
        console.log(`監視パス数: ${scanStats.watchPaths.length}`);
      }

      if (this.classificationManager) {
        const classStats = this.classificationManager.getStatistics();
        console.log(`分類済みファイル数: ${classStats.totalClassified}`);
        console.log(`自動適用数: ${classStats.autoApplied}`);
        console.log(`平均信頼度: ${classStats.averageConfidence.toFixed(2)}`);
      }
      
      console.log('========================');
    } catch (error) {
      console.warn('統計情報の取得に失敗しました:', error.message);
    }
  }

  /**
   * システムをシャットダウン
   */
  async shutdown(): Promise<void> {
    try {
      console.log('CPOS システムをシャットダウン中...');

      // ファイルスキャンを停止
      this.stopFileScanning();

      // 分類マネージャーをシャットダウン
      if (this.classificationManager) {
        this.classificationManager.shutdown();
      }

      // データベース接続を閉じる
      await this.databaseManager.close();

      this.initialized = false;
      console.log('CPOS システムのシャットダウンが完了しました');
    } catch (error) {
      console.error('システムのシャットダウンに失敗しました:', error);
      throw error;
    }
  }

  /**
   * システムの健全性をチェック
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // 初期化状態をチェック
      if (!this.initialized) {
        issues.push('システムが初期化されていません');
      }

      // データベース接続をチェック
      try {
        await this.databaseManager.getStatistics();
      } catch (error) {
        issues.push(`データベース接続エラー: ${error.message}`);
      }

      // 設定ファイルをチェック
      try {
        const config = this.configManager.getConfig();
        if (!this.configManager.validateConfig(config)) {
          issues.push('設定ファイルが無効です');
        }
      } catch (error) {
        issues.push(`設定エラー: ${error.message}`);
      }

      // 環境設定をチェック
      const currentEnv = this.environmentManager.getCurrentEnvironment();
      const envExists = await this.environmentManager.checkEnvironmentConfig(currentEnv);
      if (!envExists) {
        issues.push(`環境設定ファイルが見つかりません: ${currentEnv}`);
      }

      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`健全性チェック中にエラーが発生しました: ${error.message}`);
      return {
        healthy: false,
        issues
      };
    }
  }

  /**
   * システム情報を取得
   */
  getSystemInfo(): any {
    return {
      version: '1.0.0',
      initialized: this.initialized,
      currentEnvironment: this.environmentManager.getCurrentEnvironment(),
      availableEnvironments: this.environmentManager.getAvailableEnvironments(),
      timestamp: new Date().toISOString()
    };
  }
}

// エクスポート
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

// デフォルトインスタンス
export const cpos = new CPOSSystem();