'use client';

import { useTranslations, useLocale } from 'next-intl';
import { ProcessedModel } from './modelUtils';

interface SelectedModelInfoProps {
  model: ProcessedModel | null;
  onModelChange?: (modelId: string) => void;
  availableModels?: ProcessedModel[];
  showRecommendations?: boolean;
}

export function SelectedModelInfo({ 
  model, 
  onModelChange, 
  availableModels = [],
  showRecommendations = true 
}: SelectedModelInfoProps) {
  const t = useTranslations('model.selector');
  const locale = useLocale(); // ロケールを取得（言語変更時の再レンダリング用）
  
  if (!model) {
    return (
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          {t('noModelSelected')}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-md border ${
      model.available 
        ? 'bg-blue-50 border-blue-200' 
        : 'bg-red-50 border-red-200'
    }`}>
      {/* 選択中モデルのヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className={`text-lg font-medium ${model.available ? 'text-blue-700' : 'text-red-600'}`}>
            {model.available ? '✅' : '❌'}
          </span>
          <span className="text-sm font-medium text-gray-600">{t('currentlySelected')}</span>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full font-medium ${
          model.available 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {model.available ? t('available') : t('unavailable')}
        </div>
      </div>

      {/* モデル詳細情報 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`font-semibold text-base ${model.available ? 'text-blue-900' : 'text-red-900'}`}>
              {model.name}
            </span>
            <span className={`text-sm font-medium px-2 py-1 rounded ${
              model.available ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
            }`}>
              {model.provider}
            </span>
          </div>
        </div>

        {/* モデル説明 */}
        {model.description && (
          <div className={`text-sm ${model.available ? 'text-blue-800' : 'text-red-800'}`}>
            {model.description}
          </div>
        )}

        {/* モデル機能情報 */}
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className={`${model.available ? 'text-blue-700' : 'text-red-700'}`}>
            <span className="font-medium">{t('category')}:</span> {model.category}
          </div>
        </div>

        {/* モデルID */}
        <div className={`text-xs ${model.available ? 'text-blue-700' : 'text-red-700'}`}>
          <span className="font-medium">{t('modelId')}:</span>
          <code className="ml-1 px-1 py-0.5 bg-gray-200 rounded text-xs font-mono text-gray-900">
            {model.id}
          </code>
        </div>
      </div>

      {/* 利用不可能な場合の理由表示と推奨アクション */}
      {!model.available && (
        <div className="mt-3 space-y-2">
          <div className="p-2 bg-red-100 rounded border border-red-200">
            <div className="text-red-900 text-xs">
              <span className="font-semibold">⚠️ {t('unavailableReason')}:</span>
              <div className="mt-1 font-medium">{model.reason || t('unknownError')}</div>
            </div>
          </div>
          
          {/* 推奨モデルの提案 */}
          {showRecommendations && availableModels.length > 0 && onModelChange && (
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <div className="text-blue-900 text-xs">
                <span className="font-semibold">💡 {t('recommendedAction')}:</span>
                <div className="mt-1 font-medium">
                  {t('selectFromAvailable')}
                  <div className="mt-1 space-y-1">
                    {availableModels.slice(0, 3).map(availableModel => (
                      <button
                        key={availableModel.id}
                        onClick={() => onModelChange(availableModel.id)}
                        className="block w-full text-left px-2 py-1 bg-white rounded border border-blue-200 hover:bg-blue-50 text-blue-800 font-medium hover:text-blue-900 transition-colors"
                      >
                        ✅ {availableModel.name} ({availableModel.provider})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}