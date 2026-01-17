import { NextRequest, NextResponse } from 'next/server';
import { RegionConfigManager, SupportedRegion } from '@/config/region-config-manager';

export const dynamic = 'force-dynamic';

/**
 * リージョン変更API（簡略版）
 * Cookieにリージョンを保存
 */
export async function POST(request: NextRequest) {
  try {
    const { region } = await request.json();

    // リージョンの妥当性チェック
    const validation = RegionConfigManager.validateRegion(region);
    
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.message || `無効なリージョン: ${region}`
        },
        { status: 400 }
      );
    }

    // Cookieにリージョンを保存
    const response = NextResponse.json({
      success: true,
      data: {
        region: validation.fallbackRegion,
        regionName: RegionConfigManager.getRegionDisplayName(validation.fallbackRegion),
        message: `リージョンを${RegionConfigManager.getRegionDisplayName(validation.fallbackRegion)}に変更しました`
      }
    });

    // Cookieを設定（30日間有効）
    response.cookies.set('bedrock_region', validation.fallbackRegion, {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax'
    });

    return response;
  } catch (error) {
    console.error('[Change Region API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'リージョン変更に失敗しました'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
