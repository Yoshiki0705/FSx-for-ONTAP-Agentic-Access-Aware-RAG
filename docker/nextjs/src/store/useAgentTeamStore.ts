/**
 * Agent Team Store
 * マルチエージェント協調（Supervisor + Collaborator パターン）用の Zustand 状態管理ストア。
 * teams, selectedTeam, agentMode, executionStatus の状態を管理する。
 */

import { create } from 'zustand';
import type {
  AgentTeamConfig,
  MultiAgentExecutionStatus,
} from '@/types/multi-agent';

export interface AgentTeamState {
  /** 利用可能な Agent Team 一覧 */
  teams: AgentTeamConfig[];
  /** 現在選択中の Agent Team */
  selectedTeam: AgentTeamConfig | null;
  /** チャット UI のエージェントモード（single / multi） */
  agentMode: 'single' | 'multi';
  /** マルチエージェント実行中のリアルタイムステータス */
  executionStatus: MultiAgentExecutionStatus | null;

  // アクション
  setTeams: (teams: AgentTeamConfig[]) => void;
  setSelectedTeam: (team: AgentTeamConfig | null) => void;
  setAgentMode: (mode: 'single' | 'multi') => void;
  setExecutionStatus: (status: MultiAgentExecutionStatus | null) => void;
}

export const useAgentTeamStore = create<AgentTeamState>()((set) => ({
  teams: [],
  selectedTeam: null,
  agentMode: 'single',
  executionStatus: null,

  setTeams: (teams) => set({ teams }),
  setSelectedTeam: (team) => set({ selectedTeam: team }),
  setAgentMode: (mode) => set({ agentMode: mode }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
}));
