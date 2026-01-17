/**
 * アクセス権限テストモジュール統合エクスポート
 * 
 * 実本番IAM/OpenSearchでの権限ベースアクセス制御テスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

export { default as AccessControlTestModule } from './access-control-test-module';
export { default as AccessControlTestRunner } from './access-control-test-runner';

export type {
  AccessControlTestResult,
  TestUserPermissions,
  DocumentAccessInfo
} from './access-control-test-module';

// テストカテゴリの定義
export const ACCESS_CONTROL_TEST_CATEGORIES = {
  AUTHORIZED_ACCESS: 'authorized-access',
  UNAUTHORIZED_ACCESS: 'unauthorized-access',
  ADMIN_PERMISSIONS: 'admin-permissions',
  MULTI_GROUP_PERMISSIONS: 'multi-group-permissions',
  IAM_ROLE_ACCESS: 'iam-role-access'
} as const;

// テスト重要度の定義
export const ACCESS_CONTROL_TEST_PRIORITIES = {
  CRITICAL: 'critical',    // 不正アクセス防止
  HIGH: 'high',           // 正当なアクセス確保
  MEDIUM: 'medium',       // 管理者権限
  LOW: 'low'              // 複合権限
} as const;

// セキュリティスコア閾値
export const SECURITY_SCORE_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.7,
  NEEDS_IMPROVEMENT: 0.5
} as const;