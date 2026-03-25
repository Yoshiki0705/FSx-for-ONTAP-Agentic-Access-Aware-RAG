# Permission-aware RAG System with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Amazon FSx for ONTAPとAmazon Bedrockを組み合わせた、権限ベースのRAG（Retrieval-Augmented Generation）システムです。ユーザーのアクセス権限に基づいて検索結果をフィルタリングし、セキュアなドキュメント検索とAIチャット機能を提供します。

---

## Architecture

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ ブラウザ  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + OpenSearch     │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   Serverless     │ │ (SIDデータ)  │   │ (権限Cache)  │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                     ┌────────────────┐     ┌──────────────────┐
                     │ S3 Bucket      │     │ FSx for ONTAP    │
                     │ (メタデータ同期)│     │ (SVM + Volume)   │
                     └────────────────┘     └────────┬─────────┘
                                                     │ CIFS/SMB
                                                     ▼
                                            ┌──────────────────┐
                                            │ Embedding EC2    │
                                            │ (Titan Embed v2) │
                                            └──────────────────┘
```

## 実装概要（7つの観点）

本システムの実装内容を7つの観点で整理しています。各項目の詳細は [docs/implementation-overview.md](docs/implementation-overview.md) を参照してください。

| # | 観点 | 概要 | 関連CDKスタック |
|---|------|------|----------------|
| 1 | Chatbotアプリケーション | Next.js 15 (App Router) をLambda Web Adapterでサーバーレス実行。CloudFront経由で配信 | WebAppStack |
| 2 | AWS WAF | レートリミット、IP Reputation、OWASP準拠ルール、SQLi防御、IP許可リストの6ルール構成 | WafStack |
| 3 | IAM認証 | Lambda Function URL IAM Auth + CloudFront OAC (SigV4署名) による多層セキュリティ | WebAppStack |
| 4 | ベクトルDB (AOSS) | OpenSearch Serverlessベクトル検索コレクション（1024次元、HNSW/faiss/l2） | AIStack |
| 5 | Embedding Server | FSx ONTAPボリュームをCIFS/SMBマウントしたEC2でドキュメントをベクトル化しAOSSに書き込み | EmbeddingStack |
| 6 | Titan Text Embeddings | `amazon.titan-embed-text-v2:0`（1024次元）をKB取り込みとEmbeddingサーバーの両方で使用 | AIStack |
| 7 | SIDメタデータ + 権限フィルタリング | NTFS ACLのSID情報を`.metadata.json`で管理し、検索時にユーザーSIDと照合してフィルタリング | StorageStack |

## CDK Stack Structure

| # | Stack | Region | Resources | Description |
|---|-------|--------|-----------|-------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IPセット | CloudFront用WAF（レートリミット、マネージドルール） |
| 2 | NetworkingStack | ap-northeast-1 | VPC, サブネット, セキュリティグループ | ネットワーク基盤 |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client | 認証・認可 |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, (AD) | ストレージ・SIDデータ・権限キャッシュ（AD連携オプション） |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, OpenSearch Serverless | RAG検索基盤（Titan Embed v2） |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker, IAM Auth + OAC), CloudFront | Webアプリケーション |
| 7 | EmbeddingStack（任意） | ap-northeast-1 | EC2 (m5.large), ECR | FlexCache CIFSマウント + Embeddingサーバー |

### セキュリティ機能（6層防御）

| レイヤー | 技術 | 目的 |
|---------|------|------|
| L1: ネットワーク | CloudFront Geo制限 | 地理的アクセス制限（デフォルト: 日本のみ） |
| L2: WAF | AWS WAF (6ルール) | 攻撃パターン検出・ブロック |
| L3: オリジン認証 | CloudFront OAC (SigV4) | CloudFront以外からの直接アクセス防止 |
| L4: API認証 | Lambda Function URL IAM Auth | IAM認証によるアクセス制御 |
| L5: ユーザー認証 | Cognito JWT | ユーザーレベルの認証・認可 |
| L6: データ認可 | SIDフィルタリング | ドキュメントレベルのアクセス制御 |

## Prerequisites

- AWS アカウント（AdministratorAccess相当の権限）
- EC2インスタンス（Ubuntu 22.04、t3.large以上推奨、50GB EBS）
  - IAMインスタンスプロファイル: AdministratorAccess付きロール
  - SSM Session Manager経由でアクセス（SSHキー不要）
- CDK Bootstrap済み (`cdk bootstrap aws://ACCOUNT_ID/REGION`)

> **Note**: ビルドとデプロイはすべてEC2上で実行します。ローカル環境との差分を防ぐためです。

## デプロイ手順

### Step 1: EC2インスタンスの起動

AWS CLIまたはマネジメントコンソールからEC2インスタンスを起動します。

```bash
# パブリックサブネットにt3.largeを起動（SSM対応IAMロール付き）
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id ami-0e467ee8344baec9e \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

セキュリティグループはアウトバウンド443（HTTPS）が開いていればSSM Session Managerが動作します。インバウンドルールは不要です。

### Step 2: EC2に必要なツールをインストール

SSM Session Managerで接続後、以下を実行します。

```bash
# システム更新 + 基本ツール
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker有効化
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# AWS CDK（グローバル）
sudo npm install -g aws-cdk typescript ts-node
```

#### ⚠️ CDK CLIバージョンの注意点

`npm install -g aws-cdk` でインストールされるCDK CLIのバージョンが、プロジェクトの `aws-cdk-lib` と互換性がない場合があります。

```bash
# 確認方法
cdk --version          # グローバルCLIバージョン
npx cdk --version      # プロジェクトローカルCLIバージョン
```

本プロジェクトでは `aws-cdk-lib@2.244.0` を使用しています。CLIバージョンが古い場合、以下のエラーが出ます：

```
Cloud assembly schema version mismatch: Maximum schema version supported is 48.x.x, but found 52.0.0
```

**対処法**: プロジェクトローカルのCDK CLIを最新に更新します。

```bash
cd Permission-aware-RAG-FSxN-CDK
npm install aws-cdk@latest
npx cdk --version  # 更新後のバージョンを確認
```

> **重要**: `cdk` コマンドではなく `npx cdk` を使うことで、プロジェクトローカルの最新CLIが使われます。

### Step 3: リポジトリのクローンと依存関係インストール

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK
npm install
```

### Step 4: CDK Bootstrap（初回のみ）

対象リージョンでCDK Bootstrapが未実行の場合に実行します。

```bash
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts"
```

### Step 5: CDK Context設定

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

#### Active Directory連携（オプション）

FSx ONTAP SVMをActive Directoryドメインに参加させ、CIFS共有でNTFS ACL（SIDベース）を使用する場合は、`cdk.context.json` に以下を追加します。

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `adPassword` | string | 未設定（AD作成なし） | AWS Managed Microsoft AD管理者パスワード。設定するとADを作成しSVMをドメイン参加させる |
| `adDomainName` | string | `demo.local` | ADドメイン名（FQDN） |

> **Note**: AD作成には追加で20〜30分かかります。ADなしでもSIDフィルタリングのデモは可能です（DynamoDBのSIDデータで検証）。

### Step 6: CDKデプロイ

```bash
# 全6スタックを一括デプロイ
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  --require-approval never
```

> **所要時間の目安**: FSx for ONTAPの作成に20〜30分かかるため、全体で30〜40分程度です。

### Step 7: Dockerイメージのビルドとプッシュ（WebApp用）

CDKデプロイ後、WebAppStack用のDockerイメージをビルドしてECRにプッシュします。

```bash
# ECRリポジトリ作成（初回のみ）
aws ecr create-repository \
  --repository-name permission-aware-rag-webapp \
  --region ap-northeast-1

# ECR認証
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

# Dockerイメージビルド
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"
docker build --no-cache \
  -t permission-aware-rag-webapp:${IMAGE_TAG} \
  -f docker/nextjs/Dockerfile \
  docker/nextjs/

# ECRにプッシュ
docker tag permission-aware-rag-webapp:${IMAGE_TAG} \
  <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

docker push \
  <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}
```

> **Note**: `docker` コマンドで権限エラーが出る場合は、`newgrp docker` を実行するか、一度ログアウト・再ログインしてください。

### Step 8: 検証データのセットアップ

```bash
# 検証用ユーザー作成（admin + restricted user）
bash demo-data/scripts/create-demo-users.sh

# ユーザーSIDデータ登録（DynamoDB user-accessテーブル）
# 本アプリケーションではメールアドレスをuserIdとして使用します
bash demo-data/scripts/setup-user-access.sh

# サンプルドキュメントをS3にアップロード（.metadata.json含む）
bash demo-data/scripts/upload-demo-data.sh

# Bedrock KBデータソース同期
bash demo-data/scripts/sync-kb-datasource.sh
```

> **Note**: `setup-user-access.sh` はDynamoDB `user-access`テーブルにメールアドレス（例: `admin@example.com`）をキーとしてSIDデータを登録します。アプリケーションのJWTではメールアドレスが`userId`として使用されます。

### Step 9: アプリケーションへのアクセスと検証

CloudFormation出力からCloudFront URLを取得します。

```bash
aws cloudformation describe-stacks \
  --stack-name rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### リソースの削除

```bash
# 全リソース削除
npx cdk destroy --all \
  --app "npx ts-node bin/demo-app.ts"

# EC2インスタンス終了
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region ap-northeast-1
```

## トラブルシューティング

### CDK CLI バージョン不一致

| 症状 | 原因 | 対処 |
|------|------|------|
| `Cloud assembly schema version mismatch` | グローバルCDK CLIが古い | `npm install aws-cdk@latest` でプロジェクトローカルを更新し `npx cdk` を使用 |

### Docker権限エラー

| 症状 | 原因 | 対処 |
|------|------|------|
| `permission denied while trying to connect to the Docker daemon` | ユーザーがdockerグループに未参加 | `sudo usermod -aG docker ubuntu && newgrp docker` |

### SSM Session Manager接続不可

| 症状 | 原因 | 対処 |
|------|------|------|
| SSMでインスタンスが表示されない | IAMロール未設定 or アウトバウンド443閉鎖 | IAMインスタンスプロファイルとSGアウトバウンドルールを確認 |

## WAF & Geo制限の設定

### WAFルール構成

CloudFront用WAFは `us-east-1` にデプロイされ、6つのルールで構成されています（優先度順に評価）。

| 優先度 | ルール名 | 種別 | 説明 |
|--------|---------|------|------|
| 100 | RateLimit | カスタム | 1つのIPアドレスから5分間に3000リクエストを超えるとブロック |
| 200 | AWSIPReputationList | AWSマネージド | ボットネット、DDoS送信元など悪意のあるIPアドレスをブロック |
| 300 | AWSCommonRuleSet | AWSマネージド | OWASP Top 10準拠の汎用ルール（XSS、LFI、RFI等）。RAGリクエストとの互換性のため `GenericRFI_BODY`、`SizeRestrictions_BODY`、`CrossSiteScripting_BODY` を除外 |
| 400 | AWSKnownBadInputs | AWSマネージド | Log4j（CVE-2021-44228）等の既知の脆弱性を悪用するリクエストをブロック |
| 500 | AWSSQLiRuleSet | AWSマネージド | SQLインジェクション攻撃パターンを検出・ブロック |
| 600 | IPAllowList | カスタム（任意） | `allowedIps` が設定されている場合のみ有効。リスト外のIPをブロック |

### Geo制限

CloudFrontレベルで地理的アクセス制限を適用します。WAFとは別レイヤーの保護です。

- デフォルト: 日本（`JP`）のみ許可
- CloudFrontの `GeoRestriction.allowlist` で実装
- 許可国以外からのアクセスは `403 Forbidden` を返す

### 設定方法

`cdk.context.json` で以下の値を変更します。

```json
{
  "allowedIps": ["203.0.113.0/24", "198.51.100.1/32"],
  "allowedCountries": ["JP", "US"]
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `allowedIps` | string[] | `[]`（制限なし） | 許可するIPアドレスのCIDRリスト。空の場合はIPフィルタルール自体が作成されない |
| `allowedCountries` | string[] | `["JP"]` | CloudFront Geo制限で許可する国コード（ISO 3166-1 alpha-2） |

### カスタマイズ例

レートリミットの閾値変更やルールの追加・除外は `lib/stacks/demo/demo-waf-stack.ts` を直接編集します。

```typescript
// レートリミットを1000 req/5minに変更する場合
rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' },

// Common Rule Setの除外ルールを変更する場合
excludedRules: [
  { name: 'GenericRFI_BODY' },
  { name: 'SizeRestrictions_BODY' },
  // CrossSiteScripting_BODY を除外リストから外す（有効化する）場合はこの行を削除
],
```

変更後は `npx cdk deploy --all --app "npx ts-node bin/demo-app.ts"` で反映されます。WAFスタックは `us-east-1` にデプロイされるため、クロスリージョンデプロイが自動的に行われます。

## Embeddingサーバー（オプション）

FlexCache CacheボリュームをCIFSマウントしてEmbeddingを実行するEC2サーバーです。FSx ONTAP S3 Access Pointが利用できない場合（FlexCache Cacheボリュームでは2026年3月時点で未対応）の代替パスとして使用します。

### 2つのデータ取り込みパス

| パス | 方式 | データソース | 状況 |
|------|------|-------------|------|
| Option A（デフォルト） | S3バケット + Bedrock KB S3データソース | S3にアップロードしたドキュメント | 常に利用可能 |
| Option B（オプション） | Embeddingサーバー + CIFSマウント | FlexCache Cacheボリューム上のドキュメント | `-c enableEmbeddingServer=true` で有効化 |

### Embeddingサーバーのデプロイ

```bash
# Step 1: Embeddingスタックをデプロイ
CIFSDATA_VOL_NAME=smb_share RAGDB_VOL_PATH=/smb_share/ragdb \
  npx cdk deploy perm-rag-demo-demo-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=arn:aws:secretsmanager:ap-northeast-1:<ACCOUNT_ID>:secret:<SECRET_NAME> \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local

# Step 2: EmbeddingコンテナイメージをECRにプッシュ
# CloudFormation出力からECRリポジトリURIを取得
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' \
  --output text)

aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

### Embeddingサーバーのコンテキストパラメータ

| パラメータ | 環境変数 | デフォルト | 説明 |
|-----------|---------|----------|------|
| `enableEmbeddingServer` | - | `false` | Embeddingスタックの有効化 |
| `cifsdataVolName` | `CIFSDATA_VOL_NAME` | `smb_share` | CIFSマウントするFlexCache Cacheボリューム名 |
| `ragdbVolPath` | `RAGDB_VOL_PATH` | `/smb_share/ragdb` | ragdbのCIFSマウントパス |
| `embeddingAdSecretArn` | - | (必須) | AD管理者パスワードのSecrets Manager ARN |
| `embeddingAdUserName` | - | `Admin` | ADサービスアカウントユーザー名 |
| `embeddingAdDomain` | - | `demo.local` | ADドメイン名 |

### 動作の仕組み

EC2インスタンス（m5.large）が起動時に以下を実行します:

1. Secrets ManagerからADパスワードを取得
2. FSx APIからSVMのSMBエンドポイントIPを取得
3. CIFSでFlexCache Cacheボリュームを `/tmp/data` にマウント
4. ragdbディレクトリを `/tmp/db` にマウント
5. ECRからEmbeddingコンテナイメージをプルして実行
6. コンテナがマウントされたドキュメントを読み取り、OpenSearch Serverlessにベクトルデータを書き込み

## How Permission-aware RAG Works

### 処理フロー（2段階方式: Retrieve + Converse）

```
ユーザー          Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ 1.質問送信       │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ 2.ユーザーSID取得   │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ 3.Retrieve API（ベクトル検索+メタデータ）│                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ 検索結果 + メタデータ(SID)            │                │
  │                  │                    │                  │                │
  │                  │ 4.SIDマッチング    │                  │                │
  │                  │ ユーザーSID ∩      │                  │                │
  │                  │ ドキュメントSID    │                  │                │
  │                  │                    │                  │                │
  │                  │ 5.許可ドキュメントのみで回答生成                       │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ 6.フィルタ済み結果│                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

1. ユーザーがチャットで質問を送信
2. DynamoDB `user-access` テーブルからユーザーのSIDリスト（個人SID + グループSID）を取得
3. Bedrock KB Retrieve APIがベクトル検索で関連ドキュメントを取得（メタデータにSID情報を含む）
4. 各ドキュメントの `allowed_group_sids` とユーザーのSIDリストを照合し、マッチしたドキュメントのみ許可
5. アクセス権のあるドキュメントのみをコンテキストとしてConverse APIで回答を生成
6. フィルタ済みの回答とcitation情報を表示

### SIDフィルタリングの仕組み

各ドキュメントには `.metadata.json` でNTFS ACLのSID情報が付与されています。検索時にユーザーのSIDとドキュメントのSIDを照合し、マッチした場合のみアクセスを許可します。

```
■ 管理者ユーザー: SID = [...-512 (Domain Admins), S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 マッチ → ✅ 許可
  confidential/ (Domain Admins) → ...-512 マッチ → ✅ 許可
  restricted/ (Engineering+DA) → ...-512 マッチ → ✅ 許可

■ 一般ユーザー: SID = [...-1001, S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 マッチ → ✅ 許可
  confidential/ (Domain Admins) → マッチなし   → ❌ 拒否
  restricted/ (Engineering+DA) → マッチなし   → ❌ 拒否
```

詳細は [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) を参照してください。

## Tech Stack

| Layer | Technology |
|-------|-----------|
| IaC | AWS CDK v2 (TypeScript) |
| Frontend | Next.js 15 + React 18 + Tailwind CSS |
| Auth | Amazon Cognito |
| AI/RAG | Amazon Bedrock Knowledge Base + OpenSearch Serverless |
| Embedding | Amazon Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`, 1024次元) |
| Storage | Amazon FSx for NetApp ONTAP + S3 |
| Compute | Lambda Web Adapter + CloudFront |
| Permission | DynamoDB (user-access: SIDデータ, perm-cache: 権限キャッシュ) |
| Security | AWS WAF + IAM Auth + OAC + Geo制限 |

## Project Structure

```
├── bin/
│   └── demo-app.ts                  # CDKエントリーポイント（7スタック構成）
├── lib/stacks/demo/
│   ├── demo-waf-stack.ts             # WAF WebACL (us-east-1)
│   ├── demo-networking-stack.ts      # VPC, Subnets, SG
│   ├── demo-security-stack.ts        # Cognito
│   ├── demo-storage-stack.ts         # FSx ONTAP + SVM + Volume, S3, DynamoDB×2, AD
│   ├── demo-ai-stack.ts             # Bedrock KB, OpenSearch Serverless
│   ├── demo-webapp-stack.ts          # Lambda (IAM Auth + OAC), CloudFront
│   └── demo-embedding-stack.ts       # (optional) Embedding Server (FlexCache CIFS)
├── lambda/permissions/
│   ├── permission-filter-handler.ts  # 権限フィルタリングLambda
│   ├── permission-calculator.ts      # SID/ACL照合ロジック
│   └── types.ts                      # 型定義
├── docker/nextjs/                    # Next.jsアプリケーション
├── demo-data/
│   ├── documents/                    # 検証用ドキュメント + .metadata.json（SID情報）
│   ├── scripts/                      # セットアップスクリプト（ユーザー作成、SIDデータ登録等）
│   └── guides/                       # 検証シナリオ・ONTAP設定ガイド
├── docs/
│   ├── implementation-overview.md    # 実装内容の詳細説明（7つの観点）
│   ├── SID-Filtering-Architecture.md # SIDフィルタリング アーキテクチャ詳細
│   ├── demo-recording-guide.md       # 検証デモ動画撮影手順書（6つの証跡）
│   ├── demo-environment-guide.md     # 検証環境セットアップガイド
│   ├── verification-report.md        # デプロイ後の検証手順とテストケース
│   └── DOCUMENTATION_INDEX.md        # ドキュメントインデックス
├── tests/unit/                       # ユニットテスト・プロパティテスト
└── .env.example                      # 環境変数テンプレート
```

## 検証シナリオ

権限フィルタリングの動作検証手順は [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) を参照してください。

2種類のユーザー（管理者・一般ユーザー）で同じ質問をすると、アクセス権に基づいて異なる検索結果が返ることを確認できます。

## FSx ONTAP + Active Directory Setup

FSx ONTAPのAD連携・CIFS共有・NTFS ACL設定の手順は [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) を参照してください。

CDKデプロイでAWS Managed Microsoft ADとFSx ONTAP（SVM + Volume）が作成されます。SVMのADドメイン参加はデプロイ後にCLIで実行します（タイミング制御のため）。

```bash
# AD DNS IP取得
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# SVM AD参加
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id <SVM_ID> \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": <AD_DNS_IPS>,
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

S3 Access Pointの設計判断（WINDOWSユーザータイプ、Internetアクセス）の詳細もガイドに記載しています。

## License

[Apache License 2.0](LICENSE)
