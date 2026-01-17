'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { BedrockAgentTrace, TraceEvent } from '../types/bedrock-agent-trace';

/**
 * Agent トレース管理フックの設定
 */
interface UseAgentTraceConfig {
  /** トレース自動更新間隔（ミリ秒） */
  autoRefreshInterval?: number;
  /** 最大保持トレース数 */
  maxTraces?: number;
  /** 2024年GA機能の有効化 */
  enableGAFeatures2024?: boolean;
}

/**
 * トレースフィルター設定
 */
interface TraceFilters {
  /** キーワード検索 */
  searchKeyword: string;
  /** 日付範囲フィルター */
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * トレース統計情報
 */
interface TraceStatistics {
  /** 総トレース数 */
  totalTraces: number;
  /** 成功したトレース数 */
  successfulTraces: number;
  /** 失敗したトレース数 */
  failedTraces: number;
}

/**
 * useAgentTrace - Bedrock Agentトレース状態管理フック
 * 
 * 機能:
 * - トレースデータの詳細状態管理
 * - トレース有効/無効の切り替え機能
 * - リアルタイム更新機能
 * - フィルタリング・検索機能
 * - エクスポート機能
 * - 統計情報の計算
 */
export function useAgentTrace(config: UseAgentTraceConfig = {}) {
  const {
    autoRefreshInterval = 0, // デフォルトは自動更新なし
    maxTraces = 100,
    enableGAFeatures2024 = true
  } = config;

  // 状態管理
  const [traces, setTraces] = useState<BedrockAgentTrace[]>([]);
  const [isTraceEnabled, setIsTraceEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // フィルター状態
  const [filters, setFilters] = useState<TraceFilters>({
    searchKeyword: '',
    dateRange: undefined
  });

  // 選択状態
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());

  // フィルタリングされたトレース
  const filteredTraces = useMemo(() => {
    return traces.filter(trace => {
      // キーワード検索
      if (filters.searchKeyword) {
        const searchLower = filters.searchKeyword.toLowerCase();
        const matchesKeyword = 
          trace.traceId.toLowerCase().includes(searchLower) ||
          trace.sessionId.toLowerCase().includes(searchLower) ||
          trace.agentId.toLowerCase().includes(searchLower) ||
          trace.events?.some(event => 
            event.eventType.toLowerCase().includes(searchLower) ||
            JSON.stringify(event.details).toLowerCase().includes(searchLower)
          );
        if (!matchesKeyword) return false;
      }

      // 日付範囲フィルター
      if (filters.dateRange) {
        const traceDate = new Date(trace.timestamp ?? new Date());
        if (traceDate < filters.dateRange.start || traceDate > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }, [traces, filters]);

  // 統計情報の計算
  const statistics = useMemo((): TraceStatistics => {
    const totalTraces = traces.length;
    const successfulTraces = traces.filter(trace => 
      trace.events?.some(event => event.eventType === 'POST_PROCESSING')
    ).length;
    const failedTraces = totalTraces - successfulTraces;

    return {
      totalTraces,
      successfulTraces,
      failedTraces
    };
  }, [traces]);

  // トレース追加
  const addTrace = useCallback((trace: BedrockAgentTrace) => {
    setTraces(prev => {
      const newTraces = [trace, ...prev];
      // 最大数を超えた場合は古いものを削除
      if (newTraces.length > maxTraces) {
        return newTraces.slice(0, maxTraces);
      }
      return newTraces;
    });
    setLastUpdated(new Date());
  }, [maxTraces]);

  // トレース更新
  const updateTrace = useCallback((traceId: string, updatedTrace: Partial<BedrockAgentTrace>) => {
    setTraces(prev => prev.map(trace => 
      trace.traceId === traceId 
        ? { ...trace, ...updatedTrace }
        : trace
    ));
    setLastUpdated(new Date());
  }, []);

  // トレース削除
  const removeTrace = useCallback((traceId: string) => {
    setTraces(prev => prev.filter(trace => trace.traceId !== traceId));
    if (selectedTraceId === traceId) {
      setSelectedTraceId(null);
    }
    setExpandedTraces(prev => {
      const newSet = new Set(prev);
      newSet.delete(traceId);
      return newSet;
    });
    setLastUpdated(new Date());
  }, [selectedTraceId]);

  // 全トレースクリア
  const clearTraces = useCallback(() => {
    setTraces([]);
    setSelectedTraceId(null);
    setExpandedTraces(new Set());
    setLastUpdated(new Date());
  }, []);

  // トレース有効/無効切り替え
  const toggleTraceEnabled = useCallback(() => {
    setIsTraceEnabled(prev => !prev);
  }, []);

  // フィルター更新
  const updateFilters = useCallback((newFilters: Partial<TraceFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // フィルターリセット
  const resetFilters = useCallback(() => {
    setFilters({
      searchKeyword: '',
      dateRange: undefined
    });
  }, []);

  // トレース選択
  const selectTrace = useCallback((traceId: string | null) => {
    setSelectedTraceId(traceId);
  }, []);

  // トレース展開/折りたたみ
  const toggleTraceExpanded = useCallback((traceId: string) => {
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

  // 全て展開/折りたたみ
  const toggleAllExpanded = useCallback((expand: boolean) => {
    if (expand) {
      setExpandedTraces(new Set(filteredTraces.map(trace => trace.traceId)));
    } else {
      setExpandedTraces(new Set());
    }
  }, [filteredTraces]);

  // トレースエクスポート
  const exportTrace = useCallback((trace: BedrockAgentTrace, format: 'json' | 'csv' = 'json') => {
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(trace, null, 2);
        filename = `bedrock-agent-trace-${trace.traceId.substring(0, 8)}-${Date.now()}.json`;
        mimeType = 'application/json';
      } else {
        // CSV形式でのエクスポート（簡易版）
        const csvRows = [
          ['Event Type', 'Timestamp', 'Details'],
          ...(trace.events?.map(event => [
            event.eventType,
            event.timestamp,
            JSON.stringify(event.details)
          ]) || [])
        ];
        content = csvRows.map(row => row.join(',')).join('\n');
        filename = `bedrock-agent-trace-${trace.traceId.substring(0, 8)}-${Date.now()}.csv`;
        mimeType = 'text/csv';
      }

      // ダウンロード実行
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (error) {
      console.error('トレースエクスポートエラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // 全トレースエクスポート
  const exportAllTraces = useCallback((format: 'json' | 'csv' = 'json') => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalTraces: traces.length,
        statistics,
        traces: filteredTraces
      };

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(exportData, null, 2);
        filename = `bedrock-agent-traces-${Date.now()}.json`;
        mimeType = 'application/json';
      } else {
        // CSV形式（全トレースの統計情報）
        const csvRows = [
          ['Trace ID', 'Session ID', 'Agent ID', 'Timestamp', 'Event Count'],
          ...filteredTraces.map(trace => [
            trace.traceId,
            trace.sessionId,
            trace.agentId,
            trace.timestamp,
            (trace.events?.length || 0).toString()
          ])
        ];
        content = csvRows.map(row => row.join(',')).join('\n');
        filename = `bedrock-agent-traces-${Date.now()}.csv`;
        mimeType = 'text/csv';
      }

      // ダウンロード実行
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true, filename, exportedCount: filteredTraces.length };
    } catch (error) {
      console.error('全トレースエクスポートエラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [traces, filteredTraces, statistics]);

  // APIからトレースデータを取得
  const fetchTraces = useCallback(async (sessionId?: string) => {
    if (!isTraceEnabled) return { success: true, traces: [] };

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (sessionId) params.append('sessionId', sessionId);
      if (enableGAFeatures2024) params.append('includeGAFeatures2024', 'true');

      const response = await fetch(`/api/bedrock/agent-trace?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`トレース取得エラー: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.traces) {
        setTraces(data.traces);
        setLastUpdated(new Date());
        return { success: true, traces: data.traces };
      } else {
        throw new Error(data.error || 'トレースデータの取得に失敗しました');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('トレース取得エラー:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isTraceEnabled, enableGAFeatures2024]);

  // 自動更新の設定
  useEffect(() => {
    if (autoRefreshInterval > 0 && isTraceEnabled) {
      const interval = setInterval(() => {
        fetchTraces();
      }, autoRefreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval, isTraceEnabled, fetchTraces]);

  // 選択されたトレースの取得
  const selectedTrace = useMemo(() => {
    return selectedTraceId ? traces.find(trace => trace.traceId === selectedTraceId) : null;
  }, [selectedTraceId, traces]);

  return {
    // データ
    traces,
    filteredTraces,
    selectedTrace,
    statistics,
    
    // 状態
    isTraceEnabled,
    isLoading,
    error,
    lastUpdated,
    
    // フィルター
    filters,
    
    // 選択・展開状態
    selectedTraceId,
    expandedTraces,
    
    // アクション
    addTrace,
    updateTrace,
    removeTrace,
    clearTraces,
    toggleTraceEnabled,
    updateFilters,
    resetFilters,
    selectTrace,
    toggleTraceExpanded,
    toggleAllExpanded,
    exportTrace,
    exportAllTraces,
    fetchTraces,
    
    // 設定
    config: {
      autoRefreshInterval,
      maxTraces,
      enableGAFeatures2024
    }
  };
}

/**
 * トレース統計情報を計算するヘルパー関数
 */
export function calculateTraceStatistics(traces: BedrockAgentTrace[]): TraceStatistics {
  const totalTraces = traces.length;
  const successfulTraces = traces.filter(trace => 
    trace.events?.some(event => event.eventType === 'POST_PROCESSING')
  ).length;
  const failedTraces = totalTraces - successfulTraces;

  return {
    totalTraces,
    successfulTraces,
    failedTraces
  };
}
