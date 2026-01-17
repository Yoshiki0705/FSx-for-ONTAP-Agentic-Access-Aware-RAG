/**
 * 本番環境テスト実行エンジン
 * 
 * 実本番AWSリソースでのテスト実行を安全に管理
 * 読み取り専用モードでの実行制御と緊急停止機能を提供
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { EventEmitter } from 'events';
import ProductionConnectionManager, { ConnectionResult } from './production-connection-manager';
import EmergencyStopManager, { EmergencyStopReason, ActiveTest } from './emergency-stop-manager';
import { ProductionConfig } from '../config/production-config';

/**
 * テスト実行状態
 */
export enum TestExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
  SKIPPED = 'SKIPPED'
}

/**
 * テスト結果インターフェース
 */
export interface TestResult {
  testId: string;
  testName: string;
  category: string;
  status: TestExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration: number;
  success: boolean;
  error?: string;
  metrics?: any;
  metadata?: any;
}

/**
 * テストスイートインターフェース
 */
export interface TestSuite {
  suiteId: string;
  suiteName: string;
  description: string;
  tests: TestDefinition[];
  configuration: TestSuiteConfig;
}

/**
 * テスト定義インターフェース
 */
export interface TestDefinition {
  testId: string;
  testName: string;
  category: string;
  description: string;
  timeout: number;
  retryCount: number;
  dependencies: string[];
  execute: (engine: ProductionTestEngine) => Promise<TestResult>;
}

/**
 * テストスイート設定
 */
export interface TestSuiteConfig {
  parallel: boolean;
  maxConcurrency: number;
  failFast: boolean;
  continueOnError: boolean;
}

/**
 * 実行統計
 */
export interface ExecutionStatistics {
  totalTests: number;
  completedTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
}

/**
 * 本番環境テスト実行エンジンクラス
 */
export class ProductionTestEngine extends EventEmitter {
  private config: ProductionConfig;
  private connectionManager: ProductionConnectionManager;
  private emergencyStopManager: EmergencyStopManager;
  private isInitialized: boolean = false;
  private currentExecution: {
    suiteId: string;
    startTime: Date;
    results: Map<string, TestResult>;
    statistics: ExecutionStatistics;
  } | null = null;

  constructor(config: ProductionConfig) {
    super();
    this.config = config;
    this.connectionManager = new ProductionConnectionManager(config);
    this.emergencyStopManager = new EmergencyStopManager(config);

    this.setupEventHandlers();
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // 緊急停止イベントの処理
    this.emergencyStopManager.on('emergencyStopCompleted', (stopState) => {
      console.log('🛑 緊急停止が完了しました');
      this.emit('emergencyStopCompleted', stopState);
    });

    this.emergencyStopManager.on('emergencyStopFailed', (error) => {
      console.error('❌ 緊急停止処理に失敗しました:', error);
      this.emit('emergencyStopFailed', error);
    });
  }

  /**
   * エンジンの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ エンジンは既に初期化されています');
      return;
    }

    console.log('🚀 本番環境テストエンジンを初期化中...');

    try {
      // 1. 設定の検証
      await this.validateConfiguration();

      // 2. 本番環境への接続テスト
      const connectionResult = await this.connectionManager.testProductionConnection();
      if (!connectionResult.success) {
        throw new Error(`本番環境接続に失敗しました: ${connectionResult.failedServices.join(', ')}`);
      }

      // 3. 安全性制約の確認
      await this.validateSafetyConstraints();

      this.isInitialized = true;
      console.log('✅ 本番環境テストエンジンの初期化完了');
      this.emit('initialized');

    } catch (error) {
      console.error('❌ エンジン初期化エラー:', error);
      throw error;
    }
  }

  /**
   * 設定の検証
   */
  private async validateConfiguration(): Promise<void> {
    console.log('🔍 設定を検証中...');

    // 必須設定の確認
    if (!this.config.safetyMode) {
      throw new Error('本番環境テストでは safetyMode が必須です');
    }

    if (!this.config.readOnlyMode) {
      throw new Error('本番環境テストでは readOnlyMode が必須です');
    }

    if (!this.config.emergencyStopEnabled) {
      throw new Error('本番環境テストでは emergencyStopEnabled が必須です');
    }

    if (this.config.region !== 'ap-northeast-1') {
      throw new Error('本番環境テストは ap-northeast-1 リージョンでのみ実行可能です');
    }

    console.log('✅ 設定検証完了');
  }

  /**
   * 安全性制約の確認
   */
  private async validateSafetyConstraints(): Promise<void> {
    console.log('🛡️ 安全性制約を確認中...');

    // 読み取り専用モードの確認
    if (!this.config.readOnlyMode) {
      throw new Error('読み取り専用モードが有効になっていません');
    }

    // 緊急停止機能の確認
    if (!this.config.emergencyStopEnabled) {
      throw new Error('緊急停止機能が有効になっていません');
    }

    // リソース制限の確認
    if (this.config.execution.maxConcurrentTests > 10) {
      throw new Error('同時実行テスト数が制限を超えています（最大10）');
    }

    console.log('✅ 安全性制約確認完了');
  }

  /**
   * テストスイートの実行
   */
  async executeTestSuite(testSuite: TestSuite): Promise<Map<string, TestResult>> {
    if (!this.isInitialized) {
      throw new Error('エンジンが初期化されていません。initialize() を先に実行してください。');
    }

    if (this.emergencyStopManager.isEmergencyStopActive()) {
      throw new Error('緊急停止が有効になっています。実行を中止します。');
    }

    console.log(`🎯 テストスイート実行開始: ${testSuite.suiteName}`);
    console.log(`   テスト数: ${testSuite.tests.length}`);
    console.log(`   並列実行: ${testSuite.configuration.parallel ? 'Yes' : 'No'}`);

    const startTime = Date.now();
    const results = new Map<string, TestResult>();

    // 実行統計の初期化
    this.currentExecution = {
      suiteId: testSuite.suiteId,
      startTime: new Date(),
      results,
      statistics: {
        totalTests: testSuite.tests.length,
        completedTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        totalDuration: 0,
        averageDuration: 0,
        successRate: 0
      }
    };

    try {
      // テスト実行前の健全性チェック
      const healthCheck = await this.connectionManager.performHealthCheck();
      if (!healthCheck.healthy) {
        console.warn('⚠️ 健全性チェックで問題が検出されました:', healthCheck.issues);
        if (testSuite.configuration.failFast) {
          throw new Error(`健全性チェック失敗: ${healthCheck.issues.join(', ')}`);
        }
      }

      // テストの実行
      if (testSuite.configuration.parallel) {
        await this.executeTestsInParallel(testSuite.tests, testSuite.configuration);
      } else {
        await this.executeTestsSequentially(testSuite.tests, testSuite.configuration);
      }

      // 実行統計の更新
      this.updateExecutionStatistics();

      const totalDuration = Date.now() - startTime;
      console.log(`✅ テストスイート実行完了: ${testSuite.suiteName} (${totalDuration}ms)`);
      console.log(`   成功: ${this.currentExecution.statistics.passedTests}/${this.currentExecution.statistics.totalTests}`);
      console.log(`   成功率: ${(this.currentExecution.statistics.successRate * 100).toFixed(1)}%`);

      this.emit('testSuiteCompleted', {
        suiteId: testSuite.suiteId,
        results: results,
        statistics: this.currentExecution.statistics
      });

      return results;

    } catch (error) {
      console.error(`❌ テストスイート実行エラー: ${testSuite.suiteName}`, error);
      
      // 緊急停止の発動
      await this.emergencyStopManager.initiateEmergencyStop(
        EmergencyStopReason.UNEXPECTED_ERROR,
        `Test suite execution failed: ${error}`,
        'ProductionTestEngine'
      );

      throw error;
    }
  }

  /**
   * テストの並列実行
   */
  private async executeTestsInParallel(
    tests: TestDefinition[],
    config: TestSuiteConfig
  ): Promise<void> {
    console.log(`🔄 並列テスト実行開始 (最大同時実行数: ${config.maxConcurrency})`);

    const semaphore = new Array(config.maxConcurrency).fill(null);
    const testPromises: Promise<void>[] = [];

    for (const test of tests) {
      const testPromise = this.acquireSemaphore(semaphore).then(async (release) => {
        try {
          await this.executeIndividualTest(test, config);
        } finally {
          release();
        }
      });

      testPromises.push(testPromise);
    }

    await Promise.allSettled(testPromises);
    console.log('✅ 並列テスト実行完了');
  }

  /**
   * テストの順次実行
   */
  private async executeTestsSequentially(
    tests: TestDefinition[],
    config: TestSuiteConfig
  ): Promise<void> {
    console.log('🔄 順次テスト実行開始');

    for (const test of tests) {
      if (this.emergencyStopManager.isEmergencyStopActive()) {
        console.log('🛑 緊急停止が有効になったため、残りのテストをスキップします');
        break;
      }

      await this.executeIndividualTest(test, config);

      if (config.failFast && this.currentExecution) {
        const lastResult = Array.from(this.currentExecution.results.values()).pop();
        if (lastResult && !lastResult.success) {
          console.log('🛑 failFast が有効で、テストが失敗したため実行を中止します');
          break;
        }
      }
    }

    console.log('✅ 順次テスト実行完了');
  }

  /**
   * 個別テストの実行
   */
  private async executeIndividualTest(
    test: TestDefinition,
    config: TestSuiteConfig
  ): Promise<void> {
    const testStartTime = Date.now();
    
    console.log(`🧪 テスト実行開始: ${test.testName} (${test.testId})`);

    // アクティブテストとして登録
    const activeTest: ActiveTest = {
      testId: test.testId,
      testName: test.testName,
      startTime: new Date(),
      category: test.category,
      status: 'running',
      resourcesInUse: [] // 実際のリソース使用状況に応じて更新
    };

    this.emergencyStopManager.registerActiveTest(activeTest);

    let result: TestResult;
    let retryCount = 0;

    while (retryCount <= test.retryCount) {
      try {
        // 緊急停止チェック
        if (this.emergencyStopManager.isEmergencyStopActive()) {
          result = {
            testId: test.testId,
            testName: test.testName,
            category: test.category,
            status: TestExecutionStatus.STOPPED,
            startTime: new Date(testStartTime),
            duration: Date.now() - testStartTime,
            success: false,
            error: 'Emergency stop activated'
          };
          break;
        }

        // テストの実行
        result = await Promise.race([
          test.execute(this),
          this.createTimeoutPromise(test.timeout, test.testId)
        ]);

        // 成功した場合はリトライループを抜ける
        if (result.success) {
          break;
        }

        retryCount++;
        if (retryCount <= test.retryCount) {
          console.log(`🔄 テストリトライ: ${test.testName} (${retryCount}/${test.retryCount})`);
          await this.delay(1000 * retryCount); // 指数バックオフ
        }

      } catch (error) {
        retryCount++;
        
        result = {
          testId: test.testId,
          testName: test.testName,
          category: test.category,
          status: TestExecutionStatus.FAILED,
          startTime: new Date(testStartTime),
          duration: Date.now() - testStartTime,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };

        if (retryCount <= test.retryCount) {
          console.log(`🔄 テストリトライ (エラー): ${test.testName} (${retryCount}/${test.retryCount})`);
          await this.delay(1000 * retryCount);
        }
      }
    }

    // 結果の最終設定
    result!.endTime = new Date();
    result!.duration = Date.now() - testStartTime;

    // 結果の保存
    if (this.currentExecution) {
      this.currentExecution.results.set(test.testId, result!);
    }

    // アクティブテストの登録解除
    this.emergencyStopManager.unregisterActiveTest(test.testId);

    // 結果のログ出力
    if (result!.success) {
      console.log(`✅ テスト成功: ${test.testName} (${result!.duration}ms)`);
    } else {
      console.error(`❌ テスト失敗: ${test.testName} - ${result!.error}`);
    }

    this.emit('testCompleted', result!);
  }

  /**
   * タイムアウトPromiseの作成
   */
  private createTimeoutPromise(timeout: number, testId: string): Promise<TestResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Test timeout after ${timeout}ms: ${testId}`));
      }, timeout);
    });
  }

  /**
   * セマフォの取得
   */
  private async acquireSemaphore(semaphore: any[]): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        const index = semaphore.findIndex(slot => slot === null);
        if (index !== -1) {
          semaphore[index] = true;
          resolve(() => {
            semaphore[index] = null;
          });
        } else {
          setTimeout(tryAcquire, 10);
        }
      };
      tryAcquire();
    });
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 実行統計の更新
   */
  private updateExecutionStatistics(): void {
    if (!this.currentExecution) return;

    const results = Array.from(this.currentExecution.results.values());
    const stats = this.currentExecution.statistics;

    stats.completedTests = results.length;
    stats.passedTests = results.filter(r => r.success).length;
    stats.failedTests = results.filter(r => !r.success && r.status !== TestExecutionStatus.SKIPPED).length;
    stats.skippedTests = results.filter(r => r.status === TestExecutionStatus.SKIPPED).length;
    stats.totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    stats.averageDuration = stats.completedTests > 0 ? stats.totalDuration / stats.completedTests : 0;
    stats.successRate = stats.completedTests > 0 ? stats.passedTests / stats.completedTests : 0;
  }

  /**
   * 現在の実行統計を取得
   */
  getCurrentExecutionStatistics(): ExecutionStatistics | null {
    return this.currentExecution?.statistics || null;
  }

  /**
   * 接続管理システムの取得
   */
  getConnectionManager(): ProductionConnectionManager {
    return this.connectionManager;
  }

  /**
   * 緊急停止管理システムの取得
   */
  getEmergencyStopManager(): EmergencyStopManager {
    return this.emergencyStopManager;
  }

  /**
   * 設定の取得
   */
  getConfig(): ProductionConfig {
    return this.config;
  }

  /**
   * 緊急停止の要求
   */
  async requestEmergencyStop(reason: string): Promise<void> {
    await this.emergencyStopManager.initiateEmergencyStop(
      EmergencyStopReason.MANUAL_REQUEST,
      reason,
      'ProductionTestEngine'
    );
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 本番環境テストエンジンをクリーンアップ中...');

    try {
      // 緊急停止管理システムのクリーンアップ
      await this.emergencyStopManager.cleanup();

      // 接続管理システムのクリーンアップ
      await this.connectionManager.cleanup();

      // 実行状態のクリア
      this.currentExecution = null;
      this.isInitialized = false;

      // イベントリスナーの削除
      this.removeAllListeners();

      console.log('✅ 本番環境テストエンジンのクリーンアップ完了');

    } catch (error) {
      console.error('❌ クリーンアップエラー:', error);
      throw error;
    }
  }
}

export default ProductionTestEngine;