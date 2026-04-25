/**
 * Bedrock モデルアダプター
 */

import { DEFAULT_CHAT_MODEL } from '@/config/model-defaults';

export interface ModelAdapter {
  modelId: string;
  formatRequest: (message: string, settings?: any) => any;
  parseResponse: (response: any) => string;
}

export class BedrockModelAdapters {
  private static adapters: Map<string, ModelAdapter> = new Map();

  static registerAdapter(adapter: ModelAdapter) {
    this.adapters.set(adapter.modelId, adapter);
  }

  static getAdapter(modelId: string): ModelAdapter | undefined {
    return this.adapters.get(modelId);
  }

  static getAllAdapters(): ModelAdapter[] {
    return Array.from(this.adapters.values());
  }

  static isSupported(modelId: string): boolean {
    return this.adapters.has(modelId);
  }
}

// デフォルトアダプターの登録
BedrockModelAdapters.registerAdapter({
  modelId: DEFAULT_CHAT_MODEL,
  formatRequest: (message: string, settings = {}) => ({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: settings.maxTokens || 4000,
    temperature: settings.temperature || 0.7,
    top_p: settings.topP || 0.9,
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  }),
  parseResponse: (response: any) => {
    return response.content?.[0]?.text || 'No response';
  },
});

BedrockModelAdapters.registerAdapter({
  modelId: 'amazon.nova-pro-v1:0',
  formatRequest: (message: string, settings = {}) => ({
    messages: [
      {
        role: 'user',
        content: [
          {
            text: message,
          },
        ],
      },
    ],
    inferenceConfig: {
      max_new_tokens: settings.maxTokens || 4000,
      temperature: settings.temperature || 0.7,
      top_p: settings.topP || 0.9,
    },
  }),
  parseResponse: (response: any) => {
    return response.output?.message?.content?.[0]?.text || 'No response';
  },
});

export function getProviderDisplayName(provider: string): string {
  const displayNames: Record<string, string> = {
    'Anthropic': 'Anthropic',
    'Amazon': 'Amazon',
    'Meta': 'Meta',
    'Mistral AI': 'Mistral AI',
    'AI21 Labs': 'AI21 Labs',
    'Cohere': 'Cohere',
    'Stability AI': 'Stability AI',
  };
  return displayNames[provider] || provider;
}