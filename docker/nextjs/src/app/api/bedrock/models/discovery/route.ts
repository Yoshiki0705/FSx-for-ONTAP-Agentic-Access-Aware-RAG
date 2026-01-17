/**
 * 動的モデル検出API - 機能復旧用
 * 
 * 機能:
 * - Bedrockモデルの動的検出
 * - プロバイダー情報の自動生成
 * - リージョン対応状況の確認
 * - キャッシュ機能
 */

import { NextRequest, NextResponse } from 'next/server';

// 動的レンダリングを強制（searchParamsを使用するため）
export const dynamic = 'force-dynamic';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// DynamoDBクライアント初期化
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DISCOVERY_CACHE_TABLE_NAME = process.env.DISCOVERY_CACHE_TABLE_NAME || 'permission-aware-rag-discovery-cache';
const CACHE_TTL_SECONDS = parseInt(process.env.MODEL_CACHE_TTL || '3600'); // 1時間

interface BedrockModel {
  id: string;
  name: string;
  provider: string;
  modality: string;
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  latencyMs?: number;
  availableRegions: string[];
  capabilities: string[];
  description: string;
  metadata?: {
    releaseDate?: string;
    deprecated?: boolean;
    betaFeatures?: string[];
  };
}

interface ModelProvider {
  id: string;
  name: string;
  displayName: string;
  colorTheme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logoUrl?: string;
  website?: string;
}

interface AWSRegion {
  id: string;
  name: string;
  displayName: string;
  flag?: string;
  bedrockSupported: boolean;
  services: string[];
}

interface DiscoveryResult {
  models: BedrockModel[];
  providers: ModelProvider[];
  regions: AWSRegion[];
  lastUpdated: string;
  cacheHit: boolean;
}

/**
 * キャッシュキー生成
 */
function getCacheKey(region: string, type: 'models' | 'providers' | 'regions'): string {
  return `discovery-${type}-${region}`;
}

/**
 * キャッシュからデータ取得
 */
async function getFromCache(cacheKey: string): Promise<any | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: DISCOVERY_CACHE_TABLE_NAME,
      Key: { cacheKey }
    }));

    if (!result.Item) {
      return null;
    }

    // TTLチェック
    const now = Math.floor(Date.now() / 1000);
    if (result.Item.expiresAt < now) {
      return null;
    }

    return result.Item.data;
  } catch (error) {
    console.warn('キャッシュ取得エラー:', error);
    return null;
  }
}

/**
 * キャッシュにデータ保存
 */
async function saveToCache(cacheKey: string, data: any): Promise<void> {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS;
    
    await docClient.send(new PutCommand({
      TableName: DISCOVERY_CACHE_TABLE_NAME,
      Item: {
        cacheKey,
        data,
        expiresAt,
        updatedAt: new Date().toISOString()
      }
    }));
  } catch (error) {
    console.warn('キャッシュ保存エラー:', error);
  }
}

/**
 * プロバイダー名からハッシュ生成
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  return Math.abs(hash);
}

/**
 * プロバイダー情報抽出
 */
function extractProvider(modelId: string): string {
  if (modelId.startsWith('amazon.')) return 'amazon';
  if (modelId.startsWith('anthropic.')) return 'anthropic';
  if (modelId.startsWith('meta.')) return 'meta';
  if (modelId.startsWith('cohere.')) return 'cohere';
  if (modelId.startsWith('ai21.')) return 'ai21';
  if (modelId.startsWith('stability.')) return 'stability';
  if (modelId.startsWith('mistral.')) return 'mistral';
  
  // 新しいプロバイダーの場合、最初の部分を抽出
  return modelId.split('.')[0];
}

/**
 * モダリティ検出
 */
function detectModality(model: any): string {
  const modelId = model.modelId?.toLowerCase() || '';
  
  if (modelId.includes('embed')) return 'embedding';
  if (modelId.includes('vision') || modelId.includes('multimodal')) return 'multimodal';
  if (modelId.includes('image') || modelId.includes('stable-diffusion')) return 'image';
  
  return 'text';
}

/**
 * 最大トークン数推定
 */
function estimateMaxTokens(modelId: string): number {
  const id = modelId.toLowerCase();
  
  // Claude系
  if (id.includes('claude-3-5-sonnet')) return 200000;
  if (id.includes('claude-3-haiku')) return 200000;
  if (id.includes('claude-3-opus')) return 200000;
  if (id.includes('claude-v2')) return 100000;
  
  // その他のモデル
  if (id.includes('llama')) return 32000;
  if (id.includes('mistral')) return 32000;
  if (id.includes('cohere')) return 4000;
  
  return 4000; // デフォルト
}

/**
 * 料金情報推定（実際のAPIから取得する場合は別途実装）
 */
function estimatePricing(modelId: string): { input: number; output: number } {
  const id = modelId.toLowerCase();
  
  // Claude 3.5 Sonnet
  if (id.includes('claude-3-5-sonnet')) {
    return { input: 3.0, output: 15.0 };
  }
  
  // Claude 3 Haiku
  if (id.includes('claude-3-haiku')) {
    return { input: 0.25, output: 1.25 };
  }
  
  // Claude 3 Opus
  if (id.includes('claude-3-opus')) {
    return { input: 15.0, output: 75.0 };
  }
  
  // デフォルト料金
  return { input: 1.0, output: 3.0 };
}

/**
 * カラーテーマ生成
 */
function generateColorTheme(provider: string): any {
  const hash = hashString(provider);
  
  // プロバイダー固有のカラー
  const providerColors: { [key: string]: any } = {
    anthropic: {
      primary: '#D97706',
      secondary: '#FED7AA',
      accent: '#F59E0B'
    },
    amazon: {
      primary: '#FF9900',
      secondary: '#FFE4B5',
      accent: '#FF6600'
    },
    meta: {
      primary: '#1877F2',
      secondary: '#E3F2FD',
      accent: '#0D47A1'
    },
    cohere: {
      primary: '#39C5BB',
      secondary: '#B2DFDB',
      accent: '#00695C'
    },
    ai21: {
      primary: '#8B5CF6',
      secondary: '#E9D5FF',
      accent: '#7C3AED'
    },
    stability: {
      primary: '#EF4444',
      secondary: '#FECACA',
      accent: '#DC2626'
    },
    mistral: {
      primary: '#F97316',
      secondary: '#FED7AA',
      accent: '#EA580C'
    }
  };

  if (providerColors[provider]) {
    return providerColors[provider];
  }

  // 動的カラー生成
  return {
    primary: `hsl(${hash % 360}, 70%, 50%)`,
    secondary: `hsl(${hash % 360}, 50%, 85%)`,
    accent: `hsl(${(hash + 120) % 360}, 60%, 60%)`
  };
}

/**
 * プロバイダー表示名フォーマット
 */
function formatProviderName(provider: string): string {
  const nameMap: { [key: string]: string } = {
    anthropic: 'Anthropic',
    amazon: 'Amazon',
    meta: 'Meta',
    cohere: 'Cohere',
    ai21: 'AI21 Labs',
    stability: 'Stability AI',
    mistral: 'Mistral AI'
  };

  return nameMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Bedrockモデル検出
 */
async function discoverBedrockModels(region: string): Promise<BedrockModel[]> {
  try {
    const bedrockClient = new BedrockClient({ region });
    const command = new ListFoundationModelsCommand({});
    const response = await bedrockClient.send(command);

    const models = response.modelSummaries?.map(model => ({
      id: model.modelId!,
      name: model.modelName!,
      provider: extractProvider(model.modelId!),
      modality: detectModality(model),
      maxTokens: estimateMaxTokens(model.modelId!),
      costPer1kTokens: estimatePricing(model.modelId!),
      availableRegions: [region], // 現在のリージョンのみ
      capabilities: model.inputModalities || [],
      description: model.modelName!,
      metadata: {
        releaseDate: new Date().toISOString().split('T')[0],
        deprecated: false,
        betaFeatures: []
      }
    })) || [];

    return models;
  } catch (error) {
    console.error('Bedrockモデル検出エラー:', error);
    return getFallbackModels();
  }
}

/**
 * フォールバックモデル
 */
function getFallbackModels(): BedrockModel[] {
  return [
    {
      id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      name: 'Claude 3.5 Sonnet v2',
      provider: 'anthropic',
      modality: 'text',
      maxTokens: 200000,
      costPer1kTokens: { input: 3.0, output: 15.0 },
      availableRegions: ['ap-northeast-1', 'us-east-1', 'us-west-2'],
      capabilities: ['text'],
      description: 'Claude 3.5 Sonnet v2 - Advanced reasoning and analysis'
    },
    {
      id: 'anthropic.claude-3-haiku-20240307-v1:0',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      modality: 'text',
      maxTokens: 200000,
      costPer1kTokens: { input: 0.25, output: 1.25 },
      availableRegions: ['ap-northeast-1', 'us-east-1', 'us-west-2'],
      capabilities: ['text'],
      description: 'Claude 3 Haiku - Fast and efficient'
    }
  ];
}

/**
 * プロバイダー検出
 */
async function discoverProviders(models: BedrockModel[]): Promise<ModelProvider[]> {
  const providerMap = new Map<string, ModelProvider>();
  
  models.forEach(model => {
    if (!providerMap.has(model.provider)) {
      providerMap.set(model.provider, {
        id: model.provider,
        name: model.provider,
        displayName: formatProviderName(model.provider),
        colorTheme: generateColorTheme(model.provider)
      });
    }
  });

  return Array.from(providerMap.values());
}

/**
 * リージョン検出
 */
async function discoverRegions(): Promise<AWSRegion[]> {
  // 静的リージョンリスト（実際のAPIから取得する場合は別途実装）
  return [
    {
      id: 'ap-northeast-1',
      name: 'ap-northeast-1',
      displayName: 'Asia Pacific (Tokyo)',
      flag: '🇯🇵',
      bedrockSupported: true,
      services: ['bedrock', 'lambda', 'dynamodb']
    },
    {
      id: 'us-east-1',
      name: 'us-east-1',
      displayName: 'US East (N. Virginia)',
      flag: '🇺🇸',
      bedrockSupported: true,
      services: ['bedrock', 'lambda', 'dynamodb']
    },
    {
      id: 'us-west-2',
      name: 'us-west-2',
      displayName: 'US West (Oregon)',
      flag: '🇺🇸',
      bedrockSupported: true,
      services: ['bedrock', 'lambda', 'dynamodb']
    },
    {
      id: 'eu-west-1',
      name: 'eu-west-1',
      displayName: 'Europe (Ireland)',
      flag: '🇮🇪',
      bedrockSupported: true,
      services: ['bedrock', 'lambda', 'dynamodb']
    }
  ];
}

/**
 * 動的モデル検出API (GET)
 */
export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get('region') || process.env.BEDROCK_REGION || 'ap-northeast-1';
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    let cacheHit = false;
    let models: BedrockModel[] = [];
    let providers: ModelProvider[] = [];
    let regions: AWSRegion[] = [];

    // キャッシュチェック（強制更新でない場合）
    if (!forceRefresh) {
      const cachedModels = await getFromCache(getCacheKey(region, 'models'));
      const cachedProviders = await getFromCache(getCacheKey(region, 'providers'));
      const cachedRegions = await getFromCache(getCacheKey(region, 'regions'));

      if (cachedModels && cachedProviders && cachedRegions) {
        cacheHit = true;
        models = cachedModels;
        providers = cachedProviders;
        regions = cachedRegions;
        
        console.log(`✅ キャッシュヒット: ${region}`);
      }
    }

    // キャッシュミスまたは強制更新の場合
    if (!cacheHit) {
      console.log(`🔍 動的検出開始: ${region}`);
      
      // 並列実行で高速化
      const [discoveredModels, discoveredRegions] = await Promise.all([
        discoverBedrockModels(region),
        discoverRegions()
      ]);

      models = discoveredModels;
      regions = discoveredRegions;
      providers = await discoverProviders(models);

      // キャッシュに保存
      await Promise.all([
        saveToCache(getCacheKey(region, 'models'), models),
        saveToCache(getCacheKey(region, 'providers'), providers),
        saveToCache(getCacheKey(region, 'regions'), regions)
      ]);

      console.log(`✅ 動的検出完了: ${models.length}モデル, ${providers.length}プロバイダー`);
    }

    const result: DiscoveryResult = {
      models,
      providers,
      regions,
      lastUpdated: new Date().toISOString(),
      cacheHit
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 動的検出エラー:', error);
    
    // フォールバック応答
    const fallbackResult: DiscoveryResult = {
      models: getFallbackModels(),
      providers: await discoverProviders(getFallbackModels()),
      regions: await discoverRegions(),
      lastUpdated: new Date().toISOString(),
      cacheHit: false
    };

    return NextResponse.json(fallbackResult, { status: 200 });
  }
}