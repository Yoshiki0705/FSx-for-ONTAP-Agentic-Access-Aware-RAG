/**
 * Agent Models API
 *
 * GET /api/bedrock/agent-models?region=ap-northeast-1
 *
 * The models an agent can run on, from the model catalog (lib/model-catalog). Agents run
 * on the AgentCore Runtime, which calls the inference profile, so models without
 * on-demand throughput are included (the earlier ON_DEMAND filter left out every Claude
 * model in ap-northeast-1). A model that needs a request is listed with
 * `available: false` and `status: "needs-request"`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { defaultRegion, getModelCatalog } from '@/lib/model-catalog';
import { chatModels } from '@/lib/model-catalog/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get('region') || defaultRegion();
  try {
    const models = chatModels(await getModelCatalog(region)).map((m) => ({
      ...m,
      provider: m.providerName,
      inferenceTypes: m.scope === 'in-region' ? ['ON_DEMAND'] : ['INFERENCE_PROFILE'],
    }));
    return NextResponse.json({ success: true, region, models, count: models.length });
  } catch (error) {
    console.error('[Agent Models] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', models: [], count: 0 },
      { status: 500 },
    );
  }
}
