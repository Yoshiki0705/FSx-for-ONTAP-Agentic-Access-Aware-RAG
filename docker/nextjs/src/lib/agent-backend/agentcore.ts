/**
 * Agent backend on Amazon Bedrock AgentCore (`AGENT_BACKEND=agentcore`, the default).
 *
 * Agents and teams created on screen are definitions in DynamoDB. Running one sends the
 * definition with the user's message to the single generic agent on AgentCore Runtime
 * (`docker/agentcore-agent`), which searches through the permission-aware tool. There is
 * no per-agent AWS resource, so an agent is ready as soon as it is saved: its status is
 * always `PREPARED`, and the creation-progress screens complete at once.
 *
 * The responses keep the shapes the screens already read from the Bedrock Agents
 * handlers (`agentSummaries`-like lists, `agent` objects, `answer` + `metadata`), so the
 * components do not branch on the backend.
 */
import { randomUUID } from 'crypto';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { AgentTeamConfig, MultiAgentTraceResult } from '@/types/multi-agent';
import { INFERENCE_PROFILE_MAP, resolveModelId } from '@/config/model-defaults';

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
export const DEFAULT_MODEL = 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;
const MAX_INSTRUCTION = 8000;
export const AVAILABLE_TOOLS = ['PermissionAwareSearch'] as const;

let ddb: DynamoDBDocumentClient | null = null;
let runtime: BedrockAgentCoreClient | null = null;
function docClient(): DynamoDBDocumentClient {
  ddb ??= DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return ddb;
}
function runtimeClient(): BedrockAgentCoreClient {
  runtime ??= new BedrockAgentCoreClient({ region: REGION });
  return runtime;
}
/** Tests replace the clients. */
export function __setClients(clients: { ddb?: DynamoDBDocumentClient; runtime?: BedrockAgentCoreClient }): void {
  if (clients.ddb) ddb = clients.ddb;
  if (clients.runtime) runtime = clients.runtime;
}

export interface AgentDefinition {
  agentId: string;
  agentName: string;
  description?: string;
  instruction?: string;
  foundationModel?: string;
  tools?: string[];
  knowledgeBaseIds?: string[];
  guardrailId?: string;
  guardrailVersion?: string;
  category?: string;
  agentStatus: 'PREPARED';
  createdAt: string;
  updatedAt: string;
  source?: string;
}

export interface AgentInput {
  agentName?: unknown;
  description?: unknown;
  instruction?: unknown;
  foundationModel?: unknown;
  actionGroups?: unknown;
  tools?: unknown;
  guardrailId?: unknown;
  guardrailVersion?: unknown;
  category?: unknown;
}

export class ValidationError extends Error {}

export function definitionsTable(): string {
  const table = process.env.AGENT_DEFINITIONS_TABLE_NAME;
  if (!table) throw new ValidationError('AGENT_DEFINITIONS_TABLE_NAME is not set: deploy with enableAgent=true');
  return table;
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Tools from the editor: `actionGroups` (Bedrock Agents wording) or `tools`, only known names. */
export function normalizeTools(input: AgentInput): string[] | undefined {
  const raw = input.tools ?? input.actionGroups;
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((t): t is string => typeof t === 'string' && (AVAILABLE_TOOLS as readonly string[]).includes(t));
}

/** A new definition, or `existing` updated with the fields that were given. */
export function buildDefinition(input: AgentInput, existing?: AgentDefinition, now = new Date().toISOString()): AgentDefinition {
  const agentName = str(input.agentName, MAX_NAME) ?? existing?.agentName;
  if (!agentName) throw new ValidationError('agentName is required');
  const tools = normalizeTools(input) ?? existing?.tools ?? [...AVAILABLE_TOOLS];
  return {
    agentId: existing?.agentId ?? `agent-${randomUUID().slice(0, 8)}`,
    agentName,
    description: str(input.description, MAX_DESCRIPTION) ?? existing?.description,
    instruction: str(input.instruction, MAX_INSTRUCTION) ?? existing?.instruction,
    foundationModel: str(input.foundationModel, 200) ?? existing?.foundationModel ?? DEFAULT_MODEL,
    tools,
    knowledgeBaseIds: existing?.knowledgeBaseIds,
    guardrailId: str(input.guardrailId, 100) ?? existing?.guardrailId,
    guardrailVersion: str(input.guardrailVersion, 20) ?? existing?.guardrailVersion,
    category: str(input.category, 50) ?? existing?.category,
    agentStatus: 'PREPARED',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    source: existing?.source ?? 'ui',
  };
}

// --- Definitions (DynamoDB) -----------------------------------------------------------

export async function listDefinitions(): Promise<AgentDefinition[]> {
  const items: AgentDefinition[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const page = await docClient().send(new ScanCommand({ TableName: definitionsTable(), ExclusiveStartKey: start }));
    items.push(...((page.Items || []) as AgentDefinition[]));
    start = page.LastEvaluatedKey;
  } while (start);
  return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getDefinition(agentId: string): Promise<AgentDefinition | null> {
  const out = await docClient().send(new GetCommand({ TableName: definitionsTable(), Key: { agentId } }));
  return (out.Item as AgentDefinition) || null;
}

export async function saveDefinition(definition: AgentDefinition): Promise<AgentDefinition> {
  await docClient().send(new PutCommand({ TableName: definitionsTable(), Item: definition }));
  return definition;
}

export async function deleteDefinition(agentId: string): Promise<void> {
  await docClient().send(new DeleteCommand({ TableName: definitionsTable(), Key: { agentId } }));
}

// --- Shapes the screens read ----------------------------------------------------------

/** One entry of `agents` in list responses (the fields of a Bedrock `AgentSummary`). */
export function toSummary(d: AgentDefinition) {
  return {
    agentId: d.agentId,
    agentName: d.agentName,
    agentStatus: d.agentStatus,
    status: d.agentStatus,
    description: d.description,
    updatedAt: d.updatedAt,
    latestAgentVersion: '1',
    foundationModel: d.foundationModel,
    category: d.category,
    backend: 'agentcore',
  };
}

/** The `agent` of get responses (the fields of a Bedrock `Agent` the screens use). */
export function toAgent(d: AgentDefinition) {
  return {
    ...toSummary(d),
    instruction: d.instruction,
    createdAt: d.createdAt,
    preparedAt: d.updatedAt,
    tools: d.tools,
    knowledgeBaseIds: d.knowledgeBaseIds,
    ...(d.guardrailId
      ? { guardrailConfiguration: { guardrailIdentifier: d.guardrailId, guardrailVersion: d.guardrailVersion || 'DRAFT' } }
      : {}),
  };
}

// --- Runtime -------------------------------------------------------------------------

export interface RuntimeAnswer {
  answer: string;
  searches?: { query: string; count: number; files: string[]; filterMethod?: string }[];
  collaborators?: string[];
  error?: string;
}

/** AgentCore requires a session ID of at least 33 characters. */
export function runtimeSessionId(sessionId: string | undefined, userId: string): string {
  const base = (sessionId || `session-${userId}-${Date.now()}`).replace(/[^0-9a-zA-Z._:-]/g, '-');
  return base.length >= 33 ? base.slice(0, 256) : `${base}-${randomUUID()}`.slice(0, 256);
}

export async function invokeRuntime(payload: Record<string, unknown>, sessionId: string): Promise<RuntimeAnswer> {
  const arn = process.env.AGENT_RUNTIME_ARN;
  if (!arn) throw new ValidationError('AGENT_RUNTIME_ARN is not set: deploy with enableAgent=true');
  const out = await runtimeClient().send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: arn,
      runtimeSessionId: sessionId,
      contentType: 'application/json',
      accept: 'application/json',
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
  const text = out.response ? await out.response.transformToString() : '';
  let parsed: RuntimeAnswer;
  try {
    parsed = JSON.parse(text) as RuntimeAnswer;
  } catch {
    parsed = { answer: text };
  }
  if (parsed.error) throw new Error(`Agent runtime: ${parsed.error}`);
  return parsed;
}

export async function invokeAgent(params: {
  agentId?: string;
  message: string;
  userId: string;
  sessionId?: string;
}): Promise<{ definition: AgentDefinition; result: RuntimeAnswer; sessionId: string }> {
  const definition = params.agentId ? await getDefinition(params.agentId) : await defaultDefinition();
  if (!definition) throw new ValidationError(`Agent not found: ${params.agentId}`);
  const sessionId = runtimeSessionId(params.sessionId, params.userId);
  const result = await invokeRuntime(
    {
      mode: 'single',
      agent: {
        agentName: definition.agentName,
        instruction: definition.instruction,
        foundationModel: runtimeModelId(definition.foundationModel),
        tools: definition.tools,
      },
      message: params.message,
      userId: params.userId,
    },
    sessionId,
  );
  return { definition, result, sessionId };
}

/**
 * The model ID the Runtime calls. Definitions keep what the user picked; templates and the
 * editor offer base IDs (`anthropic.claude-haiku-4-5-...`), which have no on-demand
 * throughput in ap-northeast-1 and fail with "The provided model identifier is invalid".
 * Deprecated IDs are redirected first, then base IDs are mapped to their inference profile.
 */
export function runtimeModelId(id: string | undefined): string {
  const { modelId } = resolveModelId(id || DEFAULT_MODEL);
  return INFERENCE_PROFILE_MAP[modelId] ?? modelId;
}

async function defaultDefinition(): Promise<AgentDefinition | null> {
  return (await getDefinition('rag-default')) ?? (await listDefinitions())[0] ?? null;
}

export async function invokeTeam(params: {
  team: AgentTeamConfig;
  message: string;
  userId: string;
  sessionId?: string;
}): Promise<{ result: RuntimeAnswer; trace: MultiAgentTraceResult; sessionId: string }> {
  const started = Date.now();
  const sessionId = runtimeSessionId(params.sessionId, params.userId);
  const collaborators = params.team.collaborators.map((c) => ({
    agentName: c.agentName,
    role: c.role,
    instruction: c.instruction,
    foundationModel: runtimeModelId(c.foundationModel),
    tools: [...AVAILABLE_TOOLS],
  }));
  const result = await invokeRuntime(
    {
      mode: 'team',
      team: { collaborators },
      message: params.message,
      userId: params.userId,
    },
    sessionId,
  );
  const elapsed = Date.now() - started;
  const searches = result.searches || [];
  const trace: MultiAgentTraceResult = {
    traceId: `agentcore-${randomUUID()}`,
    sessionId,
    teamId: params.team.teamId,
    routingMode: params.team.routingMode,
    routingOverheadMs: 0,
    supervisorAgentId: 'agentcore-supervisor',
    collaboratorTraces: params.team.collaborators.map((c) => ({
      collaboratorAgentId: c.agentId,
      collaboratorRole: c.role,
      collaboratorName: c.agentName,
      taskDescription: '',
      executionTimeMs: 0,
      startTimeMs: started,
      citationsReturned: searches.reduce((n, s) => n + (s.count || 0), 0),
      accessDenied: false,
      status: 'COMPLETED',
    })),
    totalExecutionTimeMs: elapsed,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCostUsd: 0,
  };
  return { result, trace, sessionId };
}
