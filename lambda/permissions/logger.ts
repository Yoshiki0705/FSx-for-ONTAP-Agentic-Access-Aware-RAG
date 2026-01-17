/**
 * Logger Service
 * 構造化ログ機能を提供
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum LogCategory {
  PERMISSION_CHECK = 'PERMISSION_CHECK',
  ONTAP_API = 'ONTAP_API',
  SSM_POWERSHELL = 'SSM_POWERSHELL',
  CACHE = 'CACHE',
  ERROR = 'ERROR',
  PERFORMANCE = 'PERFORMANCE',
}

export interface LogContext {
  userId?: string;
  path?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

export class Logger {
  private static instance: Logger;
  private context: LogContext = {};

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * グローバルコンテキストを設定
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * グローバルコンテキストをクリア
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * ログエントリを作成
   */
  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    additionalContext?: LogContext,
    error?: Error,
    duration?: number
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context: { ...this.context, ...additionalContext },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (duration !== undefined) {
      entry.duration = duration;
    }

    return entry;
  }

  /**
   * ログを出力
   */
  private log(entry: LogEntry): void {
    const logString = JSON.stringify(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
        console.error(logString);
        break;
    }
  }

  /**
   * 権限チェック開始ログ
   * Validates: Requirements 7.1
   */
  logPermissionCheckStart(userId: string, path: string, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.PERMISSION_CHECK,
      '権限チェック開始',
      {
        userId,
        path,
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * 権限チェック完了ログ
   * Validates: Requirements 7.6
   */
  logPermissionCheckComplete(
    userId: string,
    path: string,
    result: boolean,
    duration: number,
    context?: LogContext
  ): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.PERMISSION_CHECK,
      '権限チェック完了',
      {
        userId,
        path,
        result,
        ...context,
      },
      undefined,
      duration
    );
    this.log(entry);
  }

  /**
   * ONTAP REST API呼び出し開始ログ
   * Validates: Requirements 7.2
   */
  logOntapApiStart(endpoint: string, method: string, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.ONTAP_API,
      'ONTAP REST API呼び出し開始',
      {
        endpoint,
        method,
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * ONTAP REST API呼び出し完了ログ
   * Validates: Requirements 7.2
   */
  logOntapApiComplete(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.ONTAP_API,
      'ONTAP REST API呼び出し完了',
      {
        endpoint,
        method,
        statusCode,
        ...context,
      },
      undefined,
      duration
    );
    this.log(entry);
  }

  /**
   * ONTAP REST APIエラーログ
   * Validates: Requirements 7.2, 7.5
   */
  logOntapApiError(
    endpoint: string,
    method: string,
    error: Error,
    context?: LogContext
  ): void {
    const entry = this.createLogEntry(
      LogLevel.ERROR,
      LogCategory.ONTAP_API,
      'ONTAP REST APIエラー',
      {
        endpoint,
        method,
        ...context,
      },
      error
    );
    this.log(entry);
  }

  /**
   * SSM PowerShell実行開始ログ
   * Validates: Requirements 7.3
   */
  logSsmPowerShellStart(
    instanceId: string,
    scriptPath: string,
    context?: LogContext
  ): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.SSM_POWERSHELL,
      'SSM PowerShell実行開始',
      {
        instanceId,
        scriptPath,
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * SSM PowerShell実行完了ログ
   * Validates: Requirements 7.3
   */
  logSsmPowerShellComplete(
    instanceId: string,
    scriptPath: string,
    commandId: string,
    status: string,
    duration: number,
    context?: LogContext
  ): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.SSM_POWERSHELL,
      'SSM PowerShell実行完了',
      {
        instanceId,
        scriptPath,
        commandId,
        status,
        ...context,
      },
      undefined,
      duration
    );
    this.log(entry);
  }

  /**
   * SSM PowerShellエラーログ
   * Validates: Requirements 7.3, 7.5
   */
  logSsmPowerShellError(
    instanceId: string,
    scriptPath: string,
    error: Error,
    context?: LogContext
  ): void {
    const entry = this.createLogEntry(
      LogLevel.ERROR,
      LogCategory.SSM_POWERSHELL,
      'SSM PowerShellエラー',
      {
        instanceId,
        scriptPath,
        ...context,
      },
      error
    );
    this.log(entry);
  }

  /**
   * キャッシュヒットログ
   * Validates: Requirements 7.4
   */
  logCacheHit(userId: string, path: string, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.CACHE,
      'キャッシュヒット',
      {
        userId,
        path,
        cacheResult: 'hit',
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * キャッシュミスログ
   * Validates: Requirements 7.4
   */
  logCacheMiss(userId: string, path: string, reason: string, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.CACHE,
      'キャッシュミス',
      {
        userId,
        path,
        cacheResult: 'miss',
        reason,
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * キャッシュ保存ログ
   * Validates: Requirements 7.4
   */
  logCacheSave(userId: string, path: string, ttl: number, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.CACHE,
      'キャッシュ保存',
      {
        userId,
        path,
        ttl,
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * キャッシュ削除ログ
   * Validates: Requirements 7.4
   */
  logCacheDelete(userId: string, path: string, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.CACHE,
      'キャッシュ削除',
      {
        userId,
        path,
        ...context,
      }
    );
    this.log(entry);
  }

  /**
   * 汎用エラーログ
   * Validates: Requirements 7.5
   */
  logError(message: string, error: Error, context?: LogContext): void {
    const entry = this.createLogEntry(
      LogLevel.ERROR,
      LogCategory.ERROR,
      message,
      context,
      error
    );
    this.log(entry);
  }

  /**
   * 汎用警告ログ
   */
  logWarning(message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.WARN, LogCategory.ERROR, message, context);
    this.log(entry);
  }

  /**
   * 汎用情報ログ
   */
  logInfo(category: LogCategory, message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.INFO, category, message, context);
    this.log(entry);
  }

  /**
   * デバッグログ
   */
  logDebug(category: LogCategory, message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, category, message, context);
    this.log(entry);
  }

  /**
   * パフォーマンス測定開始
   */
  startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }
}

/**
 * グローバルロガーインスタンスを取得
 */
export function getLogger(): Logger {
  return Logger.getInstance();
}
