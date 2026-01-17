/**
 * Inference Profile Resolver
 * 
 * リージョンとモデルIDに基づいて最適なinference profileを解決します。
 * 優先順位:
 * 1. 該当リージョンの地域別inference profile（APAC, EU等）
 * 2. US inference profile（フォールバック）
 * 3. 元のモデルID（inference profileが存在しない場合）
 */

// リージョンから地域プレフィックスへのマッピング
const REGION_TO_PROFILE_PREFIX: Record<string, string> = {
  // APAC リージョン
  'ap-northeast-1': 'apac',  // 東京
  'ap-northeast-2': 'apac',  // ソウル
  'ap-northeast-3': 'apac',  // 大阪
  'ap-south-1': 'apac',      // ムンバイ
  'ap-southeast-1': 'apac',  // シンガポール
  'ap-southeast-2': 'apac',  // シドニー
  
  // EU リージョン
  'eu-west-1': 'eu',         // アイルランド
  'eu-west-2': 'eu',         // ロンドン
  'eu-west-3': 'eu',         // パリ
  'eu-central-1': 'eu',      // フランクフルト
  'eu-north-1': 'eu',        // ストックホルム
  
  // US リージョン
  'us-east-1': 'us',         // バージニア北部
  'us-east-2': 'us',         // オハイオ
  'us-west-1': 'us',         // カリフォルニア北部
  'us-west-2': 'us',         // オレゴン
  
  // その他のリージョン（USにフォールバック）
  'ca-central-1': 'us',      // カナダ
  'sa-east-1': 'us',         // サンパウロ
  'me-south-1': 'us',        // バーレーン
  'af-south-1': 'us',        // ケープタウン
};

// inference profileをサポートするモデルのベースID
const INFERENCE_PROFILE_MODELS = [
  'amazon.nova-pro',
  'amazon.nova-lite',
  'amazon.nova-micro',
  'anthropic.claude-3-5-sonnet',
  'anthropic.claude-3-5-haiku',
  'anthropic.claude-3-opus',
  'anthropic.claude-3-sonnet',
  'anthropic.claude-3-haiku',
];

/**
 * モデルIDからベースモデル名を抽出
 * 例: 'amazon.nova-pro-v1:0' -> 'amazon.nova-pro'
 */
function extractBaseModelId(modelId: string): string {
  // 既存のプレフィックスを除去
  const cleanId = modelId.replace(/^(us|eu|apac)\./i, '');
  
  // バージョン番号を除去
  const withoutVersion = cleanId.replace(/-v\d+:\d+$/, '');
  
  return withoutVersion;
}

/**
 * モデルIDがinference profileをサポートしているか確認
 */
function supportsInferenceProfile(modelId: string): boolean {
  const baseId = extractBaseModelId(modelId);
  return INFERENCE_PROFILE_MODELS.some(supported => baseId.startsWith(supported));
}

/**
 * モデルIDからバージョン部分を抽出
 * 例: 'amazon.nova-pro-v1:0' -> 'v1:0'
 */
function extractVersion(modelId: string): string {
  const match = modelId.match(/-v\d+:\d+$/);
  return match ? match[0] : '';
}

/**
 * リージョンに基づいて最適なinference profileを解決
 * 
 * @param modelId - 元のモデルID
 * @param region - AWSリージョン
 * @returns 最適化されたモデルID（inference profile付き）
 */
export function resolveInferenceProfile(modelId: string, region: string): string {
  console.log('🔍 Inference Profile解決開始:', { modelId, region });
  
  // 既にinference profileが付いている場合はそのまま返す
  if (modelId.match(/^(us|eu|apac)\./i)) {
    console.log('✅ 既にinference profileが付いています:', modelId);
    return modelId;
  }
  
  // inference profileをサポートしていないモデルの場合はそのまま返す
  if (!supportsInferenceProfile(modelId)) {
    console.log('ℹ️ このモデルはinference profileをサポートしていません:', modelId);
    return modelId;
  }
  
  // リージョンから地域プレフィックスを取得
  const regionalPrefix = REGION_TO_PROFILE_PREFIX[region];
  
  if (!regionalPrefix) {
    console.warn('⚠️ 未知のリージョン、USにフォールバック:', region);
  }
  
  // 優先順位に従ってinference profileを構築
  const baseId = extractBaseModelId(modelId);
  const version = extractVersion(modelId);
  
  // 1. 地域別inference profile（APAC, EU等）
  if (regionalPrefix && regionalPrefix !== 'us') {
    const regionalProfileId = `${regionalPrefix}.${baseId}${version}`;
    console.log('✅ 地域別inference profileを使用:', regionalProfileId);
    return regionalProfileId;
  }
  
  // 2. US inference profile（フォールバック）
  const usProfileId = `us.${baseId}${version}`;
  console.log('✅ US inference profileにフォールバック:', usProfileId);
  return usProfileId;
}

/**
 * 複数のモデルIDに対してinference profileを解決
 */
export function resolveInferenceProfiles(
  modelIds: string[],
  region: string
): Map<string, string> {
  const resolved = new Map<string, string>();
  
  for (const modelId of modelIds) {
    const resolvedId = resolveInferenceProfile(modelId, region);
    resolved.set(modelId, resolvedId);
  }
  
  return resolved;
}

/**
 * inference profileの優先順位リストを取得
 * 
 * @param modelId - 元のモデルID
 * @param region - AWSリージョン
 * @returns 優先順位順のinference profileリスト
 */
export function getInferenceProfilePriority(
  modelId: string,
  region: string
): string[] {
  const profiles: string[] = [];
  
  // 既にinference profileが付いている場合はそのまま返す
  if (modelId.match(/^(us|eu|apac)\./i)) {
    return [modelId];
  }
  
  // inference profileをサポートしていない場合は元のIDのみ
  if (!supportsInferenceProfile(modelId)) {
    return [modelId];
  }
  
  const baseId = extractBaseModelId(modelId);
  const version = extractVersion(modelId);
  const regionalPrefix = REGION_TO_PROFILE_PREFIX[region];
  
  // 1. 地域別inference profile
  if (regionalPrefix && regionalPrefix !== 'us') {
    profiles.push(`${regionalPrefix}.${baseId}${version}`);
  }
  
  // 2. US inference profile
  profiles.push(`us.${baseId}${version}`);
  
  // 3. 元のモデルID（最終フォールバック）
  profiles.push(modelId);
  
  return profiles;
}

/**
 * リージョンの地域プレフィックスを取得
 */
export function getRegionalPrefix(region: string): string {
  return REGION_TO_PROFILE_PREFIX[region] || 'us';
}

/**
 * 利用可能なinference profileプレフィックスのリスト
 */
export const AVAILABLE_PROFILE_PREFIXES = ['apac', 'eu', 'us'] as const;
export type InferenceProfilePrefix = typeof AVAILABLE_PROFILE_PREFIXES[number];
