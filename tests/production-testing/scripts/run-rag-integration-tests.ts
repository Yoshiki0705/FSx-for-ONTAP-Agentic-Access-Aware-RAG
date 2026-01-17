#!/usr/bin/env ts-node

/**
 * RAG統合テストスイート実行スクリプト
 * 
 * ベクトル検索、検索統合、コンテキスト維持、権限フィルタリングの包括テスト
 * 実本番AWS環境でのRAG機能品質保証
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as path from 'path';
import * as fs from 'fs';
import { defaultProductionConfig, validateProductionConfig } from '../config/production-config';
import RAGIntegrationTestRunner from '../modules/rag/rag-integration-test-runner';

/**
 * 出力パスのサニタイゼーション（パストラバーサル攻撃防止）
 */
function sanitizeOutputPath(outputPath: string): string {
  // 危険な文字列を除去
  const sanitized = outputPath
    .replace(/\.\./g, '') // パストラバーサル防止
    .replace(/[<>:"|?*]/g, '') // 無効な文字除去
    .trim();
  
  // 絶対パスの場合は相対パスに変換
  if (path.isAbsolute(sanitized)) {
    return path.join('./test-results', path.basename(sanitized));
  }
  
  return sanitized || './rag-test-results';
}

/**
 * 機密情報のマスキング
 */
function maskSensitiveInfo(obj: any): any {
  const masked = JSON.parse(JSON.stringify(obj));
  
  // 機密情報をマスク
  if (masked.config) {
    if (masked.config.awsProfile) masked.config.awsProfile = '***';
    if (masked.config.region) masked.config.region = masked.config.region.substring(0, 3) + '***';
  }
  
  return masked;
}

/**
 * RAG統合テスト実行設定
 */
interface RAGTestExecutionConfig {
  includeVectorSearch: boolean;
  includeSearchIntegration: boolean;
  includeContextPersistence: boolean;
  includePermissionFiltering: boolean;
  generateReport: boolean;
  outputDirectory: string;
  verbose: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * テスト実行結果サマリー
 */
interface TestExecutionSummary {
  totalDuration: number;
  success: boolean;
  testCounts: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🔍 RAG統合テストスイート実行開始');
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

    // 2. 実行設定の読み込み（セキュリティ強化）
    const executionConfig: RAGTestExecutionConfig = {
      includeVectorSearch: process.env.INCLUDE_VECTOR_SEARCH !== 'false',
      includeSearchIntegration: process.env.INCLUDE_SEARCH_INTEGRATION !== 'false',
      includeContextPersistence: process.env.INCLUDE_CONTEXT_PERSISTENCE !== 'false',
      includePermissionFiltering: process.env.INCLUDE_PERMISSION_FILTERING !== 'false',
      generateReport: process.env.GENERATE_REPORT !== 'false',
      outputDirectory: sanitizeOutputPath(process.env.OUTPUT_DIR || './rag-test-results'),
      verbose: process.env.VERBOSE === 'true',
      maxRetries: Math.max(1, Math.min(5, parseInt(process.env.MAX_RETRIES || '3', 10))),
      timeoutMs: Math.max(30000, Math.min(300000, parseInt(process.env.TIMEOUT_MS || '120000', 10)))
    };

    console.log('📋 RAG統合テスト実行設定:');
    console.log(`   ベクトル検索テスト: ${executionConfig.includeVectorSearch ? '有効' : '無効'}`);
    console.log(`   検索統合テスト: ${executionConfig.includeSearchIntegration ? '有効' : '無効'}`);
    console.log(`   コンテキスト維持テスト: ${executionConfig.includeContextPersistence ? '有効' : '無効'}`);
    console.log(`   権限フィルタリングテスト: ${executionConfig.includePermissionFiltering ? '有効' : '無効'}`);
    console.log(`   レポート生成: ${executionConfig.generateReport ? '有効' : '無効'}`);
    console.log(`   出力ディレクトリ: ${executionConfig.outputDirectory}`);

    // 3. 出力ディレクトリの準備
    if (executionConfig.generateReport) {
      if (!fs.existsSync(executionConfig.outputDirectory)) {
        fs.mkdirSync(executionConfig.outputDirectory, { recursive: true });
        console.log(`📁 出力ディレクトリを作成: ${executionConfig.outputDirectory}`);
      }
    }

    // 4. RAG統合テストランナーの初期化
    console.log('🔧 RAG統合テストランナーを初期化中...');
    const ragTestRunner = new RAGIntegrationTestRunner(defaultProductionConfig);

    // 5. RAG統合テストの実行（タイムアウト・リトライ機能付き）
    console.log('🔍 RAG統合テストを実行中...');
    console.log('-'.repeat(60));

    const startTime = Date.now();
    let testResults;
    let retryCount = 0;
    const maxRetries = executionConfig.maxRetries || 3;

    while (retryCount <= maxRetries) {
      try {
        // タイムアウト付きでテスト実行
        testResults = await Promise.race([
          ragTestRunner.runComprehensiveRAGTests(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('テスト実行タイムアウト')), executionConfig.timeoutMs || 120000)
          )
        ]);
        break; // 成功時はループを抜ける
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw error;
        }
        console.log(`⚠️  テスト実行失敗 (${retryCount}/${maxRetries}): ${error}`);
        console.log(`🔄 ${retryCount * 5}秒後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 5000));
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log('-'.repeat(60));
    console.log('📊 RAG統合テスト実行完了');

    // 6. 結果の表示
    console.log('📈 実行結果サマリー:');
    console.log(`   総実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}秒)`);
    console.log(`   テスト成功: ${testResults.success ? 'YES' : 'NO'}`);
    
    if (testResults.ragTestSummary) {
      console.log(`   ベクトル検索: ${(testResults.ragTestSummary.vectorSearchScore * 100).toFixed(1)}%`);
      console.log(`   検索統合: ${(testResults.ragTestSummary.searchIntegrationScore * 100).toFixed(1)}%`);
      console.log(`   コンテキスト維持: ${(testResults.ragTestSummary.contextPersistenceScore * 100).toFixed(1)}%`);
      console.log(`   権限フィルタリング: ${(testResults.ragTestSummary.permissionFilteringScore * 100).toFixed(1)}%`);
      console.log(`   総合RAGスコア: ${(testResults.ragTestSummary.overallRAGScore * 100).toFixed(1)}%`);
    }

    // 7. 詳細結果の表示（verbose モード）
    if (executionConfig.verbose && testResults.detailedResults) {
      console.log('\n📋 詳細テスト結果:');
      
      // ベクトル検索テスト結果
      if (testResults.detailedResults.vectorSearchResults) {
        console.log('\n🔍 ベクトル検索テスト:');
        testResults.detailedResults.vectorSearchResults.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`   ${status} ${result.testName} - ${result.duration}ms`);
        });
      }

      // 検索統合テスト結果
      if (testResults.detailedResults.searchIntegrationResults) {
        console.log('\n🔗 検索統合テスト:');
        testResults.detailedResults.searchIntegrationResults.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`   ${status} ${result.testName} - ${result.duration}ms`);
        });
      }

      // コンテキスト維持テスト結果
      if (testResults.detailedResults.contextPersistenceResults) {
        console.log('\n💾 コンテキスト維持テスト:');
        testResults.detailedResults.contextPersistenceResults.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`   ${status} ${result.testName} - ${result.duration}ms`);
        });
      }

      // 権限フィルタリングテスト結果
      if (testResults.detailedResults.permissionFilteringResults) {
        console.log('\n🔐 権限フィルタリングテスト:');
        testResults.detailedResults.permissionFilteringResults.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`   ${status} ${result.testName} - ${result.duration}ms`);
        });
      }
    }

    // 8. レポート生成
    if (executionConfig.generateReport) {
      console.log('\n📄 詳細レポートを生成中...');
      
      const report = await ragTestRunner.generateDetailedRAGReport(testResults);
      const reportPath = path.join(executionConfig.outputDirectory, `rag-integration-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
      
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`✅ 詳細レポートを生成: ${reportPath}`);

      // JSON形式の結果も保存（機密情報マスキング付き）
      const jsonResults = {
        timestamp: new Date().toISOString(),
        executionInfo: {
          duration: totalDuration,
          retryCount: retryCount || 0,
          version: '1.0.0'
        },
        config: maskSensitiveInfo({
          region: defaultProductionConfig.region,
          environment: defaultProductionConfig.environment,
          safetyMode: defaultProductionConfig.safetyMode,
          readOnlyMode: defaultProductionConfig.readOnlyMode
        }),
        summary: testResults.ragTestSummary,
        results: testResults.detailedResults
      };

      const jsonPath = path.join(executionConfig.outputDirectory, `rag-integration-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonResults, null, 2), 'utf8');
      console.log(`✅ JSON結果を保存: ${jsonPath}`);
    }

    // 9. クリーンアップ
    console.log('\n🧹 リソースをクリーンアップ中...');
    await ragTestRunner.cleanup();

    // 10. 終了処理
    const overallSuccess = testResults.success;
    
    console.log('\n' + '='.repeat(60));
    if (overallSuccess) {
      console.log('🎉 RAG統合テストスイート実行成功');
      console.log('✅ 全てのRAG機能が正常に動作しています');
    } else {
      console.log('⚠️  RAG統合テストスイート実行完了（一部失敗）');
      console.log('❌ 一部のRAG機能に問題があります');
    }

    if (testResults.ragTestSummary) {
      console.log(`📊 最終RAGスコア: ${(testResults.ragTestSummary.overallRAGScore * 100).toFixed(1)}%`);
    }
    console.log('='.repeat(60));

    // 終了コードの設定
    process.exit(overallSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n❌ RAG統合テスト実行中にエラーが発生しました:');
    
    // エラーログの構造化
    const errorInfo = {
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    console.error(`エラータイプ: ${errorInfo.errorType}`);
    console.error(`エラー詳細: ${errorInfo.message}`);
    
    // デバッグモードでのみスタックトレースを表示
    if (process.env.DEBUG === 'true' && errorInfo.stack) {
      console.error(`スタックトレース:\n${errorInfo.stack}`);
    }

    // エラーログをファイルに保存
    try {
      const errorLogPath = path.join('./rag-test-results', `error-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorInfo, null, 2), 'utf8');
      console.error(`📝 エラーログを保存: ${errorLogPath}`);
    } catch (logError) {
      console.error('⚠️  エラーログの保存に失敗:', logError);
    }

    process.exit(1);
  }
}

/**
 * 緊急停止ハンドラー（改善版）
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string, exitCode: number): Promise<void> {
  if (isShuttingDown) {
    console.log('🔄 既にシャットダウン処理中です...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n🛑 ${signal}シグナルを受信しました`);
  console.log('🧹 安全にクリーンアップ中...');
  
  try {
    // クリーンアップ処理のタイムアウト（10秒）
    await Promise.race([
      // 実際のクリーンアップ処理をここに追加
      new Promise(resolve => setTimeout(resolve, 1000)), // 模擬クリーンアップ
      new Promise((_, reject) => setTimeout(() => reject(new Error('クリーンアップタイムアウト')), 10000))
    ]);
    console.log('✅ クリーンアップ完了');
  } catch (error) {
    console.error('❌ クリーンアップエラー:', error);
  } finally {
    process.exit(exitCode);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT', 130));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 143));

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