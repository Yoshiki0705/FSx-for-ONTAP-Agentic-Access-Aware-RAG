"use strict";
/**
 * 高度権限制御システム デプロイメント設定
 *
 * 環境別の高度権限制御システム統合設定
 * 時間ベース制限、地理的制限、動的権限の環境別調整
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPLOYMENT_CHECKLIST = exports.ADVANCED_PERMISSION_DEPLOYMENT_INFO = exports.ProductionAdvancedPermissionDeploymentConfig = exports.StagingAdvancedPermissionDeploymentConfig = exports.DevelopmentAdvancedPermissionDeploymentConfig = void 0;
exports.getAdvancedPermissionDeploymentConfig = getAdvancedPermissionDeploymentConfig;
/**
 * 開発環境向け高度権限制御統合設定
 */
exports.DevelopmentAdvancedPermissionDeploymentConfig = {
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
exports.StagingAdvancedPermissionDeploymentConfig = {
    ...exports.DevelopmentAdvancedPermissionDeploymentConfig,
    environment: 'staging',
    // ステージング環境では本番に近い設定
    securityConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.securityConfig,
        enableWaf: true, // WAF有効
        enableGuardDuty: true, // GuardDuty有効
        kmsKeyRotation: true // 自動ローテーション有効
    },
    networkingConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.networkingConfig,
        enableNatGateway: true, // NAT Gateway有効
        enableVpcFlowLogs: true,
        availabilityZones: 3 // 3AZ構成
    },
    storageConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.storageConfig,
        enableS3Versioning: true, // バージョニング有効
        enableFsxBackup: true // バックアップ有効
    },
    databaseConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.databaseConfig,
        enableDynamoDbBackup: true, // バックアップ有効
        openSearchInstanceType: 't3.medium.search',
        openSearchInstanceCount: 2 // 冗長化
    },
    embeddingConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.embeddingConfig,
        enableXRayTracing: true, // X-Ray有効
        batchComputeEnvironmentType: 'MANAGED'
    },
    aiConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.aiConfig,
        enableBedrockLogging: true // ログ有効
    },
    apiConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.apiConfig,
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
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.monitoringConfig,
        enableDetailedMonitoring: true, // 詳細監視有効
        logRetentionDays: 30, // 30日保持
        enableAlarms: true, // アラーム有効
        enableDashboard: true
    },
    enterpriseConfig: {
        ...exports.DevelopmentAdvancedPermissionDeploymentConfig.enterpriseConfig,
        enableBiAnalytics: true, // BI分析有効
        enableOrganizationManagement: true, // 組織管理有効
        enableComplianceReporting: true // コンプライアンス報告有効
    }
};
/**
 * 本番環境向け高度権限制御統合設定
 */
exports.ProductionAdvancedPermissionDeploymentConfig = {
    ...exports.StagingAdvancedPermissionDeploymentConfig,
    environment: 'prod',
    // 本番環境では最高レベルのセキュリティと可用性
    networkingConfig: {
        ...exports.StagingAdvancedPermissionDeploymentConfig.networkingConfig,
        availabilityZones: 3, // 3AZ必須
        enableVpcFlowLogs: true,
        enableNatGateway: true
    },
    storageConfig: {
        ...exports.StagingAdvancedPermissionDeploymentConfig.storageConfig,
        s3StorageClass: 'STANDARD_IA', // コスト最適化
        enableS3Versioning: true,
        enableFsxBackup: true
    },
    databaseConfig: {
        ...exports.StagingAdvancedPermissionDeploymentConfig.databaseConfig,
        openSearchInstanceType: 'm6g.large.search', // 本番用インスタンス
        openSearchInstanceCount: 3, // 3ノード構成
        enableDynamoDbBackup: true,
        enableOpenSearchEncryption: true
    },
    embeddingConfig: {
        ...exports.StagingAdvancedPermissionDeploymentConfig.embeddingConfig,
        lambdaMemorySize: 2048, // 本番用メモリ
        lambdaTimeout: 600, // 本番用タイムアウト
        enableXRayTracing: true
    },
    apiConfig: {
        ...exports.StagingAdvancedPermissionDeploymentConfig.apiConfig,
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
        ...exports.StagingAdvancedPermissionDeploymentConfig.monitoringConfig,
        logRetentionDays: 90, // 90日保持
        enableDetailedMonitoring: true,
        enableAlarms: true,
        enableDashboard: true
    }
};
/**
 * 環境別設定取得関数
 */
function getAdvancedPermissionDeploymentConfig(environment) {
    switch (environment.toLowerCase()) {
        case 'development':
        case 'dev':
            return exports.DevelopmentAdvancedPermissionDeploymentConfig;
        case 'staging':
        case 'stage':
            return exports.StagingAdvancedPermissionDeploymentConfig;
        case 'production':
        case 'prod':
            return exports.ProductionAdvancedPermissionDeploymentConfig;
        default:
            console.warn(`Unknown environment: ${environment}. Using development config.`);
            return exports.DevelopmentAdvancedPermissionDeploymentConfig;
    }
}
/**
 * 高度権限制御システム統合デプロイメント情報
 */
exports.ADVANCED_PERMISSION_DEPLOYMENT_INFO = {
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
};
/**
 * デプロイメント前チェックリスト
 */
exports.DEPLOYMENT_CHECKLIST = {
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
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2YW5jZWQtcGVybWlzc2lvbi1kZXBsb3ltZW50LWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkdmFuY2VkLXBlcm1pc3Npb24tZGVwbG95bWVudC1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7QUE0T0gsc0ZBa0JDO0FBelBEOztHQUVHO0FBQ1UsUUFBQSw2Q0FBNkMsR0FBMkI7SUFDbkYsV0FBVyxFQUFFLHNCQUFzQjtJQUNuQyxXQUFXLEVBQUUsS0FBSztJQUNsQixNQUFNLEVBQUUsZ0JBQWdCO0lBRXhCLHVCQUF1QjtJQUN2QixjQUFjLEVBQUUsSUFBSTtJQUNwQixnQkFBZ0IsRUFBRSxJQUFJO0lBQ3RCLFVBQVUsRUFBRSxJQUFJO0lBQ2hCLGVBQWUsRUFBRSxJQUFJO0lBQ3JCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLCtCQUErQixFQUFFLElBQUksRUFBRSxXQUFXO0lBQ2xELGdCQUFnQixFQUFFLElBQUk7SUFFdEIsYUFBYTtJQUNiLGNBQWMsRUFBRTtRQUNkLFNBQVMsRUFBRSxJQUFJO1FBQ2YsU0FBUyxFQUFFLEtBQUssRUFBRSxjQUFjO1FBQ2hDLGVBQWUsRUFBRSxLQUFLLEVBQUUsb0JBQW9CO1FBQzVDLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsY0FBYyxFQUFFLEtBQUssQ0FBQyxvQkFBb0I7S0FDM0M7SUFFRCxnQkFBZ0IsRUFBRTtRQUNoQixPQUFPLEVBQUUsYUFBYTtRQUN0QixnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsY0FBYztRQUN2QyxpQkFBaUIsRUFBRSxLQUFLO1FBQ3hCLGlCQUFpQixFQUFFLENBQUM7S0FDckI7SUFFRCxhQUFhLEVBQUU7UUFDYixrQkFBa0IsRUFBRSxLQUFLLEVBQUUsV0FBVztRQUN0QyxrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLGNBQWMsRUFBRSxVQUFVO1FBQzFCLGVBQWUsRUFBRSxLQUFLLENBQUMsaUJBQWlCO0tBQ3pDO0lBRUQsY0FBYyxF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ZTtRQUNmLGtCQUFrQjtRQUNsQixjQUFjO1FBQ2QsZ0JBQWdCO1FBQ2hCLGNBQWM7S0FDZjtDQUNPLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOmrmOW6puaoqemZkOWItuW+oeOCt+OCueODhuODoCDjg4fjg5fjg63jgqTjg6Hjg7Pjg4joqK3lrppcbiAqIFxuICog55Kw5aKD5Yil44Gu6auY5bqm5qip6ZmQ5Yi25b6h44K344K544OG44Og57Wx5ZCI6Kit5a6aXG4gKiDmmYLplpPjg5njg7zjgrnliLbpmZDjgIHlnLDnkIbnmoTliLbpmZDjgIHli5XnmoTmqKnpmZDjga7nkrDlooPliKXoqr/mlbRcbiAqL1xuXG5pbXBvcnQgeyBJbnRlZ3JhdGVkU3RhY2tzQ29uZmlnIH0gZnJvbSAnLi4vLi4vc3RhY2tzL2ludGVncmF0ZWQnO1xuaW1wb3J0IHsgZ2V0QWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9lbnRlcnByaXNlL2NvbmZpZ3MvYWR2YW5jZWQtcGVybWlzc2lvbi1jb25maWcnO1xuXG4vKipcbiAqIOmWi+eZuueSsOWig+WQkeOBkemrmOW6puaoqemZkOWItuW+oee1seWQiOioreWumlxuICovXG5leHBvcnQgY29uc3QgRGV2ZWxvcG1lbnRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnOiBJbnRlZ3JhdGVkU3RhY2tzQ29uZmlnID0ge1xuICBwcm9qZWN0TmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdkZXYnLFxuICByZWdpb246ICdhcC1ub3J0aGVhc3QtMScsXG4gIFxuICAvLyDmqZ/og73jg5Xjg6njgrDvvIjplovnmbrnkrDlooPjgafjga/kuIDpg6jliLbpmZDjgpLnt6nlkozvvIlcbiAgZW5hYmxlU2VjdXJpdHk6IHRydWUsXG4gIGVuYWJsZU5ldHdvcmtpbmc6IHRydWUsXG4gIGVuYWJsZURhdGE6IHRydWUsXG4gIGVuYWJsZUVtYmVkZGluZzogdHJ1ZSxcbiAgZW5hYmxlV2ViQXBwOiB0cnVlLFxuICBlbmFibGVBZHZhbmNlZFBlcm1pc3Npb25Db250cm9sOiB0cnVlLCAvLyDpq5jluqbmqKnpmZDliLblvqHmnInlirlcbiAgZW5hYmxlT3BlcmF0aW9uczogdHJ1ZSxcbiAgXG4gIC8vIOWQhOOCueOCv+ODg+OCr+WbuuacieOBruioreWumlxuICBzZWN1cml0eUNvbmZpZzoge1xuICAgIGVuYWJsZUttczogdHJ1ZSxcbiAgICBlbmFibGVXYWY6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga9XQUbnhKHlirlcbiAgICBlbmFibGVHdWFyZER1dHk6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga9HdWFyZER1dHnnhKHlirlcbiAgICBlbmFibGVDbG91ZFRyYWlsOiB0cnVlLFxuICAgIGttc0tleVJvdGF0aW9uOiBmYWxzZSAvLyDplovnmbrnkrDlooPjgafjga/oh6rli5Xjg63jg7zjg4bjg7zjgrfjg6fjg7PnhKHlirlcbiAgfSxcbiAgXG4gIG5ldHdvcmtpbmdDb25maWc6IHtcbiAgICB2cGNDaWRyOiAnMTAuMC4wLjAvMTYnLFxuICAgIGVuYWJsZU5hdEdhdGV3YXk6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/jgrPjgrnjg4jliYrmuJtcbiAgICBlbmFibGVWcGNGbG93TG9nczogZmFsc2UsXG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDJcbiAgfSxcbiAgXG4gIHN0b3JhZ2VDb25maWc6IHtcbiAgICBlbmFibGVTM1ZlcnNpb25pbmc6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirlcbiAgICBlbmFibGVTM0VuY3J5cHRpb246IHRydWUsXG4gICAgczNTdG9yYWdlQ2xhc3M6ICdTVEFOREFSRCcsXG4gICAgZW5hYmxlRnN4QmFja3VwOiBmYWxzZSAvLyDplovnmbrnkrDlooPjgafjga/jg5Djg4Pjgq/jgqLjg4Pjg5fnhKHlirlcbiAgfSxcbiAgXG4gIGRhdGFiYXNlQ29uZmlnOiB7XG4gICAgZHluYW1vRGJCaWxsaW5nTW9kZTogJ1BBWV9QRVJfUkVRVUVTVCcsXG4gICAgZW5hYmxlRHluYW1vRGJCYWNrdXA6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/jg5Djg4Pjgq/jgqLjg4Pjg5fnhKHlirlcbiAgICBvcGVuU2VhcmNoSW5zdGFuY2VUeXBlOiAndDMuc21hbGwuc2VhcmNoJyxcbiAgICBvcGVuU2VhcmNoSW5zdGFuY2VDb3VudDogMSxcbiAgICBlbmFibGVPcGVuU2VhcmNoRW5jcnlwdGlvbjogdHJ1ZVxuICB9LFxuICBcbiAgZW1iZWRkaW5nQ29uZmlnOiB7XG4gICAgbGFtYmRhTWVtb3J5U2l6ZTogMTAyNCxcbiAgICBsYW1iZGFUaW1lb3V0OiAzMDAsXG4gICAgZW5hYmxlWFJheVRyYWNpbmc6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirlcbiAgICBiYXRjaENvbXB1dGVFbnZpcm9ubWVudFR5cGU6ICdVTk1BTkFHRUQnXG4gIH0sXG4gIFxuICBhaUNvbmZpZzoge1xuICAgIGJlZHJvY2tSZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIGVuYWJsZUJlZHJvY2tMb2dnaW5nOiBmYWxzZSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv54Sh5Yq5XG4gICAgZW1iZWRkaW5nTW9kZWw6ICdhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MScsXG4gICAgdGV4dE1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJ1xuICB9LFxuICBcbiAgYXBpQ29uZmlnOiB7XG4gICAgZW5hYmxlQXBpR2F0ZXdheUxvZ2dpbmc6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirlcbiAgICBhcGlHYXRld2F5VGhyb3R0bGluZzoge1xuICAgICAgcmF0ZUxpbWl0OiAxMDAwLFxuICAgICAgYnVyc3RMaW1pdDogMjAwMFxuICAgIH0sXG4gICAgZW5hYmxlQ29nbml0bzogdHJ1ZSxcbiAgICBjb2duaXRvUGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IGZhbHNlLFxuICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgIHJlcXVpcmVOdW1iZXJzOiB0cnVlLFxuICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlXG4gICAgfVxuICB9LFxuICBcbiAgbW9uaXRvcmluZ0NvbmZpZzoge1xuICAgIGVuYWJsZURldGFpbGVkTW9uaXRvcmluZzogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+eEoeWKuVxuICAgIGxvZ1JldGVudGlvbkRheXM6IDcsIC8vIOefreacn+S/neaMgVxuICAgIGVuYWJsZUFsYXJtczogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+OCouODqeODvOODoOeEoeWKuVxuICAgIGVuYWJsZURhc2hib2FyZDogdHJ1ZVxuICB9LFxuICBcbiAgZW50ZXJwcmlzZUNvbmZpZzoge1xuICAgIGVuYWJsZUFjY2Vzc0NvbnRyb2w6IHRydWUsXG4gICAgZW5hYmxlQmlBbmFseXRpY3M6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirlcbiAgICBlbmFibGVPcmdhbml6YXRpb25NYW5hZ2VtZW50OiBmYWxzZSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv54Sh5Yq5XG4gICAgZW5hYmxlQ29tcGxpYW5jZVJlcG9ydGluZzogZmFsc2UgLy8g6ZaL55m655Kw5aKD44Gn44Gv54Sh5Yq5XG4gIH1cbn07XG5cbi8qKlxuICog44K544OG44O844K444Oz44Kw55Kw5aKD5ZCR44GR6auY5bqm5qip6ZmQ5Yi25b6h57Wx5ZCI6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBTdGFnaW5nQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZzogSW50ZWdyYXRlZFN0YWNrc0NvbmZpZyA9IHtcbiAgLi4uRGV2ZWxvcG1lbnRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnLFxuICBlbnZpcm9ubWVudDogJ3N0YWdpbmcnLFxuICBcbiAgLy8g44K544OG44O844K444Oz44Kw55Kw5aKD44Gn44Gv5pys55Wq44Gr6L+R44GE6Kit5a6aXG4gIHNlY3VyaXR5Q29uZmlnOiB7XG4gICAgLi4uRGV2ZWxvcG1lbnRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnLnNlY3VyaXR5Q29uZmlnLFxuICAgIGVuYWJsZVdhZjogdHJ1ZSwgLy8gV0FG5pyJ5Yq5XG4gICAgZW5hYmxlR3VhcmREdXR5OiB0cnVlLCAvLyBHdWFyZER1dHnmnInlirlcbiAgICBrbXNLZXlSb3RhdGlvbjogdHJ1ZSAvLyDoh6rli5Xjg63jg7zjg4bjg7zjgrfjg6fjg7PmnInlirlcbiAgfSxcbiAgXG4gIG5ldHdvcmtpbmdDb25maWc6IHtcbiAgICAuLi5EZXZlbG9wbWVudEFkdmFuY2VkUGVybWlzc2lvbkRlcGxveW1lbnRDb25maWcubmV0d29ya2luZ0NvbmZpZyxcbiAgICBlbmFibGVOYXRHYXRld2F5OiB0cnVlLCAvLyBOQVQgR2F0ZXdheeacieWKuVxuICAgIGVuYWJsZVZwY0Zsb3dMb2dzOiB0cnVlLFxuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAzIC8vIDNBWuani+aIkFxuICB9LFxuICBcbiAgc3RvcmFnZUNvbmZpZzoge1xuICAgIC4uLkRldmVsb3BtZW50QWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5zdG9yYWdlQ29uZmlnLFxuICAgIGVuYWJsZVMzVmVyc2lvbmluZzogdHJ1ZSwgLy8g44OQ44O844K444On44OL44Oz44Kw5pyJ5Yq5XG4gICAgZW5hYmxlRnN4QmFja3VwOiB0cnVlIC8vIOODkOODg+OCr+OCouODg+ODl+acieWKuVxuICB9LFxuICBcbiAgZGF0YWJhc2VDb25maWc6IHtcbiAgICAuLi5EZXZlbG9wbWVudEFkdmFuY2VkUGVybWlzc2lvbkRlcGxveW1lbnRDb25maWcuZGF0YWJhc2VDb25maWcsXG4gICAgZW5hYmxlRHluYW1vRGJCYWNrdXA6IHRydWUsIC8vIOODkOODg+OCr+OCouODg+ODl+acieWKuVxuICAgIG9wZW5TZWFyY2hJbnN0YW5jZVR5cGU6ICd0My5tZWRpdW0uc2VhcmNoJyxcbiAgICBvcGVuU2VhcmNoSW5zdGFuY2VDb3VudDogMiAvLyDlhpfplbfljJZcbiAgfSxcbiAgXG4gIGVtYmVkZGluZ0NvbmZpZzoge1xuICAgIC4uLkRldmVsb3BtZW50QWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5lbWJlZGRpbmdDb25maWcsXG4gICAgZW5hYmxlWFJheVRyYWNpbmc6IHRydWUsIC8vIFgtUmF55pyJ5Yq5XG4gICAgYmF0Y2hDb21wdXRlRW52aXJvbm1lbnRUeXBlOiAnTUFOQUdFRCdcbiAgfSxcbiAgXG4gIGFpQ29uZmlnOiB7XG4gICAgLi4uRGV2ZWxvcG1lbnRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnLmFpQ29uZmlnLFxuICAgIGVuYWJsZUJlZHJvY2tMb2dnaW5nOiB0cnVlIC8vIOODreOCsOacieWKuVxuICB9LFxuICBcbiAgYXBpQ29uZmlnOiB7XG4gICAgLi4uRGV2ZWxvcG1lbnRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnLmFwaUNvbmZpZyxcbiAgICBlbmFibGVBcGlHYXRld2F5TG9nZ2luZzogdHJ1ZSwgLy8g44Ot44Kw5pyJ5Yq5XG4gICAgY29nbml0b1Bhc3N3b3JkUG9saWN5OiB7XG4gICAgICBtaW5MZW5ndGg6IDEwLFxuICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICByZXF1aXJlTnVtYmVyczogdHJ1ZSxcbiAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgbW9uaXRvcmluZ0NvbmZpZzoge1xuICAgIC4uLkRldmVsb3BtZW50QWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5tb25pdG9yaW5nQ29uZmlnLFxuICAgIGVuYWJsZURldGFpbGVkTW9uaXRvcmluZzogdHJ1ZSwgLy8g6Kmz57Sw55uj6KaW5pyJ5Yq5XG4gICAgbG9nUmV0ZW50aW9uRGF5czogMzAsIC8vIDMw5pel5L+d5oyBXG4gICAgZW5hYmxlQWxhcm1zOiB0cnVlLCAvLyDjgqLjg6njg7zjg6DmnInlirlcbiAgICBlbmFibGVEYXNoYm9hcmQ6IHRydWVcbiAgfSxcbiAgXG4gIGVudGVycHJpc2VDb25maWc6IHtcbiAgICAuLi5EZXZlbG9wbWVudEFkdmFuY2VkUGVybWlzc2lvbkRlcGxveW1lbnRDb25maWcuZW50ZXJwcmlzZUNvbmZpZyxcbiAgICBlbmFibGVCaUFuYWx5dGljczogdHJ1ZSwgLy8gQknliIbmnpDmnInlirlcbiAgICBlbmFibGVPcmdhbml6YXRpb25NYW5hZ2VtZW50OiB0cnVlLCAvLyDntYTnuZTnrqHnkIbmnInlirlcbiAgICBlbmFibGVDb21wbGlhbmNlUmVwb3J0aW5nOiB0cnVlIC8vIOOCs+ODs+ODl+ODqeOCpOOCouODs+OCueWgseWRiuacieWKuVxuICB9XG59O1xuXG4vKipcbiAqIOacrOeVqueSsOWig+WQkeOBkemrmOW6puaoqemZkOWItuW+oee1seWQiOioreWumlxuICovXG5leHBvcnQgY29uc3QgUHJvZHVjdGlvbkFkdmFuY2VkUGVybWlzc2lvbkRlcGxveW1lbnRDb25maWc6IEludGVncmF0ZWRTdGFja3NDb25maWcgPSB7XG4gIC4uLlN0YWdpbmdBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnLFxuICBlbnZpcm9ubWVudDogJ3Byb2QnLFxuICBcbiAgLy8g5pys55Wq55Kw5aKD44Gn44Gv5pyA6auY44Os44OZ44Or44Gu44K744Kt44Ol44Oq44OG44Kj44Go5Y+v55So5oCnXG4gIG5ldHdvcmtpbmdDb25maWc6IHtcbiAgICAuLi5TdGFnaW5nQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5uZXR3b3JraW5nQ29uZmlnLFxuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAzLCAvLyAzQVrlv4XpoIhcbiAgICBlbmFibGVWcGNGbG93TG9nczogdHJ1ZSxcbiAgICBlbmFibGVOYXRHYXRld2F5OiB0cnVlXG4gIH0sXG4gIFxuICBzdG9yYWdlQ29uZmlnOiB7XG4gICAgLi4uU3RhZ2luZ0FkdmFuY2VkUGVybWlzc2lvbkRlcGxveW1lbnRDb25maWcuc3RvcmFnZUNvbmZpZyxcbiAgICBzM1N0b3JhZ2VDbGFzczogJ1NUQU5EQVJEX0lBJywgLy8g44Kz44K544OI5pyA6YGp5YyWXG4gICAgZW5hYmxlUzNWZXJzaW9uaW5nOiB0cnVlLFxuICAgIGVuYWJsZUZzeEJhY2t1cDogdHJ1ZVxuICB9LFxuICBcbiAgZGF0YWJhc2VDb25maWc6IHtcbiAgICAuLi5TdGFnaW5nQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5kYXRhYmFzZUNvbmZpZyxcbiAgICBvcGVuU2VhcmNoSW5zdGFuY2VUeXBlOiAnbTZnLmxhcmdlLnNlYXJjaCcsIC8vIOacrOeVqueUqOOCpOODs+OCueOCv+ODs+OCuVxuICAgIG9wZW5TZWFyY2hJbnN0YW5jZUNvdW50OiAzLCAvLyAz44OO44O844OJ5qeL5oiQXG4gICAgZW5hYmxlRHluYW1vRGJCYWNrdXA6IHRydWUsXG4gICAgZW5hYmxlT3BlblNlYXJjaEVuY3J5cHRpb246IHRydWVcbiAgfSxcbiAgXG4gIGVtYmVkZGluZ0NvbmZpZzoge1xuICAgIC4uLlN0YWdpbmdBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnLmVtYmVkZGluZ0NvbmZpZyxcbiAgICBsYW1iZGFNZW1vcnlTaXplOiAyMDQ4LCAvLyDmnKznlarnlKjjg6Hjg6Ljg6pcbiAgICBsYW1iZGFUaW1lb3V0OiA2MDAsIC8vIOacrOeVqueUqOOCv+OCpOODoOOCouOCpuODiFxuICAgIGVuYWJsZVhSYXlUcmFjaW5nOiB0cnVlXG4gIH0sXG4gIFxuICBhcGlDb25maWc6IHtcbiAgICAuLi5TdGFnaW5nQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5hcGlDb25maWcsXG4gICAgYXBpR2F0ZXdheVRocm90dGxpbmc6IHtcbiAgICAgIHJhdGVMaW1pdDogNTAwMCwgLy8g5pys55Wq55So44Os44O844OI5Yi26ZmQXG4gICAgICBidXJzdExpbWl0OiAxMDAwMFxuICAgIH0sXG4gICAgY29nbml0b1Bhc3N3b3JkUG9saWN5OiB7XG4gICAgICBtaW5MZW5ndGg6IDEyLCAvLyDmnKznlarnlKjjg5Hjgrnjg6/jg7zjg4njg53jg6rjgrfjg7xcbiAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgcmVxdWlyZU51bWJlcnM6IHRydWUsXG4gICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIG1vbml0b3JpbmdDb25maWc6IHtcbiAgICAuLi5TdGFnaW5nQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZy5tb25pdG9yaW5nQ29uZmlnLFxuICAgIGxvZ1JldGVudGlvbkRheXM6IDkwLCAvLyA5MOaXpeS/neaMgVxuICAgIGVuYWJsZURldGFpbGVkTW9uaXRvcmluZzogdHJ1ZSxcbiAgICBlbmFibGVBbGFybXM6IHRydWUsXG4gICAgZW5hYmxlRGFzaGJvYXJkOiB0cnVlXG4gIH1cbn07XG5cbi8qKlxuICog55Kw5aKD5Yil6Kit5a6a5Y+W5b6X6Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnKGVudmlyb25tZW50OiBzdHJpbmcpOiBJbnRlZ3JhdGVkU3RhY2tzQ29uZmlnIHtcbiAgc3dpdGNoIChlbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnZGV2ZWxvcG1lbnQnOlxuICAgIGNhc2UgJ2Rldic6XG4gICAgICByZXR1cm4gRGV2ZWxvcG1lbnRBZHZhbmNlZFBlcm1pc3Npb25EZXBsb3ltZW50Q29uZmlnO1xuICAgIFxuICAgIGNhc2UgJ3N0YWdpbmcnOlxuICAgIGNhc2UgJ3N0YWdlJzpcbiAgICAgIHJldHVybiBTdGFnaW5nQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZztcbiAgICBcbiAgICBjYXNlICdwcm9kdWN0aW9uJzpcbiAgICBjYXNlICdwcm9kJzpcbiAgICAgIHJldHVybiBQcm9kdWN0aW9uQWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZztcbiAgICBcbiAgICBkZWZhdWx0OlxuICAgICAgY29uc29sZS53YXJuKGBVbmtub3duIGVudmlyb25tZW50OiAke2Vudmlyb25tZW50fS4gVXNpbmcgZGV2ZWxvcG1lbnQgY29uZmlnLmApO1xuICAgICAgcmV0dXJuIERldmVsb3BtZW50QWR2YW5jZWRQZXJtaXNzaW9uRGVwbG95bWVudENvbmZpZztcbiAgfVxufVxuXG4vKipcbiAqIOmrmOW6puaoqemZkOWItuW+oeOCt+OCueODhuODoOe1seWQiOODh+ODl+ODreOCpOODoeODs+ODiOaDheWgsVxuICovXG5leHBvcnQgY29uc3QgQURWQU5DRURfUEVSTUlTU0lPTl9ERVBMT1lNRU5UX0lORk8gPSB7XG4gIHN1cHBvcnRlZEVudmlyb25tZW50czogWydkZXZlbG9wbWVudCcsICdzdGFnaW5nJywgJ3Byb2R1Y3Rpb24nXSxcbiAgcmVxdWlyZWRTZXJ2aWNlczogW1xuICAgICdBV1MgTGFtYmRhJyxcbiAgICAnQW1hem9uIER5bmFtb0RCJywgXG4gICAgJ0FtYXpvbiBPcGVuU2VhcmNoIFNlcnZlcmxlc3MnLFxuICAgICdBV1MgS01TJyxcbiAgICAnQW1hem9uIENsb3VkV2F0Y2gnLFxuICAgICdBbWF6b24gU05TJyxcbiAgICAnQVdTIElBTSdcbiAgXSxcbiAgZXN0aW1hdGVkRGVwbG95bWVudFRpbWU6IHtcbiAgICBkZXZlbG9wbWVudDogJzUtOCBtaW51dGVzJyxcbiAgICBzdGFnaW5nOiAnNi0xMCBtaW51dGVzJyxcbiAgICBwcm9kdWN0aW9uOiAnOC0xMiBtaW51dGVzJ1xuICB9LFxuICBlc3RpbWF0ZWRNb250aGx5Q29zdDoge1xuICAgIGRldmVsb3BtZW50OiAnJDI1LTUwIFVTRCcsXG4gICAgc3RhZ2luZzogJyQ1MC0xMDAgVVNEJyxcbiAgICBwcm9kdWN0aW9uOiAnJDc1LTE1MCBVU0QnXG4gIH0sXG4gIHNlY3VyaXR5RmVhdHVyZXM6IFtcbiAgICAn5pmC6ZaT44OZ44O844K55Yi26ZmQ77yI5Za25qWt5pmC6ZaT44O757eK5oCl44Ki44Kv44K744K577yJJyxcbiAgICAn5Zyw55CG55qE5Yi26ZmQ77yI5Zu95a6244O7SVDjg7tWUE7liLblvqHvvIknLFxuICAgICfli5XnmoTmqKnpmZDvvIjjg5fjg63jgrjjgqfjgq/jg4jlj4LliqDjg7vkuIDmmYLnmoTjgqLjgq/jgrvjgrnvvIknLFxuICAgICfjg6rjgqLjg6vjgr/jgqTjg6Dnm6Pmn7vjg63jgrAnLFxuICAgICfjg6rjgrnjgq/jg5njg7zjgrnoqo3oqLwnLFxuICAgICflpJrlsaTpmLLlvqHjgqLjg7zjgq3jg4bjgq/jg4Hjg6MnXG4gIF0sXG4gIGNvbXBsaWFuY2VTdGFuZGFyZHM6IFtcbiAgICAnSVNPIDI3MDAxJyxcbiAgICAnU09DIDIgVHlwZSBJSScsXG4gICAgJ+WAi+S6uuaDheWgseS/neitt+azlScsXG4gICAgJ0dEUFLmupbmi6DvvIjlsIbmnaXlr77lv5zvvIknXG4gIF1cbn0gYXMgY29uc3Q7XG5cbi8qKlxuICog44OH44OX44Ot44Kk44Oh44Oz44OI5YmN44OB44Kn44OD44Kv44Oq44K544OIXG4gKi9cbmV4cG9ydCBjb25zdCBERVBMT1lNRU5UX0NIRUNLTElTVCA9IHtcbiAgcHJlcmVxdWlzaXRlczogW1xuICAgICdBV1MgQ0xJ6Kit5a6a5riI44G/JyxcbiAgICAnQ0RLIENMSSDjgqTjg7Pjgrnjg4jjg7zjg6vmuIjjgb8nLFxuICAgICdOb2RlLmpzIDIwKyDjgqTjg7Pjgrnjg4jjg7zjg6vmuIjjgb8nLFxuICAgICdUeXBlU2NyaXB0IDUuMysg44Kk44Oz44K544OI44O844Or5riI44G/JyxcbiAgICAn6YGp5YiH44GqQVdT5qip6ZmQ6Kit5a6a5riI44G/J1xuICBdLFxuICBlbnZpcm9ubWVudFZhcmlhYmxlczogW1xuICAgICdBV1NfUkVHSU9OJyxcbiAgICAnQ0RLX0RFRkFVTFRfQUNDT1VOVCcsXG4gICAgJ09QRU5TRUFSQ0hfRU5EUE9JTlQnLFxuICAgICdHRU9fTE9DQVRJT05fQVBJX0tFWSAo44Kq44OX44K344On44OzKScsXG4gICAgJ1BST0pFQ1RfTUFOQUdFTUVOVF9BUElfS0VZICjjgqrjg5fjgrfjg6fjg7MpJyxcbiAgICAnU0VDVVJJVFlfQUxFUlRfRU1BSUwgKOOCquODl+OCt+ODp+ODsyknXG4gIF0sXG4gIHBvc3REZXBsb3ltZW50VGFza3M6IFtcbiAgICAnQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieeiuuiqjScsXG4gICAgJ0xhbWJkYemWouaVsOWLleS9nOODhuOCueODiCcsXG4gICAgJ0R5bmFtb0RC44OG44O844OW44Or5L2c5oiQ56K66KqNJyxcbiAgICAnU05T44OI44OU44OD44Kv6YCa55+l44OG44K544OIJyxcbiAgICAn5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw5qmf6IO944OG44K544OIJyxcbiAgICAn44K744Kt44Ol44Oq44OG44Kj55uj5p+744Ot44Kw56K66KqNJ1xuICBdXG59IGFzIGNvbnN0OyJdfQ==