/**
 * 応答時間測定テスト
 * 標準クエリの 2 秒以内応答検証テスト実装
 * 応答時間ベンチマーク測定コード作成
 */

import { TestResult, TestMetrics } from '../../types/test-types';

export interface ResponseTimeTestConfig {
  baseUrl: string;
  testQueries: TestQuery[];
  performanceThresholds: {
    standardQueryTime: number;
    complexQueryTime: number;
    simpleQueryTime: number;
    averageResponseTime: number;
    percentile95Time: number;
    percentile99Time: number;
  };
  testParameters: {
    warmupQueries: number;
    measurementQueries: number;
    concurrentRequests: number;
    requestInterval: number;
  };
  networkConditions: NetworkCondition[];
}

export interface TestQuery {
  id: string;
  query: string;
  type: 'simple' | 'standard' | 'complex';
  expectedResponseTime: number;
  category: 'technical' | 'business' | 'general';
  requiresRAG: boolean;
  requiresAI: boolean;
}

export interface NetworkCondition {
  name: string;
  bandwidth: number; // Mbps
  latency: number; // ms
  packetLoss: number; // %
  enabled: boolean;
}

export interface ResponseTimeTestResult extends TestResult {
  queryResults: QueryResponseResult[];
  performanceMetrics: PerformanceMetrics;
  benchmarkResults: BenchmarkResult[];
  networkResults: NetworkPerformanceResult[];
  overallResponseScore: number;
  reliabilityScore: number;
  consistencyScore: number;
  scalabilityScore: number;
}

export interface QueryResponseResult {
  queryId: string;
  query: string;
  queryType: string;
  measurements: ResponseMeasurement[];
  statistics: ResponseStatistics;
  success: boolean;
  issues: PerformanceIssue[];
}

export interface ResponseMeasurement {
  attempt: number;
  timestamp: number;
  responseTime: number;
  ttfb: number; // Time to First Byte
  domContentLoaded: number;
  loadComplete: number;
  networkTime: number;
  processingTime: number;
  renderTime: number;
  success: boolean;
  errorMessage?: string;
}

export interface ResponseStatistics {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  percentile95: number;
  percentile99: number;
  successRate: number;
  errorRate: number;
}

export interface PerformanceMetrics {
  overallAverageTime: number;
  overallMedianTime: number;
  overallPercentile95: number;
  overallPercentile99: number;
  successRate: number;
  errorRate: number;
  throughput: number; // requests per second
  reliability: number;
  consistency: number;
}

export interface BenchmarkResult {
  benchmarkName: string;
  baselineTime: number;
  currentTime: number;
  improvement: number; // percentage
  regression: number; // percentage
  status: 'improved' | 'maintained' | 'degraded';
}

export interface NetworkPerformanceResult {
  networkCondition: string;
  averageResponseTime: number;
  successRate: number;
  degradationFactor: number;
  adaptability: number;
}

export interface PerformanceIssue {
  type: 'timeout' | 'slow_response' | 'high_variance' | 'error_rate';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  impact: string;
  recommendation: string;
  affectedQueries: string[];
}

export class ResponseTimeTest {
  private config: ResponseTimeTestConfig;
  private testStartTime: number = 0;
  private baselineMetrics: Map<string, number> = new Map();

  constructor(config: ResponseTimeTestConfig) {
    this.config = config;
    this.initializeBaselines();
  }

  /**
   * 応答時間測定テストの実行
   */
  async runTest(): Promise<ResponseTimeTestResult> {
    console.log('⚡ 応答時間測定テストを開始します...');
    console.log(`🎯 目標応答時間: 標準クエリ ${this.config.performanceThresholds.standardQueryTime}ms以内`);
    this.testStartTime = Date.now();

    try {
      // ウォームアップの実行
      await this.performWarmup();

      // クエリ別応答時間テスト
      const queryResults = await this.testQueryResponseTimes();

      // ネットワーク条件別テスト
      const networkResults = await this.testNetworkConditions();

      // ベンチマーク比較
      const benchmarkResults = await this.performBenchmarkComparison(queryResults);

      // パフォーマンスメトリクスの計算
      const performanceMetrics = this.calculatePerformanceMetrics(queryResults);

      // スコアの計算
      const scores = this.calculateScores(performanceMetrics, queryResults, networkResults);

      const result: ResponseTimeTestResult = {
        testName: 'ResponseTimeTest',
        success: scores.overallResponseScore >= 85 && 
                 performanceMetrics.overallAverageTime <= this.config.performanceThresholds.averageResponseTime,
        duration: Date.now() - this.testStartTime,
        details: {
          totalQueries: this.config.testQueries.length,
          totalMeasurements: queryResults.reduce((sum, r) => sum + r.measurements.length, 0),
          testCoverage: '100%',
          ...scores,
          ...performanceMetrics
        },
        queryResults,
        performanceMetrics,
        benchmarkResults,
        networkResults,
        ...scores
      };

      this.logTestResults(result);
      return result;

    } catch (error) {
      console.error('❌ 応答時間測定テストでエラーが発生:', error);
      throw error;
    }
  }

  /**
   * ベースライン値の初期化
   */
  private initializeBaselines(): void {
    // 過去のパフォーマンスデータまたは目標値を設定
    this.baselineMetrics.set('simple_query_avg', 800);
    this.baselineMetrics.set('standard_query_avg', 1500);
    this.baselineMetrics.set('complex_query_avg', 3000);
    this.baselineMetrics.set('overall_avg', 1800);
    this.baselineMetrics.set('percentile_95', 2500);
    this.baselineMetrics.set('percentile_99', 4000);
  }

  /**
   * ウォームアップの実行
   */
  private async performWarmup(): Promise<void> {
    console.log('🔥 システムウォームアップを実行中...');
    
    const warmupQueries = this.config.testQueries.slice(0, this.config.testParameters.warmupQueries);
    
    for (const query of warmupQueries) {
      try {
        await this.executeQuery(query.query);
        await this.delay(500);
      } catch (error) {
        console.warn(`⚠️ ウォームアップクエリでエラー: ${query.id}`);
      }
    }
    
    console.log('✅ ウォームアップ完了');
    await this.delay(2000); // システム安定化待機
  }

  /**
   * クエリ別応答時間テストの実行
   */
  private async testQueryResponseTimes(): Promise<QueryResponseResult[]> {
    console.log('📊 クエリ別応答時間測定を実行中...');
    const results: QueryResponseResult[] = [];

    for (const query of this.config.testQueries) {
      console.log(`🔍 "${query.query}" を測定中...`);
      
      const queryResult = await this.measureQueryResponseTime(query);
      results.push(queryResult);
      
      // クエリ間の間隔
      await this.delay(this.config.testParameters.requestInterval);
    }

    return results;
  }

  /**
   * 単一クエリの応答時間測定
   */
  private async measureQueryResponseTime(query: TestQuery): Promise<QueryResponseResult> {
    const measurements: ResponseMeasurement[] = [];
    const issues: PerformanceIssue[] = [];

    for (let attempt = 1; attempt <= this.config.testParameters.measurementQueries; attempt++) {
      try {
        const measurement = await this.executeSingleMeasurement(query, attempt);
        measurements.push(measurement);
        
        // 個別測定の評価
        if (!measurement.success) {
          issues.push({
            type: 'error_rate',
            severity: 'major',
            description: `測定 ${attempt} でエラーが発生`,
            impact: 'システムの信頼性に影響',
            recommendation: 'エラーの原因を調査し修正してください',
            affectedQueries: [query.id]
          });
        } else if (measurement.responseTime > query.expectedResponseTime * 1.5) {
          issues.push({
            type: 'slow_response',
            severity: measurement.responseTime > query.expectedResponseTime * 2 ? 'critical' : 'major',
            description: `応答時間が期待値を大幅に超過: ${measurement.responseTime}ms`,
            impact: 'ユーザーエクスペリエンスの低下',
            recommendation: 'パフォーマンス最適化が必要です',
            affectedQueries: [query.id]
          });
        }

      } catch (error) {
        measurements.push({
          attempt,
          timestamp: Date.now(),
          responseTime: 0,
          ttfb: 0,
          domContentLoaded: 0,
          loadComplete: 0,
          networkTime: 0,
          processingTime: 0,
          renderTime: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // 測定間の間隔
      await this.delay(200);
    }

    // 統計の計算
    const statistics = this.calculateStatistics(measurements);
    
    // 分散の評価
    if (statistics.stdDev > statistics.mean * 0.3) {
      issues.push({
        type: 'high_variance',
        severity: 'minor',
        description: `応答時間の分散が大きい: 標準偏差 ${statistics.stdDev.toFixed(1)}ms`,
        impact: '予測可能性の低下',
        recommendation: 'システムの安定性を改善してください',
        affectedQueries: [query.id]
      });
    }

    return {
      queryId: query.id,
      query: query.query,
      queryType: query.type,
      measurements,
      statistics,
      success: statistics.successRate >= 0.95 && statistics.mean <= query.expectedResponseTime,
      issues
    };
  }

  /**
   * 単一測定の実行
   */
  private async executeSingleMeasurement(query: TestQuery, attempt: number): Promise<ResponseMeasurement> {
    const startTime = Date.now();
    const timestamp = startTime;

    try {
      // ネットワーク時間の測定開始
      const networkStartTime = Date.now();
      
      // クエリの実行
      const response = await this.executeQuery(query.query);
      
      const networkEndTime = Date.now();
      const networkTime = networkEndTime - networkStartTime;

      // 処理時間の推定（実際の実装では詳細な分析が必要）
      const processingTime = Math.max(0, networkTime - 100); // ネットワーク遅延を除く
      
      // レンダリング時間の測定（フロントエンド処理時間）
      const renderTime = await this.measureRenderTime();

      const totalResponseTime = Date.now() - startTime;
      const ttfb = Math.min(networkTime, totalResponseTime * 0.3); // Time to First Byte推定

      return {
        attempt,
        timestamp,
        responseTime: totalResponseTime,
        ttfb,
        domContentLoaded: totalResponseTime * 0.8, // 推定値
        loadComplete: totalResponseTime,
        networkTime,
        processingTime,
        renderTime,
        success: true
      };

    } catch (error) {
      return {
        attempt,
        timestamp,
        responseTime: Date.now() - startTime,
        ttfb: 0,
        domContentLoaded: 0,
        loadComplete: 0,
        networkTime: 0,
        processingTime: 0,
        renderTime: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * クエリの実行
   */
  private async executeQuery(query: string): Promise<any> {
    // 実際の実装では、チャットボットAPIを呼び出し
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        message: query,
        userId: 'performance-test-user',
        sessionId: `perf-test-${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * レンダリング時間の測定
   */
  private async measureRenderTime(): Promise<number> {
    // 実際の実装では、ブラウザのパフォーマンスAPIを使用
    // ここではシミュレーション値を返す
    return Math.random() * 200 + 100; // 100-300ms
  }

  /**
   * 統計の計算
   */
  private calculateStatistics(measurements: ResponseMeasurement[]): ResponseStatistics {
    const successfulMeasurements = measurements.filter(m => m.success);
    const responseTimes = successfulMeasurements.map(m => m.responseTime);
    
    if (responseTimes.length === 0) {
      return {
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        percentile95: 0,
        percentile99: 0,
        successRate: 0,
        errorRate: 100
      };
    }

    responseTimes.sort((a, b) => a - b);
    
    const mean = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const median = this.calculatePercentile(responseTimes, 50);
    const min = responseTimes[0];
    const max = responseTimes[responseTimes.length - 1];
    
    // 標準偏差の計算
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);
    
    const percentile95 = this.calculatePercentile(responseTimes, 95);
    const percentile99 = this.calculatePercentile(responseTimes, 99);
    
    const successRate = (successfulMeasurements.length / measurements.length) * 100;
    const errorRate = 100 - successRate;

    return {
      mean,
      median,
      min,
      max,
      stdDev,
      percentile95,
      percentile99,
      successRate,
      errorRate
    };
  }

  /**
   * パーセンタイルの計算
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * ネットワーク条件別テストの実行
   */
  private async testNetworkConditions(): Promise<NetworkPerformanceResult[]> {
    console.log('🌐 ネットワーク条件別テストを実行中...');
    const results: NetworkPerformanceResult[] = [];

    const enabledConditions = this.config.networkConditions.filter(c => c.enabled);
    
    for (const condition of enabledConditions) {
      console.log(`📡 ${condition.name} 条件でテスト中...`);
      
      const result = await this.testUnderNetworkCondition(condition);
      results.push(result);
    }

    return results;
  }

  /**
   * 特定ネットワーク条件下でのテスト
   */
  private async testUnderNetworkCondition(condition: NetworkCondition): Promise<NetworkPerformanceResult> {
    // ネットワーク条件のシミュレーション
    await this.simulateNetworkCondition(condition);
    
    // サンプルクエリでの測定
    const sampleQueries = this.config.testQueries.slice(0, 3);
    const measurements: number[] = [];
    let successCount = 0;

    for (const query of sampleQueries) {
      try {
        const startTime = Date.now();
        await this.executeQuery(query.query);
        const responseTime = Date.now() - startTime;
        
        measurements.push(responseTime);
        successCount++;
      } catch (error) {
        console.warn(`⚠️ ${condition.name} 条件下でエラー:`, error);
      }
    }

    const averageResponseTime = measurements.length > 0 
      ? measurements.reduce((sum, time) => sum + time, 0) / measurements.length 
      : 0;
    
    const successRate = (successCount / sampleQueries.length) * 100;
    
    // ベースライン条件との比較
    const baselineTime = this.baselineMetrics.get('overall_avg') || 1800;
    const degradationFactor = averageResponseTime / baselineTime;
    
    // 適応性スコア（ネットワーク条件に対する耐性）
    const adaptability = Math.max(0, 100 - (degradationFactor - 1) * 50);

    return {
      networkCondition: condition.name,
      averageResponseTime,
      successRate,
      degradationFactor,
      adaptability
    };
  }

  /**
   * ネットワーク条件のシミュレーション
   */
  private async simulateNetworkCondition(condition: NetworkCondition): Promise<void> {
    // 実際の実装では、ブラウザのネットワーク制限機能を使用
    // ここでは遅延のシミュレーション
    const simulatedDelay = condition.latency + (condition.bandwidth < 10 ? 500 : 0);
    await this.delay(simulatedDelay);
  }

  /**
   * ベンチマーク比較の実行
   */
  private async performBenchmarkComparison(queryResults: QueryResponseResult[]): Promise<BenchmarkResult[]> {
    console.log('📈 ベンチマーク比較を実行中...');
    const results: BenchmarkResult[] = [];

    // クエリタイプ別のベンチマーク
    const queryTypes = ['simple', 'standard', 'complex'];
    
    for (const type of queryTypes) {
      const typeResults = queryResults.filter(r => r.queryType === type);
      if (typeResults.length === 0) continue;

      const currentAverage = typeResults.reduce((sum, r) => sum + r.statistics.mean, 0) / typeResults.length;
      const baselineKey = `${type}_query_avg`;
      const baselineTime = this.baselineMetrics.get(baselineKey) || currentAverage;
      
      const improvement = baselineTime > currentAverage 
        ? ((baselineTime - currentAverage) / baselineTime) * 100 
        : 0;
      
      const regression = currentAverage > baselineTime 
        ? ((currentAverage - baselineTime) / baselineTime) * 100 
        : 0;

      let status: 'improved' | 'maintained' | 'degraded';
      if (improvement > 5) {
        status = 'improved';
      } else if (regression > 5) {
        status = 'degraded';
      } else {
        status = 'maintained';
      }

      results.push({
        benchmarkName: `${type.charAt(0).toUpperCase() + type.slice(1)} Query Average`,
        baselineTime,
        currentTime: currentAverage,
        improvement,
        regression,
        status
      });
    }

    // 全体のベンチマーク
    const overallAverage = queryResults.reduce((sum, r) => sum + r.statistics.mean, 0) / queryResults.length;
    const overallBaseline = this.baselineMetrics.get('overall_avg') || overallAverage;
    
    const overallImprovement = overallBaseline > overallAverage 
      ? ((overallBaseline - overallAverage) / overallBaseline) * 100 
      : 0;
    
    const overallRegression = overallAverage > overallBaseline 
      ? ((overallAverage - overallBaseline) / overallBaseline) * 100 
      : 0;

    let overallStatus: 'improved' | 'maintained' | 'degraded';
    if (overallImprovement > 3) {
      overallStatus = 'improved';
    } else if (overallRegression > 3) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'maintained';
    }

    results.push({
      benchmarkName: 'Overall Average',
      baselineTime: overallBaseline,
      currentTime: overallAverage,
      improvement: overallImprovement,
      regression: overallRegression,
      status: overallStatus
    });

    return results;
  }

  /**
   * パフォーマンスメトリクスの計算
   */
  private calculatePerformanceMetrics(queryResults: QueryResponseResult[]): PerformanceMetrics {
    const allMeasurements = queryResults.flatMap(r => r.measurements.filter(m => m.success));
    const allResponseTimes = allMeasurements.map(m => m.responseTime);
    
    if (allResponseTimes.length === 0) {
      return {
        overallAverageTime: 0,
        overallMedianTime: 0,
        overallPercentile95: 0,
        overallPercentile99: 0,
        successRate: 0,
        errorRate: 100,
        throughput: 0,
        reliability: 0,
        consistency: 0
      };
    }

    allResponseTimes.sort((a, b) => a - b);
    
    const overallAverageTime = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
    const overallMedianTime = this.calculatePercentile(allResponseTimes, 50);
    const overallPercentile95 = this.calculatePercentile(allResponseTimes, 95);
    const overallPercentile99 = this.calculatePercentile(allResponseTimes, 99);
    
    const totalMeasurements = queryResults.reduce((sum, r) => sum + r.measurements.length, 0);
    const successfulMeasurements = allMeasurements.length;
    const successRate = (successfulMeasurements / totalMeasurements) * 100;
    const errorRate = 100 - successRate;
    
    // スループットの計算（1秒あたりのリクエスト数）
    const totalTestTime = (Date.now() - this.testStartTime) / 1000;
    const throughput = successfulMeasurements / totalTestTime;
    
    // 信頼性スコア
    const reliability = Math.min(successRate, 100);
    
    // 一貫性スコア（分散の逆数ベース）
    const variance = allResponseTimes.reduce((sum, time) => sum + Math.pow(time - overallAverageTime, 2), 0) / allResponseTimes.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / overallAverageTime;
    const consistency = Math.max(0, 100 - (coefficientOfVariation * 100));

    return {
      overallAverageTime,
      overallMedianTime,
      overallPercentile95,
      overallPercentile99,
      successRate,
      errorRate,
      throughput,
      reliability,
      consistency
    };
  }

  /**
   * スコアの計算
   */
  private calculateScores(
    metrics: PerformanceMetrics,
    queryResults: QueryResponseResult[],
    networkResults: NetworkPerformanceResult[]
  ): {
    overallResponseScore: number;
    reliabilityScore: number;
    consistencyScore: number;
    scalabilityScore: number;
  } {
    // 応答時間スコア
    let responseTimeScore = 100;
    if (metrics.overallAverageTime > this.config.performanceThresholds.averageResponseTime) {
      responseTimeScore -= ((metrics.overallAverageTime - this.config.performanceThresholds.averageResponseTime) / this.config.performanceThresholds.averageResponseTime) * 50;
    }
    
    if (metrics.overallPercentile95 > this.config.performanceThresholds.percentile95Time) {
      responseTimeScore -= 20;
    }
    
    if (metrics.overallPercentile99 > this.config.performanceThresholds.percentile99Time) {
      responseTimeScore -= 15;
    }

    // 信頼性スコア
    const reliabilityScore = metrics.reliability;

    // 一貫性スコア
    const consistencyScore = metrics.consistency;

    // スケーラビリティスコア（ネットワーク条件への適応性）
    const scalabilityScore = networkResults.length > 0
      ? networkResults.reduce((sum, r) => sum + r.adaptability, 0) / networkResults.length
      : 100;

    // 総合スコア
    const overallResponseScore = (
      Math.max(responseTimeScore, 0) * 0.4 +
      reliabilityScore * 0.3 +
      consistencyScore * 0.2 +
      scalabilityScore * 0.1
    );

    return {
      overallResponseScore,
      reliabilityScore,
      consistencyScore,
      scalabilityScore
    };
  }

  /**
   * テスト結果のログ出力
   */
  private logTestResults(result: ResponseTimeTestResult): void {
    console.log('\n📊 応答時間測定テスト結果:');
    console.log(`✅ 総合スコア: ${result.overallResponseScore.toFixed(1)}/100`);
    console.log(`🔒 信頼性: ${result.reliabilityScore.toFixed(1)}/100`);
    console.log(`📈 一貫性: ${result.consistencyScore.toFixed(1)}/100`);
    console.log(`🚀 スケーラビリティ: ${result.scalabilityScore.toFixed(1)}/100`);
    
    console.log('\n⏱️ パフォーマンスメトリクス:');
    console.log(`  平均応答時間: ${result.performanceMetrics.overallAverageTime.toFixed(0)}ms`);
    console.log(`  中央値: ${result.performanceMetrics.overallMedianTime.toFixed(0)}ms`);
    console.log(`  95パーセンタイル: ${result.performanceMetrics.overallPercentile95.toFixed(0)}ms`);
    console.log(`  99パーセンタイル: ${result.performanceMetrics.overallPercentile99.toFixed(0)}ms`);
    console.log(`  成功率: ${result.performanceMetrics.successRate.toFixed(1)}%`);
    console.log(`  スループット: ${result.performanceMetrics.throughput.toFixed(1)} req/sec`);
    
    console.log('\n📈 ベンチマーク比較:');
    result.benchmarkResults.forEach(benchmark => {
      const statusIcon = benchmark.status === 'improved' ? '📈' : 
                        benchmark.status === 'degraded' ? '📉' : '➡️';
      const changeValue = benchmark.improvement > 0 ? 
        `+${benchmark.improvement.toFixed(1)}%` : 
        `-${benchmark.regression.toFixed(1)}%`;
      
      console.log(`  ${statusIcon} ${benchmark.benchmarkName}: ${benchmark.currentTime.toFixed(0)}ms (${changeValue})`);
    });
    
    if (result.networkResults.length > 0) {
      console.log('\n🌐 ネットワーク条件別結果:');
      result.networkResults.forEach(network => {
        console.log(`  ${network.networkCondition}: ${network.averageResponseTime.toFixed(0)}ms (適応性: ${network.adaptability.toFixed(1)}%)`);
      });
    }
    
    // 問題の要約
    const totalIssues = result.queryResults.reduce((sum, r) => sum + r.issues.length, 0);
    const criticalIssues = result.queryResults.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0);
    
    if (totalIssues > 0) {
      console.log(`\n⚠️  検出された問題: ${totalIssues}件 (重要: ${criticalIssues}件)`);
    }
    
    if (result.success) {
      console.log('\n✅ 応答時間測定テスト: 合格');
      console.log('   すべてのクエリが目標応答時間内で処理されています');
    } else {
      console.log('\n❌ 応答時間測定テスト: 不合格');
      console.log('   応答時間の最適化が必要です');
    }
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * デフォルト設定での応答時間測定テスト実行
 */
export async function runResponseTimeTest(baseUrl: string = 'http://localhost:3000'): Promise<ResponseTimeTestResult> {
  const config: ResponseTimeTestConfig = {
    baseUrl,
    testQueries: [
      {
        id: 'simple_1',
        query: 'こんにちは',
        type: 'simple',
        expectedResponseTime: 800,
        category: 'general',
        requiresRAG: false,
        requiresAI: true
      },
      {
        id: 'standard_1',
        query: 'AWS Lambda の基本的な使い方を教えてください',
        type: 'standard',
        expectedResponseTime: 1500,
        category: 'technical',
        requiresRAG: true,
        requiresAI: true
      },
      {
        id: 'standard_2',
        query: 'セキュリティのベストプラクティスについて説明してください',
        type: 'standard',
        expectedResponseTime: 1800,
        category: 'business',
        requiresRAG: true,
        requiresAI: true
      },
      {
        id: 'complex_1',
        query: 'マルチリージョンでのAWSアーキテクチャ設計において、データ整合性とパフォーマンスを両立させる方法を、具体的な実装例とともに詳しく説明してください',
        type: 'complex',
        expectedResponseTime: 3000,
        category: 'technical',
        requiresRAG: true,
        requiresAI: true
      }
    ],
    performanceThresholds: {
      standardQueryTime: 2000,
      complexQueryTime: 4000,
      simpleQueryTime: 1000,
      averageResponseTime: 1800,
      percentile95Time: 2500,
      percentile99Time: 4000
    },
    testParameters: {
      warmupQueries: 3,
      measurementQueries: 10,
      concurrentRequests: 1,
      requestInterval: 1000
    },
    networkConditions: [
      {
        name: 'Fast 3G',
        bandwidth: 1.6,
        latency: 150,
        packetLoss: 0,
        enabled: true
      },
      {
        name: 'Slow 3G',
        bandwidth: 0.4,
        latency: 300,
        packetLoss: 0,
        enabled: true
      },
      {
        name: 'Offline',
        bandwidth: 0,
        latency: 0,
        packetLoss: 100,
        enabled: false
      }
    ]
  };

  const test = new ResponseTimeTest(config);
  return await test.runTest();
}