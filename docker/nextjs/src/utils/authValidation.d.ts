/**
 * 認証バリデーションユーティリティ
 * 入力値検証とエラーハンドリングを統一
 */
import { AuthCredentials, ValidationResult, AuthError } from '../types/auth';
/**
 * 認証情報の包括的バリデーション
 */
export declare function validateAuthCredentials(credentials: AuthCredentials): ValidationResult;
/**
 * 認証エラーの標準化
 */
export declare function createAuthError(message: string, code?: string): AuthError;
/**
 * エラーメッセージの国際化対応
 */
export declare function getLocalizedErrorMessage(error: AuthError): string;
