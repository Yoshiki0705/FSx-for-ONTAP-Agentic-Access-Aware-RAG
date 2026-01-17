#!/usr/bin/env node
/**
 * Chatbot UI AI統合テストスイート - CLIエントリーポイント
 * 
 * コマンドライン実行用のメインエントリーポイント
 * 
 * 使用例:
 * npm run test:all                    # 全テスト実行
 * npm run test:ui                     # UIテストのみ
 * npm run test:ai                     # AIテストのみ
 * npm run test:rag                    # RAGテストのみ
 * npm run test:security               # セキュリティテストのみ
 * npm run test:nova                   # Nova統合テストのみ
 * npm run test:multiregion            # マルチリージョンテストのみ
 * npm run test:integration            # 統合テストのみ
 * npm run test:final                  # 最終検証テストのみ
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { MainTestRunner } from './main-test-runner';
import { TestConfigManager } from './config/test-config-manager';

/**
 * CLIヘルプメッセージ表示
 */
function showHelp(): void {
  console.log(`
🤖 Chatbot UI AI統合テストスイート

使用方法:
  npm run test:all                    # 全テスト実行
  npm run test:ui                     # UIテストのみ
  npm run test:ai                     # AIテストのみ
  npm run test:rag                    # RAGテストのみ
  npm run test:security               # セキュリティテストのみ
  npm run test:nova                   # Nova統合テストのみ
  npm run test:multiregion            # マルチリージョンテストのみ
  npm run test:integration            # 統合テストのみ
  npm run test:final                  # 最終検証テストのみ

オプション:
  --help, -h                          # このヘルプを表示
  --config <path>                     # 設定ファイルパスを指定
  --output <path>                     # 結果出力ファイルパスを指定
  --html <path>                       # HTMLレポート出力パスを指定
  --environment <env>                 # 実行環境を指定 (dev/staging/prod)
  --region <region>                   # AWSリージョンを指定
  --profile <profile>                 # AWSプロファイルを指定
  --verbose, -v                       # 詳細ログを表示
  --quiet, -q                         # 最小限のログのみ表示

例:
  npm run test:all -- --environment prod --region ap-northeast-1
  npm run test:ai -- --output ./results.json --html ./report.html
  npm run test:security -- --verbose
  `);
}

/**
 * コマンドライン引数解析
 */
function parseArguments(): {
  command: string;
  options: Record<string, any>;
} {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const options: Record<string, any> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++; // 次の引数をスキップ
      } else {
        options[key] = true;
      }
    }
  }

  return { command, options };
}

/**
 * 環境変数設定
 */
function setupEnvironment(options: Record<string, any>): void {
  if (options.environment) {
    process.env.NODE_ENV = options.environment;
  }
  
  if (options.region) {
    process.env.AWS_REGION = options.region;
  }
  
  if (options.profile) {
    process.env.AWS_PROFILE = options.profile;
  }

  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  } else if (options.quiet) {
    process.env.LOG_LEVEL = 'error';
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const { command, options } = parseArguments();

  // ヘルプ表示
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // 環境設定
  setupEnvironment(options);

  // 設定ファイル読み込み
  if (options.config) {
    TestConfigManager.loadConfiguration(options.config);
  }

  console.log('🚀 Chatbot UI AI統合テストスイート');
  console.log(`📅 実行日時: ${new Date().toISOString()}`);
  console.log(`🔧 コマンド: ${command}`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌏 リージョン: ${process.env.AWS_REGION || 'ap-northeast-1'}`);
  console.log(`👤 プロファイル: ${process.env.AWS_PROFILE || 'default'}`);
  console.log('');

  try {
    const runner = new MainTestRunner();
    let summary;

    // コマンド別実行
    switch (command) {
      case 'all':
        summary = await runner.runAllTests();
        break;
      case 'ui':
        summary = await runner.runCategoryTests('ui');
        break;
      case 'ai':
        summary = await runner.runCategoryTests('ai');
        break;
      case 'rag':
        summary = await runner.runCategoryTests('rag');
        break;
      case 'security':
        summary = await runner.runCategoryTests('security');
        break;
      case 'nova':
        summary = await runner.runCategoryTests('nova');
        break;
      case 'multiregion':
        summary = await runner.runCategoryTests('multiregion');
        break;
      case 'integration':
        summary = await runner.runCategoryTests('integration');
        break;
      case 'final':
      case 'validation':
        summary = await runner.runCategoryTests('final');
        break;
      default:
        console.error(`❌ 未知のコマンド: ${command}`);
        showHelp();
        process.exit(1);
    }

    // 結果出力
    if (options.output) {
      await runner.saveTestResults(options.output);
    }

    if (options.html) {
      await runner.generateHTMLReport(options.html);
    }

    // 終了コード設定
    const exitCode = summary.status === 'passed' ? 0 : 1;
    
    if (exitCode === 0) {
      console.log('🎉 テストスイートが正常に完了しました！');
    } else {
      console.log('⚠️  テストスイートで失敗が発生しました。');
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('❌ テストスイート実行中に予期しないエラーが発生しました:');
    console.error(error);
    
    if (options.verbose) {
      console.error('スタックトレース:');
      console.error((error as Error).stack);
    }
    
    process.exit(1);
  }
}

/**
 * 未処理の例外・拒否をキャッチ
 */
process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外が発生しました:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否が発生しました:', reason);
  process.exit(1);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n🛑 テストスイートが中断されました');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 テストスイートが終了されました');
  process.exit(143);
});

// メイン実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ メイン実行でエラーが発生しました:', error);
    process.exit(1);
  });
}

export { main };