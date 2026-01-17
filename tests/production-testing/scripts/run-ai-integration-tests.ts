#!/usr/bin/env ts-node

/**
 * AI統合テストスイート実行スクリプト
 * 
 * Nova モデル、日本語精度、ストリーミング、マルチモーダルの包括テスト
 * 実本番AWS環境でのAI機能品質保証
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as path from 'path';
import * as fs from 'fs';
import { defaultProductionConfig, validateProductionConfig } from '../config/production-config';
import AIIntegrationTestRunner from '../modules/ai/ai-integration-test-runner';

/**
 * AI統合テスト実行設定
 */
interface AITestExecutionConfig {
  includeNovaModels: boolean;
  includeJapaneseAccuracy: boolean;
  includeStreaming: boolean;
  includeMultimodal: boolean;
  generateReport: boolean;
  outputDirectory: string;
  verbose: boolean;
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🤖 AI統合テストスイート実行開始');
  console.log('=' .repeat(60));

  try {
    // 1. 設定の検証
    console.log('📋 本番環境設定を検証中...');
    const configValidation = validateProductionConfig(defaultProductionConfig);
    
    if (!configValidation.isValid) {
      console.error('❌ 設定検証失敗:');
      configValidation.errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }

    if (configValidation.warnings.length > 0) {
      console.log('⚠️  設定警告:');
      configValidation.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    console.log('✅ 本番環境設定検証完了');

    // 2. 実行設定の読み込み
    const executionConfig: AITestExecutionConfig = {
      includeNovaModels: process.env.INCLUDE_NOVA_MODELS !== 'false',
      includeJapaneseAccuracy: process.env.INCLUDE_JAPANESE_ACCURACY !== 'false',
      includeStreaming: process.env.INCLUDE_STREAMING !== 'false',
      includeMultimodal: process.env.INCLUDE_MULTIMODAL !== 'false',
      generateReport: process.env.GENERATE_REPORT !== 'false',
      outputDirectory: process.env.OUTPUT_DIR || './ai-test-results',
      verbose: process.env.VERBOSE === 'true'
    };

    console.log('📋 AI統合テスト実行設定:');
    console.log(`   Nova モデルテスト: ${executionConfig.includeNovaModels ? '有効' : '無効'}`);
    console.log(`   日本語精度テスト: ${executionConfig.includeJapaneseAccuracy ? '有効' : '無効'}`);
    console.log(`   ストリーミングテスト: ${executionConfig.includeStreaming ? '有効' : '無効'}`);
    console.log(`   マルチモーダルテスト: ${executionConfig.includeMultimodal ? '有効' : '無効'}`);
    console.log(`   レポート生成: ${executionConfig.generateReport ? '有効' : '無効'}`);
    console.log(`   出力ディレクトリ: ${executionConfig.outputDirectory}`);

    // 3. 出力ディレクトリの準備
    if (executionConfig.generateReport) {
      if (!fs.existsSync(executionConfig.outputDirectory)) {
        fs.mkdirSync(executionConfig.outputDirectory, { recursive: true });
        console.log(`📁 出力ディレクトリを作成: ${executionConfig.outputDirectory}`);
      }
    }

    // 4. AI統合テストランナーの初期化
    console.log('🔧 AI統合テストランナーを初期化中...');
    const aiTestRunner = new AIIntegrationTestRunner(defaultProductionConfig);

    // 5. AI統合テストの実行
    console.log('🤖 AI統合テストを実行中...');
    console.log('-'.repeat(60));

    const startTime = Date.now();
    const testResults = await aiTestRunner.runComprehensiveAITests();
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log('-'.repeat(60));
    console.log('📊 AI統合テスト実行完了');

    // 6. 結果の表示
    console.log('📈 実行結果サマリー:');
    console.log(`   総実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}秒)`);
    console.log(`   テスト成功: ${testResults.success ? 'YES' : 'NO'}`);
    
    if (testResults.aiTestSummary) {
      console.log(`   Nova モデルテスト: ${(testResults.aiTestSummary.novaModelTests * 100).toFixed(1)}%`);
      console.log(`   日本語精度: ${(testResults.aiTestSummary.japaneseAccuracyScore * 100).toFixed(1)}%`);
      console.log(`   ストリーミング性能: ${(testResults.aiTestSummary.streamingPerformance * 100).toFixed(1)}%`);
      console.log(`   マルチモーダル能力: ${(testResults.aiTestSummary.multimodalCapability * 100).toFixed(1)}%`);
      console.log(`   総合AIスコア: ${(testResults.aiTestSummary.overallAIScore * 100).toFixed(1)}%`);
    }

    // 7. 詳細結果の表示（verbose モード）
    if (executionConfig.verbose && testResults.detailedResults) {
      console.log('\n📋 詳細テスト結果:');
      
      // Nova モデルテスト結果
      if (testResults.detailedResults.novaResults) {
        console.log('\n🤖 Nova モデルテスト:');
        testResults.detailedResults.novaResults.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`   ${status} ${result.testName} - ${result.duration}ms`);
        });
      }

      // 日本語精度テスト結果
      if (testResults.detailedResults.japaneseResults && testResults.detailedResults.japaneseResults.length > 0) {
        const japaneseResult = testResults.detailedResults.japaneseResults[0];
        const status = japaneseResult.success ? '✅' : '❌';
        console.log(`\n🇯🇵 日本語精度テスト:`);
        console.log(`   ${status} ${japaneseResult.testName} - ${japaneseResult.duration}ms`);
      }

      // ストリーミングテスト結果
      if (testResults.detailedResults.streamingResults && testResults.detailedResults.streamingResults.length > 0) {
        const streamingResult = testResults.detailedResults.streamingResults[0];
        const status = streamingResult.success ? '✅' : '❌';
        console.log(`\n📡 ストリーミングテスト:`);
        console.log(`   ${status} ${streamingResult.testName} - ${streamingResult.duration}ms`);
      }

      // マルチモーダルテスト結果
      if (testResults.detailedResults.multimodalResults && testResults.detailedResults.multimodalResults.length > 0) {
        const multimodalResult = testResults.detailedResults.multimodalResults[0];
        const status = multimodalResult.success ? '✅' : '❌';
        console.log(`\n🖼️ マルチモーダルテスト:`);
        console.log(`   ${status} ${multimodalResult.testName} - ${multimodalResult.duration}ms`);
      }
    }

    // 8. レポート生成
    if (executionConfig.generateReport) {
      console.log('\n📄 詳細レポートを生成中...');
      
      const report = await aiTestRunner.generateDetailedAIReport(testResults);
      const reportPath = path.join(executionConfig.outputDirectory, `ai-integration-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
      
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`✅ 詳細レポートを生成: ${reportPath}`);

      // JSON形式の結果も保存
      const jsonResults = {
        timestamp: new Date().toISOString(),
        config: {
          region: defaultProductionConfig.region,
          environment: defaultProductionConfig.environment,
          safetyMode: defaultProductionConfig.safetyMode,
          readOnlyMode: defaultProductionConfig.readOnlyMode
        },
        summary: testResults.aiTestSummary,
        results: testResults.detailedResults
      };

      const jsonPath = path.join(executionConfig.outputDirectory, `ai-integration-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonResults, null, 2), 'utf8');
      console.log(`✅ JSON結果を保存: ${jsonPath}`);
    }

    // 9. クリーンアップ
    console.log('\n🧹 リソースをクリーンアップ中...');
    await aiTestRunner.cleanup();

    // 10. 終了処理
    const overallSuccess = testResults.success;
    
    console.log('\n' + '='.repeat(60));
    if (overallSuccess) {
      console.log('🎉 AI統合テストスイート実行成功');
      console.log('✅ 全てのAI機能が正常に動作しています');
    } else {
      console.log('⚠️  AI統合テストスイート実行完了（一部失敗）');
      console.log('❌ 一部のAI機能に問題があります');
    }

    if (testResults.aiTestSummary) {
      console.log(`📊 最終AIスコア: ${(testResults.aiTestSummary.overallAIScore * 100).toFixed(1)}%`);
    }
    console.log('='.repeat(60));

    // 終了コードの設定
    process.exit(overallSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n❌ AI統合テスト実行中にエラーが発生しました:');
    console.error(error);
    
    if (error instanceof Error) {
      console.error(`エラー詳細: ${error.message}`);
      if (error.stack) {
        console.error(`スタックトレース:\n${error.stack}`);
      }
    }

    process.exit(1);
  }
}

/**
 * 緊急停止ハンドラー
 */
process.on('SIGINT', () => {
  console.log('\n🛑 緊急停止シグナルを受信しました');
  console.log('🧹 安全にクリーンアップ中...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 終了シグナルを受信しました');
  console.log('🧹 安全にクリーンアップ中...');
  process.exit(143);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  console.error('\n💥 未処理の例外が発生しました:');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 未処理のPromise拒否が発生しました:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// メイン関数の実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ メイン関数実行エラー:', error);
    process.exit(1);
  });
}

export default main;