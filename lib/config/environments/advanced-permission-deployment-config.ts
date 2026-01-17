/**
 * 高度権限制御システム デプロイメント設定
 * 
 * 環境別の高度権限制御システム統合設定
 * 時間ベース制限、地理的制限、動的権限の環境別調整
 */

import { IntegratedStacksConfig } from '../../stacks/integrated';
import { getAdvancedPermissionConfig } from '../../modules/enterprise/configs/advanced-permission-config';

/**
 * 開発環境向け高度権限制御統合設定
 */
export const DevelopmentAdvancedPermissionDeploymentConfig: IntegratedStacksConfig = {
  projectName: 'permission-aware-rag',
  environment: 'dev',
  region: 'ap-northeast-1',
  
  // 機能フラグ（開発環境では一部制限を緩和）
  enableSecurity: true,
  enableNetworking: true,
  enableData: true,
  enableEmbedding: true,
  enableWebApp: true,
  enableAdvancedPermissionControl: true, // 高度権限制御有効
  enableOperations: true,
  
  // 各スタック固有の設定
  securityConfig: {
    enableKms: true,
    enableWaf: false, // 開発環境ではWAF無効
    enableGuardDuty: false, // 開発環境ではGuardDuty無効
    enableCloudTrail: true,
    kmsKeyRotation: false // 開発環境では自動ローテーション無効
  },
  
  networkingConfig: {
    vpcCidr: '10.0.0.0/16',
    enableNatGateway: false, // 開発環境ではコスト削減
    enableVpcFlowLogs: false,
    availabilityZones: 2
  },
  
  storageConfig: {
    enableS3Versioning: false, // 開発環境では無効
    enableS3Encryption: true,
    s3StorageClass: 'STANDARD',
    enableFsxBackup: false // 開発環境ではバックアップ無効
  },
  
  databaseConfig: {
    dynamoDbBillingMode: 'PAY_PER_REQUEST',
    enableDynamoDbBackup: false, // 開発環境ではバックアップ無効
    openSearchInstanceType: 't3.small.search',
    openSearchInstanceCount: 1,
    enableOpenSearchEncryption: true
  },
  
  embeddingConfig: {
    lambdaMemorySize: 1024,
    lambdaTimeout: 300,
    enableXRayTracing: false, // 開発環境では無効
    batchComputeEnvironmentType: 'UNMANAGED'
  },
  
  aiConfig: {
    bedrockRegion: 'us-east-1',
    enableBedrockLogging: false, // 開発環境では無効
    embeddingModel: 'amazon.titan-embed-text-v1',
    textModel: 'anthropic.claude-3-sonnet-20240229-v1:0'
  },
  
  apiConfig: {
    enableApiGatewayLogging: false, // 開発環境では無効
    apiGatewayThrottling: {
      rateLimit: 1000,
      burstLimit: 2000
    },
    enableCognito: true,
    cognitoPasswordPolicy: {
      minLength: 8,
      requireUppercase: false,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false
    }
  },
  
  monitoringConfig: {
    enableDetailedMonitoring: false, // 開発環境では無効
    logRetentionDays: 7, // 短期保持
    enableAlarms: false, // 開発環境ではアラーム無効
    enableDashboard: true
  },
  
  enterpriseConfig: {
    enableAccessControl: true,
    enableBiAnalytics: false, // 開発環境では無効
    enableOrganizationManagement: false, // 開発環境では無効
    enableComplianceReporting: false // 開発環境では無効
  }
};

/**
 * ステージング環境向け高度権限制御統合設定
 */
export const StagingAdvancedPermissionDeploymentConfig: IntegratedStacksConfig = {
  ...DevelopmentAdvancedPermissionDeploymentConfig,
  environment: 'staging',
  
  // ステージング環境では本番に近い設定
  securityConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.securityConfig,
    enableWaf: true, // WAF有効
    enableGuardDuty: true, // GuardDuty有効
    kmsKeyRotation: true // 自動ローテーション有効
  },
  
  networkingConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.networkingConfig,
    enableNatGateway: true, // NAT Gateway有効
    enableVpcFlowLogs: true,
    availabilityZones: 3 // 3AZ構成
  },
  
  storageConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.storageConfig,
    enableS3Versioning: true, // バージョニング有効
    enableFsxBackup: true // バックアップ有効
  },
  
  databaseConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.databaseConfig,
    enableDynamoDbBackup: true, // バックアップ有効
    openSearchInstanceType: 't3.medium.search',
    openSearchInstanceCount: 2 // 冗長化
  },
  
  embeddingConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.embeddingConfig,
    enableXRayTracing: true, // X-Ray有効
    batchComputeEnvironmentType: 'MANAGED'
  },
  
  aiConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.aiConfig,
    enableBedrockLogging: true // ログ有効
  },
  
  apiConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.apiConfig,
    enableApiGatewayLogging: true, // ログ有効
    cognitoPasswordPolicy: {
      minLength: 10,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true
    }
  },
  
  monitoringConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.monitoringConfig,
    enableDetailedMonitoring: true, // 詳細監視有効
    logRetentionDays: 30, // 30日保持
    enableAlarms: true, // アラーム有効
    enableDashboard: true
  },
  
  enterpriseConfig: {
    ...DevelopmentAdvancedPermissionDeploymentConfig.enterpriseConfig,
    enableBiAnalytics: true, // BI分析有効
    enableOrganizationManagement: true, // 組織管理有効
    enableComplianceReporting: true // コンプライアンス報告有効
  }
};

/**
 * 本番環境向け高度権限制御統合設定
 */
export const ProductionAdvancedPermissionDeploymentConfig: IntegratedStacksConfig = {
  ...StagingAdvancedPermissionDeploymentConfig,
  environment: 'prod',
  
  // 本番環境では最高レベルのセキュリティと可用性
  networkingConfig: {
    ...StagingAdvancedPermissionDeploymentConfig.networkingConfig,
    availabilityZones: 3, // 3AZ必須
    enableVpcFlowLogs: true,
    enableNatGateway: true
  },
  
  storageConfig: {
    ...StagingAdvancedPermissionDeploymentConfig.storageConfig,
    s3StorageClass: 'STANDARD_IA', // コスト最適化
    enableS3Versioning: true,
    enableFsxBackup: true
  },
  
  databaseConfig: {
    ...StagingAdvancedPermissionDeploymentConfig.databaseConfig,
    openSearchInstanceType: 'm6g.large.search', // 本番用インスタンス
    openSearchInstanceCount: 3, // 3ノード構成
    enableDynamoDbBackup: true,
    enableOpenSearchEncryption: true
  },
  
  embeddingConfig: {
    ...StagingAdvancedPermissionDeploymentConfig.embeddingConfig,
    lambdaMemorySize: 2048, // 本番用メモリ
    lambdaTimeout: 600, // 本番用タイムアウト
    enableXRayTracing: true
  },
  
  apiConfig: {
    ...StagingAdvancedPermissionDeploymentConfig.apiConfig,
    apiGatewayThrottling: {
      rateLimit: 5000, // 本番用レート制限
      burstLimit: 10000
    },
    cognitoPasswordPolicy: {
      minLength: 12, // 本番用パスワードポリシー
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true
    }
  },
  
  monitoringConfig: {
    ...StagingAdvancedPermissionDeploymentConfig.monitoringConfig,
    logRetentionDays: 90, // 90日保持
    enableDetailedMonitoring: true,
    enableAlarms: true,
    enableDashboard: true
  }
};

/**
 * 環境別設定取得関数
 */
export function getAdvancedPermissionDeploymentConfig(environment: string): IntegratedStacksConfig {
  switch (environment.toLowerCase()) {
    case 'development':
    case 'dev':
      return DevelopmentAdvancedPermissionDeploymentConfig;
    
    case 'staging':
    case 'stage':
      return StagingAdvancedPermissionDeploymentConfig;
    
    case 'production':
    case 'prod':
      return ProductionAdvancedPermissionDeploymentConfig;
    
    default:
      console.warn(`Unknown environment: ${environment}. Using development config.`);
      return DevelopmentAdvancedPermissionDeploymentConfig;
  }
}

/**
 * 高度権限制御システム統合デプロイメント情報
 */
export const ADVANCED_PERMISSION_DEPLOYMENT_INFO = {
  supportedEnvironments: ['development', 'staging', 'production'],
  requiredServices: [
    'AWS Lambda',
    'Amazon DynamoDB', 
    'Amazon OpenSearch Serverless',
    'AWS KMS',
    'Amazon CloudWatch',
    'Amazon SNS',
    'AWS IAM'
  ],
  estimatedDeploymentTime: {
    development: '5-8 minutes',
    staging: '6-10 minutes',
    production: '8-12 minutes'
  },
  estimatedMonthlyCost: {
    development: '$25-50 USD',
    staging: '$50-100 USD',
    production: '$75-150 USD'
  },
  securityFeatures: [
    '時間ベース制限（営業時間・緊急アクセス）',
    '地理的制限（国家・IP・VPN制御）',
    '動的権限（プロジェクト参加・一時的アクセス）',
    'リアルタイム監査ログ',
    'リスクベース認証',
    '多層防御アーキテクチャ'
  ],
  complianceStandards: [
    'ISO 27001',
    'SOC 2 Type II',
    '個人情報保護法',
    'GDPR準拠（将来対応）'
  ]
} as const;

/**
 * デプロイメント前チェックリスト
 */
export const DEPLOYMENT_CHECKLIST = {
  prerequisites: [
    'AWS CLI設定済み',
    'CDK CLI インストール済み',
    'Node.js 20+ インストール済み',
    'TypeScript 5.3+ インストール済み',
    '適切なAWS権限設定済み'
  ],
  environmentVariables: [
    'AWS_REGION',
    'CDK_DEFAULT_ACCOUNT',
    'OPENSEARCH_ENDPOINT',
    'GEO_LOCATION_API_KEY (オプション)',
    'PROJECT_MANAGEMENT_API_KEY (オプション)',
    'SECURITY_ALERT_EMAIL (オプション)'
  ],
  postDeploymentTasks: [
    'CloudWatchダッシュボード確認',
    'Lambda関数動作テスト',
    'DynamoDBテーブル作成確認',
    'SNSトピック通知テスト',
    '権限フィルタリング機能テスト',
    'セキュリティ監査ログ確認'
  ]
} as const;