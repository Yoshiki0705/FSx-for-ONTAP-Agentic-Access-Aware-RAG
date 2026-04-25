import { NextResponse } from 'next/server';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { generateModelConfig } from '@/config/model-pattern-detector';
import { resolveInferenceProfile } from '@/lib/inference-profile-resolver';
import { BASE_RECOMMENDED_MODELS, FALLBACK_MODEL_ID, DEFAULT_REGION } from '@/config/model-defaults';

export async function GET() {
  try {
    const region = process.env.BEDROCK_REGION || DEFAULT_REGION;
    
    const bedrockClient = new BedrockClient({
      region: region,
    });

    const command = new ListFoundationModelsCommand({
      byOutputModality: 'TEXT',
    });

    const response = await bedrockClient.send(command);
    
    const models = (response.modelSummaries || []).map((model) => {
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
        // 動的検出された設定を追加
        requestFormat: config.requestFormat,
        responseFormat: config.responseFormat,
        parameterMapping: config.parameterMapping,
        category: config.category,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP
      };
    });

    // 推奨モデルとデフォルトモデルを設定（inference profileで解決）
    const baseRecommendedModels = [...BASE_RECOMMENDED_MODELS];
    
    // リージョンに基づいてinference profileを解決
    const recommendedModels = baseRecommendedModels
      .map(id => resolveInferenceProfile(id, region))
      .filter(id => models.some(m => m.id === id));
    
    // デフォルトモデルもinference profileで解決
    const baseDefaultModelId = FALLBACK_MODEL_ID;
    const resolvedDefaultModelId = resolveInferenceProfile(baseDefaultModelId, region);
    const defaultModelId = models.find(m => m.id === resolvedDefaultModelId)?.id || models[0]?.id || '';

    return NextResponse.json({
      success: true,
      data: {
        models,
        region,
        count: models.length,
        recommendedModels,
        defaultModelId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch models from Bedrock',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}