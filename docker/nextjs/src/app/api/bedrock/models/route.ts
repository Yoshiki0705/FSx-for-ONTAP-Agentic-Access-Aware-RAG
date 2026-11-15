import { NextRequest, NextResponse } from 'next/server';
import { defaultRegion, getModelCatalog, getTierModels } from '@/lib/model-catalog';
import { chatModels, tierIds } from '@/lib/model-catalog/api';

export const dynamic = 'force-dynamic';

/**
 * The region's chat models from the model catalog (lib/model-catalog), newest first.
 * `recommendedModels` are the tier models (light / standard / heavy) and `defaultModelId`
 * is the standard tier, so neither names a model.
 */
export async function GET(request: NextRequest) {
  try {
    const region = request.cookies.get('bedrock_region')?.value || defaultRegion();
    const models = chatModels(await getModelCatalog(region));
    const tiers = tierIds(await getTierModels(region));
    const recommendedModels = [tiers.light, tiers.standard, tiers.heavy].filter(
      (id, i, all): id is string => Boolean(id) && all.indexOf(id) === i,
    );
    return NextResponse.json({
      success: true,
      data: {
        models,
        region,
        count: models.length,
        recommendedModels,
        defaultModelId: tiers.standard ?? models.find((m) => m.available)?.id ?? '',
        tiers,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch models from Bedrock',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
