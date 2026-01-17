'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ProcessedModel } from './modelUtils';

interface AvailableModelsListProps {
  models: ProcessedModel[];
  selectedModelId: string;
  onModelSelect: (modelId: string) => void;
  showCategories?: boolean;
}

// プロバイダー別のカテゴリ定義
const PROVIDER_CATEGORIES = {
  'Amazon': { name: 'Amazon', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  'Anthropic': { name: 'Anthropic', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  'Meta': { name: 'Meta', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  'Cohere': { name: 'Cohere', color: 'bg-green-50 border-green-200 text-green-800' },
  'AI21': { name: 'AI21', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  'Stability AI': { name: 'Stability AI', color: 'bg-pink-50 border-pink-200 text-pink-800' },
  'Mistral AI': { name: 'Mistral AI', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' }
} as const;

export function AvailableModelsList({ 
  models, 
  selectedModelId, 
  onModelSelect, 
  showCategories = true 
}: AvailableModelsListProps) {
  const t = useTranslations('model.selector');
  const locale = useLocale(); // ロケールを取得
  // 開閉状態の管理（デフォルトでAmazonとAnthropicを展開）
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(['Amazon', 'Anthropic'])
  );
  
  // 選択中のモデルを除外し、利用可能なモデルのみをフィルタリング
  const filteredAvailableModels = useMemo(() => {
    return models.filter(model => 
      model.available && model.id !== selectedModelId
    );
  }, [models, selectedModelId]);

  // カテゴリ別にグループ化（メモ化）
  // localeを依存配列に追加して、言語変更時に再計算
  const categorizedModels = useMemo(() => {
    const categories: Record<string, ProcessedModel[]> = {};
    
    filteredAvailableModels.forEach(model => {
      const provider = model.provider;
      if (!categories[provider]) {
        categories[provider] = [];
      }
      categories[provider].push(model);
    });

    // 各カテゴリ内でモデル名でソート
    Object.keys(categories).forEach(provider => {
      categories[provider].sort((a, b) => {
        const aName = a?.name || '';
        const bName = b?.name || '';
        return aName.localeCompare(bName);
      });
    });

    return categories;
  }, [filteredAvailableModels, locale]);

  // プロバイダーをソート（Amazon, Anthropic, Meta, Cohere, その他の順）
  const sortedProviders = useMemo(() => {
    const providers = Object.keys(categorizedModels);
    const priorityOrder = ['Amazon', 'Anthropic', 'Meta', 'Cohere'];
    
    return providers.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      } else if (aIndex !== -1) {
        return -1;
      } else if (bIndex !== -1) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });
  }, [categorizedModels]);

  // 全利用可能モデル数（選択中を含む）
  const totalAvailableCount = useMemo(() => {
    return models.filter(model => model.available).length;
  }, [models]);

  // プロバイダーの開閉を切り替え
  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  if (filteredAvailableModels.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          {t('availableModels')}がありません
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {t('availableModels')} ({totalAvailableCount}{t('count')})
        </h3>
      </div>

      {showCategories ? (
        // カテゴリ別表示（開閉可能）
        <div className="space-y-2">
          {sortedProviders.map(provider => {
            const categoryModels = categorizedModels[provider];
            const categoryInfo = PROVIDER_CATEGORIES[provider as keyof typeof PROVIDER_CATEGORIES] || 
              { name: provider, color: 'bg-gray-50 border-gray-200 text-gray-800' };
            const isExpanded = expandedProviders.has(provider);

            return (
              <div key={provider} className={`rounded-md border ${categoryInfo.color}`}>
                {/* プロバイダーヘッダー（クリックで開閉） */}
                <button
                  onClick={() => toggleProvider(provider)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="text-sm font-semibold">{categoryInfo.name}</span>
                    <span className="text-xs px-2 py-1 bg-white rounded-full font-medium">
                      {categoryModels.length}{t('count')}
                    </span>
                  </div>
                </button>
                
                {/* モデル一覧（展開時のみ表示） */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {categoryModels.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          if (!model.id) {
                            console.error('[AvailableModelsList] モデルIDが未定義:', model);
                            return;
                          }
                          onModelSelect(model.id);
                        }}
                        className="w-full text-left p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-green-600 font-medium">✅</span>
                            <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                              {model.name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 group-hover:text-gray-600">
                            {t('select')}
                          </span>
                        </div>
                        
                        {model.description && (
                          <div className="mt-1 text-xs text-gray-600 group-hover:text-gray-700 line-clamp-2">
                            {model.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // シンプルなリスト表示
        <div className="space-y-1">
          {filteredAvailableModels.map(model => (
            <button
              key={model.id}
              onClick={() => {
                if (!model.id) {
                  console.error('[AvailableModelsList] モデルIDが未定義:', model);
                  return;
                }
                onModelSelect(model.id);
              }}
              className="w-full text-left p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 font-medium">✅</span>
                  <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                    {model.name}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                    {model.provider}
                  </span>
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-600">
                  {t('select')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}