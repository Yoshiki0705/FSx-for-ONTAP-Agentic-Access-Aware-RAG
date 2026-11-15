import { NextRequest, NextResponse } from 'next/server';
import { RegionConfigManager, SupportedRegion } from '@/config/region-config-manager';
import { getModelCatalog, getTierModels, profilePreference } from '@/lib/model-catalog';
import { chatModels, tierIds, type ApiModel } from '@/lib/model-catalog/api';

export const dynamic = 'force-dynamic';

/**
 * リージョン情報取得API（モデル一覧を含む完全版）
 */
export async function GET(request: NextRequest) {
  try {
    // Cookieからリージョンを取得
    const regionCookie = request.cookies.get('bedrock_region');
    const currentRegion = (regionCookie?.value || RegionConfigManager.getDefaultRegion()) as SupportedRegion;

    // リージョン設定を取得
    const regionConfig = RegionConfigManager.getRegionConfig(currentRegion);
    const allRegions = RegionConfigManager.getAllRegions();
    const supportedRegions = RegionConfigManager.getBedrockSupportedRegions();

    // The region's catalog (lib/model-catalog): ACTIVE chat models, how each is called,
    // and whether the account may call it. A model that needs a request is listed with
    // status "needs-request" so the selector can show it without letting it be picked.
    let availableModels: ApiModel[] = [];
    let unavailableModels: ApiModel[] = [];
    let tiers: ReturnType<typeof tierIds> | null = null;
    try {
      const models = chatModels(await getModelCatalog(currentRegion));
      availableModels = models.filter((m) => m.available);
      unavailableModels = models.filter((m) => !m.available);
      tiers = tierIds(await getTierModels(currentRegion));
    } catch (bedrockError) {
      console.error('[Region Info API] model catalog error:', bedrockError);
    }

    // レスポンスを構築
    const responseData = {
      success: true,
      data: {
        currentRegion,
        currentRegionName: RegionConfigManager.getRegionDisplayName(currentRegion),
        bedrockSupported: regionConfig?.bedrockSupported || false,
        supportedRegions: supportedRegions.map(r => ({
          region: r.id,
          regionName: r.displayNameJa,
          // Counted for the current region only; other regions are not queried.
          modelCount: r.id === currentRegion ? availableModels.length : null,
          description: r.description
        })),
        unsupportedRegions: allRegions
          .filter(r => !r.bedrockSupported)
          .map(r => ({
            region: r.id,
            regionName: r.displayNameJa,
            warningMessage: r.warningMessage
          })),
        availableModels,
        unavailableModels,
        tiers,
        profilePreference: profilePreference(),
        availableModelsCount: availableModels.length,
        unavailableModelsCount: unavailableModels.length
      }
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[Region Info API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'リージョン情報の取得に失敗しました'
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
