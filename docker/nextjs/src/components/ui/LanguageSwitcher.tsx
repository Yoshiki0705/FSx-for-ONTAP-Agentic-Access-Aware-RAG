'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { locales, localeNames, localeIcons, type Locale } from '../../i18n/config';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  variant?: 'dropdown' | 'buttons';
  className?: string;
}

/**
 * 言語切り替えコンポーネント
 * 
 * Phase 12/15 Feature Restoration:
 * - ドロップダウン形式の言語切り替えを実装
 * - Cookieに言語設定を保存
 * - ミドルウェアと連携してロケール切り替え
 */
export function LanguageSwitcher({ 
  currentLocale, 
  variant = 'dropdown',
  className = '' 
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    console.log(`[LanguageSwitcher] Mounted with currentLocale: ${currentLocale}`);
  }, [currentLocale]);

  const switchLanguage = async (newLocale: Locale) => {
    console.log(`[LanguageSwitcher] 言語切り替え開始: ${currentLocale} → ${newLocale}`);
    
    // ドロップダウンを閉じる
    setIsOpen(false);
    
    // 現在のパスから言語部分を置き換え
    const segments = pathname.split('/');
    const oldLocale = segments[1];
    segments[1] = newLocale; // /[locale]/... の [locale] 部分を置き換え
    
    // クエリパラメータを保持（modeパラメータを維持）
    const searchParams = new URLSearchParams(window.location.search);
    
    // 重要: KBモードの場合はmodeパラメータを削除
    // Agentモードの場合のみmode=agentを保持
    const currentMode = searchParams.get('mode');
    if (!currentMode || currentMode !== 'agent') {
      // KBモードまたはパラメータなし → modeパラメータを削除
      searchParams.delete('mode');
    }
    
    const newPath = segments.join('/') + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    
    console.log(`[LanguageSwitcher] パス変更: ${pathname} → ${newPath}`);
    console.log(`[LanguageSwitcher] ロケール変更: ${oldLocale} → ${newLocale}`);
    console.log(`[LanguageSwitcher] クエリパラメータ保持: ${searchParams.toString()}`);
    console.log(`[LanguageSwitcher] 現在のモード: ${currentMode || 'KB (デフォルト)'}`);
    
    try {
      // APIを使用してCookieを設定（バックグラウンドで実行）
      fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      }).catch(error => {
        console.error('[LanguageSwitcher] Cookie設定エラー:', error);
        // エラーでもページ遷移は継続
      });
    } catch (error) {
      console.error('[LanguageSwitcher] Cookie設定エラー:', error);
    }
    
    // ページ遷移（即座に実行、Cookieの設定を待たない）
    window.location.href = newPath;
  };

  // SSR時は何も表示しない（hydration mismatch回避）
  if (!isMounted) {
    return null;
  }

  if (variant === 'buttons') {
    return (
      <div className={`flex space-x-2 ${className}`}>
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => switchLanguage(locale)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              currentLocale === locale
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={localeNames[locale]}
          >
            <span className="mr-1">{localeIcons[locale]}</span>
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-300 dark:border-white/20 rounded-md transition-colors"
        title="言語を変更"
      >
        <span>{localeIcons[currentLocale]}</span>
        <span className="hidden sm:inline">{localeNames[currentLocale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* ドロップダウンメニュー */}
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20">
            <div className="py-1">
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => switchLanguage(locale)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    currentLocale === locale
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-3">{localeIcons[locale]}</span>
                  {localeNames[locale]}
                  {currentLocale === locale && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
