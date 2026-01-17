# デプロイメントガイド

**最終更新**: 2025年1月24日  
**バージョン**: v2.2.0  
**対象**: Permission-aware RAG System with FSx for ONTAP

---

## 📋 目次

1. [概要](#1-概要)
2. [環境準備](#2-環境準備)
3. [初回デプロイ](#3-初回デプロイ)
4. [WebAppスタック スタンドアローンデプロイ](#4-webappスタック-スタンドアローンデプロイ)
5. [マルチリージョンデプロイ](#5-マルチリージョンデプロイ)
6. [更新デプロイ](#6-更新デプロイ)
7. [コンポーネント別デプロイ](#7-コンポーネント別デプロイ)
8. [環境別設定](#8-環境別設定)
9. [トラブルシューティング](#9-トラブルシューティング)
10. [ベストプラクティス](#10-ベストプラクティス)
11. [リファレンス](#11-リファレンス)

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
- **WebAppスタンドアローン**: WebAppスタックのみの独立デプロイ対応（v2.2.0新機能）
- **マルチリージョン対応**: 14リージョンでのデプロイ可能
- **コスト最適化**: Amazon Nova Pro統合による60-80%のコスト削減
- **FSx統合**: NetApp ONTAP による高性能ファイルストレージ

### 1.2 デプロイメント戦略

#### 全スタック一括デプロイ（推奨）
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

#### WebAppスタック スタンドアローンデプロイ（v2.2.0新機能）
```bash
# WebAppスタックのみをデプロイ
STANDALONE_MODE=true cdk deploy WebAppStack
```

**利点**:
- 他のスタックに依存しない
- フロントエンドの迅速な更新
- 開発環境での素早いテスト
- コスト削減（必要最小限のリソース）


#### 個別スタックデプロイ
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

### 1.3 前提条件

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

### 2.1 セキュリティ要件（Task 6.6対応）

#### 依存関係のセキュリティ状態

このプロジェクトは、Task 6.6（2025-11-25）でセキュリティ脆弱性を完全に修正しました：

**セキュリティ品質指標**:
- ✅ **セキュリティ脆弱性**: 0件（6件→0件、100%削減達成）
- ✅ **npm audit**: クリーン
- ✅ **依存関係**: 最新版に更新済み

**修正された脆弱性**:

1. **aws-cdk**: 2.147.3 → 2.1033.0
   - RestApi authorizationScope生成の脆弱性修正

2. **aws-cdk-lib**: 2.147.3 → 2.228.0
   - IAM OIDC カスタムリソースの脆弱性修正
   - Cognito UserPoolClient ログ出力の脆弱性修正
   - CodePipeline trusted entities の脆弱性修正

3. **cdk-nag**: 2.28.195 → 2.37.55
   - セキュリティルールの最新化

4. **cdk-docker-image-deployment**: 0.0.10 → 0.0.932
   - xml2js プロトタイプ汚染の脆弱性修正
   - brace-expansion ReDoS脆弱性修正

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

### 2.2 開発環境セットアップ

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

### 2.3 CDK Bootstrap

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

## 3. 初回デプロイ

### 3.1 ローカル環境デプロイ

#### ステップ1: 設定確認
```bash
# 環境変数設定
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=prod
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# CDKスタック一覧（デフォルト: bin/deploy-all-stacks.ts）
cdk list

# 期待される出力（6つの統合スタック）
TokyoRegion-permission-aware-rag-prod-Networking
TokyoRegion-permission-aware-rag-prod-Security
TokyoRegion-permission-aware-rag-prod-Data
TokyoRegion-permission-aware-rag-prod-Embedding
TokyoRegion-permission-aware-rag-prod-WebApp
TokyoRegion-permission-aware-rag-prod-Operations
```


#### ステップ2: 差分確認
```bash
# 全スタックの差分確認
cdk diff --all

# 特定スタックの差分確認
cdk diff NetworkingStack
cdk diff WebAppStack
```

#### ステップ3: デプロイ実行
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

#### ステップ4: デプロイ確認
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

#### ステップ5: 統合テスト実行（推奨）

デプロイ完了後、統合テストを実行して全スタックが正常に動作していることを確認します：

```bash
# 統合テスト実行
./development/scripts/testing/run-integration-tests.sh ap-northeast-1

# または npm scriptで実行
export AWS_REGION=ap-northeast-1
npm run test:integration:full-stack
```

**テスト内容**:
- 全5スタック（NetworkingStack、SecurityStack、DataStack、EmbeddingStack、OperationsStack）の動作確認
- 22のテストケースを実行
- スタック間の連携確認

詳細は[統合テスト実行ガイド](../../development/docs/guides/integration-testing-guide.md)を参照してください。

---

## 4. WebAppスタック スタンドアローンデプロイ

### 4.1 概要

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

### 4.2 スタンドアローンモードの仕組み

#### リソース自動作成

スタンドアローンモードでは、以下のリソースを自動的に作成または参照します：

1. **ECRリポジトリ**
   - 既存リポジトリがあれば参照
   - なければ自動作成（`permission-aware-rag-webapp`）

2. **VPC・ネットワーク**
   - 既存VPCを参照（VPC ID指定時）
   - または最小限のVPCを作成（パブリックサブネットのみ）

3. **セキュリティグループ**
   - 既存セキュリティグループを参照（SG ID指定時）
   - または必要最小限のセキュリティグループを作成

4. **IAMロール**
   - Lambda実行ロールを自動作成
   - 必要最小限の権限のみ付与

### 4.3 デプロイ手順

#### パターン1: 完全スタンドアローン（全リソース自動作成）

```bash
# 環境変数設定
export STANDALONE_MODE=true
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=dev

# デプロイ実行
cdk deploy WebAppStack

# または明示的にスタンドアローンモード指定
cdk deploy WebAppStack --context standaloneMode=true
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

**作成されるリソース**:
- ECRリポジトリ（既存があれば参照）
- セキュリティグループ（既存VPC内に作成）
- Lambda関数
- CloudFront
- IAMロール

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

**作成されるリソース**:
- ECRリポジトリ（既存があれば参照）
- Lambda関数
- CloudFront
- IAMロール


### 4.4 コンテナイメージのビルド・プッシュ

⚠️ **重要**: CDKデプロイ後、Lambda関数にコンテナイメージを設定する必要があります。この手順を省略すると、Lambda関数が正常に動作しません（`{"Message":null}` エラーが発生）。

詳細は [Lambda関数イメージ修正レポート](../../development/docs/reports/local/webapp-lambda-image-fix-20250124.md) を参照してください。

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

# プッシュ確認
aws ecr describe-images \
  --repository-name permission-aware-rag-webapp \
  --region ap-northeast-1
```

#### ステップ3: Lambda関数更新（必須）

⚠️ **この手順は必須です**: CDKデプロイ時にLambda関数が作成されますが、コンテナイメージは設定されていません。以下のコマンドで手動設定が必要です。

```bash
# Lambda関数名の取得
FUNCTION_NAME=$(aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `WebApp`)].FunctionName' \
  --output text \
  --region ap-northeast-1)

echo "Lambda関数名: ${FUNCTION_NAME}"

# Lambda関数のイメージ更新
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${CDK_DEFAULT_ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:latest \
  --region ap-northeast-1

# 更新完了まで待機（約10秒）
sleep 10

# 更新確認
aws lambda get-function-configuration \
  --function-name ${FUNCTION_NAME} \
  --region ap-northeast-1 \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus,CodeSize:CodeSize}'
```

**期待される出力**:
```json
{
    "State": "Active",
    "LastUpdateStatus": "Successful",
    "CodeSize": 0
}
```

#### ステップ4: CloudFrontキャッシュのクリア（推奨）

Lambda関数更新後、CloudFrontキャッシュをクリアして最新のコンテンツを配信します：

```bash
# CloudFront Distribution IDの取得
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `WebApp`)].Id' \
  --output text)

echo "CloudFront Distribution ID: ${DISTRIBUTION_ID}"

# キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --region us-east-1

# 無効化状況確認
aws cloudfront list-invalidations \
  --distribution-id ${DISTRIBUTION_ID} \
  --region us-east-1 \
  --query 'InvalidationList.Items[0].{Id:Id,Status:Status,CreateTime:CreateTime}'
```

**キャッシュクリアの待機時間**: 通常1-3分で完了します。

#### トラブルシューティング

**問題**: ブラウザで `{"Message":null}` エラーが表示される

**原因**: Lambda関数にコンテナイメージが設定されていない

**解決方法**:
1. ステップ3のLambda関数更新を実行
2. ステップ4のCloudFrontキャッシュクリアを実行
3. 1-3分待機後、再度アクセス

**確認コマンド**:
```bash
# Lambda関数の状態確認
aws lambda get-function-configuration \
  --function-name ${FUNCTION_NAME} \
  --region ap-northeast-1 \
  --query '{ImageUri:ImageUri,CodeSize:CodeSize,State:State}'
```

**正常な状態**:
- `ImageUri`: ECRリポジトリのURIが設定されている
- `CodeSize`: 0（イメージベースの場合は0が正常）
- `State`: "Active"

### 4.5 デプロイスクリプト

#### 自動デプロイスクリプト

プロジェクトには、スタンドアローンデプロイを自動化するスクリプトが用意されています：

```bash
# ローカル環境でのデプロイ
./development/scripts/deployment/deploy-webapp-standalone.sh

# EC2環境でのデプロイ
./development/scripts/deployment/deploy-webapp-on-ec2.sh
```

**スクリプトの機能**:
1. 環境変数の自動設定
2. TypeScriptビルド
3. CDKスタック確認
4. スタンドアローンモードでのデプロイ
5. デプロイ結果の確認
6. 出力値の表示

### 4.6 統合モードへの切り替え

スタンドアローンモードから統合モードへの切り替えも簡単です：

```bash
# 統合モードでデプロイ（他のスタックと連携）
unset STANDALONE_MODE
cdk deploy --all
```

**統合モードの特徴**:
- NetworkingStackのVPCを利用
- SecurityStackのIAMロールを利用
- DataStackのDynamoDBを利用
- 本番環境に推奨

### 4.7 削除手順

#### スタンドアローンスタックの削除

```bash
# WebAppスタックのみ削除
cdk destroy WebAppStack

# ECRリポジトリの削除（オプション）
aws ecr delete-repository \
  --repository-name permission-aware-rag-webapp \
  --force
```

**注意事項**:
- スタンドアローンモードで作成したリソースは、他のスタックに影響を与えずに削除できます
- ECRリポジトリは `--force` オプションで強制削除（イメージも削除）
- VPCやセキュリティグループは自動的に削除されます

---

## 5. マルチリージョンデプロイ

### 5.1 対応リージョン一覧（14リージョン）

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

### 5.2 マルチリージョンアーキテクチャ

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


### 5.3 マルチリージョンデプロイ手順

#### 設定ファイル

```typescript
// lib/config/environments/tokyo-config.ts
export const tokyoConfig = {
  region: 'ap-northeast-1',
  primaryRegion: 'ap-northeast-1',
  fallbackRegions: ['us-east-1', 'us-west-2'],
  enableMultiRegion: true
};

// lib/config/environments/virginia-config.ts
export const virginiaConfig = {
  region: 'us-east-1',
  primaryRegion: 'us-east-1',
  fallbackRegions: ['us-west-2', 'ap-northeast-1'],
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

### 5.4 リージョン別モデル可用性

#### 東京リージョン (ap-northeast-1)

**利用可能**:
- ✅ Amazon Nova (全モデル)
- ✅ Anthropic Claude (全モデル)
- ✅ Mistral AI (全モデル)

**利用不可（自動フォールバック）**:
- ❌ AI21 Labs → US East 1にフォールバック
- ❌ Cohere → US East 1にフォールバック
- ❌ Meta Llama → US East 1にフォールバック

#### US East 1リージョン (us-east-1)

**利用可能**:
- ✅ 全プロバイダーの全モデル

#### EU Central 1リージョン (eu-central-1)

**利用可能**:
- ✅ Amazon Nova (全モデル)
- ✅ Anthropic Claude (全モデル)
- ✅ Mistral AI (全モデル)
- ✅ Cohere (全モデル)
- ✅ Meta Llama (全モデル)

**利用不可（自動フォールバック）**:
- ❌ AI21 Labs → US East 1にフォールバック

### 5.5 環境変数の設定

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

## 6. 更新デプロイ

### 6.1 コード更新デプロイ

#### Next.jsアプリケーション更新

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

#### Lambda関数コード更新

```bash
# 1. コード変更
cd lambda
# ファイル編集...

# 2. ZIPパッケージ作成
zip -r function.zip .

# 3. Lambda更新
aws lambda update-function-code \
  --function-name FUNCTION-NAME \
  --zip-file fileb://function.zip
```

### 6.2 インフラ更新デプロイ

#### CDKスタック更新

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

### 6.3 ロールバック手順

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

## 6.5 Bedrock Agent管理権限

### 6.5.1 概要

**v2.4.0以降**: Bedrock Agentの作成・削除・管理権限がCDKで自動的に設定されます。

**主要機能**:
- ✅ Agent作成・削除・更新
- ✅ Agent Alias管理
- ✅ Action Group管理
- ✅ Knowledge Base関連付け
- ✅ IAM PassRole（Agent作成時のサービスロール設定）

### 6.5.2 CDKでの実装

**ファイル**: `lib/stacks/integrated/webapp-stack.ts`

**実装箇所**: 約950-1000行目（`createIamRoles()`メソッド内）

```typescript
// Bedrock Agent管理権限（Agent Info API用 - 2025-12-12修正）
// Agent作成・管理権限追加（2025-12-31追加）
this.executionRole.addToPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    // Agent情報取得に必要な権限（bedrock名前空間）
    'bedrock:GetAgent',
    'bedrock:ListAgents',
    'bedrock:ListAgentAliases', 
    'bedrock:GetAgentAlias',
    'bedrock:UpdateAgent',
    'bedrock:PrepareAgent',
    // Agent作成・削除権限（2025-12-31追加）
    'bedrock:CreateAgent',
    'bedrock:DeleteAgent',
    'bedrock:CreateAgentAlias',
    'bedrock:UpdateAgentAlias',
    'bedrock:DeleteAgentAlias',
    // Action Group管理権限
    'bedrock:CreateAgentActionGroup',
    'bedrock:UpdateAgentActionGroup',
    'bedrock:DeleteAgentActionGroup',
    'bedrock:GetAgentActionGroup',
    'bedrock:ListAgentActionGroups',
    // Knowledge Base関連権限
    'bedrock:AssociateAgentKnowledgeBase',
    'bedrock:DisassociateAgentKnowledgeBase',
    'bedrock:GetAgentKnowledgeBase',
    'bedrock:ListAgentKnowledgeBases',
    // 従来のbedrock-agent権限も維持（互換性のため）
    'bedrock-agent:GetAgent',
    'bedrock-agent:ListAgents',
    'bedrock-agent:UpdateAgent',
    'bedrock-agent:PrepareAgent',
  ],
  resources: ['*'],
}));

// IAM PassRole権限（Bedrock Agent更新・作成時に必要）
this.executionRole.addToPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'iam:PassRole',
  ],
  resources: [
    `arn:aws:iam::${this.account}:role/*bedrock-agent-role*`,
    `arn:aws:iam::${this.account}:role/AmazonBedrockExecutionRoleForAgents_*`,
  ],
  conditions: {
    StringEquals: {
      'iam:PassedToService': 'bedrock.amazonaws.com'
    }
  }
}));
```

### 6.5.3 デプロイ手順

#### 新しいAWSアカウントへのデプロイ

```bash
# Step 1: CDKブートストラップ（初回のみ）
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION> --profile <PROFILE_NAME>

# Step 2: WebAppStackのデプロイ
npx cdk deploy WebAppStack \
  --region <REGION> \
  --profile <PROFILE_NAME> \
  --require-approval never

# Step 3: デプロイ確認
aws iam get-role \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --region <REGION> \
  --profile <PROFILE_NAME>
```

### 6.5.4 権限の検証

#### 検証1: Agent作成権限

```bash
# Lambda関数を使ってAgent作成をテスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --payload '{"rawPath": "/api/bedrock/agent/create", "requestContext": {"http": {"method": "POST"}}}' \
  --region <REGION> \
  --profile <PROFILE_NAME> \
  response.json

cat response.json
```

#### 検証2: Agent削除権限

```bash
# Lambda関数を使ってAgent削除をテスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --payload '{"rawPath": "/api/bedrock/agents/delete?agentId=TEST_AGENT_ID&region=ap-northeast-1", "requestContext": {"http": {"method": "DELETE"}}}' \
  --region <REGION> \
  --profile <PROFILE_NAME> \
  response.json

cat response.json
```

### 6.5.5 付与される権限一覧

#### Bedrock Agent管理権限

| 権限 | 説明 | 用途 |
|------|------|------|
| `bedrock:GetAgent` | Agent情報取得 | Agent詳細表示 |
| `bedrock:ListAgents` | Agent一覧取得 | Agent選択ドロップダウン |
| `bedrock:CreateAgent` | Agent作成 | Agent作成ウィザード |
| `bedrock:UpdateAgent` | Agent更新 | Agent設定変更 |
| `bedrock:DeleteAgent` | Agent削除 | Agent削除ボタン |
| `bedrock:PrepareAgent` | Agent準備 | Agent有効化 |
| `bedrock:ListAgentAliases` | エイリアス一覧取得 | エイリアス管理 |
| `bedrock:GetAgentAlias` | エイリアス情報取得 | エイリアス詳細 |
| `bedrock:CreateAgentAlias` | エイリアス作成 | エイリアス作成 |
| `bedrock:UpdateAgentAlias` | エイリアス更新 | エイリアス設定変更 |
| `bedrock:DeleteAgentAlias` | エイリアス削除 | エイリアス削除 |

#### Action Group管理権限

| 権限 | 説明 | 用途 |
|------|------|------|
| `bedrock:CreateAgentActionGroup` | Action Group作成 | 機能拡張 |
| `bedrock:UpdateAgentActionGroup` | Action Group更新 | 機能変更 |
| `bedrock:DeleteAgentActionGroup` | Action Group削除 | 機能削除 |
| `bedrock:GetAgentActionGroup` | Action Group情報取得 | 詳細表示 |
| `bedrock:ListAgentActionGroups` | Action Group一覧取得 | 一覧表示 |

#### Knowledge Base関連権限

| 権限 | 説明 | 用途 |
|------|------|------|
| `bedrock:AssociateAgentKnowledgeBase` | Knowledge Base関連付け | RAG機能追加 |
| `bedrock:DisassociateAgentKnowledgeBase` | Knowledge Base関連付け解除 | RAG機能削除 |
| `bedrock:GetAgentKnowledgeBase` | Knowledge Base情報取得 | 詳細表示 |
| `bedrock:ListAgentKnowledgeBases` | Knowledge Base一覧取得 | 一覧表示 |

#### IAM PassRole権限

| 権限 | 説明 | 用途 |
|------|------|------|
| `iam:PassRole` | ロール委譲 | Agent作成時のサービスロール設定 |

**条件**:
- `iam:PassedToService`: `bedrock.amazonaws.com`
- リソース: `*bedrock-agent-role*`, `AmazonBedrockExecutionRoleForAgents_*`

### 6.5.6 トラブルシューティング

#### エラー1: 権限不足エラー

**症状**:
```
User: arn:aws:sts::123456789012:assumed-role/... is not authorized to perform: bedrock:CreateAgent
```

**対処法**:
1. CDKデプロイが完了していることを確認
2. Lambda関数が最新のIAMロールを使用していることを確認
3. IAMポリシーが正しく適用されていることを確認

```bash
# IAMポリシーの確認
aws iam get-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name WebAppExecutionRoleDefaultPolicy4CA0A1AC \
  --region ap-northeast-1
```

#### エラー2: Lambda関数が古いロールを使用

**症状**:
- CDKデプロイ後も権限エラーが発生

**対処法**:
```bash
# Lambda関数を更新（コンテナリフレッシュ）
aws lambda put-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --reserved-concurrent-executions 0 \
  --region ap-northeast-1

sleep 10

aws lambda delete-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1
```

---

## 7. コンポーネント別デプロイ

### 7.1 NetworkingStack - ネットワーク基盤

#### 概要
**主要リソース**:
- **VPC**: 仮想プライベートクラウド
- **サブネット**: Public・Private・Isolated
- **インターネットゲートウェイ**: 外部接続
- **NATゲートウェイ**: プライベートサブネットの外部通信
- **セキュリティグループ**: ファイアウォールルール
- **VPCエンドポイント**: AWSサービスへのプライベート接続

#### デプロイ手順
```bash
# NetworkingStackデプロイ
cdk deploy NetworkingStack

# 出力値確認
aws cloudformation describe-stacks \
  --stack-name NetworkingStack \
  --query 'Stacks[0].Outputs'
```

### 7.2 SecurityStack - セキュリティ設定

#### 概要
**主要リソース**:
- **IAM**: 権限管理・ロール・ポリシー
- **KMS**: 暗号化キー管理
- **WAF**: Webアプリケーションファイアウォール
- **GuardDuty**: 脅威検出
- **CloudTrail**: 監査ログ

#### デプロイ手順
```bash
# SecurityStackデプロイ
cdk deploy SecurityStack

# KMSキー確認
aws kms list-keys --query 'Keys[].KeyId'

# WAF WebACL確認
aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1
```

### 7.3 DataStack - データ・ストレージ統合

#### 概要
**主要リソース**:
- **DynamoDB**: メタデータ管理・セッション管理
- **OpenSearch Serverless**: ベクトル検索エンジン

**注**: FSx for ONTAPは現在DataStackから削除され、別途手動デプロイが必要です。

#### デプロイ手順
```bash
# DataStackデプロイ（NetworkingStack・SecurityStack必須）
cdk deploy DataStack

# DynamoDBテーブル確認
aws dynamodb list-tables

# FSxファイルシステム確認
aws fsx describe-file-systems

# OpenSearch Serverlessコレクション確認
aws opensearchserverless list-collections
```

### 7.4 EmbeddingStack - コンピュート・AI統合

#### 概要
**主要リソース**:
- **Lambda関数**: ドキュメント埋め込み処理
- **Bedrock統合**: Amazon Titan Embeddings・Claude・Nova Pro
- **AWS Batch**: 大量データバッチ処理
- **ECS**: コンテナベース処理

#### デプロイ手順
```bash
# EmbeddingStackデプロイ（全依存スタック必須）
cdk deploy EmbeddingStack

# Lambda関数確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `Embedding`)].FunctionName'

# Batch環境確認
aws batch describe-compute-environments \
  --query 'computeEnvironments[?contains(computeEnvironmentName, `permission-aware-rag`)]'
```

### 7.5 WebAppStack - API・フロントエンド統合

#### 概要
**主要リソース**:
- **Lambda Function**: Next.jsアプリケーション（Lambda Web Adapter）
- **Lambda Function URL**: HTTPSエンドポイント
- **CloudFront**: グローバルCDN
- **ECR**: コンテナイメージレジストリ
- **DynamoDB**: セッション管理

#### デプロイ手順
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

### 7.6 OperationsStack - 監視・エンタープライズ統合

#### 概要
**主要リソース**:
- **CloudWatch**: メトリクス・ログ・ダッシュボード
- **X-Ray**: 分散トレーシング
- **SNS**: アラート通知
- **CloudWatch Alarms**: 閾値監視

#### デプロイ手順
```bash
# OperationsStackデプロイ（全依存スタック必須）
cdk deploy OperationsStack

# CloudWatchダッシュボード確認
aws cloudwatch list-dashboards

# SNSトピック確認
aws sns list-topics

# CloudWatchアラーム確認
aws cloudwatch describe-alarms
```

---

## 8. 環境別設定

### 8.1 開発環境（dev）

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

### 8.2 ステージング環境（staging）

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


### 8.3 本番環境（prod）

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

### 8.4 環境間の違い

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

## 9. トラブルシューティング

### 9.1 セキュリティ脆弱性エラー（Task 6.6対応）

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
# package.jsonを以下のバージョンに更新
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

### 9.2 デプロイ失敗

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

### 9.2 Lambda関数エラー

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

### 9.3 CloudFrontキャッシュ問題

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

### 9.4 スタンドアローンモード特有の問題

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

## 10. ベストプラクティス

### 10.1 デプロイ前チェックリスト

- [ ] AWS認証情報設定済み
- [ ] CDK Bootstrap実行済み
- [ ] 依存関係インストール済み
- [ ] TypeScriptビルド成功
- [ ] 差分確認実施
- [ ] バックアップ作成済み
- [ ] ロールバック手順確認済み

### 10.2 セキュリティ考慮事項

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

### 10.3 パフォーマンス最適化

#### Lambda関数
- **メモリ最適化**: 適切なメモリサイズ設定
- **コールドスタート削減**: Provisioned Concurrency使用
- **タイムアウト設定**: 適切なタイムアウト値

#### CloudFront
- **キャッシュ戦略**: 適切なTTL設定
- **圧縮有効化**: Gzip/Brotli圧縮
- **オリジンシールド**: 有効化検討

### 10.4 スタンドアローンモードのベストプラクティス

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

## 11. リファレンス

### 11.1 CDKコマンドリファレンス

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

### 11.2 環境変数リファレンス

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

### 11.3 デプロイスクリプトリファレンス

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

### 11.4 関連ドキュメント

- [運用・保守ガイド](OPERATIONS_MAINTENANCE_GUIDE_JA.md)
- [モジュール開発ガイド](MODULE_DEVELOPMENT_GUIDE_JA.md)
- [統合テスト実行ガイド](../../development/docs/guides/integration-testing-guide.md)
- [クイックスタートガイド](quick-start.md)
- [FAQ](faq.md)

### 11.5 バージョン履歴

#### v2.2.0（2025年1月24日）
- ✅ WebAppスタック スタンドアローンモード実装
- ✅ ECRリポジトリ自動作成・参照機能
- ✅ 既存VPC・セキュリティグループ参照機能
- ✅ 型安全性の向上
- ✅ デプロイスクリプトの追加

#### v2.1.0（2024年11月16日）
- ✅ 14リージョン対応UI実装
- ✅ マルチリージョン自動フォールバック機能
- ✅ リージョン別モデル可用性チェック

#### v2.0.0（2024年11月16日）
- ✅ 統合デプロイメントガイド作成
- ✅ 6スタック構成への統合
- ✅ モジュラーアーキテクチャ採用

---

## まとめ

このデプロイメントガイドでは、以下の内容をカバーしています：

### 主要機能
- ✅ **全スタック一括デプロイ**: 依存関係を自動解決
- ✅ **WebAppスタンドアローンデプロイ**: 独立した迅速なデプロイ（v2.2.0新機能）
- ✅ **マルチリージョン対応**: 14リージョンでのグローバル展開
- ✅ **個別スタックデプロイ**: 細かい制御と段階的デプロイ
- ✅ **環境別設定**: dev/staging/prod環境の最適化

### デプロイパターン
1. **初回デプロイ**: 全スタック一括デプロイで環境構築
2. **開発デプロイ**: WebAppスタンドアローンで迅速なイテレーション
3. **本番デプロイ**: 段階的デプロイで安全な本番環境構築
4. **マルチリージョン**: グローバル展開とフォールバック

### 次のステップ
- [運用・保守ガイド](OPERATIONS_MAINTENANCE_GUIDE_JA.md)で運用方法を確認
- [クイックスタートガイド](quick-start.md)で素早く開始
- [FAQ](faq.md)でよくある質問を確認

---

**作成日**: 2025年1月24日  
**バージョン**: v2.2.0  
**統合元**: DEPLOYMENT_GUIDE_UNIFIED.md + multi-region-deployment-guide.md

