import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // デフォルトのAgentCore設定を返す
    return NextResponse.json({
      success: true,
      preferences: {
        agentMode: false,
        autoSave: true,
        traceEnabled: false,
        sessionAttributes: {}
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Preferences AgentCore] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { preferences } = body;
    
    // 設定保存の模擬実装
    console.log('[Preferences AgentCore] Saving preferences:', preferences);
    
    return NextResponse.json({
      success: true,
      preferences,
      saved: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Preferences AgentCore] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
