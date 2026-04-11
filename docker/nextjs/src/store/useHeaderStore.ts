/**
 * ヘッダー状態管理用Zustandストア
 * chatMode（KB/Single Agent/Multi Agent）とサイドバー開閉状態をlocalStorageに永続化。
 * 既存の useAgentTeamStore.agentMode と genai/page.tsx の agentMode を統合する。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMode } from '@/utils/modelCompatibility';

export type { ChatMode } from '@/utils/modelCompatibility';

interface HeaderState {
  /** 現在のチャットモード */
  chatMode: ChatMode;
  /** サイドバー開閉状態 */
  sidebarOpen: boolean;
  /** オーバーフローメニュー開閉状態 */
  overflowMenuOpen: boolean;

  setChatMode: (mode: ChatMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setOverflowMenuOpen: (open: boolean) => void;
}

export const useHeaderStore = create<HeaderState>()(
  persist(
    (set) => ({
      chatMode: 'kb',
      sidebarOpen: true,
      overflowMenuOpen: false,

      setChatMode: (mode) => set({ chatMode: mode }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setOverflowMenuOpen: (open) => set({ overflowMenuOpen: open }),
    }),
    {
      name: 'header-store',
      partialize: (state) => ({
        chatMode: state.chatMode,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
