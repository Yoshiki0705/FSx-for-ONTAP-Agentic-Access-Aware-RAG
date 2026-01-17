'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { SearchFilters } from '@/hooks/useChatSearch';
import { Calendar, Filter, X } from 'lucide-react';

interface AdvancedFiltersProps {
  /** 現在のフィルター */
  filters: SearchFilters;
  /** フィルター変更時のコールバック */
  onFiltersChange: (filters: SearchFilters) => void;
  /** 利用可能なモデルリスト */
  availableModels?: string[];
  /** 利用可能なユーザーリスト */
  availableUsers?: string[];
}

/**
 * 高度なフィルタリングコンポーネント
 * 日付範囲、モデル、ユーザー、ロールでフィルタリング
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableModels = [],
  availableUsers = []
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  /**
   * 日付範囲の開始日を更新
   */
  const handleStartDateChange = (date: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        start: date ? new Date(date) : undefined
      }
    });
  };

  /**
   * 日付範囲の終了日を更新
   */
  const handleEndDateChange = (date: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        end: date ? new Date(date) : undefined
      }
    });
  };

  /**
   * モデルフィルターを更新
   */
  const handleModelToggle = (model: string) => {
    const currentModels = filters.models || [];
    const newModels = currentModels.includes(model)
      ? currentModels.filter(m => m !== model)
      : [...currentModels, model];
    
    onFiltersChange({
      ...filters,
      models: newModels.length > 0 ? newModels : undefined
    });
  };

  /**
   * ロールフィルターを更新
   */
  const handleRoleToggle = (role: 'user' | 'assistant' | 'system') => {
    const currentRoles = filters.roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    onFiltersChange({
      ...filters,
      roles: newRoles.length > 0 ? newRoles : undefined
    });
  };

  /**
   * 全フィルターをクリア
   */
  const handleClearAll = () => {
    onFiltersChange({});
  };

  /**
   * アクティブなフィルター数を計算
   */
  const activeFilterCount = 
    (filters.dateRange?.start || filters.dateRange?.end ? 1 : 0) +
    (filters.models && filters.models.length > 0 ? 1 : 0) +
    (filters.users && filters.users.length > 0 ? 1 : 0) +
    (filters.roles && filters.roles.length > 0 ? 1 : 0);

  return (
    <div className="relative">
      {/* フィルターボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2
          bg-gray-100 dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-lg
          text-sm font-medium
          hover:bg-gray-200 dark:hover:bg-gray-700
          transition-colors
        "
        aria-label="フィルターを開く"
        aria-expanded={isOpen}
      >
        <Filter className="w-4 h-4" />
        <span>フィルター</span>
        {activeFilterCount > 0 && (
          <span className="
            px-1.5 py-0.5
            bg-blue-600 text-white
            rounded-full
            text-xs font-bold
          ">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* フィルターパネル */}
      {isOpen && (
        <div className="
          absolute top-full left-0 mt-2 z-50
          w-80
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-lg shadow-lg
          p-4
        ">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">フィルターt("sidebar.settings")</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 日付範囲フィルター */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              日付範囲
            </label>
            <div className="space-y-2">
              <input
                type="date"
                value={filters.dateRange?.start?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="
                  w-full px-3 py-2
                  bg-gray-50 dark:bg-gray-900
                  border border-gray-200 dark:border-gray-700
                  rounded-lg
                  text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                "
                placeholder="開始日"
              />
              <input
                type="date"
                value={filters.dateRange?.end?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="
                  w-full px-3 py-2
                  bg-gray-50 dark:bg-gray-900
                  border border-gray-200 dark:border-gray-700
                  rounded-lg
                  text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                "
                placeholder="終了日"
              />
            </div>
          </div>

          {/* モデルフィルター */}
          {availableModels.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                モデル
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {availableModels && Array.isArray(availableModels) && availableModels.map(model => (
                  <label
                    key={model}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={filters.models?.includes(model) || false}
                      onChange={() => handleModelToggle(model)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{model}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ロールフィルター */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              メッセージタイプ
            </label>
            <div className="space-y-1">
              {(['user', 'assistant', 'system'] as const).map(role => (
                <label
                  key={role}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={filters.roles?.includes(role) || false}
                    onChange={() => handleRoleToggle(role)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm capitalize">
                    {role === 'user' ? 'ユーザー' : 
                     role === 'assistant' ? 'アシスタント' : 
                     'システム'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* クリアボタン */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearAll}
              className="
                w-full px-3 py-2
                bg-gray-100 dark:bg-gray-700
                text-gray-700 dark:text-gray-300
                rounded-lg
                text-sm font-medium
                hover:bg-gray-200 dark:hover:bg-gray-600
                transition-colors
              "
            >
              全てクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}
