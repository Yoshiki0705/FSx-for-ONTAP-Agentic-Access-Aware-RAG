#!/usr/bin/env node
/**
 * WebAppStack + Permission API統合デプロイメント
 * 
 * 機能:
 * - DataStack: DynamoDBテーブル作成
 * - WebAppStack: Next.js WebApp + Permission API統合
 * 
 * 使用方法:
 * npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-with-permission-api.ts"
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/stacks/integrated/data-stack';
import { WebAppStack } from '../lib/stacks/integrated/webapp-stack';

// 東京リージョン設定をインポート
import { tokyoProductionConfig } from '../lib/config/environments/tokyo-production-config';

const app = new cdk.App();

// imageTagの取得（CDKコンテキストから）
const imageTag = app.node.tryGetContext('imageTag');

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1', // 東京リージョン
};

console.log('========================================');
console.log('🚀 WebApp + Permission API統合デプロイ開始');
console.log('========================================');
console.log(`アカウント: ${env.account}`);
console.log(`リージョン: ${env.region}`);
console.log('');

// 1. DataStack - DynamoDB + OpenSearch + S3 + FSx for ONTAP（README.md準拠）
console.log('📦 Step 1: DataStack作成中...');

// README.md準拠の完全なDataStack設定
const dataStack = new DataStack(app, 'TokyoRegion-PermissionAwareRAG-DataStack', {
  env,
  config: {
    storage: tokyoProductionConfig.storage as any,
    database: tokyoProductionConfig.database as any,
  },
  projectName: 'permission-aware-rag',
  environment: 'prod',
  description: 'Data Stack - DynamoDB + OpenSearch + FSx for ONTAP (README.md compliant)',
});

console.log('✅ DataStack作成完了');
console.log('');

// 2. WebAppStack - Next.js WebApp + Permission API統合
console.log('📦 Step 2: WebAppStack作成中...');

// Permission API設定を追加
const webAppConfig: any = {
  ...tokyoProductionConfig,
  permissionApi: {
    enabled: false, // 一時的に無効化（Phase 11 E2Eテスト用にDataStackのみデプロイ）
    ontapManagementLif: process.env.ONTAP_MANAGEMENT_LIF || '',
    ssmParameterPrefix: '/fsx-ontap',
  },
};

const webAppStack = new WebAppStack(app, 'TokyoRegion-PermissionAwareRAG-WebAppStack', {
  env,
  config: webAppConfig,
  projectName: 'permission-aware-rag',
  environment: 'prod',
  standaloneMode: true, // スタンドアローンモード
  skipLambdaCreation: false, // Lambda関数を作成
  dockerPath: './docker/nextjs',
  imageTag, // CDKコンテキストから取得したimageTagを渡す
  // DataStackからDynamoDBテーブルを参照
  userAccessTable: dataStack.userAccessTable,
  permissionCacheTable: dataStack.permissionCacheTable,
  description: 'WebApp Stack - Next.js + Permission API Integration',
});

// 依存関係の設定
webAppStack.addDependency(dataStack);

console.log('✅ WebAppStack作成完了');
console.log('');

console.log('========================================');
console.log('✅ 統合デプロイ設定完了');
console.log('========================================');
console.log('');
console.log('📋 デプロイされるスタック:');
console.log('  1. TokyoRegion-PermissionAwareRAG-DataStack');
console.log('  2. TokyoRegion-PermissionAwareRAG-WebAppStack');
console.log('');
console.log('🚀 デプロイコマンド:');
console.log('  npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-with-permission-api.ts"');
console.log('');
console.log('⚠️  注意事項:');
console.log('  - ONTAP_MANAGEMENT_LIF環境変数を設定してください');
console.log('  - ECRにNext.jsイメージをプッシュしてください');
console.log('  - SSMパラメータ(/fsx-ontap/*)を設定してください');
console.log('========================================');
