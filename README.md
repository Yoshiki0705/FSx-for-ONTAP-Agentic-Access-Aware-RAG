# Permission-aware RAG System with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Amazon FSx for ONTAPとAmazon Bedrockを組み合わせた、権限ベースのRAG（Retrieval-Augmented Generation）システムです。ユーザーのアクセス権限に基づいて検索結果をフィルタリングし、セキュアなドキュメント検索とAIチャット機能を提供します。

---

## Architecture

```
┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └────────────┘     │ (Next.js)           │
                                     └──────┬──────────────┘
                                            │
                       ┌────────────────────┼────────────────────┐
                       ▼                    ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │   │ Permission   │
              │ User Pool   │    │ + OpenSearch     │   │ Service      │
              └─────────────┘    │   Serverless     │   │ (Lambda)     │
                                 └────────┬─────────┘   └──────┬───────┘
                                          │                     │
                                 ┌────────▼─────────┐   ┌──────▼───────┐
                                 │ S3 Data Bucket   │   │ DynamoDB     │
                                 │ (KB DataSource)  │   │ (権限Cache)  │
                                 └────────┬─────────┘   └──────────────┘
                                          │
                                 ┌────────▼─────────┐
                                 │ FSx for ONTAP    │
                                 │ (FlexCache)      │
                                 └──────────────────┘
```

## CDK Stack Structure

| Stack | Resources | Description |
|-------|-----------|-------------|
| NetworkingStack | VPC, Subnets, Security Groups | ネットワーク基盤 |
| SecurityStack | Cognito User Pool | 認証・認可 |
| StorageStack | FSx ONTAP, S3, DynamoDB | ストレージ・キャッシュ |
| AIStack | Bedrock KB, OpenSearch Serverless | RAG検索基盤 |
| WebAppStack | Lambda Web Adapter, CloudFront | Webアプリケーション |

## Prerequisites

- AWS アカウント（AdministratorAccess相当の権限）
- EC2インスタンス（Ubuntu 22.04、t3.large以上推奨、50GB EBS）
  - IAMインスタンスプロファイル: AdministratorAccess付きロール
  - SSM Session Manager経由でアクセス（SSHキー不要）
- CDK Bootstrap済み (`cdk bootstrap aws://ACCOUNT_ID/REGION`)

> **Note**: ビルドとデプロイはすべてEC2上で実行します。ローカル環境との差分を防ぐためです。

## デプロイガイド

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
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-demo}]'
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
  "imageTag": "latest"
}
EOF
```

### Step 6: CDKデプロイ

```bash
# 全5スタックを一括デプロイ
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
IMAGE_TAG="demo-$(date +%Y%m%d-%H%M%S)"
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

### Step 8: デモデータのセットアップ

```bash
# デモユーザー作成（admin + restricted user）
bash demo-data/scripts/create-demo-users.sh

# サンプルドキュメントをS3にアップロード
bash demo-data/scripts/upload-demo-data.sh

# Bedrock KBデータソース同期
bash demo-data/scripts/sync-kb-datasource.sh
```

### Step 9: アプリケーションへのアクセス

CloudFormation出力からCloudFront URLを取得します。

```bash
aws cloudformation describe-stacks \
  --stack-name rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### Cleanup

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

1. ユーザーがチャットで質問を送信
2. Bedrock Knowledge Baseがベクトル検索で関連ドキュメントを取得
3. Permission Serviceがユーザーの SID/ACL 情報に基づいてフィルタリング
4. アクセス権のあるドキュメントのみを使って回答を生成
5. ソースドキュメント情報（citation）を回答と共に表示

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
│   └── demo-app.ts                  # CDKエントリーポイント
├── lib/stacks/demo/
│   ├── demo-networking-stack.ts      # VPC, Subnets, SG
│   ├── demo-security-stack.ts        # Cognito
│   ├── demo-storage-stack.ts         # FSx ONTAP, S3, DynamoDB
│   ├── demo-ai-stack.ts             # Bedrock KB, OpenSearch Serverless
│   └── demo-webapp-stack.ts          # Lambda Web Adapter, CloudFront
├── lambda/permissions/
│   ├── permission-filter-handler.ts  # 権限フィルタリングLambda
│   ├── permission-calculator.ts      # SID/ACL照合ロジック
│   └── types.ts                      # 型定義
├── docker/nextjs/                    # Next.jsアプリケーション
├── demo-data/
│   ├── documents/                    # サンプルドキュメント
│   ├── scripts/                      # セットアップスクリプト
│   └── guides/                       # デモシナリオ・ONTAP設定ガイド
├── tests/unit/                       # ユニットテスト・プロパティテスト
└── .env.example                      # 環境変数テンプレート
```

## Demo Scenario

デモの詳細手順は [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) を参照してください。

2種類のユーザー（管理者・一般ユーザー）で同じ質問をすると、アクセス権に基づいて異なる検索結果が返ることを確認できます。

## FSx ONTAP Setup

FSx ONTAPのボリューム設定・ACL設定の手順は [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) を参照してください。

## License

[Apache License 2.0](LICENSE)
