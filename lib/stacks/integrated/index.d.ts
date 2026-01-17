/**
 * 統合スタック インデックス
 *
 * モジュラーアーキテクチャに基づく6つの統合CDKスタック
 * 依存関係に基づく段階的デプロイメント対応
 */
export { SecurityStack, SecurityStackProps } from './security-stack';
export { NetworkingStack, NetworkingStackProps } from './networking-stack';
export { DataStack, DataStackProps } from './data-stack';
export { EmbeddingStack, EmbeddingStackProps } from './embedding-stack';
export { WebAppStack, WebAppStackProps } from './webapp-stack';
export { OperationsStack, OperationsStackProps } from './operations-stack';
/**
 * 統合スタックのデプロイメント順序
 *
 * 依存関係に基づく推奨デプロイメント順序:
 * 1. SecurityStack - セキュリティ基盤（KMS、WAF、CloudTrail）
 * 2. NetworkingStack - ネットワーク基盤（VPC、サブネット、セキュリティグループ）
 * 3. DataStack - データ・ストレージ（S3、DynamoDB、OpenSearch、FSx）
 * 4. EmbeddingStack - Embedding・AI（Lambda、ECS、Bedrock、AWS Batch）
 * 5. WebAppStack - API・フロントエンド（API Gateway、CloudFront、Cognito）
 * 6. AdvancedPermissionStack - 高度権限制御（時間・地理・動的権限制御）
 * 7. OperationsStack - 監視・エンタープライズ（CloudWatch、SNS、アクセス制御）
 *
 * 注意: AdvancedPermissionStackはWebAppStackの後にデプロイする必要があります
 * （OpenSearchエンドポイントとAPI統合が必要なため）
 */
export declare const DEPLOYMENT_ORDER: readonly ["SecurityStack", "NetworkingStack", "DataStack", "EmbeddingStack", "WebAppStack", "AdvancedPermissionStack", "OperationsStack"];
/**
 * スタック間の依存関係マッピング
 *
 * 各スタックが依存する他のスタックを明示的に定義
 * デプロイメント順序の決定とエラー防止に使用
 */
export declare const STACK_DEPENDENCIES: {
    readonly SecurityStack: readonly [];
    readonly NetworkingStack: readonly ["SecurityStack"];
    readonly DataStack: readonly ["SecurityStack", "NetworkingStack"];
    readonly EmbeddingStack: readonly ["SecurityStack", "NetworkingStack", "DataStack"];
    readonly WebAppStack: readonly ["SecurityStack", "NetworkingStack", "EmbeddingStack"];
    readonly AdvancedPermissionStack: readonly ["SecurityStack", "NetworkingStack", "DataStack", "WebAppStack"];
    readonly OperationsStack: readonly ["SecurityStack", "NetworkingStack", "DataStack", "EmbeddingStack", "WebAppStack", "AdvancedPermissionStack"];
};
/**
 * 統合スタック設定インターフェース
 *
 * 全統合スタックの設定を統一的に管理するためのインターフェース
 * 型安全性を確保し、設定の一貫性を保つ
 */
export interface IntegratedStacksConfig {
    /** プロジェクト名（リソース命名に使用） */
    projectName: string;
    /** 環境名（dev/staging/prod） */
    environment: string;
    /** AWSリージョン */
    region: string;
    enableSecurity: boolean;
    enableNetworking: boolean;
    enableData: boolean;
    enableEmbedding: boolean;
    enableWebApp: boolean;
    enableAdvancedPermissionControl: boolean;
    enableOperations: boolean;
    securityConfig?: Record<string, unknown>;
    networkingConfig?: Record<string, unknown>;
    storageConfig?: Record<string, unknown>;
    databaseConfig?: Record<string, unknown>;
    embeddingConfig?: Record<string, unknown>;
    aiConfig?: Record<string, unknown>;
    apiConfig?: Record<string, unknown>;
    monitoringConfig?: Record<string, unknown>;
    enterpriseConfig?: Record<string, unknown>;
}
/**
 * 統合スタックのメタデータ
 */
export declare const STACK_METADATA: {
    readonly SecurityStack: {
        readonly description: "セキュリティ統合管理（KMS、WAF、CloudTrail、IAM）";
        readonly category: "Security";
        readonly estimatedCost: "Low";
        readonly deploymentTime: "5-10 minutes";
    };
    readonly NetworkingStack: {
        readonly description: "ネットワーク基盤統合管理（VPC、サブネット、ゲートウェイ）";
        readonly category: "Infrastructure";
        readonly estimatedCost: "Medium";
        readonly deploymentTime: "10-15 minutes";
    };
    readonly DataStack: {
        readonly description: "データ・ストレージ統合管理（S3、DynamoDB、OpenSearch、FSx）";
        readonly category: "Data";
        readonly estimatedCost: "High";
        readonly deploymentTime: "15-30 minutes";
    };
    readonly EmbeddingStack: {
        readonly description: "Embedding・AI統合管理（Lambda、ECS、Bedrock、AWS Batch）";
        readonly category: "Embedding";
        readonly estimatedCost: "Medium";
        readonly deploymentTime: "10-20 minutes";
    };
    readonly WebAppStack: {
        readonly description: "API・フロントエンド統合管理（API Gateway、CloudFront、Cognito）";
        readonly category: "Frontend";
        readonly estimatedCost: "Medium";
        readonly deploymentTime: "15-25 minutes";
    };
    readonly AdvancedPermissionStack: {
        readonly description: "高度権限制御統合管理（時間制限、地理制限、動的権限）";
        readonly category: "Security";
        readonly estimatedCost: "Medium";
        readonly deploymentTime: "10-20 minutes";
    };
    readonly OperationsStack: {
        readonly description: "監視・エンタープライズ統合管理（CloudWatch、SNS、アクセス制御）";
        readonly category: "Operations";
        readonly estimatedCost: "Low";
        readonly deploymentTime: "5-15 minutes";
    };
};
/**
 * 統合スタックの総合情報
 */
export declare const INTEGRATED_STACKS_INFO: {
    readonly totalStacks: 7;
    readonly totalEstimatedDeploymentTime: "65-125 minutes";
    readonly totalEstimatedMonthlyCost: "$275-875 (depending on usage)";
    readonly supportedRegions: readonly ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-northeast-1", "ap-northeast-3", "ap-southeast-1", "ap-southeast-2"];
    readonly requiredPermissions: readonly ["CloudFormation full access", "IAM full access", "EC2 full access", "S3 full access", "Lambda full access", "API Gateway full access", "CloudFront full access", "DynamoDB full access", "OpenSearch full access", "FSx full access", "Bedrock full access", "CloudWatch full access", "SNS full access", "Cognito full access", "WAF full access", "KMS full access", "CloudTrail full access"];
};
