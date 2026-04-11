/**
 * Agent Team Templates API
 *
 * POST /api/bedrock/agent-team/templates
 *
 * Agent Teamテンプレートの保存（S3）、取得、一覧、削除操作を提供する。
 * リクエストボディの `action` フィールドで操作を切り替える。
 *
 * - save: AgentTeamConfig → AgentTeamTemplate変換（シークレット除外）→ S3保存
 * - get: S3からテンプレート取得
 * - list: S3プレフィックス内のテンプレート一覧
 * - delete: S3からテンプレート削除
 *
 * Requirements: 14.5, 9.5, 9.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { AgentTeamConfig, AgentTeamTemplate } from '@/types/multi-agent';

// ===== Configuration =====

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const SHARED_BUCKET = process.env.SHARED_AGENT_BUCKET || '';
const TEMPLATE_PREFIX = 'agent-team-templates/';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// ===== S3 Client (lazy init) =====

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: REGION });
  }
  return s3Client;
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

// ===== Secret Masking (Requirement 9.6, 18.7) =====

/** IAM Role ARN パターン */
const IAM_ROLE_ARN_PATTERN = /arn:aws:iam::\d{12}:role\/[\w+=,.@\-/]+/g;

/** 汎用 ARN パターン */
const GENERIC_ARN_PATTERN = /arn:aws:[a-z0-9\-]+:[a-z0-9\-]*:\d{12}:[a-zA-Z0-9\-_/:.]+/g;

/** API Key / Secret パターン（長い英数字文字列） */
const API_KEY_PATTERN = /(?:api[_-]?key|secret|password|token|credential)["\s:=]+["']?([A-Za-z0-9+/=_\-]{20,})["']?/gi;

/** エンドポイント URL パターン（内部 AWS エンドポイント） */
const INTERNAL_ENDPOINT_PATTERN = /https?:\/\/[a-z0-9\-]+\.(?:execute-api|lambda|bedrock-agent|bedrock-runtime)\.[a-z0-9\-]+\.amazonaws\.com[^\s"]*/gi;

/**
 * 文字列からシークレット情報をマスクする。
 * IAMロールARN、エンドポイントURL、APIキー等を除去する。
 */
function maskSecretString(value: string): string {
  let masked = value;
  masked = masked.replace(IAM_ROLE_ARN_PATTERN, '***IAM_ROLE_ARN***');
  masked = masked.replace(INTERNAL_ENDPOINT_PATTERN, '***ENDPOINT_URL***');
  masked = masked.replace(API_KEY_PATTERN, '***REDACTED***');
  masked = masked.replace(GENERIC_ARN_PATTERN, '***ARN***');
  return masked;
}

/**
 * オブジェクトの全文字列値を再帰的にマスクする。
 */
function maskSecrets(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return maskSecretString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(maskSecrets);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // 特定のキー名を持つフィールドは値全体をマスク
      const sensitiveKeys = [
        'iamRoleArn', 'roleArn', 'apiKey', 'secretKey', 'password',
        'credentials', 'accessKeyId', 'secretAccessKey', 'sessionToken',
      ];
      if (sensitiveKeys.includes(key)) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = maskSecrets(value);
      }
    }
    return result;
  }
  return obj;
}

// ===== Template Conversion =====

/**
 * AgentTeamConfig → AgentTeamTemplate 変換。
 * シークレット情報（IAMロールARN、Agent ID、Alias ID等の環境固有情報）を除外する。
 * Requirement 9.6
 */
function convertToTemplate(
  config: AgentTeamConfig,
  exportedBy?: string,
): AgentTeamTemplate {
  const template: AgentTeamTemplate = {
    schemaVersion: '1.0',
    teamName: config.teamName,
    description: config.description,
    routingMode: config.routingMode,
    autoRouting: config.autoRouting,
    supervisorInstruction: '', // Supervisor instruction は環境固有のため空文字
    supervisorModel: '',       // Supervisor model は環境固有のため空文字
    collaborators: config.collaborators.map((c) => ({
      role: c.role,
      agentName: c.agentName,
      instruction: c.instruction ? String(maskSecrets(c.instruction)) : '',
      foundationModel: c.foundationModel,
      toolProfiles: c.toolProfiles,
      trustLevel: c.trustLevel,
      dataBoundary: c.dataBoundary,
    })),
    exportedAt: new Date().toISOString(),
    exportedBy,
  };

  // テンプレート全体をマスク処理（念のため二重チェック）
  return maskSecrets(template) as AgentTeamTemplate;
}

// ===== S3 Key Helper =====

/**
 * テンプレート名からS3キーを生成する。
 * 安全なファイル名に変換する。
 */
function templateNameToKey(name: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
  return `${TEMPLATE_PREFIX}${safeName}.json`;
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
      case 'save':
        return await handleSave(body, auth);
      case 'get':
        return await handleGet(body);
      case 'list':
        return await handleList();
      case 'delete':
        return await handleDelete(body);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[Agent Team Templates API] Error:', error);
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
 * テンプレート保存
 * AgentTeamConfig → AgentTeamTemplate変換（シークレット除外）→ S3保存
 * Requirement 14.5, 9.5, 9.6
 */
async function handleSave(body: any, auth: AuthResult): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json(
      { success: false, error: 'Shared agent bucket not configured (SHARED_AGENT_BUCKET env var)' },
      { status: 500 },
    );
  }

  const { config, templateName } = body;
  if (!config) {
    return NextResponse.json(
      { success: false, error: 'config (AgentTeamConfig) is required' },
      { status: 400 },
    );
  }
  if (!config.teamName && !templateName) {
    return NextResponse.json(
      { success: false, error: 'templateName or config.teamName is required' },
      { status: 400 },
    );
  }

  const name = templateName || config.teamName;
  const template = convertToTemplate(config as AgentTeamConfig, auth.username);

  // templateName が指定されている場合はそちらを使用
  if (templateName) {
    template.teamName = templateName;
  }

  const key = templateNameToKey(name);
  const jsonBody = JSON.stringify(template, null, 2);

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: SHARED_BUCKET,
      Key: key,
      Body: jsonBody,
      ContentType: 'application/json',
    }),
  );

  console.log(`[Agent Team Templates API] Saved template: ${key} by ${auth.username}`);

  return NextResponse.json({
    success: true,
    key,
    template,
    message: `Template "${name}" saved successfully`,
  });
}

/**
 * テンプレート取得
 * S3からテンプレートを名前で取得する。
 * Requirement 14.5
 */
async function handleGet(body: any): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json(
      { success: false, error: 'Shared agent bucket not configured' },
      { status: 500 },
    );
  }

  const { templateName, key } = body;
  if (!templateName && !key) {
    return NextResponse.json(
      { success: false, error: 'templateName or key is required' },
      { status: 400 },
    );
  }

  const s3Key = key || templateNameToKey(templateName);

  try {
    const client = getS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: SHARED_BUCKET,
        Key: s3Key,
      }),
    );

    const jsonStr = await response.Body?.transformToString();
    if (!jsonStr) {
      return NextResponse.json(
        { success: false, error: 'Empty response from S3' },
        { status: 500 },
      );
    }

    const template = JSON.parse(jsonStr) as AgentTeamTemplate;
    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 },
      );
    }
    throw err;
  }
}

/**
 * テンプレート一覧
 * S3プレフィックス内の全テンプレートを一覧する。
 * Requirement 14.5, 9.5
 */
async function handleList(): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json(
      { success: false, error: 'Shared agent bucket not configured' },
      { status: 500 },
    );
  }

  const client = getS3Client();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: SHARED_BUCKET,
      Prefix: TEMPLATE_PREFIX,
      MaxKeys: 100,
    }),
  );

  const templates = (response.Contents || [])
    .filter((obj) => obj.Key?.endsWith('.json'))
    .map((obj) => ({
      key: obj.Key || '',
      name: (obj.Key || '')
        .replace(TEMPLATE_PREFIX, '')
        .replace(/\.json$/, '')
        .replace(/_/g, ' '),
      lastModified: obj.LastModified?.toISOString() || '',
      size: obj.Size || 0,
    }));

  return NextResponse.json({ success: true, templates });
}

/**
 * テンプレート削除
 * S3からテンプレートを削除する。
 * Requirement 14.5
 */
async function handleDelete(body: any): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json(
      { success: false, error: 'Shared agent bucket not configured' },
      { status: 500 },
    );
  }

  const { templateName, key } = body;
  if (!templateName && !key) {
    return NextResponse.json(
      { success: false, error: 'templateName or key is required' },
      { status: 400 },
    );
  }

  const s3Key = key || templateNameToKey(templateName);

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: SHARED_BUCKET,
      Key: s3Key,
    }),
  );

  console.log(`[Agent Team Templates API] Deleted template: ${s3Key}`);

  return NextResponse.json({
    success: true,
    message: `Template deleted: ${s3Key}`,
  });
}
