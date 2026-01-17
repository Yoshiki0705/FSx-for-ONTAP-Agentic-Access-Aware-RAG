/**
 * セキュリティモジュール設定インターフェース
 * 
 * 機能:
 * - IAM・KMS・WAF・GuardDuty設定の型定義
 * - セキュリティポリシー・コンプライアンス設定
 * - 暗号化・アクセス制御設定
 */

import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

/**
 * IAM設定
 */
export interface IamConfig {
  /** 強力なパスワード強制 */
  readonly enforceStrongPasswords: boolean;
  
  /** MFA必須 */
  readonly mfaRequired: boolean;
  
  /** セッションタイムアウト（秒） */
  readonly sessionTimeout: number;
  
  /** パスワードポリシー */
  readonly passwordPolicy?: IamPasswordPolicy;
  
  /** カスタムロール */
  readonly customRoles?: IamCustomRole[];
  
  /** カスタムポリシー */
  readonly customPolicies?: IamCustomPolicy[];
  
  /** アクセス分析 */
  readonly accessAnalyzer?: boolean;
}

/**
 * IAMパスワードポリシー
 */
export interface IamPasswordPolicy {
  /** 最小長 */
  readonly minimumLength: number;
  
  /** 大文字必須 */
  readonly requireUppercase: boolean;
  
  /** 小文字必須 */
  readonly requireLowercase: boolean;
  
  /** 数字必須 */
  readonly requireNumbers: boolean;
  
  /** 記号必須 */
  readonly requireSymbols: boolean;
  
  /** パスワード再利用防止 */
  readonly preventReuse?: number;
  
  /** パスワード有効期限（日） */
  readonly maxAge?: number;
}

/**
 * IAMカスタムロール
 */
export interface IamCustomRole {
  /** ロール名 */
  readonly roleName: string;
  
  /** 説明 */
  readonly description: string;
  
  /** 信頼ポリシー */
  readonly assumedBy: iam.IPrincipal;
  
  /** 管理ポリシーARN */
  readonly managedPolicies?: string[];
  
  /** インラインポリシー */
  readonly inlinePolicies?: Record<string, iam.PolicyDocument>;
  
  /** 最大セッション時間 */
  readonly maxSessionDuration?: number;
}

/**
 * IAMカスタムポリシー
 */
export interface IamCustomPolicy {
  /** ポリシー名 */
  readonly policyName: string;
  
  /** 説明 */
  readonly description: string;
  
  /** ポリシードキュメント */
  readonly document: iam.PolicyDocument;
  
  /** 適用対象ロール */
  readonly roles?: string[];
  
  /** 適用対象ユーザー */
  readonly users?: string[];
  
  /** 適用対象グループ */
  readonly groups?: string[];
}

/**
 * KMS設定
 */
export interface KmsConfig {
  /** キーローテーション有効 */
  readonly keyRotation: boolean;
  
  /** キー仕様 */
  readonly keySpec: kms.KeySpec;
  
  /** キー使用用途 */
  readonly keyUsage: kms.KeyUsage;
  
  /** キーポリシー */
  readonly keyPolicy?: iam.PolicyDocument;
  
  /** エイリアス */
  readonly alias?: string;
  
  /** 削除保護期間（日） */
  readonly pendingWindow?: number;
  
  /** マルチリージョンキー */
  readonly multiRegion?: boolean;
  
  /** カスタムキー */
  readonly customKeys?: KmsCustomKey[];
}

/**
 * KMSカスタムキー
 */
export interface KmsCustomKey {
  /** キー名 */
  readonly keyName: string;
  
  /** 説明 */
  readonly description: string;
  
  /** キー仕様 */
  readonly keySpec: kms.KeySpec;
  
  /** キー使用用途 */
  readonly keyUsage: kms.KeyUsage;
  
  /** キーポリシー */
  readonly keyPolicy?: iam.PolicyDocument;
  
  /** エイリアス */
  readonly alias?: string;
}

/**
 * WAF設定
 */
export interface WafConfig {
  /** WAF有効化 */
  readonly enabled: boolean;
  
  /** スコープ */
  readonly scope: 'REGIONAL' | 'CLOUDFRONT';
  
  /** ルール設定 */
  readonly rules: WafRulesConfig;
  
  /** ログ設定 */
  readonly logging?: WafLoggingConfig;
  
  /** メトリクス設定 */
  readonly metrics?: boolean;
  
  /** カスタムルール */
  readonly customRules?: WafCustomRule[];
}

/**
 * WAFルール設定
 */
export interface WafRulesConfig {
  /** AWS管理ルール使用 */
  readonly awsManagedRules: boolean;
  
  /** レート制限 */
  readonly rateLimiting: boolean;
  
  /** 地理的ブロック */
  readonly geoBlocking?: string[];
  
  /** IP許可リスト */
  readonly ipAllowList?: string[];
  
  /** IP拒否リスト */
  readonly ipBlockList?: string[];
  
  /** SQLインジェクション保護 */
  readonly sqlInjectionProtection?: boolean;
  
  /** XSS保護 */
  readonly xssProtection?: boolean;
}

/**
 * WAFログ設定
 */
export interface WafLoggingConfig {
  /** ログ有効化 */
  readonly enabled: boolean;
  
  /** ログ送信先 */
  readonly destination: 'cloudwatch' | 's3' | 'kinesis';
  
  /** ログ保持期間（日） */
  readonly retentionDays?: number;
  
  /** フィルタリング */
  readonly filtering?: WafLogFilter[];
}

/**
 * WAFログフィルター
 */
export interface WafLogFilter {
  /** フィルター名 */
  readonly name: string;
  
  /** 条件 */
  readonly condition: string;
  
  /** アクション */
  readonly action: 'include' | 'exclude';
}

/**
 * WAFカスタムルール
 */
export interface WafCustomRule {
  /** ルール名 */
  readonly name: string;
  
  /** 優先度 */
  readonly priority: number;
  
  /** アクション */
  readonly action: wafv2.CfnWebACL.RuleActionProperty;
  
  /** ステートメント */
  readonly statement: wafv2.CfnWebACL.StatementProperty;
  
  /** 可視性設定 */
  readonly visibilityConfig: wafv2.CfnWebACL.VisibilityConfigProperty;
}

/**
 * GuardDuty設定
 */
export interface GuardDutyConfig {
  /** GuardDuty有効化 */
  readonly enabled: boolean;
  
  /** 検出結果公開頻度 */
  readonly findingPublishingFrequency: 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'SIX_HOURS';
  
  /** マルウェア保護 */
  readonly malwareProtection?: boolean;
  
  /** Kubernetes保護 */
  readonly kubernetesProtection?: boolean;
  
  /** S3保護 */
  readonly s3Protection?: boolean;
  
  /** 脅威インテリジェンス */
  readonly threatIntelligence?: GuardDutyThreatIntelConfig;
  
  /** 通知設定 */
  readonly notifications?: GuardDutyNotificationConfig;
}

/**
 * GuardDuty脅威インテリジェンス設定
 */
export interface GuardDutyThreatIntelConfig {
  /** 有効化 */
  readonly enabled: boolean;
  
  /** カスタム脅威リスト */
  readonly customThreatLists?: string[];
  
  /** 信頼できるIPリスト */
  readonly trustedIpLists?: string[];
}

/**
 * GuardDuty通知設定
 */
export interface GuardDutyNotificationConfig {
  /** SNSトピックARN */
  readonly snsTopicArn?: string;
  
  /** 重要度フィルター */
  readonly severityFilter?: ('LOW' | 'MEDIUM' | 'HIGH')[];
  
  /** 検出タイプフィルター */
  readonly findingTypeFilter?: string[];
}

/**
 * セキュリティコンプライアンス設定
 */
export interface SecurityComplianceConfig {
  /** FISC準拠 */
  readonly fiscCompliance?: boolean;
  
  /** 個人情報保護法準拠 */
  readonly personalInfoProtection?: boolean;
  
  /** GDPR準拠 */
  readonly gdprCompliance?: boolean;
  
  /** SOX法準拠 */
  readonly soxCompliance?: boolean;
  
  /** HIPAA準拠 */
  readonly hipaaCompliance?: boolean;
  
  /** 監査ログ */
  readonly auditLogging: boolean;
  
  /** データ分類 */
  readonly dataClassification?: boolean;
  
  /** アクセス制御 */
  readonly accessControls?: boolean;
}

/**
 * セキュリティ統合設定
 */
export interface SecurityConfig {
  /** IAM設定 */
  readonly iam: IamConfig;
  
  /** KMS設定 */
  readonly kms: KmsConfig;
  
  /** WAF設定 */
  readonly waf: WafConfig;
  
  /** GuardDuty設定 */
  readonly guardDuty: GuardDutyConfig;
  
  /** コンプライアンス設定 */
  readonly compliance: SecurityComplianceConfig;
  
  /** セキュリティ監視 */
  readonly monitoring?: SecurityMonitoringConfig;
  
  /** インシデント対応 */
  readonly incidentResponse?: IncidentResponseConfig;
}

/**
 * セキュリティ監視設定
 */
export interface SecurityMonitoringConfig {
  /** CloudTrail有効化 */
  readonly cloudTrail: boolean;
  
  /** Config有効化 */
  readonly config?: boolean;
  
  /** Security Hub有効化 */
  readonly securityHub?: boolean;
  
  /** Inspector有効化 */
  readonly inspector?: boolean;
  
  /** アラート設定 */
  readonly alerts?: SecurityAlertConfig[];
}

/**
 * セキュリティアラート設定
 */
export interface SecurityAlertConfig {
  /** アラート名 */
  readonly name: string;
  
  /** 条件 */
  readonly condition: string;
  
  /** 重要度 */
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  /** 通知先 */
  readonly notificationTargets: string[];
}

/**
 * インシデント対応設定
 */
export interface IncidentResponseConfig {
  /** 自動対応有効化 */
  readonly autoResponse: boolean;
  
  /** 対応プレイブック */
  readonly playbooks?: IncidentPlaybook[];
  
  /** エスカレーション設定 */
  readonly escalation?: IncidentEscalationConfig;
}

/**
 * インシデントプレイブック
 */
export interface IncidentPlaybook {
  /** プレイブック名 */
  readonly name: string;
  
  /** トリガー条件 */
  readonly trigger: string;
  
  /** 対応アクション */
  readonly actions: string[];
  
  /** 通知先 */
  readonly notifications: string[];
}

/**
 * インシデントエスカレーション設定
 */
export interface IncidentEscalationConfig {
  /** エスカレーション時間（分） */
  readonly escalationTime: number;
  
  /** エスカレーション先 */
  readonly escalationTargets: string[];
  
  /** 重要度別設定 */
  readonly severityBasedEscalation?: Record<string, number>;
}