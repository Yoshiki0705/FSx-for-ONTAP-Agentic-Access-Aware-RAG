#!/usr/bin/env node

/**
 * 統合テストスイート実行スクリプト
 * 
 * 全テストモジュールを統合して実行し、包括的なレポートを生成
 * 
 * 使用方法:
 *   npm run test:integration
 *   node run-integration-test-suite.ts
 *   node run-integration-test-suite.ts --mode=parallel
 *   node run-integration-test-suite.ts --modules=auth,chatbot --format=html
 */

import { IntegrationTestSuite, DefaultIntegrationTestSuiteConfig } from './integration-test-suite';
import { IntegrationReportGenerator, DefaultReportConfig } from './reporting/integration-report-generator';
import { TestOrchestrator } from './orchestration/test-orchestrator';

// コマンドライン引数の解析
interface CliOptions {
  mode: 'sequential' | 'parallel' | 'hybrid';
  modules: string[];
  format: ('json' | 'html' | 'pdf' | 'csv')[];
  output: string;
  timeout: number;
  retries: number;
  stopOnFailure: boolean;
  verbose: boolean;
  help: boolean;
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🚀 統合テストスイート実行開始');
  console.log('=====================================');
  
  try {
    // コマンドライン引数の解析
    const options = parseCommandLineArgs();
    
    // ヘルプ表示
    if (options.help) {
      showHelp();
      return;
    }
    
    // 設定の構築
    const config = buildTestConfig(options);
    const reportConfig = buildReportConfig(options);
    
    // 実行前の情報表示
    displayExecutionInfo(config, options);
    
    // 統合テストスイートの初期化と実行
    const testSuite = new IntegrationTestSuite(config);
    const testResults = await testSuite.execute();
    
    // 結果の表示
    displayResults(testResults);
    
    // レポート生成
    const reportGenerator = new IntegrationReportGenerator(reportConfig);
    const reportFiles = await reportGenerator.generateReport(testResults);
    
    // 生成されたレポートファイルの表示
    displayGeneratedReports(reportFiles);
    
    // 終了コードの決定
    const exitCode = testResults.overall.success ? 0 : 1;
    
    console.log('=====================================');
    console.log(`✅ 統合テストスイート実行完了 (終了コード: ${exitCode})`);
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ 統合テストスイート実行エラー:', error);
    console.error('=====================================');
    process.exit(1);
  }
}

/**
 * コマンドライン引数の解析
 */
function parseCommandLineArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    mode: 'hybrid',
    modules: [],
    format: ['json', 'html'],
    output: './test-reports',
    timeout: 300000, // 5分
    retries: 2,
    stopOnFailure: false,
    verbose: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--mode':
      case '-m':
        options.mode = args[++i] as any;
        break;
        
      case '--modules':
        options.modules = args[++i].split(',').map(m => m.trim());
        break;
        
      case '--format':
      case '-f':
        options.format = args[++i].split(',').map(f => f.trim()) as any;
        break;
        
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
        
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i], 10);
        break;
        
      case '--retries':
      case '-r':
        options.retries = parseInt(args[++i], 10);
        break;
        
      case '--stop-on-failure':
        options.stopOnFailure = true;
        break;
        
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
        
      case '--help':
      case '-h':
        options.help = true;
        break;
        
      default:
        if (arg.startsWith('--')) {
          console.warn(`⚠️  未知のオプション: ${arg}`);
        }
    }
  }
  
  return options;
}

/**
 * テスト設定の構築
 */
function buildTestConfig(options: CliOptions): any {
  const config = { ...DefaultIntegrationTestSuiteConfig };
  
  // 実行モードの設定
  config.executionMode = options.mode;
  
  // モジュール選択の設定
  if (options.modules.length > 0) {
    // 全モジュールを無効化
    Object.keys(config.enabledModules).forEach(key => {
      config.enabledModules[key as keyof typeof config.enabledModules] = false;
    });
    
    // 指定されたモジュールのみ有効化
    for (const moduleName of options.modules) {
      const normalizedName = normalizeModuleName(moduleName);
      if (normalizedName in config.enabledModules) {
        config.enabledModules[normalizedName as keyof typeof config.enabledModules] = true;
      } else {
        console.warn(`⚠️  未知のモジュール: ${moduleName}`);
      }
    }
  }
  
  // 実行制御の設定
  config.execution.timeoutPerModule = options.timeout;
  config.execution.retryAttempts = options.retries;
  config.execution.stopOnFirstFailure = options.stopOnFailure;
  
  // 詳細ログの設定
  if (options.verbose) {
    console.log('🔧 詳細ログモードが有効です');
  }
  
  return config;
}

/**
 * レポート設定の構築
 */
function buildReportConfig(options: CliOptions): any {
  const config = { ...DefaultReportConfig };
  
  // 出力ディレクトリの設定
  config.outputDirectory = options.output;
  
  // 出力形式の設定
  config.formats = options.format;
  
  // 詳細ログの設定
  config.includeDetailedLogs = options.verbose;
  
  return config;
}

/**
 * モジュール名の正規化
 */
function normalizeModuleName(moduleName: string): string {
  const moduleMap: { [key: string]: string } = {
    'auth': 'authentication',
    'access': 'accessControl',
    'chat': 'chatbot',
    'perf': 'performance',
    'ui': 'uiUx',
    'ux': 'uiUx',
    'sec': 'security',
    'integration': 'integration'
  };
  
  return moduleMap[moduleName.toLowerCase()] || moduleName;
}

/**
 * 実行情報の表示
 */
function displayExecutionInfo(config: any, options: CliOptions): void {
  console.log('📋 実行設定:');
  console.log(`   実行モード: ${config.executionMode}`);
  console.log(`   有効モジュール: ${Object.entries(config.enabledModules)
    .filter(([_, enabled]) => enabled)
    .map(([name, _]) => name)
    .join(', ')}`);
  console.log(`   タイムアウト: ${config.execution.timeoutPerModule}ms`);
  console.log(`   リトライ回数: ${config.execution.retryAttempts}`);
  console.log(`   失敗時停止: ${config.execution.stopOnFirstFailure ? 'はい' : 'いいえ'}`);
  console.log(`   出力形式: ${options.format.join(', ')}`);
  console.log(`   出力先: ${options.output}`);
  console.log('');
}

/**
 * 結果の表示
 */
function displayResults(testResults: any): void {
  console.log('');
  console.log('📊 テスト実行結果:');
  console.log('=====================================');
  
  // 全体結果
  const overall = testResults.overall;
  const statusIcon = overall.success ? '✅' : '❌';
  const statusText = overall.success ? 'SUCCESS' : 'FAILURE';
  
  console.log(`${statusIcon} 全体ステータス: ${statusText}`);
  console.log(`📈 品質スコア: ${overall.qualityScore.toFixed(1)}%`);
  console.log(`🧪 総テスト数: ${overall.totalTests}`);
  console.log(`✅ 成功: ${overall.passedTests}`);
  console.log(`❌ 失敗: ${overall.failedTests}`);
  console.log(`⏭️  スキップ: ${overall.skippedTests}`);
  console.log(`⏱️  実行時間: ${(overall.executionTime / 1000).toFixed(2)}秒`);
  
  // モジュール別結果
  console.log('');
  console.log('📋 モジュール別結果:');
  console.log('-------------------------------------');
  
  for (const [moduleName, moduleResult] of Object.entries(testResults.modules)) {
    const result = moduleResult as any;
    const moduleIcon = result.success ? '✅' : '❌';
    const duration = ((result.duration || 0) / 1000).toFixed(2);
    
    console.log(`${moduleIcon} ${moduleName}: ${result.success ? 'SUCCESS' : 'FAILURE'} (${duration}s)`);
    
    if (result.error) {
      console.log(`   エラー: ${result.error}`);
    }
    
    if (result.metrics) {
      displayModuleMetrics(moduleName, result.metrics);
    }
  }
  
  // 分析結果
  if (testResults.analysis) {
    displayAnalysisResults(testResults.analysis);
  }
}

/**
 * モジュールメトリクスの表示
 */
function displayModuleMetrics(moduleName: string, metrics: any): void {
  switch (moduleName) {
    case 'performance':
      if (metrics.responseTime) {
        console.log(`   平均応答時間: ${metrics.responseTime}ms`);
      }
      if (metrics.throughput) {
        console.log(`   スループット: ${metrics.throughput} req/s`);
      }
      break;
      
    case 'security':
      if (metrics.securityScore) {
        console.log(`   セキュリティスコア: ${metrics.securityScore}%`);
      }
      if (metrics.vulnerabilities) {
        console.log(`   脆弱性: ${metrics.vulnerabilities}件`);
      }
      break;
      
    case 'uiUx':
      if (metrics.accessibilityScore) {
        console.log(`   アクセシビリティスコア: ${metrics.accessibilityScore}%`);
      }
      if (metrics.usabilityScore) {
        console.log(`   ユーザビリティスコア: ${metrics.usabilityScore}%`);
      }
      break;
  }
}

/**
 * 分析結果の表示
 */
function displayAnalysisResults(analysis: any): void {
  console.log('');
  console.log('🔍 分析結果:');
  console.log('-------------------------------------');
  
  // 重要な問題
  if (analysis.criticalIssues && analysis.criticalIssues.length > 0) {
    console.log('🚨 重要な問題:');
    for (const issue of analysis.criticalIssues) {
      console.log(`   • ${issue}`);
    }
  }
  
  // 推奨事項
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    console.log('💡 推奨事項:');
    for (const recommendation of analysis.recommendations.slice(0, 3)) {
      console.log(`   • ${recommendation}`);
    }
  }
  
  // パフォーマンスボトルネック
  if (analysis.performanceBottlenecks && analysis.performanceBottlenecks.length > 0) {
    console.log('⚡ パフォーマンスボトルネック:');
    for (const bottleneck of analysis.performanceBottlenecks) {
      console.log(`   • ${bottleneck}`);
    }
  }
  
  // セキュリティ懸念
  if (analysis.securityConcerns && analysis.securityConcerns.length > 0) {
    console.log('🔒 セキュリティ懸念:');
    for (const concern of analysis.securityConcerns) {
      console.log(`   • ${concern}`);
    }
  }
}

/**
 * 生成されたレポートファイルの表示
 */
function displayGeneratedReports(reportFiles: string[]): void {
  console.log('');
  console.log('📄 生成されたレポート:');
  console.log('-------------------------------------');
  
  for (const filePath of reportFiles) {
    console.log(`📋 ${filePath}`);
  }
  
  if (reportFiles.length === 0) {
    console.log('⚠️  レポートファイルが生成されませんでした');
  }
}

/**
 * ヘルプの表示
 */
function showHelp(): void {
  console.log(`
統合テストスイート実行スクリプト

使用方法:
  node run-integration-test-suite.ts [オプション]

オプション:
  -m, --mode <mode>           実行モード (sequential|parallel|hybrid) [default: hybrid]
  --modules <modules>         実行するモジュール (カンマ区切り)
  -f, --format <formats>      レポート形式 (json|html|pdf|csv) [default: json,html]
  -o, --output <directory>    出力ディレクトリ [default: ./test-reports]
  -t, --timeout <ms>          モジュール別タイムアウト [default: 300000]
  -r, --retries <count>       リトライ回数 [default: 2]
  --stop-on-failure          最初の失敗で停止
  -v, --verbose              詳細ログ出力
  -h, --help                 このヘルプを表示

モジュール名:
  authentication (auth)       認証テスト
  accessControl (access)      アクセス制御テスト
  chatbot (chat)             チャットボットテスト
  performance (perf)         パフォーマンステスト
  uiUx (ui, ux)             UI/UXテスト
  security (sec)             セキュリティテスト
  integration                統合テスト

使用例:
  # 全モジュールをハイブリッドモードで実行
  node run-integration-test-suite.ts

  # 認証とチャットボットのみを並列実行
  node run-integration-test-suite.ts --mode=parallel --modules=auth,chatbot

  # HTMLレポートのみ生成
  node run-integration-test-suite.ts --format=html

  # 詳細ログ付きで実行
  node run-integration-test-suite.ts --verbose

  # 失敗時に即座停止
  node run-integration-test-suite.ts --stop-on-failure
`);
}

/**
 * 未処理例外のハンドリング
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外:', error);
  process.exit(1);
});

// Ctrl+Cでの中断処理
process.on('SIGINT', () => {
  console.log('\n🛑 テスト実行が中断されました');
  process.exit(130);
});

// メイン関数の実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
}

export { main };