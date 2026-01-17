/**
 * 認証バリデーションユーティリティ
 * 入力値検証とエラーハンドリングを統一
 */

import { AuthCredentials, ValidationResult, AuthError } from '../types/auth';

// バリデーションルール
const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9]+$/
  },
  PASSWORD: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100
  }
} as const;

/**
 * 認証情報の包括的バリデーション
 */
export function validateAuthCredentials(credentials: AuthCredentials): ValidationResult {
  const errors: string[] = [];

  // ユーザー名検証
  const usernameErrors = validateUsername(credentials.username);
  errors.push(...usernameErrors);

  // パスワード検証
  const passwordErrors = validatePassword(credentials.password);
  errors.push(...passwordErrors);

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ユーザー名バリデーション
 */
function validateUsername(username: string): string[] {
  const errors: string[] = [];

  if (!username || username.trim().length === 0) {
    errors.push('ユーザー名を入力してください');
    return errors;
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length < VALIDATION_RULES.USERNAME.MIN_LENGTH) {
    errors.push(`ユーザー名は${VALIDATION_RULES.USERNAME.MIN_LENGTH}文字以上で入力してください`);
  }

  if (trimmedUsername.length > VALIDATION_RULES.USERNAME.MAX_LENGTH) {
    errors.push(`ユーザー名は${VALIDATION_RULES.USERNAME.MAX_LENGTH}文字以内で入力してください`);
  }

  if (!VALIDATION_RULES.USERNAME.PATTERN.test(trimmedUsername)) {
    errors.push('ユーザー名は英数字のみ使用可能です');
  }

  return errors;
}

/**
 * パスワードバリデーション
 */
function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (!password || password.length === 0) {
    errors.push('パスワードを入力してください');
    return errors;
  }

  if (password.length < VALIDATION_RULES.PASSWORD.MIN_LENGTH) {
    errors.push(`パスワードは${VALIDATION_RULES.PASSWORD.MIN_LENGTH}文字以上で入力してください`);
  }

  if (password.length > VALIDATION_RULES.PASSWORD.MAX_LENGTH) {
    errors.push(`パスワードは${VALIDATION_RULES.PASSWORD.MAX_LENGTH}文字以内で入力してください`);
  }

  return errors;
}

/**
 * 認証エラーの標準化
 */
export function createAuthError(message: string, code?: string): AuthError {
  return {
    message,
    code
  };
}

/**
 * エラーメッセージの国際化対応
 */
export function getLocalizedErrorMessage(error: AuthError): string {
  const errorMessages: Record<string, string> = {
    'INVALID_CREDENTIALS': 'ユーザー名またはパスワードが正しくありません',
    'NETWORK_ERROR': 'ネットワークエラーが発生しました',
    'SERVER_ERROR': 'サーバーエラーが発生しました',
    'VALIDATION_ERROR': '入力値に誤りがあります'
  };

  return error.code && errorMessages[error.code] 
    ? errorMessages[error.code] 
    : error.message;
}