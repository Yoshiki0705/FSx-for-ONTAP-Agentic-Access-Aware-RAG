# Permission-aware RAG System with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Amazon FSx for ONTAPとAmazon Bedrockを組み合わせた、権限ベースのRAG（Retrieval-Augmented Generation）システムです。ユーザーのアクセス権限に基づいて検索結果をフィルタリングし、セキュアなドキュメント検索とAIチャット機能を提供します。

---

## Architecture

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ Permission   │   │ DynamoDB     │
              │ User Pool   │    │ + OpenSearch     │ │ Service      │   │ (権限Cache)  │
              └─────────────┘    │   Serverless     │ │ (Lambda)     │   └──────────────┘
                                 └────────┬─────────┘ └──────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                     ┌────────────────┐     ┌──────────────────┐
                     │ S3 Data Bucket │     │ FSx for ONTAP    │
                     │ (KB DataSource)│     │ (SVM + Volume)   │
                     └────────────────┘     │ + S3 Access Point│
                                            └──────────────────┘
```

## CDK Stack Structure

| Stack | Region | Resources | Description |
|-------|--------|-----------|-------------|
| WafStack | us-east-1 | WAF WebACL, IP Set | CloudFront用WAF（レートリミット、マネージドルール） |
| NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups | ネットワーク基盤 |
| SecurityStack | ap-northeast-1 | Cognito User Pool | 認証・認可 |
| StorageStack | ap-northeast-1 | FSx ONTAP + SVM + S3 AP, S3, DynamoDB | ストレージ・キャッシュ |
| AIStack | ap-northeast-1 | Bedrock KB, OpenSearch Serverless | RAG検索基盤 |
| WebAppStack | ap-northeast-1 | Lambda (IAM Auth + OAC), CloudFront | Webアプリケーション |

### セキュリティ機能

- **AWS WAF**: レートリミット、IP Reputation、Common Rule Set、SQLi防御、IP許可リスト
- **IAM認証**: Lambda Function URLにAWS_IAM認証、CloudFront OAC（SigV4署名）
- **Geo制限**: 日本国内のみアクセス許可（設定変更可能）
- **SIDフィルタリング**: NTFS ACLベースの権限フィルタリング有効
- **FSx ONTAP S3 Access Point**: WINDOWSユーザータイプ、NTFS ACLベースのファイルレベル認可

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
# Cognitoユーザーのsubを環境変数に設定
export ADMIN_USER_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username admin@example.com \
  --query 'UserAttributes[?Name==`sub`].Value' --output text)
export REGULAR_USER_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username user@example.com \
  --query 'UserAttributes[?Name==`sub`].Value' --output text)
bash demo-data/scripts/setup-user-access.sh

# サンプルドキュメントをS3にアップロード（.metadata.json含む）
bash demo-data/scripts/upload-demo-data.sh

# Bedrock KBデータソース同期
bash demo-data/scripts/sync-kb-datasource.sh
```

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

## How Permission-aware RAG Works

### 処理フロー

```
ユーザー          Next.js API           DynamoDB          Bedrock KB
  │                  │                    │                  │
  │ 1.質問送信       │                    │                  │
  │─────────────────▶│                    │                  │
  │                  │ 2.ユーザーSID取得   │                  │
  │                  │───────────────────▶│                  │
  │                  │◀───────────────────│                  │
  │                  │ userSID + groupSIDs│                  │
  │                  │                    │                  │
  │                  │ 3.RAG検索                             │
  │                  │─────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────│
  │                  │ 検索結果 + メタデータ(SID)            │
  │                  │                    │                  │
  │                  │ 4.SIDマッチング    │                  │
  │                  │ ユーザーSID ∩      │                  │
  │                  │ ドキュメントSID    │                  │
  │                  │                    │                  │
  │ 5.フィルタ済み結果│                    │                  │
  │◀─────────────────│                    │                  │
```

1. ユーザーがチャットで質問を送信
2. DynamoDB `user-access` テーブルからユーザーのSIDリスト（個人SID + グループSID）を取得
3. Bedrock Knowledge Baseがベクトル検索で関連ドキュメントを取得（メタデータにSID情報を含む）
4. 各ドキュメントの `allowed_group_sids` とユーザーのSIDリストを照合し、マッチしたドキュメントのみ許可
5. アクセス権のあるドキュメントのみを使って回答を生成し、citation情報と共に表示

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
| Storage | FSx for NetApp ONTAP (FlexCache) + S3 |
| Compute | Lambda Web Adapter + CloudFront |
| Permission | Lambda (Permission Service) + DynamoDB (Cache) |

## Project Structure

```
├── bin/
│   └── demo-app.ts                  # CDKエントリーポイント（6スタック構成）
├── lib/stacks/demo/
│   ├── demo-waf-stack.ts             # WAF WebACL (us-east-1)
│   ├── demo-networking-stack.ts      # VPC, Subnets, SG
│   ├── demo-security-stack.ts        # Cognito
│   ├── demo-storage-stack.ts         # FSx ONTAP + SVM + S3 AP, S3, DynamoDB
│   ├── demo-ai-stack.ts             # Bedrock KB, OpenSearch Serverless
│   └── demo-webapp-stack.ts          # Lambda (IAM Auth + OAC), CloudFront
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
│   └── SID-Filtering-Architecture.md # SIDフィルタリング アーキテクチャ詳細
├── tests/unit/                       # ユニットテスト・プロパティテスト
└── .env.example                      # 環境変数テンプレート
```

## 検証シナリオ

権限フィルタリングの動作検証手順は [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) を参照してください。

2種類のユーザー（管理者・一般ユーザー）で同じ質問をすると、アクセス権に基づいて異なる検索結果が返ることを確認できます。

## FSx ONTAP Setup

FSx ONTAPのボリューム設定・S3 Access Point・ACL設定の手順は [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) を参照してください。

S3 Access Pointの設計判断（WINDOWSユーザータイプ、Internetアクセス）の詳細もガイドに記載しています。

## License

[Apache License 2.0](LICENSE)
