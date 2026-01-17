import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Bedrock Agents対応リージョン（2025年12月14日現在の最新情報）
const BEDROCK_AGENTS_SUPPORTED_REGIONS = [
  'ap-northeast-1',  // 東京
  'ap-northeast-2',  // ソウル
  'ap-south-1',      // ムンバイ
  'ap-southeast-1',  // シンガポール
  'ap-southeast-2',  // シドニー
  'ca-central-1',    // カナダ中部
  'eu-central-1',    // フランクフルト
  'eu-central-2',    // チューリッヒ
  'eu-west-1',       // アイルランド
  'eu-west-2',       // ロンドン
  'eu-west-3',       // パリ
  'sa-east-1',       // サンパウロ
  'us-east-1',       // バージニア北部
  'us-gov-west-1',   // AWS GovCloud
  'us-west-2'        // オレゴン
];

// リージョン表示名マッピング
const REGION_DISPLAY_NAMES: Record<string, { name: string; nameJa: string }> = {
  'ap-northeast-1': { name: 'Tokyo', nameJa: '東京' },
  'ap-northeast-2': { name: 'Seoul', nameJa: 'ソウル' },
  'ap-northeast-3': { name: 'Osaka', nameJa: '大阪' },
  'ap-south-1': { name: 'Mumbai', nameJa: 'ムンバイ' },
  'ap-southeast-1': { name: 'Singapore', nameJa: 'シンガポール' },
  'ap-southeast-2': { name: 'Sydney', nameJa: 'シドニー' },
  'ca-central-1': { name: 'Canada Central', nameJa: 'カナダ中部' },
  'eu-central-1': { name: 'Frankfurt', nameJa: 'フランクフルト' },
  'eu-central-2': { name: 'Zurich', nameJa: 'チューリッヒ' },
  'eu-west-1': { name: 'Ireland', nameJa: 'アイルランド' },
  'eu-west-2': { name: 'London', nameJa: 'ロンドン' },
  'eu-west-3': { name: 'Paris', nameJa: 'パリ' },
  'sa-east-1': { name: 'São Paulo', nameJa: 'サンパウロ' },
  'us-east-1': { name: 'N. Virginia', nameJa: 'バージニア北部' },
  'us-east-2': { name: 'Ohio', nameJa: 'オハイオ' },
  'us-gov-west-1': { name: 'AWS GovCloud (US-West)', nameJa: 'AWS GovCloud（米国西部）' },
  'us-west-2': { name: 'Oregon', nameJa: 'オレゴン' }
};

interface BedrockAgentsRegionInfo {
  region: string;
  name: string;
  nameJa: string;
  supported: boolean;
  agentCoreSupported: boolean;
  fallbackRegion?: string;
  description: string;
}

/**
 * Bedrock Agents対応リージョン情報を動的に取得するAPI
 * 2025年12月14日現在の最新情報に基づく
 */
export async function GET(request: NextRequest) {
  console.log('[Bedrock Agents Regions API] API endpoint called');
  
  try {
    const { searchParams } = new URL(request.url);
    const checkRegion = searchParams.get('region');
    
    // 全リージョン情報を構築
    const allRegions: BedrockAgentsRegionInfo[] = [];
    
    // サポート対象リージョン
    BEDROCK_AGENTS_SUPPORTED_REGIONS.forEach(region => {
      const displayNames = REGION_DISPLAY_NAMES[region] || { name: region, nameJa: region };
      allRegions.push({
        region,
        name: displayNames.name,
        nameJa: displayNames.nameJa,
        supported: true,
        agentCoreSupported: true,
        description: `Bedrock Agents対応リージョン - ${displayNames.nameJa}`
      });
    });
    
    // サポート外リージョン（フォールバック情報付き）
    const unsupportedRegions = [
      { region: 'ap-northeast-3', fallback: 'ap-northeast-1' }, // 大阪 → 東京
      { region: 'us-east-2', fallback: 'us-east-1' },          // オハイオ → バージニア
    ];
    
    unsupportedRegions.forEach(({ region, fallback }) => {
      const displayNames = REGION_DISPLAY_NAMES[region] || { name: region, nameJa: region };
      const fallbackNames = REGION_DISPLAY_NAMES[fallback] || { name: fallback, nameJa: fallback };
      
      allRegions.push({
        region,
        name: displayNames.name,
        nameJa: displayNames.nameJa,
        supported: false,
        agentCoreSupported: false,
        fallbackRegion: fallback,
        description: `Bedrock Agents未対応 - ${fallbackNames.nameJa}経由で利用可能`
      });
    });
    
    // 特定リージョンの情報を要求された場合
    if (checkRegion) {
      const regionInfo = allRegions.find(r => r.region === checkRegion);
      if (regionInfo) {
        return NextResponse.json({
          success: true,
          data: regionInfo,
          timestamp: new Date().toISOString()
        });
      } else {
        // 未知のリージョンの場合、東京リージョンへのフォールバック情報を返す
        return NextResponse.json({
          success: true,
          data: {
            region: checkRegion,
            name: checkRegion,
            nameJa: checkRegion,
            supported: false,
            agentCoreSupported: false,
            fallbackRegion: 'ap-northeast-1',
            description: `未対応リージョン - 東京リージョン経由で利用可能`
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 全リージョン情報を返す
    const supportedRegions = allRegions.filter(r => r.supported);
    const unsupportedRegionsData = allRegions.filter(r => !r.supported);
    
    return NextResponse.json({
      success: true,
      data: {
        supportedRegions,
        unsupportedRegions: unsupportedRegionsData,
        totalSupportedCount: supportedRegions.length,
        totalUnsupportedCount: unsupportedRegionsData.length,
        lastUpdated: '2025-12-14',
        source: 'AWS Documentation - Bedrock Agents Supported Regions'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Bedrock Agents Regions API] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}