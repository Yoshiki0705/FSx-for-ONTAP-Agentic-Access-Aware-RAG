/**
 * 統合スタック インデックス
 * 
 * モジュラーアーキテクチャに基づく6つの統合CDKスタック
 * 依存関係に基づく段階的デプロイメント対応
 */

// 統合スタックのエクスポート
export { SecurityStack, SecurityStackProps } from './security-stack';
export { NetworkingStack, NetworkingStackProps } from './networking-stack';
export { DataStack, DataStackProps } from './data-stack';
export { EmbeddingStack, EmbeddingStackProps } from './embedding-stack';
export { WebAppStack, WebAppStackProps } from './webapp-stack';
// export { AdvancedPermissionStack, AdvancedPermissionStackProps } from './advanced-permission-stack';
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
export const DEPLOYMENT_ORDER = [
  'SecurityStack',
  'NetworkingStack', 
  'DataStack',
  'EmbeddingStack',
  'WebAppStack',
  'AdvancedPermissionStack',
  'OperationsStack',
] as const;

/**
 * スタック間の依存関係マッピング
 * 
 * 各スタックが依存する他のスタックを明示的に定義
 * デプロイメント順序の決定とエラー防止に使用
 */
export const STACK_DEPENDENCIES = {
  SecurityStack: [],
  NetworkingStack: ['SecurityStack'],
  DataStack: ['SecurityStack', 'NetworkingStack'],
  EmbeddingStack: ['SecurityStack', 'NetworkingStack', 'DataStack'],
  WebAppStack: ['SecurityStack', 'NetworkingStack', 'EmbeddingStack'],
  AdvancedPermissionStack: ['SecurityStack', 'NetworkingStack', 'DataStack', 'WebAppStack'],
  OperationsStack: ['SecurityStack', 'NetworkingStack', 'DataStack', 'EmbeddingStack', 'WebAppStack', 'AdvancedPermissionStack'],
} as const;

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
  
  // 機能フラグ（各スタックの有効/無効制御）
  enableSecurity: boolean;
  enableNetworking: boolean;
  enableData: boolean;
  enableEmbedding: boolean;
  enableWebApp: boolean;
  enableAdvancedPermissionControl: boolean;
  enableOperations: boolean;
  
  // 各スタック固有の設定（型安全性のため具体的な型定義を推奨）
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
export const STACK_METADATA = {
  SecurityStack: {
    description: 'セキュリティ統合管理（KMS、WAF、CloudTrail、IAM）',
    category: 'Security',
    estimatedCost: 'Low',
    deploymentTime: '5-10 minutes',
  },
  NetworkingStack: {
    description: 'ネットワーク基盤統合管理（VPC、サブネット、ゲートウェイ）',
    category: 'Infrastructure',
    estimatedCost: 'Medium',
    deploymentTime: '10-15 minutes',
  },
  DataStack: {
    description: 'データ・ストレージ統合管理（S3、DynamoDB、OpenSearch、FSx）',
    category: 'Data',
    estimatedCost: 'High',
    deploymentTime: '15-30 minutes',
  },
  EmbeddingStack: {
    description: 'Embedding・AI統合管理（Lambda、ECS、Bedrock、AWS Batch）',
    category: 'Embedding',
    estimatedCost: 'Medium',
    deploymentTime: '10-20 minutes',
  },
  WebAppStack: {
    description: 'API・フロントエンド統合管理（API Gateway、CloudFront、Cognito）',
    category: 'Frontend',
    estimatedCost: 'Medium',
    deploymentTime: '15-25 minutes',
  },
  AdvancedPermissionStack: {
    description: '高度権限制御統合管理（時間制限、地理制限、動的権限）',
    category: 'Security',
    estimatedCost: 'Medium',
    deploymentTime: '10-20 minutes',
  },
  OperationsStack: {
    description: '監視・エンタープライズ統合管理（CloudWatch、SNS、アクセス制御）',
    category: 'Operations',
    estimatedCost: 'Low',
    deploymentTime: '5-15 minutes',
  },
} as const;

/**
 * 統合スタックの総合情報
 */
export const INTEGRATED_STACKS_INFO = {
  totalStacks: 7,
  totalEstimatedDeploymentTime: '65-125 minutes',
  totalEstimatedMonthlyCost: '$275-875 (depending on usage)',
  supportedRegions: [
    'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
    'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2'
  ],
  requiredPermissions: [
    'CloudFormation full access',
    'IAM full access',
    'EC2 full access',
    'S3 full access',
    'Lambda full access',
    'API Gateway full access',
    'CloudFront full access',
    'DynamoDB full access',
    'OpenSearch full access',
    'FSx full access',
    'Bedrock full access',
    'CloudWatch full access',
    'SNS full access',
    'Cognito full access',
    'WAF full access',
    'KMS full access',
    'CloudTrail full access',
  ],
} as const;