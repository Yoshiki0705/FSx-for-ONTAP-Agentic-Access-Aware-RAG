/**
 * CloudWatch統合ヘルパーユーティリティ
 * 
 * カスタムメトリクス送信、ログ集約のヘルパー関数を提供。
 * 
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */

import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({});

/**
 * メトリクス送信オプション
 */
export interface MetricOptions {
  /**
   * メトリクス名
   */
  metricName: string;

  /**
   * メトリクス値
   */
  value: number;

  /**
   * 単位
   */
  unit?: StandardUnit;

  /**
   * ディメンション
   */
  dimensions?: Array<{ Name: string; Value: string }>;

  /**
   * タイムスタンプ
   */
  timestamp?: Date;
}

/**
 * カスタムメトリクスを送信
 * 
 * @param namespace - メトリクスの名前空間
 * @param options - メトリクスオプション
 */
export async function putMetric(
  namespace: string,
  options: MetricOptions
): Promise<void> {
  const command = new PutMetricDataCommand({
    Namespace: namespace,
    MetricData: [
      {
        MetricName: options.metricName,
        Value: options.value,
        Unit: options.unit || StandardUnit.None,
        Timestamp: options.timestamp || new Date(),
        Dimensions: options.dimensions,
      },
    ],
  });

  try {
    await cloudwatch.send(command);
  } catch (error) {
    console.error('Failed to put metric', { namespace, options, error });
    throw error;
  }
}

/**
 * 複数のメトリクスを一括送信
 * 
 * @param namespace - メトリクスの名前空間
 * @param metrics - メトリクスオプションの配列
 */
export async function putMetrics(
  namespace: string,
  metrics: MetricOptions[]
): Promise<void> {
  const command = new PutMetricDataCommand({
    Namespace: namespace,
    MetricData: metrics.map(m => ({
      MetricName: m.metricName,
      Value: m.value,
      Unit: m.unit || StandardUnit.None,
      Timestamp: m.timestamp || new Date(),
      Dimensions: m.dimensions,
    })),
  });

  try {
    await cloudwatch.send(command);
  } catch (error) {
    console.error('Failed to put metrics', { namespace, metricsCount: metrics.length, error });
    throw error;
  }
}

/**
 * エージェント実行レイテンシを記録
 * 
 * @param namespace - メトリクスの名前空間
 * @param latencyMs - レイテンシ（ミリ秒）
 * @param agentId - エージェントID
 */
export async function recordExecutionLatency(
  namespace: string,
  latencyMs: number,
  agentId?: string
): Promise<void> {
  const dimensions = agentId
    ? [{ Name: 'AgentId', Value: agentId }]
    : undefined;

  await putMetric(namespace, {
    metricName: 'Latency',
    value: latencyMs,
    unit: StandardUnit.Milliseconds,
    dimensions,
  });
}

/**
 * エラー率を記録
 * 
 * @param namespace - メトリクスの名前空間
 * @param errorRate - エラー率（%）
 * @param agentId - エージェントID
 */
export async function recordErrorRate(
  namespace: string,
  errorRate: number,
  agentId?: string
): Promise<void> {
  const dimensions = agentId
    ? [{ Name: 'AgentId', Value: agentId }]
    : undefined;

  await putMetric(namespace, {
    metricName: 'ErrorRate',
    value: errorRate,
    unit: StandardUnit.Percent,
    dimensions,
  });
}

/**
 * スループットを記録
 * 
 * @param namespace - メトリクスの名前空間
 * @param count - リクエスト数
 * @param agentId - エージェントID
 */
export async function recordThroughput(
  namespace: string,
  count: number,
  agentId?: string
): Promise<void> {
  const dimensions = agentId
    ? [{ Name: 'AgentId', Value: agentId }]
    : undefined;

  await putMetric(namespace, {
    metricName: 'Throughput',
    value: count,
    unit: StandardUnit.Count,
    dimensions,
  });
}

/**
 * トークン使用量を記録
 * 
 * @param namespace - メトリクスの名前空間
 * @param inputTokens - 入力トークン数
 * @param outputTokens - 出力トークン数
 * @param agentId - エージェントID
 */
export async function recordTokenUsage(
  namespace: string,
  inputTokens: number,
  outputTokens: number,
  agentId?: string
): Promise<void> {
  const dimensions = agentId
    ? [{ Name: 'AgentId', Value: agentId }]
    : undefined;

  await putMetrics(namespace, [
    {
      metricName: 'InputTokens',
      value: inputTokens,
      unit: StandardUnit.Count,
      dimensions,
    },
    {
      metricName: 'OutputTokens',
      value: outputTokens,
      unit: StandardUnit.Count,
      dimensions,
    },
    {
      metricName: 'TotalTokens',
      value: inputTokens + outputTokens,
      unit: StandardUnit.Count,
      dimensions,
    },
  ]);
}

/**
 * コストを記録
 * 
 * @param namespace - メトリクスの名前空間
 * @param cost - コスト（USD）
 * @param agentId - エージェントID
 */
export async function recordCost(
  namespace: string,
  cost: number,
  agentId?: string
): Promise<void> {
  const dimensions = agentId
    ? [{ Name: 'AgentId', Value: agentId }]
    : undefined;

  await putMetric(namespace, {
    metricName: 'EstimatedCost',
    value: cost,
    unit: StandardUnit.None,
    dimensions,
  });
}

/**
 * エージェント実行の包括的メトリクスを記録
 * 
 * @param namespace - メトリクスの名前空間
 * @param metrics - 実行メトリクス
 */
export async function recordAgentExecution(
  namespace: string,
  metrics: {
    agentId: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    success: boolean;
    cost?: number;
  }
): Promise<void> {
  const dimensions = [{ Name: 'AgentId', Value: metrics.agentId }];

  const metricData: MetricOptions[] = [
    {
      metricName: 'Latency',
      value: metrics.latencyMs,
      unit: StandardUnit.Milliseconds,
      dimensions,
    },
    {
      metricName: 'InputTokens',
      value: metrics.inputTokens,
      unit: StandardUnit.Count,
      dimensions,
    },
    {
      metricName: 'OutputTokens',
      value: metrics.outputTokens,
      unit: StandardUnit.Count,
      dimensions,
    },
    {
      metricName: 'TotalTokens',
      value: metrics.inputTokens + metrics.outputTokens,
      unit: StandardUnit.Count,
      dimensions,
    },
    {
      metricName: 'Throughput',
      value: 1,
      unit: StandardUnit.Count,
      dimensions,
    },
    {
      metricName: 'ErrorRate',
      value: metrics.success ? 0 : 100,
      unit: StandardUnit.Percent,
      dimensions,
    },
  ];

  if (metrics.cost !== undefined) {
    metricData.push({
      metricName: 'EstimatedCost',
      value: metrics.cost,
      unit: StandardUnit.None,
      dimensions,
    });
  }

  await putMetrics(namespace, metricData);
}

/**
 * 構造化ログを出力
 * 
 * @param level - ログレベル
 * @param message - メッセージ
 * @param context - コンテキスト情報
 */
export function logStructured(
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  message: string,
  context?: Record<string, any>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  console.log(JSON.stringify(logEntry));
}
