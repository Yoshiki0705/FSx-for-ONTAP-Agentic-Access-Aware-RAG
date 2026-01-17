"use strict";
/**
 * アカウント非依存設定
 * どのAWSアカウントでも再現可能な設定を提供
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureOptions = exports.EnvironmentTemplates = exports.BaseAccountAgnosticConfig = void 0;
exports.validateAccountAgnosticConfig = validateAccountAgnosticConfig;
exports.mergeConfigurations = mergeConfigurations;
exports.createEnvironmentConfig = createEnvironmentConfig;
const fsx_ontap_config_1 = require("../interfaces/fsx-ontap-config");
const serverless_config_1 = require("../interfaces/serverless-config");
/**
 * 基本設定テンプレート
 * アカウントIDやリージョンに依存しない設定
 */
exports.BaseAccountAgnosticConfig = {
    project: {
        name: 'permission-aware-rag',
        version: '2.0.0',
        description: 'Permission-aware RAG System with FSx for ONTAP Integration'
    },
    networking: {
        vpcCidr: '10.0.0.0/16',
        availabilityZones: 2,
        natGateways: {
            enabled: true,
            count: 1 // コスト最適化のため1つに設定
        },
        enableVpcFlowLogs: true,
        enableDnsHostnames: true,
        enableDnsSupport: true
    },
    security: {
        enableWaf: true,
        enableGuardDuty: true,
        enableConfig: true,
        enableCloudTrail: true,
        kmsKeyRotation: true,
        encryptionAtRest: true,
        encryptionInTransit: true
    },
    storage: {
        s3: {
            enableVersioning: true,
            enableLifecyclePolicy: true,
            transitionToIADays: 30,
            transitionToGlacierDays: 90,
            expirationDays: 2555, // 7年
            documents: {
                enabled: true,
                encryption: true,
                versioning: true
            },
            backup: {
                enabled: true,
                encryption: true,
                versioning: true
            },
            embeddings: {
                enabled: true,
                encryption: true,
                versioning: false
            }
        },
        fsxOntap: {
            enabled: false,
            storageCapacity: 1024,
            throughputCapacity: 128,
            deploymentType: 'SINGLE_AZ_1',
            automaticBackupRetentionDays: 7
        }
    },
    database: {
        dynamodb: {
            billingMode: 'PAY_PER_REQUEST',
            pointInTimeRecovery: true,
            enableStreams: true,
            streamViewType: 'NEW_AND_OLD_IMAGES'
        },
        opensearch: {
            instanceType: 't3.small.search',
            instanceCount: 1,
            dedicatedMasterEnabled: false,
            masterInstanceCount: 0,
            ebsEnabled: true,
            volumeType: 'gp3',
            volumeSize: 20,
            encryptionAtRest: true
        }
    },
    embedding: {
        lambda: {
            runtime: 'python3.11',
            timeout: 300,
            memorySize: 1024,
            enableXRayTracing: true,
            enableDeadLetterQueue: true
        },
        batch: {
            enabled: false, // デフォルトは無効
            computeEnvironmentType: 'MANAGED',
            instanceTypes: ['m5.large'],
            minvCpus: 0,
            maxvCpus: 10,
            desiredvCpus: 0
        },
        ecs: {
            enabled: false, // デフォルトは無効
            instanceType: 'm5.large',
            minCapacity: 0,
            maxCapacity: 5,
            desiredCapacity: 0,
            enableManagedInstance: true
        }
    },
    api: {
        throttling: {
            rateLimit: 1000,
            burstLimit: 2000
        },
        cors: {
            enabled: true,
            allowOrigins: ['*'], // 本番環境では制限する
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token']
        },
        authentication: {
            cognitoEnabled: false, // 独自認証を使用
            apiKeyRequired: false
        }
    },
    ai: {
        bedrock: {
            enabled: true,
            models: [
                'anthropic.claude-3-sonnet-20240229-v1:0',
                'anthropic.claude-3-haiku-20240307-v1:0',
                'amazon.titan-embed-text-v1'
            ],
            maxTokens: 4096,
            temperature: 0.7
        },
        embedding: {
            model: 'amazon.titan-embed-text-v1',
            dimensions: 1536,
            batchSize: 100
        }
    },
    monitoring: {
        enableDetailedMonitoring: true,
        logRetentionDays: 30,
        enableAlarms: true,
        alarmNotificationEmail: '', // デプロイ時に設定
        enableDashboard: true,
        enableXRayTracing: true
    },
    enterprise: {
        enableAccessControl: true,
        enableAuditLogging: true,
        enableBIAnalytics: false, // デフォルトは無効
        enableMultiTenant: false, // デフォルトは無効
        dataRetentionDays: 2555 // 7年
    },
    tags: {
        Environment: '', // 環境別に設定
        Project: 'permission-aware-rag',
        Owner: '', // デプロイ時に設定
        CostCenter: '', // デプロイ時に設定
        Backup: 'Required',
        Monitoring: 'Enabled',
        Compliance: 'Required',
        DataClassification: 'Internal',
        Region: '', // リージョン別に設定
        Timezone: 'Asia/Tokyo',
        ComplianceFramework: 'SOC2-GDPR'
    }
};
/**
 * 環境別設定テンプレート
 */
exports.EnvironmentTemplates = {
    development: {
        ...exports.BaseAccountAgnosticConfig,
        environment: 'development',
        // 開発環境用の機能フラグ
        features: {
            enableNetworking: true,
            enableSecurity: true,
            enableStorage: true,
            enableDatabase: true,
            enableEmbedding: true,
            enableAPI: true,
            enableAI: true,
            enableMonitoring: true,
            enableEnterprise: false, // 開発環境では無効
            // FSx統合機能フラグ（新規追加）
            enableFsxIntegration: false,
            enableFsxServerlessWorkflows: false,
            enableFsxEventDriven: false,
            enableFsxBatchProcessing: false,
            // AgentCore統合機能フラグ（Task 3.2追加）
            enableAgentCoreIntegration: true,
            enableHybridArchitecture: true,
            enableUserPreferences: true
        },
        // FSx for ONTAP設定（開発環境用）
        fsxOntapIntegration: {
            ...fsx_ontap_config_1.FSxONTAPPresets.development,
            enabled: false // デフォルトは無効、必要に応じて有効化
        },
        // サーバレス設定（開発環境用）
        serverlessIntegration: {
            ...serverless_config_1.ServerlessPresets.development,
            enabled: true
        },
        tags: {
            ...exports.BaseAccountAgnosticConfig.tags,
            Environment: 'development',
            BusinessCriticality: 'Low',
            DisasterRecovery: 'NotRequired',
            SecurityLevel: 'Standard',
            EncryptionRequired: 'Yes',
            AuditRequired: 'No',
            PerformanceLevel: 'Standard',
            AvailabilityTarget: '99.0%',
            RPO: '24h',
            RTO: '4h'
        }
    },
    staging: {
        ...exports.BaseAccountAgnosticConfig,
        environment: 'staging',
        // ステージング環境用の機能フラグ
        features: {
            enableNetworking: true,
            enableSecurity: true,
            enableStorage: true,
            enableDatabase: true,
            enableEmbedding: true,
            enableAPI: true,
            enableAI: true,
            enableMonitoring: true,
            enableEnterprise: true, // ステージングでは有効
            // FSx統合機能フラグ（新規追加）
            enableFsxIntegration: false,
            enableFsxServerlessWorkflows: false,
            enableFsxEventDriven: false,
            enableFsxBatchProcessing: false,
            // AgentCore統合機能フラグ（Task 3.2追加）
            enableAgentCoreIntegration: true,
            enableHybridArchitecture: true,
            enableUserPreferences: true
        },
        // FSx for ONTAP設定（ステージング環境用）
        fsxOntapIntegration: {
            ...fsx_ontap_config_1.FSxONTAPPresets.development, // 開発設定をベースにするがサイズを調整
            enabled: true,
            fileSystem: {
                ...fsx_ontap_config_1.FSxONTAPPresets.development.fileSystem,
                storageCapacity: 2048, // 開発より大きく
                throughputCapacity: 256
            }
        },
        // サーバレス設定（ステージング環境用）
        serverlessIntegration: {
            ...serverless_config_1.ServerlessPresets.development,
            enabled: true,
            lambda: {
                ...serverless_config_1.ServerlessPresets.development.lambda,
                common: {
                    ...serverless_config_1.ServerlessPresets.development.lambda.common,
                    memorySize: 512, // 開発より大きく
                    timeout: 60
                }
            }
        },
        tags: {
            ...exports.BaseAccountAgnosticConfig.tags,
            Environment: 'staging',
            BusinessCriticality: 'Medium',
            DisasterRecovery: 'Required',
            SecurityLevel: 'High',
            EncryptionRequired: 'Yes',
            AuditRequired: 'Yes',
            PerformanceLevel: 'High',
            AvailabilityTarget: '99.5%',
            RPO: '4h',
            RTO: '2h'
        }
    },
    production: {
        ...exports.BaseAccountAgnosticConfig,
        environment: 'production',
        // 本番環境用の機能フラグ
        features: {
            enableNetworking: true,
            enableSecurity: true,
            enableStorage: true,
            enableDatabase: true,
            enableEmbedding: true,
            enableAPI: true,
            enableAI: true,
            enableMonitoring: true,
            enableEnterprise: true,
            // FSx統合機能フラグ（新規追加）
            enableFsxIntegration: false,
            enableFsxServerlessWorkflows: false,
            enableFsxEventDriven: false,
            enableFsxBatchProcessing: false,
            // AgentCore統合機能フラグ（Task 3.2追加）
            enableAgentCoreIntegration: true,
            enableHybridArchitecture: true,
            enableUserPreferences: true
        },
        // FSx for ONTAP設定（本番環境用）
        fsxOntapIntegration: {
            ...fsx_ontap_config_1.FSxONTAPPresets.production,
            enabled: true
        },
        // サーバレス設定（本番環境用）
        serverlessIntegration: {
            ...serverless_config_1.ServerlessPresets.production,
            enabled: true
        },
        // 本番環境用のネットワーク設定
        networking: {
            ...exports.BaseAccountAgnosticConfig.networking,
            availabilityZones: 3, // 本番では3AZ
            natGateways: {
                enabled: true,
                count: 2 // 本番では冗長化
            }
        },
        // 本番環境用のデータベース設定
        database: {
            ...exports.BaseAccountAgnosticConfig.database,
            opensearch: {
                ...exports.BaseAccountAgnosticConfig.database.opensearch,
                instanceType: 'm6g.large.search',
                instanceCount: 3, // 本番では3ノード
                dedicatedMasterEnabled: true,
                masterInstanceCount: 3,
                volumeSize: 100 // 本番では大容量
            }
        },
        tags: {
            ...exports.BaseAccountAgnosticConfig.tags,
            Environment: 'production',
            BusinessCriticality: 'High',
            DisasterRecovery: 'Required',
            SecurityLevel: 'Critical',
            EncryptionRequired: 'Yes',
            AuditRequired: 'Yes',
            PerformanceLevel: 'Critical',
            AvailabilityTarget: '99.9%',
            RPO: '1h',
            RTO: '30m'
        }
    }
};
/**
 * 機能別オプション設定
 * ユーザーが個別に有効化/無効化できる機能の設定
 */
exports.FeatureOptions = {
    // FSx for ONTAP統合オプション
    fsxOntapIntegration: {
        minimal: {
            enabled: true,
            fileSystem: {
                storageCapacity: 1024,
                throughputCapacity: 128,
                deploymentType: 'SINGLE_AZ_1',
                autoDetectNetworking: true,
                autoConfigureRouting: true,
                autoScaling: { enabled: false, minCapacity: 1024, maxCapacity: 2048, targetUtilization: 80 }
            },
            s3AccessPoints: {
                enabled: true,
                autoCreateAccessPoints: true,
                accessPointNamingPattern: "${projectName}-${environment}-${purpose}",
                accessPoints: [
                    { name: 'chat-history', purpose: 'chat-history' }
                ]
            },
            tiering: { enabled: false },
            performance: {
                monitoring: { enabled: true, metricsCollection: true, detailedMonitoring: false },
                autoOptimization: { enabled: false, throughputOptimization: false, storageOptimization: false, performanceMode: 'COST_OPTIMIZED' },
                cache: { enabled: false, size: 0, type: 'READ' }
            }
        },
        standard: {
            ...fsx_ontap_config_1.FSxONTAPPresets.development,
            enabled: true
        },
        advanced: {
            ...fsx_ontap_config_1.FSxONTAPPresets.production,
            enabled: true
        }
    },
    // サーバレス統合オプション
    serverlessIntegration: {
        minimal: {
            enabled: true,
            stepFunctions: {
                enabled: false // 最小構成では無効
            },
            eventBridge: {
                enabled: true,
                customEventBus: { enabled: false },
                rules: [],
                schedules: []
            },
            sqs: {
                enabled: true,
                queues: [
                    {
                        name: 'chat-processing',
                        purpose: 'chat-processing',
                        enabled: true,
                        configuration: {
                            visibilityTimeoutSeconds: 30,
                            messageRetentionPeriod: 1209600, // 14日
                            maxReceiveCount: 3
                        },
                        encryption: { enabled: true }
                    }
                ]
            },
            sns: {
                enabled: false // 最小構成では無効
            },
            lambda: {
                common: {
                    runtime: 'nodejs18.x',
                    timeout: 30,
                    memorySize: 256,
                    enableXRayTracing: false,
                    enableDeadLetterQueue: true
                },
                functions: [],
                layers: [],
                environment: { autoInject: true, variables: {} }
            }
        },
        standard: {
            ...serverless_config_1.ServerlessPresets.development,
            enabled: true
        },
        advanced: {
            ...serverless_config_1.ServerlessPresets.production,
            enabled: true
        }
    },
    // パフォーマンス最適化オプション
    performanceOptimization: {
        disabled: {
            enabled: false
        },
        basic: {
            enabled: true,
            monitoring: true,
            autoOptimization: false,
            caching: false
        },
        advanced: {
            enabled: true,
            monitoring: true,
            autoOptimization: true,
            caching: true,
            predictiveScaling: true
        }
    },
    // コスト最適化オプション
    costOptimization: {
        disabled: {
            enabled: false
        },
        basic: {
            enabled: true,
            monitoring: true,
            budgetAlerts: true,
            lifecyclePolicies: true,
            rightSizing: false
        },
        advanced: {
            enabled: true,
            monitoring: true,
            budgetAlerts: true,
            lifecyclePolicies: true,
            rightSizing: true,
            predictiveOptimization: true,
            automatedOptimization: true
        }
    }
};
/**
 * 設定バリデーション関数
 */
function validateAccountAgnosticConfig(config) {
    const errors = [];
    const warnings = [];
    // 必須フィールドの検証
    if (!config.environment) {
        errors.push('Environment is required');
    }
    if (!config.region) {
        errors.push('Region is required');
    }
    if (!config.project?.name) {
        errors.push('Project name is required');
    }
    // FSx for ONTAP設定の検証
    if (config.features?.enableFsxIntegration && config.storage?.fsxOntap?.enabled) {
        if (!config.storage.fsxOntap) {
            errors.push('FSx for ONTAP file system configuration is required when integration is enabled');
        }
        if (config.storage.fsxOntap.storageCapacity < 1024) {
            warnings.push('FSx for ONTAP storage capacity should be at least 1024 GB for optimal performance');
        }
    }
    // サーバレス設定の検証（一時的にコメントアウト）
    /*
    if (config.features?.enableServerlessIntegration && config.serverlessIntegration?.enabled) {
      if (config.serverlessIntegration.lambda?.common?.timeout > 900) {
        warnings.push('Lambda timeout should not exceed 15 minutes (900 seconds)');
      }
  
      if (config.serverlessIntegration.lambda?.common?.memorySize > 10240) {
        warnings.push('Lambda memory size should not exceed 10,240 MB unless specifically required');
      }
    }
    */
    // 環境別の検証
    if (config.environment === 'production') {
        if (config.networking?.availabilityZones < 2) {
            errors.push('Production environment should use at least 2 availability zones');
        }
        if (!config.security?.enableCloudTrail) {
            errors.push('CloudTrail should be enabled in production environment');
        }
        if (!config.monitoring?.enableDetailedMonitoring) {
            warnings.push('Detailed monitoring is recommended for production environment');
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
/**
 * 設定マージ関数
 * ベース設定にカスタム設定をマージする
 */
function mergeConfigurations(baseConfig, customConfig) {
    // Deep merge implementation
    const merged = JSON.parse(JSON.stringify(baseConfig));
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key])
                    target[key] = {};
                deepMerge(target[key], source[key]);
            }
            else {
                target[key] = source[key];
            }
        }
        return target;
    }
    return deepMerge(merged, customConfig);
}
/**
 * 環境設定ファクトリー関数
 */
function createEnvironmentConfig(environment, region, customOptions) {
    // ベース設定を取得
    let baseConfig = exports.EnvironmentTemplates[environment];
    // リージョンを設定
    baseConfig = {
        ...baseConfig,
        region,
        tags: {
            ...baseConfig.tags,
            Region: region
        }
    };
    // カスタムオプションを適用
    if (customOptions) {
        // FSx for ONTAP設定（一時的にコメントアウト）
        /*
        if (customOptions.fsxOntapLevel && customOptions.fsxOntapLevel !== 'disabled') {
          baseConfig.features.enableFsxIntegration = true;
          // baseConfig.fsxOntapIntegration = {
          //   ...FeatureOptions.fsxOntapIntegration[customOptions.fsxOntapLevel],
          //   enabled: true
          // };
        } else if (customOptions.fsxOntapLevel === 'disabled') {
          baseConfig.features.enableFsxIntegration = false;
          // if (baseConfig.fsxOntapIntegration) {
          //   baseConfig.fsxOntapIntegration.enabled = false;
          // }
        }
        */
        // サーバレス設定（一時的にコメントアウト）
        /*
        if (customOptions.serverlessLevel && customOptions.serverlessLevel !== 'disabled') {
          baseConfig.features.enableServerlessIntegration = true;
          baseConfig.serverlessIntegration = {
            ...FeatureOptions.serverlessIntegration[customOptions.serverlessLevel],
            enabled: true
          };
        } else if (customOptions.serverlessLevel === 'disabled') {
          baseConfig.features.enableServerlessIntegration = false;
          if (baseConfig.serverlessIntegration) {
            baseConfig.serverlessIntegration.enabled = false;
          }
        }
        */
        // パフォーマンス最適化設定（一時的にコメントアウト）
        /*
        if (customOptions.performanceLevel) {
          baseConfig.features.enablePerformanceOptimization = customOptions.performanceLevel !== 'disabled';
        }
        */
        // コスト最適化設定（一時的にコメントアウト）
        /*
        if (customOptions.costOptimizationLevel) {
          baseConfig.features.enableCostOptimization = customOptions.costOptimizationLevel !== 'disabled';
        }
        */
        // カスタム設定をマージ
        if (customOptions.customConfig) {
            baseConfig = mergeConfigurations(baseConfig, customOptions.customConfig);
        }
    }
    return baseConfig;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjb3VudC1hZ25vc3RpYy1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhY2NvdW50LWFnbm9zdGljLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUF1aEJILHNFQWlFQztBQU1ELGtEQW9CQztBQUtELDBEQStFQztBQW5zQkQscUVBQWlFO0FBQ2pFLHVFQUFvRTtBQUVwRTs7O0dBR0c7QUFDVSxRQUFBLHlCQUF5QixHQUErQjtJQUNuRSxPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFdBQVcsRUFBRSw0REFBNEQ7S0FDMUU7SUFFRCxVQUFVLEVBQUU7UUFDVixPQUFPLEVBQUUsYUFBYTtRQUN0QixpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLFdBQVcsRUFBRTtZQUNYLE9BQU8sRUFBRSxJQUFJO1lBQ2IsS0FBSyxFQUFFLENBQUMsQ0FBQyxpQkFBaUI7U0FDM0I7UUFDRCxpQkFBaUIsRUFBRSxJQUFJO1FBQ3ZCLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtLQUN2QjtJQUVELFFBQVEsRUFBRTtRQUNSLFNBQVMsRUFBRSxJQUFJO1FBQ2YsZUFBZSxFQUFFLElBQUk7UUFDckIsWUFBWSxFQUFFLElBQUk7UUFDbEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixjQUFjLEVBQUUsSUFBSTtRQUNwQixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLG1CQUFtQixFQUFFLElBQUk7S0FDMUI7SUFFRCxPQUFPLEVBQUU7UUFDUCxFQUFFLEVBQUU7WUFDRixnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLHFCQUFxQixFQUFFLElBQUk7WUFDM0Isa0JBQWtCLEVBQUUsRUFBRTtZQUN0Qix1QkFBdUIsRUFBRSxFQUFFO1lBQzNCLGNBQWMsRUFBRSxJQUFJLEVBQUUsS0FBSztZQUMzQixTQUFTLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLElBQUk7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QWU7SUFDZixJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQ2xCLCtCQUErQjtRQUMvQjs7Ozs7Ozs7Ozs7OztVQWFFO1FBRUYsdUJBQXVCO1FBQ3ZCOzs7Ozs7Ozs7Ozs7O1VBYUU7UUFFRiw0QkFBNEI7UUFDNUI7Ozs7VUFJRTtRQUVGLHdCQUF3QjtRQUN4Qjs7OztVQUlFO1FBRUYsYUFBYTtRQUNiLElBQUksYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQy9CLFVBQVUsR0FBRyxtQkFBbUIsQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzNFLENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog44Ki44Kr44Km44Oz44OI6Z2e5L6d5a2Y6Kit5a6aXG4gKiDjganjga5BV1PjgqLjgqvjgqbjg7Pjg4jjgafjgoLlho3nj77lj6/og73jgaroqK3lrprjgpLmj5DkvptcbiAqL1xuXG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uL2ludGVyZmFjZXMvZW52aXJvbm1lbnQtY29uZmlnJztcbmltcG9ydCB7IEZTeE9OVEFQUHJlc2V0cyB9IGZyb20gJy4uL2ludGVyZmFjZXMvZnN4LW9udGFwLWNvbmZpZyc7XG5pbXBvcnQgeyBTZXJ2ZXJsZXNzUHJlc2V0cyB9IGZyb20gJy4uL2ludGVyZmFjZXMvc2VydmVybGVzcy1jb25maWcnO1xuXG4vKipcbiAqIOWfuuacrOioreWumuODhuODs+ODl+ODrOODvOODiFxuICog44Ki44Kr44Km44Oz44OISUTjgoTjg6rjg7zjgrjjg6fjg7Pjgavkvp3lrZjjgZfjgarjgYToqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IEJhc2VBY2NvdW50QWdub3N0aWNDb25maWc6IFBhcnRpYWw8RW52aXJvbm1lbnRDb25maWc+ID0ge1xuICBwcm9qZWN0OiB7XG4gICAgbmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgICB2ZXJzaW9uOiAnMi4wLjAnLFxuICAgIGRlc2NyaXB0aW9uOiAnUGVybWlzc2lvbi1hd2FyZSBSQUcgU3lzdGVtIHdpdGggRlN4IGZvciBPTlRBUCBJbnRlZ3JhdGlvbidcbiAgfSxcbiAgXG4gIG5ldHdvcmtpbmc6IHtcbiAgICB2cGNDaWRyOiAnMTAuMC4wLjAvMTYnLFxuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAyLFxuICAgIG5hdEdhdGV3YXlzOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgY291bnQ6IDEgLy8g44Kz44K544OI5pyA6YGp5YyW44Gu44Gf44KBMeOBpOOBq+ioreWumlxuICAgIH0sXG4gICAgZW5hYmxlVnBjRmxvd0xvZ3M6IHRydWUsXG4gICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWVcbiAgfSxcbiAgXG4gIHNlY3VyaXR5OiB7XG4gICAgZW5hYmxlV2FmOiB0cnVlLFxuICAgIGVuYWJsZUd1YXJkRHV0eTogdHJ1ZSxcbiAgICBlbmFibGVDb25maWc6IHRydWUsXG4gICAgZW5hYmxlQ2xvdWRUcmFpbDogdHJ1ZSxcbiAgICBrbXNLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlLFxuICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IHRydWVcbiAgfSxcbiAgXG4gIHN0b3JhZ2U6IHtcbiAgICBzMzoge1xuICAgICAgZW5hYmxlVmVyc2lvbmluZzogdHJ1ZSxcbiAgICAgIGVuYWJsZUxpZmVjeWNsZVBvbGljeTogdHJ1ZSxcbiAgICAgIHRyYW5zaXRpb25Ub0lBRGF5czogMzAsXG4gICAgICB0cmFuc2l0aW9uVG9HbGFjaWVyRGF5czogOTAsXG4gICAgICBleHBpcmF0aW9uRGF5czogMjU1NSwgLy8gN+W5tFxuICAgICAgZG9jdW1lbnRzOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IHRydWVcbiAgICAgIH0sXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbmluZzogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGVtYmVkZGluZ3M6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbmluZzogZmFsc2VcbiAgICAgIH1cbiAgICB9LFxuICAgIGZzeE9udGFwOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCxcbiAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogMTI4LFxuICAgICAgZGVwbG95bWVudFR5cGU6ICdTSU5HTEVfQVpfMScsXG4gICAgICBhdXRvbWF0aWNCYWNrdXBSZXRlbnRpb25EYXlzOiA3XG4gICAgfVxuICB9LFxuICBcbiAgZGF0YWJhc2U6IHtcbiAgICBkeW5hbW9kYjoge1xuICAgICAgYmlsbGluZ01vZGU6ICdQQVlfUEVSX1JFUVVFU1QnLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuYWJsZVN0cmVhbXM6IHRydWUsXG4gICAgICBzdHJlYW1WaWV3VHlwZTogJ05FV19BTkRfT0xEX0lNQUdFUydcbiAgICB9LFxuICAgIG9wZW5zZWFyY2g6IHtcbiAgICAgIGluc3RhbmNlVHlwZTogJ3QzLnNtYWxsLnNlYXJjaCcsXG4gICAgICBpbnN0YW5jZUNvdW50OiAxLFxuICAgICAgZGVkaWNhdGVkTWFzdGVyRW5hYmxlZDogZmFsc2UsXG4gICAgICBtYXN0ZXJJbnN0YW5jZUNvdW50OiAwLFxuICAgICAgZWJzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHZvbHVtZVR5cGU6ICdncDMnLFxuICAgICAgdm9sdW1lU2l6ZTogMjAsXG4gICAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgZW1iZWRkaW5nOiB7XG4gICAgbGFtYmRhOiB7XG4gICAgICBydW50aW1lOiAncHl0aG9uMy4xMScsXG4gICAgICB0aW1lb3V0OiAzMDAsXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgZW5hYmxlWFJheVRyYWNpbmc6IHRydWUsXG4gICAgICBlbmFibGVEZWFkTGV0dGVyUXVldWU6IHRydWVcbiAgICB9LFxuICAgIGJhdGNoOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSwgLy8g44OH44OV44Kp44Or44OI44Gv54Sh5Yq5XG4gICAgICBjb21wdXRlRW52aXJvbm1lbnRUeXBlOiAnTUFOQUdFRCcsXG4gICAgICBpbnN0YW5jZVR5cGVzOiBbJ201LmxhcmdlJ10sXG4gICAgICBtaW52Q3B1czogMCxcbiAgICAgIG1heHZDcHVzOiAxMCxcbiAgICAgIGRlc2lyZWR2Q3B1czogMFxuICAgIH0sXG4gICAgZWNzOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSwgLy8g44OH44OV44Kp44Or44OI44Gv54Sh5Yq5XG4gICAgICBpbnN0YW5jZVR5cGU6ICdtNS5sYXJnZScsXG4gICAgICBtaW5DYXBhY2l0eTogMCxcbiAgICAgIG1heENhcGFjaXR5OiA1LFxuICAgICAgZGVzaXJlZENhcGFjaXR5OiAwLFxuICAgICAgZW5hYmxlTWFuYWdlZEluc3RhbmNlOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgYXBpOiB7XG4gICAgdGhyb3R0bGluZzoge1xuICAgICAgcmF0ZUxpbWl0OiAxMDAwLFxuICAgICAgYnVyc3RMaW1pdDogMjAwMFxuICAgIH0sXG4gICAgY29yczoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGFsbG93T3JpZ2luczogWycqJ10sIC8vIOacrOeVqueSsOWig+OBp+OBr+WItumZkOOBmeOCi1xuICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJywgJ1gtQW16LURhdGUnLCAnWC1BcGktS2V5JywgJ1gtQW16LVNlY3VyaXR5LVRva2VuJ11cbiAgICB9LFxuICAgIGF1dGhlbnRpY2F0aW9uOiB7XG4gICAgICBjb2duaXRvRW5hYmxlZDogZmFsc2UsIC8vIOeLrOiHquiqjeiovOOCkuS9v+eUqFxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IGZhbHNlXG4gICAgfVxuICB9LFxuICBcbiAgYWk6IHtcbiAgICBiZWRyb2NrOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgbW9kZWxzOiBbXG4gICAgICAgICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgICAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLFxuICAgICAgICAnYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjEnXG4gICAgICBdLFxuICAgICAgbWF4VG9rZW5zOiA0MDk2LFxuICAgICAgdGVtcGVyYXR1cmU6IDAuN1xuICAgIH0sXG4gICAgZW1iZWRkaW5nOiB7XG4gICAgICBtb2RlbDogJ2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxJyxcbiAgICAgIGRpbWVuc2lvbnM6IDE1MzYsXG4gICAgICBiYXRjaFNpemU6IDEwMFxuICAgIH1cbiAgfSxcbiAgXG4gIG1vbml0b3Jpbmc6IHtcbiAgICBlbmFibGVEZXRhaWxlZE1vbml0b3Jpbmc6IHRydWUsXG4gICAgbG9nUmV0ZW50aW9uRGF5czogMzAsXG4gICAgZW5hYmxlQWxhcm1zOiB0cnVlLFxuICAgIGFsYXJtTm90aWZpY2F0aW9uRW1haWw6ICcnLCAvLyDjg4fjg5fjg63jgqTmmYLjgavoqK3lrppcbiAgICBlbmFibGVEYXNoYm9hcmQ6IHRydWUsXG4gICAgZW5hYmxlWFJheVRyYWNpbmc6IHRydWVcbiAgfSxcbiAgXG4gIGVudGVycHJpc2U6IHtcbiAgICBlbmFibGVBY2Nlc3NDb250cm9sOiB0cnVlLFxuICAgIGVuYWJsZUF1ZGl0TG9nZ2luZzogdHJ1ZSxcbiAgICBlbmFibGVCSUFuYWx5dGljczogZmFsc2UsIC8vIOODh+ODleOCqeODq+ODiOOBr+eEoeWKuVxuICAgIGVuYWJsZU11bHRpVGVuYW50OiBmYWxzZSwgLy8g44OH44OV44Kp44Or44OI44Gv54Sh5Yq5XG4gICAgZGF0YVJldGVudGlvbkRheXM6IDI1NTUgLy8gN+W5tFxuICB9LFxuICBcbiAgdGFnczoge1xuICAgIEVudmlyb25tZW50OiAnJywgLy8g55Kw5aKD5Yil44Gr6Kit5a6aXG4gICAgUHJvamVjdDogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgICBPd25lcjogJycsIC8vIOODh+ODl+ODreOCpOaZguOBq+ioreWumlxuICAgIENvc3RDZW50ZXI6ICcnLCAvLyDjg4fjg5fjg63jgqTmmYLjgavoqK3lrppcbiAgICBCYWNrdXA6ICdSZXF1aXJlZCcsXG4gICAgTW9uaXRvcmluZzogJ0VuYWJsZWQnLFxuICAgIENvbXBsaWFuY2U6ICdSZXF1aXJlZCcsXG4gICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnSW50ZXJuYWwnLFxuICAgIFJlZ2lvbjogJycsIC8vIOODquODvOOCuOODp+ODs+WIpeOBq+ioreWumlxuICAgIFRpbWV6b25lOiAnQXNpYS9Ub2t5bycsXG4gICAgQ29tcGxpYW5jZUZyYW1ld29yazogJ1NPQzItR0RQUidcbiAgfVxufTtcblxuLyoqXG4gKiDnkrDlooPliKXoqK3lrprjg4bjg7Pjg5fjg6zjg7zjg4hcbiAqL1xuZXhwb3J0IGNvbnN0IEVudmlyb25tZW50VGVtcGxhdGVzID0ge1xuICBkZXZlbG9wbWVudDoge1xuICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcsXG4gICAgZW52aXJvbm1lbnQ6ICdkZXZlbG9wbWVudCcsXG4gICAgXG4gICAgLy8g6ZaL55m655Kw5aKD55So44Gu5qmf6IO944OV44Op44KwXG4gICAgZmVhdHVyZXM6IHtcbiAgICAgIGVuYWJsZU5ldHdvcmtpbmc6IHRydWUsXG4gICAgICBlbmFibGVTZWN1cml0eTogdHJ1ZSxcbiAgICAgIGVuYWJsZVN0b3JhZ2U6IHRydWUsXG4gICAgICBlbmFibGVEYXRhYmFzZTogdHJ1ZSxcbiAgICAgIGVuYWJsZUVtYmVkZGluZzogdHJ1ZSxcbiAgICAgIGVuYWJsZUFQSTogdHJ1ZSxcbiAgICAgIGVuYWJsZUFJOiB0cnVlLFxuICAgICAgZW5hYmxlTW9uaXRvcmluZzogdHJ1ZSxcbiAgICAgIGVuYWJsZUVudGVycHJpc2U6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirlcbiAgICAgIC8vIEZTeOe1seWQiOapn+iDveODleODqeOCsO+8iOaWsOimj+i/veWKoO+8iVxuICAgICAgZW5hYmxlRnN4SW50ZWdyYXRpb246IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4U2VydmVybGVzc1dvcmtmbG93czogZmFsc2UsXG4gICAgICBlbmFibGVGc3hFdmVudERyaXZlbjogZmFsc2UsXG4gICAgICBlbmFibGVGc3hCYXRjaFByb2Nlc3Npbmc6IGZhbHNlLFxuICAgICAgLy8gQWdlbnRDb3Jl57Wx5ZCI5qmf6IO944OV44Op44Kw77yIVGFzayAzLjLov73liqDvvIlcbiAgICAgIGVuYWJsZUFnZW50Q29yZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgZW5hYmxlSHlicmlkQXJjaGl0ZWN0dXJlOiB0cnVlLFxuICAgICAgZW5hYmxlVXNlclByZWZlcmVuY2VzOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyBGU3ggZm9yIE9OVEFQ6Kit5a6a77yI6ZaL55m655Kw5aKD55So77yJXG4gICAgZnN4T250YXBJbnRlZ3JhdGlvbjoge1xuICAgICAgLi4uRlN4T05UQVBQcmVzZXRzLmRldmVsb3BtZW50LFxuICAgICAgZW5hYmxlZDogZmFsc2UgLy8g44OH44OV44Kp44Or44OI44Gv54Sh5Yq544CB5b+F6KaB44Gr5b+c44GY44Gm5pyJ5Yq55YyWXG4gICAgfSxcbiAgICBcbiAgICAvLyDjgrXjg7zjg5Djg6zjgrnoqK3lrprvvIjplovnmbrnkrDlooPnlKjvvIlcbiAgICBzZXJ2ZXJsZXNzSW50ZWdyYXRpb246IHtcbiAgICAgIC4uLlNlcnZlcmxlc3NQcmVzZXRzLmRldmVsb3BtZW50LFxuICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgIH0sXG4gICAgXG4gICAgdGFnczoge1xuICAgICAgLi4uQmFzZUFjY291bnRBZ25vc3RpY0NvbmZpZy50YWdzLFxuICAgICAgRW52aXJvbm1lbnQ6ICdkZXZlbG9wbWVudCcsXG4gICAgICBCdXNpbmVzc0NyaXRpY2FsaXR5OiAnTG93JyxcbiAgICAgIERpc2FzdGVyUmVjb3Zlcnk6ICdOb3RSZXF1aXJlZCcsXG4gICAgICBTZWN1cml0eUxldmVsOiAnU3RhbmRhcmQnLFxuICAgICAgRW5jcnlwdGlvblJlcXVpcmVkOiAnWWVzJyxcbiAgICAgIEF1ZGl0UmVxdWlyZWQ6ICdObycsXG4gICAgICBQZXJmb3JtYW5jZUxldmVsOiAnU3RhbmRhcmQnLFxuICAgICAgQXZhaWxhYmlsaXR5VGFyZ2V0OiAnOTkuMCUnLFxuICAgICAgUlBPOiAnMjRoJyxcbiAgICAgIFJUTzogJzRoJ1xuICAgIH1cbiAgfSBhcyBFbnZpcm9ubWVudENvbmZpZyxcblxuICBzdGFnaW5nOiB7XG4gICAgLi4uQmFzZUFjY291bnRBZ25vc3RpY0NvbmZpZyxcbiAgICBlbnZpcm9ubWVudDogJ3N0YWdpbmcnLFxuICAgIFxuICAgIC8vIOOCueODhuODvOOCuOODs+OCsOeSsOWig+eUqOOBruapn+iDveODleODqeOCsFxuICAgIGZlYXR1cmVzOiB7XG4gICAgICBlbmFibGVOZXR3b3JraW5nOiB0cnVlLFxuICAgICAgZW5hYmxlU2VjdXJpdHk6IHRydWUsXG4gICAgICBlbmFibGVTdG9yYWdlOiB0cnVlLFxuICAgICAgZW5hYmxlRGF0YWJhc2U6IHRydWUsXG4gICAgICBlbmFibGVFbWJlZGRpbmc6IHRydWUsXG4gICAgICBlbmFibGVBUEk6IHRydWUsXG4gICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgIGVuYWJsZU1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBlbmFibGVFbnRlcnByaXNlOiB0cnVlLCAvLyDjgrnjg4bjg7zjgrjjg7PjgrDjgafjga/mnInlirlcbiAgICAgIC8vIEZTeOe1seWQiOapn+iDveODleODqeOCsO+8iOaWsOimj+i/veWKoO+8iVxuICAgICAgZW5hYmxlRnN4SW50ZWdyYXRpb246IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4U2VydmVybGVzc1dvcmtmbG93czogZmFsc2UsXG4gICAgICBlbmFibGVGc3hFdmVudERyaXZlbjogZmFsc2UsXG4gICAgICBlbmFibGVGc3hCYXRjaFByb2Nlc3Npbmc6IGZhbHNlLFxuICAgICAgLy8gQWdlbnRDb3Jl57Wx5ZCI5qmf6IO944OV44Op44Kw77yIVGFzayAzLjLov73liqDvvIlcbiAgICAgIGVuYWJsZUFnZW50Q29yZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgZW5hYmxlSHlicmlkQXJjaGl0ZWN0dXJlOiB0cnVlLFxuICAgICAgZW5hYmxlVXNlclByZWZlcmVuY2VzOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyBGU3ggZm9yIE9OVEFQ6Kit5a6a77yI44K544OG44O844K444Oz44Kw55Kw5aKD55So77yJXG4gICAgZnN4T250YXBJbnRlZ3JhdGlvbjoge1xuICAgICAgLi4uRlN4T05UQVBQcmVzZXRzLmRldmVsb3BtZW50LCAvLyDplovnmbroqK3lrprjgpLjg5njg7zjgrnjgavjgZnjgovjgYzjgrXjgqTjgrrjgpLoqr/mlbRcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBmaWxlU3lzdGVtOiB7XG4gICAgICAgIC4uLkZTeE9OVEFQUHJlc2V0cy5kZXZlbG9wbWVudC5maWxlU3lzdGVtLFxuICAgICAgICBzdG9yYWdlQ2FwYWNpdHk6IDIwNDgsIC8vIOmWi+eZuuOCiOOCiuWkp+OBjeOBj1xuICAgICAgICB0aHJvdWdocHV0Q2FwYWNpdHk6IDI1NlxuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgLy8g44K144O844OQ44Os44K56Kit5a6a77yI44K544OG44O844K444Oz44Kw55Kw5aKD55So77yJXG4gICAgc2VydmVybGVzc0ludGVncmF0aW9uOiB7XG4gICAgICAuLi5TZXJ2ZXJsZXNzUHJlc2V0cy5kZXZlbG9wbWVudCxcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBsYW1iZGE6IHtcbiAgICAgICAgLi4uU2VydmVybGVzc1ByZXNldHMuZGV2ZWxvcG1lbnQubGFtYmRhLFxuICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAuLi5TZXJ2ZXJsZXNzUHJlc2V0cy5kZXZlbG9wbWVudC5sYW1iZGEuY29tbW9uLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDUxMiwgLy8g6ZaL55m644KI44KK5aSn44GN44GPXG4gICAgICAgICAgdGltZW91dDogNjBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgdGFnczoge1xuICAgICAgLi4uQmFzZUFjY291bnRBZ25vc3RpY0NvbmZpZy50YWdzLFxuICAgICAgRW52aXJvbm1lbnQ6ICdzdGFnaW5nJyxcbiAgICAgIEJ1c2luZXNzQ3JpdGljYWxpdHk6ICdNZWRpdW0nLFxuICAgICAgRGlzYXN0ZXJSZWNvdmVyeTogJ1JlcXVpcmVkJyxcbiAgICAgIFNlY3VyaXR5TGV2ZWw6ICdIaWdoJyxcbiAgICAgIEVuY3J5cHRpb25SZXF1aXJlZDogJ1llcycsXG4gICAgICBBdWRpdFJlcXVpcmVkOiAnWWVzJyxcbiAgICAgIFBlcmZvcm1hbmNlTGV2ZWw6ICdIaWdoJyxcbiAgICAgIEF2YWlsYWJpbGl0eVRhcmdldDogJzk5LjUlJyxcbiAgICAgIFJQTzogJzRoJyxcbiAgICAgIFJUTzogJzJoJ1xuICAgIH1cbiAgfSBhcyBFbnZpcm9ubWVudENvbmZpZyxcblxuICBwcm9kdWN0aW9uOiB7XG4gICAgLi4uQmFzZUFjY291bnRBZ25vc3RpY0NvbmZpZyxcbiAgICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICAgIFxuICAgIC8vIOacrOeVqueSsOWig+eUqOOBruapn+iDveODleODqeOCsFxuICAgIGZlYXR1cmVzOiB7XG4gICAgICBlbmFibGVOZXR3b3JraW5nOiB0cnVlLFxuICAgICAgZW5hYmxlU2VjdXJpdHk6IHRydWUsXG4gICAgICBlbmFibGVTdG9yYWdlOiB0cnVlLFxuICAgICAgZW5hYmxlRGF0YWJhc2U6IHRydWUsXG4gICAgICBlbmFibGVFbWJlZGRpbmc6IHRydWUsXG4gICAgICBlbmFibGVBUEk6IHRydWUsXG4gICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgIGVuYWJsZU1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBlbmFibGVFbnRlcnByaXNlOiB0cnVlLFxuICAgICAgLy8gRlN457Wx5ZCI5qmf6IO944OV44Op44Kw77yI5paw6KaP6L+95Yqg77yJXG4gICAgICBlbmFibGVGc3hJbnRlZ3JhdGlvbjogZmFsc2UsXG4gICAgICBlbmFibGVGc3hTZXJ2ZXJsZXNzV29ya2Zsb3dzOiBmYWxzZSxcbiAgICAgIGVuYWJsZUZzeEV2ZW50RHJpdmVuOiBmYWxzZSxcbiAgICAgIGVuYWJsZUZzeEJhdGNoUHJvY2Vzc2luZzogZmFsc2UsXG4gICAgICAvLyBBZ2VudENvcmXntbHlkIjmqZ/og73jg5Xjg6njgrDvvIhUYXNrIDMuMui/veWKoO+8iVxuICAgICAgZW5hYmxlQWdlbnRDb3JlSW50ZWdyYXRpb246IHRydWUsXG4gICAgICBlbmFibGVIeWJyaWRBcmNoaXRlY3R1cmU6IHRydWUsXG4gICAgICBlbmFibGVVc2VyUHJlZmVyZW5jZXM6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIC8vIEZTeCBmb3IgT05UQVDoqK3lrprvvIjmnKznlarnkrDlooPnlKjvvIlcbiAgICBmc3hPbnRhcEludGVncmF0aW9uOiB7XG4gICAgICAuLi5GU3hPTlRBUFByZXNldHMucHJvZHVjdGlvbixcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIC8vIOOCteODvOODkOODrOOCueioreWumu+8iOacrOeVqueSsOWig+eUqO+8iVxuICAgIHNlcnZlcmxlc3NJbnRlZ3JhdGlvbjoge1xuICAgICAgLi4uU2VydmVybGVzc1ByZXNldHMucHJvZHVjdGlvbixcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIC8vIOacrOeVqueSsOWig+eUqOOBruODjeODg+ODiOODr+ODvOOCr+ioreWumlxuICAgIG5ldHdvcmtpbmc6IHtcbiAgICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcubmV0d29ya2luZyxcbiAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAzLCAvLyDmnKznlarjgafjga8zQVpcbiAgICAgIG5hdEdhdGV3YXlzOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGNvdW50OiAyIC8vIOacrOeVquOBp+OBr+WGl+mVt+WMllxuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgLy8g5pys55Wq55Kw5aKD55So44Gu44OH44O844K/44OZ44O844K56Kit5a6aXG4gICAgZGF0YWJhc2U6IHtcbiAgICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcuZGF0YWJhc2UsXG4gICAgICBvcGVuc2VhcmNoOiB7XG4gICAgICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcuZGF0YWJhc2Uub3BlbnNlYXJjaCxcbiAgICAgICAgaW5zdGFuY2VUeXBlOiAnbTZnLmxhcmdlLnNlYXJjaCcsXG4gICAgICAgIGluc3RhbmNlQ291bnQ6IDMsIC8vIOacrOeVquOBp+OBrzPjg47jg7zjg4lcbiAgICAgICAgZGVkaWNhdGVkTWFzdGVyRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWFzdGVySW5zdGFuY2VDb3VudDogMyxcbiAgICAgICAgdm9sdW1lU2l6ZTogMTAwIC8vIOacrOeVquOBp+OBr+Wkp+WuuemHj1xuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgdGFnczoge1xuICAgICAgLi4uQmFzZUFjY291bnRBZ25vc3RpY0NvbmZpZy50YWdzLFxuICAgICAgRW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcbiAgICAgIEJ1c2luZXNzQ3JpdGljYWxpdHk6ICdIaWdoJyxcbiAgICAgIERpc2FzdGVyUmVjb3Zlcnk6ICdSZXF1aXJlZCcsXG4gICAgICBTZWN1cml0eUxldmVsOiAnQ3JpdGljYWwnLFxuICAgICAgRW5jcnlwdGlvblJlcXVpcmVkOiAnWWVzJyxcbiAgICAgIEF1ZGl0UmVxdWlyZWQ6ICdZZXMnLFxuICAgICAgUGVyZm9ybWFuY2VMZXZlbDogJ0NyaXRpY2FsJyxcbiAgICAgIEF2YWlsYWJpbGl0eVRhcmdldDogJzk5LjklJyxcbiAgICAgIFJQTzogJzFoJyxcbiAgICAgIFJUTzogJzMwbSdcbiAgICB9XG4gIH0gYXMgRW52aXJvbm1lbnRDb25maWdcbn07XG5cbi8qKlxuICog5qmf6IO95Yil44Kq44OX44K344On44Oz6Kit5a6aXG4gKiDjg6bjg7zjgrbjg7zjgYzlgIvliKXjgavmnInlirnljJYv54Sh5Yq55YyW44Gn44GN44KL5qmf6IO944Gu6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBGZWF0dXJlT3B0aW9ucyA9IHtcbiAgLy8gRlN4IGZvciBPTlRBUOe1seWQiOOCquODl+OCt+ODp+ODs1xuICBmc3hPbnRhcEludGVncmF0aW9uOiB7XG4gICAgbWluaW1hbDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGZpbGVTeXN0ZW06IHtcbiAgICAgICAgc3RvcmFnZUNhcGFjaXR5OiAxMDI0LFxuICAgICAgICB0aHJvdWdocHV0Q2FwYWNpdHk6IDEyOCxcbiAgICAgICAgZGVwbG95bWVudFR5cGU6ICdTSU5HTEVfQVpfMScgYXMgY29uc3QsXG4gICAgICAgIGF1dG9EZXRlY3ROZXR3b3JraW5nOiB0cnVlLFxuICAgICAgICBhdXRvQ29uZmlndXJlUm91dGluZzogdHJ1ZSxcbiAgICAgICAgYXV0b1NjYWxpbmc6IHsgZW5hYmxlZDogZmFsc2UsIG1pbkNhcGFjaXR5OiAxMDI0LCBtYXhDYXBhY2l0eTogMjA0OCwgdGFyZ2V0VXRpbGl6YXRpb246IDgwIH1cbiAgICAgIH0sXG4gICAgICBzM0FjY2Vzc1BvaW50czoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBhdXRvQ3JlYXRlQWNjZXNzUG9pbnRzOiB0cnVlLFxuICAgICAgICBhY2Nlc3NQb2ludE5hbWluZ1BhdHRlcm46IFwiJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tJHtwdXJwb3NlfVwiLFxuICAgICAgICBhY2Nlc3NQb2ludHM6IFtcbiAgICAgICAgICB7IG5hbWU6ICdjaGF0LWhpc3RvcnknLCBwdXJwb3NlOiAnY2hhdC1oaXN0b3J5JyBhcyBjb25zdCB9XG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICB0aWVyaW5nOiB7IGVuYWJsZWQ6IGZhbHNlIH0sXG4gICAgICBwZXJmb3JtYW5jZToge1xuICAgICAgICBtb25pdG9yaW5nOiB7IGVuYWJsZWQ6IHRydWUsIG1ldHJpY3NDb2xsZWN0aW9uOiB0cnVlLCBkZXRhaWxlZE1vbml0b3Jpbmc6IGZhbHNlIH0sXG4gICAgICAgIGF1dG9PcHRpbWl6YXRpb246IHsgZW5hYmxlZDogZmFsc2UsIHRocm91Z2hwdXRPcHRpbWl6YXRpb246IGZhbHNlLCBzdG9yYWdlT3B0aW1pemF0aW9uOiBmYWxzZSwgcGVyZm9ybWFuY2VNb2RlOiAnQ09TVF9PUFRJTUlaRUQnIGFzIGNvbnN0IH0sXG4gICAgICAgIGNhY2hlOiB7IGVuYWJsZWQ6IGZhbHNlLCBzaXplOiAwLCB0eXBlOiAnUkVBRCcgYXMgY29uc3QgfVxuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgc3RhbmRhcmQ6IHtcbiAgICAgIC4uLkZTeE9OVEFQUHJlc2V0cy5kZXZlbG9wbWVudCxcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIGFkdmFuY2VkOiB7XG4gICAgICAuLi5GU3hPTlRBUFByZXNldHMucHJvZHVjdGlvbixcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9XG4gIH0sXG4gIFxuICAvLyDjgrXjg7zjg5Djg6zjgrnntbHlkIjjgqrjg5fjgrfjg6fjg7NcbiAgc2VydmVybGVzc0ludGVncmF0aW9uOiB7XG4gICAgbWluaW1hbDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHN0ZXBGdW5jdGlvbnM6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UgLy8g5pyA5bCP5qeL5oiQ44Gn44Gv54Sh5Yq5XG4gICAgICB9LFxuICAgICAgZXZlbnRCcmlkZ2U6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY3VzdG9tRXZlbnRCdXM6IHsgZW5hYmxlZDogZmFsc2UgfSxcbiAgICAgICAgcnVsZXM6IFtdLFxuICAgICAgICBzY2hlZHVsZXM6IFtdXG4gICAgICB9LFxuICAgICAgc3FzOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHF1ZXVlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjaGF0LXByb2Nlc3NpbmcnLFxuICAgICAgICAgICAgcHVycG9zZTogJ2NoYXQtcHJvY2Vzc2luZycgYXMgY29uc3QsXG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICB2aXNpYmlsaXR5VGltZW91dFNlY29uZHM6IDMwLFxuICAgICAgICAgICAgICBtZXNzYWdlUmV0ZW50aW9uUGVyaW9kOiAxMjA5NjAwLCAvLyAxNOaXpVxuICAgICAgICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDNcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbmNyeXB0aW9uOiB7IGVuYWJsZWQ6IHRydWUgfVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHNuczoge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSAvLyDmnIDlsI/mp4vmiJDjgafjga/nhKHlirlcbiAgICAgIH0sXG4gICAgICBsYW1iZGE6IHtcbiAgICAgICAgY29tbW9uOiB7XG4gICAgICAgICAgcnVudGltZTogJ25vZGVqczE4LngnLFxuICAgICAgICAgIHRpbWVvdXQ6IDMwLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgICBlbmFibGVYUmF5VHJhY2luZzogZmFsc2UsXG4gICAgICAgICAgZW5hYmxlRGVhZExldHRlclF1ZXVlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGZ1bmN0aW9uczogW10sXG4gICAgICAgIGxheWVyczogW10sXG4gICAgICAgIGVudmlyb25tZW50OiB7IGF1dG9JbmplY3Q6IHRydWUsIHZhcmlhYmxlczoge30gfVxuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgc3RhbmRhcmQ6IHtcbiAgICAgIC4uLlNlcnZlcmxlc3NQcmVzZXRzLmRldmVsb3BtZW50LFxuICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgIH0sXG4gICAgXG4gICAgYWR2YW5jZWQ6IHtcbiAgICAgIC4uLlNlcnZlcmxlc3NQcmVzZXRzLnByb2R1Y3Rpb24sXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgLy8g44OR44OV44Kp44O844Oe44Oz44K55pyA6YGp5YyW44Kq44OX44K344On44OzXG4gIHBlcmZvcm1hbmNlT3B0aW1pemF0aW9uOiB7XG4gICAgZGlzYWJsZWQ6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBcbiAgICBiYXNpYzoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBhdXRvT3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICAgIGNhY2hpbmc6IGZhbHNlXG4gICAgfSxcbiAgICBcbiAgICBhZHZhbmNlZDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBhdXRvT3B0aW1pemF0aW9uOiB0cnVlLFxuICAgICAgY2FjaGluZzogdHJ1ZSxcbiAgICAgIHByZWRpY3RpdmVTY2FsaW5nOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgLy8g44Kz44K544OI5pyA6YGp5YyW44Kq44OX44K344On44OzXG4gIGNvc3RPcHRpbWl6YXRpb246IHtcbiAgICBkaXNhYmxlZDoge1xuICAgICAgZW5hYmxlZDogZmFsc2VcbiAgICB9LFxuICAgIFxuICAgIGJhc2ljOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgbW9uaXRvcmluZzogdHJ1ZSxcbiAgICAgIGJ1ZGdldEFsZXJ0czogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVBvbGljaWVzOiB0cnVlLFxuICAgICAgcmlnaHRTaXppbmc6IGZhbHNlXG4gICAgfSxcbiAgICBcbiAgICBhZHZhbmNlZDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBidWRnZXRBbGVydHM6IHRydWUsXG4gICAgICBsaWZlY3ljbGVQb2xpY2llczogdHJ1ZSxcbiAgICAgIHJpZ2h0U2l6aW5nOiB0cnVlLFxuICAgICAgcHJlZGljdGl2ZU9wdGltaXphdGlvbjogdHJ1ZSxcbiAgICAgIGF1dG9tYXRlZE9wdGltaXphdGlvbjogdHJ1ZVxuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiDoqK3lrprjg5Djg6rjg4fjg7zjgrfjg6fjg7PplqLmlbBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQWNjb3VudEFnbm9zdGljQ29uZmlnKGNvbmZpZzogUGFydGlhbDxFbnZpcm9ubWVudENvbmZpZz4pOiB7XG4gIGlzVmFsaWQ6IGJvb2xlYW47XG4gIGVycm9yczogc3RyaW5nW107XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn0ge1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIOW/hemgiOODleOCo+ODvOODq+ODieOBruaknOiovFxuICBpZiAoIWNvbmZpZy5lbnZpcm9ubWVudCkge1xuICAgIGVycm9ycy5wdXNoKCdFbnZpcm9ubWVudCBpcyByZXF1aXJlZCcpO1xuICB9XG5cbiAgaWYgKCFjb25maWcucmVnaW9uKSB7XG4gICAgZXJyb3JzLnB1c2goJ1JlZ2lvbiBpcyByZXF1aXJlZCcpO1xuICB9XG5cbiAgaWYgKCFjb25maWcucHJvamVjdD8ubmFtZSkge1xuICAgIGVycm9ycy5wdXNoKCdQcm9qZWN0IG5hbWUgaXMgcmVxdWlyZWQnKTtcbiAgfVxuXG4gIC8vIEZTeCBmb3IgT05UQVDoqK3lrprjga7mpJzoqLxcbiAgaWYgKGNvbmZpZy5mZWF0dXJlcz8uZW5hYmxlRnN4SW50ZWdyYXRpb24gJiYgY29uZmlnLnN0b3JhZ2U/LmZzeE9udGFwPy5lbmFibGVkKSB7XG4gICAgaWYgKCFjb25maWcuc3RvcmFnZS5mc3hPbnRhcCkge1xuICAgICAgZXJyb3JzLnB1c2goJ0ZTeCBmb3IgT05UQVAgZmlsZSBzeXN0ZW0gY29uZmlndXJhdGlvbiBpcyByZXF1aXJlZCB3aGVuIGludGVncmF0aW9uIGlzIGVuYWJsZWQnKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLnN0b3JhZ2UuZnN4T250YXAuc3RvcmFnZUNhcGFjaXR5IDwgMTAyNCkge1xuICAgICAgd2FybmluZ3MucHVzaCgnRlN4IGZvciBPTlRBUCBzdG9yYWdlIGNhcGFjaXR5IHNob3VsZCBiZSBhdCBsZWFzdCAxMDI0IEdCIGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlJyk7XG4gICAgfVxuICB9XG5cbiAgLy8g44K144O844OQ44Os44K56Kit5a6a44Gu5qSc6Ki877yI5LiA5pmC55qE44Gr44Kz44Oh44Oz44OI44Ki44Km44OI77yJXG4gIC8qXG4gIGlmIChjb25maWcuZmVhdHVyZXM/LmVuYWJsZVNlcnZlcmxlc3NJbnRlZ3JhdGlvbiAmJiBjb25maWcuc2VydmVybGVzc0ludGVncmF0aW9uPy5lbmFibGVkKSB7XG4gICAgaWYgKGNvbmZpZy5zZXJ2ZXJsZXNzSW50ZWdyYXRpb24ubGFtYmRhPy5jb21tb24/LnRpbWVvdXQgPiA5MDApIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ0xhbWJkYSB0aW1lb3V0IHNob3VsZCBub3QgZXhjZWVkIDE1IG1pbnV0ZXMgKDkwMCBzZWNvbmRzKScpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcuc2VydmVybGVzc0ludGVncmF0aW9uLmxhbWJkYT8uY29tbW9uPy5tZW1vcnlTaXplID4gMTAyNDApIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ0xhbWJkYSBtZW1vcnkgc2l6ZSBzaG91bGQgbm90IGV4Y2VlZCAxMCwyNDAgTUIgdW5sZXNzIHNwZWNpZmljYWxseSByZXF1aXJlZCcpO1xuICAgIH1cbiAgfVxuICAqL1xuXG4gIC8vIOeSsOWig+WIpeOBruaknOiovFxuICBpZiAoY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAoY29uZmlnLm5ldHdvcmtpbmc/LmF2YWlsYWJpbGl0eVpvbmVzIDwgMikge1xuICAgICAgZXJyb3JzLnB1c2goJ1Byb2R1Y3Rpb24gZW52aXJvbm1lbnQgc2hvdWxkIHVzZSBhdCBsZWFzdCAyIGF2YWlsYWJpbGl0eSB6b25lcycpO1xuICAgIH1cblxuICAgIGlmICghY29uZmlnLnNlY3VyaXR5Py5lbmFibGVDbG91ZFRyYWlsKSB7XG4gICAgICBlcnJvcnMucHVzaCgnQ2xvdWRUcmFpbCBzaG91bGQgYmUgZW5hYmxlZCBpbiBwcm9kdWN0aW9uIGVudmlyb25tZW50Jyk7XG4gICAgfVxuXG4gICAgaWYgKCFjb25maWcubW9uaXRvcmluZz8uZW5hYmxlRGV0YWlsZWRNb25pdG9yaW5nKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKCdEZXRhaWxlZCBtb25pdG9yaW5nIGlzIHJlY29tbWVuZGVkIGZvciBwcm9kdWN0aW9uIGVudmlyb25tZW50Jyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBpc1ZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgIGVycm9ycyxcbiAgICB3YXJuaW5nc1xuICB9O1xufVxuXG4vKipcbiAqIOioreWumuODnuODvOOCuOmWouaVsFxuICog44OZ44O844K56Kit5a6a44Gr44Kr44K544K/44Og6Kit5a6a44KS44Oe44O844K444GZ44KLXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZUNvbmZpZ3VyYXRpb25zKFxuICBiYXNlQ29uZmlnOiBQYXJ0aWFsPEVudmlyb25tZW50Q29uZmlnPixcbiAgY3VzdG9tQ29uZmlnOiBQYXJ0aWFsPEVudmlyb25tZW50Q29uZmlnPlxuKTogRW52aXJvbm1lbnRDb25maWcge1xuICAvLyBEZWVwIG1lcmdlIGltcGxlbWVudGF0aW9uXG4gIGNvbnN0IG1lcmdlZCA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoYmFzZUNvbmZpZykpO1xuICBcbiAgZnVuY3Rpb24gZGVlcE1lcmdlKHRhcmdldDogYW55LCBzb3VyY2U6IGFueSk6IGFueSB7XG4gICAgZm9yIChjb25zdCBrZXkgaW4gc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlW2tleV0gJiYgdHlwZW9mIHNvdXJjZVtrZXldID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShzb3VyY2Vba2V5XSkpIHtcbiAgICAgICAgaWYgKCF0YXJnZXRba2V5XSkgdGFyZ2V0W2tleV0gPSB7fTtcbiAgICAgICAgZGVlcE1lcmdlKHRhcmdldFtrZXldLCBzb3VyY2Vba2V5XSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIGRlZXBNZXJnZShtZXJnZWQsIGN1c3RvbUNvbmZpZykgYXMgRW52aXJvbm1lbnRDb25maWc7XG59XG5cbi8qKlxuICog55Kw5aKD6Kit5a6a44OV44Kh44Kv44OI44Oq44O86Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbnZpcm9ubWVudENvbmZpZyhcbiAgZW52aXJvbm1lbnQ6ICdkZXZlbG9wbWVudCcgfCAnc3RhZ2luZycgfCAncHJvZHVjdGlvbicsXG4gIHJlZ2lvbjogc3RyaW5nLFxuICBjdXN0b21PcHRpb25zPzoge1xuICAgIGZzeE9udGFwTGV2ZWw/OiAnZGlzYWJsZWQnIHwgJ21pbmltYWwnIHwgJ3N0YW5kYXJkJyB8ICdhZHZhbmNlZCc7XG4gICAgc2VydmVybGVzc0xldmVsPzogJ2Rpc2FibGVkJyB8ICdtaW5pbWFsJyB8ICdzdGFuZGFyZCcgfCAnYWR2YW5jZWQnO1xuICAgIHBlcmZvcm1hbmNlTGV2ZWw/OiAnZGlzYWJsZWQnIHwgJ2Jhc2ljJyB8ICdhZHZhbmNlZCc7XG4gICAgY29zdE9wdGltaXphdGlvbkxldmVsPzogJ2Rpc2FibGVkJyB8ICdiYXNpYycgfCAnYWR2YW5jZWQnO1xuICAgIGN1c3RvbUNvbmZpZz86IFBhcnRpYWw8RW52aXJvbm1lbnRDb25maWc+O1xuICB9XG4pOiBFbnZpcm9ubWVudENvbmZpZyB7XG4gIC8vIOODmeODvOOCueioreWumuOCkuWPluW+l1xuICBsZXQgYmFzZUNvbmZpZyA9IEVudmlyb25tZW50VGVtcGxhdGVzW2Vudmlyb25tZW50XTtcbiAgXG4gIC8vIOODquODvOOCuOODp+ODs+OCkuioreWumlxuICBiYXNlQ29uZmlnID0ge1xuICAgIC4uLmJhc2VDb25maWcsXG4gICAgcmVnaW9uLFxuICAgIHRhZ3M6IHtcbiAgICAgIC4uLmJhc2VDb25maWcudGFncyxcbiAgICAgIFJlZ2lvbjogcmVnaW9uXG4gICAgfVxuICB9O1xuXG4gIC8vIOOCq+OCueOCv+ODoOOCquODl+OCt+ODp+ODs+OCkumBqeeUqFxuICBpZiAoY3VzdG9tT3B0aW9ucykge1xuICAgIC8vIEZTeCBmb3IgT05UQVDoqK3lrprvvIjkuIDmmYLnmoTjgavjgrPjg6Hjg7Pjg4jjgqLjgqbjg4jvvIlcbiAgICAvKlxuICAgIGlmIChjdXN0b21PcHRpb25zLmZzeE9udGFwTGV2ZWwgJiYgY3VzdG9tT3B0aW9ucy5mc3hPbnRhcExldmVsICE9PSAnZGlzYWJsZWQnKSB7XG4gICAgICBiYXNlQ29uZmlnLmZlYXR1cmVzLmVuYWJsZUZzeEludGVncmF0aW9uID0gdHJ1ZTtcbiAgICAgIC8vIGJhc2VDb25maWcuZnN4T250YXBJbnRlZ3JhdGlvbiA9IHtcbiAgICAgIC8vICAgLi4uRmVhdHVyZU9wdGlvbnMuZnN4T250YXBJbnRlZ3JhdGlvbltjdXN0b21PcHRpb25zLmZzeE9udGFwTGV2ZWxdLFxuICAgICAgLy8gICBlbmFibGVkOiB0cnVlXG4gICAgICAvLyB9O1xuICAgIH0gZWxzZSBpZiAoY3VzdG9tT3B0aW9ucy5mc3hPbnRhcExldmVsID09PSAnZGlzYWJsZWQnKSB7XG4gICAgICBiYXNlQ29uZmlnLmZlYXR1cmVzLmVuYWJsZUZzeEludGVncmF0aW9uID0gZmFsc2U7XG4gICAgICAvLyBpZiAoYmFzZUNvbmZpZy5mc3hPbnRhcEludGVncmF0aW9uKSB7XG4gICAgICAvLyAgIGJhc2VDb25maWcuZnN4T250YXBJbnRlZ3JhdGlvbi5lbmFibGVkID0gZmFsc2U7XG4gICAgICAvLyB9XG4gICAgfVxuICAgICovXG5cbiAgICAvLyDjgrXjg7zjg5Djg6zjgrnoqK3lrprvvIjkuIDmmYLnmoTjgavjgrPjg6Hjg7Pjg4jjgqLjgqbjg4jvvIlcbiAgICAvKlxuICAgIGlmIChjdXN0b21PcHRpb25zLnNlcnZlcmxlc3NMZXZlbCAmJiBjdXN0b21PcHRpb25zLnNlcnZlcmxlc3NMZXZlbCAhPT0gJ2Rpc2FibGVkJykge1xuICAgICAgYmFzZUNvbmZpZy5mZWF0dXJlcy5lbmFibGVTZXJ2ZXJsZXNzSW50ZWdyYXRpb24gPSB0cnVlO1xuICAgICAgYmFzZUNvbmZpZy5zZXJ2ZXJsZXNzSW50ZWdyYXRpb24gPSB7XG4gICAgICAgIC4uLkZlYXR1cmVPcHRpb25zLnNlcnZlcmxlc3NJbnRlZ3JhdGlvbltjdXN0b21PcHRpb25zLnNlcnZlcmxlc3NMZXZlbF0sXG4gICAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChjdXN0b21PcHRpb25zLnNlcnZlcmxlc3NMZXZlbCA9PT0gJ2Rpc2FibGVkJykge1xuICAgICAgYmFzZUNvbmZpZy5mZWF0dXJlcy5lbmFibGVTZXJ2ZXJsZXNzSW50ZWdyYXRpb24gPSBmYWxzZTtcbiAgICAgIGlmIChiYXNlQ29uZmlnLnNlcnZlcmxlc3NJbnRlZ3JhdGlvbikge1xuICAgICAgICBiYXNlQ29uZmlnLnNlcnZlcmxlc3NJbnRlZ3JhdGlvbi5lbmFibGVkID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgICovXG5cbiAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmnIDpganljJboqK3lrprvvIjkuIDmmYLnmoTjgavjgrPjg6Hjg7Pjg4jjgqLjgqbjg4jvvIlcbiAgICAvKlxuICAgIGlmIChjdXN0b21PcHRpb25zLnBlcmZvcm1hbmNlTGV2ZWwpIHtcbiAgICAgIGJhc2VDb25maWcuZmVhdHVyZXMuZW5hYmxlUGVyZm9ybWFuY2VPcHRpbWl6YXRpb24gPSBjdXN0b21PcHRpb25zLnBlcmZvcm1hbmNlTGV2ZWwgIT09ICdkaXNhYmxlZCc7XG4gICAgfVxuICAgICovXG5cbiAgICAvLyDjgrPjgrnjg4jmnIDpganljJboqK3lrprvvIjkuIDmmYLnmoTjgavjgrPjg6Hjg7Pjg4jjgqLjgqbjg4jvvIlcbiAgICAvKlxuICAgIGlmIChjdXN0b21PcHRpb25zLmNvc3RPcHRpbWl6YXRpb25MZXZlbCkge1xuICAgICAgYmFzZUNvbmZpZy5mZWF0dXJlcy5lbmFibGVDb3N0T3B0aW1pemF0aW9uID0gY3VzdG9tT3B0aW9ucy5jb3N0T3B0aW1pemF0aW9uTGV2ZWwgIT09ICdkaXNhYmxlZCc7XG4gICAgfVxuICAgICovXG5cbiAgICAvLyDjgqvjgrnjgr/jg6DoqK3lrprjgpLjg57jg7zjgrhcbiAgICBpZiAoY3VzdG9tT3B0aW9ucy5jdXN0b21Db25maWcpIHtcbiAgICAgIGJhc2VDb25maWcgPSBtZXJnZUNvbmZpZ3VyYXRpb25zKGJhc2VDb25maWcsIGN1c3RvbU9wdGlvbnMuY3VzdG9tQ29uZmlnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmFzZUNvbmZpZztcbn0iXX0=