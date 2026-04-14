/**
 * 振り返りトリガー API
 *
 * POST /api/agentcore/memory/episodes/reflect
 *
 * Requirements: 11.1, 11.2, 11.4, 11.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agentcore/auth';
import { triggerReflection } from '@/lib/agentcore/episodic-memory';

export const dynamic = 'force-dynamic';

const EPISODIC_MEMORY_ENABLED = process.env.EPISODIC_MEMORY_ENABLED === 'true';

export async function POST(request: NextRequest) {
  if (!EPISODIC_MEMORY_ENABLED) {
    return NextResponse.json({ success: true, triggered: false });
  }

  try {
    const auth = await authenticateRequest();
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    await triggerReflection(sessionId, auth.userId);

    return NextResponse.json({ success: true, triggered: true });
  } catch (error: any) {
    console.error('[Episodes Reflect API] 振り返りトリガーエラー:', error);
    // エラーでもコア機能に影響しない
    return NextResponse.json({ success: true, triggered: false });
  }
}
