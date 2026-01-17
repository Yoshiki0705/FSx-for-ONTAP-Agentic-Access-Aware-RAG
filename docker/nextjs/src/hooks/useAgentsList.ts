/**
 * useAgentsList Hook
 * 作成日: 2025-12-31
 * 
 * Bedrock Agents一覧を取得・管理するカスタムフック
 * Agents List APIを使用してAgents一覧を取得し、状態管理を行います
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRegionStore } from '../store/useRegionStore';

/**
 * Agent Summary情報の型定義
 */
export interface AgentSummary {
  agentId: string;
  agentName: string;
  agentStatus: 'CREATING' | 'PREPARING' | 'PREPARED' | 'NOT_PREPARED' | 'DELETING' | 'FAILED' | 'VERSIONING' | 'UPDATING';
  description?: string;
  updatedAt: string;
  latestAgentVersion?: string;
}

/**
 * Agents List APIレスポンス
 */
interface AgentsListResponse {
  success: boolean;
  agents?: AgentSummary[];
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  details?: Record<string, any>;
}

/**
 * Agents Listエラーの型定義
 */
export interface AgentsListError {
  message: string;
  code?: string;
  retryable: boolean;
  details?: Record<string, any>;
}

/**
 * useAgentsListフックの戻り値
 */
interface UseAgentsListReturn {
  agents: AgentSummary[];
  isLoading: boolean;
  error: AgentsListError | null;
  refetch: () => Promise<void>;
}

/**
 * useAgentsListフックのオプション
 */
interface UseAgentsListOptions {
  region?: string;
  enabled?: boolean;
  onSuccess?: (data: AgentSummary[]) => void;
  onError?: (error: string) => void;
}

/**
 * Agents一覧を取得・管理するカスタムフック
 * 
 * @param options - フックのオプション
 * @returns Agents一覧と状態管理関数
 * 
 * @example
 * ```typescript
 * const { agents, isLoading, error, refetch } = useAgentsList({
 *   region: 'ap-northeast-1',
 *   enabled: true,
 *   onSuccess: (data) => console.log('Agents一覧取得成功:', data),
 *   onError: (error) => console.error('Agents一覧取得エラー:', error)
 * });
 * ```
 */
export function useAgentsList(options: UseAgentsListOptions = {}): UseAgentsListReturn {
  const {
    region: propRegion,
    enabled = true,
    onSuccess,
    onError
  } = options;

  // State管理
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AgentsListError | null>(null);

  // Zustand Storeからリージョン情報を取得
  const { selectedRegion, isChangingRegion } = useRegionStore();

  // 使用するリージョンを決定（propsが優先）
  const region = propRegion || selectedRegion;

  /**
   * Agents一覧を取得
   */
  const fetchAgentsList = useCallback(async () => {
    // リージョンのチェック（デフォルト値を使用）
    const effectiveRegion = region || 'ap-northeast-1';
    if (!region) {
      console.log(`⚠️ [useAgentsList] リージョンが未設定のため、デフォルトリージョンを使用: ${effectiveRegion}`);
    }

    // enabledがfalseの場合はスキップ
    if (!enabled) {
      console.log('⏭️ [useAgentsList] enabled=falseのためスキップ');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `/api/bedrock/agents/list?region=${encodeURIComponent(effectiveRegion)}`;
      console.log('🔄 [useAgentsList] Agents一覧取得:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        // HTTPエラーの場合、レスポンスボディを解析してエラー情報を取得
        const errorData: AgentsListResponse = await response.json();
        const errorInfo: AgentsListError = {
          message: errorData.error || `HTTP ${response.status}: Agents一覧の取得に失敗しました`,
          code: errorData.errorCode || `HTTP_${response.status}`,
          retryable: errorData.retryable ?? (response.status >= 500),
          details: errorData.details
        };
        
        setError(errorInfo);
        console.error('❌ [useAgentsList] HTTPエラー:', errorInfo);

        // エラーコールバック
        if (onError) {
          onError(errorInfo.message);
        }
        return;
      }

      const data: AgentsListResponse = await response.json();

      if (data.success && data.agents) {
        setAgents(data.agents);
        console.log(`✅ [useAgentsList] Agents一覧取得成功: ${data.agents.length}件`);

        // 成功コールバック
        if (onSuccess) {
          onSuccess(data.agents);
        }
      } else {
        // エラー情報を構造化
        const errorInfo: AgentsListError = {
          message: data.error || 'Agents一覧の取得に失敗しました',
          code: data.errorCode,
          retryable: data.retryable ?? true,
          details: data.details
        };
        
        setError(errorInfo);
        console.error('❌ [useAgentsList] APIエラー:', errorInfo);

        // エラーコールバック
        if (onError) {
          onError(errorInfo.message);
        }
      }
    } catch (err) {
      // ネットワークエラーなどの予期しないエラー
      const errorInfo: AgentsListError = {
        message: err instanceof Error ? err.message : 'Agents一覧の取得に失敗しました',
        code: 'NETWORK_ERROR',
        retryable: true,
        details: {
          hint: 'ネットワーク接続を確認して、再試行してください',
          originalError: err instanceof Error ? err.toString() : String(err)
        }
      };
      
      setError(errorInfo);
      console.error('❌ [useAgentsList] Agents一覧取得エラー:', err);

      // エラーコールバック
      if (onError) {
        onError(errorInfo.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [region, enabled, onSuccess, onError]);

  /**
   * 初回マウント時とリージョン変更時にAgents一覧を取得
   */
  useEffect(() => {
    if (!isChangingRegion && region && enabled) {
      fetchAgentsList();
    }
    // fetchAgentsListを依存配列から除外して無限ループを防ぐ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, enabled, isChangingRegion]);

  /**
   * リージョン変更イベントを監視
   */
  useEffect(() => {
    const handleRegionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ region: string }>;
      const newRegion = customEvent.detail.region;
      console.log('🔔 [useAgentsList] リージョン変更イベント受信:', newRegion);

      // リージョン変更後にAgents一覧を再取得
      if (enabled) {
        fetchAgentsList();
      }
    };

    window.addEventListener('regionChanged', handleRegionChange);
    console.log('👂 [useAgentsList] regionChangedイベントリスナー登録');

    return () => {
      window.removeEventListener('regionChanged', handleRegionChange);
      console.log('🔇 [useAgentsList] regionChangedイベントリスナー解除');
    };
  }, [enabled, fetchAgentsList]);

  return {
    agents,
    isLoading,
    error,
    refetch: fetchAgentsList
  };
}
