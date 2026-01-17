/**
 * Bedrock Converse APIクライアント
 * 
 * AWS推奨の統一されたインターフェースでBedrockモデルを呼び出す
 * OpenAI、DeepSeek、Qwen等の新しいモデルに対応
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';

export interface ConverseOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Converse APIでモデルを呼び出す
 * 
 * @param modelId モデルID（Inference Profile IDも可）
 * @param prompt ユーザープロンプト
 * @param options リクエストオプション
 * @param region AWSリージョン
 * @returns モデルの応答テキスト
 */
export async function invokeWithConverse(
  modelId: string,
  prompt: string,
  options: ConverseOptions = {},
  region: string = 'ap-northeast-1'
): Promise<string> {
  console.log('🔄 Converse API呼び出し:', {
    modelId,
    promptLength: prompt.length,
    region,
    timestamp: new Date().toISOString(),
  });

  const client = new BedrockRuntimeClient({ region });

  const input: ConverseCommandInput = {
    modelId,
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      topP: options.topP || 0.9,
      stopSequences: options.stopSequences,
    },
  };

  try {
    const command = new ConverseCommand(input);
    const response: ConverseCommandOutput = await client.send(command);

    console.log('✅ Converse API応答受信:', {
      stopReason: response.stopReason,
      usage: response.usage,
    });

    // レスポンスからテキストを抽出
    if (response.output?.message?.content) {
      const content = response.output.message.content;
      
      // 最初のテキストコンテンツを返す
      for (const block of content) {
        if ('text' in block && block.text) {
          return block.text;
        }
      }
    }

    throw new Error('Converse APIからテキスト応答を取得できませんでした');
  } catch (error: any) {
    console.error('❌ Converse APIエラー:', {
      name: error.name,
      message: error.message,
      modelId,
    });

    // エラーを再スロー
    throw error;
  }
}

/**
 * Converse APIでストリーミング呼び出し（将来の拡張用）
 * 
 * @param modelId モデルID
 * @param prompt ユーザープロンプト
 * @param options リクエストオプション
 * @param region AWSリージョン
 * @param onChunk チャンクコールバック
 */
export async function invokeWithConverseStream(
  modelId: string,
  prompt: string,
  options: ConverseOptions = {},
  region: string = 'ap-northeast-1',
  onChunk?: (chunk: string) => void
): Promise<string> {
  // TODO: ConverseStreamCommandの実装
  // 現在はフォールバック
  return invokeWithConverse(modelId, prompt, options, region);
}

/**
 * Converse APIがサポートされているか確認
 * 
 * @param modelId モデルID
 * @returns サポートされている場合true
 */
export function supportsConverseAPI(modelId: string): boolean {
  // Converse APIをサポートするモデルのパターン
  const supportedPatterns = [
    /^anthropic\./,
    /^amazon\./,
    /^meta\./,
    /^mistral\./,
    /^cohere\./,
    /^ai21\./,
    /^openai\./,
    /^deepseek\./,
    /^qwen\./,
    /^us\./,  // Inference Profiles
    /^eu\./,  // Inference Profiles
    /^ap\./,  // Inference Profiles
  ];

  return supportedPatterns.some((pattern) => pattern.test(modelId));
}

/**
 * モデルIDがInference Profileを必要とするか確認
 * 
 * @param modelId モデルID
 * @returns Inference Profileが必要な場合true
 */
export function requiresInferenceProfile(modelId: string): boolean {
  // Inference Profileが必要なモデル
  const requiresProfile = [
    'deepseek.r1-v1:0',
    'anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-opus-4-20250514-v1:0',
  ];

  return requiresProfile.includes(modelId);
}

/**
 * DeepSeekモデルのInference Profile IDを解決
 * 
 * @param modelId モデルID
 * @param region AWSリージョン
 * @returns Inference Profile ID
 */
export function resolveDeepSeekProfile(
  modelId: string,
  region: string
): string {
  if (modelId === 'deepseek.r1-v1:0') {
    // リージョンに応じたInference Profile IDを返す
    // DeepSeekは us-east-1, us-west-2, us-east-2 で利用可能
    if (region.startsWith('us-')) {
      return 'us.deepseek.r1-v1:0';
    }
    // デフォルトはUSリージョン
    return 'us.deepseek.r1-v1:0';
  }

  return modelId;
}

/**
 * Claude 4モデルのInference Profile IDを解決
 * 
 * @param modelId モデルID
 * @param region AWSリージョン
 * @returns Inference Profile ID
 */
export function resolveClaude4Profile(
  modelId: string,
  region: string
): string {
  // Claude 4はInference Profile経由でのみ利用可能
  if (
    modelId === 'anthropic.claude-sonnet-4-20250514-v1:0' ||
    modelId === 'anthropic.claude-opus-4-20250514-v1:0'
  ) {
    // リージョンに応じたInference Profile IDを返す
    if (region.startsWith('us-')) {
      return `us.${modelId}`;
    } else if (region.startsWith('eu-')) {
      return `eu.${modelId}`;
    } else if (region.startsWith('ap-')) {
      return `ap.${modelId}`;
    }
    // デフォルトはUSリージョン
    return `us.${modelId}`;
  }

  return modelId;
}

/**
 * Inference Profile IDを自動解決
 * 
 * @param modelId モデルID
 * @param region AWSリージョン
 * @returns 解決されたモデルID（Inference Profile ID）
 */
export function resolveInferenceProfile(
  modelId: string,
  region: string
): string {
  // DeepSeekモデル
  if (modelId.startsWith('deepseek.')) {
    return resolveDeepSeekProfile(modelId, region);
  }

  // Claude 4モデル
  if (
    modelId.includes('claude-sonnet-4') ||
    modelId.includes('claude-opus-4')
  ) {
    return resolveClaude4Profile(modelId, region);
  }

  // その他のモデルはそのまま返す
  return modelId;
}
