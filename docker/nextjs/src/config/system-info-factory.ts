/**
 * システム情報ファクトリー
 * システム情報の生成を責務とするファクトリークラス
 */

export interface SystemInfoConfig {
  name: string;
  version: string;
  region: string;
  environment: string;
}

export interface EmbeddingInfo {
  currentModel: string;
  supportedRegions: string[];
  multimodalSupport: boolean;
  vectorDimensions: number;
}

export interface ChatInfo {
  totalModels: number;
  providers: string[];
  categories: string[];
}

export interface InfrastructureInfo {
  lambdaFunction: string;
  lambdaRegion: string;
  dynamoTable: string;
  cognitoUserPool: string;
}

export interface FeatureFlags {
  dynamicModelSelection: boolean;
  embeddingModelInfo: boolean;
  multimodalEmbeddings: boolean;
  chatHistory: boolean;
  permissionBasedAccess: boolean;
  realTimeChat: boolean;
}

export class SystemInfoFactory {
  /**
   * システム基本情報を生成
   */
  static createSystemInfo(): SystemInfoConfig {
    return {
      name: 'Permission-aware RAG System',
      version: '1.0.0',
      region: process.env.AWS_REGION || 'ap-northeast-1',
      environment: process.env.NODE_ENV || 'production'
    };
  }

  /**
   * 埋め込みモデル情報を生成
   */
  static createEmbeddingInfo(embeddingSystemInfo?: any, availableModels?: any[]): EmbeddingInfo & { available: any[] } {
    const defaultInfo: EmbeddingInfo = {
      currentModel: 'amazon.titan-embed-text-v2:0',
      supportedRegions: ['ap-northeast-1'],
      multimodalSupport: false,
      vectorDimensions: 1024
    };

    return {
      current: embeddingSystemInfo || defaultInfo,
      available: availableModels || [],
      multimodalSupport: embeddingSystemInfo?.multimodalSupport || defaultInfo.multimodalSupport,
      vectorDimensions: embeddingSystemInfo?.vectorDimensions || defaultInfo.vectorDimensions
    };
  }

  /**
   * チャットモデル情報を生成
   */
  static createChatInfo(availableModels?: any[]): ChatInfo & { available: any[] } {
    const models = availableModels || [];
    
    return {
      available: models,
      totalModels: models.length,
      providers: models.length > 0 
        ? [...new Set(models.map((m: any) => m.provider))]
        : ['amazon', 'anthropic'],
      categories: models.length > 0
        ? [...new Set(models.map((m: any) => m.category))]
        : ['chat', 'embedding']
    };
  }

  /**
   * インフラストラクチャ情報を生成
   */
  static createInfrastructureInfo(): InfrastructureInfo {
    return {
      lambdaFunction: process.env.AWS_LAMBDA_FUNCTION_NAME || 'RAGWebApp-WebAppFunction',
      lambdaRegion: process.env.AWS_REGION || 'ap-northeast-1',
      dynamoTable: process.env.TABLE_NAME || 'rag-sessions',
      cognitoUserPool: process.env.USER_POOL_ID || 'ap-northeast-1_4lmHYQGAv'
    };
  }

  /**
   * 機能フラグを生成
   */
  static createFeatureFlags(): FeatureFlags {
    return {
      dynamicModelSelection: true,
      embeddingModelInfo: true,
      multimodalEmbeddings: false, // 現在未実装
      chatHistory: true,
      permissionBasedAccess: true,
      realTimeChat: true
    };
  }

  /**
   * 完全なシステム情報を生成
   */
  static async createCompleteSystemInfo() {
    // 設定ファイルの動的読み込み
    let embeddingSystemInfo: any = null;
    let availableEmbeddingModels: any[] = [];
    let availableModels: any[] = [];

    try {
      const embeddingConfig = await import('./embedding-models');
      embeddingSystemInfo = embeddingConfig.EMBEDDING_SYSTEM_INFO;
      availableEmbeddingModels = embeddingConfig.AVAILABLE_EMBEDDING_MODELS;
    } catch (error) {
      console.warn('Embedding models config not found, using defaults');
    }

    try {
      const bedrockConfig = await import('./bedrock-models');
      availableModels = bedrockConfig.AVAILABLE_MODELS;
    } catch (error) {
      console.warn('Bedrock models config not found, using defaults');
    }

    return {
      system: {
        ...this.createSystemInfo(),
        timestamp: new Date().toISOString()
      },
      embedding: this.createEmbeddingInfo(embeddingSystemInfo, availableEmbeddingModels),
      chat: this.createChatInfo(availableModels),
      infrastructure: this.createInfrastructureInfo(),
      features: this.createFeatureFlags()
    };
  }
}