/**
 * システムカラースキーム検出フック
 * prefers-color-schemeメディアクエリを監視
 */

'use client';

import { useEffect, useState } from 'react';
import { EffectiveTheme } from '@/types/theme';

/**
 * システムのカラースキーム設定を検出し、変更を監視するフック
 */
export function useSystemTheme(): EffectiveTheme {
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // 初期値を設定
    handleChange(mediaQuery);

    // 変更を監視
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return systemTheme;
}
