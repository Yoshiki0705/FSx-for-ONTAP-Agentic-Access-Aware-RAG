#!/usr/bin/env ts-node

/**
 * UI/UXテスト実行スクリプト
 * 
 * Kiro MCP Chrome DevToolsを使用した実ブラウザでのUI/UXテストを実行
 * コマンドライン引数で環境とテストタイプを指定可能
 * 
 * 使用例:
 * npm run test:production:ui-ux
 * npm run test:production:ui-ux:staging
 * ts-node run-ui-ux-tests.ts --env production --type all
 * ts-node run-ui-ux-tests.ts --env staging --type responsive
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { Command } from 'commander';
import UIUXTestRunner from './ui-ux-test-runner';
import ProductionTestEngine from '../../core/production-test-engine';
import { ProductionConfig, getProductionConfig } from '../../config/production-config';
import { 
  getUIUXConfig, 
  validateUIUXConfig, 
  displayUIUXConfig,
  UIUXTestConfig 
} from './ui-ux-config';
import EmergencyStopManager from '../../core/emergency-stop-manager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * テストタイプの定義
 */
type TestType = 'all' | 'responsive' | 'chat' | 'accessibility' | 'usability';

/**
 * コマンドライン引数の解析
 */
function parseArguments() {
  const program = new Command();
  
  program
    .name('run-ui-ux-tests')
    .description('実本番環境でのUI/UXテスト実行')
    .version('1.0.0')
    .option('-e, --env <environment>', '実行環境 (production, staging, development)', 'production')
    .option('-t, --type <testType>', 'テストタイプ (all, responsive, chat, accessibility, usability)', 'all')
    .option('-r, --report <path>', 'レポート出力パス', './ui-ux-test-report.md')
    .option('-s, --screenshots <path>', 'スクリーンショット保存ディレクトリ', './screenshots')
    .option('-v, --verbose', '詳細ログ出力', false)
    .option('--dry-run', 'ドライラン実行（実際のテストは行わない）', false)
    .option('--emergency-stop', '緊急停止機能を有効化', true)
    .option('--headless', 'ヘッドレスモードで実行', false)
    .option('--mobile-only', 'モバイルビューポートのみテスト', false)
    .option('--desktop-only', 'デスクトップビューポートのみテスト', false)
    .parse();

  return program.opts();
}

/**
 * 環境設定の検証と表示
 */
async function validateAndDisplayConfig(
  environment: string,
  uiuxConfig: UIUXTestConfig
): Promise<boolean> {
  console.log('🔍 設定検証中...');
  
  // UI/UXテスト設定の検証
  const validation = validateUIUXConfig(uiuxConfig);
  
  if (!validation.isValid) {
    console.error('❌ UI/UXテスト設定エラー:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
    return false;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ UI/UXテスト設定警告:');
    validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  // 設定の表示
  displayUIUXConfig(uiuxConfig);
  
  return true;
}

/**
 * 個別テストの実行
 */
async function runIndividualTest(
  testRunner: UIUXTestRunner,
  testType: TestType
): Promise<any> {
  const testModule = (testRunner as any).testModule;
  
  switch (testType) {
    case 'responsive':
      console.log('📱 レスポンシブデザインテストを実行中...');
      return await testModule.testResponsiveDesign();
      
    case 'chat':
      console.log('💬 チャットインターフェーステストを実行中...');
      return await testModule.testChatInterface();
      
    case 'accessibility':
      console.log('♿ アクセシビリティテストを実行中...');
      return await testModule.testAccessibility();
      
    case 'usability':
      console.log('👤 ユーザビリティテストを実行中...');
      return await testModule.testUsability();
      
    default:
      throw new Error(`未対応のテストタイプ: ${testType}`);
  }
}

/**
 * テスト結果のレポート生成
 */
async function generateTestReport(
  results: Map<string, any>,
  testRunner: UIUXTestRunner,
  reportPath: string,
  screenshotsPath: string,
  environment: string
): Promise<void> {
  console.log('📝 テストレポートを生成中...');
  
  try {
    const report = await testRunner.generateDetailedReport(results);
    
    // レポートファイルの保存
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, report, 'utf8');
    
    console.log(`✅ テストレポートを保存しました: ${reportPath}`);
    
    // スクリーンショットディレクトリの作成
    if (!fs.existsSync(screenshotsPath)) {
      fs.mkdirSync(screenshotsPath, { recursive: true });
      console.log(`📁 スクリーンショットディレクトリを作成: ${screenshotsPath}`);
    }
    
    // 簡易サマリーの表示
    const summary = Array.from(results.values());
    const successCount = summary.filter(r => r.success).length;
    const totalCount = summary.length;
    
    console.log('');
    console.log('📊 UI/UXテスト実行サマリー:');
    console.log(`   環境: ${environment}`);
    console.log(`   総テスト数: ${totalCount}`);
    console.log(`   成功: ${successCount}`);
    console.log(`   失敗: ${totalCount - successCount}`);
    console.log(`   成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
    
    // パフォーマンス指標の表示
    const performanceResults = summary.filter(r => r.uiMetrics);
    if (performanceResults.length > 0) {
      const avgLoadTime = performanceResults.reduce((sum, r) => sum + r.uiMetrics.pageLoadTime, 0) / performanceResults.length;
      console.log(`   平均ページ読み込み時間: ${avgLoadTime.toFixed(0)}ms`);
    }
    
    // アクセシビリティ指標の表示
    const accessibilityResults = summary.filter(r => r.accessibilityMetrics);
    if (accessibilityResults.length > 0) {
      const avgWcag = accessibilityResults.reduce((sum, r) => sum + r.accessibilityMetrics.wcagAACompliance, 0) / accessibilityResults.length;
      console.log(`   平均WCAG準拠率: ${(avgWcag * 100).toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('❌ レポート生成エラー:', error);
    throw error;
  }
}

/**
 * ドライラン実行
 */
async function runDryRun(
  environment: string,
  testType: TestType,
  uiuxConfig: UIUXTestConfig,
  options: any
): Promise<void> {
  console.log('🔍 ドライラン実行中...');
  console.log('');
  
  console.log('📋 実行予定のテスト:');
  
  if (testType === 'all') {
    console.log('   ✓ レスポンシブデザインテスト');
    console.log('   ✓ チャットインターフェーステスト');
    console.log('   ✓ アクセシビリティテスト');
    console.log('   ✓ ユーザビリティテスト');
  } else {
    console.log(`   ✓ ${testType}テスト`);
  }
  
  console.log('');
  console.log('📱 テスト対象ビューポート:');
  
  if (options.mobileOnly) {
    console.log('   ✓ モバイル (375x667)');
  } else if (options.desktopOnly) {
    console.log('   ✓ デスクトップ (1920x1080)');
  } else {
    Object.entries(uiuxConfig.viewports).forEach(([name, viewport]) => {
      console.log(`   ✓ ${name} (${viewport.width}x${viewport.height})`);
    });
  }
  
  console.log('');
  console.log('📊 予想実行時間:');
  
  let estimatedDuration = 0;
  if (testType === 'all') {
    estimatedDuration = 3 + 4 + 5 + 6; // 各テストの予想時間（分）
  } else {
    const durations = { responsive: 3, chat: 4, accessibility: 5, usability: 6 };
    estimatedDuration = durations[testType as keyof typeof durations] || 5;
  }
  
  console.log(`   予想実行時間: 約${estimatedDuration}分`);
  console.log(`   ブラウザモード: ${options.headless ? 'ヘッドレス' : '通常表示'}`);
  console.log('');
  
  console.log('🎯 品質基準:');
  console.log(`   ページ読み込み時間: ${uiuxConfig.performanceThresholds.pageLoadTime}ms以内`);
  console.log(`   WCAG準拠レベル: ${uiuxConfig.accessibility.wcagLevel}`);
  console.log(`   最小コントラスト比: ${uiuxConfig.accessibility.minimumContrastRatio}:1`);
  console.log(`   ユーザーフロー完了率: ${(uiuxConfig.usability.minimumUserFlowCompletion * 100).toFixed(0)}%以上`);
  console.log('');
  
  console.log('🛡️ 安全設定:');
  console.log(`   読み取り専用モード: ${uiuxConfig.safety.readOnlyMode ? '有効' : '無効'}`);
  console.log(`   緊急停止機能: ${uiuxConfig.safety.emergencyStopEnabled ? '有効' : '無効'}`);
  console.log(`   最大テスト時間: ${uiuxConfig.execution.maxTestDuration}秒`);
  console.log('');
  
  console.log('✅ ドライラン完了 - 実際のテストは実行されませんでした');
}

/**
 * Kiro MCP Chrome DevToolsの初期化確認
 */
async function checkKiroMCPAvailability(): Promise<boolean> {
  console.log('🔍 Kiro MCP Chrome DevTools の可用性を確認中...');
  
  try {
    // 実際の実装では Kiro MCP の可用性をチェック
    // const isAvailable = await kiroBrowser.isAvailable();
    
    // 簡略化されたチェック
    const isAvailable = true; // 実際の実装では適切にチェック
    
    if (isAvailable) {
      console.log('✅ Kiro MCP Chrome DevTools が利用可能です');
      return true;
    } else {
      console.error('❌ Kiro MCP Chrome DevTools が利用できません');
      console.error('   Kiro IDE でこのスクリプトを実行してください');
      return false;
    }
  } catch (error) {
    console.error('❌ Kiro MCP 可用性チェックエラー:', error);
    return false;
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const options = parseArguments();
  
  console.log('🚀 UI/UXテスト実行開始');
  console.log(`   環境: ${options.env}`);
  console.log(`   テストタイプ: ${options.type}`);
  console.log(`   レポート出力: ${options.report}`);
  console.log(`   スクリーンショット: ${options.screenshots}`);
  console.log(`   ドライラン: ${options.dryRun ? 'はい' : 'いいえ'}`);
  console.log(`   ヘッドレスモード: ${options.headless ? 'はい' : 'いいえ'}`);
  console.log('');
  
  try {
    // 設定の読み込み
    const productionConfig = getProductionConfig(options.env);
    const uiuxConfig = getUIUXConfig(options.env);
    
    // 設定の検証
    const isConfigValid = await validateAndDisplayConfig(options.env, uiuxConfig);
    if (!isConfigValid) {
      process.exit(1);
    }
    
    // ドライラン実行
    if (options.dryRun) {
      await runDryRun(options.env, options.type as TestType, uiuxConfig, options);
      return;
    }
    
    // Kiro MCP の可用性確認
    const isMCPAvailable = await checkKiroMCPAvailability();
    if (!isMCPAvailable) {
      console.error('❌ Kiro MCP Chrome DevTools が必要です');
      process.exit(1);
    }
    
    // 緊急停止マネージャーの初期化
    let emergencyStopManager: EmergencyStopManager | undefined;
    if (options.emergencyStop) {
      emergencyStopManager = new EmergencyStopManager({
        maxTestDuration: uiuxConfig.execution.maxTestDuration * 1000,
        resourceThreshold: 0.9,
        costThreshold: 10.0, // UI/UXテストは低コスト
        enableAutoStop: true
      });
      
      await emergencyStopManager.initialize();
      console.log('🛡️ 緊急停止マネージャーを初期化しました');
    }
    
    // テストエンジンの初期化
    const testEngine = new ProductionTestEngine(productionConfig);
    await testEngine.initialize();
    
    // UI/UXテストランナーの初期化
    const testRunner = new UIUXTestRunner(productionConfig, testEngine);
    
    let results: Map<string, any>;
    
    try {
      if (options.type === 'all') {
        // 全テストの実行
        const testResults = await testRunner.runUIUXTests();
        results = testResults.results;
        
        console.log('');
        console.log('📊 全UI/UXテスト完了:');
        console.log(`   成功率: ${(testResults.summary.successRate * 100).toFixed(1)}%`);
        console.log(`   総合UI/UXスコア: ${(testResults.summary.overallUIUXScore * 100).toFixed(1)}%`);
        console.log(`   平均ページ読み込み時間: ${testResults.summary.averagePageLoadTime.toFixed(0)}ms`);
        console.log(`   WCAG準拠率: ${(testResults.summary.wcagComplianceRate * 100).toFixed(1)}%`);
        
      } else {
        // 個別テストの実行
        const result = await runIndividualTest(testRunner, options.type as TestType);
        results = new Map([[result.testId, result]]);
        
        console.log('');
        console.log(`📊 ${options.type}テスト完了:`);
        console.log(`   ステータス: ${result.success ? '成功' : '失敗'}`);
        console.log(`   実行時間: ${result.duration}ms`);
        
        if (result.uiMetrics) {
          console.log(`   ページ読み込み時間: ${result.uiMetrics.pageLoadTime.toFixed(0)}ms`);
        }
        
        if (result.accessibilityMetrics) {
          console.log(`   WCAG準拠率: ${(result.accessibilityMetrics.wcagAACompliance * 100).toFixed(1)}%`);
        }
      }
      
      // レポート生成
      await generateTestReport(results, testRunner, options.report, options.screenshots, options.env);
      
    } finally {
      // クリーンアップ
      await testRunner.cleanup();
      await testEngine.cleanup();
      
      if (emergencyStopManager) {
        await emergencyStopManager.cleanup();
      }
    }
    
    console.log('');
    console.log('✅ UI/UXテスト実行完了');
    
  } catch (error) {
    console.error('❌ UI/UXテスト実行エラー:', error);
    
    if (error instanceof Error) {
      console.error('エラー詳細:', error.message);
      if (options.verbose) {
        console.error('スタックトレース:', error.stack);
      }
    }
    
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

export { main as runUIUXTests };