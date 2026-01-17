/**
 * Bedrock API 監査ログ機能
 */

export interface AuditLogEntry {
  timestamp: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  success: boolean;
  error?: string;
}

export class AuditLogger {
  /**
   * API呼び出しをログに記録
   */
  static logApiCall(entry: Omit<AuditLogEntry, 'timestamp'>) {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // 本番環境では適切なログシステムに送信
    console.log('Bedrock Audit Log:', JSON.stringify(logEntry));
  }

  /**
   * Agent呼び出しをログに記録
   */
  static logAgentCall(
    agentId: string,
    sessionId: string,
    message: string,
    success: boolean,
    error?: string
  ) {
    this.logApiCall({
      action: 'agent_invoke',
      resource: `agent:${agentId}`,
      sessionId,
      details: {
        messageLength: message.length,
      },
      success,
      error,
    });
  }

  /**
   * モデル呼び出しをログに記録
   */
  static logModelCall(
    modelId: string,
    region: string,
    success: boolean,
    error?: string
  ) {
    this.logApiCall({
      action: 'model_invoke',
      resource: `model:${modelId}`,
      details: {
        region,
      },
      success,
      error,
    });
  }

  /**
   * モデルリストアクセスをログに記録
   */
  static logModelListAccess(
    region: string,
    success: boolean,
    error?: string
  ) {
    this.logApiCall({
      action: 'model_list',
      resource: `region:${region}`,
      details: {
        region,
      },
      success,
      error,
    });
  }
}

export function logModelListAccess(
  region: string,
  success: boolean,
  error?: string
) {
  AuditLogger.logModelListAccess(region, success, error);
}