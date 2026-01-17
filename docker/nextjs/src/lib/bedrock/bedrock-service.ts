import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { BEDROCK_CONFIG, getCurrentBedrockRegion } from './bedrock-config';
import type { BedrockModelInfo, BedrockRegionInfoResponse } from '../../types/bedrock-api';

/**
 * Bedrockサービスクラス
 * Factory PatternとSingleton Patternを組み合わせて実装
 */
export class BedrockService {
  private static instance: BedrockService;
  private client: BedrockClient;
  private cache: Map<string, { data: BedrockModelInfo[]; timestamp: number }> = new Map();

  private constructor() {
    this.client = this.createBedrockClient();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): BedrockService {
    if (!BedrockService.instance) {
      BedrockService.instance = new BedrockService();
    }
    return BedrockService.instance;
  }

  /**
   * Bedrockクライアントを作成（Factory Pattern）
   */
  private createBedrockClient(): BedrockClient {
    const region = getCurrentBedrockRegion();
    
    return new BedrockClient({
      region,
      maxAttempts: BEDROCK_CONFIG.CLIENT.maxAttempts,
      requestTimeout: BEDROCK_CONFIG.CLIENT.requestTimeout,
    });
  }

  /**
   * 利用可能なモデル一覧を取得（キャッシュ機能付き）
   */
  public async getAvailableModels(): Promise<BedrockModelInfo[]> {
    const region = getCurrentBedrockRegion();
    const cacheKey = `models_${region}`;
    
    // キャッシュチェック
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < BEDROCK_CONFIG.CACHE.ttl) {
      return cached.data;
    }

    try {
      const command = new ListFoundationModelsCommand({});
      const response = await this.client.send(command);
      
      const models: BedrockModelInfo[] = response.modelSummaries?.map(model => ({
        modelId: model.modelId || '',
        modelName: model.modelName,
        providerName: model.providerName,
        inputModalities: model.inputModalities,
        outputModalities: model.outputModalities,
        responseStreamingSupported: model.responseStreamingSupported,
        customizationsSupported: model.customizationsSupported,
        inferenceTypesSupported: model.inferenceTypesSupported,
      })) || [];

      // キャッシュに保存
      this.cache.set(cacheKey, {
        data: models,
        timestamp: Date.now(),
      });

      return models;
    } catch (error) {
      console.error('Bedrockモデル取得エラー:', error);
      throw error;
    }
  }

  /**
   * リージョン情報を取得
   */
  public async getRegionInfo(): Promise<BedrockRegionInfoResponse> {
    try {
      const models = await this.getAvailableModels();
      const region = getCurrentBedrockRegion();

      return {
        success: true,
        data: {
          currentRegion: region,
          availableModels: models,
          totalModels: models.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const region = getCurrentBedrockRegion();
      
      return {
        success: false,
        error: 'Bedrockリージョン情報の取得に失敗しました',
        data: {
          currentRegion: region,
          availableModels: [],
          totalModels: 0,
          timestamp: new Date().toISOString(),
        },
        errorDetails: error instanceof Error ? error.message : '不明なエラー',
      };
    }
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.cache.clear();
  }
}