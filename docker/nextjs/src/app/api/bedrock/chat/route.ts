import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { BedrockModel } from '@/config/bedrock-models';
import { getModelConfig as getModelConfigFromManager } from '@/config/model-config-manager';
import { stripInferenceProfilePrefix } from '@/config/model-pattern-detector';
import { BedrockErrorAnalyzer } from '@/lib/bedrock-error-analyzer';
import { resolveInferenceProfile } from '@/lib/inference-profile-resolver';
import {
  invokeWithConverse,
  supportsConverseAPI,
  resolveInferenceProfile as resolveConverseProfile,
} from '@/lib/bedrock-converse-client';
import {
  invokeAI21Model,
  isAI21Model,
} from '@/lib/bedrock-invoke-model-ai21';
import {
  selectOptimalRegion,
  getRegionSelectionInfo,
} from '@/config/region-model-availability';

/**
 * モデルIDからプロバイダー名を推測
 * 
 * 動的検出のためのヘルパー関数
 */
function extractProviderFromModelId(modelId: string): string {
  // 推論プロファイルプレフィックスを除去
  const cleanId = stripInferenceProfilePrefix(modelId);
  
  // プレフィックスからプロバイダーを推測
  if (cleanId.startsWith('anthropic.')) return 'Anthropic';
  if (cleanId.startsWith('amazon.')) return 'Amazon';
  if (cleanId.startsWith('meta.')) return 'Meta';
  if (cleanId.startsWith('cohere.')) return 'Cohere';
  if (cleanId.startsWith('ai21.')) return 'AI21 Labs';
  if (cleanId.startsWith('mistral.')) return 'Mistral AI';
  if (cleanId.startsWith('openai.')) return 'OpenAI';
  if (cleanId.startsWith('deepseek.')) return 'DeepSeek';
  if (cleanId.startsWith('stability.')) return 'Stability AI';
  
  return 'Unknown';
}

// 後方互換性のため残す（非推奨）
const MODEL_CONFIGS: Record<string, BedrockModel> = {
  // Amazon Nova models (APAC推論プロファイル - 推奨)
  'apac.amazon.nova-pro-v1:0': {
    id: 'apac.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro (APAC)',
    description: 'Amazon Nova Pro (APAC Cross-Region)',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 4000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  'apac.amazon.nova-lite-v1:0': {
    id: 'apac.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite (APAC)',
    description: 'Amazon Nova Lite (APAC Cross-Region)',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  'apac.amazon.nova-micro-v1:0': {
    id: 'apac.amazon.nova-micro-v1:0',
    name: 'Amazon Nova Micro (APAC)',
    description: 'Amazon Nova Micro (APAC Cross-Region)',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  // Amazon Nova models (直接モデルID - 非推奨、inference profile使用を推奨)
  'amazon.nova-pro-v1:0': {
    id: 'amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    description: 'Amazon Nova Pro',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 4000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  'us.amazon.nova-pro-v1:0': {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro (US)',
    description: 'Amazon Nova Pro (US Cross-Region)',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 4000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  'amazon.nova-lite-v1:0': {
    id: 'amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    description: 'Amazon Nova Lite',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  'us.amazon.nova-lite-v1:0': {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite (US)',
    description: 'Amazon Nova Lite (US Cross-Region)',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text'
  },
  // Anthropic Claude models (推論プロファイル使用)
  'apac.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    id: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 3.5 Sonnet v2',
    description: 'Claude 3.5 Sonnet v2 (APAC推論プロファイル)',
    provider: 'anthropic',
    category: 'chat',
    maxTokens: 4000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'anthropic',
    responseFormat: 'content[0].text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    }
  },
  // OpenAI GPT models (via Bedrock)
  'openai.gpt-oss-120b-1:0': {
    id: 'openai.gpt-oss-120b-1:0',
    name: 'GPT OSS 120B',
    description: 'OpenAI GPT OSS 120B',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    }
  },
  // Meta Llama models
  'meta.llama3-3-70b-instruct-v1:0': {
    id: 'meta.llama3-3-70b-instruct-v1:0',
    name: 'Llama 3.3 70B',
    description: 'Meta Llama 3.3 70B',
    provider: 'meta',
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: 'amazon',  // messages形式を使用
    responseFormat: 'output.message.content[0].text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    }
  }
};

// 型定義
interface PermissionResult {
  allowed: boolean;
  userPermissions?: {
    permissionLevel: string;
  };
  message?: string;
}

interface LogContext {
  userId: string;
  ipAddress: string;
  timestamp: string;
  action: string;
}

// 設定
const LAMBDA_FUNCTION_NAME = process.env.PERMISSION_FILTER_FUNCTION_NAME || 
  'TokyoRegion-permission-aware-rag-prod-PermissionFilter';

const lambdaClient = new LambdaClient({ 
  region: process.env.AWS_REGION || 'ap-northeast-1',
  maxAttempts: 3
});

// bedrockClientはリクエストごとに作成（リージョンがCookieで変わる可能性があるため）
function createBedrockClient(region?: string): BedrockRuntimeClient {
  const targetRegion = region || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
  return new BedrockRuntimeClient({ region: targetRegion });
}

// ユーティリティ関数
function getClientIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return realIp || forwardedFor?.split(',')[0] || '127.0.0.1';
}

/**
 * モデル設定を取得（動的検出対応）
 */
function getModelConfig(modelId: string, modelName?: string, providerName?: string): BedrockModel | null {
  try {
    console.log('🔍 モデル検索:', {
      searchId: modelId,
      modelName,
      providerName,
      totalModels: Object.keys(MODEL_CONFIGS).length
    });
    
    // 静的設定から検索
    const staticModel = MODEL_CONFIGS[modelId];
    if (staticModel) {
      console.log('✅ 静的モデル設定を取得:', {
        id: staticModel.id,
        name: staticModel.name,
        requestFormat: staticModel.requestFormat
      });
      return staticModel;
    }
    
    // 動的検出: model-config-managerを使用
    if (modelName && providerName) {
      const dynamicModel = getModelConfigFromManager(modelId, modelName, providerName);
      if (dynamicModel) {
        console.log('✅ 動的モデル設定を取得:', {
          id: dynamicModel.id,
          name: dynamicModel.name,
          requestFormat: dynamicModel.requestFormat
        });
        return dynamicModel;
      }
    }
    
    console.warn('⚠️ モデル設定が見つかりません。デフォルト設定を使用:', modelId);
    
    // フォールバック: プロバイダーに基づいてデフォルト設定を生成
    const cleanId = stripInferenceProfilePrefix(modelId);
    let requestFormat: 'anthropic' | 'amazon' | 'prompt-based' = 'prompt-based';
    let responseFormat = 'text';
    
    if (cleanId.startsWith('anthropic.')) {
      requestFormat = 'anthropic';
      responseFormat = 'content[0].text';
    } else if (cleanId.startsWith('amazon.') || cleanId.startsWith('openai.')) {
      requestFormat = 'amazon';
      responseFormat = 'output.message.content[0].text';
    }
    
    return {
      id: modelId,
      name: modelName || modelId,
      description: `${providerName || 'Unknown'} model`,
      provider: (providerName || 'unknown').toLowerCase() as BedrockModel['provider'],
      category: 'chat',
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.9,
      requestFormat,
      responseFormat: responseFormat as BedrockModel['responseFormat'],
      parameterMapping: {
        maxTokens: 'max_tokens',
        temperature: 'temperature',
        topP: 'top_p'
      }
    };
    
  } catch (error) {
    console.error('❌ モデル設定取得エラー:', error);
    return null;
  }
}

/**
 * モデル固有のペイロードを構築
 */
function buildModelPayload(
  modelConfig: BedrockModel | null,
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}
): any {
  const maxTokens = options.maxTokens || 2000;
  const temperature = options.temperature || 0.7;
  const topP = options.topP || 0.9;
  
  // モデル設定がない場合はフォールバック
  if (!modelConfig) {
    console.warn('モデル設定が見つかりません。デフォルトペイロードを使用します');
    return {
      prompt: prompt,
      max_tokens: maxTokens,
      temperature: temperature,
    };
  }
  
  const requestFormat = modelConfig.requestFormat || 'prompt-based';
  
  // Anthropic Messages API形式
  if (requestFormat === 'anthropic') {
    const mapping = modelConfig.parameterMapping || {};
    const maxTokensKey = mapping.maxTokens || 'max_tokens';
    const temperatureKey = mapping.temperature || 'temperature';
    const topPKey = mapping.topP || 'top_p';
    
    const payload: any = {
      anthropic_version: 'bedrock-2023-05-31',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };
    
    payload[maxTokensKey] = maxTokens;
    payload[temperatureKey] = temperature;
    payload[topPKey] = topP;
    
    return payload;
  }
  
  // Amazon InferenceConfig形式
  if (requestFormat === 'amazon') {
    return {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        max_new_tokens: maxTokens,
        temperature: temperature,
        topP: topP,
      },
    };
  }
  
  // Prompt-based形式の判定
  // OpenAI Chat Completion形式（OpenAI、DeepSeek、Qwen）
  // responseFormatが'choices[0].message.content'の場合はOpenAI形式
  if (modelConfig.responseFormat === 'choices[0].message.content') {
    const payload: any = {
      messages: [
        {
          role: 'user',
          content: prompt,  // 文字列形式
        },
      ],
    };
    
    // パラメータマッピングを使用
    const mapping = modelConfig.parameterMapping || {};
    
    // maxTokensパラメータ
    const maxTokensKey = mapping.maxTokens || 'max_tokens';
    payload[maxTokensKey] = maxTokens;
    
    // temperatureパラメータ
    const temperatureKey = mapping.temperature || 'temperature';
    payload[temperatureKey] = temperature;
    
    // topPパラメータ
    const topPKey = mapping.topP || 'top_p';
    payload[topPKey] = topP;
    
    return payload;
  }
  
  // 従来のPrompt-based形式（Meta, Cohere, AI21, Mistral等）
  const payload: any = {
    prompt: prompt,
  };
  
  // パラメータマッピングを使用
  const mapping = modelConfig.parameterMapping || {};
  
  // maxTokensパラメータ
  const maxTokensKey = mapping.maxTokens || 'max_tokens';
  payload[maxTokensKey] = maxTokens;
  
  // temperatureパラメータ
  const temperatureKey = mapping.temperature || 'temperature';
  payload[temperatureKey] = temperature;
  
  // topPパラメータ
  const topPKey = mapping.topP || 'top_p';
  payload[topPKey] = topP;
  
  return payload;
}

function validateInput(message: string, userId: string): void {
  if (!message || typeof message !== 'string' || message.length > 10000) {
    throw new Error('無効なメッセージ形式です');
  }
  
  if (!userId || typeof userId !== 'string' || !/^[a-zA-Z0-9_.@+-]+$/.test(userId)) {
    throw new Error('無効なユーザーID形式です');
  }
}

function createLogContext(userId: string, ipAddress: string): LogContext {
  return {
    userId,
    ipAddress,
    timestamp: new Date().toISOString(),
    action: 'bedrock-chat'
  };
}

async function checkPermissions(userId: string): Promise<PermissionResult> {
  // 環境変数でPermission Filter機能を無効化できるようにする
  const permissionCheckEnabled = process.env.ENABLE_PERMISSION_CHECK !== 'false';
  
  if (!permissionCheckEnabled) {
    console.log('⚠️ 権限チェックが無効化されています（開発モード）');
    return {
      allowed: true,
      message: '権限チェック無効（開発モード）',
      userPermissions: {
        permissionLevel: '基本'
      }
    };
  }
  
  try {
    const command = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({
        userId: userId,
        action: 'bedrock-chat'
      })
    });

    const response = await lambdaClient.send(command);
    if (!response.Payload) {
      throw new Error('権限チェック関数からの応答が空です');
    }

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    
    if (result.statusCode) {
      const body = JSON.parse(result.body);
      return {
        allowed: result.statusCode === 200 && body.allowed,
        userPermissions: body.userPermissions,
        message: body.message || body.error
      };
    }
    
    return result;
  } catch (error: any) {
    console.error('権限チェックエラー:', error);
    
    // Lambda関数が存在しない、または権限がない場合は、開発モードとして許可
    if (error.name === 'ResourceNotFoundException' || error.name === 'AccessDeniedException') {
      console.warn(`⚠️ 権限チェックLambda関数エラー (${error.name})。開発モードとして許可します。`);
      return {
        allowed: true,
        message: `権限チェック関数未設定（開発モード: ${error.name}）`,
        userPermissions: {
          permissionLevel: '基本'
        }
      };
    }
    
    return {
      allowed: false,
      message: '権限チェック処理中にエラーが発生しました'
    };
  }
}

/**
 * モデルレスポンスからテキストを抽出
 */
function parseModelResponse(
  modelConfig: BedrockModel | null,
  responseBody: any
): string {
  // モデル設定がない場合はフォールバック
  if (!modelConfig || !modelConfig.responseFormat) {
    console.warn('モデル設定が見つかりません。フォールバックロジックを使用します');
    return responseBody.completion || 
           responseBody.text || 
           responseBody.generation ||
           responseBody.output?.message?.content?.[0]?.text ||
           responseBody.content?.[0]?.text ||
           JSON.stringify(responseBody);
  }
  
  const format = modelConfig.responseFormat;
  
  try {
    // フィールドパスを解析してテキストを抽出
    if (format === 'content[0].text') {
      return responseBody.content?.[0]?.text || '';
    }
    
    if (format === 'output.message.content[0].text') {
      return responseBody.output?.message?.content?.[0]?.text || '';
    }
    
    if (format === 'generation') {
      return responseBody.generation || '';
    }
    
    if (format === 'text') {
      return responseBody.text || '';
    }
    
    if (format === 'generations[0].text') {
      return responseBody.generations?.[0]?.text || responseBody.text || '';
    }
    
    if (format === 'completions[0].data.text') {
      return responseBody.completions?.[0]?.data?.text || '';
    }
    
    if (format === 'outputs[0].text') {
      return responseBody.outputs?.[0]?.text || '';
    }
    
    // OpenAI Chat Completion形式（OpenAI、DeepSeek、Qwen）
    if (format === 'choices[0].message.content') {
      return responseBody.choices?.[0]?.message?.content || '';
    }
    
    // フォールバック
    console.warn(`未知のレスポンス形式: ${format}`);
    return responseBody.text || responseBody.generation || JSON.stringify(responseBody);
    
  } catch (error) {
    console.error('レスポンス解析エラー:', error);
    return JSON.stringify(responseBody);
  }
}

async function invokeBedrockModel(
  modelId: string,
  prompt: string,
  region?: string
): Promise<string> {
  try {
    console.log('🤖 Bedrock呼び出し:', { 
      modelId, 
      promptLength: prompt.length, 
      region,
      timestamp: new Date().toISOString()
    });

    // モデル情報を取得（動的検出のため）
    const modelName = modelId; // 簡略化
    const providerName = extractProviderFromModelId(modelId);
    
    console.log('🔍 プロバイダー検出:', {
      modelId,
      detectedProvider: providerName
    });
    
    // モデル設定を取得（動的検出）
    const modelConfig = getModelConfig(modelId, modelName, providerName);
    console.log('📋 モデル設定:', {
      id: modelConfig?.id,
      provider: modelConfig?.provider,
      requestFormat: modelConfig?.requestFormat,
      responseFormat: modelConfig?.responseFormat,
      parameterMapping: modelConfig?.parameterMapping
    });

    // AI21 Labsモデルの場合はInvokeModel APIを使用
    if (isAI21Model(modelId)) {
      console.log('🔄 AI21 InvokeModel API使用:', { modelId, region });
      
      // 最適なリージョンを選択
      const regionInfo = getRegionSelectionInfo(modelId, region);
      const optimalRegion = regionInfo.selectedRegion;
      
      console.log('📍 リージョン選択:', {
        requested: regionInfo.requestedRegion,
        selected: optimalRegion,
        reason: regionInfo.reason,
        provider: regionInfo.providerName
      });
      
      try {
        const text = await invokeAI21Model(
          modelId,
          prompt,
          {
            maxTokens: 2000,
            temperature: 0.7,
            topP: 0.9
          },
          optimalRegion
        );
        
        console.log('✅ AI21 InvokeModel API成功:', {
          modelId,
          region: optimalRegion,
          answerLength: text.length
        });
        
        return text;
      } catch (error: any) {
        console.error('❌ AI21 InvokeModel APIエラー:', {
          modelId,
          region: optimalRegion,
          error: error.message
        });
        throw error;
      }
    }
    
    // Converse API対応モデルの場合はConverse APIを使用
    const shouldUseConverse = supportsConverseAPI(modelId);
    
    if (shouldUseConverse) {
      console.log('🔄 Converse API使用:', { modelId, region });
      
      // 最適なリージョンを選択
      const regionInfo = getRegionSelectionInfo(modelId, region);
      const optimalRegion = regionInfo.selectedRegion;
      
      if (!regionInfo.isAvailableInRequested) {
        console.log('📍 リージョン自動切り替え:', {
          requested: regionInfo.requestedRegion,
          selected: optimalRegion,
          reason: regionInfo.reason
        });
      }
      
      // Inference Profile解決
      const resolvedModelId = resolveConverseProfile(modelId, optimalRegion);
      console.log('🎯 モデルID解決:', {
        original: modelId,
        resolved: resolvedModelId,
        region: optimalRegion
      });
      
      try {
        const text = await invokeWithConverse(
          resolvedModelId,
          prompt,
          {
            maxTokens: 2000,
            temperature: 0.7,
            topP: 0.9
          },
          optimalRegion
        );
        
        console.log('✅ Converse API成功:', {
          modelId: resolvedModelId,
          textLength: text.length,
          textPreview: text.substring(0, 100)
        });
        
        return text;
      } catch (converseError: any) {
        console.error('❌ Converse APIエラー:', {
          modelId: resolvedModelId,
          error: converseError.message
        });
        
        // Converse APIが失敗した場合、InvokeModelにフォールバック
        console.log('⚠️ InvokeModelにフォールバック');
      }
    }
    
    // InvokeModel API使用（従来の方法）
    console.log('📤 InvokeModel API使用:', { modelId, region });
    
    // ペイロード構築
    const payload = buildModelPayload(modelConfig, prompt, {
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.9
    });
    
    console.log('📤 送信ペイロード:', {
      modelId,
      payloadKeys: Object.keys(payload),
      payloadPreview: JSON.stringify(payload).substring(0, 200)
    });

    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    // リージョン指定でBedrockClientを作成
    const client = createBedrockClient(region);
    console.log('🌍 Bedrockクライアント作成:', { region });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    console.log('✅ Bedrock応答受信:', { 
      modelId, 
      responseLength: JSON.stringify(responseBody).length,
      responseKeys: Object.keys(responseBody),
      responsePreview: JSON.stringify(responseBody).substring(0, 200)
    });

    // レスポンス解析
    const text = parseModelResponse(modelConfig, responseBody);
    
    if (!text) {
      console.error('❌ テキスト抽出失敗:', {
        modelId,
        responseFormat: modelConfig?.responseFormat,
        responseBody: JSON.stringify(responseBody).substring(0, 500)
      });
      throw new Error('モデルレスポンスからテキストを抽出できませんでした');
    }
    
    console.log('✅ テキスト抽出成功:', {
      modelId,
      textLength: text.length,
      textPreview: text.substring(0, 100)
    });
    
    return text;
    
  } catch (error) {
    console.error('❌ Bedrock呼び出しエラー:', {
      modelId,
      region,
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error
    });
    
    // エラー詳細をログ出力
    if (error instanceof Error) {
      // モデル固有のエラーメッセージを生成
      let userFriendlyMessage = 'AIモデルの呼び出し中にエラーが発生しました';
      
      // パラメータエラー
      if (error.message.includes('extraneous key') || error.message.includes('not permitted')) {
        userFriendlyMessage = 'モデルパラメータが正しくありません。モデル設定を確認してください';
        console.error('💡 ヒント: リクエストペイロードの形式が正しくない可能性があります');
      }
      // 必須フィールドエラー
      else if (error.message.includes('missing required field')) {
        userFriendlyMessage = '必須パラメータが不足しています。モデル設定を確認してください';
        console.error('💡 ヒント: 必須フィールドが欠けている可能性があります');
      }
      // スロットリングエラー
      else if (error.message.includes('ThrottlingException') || error.message.includes('TooManyRequestsException')) {
        userFriendlyMessage = 'リクエストが多すぎます。しばらく待ってから再試行してください';
      }
      // 認証エラー
      else if (error.message.includes('UnauthorizedException') || error.message.includes('AccessDeniedException')) {
        userFriendlyMessage = 'モデルへのアクセス権限がありません。管理者に連絡してください';
        console.error('💡 ヒント: モデルへのアクセスが許可されていない可能性があります');
      }
      // モデル未対応エラー
      else if (error.message.includes('ValidationException') || error.message.includes('ModelNotReadyException')) {
        userFriendlyMessage = '選択されたモデルは現在利用できません。別のモデルを選択してください';
        console.error('💡 ヒント: モデルIDが正しくないか、リージョンで利用できない可能性があります');
      }
      // リージョンエラー
      else if (error.message.includes('ResourceNotFoundException')) {
        userFriendlyMessage = `選択されたモデルは${region}リージョンで利用できません。別のリージョンまたはモデルを選択してください`;
        console.error('💡 ヒント: モデルがこのリージョンで利用できない可能性があります');
      }
      
      // ユーザーフレンドリーなエラーを投げる
      const enhancedError = new Error(userFriendlyMessage);
      (enhancedError as any).originalError = error;
      (enhancedError as any).modelId = modelId;
      (enhancedError as any).region = region;
      throw enhancedError;
    }
    
    throw error;
  }
}

export async function POST(request: NextRequest) {
  // リクエストボディを一度だけ読み込む
  const { message, userId, modelId } = await request.json();
  const clientIP = getClientIpAddress(request);
  
  // Cookieからリージョンを取得
  const regionCookie = request.cookies.get('bedrock_region');
  const bedrockRegion = regionCookie?.value || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
  
  // 選択されたモデルID（デフォルトはAmazon Nova Pro）
  const requestedModelId = modelId || 'amazon.nova-pro-v1:0';
  
  // リージョンに基づいて最適なinference profileを解決
  const selectedModelId = resolveInferenceProfile(requestedModelId, bedrockRegion);
  
  console.log('🎯 モデルID解決:', {
    requested: requestedModelId,
    resolved: selectedModelId,
    region: bedrockRegion
  });
  
  try {
    const logContext = createLogContext(userId, clientIP);
    
    console.log('🔐 Bedrock API called', logContext);
    console.log('Request:', { message: message?.substring(0, 50), userId, modelId: selectedModelId, region: bedrockRegion });

    // 入力値検証
    try {
      validateInput(message, userId);
    } catch (validationError) {
      console.log('❌ 入力値検証エラー:', validationError.message);
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 400 }
      );
    }

    console.log('🔍 権限チェック実行中...', { userId, ipAddress: clientIP });

    const permissionResult = await checkPermissions(userId);
    console.log('📊 権限チェック結果:', permissionResult);

    if (!permissionResult.allowed) {
      console.log('❌ アクセス拒否:', permissionResult.message);
      return NextResponse.json({
        success: false,
        error: 'アクセス拒否',
        reason: permissionResult.message,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    console.log('✅ 権限チェック通過');

    // 実際のBedrock APIを呼び出し
    console.log('🎯 選択されたモデル:', {
      modelId: selectedModelId,
      region: bedrockRegion
    });
    
    const prompt = `あなたは親切で知識豊富なAIアシスタントです。以下の質問に日本語で回答してください。

質問: ${message}

回答:`;

    const answer = await invokeBedrockModel(selectedModelId, prompt, bedrockRegion);

    return NextResponse.json({
      success: true,
      answer: answer,
      userId: userId,
      modelId: selectedModelId,
      timestamp: new Date().toISOString(),
      securityInfo: {
        permissionCheckPassed: true,
        ipAddress: clientIP,
        permissionLevel: permissionResult.userPermissions?.permissionLevel || '基本'
      }
    });

  } catch (error: any) {
    console.error('❌ Chat API Error:', error);
    
    // エラーメッセージを分析（モデルアクセス検証を含む）
    const errorAnalysis = await BedrockErrorAnalyzer.analyzeBedrockError(
      error,
      selectedModelId,
      bedrockRegion,
      userId
    );
    
    return NextResponse.json({
      success: false,
      error: errorAnalysis.message,
      errorType: errorAnalysis.type,
      actions: errorAnalysis.availableActions,
      originalError: errorAnalysis.originalError
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}