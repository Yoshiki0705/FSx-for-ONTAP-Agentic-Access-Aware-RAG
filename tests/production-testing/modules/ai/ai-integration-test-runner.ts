/**
 * AI統合テストランナー
 * 
 * Nova モデル、日本語精度、ストリーミング、マルチモーダルテストを統合実行
 * 実本番Amazon Bedrockでの包括的AI機能検証
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import NovaModelTestModule, { NovaModelTestResult } from './nova-model-test';
import JapaneseAccuracyTestModule, { JapaneseAccuracyTestResult } from './japanese-accuracy-test';
import StreamingResponseTestModule, { StreamingTestResult } from './streaming-response-test';
import MultimodalInputTestModule, { MultimodalTestResult } from './multimodal-input-test';

import { ProductionConfig } from '../../config/production-config';
import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

/**
 * AI統合テスト結果
 */
export interface AIIntegrationTestResult extends TestResult {
  aiTestSummary?: {
    novaModelTests: number;
    japaneseAccuracyScore: number;
    streamingPerformance: number;
    multimodalCapability: number;
    overallAIScore: number;
  };
  detailedResults?: {
    novaResults: NovaModelTestResult[];
    japaneseResults: JapaneseAccuracyTestResult[];
    streamingResults: StreamingTestResult[];
    multimodalResults: MultimodalTestResult[];
  };
}

/**
 * AI統合テストランナークラス
 */
export class AIIntegrationTestRunner {
  private config: ProductionConfig;
  private novaTestModule: NovaModelTestModule;
  private japaneseTestModule: JapaneseAccuracyTestModule;
  private streamingTestModule: StreamingResponseTestModule;
  private multimodalTestModule: MultimodalInputTestModule;

  constructor(config: ProductionConfig) {
    this.config = config;
    
    // 各テストモジュールの初期化
    this.novaTestModule = new NovaModelTestModule(config);
    this.japaneseTestModule = new JapaneseAccuracyTestModule(config);
    this.streamingTestModule = new StreamingResponseTestModule(config);
    this.multimodalTestModule = new MultimodalInputTestModule(config);
  }

  /**
   * 包括的AI統合テストの実行
   */
  async runComprehensiveAITests(): Promise<AIIntegrationTestResult> {
    const testId = 'ai-integration-comprehensive-001';
    const startTime = Date.now();
    
    console.log('🤖 包括的AI統合テストを開始...');
    console.log('=' .repeat(60));

    try {
      const allResults: any = {
        novaResults: [],
        japaneseResults: [],
        streamingResults: [],
        multimodalResults: []
      };

      // 1. Nova モデルファミリーテスト
      console.log('📋 1/4: Nova モデルファミリーテスト実行中...');
      try {
        const novaResults = await this.novaTestModule.runAllNovaModelTests();
        allResults.novaResults = novaResults;
        console.log(`✅ Nova モデルテスト完了: ${novaResults.filter(r => r.success).length}/${novaResults.length} 成功`);
      } catch (error) {
        console.error('❌ Nova モデルテスト実行エラー:', error);
        allResults.novaResults = [];
      }

      // 2. 日本語精度テスト
      console.log('📋 2/4: 日本語精度テスト実行中...');
      try {
        const japaneseResult = await this.japaneseTestModule.testComprehensiveJapaneseAccuracy();
        allResults.japaneseResults = [japaneseResult];
        console.log(`✅ 日本語精度テスト完了: ${japaneseResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ 日本語精度テスト実行エラー:', error);
        allResults.japaneseResults = [];
      }

      // 3. ストリーミングレスポンステスト
      console.log('📋 3/4: ストリーミングレスポンステスト実行中...');
      try {
        const streamingResult = await this.streamingTestModule.testComprehensiveStreaming();
        allResults.streamingResults = [streamingResult];
        console.log(`✅ ストリーミングテスト完了: ${streamingResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ ストリーミングテスト実行エラー:', error);
        allResults.streamingResults = [];
      }

      // 4. マルチモーダル入力テスト
      console.log('📋 4/4: マルチモーダル入力テスト実行中...');
      try {
        const multimodalResult = await this.multimodalTestModule.testComprehensiveMultimodal();
        allResults.multimodalResults = [multimodalResult];
        console.log(`✅ マルチモーダルテスト完了: ${multimodalResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ マルチモーダルテスト実行エラー:', error);
        allResults.multimodalResults = [];
      }

      // 総合評価の計算
      const aiTestSummary = this.calculateAITestSummary(allResults);
      
      const success = aiTestSummary.overallAIScore >= 0.85; // 85%以上で成功

      const result: AIIntegrationTestResult = {
        testId,
        testName: '包括的AI統合テスト',
        category: 'ai-integration',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        aiTestSummary,
        detailedResults: allResults,
        metadata: {
          testModules: ['nova-models', 'japanese-accuracy', 'streaming', 'multimodal'],
          targetScore: 0.85,
          actualScore: aiTestSummary.overallAIScore
        }
      };

      console.log('=' .repeat(60));
      if (success) {
        console.log(`🎉 包括的AI統合テスト成功 (総合スコア: ${(aiTestSummary.overallAIScore * 100).toFixed(1)}%)`);
      } else {
        console.error(`❌ 包括的AI統合テスト失敗 (総合スコア: ${(aiTestSummary.overallAIScore * 100).toFixed(1)}%)`);
      }

      return result;

    } catch (error) {
      console.error('❌ 包括的AI統合テスト実行エラー:', error);
      
      return {
        testId,
        testName: '包括的AI統合テスト',
        category: 'ai-integration',
        status: TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * AI テストサマリーの計算
   */
  private calculateAITestSummary(results: any): {
    novaModelTests: number;
    japaneseAccuracyScore: number;
    streamingPerformance: number;
    multimodalCapability: number;
    overallAIScore: number;
  } {
    // Nova モデルテストスコア
    const novaSuccessRate = results.novaResults.length > 0 ? 
      results.novaResults.filter((r: any) => r.success).length / results.novaResults.length : 0;

    // 日本語精度スコア
    const japaneseScore = results.japaneseResults.length > 0 && results.japaneseResults[0].accuracyMetrics ? 
      results.japaneseResults[0].accuracyMetrics.overallAccuracy : 0;

    // ストリーミングパフォーマンススコア
    const streamingScore = results.streamingResults.length > 0 && results.streamingResults[0].qualityMetrics ? 
      results.streamingResults[0].qualityMetrics.realTimeScore : 0;

    // マルチモーダル能力スコア
    const multimodalScore = results.multimodalResults.length > 0 && results.multimodalResults[0].modalityMetrics ? 
      results.multimodalResults[0].modalityMetrics.integrationQuality : 0;

    // 重み付き総合スコア
    const weights = {
      nova: 0.3,      // Nova モデル: 30%
      japanese: 0.3,  // 日本語精度: 30%
      streaming: 0.2, // ストリーミング: 20%
      multimodal: 0.2 // マルチモーダル: 20%
    };

    const overallScore = (
      novaSuccessRate * weights.nova +
      japaneseScore * weights.japanese +
      streamingScore * weights.streaming +
      multimodalScore * weights.multimodal
    );

    return {
      novaModelTests: novaSuccessRate,
      japaneseAccuracyScore: japaneseScore,
      streamingPerformance: streamingScore,
      multimodalCapability: multimodalScore,
      overallAIScore: overallScore
    };
  }

  /**
   * 詳細レポートの生成
   */
  async generateDetailedAIReport(result: AIIntegrationTestResult): Promise<string> {
    const timestamp = new Date().toISOString();
    
    let report = `# AI統合テスト詳細レポート\n\n`;
    report += `**実行日時**: ${timestamp}\n`;
    report += `**テスト環境**: AWS東京リージョン本番環境 (${this.config.region})\n`;
    report += `**総合スコア**: ${(result.aiTestSummary?.overallAIScore || 0 * 100).toFixed(1)}%\n\n`;

    // Nova モデルテスト結果
    if (result.detailedResults?.novaResults) {
      report += `## Nova モデルファミリーテスト結果\n\n`;
      for (const novaResult of result.detailedResults.novaResults) {
        const status = novaResult.success ? '✅ 成功' : '❌ 失敗';
        report += `### ${novaResult.testName}\n`;
        report += `- **ステータス**: ${status}\n`;
        report += `- **実行時間**: ${novaResult.duration}ms\n`;
        
        if (novaResult.modelDetails) {
          report += `- **モデル**: ${novaResult.modelDetails.modelName} (${novaResult.modelDetails.modelId})\n`;
        }
        
        if (novaResult.performanceMetrics) {
          report += `- **応答時間**: ${novaResult.performanceMetrics.responseTime}ms\n`;
          report += `- **スループット**: ${novaResult.performanceMetrics.tokensPerSecond.toFixed(1)} tokens/sec\n`;
        }
        
        report += `\n`;
      }
    }

    // 日本語精度テスト結果
    if (result.detailedResults?.japaneseResults && result.detailedResults.japaneseResults.length > 0) {
      const japaneseResult = result.detailedResults.japaneseResults[0];
      report += `## 日本語精度テスト結果\n\n`;
      report += `- **総合精度**: ${(japaneseResult.accuracyMetrics?.overallAccuracy || 0 * 100).toFixed(1)}%\n`;
      report += `- **文法精度**: ${(japaneseResult.accuracyMetrics?.grammarAccuracy || 0 * 100).toFixed(1)}%\n`;
      report += `- **語彙精度**: ${(japaneseResult.accuracyMetrics?.vocabularyAccuracy || 0 * 100).toFixed(1)}%\n`;
      report += `- **敬語精度**: ${(japaneseResult.accuracyMetrics?.formalityAccuracy || 0 * 100).toFixed(1)}%\n\n`;
    }

    // ストリーミングテスト結果
    if (result.detailedResults?.streamingResults && result.detailedResults.streamingResults.length > 0) {
      const streamingResult = result.detailedResults.streamingResults[0];
      report += `## ストリーミングレスポンステスト結果\n\n`;
      report += `- **初回トークンレイテンシ**: ${streamingResult.streamingMetrics?.firstTokenLatency || 0}ms\n`;
      report += `- **平均レイテンシ**: ${streamingResult.streamingMetrics?.averageTokenLatency || 0}ms\n`;
      report += `- **スループット**: ${streamingResult.streamingMetrics?.throughput || 0} tokens/sec\n`;
      report += `- **リアルタイムスコア**: ${(streamingResult.qualityMetrics?.realTimeScore || 0 * 100).toFixed(1)}%\n\n`;
    }

    // マルチモーダルテスト結果
    if (result.detailedResults?.multimodalResults && result.detailedResults.multimodalResults.length > 0) {
      const multimodalResult = result.detailedResults.multimodalResults[0];
      report += `## マルチモーダル入力テスト結果\n\n`;
      report += `- **テキスト処理精度**: ${(multimodalResult.modalityMetrics?.textProcessingAccuracy || 0 * 100).toFixed(1)}%\n`;
      report += `- **画像処理精度**: ${(multimodalResult.modalityMetrics?.imageProcessingAccuracy || 0 * 100).toFixed(1)}%\n`;
      report += `- **統合品質**: ${(multimodalResult.modalityMetrics?.integrationQuality || 0 * 100).toFixed(1)}%\n`;
      report += `- **応答関連性**: ${(multimodalResult.modalityMetrics?.responseRelevance || 0 * 100).toFixed(1)}%\n\n`;
    }

    return report;
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 AI統合テストランナーをクリーンアップ中...');
    
    await Promise.all([
      this.novaTestModule.cleanup(),
      this.japaneseTestModule.cleanup(),
      this.streamingTestModule.cleanup(),
      this.multimodalTestModule.cleanup()
    ]);
    
    console.log('✅ AI統合テストランナーのクリーンアップ完了');
  }
}

export default AIIntegrationTestRunner;