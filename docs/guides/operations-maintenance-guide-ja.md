# 🛠️ Permission-aware RAG System 運用・メンテナンス・開発ガイド

> **最終更新**: 2025年11月16日  
> **対象バージョン**: v1.0.0+  
> **対象者**: 開発者、運用担当者、システム管理者

---

## 📚 目次

<details>
<summary><strong>1. はじめに</strong></summary>

- [1.1 このガイドについて](#11-このガイドについて)
- [1.2 プロジェクト概要](#12-プロジェクト概要)
- [1.3 前提知識](#13-前提知識)
- [1.4 関連ドキュメント](#14-関連ドキュメント)

</details>

<details>
<summary><strong>2. クイックスタート</strong></summary>

- [2.1 環境セットアップ](#21-環境セットアップ)
- [2.2 初回デプロイ](#22-初回デプロイ)
- [2.3 動作確認](#23-動作確認)
- [2.4 よくある問題と解決方法](#24-よくある問題と解決方法)

</details>

<details>
<summary><strong>3. アーキテクチャ理解</strong></summary>

- [3.1 システム全体像](#31-システム全体像)
- [3.2 モジュラーアーキテクチャ](#32-モジュラーアーキテクチャ)
- [3.3 CDKスタック構成](#33-cdkスタック構成)
- [3.4 データフロー](#34-データフロー)

</details>

<details>
<summary><strong>4. 開発ガイド</strong></summary>

- [4.1 開発環境構築](#41-開発環境構築)
- [4.2 コーディング規約](#42-コーディング規約)
- [4.3 モジュール追加手順](#43-モジュール追加手順)
- [4.4 テスト実行](#44-テスト実行)

</details>

<details>
<summary><strong>5. デプロイメント</strong></summary>

- [5.1 デプロイ戦略](#51-デプロイ戦略)
- [5.2 環境別デプロイ](#52-環境別デプロイ)
- [5.3 ロールバック手順](#53-ロールバック手順)
- [5.4 デプロイ後検証](#54-デプロイ後検証)

</details>

<details>
<summary><strong>6. 運用・監視</strong></summary>

- [6.1 日常運用タスク](#61-日常運用タスク)
- [6.2 監視とアラート](#62-監視とアラート)
- [6.3 ログ管理](#63-ログ管理)
- [6.4 パフォーマンス最適化](#64-パフォーマンス最適化)

</details>

<details>
<summary><strong>7. トラブルシューティング</strong></summary>

- [7.1 一般的な問題](#71-一般的な問題)
- [7.2 デプロイ失敗](#72-デプロイ失敗)
- [7.3 Lambda関数エラー](#73-lambda関数エラー)
- [7.4 ネットワーク問題](#74-ネットワーク問題)

</details>

<details>
<summary><strong>8. セキュリティ</strong></summary>

- [8.1 セキュリティベストプラクティス](#81-セキュリティベストプラクティス)
- [8.2 脆弱性管理](#82-脆弱性管理)
- [8.3 アクセス制御](#83-アクセス制御)
- [8.4 監査とコンプライアンス](#84-監査とコンプライアンス)

</details>

<details>
<summary><strong>9. 付録</strong></summary>

- [9.1 用語集](#91-用語集)
- [9.2 コマンドリファレンス](#92-コマンドリファレンス)
- [9.3 設定ファイル一覧](#93-設定ファイル一覧)
- [9.4 FAQ](#94-faq)

</details>

---

## 1. はじめに

### 1.1 このガイドについて

このガイドは、Permission-aware RAG System with Amazon FSx for ONTAPの運用、メンテナンス、開発に関する包括的な情報を提供します。

**対象読者**:
- システム管理者: 日常運用とメンテナンス
- 開発者: 機能追加とカスタマイズ
- DevOpsエンジニア: デプロイメントと自動化
- セキュリティ担当者: セキュリティ管理とコンプライアンス

**ガイドの使い方**:
1. **初めての方**: セクション2「クイックスタート」から開始
2. **開発者**: セクション4「開発ガイド」を参照
3. **運用担当者**: セクション6「運用・監視」を参照
4. **問題発生時**: セクション7「トラブルシューティング」を参照

### 1.2 プロジェクト概要

**システム名**: Permission-aware RAG System with Amazon FSx for ONTAP

**目的**: Amazon FSx for ONTAPとAmazon Bedrockを組み合わせた、エンタープライズグレードの権限認識型RAG（Retrieval-Augmented Generation）システム

**主要機能**:
- ✅ 権限ベースアクセス制御: ユーザー固有の文書アクセス権限管理
- ✅ サーバーレスアーキテクチャ: AWS Lambda + CloudFront配信
- ✅ レスポンシブUI: Next.js + React + Tailwind CSS
- ✅ 高精度検索: OpenSearch Serverlessベクトル検索
- ✅ 高性能ストレージ: FSx for ONTAP
- ✅ マルチリージョン対応: 環境変数による柔軟な設定

**技術スタック**:
- **IaC**: AWS CDK v2 (TypeScript)
- **フロントエンド**: Next.js 14.2.16, React 18, Tailwind CSS
- **バックエンド**: AWS Lambda (Node.js 20.x)
- **データベース**: DynamoDB, OpenSearch Serverless
- **ストレージ**: FSx for ONTAP, S3
- **AI**: Amazon Bedrock (Nova Pro, Claude 3.5 Sonnet)
- **CDN**: CloudFront
- **認証**: AWS Cognito

### 1.3 前提知識

このガイドを効果的に活用するために、以下の知識が推奨されます:

**必須知識**:
- AWS基礎知識（IAM、VPC、Lambda、S3等）
- TypeScript/JavaScript基礎
- コマンドライン操作（bash/zsh）
- Git基本操作

**推奨知識**:
- AWS CDK v2の基本概念
- Next.js/Reactの基礎
- Docker基礎
- Infrastructure as Code (IaC)の概念

**学習リソース**:
- [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [Next.js公式ドキュメント](https://nextjs.org/docs)
- [AWS Lambda開発者ガイド](https://docs.aws.amazon.com/lambda/)

### 1.4 関連ドキュメント

**プロジェクトドキュメント**:
- [OPERATIONS_MAINTENANCE_GUIDE_EN.md](./OPERATIONS_MAINTENANCE_GUIDE_EN.md) - 英語版ガイド
- [DEPLOYMENT_GUIDE_UNIFIED.md](./DEPLOYMENT_GUIDE_UNIFIED.md) - 統合デプロイメントガイド

---

## 2. クイックスタート

### 2.1 環境セットアップ

#### 前提条件

**必須ツール**:
```bash
# Node.js 20.x以上
node --version  # v20.0.0+

# AWS CLI v2
aws --version  # aws-cli/2.0.0+

# AWS CDK v2
cdk --version  # 2.129.0+

# Docker
docker --version  # 20.10.0+

# Git
git --version  # 2.30.0+
```

**AWS認証情報設定**:
```bash
# AWS CLIプロファイル設定
aws configure

# 認証情報確認
aws sts get-caller-identity
```

#### リポジトリクローン

```bash
# GitHubからクローン
git clone https://github.com/NetAppJpTechTeam/Permission-aware-RAG-FSx for ONTAP-CDK.git
cd Permission-aware-RAG-FSx for ONTAP-CDK

# 依存関係インストール
npm install

# TypeScriptビルド
npm run build
```

#### 環境変数設定

```bash
# .env.localファイル作成
cat > .env.local << 'EOF'
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=your-account-id
PROJECT_NAME=permission-aware-rag
ENVIRONMENT=prod
NODE_ENV=production
EOF

# 環境変数読み込み
source .env.local
```

### 2.2 初回デプロイ

#### CDKブートストラップ

```bash
# 初回のみ実行（リージョン・アカウントごとに1回）
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
```

#### スタックデプロイ（推奨順序）

```bash
# 1. Networkingスタック
cdk deploy TokyoRegion-permission-aware-rag-prod-Networking

# 2. Securityスタック
cdk deploy TokyoRegion-permission-aware-rag-prod-Security

# 3. Dataスタック
cdk deploy TokyoRegion-permission-aware-rag-prod-Data

# 4. Embeddingスタック（埋め込み・AI）
cdk deploy TokyoRegion-permission-aware-rag-prod-Embedding

# 5. WebAppスタック
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp

# 6. Operationsスタック
cdk deploy TokyoRegion-permission-aware-rag-prod-Operations
```

**一括デプロイ（推奨）**:
```bash
# 全スタックを順次デプロイ
cdk deploy --all --require-approval never
```

### 2.3 動作確認

#### スタック状態確認

```bash
# CloudFormationスタック一覧
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `permission-aware-rag`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

#### Lambda関数確認

```bash
# Lambda関数一覧
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `permission-aware-rag`)].{Name:FunctionName,Runtime:Runtime,Status:State}' \
  --output table
```

#### CloudFront確認

```bash
# CloudFrontディストリビューション確認
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Origins.Items[0].DomainName, `lambda-url`)].{Id:Id,DomainName:DomainName,Status:Status}' \
  --output table
```

#### UI動作確認

```bash
# CloudFrontドメイン取得
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Origins.Items[0].DomainName, `lambda-url`)].DomainName' \
  --output text)

# ブラウザでアクセス
echo "https://${CLOUDFRONT_DOMAIN}"

# HTTPステータス確認
curl -I "https://${CLOUDFRONT_DOMAIN}"
```

### 2.4 よくある問題と解決方法

#### 問題1: CDKブートストラップエラー

**症状**:
```
Error: This stack uses assets, so the toolkit stack must be deployed
```

**解決方法**:
```bash
# CDKブートストラップ再実行
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1
```

#### 問題2: Lambda関数タイムアウト

**症状**:
```
Task timed out after 30.00 seconds
```

**解決方法**:
```bash
# Lambda関数タイムアウト設定変更
aws lambda update-function-configuration \
  --function-name FUNCTION_NAME \
  --timeout 300
```

#### 問題3: CloudFrontキャッシュ問題

**症状**: UI変更が反映されない

**解決方法**:
```bash
# CloudFrontキャッシュ無効化
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[0].Id' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

---

## 3. アーキテクチャ理解

### 3.1 システム全体像

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   CloudFront (CDN)                           │
│  - グローバル配信                                             │
│  - キャッシング                                               │
│  - WAF統合                                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda (Next.js WebApp)                         │
│  - サーバーレスコンピュート                                    │
│  - Lambda Web Adapter                                        │
│  - Function URL                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ DynamoDB │  │ Bedrock  │  │OpenSearch│
│ (Session)│  │  (AI)    │  │(Vector)  │
└──────────┘  └──────────┘  └──────────┘
                     │
                     ▼
              ┌──────────┐
              │   FSx    │
              │ (ONTAP)  │
              └──────────┘
```

### 3.2 モジュラーアーキテクチャ

プロジェクトは9つの機能別モジュールで構成されています:

```
lib/modules/
├── networking/     # VPC・サブネット・ゲートウェイ
├── security/       # IAM・KMS・WAF
├── storage/        # S3・FSx・EFS
├── database/       # DynamoDB・OpenSearch
├── compute/        # Lambda・Batch
├── ai/             # Bedrock・Embedding
├── api/            # API Gateway・Cognito
├── monitoring/     # CloudWatch・X-Ray
└── enterprise/     # アクセス制御・BI
```

**モジュール設計原則**:
- ✅ 単一責任原則: 各モジュールは明確な機能領域を担当
- ✅ 疎結合: モジュール間の依存関係を最小化
- ✅ 高凝集: 関連機能を1つのモジュールに集約
- ✅ 再利用性: 他プロジェクトでも利用可能

### 3.3 CDKスタック構成

**6つの統合CDKスタック**:

| スタック名 | 役割 | 主要リソース |
|-----------|------|-------------|
| NetworkingStack | ネットワーク基盤 | VPC, Subnet, Gateway |
| SecurityStack | セキュリティ設定 | IAM, KMS, WAF |
| DataStack | データ・ストレージ | DynamoDB, S3, FSx |
| EmbeddingStack | 埋め込み・AI | Lambda, Bedrock |
| WebAppStack | API・フロントエンド | API Gateway, CloudFront |
| OperationsStack | 監視・運用 | CloudWatch, SNS |

**スタック間依存関係**:
```
NetworkingStack
    ↓
SecurityStack
    ↓
DataStack
    ↓
EmbeddingStack
    ↓
WebAppStack
    ↓
OperationsStack
```

### 3.4 データフロー

**ユーザーリクエストフロー**:
```
1. ユーザー → CloudFront
2. CloudFront → Lambda (Next.js)
3. Lambda → Cognito (認証)
4. Lambda → DynamoDB (セッション取得)
5. Lambda → OpenSearch (ベクトル検索)
6. Lambda → Bedrock (AI応答生成)
7. Lambda → CloudFront → ユーザー
```

**文書埋め込みフロー**:
```
1. 文書アップロード → S3
2. S3イベント → Lambda (Embedding)
3. Lambda → FSx (文書読み込み)
4. Lambda → Bedrock (埋め込み生成)
5. Lambda → OpenSearch (ベクトル保存)
```

---

## 4. 開発ガイド

### 4.1 開発環境構築

#### ローカル開発環境

```bash
# リポジトリクローン
git clone https://github.com/NetAppJpTechTeam/Permission-aware-RAG-FSx for ONTAP-CDK.git
cd Permission-aware-RAG-FSx for ONTAP-CDK

# 依存関係インストール
npm install

# TypeScriptビルド（ウォッチモード）
npm run watch

# CDK差分確認
cdk diff
```

#### Next.jsローカル開発

```bash
# Next.jsディレクトリ移動
cd docker/nextjs

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ブラウザでアクセス
open http://localhost:3000
```

#### Lambda関数ローカルテスト

```bash
# Lambda関数ディレクトリ移動
cd lambda/security

# 依存関係インストール
npm install

# ローカルテスト実行
node -e "require('./threat-detection-service').handler({}, {})"
```

### 4.2 コーディング規約

#### TypeScript規約

**命名規則**:
```typescript
// クラス名: PascalCase
export class SecurityStack extends cdk.Stack {}

// 関数名: camelCase
function createWafConfiguration() {}

// 定数: UPPER_SNAKE_CASE
const DEFAULT_REGION = 'ap-northeast-1';

// インターフェース: PascalCase + Interface接尾辞
interface SecurityConfigInterface {}
```

**コメント規約**:
```typescript
/**
 * セキュリティスタック
 * WAF・GuardDuty・Security Hubを統合
 */
export class SecurityStack extends cdk.Stack {
  /** WAF WebACLのARN */
  public readonly wafArn: string;

  /**
   * コンストラクタ
   * @param scope - CDKスコープ
   * @param id - スタックID
   * @param props - スタックプロパティ
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // WAF設定の初期化
    this.setupWaf();
  }
}
```

#### ファイル配置規約

**禁止事項**:
- ❌ プロジェクトルートへの平置きファイル
- ❌ Phase系命名（phase6等）の使用
- ❌ 重複ファイル作成（optimized, improved等の接尾辞）

**正しい配置**:
```
lib/modules/security/
├── constructs/
│   └── waf-construct.ts
├── interfaces/
│   └── security-config.ts
└── README.md
```

### 4.3 モジュール追加手順


**基本手順**:
1. モジュールディレクトリ作成
2. インターフェース定義
3. Construct実装
4. 設定ファイル作成
5. README作成
6. テスト実装

### 4.4 テスト実行

```bash
# 全テスト実行
npm test

# 特定テストファイル実行
npm test -- security-stack.test.ts

# カバレッジ確認
npm test -- --coverage
```

---

## 5. デプロイメント

> 📖 **詳細なデプロイ手順は[デプロイメントガイド（統合版）](DEPLOYMENT_GUIDE_UNIFIED.md)を参照してください。**

### 5.1 デプロイ戦略

**段階的デプロイ（推奨）**:
1. Networkingスタック → 基盤構築
2. Securityスタック → セキュリティ設定
3. Dataスタック → データ層構築
4. Computeスタック → コンピュート層構築
5. WebAppスタック → アプリケーション層構築
6. Operationsスタック → 監視設定

**ブルーグリーンデプロイ**:
- 新環境構築 → テスト → トラフィック切替 → 旧環境削除

**カナリアデプロイ**:
- 一部トラフィックを新バージョンに流す → 監視 → 段階的拡大

### 5.2 環境別デプロイ

#### 開発環境

```bash
cdk deploy --all \
  -c projectName=rag-dev \
  -c environment=dev \
  -c region=ap-northeast-1
```

#### 本番環境

```bash
cdk deploy --all \
  -c projectName=rag-prod \
  -c environment=prod \
  -c region=ap-northeast-1 \
  --require-approval never
```

### 5.3 ロールバック手順

```bash
# スタック削除
cdk destroy TokyoRegion-permission-aware-rag-prod-WebApp

# 前バージョン再デプロイ
git checkout <previous-commit>
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
```

### 5.4 デプロイ後検証

```bash
# スタック状態確認
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp

# Lambda関数確認
aws lambda get-function \
  --function-name FUNCTION_NAME

# CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

---

**続きは次のセクションで追加します...**


<details>
<summary><strong>6. 運用・監視</strong></summary>

- [6.1 日常運用タスク](#61-日常運用タスク)
- [6.2 監視とアラート](#62-監視とアラート)
- [6.3 ログ管理](#63-ログ管理)
- [6.4 パフォーマンス最適化](#64-パフォーマンス最適化)

</details>

<details>
<summary><strong>7. トラブルシューティング</strong></summary>

- [7.1 一般的な問題](#71-一般的な問題)
- [7.2 デプロイエラー](#72-デプロイエラー)
- [7.3 ランタイムエラー](#73-ランタイムエラー)
- [7.4 緊急対応手順](#74-緊急対応手順)

</details>

<details>
<summary><strong>8. セキュリティ</strong></summary>

- [8.1 セキュリティベストプラクティス](#81-セキュリティベストプラクティス)
- [8.2 脆弱性対応](#82-脆弱性対応)
- [8.3 アクセス制御](#83-アクセス制御)
- [8.4 監査とコンプライアンス](#84-監査とコンプライアンス)

</details>

<details>
<summary><strong>9. リファレンス</strong></summary>

- [9.1 コマンドリファレンス](#91-コマンドリファレンス)
- [9.2 設定ファイル一覧](#92-設定ファイル一覧)
- [9.3 環境変数](#93-環境変数)
- [9.4 APIエンドポイント](#94-apiエンドポイント)

</details>

---

## 1. はじめに

### 1.1 このガイドについて

このガイドは、Permission-aware RAG System with Amazon FSx for ONTAPの運用、メンテナンス、開発を行うための包括的なドキュメントです。

**対象読者**:
- システム開発者
- DevOpsエンジニア
- システム管理者
- 運用担当者

**ガイドの使い方**:
1. 初めての方は「クイックスタート」から始めてください
2. 特定のタスクを実行する場合は、目次から該当セクションを参照してください
3. 問題が発生した場合は「トラブルシューティング」を確認してください

### 1.2 プロジェクト概要

**システム名**: Permission-aware RAG System with Amazon FSx for ONTAP

**主要機能**:
- 権限ベースの文書アクセス制御
- Amazon Bedrockを活用したAI検索・回答生成
- FSx for ONTAPによる高性能ストレージ
- サーバーレスアーキテクチャ（Lambda + CloudFront）
- マルチリージョン対応

**技術スタック**:
- **IaC**: AWS CDK v2 (TypeScript)
- **フロントエンド**: Next.js 14.2.16, React 18, Tailwind CSS
- **バックエンド**: AWS Lambda (Node.js 20.x)
- **データベース**: DynamoDB, OpenSearch Serverless
- **ストレージ**: S3, FSx for ONTAP
- **AI**: Amazon Bedrock (Nova Pro, Claude 3.5 Sonnet)

### 1.3 前提知識

このガイドを効果的に活用するために、以下の知識があることを推奨します：

**必須**:
- AWS基礎知識（IAM、VPC、Lambda、S3等）
- TypeScript/JavaScript基礎
- Git基本操作
- コマンドライン操作

**推奨**:
- AWS CDK経験
- Next.js/React経験
- Docker基礎知識
- Infrastructure as Code (IaC)の理解

### 1.4 関連ドキュメント

このガイドと併せて、以下のドキュメントを参照してください：

| ドキュメント | 説明 | パス |
|------------|------|------|
| README.md | プロジェクト概要 | `/README.md` |
| デプロイメントガイド | デプロイ手順詳細 | `/docs/DEPLOYMENT_GUIDE_UNIFIED.md` |
| モジュール開発ガイド | モジュール開発手順 | `/docs/guides/MODULE_DEVELOPMENT_GUIDE_JA.md` |
| アーキテクチャドキュメント | システム設計詳細 | `/docs/` |

---

## 2. クイックスタート

### 2.1 環境セットアップ

#### 前提条件の確認

```bash
# Node.js 20以上がインストールされていることを確認
node --version  # v20.x.x以上

# AWS CLIがインストールされていることを確認
aws --version

# AWS認証情報が設定されていることを確認
aws sts get-caller-identity
```

#### リポジトリのクローン

```bash
# GitHubからクローン
git clone https://github.com/NetAppJpTechTeam/Permission-aware-RAG-FSx for ONTAP-CDK.git
cd Permission-aware-RAG-FSx for ONTAP-CDK

# 依存関係のインストール
npm install

# TypeScriptビルド
npm run build
```

#### AWS CDKのブートストラップ

```bash
# 初回のみ実行（リージョンごとに1回）
cdk bootstrap --region ap-northeast-1
```

### 2.2 初回デプロイ

#### 開発環境へのデプロイ

```bash
# 全スタックを一括デプロイ（推奨）
npm run deploy:all:dev

# または個別にデプロイ
cdk deploy TokyoRegion-permission-aware-rag-prod-Networking
cdk deploy TokyoRegion-permission-aware-rag-prod-Security
cdk deploy TokyoRegion-permission-aware-rag-prod-Data
```

#### デプロイ進捗の確認

```bash
# CloudFormationスタックの状態確認
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Networking \
  --query 'Stacks[0].StackStatus'
```

### 2.3 動作確認

#### リソースの確認

```bash
# デプロイされたスタック一覧
cdk list

# Lambda関数の確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `permission-aware-rag`)].FunctionName'

# DynamoDBテーブルの確認
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `permission-aware-rag`)]'
```

#### アプリケーションへのアクセス

```bash
# CloudFrontディストリビューションURLの取得
aws cloudfront list-distributions \
  --query 'DistributionList.Items[0].DomainName' \
  --output text
```

ブラウザで取得したURLにアクセスし、サインインページが表示されることを確認します。

### 2.4 よくある問題と解決方法

<details>
<summary><strong>問題: CDK Bootstrapエラー</strong></summary>

**エラーメッセージ**:
```
Error: Need to perform AWS CDK bootstrap
```

**解決方法**:
```bash
cdk bootstrap --region ap-northeast-1 --profile your-profile
```

</details>

<details>
<summary><strong>問題: IAM権限不足</strong></summary>

**エラーメッセージ**:
```
User is not authorized to perform: iam:CreateRole
```

**解決方法**:
必要なIAM権限を付与してください：
- IAMFullAccess
- CloudFormationFullAccess
- Lambda関連権限
- S3関連権限

</details>

<details>
<summary><strong>問題: TypeScriptコンパイルエラー</strong></summary>

**解決方法**:
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

</details>

---

## 3. アーキテクチャ理解

### 3.1 システム全体像

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda (Next.js WebApp)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - サインイン機能                                      │  │
│  │  - チャットボット UI                                   │  │
│  │  - Bedrock統合                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ DynamoDB │  │    S3    │  │  Bedrock │
│(セッション)│  │(ドキュメント)│  │  (AI)   │
└──────────┘  └──────────┘  └──────────┘
                     │
                     ▼
              ┌──────────┐
              │   FSx    │
              │ (ONTAP)  │
              └──────────┘
```

### 3.2 モジュラーアーキテクチャ

プロジェクトは9つの機能別モジュールで構成されています：

```
lib/modules/
├── networking/     # VPC、サブネット、ゲートウェイ
├── security/       # IAM、KMS、WAF
├── storage/        # S3、FSx、バックアップ
├── database/       # DynamoDB、OpenSearch
├── compute/        # Lambda、Batch
├── ai/             # Bedrock、Embedding
├── api/            # API Gateway、Cognito
├── monitoring/     # CloudWatch、X-Ray
└── enterprise/     # アクセス制御、BI
```

**モジュール配置の原則**:
- 各モジュールは単一の責任を持つ
- モジュール間は疎結合
- CloudFormation出力値で情報共有

### 3.3 CDKスタック構成

6つの統合CDKスタックで構成：

| スタック名 | 役割 | 主要リソース |
|-----------|------|------------|
| NetworkingStack | ネットワーク基盤 | VPC、サブネット、ゲートウェイ |
| SecurityStack | セキュリティ設定 | IAM、KMS、WAF |
| DataStack | データ・ストレージ | DynamoDB、S3、FSx |
| ComputeStack | コンピュート・AI | Lambda、Bedrock |
| WebAppStack | API・フロントエンド | API Gateway、CloudFront |
| OperationsStack | 監視・運用 | CloudWatch、X-Ray |

**スタック間の依存関係**:
```
NetworkingStack
    ↓
SecurityStack
    ↓
DataStack
    ↓
ComputeStack
    ↓
WebAppStack
    ↓
OperationsStack
```

### 3.4 データフロー

#### ユーザー認証フロー

```
1. ユーザー → CloudFront → Lambda (サインインページ)
2. 認証情報入力
3. Lambda → DynamoDB (セッション作成)
4. リダイレクト → チャットボットページ
```

#### チャット・検索フロー

```
1. ユーザー質問 → Lambda
2. Lambda → FSx (権限チェック)
3. Lambda → S3 (ドキュメント取得)
4. Lambda → Bedrock (AI処理)
5. Bedrock → Lambda (回答生成)
6. Lambda → ユーザー (回答表示)
```

---


## 4. 開発ガイド

### 4.1 開発環境構築

#### ローカル開発環境

```bash
# プロジェクトディレクトリに移動
cd Permission-aware-RAG-FSx for ONTAP-CDK

# 開発用依存関係のインストール
npm install --include=dev

# TypeScript監視モード（自動ビルド）
npm run watch
```

#### VS Code推奨設定

`.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

#### 推奨VS Code拡張機能

- ESLint
- Prettier
- AWS Toolkit
- TypeScript and JavaScript Language Features

### 4.2 コーディング規約

#### TypeScript規約

**命名規則**:
```typescript
// ✅ 正しい例
export class SecurityStack extends cdk.Stack { }  // PascalCase
const bucketName = 'my-bucket';                   // camelCase
const DEFAULT_REGION = 'ap-northeast-1';          // UPPER_SNAKE_CASE

// ❌ 間違った例
export class security_stack { }                   // snake_case禁止
const BucketName = 'my-bucket';                   // 変数にPascalCase禁止
```

**コメント規則**:
```typescript
/**
 * セキュリティスタックの構築
 * 
 * @param scope - CDKアプリケーションスコープ
 * @param id - スタックID
 * @param props - スタックプロパティ
 */
export class SecurityStack extends cdk.Stack {
  /** WAF WebACLのARN */
  public readonly wafArn: string;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // KMS暗号化キーの作成
    const kmsKey = new kms.Key(this, 'EncryptionKey', {
      enableKeyRotation: true,
      description: 'RAGシステム用暗号化キー'
    });
  }
}
```

#### ファイル配置規則

**絶対禁止**:
- プロジェクトルートへのファイル平置き
- Phase系命名（phase6等）の使用
- 重複ファイルの作成（optimized、improved等の接尾辞）

**正しい配置**:
```
lib/modules/[module-name]/
├── constructs/          # CDK Construct実装
├── interfaces/          # TypeScript型定義
├── utils/              # ユーティリティ関数
└── README.md           # モジュールドキュメント
```

### 4.3 モジュール追加手順

#### 新規モジュールの作成

```bash
# 1. モジュールディレクトリ作成
mkdir -p lib/modules/my-module/{constructs,interfaces,utils}

# 2. README作成
cat > lib/modules/my-module/README.md << 'EOF'
# My Module

## 概要
このモジュールの説明

## 主要機能
- 機能1
- 機能2

## 使用方法
\`\`\`typescript
import { MyConstruct } from './constructs/my-construct';
\`\`\`
EOF
```

#### インターフェース定義

`lib/modules/my-module/interfaces/my-config.ts`:
```typescript
/**
 * MyModule設定インターフェース
 */
export interface MyModuleConfig {
  /** モジュール名 */
  readonly moduleName: string;
  
  /** 有効化フラグ */
  readonly enabled: boolean;
  
  /** オプション設定 */
  readonly options?: {
    readonly timeout?: number;
    readonly retryCount?: number;
  };
}
```

#### Construct実装

`lib/modules/my-module/constructs/my-construct.ts`:
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MyModuleConfig } from '../interfaces/my-config';

/**
 * MyModule Construct
 */
export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string, config: MyModuleConfig) {
    super(scope, id);
    
    // リソース作成ロジック
    if (config.enabled) {
      // 実装
    }
  }
}
```

#### スタックへの統合

`lib/stacks/integrated/my-stack.ts`:
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MyConstruct } from '../../modules/my-module/constructs/my-construct';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // モジュールの使用
    new MyConstruct(this, 'MyConstruct', {
      moduleName: 'my-module',
      enabled: true
    });
  }
}
```

### 4.4 テスト実行

#### ユニットテスト

```bash
# 全テスト実行
npm test

# 特定ファイルのテスト
npm test -- my-construct.test.ts

# カバレッジ付きテスト
npm test -- --coverage
```

#### テストの書き方

`tests/unit/my-construct.test.ts`:
```typescript
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MyConstruct } from '../../lib/modules/my-module/constructs/my-construct';

describe('MyConstruct', () => {
  test('リソースが正しく作成される', () => {
    // Arrange
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    
    // Act
    new MyConstruct(stack, 'TestConstruct', {
      moduleName: 'test-module',
      enabled: true
    });
    
    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });
});
```

#### CDK Nag検証

```bash
# セキュリティベストプラクティス検証
npm run cdk:nag

# 特定スタックの検証
cdk synth TokyoRegion-permission-aware-rag-prod-Security
```

---

## 5. デプロイメント

### 5.1 デプロイ戦略

#### 推奨デプロイフロー

```
1. 開発環境 (dev)
   ↓ テスト・検証
2. ステージング環境 (staging)
   ↓ 本番前確認
3. 本番環境 (prod)
```

#### デプロイ前チェックリスト

- [ ] TypeScriptビルド成功 (`npm run build`)
- [ ] ユニットテスト成功 (`npm test`)
- [ ] CDK Nag検証成功
- [ ] 設定ファイル確認
- [ ] バックアップ作成

### 5.2 環境別デプロイ

#### 開発環境

```bash
# 全スタック一括デプロイ
npm run deploy:all:dev

# 個別スタックデプロイ
cdk deploy TokyoRegion-permission-aware-rag-dev-Networking \
  -c environment=dev

# 差分確認
cdk diff --all -c environment=dev
```

#### ステージング環境

```bash
# ステージング環境デプロイ
cdk deploy --all \
  -c environment=staging \
  -c region=ap-northeast-1

# デプロイ後検証
# スタック状態確認スクリプトを実行
```

#### 本番環境

```bash
# 本番環境デプロイ（承認必須）
cdk deploy --all \
  -c environment=prod \
  -c region=ap-northeast-1 \
  --require-approval broadening

# デプロイ監視
watch -n 5 'aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query "Stacks[0].StackStatus"'
```

### 5.3 ロールバック手順

#### 緊急ロールバック

```bash
# 1. 問題のあるスタックを特定
cdk list

# 2. 該当スタックをロールバック
aws cloudformation cancel-update-stack \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp

# 3. 前のバージョンに戻す
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp \
  --previous-parameters
```

#### 完全ロールバック

```bash
# 全スタック削除
cdk destroy --all -c environment=prod

# 前のバージョンから再デプロイ
git checkout <previous-commit>
cdk deploy --all -c environment=prod
```

### 5.4 デプロイ後検証

#### 自動検証スクリプト

```bash
# CloudFormationスタック状態確認
aws cloudformation describe-stacks \
  --query 'Stacks[?contains(StackName, `permission-aware-rag`)].{Name:StackName,Status:StackStatus}' \
  --output table

# 期待される出力:
# ✅ NetworkingStack: UPDATE_COMPLETE
# ✅ SecurityStack: CREATE_COMPLETE
# ✅ DataStack: CREATE_COMPLETE
# ✅ WebAppStack: UPDATE_COMPLETE
```

#### 手動検証項目

```bash
# 1. Lambda関数の動作確認
aws lambda invoke \
  --function-name TokyoRegion-permission-awar-WebAppFunction \
  --payload '{}' \
  response.json

# 2. CloudFrontアクセス確認
curl -I https://d1kbivn5pdlnap.cloudfront.net

# 3. DynamoDBテーブル確認
aws dynamodb describe-table \
  --table-name permission-aware-rag-sessions-prod

# 4. ログ確認
aws logs tail /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --follow
```

---

## 6. 運用・監視

### 6.1 日常運用タスク

#### 毎日のチェック項目

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

#### 週次タスク

- [ ] バックアップ確認
- [ ] セキュリティパッチ適用確認
- [ ] コスト分析
- [ ] パフォーマンスレビュー

#### 月次タスク

- [ ] アクセスログ分析
- [ ] キャパシティプランニング
- [ ] セキュリティ監査
- [ ] ドキュメント更新

### 6.2 監視とアラート

#### CloudWatchダッシュボード

```bash
# ダッシュボード作成
aws cloudwatch put-dashboard \
  --dashboard-name RAG-System-Dashboard \
  --dashboard-body file://monitoring/dashboard.json
```

#### アラーム設定

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

### 6.3 ログ管理

#### ログの確認

```bash
# リアルタイムログ監視
aws logs tail /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --follow \
  --format short

# 特定期間のログ取得
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --start-time $(date -u -d '1 day ago' +%s)000 \
  --end-time $(date -u +%s)000 \
  --output json > logs.json
```

#### ログ分析

```bash
# エラーログの集計
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --filter-pattern "ERROR" \
  --query 'events[*].message' \
  --output text | sort | uniq -c | sort -rn
```

### 6.4 パフォーマンス最適化

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

---


## 7. トラブルシューティング

### 7.1 一般的な問題

<details>
<summary><strong>問題: デプロイが途中で止まる</strong></summary>

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

</details>

<details>
<summary><strong>問題: Lambda関数が502エラーを返す</strong></summary>

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

</details>

<details>
<summary><strong>問題: Lambda関数が `{"Message":null}` エラーを返す</strong></summary>

**症状**:
```json
{"Message":null}
```

**原因**:
- Lambda関数にコンテナイメージが設定されていない
- CDKデプロイ時にECRリポジトリは作成されたが、Lambda関数にイメージURIが設定されなかった

**診断方法**:
```bash
# Lambda関数の状態確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query '{ImageUri:ImageUri,CodeSize:CodeSize,PackageType:PackageType}'
```

**問題の兆候**:
- `ImageUri`: `null` ← コンテナイメージが設定されていない
- `CodeSize`: `0` ← コードがデプロイされていない
- `PackageType`: `Image` ← イメージタイプなのにイメージがない

**解決方法**:

**ステップ1: ECRリポジトリURIの取得**
```bash
ECR_URI=$(aws ecr describe-repositories \
  --repository-names tokyoregion-permission-aware-rag-prod-webapp-repo \
  --region ap-northeast-1 \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "ECR URI: ${ECR_URI}"
```

**ステップ2: Lambda関数のコード更新**
```bash
aws lambda update-function-code \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --image-uri ${ECR_URI}:latest \
  --region ap-northeast-1
```

**ステップ3: 更新完了の確認**
```bash
# 10秒待機
sleep 10

# 更新状態確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus}'
```

**期待される出力**:
```json
{
    "State": "Active",
    "LastUpdateStatus": "Successful"
}
```

**ステップ4: CloudFrontキャッシュのクリア**
```bash
# Distribution IDの取得
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `WebApp`)].Id' \
  --output text)

# キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --region us-east-1
```

**予防策**:

初回デプロイ時は、以下の手順を必ず実行してください：

1. CDKデプロイ実行
2. Dockerイメージのビルド・ECRプッシュ
3. Lambda関数のコード更新（上記コマンド）
4. CloudFrontキャッシュのクリア

詳細は [Lambda関数イメージ修正レポート](../../development/docs/reports/local/webapp-lambda-image-fix-20250124.md) および [デプロイメントガイド](deployment-guide.md#44-コンテナイメージのビルドプッシュ) を参照してください。

</details>

<details>
<summary><strong>問題: TypeScriptコンパイルエラー</strong></summary>

**症状**:
```
error TS2307: Cannot find module 'aws-cdk-lib'
```

**解決方法**:
```bash
# 1. node_modules削除
rm -rf node_modules package-lock.json

# 2. 依存関係再インストール
npm install

# 3. TypeScriptビルド
npm run build

# 4. それでも解決しない場合
npm cache clean --force
npm install
```

</details>

### 7.2 デプロイエラー

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

### 7.3 ランタイムエラー

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

### 7.4 緊急対応手順

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

## 8. セキュリティ

### 8.1 セキュリティベストプラクティス

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

### 8.2 脆弱性対応

#### NPMパッケージ脆弱性スキャン

```bash
# 脆弱性チェック
npm audit

# 自動修正（マイナーバージョン）
npm audit fix

# 強制修正（メジャーバージョン含む）
npm audit fix --force

# 詳細レポート
npm audit --json > audit-report.json
```

#### 緊急パッチ適用手順

```bash
# 1. 脆弱性の特定
npm audit --parseable | grep "high\|critical"

# 2. バックアップ作成
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# 3. パッケージ更新
npm update [package-name]

# 4. テスト実行
npm test

# 5. デプロイ
npm run deploy:all:prod
```

### 8.3 アクセス制御

#### Cognito User Pool設定

```typescript
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'rag-system-users',
  selfSignUpEnabled: false,  // 自己登録無効
  signInAliases: {
    email: true,
    username: true
  },
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true
  },
  mfa: cognito.Mfa.REQUIRED,  // MFA必須
  mfaSecondFactor: {
    sms: true,
    otp: true
  }
});
```

#### WAFルール設定

```typescript
const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
    {
      name: 'RateLimitRule',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: 2000,  // 5分間で2000リクエスト
          aggregateKeyType: 'IP'
        }
      },
      action: { block: {} }
    },
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 2,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet'
        }
      },
      overrideAction: { none: {} }
    }
  ]
});
```

### 8.4 監査とコンプライアンス

#### CloudTrail設定

```typescript
const trail = new cloudtrail.Trail(this, 'AuditTrail', {
  trailName: 'rag-system-audit',
  sendToCloudWatchLogs: true,
  includeGlobalServiceEvents: true,
  isMultiRegionTrail: true,
  managementEvents: cloudtrail.ReadWriteType.ALL,
  insightTypes: [
    cloudtrail.InsightType.API_CALL_RATE
  ]
});
```

#### コンプライアンスチェック

```bash
# AWS Config評価
aws configservice describe-compliance-by-config-rule \
  --compliance-types NON_COMPLIANT

# CDK Nag検証
npm run cdk:nag

# セキュリティハブ確認
aws securityhub get-findings \
  --filters '{"SeverityLabel":[{"Value":"CRITICAL","Comparison":"EQUALS"}]}'
```

---

## 9. リファレンス

### 9.1 コマンドリファレンス

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
| `npm run deploy:all:dev` | 開発環境デプロイ | `npm run deploy:all:dev` |
| `npm run deploy:all:prod` | 本番環境デプロイ | `npm run deploy:all:prod` |

### 9.2 設定ファイル一覧

| ファイル | 説明 | パス |
|---------|------|------|
| cdk.json | CDK設定 | `/cdk.json` |
| tsconfig.json | TypeScript設定 | `/tsconfig.json` |
| package.json | NPM設定 | `/package.json` |
| .gitignore | Git除外設定 | `/.gitignore` |
| tokyo-production-config.ts | 東京本番環境設定 | `/lib/config/environments/` |

### 9.3 環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|-------|------|------------|------|
| `AWS_REGION` | AWSリージョン | `ap-northeast-1` | ✅ |
| `AWS_ACCOUNT_ID` | AWSアカウントID | - | ✅ |
| `PROJECT_NAME` | プロジェクト名 | `permission-aware-rag` | ✅ |
| `ENVIRONMENT` | 環境名 | `prod` | ✅ |
| `BEDROCK_MODEL_ID` | Bedrockモデル | `amazon.nova-pro-v1:0` | ❌ |
| `TABLE_NAME` | DynamoDBテーブル名 | - | ✅ |

### 9.4 APIエンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/auth/signin` | POST | サインイン |
| `/api/auth/signout` | POST | サインアウト |
| `/api/bedrock/chat` | POST | チャット送信 |
| `/api/bedrock/models` | GET | モデル一覧取得 |
| `/api/documents/search` | POST | 文書検索 |

---

## 📞 サポート

### 問い合わせ先

- **GitHub Issues**: [プロジェクトIssues](https://github.com/NetAppJpTechTeam/Permission-aware-RAG-FSx for ONTAP-CDK/issues)
- **ドキュメント**: `/docs/` ディレクトリ

### 貢献方法

プロジェクトへの貢献を歓迎します！

1. Forkを作成
2. Feature branchを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をCommit (`git commit -m 'Add amazing feature'`)
4. Branchにpush (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

---

**最終更新**: 2025年11月16日  
**ドキュメントバージョン**: 1.0.0  
**ライセンス**: プロジェクトライセンスに準拠

