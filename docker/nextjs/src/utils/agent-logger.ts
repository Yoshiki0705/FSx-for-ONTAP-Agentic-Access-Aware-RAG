/**
 * Agent ログ出力標準化 - Permission-aware RAG System
 * 
 * 機能:
 * - 統一されたログ形式
 * - ログレベル管理
 * - デバッグ情報の構造化
 */

import { RawAgentInfo, NormalizedAgentInfo, AgentValidationResult } from '@/types/bedrock-agent';

// ログレベル定義
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ログエントリの構造
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  action: string;
  message: string;
  data?: any;
  agentId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Agent専用ログ出力クラス
 */
export class AgentLogger {
  private static instance: AgentLogger;
  private logLevel: LogLevel = 'info';
  private component: string = 'AgentSystem';

  private constructor() {
    // 環境変数からログレベルを設定
    const envLogLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel;
    if (envLogLevel && ['debug', 'info', 'warn', 'error'].includes(envLogLevel)) {
      this.logLevel = envLogLevel;
    }
  }

  public static getInstance(): AgentLogger {
    if (!AgentLogger.instance) {
      AgentLogger.instance = new AgentLogger();
    }
    return AgentLogger.instance;
  }

  /**
   * ログレベルの設定
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * コンポーネント名の設定
   */
  public setComponent(component: string): void {
    this.component = component;
  }

  /**
   * ログエントリの作成
   */
  private createLogEntry(
    level: LogLevel,
    action: string,
    message: string,
    data?: any,
    agentId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      action,
      message,
      data,
      agentId,
      userId: this.getCurrentUserId(),
      sessionId: this.getCurrentSessionId()
    };
  }

  /**
   * ログ出力の実行
   */
  private log(entry: LogEntry): void {
    const logLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = logLevels.indexOf(this.logLevel);
    const entryLevelIndex = logLevels.indexOf(entry.level);

    if (entryLevelIndex >= currentLevelIndex) {
      const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.component}] ${entry.action}: ${entry.message}`;
      
      switch (entry.level) {
        case 'debug':
          console.debug(logMessage, entry.data);
          break;
        case 'info':
          console.info(logMessage, entry.data);
          break;
        case 'warn':
          console.warn(logMessage, entry.data);
          break;
        case 'error':
          console.error(logMessage, entry.data);
          break;
      }
    }
  }

  /**
   * Agent情報の正規化ログ
   */
  public logAgentNormalization(
    agentInfo: RawAgentInfo | null,
    normalizedInfo: NormalizedAgentInfo | null,
    validationResult?: AgentValidationResult
  ): void {
    const entry = this.createLogEntry(
      'debug',
      'AgentNormalization',
      normalizedInfo ? 'Agent情報の正規化が完了しました' : 'Agent情報の正規化に失敗しました',
      {
        raw: agentInfo,
        normalized: normalizedInfo,
        validation: validationResult
      },
      agentInfo?.agentId
    );
    this.log(entry);
  }

  /**
   * バリデーションエラーのログ
   */
  public logValidationError(
    agentInfo: any,
    validationResult: AgentValidationResult
  ): void {
    const entry = this.createLogEntry(
      'error',
      'ValidationError',
      `Agent情報のバリデーションに失敗しました: ${validationResult.errors.join(', ')}`,
      {
        agentInfo,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      },
      agentInfo?.agentId
    );
    this.log(entry);
  }

  /**
   * バリデーション警告のログ
   */
  public logValidationWarning(
    agentInfo: RawAgentInfo,
    validationResult: AgentValidationResult
  ): void {
    if (validationResult.warnings.length > 0) {
      const entry = this.createLogEntry(
        'warn',
        'ValidationWarning',
        `Agent情報に警告があります: ${validationResult.warnings.join(', ')}`,
        {
          agentInfo,
          warnings: validationResult.warnings
        },
        agentInfo.agentId
      );
      this.log(entry);
    }
  }

  /**
   * Agent作成のログ
   */
  public logAgentCreation(agentId: string, success: boolean, error?: string): void {
    const entry = this.createLogEntry(
      success ? 'info' : 'error',
      'AgentCreation',
      success ? 'Agentの作成が完了しました' : `Agentの作成に失敗しました: ${error}`,
      { success, error },
      agentId
    );
    this.log(entry);
  }

  /**
   * Agent更新のログ
   */
  public logAgentUpdate(agentId: string, success: boolean, error?: string): void {
    const entry = this.createLogEntry(
      success ? 'info' : 'error',
      'AgentUpdate',
      success ? 'Agentの更新が完了しました' : `Agentの更新に失敗しました: ${error}`,
      { success, error },
      agentId
    );
    this.log(entry);
  }

  /**
   * Agent削除のログ
   */
  public logAgentDeletion(agentId: string, success: boolean, error?: string): void {
    const entry = this.createLogEntry(
      success ? 'info' : 'error',
      'AgentDeletion',
      success ? 'Agentの削除が完了しました' : `Agentの削除に失敗しました: ${error}`,
      { success, error },
      agentId
    );
    this.log(entry);
  }

  /**
   * Agent情報取得のログ
   */
  public logAgentRetrieval(agentId: string, success: boolean, error?: string): void {
    const entry = this.createLogEntry(
      success ? 'debug' : 'error',
      'AgentRetrieval',
      success ? 'Agent情報の取得が完了しました' : `Agent情報の取得に失敗しました: ${error}`,
      { success, error },
      agentId
    );
    this.log(entry);
  }

  /**
   * パフォーマンス測定のログ
   */
  public logPerformance(action: string, duration: number, agentId?: string): void {
    const entry = this.createLogEntry(
      'debug',
      'Performance',
      `${action}の実行時間: ${duration}ms`,
      { action, duration },
      agentId
    );
    this.log(entry);
  }

  /**
   * 現在のユーザーIDを取得（実装は環境に依存）
   */
  private getCurrentUserId(): string | undefined {
    // TODO: 実際の認証システムから取得
    return undefined;
  }

  /**
   * 現在のセッションIDを取得（実装は環境に依存）
   */
  private getCurrentSessionId(): string | undefined {
    // TODO: 実際のセッション管理システムから取得
    return undefined;
  }
}

// シングルトンインスタンスのエクスポート
export const agentLogger = AgentLogger.getInstance();