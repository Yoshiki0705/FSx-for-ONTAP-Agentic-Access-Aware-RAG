/**
 * Update Agent Model API (修正版)
 * 
 * POST /api/bedrock/update-agent-model
 * 
 * Bedrock AgentのFoundation Modelを動的に更新します。
 * 同時更新を防止するためのロック機構を実装しています。
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  BedrockAgentClient, 
  UpdateAgentCommand, 
  PrepareAgentCommand,
  GetAgentCommand 
} from '@aws-sdk/client-bedrock-agent';

// 同時更新防止用のロックマップ
const updateLocks = new Map<string, boolean>();

// ロックのタイムアウト（30秒）
const LOCK_TIMEOUT = 30000;

/**
 * モデルIDのバリデーション
 */
function isValidModelId(modelId: string): boolean {
  // モデルIDの形式: provider.model-name-version:qualifier
  const modelIdPattern = /^(anthropic|amazon|ai21|cohere|meta|mistral)\.[a-z0-9-]+:[0-9]+$/;
  return modelIdPattern.test(modelId);
}

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
 * リージョンコードを環境変数キーに変換
 */
function regionToEnvKey(region: string): string {
  return region.toUpperCase().replace(/-/g, '_');
}

/**
 * 指定されたリージョンのAgent IDを取得
 */
function getAgentIdForRegion(region: string): string | undefined {
  const envKey = regionToEnvKey(region);
  return process.env[`BEDROCK_AGENT_ID_${envKey}`] || process.env.BEDROCK_AGENT_ID;
}

/**
 * 安全なJSONレスポンスの作成
 */
function createSafeJsonResponse(data: any, status: number = 200): NextResponse {
  try {
    // データの安全性チェック
    const safeData = JSON.parse(JSON.stringify(data));
    return NextResponse.json(safeData, { status });
  } catch (error) {
    console.error('JSON serialization error:', error);
    return NextResponse.json({
      success: false,
      error: 'レスポンスの生成に失敗しました',
      errorCode: 'JSON_SERIALIZATION_ERROR',
      retryable: true
    }, { status: 500 });
  }
}

/**
 * POST /api/bedrock/update-agent-model
 * 
 * リクエストボディ:
 * - modelId: 新しいFoundation Model ID
 * - region: AWSリージョン
 * - agentId: Agent ID（オプション、環境変数から取得）
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let lockKey: string | null = null;
  
  try {
    // リクエストボディの取得（エラーハンドリング付き）
    let body: any;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return createSafeJsonResponse({
        success: false,
        error: 'リクエストの形式が正しくありません',
        errorCode: 'INVALID_JSON',
        retryable: false,
        details: {
          hint: 'JSONフォーマットを確認してください',
          originalError: jsonError instanceof Error ? jsonError.message : String(jsonError)
        }
      }, 400);
    }
    
    const { modelId, region, agentId: requestedAgentId } = body;
    
    console.log(`🔄 [Update Agent Model] リクエスト:`, { modelId, region, requestedAgentId });
    
    // 必須パラメータのバリデーション
    if (!modelId || !region) {
      return createSafeJsonResponse({
        success: false,
        error: 'modelIdとregionを指定してください',
        errorCode: 'MISSING_PARAMETER',
        retryable: false,
        details: {
          required: ['modelId', 'region'],
          provided: { modelId: !!modelId, region: !!region }
        }
      }, 400);
    }
    
    // Agent IDの決定
    const agentId = requestedAgentId || getAgentIdForRegion(region);
    
    if (!agentId || agentId === 'PLACEHOLDER_AGENT_ID') {
      console.warn(`⚠️ [Update Agent Model] Agent ID未設定: region=${region}`);
      
      return createSafeJsonResponse({
        success: false,
        error: 'Agent情報が設定されていません',
        errorCode: 'AGENT_NOT_CONFIGURED',
        retryable: false,
        details: {
          message: `リージョン ${region} でBedrock Agentが設定されていません`,
          hint: 'このリージョンではAgent機能は利用できません',
          region: region,
          configRequired: `BEDROCK_AGENT_ID_${regionToEnvKey(region)}`,
          fallback: 'Knowledge Base モードをご利用ください'
        }
      }, 503);
    }
    
    // モデルIDのバリデーション
    if (!isValidModelId(modelId)) {
      return createSafeJsonResponse({
        success: false,
        error: `無効なモデルIDです: ${modelId}`,
        errorCode: 'INVALID_MODEL_ID',
        retryable: false,
        details: {
          hint: 'モデルIDの形式: provider.model-name-version:qualifier',
          example: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
        }
      }, 400);
    }
    
    // リージョンのバリデーション
    if (!isValidRegion(region)) {
      return createSafeJsonResponse({
        success: false,
        error: `無効なリージョンです: ${region}`,
        errorCode: 'INVALID_REGION',
        retryable: false
      }, 400);
    }
    
    // 同時更新防止ロックの取得
    lockKey = `${region}-${agentId}`;
    
    if (updateLocks.has(lockKey)) {
      return createSafeJsonResponse({
        success: false,
        error: 'Agentは現在更新中です。しばらく待ってから再試行してください。',
        errorCode: 'AGENT_UPDATING',
        retryable: true,
        details: {
          retryAfter: 5,
          hint: '5秒後に再試行してください'
        }
      }, 409);
    }
    
    // ロックを設定
    updateLocks.set(lockKey, true);
    
    // タイムアウト後にロックを自動解除
    setTimeout(() => {
      updateLocks.delete(lockKey!);
    }, LOCK_TIMEOUT);
    
    try {
      // Bedrock Agentクライアントの作成
      const bedrockAgentClient = new BedrockAgentClient({ region });
      
      // 現在のAgent設定を取得
      console.log(`🔄 [Update Agent Model] Agent情報取得: ${agentId}`);
      const getAgentCommand = new GetAgentCommand({ agentId });
      const currentAgent = await bedrockAgentClient.send(getAgentCommand);
      
      if (!currentAgent.agent) {
        return createSafeJsonResponse({
          success: false,
          error: `Agent ID "${agentId}" が見つかりません`,
          errorCode: 'AGENT_NOT_FOUND',
          retryable: false,
          details: {
            hint: 'Agent IDが正しいか確認してください',
            agentId,
            region
          }
        }, 404);
      }
      
      const oldModel = currentAgent.agent.foundationModel || '';
      
      // 同じモデルの場合は早期リターン
      if (oldModel === modelId) {
        console.log(`ℹ️ [Update Agent Model] 同じモデルが指定されました: ${modelId}`);
        
        return createSafeJsonResponse({
          success: true,
          message: 'モデルは既に選択されています',
          data: {
            agentId: currentAgent.agent.agentId,
            previousModel: oldModel,
            newModel: modelId,
            changed: false,
            agentStatus: currentAgent.agent.agentStatus,
            updatedAt: currentAgent.agent.updatedAt
          }
        });
      }
      
      console.log(`🔄 [Update Agent Model] モデル更新開始: ${agentId}`);
      console.log(`   旧モデル: ${oldModel}`);
      console.log(`   新モデル: ${modelId}`);
      
      // Agentの更新
      const updateCommand = new UpdateAgentCommand({
        agentId,
        agentName: currentAgent.agent.agentName,
        foundationModel: modelId,
        instruction: currentAgent.agent.instruction,
        agentResourceRoleArn: currentAgent.agent.agentResourceRoleArn,
        idleSessionTTLInSeconds: currentAgent.agent.idleSessionTTLInSeconds,
      });
      
      const updateResponse = await bedrockAgentClient.send(updateCommand);
      
      // Agent Prepareの実行
      console.log('🔄 [Update Agent Model] Agent Prepare実行中...');
      const prepareCommand = new PrepareAgentCommand({ agentId });
      await bedrockAgentClient.send(prepareCommand);
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ [Update Agent Model] モデル更新完了 (${duration}ms)`);
      
      return createSafeJsonResponse({
        success: true,
        message: `モデルを ${modelId} に変更しました`,
        data: {
          agentId: updateResponse.agent?.agentId,
          previousModel: oldModel,
          newModel: updateResponse.agent?.foundationModel,
          changed: true,
          agentStatus: updateResponse.agent?.agentStatus,
          updatedAt: updateResponse.agent?.updatedAt
        }
      });
      
    } catch (awsError: any) {
      console.error(`❌ [Update Agent Model] AWS API エラー:`, awsError);
      
      // 権限エラー
      if (awsError.name === 'AccessDeniedException') {
        return createSafeJsonResponse({
          success: false,
          error: 'アクセスが拒否されました。必要な権限を確認してください。',
          errorCode: 'ACCESS_DENIED',
          retryable: false,
          details: {
            message: 'Agent更新に必要な権限がありません',
            hint: 'IAMロールに以下の権限を追加してください',
            requiredPermissions: [
              'bedrock:UpdateAgent',
              'bedrock:PrepareAgent',
              'bedrock:GetAgent'
            ],
            agentId,
            region
          }
        }, 403);
      }
      
      // Not Foundエラー
      if (awsError.name === 'ResourceNotFoundException') {
        return createSafeJsonResponse({
          success: false,
          error: `Agent ID "${agentId}" が見つかりません`,
          errorCode: 'AGENT_NOT_FOUND',
          retryable: false,
          details: {
            hint: 'Agent IDが正しいか確認してください',
            agentId,
            region
          }
        }, 404);
      }
      
      // 競合エラー
      if (awsError.name === 'ConflictException') {
        return createSafeJsonResponse({
          success: false,
          error: 'Agentは現在別の操作中です。しばらく待ってから再試行してください。',
          errorCode: 'AGENT_BUSY',
          retryable: true,
          details: {
            retryAfter: 10,
            hint: '10秒後に再試行してください'
          }
        }, 409);
      }
      
      // その他のAWSエラー
      const errorMessage = awsError.message || 'Unknown AWS error';
      return createSafeJsonResponse({
        success: false,
        error: `モデルの更新に失敗しました: ${errorMessage}`,
        errorCode: 'AWS_ERROR',
        retryable: true,
        details: {
          hint: 'しばらく待ってから再試行してください',
          originalError: awsError.name || 'UnknownError',
          agentId,
          region
        }
      }, 500);
    }
    
  } catch (error) {
    console.error(`❌ [Update Agent Model] 予期しないエラー:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createSafeJsonResponse({
      success: false,
      error: `モデルの更新に失敗しました: ${errorMessage}`,
      errorCode: 'INTERNAL_ERROR',
      retryable: true,
      details: {
        hint: 'しばらく待ってから再試行してください',
        originalError: error instanceof Error ? error.toString() : String(error)
      }
    }, 500);
    
  } finally {
    // ロックの解放
    if (lockKey) {
      updateLocks.delete(lockKey);
    }
  }
}
