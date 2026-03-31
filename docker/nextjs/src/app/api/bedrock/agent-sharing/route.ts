/**
 * Agent Sharing API
 * Agent構成のエクスポート/インポート/S3共有
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { exportAgentConfig, validateAgentConfig } from '@/utils/agentConfigUtils';
import type { AgentConfig, SharedAgentConfig } from '@/types/enterprise-agent';

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const SHARED_BUCKET = process.env.SHARED_AGENT_BUCKET || '';
const s3Client = new S3Client({ region: REGION });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'exportConfig':
        return handleExportConfig(body);
      case 'importConfig':
        return handleImportConfig(body);
      case 'uploadSharedConfig':
        return await handleUploadSharedConfig(body);
      case 'listSharedConfigs':
        return await handleListSharedConfigs();
      case 'downloadSharedConfig':
        return await handleDownloadSharedConfig(body);
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Agent Sharing API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/** Convert AgentDetail → portable AgentConfig JSON */
function handleExportConfig(body: any): NextResponse {
  const { agent, exportedBy } = body;
  if (!agent) {
    return NextResponse.json({ success: false, error: 'Agent data is required' }, { status: 400 });
  }
  const config = exportAgentConfig(agent, exportedBy);
  return NextResponse.json({ success: true, config });
}

/** Validate AgentConfig JSON (no actual creation — that's done by the caller via /api/bedrock/agent) */
function handleImportConfig(body: any): NextResponse {
  const { config } = body;
  const validation = validateAgentConfig(config);
  if (!validation.valid) {
    return NextResponse.json({ success: false, error: 'Invalid agent config', details: validation.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, config, message: 'Config validated successfully' });
}

/** Upload AgentConfig JSON to S3 shared bucket */
async function handleUploadSharedConfig(body: any): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json({ success: false, error: 'Shared agent bucket not configured (SHARED_AGENT_BUCKET env var)' }, { status: 500 });
  }
  const { config, uploadedBy } = body;
  const validation = validateAgentConfig(config);
  if (!validation.valid) {
    return NextResponse.json({ success: false, error: 'Invalid agent config', details: validation.errors }, { status: 400 });
  }

  const key = `agents/${(config as AgentConfig).agentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;
  const jsonBody = JSON.stringify({ ...config, uploadedBy, uploadedAt: new Date().toISOString() }, null, 2);

  await s3Client.send(new PutObjectCommand({
    Bucket: SHARED_BUCKET,
    Key: key,
    Body: jsonBody,
    ContentType: 'application/json',
  }));

  return NextResponse.json({ success: true, key, message: 'Config uploaded to shared bucket' });
}

/** List shared configs from S3 bucket */
async function handleListSharedConfigs(): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json({ success: false, error: 'Shared agent bucket not configured' }, { status: 500 });
  }

  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: SHARED_BUCKET,
    Prefix: 'agents/',
    MaxKeys: 100,
  }));

  const configs: SharedAgentConfig[] = (response.Contents || [])
    .filter(obj => obj.Key?.endsWith('.json'))
    .map(obj => ({
      key: obj.Key || '',
      agentName: (obj.Key || '').split('/').pop()?.replace(/_\d+\.json$/, '').replace(/_/g, ' ') || '',
      description: '',
      foundationModel: '',
      uploadedAt: obj.LastModified?.toISOString() || '',
      size: obj.Size || 0,
    }));

  return NextResponse.json({ success: true, configs });
}

/** Download a specific shared config from S3 */
async function handleDownloadSharedConfig(body: any): Promise<NextResponse> {
  if (!SHARED_BUCKET) {
    return NextResponse.json({ success: false, error: 'Shared agent bucket not configured' }, { status: 500 });
  }
  const { key } = body;
  if (!key) {
    return NextResponse.json({ success: false, error: 'Key is required' }, { status: 400 });
  }

  const response = await s3Client.send(new GetObjectCommand({ Bucket: SHARED_BUCKET, Key: key }));
  const jsonStr = await response.Body?.transformToString();
  if (!jsonStr) {
    return NextResponse.json({ success: false, error: 'Empty response from S3' }, { status: 500 });
  }

  const config = JSON.parse(jsonStr);
  return NextResponse.json({ success: true, config });
}
