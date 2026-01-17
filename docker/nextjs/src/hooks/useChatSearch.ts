import { useState, useEffect, useMemo } from 'react';

// Fuse.jsを条件付きでインポート
let Fuse: any = null;
try {
  Fuse = require('fuse.js');
} catch (error) {
  console.warn('Fuse.js not available, search will use basic filtering');
}

export interface SearchableItem {
  id: string;
  title?: string;
  content?: string;
  messages?: Array<{ content: string }>;
  [key: string]: any;
}

export interface SearchResult<T> {
  item: T;
  score?: number;
}

export interface UseChatSearchOptions {
  threshold?: number;
  keys?: string[];
}

export interface UseChatSearchReturn<T> {
  searchQuery: string;
  updateSearchQuery: (query: string) => void;
  results: T[];
  searchResults: SearchResult<T>[];
  loadSearchHistory: () => void;
  clearSearchHistory: () => void;
  searchHistory: string[];
  isSearching: boolean;
}

export function useChatSearch<T extends SearchableItem>(
  options: {
    sessions?: T[];
    threshold?: number;
    keys?: string[];
  } = {}
): UseChatSearchReturn<T> {
  // ✅ Fix: Ensure sessions is always an array with comprehensive null checks
  const { 
    sessions: rawSessions, 
    threshold = 0.3, 
    keys = ['title', 'content', 'messages.content'] 
  } = options;
  
  // ✅ Safe array initialization with comprehensive error handling
  const sessions = useMemo(() => {
    try {
      if (!rawSessions) {
        console.log('🔍 [useChatSearch] rawSessions is null/undefined, returning empty array');
        return [];
      }
      if (!Array.isArray(rawSessions)) {
        console.warn('🚨 [useChatSearch] rawSessions is not an array:', typeof rawSessions, rawSessions);
        return [];
      }
      console.log('✅ [useChatSearch] rawSessions is valid array with length:', rawSessions.length);
      return rawSessions;
    } catch (error) {
      console.error('❌ [useChatSearch] Error processing rawSessions:', error);
      return [];
    }
  }, [rawSessions]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // ✅ Initialize results with sessions when sessions change
  useEffect(() => {
    try {
      if (!searchQuery.trim()) {
        console.log('🔍 [useChatSearch] No search query, setting results to sessions:', sessions.length);
        setResults(sessions);
      }
    } catch (error) {
      console.error('❌ [useChatSearch] Error updating results:', error);
      setResults([]);
    }
  }, [sessions, searchQuery]);

  // Fuse.js インスタンスの作成
  const fuse = useMemo(() => {
    try {
      if (!Fuse || !sessions || !Array.isArray(sessions) || sessions.length === 0) {
        console.log('🔍 [useChatSearch] Cannot create Fuse instance:', { 
          hasFuse: !!Fuse, 
          hasSessions: !!sessions, 
          isArray: Array.isArray(sessions), 
          length: sessions?.length || 0 
        });
        return null;
      }
      
      console.log('✅ [useChatSearch] Creating Fuse instance with', sessions.length, 'sessions');
      return new Fuse(sessions, {
        threshold,
        keys,
        includeScore: true,
      });
    } catch (error) {
      console.warn('❌ [useChatSearch] Failed to create Fuse instance:', error);
      return null;
    }
  }, [sessions, threshold, keys]);

  // 検索実行
  useEffect(() => {
    try {
      if (!searchQuery.trim()) {
        console.log('🔍 [useChatSearch] Empty search query, using all sessions');
        setResults(sessions);
        return;
      }

      console.log('🔍 [useChatSearch] Executing search for:', searchQuery);

      if (fuse) {
        // Fuse.jsを使用した高度な検索
        try {
          const searchResults = fuse.search(searchQuery);
          const filteredResults = searchResults.map(result => result.item);
          console.log('✅ [useChatSearch] Fuse search completed:', filteredResults.length, 'results');
          setResults(filteredResults);
        } catch (error) {
          console.warn('❌ [useChatSearch] Fuse search failed, falling back to basic search:', error);
          // フォールバック処理
          const filtered = sessions.filter(item => {
            try {
              if (!item) return false;
              
              const title = item?.title || '';
              const content = item?.content || '';
              const messagesContent = item?.messages?.map(m => m?.content || '').join(' ') || '';
              
              const searchText = `${title} ${content} ${messagesContent}`.toLowerCase();
              return searchText.includes(searchQuery.toLowerCase());
            } catch (err) {
              console.warn('❌ [useChatSearch] Error filtering item:', err);
              return false;
            }
          });
          console.log('✅ [useChatSearch] Basic search completed:', filtered.length, 'results');
          setResults(filtered);
        }
      } else {
        // フォールバック: 基本的な文字列マッチング
        try {
          const filtered = sessions.filter(item => {
            try {
              if (!item) return false;
              
              const title = item.title || '';
              const content = item.content || '';
              const messagesContent = item.messages?.map(m => m?.content || '').join(' ') || '';
              
              const searchText = `${title} ${content} ${messagesContent}`.toLowerCase();
              return searchText.includes(searchQuery.toLowerCase());
            } catch (err) {
              console.warn('❌ [useChatSearch] Error in basic filter:', err);
              return false;
            }
          });
          console.log('✅ [useChatSearch] Fallback search completed:', filtered.length, 'results');
          setResults(filtered);
        } catch (error) {
          console.error('❌ [useChatSearch] Basic search failed:', error);
          setResults([]);
        }
      }
    } catch (error) {
      console.error('❌ [useChatSearch] Search execution failed:', error);
      setResults([]);
    }
  }, [searchQuery, sessions, fuse]);

  // 検索結果をSearchResult形式で返す
  const searchResults: SearchResult<T>[] = useMemo(() => {
    try {
      if (!results || !Array.isArray(results)) {
        console.warn('🚨 [useChatSearch] results is not an array:', typeof results, results);
        return [];
      }
      return results.map(item => ({ item }));
    } catch (error) {
      console.error('❌ [useChatSearch] Error creating searchResults:', error);
      return [];
    }
  }, [results]);

  // 検索履歴の管理
  const updateSearchQuery = (query: string) => {
    try {
      console.log('🔍 [useChatSearch] Updating search query:', query);
      setSearchQuery(query);
      if (query.trim() && !searchHistory.includes(query)) {
        setSearchHistory(prev => [query, ...prev.slice(0, 9)]); // 最大10件
      }
    } catch (error) {
      console.error('❌ [useChatSearch] Error updating search query:', error);
    }
  };

  const loadSearchHistory = () => {
    try {
      // localStorage から検索履歴を読み込み（実装は省略）
      console.log('🔍 [useChatSearch] Loading search history...');
    } catch (error) {
      console.error('❌ [useChatSearch] Error loading search history:', error);
    }
  };

  const clearSearchHistory = () => {
    try {
      console.log('🔍 [useChatSearch] Clearing search history');
      setSearchHistory([]);
    } catch (error) {
      console.error('❌ [useChatSearch] Error clearing search history:', error);
    }
  };

  return {
    searchQuery,
    updateSearchQuery,
    results: Array.isArray(results) ? results : [],
    searchResults,
    loadSearchHistory,
    clearSearchHistory,
    searchHistory,
    isSearching: searchQuery.trim().length > 0,
  };
}
