'use client';

import { useEffect, useRef } from 'react';
import { useRegistryStore } from '@/store/useRegistryStore';

interface RegistrySearchBarProps {
  onSearch: (query: string) => void;
}

/**
 * Registry 検索バー（300ms デバウンス付き）
 * Requirements: 2.1, 2.3
 */
export function RegistrySearchBar({ onSearch }: RegistrySearchBarProps) {
  const { searchQuery, setSearchQuery } = useRegistryStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchQuery, onSearch]);

  return (
    <input
      type="text"
      placeholder="Search registry..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
      aria-label="Search registry"
    />
  );
}
