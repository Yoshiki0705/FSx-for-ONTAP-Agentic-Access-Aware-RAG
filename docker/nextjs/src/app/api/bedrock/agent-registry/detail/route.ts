/**
 * Agent Registry 詳細取得 API
 *
 * POST /api/bedrock/agent-registry/detail
 *
 * Registry レコードの詳細メタデータを取得する。
 * Agent タイプ固有情報（FM、アクショングループ、KB）および
 * MCP サーバータイプ固有情報（エンドポイント、ツール、認証方式）を含む。
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRegistryClient } from '@/lib/agentcore/registry-client';
import type { RegistryDetailRequest } from '@/types/registry';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Feature-flag guard
  if (process.env.ENABLE_AGENT_REGISTRY !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Agent Registry is not enabled' },
      { status: 404 },
    );
  }

  try {
    const body: RegistryDetailRequest = await request.json();

    if (!body.resourceId) {
      return NextResponse.json(
        { success: false, error: 'resourceId is required' },
        { status: 400 },
      );
    }

    const client = getRegistryClient();

    console.log('[Registry Detail] resourceId:', body.resourceId);

    const detail = await client.getResource(body.resourceId);

    return NextResponse.json(detail);
  } catch (error: any) {
    console.error('[Registry Detail] Error:', error);

    const statusCode = error?.statusCode ?? 500;
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'Failed to get registry record detail',
        code: error?.code ?? 'REGISTRY_DETAIL_ERROR',
        retryable: statusCode >= 500,
      },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 },
    );
  }
}
