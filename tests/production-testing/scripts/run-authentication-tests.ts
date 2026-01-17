#!/usr/bin/env ts-node

/**
 * 認証・認可テストスイート実行スクリプト
 * 
 * SIDベース認証、マルチリージョン認証、セッション管理の包括テスト
 * 実本番AWS環境での認証システム品質保証
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as path from 'path';
import * as fs from 'fs';
import { defaultProductionConfig, validateProductionConfig } from '../config/production-config';
import ProductionTestEngine from '../core/production-test-engine';
import AuthenticationTestRunner from '../modules/authentication/authentication-test-runner';

/**
 * 認証テスト実行の設定
 */
interface AuthTestExecutionConfig {
  includeBasicAuth: boolean;
  includeSIDAuth: boolean;
  includeMultiRegion: boolean;
  generateReport: boolean;
  outputDirectory: string;
  verbose: boolean;
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🚀 認証・認可テストスイート実行開始');
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
    const executionConfig: AuthTestExecutionConfig = {
      includeBasicAuth: process.env.INCLUDE_BASIC_AUTH !== 'false',
      includeSIDAuth: process.env.INCLUDE_SID_AUTH !== 'false',
      includeMultiRegion: process.env.INCLUDE_MULTI_REGION !== 'false',
      generateReport: process.env.GENERATE_REPORT !== 'false',
      outputDirectory: process.env.OUTPUT_DIR || './test-results',
      verbose: process.env.VERBOSE === 'true'
    };

    console.log('📋 実行設定:');
    console.log(`   基本認証テスト: ${executionConfig.includeBasicAuth ? '有効' : '無効'}`);
    console.log(`   SIDベース認証テスト: ${executionConfig.includeSIDAuth ? '有効' : '無効'}`);
    console.log(`   マルチリージョンテスト: ${executionConfig.includeMultiRegion ? '有効' : '無効'}`);
    console.log(`   レポート生成: ${executionConfig.generateReport ? '有効' : '無効'}`);
    console.log(`   出力ディレクトリ: ${executionConfig.outputDirectory}`);

    // 3. 出力ディレクトリの準備
    if (executionConfig.generateReport) {
      if (!fs.existsSync(executionConfig.outputDirectory)) {
        fs.mkdirSync(executionConfig.outputDirectory, { recursive: true });
        console.log(`📁 出力ディレクトリを作成: ${executionConfig.outputDirectory}`);
      }
    }

    // 4. テストエンジンの初期化
    console.log('🔧 テストエンジンを初期化中...');
    const testEngine = new ProductionTestEngine(defaultProductionConfig);

    // 5. 認証テストランナーの初期化
    console.log('🔧 認証テストランナーを初期化中...');
    const authTestRunner = new AuthenticationTestRunner(defaultProductionConfig, testEngine);

    // 6. 認証テストの実行
    console.log('🚀 認証テストを実行中...');
    console.log('-'.repeat(60));

    const startTime = Date.now();
    const testResults = await authTestRunner.runAuthenticationTests();
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log('-'.repeat(60));
    console.log('📊 認証テスト実行完了');

    // 7. 結果の表示
    console.log('📈 実行結果サマリー:');
    console.log(`   総実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}秒)`);
    console.log(`   総テスト数: ${testResults.summary.totalTests}`);
    console.log(`   成功: ${testResults.summary.passedTests}`);
    console.log(`   失敗: ${testResults.summary.failedTests}`);
    console.log(`   スキップ: ${testResults.summary.skippedTests}`);
    console.log(`   成功率: ${(testResults.summary.successRate * 100).toFixed(1)}%`);

    // 8. 詳細結果の表示（verbose モード）
    if (executionConfig.verbose) {
      console.log('\n📋 詳細テスト結果:');
      for (const [testId, result] of testResults.results) {
        const status = result.success ? '✅' : '❌';
        const duration = result.duration || 0;
        console.log(`   ${status} ${result.testName} (${testId}) - ${duration}ms`);
        
        if (!result.success && result.error) {
          console.log(`      エラー: ${result.error}`);
        }
      }
    }

    // 9. レポート生成
    if (executionConfig.generateReport) {
      console.log('\n📄 詳細レポートを生成中...');
      
      const report = await authTestRunner.generateDetailedReport(testResults.results);
      const reportPath = path.join(executionConfig.outputDirectory, `auth-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
      
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
        summary: testResults.summary,
        results: Array.from(testResults.results.entries()).map(([testId, result]) => ({
          testId,
          ...result
        }))
      };

      const jsonPath = path.join(executionConfig.outputDirectory, `auth-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonResults, null, 2), 'utf8');
      console.log(`✅ JSON結果を保存: ${jsonPath}`);
    }

    // 10. クリーンアップ
    console.log('\n🧹 リソースをクリーンアップ中...');
    await authTestRunner.cleanup();
    await testEngine.cleanup();

    // 11. 終了処理
    const overallSuccess = testResults.success;
    
    console.log('\n' + '='.repeat(60));
    if (overallSuccess) {
      console.log('🎉 認証・認可テストスイート実行成功');
      console.log('✅ 全ての認証機能が正常に動作しています');
    } else {
      console.log('⚠️  認証・認可テストスイート実行完了（一部失敗）');
      console.log('❌ 一部の認証機能に問題があります');
    }

    console.log(`📊 最終結果: ${testResults.summary.passedTests}/${testResults.summary.totalTests} テスト成功`);
    console.log('='.repeat(60));

    // 終了コードの設定
    process.exit(overallSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 認証テスト実行中にエラーが発生しました:');
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