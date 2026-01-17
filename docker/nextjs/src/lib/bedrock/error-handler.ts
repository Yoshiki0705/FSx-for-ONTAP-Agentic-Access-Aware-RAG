/**
 * Bedrock API エラーハンドラー
 */

export interface BedrockError {
  code: string;
  message: string;
  statusCode?: number;
  requestId?: string;
}

export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class BedrockErrorHandler {
  /**
   * エラーをログに記録し、適切なレスポンスを返す
   */
  static handleError(error: any): BedrockError {
    console.error('Bedrock API Error:', error);

    // AWS SDK エラーの場合
    if (error.$metadata) {
      return {
        code: error.name || 'BedrockError',
        message: error.message || 'Unknown Bedrock error',
        statusCode: error.$metadata.httpStatusCode,
        requestId: error.$metadata.requestId,
      };
    }

    // 一般的なエラーの場合
    return {
      code: 'InternalError',
      message: error.message || 'Internal server error',
      statusCode: 500,
    };
  }

  /**
   * エラーレスポンスを生成
   */
  static createErrorResponse(error: BedrockError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    };
  }

  /**
   * エラーをログに記録
   */
  static logError(error: any, context?: string) {
    const contextPrefix = context ? `[${context}] ` : '';
    console.error(`${contextPrefix}Error:`, error);
  }
}

export function logError(error: any, context?: string) {
  BedrockErrorHandler.logError(error, context);
}