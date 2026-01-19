"use strict";
/**
 * Bedrock モデル設定管理システム
 * 動的なモデル追加・削除・更新に対応
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockModelConfig = void 0;
/**
 * 動的モデル設定クラス
 */
class BedrockModelConfig {
    static instance;
    // 設定データ（外部ファイルまたはParameter Storeから読み込み可能）
    providers = new Map();
    families = new Map();
    regions = new Map();
    constructor() {
        this.initializeProviders();
        this.initializeFamilies();
        this.initializeRegions();
    }
    static getInstance() {
        if (!BedrockModelConfig.instance) {
            BedrockModelConfig.instance = new BedrockModelConfig();
        }
        return BedrockModelConfig.instance;
    }
    /**
     * プロバイダー設定の初期化
     */
    initializeProviders() {
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
    initializeFamilies() {
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
    initializeRegions() {
        // 主要リージョンの設定
        const regionConfigs = [
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
    getOptimalModel(region, useCase = 'chat', requirements) {
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
    checkModelCompatibility(modelId, region, requirements) {
        const model = this.findModelById(modelId);
        if (!model)
            return false;
        // リージョンサポートチェック
        if (!model.supportedRegions.includes(region))
            return false;
        // 機能要件チェック
        if (requirements.onDemand && !model.features.onDemand)
            return false;
        if (requirements.streaming && !model.features.streaming)
            return false;
        if (requirements.crossRegion && !model.features.crossRegion)
            return false;
        // 入力モダリティチェック
        if (requirements.inputModalities) {
            const hasAllModalities = requirements.inputModalities.every(modality => model.inputModalities.includes(modality));
            if (!hasAllModalities)
                return false;
        }
        // 非推奨モデルは除外
        if (model.status === 'deprecated')
            return false;
        return true;
    }
    /**
     * フォールバックモデルを検索
     */
    findFallbackModel(region, useCase, requirements) {
        // 利用可能なモデルを優先順位順に検索
        const priorities = {
            chat: ['claude-3-5-sonnet', 'claude-3-haiku', 'nova'],
            generation: ['claude-3-5-sonnet', 'nova', 'claude-3-haiku'],
            costEffective: ['claude-3-haiku', 'nova', 'claude-3-5-sonnet'],
            multimodal: ['nova'],
        };
        const familyPriority = priorities[useCase] || priorities.chat;
        for (const familyName of familyPriority) {
            const family = this.families.get(familyName);
            if (!family)
                continue;
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
    findModelById(modelId) {
        for (const family of Array.from(this.families.values())) {
            const model = family.models.find(m => m.modelId === modelId);
            if (model)
                return model;
        }
        return null;
    }
    /**
     * 新しいプロバイダーを追加
     */
    addProvider(name, config) {
        this.providers.set(name, config);
    }
    /**
     * 新しいモデルファミリーを追加
     */
    addModelFamily(name, family) {
        this.families.set(name, family);
    }
    /**
     * 既存ファミリーに新しいモデルバージョンを追加
     */
    addModelVersion(familyName, model) {
        const family = this.families.get(familyName);
        if (family) {
            family.models.push(model);
            // 新しいモデルが安定版の場合、デフォルトモデルを更新
            if (model.status === 'stable' && model.releaseDate > family.models.find(m => m.modelId === family.defaultModel)?.releaseDate) {
                family.defaultModel = model.modelId;
            }
        }
    }
    /**
     * モデルを非推奨に設定
     */
    deprecateModel(modelId, replacementModel) {
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
    loadFromFile(configPath) {
        // 実装: JSON/YAMLファイルから設定を読み込み
        // この機能により、CDKデプロイ時に外部設定ファイルを参照可能
    }
    /**
     * 設定をParameter Storeから読み込み
     */
    loadFromParameterStore(parameterPrefix) {
        // 実装: AWS Systems Manager Parameter Storeから設定を読み込み
        // 動的な設定更新が可能
    }
    /**
     * 全プロバイダー情報を取得
     */
    getAllProviders() {
        return new Map(this.providers);
    }
    /**
     * 全モデルファミリー情報を取得
     */
    getAllFamilies() {
        return new Map(this.families);
    }
    /**
     * 指定リージョンで利用可能なモデル一覧を取得
     */
    getAvailableModels(region) {
        const availableModels = [];
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
exports.BedrockModelConfig = BedrockModelConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1tb2RlbC1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZWRyb2NrLW1vZGVsLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFxREg7O0dBRUc7QUFDSCxNQUFhLGtCQUFrQjtJQUNyQixNQUFNLENBQUMsUUFBUSxDQUFxQjtJQUU1QywwQ0FBMEM7SUFDbEMsU0FBUyxHQUErQixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2xELFFBQVEsR0FBNkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUMvQyxPQUFPLEdBQThCLElBQUksR0FBRyxFQUFFLENBQUM7SUFFdkQ7UUFDRSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUMzQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMxQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRU0sTUFBTSxDQUFDLFdBQVc7UUFDdkIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2pDLGtCQUFrQixDQUFDLFFBQVEsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDekQsQ0FBQztRQUNELE9BQU8sa0JBQWtCLENBQUMsUUFBUSxDQUFDO0lBQ3JDLENBQUM7SUFFRDs7T0FFRztJQUNLLG1CQUFtQjtRQUN6QixZQUFZO1FBQ1osSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFO1lBQzlCLElBQUksRUFBRSxXQUFXO1lBQ2pCLGFBQWEsRUFBRSxpREFBaUQ7WUFDaEUsY0FBYyxFQUFFLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLENBQUM7WUFDekUsaUJBQWlCLEVBQUU7Z0JBQ2pCLFFBQVEsRUFBRSxJQUFJO2dCQUNkLFdBQVcsRUFBRSxJQUFJO2dCQUNqQixTQUFTLEVBQUUsSUFBSTtnQkFDZixXQUFXLEVBQUUsSUFBSTthQUNsQjtTQUNG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Q0FBQyxDQUFDO2dCQUM5QixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLGVBQWUsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUE5YUQsZ0RBOGFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBCZWRyb2NrIOODouODh+ODq+ioreWumueuoeeQhuOCt+OCueODhuODoFxuICog5YuV55qE44Gq44Oi44OH44Or6L+95Yqg44O75YmK6Zmk44O75pu05paw44Gr5a++5b+cXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBNb2RlbFByb3ZpZGVyIHtcbiAgbmFtZTogc3RyaW5nO1xuICBuYW1pbmdQYXR0ZXJuOiBzdHJpbmc7XG4gIGRlZmF1bHRSZWdpb25zOiBzdHJpbmdbXTtcbiAgc3VwcG9ydGVkRmVhdHVyZXM6IHtcbiAgICBvbkRlbWFuZDogYm9vbGVhbjtcbiAgICBwcm92aXNpb25lZDogYm9vbGVhbjtcbiAgICBzdHJlYW1pbmc6IGJvb2xlYW47XG4gICAgY3Jvc3NSZWdpb246IGJvb2xlYW47XG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9kZWxGYW1pbHkge1xuICBuYW1lOiBzdHJpbmc7XG4gIHByb3ZpZGVyOiBzdHJpbmc7XG4gIG1vZGVsczogTW9kZWxWZXJzaW9uW107XG4gIGRlZmF1bHRNb2RlbDogc3RyaW5nO1xuICBmYWxsYmFja01vZGVsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1vZGVsVmVyc2lvbiB7XG4gIG1vZGVsSWQ6IHN0cmluZztcbiAgdmVyc2lvbjogc3RyaW5nO1xuICByZWxlYXNlRGF0ZTogc3RyaW5nO1xuICBzdGF0dXM6ICdzdGFibGUnIHwgJ3ByZXZpZXcnIHwgJ2RlcHJlY2F0ZWQnO1xuICBzdXBwb3J0ZWRSZWdpb25zOiBzdHJpbmdbXTtcbiAgZmVhdHVyZXM6IHtcbiAgICBvbkRlbWFuZDogYm9vbGVhbjtcbiAgICBwcm92aXNpb25lZDogYm9vbGVhbjtcbiAgICBzdHJlYW1pbmc6IGJvb2xlYW47XG4gICAgY3Jvc3NSZWdpb246IGJvb2xlYW47XG4gICAgbXVsdGltb2RhbDogYm9vbGVhbjtcbiAgfTtcbiAgaW5wdXRNb2RhbGl0aWVzOiBzdHJpbmdbXTtcbiAgb3V0cHV0TW9kYWxpdGllczogc3RyaW5nW107XG4gIGRlcHJlY2F0aW9uRGF0ZT86IHN0cmluZztcbiAgcmVwbGFjZW1lbnRNb2RlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWdpb25Db25maWcge1xuICByZWdpb25JZDogc3RyaW5nO1xuICByZWdpb25OYW1lOiBzdHJpbmc7XG4gIHN1cHBvcnRlZFByb3ZpZGVyczogc3RyaW5nW107XG4gIHByZWZlcnJlZE1vZGVsczoge1xuICAgIGNoYXQ6IHN0cmluZztcbiAgICBnZW5lcmF0aW9uOiBzdHJpbmc7XG4gICAgY29zdEVmZmVjdGl2ZTogc3RyaW5nO1xuICAgIG11bHRpbW9kYWw/OiBzdHJpbmc7XG4gIH07XG59XG5cbi8qKlxuICog5YuV55qE44Oi44OH44Or6Kit5a6a44Kv44Op44K5XG4gKi9cbmV4cG9ydCBjbGFzcyBCZWRyb2NrTW9kZWxDb25maWcge1xuICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogQmVkcm9ja01vZGVsQ29uZmlnO1xuICBcbiAgLy8g6Kit5a6a44OH44O844K/77yI5aSW6YOo44OV44Kh44Kk44Or44G+44Gf44GvUGFyYW1ldGVyIFN0b3Jl44GL44KJ6Kqt44G/6L6844G/5Y+v6IO977yJXG4gIHByaXZhdGUgcHJvdmlkZXJzOiBNYXA8c3RyaW5nLCBNb2RlbFByb3ZpZGVyPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBmYW1pbGllczogTWFwPHN0cmluZywgTW9kZWxGYW1pbHk+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIHJlZ2lvbnM6IE1hcDxzdHJpbmcsIFJlZ2lvbkNvbmZpZz4gPSBuZXcgTWFwKCk7XG4gIFxuICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaW5pdGlhbGl6ZVByb3ZpZGVycygpO1xuICAgIHRoaXMuaW5pdGlhbGl6ZUZhbWlsaWVzKCk7XG4gICAgdGhpcy5pbml0aWFsaXplUmVnaW9ucygpO1xuICB9XG4gIFxuICBwdWJsaWMgc3RhdGljIGdldEluc3RhbmNlKCk6IEJlZHJvY2tNb2RlbENvbmZpZyB7XG4gICAgaWYgKCFCZWRyb2NrTW9kZWxDb25maWcuaW5zdGFuY2UpIHtcbiAgICAgIEJlZHJvY2tNb2RlbENvbmZpZy5pbnN0YW5jZSA9IG5ldyBCZWRyb2NrTW9kZWxDb25maWcoKTtcbiAgICB9XG4gICAgcmV0dXJuIEJlZHJvY2tNb2RlbENvbmZpZy5pbnN0YW5jZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOODl+ODreODkOOCpOODgOODvOioreWumuOBruWIneacn+WMllxuICAgKi9cbiAgcHJpdmF0ZSBpbml0aWFsaXplUHJvdmlkZXJzKCk6IHZvaWQge1xuICAgIC8vIEFudGhyb3BpY1xuICAgIHRoaXMucHJvdmlkZXJzLnNldCgnYW50aHJvcGljJywge1xuICAgICAgbmFtZTogJ0FudGhyb3BpYycsXG4gICAgICBuYW1pbmdQYXR0ZXJuOiAnYW50aHJvcGljLmNsYXVkZS17dmVyc2lvbn0te2RhdGV9LXZ7cmV2aXNpb259OjAnLFxuICAgICAgZGVmYXVsdFJlZ2lvbnM6IFsndXMtZWFzdC0xJywgJ3VzLXdlc3QtMicsICdhcC1ub3J0aGVhc3QtMScsICdldS13ZXN0LTEnXSxcbiAgICAgIHN1cHBvcnRlZEZlYXR1cmVzOiB7XG4gICAgICAgIG9uRGVtYW5kOiB0cnVlLFxuICAgICAgICBwcm92aXNpb25lZDogdHJ1ZSxcbiAgICAgICAgc3RyZWFtaW5nOiB0cnVlLFxuICAgICAgICBjcm9zc1JlZ2lvbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQW1hem9uXG4gICAgdGhpcy5wcm92aWRlcnMuc2V0KCdhbWF6b24nLCB7XG4gICAgICBuYW1lOiAnQW1hem9uJyxcbiAgICAgIG5hbWluZ1BhdHRlcm46ICdhbWF6b24ue21vZGVsLW5hbWV9LXt2ZXJzaW9ufScsXG4gICAgICBkZWZhdWx0UmVnaW9uczogWyd1cy1lYXN0LTEnLCAndXMtd2VzdC0yJywgJ2FwLW5vcnRoZWFzdC0xJ10sXG4gICAgICBzdXBwb3J0ZWRGZWF0dXJlczoge1xuICAgICAgICBvbkRlbWFuZDogdHJ1ZSxcbiAgICAgICAgcHJvdmlzaW9uZWQ6IGZhbHNlLCAvLyBOb3Zh44K344Oq44O844K644Gv5Z+65pys55qE44Gr44Kq44Oz44OH44Oe44Oz44OJ44Gu44G/XG4gICAgICAgIHN0cmVhbWluZzogdHJ1ZSxcbiAgICAgICAgY3Jvc3NSZWdpb246IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIC8vIE1ldGHvvIjlsIbmnaXov73liqDjgZXjgozjgovlj6/og73mgKfvvIlcbiAgICB0aGlzLnByb3ZpZGVycy5zZXQoJ21ldGEnLCB7XG4gICAgICBuYW1lOiAnTWV0YScsXG4gICAgICBuYW1pbmdQYXR0ZXJuOiAnbWV0YS5sbGFtYXt2ZXJzaW9ufS17c2l6ZX1iLXt0eXBlfS12e3JldmlzaW9ufTowJyxcbiAgICAgIGRlZmF1bHRSZWdpb25zOiBbJ3VzLWVhc3QtMScsICd1cy13ZXN0LTInXSxcbiAgICAgIHN1cHBvcnRlZEZlYXR1cmVzOiB7XG4gICAgICAgIG9uRGVtYW5kOiB0cnVlLFxuICAgICAgICBwcm92aXNpb25lZDogdHJ1ZSxcbiAgICAgICAgc3RyZWFtaW5nOiB0cnVlLFxuICAgICAgICBjcm9zc1JlZ2lvbjogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog44Oi44OH44Or44OV44Kh44Of44Oq44O86Kit5a6a44Gu5Yid5pyf5YyWXG4gICAqL1xuICBwcml2YXRlIGluaXRpYWxpemVGYW1pbGllcygpOiB2b2lkIHtcbiAgICAvLyBDbGF1ZGUgMy41IFNvbm5ldFxuICAgIHRoaXMuZmFtaWxpZXMuc2V0KCdjbGF1ZGUtMy01LXNvbm5ldCcsIHtcbiAgICAgIG5hbWU6ICdDbGF1ZGUgMy41IFNvbm5ldCcsXG4gICAgICBwcm92aWRlcjogJ2FudGhyb3BpYycsXG4gICAgICBkZWZhdWx0TW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQtMjAyNDA2MjAtdjE6MCcsXG4gICAgICBmYWxsYmFja01vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLFxuICAgICAgbW9kZWxzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RlbElkOiAnYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjAnLFxuICAgICAgICAgIHZlcnNpb246ICcyMDI0MDYyMC12MScsXG4gICAgICAgICAgcmVsZWFzZURhdGU6ICcyMDI0LTA2LTIwJyxcbiAgICAgICAgICBzdGF0dXM6ICdzdGFibGUnLFxuICAgICAgICAgIHN1cHBvcnRlZFJlZ2lvbnM6IFsndXMtZWFzdC0xJywgJ3VzLXdlc3QtMicsICdhcC1ub3J0aGVhc3QtMScsICdldS13ZXN0LTEnLCAnYXAtc291dGhlYXN0LTEnLCAnYXAtc291dGhlYXN0LTInXSxcbiAgICAgICAgICBmZWF0dXJlczoge1xuICAgICAgICAgICAgb25EZW1hbmQ6IHRydWUsXG4gICAgICAgICAgICBwcm92aXNpb25lZDogdHJ1ZSxcbiAgICAgICAgICAgIHN0cmVhbWluZzogdHJ1ZSxcbiAgICAgICAgICAgIGNyb3NzUmVnaW9uOiB0cnVlLFxuICAgICAgICAgICAgbXVsdGltb2RhbDogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICAgIG91dHB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbW9kZWxJZDogJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMi12MjowJyxcbiAgICAgICAgICB2ZXJzaW9uOiAnMjAyNDEwMjItdjInLFxuICAgICAgICAgIHJlbGVhc2VEYXRlOiAnMjAyNC0xMC0yMicsXG4gICAgICAgICAgc3RhdHVzOiAnZGVwcmVjYXRlZCcsXG4gICAgICAgICAgc3VwcG9ydGVkUmVnaW9uczogWyd1cy1lYXN0LTEnLCAndXMtd2VzdC0yJ10sXG4gICAgICAgICAgZmVhdHVyZXM6IHtcbiAgICAgICAgICAgIG9uRGVtYW5kOiBmYWxzZSwgLy8g5ZWP6aGM44Gu44GC44KL44Oi44OH44OrXG4gICAgICAgICAgICBwcm92aXNpb25lZDogdHJ1ZSxcbiAgICAgICAgICAgIHN0cmVhbWluZzogZmFsc2UsXG4gICAgICAgICAgICBjcm9zc1JlZ2lvbjogZmFsc2UsXG4gICAgICAgICAgICBtdWx0aW1vZGFsOiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGlucHV0TW9kYWxpdGllczogWydUZXh0J10sXG4gICAgICAgICAgb3V0cHV0TW9kYWxpdGllczogWydUZXh0J10sXG4gICAgICAgICAgZGVwcmVjYXRpb25EYXRlOiAnMjAyNC0xMi0wMScsXG4gICAgICAgICAgcmVwbGFjZW1lbnRNb2RlbDogJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MDYyMC12MTowJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ2xhdWRlIDMgSGFpa3VcbiAgICB0aGlzLmZhbWlsaWVzLnNldCgnY2xhdWRlLTMtaGFpa3UnLCB7XG4gICAgICBuYW1lOiAnQ2xhdWRlIDMgSGFpa3UnLFxuICAgICAgcHJvdmlkZXI6ICdhbnRocm9waWMnLFxuICAgICAgZGVmYXVsdE1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLFxuICAgICAgbW9kZWxzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RlbElkOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLFxuICAgICAgICAgIHZlcnNpb246ICcyMDI0MDMwNy12MScsXG4gICAgICAgICAgcmVsZWFzZURhdGU6ICcyMDI0LTAzLTA3JyxcbiAgICAgICAgICBzdGF0dXM6ICdzdGFibGUnLFxuICAgICAgICAgIHN1cHBvcnRlZFJlZ2lvbnM6IFsndXMtZWFzdC0xJywgJ3VzLXdlc3QtMicsICdhcC1ub3J0aGVhc3QtMScsICdldS13ZXN0LTEnLCAnYXAtc291dGhlYXN0LTEnLCAnYXAtc291dGhlYXN0LTInXSxcbiAgICAgICAgICBmZWF0dXJlczoge1xuICAgICAgICAgICAgb25EZW1hbmQ6IHRydWUsXG4gICAgICAgICAgICBwcm92aXNpb25lZDogdHJ1ZSxcbiAgICAgICAgICAgIHN0cmVhbWluZzogdHJ1ZSxcbiAgICAgICAgICAgIGNyb3NzUmVnaW9uOiB0cnVlLFxuICAgICAgICAgICAgbXVsdGltb2RhbDogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICAgIG91dHB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBbWF6b24gTm92YVxuICAgIHRoaXMuZmFtaWxpZXMuc2V0KCdub3ZhJywge1xuICAgICAgbmFtZTogJ0FtYXpvbiBOb3ZhJyxcbiAgICAgIHByb3ZpZGVyOiAnYW1hem9uJyxcbiAgICAgIGRlZmF1bHRNb2RlbDogJ2FtYXpvbi5ub3ZhLXByby12MTowJyxcbiAgICAgIGZhbGxiYWNrTW9kZWw6ICdhbWF6b24ubm92YS1saXRlLXYxOjAnLFxuICAgICAgbW9kZWxzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RlbElkOiAnYW1hem9uLm5vdmEtcHJvLXYxOjAnLFxuICAgICAgICAgIHZlcnNpb246ICd2MScsXG4gICAgICAgICAgcmVsZWFzZURhdGU6ICcyMDI0LTExLTAxJyxcbiAgICAgICAgICBzdGF0dXM6ICdzdGFibGUnLFxuICAgICAgICAgIHN1cHBvcnRlZFJlZ2lvbnM6IFsndXMtZWFzdC0xJywgJ3VzLXdlc3QtMicsICdhcC1ub3J0aGVhc3QtMScsICdldS13ZXN0LTEnXSxcbiAgICAgICAgICBmZWF0dXJlczoge1xuICAgICAgICAgICAgb25EZW1hbmQ6IHRydWUsXG4gICAgICAgICAgICBwcm92aXNpb25lZDogZmFsc2UsXG4gICAgICAgICAgICBzdHJlYW1pbmc6IHRydWUsXG4gICAgICAgICAgICBjcm9zc1JlZ2lvbjogdHJ1ZSxcbiAgICAgICAgICAgIG11bHRpbW9kYWw6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnB1dE1vZGFsaXRpZXM6IFsnVGV4dCcsICdJbWFnZSddLFxuICAgICAgICAgIG91dHB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbW9kZWxJZDogJ2FtYXpvbi5ub3ZhLWxpdGUtdjE6MCcsXG4gICAgICAgICAgdmVyc2lvbjogJ3YxJyxcbiAgICAgICAgICByZWxlYXNlRGF0ZTogJzIwMjQtMTEtMDEnLFxuICAgICAgICAgIHN0YXR1czogJ3N0YWJsZScsXG4gICAgICAgICAgc3VwcG9ydGVkUmVnaW9uczogWyd1cy1lYXN0LTEnLCAndXMtd2VzdC0yJywgJ2FwLW5vcnRoZWFzdC0xJywgJ2V1LXdlc3QtMScsICdhcC1zb3V0aGVhc3QtMScsICdhcC1zb3V0aGVhc3QtMiddLFxuICAgICAgICAgIGZlYXR1cmVzOiB7XG4gICAgICAgICAgICBvbkRlbWFuZDogdHJ1ZSxcbiAgICAgICAgICAgIHByb3Zpc2lvbmVkOiBmYWxzZSxcbiAgICAgICAgICAgIHN0cmVhbWluZzogdHJ1ZSxcbiAgICAgICAgICAgIGNyb3NzUmVnaW9uOiB0cnVlLFxuICAgICAgICAgICAgbXVsdGltb2RhbDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGlucHV0TW9kYWxpdGllczogWydUZXh0JywgJ0ltYWdlJ10sXG4gICAgICAgICAgb3V0cHV0TW9kYWxpdGllczogWydUZXh0J10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog44Oq44O844K444On44Oz6Kit5a6a44Gu5Yid5pyf5YyWXG4gICAqL1xuICBwcml2YXRlIGluaXRpYWxpemVSZWdpb25zKCk6IHZvaWQge1xuICAgIC8vIOS4u+imgeODquODvOOCuOODp+ODs+OBruioreWumlxuICAgIGNvbnN0IHJlZ2lvbkNvbmZpZ3M6IFJlZ2lvbkNvbmZpZ1tdID0gW1xuICAgICAge1xuICAgICAgICByZWdpb25JZDogJ3VzLWVhc3QtMScsXG4gICAgICAgIHJlZ2lvbk5hbWU6ICdVUyBFYXN0IChOLiBWaXJnaW5pYSknLFxuICAgICAgICBzdXBwb3J0ZWRQcm92aWRlcnM6IFsnYW50aHJvcGljJywgJ2FtYXpvbicsICdtZXRhJ10sXG4gICAgICAgIHByZWZlcnJlZE1vZGVsczoge1xuICAgICAgICAgIGNoYXQ6ICdhbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQtMjAyNDA2MjAtdjE6MCcsXG4gICAgICAgICAgZ2VuZXJhdGlvbjogJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MDYyMC12MTowJyxcbiAgICAgICAgICBjb3N0RWZmZWN0aXZlOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLFxuICAgICAgICAgIG11bHRpbW9kYWw6ICdhbWF6b24ubm92YS1wcm8tdjE6MCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICByZWdpb25JZDogJ2FwLW5vcnRoZWFzdC0xJyxcbiAgICAgICAgcmVnaW9uTmFtZTogJ0FzaWEgUGFjaWZpYyAoVG9reW8pJyxcbiAgICAgICAgc3VwcG9ydGVkUHJvdmlkZXJzOiBbJ2FudGhyb3BpYycsICdhbWF6b24nXSxcbiAgICAgICAgcHJlZmVycmVkTW9kZWxzOiB7XG4gICAgICAgICAgY2hhdDogJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MDYyMC12MTowJyxcbiAgICAgICAgICBnZW5lcmF0aW9uOiAnYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjAnLFxuICAgICAgICAgIGNvc3RFZmZlY3RpdmU6ICdhbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MCcsXG4gICAgICAgICAgbXVsdGltb2RhbDogJ2FtYXpvbi5ub3ZhLXByby12MTowJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbklkOiAnZXUtd2VzdC0xJyxcbiAgICAgICAgcmVnaW9uTmFtZTogJ0V1cm9wZSAoSXJlbGFuZCknLFxuICAgICAgICBzdXBwb3J0ZWRQcm92aWRlcnM6IFsnYW50aHJvcGljJywgJ2FtYXpvbiddLFxuICAgICAgICBwcmVmZXJyZWRNb2RlbHM6IHtcbiAgICAgICAgICBjaGF0OiAnYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjAnLFxuICAgICAgICAgIGdlbmVyYXRpb246ICdhbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQtMjAyNDA2MjAtdjE6MCcsXG4gICAgICAgICAgY29zdEVmZmVjdGl2ZTogJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJyxcbiAgICAgICAgICBtdWx0aW1vZGFsOiAnYW1hem9uLm5vdmEtbGl0ZS12MTowJywgLy8gTm92YSBQcm/jgYzliKnnlKjjgafjgY3jgarjgYTloLTlkIhcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXTtcbiAgICBcbiAgICByZWdpb25Db25maWdzLmZvckVhY2goY29uZmlnID0+IHtcbiAgICAgIHRoaXMucmVnaW9ucy5zZXQoY29uZmlnLnJlZ2lvbklkLCBjb25maWcpO1xuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5oyH5a6a44GV44KM44Gf44Oq44O844K444On44Oz44Go44Om44O844K544Kx44O844K544Gr5pyA6YGp44Gq44Oi44OH44Or44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0T3B0aW1hbE1vZGVsKFxuICAgIHJlZ2lvbjogc3RyaW5nLFxuICAgIHVzZUNhc2U6ICdjaGF0JyB8ICdnZW5lcmF0aW9uJyB8ICdjb3N0RWZmZWN0aXZlJyB8ICdtdWx0aW1vZGFsJyA9ICdjaGF0JyxcbiAgICByZXF1aXJlbWVudHM/OiB7XG4gICAgICBvbkRlbWFuZD86IGJvb2xlYW47XG4gICAgICBzdHJlYW1pbmc/OiBib29sZWFuO1xuICAgICAgY3Jvc3NSZWdpb24/OiBib29sZWFuO1xuICAgICAgaW5wdXRNb2RhbGl0aWVzPzogc3RyaW5nW107XG4gICAgfVxuICApOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCByZWdpb25Db25maWcgPSB0aGlzLnJlZ2lvbnMuZ2V0KHJlZ2lvbik7XG4gICAgaWYgKCFyZWdpb25Db25maWcpIHtcbiAgICAgIC8vIOODleOCqeODvOODq+ODkOODg+OCrzog44OH44OV44Kp44Or44OI44Oq44O844K444On44Oz44Gu6Kit5a6a44KS5L2/55SoXG4gICAgICByZXR1cm4gdGhpcy5nZXRPcHRpbWFsTW9kZWwoJ3VzLWVhc3QtMScsIHVzZUNhc2UsIHJlcXVpcmVtZW50cyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOaOqOWlqOODouODh+ODq+OCkuWPluW+l1xuICAgIGxldCBwcmVmZXJyZWRNb2RlbCA9IHJlZ2lvbkNvbmZpZy5wcmVmZXJyZWRNb2RlbHNbdXNlQ2FzZV07XG4gICAgXG4gICAgLy8g6KaB5Lu244OB44Kn44OD44KvXG4gICAgaWYgKHJlcXVpcmVtZW50cyAmJiBwcmVmZXJyZWRNb2RlbCkge1xuICAgICAgY29uc3QgaXNDb21wYXRpYmxlID0gdGhpcy5jaGVja01vZGVsQ29tcGF0aWJpbGl0eShwcmVmZXJyZWRNb2RlbCwgcmVnaW9uLCByZXF1aXJlbWVudHMpO1xuICAgICAgaWYgKCFpc0NvbXBhdGlibGUpIHtcbiAgICAgICAgLy8g44OV44Kp44O844Or44OQ44OD44Kv44Oi44OH44Or44KS5qSc57SiXG4gICAgICAgIHByZWZlcnJlZE1vZGVsID0gdGhpcy5maW5kRmFsbGJhY2tNb2RlbChyZWdpb24sIHVzZUNhc2UsIHJlcXVpcmVtZW50cyk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBwcmVmZXJyZWRNb2RlbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOODouODh+ODq+OBruS6kuaPm+aAp+OCkuODgeOCp+ODg+OCr1xuICAgKi9cbiAgcHVibGljIGNoZWNrTW9kZWxDb21wYXRpYmlsaXR5KFxuICAgIG1vZGVsSWQ6IHN0cmluZyxcbiAgICByZWdpb246IHN0cmluZyxcbiAgICByZXF1aXJlbWVudHM6IHtcbiAgICAgIG9uRGVtYW5kPzogYm9vbGVhbjtcbiAgICAgIHN0cmVhbWluZz86IGJvb2xlYW47XG4gICAgICBjcm9zc1JlZ2lvbj86IGJvb2xlYW47XG4gICAgICBpbnB1dE1vZGFsaXRpZXM/OiBzdHJpbmdbXTtcbiAgICB9XG4gICk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG1vZGVsID0gdGhpcy5maW5kTW9kZWxCeUlkKG1vZGVsSWQpO1xuICAgIGlmICghbW9kZWwpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICAvLyDjg6rjg7zjgrjjg6fjg7PjgrXjg53jg7zjg4jjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoIW1vZGVsLnN1cHBvcnRlZFJlZ2lvbnMuaW5jbHVkZXMocmVnaW9uKSkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIC8vIOapn+iDveimgeS7tuODgeOCp+ODg+OCr1xuICAgIGlmIChyZXF1aXJlbWVudHMub25EZW1hbmQgJiYgIW1vZGVsLmZlYXR1cmVzLm9uRGVtYW5kKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHJlcXVpcmVtZW50cy5zdHJlYW1pbmcgJiYgIW1vZGVsLmZlYXR1cmVzLnN0cmVhbWluZykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChyZXF1aXJlbWVudHMuY3Jvc3NSZWdpb24gJiYgIW1vZGVsLmZlYXR1cmVzLmNyb3NzUmVnaW9uKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgLy8g5YWl5Yqb44Oi44OA44Oq44OG44Kj44OB44Kn44OD44KvXG4gICAgaWYgKHJlcXVpcmVtZW50cy5pbnB1dE1vZGFsaXRpZXMpIHtcbiAgICAgIGNvbnN0IGhhc0FsbE1vZGFsaXRpZXMgPSByZXF1aXJlbWVudHMuaW5wdXRNb2RhbGl0aWVzLmV2ZXJ5KG1vZGFsaXR5ID0+XG4gICAgICAgIG1vZGVsLmlucHV0TW9kYWxpdGllcy5pbmNsdWRlcyhtb2RhbGl0eSlcbiAgICAgICk7XG4gICAgICBpZiAoIWhhc0FsbE1vZGFsaXRpZXMpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgLy8g6Z2e5o6o5aWo44Oi44OH44Or44Gv6Zmk5aSWXG4gICAgaWYgKG1vZGVsLnN0YXR1cyA9PT0gJ2RlcHJlY2F0ZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDjg5Xjgqnjg7zjg6vjg5Djg4Pjgq/jg6Ljg4fjg6vjgpLmpJzntKJcbiAgICovXG4gIHByaXZhdGUgZmluZEZhbGxiYWNrTW9kZWwoXG4gICAgcmVnaW9uOiBzdHJpbmcsXG4gICAgdXNlQ2FzZTogc3RyaW5nLFxuICAgIHJlcXVpcmVtZW50czogYW55XG4gICk6IHN0cmluZyB8IG51bGwge1xuICAgIC8vIOWIqeeUqOWPr+iDveOBquODouODh+ODq+OCkuWEquWFiOmghuS9jemghuOBq+aknOe0olxuICAgIGNvbnN0IHByaW9yaXRpZXMgPSB7XG4gICAgICBjaGF0OiBbJ2NsYXVkZS0zLTUtc29ubmV0JywgJ2NsYXVkZS0zLWhhaWt1JywgJ25vdmEnXSxcbiAgICAgIGdlbmVyYXRpb246IFsnY2xhdWRlLTMtNS1zb25uZXQnLCAnbm92YScsICdjbGF1ZGUtMy1oYWlrdSddLFxuICAgICAgY29zdEVmZmVjdGl2ZTogWydjbGF1ZGUtMy1oYWlrdScsICdub3ZhJywgJ2NsYXVkZS0zLTUtc29ubmV0J10sXG4gICAgICBtdWx0aW1vZGFsOiBbJ25vdmEnXSxcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IGZhbWlseVByaW9yaXR5ID0gcHJpb3JpdGllc1t1c2VDYXNlIGFzIGtleW9mIHR5cGVvZiBwcmlvcml0aWVzXSB8fCBwcmlvcml0aWVzLmNoYXQ7XG4gICAgXG4gICAgZm9yIChjb25zdCBmYW1pbHlOYW1lIG9mIGZhbWlseVByaW9yaXR5KSB7XG4gICAgICBjb25zdCBmYW1pbHkgPSB0aGlzLmZhbWlsaWVzLmdldChmYW1pbHlOYW1lKTtcbiAgICAgIGlmICghZmFtaWx5KSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBtb2RlbCBvZiBmYW1pbHkubW9kZWxzKSB7XG4gICAgICAgIGlmICh0aGlzLmNoZWNrTW9kZWxDb21wYXRpYmlsaXR5KG1vZGVsLm1vZGVsSWQsIHJlZ2lvbiwgcmVxdWlyZW1lbnRzKSkge1xuICAgICAgICAgIHJldHVybiBtb2RlbC5tb2RlbElkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICAvKipcbiAgICog44Oi44OH44OrSUTjgYvjgonjg6Ljg4fjg6vmg4XloLHjgpLmpJzntKJcbiAgICovXG4gIHByaXZhdGUgZmluZE1vZGVsQnlJZChtb2RlbElkOiBzdHJpbmcpOiBNb2RlbFZlcnNpb24gfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IGZhbWlseSBvZiBBcnJheS5mcm9tKHRoaXMuZmFtaWxpZXMudmFsdWVzKCkpKSB7XG4gICAgICBjb25zdCBtb2RlbCA9IGZhbWlseS5tb2RlbHMuZmluZChtID0+IG0ubW9kZWxJZCA9PT0gbW9kZWxJZCk7XG4gICAgICBpZiAobW9kZWwpIHJldHVybiBtb2RlbDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmlrDjgZfjgYTjg5fjg63jg5DjgqTjg4Djg7zjgpLov73liqBcbiAgICovXG4gIHB1YmxpYyBhZGRQcm92aWRlcihuYW1lOiBzdHJpbmcsIGNvbmZpZzogTW9kZWxQcm92aWRlcik6IHZvaWQge1xuICAgIHRoaXMucHJvdmlkZXJzLnNldChuYW1lLCBjb25maWcpO1xuICB9XG4gIFxuICAvKipcbiAgICog5paw44GX44GE44Oi44OH44Or44OV44Kh44Of44Oq44O844KS6L+95YqgXG4gICAqL1xuICBwdWJsaWMgYWRkTW9kZWxGYW1pbHkobmFtZTogc3RyaW5nLCBmYW1pbHk6IE1vZGVsRmFtaWx5KTogdm9pZCB7XG4gICAgdGhpcy5mYW1pbGllcy5zZXQobmFtZSwgZmFtaWx5KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaXouWtmOODleOCoeODn+ODquODvOOBq+aWsOOBl+OBhOODouODh+ODq+ODkOODvOOCuOODp+ODs+OCkui/veWKoFxuICAgKi9cbiAgcHVibGljIGFkZE1vZGVsVmVyc2lvbihmYW1pbHlOYW1lOiBzdHJpbmcsIG1vZGVsOiBNb2RlbFZlcnNpb24pOiB2b2lkIHtcbiAgICBjb25zdCBmYW1pbHkgPSB0aGlzLmZhbWlsaWVzLmdldChmYW1pbHlOYW1lKTtcbiAgICBpZiAoZmFtaWx5KSB7XG4gICAgICBmYW1pbHkubW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgLy8g5paw44GX44GE44Oi44OH44Or44GM5a6J5a6a54mI44Gu5aC05ZCI44CB44OH44OV44Kp44Or44OI44Oi44OH44Or44KS5pu05pawXG4gICAgICBpZiAobW9kZWwuc3RhdHVzID09PSAnc3RhYmxlJyAmJiBtb2RlbC5yZWxlYXNlRGF0ZSA+IGZhbWlseS5tb2RlbHMuZmluZChtID0+IG0ubW9kZWxJZCA9PT0gZmFtaWx5LmRlZmF1bHRNb2RlbCk/LnJlbGVhc2VEYXRlISkge1xuICAgICAgICBmYW1pbHkuZGVmYXVsdE1vZGVsID0gbW9kZWwubW9kZWxJZDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDjg6Ljg4fjg6vjgpLpnZ7mjqjlpajjgavoqK3lrppcbiAgICovXG4gIHB1YmxpYyBkZXByZWNhdGVNb2RlbChtb2RlbElkOiBzdHJpbmcsIHJlcGxhY2VtZW50TW9kZWw/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBtb2RlbCA9IHRoaXMuZmluZE1vZGVsQnlJZChtb2RlbElkKTtcbiAgICBpZiAobW9kZWwpIHtcbiAgICAgIG1vZGVsLnN0YXR1cyA9ICdkZXByZWNhdGVkJztcbiAgICAgIG1vZGVsLmRlcHJlY2F0aW9uRGF0ZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdO1xuICAgICAgaWYgKHJlcGxhY2VtZW50TW9kZWwpIHtcbiAgICAgICAgbW9kZWwucmVwbGFjZW1lbnRNb2RlbCA9IHJlcGxhY2VtZW50TW9kZWw7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6Kit5a6a44KS5aSW6YOo44OV44Kh44Kk44Or44GL44KJ6Kqt44G/6L6844G/XG4gICAqL1xuICBwdWJsaWMgbG9hZEZyb21GaWxlKGNvbmZpZ1BhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIOWun+ijhTogSlNPTi9ZQU1M44OV44Kh44Kk44Or44GL44KJ6Kit5a6a44KS6Kqt44G/6L6844G/XG4gICAgLy8g44GT44Gu5qmf6IO944Gr44KI44KK44CBQ0RL44OH44OX44Ot44Kk5pmC44Gr5aSW6YOo6Kit5a6a44OV44Kh44Kk44Or44KS5Y+C54Wn5Y+v6IO9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDoqK3lrprjgpJQYXJhbWV0ZXIgU3RvcmXjgYvjgonoqq3jgb/ovrzjgb9cbiAgICovXG4gIHB1YmxpYyBsb2FkRnJvbVBhcmFtZXRlclN0b3JlKHBhcmFtZXRlclByZWZpeDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8g5a6f6KOFOiBBV1MgU3lzdGVtcyBNYW5hZ2VyIFBhcmFtZXRlciBTdG9yZeOBi+OCieioreWumuOCkuiqreOBv+i+vOOBv1xuICAgIC8vIOWLleeahOOBquioreWumuabtOaWsOOBjOWPr+iDvVxuICB9XG4gIFxuICAvKipcbiAgICog5YWo44OX44Ot44OQ44Kk44OA44O85oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0QWxsUHJvdmlkZXJzKCk6IE1hcDxzdHJpbmcsIE1vZGVsUHJvdmlkZXI+IHtcbiAgICByZXR1cm4gbmV3IE1hcCh0aGlzLnByb3ZpZGVycyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlhajjg6Ljg4fjg6vjg5XjgqHjg5/jg6rjg7zmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRBbGxGYW1pbGllcygpOiBNYXA8c3RyaW5nLCBNb2RlbEZhbWlseT4ge1xuICAgIHJldHVybiBuZXcgTWFwKHRoaXMuZmFtaWxpZXMpO1xuICB9XG4gIFxuICAvKipcbiAgICog5oyH5a6a44Oq44O844K444On44Oz44Gn5Yip55So5Y+v6IO944Gq44Oi44OH44Or5LiA6Kan44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0QXZhaWxhYmxlTW9kZWxzKHJlZ2lvbjogc3RyaW5nKTogTW9kZWxWZXJzaW9uW10ge1xuICAgIGNvbnN0IGF2YWlsYWJsZU1vZGVsczogTW9kZWxWZXJzaW9uW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZhbWlseSBvZiBBcnJheS5mcm9tKHRoaXMuZmFtaWxpZXMudmFsdWVzKCkpKSB7XG4gICAgICBmb3IgKGNvbnN0IG1vZGVsIG9mIGZhbWlseS5tb2RlbHMpIHtcbiAgICAgICAgaWYgKG1vZGVsLnN1cHBvcnRlZFJlZ2lvbnMuaW5jbHVkZXMocmVnaW9uKSAmJiBtb2RlbC5zdGF0dXMgIT09ICdkZXByZWNhdGVkJykge1xuICAgICAgICAgIGF2YWlsYWJsZU1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYXZhaWxhYmxlTW9kZWxzO1xuICB9XG59Il19