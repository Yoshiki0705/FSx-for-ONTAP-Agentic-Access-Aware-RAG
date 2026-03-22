#!/usr/bin/env node
/**
 * Permission-aware RAG デモ環境 CDKエントリーポイント
 * 
 * KBモード専用のデモ環境を5スタック構成でデプロイする。
 * Agent Mode関連スタック（EmbeddingStack, OperationsStack）は除外。
 * 
 * スタック依存関係:
 *   NetworkingStack → SecurityStack → StorageStack → AIStack → WebAppStack
 * 
 * 使用方法:
 *   npx cdk deploy --all --app "npx ts-node bin/demo-app.ts"
 *   npx cdk destroy --all --app "npx ts-node bin/demo-app.ts"
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DemoNetworkingStack } from '../lib/stacks/demo/demo-networking-stack';
import { DemoSecurityStack } from '../lib/stacks/demo/demo-security-stack';
import { DemoStorageStack } from '../lib/stacks/demo/demo-storage-stack';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';
import { DemoWebAppStack } from '../lib/stacks/demo/demo-webapp-stack';

const app = new cdk.App();

// CDK contextパラメータ（cdk.jsonまたは-cオプションで上書き可能）
const projectName = app.node.tryGetContext('projectName') || 'perm-rag-demo';
const environment = app.node.tryGetContext('environment') || 'demo';

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

const stackPrefix = `${projectName}-${environment}`;

// ========================================
// Stack 1: NetworkingStack
// ========================================
const networkingStack = new DemoNetworkingStack(app, `${stackPrefix}-Networking`, {
  projectName,
  environment,
  env,
  description: `[${projectName}] VPC, Subnets, Security Groups`,
});

// ========================================
// Stack 2: SecurityStack
// ========================================
const securityStack = new DemoSecurityStack(app, `${stackPrefix}-Security`, {
  projectName,
  environment,
  env,
  description: `[${projectName}] Cognito User Pool, Authentication`,
});
securityStack.addDependency(networkingStack);

// ========================================
// Stack 3: StorageStack
// ========================================
const storageStack = new DemoStorageStack(app, `${stackPrefix}-Storage`, {
  projectName,
  environment,
  vpc: networkingStack.vpc,
  privateSubnets: networkingStack.privateSubnets,
  fsxSg: networkingStack.fsxSg,
  env,
  description: `[${projectName}] FSx for ONTAP, S3 Data Bucket`,
});
storageStack.addDependency(networkingStack);

// ========================================
// Stack 4: AIStack
// ========================================
const aiStack = new DemoAIStack(app, `${stackPrefix}-AI`, {
  projectName,
  environment,
  dataBucket: storageStack.dataBucket,
  env,
  description: `[${projectName}] Bedrock Knowledge Base, OpenSearch Serverless`,
});
aiStack.addDependency(storageStack);

// ========================================
// Stack 5: WebAppStack
// ========================================
const imageTag = app.node.tryGetContext('imageTag') || 'latest';
const webAppStack = new DemoWebAppStack(app, `${stackPrefix}-WebApp`, {
  projectName,
  environment,
  vpc: networkingStack.vpc,
  lambdaSg: networkingStack.lambdaSg,
  userPool: securityStack.userPool,
  userPoolClient: securityStack.userPoolClient,
  knowledgeBaseId: aiStack.knowledgeBaseId,
  imageUri: imageTag,
  env,
  description: `[${projectName}] Lambda Web Adapter (Next.js), CloudFront`,
});
webAppStack.addDependency(aiStack);
webAppStack.addDependency(securityStack);

app.synth();
