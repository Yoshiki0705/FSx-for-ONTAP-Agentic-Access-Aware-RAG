'use client';

import { usePathname } from 'next/navigation';
import { locales, defaultLocale, type Locale } from '../i18n/config';

/**
 * 現在のロケールを取得するフック
 */
export function useLocale(): Locale {
  const pathname = usePathname();
  
  // パスから言語コードを抽出 (/ja/genai -> ja)
  const segments = pathname.split('/');
  const localeFromPath = segments[1];
  
  // 有効なロケールかチェック
  if (locales.includes(localeFromPath as Locale)) {
    return localeFromPath as Locale;
  }
  
  // フォールバック
  return defaultLocale;
}