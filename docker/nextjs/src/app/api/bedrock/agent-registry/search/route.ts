/**
 * Agent Registry 検索 API
 *
 * POST /api/bedrock/agent-registry/search
 *
 * AgentCore Registry のリソースをセマンティック検索する。
 * ページネーション対応（maxResults: 20）、リソースタイプフィルタ対応。
 *
 * Requirements: 2.1, 2.3, 2.5, 2.6, 8.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRegistryClient } from '@/lib/agentcore/registry-client';
import type { RegistrySearchRequest, RegistrySearchResponse } from '@/types/registry';

export const dynamic = 'force-dynamic';

const MAX_RESULTS_LIMIT = 20;

export async function POST(request: NextRequest) {
  // Feature-flag guard
  if (process.env.ENABLE_AGENT_REGISTRY !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Agent Registry is not enabled' },
      { status: 404 },
    );
  }

  try {
    const body: RegistrySearchRequest = await request.json();

    // Validate & clamp maxResults
    const maxResults = Math.min(
      Math.max(body.maxResults ?? MAX_RESULTS_LIMIT, 1),
      MAX_RESULTS_LIMIT,
    );

    const client = getRegistryClient();

    console.log('[Registry Search] query:', body.query, 'type:', body.resourceType ?? 'all');

    const result: RegistrySearchResponse = await client.searchResources({
      query: body.query ?? '',
      resourceType: body.resourceType,
      nextToken: body.nextToken,
      maxResults,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Registry Search] Error:', error);

    const statusCode = error?.statusCode ?? 500;
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'Registry search failed',
        code: error?.code ?? 'REGISTRY_SEARCH_ERROR',
        retryable: statusCode >= 500,
      },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 },
    );
  }
}
