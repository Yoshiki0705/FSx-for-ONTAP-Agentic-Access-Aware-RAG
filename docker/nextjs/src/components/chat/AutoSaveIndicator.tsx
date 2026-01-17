'use client';

import React from 'react';
import { useSafeTranslations } from '../../hooks/useSafeTranslations';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutoSaveIndicatorProps {
  /** 保存状態 */
  status: SaveStatus;
  /** 最終保存時刻 */
  lastSavedAt?: Date | null;
  /** エラーメッセージ */
  errorMessage?: string;
  /** クラス名 */
  className?: string;
}

/**
 * 自動保存インジケーターコンポーネント
 * 
 * チャット履歴の保存状態を視覚的に表示します。
 * - 保存中: アニメーション付きアイコン
 * - 保存完了: チェックマークアイコン（2秒後にフェードアウト）
 * - エラー: エラーアイコンとメッセージ
 */
export function AutoSaveIndicator({
  status,
  lastSavedAt,
  errorMessage,
  className = '',
}: AutoSaveIndicatorProps) {
  const { t } = useSafeTranslations();

  // アイドル状態では何も表示しない
  if (status === 'idle') {
    return null;
  }

  // 最終保存時刻のフォーマット
  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return t('common.justNow', 'Just now');
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return t('common.minutesAgo', `${minutes} minutes ago`);
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 text-sm transition-opacity duration-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 保存中 */}
      {status === 'saving' && (
        <>
          <svg
            className="animate-spin h-4 w-4 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-blue-500">{t('common.saving', 'Saving...')}</span>
        </>
      )}

      {/* 保存完了 */}
      {status === 'saved' && (
        <>
          <svg
            className="h-4 w-4 text-green-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-green-500">
            {t('common.saved', 'Saved')}
            {lastSavedAt && (
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                ({formatLastSaved(lastSavedAt)})
              </span>
            )}
          </span>
        </>
      )}

      {/* エラー */}
      {status === 'error' && (
        <>
          <svg
            className="h-4 w-4 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-red-500">
            {t('error.generic', 'Error')}
            {errorMessage && (
              <span className="ml-1 text-xs">({errorMessage})</span>
            )}
          </span>
        </>
      )}
    </div>
  );
}
