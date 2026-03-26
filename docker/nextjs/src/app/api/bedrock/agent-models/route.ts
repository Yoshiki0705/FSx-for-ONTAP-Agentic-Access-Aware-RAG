/**
 * Agent Models API
 * 
 * GET /api/bedrock/agent-models
 * 
 * 指定されたリージョンで利用可能なFoundation Modelのリストを取得します。
 * Agent対応モデルをBedrock APIのメタデータから動的にフィルタリングして返します。
 * ハードコードされたモデルリストは使用しません。
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

/**
 * GET /api/bedrock/agent-models?region=ap-northeast-1
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region') || process.env.AWS_REGION || 'ap-northeast-1';

    const bedrockClient = new BedrockClient({ region });

    // Bedrock APIからON_DEMAND推論対応のテキストモデルを取得
    // Agent対応モデルはON_DEMAND推論をサポートし、テキスト入出力が可能なモデル
    const command = new ListFoundationModelsCommand({
      byOutputModality: 'TEXT',
      byInferenceType: 'ON_DEMAND',
    });

    const response = await bedrockClient.send(command);

    // Agent対応モデルのフィルタリング（APIメタデータベース）
    const agentModels = (response.modelSummaries || [])
      .filter(model => {
        if (!model.modelId || !model.providerName) return false;
        // テキスト入力をサポート
        if (!model.inputModalities?.includes('TEXT')) return false;
        // テキスト出力をサポート
        if (!model.outputModalities?.includes('TEXT')) return false;
        // ON_DEMAND推論をサポート（Agent実行に必要）
        if (!model.inferenceTypesSupported?.includes('ON_DEMAND')) return false;
        // Embeddingモデルを除外（embed, embedding等）
        if (model.modelId.toLowerCase().includes('embed')) return false;
        // Image生成専用モデルを除外
        if (model.outputModalities?.length === 1 && model.outputModalities[0] === 'IMAGE') return false;
        return true;
      })
      .map(model => ({
        modelId: model.modelId,
        modelName: model.modelName,
        provider: model.providerName,
        available: true,
        description: `${model.providerName} ${model.modelName}`,
        inputModalities: model.inputModalities || [],
        outputModalities: model.outputModalities || [],
        responseStreamingSupported: model.responseStreamingSupported || false,
        inferenceTypes: model.inferenceTypesSupported || [],
      }))
      .sort((a, b) => {
        if (a.provider !== b.provider) return (a.provider || '').localeCompare(b.provider || '');
        return (a.modelName || '').localeCompare(b.modelName || '');
      });

    console.log(`✅ [Agent Models] ${agentModels.length} models (region: ${region})`);

    return NextResponse.json({
      success: true,
      region,
      models: agentModels,
      count: agentModels.length,
    });
  } catch (error) {
    console.error('[Agent Models] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', models: [], count: 0 },
      { status: 500 },
    );
  }
}
