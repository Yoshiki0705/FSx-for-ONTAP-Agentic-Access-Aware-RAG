/**
 * セキュリティユーティリティ関数
 */

/**
 * 機密情報を含むかチェック
 */
export function containsSensitiveInfo(text: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /credential/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // メールアドレス
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // クレジットカード
  ];

  return sensitivePatterns.some(pattern => pattern.test(text));
}

/**
 * 機密情報をマスク
 */
export function maskSensitiveInfo(text: string): string {
  let masked = text;

  // メールアドレスをマスク
  masked = masked.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL]'
  );

  // クレジットカード番号をマスク
  masked = masked.replace(
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    '[CARD]'
  );

  // SSNをマスク
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

  return masked;
}

/**
 * localStorageから機密情報を削除
 */
export function clearSensitiveData(): void {
  if (typeof window === 'undefined') return;

  const sensitiveKeys = [
    'password',
    'api-key',
    'secret',
    'token',
    'credential',
    'auth-token',
    'session-id',
  ];

  // 機密情報キーを削除
  sensitiveKeys.forEach(key => {
    localStorage.removeItem(key);
  });

  // キー名に機密情報を含むものを削除
  Object.keys(localStorage).forEach(key => {
    if (containsSensitiveInfo(key)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * XSS攻撃を防ぐためのサニタイズ
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * CSRFトークンを生成
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * セキュアなランダム文字列を生成
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
