/**
 * 認証設定管理
 * 環境別設定とバリデーション機能を提供
 */

export interface AuthConfig {
  readonly apiEndpoint: string;
  readonly redirectPath: string;
  readonly storageKey: string;
  readonly maxUsernameLength: number;
  readonly sessionTimeout: number;
  readonly passwordPolicy: PasswordPolicy;
  readonly retryPolicy: RetryPolicy;
}

export interface PasswordPolicy {
  readonly minLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireNumbers: boolean;
  readonly requireSpecialChars: boolean;
  readonly allowedSpecialChars: string;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly lockoutDuration: number;
  readonly backoffMultiplier: number;
}

/**
 * デフォルト認証設定（クライアントサイド認証対応）
 */
const DEFAULT_AUTH_CONFIG: AuthConfig = {
  apiEndpoint: '/client-auth', // クライアントサイド認証用（実際には使用されない）
  redirectPath: '/chatbot',
  storageKey: 'user',
  maxUsernameLength: 50,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24時間
  passwordPolicy: {
    minLength: 6, // 本番環境テスト用に緩和
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
    allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  },
  retryPolicy: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15分
    backoffMultiplier: 2
  }
};

/**
 * 環境別設定
 */
const ENVIRONMENT_CONFIGS: Record<string, Partial<AuthConfig>> = {
  development: {
    sessionTimeout: 8 * 60 * 60 * 1000, // 8時間
    passwordPolicy: {
      ...DEFAULT_AUTH_CONFIG.passwordPolicy,
      minLength: 6,
      requireSpecialChars: false
    }
  },
  staging: {
    sessionTimeout: 12 * 60 * 60 * 1000, // 12時間
  },
  production: {
    // 本番環境はデフォルト設定を使用
  }
};

/**
 * 認証設定ファクトリー
 */
export class AuthConfigFactory {
  private static instance: AuthConfig | null = null;

  /**
   * 環境に応じた認証設定を取得
   */
  static getConfig(): AuthConfig {
    if (!this.instance) {
      this.instance = this.createConfig();
    }
    return this.instance;
  }

  /**
   * 設定を強制リロード
   */
  static reloadConfig(): AuthConfig {
    this.instance = null;
    return this.getConfig();
  }

  /**
   * 設定作成
   */
  private static createConfig(): AuthConfig {
    const environment = process.env.NODE_ENV || 'development';
    const envConfig = ENVIRONMENT_CONFIGS[environment] || {};
    
    const config: AuthConfig = {
      ...DEFAULT_AUTH_CONFIG,
      ...envConfig,
      // 環境変数からの上書き
      apiEndpoint: process.env.NEXT_PUBLIC_AUTH_ENDPOINT || DEFAULT_AUTH_CONFIG.apiEndpoint,
      redirectPath: process.env.NEXT_PUBLIC_REDIRECT_PATH || DEFAULT_AUTH_CONFIG.redirectPath,
      passwordPolicy: {
        ...DEFAULT_AUTH_CONFIG.passwordPolicy,
        ...envConfig.passwordPolicy
      },
      retryPolicy: {
        ...DEFAULT_AUTH_CONFIG.retryPolicy,
        ...envConfig.retryPolicy
      }
    };

    // 設定検証
    this.validateConfig(config);
    
    return config;
  }

  /**
   * 設定検証
   */
  private static validateConfig(config: AuthConfig): void {
    if (!config.apiEndpoint) {
      throw new Error('認証APIエンドポイントが設定されていません');
    }

    if (!config.redirectPath) {
      throw new Error('リダイレクトパスが設定されていません');
    }

    if (config.maxUsernameLength < 1) {
      throw new Error('ユーザー名最大長は1以上である必要があります');
    }

    if (config.sessionTimeout < 60000) { // 1分未満
      throw new Error('セッションタイムアウトは1分以上である必要があります');
    }

    if (config.passwordPolicy.minLength < 4) {
      throw new Error('パスワード最小長は4文字以上である必要があります');
    }
  }
}

/**
 * パスワードポリシー検証
 */
export class PasswordValidator {
  private readonly policy: PasswordPolicy;

  constructor(policy: PasswordPolicy) {
    this.policy = policy;
  }

  /**
   * パスワード検証
   */
  validate(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.policy.minLength) {
      errors.push(`パスワードは${this.policy.minLength}文字以上で入力してください`);
    }

    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('パスワードには大文字を含めてください');
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('パスワードには小文字を含めてください');
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push('パスワードには数字を含めてください');
    }

    if (this.policy.requireSpecialChars) {
      const specialCharsRegex = new RegExp(`[${this.escapeRegex(this.policy.allowedSpecialChars)}]`);
      if (!specialCharsRegex.test(password)) {
        errors.push('パスワードには特殊文字を含めてください');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 正規表現エスケープ
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}