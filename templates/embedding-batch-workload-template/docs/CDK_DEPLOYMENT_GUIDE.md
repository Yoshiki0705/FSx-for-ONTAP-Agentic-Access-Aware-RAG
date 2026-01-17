# 🚀 CDK デプロイメントガイド / CDK Deployment Guide

## 📋 概要 / Overview

このガイドでは、AWS CDK (Cloud Development Kit) を使用してFSx for NetApp ONTAP Embedding Batch Workloadをデプロイする方法を**初心者にもわかりやすく**説明します。

This guide explains how to deploy the FSx for NetApp ONTAP Embedding Batch Workload using AWS CDK (Cloud Development Kit) in a **beginner-friendly** manner.

## 🎯 対象読者 / Target Audience

**このガイドは以下の方を対象としています：**
- **AWS初心者** - AWSを初めて使う方でも大丈夫です
- **IaC初心者** - Infrastructure as Code（コードでインフラを管理）が初めての方
- **CDK初心者** - AWS CDKを初めて使う方
- **開発者** - プログラミング経験があれば十分です

**This guide is designed for:**
- **AWS beginners** - No prior AWS experience required
- **IaC beginners** - New to Infrastructure as Code
- **CDK beginners** - First time using AWS CDK
- **Developers** - Basic programming experience is sufficient

## 🤔 始める前に知っておくべきこと / What You Should Know Before Starting

### AWS CDKとは？ / What is AWS CDK?
AWS CDK（Cloud Development Kit）は、**プログラミング言語を使ってAWSリソースを定義・デプロイできるツール**です。
従来のGUIでの手動設定ではなく、コードで書くことで：
- **再現性**: 同じ環境を何度でも作成可能
- **バージョン管理**: Gitでインフラの変更履歴を管理
- **自動化**: デプロイメントプロセスの自動化

AWS CDK (Cloud Development Kit) is a tool that lets you **define and deploy AWS resources using programming languages**.
Instead of manual GUI configuration, coding provides:
- **Reproducibility**: Create the same environment repeatedly
- **Version control**: Manage infrastructure changes with Git
- **Automation**: Automate deployment processes

### このテンプレートで何ができる？ / What Can This Template Do?
このテンプレートをデプロイすると、以下が自動的に作成されます：
- **AWS Batch**: 大量のデータ処理を並列実行する環境
- **Amazon FSx for NetApp ONTAP**: 高性能ファイルストレージ
- **Amazon Bedrock**: AI/MLモデルでテキスト埋め込み生成
- **Amazon S3バケット**: 処理結果の保存
- **DynamoDB**: メタデータの管理
- **CloudWatch**: 監視とログ管理

When you deploy this template, the following will be automatically created:
- **AWS Batch**: Environment for parallel processing of large datasets
- **Amazon FSx for NetApp ONTAP**: High-performance file storage
- **Amazon Bedrock**: AI/ML models for text embedding generation
- **Amazon S3 Bucket**: Storage for processing results
- **DynamoDB**: Metadata management
- **CloudWatch**: Monitoring and log management

## ⚡ 超簡単！3ステップデプロイメント / Super Easy! 3-Step Deployment

**「とりあえず動かしてみたい」という方向けの最短手順です。**
**For those who want to "just get it working" - the shortest possible procedure.**

### 🚀 3ステップで完了 / Complete in 3 Steps

```bash
# ステップ1: 前提条件を自動チェック（必要なツールがインストールされているか確認）
# Step 1: Automatically check prerequisites (verify required tools are installed)
./scripts/check-prerequisites.sh

# ステップ2: 対話式で設定を作成（質問に答えるだけ）
# Step 2: Create configuration interactively (just answer questions)
./scripts/configure.sh

# ステップ3: 自動デプロイメント実行（コーヒーを飲んで待つだけ）
# Step 3: Run automatic deployment (just wait while having coffee)
./scripts/deploy.sh
```

**これだけで完了！約10-15分でEmbedding Batch環境が使えるようになります。**
**That's it! Your Embedding Batch environment will be ready in about 10-15 minutes.**

### 🤖 何が起こるの？ / What Happens?

各ステップで何が行われるかを説明します：

**ステップ1 (check-prerequisites.sh)**
- Node.js、AWS CLI、CDKがインストールされているかチェック
- AWSの認証情報が設定されているかチェック
- 不足しているものがあれば、インストール方法を教えてくれます

**ステップ2 (configure.sh)**
- 「プロジェクト名は？」「どのリージョンに作る？」などの質問
- 既存のVPCやFSxを使うか、新規作成するかを選択
- 設定ファイルが自動生成されます

**ステップ3 (deploy.sh)**
- CDKが設定に基づいてAWSリソースを自動作成
- 進捗状況がリアルタイムで表示されます
- エラーが発生した場合は、解決方法も表示されます

Each step explained:

**Step 1 (check-prerequisites.sh)**
- Checks if Node.js, AWS CLI, CDK are installed
- Verifies AWS credentials are configured
- Shows installation instructions for missing components

**Step 2 (configure.sh)**
- Asks questions like "Project name?" "Which region?"
- Choose to use existing VPC/FSx or create new ones
- Configuration file is automatically generated

**Step 3 (deploy.sh)**
- CDK automatically creates AWS resources based on configuration
- Real-time progress display
- Shows resolution methods if errors occur

## 📚 詳細デプロイメントガイド（手動設定したい方向け）/ Detailed Deployment Guide (For Manual Configuration)

**「設定を細かく制御したい」「仕組みを理解したい」という方向けの詳細手順です。**
**For those who want "fine-grained control" or "to understand the mechanism" - detailed procedures.**

### ステップ1: 環境準備（パソコンのセットアップ）/ Step 1: Environment Setup (Computer Setup)

#### 🛠️ 必要なツールとインストール方法 / Required Tools and Installation Methods

**初心者の方へ：以下のツールを順番にインストールしてください。**
**For beginners: Please install the following tools in order.**

| ツール / Tool | 何に使う？ / What for? | インストール方法 / Installation |
|---------------|----------------------|--------------------------------|
| **Node.js** | CDKを動かすために必要 / Required to run CDK | [nodejs.org](https://nodejs.org/) からダウンロード |
| **AWS CLI** | AWSと通信するために必要 / Required to communicate with AWS | [AWS CLI インストールガイド](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| **AWS CDK** | インフラをコードで管理 / Manage infrastructure with code | `npm install -g aws-cdk` |
| **Git** | コードのバージョン管理 / Code version control | [git-scm.com](https://git-scm.com/) からダウンロード |

#### 📋 インストール確認方法 / Installation Verification Methods

**以下のコマンドを実行して、正しくインストールされているか確認しましょう：**
**Run the following commands to verify correct installation:**

```bash
# Node.js バージョン確認（v18以上が必要）
# Check Node.js version (v18+ required)
node --version
# 期待する出力例 / Expected output: v20.x.x

# AWS CLI バージョン確認（v2以上が必要）
# Check AWS CLI version (v2+ required)
aws --version
# 期待する出力例 / Expected output: aws-cli/2.x.x

# CDK バージョン確認（v2以上が必要）
# Check CDK version (v2+ required)
cdk --version
# 期待する出力例 / Expected output: 2.x.x

# AWS認証情報確認（AWSアカウントにアクセスできるか）
# Check AWS credentials (can access AWS account)
aws sts get-caller-identity
# 期待する出力例 / Expected output: アカウントID、ユーザー名など
```

#### 🔑 AWS認証情報の設定 / AWS Credentials Setup

**初回のみ必要な設定です：**
**One-time setup required:**

```bash
# AWS認証情報を設定（対話式）
# Configure AWS credentials (interactive)
aws configure

# 以下の情報を入力してください / Please enter the following information:
# AWS Access Key ID: (AWSコンソールで取得)
# AWS Secret Access Key: (AWSコンソールで取得)
# Default region name: ap-northeast-1 (東京リージョン推奨)
# Default output format: json (推奨)
```

**認証情報の取得方法がわからない場合：**
**If you don't know how to get credentials:**
1. [AWSコンソール](https://console.aws.amazon.com/) にログイン
2. 右上のユーザー名をクリック → 「セキュリティ認証情報」
3. 「アクセスキー」セクションで新しいキーを作成

### ステップ2: プロジェクト設定（どんな環境を作るか決める）/ Step 2: Project Configuration (Decide What Environment to Create)

#### 🎯 2.1 簡単設定（推奨）/ Easy Configuration (Recommended)

**対話式スクリプトを使用（初心者におすすめ）：**
**Use interactive script (recommended for beginners):**

```bash
./scripts/configure.sh
```

**このスクリプトが質問してくれる内容：**
**Questions this script will ask:**
- プロジェクト名（例：my-first-embedding-project）
- 環境名（dev/staging/prod）
- AWSリージョン（ap-northeast-1推奨）
- 既存のVPCを使うか、新規作成するか
- 既存のFSxを使うか、新規作成するか
- コンピュート環境の設定（インスタンスサイズなど）

#### 🔧 2.2 手動設定（カスタマイズしたい方向け）/ Manual Configuration (For Customization)

**設定ファイルを直接編集したい場合：**
**If you want to edit the configuration file directly:**

`examples/basic-config.json` をコピーして編集：
Copy and edit `examples/basic-config.json`:

```bash
# 基本設定をコピー
cp examples/basic-config.json config/my-config.json

# お好みのエディタで編集
vim config/my-config.json  # または code, nano など
```

#### 📝 設定ファイルの詳細説明（全パラメーター解説）/ Detailed Configuration File Explanation (All Parameters)

**各パラメーターの意味、選択肢、設定方法を詳しく説明します。**
**Detailed explanation of each parameter's meaning, options, and configuration methods.**

```json
{
  // ===== 基本情報 / Basic Information =====
  "projectName": "my-embedding-project",    // プロジェクト名（英数字とハイフンのみ）
  "environment": "dev",                     // 環境名（選択肢: dev/staging/prod）
  "region": "ap-northeast-1",              // AWSリージョン（推奨: ap-northeast-1）

  // ===== ネットワーク設定 / Network Configuration =====
  "vpc": {
    "create": false,                        // 新規VPC作成するか？（true/false）
    "vpcId": "vpc-xxxxxxxxx",              // 既存VPCのID（既存使用時）
    "privateSubnetIds": [                   // プライベートサブネットのID（2つ以上推奨）
      "subnet-xxxxxxxx", 
      "subnet-yyyyyyyy"
    ],
    "cidr": "10.0.0.0/16",                 // 新規VPC作成時のCIDR範囲
    "availabilityZones": 2,                 // 使用するAZ数（2-3推奨）
    "enableNatGateway": true,              // NATゲートウェイ有効化（インターネットアクセス用）
    "enableVpcEndpoints": false            // VPCエンドポイント（コスト削減のため通常false）
  },

  // ===== FSx for NetApp ONTAP設定 / FSx for NetApp ONTAP Configuration =====
  "fsx": {
    "create": false,                        // 新規FSx作成するか？（true/false）
    "fileSystemId": "fs-xxxxxxxxx",        // 既存FSxのID（既存使用時）
    "svmId": "svm-xxxxxxxxx",              // Storage Virtual MachineのID
    "volumePath": "/rag-data",             // マウントパス（任意の名前）
    
    // 新規FSx作成時の設定
    "storageCapacity": 1024,               // ストレージ容量（GB）最小1024GB
    "throughputCapacity": 128,             // スループット（MBps）最小128MBps
    "deploymentType": "SINGLE_AZ_1",       // デプロイタイプ（選択肢詳細は下記参照）
    "automaticBackupRetentionDays": 7,     // 自動バックアップ保持期間（0-90日）
    "dailyAutomaticBackupStartTime": "03:00", // バックアップ開始時刻（UTC）
    "weeklyMaintenanceStartTime": "7:03:00"   // メンテナンス時刻（UTC）
  },

  // ===== AWS Batch設定 / AWS Batch Configuration =====
  "batch": {
    "computeEnvironmentType": "EC2",        // コンピュート環境タイプ（EC2/FARGATE）
    "instanceTypes": [                      // 使用するインスタンスタイプ（複数指定可能）
      "m5.large",                          // 2vCPU, 8GB RAM - 小規模処理用
      "m5.xlarge",                         // 4vCPU, 16GB RAM - 中規模処理用
      "m5.2xlarge"                         // 8vCPU, 32GB RAM - 大規模処理用
    ],
    "maxvCpus": 100,                       // 最大vCPU数（制限内で設定）
    "desiredvCpus": 0,                     // 初期vCPU数（0=自動スケール）
    "minvCpus": 0,                         // 最小vCPU数（通常0）
    "enableSpotInstances": true,           // Spotインスタンス使用（コスト削減）
    "spotFleetRequestRole": "arn:aws:iam::ACCOUNT:role/aws-ec2-spot-fleet-tagging-role"
  },

  // ===== AI/ML設定 / AI/ML Configuration =====
  "bedrock": {
    "region": "ap-northeast-1",            // Bedrockリージョン（利用可能リージョン限定）
    "embeddingModel": "amazon.titan-embed-text-v2", // 埋め込みモデル（v2が最新推奨）
    "textModel": "amazon.nova-micro-v1:0", // テキスト生成モデル（Amazon Nova推奨）
    "maxTokens": 4096,                     // 最大トークン数
    "temperature": 0.1                     // 生成の創造性（0.0-1.0）
  },

  // ===== OpenSearch Serverless設定 / OpenSearch Serverless Configuration =====
  "opensearch": {
    "create": true,                        // OpenSearch Serverlessを作成するか？
    "collectionName": "embedding-vectors", // コレクション名
    "indexName": "documents",              // インデックス名
    "vectorDimensions": 1536,              // ベクトル次元数（Titan v2: 1536次元）
    "engineType": "vectorsearch",          // エンジンタイプ（vectorsearch/search/timeseries）
    "standbyReplicas": "DISABLED",         // スタンバイレプリカ（ENABLED/DISABLED）
    "encryptionPolicy": {
      "type": "encryption-at-rest",        // 暗号化ポリシー
      "kmsKeyId": "auto"                   // KMSキー（auto=AWS管理キー）
    },
    "networkPolicy": {
      "type": "vpc",                       // ネットワークアクセス（vpc/public）
      "vpcEndpoints": true                 // VPCエンドポイント使用
    },
    "dataAccessPolicy": {
      "rules": [
        {
          "resource": "collection/*",      // アクセス対象リソース
          "permission": ["aoss:*"]         // 権限レベル
        }
      ]
    }
  },

  // ===== S3設定 / S3 Configuration =====
  "s3": {
    "create": true,                        // S3バケット作成するか？
    "bucketName": "my-embedding-bucket",   // バケット名（グローバルで一意）
    "enableVersioning": true,              // バージョニング有効化
    "enableEncryption": true,              // 暗号化有効化
    "lifecycleRules": [
      {
        "id": "DeleteOldVersions",         // ライフサイクルルール
        "status": "Enabled",
        "noncurrentVersionExpiration": 30   // 古いバージョン削除（日）
      }
    ],
    "publicReadAccess": false,             // パブリック読み取りアクセス（通常false）
    "blockPublicAccess": true              // パブリックアクセスブロック（セキュリティ）
  },

  // ===== DynamoDB設定 / DynamoDB Configuration =====
  "dynamodb": {
    "create": true,                        // DynamoDBテーブル作成するか？
    "tableName": "embedding-metadata",     // テーブル名
    "partitionKey": "documentId",          // パーティションキー
    "sortKey": "chunkId",                  // ソートキー（オプション）
    "billingMode": "PAY_PER_REQUEST",      // 課金モード（PAY_PER_REQUEST/PROVISIONED）
    "pointInTimeRecovery": true,           // ポイントインタイムリカバリ
    "encryption": {
      "type": "AWS_MANAGED",               // 暗号化タイプ（AWS_MANAGED/CUSTOMER_MANAGED）
      "kmsKeyId": "alias/aws/dynamodb"     // KMSキー
    },
    "globalSecondaryIndexes": [            // グローバルセカンダリインデックス
      {
        "indexName": "status-index",
        "partitionKey": "status",
        "projectionType": "ALL"
      }
    ]
  },

  // ===== 監視・ログ設定 / Monitoring & Logging Configuration =====
  "monitoring": {
    "enableCloudWatch": true,              // CloudWatch監視を有効化
    "logRetentionDays": 30,                // ログ保持期間（1-3653日）
    "enableXRay": false,                   // X-Ray分散トレーシング（オプション）
    "enableDetailedMonitoring": true,      // 詳細監視（1分間隔メトリクス）
    "createDashboard": true,               // CloudWatchダッシュボード作成
    "alerting": {
      "enableAlerts": true,                // アラート有効化
      "emailEndpoints": [                  // 通知先メールアドレス
        "admin@example.com",
        "ops-team@example.com"
      ],
      "snsTopicArn": "",                   // 既存SNSトピック（オプション）
      "slackWebhookUrl": "",               // Slack通知（オプション）
      "pagerDutyIntegrationKey": ""        // PagerDuty統合（オプション）
    },
    "customMetrics": {
      "enableCustomMetrics": true,         // カスタムメトリクス有効化
      "namespace": "EmbeddingBatch",       // メトリクス名前空間
      "dimensions": ["Environment", "JobQueue"] // メトリクス次元
    }
  },

  // ===== セキュリティ設定 / Security Configuration =====
  "security": {
    "enableEncryption": true,              // 全体的な暗号化有効化
    "kmsKeyId": "",                        // カスタムKMSキー（空=AWS管理キー）
    "enableVpcEndpoints": false,           // VPCエンドポイント（コスト vs セキュリティ）
    "restrictPublicAccess": true,          // パブリックアクセス制限
    "enableCloudTrail": false,             // CloudTrail監査ログ（オプション）
    "iamRolePermissions": "MINIMAL",       // IAM権限レベル（MINIMAL/STANDARD/FULL）
    "securityGroups": {
      "restrictInbound": true,             // インバウンド制限
      "allowedCidrBlocks": ["10.0.0.0/8"], // 許可するCIDRブロック
      "enableHttpsOnly": true              // HTTPS通信のみ許可
    }
  },

  // ===== タグ設定 / Tagging Configuration =====
  "tags": {
    "Project": "my-embedding-project",     // プロジェクト名
    "Environment": "dev",                  // 環境
    "Owner": "development-team",           // 所有者
    "CostCenter": "engineering",           // コストセンター
    "Purpose": "document-embedding",       // 用途
    "DataClassification": "internal",      // データ分類
    "BackupRequired": "true",              // バックアップ要否
    "MonitoringLevel": "standard"          // 監視レベル
  }
}
```

## 🎛️ パラメーター選択肢詳細ガイド / Detailed Parameter Options Guide

**各パラメーターの選択肢と切り替え方法を詳しく説明します。**
**Detailed explanation of parameter options and how to switch between them.**

### 🏗️ FSx for NetApp ONTAP デプロイタイプ / FSx for NetApp ONTAP Deployment Types

#### 📊 デプロイタイプの選択肢と特徴 / Deployment Type Options and Characteristics

| デプロイタイプ | 説明 | 可用性 | パフォーマンス | コスト | 推奨用途 |
|---------------|------|--------|---------------|--------|----------|
| **SINGLE_AZ_1** | シングルAZ Gen1 | 単一AZ | 標準 | 最安 | 開発・テスト |
| **SINGLE_AZ_2** | シングルAZ Gen2 | 単一AZ | 高性能 | 中程度 | 本番（単一AZ） |
| **MULTI_AZ_1** | マルチAZ Gen1 | 複数AZ | 高可用性 | 高 | 本番（高可用性） |
| **MULTI_AZ_2** | マルチAZ Gen2 | 複数AZ | 最高性能 | 最高 | エンタープライズ |

#### 🔄 デプロイタイプの切り替え方法 / How to Switch Deployment Types

```json
{
  "fsx": {
    "deploymentType": "SINGLE_AZ_1",       // 👈 ここを変更
    
    // SINGLE_AZ_1の場合（開発・テスト用）
    "storageCapacity": 1024,               // 最小1024GB
    "throughputCapacity": 128,             // 最小128MBps
    
    // SINGLE_AZ_2の場合（本番用・高性能）
    // "storageCapacity": 2048,            // 推奨2048GB以上
    // "throughputCapacity": 256,          // 推奨256MBps以上
    
    // MULTI_AZ_1の場合（高可用性）
    // "storageCapacity": 3072,            // 最小3072GB
    // "throughputCapacity": 512,          // 最小512MBps
    // "preferredSubnetId": "subnet-xxx",  // プライマリサブネット
    // "routeTableIds": ["rtb-xxx"]        // ルートテーブル
  }
}
```

#### 💰 コスト比較例（月額概算・東京リージョン）/ Cost Comparison (Monthly Estimate, Tokyo Region)

```bash
# SINGLE_AZ_1 (1024GB, 128MBps)
# ストレージ: $0.13/GB/月 × 1024GB = $133/月
# スループット: $2.20/MBps/月 × 128MBps = $282/月
# 合計: 約$415/月

# MULTI_AZ_1 (3072GB, 512MBps) 
# ストレージ: $0.13/GB/月 × 3072GB = $399/月
# スループット: $2.20/MBps/月 × 512MBps = $1,126/月
# 合計: 約$1,525/月
```

### 🤖 Bedrock埋め込みモデルの選択 / Bedrock Embedding Model Selection

#### 📋 利用可能な埋め込みモデル / Available Embedding Models

| モデル名 | 次元数 | 最大入力 | 特徴 | 推奨用途 | 料金 |
|----------|--------|----------|------|----------|------|
| **amazon.titan-embed-text-v2** | 1536 | 8192トークン | 最新・高精度 | **推奨** | $0.0001/1Kトークン |
| amazon.titan-embed-text-v1 | 1536 | 8192トークン | 安定版 | 既存システム | $0.0001/1Kトークン |
| cohere.embed-english-v3 | 1024 | 512トークン | 英語特化 | 英語文書のみ | $0.0001/1Kトークン |
| cohere.embed-multilingual-v3 | 1024 | 512トークン | 多言語対応 | 国際展開 | $0.0001/1Kトークン |

#### 📝 利用可能なテキスト生成モデル / Available Text Generation Models

| モデル名 | 最大入力 | 特徴 | 推奨用途 | 料金 | 東京リージョン対応 |
|----------|----------|------|----------|------|------------------|
| **amazon.nova-micro-v1:0** | 128K | 軽量・高速 | **推奨** | $0.00035/1Kトークン | ✅ |
| amazon.nova-lite-v1:0 | 300K | バランス型 | 汎用用途 | $0.0006/1Kトークン | ✅ |
| amazon.nova-pro-v1:0 | 300K | 高性能 | 複雑なタスク | $0.008/1Kトークン | ✅ |
| amazon.nova-lite-v1:0 | 200K | 高速・軽量 | 簡単なタスク | $0.00025/1Kトークン | ✅ |
| amazon.nova-pro-v1:0 | 200K | バランス型 | 汎用用途 | $0.003/1Kトークン | ✅ |

#### 🔄 埋め込みモデルの切り替え方法 / How to Switch Embedding Models

```json
{
  "bedrock": {
    "embeddingModel": "amazon.titan-embed-text-v2", // 👈 推奨：最新のv2
    
    // OpenSearchの設定も合わせて変更が必要
    "opensearch": {
      "vectorDimensions": 1536,            // Titan v2の場合：1536次元
      // "vectorDimensions": 1024,         // Cohereの場合：1024次元
    }
  }
}
```

#### ⚠️ モデル変更時の注意点 / Important Notes When Changing Models

1. **次元数の一致**: OpenSearchの`vectorDimensions`も同時に変更
2. **既存データ**: 異なるモデルで生成された埋め込みは互換性なし
3. **リージョン制限**: 一部モデルは特定リージョンでのみ利用可能

### 🔍 OpenSearch Serverless設定詳細 / OpenSearch Serverless Configuration Details

#### 🏗️ エンジンタイプの選択 / Engine Type Selection

```json
{
  "opensearch": {
    "engineType": "vectorsearch",          // 👈 埋め込み検索用（推奨）
    // "engineType": "search",             // 全文検索用
    // "engineType": "timeseries",         // 時系列データ用
    
    "standbyReplicas": "DISABLED",         // 👈 コスト削減（開発時）
    // "standbyReplicas": "ENABLED",       // 高可用性（本番時）
    
    "encryptionPolicy": {
      "type": "encryption-at-rest",
      "kmsKeyId": "auto"                   // AWS管理キー（推奨）
      // "kmsKeyId": "arn:aws:kms:..."     // カスタムキー
    }
  }
}
```

#### 🔐 アクセスポリシーの設定 / Access Policy Configuration

```json
{
  "opensearch": {
    "dataAccessPolicy": {
      "rules": [
        {
          "resource": "collection/embedding-vectors", // コレクション名
          "permission": [
            "aoss:CreateIndex",            // インデックス作成
            "aoss:WriteDocument",          // 文書書き込み
            "aoss:ReadDocument",           // 文書読み取り
            "aoss:UpdateIndex",            // インデックス更新
            "aoss:DescribeIndex"           // インデックス情報取得
          ]
        },
        {
          "resource": "index/embedding-vectors/*", // インデックス
          "permission": ["aoss:*"]         // 全権限
        }
      ]
    },
    "networkPolicy": {
      "type": "vpc",                       // VPCアクセス（セキュア）
      // "type": "public",                 // パブリックアクセス
      "vpcEndpoints": true,                // VPCエンドポイント使用
      "allowedVpcs": ["vpc-xxxxxxxxx"]     // 許可するVPC
    }
  }
}
```

### ⚡ AWS Batchインスタンスタイプの選択 / AWS Batch Instance Type Selection

#### 📊 推奨インスタンスタイプ / Recommended Instance Types

| インスタンス | vCPU | メモリ | ネットワーク | 用途 | 時間単価（概算） |
|-------------|------|--------|-------------|------|----------------|
| **m5.large** | 2 | 8GB | 最大10Gbps | 小規模処理 | $0.096/時間 |
| **m5.xlarge** | 4 | 16GB | 最大10Gbps | 中規模処理 | $0.192/時間 |
| **m5.2xlarge** | 8 | 32GB | 最大10Gbps | 大規模処理 | $0.384/時間 |
| **c5.xlarge** | 4 | 8GB | 最大10Gbps | CPU集約的 | $0.17/時間 |
| **r5.xlarge** | 4 | 32GB | 最大10Gbps | メモリ集約的 | $0.252/時間 |

#### 🔄 インスタンスタイプの組み合わせ例 / Instance Type Combination Examples

```json
{
  "batch": {
    // 👇 バランス型（推奨）
    "instanceTypes": ["m5.large", "m5.xlarge", "m5.2xlarge"],
    
    // 👇 CPU集約型（テキスト処理重視）
    // "instanceTypes": ["c5.large", "c5.xlarge", "c5.2xlarge"],
    
    // 👇 メモリ集約型（大きなモデル使用時）
    // "instanceTypes": ["r5.large", "r5.xlarge", "r5.2xlarge"],
    
    // 👇 コスト重視（Spotインスタンス）
    "enableSpotInstances": true,           // 最大90%コスト削減
    "spotFleetRequestRole": "arn:aws:iam::ACCOUNT:role/aws-ec2-spot-fleet-tagging-role"
  }
}
```

### 🌍 リージョン別の考慮事項 / Regional Considerations

#### 📍 Bedrockモデル利用可能リージョン / Bedrock Model Available Regions

```json
{
  // 東京リージョン（推奨）
  "region": "ap-northeast-1",
  "bedrock": {
    "region": "ap-northeast-1",            // ✅ Titan v2利用可能
    "embeddingModel": "amazon.titan-embed-text-v2"
  },
  
  // バージニア北部（参考）
  // "region": "us-east-1",
  // "bedrock": {
  //   "region": "us-east-1",              // 参考：多くのモデル利用可能
  //   "embeddingModel": "amazon.titan-embed-text-v2",
  //   "textModel": "amazon.nova-pro-v1:0" // より高性能なNovaモデル
  // }
}
```

#### 💡 設定のベストプラクティス / Configuration Best Practices

**初心者向け推奨設定：**
**Recommended settings for beginners:**

```json
{
  "projectName": "my-first-embedding",     // シンプルな名前
  "environment": "dev",                    // 開発環境から開始
  "region": "ap-northeast-1",             // 東京リージョン
  
  "fsx": {
    "deploymentType": "SINGLE_AZ_1",       // 最小コスト
    "storageCapacity": 1024,               // 最小容量
    "throughputCapacity": 128              // 最小スループット
  },
  
  "bedrock": {
    "embeddingModel": "amazon.titan-embed-text-v2" // 最新モデル
  },
  
  "batch": {
    "instanceTypes": ["m5.large"],         // 小さく開始
    "maxvCpus": 32,                        // 制限内で設定
    "enableSpotInstances": true            // コスト削減
  },
  
  "opensearch": {
    "standbyReplicas": "DISABLED",         // コスト削減
    "vectorDimensions": 1536               // Titan v2対応
  }
}
```

**本番環境向け推奨設定：**
**Recommended settings for production:**

```json
{
  "environment": "prod",
  
  "fsx": {
    "deploymentType": "MULTI_AZ_1",        // 高可用性
    "storageCapacity": 3072,               // 十分な容量
    "throughputCapacity": 512,             // 高スループット
    "automaticBackupRetentionDays": 30     // 長期バックアップ
  },
  
  "batch": {
    "instanceTypes": ["m5.xlarge", "m5.2xlarge"], // 高性能
    "maxvCpus": 500,                       // スケーラビリティ
    "enableSpotInstances": false           // 安定性重視
  },
  
  "opensearch": {
    "standbyReplicas": "ENABLED",          // 高可用性
    "encryptionPolicy": {
      "kmsKeyId": "arn:aws:kms:..."        // カスタム暗号化
    }
  },
  
  "monitoring": {
    "enableDetailedMonitoring": true,      // 詳細監視
    "logRetentionDays": 90,                // 長期ログ保持
    "enableAlerts": true                   // アラート有効
  }
}
```

### ステップ3: CDK デプロイメント（実際にAWSに作成）/ Step 3: CDK Deployment (Actually Create on AWS)

**ここからが本番！AWSにリソースを作成していきます。**
**Here's the main event! We'll create resources on AWS.**

#### 🔧 3.1 プロジェクトの準備 / Project Preparation

```bash
# CDKディレクトリに移動
# Move to CDK directory
cd cdk

# 必要なライブラリをインストール（初回のみ）
# Install required libraries (first time only)
npm install

# 何がインストールされるの？ / What gets installed?
# - AWS CDK ライブラリ
# - TypeScript コンパイラ
# - その他の依存関係
```

#### 🏗️ 3.2 コードのビルド / Code Build

```bash
# TypeScriptコードをJavaScriptに変換
# Convert TypeScript code to JavaScript
npm run build

# エラーが出た場合 / If errors occur:
# - 設定ファイルの構文をチェック
# - npm install を再実行
```

#### 🚀 3.3 CDK ブートストラップ（初回セットアップ）/ CDK Bootstrap (Initial Setup)

**CDKを初めて使う場合のみ実行：**
**Run only when using CDK for the first time:**

```bash
# 自動でアカウント・リージョンを検出してブートストラップ
# Automatically detect account/region and bootstrap
npx cdk bootstrap

# 手動でアカウント・リージョンを指定する場合
# To manually specify account/region
# npx cdk bootstrap aws://123456789012/ap-northeast-1
```

**ブートストラップって何？ / What is Bootstrap?**
- CDKがAWSリソースを管理するための「準備作業」
- S3バケットやIAMロールなどの基盤を作成
- 各リージョンで1回だけ実行すればOK

**What Bootstrap does:**
- "Preparation work" for CDK to manage AWS resources
- Creates foundation like S3 buckets and IAM roles
- Only needs to be run once per region

#### 🔍 3.4 デプロイ前の確認 / Pre-deployment Verification

```bash
# 何が作成されるかプレビュー（実際には作成されない）
# Preview what will be created (nothing actually created)
npx cdk synth

# 設定の差分確認（既存環境がある場合）
# Check configuration differences (if existing environment)
npx cdk diff
```

**このステップで確認できること：**
**What you can verify in this step:**
- 作成されるAWSリソースの一覧
- 設定値が正しいかどうか
- 予想されるコスト（概算）

#### 🚀 3.5 実際のデプロイメント実行 / Execute Actual Deployment

```bash
# 自動承認でデプロイ（推奨）
# Deploy with automatic approval (recommended)
npx cdk deploy --require-approval never

# 手動承認でデプロイ（慎重派向け）
# Deploy with manual approval (for cautious users)
# npx cdk deploy
```

**デプロイ中に表示される情報：**
**Information displayed during deployment:**
- 進捗状況（何%完了か）
- 作成中のリソース名
- 完了したリソース
- エラーが発生した場合の詳細

**デプロイ時間の目安：**
**Estimated deployment time:**
- 新規VPC作成: 約5-10分
- 既存VPC使用: 約3-5分
- FSx作成含む: 約15-20分

#### ⏱️ デプロイ中にできること / What You Can Do During Deployment

```bash
# 別のターミナルでデプロイ状況を監視
# Monitor deployment status in another terminal
watch -n 30 'aws cloudformation describe-stacks --stack-name YourStackName'

# CloudFormationコンソールで進捗確認
# Check progress in CloudFormation console
echo "https://console.aws.amazon.com/cloudformation/"
```

### ステップ4: デプロイメント検証（正しく動くかテスト）/ Step 4: Deployment Validation (Test if Working Correctly)

**デプロイが完了したら、正しく動作するかテストしましょう！**
**Once deployment is complete, let's test if it works correctly!**

#### ✅ 4.1 自動検証スクリプト / Automatic Validation Script

```bash
# 全自動でテスト実行
# Run fully automated tests
./scripts/validate.sh

# このスクリプトが確認すること / What this script checks:
# ✓ AWS Batchが正常に作成されているか
# ✓ FSxファイルシステムにアクセスできるか
# ✓ S3バケットが作成されているか
# ✓ DynamoDBテーブルが作成されているか
# ✓ IAMロールが正しく設定されているか
```

#### 🔍 4.2 手動確認方法 / Manual Verification Methods

**AWSコンソールで確認したい場合：**
**If you want to check via AWS Console:**

```bash
# 作成されたリソースの一覧を表示
# Display list of created resources
aws cloudformation describe-stack-resources --stack-name YourStackName

# AWS Batch環境の確認
# Check AWS Batch environment
aws batch describe-compute-environments

# FSxファイルシステムの確認
# Check FSx file system
aws fsx describe-file-systems
```

#### 🧪 4.3 テストジョブの実行 / Test Job Execution

```bash
# サンプルの埋め込み生成ジョブを実行
# Run sample embedding generation job
./scripts/run-test-job.sh

# ジョブの実行状況を確認
# Check job execution status
aws batch list-jobs --job-queue YourJobQueueName
```

#### 📊 4.4 結果の確認 / Result Verification

**成功した場合の確認方法：**
**How to verify success:**

```bash
# S3バケットに結果が保存されているか確認
# Check if results are saved in S3 bucket
aws s3 ls s3://your-embedding-bucket/embeddings/

# DynamoDBにメタデータが保存されているか確認
# Check if metadata is saved in DynamoDB
aws dynamodb scan --table-name YourEmbeddingTable --max-items 5

# CloudWatchでログを確認
# Check logs in CloudWatch
aws logs describe-log-groups --log-group-name-prefix /aws/batch/job
```

## 🔧 設定オプション詳細（カスタマイズしたい方向け）/ Detailed Configuration Options (For Customization)

### 🌐 VPC設定（ネットワーク環境の選択）/ VPC Configuration (Network Environment Selection)

**VPCとは？**
VPC（Virtual Private Cloud）は、AWS上の「あなた専用のネットワーク空間」です。
インターネットから隔離された安全な環境でリソースを動かせます。

**What is VPC?**
VPC (Virtual Private Cloud) is "your dedicated network space" on AWS.
You can run resources in a secure environment isolated from the internet.

#### 🏠 既存VPCを使用する場合 / Using Existing VPC

**すでにVPCがある場合（推奨）：**
**If you already have a VPC (recommended):**

```json
{
  "vpc": {
    "create": false,                    // 新規作成しない
    "vpcId": "vpc-xxxxxxxxx",          // 既存VPCのID
    "privateSubnetIds": [               // プライベートサブネットのID
      "subnet-xxxxxxxx",               // アベイラビリティゾーン1
      "subnet-yyyyyyyy"                // アベイラビリティゾーン2
    ]
  }
}
```

**VPC IDの確認方法：**
**How to find VPC ID:**
```bash
# 利用可能なVPCを一覧表示
aws ec2 describe-vpcs --query 'Vpcs[].{VpcId:VpcId,Name:Tags[?Key==`Name`].Value|[0],CIDR:CidrBlock}'
```

#### 🆕 新規VPCを作成する場合 / Creating New VPC

**VPCがない場合や、専用環境を作りたい場合：**
**If you don't have a VPC or want a dedicated environment:**

```json
{
  "vpc": {
    "create": true,                     // 新規作成する
    "cidr": "10.0.0.0/16",             // IPアドレス範囲
    "availabilityZones": 2,             // 可用性ゾーン数
    "enableNatGateway": true,           // NATゲートウェイ有効化
    "enableVpcEndpoints": false         // VPCエンドポイント（コスト削減のため無効）
  }
}
```

**CIDR設定のコツ：**
**CIDR Configuration Tips:**
- `10.0.0.0/16`: 約65,000個のIPアドレス（大規模）
- `10.0.0.0/20`: 約4,000個のIPアドレス（中規模）
- `10.0.0.0/24`: 約250個のIPアドレス（小規模）

### FSx for ONTAP 設定 / FSx for ONTAP Configuration

#### 既存FSx for ONTAP使用 / Using Existing FSx for ONTAP

```json
{
  "fsx": {
    "hasExisting": true,
    "fileSystemId": "fs-xxxxxxxxx",
    "svmId": "svm-xxxxxxxxx",
    "volumePath": "/rag-data",
    "createNew": false
  }
}
```

#### 新規FSx for ONTAP作成 / Creating New FSx for ONTAP

```json
{
  "fsx": {
    "hasExisting": false,
    "createNew": true,
    "storageCapacity": 1024,
    "throughputCapacity": 128,
    "deploymentType": "MULTI_AZ_1",
    "volumePath": "/rag-data"
  }
}
```

### AWS Batch 設定 / AWS Batch Configuration

#### EC2 コンピュート環境 / EC2 Compute Environment

```json
{
  "batch": {
    "computeEnvironmentType": "EC2",
    "instanceTypes": ["m5.large", "m5.xlarge", "m5.2xlarge"],
    "maxvCpus": 500,
    "desiredvCpus": 0,
    "minvCpus": 0,
    "spotFleetRequestRole": "arn:aws:iam::ACCOUNT:role/aws-ec2-spot-fleet-tagging-role"
  }
}
```

#### Fargate コンピュート環境 / Fargate Compute Environment

```json
{
  "batch": {
    "computeEnvironmentType": "FARGATE",
    "maxvCpus": 100,
    "desiredvCpus": 0
  }
}
```

## 🎛️ 高度な設定 / Advanced Configuration

### 環境別設定 / Environment-specific Configuration

#### 開発環境 / Development Environment

```json
{
  "environment": "dev",
  "batch": {
    "maxvCpus": 50,
    "instanceTypes": ["m5.large"]
  },
  "monitoring": {
    "createDashboard": false,
    "enableDetailedMonitoring": false
  }
}
```

#### 本番環境 / Production Environment

```json
{
  "environment": "prod",
  "batch": {
    "maxvCpus": 1000,
    "instanceTypes": ["m5.xlarge", "m5.2xlarge", "m5.4xlarge"],
    "enableSpotInstances": true
  },
  "monitoring": {
    "createDashboard": true,
    "enableDetailedMonitoring": true,
    "alerting": {
      "snsTopicArn": "arn:aws:sns:region:account:alerts"
    }
  }
}
```

### マルチリージョンデプロイメント / Multi-region Deployment

```json
{
  "multiRegion": {
    "enabled": true,
    "regions": [
      {
        "region": "ap-northeast-1",
        "isPrimary": true
      },
      {
        "region": "us-east-1",
        "isPrimary": false
      }
    ]
  }
}
```

## 🆘 トラブルシューティング（困った時の解決方法）/ Troubleshooting (Solutions When You're Stuck)

**「エラーが出て困った！」という時の解決方法を、初心者にもわかりやすく説明します。**
**Solutions for "I got an error and I'm stuck!" explained in a beginner-friendly way.**

### 🚨 よくある問題と解決方法 / Common Issues and Solutions

#### 1. 🔧 CDK ブートストラップエラー / CDK Bootstrap Error

**❌ こんなエラーが出た場合：**
**❌ If you see this error:**
```
This stack uses assets, so the toolkit stack must be deployed to the environment
```

**💡 何が起こっているの？**
CDKを初めて使う時に必要な「準備作業」がまだ完了していません。

**✅ 解決方法：**
```bash
# 自動でブートストラップを実行
npx cdk bootstrap

# 手動でアカウント・リージョンを指定する場合
# npx cdk bootstrap aws://123456789012/ap-northeast-1
```

**🔍 確認方法：**
```bash
# ブートストラップが完了しているか確認
aws cloudformation describe-stacks --stack-name CDKToolkit
```

#### 2. 🔐 IAM権限エラー / IAM Permission Error

**❌ こんなエラーが出た場合：**
**❌ If you see this error:**
```
User is not authorized to perform: iam:CreateRole
AccessDenied: User: arn:aws:iam::123456789012:user/myuser is not authorized
```

**💡 何が起こっているの？**
あなたのAWSユーザーに、必要なリソースを作成する権限がありません。

**✅ 解決方法：**
1. **管理者に相談**：「CDKでEmbedding Batchをデプロイしたいので、必要な権限をください」
2. **必要な権限一覧**を管理者に伝える：

```json
{
  "必要な権限": [
    "iam:CreateRole",
    "iam:AttachRolePolicy", 
    "iam:PassRole",
    "ec2:CreateVpc",
    "ec2:CreateSubnet",
    "ec2:CreateSecurityGroup",
    "fsx:CreateFileSystem",
    "batch:CreateComputeEnvironment",
    "batch:CreateJobQueue",
    "batch:RegisterJobDefinition",
    "s3:CreateBucket",
    "dynamodb:CreateTable",
    "logs:CreateLogGroup"
  ]
}
```

**🎯 管理者向けの簡単な解決方法：**
```bash
# PowerUserAccess ポリシーをアタッチ（推奨）
aws iam attach-user-policy --user-name USERNAME --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

#### 3. 📊 リソース制限エラー / Resource Limit Error

**❌ こんなエラーが出た場合：**
**❌ If you see this error:**
```
Limit Exceeded: Cannot exceed quota for vCpus: Request would exceed quota
```

**💡 何が起こっているの？**
AWSアカウントの利用制限に引っかかっています。新しいアカウントでは制限が厳しく設定されています。

**✅ 解決方法：**

**ステップ1: 現在の制限を確認**
```bash
# EC2の制限確認
aws service-quotas get-service-quota --service-code ec2 --quota-code L-34B43A08

# 結果例：現在の制限が32 vCPUの場合
# "Value": 32.0
```

**ステップ2: 制限緩和を申請**
```bash
# 制限を1000 vCPUに増加申請
aws service-quotas request-service-quota-increase \
  --service-code ec2 \
  --quota-code L-34B43A08 \
  --desired-value 1000
```

**ステップ3: 一時的な回避策**
設定ファイルで `maxvCpus` を小さくする：
```json
{
  "batch": {
    "maxvCpus": 16,  // 制限内の値に変更
    "desiredvCpus": 0
  }
}
```

#### 4. 🗂️ FSxマウントエラー / FSx Mount Error

**❌ こんなエラーが出た場合：**
**❌ If you see this error:**
```
mount.nfs: Connection timed out
mount.nfs: access denied by server while mounting
```

**💡 何が起こっているの？**
ネットワーク設定の問題で、BatchからFSxにアクセスできません。

**✅ 解決方法：**

**ステップ1: セキュリティグループの確認**
```bash
# FSxのセキュリティグループを確認
aws fsx describe-file-systems --query 'FileSystems[0].NetworkInterfaceIds'

# セキュリティグループにNFSポートが開いているか確認
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
```

**ステップ2: 必要なポートを開放**
```bash
# NFSポート（2049）を開放
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 2049 \
  --source-group sg-yyyyyyyy
```

#### 5. 💰 予想外の課金エラー / Unexpected Billing Error

**❌ こんな心配がある場合：**
**❌ If you have this concern:**
```
「デプロイしたら高額請求が来るのでは？」
"Will I get a huge bill after deployment?"
```

**💡 安心してください！**
このテンプレートは**コスト最適化**されています：

**✅ コスト削減機能：**
- **自動スケーリング**: 使わない時はリソースが0になる
- **Spotインスタンス**: 最大90%のコスト削減
- **適切なサイジング**: 過剰なリソースは使わない

**📊 予想コスト（月額）：**
- **開発環境**: 約$10-50/月
- **本番環境**: 約$100-500/月（使用量による）

**🛡️ 課金アラートの設定：**
```bash
# 月額$100を超えたらアラート
aws budgets create-budget --account-id 123456789012 --budget '{
  "BudgetName": "EmbeddingBatchBudget",
  "BudgetLimit": {"Amount": "100", "Unit": "USD"},
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}'
```

### 🔧 デバッグのコツ / Debugging Tips

#### ログの確認方法 / How to Check Logs

```bash
# CloudFormationのログ確認
aws cloudformation describe-stack-events --stack-name YourStackName

# AWS Batchのログ確認
aws logs describe-log-groups --log-group-name-prefix /aws/batch/job

# 詳細なCDKログ出力
npx cdk deploy --verbose --debug
```

#### 🆘 それでも解決しない場合 / If Still Not Resolved

1. **GitHub Issues**: [プロジェクトのIssues](https://github.com/your-repo/issues)で質問
2. **AWS サポート**: 有料プランの場合はAWSサポートに問い合わせ
3. **コミュニティ**: AWS re:Post や Stack Overflow で質問
4. **ドキュメント**: [AWS公式ドキュメント](https://docs.aws.amazon.com/)を確認

**質問する時のコツ：**
- エラーメッセージを**そのまま**コピー&ペースト
- 実行したコマンドを記載
- 設定ファイルの内容を共有（機密情報は除く）

### ログ確認方法 / Log Checking Methods

#### CloudFormation ログ / CloudFormation Logs

```bash
# スタックイベント確認
aws cloudformation describe-stack-events --stack-name STACK_NAME

# スタック状態確認
aws cloudformation describe-stacks --stack-name STACK_NAME
```

#### AWS Batch ログ / AWS Batch Logs

```bash
# ジョブログ確認
aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name JOB_ID
```

#### CDK ログ / CDK Logs

```bash
# 詳細ログ出力
npx cdk deploy --verbose

# デバッグモード
npx cdk deploy --debug
```

## 📊 監視とメンテナンス / Monitoring and Maintenance

### CloudWatch ダッシュボード / CloudWatch Dashboard

デプロイメント後、以下のメトリクスを監視できます：
After deployment, you can monitor the following metrics:

- Batch ジョブ実行状況 / Batch job execution status
- FSx パフォーマンス / FSx performance
- S3 ストレージ使用量 / S3 storage usage
- DynamoDB 読み書き容量 / DynamoDB read/write capacity

### コスト最適化 / Cost Optimization

#### Spot インスタンス使用 / Using Spot Instances

```json
{
  "batch": {
    "enableSpotInstances": true,
    "spotFleetRequestRole": "arn:aws:iam::ACCOUNT:role/aws-ec2-spot-fleet-tagging-role",
    "bidPercentage": 50
  }
}
```

#### 自動スケーリング設定 / Auto Scaling Configuration

```json
{
  "batch": {
    "desiredvCpus": 0,
    "minvCpus": 0,
    "maxvCpus": 100
  }
}
```

## 🔄 アップデートとロールバック / Updates and Rollback

### アップデート手順 / Update Procedure

```bash
# 1. 設定変更
vim config/deployment-config.json

# 2. 変更差分確認
npx cdk diff

# 3. アップデート実行
npx cdk deploy
```

### ロールバック手順 / Rollback Procedure

```bash
# 1. 前のバージョンに戻す
git checkout PREVIOUS_COMMIT

# 2. ロールバック実行
npx cdk deploy

# または完全削除
npx cdk destroy
```

## 🎉 デプロイ完了！次に何をする？ / Deployment Complete! What's Next?

**おめでとうございます！Embedding Batch環境のデプロイが完了しました。**
**Congratulations! Your Embedding Batch environment deployment is complete.**

### 🚀 すぐに試せること / What You Can Try Right Away

#### 1. 📄 サンプル文書でテスト / Test with Sample Documents

```bash
# サンプル文書をアップロード
# Upload sample documents
aws s3 cp examples/sample-documents/ s3://your-bucket/documents/ --recursive

# テストジョブを実行
# Run test job
./scripts/run-test-job.sh
```

#### 2. 🔍 結果の確認 / Check Results

```bash
# 生成された埋め込みを確認
# Check generated embeddings
aws s3 ls s3://your-bucket/embeddings/

# メタデータを確認
# Check metadata
aws dynamodb scan --table-name YourEmbeddingTable --max-items 5
```

#### 3. 🤖 RAGクエリのテスト / Test RAG Queries

```bash
# 質問応答のテスト
# Test question-answering
./scripts/test-rag-query.sh "What is the main topic of the documents?"
```

### 📈 本格運用に向けて / For Production Use

#### 🔒 セキュリティの強化 / Security Enhancement

```json
{
  "security": {
    "enableEncryption": true,           // 暗号化有効化
    "enableVpcEndpoints": true,         // VPCエンドポイント使用
    "restrictPublicAccess": true,       // パブリックアクセス制限
    "enableCloudTrail": true           // 操作ログ記録
  }
}
```

#### 📊 監視・アラートの設定 / Monitoring & Alerts Setup

```bash
# CloudWatchダッシュボード作成
./scripts/create-monitoring-dashboard.sh

# アラート設定
./scripts/setup-alerts.sh
```

#### 💾 バックアップの設定 / Backup Configuration

```json
{
  "backup": {
    "enableAutomaticBackup": true,      // 自動バックアップ
    "retentionDays": 30,               // 保持期間
    "backupSchedule": "cron(0 2 * * ? *)"  // 毎日午前2時
  }
}
```

### 🎯 用途別の活用方法 / Use Cases by Purpose

#### 📚 文書検索システム / Document Search System
- 社内文書の検索・要約
- FAQ自動応答システム
- 技術文書の質問応答

#### 🔬 研究・分析用途 / Research & Analysis
- 論文の類似度分析
- 大量テキストの分類
- トレンド分析

#### 🏢 エンタープライズ用途 / Enterprise Use
- 顧客サポートの自動化
- 契約書の分析
- コンプライアンスチェック

### 📚 さらに学習したい方へ / For Further Learning

#### 🎓 推奨リソース / Recommended Resources

1. **AWS公式ドキュメント**
   - [AWS Batch User Guide](https://docs.aws.amazon.com/batch/)
   - [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/)
   - [FSx for NetApp ONTAP User Guide](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)

2. **実践的なチュートリアル**
   - [RAGシステムの構築方法](./tutorials/rag-system-tutorial.md)
   - [大規模データ処理のベストプラクティス](./tutorials/batch-best-practices.md)
   - [コスト最適化ガイド](./COST_OPTIMIZATION_GUIDE.md)

3. **コミュニティ**
   - [GitHub Discussions](https://github.com/your-repo/discussions)
   - [AWS re:Post](https://repost.aws/)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/aws-cdk)

#### 🛠️ 高度なカスタマイズ / Advanced Customization

```bash
# カスタムモデルの追加
./scripts/add-custom-model.sh

# マルチリージョン展開
./scripts/deploy-multi-region.sh

# パフォーマンスチューニング
./scripts/optimize-performance.sh
```

## 📚 参考資料 / References

- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/)
- [AWS Batch User Guide](https://docs.aws.amazon.com/batch/latest/userguide/)
- [FSx for NetApp ONTAP User Guide](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)
- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/)

## 🆘 困った時のサポート / Support When You're Stuck

**「わからないことがあっても大丈夫！」サポート体制が整っています。**
**"It's okay if you don't understand something!" Support system is in place.**

### 📞 サポートの優先順位 / Support Priority Order

#### 1. 🔍 まずはセルフチェック / First, Self-Check
```bash
# 自動診断スクリプトを実行
./scripts/diagnose-issues.sh

# よくある問題をチェック
./scripts/check-common-issues.sh
```

#### 2. 📖 ドキュメントを確認 / Check Documentation
- [トラブルシューティングガイド](./CDK_TROUBLESHOOTING_GUIDE.md) - 詳細な解決方法
- [設定ガイド](./CDK_CONFIGURATION_GUIDE.md) - 設定の詳細説明
- [FAQ](./FAQ.md) - よくある質問と回答

#### 3. 🤝 コミュニティサポート / Community Support
- **GitHub Discussions**: [質問・議論の場](https://github.com/your-repo/discussions)
- **GitHub Issues**: [バグ報告・機能要望](https://github.com/your-repo/issues)
- **AWS re:Post**: [AWS公式コミュニティ](https://repost.aws/)

#### 4. 🎯 プロフェッショナルサポート / Professional Support
- **AWS サポート**: 有料プランをお持ちの場合
- **NetApp サポート**: FSx関連の専門サポート
- **エンタープライズサポート**: 企業向けカスタムサポート

### 💬 効果的な質問の仕方 / How to Ask Effective Questions

#### ✅ 良い質問の例 / Good Question Example
```
タイトル: CDKデプロイ時にIAM権限エラーが発生

環境:
- OS: macOS 13.0
- Node.js: v20.1.0
- AWS CDK: 2.87.0
- リージョン: ap-northeast-1

エラーメッセージ:
User: arn:aws:iam::123456789012:user/myuser is not authorized to perform: iam:CreateRole

実行したコマンド:
npx cdk deploy --require-approval never

設定ファイル:
{
  "projectName": "my-embedding-project",
  "environment": "dev",
  ...
}

試したこと:
- CDKブートストラップは完了済み
- AWS認証情報は正常に設定済み
```

#### ❌ 避けるべき質問の例 / Poor Question Example
```
「動きません。助けてください。」
"It doesn't work. Please help."
```

### 🎓 学習リソース / Learning Resources

#### 📺 動画チュートリアル / Video Tutorials
- [CDK入門（日本語）](./tutorials/video-tutorial-script.md)
- [Embedding Batch実践編](./tutorials/advanced-tutorial.md)

#### 📝 ハンズオンガイド / Hands-on Guides
- [ステップバイステップガイド](./tutorials/step-by-step-guide.md)
- [実践的なユースケース](./examples/use-cases/)

#### 🔧 開発者向けリソース / Developer Resources
- [API リファレンス](./API_REFERENCE.md)
- [アーキテクチャガイド](./CDK_ARCHITECTURE_GUIDE.md)
- [コントリビューションガイド](./CONTRIBUTING.md)

### 🌟 コミュニティに貢献 / Contribute to Community

**あなたも他の人を助けることができます！**
**You can also help others!**

- 解決した問題をドキュメント化
- 改善提案をGitHub Issuesで共有
- 新しいユースケースの投稿
- 翻訳やドキュメント改善への協力

**みんなで作る、みんなのためのプロジェクト**
**A project by the community, for the community**