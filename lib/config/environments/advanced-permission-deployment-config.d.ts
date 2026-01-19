/**
 * 高度権限制御システム デプロイメント設定
 *
 * 環境別の高度権限制御システム統合設定
 * 時間ベース制限、地理的制限、動的権限の環境別調整
 */
import { IntegratedStacksConfig } from '../../stacks/integrated';
/**
 * 開発環境向け高度権限制御統合設定
 */
export declare const DevelopmentAdvancedPermissionDeploymentConfig: IntegratedStacksConfig;
/**
 * ステージング環境向け高度権限制御統合設定
 */
export declare const StagingAdvancedPermissionDeploymentConfig: IntegratedStacksConfig;
/**
 * 本番環境向け高度権限制御統合設定
 */
export declare const ProductionAdvancedPermissionDeploymentConfig: IntegratedStacksConfig;
/**
 * 環境別設定取得関数
 */
export declare function getAdvancedPermissionDeploymentConfig(environment: string): IntegratedStacksConfig;
/**
 * 高度権限制御システム統合デプロイメント情報
 */
export declare const ADVANCED_PERMISSION_DEPLOYMENT_INFO: {
    readonly supportedEnvironments: readonly ["development", "staging", "production"];
    readonly requiredServices: readonly ["AWS Lambda", "Amazon DynamoDB", "Amazon OpenSearch Serverless", "AWS KMS", "Amazon CloudWatch", "Amazon SNS", "AWS IAM"];
    readonly estimatedDeploymentTime: {
        readonly development: "5-8 minutes";
        readonly staging: "6-10 minutes";
        readonly production: "8-12 minutes";
    };
    readonly estimatedMonthlyCost: {
        readonly development: "$25-50 USD";
        readonly staging: "$50-100 USD";
        readonly production: "$75-150 USD";
    };
    readonly securityFeatures: readonly ["時間ベース制限（営業時間・緊急アクセス）", "地理的制限（国家・IP・VPN制御）", "動的権限（プロジェクト参加・一時的アクセス）", "リアルタイム監査ログ", "リスクベース認証", "多層防御アーキテクチャ"];
    readonly complianceStandards: readonly ["ISO 27001", "SOC 2 Type II", "個人情報保護法", "GDPR準拠（将来対応）"];
};
/**
 * デプロイメント前チェックリスト
 */
export declare const DEPLOYMENT_CHECKLIST: {
    readonly prerequisites: readonly ["AWS CLI設定済み", "CDK CLI インストール済み", "Node.js 20+ インストール済み", "TypeScript 5.3+ インストール済み", "適切なAWS権限設定済み"];
    readonly environmentVariables: readonly ["AWS_REGION", "CDK_DEFAULT_ACCOUNT", "OPENSEARCH_ENDPOINT", "GEO_LOCATION_API_KEY (オプション)", "PROJECT_MANAGEMENT_API_KEY (オプション)", "SECURITY_ALERT_EMAIL (オプション)"];
    readonly postDeploymentTasks: readonly ["CloudWatchダッシュボード確認", "Lambda関数動作テスト", "DynamoDBテーブル作成確認", "SNSトピック通知テスト", "権限フィルタリング機能テスト", "セキュリティ監査ログ確認"];
};
