'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { BedrockModel } from '../../config/bedrock-models';

interface UnavailableModelsListProps {
  unavailableModels: BedrockModel[];
  unavailableModelsCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// プロバイダー別のカテゴリ定義
const PROVIDER_CATEGORIES = {
  'Amazon': { name: 'Amazon', color: 'bg-red-50 border-red-200 text-red-800' },
  'Anthropic': { name: 'Anthropic', color: 'bg-red-50 border-red-200 text-red-800' },
  'Meta': { name: 'Meta', color: 'bg-red-50 border-red-200 text-red-800' },
  'Cohere': { name: 'Cohere', color: 'bg-red-50 border-red-200 text-red-800' },
  'AI21': { name: 'AI21', color: 'bg-red-50 border-red-200 text-red-800' },
  'Stability AI': { name: 'Stability AI', color: 'bg-red-50 border-red-200 text-red-800' },
  'Mistral AI': { name: 'Mistral AI', color: 'bg-red-50 border-red-200 text-red-800' }
} as const;

export function UnavailableModelsList({ 
  unavailableModels, 
  unavailableModelsCount,
  isExpanded = false, 
  onToggle 
}: UnavailableModelsListProps) {
  const t = useTranslations('model.selector');
  const locale = useLocale(); // ロケールを取得
  // 開閉状態の管理（デフォルトで全て折りたたみ）
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  
  const count = unavailableModelsCount || unavailableModels.length;
  
  // プロバイダー別にグループ化
  // localeを依存配列に追加して、言語変更時に再計算
  const categorizedModels = useMemo(() => {
    const categories: Record<string, BedrockModel[]> = {};
    
    unavailableModels.forEach(model => {
      const provider = model.provider.charAt(0).toUpperCase() + model.provider.slice(1);
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
  }, [unavailableModels, locale]);

  // プロバイダーをソート
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
  
  if (count === 0) {
    return null;
  }

  // セクション全体の開閉状態
  const [sectionExpanded, setSectionExpanded] = useState(false);

  return (
    <div className="mt-4 border-t border-red-200 pt-4">
      {/* セクションヘッダー（常に表示） */}
      <button
        onClick={() => onToggle ? onToggle() : setSectionExpanded(!sectionExpanded)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-red-700 hover:text-red-900 mb-3"
      >
        <div className="flex items-center space-x-2">
          <span>❌ {t('unavailableModels')} ({count}{t('count')})</span>
        </div>
        <span className="ml-2 text-red-600">
          {(onToggle ? isExpanded : sectionExpanded) ? '▼' : '▶'}
        </span>
      </button>
      
      {((onToggle ? isExpanded : sectionExpanded)) && (
        <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
          {sortedProviders.map(provider => {
            const categoryModels = categorizedModels[provider];
            const categoryInfo = PROVIDER_CATEGORIES[provider as keyof typeof PROVIDER_CATEGORIES] || 
              { name: provider, color: 'bg-red-50 border-red-200 text-red-800' };
            const isProviderExpanded = expandedProviders.has(provider);

            return (
              <div key={provider} className={`rounded-md border ${categoryInfo.color}`}>
                {/* プロバイダーヘッダー（クリックで開閉） */}
                <button
                  onClick={() => toggleProvider(provider)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-red-600">
                      {isProviderExpanded ? '▼' : '▶'}
                    </span>
                    <span className="text-sm font-semibold text-red-800">{categoryInfo.name}</span>
                    <span className="text-xs px-2 py-1 bg-white rounded-full font-medium text-red-700">
                      {categoryModels.length}{t('count')}
                    </span>
                  </div>
                </button>
                
                {/* モデル一覧（展開時のみ表示） */}
                {isProviderExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {categoryModels.map(model => (
                      <div
                        key={model.id}
                        className="p-2 bg-white border border-red-200 rounded text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-red-600">❌</span>
                            <span className="font-medium text-gray-900">{model.name}</span>
                          </div>
                        </div>
                        {model.description && (
                          <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                            {model.description}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-red-600">
                          {t('notAvailableInRegion')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}