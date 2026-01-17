/**
 * モーダル関連の型定義
 */

import { ReactNode } from 'react';

/**
 * モーダルの種類
 */
export type ModalType = 'confirm' | 'alert' | 'custom';

/**
 * モーダルサイズ
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * モーダルアクション
 */
export interface ModalAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}

/**
 * モーダル設定
 */
export interface ModalConfig {
  id: string;
  type: ModalType;
  title: string;
  content: ReactNode;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  actions?: {
    primary?: ModalAction;
    secondary?: ModalAction;
  };
}

/**
 * モーダル状態
 */
export interface ModalState {
  isOpen: boolean;
  config: ModalConfig | null;
}

/**
 * モーダルストアの状態
 */
export interface ModalStore {
  modals: Map<string, ModalState>;
  
  openModal: (config: Omit<ModalConfig, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  updateModal: (id: string, config: Partial<ModalConfig>) => void;
  
  // ヘルパーメソッド
  confirm: (options: {
    title: string;
    content: ReactNode;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => string;
  
  alert: (options: {
    title: string;
    content: ReactNode;
    onClose?: () => void;
    closeLabel?: string;
  }) => string;
}
