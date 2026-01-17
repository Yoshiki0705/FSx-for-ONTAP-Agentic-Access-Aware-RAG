/**
 * Amazon Nova系モデル マルチリージョンテストスクリプト
 * 
 * 目的: Nova系モデルの複数リージョンでの動作確認
 * 対象リージョン:
 * - us-east-1 (バージニア北部) - メインリージョン
 * - us-west-2 (オレゴン) - 西海岸
 * - eu-west-1 (アイルランド) - ヨーロッパ
 * - ap-northeast-1 (東京) - アジア太平洋
 * 
 * テスト項目:
 * - リージョン別モデル可用性
 * - レイテンシ比較
 * - 応答品質の一貫性
 * - フェイルオーバー機能
 * - コスト比較
 */

import { BedrockRuntimeClient, InvokeModelCommand, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

// マルチリージョンテスト設定
interface MultiRegionTestConfig {
  profile: string;
  regions: RegionConfig[];
  testModels: string[];
  testPrompts: string[];
  maxRetries: number;
  timeoutMs: number;
}

interface RegionConfig {
  name: string;
  code: string;
  description: string;
  priority: number;
  expectedLatency: number; // ms
}

interface RegionTestResult {
  region: string;
  modelId: string;
  available: boolean;
  latency: number;
  responseQuality: number;
  error?: string;
  response?: string;
}

const multiRegionConfig: MultiRegionTestConfig = {
  profile: process.env.AWS_PROFILE || 'user01',
  regions: [
    {
      name: 'US East (N. Virginia)',
      code: 'us-east-1',
      description: 'メインリージョン - 最新機能優先',
      priority: 1,
      expectedLatency: 100
    },
    {
      name: 'US West (Oregon)',
      code: 'us-west-2',
      description: '西海岸 - 低レイテンシ',
      priority: 2,
      expectedLatency: 120
    },
    {
      name: 'Europe (Ireland)',
      code: 'eu-west-1',
      description: 'ヨーロッパ - GDPR準拠',
      priority: 3,
      expectedLatency: 200
    },
    {
      name: 'Asia Pacific (Tokyo)',
      code: 'ap-northeast-1',
      description: 'アジア太平洋 - 日本語最適化',
      priority: 4,
      expectedLatency: 150
    }
  ],
  testModels: [
    'amazon.nova-micro-v1:0',
    'amazon.nova-lite-v1:0',
    'amazon.nova-pro-v1:0'
  ],
  testPrompts: [
    'Amazon FSx for NetApp ONTAPの主要な特徴を3つ教えてください。',
    'RAGシステムにおけるベクトル検索の重要性について説明してください。',
    'AWS Lambdaを使用したサーバーレスアーキテクチャの利点は何ですか？'
  ],
  maxRetries: 3,
  timeoutMs: 30000
};

// マルチリージョンテストクラス
class MultiRegionTester {
  private clients: Map<string, BedrockRuntimeClient> = new Map();
  private testResults: Map<string, RegionTestResult[]> = new Map();
  private regionAvailability: Map<string, boolean> = new Map();

  constructor(profile: string) {
    // 各リージョンのクライアントを初期化
    for (const region of multiRegionConfig.regions) {
      const client = new BedrockRuntimeClient({
        region: region.code,
        credentials: fromIni({ profile })
      });
      this.clients.set(region.code, client);
    }
  }

  /**
   * 全リージョンでのモデル可用性テスト
   */
  async testModelAvailability(): Promise<void> {
    console.log('🌍 マルチリージョン モデル可用性テスト開始');
    console.log('='.repeat(60));
    
    for (const region of multiRegionConfig.regions) {
      console.log(`\n📍 リージョン: ${region.name} (${region.code})`);
      
      try {
        const client = this.clients.get(region.code)!;
        
        // 利用可能なモデル一覧を取得
        const listCommand = new ListFoundationModelsCommand({});
        const modelsResponse = await client.send(listCommand);
        
        const availableModels = modelsResponse.modelSummaries || [];
        const novaModels = availableModels.filter(model => 
          model.modelId?.includes('nova')
        );
        
        console.log(`✅ リージョン接続成功`);
        console.log(`   利用可能なモデル総数: ${availableModels.length}`);
        console.log(`   Nova系モデル数: ${novaModels.length}`);
        
        // 各Nova系モデルの可用性確認
        for (const modelId of multiRegionConfig.testModels) {
          const isAvailable = novaModels.some(model => model.modelId === modelId);
          console.log(`   ${modelId}: ${isAvailable ? '✅ 利用可能' : '❌ 利用不可'}`);
        }
        
        this.regionAvailability.set(region.code, true);
        
      } catch (error) {
        console.log(`❌ リージョン接続失敗: ${error.message}`);
        this.regionAvailability.set(region.code, false);
      }
    }
    
    console.log('\n🎉 モデル可用性テスト完了');
  }

  /**
   * リージョン別レイテンシテスト
   */
  async testRegionLatency(): Promise<void> {
    console.log('\n⚡ リージョン別レイテンシテスト開始');
    console.log('='.repeat(60));
    
    const latencyResults: any[] = [];
    
    for (const region of multiRegionConfig.regions) {
      if (!this.regionAvailability.get(region.code)) {
        console.log(`⏭️  ${region.name}: スキップ（接続不可）`);
        continue;
      }
      
      console.log(`\n📍 ${region.name} (${region.code}) レイテンシ測定`);
      
      const regionLatencies: number[] = [];
      
      // 各モデルでレイテンシ測定
      for (const modelId of multiRegionConfig.testModels) {
        try {
          const latencies = await this.measureModelLatency(region.code, modelId, 3);
          const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
          
          regionLatencies.push(avgLatency);
          
          console.log(`   ${modelId}:`);
          console.log(`     平均レイテンシ: ${avgLatency.toFixed(1)}ms`);
          console.log(`     期待値との差: ${(avgLatency - region.expectedLatency).toFixed(1)}ms`);
          
        } catch (error) {
          console.log(`   ${modelId}: ❌ 測定失敗 (${error.message})`);
        }
      }
      
      if (regionLatencies.length > 0) {
        const avgRegionLatency = regionLatencies.reduce((sum, lat) => sum + lat, 0) / regionLatencies.length;
        
        latencyResults.push({
          region: region.code,
          name: region.name,
          averageLatency: avgRegionLatency,
          expectedLatency: region.expectedLatency,
          performance: avgRegionLatency <= region.expectedLatency ? 'good' : 'poor'
        });
        
        console.log(`\n📊 ${region.name} 総合レイテンシ: ${avgRegionLatency.toFixed(1)}ms`);
        console.log(`   パフォーマンス: ${avgRegionLatency <= region.expectedLatency ? '✅ 良好' : '⚠️ 要改善'}`);
      }
    }
    
    // レイテンシランキング
    latencyResults.sort((a, b) => a.averageLatency - b.averageLatency);
    
    console.log('\n🏆 レイテンシランキング:');
    latencyResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name}: ${result.averageLatency.toFixed(1)}ms`);
    });
  }

  /**
   * 応答品質一貫性テスト
   */
  async testResponseConsistency(): Promise<void> {
    console.log('\n🎯 応答品質一貫性テスト開始');
    console.log('='.repeat(60));
    
    const consistencyResults: any[] = [];
    
    for (const prompt of multiRegionConfig.testPrompts) {
      console.log(`\n📝 プロンプト: ${prompt.substring(0, 50)}...`);
      
      const promptResults: any[] = [];
      
      // 各リージョンで同じプロンプトをテスト
      for (const region of multiRegionConfig.regions) {
        if (!this.regionAvailability.get(region.code)) continue;
        
        console.log(`\n   📍 ${region.name}:`);
        
        for (const modelId of multiRegionConfig.testModels) {
          try {
            const result = await this.invokeModelWithMetrics(region.code, modelId, prompt);
            
            promptResults.push({
              region: region.code,
              regionName: region.name,
              modelId,
              quality: result.quality,
              responseLength: result.response.length,
              latency: result.latency
            });
            
            console.log(`     ${modelId}:`);
            console.log(`       品質スコア: ${result.quality}/100`);
            console.log(`       応答長: ${result.response.length}文字`);
            console.log(`       レイテンシ: ${result.latency}ms`);
            
          } catch (error) {
            console.log(`     ${modelId}: ❌ 失敗 (${error.message})`);
          }
        }
      }
      
      // 品質一貫性の分析
      if (promptResults.length > 0) {
        const qualityAnalysis = this.analyzeQualityConsistency(promptResults);
        consistencyResults.push({
          prompt: prompt.substring(0, 50) + '...',
          ...qualityAnalysis
        });
        
        console.log(`\n   📊 品質一貫性分析:`);
        console.log(`     平均品質: ${qualityAnalysis.averageQuality.toFixed(1)}/100`);
        console.log(`     品質標準偏差: ${qualityAnalysis.qualityStdDev.toFixed(1)}`);
        console.log(`     一貫性: ${qualityAnalysis.consistency}`);
      }
    }
    
    // 総合一貫性評価
    if (consistencyResults.length > 0) {
      const overallConsistency = consistencyResults.reduce((sum, result) => 
        sum + (result.consistency === 'high' ? 3 : result.consistency === 'medium' ? 2 : 1), 0
      ) / (consistencyResults.length * 3);
      
      console.log(`\n🎯 総合一貫性スコア: ${(overallConsistency * 100).toFixed(1)}%`);
    }
  }

  /**
   * フェイルオーバーテスト
   */
  async testFailoverCapability(): Promise<void> {
    console.log('\n🔄 フェイルオーバー機能テスト開始');
    console.log('='.repeat(60));
    
    const testPrompt = multiRegionConfig.testPrompts[0];
    const modelId = multiRegionConfig.testModels[1]; // Nova Lite
    
    // 優先度順にリージョンを並べ替え
    const sortedRegions = [...multiRegionConfig.regions].sort((a, b) => a.priority - b.priority);
    
    console.log('📋 フェイルオーバーシーケンス:');
    sortedRegions.forEach((region, index) => {
      console.log(`   ${index + 1}. ${region.name} (${region.code}) - 優先度: ${region.priority}`);
    });
    
    // フェイルオーバーシミュレーション
    let successfulRegion: string | null = null;
    let attemptCount = 0;
    
    for (const region of sortedRegions) {
      attemptCount++;
      console.log(`\n🔄 試行 ${attemptCount}: ${region.name}`);
      
      try {
        // 利用可能性チェック
        if (!this.regionAvailability.get(region.code)) {
          console.log(`   ⏭️  スキップ: リージョン利用不可`);
          continue;
        }
        
        // モデル呼び出し試行
        const result = await this.invokeModelWithTimeout(region.code, modelId, testPrompt, 10000);
        
        console.log(`   ✅ 成功: ${region.name}`);
        console.log(`     レイテンシ: ${result.latency}ms`);
        console.log(`     品質スコア: ${result.quality}/100`);
        
        successfulRegion = region.code;
        break;
        
      } catch (error) {
        console.log(`   ❌ 失敗: ${error.message}`);
        console.log(`   🔄 次のリージョンにフェイルオーバー...`);
      }
    }
    
    if (successfulRegion) {
      const successRegion = sortedRegions.find(r => r.code === successfulRegion)!;
      console.log(`\n🎉 フェイルオーバー成功!`);
      console.log(`   最終実行リージョン: ${successRegion.name}`);
      console.log(`   試行回数: ${attemptCount}`);
    } else {
      console.log(`\n❌ フェイルオーバー失敗: 全リージョンで実行不可`);
    }
  }

  /**
   * リージョン別コスト比較テスト
   */
  async testRegionCostComparison(): Promise<void> {
    console.log('\n💰 リージョン別コスト比較テスト開始');
    console.log('='.repeat(60));
    
    const costResults: any[] = [];
    
    for (const region of multiRegionConfig.regions) {
      if (!this.regionAvailability.get(region.code)) continue;
      
      console.log(`\n📍 ${region.name} コスト分析:`);
      
      let totalCost = 0;
      let requestCount = 0;
      
      for (const modelId of multiRegionConfig.testModels) {
        try {
          // 複数回実行してコスト計算
          const executions = 5;
          let modelCost = 0;
          
          for (let i = 0; i < executions; i++) {
            const result = await this.invokeModelWithMetrics(
              region.code, 
              modelId, 
              multiRegionConfig.testPrompts[i % multiRegionConfig.testPrompts.length]
            );
            
            // コスト計算（推定）
            const estimatedCost = this.estimateCost(modelId, result.response, region.code);
            modelCost += estimatedCost;
            requestCount++;
          }
          
          totalCost += modelCost;
          const avgModelCost = modelCost / executions;
          
          console.log(`   ${modelId}:`);
          console.log(`     平均コスト/リクエスト: $${avgModelCost.toFixed(6)}`);
          
        } catch (error) {
          console.log(`   ${modelId}: ❌ コスト計算失敗`);
        }
      }
      
      if (requestCount > 0) {
        const avgCostPerRequest = totalCost / requestCount;
        
        costResults.push({
          region: region.code,
          name: region.name,
          totalCost,
          requestCount,
          avgCostPerRequest
        });
        
        console.log(`\n   📊 ${region.name} 総合コスト:`);
        console.log(`     総コスト: $${totalCost.toFixed(6)}`);
        console.log(`     平均コスト/リクエスト: $${avgCostPerRequest.toFixed(6)}`);
      }
    }
    
    // コストランキング
    costResults.sort((a, b) => a.avgCostPerRequest - b.avgCostPerRequest);
    
    console.log('\n💰 コストランキング（安い順）:');
    costResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name}: $${result.avgCostPerRequest.toFixed(6)}/req`);
    });
  }

  /**
   * モデルレイテンシ測定
   */
  private async measureModelLatency(regionCode: string, modelId: string, iterations: number): Promise<number[]> {
    const latencies: number[] = [];
    const testPrompt = multiRegionConfig.testPrompts[0];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await this.invokeModel(regionCode, modelId, testPrompt);
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
      } catch (error) {
        throw new Error(`レイテンシ測定失敗: ${error.message}`);
      }
    }
    
    return latencies;
  }

  /**
   * メトリクス付きモデル呼び出し
   */
  private async invokeModelWithMetrics(regionCode: string, modelId: string, prompt: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const response = await this.invokeModel(regionCode, modelId, prompt);
      const latency = Date.now() - startTime;
      
      // 品質評価
      const quality = this.evaluateResponseQuality(response, prompt);
      
      return {
        response,
        latency,
        quality
      };
      
    } catch (error) {
      throw new Error(`モデル呼び出し失敗: ${error.message}`);
    }
  }

  /**
   * タイムアウト付きモデル呼び出し
   */
  private async invokeModelWithTimeout(regionCode: string, modelId: string, prompt: string, timeoutMs: number): Promise<any> {
    return Promise.race([
      this.invokeModelWithMetrics(regionCode, modelId, prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('タイムアウト')), timeoutMs)
      )
    ]);
  }

  /**
   * モデル呼び出し
   */
  private async invokeModel(regionCode: string, modelId: string, prompt: string): Promise<string> {
    const client = this.clients.get(regionCode)!;
    
    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      }),
      contentType: 'application/json'
    });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text;
  }

  /**
   * 応答品質評価
   */
  private evaluateResponseQuality(response: string, prompt: string): number {
    let score = 0;
    
    // 基本的な品質指標
    if (response.length > 50) score += 25;
    if (response.includes('\n') || response.includes('。')) score += 25;
    if (response.length > 200) score += 25;
    
    // 関連性チェック
    const promptWords = prompt.toLowerCase().split(' ');
    const responseWords = response.toLowerCase().split(' ');
    const relevantWords = promptWords.filter(word => 
      responseWords.some(rWord => rWord.includes(word))
    );
    score += Math.min((relevantWords.length / promptWords.length) * 25, 25);
    
    return Math.min(score, 100);
  }

  /**
   * 品質一貫性分析
   */
  private analyzeQualityConsistency(results: any[]): any {
    const qualities = results.map(r => r.quality);
    const averageQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    
    // 標準偏差計算
    const variance = qualities.reduce((sum, q) => sum + Math.pow(q - averageQuality, 2), 0) / qualities.length;
    const qualityStdDev = Math.sqrt(variance);
    
    // 一貫性評価
    let consistency: string;
    if (qualityStdDev < 5) {
      consistency = 'high';
    } else if (qualityStdDev < 15) {
      consistency = 'medium';
    } else {
      consistency = 'low';
    }
    
    return {
      averageQuality,
      qualityStdDev,
      consistency,
      minQuality: Math.min(...qualities),
      maxQuality: Math.max(...qualities)
    };
  }

  /**
   * コスト推定
   */
  private estimateCost(modelId: string, response: string, regionCode: string): number {
    // 簡易的なコスト推定（実際のコストは異なる場合があります）
    const tokenCount = Math.ceil((response.length + 100) / 4); // 入力+出力トークン推定
    
    const costPerToken = {
      'amazon.nova-micro-v1:0': 0.000035,
      'amazon.nova-lite-v1:0': 0.00006,
      'amazon.nova-pro-v1:0': 0.0008
    };
    
    const baseCost = tokenCount * (costPerToken[modelId] || 0.0001);
    
    // リージョン別コスト調整（仮想的）
    const regionMultiplier = {
      'us-east-1': 1.0,
      'us-west-2': 1.05,
      'eu-west-1': 1.1,
      'ap-northeast-1': 1.15
    };
    
    return baseCost * (regionMultiplier[regionCode] || 1.0);
  }

  /**
   * テスト結果サマリー出力
   */
  printTestSummary(): void {
    console.log('\n📊 マルチリージョンテスト結果サマリー');
    console.log('='.repeat(70));
    
    console.log('\n🌍 リージョン可用性:');
    for (const region of multiRegionConfig.regions) {
      const available = this.regionAvailability.get(region.code);
      console.log(`   ${region.name}: ${available ? '✅ 利用可能' : '❌ 利用不可'}`);
    }
    
    const availableRegions = Array.from(this.regionAvailability.entries())
      .filter(([, available]) => available).length;
    const totalRegions = multiRegionConfig.regions.length;
    
    console.log(`\n📈 総合統計:`);
    console.log(`   テスト対象リージョン: ${totalRegions}`);
    console.log(`   利用可能リージョン: ${availableRegions}`);
    console.log(`   可用性率: ${Math.round((availableRegions / totalRegions) * 100)}%`);
    
    console.log(`\n🎯 推奨事項:`);
    if (availableRegions >= 2) {
      console.log(`   ✅ マルチリージョン構成が可能です`);
      console.log(`   ✅ フェイルオーバー機能を実装できます`);
    } else {
      console.log(`   ⚠️  追加リージョンでの利用可能性を確認してください`);
    }
    
    if (this.regionAvailability.get('us-east-1')) {
      console.log(`   ✅ メインリージョン (us-east-1) が利用可能です`);
    }
    
    if (this.regionAvailability.get('ap-northeast-1')) {
      console.log(`   ✅ 日本リージョン (ap-northeast-1) が利用可能です`);
    }
  }
}

// メイン実行関数
async function runMultiRegionTests(): Promise<void> {
  console.log('🚀 Amazon Nova系マルチリージョンテスト開始');
  console.log(`👤 プロファイル: ${multiRegionConfig.profile}`);
  console.log(`🌍 テスト対象リージョン: ${multiRegionConfig.regions.length}個`);
  console.log('');
  
  const tester = new MultiRegionTester(multiRegionConfig.profile);
  
  try {
    // 各テストの実行
    await tester.testModelAvailability();
    await tester.testRegionLatency();
    await tester.testResponseConsistency();
    await tester.testFailoverCapability();
    await tester.testRegionCostComparison();
    
    // 結果サマリー出力
    tester.printTestSummary();
    
    console.log('\n🎉 マルチリージョンテスト完了！');
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  runMultiRegionTests().catch(console.error);
}

export { MultiRegionTester, multiRegionConfig };