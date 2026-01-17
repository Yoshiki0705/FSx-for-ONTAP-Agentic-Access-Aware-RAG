#!/usr/bin/env ts-node

/**
 * セキュリティテスト実行スクリプト
 * 
 * 実本番環境でのセキュリティテストを実行
 * HTTPS暗号化、攻撃耐性、セキュリティ監視のテストを包括的に実行
 * 
 * 使用例:
 * npm run test:production:security
 * ts-node run-security-tests.ts --env production
 * ts-node run-security-tests.ts --env staging --verbose
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { Command } from 'commander';
import { ProductionConfig, getProductionConfig } from '../../config/production-config';
import ProductionTestEngine from '../../core/production-test-engine';
import SecurityTestRunner from './security-test-runner';
import { getSecurityConfig, validateSecurityConfig } from './security-config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * コマンドライン引数の解析
 */
function parseArguments() {
  const program = new Command();
  
  program
    .name('run-security-tests')
    .description('実本番環境でのセキュリティテスト実行')
    .version('1.0.0')
    .option('-e, --env <environment>', '実行環境 (production, staging, development)', 'production')
    .option('-r, --report <path>', 'レポート出力パス', './security-test-report.md')
    .option('-j, --json <path>', 'JSON結果出力パス', './security-test-results.json')
    .option('-v, --verbose', '詳細ログ出力', false)
    .option('--dry-run', 'ドライラン実行（実際のテストは行わない）', false)
    .option('--https-only', 'HTTPS暗号化テストのみ実行', false)
    .option('--attack-only', '攻撃耐性テストのみ実行', false)
    .option('--monitoring-only', 'セキュリティ監視テストのみ実行', false)
    .option('--skip-dangerous', '危険な攻撃テストをスキップ', false)
    .option('--timeout <seconds>', 'テストタイムアウト (秒)', '')
    .option('--no-emergency-stop', '緊急停止機能を無効化', false)
    .parse();

  return program.opts();
}

/**
 * セキュリティテストレポートの生成
 */
async function generateSecurityReport(
  results: any,
  outputPath: string,
  config: ProductionConfig
): Promise<void> {
  const timestamp = new Date().toISOString();
  const summary = results.summary;
  
  const reportContent = `# セキュリティテストレポート

## 実行情報
- **実行日時**: ${timestamp}
- **環境**: ${config.environment}
- **対象システム**: ${config.region} リージョン
- **テスト実行者**: 自動テストシステム

## 実行サマリー
- **総テスト数**: ${summary.totalTests}
- **成功**: ${summary.passedTests}
- **失敗**: ${summary.failedTests}
- **スキップ**: ${summary.skippedTests}
- **総合セキュリティスコア**: ${(summary.overallSecurityScore * 100).toFixed(1)}%
- **重要な問題**: ${summary.criticalIssues}件

## セキュリティ評価

### 総合評価
${summary.overallSecurityScore >= 0.8 
  ? '✅ **優秀** - 高いセキュリティレベルが確保されています'
  : summary.overallSecurityScore >= 0.6
  ? '⚠️ **良好** - セキュリティレベルは良好ですが、改善の余地があります'
  : '❌ **要改善** - 重要なセキュリティ問題があります。緊急の対応が必要です'
}

### 詳細結果

${Array.from(results.results.entries()).map(([testName, result]: [string, any]) => `
#### ${result.testName}
- **ステータス**: ${result.success ? '✅ 成功' : '❌ 失敗'}
- **実行時間**: ${result.duration}ms
- **セキュリティスコア**: ${(result.securityMetrics.securityScore * 100).toFixed(1)}%

**セキュリティメトリクス**:
- HTTPS準拠: ${result.securityMetrics.httpsCompliance ? '✓' : '✗'}
- 証明書有効: ${result.securityMetrics.certificateValid ? '✓' : '✗'}
- セキュリティヘッダー: ${result.securityMetrics.securityHeadersPresent ? '✓' : '✗'}
- WAF保護: ${result.securityMetrics.wafProtectionActive ? '✓' : '✗'}
- ブロック攻撃数: ${result.securityMetrics.attacksBlocked}
- 脆弱性発見数: ${result.securityMetrics.vulnerabilitiesFound}

${result.errors && result.errors.length > 0 ? `
**エラー**:
${result.errors.map((error: string) => `- ${error}`).join('\n')}
` : ''}
`).join('\n')}

## 推奨事項

${summary.recommendations.map((rec: string, index: number) => `${index + 1}. ${rec}`).join('\n')}

## セキュリティ強化ガイドライン

### 即座対応が必要な項目
${summary.criticalIssues > 0 ? `
- 🚨 ${summary.criticalIssues}件の重要なセキュリティ問題が発見されました
- 詳細な調査と修正を緊急で実施してください
- セキュリティチームへの報告を推奨します
` : '- 現在、緊急対応が必要な問題はありません'}

### 継続的改善項目
- 定期的なセキュリティ監査の実施
- セキュリティパッチの適用
- セキュリティ設定の見直し
- インシデント対応計画の更新

### 監視・運用
- セキュリティログの継続監視
- 異常検出アラートの設定確認
- セキュリティメトリクスの定期レビュー

---
*このレポートは自動生成されました。詳細な分析が必要な場合は、セキュリティチームにご相談ください。*
`;

  await fs.promises.writeFile(outputPath, reportContent);
  console.log(`📄 セキュリティテストレポート生成: ${outputPath}`);
}

/**
 * メイン実行関数
 */
async function main() {
  const options = parseArguments();
  
  console.log('🔒 セキュリティテスト実行開始');
  console.log(`   環境: ${options.env}`);
  console.log(`   詳細ログ: ${options.verbose ? 'はい' : 'いいえ'}`);
  console.log(`   ドライラン: ${options.dryRun ? 'はい' : 'いいえ'}`);
  console.log('');

  try {
    // 設定の読み込み
    const config = getProductionConfig(options.env);
    const securityConfig = getSecurityConfig(options.env);
    
    // セキュリティ設定の検証
    const validation = validateSecurityConfig(securityConfig);
    if (!validation.isValid) {
      console.error('❌ セキュリティ設定エラー:', validation.errors.join(', '));
      process.exit(1);
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ セキュリティ設定警告:', validation.warnings.join(', '));
    }

    // ドライラン実行
    if (options.dryRun) {
      console.log('🔍 ドライラン実行 - 設定確認のみ');
      console.log('✅ セキュリティ設定は有効です');
      console.log(`📋 実行予定テスト: ${securityConfig.general.executionOrder.join(', ')}`);
      return;
    }

    // テストエンジンの初期化
    const testEngine = new ProductionTestEngine(config);
    await testEngine.initialize();

    // セキュリティテストランナーの初期化
    const securityRunner = new SecurityTestRunner(config, testEngine);
    await securityRunner.initialize();

    // 設定表示（詳細モード）
    if (options.verbose) {
      securityRunner.displaySecurityConfig();
    }

    // セキュリティテストの実行
    console.log('🚀 セキュリティテスト実行中...');
    const results = await securityRunner.runSecurityTests();

    // 結果の表示
    if (options.verbose) {
      securityRunner.displaySecuritySummary(results.results);
    }

    // 結果のエクスポート
    if (options.json) {
      await securityRunner.exportSecurityResults(results.results, options.json);
    }

    // レポートの生成
    if (options.report) {
      await generateSecurityReport(results, options.report, config);
    }

    // クリーンアップ
    await securityRunner.cleanup();
    await testEngine.cleanup();

    // 終了ステータスの決定
    if (results.success) {
      console.log('✅ セキュリティテスト実行成功');
      process.exit(0);
    } else {
      console.log('❌ セキュリティテスト実行失敗');
      if (results.errors) {
        console.error('エラー詳細:', results.errors.join(', '));
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ セキュリティテスト実行エラー:', error);
    
    if (options.verbose && error instanceof Error) {
      console.error('スタックトレース:', error.stack);
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

export { main as runSecurityTests };