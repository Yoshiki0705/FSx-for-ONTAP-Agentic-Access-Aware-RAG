/**
 * useAgentInfo Hook
 * 作成日: 2025-11-30
 * 更新日: 2025-12-09
 * 
 * Bedrock Agent情報を取得・管理するカスタムフック
 * Agent Info APIを使用してAgent情報を取得し、状態管理を行います
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRegionStore } from '../store/useRegionStore';

/**
 * Bedrock設定情報
 */
interface BedrockConfig {
  agentId: string;
  agentAliasId: string;
  region: string;
}

/**
 * Bedrock Config APIレスポンス
 */
interface BedrockConfigResponse {
  success: boolean;
  config?: BedrockConfig;
  error?: string;
}

/**
 * useBedrockConfigフックの戻り値
 */
interface UseBedrockConfigReturn {
  config: BedrockConfig | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Bedrock設定を取得するカスタムフック
 * 
 * サーバーサイドの環境変数からBedrock設定を取得します。
 * NEXT_PUBLIC_*環境変数の代替として使用します。
 * 
 * @returns Bedrock設定と状態管理関数
 * 
 * @example
 * ```typescript
 * const { config, isLoading, error } = useBedrockConfig();
 * 
 * if (config) {
 *   console.log('Agent ID:', config.agentId);
 * }
 * ```
 */
export function useBedrockConfig(): UseBedrockConfigReturn {
  const [config, setConfig] = useState<BedrockConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Bedrock設定を取得
   */
  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = '/api/bedrock/config';
      console.log('🔄 [useBedrockConfig] 設定取得:', url);

      const response = await fetch(url);
      const data: BedrockConfigResponse = await response.json();

      if (data.success && data.config) {
        setConfig(data.config);
        console.log('✅ [useBedrockConfig] 設定取得成功:', data.config.agentId);
      } else {
        const errorMessage = data.error || 'Bedrock設定の取得に失敗しました';
        setError(errorMessage);
        console.error('❌ [useBedrockConfig] APIエラー:', errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Bedrock設定の取得に失敗しました: ${errorMessage}`);
      console.error('❌ [useBedrockConfig] 設定取得エラー:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 初回マウント時に設定を取得
   */
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    error,
    refetch: fetchConfig
  };
}

/**
 * Agent情報の型定義
 */
export interface AgentInfo {
  agentId: string;
  agentName: string;
  aliasId?: string | null;
  aliasName?: string | null;
  version?: string;
  status?: 'CREATING' | 'PREPARING' | 'PREPARED' | 'NOT_PREPARED' | 'DELETING' | 'FAILED' | 'VERSIONING' | 'UPDATING';
  agentStatus?: 'CREATING' | 'PREPARING' | 'PREPARED' | 'NOT_PREPARED' | 'DELETING' | 'FAILED' | 'VERSIONING' | 'UPDATING';
  foundationModel: string;
  region: string;
  lastUpdated?: string;
  createdAt?: string;
  preparedAt?: string;
}

/**
 * Agent情報エラーの型定義
 */
export interface AgentInfoError {
  message: string;
  code?: string;
  retryable: boolean;
  details?: Record<string, any>;
}

/**
 * Agent Info APIレスポンス
 */
interface AgentInfoResponse {
  success: boolean;
  data?: AgentInfo;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  details?: Record<string, any>;
}

/**
 * useAgentInfoフックの戻り値
 */
interface UseAgentInfoReturn {
  agentInfo: AgentInfo | null;
  isLoading: boolean;
  error: AgentInfoError | null;
  refetch: () => Promise<void>;
  updateAgentInfo: (info: AgentInfo) => void;
}

/**
 * useAgentInfoフックのオプション
 */
interface UseAgentInfoOptions {
  agentId: string;
  region?: string;
  enabled?: boolean;
  onSuccess?: (data: AgentInfo) => void;
  onError?: (error: string) => void;
}

/**
 * Agent情報を取得・管理するカスタムフック
 * 
 * @param options - フックのオプション
 * @returns Agent情報と状態管理関数
 * 
 * @example
 * ```typescript
 * const { agentInfo, isLoading, error, refetch } = useAgentInfo({
 *   agentId: 'O4RW0WSIEA',
 *   region: 'ap-northeast-1',
 *   enabled: true,
 *   onSuccess: (data) => console.log('Agent情報取得成功:', data),
 *   onError: (error) => console.error('Agent情報取得エラー:', error)
 * });
 * ```
 */
export function useAgentInfo(options: UseAgentInfoOptions): UseAgentInfoReturn {
  const {
    agentId,
    region: propRegion,
    enabled = true,
    onSuccess,
    onError
  } = options;

  // State管理
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初期値をtrueに変更
  const [error, setError] = useState<AgentInfoError | null>(null);

  // Zustand Storeからリージョン情報を取得
  const { selectedRegion, isChangingRegion } = useRegionStore();

  // 使用するリージョンを決定（propsが優先）
  const region = propRegion || selectedRegion;

  /**
   * Agent情報を取得
   */
  const fetchAgentInfo = useCallback(async () => {
    // Agent IDのチェック
    if (!agentId) {
      console.log('⏭️ [useAgentInfo] Agent IDが未設定のためスキップ');
      setError({
        message: 'Agent IDが設定されていません',
        code: 'MISSING_AGENT_ID',
        retryable: false,
        details: {
          hint: '管理者に連絡してAgent IDを設定してください'
        }
      });
      setIsLoading(false);
      return;
    }

    // リージョンのチェック（デフォルト値を使用）
    const effectiveRegion = region || 'ap-northeast-1';
    if (!region) {
      console.log(`⚠️ [useAgentInfo] リージョンが未設定のため、デフォルトリージョンを使用: ${effectiveRegion}`);
    }

    // enabledがfalseの場合はスキップ
    if (!enabled) {
      console.log('⏭️ [useAgentInfo] enabled=falseのためスキップ');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `/api/bedrock/agent-info?agentId=${encodeURIComponent(agentId)}&region=${encodeURIComponent(effectiveRegion)}`;
      console.log('🔄 [useAgentInfo] Agent情報取得:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        // HTTPエラーの場合、レスポンスボディを解析してエラー情報を取得
        const errorData = await response.json();
        const errorInfo: AgentInfoError = {
          message: errorData.error || `HTTP ${response.status}: Agent情報の取得に失敗しました`,
          code: errorData.errorCode || `HTTP_${response.status}`,
          retryable: errorData.retryable ?? (response.status >= 500),
          details: errorData.details
        };
        
        setError(errorInfo);
        console.error('❌ [useAgentInfo] HTTPエラー:', errorInfo);

        // エラーコールバック
        if (onError) {
          onError(errorInfo.message);
        }
        return;
      }

      const data = await response.json();

      // レスポンス形式の判定
      if (data.success !== undefined) {
        // 新しい形式: { success: boolean, data?: AgentInfo, error?: string }
        if (data.success && data.data) {
          setAgentInfo(data.data);
          console.log('✅ [useAgentInfo] Agent情報取得成功 (新形式):', data.data.agentId);

          // 成功コールバック
          if (onSuccess) {
            onSuccess(data.data);
          }
        } else {
          // エラー情報を構造化
          const errorInfo: AgentInfoError = {
            message: data.error || 'Agent情報の取得に失敗しました',
            code: data.errorCode,
            retryable: data.retryable ?? true,
            details: data.details
          };
          
          setError(errorInfo);
          console.error('❌ [useAgentInfo] APIエラー (新形式):', errorInfo);

          // エラーコールバック
          if (onError) {
            onError(errorInfo.message);
          }
        }
      } else if (data.agentId) {
        // 旧形式: 直接AgentInfo形式
        setAgentInfo(data);
        console.log('✅ [useAgentInfo] Agent情報取得成功 (旧形式):', data.agentId);

        // 成功コールバック
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        // 不明な形式
        const errorInfo: AgentInfoError = {
          message: 'Agent情報の取得に失敗しました（不明なレスポンス形式）',
          code: 'INVALID_RESPONSE_FORMAT',
          retryable: true,
          details: {
            hint: 'APIレスポンス形式が期待されるものと異なります',
            responseData: data
          }
        };
        
        setError(errorInfo);
        console.error('❌ [useAgentInfo] 不明なレスポンス形式:', errorInfo);

        // エラーコールバック
        if (onError) {
          onError(errorInfo.message);
        }
      }
    } catch (err) {
      // ネットワークエラーなどの予期しないエラー
      const errorInfo: AgentInfoError = {
        message: err instanceof Error ? err.message : 'Agent情報の取得に失敗しました',
        code: 'NETWORK_ERROR',
        retryable: true,
        details: {
          hint: 'ネットワーク接続を確認して、再試行してください',
          originalError: err instanceof Error ? err.toString() : String(err)
        }
      };
      
      setError(errorInfo);
      console.error('❌ [useAgentInfo] Agent情報取得エラー:', err);

      // エラーコールバック
      if (onError) {
        onError(errorInfo.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [agentId, region, enabled, onSuccess, onError]);

  /**
   * Agent情報を手動で更新
   */
  const updateAgentInfo = useCallback((info: AgentInfo) => {
    setAgentInfo(info);
    console.log('🔄 [useAgentInfo] Agent情報を手動更新:', info.agentId);
  }, []);

  /**
   * 初回マウント時とリージョン変更時にAgent情報を取得
   */
  useEffect(() => {
    if (!isChangingRegion && region && agentId && enabled) {
      fetchAgentInfo();
    }
    // fetchAgentInfoを依存配列から除外して無限ループを防ぐ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, agentId, enabled, isChangingRegion]);

  /**
   * リージョン変更イベントを監視
   */
  useEffect(() => {
    const handleRegionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ region: string }>;
      const newRegion = customEvent.detail.region;
      console.log('🔔 [useAgentInfo] リージョン変更イベント受信:', newRegion);

      // リージョン変更後にAgent情報を再取得
      if (agentId && enabled) {
        fetchAgentInfo();
      }
    };

    window.addEventListener('regionChanged', handleRegionChange);
    console.log('👂 [useAgentInfo] regionChangedイベントリスナー登録');

    return () => {
      window.removeEventListener('regionChanged', handleRegionChange);
      console.log('🔇 [useAgentInfo] regionChangedイベントリスナー解除');
    };
  }, [agentId, enabled, fetchAgentInfo]);

  /**
   * モデル更新イベントを監視
   */
  useEffect(() => {
    const handleModelUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ agentId: string; modelId: string; region: string }>;
      console.log('📢 [useAgentInfo] agent-model-updatedイベント受信:', customEvent.detail);

      // 同じAgentのモデル更新の場合のみ再取得
      if (customEvent.detail.agentId === agentId && enabled) {
        console.log('🔄 [useAgentInfo] Agent情報を再取得（モデル更新）');
        fetchAgentInfo();
      }
    };

    window.addEventListener('agent-model-updated', handleModelUpdate);
    console.log('👂 [useAgentInfo] agent-model-updatedイベントリスナー登録');

    return () => {
      window.removeEventListener('agent-model-updated', handleModelUpdate);
      console.log('🔇 [useAgentInfo] agent-model-updatedイベントリスナー解除');
    };
  }, [agentId, enabled, fetchAgentInfo]);

  return {
    agentInfo,
    isLoading,
    error,
    refetch: fetchAgentInfo,
    updateAgentInfo
  };
}

/**
 * Agent情報をlocalStorageにキャッシュするバージョン
 * 
 * @param options - フックのオプション
 * @returns Agent情報と状態管理関数
 * 
 * @example
 * ```typescript
 * const { agentInfo, isLoading, error, refetch } = useAgentInfoWithCache({
 *   agentId: 'O4RW0WSIEA',
 *   region: 'ap-northeast-1'
 * });
 * ```
 */
export function useAgentInfoWithCache(options: UseAgentInfoOptions): UseAgentInfoReturn {
  const { agentId, region: propRegion } = options;
  const { selectedRegion } = useRegionStore();
  const region = propRegion || selectedRegion;

  // キャッシュキーを生成
  const cacheKey = `agentInfo_${agentId}_${region}`;

  // localStorageからキャッシュを読み込み
  const [cachedInfo, setCachedInfo] = useState<AgentInfo | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log('📦 [useAgentInfoWithCache] キャッシュから読み込み:', agentId);
          return parsed;
        }
      } catch (error) {
        console.error('❌ [useAgentInfoWithCache] キャッシュ読み込みエラー:', error);
      }
    }
    return null;
  });

  // 基本のuseAgentInfoフックを使用
  const result = useAgentInfo({
    ...options,
    onSuccess: (data) => {
      // キャッシュに保存
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
          console.log('💾 [useAgentInfoWithCache] キャッシュに保存:', agentId);
        } catch (error) {
          console.error('❌ [useAgentInfoWithCache] キャッシュ保存エラー:', error);
        }
      }

      // 元のonSuccessコールバックを呼び出し
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    }
  });

  // キャッシュがある場合は初期値として使用
  const agentInfo = result.agentInfo || cachedInfo;

  return {
    ...result,
    agentInfo
  };
}

/**
 * Agent情報のポーリング機能付きフック
 * 
 * @param options - フックのオプション
 * @param interval - ポーリング間隔（ミリ秒）
 * @returns Agent情報と状態管理関数
 * 
 * @example
 * ```typescript
 * const { agentInfo, isLoading, error, refetch } = useAgentInfoPolling({
 *   agentId: 'O4RW0WSIEA',
 *   region: 'ap-northeast-1'
 * }, 30000); // 30秒ごとにポーリング
 * ```
 */
export function useAgentInfoPolling(
  options: UseAgentInfoOptions,
  interval: number = 30000
): UseAgentInfoReturn {
  const result = useAgentInfo(options);

  /**
   * ポーリング処理
   */
  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    const intervalId = setInterval(() => {
      console.log('🔄 [useAgentInfoPolling] ポーリング実行');
      result.refetch();
    }, interval);

    console.log(`⏰ [useAgentInfoPolling] ポーリング開始（間隔: ${interval}ms）`);

    return () => {
      clearInterval(intervalId);
      console.log('⏹️ [useAgentInfoPolling] ポーリング停止');
    };
  }, [options.enabled, interval, result.refetch]);

  return result;
}
