#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BedrockKnowledgeBaseS3VectorsStack } from '../lib/stacks/integrated/bedrock-kb-s3-vectors-stack';

/**
 * Bedrock Knowledge Base（S3 Vectors）デプロイメントアプリケーション
 * 
 * 使用方法:
 *   npx cdk deploy -a "npx ts-node bin/bedrock-kb-s3-vectors-app.ts" --region us-east-1
 * 
 * 環境変数:
 *   FSX_S3_ACCESS_POINT_ALIAS: FSx for ONTAP S3 Access Pointのエイリアス
 */

const app = new cdk.App();

// スタックの作成
new BedrockKnowledgeBaseS3VectorsStack(app, 'BedrockKnowledgeBaseS3VectorsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // Bedrock Knowledge Baseはus-east-1で作成
  },
  description: 'FSx for ONTAP S3 Access Point用のBedrock Knowledge Base（S3 Vectors使用）',
  tags: {
    Project: 'Permission-aware-RAG',
    Component: 'Bedrock-KB-S3Vectors',
    ManagedBy: 'CDK',
  },
});

app.synth();
