# デプロイメント完全ガイド

**最終更新**: 2026-01-18  
**バージョン**: v2.4.0  
**対象**: Permission-aware RAG System with FSx for ONTAP

---

## 📋 目次

1. [概要](#1-概要)
2. [環境準備](#2-環境準備)
3. [デプロイメント戦略](#3-デプロイメント戦略)
4. [初回デプロイ](#4-初回デプロイ)
5. [WebAppスタンドアローンデプロイ](#5-webappスタンドアローンデプロイ)
6. [Lambda VPC配置](#6-lambda-vpc配置)
7. [マルチリージョンデプロイ](#7-マルチリージョンデプロイ)
8. [更新デプロイ](#8-更新デプロイ)
9. [コンポーネント別デプロイ](#9-コンポーネント別デプロイ)
10. [環境別設定](#10-環境別設定)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [ベストプラクティス](#12-ベストプラクティス)
13. [リファレンス](#13-リファレンス)

---

## 1. 概要

### 1.1 プロジェクト概要

Permission-aware RAG System with FSx for ONTAPは、Amazon Bedrockを活用した権限認識型RAGシステムです。モジュラーアーキテクチャを採用し、6つの統合CDKスタックで構成されています。

**6つの統合スタック**:
1. **NetworkingStack** - ネットワーク基盤（VPC、サブネット、ゲートウェイ）
2. **SecurityStack** - セキュリティ設定（IAM、KMS、WAF）
3. **DataStack** - データ・ストレージ統合（DynamoDB、S3、FSx）
4. **EmbeddingStack** - コンピュート・AI統合（Lambda、Bedrock、Batch）
5. **WebAppStack** - API・フロントエンド統合（API Gateway、Cognito、CloudFront）
6. **OperationsStack** - 監視・エンタープライズ統合（CloudWatch、X-Ray、SNS）

**主要機能**:
- **モジュラーアーキテクチャ**: 疎結合な6スタック構成
- **個別デプロイ対応**: スタックごとの独立デプロイ可能
- **WebAppスタンドアローン**: WebAppスタックのみの独立デプロイ対応
- **マルチリージョン対応**: 14リージョンでのデプロイ可能
- **コスト最適化**: Amazon Nova Pro統合による60-80%のコスト削減
- **FSx統合**: NetApp ONTAP による高性能ファイルストレージ

### 1.2 前提条件

#### 必須ツール
- **Node.js**: 20.x以上
- **AWS CLI**: v2.0以上
- **AWS CDK**: v2.129.0以上
- **Docker**: 20.10以上（コンテナデプロイ時）
- **Git**: バージョン管理用

#### AWS環境
- **AWSアカウント**: 有効なAWSアカウント
- **IAM権限**: AdministratorAccess または同等の権限
- **リージョン**: ap-northeast-1（東京）推奨
- **CDK Bootstrap**: 実行済み

#### システム要件
- **OS**: macOS、Linux、Windows（WSL2）
- **メモリ**: 8GB以上推奨
- **ディスク**: 20GB以上の空き容量

---

## 2. 環境準備

### 2.1 セキュリティ要件

#### 依存関係のセキュリティ状態

このプロジェクトは、Task 6.6（2025-11-25）でセキュリティ脆弱性を完全に修正しました：

**セキュリティ品質指標**:
- ✅ **セキュリティ脆弱性**: 0件（6件→0件、100%削減達成）
- ✅ **npm audit**: クリーン
- ✅ **依存関係**: 最新版に更新済み

**修正された脆弱性**:
1. **aws-cdk**: 2.147.3 → 2.1033.0
2. **aws-cdk-lib**: 2.147.3 → 2.228.0
3. **cdk-nag**: 2.28.195 → 2.37.55
4. **cdk-docker-image-deployment**: 0.0.10 → 0.0.932

#### セキュリティ監査の実行

デプロイ前に必ずセキュリティ監査を実行してください：

```bash
# セキュリティ監査
npm audit

# 期待される結果
# found 0 vulnerabilities ✅

# 脆弱性が検出された場合
npm audit fix

# 強制的に修正（破壊的変更の可能性あり）
npm audit fix --force
```

### 2.2 AWS環境設定

#### AWS CLI設定
```bash
# AWS CLI設定
aws configure

# 設定確認
aws sts get-caller-identity

# 期待される出力
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

#### AWS認証情報設定
```bash
# ~/.aws/credentials
[default]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY

# ~/.aws/config
[default]
region = ap-northeast-1
output = json
```

### 2.3 開発環境セットアップ

#### リポジトリクローン
```bash
# GitHubからクローン
git clone https://github.com/your-org/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK
```

#### 依存関係インストール
```bash
# Node.js依存関係
npm install

# TypeScriptビルド
npm run build

# ビルド確認
npm run watch  # 開発時の自動ビルド
```

### 2.4 CDK Bootstrap

#### 初回Bootstrap
```bash
# デフォルトリージョン
cdk bootstrap

# 特定リージョン指定
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1

# 複数リージョン
cdk bootstrap \
  aws://ACCOUNT-ID/ap-northeast-1 \
  aws://ACCOUNT-ID/us-east-1
```

#### Bootstrap確認
```bash
# Bootstrapスタック確認
aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --region ap-northeast-1
```

---

## 3. デプロイメント戦略

### 3.1 全スタック一括デプロイ（推奨）

```bash
# 全スタック一括デプロイ
cdk deploy --all
```

**利点**:
- 依存関係の自動解決
- 一貫性のある環境構築
- デプロイ時間の最適化
- 初回デプロイに最適

**注意**: 現在、fullモードでは6スタック構成が完全には実装されていません（Task 6.4で対応予定）。全スタックデプロイを実行する場合は、個別スタックデプロイ方式を推奨します。

### 3.2 個別スタックデプロイ

```bash
# スタックごとにデプロイ（依存順）
cdk deploy NetworkingStack
cdk deploy SecurityStack
cdk deploy DataStack
cdk deploy EmbeddingStack
cdk deploy WebAppStack
cdk deploy OperationsStack
```

**利点**:
- 細かい制御が可能
- 問題の早期発見
- ロールバックが容易
- 更新デプロイに最適

### 3.3 WebAppスタンドアローンデプロイ

```bash
# WebAppスタックのみをデプロイ
STANDALONE_MODE=true cdk deploy WebAppStack
```

**利点**:
- 他のスタックに依存しない
- フロントエンドの迅速な更新
- 開発環境での素早いテスト
- コスト削減（必要最小限のリソース）

### 3.4 Phase 0.8 実証済みデプロイフロー

**Phase 0.8の経験から学んだ安全なデプロイ手順**:

#### Phase 1: ローカル検証（必須）

```bash
# TypeScriptビルド
npm run build

# CDK構文チェック
npx cdk synth --quiet

# テスト実行
npm test

# セキュリティ監査
npm audit
```

#### Phase 2: EC2同期（ローカル修正がある場合）

```bash
# 修正ファイルの確認
git status
git diff --name-only

# EC2への同期
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  -e "ssh -i /path/to/key.pem" \
  ./ ubuntu@[EC2_HOST]:/home/ubuntu/project/

# 同期確認
ssh -i "/path/to/key.pem" ubuntu@[EC2_HOST] \
  "ls -la /home/ubuntu/project/[修正したファイル]"
```

#### Phase 3: EC2でのビルド・デプロイ

```bash
# EC2でのビルド
ssh -i "/path/to/key.pem" ubuntu@[EC2_HOST] \
  "cd project && npm install && npm run build"

# CDK構文チェック（必須）
ssh -i "/path/to/key.pem" ubuntu@[EC2_HOST] \
  "cd project && npx cdk synth --quiet"

# ECR認証（重要）
ssh -i "/path/to/key.pem" ubuntu@[EC2_HOST] \
  "aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin [ECR_URI]"

# デプロイ実行
ssh -i "/path/to/key.pem" ubuntu@[EC2_HOST] \
  "cd project && npx cdk deploy --all"
```

---

## 4. 初回デプロイ

### 4.1 設定確認

```bash
# 環境変数設定
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=prod
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# CDKスタック一覧
cdk list

# 期待される出力（6つの統合スタック）
TokyoRegion-permission-aware-rag-prod-Networking
TokyoRegion-permission-aware-rag-prod-Security
TokyoRegion-permission-aware-rag-prod-Data
TokyoRegion-permission-aware-rag-prod-Embedding
TokyoRegion-permission-aware-rag-prod-WebApp
TokyoRegion-permission-aware-rag-prod-Operations
```

### 4.2 差分確認

```bash
# 全スタックの差分確認
cdk diff --all

# 特定スタックの差分確認
cdk diff NetworkingStack
cdk diff WebAppStack
```

### 4.3 デプロイ実行

```bash
# 全6スタック一括デプロイ（推奨）
cdk deploy --all

# 承認スキップ（自動化時）
cdk deploy --all --require-approval never

# 個別スタックデプロイ（依存順）
cdk deploy TokyoRegion-permission-aware-rag-prod-Networking
cdk deploy TokyoRegion-permission-aware-rag-prod-Security
cdk deploy TokyoRegion-permission-aware-rag-prod-Data
cdk deploy TokyoRegion-permission-aware-rag-prod-Embedding
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
cdk deploy TokyoRegion-permission-aware-rag-prod-Operations
```

### 4.4 デプロイ確認

```bash
# 全スタック状態確認
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `permission-aware-rag`)].{Name:StackName,Status:StackStatus}'

# Lambda関数確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `permission-aware-rag`)].FunctionName'

# CloudFrontディストリビューション確認
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `permission-aware-rag`)].{Id:Id,DomainName:DomainName,Status:Status}'
```

### 4.5 統合テスト実行（推奨）

```bash
# 統合テスト実行
./development/scripts/testing/run-integration-tests.sh ap-northeast-1

# または npm scriptで実行
export AWS_REGION=ap-northeast-1
npm run test:integration:full-stack
```

**テスト内容**:
- 全5スタックの動作確認
- 22のテストケースを実行
- スタック間の連携確認

---

## 5. WebAppスタンドアローンデプロイ

### 5.1 概要

**v2.2.0の新機能**: WebAppスタックを他のスタックに依存せず、単独でデプロイできるようになりました。

**主な特徴**:
- ✅ 他のスタック（Networking、Security等）が不要
- ✅ 必要なリソース（VPC、セキュリティグループ等）を自動作成
- ✅ ECRリポジトリの自動作成・参照
- ✅ 既存リソースの参照も可能
- ✅ 統合モードとの互換性維持

**ユースケース**:
- フロントエンドの迅速な開発・テスト
- 開発環境での素早いイテレーション
- コスト削減（必要最小限のリソースのみ）
- CI/CDパイプラインでの独立デプロイ

### 5.2 デプロイパターン

#### パターン1: 完全スタンドアローン（全リソース自動作成）

```bash
# 環境変数設定
export STANDALONE_MODE=true
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=dev

# デプロイ実行
cdk deploy WebAppStack
```

**作成されるリソース**:
- ECRリポジトリ: `permission-aware-rag-webapp`
- VPC: 最小構成（2AZ、パブリックサブネットのみ）
- セキュリティグループ: Lambda用
- Lambda関数: Next.jsアプリケーション
- CloudFront: グローバルCDN
- IAMロール: Lambda実行ロール

#### パターン2: 既存VPC利用

```bash
# 既存VPCを利用する場合
export STANDALONE_MODE=true
export EXISTING_VPC_ID=vpc-12345678
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=dev

# デプロイ実行
cdk deploy WebAppStack
```

#### パターン3: 既存VPC・セキュリティグループ利用

```bash
# 既存リソースを最大限利用する場合
export STANDALONE_MODE=true
export EXISTING_VPC_ID=vpc-12345678
export EXISTING_SECURITY_GROUP_ID=sg-87654321
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=dev

# デプロイ実行
cdk deploy WebAppStack
```

### 5.3 コンテナイメージのビルド・プッシュ

⚠️ **重要**: CDKデプロイ後、Lambda関数にコンテナイメージを設定する必要があります。

#### ステップ1: Dockerイメージビルド

```bash
# Next.jsアプリケーションディレクトリに移動
cd docker/nextjs

# Dockerイメージビルド
docker build -t permission-aware-rag-webapp:latest .

# ビルド確認
docker images | grep permission-aware-rag-webapp
```

#### ステップ2: ECRへのプッシュ

```bash
# ECRログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージタグ付け
docker tag permission-aware-rag-webapp:latest \
  ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:latest

# ECRにプッシュ
docker push ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:latest
```

#### ステップ3: Lambda関数更新（必須）

```bash
# Lambda関数名の取得
FUNCTION_NAME=$(aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `WebApp`)].FunctionName' \
  --output text \
  --region ap-northeast-1)

# Lambda関数のイメージ更新
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:latest \
  --region ap-northeast-1

# 更新確認
aws lambda get-function-configuration \
  --function-name ${FUNCTION_NAME} \
  --region ap-northeast-1 \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus}'
```

#### ステップ4: CloudFrontキャッシュのクリア

```bash
# CloudFront Distribution IDの取得
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `WebApp`)].Id' \
  --output text)

# キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --region us-east-1
```

### 5.4 Bedrock Agent管理権限

**v2.4.0以降**: Bedrock Agentの作成・削除・管理権限がCDKで自動的に設定されます。

**主要機能**:
- ✅ Agent作成・削除・更新
- ✅ Agent Alias管理
- ✅ Action Group管理
- ✅ Knowledge Base関連付け
- ✅ IAM PassRole（Agent作成時のサービスロール設定）

**付与される権限**:
- `bedrock:GetAgent`, `bedrock:ListAgents`
- `bedrock:CreateAgent`, `bedrock:DeleteAgent`
- `bedrock:UpdateAgent`, `bedrock:PrepareAgent`
- `bedrock:CreateAgentAlias`, `bedrock:UpdateAgentAlias`
- `bedrock:CreateAgentActionGroup`, `bedrock:UpdateAgentActionGroup`
- `bedrock:AssociateAgentKnowledgeBase`
- `iam:PassRole`（Bedrock Agent用）

---

## 5.5 AgentCore Gateway デプロイメント

**v2.4.0以降**: AgentCore Gateway Constructは、AWS-managed KMS暗号化を使用してCloudWatch Logsを保護します。

### Gateway Constructの概要

AgentCore Gateway Constructは、既存のREST API、Lambda関数、MCPサーバーをBedrock Agent Toolsに変換する統合レイヤーです。

**主要機能**:
- REST API変換（OpenAPI仕様からTool定義を自動生成）
- Lambda関数変換（既存Lambda関数をAgent Toolsとして統合）
- MCP Server統合（Model Context Protocol対応）

**デプロイ構成**:
- **Infrastructure**: IAM Role、CloudWatch Logs、DynamoDB（Memory Table）
- **Lambda Functions**: REST API Converter、Lambda Function Converter、MCP Server Integration（オプション）

### KMS暗号化のベストプラクティス

#### AWS-Managed KMS vs Customer-Managed KMS

| 項目 | AWS-Managed KMS | Customer-Managed KMS |
|------|----------------|---------------------|
| **セットアップ** | 簡単（自動） | 複雑（KMSポリシー必要） |
| **CloudWatch Logs権限** | 自動設定 | 手動設定必要 |
| **キーローテーション** | 自動 | 手動（有効化可能） |
| **コスト** | 無料 | $1/月/キー |
| **制御** | 限定的 | 完全制御 |
| **デプロイ時間** | 高速（~47秒） | 低速（KMS作成+ポリシー） |
| **推奨用途** | ほとんどのユースケース | 厳格なコンプライアンス要件 |

**推奨事項**: 厳格なコンプライアンス要件がない限り、AWS-managed KMS暗号化を使用してください。

### Gateway Infrastructure デプロイ

#### Step 1: Gateway Infrastructure のみデプロイ

```bash
# Gateway Infrastructure デプロイ（Lambda関数なし）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-AgentCore-Gateway \
  --app 'npx ts-node bin/deploy-agentcore-gateway-only.ts' \
  --require-approval never \
  --region ap-northeast-1
```

**作成されるリソース**:
- IAM Role: `AgentCoreGatewayExecutionRole`
- IAM Policy: `AgentCoreGatewayExecutionRoleDefaultPolicy`
- CloudWatch Logs: `/aws/bedrock-agent-core/gateway/{projectName}-{environment}`
- KMS Key: `AgentCoreGatewayEncryptionKey`（将来の使用のため）
- DynamoDB Table: `AgentCoreMemoryMemoryTable`

**デプロイ時間**: 約47秒

#### Step 2: Gateway Lambda Functions デプロイ（オプション）

Gateway Lambda関数をデプロイするには、以下のいずれかのリソースが必要です：

**必要なリソース**:
1. **S3バケット**（REST API変換用）: OpenAPI仕様ファイルを格納
2. **Lambda関数ARNリスト**（Lambda変換用）: 既存Lambda関数のARN
3. **MCP Serverエンドポイント**（MCP統合用）: MCP ServerのURL

**設定例**:
```typescript
// bin/deploy-agentcore-gateway-only.ts
const gateway = new BedrockAgentCoreGatewayConstruct(stack, 'AgentCoreGateway', {
  projectName: 'permission-aware-rag',
  environment: 'prod',
  
  // REST API変換を有効化
  gatewaySpecsBucket: s3.Bucket.fromBucketName(this, 'Bucket', 'your-bucket-name'),
  restApiConversion: {
    openApiSpecKey: 'openapi/sample-openapi.yaml',
  },
  
  // Lambda関数変換を有効化
  lambdaFunctionConversion: {
    functionArns: [
      'arn:aws:lambda:ap-northeast-1:178625946981:function:your-function-1',
      'arn:aws:lambda:ap-northeast-1:178625946981:function:your-function-2',
    ],
  },
  
  // MCP Server統合を有効化
  mcpServerIntegration: {
    serverEndpoint: 'https://your-mcp-server.example.com',
  },
});
```

**再デプロイ**:
```bash
npx cdk deploy TokyoRegion-permission-aware-rag-prod-AgentCore-Gateway \
  --app 'npx ts-node bin/deploy-agentcore-gateway-only.ts' \
  --require-approval never \
  --region ap-northeast-1
```

### 条件付きIAMポリシー

Gateway Constructは、リソースが提供されている場合のみIAMポリシーを追加します。これにより、CDK検証エラーを防ぎます。

**実装例**:
```typescript
// Lambda関数ARNが提供されている場合のみ権限を追加
if (props.lambdaFunctionConversion?.functionArns && 
    props.lambdaFunctionConversion.functionArns.length > 0) {
  role.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: props.lambdaFunctionConversion.functionArns,
  }));
}

// KMS権限の追加（customer-managed keyが提供されている場合のみ）
if (this.encryptionKey) {
  role.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey'],
    resources: [this.encryptionKey.keyArn],
  }));
}
```

### トラブルシューティング

#### 問題1: CloudWatch Logs KMS権限エラー

**症状**:
```
Resource handler returned message: "User: arn:aws:sts::123456789012:assumed-role/cdk-hnb659fds-cfn-exec-role-123456789012-ap-northeast-1/AWSCloudFormation is not authorized to perform: kms:CreateGrant on resource: arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
```

**解決策**: AWS-managed KMS暗号化を使用（デフォルト）
```typescript
// encryptionKeyプロパティを指定しない
const logGroup = new logs.LogGroup(this, 'LogGroup', {
  logGroupName: `/aws/bedrock-agent-core/gateway/${projectName}-${environment}`,
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  // AWS-managed暗号化（自動）
});
```

#### 問題2: IAMポリシー検証エラー

**症状**:
```
Invalid policy: Empty array or wildcard ARN
```

**解決策**: 条件付きIAMポリシー作成を使用
```typescript
// リソースが提供されている場合のみポリシーを追加
if (props.lambdaFunctionConversion?.functionArns && 
    props.lambdaFunctionConversion.functionArns.length > 0) {
  role.addToPolicy(new iam.PolicyStatement({...}));
}
```

### 検証手順

```bash
# 1. IAM Role確認
aws iam get-role \
  --role-name AgentCoreGatewayExecutionRole7730E9B0 \
  --region ap-northeast-1

# 2. CloudWatch Logs確認
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/bedrock-agent-core/gateway" \
  --region ap-northeast-1

# 3. DynamoDB Table確認
aws dynamodb describe-table \
  --table-name AgentCoreMemoryMemoryTable22F44D07 \
  --region ap-northeast-1

# 4. Lambda関数確認（Lambda関数デプロイ後）
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `AgentCoreGateway`)].FunctionName' \
  --region ap-northeast-1
```

---

## 6. Lambda VPC配置

### 6.1 VPC配置オプション

#### VPC外配置（デフォルト）

**特徴**:
- ✅ シンプルな構成、VPC設定不要
- ✅ 低コスト（VPC Endpoint料金不要）
- ✅ 高速起動（Cold Start ~1秒）
- ✅ インターネット経由でAWSサービスにアクセス

**設定例**:
```typescript
// lib/config/environments/webapp-standalone-config.ts
lambda: {
  vpc: {
    enabled: false, // VPC外に配置（デフォルト）
  },
}
```

**推奨用途**: 開発環境、プロトタイピング、コスト最適化優先

#### VPC内配置（推奨）

**特徴**:
- ✅ セキュリティ強化（プライベートネットワーク内）
- ✅ データ主権（データがVPC外に出ない）
- ✅ 低レイテンシ（VPC Endpoint経由）
- ✅ コンプライアンス対応

**設定例**:
```typescript
// lib/config/environments/webapp-standalone-config.ts
lambda: {
  vpc: {
    enabled: true, // VPC内に配置
    endpoints: {
      dynamodb: true,           // 無料（Gateway Endpoint）
      bedrockRuntime: true,     // $7.2/月（Interface Endpoint）
      bedrockAgentRuntime: true, // $7.2/月（Interface Endpoint）
    },
  },
}
```

**VPC Endpoint料金**:
- DynamoDB: 無料（Gateway Endpoint）
- Bedrock Runtime: $7.2/月
- Bedrock Agent Runtime: $7.2/月
- **合計**: $14.4/月（Bedrock使用時）

**推奨用途**: 本番環境、セキュリティ要件が高い場合、コンプライアンス対応

### 6.2 VPC配置の切り替え手順

#### Step 1: 設定ファイルを編集

```bash
# VPC内配置に変更
vim lib/config/environments/webapp-standalone-config.ts

# 以下のように設定
lambda: {
  vpc: {
    enabled: true,
    endpoints: {
      dynamodb: true,
      bedrockRuntime: true,
      bedrockAgentRuntime: true,
    },
  },
}
```

#### Step 2: CDKデプロイ

```bash
npx cdk deploy --all
```

#### Step 3: VPC設定の確認

```bash
# Lambda関数のVPC設定を確認
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'VpcConfig' \
  --output json

# VPC Endpointの確認
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=[VPC_ID]" \
  --query 'VpcEndpoints[*].[ServiceName,State]' \
  --output table
```

### 6.3 VPC配置の比較表

| 項目 | VPC外配置 | VPC内配置 |
|------|----------|----------|
| **セキュリティ** | 標準 | 強化 |
| **コスト** | 低（$0/月） | 中（$14.4/月） |
| **Cold Start** | 高速（~1秒） | やや遅い（~2秒） |
| **レイテンシ** | 標準 | 低（VPC EP経由） |
| **設定複雑度** | 低 | 中 |
| **推奨環境** | 開発・プロトタイプ | 本番・コンプライアンス |

---

## 7. リソース競合チェック（CDKデプロイ時）

### 7.1 概要

CloudFormationの`AWS::EarlyValidation::ResourceExistenceCheck`フックにより、既存リソースとの競合が検出されるとデプロイが失敗します。DataStackデプロイ時は、必ずリソース競合チェックを実行してください。

**典型的なエラー**:
```
Failed to create ChangeSet: FAILED, The following hook(s)/validation failed: 
[AWS::EarlyValidation::ResourceExistenceCheck]
```

**主な原因**:
- DynamoDBテーブル名の重複
- CloudFormationスタックの問題のある状態（ROLLBACK_COMPLETE等）
- 既存リソースとの名前衝突

### 7.2 推奨デプロイフロー（DataStack）

#### フロー1: 自動修復デプロイ（推奨）

```bash
# 統合スクリプトで自動修復 + デプロイ
./development/scripts/deployment/deploy-with-conflict-check.sh \
  TokyoRegion-permission-aware-rag-prod-Data --auto-fix

# 期待される動作:
# - 競合チェック実行
# - 競合が検出された場合、ユーザー確認後に自動削除
# - CDKデプロイ実行
# - デプロイ後確認
```

#### フロー2: 手動確認デプロイ

```bash
# 1. 競合チェックのみ実行
npx ts-node development/scripts/deployment/pre-deploy-check.ts \
  --stack-name TokyoRegion-permission-aware-rag-prod-Data

# 2. 競合があれば手動で解決
aws dynamodb delete-table --table-name prod-permission-cache
aws dynamodb delete-table --table-name prod-user-access-table

# 3. CDKデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data \
  --app 'npx ts-node bin/data-stack-app.ts' \
  --require-approval never
```

### 7.3 DataStack特有の注意事項

#### TypeScript実行方法（重要）

**問題**: `npm run build`でコンパイルしたJavaScriptファイルを実行すると、古いバージョンが実行される可能性がある

**解決**: `npx ts-node`を使用してTypeScriptを直接実行する

```bash
# ❌ 悪い例: 古いJavaScriptファイルが実行される可能性
npx cdk deploy --app 'node bin/deploy-production.js'

# ✅ 良い例: 最新のTypeScriptファイルが実行される
npx cdk deploy --app 'npx ts-node bin/deploy-production.ts'
```

#### FSx for ONTAPサブネット要件

**問題**: FSx for ONTAPのデプロイメントタイプによってサブネット数が異なる

**解決**: デプロイメントタイプを確認してから、適切なサブネット数を決定する

| デプロイメントタイプ | 必要なサブネット数 | 説明 |
|-------------------|-----------------|------|
| `SINGLE_AZ_1` | **1つ** | 単一AZにデプロイ、コスト効率的 |
| `MULTI_AZ_1` | **2つ** | 2つのAZにデプロイ、高可用性 |

**実装例**:
```typescript
// デプロイメントタイプに応じてサブネット数を決定
const deploymentType = config.deploymentType || 'SINGLE_AZ_1';
const requiredSubnetCount = deploymentType === 'SINGLE_AZ_1' ? 1 : 2;
const fsxSubnetIds = this.props.privateSubnetIds.slice(0, requiredSubnetCount);
```

#### OpenSearch条件チェック

**問題**: `if (props.config.openSearch?.enabled)`では`false`と`undefined`を区別できない

**解決**: `if (props.config.openSearch?.enabled === true)`で明示的にチェック

```typescript
// ❌ 悪い例: false と undefined を区別できない
if (props.config.openSearch?.enabled) {
  // OpenSearch作成
}

// ✅ 良い例: 明示的に true をチェック
if (props.config.openSearch?.enabled === true) {
  // OpenSearch作成
} else {
  console.log('OpenSearch Serverless is disabled, skipping creation');
}
```

#### 既存VPCインポート時の型安全性

**問題**: 既存VPCをインポートする場合は`IVpc`型を返すが、`this.vpc`が`Vpc`型で宣言されていた

**解決**: `this.vpc`の型を`Vpc`から`IVpc`に変更

```typescript
// ❌ 悪い例: Vpc型で宣言
public readonly vpc: cdk.aws_ec2.Vpc;

// ✅ 良い例: IVpc型で宣言（既存VPCインポート対応）
public readonly vpc: cdk.aws_ec2.IVpc;
```

### 7.4 DataStackデプロイ手順（完全版）

```bash
# Phase 1: 古いスタック削除（ROLLBACK_COMPLETE状態の場合）
aws cloudformation delete-stack \
  --stack-name TokyoRegion-permission-aware-rag-prod-Data \
  --region ap-northeast-1

# 削除完了を待機（約5分）
aws cloudformation wait stack-delete-complete \
  --stack-name TokyoRegion-permission-aware-rag-prod-Data \
  --region ap-northeast-1

# Phase 2: 競合リソース削除（必要に応じて）
aws dynamodb delete-table --table-name prod-permission-cache --region ap-northeast-1
aws dynamodb delete-table --table-name prod-user-access-table --region ap-northeast-1

# Phase 3: DataStackデプロイ（TypeScript直接実行）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data \
  --app 'npx ts-node bin/deploy-production.ts' \
  --require-approval never

# Phase 4: デプロイ確認
# FSx File System確認
aws fsx describe-file-systems \
  --region ap-northeast-1 \
  --query 'FileSystems[?Tags[?Key==`Environment` && Value==`prod`]].[FileSystemId,FileSystemType,StorageCapacity,Lifecycle,SubnetIds]' \
  --output table

# DynamoDB Tables確認
aws dynamodb list-tables \
  --region ap-northeast-1 \
  --query 'TableNames[?contains(@, `prod`)]' \
  --output table
```

### 7.5 利用可能なツール

#### 1. リソース競合ハンドラー（CDKコード内）
**ファイル**: `lib/utils/resource-conflict-handler.ts`

```typescript
import { ResourceConflictHandler, ResourceConflictAspect } from '../lib/utils/resource-conflict-handler';

// Aspectとして追加（bin/data-stack-app.tsで既に統合済み）
const conflictAspect = new ResourceConflictAspect(conflictHandler);
cdk.Aspects.of(stack).add(conflictAspect);
```

#### 2. デプロイ前チェックスクリプト
**ファイル**: `development/scripts/deployment/pre-deploy-check.ts`

```bash
# チェックのみ
npx ts-node development/scripts/deployment/pre-deploy-check.ts \
  --stack-name TokyoRegion-permission-aware-rag-prod-Data

# 自動修復（実行）
npx ts-node development/scripts/deployment/pre-deploy-check.ts \
  --stack-name TokyoRegion-permission-aware-rag-prod-Data \
  --auto-fix
```

#### 3. 統合デプロイスクリプト
**ファイル**: `development/scripts/deployment/deploy-with-conflict-check.sh`

```bash
# 自動修復してデプロイ
./development/scripts/deployment/deploy-with-conflict-check.sh \
  TokyoRegion-permission-aware-rag-prod-Data --auto-fix

# ドライラン
./development/scripts/deployment/deploy-with-conflict-check.sh \
  TokyoRegion-permission-aware-rag-prod-Data --auto-fix --dry-run
```

### 7.6 ベストプラクティス

1. **デプロイ前に必ず競合チェック**: 統合スクリプトを使用（推奨）
2. **ドライランで動作確認**: 本番デプロイ前にドライランで確認
3. **TypeScript直接実行**: `npx ts-node`を使用して最新コードを実行
4. **テーブル命名規則の統一**: `{ProjectName}-{Environment}-{TableName}`形式
5. **CDK Aspectの活用**: `bin/data-stack-app.ts`で既に統合済み

---

## 8. マルチリージョンデプロイ

### 8.1 対応リージョン一覧（14リージョン）

#### 日本地域（2リージョン）
- 🇯🇵 **東京** (`ap-northeast-1`) - Bedrockサポート
- 🇯🇵 **大阪** (`ap-northeast-3`) - フォールバック: 東京

#### APAC地域（4リージョン）
- 🇸🇬 **シンガポール** (`ap-southeast-1`) - Bedrockサポート
- 🇦🇺 **シドニー** (`ap-southeast-2`) - Bedrockサポート
- 🇮🇳 **ムンバイ** (`ap-south-1`) - フォールバック: シンガポール
- 🇰🇷 **ソウル** (`ap-northeast-2`) - フォールバック: 東京

#### EU地域（4リージョン）
- 🇮🇪 **アイルランド** (`eu-west-1`) - Bedrockサポート
- 🇩🇪 **フランクフルト** (`eu-central-1`) - Bedrockサポート
- 🇬🇧 **ロンドン** (`eu-west-2`) - フォールバック: アイルランド
- 🇫🇷 **パリ** (`eu-west-3`) - Bedrockサポート

#### US地域（3リージョン）
- 🇺🇸 **バージニア** (`us-east-1`) - Bedrockサポート
- 🇺🇸 **オレゴン** (`us-west-2`) - Bedrockサポート
- 🇺🇸 **オハイオ** (`us-east-2`) - フォールバック: バージニア

#### 南米地域（1リージョン）
- 🇧🇷 **サンパウロ** (`sa-east-1`) - フォールバック: バージニア

### 7.2 マルチリージョンアーキテクチャ

#### リージョン自動選択の仕組み

1. **ユーザーがリージョンを選択**
   - UIでリージョンを選択（例: 東京リージョン）

2. **モデルの可用性チェック**
   - 選択されたモデルが指定リージョンで利用可能かチェック

3. **自動フォールバック**
   - 利用不可の場合、最適なリージョンに自動切り替え
   - レイテンシーを考慮した優先順位で選択

4. **透過的な処理**
   - ユーザーは意識せずに全てのモデルを利用可能

### 7.3 マルチリージョンデプロイ手順

#### 設定ファイル

```typescript
// lib/config/environments/tokyo-config.ts
export const tokyoConfig = {
  region: 'ap-northeast-1',
  primaryRegion: 'ap-northeast-1',
  fallbackRegions: ['us-east-1', 'us-west-2'],
  enableMultiRegion: true
};
```

#### デプロイコマンド

```bash
# 東京リージョンにデプロイ
export CDK_DEFAULT_REGION=ap-northeast-1
cdk deploy --all

# US East 1リージョンにデプロイ
export CDK_DEFAULT_REGION=us-east-1
cdk deploy --all

# EU Central 1リージョンにデプロイ
export CDK_DEFAULT_REGION=eu-central-1
cdk deploy --all
```

### 7.4 環境変数の設定

#### Lambda関数

```bash
# プライマリリージョン
PRIMARY_REGION=ap-northeast-1

# フォールバックリージョン（カンマ区切り）
FALLBACK_REGIONS=us-east-1,us-west-2

# マルチリージョン有効化
ENABLE_MULTI_REGION=true
```

#### Next.js環境変数

```bash
# .env.local
NEXT_PUBLIC_PRIMARY_REGION=ap-northeast-1
NEXT_PUBLIC_FALLBACK_REGIONS=us-east-1,us-west-2
NEXT_PUBLIC_ENABLE_MULTI_REGION=true
```

---

## 8. 更新デプロイ

### 8.1 Next.jsアプリケーション更新

```bash
# 1. コード変更
cd docker/nextjs
# ファイル編集...

# 2. ローカルテスト
npm run dev

# 3. ビルド確認
npm run build

# 4. Dockerイメージビルド
docker build -t permission-aware-rag-nextjs .

# 5. ECRプッシュ
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com

docker tag permission-aware-rag-nextjs:latest \
  ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-nextjs:latest

docker push ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-nextjs:latest

# 6. Lambda関数更新
aws lambda update-function-code \
  --function-name $(aws lambda list-functions \
    --query 'Functions[?contains(FunctionName, `WebApp`)].FunctionName' \
    --output text) \
  --image-uri ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-nextjs:latest

# 7. CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id $(aws cloudfront list-distributions \
    --query 'DistributionList.Items[?contains(Comment, `WebApp`)].Id' \
    --output text) \
  --paths "/*"
```

### 8.2 CDKスタック更新

```bash
# 1. CDKコード変更
# lib/stacks/integrated/ 配下のファイル編集...

# 2. TypeScriptビルド
npm run build

# 3. 差分確認
cdk diff --all  # 全スタック
cdk diff WebAppStack  # 個別スタック

# 4. 更新デプロイ
cdk deploy --all  # 全スタック
cdk deploy WebAppStack  # 個別スタック
```

### 8.3 ロールバック手順

#### CDKスタックロールバック

```bash
# 1. 前のバージョンに戻す
git log --oneline
git checkout COMMIT-HASH

# 2. ビルド
npm run build

# 3. デプロイ
cdk deploy --all
```

#### Lambda関数ロールバック

```bash
# 1. バージョン確認
aws lambda list-versions-by-function \
  --function-name FUNCTION-NAME

# 2. 前のバージョンに戻す
aws lambda update-alias \
  --function-name FUNCTION-NAME \
  --name prod \
  --function-version PREVIOUS-VERSION
```

---

## 9. コンポーネント別デプロイ

### 9.1 NetworkingStack - ネットワーク基盤

**主要リソース**:
- VPC、サブネット（Public・Private・Isolated）
- インターネットゲートウェイ、NATゲートウェイ
- セキュリティグループ、VPCエンドポイント

```bash
# NetworkingStackデプロイ
cdk deploy NetworkingStack

# 出力値確認
aws cloudformation describe-stacks \
  --stack-name NetworkingStack \
  --query 'Stacks[0].Outputs'
```

### 9.2 SecurityStack - セキュリティ設定

**主要リソース**:
- IAM（権限管理・ロール・ポリシー）
- KMS（暗号化キー管理）
- WAF（Webアプリケーションファイアウォール）
- GuardDuty（脅威検出）、CloudTrail（監査ログ）

```bash
# SecurityStackデプロイ
cdk deploy SecurityStack

# KMSキー確認
aws kms list-keys --query 'Keys[].KeyId'

# WAF WebACL確認
aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1
```

### 9.3 DataStack - データ・ストレージ統合

**主要リソース**:
- DynamoDB（メタデータ管理・セッション管理）
- OpenSearch Serverless（ベクトル検索エンジン）

**注**: FSx for ONTAPは現在DataStackから削除され、別途手動デプロイが必要です。

```bash
# DataStackデプロイ（NetworkingStack・SecurityStack必須）
cdk deploy DataStack

# DynamoDBテーブル確認
aws dynamodb list-tables

# OpenSearch Serverlessコレクション確認
aws opensearchserverless list-collections
```

### 9.4 EmbeddingStack - コンピュート・AI統合

**主要リソース**:
- Lambda関数（ドキュメント埋め込み処理）
- Bedrock統合（Amazon Titan Embeddings・Claude・Nova Pro）
- AWS Batch（大量データバッチ処理）
- ECS（コンテナベース処理）

```bash
# EmbeddingStackデプロイ（全依存スタック必須）
cdk deploy EmbeddingStack

# Lambda関数確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `Embedding`)].FunctionName'
```

### 9.5 WebAppStack - API・フロントエンド統合

**主要リソース**:
- Lambda Function（Next.jsアプリケーション）
- Lambda Function URL（HTTPSエンドポイント）
- CloudFront（グローバルCDN）
- ECR（コンテナイメージレジストリ）
- DynamoDB（セッション管理）

```bash
# WebAppStackデプロイ
cdk deploy WebAppStack

# 出力値確認
aws cloudformation describe-stacks \
  --stack-name WebAppStack \
  --query 'Stacks[0].Outputs'

# CloudFrontディストリビューション確認
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `WebApp`)].{Id:Id,DomainName:DomainName}'
```

### 9.6 OperationsStack - 監視・エンタープライズ統合

**主要リソース**:
- CloudWatch（メトリクス・ログ・ダッシュボード）
- X-Ray（分散トレーシング）
- SNS（アラート通知）
- CloudWatch Alarms（閾値監視）

```bash
# OperationsStackデプロイ（全依存スタック必須）
cdk deploy OperationsStack

# CloudWatchダッシュボード確認
aws cloudwatch list-dashboards

# SNSトピック確認
aws sns list-topics
```

---

## 10. 環境別設定

### 10.1 開発環境（dev）

#### 設定
```bash
# 環境変数
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# デプロイ
cdk deploy --all
```

#### 特徴
- **コスト最適化**: 最小リソース構成
- **高速デプロイ**: 承認スキップ可能
- **デバッグ有効**: 詳細ログ出力
- **リソース削減**: NATゲートウェイ1個、小さいインスタンスサイズ

### 10.2 ステージング環境（staging）

#### 設定
```bash
# 環境変数
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=staging
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# デプロイ
cdk deploy --all
```

#### 特徴
- **本番同等**: 本番と同じ構成
- **テスト用**: 統合テスト・負荷テスト実行
- **分離環境**: 本番への影響なし
- **データ分離**: 本番データとは完全分離

### 10.3 本番環境（prod）

#### 設定
```bash
# 環境変数
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=prod
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1
export AWS_PROFILE=production  # 本番用プロファイル

# デプロイ（段階的推奨）
cdk deploy NetworkingStack
cdk deploy SecurityStack
cdk deploy DataStack
cdk deploy EmbeddingStack
cdk deploy WebAppStack
cdk deploy OperationsStack
```

#### 特徴
- **高可用性**: マルチAZ構成
- **セキュリティ強化**: 全暗号化・WAF有効・GuardDuty有効
- **監視強化**: CloudWatch・X-Ray・SNSアラート有効
- **バックアップ**: 自動バックアップ有効
- **スケーラビリティ**: Auto Scaling設定

### 10.4 環境間の違い

| 項目 | dev | staging | prod |
|------|-----|---------|------|
| NATゲートウェイ | 1個 | 2個 | 2個 |
| Lambda メモリ | 512MB | 1024MB | 3008MB |
| DynamoDB | オンデマンド | オンデマンド | プロビジョニング |
| バックアップ | 無効 | 有効（7日） | 有効（30日） |
| WAF | 無効 | 有効 | 有効 |
| GuardDuty | 無効 | 有効 | 有効 |
| CloudWatch詳細監視 | 無効 | 有効 | 有効 |
| X-Ray | 無効 | 有効 | 有効 |
| コスト | 最小 | 中程度 | 最大 |

---

## 11. トラブルシューティング

### 11.1 セキュリティ脆弱性エラー

#### npm audit で脆弱性が検出される

```bash
# エラー
npm audit
# 6 vulnerabilities (1 low, 5 moderate)

# 解決方法1: 自動修正
npm audit fix

# 解決方法2: 強制修正（破壊的変更の可能性あり）
npm audit fix --force

# 解決方法3: 手動更新（推奨）
npm install aws-cdk@2.1033.0 aws-cdk-lib@2.228.0 \
  cdk-nag@2.37.55 cdk-docker-image-deployment@0.0.932

# 確認
npm audit
# found 0 vulnerabilities ✅
```

#### 依存関係の競合エラー

```bash
# エラー
npm ERR! ERESOLVE unable to resolve dependency tree

# 解決方法
rm -rf node_modules package-lock.json
npm install

# それでも解決しない場合
npm install --legacy-peer-deps
```

### 11.2 デプロイ失敗

#### CDK Bootstrap未実行
```bash
# エラー
Error: Need to perform AWS CDK bootstrap

# 解決方法
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### IAM権限不足
```bash
# エラー
Error: User is not authorized to perform: iam:CreateRole

# 解決方法
# AdministratorAccess権限を付与
aws iam attach-user-policy \
  --user-name YOUR-USER \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

#### TypeScriptコンパイルエラー
```bash
# エラー
Error: Cannot find module

# 解決方法
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 11.3 Lambda関数エラー

#### タイムアウトエラー
```bash
# ログ確認
aws logs tail /aws/lambda/FUNCTION-NAME --follow

# タイムアウト延長
aws lambda update-function-configuration \
  --function-name FUNCTION-NAME \
  --timeout 300
```

#### メモリ不足エラー
```bash
# メモリ増加
aws lambda update-function-configuration \
  --function-name FUNCTION-NAME \
  --memory-size 3008
```

### 11.4 CloudFrontキャッシュ問題

#### 古いコンテンツ表示
```bash
# キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION-ID \
  --paths "/*"

# 無効化状況確認
aws cloudfront get-invalidation \
  --distribution-id DISTRIBUTION-ID \
  --id INVALIDATION-ID
```

### 11.5 スタンドアローンモード特有の問題

#### ECRリポジトリが見つからない
```bash
# エラー
Error: ECR repository not found

# 解決方法
# ECRリポジトリを手動作成
aws ecr create-repository \
  --repository-name permission-aware-rag-webapp \
  --region ap-northeast-1

# または環境変数を設定してCDKに自動作成させる
export STANDALONE_MODE=true
cdk deploy WebAppStack
```

#### VPC作成エラー
```bash
# エラー
Error: VPC limit exceeded

# 解決方法
# 既存VPCを利用
export EXISTING_VPC_ID=vpc-12345678
export STANDALONE_MODE=true
cdk deploy WebAppStack
```

---

## 12. ベストプラクティス

### 12.1 デプロイ前チェックリスト

- [ ] AWS認証情報設定済み
- [ ] CDK Bootstrap実行済み
- [ ] 依存関係インストール済み
- [ ] TypeScriptビルド成功
- [ ] 差分確認実施
- [ ] バックアップ作成済み
- [ ] ロールバック手順確認済み
- [ ] セキュリティ監査実施（npm audit）
- [ ] リソース競合チェック実行（CDKデプロイ時）

### 12.2 セキュリティ考慮事項

#### 最小権限の原則
```typescript
// IAMポリシー例
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem",
      "dynamodb:PutItem"
    ],
    "Resource": "arn:aws:dynamodb:*:*:table/specific-table"
  }]
}
```

#### 暗号化の徹底
- **保存時暗号化**: S3、DynamoDB、FSx
- **転送時暗号化**: HTTPS、TLS 1.2以上
- **キー管理**: AWS KMS使用

### 12.3 パフォーマンス最適化

#### Lambda関数
- **メモリ最適化**: 適切なメモリサイズ設定
- **コールドスタート削減**: Provisioned Concurrency使用
- **タイムアウト設定**: 適切なタイムアウト値

#### CloudFront
- **キャッシュ戦略**: 適切なTTL設定
- **圧縮有効化**: Gzip/Brotli圧縮
- **オリジンシールド**: 有効化検討

### 12.4 スタンドアローンモードのベストプラクティス

#### 開発環境での使用
- スタンドアローンモードは開発・テスト環境に最適
- 迅速なイテレーションが可能
- コスト削減効果が高い

#### 本番環境での使用
- 本番環境では統合モードを推奨
- より堅牢なセキュリティ設定
- 他のスタックとの連携による高可用性

#### リソース管理
- ECRリポジトリは複数環境で共有可能
- VPCは既存リソースを活用してコスト削減
- 不要なリソースは定期的に削除

---

## 13. リファレンス

### 13.1 CDKコマンドリファレンス

#### 基本コマンド
```bash
# スタック一覧表示
cdk list

# 全スタック一覧（詳細）
cdk list --long

# スタック合成（CloudFormationテンプレート生成）
cdk synth NetworkingStack

# 全スタック合成
cdk synth --all

# 差分確認
cdk diff NetworkingStack

# 全スタック差分確認
cdk diff --all
```

#### デプロイコマンド
```bash
# 個別スタックデプロイ
cdk deploy NetworkingStack

# 全スタック一括デプロイ
cdk deploy --all

# スタンドアローンモードでデプロイ
STANDALONE_MODE=true cdk deploy WebAppStack

# 承認スキップ
cdk deploy --all --require-approval never

# 詳細ログ出力
cdk deploy --all --verbose

# 複数スタック同時デプロイ
cdk deploy NetworkingStack SecurityStack DataStack
```

#### 削除コマンド
```bash
# 個別スタック削除
cdk destroy OperationsStack

# 全スタック削除
cdk destroy --all

# 承認スキップ
cdk destroy --all --force
```

#### その他のコマンド
```bash
# Bootstrap（初回のみ）
cdk bootstrap

# メタデータ表示
cdk metadata NetworkingStack

# ドキュメント表示
cdk docs

# バージョン確認
cdk --version

# コンテキスト値確認
cdk context

# コンテキスト値クリア
cdk context --clear
```

### 13.2 環境変数リファレンス

#### 基本環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `AWS_REGION` | AWSリージョン | `ap-northeast-1` | ✅ |
| `AWS_PROFILE` | AWSプロファイル | `default` | - |
| `ENVIRONMENT` | 環境名 | `dev` | ✅ |
| `PROJECT_NAME` | プロジェクト名 | `permission-aware-rag` | ✅ |
| `CDK_DEFAULT_ACCOUNT` | AWSアカウントID | - | ✅ |
| `CDK_DEFAULT_REGION` | CDKデフォルトリージョン | - | ✅ |

#### スタンドアローンモード環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `STANDALONE_MODE` | スタンドアローンモード有効化 | `false` | ✅ |
| `EXISTING_VPC_ID` | 既存VPC ID | - | - |
| `EXISTING_SECURITY_GROUP_ID` | 既存セキュリティグループID | - | - |
| `ECR_REPOSITORY_NAME` | ECRリポジトリ名 | `permission-aware-rag-webapp` | - |

#### マルチリージョン環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `PRIMARY_REGION` | プライマリリージョン | `ap-northeast-1` | ✅ |
| `FALLBACK_REGIONS` | フォールバックリージョン（カンマ区切り） | `us-east-1,us-west-2` | - |
| `ENABLE_MULTI_REGION` | マルチリージョン有効化 | `true` | - |

### 13.3 デプロイスクリプトリファレンス

#### スタンドアローンデプロイスクリプト

**ローカル環境用**:
```bash
./development/scripts/deployment/deploy-webapp-standalone.sh
```

**EC2環境用**:
```bash
./development/scripts/deployment/deploy-webapp-on-ec2.sh
```

**機能**:
- 環境変数の自動設定
- TypeScriptビルド
- CDKスタック確認
- スタンドアローンモードでのデプロイ
- デプロイ結果の確認
- 出力値の表示

### 13.4 関連ドキュメント

#### 内部ドキュメント
- [AgentCore完全ガイド](agentcore-complete-guide.md)
- [AgentCoreセキュリティ・運用ガイド](agentcore-security-operations-guide.md)
- [AgentCore監視・トラブルシューティング](agentcore-monitoring-troubleshooting-guide.md)
- [フロントエンド開発ガイド](frontend-development-guide.md)
- [デバッグ・トラブルシューティングガイド](debugging-troubleshooting-guide.md)
- [クイックスタートガイド](quick-start.md)
- [FAQ](faq.md)

#### AWS公式ドキュメント
- [AWS CDK デプロイメントガイド](https://docs.aws.amazon.com/cdk/v2/guide/deploying.html)
- [Lambda コンテナイメージ](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [CloudFront デプロイメント](https://docs.aws.amazon.com/cloudfront/latest/developerguide/distribution-working-with.html)

### 13.5 バージョン履歴

#### v2.4.0（2026-01-18）
- ✅ デプロイメント完全ガイド作成
- ✅ 3つのソースガイドを統合
- ✅ リソース競合防止ルール追加
- ✅ Phase 0.8知見の反映

#### v2.2.0（2025-01-24）
- ✅ WebAppスタック スタンドアローンモード実装
- ✅ ECRリポジトリ自動作成・参照機能
- ✅ 既存VPC・セキュリティグループ参照機能
- ✅ 型安全性の向上
- ✅ デプロイスクリプトの追加

#### v2.1.0（2024-11-16）
- ✅ 14リージョン対応UI実装
- ✅ マルチリージョン自動フォールバック機能
- ✅ リージョン別モデル可用性チェック

#### v2.0.0（2024-11-16）
- ✅ 統合デプロイメントガイド作成
- ✅ 6スタック構成への統合
- ✅ モジュラーアーキテクチャ採用

---

## まとめ

このデプロイメント完全ガイドでは、以下の内容をカバーしています：

### 主要機能
- ✅ **全スタック一括デプロイ**: 依存関係を自動解決
- ✅ **WebAppスタンドアローンデプロイ**: 独立した迅速なデプロイ
- ✅ **Lambda VPC配置**: VPC内外の柔軟な配置
- ✅ **マルチリージョン対応**: 14リージョンでのグローバル展開
- ✅ **個別スタックデプロイ**: 細かい制御と段階的デプロイ
- ✅ **環境別設定**: dev/staging/prod環境の最適化
- ✅ **リソース競合防止**: CDKデプロイ時の自動チェック

### デプロイパターン
1. **初回デプロイ**: 全スタック一括デプロイで環境構築
2. **開発デプロイ**: WebAppスタンドアローンで迅速なイテレーション
3. **本番デプロイ**: 段階的デプロイで安全な本番環境構築
4. **マルチリージョン**: グローバル展開とフォールバック
5. **Phase 0.8実証済み**: ECRプッシュ・Lambda更新の確実な手順

### 次のステップ
- [AgentCore完全ガイド](agentcore-complete-guide.md)でAgentCore機能を確認
- [フロントエンド開発ガイド](frontend-development-guide.md)でUI開発を開始
- [デバッグ・トラブルシューティングガイド](debugging-troubleshooting-guide.md)で問題解決方法を確認
- [クイックスタートガイド](quick-start.md)で素早く開始

---

**作成日**: 2026-01-18  
**バージョン**: v2.4.0  
**統合元**: deployment-guide.md + deployment-guide-unified.md + lambda-vpc-deployment-guide.md


