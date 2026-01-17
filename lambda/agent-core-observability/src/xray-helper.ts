/**
 * X-Ray統合ヘルパーユーティリティ
 * 
 * カスタムセグメント追加、メタデータ追加、エラー追跡のヘルパー関数を提供。
 * 
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */

import * as AWSXRay from 'aws-xray-sdk-core';

/**
 * カスタムセグメントを作成して実行
 * 
 * @param segmentName - セグメント名
 * @param fn - 実行する関数
 * @param metadata - メタデータ（オプション）
 * @param annotations - アノテーション（オプション）
 * @returns 関数の実行結果
 */
export async function captureAsyncFunc<T>(
  segmentName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>,
  annotations?: Record<string, string | number | boolean>
): Promise<T> {
  const segment = AWSXRay.getSegment();
  
  if (!segment) {
    console.warn('No active X-Ray segment, executing without tracing');
    return await fn();
  }

  const subsegment = segment.addNewSubsegment(segmentName);
  
  try {
    // メタデータ追加
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        subsegment.addMetadata(key, value);
      });
    }
    
    // アノテーション追加
    if (annotations) {
      Object.entries(annotations).forEach(([key, value]) => {
        subsegment.addAnnotation(key, value);
      });
    }
    
    const result = await fn();
    
    subsegment.close();
    
    return result;
  } catch (error) {
    subsegment.addError(error as Error);
    subsegment.close();
    throw error;
  }
}

/**
 * 同期関数をカスタムセグメントで実行
 * 
 * @param segmentName - セグメント名
 * @param fn - 実行する関数
 * @param metadata - メタデータ（オプション）
 * @param annotations - アノテーション（オプション）
 * @returns 関数の実行結果
 */
export function captureFunc<T>(
  segmentName: string,
  fn: () => T,
  metadata?: Record<string, any>,
  annotations?: Record<string, string | number | boolean>
): T {
  const segment = AWSXRay.getSegment();
  
  if (!segment) {
    console.warn('No active X-Ray segment, executing without tracing');
    return fn();
  }

  const subsegment = segment.addNewSubsegment(segmentName);
  
  try {
    // メタデータ追加
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        subsegment.addMetadata(key, value);
      });
    }
    
    // アノテーション追加
    if (annotations) {
      Object.entries(annotations).forEach(([key, value]) => {
        subsegment.addAnnotation(key, value);
      });
    }
    
    const result = fn();
    
    subsegment.close();
    
    return result;
  } catch (error) {
    subsegment.addError(error as Error);
    subsegment.close();
    throw error;
  }
}

/**
 * 現在のセグメントにメタデータを追加
 * 
 * @param key - メタデータキー
 * @param value - メタデータ値
 */
export function addMetadata(key: string, value: any): void {
  const segment = AWSXRay.getSegment();
  
  if (segment) {
    segment.addMetadata(key, value);
  } else {
    console.warn('No active X-Ray segment, metadata not added');
  }
}

/**
 * 現在のセグメントにアノテーションを追加
 * 
 * @param key - アノテーションキー
 * @param value - アノテーション値
 */
export function addAnnotation(key: string, value: string | number | boolean): void {
  const segment = AWSXRay.getSegment();
  
  if (segment) {
    segment.addAnnotation(key, value);
  } else {
    console.warn('No active X-Ray segment, annotation not added');
  }
}

/**
 * 現在のセグメントにエラーを追加
 * 
 * @param error - エラーオブジェクト
 * @param remote - リモートエラーかどうか（デフォルト: false）
 */
export function addError(error: Error, remote: boolean = false): void {
  const segment = AWSXRay.getSegment();
  
  if (segment) {
    segment.addError(error, remote);
  } else {
    console.warn('No active X-Ray segment, error not added');
  }
}

/**
 * トレースIDを取得
 * 
 * @returns トレースID（存在しない場合はundefined）
 */
export function getTraceId(): string | undefined {
  const segment = AWSXRay.getSegment();
  return segment?.trace_id;
}

/**
 * セグメントIDを取得
 * 
 * @returns セグメントID（存在しない場合はundefined）
 */
export function getSegmentId(): string | undefined {
  const segment = AWSXRay.getSegment();
  return segment?.id;
}

/**
 * Bedrock Agent実行をトレース
 * 
 * @param agentId - エージェントID
 * @param sessionId - セッションID
 * @param inputText - 入力テキスト
 * @param fn - 実行する関数
 * @returns 関数の実行結果
 */
export async function traceBedrockAgentExecution<T>(
  agentId: string,
  sessionId: string,
  inputText: string,
  fn: () => Promise<T>
): Promise<T> {
  return await captureAsyncFunc(
    'BedrockAgentExecution',
    fn,
    {
      inputText,
      inputLength: inputText.length,
    },
    {
      agentId,
      sessionId,
      service: 'bedrock-agent',
    }
  );
}

/**
 * データベースクエリをトレース
 * 
 * @param operation - 操作名（例: 'GetItem', 'PutItem'）
 * @param tableName - テーブル名
 * @param fn - 実行する関数
 * @returns 関数の実行結果
 */
export async function traceDatabaseQuery<T>(
  operation: string,
  tableName: string,
  fn: () => Promise<T>
): Promise<T> {
  return await captureAsyncFunc(
    `DynamoDB.${operation}`,
    fn,
    {
      tableName,
    },
    {
      operation,
      database: 'dynamodb',
    }
  );
}

/**
 * 外部API呼び出しをトレース
 * 
 * @param apiName - API名
 * @param endpoint - エンドポイント
 * @param fn - 実行する関数
 * @returns 関数の実行結果
 */
export async function traceExternalApiCall<T>(
  apiName: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  return await captureAsyncFunc(
    `ExternalAPI.${apiName}`,
    fn,
    {
      endpoint,
    },
    {
      apiName,
      type: 'external-api',
    }
  );
}
