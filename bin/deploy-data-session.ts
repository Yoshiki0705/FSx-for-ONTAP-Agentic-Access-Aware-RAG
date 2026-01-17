#!/usr/bin/env node
/**
 * DataStack個別デプロイスクリプト
 * SecurityStack修正後のデプロイ用
 * 
 * 注意: SessionTableStackは存在しないため、DataStackのみをデプロイします。
 * DataStackには全てのDynamoDBテーブル（セッション、ユーザー設定、チャット履歴等）が含まれています。
 * 
 * 重要: 既存のNetworkingStackのVPCを使用します（vpc-05273211525990e49）
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DataStack } from '../lib/stacks/integrated/data-stack';

const app = new cdk.App();

// 環境設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = 'ap-northeast-1';
const account = '178625946981';

// 既存VPC情報（NetworkingStackから）
const existingVpcId = 'vpc-05273211525990e49';
const existingVpcCidr = '10.0.0.0/16'; // NetworkingStackのデフォルトCIDR

// 既存VPCをインポート
const vpc = ec2.Vpc.fromLookup(app, 'ExistingVpc', {
  vpcId: existingVpcId,
  region: region
});

// プライベートサブネットIDを取得（NetworkingStackのエクスポートから）
const privateSubnetIds = [
  cdk.Fn.importValue('TokyoRegion-permission-aware-rag-prod-Networking-Stack-PrivateSubnet1Id'),
  cdk.Fn.importValue('TokyoRegion-permission-aware-rag-prod-Networking-Stack-PrivateSubnet2Id')
];

// DataStackConfig準拠の設定
const dataStackConfig = {
  storage: {
    s3: {
      encryption: {
        enabled: true,
        kmsManaged: true,
        bucketKeyEnabled: true
      },
      versioning: true,
      lifecycle: {
        enabled: true,
        transitionToIA: 30,
        transitionToGlacier: 90,
        deleteAfter: 365
      },
      publicAccess: {
        blockPublicRead: true,
        blockPublicWrite: true,
        blockPublicAcls: true,
        restrictPublicBuckets: true
      },
      documents: {
        enabled: false // FSx for ONTAPを使用
      },
      backup: {
        enabled: false
      },
      embeddings: {
        enabled: false
      }
    },
    fsx: {
      enabled: true,
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
        disableBackupConfirmed: true
      }
    }
  },
  database: {
    dynamoDb: {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: {
        enabled: true,
        kmsManaged: true
      },
      pointInTimeRecovery: true
    },
    openSearch: {
      enabled: false, // OpenSearchは削除済み
      serverless: false,
      encryption: {
        enabled: true,
        kmsManaged: true
      }
    },
    rds: {
      enabled: false,
      engine: {} as any // RDSは使用しない
    }
  }
};

// DataStackのデプロイ（既存VPCを使用）
const dataStack = new DataStack(app, `TokyoRegion-${projectName}-${environment}-Data`, {
  config: dataStackConfig,
  projectName: projectName,
  environment: environment,
  vpc: vpc, // 既存VPCを渡す
  privateSubnetIds: privateSubnetIds, // プライベートサブネットIDを渡す
  env: {
    account: account,
    region: region
  },
  description: 'Data Stack - FSx (using existing VPC), DynamoDB (includes Session, UserPreferences, ChatHistory tables)',
});

app.synth();
