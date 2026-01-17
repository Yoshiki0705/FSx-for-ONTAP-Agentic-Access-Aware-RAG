/**
 * Chatbot UI AI統合テストスイート - メインテストランナー
 * 
 * 全てのテストカテゴリを統合実行するメインエントリーポイント
 * - UI機能テスト
 * - AI応答生成テスト
 * - RAG機能テスト
 * - セキュリティテスト
 * - Nova統合テスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { TestResult, TestConfiguration, TestSummary } from './types/test-types';
import { TestConfigManager } from './config/test-config-manager';

// UI テストランナー
import { ChatInterfaceTests } from './ui/chat-interface-tests';
import { ResponsiveDesignTests } from './ui/responsive-design-tests';

// AI テストランナー
import { BedrockIntegrationTests } from './ai/bedrock-integration-tests';
import { JapaneseResponseTests } from './ai/japanese-response-tests';
import { StreamingResponseTests } from './ai/streaming-response-tests';
import { NovaModelTests } from './ai/nova-model-tests';
import { NovaCreditOptimizationTests } from './ai/nova-credit-optimization-tests';

// RAG テストランナー
import { VectorSearchTests } from './rag/vector-search-tests';
import { ContextIntegrationTests } from './rag/context-integration-tests';
import { NovaRagIntegrationTests } from './rag/nova-rag-integration-tests';

// セキュリティテストランナー
import { SIDAccessControlTests } from './security/sid-access-control-tests';
import { AuthSessionTests } from './security/auth-session-tests';

// スクリプトランナー
import { MultiRegionTestRunner } from './scripts/run-multi-region-tests';

// 統合テストランナー
import IntegrationTestRunner from './runners/integration-test-runner';
import AIIntegrationTestRunner from './runners/ai-integration-test-runner';
import SecurityTestRunner from './runners/security-test-runner';
import PerformanceTestRunner from './runners/performance-test-runner';
import FinalValidationRunner from './runners/final-validation-runner';

/**
 * メインテストランナークラス
 */
export class MainTestRunner {
  private config: TestConfiguration;
  private testResults: TestResult[] = [];
  private startTime: Date;
  private endTime?: Date;

  constructor() {
    this.config = TestConfigManager.getConfiguration();
    this.startTime = new Date();
  }

  /**
   * 全テストスイートを実行
   */
  async runAllTests(): Promise<TestSummary> {
    console.log('🚀 Chatbot UI AI統合テストスイート開始');
    console.log(`📅 開始時刻: ${this.startTime.toISOString()}`);
    console.log(`🔧 設定: ${this.config.environment} 環境`);
    console.log('');

    try {
      // Phase 1: UI機能テスト
      await this.runUITests();

      // Phase 2: AI応答生成テスト
      await this.runAITests();

      // Phase 3: RAG機能テスト
      await this.runRAGTests();

      // Phase 4: セキュリティテスト
      await this.runSecurityTests();

      // Phase 5: Nova統合テスト
      await this.runNovaIntegrationTests();

      // Phase 6: マルチリージョンテスト
      await this.runMultiRegionTests();

      // Phase 7: 統合テスト実行
      await this.runIntegrationTests();

      // Phase 8: 最終検証テスト実行
      await this.runFinalValidation();

      this.endTime = new Date();
      const summary = this.generateTestSummary();
      
      console.log('');
      console.log('🎉 全テストスイート完了');
      this.printTestSummary(summary);
      
      return summary;

    } catch (error) {
      this.endTime = new Date();
      console.error('❌ テストスイート実行中にエラーが発生しました:', error);
      
      const summary = this.generateTestSummary();
      summary.status = 'failed';
      summary.error = error instanceof Error ? error.message : String(error);
      
      return summary;
    }
  }

  /**
   * UI機能テスト実行
   */
  private async runUITests(): Promise<void> {
    console.log('🎨 Phase 1: UI機能テスト開始');
    
    try {
      // チャットインターフェーステスト
      const chatInterfaceTests = new ChatInterfaceTests(this.config);
      const chatResults = await chatInterfaceTests.runAllTests();
      this.testResults.push(...chatResults);

      // レスポンシブデザインテスト
      const responsiveTests = new ResponsiveDesignTests(this.config);
      const responsiveResults = await responsiveTests.runAllTests();
      this.testResults.push(...responsiveResults);

      const uiPassed = [...chatResults, ...responsiveResults].filter(r => r.status === 'passed').length;
      const uiTotal = chatResults.length + responsiveResults.length;
      
      console.log(`✅ UI機能テスト完了: ${uiPassed}/${uiTotal} 成功`);
      console.log('');

    } catch (error) {
      console.error('❌ UI機能テストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * AI応答生成テスト実行
   */
  private async runAITests(): Promise<void> {
    console.log('🤖 Phase 2: AI応答生成テスト開始');
    
    try {
      // Bedrock統合テスト
      const bedrockTests = new BedrockIntegrationTests(this.config);
      const bedrockResults = await bedrockTests.runAllTests();
      this.testResults.push(...bedrockResults);

      // 日本語応答品質テスト
      const japaneseTests = new JapaneseResponseTests(this.config);
      const japaneseResults = await japaneseTests.runAllTests();
      this.testResults.push(...japaneseResults);

      // ストリーミング応答テスト
      const streamingTests = new StreamingResponseTests(this.config);
      const streamingResults = await streamingTests.runAllTests();
      this.testResults.push(...streamingResults);

      // Novaモデルテスト
      const novaModelTests = new NovaModelTests(this.config);
      const novaModelResults = await novaModelTests.runAllTests();
      this.testResults.push(...novaModelResults);

      // Novaクレジット最適化テスト
      const novaCreditTests = new NovaCreditOptimizationTests(this.config);
      const novaCreditResults = await novaCreditTests.runAllTests();
      this.testResults.push(...novaCreditResults);

      const aiResults = [...bedrockResults, ...japaneseResults, ...streamingResults, ...novaModelResults, ...novaCreditResults];
      const aiPassed = aiResults.filter(r => r.status === 'passed').length;
      const aiTotal = aiResults.length;
      
      console.log(`✅ AI応答生成テスト完了: ${aiPassed}/${aiTotal} 成功`);
      console.log('');

    } catch (error) {
      console.error('❌ AI応答生成テストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * RAG機能テスト実行
   */
  private async runRAGTests(): Promise<void> {
    console.log('🔍 Phase 3: RAG機能テスト開始');
    
    try {
      // ベクトル検索テスト
      const vectorTests = new VectorSearchTests(this.config);
      const vectorResults = await vectorTests.runAllTests();
      this.testResults.push(...vectorResults);

      // コンテキスト統合テスト
      const contextTests = new ContextIntegrationTests(this.config);
      const contextResults = await contextTests.runAllTests();
      this.testResults.push(...contextResults);

      // Nova RAG統合テスト
      const novaRagTests = new NovaRagIntegrationTests(this.config);
      const novaRagResults = await novaRagTests.runAllTests();
      this.testResults.push(...novaRagResults);

      const ragResults = [...vectorResults, ...contextResults, ...novaRagResults];
      const ragPassed = ragResults.filter(r => r.status === 'passed').length;
      const ragTotal = ragResults.length;
      
      console.log(`✅ RAG機能テスト完了: ${ragPassed}/${ragTotal} 成功`);
      console.log('');

    } catch (error) {
      console.error('❌ RAG機能テストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * セキュリティテスト実行
   */
  private async runSecurityTests(): Promise<void> {
    console.log('🔐 Phase 4: セキュリティテスト開始');
    
    try {
      // SIDベースアクセス制御テスト
      const sidTests = new SIDAccessControlTests(this.config);
      const sidResults = await sidTests.runAllTests();
      this.testResults.push(...sidResults);

      // 認証・セッション管理テスト
      const authTests = new AuthSessionTests(this.config);
      const authResults = await authTests.runAllTests();
      this.testResults.push(...authResults);

      const securityResults = [...sidResults, ...authResults];
      const securityPassed = securityResults.filter(r => r.status === 'passed').length;
      const securityTotal = securityResults.length;
      
      console.log(`✅ セキュリティテスト完了: ${securityPassed}/${securityTotal} 成功`);
      console.log('');

    } catch (error) {
      console.error('❌ セキュリティテストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * Nova統合テスト実行
   */
  private async runNovaIntegrationTests(): Promise<void> {
    console.log('⭐ Phase 5: Nova統合テスト開始');
    
    try {
      // Nova統合テストは既に個別のAI・RAGテストに含まれているため、
      // ここでは統合レポートの生成のみ実行
      const novaResults = this.testResults.filter(r => 
        r.testName.includes('Nova') || 
        r.category === 'Nova Integration'
      );

      const novaPassed = novaResults.filter(r => r.status === 'passed').length;
      const novaTotal = novaResults.length;
      
      console.log(`✅ Nova統合テスト完了: ${novaPassed}/${novaTotal} 成功`);
      console.log('');

    } catch (error) {
      console.error('❌ Nova統合テストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * マルチリージョンテスト実行
   */
  private async runMultiRegionTests(): Promise<void> {
    console.log('🌍 Phase 6: マルチリージョンテスト開始');
    
    try {
      const multiRegionRunner = new MultiRegionTestRunner();
      const multiRegionResults = await multiRegionRunner.runAllRegionTests();
      this.testResults.push(...multiRegionResults);

      const multiRegionPassed = multiRegionResults.filter(r => r.status === 'passed').length;
      const multiRegionTotal = multiRegionResults.length;
      
      console.log(`✅ マルチリージョンテスト完了: ${multiRegionPassed}/${multiRegionTotal} 成功`);
      console.log('');

    } catch (error) {
      console.error('❌ マルチリージョンテストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * 統合テスト実行
   */
  private async runIntegrationTests(): Promise<void> {
    console.log('🔄 Phase 7: 統合テスト開始');
    
    try {
      const integrationRunner = new IntegrationTestRunner(this.config);
      const integrationResults = await integrationRunner.runAllIntegrationTests();
      this.testResults.push(...integrationResults.results);

      const integrationPassed = integrationResults.results.filter(r => r.status === 'passed').length;
      const integrationTotal = integrationResults.results.length;
      
      console.log(`✅ 統合テスト完了: ${integrationPassed}/${integrationTotal} 成功`);
      console.log(`🎯 統合スコア: ${integrationResults.summary.integrationScore.toFixed(1)}%`);
      console.log('');

    } catch (error) {
      console.error('❌ 統合テストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * 最終検証テスト実行
   */
  private async runFinalValidation(): Promise<void> {
    console.log('🎯 Phase 8: 最終検証テスト開始');
    
    try {
      const finalValidationRunner = new FinalValidationRunner(this.config);
      const validationResults = await finalValidationRunner.runFinalValidation();
      this.testResults.push(...validationResults.results);

      const validationPassed = validationResults.results.filter(r => r.status === 'passed').length;
      const validationTotal = validationResults.results.length;
      
      console.log(`✅ 最終検証テスト完了: ${validationPassed}/${validationTotal} 成功`);
      console.log(`🎯 最終スコア: ${validationResults.summary.finalScore.toFixed(1)}%`);
      console.log(`✅ システム承認: ${validationResults.approval.approved ? '承認' : '要改善'}`);
      console.log(`📋 承認レベル: ${validationResults.approval.approvalLevel}`);
      console.log('');

      // 承認結果の詳細表示
      if (validationResults.approval.approved) {
        console.log('🎉 システムは本番環境への展開準備が完了しました！');
      } else {
        console.log('⚠️  システムの改善が必要です。以下の条件を満たしてください:');
        validationResults.approval.conditions.forEach(condition => {
          console.log(`   • ${condition}`);
        });
      }

      console.log('\n📋 次のステップ:');
      validationResults.approval.nextSteps.forEach(step => {
        console.log(`   • ${step}`);
      });
      console.log('');

    } catch (error) {
      console.error('❌ 最終検証テストでエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * 特定カテゴリのテストのみ実行
   */
  async runCategoryTests(category: string): Promise<TestSummary> {
    console.log(`🎯 ${category}テスト開始`);
    this.startTime = new Date();

    try {
      switch (category.toLowerCase()) {
        case 'ui':
          await this.runUITests();
          break;
        case 'ai':
          await this.runAITests();
          break;
        case 'rag':
          await this.runRAGTests();
          break;
        case 'security':
          await this.runSecurityTests();
          break;
        case 'nova':
          await this.runNovaIntegrationTests();
          break;
        case 'multiregion':
          await this.runMultiRegionTests();
          break;
        case 'integration':
          await this.runIntegrationTests();
          break;
        case 'final':
        case 'validation':
          await this.runFinalValidation();
          break;
        default:
          throw new Error(`未知のテストカテゴリ: ${category}`);
      }

      this.endTime = new Date();
      const summary = this.generateTestSummary();
      
      console.log('');
      console.log(`🎉 ${category}テスト完了`);
      this.printTestSummary(summary);
      
      return summary;

    } catch (error) {
      this.endTime = new Date();
      console.error(`❌ ${category}テスト実行中にエラーが発生しました:`, error);
      
      const summary = this.generateTestSummary();
      summary.status = 'failed';
      summary.error = error instanceof Error ? error.message : String(error);
      
      return summary;
    }
  }

  /**
   * テストサマリー生成
   */
  private generateTestSummary(): TestSummary {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = this.testResults.filter(r => r.status === 'failed').length;
    const skippedTests = this.testResults.filter(r => r.status === 'skipped').length;

    const duration = this.endTime 
      ? this.endTime.getTime() - this.startTime.getTime()
      : Date.now() - this.startTime.getTime();

    // カテゴリ別統計
    const categoryStats = this.generateCategoryStats();

    // 優先度別統計
    const priorityStats = this.generatePriorityStats();

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      duration,
      startTime: this.startTime,
      endTime: this.endTime || new Date(),
      status: failedTests === 0 ? 'passed' : 'failed',
      categoryStats,
      priorityStats,
      testResults: this.testResults
    };
  }

  /**
   * カテゴリ別統計生成
   */
  private generateCategoryStats(): Record<string, { total: number; passed: number; failed: number; skipped: number }> {
    const categories = [
      'UI', 'AI', 'RAG', 'Security', 'Nova Integration', 'Multi-Region',
      'Performance', 'Scalability', 'Integration E2E', 'Requirements Validation',
      'Quality Standards', 'Production Readiness'
    ];
    const stats: Record<string, { total: number; passed: number; failed: number; skipped: number }> = {};

    for (const category of categories) {
      const categoryResults = this.testResults.filter(r => r.category === category);
      stats[category] = {
        total: categoryResults.length,
        passed: categoryResults.filter(r => r.status === 'passed').length,
        failed: categoryResults.filter(r => r.status === 'failed').length,
        skipped: categoryResults.filter(r => r.status === 'skipped').length
      };
    }

    return stats;
  }

  /**
   * 優先度別統計生成
   */
  private generatePriorityStats(): Record<string, { total: number; passed: number; failed: number }> {
    const priorities = ['critical', 'high', 'medium', 'low'];
    const stats: Record<string, { total: number; passed: number; failed: number }> = {};

    for (const priority of priorities) {
      const priorityResults = this.testResults.filter(r => r.priority === priority);
      stats[priority] = {
        total: priorityResults.length,
        passed: priorityResults.filter(r => r.status === 'passed').length,
        failed: priorityResults.filter(r => r.status === 'failed').length
      };
    }

    return stats;
  }

  /**
   * テストサマリー表示
   */
  private printTestSummary(summary: TestSummary): void {
    console.log('📊 テスト実行サマリー');
    console.log('='.repeat(50));
    console.log(`📈 総テスト数: ${summary.totalTests}`);
    console.log(`✅ 成功: ${summary.passedTests}`);
    console.log(`❌ 失敗: ${summary.failedTests}`);
    console.log(`⏭️  スキップ: ${summary.skippedTests}`);
    console.log(`📊 成功率: ${summary.successRate.toFixed(1)}%`);
    console.log(`⏱️  実行時間: ${(summary.duration / 1000).toFixed(1)}秒`);
    console.log(`🕐 開始時刻: ${summary.startTime.toISOString()}`);
    console.log(`🕐 終了時刻: ${summary.endTime.toISOString()}`);
    console.log('');

    // カテゴリ別統計表示
    console.log('📋 カテゴリ別統計');
    console.log('-'.repeat(30));
    for (const [category, stats] of Object.entries(summary.categoryStats)) {
      if (stats.total > 0) {
        const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
        console.log(`${category}: ${stats.passed}/${stats.total} (${successRate}%)`);
      }
    }
    console.log('');

    // 優先度別統計表示
    console.log('🎯 優先度別統計');
    console.log('-'.repeat(30));
    for (const [priority, stats] of Object.entries(summary.priorityStats)) {
      if (stats.total > 0) {
        const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
        console.log(`${priority.toUpperCase()}: ${stats.passed}/${stats.total} (${successRate}%)`);
      }
    }
    console.log('');

    // 失敗したテストの詳細表示
    const failedTests = this.testResults.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      console.log('❌ 失敗したテスト');
      console.log('-'.repeat(30));
      for (const test of failedTests) {
        console.log(`• ${test.testName} (${test.category})`);
        if (test.error) {
          console.log(`  エラー: ${test.error}`);
        }
      }
      console.log('');
    }

    // 全体ステータス表示
    if (summary.status === 'passed') {
      console.log('🎉 全テストが正常に完了しました！');
    } else {
      console.log('⚠️  一部のテストが失敗しました。詳細を確認してください。');
    }
  }

  /**
   * テスト結果をJSONファイルに出力
   */
  async saveTestResults(filePath: string): Promise<void> {
    const summary = this.generateTestSummary();
    const fs = await import('fs/promises');
    
    try {
      await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
      console.log(`📄 テスト結果を保存しました: ${filePath}`);
    } catch (error) {
      console.error('❌ テスト結果の保存に失敗しました:', error);
    }
  }

  /**
   * テスト結果をHTMLレポートとして出力
   */
  async generateHTMLReport(filePath: string): Promise<void> {
    const summary = this.generateTestSummary();
    const htmlContent = this.generateHTMLContent(summary);
    const fs = await import('fs/promises');
    
    try {
      await fs.writeFile(filePath, htmlContent, 'utf-8');
      console.log(`📄 HTMLレポートを生成しました: ${filePath}`);
    } catch (error) {
      console.error('❌ HTMLレポートの生成に失敗しました:', error);
    }
  }

  /**
   * HTMLレポート内容生成
   */
  private generateHTMLContent(summary: TestSummary): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chatbot UI AI統合テストレポート</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #6c757d; margin-top: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .category-stats, .priority-stats { margin-bottom: 30px; }
        .test-list { margin-top: 20px; }
        .test-item { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .test-passed { background-color: #d4edda; border-left: 4px solid #28a745; }
        .test-failed { background-color: #f8d7da; border-left: 4px solid #dc3545; }
        .test-skipped { background-color: #fff3cd; border-left: 4px solid #ffc107; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Chatbot UI AI統合テストレポート</h1>
            <p>実行日時: ${summary.startTime.toLocaleString('ja-JP')} - ${summary.endTime.toLocaleString('ja-JP')}</p>
            <p>実行時間: ${(summary.duration / 1000).toFixed(1)}秒</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${summary.totalTests}</div>
                <div class="stat-label">総テスト数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value success">${summary.passedTests}</div>
                <div class="stat-label">成功</div>
            </div>
            <div class="stat-card">
                <div class="stat-value failure">${summary.failedTests}</div>
                <div class="stat-label">失敗</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.successRate.toFixed(1)}%</div>
                <div class="stat-label">成功率</div>
            </div>
        </div>

        <div class="category-stats">
            <h2>📋 カテゴリ別統計</h2>
            <table>
                <thead>
                    <tr>
                        <th>カテゴリ</th>
                        <th>総数</th>
                        <th>成功</th>
                        <th>失敗</th>
                        <th>成功率</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(summary.categoryStats)
                      .filter(([_, stats]) => stats.total > 0)
                      .map(([category, stats]) => `
                        <tr>
                            <td>${category}</td>
                            <td>${stats.total}</td>
                            <td class="success">${stats.passed}</td>
                            <td class="failure">${stats.failed}</td>
                            <td>${((stats.passed / stats.total) * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="priority-stats">
            <h2>🎯 優先度別統計</h2>
            <table>
                <thead>
                    <tr>
                        <th>優先度</th>
                        <th>総数</th>
                        <th>成功</th>
                        <th>失敗</th>
                        <th>成功率</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(summary.priorityStats)
                      .filter(([_, stats]) => stats.total > 0)
                      .map(([priority, stats]) => `
                        <tr>
                            <td>${priority.toUpperCase()}</td>
                            <td>${stats.total}</td>
                            <td class="success">${stats.passed}</td>
                            <td class="failure">${stats.failed}</td>
                            <td>${((stats.passed / stats.total) * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="test-list">
            <h2>📝 テスト結果詳細</h2>
            ${summary.testResults.map(test => `
                <div class="test-item test-${test.status}">
                    <strong>${test.testName}</strong> (${test.category})
                    <span style="float: right;">${test.duration}ms</span>
                    ${test.error ? `<br><small>エラー: ${test.error}</small>` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
  }
}

export default MainTestRunner;