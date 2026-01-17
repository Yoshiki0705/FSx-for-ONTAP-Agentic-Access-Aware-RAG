'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// テーマの型定義
export type Theme = 'light' | 'dark';

// テーマ設定の型定義
export interface ThemeConfig {
  theme: Theme;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
  };
}

// ライトテーマの定義
export const lightTheme: ThemeConfig = {
  theme: 'light',
  colors: {
    background: 'bg-white',
    foreground: 'text-gray-900',
    card: 'bg-white',
    cardForeground: 'text-gray-900',
    primary: 'bg-blue-600',
    primaryForeground: 'text-white',
    secondary: 'bg-gray-100',
    secondaryForeground: 'text-gray-900',
    muted: 'bg-gray-50',
    mutedForeground: 'text-gray-600',
    accent: 'bg-blue-50',
    accentForeground: 'text-blue-900',
    destructive: 'bg-red-500',
    destructiveForeground: 'text-white',
    border: 'border-gray-200',
    input: 'border-gray-300',
    ring: 'ring-blue-500'
  }
};

// ダークテーマの定義
export const darkTheme: ThemeConfig = {
  theme: 'dark',
  colors: {
    background: 'bg-gray-900',
    foreground: 'text-gray-100',
    card: 'bg-gray-800',
    cardForeground: 'text-gray-100',
    primary: 'bg-blue-500',
    primaryForeground: 'text-white',
    secondary: 'bg-gray-700',
    secondaryForeground: 'text-gray-100',
    muted: 'bg-gray-800',
    mutedForeground: 'text-gray-400',
    accent: 'bg-blue-900',
    accentForeground: 'text-blue-100',
    destructive: 'bg-red-600',
    destructiveForeground: 'text-white',
    border: 'border-gray-700',
    input: 'border-gray-600',
    ring: 'ring-blue-400'
  }
};

// テーマコンテキストの型定義
export interface ThemeContextType {
  theme: Theme;
  themeConfig: ThemeConfig;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// テーマコンテキストの作成
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// テーマプロバイダーのプロパティ
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

// テーマプロバイダーコンポーネント
export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'ui-theme'
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // ローカルストレージからテーマを読み込み
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme;
      if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
        setThemeState(storedTheme);
      }
    } catch (error) {
      console.warn('テーマの読み込みに失敗しました:', error);
    }
  }, [storageKey]);

  // テーマ変更時にローカルストレージに保存
  const setTheme = (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      localStorage.setItem(storageKey, newTheme);
    } catch (error) {
      console.warn('テーマの保存に失敗しました:', error);
    }
  };

  // テーマ切り替え機能
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // 現在のテーマ設定を取得
  const themeConfig = theme === 'dark' ? darkTheme : lightTheme;

  const value: ThemeContextType = {
    theme,
    themeConfig,
    toggleTheme,
    setTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className={theme === 'dark' ? 'dark' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// useThemeカスタムフック
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}