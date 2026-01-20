# Amazon Bedrock AgentCore - 完全ガイド

**作成日**: 2026-01-18  
**最終更新**: 2026-01-18  
**バージョン**: 2.0 (統合版)  
**対象システム**: Permission-aware RAG System with Amazon FSx for NetApp ONTAP  
**対象機能**: Amazon Bedrock AgentCore 9機能

---

## 📋 目次

1. [概要](#概要)
2. [デプロイメント](#デプロイメント)
3. [運用・保守](#運用保守)
4. [ステージング環境テスト](#ステージング環境テスト)
5. [本番環境デプロイ計画](#本番環境デプロイ計画)
6. [ユーザーガイド](#ユーザーガイド)
7. [チュートリアル](#チュートリアル)
8. [実装ガイド](#実装ガイド)

---

## 概要

### AgentCoreとは

Amazon Bedrock AgentCoreは、エンタープライズグレードのAIエージェントを構築するための包括的なプラットフォームです。9つの機能コンポーネントで構成され、それぞれが特定の役割を担います。

### 9つの機能コンポーネント

| 機能 | 説明 | 主要リソース |
|------|------|------------|
| **Runtime** | エージェントの実行環境 | Lambda関数、EventBridge Rule |
| **Gateway** | 外部API・Lambda・MCPサーバー統合 | Lambda関数（3つ） |
| **Memory** | 短期・長期メモリ管理 | Memory Resource、DynamoDB |
| **Browser** | Webスクレイピング・スクリーンショット | Lambda関数、S3バケット |
| **CodeInterpreter** | Pythonコード実行環境 | Lambda関数、DynamoDB、S3 |
| **Identity** | エージェント認証・認可（RBAC/ABAC） | Lambda関数、DynamoDB |
| **Policy** | 自然言語ポリシー管理 | Lambda関数、DynamoDB |
| **Observability** | 監視・トレーシング | X-Ray、CloudWatch |
| **Evaluations** | 品質評価・A/Bテスト | Lambda関数、DynamoDB、S3 |

### アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    Amazon Bedrock Agent                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AgentCore Runtime                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Gateway  │  │  Memory  │  │ Identity │  │  Policy  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Browser  │  │   Code   │  │Observ-   │  │Evalua-   │   │
│  │          │  │Interpreter│  │ability   │  │tions     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## デプロイメント

### 前提条件

- AWS CLI v2.x以上
- Node.js v20.x以上
- AWS CDK v2.x以上
- 適切なIAM権限
- Docker（ローカルビルドの場合）

### クイックスタート

```bash
# 1. リポジトリクローン
git clone https://github.com/your-org/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK

# 2. 依存関係インストール
npm install

# 3. 設定ファイル準備
cp cdk.context.json.example cdk.context.json
# cdk.context.jsonを編集してAgentCore機能を有効化

# 4. CDK Bootstrap（初回のみ）
npx cdk bootstrap

# 5. デプロイ
npx cdk deploy --all
```

### 設定ファイル（cdk.context.json）

```json
{
  "environment": "production",
  "region": "ap-northeast-1",
  "agentCore": {
    "runtime": {
      "enabled": true,
      "timeout": 300,
      "memory": 1024
    },
    "gateway": {
      "enabled": true,
      "restApiConverter": { "enabled": true },
      "lambdaConverter": { "enabled": true },
      "mcpIntegration": { "enabled": true }
    },
    "memory": {
      "enabled": true,
      "retentionDays": 30,
      "strategies": ["lastKTurns", "longTermMemory"]
    },
    "browser": {
      "enabled": true,
      "timeout": 900,
      "memory": 2048
    },
    "codeInterpreter": {
      "enabled": true,
      "timeout": 900,
      "memory": 2048,
      "allowedPackages": ["numpy", "pandas", "matplotlib"]
    },
    "identity": {
      "enabled": true,
      "rbacEnabled": true,
      "abacEnabled": true
    },
    "policy": {
      "enabled": true,
      "naturalLanguageEnabled": true,
      "cedarEnabled": true
    },
    "observability": {
      "enabled": true,
      "xrayEnabled": true,
      "customMetricsEnabled": true
    },
    "evaluations": {
      "enabled": true,
      "qualityMetricsEnabled": true,
      "abTestEnabled": true
    }
  }
}
```

### デプロイ手順（詳細）

#### Phase 1: インフラストラクチャデプロイ

```bash
# ネットワークスタック
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Networking

# セキュリティスタック
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Security

# データスタック
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data
```

#### Phase 2: AgentCoreデプロイ

```bash
# WebAppスタック（Runtime, Gateway, Memory, Browser, CodeInterpreter）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp

# Operationsスタック（Observability, Evaluations）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Operations
```

#### Phase 3: 検証

```bash
# Lambda関数確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `AgentCore`)].FunctionName'

# DynamoDBテーブル確認
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `AgentCore`)]'

# ヘルスチェック
curl https://your-cloudfront-domain.cloudfront.net/health
```

### トラブルシューティング

#### 問題1: CDK Deploy失敗

**症状**: `cdk deploy`が失敗する

**原因**:
- IAM権限不足
- リソース制限超過
- 設定ファイルエラー

**対処法**:
```bash
# エラーログ確認
npx cdk deploy --verbose

# IAM権限確認
aws iam get-user

# リソース制限確認
aws service-quotas list-service-quotas \
  --service-code lambda \
  --region ap-northeast-1
```

#### 問題2: Lambda関数起動失敗

**症状**: Lambda関数が起動しない

**原因**:
- Docker Imageの不備
- 環境変数の設定ミス
- メモリ不足

**対処法**:
```bash
# Lambda関数ログ確認
aws logs tail /aws/lambda/AgentCoreRuntime --follow

# Lambda関数設定確認
aws lambda get-function-configuration \
  --function-name AgentCoreRuntime
```

### KMS暗号化のベストプラクティス

#### AWS-Managed KMS vs Customer-Managed KMS

AgentCore Gateway Constructは、CloudWatch LogsにAWS-managed KMS暗号化を使用します。これにより、複雑なKMSポリシー管理が不要になり、デプロイが簡素化されます。

**比較表**:

| 項目 | AWS-Managed KMS | Customer-Managed KMS |
|------|----------------|---------------------|
| **セットアップ複雑度** | 低（自動） | 高（KMSポリシー必要） |
| **CloudWatch Logs権限** | 自動設定 | 手動設定必要 |
| **キーローテーション** | 自動（AWS管理） | 手動（有効化可能） |
| **コスト** | 無料 | $1/月/キー |
| **制御レベル** | 限定的 | 完全制御 |
| **デプロイ時間** | 高速 | 低速（KMS作成+ポリシー） |
| **メンテナンス** | ゼロ | 継続的管理必要 |
| **推奨用途** | ほとんどのユースケース | 厳格なコンプライアンス要件 |

#### 実装例

**AWS-Managed KMS（推奨）**:
```typescript
// CloudWatch Logsの作成（AWS-managed暗号化）
const logGroup = new logs.LogGroup(this, 'LogGroup', {
  logGroupName: `/aws/bedrock-agent-core/gateway/${projectName}-${environment}`,
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  // encryptionKeyを指定しない = AWS-managed暗号化（自動）
});
```

**Customer-Managed KMS（コンプライアンス要件がある場合のみ）**:
```typescript
// KMSキー作成
const key = new kms.Key(this, 'EncryptionKey', {
  description: `Encryption key for ${projectName}-${environment}`,
  enableKeyRotation: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// CloudWatch Logs用のKMSポリシー追加
key.addToResourcePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  principals: [new iam.ServicePrincipal('logs.amazonaws.com')],
  actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
  resources: ['*'],
  conditions: {
    ArnLike: {
      'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${region}:${account}:log-group:/aws/bedrock-agent-core/*`,
    },
  },
}));

// CloudWatch Logsの作成（customer-managed暗号化）
const logGroup = new logs.LogGroup(this, 'LogGroup', {
  logGroupName: `/aws/bedrock-agent-core/gateway/${projectName}-${environment}`,
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  encryptionKey: key,  // Customer-managed key
});
```

#### 推奨事項

1. **デフォルトはAWS-Managed KMS**: 厳格なコンプライアンス要件がない限り、AWS-managed KMS暗号化を使用
2. **コスト最適化**: 非本番環境ではAWS-managed KMSを使用してコスト削減
3. **条件付きIAMポリシー**: リソースが提供されている場合のみIAMポリシーを追加
   ```typescript
   // KMS権限の追加（customer-managed keyが提供されている場合のみ）
   if (this.encryptionKey) {
     role.addToPolicy(new iam.PolicyStatement({
       effect: iam.Effect.ALLOW,
       actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey'],
       resources: [this.encryptionKey.keyArn],
     }));
   }
   ```

#### トラブルシューティング

**問題**: CloudWatch Logs作成時にKMS権限エラー

**症状**:
```
Resource handler returned message: "User: arn:aws:sts::123456789012:assumed-role/cdk-hnb659fds-cfn-exec-role-123456789012-ap-northeast-1/AWSCloudFormation is not authorized to perform: kms:CreateGrant on resource: arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
```

**解決策**: AWS-managed KMS暗号化に切り替える
```typescript
// encryptionKeyプロパティを削除
const logGroup = new logs.LogGroup(this, 'LogGroup', {
  logGroupName: `/aws/bedrock-agent-core/gateway/${projectName}-${environment}`,
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  // encryptionKeyを指定しない
});
```

---

## 運用・保守（続き）

### 日常運用タスク（続き）

#### 日次チェック（続き）

```bash
# ヘルスチェック
./development/scripts/operations/daily-health-check.sh

# エラーログ確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '24 hours ago' +%s)000
```

#### 週次チェック

```bash
# パフォーマンスレポート生成
./development/scripts/operations/weekly-performance-report.sh

# セキュリティスキャン
npm audit
docker scan $ECR_REGISTRY/agentcore:latest
```

#### 月次チェック

```bash
# コスト分析
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-01) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=TAG,Key=Project

# キャパシティプランニング
./development/scripts/operations/capacity-planning.sh
```

### 監視とアラート

#### CloudWatch Dashboard

```bash
# ダッシュボード作成
aws cloudwatch put-dashboard \
  --dashboard-name AgentCore-Production \
  --dashboard-body file://development/configs/cloudwatch-dashboard.json
```

#### アラーム設定

```bash
# 全アラーム一括作成
./development/scripts/operations/setup-all-alarms.sh
```

**主要アラーム**:
- Lambda関数エラー率 > 5%
- Lambda関数Duration > 5秒
- DynamoDBスロットリング > 0
- メモリ使用率 > 80%

### バックアップとリカバリ

#### DynamoDBバックアップ

```bash
# オンデマンドバックアップ
aws dynamodb create-backup \
  --table-name AgentCoreIdentity \
  --backup-name AgentCoreIdentity-$(date +%Y%m%d-%H%M%S)

# Point-in-Time Recovery有効化
aws dynamodb update-continuous-backups \
  --table-name AgentCoreIdentity \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

#### S3バックアップ

```bash
# S3バケットバージョニング有効化
aws s3api put-bucket-versioning \
  --bucket agentcore-screenshots \
  --versioning-configuration Status=Enabled

# ライフサイクルポリシー設定
aws s3api put-bucket-lifecycle-configuration \
  --bucket agentcore-screenshots \
  --lifecycle-configuration file://s3-lifecycle-policy.json
```

### スケーリング

#### Lambda関数スケーリング

```bash
# Provisioned Concurrency設定
aws lambda put-provisioned-concurrency-config \
  --function-name AgentCoreRuntime \
  --provisioned-concurrent-executions 10 \
  --qualifier prod
```

#### DynamoDB Auto Scaling

```bash
# Auto Scaling設定
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/AgentCoreIdentity \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100

aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id table/AgentCoreIdentity \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --policy-name AgentCoreIdentity-ReadAutoScaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://autoscaling-policy.json
```

---

## ステージング環境テスト

### テスト計画

#### Phase 1: コア機能テスト

**対象**: Runtime, Memory, Identity, Observability

**テストケース**:
1. Runtime Lambda関数の起動確認
2. Memory機能のイベント書き込み・取得
3. Identity機能の認証・認可
4. Observability機能のトレース記録

**実行方法**:
```bash
./development/scripts/testing/run-staging-tests.sh phase1
```

#### Phase 2: 拡張機能テスト

**対象**: Gateway, Browser, CodeInterpreter, Policy, Evaluations

**テストケース**:
1. Gateway機能のAPI変換
2. Browser機能のスクリーンショット撮影
3. CodeInterpreter機能のPythonコード実行
4. Policy機能の自然言語ポリシー解析
5. Evaluations機能の品質評価

**実行方法**:
```bash
./development/scripts/testing/run-staging-tests.sh phase2
```

#### Phase 3: 統合テスト

**テストシナリオ**:
1. Runtime → Gateway → Memory連携
2. Identity → Policy連携
3. Browser → CodeInterpreter連携
4. Observability → Evaluations連携

**実行方法**:
```bash
./development/scripts/testing/run-staging-tests.sh phase3
```

### 合格基準

| 項目 | 基準値 |
|------|--------|
| 機能テスト成功率 | > 95% |
| 統合テスト成功率 | > 90% |
| エラー率 | < 1% |
| レイテンシ（P95） | < 3秒 |

---

## 本番環境デプロイ計画

### デプロイスケジュール

#### Week 1: Phase 1デプロイ

**対象**: Runtime, Memory, Identity, Observability

**スケジュール**:
- Day 1: ステージング環境構築・テスト
- Day 2: 本番環境デプロイ
- Day 3-5: 監視・安定化

#### Week 2: Phase 2デプロイ

**対象**: Gateway, Browser, CodeInterpreter, Policy, Evaluations

**スケジュール**:
- Day 1: ステージング環境更新・テスト
- Day 2: 本番環境デプロイ
- Day 3-5: 監視・安定化

#### Week 3: 統合テスト

**スケジュール**:
- Day 1-2: エンドツーエンドテスト
- Day 3: パフォーマンステスト
- Day 4: セキュリティテスト
- Day 5: 最終確認・承認

### リスク管理

#### 高リスク項目

| リスク | 発生確率 | 影響度 | 対策 |
|--------|---------|--------|------|
| Lambda起動失敗 | 中（30%） | 高 | Docker Image検証、Container Refresh |
| DynamoDB作成失敗 | 低（10%） | 高 | リソース名確認、事前検証 |
| Memory非対応 | 中（20%） | 中 | リージョン確認、代替案準備 |

### ロールバック計画

#### 方法1: CloudFormationスタックロールバック

```bash
aws cloudformation rollback-stack \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp
```

#### 方法2: Lambda関数の前バージョン復元

```bash
aws lambda update-alias \
  --function-name AgentCoreRuntime \
  --name prod \
  --function-version <previous-version>
```

---

## ユーザーガイド

### Runtime機能の使用方法

**概要**: エージェントの実行環境を提供

**使用例**:
```typescript
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ region: "ap-northeast-1" });

const command = new InvokeAgentCommand({
  agentId: "AGENT_ID",
  agentAliasId: "AGENT_ALIAS_ID",
  sessionId: "session-123",
  inputText: "こんにちは"
});

const response = await client.send(command);
```

### Gateway機能の使用方法

**概要**: 外部API、Lambda関数、MCPサーバーを統合

**REST API変換例**:
```typescript
// REST APIをTool定義に変換
const toolDefinition = await convertRestApiToTool({
  apiUrl: "https://api.example.com/v1/users",
  method: "GET",
  headers: { "Authorization": "Bearer TOKEN" }
});
```

### Memory機能の使用方法

**概要**: 短期・長期メモリを管理

**イベント書き込み例**:
```typescript
await writeEvent({
  agentId: "agent-123",
  sessionId: "session-456",
  event: {
    type: "user_message",
    content: "こんにちは",
    timestamp: new Date().toISOString()
  }
});
```

### Browser機能の使用方法

**概要**: Webスクレイピングとスクリーンショット撮影

**スクリーンショット例**:
```typescript
const screenshot = await takeScreenshot({
  url: "https://example.com",
  viewport: { width: 1920, height: 1080 },
  outputPath: "s3://bucket/screenshots/example.png"
});
```

### CodeInterpreter機能の使用方法

**概要**: Pythonコードを安全に実行

**コード実行例**:
```typescript
const result = await executeCode({
  sessionId: "session-789",
  code: `
import numpy as np
result = np.array([1, 2, 3]).sum()
print(result)
  `
});
```

---

## チュートリアル

### チュートリアル1: 基本的なエージェントの作成

**目標**: Runtime機能を使用してシンプルなエージェントを作成

**手順**:

1. **エージェント作成**
```bash
aws bedrock-agent create-agent \
  --agent-name "MyFirstAgent" \
  --foundation-model "anthropic.claude-3-sonnet-20240229-v1:0" \
  --instruction "あなたは親切なアシスタントです"
```

2. **エージェント呼び出し**
```typescript
const response = await invokeAgent({
  agentId: "AGENT_ID",
  agentAliasId: "AGENT_ALIAS_ID",
  sessionId: "session-001",
  inputText: "こんにちは"
});
```

### チュートリアル2: 外部APIとの統合

**目標**: Gateway機能を使用して外部APIを統合

**手順**:

1. **REST API変換**
```typescript
const toolDef = await convertRestApiToTool({
  apiUrl: "https://api.weather.com/v1/forecast",
  method: "GET",
  parameters: {
    location: { type: "string", required: true }
  }
});
```

2. **エージェントにTool追加**
```bash
aws bedrock-agent create-agent-action-group \
  --agent-id "AGENT_ID" \
  --action-group-name "WeatherAPI" \
  --action-group-executor '{"lambda":"arn:aws:lambda:..."}'
```

### チュートリアル3: メモリ機能の活用

**目標**: Memory機能を使用して会話履歴を管理

**手順**:

1. **Memory Resource作成**
```bash
aws bedrock-agent create-memory \
  --memory-name "ConversationMemory" \
  --memory-type "CONVERSATION"
```

2. **イベント書き込み**
```typescript
await writeEvent({
  agentId: "agent-123",
  sessionId: "session-456",
  event: {
    type: "user_message",
    content: "前回の会話を覚えていますか？"
  }
});
```

3. **メモリ取得**
```typescript
const memories = await getLastKTurns({
  agentId: "agent-123",
  sessionId: "session-456",
  k: 5
});
```

---

## 実装ガイド

### CDK Constructの実装

#### Runtime Construct

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class AgentCoreRuntimeConstruct extends cdk.Construct {
  public readonly runtimeFunction: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props: AgentCoreRuntimeProps) {
    super(scope, id);

    // Lambda関数作成
    this.runtimeFunction = new lambda.Function(this, 'RuntimeFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/runtime'),
      timeout: cdk.Duration.seconds(props.timeout || 300),
      memorySize: props.memory || 1024,
      environment: {
        BEDROCK_AGENT_ID: props.agentId,
        BEDROCK_AGENT_ALIAS_ID: props.agentAliasId
      }
    });

    // EventBridge Rule作成（定期実行）
    if (props.scheduleEnabled) {
      const rule = new events.Rule(this, 'ScheduleRule', {
        schedule: events.Schedule.rate(cdk.Duration.minutes(5))
      });
      rule.addTarget(new targets.LambdaFunction(this.runtimeFunction));
    }
  }
}
```

#### Gateway Construct

```typescript
export class AgentCoreGatewayConstruct extends cdk.Construct {
  public readonly restApiConverter: lambda.Function;
  public readonly lambdaConverter: lambda.Function;
  public readonly mcpIntegration: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props: AgentCoreGatewayProps) {
    super(scope, id);

    // REST API Converter
    this.restApiConverter = new lambda.Function(this, 'RestApiConverter', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'rest-api-converter.handler',
      code: lambda.Code.fromAsset('lambda/gateway'),
      timeout: cdk.Duration.seconds(300)
    });

    // Lambda Function Converter
    this.lambdaConverter = new lambda.Function(this, 'LambdaConverter', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda-converter.handler',
      code: lambda.Code.fromAsset('lambda/gateway'),
      timeout: cdk.Duration.seconds(300)
    });

    // MCP Server Integration
    this.mcpIntegration = new lambda.Function(this, 'McpIntegration', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'mcp-integration.handler',
      code: lambda.Code.fromAsset('lambda/gateway'),
      timeout: cdk.Duration.seconds(300)
    });
  }
}
```

### Lambda関数の実装

#### Runtime Lambda関数

```typescript
// lambda/runtime/index.ts
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  try {
    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID,
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      sessionId: event.sessionId || `session-${Date.now()}`,
      inputText: event.inputText
    });

    const response = await client.send(command);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ response })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

---

## 付録

### A. 用語集

| 用語 | 説明 |
|------|------|
| AgentCore | Amazon Bedrock Agentの9つの機能コンポーネント |
| Runtime | エージェントの実行環境 |
| Gateway | 外部API・Lambda・MCPサーバー統合機能 |
| Memory | 短期・長期メモリ管理機能 |
| RBAC | Role-Based Access Control（ロールベースアクセス制御） |
| ABAC | Attribute-Based Access Control（属性ベースアクセス制御） |

### B. 関連ドキュメント

- **セキュリティガイド**: `docs/guides/agentcore-security-operations-guide.md`
- **監視・トラブルシューティングガイド**: `docs/guides/agentcore-monitoring-troubleshooting-guide.md`
- **FAQ**: `docs/guides/agentcore-faq.md`

### C. 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 2.0 | 2026-01-18 | 8つのガイドを統合 |
| 1.0 | 2026-01-05 | 初版作成 |

---

**このガイドは、AgentCore機能の包括的なドキュメントです。デプロイメント、運用、テスト、ユーザーガイド、チュートリアル、実装ガイドを網羅しています。**
