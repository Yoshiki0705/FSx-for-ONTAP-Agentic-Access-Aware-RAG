/**
 * 動的モデルパターン検出器
 * 
 * モデルIDとプロバイダー名から自動的に適切な設定を検出する
 * 新しいモデルが追加されても、パターンマッチングにより自動的に動作する
 */

import { PROVIDER_PATTERNS, ProviderPattern } from './provider-patterns';
import type { BedrockModel } from './bedrock-models';

/**
 * 検出結果
 */
export interface DetectionResult {
  /** 検出されたプロバイダー名 */
  provider: string;
  
  /** マッチしたパターン */
  pattern: ProviderPattern;
  
  /** マッチ方法 */
  matchedBy: 'modelId' | 'providerName' | 'default';
  
  /** 信頼度 */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 推論プロファイルプレフィックスのリスト
 */
const INFERENCE_PROFILE_PREFIXES = ['us.', 'apac.', 'eu.', 'sa.'];

/**
 * 推論プロファイルプレフィックスを除去
 * 
 * @example
 * stripInferenceProfilePrefix('us.amazon.nova-pro-v1:0') // => 'amazon.nova-pro-v1:0'
 * stripInferenceProfilePrefix('amazon.nova-pro-v1:0')    // => 'amazon.nova-pro-v1:0'
 */
export function stripInferenceProfilePrefix(modelId: string): string {
  for (const prefix of INFERENCE_PROFILE_PREFIXES) {
    if (modelId.startsWith(prefix)) {
      return modelId.substring(prefix.length);
    }
  }
  return modelId;
}

/**
 * モデルIDが推論プロファイルを使用しているか判定
 */
export function isInferenceProfile(modelId: string): boolean {
  return INFERENCE_PROFILE_PREFIXES.some(prefix => modelId.startsWith(prefix));
}

/**
 * モデルIDからプロバイダーパターンを検出
 * 
 * 優先度の高い順にパターンマッチングを行う
 */
function detectByModelId(modelId: string): ProviderPattern | null {
  // 推論プロファイルプレフィックスを除去
  const cleanModelId = stripInferenceProfilePrefix(modelId);
  
  // 優先度順にソート（高い順）
  const sortedPatterns = [...PROVIDER_PATTERNS].sort((a, b) => b.priority - a.priority);
  
  // パターンマッチング
  for (const pattern of sortedPatterns) {
    // デフォルトパターンはスキップ（最後のフォールバック用）
    if (pattern.name === 'default') {
      continue;
    }
    
    for (const regex of pattern.modelIdPatterns) {
      // 元のモデルIDとクリーンなモデルIDの両方でマッチング
      if (regex.test(modelId) || regex.test(cleanModelId)) {
        return pattern;
      }
    }
  }
  
  return null;
}

/**
 * プロバイダー名からプロバイダーパターンを検出
 * 
 * プロバイダー名は大文字小文字を区別しない部分一致で検索
 */
function detectByProviderName(providerName: string): ProviderPattern | null {
  const lowerProviderName = providerName.toLowerCase().trim();
  
  // 空文字列チェック
  if (!lowerProviderName) {
    return null;
  }
  
  // 優先度順にソート（高い順）
  const sortedPatterns = [...PROVIDER_PATTERNS].sort((a, b) => b.priority - a.priority);
  
  // パターンマッチング
  for (const pattern of sortedPatterns) {
    // デフォルトパターンはスキップ
    if (pattern.name === 'default') {
      continue;
    }
    
    for (const name of pattern.providerNamePatterns) {
      // 部分一致で検索
      if (lowerProviderName.includes(name.toLowerCase())) {
        return pattern;
      }
    }
  }
  
  return null;
}

/**
 * デフォルトパターンを取得
 */
function getDefaultPattern(): ProviderPattern {
  const defaultPattern = PROVIDER_PATTERNS.find(p => p.name === 'default');
  if (!defaultPattern) {
    throw new Error('デフォルトパターンが見つかりません');
  }
  return defaultPattern;
}

/**
 * プロバイダーパターンを検出
 * 
 * 検出の優先順位:
 * 1. モデルIDパターンマッチング（高信頼度）
 * 2. プロバイダー名パターンマッチング（中信頼度）
 * 3. デフォルトパターン（低信頼度）
 * 
 * @param modelId モデルID（例: 'anthropic.claude-3-5-sonnet-20241022-v2:0'）
 * @param providerName プロバイダー名（例: 'Anthropic'）
 * @returns 検出結果
 */
export function detectProviderPattern(
  modelId: string,
  providerName?: string
): DetectionResult {
  // 入力検証
  if (!modelId || typeof modelId !== 'string') {
    console.warn('⚠️ 無効なモデルID:', modelId);
    return {
      provider: 'unknown',
      pattern: getDefaultPattern(),
      matchedBy: 'default',
      confidence: 'low'
    };
  }
  
  // 1. モデルIDから検出を試みる（高信頼度）
  const patternByModelId = detectByModelId(modelId);
  if (patternByModelId) {
    return {
      provider: patternByModelId.name,
      pattern: patternByModelId,
      matchedBy: 'modelId',
      confidence: 'high'
    };
  }
  
  // 2. プロバイダー名から検出を試みる（中信頼度）
  if (providerName) {
    const patternByProviderName = detectByProviderName(providerName);
    if (patternByProviderName) {
      return {
        provider: patternByProviderName.name,
        pattern: patternByProviderName,
        matchedBy: 'providerName',
        confidence: 'medium'
      };
    }
  }
  
  // 3. デフォルトパターンを使用（低信頼度）
  return {
    provider: 'unknown',
    pattern: getDefaultPattern(),
    matchedBy: 'default',
    confidence: 'low'
  };
}

/**
 * BedrockModel設定を動的に生成
 * 
 * @param modelId モデルID
 * @param modelName モデル表示名
 * @param providerName プロバイダー名
 * @returns BedrockModel設定
 */
export function generateModelConfig(
  modelId: string,
  modelName: string,
  providerName: string
): BedrockModel {
  // パターン検出
  const detection = detectProviderPattern(modelId, providerName);
  
  // ログ出力
  console.log(`🔍 モデルパターン検出:`, {
    modelId,
    modelName,
    provider: detection.provider,
    matchedBy: detection.matchedBy,
    confidence: detection.confidence,
    requestFormat: detection.pattern.requestFormat,
    isInferenceProfile: isInferenceProfile(modelId)
  });
  
  // 低信頼度の場合は警告
  if (detection.confidence === 'low') {
    console.warn(`⚠️ 未知のプロバイダー: ${modelId} (${providerName})`);
    console.warn(`   デフォルト設定を使用します: ${detection.pattern.requestFormat}形式`);
  }
  
  // BedrockModel設定を生成
  return {
    id: modelId,
    name: modelName,
    description: `${providerName} - ${modelId}`,
    provider: detection.provider as any,
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    requestFormat: detection.pattern.requestFormat,
    responseFormat: detection.pattern.responseFormat as any,
    parameterMapping: detection.pattern.parameterMapping
  };
}

/**
 * 複数のモデル設定を一括生成
 * 
 * @param models モデル情報の配列
 * @returns BedrockModel設定の配列
 */
export function generateBatchModelConfigs(
  models: Array<{ modelId: string; modelName: string; providerName: string }>
): BedrockModel[] {
  return models.map(({ modelId, modelName, providerName }) =>
    generateModelConfig(modelId, modelName, providerName)
  );
}

/**
 * パターン検出の統計情報を取得
 * 
 * デバッグ用
 */
export function getDetectionStats(modelIds: string[]): {
  total: number;
  byConfidence: Record<string, number>;
  byProvider: Record<string, number>;
  byMatchMethod: Record<string, number>;
} {
  const results = modelIds.map(id => detectProviderPattern(id));
  
  return {
    total: results.length,
    byConfidence: {
      high: results.filter(r => r.confidence === 'high').length,
      medium: results.filter(r => r.confidence === 'medium').length,
      low: results.filter(r => r.confidence === 'low').length,
    },
    byProvider: results.reduce((acc, r) => {
      acc[r.provider] = (acc[r.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byMatchMethod: {
      modelId: results.filter(r => r.matchedBy === 'modelId').length,
      providerName: results.filter(r => r.matchedBy === 'providerName').length,
      default: results.filter(r => r.matchedBy === 'default').length,
    }
  };
}
