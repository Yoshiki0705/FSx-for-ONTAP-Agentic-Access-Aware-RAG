/**
 * Bedrock InvokeModel APIクライアント
 * 
 * Converse API非対応のレガシーモデル用
 * AI21 Labs, Mistral, Amazon Titan, Cohereモデルに対応
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

export interface InvokeModelOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * プロバイダー検出
 */
function detectProvider(modelId: string): string {
  if (modelId.startsWith('ai21.')) return 'ai21';
  if (modelId.startsWith('mistral.')) return 'mistral';
  if (modelId.startsWith('amazon.titan-text')) return 'titan';
  if (modelId.startsWith('cohere.')) return 'cohere';
  return 'unknown';
}

/**
 * AI21 Labs用リクエストボディ作成
 */
function createAI21Request(modelId: string, prompt: string, options: InvokeModelOptions) {
  // Jamba 1.5モデル用（messages形式）
  if (modelId.includes('jamba-1-5') || modelId.includes('jamba-instruct')) {
    return {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
      stop: options.stopSequences || [],
    };
  }
  
  // Jurassic-2モデル用（prompt形式）
  return {
    prompt,
    maxTokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7,
    topP: options.topP || 0.9,
    stopSequences: options.stopSequences || [],
  };
}

/**
 * Mistral用リクエストボディ作成
 */
function createMistralRequest(prompt: string, options: InvokeModelOptions) {
  // Mistral形式のプロンプト
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
  
  return {
    prompt: formattedPrompt,
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7,
    top_p: options.topP || 0.9,
    stop: options.stopSequences || [],
  };
}

/**
 * Amazon Titan用リクエストボディ作成
 */
function createTitanRequest(prompt: string, options: InvokeModelOptions) {
  return {
    inputText: prompt,
    textGenerationConfig: {
      maxTokenCount: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      topP: options.topP || 0.9,
      stopSequences: options.stopSequences || [],
    },
  };
}

/**
 * Cohere用リクエストボディ作成
 */
function createCohereRequest(prompt: string, options: InvokeModelOptions) {
  // Command R/R+モデル用（message形式）
  return {
    message: prompt,
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7,
    p: options.topP || 0.9,
    stop_sequences: options.stopSequences || [],
  };
}

/**
 * プロバイダー別リクエストボディ作成
 */
function createRequestBody(
  modelId: string,
  prompt: string,
  options: InvokeModelOptions
): object {
  const provider = detectProvider(modelId);
  
  console.log('🔧 InvokeModel リクエスト作成:', {
    provider,
    modelId,
    promptLength: prompt.length,
  });
  
  switch (provider) {
    case 'ai21':
      return createAI21Request(modelId, prompt, options);
    case 'mistral':
      return createMistralRequest(prompt, options);
    case 'titan':
      return createTitanRequest(prompt, options);
    case 'cohere':
      return createCohereRequest(modelId, prompt, options);
    default:
      throw new Error(`未対応のプロバイダー: ${provider}`);
  }
}

/**
 * AI21 Labsレスポンスパース
 */
function parseAI21Response(response: any): string {
  // Jamba 1.5モデル
  if (response.choices && Array.isArray(response.choices)) {
    return response.choices[0]?.message?.content || '';
  }
  
  // Jurassic-2モデル
  if (response.completions && Array.isArray(response.completions)) {
    return response.completions[0]?.data?.text || '';
  }
  
  throw new Error('AI21レスポンスのパースに失敗');
}

/**
 * Mistralレスポンスパース
 */
function parseMistralResponse(response: any): string {
  if (response.outputs && Array.isArray(response.outputs)) {
    return response.outputs[0]?.text || '';
  }
  
  throw new Error('Mistralレスポンスのパースに失敗');
}

/**
 * Amazon Titanレスポンスパース
 */
function parseTitanResponse(response: any): string {
  if (response.results && Array.isArray(response.results)) {
    return response.results[0]?.outputText || '';
  }
  
  throw new Error('Titanレスポンスのパースに失敗');
}

/**
 * Cohereレスポンスパース
 */
function parseCohereResponse(response: any): string {
  // Command R/R+モデル
  if (response.text) {
    return response.text;
  }
  
  // Command Lightモデル
  if (response.generations && Array.isArray(response.generations)) {
    return response.generations[0]?.text || '';
  }
  
  throw new Error('Cohereレスポンスのパースに失敗');
}

/**
 * プロバイダー別レスポンスパース
 */
function parseResponse(modelId: string, responseBody: any): string {
  const provider = detectProvider(modelId);
  
  console.log('🔍 InvokeModel レスポンスパース:', {
    provider,
    modelId,
    responseKeys: Object.keys(responseBody),
  });
  
  try {
    switch (provider) {
      case 'ai21':
        return parseAI21Response(responseBody);
      case 'mistral':
        return parseMistralResponse(responseBody);
      case 'titan':
        return parseTitanResponse(responseBody);
      case 'cohere':
        return parseCohereResponse(responseBody);
      default:
        throw new Error(`未対応のプロバイダー: ${provider}`);
    }
  } catch (error) {
    console.error('❌ レスポンスパースエラー:', error);
    console.error('レスポンス内容:', JSON.stringify(responseBody, null, 2));
    throw error;
  }
}

/**
 * InvokeModel APIでモデルを呼び出す
 * 
 * @param modelId モデルID
 * @param prompt ユーザープロンプト
 * @param options リクエストオプション
 * @param region AWSリージョン
 * @returns モデルの応答テキスト
 */
export async function invokeWithInvokeModel(
  modelId: string,
  prompt: string,
  options: InvokeModelOptions = {},
  region: string = 'us-east-1'
): Promise<string> {
  console.log('🔄 InvokeModel API呼び出し:', {
    modelId,
    promptLength: prompt.length,
    region,
    timestamp: new Date().toISOString(),
  });

  const client = new BedrockRuntimeClient({ region });

  // リクエストボディ作成
  const requestBody = createRequestBody(modelId, prompt, options);
  
  const input: InvokeModelCommandInput = {
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  };

  try {
    const command = new InvokeModelCommand(input);
    const response = await client.send(command);

    // レスポンスボディをパース
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // プロバイダー別にレスポンスをパース
    const answer = parseResponse(modelId, responseBody);

    console.log('✅ InvokeModel API成功:', {
      modelId,
      answerLength: answer.length,
      timestamp: new Date().toISOString(),
    });

    return answer;
  } catch (error: any) {
    console.error('❌ InvokeModel APIエラー:', {
      modelId,
      error: error.message,
      errorName: error.name,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * モデルがInvokeModel APIを必要とするか判定
 */
export function requiresInvokeModel(modelId: string): boolean {
  const provider = detectProvider(modelId);
  return ['ai21', 'mistral', 'titan', 'cohere'].includes(provider);
}
