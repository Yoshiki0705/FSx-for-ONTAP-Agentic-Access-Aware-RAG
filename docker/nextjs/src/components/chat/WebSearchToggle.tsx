'use client';

import React, { useCallback, useState } from 'react';
import { Globe } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useHeaderStore } from '@/store/useHeaderStore';
import { useTranslations } from 'next-intl';

interface WebSearchToggleProps {
  disabled?: boolean;
}

/**
 * Web検索トグルボタン
 *
 * KB検索で結果が不足した場合に外部Web検索をフォールバックとして使用するかを制御する。
 * - デフォルト: OFF（KBのみ = 認証済みドキュメントのみ）
 * - ON時: KB結果不足の場合にWeb検索を試行し、結果は「参考情報」として明示される
 * - 初回有効化時にリスク確認ダイアログを表示（Responsible AI）
 *
 * セキュリティ注:
 * - Web検索結果は非信頼データとして扱われる（Step 1で実装済みの防御機構適用）
 * - 引用バッジで「認証済み」(KB) と「参考情報」(Web) を視覚的に区別する
 * - 管理者は DISABLE_WEB_SEARCH=true で組織全体を無効化可能
 */
export function WebSearchToggle({ disabled = false }: WebSearchToggleProps) {
  const webSearchEnabled = useSettingsStore((s) => s.chat.webSearchEnabled);
  const webSearchConfirmed = useSettingsStore((s) => s.chat.webSearchConfirmed);
  const updateChat = useSettingsStore((s) => s.updateChat);
  const t = useTranslations('webSearch');
  const [showConfirm, setShowConfirm] = useState(false);

  // 管理者グローバル無効化（環境変数 DISABLE_WEB_SEARCH=true）
  const globallyDisabled = process.env.NEXT_PUBLIC_DISABLE_WEB_SEARCH === 'true';
  // Agent Mode では Web Search を無効化（Agent がツール実行を制御するため）
  const chatMode = useHeaderStore((s) => s.chatMode);
  const isAgentMode = chatMode === 'agent' || chatMode === 'multiAgent';
  const isDisabled = disabled || globallyDisabled || isAgentMode;

  const handleToggle = useCallback(() => {
    if (isDisabled) return;

    if (!webSearchEnabled && !webSearchConfirmed) {
      // 初回有効化 — 確認ダイアログを表示
      setShowConfirm(true);
      return;
    }

    updateChat({ webSearchEnabled: !webSearchEnabled });
  }, [isDisabled, webSearchEnabled, webSearchConfirmed, updateChat]);

  const handleConfirm = useCallback(() => {
    updateChat({ webSearchEnabled: true, webSearchConfirmed: true });
    setShowConfirm(false);
  }, [updateChat]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isDisabled}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
          transition-colors duration-150 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${webSearchEnabled
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
        `}
        aria-pressed={webSearchEnabled}
        aria-label={webSearchEnabled ? t('disableLabel') : t('enableLabel')}
        title={globallyDisabled ? t('globallyDisabledTooltip') : isAgentMode ? t('agentModeDisabledTooltip') : (webSearchEnabled ? t('enabledTooltip') : t('disabledTooltip'))}
      >
        <Globe className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="select-none">Web</span>
      </button>

      {/* 初回有効化確認ダイアログ */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="web-search-confirm-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 max-w-sm mx-4 space-y-3">
            <h3
              id="web-search-confirm-title"
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              🌐 {t('confirmTitle')}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {t('confirmDescription')}
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-4 space-y-1">
              <li>{t('confirmPoint1')}</li>
              <li>{t('confirmPoint2')}</li>
              <li>{t('confirmPoint3')}</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t('confirmCancel')}
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {t('confirmEnable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
