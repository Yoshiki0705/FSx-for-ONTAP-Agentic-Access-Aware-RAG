/**
 * Bedrock Foundation Model 互換性管理システム
 * AWS MCPサーバーから取得した情報を基にしたモデルパターン分析
 */

export interface ModelInfo {
  modelId: string;
  modelName: string;
  provider: string;
  family: string;
  version: string;
  releaseDate: string;
  isStable: boolean;
  isDeprecated: boolean;
  supportedFeatures: {
    onDemand: boolean;
    provisioned: boolean;
    streaming: boolean;
    crossRegion: boolean;
  };
  supportedRegions: string[];
  inputModalities: string[];
  outputModalities: string[];
  deprecationDate?: string;
  replacementModel?: string;
}

export interface ModelPattern {
  provider: string;
  namingPattern: string;
  families: Record<string, {
    stableVersions: string[];
    latestVersions: string[];
    deprecatedVersions: string[];
    namingConvention: string;
  }>;
  compatibilityRules: {
    onDemandSupported: boolean;
    provisionedSupported: boolean;
    streamingSupported: boolean;
    crossRegionSupported: boolean;
  };
}

/**
 * モデル互換性データベース（AWS MCPサーバー情報を基に構築）
 */
export class ModelCompatibilitySystem {
  private static instance: ModelCompatibilitySystem;
  private modelDatabase: Map<string, ModelInfo> = new Map();
  private patterns: Map<string, ModelPattern> = new Map();
  private regionalAvailability: Map<string, string[]> = new Map();

  private constructor() {
    this.initializeModelDatabase();
    this.initializePatterns();
    this.initializeRegionalAvailability();
  }

  public static getInstance(): ModelCompatibilitySystem {
    if (!ModelCompatibilitySystem.instance) {
      ModelCompatibilitySystem.instance = new ModelCompatibilitySystem();
    }
    return ModelCompatibilitySystem.instance;
  }

  /**
   * モデルデータベースの初期化（AWS MCPサーバー情報を基に）
   */
  private initializeModelDatabase(): void {
    // Anthropic Claude Sonnet 4 (最新安定版)
    this.modelDatabase.set('anthropic.claude-sonnet-4-20250514-v1:0', {
      modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
      modelName: 'Claude Sonnet 4',
      provider: 'Anthropic',
      family: 'claude-sonnet-4',
      version: '20250514-v1',
      releaseDate: '2025-05-14',
      isStable: true,
      isDeprecated: false,
      supportedFeatures: {
        onDemand: true,
        provisioned: true,
        streaming: true,
        crossRegion: true,
      },
      supportedRegions: [
        'us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 
        'ap-southeast-1', 'ap-southeast-2', 'eu-central-1'
      ],
      inputModalities: ['Text'],
      outputModalities: ['Text'],
    });

    // Anthropic Claude 3.5 Sonnet v1 (廃止済み - 2026-03-01)
    this.modelDatabase.set('anthropic.claude-3-5-sonnet-20240620-v1:0', {
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      modelName: 'Claude 3.5 Sonnet (Deprecated)',
      provider: 'Anthropic',
      family: 'claude-3-5-sonnet',
      version: '20240620-v1',
      releaseDate: '2024-06-20',
      isStable: false,
      isDeprecated: true,
      supportedFeatures: {
        onDemand: false,
        provisioned: false,
        streaming: false,
        crossRegion: false,
      },
      supportedRegions: [],
      inputModalities: ['Text'],
      outputModalities: ['Text'],
      deprecationDate: '2026-03-01',
      replacementModel: 'anthropic.claude-sonnet-4-20250514-v1:0',
    });

    // Anthropic Claude 3.5 Sonnet v2 (問題のある版)
    this.modelDatabase.set('anthropic.claude-3-5-sonnet-20241022-v2:0', {
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      modelName: 'Claude 3.5 Sonnet v2',
      provider: 'Anthropic',
      family: 'claude-3-5-sonnet',
      version: '20241022-v2',
      releaseDate: '2024-10-22',
      isStable: false,
      isDeprecated: true,
      supportedFeatures: {
        onDemand: false, // 問題: オンデマンドスループット非対応
        provisioned: true,
        streaming: false,
        crossRegion: false,
      },
      supportedRegions: ['us-east-1', 'us-west-2'],
      inputModalities: ['Text'],
      outputModalities: ['Text'],
      deprecationDate: '2024-12-01',
      replacementModel: 'anthropic.claude-sonnet-4-20250514-v1:0',
    });

    // Anthropic Claude 3 Haiku
    this.modelDatabase.set('anthropic.claude-3-haiku-20240307-v1:0', {
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      modelName: 'Claude 3 Haiku',
      provider: 'Anthropic',
      family: 'claude-3-haiku',
      version: '20240307-v1',
      releaseDate: '2024-03-07',
      isStable: true,
      isDeprecated: false,
      supportedFeatures: {
        onDemand: true,
        provisioned: true,
        streaming: true,
        crossRegion: true,
      },
      supportedRegions: [
        'us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 
        'ap-southeast-1', 'ap-southeast-2', 'eu-central-1'
      ],
      inputModalities: ['Text'],
      outputModalities: ['Text'],
    });

    // Amazon Nova Pro
    this.modelDatabase.set('amazon.nova-pro-v1:0', {
      modelId: 'amazon.nova-pro-v1:0',
      modelName: 'Amazon Nova Pro',
      provider: 'Amazon',
      family: 'nova',
      version: 'v1',
      releaseDate: '2024-11-01',
      isStable: true,
      isDeprecated: false,
      supportedFeatures: {
        onDemand: true,
        provisioned: false,
        streaming: true,
        crossRegion: true,
      },
      supportedRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text'],
    });

    // Amazon Nova Lite
    this.modelDatabase.set('amazon.nova-lite-v1:0', {
      modelId: 'amazon.nova-lite-v1:0',
      modelName: 'Amazon Nova Lite',
      provider: 'Amazon',
      family: 'nova',
      version: 'v1',
      releaseDate: '2024-11-01',
      isStable: true,
      isDeprecated: false,
      supportedFeatures: {
        onDemand: true,
        provisioned: false,
        streaming: true,
        crossRegion: true,
      },
      supportedRegions: [
        'us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1',
        'ap-southeast-1', 'ap-southeast-2', 'eu-central-1'
      ],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text'],
    });

    // Amazon Titan Text Express
    this.modelDatabase.set('amazon.titan-text-express-v1', {
      modelId: 'amazon.titan-text-express-v1',
      modelName: 'Titan Text Express',
      provider: 'Amazon',
      family: 'titan-text',
      version: 'v1',
      releaseDate: '2023-09-28',
      isStable: true,
      isDeprecated: false,
      supportedFeatures: {
        onDemand: true,
        provisioned: true,
        streaming: true,
        crossRegion: false,
      },
      supportedRegions: [
        'us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1',
        'ap-southeast-1', 'ap-southeast-2', 'eu-central-1'
      ],
      inputModalities: ['Text'],
      outputModalities: ['Text'],
    });
  }

  /**
   * パターンデータベースの初期化
   */
  private initializePatterns(): void {
    // Anthropicパターン
    this.patterns.set('anthropic', {
      provider: 'Anthropic',
      namingPattern: 'anthropic.claude-{version}-{date}-v{revision}:0',
      families: {
        'claude-3-5-sonnet': {
          stableVersions: ['anthropic.claude-sonnet-4-20250514-v1:0'],
          latestVersions: ['anthropic.claude-sonnet-4-20250514-v1:0'],
          deprecatedVersions: ['anthropic.claude-3-5-sonnet-20240620-v1:0', 'anthropic.claude-3-5-sonnet-20241022-v2:0'],
          namingConvention: 'anthropic.claude-3-5-sonnet-YYYYMMDD-v{revision}:0',
        },
        'claude-3-haiku': {
          stableVersions: ['anthropic.claude-3-haiku-20240307-v1:0'],
          latestVersions: ['anthropic.claude-3-haiku-20240307-v1:0'],
          deprecatedVersions: [],
          namingConvention: 'anthropic.claude-3-haiku-YYYYMMDD-v{revision}:0',
        },
        'claude-3-sonnet': {
          stableVersions: ['anthropic.claude-3-sonnet-20240229-v1:0'],
          latestVersions: ['anthropic.claude-3-sonnet-20240229-v1:0'],
          deprecatedVersions: [],
          namingConvention: 'anthropic.claude-3-sonnet-YYYYMMDD-v{revision}:0',
        },
      },
      compatibilityRules: {
        onDemandSupported: true,
        provisionedSupported: true,
        streamingSupported: true,
        crossRegionSupported: true,
      },
    });

    // Amazonパターン
    this.patterns.set('amazon', {
      provider: 'Amazon',
      namingPattern: 'amazon.{model-name}-{version}',
      families: {
        'nova': {
          stableVersions: ['amazon.nova-pro-v1:0', 'amazon.nova-lite-v1:0'],
          latestVersions: ['amazon.nova-pro-v1:0', 'amazon.nova-lite-v1:0'],
          deprecatedVersions: [],
          namingConvention: 'amazon.nova-{size}-v{revision}:0',
        },
        'titan-text': {
          stableVersions: ['amazon.titan-text-express-v1'],
          latestVersions: ['amazon.titan-text-express-v1'],
          deprecatedVersions: [],
          namingConvention: 'amazon.titan-text-{variant}-v{revision}',
        },
      },
      compatibilityRules: {
        onDemandSupported: true,
        provisionedSupported: false, // Novaシリーズは基本的にオンデマンドのみ
        streamingSupported: true,
        crossRegionSupported: true,
      },
    });
  }

  /**
   * リージョン別可用性の初期化
   */
  private initializeRegionalAvailability(): void {
    // 主要リージョンでの利用可能モデル
    this.regionalAvailability.set('us-east-1', [
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'amazon.nova-pro-v1:0',
      'amazon.nova-lite-v1:0',
      'amazon.titan-text-express-v1',
    ]);

    this.regionalAvailability.set('us-west-2', [
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'amazon.nova-pro-v1:0',
      'amazon.nova-lite-v1:0',
      'amazon.titan-text-express-v1',
    ]);

    this.regionalAvailability.set('ap-northeast-1', [
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'amazon.nova-pro-v1:0',
      'amazon.nova-lite-v1:0',
      'amazon.titan-text-express-v1',
    ]);

    this.regionalAvailability.set('eu-west-1', [
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'amazon.nova-lite-v1:0',
      'amazon.titan-text-express-v1',
    ]);
  }

  /**
   * 推奨モデルを取得
   */
  public getRecommendedModel(
    region: string,
    useCase: 'chat' | 'generation' | 'cost-effective' | 'multimodal' = 'chat'
  ): ModelInfo | null {
    const availableModels = this.getAvailableModels(region);
    
    // ユースケース別優先順位
    const priorities = {
      chat: ['claude-sonnet-4', 'claude-3-5-sonnet', 'claude-3-haiku', 'nova-pro', 'nova-lite'],
      generation: ['claude-sonnet-4', 'claude-3-5-sonnet', 'nova-pro', 'claude-3-haiku', 'nova-lite'],
      'cost-effective': ['claude-3-haiku', 'nova-lite', 'titan-text', 'nova-pro'],
      multimodal: ['nova-pro', 'nova-lite', 'claude-sonnet-4'],
    };

    const familyPriority = priorities[useCase];
    
    for (const family of familyPriority) {
      const model = availableModels.find(m => 
        m.family === family && 
        m.isStable && 
        !m.isDeprecated &&
        m.supportedFeatures.onDemand
      );
      if (model) return model;
    }

    // フォールバック: 最初の利用可能なモデル
    return availableModels.find(m => m.isStable && !m.isDeprecated) || null;
  }

  /**
   * モデルの互換性をチェック
   */
  public checkCompatibility(
    modelId: string,
    requirements: {
      region: string;
      onDemand?: boolean;
      streaming?: boolean;
      crossRegion?: boolean;
      inputModalities?: string[];
    }
  ): {
    compatible: boolean;
    issues: string[];
    recommendations: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const model = this.modelDatabase.get(modelId);
    const issues: string[] = [];
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (!model) {
      issues.push(`モデル ${modelId} が見つかりません`);
      recommendations.push('サポートされているモデルを使用してください');
      return { compatible: false, issues, recommendations, severity: 'critical' };
    }

    // リージョンチェック
    if (!model.supportedRegions.includes(requirements.region)) {
      issues.push(`モデル ${modelId} はリージョン ${requirements.region} でサポートされていません`);
      recommendations.push(`サポートされているリージョン: ${model.supportedRegions.join(', ')}`);
      severity = 'critical';
    }

    // オンデマンドチェック
    if (requirements.onDemand && !model.supportedFeatures.onDemand) {
      issues.push(`モデル ${modelId} はオンデマンドスループットをサポートしていません`);
      recommendations.push('プロビジョンドスループットを使用するか、別のモデルを選択してください');
      severity = 'high';
    }

    // ストリーミングチェック
    if (requirements.streaming && !model.supportedFeatures.streaming) {
      issues.push(`モデル ${modelId} はストリーミングをサポートしていません`);
      recommendations.push('ストリーミング対応モデルを選択してください');
      if (severity === 'low') severity = 'medium';
    }

    // クロスリージョンチェック
    if (requirements.crossRegion && !model.supportedFeatures.crossRegion) {
      issues.push(`モデル ${modelId} はクロスリージョン推論をサポートしていません`);
      recommendations.push('クロスリージョン対応モデルを選択してください');
      if (severity === 'low') severity = 'medium';
    }

    // 入力モダリティチェック
    if (requirements.inputModalities) {
      const unsupportedModalities = requirements.inputModalities.filter(
        modality => !model.inputModalities.includes(modality)
      );
      if (unsupportedModalities.length > 0) {
        issues.push(`モデル ${modelId} は以下の入力モダリティをサポートしていません: ${unsupportedModalities.join(', ')}`);
        recommendations.push(`サポートされている入力モダリティ: ${model.inputModalities.join(', ')}`);
        severity = 'high';
      }
    }

    // 非推奨チェック
    if (model.isDeprecated) {
      issues.push(`モデル ${modelId} は非推奨です`);
      if (model.replacementModel) {
        recommendations.push(`推奨代替モデル: ${model.replacementModel}`);
      } else {
        recommendations.push('安定版モデルに移行してください');
      }
      severity = 'high';
    }

    // 安定性チェック
    if (!model.isStable) {
      issues.push(`モデル ${modelId} は安定版ではありません`);
      recommendations.push('本番環境では安定版モデルの使用を推奨します');
      if (severity === 'low') severity = 'medium';
    }

    return {
      compatible: issues.length === 0,
      issues,
      recommendations,
      severity,
    };
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  public getAvailableModels(region: string): ModelInfo[] {
    const availableModelIds = this.regionalAvailability.get(region) || [];
    return availableModelIds
      .map(id => this.modelDatabase.get(id))
      .filter((model): model is ModelInfo => model !== undefined && !model.isDeprecated);
  }

  /**
   * モデル情報を取得
   */
  public getModelInfo(modelId: string): ModelInfo | null {
    return this.modelDatabase.get(modelId) || null;
  }

  /**
   * プロバイダー別モデル一覧を取得
   */
  public getModelsByProvider(provider: string, region: string): ModelInfo[] {
    return this.getAvailableModels(region).filter((model) => model.provider === provider);
  }

  /**
   * 自動モデル選択
   */
  public autoSelectModel(
    region: string,
    requirements: {
      useCase?: 'chat' | 'generation' | 'cost-effective' | 'multimodal';
      onDemand?: boolean;
      streaming?: boolean;
      crossRegion?: boolean;
      provider?: string;
      inputModalities?: string[];
    } = {}
  ): ModelInfo | null {
    const {
      useCase = 'chat',
      onDemand = true,
      streaming = true,
      crossRegion = false,
      provider,
      inputModalities,
    } = requirements;

    let candidates = this.getAvailableModels(region);

    // プロバイダーフィルター
    if (provider) {
      candidates = candidates.filter((model) => model.provider === provider);
    }

    // 機能要件フィルター
    candidates = candidates.filter((model) => {
      if (onDemand && !model.supportedFeatures.onDemand) return false;
      if (streaming && !model.supportedFeatures.streaming) return false;
      if (crossRegion && !model.supportedFeatures.crossRegion) return false;
      
      // 入力モダリティチェック
      if (inputModalities) {
        const hasAllModalities = inputModalities.every(modality => 
          model.inputModalities.includes(modality)
        );
        if (!hasAllModalities) return false;
      }
      
      return true;
    });

    // 安定版優先
    candidates = candidates.filter((model) => model.isStable);

    // ユースケース別優先順位で選択
    return this.getRecommendedModel(region, useCase);
  }

  /**
   * モデルパターン情報を取得
   */
  public getModelPattern(provider: string): ModelPattern | null {
    return this.patterns.get(provider.toLowerCase()) || null;
  }

  /**
   * 全プロバイダーのパターン一覧を取得
   */
  public getAllPatterns(): ModelPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * リージョン別可用性マトリックスを取得
   */
  public getRegionalAvailabilityMatrix(): Record<string, string[]> {
    const matrix: Record<string, string[]> = {};
    for (const [region, models] of this.regionalAvailability.entries()) {
      matrix[region] = models.filter(modelId => {
        const model = this.modelDatabase.get(modelId);
        return model && !model.isDeprecated;
      });
    }
    return matrix;
  }
}

/**
 * モデル互換性ユーティリティ関数
 */
export const modelCompatibility = {
  /**
   * 推奨モデルを取得
   */
  getRecommended: (region: string, useCase?: 'chat' | 'generation' | 'cost-effective' | 'multimodal') =>
    ModelCompatibilitySystem.getInstance().getRecommendedModel(region, useCase),

  /**
   * 互換性チェック
   */
  check: (modelId: string, requirements: { region: string; onDemand?: boolean; streaming?: boolean; crossRegion?: boolean; inputModalities?: string[] }) =>
    ModelCompatibilitySystem.getInstance().checkCompatibility(modelId, requirements),

  /**
   * 自動選択
   */
  autoSelect: (region: string, requirements?: any) =>
    ModelCompatibilitySystem.getInstance().autoSelectModel(region, requirements),

  /**
   * モデル情報取得
   */
  getInfo: (modelId: string) =>
    ModelCompatibilitySystem.getInstance().getModelInfo(modelId),

  /**
   * 利用可能なモデル一覧
   */
  getAvailable: (region: string) =>
    ModelCompatibilitySystem.getInstance().getAvailableModels(region),

  /**
   * パターン情報取得
   */
  getPattern: (provider: string) =>
    ModelCompatibilitySystem.getInstance().getModelPattern(provider),

  /**
   * リージョン別可用性マトリックス
   */
  getRegionalMatrix: () =>
    ModelCompatibilitySystem.getInstance().getRegionalAvailabilityMatrix(),
};