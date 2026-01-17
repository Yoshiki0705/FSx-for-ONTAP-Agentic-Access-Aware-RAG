/**
 * ユーザー設定関連の型定義
 */

import { ThemeMode } from './theme';

/**
 * フォントサイズ
 */
export type FontSize = 'small' | 'medium' | 'large';

/**
 * ロケール（言語）
 */
export type Locale = 'ja' | 'en';

/**
 * 通知設定
 */
export interface NotificationSettings {
  desktop: boolean;
  sound: boolean;
  volume: number; // 0-100
}

/**
 * チャット設定
 */
export interface ChatSettings {
  saveHistory: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  messageGrouping: boolean;
}

/**
 * アクセシビリティ設定
 */
export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
}

/**
 * ユーザー設定
 */
export interface UserSettings {
  // 表示設定
  theme: ThemeMode;
  locale: Locale;
  fontSize: FontSize;
  
  // 通知設定
  notifications: NotificationSettings;
  
  // チャット設定
  chat: ChatSettings;
  
  // アクセシビリティ設定
  accessibility: AccessibilitySettings;
  
  // メタデータ
  version: string;
  lastUpdated: Date;
}

/**
 * 設定ストアの状態
 */
export interface SettingsStore {
  settings: UserSettings;
  fontSize: FontSize;
  locale: Locale;
  notifications: NotificationSettings;
  
  setFontSize: (size: FontSize) => void;
  setLocale: (locale: Locale) => void;
  setNotifications: (notifications: Partial<NotificationSettings>) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  exportSettings: () => string;
  importSettings: (json: string) => void;
  resetSettings: () => void;
}
