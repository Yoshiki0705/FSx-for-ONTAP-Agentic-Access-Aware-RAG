#!/usr/bin/env node

/**
 * 包括的セキュリティテスト実行スクリプト
 * エンドツーエンド暗号化テストと認証・認可テストを含む
 * 本番環境での包括的なセキュリティ検証を実行
 */

import { SecurityTestRunner } from './security-test-runner';
import { ProductionConfig } from '../../config/production-config';
import ProductionTestEngine from '../../core/production-test-engine';

/**
 * セキュリティテスト設定インターフェース
 */
interface SecurityTestConfig {
  environment: string;
  region: string;
  projectName: string;
  accountId: string;
  domainName: string;
  certificateArn: string;
  hostedZoneId: string;
  maxTestDuration: number;
  maxConcurrentTests: number;
  retryAttempts: number;
  timeoutMs: number;
  costThreshold: number;
  resourceThreshold: number;
}

/**
 * テスト結果サマリーインターフェース
 */
interface TestResultSummary {
  success: boolean;
  overallSecurityScore: number;
  criticalIssues: number;
  recommendations: string[];
  errors?: string[];
  duration: number;
}

/**
 * セキュリティテスト設定を作成
 */
async function createSecurityTestConfig(environment: string): Promise<ProductionConfig> {
  return {
    environment,
    region: process.env.AWS_REGION || 'us-east-1',
    projectName: process.env.PROJECT_NAME || 'rag-system',
    accountId: process.env.AWS_ACCOUNT_ID || '',
    domainName: process.env.DOMAIN_NAME || 'rag-system.example.com',
    certificateArn: process.env.CERTIFICATE_ARN || '',
    hostedZoneId: process.env.HOSTED_ZONE_ID || '',
    enableWaf: true,
    enableCloudTrail: true,
    enableGuardDuty: true,
    enableSecurityHub: true,
    testConfiguration: {
      maxTestDuration: parseInt(process.env.MAX_TEST_DURATION || '1800000'), // 30分
      maxConcurrentTests: parseInt(process.env.MAX_CONCURRENT_TESTS || '5'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      timeoutMs: parseInt(process.env.TIMEOUT_MS || '300000'), // 5分
      enableDetailedLogging: process.env.ENABLE_DETAILED_LOGGING !== 'false',
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      enableAlerts: process.env.ENABLE_ALERTS !== 'false',
      costThreshold: parseFloat(process.env.COST_THRESHOLD || '50.0'),
      resourceThreshold: parseFloat(process.env.RESOURCE_THRESHOLD || '0.8')
    }
  };
}

/**
 * 必須環境変数の検証
 */
function validateRequiredEnvironmentVariables(config: ProductionConfig): void {
  const requiredFields = [
    { field: 'accountId', value: config.accountId, name: 'AWS_ACCOUNT_ID' },
    { field: 'domainName', value: config.domainName, name: 'DOMAIN_NAME' },
    { field: 'certificateArn', value: config.certificateArn, name: 'CERTIFICATE_ARN' },
    { field: 'hostedZoneId', value: config.hostedZoneId, name: 'HOSTED_ZONE_ID' }
  ];

  const missingFields = requiredFields.filter(field => !field.value || field.value === '');
  
  if (missingFields.length > 0) {
    const missingNames = missingFields.map(field => field.name).join(', ');
    throw new Error(`必須環境変数が設定されていません: ${missingNames}`);
  }
}

/**
 * テスト結果の評価
 */
function evaluateTestResults(testResults: any): { message: string; exitCode: number } {
  const score = testResults.summary.overallSecurityScore;
  
  if (score >= 0.9) {
    return { message: '🏆 優秀: セキュリティレベルが非常に高いです', exitCode: 0 };
  } else if (score >= 0.8) {
    return { message: '✅ 良好: セキュリティレベルは良好です', exitCode: 0 };
  } else if (score >= 0.6) {
    return { message: '⚠️ 注意: セキュリティ改善が推奨されます', exitCode: 1 };
  } else {
    return { message: '❌ 危険: 緊急のセキュリティ対策が必要です', exitCode: 1 };
  }
}

/**
 * 結果ファイルのパス生成
 */
function generateResultFilePath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `./development/logs/security/security-test-results-${timestamp}.json`;
}

/**
 * テストサマリーの表示
 */
function displayTestSummary(testResults: any): void {
  console.log('🎯 最終評価:');
  console.log(`   総合セキュリティスコア: ${(testResults.summary.overallSecurityScore * 100).toFixed(1)}%`);
  console.log(`   重要な問題: ${testResults.summary.criticalIssues}件`);
  console.log(`   推奨事項: ${testResults.summary.recommendations.length}件`);
  console.log('');
}

/**
 * 推奨事項の表示
 */
function displayRecommendations(recommendations: string[]): void {
  if (recommendations.length > 0) {
    console.log('💡 セキュリティ改善推奨事項:');
    recommendations.forEach((recommendation, index) => {
      console.log(`   ${index + 1}. ${recommendation}`);
    });
    console.log('');
  }
}

/**
 * エラーの表示
 */
function displayErrors(errors?: string[]): void {
  if (errors && errors.length > 0) {
    console.log('❌ 発生したエラー:');
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    console.log('');
  }
}

/**
 * テストエラーのハンドリング
 */
function handleTestError(error: unknown): void {
  console.error('');
  console.error('❌ 包括的セキュリティテスト実行エラー:');
  
  if (error instanceof Error) {
    console.error(`エラーメッセージ: ${error.message}`);
    
    // 環境変数関連のエラーの場合
    if (error.message.includes('必須環境変数')) {
      console.error('');
      console.error('💡 解決方法:');
      console.error('   1. .env ファイルに必要な環境変数を設定してください');
      console.error('   2. AWS認証情報が正しく設定されているか確認してください');
      console.error('   3. 必要な権限がIAMロールに付与されているか確認してください');
    }
    
    // デバッグ情報（開発環境のみ）
    if (process.env.NODE_ENV === 'development' && error.stack) {
      console.error('');
      console.error('デバッグ情報:');
      console.error(error.stack);
    }
  } else {
    console.error('予期しないエラーが発生しました:', error);
  }
  
  console.error('');
}

/**
 * リソースのクリーンアップ
 */
async function performCleanup(
  testRunner?: SecurityTestRunner,
  testEngine?: ProductionTestEngine
): Promise<void> {
  console.log('🧹 リソースをクリーンアップ中...');
  
  const cleanupPromises: Promise<void>[] = [];
  
  if (testRunner) {
    cleanupPromises.push(
      testRunner.cleanup().catch(error => {
        console.warn('⚠️ セキュリティテストランナーのクリーンアップでエラー:', error);
      })
    );
  }
  
  if (testEngine) {
    cleanupPromises.push(
      testEngine.cleanup().catch(error => {
        console.warn('⚠️ テストエンジンのクリーンアップでエラー:', error);
      })
    );
  }
  
  try {
    await Promise.allSettled(cleanupPromises);
    console.log('✅ クリーンアップ完了');
  } catch (error) {
    console.warn('⚠️ クリーンアップ処理で予期しないエラー:', error);
  }
}

async function runComprehensiveSecurityTests() {
  console.log('🚀 包括的セキュリティテスト実行開始');
  console.log('=====================================');
  console.log('');

  let testRunner: SecurityTestRunner | undefined;
  let testEngine: ProductionTestEngine | undefined;

  try {
    // 環境設定の読み込み
    const environment = process.env.NODE_ENV || 'production';
    console.log(`📋 環境: ${environment}`);

    // 設定の検証と初期化
    const config = await createSecurityTestConfig(environment);
    validateRequiredEnvironmentVariables(config);

    // テストエンジンの初期化
    console.log('🔧 テストエンジンを初期化中...');
    testEngine = new ProductionTestEngine(config);
    await testEngine.initialize();

    // セキュリティテストランナーの初期化
    console.log('🔒 セキュリティテストランナーを初期化中...');
    testRunner = new SecurityTestRunner(config, testEngine);
    await testRunner.initialize();

    // セキュリティ設定の表示
    testRunner.displaySecurityConfig();

    // 包括的セキュリティテストの実行
    console.log('🔐 包括的セキュリティテスト実行中...');
    console.log('');
    
    const startTime = Date.now();
    const testResults = await testRunner.runSecurityTests();
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log('');
    console.log('📊 包括的セキュリティテスト完了');
    console.log('=====================================');
    console.log(`⏱️ 総実行時間: ${(totalDuration / 1000).toFixed(1)}秒`);
    console.log(`✅ 総合成功: ${testResults.success ? 'PASS' : 'FAIL'}`);
    console.log('');

    // 詳細結果の表示
    if (testRunner.displaySecuritySummary) {
      testRunner.displaySecuritySummary(testResults.results);
    }

    // 結果のエクスポート
    const outputPath = generateResultFilePath();
    if (testRunner.exportSecurityResults) {
      await testRunner.exportSecurityResults(testResults.results, outputPath);
    }

    // 最終結果の評価と表示
    displayTestSummary(testResults);
    displayRecommendations(testResults.summary.recommendations);
    displayErrors(testResults.errors);

    console.log('');
    console.log('📄 詳細結果は以下のファイルに保存されました:');
    console.log(`   ${outputPath}`);
    console.log('');

    // 終了コードの決定
    const evaluation = evaluateTestResults(testResults);
    console.log(evaluation.message);
    
    if (evaluation.exitCode === 0) {
      console.log('🎉 包括的セキュリティテストが正常に完了しました');
    } else {
      console.log('⚠️ セキュリティテストで問題が検出されました');
    }

    process.exit(evaluation.exitCode);

  } catch (error) {
    handleTestError(error);
    process.exit(1);

  } finally {
    await performCleanup(testRunner, testEngine);
  }
}

// スクリプトの実行
if (require.main === module) {
  runComprehensiveSecurityTests().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

export { runComprehensiveSecurityTests };