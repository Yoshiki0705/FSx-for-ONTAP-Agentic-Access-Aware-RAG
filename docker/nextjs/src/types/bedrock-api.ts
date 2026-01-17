/**
 * Bedrock API関連の型定義
 */

/** モデル情報 */
export interface BedrockModelInfo {
  modelId: string;
  modelName?: string;
  providerName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  responseStreamingSupported?: boolean;
  customizationsSupported?: string[];
  inferenceTypesSupported?: string[];
}

/** リージョン情報レスポンス */
export interface BedrockRegionInfoResponse {
  success: boolean;
  data: {
    currentRegion: string;
    availableModels: BedrockModelInfo[];
    totalModels: number;
    timestamp: string;
  };
  error?: string;
  errorDetails?: string;
}

/** リージョン変更リクエスト */
export interface RegionChangeRequest {
  newRegion: string;
}

/** リージョン変更レスポンス */
export interface RegionChangeResponse {
  success: boolean;
  message?: string;
  data?: {
    currentRegion: string;
    requestedRegion: string;
    changeInstructions: string[];
    timestamp: string;
  };
  error?: string;
  details?: string;
}