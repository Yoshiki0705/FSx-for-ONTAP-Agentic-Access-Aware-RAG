/**
 * Bedrock AgentCore Observability Lambda Function
 * 
 * X-Ray統合、CloudWatch統合、エラー追跡を提供するLambda関数。
 * カスタムセグメント追加、メトリクス送信、ログ集約、エラー分析を実装。
 * 
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */

import { Handler, Context } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk-core';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { trackError, analyzeErrorPatterns, performRCA, aggregateAndLogErrors, generateErrorAlert, ErrorInfo } from './error-tracking-helper';

// AWS SDKをX-Rayでラップ
const cloudwatch = AWSXRay.captureAWSv3Client(new CloudWatchClient({}));
const cloudwatchLogs = AWSXRay.captureAWSv3Client(new CloudWatchLogsClient({}));

/**
 * イベント型定義
 */
interface ObservabilityEvent {
  action: 'trace' | 'metric' | 'log' | 'error' | 'analyze-errors' | 'rca';
  data: TraceData | MetricData | LogData | ErrorData | AnalyzeErrorsData | RCAData;
}

interface TraceData {
  segmentName: string;
  metadata?: Record<string, any>;
  annotations?: Record<string, string | number | boolean>;
}

interface MetricData {
  namespace: string;
  metricName: string;
  value: number;
  unit?: string;
  dimensions?: Array<{ Name: string; Value: string }>;
}

interface LogData {
  logGroupName: string;
  logStreamName: string;
  message: string;
  timestamp?: number;
}

interface ErrorData {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context?: Record<string, any>;
}

interface AnalyzeErrorsData {
  errors: ErrorInfo[];
  logGroupName?: string;
  logStreamName?: string;
}

interface RCAData {
  error: ErrorInfo;
  relatedErrors?: ErrorInfo[];
  generateAlert?: boolean;
}

/**
 * Lambda Handler
 */
export const handler: Handler = async (event: ObservabilityEvent, context: Context) => {
  console.log('Observability Lambda invoked', { event, context });

  try {
    switch (event.action) {
      case 'trace':
        return await handleTrace(event.data as TraceData, context);
      case 'metric':
        return await handleMetric(event.data as MetricData);
      case 'log':
        return await handleLog(event.data as LogData);
      case 'error':
        return await handleError(event.data as ErrorData, context);
      case 'analyze-errors':
        return await handleAnalyzeErrors(event.data as AnalyzeErrorsData);
      case 'rca':
        return await handleRCA(event.data as RCAData);
      default:
        throw new Error(`Unknown action: ${event.action}`);
    }
  } catch (error) {
    console.error('Error in Observability Lambda', error);
    
    // エラーをX-Rayに記録
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addError(error as Error);
    }
    
    throw error;
  }
};

/**
 * トレース処理
 */
async function handleTrace(data: TraceData, context: Context): Promise<any> {
  const segment = AWSXRay.getSegment();
  
  if (!segment) {
    console.warn('No active X-Ray segment found');
    return { success: false, message: 'No active segment' };
  }

  // カスタムサブセグメント作成
  const subsegment = segment.addNewSubsegment(data.segmentName);
  
  try {
    // メタデータ追加
    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        subsegment.addMetadata(key, value);
      });
    }
    
    // アノテーション追加（検索可能）
    if (data.annotations) {
      Object.entries(data.annotations).forEach(([key, value]) => {
        subsegment.addAnnotation(key, value);
      });
    }
    
    // Lambda実行情報を追加
    subsegment.addAnnotation('functionName', context.functionName);
    subsegment.addAnnotation('requestId', context.requestId);
    subsegment.addAnnotation('environment', process.env.ENVIRONMENT || 'unknown');
    
    subsegment.close();
    
    return {
      success: true,
      segmentId: subsegment.id,
      traceId: subsegment.trace_id,
    };
  } catch (error) {
    subsegment.addError(error as Error);
    subsegment.close();
    throw error;
  }
}

/**
 * メトリクス処理
 */
async function handleMetric(data: MetricData): Promise<any> {
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('PutMetricData');
  
  try {
    const command = new PutMetricDataCommand({
      Namespace: data.namespace,
      MetricData: [
        {
          MetricName: data.metricName,
          Value: data.value,
          Unit: data.unit || 'None',
          Timestamp: new Date(),
          Dimensions: data.dimensions,
        },
      ],
    });
    
    const response = await cloudwatch.send(command);
    
    subsegment?.close();
    
    return {
      success: true,
      metricName: data.metricName,
      value: data.value,
      response,
    };
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
}

/**
 * ログ処理
 */
async function handleLog(data: LogData): Promise<any> {
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('PutLogEvents');
  
  try {
    const command = new PutLogEventsCommand({
      logGroupName: data.logGroupName,
      logStreamName: data.logStreamName,
      logEvents: [
        {
          message: data.message,
          timestamp: data.timestamp || Date.now(),
        },
      ],
    });
    
    const response = await cloudwatchLogs.send(command);
    
    subsegment?.close();
    
    return {
      success: true,
      logGroupName: data.logGroupName,
      logStreamName: data.logStreamName,
      response,
    };
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
}

/**
 * エラー処理
 */
async function handleError(data: ErrorData, context: Context): Promise<any> {
  const segment = AWSXRay.getSegment();
  
  if (segment) {
    // エラー情報をX-Rayに記録
    const error = new Error(data.errorMessage);
    error.name = data.errorType;
    if (data.stackTrace) {
      error.stack = data.stackTrace;
    }
    
    segment.addError(error);
    
    // コンテキスト情報をアノテーション追加
    if (data.context) {
      Object.entries(data.context).forEach(([key, value]) => {
        segment.addAnnotation(`error_${key}`, String(value));
      });
    }
    
    segment.addAnnotation('error_type', data.errorType);
    segment.addAnnotation('function_name', context.functionName);
  }
  
  // CloudWatch Logsにもエラーを記録
  console.error('Error tracked', {
    errorType: data.errorType,
    errorMessage: data.errorMessage,
    stackTrace: data.stackTrace,
    context: data.context,
    lambdaContext: {
      functionName: context.functionName,
      requestId: context.requestId,
      logGroupName: context.logGroupName,
      logStreamName: context.logStreamName,
    },
  });
  
  return {
    success: true,
    errorType: data.errorType,
    errorMessage: data.errorMessage,
    tracked: true,
  };
}

/**
 * エラーパターン分析処理
 */
async function handleAnalyzeErrors(data: AnalyzeErrorsData): Promise<any> {
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('AnalyzeErrors');
  
  try {
    // エラーパターン分析
    const patterns = analyzeErrorPatterns(data.errors);
    
    // ログ集約（オプション）
    if (data.logGroupName && data.logStreamName) {
      await aggregateAndLogErrors(
        data.logGroupName,
        data.logStreamName,
        data.errors
      );
    }
    
    subsegment?.close();
    
    return {
      success: true,
      totalErrors: data.errors.length,
      uniquePatterns: patterns.length,
      patterns: patterns.map(p => ({
        pattern: p.pattern,
        count: p.count,
        firstOccurrence: p.firstOccurrence.toISOString(),
        lastOccurrence: p.lastOccurrence.toISOString(),
        sampleCount: p.samples.length,
      })),
      topPatterns: patterns.slice(0, 5),
    };
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
}

/**
 * 根本原因分析（RCA）処理
 */
async function handleRCA(data: RCAData): Promise<any> {
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('RootCauseAnalysis');
  
  try {
    // RCA実行
    const rcaResult = performRCA(data.error, data.relatedErrors || []);
    
    // アラート生成（オプション）
    let alert: string | undefined;
    if (data.generateAlert) {
      alert = generateErrorAlert(rcaResult);
      console.log('Error Alert Generated', { alert });
    }
    
    subsegment?.addAnnotation('root_cause', rcaResult.rootCause);
    subsegment?.addAnnotation('confidence', rcaResult.confidence);
    subsegment?.addAnnotation('severity', rcaResult.impact.severity);
    
    subsegment?.close();
    
    return {
      success: true,
      rca: {
        rootCause: rcaResult.rootCause,
        confidence: rcaResult.confidence,
        impact: rcaResult.impact,
        relatedErrorsCount: rcaResult.relatedErrors.length,
        recommendedActions: rcaResult.recommendedActions,
      },
      alert,
    };
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
}
