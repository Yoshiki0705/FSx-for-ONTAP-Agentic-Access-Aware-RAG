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
          // 現在のリージョンの場合は実際のモデル数、それ以外は概算値
          modelCount: r.id === currentRegion ? availableModels.filter(m => m.provider !== 'Unknown').length : (r.modelCount || 0),
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
        // Unknownプロバイダーを除外したモデル数
        availableModelsCount: availableModels.filter(m => m.provider !== 'Unknown').length,
        unavailableModelsCount: unavailableModels.filter(m => m.provider !== 'Unknown').length
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
