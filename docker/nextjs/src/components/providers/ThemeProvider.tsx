/**
 * テーマプロバイダーコンポーネント
 * アプリケーション全体のテーマ管理を提供
 */

'use client';

import { useEffect } from 'react';
import { useThemeStore, initializeThemeListener } from '@/store/useThemeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * テーマプロバイダー
 * アプリケーションのルートレベルで使用
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, effectiveTheme, setTheme } = useThemeStore();

  useEffect(() => {
    // 初期テーマを適用
    setTheme(theme);

    // システムカラースキーム変更の監視を開始
    const cleanup = initializeThemeListener();

    return cleanup;
  }, [theme, setTheme]);

  return <>{children}</>;
}
