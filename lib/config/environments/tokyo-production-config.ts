/**
 * 東京リージョン本番設定 - 本番環境統合設定
 * 
 * 東京リージョン（ap-northeast-1）での本番環境設定を定義します。
 */

import { EnvironmentConfig } from '../interfaces/environment-config';

// 東京リージョン本番環境設定
export const tokyoProductionConfig: EnvironmentConfig = {
  environment: 'prod',
  region: 'ap-northeast-1',
  
  // プロジェクト設定
  project: {
    name: 'permission-aware-rag',
    version: '1.0.0',
    description: 'Permission-aware RAG System with FSx for NetApp ONTAP - Production'
  },

  // 命名設定（統一された命名規則）
  naming: {
    projectName: 'permission-aware-rag',
    environment: 'prod',
    regionPrefix: 'TokyoRegion',
    separator: '-'
  },

  // ネットワーク設定（本番環境強化）
  networking: {
    vpcCidr: '10.0.0.0/16',
    availabilityZones: 3, // 本番環境では3AZ
    natGateways: {
      enabled: true,
      count: 3 // 各AZにNAT Gateway
    },
    enableVpcFlowLogs: true,
    enableDnsHostnames: true,
    enableDnsSupport: true
  },

  // セキュリティ設定（本番環境強化）
  security: {
    enableWaf: true,
    enableGuardDuty: true, // 本番環境では有効化
    enableConfig: true, // 本番環境では有効化
    enableCloudTrail: true,
    kmsKeyRotation: true,
    encryptionAtRest: true,
    encryptionInTransit: true
  },

  // ストレージ設定（README.md準拠 - S3 + FSx for ONTAP）
  storage: {
    s3: {
      encryption: {
        enabled: true,
        kmsManaged: false, // S3管理暗号化を使用
        bucketKeyEnabled: true
      },
      versioning: true,
      lifecycle: {
        enabled: true,
        transitionToIA: 30,
        transitionToGlacier: 90,
        deleteAfter: 2555, // 7年保持（コンプライアンス要件）
        abortIncompleteMultipartUpload: 7
      },
      publicAccess: {
        blockPublicRead: true,
        blockPublicWrite: true,
        blockPublicAcls: true,
        restrictPublicBuckets: true
      },
      documents: {
        enabled: false, // FSx for ONTAPをメインストレージとして使用
        encryption: true,
        versioning: true
      },
      backup: {
        enabled: false, // FSx for ONTAPの自動バックアップを使用
        encryption: true,
        versioning: true
      },
      embeddings: {
        enabled: false, // OpenSearch Serverlessで埋め込みを管理
        encryption: true,
        versioning: false
      }
    },
    fsx: {
      enabled: true, // README.md準拠 - FSx for ONTAP有効化
      storageCapacity: 1024, // 検証用最小構成（本番環境では4096以上推奨）
      throughputCapacity: 128, // 検証用最小構成（本番環境では512以上推奨）
      deploymentType: 'SINGLE_AZ_1', // 検証用単一AZ（本番環境ではMULTI_AZ_1推奨）
      automaticBackupRetentionDays: 7, // 検証用短期保持（本番環境では30日推奨）
      backup: {
        automaticBackup: true,
        retentionDays: 7,
        backupWindow: '01:00',
        maintenanceWindow: '1:01:00'
      }
    } as any, // 型互換性のため一時的にany型を使用
    fsxOntap: {
      enabled: true, // README.md準拠 - FSx for ONTAP有効化
      storageCapacity: 1024,
      throughputCapacity: 128,
      deploymentType: 'SINGLE_AZ_1',
      automaticBackupRetentionDays: 7,
      volumes: {
        data: {
          enabled: true,
          name: 'data_volume',
          junctionPath: '/data',
          sizeInMegabytes: 10240,
          storageEfficiencyEnabled: true,
          securityStyle: 'UNIX'
        },
        database: {
          enabled: true,
          name: 'database_volume',
          junctionPath: '/database',
          sizeInMegabytes: 10240,
          storageEfficiencyEnabled: true,
          securityStyle: 'UNIX'
        }
      }
    }
  },

  // データベース設定（本番環境強化）
  database: {
    dynamodb: {
      billingMode: 'PROVISIONED', // 本番環境では予測可能なコスト
      pointInTimeRecovery: true,
      enableStreams: true,
      streamViewType: 'NEW_AND_OLD_IMAGES'
    },
    opensearch: {
      instanceType: 'm6g.large.search', // 本番環境では高性能インスタンス
      instanceCount: 3, // 本番環境では冗長化
      dedicatedMasterEnabled: true, // 本番環境では専用マスター
      masterInstanceCount: 3,
      ebsEnabled: true,
      volumeType: 'gp3',
      volumeSize: 100, // 本番環境では大容量
      encryptionAtRest: true
    }
  },

  // Embedding設定（本番環境強化）
  embedding: {
    lambda: {
      runtime: 'nodejs20.x',
      timeout: 900, // 本番環境では最大タイムアウト
      memorySize: 3008, // 本番環境では高メモリ
      enableXRayTracing: true,
      enableDeadLetterQueue: true
    },
    batch: {
      enabled: true, // 本番環境では有効化
      computeEnvironmentType: 'FARGATE',
      instanceTypes: ['optimal'],
      minvCpus: 0,
      maxvCpus: 1024, // 本番環境では大規模処理対応
      desiredvCpus: 0
    },
    ecs: {
      enabled: true, // ECS on EC2を有効化
      instanceType: 'm5.xlarge', // 本番環境では高性能インスタンス
      minCapacity: 1,
      maxCapacity: 10,
      desiredCapacity: 2,
      enableManagedInstance: true
    }
  },

  // API設定（本番環境強化）
  api: {
    throttling: {
      rateLimit: 10000, // 本番環境では高いレート制限
      burstLimit: 20000
    },
    cors: {
      enabled: true,
      allowOrigins: [
        'https://rag-system.example.com',
        'https://app.rag-system.example.com'
      ], // 本番環境では特定ドメインのみ
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key']
    },
    authentication: {
      cognitoEnabled: true,
      apiKeyRequired: true // 本番環境ではAPI Key必須
    }
  },

  // AI設定（本番環境強化）
  ai: {
    bedrock: {
      enabled: true,
      models: [
        'anthropic.claude-3-sonnet-20240229-v1:0', // 本番環境では高性能モデル
        'anthropic.claude-3-haiku-20240307-v1:0'
      ],
      maxTokens: 8192, // 本番環境では大容量
      temperature: 0.3 // 本番環境では安定した出力
    },
    embedding: {
      model: 'amazon.titan-embed-text-v2:0', // 本番環境では最新モデル
      dimensions: 1536,
      batchSize: 500 // 本番環境では大バッチサイズ
    }
  },
  
  // Bedrock Agent設定（新規追加）
  bedrockAgent: {
    enabled: true,
    foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    knowledgeBaseId: '', // TODO: Knowledge Base IDを設定
    documentSearchLambdaArn: '', // TODO: Document Search Lambda ARNを設定
  },

  // 監視設定（本番環境強化）
  monitoring: {
    enableDetailedMonitoring: true,
    logRetentionDays: 365, // 本番環境では1年保持
    enableAlarms: true,
    alarmNotificationEmail: 'ops-team@example.com',
    enableDashboard: true,
    enableXRayTracing: true
  },

  // エンタープライズ設定（本番環境強化）
  enterprise: {
    enableAccessControl: true,
    enableAuditLogging: true,
    enableBIAnalytics: true, // 本番環境では有効化
    enableMultiTenant: true, // 本番環境では有効化
    dataRetentionDays: 2555 // 7年保持（コンプライアンス要件）
  },

  // 機能フラグ（本番環境では全機能有効）
  features: {
    enableNetworking: true,
    enableSecurity: true,
    enableStorage: true,
    enableDatabase: true,
    enableEmbedding: true,
    enableAPI: true,
    enableAI: true,
    enableMonitoring: true,
    enableEnterprise: true
  },

  // タグ設定（本番環境・IAM制限対応）
  tags: {
    Environment: 'prod',
    Project: 'permission-aware-rag',
    Owner: 'Platform-Team',
    CostCenter: 'Production',
    Backup: 'Critical',
    Monitoring: 'Enabled',
    Compliance: 'SOC2+GDPR+HIPAA',
    DataClassification: 'Confidential',
    Region: 'ap-northeast-1',
    Timezone: 'Asia/Tokyo',
    ComplianceFramework: 'SOC2+GDPR+HIPAA',
    // オプションタグ
    BusinessCriticality: 'High',
    DisasterRecovery: 'Enabled',
    SecurityLevel: 'High',
    EncryptionRequired: 'Yes',
    AuditRequired: 'Yes',
    PerformanceLevel: 'High',
    AvailabilityTarget: '99.9%',
    RPO: '1h',
    RTO: '4h'
  }
};