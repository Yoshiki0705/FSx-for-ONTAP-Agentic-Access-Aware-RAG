/**
 * 類似エピソード検索 API
 *
 * POST /api/agentcore/memory/episodes/similar
 *
 * Requirements: 5.1, 5.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agentcore/auth';
import { findSimilarEpisodes } from '@/lib/agentcore/episodic-memory';

export const dynamic = 'force-dynamic';

const EPISODIC_MEMORY_ENABLED = process.env.EPISODIC_MEMORY_ENABLED === 'true';

export async function POST(request: NextRequest) {
  if (!EPISODIC_MEMORY_ENABLED) {
    return NextResponse.json(
      { success: false, error: 'Episodic Memory is not enabled', episodes: [] },
      { status: 404 }
    );
  }

  try {
    const auth = await authenticateRequest();
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, limit = 3 } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query is required' },
        { status: 400 }
      );
    }

    const episodes = await findSimilarEpisodes(query, auth.userId, limit);

    return NextResponse.json({
      success: true,
      episodes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Episodes Similar API] 類似検索エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to find similar episodes', episodes: [] },
      { status: 500 }
    );
  }
}
