#!/usr/bin/env node
/**
 * EmbeddingStack デプロイ用エントリーポイント
 * 
 * 機能:
 * - EmbeddingStackの単独デプロイ
 * - DataStackとの連携
 * - Bedrock・Lambda統合管理
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { EmbeddingStack } from '../lib/stacks/integrated/embedding-stack';
import { tokyoProductionConfig } from '../lib/config/environments/tokyo-production-config';

const app = new cdk.App();

// 環境設定の取得
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

// 必須環境変数の検証
if (!account) {
  console.error('❌ エラー: CDK_DEFAULT_ACCOUNT環境変数が設定されていません');
  process.exit(1);
}

console.log(`🚀 EmbeddingStack デプロイ設定:`);
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${region}`);
console.log(`   アカウント: ${account}`);

// NetworkingStackからVPC情報を取得
const vpcId = 'vpc-09aa251d6db52b1fc';
const privateSubnetIds = ['subnet-0a84a16a1641e970f', 'subnet-0c4599b4863ff4d33', 'subnet-0c9ad18a58c06e7c5'];
const publicSubnetIds = ['subnet-06a00a8866d09b912', 'subnet-0d7c7e43c1325cd3b', 'subnet-06df589d2ed2a5fc0'];
const availabilityZones = ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'];

// DataStackから出力値を取得（コンテキストまたは環境変数から）
const s3BucketNames = app.node.tryGetContext('s3BucketNames') || process.env.S3_BUCKET_NAMES;
const efsFileSystemId = app.node.tryGetContext('efsFileSystemId') || process.env.EFS_FILE_SYSTEM_ID;

console.log(`📡 依存スタック情報:`);
console.log(`   VPC ID: ${vpcId}`);
console.log(`   Private Subnets: ${privateSubnetIds.join(', ')}`);
console.log(`   Public Subnets: ${publicSubnetIds.join(', ')}`);
if (efsFileSystemId) {
  console.log(`   EFS File System ID: ${efsFileSystemId}`);
}

// EmbeddingStack作成
console.log('🔧 EmbeddingStackインスタンス化開始...');
const embeddingStack = new EmbeddingStack(app, 'TokyoRegion-permission-aware-rag-prod-Embedding', {
  env: {
    account,
    region
  },
  projectName,
  environment,
  config: {
    ai: tokyoProductionConfig.ai as any
  },
  vpc: {
    vpcId,
    availabilityZones,
    privateSubnetIds,
    publicSubnetIds
  },
  privateSubnetIds,
  publicSubnetIds,
  efsFileSystemId,
  s3BucketNames: s3BucketNames ? JSON.parse(s3BucketNames) : undefined,
  description: `EmbeddingStack for ${projectName} (${environment}) - Bedrock and Lambda Integration`
});
console.log('✅ EmbeddingStackインスタンス化成功');

// タグ適用
cdk.Tags.of(embeddingStack).add('Project', projectName);
cdk.Tags.of(embeddingStack).add('Environment', environment);
cdk.Tags.of(embeddingStack).add('Stack', 'Embedding');
cdk.Tags.of(embeddingStack).add('ManagedBy', 'CDK');

app.synth();
