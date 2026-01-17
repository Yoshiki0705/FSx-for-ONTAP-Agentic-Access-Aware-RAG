#!/usr/bin/env node

/**
 * チャットボット機能テスト実行スクリプト
 * 
 * 実本番Amazon Bedrockでのチャットボット機能テストを実行
 * コマンドライン引数でテスト設定をカスタマイズ可能
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { Command } from 'commander';
import ChatbotTestRunner from './chatbot-test-runner';
import ProductionTestEngine from '../../core/production-test-engine';
import { ProductionConfig, loadProductionConfig } from '../../config/production-config';
import { getChatbotTestConfig } from './chatbot-config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * コマンドライン引数の定義
 */
interface CommandOptions {
  config?: string;
  environment?: string;
  output?: string;
  verbose?: boolean;
  dryRun?: boolean;
  testIds?: string;
  timeout?: number;
  retries?: number;
  model?: string;
  skipStreaming?: boolean;
  skipComplex?: boolean;
}

/**
 * チャットボットテスト実行クラス
 */
class ChatbotTestExecutor {
  private options: CommandOptions;
  private config: ProductionConfig;
  private testEngine: ProductionTestEngine;
  private testRunner: ChatbotTestRunner;

  constructor(options: CommandOptions) {
    this.options = options;
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    console.log('🚀 チャットボット機能テスト実行環境を初期化中...');

    try {
      // 設定の読み込み
      this.config = await this.loadConfiguration();
      
      // テストエンジンの初期化
      this.testEngine = new ProductionTestEngine(this.config);
      await this.testEngine.initialize();

      // テストランナーの初期化
      this.testRunner = new ChatbotTestRunner(this.config, this.testEngine);

      console.log('✅ 初期化完了');
      
      if (this.options.verbose) {
        console.log('📋 設定情報:');
        console.log(`   環境: ${this.config.environment}`);
        console.log(`   リージョン: ${this.config.region}`);
        console.log(`   Bedrockエンドポイント: ${this.config.resources.bedrockEndpoint || 'デフォルト'}`);
        console.log(`   OpenSearchドメイン: ${this.config.resources.openSearchDomain}`);
        console.log(`   読み取り専用モード: ${this.config.readOnlyMode ? 'ON' : 'OFF'}`);
      }

    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      throw error;
    }
  }

  /**
   * 設定の読み込み
   */
  private async loadConfiguration(): Promise<ProductionConfig> {
    let config: ProductionConfig;

    if (this.options.config) {
      // カスタム設定ファイルの読み込み
      const configPath = path.resolve(this.options.config);
      console.log(`📄 カスタム設定ファイルを読み込み中: ${configPath}`);
      config = await loadProductionConfig(configPath);
    } else {
      // デフォルト設定の読み込み
      console.log('📄 デフォルト設定を読み込み中...');
      config = await loadProductionConfig();
    }

    // 環境設定の上書き
    if (this.options.environment) {
      config.environment = this.options.environment;
    }

    // チャットボットテスト固有設定の適用
    const chatbotConfig = getChatbotTestConfig(config.environment);
    
    // タイムアウトとリトライ設定の上書き
    if (this.options.timeout) {
      chatbotConfig.execution.timeout = this.options.timeout;
    }
    
    if (this.options.retries !== undefined) {
      chatbotConfig.execution.retryCount = this.options.retries;
    }

    // モデル設定の上書き
    if (this.options.model) {
      chatbotConfig.models.primaryModel = this.options.model;
      chatbotConfig.models.streamingModel = this.options.model;
    }

    // ストリーミングテストのスキップ設定
    if (this.options.skipStreaming) {
      chatbotConfig.streaming.enableStreamingTests = false;
    }

    // 複雑な質問テストのスキップ設定
    if (this.options.skipComplex) {
      chatbotConfig.testQuestions.includeComplexQuestions = false;
    }

    // 設定をマージ
    config.testConfig = {
      ...config.testConfig,
      chatbot: chatbotConfig
    };

    return config;
  }

  /**
   * チャットボット機能テストの実行
   */
  async executeTests(): Promise<void> {
    console.log('🤖 チャットボット機能テストを実行開始...');

    try {
      if (this.options.dryRun) {
        console.log('🔍 ドライランモード: 実際のテストは実行されません');
        await this.performDryRun();
        return;
      }

      // テストの実行
      const startTime = Date.now();
      const results = await this.testRunner.runChatbotTests();
      const executionTime = Date.now() - startTime;

      // 結果の表示
      console.log('\\n📊 チャットボット機能テスト実行結果:');
      console.log('='.repeat(60));
      console.log(`総実行時間: ${executionTime}ms`);
      console.log(`総テスト数: ${results.summary.totalTests}`);
      console.log(`成功: ${results.summary.passedTests}`);
      console.log(`失敗: ${results.summary.failedTests}`);
      console.log(`スキップ: ${results.summary.skippedTests}`);
      console.log(`成功率: ${(results.summary.successRate * 100).toFixed(1)}%`);
      console.log(`平均応答時間: ${results.summary.averageResponseTime.toFixed(0)}ms`);
      console.log(`日本語品質スコア: ${(results.summary.japaneseQualityScore * 100).toFixed(1)}%`);
      console.log(`RAG有効性: ${(results.summary.ragEffectiveness * 100).toFixed(1)}%`);

      // 品質評価の表示
      this.displayQualityAssessment(results.summary);

      // 詳細レポートの生成と保存
      if (this.options.output || results.summary.failedTests > 0) {
        await this.generateAndSaveReport(results.results);
      }

      // 終了コードの設定
      if (!results.success) {
        console.log('\\n❌ 一部のテストが失敗しました');
        process.exit(1);
      } else {
        console.log('\\n✅ 全てのチャットボット機能テストが成功しました');
      }

    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      process.exit(1);
    }
  }

  /**
   * ドライランの実行
   */
  private async performDryRun(): Promise<void> {
    console.log('🔍 実行予定のテスト一覧:');
    console.log('-'.repeat(50));

    const testSuite = this.testRunner.createChatbotTestSuite();
    
    testSuite.tests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.testName}`);
      console.log(`   ID: ${test.testId}`);
      console.log(`   カテゴリ: ${test.category}`);
      console.log(`   タイムアウト: ${test.timeout}ms`);
      console.log(`   リトライ回数: ${test.retryCount}`);
      console.log(`   説明: ${test.description}`);
      
      if (test.dependencies && test.dependencies.length > 0) {
        console.log(`   依存関係: ${test.dependencies.join(', ')}`);
      }
      
      console.log('');
    });

    console.log(`総テスト数: ${testSuite.tests.length}`);
    console.log('並列実行: 無効（順次実行）');
    console.log(`最大同時実行数: ${testSuite.configuration.maxConcurrency}`);
    console.log(`失敗時継続: ${testSuite.configuration.continueOnError ? '有効' : '無効'}`);

    // 使用予定のBedrockモデル表示
    const chatbotConfig = this.config.testConfig?.chatbot;
    if (chatbotConfig) {
      console.log('\\n🤖 使用予定Bedrockモデル:');
      console.log(`   プライマリ: ${chatbotConfig.models.primaryModel}`);
      console.log(`   ストリーミング: ${chatbotConfig.models.streamingModel}`);
      console.log(`   複雑な質問: ${chatbotConfig.models.complexQuestionModel}`);
    }
  }

  /**
   * 品質評価の表示
   */
  private displayQualityAssessment(summary: any): void {
    console.log('\\n🎯 AI品質評価:');
    console.log('-'.repeat(30));

    // 日本語品質評価
    if (summary.japaneseQualityScore >= 0.9) {
      console.log('🟢 日本語品質: 優秀 (90%以上)');
    } else if (summary.japaneseQualityScore >= 0.75) {
      console.log('🟡 日本語品質: 良好 (75%以上)');
    } else if (summary.japaneseQualityScore >= 0.6) {
      console.log('🟠 日本語品質: 改善推奨 (60%以上)');
    } else {
      console.log('🔴 日本語品質: 要改善 (60%未満)');
    }

    // RAG有効性評価
    if (summary.ragEffectiveness >= 0.8) {
      console.log('🟢 RAG機能: 優秀 (80%以上)');
    } else if (summary.ragEffectiveness >= 0.6) {
      console.log('🟡 RAG機能: 良好 (60%以上)');
    } else if (summary.ragEffectiveness >= 0.4) {
      console.log('🟠 RAG機能: 改善推奨 (40%以上)');
    } else {
      console.log('🔴 RAG機能: 要改善 (40%未満)');
    }

    // 応答時間評価
    if (summary.averageResponseTime <= 3000) {
      console.log('🟢 応答時間: 優秀 (3秒以内)');
    } else if (summary.averageResponseTime <= 5000) {
      console.log('🟡 応答時間: 良好 (5秒以内)');
    } else if (summary.averageResponseTime <= 8000) {
      console.log('🟠 応答時間: 改善推奨 (8秒以内)');
    } else {
      console.log('🔴 応答時間: 要改善 (8秒超過)');
    }
  }

  /**
   * レポートの生成と保存
   */
  private async generateAndSaveReport(results: Map<string, any>): Promise<void> {
    console.log('📝 詳細レポートを生成中...');

    try {
      const report = await this.testRunner.generateDetailedReport(results);
      
      const outputPath = this.options.output || 
        `chatbot-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
      
      await fs.writeFile(outputPath, report, 'utf-8');
      
      console.log(`✅ 詳細レポートを保存しました: ${outputPath}`);

    } catch (error) {
      console.error('❌ レポート生成エラー:', error);
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.testRunner) {
      await this.testRunner.cleanup();
    }
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('execute-chatbot-tests')
    .description('実本番Amazon Bedrockでのチャットボット機能テスト実行')
    .version('1.0.0')
    .option('-c, --config <path>', '設定ファイルのパス')
    .option('-e, --environment <env>', '実行環境 (dev, staging, prod)', 'prod')
    .option('-o, --output <path>', 'レポート出力ファイルパス')
    .option('-v, --verbose', '詳細ログの表示', false)
    .option('-d, --dry-run', 'ドライラン（実際のテストは実行しない）', false)
    .option('-t, --test-ids <ids>', '実行するテストIDのカンマ区切りリスト')
    .option('--timeout <ms>', 'テストタイムアウト（ミリ秒）', parseInt)
    .option('--retries <count>', 'リトライ回数', parseInt)
    .option('--model <model>', '使用するBedrockモデルID')
    .option('--skip-streaming', 'ストリーミングテストをスキップ', false)
    .option('--skip-complex', '複雑な質問テストをスキップ', false);

  program.parse();

  const options = program.opts<CommandOptions>();
  const executor = new ChatbotTestExecutor(options);

  try {
    await executor.initialize();
    await executor.executeTests();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  } finally {
    await executor.cleanup();
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
}

export default ChatbotTestExecutor;