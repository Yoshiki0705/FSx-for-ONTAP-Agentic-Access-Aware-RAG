/**
 * 認証関連の型定義
 * 型安全性とコードの可読性を向上
 */

export interface UserSession {
  username: string;
  signInTime: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthError {
  message: string;
  code?: string;
}

export type AuthState = 'idle' | 'loading' | 'success' | 'error';

export interface AuthConfig {
  readonly VALID_USERS: readonly string[];
  readonly DEFAULT_PASSWORD: string;
  readonly REDIRECT_PATH: string;
  readonly STORAGE_KEY: string;
}

// 認証結果の型
export type AuthResult = 
  | { success: true; user: UserSession }
  | { success: false; error: AuthError };

// フォーム検証結果の型
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}