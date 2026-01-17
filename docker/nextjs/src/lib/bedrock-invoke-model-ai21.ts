/**
 * Bedrock InvokeModel API - AI21 Labs専用クライアント
 * 
 * 段階的実装: Phase 1
 * AI21 Labsモデルのみサポート
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
}

/**
 * AI21 Labsモデルか判定
 */
export function isAI21Model(modelId: string): boolean {
  return modelId.startsWith('ai21.');
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
    };
  }
  
  // Jurassic-2モデル用（prompt形式）
  return {
    prompt,
    maxTokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7,
    topP: options.topP || 0.9,
  };
}

/**
 * AI21 Labsレスポンスパース
 */
function parseAI21Response(response: any): string {
  // Jamba 1.5モデル
  if (response.choices && Array.isArray(response.choices)) {
    const content = response.choices[0]?.message?.content;
    if (content) return content;
  }
  
  // Jurassic-2モデル
  if (response.completions && Array.isArray(response.completions)) {
    const text = response.completions[0]?.data?.text;
    if (text) return text;
  }
  
  throw new Error('AI21レスポンスのパースに失敗しました');
}

/**
 * AI21 LabsモデルをInvokeModel APIで呼び出す
 * 
 * @param modelId AI21 LabsモデルID
 * @param prompt ユーザープロンプト
 * @param options リクエストオプション
 * @param region AWSリージョン
 * @returns モデルの応答テキスト
 */
export async function invokeAI21Model(
  modelId: string,
  prompt: string,
  options: InvokeModelOptions = {},
  region: string = 'us-east-1'
): Promise<string> {
  // AI21モデルでない場合はエラー
  if (!isAI21Model(modelId)) {
    throw new Error(`AI21モデルではありません: ${modelId}`);
  }

  console.log('🔄 AI21 InvokeModel API呼び出し:', {
    modelId,
    promptLength: prompt.length,
    region,
  });

  const client = new BedrockRuntimeClient({ region });

  // リクエストボディ作成
  const requestBody = createAI21Request(modelId, prompt, options);
  
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
    
    // レスポンスをパース
    const answer = parseAI21Response(responseBody);

    console.log('✅ AI21 InvokeModel API成功:', {
      modelId,
      answerLength: answer.length,
    });

    return answer;
  } catch (error: any) {
    console.error('❌ AI21 InvokeModel APIエラー:', {
      modelId,
      error: error.message,
      errorName: error.name,
    });
    throw error;
  }
}
