/**
 * Amazon Bedrock パラメータ管理ストア
 * 
 * 機能:
 * - モデル選択とパラメータ管理
 * - バリデーション機能
 * - プリセット設定
 * - エクスポート・インポート
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export enum BedrockModel {
  // Claude 3 シリーズ
  CLAUDE_3_SONNET = 'anthropic.claude-3-sonnet-20240229-v1:0',
  CLAUDE_3_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0',
  CLAUDE_3_OPUS = 'anthropic.claude-3-opus-20240229-v1:0',
  CLAUDE_3_5_SONNET = 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  CLAUDE_3_5_HAIKU = 'anthropic.claude-3-5-haiku-20241022-v1:0',
  
  // Amazon Nova シリーズ
  NOVA_PRO = 'amazon.nova-pro-v1:0',
  NOVA_LITE = 'amazon.nova-lite-v1:0',
  NOVA_MICRO = 'amazon.nova-micro-v1:0',
  
  // Amazon Titan シリーズ
  TITAN_TEXT_G1_LARGE = 'amazon.titan-text-lite-v1',
  TITAN_TEXT_G1_EXPRESS = 'amazon.titan-text-express-v1',
  
  // Meta Llama シリーズ
  LLAMA_3_2_1B = 'meta.llama3-2-1b-instruct-v1:0',
  LLAMA_3_2_3B = 'meta.llama3-2-3b-instruct-v1:0',
  LLAMA_3_2_11B = 'meta.llama3-2-11b-instruct-v1:0',
  LLAMA_3_2_90B = 'meta.llama3-2-90b-instruct-v1:0',
  
  // Mistral AI シリーズ
  MISTRAL_7B = 'mistral.mistral-7b-instruct-v0:2',
  MISTRAL_8X7B = 'mistral.mixtral-8x7b-instruct-v0:1',
  MISTRAL_LARGE = 'mistral.mistral-large-2402-v1:0',
}

export enum ModelProvider {
  ANTHROPIC = 'Anthropic',
  AMAZON = 'Amazon',
  META = 'Meta',
  MISTRAL = 'Mistral AI',
}

export interface ModelInfo {
  id: BedrockModel;
  name: string;
  provider: ModelProvider;
  description: string;
  maxTokens: number;
  costPer1MTokens: { input: number; output: number };
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

interface BedrockParamsState {
  parameters: BedrockParameters;
  isLoading: boolean;
  lastValidation: ValidationResult | null;
  modelFilter: ModelFilter;
  
  setModel: (model: BedrockModel) => void;
  setTemperature: (temperature: number) => void;
  setMaxTokens: (maxTokens: number) => void;
  setTopP: (topP: number) => void;
  setParameters: (parameters: Partial<BedrockParameters>) => void;
  setModelFilter: (filter: ModelFilter) => void;
  applyPreset: (presetName: string) => void;
  validateParameters: () => ValidationResult;
  resetToDefaults: () => void;
  exportParameters: () => string;
  importParameters: (jsonString: string) => boolean;
}

const DEFAULT_PARAMETERS: BedrockParameters = {
  model: BedrockModel.NOVA_PRO,
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
};

const MODEL_INFO: Record<BedrockModel, ModelInfo> = {
  // Claude 3 シリーズ
  [BedrockModel.CLAUDE_3_SONNET]: {
    id: BedrockModel.CLAUDE_3_SONNET,
    name: 'Claude 3 Sonnet',
    provider: ModelProvider.ANTHROPIC,
    description: 'バランスの取れた高性能モデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 3, output: 15 },
    capabilities: ['テキスト生成', '質問応答', '文書要約', 'コード生成'],
  },
  [BedrockModel.CLAUDE_3_HAIKU]: {
    id: BedrockModel.CLAUDE_3_HAIKU,
    name: 'Claude 3 Haiku',
    provider: ModelProvider.ANTHROPIC,
    description: '高速で効率的なモデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 0.25, output: 1.25 },
    capabilities: ['高速応答', 'チャット', '簡単な質問応答'],
  },
  [BedrockModel.CLAUDE_3_OPUS]: {
    id: BedrockModel.CLAUDE_3_OPUS,
    name: 'Claude 3 Opus',
    provider: ModelProvider.ANTHROPIC,
    description: '最高性能の大規模モデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 15, output: 75 },
    capabilities: ['複雑な推論', '高度な分析', '創作支援'],
  },
  [BedrockModel.CLAUDE_3_5_SONNET]: {
    id: BedrockModel.CLAUDE_3_5_SONNET,
    name: 'Claude 3.5 Sonnet',
    provider: ModelProvider.ANTHROPIC,
    description: '最新の改良されたSonnetモデル',
    maxTokens: 8192,
    costPer1MTokens: { input: 3, output: 15 },
    capabilities: ['テキスト生成', '質問応答', '文書要約', 'コード生成', '画像理解'],
  },
  [BedrockModel.CLAUDE_3_5_HAIKU]: {
    id: BedrockModel.CLAUDE_3_5_HAIKU,
    name: 'Claude 3.5 Haiku',
    provider: ModelProvider.ANTHROPIC,
    description: '最新の高速モデル',
    maxTokens: 8192,
    costPer1MTokens: { input: 1, output: 5 },
    capabilities: ['高速応答', 'チャット', '質問応答'],
  },
  
  // Amazon Nova シリーズ
  [BedrockModel.NOVA_PRO]: {
    id: BedrockModel.NOVA_PRO,
    name: 'Amazon Nova Pro',
    provider: ModelProvider.AMAZON,
    description: 'Amazonの高性能マルチモーダルモデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 0.8, output: 3.2 },
    capabilities: ['テキスト生成', '画像理解', '動画理解', 'マルチモーダル'],
  },
  [BedrockModel.NOVA_LITE]: {
    id: BedrockModel.NOVA_LITE,
    name: 'Amazon Nova Lite',
    provider: ModelProvider.AMAZON,
    description: '軽量で高速なマルチモーダルモデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 0.06, output: 0.24 },
    capabilities: ['テキスト生成', '画像理解', '高速処理'],
  },
  [BedrockModel.NOVA_MICRO]: {
    id: BedrockModel.NOVA_MICRO,
    name: 'Amazon Nova Micro',
    provider: ModelProvider.AMAZON,
    description: '超軽量で低コストなテキストモデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 0.035, output: 0.14 },
    capabilities: ['テキスト生成', '簡単な質問応答', '低コスト'],
  },
  
  // Amazon Titan シリーズ
  [BedrockModel.TITAN_TEXT_G1_LARGE]: {
    id: BedrockModel.TITAN_TEXT_G1_LARGE,
    name: 'Titan Text G1 - Large',
    provider: ModelProvider.AMAZON,
    description: 'Amazonの大規模テキストモデル',
    maxTokens: 4096,
    costPer1MTokens: { input: 0.5, output: 0.65 },
    capabilities: ['テキスト生成', '要約', '質問応答'],
  },
  [BedrockModel.TITAN_TEXT_G1_EXPRESS]: {
    id: BedrockModel.TITAN_TEXT_G1_EXPRESS,
    name: 'Titan Text G1 - Express',
    provider: ModelProvider.AMAZON,
    description: 'Amazonの高速テキストモデル',
    maxTokens: 8192,
    costPer1MTokens: { input: 0.2, output: 0.6 },
    capabilities: ['高速テキスト生成', 'チャット', '要約'],
  },
  
  // Meta Llama シリーズ
  [BedrockModel.LLAMA_3_2_1B]: {
    id: BedrockModel.LLAMA_3_2_1B,
    name: 'Llama 3.2 1B Instruct',
    provider: ModelProvider.META,
    description: '軽量なLlamaモデル',
    maxTokens: 2048,
    costPer1MTokens: { input: 0.1, output: 0.1 },
    capabilities: ['テキスト生成', '指示実行'],
  },
  [BedrockModel.LLAMA_3_2_3B]: {
    id: BedrockModel.LLAMA_3_2_3B,
    name: 'Llama 3.2 3B Instruct',
    provider: ModelProvider.META,
    description: '中規模のLlamaモデル',
    maxTokens: 2048,
    costPer1MTokens: { input: 0.15, output: 0.15 },
    capabilities: ['テキスト生成', '指示実行', '質問応答'],
  },
  [BedrockModel.LLAMA_3_2_11B]: {
    id: BedrockModel.LLAMA_3_2_11B,
    name: 'Llama 3.2 11B Instruct',
    provider: ModelProvider.META,
    description: '高性能なLlamaモデル',
    maxTokens: 2048,
    costPer1MTokens: { input: 0.35, output: 0.4 },
    capabilities: ['テキスト生成', '複雑な指示実行', '推論'],
  },
  [BedrockModel.LLAMA_3_2_90B]: {
    id: BedrockModel.LLAMA_3_2_90B,
    name: 'Llama 3.2 90B Instruct',
    provider: ModelProvider.META,
    description: '最大規模のLlamaモデル',
    maxTokens: 2048,
    costPer1MTokens: { input: 2, output: 2 },
    capabilities: ['高度な推論', '複雑なタスク', '創作支援'],
  },
  
  // Mistral AI シリーズ
  [BedrockModel.MISTRAL_7B]: {
    id: BedrockModel.MISTRAL_7B,
    name: 'Mistral 7B Instruct',
    provider: ModelProvider.MISTRAL,
    description: '効率的なMistralモデル',
    maxTokens: 8192,
    costPer1MTokens: { input: 0.15, output: 0.2 },
    capabilities: ['テキスト生成', '指示実行', 'コード生成'],
  },
  [BedrockModel.MISTRAL_8X7B]: {
    id: BedrockModel.MISTRAL_8X7B,
    name: 'Mixtral 8x7B Instruct',
    provider: ModelProvider.MISTRAL,
    description: 'MoE（Mixture of Experts）アーキテクチャ',
    maxTokens: 32768,
    costPer1MTokens: { input: 0.45, output: 0.7 },
    capabilities: ['高性能テキスト生成', '多言語対応', 'コード生成'],
  },
  [BedrockModel.MISTRAL_LARGE]: {
    id: BedrockModel.MISTRAL_LARGE,
    name: 'Mistral Large',
    provider: ModelProvider.MISTRAL,
    description: 'Mistralの最大規模モデル',
    maxTokens: 32768,
    costPer1MTokens: { input: 4, output: 12 },
    capabilities: ['高度な推論', '複雑なタスク', '多言語対応'],
  },
};

const PRESETS: BedrockPreset[] = [
  {
    name: 'バランス型',
    description: '汎用的な用途に適したバランスの取れた設定',
    useCase: 'チャットボット・質問応答・文書要約',
    parameters: {
      model: BedrockModel.NOVA_PRO,
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
    },
  },
  {
    name: '高精度型',
    description: '正確性を重視した保守的な設定',
    useCase: '技術文書生成・コード生成・データ分析',
    parameters: {
      model: BedrockModel.NOVA_PRO,
      temperature: 0.3,
      maxTokens: 1024,
      topP: 0.8,
    },
  },
  {
    name: '創造性重視型',
    description: '創造的な出力を促進する設定',
    useCase: 'ブレインストーミング・アイデア生成・創作支援',
    parameters: {
      model: BedrockModel.NOVA_PRO,
      temperature: 0.9,
      maxTokens: 4096,
      topP: 0.95,
    },
  },
];

const validateParameters = (parameters: BedrockParameters): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (parameters.temperature < 0 || parameters.temperature > 1) {
    result.errors.push('Temperature は 0 から 1 の範囲で設定してください');
    result.isValid = false;
  }

  if (parameters.maxTokens < 1 || parameters.maxTokens > 4096) {
    result.errors.push('MaxTokens は 1 から 4096 の範囲で設定してください');
    result.isValid = false;
  }

  if (parameters.topP < 0 || parameters.topP > 1) {
    result.errors.push('TopP は 0 から 1 の範囲で設定してください');
    result.isValid = false;
  }

  if (parameters.temperature > 0.8 && parameters.topP > 0.9) {
    result.warnings.push('高い Temperature と TopP の組み合わせは予測不可能な出力を生成する可能性があります');
  }

  return result;
};

export const useBedrockParams = create<BedrockParamsState>()(
  devtools(
    (set, get) => ({
      parameters: DEFAULT_PARAMETERS,
      isLoading: false,
      lastValidation: null,
      modelFilter: {},

      setModel: (model: BedrockModel) => {
        set((state) => {
          const newParameters = { ...state.parameters, model };
          const validation = validateParameters(newParameters);
          return { parameters: newParameters, lastValidation: validation };
        });
      },

      setTemperature: (temperature: number) => {
        set((state) => {
          const newParameters = { ...state.parameters, temperature };
          const validation = validateParameters(newParameters);
          return { parameters: newParameters, lastValidation: validation };
        });
      },

      setMaxTokens: (maxTokens: number) => {
        set((state) => {
          const newParameters = { ...state.parameters, maxTokens };
          const validation = validateParameters(newParameters);
          return { parameters: newParameters, lastValidation: validation };
        });
      },

      setTopP: (topP: number) => {
        set((state) => {
          const newParameters = { ...state.parameters, topP };
          const validation = validateParameters(newParameters);
          return { parameters: newParameters, lastValidation: validation };
        });
      },

      setParameters: (partialParameters: Partial<BedrockParameters>) => {
        set((state) => {
          const newParameters = { ...state.parameters, ...partialParameters };
          const validation = validateParameters(newParameters);
          return { parameters: newParameters, lastValidation: validation };
        });
      },

      setModelFilter: (filter: ModelFilter) => {
        set({ modelFilter: filter });
      },

      applyPreset: (presetName: string) => {
        const preset = PRESETS.find(p => p.name === presetName);
        if (preset) {
          set({
            parameters: preset.parameters,
            lastValidation: validateParameters(preset.parameters),
          });
        }
      },

      validateParameters: () => {
        const { parameters } = get();
        const validation = validateParameters(parameters);
        set({ lastValidation: validation });
        return validation;
      },

      resetToDefaults: () => {
        set({
          parameters: DEFAULT_PARAMETERS,
          lastValidation: validateParameters(DEFAULT_PARAMETERS),
        });
      },

      exportParameters: () => {
        const { parameters } = get();
        return JSON.stringify(parameters, null, 2);
      },

      importParameters: (jsonString: string) => {
        try {
          const importedParameters = JSON.parse(jsonString) as BedrockParameters;
          const validation = validateParameters(importedParameters);
          
          if (validation.isValid) {
            set({ parameters: importedParameters, lastValidation: validation });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    { name: 'bedrock-params-store' }
  )
);

export const getPresets = () => PRESETS;

export const getModelInfo = (model: BedrockModel): ModelInfo => MODEL_INFO[model];

export const getAllModels = (): ModelInfo[] => Object.values(MODEL_INFO);

export const getFilteredModels = (filter: ModelFilter): ModelInfo[] => {
  let models = getAllModels();
  
  if (filter.provider) {
    models = models.filter(model => model.provider === filter.provider);
  }
  
  if (filter.searchTerm) {
    const searchLower = filter.searchTerm.toLowerCase();
    models = models.filter(model => 
      model.name.toLowerCase().includes(searchLower) ||
      model.description.toLowerCase().includes(searchLower) ||
      model.capabilities.some(cap => cap.toLowerCase().includes(searchLower))
    );
  }
  
  if (filter.showOnlyRecommended) {
    // 推奨モデル（Amazon Nova系を優先）
    const recommendedModels = [
      BedrockModel.NOVA_PRO,
      BedrockModel.NOVA_LITE,
      BedrockModel.NOVA_MICRO,
      BedrockModel.CLAUDE_3_5_SONNET,
      BedrockModel.CLAUDE_3_SONNET,
    ];
    models = models.filter(model => recommendedModels.includes(model.id));
  }
  
  return models;
};

export const getProviders = (): ModelProvider[] => Object.values(ModelProvider);