/**
 * Agent Store
 * 作成日: 2025-12-31
 * 
 * 選択されたAgentの状態を管理するZustandストア
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Agent Store State
 */
interface AgentStoreState {
  /**
   * 選択されたAgent ID
   */
  selectedAgentId: string | null;

  /**
   * Agent IDを設定
   */
  setSelectedAgentId: (agentId: string | null) => void;

  /**
   * Agent IDをクリア
   */
  clearSelectedAgentId: () => void;
}

/**
 * Agent Store
 * 
 * 選択されたAgent IDを管理します。
 * localStorageに永続化されます。
 * 
 * @example
 * ```typescript
 * const { selectedAgentId, setSelectedAgentId } = useAgentStore();
 * 
 * // Agent IDを設定
 * setSelectedAgentId('O4RW0WSIEA');
 * 
 * // Agent IDをクリア
 * clearSelectedAgentId();
 * ```
 */
export const useAgentStore = create<AgentStoreState>()(
  persist(
    (set) => ({
      selectedAgentId: null,

      setSelectedAgentId: (agentId: string | null) => {
        console.log('🔄 [AgentStore] Agent ID設定:', agentId);
        set({ selectedAgentId: agentId });

        // Agent切り替えイベントを発火
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('agent-switched', {
            detail: { agentId }
          });
          window.dispatchEvent(event);
          console.log('📢 [AgentStore] agent-switchedイベント発火:', agentId);
        }
      },

      clearSelectedAgentId: () => {
        console.log('🗑️ [AgentStore] Agent IDクリア');
        set({ selectedAgentId: null });

        // Agent切り替えイベントを発火
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('agent-switched', {
            detail: { agentId: null }
          });
          window.dispatchEvent(event);
          console.log('📢 [AgentStore] agent-switchedイベント発火: null');
        }
      }
    }),
    {
      name: 'agent-store', // localStorageのキー名
      version: 1
    }
  )
);
