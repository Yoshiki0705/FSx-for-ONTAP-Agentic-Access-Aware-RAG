/**
 * 評価結果保存ヘルパー
 * 
 * 評価結果をS3とDynamoDBに保存します。
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EvaluationResult } from './quality-metrics-evaluator';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });

const RESULTS_TABLE = process.env.RESULTS_TABLE || '';
const RESULTS_BUCKET = process.env.RESULTS_BUCKET || '';

/**
 * 評価結果メタデータ
 */
export interface EvaluationMetadata {
  evaluationId: string;
  timestamp: number;
  metricType: string;
  score: number;
  confidence: number;
  query: string;
  response: string;
  abTestId?: string;
  variant?: 'A' | 'B';
  ttl?: number;
}

/**
 * 評価結果をS3に保存
 */
export async function saveResultsToS3(
  evaluationId: string,
  results: EvaluationResult[],
  metadata: Record<string, any>
): Promise<string> {
  const key = `evaluations/quality-metrics/${new Date().toISOString().split('T')[0]}/${evaluationId}.json`;

  const data = {
    evaluationId,
    timestamp: Date.now(),
    results,
    metadata,
  };

  await s3Client.send(new PutObjectCommand({
    Bucket: RESULTS_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }));

  return `s3://${RESULTS_BUCKET}/${key}`;
}

/**
 * 評価結果メタデータをDynamoDBに保存
 */
export async function saveMetadataToDynamoDB(
  metadata: EvaluationMetadata
): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: RESULTS_TABLE,
    Item: metadata,
  }));
}

/**
 * 評価結果を一括保存
 */
export async function saveEvaluationResults(
  evaluationId: string,
  results: EvaluationResult[],
  context: {
    query: string;
    response: string;
    abTestId?: string;
    variant?: 'A' | 'B';
    metadata?: Record<string, any>;
  }
): Promise<{ s3Uri: string; savedCount: number }> {
  // S3に詳細結果を保存
  const s3Uri = await saveResultsToS3(evaluationId, results, context.metadata || {});

  // DynamoDBにメタデータを保存
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90日後

  await Promise.all(
    results.map(result =>
      saveMetadataToDynamoDB({
        evaluationId,
        timestamp: result.timestamp,
        metricType: result.metricName,
        score: result.score,
        confidence: result.confidence,
        query: context.query,
        response: context.response,
        abTestId: context.abTestId,
        variant: context.variant,
        ttl,
      })
    )
  );

  return {
    s3Uri,
    savedCount: results.length,
  };
}

/**
 * 評価結果を取得
 */
export async function getEvaluationResults(
  evaluationId: string
): Promise<EvaluationMetadata[]> {
  const response = await docClient.send(new QueryCommand({
    TableName: RESULTS_TABLE,
    KeyConditionExpression: 'evaluationId = :evaluationId',
    ExpressionAttributeValues: {
      ':evaluationId': evaluationId,
    },
  }));

  return (response.Items || []) as EvaluationMetadata[];
}

/**
 * メトリクスタイプ別に評価結果を取得
 */
export async function getResultsByMetricType(
  metricType: string,
  startTime: number,
  endTime: number
): Promise<EvaluationMetadata[]> {
  const response = await docClient.send(new QueryCommand({
    TableName: RESULTS_TABLE,
    IndexName: 'MetricTypeIndex',
    KeyConditionExpression: 'metricType = :metricType AND #ts BETWEEN :startTime AND :endTime',
    ExpressionAttributeNames: {
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':metricType': metricType,
      ':startTime': startTime,
      ':endTime': endTime,
    },
  }));

  return (response.Items || []) as EvaluationMetadata[];
}

/**
 * A/Bテスト別に評価結果を取得
 */
export async function getResultsByABTest(
  abTestId: string,
  startTime: number,
  endTime: number
): Promise<EvaluationMetadata[]> {
  const response = await docClient.send(new QueryCommand({
    TableName: RESULTS_TABLE,
    IndexName: 'ABTestIndex',
    KeyConditionExpression: 'abTestId = :abTestId AND #ts BETWEEN :startTime AND :endTime',
    ExpressionAttributeNames: {
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':abTestId': abTestId,
      ':startTime': startTime,
      ':endTime': endTime,
    },
  }));

  return (response.Items || []) as EvaluationMetadata[];
}

/**
 * 評価結果の統計を計算
 */
export interface EvaluationStatistics {
  metricType: string;
  averageScore: number;
  averageConfidence: number;
  minScore: number;
  maxScore: number;
  sampleCount: number;
}

export function calculateStatistics(results: EvaluationMetadata[]): Map<string, EvaluationStatistics> {
  const statsByMetric = new Map<string, EvaluationStatistics>();

  // メトリクスタイプ別にグループ化
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.metricType]) {
      acc[result.metricType] = [];
    }
    acc[result.metricType].push(result);
    return acc;
  }, {} as Record<string, EvaluationMetadata[]>);

  // 各メトリクスの統計を計算
  Object.entries(groupedResults).forEach(([metricType, metricResults]) => {
    const scores = metricResults.map(r => r.score);
    const confidences = metricResults.map(r => r.confidence);

    statsByMetric.set(metricType, {
      metricType,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      averageConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      sampleCount: metricResults.length,
    });
  });

  return statsByMetric;
}
