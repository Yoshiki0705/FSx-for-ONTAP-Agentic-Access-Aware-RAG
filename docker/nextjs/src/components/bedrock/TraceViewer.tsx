'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useSafeTranslations } from '../../hooks/useSafeTranslations';
import { BedrockAgentTrace, TraceStep, TraceStepType, TraceStepStatus } from '../../types/bedrock-agent-trace';
import StepDetailsPanel from './StepDetailsPanel';
import TraceExportPanel from './TraceExportPanel';
import TraceFilterPanel, { TraceFilters, DEFAULT_TRACE_FILTERS } from './TraceFilterPanel';

/**
 * TraceViewerコンポーネントの表示設定
 */
export interface TraceDisplayConfig {
  /** 詳細モード */
  detailMode?: 'SIMPLE' | 'DETAILED';
  /** タイムライン表示 */
  showTimeline?: boolean;
  /** パフォーマンス統計表示 */
  showPerformance?: boolean;
  /** 2024年GA機能表示 */
  showGAFeatures2024?: boolean;
}

/**
 * TraceViewerコンポーネントのプロパティ
 */
interface TraceViewerProps {
  /** 表示するトレース */
  traces: BedrockAgentTrace[];
  /** 表示設定 */
  displayConfig?: TraceDisplayConfig;
  /** ステップクリック時のコールバック */
  onStepClick?: (step: TraceStep, trace: BedrockAgentTrace) => void;
  /** トレースエクスポート時のコールバック */
  onExportTrace?: (trace: BedrockAgentTrace) => void;
}

/**
 * ステップタイプのアイコンマッピング
 */
const STEP_TYPE_ICONS: Record<TraceStepType, string> = {
  'PRE_PROCESSING': '🔄',
  'ORCHESTRATION': '🎯',
  'POST_PROCESSING': '✅',
  'KNOWLEDGE_BASE': '📚',
  'ACTION_GROUP': '⚡',
  'GUARDRAILS': '🛡️',
  'MULTI_AGENT_COLLABORATION': '🤝',
  'INLINE_AGENT_INVOCATION': '🔗',
  'PAYLOAD_REFERENCING': '📎',
  'KNOWLEDGE_BASE_LOOKUP': '🔍',
  'BASIC': '📝',
  'INTEGRATION': '🔗',
  'MULTI_AGENT': '🤝',
  'ADVANCED': '⚡'
};

/**
 * ステップタイプの表示名
 */
const STEP_TYPE_DISPLAY_NAMES: Record<TraceStepType, string> = {
  'PRE_PROCESSING': '前処理',
  'ORCHESTRATION': 'オーケストレーション',
  'POST_PROCESSING': '後処理',
  'KNOWLEDGE_BASE': 'Knowledge Base検索',
  'ACTION_GROUP': 'Action Group実行',
  'GUARDRAILS': 'Guardrails評価',
  'MULTI_AGENT_COLLABORATION': 'Multi-Agent連携',
  'INLINE_AGENT_INVOCATION': 'Inline Agent実行',
  'PAYLOAD_REFERENCING': 'Payload最適化',
  'KNOWLEDGE_BASE_LOOKUP': 'Knowledge Base検索',
  'BASIC': '基本処理',
  'INTEGRATION': '統合処理',
  'MULTI_AGENT': 'マルチエージェント',
  'ADVANCED': '高度な処理'
};

/**
 * ステップステータスの色マッピング
 */
const STEP_STATUS_COLORS: Record<TraceStepStatus, string> = {
  'STARTED': 'blue',
  'IN_PROGRESS': 'yellow',
  'COMPLETED': 'green',
  'FAILED': 'red',
  'SKIPPED': 'gray'
};

/**
 * TraceViewer - 2024年GA機能対応のBedrock Agentトレース表示コンポーネント
 */
export function TraceViewer({ 
  traces, 
  displayConfig = {}, 
  onStepClick,
  onExportTrace 
}: TraceViewerProps) {
  const { t } = useSafeTranslations();
  
  // デフォルト表示設定
  const {
    detailMode = 'SIMPLE',
    showTimeline = true,
    showPerformance = true,
    showGAFeatures2024 = true
  } = displayConfig;

  // 状態管理
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [selectedStep, setSelectedStep] = useState<{ step: TraceStep; trace: BedrockAgentTrace } | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<TraceFilters>(DEFAULT_TRACE_FILTERS);

  // フィルタリングされたトレース
  const filteredTraces = useMemo(() => {
    return traces.filter(trace => {
      // キーワード検索
      if (filters.searchKeyword) {
        const searchLower = filters.searchKeyword.toLowerCase();
        const matchesKeyword = 
          (trace.userQuery ?? '').toLowerCase().includes(searchLower) ||
          (trace.finalResponse ?? '').toLowerCase().includes(searchLower) ||
          (trace.steps ?? []).some(step => 
            (step.name ?? '').toLowerCase().includes(searchLower)
          );
        if (!matchesKeyword) return false;
      }

      // 2024年GA機能のみ表示フィルター
      if (filters.showOnlyGAFeatures2024) {
        const hasGAFeatures = (trace.steps ?? []).some(step => 
          ['MULTI_AGENT_COLLABORATION', 'INLINE_AGENT_INVOCATION', 'PAYLOAD_REFERENCING'].includes(step.type)
        );
        if (!hasGAFeatures) return false;
      }

      // エラーのみ表示フィルター
      if (filters.showOnlyErrors) {
        const hasErrors = (trace.steps ?? []).some(step => step.status === 'FAILED');
        if (!hasErrors) return false;
      }

      // 日時範囲フィルター
      if (filters.dateRange) {
        const traceDate = new Date(trace.startTime ?? new Date());
        if (traceDate < filters.dateRange.start || traceDate > filters.dateRange.end) {
          return false;
        }
      }

      // ステップタイプ・ステータスフィルター
      const hasVisibleSteps = (trace.steps ?? []).some(step => 
        filters.visibleStepTypes.has(step.type) && filters.visibleStatuses.has(step.status)
      );
      
      return hasVisibleSteps;
    });
  }, [traces, filters]);

  // トレースの展開/折りたたみ
  const toggleTrace = useCallback((traceId: string) => {
    setExpandedTraces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(traceId)) {
        newSet.delete(traceId);
      } else {
        newSet.add(traceId);
      }
      return newSet;
    });
  }, []);

  // ステップの展開/折りたたみ
  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  }, []);

  // ステップ詳細表示
  const handleStepClick = useCallback((step: TraceStep, trace: BedrockAgentTrace) => {
    setSelectedStep({ step, trace });
    onStepClick?.(step, trace);
  }, [onStepClick]);

  // エクスポート完了ハンドラー
  const handleExportComplete = useCallback((filename: string, format: string) => {
    console.log(`Export completed: ${filename} (${format})`);
    setShowExportPanel(false);
  }, []);

  // フィルター適用ハンドラー
  const handleFiltersChange = useCallback((newFilters: TraceFilters) => {
    setFilters(newFilters);
  }, []);

  // フィルターリセットハンドラー
  const handleFiltersReset = useCallback(() => {
    setFilters(DEFAULT_TRACE_FILTERS);
  }, []);

  // 全て展開/折りたたみ
  const toggleAllTraces = useCallback((expand: boolean) => {
    if (expand) {
      setExpandedTraces(new Set(filteredTraces.map(trace => trace.traceId)));
    } else {
      setExpandedTraces(new Set());
    }
  }, [filteredTraces]);

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('trace.viewer.title')}
          </h2>
          <span className="text-sm text-gray-500">
            {filteredTraces.length} / {traces.length} {t('trace.viewer.tracesCount')}
          </span>
          {showGAFeatures2024 && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              2024 GA {t('trace.viewer.featuresEnabled')}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 全て展開/折りたたみボタン */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => toggleAllTraces(true)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              {t('trace.viewer.expandAll')}
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => toggleAllTraces(false)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              {t('trace.viewer.collapseAll')}
            </button>
          </div>

          {/* フィルターボタン */}
          <button
            onClick={() => setShowFilterPanel(true)}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            {t('trace.viewer.filter')}
          </button>

          {/* エクスポートボタン */}
          <button
            onClick={() => setShowExportPanel(true)}
            disabled={filteredTraces.length === 0}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('trace.viewer.export')}
          </button>
        </div>
      </div>

      {/* トレース一覧 */}
      <div className="space-y-4">
        {filteredTraces.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {t('trace.viewer.noTraces')}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('trace.viewer.noTracesDescription')}
            </p>
          </div>
        ) : (
          filteredTraces.map((trace) => (
            <TraceCard
              key={trace.traceId}
              trace={trace}
              isExpanded={expandedTraces.has(trace.traceId)}
              expandedSteps={expandedSteps}
              onToggle={() => toggleTrace(trace.traceId)}
              onStepToggle={toggleStep}
              onStepClick={handleStepClick}
              showGAFeatures2024={showGAFeatures2024}
              showPerformance={showPerformance}
              detailMode={detailMode}
              filters={filters}
            />
          ))
        )}
      </div>

      {/* ステップ詳細パネル */}
      {selectedStep && (
        <StepDetailsPanel
          step={selectedStep.step}
          onClose={() => setSelectedStep(null)}
          detailMode={detailMode}
        />
      )}

      {/* エクスポートパネル */}
      {showExportPanel && (
        <TraceExportPanel
          traces={filteredTraces}
          onClose={() => setShowExportPanel(false)}
          onExportComplete={handleExportComplete}
        />
      )}

      {/* フィルターパネル */}
      {showFilterPanel && (
        <TraceFilterPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClose={() => setShowFilterPanel(false)}
          onReset={handleFiltersReset}
        />
      )}
    </div>
  );
};

/**
 * TraceCard - 個別のトレース表示カード
 */
interface TraceCardProps {
  trace: BedrockAgentTrace;
  isExpanded: boolean;
  expandedSteps: Set<string>;
  onToggle: () => void;
  onStepToggle: (stepId: string) => void;
  onStepClick: (step: TraceStep, trace: BedrockAgentTrace) => void;
  showGAFeatures2024: boolean;
  showPerformance: boolean;
  detailMode: 'SIMPLE' | 'DETAILED';
  filters: TraceFilters;
}

const TraceCard: React.FC<TraceCardProps> = ({
  trace,
  isExpanded,
  expandedSteps,
  onToggle,
  onStepToggle,
  onStepClick,
  showGAFeatures2024,
  showPerformance,
  detailMode,
  filters
}) => {
  const { t } = useSafeTranslations();

  // フィルタリングされたステップ
  const filteredSteps = useMemo(() => {
    return (trace.steps ?? []).filter(step => 
      filters.visibleStepTypes.has(step.type) && 
      filters.visibleStatuses.has(step.status)
    );
  }, [trace.steps, filters]);

  // パフォーマンス統計
  const performanceStats = useMemo(() => {
    if (!showPerformance) return null;

    const totalDuration = trace.endTime && trace.startTime 
      ? new Date(trace.endTime).getTime() - new Date(trace.startTime).getTime()
      : 0;

    const totalTokens = 0; // Token usage not available in TraceStep interface

    return { totalDuration, totalTokens };
  }, [trace, showPerformance]);

  // 2024年GA機能統計
  const gaFeatureStats = useMemo(() => {
    if (!showGAFeatures2024) return null;

    const multiAgentSteps = (trace.steps ?? []).filter(s => s.type === 'MULTI_AGENT_COLLABORATION').length;
    const inlineAgentSteps = (trace.steps ?? []).filter(s => s.type === 'INLINE_AGENT_INVOCATION').length;
    const payloadOptSteps = (trace.steps ?? []).filter(s => s.type === 'PAYLOAD_REFERENCING').length;

    return { multiAgentSteps, inlineAgentSteps, payloadOptSteps };
  }, [trace, showGAFeatures2024]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* トレースヘッダー */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <button
                onClick={onToggle}
                className="flex items-center text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                <svg 
                  className={`w-4 h-4 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {trace.traceId}
              </button>
              
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                trace.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                trace.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                trace.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trace.status}
              </span>

              <span className="text-xs text-gray-500">
                {new Date(trace.startTime ?? new Date()).toLocaleString()}
              </span>
            </div>

            <div className="mt-2">
              <p className="text-sm text-gray-600 line-clamp-2">
                <span className="font-medium">{t('trace.card.query')}:</span> {trace.userQuery ?? 'N/A'}
              </p>
              {detailMode === 'DETAILED' && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  <span className="font-medium">{t('trace.card.response')}:</span> {trace.finalResponse}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{filteredSteps.length} {t('trace.card.steps')}</span>
            
            {performanceStats && (
              <>
                <span>{performanceStats.totalDuration}ms</span>
                <span>{performanceStats.totalTokens} {t('trace.card.tokens')}</span>
              </>
            )}

            {gaFeatureStats && (gaFeatureStats.multiAgentSteps > 0 || gaFeatureStats.inlineAgentSteps > 0 || gaFeatureStats.payloadOptSteps > 0) && (
              <div className="flex items-center space-x-1">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  2024 GA
                </span>
                {gaFeatureStats.multiAgentSteps > 0 && (
                  <span className="text-xs text-blue-600">MA:{gaFeatureStats.multiAgentSteps}</span>
                )}
                {gaFeatureStats.inlineAgentSteps > 0 && (
                  <span className="text-xs text-teal-600">IA:{gaFeatureStats.inlineAgentSteps}</span>
                )}
                {gaFeatureStats.payloadOptSteps > 0 && (
                  <span className="text-xs text-orange-600">PO:{gaFeatureStats.payloadOptSteps}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ステップ一覧（展開時） */}
      {isExpanded && (
        <div className="p-4">
          <div className="space-y-2">
            {filteredSteps.map((step, index) => (
              <StepCard
                key={step.stepId ?? step.id}
                step={step}
                trace={trace}
                index={index}
                isExpanded={expandedSteps.has(step.stepId ?? step.id)}
                onToggle={() => onStepToggle(step.stepId ?? step.id)}
                onClick={() => onStepClick(step, trace)}
                showGAFeatures2024={showGAFeatures2024}
                detailMode={detailMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * StepCard - 個別のステップ表示カード
 */
interface StepCardProps {
  step: TraceStep;
  trace: BedrockAgentTrace;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  showGAFeatures2024: boolean;
  detailMode: 'SIMPLE' | 'DETAILED';
}

const StepCard: React.FC<StepCardProps> = ({
  step,
  trace,
  index,
  isExpanded,
  onToggle,
  onClick,
  showGAFeatures2024,
  detailMode
}) => {
  const { t } = useSafeTranslations();

  // 2024年GA機能ステップかどうか
  const isGA2024Step = ['MULTI_AGENT_COLLABORATION', 'INLINE_AGENT_INVOCATION', 'PAYLOAD_REFERENCING'].includes(step.type);

  // ステップの実行時間
  const executionTime = useMemo(() => {
    if (!step.startTime || !step.endTime) return null;
    return new Date(step.endTime).getTime() - new Date(step.startTime).getTime();
  }, [step.startTime, step.endTime]);

  return (
    <div className={`border rounded-lg p-3 transition-colors hover:bg-gray-50 ${
      isGA2024Step && showGAFeatures2024 ? 'border-green-200 bg-green-50' : 'border-gray-200'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{STEP_TYPE_ICONS[step.type]}</span>
            <span className="text-xs text-gray-500">#{index + 1}</span>
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <button
                onClick={onClick}
                className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                {step.name}
              </button>
              
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                STEP_STATUS_COLORS[step.status] === 'green' ? 'bg-green-100 text-green-800' :
                STEP_STATUS_COLORS[step.status] === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                STEP_STATUS_COLORS[step.status] === 'red' ? 'bg-red-100 text-red-800' :
                STEP_STATUS_COLORS[step.status] === 'blue' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {step.status}
              </span>

              {isGA2024Step && showGAFeatures2024 && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  2024 GA
                </span>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-1">
              {STEP_TYPE_DISPLAY_NAMES[step.type]}
            </div>

            {detailMode === 'DETAILED' && step.details && (
              <div className="mt-2 space-y-1">
                {step.details.input && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">{t('trace.step.input')}:</span> {JSON.stringify(step.details.input).substring(0, 100)}...
                  </p>
                )}
                {step.details.output && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">{t('trace.step.output')}:</span> {JSON.stringify(step.details.output).substring(0, 100)}...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-gray-500">
          {executionTime && (
            <span>{executionTime}ms</span>
          )}

          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ステップ詳細（展開時） */}
      {isExpanded && detailMode === 'DETAILED' && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 space-y-1">
            {step.startTime && (
              <div>
                <span className="font-medium">{t('trace.step.startTime')}:</span> {new Date(step.startTime).toLocaleString()}
              </div>
            )}
            {step.endTime && (
              <div>
                <span className="font-medium">{t('trace.step.endTime')}:</span> {new Date(step.endTime).toLocaleString()}
              </div>
            )}
            {step.details && step.details.input && (
              <div>
                <span className="font-medium">{t('trace.step.input')}:</span> {JSON.stringify(step.details.input).substring(0, 200)}...
              </div>
            )}
            {step.details && step.details.output && (
              <div>
                <span className="font-medium">{t('trace.step.output')}:</span> {JSON.stringify(step.details.output).substring(0, 200)}...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TraceViewer;