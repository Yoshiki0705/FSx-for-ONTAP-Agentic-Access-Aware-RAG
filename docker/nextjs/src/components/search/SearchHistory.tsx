'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { SearchHistoryEntry } from '@/hooks/useChatSearch';
import { Clock, X } from 'lucide-react';

interface SearchHistoryProps {
  /** 検索履歴 */
  history: SearchHistoryEntry[];
  /** 履歴項目クリック時のコールバック */
  onSelect: (query: string) => void;
  /** 履歴項目削除時のコールバック */
  onRemove: (query: string) => void;
  /** 全履歴クリア時のコールバック */
  onClearAll: () => void;
}

/**
 * 検索履歴コンポーネント
 * 過去の検索クエリを表示・選択・削除
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function SearchHistory({
  history,
  onSelect,
  onRemove,
  onClearAll
}: SearchHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        検索履歴はありません
      </div>
    );
  }

  /**
   * 相対時間を取得
   */
  const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    
    return new Date(timestamp).toLocaleDateString('ja-JP');
  };

  return (
    <div className="py-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          検索履歴
        </h3>
        <button
          onClick={onClearAll}
          className="
            text-xs text-gray-500 hover:text-gray-700
            dark:text-gray-400 dark:hover:text-gray-200
            transition-colors
          "
        >
          全てクリア
        </button>
      </div>

      {/* 履歴リスト */}
      <div className="space-y-1">
        {history.map((entry, index) => (
          <div
            key={`${entry.query}-${index}`}
            className="
              group
              flex items-center gap-2
              px-4 py-2
              hover:bg-gray-50 dark:hover:bg-gray-800
              transition-colors
            "
          >
            {/* 時計アイコン */}
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />

            {/* クエリテキスト */}
            <button
              onClick={() => onSelect(entry.query)}
              className="
                flex-1 text-left text-sm
                text-gray-700 dark:text-gray-300
                hover:text-blue-600 dark:hover:text-blue-400
                truncate
              "
              title={entry.query}
            >
              {entry.query}
            </button>

            {/* 相対時間 */}
            <span className="text-xs text-gray-400 flex-shrink-0">
              {getRelativeTime(entry.timestamp)}
            </span>

            {/* 削除ボタン */}
            <button
              onClick={() => onRemove(entry.query)}
              className="
                opacity-0 group-hover:opacity-100
                text-gray-400 hover:text-red-600
                dark:hover:text-red-400
                transition-all
                flex-shrink-0
              "
              aria-label={`"${entry.query}"を削除`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
