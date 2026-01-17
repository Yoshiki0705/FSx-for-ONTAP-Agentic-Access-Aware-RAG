/**
 * Chat Service Integration
 * 
 * 既存のチャット機能とAgentCore統合を管理
 * 段階的移行とフォールバック機能を提供
 */

import { AgentCoreClient, UIResponse } from './agentcore-client';
import { useAgentCore } from '@/hooks/useAgentCore';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  model?: string;
  region?: string;
  mode?: 'agent' | 'kb';
  userId?: string;
  preferences?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  model: string;
  tokens?: number;
  latency?: number;
  source: 'agentcore' | 'bedrock-direct' | 'bedrock-agent';
  sessionId?: string;
  traceData?: any;
  metadata?: Record<string, any>;
}

export interface ChatServiceConfig {
  enableAgentCore: boolean;
  fallbackToBedrock: boolean;
  preferredSource: 'agentcore' | 'bedrock-direct' | 'auto';
  timeout: number;
}

/**
 * 統合チャットサービス
 * 
 * AgentCoreと既存のBedrock APIを統合し、
 * 段階的移行とフォールバック機能を提供
 */
export class ChatServiceIntegration {
  private agentCoreClient?: AgentCoreClient;
  private config: ChatServiceConfig;

  constructor(config: ChatServiceConfig, agentCoreClient?: AgentCoreClient) {
    this.config = config;
    this.agentCoreClient = agentCoreClient;
  }

  /**
   * チャットメッセージを処理
   * 
   * 処理順序:
   * 1. AgentCore有効 → AgentCore処理
   * 2. AgentCore失敗 → Bedrock直接呼び出し
   * 3. AgentCore無効 → 既存のBedrock API
   */
  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // AgentCoreが有効で利用可能な場合
      if (this.config.enableAgentCore && this.agentCoreClient) {
        try {
          console.log('[ChatServiceIntegration] Attempting AgentCore processing');
          const agentCoreResponse = await this.processWithAgentCore(request);
          
          return {
            response: agentCoreResponse.content,
            model: agentCoreResponse.metadata.model,
            tokens: agentCoreResponse.metadata.tokens,
            latency: Date.now() - startTime,
            source: 'agentcore',
            sessionId: request.sessionId,
            metadata: agentCoreResponse.metadata,
          };

        } catch (agentCoreError) {
          console.warn('[ChatServiceIntegration] AgentCore failed, attempting fallback:', agentCoreError);
          
          // フォールバックが有効な場合
          if (this.config.fallbackToBedrock) {
            return await this.processWithBedrockFallback(request, startTime);
          }
          
          throw agentCoreError;
        }
      }

      // AgentCore無効または利用不可の場合は既存API使用
      console.log('[ChatServiceIntegration] Using existing Bedrock API');
      return await this.processWithExistingAPI(request, startTime);

    } catch (error) {
      console.error('[ChatServiceIntegration] All processing methods failed:', error);
      throw new Error(`Chat processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * AgentCoreで処理
   */
  private async processWithAgentCore(request: ChatRequest): Promise<UIResponse> {
    if (!this.agentCoreClient) {
      throw new Error('AgentCore client not available');
    }

    const context = {
      sessionId: request.sessionId,
      userId: request.userId,
      preferences: request.preferences,
      settings: {
        model: request.model,
        region: request.region,
        mode: request.mode,
      }
    };

    return await this.agentCoreClient.processUserInput(request.message, context);
  }

  /**
   * Bedrockフォールバック処理
   */
  private async processWithBedrockFallback(request: ChatRequest, startTime: number): Promise<ChatResponse> {
    console.log('[ChatServiceIntegration] Executing Bedrock fallback');
    
    // AgentCoreクライアント内のフォールバック機能を使用
    if (this.agentCoreClient) {
      try {
        const fallbackResponse = await this.agentCoreClient.processUserInput(request.message, {
          sessionId: request.sessionId,
          userId: request.userId,
          preferences: request.preferences,
          settings: {
            model: request.model,
            region: request.region,
          }
        });

        return {
          response: fallbackResponse.content,
          model: fallbackResponse.metadata.model,
          tokens: fallbackResponse.metadata.tokens,
          latency: Date.now() - startTime,
          source: 'bedrock-direct',
          sessionId: request.sessionId,
          metadata: fallbackResponse.metadata,
        };
      } catch (fallbackError) {
        console.warn('[ChatServiceIntegration] AgentCore fallback failed:', fallbackError);
      }
    }

    // 最終フォールバック: 既存API
    return await this.processWithExistingAPI(request, startTime);
  }

  /**
   * 既存のBedrock APIで処理
   */
  private async processWithExistingAPI(request: ChatRequest, startTime: number): Promise<ChatResponse> {
    const apiEndpoint = request.mode === 'agent' ? '/api/bedrock/agent' : '/api/bedrock/chat';
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        sessionId: request.sessionId,
        model: request.model,
        region: request.region,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Existing API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      response: data.response || data.answer || 'No response received',
      model: data.model || request.model || 'unknown',
      tokens: data.tokens || 0,
      latency: Date.now() - startTime,
      source: request.mode === 'agent' ? 'bedrock-agent' : 'bedrock-direct',
      sessionId: request.sessionId,
      traceData: data.trace,
      metadata: data.metadata || {},
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<ChatServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * AgentCoreクライアントを更新
   */
  updateAgentCoreClient(client: AgentCoreClient): void {
    this.agentCoreClient = client;
  }

  /**
   * サービス状態を取得
   */
  getServiceStatus(): {
    agentCoreAvailable: boolean;
    fallbackEnabled: boolean;
    preferredSource: string;
  } {
    return {
      agentCoreAvailable: !!this.agentCoreClient && this.config.enableAgentCore,
      fallbackEnabled: this.config.fallbackToBedrock,
      preferredSource: this.config.preferredSource,
    };
  }
}

/**
 * デフォルト設定
 */
export const DEFAULT_CHAT_SERVICE_CONFIG: ChatServiceConfig = {
  enableAgentCore: false, // デフォルトは無効（段階的導入）
  fallbackToBedrock: true,
  preferredSource: 'auto',
  timeout: 30000,
};

/**
 * React Hook: 統合チャットサービス
 */
export function useChatServiceIntegration() {
  const { state: agentCoreState, isAvailable } = useAgentCore();
  
  // 設定を動的に決定
  const config: ChatServiceConfig = {
    enableAgentCore: agentCoreState.isEnabled && isAvailable,
    fallbackToBedrock: agentCoreState.settings.fallbackToBedrockDirect,
    preferredSource: agentCoreState.isEnabled ? 'agentcore' : 'auto',
    timeout: agentCoreState.settings.timeout,
  };

  // サービスインスタンスを作成（AgentCoreクライアントは useAgentCore から取得）
  const chatService = new ChatServiceIntegration(config);

  return {
    chatService,
    config,
    isAgentCoreEnabled: config.enableAgentCore,
    canFallback: config.fallbackToBedrock,
  };
}