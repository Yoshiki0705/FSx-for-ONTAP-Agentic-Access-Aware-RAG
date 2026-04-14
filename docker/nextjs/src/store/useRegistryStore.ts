/**
 * Registry Store
 * Agent Registry UI 用の Zustand 状態管理ストア
 *
 * Requirements: 2.1, 2.6
 */

import { create } from 'zustand';
import type { RegistryRecord, RegistryRecordDetail } from '@/types/registry';

export interface RegistryState {
  // データ
  records: RegistryRecord[];
  selectedRecord: RegistryRecordDetail | null;

  // UI 状態
  searchQuery: string;
  resourceTypeFilter: string; // 'all' | 'Agent' | 'Tool' | 'McpServer'
  isLoading: boolean;
  isImporting: boolean;
  error: string | null;
  nextToken: string | null;
  registryRegion: string | null;

  // アクション
  setRecords: (records: RegistryRecord[]) => void;
  appendRecords: (records: RegistryRecord[]) => void;
  setSelectedRecord: (record: RegistryRecordDetail | null) => void;
  setSearchQuery: (query: string) => void;
  setResourceTypeFilter: (filter: string) => void;
  setLoading: (loading: boolean) => void;
  setImporting: (importing: boolean) => void;
  setError: (error: string | null) => void;
  setNextToken: (token: string | null) => void;
  setRegistryRegion: (region: string | null) => void;
  reset: () => void;
}

const initialState = {
  records: [] as RegistryRecord[],
  selectedRecord: null as RegistryRecordDetail | null,
  searchQuery: '',
  resourceTypeFilter: 'all',
  isLoading: false,
  isImporting: false,
  error: null as string | null,
  nextToken: null as string | null,
  registryRegion: null as string | null,
};

/**
 * Registry Store
 * localStorage 永続化なし（API から毎回取得）
 */
export const useRegistryStore = create<RegistryState>()((set) => ({
  ...initialState,

  setRecords: (records) => set({ records }),
  appendRecords: (records) =>
    set((state) => ({ records: [...state.records, ...records] })),
  setSelectedRecord: (record) => set({ selectedRecord: record }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setResourceTypeFilter: (filter) => set({ resourceTypeFilter: filter }),
  setLoading: (loading) => set({ isLoading: loading }),
  setImporting: (importing) => set({ isImporting: importing }),
  setError: (error) => set({ error }),
  setNextToken: (token) => set({ nextToken: token }),
  setRegistryRegion: (region) => set({ registryRegion: region }),
  reset: () => set(initialState),
}));
