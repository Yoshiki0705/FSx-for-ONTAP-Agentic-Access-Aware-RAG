/**
 * Route handlers for `AGENT_BACKEND=agentcore`. Each returns the same JSON shape as the
 * Bedrock Agents handler of the same action, so the screens work unchanged.
 */
import { NextResponse } from 'next/server';
import { GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { AgentTeamConfig } from '@/types/multi-agent';
import {
  AVAILABLE_TOOLS,
  ValidationError,
  buildDefinition,
  deleteDefinition,
  getDefinition,
  invokeAgent,
  invokeTeam,
  listDefinitions,
  saveDefinition,
  toAgent,
  toSummary,
} from './agentcore';
import { sessionUserId } from './index';

function fail(error: unknown, status = 500) {
  const code = error instanceof ValidationError ? 400 : status;
  return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: code });
}

/**
 * The user to search for: the session's, and never a different one from the body. A body
 * `userId` that matches the session is accepted (the screens send it); one that differs is
 * refused rather than silently replaced, so a mismatch shows up instead of being hidden.
 */
export async function resolveUser(bodyUserId: unknown): Promise<{ userId: string } | NextResponse> {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  }
  if (typeof bodyUserId === 'string' && bodyUserId && bodyUserId !== userId) {
    return NextResponse.json({ success: false, error: 'userId does not match the signed-in user' }, { status: 403 });
  }
  return { userId };
}

export async function invokeResponse(body: Record<string, unknown>) {
  const message = typeof body.message === 'string' ? body.message : '';
  if (!message) return NextResponse.json({ success: false, error: 'メッセージが必要です' }, { status: 400 });
  const user = await resolveUser(body.userId);
  if (user instanceof NextResponse) return user;
  try {
    const { definition, result, sessionId } = await invokeAgent({
      agentId: typeof body.selectedAgentId === 'string' ? body.selectedAgentId : undefined,
      message,
      userId: user.userId,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    });
    return NextResponse.json({
      success: true,
      answer: result.answer || 'Agent処理が完了しましたが、レスポンスが空です。',
      metadata: {
        agentMode: true,
        backend: 'agentcore',
        sessionId,
        agentId: definition.agentId,
        citations: (result.searches || []).flatMap((s) => s.files.map((fileName) => ({ fileName }))),
        searches: result.searches,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

let teamDdb: DynamoDBDocumentClient | null = null;
export async function getTeam(teamId: string): Promise<AgentTeamConfig | null> {
  const table = process.env.AGENT_TEAM_TABLE_NAME;
  if (!table) return null;
  teamDdb ??= DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' }));
  const out = await teamDdb.send(new GetCommand({ TableName: table, Key: { teamId } }));
  return (out.Item as AgentTeamConfig) || null;
}

/** Multi-agent invoke; the shape of `/api/bedrock/agent-team/invoke`. */
export async function teamInvokeResponse(body: Record<string, unknown>) {
  const teamId = typeof body.teamId === 'string' ? body.teamId : '';
  const message = typeof body.message === 'string' ? body.message : '';
  if (!teamId) return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 });
  if (!message) return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
  const user = await resolveUser(body.userId);
  if (user instanceof NextResponse) return user;
  try {
    const team = await getTeam(teamId);
    if (!team) return NextResponse.json({ success: false, error: `Team not found: ${teamId}` }, { status: 404 });
    const { result, trace } = await invokeTeam({
      team,
      message,
      userId: user.userId,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    });
    return NextResponse.json({ success: true, response: result.answer, multiAgentTrace: trace, backend: 'agentcore' });
  } catch (error) {
    return fail(error);
  }
}

/** `/api/bedrock/agent` actions other than invoke. */
export async function agentActionResponse(action: string, body: Record<string, unknown>) {
  try {
    switch (action) {
      case 'list': {
        const agents = (await listDefinitions()).map(toSummary);
        return NextResponse.json({ success: true, agents, message: 'Agent一覧取得完了', backend: 'agentcore' });
      }
      case 'get': {
        const d = await getDefinition(String(body.agentId || ''));
        if (!d) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
        return NextResponse.json({ success: true, agent: toAgent(d), message: 'Agent詳細取得完了' });
      }
      case 'create': {
        const d = await saveDefinition(buildDefinition(body));
        return NextResponse.json({
          success: true,
          agent: { agentId: d.agentId, agentName: d.agentName, agentAliasId: undefined, status: d.agentStatus, createdAt: d.createdAt },
          message: 'Agentを作成しました（AgentCore）',
          actionGroup: { attached: (d.tools || []).includes('PermissionAwareSearch'), name: 'PermissionAwareSearch' },
        });
      }
      case 'update': {
        const existing = await getDefinition(String(body.agentId || ''));
        if (!existing) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
        const d = await saveDefinition(buildDefinition(body, existing));
        return NextResponse.json({
          success: true,
          agent: { agentId: d.agentId, agentName: d.agentName, status: d.agentStatus, updatedAt: d.updatedAt },
          message: 'Agentを更新しました（AgentCore）',
        });
      }
      case 'delete': {
        const agentId = String(body.agentId || '');
        if (!agentId) return NextResponse.json({ success: false, error: 'Agent IDが必要です' }, { status: 400 });
        await deleteDefinition(agentId);
        return NextResponse.json({ success: true, message: 'Agentを削除しました', agentId });
      }
      case 'listActionGroups': {
        const d = await getDefinition(String(body.agentId || ''));
        const actionGroups = (d?.tools || []).map((name) => ({
          actionGroupId: name,
          actionGroupName: name,
          actionGroupState: 'ENABLED',
          description: 'Knowledge Base search filtered by the signed-in user\'s SIDs (AgentCore Gateway tool)',
        }));
        return NextResponse.json({ success: true, actionGroups, message: 'Action Group一覧取得完了' });
      }
      case 'listAvailableActionGroups':
        return NextResponse.json({
          success: true,
          actionGroups: AVAILABLE_TOOLS.map((name) => ({
            name,
            descriptionKey: 'permissionAwareSearch',
            description: 'SID-based permission-aware document search (AgentCore Gateway tool).',
            isDefault: true,
          })),
          message: '利用可能なツール一覧（AgentCore）',
        });
      case 'listAgentKnowledgeBases': {
        const d = await getDefinition(String(body.agentId || ''));
        const knowledgeBases = (d?.knowledgeBaseIds || [process.env.BEDROCK_KB_ID || ''])
          .filter(Boolean)
          .map((knowledgeBaseId) => ({ knowledgeBaseId, knowledgeBaseState: 'ENABLED', description: 'Searched through the permission-aware tool' }));
        return NextResponse.json({ success: true, knowledgeBases });
      }
      case 'associateKnowledgeBase':
      case 'disassociateKnowledgeBase': {
        const d = await getDefinition(String(body.agentId || ''));
        const kbId = String(body.knowledgeBaseId || '');
        if (!d || !kbId) return NextResponse.json({ success: false, error: 'agentId and knowledgeBaseId are required' }, { status: 400 });
        const current = new Set(d.knowledgeBaseIds || []);
        if (action === 'associateKnowledgeBase') current.add(kbId);
        else current.delete(kbId);
        await saveDefinition({ ...d, knowledgeBaseIds: [...current], updatedAt: new Date().toISOString() });
        return NextResponse.json({ success: true, message: action === 'associateKnowledgeBase' ? 'KBを関連付けました' : 'KBの関連付けを解除しました' });
      }
      default:
        return null;
    }
  } catch (error) {
    return fail(error);
  }
}

// --- Routes other than /api/bedrock/agent ------------------------------------------------

/** `/api/bedrock/agents/list` and `/api/bedrock/agent/list`. */
export async function listResponse() {
  try {
    const agents = (await listDefinitions()).map(toSummary);
    return NextResponse.json({ success: true, agents, count: agents.length, region: process.env.AWS_REGION || 'ap-northeast-1', nextToken: null, backend: 'agentcore' });
  } catch (error) {
    return fail(error);
  }
}

/** `DELETE /api/bedrock/agents/delete?agentId=` */
export async function deleteResponse(agentId: string | null) {
  if (!agentId) return NextResponse.json({ success: false, error: 'agentIdパラメータが必要です' }, { status: 400 });
  try {
    await deleteDefinition(agentId);
    return NextResponse.json({ success: true, message: `Agent ${agentId} を削除しました`, agentId });
  } catch (error) {
    return fail(error);
  }
}

/** `POST /api/bedrock/create-agent` (the creation wizard). */
export async function wizardCreateResponse(body: Record<string, unknown>) {
  try {
    const d = await saveDefinition(
      buildDefinition({
        agentName: body.name,
        description: body.description,
        instruction: body.instructions ?? body.instruction,
        foundationModel: body.foundationModel,
        tools: [...AVAILABLE_TOOLS],
      }),
    );
    const kbIds = Array.isArray(body.knowledgeBaseIds) ? body.knowledgeBaseIds.filter((k): k is string => typeof k === 'string') : [];
    if (kbIds.length > 0) await saveDefinition({ ...d, knowledgeBaseIds: kbIds });
    return NextResponse.json({
      success: true,
      message: 'Agentが正常に作成されました',
      agentId: d.agentId,
      aliasId: null,
      data: {
        agent: { agentId: d.agentId, agentName: d.agentName, description: d.description, foundationModel: d.foundationModel, agentStatus: d.agentStatus, createdAt: d.createdAt },
        alias: null,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

/** `GET /api/bedrock/agent-creation-status?agentId=`: a definition is ready when saved. */
export async function creationStatusResponse(agentId: string | null) {
  if (!agentId) return NextResponse.json({ success: false, error: 'agentIdパラメータが必要です' }, { status: 400 });
  try {
    const d = await getDefinition(agentId);
    if (!d) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    return NextResponse.json({
      success: true,
      status: {
        agentId,
        agentStatus: d.agentStatus,
        aliasStatus: 'PREPARED',
        agentCreated: true,
        creatingAgent: false,
        aliasCreated: true,
        creatingAlias: false,
        knowledgeBaseAssociated: true,
        associatingKnowledgeBase: false,
        agentPrepared: true,
        preparingAgent: false,
        validated: true,
        validating: false,
        isCompleted: true,
        hasFailed: false,
        errors: null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        foundationModel: d.foundationModel,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

/** `POST /api/bedrock/update-agent-model` */
export async function updateModelResponse(body: Record<string, unknown>) {
  const agentId = String(body.agentId || 'rag-default');
  const modelId = typeof body.modelId === 'string' ? body.modelId : '';
  if (!modelId) return NextResponse.json({ success: false, error: 'modelIdが必要です' }, { status: 400 });
  try {
    const existing = await getDefinition(agentId);
    if (!existing) return NextResponse.json({ success: false, error: `Agent ID "${agentId}" が見つかりません` }, { status: 404 });
    const previousModel = existing.foundationModel || '';
    const d = previousModel === modelId ? existing : await saveDefinition(buildDefinition({ foundationModel: modelId }, existing));
    return NextResponse.json({
      success: true,
      message: previousModel === modelId ? 'モデルは既に選択されています' : `モデルを ${modelId} に変更しました`,
      data: { agentId, previousModel, newModel: d.foundationModel, changed: previousModel !== modelId, agentStatus: d.agentStatus, updatedAt: d.updatedAt },
    });
  } catch (error) {
    return fail(error);
  }
}

/** `GET /api/bedrock/agent-info?agentId=` */
export async function infoResponse(agentId: string | null) {
  try {
    const d = agentId ? await getDefinition(agentId) : (await getDefinition('rag-default')) ?? (await listDefinitions())[0] ?? null;
    if (!d) return NextResponse.json({ success: false, error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: {
        agentId: d.agentId,
        agentName: d.agentName,
        description: d.description || null,
        aliasId: null,
        aliasName: null,
        version: '1',
        status: d.agentStatus,
        foundationModel: d.foundationModel,
        region: process.env.AWS_REGION || 'ap-northeast-1',
        lastUpdated: d.updatedAt,
        createdAt: d.createdAt,
        preparedAt: d.updatedAt,
        backend: 'agentcore',
      },
    });
  } catch (error) {
    return fail(error);
  }
}
