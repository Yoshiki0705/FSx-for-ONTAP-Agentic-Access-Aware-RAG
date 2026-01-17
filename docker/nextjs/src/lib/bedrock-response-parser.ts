/**
 * Bedrockレスポンスパーサー
 * 
 * 各プロバイダーのレスポンス形式からテキストを抽出する
 * 新しいプロバイダーが追加されても、このパーサーに追加するだけで対応可能
 */

import type { BedrockModel } from '@/config/bedrock-models';

/**
 * Anthropic形式のレスポンスからテキストを抽出
 */
export function parseAnthropicResponse(responseBody: any): string {
  return responseBody.content?.[0]?.text || '';
}

/**
 * Amazon形式のレスポンスからテキストを抽出
 */
export function parseAmazonResponse(responseBody: any): string {
  return responseBody.output?.message?.content?.[0]?.text || '';
}

/**
 * OpenAI Chat Completion形式のレスポンスからテキストを抽出
 * OpenAI、DeepSeek、Qwenで使用
 */
export function parseOpenAIChatResponse(responseBody: any): string {
  return responseBody.choices?.[0]?.message?.content || '';
}

/**
 * Meta Llama形式のレスポンスからテキストを抽出
 */
export function parseMetaResponse(responseBody: any): string {
  return responseBody.generation || '';
}

/**
 * Cohere形式のレスポンスからテキストを抽出
 */
export function parseCohereResponse(responseBody: any): string {
  // Cohereは2つの形式をサポート
  return responseBody.generations?.[0]?.text || responseBody.text || '';
}

/**
 * AI21形式のレスポンスからテキストを抽出
 */
export function parseAI21Response(responseBody: any): string {
  return responseBody.completions?.[0]?.data?.text || '';
}

/**
 * Mistral形式のレスポンスからテキストを抽出
 */
export function parseMistralResponse(responseBody: any): string {
  return responseBody.outputs?.[0]?.text || '';
}

/**
 * モデル設定に基づいてレスポンスからテキストを抽出
 * 
 * @param modelConfig モデル設定
 * @param responseBody レスポンスボディ
 * @returns 抽出されたテキスト
 */
export function parseModelResponse(
  modelConfig: BedrockModel | null,
  responseBody: any
): string {
  // モデル設定がない場合はフォールバック
  if (!modelConfig || !modelConfig.responseFormat) {
    console.warn('モデル設定が見つかりません。フォールバックロジックを使用します');
    return (
      responseBody.completion ||
      responseBody.text ||
      responseBody.generation ||
      responseBody.output?.message?.content?.[0]?.text ||
      responseBody.content?.[0]?.text ||
      responseBody.choices?.[0]?.message?.content ||
      JSON.stringify(responseBody)
    );
  }
  
  const format = modelConfig.responseFormat;
  
  try {
    // フィールドパスを解析してテキストを抽出
    switch (format) {
      // Anthropic
      case 'content[0].text':
        return parseAnthropicResponse(responseBody);
      
      // Amazon
      case 'output.message.content[0].text':
        return parseAmazonResponse(responseBody);
      
      // OpenAI Chat Completion（OpenAI、DeepSeek、Qwen）
      case 'choices[0].message.content':
        return parseOpenAIChatResponse(responseBody);
      
      // Meta Llama
      case 'generation':
        return parseMetaResponse(responseBody);
      
      // Cohere
      case 'text':
        return responseBody.text || '';
      case 'generations[0].text':
        return parseCohereResponse(responseBody);
      
      // AI21
      case 'completions[0].data.text':
        return parseAI21Response(responseBody);
      
      // Mistral
      case 'outputs[0].text':
        return parseMistralResponse(responseBody);
      
      default:
        console.warn(`未知のレスポンス形式: ${format}`);
        return responseBody.text || responseBody.generation || JSON.stringify(responseBody);
    }
  } catch (error) {
    console.error('レスポンス解析エラー:', error);
    return JSON.stringify(responseBody);
  }
}

/**
 * プロバイダー別のレスポンスパーサーマップ
 */
export const RESPONSE_PARSERS = {
  anthropic: parseAnthropicResponse,
  amazon: parseAmazonResponse,
  openai: parseOpenAIChatResponse,
  deepseek: parseOpenAIChatResponse,
  qwen: parseOpenAIChatResponse,
  meta: parseMetaResponse,
  cohere: parseCohereResponse,
  ai21: parseAI21Response,
  mistral: parseMistralResponse,
} as const;

/**
 * プロバイダー名からレスポンスパーサーを取得
 */
export function getResponseParser(providerName: string) {
  const normalizedName = providerName.toLowerCase();
  
  if (normalizedName.includes('anthropic')) return RESPONSE_PARSERS.anthropic;
  if (normalizedName.includes('amazon')) return RESPONSE_PARSERS.amazon;
  if (normalizedName.includes('openai')) return RESPONSE_PARSERS.openai;
  if (normalizedName.includes('deepseek')) return RESPONSE_PARSERS.deepseek;
  if (normalizedName.includes('qwen')) return RESPONSE_PARSERS.qwen;
  if (normalizedName.includes('meta')) return RESPONSE_PARSERS.meta;
  if (normalizedName.includes('cohere')) return RESPONSE_PARSERS.cohere;
  if (normalizedName.includes('ai21')) return RESPONSE_PARSERS.ai21;
  if (normalizedName.includes('mistral')) return RESPONSE_PARSERS.mistral;
  
  // フォールバック
  return (responseBody: any) => responseBody.text || JSON.stringify(responseBody);
}
