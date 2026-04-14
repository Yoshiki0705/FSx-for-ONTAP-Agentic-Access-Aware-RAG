/**
 * Agent Directory Store
 * Agent Directory UI用のZustand状態管理ストア
 */

import { create } from 'zustand';
import type { AgentSummary } from '@/hooks/useAgentsList';
import type { AgentDetail, CreationProgress } from '@/types/agent-directory';
import type { SharedAgentConfig, ScheduleTask } from '@/types/enterprise-agent';

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
  viewMode: 'grid' | 'detail' | 'edit' | 'create' | 'import';
  activeTab: 'agents' | 'shared' | 'schedules' | 'teams' | 'registry';
  isLoading: boolean;
  error: string | null;

  // テンプレート作成進捗
  creationProgress: CreationProgress | null;

  // Enterprise features
  sharedConfigs: SharedAgentConfig[];
  schedules: ScheduleTask[];

  // アクション
  setAgents: (agents: AgentSummary[]) => void;
  setSelectedAgent: (agent: AgentDetail | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setViewMode: (mode: 'grid' | 'detail' | 'edit' | 'create' | 'import') => void;
  setActiveTab: (tab: 'agents' | 'shared' | 'schedules' | 'teams' | 'registry') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCreationProgress: (progress: CreationProgress | null) => void;
  setSharedConfigs: (configs: SharedAgentConfig[]) => void;
  setSchedules: (schedules: ScheduleTask[]) => void;
  reset: () => void;
}

const initialState = {
  agents: [] as AgentSummary[],
  selectedAgent: null as AgentDetail | null,
  searchQuery: '',
  selectedCategory: 'all',
  viewMode: 'grid' as const,
  activeTab: 'agents' as const,
  isLoading: false,
  error: null as string | null,
  creationProgress: null as CreationProgress | null,
  sharedConfigs: [] as SharedAgentConfig[],
  schedules: [] as ScheduleTask[],
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
  setActiveTab: (tab) => set({ activeTab: tab }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCreationProgress: (progress) => set({ creationProgress: progress }),
  setSharedConfigs: (configs) => set({ sharedConfigs: configs }),
  setSchedules: (schedules) => set({ schedules }),
  reset: () => set(initialState),
}));
