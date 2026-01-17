import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || 'default';
    
    // 基本的なセッション情報を返す
    return NextResponse.json({
      success: true,
      sessionId,
      memory: [],
      attributes: {},
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AgentCore Memory Session] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, memory, attributes } = body;
    
    // メモリ保存の模擬実装
    console.log('[AgentCore Memory Session] Saving memory:', { sessionId, memory, attributes });
    
    return NextResponse.json({
      success: true,
      sessionId,
      saved: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AgentCore Memory Session] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
