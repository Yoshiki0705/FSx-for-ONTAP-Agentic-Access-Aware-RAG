/**
 * モデル設定マネージャー（動的検出統合版）
 * 
 * 動的パターン検出と明示的設定を統合し、新しいモデルが追加されても
 * 自動的に適切な設定が適用されるようにする
 */

import type { BedrockModel } from './bedrock-models';
import { generateModelConfig } from './model-pattern-detector';

/**
 * 明示的なモデル設定（オーバーライド用）
 * 
 * 動的検出で対応できない特殊なケースのみここに定義する
 * 通常は空のオブジェクトで問題ない
 */
const EXPLICIT_MODEL_CONFIGS: Record<string, BedrockModel> = {
  // 特殊なケースのみ定義
  // 例: 動的検出と異なる設定が必要な場合
  // 'special-model-id': {
  //   id: 'special-model-id',
  //   name: 'Special Model',
  //   ...
  // }
};

/**
 * 設定キャッシュ（LRU方式）
 */
const configCache = new Map<string, BedrockModel>();
const MAX_CACHE_SIZE = 1000;

/**
 * キャッシュアクセス順序（LRU管理用）
 */
const cacheAccessOrder: string[] = [];

/**
 * LRUキャッシュ管理
 * 
 * キャッシュサイズが上限を超えた場合、最も古いエントリを削除
 */
function manageCacheSize(): void {
  if (configCache.size > MAX_CACHE_SIZE) {
    // 最も古いキーを取得
    const oldestKey = cacheAccessOrder.shift();
    if (oldestKey) {
      configCache.delete(oldestKey);
      console.log(`🗑️ キャッシュエントリを削除: ${oldestKey}`);
    }
  }
}

/**
 * キャッシュアクセスを記録（LRU更新）
 */
function recordCacheAccess(modelId: string): void {
  // 既存のエントリを削除
  const index = cacheAccessOrder.indexOf(modelId);
  if (index > -1) {
    cacheAccessOrder.splice(index, 1);
  }
  // 最後に追加（最新アクセス）
  cacheAccessOrder.push(modelId);
}

/**
 * モデル設定を取得（動的検出 + キャッシュ）
 * 
 * 優先順位:
 * 1. 明示的な設定（EXPLICIT_MODEL_CONFIGS）
 * 2. キャッシュ
 * 3. 動的検出
 * 
 * @param modelId モデルID
 * @param modelName モデル表示名（動的検出に必要）
 * @param providerName プロバイダー名（動的検出に必要）
 * @returns BedrockModel設定、または null
 */
export function getModelConfig(
  modelId: string,
  modelName?: string,
  providerName?: string
): BedrockModel | null {
  // 入力検証
  if (!modelId || typeof modelId !== 'string') {
    console.warn('⚠️ 無効なモデルID:', modelId);
    return null;
  }
  
  // 1. 明示的な設定を優先
  if (EXPLICIT_MODEL_CONFIGS[modelId]) {
    console.log(`✅ 明示的な設定を使用: ${modelId}`);
    return EXPLICIT_MODEL_CONFIGS[modelId];
  }
  
  // 2. キャッシュチェック
  if (configCache.has(modelId)) {
    recordCacheAccess(modelId);
    console.log(`💾 キャッシュヒット: ${modelId}`);
    return configCache.get(modelId)!;
  }
  
  // 3. 動的検出
  if (!modelName || !providerName) {
    console.warn(`⚠️ モデル名またはプロバイダー名が不足: ${modelId}`);
    console.warn(`   動的検出にはmodelNameとproviderNameが必要です`);
    return null;
  }
  
  try {
    const config = generateModelConfig(modelId, modelName, providerName);
    
    // 4. キャッシュに保存
    configCache.set(modelId, config);
    recordCacheAccess(modelId);
    manageCacheSize();
    
    console.log(`🆕 動的検出完了: ${modelId} (キャッシュに保存)`);
    return config;
  } catch (error) {
    console.error(`❌ モデル設定生成エラー: ${modelId}`, error);
    return null;
  }
}

/**
 * キャッシュをクリア
 * 
 * テストやデバッグ時に使用
 */
export function clearConfigCache(): void {
  const size = configCache.size;
  configCache.clear();
  cacheAccessOrder.length = 0;
  console.log(`🗑️ キャッシュをクリア: ${size}エントリ削除`);
}

/**
 * キャッシュ統計情報を取得
 * 
 * デバッグ用
 */
export function getCacheStats() {
  return {
    size: configCache.size,
    maxSize: MAX_CACHE_SIZE,
    utilizationPercent: (configCache.size / MAX_CACHE_SIZE) * 100,
    entries: Array.from(configCache.keys()),
    accessOrder: [...cacheAccessOrder]
  };
}

/**
 * 明示的な設定を追加
 * 
 * 動的検出で対応できない特殊なケースを追加する場合に使用
 * 
 * @param modelId モデルID
 * @param config BedrockModel設定
 */
export function addExplicitConfig(modelId: string, config: BedrockModel): void {
  EXPLICIT_MODEL_CONFIGS[modelId] = config;
  // キャッシュも更新
  configCache.set(modelId, config);
  recordCacheAccess(modelId);
  console.log(`➕ 明示的な設定を追加: ${modelId}`);
}

/**
 * 明示的な設定を削除
 * 
 * @param modelId モデルID
 */
export function removeExplicitConfig(modelId: string): void {
  delete EXPLICIT_MODEL_CONFIGS[modelId];
  // キャッシュからも削除
  configCache.delete(modelId);
  const index = cacheAccessOrder.indexOf(modelId);
  if (index > -1) {
    cacheAccessOrder.splice(index, 1);
  }
  console.log(`➖ 明示的な設定を削除: ${modelId}`);
}

/**
 * すべての明示的な設定を取得
 * 
 * デバッグ用
 */
export function getExplicitConfigs(): Record<string, BedrockModel> {
  return { ...EXPLICIT_MODEL_CONFIGS };
}

/**
 * プロバイダー名からデフォルト設定を取得（後方互換性用）
 * 
 * @deprecated 動的検出システムを使用してください
 */
export function getDefaultConfigByProvider(providerName: string): Partial<BedrockModel> {
  console.warn('⚠️ getDefaultConfigByProvider()は非推奨です。動的検出システムを使用してください');
  
  const provider = providerName.toLowerCase();
  
  if (provider === 'anthropic') {
    return {
      requestFormat: 'anthropic',
      responseFormat: 'content[0].text',
      parameterMapping: {
        maxTokens: 'max_tokens',
        temperature: 'temperature',
        topP: 'top_p'
      }
    };
  }
  
  if (provider === 'amazon') {
    return {
      requestFormat: 'amazon',
      responseFormat: 'output.message.content[0].text'
    };
  }
  
  if (provider === 'meta') {
    return {
      requestFormat: 'prompt-based',
      responseFormat: 'generation',
      parameterMapping: {
        maxTokens: 'max_gen_len',
        temperature: 'temperature',
        topP: 'top_p'
      }
    };
  }
  
  // デフォルト
  return {
    requestFormat: 'prompt-based',
    responseFormat: 'text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    }
  };
}
