/**
 * CSRF保護ライブラリ - Phase 1 Task 1.2
 * 
 * 機能:
 * - CSRFトークン生成・検証
 * - セッションベースのトークン管理
 * - ダブルサブミット Cookie パターン
 * - Edge Runtime対応（Web Crypto API使用）
 */

import { NextRequest } from 'next/server';

export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly COOKIE_NAME = 'csrf-token';
  private static readonly HEADER_NAME = 'x-csrf-token';
  private static readonly FORM_FIELD_NAME = '_csrf';

  /**
   * CSRFトークンを生成（Web Crypto API使用）
   */
  static generateToken(): string {
    const array = new Uint8Array(this.TOKEN_LENGTH);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * セッションベースのCSRFトークンを生成（Web Crypto API使用）
   */
  static async generateSessionToken(sessionId: string, secret: string): Promise<string> {
    const timestamp = Date.now().toString();
    const data = `${sessionId}:${timestamp}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hash = Array.from(new Uint8Array(signature), byte => 
      byte.toString(16).padStart(2, '0')
    ).join('');
    
    return `${timestamp}.${hash}`;
  }

  /**
   * セッションベースのCSRFトークンを検証（Web Crypto API使用）
   */
  static async verifySessionToken(
    token: string, 
    sessionId: string, 
    secret: string,
    maxAge: number = 3600000 // 1時間
  ): Promise<boolean> {
    try {
      const [timestamp, hash] = token.split('.');
      
      if (!timestamp || !hash) {
        return false;
      }

      // タイムスタンプ検証
      const tokenTime = parseInt(timestamp, 10);
      const now = Date.now();
      
      if (now - tokenTime > maxAge) {
        return false;
      }

      // ハッシュ検証
      const data = `${sessionId}:${timestamp}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(data);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, messageData);
      const expectedHash = Array.from(new Uint8Array(signature), byte => 
        byte.toString(16).padStart(2, '0')
      ).join('');

      return hash === expectedHash;
    } catch (error) {
      console.error('CSRF token verification error:', error);
      return false;
    }
  }

  /**
   * リクエストからCSRFトークンを取得
   */
  static getTokenFromRequest(request: NextRequest): string | null {
    // ヘッダーから取得
    const headerToken = request.headers.get(this.HEADER_NAME);
    if (headerToken) {
      return headerToken;
    }

    // Cookieから取得
    const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * フォームデータからCSRFトークンを取得
   */
  static async getTokenFromFormData(request: NextRequest): Promise<string | null> {
    try {
      const contentType = request.headers.get('content-type');
      
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        return formData.get(this.FORM_FIELD_NAME) as string | null;
      }

      if (contentType?.includes('application/json')) {
        const body = await request.json();
        return body[this.FORM_FIELD_NAME] || null;
      }

      return null;
    } catch (error) {
      console.error('Error extracting CSRF token from form data:', error);
      return null;
    }
  }

  /**
   * CSRF保護が必要なメソッドかチェック
   */
  static requiresProtection(method: string): boolean {
    const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    return protectedMethods.includes(method.toUpperCase());
  }

  /**
   * セーフなメソッドかチェック
   */
  static isSafeMethod(method: string): boolean {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    return safeMethods.includes(method.toUpperCase());
  }

  /**
   * CSRF保護をバイパスするパスかチェック
   */
  static isExemptPath(pathname: string): boolean {
    const exemptPaths = [
      '/api/auth/signin',
      '/api/health',
      '/api/status',
      '/_next',
      '/favicon.ico'
    ];

    return exemptPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Origin検証
   */
  static verifyOrigin(request: NextRequest, allowedOrigins: string[]): boolean {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    // Originヘッダーがある場合
    if (origin) {
      return allowedOrigins.includes(origin);
    }

    // Refererヘッダーで代替チェック
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        return allowedOrigins.includes(refererOrigin);
      } catch (error) {
        console.error('Invalid referer URL:', error);
        return false;
      }
    }

    // どちらもない場合は拒否
    return false;
  }

  /**
   * CSRFトークンをCookieに設定するためのヘッダー生成
   */
  static generateCookieHeader(token: string, secure: boolean = true): string {
    const cookieOptions = [
      `${this.COOKIE_NAME}=${token}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=3600' // 1時間
    ];

    if (secure) {
      cookieOptions.push('Secure');
    }

    return cookieOptions.join('; ');
  }

  /**
   * CSRFエラーレスポンス生成
   */
  static createErrorResponse(message: string = 'CSRF token validation failed') {
    return new Response(
      JSON.stringify({
        error: 'CSRF_TOKEN_INVALID',
        message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  }
}

/**
 * CSRF保護設定インターフェース
 */
export interface CSRFConfig {
  secret: string;
  maxAge?: number;
  allowedOrigins: string[];
  exemptPaths?: string[];
  cookieSecure?: boolean;
}

/**
 * CSRF保護ミドルウェア用ヘルパー
 */
export class CSRFMiddleware {
  private config: CSRFConfig;

  constructor(config: CSRFConfig) {
    this.config = {
      maxAge: 3600000, // 1時間
      exemptPaths: [],
      cookieSecure: true,
      ...config
    };
  }

  /**
   * リクエストのCSRF保護を検証
   */
  async validateRequest(request: NextRequest, sessionId?: string): Promise<{
    valid: boolean;
    error?: string;
    newToken?: string;
  }> {
    const { pathname } = request.nextUrl;
    const method = request.method;

    // セーフメソッドまたは除外パスの場合はスキップ
    if (CSRFProtection.isSafeMethod(method) || 
        CSRFProtection.isExemptPath(pathname) ||
        this.config.exemptPaths?.some(path => pathname.startsWith(path))) {
      return { valid: true };
    }

    // CSRF保護が必要なメソッドの場合
    if (CSRFProtection.requiresProtection(method)) {
      // Origin検証
      if (!CSRFProtection.verifyOrigin(request, this.config.allowedOrigins)) {
        return {
          valid: false,
          error: 'Invalid origin'
        };
      }

      // CSRFトークン取得
      let token = CSRFProtection.getTokenFromRequest(request);
      
      // フォームデータからも取得を試行
      if (!token) {
        token = await CSRFProtection.getTokenFromFormData(request);
      }

      if (!token) {
        return {
          valid: false,
          error: 'CSRF token missing'
        };
      }

      // セッションベースの検証
      if (sessionId) {
        const isValid = await CSRFProtection.verifySessionToken(
          token,
          sessionId,
          this.config.secret,
          this.config.maxAge
        );

        if (!isValid) {
          return {
            valid: false,
            error: 'CSRF token invalid'
          };
        }
      }
    }

    // 新しいトークンを生成（セッションがある場合）
    let newToken: string | undefined;
    if (sessionId) {
      newToken = await CSRFProtection.generateSessionToken(sessionId, this.config.secret);
    }

    return {
      valid: true,
      newToken
    };
  }

  /**
   * レスポンスにCSRFトークンを設定
   */
  setTokenInResponse(response: Response, token: string): Response {
    const cookieHeader = CSRFProtection.generateCookieHeader(
      token,
      this.config.cookieSecure
    );

    response.headers.set('Set-Cookie', cookieHeader);
    return response;
  }
}
