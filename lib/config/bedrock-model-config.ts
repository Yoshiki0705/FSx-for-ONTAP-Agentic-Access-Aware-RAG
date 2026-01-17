/**
 * Bedrock モデル設定管理システム
 * 動的なモデル追加・削除・更新に対応
 */

export interface ModelProvider {
  name: string;
  namingPattern: string;
  defaultRegions: string[];
  supportedFeatures: {
    onDemand: boolean;
    provisioned: boolean;
    streaming: boolean;
    crossRegion: boolean;
  };
}

export interface ModelFamily {
  name: string;
  provider: string;
  models: ModelVersion[];
  defaultModel: string;
  fallbackModel?: string;
}

export interface ModelVersion {
  modelId: string;
  version: string;
  releaseDate: string;
  status: 'stable' | 'preview' | 'deprecated';
  supportedRegions: string[];
  features: {
    onDemand: boolean;
    provisioned: boolean;
    streaming: boolean;
    crossRegion: boolean;
    multimodal: boolean;
  };
  inputModalities: string[];
  outputModalities: string[];
  deprecationDate?: string;
  replacementModel?: string;
}

export interface RegionConfig {
  regionId: string;
  regionName: string;
  supportedProviders: string[];
  preferredModels: {
    chat: string;
    generation: string;
    costEffective: string;
    multimodal?: string;
  };
}

/**
 * 動的モデル設定クラス
 */
export class BedrockModelConfig {
  private static instance: BedrockModelConfig;
  
  // 設定データ（外部ファイルまたはParameter Storeから読み込み可能）
  private providers: Map<string, ModelProvider> = new Map();
  private families: Map<string, ModelFamily> = new Map();
  private regions: Map<string, RegionConfig> = new Map();
  
  private constructor() {
    this.initializeProviders();
    this.initializeFamilies();
    this.initializeRegions();
  }
  
  public static getInstance(): BedrockModelConfig {
    if (!BedrockModelConfig.instance) {
      BedrockModelConfig.instance = new BedrockModelConfig();
    }
    return BedrockModelConfig.instance;
  }
  
  /**
   * プロバイダー設定の初期化
   */
  private initializeProviders(): void {
    // Anthropic
    this.providers.set('anthropic', {
      name: 'Anthropic',
      namingPattern: 'anthropic.claude-{version}-{date}-v{revision}:0',
      defaultRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1'],
      supportedFeatures: {
        onDemand: true,
        provisioned: true,
        streaming: true,
        crossRegion: true,
      },
    });
    
    // Amazon
    this.providers.set('amazon', {
      name: 'Amazon',
      namingPattern: 'amazon.{model-name}-{version}',
      defaultRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1'],
      supportedFeatures: {
        onDemand: true,
        provisioned: false, // Novaシリーズは基本的にオンデマンドのみ
        streaming: true,
        crossRegion: true,
      },
    });
    
    // Meta（将来追加される可能性）
    this.providers.set('meta', {
      name: 'Meta',
      namingPattern: 'meta.llama{version}-{size}b-{type}-v{revision}:0',
      defaultRegions: ['us-east-1', 'us-west-2'],
      supportedFeatures: {
        onDemand: true,
        provisioned: true,
        streaming: true,
        crossRegion: false,
      },
    });
  }
  
  /**
   * モデルファミリー設定の初期化
   */
  private initializeFamilies(): void {
    // Claude 3.5 Sonnet
    this.families.set('claude-3-5-sonnet', {
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      defaultModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      fallbackModel: 'anthropic.claude-3-haiku-20240307-v1:0',
      models: [
        {
          modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          version: '20240620-v1',
          releaseDate: '2024-06-20',
          status: 'stable',
          supportedRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 'ap-southeast-1', 'ap-southeast-2'],
          features: {
            onDemand: true,
            provisioned: true,
            streaming: true,
            crossRegion: true,
            multimodal: false,
          },
          inputModalities: ['Text'],
          outputModalities: ['Text'],
        },
        {
          modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          version: '20241022-v2',
          releaseDate: '2024-10-22',
          status: 'deprecated',
          supportedRegions: ['us-east-1', 'us-west-2'],
          features: {
            onDemand: false, // 問題のあるモデル
            provisioned: true,
            streaming: false,
            crossRegion: false,
            multimodal: false,
          },
          inputModalities: ['Text'],
          outputModalities: ['Text'],
          deprecationDate: '2024-12-01',
          replacementModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        },
      ],
    });
    
    // Claude 3 Haiku
    this.families.set('claude-3-haiku', {
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      defaultModel: 'anthropic.claude-3-haiku-20240307-v1:0',
      models: [
        {
          modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
          version: '20240307-v1',
          releaseDate: '2024-03-07',
          status: 'stable',
          supportedRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 'ap-southeast-1', 'ap-southeast-2'],
          features: {
            onDemand: true,
            provisioned: true,
            streaming: true,
            crossRegion: true,
            multimodal: false,
          },
          inputModalities: ['Text'],
          outputModalities: ['Text'],
        },
      ],
    });
    
    // Amazon Nova
    this.families.set('nova', {
      name: 'Amazon Nova',
      provider: 'amazon',
      defaultModel: 'amazon.nova-pro-v1:0',
      fallbackModel: 'amazon.nova-lite-v1:0',
      models: [
        {
          modelId: 'amazon.nova-pro-v1:0',
          version: 'v1',
          releaseDate: '2024-11-01',
          status: 'stable',
          supportedRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1'],
          features: {
            onDemand: true,
            provisioned: false,
            streaming: true,
            crossRegion: true,
            multimodal: true,
          },
          inputModalities: ['Text', 'Image'],
          outputModalities: ['Text'],
        },
        {
          modelId: 'amazon.nova-lite-v1:0',
          version: 'v1',
          releaseDate: '2024-11-01',
          status: 'stable',
          supportedRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 'ap-southeast-1', 'ap-southeast-2'],
          features: {
            onDemand: true,
            provisioned: false,
            streaming: true,
            crossRegion: true,
            multimodal: true,
          },
          inputModalities: ['Text', 'Image'],
          outputModalities: ['Text'],
        },
      ],
    });
  }
  
  /**
   * リージョン設定の初期化
   */
  private initializeRegions(): void {
    // 主要リージョンの設定
    const regionConfigs: RegionConfig[] = [
      {
        regionId: 'us-east-1',
        regionName: 'US East (N. Virginia)',
        supportedProviders: ['anthropic', 'amazon', 'meta'],
        preferredModels: {
          chat: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          generation: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          costEffective: 'anthropic.claude-3-haiku-20240307-v1:0',
          multimodal: 'amazon.nova-pro-v1:0',
        },
      },
      {
        regionId: 'ap-northeast-1',
        regionName: 'Asia Pacific (Tokyo)',
        supportedProviders: ['anthropic', 'amazon'],
        preferredModels: {
          chat: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          generation: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          costEffective: 'anthropic.claude-3-haiku-20240307-v1:0',
          multimodal: 'amazon.nova-pro-v1:0',
        },
      },
      {
        regionId: 'eu-west-1',
        regionName: 'Europe (Ireland)',
        supportedProviders: ['anthropic', 'amazon'],
        preferredModels: {
          chat: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          generation: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          costEffective: 'anthropic.claude-3-haiku-20240307-v1:0',
          multimodal: 'amazon.nova-lite-v1:0', // Nova Proが利用できない場合
        },
      },
    ];
    
    regionConfigs.forEach(config => {
      this.regions.set(config.regionId, config);
    });
  }
  
  /**
   * 指定されたリージョンとユースケースに最適なモデルを取得
   */
  public getOptimalModel(
    region: string,
    useCase: 'chat' | 'generation' | 'costEffective' | 'multimodal' = 'chat',
    requirements?: {
      onDemand?: boolean;
      streaming?: boolean;
      crossRegion?: boolean;
      inputModalities?: string[];
    }
  ): string | null {
    const regionConfig = this.regions.get(region);
    if (!regionConfig) {
      // フォールバック: デフォルトリージョンの設定を使用
      return this.getOptimalModel('us-east-1', useCase, requirements);
    }
    
    // 推奨モデルを取得
    let preferredModel = regionConfig.preferredModels[useCase];
    
    // 要件チェック
    if (requirements && preferredModel) {
      const isCompatible = this.checkModelCompatibility(preferredModel, region, requirements);
      if (!isCompatible) {
        // フォールバックモデルを検索
        preferredModel = this.findFallbackModel(region, useCase, requirements);
      }
    }
    
    return preferredModel;
  }
  
  /**
   * モデルの互換性をチェック
   */
  public checkModelCompatibility(
    modelId: string,
    region: string,
    requirements: {
      onDemand?: boolean;
      streaming?: boolean;
      crossRegion?: boolean;
      inputModalities?: string[];
    }
  ): boolean {
    const model = this.findModelById(modelId);
    if (!model) return false;
    
    // リージョンサポートチェック
    if (!model.supportedRegions.includes(region)) return false;
    
    // 機能要件チェック
    if (requirements.onDemand && !model.features.onDemand) return false;
    if (requirements.streaming && !model.features.streaming) return false;
    if (requirements.crossRegion && !model.features.crossRegion) return false;
    
    // 入力モダリティチェック
    if (requirements.inputModalities) {
      const hasAllModalities = requirements.inputModalities.every(modality =>
        model.inputModalities.includes(modality)
      );
      if (!hasAllModalities) return false;
    }
    
    // 非推奨モデルは除外
    if (model.status === 'deprecated') return false;
    
    return true;
  }
  
  /**
   * フォールバックモデルを検索
   */
  private findFallbackModel(
    region: string,
    useCase: string,
    requirements: any
  ): string | null {
    // 利用可能なモデルを優先順位順に検索
    const priorities = {
      chat: ['claude-3-5-sonnet', 'claude-3-haiku', 'nova'],
      generation: ['claude-3-5-sonnet', 'nova', 'claude-3-haiku'],
      costEffective: ['claude-3-haiku', 'nova', 'claude-3-5-sonnet'],
      multimodal: ['nova'],
    };
    
    const familyPriority = priorities[useCase as keyof typeof priorities] || priorities.chat;
    
    for (const familyName of familyPriority) {
      const family = this.families.get(familyName);
      if (!family) continue;
      
      for (const model of family.models) {
        if (this.checkModelCompatibility(model.modelId, region, requirements)) {
          return model.modelId;
        }
      }
    }
    
    return null;
  }
  
  /**
   * モデルIDからモデル情報を検索
   */
  private findModelById(modelId: string): ModelVersion | null {
    for (const family of Array.from(this.families.values())) {
      const model = family.models.find(m => m.modelId === modelId);
      if (model) return model;
    }
    return null;
  }
  
  /**
   * 新しいプロバイダーを追加
   */
  public addProvider(name: string, config: ModelProvider): void {
    this.providers.set(name, config);
  }
  
  /**
   * 新しいモデルファミリーを追加
   */
  public addModelFamily(name: string, family: ModelFamily): void {
    this.families.set(name, family);
  }
  
  /**
   * 既存ファミリーに新しいモデルバージョンを追加
   */
  public addModelVersion(familyName: string, model: ModelVersion): void {
    const family = this.families.get(familyName);
    if (family) {
      family.models.push(model);
      // 新しいモデルが安定版の場合、デフォルトモデルを更新
      if (model.status === 'stable' && model.releaseDate > family.models.find(m => m.modelId === family.defaultModel)?.releaseDate!) {
        family.defaultModel = model.modelId;
      }
    }
  }
  
  /**
   * モデルを非推奨に設定
   */
  public deprecateModel(modelId: string, replacementModel?: string): void {
    const model = this.findModelById(modelId);
    if (model) {
      model.status = 'deprecated';
      model.deprecationDate = new Date().toISOString().split('T')[0];
      if (replacementModel) {
        model.replacementModel = replacementModel;
      }
    }
  }
  
  /**
   * 設定を外部ファイルから読み込み
   */
  public loadFromFile(configPath: string): void {
    // 実装: JSON/YAMLファイルから設定を読み込み
    // この機能により、CDKデプロイ時に外部設定ファイルを参照可能
  }
  
  /**
   * 設定をParameter Storeから読み込み
   */
  public loadFromParameterStore(parameterPrefix: string): void {
    // 実装: AWS Systems Manager Parameter Storeから設定を読み込み
    // 動的な設定更新が可能
  }
  
  /**
   * 全プロバイダー情報を取得
   */
  public getAllProviders(): Map<string, ModelProvider> {
    return new Map(this.providers);
  }
  
  /**
   * 全モデルファミリー情報を取得
   */
  public getAllFamilies(): Map<string, ModelFamily> {
    return new Map(this.families);
  }
  
  /**
   * 指定リージョンで利用可能なモデル一覧を取得
   */
  public getAvailableModels(region: string): ModelVersion[] {
    const availableModels: ModelVersion[] = [];
    
    for (const family of Array.from(this.families.values())) {
      for (const model of family.models) {
        if (model.supportedRegions.includes(region) && model.status !== 'deprecated') {
          availableModels.push(model);
        }
      }
    }
    
    return availableModels;
  }
}