import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { region } = await request.json();

    if (!region) {
      return NextResponse.json(
        { error: 'Region is required' },
        { status: 400 }
      );
    }

    // リージョンの妥当性チェック
    const validRegions = [
      'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2',
      'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'eu-west-3'
    ];

    if (!validRegions.includes(region)) {
      return NextResponse.json(
        { error: 'Invalid region' },
        { status: 400 }
      );
    }

    console.log(`[RegionAPI] リージョン変更: ${region}`);

    // リージョン変更の成功レスポンス
    return NextResponse.json({
      success: true,
      region: region,
      message: `Region changed to ${region}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RegionAPI] エラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}