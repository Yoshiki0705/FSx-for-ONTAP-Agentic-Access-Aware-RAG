/**
 * サイドバー状態管理用Zustandストア
 * システム管理セクションの折りたたみ状態をlocalStorageに永続化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * SidebarStore State
 */
interface SidebarStore {
  /** システム管理セクションの展開状態 */
  systemSettingsExpanded: boolean;

  /** システム管理セクションの展開状態を設定 */
  setSystemSettingsExpanded: (expanded: boolean) => void;

  /** システム管理セクションの展開/折りたたみをトグル */
  toggleSystemSettings: () => void;
}

/**
 * サイドバーストア
 *
 * システム管理セクションの折りたたみ状態を管理します。
 * localStorageに永続化されます。
 *
 * @example
 * ```typescript
 * const { systemSettingsExpanded, toggleSystemSettings } = useSidebarStore();
 *
 * // トグル
 * toggleSystemSettings();
 *
 * // 直接設定
 * setSystemSettingsExpanded(true);
 * ```
 */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      systemSettingsExpanded: false,

      setSystemSettingsExpanded: (expanded: boolean) => {
        set({ systemSettingsExpanded: expanded });
      },

      toggleSystemSettings: () => {
        set((state) => ({ systemSettingsExpanded: !state.systemSettingsExpanded }));
      },
    }),
    {
      name: 'sidebar-settings-storage',
    }
  )
);
