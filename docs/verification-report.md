# 検証ガイド

本ドキュメントは、CDKデプロイ後にシステムが正しく動作していることを確認するための手順です。

---

## 1. CDKデプロイ結果の確認

6スタック全てが `CREATE_COMPLETE` または `UPDATE_COMPLETE` であることを確認します。

```bash
# projectNameに合わせてプレフィックスを変更（例: perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| Stack | リージョン | 主要リソース |
|-------|-----------|-------------|
| WafStack | us-east-1 | WebACL（6ルール）、IP Set |
| NetworkingStack | ap-northeast-1 | VPC、Subnets、Security Groups |
| SecurityStack | ap-northeast-1 | Cognito User Pool、Client |
| StorageStack | ap-northeast-1 | FSx ONTAP、S3、DynamoDB×2、AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB、S3 Vectors / OpenSearch Serverless（`vectorStoreType`で選択）、Bedrock Agent（オプション） |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter)、CloudFront |

---

## 2. リソースIDの取得

デプロイ後、以降の検証で使用するリソースIDをCloudFormation出力から取得します。

```bash
# スタックプレフィックス（cdk.context.jsonのprojectName-environmentに合わせる）
STACK_PREFIX="perm-rag-demo-demo"

# CloudFront URL
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)

# Lambda Function URL
LAMBDA_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)

# Cognito User Pool ID
COGNITO_POOL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPool`)].OutputValue' --output text)

# Knowledge Base ID
KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

echo "CloudFront: ${CF_URL}"
echo "Lambda URL: ${LAMBDA_URL}"
echo "Cognito:    ${COGNITO_POOL}"
echo "KB ID:      ${KB_ID}"
```

---

## 3. WebアプリケーションのHTTP確認

```bash
# サインインページが200を返すことを確認
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront経由
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

期待結果: `HTTP 200`、Content-Lengthが0でないこと。

---

## 4. 認証の確認

```bash
# サインイン（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# セッション確認
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

期待結果: `role: "administrator"` が返ること。

---

## 5. SIDフィルタリングの検証

SIDフィルタリングが正しく動作していることを確認する4つのテストケースです。

### テスト1: 管理者 → 機密ドキュメント（ALLOW）

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件, 拒否: {fl.get(\"deniedDocuments\",0)}件')
print(f'フィルタ方式: {fl.get(\"filterMethod\",\"N/A\")}')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

期待: `financial-report.md` が ALLOW。

### テスト2: 一般ユーザー → 機密ドキュメント（DENY）

```bash
# 一般ユーザーでサインイン
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user@example.com","password":"DemoUser123!"}' \
  -c /tmp/cookies-user.txt > /dev/null

curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies-user.txt \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件, 拒否: {fl.get(\"deniedDocuments\",0)}件')
print(f'フィルタ方式: {fl.get(\"filterMethod\",\"N/A\")}')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

期待: `financial-report.md` が DENY。

### テスト3: 一般ユーザー → 公開ドキュメント（ALLOW）

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies-user.txt \
  -d '{"query":"製品の概要を教えてください","userId":"user@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件, 拒否: {fl.get(\"deniedDocuments\",0)}件')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

期待: `product-catalog.md` が ALLOW。

### テスト4: 管理者 → 公開ドキュメント（ALLOW）

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"query":"製品の概要を教えてください","userId":"admin@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

期待: `product-catalog.md` が ALLOW。

---

## 6. 仕様の実装状況

| # | 仕様 | 状態 | 備考 |
|---|------|------|------|
| 1 | Next.js RAG Chatbot on Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF（IP/Geo保護） | ✅ | 6ルール + Geo制限 |
| 3 | API IAM認証 | ⚠️ | CDKコードはIAM Auth + OAC構成。POSTリクエストのSigV4署名問題あり（後述） |
| 4 | ベクトルDB | ✅ | S3 Vectors（デフォルト）/ OpenSearch Serverless（`vectorStoreType`で選択） |
| 5 | Embedding（Bedrock KB経由） | ✅ | Titan Embeddings v2 |
| 6 | SIDベース権限フィルタリング | ✅ | DynamoDB + メタデータSID照合 |

### IAM認証の既知の制約

CloudFront OAC + Lambda Function URL IAM認証の組み合わせでは、POSTリクエストのSigV4署名が正しく計算されない問題があります（CloudFrontがPOSTボディのSHA256ハッシュを自動計算しない）。

- CDKコード上はIAM Auth構成を維持
- 検証環境ではFunction URL AuthType=NONEに変更し、WAF + Geo制限で保護する運用が可能
- 本番環境ではクライアント側で `x-Amz-Content-Sha256` ヘッダーを付与する対応が必要

---

## 7. WebAppコンテナ更新手順

フロントエンドのコード修正後にLambdaのコンテナイメージを更新する手順です。

```bash
# 変数設定（環境に合わせて変更）
ACCOUNT_ID="<ACCOUNT_ID>"
FUNCTION_NAME="<LAMBDA_FUNCTION_NAME>"
DISTRIBUTION_ID="<CLOUDFRONT_DISTRIBUTION_ID>"
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"

# 1. ECR認証
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. Dockerイメージビルド & プッシュ
docker build --no-cache \
  -t permission-aware-rag-webapp:${IMAGE_TAG} \
  -f docker/nextjs/Dockerfile docker/nextjs/

docker tag permission-aware-rag-webapp:${IMAGE_TAG} \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

docker push \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

# 3. Lambda関数のイメージ更新
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG} \
  --region ap-northeast-1

aws lambda wait function-updated \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 4. コンテナリフレッシュ（古いコンテナキャッシュを強制更新）
aws lambda put-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1 \
  --reserved-concurrent-executions 0
sleep 15
aws lambda delete-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 5. CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} --paths "/*"
```

---

## 8. KB Retrieve APIのモデル互換性

Bedrock KB `RetrieveAndGenerate` APIはAnthropicモデルのみ対応しています。フロントエンドから送信されるモデルIDに対して、KB Retrieve API（`route.ts`）が以下の自動変換を行います。

| 送信モデル | 変換後 | 理由 |
|-----------|--------|------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Nova系はKB APIで非対応 |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | inference profileプレフィックス除去 |
| `anthropic.claude-3-haiku-20240307-v1:0` | そのまま | 変換不要 |

実装: `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Bedrock Agent検証（enableAgent=true）

### Agent作成の確認

```bash
# Agent IDとAlias IDを取得
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Permission-aware Action Groupの検証

```bash
LAMBDA_URL="<Lambda Function URL>"

# 管理者テスト（全ドキュメントアクセス可能）
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"admin@example.com","sessionId":"test-admin","action":"invoke"}'

# 一般ユーザーテスト（公開ドキュメントのみ）
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"user@example.com","sessionId":"test-user","action":"invoke"}'
```

### 期待される結果

| ユーザー | Action Group SIDフィルタ | Agent回答 |
|---------|------------------------|----------|
| admin@example.com | 6/6 allowed (SIDs: 3) | 財務数値を含む詳細な回答 |
| user@example.com | 2/6 allowed (SIDs: 2) | 「詳細を開示できません」等 |

### Action Group Lambdaログの確認

```bash
# 最新のログを確認
aws logs get-log-events \
  --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
    --order-by LastEventTime --descending --limit 1 \
    --region ap-northeast-1 --query 'logStreams[0].logStreamName' --output text) \
  --region ap-northeast-1 --query 'events[].message' --output text | grep "PermSearch"
```

期待されるログ:
```
[PermSearch] KB: 6 SIDs: 3        # admin: 3つのSID
[PermSearch] Allowed: 6 / 6       # admin: 全ドキュメント許可

[PermSearch] KB: 6 SIDs: 2        # user: 2つのSID
[PermSearch] Allowed: 2 / 6       # user: 公開ドキュメントのみ
```

### UI検証

1. ブラウザでCloudFront URLにアクセス
2. admin@example.comでサインイン
3. ヘッダーの「🤖 Agent」ボタンをクリック → Agentモードに切替
4. サイドバーでAgentを選択
5. ワークフロー「📊 財務レポート分析」をクリック → プロンプトが自動入力
6. 送信 → Agent応答に財務データが含まれることを確認
7. サインアウト → user@example.comでサインイン
8. 同じ質問 → 機密データが含まれないことを確認
