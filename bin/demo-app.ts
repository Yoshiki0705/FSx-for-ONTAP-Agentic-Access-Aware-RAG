#!/usr/bin/env node
/**
 * Permission-aware RAG デモ環境 CDKエントリーポイント
 * 
 * KBモード専用のデモ環境を6スタック構成でデプロイする。
 * 
 * スタック構成:
 *   1. WafStack (us-east-1)     - CloudFront用WAF WebACL
 *   2. NetworkingStack           - VPC, Subnets, Security Groups
 *   3. SecurityStack             - Cognito User Pool
 *   4. StorageStack              - FSx ONTAP + SVM + Volume + S3 + DynamoDB
 *   5. AIStack                   - Bedrock KB + OpenSearch Serverless
 *   6. WebAppStack               - Lambda Web Adapter + CloudFront (IAM Auth + OAC + WAF)
 * 
 * 使用方法:
 *   npx cdk deploy --all --app "npx ts-node bin/demo-app.ts"
 *   npx cdk destroy --all --app "npx ts-node bin/demo-app.ts"
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DemoWafStack } from '../lib/stacks/demo/demo-waf-stack';
import { DemoNetworkingStack } from '../lib/stacks/demo/demo-networking-stack';
import { DemoSecurityStack } from '../lib/stacks/demo/demo-security-stack';
import { DemoStorageStack } from '../lib/stacks/demo/demo-storage-stack';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';
import { DemoWebAppStack } from '../lib/stacks/demo/demo-webapp-stack';

const app = new cdk.App();

// CDK contextパラメータ（cdk.jsonまたは-cオプションで上書き可能）
const projectName = app.node.tryGetContext('projectName') || 'perm-rag-demo';
const environment = app.node.tryGetContext('environment') || 'demo';
const allowedIps: string[] = app.node.tryGetContext('allowedIps') || [];
const allowedCountries: string[] = app.node.tryGetContext('allowedCountries') || ['JP'];

const primaryEnv: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// WAFはus-east-1にデプロイ（CloudFrontスコープの要件）
const usEast1Env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const stackPrefix = `${projectName}-${environment}`;

// ========================================
// Stack 1: WafStack (us-east-1)
// ========================================
const wafStack = new DemoWafStack(app, `${stackPrefix}-Waf`, {
  projectName,
  environment,
  allowedIps,
  env: usEast1Env,
  crossRegionReferences: true,
  description: `[${projectName}] WAF WebACL for CloudFront (us-east-1)`,
});

// ========================================
// Stack 2: NetworkingStack
// ========================================
const networkingStack = new DemoNetworkingStack(app, `${stackPrefix}-Networking`, {
  projectName,
  environment,
  env: primaryEnv,
  description: `[${projectName}] VPC, Subnets, Security Groups`,
});

// ========================================
// Stack 3: SecurityStack
// ========================================
const securityStack = new DemoSecurityStack(app, `${stackPrefix}-Security`, {
  projectName,
  environment,
  env: primaryEnv,
  description: `[${projectName}] Cognito User Pool, Authentication`,
});
securityStack.addDependency(networkingStack);

// ========================================
// Stack 4: StorageStack
// ========================================
const storageStack = new DemoStorageStack(app, `${stackPrefix}-Storage`, {
  projectName,
  environment,
  vpc: networkingStack.vpc,
  privateSubnets: networkingStack.privateSubnets,
  fsxSg: networkingStack.fsxSg,
  env: primaryEnv,
  description: `[${projectName}] FSx ONTAP + SVM + S3 + DynamoDB`,
});
storageStack.addDependency(networkingStack);

// ========================================
// Stack 5: AIStack
// ========================================
const aiStack = new DemoAIStack(app, `${stackPrefix}-AI`, {
  projectName,
  environment,
  dataBucket: storageStack.dataBucket,
  env: primaryEnv,
  description: `[${projectName}] Bedrock Knowledge Base, OpenSearch Serverless`,
});
aiStack.addDependency(storageStack);

// ========================================
// Stack 6: WebAppStack
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
  wafWebAclArn: wafStack.webAclArn,
  permissionCacheTable: storageStack.permissionCacheTable,
  userAccessTable: storageStack.userAccessTable,
  allowedCountries,
  env: primaryEnv,
  crossRegionReferences: true,
  description: `[${projectName}] Lambda Web Adapter + CloudFront (IAM Auth + OAC + WAF)`,
});
webAppStack.addDependency(aiStack);
webAppStack.addDependency(securityStack);
webAppStack.addDependency(wafStack);

app.synth();
