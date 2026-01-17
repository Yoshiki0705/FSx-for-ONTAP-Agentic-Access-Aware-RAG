/**
 * エラー追跡ヘルパーユーティリティ
 * 
 * エラーパターン分析、根本原因分析（RCA）、エラー集約のヘルパー関数を提供。
 * 
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */

import * as AWSXRay from 'aws-xray-sdk-core';
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const cloudwatchLogs = AWSXRay.captureAWSv3Client(new CloudWatchLogsClient({}));

/**
 * エラー情報
 */
export interface ErrorInfo {
  /**
   * エラータイプ
   */
  errorType: string;

  /**
   * エラーメッセージ
   */
  errorMessage: string;

  /**
   * スタックトレース
   */
  stackTrace?: string;

  /**
   * コンテキスト情報
   */
  context?: Record<string, any>;

  /**
   * タイムスタンプ
   */
  timestamp?: Date;
}

/**
 * エラーパターン
 */
export interface ErrorPattern {
  /**
   * パターン名
   */
  pattern: string;

  /**
   * 発生回数
   */
  count: number;

  /**
   * 最初の発生時刻
   */
  firstOccurrence: Date;

  /**
   * 最後の発生時刻
   */
  lastOccurrence: Date;

  /**
   * サンプルエラー
   */
  samples: ErrorInfo[];
}

/**
 * 根本原因分析結果
 */
export interface RCAResult {
  /**
   * 根本原因
   */
  rootCause: string;

  /**
   * 信頼度（0.0-1.0）
   */
  confidence: number;

  /**
   * 関連エラー
   */
  relatedErrors: ErrorInfo[];

  /**
   * 推奨アクション
   */
  recommendedActions: string[];

  /**
   * 影響範囲
   */
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedComponents: string[];
    estimatedUsers?: number;
  };
}

/**
 * エラーを追跡
 * 
 * @param error - エラーオブジェクト
 * @param context - コンテキスト情報
 * @returns エラー情報
 */
export function trackError(
  error: Error,
  context?: Record<string, any>
): ErrorInfo {
  const errorInfo: ErrorInfo = {
    errorType: error.name || 'UnknownError',
    errorMessage: error.message,
    stackTrace: error.stack,
    context,
    timestamp: new Date(),
  };

  // X-Rayにエラーを記録
  const segment = AWSXRay.getSegment();
  if (segment) {
    segment.addError(error);
    
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        segment.addAnnotation(`error_${key}`, String(value));
      });
    }
  }

  // 構造化ログ出力
  console.error('Error tracked', {
    errorType: errorInfo.errorType,
    errorMessage: errorInfo.errorMessage,
    stackTrace: errorInfo.stackTrace,
    context: errorInfo.context,
    timestamp: errorInfo.timestamp.toISOString(),
  });

  return errorInfo;
}

/**
 * エラーパターンを分析
 * 
 * @param errors - エラー情報の配列
 * @returns エラーパターンの配列
 */
export function analyzeErrorPatterns(errors: ErrorInfo[]): ErrorPattern[] {
  const patternMap = new Map<string, ErrorPattern>();

  errors.forEach(error => {
    const patternKey = `${error.errorType}:${error.errorMessage.substring(0, 100)}`;
    
    if (patternMap.has(patternKey)) {
      const pattern = patternMap.get(patternKey)!;
      pattern.count++;
      pattern.lastOccurrence = error.timestamp || new Date();
      
      // サンプルを最大5件まで保持
      if (pattern.samples.length < 5) {
        pattern.samples.push(error);
      }
    } else {
      patternMap.set(patternKey, {
        pattern: patternKey,
        count: 1,
        firstOccurrence: error.timestamp || new Date(),
        lastOccurrence: error.timestamp || new Date(),
        samples: [error],
      });
    }
  });

  // 発生回数でソート
  return Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * 根本原因分析（RCA）を実行
 * 
 * @param error - エラー情報
 * @param relatedErrors - 関連エラーの配列
 * @returns RCA結果
 */
export function performRCA(
  error: ErrorInfo,
  relatedErrors: ErrorInfo[] = []
): RCAResult {
  // エラータイプに基づく根本原因の推定
  const rootCauseAnalysis = analyzeRootCause(error);
  
  // 関連エラーから影響範囲を推定
  const impact = estimateImpact(error, relatedErrors);
  
  // 推奨アクションを生成
  const recommendedActions = generateRecommendedActions(error, rootCauseAnalysis);

  return {
    rootCause: rootCauseAnalysis.cause,
    confidence: rootCauseAnalysis.confidence,
    relatedErrors,
    recommendedActions,
    impact,
  };
}

/**
 * 根本原因を分析
 */
function analyzeRootCause(error: ErrorInfo): { cause: string; confidence: number } {
  const errorType = error.errorType.toLowerCase();
  const errorMessage = error.errorMessage.toLowerCase();

  // AWS SDK関連エラー
  if (errorType.includes('throttling') || errorMessage.includes('throttling')) {
    return {
      cause: 'API rate limit exceeded - Too many requests to AWS service',
      confidence: 0.9,
    };
  }

  if (errorType.includes('timeout') || errorMessage.includes('timeout')) {
    return {
      cause: 'Operation timeout - Service or network latency issue',
      confidence: 0.85,
    };
  }

  if (errorType.includes('accessdenied') || errorMessage.includes('access denied')) {
    return {
      cause: 'Permission issue - IAM role lacks required permissions',
      confidence: 0.95,
    };
  }

  if (errorType.includes('notfound') || errorMessage.includes('not found')) {
    return {
      cause: 'Resource not found - Missing or deleted resource',
      confidence: 0.9,
    };
  }

  // Bedrock関連エラー
  if (errorMessage.includes('model') && errorMessage.includes('not available')) {
    return {
      cause: 'Bedrock model not available in region or not enabled',
      confidence: 0.9,
    };
  }

  if (errorMessage.includes('token') && errorMessage.includes('limit')) {
    return {
      cause: 'Token limit exceeded - Input or output too large',
      confidence: 0.85,
    };
  }

  // DynamoDB関連エラー
  if (errorMessage.includes('provisioned throughput')) {
    return {
      cause: 'DynamoDB capacity exceeded - Need to increase provisioned throughput',
      confidence: 0.9,
    };
  }

  // Lambda関連エラー
  if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
    return {
      cause: 'Lambda memory limit exceeded - Need to increase memory allocation',
      confidence: 0.9,
    };
  }

  // ネットワーク関連エラー
  if (errorType.includes('network') || errorMessage.includes('connection')) {
    return {
      cause: 'Network connectivity issue - VPC, security group, or endpoint problem',
      confidence: 0.75,
    };
  }

  // デフォルト
  return {
    cause: `Unknown error: ${error.errorType} - ${error.errorMessage}`,
    confidence: 0.5,
  };
}

/**
 * 影響範囲を推定
 */
function estimateImpact(
  error: ErrorInfo,
  relatedErrors: ErrorInfo[]
): RCAResult['impact'] {
  const errorCount = relatedErrors.length + 1;
  const affectedComponents = new Set<string>();

  // コンテキストから影響を受けるコンポーネントを抽出
  [error, ...relatedErrors].forEach(e => {
    if (e.context?.component) {
      affectedComponents.add(e.context.component);
    }
    if (e.context?.service) {
      affectedComponents.add(e.context.service);
    }
  });

  // 深刻度を判定
  let severity: 'low' | 'medium' | 'high' | 'critical';
  
  if (errorCount >= 100 || affectedComponents.size >= 5) {
    severity = 'critical';
  } else if (errorCount >= 50 || affectedComponents.size >= 3) {
    severity = 'high';
  } else if (errorCount >= 10 || affectedComponents.size >= 2) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  return {
    severity,
    affectedComponents: Array.from(affectedComponents),
    estimatedUsers: errorCount,
  };
}

/**
 * 推奨アクションを生成
 */
function generateRecommendedActions(
  error: ErrorInfo,
  rootCauseAnalysis: { cause: string; confidence: number }
): string[] {
  const actions: string[] = [];
  const errorType = error.errorType.toLowerCase();
  const errorMessage = error.errorMessage.toLowerCase();

  // エラータイプに基づく推奨アクション
  if (errorType.includes('throttling') || errorMessage.includes('throttling')) {
    actions.push('Implement exponential backoff retry logic');
    actions.push('Increase service quotas if needed');
    actions.push('Review and optimize API call patterns');
  }

  if (errorType.includes('timeout') || errorMessage.includes('timeout')) {
    actions.push('Increase Lambda timeout setting');
    actions.push('Optimize query performance');
    actions.push('Check network connectivity and latency');
  }

  if (errorType.includes('accessdenied') || errorMessage.includes('access denied')) {
    actions.push('Review IAM role permissions');
    actions.push('Add required permissions to execution role');
    actions.push('Check resource-based policies');
  }

  if (errorType.includes('notfound') || errorMessage.includes('not found')) {
    actions.push('Verify resource exists and is in correct region');
    actions.push('Check resource naming and identifiers');
    actions.push('Review resource lifecycle and deletion policies');
  }

  if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
    actions.push('Increase Lambda memory allocation');
    actions.push('Optimize memory usage in code');
    actions.push('Review data processing patterns');
  }

  // デフォルトアクション
  if (actions.length === 0) {
    actions.push('Review error logs and stack trace');
    actions.push('Check service health and status');
    actions.push('Verify configuration and environment variables');
  }

  return actions;
}

/**
 * エラーログを集約して送信
 * 
 * @param logGroupName - ログロググループ名
 * @param logStreamName - ログストリーム名
 * @param errors - エラー情報の配列
 */
export async function aggregateAndLogErrors(
  logGroupName: string,
  logStreamName: string,
  errors: ErrorInfo[]
): Promise<void> {
  if (errors.length === 0) return;

  // エラーパターン分析
  const patterns = analyzeErrorPatterns(errors);

  // 集約ログメッセージ作成
  const aggregatedLog = {
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    uniquePatterns: patterns.length,
    patterns: patterns.map(p => ({
      pattern: p.pattern,
      count: p.count,
      firstOccurrence: p.firstOccurrence.toISOString(),
      lastOccurrence: p.lastOccurrence.toISOString(),
    })),
    topErrors: patterns.slice(0, 5).map(p => p.samples[0]),
  };

  // CloudWatch Logsに送信
  try {
    const command = new PutLogEventsCommand({
      logGroupName,
      logStreamName,
      logEvents: [
        {
          message: JSON.stringify(aggregatedLog),
          timestamp: Date.now(),
        },
      ],
    });

    await cloudwatchLogs.send(command);
  } catch (error) {
    console.error('Failed to send aggregated error logs', error);
  }
}

/**
 * エラーアラートを生成
 * 
 * @param rcaResult - RCA結果
 * @returns アラートメッセージ
 */
export function generateErrorAlert(rcaResult: RCAResult): string {
  const severityEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  const alert = `
${severityEmoji[rcaResult.impact.severity]} Error Alert - ${rcaResult.impact.severity.toUpperCase()}

Root Cause: ${rcaResult.rootCause}
Confidence: ${(rcaResult.confidence * 100).toFixed(0)}%

Impact:
- Severity: ${rcaResult.impact.severity}
- Affected Components: ${rcaResult.impact.affectedComponents.join(', ')}
- Estimated Users: ${rcaResult.impact.estimatedUsers || 'Unknown'}

Related Errors: ${rcaResult.relatedErrors.length}

Recommended Actions:
${rcaResult.recommendedActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}
  `.trim();

  return alert;
}
