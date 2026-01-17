#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as efs from 'aws-cdk-lib/aws-efs';
import { DataStack } from '../lib/stacks/integrated/data-stack';

/**
 * DataStack専用CDKアプリケーション
 * 
 * NetworkingStack統合完了後のDataStackデプロイ用エントリーポイント
 * 
 * 前提条件:
 * - NetworkingStack: デプロイ済み（UPDATE_COMPLETE）
 * - SecurityStack: デプロイ済み（CREATE_COMPLETE）
 */

const app = new cdk.App();

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// プロジェクト設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const regionPrefix = 'TokyoRegion';

// NetworkingStackからのVPC情報（CloudFormation出力値から取得）
const vpcConfig = {
  vpcId: 'vpc-09aa251d6db52b1fc',
  availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
  publicSubnetIds: ['subnet-06a00a8866d09b912', 'subnet-0d7c7e43c1325cd3b', 'subnet-06df589d2ed2a5fc0'],
  privateSubnetIds: ['subnet-0a84a16a1641e970f', 'subnet-0c4599b4863ff4d33', 'subnet-0c9ad18a58c06e7c5'],
  vpcCidrBlock: '10.21.0.0/16',
};

// DataStack完全設定（型定義に完全準拠）
const dataStackConfig = {
  // ストレージ設定（StorageConfig完全準拠）
  storage: {
    // タグ設定（StorageConstruct互換性のため）
    tags: {
      StorageType: 'Hybrid',
      BackupEnabled: 'true',
      EncryptionEnabled: 'true',
      DataClassification: 'Confidential',
      RetentionPeriod: '365days',
    },
    // S3設定（必須）
    s3: {
      encryption: {
        enabled: true,
        kmsManaged: true,
        bucketKeyEnabled: true,
      },
      versioning: true,
      lifecycle: {
        enabled: true,
        transitionToIA: 30,
        transitionToGlacier: 90,
        deleteAfter: 365,
        abortIncompleteMultipartUpload: 7,
      },
      publicAccess: {
        blockPublicRead: true,
        blockPublicWrite: true,
        blockPublicAcls: true,
        restrictPublicBuckets: true,
      },
      // 個別バケット設定（environment-config.ts互換）
      documents: {
        enabled: true,
        bucketName: `${projectName}-${environment}-documents`,
        encryption: true,
        versioning: true,
      },
      backup: {
        enabled: true,
        bucketName: `${projectName}-${environment}-backup`,
        encryption: true,
        versioning: true,
      },
      embeddings: {
        enabled: true,
        bucketName: `${projectName}-${environment}-embeddings`,
        encryption: true,
        versioning: false,
      },
    },
    // FSx設定（一時無効化）
    fsx: {
      enabled: false,
      fileSystemType: 'ONTAP' as const,
      storageCapacity: 1024,
      throughputCapacity: 128,
      automaticBackupRetentionDays: 0,
      disableBackupConfirmed: true,
    },
    // FSx ONTAP設定（environment-config.ts互換性のため）
    fsxOntap: {
      enabled: false,
      fileSystemType: 'ONTAP' as const,
      storageCapacity: 1024,
      throughputCapacity: 128,
      automaticBackupRetentionDays: 0,
      disableBackupConfirmed: true,
    },
    // EFS設定（オプション）
    efs: {
      enabled: false,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      encryption: true,
    },
  },
  
  // データベース設定（DatabaseConfig完全準拠）
  database: {
    // DynamoDB設定（必須）
    dynamoDb: {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: {
        enabled: true,
        kmsManaged: true,
      },
      pointInTimeRecovery: true,
      streams: {
        enabled: false,
        streamSpecification: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      },
      backup: {
        continuousBackups: true,
        deletionProtection: true,
      },
      customTables: [
        {
          tableName: `${projectName}-${environment}-sessions`,
          partitionKey: {
            name: 'sessionId',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'timestamp',
            type: dynamodb.AttributeType.NUMBER,
          },
          ttl: {
            enabled: true,
            attributeName: 'expiresAt',
          },
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          encryption: {
            enabled: true,
            kmsManaged: true,
          },
          pointInTimeRecovery: true,
        },
        {
          tableName: `${projectName}-${environment}-users`,
          partitionKey: {
            name: 'userId',
            type: dynamodb.AttributeType.STRING,
          },
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          encryption: {
            enabled: true,
            kmsManaged: true,
          },
          pointInTimeRecovery: true,
        },
      ],
    },
    // OpenSearch設定（必須）
    openSearch: {
      enabled: false,
      serverless: true,
      encryption: {
        enabled: true,
        kmsManaged: true,
      },
    },
    // RDS設定（必須）
    rds: {
      enabled: false,
      engine: 'postgres' as any,
      instanceClass: 'db.t3.micro' as any,
      instanceSize: 'SMALL' as any,
      allocatedStorage: 20,
      multiAz: false,
      databaseName: 'ragdb',
      username: 'raguser',
      encryption: {
        enabled: true,
        kmsManaged: true,
      },
      backup: {
        automaticBackup: true,
        retentionDays: 7,
        deletionProtection: false,
      },
    },
  },
};

// DataStack作成
const dataStack = new DataStack(app, `${regionPrefix}-${projectName}-${environment}-Data`, {
  env,
  description: 'Data and Storage Stack - S3 and DynamoDB (FSx ONTAP temporarily disabled)',
  
  // 統合設定
  config: dataStackConfig,
  
  // VPC設定（NetworkingStackから）
  vpc: vpcConfig,
  privateSubnetIds: vpcConfig.privateSubnetIds,
  
  // プロジェクト設定
  projectName,
  environment,
  
  // タグ設定
  tags: {
    Project: projectName,
    Environment: environment,
    ManagedBy: 'CDK',
    Stack: 'DataStack',
    Region: env.region,
    DeployedBy: 'DataStackApp',
    NamingCompliance: 'AgentSteering',
  },
});

// グローバルタグ適用
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Architecture', 'Modular');
cdk.Tags.of(app).add('Region', env.region);
cdk.Tags.of(app).add('CreatedBy', 'DataStackApp');
cdk.Tags.of(app).add('NamingCompliance', 'AgentSteering');

app.synth();
