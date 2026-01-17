/**
 * A/Bテストヘルパー
 * 
 * A/Bテストロジック、統計的有意性検定、自動最適化を提供します。
 */

import { EvaluationMetadata } from './results-storage';

/**
 * A/Bテスト設定
 */
export interface ABTestConfig {
  testId: string;
  variantA: string;
  variantB: string;
  trafficSplit: [number, number]; // [A%, B%]
  significanceThreshold: number; // p値（例: 0.05）
  minSampleSize: number;
  autoOptimization: boolean;
  autoOptimizationThreshold: number; // 勝率（例: 0.95）
}

/**
 * A/Bテスト結果
 */
export interface ABTestResult {
  testId: string;
  variantA: VariantStatistics;
  variantB: VariantStatistics;
  winner?: 'A' | 'B' | 'tie';
  confidence: number;
  pValue: number;
  isSignificant: boolean;
  recommendation: string;
  shouldAutoOptimize: boolean;
}

/**
 * バリアント統計
 */
export interface VariantStatistics {
  variant: 'A' | 'B';
  sampleCount: number;
  averageScore: number;
  standardDeviation: number;
  minScore: number;
  maxScore: number;
  confidenceInterval: [number, number];
}

/**
 * トラフィック分割を決定
 */
export function determineVariant(
  userId: string,
  config: ABTestConfig
): 'A' | 'B' {
  // ユーザーIDをハッシュ化して0-100の値に変換
  const hash = simpleHash(userId);
  const percentage = hash % 100;

  // トラフィック分割に基づいてバリアントを決定
  const [splitA] = config.trafficSplit;
  return percentage < splitA ? 'A' : 'B';
}

/**
 * A/Bテスト結果を分析
 */
export function analyzeABTest(
  variantAResults: EvaluationMetadata[],
  variantBResults: EvaluationMetadata[],
  config: ABTestConfig
): ABTestResult {
  // バリアント別の統計を計算
  const statsA = calculateVariantStatistics('A', variantAResults);
  const statsB = calculateVariantStatistics('B', variantBResults);

  // サンプルサイズチェック
  if (statsA.sampleCount < config.minSampleSize || statsB.sampleCount < config.minSampleSize) {
    return {
      testId: config.testId,
      variantA: statsA,
      variantB: statsB,
      confidence: 0,
      pValue: 1,
      isSignificant: false,
      recommendation: `サンプルサイズが不足しています。最小サンプルサイズ: ${config.minSampleSize}`,
      shouldAutoOptimize: false,
    };
  }

  // t検定を実行
  const tTestResult = performTTest(
    variantAResults.map(r => r.score),
    variantBResults.map(r => r.score)
  );

  // 統計的有意性を判定
  const isSignificant = tTestResult.pValue < config.significanceThreshold;

  // 勝者を決定
  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (isSignificant) {
    winner = statsA.averageScore > statsB.averageScore ? 'A' : 'B';
  }

  // 信頼度を計算
  const confidence = 1 - tTestResult.pValue;

  // 自動最適化の判定
  const shouldAutoOptimize = config.autoOptimization &&
    isSignificant &&
    confidence >= config.autoOptimizationThreshold;

  // 推奨事項を生成
  const recommendation = generateRecommendation(
    winner,
    confidence,
    isSignificant,
    statsA,
    statsB,
    config
  );

  return {
    testId: config.testId,
    variantA: statsA,
    variantB: statsB,
    winner,
    confidence,
    pValue: tTestResult.pValue,
    isSignificant,
    recommendation,
    shouldAutoOptimize,
  };
}

/**
 * バリアント統計を計算
 */
function calculateVariantStatistics(
  variant: 'A' | 'B',
  results: EvaluationMetadata[]
): VariantStatistics {
  if (results.length === 0) {
    return {
      variant,
      sampleCount: 0,
      averageScore: 0,
      standardDeviation: 0,
      minScore: 0,
      maxScore: 0,
      confidenceInterval: [0, 0],
    };
  }

  const scores = results.map(r => r.score);
  const sampleCount = scores.length;
  const averageScore = scores.reduce((a, b) => a + b, 0) / sampleCount;

  // 標準偏差を計算
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / sampleCount;
  const standardDeviation = Math.sqrt(variance);

  // 95%信頼区間を計算
  const standardError = standardDeviation / Math.sqrt(sampleCount);
  const marginOfError = 1.96 * standardError; // 95%信頼区間
  const confidenceInterval: [number, number] = [
    averageScore - marginOfError,
    averageScore + marginOfError,
  ];

  return {
    variant,
    sampleCount,
    averageScore,
    standardDeviation,
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    confidenceInterval,
  };
}

/**
 * t検定を実行
 */
interface TTestResult {
  tStatistic: number;
  pValue: number;
  degreesOfFreedom: number;
}

function performTTest(samplesA: number[], samplesB: number[]): TTestResult {
  const n1 = samplesA.length;
  const n2 = samplesB.length;

  // 平均を計算
  const mean1 = samplesA.reduce((a, b) => a + b, 0) / n1;
  const mean2 = samplesB.reduce((a, b) => a + b, 0) / n2;

  // 分散を計算
  const variance1 = samplesA.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
  const variance2 = samplesB.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

  // プールされた標準偏差を計算
  const pooledStdDev = Math.sqrt(((n1 - 1) * variance1 + (n2 - 1) * variance2) / (n1 + n2 - 2));

  // t統計量を計算
  const tStatistic = (mean1 - mean2) / (pooledStdDev * Math.sqrt(1 / n1 + 1 / n2));

  // 自由度を計算
  const degreesOfFreedom = n1 + n2 - 2;

  // p値を計算（簡易版: 正規分布近似）
  const pValue = calculatePValue(Math.abs(tStatistic), degreesOfFreedom);

  return {
    tStatistic,
    pValue,
    degreesOfFreedom,
  };
}

/**
 * p値を計算（簡易版）
 */
function calculatePValue(tStatistic: number, degreesOfFreedom: number): number {
  // 簡易的な正規分布近似
  // 実際の実装では、より正確なt分布を使用すべき
  const z = tStatistic;
  
  // 標準正規分布のCDFを近似
  const x = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return 2 * p; // 両側検定
}

/**
 * 推奨事項を生成
 */
function generateRecommendation(
  winner: 'A' | 'B' | 'tie',
  confidence: number,
  isSignificant: boolean,
  statsA: VariantStatistics,
  statsB: VariantStatistics,
  config: ABTestConfig
): string {
  if (!isSignificant) {
    return `統計的に有意な差は検出されませんでした（p値 > ${config.significanceThreshold}）。` +
      `より多くのサンプルを収集するか、テストを継続してください。`;
  }

  const winnerStats = winner === 'A' ? statsA : statsB;
  const loserStats = winner === 'A' ? statsB : statsA;
  const improvement = ((winnerStats.averageScore - loserStats.averageScore) / loserStats.averageScore * 100).toFixed(2);

  let recommendation = `バリアント${winner}が統計的に有意に優れています（信頼度: ${(confidence * 100).toFixed(2)}%）。\n`;
  recommendation += `平均スコア: ${winnerStats.averageScore.toFixed(2)} vs ${loserStats.averageScore.toFixed(2)} （改善率: ${improvement}%）\n`;

  if (confidence >= config.autoOptimizationThreshold) {
    recommendation += `\n自動最適化の閾値（${(config.autoOptimizationThreshold * 100).toFixed(0)}%）を超えています。`;
    recommendation += `バリアント${winner}への完全移行を推奨します。`;
  } else {
    recommendation += `\n信頼度が自動最適化の閾値（${(config.autoOptimizationThreshold * 100).toFixed(0)}%）に達していません。`;
    recommendation += `テストを継続してより多くのデータを収集してください。`;
  }

  return recommendation;
}

/**
 * 簡易ハッシュ関数
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * トラフィック分割を更新（自動最適化）
 */
export function optimizeTrafficSplit(
  currentConfig: ABTestConfig,
  testResult: ABTestResult
): ABTestConfig {
  if (!testResult.shouldAutoOptimize || !testResult.winner || testResult.winner === 'tie') {
    return currentConfig;
  }

  // 勝者に100%のトラフィックを割り当て
  const newTrafficSplit: [number, number] = testResult.winner === 'A' ? [100, 0] : [0, 100];

  return {
    ...currentConfig,
    trafficSplit: newTrafficSplit,
  };
}

/**
 * A/Bテストレポートを生成
 */
export interface ABTestReport {
  testId: string;
  startDate: string;
  endDate: string;
  duration: string;
  summary: string;
  variantA: {
    name: string;
    sampleCount: number;
    averageScore: number;
    confidenceInterval: string;
  };
  variantB: {
    name: string;
    sampleCount: number;
    averageScore: number;
    confidenceInterval: string;
  };
  statisticalAnalysis: {
    winner: string;
    confidence: string;
    pValue: string;
    isSignificant: boolean;
  };
  recommendation: string;
}

export function generateABTestReport(
  config: ABTestConfig,
  result: ABTestResult,
  startTime: number,
  endTime: number
): ABTestReport {
  const duration = formatDuration(endTime - startTime);

  return {
    testId: config.testId,
    startDate: new Date(startTime).toISOString(),
    endDate: new Date(endTime).toISOString(),
    duration,
    summary: `A/Bテスト「${config.testId}」の結果レポート`,
    variantA: {
      name: config.variantA,
      sampleCount: result.variantA.sampleCount,
      averageScore: result.variantA.averageScore,
      confidenceInterval: `[${result.variantA.confidenceInterval[0].toFixed(2)}, ${result.variantA.confidenceInterval[1].toFixed(2)}]`,
    },
    variantB: {
      name: config.variantB,
      sampleCount: result.variantB.sampleCount,
      averageScore: result.variantB.averageScore,
      confidenceInterval: `[${result.variantB.confidenceInterval[0].toFixed(2)}, ${result.variantB.confidenceInterval[1].toFixed(2)}]`,
    },
    statisticalAnalysis: {
      winner: result.winner || 'tie',
      confidence: `${(result.confidence * 100).toFixed(2)}%`,
      pValue: result.pValue.toFixed(4),
      isSignificant: result.isSignificant,
    },
    recommendation: result.recommendation,
  };
}

/**
 * 期間をフォーマット
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}日 ${hours % 24}時間`;
  } else if (hours > 0) {
    return `${hours}時間 ${minutes % 60}分`;
  } else if (minutes > 0) {
    return `${minutes}分 ${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}
