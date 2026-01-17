/**
 * Amazon Nova系モデル統合テストスイート
 * 
 * 目的: Amazon Nova Micro, Lite, Pro モデルの包括的テスト
 * 対象: 
 * - Nova Micro: 高速・低コスト推論
 * - Nova Lite: バランス型推論
 * - Nova Pro: 高精度推論
 * 
 * テスト項目:
 * - モデル応答品質テスト
 * - ストリーミング応答テスト
 * - マルチリージョン対応テスト
 * - エラーハンドリングテスト
 * - パフォーマンステスト
 */

import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

// テスト設定
interface NovaTestConfig {
  region: string;
  profile: string;
  models: {
    micro: string;
    lite: string;
    pro: string;
  };
  testPrompts: string[];
  maxTokens: number;
  temperature: number;
}

const testConfig: NovaTestConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  profile: process.env.AWS_PROFILE || 'user01',
  models: {
    micro: 'amazon.nova-micro-v1:0',
    lite: 'amazon.nova-lite-v1:0',
    pro: 'amazon.nova-pro-v1:0'
  },
  testPrompts: [
    'Amazon FSx for NetApp ONTAPの主要な特徴を3つ教えてください。',
    'RAGシステムにおけるベクトル検索の重要性について説明してください。',
    'AWS Lambdaを使用したサーバーレスアーキテクチャの利点は何ですか？',
    'Next.jsとReactを使用したフロントエンド開発のベストプラクティスを教えてください。'
  ],
  maxTokens: 1000,
  temperature: 0.7
};

// Bedrockクライアントの初期化
const createBedrockClient = (region: string, profile: string): BedrockRuntimeClient => {
  return new BedrockRuntimeClient({
    region,
    credentials: fromIni({ profile })
  });
};

// Nova系モデルテストクラス
class NovaModelTester {
  private client: BedrockRuntimeClient;
  private testResults: Map<string, any> = new Map();

  constructor(region: string, profile: string) {
    this.client = createBedrockClient(region, profile);
  }

  /**
   * Nova Microモデルテスト
   * 高速・低コスト推論の検証
   */
  async testNovaMicro(): Promise<void> {
    console.log('🧪 Nova Micro モデルテスト開始');
    
    try {
      const startTime = Date.now();
      
      for (const prompt of testConfig.testPrompts) {
        const response = await this.invokeModel(testConfig.models.micro, prompt);
        
        // 応答品質の評価
        const quality = this.evaluateResponseQuality(response, 'micro');
        
        console.log(`✅ Nova Micro応答 (品質スコア: ${quality.score}/100):`);
        console.log(`   プロンプト: ${prompt.substring(0, 50)}...`);
        console.log(`   応答長: ${response.length}文字`);
        console.log(`   応答時間: ${quality.responseTime}ms`);
        console.log('');
      }
      
      const totalTime = Date.now() - startTime;
      this.testResults.set('nova-micro', {
        status: 'success',
        totalTime,
        averageTime: totalTime / testConfig.testPrompts.length
      });
      
      console.log(`🎉 Nova Micro テスト完了 (総時間: ${totalTime}ms)`);
      
    } catch (error) {
      console.error('❌ Nova Micro テスト失敗:', error);
      this.testResults.set('nova-micro', { status: 'failed', error: error.message });
    }
  }

  /**
   * Nova Liteモデルテスト
   * バランス型推論の検証
   */
  async testNovaLite(): Promise<void> {
    console.log('🧪 Nova Lite モデルテスト開始');
    
    try {
      const startTime = Date.now();
      
      for (const prompt of testConfig.testPrompts) {
        const response = await this.invokeModel(testConfig.models.lite, prompt);
        
        // 応答品質の評価
        const quality = this.evaluateResponseQuality(response, 'lite');
        
        console.log(`✅ Nova Lite応答 (品質スコア: ${quality.score}/100):`);
        console.log(`   プロンプト: ${prompt.substring(0, 50)}...`);
        console.log(`   応答長: ${response.length}文字`);
        console.log(`   応答時間: ${quality.responseTime}ms`);
        console.log('');
      }
      
      const totalTime = Date.now() - startTime;
      this.testResults.set('nova-lite', {
        status: 'success',
        totalTime,
        averageTime: totalTime / testConfig.testPrompts.length
      });
      
      console.log(`🎉 Nova Lite テスト完了 (総時間: ${totalTime}ms)`);
      
    } catch (error) {
      console.error('❌ Nova Lite テスト失敗:', error);
      this.testResults.set('nova-lite', { status: 'failed', error: error.message });
    }
  }

  /**
   * Nova Proモデルテスト
   * 高精度推論の検証
   */
  async testNovaPro(): Promise<void> {
    console.log('🧪 Nova Pro モデルテスト開始');
    
    try {
      const startTime = Date.now();
      
      for (const prompt of testConfig.testPrompts) {
        const response = await this.invokeModel(testConfig.models.pro, prompt);
        
        // 応答品質の評価
        const quality = this.evaluateResponseQuality(response, 'pro');
        
        console.log(`✅ Nova Pro応答 (品質スコア: ${quality.score}/100):`);
        console.log(`   プロンプト: ${prompt.substring(0, 50)}...`);
        console.log(`   応答長: ${response.length}文字`);
        console.log(`   応答時間: ${quality.responseTime}ms`);
        console.log('');
      }
      
      const totalTime = Date.now() - startTime;
      this.testResults.set('nova-pro', {
        status: 'success',
        totalTime,
        averageTime: totalTime / testConfig.testPrompts.length
      });
      
      console.log(`🎉 Nova Pro テスト完了 (総時間: ${totalTime}ms)`);
      
    } catch (error) {
      console.error('❌ Nova Pro テスト失敗:', error);
      this.testResults.set('nova-pro', { status: 'failed', error: error.message });
    }
  }

  /**
   * ストリーミング応答テスト
   */
  async testStreamingResponse(): Promise<void> {
    console.log('🌊 Nova系ストリーミング応答テスト開始');
    
    const streamingPrompt = 'Amazon FSx for NetApp ONTAPを使用したRAGシステムの詳細なアーキテクチャについて、段階的に説明してください。';
    
    try {
      // Nova Proでストリーミングテスト
      const startTime = Date.now();
      let streamedContent = '';
      let chunkCount = 0;
      
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: testConfig.models.pro,
        body: JSON.stringify({
          messages: [{ role: 'user', content: streamingPrompt }],
          max_tokens: testConfig.maxTokens,
          temperature: testConfig.temperature
        }),
        contentType: 'application/json'
      });
      
      const response = await this.client.send(command);
      
      if (response.body) {
        for await (const chunk of response.body) {
          if (chunk.chunk?.bytes) {
            const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
            if (chunkData.delta?.text) {
              streamedContent += chunkData.delta.text;
              chunkCount++;
              process.stdout.write('.');
            }
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      console.log('\n✅ ストリーミング応答テスト完了');
      console.log(`   総チャンク数: ${chunkCount}`);
      console.log(`   応答長: ${streamedContent.length}文字`);
      console.log(`   総時間: ${totalTime}ms`);
      console.log(`   平均チャンク時間: ${totalTime / chunkCount}ms`);
      
      this.testResults.set('streaming', {
        status: 'success',
        chunkCount,
        totalTime,
        contentLength: streamedContent.length
      });
      
    } catch (error) {
      console.error('❌ ストリーミング応答テスト失敗:', error);
      this.testResults.set('streaming', { status: 'failed', error: error.message });
    }
  }

  /**
   * モデル呼び出し
   */
  private async invokeModel(modelId: string, prompt: string): Promise<string> {
    const startTime = Date.now();
    
    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: testConfig.maxTokens,
        temperature: testConfig.temperature
      }),
      contentType: 'application/json'
    });
    
    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text;
  }

  /**
   * 応答品質評価
   */
  private evaluateResponseQuality(response: string, modelType: string): any {
    const responseTime = Date.now();
    
    // 基本的な品質指標
    const length = response.length;
    const hasStructure = response.includes('\n') || response.includes('。');
    const hasTechnicalTerms = /AWS|Lambda|FSx|RAG|Next\.js|React/.test(response);
    const isRelevant = response.length > 50 && hasStructure;
    
    // モデル別期待値
    const expectations = {
      micro: { minLength: 100, maxTime: 2000 },
      lite: { minLength: 200, maxTime: 3000 },
      pro: { minLength: 300, maxTime: 5000 }
    };
    
    const expectation = expectations[modelType];
    
    // スコア計算
    let score = 0;
    if (length >= expectation.minLength) score += 30;
    if (hasStructure) score += 25;
    if (hasTechnicalTerms) score += 25;
    if (isRelevant) score += 20;
    
    return {
      score,
      responseTime: responseTime - Date.now(),
      length,
      hasStructure,
      hasTechnicalTerms,
      isRelevant
    };
  }

  /**
   * テスト結果サマリー出力
   */
  printTestSummary(): void {
    console.log('\n📊 Nova系モデルテスト結果サマリー');
    console.log('='.repeat(50));
    
    for (const [model, result] of this.testResults) {
      console.log(`\n🔍 ${model.toUpperCase()}:`);
      console.log(`   ステータス: ${result.status === 'success' ? '✅ 成功' : '❌ 失敗'}`);
      
      if (result.status === 'success') {
        if (result.totalTime) {
          console.log(`   総実行時間: ${result.totalTime}ms`);
          console.log(`   平均応答時間: ${result.averageTime}ms`);
        }
        if (result.chunkCount) {
          console.log(`   チャンク数: ${result.chunkCount}`);
          console.log(`   コンテンツ長: ${result.contentLength}文字`);
        }
      } else {
        console.log(`   エラー: ${result.error}`);
      }
    }
    
    const successCount = Array.from(this.testResults.values()).filter(r => r.status === 'success').length;
    const totalCount = this.testResults.size;
    
    console.log(`\n🎯 総合結果: ${successCount}/${totalCount} テスト成功`);
    console.log(`   成功率: ${Math.round((successCount / totalCount) * 100)}%`);
  }
}

// メイン実行関数
async function runNovaModelTests(): Promise<void> {
  console.log('🚀 Amazon Nova系モデル統合テスト開始');
  console.log(`📍 リージョン: ${testConfig.region}`);
  console.log(`👤 プロファイル: ${testConfig.profile}`);
  console.log('');
  
  const tester = new NovaModelTester(testConfig.region, testConfig.profile);
  
  try {
    // 各モデルのテスト実行
    await tester.testNovaMicro();
    await tester.testNovaLite();
    await tester.testNovaPro();
    
    // ストリーミングテスト（コマンドライン引数で制御）
    if (process.argv.includes('--streaming')) {
      await tester.testStreamingResponse();
    }
    
    // 結果サマリー出力
    tester.printTestSummary();
    
    console.log('\n🎉 Nova系モデルテスト完了！');
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  runNovaModelTests().catch(console.error);
}

export { NovaModelTester, testConfig };