# Permission-aware RAG 検証環境ガイド

**最終更新**: 2026-03-25  
**リージョン**: ap-northeast-1 (東京)

---

## 1. アクセス情報

### WebアプリケーションURL

| エンドポイント | URL |
|---|---|
| CloudFront (本番) | `<CDKデプロイ後にCloudFormation出力から取得>` |
| Lambda Function URL (直接) | `<CDKデプロイ後にCloudFormation出力から取得>` |

```bash
# URL取得コマンド
STACK_PREFIX="perm-rag-demo-demo"
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text
```

### テストユーザー

| ユーザー | メールアドレス | パスワード | ロール | 権限 |
|---|---|---|---|---|
| 管理者 | `admin@example.com` | `DemoAdmin123!` | administrator | 全ドキュメント閲覧可 |
| 一般ユーザー | `user@example.com` | `DemoUser123!` | user | public ドキュメントのみ |

認証はAmazon Cognitoで管理されています。

---

## 2. CDKスタック構成（6+1スタック）

| スタック名 | リージョン | 説明 |
|---|---|---|
| `${prefix}-Waf` | us-east-1 | CloudFront用WAF WebACL |
| `${prefix}-Networking` | ap-northeast-1 | VPC, サブネット, セキュリティグループ |
| `${prefix}-Security` | ap-northeast-1 | Cognito User Pool, 認証 |
| `${prefix}-Storage` | ap-northeast-1 | FSx ONTAP + SVM + Volume + S3 + DynamoDB + AD |
| `${prefix}-AI` | ap-northeast-1 | Bedrock KB + OpenSearch Serverless |
| `${prefix}-WebApp` | ap-northeast-1 | Lambda Web Adapter (Next.js) + CloudFront |
| `${prefix}-Embedding` (optional) | ap-northeast-1 | Embedding EC2 + ECR（FlexCache CIFSマウント） |

### リソースID取得

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 全スタックの出力を一括取得
for stack in Waf Networking Security Storage AI WebApp Embedding; do
  echo "=== ${STACK_PREFIX}-${stack} ==="
  aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${stack} \
    --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' --output table 2>/dev/null || echo "  (未デプロイ)"
done
```

---

## 3. 検証シナリオ

### 基本フロー

1. CloudFront URLにアクセス → `/ja/signin`
2. テストユーザーでサインイン
3. チャット画面でモデル選択（推奨: `amazon.nova-lite-v1:0`）
4. RAG検索で権限フィルタリングを確認

### 権限差異の確認

管理者と一般ユーザーで同じ質問をすると、SIDフィルタリングにより異なる結果が返ります。

| 質問例 | admin | user |
|--------|-------|------|
| 「会社の売上はいくらですか？」 | ✅ 財務レポート参照 | ❌ 公開情報のみ |
| 「リモートワークのポリシーは？」 | ✅ 人事ポリシー参照 | ❌ アクセス拒否 |
| 「製品の概要を教えてください」 | ✅ 製品カタログ参照 | ✅ 製品カタログ参照 |

詳細は [demo-data/guides/demo-scenario.md](../demo-data/guides/demo-scenario.md) を参照。

---

## 4. Active Directory 連携

### AD情報

| 項目 | 値 |
|---|---|
| ドメイン名 | `demo.local` |
| エディション | Standard |
| DNS IP | `<ADデプロイ後に取得>` |

```bash
# AD情報取得
aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].{Id:DirectoryId,Stage:Stage,DnsIps:DnsIpAddrs}' \
  --output table
```

### SVM AD参加手順

CDKではSVMをAD設定なしで作成します。デプロイ後にCLIでADドメインに参加させます。

#### 前提条件: セキュリティグループの設定

SVM AD参加にはFSx SGとAD SG間の通信が必要です。CDKで `allowAllOutbound: true` が設定されていますが、以下のインバウンドルールも必要です。

```bash
# FSx SG ID と AD SG ID を取得
FSX_SG_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking \
  --query 'Stacks[0].Outputs[?OutputKey==`FsxSgId`].OutputValue' --output text)
AD_SG_ID=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].VpcSettings.SecurityGroupId' --output text)

# FSx SG に AD通信用ポートを追加（CDKで不足している場合）
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 135 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 636 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 123 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 1024-65535 --source-group $AD_SG_ID --region ap-northeast-1

# 双方向通信: AD SG ↔ FSx SG 全トラフィック許可
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1
```

#### SVM AD参加コマンド

```bash
SVM_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`SvmId`].OutputValue' --output text)
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# 重要: AWS Managed ADの場合、OrganizationalUnitDistinguishedName を明示的に指定する
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

> **重要**: AWS Managed ADでは `OrganizationalUnitDistinguishedName` を省略するとMISCONFIGUREDになります。`OU=Computers,OU=<NetBIOS短縮名>,DC=<domain>,DC=<tld>` の形式で指定してください。

#### AD参加状態の確認

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration' \
  --region ap-northeast-1 --output json
```

`NetBiosName` が表示され、`SelfManagedActiveDirectoryConfiguration` にドメイン情報が含まれていれば成功です。

詳細手順は [demo-data/guides/ontap-setup-guide.md](../demo-data/guides/ontap-setup-guide.md) を参照。

---

## 5. Knowledge Base データ

### Option A: S3バケット経由（デフォルト）

S3バケットに以下のドキュメントが登録されます。各ドキュメントには `.metadata.json` でSID情報が付与されています。

| ファイル | アクセスレベル | allowed_group_sids | admin | user |
|---|---|---|---|---|
| `public/company-overview.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `public/product-catalog.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `restricted/project-plan.md` | restricted | ...-1100, ...-512 | ✅ | ❌ |
| `confidential/financial-report.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |
| `confidential/hr-policy.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |

### Option B: Embeddingサーバー経由（FlexCache CIFSマウント）

FlexCache CacheボリュームをCIFSマウントし、Embeddingサーバーで直接ベクトル化してOpenSearch Serverlessにインデックスします。S3 Access Pointが利用できない場合（FlexCache Cacheボリュームでは2026年3月時点で未対応）の代替パスです。

詳細は [6. Embeddingサーバー](#6-embeddingサーバーオプション) を参照。

---

## 6. Embeddingサーバー（オプション）

### 概要

EmbeddingStack（7番目のCDKスタック）は、FSx ONTAP上のCIFS共有ドキュメントを直接読み取り、Amazon Bedrock Titan Embed Text v2でベクトル化し、OpenSearch ServerlessにインデックスするEC2ベースのサーバーです。

### アーキテクチャ

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    マウント        │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ - scan docs  │ │
                                       │ │ - embedding  │ │
                                       │ │ - indexing   │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    │ (ベクトル生成)    │              │ (インデックス)    │
                    └──────────────────┘              └──────────────────┘
```

### デプロイ手順

#### Step 1: Secrets Managerにパスワード登録

```bash
AD_SECRET_ARN=$(aws secretsmanager create-secret \
  --name perm-rag-demo-ad-password \
  --secret-string '{"password":"<AD_PASSWORD>"}' \
  --region ap-northeast-1 \
  --query 'ARN' --output text)
echo "Secret ARN: $AD_SECRET_ARN"
```

#### Step 2: EmbeddingStackデプロイ

```bash
npx cdk deploy ${STACK_PREFIX}-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=$AD_SECRET_ARN \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local \
  --require-approval never
```

#### Step 3: Dockerイメージのビルドとプッシュ

EC2上にDockerがない場合はCodeBuildを使用します。

```bash
# ECRリポジトリURI取得
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' \
  --output text)

# CodeBuildでビルド（docker/embed/buildspec.yml使用）
# ソースをzip化してS3にアップロード
pushd docker/embed && zip -r /tmp/embed-source.zip . -x "node_modules/*" && popd
aws s3 cp /tmp/embed-source.zip s3://<DATA_BUCKET>/codebuild/embed-source.zip

# CodeBuildプロジェクト作成・実行（初回のみ）
aws codebuild start-build --project-name embed-image-builder --region ap-northeast-1
```

Docker環境がある場合は直接ビルド可能です:

```bash
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

#### Step 4: CIFS共有の作成

FSx ONTAP管理パスワードを設定し、REST APIでCIFS共有を作成します。

```bash
# FSx管理パスワード設定
FS_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`FileSystemId`].OutputValue' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword":"<ADMIN_PASSWORD>"}' \
  --region ap-northeast-1

# SVM UUID取得（REST API用）
MGMT_IP=$(aws fsx describe-file-systems --file-system-ids $FS_ID \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# EC2からONTAP REST APIでCIFS共有作成（SSM経由）
# SVM UUIDを取得
SVM_UUID=$(curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/svm/svms" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][0]['uuid'])")

# CIFS共有作成
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  -X POST "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H "Content-Type: application/json" \
  -d "{\"svm\":{\"uuid\":\"${SVM_UUID}\"},\"name\":\"data\",\"path\":\"/data\"}"
```

#### Step 5: CIFSマウントとデータ投入

```bash
# Embedding EC2にSSM接続
EMBED_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingInstanceId`].OutputValue' --output text)

# CIFSマウント
SMB_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

sudo mkdir -p /mnt/cifs-data
sudo mount -t cifs //${SMB_IP}/data /mnt/cifs-data \
  -o user=Admin,password=<AD_PASSWORD>,domain=demo.local,iocharset=utf8

# ドキュメント投入（demo-data/documentsと同じ構造）
sudo mkdir -p /mnt/cifs-data/{public,confidential,restricted}
# 各ドキュメントと.metadata.jsonをコピー
```

#### Step 6: OpenSearch Serverless データアクセスポリシー更新

Embedding EC2のIAMロールをAOSSデータアクセスポリシーに追加する必要があります。

```bash
# 現在のポリシーバージョン取得
POLICY_VERSION=$(aws opensearchserverless get-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --query 'accessPolicyDetail.policyVersion' --output text --region ap-northeast-1)

# Embedding EC2ロールを追加したポリシーで更新
# Principal配列に "arn:aws:iam::<ACCOUNT_ID>:role/<prefix>-embedding-role" を追加
aws opensearchserverless update-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --policy-version "$POLICY_VERSION" \
  --policy '<updated_policy_json>' \
  --region ap-northeast-1
```

#### Step 7: Embeddingコンテナ実行

```bash
# ECRからイメージをプル
sudo aws ecr get-login-password --region ap-northeast-1 | \
  sudo docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
sudo docker pull ${ECR_URI}:latest

# コンテナ実行
sudo docker run -d --name embed-app \
  -v /mnt/cifs-data:/opt/netapp/ai/data \
  -v /tmp/embed-db:/opt/netapp/ai/db \
  -e ENV_REGION=ap-northeast-1 \
  -e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME=<COLLECTION_NAME> \
  -e ENV_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0 \
  -e ENV_INDEX_NAME=bedrock-knowledge-base-default-index \
  ${ECR_URI}:latest

# ログ確認
sudo docker logs -f embed-app
```

### Embeddingアプリケーション構成

```
docker/embed/
├── Dockerfile          # node:22-slim ベース、cifs-utils含む
├── package.json        # AWS SDK v3, chokidar, dotenv
├── tsconfig.json
├── buildspec.yml       # CodeBuild用ビルド定義
├── .env                # デフォルト環境変数
└── src/
    ├── index.ts        # メイン: ドキュメントスキャン→チャンク分割→Embedding→インデックス
    └── oss-client.ts   # OpenSearch Serverless SigV4署名クライアント（IMDS認証対応）
```

### 処理フロー

1. CIFSマウントされたディレクトリを再帰スキャン（.md, .txt, .html等）
2. 各ドキュメントの `.metadata.json` からSID情報を読み取り
3. テキストを1000文字チャンク（200文字オーバーラップ）に分割
4. Bedrock Titan Embed Text v2で1024次元ベクトルを生成
5. Bedrock KB互換フォーマットでOpenSearch Serverlessにインデックス
6. 処理済みファイルを `processed.json` に記録（差分処理対応）

---

## 7. API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/auth/signin` | サインイン（Cognito認証） |
| POST | `/api/auth/signout` | サインアウト |
| GET | `/api/auth/session` | セッション情報取得 |
| GET | `/api/bedrock/models` | 利用可能モデル一覧 |
| POST | `/api/bedrock/chat` | チャット |
| POST | `/api/bedrock/kb/retrieve` | RAG検索（SIDフィルタリング付き） |
| GET | `/api/health` | ヘルスチェック |

---

## 8. セットアップ手順（デプロイ後）

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 1. リソースID取得
COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPoolId`)].OutputValue' --output text)
USER_ACCESS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
DATA_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
BEDROCK_KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 2. テストユーザー作成
export COGNITO_USER_POOL_ID
bash demo-data/scripts/create-demo-users.sh

# 3. SIDデータ登録（アプリのJWTではメールアドレスがuserIdとして使用される）
export USER_ACCESS_TABLE_NAME
bash demo-data/scripts/setup-user-access.sh

# 4. テストデータアップロード
export DATA_BUCKET_NAME
bash demo-data/scripts/upload-demo-data.sh

# 5. KB同期
export BEDROCK_KB_ID
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## 9. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| サインインできない | Cognitoユーザー未作成 | `create-demo-users.sh` を実行 |
| KB検索で結果が返らない | データソース未同期 | `sync-kb-datasource.sh` を実行 |
| 全ドキュメントが拒否される | SIDデータ未登録 | `setup-user-access.sh` を実行 |
| SVM AD参加がMISCONFIGURED | OU未指定 or SG不足 | OU path明示指定 + FSx/AD SG間の通信許可 |
| Embedding 403 Forbidden | AOSSデータアクセスポリシー不足 | Embedding EC2ロールをAOSSポリシーに追加 |
| Embeddingコンテナで認証エラー | IMDS hop limit不足 | EC2メタデータhop limit=2を確認 |
| ページが表示されない | CloudFrontキャッシュ | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Cold Start遅延 | Lambda初回起動 | 10-15秒待機（正常動作） |


---

## 環境の削除

### 削除時の注意事項

`cdk destroy --all`で全リソースを削除できますが、以下の依存関係により手動介入が必要な場合があります。

| 問題 | 原因 | 対処 |
|------|------|------|
| AIスタック削除失敗 | KBにデータソースが残っている | データソースを先に削除 |
| Storageスタック削除失敗 | S3 APがボリュームにアタッチ | S3 APを先にデタッチ・削除 |
| Networkingスタック削除失敗 | AD Controller SGが孤立 | SGを手動削除 |
| Embeddingスタック未認識 | CDKコンテキストに依存 | 手動で先に削除 |

### 推奨削除手順

```bash
# 1. Embeddingスタック削除（存在する場合）
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null

# 2. KBデータソース削除
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ]; then
  for DS_ID in $(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null); do
    aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
  done
  sleep 10
fi

# 3. S3 AP削除
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1 2>/dev/null
sleep 30

# 4. CDK destroy
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force

# 5. 孤立AD SG削除（Managed AD使用時）
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region ap-northeast-1 \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null)
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
    --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region ap-northeast-1
  done
  # Networkingスタック削除を再試行
  aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
  aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
fi
```
