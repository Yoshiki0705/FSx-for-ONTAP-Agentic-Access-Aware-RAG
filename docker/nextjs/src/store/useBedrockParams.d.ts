/**
 * Amazon Bedrock パラメータ管理ストア
 *
 * 機能:
 * - モデル選択とパラメータ管理
 * - バリデーション機能
 * - プリセット設定
 * - エクスポート・インポート
 */
export declare enum BedrockModel {
    CLAUDE_3_SONNET = "anthropic.claude-3-sonnet-20240229-v1:0",
    CLAUDE_3_HAIKU = "anthropic.claude-3-haiku-20240307-v1:0",
    CLAUDE_3_OPUS = "anthropic.claude-3-opus-20240229-v1:0",
    CLAUDE_3_5_SONNET = "anthropic.claude-3-5-sonnet-20241022-v2:0",
    CLAUDE_3_5_HAIKU = "anthropic.claude-3-5-haiku-20241022-v1:0",
    NOVA_PRO = "amazon.nova-pro-v1:0",
    NOVA_LITE = "amazon.nova-lite-v1:0",
    NOVA_MICRO = "amazon.nova-micro-v1:0",
    TITAN_TEXT_G1_LARGE = "amazon.titan-text-lite-v1",
    TITAN_TEXT_G1_EXPRESS = "amazon.titan-text-express-v1",
    LLAMA_3_2_1B = "meta.llama3-2-1b-instruct-v1:0",
    LLAMA_3_2_3B = "meta.llama3-2-3b-instruct-v1:0",
    LLAMA_3_2_11B = "meta.llama3-2-11b-instruct-v1:0",
    LLAMA_3_2_90B = "meta.llama3-2-90b-instruct-v1:0",
    MISTRAL_7B = "mistral.mistral-7b-instruct-v0:2",
    MISTRAL_8X7B = "mistral.mixtral-8x7b-instruct-v0:1",
    MISTRAL_LARGE = "mistral.mistral-large-2402-v1:0"
}
export declare enum ModelProvider {
    ANTHROPIC = "Anthropic",
    AMAZON = "Amazon",
    META = "Meta",
    MISTRAL = "Mistral AI"
}
export interface ModelInfo {
    id: BedrockModel;
    name: string;
    provider: ModelProvider;
    description: string;
    maxTokens: number;
    costPer1MTokens: {
        input: number;
        output: number;
    };
    capabilities: string[];
}
export interface BedrockParameters {
    model: BedrockModel;
    temperature: number;
    maxTokens: number;
    topP: number;
}
export interface ModelFilter {
    provider?: ModelProvider;
    searchTerm?: string;
    showOnlyRecommended?: boolean;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface BedrockPreset {
    name: string;
    description: string;
    parameters: BedrockParameters;
    useCase: string;
}
export declare const useBedrockParams: any;
export declare const getPresets: () => BedrockPreset[];
export declare const getModelInfo: (model: BedrockModel) => ModelInfo;
export declare const getAllModels: () => ModelInfo[];
export declare const getFilteredModels: (filter: ModelFilter) => ModelInfo[];
export declare const getProviders: () => ModelProvider[];
