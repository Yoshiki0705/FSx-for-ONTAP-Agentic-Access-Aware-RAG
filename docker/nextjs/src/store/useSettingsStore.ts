'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * チャット設定の型定義
 */
export interface ChatSettings {
  /** 自動保存設定 */
  autoSave: boolean;
  /** 履歴保持期間（日数） */
  retentionDays: number;
  /** 最大セッション数 */
  maxSessions: number;
}

/**
 * アプリケーション設定の型定義
 */
export interface AppSettings {
  /** チャット設定 */
  chat: ChatSettings;
  /** テーマ設定 */
  theme: 'light' | 'dark' | 'system';
  /** 言語設定 */
  language: 'ja' | 'en';
}

/**
 * 設定ストアの型定義
 */
export interface SettingsStore extends AppSettings {
  /** チャット設定を更新 */
  updateChat: (updates: Partial<ChatSettings>) => void;
  /** テーマを更新 */
  updateTheme: (theme: AppSettings['theme']) => void;
  /** 言語を更新 */
  updateLanguage: (language: AppSettings['language']) => void;
  /** 設定をリセット */
  reset: () => void;
}

/**
 * デフォルト設定
 */
const defaultSettings: AppSettings = {
  chat: {
    autoSave: true,
    retentionDays: 30,
    maxSessions: 100,
  },
  theme: 'system',
  language: 'ja',
};

/**
 * 設定管理用Zustandストア
 * 
 * アプリケーションの各種設定を管理します。
 * - チャット履歴の自動保存設定
 * - テーマ設定
 * - 言語設定
 * - 設定はlocalStorageに永続化されます
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateChat: (updates) => {
        set((state) => ({
          chat: {
            ...state.chat,
            ...updates,
          },
        }));
      },

      updateTheme: (theme) => {
        set({ theme });
      },

      updateLanguage: (language) => {
        set({ language });
      },

      reset: () => {
        set(defaultSettings);
      },
    }),
    {
      name: 'app-settings',
      version: 1,
      // 設定の移行処理（将来のバージョンアップ用）
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // v0からv1への移行処理
          return {
            ...defaultSettings,
            ...persistedState,
          };
        }
        return persistedState as SettingsStore;
      },
    }
  )
);