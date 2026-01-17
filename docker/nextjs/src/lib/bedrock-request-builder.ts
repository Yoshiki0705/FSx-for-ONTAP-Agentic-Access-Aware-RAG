/**
 * Bedrockリクエストビルダー
 * 
 * 各プロバイダーのAPI形式に対応したリクエストペイロードを構築する
 * 新しいプロバイダーが追加されても、このビルダーに追加するだけで対応可能
 */

import type { BedrockModel } from '@/config/bedrock-models';

export interface RequestOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

/**
 * Anthropic Messages API形式のリクエストを構築
 */
export function buildAnthropicRequest(
  prompt: string,
  options: RequestOptions,
  parameterMapping: Record<string, string>
): any {
  const maxTokensKey = parameterMapping.maxTokens || 'max_tokens';
  const temperatureKey = parameterMapping.temperature || 'temperature';
  const topPKey = parameterMapping.topP || 'top_p';
  
  const payload: any = {
    anthropic_version: 'bedrock-2023-05-31',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };
  
  payload[maxTokensKey] = options.maxTokens || 2000;
  payload[temperatureKey] = options.temperature || 0.7;
  payload[topPKey] = options.topP || 0.9;
  
  return payload;
}

/**
 * Amazon InferenceConfig形式のリクエストを構築
 */
export function buildAmazonRequest(
  prompt: string,
  options: RequestOptions
): any {
  return {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      max_new_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      topP: options.topP || 0.9,
    },
  };
}


/**
 * OpenAI Chat Completion形式のリクエストを構築
 * OpenAI、DeepSeek、Qwenで使用
 * 
 * 注意: AWS BedrockのOpenAI Chat Completions APIでは、
 * contentは文字列形式を使用する必要があります
 */
export function buildOpenAIChatRequest(
  prompt: string,
  options: RequestOptions,
  parameterMapping: Record<string, string>
): any {
  const maxTokensKey = parameterMapping.maxTokens || 'max_tokens';
  const temperatureKey = parameterMapping.temperature || 'temperature';
  const topPKey = parameterMapping.topP || 'top_p';
  
  const payload: any = {
    messages: [
      {
        role: 'user',
        content: prompt,  // 文字列形式（AWS Bedrock OpenAI Chat Completions API仕様）
      },
    ],
  };
  
  payload[maxTokensKey] = options.maxTokens || 2000;
  payload[temperatureKey] = options.temperature || 0.7;
  payload[topPKey] = options.topP || 0.9;
  
  return payload;
}

/**
 * 従来のPrompt-based形式のリクエストを構築
 * Meta Llama、Cohere、AI21、Mistral等で使用
 */
export function buildPromptBasedRequest(
  prompt: string,
  options: RequestOptions,
  parameterMapping: Record<string, string>
): any {
  const maxTokensKey = parameterMapping.maxTokens || 'max_tokens';
  const temperatureKey = parameterMapping.temperature || 'temperature';
  const topPKey = parameterMapping.topP || 'top_p';
  const topKKey = parameterMapping.topK;
  
  const payload: any = {
    prompt: prompt,
  };
  
  payload[maxTokensKey] = options.maxTokens || 2000;
  payload[temperatureKey] = options.temperature || 0.7;
  payload[topPKey] = options.topP || 0.9;
  
  if (topKKey && options.topK !== undefined) {
    payload[topKKey] = options.topK;
  }
  
  return payload;
}

/**
 * モデル設定に基づいてリクエストペイロードを構築
 * 
 * @param modelConfig モデル設定
 * @param prompt ユーザープロンプト
 * @param options リクエストオプション
 * @returns リクエストペイロード
 */
export function buildModelRequest(
  modelConfig: BedrockModel | null,
  prompt: string,
  options: RequestOptions = {}
): any {
  // モデル設定がない場合はフォールバック
  if (!modelConfig) {
    console.warn('モデル設定が見つかりません。デフォルトペイロードを使用します');
    return {
      prompt: prompt,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
    };
  }
  
  const requestFormat = modelConfig.requestFormat || 'prompt-based';
  const parameterMapping = modelConfig.parameterMapping || {};
  
  // Anthropic Messages API形式
  if (requestFormat === 'anthropic') {
    return buildAnthropicRequest(prompt, options, parameterMapping);
  }
  
  // Amazon InferenceConfig形式
  if (requestFormat === 'amazon') {
    return buildAmazonRequest(prompt, options);
  }
  
  // Prompt-based形式の判定
  // OpenAI Chat Completion形式（OpenAI、DeepSeek、Qwen）
  if (modelConfig.responseFormat === 'choices[0].message.content') {
    return buildOpenAIChatRequest(prompt, options, parameterMapping);
  }
  
  // 従来のPrompt-based形式（Meta, Cohere, AI21, Mistral等）
  return buildPromptBasedRequest(prompt, options, parameterMapping);
}

/**
 * プロバイダー別のリクエストビルダーマップ
 * 将来的な拡張のため
 */
export const REQUEST_BUILDERS = {
  anthropic: buildAnthropicRequest,
  amazon: buildAmazonRequest,
  openai: buildOpenAIChatRequest,
  deepseek: buildOpenAIChatRequest,
  qwen: buildOpenAIChatRequest,
  promptBased: buildPromptBasedRequest,
} as const;

/**
 * プロバイダー名からリクエストビルダーを取得
 */
export function getRequestBuilder(providerName: string) {
  const normalizedName = providerName.toLowerCase();
  
  if (normalizedName.includes('anthropic')) return REQUEST_BUILDERS.anthropic;
  if (normalizedName.includes('amazon')) return REQUEST_BUILDERS.amazon;
  if (normalizedName.includes('openai')) return REQUEST_BUILDERS.openai;
  if (normalizedName.includes('deepseek')) return REQUEST_BUILDERS.deepseek;
  if (normalizedName.includes('qwen')) return REQUEST_BUILDERS.qwen;
  
  return REQUEST_BUILDERS.promptBased;
}
