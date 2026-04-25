/**
 * useAgentCore Hook
 * 
 * AgentCore機能の状態管理とUI統合を提供
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  AgentCoreClient, 
  createAgentCoreClient, 
  AgentCoreConfig, 
  UIResponse,
  DEFAULT_AGENTCORE_CONFIG 
} from '@/services/agentcore-client';

export interface AgentCoreSettings {
  enabled: boolean;
  apiEndpoint: string;
  timeout: number;
  retryAttempts: number;
  fallbackToBedrockDirect: boolean;
  autoSave: boolean;
}

export interface AgentCoreState {
  isEnabled: boolean;
  isHealthy: boolean;
  isProcessing: boolean;
  lastError: string | null;
  settings: AgentCoreSettings;
}

export interface UseAgentCoreReturn {
  // 状態
  state: AgentCoreState;
  
  // アクション
  processInput: (input: string, context?: any) => Promise<UIResponse>;
  toggleEnabled: () => Promise<void>;
  updateSettings: (settings: Partial<AgentCoreSettings>) => Promise<void>;
  checkHealth: () => Promise<boolean>;
  
  // ユーティリティ
  isAvailable: boolean;
  canFallback: boolean;
}

/**
 * AgentCore機能を管理するカスタムフック
 */
export function useAgentCore(): UseAgentCoreReturn {
  const { session } = useAuthStore();
  
  // 状態管理
  const [state, setState] = useState<AgentCoreState>({
    isEnabled: false,
    isHealthy: false,
    isProcessing: false,
    lastError: null,
    settings: {
      enabled: DEFAULT_AGENTCORE_CONFIG.enabled,
      apiEndpoint: '/api/agentcore/invoke', // Lambda直接呼び出し用エンドポイント
      timeout: DEFAULT_AGENTCORE_CONFIG.timeout,
      retryAttempts: DEFAULT_AGENTCORE_CONFIG.retryAttempts,
      fallbackToBedrockDirect: DEFAULT_AGENTCORE_CONFIG.fallbackToBedrockDirect,
      autoSave: true,
    }
  });

  // AgentCore Clientインスタンス
  const client = useMemo(() => {
    return createAgentCoreClient({
      enabled: state.settings.enabled,
      apiEndpoint: state.settings.apiEndpoint,
      timeout: state.settings.timeout,
      retryAttempts: state.settings.retryAttempts,
      fallbackToBedrockDirect: state.settings.fallbackToBedrockDirect,
    });
  }, [state.settings]);

  // 初期化
  useEffect(() => {
    loadSettings();
  }, [session?.user?.username]);

  // ヘルスチェック（定期実行）
  useEffect(() => {
    if (state.settings.enabled) {
      const interval = setInterval(checkHealth, 60000); // 1分間隔
      checkHealth(); // 初回実行
      return () => clearInterval(interval);
    }
  }, [state.settings.enabled]);

  /**
   * 設定を読み込み
   */
  const loadSettings = useCallback(async () => {
    if (!session?.user?.username) return;

    try {
      const response = await fetch('/api/preferences/agentcore', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const savedSettings = await response.json();
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...savedSettings },
          isEnabled: savedSettings.enabled || false,
        }));
      }
    } catch (error) {
      console.warn('[useAgentCore] Failed to load settings:', error);
    }
  }, [session?.user?.username]);

  /**
   * 設定を保存
   */
  const saveSettings = useCallback(async (settings: Partial<AgentCoreSettings>) => {
    if (!session?.user?.username || !state.settings.autoSave) return;

    try {
      await fetch('/api/preferences/agentcore', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.warn('[useAgentCore] Failed to save settings:', error);
    }
  }, [session?.user?.userId, state.settings.autoSave]);

  /**
   * ユーザー入力を処理
   */
  const processInput = useCallback(async (input: string, context?: any): Promise<UIResponse> => {
    setState(prev => ({ ...prev, isProcessing: true, lastError: null }));

    try {
      const enrichedContext = {
        ...context,
        sessionId: context?.sessionId,
        userId: session?.user?.username,
        preferences: state.settings,
      };

      const response = await client.processUserInput(input, enrichedContext);
      
      setState(prev => ({ ...prev, isProcessing: false }));
      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        lastError: errorMessage 
      }));
      throw error;
    }
  }, [client, session, state.settings]);

  /**
   * AgentCore機能の有効/無効を切り替え
   */
  const toggleEnabled = useCallback(async () => {
    const newEnabled = !state.settings.enabled;
    
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, enabled: newEnabled },
      isEnabled: newEnabled,
    }));

    await saveSettings({ enabled: newEnabled });
    
    if (newEnabled) {
      // 有効化時はヘルスチェック実行
      await checkHealth();
    }
  }, [state.settings.enabled, saveSettings]);

  /**
   * 設定を更新
   */
  const updateSettings = useCallback(async (newSettings: Partial<AgentCoreSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings },
      isEnabled: newSettings.enabled ?? prev.settings.enabled,
    }));

    await saveSettings(newSettings);
    
    // 設定変更後はヘルスチェック実行
    if (newSettings.enabled !== false) {
      await checkHealth();
    }
  }, [saveSettings]);

  /**
   * ヘルスチェック実行
   */
  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (!state.settings.enabled) {
      setState(prev => ({ ...prev, isHealthy: false }));
      return false;
    }

    try {
      const isHealthy = await client.healthCheck();
      setState(prev => ({ ...prev, isHealthy }));
      return isHealthy;
    } catch (error) {
      console.warn('[useAgentCore] Health check failed:', error);
      setState(prev => ({ ...prev, isHealthy: false }));
      return false;
    }
  }, [client, state.settings.enabled]);

  // 計算されたプロパティ
  const isAvailable = useMemo(() => {
    return state.settings.enabled && state.isHealthy;
  }, [state.settings.enabled, state.isHealthy]);

  const canFallback = useMemo(() => {
    return state.settings.fallbackToBedrockDirect;
  }, [state.settings.fallbackToBedrockDirect]);

  return {
    state,
    processInput,
    toggleEnabled,
    updateSettings,
    checkHealth,
    isAvailable,
    canFallback,
  };
}

/**
 * AgentCore設定のデフォルト値（API Gateway無効版対応）
 */
export const DEFAULT_AGENTCORE_SETTINGS: AgentCoreSettings = {
  enabled: false,
  apiEndpoint: '/api/agentcore/invoke', // Lambda直接呼び出し用エンドポイント
  timeout: 30000,
  retryAttempts: 3,
  fallbackToBedrockDirect: true,
  autoSave: true,
};