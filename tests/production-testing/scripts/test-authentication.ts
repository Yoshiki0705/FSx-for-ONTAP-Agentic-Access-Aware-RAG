#!/usr/bin/env node
/**
 * 認証システムテスト実行スクリプト
 * 
 * 実本番Amazon Cognitoユーザープールでの認証テストを実行
 * 
 * 使用方法:
 *   npm run test:auth
 *   または
 *   npx ts-node scripts/test-authentication.ts
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { createProductionConfig, validateProductionConfig } from '../config/production-config';
import ProductionTestEngine from '../core/production-test-engine';
import AuthenticationTestRunner from '../modules/authentication/authentication-test-runner';

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🚀 認証システムテスト実行開始');
  console.log('=====================================');

  let testEngine: ProductionTestEngine | null = null;
  let testRunner: AuthenticationTestRunner | null = null;

  try {
    // 1. 設定の読み込みと検証
    console.log('⚙️ 設定を読み込み中...');
    const config = createProductionConfig();
    
    const validation = validateProductionConfig(config);
    if (!validation.isValid) {
      console.error('❌ 設定検証エラー:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ 設定警告:');
      validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    console.log('✅ 設定検証完了');
    console.log(`   リージョン: ${config.region}`);
    console.log(`   環境: ${config.environment}`);
    console.log(`   安全モード: ${config.safetyMode ? '有効' : '無効'}`);
    console.log(`   読み取り専用モード: ${config.readOnlyMode ? '有効' : '無効'}`);

    // 2. テストエンジンの初期化
    console.log('\n🔧 テストエンジンを初期化中...');
    testEngine = new ProductionTestEngine(config);
    await testEngine.initialize();
    console.log('✅ テストエンジン初期化完了');

    // 3. 認証テストランナーの作成
    console.log('\n🔐 認証テストランナーを作成中...');
    testRunner = new AuthenticationTestRunner(config, testEngine);
    console.log('✅ 認証テストランナー作成完了');

    // 4. 認証テストの実行
    console.log('\n🧪 認証テストを実行中...');
    console.log('=====================================');
    
    const testResults = await testRunner.runAuthenticationTests();

    // 5. 結果の表示
    console.log('\n📊 テスト結果サマリー');
    console.log('=====================================');
    console.log(`総テスト数: ${testResults.summary.totalTests}`);
    console.log(`成功: ${testResults.summary.passedTests}`);
    console.log(`失敗: ${testResults.summary.failedTests}`);
    console.log(`スキップ: ${testResults.summary.skippedTests}`);
    console.log(`成功率: ${(testResults.summary.successRate * 100).toFixed(1)}%`);
    console.log(`総実行時間: ${testResults.summary.totalDuration}ms`);

    // 6. 詳細レポートの生成
    console.log('\n📄 詳細レポートを生成中...');
    const detailedReport = await testRunner.generateDetailedReport(testResults.results);
    
    // レポートファイルの保存
    const reportsDir = path.join(process.cwd(), 'test-results');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFileName = `authentication-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const reportFilePath = path.join(reportsDir, reportFileName);
    
    await fs.writeFile(reportFilePath, detailedReport, 'utf-8');
    console.log(`✅ 詳細レポート保存完了: ${reportFilePath}`);

    // 7. 結果に基づく終了処理
    if (testResults.success) {
      console.log('\n🎉 認証システムテスト完了 - 全テスト成功');
      process.exit(0);
    } else {
      console.log('\n⚠️ 認証システムテスト完了 - 一部テスト失敗');
      console.log('詳細は上記のレポートファイルを確認してください。');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 認証テスト実行中にエラーが発生しました:');
    console.error(error);

    // エラー情報の保存
    try {
      const errorReportsDir = path.join(process.cwd(), 'test-results', 'errors');
      await fs.mkdir(errorReportsDir, { recursive: true });
      
      const errorFileName = `authentication-test-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const errorFilePath = path.join(errorReportsDir, errorFileName);
      
      const errorReport = {
        timestamp: new Date().toISOString(),
        testType: 'authentication',
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          cwd: process.cwd()
        }
      };
      
      await fs.writeFile(errorFilePath, JSON.stringify(errorReport, null, 2), 'utf-8');
      console.log(`📄 エラーレポート保存: ${errorFilePath}`);
      
    } catch (reportError) {
      console.error('エラーレポート保存に失敗:', reportError);
    }

    process.exit(1);

  } finally {
    // クリーンアップ処理
    console.log('\n🧹 クリーンアップ中...');
    
    try {
      if (testRunner) {
        await testRunner.cleanup();
      }
      
      if (testEngine) {
        await testEngine.cleanup();
      }
      
      console.log('✅ クリーンアップ完了');
      
    } catch (cleanupError) {
      console.error('⚠️ クリーンアップ中にエラーが発生しました:', cleanupError);
    }
  }
}

/**
 * 未処理例外のハンドリング
 */
process.on('uncaughtException', (error) => {
  console.error('🚨 未処理例外:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 未処理のPromise拒否:', reason);
  process.exit(1);
});

/**
 * 終了シグナルのハンドリング
 */
process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT受信 - 認証テストを中断します...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM受信 - 認証テストを中断します...');
  process.exit(143);
});

// メイン関数の実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ メイン関数実行エラー:', error);
    process.exit(1);
  });
}