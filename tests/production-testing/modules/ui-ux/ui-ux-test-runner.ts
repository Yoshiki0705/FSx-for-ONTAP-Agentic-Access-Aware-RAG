/**
 * UI/UXテスト実行ランナー
 * 
 * Kiro MCP Chrome DevToolsを使用した実ブラウザでのUI/UXテストを安全に実行
 * テスト結果の収集と報告を行う
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import UIUXTestModule, { UIUXTestResult } from './ui-ux-test-module';
import ProductionTestEngine, { TestDefinition, TestSuite } from '../../core/production-test-engine';
import { ProductionConfig } from '../../config/production-config';

/**
 * UI/UXテスト実行ランナークラス
 */
export class UIUXTestRunner {
  private config: ProductionConfig;
  private testModule: UIUXTestModule;
  private testEngine: ProductionTestEngine;

  constructor(config: ProductionConfig, testEngine: ProductionTestEngine) {
    this.config = config;
    this.testEngine = testEngine;
    this.testModule = new UIUXTestModule(config);
  }

  /**
   * UI/UXテストスイートの作成
   */
  createUIUXTestSuite(): TestSuite {
    const testDefinitions: TestDefinition[] = [
      {
        testId: 'ui-responsive-001',
        testName: 'レスポンシブデザインテスト',
        category: 'ui-ux',
        description: 'モバイル、タブレット、デスクトップでの表示とレイアウトの適応性テスト',
        timeout: 180000, // 3分
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testResponsiveDesign();
        }
      },
      {
        testId: 'ui-chat-001',
        testName: 'チャットインターフェーステスト',
        category: 'ui-ux',
        description: 'チャット機能のユーザビリティと操作性の評価',
        timeout: 240000, // 4分
        retryCount: 2,
        dependencies: ['ui-responsive-001'],
        execute: async (engine) => {
          return await this.testModule.testChatInterface();
        }
      },
      {
        testId: 'ui-accessibility-001',
        testName: 'アクセシビリティテスト',
        category: 'ui-ux',
        description: 'WCAG 2.1 AA準拠とアクセシビリティ機能の包括的評価',
        timeout: 300000, // 5分
        retryCount: 1,
        dependencies: ['ui-responsive-001'],
        execute: async (engine) => {
          return await this.testModule.testAccessibility();
        }
      },
      {
        testId: 'ui-usability-001',
        testName: 'ユーザビリティテスト',
        category: 'ui-ux',
        description: 'ユーザーエクスペリエンスと操作効率の総合評価',
        timeout: 360000, // 6分
        retryCount: 1,
        dependencies: ['ui-chat-001'],
        execute: async (engine) => {
          return await this.testModule.testUsability();
        }
      }
    ];

    return {
      suiteId: 'ui-ux-test-suite',
      suiteName: 'UI/UXテストスイート',
      description: '実本番環境でのユーザーインターフェースとユーザーエクスペリエンスの包括評価',
      tests: testDefinitions,
      configuration: {
        parallel: false, // UI/UXテストは順次実行
        maxConcurrency: 1,
        failFast: false, // 一つのテストが失敗しても他のテストを継続
        continueOnError: true
      }
    };
  }

  /**
   * UI/UXテストの実行
   */
  async runUIUXTests(): Promise<{
    success: boolean;
    results: Map<string, UIUXTestResult>;
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      skippedTests: number;
      successRate: number;
      totalDuration: number;
      overallUIUXScore: number;
      averagePageLoadTime: number;
      wcagComplianceRate: number;
      responsiveCompatibility: number;
      usabilityScore: number;
    };
  }> {
    console.log('🚀 UI/UXテストスイートを実行開始...');

    try {
      // テストスイートの作成
      const testSuite = this.createUIUXTestSuite();

      // テストエンジンでの実行
      const results = await this.testEngine.executeTestSuite(testSuite);

      // 結果の集計
      const summary = this.generateTestSummary(results);

      console.log('📊 UI/UXテスト実行結果:');
      console.log(`   総テスト数: ${summary.totalTests}`);
      console.log(`   成功: ${summary.passedTests}`);
      console.log(`   失敗: ${summary.failedTests}`);
      console.log(`   スキップ: ${summary.skippedTests}`);
      console.log(`   成功率: ${(summary.successRate * 100).toFixed(1)}%`);
      console.log(`   総合UI/UXスコア: ${(summary.overallUIUXScore * 100).toFixed(1)}%`);
      console.log(`   平均ページ読み込み時間: ${summary.averagePageLoadTime.toFixed(0)}ms`);
      console.log(`   WCAG準拠率: ${(summary.wcagComplianceRate * 100).toFixed(1)}%`);
      console.log(`   レスポンシブ互換性: ${(summary.responsiveCompatibility * 100).toFixed(1)}%`);
      console.log(`   ユーザビリティスコア: ${(summary.usabilityScore * 100).toFixed(1)}%`);
      console.log(`   総実行時間: ${summary.totalDuration}ms`);

      const success = summary.failedTests === 0;

      if (success) {
        console.log('✅ UI/UXテストスイート実行完了 - 全テスト成功');
      } else {
        console.log('⚠️ UI/UXテストスイート実行完了 - 一部テスト失敗');
      }

      return {
        success,
        results: results as Map<string, UIUXTestResult>,
        summary
      };

    } catch (error) {
      console.error('❌ UI/UXテスト実行エラー:', error);
      throw error;
    }
  }

  /**
   * テスト結果サマリーの生成
   */
  private generateTestSummary(results: Map<string, any>): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    successRate: number;
    totalDuration: number;
    overallUIUXScore: number;
    averagePageLoadTime: number;
    wcagComplianceRate: number;
    responsiveCompatibility: number;
    usabilityScore: number;
  } {
    const resultsArray = Array.from(results.values());
    
    const totalTests = resultsArray.length;
    const passedTests = resultsArray.filter(r => r.success).length;
    const failedTests = resultsArray.filter(r => !r.success && r.status !== 'SKIPPED').length;
    const skippedTests = resultsArray.filter(r => r.status === 'SKIPPED').length;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;
    const totalDuration = resultsArray.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    // UI/UX指標の計算
    const uiResults = resultsArray.filter(r => r.uiMetrics || r.responsiveMetrics || r.accessibilityMetrics || r.usabilityMetrics);
    
    const averagePageLoadTime = this.calculateAveragePageLoadTime(uiResults);
    const wcagComplianceRate = this.calculateWCAGComplianceRate(uiResults);
    const responsiveCompatibility = this.calculateResponsiveCompatibility(uiResults);
    const usabilityScore = this.calculateUsabilityScore(uiResults);
    
    // 総合UI/UXスコアの計算
    const overallUIUXScore = this.calculateOverallUIUXScore(resultsArray);

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate,
      totalDuration,
      overallUIUXScore,
      averagePageLoadTime,
      wcagComplianceRate,
      responsiveCompatibility,
      usabilityScore
    };
  }

  /**
   * 平均ページ読み込み時間の計算
   */
  private calculateAveragePageLoadTime(results: any[]): number {
    const loadTimes = results
      .filter(r => r.uiMetrics && r.uiMetrics.pageLoadTime)
      .map(r => r.uiMetrics.pageLoadTime);
    
    return loadTimes.length > 0
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length
      : 0;
  }

  /**
   * WCAG準拠率の計算
   */
  private calculateWCAGComplianceRate(results: any[]): number {
    const wcagScores = results
      .filter(r => r.accessibilityMetrics && r.accessibilityMetrics.wcagAACompliance)
      .map(r => r.accessibilityMetrics.wcagAACompliance);
    
    return wcagScores.length > 0
      ? wcagScores.reduce((sum, score) => sum + score, 0) / wcagScores.length
      : 0;
  }

  /**
   * レスポンシブ互換性の計算
   */
  private calculateResponsiveCompatibility(results: any[]): number {
    const responsiveResults = results.filter(r => r.responsiveMetrics);
    
    if (responsiveResults.length === 0) return 0;
    
    let totalScore = 0;
    let scoreCount = 0;
    
    responsiveResults.forEach(result => {
      const metrics = result.responsiveMetrics;
      ['mobileViewport', 'tabletViewport', 'desktopViewport'].forEach(viewport => {
        if (metrics[viewport]) {
          const viewportMetrics = metrics[viewport];
          const score = [
            viewportMetrics.layoutStability,
            viewportMetrics.contentVisibility,
            viewportMetrics.navigationUsability,
            viewportMetrics.textReadability,
            viewportMetrics.buttonAccessibility
          ].filter(Boolean).length / 5;
          
          totalScore += score;
          scoreCount++;
        }
      });
    });
    
    return scoreCount > 0 ? totalScore / scoreCount : 0;
  }

  /**
   * ユーザビリティスコアの計算
   */
  private calculateUsabilityScore(results: any[]): number {
    const usabilityResults = results.filter(r => r.usabilityMetrics);
    
    if (usabilityResults.length === 0) return 0;
    
    let totalScore = 0;
    let scoreCount = 0;
    
    usabilityResults.forEach(result => {
      const metrics = result.usabilityMetrics;
      const score = (
        metrics.navigationEfficiency +
        metrics.formUsability +
        metrics.errorHandling +
        metrics.userFlowCompletion
      ) / 4;
      
      totalScore += score;
      scoreCount++;
    });
    
    return scoreCount > 0 ? totalScore / scoreCount : 0;
  }

  /**
   * 総合UI/UXスコアの計算
   */
  private calculateOverallUIUXScore(results: any[]): number {
    const weights = {
      'ui-responsive-001': 0.25,      // レスポンシブデザイン
      'ui-chat-001': 0.25,            // チャットインターフェース
      'ui-accessibility-001': 0.25,   // アクセシビリティ
      'ui-usability-001': 0.25        // ユーザビリティ
    };

    let totalScore = 0;
    let totalWeight = 0;

    results.forEach(result => {
      const weight = weights[result.testId as keyof typeof weights] || 0.1;
      totalWeight += weight;
      
      if (result.success) {
        let testScore = 1.0;
        
        // パフォーマンススコア
        if (result.uiMetrics) {
          const performanceScore = this.calculatePerformanceScore(result.uiMetrics);
          testScore *= performanceScore;
        }
        
        // アクセシビリティスコア
        if (result.accessibilityMetrics) {
          const accessibilityScore = this.calculateAccessibilityScore(result.accessibilityMetrics);
          testScore *= accessibilityScore;
        }
        
        // ユーザビリティスコア
        if (result.usabilityMetrics) {
          const usabilityScore = this.calculateUsabilityTestScore(result.usabilityMetrics);
          testScore *= usabilityScore;
        }
        
        totalScore += testScore * weight;
      }
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * パフォーマンススコアの計算
   */
  private calculatePerformanceScore(uiMetrics: any): number {
    // Core Web Vitals に基づくスコア計算
    const lcpScore = Math.max(0, 1 - (uiMetrics.largestContentfulPaint - 2500) / 2500); // 2.5秒以内で満点
    const fidScore = Math.max(0, 1 - (uiMetrics.firstInputDelay - 100) / 100); // 100ms以内で満点
    const clsScore = Math.max(0, 1 - uiMetrics.cumulativeLayoutShift / 0.1); // 0.1以下で満点
    
    return (lcpScore + fidScore + clsScore) / 3;
  }

  /**
   * アクセシビリティスコアの計算
   */
  private calculateAccessibilityScore(accessibilityMetrics: any): number {
    const wcagScore = accessibilityMetrics.wcagAACompliance;
    const contrastScore = Math.min(1, (accessibilityMetrics.colorContrastRatio - 4.5) / 2.5); // 4.5:1以上で満点
    const keyboardScore = accessibilityMetrics.keyboardNavigation ? 1 : 0;
    const screenReaderScore = accessibilityMetrics.screenReaderCompatibility ? 1 : 0;
    const altTextScore = accessibilityMetrics.altTextCoverage;
    
    return (wcagScore + contrastScore + keyboardScore + screenReaderScore + altTextScore) / 5;
  }

  /**
   * ユーザビリティテストスコアの計算
   */
  private calculateUsabilityTestScore(usabilityMetrics: any): number {
    return (
      usabilityMetrics.navigationEfficiency +
      usabilityMetrics.formUsability +
      usabilityMetrics.errorHandling +
      usabilityMetrics.userFlowCompletion
    ) / 4;
  }

  /**
   * 詳細レポートの生成
   */
  async generateDetailedReport(results: Map<string, UIUXTestResult>): Promise<string> {
    const timestamp = new Date().toISOString();
    const summary = this.generateTestSummary(results);

    let report = `# UI/UXテスト詳細レポート\n\n`;
    report += `**実行日時**: ${timestamp}\n`;
    report += `**テスト環境**: AWS東京リージョン本番環境 (${this.config.region})\n`;
    report += `**システム**: Permission-aware RAG System with FSx for NetApp ONTAP\n`;
    report += `**テスト対象**: CloudFront UI, チャットインターフェース, レスポンシブデザイン\n\n`;

    report += `## UI/UXテスト実行サマリー\n\n`;
    report += `- **総テスト数**: ${summary.totalTests}\n`;
    report += `- **成功**: ${summary.passedTests}\n`;
    report += `- **失敗**: ${summary.failedTests}\n`;
    report += `- **スキップ**: ${summary.skippedTests}\n`;
    report += `- **成功率**: ${(summary.successRate * 100).toFixed(1)}%\n`;
    report += `- **総合UI/UXスコア**: ${(summary.overallUIUXScore * 100).toFixed(1)}%\n`;
    report += `- **平均ページ読み込み時間**: ${summary.averagePageLoadTime.toFixed(0)}ms\n`;
    report += `- **WCAG準拠率**: ${(summary.wcagComplianceRate * 100).toFixed(1)}%\n`;
    report += `- **レスポンシブ互換性**: ${(summary.responsiveCompatibility * 100).toFixed(1)}%\n`;
    report += `- **ユーザビリティスコア**: ${(summary.usabilityScore * 100).toFixed(1)}%\n`;
    report += `- **総実行時間**: ${summary.totalDuration}ms\n\n`;

    // UI/UX評価
    report += `## UI/UX評価\n\n`;
    if (summary.overallUIUXScore >= 0.9) {
      report += `🟢 **優秀**: UI/UXが非常に高品質です\n`;
    } else if (summary.overallUIUXScore >= 0.7) {
      report += `🟡 **良好**: UI/UXに軽微な改善点があります\n`;
    } else {
      report += `🔴 **要改善**: UI/UXの大幅な改善が必要です\n`;
    }

    if (summary.averagePageLoadTime <= 2000) {
      report += `🟢 **パフォーマンス**: 優秀 (2秒以内)\n`;
    } else if (summary.averagePageLoadTime <= 3000) {
      report += `🟡 **パフォーマンス**: 良好 (3秒以内)\n`;
    } else {
      report += `🔴 **パフォーマンス**: 要改善 (3秒超過)\n`;
    }

    if (summary.wcagComplianceRate >= 0.9) {
      report += `🟢 **アクセシビリティ**: 優秀 (WCAG AA 90%以上準拠)\n`;
    } else if (summary.wcagComplianceRate >= 0.7) {
      report += `🟡 **アクセシビリティ**: 良好 (WCAG AA 70%以上準拠)\n`;
    } else {
      report += `🔴 **アクセシビリティ**: 要改善 (WCAG AA準拠不足)\n`;
    }

    if (summary.responsiveCompatibility >= 0.9) {
      report += `🟢 **レスポンシブ**: 優秀 (全デバイス対応)\n`;
    } else if (summary.responsiveCompatibility >= 0.7) {
      report += `🟡 **レスポンシブ**: 良好 (主要デバイス対応)\n`;
    } else {
      report += `🔴 **レスポンシブ**: 要改善 (デバイス対応不足)\n`;
    }
    report += `\n`;

    report += `## テスト結果詳細\n\n`;

    for (const [testId, result] of results) {
      const status = result.success ? '✅ 成功' : '❌ 失敗';

      report += `### ${result.testName} (${testId})\n\n`;
      report += `- **ステータス**: ${status}\n`;
      report += `- **実行時間**: ${result.duration}ms\n`;
      
      if (result.uiMetrics) {
        report += `- **ページ読み込み時間**: ${result.uiMetrics.pageLoadTime.toFixed(0)}ms\n`;
        report += `- **First Contentful Paint**: ${result.uiMetrics.firstContentfulPaint.toFixed(0)}ms\n`;
        report += `- **Largest Contentful Paint**: ${result.uiMetrics.largestContentfulPaint.toFixed(0)}ms\n`;
        report += `- **Cumulative Layout Shift**: ${result.uiMetrics.cumulativeLayoutShift.toFixed(3)}\n`;
        report += `- **First Input Delay**: ${result.uiMetrics.firstInputDelay.toFixed(0)}ms\n`;
      }

      if (result.responsiveMetrics) {
        report += `- **モバイル対応**: ${this.formatViewportResult(result.responsiveMetrics.mobileViewport)}\n`;
        report += `- **タブレット対応**: ${this.formatViewportResult(result.responsiveMetrics.tabletViewport)}\n`;
        report += `- **デスクトップ対応**: ${this.formatViewportResult(result.responsiveMetrics.desktopViewport)}\n`;
      }

      if (result.accessibilityMetrics) {
        report += `- **WCAG AA準拠率**: ${(result.accessibilityMetrics.wcagAACompliance * 100).toFixed(1)}%\n`;
        report += `- **色彩コントラスト比**: ${result.accessibilityMetrics.colorContrastRatio.toFixed(1)}:1\n`;
        report += `- **キーボードナビゲーション**: ${result.accessibilityMetrics.keyboardNavigation ? '対応' : '未対応'}\n`;
        report += `- **スクリーンリーダー対応**: ${result.accessibilityMetrics.screenReaderCompatibility ? '対応' : '未対応'}\n`;
        report += `- **代替テキストカバレッジ**: ${(result.accessibilityMetrics.altTextCoverage * 100).toFixed(1)}%\n`;
      }

      if (result.usabilityMetrics) {
        report += `- **ナビゲーション効率**: ${(result.usabilityMetrics.navigationEfficiency * 100).toFixed(1)}%\n`;
        report += `- **フォーム使いやすさ**: ${(result.usabilityMetrics.formUsability * 100).toFixed(1)}%\n`;
        report += `- **エラーハンドリング**: ${(result.usabilityMetrics.errorHandling * 100).toFixed(1)}%\n`;
        report += `- **ユーザーフロー完了率**: ${(result.usabilityMetrics.userFlowCompletion * 100).toFixed(1)}%\n`;
      }

      if (result.error) {
        report += `- **エラー**: ${result.error}\n`;
      }

      report += `\n`;
    }

    // 推奨事項
    report += `## 推奨事項\n\n`;
    
    if (summary.averagePageLoadTime > 2000) {
      report += `- **パフォーマンス改善**: 平均ページ読み込み時間が${summary.averagePageLoadTime.toFixed(0)}msです。画像最適化、コード分割、CDN活用を検討してください。\n`;
    }
    
    if (summary.wcagComplianceRate < 0.9) {
      report += `- **アクセシビリティ向上**: WCAG AA準拠率が${(summary.wcagComplianceRate * 100).toFixed(1)}%です。ARIAラベル、キーボードナビゲーション、色彩コントラストの改善を検討してください。\n`;
    }
    
    if (summary.responsiveCompatibility < 0.9) {
      report += `- **レスポンシブ改善**: レスポンシブ互換性が${(summary.responsiveCompatibility * 100).toFixed(1)}%です。モバイルファーストデザインとブレークポイントの見直しを検討してください。\n`;
    }
    
    if (summary.usabilityScore < 0.8) {
      report += `- **ユーザビリティ向上**: ユーザビリティスコアが${(summary.usabilityScore * 100).toFixed(1)}%です。ユーザーフローの簡素化とエラーメッセージの改善を検討してください。\n`;
    }

    report += `\n## 次回テストに向けて\n\n`;
    report += `- 定期的なUI/UXテストの実行（月次推奨）\n`;
    report += `- ユーザーフィードバックの収集と分析\n`;
    report += `- 新機能追加時のUI/UX影響評価\n`;
    report += `- アクセシビリティガイドラインの継続的な遵守\n`;
    report += `- パフォーマンス最適化の継続的な実施\n`;

    return report;
  }

  /**
   * ビューポート結果のフォーマット
   */
  private formatViewportResult(viewport: any): string {
    if (!viewport) return '未テスト';
    
    const score = [
      viewport.layoutStability,
      viewport.contentVisibility,
      viewport.navigationUsability,
      viewport.textReadability,
      viewport.buttonAccessibility
    ].filter(Boolean).length;
    
    return `${score}/5項目対応`;
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 UI/UXテストランナーをクリーンアップ中...');
    
    try {
      await this.testModule.cleanup();
      console.log('✅ UI/UXテストランナーのクリーンアップ完了');
    } catch (error) {
      console.warn('⚠️ クリーンアップ中にエラーが発生:', error);
    }
  }
}

export default UIUXTestRunner;