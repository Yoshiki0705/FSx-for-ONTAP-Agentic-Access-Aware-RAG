/**
 * Amazon Nova系モデル クレジット最適化テストスイート
 * 
 * 目的: Nova系モデルのコスト効率とクレジット使用量最適化
 * 対象:
 * - Nova Micro: 最低コスト・高速応答
 * - Nova Lite: バランス型・中コスト
 * - Nova Pro: 高品質・高コスト
 * 
 * 最適化項目:
 * - トークン使用量最適化
 * - 応答品質とコストのバランス
 * - バッチ処理効率
 * - キャッシュ戦略
 * - 適応的モデル選択
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { fromIni } from '@aws-sdk/credential-providers';

// クレジット最適化テスト設定
interface CreditOptimizationConfig {
  region: string;
  profile: string;
  models: {
    micro: { id: string; costPerToken: number; speedMultiplier: number };
    lite: { id: string; costPerToken: number; speedMultiplier: number };
    pro: { id: string; costPerToken: number; speedMultiplier: number };
  };
  testScenarios: OptimizationScenario[];
  budgetLimits: {
    daily: number;
    monthly: number;
    perRequest: number;
  };
  qualityThresholds: {
    minimum: number;
    target: number;
    premium: number;
  };
}

interface OptimizationScenario {
  name: string;
  description: string;
  prompts: string[];
  expectedQuality: number;
  maxCostPerPrompt: number;
  priority: 'low' | 'medium' | 'high';
  useCase: string;
}

interface ModelPerformanceMetrics {
  modelId: string;
  averageResponseTime: number;
  averageTokenUsage: number;
  averageQualityScore: number;
  costPerRequest: number;
  costEfficiencyRatio: number;
}

const creditOptConfig: CreditOptimizationConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  profile: process.env.AWS_PROFILE || 'user01',
  models: {
    micro: { 
      id: 'amazon.nova-micro-v1:0', 
      costPerToken: 0.000035, // 仮想コスト
      speedMultiplier: 1.5 
    },
    lite: { 
      id: 'amazon.nova-lite-v1:0', 
      costPerToken: 0.00006, 
      speedMultiplier: 1.0 
    },
    pro: { 
      id: 'amazon.nova-pro-v1:0', 
      costPerToken: 0.0008, 
      speedMultiplier: 0.7 
    }
  },
  testScenarios: [
    {
      name: 'simple-qa',
      description: '簡単な質問応答（FAQ対応）',
      prompts: [
        'FSx for NetApp ONTAPとは何ですか？',
        'AWS Lambdaの料金体系を教えてください',
        'RAGシステムの基本的な仕組みは？'
      ],
      expectedQuality: 70,
      maxCostPerPrompt: 0.01,
      priority: 'low',
      useCase: 'customer-support'
    },
    {
      name: 'technical-analysis',
      description: '技術的な分析・説明',
      prompts: [
        'Amazon FSx for NetApp ONTAPのパフォーマンス最適化手法について詳しく説明してください',
        'RAGシステムにおけるベクトル検索の精度向上方法を分析してください',
        'サーバーレスアーキテクチャの設計パターンとベストプラクティスを教えてください'
      ],
      expectedQuality: 85,
      maxCostPerPrompt: 0.05,
      priority: 'medium',
      useCase: 'technical-documentation'
    },
    {
      name: 'complex-reasoning',
      description: '複雑な推論・意思決定支援',
      prompts: [
        'エンタープライズ環境でのFSx for NetApp ONTAP導入における、コスト、パフォーマンス、セキュリティの最適なバランスを分析し、具体的な実装戦略を提案してください',
        'マルチリージョンRAGシステムの設計において、データ一貫性、レイテンシ、コスト効率を同時に最適化する方法を詳細に検討してください'
      ],
      expectedQuality: 95,
      maxCostPerPrompt: 0.15,
      priority: 'high',
      useCase: 'strategic-planning'
    }
  ],
  budgetLimits: {
    daily: 10.0,
    monthly: 300.0,
    perRequest: 0.20
  },
  qualityThresholds: {
    minimum: 60,
    target: 80,
    premium: 90
  }
};

// クレジット最適化テストクラス
class NovaCreditOptimizationTester {
  private bedrockClient: BedrockRuntimeClient;
  private cloudwatchClient: CloudWatchClient;
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private totalCost: number = 0;
  private testResults: Map<string, any> = new Map();

  constructor(region: string, profile: string) {
    const credentials = fromIni({ profile });
    
    this.bedrockClient = new BedrockRuntimeClient({ region, credentials });
    this.cloudwatchClient = new CloudWatchClient({ region, credentials });
  }

  /**
   * 適応的モデル選択テスト
   */
  async testAdaptiveModelSelection(): Promise<void> {
    console.log('🎯 適応的モデル選択テスト開始');
    
    try {
      const selectionResults: any[] = [];
      
      for (const scenario of creditOptConfig.testScenarios) {
        console.log(`\n📋 シナリオ: ${scenario.name} (${scenario.description})`);
        
        // 各モデルでテスト実行
        const modelResults: any[] = [];
        
        for (const [modelType, modelConfig] of Object.entries(creditOptConfig.models)) {
          console.log(`🔄 ${modelType.toUpperCase()} モデルテスト中...`);
          
          const results = await this.testModelForScenario(modelConfig.id, scenario);
          modelResults.push({
            modelType,
            ...results,
            costEfficiency: results.averageQuality / results.averageCost
          });
        }
        
        // 最適モデル選択
        const optimalModel = this.selectOptimalModel(modelResults, scenario);
        selectionResults.push({
          scenario: scenario.name,
          optimalModel: optimalModel.modelType,
          qualityScore: optimalModel.averageQuality,
          cost: optimalModel.averageCost,
          efficiency: optimalModel.costEfficiency
        });
        
        console.log(`✅ 最適モデル: ${optimalModel.modelType.toUpperCase()}`);
        console.log(`   品質スコア: ${optimalModel.averageQuality.toFixed(1)}/100`);
        console.log(`   平均コスト: $${optimalModel.averageCost.toFixed(4)}`);
        console.log(`   効率比: ${optimalModel.costEfficiency.toFixed(2)}`);
      }
      
      this.testResults.set('adaptive-selection', {
        status: 'success',
        selectionResults,
        totalScenarios: selectionResults.length
      });
      
      console.log('\n🎉 適応的モデル選択テスト完了');
      
    } catch (error) {
      console.error('❌ 適応的モデル選択テスト失敗:', error);
      this.testResults.set('adaptive-selection', { status: 'failed', error: error.message });
    }
  }

  /**
   * バッチ処理効率テスト
   */
  async testBatchProcessingEfficiency(): Promise<void> {
    console.log('📦 バッチ処理効率テスト開始');
    
    try {
      const batchSizes = [1, 5, 10, 20];
      const batchResults: any[] = [];
      
      for (const batchSize of batchSizes) {
        console.log(`\n🔄 バッチサイズ ${batchSize} テスト中...`);
        
        const startTime = Date.now();
        const promises: Promise<any>[] = [];
        
        // 並列処理でバッチ実行
        for (let i = 0; i < batchSize; i++) {
          const prompt = creditOptConfig.testScenarios[0].prompts[i % creditOptConfig.testScenarios[0].prompts.length];
          promises.push(this.invokeModelWithMetrics(creditOptConfig.models.lite.id, prompt));
        }
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        const batchMetrics = {
          batchSize,
          totalTime,
          averageTimePerRequest: totalTime / batchSize,
          totalCost: results.reduce((sum, r) => sum + r.cost, 0),
          averageCostPerRequest: results.reduce((sum, r) => sum + r.cost, 0) / batchSize,
          throughput: (batchSize / totalTime) * 1000 // requests per second
        };
        
        batchResults.push(batchMetrics);
        
        console.log(`✅ バッチサイズ ${batchSize} 完了:`);
        console.log(`   総時間: ${totalTime}ms`);
        console.log(`   平均時間/リクエスト: ${batchMetrics.averageTimePerRequest.toFixed(1)}ms`);
        console.log(`   スループット: ${batchMetrics.throughput.toFixed(2)} req/sec`);
        console.log(`   総コスト: $${batchMetrics.totalCost.toFixed(4)}`);
      }
      
      // 最適バッチサイズの特定
      const optimalBatch = batchResults.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );
      
      this.testResults.set('batch-efficiency', {
        status: 'success',
        batchResults,
        optimalBatchSize: optimalBatch.batchSize,
        maxThroughput: optimalBatch.throughput
      });
      
      console.log(`\n🎯 最適バッチサイズ: ${optimalBatch.batchSize}`);
      console.log(`   最大スループット: ${optimalBatch.throughput.toFixed(2)} req/sec`);
      
    } catch (error) {
      console.error('❌ バッチ処理効率テスト失敗:', error);
      this.testResults.set('batch-efficiency', { status: 'failed', error: error.message });
    }
  }

  /**
   * コスト予算管理テスト
   */
  async testCostBudgetManagement(): Promise<void> {
    console.log('💰 コスト予算管理テスト開始');
    
    try {
      let dailyCost = 0;
      const budgetAlerts: any[] = [];
      const costTrackingResults: any[] = [];
      
      // 1日分のリクエストをシミュレート
      const dailyRequests = 100;
      
      for (let i = 0; i < dailyRequests; i++) {
        const scenario = creditOptConfig.testScenarios[i % creditOptConfig.testScenarios.length];
        const prompt = scenario.prompts[0];
        
        // 予算制約に基づくモデル選択
        const selectedModel = this.selectModelByBudget(dailyCost, scenario);
        
        if (!selectedModel) {
          budgetAlerts.push({
            requestNumber: i + 1,
            reason: 'daily_budget_exceeded',
            currentCost: dailyCost,
            budgetLimit: creditOptConfig.budgetLimits.daily
          });
          break;
        }
        
        // モデル実行
        const result = await this.invokeModelWithMetrics(selectedModel.id, prompt);
        dailyCost += result.cost;
        
        costTrackingResults.push({
          requestNumber: i + 1,
          modelUsed: selectedModel.type,
          cost: result.cost,
          cumulativeCost: dailyCost,
          budgetUtilization: (dailyCost / creditOptConfig.budgetLimits.daily) * 100
        });
        
        // 予算アラートチェック
        if (dailyCost > creditOptConfig.budgetLimits.daily * 0.8) {
          budgetAlerts.push({
            requestNumber: i + 1,
            reason: 'budget_warning_80_percent',
            currentCost: dailyCost,
            budgetLimit: creditOptConfig.budgetLimits.daily
          });
        }
        
        // 進捗表示（10リクエストごと）
        if ((i + 1) % 10 === 0) {
          console.log(`📊 進捗: ${i + 1}/${dailyRequests} リクエスト完了`);
          console.log(`   累積コスト: $${dailyCost.toFixed(4)}`);
          console.log(`   予算使用率: ${((dailyCost / creditOptConfig.budgetLimits.daily) * 100).toFixed(1)}%`);
        }
      }
      
      this.testResults.set('budget-management', {
        status: 'success',
        totalRequests: costTrackingResults.length,
        totalCost: dailyCost,
        budgetUtilization: (dailyCost / creditOptConfig.budgetLimits.daily) * 100,
        budgetAlerts: budgetAlerts.length,
        averageCostPerRequest: dailyCost / costTrackingResults.length
      });
      
      console.log('\n💰 コスト予算管理テスト完了');
      console.log(`   処理リクエスト数: ${costTrackingResults.length}`);
      console.log(`   総コスト: $${dailyCost.toFixed(4)}`);
      console.log(`   予算使用率: ${((dailyCost / creditOptConfig.budgetLimits.daily) * 100).toFixed(1)}%`);
      console.log(`   予算アラート数: ${budgetAlerts.length}`);
      
    } catch (error) {
      console.error('❌ コスト予算管理テスト失敗:', error);
      this.testResults.set('budget-management', { status: 'failed', error: error.message });
    }
  }

  /**
   * 品質・コスト最適化テスト
   */
  async testQualityCostOptimization(): Promise<void> {
    console.log('⚖️ 品質・コスト最適化テスト開始');
    
    try {
      const optimizationResults: any[] = [];
      
      for (const scenario of creditOptConfig.testScenarios) {
        console.log(`\n🎯 シナリオ最適化: ${scenario.name}`);
        
        // 各モデルの品質・コスト分析
        const modelAnalysis: any[] = [];
        
        for (const [modelType, modelConfig] of Object.entries(creditOptConfig.models)) {
          const results = await this.testModelForScenario(modelConfig.id, scenario);
          
          modelAnalysis.push({
            modelType,
            qualityScore: results.averageQuality,
            cost: results.averageCost,
            qualityCostRatio: results.averageQuality / (results.averageCost * 1000), // 正規化
            meetsQualityThreshold: results.averageQuality >= scenario.expectedQuality,
            withinBudget: results.averageCost <= scenario.maxCostPerPrompt
          });
        }
        
        // パレート最適解の特定
        const paretoOptimal = this.findParetoOptimalModels(modelAnalysis);
        
        // 推奨モデルの選択
        const recommendedModel = this.selectRecommendedModel(modelAnalysis, scenario);
        
        optimizationResults.push({
          scenario: scenario.name,
          modelAnalysis,
          paretoOptimal: paretoOptimal.map(m => m.modelType),
          recommendedModel: recommendedModel.modelType,
          qualityImprovement: recommendedModel.qualityScore - scenario.expectedQuality,
          costEfficiency: recommendedModel.qualityCostRatio
        });
        
        console.log(`✅ 推奨モデル: ${recommendedModel.modelType.toUpperCase()}`);
        console.log(`   品質スコア: ${recommendedModel.qualityScore.toFixed(1)}/100`);
        console.log(`   コスト: $${recommendedModel.cost.toFixed(4)}`);
        console.log(`   品質・コスト比: ${recommendedModel.qualityCostRatio.toFixed(2)}`);
      }
      
      this.testResults.set('quality-cost-optimization', {
        status: 'success',
        optimizationResults,
        totalScenarios: optimizationResults.length
      });
      
      console.log('\n🎉 品質・コスト最適化テスト完了');
      
    } catch (error) {
      console.error('❌ 品質・コスト最適化テスト失敗:', error);
      this.testResults.set('quality-cost-optimization', { status: 'failed', error: error.message });
    }
  }

  /**
   * シナリオ別モデルテスト
   */
  private async testModelForScenario(modelId: string, scenario: OptimizationScenario): Promise<any> {
    let totalQuality = 0;
    let totalCost = 0;
    let totalTime = 0;
    
    for (const prompt of scenario.prompts) {
      const result = await this.invokeModelWithMetrics(modelId, prompt);
      totalQuality += result.quality;
      totalCost += result.cost;
      totalTime += result.responseTime;
    }
    
    return {
      averageQuality: totalQuality / scenario.prompts.length,
      averageCost: totalCost / scenario.prompts.length,
      averageTime: totalTime / scenario.prompts.length,
      totalCost,
      totalTime
    };
  }

  /**
   * メトリクス付きモデル呼び出し
   */
  private async invokeModelWithMetrics(modelId: string, prompt: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.7
        }),
        contentType: 'application/json'
      });
      
      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content[0].text;
      
      const responseTime = Date.now() - startTime;
      
      // コスト計算（推定）
      const tokenCount = this.estimateTokenCount(prompt + responseText);
      const modelConfig = this.getModelConfig(modelId);
      const cost = tokenCount * modelConfig.costPerToken;
      
      // 品質評価
      const quality = this.evaluateResponseQuality(responseText, prompt);
      
      // メトリクス記録
      await this.recordMetrics(modelId, responseTime, tokenCount, cost, quality);
      
      return {
        response: responseText,
        responseTime,
        tokenCount,
        cost,
        quality
      };
      
    } catch (error) {
      console.error(`モデル呼び出しエラー (${modelId}):`, error);
      throw error;
    }
  }

  /**
   * 最適モデル選択
   */
  private selectOptimalModel(modelResults: any[], scenario: OptimizationScenario): any {
    // 品質要件を満たすモデルをフィルタ
    const qualifiedModels = modelResults.filter(m => 
      m.averageQuality >= scenario.expectedQuality &&
      m.averageCost <= scenario.maxCostPerPrompt
    );
    
    if (qualifiedModels.length === 0) {
      // 要件を満たすモデルがない場合、品質を優先
      return modelResults.reduce((best, current) => 
        current.averageQuality > best.averageQuality ? current : best
      );
    }
    
    // 要件を満たすモデルの中でコスト効率が最高のものを選択
    return qualifiedModels.reduce((best, current) => 
      current.costEfficiency > best.costEfficiency ? current : best
    );
  }

  /**
   * 予算制約によるモデル選択
   */
  private selectModelByBudget(currentCost: number, scenario: OptimizationScenario): any {
    const remainingBudget = creditOptConfig.budgetLimits.daily - currentCost;
    
    if (remainingBudget <= 0) {
      return null; // 予算超過
    }
    
    // 残り予算内で最高品質のモデルを選択
    const affordableModels = Object.entries(creditOptConfig.models)
      .filter(([, config]) => {
        const estimatedCost = 100 * config.costPerToken; // 推定コスト
        return estimatedCost <= Math.min(remainingBudget, scenario.maxCostPerPrompt);
      })
      .map(([type, config]) => ({ type, ...config }));
    
    if (affordableModels.length === 0) {
      // 最も安いモデルを選択
      return Object.entries(creditOptConfig.models)
        .reduce((cheapest, [type, config]) => 
          config.costPerToken < cheapest.costPerToken ? { type, ...config } : cheapest
        , { type: 'micro', ...creditOptConfig.models.micro });
    }
    
    // 品質期待値に最も近いモデルを選択
    return affordableModels.reduce((best, current) => {
      const bestScore = this.estimateModelQuality(best.type, scenario);
      const currentScore = this.estimateModelQuality(current.type, scenario);
      return Math.abs(currentScore - scenario.expectedQuality) < 
             Math.abs(bestScore - scenario.expectedQuality) ? current : best;
    });
  }

  /**
   * パレート最適解の特定
   */
  private findParetoOptimalModels(modelAnalysis: any[]): any[] {
    return modelAnalysis.filter(model => {
      return !modelAnalysis.some(other => 
        other !== model &&
        other.qualityScore >= model.qualityScore &&
        other.cost <= model.cost &&
        (other.qualityScore > model.qualityScore || other.cost < model.cost)
      );
    });
  }

  /**
   * 推奨モデル選択
   */
  private selectRecommendedModel(modelAnalysis: any[], scenario: OptimizationScenario): any {
    // 品質要件とコスト制約を満たすモデルを優先
    const qualifiedModels = modelAnalysis.filter(m => 
      m.meetsQualityThreshold && m.withinBudget
    );
    
    if (qualifiedModels.length > 0) {
      return qualifiedModels.reduce((best, current) => 
        current.qualityCostRatio > best.qualityCostRatio ? current : best
      );
    }
    
    // 要件を満たすモデルがない場合、品質・コスト比で選択
    return modelAnalysis.reduce((best, current) => 
      current.qualityCostRatio > best.qualityCostRatio ? current : best
    );
  }

  /**
   * モデル設定取得
   */
  private getModelConfig(modelId: string): any {
    for (const [type, config] of Object.entries(creditOptConfig.models)) {
      if (config.id === modelId) {
        return config;
      }
    }
    return creditOptConfig.models.lite; // デフォルト
  }

  /**
   * トークン数推定
   */
  private estimateTokenCount(text: string): number {
    // 簡易的なトークン数推定（実際はより精密な計算が必要）
    return Math.ceil(text.length / 4);
  }

  /**
   * 応答品質評価
   */
  private evaluateResponseQuality(response: string, prompt: string): number {
    let score = 0;
    
    // 基本的な品質指標
    if (response.length > 50) score += 20;
    if (response.includes('\n') || response.includes('。')) score += 20;
    if (response.length > 200) score += 20;
    
    // 関連性チェック
    const promptWords = prompt.toLowerCase().split(' ');
    const responseWords = response.toLowerCase().split(' ');
    const relevantWords = promptWords.filter(word => 
      responseWords.some(rWord => rWord.includes(word))
    );
    score += Math.min((relevantWords.length / promptWords.length) * 40, 40);
    
    return Math.min(score, 100);
  }

  /**
   * モデル品質推定
   */
  private estimateModelQuality(modelType: string, scenario: OptimizationScenario): number {
    const qualityMultipliers = {
      micro: 0.7,
      lite: 0.85,
      pro: 0.95
    };
    
    return scenario.expectedQuality * qualityMultipliers[modelType];
  }

  /**
   * メトリクス記録
   */
  private async recordMetrics(modelId: string, responseTime: number, tokenCount: number, cost: number, quality: number): Promise<void> {
    try {
      const metricData = [
        {
          MetricName: 'ResponseTime',
          Value: responseTime,
          Unit: 'Milliseconds',
          Dimensions: [{ Name: 'ModelId', Value: modelId }]
        },
        {
          MetricName: 'TokenUsage',
          Value: tokenCount,
          Unit: 'Count',
          Dimensions: [{ Name: 'ModelId', Value: modelId }]
        },
        {
          MetricName: 'Cost',
          Value: cost,
          Unit: 'None',
          Dimensions: [{ Name: 'ModelId', Value: modelId }]
        },
        {
          MetricName: 'QualityScore',
          Value: quality,
          Unit: 'Percent',
          Dimensions: [{ Name: 'ModelId', Value: modelId }]
        }
      ];
      
      await this.cloudwatchClient.send(new PutMetricDataCommand({
        Namespace: 'NovaOptimization',
        MetricData: metricData
      }));
      
    } catch (error) {
      console.warn('メトリクス記録エラー:', error.message);
    }
  }

  /**
   * 最適化設定生成
   */
  generateOptimizationConfigs(): void {
    console.log('\n⚙️ 最適化設定生成');
    
    const configs = {
      modelSelection: {
        simple_qa: 'micro',
        technical_analysis: 'lite',
        complex_reasoning: 'pro'
      },
      budgetAlerts: {
        warning_threshold: 0.8,
        critical_threshold: 0.95,
        daily_limit: creditOptConfig.budgetLimits.daily
      },
      qualityThresholds: creditOptConfig.qualityThresholds,
      batchOptimization: {
        optimal_batch_size: this.testResults.get('batch-efficiency')?.optimalBatchSize || 10,
        max_concurrent_requests: 20
      }
    };
    
    console.log('📋 生成された最適化設定:');
    console.log(JSON.stringify(configs, null, 2));
    
    // 設定ファイルとして保存（オプション）
    if (process.argv.includes('--generate-configs')) {
      const fs = require('fs');
      fs.writeFileSync('nova-optimization-config.json', JSON.stringify(configs, null, 2));
      console.log('✅ 設定ファイル保存: nova-optimization-config.json');
    }
  }

  /**
   * テスト結果サマリー出力
   */
  printTestSummary(): void {
    console.log('\n📊 Nova系クレジット最適化テスト結果サマリー');
    console.log('='.repeat(70));
    
    for (const [testName, result] of this.testResults) {
      console.log(`\n🔍 ${testName.toUpperCase()}:`);
      console.log(`   ステータス: ${result.status === 'success' ? '✅ 成功' : '❌ 失敗'}`);
      
      if (result.status === 'success') {
        switch (testName) {
          case 'adaptive-selection':
            console.log(`   テストシナリオ数: ${result.totalScenarios}`);
            break;
          case 'batch-efficiency':
            console.log(`   最適バッチサイズ: ${result.optimalBatchSize}`);
            console.log(`   最大スループット: ${result.maxThroughput.toFixed(2)} req/sec`);
            break;
          case 'budget-management':
            console.log(`   処理リクエスト数: ${result.totalRequests}`);
            console.log(`   総コスト: $${result.totalCost.toFixed(4)}`);
            console.log(`   予算使用率: ${result.budgetUtilization.toFixed(1)}%`);
            console.log(`   予算アラート数: ${result.budgetAlerts}`);
            break;
          case 'quality-cost-optimization':
            console.log(`   最適化シナリオ数: ${result.totalScenarios}`);
            break;
        }
      } else {
        console.log(`   エラー: ${result.error}`);
      }
    }
    
    const successCount = Array.from(this.testResults.values()).filter(r => r.status === 'success').length;
    const totalCount = this.testResults.size;
    
    console.log(`\n🎯 総合結果: ${successCount}/${totalCount} テスト成功`);
    console.log(`   成功率: ${Math.round((successCount / totalCount) * 100)}%`);
    
    // 総コスト効率の計算
    const budgetResult = this.testResults.get('budget-management');
    if (budgetResult && budgetResult.status === 'success') {
      console.log(`\n💰 コスト効率サマリー:`);
      console.log(`   平均リクエストコスト: $${budgetResult.averageCostPerRequest.toFixed(4)}`);
      console.log(`   予算内処理可能リクエスト数: ${Math.floor(creditOptConfig.budgetLimits.daily / budgetResult.averageCostPerRequest)}`);
    }
  }
}

// メイン実行関数
async function runNovaCreditOptimizationTests(): Promise<void> {
  console.log('🚀 Amazon Nova系クレジット最適化テスト開始');
  console.log(`📍 リージョン: ${creditOptConfig.region}`);
  console.log(`👤 プロファイル: ${creditOptConfig.profile}`);
  console.log(`💰 日次予算: $${creditOptConfig.budgetLimits.daily}`);
  console.log('');
  
  const tester = new NovaCreditOptimizationTester(creditOptConfig.region, creditOptConfig.profile);
  
  try {
    // 各最適化テストの実行
    await tester.testAdaptiveModelSelection();
    await tester.testBatchProcessingEfficiency();
    await tester.testCostBudgetManagement();
    await tester.testQualityCostOptimization();
    
    // 最適化設定の生成
    tester.generateOptimizationConfigs();
    
    // 結果サマリー出力
    tester.printTestSummary();
    
    console.log('\n🎉 Nova系クレジット最適化テスト完了！');
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  runNovaCreditOptimizationTests().catch(console.error);
}

export { NovaCreditOptimizationTester, creditOptConfig };