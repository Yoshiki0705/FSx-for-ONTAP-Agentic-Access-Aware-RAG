#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as efs from 'aws-cdk-lib/aws-efs';
import { DataStack } from '../lib/stacks/integrated/data-stack';
import { ResourceConflictHandler, ResourceConflictAspect } from '../lib/utils/resource-conflict-handler';

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
  vpcId: 'vpc-05273211525990e49',
  availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
  publicSubnetIds: ['subnet-0789b65b5bcb18500', 'subnet-07526121a7c92b606', 'subnet-0fa216f00fc37302d'],
  privateSubnetIds: ['subnet-0680aed62b70b92e8', 'subnet-0140b35055e9e388b', 'subnet-077ec5d7d1a6ed82f'],
  vpcCidrBlock: '10.0.0.0/16',
};

// DataStack完全設定（型定義に完全準拠）
const dataStackConfig = {
  // ストレージ設定（StorageConfig完全準拠）
  storage: {
    // タグ設定（StorageConstruct互換性のため）
    tags: {
      StorageType: 'FSxONTAP',
      BackupEnabled: 'false',
      EncryptionEnabled: 'true',
      DataClassification: 'Confidential',
      RetentionPeriod: '0days',
    },
    // FSx設定（主要ストレージ）- 一時的に無効化してEarly Validation errorの原因を特定
    fsx: {
      enabled: false, // 一時的に無効化
      fileSystemType: 'ONTAP' as const,
      storageCapacity: 1024,
      throughputCapacity: 128,
      multiAz: false,
      deploymentType: 'SINGLE_AZ_1' as const,
      automaticBackupRetentionDays: 0,
      disableBackupConfirmed: true,
      backup: {
        automaticBackup: false,
        retentionDays: 0,
        disableBackupConfirmed: true,
      },
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

// DataStack作成（VPC設定なし - DynamoDBのみデプロイ）
const dataStack = new DataStack(app, `${regionPrefix}-${projectName}-${environment}-Data`, {
  env,
  description: 'Data and Storage Stack - DynamoDB only (FSx disabled for testing)',
  
  // 統合設定
  config: dataStackConfig,
  
  // VPC設定（NetworkingStackから）- 一時的にコメントアウト
  // vpc: vpcConfig,
  // privateSubnetIds: vpcConfig.privateSubnetIds,
  
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

// リソース競合チェックAspectの追加（デプロイ前に自動チェック）
const conflictHandler = new ResourceConflictHandler({
  region: env.region,
  accountId: env.account,
  stackName: `${regionPrefix}-${projectName}-${environment}-Data`,
  resourcePrefix: `${projectName}-${environment}`,
});

const conflictAspect = new ResourceConflictAspect(conflictHandler);
cdk.Aspects.of(dataStack).add(conflictAspect);

// CDK Synth実行
const assembly = app.synth();

// Synth後に競合チェックを実行（非同期）
(async () => {
  try {
    console.log('\n🔍 リソース競合チェック実行中...');
    const result = await conflictAspect.checkConflicts();
    conflictHandler.printConflictReport(result);
    
    if (result.hasConflict) {
      console.log('\n⚠️  競合が検出されました。デプロイ前に解決してください。');
      console.log('💡 自動修復スクリプトを使用:');
      console.log(`   npx ts-node development/scripts/deployment/pre-deploy-check.ts --stack-name ${regionPrefix}-${projectName}-${environment}-Data --auto-fix`);
      console.log('');
      // 競合があってもSynthは成功させる（デプロイ時にエラーになる）
    } else {
      console.log('✅ リソース競合なし - デプロイ可能');
    }
  } catch (error: any) {
    console.warn('⚠️  競合チェック中にエラーが発生しました:', error.message);
    console.warn('   デプロイは続行されますが、Early Validation errorが発生する可能性があります');
  }
})();
