/**
 * チャットボット機能テスト実行ランナー
 * 
 * 実本番Amazon Bedrockでのチャットボット機能テストを安全に実行
 * テスト結果の収集と報告を行う
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import ChatbotTestModule, { ChatbotTestResult } from './chatbot-test-module';
import ProductionTestEngine, { TestDefinition, TestSuite } from '../../core/production-test-engine';
import { ProductionConfig } from '../../config/production-config';

/**
 * チャットボット機能テスト実行ランナークラス
 */
export class ChatbotTestRunner {
  private config: ProductionConfig;
  private testModule: ChatbotTestModule;
  private testEngine: ProductionTestEngine;

  constructor(config: ProductionConfig, testEngine: ProductionTestEngine) {
    this.config = config;
    this.testEngine = testEngine;
    this.testModule = new ChatbotTestModule(config);
  }

  /**
   * チャットボット機能テストスイートの作成
   */
  createChatbotTestSuite(): TestSuite {
    const testDefinitions: TestDefinition[] = [
      {
        testId: 'chatbot-japanese-001',
        testName: '日本語応答品質テスト',
        category: 'chatbot',
        description: '実本番Bedrockでの日本語応答の品質と自然さを評価',
        timeout: 30000, // 30秒
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testJapaneseResponseQuality();
        }
      },
      {
        testId: 'chatbot-document-001',
        testName: '文書関連応答テスト',
        category: 'chatbot',
        description: '実本番FSx/OpenSearchとの連携による文書ベース応答テスト',
        timeout: 45000, // 45秒
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testDocumentBasedResponse();
        }
      },
      {
        testId: 'chatbot-streaming-001',
        testName: 'ストリーミング応答テスト',
        category: 'chatbot',
        description: '実本番Bedrockでのストリーミング応答機能テスト',
        timeout: 60000, // 60秒
        retryCount: 1,
        dependencies: ['chatbot-japanese-001'],
        execute: async (engine) => {
          return await this.testModule.testStreamingResponse();
        }
      },
      {
        testId: 'chatbot-error-001',
        testName: 'エラーハンドリングテスト',
        category: 'chatbot',
        description: '不適切な質問や曖昧な質問への適切な対応テスト',
        timeout: 45000,
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testErrorHandling();
        }
      },
      {
        testId: 'chatbot-complex-001',
        testName: '複雑な質問への応答テスト',
        category: 'chatbot',
        description: '高度で複雑な質問に対する詳細で正確な応答テスト',
        timeout: 90000, // 90秒
        retryCount: 1,
        dependencies: ['chatbot-document-001'],
        execute: async (engine) => {
          return await this.testModule.testComplexQuestionHandling();
        }
      }
    ];

    return {
      suiteId: 'chatbot-test-suite',
      suiteName: 'チャットボット機能テストスイート',
      description: '実本番Amazon Bedrockでのチャットボット機能包括テスト',
      tests: testDefinitions,
      configuration: {
        parallel: false, // チャットボットテストは順次実行
        maxConcurrency: 1,
        failFast: false, // 一つのテストが失敗しても他のテストを継続
        continueOnError: true
      }
    };
  }

  /**
   * チャットボット機能テストの実行
   */
  async runChatbotTests(): Promise<{
    success: boolean;
    results: Map<string, ChatbotTestResult>;
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      skippedTests: number;
      successRate: number;
      totalDuration: number;
      averageResponseTime: number;
      japaneseQualityScore: number;
      ragEffectiveness: number;
    };
  }> {
    console.log('🚀 チャットボット機能テストスイートを実行開始...');

    try {
      // テストスイートの作成
      const testSuite = this.createChatbotTestSuite();

      // テストエンジンでの実行
      const results = await this.testEngine.executeTestSuite(testSuite);

      // 結果の集計
      const summary = this.generateTestSummary(results);

      console.log('📊 チャットボット機能テスト実行結果:');
      console.log(`   総テスト数: ${summary.totalTests}`);
      console.log(`   成功: ${summary.passedTests}`);
      console.log(`   失敗: ${summary.failedTests}`);
      console.log(`   スキップ: ${summary.skippedTests}`);
      console.log(`   成功率: ${(summary.successRate * 100).toFixed(1)}%`);
      console.log(`   平均応答時間: ${summary.averageResponseTime.toFixed(0)}ms`);
      console.log(`   日本語品質スコア: ${(summary.japaneseQualityScore * 100).toFixed(1)}%`);
      console.log(`   RAG有効性: ${(summary.ragEffectiveness * 100).toFixed(1)}%`);
      console.log(`   総実行時間: ${summary.totalDuration}ms`);

      const success = summary.failedTests === 0;

      if (success) {
        console.log('✅ チャットボット機能テストスイート実行完了 - 全テスト成功');
      } else {
        console.log('⚠️ チャットボット機能テストスイート実行完了 - 一部テスト失敗');
      }

      return {
        success,
        results: results as Map<string, ChatbotTestResult>,
        summary
      };

    } catch (error) {
      console.error('❌ チャットボット機能テスト実行エラー:', error);
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
    averageResponseTime: number;
    japaneseQualityScore: number;
    ragEffectiveness: number;
  } {
    const resultsArray = Array.from(results.values());
    
    const totalTests = resultsArray.length;
    const passedTests = resultsArray.filter(r => r.success).length;
    const failedTests = resultsArray.filter(r => !r.success && r.status !== 'SKIPPED').length;
    const skippedTests = resultsArray.filter(r => r.status === 'SKIPPED').length;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;
    const totalDuration = resultsArray.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    // 平均応答時間の計算
    const responseTimeResults = resultsArray.filter(r => r.responseDetails?.responseTime);
    const averageResponseTime = responseTimeResults.length > 0
      ? responseTimeResults.reduce((sum, r) => sum + r.responseDetails.responseTime, 0) / responseTimeResults.length
      : 0;
    
    // 日本語品質スコアの計算
    const japaneseQualityResults = resultsArray.filter(r => r.responseDetails?.japaneseQuality);
    const japaneseQualityScore = japaneseQualityResults.length > 0
      ? japaneseQualityResults.reduce((sum, r) => sum + r.responseDetails.japaneseQuality, 0) / japaneseQualityResults.length
      : 0;
    
    // RAG有効性の計算
    const ragResults = resultsArray.filter(r => r.ragDetails);
    const ragEffectiveness = ragResults.length > 0
      ? ragResults.reduce((sum, r) => sum + (r.ragDetails.sourceAccuracy || 0), 0) / ragResults.length
      : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate,
      totalDuration,
      averageResponseTime,
      japaneseQualityScore,
      ragEffectiveness
    };
  }

  /**
   * 詳細レポートの生成
   */
  async generateDetailedReport(results: Map<string, ChatbotTestResult>): Promise<string> {
    const timestamp = new Date().toISOString();
    const summary = this.generateTestSummary(results);

    let report = `# チャットボット機能テスト詳細レポート\n\n`;
    report += `**実行日時**: ${timestamp}\n`;
    report += `**テスト環境**: AWS東京リージョン本番環境 (${this.config.region})\n`;
    report += `**Bedrockモデル**: Claude 3 Haiku, Claude 3 Sonnet\n`;
    report += `**OpenSearchドメイン**: ${this.config.resources.openSearchDomain}\n`;
    report += `**FSxファイルシステム**: ${this.config.resources.fsxFileSystemId}\n\n`;

    report += `## 実行サマリー\n\n`;
    report += `- **総テスト数**: ${summary.totalTests}\n`;
    report += `- **成功**: ${summary.passedTests}\n`;
    report += `- **失敗**: ${summary.failedTests}\n`;
    report += `- **スキップ**: ${summary.skippedTests}\n`;
    report += `- **成功率**: ${(summary.successRate * 100).toFixed(1)}%\n`;
    report += `- **平均応答時間**: ${summary.averageResponseTime.toFixed(0)}ms\n`;
    report += `- **日本語品質スコア**: ${(summary.japaneseQualityScore * 100).toFixed(1)}%\n`;
    report += `- **RAG有効性**: ${(summary.ragEffectiveness * 100).toFixed(1)}%\n`;
    report += `- **総実行時間**: ${summary.totalDuration}ms\n\n`;

    // AI品質評価
    report += `## AI応答品質評価\n\n`;
    if (summary.japaneseQualityScore >= 0.8) {
      report += `🟢 **優秀**: 日本語応答品質が高水準です\n`;
    } else if (summary.japaneseQualityScore >= 0.6) {
      report += `🟡 **良好**: 日本語応答品質に軽微な改善点があります\n`;
    } else {
      report += `🔴 **要改善**: 日本語応答品質の向上が必要です\n`;
    }

    if (summary.ragEffectiveness >= 0.7) {
      report += `🟢 **RAG機能**: 文書検索と応答生成が適切に連携しています\n`;
    } else if (summary.ragEffectiveness >= 0.5) {
      report += `🟡 **RAG機能**: 文書検索の精度向上が推奨されます\n`;
    } else {
      report += `🔴 **RAG機能**: 文書検索と応答生成の連携に問題があります\n`;
    }
    report += `\n`;

    report += `## テスト結果詳細\n\n`;

    for (const [testId, result] of results) {
      const status = result.success ? '✅ 成功' : '❌ 失敗';
      const duration = result.duration || 0;

      report += `### ${result.testName} (${testId})\n\n`;
      report += `- **ステータス**: ${status}\n`;
      report += `- **実行時間**: ${duration}ms\n`;
      report += `- **開始時刻**: ${result.startTime?.toISOString()}\n`;
      report += `- **終了時刻**: ${result.endTime?.toISOString()}\n`;

      if (result.error) {
        report += `- **エラー**: ${result.error}\n`;
      }

      if (result.responseDetails) {
        report += `- **応答詳細**:\n`;
        report += `  - 応答時間: ${result.responseDetails.responseTime}ms\n`;
        report += `  - トークン数: ${result.responseDetails.tokenCount}\n`;
        report += `  - 使用モデル: ${result.responseDetails.modelUsed}\n`;
        report += `  - ストリーミング: ${result.responseDetails.isStreaming ? 'あり' : 'なし'}\n`;
        report += `  - 日本語品質: ${(result.responseDetails.japaneseQuality * 100).toFixed(1)}%\n`;
        
        // 応答テキストの一部を表示（長すぎる場合は切り詰め）
        const responsePreview = result.responseDetails.responseText.length > 200
          ? result.responseDetails.responseText.substring(0, 200) + '...'
          : result.responseDetails.responseText;
        report += `  - 応答内容: "${responsePreview}"\n`;
      }

      if (result.ragDetails) {
        report += `- **RAG詳細**:\n`;
        report += `  - 検索文書数: ${result.ragDetails.documentsFound}件\n`;
        report += `  - 関連文書数: ${result.ragDetails.relevantDocuments}件\n`;
        report += `  - 引用含有: ${result.ragDetails.citationsIncluded ? 'あり' : 'なし'}\n`;
        report += `  - 情報源精度: ${(result.ragDetails.sourceAccuracy * 100).toFixed(1)}%\n`;
      }

      if (result.performanceMetrics) {
        report += `- **パフォーマンス**:\n`;
        report += `  - レイテンシ: ${result.performanceMetrics.latency}ms\n`;
        report += `  - スループット: ${result.performanceMetrics.throughput.toFixed(2)} tokens/sec\n`;
        report += `  - エラー率: ${(result.performanceMetrics.errorRate * 100).toFixed(1)}%\n`;
        report += `  - リソース使用率: ${(result.performanceMetrics.resourceUsage * 100).toFixed(1)}%\n`;
      }

      report += `\n`;
    }

    // 推奨事項
    report += `## 推奨事項\n\n`;
    report += this.generateRecommendations(results, summary);

    return report;
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(
    results: Map<string, ChatbotTestResult>,
    summary: any
  ): string {
    let recommendations = '';
    const failedTests = Array.from(results.values()).filter(r => !r.success);

    if (failedTests.length === 0) {
      recommendations += `✅ 全てのチャットボット機能テストが成功しました。現在の設定を維持してください。\n\n`;
    } else {
      recommendations += `以下の改善を推奨します:\n\n`;
      
      failedTests.forEach(test => {
        switch (test.testId) {
          case 'chatbot-japanese-001':
            recommendations += `- **日本語応答品質**: プロンプトエンジニアリングを改善し、より自然な日本語応答を生成してください\n`;
            break;
          case 'chatbot-document-001':
            recommendations += `- **文書関連応答**: OpenSearchの検索精度を向上させ、より関連性の高い文書を取得してください\n`;
            break;
          case 'chatbot-streaming-001':
            recommendations += `- **ストリーミング応答**: ストリーミング処理の安定性を向上させ、エラー処理を強化してください\n`;
            break;
          case 'chatbot-error-001':
            recommendations += `- **エラーハンドリング**: 不適切な質問への対応ロジックを改善してください\n`;
            break;
          case 'chatbot-complex-001':
            recommendations += `- **複雑な質問対応**: より高性能なモデルの使用や、プロンプトの詳細化を検討してください\n`;
            break;
        }
      });
    }

    // パフォーマンス関連の推奨事項
    if (summary.averageResponseTime > 8000) {
      recommendations += `- **応答時間**: 平均応答時間が${summary.averageResponseTime.toFixed(0)}msと長いため、モデル選択やプロンプト最適化を検討してください\n`;
    }

    if (summary.japaneseQualityScore < 0.7) {
      recommendations += `- **日本語品質**: 日本語品質スコアが${(summary.japaneseQualityScore * 100).toFixed(1)}%のため、日本語特化のプロンプト調整が必要です\n`;
    }

    if (summary.ragEffectiveness < 0.6) {
      recommendations += `- **RAG機能**: RAG有効性が${(summary.ragEffectiveness * 100).toFixed(1)}%のため、文書インデックスの改善や検索アルゴリズムの調整が必要です\n`;
    }

    recommendations += `\n### AI応答品質向上のベストプラクティス\n\n`;
    recommendations += `- 日本語特化プロンプトの使用\n`;
    recommendations += `- 文書コンテキストの適切な構造化\n`;
    recommendations += `- ストリーミング応答の安定性確保\n`;
    recommendations += `- エラーケースの包括的な対応\n`;
    recommendations += `- 継続的な応答品質監視\n`;

    return recommendations;
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 チャットボット機能テストランナーをクリーンアップ中...');
    await this.testModule.cleanup();
    console.log('✅ チャットボット機能テストランナーのクリーンアップ完了');
  }
}

export default ChatbotTestRunner;