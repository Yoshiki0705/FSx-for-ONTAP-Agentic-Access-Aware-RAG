/**
 * テーマ関連の型定義
 */

/**
 * テーマモード
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 実効テーマ（システム設定を考慮した実際のテーマ）
 */
export type EffectiveTheme = 'light' | 'dark';

/**
 * テーマ設定
 */
export interface ThemeConfig {
  mode: ThemeMode;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    border: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  spacing: {
    unit: number; // 基本単位（px）
  };
}

/**
 * テーマストアの状態
 */
export interface ThemeStore {
  theme: ThemeMode;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}
