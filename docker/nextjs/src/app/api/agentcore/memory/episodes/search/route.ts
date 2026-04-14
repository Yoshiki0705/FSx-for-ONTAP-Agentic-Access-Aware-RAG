/**
 * エピソード検索 API
 *
 * POST /api/agentcore/memory/episodes/search
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agentcore/auth';
import { searchEpisodes } from '@/lib/agentcore/episodic-memory';

export const dynamic = 'force-dynamic';

const EPISODIC_MEMORY_ENABLED = process.env.EPISODIC_MEMORY_ENABLED === 'true';

export async function POST(request: NextRequest) {
  if (!EPISODIC_MEMORY_ENABLED) {
    return NextResponse.json(
      { success: false, error: 'Episodic Memory is not enabled' },
      { status: 404 }
    );
  }

  try {
    const auth = await authenticateRequest();
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, limit = 20 } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query is required' },
        { status: 400 }
      );
    }

    const results = await searchEpisodes(query, auth.userId, limit);

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Episodes Search API] 検索エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to search episodes', results: [], total: 0 },
      { status: 500 }
    );
  }
}
