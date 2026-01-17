/**
 * タイムアウトハンドリングユーティリティ
 * 
 * AWS API呼び出しにタイムアウトを設定し、長時間実行される処理を制御します。
 */

import { BedrockErrorHandler } from './error-handler';

/**
 * タイムアウト設定
 */
export const TIMEOUT_CONFIG = {
  // API呼び出しのデフォルトタイムアウト（ミリ秒）
  DEFAULT_TIMEOUT: 30000, // 30秒
  
  // 長時間実行される操作のタイムアウト
  LONG_RUNNING_TIMEOUT: 60000, // 60秒
  
  // Agent更新操作のタイムアウト
  AGENT_UPDATE_TIMEOUT: 45000, // 45秒
  
  // モデルリスト取得のタイムアウト
  LIST_MODELS_TIMEOUT: 20000, // 20秒
};

/**
 * タイムアウト付きでPromiseを実行
 * 
 * @param promise 実行するPromise
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @param operation 操作名（エラーメッセージ用）
 * @returns Promiseの結果
 * @throws タイムアウトエラー
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation}が${timeoutMs / 1000}秒でタイムアウトしました。`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * リトライ付きでPromiseを実行
 * 
 * @param fn 実行する関数
 * @param maxRetries 最大リトライ回数
 * @param retryDelay リトライ間隔（ミリ秒）
 * @param operation 操作名（ログ用）
 * @returns 関数の実行結果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000,
  operation: string = 'Operation'
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 ${operation} 実行中 (試行 ${attempt}/${maxRetries})`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 最後の試行の場合はエラーをスロー
      if (attempt === maxRetries) {
        console.error(`❌ ${operation} 失敗 (${maxRetries}回試行後)`);
        throw lastError;
      }
      
      // リトライ可能なエラーかチェック
      if (!isRetryableError(error)) {
        console.error(`❌ ${operation} 失敗 (リトライ不可能なエラー)`);
        throw lastError;
      }
      
      // 指数バックオフでリトライ
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ ${delay}ms後にリトライします...`);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * タイムアウトとリトライを組み合わせて実行
 * 
 * @param fn 実行する関数
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @param maxRetries 最大リトライ回数
 * @param operation 操作名
 * @returns 関数の実行結果
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  maxRetries: number = 3,
  operation: string = 'Operation'
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs, operation),
    maxRetries,
    1000,
    operation
  );
}

/**
 * リトライ可能なエラーかどうかを判定
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // タイムアウトエラーはリトライ可能
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return true;
    }
    
    // AWS SDKのリトライ可能なエラー
    const retryableErrors = [
      'ThrottlingException',
      'ServiceUnavailableException',
      'InternalServerException',
      'RequestTimeout',
      'TimeoutError',
    ];
    
    return retryableErrors.includes(error.name);
  }
  
  return false;
}

/**
 * 指定時間スリープ
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * タイムアウトエラーのレスポンスを作成
 */
export function createTimeoutResponse(operation: string, timeoutSeconds: number) {
  const timeoutError = {
    name: 'TimeoutError',
    message: `${operation} operation timed out after ${timeoutSeconds} seconds`,
    code: 'RequestTimeout',
    statusCode: 408
  };
  
  return BedrockErrorHandler.handleError(timeoutError);
}
