import { NextRequest, NextResponse } from 'next/server';
import { RegionConfigManager, SupportedRegion } from '@/config/region-config-manager';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { generateModelConfig } from '@/config/model-pattern-detector';

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

    // Bedrockからモデル一覧を取得
    let availableModels: any[] = [];
    let unavailableModels: any[] = [];
    
    try {
      const bedrockClient = new BedrockClient({
        region: currentRegion,
      });

      const command = new ListFoundationModelsCommand({
        byOutputModality: 'TEXT',
      });

      const response = await bedrockClient.send(command);
      
      availableModels = (response.modelSummaries || []).map((model) => {
        const modelId = model.modelId || '';
        const modelName = model.modelName || modelId;
        const providerName = model.providerName || 'Unknown';
        
        // 動的検出システムで設定を生成
        const config = generateModelConfig(modelId, modelName, providerName);
        
        return {
          id: modelId,
          name: modelName,
          description: config.description,
          provider: config.provider,
          inputModalities: model.inputModalities || [],
          outputModalities: model.outputModalities || [],
          responseStreamingSupported: model.responseStreamingSupported || false,
          category: config.category,
          maxTokens: config.maxTokens,
        };
      });
    } catch (bedrockError) {
      console.error('[Region Info API] Bedrock error:', bedrockError);
      // Bedrockエラーの場合は空の配列を返す
    }

    // 各リージョンの実際のモデル数（ListFoundationModels byOutputModality=TEXT、2026-03-25時点）
    const REGION_MODEL_COUNTS: Record<string, number> = {
      'ap-northeast-1': 57, 'ap-northeast-3': 9, 'ap-southeast-1': 18,
      'ap-southeast-2': 59, 'ap-south-1': 58, 'ap-northeast-2': 19,
      'eu-west-1': 50, 'eu-central-1': 29, 'eu-west-2': 52, 'eu-west-3': 25,
      'us-east-1': 96, 'us-west-2': 103, 'us-east-2': 76, 'sa-east-1': 43,
    };

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
          modelCount: r.id === currentRegion ? availableModels.length : (REGION_MODEL_COUNTS[r.id] || 0),
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
