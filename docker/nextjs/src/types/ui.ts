/**
 * UI関連の共通型定義
 */

/**
 * ボタンバリアント
 */
export type ButtonVariant = 
  | 'default' 
  | 'primary' 
  | 'secondary' 
  | 'destructive' 
  | 'outline' 
  | 'ghost' 
  | 'link';

/**
 * ボタンサイズ
 */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * 入力フィールドバリアント
 */
export type InputVariant = 'default' | 'error' | 'success';

/**
 * ローディング状態
 */
export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100
}

/**
 * エラー状態
 */
export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
  details?: any;
}

/**
 * UIストアの状態
 */
export interface UIStore {
  // サイドバー
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // ローディング
  loading: LoadingState;
  setLoading: (loading: boolean, message?: string, progress?: number) => void;
  
  // エラー
  error: ErrorState;
  setError: (error: ErrorState) => void;
  clearError: () => void;
  
  // モバイルメニュー
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
}

/**
 * レスポンシブブレークポイント
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * ブレークポイント値（px）
 */
export const BREAKPOINTS: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};
