#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SecurityStack } from '../lib/stacks/integrated/security-stack';
import { PermissionAwareRAGTags, TaggingStrategy } from '../lib/config/tagging-config';

const app = new cdk.App();

// 環境設定
const projectName = app.node.tryGetContext('projectName') || 'permission-aware-rag';
const environment = app.node.tryGetContext('environment') || 'prod';
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT || '178625946981';

// VPC ID取得
const vpcId = process.env.VPC_ID || app.node.tryGetContext('vpcId');

// AgentCore設定取得
const agentCoreConfig = app.node.tryGetContext('agentCore');

console.log('🚀 SecurityStack デプロイ設定:');
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${region}`);
console.log(`   アカウント: ${account}`);
console.log(`   VPC ID: ${vpcId || '未指定'}`);
console.log(`   AgentCore有効: ${agentCoreConfig?.enabled ? 'Yes' : 'No'}`);

// タグ設定取得
const taggingConfig = PermissionAwareRAGTags.getStandardConfig(projectName, environment as any);
const tags = TaggingStrategy.generateCostAllocationTags(taggingConfig);

// SecurityStack作成
const securityStack = new SecurityStack(app, `TokyoRegion-${projectName}-${environment}-SecurityStack`, {
  env: {
    account,
    region,
  },
  projectName,
  environment,
  vpcId,
  agentCore: agentCoreConfig,
  config: {
    vpcId,
    project: {
      name: projectName,
    },
    environment,
    security: {
      kms: {
        enableKeyRotation: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
      waf: {
        enabled: false, // WAFは無効化（CloudFrontで使用）
      },
      guardDuty: {
        enabled: false,
      },
      cloudTrail: {
        enabled: false,
      },
    },
  },
});

// タグ適用
Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(securityStack).add(key, String(value));
});

console.log('✅ SecurityStack初期化完了');

app.synth();
