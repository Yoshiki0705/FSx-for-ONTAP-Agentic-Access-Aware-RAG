/**
 * Agents List API
 * 
 * GET /api/bedrock/agents/list
 * 
 * 指定されたリージョンの全てのBedrock Agentを一覧取得します。
 */

import { NextRequest, NextResponse } from 'next/server';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

import { 
  BedrockAgentClient, 
  ListAgentsCommand,
  ListAgentsCommandInput
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
 * GET /api/bedrock/agents/list
 * 
 * クエリパラメータ:
 * - region: AWSリージョン（オプション、デフォルト: ap-northeast-1）
 * - maxResults: 最大取得件数（オプション、デフォルト: 100）
 */
export async function GET(request: NextRequest) {
  try {
    // クエリパラメータの取得
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region') || process.env.AWS_REGION || 'ap-northeast-1';
    const maxResults = parseInt(searchParams.get('maxResults') || '100', 10);
    
    console.log(`🔍 [Agents List API] リクエスト: region=${region}, maxResults=${maxResults}`);
    
    // リージョンのバリデーション
    if (!isValidRegion(region)) {
      console.warn(`⚠️ [Agents List API] 非標準リージョン: ${region}`);
    }
    
    try {
      // Bedrock Agentクライアントの作成
      const bedrockAgentClient = new BedrockAgentClient({ region });
      
      // Agent一覧の取得
      console.log(`🔄 [Agents List API] Agent一覧取得中...`);
      
      const listAgentsInput: ListAgentsCommandInput = {
        maxResults: Math.min(maxResults, 100) // AWS APIの制限
      };
      
      const listAgentsCommand = new ListAgentsCommand(listAgentsInput);
      const agentsResponse = await bedrockAgentClient.send(listAgentsCommand);
      
      if (!agentsResponse.agentSummaries || agentsResponse.agentSummaries.length === 0) {
        console.log(`ℹ️ [Agents List API] Agentが見つかりません: ${region}`);
        return NextResponse.json({
          success: true,
          agents: [],
          count: 0,
          region
        });
      }
      
      // Agent情報の整形
      const agents = agentsResponse.agentSummaries.map(agent => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        status: agent.agentStatus,
        description: agent.description,
        updatedAt: agent.updatedAt,
        latestAgentVersion: agent.latestAgentVersion
      }));
      
      console.log(`✅ [Agents List API] Agent一覧取得成功: ${agents.length}件 (${region})`);
      
      return NextResponse.json({
        success: true,
        agents,
        count: agents.length,
        region,
        nextToken: agentsResponse.nextToken || null
      });
      
    } catch (awsError: any) {
      console.error(`❌ [Agents List API] AWS API エラー:`, awsError);
      
      // 権限エラーの特別処理
      if (awsError.name === 'AccessDeniedException') {
        return NextResponse.json({
          success: false,
          error: 'アクセスが拒否されました。必要な権限を確認してください。',
          errorCode: 'ACCESS_DENIED',
          retryable: false,
          details: {
            message: 'Agent一覧の取得に必要な権限がありません',
            hint: 'IAMロールに以下の権限を追加してください',
            requiredPermissions: [
              'bedrock:ListAgents'
            ],
            region
          }
        }, { status: 403 });
      }
      
      // その他のAWSエラー
      const errorMessage = awsError.message || 'Unknown AWS error';
      return NextResponse.json({
        success: false,
        error: `Agent一覧の取得に失敗しました: ${errorMessage}`,
        errorCode: 'AWS_ERROR',
        retryable: true,
        details: {
          hint: 'しばらく待ってから再試行してください',
          originalError: awsError.name || 'UnknownError',
          region
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error(`❌ [Agents List API] 予期しないエラー:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: `Agent一覧の取得に失敗しました: ${errorMessage}`,
      errorCode: 'INTERNAL_ERROR',
      retryable: true,
      details: {
        hint: 'しばらく待ってから再試行してください',
        originalError: error instanceof Error ? error.toString() : String(error)
      }
    }, { status: 500 });
  }
}
