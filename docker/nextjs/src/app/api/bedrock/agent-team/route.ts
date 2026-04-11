/**
 * Agent Team CRUD API
 *
 * POST /api/bedrock/agent-team
 *
 * Agent Teamの作成・取得・更新・削除・一覧操作を提供する。
 * リクエストボディの `action` フィールドで操作を切り替える。
 *
 * Requirements: 14.1, 14.2, 14.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { AgentTeamConfig, CollaboratorConfig } from '@/types/multi-agent';
import {
  isValidRoutingMode,
  isValidCollaboratorRole,
  isValidToolProfile,
  isValidTrustLevel,
  isValidDataBoundary,
} from '@/types/multi-agent';

// ===== Configuration =====

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const AGENT_TEAM_TABLE = process.env.AGENT_TEAM_TABLE_NAME || 'permission-aware-rag-agent-teams';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// ===== DynamoDB Client (lazy init) =====

let docClient: DynamoDBDocumentClient | null = null;

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

/**
 * Cognito JWT認証ミドルウェア
 * Authorization ヘッダーの Bearer トークンを検証する。
 */
async function authenticateRequest(request: NextRequest): Promise<AuthResult | null> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return null;
    }
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

// ===== Validation Helpers =====

function validateCollaborator(c: any, index: number): string | null {
  // agentId/agentAliasId are optional — auto-assigned when team is used with actual Bedrock Agents
  if (!c.agentName || typeof c.agentName !== 'string') {
    return `collaborators[${index}].agentName is required`;
  }
  if (!c.role || !isValidCollaboratorRole(c.role)) {
    return `collaborators[${index}].role is invalid (must be permission-resolver|retrieval|analysis|output|vision)`;
  }
  if (!c.foundationModel || typeof c.foundationModel !== 'string') {
    return `collaborators[${index}].foundationModel is required`;
  }
  if (c.trustLevel && !isValidTrustLevel(c.trustLevel)) {
    return `collaborators[${index}].trustLevel is invalid`;
  }
  if (c.dataBoundary && !isValidDataBoundary(c.dataBoundary)) {
    return `collaborators[${index}].dataBoundary is invalid`;
  }
  if (c.toolProfiles && Array.isArray(c.toolProfiles)) {
    for (const tp of c.toolProfiles) {
      if (!isValidToolProfile(tp)) {
        return `collaborators[${index}].toolProfiles contains invalid value: ${tp}`;
      }
    }
  }
  return null;
}

function validateCreateBody(body: any): string | null {
  if (!body.teamName || typeof body.teamName !== 'string' || body.teamName.trim().length < 2) {
    return 'teamName is required (min 2 characters)';
  }
  if (!body.description || typeof body.description !== 'string') {
    return 'description is required';
  }
  // supervisorAgentId/supervisorAliasId are optional — auto-filled from env vars if not provided
  if (body.routingMode && !isValidRoutingMode(body.routingMode)) {
    return 'routingMode must be supervisor_router or supervisor';
  }
  if (!Array.isArray(body.collaborators) || body.collaborators.length === 0) {
    return 'collaborators array is required and must not be empty';
  }
  for (let i = 0; i < body.collaborators.length; i++) {
    const err = validateCollaborator(body.collaborators[i], i);
    if (err) return err;
  }
  return null;
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
    const { action } = body;

    switch (action) {
      case 'create':
        return await handleCreate(body, auth);
      case 'get':
        return await handleGet(body);
      case 'update':
        return await handleUpdate(body, auth);
      case 'delete':
        return await handleDelete(body);
      case 'list':
        return await handleList();
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[Agent Team API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ===== Action Handlers =====

/**
 * Agent Team 作成
 * Requirement 14.1
 */
async function handleCreate(body: any, auth: AuthResult): Promise<NextResponse> {
  const validationError = validateCreateBody(body);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  const now = new Date().toISOString();
  const teamId = `team-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const collaborators: CollaboratorConfig[] = body.collaborators.map((c: any) => ({
    agentId: c.agentId,
    agentAliasId: c.agentAliasId,
    agentName: c.agentName,
    role: c.role,
    foundationModel: c.foundationModel,
    toolProfiles: c.toolProfiles || [],
    trustLevel: c.trustLevel || 'user-safe',
    dataBoundary: c.dataBoundary || 'public',
    instruction: c.instruction,
  }));

  const teamConfig: AgentTeamConfig = {
    teamId,
    teamName: body.teamName.trim(),
    description: body.description.trim(),
    supervisorAgentId: body.supervisorAgentId || process.env.SUPERVISOR_AGENT_ID || 'pending',
    supervisorAliasId: body.supervisorAliasId || process.env.SUPERVISOR_AGENT_ALIAS_ID || 'pending',
    routingMode: body.routingMode || 'supervisor_router',
    autoRouting: body.autoRouting ?? false,
    collaborators,
    versionLabel: body.versionLabel,
    createdAt: now,
    updatedAt: now,
  };

  const client = getDocClient();
  await client.send(
    new PutCommand({
      TableName: AGENT_TEAM_TABLE,
      Item: {
        ...teamConfig,
        createdBy: auth.username,
      },
      ConditionExpression: 'attribute_not_exists(teamId)',
    }),
  );

  console.log(`[Agent Team API] Created team: ${teamId} by ${auth.username}`);

  return NextResponse.json({ success: true, team: teamConfig });
}

/**
 * Agent Team 取得
 * Requirement 14.1
 */
async function handleGet(body: any): Promise<NextResponse> {
  const { teamId } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 });
  }

  const client = getDocClient();
  const result = await client.send(
    new GetCommand({
      TableName: AGENT_TEAM_TABLE,
      Key: { teamId },
    }),
  );

  if (!result.Item) {
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, team: result.Item as AgentTeamConfig });
}

/**
 * Agent Team 更新
 * Requirement 14.1
 */
async function handleUpdate(body: any, auth: AuthResult): Promise<NextResponse> {
  const { teamId } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 });
  }

  // Build update expression dynamically from allowed fields
  const allowedFields: Record<string, string> = {
    teamName: 'teamName',
    description: 'description',
    supervisorAgentId: 'supervisorAgentId',
    supervisorAliasId: 'supervisorAliasId',
    routingMode: 'routingMode',
    autoRouting: 'autoRouting',
    collaborators: 'collaborators',
    versionLabel: 'versionLabel',
  };

  const expressionParts: string[] = ['#updatedAt = :updatedAt', '#updatedBy = :updatedBy'];
  const attrNames: Record<string, string> = {
    '#updatedAt': 'updatedAt',
    '#updatedBy': 'updatedBy',
  };
  const attrValues: Record<string, any> = {
    ':updatedAt': new Date().toISOString(),
    ':updatedBy': auth.username,
  };

  for (const [key, dbField] of Object.entries(allowedFields)) {
    if (body[key] !== undefined) {
      // Validate specific fields
      if (key === 'routingMode' && !isValidRoutingMode(body[key])) {
        return NextResponse.json(
          { success: false, error: 'routingMode must be supervisor_router or supervisor' },
          { status: 400 },
        );
      }
      if (key === 'collaborators') {
        if (!Array.isArray(body[key]) || body[key].length === 0) {
          return NextResponse.json(
            { success: false, error: 'collaborators must be a non-empty array' },
            { status: 400 },
          );
        }
        for (let i = 0; i < body[key].length; i++) {
          const err = validateCollaborator(body[key][i], i);
          if (err) {
            return NextResponse.json({ success: false, error: err }, { status: 400 });
          }
        }
      }

      const placeholder = `#${key}`;
      const valuePlaceholder = `:${key}`;
      expressionParts.push(`${placeholder} = ${valuePlaceholder}`);
      attrNames[placeholder] = dbField;
      attrValues[valuePlaceholder] = body[key];
    }
  }

  const client = getDocClient();
  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: AGENT_TEAM_TABLE,
        Key: { teamId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: attrNames,
        ExpressionAttributeValues: attrValues,
        ConditionExpression: 'attribute_exists(teamId)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    console.log(`[Agent Team API] Updated team: ${teamId} by ${auth.username}`);
    return NextResponse.json({ success: true, team: result.Attributes as AgentTeamConfig });
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }
    throw err;
  }
}

/**
 * Agent Team 削除
 * Requirement 14.1
 */
async function handleDelete(body: any): Promise<NextResponse> {
  const { teamId } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 });
  }

  const client = getDocClient();
  await client.send(
    new DeleteCommand({
      TableName: AGENT_TEAM_TABLE,
      Key: { teamId },
    }),
  );

  console.log(`[Agent Team API] Deleted team: ${teamId}`);
  return NextResponse.json({ success: true, message: `Team ${teamId} deleted` });
}

/**
 * Agent Team 一覧
 * Requirement 14.2
 */
async function handleList(): Promise<NextResponse> {
  const client = getDocClient();
  const result = await client.send(
    new ScanCommand({
      TableName: AGENT_TEAM_TABLE,
      Limit: 100,
    }),
  );

  const teams = (result.Items || []) as AgentTeamConfig[];
  return NextResponse.json({ success: true, teams });
}
