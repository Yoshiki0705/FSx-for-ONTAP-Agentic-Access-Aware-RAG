/**
 * カード-Agentマッピング管理用Zustandストア
 * カードIDとAgent IDのマッピングをlocalStorageに永続化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * カードとAgentの紐付け情報
 */
export interface CardAgentMapping {
  /** 紐付けられたAgent ID */
  agentId: string;
  /** Agent Alias ID（InvokeAgent時に使用） */
  agentAliasId?: string;
  /** マッピング解決時刻（Unix timestamp） */
  resolvedAt: number;
}

/**
 * CardAgentMappingStore State
 */
export interface CardAgentMappingStore {
  /** カードID → Agent情報のマッピング */
  mappings: Record<string, CardAgentMapping>;

  /** マッピングを取得 */
  getMapping: (cardId: string) => CardAgentMapping | undefined;

  /** マッピングを設定 */
  setMapping: (cardId: string, mapping: CardAgentMapping) => void;

  /** マッピングを削除 */
  removeMapping: (cardId: string) => void;

  /** 全マッピングをクリア */
  clearAll: () => void;
}

/**
 * カード-Agentマッピングストア
 *
 * ワークフローカードとBedrock AgentのIDマッピングを管理します。
 * localStorageに永続化されます。
 *
 * @example
 * ```typescript
 * const { getMapping, setMapping, removeMapping, clearAll } = useCardAgentMappingStore();
 *
 * // マッピングを設定
 * setMapping('agent-financial', {
 *   agentId: 'ABC123XYZ',
 *   agentAliasId: 'PROD_ALIAS_1',
 *   resolvedAt: Date.now(),
 * });
 *
 * // マッピングを取得
 * const mapping = getMapping('agent-financial');
 *
 * // マッピングを削除
 * removeMapping('agent-financial');
 *
 * // 全マッピングをクリア
 * clearAll();
 * ```
 */
export const useCardAgentMappingStore = create<CardAgentMappingStore>()(
  persist(
    (set, get) => ({
      mappings: {},

      getMapping: (cardId: string) => {
        return get().mappings[cardId];
      },

      setMapping: (cardId: string, mapping: CardAgentMapping) => {
        set((state) => ({
          mappings: {
            ...state.mappings,
            [cardId]: mapping,
          },
        }));
      },

      removeMapping: (cardId: string) => {
        set((state) => {
          const { [cardId]: _, ...rest } = state.mappings;
          return { mappings: rest };
        });
      },

      clearAll: () => {
        set({ mappings: {} });
      },
    }),
    {
      name: 'card-agent-mapping-storage',
    }
  )
);
