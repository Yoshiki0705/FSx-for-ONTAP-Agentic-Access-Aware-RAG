/**
 * Agent Directory Store
 * Agent Directory UI用のZustand状態管理ストア
 */

import { create } from 'zustand';
import type { AgentSummary } from '@/hooks/useAgentsList';
import type { AgentDetail, CreationProgress } from '@/types/agent-directory';

/**
 * Agent Directory State
 */
export interface AgentDirectoryState {
  // データ
  agents: AgentSummary[];
  selectedAgent: AgentDetail | null;

  // UI状態
  searchQuery: string;
  selectedCategory: string; // 'all' | category key
  viewMode: 'grid' | 'detail' | 'edit' | 'create';
  isLoading: boolean;
  error: string | null;

  // テンプレート作成進捗
  creationProgress: CreationProgress | null;

  // アクション
  setAgents: (agents: AgentSummary[]) => void;
  setSelectedAgent: (agent: AgentDetail | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setViewMode: (mode: 'grid' | 'detail' | 'edit' | 'create') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCreationProgress: (progress: CreationProgress | null) => void;
  reset: () => void;
}

const initialState = {
  agents: [] as AgentSummary[],
  selectedAgent: null as AgentDetail | null,
  searchQuery: '',
  selectedCategory: 'all',
  viewMode: 'grid' as const,
  isLoading: false,
  error: null as string | null,
  creationProgress: null as CreationProgress | null,
};

/**
 * Agent Directory Store
 * localStorage永続化なし（APIから毎回取得）
 */
export const useAgentDirectoryStore = create<AgentDirectoryState>()((set) => ({
  ...initialState,

  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCreationProgress: (progress) => set({ creationProgress: progress }),
  reset: () => set(initialState),
}));
