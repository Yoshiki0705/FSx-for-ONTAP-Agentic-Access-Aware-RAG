#!/usr/bin/env ts-node

/**
 * UI統合テスト実行スクリプト
 * 全UIテストの実行とレポート生成
 */

import * as fs from 'fs';
import * as path from 'path';
import { UIIntegrationTestRunner, UIIntegrationTestConfig, UIIntegrationTestResult } from '../modules/ui/ui-integration-test-runner';

/**
 * 環境設定の読み込みと検証
 */
interface EnvironmentConfig {
  baseUrl: string;
  testEnvironment: 'development' | 'staging' | 'production';
  browserSettings: {
    headless: boolean;
    generateScreenshots: boolean;
    generateVideo: boolean;
    detailedLogs: boolean;
  };
  enabledTests: {
    responsiveDesign: boolean;
    realtimeChat: boolean;
    documentSourceDisplay: boolean;
    accessibility: boolean;
  };
}

/**
 * 環境変数から設定を安全に読み込み
 */
function loadEnvironmentConfig(): EnvironmentConfig {
  // URL検証
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  try {
    new URL(baseUrl);
  } catch (error) {
    throw new Error(`無効なベースURL: ${baseUrl}`);
  }

  // 環境検証
  const testEnvironment = process.env.TEST_ENVIRONMENT as 'development' | 'staging' | 'production';
  if (!['development', 'staging', 'production'].includes(testEnvironment || 'development')) {
    throw new Error(`無効なテスト環境: ${testEnvironment}`);
  }

  return {
    baseUrl,
    testEnvironment: testEnvironment || 'development',
    browserSettings: {
      headless: process.env.HEADLESS_MODE === 'true',
      generateScreenshots: process.env.GENERATE_SCREENSHOTS !== 'false',
      generateVideo: process.env.GENERATE_VIDEO === 'true',
      detailedLogs: process.env.DETAILED_LOGS !== 'false'
    },
    enabledTests: {
      responsiveDesign: process.env.INCLUDE_RESPONSIVE_DESIGN !== 'false',
      realtimeChat: process.env.INCLUDE_REALTIME_CHAT !== 'false',
      documentSourceDisplay: process.env.INCLUDE_DOCUMENT_SOURCE_DISPLAY !== 'false',
      accessibility: process.env.INCLUDE_ACCESSIBILITY !== 'false'
    }
  };
}

interface TestExecutionOptions {
  baseUrl: string;
  testEnvironment: 'development' | 'staging' | 'production';
  enabledTests: {
    responsiveDesign: boolean;
    realtimeChat: boolean;
    documentSourceDisplay: boolean;
    accessibility: boolean;
  };
  outputDir: string;
  reportFormats: ('json' | 'markdown' | 'html')[];
}

/**
 * メイン実行関数（保守性向上）
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  let config: EnvironmentConfig;

  try {
    // 環境設定の読み込みと検証
    config = loadEnvironmentConfig();
    
    console.log('🎨 UI統合テスト実行スクリプトを開始します...');
    console.log(`📅 実行日時: ${new Date().toLocaleString('ja-JP')}`);
    console.log(`🌐 テスト環境: ${config.testEnvironment}`);
    console.log(`🔗 ベースURL: ${config.baseUrl}`);

    // 事前検証
    await validatePrerequisites(config);

    // 出力ディレクトリの準備
    const outputDir = await prepareOutputDirectory(config.testEnvironment);

    // テスト設定の構築
    const options: TestExecutionOptions = {
      baseUrl: config.baseUrl,
      testEnvironment: config.testEnvironment,
      enabledTests: config.enabledTests,
      outputDir,
      reportFormats: ['json', 'markdown']
    };

    // 有効なテストの確認
    validateTestConfiguration(options);

    // テストの実行
    const result = await executeUITests(options);

    // レポートの生成
    await generateReports(result, options);

    // 結果の評価と終了処理
    const executionTime = Date.now() - startTime;
    await handleTestCompletion(result, executionTime);

  } catch (error) {
    console.error('❌ UI統合テストの実行中にエラーが発生しました:', error);
    
    // エラーレポートの生成
    await generateErrorReport(error, Date.now() - startTime);
    
    process.exit(1);
  }
}

/**
 * 事前検証の実行
 */
async function validatePrerequisites(config: EnvironmentConfig): Promise<void> {
  // ベースURLの接続確認（本番環境以外）
  if (config.testEnvironment !== 'production') {
    try {
      const response = await fetch(config.baseUrl, { 
        method: 'HEAD',
        timeout: 5000 
      });
      if (!response.ok) {
        console.warn(`⚠️  ベースURL ${config.baseUrl} への接続に問題があります (${response.status})`);
      }
    } catch (error) {
      console.warn(`⚠️  ベースURL ${config.baseUrl} への接続確認に失敗:`, error);
    }
  }
}

/**
 * テスト設定の検証
 */
function validateTestConfiguration(options: TestExecutionOptions): void {
  const enabledTestCount = Object.values(options.enabledTests).filter(Boolean).length;
  if (enabledTestCount === 0) {
    throw new Error('有効なテストがありません。少なくとも1つのテストを有効にしてください。');
  }

  console.log(`\n📋 実行予定テスト (${enabledTestCount}個):`);
  if (options.enabledTests.responsiveDesign) console.log('  ✅ レスポンシブデザインテスト');
  if (options.enabledTests.realtimeChat) console.log('  ✅ リアルタイムチャットテスト');
  if (options.enabledTests.documentSourceDisplay) console.log('  ✅ 文書ソース表示テスト');
  if (options.enabledTests.accessibility) console.log('  ✅ アクセシビリティテスト');
}

/**
 * 出力ディレクトリの準備（セキュリティ強化）
 */
async function prepareOutputDirectory(testEnvironment: string): Promise<string> {
  // パストラバーサル攻撃防止
  const sanitizedEnvironment = testEnvironment.replace(/[^a-zA-Z0-9-]/g, '');
  if (sanitizedEnvironment !== testEnvironment) {
    throw new Error(`無効な環境名: ${testEnvironment}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const outputDir = path.resolve(__dirname, '..', 'reports', 'ui-integration', `${sanitizedEnvironment}-${timestamp}`);
  
  // ディレクトリトラバーサル防止
  const reportsDir = path.resolve(__dirname, '..', 'reports');
  if (!outputDir.startsWith(reportsDir)) {
    throw new Error('不正なディレクトリパス');
  }

  try {
    await fs.promises.mkdir(outputDir, { recursive: true, mode: 0o755 });
    console.log(`📁 出力ディレクトリを作成しました: ${outputDir}`);
    return outputDir;
  } catch (error) {
    console.error('❌ 出力ディレクトリの作成に失敗:', error);
    throw error;
  }
}

/**
 * UI統合テストの実行（型安全性向上）
 */
async function executeUITests(options: TestExecutionOptions): Promise<UIIntegrationTestResult> {
  console.log('\n🚀 UI統合テストを実行中...');

  // 環境設定の再取得（型安全）
  const envConfig = loadEnvironmentConfig();

  const config: UIIntegrationTestConfig = {
    baseUrl: options.baseUrl,
    enabledTests: options.enabledTests,
    testEnvironment: options.testEnvironment,
    browserConfig: {
      headless: envConfig.browserSettings.headless,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000
    },
    reportingConfig: {
      generateScreenshots: envConfig.browserSettings.generateScreenshots,
      generateVideoRecording: envConfig.browserSettings.generateVideo,
      detailedLogs: envConfig.browserSettings.detailedLogs
    }
  };

  // 設定の検証
  validateUITestConfig(config);

  const runner = new UIIntegrationTestRunner(config);
  return await runner.runTests();
}

/**
 * UIテスト設定の検証
 */
function validateUITestConfig(config: UIIntegrationTestConfig): void {
  if (!config.baseUrl) {
    throw new Error('ベースURLが設定されていません');
  }

  if (!config.testEnvironment) {
    throw new Error('テスト環境が設定されていません');
  }

  if (!config.browserConfig.viewport.width || !config.browserConfig.viewport.height) {
    throw new Error('ブラウザビューポートが正しく設定されていません');
  }

  if (config.browserConfig.timeout <= 0) {
    throw new Error('タイムアウト値は正の数である必要があります');
  }
}

/**
 * レポートの生成（並列処理でパフォーマンス向上）
 */
async function generateReports(result: UIIntegrationTestResult, options: TestExecutionOptions): Promise<void> {
  console.log('\n📊 テストレポートを生成中...');

  const reportGenerators = options.reportFormats.map(async (format) => {
    try {
      switch (format) {
        case 'json':
          await generateJSONReport(result, options.outputDir);
          break;
        case 'markdown':
          await generateMarkdownReport(result, options.outputDir);
          break;
        case 'html':
          await generateHTMLReport(result, options.outputDir);
          break;
      }
      console.log(`✅ ${format.toUpperCase()}レポート生成完了`);
    } catch (error) {
      console.error(`❌ ${format.toUpperCase()}レポートの生成に失敗:`, error);
      throw error;
    }
  });

  // 並列実行でパフォーマンス向上
  const results = await Promise.allSettled(reportGenerators);
  
  // 失敗したレポート生成の確認
  const failedReports = results.filter(result => result.status === 'rejected');
  if (failedReports.length > 0) {
    console.warn(`⚠️  ${failedReports.length}個のレポート生成が失敗しました`);
  }
}

/**
 * JSONレポートの生成
 */
async function generateJSONReport(result: UIIntegrationTestResult, outputDir: string): Promise<void> {
  const reportPath = path.join(outputDir, 'ui-integration-test-result.json');
  
  const reportData = {
    metadata: {
      testType: 'UI Integration Test',
      executionDate: new Date().toISOString(),
      environment: TEST_ENVIRONMENT,
      baseUrl: BASE_URL,
      version: '1.0.0'
    },
    summary: {
      success: result.success,
      overallScore: result.overallUIScore,
      duration: result.duration,
      testSummary: result.testSummary
    },
    scores: {
      userExperience: result.userExperienceScore,
      performance: result.performanceScore,
      accessibility: result.accessibilityScore,
      functionality: result.functionalityScore
    },
    testResults: {
      responsiveDesign: result.responsiveDesignResult,
      realtimeChat: result.realtimeChatResult,
      documentSourceDisplay: result.documentSourceDisplayResult,
      accessibility: result.accessibilityResult
    },
    recommendations: result.recommendations
  };

  await fs.promises.writeFile(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(`✅ JSONレポートを生成しました: ${reportPath}`);
}

/**
 * Markdownレポートの生成
 */
async function generateMarkdownReport(result: UIIntegrationTestResult, outputDir: string): Promise<void> {
  const reportPath = path.join(outputDir, 'ui-integration-test-report.md');
  
  const markdown = `# UI統合テストレポート

## 📋 テスト概要

- **実行日時**: ${new Date().toLocaleString('ja-JP')}
- **テスト環境**: ${TEST_ENVIRONMENT}
- **ベースURL**: ${BASE_URL}
- **実行時間**: ${(result.duration / 1000).toFixed(1)}秒
- **総合結果**: ${result.success ? '✅ 合格' : '❌ 不合格'}

## 📊 スコア概要

| カテゴリ | スコア | 状態 |
|---------|--------|------|
| **総合UIスコア** | ${result.overallUIScore.toFixed(1)}/100 | ${result.overallUIScore >= 85 ? '✅' : '❌'} |
| ユーザーエクスペリエンス | ${result.userExperienceScore.toFixed(1)}/100 | ${result.userExperienceScore >= 80 ? '✅' : '⚠️'} |
| パフォーマンス | ${result.performanceScore.toFixed(1)}/100 | ${result.performanceScore >= 80 ? '✅' : '⚠️'} |
| アクセシビリティ | ${result.accessibilityScore.toFixed(1)}/100 | ${result.accessibilityScore >= 85 ? '✅' : '❌'} |
| 機能性 | ${result.functionalityScore.toFixed(1)}/100 | ${result.functionalityScore >= 80 ? '✅' : '⚠️'} |

## 📈 テストサマリー

- **総テスト数**: ${result.testSummary.totalTests}
- **合格テスト**: ${result.testSummary.passedTests}
- **不合格テスト**: ${result.testSummary.failedTests}
- **テストカバレッジ**: ${result.testSummary.testCoverage.toFixed(1)}%

### 問題の内訳

- 🔴 **重要な問題**: ${result.testSummary.criticalIssues}件
- 🟡 **主要な問題**: ${result.testSummary.majorIssues}件
- 🟢 **軽微な問題**: ${result.testSummary.minorIssues}件

## 🔍 個別テスト結果

${generateIndividualTestResults(result)}

## 💡 推奨事項

${result.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## 📝 詳細情報

- **レスポンシブデザイン**: ${result.responsiveDesignResult ? `${result.responsiveDesignResult.success ? '✅ 合格' : '❌ 不合格'} (${result.responsiveDesignResult.overallResponsiveScore.toFixed(1)}/100)` : '⏭️ スキップ'}
- **リアルタイムチャット**: ${result.realtimeChatResult ? `${result.realtimeChatResult.success ? '✅ 合格' : '❌ 不合格'} (${result.realtimeChatResult.overallChatScore.toFixed(1)}/100)` : '⏭️ スキップ'}
- **文書ソース表示**: ${result.documentSourceDisplayResult ? `${result.documentSourceDisplayResult.success ? '✅ 合格' : '❌ 不合格'} (${result.documentSourceDisplayResult.overallSourceScore.toFixed(1)}/100)` : '⏭️ スキップ'}
- **アクセシビリティ**: ${result.accessibilityResult ? `${result.accessibilityResult.success ? '✅ 合格' : '❌ 不合格'} (${result.accessibilityResult.overallAccessibilityScore.toFixed(1)}/100)` : '⏭️ スキップ'}

---
*このレポートは自動生成されました - ${new Date().toISOString()}*
`;

  await fs.promises.writeFile(reportPath, markdown, 'utf-8');
  console.log(`✅ Markdownレポートを生成しました: ${reportPath}`);
}

/**
 * 個別テスト結果の生成
 */
function generateIndividualTestResults(result: UIIntegrationTestResult): string {
  let content = '';

  if (result.responsiveDesignResult) {
    content += `### 📱 レスポンシブデザインテスト

- **スコア**: ${result.responsiveDesignResult.overallResponsiveScore.toFixed(1)}/100
- **結果**: ${result.responsiveDesignResult.success ? '✅ 合格' : '❌ 不合格'}
- **テスト対象デバイス**: ${result.responsiveDesignResult.deviceResults.length}台
- **レイアウト一貫性**: ${result.responsiveDesignResult.layoutConsistencyScore.toFixed(1)}/100
- **クロスデバイス互換性**: ${result.responsiveDesignResult.crossDeviceCompatibility.toFixed(1)}/100

`;
  }

  if (result.realtimeChatResult) {
    content += `### 💬 リアルタイムチャットテスト

- **スコア**: ${result.realtimeChatResult.overallChatScore.toFixed(1)}/100
- **結果**: ${result.realtimeChatResult.success ? '✅ 合格' : '❌ 不合格'}
- **信頼性**: ${result.realtimeChatResult.reliabilityScore.toFixed(1)}/100
- **パフォーマンス**: ${result.realtimeChatResult.performanceScore.toFixed(1)}/100
- **ユーザーエクスペリエンス**: ${result.realtimeChatResult.userExperienceScore.toFixed(1)}/100

`;
  }

  if (result.documentSourceDisplayResult) {
    content += `### 📚 文書ソース表示テスト

- **スコア**: ${result.documentSourceDisplayResult.overallSourceScore.toFixed(1)}/100
- **結果**: ${result.documentSourceDisplayResult.success ? '✅ 合格' : '❌ 不合格'}
- **帰属精度**: ${result.documentSourceDisplayResult.attributionAccuracy.toFixed(1)}/100
- **表示品質**: ${result.documentSourceDisplayResult.displayQuality.toFixed(1)}/100
- **コンプライアンス**: ${result.documentSourceDisplayResult.complianceScore.toFixed(1)}/100

`;
  }

  if (result.accessibilityResult) {
    content += `### ♿ アクセシビリティテスト

- **スコア**: ${result.accessibilityResult.overallAccessibilityScore.toFixed(1)}/100
- **結果**: ${result.accessibilityResult.success ? '✅ 合格' : '❌ 不合格'}
- **WCAG準拠レベル**: ${result.accessibilityResult.wcagComplianceLevel}
- **重要な問題**: ${result.accessibilityResult.criticalIssueCount}件
- **自動テストカバレッジ**: ${result.accessibilityResult.automatedTestCoverage.toFixed(1)}%

`;
  }

  return content;
}

/**
 * HTMLレポートの生成
 */
async function generateHTMLReport(result: UIIntegrationTestResult, outputDir: string): Promise<void> {
  const reportPath = path.join(outputDir, 'ui-integration-test-report.html');
  
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI統合テストレポート</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .score-card { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; }
        .score-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        .test-section { margin: 30px 0; padding: 20px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎨 UI統合テストレポート</h1>
        <p><strong>実行日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
        <p><strong>テスト環境:</strong> ${TEST_ENVIRONMENT}</p>
        <p><strong>ベースURL:</strong> ${BASE_URL}</p>
        <p><strong>総合結果:</strong> ${result.success ? '<span class="success">✅ 合格</span>' : '<span class="danger">❌ 不合格</span>'}</p>
    </div>

    <div class="score-grid">
        <div class="score-card">
            <h3>総合UIスコア</h3>
            <div class="score-value ${result.overallUIScore >= 85 ? 'success' : 'danger'}">${result.overallUIScore.toFixed(1)}</div>
            <p>/100</p>
        </div>
        <div class="score-card">
            <h3>ユーザーエクスペリエンス</h3>
            <div class="score-value ${result.userExperienceScore >= 80 ? 'success' : 'warning'}">${result.userExperienceScore.toFixed(1)}</div>
            <p>/100</p>
        </div>
        <div class="score-card">
            <h3>パフォーマンス</h3>
            <div class="score-value ${result.performanceScore >= 80 ? 'success' : 'warning'}">${result.performanceScore.toFixed(1)}</div>
            <p>/100</p>
        </div>
        <div class="score-card">
            <h3>アクセシビリティ</h3>
            <div class="score-value ${result.accessibilityScore >= 85 ? 'success' : 'danger'}">${result.accessibilityScore.toFixed(1)}</div>
            <p>/100</p>
        </div>
    </div>

    <div class="test-section">
        <h2>📈 テストサマリー</h2>
        <ul>
            <li><strong>総テスト数:</strong> ${result.testSummary.totalTests}</li>
            <li><strong>合格テスト:</strong> ${result.testSummary.passedTests}</li>
            <li><strong>不合格テスト:</strong> ${result.testSummary.failedTests}</li>
            <li><strong>テストカバレッジ:</strong> ${result.testSummary.testCoverage.toFixed(1)}%</li>
            <li><strong>実行時間:</strong> ${(result.testSummary.executionTime / 1000).toFixed(1)}秒</li>
        </ul>
    </div>

    <div class="recommendations">
        <h2>💡 推奨事項</h2>
        <ol>
            ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ol>
    </div>

    <footer style="margin-top: 50px; text-align: center; color: #6c757d;">
        <p>このレポートは自動生成されました - ${new Date().toISOString()}</p>
    </footer>
</body>
</html>`;

  await fs.promises.writeFile(reportPath, html, 'utf-8');
  console.log(`✅ HTMLレポートを生成しました: ${reportPath}`);
}

/**
 * エラーレポートの生成（強化版）
 */
async function generateErrorReport(error: unknown, executionTime: number): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const errorReportDir = path.resolve(__dirname, '..', 'reports', 'errors');
  const errorReportPath = path.join(errorReportDir, `ui-integration-error-${timestamp}.json`);

  // エラー情報の詳細分析
  const errorAnalysis = analyzeError(error);

  const errorReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      testType: 'UI Integration Test',
      reportVersion: '1.0.0'
    },
    execution: {
      executionTime,
      environment: process.env.TEST_ENVIRONMENT || 'unknown',
      baseUrl: process.env.BASE_URL || 'unknown'
    },
    error: errorAnalysis,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    },
    recommendations: generateErrorRecommendations(errorAnalysis)
  };

  try {
    await fs.promises.mkdir(errorReportDir, { recursive: true, mode: 0o755 });
    await fs.promises.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2), 'utf-8');
    console.log(`📄 エラーレポートを生成しました: ${errorReportPath}`);
  } catch (reportError) {
    console.error('❌ エラーレポートの生成に失敗:', reportError);
    // フォールバック: コンソールにエラー情報を出力
    console.error('エラー詳細:', JSON.stringify(errorReport, null, 2));
  }
}

/**
 * エラーの詳細分析
 */
function analyzeError(error: unknown): {
  message: string;
  stack?: string;
  type: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  if (error instanceof Error) {
    let category = 'unknown';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // エラーカテゴリの判定
    if (error.message.includes('ENOENT') || error.message.includes('ファイル')) {
      category = 'file-system';
      severity = 'high';
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('接続')) {
      category = 'network';
      severity = 'high';
    } else if (error.message.includes('permission') || error.message.includes('権限')) {
      category = 'permission';
      severity = 'critical';
    } else if (error.message.includes('timeout') || error.message.includes('タイムアウト')) {
      category = 'timeout';
      severity = 'medium';
    }

    return {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      category,
      severity
    };
  }

  return {
    message: String(error),
    type: typeof error,
    category: 'unknown',
    severity: 'low'
  };
}

/**
 * エラーに基づく推奨事項の生成
 */
function generateErrorRecommendations(errorAnalysis: any): string[] {
  const recommendations: string[] = [];

  switch (errorAnalysis.category) {
    case 'file-system':
      recommendations.push('ファイルパスとディレクトリの存在を確認してください');
      recommendations.push('ファイルの読み書き権限を確認してください');
      break;
    case 'network':
      recommendations.push('ネットワーク接続を確認してください');
      recommendations.push('ベースURLが正しく設定されているか確認してください');
      break;
    case 'permission':
      recommendations.push('実行権限を確認してください');
      recommendations.push('ファイルシステムの権限設定を見直してください');
      break;
    case 'timeout':
      recommendations.push('タイムアウト値を増やすことを検討してください');
      recommendations.push('システムリソースの使用状況を確認してください');
      break;
    default:
      recommendations.push('ログファイルで詳細なエラー情報を確認してください');
      recommendations.push('システム環境と依存関係を確認してください');
  }

  return recommendations;
}

/**
 * テスト完了処理
 */
async function handleTestCompletion(result: UIIntegrationTestResult, executionTime: number): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🏁 UI統合テスト完了');
  console.log('='.repeat(80));
  
  console.log(`⏱️  総実行時間: ${(executionTime / 1000).toFixed(1)}秒`);
  console.log(`📊 総合スコア: ${result.overallUIScore.toFixed(1)}/100`);
  console.log(`🎯 テスト成功率: ${result.testSummary.testCoverage.toFixed(1)}%`);

  if (result.success) {
    console.log('🎉 すべてのUIテストが正常に完了しました！');
    process.exit(0);
  } else {
    console.log('⚠️  一部のテストが失敗しました。詳細はレポートを確認してください。');
    
    if (result.testSummary.criticalIssues > 0) {
      console.log(`🔴 重要な問題が ${result.testSummary.criticalIssues}件 検出されました。`);
    }
    
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を呼び出し
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 予期しないエラーが発生しました:', error);
    process.exit(1);
  });
}

export { main as runUIIntegrationTests };