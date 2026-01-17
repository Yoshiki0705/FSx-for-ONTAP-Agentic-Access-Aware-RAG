/**
 * アカウント非依存設定
 * どのAWSアカウントでも再現可能な設定を提供
 */

import { EnvironmentConfig } from '../interfaces/environment-config';
import { FSxONTAPPresets } from '../interfaces/fsx-ontap-config';
import { ServerlessPresets } from '../interfaces/serverless-config';

/**
 * 基本設定テンプレート
 * アカウントIDやリージョンに依存しない設定
 */
export const BaseAccountAgnosticConfig: Partial<EnvironmentConfig> = {
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
export const EnvironmentTemplates = {
  development: {
    ...BaseAccountAgnosticConfig,
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
      ...FSxONTAPPresets.development,
      enabled: false // デフォルトは無効、必要に応じて有効化
    },
    
    // サーバレス設定（開発環境用）
    serverlessIntegration: {
      ...ServerlessPresets.development,
      enabled: true
    },
    
    tags: {
      ...BaseAccountAgnosticConfig.tags,
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
  } as EnvironmentConfig,

  staging: {
    ...BaseAccountAgnosticConfig,
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
      ...FSxONTAPPresets.development, // 開発設定をベースにするがサイズを調整
      enabled: true,
      fileSystem: {
        ...FSxONTAPPresets.development.fileSystem,
        storageCapacity: 2048, // 開発より大きく
        throughputCapacity: 256
      }
    },
    
    // サーバレス設定（ステージング環境用）
    serverlessIntegration: {
      ...ServerlessPresets.development,
      enabled: true,
      lambda: {
        ...ServerlessPresets.development.lambda,
        common: {
          ...ServerlessPresets.development.lambda.common,
          memorySize: 512, // 開発より大きく
          timeout: 60
        }
      }
    },
    
    tags: {
      ...BaseAccountAgnosticConfig.tags,
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
  } as EnvironmentConfig,

  production: {
    ...BaseAccountAgnosticConfig,
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
      ...FSxONTAPPresets.production,
      enabled: true
    },
    
    // サーバレス設定（本番環境用）
    serverlessIntegration: {
      ...ServerlessPresets.production,
      enabled: true
    },
    
    // 本番環境用のネットワーク設定
    networking: {
      ...BaseAccountAgnosticConfig.networking,
      availabilityZones: 3, // 本番では3AZ
      natGateways: {
        enabled: true,
        count: 2 // 本番では冗長化
      }
    },
    
    // 本番環境用のデータベース設定
    database: {
      ...BaseAccountAgnosticConfig.database,
      opensearch: {
        ...BaseAccountAgnosticConfig.database.opensearch,
        instanceType: 'm6g.large.search',
        instanceCount: 3, // 本番では3ノード
        dedicatedMasterEnabled: true,
        masterInstanceCount: 3,
        volumeSize: 100 // 本番では大容量
      }
    },
    
    tags: {
      ...BaseAccountAgnosticConfig.tags,
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
  } as EnvironmentConfig
};

/**
 * 機能別オプション設定
 * ユーザーが個別に有効化/無効化できる機能の設定
 */
export const FeatureOptions = {
  // FSx for ONTAP統合オプション
  fsxOntapIntegration: {
    minimal: {
      enabled: true,
      fileSystem: {
        storageCapacity: 1024,
        throughputCapacity: 128,
        deploymentType: 'SINGLE_AZ_1' as const,
        autoDetectNetworking: true,
        autoConfigureRouting: true,
        autoScaling: { enabled: false, minCapacity: 1024, maxCapacity: 2048, targetUtilization: 80 }
      },
      s3AccessPoints: {
        enabled: true,
        autoCreateAccessPoints: true,
        accessPointNamingPattern: "${projectName}-${environment}-${purpose}",
        accessPoints: [
          { name: 'chat-history', purpose: 'chat-history' as const }
        ]
      },
      tiering: { enabled: false },
      performance: {
        monitoring: { enabled: true, metricsCollection: true, detailedMonitoring: false },
        autoOptimization: { enabled: false, throughputOptimization: false, storageOptimization: false, performanceMode: 'COST_OPTIMIZED' as const },
        cache: { enabled: false, size: 0, type: 'READ' as const }
      }
    },
    
    standard: {
      ...FSxONTAPPresets.development,
      enabled: true
    },
    
    advanced: {
      ...FSxONTAPPresets.production,
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
            purpose: 'chat-processing' as const,
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
      ...ServerlessPresets.development,
      enabled: true
    },
    
    advanced: {
      ...ServerlessPresets.production,
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
export function validateAccountAgnosticConfig(config: Partial<EnvironmentConfig>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

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
export function mergeConfigurations(
  baseConfig: Partial<EnvironmentConfig>,
  customConfig: Partial<EnvironmentConfig>
): EnvironmentConfig {
  // Deep merge implementation
  const merged = JSON.parse(JSON.stringify(baseConfig));
  
  function deepMerge(target: any, source: any): any {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  return deepMerge(merged, customConfig) as EnvironmentConfig;
}

/**
 * 環境設定ファクトリー関数
 */
export function createEnvironmentConfig(
  environment: 'development' | 'staging' | 'production',
  region: string,
  customOptions?: {
    fsxOntapLevel?: 'disabled' | 'minimal' | 'standard' | 'advanced';
    serverlessLevel?: 'disabled' | 'minimal' | 'standard' | 'advanced';
    performanceLevel?: 'disabled' | 'basic' | 'advanced';
    costOptimizationLevel?: 'disabled' | 'basic' | 'advanced';
    customConfig?: Partial<EnvironmentConfig>;
  }
): EnvironmentConfig {
  // ベース設定を取得
  let baseConfig = EnvironmentTemplates[environment];
  
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