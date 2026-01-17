#!/usr/bin/env node
/**
 * モジュラー統合アプリケーション エントリーポイント
 * 6つの統合スタックによるモジュラーアーキテクチャ実装
 * 
 * スタック構成:
 * 1. NetworkingStack - ネットワーク基盤（VPC、サブネット、ゲートウェイ）
 * 2. SecurityStack - セキュリティ設定（IAM、KMS、WAF）
 * 3. DataStack - データ・ストレージ統合（DynamoDB、S3、FSx）
 * 4. EmbeddingStack - コンピュート・AI統合（Lambda、Bedrock、Batch）
 * 5. WebAppStack - API・フロントエンド統合（API Gateway、Cognito、CloudFront）
 * 6. OperationsStack - 監視・エンタープライズ統合（CloudWatch、X-Ray、SNS）
 * 
 * 機能:
 * - Amazon Nova Pro統合によるコスト最適化（60-80%削減）
 * - 統一タグ戦略によるコスト配布管理
 * - 環境別設定の自動適用
 * - FSx for NetApp ONTAP統合
 * - 個別スタックデプロイ対応（cdk deploy StackName）
 * - 全スタック一括デプロイ対応（cdk deploy --all）
 * 
 * 使用方法:
 *   # 環境変数設定
 *   export PROJECT_NAME=permission-aware-rag
 *   export ENVIRONMENT=dev
 *   export CDK_DEFAULT_ACCOUNT=123456789012
 *   export CDK_DEFAULT_REGION=ap-northeast-1
 *   
 *   # 全スタック一括デプロイ
 *   npx cdk deploy --all
 *   
 *   # 個別スタックデプロイ
 *   npx cdk deploy NetworkingStack
 *   npx cdk deploy SecurityStack
 *   npx cdk deploy DataStack
 *   npx cdk deploy EmbeddingStack
 *   npx cdk deploy WebAppStack
 *   npx cdk deploy OperationsStack
 * 
 * 設定例:
 *   cdk.json の context セクションで詳細設定が可能
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack } from '../lib/stacks/integrated/networking-stack';
import { SecurityStack } from '../lib/stacks/integrated/security-stack';
import { DataStack } from '../lib/stacks/integrated/data-stack';
import { EmbeddingStack } from '../lib/stacks/integrated/embedding-stack';
import { WebAppStack } from '../lib/stacks/integrated/webapp-stack';
import { OperationsStack } from '../lib/stacks/integrated/operations-stack';
import { TaggingStrategy, PermissionAwareRAGTags } from '../lib/config/tagging-config';

const app = new cdk.App();

// プロジェクト設定の取得と検証
const projectName = process.env.PROJECT_NAME || 'permission-aware-rag';
const environment = process.env.ENVIRONMENT || 'dev';
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

// 必須環境変数の検証
if (!account) {
  console.error('❌ エラー: CDK_DEFAULT_ACCOUNT環境変数が設定されていません');
  process.exit(1);
}

// 環境名の検証
const validEnvironments = ['dev', 'staging', 'prod'];
if (!validEnvironments.includes(environment)) {
  console.error(`❌ エラー: 無効な環境名です: ${environment}. 有効な値: ${validEnvironments.join(', ')}`);
  process.exit(1);
}

console.log(`🚀 デプロイ設定:`);
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${region}`);
console.log(`   アカウント: ${account}`);

// アプリケーションレベルでのタグ設定
const taggingConfig = PermissionAwareRAGTags.getStandardConfig(projectName, environment);
const environmentConfig = PermissionAwareRAGTags.getEnvironmentConfig(environment);

// 全体タグの適用
Object.entries(taggingConfig.customTags || {}).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

Object.entries(environmentConfig.customTags || {}).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

// コスト配布タグの適用
cdk.Tags.of(app).add('cost', projectName);
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('CDK-Application', 'Permission-aware-RAG-FSxN');
cdk.Tags.of(app).add('Management-Method', 'AWS-CDK');

// 統合設定オブジェクト（簡易版）
const config = {
  project: { name: projectName },
  environment,
  naming: {
    projectName,
    environment,
    regionPrefix: 'TokyoRegion',
  },
  networking: {
    vpc: {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
    },
  },
  security: {
    kms: { enabled: true },
    waf: { enabled: true },
    guardDuty: { enabled: true },
  },
  storage: {
    s3: { enabled: true },
    fsx: { enabled: true },
  },
  database: {
    dynamodb: { enabled: true },
    opensearch: { enabled: true },
  },
  compute: {
    lambda: {
      timeout: 30,
      memorySize: 512,
    },
  },
  ai: {
    bedrock: {
      enabled: true,
      region: 'us-east-1',
      models: {
        titanEmbeddings: true,
      },
    },
  },
  monitoring: {
    cloudWatch: { enabled: true },
    xray: { enabled: true },
  },
  enterprise: {
    enabled: false,
  },
};

// 6つの統合スタックのデプロイ
try {
  console.log('🏗️ 6つの統合スタック初期化開始...');

  // 1. NetworkingStack - ネットワーク基盤
  const networkingStack = new NetworkingStack(app, 'NetworkingStack', {
    config: config.networking,
    projectName,
    environment: environment as 'dev' | 'staging' | 'prod' | 'test',
    env: { account, region },
  });
  console.log('✅ NetworkingStack初期化完了');

  // 2. SecurityStack - セキュリティ設定
  const securityStack = new SecurityStack(app, 'SecurityStack', {
    config,
    projectName,
    environment,
    env: { account, region },
  });
  securityStack.addDependency(networkingStack);
  console.log('✅ SecurityStack初期化完了');

  // 3. DataStack - データ・ストレージ統合
  const dataStack = new DataStack(app, 'DataStack', {
    config: {
      storage: config.storage,
      database: config.database,
    },
    securityStack,
    projectName,
    environment,
    vpc: networkingStack.vpc,
    privateSubnetIds: networkingStack.privateSubnets.map(s => s.subnetId),
    env: { account, region },
  });
  dataStack.addDependency(securityStack);
  console.log('✅ DataStack初期化完了');

  // 4. EmbeddingStack - コンピュート・AI統合
  const embeddingStack = new EmbeddingStack(app, 'EmbeddingStack', {
    aiConfig: {
      bedrock: {
        enabled: true,
        models: {
          titanEmbeddings: true,
        },
        monitoring: {
          cloudWatchMetrics: true,
        },
      },
      embedding: {
        enabled: true,
        model: app.node.tryGetContext('embedding:bedrock:modelId') ?? 'amazon.titan-embed-text-v1',
        dimensions: 1536,
      },
      model: {
        enabled: false,
        customModels: false,
      },
    },
    projectName,
    environment,
    fsxFileSystemId: app.node.tryGetContext('embedding:fsx:fileSystemId'),
    fsxSvmId: app.node.tryGetContext('embedding:fsx:svmId'),
    fsxVolumeId: app.node.tryGetContext('embedding:fsx:volumeId'),
    enableSqliteLoadTest: app.node.tryGetContext('embedding:enableSqliteLoadTest') ?? false,
    enableWindowsLoadTest: app.node.tryGetContext('embedding:enableWindowsLoadTest') ?? false,
    env: { account, region },
  });
  embeddingStack.addDependency(dataStack);
  console.log('✅ EmbeddingStack初期化完了');

  // 5. WebAppStack - API・フロントエンド統合
  const webAppStack = new WebAppStack(app, 'WebAppStack', {
    config,
    env: { account, region },
  });
  webAppStack.addDependency(embeddingStack);
  console.log('✅ WebAppStack初期化完了');

  // 6. OperationsStack - 監視・エンタープライズ統合
  const operationsStack = new OperationsStack(app, 'OperationsStack', {
    config,
    securityStack,
    dataStack,
    embeddingStack,
    webAppStack,
    projectName,
    environment,
    env: { account, region },
  });
  operationsStack.addDependency(webAppStack);
  console.log('✅ OperationsStack初期化完了');

  console.log('🎉 6つの統合スタック初期化完了');
  console.log('');
  console.log('📋 デプロイ可能なスタック:');
  console.log('   1. NetworkingStack - ネットワーク基盤');
  console.log('   2. SecurityStack - セキュリティ設定');
  console.log('   3. DataStack - データ・ストレージ統合');
  console.log('   4. EmbeddingStack - コンピュート・AI統合');
  console.log('   5. WebAppStack - API・フロントエンド統合');
  console.log('   6. OperationsStack - 監視・エンタープライズ統合');
  console.log('');
  console.log('💡 デプロイ方法:');
  console.log('   全スタック一括: cdk deploy --all');
  console.log('   個別スタック: cdk deploy NetworkingStack');
  
} catch (error) {
  console.error('❌ スタック初期化エラー:', error);
  process.exit(1);
}

// CDK合成実行
try {
  console.log('');
  console.log('🔄 CloudFormationテンプレート合成中...');
  app.synth();
  console.log('✅ CloudFormationテンプレート合成完了');
} catch (error) {
  console.error('❌ CDK合成エラー:', error);
  process.exit(1);
}
