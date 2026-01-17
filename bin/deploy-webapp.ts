#!/usr/bin/env node
/**
 * WebAppStack統合デプロイエントリーポイント
 * 
 * 用途:
 * - WebAppStackのスタンドアローンデプロイ
 * - 環境変数による柔軟な設定
 * - 既存リソースの参照または新規作成
 * 
 * 使用方法:
 *   npx cdk deploy -a "npx ts-node bin/deploy-webapp.ts"
 * 
 * 環境変数:
 *   PROJECT_NAME: プロジェクト名（デフォルト: permission-aware-rag）
 *   ENVIRONMENT: 環境名（デフォルト: prod）
 *   CDK_DEFAULT_REGION: リージョン（デフォルト: ap-northeast-1）
 *   CDK_DEFAULT_ACCOUNT: AWSアカウントID（必須）
 *   EXISTING_VPC_ID: 既存VPC ID（オプション）
 *   EXISTING_SECURITY_GROUP_ID: 既存セキュリティグループID（オプション）
 *   SKIP_LAMBDA_CREATION: Lambda作成をスキップ（true/false、デフォルト: false）
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebAppStack } from '../lib/stacks/integrated/webapp-stack';
import { tokyoProductionConfig } from '../lib/config/environments/tokyo-production-config';

const app = new cdk.App();

// imageTagの取得（CDKコンテキストから）
const imageTag = app.node.tryGetContext('imageTag');

// 環境設定
const projectName = process.env.PROJECT_NAME || 'permission-aware-rag';
const environment = process.env.ENVIRONMENT || 'prod';
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

// スタンドアローンモード設定
const existingVpcId = process.env.EXISTING_VPC_ID;
const existingSecurityGroupId = process.env.EXISTING_SECURITY_GROUP_ID;
const skipLambdaCreation = process.env.SKIP_LAMBDA_CREATION === 'true';

// 必須環境変数チェック
if (!account) {
  console.error('❌ エラー: CDK_DEFAULT_ACCOUNT環境変数が設定されていません');
  console.error('');
  console.error('設定方法:');
  console.error('  export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)');
  process.exit(1);
}

// 既存リソースIDの検証
if (existingVpcId && !existingVpcId.startsWith('vpc-')) {
  console.error('❌ エラー: EXISTING_VPC_IDの形式が不正です');
  console.error(`   指定値: ${existingVpcId}`);
  console.error('   正しい形式: vpc-xxxxxxxxxxxxxxxxx');
  process.exit(1);
}

if (existingSecurityGroupId && !existingSecurityGroupId.startsWith('sg-')) {
  console.error('❌ エラー: EXISTING_SECURITY_GROUP_IDの形式が不正です');
  console.error(`   指定値: ${existingSecurityGroupId}`);
  console.error('   正しい形式: sg-xxxxxxxxxxxxxxxxx');
  process.exit(1);
}

console.log('🚀 WebAppStackデプロイ設定:');
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${region}`);
console.log(`   アカウント: ${account}`);
console.log(`   デプロイモード: スタンドアローン`);
if (existingVpcId) {
  console.log(`   既存VPC: ${existingVpcId}`);
}
if (existingSecurityGroupId) {
  console.log(`   既存セキュリティグループ: ${existingSecurityGroupId}`);
}
if (skipLambdaCreation) {
  console.log(`   Lambda作成: スキップ`);
}

// 設定読み込み
const config = tokyoProductionConfig;
console.log('✅ 設定読み込み完了');

// スタック名生成
const stackName = `${config.naming.regionPrefix}-${projectName}-${environment}-WebApp`;

// WebAppStackのデプロイ（スタンドアローンモード）
try {
  const webAppStack = new WebAppStack(app, stackName, {
    env: {
      account,
      region,
    },
    config: config as any, // EnvironmentConfigとの互換性のため
    projectName,
    environment,
    imageTag, // CDKコンテキストから取得したimageTagを渡す
    // スタンドアローンモード設定
    standaloneMode: true,
    existingVpcId,
    existingSecurityGroupId,
  });

  console.log(`✅ WebAppStack "${webAppStack.stackName}" を初期化しました`);

  // タグ設定
  cdk.Tags.of(app).add('Project', projectName);
  cdk.Tags.of(app).add('Environment', environment);
  cdk.Tags.of(app).add('ManagedBy', 'CDK');
  cdk.Tags.of(app).add('Region', region);
  cdk.Tags.of(app).add('DeployMode', 'standalone'); // US-2.1要件

  app.synth();
} catch (error) {
  console.error('');
  console.error('========================================');
  console.error('❌ WebAppStack初期化エラー');
  console.error('========================================');
  console.error('');
  
  if (error instanceof Error) {
    console.error('エラーメッセージ:', error.message);
    console.error('');
    
    // 一般的なエラーパターンに対する対処法を提示
    if (error.message.includes('VPC')) {
      console.error('💡 VPC関連エラーの対処法:');
      console.error('   1. EXISTING_VPC_ID環境変数が正しく設定されているか確認');
      console.error('   2. 指定したVPCが存在するか確認: aws ec2 describe-vpcs --vpc-ids <VPC_ID>');
      console.error('   3. VPCが同じリージョンにあるか確認');
    } else if (error.message.includes('SecurityGroup')) {
      console.error('💡 セキュリティグループ関連エラーの対処法:');
      console.error('   1. EXISTING_SECURITY_GROUP_ID環境変数が正しく設定されているか確認');
      console.error('   2. 指定したセキュリティグループが存在するか確認');
      console.error('   3. セキュリティグループが指定したVPCに属しているか確認');
    } else if (error.message.includes('ECR')) {
      console.error('💡 ECR関連エラーの対処法:');
      console.error('   1. ECRリポジトリが作成されているか確認');
      console.error('   2. Dockerイメージがプッシュされているか確認');
      console.error('   3. SKIP_LAMBDA_CREATION=true でECRのみデプロイを試行');
    } else {
      console.error('💡 一般的な対処法:');
      console.error('   1. AWS認証情報が正しく設定されているか確認');
      console.error('   2. 必要なIAM権限があるか確認');
      console.error('   3. リージョンが正しく設定されているか確認');
    }
  } else {
    console.error('予期しないエラー:', error);
  }
  
  console.error('');
  console.error('詳細なエラー情報:');
  console.error(error);
  console.error('');
  
  process.exit(1);
}
