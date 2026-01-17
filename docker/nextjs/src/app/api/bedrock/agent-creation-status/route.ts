import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentClient, GetAgentCommand, GetAgentAliasCommand } from '@aws-sdk/client-bedrock-agent';

/**
 * Agent作成ステータス取得API
 * 
 * GET /api/bedrock/agent-creation-status?agentId=xxx
 * 
 * Agent作成の進捗状況を取得します
 * 
 * Requirements: 28.5
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const region = searchParams.get('region') || 'ap-northeast-1';

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent IDが指定されていません'
      }, { status: 400 });
    }

    console.log('🔍 [AgentCreationStatus] ステータス確認開始:', { agentId, region });

    // Bedrock Agentクライアント初期化
    const bedrockAgentClient = new BedrockAgentClient({
      region: region,
    });

    // Agent情報取得
    const getAgentCommand = new GetAgentCommand({
      agentId: agentId,
    });

    const agentResponse = await bedrockAgentClient.send(getAgentCommand);
    const agent = agentResponse.agent;

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agentが見つかりません'
      }, { status: 404 });
    }

    // Alias情報取得（DRAFT aliasを確認）
    let aliasStatus = null;
    try {
      const getAliasCommand = new GetAgentAliasCommand({
        agentId: agentId,
        agentAliasId: 'TSTALIASID', // DRAFTエイリアスのID
      });
      
      const aliasResponse = await bedrockAgentClient.send(getAliasCommand);
      aliasStatus = aliasResponse.agentAlias?.agentAliasStatus;
    } catch (error) {
      console.log('ℹ️ [AgentCreationStatus] Alias情報取得スキップ:', error);
    }

    // ステータス判定
    const status = {
      agentId: agentId,
      agentStatus: agent.agentStatus,
      aliasStatus: aliasStatus,
      
      // 各ステップの完了状況
      agentCreated: agent.agentStatus !== 'CREATING',
      creatingAgent: agent.agentStatus === 'CREATING',
      
      aliasCreated: aliasStatus === 'PREPARED' || aliasStatus === 'FAILED',
      creatingAlias: aliasStatus === 'CREATING' || aliasStatus === 'UPDATING',
      
      knowledgeBaseAssociated: true, // TODO: 実際のKB関連付け状況を確認
      associatingKnowledgeBase: false,
      
      agentPrepared: agent.agentStatus === 'PREPARED',
      preparingAgent: agent.agentStatus === 'PREPARING' || agent.agentStatus === 'UPDATING',
      
      validated: agent.agentStatus === 'PREPARED',
      validating: false,
      
      // 全体ステータス
      isCompleted: agent.agentStatus === 'PREPARED',
      hasFailed: agent.agentStatus === 'FAILED' || aliasStatus === 'FAILED',
      
      // エラー情報
      errors: agent.agentStatus === 'FAILED' ? {
        'agent-creation': agent.failureReasons?.join(', ') || 'Agent作成に失敗しました'
      } : aliasStatus === 'FAILED' ? {
        'alias-creation': 'Alias作成に失敗しました'
      } : null,
      
      // 詳細情報
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      foundationModel: agent.foundationModel,
    };

    console.log('✅ [AgentCreationStatus] ステータス取得成功:', {
      agentStatus: agent.agentStatus,
      aliasStatus: aliasStatus,
      isCompleted: status.isCompleted,
      hasFailed: status.hasFailed
    });

    return NextResponse.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('❌ [AgentCreationStatus] ステータス取得エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'ステータス取得に失敗しました',
      details: {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 });
  }
}