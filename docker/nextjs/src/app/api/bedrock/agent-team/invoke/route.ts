/**
 * Agent Team Invoke API
 *
 * POST /api/bedrock/agent-team/invoke
 *
 * Supervisor Agent を呼び出し、マルチエージェント協調処理を実行する。
 * レスポンスのストリーミングイベントからテキストとトレースデータを収集し、
 * MultiAgentTraceResult として返却する。
 *
 * Requirements: 14.3, 14.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type {
  AgentTeamConfig,
  AgentTeamTraceEvent,
  MultiAgentTraceResult,
  CollaboratorRole,
} from '@/types/multi-agent';
import { calculateEstimatedCost } from '@/types/multi-agent';

// ===== Configuration =====

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const AGENT_TEAM_TABLE = process.env.AGENT_TEAM_TABLE_NAME || 'permission-aware-rag-agent-teams';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// ===== Clients (lazy init) =====

let runtimeClient: BedrockAgentRuntimeClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

function getRuntimeClient(): BedrockAgentRuntimeClient {
  if (!runtimeClient) {
    runtimeClient = new BedrockAgentRuntimeClient({ region: REGION });
  }
  return runtimeClient;
}

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const ddbClient = new DynamoDBClient({ region: REGION });
    docClient = DynamoDBDocumentClient.from(ddbClient);
  }
  return docClient;
}

// ===== Auth Helper =====

interface AuthResult {
  userId: string;
  username: string;
}

async function authenticateRequest(request: NextRequest): Promise<AuthResult | null> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;
    const jwtSecret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, jwtSecret);
    return {
      userId: payload.userId as string,
      username: payload.username as string,
    };
  } catch {
    return null;
  }
}


// ===== Team Config Lookup =====

async function getTeamConfig(teamId: string): Promise<AgentTeamConfig | null> {
  const client = getDocClient();
  const result = await client.send(
    new GetCommand({
      TableName: AGENT_TEAM_TABLE,
      Key: { teamId },
    }),
  );
  return (result.Item as AgentTeamConfig) ?? null;
}

// ===== Trace Parsing Helpers =====

/**
 * Bedrock Agent ストリーミングトレースイベントから
 * Collaborator 実行情報を抽出し AgentTeamTraceEvent[] を構築する。
 *
 * Bedrock Agent Supervisor のトレース構造:
 * - modelInvocationInput → modelInvocationOutput (usage付き) → rationale のサイクル
 * - collaboratorInvocationInput/Output は Supervisor 内部で処理され、
 *   ストリーミングトレースには直接含まれない場合がある
 * - rationale テキストから Collaborator 呼び出し意図を推定
 * - modelInvocationOutput.metadata.usage からトークン使用量を集計
 */
function buildCollaboratorTraces(
  rawTraces: any[],
  teamConfig: AgentTeamConfig,
): AgentTeamTraceEvent[] {
  const collaboratorTraces: AgentTeamTraceEvent[] = [];

  // === Strategy 1: 明示的な collaboratorInvocationInput/Output を検出 ===
  // orchestrationTrace と routingClassifierTrace の両方を検索
  for (const traceEntry of rawTraces) {
    const traceData = traceEntry?.trace;
    if (!traceData) continue;

    // orchestrationTrace または routingClassifierTrace を検索
    const searchTraces = [traceData.orchestrationTrace, traceData.routingClassifierTrace].filter(Boolean);

    for (const st of searchTraces) {
      const invocationInput = st.invocationInput;

      // collaboratorInvocationInput or agentCollaboratorInvocationInput
      const collabInput = invocationInput?.collaboratorInvocationInput
        || invocationInput?.agentCollaboratorInvocationInput;

      if (collabInput) {
        const collaboratorName = collabInput.agentCollaboratorName || collabInput.agentId || '';
        const collaboratorAliasArn = collabInput.agentCollaboratorAliasArn || '';
        const arnParts = collaboratorAliasArn.split('/');
        const extractedAgentId = arnParts.length >= 2 ? arnParts[arnParts.length - 2] : (collabInput.agentId || '');
        const extractedAliasId = arnParts.length >= 2 ? arnParts[arnParts.length - 1] : (collabInput.agentAliasId || '');

        const matchedCollaborator = teamConfig.collaborators.find(
          (c) => c.agentId === extractedAgentId || c.agentName === collaboratorName || c.name === collaboratorName,
        );

        const inputText = collabInput.input?.text || (typeof collabInput.input === 'string' ? collabInput.input : '');

        collaboratorTraces.push({
          collaboratorAgentId: extractedAgentId,
          collaboratorAgentAliasId: extractedAliasId,
          collaboratorRole: matchedCollaborator?.role || ('unknown' as CollaboratorRole),
          collaboratorName: collaboratorName || matchedCollaborator?.agentName || extractedAgentId,
          taskDescription: inputText,
          inputContext: inputText ? { text: inputText } : undefined,
          executionTimeMs: 0,
          startTimeMs: Date.now(),
          accessDenied: false,
          status: 'IN_PROGRESS',
        });
      }

      // collaboratorInvocationOutput or agentCollaboratorInvocationOutput
      const collabOutput = st.observation?.collaboratorInvocationOutput
        || st.observation?.agentCollaboratorInvocationOutput;

      if (collabOutput) {
        const outputName = collabOutput.agentCollaboratorName || collabOutput.agentId || '';
        const outputAliasArn = collabOutput.agentCollaboratorAliasArn || '';
        const outputArnParts = outputAliasArn.split('/');
        const outputAgentId = outputArnParts.length >= 2 ? outputArnParts[outputArnParts.length - 2] : '';

        const existingTrace = collaboratorTraces.find(
          (t) => (t.collaboratorAgentId === outputAgentId || t.collaboratorName === outputName) && t.status === 'IN_PROGRESS',
        );
        if (existingTrace) {
          existingTrace.status = 'COMPLETED';
          const totalTimeMs = collabOutput.metadata?.totalTimeMs || (Date.now() - existingTrace.startTimeMs);
          existingTrace.executionTimeMs = totalTimeMs;
          const outputText = collabOutput.output?.text || (typeof collabOutput.output === 'string' ? collabOutput.output : '');
          existingTrace.outputContext = outputText ? { text: outputText } : undefined;
        }
      }

      // modelInvocationOutput からトークン使用量を抽出
      const modelOutput = st.modelInvocationOutput;
      if (modelOutput?.metadata?.usage) {
        const usage = modelOutput.metadata.usage;
        const lastTrace = [...collaboratorTraces].reverse().find((t) => t.status === 'IN_PROGRESS' || t.status === 'COMPLETED');
        if (lastTrace) {
          lastTrace.inputTokens = (lastTrace.inputTokens ?? 0) + (usage.inputTokens ?? 0);
          lastTrace.outputTokens = (lastTrace.outputTokens ?? 0) + (usage.outputTokens ?? 0);
        }
      }
    }
  }

  // === Strategy 2: 明示的な collaborator トレースがない場合、
  //     rationale + modelInvocationOutput から推定トレースを構築 ===
  if (collaboratorTraces.length === 0) {
    // rationale テキストから Collaborator 呼び出し意図を検出
    const rationaleTexts: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const invocationCycles: Array<{
      rationale?: string;
      inputTokens: number;
      outputTokens: number;
    }> = [];

    let currentCycle: { rationale?: string; inputTokens: number; outputTokens: number } = {
      inputTokens: 0,
      outputTokens: 0,
    };

    for (const traceEntry of rawTraces) {
      const traceData = traceEntry?.trace;
      if (!traceData?.orchestrationTrace) continue;

      const orch = traceData.orchestrationTrace;

      if (orch.modelInvocationOutput?.metadata?.usage) {
        const usage = orch.modelInvocationOutput.metadata.usage;
        currentCycle.inputTokens = usage.inputTokens ?? 0;
        currentCycle.outputTokens = usage.outputTokens ?? 0;
        totalInputTokens += currentCycle.inputTokens;
        totalOutputTokens += currentCycle.outputTokens;
      }

      if (orch.rationale?.text) {
        currentCycle.rationale = orch.rationale.text;
        rationaleTexts.push(orch.rationale.text);
        invocationCycles.push({ ...currentCycle });
        currentCycle = { inputTokens: 0, outputTokens: 0 };
      }
    }

    // teamConfig の collaborator 情報を使って推定トレースを構築
    // rationale テキストから各 collaborator の呼び出しを推定
    const collaboratorNames = teamConfig.collaborators.map((c) => ({
      name: c.agentName || c.name,
      role: c.role,
      agentId: c.agentId || '',
    }));

    // 各 collaborator に対して、rationale テキストにマッチするものを検出
    const matchedCollaborators = new Set<string>();
    for (const rationale of rationaleTexts) {
      const lowerRationale = rationale.toLowerCase();
      for (const collab of collaboratorNames) {
        const lowerName = collab.name.toLowerCase();
        const lowerRole = (collab.role || '').toLowerCase();
        if (
          lowerRationale.includes(lowerName) ||
          lowerRationale.includes(lowerRole) ||
          lowerRationale.includes('permission') ||
          lowerRationale.includes('retriev') ||
          lowerRationale.includes('analy') ||
          lowerRationale.includes('output') ||
          lowerRationale.includes('search') ||
          lowerRationale.includes('resolve')
        ) {
          matchedCollaborators.add(collab.agentId || collab.name);
        }
      }
    }

    // マッチした collaborator がない場合、全 collaborator を推定トレースとして追加
    const collaboratorsToAdd = matchedCollaborators.size > 0
      ? teamConfig.collaborators.filter((c) => matchedCollaborators.has(c.agentId || c.name))
      : teamConfig.collaborators;

    // トークンを均等に分配
    const perCollabInputTokens = collaboratorsToAdd.length > 0
      ? Math.floor(totalInputTokens / collaboratorsToAdd.length)
      : 0;
    const perCollabOutputTokens = collaboratorsToAdd.length > 0
      ? Math.floor(totalOutputTokens / collaboratorsToAdd.length)
      : 0;

    for (const collab of collaboratorsToAdd) {
      collaboratorTraces.push({
        collaboratorAgentId: collab.agentId || collab.name,
        collaboratorAgentAliasId: '',
        collaboratorRole: (collab.role || 'retrieval') as CollaboratorRole,
        collaboratorName: collab.agentName || collab.name,
        taskDescription: `Supervisor orchestrated (inferred from ${invocationCycles.length} reasoning cycles)`,
        executionTimeMs: 0,
        startTimeMs: 0,
        accessDenied: false,
        status: 'COMPLETED',
        inputTokens: perCollabInputTokens,
        outputTokens: perCollabOutputTokens,
      });
    }
  }

  // === Strategy 1 のトレースにトークン情報を付与（Strategy 1 で明示的トレースが見つかった場合のみ） ===
  // Note: Strategy 1 の for ループ内で既にトークン情報を付与しているため、
  // orchestrationTrace のみの追加トークン情報を付与
  if (collaboratorTraces.length > 0 && collaboratorTraces[0].startTimeMs > 0) {
    for (const traceEntry of rawTraces) {
      const traceData = traceEntry?.trace;
      if (!traceData?.orchestrationTrace) continue;

      const modelOutput = traceData.orchestrationTrace.modelInvocationOutput;
      if (modelOutput?.metadata?.usage) {
        const usage = modelOutput.metadata.usage;
        const lastTrace = [...collaboratorTraces]
          .reverse()
          .find((t) => t.status === 'IN_PROGRESS' || t.status === 'COMPLETED');
        if (lastTrace) {
          lastTrace.inputTokens = (lastTrace.inputTokens ?? 0) + (usage.inputTokens ?? 0);
          lastTrace.outputTokens = (lastTrace.outputTokens ?? 0) + (usage.outputTokens ?? 0);
        }
      }
    }
  }

  // 未完了のトレースをタイムアウトとしてマーク
  for (const trace of collaboratorTraces) {
    if (trace.status === 'IN_PROGRESS') {
      trace.status = 'COMPLETED';
      trace.executionTimeMs = Date.now() - trace.startTimeMs;
    }
  }

  // guardrailTrace からアクセス拒否情報を検出
  for (const traceEntry of rawTraces) {
    const guardrailTrace = traceEntry?.trace?.guardrailTrace;
    if (guardrailTrace?.action === 'BLOCKED') {
      const lastTrace = collaboratorTraces[collaboratorTraces.length - 1];
      if (lastTrace) {
        lastTrace.accessDenied = true;
        lastTrace.accessDeniedReason = 'Blocked by Guardrail';
        lastTrace.status = 'FAILED';
      }
    }
  }

  return collaboratorTraces;
}

/**
 * Guardrail 評価結果をトレースイベントから抽出する。
 */
function extractGuardrailResult(rawTraces: any[]): MultiAgentTraceResult['guardrailResult'] {
  for (const traceEntry of rawTraces) {
    const guardrailTrace = traceEntry?.trace?.guardrailTrace;
    if (!guardrailTrace) continue;

    const inputAssessment =
      guardrailTrace.inputAssessments?.[0]?.action === 'BLOCKED' ? 'BLOCKED' : 'PASSED';

    let outputAssessment: 'PASSED' | 'BLOCKED' | 'FILTERED' = 'PASSED';
    const filteredCategories: string[] = [];

    if (guardrailTrace.outputAssessments) {
      for (const assessment of guardrailTrace.outputAssessments) {
        if (assessment.action === 'BLOCKED') {
          outputAssessment = 'BLOCKED';
        } else if (assessment.action === 'FILTERED' || assessment.action === 'ANONYMIZED') {
          outputAssessment = 'FILTERED';
        }
        if (assessment.contentPolicy?.filters) {
          for (const filter of assessment.contentPolicy.filters) {
            if (filter.type) filteredCategories.push(filter.type);
          }
        }
        if (assessment.sensitiveInformationPolicy?.piiEntities) {
          for (const pii of assessment.sensitiveInformationPolicy.piiEntities) {
            if (pii.type) filteredCategories.push(pii.type);
          }
        }
      }
    }

    return {
      inputAssessment: inputAssessment as 'PASSED' | 'BLOCKED',
      outputAssessment,
      filteredCategories: filteredCategories.length > 0 ? filteredCategories : undefined,
    };
  }

  return undefined;
}

/**
 * ルーティング理由をトレースから抽出する。
 */
function extractRoutingReason(rawTraces: any[]): string | undefined {
  for (const traceEntry of rawTraces) {
    const orchestration = traceEntry?.trace?.orchestrationTrace;
    if (!orchestration?.rationale?.text) continue;
    return orchestration.rationale.text;
  }
  return undefined;
}


// ===== Route Handler =====

export async function POST(request: NextRequest) {
  try {
    // 認証チェック — ミドルウェアレベルで認証済みのため、トークンがない場合はデフォルトユーザーを使用
    const auth = await authenticateRequest(request) || {
      userId: 'anonymous',
      username: 'anonymous',
    };

    const body = await request.json();
    const { teamId, message, sessionId, userId } = body;

    // バリデーション
    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'teamId is required' },
        { status: 400 },
      );
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'message is required' },
        { status: 400 },
      );
    }

    // Team 構成を取得
    const teamConfig = await getTeamConfig(teamId);
    if (!teamConfig) {
      return NextResponse.json(
        { success: false, error: `Team not found: ${teamId}` },
        { status: 404 },
      );
    }

    const effectiveUserId = userId || auth.userId;
    const effectiveSessionId = (sessionId || `team-session-${effectiveUserId}-${Date.now()}`)
      .replace(/[^0-9a-zA-Z._:-]/g, '-');

    console.log('[Agent Team Invoke] Request:', {
      teamId,
      supervisorAgentId: teamConfig.supervisorAgentId,
      supervisorAliasId: teamConfig.supervisorAliasId,
      routingMode: teamConfig.routingMode,
      collaboratorCount: teamConfig.collaborators.length,
      userId: effectiveUserId,
      sessionId: effectiveSessionId,
      messageLength: message.length,
    });

    // Supervisor Agent 呼び出し (Requirement 14.3)
    const startTime = Date.now();

    const command = new InvokeAgentCommand({
      agentId: teamConfig.supervisorAgentId,
      agentAliasId: teamConfig.supervisorAliasId,
      sessionId: effectiveSessionId,
      inputText: message,
      enableTrace: true,
      sessionState: {
        sessionAttributes: {
          userId: effectiveUserId,
          teamId,
          routingMode: teamConfig.routingMode,
        },
      },
    });

    const client = getRuntimeClient();
    const response = await client.send(command);

    // ストリーミングレスポンスの処理
    let fullResponse = '';
    const rawTraces: any[] = [];

    if (response.completion) {
      for await (const event of response.completion) {
        // テキストチャンクの収集
        if (event.chunk?.bytes) {
          fullResponse += new TextDecoder().decode(event.chunk.bytes);
        }
        // トレースイベントの収集
        if (event.trace) {
          rawTraces.push(event.trace);
        }
      }
    }

    const totalExecutionTimeMs = Date.now() - startTime;

    // トレースデータの構築 (Requirement 14.4)
    // トレースデバッグログ（LOG_LEVEL=DEBUG 時のみ出力）
    const isDebug = process.env.LOG_LEVEL === 'DEBUG' || process.env.NODE_ENV === 'development';
    if (isDebug) {
      console.log('[Agent Team Invoke] Raw trace count:', rawTraces.length);
      for (let i = 0; i < rawTraces.length; i++) {
        const t = rawTraces[i];
        const traceData = t?.trace;
        if (traceData) {
          const keys = Object.keys(traceData);
          console.log(`[Agent Team Invoke] Trace[${i}] keys:`, keys);
          if (traceData.routingClassifierTrace) {
            console.log(`[Agent Team Invoke] Trace[${i}] routingClassifier:`,
              JSON.stringify(traceData.routingClassifierTrace).substring(0, 1000));
          }
        }
      }
    }

    const collaboratorTraces = buildCollaboratorTraces(rawTraces, teamConfig);
    const guardrailResult = extractGuardrailResult(rawTraces);
    const routingReason = extractRoutingReason(rawTraces);

    // Collaborator 実行時間の合計からルーティングオーバーヘッドを算出
    const collaboratorTotalMs = collaboratorTraces.reduce(
      (sum, t) => sum + t.executionTimeMs,
      0,
    );
    const routingOverheadMs = Math.max(0, totalExecutionTimeMs - collaboratorTotalMs);

    // トークン集計
    const totalInputTokens = collaboratorTraces.reduce(
      (sum, t) => sum + (t.inputTokens ?? 0),
      0,
    );
    const totalOutputTokens = collaboratorTraces.reduce(
      (sum, t) => sum + (t.outputTokens ?? 0),
      0,
    );

    const multiAgentTrace: MultiAgentTraceResult = {
      traceId: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      sessionId: effectiveSessionId,
      teamId,
      routingMode: teamConfig.routingMode,
      routingReason,
      routingOverheadMs,
      supervisorAgentId: teamConfig.supervisorAgentId,
      collaboratorTraces,
      guardrailResult,
      totalExecutionTimeMs,
      totalInputTokens,
      totalOutputTokens,
      estimatedCostUsd: calculateEstimatedCost(collaboratorTraces),
    };

    console.log('[Agent Team Invoke] Response:', {
      teamId,
      responseLength: fullResponse.length,
      collaboratorCount: collaboratorTraces.length,
      totalExecutionTimeMs,
      totalInputTokens,
      totalOutputTokens,
      estimatedCostUsd: multiAgentTrace.estimatedCostUsd,
    });

    return NextResponse.json({
      success: true,
      response: fullResponse || 'Agent Team処理が完了しましたが、レスポンスが空です。',
      multiAgentTrace,
    });
  } catch (error) {
    console.error('[Agent Team Invoke] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
