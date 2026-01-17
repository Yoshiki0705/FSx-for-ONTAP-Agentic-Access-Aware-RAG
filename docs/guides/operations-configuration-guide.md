# 運用・設定完全ガイド

**最終更新**: 2026年1月18日  
**バージョン**: 2.0  
**対象**: Permission-aware RAG System 運用・設定

---

## 目次

1. [運用・メンテナンス](#1-運用メンテナンス)
2. [Observability設定](#2-observability設定)
3. [Policy設定](#3-policy設定)
4. [Evaluations設定](#4-evaluations設定)
5. [トラブルシューティング](#5-トラブルシューティング)
6. [ベストプラクティス](#6-ベストプラクティス)

---

## 1. 運用・メンテナンス

### 1.1 システム概要

Permission-aware RAG Systemは、Amazon Bedrockを活用したRAGアプリケーションです。

**主要コンポーネント**:
- **フロントエンド**: Next.js + React
- **バックエンド**: AWS Lambda (Web Adapter)
- **AI/ML**: Amazon Bedrock (Claude, Titan)
- **ストレージ**: DynamoDB, OpenSearch Serverless
- **認証**: Amazon Cognito
- **配信**: CloudFront

### 1.2 日常運用タスク

#### 1.2.1 システム監視

**CloudWatch Dashboardの確認**:
```bash
# CloudWatch Dashboardを開く
aws cloudwatch get-dashboard \
  --dashboard-name permission-aware-rag-dashboard \
  --region ap-northeast-1
```

**主要メトリクス**:
- Lambda関数の実行時間・エラー率
- DynamoDBの読み書きキャパシティ
- OpenSearch Serverlessのクエリレイテンシ
- CloudFrontのキャッシュヒット率

#### 1.2.2 ログ管理

**CloudWatch Logsの確認**:
```bash
# Lambda関数のログを確認
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --follow \
  --region ap-northeast-1

# エラーログのフィルタリング
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --filter-pattern "ERROR" \
  --region ap-northeast-1
```

#### 1.2.3 バックアップ

**DynamoDBバックアップ**:
```bash
# オンデマンドバックアップ
aws dynamodb create-backup \
  --table-name prod-permission-cache \
  --backup-name prod-permission-cache-backup-$(date +%Y%m%d) \
  --region ap-northeast-1

# ポイントインタイムリカバリの有効化
aws dynamodb update-continuous-backups \
  --table-name prod-permission-cache \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region ap-northeast-1
```

### 1.3 デプロイメント

#### 1.3.1 デプロイ戦略

**Blue/Greenデプロイ**:
```bash
# 新バージョンのデプロイ
npx cdk deploy --all --region ap-northeast-1

# トラフィックの段階的移行
aws lambda update-alias \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --name prod \
  --routing-config AdditionalVersionWeights={"2"=0.1} \
  --region ap-northeast-1
```

#### 1.3.2 ロールバック手順

```bash
# 前バージョンへのロールバック
aws lambda update-alias \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --name prod \
  --function-version 1 \
  --region ap-northeast-1

# CloudFrontキャッシュの無効化
aws cloudfront create-invalidation \
  --distribution-id E3J5C6S69J4ZQY \
  --paths "/*" \
  --region us-east-1
```

### 1.4 パフォーマンス最適化

#### 1.4.1 Lambda関数の最適化

**メモリ設定の調整**:
```typescript
// lib/stacks/integrated/webapp-stack.ts
const webAppFunction = new lambda.Function(this, 'WebAppFunction', {
  runtime: lambda.Runtime.FROM_IMAGE,
  code: lambda.Code.fromEcrImage(repository, { tagOrDigest: imageTag }),
  memorySize: 2048, // 1024MB → 2048MBに増加
  timeout: cdk.Duration.seconds(30),
});
```

#### 1.4.2 DynamoDBの最適化

**オンデマンドモードへの切り替え**:
```bash
# プロビジョニングモード → オンデマンドモード
aws dynamodb update-table \
  --table-name prod-permission-cache \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

---

## 2. Observability設定

### 2.1 概要

Observability（可観測性）は、システムの内部状態を外部から理解するための能力です。

**3つの柱**:
1. **Metrics（メトリクス）**: 数値データ（CPU使用率、レイテンシ等）
2. **Logs（ログ）**: イベントの記録
3. **Traces（トレース）**: リクエストの追跡

### 2.2 CloudWatch設定

#### 2.2.1 カスタムメトリクスの送信

```typescript
// Lambda関数内でカスタムメトリクスを送信
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: 'ap-northeast-1' });

await cloudwatch.putMetricData({
  Namespace: 'PermissionAwareRAG',
  MetricData: [
    {
      MetricName: 'RAGQueryLatency',
      Value: latency,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Environment', Value: 'prod' },
        { Name: 'QueryType', Value: 'semantic' }
      ]
    }
  ]
});
```

#### 2.2.2 アラームの設定

```bash
# Lambda関数のエラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-error-rate-high \
  --alarm-description "Lambda error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 0.05 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:ops-alerts \
  --region ap-northeast-1
```

### 2.3 X-Ray設定

#### 2.3.1 Lambda関数でのX-Ray有効化

```typescript
// lib/stacks/integrated/webapp-stack.ts
const webAppFunction = new lambda.Function(this, 'WebAppFunction', {
  runtime: lambda.Runtime.FROM_IMAGE,
  code: lambda.Code.fromEcrImage(repository, { tagOrDigest: imageTag }),
  tracing: lambda.Tracing.ACTIVE, // X-Rayトレーシングを有効化
});
```

#### 2.3.2 X-Ray SDKの使用

```typescript
// Lambda関数内でX-Ray SDKを使用
import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

const dynamodb = AWSXRay.captureAWSClient(new AWS.DynamoDB.DocumentClient());

// サブセグメントの作成
const segment = AWSXRay.getSegment();
const subsegment = segment.addNewSubsegment('RAGQuery');

try {
  // RAGクエリの実行
  const result = await executeRAGQuery(query);
  subsegment.close();
  return result;
} catch (error) {
  subsegment.addError(error);
  subsegment.close();
  throw error;
}
```

### 2.4 ログ集約

#### 2.4.1 構造化ログの出力

```typescript
// 構造化ログの例
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'RAG query executed',
  context: {
    userId: user.id,
    queryType: 'semantic',
    latency: 150,
    resultsCount: 5
  }
}));
```

#### 2.4.2 CloudWatch Logs Insightsクエリ

```sql
-- エラーログの集計
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)

-- レイテンシの分析
fields @timestamp, context.latency
| filter context.queryType = "semantic"
| stats avg(context.latency), max(context.latency), min(context.latency)
```

---

## 3. Policy設定

### 3.1 概要

Policyモジュールは、ユーザーのアクセス権限を管理します。

**主要機能**:
- ユーザーグループの管理
- リソースへのアクセス制御
- 動的権限評価

### 3.2 Policy設定ファイル

**ファイル**: `lib/modules/ai/config/policy-config.ts`

```typescript
export interface PolicyConfig {
  readonly policyTableName: string;
  readonly policyEvaluationTimeout: number;
  readonly defaultDenyPolicy: boolean;
}

export const defaultPolicyConfig: PolicyConfig = {
  policyTableName: 'prod-policy-table',
  policyEvaluationTimeout: 5000, // 5秒
  defaultDenyPolicy: true, // デフォルトで拒否
};
```

### 3.3 Policyの作成

```typescript
// DynamoDBにPolicyを保存
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({ region: 'ap-northeast-1' });

const policy = {
  policyId: 'policy-001',
  groupId: 'engineering',
  resources: ['document-*', 'project-alpha-*'],
  actions: ['read', 'write'],
  effect: 'Allow',
  conditions: {
    ipRange: ['10.0.0.0/8'],
    timeRange: { start: '09:00', end: '18:00' }
  }
};

await dynamodb.send(new PutItemCommand({
  TableName: 'prod-policy-table',
  Item: {
    policyId: { S: policy.policyId },
    groupId: { S: policy.groupId },
    resources: { SS: policy.resources },
    actions: { SS: policy.actions },
    effect: { S: policy.effect },
    conditions: { S: JSON.stringify(policy.conditions) }
  }
}));
```

### 3.4 Policy評価

```typescript
// Policy評価ロジック
export async function evaluatePolicy(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  // 1. ユーザーのグループを取得
  const userGroups = await getUserGroups(userId);
  
  // 2. 各グループのPolicyを取得
  const policies = await getPoliciesForGroups(userGroups);
  
  // 3. Policyを評価
  for (const policy of policies) {
    if (matchesResource(resource, policy.resources) &&
        policy.actions.includes(action)) {
      // 条件チェック
      if (evaluateConditions(policy.conditions)) {
        return policy.effect === 'Allow';
      }
    }
  }
  
  // 4. デフォルトで拒否
  return false;
}
```

---

## 4. Evaluations設定

### 4.1 概要

Evaluationsモジュールは、RAGシステムの品質を評価します。

**評価指標**:
- **Relevance（関連性）**: 回答がクエリに関連しているか
- **Accuracy（正確性）**: 回答が正しいか
- **Completeness（完全性）**: 回答が十分な情報を含むか
- **Latency（レイテンシ）**: 回答生成にかかる時間

### 4.2 Evaluations設定ファイル

**ファイル**: `lib/modules/ai/config/evaluations-config.ts`

```typescript
export interface EvaluationsConfig {
  readonly evaluationTableName: string;
  readonly evaluationMetrics: string[];
  readonly evaluationThreshold: number;
}

export const defaultEvaluationsConfig: EvaluationsConfig = {
  evaluationTableName: 'prod-evaluations-table',
  evaluationMetrics: ['relevance', 'accuracy', 'completeness', 'latency'],
  evaluationThreshold: 0.7, // 70%以上で合格
};
```

### 4.3 評価の実行

```typescript
// RAG評価の実行
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

async function evaluateRAGResponse(
  query: string,
  response: string,
  groundTruth: string
): Promise<EvaluationResult> {
  // Claude 3を使用して評価
  const evaluationPrompt = `
あなたはRAGシステムの評価者です。以下の情報を基に、回答を評価してください。

クエリ: ${query}
回答: ${response}
正解: ${groundTruth}

以下の指標で0-1のスコアを付けてください：
1. Relevance（関連性）
2. Accuracy（正確性）
3. Completeness（完全性）

JSON形式で回答してください。
`;

  const result = await bedrock.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [{ role: 'user', content: evaluationPrompt }]
    })
  }));

  const evaluation = JSON.parse(new TextDecoder().decode(result.body));
  return evaluation;
}
```

### 4.4 評価結果の保存

```typescript
// DynamoDBに評価結果を保存
await dynamodb.send(new PutItemCommand({
  TableName: 'prod-evaluations-table',
  Item: {
    evaluationId: { S: `eval-${Date.now()}` },
    timestamp: { N: Date.now().toString() },
    query: { S: query },
    response: { S: response },
    relevance: { N: evaluation.relevance.toString() },
    accuracy: { N: evaluation.accuracy.toString() },
    completeness: { N: evaluation.completeness.toString() },
    latency: { N: latency.toString() }
  }
}));
```

### 4.5 A/Bテスト

#### 基本設定

```typescript
abTestConfig: {
  enabled: true,
  trafficSplit: [50, 50],  // A:B = 50:50
  significanceThreshold: 0.05,  // p値 < 0.05で有意
  minSampleSize: 100,  // 最小100サンプル
}
```

#### トラフィック分割パターン

```typescript
// 均等分割（50:50）
trafficSplit: [50, 50]

// 不均等分割（70:30）
trafficSplit: [70, 30]

// 段階的ロールアウト（90:10）
trafficSplit: [90, 10]
```

#### 自動最適化

```typescript
abTestConfig: {
  enabled: true,
  trafficSplit: [50, 50],
  autoOptimization: true,
  autoOptimizationThreshold: 0.95,  // 95%信頼度で自動最適化
}
```

### 4.6 パフォーマンス評価

#### 基本設定

```typescript
performanceEvaluationConfig: {
  enabled: true,
  latencyThreshold: 1000,  // 1秒
  throughputThreshold: 100,  // 100 req/min
  costThreshold: 100,  // $100
}
```

#### レイテンシ閾値

| 用途 | 推奨閾値 |
|------|---------|
| リアルタイムチャット | 500ms |
| 一般的なAPI | 1000ms |
| バッチ処理 | 5000ms |

#### スループット閾値

| 用途 | 推奨閾値 |
|------|---------|
| 小規模アプリ | 50 req/min |
| 中規模アプリ | 100 req/min |
| 大規模アプリ | 500 req/min |

---

## 5. トラブルシューティング

### 5.1 一般的な問題

#### 問題: デプロイが途中で止まる

**症状**:
```
Stack deployment is taking longer than expected...
```

**原因**:
- CloudFormationスタックが依存リソースの作成を待機中
- タイムアウト設定が短すぎる

**解決方法**:
```bash
# 1. スタック状態確認
aws cloudformation describe-stack-events \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --max-items 10

# 2. タイムアウト延長
cdk deploy --all --timeout 3600
```

#### 問題: Lambda関数が502エラーを返す

**症状**:
```
502 Bad Gateway
```

**原因**:
- Lambda関数のタイムアウト
- メモリ不足
- 環境変数の設定ミス

**解決方法**:
```bash
# 1. CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/[Function-Name] --follow

# 2. 環境変数確認
aws lambda get-function-configuration \
  --function-name [Function-Name] \
  --query 'Environment.Variables'

# 3. メモリ・タイムアウト調整
aws lambda update-function-configuration \
  --function-name [Function-Name] \
  --memory-size 1024 \
  --timeout 30
```

#### 問題: Lambda関数が `{"Message":null}` エラーを返す

**症状**:
```json
{"Message":null}
```

**原因**:
- Lambda関数にコンテナイメージが設定されていない
- CDKデプロイ時にECRリポジトリは作成されたが、Lambda関数にイメージURIが設定されなかった

**解決方法**:

```bash
# ステップ1: ECRリポジトリURIの取得
ECR_URI=$(aws ecr describe-repositories \
  --repository-names tokyoregion-permission-aware-rag-prod-webapp-repo \
  --region ap-northeast-1 \
  --query 'repositories[0].repositoryUri' \
  --output text)

# ステップ2: Lambda関数のコード更新
aws lambda update-function-code \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --image-uri ${ECR_URI}:latest \
  --region ap-northeast-1

# ステップ3: CloudFrontキャッシュのクリア
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `WebApp`)].Id' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"
```

### 5.2 デプロイエラー

#### CloudFormationロールバック

**症状**:
```
Stack TokyoRegion-permission-aware-rag-prod-WebApp is in ROLLBACK_COMPLETE state
```

**対処手順**:
```bash
# 1. エラー原因の特定
aws cloudformation describe-stack-events \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'

# 2. スタック削除
cdk destroy TokyoRegion-permission-aware-rag-prod-WebApp

# 3. 問題修正後、再デプロイ
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
```

#### リソース競合エラー

**症状**:
```
Resource already exists: arn:aws:s3:::my-bucket
```

**対処手順**:
```bash
# 1. 既存リソース確認
aws s3 ls | grep my-bucket

# 2. 既存リソース削除（注意！）
aws s3 rb s3://my-bucket --force

# または、CDKで既存リソースをインポート
cdk import TokyoRegion-permission-aware-rag-prod-Data
```

### 5.3 ランタイムエラー

#### Bedrock APIエラー

**症状**:
```
AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel
```

**対処手順**:
```bash
# 1. IAMロール確認
aws iam get-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name BedrockAccess

# 2. 必要な権限を追加
aws iam put-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name BedrockAccess \
  --policy-document file://policies/bedrock-policy.json
```

#### DynamoDBスロットリング

**症状**:
```
ProvisionedThroughputExceededException
```

**対処手順**:
```typescript
// Auto Scalingの設定
const table = new dynamodb.Table(this, 'SessionTable', {
  partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST  // オンデマンドに変更
});
```

### 5.4 緊急対応手順

#### システム全体停止

```bash
# 1. CloudFrontディストリビューション無効化
aws cloudfront update-distribution \
  --id E119AFUF28Y3HG \
  --distribution-config file://cloudfront-disabled.json

# 2. Lambda関数の同時実行数を0に設定
aws lambda put-function-concurrency \
  --function-name TokyoRegion-permission-awar-WebAppFunction \
  --reserved-concurrent-executions 0

# 3. 関係者への通知
echo "システム緊急停止: $(date)" | \
  aws sns publish \
  --topic-arn arn:aws:sns:ap-northeast-1:123456789012:emergency-alerts \
  --message file://-
```

#### データベース復旧

```bash
# 1. DynamoDBバックアップから復元
aws dynamodb restore-table-from-backup \
  --target-table-name permission-aware-rag-sessions-prod-restored \
  --backup-arn arn:aws:dynamodb:ap-northeast-1:123456789012:table/permission-aware-rag-sessions-prod/backup/01234567890123-abcdefgh

# 2. 復元完了確認
aws dynamodb describe-table \
  --table-name permission-aware-rag-sessions-prod-restored \
  --query 'Table.TableStatus'
```

---

## 6. ベストプラクティス

### 6.1 セキュリティベストプラクティス

#### IAM最小権限の原則

```typescript
// ✅ 正しい例: 必要最小限の権限
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  ]
});

// 特定のDynamoDBテーブルのみアクセス許可
lambdaRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
  resources: [sessionTable.tableArn]
}));

// ❌ 間違った例: 過剰な権限
lambdaRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
);
```

#### 暗号化の徹底

```typescript
// S3バケット暗号化
const bucket = new s3.Bucket(this, 'DocumentBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
  enforceSSL: true  // HTTPS通信強制
});

// DynamoDB暗号化
const table = new dynamodb.Table(this, 'SessionTable', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: kmsKey
});
```

#### シークレット管理

```bash
# Secrets Managerにシークレット保存
aws secretsmanager create-secret \
  --name rag-system/api-keys \
  --secret-string '{"bedrockApiKey":"xxx","openSearchKey":"yyy"}'

# Lambda関数から取得
aws secretsmanager get-secret-value \
  --secret-id rag-system/api-keys \
  --query 'SecretString' \
  --output text
```

### 6.2 運用ベストプラクティス

#### 日常運用タスク

**毎日のチェック項目**:
```bash
# 1. システムヘルスチェック
curl https://d1kbivn5pdlnap.cloudfront.net/api/health

# 2. エラーログ確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# 3. CloudFormationスタック状態確認
aws cloudformation describe-stacks \
  --query 'Stacks[?StackStatus!=`UPDATE_COMPLETE` && StackStatus!=`CREATE_COMPLETE`]'
```

**週次タスク**:
- バックアップ確認
- セキュリティパッチ適用確認
- コスト分析
- パフォーマンスレビュー

**月次タスク**:
- アクセスログ分析
- キャパシティプランニング
- セキュリティ監査
- ドキュメント更新

#### 監視とアラート

```typescript
// Lambda関数エラーアラーム
const errorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: lambdaFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Lambda関数エラーが10回を超えました',
  actionsEnabled: true
});

// SNS通知設定
const topic = new sns.Topic(this, 'AlarmTopic');
errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(topic));
```

### 6.3 パフォーマンスベストプラクティス

#### Lambda関数の最適化

```typescript
// メモリサイズの調整
const optimizedFunction = new lambda.Function(this, 'OptimizedFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 1024,  // 512MB → 1024MBに増加
  timeout: cdk.Duration.seconds(30),
  reservedConcurrentExecutions: 10  // 同時実行数制限
});
```

#### CloudFrontキャッシュ最適化

```typescript
// キャッシュポリシーの設定
const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
  defaultTtl: cdk.Duration.hours(24),
  maxTtl: cdk.Duration.days(365),
  minTtl: cdk.Duration.seconds(0),
  enableAcceptEncodingGzip: true,
  enableAcceptEncodingBrotli: true
});
```

### 6.4 コスト最適化ベストプラクティス

#### DynamoDBオンデマンドモード

```typescript
const table = new dynamodb.Table(this, 'SessionTable', {
  partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST  // オンデマンドモード
});
```

#### S3ライフサイクルポリシー

```typescript
bucket.addLifecycleRule({
  id: 'archive-old-documents',
  enabled: true,
  transitions: [
    {
      storageClass: s3.StorageClass.INTELLIGENT_TIERING,
      transitionAfter: cdk.Duration.days(30)
    },
    {
      storageClass: s3.StorageClass.GLACIER,
      transitionAfter: cdk.Duration.days(90)
    }
  ],
  expiration: cdk.Duration.days(365)
});
```

---

## 7. リファレンス

### 7.1 コマンドリファレンス

#### CDKコマンド

| コマンド | 説明 | 例 |
|---------|------|-----|
| `cdk list` | スタック一覧表示 | `cdk list` |
| `cdk synth` | CloudFormation生成 | `cdk synth --all` |
| `cdk diff` | 差分表示 | `cdk diff TokyoRegion-permission-aware-rag-prod-WebApp` |
| `cdk deploy` | デプロイ実行 | `cdk deploy --all` |
| `cdk destroy` | スタック削除 | `cdk destroy --all` |
| `cdk bootstrap` | CDK初期化 | `cdk bootstrap --region ap-northeast-1` |

#### NPMスクリプト

| スクリプト | 説明 | コマンド |
|-----------|------|---------|
| `npm run build` | TypeScriptビルド | `npm run build` |
| `npm run watch` | 監視モード | `npm run watch` |
| `npm test` | テスト実行 | `npm test` |
| `npm run deploy:all` | 全スタックデプロイ | `npm run deploy:all` |

### 7.2 環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|-------|------|------------|------|
| `AWS_REGION` | AWSリージョン | `ap-northeast-1` | ✅ |
| `AWS_ACCOUNT_ID` | AWSアカウントID | - | ✅ |
| `PROJECT_NAME` | プロジェクト名 | `permission-aware-rag` | ✅ |
| `ENVIRONMENT` | 環境名 | `prod` | ✅ |
| `BEDROCK_MODEL_ID` | Bedrockモデル | `amazon.nova-pro-v1:0` | ❌ |

### 7.3 関連ドキュメント

- [デプロイメント完全ガイド](./deployment-complete-guide.md)
- [フロントエンド完全ガイド](./frontend-complete-guide.md)
- [デバッグ完全ガイド](./debugging-complete-guide.md)
- [AgentCore完全ガイド](./agentcore-complete-guide.md)

---

**最終更新**: 2026年1月18日  
**バージョン**: 2.0  
**ライセンス**: プロジェクトライセンスに準拠

