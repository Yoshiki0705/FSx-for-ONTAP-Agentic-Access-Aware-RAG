/**
 * AgentCore Client Service
 * 
 * Next.js UIとAgentCore Runtime APIを統合するクライアントサービス
 * 責任分離: UI/UX処理はNext.js、AI処理はAgentCore Runtime
 */

export interface AgentCoreConfig {
  enabled: boolean;
  apiEndpoint: string;
  timeout: number;
  retryAttempts: number;
  fallbackToBedrockDirect: boolean;
}

export interface AgentCoreRequest {
  input: string;
  context?: {
    sessionId?: string;
    userId?: string;
    preferences?: Record<string, any>;
  };
  settings?: {
    model?: string;
    region?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentCoreResponse {
  success: boolean;
  response?: string;
  metadata?: {
    model: string;
    tokens: number;
    latency: number;
    source: 'agentcore' | 'bedrock-direct';
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface UIResponse {
  content: string;
  metadata: {
    model: string;
    tokens: number;
    latency: number;
    source: 'agentcore' | 'bedrock-direct';
  };
  shouldSave: boolean;
  displayOptions?: {
    streaming?: boolean;
    formatting?: 'markdown' | 'plain';
  };
}

/**
 * AgentCore Client
 * 
 * Next.js UIからAgentCore Runtime APIへの接続を管理
 * エラーハンドリング、フォールバック、レスポンス最適化を提供
 */
export class AgentCoreClient {
  private config: AgentCoreConfig;
  private fallbackClient?: any; // Bedrock直接呼び出し用

  constructor(config: AgentCoreConfig) {
    this.config = config;
    
    // フォールバック用のBedrock直接クライアントを初期化
    if (config.fallbackToBedrockDirect) {
      this.initializeFallbackClient();
    }
  }

  /**
   * ユーザー入力を処理し、UIに最適化されたレスポンスを返す
   * 
   * 処理フロー:
   * 1. Next.jsでUI状態管理・認証・設定
   * 2. AgentCore Runtimeで AI処理
   * 3. Next.jsでレスポンス表示・履歴保存
   */
  async processUserInput(input: string, context?: any): Promise<UIResponse> {
    try {
      // 1. UI状態とコンテキストを準備
      const uiState = this.getUIState(context);
      
      // 2. AgentCore Runtime API呼び出し
      const agentResponse = await this.callAgentCore({
        input,
        context: uiState.context,
        settings: uiState.settings
      });

      // 3. UIレスポンス形式に変換
      return this.formatForUI(agentResponse);

    } catch (error) {
      console.error('[AgentCoreClient] Error processing input:', error);
      
      // フォールバック処理
      if (this.config.fallbackToBedrockDirect && this.fallbackClient) {
        return await this.fallbackToBedrock(input, context);
      }
      
      throw error;
    }
  }

  /**
   * AgentCore Runtime APIを呼び出す
   * API Gateway無効版: Lambda関数を直接呼び出し
   */
  private async callAgentCore(request: AgentCoreRequest): Promise<AgentCoreResponse> {
    if (!this.config.enabled) {
      throw new Error('AgentCore is disabled');
    }

    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.config.retryAttempts) {
      try {
        // API Gateway無効版: Lambda直接呼び出しまたはNext.js API Route経由
        const isDirectLambda = this.config.apiEndpoint.includes('lambda');
        
        if (isDirectLambda) {
          // Lambda関数直接呼び出し（AWS SDK使用）
          return await this.callLambdaDirect(request, startTime);
        } else {
          // Next.js API Route経由（従来の方式）
          return await this.callViaApiRoute(request, startTime, attempt);
        }

      } catch (error) {
        attempt++;
        console.warn(`[AgentCoreClient] Attempt ${attempt} failed:`, error);
        
        if (attempt >= this.config.retryAttempts) {
          throw error;
        }
        
        // 指数バックオフで再試行
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Lambda関数を直接呼び出し（API Gateway無効版）
   */
  private async callLambdaDirect(request: AgentCoreRequest, startTime: number): Promise<AgentCoreResponse> {
    // Lambda直接呼び出しはサーバーサイドでのみ実行可能
    // フロントエンドからはNext.js API Route経由で呼び出し
    const response = await fetch('/api/agentcore/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify({
        functionName: 'TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI',
        payload: {
          httpMethod: 'POST',
          rawPath: '/agentcore',
          body: JSON.stringify(request)
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Lambda direct call error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    // Lambda関数のレスポンスを解析
    const lambdaResponse = JSON.parse(data.body || '{}');

    return {
      success: lambdaResponse.success || false,
      response: lambdaResponse.response,
      metadata: {
        model: lambdaResponse.metadata?.model || 'unknown',
        tokens: lambdaResponse.metadata?.tokens || 0,
        latency,
        source: 'agentcore-v2'
      }
    };
  }

  /**
   * Next.js API Route経由で呼び出し（従来の方式）
   */
  private async callViaApiRoute(request: AgentCoreRequest, startTime: number, attempt: number): Promise<AgentCoreResponse> {
    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`AgentCore API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      success: true,
      response: data.response,
      metadata: {
        model: data.metadata?.model || 'unknown',
        tokens: data.metadata?.tokens || 0,
        latency,
        source: 'agentcore'
      }
    };
  }

  /**
   * Bedrock直接呼び出しへのフォールバック
   */
  private async fallbackToBedrock(input: string, context?: any): Promise<UIResponse> {
    console.log('[AgentCoreClient] Falling back to Bedrock direct');
    
    try {
      // 既存のBedrock APIを呼び出し
      const response = await fetch('/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          sessionId: context?.sessionId,
          model: context?.settings?.model || 'claude-3-sonnet',
        }),
      });

      if (!response.ok) {
        throw new Error(`Bedrock API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        content: data.response || data.answer || 'No response received',
        metadata: {
          model: data.model || 'claude-3-sonnet',
          tokens: data.tokens || 0,
          latency: data.latency || 0,
          source: 'bedrock-direct'
        },
        shouldSave: true,
        displayOptions: {
          streaming: false,
          formatting: 'markdown'
        }
      };

    } catch (error) {
      console.error('[AgentCoreClient] Fallback to Bedrock failed:', error);
      throw new Error('Both AgentCore and Bedrock fallback failed');
    }
  }

  /**
   * UI状態を取得・準備
   */
  private getUIState(context?: any) {
    return {
      context: {
        sessionId: context?.sessionId || this.generateSessionId(),
        userId: context?.userId || 'anonymous',
        preferences: context?.preferences || {},
        timestamp: new Date().toISOString(),
      },
      settings: {
        model: context?.settings?.model || 'claude-3-sonnet',
        region: context?.settings?.region || 'us-east-1',
        temperature: context?.settings?.temperature || 0.7,
        maxTokens: context?.settings?.maxTokens || 4000,
      }
    };
  }

  /**
   * AgentCoreレスポンスをUI用に変換
   */
  private formatForUI(agentResponse: AgentCoreResponse): UIResponse {
    if (!agentResponse.success) {
      throw new Error(agentResponse.error?.message || 'AgentCore processing failed');
    }

    return {
      content: agentResponse.response || 'No response received',
      metadata: agentResponse.metadata || {
        model: 'unknown',
        tokens: 0,
        latency: 0,
        source: 'agentcore'
      },
      shouldSave: true,
      displayOptions: {
        streaming: false,
        formatting: 'markdown'
      }
    };
  }

  /**
   * 認証トークンを取得
   */
  private async getAuthToken(): Promise<string> {
    // セッション管理システムからトークンを取得
    // 実装は既存の認証システムと統合
    return 'dummy-token'; // TODO: 実際の認証トークン取得実装
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * フォールバッククライアントを初期化
   */
  private initializeFallbackClient(): void {
    // Bedrock直接呼び出し用のクライアントを初期化
    // 実装は既存のBedrockクライアントと統合
    this.fallbackClient = {}; // TODO: 実際のBedrockクライアント初期化
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<AgentCoreConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.warn('[AgentCoreClient] Health check failed:', error);
      return false;
    }
  }
}

/**
 * デフォルト設定（API Gateway無効版対応）
 */
export const DEFAULT_AGENTCORE_CONFIG: AgentCoreConfig = {
  enabled: false, // デフォルトは無効（段階的導入）
  apiEndpoint: process.env.AGENTCORE_API_ENDPOINT || '/api/agentcore/invoke', // Lambda直接呼び出し用エンドポイント
  timeout: 30000, // 30秒
  retryAttempts: 3,
  fallbackToBedrockDirect: true, // フォールバック有効
};

/**
 * AgentCore Client インスタンスを作成
 */
export function createAgentCoreClient(config?: Partial<AgentCoreConfig>): AgentCoreClient {
  const finalConfig = { ...DEFAULT_AGENTCORE_CONFIG, ...config };
  return new AgentCoreClient(finalConfig);
}