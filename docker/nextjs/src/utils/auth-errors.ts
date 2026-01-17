/**
 * 認証エラー管理ユーティリティ
 * エラーの分類、ローカライゼーション、ログ記録を提供
 */

export enum AuthErrorCode {
  // バリデーションエラー
  EMPTY_USERNAME = 'EMPTY_USERNAME',
  EMPTY_PASSWORD = 'EMPTY_PASSWORD',
  INVALID_USERNAME_FORMAT = 'INVALID_USERNAME_FORMAT',
  USERNAME_TOO_LONG = 'USERNAME_TOO_LONG',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  
  // 認証エラー
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // システムエラー
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // 不明なエラー
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly userMessage: string;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * エラーメッセージマッピング
 */
const ERROR_MESSAGES: Record<AuthErrorCode, {
  message: string;
  userMessage: string;
  retryable: boolean;
  severity: AuthError['severity'];
}> = {
  [AuthErrorCode.EMPTY_USERNAME]: {
    message: 'Username is required',
    userMessage: 'ユーザー名を入力してください',
    retryable: true,
    severity: 'low'
  },
  [AuthErrorCode.EMPTY_PASSWORD]: {
    message: 'Password is required',
    userMessage: 'パスワードを入力してください',
    retryable: true,
    severity: 'low'
  },
  [AuthErrorCode.INVALID_USERNAME_FORMAT]: {
    message: 'Invalid username format',
    userMessage: 'ユーザー名の形式が正しくありません',
    retryable: true,
    severity: 'low'
  },
  [AuthErrorCode.USERNAME_TOO_LONG]: {
    message: 'Username exceeds maximum length',
    userMessage: 'ユーザー名が長すぎます',
    retryable: true,
    severity: 'low'
  },
  [AuthErrorCode.WEAK_PASSWORD]: {
    message: 'Password does not meet policy requirements',
    userMessage: 'パスワードがポリシー要件を満たしていません',
    retryable: true,
    severity: 'medium'
  },
  [AuthErrorCode.INVALID_CREDENTIALS]: {
    message: 'Invalid username or password',
    userMessage: 'ユーザー名またはパスワードが正しくありません',
    retryable: true,
    severity: 'medium'
  },
  [AuthErrorCode.ACCOUNT_LOCKED]: {
    message: 'Account is temporarily locked',
    userMessage: 'アカウントが一時的にロックされています。しばらく時間をおいて再度お試しください',
    retryable: true,
    severity: 'high'
  },
  [AuthErrorCode.ACCOUNT_DISABLED]: {
    message: 'Account is disabled',
    userMessage: 'アカウントが無効になっています。管理者にお問い合わせください',
    retryable: false,
    severity: 'high'
  },
  [AuthErrorCode.SESSION_EXPIRED]: {
    message: 'Session has expired',
    userMessage: 'セッションが期限切れです。再度サインインしてください',
    retryable: true,
    severity: 'medium'
  },
  [AuthErrorCode.NETWORK_ERROR]: {
    message: 'Network connection failed',
    userMessage: 'ネットワーク接続に問題があります。インターネット接続を確認してください',
    retryable: true,
    severity: 'medium'
  },
  [AuthErrorCode.SERVER_ERROR]: {
    message: 'Internal server error',
    userMessage: 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください',
    retryable: true,
    severity: 'high'
  },
  [AuthErrorCode.RATE_LIMIT_EXCEEDED]: {
    message: 'Too many requests',
    userMessage: 'リクエストが多すぎます。しばらく時間をおいて再度お試しください',
    retryable: true,
    severity: 'medium'
  },
  [AuthErrorCode.SERVICE_UNAVAILABLE]: {
    message: 'Service temporarily unavailable',
    userMessage: 'サービスが一時的に利用できません。しばらく時間をおいて再度お試しください',
    retryable: true,
    severity: 'high'
  },
  [AuthErrorCode.UNKNOWN_ERROR]: {
    message: 'An unexpected error occurred',
    userMessage: '予期しないエラーが発生しました。問題が続く場合は管理者にお問い合わせください',
    retryable: false,
    severity: 'critical'
  }
};

/**
 * 認証エラーファクトリー
 */
export class AuthErrorFactory {
  /**
   * エラーコードからAuthErrorを作成
   */
  static createError(
    code: AuthErrorCode,
    context?: Record<string, unknown>
  ): AuthError {
    const errorInfo = ERROR_MESSAGES[code];
    
    return {
      code,
      message: errorInfo.message,
      userMessage: errorInfo.userMessage,
      timestamp: new Date(),
      context,
      retryable: errorInfo.retryable,
      severity: errorInfo.severity
    };
  }

  /**
   * HTTPレスポンスからAuthErrorを作成
   */
  static createFromHttpResponse(
    response: Response,
    responseData?: any
  ): AuthError {
    let code: AuthErrorCode;
    let context: Record<string, unknown> = {
      status: response.status,
      statusText: response.statusText
    };

    switch (response.status) {
      case 400:
        code = AuthErrorCode.INVALID_CREDENTIALS;
        break;
      case 401:
        code = AuthErrorCode.INVALID_CREDENTIALS;
        break;
      case 403:
        code = AuthErrorCode.ACCOUNT_DISABLED;
        break;
      case 423:
        code = AuthErrorCode.ACCOUNT_LOCKED;
        break;
      case 429:
        code = AuthErrorCode.RATE_LIMIT_EXCEEDED;
        break;
      case 500:
      case 502:
      case 503:
        code = AuthErrorCode.SERVER_ERROR;
        break;
      case 504:
        code = AuthErrorCode.SERVICE_UNAVAILABLE;
        break;
      default:
        code = AuthErrorCode.UNKNOWN_ERROR;
    }

    if (responseData) {
      context.responseData = responseData;
    }

    return this.createError(code, context);
  }

  /**
   * ネットワークエラーからAuthErrorを作成
   */
  static createNetworkError(error: Error): AuthError {
    return this.createError(AuthErrorCode.NETWORK_ERROR, {
      originalError: error.message,
      stack: error.stack
    });
  }

  /**
   * バリデーションエラーからAuthErrorを作成
   */
  static createValidationError(
    field: 'username' | 'password',
    reason: string
  ): AuthError {
    let code: AuthErrorCode;

    if (field === 'username') {
      if (reason.includes('empty')) {
        code = AuthErrorCode.EMPTY_USERNAME;
      } else if (reason.includes('format')) {
        code = AuthErrorCode.INVALID_USERNAME_FORMAT;
      } else if (reason.includes('length')) {
        code = AuthErrorCode.USERNAME_TOO_LONG;
      } else {
        code = AuthErrorCode.INVALID_USERNAME_FORMAT;
      }
    } else {
      if (reason.includes('empty')) {
        code = AuthErrorCode.EMPTY_PASSWORD;
      } else {
        code = AuthErrorCode.WEAK_PASSWORD;
      }
    }

    return this.createError(code, { field, reason });
  }
}

/**
 * エラーログ記録
 */
export class AuthErrorLogger {
  private static readonly LOG_ENDPOINT = '/api/logs/auth-errors';

  /**
   * エラーをログに記録
   */
  static async logError(error: AuthError, userId?: string): Promise<void> {
    try {
      const logData = {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp.toISOString(),
        severity: error.severity,
        userId,
        context: error.context,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // 重要度が高い場合は即座に送信
      if (error.severity === 'high' || error.severity === 'critical') {
        await this.sendLog(logData);
      } else {
        // 軽微なエラーはバッチで送信
        this.queueLog(logData);
      }
    } catch (logError) {
      console.warn('エラーログの記録に失敗しました:', logError);
    }
  }

  /**
   * ログを即座に送信
   */
  private static async sendLog(logData: any): Promise<void> {
    await fetch(this.LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
    });
  }

  /**
   * ログをキューに追加（バッチ送信用）
   */
  private static queueLog(logData: any): void {
    const queue = this.getLogQueue();
    queue.push(logData);
    localStorage.setItem('auth_error_log_queue', JSON.stringify(queue));

    // キューが一定数に達したら送信
    if (queue.length >= 10) {
      this.flushLogQueue();
    }
  }

  /**
   * ログキューを取得
   */
  private static getLogQueue(): any[] {
    try {
      const queueData = localStorage.getItem('auth_error_log_queue');
      return queueData ? JSON.parse(queueData) : [];
    } catch {
      return [];
    }
  }

  /**
   * ログキューをフラッシュ
   */
  private static async flushLogQueue(): Promise<void> {
    const queue = this.getLogQueue();
    if (queue.length === 0) return;

    try {
      await this.sendLog({ batch: queue });
      localStorage.removeItem('auth_error_log_queue');
    } catch (error) {
      console.warn('ログキューのフラッシュに失敗しました:', error);
    }
  }
}