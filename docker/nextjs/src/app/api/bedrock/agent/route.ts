/**
 * Amazon Bedrock Agent API エンドポイント
 * Bedrock Agentを使用した文書検索と質問応答
 * SSMパラメータ管理統合版
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockAgentClient,
  CreateAgentCommand,
  DeleteAgentCommand,
  GetAgentCommand,
  ListAgentsCommand,
  UpdateAgentCommand,
  PrepareAgentCommand,
  CreateAgentAliasCommand,
  DeleteAgentAliasCommand,
  GetAgentAliasCommand,
  ListAgentAliasesCommand,
} from '@aws-sdk/client-bedrock-agent';
import { SSMAgentManagerFactory } from '@/services/ssm-agent-manager';

// Bedrock Agent設定
// SSMパラメータから動的に取得、フォールバックとして環境変数を使用
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const ssmManager = SSMAgentManagerFactory.getInstance(ENVIRONMENT);

// Bedrock Clientsの初期化
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';

const agentRuntimeClient = new BedrockAgentRuntimeClient({
  region: BEDROCK_REGION,
});

const agentClient = new BedrockAgentClient({
  region: BEDROCK_REGION,
});

// Agent ID取得関数（SSM優先、環境変数フォールバック）
async function getAgentId(): Promise<string> {
  try {
    // SSMパラメータから取得を試行
    const ssmAgentId = await ssmManager.getAgentId();
    if (ssmAgentId) {
      console.log(`✅ Agent ID取得成功 (SSM): ${ssmAgentId}`);
      return ssmAgentId;
    }
  } catch (error) {
    console.warn('⚠️ SSMからのAgent ID取得に失敗、環境変数を使用:', error);
  }
  
  // フォールバック: 環境変数から取得
  const envAgentId = process.env.BEDROCK_AGENT_ID || 
    (process.env.NODE_ENV === 'production' ? '1NWQJTIMAH' : 'PXCEX87Y09');
  
  console.log(`ℹ️ Agent ID取得 (環境変数): ${envAgentId}`);
  return envAgentId;
}

const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, sessionId, action, selectedAgentId } = body;

    // アクション別処理
    switch (action) {
      case 'invoke':
        return await handleInvokeAgent(message, userId, sessionId, selectedAgentId);
      case 'create':
        return await handleCreateAgent(body);
      case 'delete':
        return await handleDeleteAgent(body);
      case 'update':
        return await handleUpdateAgent(body);
      case 'list':
        return await handleListAgents();
      case 'get':
        return await handleGetAgent(body);
      default:
        // デフォルトはinvokeアクション（後方互換性）
        return await handleInvokeAgent(message, userId, sessionId, selectedAgentId);
    }
  } catch (error) {
    console.error('[Bedrock Agent API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Agent呼び出し処理（既存機能）
 */
async function handleInvokeAgent(
  message: string,
  userId: string,
  sessionId: string,
  selectedAgentId?: string
): Promise<NextResponse> {
  if (!message) {
    return NextResponse.json(
      { success: false, error: 'メッセージが必要です' },
      { status: 400 }
    );
  }

  // Agent ID取得（selectedAgentId優先、SSM次点、環境変数フォールバック）
  let AGENT_ID: string;
  
  if (selectedAgentId) {
    console.log(`✅ [Bedrock Agent] 選択されたAgent IDを使用: ${selectedAgentId}`);
    AGENT_ID = selectedAgentId;
  } else {
    console.log('⚠️ [Bedrock Agent] selectedAgentIdが未指定、SSM/環境変数から取得');
    AGENT_ID = await getAgentId();
  }

  console.log('[Bedrock Agent] Request:', {
    userId,
    sessionId,
    messageLength: message.length,
    agentId: AGENT_ID,
    agentAliasId: AGENT_ALIAS_ID,
    region: BEDROCK_REGION,
    environment: process.env.NODE_ENV
  });

  // Bedrock Agent呼び出し
  const sanitizedSessionId = (sessionId || `session-${userId}-${Date.now()}`)
    .replace(/[^0-9a-zA-Z._:-]/g, '-');

  const command = new InvokeAgentCommand({
    agentId: AGENT_ID,
    agentAliasId: AGENT_ALIAS_ID,
    sessionId: sanitizedSessionId,
    inputText: message,
    // Permission-aware Action GroupにuserIdを渡す
    sessionState: {
      sessionAttributes: {
        userId: userId || '',
      },
    },
  });

  const response = await agentRuntimeClient.send(command);

  // ストリーミングレスポンスの処理
  let fullResponse = '';
  let citations: any[] = [];
  let trace: any[] = [];

  if (response.completion) {
    for await (const event of response.completion) {
      if (event.chunk) {
        const chunk = event.chunk;
        if (chunk.bytes) {
          const text = new TextDecoder().decode(chunk.bytes);
          fullResponse += text;
        }
      }
      
      if (event.trace) {
        trace.push(event.trace);
      }
    }
  }

  console.log('[Bedrock Agent] Response received:', {
    responseLength: fullResponse.length,
    citationsCount: citations.length,
    traceCount: trace.length,
  });

  return NextResponse.json({
    success: true,
    answer: fullResponse || 'Agent処理が完了しましたが、レスポンスが空です。',
    metadata: {
      agentMode: true,
      sessionId: sessionId || `session-${userId}-${Date.now()}`,
      agentId: AGENT_ID,
      citations: citations,
      trace: trace.length > 0 ? trace : undefined,
    },
  });
}

/**
 * Agent作成処理（SSMパラメータ自動同期）
 */
async function handleCreateAgent(body: any): Promise<NextResponse> {
  const { agentName, description, instruction, foundationModel } = body;

  if (!agentName) {
    return NextResponse.json(
      { success: false, error: 'Agent名が必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Creating agent:', { agentName, foundationModel });

    // AWSアカウントIDを動的に取得
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
    const stsClient = new STSClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
    const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = callerIdentity.Account;

    // Agent Role ARNを環境変数から取得、または動的に構築
    const agentRoleArn = process.env.BEDROCK_AGENT_ROLE_ARN || 
      `arn:aws:iam::${accountId}:role/TokyoRegion-permission-aware-rag-prod-bedrock-agent-role`;

    // Agent作成
    const createCommand = new CreateAgentCommand({
      agentName,
      description: description || `${agentName} - Created via UI`,
      instruction: instruction || 'You are a helpful AI assistant.',
      foundationModel: foundationModel || 'anthropic.claude-3-sonnet-20240229-v1:0',
      agentResourceRoleArn: agentRoleArn, // 必須パラメータを追加
      idleSessionTTLInSeconds: 1800, // 30分
    });

    const createResponse = await agentClient.send(createCommand);
    const newAgentId = createResponse.agent?.agentId;

    if (!newAgentId) {
      throw new Error('Agent作成に失敗しました - Agent IDが取得できません');
    }

    console.log(`✅ Agent作成成功: ${newAgentId}`);

    // Agent準備（必須）
    const prepareCommand = new PrepareAgentCommand({
      agentId: newAgentId,
    });
    await agentClient.send(prepareCommand);
    console.log(`✅ Agent準備完了: ${newAgentId}`);

    // Agent Alias作成
    const aliasCommand = new CreateAgentAliasCommand({
      agentId: newAgentId,
      agentAliasName: 'PROD',
      description: 'Production alias for the agent',
    });
    const aliasResponse = await agentClient.send(aliasCommand);
    const agentAliasId = aliasResponse.agentAlias?.agentAliasId;

    console.log(`✅ Agent Alias作成完了: ${agentAliasId}`);

    // SSMパラメータに自動登録
    try {
      await ssmManager.registerAgentId(newAgentId, agentName);
      console.log(`✅ SSMパラメータ登録完了: ${newAgentId}`);
    } catch (ssmError) {
      console.error('⚠️ SSMパラメータ登録に失敗:', ssmError);
      // SSM登録失敗はエラーとしない（Agentは作成済み）
    }

    return NextResponse.json({
      success: true,
      agent: {
        agentId: newAgentId,
        agentName,
        agentAliasId,
        status: createResponse.agent?.agentStatus,
        createdAt: createResponse.agent?.createdAt,
      },
      message: 'Agent作成とSSMパラメータ登録が完了しました',
    });

  } catch (error) {
    console.error('[Bedrock Agent] Create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent作成に失敗しました',
      },
      { status: 500 }
    );
  }
}

/**
 * Agent削除処理（SSMパラメータ自動同期）
 */
async function handleDeleteAgent(body: any): Promise<NextResponse> {
  const { agentId } = body;

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDが必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Deleting agent:', { agentId });

    // Agent Aliasの削除
    try {
      const listAliasesCommand = new ListAgentAliasesCommand({
        agentId,
      });
      const aliasesResponse = await agentClient.send(listAliasesCommand);
      
      if (aliasesResponse.agentAliasSummaries) {
        for (const alias of aliasesResponse.agentAliasSummaries) {
          if (alias.agentAliasId && alias.agentAliasId !== 'TSTALIASID') {
            const deleteAliasCommand = new DeleteAgentAliasCommand({
              agentId,
              agentAliasId: alias.agentAliasId,
            });
            await agentClient.send(deleteAliasCommand);
            console.log(`✅ Agent Alias削除完了: ${alias.agentAliasId}`);
          }
        }
      }
    } catch (aliasError) {
      console.warn('⚠️ Agent Alias削除でエラー（継続）:', aliasError);
    }

    // Agent削除
    const deleteCommand = new DeleteAgentCommand({
      agentId,
    });
    await agentClient.send(deleteCommand);
    console.log(`✅ Agent削除完了: ${agentId}`);

    // SSMパラメータから自動削除
    try {
      await ssmManager.unregisterAgentId();
      console.log(`✅ SSMパラメータ削除完了: ${agentId}`);
    } catch (ssmError) {
      console.error('⚠️ SSMパラメータ削除に失敗:', ssmError);
      // SSM削除失敗はエラーとしない（Agentは削除済み）
    }

    return NextResponse.json({
      success: true,
      message: 'Agent削除とSSMパラメータ削除が完了しました',
      agentId,
    });

  } catch (error) {
    console.error('[Bedrock Agent] Delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent削除に失敗しました',
      },
      { status: 500 }
    );
  }
}

/**
 * Agent更新処理（SSMパラメータ自動同期）
 */
async function handleUpdateAgent(body: any): Promise<NextResponse> {
  const { agentId, agentName, description, instruction, foundationModel } = body;

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDが必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Updating agent:', { agentId, agentName });

    // 既存のAgent情報を取得してroleArnを保持
    const getCommand = new GetAgentCommand({ agentId });
    const existingAgent = await agentClient.send(getCommand);
    
    if (!existingAgent.agent) {
      throw new Error('Agent not found');
    }

    // Agent更新
    const updateCommand = new UpdateAgentCommand({
      agentId,
      agentName,
      description,
      instruction,
      foundationModel,
      agentResourceRoleArn: existingAgent.agent.agentResourceRoleArn, // 既存のroleArnを使用
    });

    const updateResponse = await agentClient.send(updateCommand);

    // Agent準備（更新後は必須）
    const prepareCommand = new PrepareAgentCommand({
      agentId,
    });
    await agentClient.send(prepareCommand);
    console.log(`✅ Agent更新・準備完了: ${agentId}`);

    // SSMパラメータ更新（Agent IDが変わった場合）
    try {
      await ssmManager.updateAgentId(agentId, agentName);
      console.log(`✅ SSMパラメータ更新完了: ${agentId}`);
    } catch (ssmError) {
      console.error('⚠️ SSMパラメータ更新に失敗:', ssmError);
      // SSM更新失敗はエラーとしない（Agentは更新済み）
    }

    return NextResponse.json({
      success: true,
      agent: {
        agentId,
        agentName,
        status: updateResponse.agent?.agentStatus,
        updatedAt: updateResponse.agent?.updatedAt,
      },
      message: 'Agent更新とSSMパラメータ更新が完了しました',
    });

  } catch (error) {
    console.error('[Bedrock Agent] Update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent更新に失敗しました',
      },
      { status: 500 }
    );
  }
}

/**
 * Agent一覧取得処理
 */
async function handleListAgents(): Promise<NextResponse> {
  try {
    console.log('[Bedrock Agent] Listing agents');

    const listCommand = new ListAgentsCommand({
      maxResults: 50,
    });

    const response = await agentClient.send(listCommand);

    // SSM同期状態確認
    const currentSsmAgentId = await ssmManager.getAgentId();
    const syncStatus = await ssmManager.verifySyncStatus(currentSsmAgentId || undefined);

    return NextResponse.json({
      success: true,
      agents: response.agentSummaries || [],
      ssmSync: {
        currentAgentId: currentSsmAgentId,
        syncStatus: syncStatus,
      },
      message: 'Agent一覧取得完了',
    });

  } catch (error) {
    console.error('[Bedrock Agent] List error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent一覧取得に失敗しました',
      },
      { status: 500 }
    );
  }
}

/**
 * Agent詳細取得処理
 */
async function handleGetAgent(body: any): Promise<NextResponse> {
  const { agentId } = body;

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDが必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Getting agent:', { agentId });

    const getCommand = new GetAgentCommand({
      agentId,
    });

    const response = await agentClient.send(getCommand);

    // SSM同期状態確認
    const syncStatus = await ssmManager.verifySyncStatus(agentId);

    return NextResponse.json({
      success: true,
      agent: response.agent,
      ssmSync: syncStatus,
      message: 'Agent詳細取得完了',
    });

  } catch (error) {
    console.error('[Bedrock Agent] Get error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent詳細取得に失敗しました',
      },
      { status: 500 }
    );
  }
}
