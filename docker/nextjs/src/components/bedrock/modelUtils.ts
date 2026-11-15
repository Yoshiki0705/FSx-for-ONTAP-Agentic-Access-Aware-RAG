import { BedrockModel } from '../../config/bedrock-models';

/**
 * モデル検索・フィルタリング用ユーティリティ関数
 */

/** A model as /api/bedrock/region-info returns it (lib/model-catalog/api.ts). */
export interface CatalogModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  category?: string;
  maxTokens?: number;
  status?: 'ready' | 'needs-request' | 'unavailable';
  reason?: string;
  /** in-region / geo / global: where the call is processed. */
  scope?: 'in-region' | 'geo' | 'global';
  destinationRegions?: string[] | null;
}
// Bedrockリージョン情報インターフェース
export interface BedrockRegionInfo {
  currentRegion: string;
  currentRegionName: string;
  availableModels: CatalogModel[];
  /** Models listed but not selectable: status "needs-request" or "unavailable". */
  unavailableModels: CatalogModel[];
  availableModelsCount: number;
  unavailableModelsCount: number;
  lastChecked?: string;
}

// 処理済みモデルインターフェース
export interface ProcessedModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  available: boolean;
  reason?: string;
  description?: string;
  status?: 'ready' | 'needs-request' | 'unavailable';
  scope?: 'in-region' | 'geo' | 'global';
}

/**
 * Bedrockリージョン情報からモデル一覧を処理
 *
 * The list is the region's model catalog as the server returns it: ACTIVE chat models,
 * newest first. Nothing is added here. A model that needs a request stays in the list
 * with `available: false`, so the selector can show it without letting it be chosen.
 */
export function processModelsFromRegionInfo(regionInfo: BedrockRegionInfo | null): ProcessedModel[] {
  if (!regionInfo) return [];
  const toProcessed = (model: CatalogModel, available: boolean): ProcessedModel => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    category: model.category || 'General',
    available,
    reason: available ? undefined : model.reason,
    description: model.description || `${model.provider} ${model.name}`,
    status: model.status ?? (available ? 'ready' : 'unavailable'),
    scope: model.scope,
  });
  return [
    ...(regionInfo.availableModels || []).map((m) => toProcessed(m, true)),
    ...(regionInfo.unavailableModels || []).map((m) => toProcessed(m, false)),
  ];
}

/**
 * モデル選択処理
 */
export function handleModelSelection(
  targetModel: ProcessedModel | undefined,
  onModelChange: (modelId: string) => void,
  modelId: string
): void {
  if (targetModel && !targetModel.available) {
    // 利用不可能なモデルが選択された場合の警告
    alert(`警告: このモデルは現在利用できません\n\nモデル: ${targetModel.name}\n理由: ${targetModel.reason || '不明'}\n\n利用可能なモデルを選択してください。`);
    return;
  }
  
  onModelChange(modelId);
}

/**
 * 選択されたモデルを取得
 */
export function getSelectedModel(allModels: ProcessedModel[], selectedModelId: string): ProcessedModel | undefined {
  return allModels.find(model => model.id === selectedModelId);
}

export function filterModelsBySearch(models: BedrockModel[], searchTerm: string): BedrockModel[] {
  if (!searchTerm.trim()) {
    return models;
  }

  const term = searchTerm.toLowerCase();
  return models.filter(model => 
    model.name.toLowerCase().includes(term) ||
    model.provider.toLowerCase().includes(term) ||
    model.description?.toLowerCase().includes(term) ||
    model.id.toLowerCase().includes(term)
  );
}

export function filterModelsByProvider(models: BedrockModel[], provider: string): BedrockModel[] {
  if (!provider || provider === 'all') {
    return models;
  }

  return models.filter(model => 
    model.provider.toLowerCase() === provider.toLowerCase()
  );
}

export function groupModelsByProvider(models: BedrockModel[]): Record<string, BedrockModel[]> {
  return models.reduce((groups, model) => {
    const provider = model.provider;
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(model);
    return groups;
  }, {} as Record<string, BedrockModel[]>);
}

export function sortModelsByRecommendation(models: BedrockModel[], recommendedIds: string[]): BedrockModel[] {
  return models.sort((a, b) => {
    const aRecommended = recommendedIds.includes(a.id);
    const bRecommended = recommendedIds.includes(b.id);
    
    if (aRecommended && !bRecommended) return -1;
    if (!aRecommended && bRecommended) return 1;
    
    // 同じ推奨レベルの場合は名前でソート
    return a.name.localeCompare(b.name);
  });
}

export function getModelDisplayName(model: BedrockModel): string {
  return `${model.name} (${model.provider})`;
}

export function getModelDescription(model: BedrockModel): string {
  if (model.description) {
    return model.description;
  }
  
  // デフォルトの説明を生成
  const typeDescription = model.type === 'chat' ? 'チャット対応' : 
                         model.type === 'embedding' ? '埋め込み生成' : 
                         model.type === 'image' ? '画像生成' : '汎用';
  
  return `${model.provider}の${typeDescription}モデル`;
}

export function isModelRecommended(modelId: string, recommendedIds: string[]): boolean {
  return recommendedIds.includes(modelId);
}