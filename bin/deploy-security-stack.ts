#!/usr/bin/env node
/**
 * SecurityStack個別デプロイスクリプト
 * GuardDuty修正後の再デプロイ用
 * 
 * 注意: Windows AD EC2を作成する場合はVPCが必要です
 * VPCがない場合は、先にNetworkingStackをデプロイしてください
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SecurityStack } from '../lib/stacks/integrated/security-stack';

const app = new cdk.App();

// 環境設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT || '';

// AgentCore設定をcdk.context.jsonから取得
const agentCoreConfig = app.node.tryGetContext('agentCore');

// VPC IDを環境変数またはコンテキストから取得
const vpcId = process.env.VPC_ID || app.node.tryGetContext('vpcId');

if (!vpcId) {
  console.warn('⚠️ VPC IDが指定されていません。Windows AD EC2は作成されません。');
  console.warn('   VPCを使用する場合は、環境変数VPC_IDまたはコンテキストvpcIdを設定してください。');
}

// 基本設定
const config = {
  project: {
    name: projectName
  },
  environment: environment,
  security: {
    enableGuardDuty: false, // GuardDutyは既存のDetectorを使用
    enableWaf: false,
    enableCloudTrail: false,
    enableConfig: false,
    kmsKeyRotation: true
  },
  agentCore: agentCoreConfig,
  // AD EC2インスタンスID（AgentCore Identity用）
  adEc2InstanceId: agentCoreConfig?.identity?.adEc2InstanceId,
  // VPC ID（SecurityStack内でインポート）
  vpcId: vpcId
};

// SecurityStackのみをデプロイ
new SecurityStack(app, `TokyoRegion-${projectName}-${environment}-Security`, {
  config: config,
  projectName: projectName,
  environment: environment,
  vpcId: vpcId, // VPC IDを直接渡す
  env: {
    account: account,
    region: region
  },
  description: 'Security Stack - KMS, WAF, IAM, Windows AD, AgentCore Identity',
});

app.synth();
