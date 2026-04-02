# Verification Guide

**🌐 Language:** [日本語](../verification-report.md) | **English** | [한국어](../ko/verification-report.md) | [简体中文](../zh-CN/verification-report.md) | [繁體中文](../zh-TW/verification-report.md) | [Français](../fr/verification-report.md) | [Deutsch](../de/verification-report.md) | [Español](../es/verification-report.md)

This document describes the procedures for verifying that the system is functioning correctly after CDK deployment.

---

## 1. Verifying CDK Deployment Results

Confirm that all 6 stacks are in `CREATE_COMPLETE` or `UPDATE_COMPLETE` status.

```bash
# projectNameに合わせてプレフィックスを変更（例: perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| Stack | Region | Key Resources |
|-------|--------|---------------|
| WafStack | us-east-1 | WebACL (6 rules), IP Set |
| NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups |
| SecurityStack | ap-northeast-1 | Cognito User Pool, Client |
| StorageStack | ap-northeast-1 | FSx ONTAP, S3, DynamoDB×2, AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (selected via `vectorStoreType`), Bedrock Agent (optional) |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter), CloudFront |

---

## 2. Retrieving Resource IDs

After deployment, retrieve the resource IDs from CloudFormation outputs for use in subsequent verification steps.

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

## 3. Web Application HTTP Verification

```bash
# サインインページが200を返すことを確認
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront経由
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

Expected result: `HTTP 200` with a non-zero Content-Length.

---

## 4. Authentication Verification

```bash
# サインイン（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# セッション確認
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

Expected result: Response contains `role: "administrator"`.

---

## 5. SID Filtering Verification

Four test cases to confirm that SID filtering is working correctly.

### Test 1: Administrator → Confidential Document (ALLOW)

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

Expected: `financial-report.md` is ALLOW.

### Test 2: General User → Confidential Document (DENY)

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

Expected: `financial-report.md` is DENY.

### Test 3: General User → Public Document (ALLOW)

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

Expected: `product-catalog.md` is ALLOW.

### Test 4: Administrator → Public Document (ALLOW)

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

Expected: `product-catalog.md` is ALLOW.

---

## 6. Specification Implementation Status

| # | Specification | Status | Notes |
|---|---------------|--------|-------|
| 1 | Next.js RAG Chatbot on Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF (IP/Geo Protection) | ✅ | 6 rules + Geo restriction |
| 3 | API IAM Authentication | ⚠️ | CDK code uses IAM Auth + OAC configuration. SigV4 signing issue with POST requests (see below) |
| 4 | Vector DB | ✅ | S3 Vectors (default) / OpenSearch Serverless (selected via `vectorStoreType`) |
| 5 | Embedding (via Bedrock KB) | ✅ | Titan Embeddings v2 |
| 6 | SID-based Permission Filtering | ✅ | DynamoDB + metadata SID matching |

### Known Limitations of IAM Authentication

With the combination of CloudFront OAC + Lambda Function URL IAM authentication, there is an issue where SigV4 signatures for POST requests are not calculated correctly (CloudFront does not automatically compute the SHA256 hash of the POST body).

- IAM Auth configuration is maintained in the CDK code
- In verification environments, it is possible to change Function URL AuthType=NONE and protect with WAF + Geo restriction
- In production environments, the client side needs to include the `x-Amz-Content-Sha256` header

---

## 7. WebApp Container Update Procedure

Procedure for updating the Lambda container image after frontend code changes.

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

## 8. KB Retrieve API Model Compatibility

The Bedrock KB `RetrieveAndGenerate` API only supports Anthropic models. The KB Retrieve API (`route.ts`) performs the following automatic conversions on model IDs sent from the frontend.

| Sent Model | Converted To | Reason |
|------------|-------------|--------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Nova models are not supported by KB API |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Removes inference profile prefix |
| `anthropic.claude-3-haiku-20240307-v1:0` | As-is | No conversion needed |

Implementation: `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Bedrock Agent Verification (enableAgent=true)

### Verifying Agent Creation

```bash
# Agent IDとAlias IDを取得
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Permission-aware Action Group Verification

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

### Expected Results

| User | Action Group SID Filter | Agent Response |
|------|------------------------|----------------|
| admin@example.com | 6/6 allowed (SIDs: 3) | Detailed response including financial figures |
| user@example.com | 2/6 allowed (SIDs: 2) | "Cannot disclose details", etc. |

### Checking Action Group Lambda Logs

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

Expected logs:
```
[PermSearch] KB: 6 SIDs: 3        # admin: 3 SIDs
[PermSearch] Allowed: 6 / 6       # admin: All documents allowed

[PermSearch] KB: 6 SIDs: 2        # user: 2 SIDs
[PermSearch] Allowed: 2 / 6       # user: Public documents only
```

### UI Verification

1. Access the CloudFront URL in a browser
2. Sign in as admin@example.com
3. Click the "🤖 Agent" button in the header → Switch to Agent mode
4. Select an Agent in the sidebar
5. Click the workflow "📊 Financial Report Analysis" → Prompt is auto-filled
6. Submit → Confirm that the Agent response includes financial data
7. Sign out → Sign in as user@example.com
8. Ask the same question → Confirm that confidential data is not included
