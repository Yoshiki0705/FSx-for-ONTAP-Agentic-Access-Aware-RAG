/**
 * エラーハンドリングとフォールバック機能
 * 
 * このモジュールは、リージョン管理システム全体で発生する可能性のある
 * エラーを分類し、適切な処理とフォールバック戦略を提供します。
 */

// エラーレベルの定義
export enum ErrorLevel {
  CRITICAL = 'critical',    // システム停止レベル
  WARNING = 'warning',      // 機能制限レベル
  INFO = 'info'            // 情報通知レベル
}

// エラーカテゴリの定義
export enum ErrorCategory {
  REGION_CONFIG = 'region_config',      // リージョン設定関連
  MODEL_CONFIG = 'model_config',        // モデル設定関連
  STORAGE = 'storage',                  // ストレージ関連
  API = 'api',                         // API通信関連
  VALIDATION = 'validation',            // バリデーション関連
  NETWORK = 'network',                 // ネットワーク関連
  AUTHENTICATION = 'authentication'     // 認証関連
}

// エラー情報の構造
export interface ErrorInfo {
  id: string;                    // エラー識別子
  level: ErrorLevel;             // エラーレベル
  category: ErrorCategory;       // エラーカテゴリ
  message: string;               // ユーザー向けメッセージ
  technicalMessage: string;      // 技術的詳細メッセージ
  timestamp: Date;               // 発生時刻
  context?: Record<string, any>; // エラー発生時のコンテキスト
  recoverable: boolean;          // 復旧可能かどうか
  fallbackAction?: string;       // フォールバック処理の説明
}

// フォールバック戦略の定義
export interface FallbackStrategy {
  id: string;
  description: string;
  execute: () => Promise<any>;
  condition: (error: ErrorInfo) => boolean;
}

/**
 * エラーハンドラークラス
 * 
 * システム全体のエラー処理を統括し、適切なフォールバック戦略を実行します。
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];
  private fallbackStrategies: FallbackStrategy[] = [];
  private maxLogSize = 100; // ログの最大保持数

  private constructor() {
    this.initializeFallbackStrategies();
  }

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * エラーの処理
   * 
   * @param error - 処理するエラー情報
   * @returns 処理結果とフォールバック情報
   */
  public async handleError(error: ErrorInfo): Promise<{
    handled: boolean;
    fallbackExecuted: boolean;
    fallbackResult?: any;
    userMessage: string;
  }> {
    // エラーログに記録
    this.logError(error);

    // エラーレベルに応じた処理
    const result = {
      handled: true,
      fallbackExecuted: false,
      fallbackResult: undefined,
      userMessage: error.message
    };

    try {
      switch (error.level) {
        case ErrorLevel.CRITICAL:
          result.userMessage = await this.handleCriticalError(error);
          break;
        case ErrorLevel.WARNING:
          result.userMessage = await this.handleWarningError(error);
          break;
        case ErrorLevel.INFO:
          result.userMessage = await this.handleInfoError(error);
          break;
      }

      // フォールバック戦略の実行
      if (error.recoverable) {
        const fallbackResult = await this.executeFallback(error);
        if (fallbackResult) {
          result.fallbackExecuted = true;
          result.fallbackResult = fallbackResult;
        }
      }

    } catch (handlingError) {
      console.error('[ErrorHandler] Error during error handling:', handlingError);
      result.handled = false;
      result.userMessage = 'システムエラーが発生しました。ページを再読み込みしてください。';
    }

    return result;
  }

  /**
   * Criticalレベルエラーの処理
   */
  private async handleCriticalError(error: ErrorInfo): Promise<string> {
    console.error('[ErrorHandler] CRITICAL ERROR:', error);
    
    // 重要なエラーの場合は、システムを安全な状態に戻す
    switch (error.category) {
      case ErrorCategory.REGION_CONFIG:
        return 'リージョン設定に重大な問題が発生しました。デフォルト設定に戻します。';
      case ErrorCategory.MODEL_CONFIG:
        return 'モデル設定に重大な問題が発生しました。利用可能なモデルを再取得します。';
      case ErrorCategory.STORAGE:
        return 'データ保存に問題が発生しました。設定がリセットされる可能性があります。';
      case ErrorCategory.API:
        return 'サーバーとの通信に重大な問題が発生しました。しばらく待ってから再試行してください。';
      default:
        return 'システムに重大な問題が発生しました。ページを再読み込みしてください。';
    }
  }

  /**
   * Warningレベルエラーの処理
   */
  private async handleWarningError(error: ErrorInfo): Promise<string> {
    console.warn('[ErrorHandler] WARNING:', error);
    
    switch (error.category) {
      case ErrorCategory.REGION_CONFIG:
        return 'リージョン設定に問題があります。一部機能が制限される可能性があります。';
      case ErrorCategory.MODEL_CONFIG:
        return 'モデル設定に問題があります。代替モデルを使用します。';
      case ErrorCategory.STORAGE:
        return '設定の保存に問題があります。変更が保持されない可能性があります。';
      case ErrorCategory.API:
        return 'サーバーとの通信に問題があります。キャッシュされた情報を使用します。';
      default:
        return '一部機能に問題が発生していますが、継続して利用できます。';
    }
  }

  /**
   * Infoレベルエラーの処理
   */
  private async handleInfoError(error: ErrorInfo): Promise<string> {
    console.info('[ErrorHandler] INFO:', error);
    return error.message;
  }

  /**
   * フォールバック戦略の実行
   */
  private async executeFallback(error: ErrorInfo): Promise<any> {
    const applicableStrategies = this.fallbackStrategies.filter(
      strategy => strategy.condition(error)
    );

    for (const strategy of applicableStrategies) {
      try {
        console.log(`[ErrorHandler] Executing fallback strategy: ${strategy.id}`);
        const result = await strategy.execute();
        console.log(`[ErrorHandler] Fallback strategy ${strategy.id} succeeded`);
        return result;
      } catch (fallbackError) {
        console.error(`[ErrorHandler] Fallback strategy ${strategy.id} failed:`, fallbackError);
      }
    }

    return null;
  }

  /**
   * エラーログの記録
   */
  private logError(error: ErrorInfo): void {
    this.errorLog.push(error);
    
    // ログサイズの制限
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  /**
   * フォールバック戦略の初期化
   */
  private initializeFallbackStrategies(): void {
    // リージョン設定のフォールバック
    this.fallbackStrategies.push({
      id: 'region_config_fallback',
      description: 'リージョン設定をデフォルトに戻す',
      condition: (error) => error.category === ErrorCategory.REGION_CONFIG,
      execute: async () => {
        // デフォルトリージョン（東京）に戻す
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedRegion', 'ap-northeast-1');
        }
        return { region: 'ap-northeast-1', fallback: true };
      }
    });

    // モデル設定のフォールバック
    this.fallbackStrategies.push({
      id: 'model_config_fallback',
      description: 'モデル設定をデフォルトに戻す',
      condition: (error) => error.category === ErrorCategory.MODEL_CONFIG,
      execute: async () => {
        // デフォルトモデルに戻す
        return { modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', fallback: true };
      }
    });

    // ストレージのフォールバック
    this.fallbackStrategies.push({
      id: 'storage_fallback',
      description: 'ストレージをクリアして初期化',
      condition: (error) => error.category === ErrorCategory.STORAGE,
      execute: async () => {
        if (typeof window !== 'undefined') {
          // 問題のあるストレージデータをクリア
          localStorage.removeItem('regionConfig');
          localStorage.removeItem('modelConfig');
        }
        return { cleared: true, fallback: true };
      }
    });

    // API通信のフォールバック
    this.fallbackStrategies.push({
      id: 'api_fallback',
      description: 'キャッシュされたデータを使用',
      condition: (error) => error.category === ErrorCategory.API,
      execute: async () => {
        // キャッシュされたデータを返す（実装は各コンポーネントで行う）
        return { useCache: true, fallback: true };
      }
    });
  }

  /**
   * エラーログの取得
   */
  public getErrorLog(): ErrorInfo[] {
    return [...this.errorLog];
  }

  /**
   * エラーログのクリア
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * エラー統計の取得
   */
  public getErrorStats(): {
    total: number;
    byLevel: Record<ErrorLevel, number>;
    byCategory: Record<ErrorCategory, number>;
    recent: ErrorInfo[];
  } {
    const stats = {
      total: this.errorLog.length,
      byLevel: {
        [ErrorLevel.CRITICAL]: 0,
        [ErrorLevel.WARNING]: 0,
        [ErrorLevel.INFO]: 0
      },
      byCategory: {
        [ErrorCategory.REGION_CONFIG]: 0,
        [ErrorCategory.MODEL_CONFIG]: 0,
        [ErrorCategory.STORAGE]: 0,
        [ErrorCategory.API]: 0,
        [ErrorCategory.VALIDATION]: 0,
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.AUTHENTICATION]: 0
      },
      recent: this.errorLog.slice(-10) // 最新10件
    };

    this.errorLog.forEach(error => {
      stats.byLevel[error.level]++;
      stats.byCategory[error.category]++;
    });

    return stats;
  }
}

/**
 * エラー作成のヘルパー関数
 */
export function createError(
  level: ErrorLevel,
  category: ErrorCategory,
  message: string,
  technicalMessage: string,
  context?: Record<string, any>,
  recoverable: boolean = true
): ErrorInfo {
  return {
    id: `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    level,
    category,
    message,
    technicalMessage,
    timestamp: new Date(),
    context,
    recoverable
  };
}

/**
 * よく使用されるエラーの定義済み作成関数
 */
export const ErrorFactory = {
  // リージョン関連エラー
  invalidRegion: (region: string) => createError(
    ErrorLevel.WARNING,
    ErrorCategory.REGION_CONFIG,
    `選択されたリージョン「${region}」はサポートされていません。`,
    `Invalid region specified: ${region}`,
    { region },
    true
  ),

  regionConfigLoadFailed: (error: any) => createError(
    ErrorLevel.CRITICAL,
    ErrorCategory.REGION_CONFIG,
    'リージョン設定の読み込みに失敗しました。',
    `Failed to load region configuration: ${error.message}`,
    { originalError: error },
    true
  ),

  // モデル関連エラー
  modelNotAvailable: (modelId: string, region: string) => createError(
    ErrorLevel.WARNING,
    ErrorCategory.MODEL_CONFIG,
    `選択されたモデル「${modelId}」は「${region}」リージョンでは利用できません。`,
    `Model ${modelId} not available in region ${region}`,
    { modelId, region },
    true
  ),

  modelConfigLoadFailed: (error: any) => createError(
    ErrorLevel.CRITICAL,
    ErrorCategory.MODEL_CONFIG,
    'モデル設定の読み込みに失敗しました。',
    `Failed to load model configuration: ${error.message}`,
    { originalError: error },
    true
  ),

  // ストレージ関連エラー
  storageAccessFailed: (operation: string, error: any) => createError(
    ErrorLevel.WARNING,
    ErrorCategory.STORAGE,
    '設定の保存または読み込みに失敗しました。',
    `Storage ${operation} failed: ${error.message}`,
    { operation, originalError: error },
    true
  ),

  storageCorrupted: (key: string) => createError(
    ErrorLevel.WARNING,
    ErrorCategory.STORAGE,
    '保存された設定データが破損しています。初期設定に戻します。',
    `Corrupted storage data for key: ${key}`,
    { key },
    true
  ),

  // API関連エラー
  apiRequestFailed: (endpoint: string, status: number, error: any) => createError(
    ErrorLevel.WARNING,
    ErrorCategory.API,
    'サーバーとの通信に失敗しました。',
    `API request to ${endpoint} failed with status ${status}: ${error.message}`,
    { endpoint, status, originalError: error },
    true
  ),

  apiTimeout: (endpoint: string) => createError(
    ErrorLevel.WARNING,
    ErrorCategory.API,
    'サーバーからの応答がタイムアウトしました。',
    `API request to ${endpoint} timed out`,
    { endpoint },
    true
  ),

  // ネットワーク関連エラー
  networkUnavailable: () => createError(
    ErrorLevel.CRITICAL,
    ErrorCategory.NETWORK,
    'ネットワーク接続が利用できません。',
    'Network connection unavailable',
    {},
    false
  ),

  // バリデーション関連エラー
  validationFailed: (field: string, value: any, rule: string) => createError(
    ErrorLevel.INFO,
    ErrorCategory.VALIDATION,
    `入力値「${field}」が正しくありません。`,
    `Validation failed for field ${field} with value ${value}: ${rule}`,
    { field, value, rule },
    true
  )
};

// デフォルトエクスポート
export default ErrorHandler;