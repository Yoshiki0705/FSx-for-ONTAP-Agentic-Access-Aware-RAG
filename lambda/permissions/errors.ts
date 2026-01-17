/**
 * FSx for ONTAPハイブリッド権限管理API - エラークラス
 * 
 * このファイルは、権限管理システムで使用される全てのカスタムエラークラスを定義します。
 * 各エラークラスは、特定のエラー状況を表現し、適切なHTTPステータスコードと
 * エラーメッセージを提供します。
 */

/**
 * 権限エラーの基底クラス
 * 
 * 全ての権限関連エラーの基底クラスです。
 * HTTPステータスコードとエラーコードを含みます。
 */
export class PermissionError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'PERMISSION_ERROR',
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;

    // TypeScriptのエラースタックトレースを正しく設定
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * エラーをJSON形式に変換
   */
  toJSON(): Record<string, any> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 認証エラー
 * 
 * ユーザーが存在しない、またはSID情報が取得できない場合にスローされます。
 * HTTPステータスコード: 401 Unauthorized
 * 
 * 使用例:
 * - user-access-tableにユーザーが存在しない
 * - SID情報が不完全（userSIDまたはSID配列が欠落）
 * - ユーザーアカウントが無効化されている
 */
export class UnauthorizedError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

/**
 * FSx利用不可エラー
 * 
 * FSx for ONTAPまたはONTAP REST APIが利用できない場合にスローされます。
 * HTTPステータスコード: 503 Service Unavailable
 * 
 * 使用例:
 * - ONTAP Management Endpointに接続できない
 * - ONTAP REST APIがエラーを返す（4xx, 5xx）
 * - ネットワーク接続エラー
 * - FSxファイルシステムがメンテナンス中
 */
export class FsxUnavailableError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 503, 'FSX_UNAVAILABLE', details);
  }
}

/**
 * タイムアウトエラー
 * 
 * ONTAP REST APIまたはSSM PowerShellの実行がタイムアウトした場合にスローされます。
 * HTTPステータスコード: 504 Gateway Timeout
 * 
 * 使用例:
 * - ONTAP REST API呼び出しが10秒以内に完了しない
 * - SSM PowerShell実行が30秒以内に完了しない
 * - SSMコマンド結果の取得がタイムアウト
 */
export class TimeoutError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 504, 'TIMEOUT', details);
  }
}

/**
 * 設定エラー
 * 
 * 環境変数やSecrets Managerの設定が不正な場合にスローされます。
 * HTTPステータスコード: 500 Internal Server Error
 * 
 * 使用例:
 * - 必須環境変数が設定されていない
 * - Secrets Managerから認証情報を取得できない
 * - 環境変数の値が不正な形式
 * - DynamoDBテーブル名が存在しない
 */
export class ConfigurationError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 500, 'CONFIGURATION_ERROR', details);
  }
}

/**
 * パース エラー
 * 
 * ONTAP REST APIまたはPowerShellのレスポンスをパースできない場合にスローされます。
 * HTTPステータスコード: 500 Internal Server Error
 * 
 * 使用例:
 * - ONTAP REST APIのレスポンスが期待される形式でない
 * - PowerShell出力のJSON解析に失敗
 * - 必須フィールドが欠落している
 */
export class ParseError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 500, 'PARSE_ERROR', details);
  }
}

/**
 * バリデーションエラー
 * 
 * リクエストパラメータが不正な場合にスローされます。
 * HTTPステータスコード: 400 Bad Request
 * 
 * 使用例:
 * - userIdが空文字列
 * - pathにパストラバーサル攻撃の可能性がある文字列が含まれる
 * - protocolが'SMB'または'NFS'以外
 * - 必須パラメータが欠落
 */
export class ValidationError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * キャッシュエラー
 * 
 * DynamoDBキャッシュの読み書きに失敗した場合にスローされます。
 * このエラーは通常、ログに記録されるのみで、処理は続行されます。
 * HTTPステータスコード: 500 Internal Server Error
 * 
 * 使用例:
 * - DynamoDBへの接続エラー
 * - キャッシュテーブルが存在しない
 * - IAM権限不足
 */
export class CacheError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 500, 'CACHE_ERROR', details);
  }
}

/**
 * SSMエラー
 * 
 * SSM Run Commandの実行に失敗した場合にスローされます。
 * HTTPステータスコード: 503 Service Unavailable
 * 
 * 使用例:
 * - EC2インスタンスがSSM管理下にない
 * - PowerShellスクリプトの実行エラー
 * - SSMコマンドがFailedまたはCancelledステータスを返す
 * - EC2インスタンスが停止している
 */
export class SsmError extends PermissionError {
  constructor(message: string, details?: any) {
    super(message, 503, 'SSM_ERROR', details);
  }
}

/**
 * エラーハンドラーユーティリティ
 * 
 * エラーを適切にログに記録し、クライアントに返すためのユーティリティ関数です。
 */
export class ErrorHandler {
  /**
   * エラーをログに記録
   * 
   * @param error - エラーオブジェクト
   * @param context - コンテキスト情報（オプション）
   */
  static logError(error: Error, context?: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    };

    if (error instanceof PermissionError) {
      console.error('Permission Error:', JSON.stringify({
        ...logEntry,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        details: error.details
      }, null, 2));
    } else {
      console.error('Unexpected Error:', JSON.stringify(logEntry, null, 2));
    }
  }

  /**
   * エラーをHTTPレスポンス形式に変換
   * 
   * @param error - エラーオブジェクト
   * @returns HTTPレスポンスオブジェクト
   */
  static toHttpResponse(error: Error): {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  } {
    let statusCode = 500;
    let errorResponse: Record<string, any> = {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    if (error instanceof PermissionError) {
      statusCode = error.statusCode;
      errorResponse = error.toJSON();
    } else {
      // 予期しないエラーの場合、詳細を隠す
      errorResponse.message = error.message || 'An unexpected error occurred';
      errorResponse.error = error.name || 'Error';
    }

    return {
      statusCode,
      body: JSON.stringify(errorResponse),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    };
  }

  /**
   * エラーが再試行可能かを判定
   * 
   * @param error - エラーオブジェクト
   * @returns 再試行可能な場合true
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }

    if (error instanceof FsxUnavailableError) {
      return true;
    }

    if (error instanceof SsmError) {
      return true;
    }

    if (error instanceof CacheError) {
      return false; // キャッシュエラーは再試行しない
    }

    return false;
  }

  /**
   * エラーメッセージをサニタイズ
   * 
   * 機密情報（パスワード、SID等）をマスキングします。
   * 
   * @param message - エラーメッセージ
   * @returns サニタイズされたメッセージ
   */
  static sanitizeMessage(message: string): string {
    // パスワードをマスキング
    let sanitized = message.replace(/password[=:]\s*[^\s,}]+/gi, 'password=***');
    
    // SIDをマスキング（S-1-5-21-xxx-xxx-xxx-xxxx形式）
    sanitized = sanitized.replace(/S-1-5-21-\d+-\d+-\d+-\d+/g, 'S-1-5-21-***');
    
    // IPアドレスをマスキング
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '***.***.***.**');
    
    return sanitized;
  }
}
