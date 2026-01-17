'use client';


/**
 * テーマ切り替えコンポーネント
 * ライト/ダーク/システムテーマの切り替えUI
 */

import { Moon, Sun, Monitor } from 'lucide-react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { useThemeStore } from '@/store/useThemeStore';
import { ThemeMode } from '@/types/theme';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

/**
 * テーマトグルボタン
 */
export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  const { theme, effectiveTheme, setTheme } = useThemeStore();

  if (variant === 'icon') {
    return (
      <button
        onClick={() => {
          const currentEffective = effectiveTheme;
          const newTheme: ThemeMode = currentEffective === 'light' ? 'dark' : 'light';
          setTheme(newTheme);
          
          // DOMに直接適用して即座に反映
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
          }
        }}
        className={`p-2 rounded-lg transition-all shadow-md ${
          effectiveTheme === 'light' 
            ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' 
            : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
        } ${className}`}
        aria-label={t('theme.toggle')}
        title={t('theme.current', { mode: effectiveTheme === 'light' ? t('theme.light') : t('theme.dark') })}
      >
        {effectiveTheme === 'light' ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-blue-400" />
        )}
      </button>
    );
  }

  return (
    <div className={`flex gap-1 p-1 bg-muted rounded-lg ${className}`}>
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'light'
            ? 'bg-background shadow-sm'
            : 'hover:bg-background/50'
        }`}
        aria-label={t('theme.light')}
        title={t('theme.light')}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'dark'
            ? 'bg-background shadow-sm'
            : 'hover:bg-background/50'
        }`}
        aria-label={t('theme.dark')}
        title={t('theme.dark')}
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'system'
            ? 'bg-background shadow-sm'
            : 'hover:bg-background/50'
        }`}
        aria-label={t('theme.system')}
        title={t('theme.system')}
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
