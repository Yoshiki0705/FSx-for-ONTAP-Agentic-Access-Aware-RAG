#!/usr/bin/env node
/**
 * Permission-aware RAG デモ環境 CDKエントリーポイント
 *
 * スタック構成:
 *   1. WafStack (us-east-1)     - CloudFront用WAF WebACL
 *   2. NetworkingStack           - VPC, Subnets, Security Groups
 *   3. SecurityStack             - Cognito User Pool
 *   4. StorageStack              - FSx ONTAP + SVM + Volume + S3 + DynamoDB
 *   5. AIStack                   - Bedrock KB + OpenSearch Serverless
 *   6. WebAppStack               - Lambda Web Adapter + CloudFront
 *   7. EmbeddingStack (optional) - FlexCache CIFS mount + Embedding Server
 *
 * オプション（CDKコンテキストパラメータ）:
 *   Phase 2: -c ontapMgmtIp=... -c ontapSvmUuid=... -c useS3AccessPoint=true
 *   Phase 3: -c usePermissionFilterLambda=true
 *   Phase 4: -c enableGuardrails=true -c enableKmsEncryption=true
 *            -c enableCloudTrail=true -c enableVpcEndpoints=true
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DemoWafStack } from '../lib/stacks/demo/demo-waf-stack';
import { DemoNetworkingStack } from '../lib/stacks/demo/demo-networking-stack';
import { DemoSecurityStack } from '../lib/stacks/demo/demo-security-stack';
import { DemoStorageStack } from '../lib/stacks/demo/demo-storage-stack';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';
import { DemoWebAppStack } from '../lib/stacks/demo/demo-webapp-stack';
import { DemoEmbeddingStack } from '../lib/stacks/demo/demo-embedding-stack';

const app = new cdk.App();

/** CDKコンテキストからboolean値を取得するヘルパー */
function ctxBool(key: string): boolean {
  const v = app.node.tryGetContext(key);
  return v === 'true' || v === true;
}

// 基本パラメータ
const projectName = app.node.tryGetContext('projectName') || 'perm-rag-demo';
const environment = app.node.tryGetContext('environment') || 'demo';
const allowedIps: string[] = app.node.tryGetContext('allowedIps') || [];
const allowedCountries: string[] = app.node.tryGetContext('allowedCountries') || ['JP'];
const adPassword: string | undefined = app.node.tryGetContext('adPassword');
const adDomainName: string | undefined = app.node.tryGetContext('adDomainName');

// Embeddingサーバー（オプション）
const enableEmbedding = ctxBool('enableEmbeddingServer');
const cifsdataVolName: string = app.node.tryGetContext('cifsdataVolName') || process.env.CIFSDATA_VOL_NAME || 'smb_share';
const ragdbVolPath: string = app.node.tryGetContext('ragdbVolPath') || process.env.RAGDB_VOL_PATH || '/smb_share/ragdb';
const embeddingAdSecretArn: string | undefined = app.node.tryGetContext('embeddingAdSecretArn');
const embeddingAdUserName: string = app.node.tryGetContext('embeddingAdUserName') || 'Admin';
const embeddingAdDomain: string = app.node.tryGetContext('embeddingAdDomain') || adDomainName || 'demo.local';

// Phase 2: ONTAP ACL自動取得 + S3 AP
const ontapMgmtIp: string | undefined = app.node.tryGetContext('ontapMgmtIp');
const ontapSvmUuid: string | undefined = app.node.tryGetContext('ontapSvmUuid');
const ontapAdminSecretArn: string | undefined = app.node.tryGetContext('ontapAdminSecretArn');
const useS3AccessPoint = ctxBool('useS3AccessPoint');

// Phase 3: Permission Filter Lambda
const usePermissionFilterLambda = ctxBool('usePermissionFilterLambda');

// Phase 4: セキュリティ強化
const enableGuardrails = ctxBool('enableGuardrails');
const enableKmsEncryption = ctxBool('enableKmsEncryption');
const enableCloudTrail = ctxBool('enableCloudTrail');
const enableVpcEndpoints = ctxBool('enableVpcEndpoints');

const primaryEnv: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};
const usEast1Env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};
const stackPrefix = `${projectName}-${environment}`;

// Stack 1: WafStack (us-east-1)
const wafStack = new DemoWafStack(app, `${stackPrefix}-Waf`, {
  projectName, environment, allowedIps,
  env: usEast1Env, crossRegionReferences: true,
  description: `[${projectName}] WAF WebACL for CloudFront (us-east-1)`,
});

// Stack 2: NetworkingStack
const networkingStack = new DemoNetworkingStack(app, `${stackPrefix}-Networking`, {
  projectName, environment,
  enableVpcEndpoints,
  env: primaryEnv,
  description: `[${projectName}] VPC, Subnets, Security Groups`,
});

// Stack 3: SecurityStack
const securityStack = new DemoSecurityStack(app, `${stackPrefix}-Security`, {
  projectName, environment,
  env: primaryEnv,
  description: `[${projectName}] Cognito User Pool, Authentication`,
});
securityStack.addDependency(networkingStack);

// Stack 4: StorageStack
const storageStack = new DemoStorageStack(app, `${stackPrefix}-Storage`, {
  projectName, environment,
  vpc: networkingStack.vpc,
  privateSubnets: networkingStack.privateSubnets,
  fsxSg: networkingStack.fsxSg,
  adPassword, adDomainName,
  enableKmsEncryption,
  enableCloudTrail,
  env: primaryEnv,
  description: `[${projectName}] FSx ONTAP + SVM + S3 + DynamoDB`,
});
storageStack.addDependency(networkingStack);

// Stack 5: AIStack
const aiStack = new DemoAIStack(app, `${stackPrefix}-AI`, {
  projectName, environment,
  dataBucket: storageStack.dataBucket,
  useS3AccessPoint,
  enableGuardrails,
  env: primaryEnv,
  description: `[${projectName}] Bedrock Knowledge Base, OpenSearch Serverless`,
});
aiStack.addDependency(storageStack);

// Stack 6: WebAppStack
const imageTag = app.node.tryGetContext('imageTag') || 'latest';
const webAppStack = new DemoWebAppStack(app, `${stackPrefix}-WebApp`, {
  projectName, environment,
  vpc: networkingStack.vpc,
  lambdaSg: networkingStack.lambdaSg,
  userPool: securityStack.userPool,
  userPoolClient: securityStack.userPoolClient,
  knowledgeBaseId: aiStack.knowledgeBaseId,
  imageUri: imageTag,
  wafWebAclArn: wafStack.webAclArn,
  permissionCacheTable: storageStack.permissionCacheTable,
  userAccessTable: storageStack.userAccessTable,
  dataBucket: storageStack.dataBucket,
  allowedCountries,
  usePermissionFilterLambda,
  env: primaryEnv, crossRegionReferences: true,
  description: `[${projectName}] Lambda Web Adapter + CloudFront (IAM Auth + OAC + WAF)`,
});
webAppStack.addDependency(aiStack);
webAppStack.addDependency(securityStack);
webAppStack.addDependency(wafStack);

// Stack 7 (Optional): EmbeddingStack
if (enableEmbedding) {
  if (!embeddingAdSecretArn) {
    throw new Error(
      'embeddingAdSecretArn is required when enableEmbeddingServer=true. ' +
      'Set via: -c embeddingAdSecretArn=arn:aws:secretsmanager:...',
    );
  }
  const embeddingStack = new DemoEmbeddingStack(app, `${stackPrefix}-Embedding`, {
    projectName, environment,
    vpc: networkingStack.vpc,
    privateSubnets: networkingStack.privateSubnets,
    ossCollection: aiStack.ossCollection,
    svm: storageStack.svm,
    adSecretArn: embeddingAdSecretArn,
    adUserName: embeddingAdUserName,
    adDomain: embeddingAdDomain,
    cifsdataVolName, ragdbVolPath,
    ontapMgmtIp,
    ontapSvmUuid,
    ontapAdminSecretArn,
    env: primaryEnv,
    description: `[${projectName}] Embedding Server (FlexCache CIFS mount)`,
  });
  embeddingStack.addDependency(storageStack);
  embeddingStack.addDependency(aiStack);
}

app.synth();
