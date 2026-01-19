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
export declare class BedrockModelConfig {
    private static instance;
    private providers;
    private families;
    private regions;
    private constructor();
    static getInstance(): BedrockModelConfig;
    /**
     * プロバイダー設定の初期化
     */
    private initializeProviders;
    /**
     * モデルファミリー設定の初期化
     */
    private initializeFamilies;
    /**
     * リージョン設定の初期化
     */
    private initializeRegions;
    /**
     * 指定されたリージョンとユースケースに最適なモデルを取得
     */
    getOptimalModel(region: string, useCase?: 'chat' | 'generation' | 'costEffective' | 'multimodal', requirements?: {
        onDemand?: boolean;
        streaming?: boolean;
        crossRegion?: boolean;
        inputModalities?: string[];
    }): string | null;
    /**
     * モデルの互換性をチェック
     */
    checkModelCompatibility(modelId: string, region: string, requirements: {
        onDemand?: boolean;
        streaming?: boolean;
        crossRegion?: boolean;
        inputModalities?: string[];
    }): boolean;
    /**
     * フォールバックモデルを検索
     */
    private findFallbackModel;
    /**
     * モデルIDからモデル情報を検索
     */
    private findModelById;
    /**
     * 新しいプロバイダーを追加
     */
    addProvider(name: string, config: ModelProvider): void;
    /**
     * 新しいモデルファミリーを追加
     */
    addModelFamily(name: string, family: ModelFamily): void;
    /**
     * 既存ファミリーに新しいモデルバージョンを追加
     */
    addModelVersion(familyName: string, model: ModelVersion): void;
    /**
     * モデルを非推奨に設定
     */
    deprecateModel(modelId: string, replacementModel?: string): void;
    /**
     * 設定を外部ファイルから読み込み
     */
    loadFromFile(configPath: string): void;
    /**
     * 設定をParameter Storeから読み込み
     */
    loadFromParameterStore(parameterPrefix: string): void;
    /**
     * 全プロバイダー情報を取得
     */
    getAllProviders(): Map<string, ModelProvider>;
    /**
     * 全モデルファミリー情報を取得
     */
    getAllFamilies(): Map<string, ModelFamily>;
    /**
     * 指定リージョンで利用可能なモデル一覧を取得
     */
    getAvailableModels(region: string): ModelVersion[];
}
