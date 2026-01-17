/**
 * 応答時間・負荷テスト
 * 
 * システムの応答時間とパフォーマンスを包括的にテスト
 * - 初回応答時間測定
 * - ストリーミング開始時間測定
 * - 同時ユーザー負荷テスト
 * - システムリソース監視
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { fromIni } from '@aws-sdk/credential-providers';
import { TestResult, TestConfiguration } from '../types/test-types';

/**
 * 応答時間・負荷テストクラス
 */
export class ResponseTimeTests {
  private bedrockClient: BedrockRuntimeClient;
  private cloudWatchClient: CloudWatchClient;
  private config: TestConfiguration;
  private testResults: TestResult[] = [];

  constructor(config: TestConfiguration) {
    this.config = config;
    this.bedrockClient = new BedrockRuntimeClient({
      region: config.ai.region,
      credentials: fromIni({ profile: process.env.AWS_PROFILE || 'user01' })
    });
    this.cloudWatchClient = new CloudWatchClient({
      region: config.ai.region,
      credentials: fromIni({ profile: process.env.AWS_PROFILE || 'user01' })
    });
  }

  /**
   * 全ての応答時間・負荷テストを実行
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('⚡ 応答時間・負荷テスト開始');
    this.testResults = [];

    const tests = [
      { name: '初回応答時間テスト', method: this.testInitialResponseTime.bind(this) },
      { name: 'ストリーミング開始時間テスト', method: this.testStreamingStartTime.bind(this) },
      { name: '同時ユーザー負荷テスト', method: this.testConcurrentUserLoad.bind(this) },
      { name: 'システムリソース監視テスト', method: this.testSystemResourceUsage.bind(this) },
      { name: 'レスポンス品質テスト', method: this.testResponseQuality.bind(this) },
      { name: 'エラー率テスト', method: this.testErrorRate.bind(this) }
    ];

    for (const test of tests) {
      try {
        console.log(`  🔍 実行中: ${test.name}`);
        const result = await test.method();
        this.testResults.push(result);
        
        if (result.status === 'passed') {
          console.log(`  ✅ 成功: ${test.name}`);
        } else {
          console.log(`  ❌ 失敗: ${test.name} - ${result.error}`);
        }
      } catch (error) {
        const errorResult: TestResult = {
          testName: test.name,
          category: 'Performance',
          status: 'failed',
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          priority: 'high'
        };
        this.testResults.push(errorResult);
        console.log(`  ❌ エラー: ${test.name} - ${error}`);
      }
    }

    const summary = this.generateTestSummary();
    console.log(`⚡ 応答時間・負荷テスト完了: ${summary.passed}/${summary.total} 成功`);
    
    return this.testResults;
  }  /**
 
  * 初回応答時間テスト
   */
  async testInitialResponseTime(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const responseTimeTests = [
        {
          modelId: 'amazon.nova-micro-v1:0',
          prompt: 'こんにちは。簡単な質問に答えてください。',
          expectedMaxTime: 5000 // 5秒
        },
        {
          modelId: 'amazon.nova-lite-v1:0',
          prompt: 'データ分析について説明してください。',
          expectedMaxTime: 5000 // 5秒
        },
        {
          modelId: 'amazon.nova-pro-v1:0',
          prompt: '複雑な技術的な問題について詳しく説明してください。',
          expectedMaxTime: 8000 // 8秒（Pro モデルは少し長め）
        }
      ];

      const responseResults = [];
      for (const test of responseTimeTests) {
        const measurements = [];
        
        // 各モデルで5回測定
        for (let i = 0; i < 5; i++) {
          const measurementStart = Date.now();
          
          try {
            const response = await this.invokeModel(test.modelId, test.prompt);
            const responseTime = Date.now() - measurementStart;
            
            measurements.push({
              attempt: i + 1,
              responseTime,
              success: true,
              responseLength: response.length
            });
          } catch (error) {
            const responseTime = Date.now() - measurementStart;
            measurements.push({
              attempt: i + 1,
              responseTime,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          // 測定間隔を空ける
          await this.sleep(1000);
        }

        const successfulMeasurements = measurements.filter(m => m.success);
        const averageResponseTime = successfulMeasurements.length > 0 
          ? successfulMeasurements.reduce((sum, m) => sum + m.responseTime, 0) / successfulMeasurements.length
          : 0;
        
        const maxResponseTime = successfulMeasurements.length > 0
          ? Math.max(...successfulMeasurements.map(m => m.responseTime))
          : 0;

        responseResults.push({
          modelId: test.modelId,
          expectedMaxTime: test.expectedMaxTime,
          averageResponseTime,
          maxResponseTime,
          successfulAttempts: successfulMeasurements.length,
          totalAttempts: measurements.length,
          meetsRequirement: averageResponseTime <= test.expectedMaxTime && maxResponseTime <= test.expectedMaxTime * 1.5,
          measurements
        });
      }

      const allMeetRequirements = responseResults.every(r => r.meetsRequirement);
      const overallAverageTime = responseResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / responseResults.length;

      return {
        testName: '初回応答時間テスト',
        category: 'Performance',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedModels: responseTimeTests.length,
          successfulModels: responseResults.filter(r => r.meetsRequirement).length,
          overallAverageTime,
          responseResults
        },
        metrics: {
          averageResponseTime: overallAverageTime,
          maxResponseTime: Math.max(...responseResults.map(r => r.maxResponseTime)),
          successRate: responseResults.reduce((sum, r) => sum + r.successfulAttempts, 0) / 
                      responseResults.reduce((sum, r) => sum + r.totalAttempts, 0)
        }
      };

    } catch (error) {
      return {
        testName: '初回応答時間テスト',
        category: 'Performance',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * ストリーミング開始時間テスト
   */
  async testStreamingStartTime(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const streamingTests = [
        {
          modelId: 'amazon.nova-micro-v1:0',
          prompt: 'ストリーミングテスト用の短い応答をお願いします。',
          expectedStartTime: 1000 // 1秒
        },
        {
          modelId: 'amazon.nova-lite-v1:0',
          prompt: 'ストリーミングで長めの応答を生成してください。',
          expectedStartTime: 1500 // 1.5秒
        }
      ];

      const streamingResults = [];
      for (const test of streamingTests) {
        const measurements = [];
        
        // 各モデルで3回測定
        for (let i = 0; i < 3; i++) {
          const measurementStart = Date.now();
          let firstChunkTime = 0;
          let totalChunks = 0;
          let success = false;
          
          try {
            const stream = await this.invokeModelWithStreaming(test.modelId, test.prompt);
            
            for await (const chunk of stream) {
              if (firstChunkTime === 0) {
                firstChunkTime = Date.now() - measurementStart;
              }
              totalChunks++;
            }
            
            success = true;
            
            measurements.push({
              attempt: i + 1,
              firstChunkTime,
              totalChunks,
              success
            });
          } catch (error) {
            measurements.push({
              attempt: i + 1,
              firstChunkTime: 0,
              totalChunks: 0,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          await this.sleep(1000);
        }

        const successfulMeasurements = measurements.filter(m => m.success);
        const averageStartTime = successfulMeasurements.length > 0
          ? successfulMeasurements.reduce((sum, m) => sum + m.firstChunkTime, 0) / successfulMeasurements.length
          : 0;

        streamingResults.push({
          modelId: test.modelId,
          expectedStartTime: test.expectedStartTime,
          averageStartTime,
          successfulAttempts: successfulMeasurements.length,
          totalAttempts: measurements.length,
          meetsRequirement: averageStartTime <= test.expectedStartTime,
          measurements
        });
      }

      const allMeetRequirements = streamingResults.every(r => r.meetsRequirement);
      const overallAverageStartTime = streamingResults.reduce((sum, r) => sum + r.averageStartTime, 0) / streamingResults.length;

      return {
        testName: 'ストリーミング開始時間テスト',
        category: 'Performance',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedModels: streamingTests.length,
          successfulModels: streamingResults.filter(r => r.meetsRequirement).length,
          overallAverageStartTime,
          streamingResults
        },
        metrics: {
          averageStreamingStartTime: overallAverageStartTime,
          streamingSuccessRate: streamingResults.reduce((sum, r) => sum + r.successfulAttempts, 0) / 
                               streamingResults.reduce((sum, r) => sum + r.totalAttempts, 0)
        }
      };

    } catch (error) {
      return {
        testName: 'ストリーミング開始時間テスト',
        category: 'Performance',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * 同時ユーザー負荷テスト
   */
  async testConcurrentUserLoad(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const loadTests = [
        {
          concurrentUsers: 5,
          requestsPerUser: 3,
          modelId: 'amazon.nova-micro-v1:0',
          maxResponseTimeDegradation: 0.2 // 20%以内
        },
        {
          concurrentUsers: 10,
          requestsPerUser: 2,
          modelId: 'amazon.nova-lite-v1:0',
          maxResponseTimeDegradation: 0.3 // 30%以内
        }
      ];

      const loadResults = [];
      for (const test of loadTests) {
        // ベースライン測定（単一ユーザー）
        const baselineTime = await this.measureBaselineResponseTime(test.modelId);
        
        // 同時負荷テスト実行
        const concurrentResults = await this.runConcurrentLoad(
          test.concurrentUsers,
          test.requestsPerUser,
          test.modelId
        );

        const averageLoadTime = concurrentResults.reduce((sum, r) => sum + r.responseTime, 0) / concurrentResults.length;
        const degradation = (averageLoadTime - baselineTime) / baselineTime;
        const successRate = concurrentResults.filter(r => r.success).length / concurrentResults.length;

        loadResults.push({
          concurrentUsers: test.concurrentUsers,
          requestsPerUser: test.requestsPerUser,
          modelId: test.modelId,
          baselineTime,
          averageLoadTime,
          degradation,
          maxAllowedDegradation: test.maxResponseTimeDegradation,
          successRate,
          totalRequests: concurrentResults.length,
          successfulRequests: concurrentResults.filter(r => r.success).length,
          meetsRequirement: degradation <= test.maxResponseTimeDegradation && successRate >= 0.95,
          concurrentResults
        });
      }

      const allMeetRequirements = loadResults.every(r => r.meetsRequirement);
      const overallSuccessRate = loadResults.reduce((sum, r) => sum + r.successRate, 0) / loadResults.length;

      return {
        testName: '同時ユーザー負荷テスト',
        category: 'Performance',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedScenarios: loadTests.length,
          successfulScenarios: loadResults.filter(r => r.meetsRequirement).length,
          overallSuccessRate,
          loadResults
        },
        metrics: {
          averageDegradation: loadResults.reduce((sum, r) => sum + r.degradation, 0) / loadResults.length,
          overallSuccessRate,
          maxConcurrentUsers: Math.max(...loadResults.map(r => r.concurrentUsers))
        }
      };

    } catch (error) {
      return {
        testName: '同時ユーザー負荷テスト',
        category: 'Performance',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * システムリソース監視テスト
   */
  async testSystemResourceUsage(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const resourceTests = [
        {
          testName: 'CPU使用率監視',
          metricName: 'CPUUtilization',
          namespace: 'AWS/Lambda',
          expectedMaxValue: 80 // 80%以下
        },
        {
          testName: 'メモリ使用率監視',
          metricName: 'MemoryUtilization',
          namespace: 'AWS/Lambda',
          expectedMaxValue: 85 // 85%以下
        },
        {
          testName: 'エラー率監視',
          metricName: 'Errors',
          namespace: 'AWS/Lambda',
          expectedMaxValue: 5 // 5%以下
        }
      ];

      // 負荷をかけながらリソース監視
      const monitoringPromise = this.monitorSystemResources(resourceTests);
      const loadPromise = this.generateSystemLoad();

      const [resourceResults] = await Promise.all([monitoringPromise, loadPromise]);

      const allMeetRequirements = resourceResults.every(r => r.meetsRequirement);
      const overallResourceUsage = resourceResults.reduce((sum, r) => sum + r.averageValue, 0) / resourceResults.length;

      return {
        testName: 'システムリソース監視テスト',
        category: 'Performance',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          monitoredMetrics: resourceTests.length,
          compliantMetrics: resourceResults.filter(r => r.meetsRequirement).length,
          overallResourceUsage,
          resourceResults
        },
        metrics: {
          averageResourceUsage: overallResourceUsage,
          resourceCompliance: resourceResults.filter(r => r.meetsRequirement).length / resourceTests.length
        }
      };

    } catch (error) {
      return {
        testName: 'システムリソース監視テスト',
        category: 'Performance',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }

  /**
   * レスポンス品質テスト
   */
  async testResponseQuality(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const qualityTests = [
        {
          modelId: 'amazon.nova-micro-v1:0',
          prompt: '日本語で技術的な質問に答えてください。',
          expectedMinLength: 50,
          expectedMaxTime: 5000
        },
        {
          modelId: 'amazon.nova-lite-v1:0',
          prompt: '複雑な問題について詳しく説明してください。',
          expectedMinLength: 100,
          expectedMaxTime: 6000
        }
      ];

      const qualityResults = [];
      for (const test of qualityTests) {
        const measurements = [];
        
        for (let i = 0; i < 3; i++) {
          const measurementStart = Date.now();
          
          try {
            const response = await this.invokeModel(test.modelId, test.prompt);
            const responseTime = Date.now() - measurementStart;
            
            const qualityScore = this.evaluateResponseQuality(response, test.prompt);
            
            measurements.push({
              attempt: i + 1,
              responseTime,
              responseLength: response.length,
              qualityScore,
              success: true
            });
          } catch (error) {
            measurements.push({
              attempt: i + 1,
              responseTime: Date.now() - measurementStart,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          await this.sleep(1000);
        }

        const successfulMeasurements = measurements.filter(m => m.success);
        const averageQuality = successfulMeasurements.length > 0
          ? successfulMeasurements.reduce((sum, m) => sum + m.qualityScore, 0) / successfulMeasurements.length
          : 0;
        
        const averageResponseTime = successfulMeasurements.length > 0
          ? successfulMeasurements.reduce((sum, m) => sum + m.responseTime, 0) / successfulMeasurements.length
          : 0;

        qualityResults.push({
          modelId: test.modelId,
          averageQuality,
          averageResponseTime,
          expectedMaxTime: test.expectedMaxTime,
          successfulAttempts: successfulMeasurements.length,
          meetsRequirement: averageQuality >= 0.7 && averageResponseTime <= test.expectedMaxTime,
          measurements
        });
      }

      const allMeetRequirements = qualityResults.every(r => r.meetsRequirement);
      const overallQuality = qualityResults.reduce((sum, r) => sum + r.averageQuality, 0) / qualityResults.length;

      return {
        testName: 'レスポンス品質テスト',
        category: 'Performance',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          testedModels: qualityTests.length,
          qualityCompliantModels: qualityResults.filter(r => r.meetsRequirement).length,
          overallQuality,
          qualityResults
        },
        metrics: {
          averageResponseQuality: overallQuality,
          qualityComplianceRate: qualityResults.filter(r => r.meetsRequirement).length / qualityTests.length
        }
      };

    } catch (error) {
      return {
        testName: 'レスポンス品質テスト',
        category: 'Performance',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }

  /**
   * エラー率テスト
   */
  async testErrorRate(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const errorTests = [
        {
          modelId: 'amazon.nova-micro-v1:0',
          totalRequests: 20,
          maxErrorRate: 0.05 // 5%以下
        },
        {
          modelId: 'amazon.nova-lite-v1:0',
          totalRequests: 15,
          maxErrorRate: 0.05 // 5%以下
        }
      ];

      const errorResults = [];
      for (const test of errorTests) {
        const requests = [];
        
        for (let i = 0; i < test.totalRequests; i++) {
          try {
            const response = await this.invokeModel(test.modelId, `テストリクエスト ${i + 1}`);
            requests.push({
              requestId: i + 1,
              success: true,
              responseLength: response.length
            });
          } catch (error) {
            requests.push({
              requestId: i + 1,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          // リクエスト間隔
          await this.sleep(200);
        }

        const successfulRequests = requests.filter(r => r.success).length;
        const errorRate = (test.totalRequests - successfulRequests) / test.totalRequests;

        errorResults.push({
          modelId: test.modelId,
          totalRequests: test.totalRequests,
          successfulRequests,
          errorRate,
          maxErrorRate: test.maxErrorRate,
          meetsRequirement: errorRate <= test.maxErrorRate,
          requests
        });
      }

      const allMeetRequirements = errorResults.every(r => r.meetsRequirement);
      const overallErrorRate = errorResults.reduce((sum, r) => sum + r.errorRate, 0) / errorResults.length;

      return {
        testName: 'エラー率テスト',
        category: 'Performance',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedModels: errorTests.length,
          compliantModels: errorResults.filter(r => r.meetsRequirement).length,
          overallErrorRate,
          errorResults
        },
        metrics: {
          averageErrorRate: overallErrorRate,
          errorRateCompliance: errorResults.filter(r => r.meetsRequirement).length / errorTests.length
        }
      };

    } catch (error) {
      return {
        testName: 'エラー率テスト',
        category: 'Performance',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }  /
/ ヘルパーメソッド

  /**
   * モデル呼び出し
   */
  private async invokeModel(modelId: string, prompt: string): Promise<string> {
    const requestBody = {
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }]
        }
      ],
      inferenceConfig: {
        maxTokens: 1000,
        temperature: 0.7,
        topP: 0.9
      }
    };

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(requestBody),
      contentType: 'application/json'
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.output?.message?.content?.[0]?.text || '';
  }

  /**
   * ストリーミングモデル呼び出し
   */
  private async invokeModelWithStreaming(modelId: string, prompt: string): Promise<AsyncIterable<any>> {
    const requestBody = {
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }]
        }
      ],
      inferenceConfig: {
        maxTokens: 1000,
        temperature: 0.7,
        topP: 0.9
      }
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      body: JSON.stringify(requestBody),
      contentType: 'application/json'
    });

    const response = await this.bedrockClient.send(command);
    
    return this.processStreamingResponse(response.body);
  }

  /**
   * ストリーミングレスポンス処理
   */
  private async* processStreamingResponse(stream: any): AsyncIterable<any> {
    if (stream) {
      for await (const chunk of stream) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          yield chunkData;
        }
      }
    }
  }

  /**
   * ベースライン応答時間測定
   */
  private async measureBaselineResponseTime(modelId: string): Promise<number> {
    const measurements = [];
    
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      try {
        await this.invokeModel(modelId, 'ベースライン測定用の簡単な質問です。');
        measurements.push(Date.now() - start);
      } catch (error) {
        // エラーの場合はスキップ
      }
      await this.sleep(1000);
    }

    return measurements.length > 0 
      ? measurements.reduce((sum, time) => sum + time, 0) / measurements.length
      : 5000; // デフォルト値
  }

  /**
   * 同時負荷実行
   */
  private async runConcurrentLoad(
    concurrentUsers: number,
    requestsPerUser: number,
    modelId: string
  ): Promise<Array<{ responseTime: number; success: boolean; error?: string }>> {
    const allPromises = [];
    
    for (let user = 0; user < concurrentUsers; user++) {
      for (let request = 0; request < requestsPerUser; request++) {
        const promise = this.executeSingleRequest(modelId, `ユーザー${user + 1}のリクエスト${request + 1}`);
        allPromises.push(promise);
      }
    }

    return Promise.all(allPromises);
  }

  /**
   * 単一リクエスト実行
   */
  private async executeSingleRequest(modelId: string, prompt: string): Promise<{
    responseTime: number;
    success: boolean;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      await this.invokeModel(modelId, prompt);
      return {
        responseTime: Date.now() - start,
        success: true
      };
    } catch (error) {
      return {
        responseTime: Date.now() - start,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * システムリソース監視
   */
  private async monitorSystemResources(resourceTests: any[]): Promise<any[]> {
    const results = [];
    
    for (const test of resourceTests) {
      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5分前

        const command = new GetMetricStatisticsCommand({
          Namespace: test.namespace,
          MetricName: test.metricName,
          StartTime: startTime,
          EndTime: endTime,
          Period: 60, // 1分間隔
          Statistics: ['Average', 'Maximum']
        });

        const response = await this.cloudWatchClient.send(command);
        const datapoints = response.Datapoints || [];
        
        const averageValue = datapoints.length > 0
          ? datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / datapoints.length
          : 0;
        
        const maxValue = datapoints.length > 0
          ? Math.max(...datapoints.map(dp => dp.Maximum || 0))
          : 0;

        results.push({
          testName: test.testName,
          metricName: test.metricName,
          averageValue,
          maxValue,
          expectedMaxValue: test.expectedMaxValue,
          meetsRequirement: maxValue <= test.expectedMaxValue,
          datapoints: datapoints.length
        });
      } catch (error) {
        results.push({
          testName: test.testName,
          metricName: test.metricName,
          averageValue: 0,
          maxValue: 0,
          expectedMaxValue: test.expectedMaxValue,
          meetsRequirement: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * システム負荷生成
   */
  private async generateSystemLoad(): Promise<void> {
    const loadPromises = [];
    
    // 軽い負荷を5分間生成
    for (let i = 0; i < 10; i++) {
      const promise = this.invokeModel('amazon.nova-micro-v1:0', `負荷生成用リクエスト ${i + 1}`);
      loadPromises.push(promise);
    }

    try {
      await Promise.all(loadPromises);
    } catch (error) {
      // 負荷生成中のエラーは無視
    }
  }

  /**
   * レスポンス品質評価
   */
  private evaluateResponseQuality(response: string, prompt: string): number {
    let score = 0;
    
    // 基本的な品質チェック
    if (response.length > 10) score += 0.2;
    if (response.includes('。') || response.includes('.')) score += 0.2;
    if (response.length > 50) score += 0.2;
    if (!response.includes('エラー') && !response.includes('error')) score += 0.2;
    if (response.length < 1000) score += 0.2; // 適切な長さ
    
    return Math.min(score, 1.0);
  }

  /**
   * スリープ関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * テスト結果サマリー生成
   */
  private generateTestSummary(): { total: number; passed: number; failed: number } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = total - passed;
    
    return { total, passed, failed };
  }
}

export default ResponseTimeTests;