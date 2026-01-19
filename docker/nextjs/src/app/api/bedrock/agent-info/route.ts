/**
 * Agent Info API (修正版)
 * 
 * GET /api/bedrock/agent-info
 * 
 * Bedrock Agentの情報を取得します。
 * Agent ID、Alias、バージョン、ステータス、Foundation Modelなどの情報を返します。
 */

import { NextRequest, NextResponse } from 'next/server';

// 動的レンダリングを強制（searchParamsを使用するため）
export const dynamic = 'force-dynamic';
import { 
  BedrockAgentClient, 
  GetAgentCommand,
  ListAgentAliasesCommand,
  GetAgentAliasCommand
} from '@aws-sdk/client-bedrock-agent';

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
 * GET /api/bedrock/agent-info
 * 
 * クエリパラメータ:
 * - region: AWSリージョン（オプション、デフォルト: ap-northeast-1）
 * - agentId: Agent ID（オプション、環境変数から取得）
 */
export async function GET(request: NextRequest) {
  try {
    // クエリパラメータの取得
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region') || process.env.AWS_REGION || 'ap-northeast-1';
    const requestedAgentId = searchParams.get('agentId');
    
    // Agent IDの決定（リクエスト > リージョン固有 > デフォルト）
    const agentId = requestedAgentId || getAgentIdForRegion(region);
    
    console.log(`🔍 [Agent Info API] リクエスト: region=${region}, agentId=${agentId}`);
    
    // Agent IDの確認
    if (!agentId || agentId === 'PLACEHOLDER_AGENT_ID') {
      console.warn(`⚠️ [Agent Info API] Agent ID未設定: region=${region}`);
      
      return NextResponse.json({
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
      }, { status: 503 });
    }
    
    // リージョンのバリデーション（警告のみ）
    if (!isValidRegion(region)) {
      console.warn(`⚠️ [Agent Info API] 非標準リージョン: ${region}`);
    }
    
    try {
      // Bedrock Agentクライアントの作成
      const bedrockAgentClient = new BedrockAgentClient({ region });
      
      // Agent情報の取得
      console.log(`🔄 [Agent Info API] Agent情報取得中: ${agentId}`);
      const getAgentCommand = new GetAgentCommand({ agentId });
      const agentResponse = await bedrockAgentClient.send(getAgentCommand);
      
      if (!agentResponse.agent) {
        console.error(`❌ [Agent Info API] Agent not found: ${agentId}`);
        return NextResponse.json({
          success: false,
          error: `Agent ID "${agentId}" が見つかりません`,
          errorCode: 'AGENT_NOT_FOUND',
          retryable: false,
          details: {
            hint: 'Agent IDが正しいか確認してください',
            agentId,
            region
          }
        }, { status: 404 });
      }
      
      // Agent Alias一覧の取得（エラーハンドリング付き）
      let aliasInfo = null;
      try {
        console.log(`🔄 [Agent Info API] Alias情報取得中: ${agentId}`);
        const listAliasesCommand = new ListAgentAliasesCommand({ agentId });
        const aliasesResponse = await bedrockAgentClient.send(listAliasesCommand);
        
        // 最初のAliasの詳細情報を取得
        if (aliasesResponse.agentAliasSummaries && aliasesResponse.agentAliasSummaries.length > 0) {
          const firstAlias = aliasesResponse.agentAliasSummaries[0];
          
          if (firstAlias.agentAliasId) {
            const getAliasCommand = new GetAgentAliasCommand({
              agentId,
              agentAliasId: firstAlias.agentAliasId,
            });
            
            const aliasResponse = await bedrockAgentClient.send(getAliasCommand);
            
            if (aliasResponse.agentAlias) {
              aliasInfo = {
                aliasId: aliasResponse.agentAlias.agentAliasId,
                aliasName: aliasResponse.agentAlias.agentAliasName,
                description: aliasResponse.agentAlias.description,
                routingConfiguration: aliasResponse.agentAlias.routingConfiguration,
                createdAt: aliasResponse.agentAlias.createdAt,
                updatedAt: aliasResponse.agentAlias.updatedAt,
              };
            }
          }
        }
      } catch (aliasError) {
        console.warn(`⚠️ [Agent Info API] Alias情報取得失敗 (続行): ${aliasError}`);
        // Alias情報の取得に失敗してもAgent情報は返す
      }
      
      // レスポンスの構築
      const agentInfo = {
        agentId: agentResponse.agent.agentId,
        agentName: agentResponse.agent.agentName,
        description: agentResponse.agent.description || null,  // ✅ description フィールドを追加
        aliasId: aliasInfo?.aliasId || null,
        aliasName: aliasInfo?.aliasName || null,
        version: aliasInfo?.routingConfiguration?.[0]?.agentVersion || 'DRAFT',
        status: agentResponse.agent.agentStatus,
        foundationModel: agentResponse.agent.foundationModel,
        region,
        lastUpdated: agentResponse.agent.updatedAt,
        createdAt: agentResponse.agent.createdAt,
        preparedAt: agentResponse.agent.preparedAt,
      };
      
      console.log(`✅ [Agent Info API] Agent情報取得成功: ${agentId} (${region})`);
      
      return NextResponse.json({
        success: true,
        data: agentInfo,
      });
      
    } catch (awsError: any) {
      console.error(`❌ [Agent Info API] AWS API エラー:`, awsError);
      
      // 権限エラーの特別処理
      if (awsError.name === 'AccessDeniedException') {
        return NextResponse.json({
          success: false,
          error: 'アクセスが拒否されました。必要な権限を確認してください。',
          errorCode: 'ACCESS_DENIED',
          retryable: false,
          details: {
            message: 'Agent情報の取得に必要な権限がありません',
            hint: 'IAMロールに以下の権限を追加してください',
            requiredPermissions: [
              'bedrock:GetAgent',
              'bedrock:ListAgentAliases',
              'bedrock:GetAgentAlias'
            ],
            agentId,
            region,
            fallback: 'Knowledge Base モードをご利用ください'
          }
        }, { status: 403 });
      }
      
      // Not Foundエラーの特別処理
      if (awsError.name === 'ResourceNotFoundException') {
        return NextResponse.json({
          success: false,
          error: `Agent ID "${agentId}" が見つかりません`,
          errorCode: 'AGENT_NOT_FOUND',
          retryable: false,
          details: {
            hint: 'Agent IDが正しいか確認してください',
            agentId,
            region
          }
        }, { status: 404 });
      }
      
      // その他のAWSエラー
      const errorMessage = awsError.message || 'Unknown AWS error';
      return NextResponse.json({
        success: false,
        error: `Agent情報の取得に失敗しました: ${errorMessage}`,
        errorCode: 'AWS_ERROR',
        retryable: true,
        details: {
          hint: 'しばらく待ってから再試行してください',
          originalError: awsError.name || 'UnknownError',
          agentId,
          region
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error(`❌ [Agent Info API] 予期しないエラー:`, error);
    
    // JSON parsing エラーの処理
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json({
        success: false,
        error: 'リクエストの形式が正しくありません',
        errorCode: 'INVALID_JSON',
        retryable: false,
        details: {
          hint: 'リクエストパラメータを確認してください',
          originalError: error.message
        }
      }, { status: 400 });
    }
    
    // その他のエラー
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: `Agent情報の取得に失敗しました: ${errorMessage}`,
      errorCode: 'INTERNAL_ERROR',
      retryable: true,
      details: {
        hint: 'しばらく待ってから再試行してください',
        originalError: error instanceof Error ? error.toString() : String(error)
      }
    }, { status: 500 });
  }
}
