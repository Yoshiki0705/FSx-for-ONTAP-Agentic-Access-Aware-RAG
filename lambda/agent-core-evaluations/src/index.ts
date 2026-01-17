/**
 * Agent Core Evaluations Lambda Handler
 * 
 * 品質メトリクス評価、A/Bテスト、パフォーマンス測定を実行します。
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EvaluationContext,
  evaluateAllMetrics,
  evaluateAccuracy,
  evaluateRelevance,
  evaluateHelpfulness,
  evaluateConsistency,
  evaluateCompleteness,
  evaluateConciseness,
  evaluateClarity,
  evaluateGrammar,
  evaluateTone,
  evaluateBias,
  evaluateToxicity,
  evaluateFactuality,
  evaluateCitationQuality,
} from './quality-metrics-evaluator';
import {
  saveEvaluationResults,
  getEvaluationResults,
  getResultsByMetricType,
  getResultsByABTest,
  calculateStatistics,
} from './results-storage';
import {
  ABTestConfig,
  determineVariant,
  analyzeABTest,
  generateABTestReport,
  optimizeTrafficSplit,
} from './ab-test-helper';
import {
  evaluatePerformance,
  generatePerformanceReport,
  CostBreakdown,
} from './performance-evaluator';

/**
 * Lambda Event
 */
interface EvaluationEvent {
  action: 'evaluate' | 'evaluate-single' | 'get-results' | 'get-statistics' | 'get-ab-test-results' | 
          'analyze-ab-test' | 'evaluate-performance' | 'determine-variant';
  evaluationId?: string;
  metricName?: string;
  metricType?: string;
  abTestId?: string;
  userId?: string;
  startTime?: number;
  endTime?: number;
  context?: EvaluationContext;
  enabledMetrics?: string[];
  variant?: 'A' | 'B';
  metadata?: Record<string, any>;
  // A/Bテスト用
  abTestConfig?: any;
  // パフォーマンス評価用
  latencies?: number[];
  totalRequests?: number;
  successfulRequests?: number;
  durationMinutes?: number;
  costBreakdown?: any;
  thresholds?: {
    latency: number;
    throughput: number;
    cost: number;
  };
}

/**
 * Lambda Response
 */
interface EvaluationResponse {
  success: boolean;
  evaluationId?: string;
  results?: any;
  statistics?: any;
  s3Uri?: string;
  savedCount?: number;
  error?: string;
}

/**
 * Lambda Handler
 */
export const handler = async (event: EvaluationEvent): Promise<EvaluationResponse> => {
  console.log('Evaluation event:', JSON.stringify(event, null, 2));

  try {
    switch (event.action) {
      case 'evaluate':
        return await handleEvaluate(event);

      case 'evaluate-single':
        return await handleEvaluateSingle(event);

      case 'get-results':
        return await handleGetResults(event);

      case 'get-statistics':
        return await handleGetStatistics(event);

      case 'get-ab-test-results':
        return await handleGetABTestResults(event);

      case 'analyze-ab-test':
        return await handleAnalyzeABTest(event);

      case 'evaluate-performance':
        return await handleEvaluatePerformance(event);

      case 'determine-variant':
        return await handleDetermineVariant(event);

      default:
        return {
          success: false,
          error: `Unknown action: ${event.action}`,
        };
    }
  } catch (error) {
    console.error('Evaluation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 全メトリクスを評価
 */
async function handleEvaluate(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.context) {
    return {
      success: false,
      error: 'context is required',
    };
  }

  const evaluationId = event.evaluationId || uuidv4();

  // 全メトリクスを評価
  const results = await evaluateAllMetrics(event.context, event.enabledMetrics);

  // 結果を保存
  const { s3Uri, savedCount } = await saveEvaluationResults(
    evaluationId,
    results,
    {
      query: event.context.query,
      response: event.context.response,
      abTestId: event.abTestId,
      variant: event.variant,
      metadata: event.metadata,
    }
  );

  return {
    success: true,
    evaluationId,
    results,
    s3Uri,
    savedCount,
  };
}

/**
 * 単一メトリクスを評価
 */
async function handleEvaluateSingle(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.context) {
    return {
      success: false,
      error: 'context is required',
    };
  }

  if (!event.metricName) {
    return {
      success: false,
      error: 'metricName is required',
    };
  }

  const evaluators: Record<string, (ctx: EvaluationContext) => Promise<any>> = {
    accuracy: evaluateAccuracy,
    relevance: evaluateRelevance,
    helpfulness: evaluateHelpfulness,
    consistency: evaluateConsistency,
    completeness: evaluateCompleteness,
    conciseness: evaluateConciseness,
    clarity: evaluateClarity,
    grammar: evaluateGrammar,
    tone: evaluateTone,
    bias: evaluateBias,
    toxicity: evaluateToxicity,
    factuality: evaluateFactuality,
    citationQuality: evaluateCitationQuality,
  };

  const evaluator = evaluators[event.metricName];
  if (!evaluator) {
    return {
      success: false,
      error: `Unknown metric: ${event.metricName}`,
    };
  }

  const result = await evaluator(event.context);

  const evaluationId = event.evaluationId || uuidv4();

  // 結果を保存
  const { s3Uri, savedCount } = await saveEvaluationResults(
    evaluationId,
    [result],
    {
      query: event.context.query,
      response: event.context.response,
      abTestId: event.abTestId,
      variant: event.variant,
      metadata: event.metadata,
    }
  );

  return {
    success: true,
    evaluationId,
    results: result,
    s3Uri,
    savedCount,
  };
}

/**
 * 評価結果を取得
 */
async function handleGetResults(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.evaluationId) {
    return {
      success: false,
      error: 'evaluationId is required',
    };
  }

  const results = await getEvaluationResults(event.evaluationId);

  return {
    success: true,
    results,
  };
}

/**
 * 統計情報を取得
 */
async function handleGetStatistics(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.metricType) {
    return {
      success: false,
      error: 'metricType is required',
    };
  }

  const startTime = event.startTime || Date.now() - (7 * 24 * 60 * 60 * 1000); // 7日前
  const endTime = event.endTime || Date.now();

  const results = await getResultsByMetricType(event.metricType, startTime, endTime);
  const statistics = calculateStatistics(results);

  return {
    success: true,
    statistics: Object.fromEntries(statistics),
  };
}

/**
 * A/Bテスト結果を取得
 */
async function handleGetABTestResults(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.abTestId) {
    return {
      success: false,
      error: 'abTestId is required',
    };
  }

  const startTime = event.startTime || Date.now() - (7 * 24 * 60 * 60 * 1000); // 7日前
  const endTime = event.endTime || Date.now();

  const results = await getResultsByABTest(event.abTestId, startTime, endTime);

  // バリアント別に集計
  const variantA = results.filter(r => r.variant === 'A');
  const variantB = results.filter(r => r.variant === 'B');

  const statisticsA = calculateStatistics(variantA);
  const statisticsB = calculateStatistics(variantB);

  return {
    success: true,
    results: {
      abTestId: event.abTestId,
      variantA: {
        sampleCount: variantA.length,
        statistics: Object.fromEntries(statisticsA),
      },
      variantB: {
        sampleCount: variantB.length,
        statistics: Object.fromEntries(statisticsB),
      },
    },
  };
}

/**
 * A/Bテストを分析
 */
async function handleAnalyzeABTest(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.abTestId || !event.abTestConfig) {
    return {
      success: false,
      error: 'abTestId and abTestConfig are required',
    };
  }

  const startTime = event.startTime || Date.now() - (7 * 24 * 60 * 60 * 1000); // 7日前
  const endTime = event.endTime || Date.now();

  // A/Bテスト結果を取得
  const results = await getResultsByABTest(event.abTestId, startTime, endTime);

  // バリアント別に集計
  const variantA = results.filter(r => r.variant === 'A');
  const variantB = results.filter(r => r.variant === 'B');

  // ABTestConfigを構築
  const config: ABTestConfig = {
    testId: event.abTestConfig.testId,
    variantA: event.abTestConfig.variantA,
    variantB: event.abTestConfig.variantB,
    trafficSplit: event.abTestConfig.trafficSplit || [50, 50],
    significanceThreshold: event.abTestConfig.significanceThreshold || 0.05,
    minSampleSize: event.abTestConfig.minSampleSize || 100,
    autoOptimization: event.abTestConfig.autoOptimization !== false,
    autoOptimizationThreshold: event.abTestConfig.autoOptimizationThreshold || 0.95,
  };

  // 統計分析を実行
  const analysis = analyzeABTest(variantA, variantB, config);

  // レポートを生成
  const report = generateABTestReport(config, analysis, startTime, endTime);

  // トラフィック分割の最適化提案
  const optimizedConfig = optimizeTrafficSplit(config, analysis);

  return {
    success: true,
    results: {
      abTestId: event.abTestId,
      analysis,
      report,
      optimizedConfig,
      sampleSizes: {
        variantA: variantA.length,
        variantB: variantB.length,
      },
    },
  };
}

/**
 * パフォーマンスを評価
 */
async function handleEvaluatePerformance(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.latencies || !event.totalRequests || !event.successfulRequests || !event.durationMinutes) {
    return {
      success: false,
      error: 'latencies, totalRequests, successfulRequests, and durationMinutes are required',
    };
  }

  // コスト内訳を構築
  const costBreakdown: CostBreakdown = event.costBreakdown || {
    bedrockInvocations: 0,
    bedrockInputTokens: 0,
    bedrockOutputTokens: 0,
    lambdaInvocations: 0,
    lambdaDurationMs: 0,
    s3Storage: 0,
    s3Requests: 0,
    dynamodbReads: 0,
    dynamodbWrites: 0,
    cloudwatchLogs: 0,
  };

  // デフォルトの閾値を設定
  const thresholds = event.thresholds || {
    latency: 1000,
    throughput: 100,
    cost: 100,
  };

  // パフォーマンス評価を実行
  const evaluation = evaluatePerformance(
    event.latencies,
    event.totalRequests,
    event.successfulRequests,
    event.durationMinutes,
    costBreakdown,
    thresholds
  );

  // レポートを生成
  const report = generatePerformanceReport(evaluation);

  return {
    success: true,
    results: {
      evaluation,
      report,
    },
  };
}

/**
 * A/Bテストのバリアントを決定
 */
async function handleDetermineVariant(event: EvaluationEvent): Promise<EvaluationResponse> {
  if (!event.userId || !event.abTestConfig) {
    return {
      success: false,
      error: 'userId and abTestConfig are required',
    };
  }

  // ABTestConfigに変換
  const config: ABTestConfig = {
    testId: event.abTestConfig.testId,
    variantA: event.abTestConfig.variantA,
    variantB: event.abTestConfig.variantB,
    trafficSplit: event.abTestConfig.trafficSplit || [50, 50],
    significanceThreshold: event.abTestConfig.significanceThreshold || 0.05,
    minSampleSize: event.abTestConfig.minSampleSize || 100,
    autoOptimization: event.abTestConfig.autoOptimization !== false,
    autoOptimizationThreshold: event.abTestConfig.autoOptimizationThreshold || 0.95,
  };

  // バリアントを決定
  const variant = determineVariant(event.userId, config);

  return {
    success: true,
    results: {
      userId: event.userId,
      testId: config.testId,
      variant,
      trafficSplit: config.trafficSplit,
    },
  };
}
