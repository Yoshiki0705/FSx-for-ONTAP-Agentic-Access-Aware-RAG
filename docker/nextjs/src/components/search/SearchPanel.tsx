'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { useState, useCallback } from 'react';
import { useChatSearch, SearchResult } from '@/hooks/useChatSearch';
import { Message, ChatSession } from '@/types/chat';
import { ChatHistorySearch } from '@/components/sidebar/ChatHistorySearch';
import { AdvancedFilters } from './AdvancedFilters';
import { SearchHistory } from './SearchHistory';
import { SearchHighlight } from './SearchHighlight';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchPanelProps {
  messages?: Message[];
  sessions?: ChatSession[];
  onResultSelect?: (result: SearchResult) => void;
  availableModels?: string[];
}

  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function SearchPanel({
  messages = [],
  sessions = [],
  onResultSelect,
  availableModels = []
}: SearchPanelProps) {
  const {
    searchQuery,
    filters,
    searchHistory,
    activeFilterCount,
    searchMessages,
    searchSessions,
    updateSearchQuery,
    updateFilters,
    clearFilters,
    clearSearchHistory,
    removeFromHistory
  } = useChatSearch();

  const [showHistory, setShowHistory] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const results = searchQuery || activeFilterCount > 0
    ? sessions.length > 0
      ? searchSessions(sessions, searchQuery, filters)
      : searchMessages(messages, searchQuery, filters).map(r => ({
          session: null as any,
          results: [r]
        }))
    : [];

  const handleSearch = useCallback((query: string) => {
    updateSearchQuery(query);
    if (query) {
      setShowHistory(false);
    }
  }, [updateSearchQuery]);

  const handleHistorySelect = useCallback((query: string) => {
    updateSearchQuery(query);
    setShowHistory(false);
  }, [updateSearchQuery]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="relative">
          <ChatHistorySearch
            onSearch={updateSearchQuery}
          />
          
          {showHistory && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <SearchHistory
                history={searchHistory}
                onSelect={handleHistorySelect}
                onRemove={removeFromHistory}
                onClearAll={clearSearchHistory}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <AdvancedFilters
            filters={filters}
            onFiltersChange={updateFilters}
            availableModels={availableModels}
          />
          
          {searchHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              履歴
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              フィルタークリア
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!searchQuery && activeFilterCount === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            検索キーワードを入力してください
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            検索結果が見つかりませんでした
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {results.reduce((sum, r) => sum + r.results.length, 0)}件の結果
            </div>

            {results.map((sessionResult, sessionIndex) => (
              <div key={sessionResult.session?.id || `session-${sessionIndex}`} className="space-y-2">
                {sessionResult.session && (
                  <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    {sessionResult.session.title || '無題のチャット'}
                  </div>
                )}

                {sessionResult.results.map((result, resultIndex) => {
                  const resultId = `${sessionIndex}-${resultIndex}`;
                  const isExpanded = expandedResults.has(resultId);
                  const message = result.message;
                  const preview = message.content.substring(0, 150);
                  const showExpand = message.content.length > 150;

                  return (
                    <div
                      key={result.message.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => onResultSelect?.(result)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {message.role === 'user' ? 'ユーザー' : message.role === 'assistant' ? 'アシスタント' : 'システム'}
                        </span>
                        {message.timestamp && (
                          <span className="text-xs text-gray-400">
                            {new Date(message.timestamp).toLocaleString('ja-JP')}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <SearchHighlight text={isExpanded ? message.content : preview} query={searchQuery} />
                        {!isExpanded && showExpand && '...'}
                      </div>

                      {showExpand && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(resultId);
                          }}
                          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {isExpanded ? '折りたたむ' : 'もっと見る'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
