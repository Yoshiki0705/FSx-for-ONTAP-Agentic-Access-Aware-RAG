/**
 * 東京リージョン開発設定 - SQLite負荷試験対応
 * 
 * 東京リージョン（ap-northeast-1）での開発環境設定を定義します。
 * SQLite負荷試験機能を含む包括的な設定
 */

import { EnvironmentConfig } from '../interfaces/environment-config';

// 東京リージョン開発環境設定
export const tokyoDevelopmentConfig: EnvironmentConfig = {
  environment: 'dev',
  region: 'ap-northeast-1',
  
  // プロジェクト設定
  project: {
    name: 'permission-aware-rag',
    version: '1.0.0',
    description: 'Permission-aware RAG System with FSx for NetApp ONTAP - Development'
  },

  // 命名設定（統一された命名規則）
  naming: {
    projectName: 'permission-aware-rag',
    environment: 'dev',
    regionPrefix: 'TokyoRegion',
    separator: '-'
  },

  // ネットワーク設定（開発環境）
  networking: {
    vpcCidr: '10.21.0.0/16', // 既存VPCのCIDR
    availabilityZones: 2, // 開発環境では2AZ
    natGateways: {
      enabled: true,
      count: 1 // 開発環境では1つのNAT Gateway
    },
    enableVpcFlowLogs: false, // 開発環境ではコスト削減
    enableDnsHostnames: true,
    enableDnsSupport: true
  },

  // セキュリティ設定（開発環境）
  security: {
    enableWaf: false, // 開発環境ではコスト削減
    enableGuardDuty: false,
    enableConfig: false,
    enableCloudTrail: true,
    kmsKeyRotation: false, // 開発環境では無効
    encryptionAtRest: true,
    encryptionInTransit: true
  },

  // ストレージ設定（開発環境）
  storage: {
    s3: {
      enableVersioning: true,
      enableLifecyclePolicy: true,
      transitionToIADays: 30,
      transitionToGlacierDays: 90,
      expirationDays: 365, // 開発環境では1年保持
      documents: {
        encryption: true,
        versioning: true
      },
      backup: {
        encryption: true,
        versioning: false
      },
      embeddings: {
        encryption: true,
        versioning: false
      }
    },
    fsxOntap: {
      enabled: true,
      storageCapacity: 1024, // 開発環境では小容量
      throughputCapacity: 128, // 開発環境では低スループット
      deploymentType: 'SINGLE_AZ_1', // 開発環境では単一AZ
      automaticBackupRetentionDays: 7, // 開発環境では短期保持
      activeDirectory: {
        enabled: false // デフォルトは無効
      }
    }
  },

  // データベース設定（開発環境）
  database: {
    dynamodb: {
      billingMode: 'PAY_PER_REQUEST', // 開発環境では従量課金
      pointInTimeRecovery: false, // 開発環境では無効
      enableStreams: false,
      streamViewType: 'KEYS_ONLY'
    },
    opensearch: {
      instanceType: 't3.small.search', // 開発環境では小型インスタンス
      instanceCount: 1, // 開発環境では単一インスタンス
      dedicatedMasterEnabled: false,
      masterInstanceCount: 0,
      ebsEnabled: true,
      volumeType: 'gp3',
      volumeSize: 20, // 開発環境では小容量
      encryptionAtRest: true
    }
  },

  // Embedding設定（開発環境・SQLite負荷試験対応）
  embedding: {
    lambda: {
      runtime: 'nodejs20.x',
      timeout: 300, // 開発環境では短いタイムアウト
      memorySize: 1024, // 開発環境では標準メモリ
      enableXRayTracing: false, // 開発環境ではコスト削減
      enableDeadLetterQueue: true
    },
    batch: {
      enabled: true,
      computeEnvironmentType: 'EC2', // 開発環境ではEC2
      instanceTypes: ['m5.large', 'm5.xlarge'],
      minvCpus: 0,
      maxvCpus: 20, // 開発環境では小規模
      desiredvCpus: 0
    },
    ecs: {
      enabled: false, // 開発環境では無効化
      instanceType: 'm5.large',
      minCapacity: 0,
      maxCapacity: 2,
      desiredCapacity: 0,
      enableManagedInstance: false
    }
  },

  // API設定（開発環境）
  api: {
    throttling: {
      rateLimit: 1000, // 開発環境では低いレート制限
      burstLimit: 2000
    },
    cors: {
      enabled: true,
      allowOrigins: ['*'], // 開発環境では全て許可
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key']
    },
    authentication: {
      cognitoEnabled: true,
      apiKeyRequired: false // 開発環境では不要
    }
  },

  // AI設定（開発環境）
  ai: {
    bedrock: {
      enabled: true,
      models: [
        'anthropic.claude-3-haiku-20240307-v1:0', // 開発環境では軽量モデル
        'amazon.titan-embed-text-v1'
      ],
      maxTokens: 4096, // 開発環境では標準容量
      temperature: 0.7 // 開発環境では多様な出力
    },
    embedding: {
      model: 'amazon.titan-embed-text-v1',
      dimensions: 1536,
      batchSize: 100 // 開発環境では小バッチサイズ
    }
  },

  // 監視設定（開発環境）
  monitoring: {
    enableDetailedMonitoring: false, // 開発環境ではコスト削減
    logRetentionDays: 30, // 開発環境では短期保持
    enableAlarms: true,
    alarmNotificationEmail: 'dev-team@example.com',
    enableDashboard: true,
    enableXRayTracing: false // 開発環境ではコスト削減
  },

  // エンタープライズ設定（開発環境）
  enterprise: {
    enableAccessControl: true,
    enableAuditLogging: false, // 開発環境では無効
    enableBIAnalytics: false,
    enableMultiTenant: false,
    dataRetentionDays: 90 // 開発環境では短期保持
  },

  // 機能フラグ（開発環境では選択的有効化）
  features: {
    enableNetworking: true,
    enableSecurity: true,
    enableStorage: true,
    enableDatabase: true,
    enableEmbedding: true,
    enableAPI: true,
    enableAI: true,
    enableMonitoring: true,
    enableEnterprise: false // 開発環境では無効
  },

  // タグ設定（開発環境）
  tags: {
    Environment: 'dev',
    Project: 'permission-aware-rag',
    Owner: 'Development-Team',
    CostCenter: 'Development',
    Backup: 'Standard',
    Monitoring: 'Basic',
    Compliance: 'Basic',
    DataClassification: 'Internal',
    Region: 'ap-northeast-1',
    Timezone: 'Asia/Tokyo',
    ComplianceFramework: 'Basic'
  }
};