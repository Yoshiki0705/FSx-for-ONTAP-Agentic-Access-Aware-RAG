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
}

export class DemoAIStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly ossCollection: opensearchserverless.CfnCollection;
  /** Bedrock Guardrail ID */
  public readonly guardrailId?: string;
  /** Bedrock Guardrail Version */
  public readonly guardrailVersion?: string;
  /** Bedrock Agent ID */
  public readonly agentId?: string;
  /** Bedrock Agent Alias ID */
  public readonly agentAliasId?: string;

  constructor(scope: Construct, id: string, props: DemoAIStackProps) {
    super(scope, id, props);

    const { projectName, environment, enableGuardrails, enableAgent, userAccessTableName, userAccessTableArn } = props;
    const prefix = `${projectName}-${environment}`;
    const collectionName = `${projectName}-${environment}-vectors`.substring(0, 32).toLowerCase();
    const indexName = 'bedrock-knowledge-base-default-index';

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
    this.ossCollection = new opensearchserverless.CfnCollection(this, 'OssCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
      description: `Vector store for ${projectName} Knowledge Base`,
    });
    this.ossCollection.addDependency(encryptionPolicy);
    this.ossCollection.addDependency(networkPolicy);

    // --- KB用IAMロール ---
    const kbRole = new iam.Role(this, 'KbRole', {
      roleName: `${prefix}-kb-role`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockKbPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['bedrock:InvokeModel'],
              resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`],
            }),
            new iam.PolicyStatement({
              actions: ['aoss:APIAccessAll'],
              resources: [this.ossCollection.attrArn],
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
          ],
        }),
      },
    });

    // --- インデックス作成用Lambda ---
    const indexCreatorFn = new lambda.Function(this, 'OssIndexCreator', {
      functionName: `${prefix}-oss-index-creator`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(10),
      memorySize: 256,
      code: lambda.Code.fromInline(this.getIndexCreatorCode()),
    });

    indexCreatorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['aoss:APIAccessAll'],
      resources: [this.ossCollection.attrArn],
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
    // cr.Provider ではなく直接 Lambda を使用（ロールの一致を保証）
    const ossIndex = new cdk.CustomResource(this, 'OssIndex', {
      serviceToken: indexCreatorFn.functionArn,
      properties: {
        CollectionEndpoint: this.ossCollection.attrCollectionEndpoint,
        IndexName: indexName,
        Timestamp: Date.now().toString(),
      },
    });

    // CloudFormation がこの Lambda を呼び出せるようにする
    indexCreatorFn.addPermission('CfnInvoke', {
      principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });

    ossIndex.node.addDependency(this.ossCollection);
    ossIndex.node.addDependency(dataAccessPolicy);

    // --- Bedrock Knowledge Base ---
    const kb = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
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
          collectionArn: this.ossCollection.attrArn,
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

    this.knowledgeBaseId = kb.attrKnowledgeBaseId;

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
        runtime: lambda.Runtime.NODEJS_20_X,
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
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: kb.attrKnowledgeBaseId,
      exportName: `${prefix}-KnowledgeBaseId`,
    });
    new cdk.CfnOutput(this, 'OssCollectionArn', {
      value: this.ossCollection.attrArn,
      exportName: `${prefix}-OssCollectionArn`,
    });
    new cdk.CfnOutput(this, 'OssCollectionEndpoint', {
      value: this.ossCollection.attrCollectionEndpoint,
      exportName: `${prefix}-OssCollectionEndpoint`,
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
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
}

// Add getPermSearchCode method to DemoAIStack - appended outside class, need to insert inside
