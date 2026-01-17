import { BedrockModel } from '../../config/bedrock-models';

/**
 * モデル検索・フィルタリング用ユーティリティ関数
 */

// Bedrockリージョン情報インターフェース
export interface BedrockRegionInfo {
  currentRegion: string;
  currentRegionName: string;
  availableModels: Array<{
    id: string;
    name: string;
    provider: string;
    description?: string;
    category?: string;
    maxTokens?: number;
  }>;
  unavailableModels: Array<{
    modelId: string;
    modelName: string;
    provider: string;
    reason: string;
  }>;
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
}

// フォールバックモデル
export const FALLBACK_MODEL: ProcessedModel = {
  id: 'amazon.nova-pro-v1:0',
  name: 'Amazon Nova Pro',
  provider: 'Amazon',
  category: 'General',
  available: true,
  reason: undefined,
  description: 'Amazonの高性能な汎用AIモデル'
};

/**
 * Bedrockリージョン情報からモデル一覧を処理
 * Unknownプロバイダーのモデルは除外する
 */
export function processModelsFromRegionInfo(regionInfo: BedrockRegionInfo | null): ProcessedModel[] {
  if (!regionInfo) {
    return [FALLBACK_MODEL];
  }

  // Unknownプロバイダーを除外
  const filterUnknown = (model: any) => model.provider && model.provider !== 'Unknown' && model.provider !== 'unknown';

  return [
    ...regionInfo.availableModels
      .filter(filterUnknown)
      .map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        category: model.category || 'General',
        available: true,
        reason: undefined,
        description: model.description || `${model.provider}の${model.name}モデル`
      })),
    ...regionInfo.unavailableModels
      .filter(filterUnknown)
      .map(model => ({
        id: model.modelId,
        name: model.modelName,
        provider: model.provider,
        category: 'General',
        available: false,
        reason: model.reason,
        description: `${model.provider}の${model.modelName}モデル`
      }))
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
    alert(`⚠️ このモデルは現在利用できません\n\nモデル: ${targetModel.name}\n理由: ${targetModel.reason || '不明'}\n\n利用可能なモデルを選択してください。`);
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