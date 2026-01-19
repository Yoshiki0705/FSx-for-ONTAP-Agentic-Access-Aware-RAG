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
    // FSx ONTAP設定の検証（一時的に無効化）
    if (false && config.storage?.fsxOntap?.enabled) {
        if (!config.storage.fsxOntap) {
            throw new Error('FSx ONTAP設定が見つかりません');
        }
        console.log('✅ FSx ONTAP設定検証完了');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjb3VudC1hZ25vc3RpYy1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhY2NvdW50LWFnbm9zdGljLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUF1aEJILHNFQStEQztBQU1ELGtEQW9CQztBQUtELDBEQStFQztBQWpzQkQscUVBQWlFO0FBQ2pFLHVFQUFvRTtBQUVwRTs7O0dBR0c7QUFDVSxRQUFBLHlCQUF5QixHQUErQjtJQUNuRSxPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFdBQVcsRUFBRSw0REFBNEQ7S0FDMUU7SUFFRCxVQUFVLEVBQUU7UUFDVixPQUFPLEVBQUUsYUFBYTtRQUN0QixpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLFdBQVcsRUFBRTtZQUNYLE9BQU8sRUFBRSxJQUFJO1lBQ2IsS0FBSyxFQUFFLENBQUMsQ0FBQyxpQkFBaUI7U0FDM0I7UUFDRCxpQkFBaUIsRUFBRSxJQUFJO1FBQ3ZCLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtLQUN2QjtJQUVELFFBQVEsRUFBRTtRQUNSLFNBQVMsRUFBRSxJQUFJO1FBQ2YsZUFBZSxFQUFFLElBQUk7UUFDckIsWUFBWSxFQUFFLElBQUk7UUFDbEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixjQUFjLEVBQUUsSUFBSTtRQUNwQixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLG1CQUFtQixFQUFFLElBQUk7S0FDMUI7SUFFRCxPQUFPLEVBQUU7UUFDUCxFQUFFLEVBQUU7WUFDRixnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLHFCQUFxQixFQUFFLElBQUk7WUFDM0Isa0JBQWtCLEVBQUUsRUFBRTtZQUN0Qix1QkFBdUIsRUFBRSxFQUFFO1lBQzNCLGNBQWMsRUFBRSxJQUFJLEVBQUUsS0FBSztZQUMzQixTQUFTLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLElBQUk7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O1FBRUYsNEJBQTRCO1FBQzVCOzs7O1VBSUU7UUFFRix3QkFBd0I7UUFDeEI7Ozs7VUFJRTtRQUVGLGFBQWE7UUFDYixJQUFJLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMvQixVQUFVLEdBQUcsbUJBQW1CLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMzRSxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOOCouOCq+OCpuODs+ODiOmdnuS+neWtmOioreWumlxuICog44Gp44GuQVdT44Ki44Kr44Km44Oz44OI44Gn44KC5YaN54++5Y+v6IO944Gq6Kit5a6a44KS5o+Q5L6bXG4gKi9cblxuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2Vudmlyb25tZW50LWNvbmZpZyc7XG5pbXBvcnQgeyBGU3hPTlRBUFByZXNldHMgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2ZzeC1vbnRhcC1jb25maWcnO1xuaW1wb3J0IHsgU2VydmVybGVzc1ByZXNldHMgfSBmcm9tICcuLi9pbnRlcmZhY2VzL3NlcnZlcmxlc3MtY29uZmlnJztcblxuLyoqXG4gKiDln7rmnKzoqK3lrprjg4bjg7Pjg5fjg6zjg7zjg4hcbiAqIOOCouOCq+OCpuODs+ODiElE44KE44Oq44O844K444On44Oz44Gr5L6d5a2Y44GX44Gq44GE6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBCYXNlQWNjb3VudEFnbm9zdGljQ29uZmlnOiBQYXJ0aWFsPEVudmlyb25tZW50Q29uZmlnPiA9IHtcbiAgcHJvamVjdDoge1xuICAgIG5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gICAgdmVyc2lvbjogJzIuMC4wJyxcbiAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24tYXdhcmUgUkFHIFN5c3RlbSB3aXRoIEZTeCBmb3IgT05UQVAgSW50ZWdyYXRpb24nXG4gIH0sXG4gIFxuICBuZXR3b3JraW5nOiB7XG4gICAgdnBjQ2lkcjogJzEwLjAuMC4wLzE2JyxcbiAgICBhdmFpbGFiaWxpdHlab25lczogMixcbiAgICBuYXRHYXRld2F5czoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGNvdW50OiAxIC8vIOOCs+OCueODiOacgOmBqeWMluOBruOBn+OCgTHjgaTjgavoqK3lrppcbiAgICB9LFxuICAgIGVuYWJsZVZwY0Zsb3dMb2dzOiB0cnVlLFxuICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlXG4gIH0sXG4gIFxuICBzZWN1cml0eToge1xuICAgIGVuYWJsZVdhZjogdHJ1ZSxcbiAgICBlbmFibGVHdWFyZER1dHk6IHRydWUsXG4gICAgZW5hYmxlQ29uZmlnOiB0cnVlLFxuICAgIGVuYWJsZUNsb3VkVHJhaWw6IHRydWUsXG4gICAga21zS2V5Um90YXRpb246IHRydWUsXG4gICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICBlbmNyeXB0aW9uSW5UcmFuc2l0OiB0cnVlXG4gIH0sXG4gIFxuICBzdG9yYWdlOiB7XG4gICAgczM6IHtcbiAgICAgIGVuYWJsZVZlcnNpb25pbmc6IHRydWUsXG4gICAgICBlbmFibGVMaWZlY3ljbGVQb2xpY3k6IHRydWUsXG4gICAgICB0cmFuc2l0aW9uVG9JQURheXM6IDMwLFxuICAgICAgdHJhbnNpdGlvblRvR2xhY2llckRheXM6IDkwLFxuICAgICAgZXhwaXJhdGlvbkRheXM6IDI1NTUsIC8vIDflubRcbiAgICAgIGRvY3VtZW50czoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBlbmNyeXB0aW9uOiB0cnVlLFxuICAgICAgICB2ZXJzaW9uaW5nOiB0cnVlXG4gICAgICB9LFxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IHRydWVcbiAgICAgIH0sXG4gICAgICBlbWJlZGRpbmdzOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IGZhbHNlXG4gICAgICB9XG4gICAgfSxcbiAgICBmc3hPbnRhcDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICBzdG9yYWdlQ2FwYWNpdHk6IDEwMjQsXG4gICAgICB0aHJvdWdocHV0Q2FwYWNpdHk6IDEyOCxcbiAgICAgIGRlcGxveW1lbnRUeXBlOiAnU0lOR0xFX0FaXzEnLFxuICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogN1xuICAgIH1cbiAgfSxcbiAgXG4gIGRhdGFiYXNlOiB7XG4gICAgZHluYW1vZGI6IHtcbiAgICAgIGJpbGxpbmdNb2RlOiAnUEFZX1BFUl9SRVFVRVNUJyxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICBlbmFibGVTdHJlYW1zOiB0cnVlLFxuICAgICAgc3RyZWFtVmlld1R5cGU6ICdORVdfQU5EX09MRF9JTUFHRVMnXG4gICAgfSxcbiAgICBvcGVuc2VhcmNoOiB7XG4gICAgICBpbnN0YW5jZVR5cGU6ICd0My5zbWFsbC5zZWFyY2gnLFxuICAgICAgaW5zdGFuY2VDb3VudDogMSxcbiAgICAgIGRlZGljYXRlZE1hc3RlckVuYWJsZWQ6IGZhbHNlLFxuICAgICAgbWFzdGVySW5zdGFuY2VDb3VudDogMCxcbiAgICAgIGVic0VuYWJsZWQ6IHRydWUsXG4gICAgICB2b2x1bWVUeXBlOiAnZ3AzJyxcbiAgICAgIHZvbHVtZVNpemU6IDIwLFxuICAgICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIGVtYmVkZGluZzoge1xuICAgIGxhbWJkYToge1xuICAgICAgcnVudGltZTogJ3B5dGhvbjMuMTEnLFxuICAgICAgdGltZW91dDogMzAwLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVuYWJsZVhSYXlUcmFjaW5nOiB0cnVlLFxuICAgICAgZW5hYmxlRGVhZExldHRlclF1ZXVlOiB0cnVlXG4gICAgfSxcbiAgICBiYXRjaDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsIC8vIOODh+ODleOCqeODq+ODiOOBr+eEoeWKuVxuICAgICAgY29tcHV0ZUVudmlyb25tZW50VHlwZTogJ01BTkFHRUQnLFxuICAgICAgaW5zdGFuY2VUeXBlczogWydtNS5sYXJnZSddLFxuICAgICAgbWludkNwdXM6IDAsXG4gICAgICBtYXh2Q3B1czogMTAsXG4gICAgICBkZXNpcmVkdkNwdXM6IDBcbiAgICB9LFxuICAgIGVjczoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsIC8vIOODh+ODleOCqeODq+ODiOOBr+eEoeWKuVxuICAgICAgaW5zdGFuY2VUeXBlOiAnbTUubGFyZ2UnLFxuICAgICAgbWluQ2FwYWNpdHk6IDAsXG4gICAgICBtYXhDYXBhY2l0eTogNSxcbiAgICAgIGRlc2lyZWRDYXBhY2l0eTogMCxcbiAgICAgIGVuYWJsZU1hbmFnZWRJbnN0YW5jZTogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIGFwaToge1xuICAgIHRocm90dGxpbmc6IHtcbiAgICAgIHJhdGVMaW1pdDogMTAwMCxcbiAgICAgIGJ1cnN0TGltaXQ6IDIwMDBcbiAgICB9LFxuICAgIGNvcnM6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBhbGxvd09yaWdpbnM6IFsnKiddLCAvLyDmnKznlarnkrDlooPjgafjga/liLbpmZDjgZnjgotcbiAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFtei1EYXRlJywgJ1gtQXBpLUtleScsICdYLUFtei1TZWN1cml0eS1Ub2tlbiddXG4gICAgfSxcbiAgICBhdXRoZW50aWNhdGlvbjoge1xuICAgICAgY29nbml0b0VuYWJsZWQ6IGZhbHNlLCAvLyDni6zoh6roqo3oqLzjgpLkvb/nlKhcbiAgICAgIGFwaUtleVJlcXVpcmVkOiBmYWxzZVxuICAgIH1cbiAgfSxcbiAgXG4gIGFpOiB7XG4gICAgYmVkcm9jazoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vZGVsczogW1xuICAgICAgICAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgICAgJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJyxcbiAgICAgICAgJ2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxJ1xuICAgICAgXSxcbiAgICAgIG1heFRva2VuczogNDA5NixcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjdcbiAgICB9LFxuICAgIGVtYmVkZGluZzoge1xuICAgICAgbW9kZWw6ICdhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MScsXG4gICAgICBkaW1lbnNpb25zOiAxNTM2LFxuICAgICAgYmF0Y2hTaXplOiAxMDBcbiAgICB9XG4gIH0sXG4gIFxuICBtb25pdG9yaW5nOiB7XG4gICAgZW5hYmxlRGV0YWlsZWRNb25pdG9yaW5nOiB0cnVlLFxuICAgIGxvZ1JldGVudGlvbkRheXM6IDMwLFxuICAgIGVuYWJsZUFsYXJtczogdHJ1ZSxcbiAgICBhbGFybU5vdGlmaWNhdGlvbkVtYWlsOiAnJywgLy8g44OH44OX44Ot44Kk5pmC44Gr6Kit5a6aXG4gICAgZW5hYmxlRGFzaGJvYXJkOiB0cnVlLFxuICAgIGVuYWJsZVhSYXlUcmFjaW5nOiB0cnVlXG4gIH0sXG4gIFxuICBlbnRlcnByaXNlOiB7XG4gICAgZW5hYmxlQWNjZXNzQ29udHJvbDogdHJ1ZSxcbiAgICBlbmFibGVBdWRpdExvZ2dpbmc6IHRydWUsXG4gICAgZW5hYmxlQklBbmFseXRpY3M6IGZhbHNlLCAvLyDjg4fjg5Xjgqnjg6vjg4jjga/nhKHlirlcbiAgICBlbmFibGVNdWx0aVRlbmFudDogZmFsc2UsIC8vIOODh+ODleOCqeODq+ODiOOBr+eEoeWKuVxuICAgIGRhdGFSZXRlbnRpb25EYXlzOiAyNTU1IC8vIDflubRcbiAgfSxcbiAgXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogJycsIC8vIOeSsOWig+WIpeOBq+ioreWumlxuICAgIFByb2plY3Q6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gICAgT3duZXI6ICcnLCAvLyDjg4fjg5fjg63jgqTmmYLjgavoqK3lrppcbiAgICBDb3N0Q2VudGVyOiAnJywgLy8g44OH44OX44Ot44Kk5pmC44Gr6Kit5a6aXG4gICAgQmFja3VwOiAnUmVxdWlyZWQnLFxuICAgIE1vbml0b3Jpbmc6ICdFbmFibGVkJyxcbiAgICBDb21wbGlhbmNlOiAnUmVxdWlyZWQnLFxuICAgIERhdGFDbGFzc2lmaWNhdGlvbjogJ0ludGVybmFsJyxcbiAgICBSZWdpb246ICcnLCAvLyDjg6rjg7zjgrjjg6fjg7PliKXjgavoqK3lrppcbiAgICBUaW1lem9uZTogJ0FzaWEvVG9reW8nLFxuICAgIENvbXBsaWFuY2VGcmFtZXdvcms6ICdTT0MyLUdEUFInXG4gIH1cbn07XG5cbi8qKlxuICog55Kw5aKD5Yil6Kit5a6a44OG44Oz44OX44Os44O844OIXG4gKi9cbmV4cG9ydCBjb25zdCBFbnZpcm9ubWVudFRlbXBsYXRlcyA9IHtcbiAgZGV2ZWxvcG1lbnQ6IHtcbiAgICAuLi5CYXNlQWNjb3VudEFnbm9zdGljQ29uZmlnLFxuICAgIGVudmlyb25tZW50OiAnZGV2ZWxvcG1lbnQnLFxuICAgIFxuICAgIC8vIOmWi+eZuueSsOWig+eUqOOBruapn+iDveODleODqeOCsFxuICAgIGZlYXR1cmVzOiB7XG4gICAgICBlbmFibGVOZXR3b3JraW5nOiB0cnVlLFxuICAgICAgZW5hYmxlU2VjdXJpdHk6IHRydWUsXG4gICAgICBlbmFibGVTdG9yYWdlOiB0cnVlLFxuICAgICAgZW5hYmxlRGF0YWJhc2U6IHRydWUsXG4gICAgICBlbmFibGVFbWJlZGRpbmc6IHRydWUsXG4gICAgICBlbmFibGVBUEk6IHRydWUsXG4gICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgIGVuYWJsZU1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBlbmFibGVFbnRlcnByaXNlOiBmYWxzZSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv54Sh5Yq5XG4gICAgICAvLyBGU3jntbHlkIjmqZ/og73jg5Xjg6njgrDvvIjmlrDopo/ov73liqDvvIlcbiAgICAgIGVuYWJsZUZzeEludGVncmF0aW9uOiBmYWxzZSxcbiAgICAgIGVuYWJsZUZzeFNlcnZlcmxlc3NXb3JrZmxvd3M6IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4RXZlbnREcml2ZW46IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4QmF0Y2hQcm9jZXNzaW5nOiBmYWxzZSxcbiAgICAgIC8vIEFnZW50Q29yZee1seWQiOapn+iDveODleODqeOCsO+8iFRhc2sgMy4y6L+95Yqg77yJXG4gICAgICBlbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICAgIGVuYWJsZUh5YnJpZEFyY2hpdGVjdHVyZTogdHJ1ZSxcbiAgICAgIGVuYWJsZVVzZXJQcmVmZXJlbmNlczogdHJ1ZVxuICAgIH0sXG4gICAgXG4gICAgLy8gRlN4IGZvciBPTlRBUOioreWumu+8iOmWi+eZuueSsOWig+eUqO+8iVxuICAgIGZzeE9udGFwSW50ZWdyYXRpb246IHtcbiAgICAgIC4uLkZTeE9OVEFQUHJlc2V0cy5kZXZlbG9wbWVudCxcbiAgICAgIGVuYWJsZWQ6IGZhbHNlIC8vIOODh+ODleOCqeODq+ODiOOBr+eEoeWKueOAgeW/heimgeOBq+W/nOOBmOOBpuacieWKueWMllxuICAgIH0sXG4gICAgXG4gICAgLy8g44K144O844OQ44Os44K56Kit5a6a77yI6ZaL55m655Kw5aKD55So77yJXG4gICAgc2VydmVybGVzc0ludGVncmF0aW9uOiB7XG4gICAgICAuLi5TZXJ2ZXJsZXNzUHJlc2V0cy5kZXZlbG9wbWVudCxcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIHRhZ3M6IHtcbiAgICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcudGFncyxcbiAgICAgIEVudmlyb25tZW50OiAnZGV2ZWxvcG1lbnQnLFxuICAgICAgQnVzaW5lc3NDcml0aWNhbGl0eTogJ0xvdycsXG4gICAgICBEaXNhc3RlclJlY292ZXJ5OiAnTm90UmVxdWlyZWQnLFxuICAgICAgU2VjdXJpdHlMZXZlbDogJ1N0YW5kYXJkJyxcbiAgICAgIEVuY3J5cHRpb25SZXF1aXJlZDogJ1llcycsXG4gICAgICBBdWRpdFJlcXVpcmVkOiAnTm8nLFxuICAgICAgUGVyZm9ybWFuY2VMZXZlbDogJ1N0YW5kYXJkJyxcbiAgICAgIEF2YWlsYWJpbGl0eVRhcmdldDogJzk5LjAlJyxcbiAgICAgIFJQTzogJzI0aCcsXG4gICAgICBSVE86ICc0aCdcbiAgICB9XG4gIH0gYXMgRW52aXJvbm1lbnRDb25maWcsXG5cbiAgc3RhZ2luZzoge1xuICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcsXG4gICAgZW52aXJvbm1lbnQ6ICdzdGFnaW5nJyxcbiAgICBcbiAgICAvLyDjgrnjg4bjg7zjgrjjg7PjgrDnkrDlooPnlKjjga7mqZ/og73jg5Xjg6njgrBcbiAgICBmZWF0dXJlczoge1xuICAgICAgZW5hYmxlTmV0d29ya2luZzogdHJ1ZSxcbiAgICAgIGVuYWJsZVNlY3VyaXR5OiB0cnVlLFxuICAgICAgZW5hYmxlU3RvcmFnZTogdHJ1ZSxcbiAgICAgIGVuYWJsZURhdGFiYXNlOiB0cnVlLFxuICAgICAgZW5hYmxlRW1iZWRkaW5nOiB0cnVlLFxuICAgICAgZW5hYmxlQVBJOiB0cnVlLFxuICAgICAgZW5hYmxlQUk6IHRydWUsXG4gICAgICBlbmFibGVNb25pdG9yaW5nOiB0cnVlLFxuICAgICAgZW5hYmxlRW50ZXJwcmlzZTogdHJ1ZSwgLy8g44K544OG44O844K444Oz44Kw44Gn44Gv5pyJ5Yq5XG4gICAgICAvLyBGU3jntbHlkIjmqZ/og73jg5Xjg6njgrDvvIjmlrDopo/ov73liqDvvIlcbiAgICAgIGVuYWJsZUZzeEludGVncmF0aW9uOiBmYWxzZSxcbiAgICAgIGVuYWJsZUZzeFNlcnZlcmxlc3NXb3JrZmxvd3M6IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4RXZlbnREcml2ZW46IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4QmF0Y2hQcm9jZXNzaW5nOiBmYWxzZSxcbiAgICAgIC8vIEFnZW50Q29yZee1seWQiOapn+iDveODleODqeOCsO+8iFRhc2sgMy4y6L+95Yqg77yJXG4gICAgICBlbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICAgIGVuYWJsZUh5YnJpZEFyY2hpdGVjdHVyZTogdHJ1ZSxcbiAgICAgIGVuYWJsZVVzZXJQcmVmZXJlbmNlczogdHJ1ZVxuICAgIH0sXG4gICAgXG4gICAgLy8gRlN4IGZvciBPTlRBUOioreWumu+8iOOCueODhuODvOOCuOODs+OCsOeSsOWig+eUqO+8iVxuICAgIGZzeE9udGFwSW50ZWdyYXRpb246IHtcbiAgICAgIC4uLkZTeE9OVEFQUHJlc2V0cy5kZXZlbG9wbWVudCwgLy8g6ZaL55m66Kit5a6a44KS44OZ44O844K544Gr44GZ44KL44GM44K144Kk44K644KS6Kq/5pW0XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgZmlsZVN5c3RlbToge1xuICAgICAgICAuLi5GU3hPTlRBUFByZXNldHMuZGV2ZWxvcG1lbnQuZmlsZVN5c3RlbSxcbiAgICAgICAgc3RvcmFnZUNhcGFjaXR5OiAyMDQ4LCAvLyDplovnmbrjgojjgorlpKfjgY3jgY9cbiAgICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiAyNTZcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIC8vIOOCteODvOODkOODrOOCueioreWumu+8iOOCueODhuODvOOCuOODs+OCsOeSsOWig+eUqO+8iVxuICAgIHNlcnZlcmxlc3NJbnRlZ3JhdGlvbjoge1xuICAgICAgLi4uU2VydmVybGVzc1ByZXNldHMuZGV2ZWxvcG1lbnQsXG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgbGFtYmRhOiB7XG4gICAgICAgIC4uLlNlcnZlcmxlc3NQcmVzZXRzLmRldmVsb3BtZW50LmxhbWJkYSxcbiAgICAgICAgY29tbW9uOiB7XG4gICAgICAgICAgLi4uU2VydmVybGVzc1ByZXNldHMuZGV2ZWxvcG1lbnQubGFtYmRhLmNvbW1vbixcbiAgICAgICAgICBtZW1vcnlTaXplOiA1MTIsIC8vIOmWi+eZuuOCiOOCiuWkp+OBjeOBj1xuICAgICAgICAgIHRpbWVvdXQ6IDYwXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIHRhZ3M6IHtcbiAgICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcudGFncyxcbiAgICAgIEVudmlyb25tZW50OiAnc3RhZ2luZycsXG4gICAgICBCdXNpbmVzc0NyaXRpY2FsaXR5OiAnTWVkaXVtJyxcbiAgICAgIERpc2FzdGVyUmVjb3Zlcnk6ICdSZXF1aXJlZCcsXG4gICAgICBTZWN1cml0eUxldmVsOiAnSGlnaCcsXG4gICAgICBFbmNyeXB0aW9uUmVxdWlyZWQ6ICdZZXMnLFxuICAgICAgQXVkaXRSZXF1aXJlZDogJ1llcycsXG4gICAgICBQZXJmb3JtYW5jZUxldmVsOiAnSGlnaCcsXG4gICAgICBBdmFpbGFiaWxpdHlUYXJnZXQ6ICc5OS41JScsXG4gICAgICBSUE86ICc0aCcsXG4gICAgICBSVE86ICcyaCdcbiAgICB9XG4gIH0gYXMgRW52aXJvbm1lbnRDb25maWcsXG5cbiAgcHJvZHVjdGlvbjoge1xuICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcsXG4gICAgZW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcbiAgICBcbiAgICAvLyDmnKznlarnkrDlooPnlKjjga7mqZ/og73jg5Xjg6njgrBcbiAgICBmZWF0dXJlczoge1xuICAgICAgZW5hYmxlTmV0d29ya2luZzogdHJ1ZSxcbiAgICAgIGVuYWJsZVNlY3VyaXR5OiB0cnVlLFxuICAgICAgZW5hYmxlU3RvcmFnZTogdHJ1ZSxcbiAgICAgIGVuYWJsZURhdGFiYXNlOiB0cnVlLFxuICAgICAgZW5hYmxlRW1iZWRkaW5nOiB0cnVlLFxuICAgICAgZW5hYmxlQVBJOiB0cnVlLFxuICAgICAgZW5hYmxlQUk6IHRydWUsXG4gICAgICBlbmFibGVNb25pdG9yaW5nOiB0cnVlLFxuICAgICAgZW5hYmxlRW50ZXJwcmlzZTogdHJ1ZSxcbiAgICAgIC8vIEZTeOe1seWQiOapn+iDveODleODqeOCsO+8iOaWsOimj+i/veWKoO+8iVxuICAgICAgZW5hYmxlRnN4SW50ZWdyYXRpb246IGZhbHNlLFxuICAgICAgZW5hYmxlRnN4U2VydmVybGVzc1dvcmtmbG93czogZmFsc2UsXG4gICAgICBlbmFibGVGc3hFdmVudERyaXZlbjogZmFsc2UsXG4gICAgICBlbmFibGVGc3hCYXRjaFByb2Nlc3Npbmc6IGZhbHNlLFxuICAgICAgLy8gQWdlbnRDb3Jl57Wx5ZCI5qmf6IO944OV44Op44Kw77yIVGFzayAzLjLov73liqDvvIlcbiAgICAgIGVuYWJsZUFnZW50Q29yZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgZW5hYmxlSHlicmlkQXJjaGl0ZWN0dXJlOiB0cnVlLFxuICAgICAgZW5hYmxlVXNlclByZWZlcmVuY2VzOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyBGU3ggZm9yIE9OVEFQ6Kit5a6a77yI5pys55Wq55Kw5aKD55So77yJXG4gICAgZnN4T250YXBJbnRlZ3JhdGlvbjoge1xuICAgICAgLi4uRlN4T05UQVBQcmVzZXRzLnByb2R1Y3Rpb24sXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyDjgrXjg7zjg5Djg6zjgrnoqK3lrprvvIjmnKznlarnkrDlooPnlKjvvIlcbiAgICBzZXJ2ZXJsZXNzSW50ZWdyYXRpb246IHtcbiAgICAgIC4uLlNlcnZlcmxlc3NQcmVzZXRzLnByb2R1Y3Rpb24sXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyDmnKznlarnkrDlooPnlKjjga7jg43jg4Pjg4jjg6/jg7zjgq/oqK3lrppcbiAgICBuZXR3b3JraW5nOiB7XG4gICAgICAuLi5CYXNlQWNjb3VudEFnbm9zdGljQ29uZmlnLm5ldHdvcmtpbmcsXG4gICAgICBhdmFpbGFiaWxpdHlab25lczogMywgLy8g5pys55Wq44Gn44GvM0FaXG4gICAgICBuYXRHYXRld2F5czoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBjb3VudDogMiAvLyDmnKznlarjgafjga/lhpfplbfljJZcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIC8vIOacrOeVqueSsOWig+eUqOOBruODh+ODvOOCv+ODmeODvOOCueioreWumlxuICAgIGRhdGFiYXNlOiB7XG4gICAgICAuLi5CYXNlQWNjb3VudEFnbm9zdGljQ29uZmlnLmRhdGFiYXNlLFxuICAgICAgb3BlbnNlYXJjaDoge1xuICAgICAgICAuLi5CYXNlQWNjb3VudEFnbm9zdGljQ29uZmlnLmRhdGFiYXNlLm9wZW5zZWFyY2gsXG4gICAgICAgIGluc3RhbmNlVHlwZTogJ202Zy5sYXJnZS5zZWFyY2gnLFxuICAgICAgICBpbnN0YW5jZUNvdW50OiAzLCAvLyDmnKznlarjgafjga8z44OO44O844OJXG4gICAgICAgIGRlZGljYXRlZE1hc3RlckVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1hc3Rlckluc3RhbmNlQ291bnQ6IDMsXG4gICAgICAgIHZvbHVtZVNpemU6IDEwMCAvLyDmnKznlarjgafjga/lpKflrrnph49cbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIHRhZ3M6IHtcbiAgICAgIC4uLkJhc2VBY2NvdW50QWdub3N0aWNDb25maWcudGFncyxcbiAgICAgIEVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICBCdXNpbmVzc0NyaXRpY2FsaXR5OiAnSGlnaCcsXG4gICAgICBEaXNhc3RlclJlY292ZXJ5OiAnUmVxdWlyZWQnLFxuICAgICAgU2VjdXJpdHlMZXZlbDogJ0NyaXRpY2FsJyxcbiAgICAgIEVuY3J5cHRpb25SZXF1aXJlZDogJ1llcycsXG4gICAgICBBdWRpdFJlcXVpcmVkOiAnWWVzJyxcbiAgICAgIFBlcmZvcm1hbmNlTGV2ZWw6ICdDcml0aWNhbCcsXG4gICAgICBBdmFpbGFiaWxpdHlUYXJnZXQ6ICc5OS45JScsXG4gICAgICBSUE86ICcxaCcsXG4gICAgICBSVE86ICczMG0nXG4gICAgfVxuICB9IGFzIEVudmlyb25tZW50Q29uZmlnXG59O1xuXG4vKipcbiAqIOapn+iDveWIpeOCquODl+OCt+ODp+ODs+ioreWumlxuICog44Om44O844K244O844GM5YCL5Yil44Gr5pyJ5Yq55YyWL+eEoeWKueWMluOBp+OBjeOCi+apn+iDveOBruioreWumlxuICovXG5leHBvcnQgY29uc3QgRmVhdHVyZU9wdGlvbnMgPSB7XG4gIC8vIEZTeCBmb3IgT05UQVDntbHlkIjjgqrjg5fjgrfjg6fjg7NcbiAgZnN4T250YXBJbnRlZ3JhdGlvbjoge1xuICAgIG1pbmltYWw6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBmaWxlU3lzdGVtOiB7XG4gICAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCxcbiAgICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiAxMjgsXG4gICAgICAgIGRlcGxveW1lbnRUeXBlOiAnU0lOR0xFX0FaXzEnIGFzIGNvbnN0LFxuICAgICAgICBhdXRvRGV0ZWN0TmV0d29ya2luZzogdHJ1ZSxcbiAgICAgICAgYXV0b0NvbmZpZ3VyZVJvdXRpbmc6IHRydWUsXG4gICAgICAgIGF1dG9TY2FsaW5nOiB7IGVuYWJsZWQ6IGZhbHNlLCBtaW5DYXBhY2l0eTogMTAyNCwgbWF4Q2FwYWNpdHk6IDIwNDgsIHRhcmdldFV0aWxpemF0aW9uOiA4MCB9XG4gICAgICB9LFxuICAgICAgczNBY2Nlc3NQb2ludHM6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgYXV0b0NyZWF0ZUFjY2Vzc1BvaW50czogdHJ1ZSxcbiAgICAgICAgYWNjZXNzUG9pbnROYW1pbmdQYXR0ZXJuOiBcIiR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LSR7cHVycG9zZX1cIixcbiAgICAgICAgYWNjZXNzUG9pbnRzOiBbXG4gICAgICAgICAgeyBuYW1lOiAnY2hhdC1oaXN0b3J5JywgcHVycG9zZTogJ2NoYXQtaGlzdG9yeScgYXMgY29uc3QgfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgdGllcmluZzogeyBlbmFibGVkOiBmYWxzZSB9LFxuICAgICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgICAgbW9uaXRvcmluZzogeyBlbmFibGVkOiB0cnVlLCBtZXRyaWNzQ29sbGVjdGlvbjogdHJ1ZSwgZGV0YWlsZWRNb25pdG9yaW5nOiBmYWxzZSB9LFxuICAgICAgICBhdXRvT3B0aW1pemF0aW9uOiB7IGVuYWJsZWQ6IGZhbHNlLCB0aHJvdWdocHV0T3B0aW1pemF0aW9uOiBmYWxzZSwgc3RvcmFnZU9wdGltaXphdGlvbjogZmFsc2UsIHBlcmZvcm1hbmNlTW9kZTogJ0NPU1RfT1BUSU1JWkVEJyBhcyBjb25zdCB9LFxuICAgICAgICBjYWNoZTogeyBlbmFibGVkOiBmYWxzZSwgc2l6ZTogMCwgdHlwZTogJ1JFQUQnIGFzIGNvbnN0IH1cbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIHN0YW5kYXJkOiB7XG4gICAgICAuLi5GU3hPTlRBUFByZXNldHMuZGV2ZWxvcG1lbnQsXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICBhZHZhbmNlZDoge1xuICAgICAgLi4uRlN4T05UQVBQcmVzZXRzLnByb2R1Y3Rpb24sXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgLy8g44K144O844OQ44Os44K557Wx5ZCI44Kq44OX44K344On44OzXG4gIHNlcnZlcmxlc3NJbnRlZ3JhdGlvbjoge1xuICAgIG1pbmltYWw6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBzdGVwRnVuY3Rpb25zOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlIC8vIOacgOWwj+ani+aIkOOBp+OBr+eEoeWKuVxuICAgICAgfSxcbiAgICAgIGV2ZW50QnJpZGdlOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGN1c3RvbUV2ZW50QnVzOiB7IGVuYWJsZWQ6IGZhbHNlIH0sXG4gICAgICAgIHJ1bGVzOiBbXSxcbiAgICAgICAgc2NoZWR1bGVzOiBbXVxuICAgICAgfSxcbiAgICAgIHNxczoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBxdWV1ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY2hhdC1wcm9jZXNzaW5nJyxcbiAgICAgICAgICAgIHB1cnBvc2U6ICdjaGF0LXByb2Nlc3NpbmcnIGFzIGNvbnN0LFxuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgdmlzaWJpbGl0eVRpbWVvdXRTZWNvbmRzOiAzMCxcbiAgICAgICAgICAgICAgbWVzc2FnZVJldGVudGlvblBlcmlvZDogMTIwOTYwMCwgLy8gMTTml6VcbiAgICAgICAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW5jcnlwdGlvbjogeyBlbmFibGVkOiB0cnVlIH1cbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICBzbnM6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UgLy8g5pyA5bCP5qeL5oiQ44Gn44Gv54Sh5Yq5XG4gICAgICB9LFxuICAgICAgbGFtYmRhOiB7XG4gICAgICAgIGNvbW1vbjoge1xuICAgICAgICAgIHJ1bnRpbWU6ICdub2RlanMxOC54JyxcbiAgICAgICAgICB0aW1lb3V0OiAzMCxcbiAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgZW5hYmxlWFJheVRyYWNpbmc6IGZhbHNlLFxuICAgICAgICAgIGVuYWJsZURlYWRMZXR0ZXJRdWV1ZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBmdW5jdGlvbnM6IFtdLFxuICAgICAgICBsYXllcnM6IFtdLFxuICAgICAgICBlbnZpcm9ubWVudDogeyBhdXRvSW5qZWN0OiB0cnVlLCB2YXJpYWJsZXM6IHt9IH1cbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIHN0YW5kYXJkOiB7XG4gICAgICAuLi5TZXJ2ZXJsZXNzUHJlc2V0cy5kZXZlbG9wbWVudCxcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIGFkdmFuY2VkOiB7XG4gICAgICAuLi5TZXJ2ZXJsZXNzUHJlc2V0cy5wcm9kdWN0aW9uLFxuICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIC8vIOODkeODleOCqeODvOODnuODs+OCueacgOmBqeWMluOCquODl+OCt+ODp+ODs1xuICBwZXJmb3JtYW5jZU9wdGltaXphdGlvbjoge1xuICAgIGRpc2FibGVkOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZVxuICAgIH0sXG4gICAgXG4gICAgYmFzaWM6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBtb25pdG9yaW5nOiB0cnVlLFxuICAgICAgYXV0b09wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICBjYWNoaW5nOiBmYWxzZVxuICAgIH0sXG4gICAgXG4gICAgYWR2YW5jZWQ6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBtb25pdG9yaW5nOiB0cnVlLFxuICAgICAgYXV0b09wdGltaXphdGlvbjogdHJ1ZSxcbiAgICAgIGNhY2hpbmc6IHRydWUsXG4gICAgICBwcmVkaWN0aXZlU2NhbGluZzogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIC8vIOOCs+OCueODiOacgOmBqeWMluOCquODl+OCt+ODp+ODs1xuICBjb3N0T3B0aW1pemF0aW9uOiB7XG4gICAgZGlzYWJsZWQ6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBcbiAgICBiYXNpYzoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vbml0b3Jpbmc6IHRydWUsXG4gICAgICBidWRnZXRBbGVydHM6IHRydWUsXG4gICAgICBsaWZlY3ljbGVQb2xpY2llczogdHJ1ZSxcbiAgICAgIHJpZ2h0U2l6aW5nOiBmYWxzZVxuICAgIH0sXG4gICAgXG4gICAgYWR2YW5jZWQ6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBtb25pdG9yaW5nOiB0cnVlLFxuICAgICAgYnVkZ2V0QWxlcnRzOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUG9saWNpZXM6IHRydWUsXG4gICAgICByaWdodFNpemluZzogdHJ1ZSxcbiAgICAgIHByZWRpY3RpdmVPcHRpbWl6YXRpb246IHRydWUsXG4gICAgICBhdXRvbWF0ZWRPcHRpbWl6YXRpb246IHRydWVcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICog6Kit5a6a44OQ44Oq44OH44O844K344On44Oz6Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUFjY291bnRBZ25vc3RpY0NvbmZpZyhjb25maWc6IFBhcnRpYWw8RW52aXJvbm1lbnRDb25maWc+KToge1xuICBpc1ZhbGlkOiBib29sZWFuO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAvLyDlv4XpoIjjg5XjgqPjg7zjg6vjg4njga7mpJzoqLxcbiAgaWYgKCFjb25maWcuZW52aXJvbm1lbnQpIHtcbiAgICBlcnJvcnMucHVzaCgnRW52aXJvbm1lbnQgaXMgcmVxdWlyZWQnKTtcbiAgfVxuXG4gIGlmICghY29uZmlnLnJlZ2lvbikge1xuICAgIGVycm9ycy5wdXNoKCdSZWdpb24gaXMgcmVxdWlyZWQnKTtcbiAgfVxuXG4gIGlmICghY29uZmlnLnByb2plY3Q/Lm5hbWUpIHtcbiAgICBlcnJvcnMucHVzaCgnUHJvamVjdCBuYW1lIGlzIHJlcXVpcmVkJyk7XG4gIH1cblxuICAvLyBGU3ggT05UQVDoqK3lrprjga7mpJzoqLzvvIjkuIDmmYLnmoTjgavnhKHlirnljJbvvIlcbiAgaWYgKGZhbHNlICYmIGNvbmZpZy5zdG9yYWdlPy5mc3hPbnRhcD8uZW5hYmxlZCkge1xuICAgIGlmICghY29uZmlnLnN0b3JhZ2UuZnN4T250YXApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRlN4IE9OVEFQ6Kit5a6a44GM6KaL44Gk44GL44KK44G+44Gb44KTJyk7XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKCfinIUgRlN4IE9OVEFQ6Kit5a6a5qSc6Ki85a6M5LqGJyk7XG4gIH1cblxuICAvLyDjgrXjg7zjg5Djg6zjgrnoqK3lrprjga7mpJzoqLzvvIjkuIDmmYLnmoTjgavjgrPjg6Hjg7Pjg4jjgqLjgqbjg4jvvIlcbiAgLypcbiAgaWYgKGNvbmZpZy5mZWF0dXJlcz8uZW5hYmxlU2VydmVybGVzc0ludGVncmF0aW9uICYmIGNvbmZpZy5zZXJ2ZXJsZXNzSW50ZWdyYXRpb24/LmVuYWJsZWQpIHtcbiAgICBpZiAoY29uZmlnLnNlcnZlcmxlc3NJbnRlZ3JhdGlvbi5sYW1iZGE/LmNvbW1vbj8udGltZW91dCA+IDkwMCkge1xuICAgICAgd2FybmluZ3MucHVzaCgnTGFtYmRhIHRpbWVvdXQgc2hvdWxkIG5vdCBleGNlZWQgMTUgbWludXRlcyAoOTAwIHNlY29uZHMpJyk7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5zZXJ2ZXJsZXNzSW50ZWdyYXRpb24ubGFtYmRhPy5jb21tb24/Lm1lbW9yeVNpemUgPiAxMDI0MCkge1xuICAgICAgd2FybmluZ3MucHVzaCgnTGFtYmRhIG1lbW9yeSBzaXplIHNob3VsZCBub3QgZXhjZWVkIDEwLDI0MCBNQiB1bmxlc3Mgc3BlY2lmaWNhbGx5IHJlcXVpcmVkJyk7XG4gICAgfVxuICB9XG4gICovXG5cbiAgLy8g55Kw5aKD5Yil44Gu5qSc6Ki8XG4gIGlmIChjb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJykge1xuICAgIGlmIChjb25maWcubmV0d29ya2luZz8uYXZhaWxhYmlsaXR5Wm9uZXMgPCAyKSB7XG4gICAgICBlcnJvcnMucHVzaCgnUHJvZHVjdGlvbiBlbnZpcm9ubWVudCBzaG91bGQgdXNlIGF0IGxlYXN0IDIgYXZhaWxhYmlsaXR5IHpvbmVzJyk7XG4gICAgfVxuXG4gICAgaWYgKCFjb25maWcuc2VjdXJpdHk/LmVuYWJsZUNsb3VkVHJhaWwpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdDbG91ZFRyYWlsIHNob3VsZCBiZSBlbmFibGVkIGluIHByb2R1Y3Rpb24gZW52aXJvbm1lbnQnKTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbmZpZy5tb25pdG9yaW5nPy5lbmFibGVEZXRhaWxlZE1vbml0b3JpbmcpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ0RldGFpbGVkIG1vbml0b3JpbmcgaXMgcmVjb21tZW5kZWQgZm9yIHByb2R1Y3Rpb24gZW52aXJvbm1lbnQnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGlzVmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgZXJyb3JzLFxuICAgIHdhcm5pbmdzXG4gIH07XG59XG5cbi8qKlxuICog6Kit5a6a44Oe44O844K46Zai5pWwXG4gKiDjg5njg7zjgrnoqK3lrprjgavjgqvjgrnjgr/jg6DoqK3lrprjgpLjg57jg7zjgrjjgZnjgotcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlQ29uZmlndXJhdGlvbnMoXG4gIGJhc2VDb25maWc6IFBhcnRpYWw8RW52aXJvbm1lbnRDb25maWc+LFxuICBjdXN0b21Db25maWc6IFBhcnRpYWw8RW52aXJvbm1lbnRDb25maWc+XG4pOiBFbnZpcm9ubWVudENvbmZpZyB7XG4gIC8vIERlZXAgbWVyZ2UgaW1wbGVtZW50YXRpb25cbiAgY29uc3QgbWVyZ2VkID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShiYXNlQ29uZmlnKSk7XG4gIFxuICBmdW5jdGlvbiBkZWVwTWVyZ2UodGFyZ2V0OiBhbnksIHNvdXJjZTogYW55KTogYW55IHtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiBzb3VyY2UpIHtcbiAgICAgIGlmIChzb3VyY2Vba2V5XSAmJiB0eXBlb2Ygc291cmNlW2tleV0gPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHNvdXJjZVtrZXldKSkge1xuICAgICAgICBpZiAoIXRhcmdldFtrZXldKSB0YXJnZXRba2V5XSA9IHt9O1xuICAgICAgICBkZWVwTWVyZ2UodGFyZ2V0W2tleV0sIHNvdXJjZVtrZXldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4gZGVlcE1lcmdlKG1lcmdlZCwgY3VzdG9tQ29uZmlnKSBhcyBFbnZpcm9ubWVudENvbmZpZztcbn1cblxuLyoqXG4gKiDnkrDlooPoqK3lrprjg5XjgqHjgq/jg4jjg6rjg7zplqLmlbBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVudmlyb25tZW50Q29uZmlnKFxuICBlbnZpcm9ubWVudDogJ2RldmVsb3BtZW50JyB8ICdzdGFnaW5nJyB8ICdwcm9kdWN0aW9uJyxcbiAgcmVnaW9uOiBzdHJpbmcsXG4gIGN1c3RvbU9wdGlvbnM/OiB7XG4gICAgZnN4T250YXBMZXZlbD86ICdkaXNhYmxlZCcgfCAnbWluaW1hbCcgfCAnc3RhbmRhcmQnIHwgJ2FkdmFuY2VkJztcbiAgICBzZXJ2ZXJsZXNzTGV2ZWw/OiAnZGlzYWJsZWQnIHwgJ21pbmltYWwnIHwgJ3N0YW5kYXJkJyB8ICdhZHZhbmNlZCc7XG4gICAgcGVyZm9ybWFuY2VMZXZlbD86ICdkaXNhYmxlZCcgfCAnYmFzaWMnIHwgJ2FkdmFuY2VkJztcbiAgICBjb3N0T3B0aW1pemF0aW9uTGV2ZWw/OiAnZGlzYWJsZWQnIHwgJ2Jhc2ljJyB8ICdhZHZhbmNlZCc7XG4gICAgY3VzdG9tQ29uZmlnPzogUGFydGlhbDxFbnZpcm9ubWVudENvbmZpZz47XG4gIH1cbik6IEVudmlyb25tZW50Q29uZmlnIHtcbiAgLy8g44OZ44O844K56Kit5a6a44KS5Y+W5b6XXG4gIGxldCBiYXNlQ29uZmlnID0gRW52aXJvbm1lbnRUZW1wbGF0ZXNbZW52aXJvbm1lbnRdO1xuICBcbiAgLy8g44Oq44O844K444On44Oz44KS6Kit5a6aXG4gIGJhc2VDb25maWcgPSB7XG4gICAgLi4uYmFzZUNvbmZpZyxcbiAgICByZWdpb24sXG4gICAgdGFnczoge1xuICAgICAgLi4uYmFzZUNvbmZpZy50YWdzLFxuICAgICAgUmVnaW9uOiByZWdpb25cbiAgICB9XG4gIH07XG5cbiAgLy8g44Kr44K544K/44Og44Kq44OX44K344On44Oz44KS6YGp55SoXG4gIGlmIChjdXN0b21PcHRpb25zKSB7XG4gICAgLy8gRlN4IGZvciBPTlRBUOioreWumu+8iOS4gOaZgueahOOBq+OCs+ODoeODs+ODiOOCouOCpuODiO+8iVxuICAgIC8qXG4gICAgaWYgKGN1c3RvbU9wdGlvbnMuZnN4T250YXBMZXZlbCAmJiBjdXN0b21PcHRpb25zLmZzeE9udGFwTGV2ZWwgIT09ICdkaXNhYmxlZCcpIHtcbiAgICAgIGJhc2VDb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4SW50ZWdyYXRpb24gPSB0cnVlO1xuICAgICAgLy8gYmFzZUNvbmZpZy5mc3hPbnRhcEludGVncmF0aW9uID0ge1xuICAgICAgLy8gICAuLi5GZWF0dXJlT3B0aW9ucy5mc3hPbnRhcEludGVncmF0aW9uW2N1c3RvbU9wdGlvbnMuZnN4T250YXBMZXZlbF0sXG4gICAgICAvLyAgIGVuYWJsZWQ6IHRydWVcbiAgICAgIC8vIH07XG4gICAgfSBlbHNlIGlmIChjdXN0b21PcHRpb25zLmZzeE9udGFwTGV2ZWwgPT09ICdkaXNhYmxlZCcpIHtcbiAgICAgIGJhc2VDb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4SW50ZWdyYXRpb24gPSBmYWxzZTtcbiAgICAgIC8vIGlmIChiYXNlQ29uZmlnLmZzeE9udGFwSW50ZWdyYXRpb24pIHtcbiAgICAgIC8vICAgYmFzZUNvbmZpZy5mc3hPbnRhcEludGVncmF0aW9uLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgIC8vIH1cbiAgICB9XG4gICAgKi9cblxuICAgIC8vIOOCteODvOODkOODrOOCueioreWumu+8iOS4gOaZgueahOOBq+OCs+ODoeODs+ODiOOCouOCpuODiO+8iVxuICAgIC8qXG4gICAgaWYgKGN1c3RvbU9wdGlvbnMuc2VydmVybGVzc0xldmVsICYmIGN1c3RvbU9wdGlvbnMuc2VydmVybGVzc0xldmVsICE9PSAnZGlzYWJsZWQnKSB7XG4gICAgICBiYXNlQ29uZmlnLmZlYXR1cmVzLmVuYWJsZVNlcnZlcmxlc3NJbnRlZ3JhdGlvbiA9IHRydWU7XG4gICAgICBiYXNlQ29uZmlnLnNlcnZlcmxlc3NJbnRlZ3JhdGlvbiA9IHtcbiAgICAgICAgLi4uRmVhdHVyZU9wdGlvbnMuc2VydmVybGVzc0ludGVncmF0aW9uW2N1c3RvbU9wdGlvbnMuc2VydmVybGVzc0xldmVsXSxcbiAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKGN1c3RvbU9wdGlvbnMuc2VydmVybGVzc0xldmVsID09PSAnZGlzYWJsZWQnKSB7XG4gICAgICBiYXNlQ29uZmlnLmZlYXR1cmVzLmVuYWJsZVNlcnZlcmxlc3NJbnRlZ3JhdGlvbiA9IGZhbHNlO1xuICAgICAgaWYgKGJhc2VDb25maWcuc2VydmVybGVzc0ludGVncmF0aW9uKSB7XG4gICAgICAgIGJhc2VDb25maWcuc2VydmVybGVzc0ludGVncmF0aW9uLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgKi9cblxuICAgIC8vIOODkeODleOCqeODvOODnuODs+OCueacgOmBqeWMluioreWumu+8iOS4gOaZgueahOOBq+OCs+ODoeODs+ODiOOCouOCpuODiO+8iVxuICAgIC8qXG4gICAgaWYgKGN1c3RvbU9wdGlvbnMucGVyZm9ybWFuY2VMZXZlbCkge1xuICAgICAgYmFzZUNvbmZpZy5mZWF0dXJlcy5lbmFibGVQZXJmb3JtYW5jZU9wdGltaXphdGlvbiA9IGN1c3RvbU9wdGlvbnMucGVyZm9ybWFuY2VMZXZlbCAhPT0gJ2Rpc2FibGVkJztcbiAgICB9XG4gICAgKi9cblxuICAgIC8vIOOCs+OCueODiOacgOmBqeWMluioreWumu+8iOS4gOaZgueahOOBq+OCs+ODoeODs+ODiOOCouOCpuODiO+8iVxuICAgIC8qXG4gICAgaWYgKGN1c3RvbU9wdGlvbnMuY29zdE9wdGltaXphdGlvbkxldmVsKSB7XG4gICAgICBiYXNlQ29uZmlnLmZlYXR1cmVzLmVuYWJsZUNvc3RPcHRpbWl6YXRpb24gPSBjdXN0b21PcHRpb25zLmNvc3RPcHRpbWl6YXRpb25MZXZlbCAhPT0gJ2Rpc2FibGVkJztcbiAgICB9XG4gICAgKi9cblxuICAgIC8vIOOCq+OCueOCv+ODoOioreWumuOCkuODnuODvOOCuFxuICAgIGlmIChjdXN0b21PcHRpb25zLmN1c3RvbUNvbmZpZykge1xuICAgICAgYmFzZUNvbmZpZyA9IG1lcmdlQ29uZmlndXJhdGlvbnMoYmFzZUNvbmZpZywgY3VzdG9tT3B0aW9ucy5jdXN0b21Db25maWcpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiYXNlQ29uZmlnO1xufSJdfQ==