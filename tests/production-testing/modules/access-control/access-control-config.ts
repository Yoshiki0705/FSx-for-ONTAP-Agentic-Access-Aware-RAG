/**
 * アクセス権限テスト設定
 * 
 * 実本番環境でのアクセス権限テストに関する設定を管理
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

/**
 * アクセス権限テスト設定インターフェース
 */
export interface AccessControlTestConfig {
  // テスト実行設定
  execution: {
    timeout: number;
    retryCount: number;
    maxConcurrency: number;
    failFast: boolean;
  };

  // テストユーザー設定
  testUsers: {
    enabledUsers: string[];
    adminUser?: string;
    readOnlyUser?: string;
    multiGroupUser?: string;
  };

  // 文書テスト設定
  testDocuments: {
    enabledDocuments: string[];
    publicDocuments: string[];
    restrictedDocuments: string[];
    confidentialDocuments: string[];
  };

  // セキュリティ設定
  security: {
    enableRealTimeValidation: boolean;
    logAccessAttempts: boolean;
    alertOnUnauthorizedAccess: boolean;
    maxFailedAttempts: number;
  };

  // レポート設定
  reporting: {
    generateDetailedReport: boolean;
    includeMetadata: boolean;
    exportFormat: 'json' | 'markdown' | 'both';
    saveToFile: boolean;
  };
}

/**
 * デフォルトアクセス権限テスト設定
 */
export const defaultAccessControlTestConfig: AccessControlTestConfig = {
  execution: {
    timeout: 45000, // 45秒
    retryCount: 2,
    maxConcurrency: 1, // アクセス権限テストは順次実行
    failFast: false
  },

  testUsers: {
    enabledUsers: ['test-user-1', 'test-user-2', 'test-admin-user'],
    adminUser: 'test-admin-user',
    readOnlyUser: 'test-user-2',
    multiGroupUser: 'test-user-1'
  },

  testDocuments: {
    enabledDocuments: ['doc-001', 'doc-002', 'doc-003', 'doc-004', 'doc-005'],
    publicDocuments: ['doc-001'],
    restrictedDocuments: ['doc-004', 'doc-005'],
    confidentialDocuments: ['doc-003']
  },

  security: {
    enableRealTimeValidation: true,
    logAccessAttempts: true,
    alertOnUnauthorizedAccess: true,
    maxFailedAttempts: 3
  },

  reporting: {
    generateDetailedReport: true,
    includeMetadata: true,
    exportFormat: 'both',
    saveToFile: true
  }
};

/**
 * 本番環境用アクセス権限テスト設定
 */
export const productionAccessControlTestConfig: AccessControlTestConfig = {
  ...defaultAccessControlTestConfig,
  
  execution: {
    ...defaultAccessControlTestConfig.execution,
    timeout: 60000, // 本番環境では60秒
    retryCount: 1   // 本番環境では再試行を最小限に
  },

  security: {
    ...defaultAccessControlTestConfig.security,
    enableRealTimeValidation: true,
    logAccessAttempts: true,
    alertOnUnauthorizedAccess: true,
    maxFailedAttempts: 1 // 本番環境では厳格に
  }
};

/**
 * 開発環境用アクセス権限テスト設定
 */
export const developmentAccessControlTestConfig: AccessControlTestConfig = {
  ...defaultAccessControlTestConfig,
  
  execution: {
    ...defaultAccessControlTestConfig.execution,
    timeout: 30000, // 開発環境では30秒
    retryCount: 3   // 開発環境では再試行を多めに
  },

  security: {
    ...defaultAccessControlTestConfig.security,
    alertOnUnauthorizedAccess: false, // 開発環境ではアラート無効
    maxFailedAttempts: 5
  }
};

/**
 * 環境に応じた設定の取得
 */
export function getAccessControlTestConfig(environment: string): AccessControlTestConfig {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return productionAccessControlTestConfig;
    
    case 'development':
    case 'dev':
      return developmentAccessControlTestConfig;
    
    default:
      return defaultAccessControlTestConfig;
  }
}

/**
 * テストユーザーグループ定義
 */
export const TEST_USER_GROUPS = {
  ADMINS: 'admins',
  USERS: 'users',
  READONLY_USERS: 'readonly-users',
  ENGINEERING: 'engineering',
  SECURITY: 'security'
} as const;

/**
 * 文書セキュリティレベル定義
 */
export const DOCUMENT_SECURITY_LEVELS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  RESTRICTED: 'restricted'
} as const;

/**
 * 権限レベル定義
 */
export const PERMISSION_LEVELS = {
  NONE: 'none',
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin'
} as const;

/**
 * アクセス権限テスト結果の評価基準
 */
export const ACCESS_CONTROL_EVALUATION_CRITERIA = {
  // セキュリティスコア重み付け
  SECURITY_WEIGHTS: {
    UNAUTHORIZED_ACCESS_PREVENTION: 0.3, // 最重要
    AUTHORIZED_ACCESS_GUARANTEE: 0.2,
    ADMIN_PERMISSIONS: 0.2,
    MULTI_GROUP_INTEGRATION: 0.15,
    IAM_ROLE_COMPLIANCE: 0.15
  },

  // 成功率閾値
  SUCCESS_RATE_THRESHOLDS: {
    EXCELLENT: 0.95,
    GOOD: 0.85,
    ACCEPTABLE: 0.75,
    NEEDS_IMPROVEMENT: 0.60
  },

  // セキュリティスコア閾値
  SECURITY_SCORE_THRESHOLDS: {
    EXCELLENT: 0.9,
    GOOD: 0.7,
    ACCEPTABLE: 0.5,
    CRITICAL: 0.3
  }
};

export default {
  defaultAccessControlTestConfig,
  productionAccessControlTestConfig,
  developmentAccessControlTestConfig,
  getAccessControlTestConfig,
  TEST_USER_GROUPS,
  DOCUMENT_SECURITY_LEVELS,
  PERMISSION_LEVELS,
  ACCESS_CONTROL_EVALUATION_CRITERIA
};