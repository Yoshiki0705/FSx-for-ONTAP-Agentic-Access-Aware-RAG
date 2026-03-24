# 検証デモ動画 撮影手順書

**作成日**: 2026-03-25  
**目的**: 新規環境でPermission Aware型RAGシステムの検証デモ動画を撮影するための手順書  
**前提**: AWSアカウント（AdministratorAccess相当）、EC2インスタンス（Ubuntu 22.04, t3.large以上, 50GB EBS）

---

## 撮影する証跡（6項目）

| # | 証跡 | 内容 |
|---|------|------|
| (1) | RAGベースAIチャットボット基盤の構築 | アーキテクチャ説明 |
| (2) | AWS CDKを用いたチャットボット基盤のデプロイ | CDKデプロイ手順 |
| (3) | ストレージデータをキャッシュボリュームに配置 | FSx ONTAP CIFSマウント + データ投入 |
| (4) | キャッシュボリュームにアクセス権情報を反映 | `.metadata.json` SID情報の設定 |
| (5) | ユーザーごとのアクセス権に基づいたデータ参照可否の判定 | SIDフィルタリング検証 |
| (6) | 初期検証 | データ連携・アクセス権保持・RAGチャットボット動作確認 |

---

## 事前準備

### EC2インスタンスの起動

```bash
# パブリックサブネットにt3.largeを起動（SSM対応IAMロール付き）
# セキュリティグループ: アウトバウンド443(HTTPS)が開いていればSSM Session Managerが動作
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

### EC2に必要なツールをインストール

SSM Session Managerで接続後:

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io cifs-utils jq

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker有効化
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

# AWS CDK
sudo npm install -g aws-cdk typescript ts-node
```

### リポジトリのクローン

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/RAG-FSxN-CDK.git
cd RAG-FSxN-CDK
npm install
```

---

## 証跡(1): RAGベースAIチャットボット基盤の構築

**撮影内容**: システムアーキテクチャの説明

### 説明ポイント

以下のアーキテクチャ図を画面に表示しながら説明します。

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
              └─────────────┘    │   Serverless     │ │ (SIDデータ)  │   └──────────────┘
                                 └────────┬─────────┘ └──────────────┘
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

### 説明すべき7つの構成要素

1. **Next.js RAG Chatbot on AWS Lambda** — Lambda Web Adapterでサーバーレス実行
2. **AWS WAF** — レートリミット、IP Reputation、OWASP準拠ルール、SQLi防御
3. **IAM認証** — Lambda Function URL IAM Auth + CloudFront OAC (SigV4)
4. **OpenSearch Serverless** — ベクトル検索コレクション（1024次元、HNSW/faiss）
5. **FSx ONTAP + Embedding Server** — CIFSマウント経由でドキュメントをベクトル化
6. **Titan Embed Text v2** — Amazon Bedrockのテキストベクトル化モデル
7. **SIDフィルタリング** — NTFS ACLのSID情報でドキュメントレベルのアクセス制御

### 撮影手順

1. `docs/implementation-overview.md` を画面に表示
2. アーキテクチャ図を示しながら各コンポーネントを説明
3. CDKスタック構成（7スタック）を説明
4. SIDフィルタリングのフロー図を説明

---

## 証跡(2): AWS CDKを用いたチャットボット基盤のデプロイ

**撮影内容**: CDKデプロイの実行と完了確認

### Step 1: CDK Bootstrap（初回のみ）

```bash
cd /home/ubuntu/RAG-FSxN-CDK

# CDK CLIバージョン確認（プロジェクトローカルを使用）
npx cdk --version

# Bootstrap（ap-northeast-1 + us-east-1）
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts"
```

### Step 2: cdk.context.json の設定

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "perm-rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "DemoP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

### Step 3: CDKデプロイ（全6スタック）

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  --require-approval never
```

> **所要時間**: 約30〜40分（FSx ONTAP作成に20〜30分）

### Step 4: デプロイ結果の確認

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 全スタックの出力を確認
for stack in Waf Networking Security Storage AI WebApp; do
  echo "=== ${STACK_PREFIX}-${stack} ==="
  aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${stack} \
    --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' --output table 2>/dev/null
done
```

### Step 5: WebAppコンテナイメージのビルドとプッシュ

```bash
# ECRリポジトリ作成（初回のみ）
aws ecr create-repository \
  --repository-name permission-aware-rag-webapp \
  --region ap-northeast-1 2>/dev/null || true

# ECR認証
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# Dockerイメージビルド
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"
docker build --no-cache \
  -t permission-aware-rag-webapp:${IMAGE_TAG} \
  -f docker/nextjs/Dockerfile \
  docker/nextjs/

# ECRにプッシュ
docker tag permission-aware-rag-webapp:${IMAGE_TAG} \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}
docker push \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

# Lambda関数のイメージを更新
FUNCTION_NAME="${STACK_PREFIX}-webapp"
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG} \
  --region ap-northeast-1
```

### 撮影ポイント

- `cdk deploy --all` の実行画面（スタックが順次デプロイされる様子）
- CloudFormation出力の確認画面
- AWSマネジメントコンソールでリソースが作成されていることの確認

---

## 証跡(3): ストレージデータをキャッシュボリュームに配置

**撮影内容**: FSx ONTAPボリュームへのCIFSマウントとドキュメント投入

### Step 1: AD連携の準備

```bash
STACK_PREFIX="perm-rag-demo-demo"

# リソースID取得
SVM_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`SvmId`].OutputValue' --output text)
FS_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`FileSystemId`].OutputValue' --output text)
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

echo "SVM ID: $SVM_ID"
echo "FS ID: $FS_ID"
echo "AD DNS IPs: $AD_DNS_IPS"
```

### Step 2: セキュリティグループの設定（AD通信用）

```bash
FSX_SG_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking \
  --query 'Stacks[0].Outputs[?OutputKey==`FsxSgId`].OutputValue' --output text)
AD_SG_ID=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].VpcSettings.SecurityGroupId' --output text)

# FSx SG ↔ AD SG 双方向通信許可
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1 2>/dev/null || true
```

### Step 3: SVM AD参加

```bash
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "DemoP@ssw0rd123",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1

# AD参加状態の確認（JOINEDになるまで数分待機）
watch -n 10 "aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Lifecycle' \
  --region ap-northeast-1 --output text"
```

### Step 4: FSx管理パスワード設定 + CIFS共有作成

```bash
# fsxadminパスワード設定
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword":"FsxAdmin123!"}' \
  --region ap-northeast-1

# 管理エンドポイントIP取得
MGMT_IP=$(aws fsx describe-file-systems --file-system-ids $FS_ID \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# SVM UUID取得
SVM_UUID=$(curl -sk -u fsxadmin:FsxAdmin123! \
  "https://${MGMT_IP}/api/svm/svms" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][0]['uuid'])")

# CIFS共有作成
curl -sk -u fsxadmin:FsxAdmin123! \
  -X POST "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H "Content-Type: application/json" \
  -d '{"svm":{"uuid":"'${SVM_UUID}'"},"name":"data","path":"/data"}'
```

### Step 5: CIFSマウントとデータ投入

```bash
# SMBエンドポイントIP取得
SMB_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text --region ap-northeast-1)

# CIFSマウント
sudo mkdir -p /mnt/cifs-data
sudo mount -t cifs //${SMB_IP}/data /mnt/cifs-data \
  -o user=Admin,password=DemoP@ssw0rd123,domain=demo.local,iocharset=utf8

# マウント確認
df -h /mnt/cifs-data

# ドキュメント投入
sudo mkdir -p /mnt/cifs-data/{public,confidential,restricted}
sudo cp -r demo-data/documents/public/* /mnt/cifs-data/public/
sudo cp -r demo-data/documents/confidential/* /mnt/cifs-data/confidential/
sudo cp -r demo-data/documents/restricted/* /mnt/cifs-data/restricted/

# 投入結果確認
find /mnt/cifs-data -type f | sort
```

### 撮影ポイント

- CIFSマウントの実行と`df -h`での確認
- `find`コマンドでファイル一覧を表示
- ドキュメントの内容を`cat`で表示（公開/機密/制限の3種類）

---

## 証跡(4): キャッシュボリュームにアクセス権情報を反映

**撮影内容**: `.metadata.json`によるSID情報の設定と確認

### Step 1: メタデータファイルの確認

```bash
# 各ドキュメントの.metadata.jsonを確認
echo "=== public/company-overview.md.metadata.json ==="
cat /mnt/cifs-data/public/company-overview.md.metadata.json | python3 -m json.tool

echo ""
echo "=== confidential/financial-report.md.metadata.json ==="
cat /mnt/cifs-data/confidential/financial-report.md.metadata.json | python3 -m json.tool

echo ""
echo "=== restricted/project-plan.md.metadata.json ==="
cat /mnt/cifs-data/restricted/project-plan.md.metadata.json | python3 -m json.tool
```

### 期待される出力

```
=== public/company-overview.md.metadata.json ===
{
    "metadataAttributes": {
        "allowed_group_sids": ["S-1-1-0"],        ← Everyone（全ユーザー）
        "access_level": "public"
    }
}

=== confidential/financial-report.md.metadata.json ===
{
    "metadataAttributes": {
        "allowed_group_sids": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
        "access_level": "confidential"             ← Domain Adminsのみ
    }
}

=== restricted/project-plan.md.metadata.json ===
{
    "metadataAttributes": {
        "allowed_group_sids": [
            "S-1-5-21-0000000000-0000000000-0000000000-1100",  ← Engineering
            "S-1-5-21-0000000000-0000000000-0000000000-512"    ← Domain Admins
        ],
        "access_level": "restricted"
    }
}
```

### Step 2: S3バケットへのアップロード（Bedrock KB用）

```bash
DATA_BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)

# S3にアップロード（ドキュメント + .metadata.json）
export DATA_BUCKET_NAME
bash demo-data/scripts/upload-demo-data.sh

# アップロード結果確認
aws s3 ls s3://${DATA_BUCKET_NAME}/ --recursive
```

### Step 3: SIDとアクセス権の対応表を説明

| ディレクトリ | allowed_group_sids | 管理者(admin) | 一般ユーザー(user) |
|-------------|-------------------|--------------|-------------------|
| `public/` | `S-1-1-0` (Everyone) | ✅ 閲覧可 | ✅ 閲覧可 |
| `confidential/` | `...-512` (Domain Admins) | ✅ 閲覧可 | ❌ 閲覧不可 |
| `restricted/` | `...-1100` + `...-512` | ✅ 閲覧可 | ❌ 閲覧不可 |

### 撮影ポイント

- `.metadata.json`の内容を画面に表示
- SIDの意味（Everyone, Domain Admins等）を説明
- アクセス権の対応表を説明

---

## 証跡(5): ユーザーごとのアクセス権に基づいたデータ参照可否の判定

**撮影内容**: 管理者と一般ユーザーで異なる検索結果が返ることの検証

### Step 1: 検証データのセットアップ

```bash
STACK_PREFIX="perm-rag-demo-demo"

# Cognito User Pool ID取得
COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPoolId`)].OutputValue' --output text)

# テストユーザー作成
export COGNITO_USER_POOL_ID
bash demo-data/scripts/create-demo-users.sh

# ユーザーSIDデータ登録
USER_ACCESS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
export USER_ACCESS_TABLE_NAME
bash demo-data/scripts/setup-user-access.sh

# Bedrock KBデータソース同期
BEDROCK_KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
export BEDROCK_KB_ID
bash demo-data/scripts/sync-kb-datasource.sh
```

### Step 2: DynamoDB SIDデータの確認

```bash
# 管理者ユーザーのSID
aws dynamodb get-item \
  --table-name ${USER_ACCESS_TABLE_NAME} \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1 --output json | python3 -m json.tool

# 一般ユーザーのSID
aws dynamodb get-item \
  --table-name ${USER_ACCESS_TABLE_NAME} \
  --key '{"userId":{"S":"user@example.com"}}' \
  --region ap-northeast-1 --output json | python3 -m json.tool
```

### Step 3: Lambda Function URL AuthType変更（検証用）

CloudFront OAC経由のPOSTリクエストで問題が発生する場合、検証環境では以下の調整を行います。

```bash
FUNCTION_NAME="${STACK_PREFIX}-webapp"

# AuthType を NONE に変更（検証環境用）
aws lambda update-function-url-config \
  --function-name ${FUNCTION_NAME} \
  --auth-type NONE \
  --region ap-northeast-1

# Lambda Function URL取得
FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name ${FUNCTION_NAME} \
  --query 'FunctionUrl' --output text --region ap-northeast-1)
echo "Function URL: ${FUNCTION_URL}"
```

### Step 4: curlによるSIDフィルタリング検証

```bash
# CloudFront URL取得
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)

# --- 管理者ユーザーでの検索 ---
echo "=== 管理者ユーザー (admin@example.com) ==="
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "会社の売上はいくらですか？",
    "userId": "admin@example.com",
    "knowledgeBaseId": "'${BEDROCK_KB_ID}'"
  }' | python3 -c "
import sys, json
data = json.load(sys.stdin)
fl = data.get('filterLog', {})
print(f'  検索結果: {fl.get(\"totalDocuments\", 0)} 件中 {fl.get(\"allowedDocuments\", 0)} 件許可')
print(f'  フィルタ方式: {fl.get(\"filterMethod\", \"N/A\")}')
for d in fl.get('details', []):
    status = '✅ ALLOW' if d['matched'] else '❌ DENY'
    print(f'  {status}: {d[\"fileName\"]}')
"

echo ""

# --- 一般ユーザーでの検索 ---
echo "=== 一般ユーザー (user@example.com) ==="
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "会社の売上はいくらですか？",
    "userId": "user@example.com",
    "knowledgeBaseId": "'${BEDROCK_KB_ID}'"
  }' | python3 -c "
import sys, json
data = json.load(sys.stdin)
fl = data.get('filterLog', {})
print(f'  検索結果: {fl.get(\"totalDocuments\", 0)} 件中 {fl.get(\"allowedDocuments\", 0)} 件許可')
print(f'  フィルタ方式: {fl.get(\"filterMethod\", \"N/A\")}')
for d in fl.get('details', []):
    status = '✅ ALLOW' if d['matched'] else '❌ DENY'
    print(f'  {status}: {d[\"fileName\"]}')
"
```

### 期待される結果

```
=== 管理者ユーザー (admin@example.com) ===
  検索結果: 5 件中 5 件許可
  フィルタ方式: SID_MATCHING
  ✅ ALLOW: company-overview.md
  ✅ ALLOW: product-catalog.md
  ✅ ALLOW: financial-report.md
  ✅ ALLOW: hr-policy.md
  ✅ ALLOW: project-plan.md

=== 一般ユーザー (user@example.com) ===
  検索結果: 5 件中 2 件許可
  フィルタ方式: SID_MATCHING
  ✅ ALLOW: company-overview.md
  ✅ ALLOW: product-catalog.md
  ❌ DENY: financial-report.md
  ❌ DENY: hr-policy.md
  ❌ DENY: project-plan.md
```

### 撮影ポイント

- DynamoDBのSIDデータを画面に表示
- curlコマンドの実行結果（管理者 vs 一般ユーザー）
- 管理者は全5件許可、一般ユーザーは2件のみ許可であることを強調
- `filterLog`の`filterMethod: SID_MATCHING`を表示

---

## 証跡(6): 初期検証 — データ連携・アクセス権保持・RAGチャットボット動作確認

**撮影内容**: ブラウザでのエンドツーエンド検証

### Step 1: ブラウザでアクセス

```bash
# CloudFront URL取得
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "アクセスURL: ${CF_URL}/ja/signin"
```

ブラウザで `${CF_URL}/ja/signin` にアクセスします。

### Step 2: 管理者ユーザーでの検証

1. **サインイン**: `admin@example.com` / `DemoAdmin123!`
2. **チャット画面に移動**: サインイン後、チャット画面が表示される
3. **質問1**: 「会社の売上はいくらですか？」
   - **期待結果**: 財務レポート（confidential/financial-report.md）の情報を含む回答
   - **Citation**: financial-report.md が表示される
4. **質問2**: 「リモートワークのポリシーを教えてください」
   - **期待結果**: 人事ポリシー（confidential/hr-policy.md）の情報を含む回答
5. **質問3**: 「製品の概要を教えてください」
   - **期待結果**: 製品カタログ（public/product-catalog.md）の情報を含む回答
6. **サインアウト**

### Step 3: 一般ユーザーでの検証

1. **サインイン**: `user@example.com` / `DemoUser123!`
2. **質問1**: 「会社の売上はいくらですか？」
   - **期待結果**: 財務レポートの情報は含まれない（SIDフィルタリングで拒否）
   - **Citation**: financial-report.md は表示されない
3. **質問2**: 「リモートワークのポリシーを教えてください」
   - **期待結果**: 人事ポリシーの情報は含まれない
4. **質問3**: 「製品の概要を教えてください」
   - **期待結果**: 製品カタログの情報を含む回答（publicなのでアクセス可能）
   - **Citation**: product-catalog.md が表示される
5. **サインアウト**

### Step 4: 検証結果のまとめ

| 質問 | admin | user | 理由 |
|------|-------|------|------|
| 会社の売上 | ✅ 財務レポート参照 | ❌ 公開情報のみ | financial-report.md は Domain Admins のみ |
| リモートワークポリシー | ✅ 人事ポリシー参照 | ❌ アクセス拒否 | hr-policy.md は Domain Admins のみ |
| 製品の概要 | ✅ 製品カタログ参照 | ✅ 製品カタログ参照 | product-catalog.md は Everyone |

### 撮影ポイント

- 管理者でサインイン → 質問 → 回答にCitationが表示される画面
- 一般ユーザーでサインイン → 同じ質問 → 機密情報が含まれない回答
- 2つのユーザーの結果を並べて比較（スクリーンショットまたは画面分割）

---

## Embeddingサーバー経由の検証（オプション）

S3バケット経由ではなく、Embeddingサーバー経由でデータを取り込む場合の追加手順です。

### EmbeddingStackのデプロイ

```bash
# Secrets ManagerにADパスワード登録
AD_SECRET_ARN=$(aws secretsmanager create-secret \
  --name perm-rag-demo-ad-password \
  --secret-string '{"password":"DemoP@ssw0rd123"}' \
  --region ap-northeast-1 \
  --query 'ARN' --output text)

# EmbeddingStackデプロイ
npx cdk deploy ${STACK_PREFIX}-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=$AD_SECRET_ARN \
  --require-approval never
```

### Embeddingコンテナイメージのビルド

```bash
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' --output text)

# Docker環境がある場合
docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest

# Docker環境がない場合はCodeBuildを使用（詳細はdocs/demo-environment-guide.md参照）
```

### AOSSデータアクセスポリシーの更新

Embedding EC2のIAMロールをAOSSデータアクセスポリシーに追加する必要があります。

```bash
# Embedding EC2ロールARN取得
EMBED_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`Role`)].OutputValue' --output text 2>/dev/null)

# AOSSデータアクセスポリシーを更新（Principalにロールを追加）
# AWSマネジメントコンソール > OpenSearch Serverless > Data access policies から更新
```

### Embedding実行

```bash
# Embedding EC2にSSM接続
EMBED_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingInstanceId`].OutputValue' --output text)

aws ssm start-session --target $EMBED_INSTANCE_ID --region ap-northeast-1

# EC2内でDockerコンテナのログを確認
sudo docker logs -f $(sudo docker ps -aq | head -n1)
```

---

## リソースの削除

検証完了後、全リソースを削除します。

```bash
# 全CDKスタック削除
npx cdk destroy --all \
  --app "npx ts-node bin/demo-app.ts"

# EC2インスタンス終了
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region ap-northeast-1

# Secrets Manager削除（Embedding使用時）
aws secretsmanager delete-secret \
  --secret-id perm-rag-demo-ad-password \
  --force-delete-without-recovery \
  --region ap-northeast-1
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| CDKデプロイでschema version mismatch | CDK CLIバージョン不一致 | `npm install aws-cdk@latest` + `npx cdk` を使用 |
| SVM AD参加がMISCONFIGURED | OU path未指定 or SG不足 | OU明示指定 + FSx/AD SG間の全トラフィック許可 |
| CIFSマウント失敗 | SVM未AD参加 or CIFS共有未作成 | AD参加完了確認 + ONTAP REST APIでCIFS共有作成 |
| KB検索で結果が返らない | データソース未同期 | `sync-kb-datasource.sh` を実行 |
| 全ドキュメントが拒否される | SIDデータ未登録 | `setup-user-access.sh` を実行 |
| POSTリクエストが403 | OAC + IAM Auth の互換性 | Function URL AuthType を NONE に変更 |
| ページが表示されない | CloudFrontキャッシュ | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Docker権限エラー | dockerグループ未参加 | `sudo usermod -aG docker ubuntu && newgrp docker` |
| Embedding 403 Forbidden | AOSSデータアクセスポリシー不足 | Embedding EC2ロールをAOSSポリシーに追加 |
