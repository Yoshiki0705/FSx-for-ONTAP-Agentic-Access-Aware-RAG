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
  CreateAgentActionGroupCommand,
  DeleteAgentCommand,
  GetAgentCommand,
  ListAgentsCommand,
  ListAgentActionGroupsCommand,
  UpdateAgentCommand,
  PrepareAgentCommand,
  CreateAgentAliasCommand,
  DeleteAgentAliasCommand,
  GetAgentAliasCommand,
  ListAgentAliasesCommand,
  AssociateAgentKnowledgeBaseCommand,
  DisassociateAgentKnowledgeBaseCommand,
  ListAgentKnowledgeBasesCommand,
} from '@aws-sdk/client-bedrock-agent';
import { SSMAgentManagerFactory } from '@/services/ssm-agent-manager';
import { createMetricsLogger } from '@/lib/monitoring/metrics';
import { emitGuardrailMetrics, type GuardrailResult } from '@/lib/guardrails';
import type { MultiAgentTraceResult } from '@/types/multi-agent';

const GUARDRAILS_ENABLED = process.env.GUARDRAILS_ENABLED === 'true';

// Bedrock Agent設定
// SSMパラメータから動的に取得、フォールバックとして環境変数を使用
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const ssmManager = SSMAgentManagerFactory.getInstance(ENVIRONMENT);

// Bedrock Clientsの初期化
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';

// Default agent mode: 'single' or 'multi' (Requirements 11.2, 11.3)
const DEFAULT_AGENT_MODE = (process.env.DEFAULT_AGENT_MODE || 'single') as 'single' | 'multi';

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

/**
 * Permission-aware Search Action Group OpenAPI Schema (inline)
 * Source: lambda/bedrock-agent-actions/permission-aware-search-schema.json
 */
const PERMISSION_AWARE_SEARCH_SCHEMA = JSON.stringify({
  openapi: '3.0.0',
  info: {
    title: 'Permission-aware Document Search API',
    version: '2.0.0',
    description: 'SID-based permission-aware document search API. Searches via Bedrock KB Retrieve API and filters by user NTFS ACL SIDs.',
  },
  paths: {
    '/search': {
      post: {
        summary: 'Permission-aware document search',
        description: 'Search documents from Bedrock Knowledge Base filtered by user SID permissions. Returns only documents the user has access to.',
        operationId: 'permissionAwareSearch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: '検索クエリ（ユーザーの質問）' },
                  maxResults: { type: 'integer', description: '返却する文書の最大数', default: 5, minimum: 1, maximum: 10 },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: '検索成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          documentId: { type: 'string' },
                          title: { type: 'string' },
                          content: { type: 'string' },
                          score: { type: 'number' },
                          source: { type: 'string' },
                          accessLevel: { type: 'string' },
                        },
                      },
                    },
                    count: { type: 'integer' },
                    message: { type: 'string' },
                    filterMethod: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

/**
 * AgentステータスをポーリングしてPREPARED状態を待つ
 * @param agentId - ポーリング対象のAgent ID
 * @param intervalMs - ポーリング間隔（ミリ秒）
 * @param maxAttempts - 最大ポーリング回数
 * @returns 最終的なAgentステータス
 */
async function pollAgentUntilPrepared(
  agentId: string,
  intervalMs: number = 5000,
  maxAttempts: number = 12
): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const getResponse = await agentClient.send(
      new GetAgentCommand({ agentId })
    );
    const status = getResponse.agent?.agentStatus || 'UNKNOWN';

    console.log(`[Bedrock Agent] Poll ${attempt}/${maxAttempts}: Agent ${agentId} status = ${status}`);

    if (status === 'PREPARED') {
      return status;
    }
    if (status === 'FAILED') {
      const failureReasons = (getResponse.agent as any)?.failureReasons;
      throw new Error(
        `Agent preparation failed: ${failureReasons ? JSON.stringify(failureReasons) : 'Unknown reason'}`
      );
    }
  }

  throw new Error(
    `Agent ${agentId} did not reach PREPARED status within ${maxAttempts * intervalMs / 1000} seconds (timeout)`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, sessionId, action, selectedAgentId, mode, teamId } = body;

    // Determine effective agent mode (Requirements 11.2, 11.3, 11.5)
    const effectiveMode: 'single' | 'multi' =
      mode === 'multi' || mode === 'single' ? mode : DEFAULT_AGENT_MODE;

    // If mode=multi and action is invoke (or default), route to multi-agent logic
    if (effectiveMode === 'multi' && (!action || action === 'invoke')) {
      return await handleMultiAgentInvoke(request, body);
    }

    // アクション別処理 (existing single-agent logic)
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
      case 'listActionGroups':
        return await handleListActionGroups(body);
      case 'listAvailableActionGroups':
        return await handleListAvailableActionGroups();
      case 'listGuardrails':
        return await handleListGuardrails();
      case 'listInferenceProfiles':
        return await handleListInferenceProfiles();
      case 'associateKnowledgeBase':
        return await handleAssociateKB(body);
      case 'disassociateKnowledgeBase':
        return await handleDisassociateKB(body);
      case 'listAgentKnowledgeBases':
        return await handleListAgentKBs(body);
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
 * マルチエージェント呼び出し処理 (Requirements 11.2, 11.5)
 *
 * mode=multi の場合、agent-team invoke ロジックを使用して
 * Supervisor Agent 経由でマルチエージェント協調処理を実行する。
 */
async function handleMultiAgentInvoke(
  request: NextRequest,
  body: any,
): Promise<NextResponse> {
  const { message, userId, sessionId, teamId } = body;

  if (!message) {
    return NextResponse.json(
      { success: false, error: 'メッセージが必要です' },
      { status: 400 },
    );
  }

  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'mode=multi の場合、teamId が必要です' },
      { status: 400 },
    );
  }

  // Forward to the agent-team invoke endpoint internally
  // Build the internal request URL for the agent-team invoke route
  const baseUrl = request.nextUrl.origin;
  const invokeUrl = `${baseUrl}/api/bedrock/agent-team/invoke`;

  console.log('[Bedrock Agent] Routing to multi-agent mode:', {
    teamId,
    userId,
    messageLength: message?.length,
  });

  try {
    const teamResponse = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization header for authentication
        ...(request.headers.get('authorization')
          ? { authorization: request.headers.get('authorization')! }
          : {}),
      },
      body: JSON.stringify({
        teamId,
        message,
        sessionId,
        userId,
      }),
    });

    const teamData = await teamResponse.json();

    if (!teamResponse.ok) {
      return NextResponse.json(teamData, { status: teamResponse.status });
    }

    // Map the agent-team response to the standard agent response format
    // so the frontend can handle both modes uniformly
    return NextResponse.json({
      success: true,
      answer: teamData.response || 'Agent Team処理が完了しましたが、レスポンスが空です。',
      metadata: {
        agentMode: true,
        multiAgentMode: true,
        sessionId: teamData.multiAgentTrace?.sessionId || sessionId,
        teamId,
        trace: undefined,
      },
      multiAgentTrace: teamData.multiAgentTrace as MultiAgentTraceResult | undefined,
    });
  } catch (error) {
    console.error('[Bedrock Agent] Multi-agent invoke error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'マルチエージェント呼び出しに失敗しました',
      },
      { status: 500 },
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

  // Guardrails: generate result based on agent response trace
  const guardrailResult: GuardrailResult | undefined = GUARDRAILS_ENABLED
    ? { status: 'safe', action: 'NONE', inputAssessment: 'PASSED', outputAssessment: 'PASSED', filteredCategories: [], guardrailId: process.env.GUARDRAIL_ID }
    : undefined;
  if (guardrailResult && GUARDRAILS_ENABLED) {
    emitGuardrailMetrics(guardrailResult);
  }

  return NextResponse.json({
    success: true,
    answer: fullResponse || 'Agent処理が完了しましたが、レスポンスが空です。',
    ...(guardrailResult ? { guardrailResult } : {}),
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
 * Agent作成処理（SSMパラメータ自動同期 + Action Group紐付け対応）
 *
 * 拡張パラメータ:
 *   attachActionGroup?: boolean - Permission-aware Action Groupを紐付けるか
 *   actionGroupLambdaArn?: string - Action Group Lambda ARN（env PERM_SEARCH_LAMBDA_ARN fallback）
 *
 * attachActionGroup: true の場合のフロー:
 *   1. CreateAgent
 *   2. CreateAgentActionGroup (Lambda ARN利用可能時)
 *   3. PrepareAgent
 *   4. Poll GetAgent (5秒×最大12回) until PREPARED
 *   5. CreateAgentAlias
 *
 * attachActionGroup: false/未指定の場合は従来フロー:
 *   1. CreateAgent → PrepareAgent → CreateAgentAlias
 */
async function handleCreateAgent(body: any): Promise<NextResponse> {
  const {
    agentName,
    description,
    instruction,
    foundationModel,
    attachActionGroup,
    actionGroupLambdaArn,
    // Enterprise enhancement parameters (optional)
    actionGroups,        // string[] — selected action group names
    guardrailId,         // string — guardrail ID to associate
    guardrailVersion,    // string — guardrail version
    inferenceProfileArn, // string — inference profile ARN
    costTags,            // { department, project } — cost allocation tags
  } = body;

  if (!agentName) {
    return NextResponse.json(
      { success: false, error: 'Agent名が必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Creating agent:', {
      agentName,
      foundationModel,
      attachActionGroup: !!attachActionGroup,
    });

    // AWSアカウントIDを動的に取得
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
    const stsClient = new STSClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
    const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = callerIdentity.Account;

    // Agent Role ARNを環境変数から取得、または動的に構築
    const agentRoleArn = process.env.BEDROCK_AGENT_ROLE_ARN || 
      `arn:aws:iam::${accountId}:role/TokyoRegion-permission-aware-rag-prod-bedrock-agent-role`;

    // Agent作成
    // Build tags from costTags if provided
    const agentTags: Record<string, string> = {};
    if (costTags?.department) agentTags['department'] = costTags.department;
    if (costTags?.project) agentTags['project'] = costTags.project;

    const createCommand = new CreateAgentCommand({
      agentName,
      description: description || `${agentName} - Created via UI`,
      instruction: instruction || 'You are a helpful AI assistant.',
      foundationModel: foundationModel || 'anthropic.claude-3-sonnet-20240229-v1:0',
      agentResourceRoleArn: agentRoleArn,
      idleSessionTTLInSeconds: 1800,
      ...(guardrailId ? {
        guardrailConfiguration: {
          guardrailIdentifier: guardrailId,
          guardrailVersion: guardrailVersion || 'DRAFT',
        },
      } : {}),
      ...(Object.keys(agentTags).length > 0 ? { tags: agentTags } : {}),
    });

    const createResponse = await agentClient.send(createCommand);
    const newAgentId = createResponse.agent?.agentId;

    if (!newAgentId) {
      throw new Error('Agent作成に失敗しました - Agent IDが取得できません');
    }

    console.log(`✅ Agent作成成功: ${newAgentId}`);

    // Agent作成直後はCREATING状態のため、NOT_PREPAREDになるまで待機
    console.log(`⏳ Agent ${newAgentId} がCREATING状態を抜けるまで待機...`);
    for (let i = 0; i < 12; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const checkResp = await agentClient.send(new GetAgentCommand({ agentId: newAgentId }));
      const status = checkResp.agent?.agentStatus || 'UNKNOWN';
      console.log(`  [${i + 1}/12] Agent status: ${status}`);
      if (status !== 'CREATING') break;
    }

    // Action Group紐付け結果を追跡
    let actionGroupResult: { attached: boolean; name?: string; error?: string } | undefined;

    // --- Action Group紐付け（attachActionGroup: true の場合） ---
    if (attachActionGroup) {
      const lambdaArn = actionGroupLambdaArn || process.env.PERM_SEARCH_LAMBDA_ARN;

      if (lambdaArn) {
        try {
          console.log(`[Bedrock Agent] Attaching Action Group to agent ${newAgentId}, Lambda: ${lambdaArn}`);

          const actionGroupCommand = new CreateAgentActionGroupCommand({
            agentId: newAgentId,
            agentVersion: 'DRAFT',
            actionGroupName: 'PermissionAwareSearch',
            description: 'SID-based permission-aware document search',
            actionGroupExecutor: { lambda: lambdaArn },
            apiSchema: {
              payload: PERMISSION_AWARE_SEARCH_SCHEMA,
            },
          });

          await agentClient.send(actionGroupCommand);
          console.log(`✅ Action Group紐付け成功: PermissionAwareSearch → ${newAgentId}`);
          actionGroupResult = { attached: true, name: 'PermissionAwareSearch' };
        } catch (agError) {
          const errorMsg = agError instanceof Error ? agError.message : 'Action Group紐付けに失敗';
          console.error(`⚠️ Action Group紐付けエラー (継続): ${errorMsg}`);
          actionGroupResult = { attached: false, error: errorMsg };
        }
      } else {
        console.warn('⚠️ Action Group Lambda ARN未設定: Action Groupなしで作成');
        actionGroupResult = { attached: false, error: 'Lambda ARN not available (env PERM_SEARCH_LAMBDA_ARN not set, not passed in request)' };
      }
    }

    // --- PrepareAgent ---
    const prepareCommand = new PrepareAgentCommand({ agentId: newAgentId });
    await agentClient.send(prepareCommand);
    console.log(`✅ PrepareAgent呼び出し完了: ${newAgentId}`);

    // --- ポーリング（attachActionGroup時は必須、それ以外も実行） ---
    let agentAliasId: string | undefined;

    if (attachActionGroup) {
      // Action Group紐付け時はポーリングでPREPARED状態を確認してからAlias作成
      try {
        const finalStatus = await pollAgentUntilPrepared(newAgentId, 5000, 12);
        console.log(`✅ Agent PREPARED確認: ${newAgentId} (status: ${finalStatus})`);

        // Agent Alias作成
        const aliasCommand = new CreateAgentAliasCommand({
          agentId: newAgentId,
          agentAliasName: 'PROD',
          description: 'Production alias for the agent',
        });
        const aliasResponse = await agentClient.send(aliasCommand);
        agentAliasId = aliasResponse.agentAlias?.agentAliasId;
        console.log(`✅ Agent Alias作成開始: ${agentAliasId}`);

        // Alias がPREPAREDになるまでポーリング
        if (agentAliasId) {
          for (let i = 0; i < 12; i++) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const aliasCheck = await agentClient.send(
              new GetAgentAliasCommand({ agentId: newAgentId, agentAliasId })
            );
            const aliasStatus = aliasCheck.agentAlias?.agentAliasStatus || 'UNKNOWN';
            console.log(`  [${i + 1}/12] Alias status: ${aliasStatus}`);
            if (aliasStatus === 'PREPARED') {
              console.log(`✅ Agent Alias PREPARED: ${agentAliasId}`);
              break;
            }
            if (aliasStatus === 'FAILED') {
              console.error(`❌ Agent Alias FAILED: ${agentAliasId}`);
              break;
            }
          }
        }
      } catch (pollError) {
        console.error('[Bedrock Agent] Polling/Alias error:', pollError);
        return NextResponse.json(
          {
            success: false,
            error: pollError instanceof Error ? pollError.message : 'Agent準備中にエラーが発生しました',
            agent: {
              agentId: newAgentId,
              agentName,
              status: 'PREPARING',
            },
            actionGroup: actionGroupResult,
          },
          { status: 500 }
        );
      }
    } else {
      // 従来フロー: PrepareAgent後すぐにAlias作成
      const aliasCommand = new CreateAgentAliasCommand({
        agentId: newAgentId,
        agentAliasName: 'PROD',
        description: 'Production alias for the agent',
      });
      const aliasResponse = await agentClient.send(aliasCommand);
      agentAliasId = aliasResponse.agentAlias?.agentAliasId;
      console.log(`✅ Agent Alias作成完了: ${agentAliasId}`);
    }

    // SSMパラメータに自動登録
    try {
      await ssmManager.registerAgentId(newAgentId, agentName);
      console.log(`✅ SSMパラメータ登録完了: ${newAgentId}`);
    } catch (ssmError) {
      console.error('⚠️ SSMパラメータ登録に失敗:', ssmError);
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
      message: attachActionGroup
        ? 'Agent作成、Action Group紐付け、SSMパラメータ登録が完了しました'
        : 'Agent作成とSSMパラメータ登録が完了しました',
      actionGroup: actionGroupResult,
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
  const {
    agentId, agentName, description, instruction, foundationModel,
    // Enterprise enhancement parameters (optional)
    guardrailId, guardrailVersion, inferenceProfileArn, costTags,
  } = body;

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
      agentResourceRoleArn: existingAgent.agent.agentResourceRoleArn,
      ...(guardrailId ? {
        guardrailConfiguration: {
          guardrailIdentifier: guardrailId,
          guardrailVersion: guardrailVersion || 'DRAFT',
        },
      } : {}),
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

// ---------------------------------------------------------------------------
// Enterprise Agent Enhancement Handlers
// ---------------------------------------------------------------------------

/**
 * List action groups attached to a specific agent
 */
async function handleListActionGroups(body: any): Promise<NextResponse> {
  const { agentId, agentVersion } = body;

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDが必要です' },
      { status: 400 }
    );
  }

  try {
    const command = new ListAgentActionGroupsCommand({
      agentId,
      agentVersion: agentVersion || 'DRAFT',
    });
    const response = await agentClient.send(command);

    const actionGroups = (response.actionGroupSummaries || []).map((ag: any) => ({
      actionGroupId: ag.actionGroupId,
      actionGroupName: ag.actionGroupName,
      actionGroupState: ag.actionGroupState,
      description: ag.description || '',
      updatedAt: ag.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      actionGroups,
      message: 'Action Group一覧取得完了',
    });
  } catch (error) {
    console.error('[Bedrock Agent] ListActionGroups error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Action Group一覧取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * List available action group templates (static list)
 */
async function handleListAvailableActionGroups(): Promise<NextResponse> {
  const availableGroups = [
    {
      name: 'PermissionAwareSearch',
      descriptionKey: 'permissionAwareSearch',
      description: 'SID-based permission-aware document search using Bedrock KB Retrieve API with NTFS ACL filtering.',
      isDefault: true,
    },
    {
      name: 'Browser',
      descriptionKey: 'browser',
      description: 'Web search and browsing. Search and retrieve information from external websites.',
      isDefault: false,
    },
    {
      name: 'CodeInterpreter',
      descriptionKey: 'codeInterpreter',
      description: 'Python code execution environment for data analysis, visualization, and computation.',
      isDefault: false,
    },
  ];

  return NextResponse.json({
    success: true,
    actionGroups: availableGroups,
    message: '利用可能なAction Groupテンプレート一覧',
  });
}

/**
 * List available Bedrock Guardrails
 */
async function handleListGuardrails(): Promise<NextResponse> {
  try {
    const { BedrockClient, ListGuardrailsCommand } = await import('@aws-sdk/client-bedrock');
    const bedrockClient = new BedrockClient({ region: BEDROCK_REGION });

    const command = new ListGuardrailsCommand({});
    const response = await bedrockClient.send(command);

    const guardrails = (response.guardrails || []).map((g: any) => ({
      guardrailId: g.id,
      name: g.name,
      description: g.description || '',
      status: g.status,
      version: g.version || 'DRAFT',
    }));

    return NextResponse.json({
      success: true,
      guardrails,
      message: 'ガードレール一覧取得完了',
    });
  } catch (error) {
    console.error('[Bedrock Agent] ListGuardrails error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'ガードレール一覧取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * List available Bedrock Inference Profiles
 */
async function handleListInferenceProfiles(): Promise<NextResponse> {
  try {
    const { BedrockClient, ListInferenceProfilesCommand } = await import('@aws-sdk/client-bedrock');
    const bedrockClient = new BedrockClient({ region: BEDROCK_REGION });

    const command = new ListInferenceProfilesCommand({});
    const response = await bedrockClient.send(command);

    const profiles = (response.inferenceProfileSummaries || []).map((p: any) => ({
      inferenceProfileArn: p.inferenceProfileArn,
      inferenceProfileName: p.inferenceProfileName,
      modelId: p.models?.[0]?.modelArn || '',
      status: p.status,
    }));

    return NextResponse.json({
      success: true,
      inferenceProfiles: profiles,
      message: '推論プロファイル一覧取得完了',
    });
  } catch (error) {
    console.error('[Bedrock Agent] ListInferenceProfiles error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '推論プロファイル一覧取得に失敗しました' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// KB Connection Management Handlers (Advanced RAG Features)
// ---------------------------------------------------------------------------

/**
 * AgentにKnowledge Baseを接続する
 * 接続成功後、PrepareAgentを呼び出してAgentを再準備する
 */
async function handleAssociateKB(body: any): Promise<NextResponse> {
  const { agentId, agentVersion, knowledgeBaseId, description } = body;
  const metrics = createMetricsLogger(process.env.ENABLE_MONITORING === 'true');
  metrics.setDimension('Operation', 'kb-mgmt');
  metrics.putMetric('KbAssociateInvocations', 1, 'Count');

  if (!agentId || !knowledgeBaseId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDとKnowledge Base IDが必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Associating KB:', { agentId, knowledgeBaseId });

    const associateCommand = new AssociateAgentKnowledgeBaseCommand({
      agentId,
      agentVersion: agentVersion || 'DRAFT',
      knowledgeBaseId,
      description: description || `Knowledge Base ${knowledgeBaseId}`,
      knowledgeBaseState: 'ENABLED',
    });

    const response = await agentClient.send(associateCommand);
    console.log(`✅ KB接続成功: ${knowledgeBaseId} → Agent ${agentId}`);

    // PrepareAgentを呼び出してAgentを再準備
    const prepareCommand = new PrepareAgentCommand({ agentId });
    await agentClient.send(prepareCommand);
    console.log(`✅ PrepareAgent完了: ${agentId}`);

    metrics.flush();
    return NextResponse.json({
      success: true,
      agentKnowledgeBase: response.agentKnowledgeBase,
      message: 'Knowledge Base接続とAgent再準備が完了しました',
    });
  } catch (error) {
    console.error('[Bedrock Agent] AssociateKB error:', error);
    metrics.putMetric('KbMgmtErrors', 1, 'Count');
    metrics.flush();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Knowledge Base接続に失敗しました',
      },
      { status: 500 }
    );
  }
}

/**
 * AgentからKnowledge Baseを解除する
 * 解除成功後、PrepareAgentを呼び出してAgentを再準備する
 */
async function handleDisassociateKB(body: any): Promise<NextResponse> {
  const { agentId, agentVersion, knowledgeBaseId } = body;
  const metrics = createMetricsLogger(process.env.ENABLE_MONITORING === 'true');
  metrics.setDimension('Operation', 'kb-mgmt');
  metrics.putMetric('KbDisassociateInvocations', 1, 'Count');

  if (!agentId || !knowledgeBaseId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDとKnowledge Base IDが必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Disassociating KB:', { agentId, knowledgeBaseId });

    const disassociateCommand = new DisassociateAgentKnowledgeBaseCommand({
      agentId,
      agentVersion: agentVersion || 'DRAFT',
      knowledgeBaseId,
    });

    await agentClient.send(disassociateCommand);
    console.log(`✅ KB解除成功: ${knowledgeBaseId} ← Agent ${agentId}`);

    // PrepareAgentを呼び出してAgentを再準備
    const prepareCommand = new PrepareAgentCommand({ agentId });
    await agentClient.send(prepareCommand);
    console.log(`✅ PrepareAgent完了: ${agentId}`);

    metrics.flush();
    return NextResponse.json({
      success: true,
      message: 'Knowledge Base解除とAgent再準備が完了しました',
    });
  } catch (error) {
    console.error('[Bedrock Agent] DisassociateKB error:', error);
    metrics.putMetric('KbMgmtErrors', 1, 'Count');
    metrics.flush();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Knowledge Base解除に失敗しました',
      },
      { status: 500 }
    );
  }
}

/**
 * Agentに接続されたKnowledge Base一覧を取得する
 */
async function handleListAgentKBs(body: any): Promise<NextResponse> {
  const { agentId, agentVersion } = body;

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'Agent IDが必要です' },
      { status: 400 }
    );
  }

  try {
    console.log('[Bedrock Agent] Listing agent KBs:', { agentId });

    const listCommand = new ListAgentKnowledgeBasesCommand({
      agentId,
      agentVersion: agentVersion || 'DRAFT',
    });

    const response = await agentClient.send(listCommand);

    const knowledgeBases = (response.agentKnowledgeBaseSummaries || []).map((kb: any) => ({
      knowledgeBaseId: kb.knowledgeBaseId,
      knowledgeBaseState: kb.knowledgeBaseState,
      description: kb.description || '',
      updatedAt: kb.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      knowledgeBases,
      message: '接続済みKnowledge Base一覧取得完了',
    });
  } catch (error) {
    console.error('[Bedrock Agent] ListAgentKBs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '接続済みKB一覧取得に失敗しました',
      },
      { status: 500 }
    );
  }
}
