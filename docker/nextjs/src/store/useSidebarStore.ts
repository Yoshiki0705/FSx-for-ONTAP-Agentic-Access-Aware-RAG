/**
 * サイドバー状態管理用Zustandストア
 * 複数の折りたたみセクションの状態をlocalStorageに永続化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  /** セクション別の展開状態 */
  expandedSections: Record<string, boolean>;

  /** セクションの展開状態を取得 */
  isExpanded: (key: string) => boolean;

  /** セクションの展開状態を設定 */
  setExpanded: (key: string, expanded: boolean) => void;

  /** セクションの展開/折りたたみをトグル */
  toggle: (key: string) => void;

  // 後方互換性
  systemSettingsExpanded: boolean;
  setSystemSettingsExpanded: (expanded: boolean) => void;
  toggleSystemSettings: () => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set, get) => ({
      expandedSections: {},

      isExpanded: (key: string) => {
        return get().expandedSections[key] ?? false;
      },

      setExpanded: (key: string, expanded: boolean) => {
        set((state) => ({
          expandedSections: { ...state.expandedSections, [key]: expanded },
        }));
      },

      toggle: (key: string) => {
        set((state) => ({
          expandedSections: {
            ...state.expandedSections,
            [key]: !(state.expandedSections[key] ?? false),
          },
        }));
      },

      // 後方互換性
      get systemSettingsExpanded() {
        return get().expandedSections['system-settings'] ?? false;
      },

      setSystemSettingsExpanded: (expanded: boolean) => {
        set((state) => ({
          expandedSections: { ...state.expandedSections, 'system-settings': expanded },
        }));
      },

      toggleSystemSettings: () => {
        set((state) => ({
          expandedSections: {
            ...state.expandedSections,
            'system-settings': !(state.expandedSections['system-settings'] ?? false),
          },
        }));
      },
    }),
    {
      name: 'sidebar-settings-storage',
    }
  )
);
