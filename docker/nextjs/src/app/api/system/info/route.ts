import { NextRequest, NextResponse } from 'next/server';
import { SystemInfoFactory } from '../../../../config/system-info-factory';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    console.log('System info API called');

    // ファクトリーパターンを使用してシステム情報を生成
    const systemInfo = await SystemInfoFactory.createCompleteSystemInfo();

    return NextResponse.json({
      success: true,
      data: systemInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('System info API Error:', error);
    
    // エラーの詳細情報を安全に取得
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // 開発環境でのみスタックトレースを含める
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'システム情報の取得に失敗しました',
        message: errorMessage,
        ...(isDevelopment && { stack: errorStack }),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}