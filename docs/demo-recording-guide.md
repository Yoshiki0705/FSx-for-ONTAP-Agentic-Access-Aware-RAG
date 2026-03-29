# 検証デモ動画 撮影手順書

**最終更新**: 2026-03-29  
**目的**: Permission Aware型RAGシステムの検証デモ動画を撮影するための手順書  
**前提**: AWSアカウント（AdministratorAccess相当）、EC2インスタンス（Ubuntu 22.04, t3.large以上, 50GB EBS）

---

## 撮影する証跡（6項目）

| # | 証跡 | 内容 |
|---|------|------|
| (1) | RAGベースAIチャットボット基盤の構築 | アーキテクチャ説明 |
| (2) | AWS CDKを用いたチャットボット基盤のデプロイ | CDKデプロイ手順 |
| (3) | ストレージデータをFSx ONTAPボリュームに配置 | S3 Access Point経由でデータ投入 |
| (4) | アクセス権情報の反映 | `.metadata.json` SID情報の設定・確認 |
| (5) | ユーザーごとのアクセス権に基づいたデータ参照可否の判定 | SIDフィルタリング検証 |
| (6) | 初期検証 | カードUI・KB/Agentモード・Citation表示の動作確認 |

---

## 事前準備

### EC2インスタンスの起動

```bash
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

### EC2に必要なツールをインストール

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io jq

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

sudo npm install -g aws-cdk typescript ts-node
```

### リポジトリのクローン

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

---

## 証跡(1): RAGベースAIチャットボット基盤の構築

**撮影内容**: システムアーキテクチャの説明

### アーキテクチャ図

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
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └──────────────────┘
```

### 説明すべき8つの構成要素

1. **Next.js RAG Chatbot on AWS Lambda** — Lambda Web Adapterでサーバーレス実行。カードベースのタスク指向UI
2. **AWS WAF** — レートリミット、IP Reputation、OWASP準拠ルール、SQLi防御
3. **IAM認証** — Lambda Function URL IAM Auth + CloudFront OAC (SigV4)
4. **OpenSearch Serverless** — ベクトル検索コレクション（1024次元、HNSW/faiss）
5. **FSx ONTAP + S3 Access Point** — S3 AP経由でBedrock KBにドキュメントを直接提供
6. **Titan Embed Text v2** — Amazon Bedrockのテキストベクトル化モデル（1024次元）
7. **SIDフィルタリング** — NTFS ACLのSID情報でドキュメントレベルのアクセス制御
8. **KB/Agentモード切替** — KBモード（文書検索）とAgentモード（動的Agent作成 + 多段階推論）

### 撮影手順

1. `docs/implementation-overview.md` を画面に表示
2. アーキテクチャ図を示しながら各コンポーネントを説明
3. CDKスタック構成（7スタック）を説明
4. SIDフィルタリングのフロー図を説明

---

## 証跡(2): AWS CDKを用いたチャットボット基盤のデプロイ

**撮影内容**: CDKデプロイの実行と完了確認

### Step 1: プリデプロイセットアップ（ECRイメージ準備）

```bash
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK

# ECRリポジトリ作成 + Dockerイメージビルド + プッシュ
bash demo-data/scripts/pre-deploy-setup.sh
```

### Step 2: CDKデプロイ（全6スタック）

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

> **所要時間**: 約30〜40分（FSx ONTAP作成に20〜30分）

### Step 3: ポストデプロイセットアップ（1コマンド）

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

自動実行内容:
1. S3 Access Point作成 + ポリシー設定
2. FSx ONTAPにデモデータアップロード（S3 AP経由）
3. Bedrock KBデータソース追加 + 同期
4. DynamoDBにユーザーSIDデータ登録
5. Cognitoにデモユーザー作成

### Step 4: デプロイ検証

```bash
bash demo-data/scripts/verify-deployment.sh
```

### 撮影ポイント

- `pre-deploy-setup.sh` の実行（ECRイメージ準備）
- `cdk deploy --all` の実行画面
- `post-deploy-setup.sh` の実行（S3 AP作成 → KB同期 → ユーザー作成）
- `verify-deployment.sh` のテスト結果

---

## 証跡(3): ストレージデータをFSx ONTAPボリュームに配置

**撮影内容**: S3 Access Point経由でのデータ投入確認

`post-deploy-setup.sh` が自動的にS3 AP経由でデモデータをアップロードしています。手動確認:

```bash
STACK_PREFIX="perm-rag-demo-demo"
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)

# S3 AP経由でファイル一覧を確認
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region ap-northeast-1
```

### 撮影ポイント

- S3 AP経由のファイル一覧表示
- ドキュメントの内容を確認（公開/機密/制限の3種類）

---

## 証跡(4): アクセス権情報の反映

**撮影内容**: `.metadata.json`によるSID情報の確認

```bash
# S3 AP経由で.metadata.jsonを確認
aws s3 cp "s3://${S3AP_ALIAS}/public/company-overview.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/confidential/financial-report.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/restricted/project-plan.md.metadata.json" - | python3 -m json.tool
```

### SIDとアクセス権の対応表

| ディレクトリ | allowed_group_sids | 管理者(admin) | 一般ユーザー(user) |
|-------------|-------------------|--------------|-------------------|
| `public/` | `S-1-1-0` (Everyone) | ✅ 閲覧可 | ✅ 閲覧可 |
| `confidential/` | `...-512` (Domain Admins) | ✅ 閲覧可 | ❌ 閲覧不可 |
| `restricted/` | `...-1100` + `...-512` | ✅ 閲覧可 | ❌ 閲覧不可 |

### 撮影ポイント

- `.metadata.json`の内容を画面に表示
- SIDの意味（Everyone, Domain Admins等）を説明

---

## 証跡(5): ユーザーごとのアクセス権に基づいたデータ参照可否の判定

**撮影内容**: 管理者と一般ユーザーで異なる検索結果が返ることの検証

### DynamoDB SIDデータの確認

```bash
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"admin@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"user@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool
```

### curlによるSIDフィルタリング検証

```bash
LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 管理者ユーザー
echo "=== admin@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} 件許可')"

# 一般ユーザー
echo "=== user@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} 件許可')"
```

### 撮影ポイント

- DynamoDBのSIDデータを画面に表示
- 管理者は全件許可、一般ユーザーは公開のみ許可であることを強調

---

## 証跡(6): 初期検証 — カードUI・KB/Agentモード・Citation表示

**撮影内容**: ブラウザでのエンドツーエンド検証

### Step 1: ブラウザでアクセス

```bash
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "アクセスURL: ${CF_URL}/ja/signin"
```

### Step 2: 管理者ユーザーでの検証（KBモード）

1. `admin@example.com` でサインイン
2. カードグリッドが表示される（14枚: 調査系8枚 + アウトプット系6枚）
3. InfoBannerに権限情報が表示される（3ディレクトリ、読み取り✅、書き込み✅）
4. 「文書検索」カードをクリック → プロンプトが入力欄に設定される
5. 「会社の売上はいくらですか？」と質問
6. 回答にCitationが表示される（FSxファイルパス + アクセスレベルバッジ）
   - `confidential/financial-report.md` — 管理者のみ（赤バッジ）
   - `public/company-overview.md` — 全員アクセス可（緑バッジ）
7. 「🔄 ワークフロー選択に戻る」ボタンでカードグリッドに戻る

### Step 3: 管理者ユーザーでの検証（Agentモード）

1. ヘッダーの「🤖 Agent」ボタンでAgentモードに切替
2. Agentモードのカードグリッドが表示される（14枚: リサーチ系8枚 + アウトプット系6枚）
3. 「財務レポート分析」カードをクリック
4. Bedrock Agentが自動検索・動的作成される（初回のみ数秒待機）
5. 質問に対してAgent応答 + Citation表示

### Step 4: 一般ユーザーでの検証

1. サインアウト → `user@example.com` でサインイン
2. InfoBannerに権限情報が表示される（1ディレクトリのみ）
3. 「会社の売上はいくらですか？」と質問
4. 回答にconfidentialドキュメントのCitationが含まれないことを確認
5. 「製品の概要を教えてください」と質問
6. publicドキュメントのCitationが表示されることを確認

### 検証結果のまとめ

| 質問 | admin | user | 理由 |
|------|-------|------|------|
| 会社の売上 | ✅ 財務レポート参照 | ❌ 公開情報のみ | financial-report.md は Domain Admins のみ |
| リモートワークポリシー | ✅ 人事ポリシー参照 | ❌ アクセス拒否 | hr-policy.md は Domain Admins のみ |
| 製品の概要 | ✅ 製品カタログ参照 | ✅ 製品カタログ参照 | product-catalog.md は Everyone |

### 撮影ポイント

- KBモード: カードグリッド → 質問 → Citation（ファイルパス + アクセスレベルバッジ）
- Agentモード: カードクリック → Agent動的作成 → 応答
- 管理者 vs 一般ユーザーの結果比較
- 「ワークフロー選択に戻る」ボタンの動作

---

## リソースの削除

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| CDKデプロイでschema version mismatch | CDK CLIバージョン不一致 | `npm install aws-cdk@latest` + `npx cdk` を使用 |
| KB検索で結果が返らない | データソース未同期 | `post-deploy-setup.sh` を再実行 |
| 全ドキュメントが拒否される | SIDデータ未登録 | `post-deploy-setup.sh` を再実行 |
| ページが表示されない | CloudFrontキャッシュ | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Docker権限エラー | dockerグループ未参加 | `sudo usermod -aG docker ubuntu && newgrp docker` |
| Agent動的作成が失敗 | Lambda IAM権限不足 | CDKで`enableAgent=true`を指定してデプロイ |
