/**
 * テーマ管理用Zustandストア
 * ライト/ダーク/システムテーマの切り替えを管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeMode, EffectiveTheme, ThemeStore } from '@/types/theme';

/**
 * システムのカラースキーム設定を検出
 */
const getSystemTheme = (): EffectiveTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * 実効テーマを計算（システム設定を考慮）
 */
const getEffectiveTheme = (theme: ThemeMode): EffectiveTheme => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

/**
 * テーマストア
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      effectiveTheme: 'light',

      /**
       * テーマを設定
       */
      setTheme: (theme: ThemeMode) => {
        const effectiveTheme = getEffectiveTheme(theme);
        
        set({ theme, effectiveTheme });
        
        // DOMにクラスを適用
        if (typeof window !== 'undefined') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(effectiveTheme);
        }
      },

      /**
       * テーマをトグル（light ⇔ dark）
       */
      toggleTheme: () => {
        const { theme } = get();
        const currentEffective = getEffectiveTheme(theme);
        const newTheme: ThemeMode = currentEffective === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },
    }),
    {
      name: 'theme-storage',
      // localStorageに保存するキー
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

/**
 * システムカラースキーム変更の監視を初期化
 */
export const initializeThemeListener = () => {
  if (typeof window === 'undefined') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = () => {
    const store = useThemeStore.getState();
    if (store.theme === 'system') {
      const effectiveTheme = getSystemTheme();
      useThemeStore.setState({ effectiveTheme });
      
      // DOMにクラスを適用
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveTheme);
    }
  };

  // 初期設定
  handleChange();

  // 変更を監視
  mediaQuery.addEventListener('change', handleChange);

  // クリーンアップ関数を返す
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
};
