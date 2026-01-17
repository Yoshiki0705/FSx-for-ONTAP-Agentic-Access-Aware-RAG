'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useSafeTranslations } from '../../hooks/useSafeTranslations';
import { 
  TraceStepType, 
  TraceStepStatus, 
  TraceStepTypeUtils,
  TRACE_STEP_CATEGORIES 
} from '../../types/bedrock-agent-trace';

/**
 * トレースフィルターの設定
 */
export interface TraceFilters {
  /** 表示するステップタイプ */
  visibleStepTypes: Set<TraceStepType>;
  /** 表示するステータス */
  visibleStatuses: Set<TraceStepStatus>;
  /** 検索キーワード */
  searchKeyword: string;
  /** 日時範囲フィルター */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** 実行時間フィルター（ミリ秒） */
  executionTimeRange?: {
    min: number;
    max: number;
  };
  /** 2024年GA機能のみ表示 */
  showOnlyGAFeatures2024: boolean;
  /** エラーステップのみ表示 */
  showOnlyErrors: boolean;
}

/**
 * トレースフィルターパネルのプロパティ
 */
interface TraceFilterPanelProps {
  /** 現在のフィルター設定 */
  filters: TraceFilters;
  /** フィルター変更時のコールバック */
  onFiltersChange: (filters: TraceFilters) => void;
  /** パネルを閉じる時のコールバック */
  onClose: () => void;
  /** フィルターリセット時のコールバック */
  onReset?: () => void;
}

/**
 * デフォルトフィルター設定
 */
export const DEFAULT_TRACE_FILTERS: TraceFilters = {
  visibleStepTypes: new Set(Object.keys(TRACE_STEP_CATEGORIES.BASIC) as TraceStepType[]),
  visibleStatuses: new Set(['STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED'] as TraceStepStatus[]),
  searchKeyword: '',
  showOnlyGAFeatures2024: false,
  showOnlyErrors: false
};

/**
 * TraceFilterPanel - トレースフィルター機能パネル
 * 
 * 2024年GA機能対応のBedrock Agentトレースの高度なフィルタリング機能
 */
export const TraceFilterPanel: React.FC<TraceFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onClose,
  onReset
}) => {
  const { t } = useSafeTranslations();
  
  // ローカル状態（適用前の一時的な設定）
  const [localFilters, setLocalFilters] = useState<TraceFilters>(filters);

  // ステップタイプのカテゴリ別グループ化
  const stepTypeCategories = useMemo(() => {
    return {
      basic: Object.keys(TRACE_STEP_CATEGORIES.BASIC) as TraceStepType[],
      integration: Object.keys(TRACE_STEP_CATEGORIES.INTEGRATION) as TraceStepType[],
      multiAgent: Object.keys(TRACE_STEP_CATEGORIES.MULTI_AGENT) as TraceStepType[],
      advanced: Object.keys(TRACE_STEP_CATEGORIES.ADVANCED) as TraceStepType[]
    };
  }, []);

  // ステップタイプの選択/選択解除
  const toggleStepType = useCallback((stepType: TraceStepType) => {
    setLocalFilters(prev => {
      const newVisibleStepTypes = new Set(prev.visibleStepTypes);
      if (newVisibleStepTypes.has(stepType)) {
        newVisibleStepTypes.delete(stepType);
      } else {
        newVisibleStepTypes.add(stepType);
      }
      return { ...prev, visibleStepTypes: newVisibleStepTypes };
    });
  }, []);

  // カテゴリ全体の選択/選択解除
  const toggleCategory = useCallback((category: keyof typeof stepTypeCategories) => {
    setLocalFilters(prev => {
      const categoryStepTypes = stepTypeCategories[category];
      const newVisibleStepTypes = new Set(prev.visibleStepTypes);
      
      // カテゴリ内の全てのステップタイプが選択されているかチェック
      const allSelected = categoryStepTypes.every(stepType => newVisibleStepTypes.has(stepType));
      
      if (allSelected) {
        // 全て選択されている場合は全て選択解除
        categoryStepTypes.forEach(stepType => newVisibleStepTypes.delete(stepType));
      } else {
        // 一部または全て選択されていない場合は全て選択
        categoryStepTypes.forEach(stepType => newVisibleStepTypes.add(stepType));
      }
      
      return { ...prev, visibleStepTypes: newVisibleStepTypes };
    });
  }, [stepTypeCategories]);

  // ステータスの選択/選択解除
  const toggleStatus = useCallback((status: TraceStepStatus) => {
    setLocalFilters(prev => {
      const newVisibleStatuses = new Set(prev.visibleStatuses);
      if (newVisibleStatuses.has(status)) {
        newVisibleStatuses.delete(status);
      } else {
        newVisibleStatuses.add(status);
      }
      return { ...prev, visibleStatuses: newVisibleStatuses };
    });
  }, []);

  // フィルター適用
  const applyFilters = useCallback(() => {
    onFiltersChange(localFilters);
    onClose();
  }, [localFilters, onFiltersChange, onClose]);

  // フィルターリセット
  const resetFilters = useCallback(() => {
    setLocalFilters(DEFAULT_TRACE_FILTERS);
    onReset?.();
  }, [onReset]);

  // カテゴリの選択状態を取得
  const getCategorySelectionState = useCallback((category: keyof typeof stepTypeCategories) => {
    const categoryStepTypes = stepTypeCategories[category];
    const selectedCount = categoryStepTypes.filter(stepType => 
      localFilters.visibleStepTypes.has(stepType)
    ).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === categoryStepTypes.length) return 'all';
    return 'partial';
  }, [stepTypeCategories, localFilters.visibleStepTypes]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('trace.filter.title')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('trace.filter.description')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左カラム: ステップタイプフィルター */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">{t('trace.filter.stepTypes')}</h3>
              
              {/* 基本ステップ */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    {t('trace.filter.categories.basic')}
                  </h4>
                  <button
                    onClick={() => toggleCategory('basic')}
                    className={`text-xs px-2 py-1 rounded ${
                      getCategorySelectionState('basic') === 'all'
                        ? 'bg-blue-100 text-blue-800'
                        : getCategorySelectionState('basic') === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getCategorySelectionState('basic') === 'all' ? t('common.deselectAll') :
                     getCategorySelectionState('basic') === 'partial' ? t('common.selectAll') :
                     t('common.selectAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {stepTypeCategories.basic.map((stepType) => (
                    <label key={stepType} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.visibleStepTypes.has(stepType)}
                        onChange={() => toggleStepType(stepType)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {TraceStepTypeUtils.getDisplayName(stepType)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 統合ステップ */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    {t('trace.filter.categories.integration')}
                  </h4>
                  <button
                    onClick={() => toggleCategory('integration')}
                    className={`text-xs px-2 py-1 rounded ${
                      getCategorySelectionState('integration') === 'all'
                        ? 'bg-blue-100 text-blue-800'
                        : getCategorySelectionState('integration') === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getCategorySelectionState('integration') === 'all' ? t('common.deselectAll') : t('common.selectAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {stepTypeCategories.integration.map((stepType) => (
                    <label key={stepType} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.visibleStepTypes.has(stepType)}
                        onChange={() => toggleStepType(stepType)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {TraceStepTypeUtils.getDisplayName(stepType)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2024年GA機能 - Multi-Agent */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    {t('trace.filter.categories.multiAgent')}
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      2024 GA
                    </span>
                  </h4>
                  <button
                    onClick={() => toggleCategory('multiAgent')}
                    className={`text-xs px-2 py-1 rounded ${
                      getCategorySelectionState('multiAgent') === 'all'
                        ? 'bg-blue-100 text-blue-800'
                        : getCategorySelectionState('multiAgent') === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getCategorySelectionState('multiAgent') === 'all' ? t('common.deselectAll') : t('common.selectAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {stepTypeCategories.multiAgent.map((stepType) => (
                    <label key={stepType} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.visibleStepTypes.has(stepType)}
                        onChange={() => toggleStepType(stepType)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {TraceStepTypeUtils.getDisplayName(stepType)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 高度な機能 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    {t('trace.filter.categories.advanced')}
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      2024 GA
                    </span>
                  </h4>
                  <button
                    onClick={() => toggleCategory('advanced')}
                    className={`text-xs px-2 py-1 rounded ${
                      getCategorySelectionState('advanced') === 'all'
                        ? 'bg-blue-100 text-blue-800'
                        : getCategorySelectionState('advanced') === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getCategorySelectionState('advanced') === 'all' ? t('common.deselectAll') : t('common.selectAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {stepTypeCategories.advanced.map((stepType) => (
                    <label key={stepType} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.visibleStepTypes.has(stepType)}
                        onChange={() => toggleStepType(stepType)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {TraceStepTypeUtils.getDisplayName(stepType)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 右カラム: その他のフィルター */}
            <div>
              {/* ステータスフィルター */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">{t('trace.filter.statuses')}</h3>
                <div className="space-y-2">
                  {(['STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED'] as TraceStepStatus[]).map((status) => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.visibleStatuses.has(status)}
                        onChange={() => toggleStatus(status)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`ml-2 text-sm px-2 py-1 rounded ${
                        status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                        status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        status === 'STARTED' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 検索キーワード */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">{t('trace.filter.search')}</h3>
                <input
                  type="text"
                  value={localFilters.searchKeyword}
                  onChange={(e) => setLocalFilters(prev => ({ ...prev, searchKeyword: e.target.value }))}
                  placeholder={t('trace.filter.searchPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 特別フィルター */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">{t('trace.filter.specialFilters')}</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localFilters.showOnlyGAFeatures2024}
                      onChange={(e) => setLocalFilters(prev => ({ 
                        ...prev, 
                        showOnlyGAFeatures2024: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      {t('trace.filter.showOnlyGAFeatures2024')}
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        2024 GA
                      </span>
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localFilters.showOnlyErrors}
                      onChange={(e) => setLocalFilters(prev => ({ 
                        ...prev, 
                        showOnlyErrors: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {t('trace.filter.showOnlyErrors')}
                    </span>
                  </label>
                </div>
              </div>

              {/* 実行時間フィルター */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">{t('trace.filter.executionTime')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t('trace.filter.minTime')} (ms)
                    </label>
                    <input
                      type="number"
                      value={localFilters.executionTimeRange?.min || ''}
                      onChange={(e) => setLocalFilters(prev => ({
                        ...prev,
                        executionTimeRange: {
                          ...prev.executionTimeRange,
                          min: parseInt(e.target.value) || 0,
                          max: prev.executionTimeRange?.max || 10000
                        }
                      }))}
                      placeholder="0"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t('trace.filter.maxTime')} (ms)
                    </label>
                    <input
                      type="number"
                      value={localFilters.executionTimeRange?.max || ''}
                      onChange={(e) => setLocalFilters(prev => ({
                        ...prev,
                        executionTimeRange: {
                          min: prev.executionTimeRange?.min || 0,
                          max: parseInt(e.target.value) || 10000
                        }
                      }))}
                      placeholder="10000"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {t('trace.filter.reset')}
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('trace.filter.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraceFilterPanel;