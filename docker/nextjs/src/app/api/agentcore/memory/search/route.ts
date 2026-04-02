/**
 * AgentCore Memory セマンティック検索API
 *
 * POST: セマンティック検索（RetrieveMemoryRecords API、semantic strategy）
 *
 * 認証: Cognito JWT（sessionManager経由）
 * actorId = Cognito userId（namespace として使用）
 *
 * Requirements: 1.3, 2.4, 3.1, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentCoreClient,
  RetrieveMemoryRecordsCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { sessionManager } from '@/lib/auth/session-manager';
import { authenticateRequest } from '@/lib/agentcore/auth';

export const dynamic = 'force-dynamic';

// 環境変数
const MEMORY_ID = process.env.AGENTCORE_MEMORY_ID || '';
const ENABLE_AGENTCORE_MEMORY = process.env.ENABLE_AGENTCORE_MEMORY === 'true';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// BedrockAgentCoreClient の遅延初期化
let agentCoreClient: BedrockAgentCoreClient | null = null;

function getAgentCoreClient(): BedrockAgentCoreClient {
  if (!agentCoreClient) {
    agentCoreClient = new BedrockAgentCoreClient({ region: AWS_REGION });
  }
  return agentCoreClient;
}

/**
 * 認証は @/lib/agentcore/auth の共通モジュールを使用
 * （Cookie JWT検証のみ、DynamoDBアクセスなし）
 */

/**
 * POST /api/agentcore/memory/search
 * セマンティック検索（RetrieveMemoryRecords API）
 *
 * Body:
 *   query: string — 検索クエリ（必須）
 *   sessionId?: string — セッションID（オプション、メタデータフィルタ用）
 *   limit?: number — 取得件数（デフォルト: 10）
 *   memoryStrategyId?: string — 特定の戦略IDでフィルタ（オプション）
 *
 * AgentCore Memory の RetrieveMemoryRecords を使用して、
 * semantic strategy で保存された長期メモリをセマンティック検索する。
 */
export async function POST(request: NextRequest) {
  // Feature flag チェック
  if (!ENABLE_AGENTCORE_MEMORY) {
    return NextResponse.json(
      { success: false, error: 'AgentCore Memory is not enabled' },
      { status: 501 }
    );
  }

  try {
    // 認証
    const auth = await authenticateRequest();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { query, sessionId, limit = 10, memoryStrategyId } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query is required' },
        { status: 400 }
      );
    }

    const actorId = auth.userId;
    const client = getAgentCoreClient();

    console.log('[AgentCore Search] セマンティック検索:', {
      actorId,
      queryLength: query.length,
      limit,
      memoryStrategyId: memoryStrategyId || 'all',
    });

    const command = new RetrieveMemoryRecordsCommand({
      memoryId: MEMORY_ID,
      namespace: actorId,
      searchCriteria: {
        searchQuery: query,
        topK: limit,
        ...(memoryStrategyId && { memoryStrategyId }),
      },
      maxResults: limit,
    });

    const response = await client.send(command);
    const records = response.memoryRecordSummaries || [];

    const results = records.map((record) => ({
      id: record.memoryRecordId,
      content: record.content?.text || '',
      strategyId: record.memoryStrategyId,
      namespaces: record.namespaces,
      score: record.score,
      createdAt: record.createdAt?.toISOString(),
      metadata: record.metadata,
    }));

    console.log('[AgentCore Search] 検索成功:', {
      resultCount: results.length,
      topScore: results[0]?.score,
    });

    return NextResponse.json({
      success: true,
      query,
      sessionId: sessionId || null,
      results,
      total: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AgentCore Search] セマンティック検索エラー:', error);

    // ステートレスフォールバック: 空の検索結果を返す
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to search memories',
        fallback: true,
        results: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}
