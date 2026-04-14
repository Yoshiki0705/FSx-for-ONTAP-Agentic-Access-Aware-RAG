#!/usr/bin/env node
/**
 * Permission-aware RAG デモ環境 CDKエントリーポイント
 *
 * スタック構成:
 *   1. WafStack (us-east-1)     - CloudFront用WAF WebACL
 *   2. NetworkingStack           - VPC, Subnets, Security Groups
 *   3. SecurityStack             - Cognito User Pool
 *   4. StorageStack              - FSx ONTAP + SVM + Volume + S3 + DynamoDB
 *   5. AIStack                   - Bedrock KB + OpenSearch Serverless + Agent
 *   6. WebAppStack               - Lambda Web Adapter + CloudFront
 *   7. EmbeddingStack (optional) - FlexCache CIFS mount + Embedding Server
 *
 * オプション（CDKコンテキストパラメータ）:
 *   -c enableAgent=true          Bedrock Agent + Action Group
 *   -c enableAdFederation=true   AD SAML Federation (Cognito + SAML IdP + Post-Auth Trigger)
 *   -c enableGuardrails=true     Bedrock Guardrails
 *   -c guardrailsConfig={}       Guardrails詳細設定（contentFilters, topicPolicies, piiConfig, contextualGrounding）
 *   -c enableKmsEncryption=true  KMS暗号化
 *   -c enableCloudTrail=true     CloudTrail監査ログ
 *   -c enableVpcEndpoints=true   VPCエンドポイント
 *   -c vectorStoreType=s3vectors    Vector store type (s3vectors or opensearch-serverless)
 *   -c enableAgentCoreMemory=true    AgentCore Memory (短期・長期メモリ)
 *   -c enableAdvancedPermissions=true 時間ベースアクセス制御 + 権限判定監査ログ
 *   -c enableMonitoring=true        CloudWatch Dashboard + SNS Alerts + EventBridge
 *   -c monitoringEmail=xxx          Alert notification email address
 *   -c enableAgentCoreObservability=true  AgentCore metrics on dashboard
 *   -c oidcProviderConfig={}        OIDC IdP設定（Keycloak, Okta, Entra ID等）
 *   -c oidcProviders=[]              複数OIDC IdP設定（oidcProviderConfigと排他）
 *   -c ldapConfig={}                LDAP接続設定（OpenLDAP, FreeIPA等）
 *   -c ontapNameMappingEnabled=true ONTAP name-mapping連携
 *   -c permissionMappingStrategy=xx 権限マッピング戦略（sid-only, uid-gid, hybrid）
 *   -c authFailureMode=fail-closed  認証失敗時の動作モード（fail-open, fail-closed）
 *   -c auditLogEnabled=true         認証監査ログ（DynamoDB監査テーブル）
 *   -c auditLogRetentionDays=90     監査ログ保持日数（デフォルト: 90日）
 *   -c enableAgentRegistry=true     Agent Registry統合（AgentCore Registry API）
 *   -c agentRegistryRegion=xxx      Agent Registry APIリージョン（デフォルト: デプロイリージョン）
 *   -c embeddingModel=xxx           埋め込みモデル（titan-text-v2, nova-multimodal）
 *   -c multimodalKbMode=xxx         マルチモーダルKBモード（replace, dual）
 *   -c enableVoiceChat=true         音声チャット（Amazon Nova Sonic）
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

// AD Federation
const enableAdFederation = ctxBool('enableAdFederation');
const cloudFrontUrl: string | undefined = app.node.tryGetContext('cloudFrontUrl');
const samlMetadataUrl: string | undefined = app.node.tryGetContext('samlMetadataUrl');
const adEc2InstanceId: string | undefined = app.node.tryGetContext('adEc2InstanceId');

// OIDC/LDAP設定（オプション）
const oidcProviderConfig = app.node.tryGetContext('oidcProviderConfig') as {
  providerName: string;
  clientId: string;
  clientSecret: string;
  issuerUrl: string;
  attributeMapping?: Record<string, string>;
  groupClaimName?: string;
} | undefined;
const oidcProviders = app.node.tryGetContext('oidcProviders') as Array<{
  providerName: string;
  clientId: string;
  clientSecret: string;
  issuerUrl: string;
  attributeMapping?: Record<string, string>;
  groupClaimName?: string;
}> | undefined;
const ldapConfig = app.node.tryGetContext('ldapConfig') as {
  ldapUrl: string;
  baseDn: string;
  bindDn: string;
  bindPasswordSecretArn: string;
  userSearchFilter?: string;
  groupSearchFilter?: string;
  tlsCaCertArn?: string;
  tlsRejectUnauthorized?: boolean;
  healthCheckEnabled?: boolean;
} | undefined;
const ontapNameMappingEnabled = ctxBool('ontapNameMappingEnabled');
const permissionMappingStrategy = app.node.tryGetContext('permissionMappingStrategy') as
  'sid-only' | 'uid-gid' | 'hybrid' | undefined;
const authFailureMode = app.node.tryGetContext('authFailureMode') as
  'fail-open' | 'fail-closed' | undefined;
const auditLogEnabled = ctxBool('auditLogEnabled');
const auditLogRetentionDays = parseInt(app.node.tryGetContext('auditLogRetentionDays'), 10) || 90;
const hasOidcProviders = !!(oidcProviders && oidcProviders.length > 0);

// Embeddingサーバー
const enableEmbedding = ctxBool('enableEmbeddingServer');
const cifsdataVolName: string = app.node.tryGetContext('cifsdataVolName') || process.env.CIFSDATA_VOL_NAME || 'smb_share';
const ragdbVolPath: string = app.node.tryGetContext('ragdbVolPath') || process.env.RAGDB_VOL_PATH || '/smb_share/ragdb';
const embeddingAdSecretArn: string | undefined = app.node.tryGetContext('embeddingAdSecretArn');
const embeddingAdUserName: string = app.node.tryGetContext('embeddingAdUserName') || 'Admin';
const embeddingAdDomain: string = app.node.tryGetContext('embeddingAdDomain') || adDomainName || 'demo.local';

// ONTAP ACL自動取得
const ontapMgmtIp: string | undefined = app.node.tryGetContext('ontapMgmtIp');
const ontapSvmUuid: string | undefined = app.node.tryGetContext('ontapSvmUuid');
const ontapAdminSecretArn: string | undefined = app.node.tryGetContext('ontapAdminSecretArn');

// オプション機能
const usePermissionFilterLambda = ctxBool('usePermissionFilterLambda');
const enableGuardrails = ctxBool('enableGuardrails');
const guardrailsConfig = app.node.tryGetContext('guardrailsConfig') as import('../lib/stacks/demo/demo-ai-stack').GuardrailsConfig | undefined;
const enableAgent = ctxBool('enableAgent');
const enableKmsEncryption = ctxBool('enableKmsEncryption');
const enableCloudTrail = ctxBool('enableCloudTrail');
const enableVpcEndpoints = ctxBool('enableVpcEndpoints');
const enableAgentSharing = ctxBool('enableAgentSharing');
const enableAgentSchedules = ctxBool('enableAgentSchedules');
const vectorStoreType = (app.node.tryGetContext('vectorStoreType') || 's3vectors') as string;

// AgentCore機能（オプション）
const enableAgentCoreMemory = ctxBool('enableAgentCoreMemory');
const enableEpisodicMemory = ctxBool('enableEpisodicMemory');

// Agent Registry（オプション）
const enableAgentRegistry = ctxBool('enableAgentRegistry');
const agentRegistryRegion: string | undefined = app.node.tryGetContext('agentRegistryRegion');

// 埋め込みモデル（オプション）
const embeddingModel: string | undefined = app.node.tryGetContext('embeddingModel');
const multimodalKbMode: string | undefined = app.node.tryGetContext('multimodalKbMode');

// 音声チャット（オプション）
const enableVoiceChat = ctxBool('enableVoiceChat');

// AgentCore Policy（オプション）
const enableAgentPolicy = ctxBool('enableAgentPolicy');
const policyFailureMode = (app.node.tryGetContext('policyFailureMode') || 'fail-open') as 'fail-open' | 'fail-closed';

// マルチエージェント協調（enableAgent=true 時はデフォルト有効）
// enableMultiAgent を明示的に false に設定した場合のみ無効化
// Bedrock Agent は待機コストゼロのため、有効化しても追加ランニングコストは発生しない
// （マルチAgentモードで実際にチャットした場合のみトークン消費が 3-6 倍になる）
const enableMultiAgentExplicit = app.node.tryGetContext('enableMultiAgent');
const enableMultiAgent = enableMultiAgentExplicit === false || enableMultiAgentExplicit === 'false'
  ? false
  : enableAgent; // enableAgent=true なら enableMultiAgent もデフォルト true
const supervisorRoutingMode = (app.node.tryGetContext('supervisorRoutingMode') || 'supervisor_router') as 'supervisor_router' | 'supervisor';
const supervisorAutoRouting = ctxBool('supervisorAutoRouting');
const enableVisionAgent = ctxBool('enableVisionAgent');
const defaultAgentMode = (app.node.tryGetContext('defaultAgentMode') || 'single') as 'single' | 'multi';
const retrievalMaxResults = parseInt(app.node.tryGetContext('retrievalMaxResults'), 10) || 5;
const mcpConnectors = app.node.tryGetContext('mcpConnectors') as Array<{
  connectorType: 'ontap-ops' | 'identity-access' | 'document-workflow';
  endpointUrl: string;
  allowedOperations: string[];
}> | undefined;
const collaboratorModels = app.node.tryGetContext('collaboratorModels') as Record<string, string> | undefined;

// 高度権限制御（オプション）
const enableAdvancedPermissions = ctxBool('enableAdvancedPermissions');

// 監視・アラート機能（オプション）
const enableMonitoring = ctxBool('enableMonitoring');
const monitoringEmail: string | undefined = app.node.tryGetContext('monitoringEmail');
const enableAgentCoreObservability = ctxBool('enableAgentCoreObservability');
const alarmEvaluationPeriods: number = parseInt(app.node.tryGetContext('alarmEvaluationPeriods'), 10) || 1;
const dashboardRefreshInterval: number = parseInt(app.node.tryGetContext('dashboardRefreshInterval'), 10) || 300;

// 既存FSx ONTAP参照（指定時はFSx/SVM/Volumeを新規作成しない）
const existingFileSystemId: string | undefined = app.node.tryGetContext('existingFileSystemId');
const existingSvmId: string | undefined = app.node.tryGetContext('existingSvmId');
const existingVolumeId: string | undefined = app.node.tryGetContext('existingVolumeId');

// ボリューム・S3 APユーザー設定
const volumeSecurityStyle = (app.node.tryGetContext('volumeSecurityStyle') || 'NTFS') as 'NTFS' | 'UNIX';
const s3apUserType = app.node.tryGetContext('s3apUserType') as 'WINDOWS' | 'UNIX' | undefined;
const s3apUserName: string | undefined = app.node.tryGetContext('s3apUserName');

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
  projectName, environment, enableVpcEndpoints,
  env: primaryEnv,
  description: `[${projectName}] VPC, Subnets, Security Groups`,
});

// Stack 3: StorageStack (before SecurityStack for AD Federation dependency)
const storageStack = new DemoStorageStack(app, `${stackPrefix}-Storage`, {
  projectName, environment,
  vpc: networkingStack.vpc,
  privateSubnets: networkingStack.privateSubnets,
  fsxSg: networkingStack.fsxSg,
  adPassword, adDomainName,
  enableKmsEncryption, enableCloudTrail,
  enableAdvancedPermissions,
  existingFileSystemId, existingSvmId, existingVolumeId,
  volumeSecurityStyle, s3apUserType, s3apUserName,
  env: primaryEnv,
  description: `[${projectName}] ${existingFileSystemId ? 'Existing FSx ONTAP + ' : 'FSx ONTAP + SVM + '}S3 + DynamoDB`,
});
storageStack.addDependency(networkingStack);

// Stack 4: SecurityStack
// adType決定ロジック: enableAdFederation=true の場合のみAD Sync Lambdaを作成
const adType = !enableAdFederation ? 'none'
  : adPassword ? 'managed'
  : adEc2InstanceId ? 'self-managed'
  : 'none';

const securityStack = new DemoSecurityStack(app, `${stackPrefix}-Security`, {
  projectName, environment,
  // AD Federation設定（条件付き）
  enableAdFederation,
  adType: adType as 'managed' | 'self-managed' | 'none',
  adDirectoryId: enableAdFederation && adType === 'managed' ? storageStack.managedAd?.ref : undefined,
  adDomainName: enableAdFederation ? adDomainName : undefined,
  adEc2InstanceId: enableAdFederation && adType === 'self-managed' ? adEc2InstanceId : undefined,
  samlMetadataUrl: enableAdFederation ? samlMetadataUrl : undefined,
  cloudFrontUrl: (enableAdFederation || oidcProviderConfig || hasOidcProviders) ? cloudFrontUrl : undefined,
  // AD Sync Lambda用
  vpc: networkingStack.vpc,
  lambdaSg: networkingStack.lambdaSg,
  userAccessTable: storageStack.userAccessTable,
  // OIDC/LDAP設定（オプション）
  oidcProviderConfig,
  oidcProviders,
  ldapConfig,
  ontapNameMappingEnabled,
  permissionMappingStrategy,
  authFailureMode,
  auditLogEnabled,
  auditLogRetentionDays,
  env: primaryEnv,
  description: `[${projectName}] Cognito User Pool, Authentication${enableAdFederation ? ', SAML Federation' : ''}${oidcProviderConfig ? ', OIDC Federation' : ''}${hasOidcProviders ? ', Multi-OIDC Federation' : ''}`,
});
securityStack.addDependency(networkingStack);
securityStack.addDependency(storageStack);

// Stack 5: AIStack
const aiStack = new DemoAIStack(app, `${stackPrefix}-AI`, {
  projectName, environment,
  enableGuardrails,
  guardrailsConfig,
  enableAgent,
  enableAgentSharing,
  enableAgentSchedules,
  enableAgentCoreMemory,
  enableEpisodicMemory: enableAgentCoreMemory && enableEpisodicMemory,
  enableMultiAgent,
  supervisorRoutingMode,
  supervisorAutoRouting,
  enableVisionAgent,
  defaultAgentMode,
  retrievalMaxResults,
  mcpConnectors,
  collaboratorModels,
  ontapNameMappingEnabled,
  agentLanguage: (app.node.tryGetContext('agentLanguage') as string) || 'auto',
  userAccessTableName: storageStack.userAccessTable.tableName,
  userAccessTableArn: storageStack.userAccessTable.tableArn,
  vectorStoreType: vectorStoreType as 's3vectors' | 'opensearch-serverless',
  enableAgentRegistry,
  agentRegistryRegion,
  embeddingModel,
  multimodalKbMode,
  enableVoiceChat,
  env: primaryEnv,
  description: `[${projectName}] Bedrock KB, ${vectorStoreType === 'opensearch-serverless' ? 'OpenSearch Serverless' : 'S3 Vectors'}${enableAgent ? ', Bedrock Agent' : ''}${enableMultiAgent ? ', Multi-Agent Collaboration' : ''}${enableAgentSharing ? ', Agent Sharing' : ''}${enableAgentSchedules ? ', Agent Schedules' : ''}`,
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
  allowedCountries,
  usePermissionFilterLambda,
  agentId: aiStack.agentId,
  agentAliasId: aiStack.agentAliasId,
  actionGroupLambdaArn: aiStack.actionGroupLambdaArn,
  sharedAgentBucketName: aiStack.sharedAgentBucketName,
  agentExecutionTableName: aiStack.agentExecutionTableName,
  agentSchedulerLambdaArn: aiStack.agentSchedulerLambdaArn,
  agentSchedulerRoleArn: aiStack.schedulerRoleArn,
  // AgentCore Memory（オプション）
  memoryId: aiStack.memoryId,
  // Episodic Memory（オプション）
  enableEpisodicMemory: enableAgentCoreMemory && enableEpisodicMemory,
  // マルチエージェント協調（オプション）
  supervisorAgentId: enableMultiAgent ? aiStack.supervisorAgentId : undefined,
  supervisorAgentAliasId: enableMultiAgent ? aiStack.supervisorAgentAliasId : undefined,
  defaultAgentMode: enableMultiAgent ? defaultAgentMode : 'single',
  agentTeamTableName: enableMultiAgent ? aiStack.agentTeamTableName : undefined,
  // 高度権限制御（オプション）
  permissionAuditTableName: storageStack.permissionAuditTable?.tableName,
  // 監視・アラート機能（オプション）
  enableMonitoring,
  monitoringEmail,
  enableAgentCoreObservability,
  alarmEvaluationPeriods,
  dashboardRefreshInterval,
  adSyncFunction: securityStack.adSyncFunction,
  agentSchedulerFunction: aiStack.agentSchedulerFunction,
  // OIDC Federation UI設定（オプション）
  oidcProviderName: oidcProviderConfig?.providerName,
  oidcProviders: hasOidcProviders
    ? oidcProviders!.map(p => ({ name: p.providerName, displayName: p.providerName }))
    : undefined,
  cognitoDomainUrl: securityStack.cognitoDomainUrl,
  // Federation設定（SAML or OIDC — いずれかが有効な場合に環境変数を設定）
  cognitoDomainPrefix: (enableAdFederation || oidcProviderConfig || hasOidcProviders) ? securityStack.cognitoDomainPrefix : undefined,
  cognitoClientSecret: (enableAdFederation || oidcProviderConfig || hasOidcProviders) ? securityStack.userPoolClient.userPoolClientSecret.unsafeUnwrap() : undefined,
  callbackUrl: (enableAdFederation || oidcProviderConfig || hasOidcProviders) && cloudFrontUrl ? `${cloudFrontUrl}/api/auth/callback` : undefined,
  idpName: enableAdFederation ? 'ActiveDirectory' : (oidcProviderConfig ? oidcProviderConfig.providerName : undefined),
  // Agent Registry設定（オプション）
  enableAgentRegistry: aiStack.enableAgentRegistry,
  agentRegistryRegion: aiStack.agentRegistryRegion,
  agentRegistryArn: app.node.tryGetContext('agentRegistryArn') as string | undefined,
  // Guardrails設定（オプション）
  guardrailId: enableGuardrails ? aiStack.guardrailId : undefined,
  guardrailVersion: enableGuardrails ? aiStack.guardrailVersion : undefined,
  // 音声チャット設定（オプション）
  enableVoiceChat,
  // AgentCore Policy設定（オプション）
  enableAgentPolicy,
  policyFailureMode: enableAgentPolicy ? policyFailureMode : undefined,
  env: primaryEnv, crossRegionReferences: true,
  description: `[${projectName}] Lambda Web Adapter + CloudFront`,
});
webAppStack.addDependency(aiStack);
webAppStack.addDependency(securityStack);
webAppStack.addDependency(wafStack);

// Stack 7 (Optional): EmbeddingStack
if (enableEmbedding) {
  if (!aiStack.ossCollection) {
    throw new Error('EmbeddingStack requires vectorStoreType=opensearch-serverless. Current: ' + vectorStoreType);
  }
  if (!embeddingAdSecretArn) {
    throw new Error('embeddingAdSecretArn is required when enableEmbeddingServer=true.');
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
    ontapMgmtIp, ontapSvmUuid, ontapAdminSecretArn,
    env: primaryEnv,
    description: `[${projectName}] Embedding Server (FlexCache CIFS mount)`,
  });
  embeddingStack.addDependency(storageStack);
  embeddingStack.addDependency(aiStack);
}

// App-level tags (applied to all stacks and resources)
const creatorTag = app.node.tryGetContext('creatorTag') || '';
if (creatorTag) {
  cdk.Tags.of(app).add('creator', creatorTag);
}
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
