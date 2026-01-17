/**
 * Bedrock設定管理
 */
export const BEDROCK_CONFIG = {
  // デフォルトリージョン
  DEFAULT_REGION: 'ap-northeast-1',
  
  // クライアント設定
  CLIENT: {
    maxAttempts: 3,
    requestTimeout: 30000,
  },
  
  // キャッシュ設定
  CACHE: {
    ttl: 5 * 60 * 1000, // 5分
  },
} as const;

/**
 * 現在のBedrockリージョンを取得
 */
export function getCurrentBedrockRegion(): string {
  return process.env.BEDROCK_REGION || 
         process.env.AWS_REGION || 
         BEDROCK_CONFIG.DEFAULT_REGION;
}

/**
 * リージョンの有効性を検証
 */
export function isValidAwsRegion(region: string): boolean {
  const validRegions = [
    'us-east-1', 'us-west-2', 'ap-northeast-1', 'ap-northeast-3',
    'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-southeast-2'
  ];
  return validRegions.includes(region);
}