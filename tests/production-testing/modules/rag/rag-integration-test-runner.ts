/**
 * RAG統合テストランナー
 * 
 * ベクトル検索、検索統合、コンテキスト維持、権限フィルタリングテストを統合実行
 * 実本番環境でのRAG機能包括検証
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import VectorSearchTestModule, { VectorSearchTestResult } from './vector-search-test';
import SearchIntegrationTestModule, { SearchIntegrationTestResult } from './search-integration-test';
import ContextPersistenceTestModule, { ContextPersistenceTestResult } from './context-persistence-test';
import PermissionFilteringTestModule, { PermissionFilteringTestResult } from './permission-filtering-test';

import { ProductionConfig } from '../../config/production-config';
import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

/**
 * RAG統合テスト結果
 */
export interface RAGIntegrationTestResult extends TestResult {
  ragTestSummary?: {
    vectorSearchScore: number;
    searchIntegrationScore: number;
    contextPersistenceScore: number;
    permissionFilteringScore: number;
    overallRAGScore: number;
  };
  detailedResults?: {
    vectorSearchResults: VectorSearchTestResult[];
    searchIntegrationResults: SearchIntegrationTestResult[];
    contextPersistenceResults: ContextPersistenceTestResult[];
    permissionFilteringResults: PermissionFilteringTestResult[];
  };
}

/**
 * RAG統合テストランナークラス
 */
export class RAGIntegrationTestRunner {
  private config: ProductionConfig;
  private vectorSearchModule: VectorSearchTestModule;
  private searchIntegrationModule: SearchIntegrationTestModule;
  private contextPersistenceModule: ContextPersistenceTestModule;
  private permissionFilteringModule: PermissionFilteringTestModule;

  constructor(config: ProductionConfig) {
    this.config = config;
    
    // 各テストモジュールの初期化
    this.vectorSearchModule = new VectorSearchTestModule(config);
    this.searchIntegrationModule = new SearchIntegrationTestModule(config);
    this.contextPersistenceModule = new ContextPersistenceTestModule(config);
    this.permissionFilteringModule = new PermissionFilteringTestModule(config);
  }

  /**
   * 包括的RAG統合テストの実行
   */
  async runComprehensiveRAGTests(): Promise<RAGIntegrationTestResult> {
    const testId = 'rag-integration-comprehensive-001';
    const startTime = Date.now();
    
    console.log('🔍 包括的RAG統合テストを開始...');
    console.log('=' .repeat(60));

    try {
      const allResults: any = {
        vectorSearchResults: [],
        searchIntegrationResults: [],
        contextPersistenceResults: [],
        permissionFilteringResults: []
      };

      // 1. ベクトル検索テスト
      console.log('📋 1/4: ベクトル検索テスト実行中...');
      try {
        const vectorSearchResult = await this.vectorSearchModule.testComprehensiveVectorSearch();
        allResults.vectorSearchResults = [vectorSearchResult];
        console.log(`✅ ベクトル検索テスト完了: ${vectorSearchResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ ベクトル検索テスト実行エラー:', error);
        allResults.vectorSearchResults = [];
      }

      // 2. 検索統合テスト
      console.log('📋 2/4: 検索統合テスト実行中...');
      try {
        const searchIntegrationResult = await this.searchIntegrationModule.testComprehensiveSearchIntegration();
        allResults.searchIntegrationResults = [searchIntegrationResult];
        console.log(`✅ 検索統合テスト完了: ${searchIntegrationResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ 検索統合テスト実行エラー:', error);
        allResults.searchIntegrationResults = [];
      }

      // 3. コンテキスト維持テスト
      console.log('📋 3/4: コンテキスト維持テスト実行中...');
      try {
        const contextPersistenceResult = await this.contextPersistenceModule.testComprehensiveContextPersistence();
        allResults.contextPersistenceResults = [contextPersistenceResult];
        console.log(`✅ コンテキスト維持テスト完了: ${contextPersistenceResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ コンテキスト維持テスト実行エラー:', error);
        allResults.contextPersistenceResults = [];
      }

      // 4. 権限フィルタリングテスト
      console.log('📋 4/4: 権限フィルタリングテスト実行中...');
      try {
        const permissionFilteringResult = await this.permissionFilteringModule.testComprehensivePermissionFiltering();
        allResults.permissionFilteringResults = [permissionFilteringResult];
        console.log(`✅ 権限フィルタリングテスト完了: ${permissionFilteringResult.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ 権限フィルタリングテスト実行エラー:', error);
        allResults.permissionFilteringResults = [];
      }

      // 総合評価の計算
      const ragTestSummary = this.calculateRAGTestSummary(allResults);
      
      const success = ragTestSummary.overallRAGScore >= 0.85; // 85%以上で成功

      const result: RAGIntegrationTestResult = {
        testId,
        testName: '包括的RAG統合テスト',
        category: 'rag-integration',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        ragTestSummary,
        detailedResults: allResults,
        metadata: {
          testModules: ['vector-search', 'search-integration', 'context-persistence', 'permission-filtering'],
          targetScore: 0.85,
          actualScore: ragTestSummary.overallRAGScore
        }
      };

      console.log('=' .repeat(60));
      if (success) {
        console.log(`🎉 包括的RAG統合テスト成功 (総合スコア: ${(ragTestSummary.overallRAGScore * 100).toFixed(1)}%)`);
      } else {
        console.error(`❌ 包括的RAG統合テスト失敗 (総合スコア: ${(ragTestSummary.overallRAGScore * 100).toFixed(1)}%)`);
      }

      return result;

    } catch (error) {
      console.error('❌ 包括的RAG統合テスト実行エラー:', error);
      
      return {
        testId,
        testName: '包括的RAG統合テスト',
        category: 'rag-integration',
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
   * RAG テストサマリーの計算
   */
  private calculateRAGTestSummary(results: any): {
    vectorSearchScore: number;
    searchIntegrationScore: number;
    contextPersistenceScore: number;
    permissionFilteringScore: number;
    overallRAGScore: number;
  } {
    // ベクトル検索スコア
    const vectorSearchScore = results.vectorSearchResults.length > 0 && results.vectorSearchResults[0].searchMetrics ? 
      results.vectorSearchResults[0].searchMetrics.relevanceScore : 0;

    // 検索統合スコア
    const searchIntegrationScore = results.searchIntegrationResults.length > 0 && results.searchIntegrationResults[0].ragQuality ? 
      results.searchIntegrationResults[0].ragQuality.overallRAGScore : 0;

    // コンテキスト維持スコア
    const contextPersistenceScore = results.contextPersistenceResults.length > 0 && results.contextPersistenceResults[0].contextMetrics ? 
      results.contextPersistenceResults[0].contextMetrics.sessionContinuity : 0;

    // 権限フィルタリングスコア
    const permissionFilteringScore = results.permissionFilteringResults.length > 0 && results.permissionFilteringResults[0].permissionMetrics ? 
      results.permissionFilteringResults[0].permissionMetrics.accessControlAccuracy : 0;

    // 重み付き総合スコア
    const weights = {
      vectorSearch: 0.25,      // ベクトル検索: 25%
      searchIntegration: 0.35, // 検索統合: 35%
      contextPersistence: 0.20, // コンテキスト維持: 20%
      permissionFiltering: 0.20 // 権限フィルタリング: 20%
    };

    const overallScore = (
      vectorSearchScore * weights.vectorSearch +
      searchIntegrationScore * weights.searchIntegration +
      contextPersistenceScore * weights.contextPersistence +
      permissionFilteringScore * weights.permissionFiltering
    );

    return {
      vectorSearchScore,
      searchIntegrationScore,
      contextPersistenceScore,
      permissionFilteringScore,
      overallRAGScore: overallScore
    };
  }

  /**
   * 詳細レポートの生成
   */
  async generateDetailedRAGReport(result: RAGIntegrationTestResult): Promise<string> {
    const timestamp = new Date().toISOString();
    
    let report = `# RAG統合テスト詳細レポート\n\n`;
    report += `**実行日時**: ${timestamp}\n`;
    report += `**テスト環境**: AWS東京リージョン本番環境 (${this.config.region})\n`;
    report += `**総合スコア**: ${(result.ragTestSummary?.overallRAGScore || 0 * 100).toFixed(1)}%\n\n`;

    // ベクトル検索テスト結果
    if (result.detailedResults?.vectorSearchResults && result.detailedResults.vectorSearchResults.length > 0) {
      const vectorResult = result.detailedResults.vectorSearchResults[0];
      report += `## ベクトル検索テスト結果\n\n`;
      report += `- **ステータス**: ${vectorResult.success ? '✅ 成功' : '❌ 失敗'}\n`;
      report += `- **実行時間**: ${vectorResult.duration}ms\n`;
      
      if (vectorResult.searchMetrics) {
        report += `- **応答時間**: ${vectorResult.searchMetrics.responseTime.toFixed(0)}ms\n`;
        report += `- **関連性スコア**: ${(vectorResult.searchMetrics.relevanceScore * 100).toFixed(1)}%\n`;
        report += `- **精度@5**: ${(vectorResult.searchMetrics.precisionAt5 * 100).toFixed(1)}%\n`;
        report += `- **再現率**: ${(vectorResult.searchMetrics.recallScore * 100).toFixed(1)}%\n`;
      }
      
      if (vectorResult.qualityMetrics) {
        report += `- **意味的精度**: ${(vectorResult.qualityMetrics.semanticAccuracy * 100).toFixed(1)}%\n`;
        report += `- **文脈関連性**: ${(vectorResult.qualityMetrics.contextualRelevance * 100).toFixed(1)}%\n`;
      }
      
      report += `\n`;
    }

    // 検索統合テスト結果
    if (result.detailedResults?.searchIntegrationResults && result.detailedResults.searchIntegrationResults.length > 0) {
      const integrationResult = result.detailedResults.searchIntegrationResults[0];
      report += `## 検索統合テスト結果\n\n`;
      report += `- **ステータス**: ${integrationResult.success ? '✅ 成功' : '❌ 失敗'}\n`;
      report += `- **実行時間**: ${integrationResult.duration}ms\n`;
      
      if (integrationResult.integrationMetrics) {
        report += `- **検索精度**: ${(integrationResult.integrationMetrics.searchAccuracy * 100).toFixed(1)}%\n`;
        report += `- **応答関連性**: ${(integrationResult.integrationMetrics.responseRelevance * 100).toFixed(1)}%\n`;
        report += `- **ソース帰属**: ${(integrationResult.integrationMetrics.sourceAttribution * 100).toFixed(1)}%\n`;
        report += `- **一貫性スコア**: ${(integrationResult.integrationMetrics.coherenceScore * 100).toFixed(1)}%\n`;
      }
      
      if (integrationResult.ragQuality) {
        report += `- **検索品質**: ${(integrationResult.ragQuality.retrievalQuality * 100).toFixed(1)}%\n`;
        report += `- **生成品質**: ${(integrationResult.ragQuality.generationQuality * 100).toFixed(1)}%\n`;
        report += `- **拡張効果**: ${(integrationResult.ragQuality.augmentationEffectiveness * 100).toFixed(1)}%\n`;
      }
      
      report += `\n`;
    }

    // コンテキスト維持テスト結果
    if (result.detailedResults?.contextPersistenceResults && result.detailedResults.contextPersistenceResults.length > 0) {
      const contextResult = result.detailedResults.contextPersistenceResults[0];
      report += `## コンテキスト維持テスト結果\n\n`;
      report += `- **ステータス**: ${contextResult.success ? '✅ 成功' : '❌ 失敗'}\n`;
      report += `- **実行時間**: ${contextResult.duration}ms\n`;
      
      if (contextResult.contextMetrics) {
        report += `- **セッション継続性**: ${(contextResult.contextMetrics.sessionContinuity * 100).toFixed(1)}%\n`;
        report += `- **コンテキスト保持**: ${(contextResult.contextMetrics.contextRetention * 100).toFixed(1)}%\n`;
        report += `- **会話一貫性**: ${(contextResult.contextMetrics.conversationCoherence * 100).toFixed(1)}%\n`;
        report += `- **メモリ効率**: ${(contextResult.contextMetrics.memoryEfficiency * 100).toFixed(1)}%\n`;
      }
      
      if (contextResult.sessionAnalysis) {
        report += `- **平均セッション長**: ${contextResult.sessionAnalysis.averageSessionLength.toFixed(1)}メッセージ\n`;
        report += `- **コンテキスト切替精度**: ${(contextResult.sessionAnalysis.contextSwitchAccuracy * 100).toFixed(1)}%\n`;
      }
      
      report += `\n`;
    }

    // 権限フィルタリングテスト結果
    if (result.detailedResults?.permissionFilteringResults && result.detailedResults.permissionFilteringResults.length > 0) {
      const permissionResult = result.detailedResults.permissionFilteringResults[0];
      report += `## 権限フィルタリングテスト結果\n\n`;
      report += `- **ステータス**: ${permissionResult.success ? '✅ 成功' : '❌ 失敗'}\n`;
      report += `- **実行時間**: ${permissionResult.duration}ms\n`;
      
      if (permissionResult.permissionMetrics) {
        report += `- **アクセス制御精度**: ${(permissionResult.permissionMetrics.accessControlAccuracy * 100).toFixed(1)}%\n`;
        report += `- **不正アクセスブロック**: ${(permissionResult.permissionMetrics.unauthorizedBlocking * 100).toFixed(1)}%\n`;
        report += `- **正当アクセス許可**: ${(permissionResult.permissionMetrics.authorizedAccess * 100).toFixed(1)}%\n`;
        report += `- **ロールベースフィルタリング**: ${(permissionResult.permissionMetrics.roleBasedFiltering * 100).toFixed(1)}%\n`;
      }
      
      if (permissionResult.securityAnalysis) {
        report += `- **データ漏洩防止**: ${(permissionResult.securityAnalysis.dataLeakagePrevention * 100).toFixed(1)}%\n`;
        report += `- **権限昇格防止**: ${(permissionResult.securityAnalysis.privilegeEscalationPrevention * 100).toFixed(1)}%\n`;
        report += `- **監査証跡完全性**: ${(permissionResult.securityAnalysis.auditTrailCompleteness * 100).toFixed(1)}%\n`;
      }
      
      report += `\n`;
    }

    return report;
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 RAG統合テストランナーをクリーンアップ中...');
    
    await Promise.all([
      this.vectorSearchModule.cleanup(),
      this.searchIntegrationModule.cleanup(),
      this.contextPersistenceModule.cleanup(),
      this.permissionFilteringModule.cleanup()
    ]);
    
    console.log('✅ RAG統合テストランナーのクリーンアップ完了');
  }
}

export default RAGIntegrationTestRunner;