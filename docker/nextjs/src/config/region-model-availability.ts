/**
 * リージョン別モデル可用性マッピング
 * 
 * AWS Bedrockのリージョン別モデル提供状況に基づいて、
 * 各モデルがどのリージョンで利用可能かを定義します。
 */

export interface RegionModelAvailability {
  // モデルが利用可能なリージョンのリスト
  availableRegions: string[];
  // フォールバックリージョン（優先順位順）
  fallbackRegions: string[];
  // プライマリリージョン（最も推奨されるリージョン）
  primaryRegion: string;
}

/**
 * プロバイダー別のリージョン可用性マッピング
 */
export const PROVIDER_REGION_AVAILABILITY: Record<string, RegionModelAvailability> = {
  // AI21 Labs - US East 1のみ
  'ai21': {
    availableRegions: ['us-east-1'],
    fallbackRegions: ['us-east-1'],
    primaryRegion: 'us-east-1'
  },
  
  // Cohere - US East 1, US West 2, EU Central 1
  'cohere': {
    availableRegions: ['us-east-1', 'us-west-2', 'eu-central-1'],
    fallbackRegions: ['us-east-1', 'us-west-2', 'eu-central-1'],
    primaryRegion: 'us-east-1'
  },
  
  // Meta - US East 1, US West 2, EU Central 1
  'meta': {
    availableRegions: ['us-east-1', 'us-west-2', 'eu-central-1'],
    fallbackRegions: ['us-east-1', 'us-west-2', 'eu-central-1'],
    primaryRegion: 'us-east-1'
  },
  
  // Amazon - 全リージョン
  'amazon': {
    availableRegions: [
      'us-east-1', 'us-west-2', 'ap-northeast-1', 'ap-southeast-1',
      'ap-southeast-2', 'eu-central-1', 'eu-west-1', 'eu-west-3'
    ],
    fallbackRegions: ['us-east-1', 'ap-northeast-1'],
    primaryRegion: 'us-east-1'
  },
  
  // Anthropic - 全リージョン
  'anthropic': {
    availableRegions: [
      'us-east-1', 'us-west-2', 'ap-northeast-1', 'ap-southeast-1',
      'ap-southeast-2', 'eu-central-1', 'eu-west-1', 'eu-west-3'
    ],
    fallbackRegions: ['us-east-1', 'ap-northeast-1'],
    primaryRegion: 'us-east-1'
  },
  
  // Mistral AI - 主要リージョン
  'mistral': {
    availableRegions: [
      'us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-central-1', 'eu-west-1'
    ],
    fallbackRegions: ['us-east-1', 'ap-northeast-1'],
    primaryRegion: 'us-east-1'
  }
};

/**
 * リージョン別の地理的グループ
 * レイテンシー最適化のために使用
 */
export const REGION_GROUPS: Record<string, string[]> = {
  'asia-pacific': ['ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2'],
  'north-america': ['us-east-1', 'us-west-2'],
  'europe': ['eu-central-1', 'eu-west-1', 'eu-west-3']
};

/**
 * リージョン間のレイテンシー優先度マッピング
 * 各リージョンから最も近いリージョンの優先順位（全14リージョン対応）
 */
export const REGION_LATENCY_PRIORITY: Record<string, string[]> = {
  // 日本地域
  'ap-northeast-1': ['ap-northeast-1', 'ap-northeast-3', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  'ap-northeast-3': ['ap-northeast-3', 'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  
  // APAC地域
  'ap-southeast-1': ['ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-3', 'ap-south-1', 'ap-northeast-2', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  'ap-southeast-2': ['ap-southeast-2', 'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-south-1', 'ap-northeast-2', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  'ap-south-1': ['ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-3', 'ap-northeast-2', 'eu-central-1', 'eu-west-1', 'us-east-1', 'us-west-2', 'us-east-2', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  'ap-northeast-2': ['ap-northeast-2', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  
  // US地域
  'us-east-1': ['us-east-1', 'us-east-2', 'us-west-2', 'eu-west-1', 'eu-central-1', 'eu-west-2', 'eu-west-3', 'sa-east-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-2'],
  'us-west-2': ['us-west-2', 'us-east-1', 'us-east-2', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-2', 'ap-south-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1'],
  'us-east-2': ['us-east-2', 'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'eu-west-2', 'eu-west-3', 'sa-east-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-2'],
  
  // EU地域
  'eu-central-1': ['eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'us-east-1', 'us-east-2', 'us-west-2', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-2', 'ap-northeast-2', 'sa-east-1'],
  'eu-west-1': ['eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-west-3', 'us-east-1', 'us-east-2', 'us-west-2', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-2', 'ap-northeast-2', 'sa-east-1'],
  'eu-west-2': ['eu-west-2', 'eu-west-1', 'eu-central-1', 'eu-west-3', 'us-east-1', 'us-east-2', 'us-west-2', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-2', 'ap-northeast-2', 'sa-east-1'],
  'eu-west-3': ['eu-west-3', 'eu-west-1', 'eu-central-1', 'eu-west-2', 'us-east-1', 'us-east-2', 'us-west-2', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-2', 'ap-northeast-2', 'sa-east-1'],
  
  // 南米地域
  'sa-east-1': ['sa-east-1', 'us-east-1', 'us-east-2', 'us-west-2', 'eu-west-1', 'eu-central-1', 'eu-west-2', 'eu-west-3', 'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-2']
};

/**
 * プロバイダー名からリージョン可用性を取得
 */
export function getProviderAvailability(providerName: string): RegionModelAvailability | null {
  const provider = providerName.toLowerCase();
  
  // プロバイダー名の正規化
  if (provider.includes('ai21') || provider.includes('ai 21')) {
    return PROVIDER_REGION_AVAILABILITY['ai21'];
  }
  if (provider.includes('cohere')) {
    return PROVIDER_REGION_AVAILABILITY['cohere'];
  }
  if (provider.includes('meta')) {
    return PROVIDER_REGION_AVAILABILITY['meta'];
  }
  if (provider.includes('amazon')) {
    return PROVIDER_REGION_AVAILABILITY['amazon'];
  }
  if (provider.includes('anthropic')) {
    return PROVIDER_REGION_AVAILABILITY['anthropic'];
  }
  if (provider.includes('mistral')) {
    return PROVIDER_REGION_AVAILABILITY['mistral'];
  }
  
  return null;
}

/**
 * モデルIDからプロバイダー名を抽出
 */
export function extractProviderFromModelId(modelId: string): string | null {
  const parts = modelId.split('.');
  if (parts.length < 2) return null;
  
  return parts[0];
}

/**
 * 指定されたリージョンでモデルが利用可能かチェック
 */
export function isModelAvailableInRegion(modelId: string, region: string): boolean {
  const provider = extractProviderFromModelId(modelId);
  if (!provider) return true; // 不明な場合は利用可能と仮定
  
  const availability = getProviderAvailability(provider);
  if (!availability) return true; // 不明な場合は利用可能と仮定
  
  return availability.availableRegions.includes(region);
}

/**
 * 最適なフォールバックリージョンを選択
 * 
 * @param modelId モデルID
 * @param requestedRegion リクエストされたリージョン
 * @returns 最適なリージョン（利用可能な場合はrequestedRegion、そうでない場合はフォールバック）
 */
export function selectOptimalRegion(modelId: string, requestedRegion: string): string {
  // モデルがリクエストされたリージョンで利用可能かチェック
  if (isModelAvailableInRegion(modelId, requestedRegion)) {
    return requestedRegion;
  }
  
  // プロバイダーの可用性情報を取得
  const provider = extractProviderFromModelId(modelId);
  if (!provider) return requestedRegion;
  
  const availability = getProviderAvailability(provider);
  if (!availability) return requestedRegion;
  
  // レイテンシー優先度に基づいてフォールバックリージョンを選択
  const latencyPriority = REGION_LATENCY_PRIORITY[requestedRegion] || [];
  
  // レイテンシー優先度とプロバイダーの利用可能リージョンの交差を取得
  for (const region of latencyPriority) {
    if (availability.availableRegions.includes(region)) {
      return region;
    }
  }
  
  // レイテンシー優先度で見つからない場合は、プライマリリージョンを返す
  return availability.primaryRegion;
}

/**
 * リージョン選択の詳細情報を取得
 */
export interface RegionSelectionInfo {
  requestedRegion: string;
  selectedRegion: string;
  isAvailableInRequested: boolean;
  reason: string;
  providerName: string | null;
}

export function getRegionSelectionInfo(modelId: string, requestedRegion: string): RegionSelectionInfo {
  const provider = extractProviderFromModelId(modelId);
  const isAvailable = isModelAvailableInRegion(modelId, requestedRegion);
  const selectedRegion = selectOptimalRegion(modelId, requestedRegion);
  
  let reason = '';
  if (isAvailable) {
    reason = 'モデルはリクエストされたリージョンで利用可能';
  } else {
    reason = `モデルは${requestedRegion}では利用不可、${selectedRegion}にフォールバック`;
  }
  
  return {
    requestedRegion,
    selectedRegion,
    isAvailableInRequested: isAvailable,
    reason,
    providerName: provider
  };
}
