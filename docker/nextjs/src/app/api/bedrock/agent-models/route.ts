/**
 * Agent Models API
 * 
 * GET /api/bedrock/agent-models
 * 
 * 指定されたリージョンで利用可能なFoundation Modelのリストを取得します。
 * Agent対応モデルのみをフィルタリングして返します。
 */

import { NextRequest, NextResponse } from 'next/server';

// 動的レンダリングを強制（searchParamsを使用するため）
export const dynamic = 'force-dynamic';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { BedrockErrorHandler, ErrorCode, logError } from '@/lib/bedrock/error-handler';
import { logModelListAccess } from '@/lib/bedrock/audit-logger';

// Agent対応モデルのプロバイダーとモデルID接頭辞
const AGENT_SUPPORTED_MODELS = {
  anthropic: ['claude-3', 'claude-2'],
  amazon: ['titan', 'nova'],
};

/**
 * リージョンコードのバリデーション
 */
function isValidRegion(region: string): boolean {
  const validRegions = [
    'us-east-1',
    'us-west-2',
    'ap-northeast-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'eu-west-1',
    'eu-central-1',
    'eu-west-3',
  ];
  
  return validRegions.includes(region);
}

/**
 * モデルがAgent対応かどうかを判定
 */
function isAgentSupportedModel(modelId: string, providerName: string): boolean {
  const provider = providerName.toLowerCase();
  
  if (!AGENT_SUPPORTED_MODELS[provider as keyof typeof AGENT_SUPPORTED_MODELS]) {
    return false;
  }
  
  const supportedPrefixes = AGENT_SUPPORTED_MODELS[provider as keyof typeof AGENT_SUPPORTED_MODELS];
  return supportedPrefixes.some(prefix => modelId.toLowerCase().includes(prefix));
}

/**
 * GET /api/bedrock/agent-models
 * 
 * クエリパラメータ:
 * - region: AWSリージョン（例: ap-northeast-1）
 */
export async function GET(request: NextRequest) {
  try {
    // クエリパラメータの取得
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region') || 'ap-northeast-1';
    
    // リージョンのバリデーション
    if (!isValidRegion(region)) {
      return NextResponse.json(
        BedrockErrorHandler.createErrorResponse({
          code: ErrorCode.INVALID_REQUEST,
          message: `無効なリージョンです: ${region}`,
          statusCode: 400
        }),
        { status: 400 }
      );
    }
    
    // Bedrockクライアントの作成
    const bedrockClient = new BedrockClient({ region });
    
    // Foundation Modelsの取得
    const command = new ListFoundationModelsCommand({
      byOutputModality: 'TEXT', // テキスト出力をサポートするモデルのみ
    });
    
    const response = await bedrockClient.send(command);
    
    // Agent対応モデルのフィルタリング
    const agentModels = (response.modelSummaries || [])
      .filter(model => {
        if (!model.modelId || !model.providerName) {
          return false;
        }
        
        return isAgentSupportedModel(model.modelId, model.providerName);
      })
      .map(model => ({
        modelId: model.modelId,
        modelName: model.modelName,
        provider: model.providerName,
        available: true,
        description: `${model.providerName} ${model.modelName}`,
        inputModalities: model.inputModalities || [],
        outputModalities: model.outputModalities || [],
        responseStreamingSupported: model.responseStreamingSupported || false,
      }))
      .sort((a, b) => {
        // プロバイダー順、次にモデル名順でソート
        if (a.provider !== b.provider) {
          return (a.provider || '').localeCompare(b.provider || '');
        }
        return (a.modelName || '').localeCompare(b.modelName || '');
      });
    
    console.log(`✅ Agent Models API: ${agentModels.length}個のモデルを取得 (リージョン: ${region})`);
    
    // 監査ログの記録
    await logModelListAccess(region, true);
    
    return NextResponse.json({
      success: true,
      region,
      models: agentModels,
      count: agentModels.length,
    });
    
  } catch (error) {
    logError(error, 'Agent Models API');
    
    // 権限エラーの特別処理
    if (error instanceof Error && error.name === 'AccessDeniedException') {
      return NextResponse.json(
        BedrockErrorHandler.createErrorResponse({
          code: ErrorCode.FORBIDDEN,
          message: 'Foundation Modelsの一覧取得に必要な権限がありません。',
          statusCode: 403
        }),
        { status: 403 }
      );
    }
    
    // 統一されたエラーハンドリング
    const bedrockError = BedrockErrorHandler.handleError(error);
    return NextResponse.json(
      BedrockErrorHandler.createErrorResponse(bedrockError),
      { status: bedrockError.statusCode || 500 }
    );
  }
}
