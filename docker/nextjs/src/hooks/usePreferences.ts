/**
 * usePreferences Hook
 * ユーザー設定の管理を行うReact Hook
 * 
 * Task 3.2: 設定永続化システム実装
 * 作成日時: 2026-01-07
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * ユーザー設定型定義
 */
export interface UserPreferences {
  defaultModel?: string;
  defaultRegion?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  chatHistoryRetentionDays?: number;
}

/**
 * 保存ステータス型定義
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * usePreferences Hook
 * 
 * 機能:
 * - ユーザー設定の読み込み
 * - ユーザー設定の保存（全体・部分）
 * - ユーザー設定の削除
 * - 自動保存（デバウンス処理）
 * - エラーハンドリング
 * 
 * 使用例:
 * ```typescript
 * const {
 *   preferences,
 *   isLoading,
 *   error,
 *   saveStatus,
 *   loadPreferences,
 *   savePreferences,
 *   updatePreference,
 *   deletePreference,
 *   clearAllPreferences,
 * } = usePreferences();
 * 
 * // 設定読み込み
 * useEffect(() => {
 *   loadPreferences();
 * }, []);
 * 
 * // 設定更新
 * await updatePreference('theme', 'dark');
 * ```
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const { isAuthenticated } = useAuthStore();

  /**
   * 設定読み込み
   */
  const loadPreferences = useCallback(async () => {
    console.log('🔄 [usePreferences] loadPreferences開始', { isAuthenticated });
    
    if (!isAuthenticated) {
      console.log('⚠️ [usePreferences] 未認証のため設定読み込みをスキップ');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('📡 [usePreferences] API呼び出し開始: GET /api/preferences');

      const response = await fetch('/api/preferences', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [usePreferences] API応答:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証エラー: ログインしてください');
        }
        throw new Error(`設定の読み込みに失敗しました: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [usePreferences] 設定読み込み成功:', data);
      setPreferences(data.preferences || {});
    } catch (err) {
      console.error('[usePreferences] Load Error:', err);
      setError(err instanceof Error ? err.message : '設定の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * 設定保存（全体更新）
   */
  const savePreferences = useCallback(async (newPreferences: UserPreferences) => {
    if (!isAuthenticated) {
      setError('認証エラー: ログインしてください');
      return;
    }

    try {
      setSaveStatus('saving');
      setError(null);

      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences: newPreferences }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証エラー: ログインしてください');
        }
        throw new Error(`設定の保存に失敗しました: ${response.status}`);
      }

      setPreferences(newPreferences);
      setSaveStatus('saved');

      // 2秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[usePreferences] Save Error:', err);
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました');
      setSaveStatus('error');
    }
  }, [isAuthenticated]);

  /**
   * 設定更新（部分更新）
   */
  const updatePreference = useCallback(async (
    key: keyof UserPreferences,
    value: any
  ) => {
    if (!isAuthenticated) {
      setError('認証エラー: ログインしてください');
      return;
    }

    try {
      setSaveStatus('saving');
      setError(null);

      const response = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証エラー: ログインしてください');
        }
        throw new Error(`設定の更新に失敗しました: ${response.status}`);
      }

      // ローカル状態を更新（関数形式のState Updater使用）
      setPreferences(prev => ({
        ...prev,
        [key]: value,
      }));

      setSaveStatus('saved');

      // 2秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[usePreferences] Update Error:', err);
      setError(err instanceof Error ? err.message : '設定の更新に失敗しました');
      setSaveStatus('error');
    }
  }, [isAuthenticated]);

  /**
   * 設定削除
   */
  const deletePreference = useCallback(async (key: keyof UserPreferences) => {
    if (!isAuthenticated) {
      setError('認証エラー: ログインしてください');
      return;
    }

    try {
      setSaveStatus('saving');
      setError(null);

      const response = await fetch(`/api/preferences?key=${key}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証エラー: ログインしてください');
        }
        throw new Error(`設定の削除に失敗しました: ${response.status}`);
      }

      // ローカル状態を更新（関数形式のState Updater使用）
      setPreferences(prev => {
        const newPreferences = { ...prev };
        delete newPreferences[key];
        return newPreferences;
      });

      setSaveStatus('saved');

      // 2秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[usePreferences] Delete Error:', err);
      setError(err instanceof Error ? err.message : '設定の削除に失敗しました');
      setSaveStatus('error');
    }
  }, [isAuthenticated]);

  /**
   * 全設定削除
   */
  const clearAllPreferences = useCallback(async () => {
    if (!isAuthenticated) {
      setError('認証エラー: ログインしてください');
      return;
    }

    try {
      setSaveStatus('saving');
      setError(null);

      // 全設定キーを取得して削除
      const keys = Object.keys(preferences) as Array<keyof UserPreferences>;
      const deletePromises = keys.map(key =>
        fetch(`/api/preferences?key=${key}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      await Promise.all(deletePromises);

      setPreferences({});
      setSaveStatus('saved');

      // 2秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[usePreferences] Clear All Error:', err);
      setError(err instanceof Error ? err.message : '全設定の削除に失敗しました');
      setSaveStatus('error');
    }
  }, [isAuthenticated, preferences]);

  /**
   * 初回読み込み
   */
  useEffect(() => {
    console.log('🚀 [usePreferences] 初期化useEffect実行', { isAuthenticated });
    if (isAuthenticated) {
      console.log('✅ [usePreferences] 認証済み、設定読み込み開始');
      loadPreferences();
    } else {
      console.log('⚠️ [usePreferences] 未認証、設定読み込みをスキップ');
    }
  }, [isAuthenticated, loadPreferences]);

  return {
    preferences,
    isLoading,
    error,
    saveStatus,
    loadPreferences,
    savePreferences,
    updatePreference,
    deletePreference,
    clearAllPreferences,
  };
}
