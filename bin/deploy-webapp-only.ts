#!/usr/bin/env node
/**
 * WebAppStack単独デプロイメント（DataStackスキップ）
 * 
 * 機能:
 * - WebAppStack: Next.js WebApp + Permission API統合のみ
 * - DataStackは既存のものを参照（新規作成しない）
 * 
 * 使用方法:
 * npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-only.ts"
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
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
console.log('🚀 WebAppStack単独デプロイ開始');
console.log('========================================');
console.log(`アカウント: ${env.account}`);
console.log(`リージョン: ${env.region}`);
console.log('');

// WebAppStack - Next.js WebApp + Permission API統合
console.log('📦 WebAppStack作成中...');

// Permission API設定を追加
const webAppConfig: any = {
  ...tokyoProductionConfig,
  permissionApi: {
    enabled: false, // 一時的に無効化
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
  description: 'WebApp Stack - Next.js + Permission API Integration',
});

console.log('✅ WebAppStack作成完了');
console.log('');

console.log('========================================');
console.log('✅ WebAppStack単独デプロイ設定完了');
console.log('========================================');
console.log('');
console.log('📋 デプロイされるスタック:');
console.log('  1. TokyoRegion-PermissionAwareRAG-WebAppStack');
console.log('');
console.log('🚀 デプロイコマンド:');
console.log('  npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-only.ts"');
console.log('');
console.log('⚠️  注意事項:');
console.log('  - DataStackは既存のものを参照します');
console.log('  - ECRにNext.jsイメージをプッシュ済みであることを確認してください');
console.log('  - imageTagはCDKコンテキストから取得されます: -c imageTag=YOUR_TAG');
console.log('========================================');
