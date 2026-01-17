import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, X } from 'lucide-react';

interface ChatHistorySearchProps {
  /** 検索クエリ変更時のコールバック */
  onSearch: (query: string) => void;
  /** プレースホルダーテキスト */
  placeholder?: string;
  /** 初期値 */
  initialValue?: string;
}

/**
 * チャット履歴検索コンポーネント
 * デバウンス処理付きの検索入力フィールド
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function ChatHistorySearch({
  onSearch,
  placeholder = 'チャット履歴を検索...',
  initialValue = ''
}: ChatHistorySearchProps) {
  const [query, setQuery] = useState(initialValue);
  const debouncedQuery = useDebounce(query, 300);

  // デバウンスされたクエリが変更されたら検索を実行
  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  // クリアボタンのハンドラー
  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className="relative">
      {/* 検索アイコン */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <Search className="w-4 h-4" aria-hidden="true" />
      </div>

      {/* 検索入力フィールド */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2
          bg-gray-50 dark:bg-gray-900
          border border-gray-200 dark:border-gray-700
          rounded-lg
          text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          placeholder:text-gray-400 dark:placeholder:text-gray-500
        "
        aria-label="チャット履歴を検索"
      />

      {/* クリアボタン */}
      {query && (
        <button
          onClick={handleClear}
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
            transition-colors
          "
          aria-label="検索をクリア"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
