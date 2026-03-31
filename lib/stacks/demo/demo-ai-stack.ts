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
import { Construct } from 'constructs';

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
  /** EventBridge Scheduler IAMロール ARN */
  public readonly schedulerRoleArn?: string;

  constructor(scope: Construct, id: string, props: DemoAIStackProps) {
    super(scope, id, props);

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
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:ListBucket', 's3:GetBucketLocation'],
        resources: [
          `arn:aws:s3:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:accesspoint/*`,
          `arn:aws:s3:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:accesspoint/*/object/*`,
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
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
const { BedrockAgentClient, ListDataSourcesCommand, DeleteDataSourceCommand } = require('@aws-sdk/client-bedrock-agent');
const https = require('https');
async function sendCfnResponse(event, status, physicalId, reason) {
  const body = JSON.stringify({ Status: status, Reason: reason || '', PhysicalResourceId: physicalId || 'kb-cleanup', StackId: event.StackId, RequestId: event.RequestId, LogicalResourceId: event.LogicalResourceId });
  const u = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'PUT', headers: { 'Content-Type': '', 'Content-Length': body.length } }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
    req.on('error', reject); req.write(body); req.end();
  });
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
      console.log('Deleting data source:', s.dataSourceId);
      await client.send(new DeleteDataSourceCommand({ knowledgeBaseId: kbId, dataSourceId: s.dataSourceId }));
    }
    if ((ds.dataSourceSummaries || []).length > 0) await new Promise(r => setTimeout(r, 10000));
  } catch (e) { console.warn('Cleanup error (non-fatal):', e.message); }
  await sendCfnResponse(event, 'SUCCESS', 'kb-cleanup');
};
      `),
    });
    kbCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:ListDataSources', 'bedrock:DeleteDataSource'],
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
        foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
        instruction: `あなたはPermission-aware RAGシステムのAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
この機能はユーザーのアクセス権限に基づいてフィルタリングされた文書のみを返します。
検索結果に基づいて、正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。必ず検索してから回答してください。`,
        description: 'Permission-aware RAG Agent with SID-based document filtering',
        idleSessionTtlInSeconds: 600,
        // knowledgeBases は設定しない（Action Group経由でPermission-awareにアクセス）
        actionGroups: [{
          actionGroupName: 'PermissionAwareSearch',
          description: 'SIDベースの権限フィルタリング付き文書検索',
          actionGroupExecutor: { lambda: actionGroupFn.functionArn },
          apiSchema: {
            payload: JSON.stringify({
              openapi: '3.0.0',
              info: { title: 'Permission-aware Search', version: '2.0.0' },
              paths: {
                '/search': {
                  post: {
                    operationId: 'permissionAwareSearch',
                    summary: '権限認識型文書検索',
                    description: 'ユーザーのSID権限に基づいてフィルタリングされた文書を検索します',
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
      if (Array.isArray(raw)) docSIDs = raw;
      else if (typeof raw === 'string') { try { docSIDs = JSON.parse(raw); } catch { docSIDs = [raw]; } }
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
  private createScheduleInfrastructure(prefix: string): { tableName?: string; lambdaArn?: string; schedulerRoleArn?: string } {

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

    return { tableName: table.tableName, lambdaArn: schedulerFn.functionArn, schedulerRoleArn: schedulerRole.roleArn };
  }
}
