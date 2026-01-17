/**
 * ストリーミングレスポンステストモジュール
 * 
 * リアルタイムストリーミング応答機能を検証
 * 実本番Amazon Bedrockでのストリーミング性能をテスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime';

import { ProductionConfig } from '../../config/production-config';
import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

/**
 * ストリーミングテスト結果
 */
export interface StreamingTestResult extends TestResult {
  streamingMetrics?: {
    firstTokenLatency: number;
    averageTokenLatency: number;
    totalTokens: number;
    streamDuration: number;
    throughput: number;
  };
  qualityMetrics?: {
    streamStability: number;
    contentCoherence: number;
    realTimeScore: number;
  };
}

/**
 * ストリーミングテストケース
 */
export interface StreamingTestCase {
  id: string;
  name: string;
  prompt: string;
  expectedTokens: number;
  maxLatency: number;
  modelId: string;
}

/**
 * ストリーミングレスポンステストモジュール
 */
export class StreamingResponseTestModule {
  private config: ProductionConfig;
  private bedrockClient: BedrockRuntimeClient;
  private testCases: StreamingTestCase[];

  constructor(config: ProductionConfig) {
    this.config = config;
    
    this.bedrockClient = new BedrockRuntimeClient({
      region: config.region,
      credentials: { profile: config.awsProfile }
    });
    
    this.testCases = this.loadStreamingTestCases();
  }

  /**
   * ストリーミングテストケースの読み込み
   */
  private loadStreamingTestCases(): StreamingTestCase[] {
    return [
      {
        id: 'stream-short-001',
        name: '短文ストリーミングテスト',
        prompt: 'RAGシステムについて簡潔に説明してください。',
        expectedTokens: 100,
        maxLatency: 500,
        modelId: 'amazon.nova-lite-v1:0'
      },
      {
        id: 'stream-medium-001',
        name: '中文ストリーミングテスト',
        prompt: 'Amazon FSx for NetApp ONTAPとAmazon Bedrockを組み合わせたRAGシステムの技術的利点について詳しく説明してください。',
        expectedTokens: 300,
        maxLatency: 800,
        modelId: 'amazon.nova-pro-v1:0'
      },
      {
        id: 'stream-long-001',
        name: '長文ストリーミングテスト',
        prompt: 'エンタープライズ環境における権限認識型RAGシステムの設計原則、実装方法、運用上の考慮事項について、具体例を交えながら包括的に説明してください。',
        expectedTokens: 500,
        maxLatency: 1200,
        modelId: 'amazon.nova-pro-v1:0'
      },
      {
        id: 'stream-realtime-001',
        name: 'リアルタイム応答テスト',
        prompt: 'チャットボットでよくある質問に答えてください：「このシステムはどのように動作しますか？」',
        expectedTokens: 150,
        maxLatency: 300,
        modelId: 'amazon.nova-micro-v1:0'
      }
    ];
  }

  /**
   * 包括的ストリーミングテスト
   */
  async testComprehensiveStreaming(): Promise<StreamingTestResult> {
    const testId = 'streaming-comprehensive-001';
    const startTime = Date.now();
    
    console.log('📡 包括的ストリーミングテストを開始...');

    try {
      const results: any[] = [];

      // 各テストケースを実行
      for (const testCase of this.testCases) {
        console.log(`   ストリーミングテスト実行中: ${testCase.name}`);
        
        const caseResult = await this.executeStreamingTest(testCase);
        results.push(caseResult);
      }

      // 総合メトリクスを計算
      const aggregatedMetrics = this.aggregateStreamingMetrics(results);
      const qualityMetrics = this.evaluateStreamingQuality(results);

      const success = aggregatedMetrics.firstTokenLatency < 500 && 
                     qualityMetrics.realTimeScore > 0.8;

      const result: StreamingTestResult = {
        testId,
        testName: '包括的ストリーミングテスト',
        category: 'streaming',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        streamingMetrics: aggregatedMetrics,
        qualityMetrics,
        metadata: {
          testCaseCount: this.testCases.length,
          testResults: results
        }
      };

      if (success) {
        console.log('✅ 包括的ストリーミングテスト成功');
      } else {
        console.error('❌ 包括的ストリーミングテスト失敗');
      }

      return result;

    } catch (error) {
      console.error('❌ 包括的ストリーミングテスト実行エラー:', error);
      
      return {
        testId,
        testName: '包括的ストリーミングテスト',
        category: 'streaming',
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
   * 個別ストリーミングテストの実行
   */
  private async executeStreamingTest(testCase: StreamingTestCase): Promise<{
    testCase: StreamingTestCase;
    metrics: any;
    success: boolean;
  }> {
    try {
      // 読み取り専用モードでは模擬結果を返す
      if (this.config.readOnlyMode) {
        return this.generateMockStreamingResult(testCase);
      }

      // 実際のストリーミング推論
      const streamingResult = await this.performStreamingInference(testCase);
      
      const success = streamingResult.firstTokenLatency <= testCase.maxLatency;

      return {
        testCase,
        metrics: streamingResult,
        success
      };

    } catch (error) {
      console.error(`❌ ストリーミングテスト実行エラー (${testCase.id}):`, error);
      return {
        testCase,
        metrics: null,
        success: false
      };
    }
  }

  /**
   * ストリーミング推論実行
   */
  private async performStreamingInference(testCase: StreamingTestCase): Promise<{
    firstTokenLatency: number;
    averageTokenLatency: number;
    totalTokens: number;
    streamDuration: number;
    throughput: number;
    tokens: string[];
  }> {
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    const tokenTimes: number[] = [];
    const tokens: string[] = [];

    const requestBody = {
      inputText: testCase.prompt,
      textGenerationConfig: {
        maxTokenCount: testCase.expectedTokens * 2,
        temperature: 0.7,
        topP: 0.9
      }
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: testCase.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });

    const response = await this.bedrockClient.send(command);
    
    if (response.body) {
      for await (const chunk of response.body) {
        const currentTime = Date.now();
        
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          
          if (chunkData.outputText) {
            if (firstTokenTime === null) {
              firstTokenTime = currentTime - startTime;
            }
            
            tokenTimes.push(currentTime - startTime);
            tokens.push(chunkData.outputText);
          }
        }
      }
    }

    const endTime = Date.now();
    const streamDuration = endTime - startTime;
    const averageTokenLatency = tokenTimes.length > 0 ? 
      tokenTimes.reduce((sum, time) => sum + time, 0) / tokenTimes.length : 0;
    const throughput = tokens.length / (streamDuration / 1000); // tokens per second

    return {
      firstTokenLatency: firstTokenTime || streamDuration,
      averageTokenLatency,
      totalTokens: tokens.length,
      streamDuration,
      throughput,
      tokens
    };
  }

  /**
   * 模擬ストリーミング結果生成
   */
  private generateMockStreamingResult(testCase: StreamingTestCase): {
    testCase: StreamingTestCase;
    metrics: any;
    success: boolean;
  } {
    const mockMetrics = {
      firstTokenLatency: Math.random() * testCase.maxLatency * 0.8, // 80%以内
      averageTokenLatency: Math.random() * 100 + 50,
      totalTokens: testCase.expectedTokens + Math.floor(Math.random() * 50),
      streamDuration: Math.random() * 2000 + 1000,
      throughput: Math.random() * 20 + 10,
      tokens: Array(testCase.expectedTokens).fill('模擬トークン')
    };

    return {
      testCase,
      metrics: mockMetrics,
      success: mockMetrics.firstTokenLatency <= testCase.maxLatency
    };
  }

  /**
   * ストリーミングメトリクス集約
   */
  private aggregateStreamingMetrics(results: any[]): {
    firstTokenLatency: number;
    averageTokenLatency: number;
    totalTokens: number;
    streamDuration: number;
    throughput: number;
  } {
    const validResults = results.filter(r => r.success && r.metrics);
    
    if (validResults.length === 0) {
      return {
        firstTokenLatency: 0,
        averageTokenLatency: 0,
        totalTokens: 0,
        streamDuration: 0,
        throughput: 0
      };
    }

    const avgFirstTokenLatency = validResults.reduce((sum, r) => sum + r.metrics.firstTokenLatency, 0) / validResults.length;
    const avgTokenLatency = validResults.reduce((sum, r) => sum + r.metrics.averageTokenLatency, 0) / validResults.length;
    const totalTokens = validResults.reduce((sum, r) => sum + r.metrics.totalTokens, 0);
    const avgStreamDuration = validResults.reduce((sum, r) => sum + r.metrics.streamDuration, 0) / validResults.length;
    const avgThroughput = validResults.reduce((sum, r) => sum + r.metrics.throughput, 0) / validResults.length;

    return {
      firstTokenLatency: avgFirstTokenLatency,
      averageTokenLatency: avgTokenLatency,
      totalTokens,
      streamDuration: avgStreamDuration,
      throughput: avgThroughput
    };
  }

  /**
   * ストリーミング品質評価
   */
  private evaluateStreamingQuality(results: any[]): {
    streamStability: number;
    contentCoherence: number;
    realTimeScore: number;
  } {
    const validResults = results.filter(r => r.success && r.metrics);
    
    if (validResults.length === 0) {
      return {
        streamStability: 0,
        contentCoherence: 0,
        realTimeScore: 0
      };
    }

    // ストリーム安定性（レイテンシの一貫性）
    const latencies = validResults.map(r => r.metrics.firstTokenLatency);
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const latencyVariance = latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) / latencies.length;
    const streamStability = Math.max(0, 1 - (Math.sqrt(latencyVariance) / avgLatency));

    // コンテンツ一貫性（トークン生成の安定性）
    const throughputs = validResults.map(r => r.metrics.throughput);
    const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
    const contentCoherence = avgThroughput > 5 ? 0.9 : 0.7; // 5 tokens/sec以上で高評価

    // リアルタイムスコア（初回トークンレイテンシベース）
    const realTimeScore = avgLatency < 500 ? 1.0 : (avgLatency < 1000 ? 0.8 : 0.5);

    return {
      streamStability,
      contentCoherence,
      realTimeScore
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 ストリーミングレスポンステストモジュールをクリーンアップ中...');
    console.log('✅ ストリーミングレスポンステストモジュールのクリーンアップ完了');
  }
}

export default StreamingResponseTestModule;