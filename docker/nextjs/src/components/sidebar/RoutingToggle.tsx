'use client';

import { useTranslations } from 'next-intl';
import { useSmartRoutingStore } from '@/store/useSmartRoutingStore';

interface RoutingToggleProps {
  locale: string;
}

/**
 * Smart Routing ON/OFF トグルコンポーネント
 *
 * サイドバーの設定セクションに配置し、Smart Routing機能の有効/無効を切り替える。
 * ON時は軽量モデル名と高性能モデル名のペアを表示する。
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.7
 */
export function RoutingToggle({ locale: _locale }: RoutingToggleProps) {
  const t = useTranslations('smartRouting');
  const {
    isEnabled,
    setEnabled,
    setAutoMode,
    lightweightModelId,
    powerfulModelId,
  } = useSmartRoutingStore();

  const handleToggle = () => {
    const next = !isEnabled;
    setEnabled(next);
    if (next) {
      // When enabling Smart Routing, also activate auto mode
      setAutoMode(true);
    }
  };

  return (
    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('title')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* ON/OFF status label */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {isEnabled ? t('enabled') : t('disabled')}
      </div>

      {/* Model pair display when enabled */}
      {isEnabled && (
        <div className="mt-2 space-y-1 rounded-md bg-blue-50 dark:bg-blue-900/20 p-2 text-xs">
          <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
            <span className="font-medium">{t('lightweight')}:</span>
            <span className="truncate">{lightweightModelId.split('.').pop()}</span>
          </div>
          <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
            <span className="font-medium">{t('powerful')}:</span>
            <span className="truncate">{powerfulModelId.split('.').pop()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
