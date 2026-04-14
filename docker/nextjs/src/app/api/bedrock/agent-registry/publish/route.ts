/**
 * Agent Registry パブリッシュ API
 *
 * POST /api/bedrock/agent-registry/publish
 *
 * ローカル Bedrock Agent のメタデータを AgentCore Registry に登録する。
 * - GetAgent で Agent メタデータを取得
 * - CreateResource で Registry に登録
 * - 承認ステータス（PENDING_APPROVAL）を返却
 *
 * Requirements: 5.1, 5.2, 5.5, 8.3
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentClient,
  GetAgentCommand,
} from '@aws-sdk/client-bedrock-agent';
import { getRegistryClient } from '@/lib/agentcore/registry-client';
import type { RegistryPublishRequest, RegistryPublishResponse } from '@/types/registry';

export const dynamic = 'force-dynamic';

const DEPLOY_REGION = process.env.AWS_REGION || 'ap-northeast-1';

export async function POST(request: NextRequest) {
  // Feature-flag guard
  if (process.env.ENABLE_AGENT_REGISTRY !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Agent Registry is not enabled' },
      { status: 404 },
    );
  }

  try {
    const body: RegistryPublishRequest = await request.json();

    if (!body.agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId is required' },
        { status: 400 },
      );
    }

    // Step 1: Get agent metadata from Bedrock
    const bedrockClient = new BedrockAgentClient({ region: DEPLOY_REGION });

    console.log('[Registry Publish] Fetching agent metadata:', body.agentId);
    const agentResponse = await bedrockClient.send(
      new GetAgentCommand({ agentId: body.agentId }),
    );

    const agent = agentResponse.agent;
    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent not found: ${body.agentId}` },
        { status: 404 },
      );
    }

    // Step 2: Publish to Registry
    const registryClient = getRegistryClient();

    console.log('[Registry Publish] Publishing to registry:', agent.agentName);
    const publishResult = await registryClient.createResource({
      resourceName: agent.agentName ?? body.agentId,
      resourceType: 'Agent',
      description: body.description || agent.description || '',
      metadata: {
        agentId: agent.agentId,
        foundationModel: agent.foundationModel,
        agentStatus: agent.agentStatus,
        createdAt: agent.createdAt?.toISOString(),
        updatedAt: agent.updatedAt?.toISOString(),
        sourceRegion: DEPLOY_REGION,
      },
    });

    console.log('[Registry Publish] Published:', publishResult.resourceId);

    const response: RegistryPublishResponse = {
      success: true,
      resourceId: publishResult.resourceId,
      status: 'PENDING_APPROVAL',
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Registry Publish] Error:', error);

    const statusCode = error?.statusCode ?? error?.$metadata?.httpStatusCode ?? 500;
    const response: RegistryPublishResponse = {
      success: false,
      error: error?.message ?? 'Publish failed',
    };

    return NextResponse.json(response, {
      status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    });
  }
}
