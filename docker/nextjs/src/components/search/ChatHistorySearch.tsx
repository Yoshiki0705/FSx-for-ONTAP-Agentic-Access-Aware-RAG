'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

interface ChatHistorySearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  searchHistory?: string[];
  onHistorySelect?: (query: string) => void;
  onClearHistory?: () => void;
  placeholder?: string;
  className?: string;
}

export function ChatHistorySearch({
  value,
  onChange,
  onClear,
  searchHistory = [],
  onHistorySelect,
  onClearHistory,
  placeholder,
  className = ''
}: ChatHistorySearchProps) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 検索履歴のフィルタリング
  const filteredHistory = React.useMemo(() => {
    if (!value.trim()) return searchHistory;
    return searchHistory.filter(item =>
      item.toLowerCase().includes(value.toLowerCase())
    );
  }, [value, searchHistory]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredHistory.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredHistory.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredHistory.length) {
          const selected = filteredHistory[selectedIndex];
          onChange(selected);
          onHistorySelect?.(selected);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [showSuggestions, filteredHistory, selectedIndex, onChange, onHistorySelect]);

  // フォーカス時に検索履歴を表示
  useEffect(() => {
    if (isFocused && searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  }, [isFocused, searchHistory.length]);

  // 外部クリックで検索候補を閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 選択されたアイテムをスクロール表示
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  return (
    <div className={`relative ${className}`}>
      {/* 検索入力 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('search.placeholder')}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
        />
        {value && (
          <button
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 検索候補 */}
      {showSuggestions && filteredHistory.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>{t('search.recentSearches')}</span>
            </div>
            {onClearHistory && (
              <button
                onClick={onClearHistory}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('search.clearHistory')}
              </button>
            )}
          </div>

          {/* 検索履歴リスト */}
          <div className="py-1">
            {filteredHistory.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  onChange(item);
                  onHistorySelect?.(item);
                  setShowSuggestions(false);
                  setSelectedIndex(-1);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-100">{item}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
