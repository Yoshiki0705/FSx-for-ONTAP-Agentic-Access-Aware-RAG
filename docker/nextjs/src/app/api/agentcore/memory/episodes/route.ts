/**
 * エピソード一覧取得・削除 API
 *
 * GET  /api/agentcore/memory/episodes — エピソード一覧取得
 * DELETE /api/agentcore/memory/episodes — エピソード削除
 *
 * Requirements: 3.1, 3.2, 3.5, 7.2, 7.3, 7.4, 9.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agentcore/auth';
import { listEpisodes, deleteEpisode } from '@/lib/agentcore/episodic-memory';

export const dynamic = 'force-dynamic';

const EPISODIC_MEMORY_ENABLED = process.env.EPISODIC_MEMORY_ENABLED === 'true';

/**
 * GET /api/agentcore/memory/episodes
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const episodes = await listEpisodes(auth.userId, limit);

    return NextResponse.json({
      success: true,
      episodes,
      total: episodes.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Episodes API] 一覧取得エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agentcore/memory/episodes
 */
export async function DELETE(request: NextRequest) {
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
    const { episodeId } = body;

    if (!episodeId) {
      return NextResponse.json(
        { success: false, error: 'episodeId is required' },
        { status: 400 }
      );
    }

    await deleteEpisode(episodeId, auth.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Episodes API] 削除エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete episode' },
      { status: 500 }
    );
  }
}
