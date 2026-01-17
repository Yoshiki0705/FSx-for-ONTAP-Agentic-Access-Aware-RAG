/**
 * エラーハンドリングユーティリティ
 * Permission APIのエラー処理とリトライロジック
 * 
 * Validates: Requirements 5.3, 5.4, 8.1, 8.2, 8.5
 */

import { APIGatewayProxyResult } from 'aws-lambda';

// エラーレスポンス型定義
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

// カスタムエラークラス
export class FsxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FsxUnavailableError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * エラーレスポンスを作成
 * Validates: Requirements 8.1, 8.2
 */
export function createErrorResponse(
  statusCode: number,
  error: string,
  message: string,
  requestId?: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    requestId,
  };

  console.error('Error response:', JSON.stringify(errorResponse, null, 2));

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'X-Request-Id': requestId || 'unknown',
    },
    body: JSON.stringify(errorResponse),
  };
}

/**
 * エラーをAPIGatewayProxyResultに変換
 * Validates: Requirements 5.3, 5.4, 8.1, 8.2
 */
export function handleError(error: Error, requestId?: string): APIGatewayProxyResult {
  console.error('Handling error:', error);

  // エラータイプに応じた適切なレスポンスを返す
  if (error instanceof FsxUnavailableError) {
    return createErrorResponse(
      503,
      'Service Unavailable',
      'FSx for ONTAP is temporarily unavailable. Please try again later.',
      requestId
    );
  }

  if (error instanceof UnauthorizedError) {
    return createErrorResponse(
      401,
      'Unauthorized',
      'Invalid or expired session token. Please log in again.',
      requestId
    );
  }

  if (error instanceof InvalidRequestError) {
    return createErrorResponse(
      400,
      'Bad Request',
      error.message,
      requestId
    );
  }

  if (error instanceof NetworkError) {
    return createErrorResponse(
      503,
      'Service Unavailable',
      'Network error occurred. Please try again later.',
      requestId
    );
  }

  // その他のエラー
  return createErrorResponse(
    500,
    'Internal Server Error',
    'An unexpected error occurred while processing your request',
    requestId
  );
}

/**
 * リトライロジック（Exponential Backoff）
 * Validates: Requirements 8.5
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = [NetworkError, FsxUnavailableError],
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);

      // リトライ可能なエラーかチェック
      const isRetryable = retryableErrors.some(
        ErrorClass => error instanceof ErrorClass
      );

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential Backoff
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * タイムアウト付き操作実行
 * Validates: Requirements 8.5
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * サーキットブレーカーパターン
 * 連続したエラーが発生した場合、一時的にリクエストを遮断
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1分
    private readonly resetTimeout: number = 30000 // 30秒
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // OPEN状態の場合、リセットタイムアウトをチェック
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime > this.resetTimeout) {
        console.log('Circuit breaker: Transitioning to HALF_OPEN');
        this.state = 'HALF_OPEN';
      } else {
        throw new FsxUnavailableError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      
      // 成功した場合、カウンターをリセット
      if (this.state === 'HALF_OPEN') {
        console.log('Circuit breaker: Transitioning to CLOSED');
        this.state = 'CLOSED';
      }
      this.failureCount = 0;
      this.lastFailureTime = null;
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      console.error(`Circuit breaker: Failure count ${this.failureCount}/${this.threshold}`);

      // 閾値を超えた場合、OPEN状態に遷移
      if (this.failureCount >= this.threshold) {
        console.error('Circuit breaker: Transitioning to OPEN');
        this.state = 'OPEN';
      }

      throw error;
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED';
  }
}

// ヘルパー関数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 型定義
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: Array<new (message: string) => Error>;
}

// エクスポート
export { sleep };
