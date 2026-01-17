'use client';

import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * オフライン状態を表示するバナー
 */
export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  // オンライン状態の場合は何も表示しない（復旧通知を除く）
  if (isOnline && !wasOffline) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isOnline ? 'translate-y-0' : 'translate-y-0'
      }`}
      role="alert"
      aria-live="assertive"
    >
      {!isOnline ? (
        // オフライン状態
        <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-center space-x-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <span className="font-medium">
              インターネット接続がありません
            </span>
          </div>
          <p className="text-center text-sm mt-1 opacity-90">
            オフラインモードです。接続が復旧するまでお待ちください。
          </p>
        </div>
      ) : wasOffline ? (
        // 復旧通知
        <div className="bg-green-600 text-white px-4 py-3 shadow-lg animate-slide-down">
          <div className="flex items-center justify-center space-x-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">
              インターネット接続が復旧しました
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
