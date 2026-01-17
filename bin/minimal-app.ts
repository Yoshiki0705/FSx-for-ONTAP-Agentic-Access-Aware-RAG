#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

/**
 * 最小限のCDKアプリケーション
 * エラーのないスタックのみを含む
 */

const app = new cdk.App();

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1'
};

console.log('🚀 最小限のCDKアプリケーション初期化...');
console.log(`   アカウント: ${env.account}`);
console.log(`   リージョン: ${env.region}`);

// 空のスタック（テンプレート生成テスト用）
class MinimalStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // 最小限のリソース: S3バケット
    const bucket = new cdk.aws_s3.Bucket(this, 'TestBucket', {
      bucketName: `minimal-test-${env.account}-${env.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    
    // 出力
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'Test bucket name'
    });
  }
}

// スタック作成
new MinimalStack(app, 'MinimalTestStack', { env });

console.log('✅ 最小限のCDKアプリケーション初期化完了');
