/**
 * Toast通知関連の型定義
 */

import { ReactNode } from 'react';

/**
 * Toastの種類
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toastアクション
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Toast通知
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number; // ミリ秒（デフォルト: 3000）
  action?: ToastAction;
  dismissible?: boolean;
  createdAt: Date;
}

/**
 * Toast作成オプション
 */
export interface ToastOptions {
  type?: ToastType;
  message: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
}

/**
 * Toastストアの状態
 */
export interface ToastStore {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  success: (message: string, description?: string) => string;
  error: (message: string, description?: string) => string;
  warning: (message: string, description?: string) => string;
  info: (message: string, description?: string) => string;
}
