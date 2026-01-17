/**
 * usePreferencesSync Hook
 * usePreferencesとZustand Storeを同期するヘルパーフック
 * 
 * Task 3.2: 設定永続化システム実装
 * 作成日時: 2026-01-07
 */

import { useEffect } from 'react';
import { usePreferences } from './usePreferences';
import { useThemeStore } from '@/store/useThemeStore';
import { useRegionStore } from '@/store/useRegionStore';
import { ThemeMode } from '@/types/theme';

/**
 * usePreferencesSync Hook
 * 
 * 機能:
 * - DynamoDBからユーザー設定を読み込み、Zustand Storeに反映
 * - Zustand Storeの変更をDynamoDBに保存
 * 
 * 使用例:
 * ```typescript
 * // アプリケーションのルートコンポーネントで呼び出し
 * function App() {
 *   usePreferencesSync();
 *   return <YourApp />;
 * }
 * ```
 */
export function usePreferencesSync() {
  const { preferences, isLoading, updatePreference } = usePreferences();
  const { setTheme } = useThemeStore();
  const { setRegion } = useRegionStore();

  /**
   * DynamoDBからの設定読み込み → Zustand Storeへの反映
   */
  useEffect(() => {
    console.log('🔄 [usePreferencesSync] useEffect実行', { isLoading, preferences });
    
    if (isLoading) {
      console.log('⏳ [usePreferencesSync] 読み込み中のためスキップ');
      return;
    }

    // テーマ設定の同期
    if (preferences.theme) {
      console.log('🎨 [usePreferencesSync] テーマ設定を同期:', preferences.theme);
      setTheme(preferences.theme as ThemeMode);
    } else {
      console.log('⚠️ [usePreferencesSync] テーマ設定が見つかりません');
    }

    // リージョン設定の同期
    if (preferences.defaultRegion) {
      console.log('🌍 [usePreferencesSync] リージョン設定を同期:', preferences.defaultRegion);
      setRegion(preferences.defaultRegion);
    } else {
      console.log('⚠️ [usePreferencesSync] リージョン設定が見つかりません');
    }
  }, [preferences, isLoading, setTheme, setRegion]);

  console.log('🔄 [usePreferencesSync] フック実行', { preferences, isLoading });

  return {
    preferences,
    isLoading,
    updatePreference,
  };
}

/**
 * useThemePreference Hook
 * テーマ設定の読み込みと保存を行うヘルパーフック
 * 
 * 使用例:
 * ```typescript
 * const { theme, setThemeWithSync } = useThemePreference();
 * 
 * // テーマ変更（ローカル + DynamoDB保存）
 * await setThemeWithSync('dark');
 * ```
 */
export function useThemePreference() {
  const { theme, setTheme } = useThemeStore();
  const { updatePreference } = usePreferences();

  const setThemeWithSync = async (newTheme: ThemeMode) => {
    // ローカル状態を即座に更新
    setTheme(newTheme);
    
    // DynamoDBに保存
    await updatePreference('theme', newTheme);
  };

  return {
    theme,
    setThemeWithSync,
  };
}

/**
 * useRegionPreference Hook
 * リージョン設定の読み込みと保存を行うヘルパーフック
 * 
 * 使用例:
 * ```typescript
 * const { selectedRegion, setRegionWithSync } = useRegionPreference();
 * 
 * // リージョン変更（ローカル + DynamoDB保存）
 * await setRegionWithSync('us-east-1');
 * ```
 */
export function useRegionPreference() {
  const { selectedRegion, setRegion } = useRegionStore();
  const { updatePreference } = usePreferences();

  const setRegionWithSync = async (newRegion: string) => {
    // ローカル状態を即座に更新
    setRegion(newRegion);
    
    // DynamoDBに保存
    await updatePreference('defaultRegion', newRegion);
  };

  return {
    selectedRegion,
    setRegionWithSync,
  };
}
