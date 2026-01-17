/**
 * 東京リージョン統合設定 - 環境別統合設定
 * 
 * 東京リージョン（ap-northeast-1）での開発環境設定を定義します。
 */

import { EnvironmentConfig } from '../interfaces/environment-config';

// 東京リージョン開発環境設定
export const tokyoIntegratedConfig: EnvironmentConfig = {
  environment: 'dev',
  region: 'ap-northeast-1',
  
  // プロジェクト設定
  project: {
    name: 'rag-system',
    version: '1.0.0',
    description: 'Permission-aware RAG System with FSx for NetApp ONTAP'
  },

  // ネットワーク設定
  networking: {
    vpcCidr: '10.1.0.0/16',
    availabilityZones: 2,
    natGateways: {
      enabled: true,
      count: 2
    },
    enableVpcFlowLogs: true,
    enableDnsHostnames: true,
    enableDnsSupport: true
  },

  // セキュリティ設定
  security: {
    enableWaf: true,
    enableGuardDuty: false, // 既存のGuardDutyとの競合を避けるため無効化
    enableConfig: false, // AWS Configは一時的に無効化
    enableCloudTrail: true,
    kmsKeyRotation: true,
    encryptionAtRest: true,
    encryptionInTransit: true
  },

  // ストレージ設定
  storage: {
    s3: {
      enableVersioning: true,
      enableLifecyclePolicy: true,
      transitionToIADays: 30,
      transitionToGlacierDays: 90,
      expirationDays: 365
    },
    fsxOntap: {
      enabled: true,
      storageCapacity: 1024,
      throughputCapacity: 128,
      deploymentType: 'SINGLE_AZ_1',
      automaticBackupRetentionDays: 7
    }
  },

  // データベース設定
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

  // Embedding設定
  embedding: {
    lambda: {
      runtime: 'nodejs20.x',
      timeout: 300,
      memorySize: 1024,
      enableXRayTracing: true,
      enableDeadLetterQueue: true
    },
    batch: {
      enabled: false, // 開発環境では無効化
      computeEnvironmentType: 'FARGATE',
      instanceTypes: ['optimal'],
      minvCpus: 0,
      maxvCpus: 256,
      desiredvCpus: 0
    },
    ecs: {
      enabled: true, // ECS on EC2を有効化
      instanceType: 'm5.large',
      minCapacity: 0,
      maxCapacity: 3,
      desiredCapacity: 1,
      enableManagedInstance: true
    }
  },

  // API設定
  api: {
    throttling: {
      rateLimit: 1000,
      burstLimit: 2000
    },
    cors: {
      enabled: true,
      allowOrigins: ['*'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key']
    },
    authentication: {
      cognitoEnabled: true,
      apiKeyRequired: false
    }
  },

  // AI設定
  ai: {
    bedrock: {
      enabled: true,
      models: ['anthropic.claude-3-haiku-20240307-v1:0'],
      maxTokens: 4096,
      temperature: 0.7
    },
    embedding: {
      model: 'amazon.titan-embed-text-v1',
      dimensions: 1536,
      batchSize: 100
    }
  },

  // 監視設定
  monitoring: {
    enableDetailedMonitoring: true,
    logRetentionDays: 30,
    enableAlarms: true,
    alarmNotificationEmail: 'admin@example.com',
    enableDashboard: true,
    enableXRayTracing: true
  },

  // エンタープライズ設定
  enterprise: {
    enableAccessControl: true,
    enableAuditLogging: true,
    enableBIAnalytics: false, // 開発環境では無効化
    enableMultiTenant: false, // 開発環境では無効化
    dataRetentionDays: 90
  },

  // 機能フラグ
  features: {
    enableNetworking: true,
    enableSecurity: true,
    enableStorage: true,
    enableDatabase: true,
    enableEmbedding: true,
    enableAPI: true,
    enableAI: true,
    enableMonitoring: true,
    enableEnterprise: false // 開発環境では無効化
  },

  // タグ設定
  tags: {
    Environment: 'dev',
    Project: 'rag-system',
    Owner: 'DevOps',
    CostCenter: 'Engineering',
    Backup: 'Required',
    Monitoring: 'Enabled',
    Compliance: 'Standard',
    DataClassification: 'Internal',
    Region: 'ap-northeast-1',
    Timezone: 'Asia/Tokyo',
    ComplianceFramework: 'SOC2'
  }
};