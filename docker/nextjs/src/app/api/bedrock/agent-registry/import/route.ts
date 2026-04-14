/**
 * Agent Registry インポート API
 *
 * POST /api/bedrock/agent-registry/import
 *
 * Registry レコードからローカル Bedrock Agent を作成する。
 * - Registry から詳細メタデータを取得
 * - 既存 Agent との名前重複チェック（サフィックス付与）
 * - CreateAgent → PrepareAgent → CreateAgentAlias のフロー
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.2
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentClient,
  CreateAgentCommand,
  PrepareAgentCommand,
  CreateAgentAliasCommand,
  ListAgentsCommand,
} from '@aws-sdk/client-bedrock-agent';
import { getRegistryClient } from '@/lib/agentcore/registry-client';
import type { RegistryImportRequest, RegistryImportResponse } from '@/types/registry';

export const dynamic = 'force-dynamic';

const DEPLOY_REGION = process.env.AWS_REGION || 'ap-northeast-1';

/**
 * 名前重複解決: 既存名と衝突する場合は _imported_YYYYMMDD サフィックスを付与。
 * Requirements: 4.5
 */
export function resolveAgentName(
  desiredName: string,
  existingNames: string[],
): string {
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }
  const suffix = `_imported_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  return `${desiredName}${suffix}`;
}

export async function POST(request: NextRequest) {
  // Feature-flag guard
  if (process.env.ENABLE_AGENT_REGISTRY !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Agent Registry is not enabled' },
      { status: 404 },
    );
  }

  try {
    const body: RegistryImportRequest = await request.json();

    if (!body.resourceId) {
      return NextResponse.json(
        { success: false, error: 'resourceId is required' },
        { status: 400 },
      );
    }

    const registryClient = getRegistryClient();

    // Step 1: Get resource detail from Registry
    console.log('[Registry Import] Fetching resource:', body.resourceId);
    const detail = await registryClient.getResource(body.resourceId);

    // Step 2: List existing agents to check name conflicts
    const bedrockClient = new BedrockAgentClient({ region: DEPLOY_REGION });
    const listResponse = await bedrockClient.send(
      new ListAgentsCommand({ maxResults: 100 }),
    );
    const existingNames = (listResponse.agentSummaries ?? [])
      .map((a) => a.agentName ?? '')
      .filter(Boolean);

    const agentName = resolveAgentName(detail.resourceName, existingNames);

    console.log('[Registry Import] Creating agent:', agentName);

    // Step 3: Create Agent
    const createResponse = await bedrockClient.send(
      new CreateAgentCommand({
        agentName,
        description: detail.description || `Imported from Registry: ${detail.resourceId}`,
        foundationModel:
          detail.agentInfo?.foundationModel || 'anthropic.claude-3-sonnet-20240229-v1:0',
        instruction:
          detail.description ||
          'You are a helpful AI assistant imported from the Agent Registry.',
        idleSessionTTLInSeconds: 1800,
      }),
    );

    const agentId = createResponse.agent?.agentId;
    if (!agentId) {
      throw new Error('Agent creation failed: no agentId returned');
    }

    // Step 4: Prepare Agent
    console.log('[Registry Import] Preparing agent:', agentId);
    await bedrockClient.send(new PrepareAgentCommand({ agentId }));

    // Step 5: Create Alias
    console.log('[Registry Import] Creating alias for agent:', agentId);
    await bedrockClient.send(
      new CreateAgentAliasCommand({
        agentId,
        agentAliasName: 'live',
        description: `Imported from Registry (${detail.resourceId})`,
      }),
    );

    console.log('[Registry Import] Import complete:', agentId, agentName);

    const response: RegistryImportResponse = {
      success: true,
      agentId,
      agentName,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Registry Import] Error:', error);

    const statusCode = error?.statusCode ?? error?.$metadata?.httpStatusCode ?? 500;
    const response: RegistryImportResponse = {
      success: false,
      error: error?.message ?? 'Import failed',
    };

    return NextResponse.json(response, {
      status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    });
  }
}
