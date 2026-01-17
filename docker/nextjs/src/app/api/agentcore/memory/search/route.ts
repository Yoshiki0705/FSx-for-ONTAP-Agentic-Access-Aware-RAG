import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, sessionId, limit = 10 } = body;
    
    // 基本的な検索結果を返す
    return NextResponse.json({
      success: true,
      query,
      sessionId,
      results: [],
      total: 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AgentCore Memory Search] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
