/**
 * スケーラビリティテスト
 * 
 * システムのスケーラビリティとパフォーマンス限界を包括的にテスト
 * - 段階的負荷増加テスト
 * - リソース使用量監視
 * - 自動スケーリングテスト
 * - 性能劣化ポイント特定
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { ApplicationAutoScalingClient, DescribeScalingActivitiesCommand } from '@aws-sdk/client-application-auto-scaling';
import { fromIni } from '@aws-sdk/credential-providers';
import { TestResult, TestConfiguration } from '../types/test-types';

/**
 * スケーラビリティテストクラス
 */
export class ScalabilityTests {
  private bedrockClient: BedrockRuntimeClient;
  private cloudWatchClient: CloudWatchClient;
  private autoScalingClient: ApplicationAutoScalingClient;
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
    this.autoScalingClient = new ApplicationAutoScalingClient({
      region: config.ai.region,
      credentials: fromIni({ profile: process.env.AWS_PROFILE || 'user01' })
    });
  }

  /**
   * 全てのスケーラビリティテストを実行
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('📈 スケーラビリティテスト開始');
    this.testResults = [];

    const tests = [
      { name: '段階的負荷増加テスト', method: this.testGradualLoadIncrease.bind(this) },
      { name: 'リソース使用量監視テスト', method: this.testResourceMonitoring.bind(this) },
      { name: '自動スケーリングテスト', method: this.testAutoScaling.bind(this) },
      { name: '性能劣化ポイント特定テスト', method: this.testPerformanceDegradation.bind(this) },
      { name: 'スループットテスト', method: this.testThroughput.bind(this) },
      { name: 'メモリ使用量テスト', method: this.testMemoryUsage.bind(this) }
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
          category: 'Scalability',
          status: 'failed',
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          priority: 'medium'
        };
        this.testResults.push(errorResult);
        console.log(`  ❌ エラー: ${test.name} - ${error}`);
      }
    }

    const summary = this.generateTestSummary();
    console.log(`📈 スケーラビリティテスト完了: ${summary.passed}/${summary.total} 成功`);
    
    return this.testResults;
  } 
 /**
   * 段階的負荷増加テスト
   */
  async testGradualLoadIncrease(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const loadSteps = [
        { users: 1, duration: 30000, expectedMaxResponseTime: 3000 },   // 30秒間、1ユーザー
        { users: 5, duration: 60000, expectedMaxResponseTime: 4000 },   // 1分間、5ユーザー
        { users: 10, duration: 60000, expectedMaxResponseTime: 5000 },  // 1分間、10ユーザー
        { users: 20, duration: 90000, expectedMaxResponseTime: 7000 },  // 1.5分間、20ユーザー
        { users: 50, duration: 120000, expectedMaxResponseTime: 10000 } // 2分間、50ユーザー
      ];

      const stepResults = [];
      for (const step of loadSteps) {
        console.log(`    📊 負荷ステップ: ${step.users}ユーザー、${step.duration/1000}秒間`);
        
        const stepStart = Date.now();
        const stepResult = await this.executeLoadStep(step.users, step.duration);
        
        const averageResponseTime = stepResult.reduce((sum, r) => sum + r.responseTime, 0) / stepResult.length;
        const maxResponseTime = Math.max(...stepResult.map(r => r.responseTime));
        const successRate = stepResult.filter(r => r.success).length / stepResult.length;
        const throughput = stepResult.length / (step.duration / 1000); // requests per second

        stepResults.push({
          users: step.users,
          duration: step.duration,
          totalRequests: stepResult.length,
          successfulRequests: stepResult.filter(r => r.success).length,
          averageResponseTime,
          maxResponseTime,
          expectedMaxResponseTime: step.expectedMaxResponseTime,
          successRate,
          throughput,
          meetsRequirement: maxResponseTime <= step.expectedMaxResponseTime && successRate >= 0.95,
          stepResult
        });

        // ステップ間の休憩
        await this.sleep(10000);
      }

      const allStepsMeetRequirements = stepResults.every(r => r.meetsRequirement);
      const overallThroughput = stepResults.reduce((sum, r) => sum + r.throughput, 0) / stepResults.length;

      return {
        testName: '段階的負荷増加テスト',
        category: 'Scalability',
        status: allStepsMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          loadSteps: loadSteps.length,
          successfulSteps: stepResults.filter(r => r.meetsRequirement).length,
          overallThroughput,
          maxUsers: Math.max(...stepResults.map(r => r.users)),
          stepResults
        },
        metrics: {
          maxSupportedUsers: stepResults.filter(r => r.meetsRequirement).length > 0 
            ? Math.max(...stepResults.filter(r => r.meetsRequirement).map(r => r.users))
            : 0,
          averageThroughput: overallThroughput,
          scalabilityScore: stepResults.filter(r => r.meetsRequirement).length / loadSteps.length
        }
      };

    } catch (error) {
      return {
        testName: '段階的負荷増加テスト',
        category: 'Scalability',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * リソース使用量監視テスト
   */
  async testResourceMonitoring(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const monitoringTests = [
        {
          resourceType: 'CPU',
          metricName: 'CPUUtilization',
          namespace: 'AWS/Lambda',
          thresholds: { warning: 70, critical: 85 }
        },
        {
          resourceType: 'Memory',
          metricName: 'MemoryUtilization',
          namespace: 'AWS/Lambda',
          thresholds: { warning: 75, critical: 90 }
        },
        {
          resourceType: 'Duration',
          metricName: 'Duration',
          namespace: 'AWS/Lambda',
          thresholds: { warning: 25000, critical: 29000 } // milliseconds
        },
        {
          resourceType: 'Invocations',
          metricName: 'Invocations',
          namespace: 'AWS/Lambda',
          thresholds: { warning: 1000, critical: 2000 }
        }
      ];

      // 負荷をかけながらリソース監視
      const monitoringPromise = this.monitorResourcesOverTime(monitoringTests, 300000); // 5分間
      const loadPromise = this.generateContinuousLoad(300000); // 5分間の負荷

      const [resourceResults] = await Promise.all([monitoringPromise, loadPromise]);

      const allResourcesHealthy = resourceResults.every(r => r.status === 'healthy');
      const overallResourceUsage = resourceResults.reduce((sum, r) => sum + r.averageUsage, 0) / resourceResults.length;

      return {
        testName: 'リソース使用量監視テスト',
        category: 'Scalability',
        status: allResourcesHealthy ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          monitoredResources: monitoringTests.length,
          healthyResources: resourceResults.filter(r => r.status === 'healthy').length,
          overallResourceUsage,
          resourceResults
        },
        metrics: {
          resourceHealthScore: resourceResults.filter(r => r.status === 'healthy').length / monitoringTests.length,
          averageResourceUsage: overallResourceUsage,
          peakResourceUsage: Math.max(...resourceResults.map(r => r.peakUsage))
        }
      };

    } catch (error) {
      return {
        testName: 'リソース使用量監視テスト',
        category: 'Scalability',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * 自動スケーリングテスト
   */
  async testAutoScaling(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const scalingTests = [
        {
          testName: 'スケールアウトテスト',
          initialLoad: 5,
          targetLoad: 25,
          expectedScalingTime: 120000, // 2分以内
          expectedInstances: 3
        },
        {
          testName: 'スケールインテスト',
          initialLoad: 25,
          targetLoad: 2,
          expectedScalingTime: 180000, // 3分以内
          expectedInstances: 1
        }
      ];

      const scalingResults = [];
      for (const test of scalingTests) {
        console.log(`    🔄 実行中: ${test.testName}`);
        
        // 初期負荷設定
        await this.setLoadLevel(test.initialLoad);
        await this.sleep(30000); // 30秒待機
        
        const scalingStart = Date.now();
        
        // ターゲット負荷に変更
        await this.setLoadLevel(test.targetLoad);
        
        // スケーリング活動を監視
        const scalingActivity = await this.monitorScalingActivity(test.expectedScalingTime);
        const scalingTime = Date.now() - scalingStart;
        
        scalingResults.push({
          testName: test.testName,
          initialLoad: test.initialLoad,
          targetLoad: test.targetLoad,
          scalingTime,
          expectedScalingTime: test.expectedScalingTime,
          scalingActivity,
          meetsRequirement: scalingTime <= test.expectedScalingTime && scalingActivity.successful
        });

        // テスト間の休憩
        await this.sleep(60000);
      }

      const allScalingSuccessful = scalingResults.every(r => r.meetsRequirement);
      const averageScalingTime = scalingResults.reduce((sum, r) => sum + r.scalingTime, 0) / scalingResults.length;

      return {
        testName: '自動スケーリングテスト',
        category: 'Scalability',
        status: allScalingSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          scalingTests: scalingTests.length,
          successfulScaling: scalingResults.filter(r => r.meetsRequirement).length,
          averageScalingTime,
          scalingResults
        },
        metrics: {
          scalingSuccessRate: scalingResults.filter(r => r.meetsRequirement).length / scalingTests.length,
          averageScalingTime,
          scalingEfficiency: scalingResults.filter(r => r.meetsRequirement).length / scalingResults.length
        }
      };

    } catch (error) {
      return {
        testName: '自動スケーリングテスト',
        category: 'Scalability',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }

  /**
   * 性能劣化ポイント特定テスト
   */
  async testPerformanceDegradation(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const degradationTests = [
        { users: 1, expectedResponseTime: 2000 },
        { users: 10, expectedResponseTime: 3000 },
        { users: 25, expectedResponseTime: 5000 },
        { users: 50, expectedResponseTime: 8000 },
        { users: 100, expectedResponseTime: 15000 }
      ];

      const degradationResults = [];
      let degradationPoint = null;

      for (const test of degradationTests) {
        console.log(`    📉 負荷レベル: ${test.users}ユーザー`);
        
        const testResult = await this.measurePerformanceAtLoad(test.users);
        const degradationRatio = testResult.averageResponseTime / degradationTests[0].expectedResponseTime;
        
        degradationResults.push({
          users: test.users,
          averageResponseTime: testResult.averageResponseTime,
          expectedResponseTime: test.expectedResponseTime,
          degradationRatio,
          successRate: testResult.successRate,
          throughput: testResult.throughput,
          meetsRequirement: testResult.averageResponseTime <= test.expectedResponseTime
        });

        // 劣化ポイントの特定
        if (!degradationPoint && degradationRatio > 2.0) {
          degradationPoint = {
            users: test.users,
            degradationRatio,
            responseTime: testResult.averageResponseTime
          };
        }

        await this.sleep(30000); // テスト間隔
      }

      const acceptablePerformance = degradationResults.filter(r => r.meetsRequirement).length;
      const maxSupportedUsers = acceptablePerformance > 0 
        ? Math.max(...degradationResults.filter(r => r.meetsRequirement).map(r => r.users))
        : 0;

      return {
        testName: '性能劣化ポイント特定テスト',
        category: 'Scalability',
        status: maxSupportedUsers >= 25 ? 'passed' : 'failed', // 25ユーザー以上をサポート
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedLoadLevels: degradationTests.length,
          acceptablePerformanceLevels: acceptablePerformance,
          maxSupportedUsers,
          degradationPoint,
          degradationResults
        },
        metrics: {
          maxSupportedUsers,
          degradationThreshold: degradationPoint?.users || maxSupportedUsers,
          performanceStability: acceptablePerformance / degradationTests.length
        }
      };

    } catch (error) {
      return {
        testName: '性能劣化ポイント特定テスト',
        category: 'Scalability',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * スループットテスト
   */
  async testThroughput(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const throughputTests = [
        {
          testName: '低負荷スループット',
          concurrentUsers: 5,
          duration: 60000, // 1分
          expectedMinThroughput: 2 // requests per second
        },
        {
          testName: '中負荷スループット',
          concurrentUsers: 15,
          duration: 120000, // 2分
          expectedMinThroughput: 5 // requests per second
        },
        {
          testName: '高負荷スループット',
          concurrentUsers: 30,
          duration: 180000, // 3分
          expectedMinThroughput: 8 // requests per second
        }
      ];

      const throughputResults = [];
      for (const test of throughputTests) {
        console.log(`    🚀 実行中: ${test.testName}`);
        
        const testStart = Date.now();
        const requests = await this.executeThroughputTest(test.concurrentUsers, test.duration);
        
        const successfulRequests = requests.filter(r => r.success).length;
        const actualDuration = (Date.now() - testStart) / 1000; // seconds
        const throughput = successfulRequests / actualDuration;
        const errorRate = (requests.length - successfulRequests) / requests.length;

        throughputResults.push({
          testName: test.testName,
          concurrentUsers: test.concurrentUsers,
          duration: test.duration,
          totalRequests: requests.length,
          successfulRequests,
          throughput,
          expectedMinThroughput: test.expectedMinThroughput,
          errorRate,
          meetsRequirement: throughput >= test.expectedMinThroughput && errorRate <= 0.05
        });

        await this.sleep(30000); // テスト間隔
      }

      const allMeetRequirements = throughputResults.every(r => r.meetsRequirement);
      const averageThroughput = throughputResults.reduce((sum, r) => sum + r.throughput, 0) / throughputResults.length;

      return {
        testName: 'スループットテスト',
        category: 'Scalability',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          throughputTests: throughputTests.length,
          successfulTests: throughputResults.filter(r => r.meetsRequirement).length,
          averageThroughput,
          maxThroughput: Math.max(...throughputResults.map(r => r.throughput)),
          throughputResults
        },
        metrics: {
          averageThroughput,
          maxThroughput: Math.max(...throughputResults.map(r => r.throughput)),
          throughputEfficiency: throughputResults.filter(r => r.meetsRequirement).length / throughputTests.length
        }
      };

    } catch (error) {
      return {
        testName: 'スループットテスト',
        category: 'Scalability',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * メモリ使用量テスト
   */
  async testMemoryUsage(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const memoryTests = [
        {
          testName: '小さなリクエスト',
          requestSize: 'small',
          prompt: '簡単な質問です。',
          expectedMaxMemory: 512 // MB
        },
        {
          testName: '中程度のリクエスト',
          requestSize: 'medium',
          prompt: '詳細な説明を含む中程度の複雑さの質問です。技術的な内容について教えてください。',
          expectedMaxMemory: 1024 // MB
        },
        {
          testName: '大きなリクエスト',
          requestSize: 'large',
          prompt: '非常に詳細で複雑な技術的な質問です。' + 'A'.repeat(1000), // 長いプロンプト
          expectedMaxMemory: 2048 // MB
        }
      ];

      const memoryResults = [];
      for (const test of memoryTests) {
        console.log(`    💾 実行中: ${test.testName}`);
        
        const memoryUsage = await this.measureMemoryUsage(test.prompt);
        
        memoryResults.push({
          testName: test.testName,
          requestSize: test.requestSize,
          averageMemoryUsage: memoryUsage.average,
          peakMemoryUsage: memoryUsage.peak,
          expectedMaxMemory: test.expectedMaxMemory,
          meetsRequirement: memoryUsage.peak <= test.expectedMaxMemory
        });

        await this.sleep(10000); // テスト間隔
      }

      const allMeetRequirements = memoryResults.every(r => r.meetsRequirement);
      const averageMemoryUsage = memoryResults.reduce((sum, r) => sum + r.averageMemoryUsage, 0) / memoryResults.length;

      return {
        testName: 'メモリ使用量テスト',
        category: 'Scalability',
        status: allMeetRequirements ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          memoryTests: memoryTests.length,
          compliantTests: memoryResults.filter(r => r.meetsRequirement).length,
          averageMemoryUsage,
          peakMemoryUsage: Math.max(...memoryResults.map(r => r.peakMemoryUsage)),
          memoryResults
        },
        metrics: {
          averageMemoryUsage,
          peakMemoryUsage: Math.max(...memoryResults.map(r => r.peakMemoryUsage)),
          memoryEfficiency: memoryResults.filter(r => r.meetsRequirement).length / memoryTests.length
        }
      };

    } catch (error) {
      return {
        testName: 'メモリ使用量テスト',
        category: 'Scalability',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }  // ヘルパーメ
ソッド

  /**
   * 負荷ステップ実行
   */
  private async executeLoadStep(users: number, duration: number): Promise<Array<{
    responseTime: number;
    success: boolean;
    error?: string;
  }>> {
    const results = [];
    const endTime = Date.now() + duration;
    const promises = [];

    // 指定されたユーザー数で並行リクエストを実行
    for (let i = 0; i < users; i++) {
      const userPromise = this.simulateUser(i + 1, endTime);
      promises.push(userPromise);
    }

    const userResults = await Promise.all(promises);
    
    // 全ユーザーの結果を統合
    for (const userResult of userResults) {
      results.push(...userResult);
    }

    return results;
  }

  /**
   * ユーザーシミュレーション
   */
  private async simulateUser(userId: number, endTime: number): Promise<Array<{
    responseTime: number;
    success: boolean;
    error?: string;
  }>> {
    const results = [];
    let requestCount = 0;

    while (Date.now() < endTime) {
      requestCount++;
      const start = Date.now();
      
      try {
        await this.invokeModel('amazon.nova-micro-v1:0', `ユーザー${userId}のリクエスト${requestCount}`);
        results.push({
          responseTime: Date.now() - start,
          success: true
        });
      } catch (error) {
        results.push({
          responseTime: Date.now() - start,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // リクエスト間隔（1-3秒のランダム）
      const interval = Math.random() * 2000 + 1000;
      await this.sleep(interval);
    }

    return results;
  }

  /**
   * 時間経過でのリソース監視
   */
  private async monitorResourcesOverTime(monitoringTests: any[], duration: number): Promise<any[]> {
    const results = [];
    const monitoringInterval = 30000; // 30秒間隔
    const monitoringCount = Math.floor(duration / monitoringInterval);

    for (const test of monitoringTests) {
      const measurements = [];
      
      for (let i = 0; i < monitoringCount; i++) {
        try {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - monitoringInterval);

          const command = new GetMetricStatisticsCommand({
            Namespace: test.namespace,
            MetricName: test.metricName,
            StartTime: startTime,
            EndTime: endTime,
            Period: 60,
            Statistics: ['Average', 'Maximum']
          });

          const response = await this.cloudWatchClient.send(command);
          const datapoints = response.Datapoints || [];
          
          if (datapoints.length > 0) {
            const avgValue = datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / datapoints.length;
            const maxValue = Math.max(...datapoints.map(dp => dp.Maximum || 0));
            
            measurements.push({
              timestamp: new Date(),
              average: avgValue,
              maximum: maxValue
            });
          }
        } catch (error) {
          measurements.push({
            timestamp: new Date(),
            average: 0,
            maximum: 0,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        await this.sleep(monitoringInterval);
      }

      const averageUsage = measurements.length > 0
        ? measurements.reduce((sum, m) => sum + m.average, 0) / measurements.length
        : 0;
      
      const peakUsage = measurements.length > 0
        ? Math.max(...measurements.map(m => m.maximum))
        : 0;

      let status = 'healthy';
      if (peakUsage > test.thresholds.critical) {
        status = 'critical';
      } else if (peakUsage > test.thresholds.warning) {
        status = 'warning';
      }

      results.push({
        resourceType: test.resourceType,
        averageUsage,
        peakUsage,
        thresholds: test.thresholds,
        status,
        measurements
      });
    }

    return results;
  }

  /**
   * 継続的負荷生成
   */
  private async generateContinuousLoad(duration: number): Promise<void> {
    const endTime = Date.now() + duration;
    const promises = [];

    while (Date.now() < endTime) {
      // 5つの並行リクエストを生成
      for (let i = 0; i < 5; i++) {
        const promise = this.invokeModel('amazon.nova-micro-v1:0', `継続負荷リクエスト ${Date.now()}`);
        promises.push(promise);
      }

      await this.sleep(5000); // 5秒間隔
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      // 負荷生成中のエラーは無視
    }
  }

  /**
   * 負荷レベル設定
   */
  private async setLoadLevel(targetUsers: number): Promise<void> {
    // 実際の実装では、負荷生成システムに負荷レベルを設定
    // この例では、指定されたユーザー数でリクエストを開始
    console.log(`    🎯 負荷レベルを${targetUsers}ユーザーに設定`);
    
    // 模擬的な負荷設定
    const promises = [];
    for (let i = 0; i < targetUsers; i++) {
      const promise = this.invokeModel('amazon.nova-micro-v1:0', `負荷設定リクエスト ${i + 1}`);
      promises.push(promise);
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      // 負荷設定中のエラーは無視
    }
  }

  /**
   * スケーリング活動監視
   */
  private async monitorScalingActivity(timeout: number): Promise<{
    successful: boolean;
    activities: any[];
    scalingTime: number;
  }> {
    const startTime = Date.now();
    const activities = [];
    
    try {
      // スケーリング活動を監視（簡易実装）
      while (Date.now() - startTime < timeout) {
        try {
          const command = new DescribeScalingActivitiesCommand({
            ServiceNamespace: 'lambda',
            MaxResults: 10
          });

          const response = await this.autoScalingClient.send(command);
          const recentActivities = response.ScalingActivities || [];
          
          activities.push(...recentActivities);
          
          // スケーリング完了を確認
          const completedActivity = recentActivities.find(activity => 
            activity.StatusCode === 'Successful' && 
            new Date(activity.StartTime).getTime() > startTime
          );
          
          if (completedActivity) {
            return {
              successful: true,
              activities,
              scalingTime: Date.now() - startTime
            };
          }
        } catch (error) {
          // 監視エラーは記録して続行
        }

        await this.sleep(10000); // 10秒間隔で確認
      }

      return {
        successful: false,
        activities,
        scalingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        successful: false,
        activities,
        scalingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 負荷レベルでのパフォーマンス測定
   */
  private async measurePerformanceAtLoad(users: number): Promise<{
    averageResponseTime: number;
    successRate: number;
    throughput: number;
  }> {
    const testDuration = 60000; // 1分間
    const results = await this.executeLoadStep(users, testDuration);
    
    const successfulResults = results.filter(r => r.success);
    const averageResponseTime = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length
      : 0;
    
    const successRate = results.length > 0 ? successfulResults.length / results.length : 0;
    const throughput = results.length / (testDuration / 1000); // requests per second

    return {
      averageResponseTime,
      successRate,
      throughput
    };
  }

  /**
   * スループットテスト実行
   */
  private async executeThroughputTest(concurrentUsers: number, duration: number): Promise<Array<{
    success: boolean;
    responseTime: number;
    error?: string;
  }>> {
    const results = [];
    const endTime = Date.now() + duration;
    const promises = [];

    // 並行ユーザーを開始
    for (let i = 0; i < concurrentUsers; i++) {
      const userPromise = this.runThroughputUser(i + 1, endTime);
      promises.push(userPromise);
    }

    const userResults = await Promise.all(promises);
    
    // 全ユーザーの結果を統合
    for (const userResult of userResults) {
      results.push(...userResult);
    }

    return results;
  }

  /**
   * スループットテスト用ユーザー実行
   */
  private async runThroughputUser(userId: number, endTime: number): Promise<Array<{
    success: boolean;
    responseTime: number;
    error?: string;
  }>> {
    const results = [];
    let requestCount = 0;

    while (Date.now() < endTime) {
      requestCount++;
      const start = Date.now();
      
      try {
        await this.invokeModel('amazon.nova-micro-v1:0', `スループットテスト ユーザー${userId} リクエスト${requestCount}`);
        results.push({
          success: true,
          responseTime: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          responseTime: Date.now() - start,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // 短い間隔でリクエスト（スループット最大化）
      await this.sleep(500);
    }

    return results;
  }

  /**
   * メモリ使用量測定
   */
  private async measureMemoryUsage(prompt: string): Promise<{
    average: number;
    peak: number;
  }> {
    const measurements = [];
    
    // 複数回実行してメモリ使用量を測定
    for (let i = 0; i < 5; i++) {
      try {
        // メモリ使用量測定の開始
        const beforeMemory = process.memoryUsage();
        
        await this.invokeModel('amazon.nova-lite-v1:0', prompt);
        
        // メモリ使用量測定の終了
        const afterMemory = process.memoryUsage();
        const memoryDiff = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024; // MB
        
        measurements.push(Math.max(memoryDiff, 0));
      } catch (error) {
        // エラーの場合は0として記録
        measurements.push(0);
      }
      
      await this.sleep(2000);
    }

    const validMeasurements = measurements.filter(m => m > 0);
    const average = validMeasurements.length > 0
      ? validMeasurements.reduce((sum, m) => sum + m, 0) / validMeasurements.length
      : 0;
    
    const peak = validMeasurements.length > 0 ? Math.max(...validMeasurements) : 0;

    return { average, peak };
  }

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
        maxTokens: 500,
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

export default ScalabilityTests;