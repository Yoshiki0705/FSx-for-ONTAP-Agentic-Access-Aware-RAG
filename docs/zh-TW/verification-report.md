# 驗證指南

**🌐 Language:** [日本語](../verification-report.md) | [English](../en/verification-report.md) | [한국어](../ko/verification-report.md) | [简体中文](../zh-CN/verification-report.md) | **繁體中文** | [Français](../fr/verification-report.md) | [Deutsch](../de/verification-report.md) | [Español](../es/verification-report.md)

本文件說明 CDK 部署後驗證系統正常運作的程序。

---

## 1. 驗證 CDK 部署結果

確認所有 6 個堆疊處於 `CREATE_COMPLETE` 或 `UPDATE_COMPLETE` 狀態。

```bash
# 根據 projectName 變更前綴（例如：perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| 堆疊 | 區域 | 主要資源 |
|------|------|---------|
| WafStack | us-east-1 | WebACL（6 條規則）、IP Set |
| NetworkingStack | ap-northeast-1 | VPC、子網路、安全群組 |
| SecurityStack | ap-northeast-1 | Cognito User Pool、Client |
| StorageStack | ap-northeast-1 | FSx ONTAP、S3、DynamoDB×2、AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB、S3 Vectors / OpenSearch Serverless（透過 `vectorStoreType` 選擇）、Bedrock Agent（選用） |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter)、CloudFront |

---

## 2. 擷取資源 ID

部署後，從 CloudFormation 輸出擷取資源 ID，用於後續驗證步驟。

```bash
# 堆疊前綴（配合 cdk.context.json 的 projectName-environment）
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

## 3. Web 應用程式 HTTP 驗證

```bash
# 確認登入頁面回傳 200
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# 透過 CloudFront
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

預期結果：`HTTP 200` 且 Content-Length 非零。

---

## 4. 認證驗證

```bash
# 登入（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# 確認工作階段
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

預期結果：回應包含 `role: "administrator"`。

---

## 5. SID 過濾驗證

四個測試案例確認 SID 過濾正常運作。

### 測試 1：管理員 → 機密文件（允許）

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

預期結果：`financial-report.md` 為 ALLOW。

### 測試 2：一般使用者 → 機密文件（拒絕）

```bash
# 以一般使用者登入
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

預期結果：`financial-report.md` 為 DENY。

### 測試 3：一般使用者 → 公開文件（允許）

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

預期結果：`product-catalog.md` 為 ALLOW。

### 測試 4：管理員 → 公開文件（允許）

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

預期結果：`product-catalog.md` 為 ALLOW。

---

## 6. 規格實作狀態

| # | 規格 | 狀態 | 備註 |
|---|------|------|------|
| 1 | Next.js RAG Chatbot on Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF（IP/Geo 防護） | ✅ | 6 條規則 + 地理限制 |
| 3 | API IAM 認證 | ⚠️ | CDK 程式碼使用 IAM Auth + OAC 設定。POST 請求的 SigV4 簽署問題（見下方） |
| 4 | 向量資料庫 | ✅ | S3 Vectors（預設）/ OpenSearch Serverless（透過 `vectorStoreType` 選擇） |
| 5 | Embedding（透過 Bedrock KB） | ✅ | Titan Embeddings v2 |
| 6 | 基於 SID 的權限過濾 | ✅ | DynamoDB + 中繼資料 SID 比對 |

### IAM 認證的已知限制

在 CloudFront OAC + Lambda Function URL IAM 認證的組合下，POST 請求的 SigV4 簽署無法正確計算（CloudFront 不會自動計算 POST 主體的 SHA256 雜湊）。

- CDK 程式碼中維持 IAM Auth 設定
- 在驗證環境中，可將 Function URL AuthType 變更為 NONE，並以 WAF + 地理限制進行防護
- 在生產環境中，用戶端需要包含 `x-Amz-Content-Sha256` 標頭

---

## 7. WebApp 容器更新程序

前端程式碼變更後更新 Lambda 容器映像的程序。

```bash
# 變數設定（根據環境變更）
ACCOUNT_ID="<ACCOUNT_ID>"
FUNCTION_NAME="<LAMBDA_FUNCTION_NAME>"
DISTRIBUTION_ID="<CLOUDFRONT_DISTRIBUTION_ID>"
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"

# 1. ECR 認證
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. Docker 映像建構 & 推送
docker build --no-cache \
  -t permission-aware-rag-webapp:${IMAGE_TAG} \
  -f docker/nextjs/Dockerfile docker/nextjs/

docker tag permission-aware-rag-webapp:${IMAGE_TAG} \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

docker push \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

# 3. 更新 Lambda 函數映像
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG} \
  --region ap-northeast-1

aws lambda wait function-updated \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 4. 容器重新整理（強制更新舊容器快取）
aws lambda put-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1 \
  --reserved-concurrent-executions 0
sleep 15
aws lambda delete-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 5. CloudFront 快取失效
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} --paths "/*"
```

---

## 8. KB Retrieve API 模型相容性

Bedrock KB `RetrieveAndGenerate` API 僅支援 Anthropic 模型。KB Retrieve API（`route.ts`）對前端傳送的模型 ID 執行以下自動轉換。

| 傳送的模型 | 轉換為 | 原因 |
|-----------|--------|------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Nova 模型不受 KB API 支援 |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | 移除推論設定檔前綴 |
| `anthropic.claude-3-haiku-20240307-v1:0` | 維持原樣 | 不需要轉換 |

實作：`docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`

---

## 9. Bedrock Agent 驗證（enableAgent=true）

### 驗證 Agent 建立

```bash
# 取得 Agent ID 和 Alias ID
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Permission-aware Action Group 驗證

```bash
LAMBDA_URL="<Lambda Function URL>"

# 管理員測試（可存取所有文件）
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"admin@example.com","sessionId":"test-admin","action":"invoke"}'

# 一般使用者測試（僅公開文件）
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"user@example.com","sessionId":"test-user","action":"invoke"}'
```

### 預期結果

| 使用者 | Action Group SID 過濾 | Agent 回應 |
|--------|----------------------|-----------|
| admin@example.com | 6/6 允許（SID：3） | 包含財務數據的詳細回應 |
| user@example.com | 2/6 允許（SID：2） | 「無法揭露詳情」等 |

### 檢查 Action Group Lambda 日誌

```bash
# 確認最新日誌
aws logs get-log-events \
  --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
    --order-by LastEventTime --descending --limit 1 \
    --region ap-northeast-1 --query 'logStreams[0].logStreamName' --output text) \
  --region ap-northeast-1 --query 'events[].message' --output text | grep "PermSearch"
```

預期日誌：
```
[PermSearch] KB: 6 SIDs: 3        # admin：3 個 SID
[PermSearch] Allowed: 6 / 6       # admin：所有文件允許

[PermSearch] KB: 6 SIDs: 2        # user：2 個 SID
[PermSearch] Allowed: 2 / 6       # user：僅公開文件
```

### UI 驗證

1. 在瀏覽器中存取 CloudFront URL
2. 以 admin@example.com 登入
3. 點擊標題列中的「🤖 Agent」按鈕 → 切換至 Agent 模式
4. 在側邊欄選擇 Agent
5. 點擊工作流程「📊 財務報告分析」→ 提示詞自動填入
6. 送出 → 確認 Agent 回應包含財務資料
7. 登出 → 以 user@example.com 登入
8. 詢問相同問題 → 確認不包含機密資料