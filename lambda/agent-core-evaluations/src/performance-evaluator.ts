/**
 * パフォーマンス評価ヘルパー
 * 
 * レイテンシ測定、スループット測定、コスト分析、最適化提案を提供します。
 */

/**
 * パフォーマンスメトリクス
 */
export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  cost: CostMetrics;
  timestamp: number;
}

/**
 * レイテンシメトリクス
 */
export interface LatencyMetrics {
  average: number; // ミリ秒
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  sampleCount: number;
}

/**
 * スループットメトリクス
 */
export interface ThroughputMetrics {
  requestsPerMinute: number;
  requestsPerHour: number;
  successRate: number; // 0-1
  errorRate: number; // 0-1
  sampleCount: number;
}

/**
 * コストメトリクス
 */
export interface CostMetrics {
  totalCost: number; // USD
  costPerRequest: number; // USD
  costPer1000Requests: number; // USD
  bedrockCost: number; // USD
  lambdaCost: number; // USD
  storageCost: number; // USD
  breakdown: CostBreakdown;
}

/**
 * コスト内訳
 */
export interface CostBreakdown {
  bedrockInvocations: number;
  bedrockInputTokens: number;
  bedrockOutputTokens: number;
  lambdaInvocations: number;
  lambdaDuration: number; // ミリ秒
  s3Storage: number; // GB
  dynamoDBReads: number;
  dynamoDBWrites: number;
}

/**
 * 最適化提案
 */
export interface OptimizationSuggestion {
  category: 'latency' | 'throughput' | 'cost' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string;
}

/**
 * パフォーマンス評価結果
 */
export interface PerformanceEvaluationResult {
  metrics: PerformanceMetrics;
  issues: PerformanceIssue[];
  suggestions: OptimizationSuggestion[];
  overallScore: number; // 0-100
  timestamp: number;
}

/**
 * パフォーマンス問題
 */
export interface PerformanceIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'latency' | 'throughput' | 'cost';
  message: string;
  currentValue: number;
  threshold: number;
}

/**
 * レイテンシを測定
 */
export function measureLatency(latencies: number[]): LatencyMetrics {
  if (latencies.length === 0) {
    return {
      average: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      sampleCount: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sampleCount = sorted.length;

  return {
    average: sorted.reduce((a, b) => a + b, 0) / sampleCount,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    min: sorted[0],
    max: sorted[sampleCount - 1],
    sampleCount,
  };
}

/**
 * スループットを測定
 */
export function measureThroughput(
  totalRequests: number,
  successfulRequests: number,
  durationMinutes: number
): ThroughputMetrics {
  const requestsPerMinute = totalRequests / durationMinutes;
  const requestsPerHour = requestsPerMinute * 60;
  const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
  const errorRate = 1 - successRate;

  return {
    requestsPerMinute,
    requestsPerHour,
    successRate,
    errorRate,
    sampleCount: totalRequests,
  };
}

/**
 * コストを分析
 */
export function analyzeCost(breakdown: CostBreakdown): CostMetrics {
  // Bedrock料金（Claude 3 Sonnet）
  const bedrockInputCostPer1000Tokens = 0.003; // USD
  const bedrockOutputCostPer1000Tokens = 0.015; // USD
  const bedrockCost =
    (breakdown.bedrockInputTokens / 1000) * bedrockInputCostPer1000Tokens +
    (breakdown.bedrockOutputTokens / 1000) * bedrockOutputCostPer1000Tokens;

  // Lambda料金
  const lambdaCostPerRequest = 0.0000002; // USD
  const lambdaCostPerGBSecond = 0.0000166667; // USD
  const lambdaMemoryGB = 1; // 1GB想定
  const lambdaCost =
    breakdown.lambdaInvocations * lambdaCostPerRequest +
    (breakdown.lambdaDuration / 1000) * lambdaMemoryGB * lambdaCostPerGBSecond;

  // S3料金
  const s3CostPerGBMonth = 0.023; // USD
  const storageCost = breakdown.s3Storage * s3CostPerGBMonth;

  // DynamoDB料金
  const dynamoDBReadCostPer1M = 0.25; // USD
  const dynamoDBWriteCostPer1M = 1.25; // USD
  const dynamoDBCost =
    (breakdown.dynamoDBReads / 1000000) * dynamoDBReadCostPer1M +
    (breakdown.dynamoDBWrites / 1000000) * dynamoDBWriteCostPer1M;

  const totalCost = bedrockCost + lambdaCost + storageCost + dynamoDBCost;
  const totalRequests = breakdown.bedrockInvocations || 1;
  const costPerRequest = totalCost / totalRequests;
  const costPer1000Requests = costPerRequest * 1000;

  return {
    totalCost,
    costPerRequest,
    costPer1000Requests,
    bedrockCost,
    lambdaCost,
    storageCost: storageCost + dynamoDBCost,
    breakdown,
  };
}

/**
 * パフォーマンスを評価
 */
export function evaluatePerformance(
  latencies: number[],
  totalRequests: number,
  successfulRequests: number,
  durationMinutes: number,
  costBreakdown: CostBreakdown,
  thresholds: {
    latency: number;
    throughput: number;
    cost: number;
  }
): PerformanceEvaluationResult {
  // メトリクスを測定
  const latencyMetrics = measureLatency(latencies);
  const throughputMetrics = measureThroughput(totalRequests, successfulRequests, durationMinutes);
  const costMetrics = analyzeCost(costBreakdown);

  const metrics: PerformanceMetrics = {
    latency: latencyMetrics,
    throughput: throughputMetrics,
    cost: costMetrics,
    timestamp: Date.now(),
  };

  // 問題を検出
  const issues = detectIssues(metrics, thresholds);

  // 最適化提案を生成
  const suggestions = generateOptimizationSuggestions(metrics, issues);

  // 総合スコアを計算
  const overallScore = calculateOverallScore(metrics, thresholds);

  return {
    metrics,
    issues,
    suggestions,
    overallScore,
    timestamp: Date.now(),
  };
}

/**
 * パフォーマンス問題を検出
 */
function detectIssues(
  metrics: PerformanceMetrics,
  thresholds: {
    latency: number;
    throughput: number;
    cost: number;
  }
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  // レイテンシ問題
  if (metrics.latency.p95 > thresholds.latency) {
    issues.push({
      severity: 'critical',
      category: 'latency',
      message: `P95レイテンシが閾値を超えています`,
      currentValue: metrics.latency.p95,
      threshold: thresholds.latency,
    });
  } else if (metrics.latency.p90 > thresholds.latency * 0.8) {
    issues.push({
      severity: 'warning',
      category: 'latency',
      message: `P90レイテンシが閾値の80%を超えています`,
      currentValue: metrics.latency.p90,
      threshold: thresholds.latency * 0.8,
    });
  }

  // スループット問題
  if (metrics.throughput.requestsPerMinute < thresholds.throughput) {
    issues.push({
      severity: 'warning',
      category: 'throughput',
      message: `スループットが閾値を下回っています`,
      currentValue: metrics.throughput.requestsPerMinute,
      threshold: thresholds.throughput,
    });
  }

  // エラー率問題
  if (metrics.throughput.errorRate > 0.05) {
    issues.push({
      severity: 'critical',
      category: 'throughput',
      message: `エラー率が5%を超えています`,
      currentValue: metrics.throughput.errorRate * 100,
      threshold: 5,
    });
  } else if (metrics.throughput.errorRate > 0.01) {
    issues.push({
      severity: 'warning',
      category: 'throughput',
      message: `エラー率が1%を超えています`,
      currentValue: metrics.throughput.errorRate * 100,
      threshold: 1,
    });
  }

  // コスト問題
  if (metrics.cost.costPer1000Requests > thresholds.cost) {
    issues.push({
      severity: 'warning',
      category: 'cost',
      message: `1000リクエストあたりのコストが閾値を超えています`,
      currentValue: metrics.cost.costPer1000Requests,
      threshold: thresholds.cost,
    });
  }

  return issues;
}

/**
 * 最適化提案を生成
 */
function generateOptimizationSuggestions(
  metrics: PerformanceMetrics,
  issues: PerformanceIssue[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // レイテンシ最適化
  if (issues.some(i => i.category === 'latency')) {
    if (metrics.latency.p95 > 3000) {
      suggestions.push({
        category: 'latency',
        priority: 'high',
        title: 'Bedrockモデルの最適化',
        description: 'より高速なBedrockモデルへの切り替えを検討してください。',
        expectedImpact: 'レイテンシを30-50%削減',
        implementation: 'Claude 3 HaikuまたはClaude Instantへの切り替え',
      });
    }

    suggestions.push({
      category: 'latency',
      priority: 'medium',
      title: 'キャッシング戦略の導入',
      description: '頻繁にアクセスされる評価結果をキャッシュしてください。',
      expectedImpact: 'キャッシュヒット時のレイテンシを90%削減',
      implementation: 'ElastiCacheまたはDynamoDB DAXの導入',
    });
  }

  // スループット最適化
  if (issues.some(i => i.category === 'throughput')) {
    suggestions.push({
      category: 'throughput',
      priority: 'high',
      title: 'Lambda同時実行数の増加',
      description: 'Lambda関数の予約済み同時実行数を増やしてください。',
      expectedImpact: 'スループットを2-3倍に向上',
      implementation: 'Reserved Concurrencyを現在の2倍に設定',
    });

    if (metrics.throughput.errorRate > 0.01) {
      suggestions.push({
        category: 'throughput',
        priority: 'high',
        title: 'エラーハンドリングの改善',
        description: 'エラー率が高いため、エラーハンドリングとリトライロジックを改善してください。',
        expectedImpact: 'エラー率を50%削減',
        implementation: '指数バックオフリトライとサーキットブレーカーの実装',
      });
    }
  }

  // コスト最適化
  if (issues.some(i => i.category === 'cost')) {
    const bedrockCostRatio = metrics.cost.bedrockCost / metrics.cost.totalCost;
    
    if (bedrockCostRatio > 0.7) {
      suggestions.push({
        category: 'cost',
        priority: 'high',
        title: 'Bedrockコストの最適化',
        description: 'Bedrockコストが全体の70%以上を占めています。プロンプトの最適化を検討してください。',
        expectedImpact: 'Bedrockコストを20-30%削減',
        implementation: 'プロンプトの簡潔化、トークン数の削減、バッチ処理の導入',
      });
    }

    suggestions.push({
      category: 'cost',
      priority: 'medium',
      title: 'ストレージコストの最適化',
      description: '古い評価結果をアーカイブまたは削除してください。',
      expectedImpact: 'ストレージコストを30-50%削減',
      implementation: 'S3ライフサイクルポリシーの設定、DynamoDB TTLの活用',
    });
  }

  // 一般的な最適化
  suggestions.push({
    category: 'general',
    priority: 'low',
    title: '非同期処理の活用',
    description: '評価処理を非同期化してレスポンス時間を改善してください。',
    expectedImpact: 'ユーザー体感レイテンシを80%削減',
    implementation: 'SQS + Lambda非同期処理パターンの導入',
  });

  return suggestions;
}

/**
 * 総合スコアを計算
 */
function calculateOverallScore(
  metrics: PerformanceMetrics,
  thresholds: {
    latency: number;
    throughput: number;
    cost: number;
  }
): number {
  // レイテンシスコア（0-100）
  const latencyScore = Math.max(0, 100 - (metrics.latency.p95 / thresholds.latency) * 100);

  // スループットスコア（0-100）
  const throughputScore = Math.min(100, (metrics.throughput.requestsPerMinute / thresholds.throughput) * 100);

  // エラー率スコア（0-100）
  const errorRateScore = Math.max(0, 100 - metrics.throughput.errorRate * 1000);

  // コストスコア（0-100）
  const costScore = Math.max(0, 100 - (metrics.cost.costPer1000Requests / thresholds.cost) * 100);

  // 重み付け平均
  const overallScore = (
    latencyScore * 0.3 +
    throughputScore * 0.2 +
    errorRateScore * 0.3 +
    costScore * 0.2
  );

  return Math.round(overallScore);
}

/**
 * パーセンタイルを計算
 */
function percentile(sortedArray: number[], p: number): number {
  const index = Math.ceil(sortedArray.length * p) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * パフォーマンスレポートを生成
 */
export interface PerformanceReport {
  summary: {
    overallScore: number;
    grade: string;
    timestamp: string;
  };
  latency: {
    average: string;
    p95: string;
    status: string;
  };
  throughput: {
    requestsPerMinute: string;
    successRate: string;
    status: string;
  };
  cost: {
    costPer1000Requests: string;
    totalCost: string;
    status: string;
  };
  issues: PerformanceIssue[];
  topSuggestions: OptimizationSuggestion[];
}

export function generatePerformanceReport(result: PerformanceEvaluationResult): PerformanceReport {
  const grade = result.overallScore >= 90 ? 'A' :
                result.overallScore >= 80 ? 'B' :
                result.overallScore >= 70 ? 'C' :
                result.overallScore >= 60 ? 'D' : 'F';

  return {
    summary: {
      overallScore: result.overallScore,
      grade,
      timestamp: new Date(result.timestamp).toISOString(),
    },
    latency: {
      average: `${result.metrics.latency.average.toFixed(0)}ms`,
      p95: `${result.metrics.latency.p95.toFixed(0)}ms`,
      status: result.issues.some(i => i.category === 'latency' && i.severity === 'critical') ? 'critical' :
              result.issues.some(i => i.category === 'latency' && i.severity === 'warning') ? 'warning' : 'ok',
    },
    throughput: {
      requestsPerMinute: result.metrics.throughput.requestsPerMinute.toFixed(2),
      successRate: `${(result.metrics.throughput.successRate * 100).toFixed(2)}%`,
      status: result.issues.some(i => i.category === 'throughput' && i.severity === 'critical') ? 'critical' :
              result.issues.some(i => i.category === 'throughput' && i.severity === 'warning') ? 'warning' : 'ok',
    },
    cost: {
      costPer1000Requests: `$${result.metrics.cost.costPer1000Requests.toFixed(4)}`,
      totalCost: `$${result.metrics.cost.totalCost.toFixed(4)}`,
      status: result.issues.some(i => i.category === 'cost') ? 'warning' : 'ok',
    },
    issues: result.issues,
    topSuggestions: result.suggestions.slice(0, 5),
  };
}
