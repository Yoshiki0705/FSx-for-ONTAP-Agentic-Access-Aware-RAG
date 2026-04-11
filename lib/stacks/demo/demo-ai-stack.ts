/**
 * DemoAIStack
 * 
 * Bedrock Knowledge Base + OpenSearch Serverless（ベクトルストア）を作成する。
 * データソースはCDKデプロイ後にS3 Access Point経由で追加する（FSx ONTAP専用）。
 * 
 * データフロー:
 *   FSx ONTAP Volume → S3 Access Point → Bedrock KB データソース → AOSS
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from 'constructs';

/**
 * MCP Connector CDK構成インターフェース
 *
 * マルチエージェント協調で使用する外部MCP（Model Context Protocol）コネクタの
 * CDKデプロイ時設定を定義する。各コネクタは限定スコープの操作のみ許可される。
 */
export interface McpConnectorCdkConfig {
  /** コネクタ種別（ontap-ops: ONTAP操作、identity-access: ID/アクセス確認、document-workflow: ドキュメントワークフロー） */
  connectorType: 'ontap-ops' | 'identity-access' | 'document-workflow';
  /** MCP接続先エンドポイントURL */
  endpointUrl: string;
  /** 許可する操作の一覧 */
  allowedOperations: string[];
}

export interface DemoAIStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** Bedrock Guardrailsを有効化するか（デフォルト: false） */
  enableGuardrails?: boolean;
  /** Bedrock Agentを作成するか（デフォルト: false） */
  enableAgent?: boolean;
  /** ユーザーアクセスDynamoDBテーブル名（Agent Action Group用） */
  userAccessTableName?: string;
  /** ユーザーアクセスDynamoDBテーブルARN（Agent Action Group用） */
  userAccessTableArn?: string;
  /** ベクトルストア構成タイプ（デフォルト: 's3vectors'） */
  vectorStoreType?: 's3vectors' | 'opensearch-serverless';
  /** Agent共有S3バケットを作成するか（デフォルト: false） */
  enableAgentSharing?: boolean;
  /** スケジュール実行基盤を作成するか（デフォルト: false） */
  enableAgentSchedules?: boolean;
  /** AgentCore Memory（短期・長期メモリ）を有効化するか（デフォルト: false、enableAgent=true が前提条件） */
  enableAgentCoreMemory?: boolean;
  /** マルチエージェント協調を有効化するか（デフォルト: false） */
  enableMultiAgent?: boolean;
  /** Supervisorルーティングモード（デフォルト: 'supervisor_router'） */
  supervisorRoutingMode?: 'supervisor_router' | 'supervisor';
  /** 自動ルーティング有効化（デフォルト: false） */
  supervisorAutoRouting?: boolean;
  /** Vision Agent有効化（デフォルト: false） */
  enableVisionAgent?: boolean;
  /** デフォルトAgentモード（デフォルト: 'single'） */
  defaultAgentMode?: 'single' | 'multi';
  /** KB検索最大結果数（デフォルト: 5） */
  retrievalMaxResults?: number;
  /** MCP接続設定 */
  mcpConnectors?: McpConnectorCdkConfig[];
  /** Collaborator別Foundation Model指定 */
  collaboratorModels?: Record<string, string>;
  /** ONTAP name-mapping有効化（デフォルト: false） */
  ontapNameMappingEnabled?: boolean;
  /** Agent instruction の基本言語（デフォルト: 'auto' — ユーザーの入力言語に合わせて回答） */
  agentLanguage?: string;
}

export class DemoAIStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly ossCollection?: opensearchserverless.CfnCollection;
  /** S3 Vectors Bucket ARN（S3 Vectors構成時のみ設定） */
  public readonly vectorBucketArn?: string;
  /** S3 Vectors Index ARN（S3 Vectors構成時のみ設定） */
  public readonly vectorIndexArn?: string;
  /** Bedrock Guardrail ID */
  public readonly guardrailId?: string;
  /** Bedrock Guardrail Version */
  public readonly guardrailVersion?: string;
  /** Bedrock Agent ID */
  public readonly agentId?: string;
  /** Bedrock Agent Alias ID */
  public readonly agentAliasId?: string;
  /** Permission-aware search Action Group Lambda ARN */
  public readonly actionGroupLambdaArn?: string;
  /** Agent共有S3バケット名 */
  public readonly sharedAgentBucketName?: string;
  /** Agent実行履歴DynamoDBテーブル名 */
  public readonly agentExecutionTableName?: string;
  /** Agentスケジューラ Lambda ARN */
  public readonly agentSchedulerLambdaArn?: string;
  /** Agentスケジューラ Lambda関数（監視用） */
  public readonly agentSchedulerFunction?: lambda.Function;
  /** EventBridge Scheduler IAMロール ARN */
  public readonly schedulerRoleArn?: string;
  /** AgentCore Memory ID */
  public readonly memoryId?: string;
  /** AgentCore Memory ARN */
  public readonly memoryArn?: string;
  /** Permission Resolver Collaborator Agent（マルチエージェント用） */
  public readonly permissionResolverAgent?: bedrock.CfnAgent;
  /** Permission Resolver Agent ID */
  public readonly permissionResolverAgentId?: string;
  /** Retrieval Collaborator Agent（マルチエージェント用） */
  public readonly retrievalAgent?: bedrock.CfnAgent;
  /** Retrieval Agent ID */
  public readonly retrievalAgentId?: string;
  /** Analysis Collaborator Agent（マルチエージェント用） */
  public readonly analysisAgent?: bedrock.CfnAgent;
  /** Analysis Agent ID */
  public readonly analysisAgentId?: string;
  /** Output Collaborator Agent（マルチエージェント用） */
  public readonly outputAgent?: bedrock.CfnAgent;
  /** Output Agent ID */
  public readonly outputAgentId?: string;
  /** Vision Collaborator Agent（マルチエージェント用、enableVisionAgent=true 時のみ） */
  public readonly visionAgent?: bedrock.CfnAgent;
  /** Vision Agent ID */
  public readonly visionAgentId?: string;
  /** Supervisor Agent（マルチエージェント用） */
  public readonly supervisorAgent?: bedrock.CfnAgent;
  /** Supervisor Agent ID */
  public readonly supervisorAgentId?: string;
  /** Supervisor Agent Alias ID */
  public readonly supervisorAgentAliasId?: string;
  /** Agent Team DynamoDB テーブル名（enableMultiAgent=true 時のみ） */
  public readonly agentTeamTableName?: string;

  constructor(scope: Construct, id: string, props: DemoAIStackProps) {
    super(scope, id, props);

    // --- マルチエージェント関連バリデーション ---

    // Validation 1: enableMultiAgent requires enableAgent as prerequisite
    if (props.enableMultiAgent && !props.enableAgent) {
      throw new Error('enableMultiAgent requires enableAgent=true as a prerequisite');
    }

    // Validation 2: MCP connector type validation
    if (props.mcpConnectors && props.mcpConnectors.length > 0) {
      const allowedConnectorTypes = ['ontap-ops', 'identity-access', 'document-workflow'];
      for (const connector of props.mcpConnectors) {
        if (!allowedConnectorTypes.includes(connector.connectorType)) {
          throw new Error(
            `Invalid MCP connector type: '${connector.connectorType}'. Allowed: ontap-ops, identity-access, document-workflow`
          );
        }
      }

      // Validation 3: Forbidden MCP operations validation
      const forbiddenPatterns = ['shell', 'exec', 'rm -rf', 'file:write:*', 'screenshot', 'desktop'];
      for (const connector of props.mcpConnectors) {
        for (const op of connector.allowedOperations) {
          for (const pattern of forbiddenPatterns) {
            if (op.toLowerCase().includes(pattern.toLowerCase())) {
              throw new Error(`MCP connector operation '${op}' is not allowed for security reasons`);
            }
          }
        }
      }
    }

    // Validation 4: Multi-agent cost warning
    if (props.enableMultiAgent) {
      console.warn('Warning: Multi-agent mode increases token consumption by 3-6x per request');
    }

    // --- vectorStoreType バリデーション ---
    const validVectorStoreTypes = ['s3vectors', 'opensearch-serverless'];
    const vectorStoreType = props.vectorStoreType || 's3vectors';
    if (!validVectorStoreTypes.includes(vectorStoreType)) {
      throw new Error(
        `Invalid vectorStoreType: '${vectorStoreType}'. Valid values are: ${validVectorStoreTypes.join(', ')}`
      );
    }

    const { projectName, environment, enableGuardrails, enableAgent, userAccessTableName, userAccessTableArn } = props;
    const prefix = `${projectName}-${environment}`;
    const collectionName = `${projectName}-${environment}-vectors`.substring(0, 32).toLowerCase();
    const indexName = 'bedrock-knowledge-base-default-index';

    // Agent instruction の言語指示
    // 'auto' = ユーザーの入力言語に合わせて回答、それ以外 = 指定言語で回答
    const agentLang = props.agentLanguage || 'auto';
    const langInstruction = agentLang === 'auto'
      ? 'IMPORTANT: Always respond in the same language as the user\'s input. For example, if the user asks in Japanese, respond in Japanese. If the user asks in English, respond in English.'
      : `IMPORTANT: Always respond in ${agentLang}.`;

    // --- KB用IAMロール（共通ベースポリシー） ---
    // Task 3.2: 共通ポリシー（bedrock:InvokeModel + S3 AP読み取り）を先に定義し、
    // 構成固有ポリシーは後から追加する
    const commonPolicyStatements: iam.PolicyStatement[] = [
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`],
      }),
      // FSx ONTAP S3 Access Point経由のアクセス権限
      // S3 APエイリアスをBedrock KBデータソースとして使用
      // 注意: 一部のAWSサービスはバケットARN形式（arn:aws:s3:::alias）でアクセスするため、
      // アクセスポイントARN形式とバケットARN形式の両方を許可する
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:ListBucket', 's3:GetBucketLocation'],
        resources: [
          // アクセスポイントARN形式
          `arn:aws:s3:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:accesspoint/*`,
          `arn:aws:s3:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:accesspoint/*/object/*`,
          // バケットARN形式（S3 APエイリアス経由のアクセス用）
          `arn:aws:s3:::${prefix}-*-ext-s3alias`,
          `arn:aws:s3:::${prefix}-*-ext-s3alias/*`,
          // S3データバケットへの直接アクセス（フォールバック用）
          `arn:aws:s3:::${prefix}-kb-data-${cdk.Aws.ACCOUNT_ID}`,
          `arn:aws:s3:::${prefix}-kb-data-${cdk.Aws.ACCOUNT_ID}/*`,
        ],
      }),
    ];

    const kbRole = new iam.Role(this, 'KbRole', {
      roleName: `${prefix}-kb-role`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockKbPolicy: new iam.PolicyDocument({
          statements: commonPolicyStatements,
        }),
      },
    });

    // --- 条件分岐: vectorStoreType に基づくリソース作成 ---
    // Task 3.1: S3 Vectors と OpenSearch Serverless の条件分岐
    let kb: bedrock.CfnKnowledgeBase;

    if (vectorStoreType === 's3vectors') {
      // === S3 Vectors 構成 ===
      const { vectorBucketArn, vectorIndexArn, vectorIndexName } = this.createS3VectorsResources(prefix);
      this.vectorBucketArn = vectorBucketArn;
      this.vectorIndexArn = vectorIndexArn;

      // Task 3.2: S3 Vectors固有IAMポリシー
      // Note: Use wildcard resource to avoid circular dependency with CustomResource GetAtt.
      // Bedrock KB validates s3vectors permissions during creation, so the policy must be ready first.
      kbRole.addToPolicy(new iam.PolicyStatement({
        actions: [
          's3vectors:QueryVectors',
          's3vectors:PutVectors',
          's3vectors:DeleteVectors',
          's3vectors:GetVectors',
          's3vectors:ListVectors',
        ],
        resources: [
          `arn:aws:s3vectors:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:bucket/${prefix}-vectors`,
          `arn:aws:s3vectors:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:bucket/${prefix}-vectors/*`,
        ],
      }));

      // Bedrock Knowledge Base（S3 Vectors構成）
      kb = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
        name: `${prefix}-kb`,
        roleArn: kbRole.roleArn,
        knowledgeBaseConfiguration: {
          type: 'VECTOR',
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`,
          },
        },
        storageConfiguration: {
          type: 'S3_VECTORS',
          s3VectorsConfiguration: {
            vectorBucketArn: vectorBucketArn,
            indexArn: vectorIndexArn,
          },
        },
      });

    } else {
      // === OpenSearch Serverless 構成（既存ロジック維持） ===

      // --- OpenSearch Serverless ポリシー ---
      const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'OssEncryptionPolicy', {
        name: `${collectionName}-enc`,
        type: 'encryption',
        policy: JSON.stringify({
          Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
          AWSOwnedKey: true,
        }),
      });

      const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'OssNetworkPolicy', {
        name: `${collectionName}-net`,
        type: 'network',
        policy: JSON.stringify([{
          Rules: [
            { ResourceType: 'collection', Resource: [`collection/${collectionName}`] },
            { ResourceType: 'dashboard', Resource: [`collection/${collectionName}`] },
          ],
          AllowFromPublic: true,
        }]),
      });

      // --- OpenSearch Serverless コレクション ---
      const ossCollection = new opensearchserverless.CfnCollection(this, 'OssCollection', {
        name: collectionName,
        type: 'VECTORSEARCH',
        description: `Vector store for ${projectName} Knowledge Base`,
      });
      ossCollection.addDependency(encryptionPolicy);
      ossCollection.addDependency(networkPolicy);
      this.ossCollection = ossCollection;

      // Task 3.2: AOSS固有IAMポリシー
      kbRole.addToPolicy(new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll'],
        resources: [ossCollection.attrArn],
      }));

      // --- インデックス作成用Lambda ---
      const indexCreatorFn = new lambda.Function(this, 'OssIndexCreator', {
        functionName: `${prefix}-oss-index-creator`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        timeout: cdk.Duration.minutes(10),
        memorySize: 256,
        code: lambda.Code.fromInline(this.getIndexCreatorCode()),
      });

      indexCreatorFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll'],
        resources: [ossCollection.attrArn],
      }));

      // --- データアクセスポリシー ---
      const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'OssDataAccessPolicy', {
        name: `${collectionName}-dat`,
        type: 'data',
        policy: cdk.Fn.join('', [
          '[{"Rules":[{"ResourceType":"collection","Resource":["collection/',
          collectionName,
          '"],"Permission":["aoss:CreateCollectionItems","aoss:UpdateCollectionItems","aoss:DescribeCollectionItems","aoss:DeleteCollectionItems"]},{"ResourceType":"index","Resource":["index/',
          collectionName,
          '/*"],"Permission":["aoss:CreateIndex","aoss:UpdateIndex","aoss:DescribeIndex","aoss:DeleteIndex","aoss:ReadDocument","aoss:WriteDocument"]}],"Principal":["',
          kbRole.roleArn,
          '","',
          indexCreatorFn.role!.roleArn,
          '","arn:aws:iam::',
          cdk.Aws.ACCOUNT_ID,
          ':root"]}]',
        ]),
      });

      // --- カスタムリソースでインデックス作成 ---
      const ossIndex = new cdk.CustomResource(this, 'OssIndex', {
        serviceToken: indexCreatorFn.functionArn,
        properties: {
          CollectionEndpoint: ossCollection.attrCollectionEndpoint,
          IndexName: indexName,
          Timestamp: Date.now().toString(),
        },
      });

      indexCreatorFn.addPermission('CfnInvoke', {
        principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
      });

      ossIndex.node.addDependency(ossCollection);
      ossIndex.node.addDependency(dataAccessPolicy);

      // Bedrock Knowledge Base（OpenSearch Serverless構成）
      kb = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
        name: `${prefix}-kb`,
        roleArn: kbRole.roleArn,
        knowledgeBaseConfiguration: {
          type: 'VECTOR',
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`,
          },
        },
        storageConfiguration: {
          type: 'OPENSEARCH_SERVERLESS',
          opensearchServerlessConfiguration: {
            collectionArn: ossCollection.attrArn,
            vectorIndexName: indexName,
            fieldMapping: {
              vectorField: 'bedrock-knowledge-base-default-vector',
              textField: 'AMAZON_BEDROCK_TEXT_CHUNK',
              metadataField: 'AMAZON_BEDROCK_METADATA',
            },
          },
        },
      });
      kb.node.addDependency(ossIndex);
    }

    this.knowledgeBaseId = kb.attrKnowledgeBaseId;

    // --- KB削除前クリーンアップ（カスタムリソース） ---
    // CDK外で追加されたデータソースをKB削除前に自動削除する
    const kbCleanupFn = new lambda.Function(this, 'KbCleanupFn', {
      functionName: `${prefix}-kb-cleanup`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(10),
      code: lambda.Code.fromInline(`
const { BedrockAgentClient, ListDataSourcesCommand, DeleteDataSourceCommand, GetDataSourceCommand, UpdateDataSourceCommand } = require('@aws-sdk/client-bedrock-agent');
const https = require('https');
async function sendCfnResponse(event, status, physicalId, reason) {
  const body = JSON.stringify({ Status: status, Reason: reason || '', PhysicalResourceId: physicalId || 'kb-cleanup', StackId: event.StackId, RequestId: event.RequestId, LogicalResourceId: event.LogicalResourceId });
  const u = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'PUT', headers: { 'Content-Type': '', 'Content-Length': body.length } }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
    req.on('error', reject); req.write(body); req.end();
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteDataSourceWithRetry(client, kbId, ds) {
  const dsId = ds.dataSourceId;
  console.log('Deleting data source:', dsId, 'status:', ds.status);
  try {
    await client.send(new DeleteDataSourceCommand({ knowledgeBaseId: kbId, dataSourceId: dsId }));
    // 削除完了を待機（最大60秒）
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      try {
        const check = await client.send(new GetDataSourceCommand({ knowledgeBaseId: kbId, dataSourceId: dsId }));
        const st = check.dataSource?.status;
        if (st === 'DELETE_UNSUCCESSFUL') {
          console.log('Data source', dsId, 'DELETE_UNSUCCESSFUL — switching to RETAIN policy');
          // dataDeletionPolicy を RETAIN に変更して再削除
          const cfg = check.dataSource.dataSourceConfiguration;
          await client.send(new UpdateDataSourceCommand({
            knowledgeBaseId: kbId, dataSourceId: dsId,
            name: check.dataSource.name,
            dataDeletionPolicy: 'RETAIN',
            dataSourceConfiguration: cfg,
          }));
          await sleep(2000);
          await client.send(new DeleteDataSourceCommand({ knowledgeBaseId: kbId, dataSourceId: dsId }));
          await sleep(10000);
          console.log('Data source', dsId, 'deleted with RETAIN policy');
          return;
        }
        console.log('Data source', dsId, 'status:', st);
      } catch (e) {
        if (e.name === 'ResourceNotFoundException') { console.log('Data source', dsId, 'deleted'); return; }
        throw e;
      }
    }
  } catch (e) {
    console.warn('Delete failed for', dsId, ':', e.message);
    // フォールバック: RETAIN に変更して再試行
    try {
      const info = await client.send(new GetDataSourceCommand({ knowledgeBaseId: kbId, dataSourceId: dsId }));
      if (info.dataSource?.dataDeletionPolicy !== 'RETAIN') {
        await client.send(new UpdateDataSourceCommand({
          knowledgeBaseId: kbId, dataSourceId: dsId,
          name: info.dataSource.name,
          dataDeletionPolicy: 'RETAIN',
          dataSourceConfiguration: info.dataSource.dataSourceConfiguration,
        }));
        await sleep(2000);
      }
      await client.send(new DeleteDataSourceCommand({ knowledgeBaseId: kbId, dataSourceId: dsId }));
      await sleep(10000);
      console.log('Data source', dsId, 'deleted with RETAIN fallback');
    } catch (e2) { console.warn('RETAIN fallback also failed for', dsId, ':', e2.message); }
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  if (event.RequestType !== 'Delete') { await sendCfnResponse(event, 'SUCCESS', 'kb-cleanup'); return; }
  const kbId = event.ResourceProperties.KnowledgeBaseId;
  const region = process.env.AWS_REGION;
  try {
    const client = new BedrockAgentClient({ region });
    const ds = await client.send(new ListDataSourcesCommand({ knowledgeBaseId: kbId }));
    for (const s of (ds.dataSourceSummaries || [])) {
      await deleteDataSourceWithRetry(client, kbId, s);
    }
    if ((ds.dataSourceSummaries || []).length > 0) await sleep(5000);
  } catch (e) { console.warn('Cleanup error (non-fatal):', e.message); }
  await sendCfnResponse(event, 'SUCCESS', 'kb-cleanup');
};
      `),
    });
    kbCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:ListDataSources', 'bedrock:DeleteDataSource', 'bedrock:GetDataSource', 'bedrock:UpdateDataSource'],
      resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/*`],
    }));
    kbCleanupFn.addPermission('CfnInvoke', {
      principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });
    const kbCleanup = new cdk.CustomResource(this, 'KbCleanup', {
      serviceToken: kbCleanupFn.functionArn,
      properties: { KnowledgeBaseId: kb.attrKnowledgeBaseId, Timestamp: Date.now().toString() },
    });
    kbCleanup.node.addDependency(kb);
    // KBはクリーンアップ完了後に削除される（CloudFormationの依存関係）

    // --- データソース ---
    // データソースはCDKデプロイ時には作成しない。
    // FSx ONTAP S3 Access Pointが利用可能になった後（SVM AD参加 + S3 AP作成後）に
    // demo-data/scripts/setup-kb-datasource.sh で追加する。
    //
    // データフロー:
    //   1. CDKデプロイ → KB + AOSS作成（データソースなし）
    //   2. SVM AD参加（手動 or スクリプト）
    //   3. S3 AP作成（手動 or スクリプト）
    //   4. setup-kb-datasource.sh → S3 APデータソース追加 + 同期
    //
    // 参考: https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/s3-access-points.html

    new cdk.CfnOutput(this, 'DataSourceType', {
      value: 'S3_ACCESS_POINT (post-deploy)',
      description: 'KB data source: FSx ONTAP S3 AP. Run setup-kb-datasource.sh after SVM AD join + S3 AP creation.',
    });

    // --- Bedrock Guardrails（オプション） ---
    // コンテンツ安全性フィルタリング: 有害コンテンツ、PII、プロンプトインジェクション対策
    if (enableGuardrails) {
      const guardrail = new bedrock.CfnGuardrail(this, 'Guardrail', {
        name: `${prefix}-guardrail`,
        blockedInputMessaging: 'この入力はセキュリティポリシーにより拒否されました。',
        blockedOutputsMessaging: 'この回答はセキュリティポリシーにより制限されました。',
        contentPolicyConfig: {
          filtersConfig: [
            { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
            { type: 'VIOLENCE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
            { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
            { type: 'INSULTS', inputStrength: 'HIGH', outputStrength: 'HIGH' },
            { type: 'MISCONDUCT', inputStrength: 'HIGH', outputStrength: 'HIGH' },
            { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
          ],
        },
        sensitiveInformationPolicyConfig: {
          piiEntitiesConfig: [
            { type: 'EMAIL', action: 'ANONYMIZE' },
            { type: 'PHONE', action: 'ANONYMIZE' },
            { type: 'NAME', action: 'ANONYMIZE' },
            { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
            { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
          ],
        },
      });

      this.guardrailId = guardrail.attrGuardrailId;
      this.guardrailVersion = 'DRAFT';

      new cdk.CfnOutput(this, 'GuardrailId', {
        value: guardrail.attrGuardrailId,
        description: 'Bedrock Guardrail ID for content safety filtering',
        exportName: `${prefix}-GuardrailId`,
      });
    }

    // --- Bedrock Agent + Permission-aware Action Group（オプション） ---
    if (enableAgent) {
      // Foundation Model shared by the existing single agent and used as the
      // default fallback for all multi-agent Collaborators/Supervisor when
      // `collaboratorModels` is not specified (Requirement 12.5).
      const singleAgentModel = 'anthropic.claude-3-haiku-20240307-v1:0';
      // Action Group Lambda: Permission-aware KB検索
      const actionGroupFn = new lambda.Function(this, 'PermSearchFn', {
        functionName: `${prefix}-perm-search`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        code: lambda.Code.fromInline(this.getPermSearchCode()),
        environment: {
          KNOWLEDGE_BASE_ID: kb.attrKnowledgeBaseId,
          USER_ACCESS_TABLE_NAME: userAccessTableName || '',
        },
      });

      // Action Group LambdaのIAM権限
      actionGroupFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['bedrock:Retrieve'],
        resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/*`],
      }));
      if (userAccessTableArn) {
        actionGroupFn.addToRolePolicy(new iam.PolicyStatement({
          actions: ['dynamodb:GetItem'],
          resources: [userAccessTableArn],
        }));
      }

      // Bedrock Agent用IAMロール
      const agentRole = new iam.Role(this, 'AgentRole', {
        roleName: `${prefix}-agent-role`,
        assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        inlinePolicies: {
          AgentPolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
              }),
              new iam.PolicyStatement({
                actions: ['bedrock:Retrieve'],
                resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${kb.attrKnowledgeBaseId}`],
              }),
            ],
          }),
        },
      });

      // Bedrock Agent
      // KB紐づけはAction Group経由で行うため、knowledgeBasesは設定しない
      // これにより、AgentはAction Group（Permission-aware Search）経由でのみKBにアクセスする
      const agent = new bedrock.CfnAgent(this, 'Agent', {
        agentName: `${prefix}-agent`,
        agentResourceRoleArn: agentRole.roleArn,
        foundationModel: singleAgentModel,
        autoPrepare: true,
        instruction: `You are a Permission-aware RAG system AI agent.
For every user question, you MUST use the permissionAwareSearch function to search documents before answering.
This function returns only documents filtered by the user's access permissions.
Based on the search results, generate an accurate and concise answer.
Do NOT answer without using permissionAwareSearch first. Always search before responding.
${langInstruction}`,
        description: 'Permission-aware RAG Agent with SID-based document filtering',
        idleSessionTtlInSeconds: 600,
        // knowledgeBases は設定しない（Action Group経由でPermission-awareにアクセス）
        actionGroups: [{
          actionGroupName: 'PermissionAwareSearch',
          description: 'SID-based permission-aware document search',
          actionGroupExecutor: { lambda: actionGroupFn.functionArn },
          apiSchema: {
            payload: JSON.stringify({
              openapi: '3.0.0',
              info: { title: 'Permission-aware Search', version: '2.0.0' },
              paths: {
                '/search': {
                  post: {
                    operationId: 'permissionAwareSearch',
                    summary: 'Permission-aware document search',
                    description: 'Search documents filtered by user SID permissions',
                    requestBody: {
                      required: true,
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              query: { type: 'string', description: '検索クエリ' },
                              maxResults: { type: 'integer', description: '最大結果数', default: 5 },
                            },
                            required: ['query'],
                          },
                        },
                      },
                    },
                    responses: { '200': { description: '検索成功' } },
                  },
                },
              },
            }),
          },
        }],
      });

      // Action Group LambdaへのBedrock Agent呼び出し権限
      actionGroupFn.addPermission('BedrockAgentInvoke', {
        principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        sourceArn: agent.attrAgentArn,
      });

      // Agent Alias
      const agentAlias = new bedrock.CfnAgentAlias(this, 'AgentAlias', {
        agentId: agent.attrAgentId,
        agentAliasName: `${prefix}-alias`,
        description: 'Permission-aware RAG Agent alias',
      });

      this.agentId = agent.attrAgentId;
      this.agentAliasId = agentAlias.attrAgentAliasId;
      this.actionGroupLambdaArn = actionGroupFn.functionArn;

      new cdk.CfnOutput(this, 'AgentId', {
        value: agent.attrAgentId,
        description: 'Bedrock Agent ID',
        exportName: `${prefix}-AgentId`,
      });
      new cdk.CfnOutput(this, 'AgentAliasId', {
        value: agentAlias.attrAgentAliasId,
        description: 'Bedrock Agent Alias ID',
        exportName: `${prefix}-AgentAliasId`,
      });
      new cdk.CfnOutput(this, 'ActionGroupLambda', {
        value: actionGroupFn.functionArn,
        description: 'Permission-aware search Action Group Lambda ARN',
      });

      // --- AgentCore Memory（オプション: enableAgentCoreMemory=true 時のみ） ---
      if (props.enableAgentCoreMemory) {
        // Memory用IAMロール
        const memoryRole = new iam.Role(this, 'MemoryRole', {
          assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
          inlinePolicies: {
            MemoryPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: [
                    'bedrock:InvokeModel',
                  ],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                }),
              ],
            }),
          },
        });

        // CfnMemory リソース作成（semantic + summary 戦略）
        const memory = new bedrockagentcore.CfnMemory(this, 'AgentMemory', {
          name: `${prefix.replace(/-/g, '_')}_memory`,
          eventExpiryDuration: 3, // 3日（短期メモリTTL、最小値）
          memoryExecutionRoleArn: memoryRole.roleArn,
          memoryStrategies: [
            { semanticMemoryStrategy: { name: 'semantic' } },
            { summaryMemoryStrategy: { name: 'summary' } },
          ],
        });

        // CfnMemory の Tags はマップ形式（{ key: value }）を要求するため、
        // CDKデフォルトの配列形式タグを上書きする
        memory.addPropertyOverride('Tags', {
          Project: projectName,
          Environment: environment,
          ManagedBy: 'CDK',
        });

        this.memoryId = memory.attrMemoryId;
        this.memoryArn = memory.attrMemoryArn;

        new cdk.CfnOutput(this, 'MemoryId', {
          value: memory.attrMemoryId,
          description: 'AgentCore Memory ID',
          exportName: `${prefix}-MemoryId`,
        });
        new cdk.CfnOutput(this, 'MemoryArn', {
          value: memory.attrMemoryArn,
          description: 'AgentCore Memory ARN',
          exportName: `${prefix}-MemoryArn`,
        });
      }

      // =================================================================
      // Backward Compatibility Guarantee
      // =================================================================
      // When `enableMultiAgent` is `false` (default) or undefined, NO multi-agent
      // resources are created. The existing Single Agent Mode construction above
      // (Agent + PermissionAwareSearch Action Group + Agent Alias) is fully
      // preserved and unaffected by the multi-agent additions below.
      //
      // All multi-agent resources — Collaborator Agents (Permission Resolver,
      // Retrieval, Analysis, Output, Vision), Supervisor Agent, their IAM roles,
      // Action Groups, Lambdas, Aliases, and CloudFormation outputs — are
      // exclusively created inside the `if (props.enableMultiAgent)` block.
      //
      // When `collaboratorModels` is not specified, all Collaborator Agents and
      // the Supervisor Agent use the same Foundation Model as the existing single
      // agent (`singleAgentModel`) to ensure consistent behavior.
      //
      // Requirements: 1.6, 11.1, 12.4, 12.5
      // =================================================================

      // =================================================================
      // --- マルチエージェント協調 Collaborator Agents（enableMultiAgent=true 時のみ） ---
      // =================================================================
      if (props.enableMultiAgent) {
        const permResolverModel = props.collaboratorModels?.['permission-resolver']
          || singleAgentModel;

        // --- Permission Resolver Agent ---
        // IAMロール: bedrock:InvokeModel + dynamodb:GetItem（User Access Table）
        const permResolverRole = new iam.Role(this, 'PermResolverAgentRole', {
          roleName: `${prefix}-perm-resolver-role`,
          assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          inlinePolicies: {
            PermResolverPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                }),
                ...(userAccessTableArn ? [new iam.PolicyStatement({
                  actions: ['dynamodb:GetItem'],
                  resources: [userAccessTableArn],
                })] : []),
              ],
            }),
          },
        });

        // Action Group Lambda: resolvePermissions — ユーザーIDからSID/UID/GID/グループを解決
        const resolvePermFn = new lambda.Function(this, 'ResolvePermFn', {
          functionName: `${prefix}-resolve-perm`,
          runtime: lambda.Runtime.NODEJS_22_X,
          handler: 'index.handler',
          timeout: cdk.Duration.seconds(30),
          memorySize: 256,
          code: lambda.Code.fromInline(this.getResolvePermissionsCode()),
          environment: {
            USER_ACCESS_TABLE_NAME: userAccessTableName || '',
          },
        });

        // Lambda IAM: DynamoDB読み取り権限
        if (userAccessTableArn) {
          resolvePermFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['dynamodb:GetItem'],
            resources: [userAccessTableArn],
          }));
        }

        // Permission Resolver Agent（Collaborator）
        const actionGroups: bedrock.CfnAgent.AgentActionGroupProperty[] = [{
          actionGroupName: 'resolvePermissions',
          description: 'Resolve userId to SID/UID/GID/groups from User Access Table',
          actionGroupExecutor: { lambda: resolvePermFn.functionArn },
          apiSchema: {
            payload: JSON.stringify({
              openapi: '3.0.0',
              info: { title: 'Permission Resolution', version: '1.0.0' },
              paths: {
                '/resolve': {
                  post: {
                    operationId: 'resolvePermissions',
                    summary: 'Resolve user permissions',
                    description: 'Resolve userId to SID, group SIDs, UID, GID, and UNIX groups',
                    requestBody: {
                      required: true,
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              userId: { type: 'string', description: 'ユーザーID' },
                            },
                            required: ['userId'],
                          },
                        },
                      },
                    },
                    responses: { '200': { description: '権限解決成功' } },
                  },
                },
              },
            }),
          },
        }];

        // ONTAP name-mapping Action Group（ontapNameMappingEnabled=true 時のみ追加）
        if (props.ontapNameMappingEnabled) {
          actionGroups.push({
            actionGroupName: 'ontapNameMapping',
            description: 'ONTAP REST API name-mapping resolution for UNIX/Windows identity mapping',
            actionGroupExecutor: { lambda: resolvePermFn.functionArn },
            apiSchema: {
              payload: JSON.stringify({
                openapi: '3.0.0',
                info: { title: 'ONTAP Name Mapping', version: '1.0.0' },
                paths: {
                  '/name-mapping': {
                    post: {
                      operationId: 'resolveNameMapping',
                      summary: 'Resolve ONTAP name mapping',
                      description: 'Resolve UNIX-to-Windows or Windows-to-UNIX name mapping via ONTAP REST API',
                      requestBody: {
                        required: true,
                        content: {
                          'application/json': {
                            schema: {
                              type: 'object',
                              properties: {
                                userId: { type: 'string', description: 'ユーザーID' },
                                direction: { type: 'string', enum: ['unix-to-windows', 'windows-to-unix'], description: 'マッピング方向' },
                              },
                              required: ['userId'],
                            },
                          },
                        },
                      },
                      responses: { '200': { description: 'Name mapping解決成功' } },
                    },
                  },
                },
              }),
            },
          });
        }

        const permResolverAgent = new bedrock.CfnAgent(this, 'PermResolverAgent', {
          agentName: `${prefix}-perm-resolver`,
          agentResourceRoleArn: permResolverRole.roleArn,
          foundationModel: permResolverModel,
          autoPrepare: true,
          instruction: `You are a Permission Resolver agent for the Permission-aware RAG system.
Receive a userId and resolve the corresponding SID (Security Identifier), group SIDs, UID, GID, and UNIX group information from the User Access Table.
Use the resolvePermissions function to retrieve permission information and return it as a structured Filtered Context.
If the user's permission information does not exist in the User Access Table, set the access denied flag based on the Fail-Closed principle.
${langInstruction}`,
          description: 'Permission Resolver Collaborator Agent — resolves userId to SID/UID/GID/groups',
          idleSessionTtlInSeconds: 600,
          actionGroups: actionGroups,
        });

        // Lambda にBedrock Agent呼び出し権限を付与
        resolvePermFn.addPermission('BedrockAgentInvoke', {
          principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          sourceArn: permResolverAgent.attrAgentArn,
        });

        // クラスプロパティに保存（Supervisor Agent統合用）
        (this as any).permissionResolverAgent = permResolverAgent;
        (this as any).permissionResolverAgentId = permResolverAgent.attrAgentId;

        new cdk.CfnOutput(this, 'PermissionResolverAgentId', {
          value: permResolverAgent.attrAgentId,
          description: 'Permission Resolver Collaborator Agent ID',
          exportName: `${prefix}-PermResolverAgentId`,
        });

        // --- Retrieval Agent ---
        const retrievalModel = props.collaboratorModels?.['retrieval']
          || singleAgentModel;
        const retrievalMaxResults = props.retrievalMaxResults ?? 5;

        // IAMロール: bedrock:InvokeModel + bedrock:Retrieve（KB）
        const retrievalAgentRole = new iam.Role(this, 'RetrievalAgentRole', {
          roleName: `${prefix}-retrieval-agent-role`,
          assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          inlinePolicies: {
            RetrievalAgentPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                }),
                new iam.PolicyStatement({
                  actions: ['bedrock:Retrieve'],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${kb.attrKnowledgeBaseId}`],
                }),
              ],
            }),
          },
        });

        // Action Group Lambda: filteredSearch — フィルタ条件付きKB検索
        const filteredSearchFn = new lambda.Function(this, 'FilteredSearchFn', {
          functionName: `${prefix}-filtered-search`,
          runtime: lambda.Runtime.NODEJS_22_X,
          handler: 'index.handler',
          timeout: cdk.Duration.seconds(30),
          memorySize: 256,
          code: lambda.Code.fromInline(this.getFilteredSearchCode()),
          environment: {
            KNOWLEDGE_BASE_ID: kb.attrKnowledgeBaseId,
            MAX_RESULTS: String(retrievalMaxResults),
            USER_ACCESS_TABLE_NAME: userAccessTableName || '',
          },
        });

        // Lambda IAM: KB Retrieve権限
        filteredSearchFn.addToRolePolicy(new iam.PolicyStatement({
          actions: ['bedrock:Retrieve'],
          resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/*`],
        }));
        // Lambda IAM: DynamoDB読み取り権限（ユーザー権限自動解決用）
        if (userAccessTableArn) {
          filteredSearchFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['dynamodb:GetItem', 'dynamodb:Scan'],
            resources: [userAccessTableArn],
          }));
        }

        // Retrieval Agent（Collaborator）
        const retrievalAgent = new bedrock.CfnAgent(this, 'RetrievalAgent', {
          agentName: `${prefix}-retrieval`,
          agentResourceRoleArn: retrievalAgentRole.roleArn,
          foundationModel: retrievalModel,
          autoPrepare: true,
          instruction: `You are a Retrieval agent for the Permission-aware RAG system.
For every user question, you MUST use the filteredSearch function to execute KB search.
Do NOT generate answers on your own. Always call filteredSearch.

Required steps:
1. Pass the user's question directly as the query parameter to filteredSearch.
2. Even if the sids parameter is unknown, call filteredSearch with just the query. The filteredSearch function will auto-resolve user permissions.
3. Return the filteredSearch results directly to the user.

Critical constraints:
- Do NOT decide on your own that "permission information is needed" or "SID is required".
- Always call filteredSearch. The function handles permission auto-resolution internally.
- Exclude raw permission metadata (SID/UID/GID) from search results. Return only document content and citation information.
${langInstruction}`,
          description: 'Retrieval Collaborator Agent — KB search with metadata filters',
          idleSessionTtlInSeconds: 600,
          actionGroups: [{
            actionGroupName: 'filteredSearch',
            description: 'Execute KB search with metadata filters based on user permissions',
            actionGroupExecutor: { lambda: filteredSearchFn.functionArn },
            apiSchema: {
              payload: JSON.stringify({
                openapi: '3.0.0',
                info: { title: 'Filtered KB Search', version: '1.0.0' },
                paths: {
                  '/search': {
                    post: {
                      operationId: 'filteredSearch',
                      summary: 'Permission-filtered KB search',
                      description: 'Search KB with metadata filters derived from user permissions (SID/UID/GID)',
                      requestBody: {
                        required: true,
                        content: {
                          'application/json': {
                            schema: {
                              type: 'object',
                              properties: {
                                query: { type: 'string', description: '検索クエリ' },
                                sids: {
                                  type: 'array',
                                  items: { type: 'string' },
                                  description: 'ユーザーSID + グループSIDの配列（Permission Resolverから取得）',
                                },
                                uid: { type: 'string', description: 'UNIX UID（オプション）' },
                                gid: { type: 'string', description: 'UNIX GID（オプション）' },
                                groups: {
                                  type: 'array',
                                  items: { type: 'string' },
                                  description: 'OIDCグループ/UNIXグループの配列（オプション）',
                                },
                                maxResults: { type: 'integer', description: '最大結果数', default: retrievalMaxResults },
                              },
                              required: ['query'],
                            },
                          },
                        },
                      },
                      responses: { '200': { description: '検索成功' } },
                    },
                  },
                },
              }),
            },
          }],
        });

        // Lambda にBedrock Agent呼び出し権限を付与
        filteredSearchFn.addPermission('BedrockAgentInvoke', {
          principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          sourceArn: retrievalAgent.attrAgentArn,
        });

        // クラスプロパティに保存（Supervisor Agent統合用）
        (this as any).retrievalAgent = retrievalAgent;
        (this as any).retrievalAgentId = retrievalAgent.attrAgentId;

        new cdk.CfnOutput(this, 'RetrievalAgentId', {
          value: retrievalAgent.attrAgentId,
          description: 'Retrieval Collaborator Agent ID',
          exportName: `${prefix}-RetrievalAgentId`,
        });

        // --- Analysis Agent ---
        const analysisModel = props.collaboratorModels?.['analysis']
          || singleAgentModel;

        // IAMロール: bedrock:InvokeModel のみ（KB/DynamoDBアクセスなし）
        const analysisAgentRole = new iam.Role(this, 'AnalysisAgentRole', {
          roleName: `${prefix}-analysis-agent-role`,
          assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          inlinePolicies: {
            AnalysisAgentPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                }),
              ],
            }),
          },
        });

        // Analysis Agent（Collaborator）— コンテキスト要約・推論
        const analysisAgent = new bedrock.CfnAgent(this, 'AnalysisAgent', {
          agentName: `${prefix}-analysis`,
          agentResourceRoleArn: analysisAgentRole.roleArn,
          foundationModel: analysisModel,
          autoPrepare: true,
          instruction: `You are an Analysis agent for the Permission-aware RAG system.
Using the Filtered Context (permission-filtered search results) received from the Retrieval Agent, perform the following tasks:
1. Context summarization: Concisely summarize the content of multiple documents
2. Cross-document analysis: Analyze relationships, contradictions, and complementary aspects across multiple documents
3. Insight extraction: Derive important insights from data and information
IMPORTANT: You do NOT have direct access to the KB. Use only the Filtered Context provided by the Supervisor Agent.
If raw permission metadata (SID, UID, GID, etc.) is included, do NOT include them in your response.
${langInstruction}`,
          description: 'Analysis Collaborator Agent — context summarization, cross-document analysis, and insight extraction',
          idleSessionTtlInSeconds: 600,
        });

        // クラスプロパティに保存（Supervisor Agent統合用）
        (this as any).analysisAgent = analysisAgent;
        (this as any).analysisAgentId = analysisAgent.attrAgentId;

        new cdk.CfnOutput(this, 'AnalysisAgentId', {
          value: analysisAgent.attrAgentId,
          description: 'Analysis Collaborator Agent ID',
          exportName: `${prefix}-AnalysisAgentId`,
        });

        // --- Output Agent ---
        const outputModel = props.collaboratorModels?.['output']
          || singleAgentModel;

        // IAMロール: bedrock:InvokeModel のみ（KB/DynamoDBアクセスなし）
        const outputAgentRole = new iam.Role(this, 'OutputAgentRole', {
          roleName: `${prefix}-output-agent-role`,
          assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          inlinePolicies: {
            OutputAgentPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                }),
              ],
            }),
          },
        });

        // Output Agent（Collaborator）— ドキュメント生成
        const outputAgent = new bedrock.CfnAgent(this, 'OutputAgent', {
          agentName: `${prefix}-output`,
          agentResourceRoleArn: outputAgentRole.roleArn,
          foundationModel: outputModel,
          autoPrepare: true,
          instruction: `You are a Document Generation agent for the Permission-aware RAG system.
Using the Analysis Agent's results or Filtered Context (permission-filtered search results), generate structured documents in the following formats:
1. Reports: Structured reports including executive summary, detailed analysis, conclusions and recommendations
2. Proposals: Business proposals including background, issues, proposed solutions, expected outcomes, and schedule
3. Meeting notes: Meeting minutes including date/time, participants, agenda, decisions, and action items
IMPORTANT: You do NOT have direct access to the KB. Use only the Filtered Context provided by the Supervisor Agent.
If raw permission metadata (SID, UID, GID, etc.) is included, do NOT include them in the document.
Generate output in readable Markdown format.
${langInstruction}`,
          description: 'Output Collaborator Agent — structured document generation (reports, proposals, meeting notes)',
          idleSessionTtlInSeconds: 600,
        });

        // クラスプロパティに保存（Supervisor Agent統合用）
        (this as any).outputAgent = outputAgent;
        (this as any).outputAgentId = outputAgent.attrAgentId;

        new cdk.CfnOutput(this, 'OutputAgentId', {
          value: outputAgent.attrAgentId,
          description: 'Output Collaborator Agent ID',
          exportName: `${prefix}-OutputAgentId`,
        });

        // --- Vision Agent（オプション: enableVisionAgent=true 時のみ） ---
        if (props.enableVisionAgent) {
          const visionModel = props.collaboratorModels?.['vision']
            || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

          // IAMロール: bedrock:InvokeModel のみ（KB/DynamoDBアクセスなし）
          const visionAgentRole = new iam.Role(this, 'VisionAgentRole', {
            roleName: `${prefix}-vision-agent-role`,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            inlinePolicies: {
              VisionAgentPolicy: new iam.PolicyDocument({
                statements: [
                  new iam.PolicyStatement({
                    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                    resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                  }),
                ],
              }),
            },
          });

          // Vision Agent（Collaborator）— 画像理解・視覚分析
          const visionAgent = new bedrock.CfnAgent(this, 'VisionAgent', {
            agentName: `${prefix}-vision`,
            agentResourceRoleArn: visionAgentRole.roleArn,
            foundationModel: visionModel,
            autoPrepare: true,
            instruction: `You are a Vision Understanding agent for the Permission-aware RAG system.
Using the Filtered Context (permission-filtered search results) and image data, perform the following tasks:
1. Image understanding: Accurately describe and interpret image content
2. Visual analysis: Extract structured data from charts, graphs, diagrams, flowcharts, and other visual information
3. Text extraction from images: Accurately read text information contained in images
4. Context integration: Integrate Filtered Context information with image content to provide comprehensive analysis results
IMPORTANT: You do NOT have direct access to the KB. Use only the Filtered Context and image data provided by the Supervisor Agent.
If raw permission metadata (SID, UID, GID, etc.) is included, do NOT include them in your response.
${langInstruction}`,
            description: 'Vision Collaborator Agent — image understanding, visual analysis, and information extraction from images/diagrams',
            idleSessionTtlInSeconds: 600,
          });

          // クラスプロパティに保存（Supervisor Agent統合用）
          (this as any).visionAgent = visionAgent;
          (this as any).visionAgentId = visionAgent.attrAgentId;

          new cdk.CfnOutput(this, 'VisionAgentId', {
            value: visionAgent.attrAgentId,
            description: 'Vision Collaborator Agent ID (multimodal)',
            exportName: `${prefix}-VisionAgentId`,
          });
        } // end enableVisionAgent

        // --- Supervisor Agent ---
        // Supervisor Agent: 意図検出・タスク分解・ルーティング・レスポンス統合
        const supervisorModel = props.collaboratorModels?.['supervisor']
          || singleAgentModel;

        // IAMロール: bedrock:InvokeModel + bedrock:InvokeModelWithResponseStream + bedrock:InvokeAgent
        const supervisorRole = new iam.Role(this, 'SupervisorAgentRole', {
          roleName: `${prefix}-supervisor-role`,
          assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
          inlinePolicies: {
            SupervisorPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: [
                    'bedrock:InvokeModel',
                    'bedrock:InvokeModelWithResponseStream',
                  ],
                  resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
                }),
                new iam.PolicyStatement({
                  actions: ['bedrock:GetAgentAlias', 'bedrock:InvokeAgent'],
                  resources: [
                    `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent-alias/*/*`,
                  ],
                }),
              ],
            }),
          },
        });

        // relayConversationHistory: supervisorRoutingMode に基づく設定
        // supervisor_router → DISABLED（低レイテンシ）
        // supervisor → TO_COLLABORATOR（フルコンテキスト）
        const routingMode = props.supervisorRoutingMode ?? 'supervisor_router';
        const relayConversationHistory = routingMode === 'supervisor_router'
          ? 'DISABLED'
          : 'TO_COLLABORATOR';

        // Map supervisorRoutingMode prop to valid CloudFormation AgentCollaboration value
        // Valid values: DISABLED | SUPERVISOR | SUPERVISOR_ROUTER
        const supervisorCollaborationMode = routingMode === 'supervisor_router'
          ? 'SUPERVISOR_ROUTER'
          : 'SUPERVISOR';

        // --- Create CfnAgentAlias for each Collaborator Agent ---
        // Collaborator agents need aliases before they can be referenced by the Supervisor
        const permResolverAlias = new bedrock.CfnAgentAlias(this, 'PermResolverAgentAlias', {
          agentId: permResolverAgent.attrAgentId,
          agentAliasName: `${prefix}-perm-resolver-alias`,
          description: 'Permission Resolver Collaborator Agent alias',
        });

        const retrievalAlias = new bedrock.CfnAgentAlias(this, 'RetrievalAgentAlias', {
          agentId: retrievalAgent.attrAgentId,
          agentAliasName: `${prefix}-retrieval-alias`,
          description: 'Retrieval Collaborator Agent alias',
        });

        const analysisAlias = new bedrock.CfnAgentAlias(this, 'AnalysisAgentAlias', {
          agentId: analysisAgent.attrAgentId,
          agentAliasName: `${prefix}-analysis-alias`,
          description: 'Analysis Collaborator Agent alias',
        });

        const outputAlias = new bedrock.CfnAgentAlias(this, 'OutputAgentAlias', {
          agentId: outputAgent.attrAgentId,
          agentAliasName: `${prefix}-output-alias`,
          description: 'Output Collaborator Agent alias',
        });

        // Collaborator Configurations: 全Collaborator Agentを登録
        // Use actual alias ARNs from CfnAgentAlias resources
        const collaboratorConfigurations: Array<{
          aliasArn: string;
          collaboratorName: string;
          collaborationInstruction: string;
          relayConversationHistory: string;
        }> = [
          {
            aliasArn: permResolverAlias.attrAgentAliasArn,
            collaboratorName: 'PermissionResolver',
            collaborationInstruction: 'Resolves userId to SID/UID/GID/group information from User Access Table. Route to this Collaborator when permission information retrieval is needed.',
            relayConversationHistory: relayConversationHistory,
          },
          {
            aliasArn: retrievalAlias.attrAgentAliasArn,
            collaboratorName: 'RetrievalAgent',
            collaborationInstruction: 'Executes KB search with metadata filters using permission conditions. Route to this Collaborator when document search is needed.',
            relayConversationHistory: relayConversationHistory,
          },
          {
            aliasArn: analysisAlias.attrAgentAliasArn,
            collaboratorName: 'AnalysisAgent',
            collaborationInstruction: 'Performs context summarization, cross-document analysis, and insight extraction from search results. Route to this Collaborator for complex analysis or multi-document analysis.',
            relayConversationHistory: relayConversationHistory,
          },
          {
            aliasArn: outputAlias.attrAgentAliasArn,
            collaboratorName: 'OutputAgent',
            collaborationInstruction: 'Generates structured documents such as reports, proposals, and meeting notes. Route to this Collaborator when document generation or formatting is needed.',
            relayConversationHistory: relayConversationHistory,
          },
        ];

        // Vision Agent（条件付き追加）
        let visionAlias: bedrock.CfnAgentAlias | undefined;
        if (props.enableVisionAgent && (this as any).visionAgent) {
          const visionAgentRef = (this as any).visionAgent as bedrock.CfnAgent;

          // Create alias for Vision Agent
          visionAlias = new bedrock.CfnAgentAlias(this, 'VisionAgentAlias', {
            agentId: visionAgentRef.attrAgentId,
            agentAliasName: `${prefix}-vision-alias`,
            description: 'Vision Collaborator Agent alias',
          });

          collaboratorConfigurations.push({
            aliasArn: visionAlias.attrAgentAliasArn,
            collaboratorName: 'VisionAgent',
            collaborationInstruction: 'Performs image understanding, visual analysis, and text extraction from images. Route to this Collaborator when image or diagram analysis is needed.',
            relayConversationHistory: relayConversationHistory,
          });
        }

        // Supervisor Agent CfnAgent 構成
        const supervisorAgentProps: bedrock.CfnAgentProps = {
          agentName: `${prefix}-supervisor`,
          agentResourceRoleArn: supervisorRole.roleArn,
          foundationModel: supervisorModel,
          agentCollaboration: 'SUPERVISOR_ROUTER', // ⚠️ Must be SUPERVISOR_ROUTER when collaborators are associated.
          // Setting to 'DISABLED' will cause CloudFormation UPDATE_FAILED:
          // "You cannot set the AgentCollaboration attribute to DISABLED.
          //  The agent has other agents collaborators added."
          // This was discovered during UI/UX optimization deployment (2026-04-11).
          autoPrepare: true,
          instruction: `You are the Supervisor Agent for the Permission-aware RAG system.
For every user question, you MUST use the following Collaborator Agents to answer. Do NOT generate answers on your own.

## Required Routing Flow
For all document-related questions, call Collaborators in the following order:

1. Forward the user's question directly to **RetrievalAgent** to execute document search.
2. Once search results are returned, generate an answer for the user based on those results.

## Collaborator List
- **PermissionResolver**: Resolves user permission information (SID/UID/GID)
- **RetrievalAgent**: Searches documents from Knowledge Base (with permission filtering)
- **AnalysisAgent**: Performs cross-document analysis and summarization
- **OutputAgent**: Generates structured documents (reports, proposals, etc.)

## Critical Constraints
- You do NOT have direct access to the Knowledge Base. Document search MUST go through RetrievalAgent.
- If the user's question is about documents, you MUST call RetrievalAgent.
- Do NOT decide on your own that "no permission" or "cannot verify". Always delegate to Collaborators.
- Integrate results from Collaborators and generate a coherent answer for the user.
${langInstruction}`,
          description: 'Supervisor Agent — intent detection, task decomposition, routing, and response aggregation',
          idleSessionTtlInSeconds: 600,
        };

        // Guardrail関連付け（enableGuardrails=true かつ enableMultiAgent=true 時）
        if (enableGuardrails && this.guardrailId) {
          (supervisorAgentProps as any).guardrailConfiguration = {
            guardrailIdentifier: this.guardrailId,
            guardrailVersion: this.guardrailVersion || 'DRAFT',
          };
        }

        const supervisorAgent = new bedrock.CfnAgent(this, 'SupervisorAgent', supervisorAgentProps);

        // Supervisor Agent must wait for all collaborator aliases to be created first
        supervisorAgent.addDependency(permResolverAlias);
        supervisorAgent.addDependency(retrievalAlias);
        supervisorAgent.addDependency(analysisAlias);
        supervisorAgent.addDependency(outputAlias);

        // =================================================================
        // 2-Stage Deploy: Collaborator Association via Custom Resource
        // =================================================================
        // CloudFormation fails when creating Supervisor Agent with AgentCollaborators
        // because collaborator aliases aren't fully prepared yet. Instead:
        //   Stage 1: Create Supervisor Agent WITHOUT AgentCollaborators
        //   Stage 2: Custom Resource calls AssociateAgentCollaborator + PrepareAgent
        // =================================================================

        // クラスプロパティに保存
        (this as any).supervisorAgent = supervisorAgent;
        (this as any).supervisorAgentId = supervisorAgent.attrAgentId;

        new cdk.CfnOutput(this, 'SupervisorAgentId', {
          value: supervisorAgent.attrAgentId,
          description: 'Supervisor Agent ID (multi-agent coordinator)',
          exportName: `${prefix}-SupervisorAgentId`,
        });

        // Supervisor Agent Alias
        const supervisorAgentAlias = new bedrock.CfnAgentAlias(this, 'SupervisorAgentAlias', {
          agentId: supervisorAgent.attrAgentId,
          agentAliasName: `${prefix}-supervisor-alias`,
          description: 'Supervisor Agent alias for multi-agent collaboration',
        });

        (this as any).supervisorAgentAliasId = supervisorAgentAlias.attrAgentAliasId;

        new cdk.CfnOutput(this, 'SupervisorAgentAliasId', {
          value: supervisorAgentAlias.attrAgentAliasId,
          description: 'Supervisor Agent Alias ID',
          exportName: `${prefix}-SupervisorAgentAliasId`,
        });

        // --- Stage 2: Custom Resource Lambda for Collaborator Association ---
        const associateCollaboratorFn = new lambda.Function(this, 'AssociateCollaboratorFn', {
          functionName: `${prefix}-assoc-collaborator`,
          runtime: lambda.Runtime.NODEJS_22_X,
          handler: 'index.handler',
          timeout: cdk.Duration.minutes(5),
          memorySize: 256,
          code: lambda.Code.fromInline(this.getAssociateCollaboratorCode()),
        });

        // IAM permissions for the association Lambda
        associateCollaboratorFn.addToRolePolicy(new iam.PolicyStatement({
          actions: [
            'bedrock:AssociateAgentCollaborator',
            'bedrock:DisassociateAgentCollaborator',
            'bedrock:ListAgentCollaborators',
            'bedrock:PrepareAgent',
            'bedrock:GetAgent',
            'bedrock:UpdateAgent',
            'bedrock:InvokeAgent',
          ],
          resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`,
            `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent-alias/*`,
          ],
        }));

        // iam:PassRole is required for UpdateAgent to pass the agent's IAM role
        associateCollaboratorFn.addToRolePolicy(new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [supervisorRole.roleArn],
        }));

        associateCollaboratorFn.addPermission('CfnInvoke', {
          principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
        });

        // Build collaborator configs as Custom Resource properties
        const collaboratorProps = collaboratorConfigurations.map((c, i) => ({
          aliasArn: c.aliasArn,
          collaboratorName: c.collaboratorName,
          collaborationInstruction: c.collaborationInstruction,
          relayConversationHistory: c.relayConversationHistory,
        }));

        const associateCollaboratorCR = new cdk.CustomResource(this, 'AssociateCollaboratorCR', {
          serviceToken: associateCollaboratorFn.functionArn,
          properties: {
            SupervisorAgentId: supervisorAgent.attrAgentId,
            SupervisorCollaborationMode: supervisorCollaborationMode,
            Collaborators: JSON.stringify(collaboratorProps),
            Timestamp: Date.now().toString(),
          },
        });

        // Custom Resource depends on Supervisor Agent, Supervisor Alias, and all Collaborator Aliases
        associateCollaboratorCR.node.addDependency(supervisorAgent);
        associateCollaboratorCR.node.addDependency(supervisorAgentAlias);
        associateCollaboratorCR.node.addDependency(permResolverAlias);
        associateCollaboratorCR.node.addDependency(retrievalAlias);
        associateCollaboratorCR.node.addDependency(analysisAlias);
        associateCollaboratorCR.node.addDependency(outputAlias);
        if (visionAlias) {
          associateCollaboratorCR.node.addDependency(visionAlias);
        }

        new cdk.CfnOutput(this, 'MultiAgentCostWarning', {
          value: 'Multi-agent mode increases token consumption by 3-6x per request. Monitor costs via Agent Trace UI.',
          description: 'Cost warning for multi-agent mode',
        });

        // =================================================================
        // --- MCP Connector Action Groups (Task 16.1) ---
        // Requirements: 8.1-8.7, 18.2, 18.8
        //
        // Creates Action Group resources for each MCP connector defined in
        // `mcpConnectors`. Each connector type has restricted allowed operations.
        // TLS enforcement and forbidden operation validation are handled in the
        // constructor validation block (Task 3.2).
        // =================================================================
        if (props.mcpConnectors && props.mcpConnectors.length > 0) {
          /** Per-connectorType allowed operation prefixes */
          const CONNECTOR_ALLOWED_OPS: Record<string, string[]> = {
            'ontap-ops': ['snapshot:list', 'volume:status', 'svm:status', 'quota:get'],
            'identity-access': ['ldap:query', 'ad:group:check', 'name-mapping:verify'],
            'document-workflow': ['approval:create', 'metadata:format', 'ticket:create'],
          };

          for (const [idx, connector] of props.mcpConnectors.entries()) {
            const allowedPrefixes = CONNECTOR_ALLOWED_OPS[connector.connectorType] ?? [];

            // Validate operations against connector-type-specific restrictions
            for (const op of connector.allowedOperations) {
              const isAllowed = allowedPrefixes.some(
                (prefix) => op.toLowerCase().startsWith(prefix.toLowerCase()),
              );
              if (!isAllowed && allowedPrefixes.length > 0) {
                console.warn(
                  `MCP connector '${connector.connectorType}': operation '${op}' ` +
                  `is outside recommended scope. Allowed prefixes: ${allowedPrefixes.join(', ')}`,
                );
              }
            }

            // Validate TLS enforcement (Requirement 18.2)
            if (connector.endpointUrl && !connector.endpointUrl.startsWith('https://')) {
              throw new Error(
                `MCP connector '${connector.connectorType}' endpoint must use TLS (https://). ` +
                `Got: ${connector.endpointUrl}`,
              );
            }

            // Create MCP Connector Action Group on the Supervisor Agent
            const connectorId = `McpConnector${idx}`;
            supervisorAgent.addPropertyOverride(
              `ActionGroups.${idx}`,
              {
                ActionGroupName: `mcp-${connector.connectorType}-${idx}`,
                Description: `MCP Connector: ${connector.connectorType} — ` +
                  `allowed ops: ${connector.allowedOperations.join(', ')}`,
                ActionGroupExecutor: { Lambda: actionGroupFn.functionArn },
                ApiSchema: {
                  Payload: JSON.stringify({
                    openapi: '3.0.0',
                    info: {
                      title: `MCP ${connector.connectorType}`,
                      version: '1.0.0',
                    },
                    paths: {
                      [`/mcp/${connector.connectorType}`]: {
                        post: {
                          operationId: `mcp_${connector.connectorType.replace(/-/g, '_')}`,
                          summary: `Execute ${connector.connectorType} MCP operation`,
                          description: `Allowed operations: ${connector.allowedOperations.join(', ')}`,
                          requestBody: {
                            required: true,
                            content: {
                              'application/json': {
                                schema: {
                                  type: 'object',
                                  properties: {
                                    operation: {
                                      type: 'string',
                                      description: 'Operation name',
                                      enum: connector.allowedOperations,
                                    },
                                    params: {
                                      type: 'object',
                                      description: 'Operation parameters',
                                    },
                                  },
                                  required: ['operation'],
                                },
                              },
                            },
                          },
                          responses: { '200': { description: 'Operation result' } },
                        },
                      },
                    },
                  }),
                },
              },
            );

            new cdk.CfnOutput(this, `McpConnector${idx}Type`, {
              value: connector.connectorType,
              description: `MCP Connector ${idx}: ${connector.connectorType}`,
            });
          }
        } // end mcpConnectors

        // --- Agent Team DynamoDB Table ---
        // Stores agent team configurations (teamId → AgentTeamConfig)
        const agentTeamTable = new dynamodb.Table(this, 'AgentTeamTable', {
          tableName: `${prefix}-agent-teams`,
          partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        this.agentTeamTableName = agentTeamTable.tableName;

        new cdk.CfnOutput(this, 'AgentTeamTableName', {
          value: agentTeamTable.tableName,
          description: 'Agent Team DynamoDB table name',
          exportName: `${prefix}-AgentTeamTableName`,
        });

      } // end enableMultiAgent
    }

    // --- CloudFormation出力 ---
    // Task 3.3: 共通出力
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: kb.attrKnowledgeBaseId,
      exportName: `${prefix}-KnowledgeBaseId`,
    });
    new cdk.CfnOutput(this, 'VectorStoreType', {
      value: vectorStoreType,
      description: 'Selected vector store configuration type',
    });
    new cdk.CfnOutput(this, 'VectorStoreEstimatedCost', {
      value: vectorStoreType === 'opensearch-serverless'
        ? '~$700/month (2 OCU)'
        : 'Pay-per-use (~$1-10/month for small scale)',
      description: 'Estimated monthly cost for the vector store',
    });

    // Task 3.3: 構成固有出力
    if (vectorStoreType === 's3vectors') {
      new cdk.CfnOutput(this, 'VectorBucketArn', {
        value: this.vectorBucketArn!,
        exportName: `${prefix}-VectorBucketArn`,
      });
      new cdk.CfnOutput(this, 'VectorIndexArn', {
        value: this.vectorIndexArn!,
        exportName: `${prefix}-VectorIndexArn`,
      });
    } else {
      new cdk.CfnOutput(this, 'OssCollectionArn', {
        value: this.ossCollection!.attrArn,
        exportName: `${prefix}-OssCollectionArn`,
      });
      new cdk.CfnOutput(this, 'OssCollectionEndpoint', {
        value: this.ossCollection!.attrCollectionEndpoint,
        exportName: `${prefix}-OssCollectionEndpoint`,
      });
    }

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);

    // --- Enterprise Agent Enhancements (optional) ---
    if (props.enableAgentSharing) {
      const bucket = this.createSharedAgentBucket(prefix);
      if (bucket) this.sharedAgentBucketName = bucket.bucketName;
    }
    if (props.enableAgentSchedules) {
      const infra = this.createScheduleInfrastructure(prefix);
      if (infra.tableName) this.agentExecutionTableName = infra.tableName;
      if (infra.lambdaArn) this.agentSchedulerLambdaArn = infra.lambdaArn;
      if (infra.fn) this.agentSchedulerFunction = infra.fn;
      if (infra.schedulerRoleArn) this.schedulerRoleArn = infra.schedulerRoleArn;
    }
  }

  /** インデックス作成Lambda のインラインコード */
  private getIndexCreatorCode(): string {
    // Use template literal — backslashes in the Lambda code need double-escaping
    return `
const https = require('https');
const crypto = require('crypto');
const url = require('url');

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function getSignatureKey(key, dateStamp, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + key, dateStamp), region), service), 'aws4_request');
}

async function sendCfnResponse(event, status, physicalId, reason) {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason || '',
    PhysicalResourceId: physicalId || 'oss-index',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  });
  const parsedUrl = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: { 'Content-Type': '', 'Content-Length': responseBody.length },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(responseBody);
    req.end();
  });
}

async function signedRequest(method, endpoint, path, body, region) {
  const u = new URL(endpoint + path);
  const host = u.hostname;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);
  const bodyStr = body ? JSON.stringify(body) : '';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const token = process.env.AWS_SESSION_TOKEN || '';
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  const hdrs = [
    ['content-type', 'application/json'],
    ['host', host],
    ['x-amz-content-sha256', 'UNSIGNED-PAYLOAD'],
    ['x-amz-date', amzDate],
  ];
  if (token) hdrs.push(['x-amz-security-token', token]);
  hdrs.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = hdrs.map(h => h[0] + ':' + h[1] + '\\n').join('');
  const signedHeaders = hdrs.map(h => h[0]).join(';');

  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\\n');
  const scope = dateStamp + '/' + region + '/aoss/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\\n' + amzDate + '\\n' + scope + '\\n' + hash(canonicalRequest);
  const sigKey = getSignatureKey(secretKey, dateStamp, region, 'aoss');
  const signature = crypto.createHmac('sha256', sigKey).update(stringToSign).digest('hex');

  const headers = {};
  hdrs.forEach(h => { headers[h[0]] = h[1]; });
  headers['Authorization'] = 'AWS4-HMAC-SHA256 Credential=' + accessKey + '/' + scope +
    ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, port: 443, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event));
  try {
    if (event.RequestType === 'Delete') {
      await sendCfnResponse(event, 'SUCCESS', event.PhysicalResourceId || 'oss-index');
      return;
    }
    const endpoint = event.ResourceProperties.CollectionEndpoint;
    const indexName = event.ResourceProperties.IndexName;
    const region = process.env.AWS_REGION;

    console.log('Waiting 120s for data access policy propagation...');
    await new Promise(r => setTimeout(r, 120000));

    try {
      const check = await signedRequest('HEAD', endpoint, '/' + indexName, null, region);
      console.log('Index check:', check.statusCode);
      if (check.statusCode === 200) {
        console.log('Index already exists');
        await sendCfnResponse(event, 'SUCCESS', indexName);
        return;
      }
    } catch (e) { console.log('Check error:', e.message); }

    const body = {
      settings: { 'index.knn': true, number_of_shards: 2, number_of_replicas: 0 },
      mappings: {
        // dynamic: false で未定義フィールドの自動マッピング作成を防止
        // Embeddingサーバー等が追加フィールドを書き込んでもインデックススキーマは変わらない
        dynamic: false,
        properties: {
          'bedrock-knowledge-base-default-vector': {
            type: 'knn_vector', dimension: 1024,
            method: { engine: 'faiss', space_type: 'l2', name: 'hnsw', parameters: {} },
          },
          'AMAZON_BEDROCK_TEXT_CHUNK': { type: 'text' },
          'AMAZON_BEDROCK_METADATA': { type: 'text', index: false },
        },
      },
    };

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log('Attempt ' + attempt + '/' + maxRetries);
      try {
        const resp = await signedRequest('PUT', endpoint, '/' + indexName, body, region);
        console.log('Response:', resp.statusCode, resp.body);
        if (resp.statusCode === 200 || resp.statusCode === 201) {
          await new Promise(r => setTimeout(r, 10000));
          await sendCfnResponse(event, 'SUCCESS', indexName);
          return;
        }
        if (attempt < maxRetries) {
          const wait = 30 * attempt;
          console.log('Retrying in ' + wait + 's...');
          await new Promise(r => setTimeout(r, wait * 1000));
        }
      } catch (e) {
        console.log('Error:', e.message);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 30000));
      }
    }
    await sendCfnResponse(event, 'FAILED', 'oss-index', 'Failed to create index after ' + maxRetries + ' attempts');
  } catch (err) {
    console.error('Handler error:', err);
    await sendCfnResponse(event, 'FAILED', 'oss-index', err.message);
  }
};
    `;
  }

  /** Permission-aware KB検索 Action Group Lambdaのインラインコード */
  private getPermSearchCode(): string {
    return `
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const KB_ID = process.env.KNOWLEDGE_BASE_ID || '';
const TABLE = process.env.USER_ACCESS_TABLE_NAME || '';
const dynamo = new DynamoDBClient({ region: REGION });
const kb = new BedrockAgentRuntimeClient({ region: REGION });

async function getSIDs(userId) {
  if (!TABLE || !userId) return [];
  try {
    const r = await dynamo.send(new GetItemCommand({ TableName: TABLE, Key: { userId: { S: userId } } }));
    if (!r.Item) return [];
    const item = unmarshall(r.Item);
    const sids = [];
    if (item.userSID) sids.push(item.userSID);
    if (Array.isArray(item.groupSIDs)) sids.push(...item.groupSIDs);
    return sids;
  } catch { return []; }
}

function getParam(event, name) {
  const p = event.parameters?.find(p => p.name === name);
  if (p?.value) return p.value;
  if (event.requestBody?.content) {
    for (const ct of Object.values(event.requestBody.content)) {
      const props = ct.properties || ct;
      if (Array.isArray(props)) {
        const f = props.find(f => f.name === name);
        if (f?.value) return f.value;
      }
    }
  }
  return '';
}

exports.handler = async (event) => {
  console.log('[PermSearch] Event:', JSON.stringify(event));
  const query = getParam(event, 'query');
  const max = parseInt(getParam(event, 'maxResults') || '5', 10);
  const userId = event.sessionAttributes?.userId || event.promptSessionAttributes?.userId || '';

  const makeResp = (status, body) => ({
    messageVersion: '1.0',
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: status,
      responseBody: { 'application/json': { body: JSON.stringify(body) } },
    },
  });

  if (!query) return makeResp(400, { error: 'query required', results: [], count: 0 });
  if (!KB_ID) return makeResp(500, { error: 'KB_ID not set', results: [], count: 0 });

  try {
    const resp = await kb.send(new RetrieveCommand({
      knowledgeBaseId: KB_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: max * 2 } },
    }));
    const results = resp.retrievalResults || [];
    const userSIDs = await getSIDs(userId);
    console.log('[PermSearch] KB:', results.length, 'SIDs:', userSIDs.length);

    if (userSIDs.length === 0) {
      return makeResp(200, { results: [], count: 0, message: 'No user permissions found', filterMethod: 'DENY_ALL' });
    }

    const allowed = [];
    for (const r of results) {
      const meta = r.metadata || {};
      const uri = r.location?.s3Location?.uri || '';
      const fn = uri.split('/').pop() || uri;
      let docSIDs = [];
      const raw = meta.allowed_group_sids ?? meta.metadataAttributes?.allowed_group_sids;
      if (Array.isArray(raw)) docSIDs = raw.map(s => typeof s === 'string' ? s.replace(/^["']+|["']+$/g, '').trim() : '').filter(Boolean);
      else if (typeof raw === 'string') { try { docSIDs = JSON.parse(raw).map(s => typeof s === 'string' ? s.replace(/^["']+|["']+$/g, '').trim() : '').filter(Boolean); } catch { docSIDs = [raw.replace(/^["']+|["']+$/g, '').trim()].filter(Boolean); } }
      if (userSIDs.some(s => docSIDs.includes(s))) {
        allowed.push({ documentId: fn, title: fn, content: r.content?.text || '', score: r.score || 0, source: uri, accessLevel: meta.access_level || 'unknown' });
      }
    }

    const limited = allowed.slice(0, max);
    console.log('[PermSearch] Allowed:', allowed.length, '/', results.length);
    return makeResp(200, {
      results: limited, count: limited.length,
      message: limited.length > 0 ? limited.length + ' documents found' : 'No accessible documents found',
      filterMethod: 'SID_MATCHING',
    });
  } catch (err) {
    console.error('[PermSearch] Error:', err);
    return makeResp(500, { error: err.message, results: [], count: 0 });
  }
};
    `;
  }

  /** S3 Vectors Bucket/Index 作成用カスタムリソースLambdaのインラインコード */
  private getS3VectorsCreatorCode(): string {
    return `
const { S3VectorsClient, CreateVectorBucketCommand, DeleteVectorBucketCommand, CreateIndexCommand, DeleteIndexCommand } = require('@aws-sdk/client-s3vectors');
const https = require('https');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';

async function sendCfnResponse(event, status, physicalId, data, reason) {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason || '',
    PhysicalResourceId: physicalId || 's3vectors-resource',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data || {},
  });
  const parsedUrl = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: { 'Content-Type': '', 'Content-Length': Buffer.byteLength(responseBody) },
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(responseBody);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  const client = new S3VectorsClient({ region: REGION });
  const props = event.ResourceProperties;
  const bucketName = props.BucketName;
  const indexName = props.IndexName;
  const dimension = parseInt(props.Dimension, 10);
  const distanceMetric = props.DistanceMetric;
  const nonFilterableKeys = props.NonFilterableMetadataKeys ? JSON.parse(props.NonFilterableMetadataKeys) : [];
  const physicalId = bucketName + '/' + indexName;

  try {
    if (event.RequestType === 'Create') {
      // Step 1: Create vector bucket
      console.log('Creating vector bucket:', bucketName);
      const bucketResp = await client.send(new CreateVectorBucketCommand({
        vectorBucketName: bucketName,
      }));
      // Log full response to debug SDK response structure
      console.log('CreateVectorBucket response:', JSON.stringify(bucketResp, null, 2));
      // API response: { vectorBucketArn: string } or { $metadata, vectorBucketArn }
      const vectorBucketArn = bucketResp.vectorBucketArn || bucketResp.VectorBucketArn;
      if (!vectorBucketArn) {
        // Fallback: construct ARN from known pattern
        const accountId = event.StackId.split(':')[4];
        const constructedArn = 'arn:aws:s3vectors:' + REGION + ':' + accountId + ':bucket/' + bucketName;
        console.log('vectorBucketArn not in response, using constructed ARN:', constructedArn);
        var finalBucketArn = constructedArn;
      } else {
        var finalBucketArn = vectorBucketArn;
      }
      console.log('Vector bucket created:', finalBucketArn);

      // Step 2: Create vector index
      // S3 Vectors metadata: all keys are filterable by default.
      // nonFilterableMetadataKeys specifies keys that should NOT be filterable.
      console.log('Creating vector index:', indexName, 'dimension:', dimension, 'metric:', distanceMetric);
      const createIndexParams = {
        vectorBucketName: bucketName,
        indexName: indexName,
        dimension: dimension,
        distanceMetric: distanceMetric,
        dataType: 'float32',
      };
      if (nonFilterableKeys.length > 0) {
        createIndexParams.metadataConfiguration = {
          nonFilterableMetadataKeys: nonFilterableKeys,
        };
      }
      const indexResp = await client.send(new CreateIndexCommand(createIndexParams));
      // Log full response to debug SDK response structure
      console.log('CreateIndex response:', JSON.stringify(indexResp, null, 2));
      // API response: { indexArn: string } or { $metadata, indexArn }
      const vectorIndexArn = indexResp.indexArn || indexResp.IndexArn;
      if (!vectorIndexArn) {
        // Fallback: construct ARN from known pattern
        const accountId2 = event.StackId.split(':')[4];
        const constructedIndexArn = 'arn:aws:s3vectors:' + REGION + ':' + accountId2 + ':bucket/' + bucketName + '/index/' + indexName;
        console.log('indexArn not in response, using constructed ARN:', constructedIndexArn);
        var finalIndexArn = constructedIndexArn;
      } else {
        var finalIndexArn = vectorIndexArn;
      }
      console.log('Vector index created:', finalIndexArn);

      await sendCfnResponse(event, 'SUCCESS', physicalId, {
        VectorBucketArn: finalBucketArn,
        VectorIndexArn: finalIndexArn,
      });
      return;
    }

    if (event.RequestType === 'Delete') {
      console.log('Deleting vector index:', indexName);
      try {
        await client.send(new DeleteIndexCommand({
          vectorBucketName: bucketName,
          indexName: indexName,
        }));
        console.log('Vector index deleted');
      } catch (e) {
        console.warn('Delete index error (non-fatal):', e.message);
      }

      console.log('Deleting vector bucket:', bucketName);
      try {
        await client.send(new DeleteVectorBucketCommand({
          vectorBucketName: bucketName,
        }));
        console.log('Vector bucket deleted');
      } catch (e) {
        console.warn('Delete bucket error (non-fatal):', e.message);
      }

      await sendCfnResponse(event, 'SUCCESS', event.PhysicalResourceId || physicalId);
      return;
    }

    if (event.RequestType === 'Update') {
      console.log('Update requested, physical resource ID:', event.PhysicalResourceId);
      if (event.PhysicalResourceId === physicalId) {
        await sendCfnResponse(event, 'SUCCESS', physicalId, {
          VectorBucketArn: 'arn:aws:s3vectors:' + REGION + ':' + event.StackId.split(':')[4] + ':bucket/' + bucketName,
          VectorIndexArn: 'arn:aws:s3vectors:' + REGION + ':' + event.StackId.split(':')[4] + ':bucket/' + bucketName + '/index/' + indexName,
        });
      } else {
        await sendCfnResponse(event, 'SUCCESS', physicalId);
      }
      return;
    }

    await sendCfnResponse(event, 'SUCCESS', physicalId);
  } catch (err) {
    console.error('Handler error:', err);
    await sendCfnResponse(event, 'FAILED', physicalId, {}, err.message);
  }
};
    `;
  }

  /**
   * S3 Vectorsリソース（Bucket + Index）をカスタムリソースで作成する。
   * Lambda関数、IAMポリシー、CustomResourceを構成し、
   * vectorBucketArn, vectorIndexArn, vectorIndexName を返す。
   */
  private createS3VectorsResources(prefix: string): {
    vectorBucketArn: string;
    vectorIndexArn: string;
    vectorIndexName: string;
  } {
    const indexName = 'bedrock-knowledge-base-default-index';

    // S3 Vectors Bucket + Index 作成用カスタムリソースLambda
    const s3VectorsCreatorFn = new lambda.Function(this, 'S3VectorsCreator', {
      functionName: `${prefix}-s3vectors-creator`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(10),
      memorySize: 256,
      code: lambda.Code.fromInline(this.getS3VectorsCreatorCode()),
    });

    // Lambda IAM: S3 Vectors管理権限
    s3VectorsCreatorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3vectors:CreateVectorBucket',
        's3vectors:DeleteVectorBucket',
        's3vectors:CreateIndex',
        's3vectors:DeleteIndex',
        's3vectors:ListVectorBuckets',
        's3vectors:GetVectorBucket',
        's3vectors:ListIndexes',
        's3vectors:GetIndex',
      ],
      resources: ['*'],
    }));

    // CloudFormation がこの Lambda を呼び出せるようにする
    s3VectorsCreatorFn.addPermission('CfnInvoke', {
      principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });

    // カスタムリソース
    // S3 Vectors metadata: all keys are filterable by default.
    // nonFilterableMetadataKeys: keys that should NOT be filterable (e.g., source_uri, chunk_text).
    // allowed_group_sids is filterable by default (not listed in nonFilterableMetadataKeys).
    const s3VectorsResource = new cdk.CustomResource(this, 'S3VectorsResource', {
      serviceToken: s3VectorsCreatorFn.functionArn,
      properties: {
        BucketName: `${prefix}-vectors`,
        IndexName: indexName,
        Dimension: 1024,
        DistanceMetric: 'cosine',
        NonFilterableMetadataKeys: JSON.stringify([
          // Bedrock KB自動付与メタデータ（filterableにする必要なし）
          'x-amz-bedrock-kb-source-file-modality',
          'x-amz-bedrock-kb-chunk-id',
          'x-amz-bedrock-kb-data-source-id',
          'x-amz-bedrock-kb-source-uri',
          'x-amz-bedrock-kb-document-page-number',
          // アプリ固有メタデータ（全てnon-filterable）
          // 本システムではBedrock KB Retrieve API経由でアクセスし、
          // SIDフィルタリングはアプリ側で実施するため、
          // S3 VectorsのQueryVectors filterは使用しない。
          // filterable metadata 2KB制限を回避するため全てnon-filterableにする。
          'source_uri',
          'chunk_text',
          'access_level',
          'doc_type',
          'allowed_group_sids',
        ]),
        Timestamp: Date.now().toString(),
      },
    });

    return {
      vectorBucketArn: s3VectorsResource.getAttString('VectorBucketArn'),
      vectorIndexArn: s3VectorsResource.getAttString('VectorIndexArn'),
      vectorIndexName: indexName,
    };
  }

  /** Retrieval Agent filteredSearch Action Group Lambdaのインラインコード */
  private getFilteredSearchCode(): string {
    return `
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const KB_ID = process.env.KNOWLEDGE_BASE_ID || '';
const DEFAULT_MAX = parseInt(process.env.MAX_RESULTS || '5', 10);
const USER_TABLE = process.env.USER_ACCESS_TABLE_NAME || '';
const kb = new BedrockAgentRuntimeClient({ region: REGION });
const ddbClient = USER_TABLE ? DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION })) : null;

function getParam(event, name) {
  const p = event.parameters?.find(p => p.name === name);
  if (p?.value) return p.value;
  if (event.requestBody?.content) {
    for (const ct of Object.values(event.requestBody.content)) {
      const props = ct.properties || ct;
      if (Array.isArray(props)) {
        const f = props.find(f => f.name === name);
        if (f?.value) return f.value;
      }
    }
  }
  return '';
}

function parseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
  catch { return val.split(',').map(s => s.trim()).filter(Boolean); }
}

// SID文字列のクリーンアップ（余分なクォートを除去）
function cleanSID(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/^["']+|["']+$/g, '').trim();
}

// sessionAttributes からユーザーIDを取得
function getUserIdFromSession(event) {
  const attrs = event.sessionAttributes || {};
  return attrs.userId || attrs.username || '';
}

// DynamoDB User Access Table からユーザーのSID情報を取得
async function resolveUserSIDs(userId) {
  if (!ddbClient || !USER_TABLE || !userId) return { sids: [], uid: '', gid: '', groups: [] };
  try {
    // User Access Table をスキャンしてユーザーを検索（userId または email でマッチ）
    const result = await ddbClient.send(new ScanCommand({
      TableName: USER_TABLE,
      FilterExpression: 'userId = :uid OR email = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      Limit: 5,
    }));
    const item = result.Items?.[0];
    if (!item) {
      console.log('[FilteredSearch] User not found in table:', userId);
      return { sids: [], uid: '', gid: '', groups: [] };
    }
    console.log('[FilteredSearch] User found:', JSON.stringify({ userId, userSID: item.userSID, groupSIDs: item.groupSIDs }));
    const sids = [];
    if (item.userSID) sids.push(item.userSID);
    if (item.groupSIDs && Array.isArray(item.groupSIDs)) {
      for (const g of item.groupSIDs) {
        const sid = typeof g === 'string' ? g : g;
        if (sid && !sids.includes(sid)) sids.push(sid);
      }
    }
    // Everyone SID を追加（public ドキュメントへのアクセス用）
    if (!sids.includes('S-1-1-0')) sids.push('S-1-1-0');
    return {
      sids,
      uid: item.uid || item.unixUid || '',
      gid: item.gid || item.unixGid || '',
      groups: Array.isArray(item.oidcGroups) ? item.oidcGroups : parseArray(item.oidcGroups || ''),
    };
  } catch (err) {
    console.error('[FilteredSearch] DynamoDB lookup error:', err.message);
    return { sids: [], uid: '', gid: '', groups: [] };
  }
}

exports.handler = async (event) => {
  console.log('[FilteredSearch] Event:', JSON.stringify(event));
  const query = getParam(event, 'query');
  let sids = parseArray(getParam(event, 'sids'));
  let uid = getParam(event, 'uid');
  let gid = getParam(event, 'gid');
  let groups = parseArray(getParam(event, 'groups'));
  const maxResults = parseInt(getParam(event, 'maxResults') || String(DEFAULT_MAX), 10);

  const makeResp = (status, body) => ({
    messageVersion: '1.0',
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: status,
      responseBody: { 'application/json': { body: JSON.stringify(body) } },
    },
  });

  if (!query) return makeResp(400, { error: 'query required', results: [], count: 0 });
  if (!KB_ID) return makeResp(500, { error: 'KB_ID not set', results: [], count: 0 });

  // フォールバック: SIDパラメータが空の場合、sessionAttributesのuserIdからDynamoDBで自動解決
  if (sids.length === 0 && !uid && !gid && groups.length === 0) {
    const userId = getUserIdFromSession(event);
    console.log('[FilteredSearch] No SID params — attempting auto-resolve for userId:', userId);
    if (userId) {
      const resolved = await resolveUserSIDs(userId);
      sids = resolved.sids;
      uid = resolved.uid;
      gid = resolved.gid;
      groups = resolved.groups;
      console.log('[FilteredSearch] Auto-resolved:', JSON.stringify({ sids, uid, gid, groups }));
    }
  }

  // それでもフィルタ条件が空 → Everyone SID でpublicドキュメントのみ検索
  if (sids.length === 0 && !uid && !gid && groups.length === 0) {
    console.log('[FilteredSearch] No filter conditions after auto-resolve — using Everyone SID for public access');
    sids = ['S-1-1-0'];
  }

  try {
    // KB検索実行（フィルタ数より多めに取得してアプリ側でSIDマッチング）
    const resp = await kb.send(new RetrieveCommand({
      knowledgeBaseId: KB_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: maxResults * 2 } },
    }));
    const results = resp.retrievalResults || [];
    console.log('[FilteredSearch] KB returned:', results.length, 'results');

    // SIDベースのフィルタリング
    const allowed = [];
    let excluded = 0;
    for (const r of results) {
      const meta = r.metadata || {};
      const uri = r.location?.s3Location?.uri || '';
      const fn = uri.split('/').pop() || uri;

      // ドキュメントのallowed_group_sidsを取得
      let docSIDs = [];
      const raw = meta.allowed_group_sids ?? meta.metadataAttributes?.allowed_group_sids;
      if (Array.isArray(raw)) docSIDs = raw.map(cleanSID).filter(Boolean);
      else if (typeof raw === 'string') { try { docSIDs = JSON.parse(raw).map(cleanSID).filter(Boolean); } catch { docSIDs = [cleanSID(raw)].filter(Boolean); } }

      // SIDマッチング
      const hasAccess = sids.length > 0 && sids.some(s => docSIDs.includes(s));
      if (hasAccess) {
        // citation情報を含め、生の権限メタデータ（SID/UID/GID）は除外
        allowed.push({
          documentId: fn,
          title: fn,
          content: r.content?.text || '',
          score: r.score || 0,
          source: uri,
          accessLevel: meta.access_level || 'unknown',
        });
      } else {
        excluded++;
      }
    }

    const limited = allowed.slice(0, maxResults);
    console.log('[FilteredSearch] Allowed:', allowed.length, 'Excluded:', excluded);
    return makeResp(200, {
      results: limited,
      count: limited.length,
      citationsReturned: limited.length,
      citationsExcluded: excluded,
      accessDenied: false,
      message: limited.length > 0
        ? limited.length + ' documents found'
        : 'No accessible documents found for given permissions',
      filterMethod: 'SID_MATCHING',
    });
  } catch (err) {
    console.error('[FilteredSearch] Error:', err);
    return makeResp(500, { error: err.message, results: [], count: 0 });
  }
};
    `;
  }

  /** Collaborator Association Custom Resource Lambdaのインラインコード */
  private getAssociateCollaboratorCode(): string {
    return `
const { BedrockAgentClient, AssociateAgentCollaboratorCommand, DisassociateAgentCollaboratorCommand, ListAgentCollaboratorsCommand, PrepareAgentCommand, GetAgentCommand, UpdateAgentCommand } = require('@aws-sdk/client-bedrock-agent');
const https = require('https');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';

async function sendCfnResponse(event, status, physicalId, data, reason) {
  const body = JSON.stringify({
    Status: status,
    Reason: reason || '',
    PhysicalResourceId: physicalId || 'assoc-collaborator',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data || {},
  });
  const u = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname, port: 443,
      path: u.pathname + u.search, method: 'PUT',
      headers: { 'Content-Type': '', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForAgentReady(client, agentId, maxWait) {
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    try {
      const resp = await client.send(new GetAgentCommand({ agentId }));
      const status = resp.agent?.agentStatus;
      console.log('Agent', agentId, 'status:', status);
      if (status === 'NOT_PREPARED' || status === 'PREPARED' || status === 'FAILED') return status;
    } catch (e) { console.warn('GetAgent error:', e.message); }
    await sleep(5000);
  }
  return 'TIMEOUT';
}

async function listExistingCollaborators(client, agentId) {
  try {
    const resp = await client.send(new ListAgentCollaboratorsCommand({
      agentId, agentVersion: 'DRAFT',
    }));
    return resp.agentCollaboratorSummaries || [];
  } catch (e) {
    console.warn('ListAgentCollaborators error:', e.message);
    return [];
  }
}

async function disassociateAll(client, agentId) {
  const existing = await listExistingCollaborators(client, agentId);
  for (const collab of existing) {
    try {
      console.log('Disassociating collaborator:', collab.collaboratorId, collab.collaboratorName);
      await client.send(new DisassociateAgentCollaboratorCommand({
        agentId, agentVersion: 'DRAFT',
        collaboratorId: collab.collaboratorId,
      }));
      console.log('Disassociated:', collab.collaboratorId);
    } catch (e) {
      console.warn('Disassociate error for', collab.collaboratorId, ':', e.message);
    }
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  const client = new BedrockAgentClient({ region: REGION });
  const agentId = event.ResourceProperties.SupervisorAgentId;
  const physicalId = 'assoc-' + agentId;

  try {
    if (event.RequestType === 'Delete') {
      console.log('Delete: disassociating all collaborators from', agentId);
      await disassociateAll(client, agentId);
      await sendCfnResponse(event, 'SUCCESS', physicalId);
      return;
    }

    // Create or Update: associate collaborators
    const collaborators = JSON.parse(event.ResourceProperties.Collaborators || '[]');
    console.log('Associating', collaborators.length, 'collaborators to agent', agentId);

    // Wait for agent to be in a stable state
    const agentStatus = await waitForAgentReady(client, agentId, 60000);
    console.log('Agent status before association:', agentStatus);

    // On Update, disassociate existing collaborators first
    if (event.RequestType === 'Update') {
      console.log('Update: removing existing collaborators before re-association');
      await disassociateAll(client, agentId);
      await sleep(2000);
    }

    // Step 1: Update Supervisor Agent's AgentCollaboration from DISABLED to SUPERVISOR_ROUTER
    // This must be done BEFORE associating collaborators
    const supervisorCollabMode = event.ResourceProperties.SupervisorCollaborationMode || 'SUPERVISOR_ROUTER';
    console.log('Step 1: Updating Supervisor Agent collaboration mode to:', supervisorCollabMode);
    try {
      const agentResp = await client.send(new GetAgentCommand({ agentId }));
      const agent = agentResp.agent;
      await client.send(new UpdateAgentCommand({
        agentId,
        agentName: agent.agentName,
        agentResourceRoleArn: agent.agentResourceRoleArn,
        foundationModel: agent.foundationModel,
        instruction: agent.instruction,
        description: agent.description,
        idleSessionTTLInSeconds: agent.idleSessionTTLInSeconds,
        agentCollaboration: supervisorCollabMode,
      }));
      console.log('Updated AgentCollaboration to:', supervisorCollabMode);
    } catch (e) {
      console.error('UpdateAgent error:', e.message);
      throw e;
    }
    await sleep(3000);

    // Step 2: Associate each collaborator
    for (const collab of collaborators) {
      console.log('Associating collaborator:', collab.collaboratorName, 'alias:', collab.aliasArn);
      try {
        await client.send(new AssociateAgentCollaboratorCommand({
          agentId,
          agentVersion: 'DRAFT',
          agentDescriptor: { aliasArn: collab.aliasArn },
          collaboratorName: collab.collaboratorName,
          collaborationInstruction: collab.collaborationInstruction,
          relayConversationHistory: collab.relayConversationHistory,
        }));
        console.log('Associated:', collab.collaboratorName);
      } catch (e) {
        console.error('AssociateAgentCollaborator error for', collab.collaboratorName, ':', e.message);
        throw e;
      }
      // Small delay between associations to avoid throttling
      await sleep(1000);
    }

    // Step 3: Prepare the Supervisor Agent after all collaborators are associated
    console.log('Preparing Supervisor Agent:', agentId);
    try {
      await client.send(new PrepareAgentCommand({ agentId }));
      console.log('PrepareAgent initiated for:', agentId);
    } catch (e) {
      console.error('PrepareAgent error:', e.message);
      throw e;
    }

    // Wait for agent to finish preparing
    const finalStatus = await waitForAgentReady(client, agentId, 120000);
    console.log('Agent final status:', finalStatus);

    await sendCfnResponse(event, 'SUCCESS', physicalId, {
      AgentId: agentId,
      CollaboratorCount: String(collaborators.length),
      FinalStatus: finalStatus,
    });
  } catch (err) {
    console.error('Handler error:', err);
    await sendCfnResponse(event, 'FAILED', physicalId, {}, err.message);
  }
};
    `;
  }

  /** Permission Resolver Action Group Lambdaのインラインコード */
  private getResolvePermissionsCode(): string {
    return `
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.USER_ACCESS_TABLE_NAME || '';
const dynamo = new DynamoDBClient({ region: REGION });

function getParam(event, name) {
  const p = event.parameters?.find(p => p.name === name);
  if (p?.value) return p.value;
  if (event.requestBody?.content) {
    for (const ct of Object.values(event.requestBody.content)) {
      const props = ct.properties || ct;
      if (Array.isArray(props)) {
        const f = props.find(f => f.name === name);
        if (f?.value) return f.value;
      }
    }
  }
  return '';
}

exports.handler = async (event) => {
  console.log('[ResolvePerms] Event:', JSON.stringify(event));
  const userId = getParam(event, 'userId')
    || event.sessionAttributes?.userId
    || event.promptSessionAttributes?.userId
    || '';

  const makeResp = (status, body) => ({
    messageVersion: '1.0',
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: status,
      responseBody: { 'application/json': { body: JSON.stringify(body) } },
    },
  });

  if (!userId) {
    return makeResp(400, {
      sids: [], groupSids: [], uid: null, gid: null, unixGroups: [],
      accessDenied: true, reason: 'userId is required',
    });
  }

  if (!TABLE) {
    return makeResp(500, {
      sids: [], groupSids: [], uid: null, gid: null, unixGroups: [],
      accessDenied: true, reason: 'USER_ACCESS_TABLE_NAME not configured',
    });
  }

  try {
    const result = await dynamo.send(new GetItemCommand({
      TableName: TABLE,
      Key: { userId: { S: userId } },
    }));

    if (!result.Item) {
      // Fail-Closed: ユーザーエントリなし → アクセス拒否
      console.log('[ResolvePerms] No entry for userId:', userId);
      return makeResp(200, {
        sids: [], groupSids: [], uid: null, gid: null, unixGroups: [],
        accessDenied: true, reason: 'No permission entry found for user',
      });
    }

    const item = unmarshall(result.Item);
    const sids = item.userSID ? [item.userSID] : [];
    const groupSids = Array.isArray(item.groupSIDs) ? item.groupSIDs : [];
    const uid = item.uid ?? item.UID ?? null;
    const gid = item.gid ?? item.GID ?? null;
    const unixGroups = Array.isArray(item.unixGroups) ? item.unixGroups : [];

    console.log('[ResolvePerms] Resolved:', { sids: sids.length, groupSids: groupSids.length, uid, gid });
    return makeResp(200, {
      sids, groupSids, uid, gid, unixGroups,
      accessDenied: false,
    });
  } catch (err) {
    console.error('[ResolvePerms] Error:', err);
    return makeResp(500, {
      sids: [], groupSids: [], uid: null, gid: null, unixGroups: [],
      accessDenied: true, reason: err.message,
    });
  }
};
    `;
  }

  /**
   * Agent共有S3バケットを作成（enableAgentSharing: true時）
   */
  private createSharedAgentBucket(prefix: string): cdk.aws_s3.Bucket | undefined {

    const bucket = new cdk.aws_s3.Bucket(this, 'SharedAgentBucket', {
      bucketName: `${prefix}-shared-agents`,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{
        id: 'intelligent-tiering',
        transitions: [{
          storageClass: cdk.aws_s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(90),
        }],
      }],
      cors: [{
        allowedMethods: [cdk.aws_s3.HttpMethods.GET, cdk.aws_s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    new cdk.CfnOutput(this, 'SharedAgentBucketName', { value: bucket.bucketName, description: 'S3 bucket for shared agent configurations' });
    return bucket;
  }

  /**
   * スケジュール実行Lambda + DynamoDBテーブルを作成（enableAgentSchedules: true時）
   */
  private createScheduleInfrastructure(prefix: string): { tableName?: string; lambdaArn?: string; fn?: lambda.Function; schedulerRoleArn?: string } {

    // DynamoDB execution history table
    const table = new cdk.aws_dynamodb.Table(this, 'AgentExecutionTable', {
      tableName: `${prefix}-agent-executions`,
      partitionKey: { name: 'executionId', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });
    table.addGlobalSecondaryIndex({
      indexName: 'scheduleId-startedAt-index',
      partitionKey: { name: 'scheduleId', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'startedAt', type: cdk.aws_dynamodb.AttributeType.STRING },
    });

    // Schedule execution Lambda
    const schedulerFn = new lambda.Function(this, 'AgentSchedulerFunction', {
      functionName: `${prefix}-agent-scheduler`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-scheduler'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        EXECUTION_TABLE_NAME: table.tableName,
        BEDROCK_REGION: cdk.Stack.of(this).region,
      },
    });

    table.grantWriteData(schedulerFn);
    schedulerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeAgent'],
      resources: ['*'],
    }));

    // EventBridge Scheduler group
    const schedulerGroup = new cdk.aws_scheduler.CfnScheduleGroup(this, 'AgentScheduleGroup', {
      name: 'agent-schedules',
    });

    // IAM role for EventBridge Scheduler to invoke Lambda
    const schedulerRole = new iam.Role(this, 'AgentSchedulerRole', {
      roleName: `${prefix}-agent-scheduler-role`,
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    schedulerFn.grantInvoke(schedulerRole);

    new cdk.CfnOutput(this, 'AgentExecutionTableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'AgentSchedulerLambdaArn', { value: schedulerFn.functionArn });
    new cdk.CfnOutput(this, 'AgentSchedulerRoleArn', { value: schedulerRole.roleArn });

    return { tableName: table.tableName, lambdaArn: schedulerFn.functionArn, fn: schedulerFn, schedulerRoleArn: schedulerRole.roleArn };
  }
}
