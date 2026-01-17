/**
 * AWS リージョン定義
 * 14リージョン全てを定義
 */

export interface AWSRegion {
  id: string;
  name: string;
  displayName: string;
  flag: string;
  group: 'japan' | 'apac' | 'us' | 'eu' | 'sa';
  bedrockAvailable: boolean;
  fallbackRegion?: string;
}

export const AWS_REGIONS: AWSRegion[] = [
  // 日本地域
  {
    id: 'ap-northeast-1',
    name: 'Tokyo',
    displayName: '東京',
    flag: '🇯🇵',
    group: 'japan',
    bedrockAvailable: true,
  },
  {
    id: 'ap-northeast-3',
    name: 'Osaka',
    displayName: '大阪',
    flag: '🇯🇵',
    group: 'japan',
    bedrockAvailable: true,
  },
  
  // APAC地域
  {
    id: 'ap-southeast-1',
    name: 'Singapore',
    displayName: 'シンガポール',
    flag: '🇸🇬',
    group: 'apac',
    bedrockAvailable: true,
  },
  {
    id: 'ap-southeast-2',
    name: 'Sydney',
    displayName: 'シドニー',
    flag: '🇦🇺',
    group: 'apac',
    bedrockAvailable: true,
  },
  {
    id: 'ap-south-1',
    name: 'Mumbai',
    displayName: 'ムンバイ',
    flag: '🇮🇳',
    group: 'apac',
    bedrockAvailable: false,
    fallbackRegion: 'ap-southeast-1',
  },
  {
    id: 'ap-northeast-2',
    name: 'Seoul',
    displayName: 'ソウル',
    flag: '🇰🇷',
    group: 'apac',
    bedrockAvailable: false,
    fallbackRegion: 'ap-northeast-1',
  },
  
  // US地域
  {
    id: 'us-east-1',
    name: 'N. Virginia',
    displayName: 'バージニア',
    flag: '🇺🇸',
    group: 'us',
    bedrockAvailable: true,
  },
  {
    id: 'us-west-2',
    name: 'Oregon',
    displayName: 'オレゴン',
    flag: '🇺🇸',
    group: 'us',
    bedrockAvailable: true,
  },
  {
    id: 'us-east-2',
    name: 'Ohio',
    displayName: 'オハイオ',
    flag: '🇺🇸',
    group: 'us',
    bedrockAvailable: false,
    fallbackRegion: 'us-east-1',
  },
  
  // EU地域
  {
    id: 'eu-west-1',
    name: 'Ireland',
    displayName: 'アイルランド',
    flag: '🇮🇪',
    group: 'eu',
    bedrockAvailable: true,
  },
  {
    id: 'eu-central-1',
    name: 'Frankfurt',
    displayName: 'フランクフルト',
    flag: '🇩🇪',
    group: 'eu',
    bedrockAvailable: true,
  },
  {
    id: 'eu-west-2',
    name: 'London',
    displayName: 'ロンドン',
    flag: '🇬🇧',
    group: 'eu',
    bedrockAvailable: false,
    fallbackRegion: 'eu-west-1',
  },
  {
    id: 'eu-west-3',
    name: 'Paris',
    displayName: 'パリ',
    flag: '🇫🇷',
    group: 'eu',
    bedrockAvailable: true,
  },
  
  // 南米地域
  {
    id: 'sa-east-1',
    name: 'São Paulo',
    displayName: 'サンパウロ',
    flag: '🇧🇷',
    group: 'sa',
    bedrockAvailable: false,
    fallbackRegion: 'us-east-1',
  },
];

export const REGION_GROUP_NAMES: Record<string, string> = {
  japan: '🇯🇵 日本地域',
  apac: '🌏 APAC地域',
  us: '🇺🇸 US地域',
  eu: '🇪🇺 EU地域',
  sa: '🇧🇷 南米地域',
};

export const DEFAULT_REGION = 'ap-northeast-1';

/**
 * リージョンIDから情報を取得
 */
export function getRegionInfo(regionId: string): AWSRegion | undefined {
  return AWS_REGIONS.find(r => r.id === regionId);
}

/**
 * グループ別にリージョンを取得
 */
export function getRegionsByGroup(): Record<string, AWSRegion[]> {
  return {
    japan: AWS_REGIONS.filter(r => r.group === 'japan'),
    apac: AWS_REGIONS.filter(r => r.group === 'apac'),
    us: AWS_REGIONS.filter(r => r.group === 'us'),
    eu: AWS_REGIONS.filter(r => r.group === 'eu'),
    sa: AWS_REGIONS.filter(r => r.group === 'sa'),
  };
}

/**
 * Bedrock利用可能なリージョンのみ取得
 */
export function getBedrockAvailableRegions(): AWSRegion[] {
  return AWS_REGIONS.filter(r => r.bedrockAvailable);
}

/**
 * フォールバックリージョンを取得
 */
export function getFallbackRegion(regionId: string): string {
  const region = getRegionInfo(regionId);
  return region?.fallbackRegion || DEFAULT_REGION;
}
