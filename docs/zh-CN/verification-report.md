# 验证指南

**🌐 Language:** [日本語](../verification-report.md) | [English](../en/verification-report.md) | [한국어](../ko/verification-report.md) | **简体中文** | [繁體中文](../zh-TW/verification-report.md) | [Français](../fr/verification-report.md) | [Deutsch](../de/verification-report.md) | [Español](../es/verification-report.md)

本文档描述了 CDK 部署后验证系统是否正常运行的步骤。

---

## 1. 验证 CDK 部署结果

确认所有 6 个堆栈处于 `CREATE_COMPLETE` 或 `UPDATE_COMPLETE` 状态。

```bash
# projectNameに合わせてプレフィックスを変更（例: perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| 堆栈 | 区域 | 关键资源 |
|-------|--------|---------------|
| WafStack | us-east-1 | WebACL（6 条规则）、IP Set |
| NetworkingStack | ap-northeast-1 | VPC、子网、安全组 |
| SecurityStack | ap-northeast-1 | Cognito User Pool、Client |
| StorageStack | ap-northeast-1 | FSx ONTAP、S3、DynamoDB×2、AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB、S3 Vectors / OpenSearch Serverless（通过 `vectorStoreType` 选择）、Bedrock Agent（可选） |
| WebAppStack | ap-northeast-1 | Lambda（Web Adapter）、CloudFront |

---

## 2. 获取资源 ID

部署后，从 CloudFormation 输出中获取资源 ID，用于后续验证步骤。

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

## 3. Web 应用程序 HTTP 验证

```bash
# サインインページが200を返すことを確認
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront経由
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

预期结果：`HTTP 200`，Content-Length 不为零。

---

## 4. 认证验证

```bash
# サインイン（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# セッション確認
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

预期结果：响应中包含 `role: "administrator"`。

---

## 5. SID 过滤验证

四个测试用例，确认 SID 过滤功能正常工作。

### 测试 1：管理员 → 机密文档（ALLOW）

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

预期结果：`financial-report.md` 为 ALLOW。

### 测试 2：普通用户 → 机密文档（DENY）

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

预期结果：`financial-report.md` 为 DENY。

### 测试 3：普通用户 → 公开文档（ALLOW）

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

预期结果：`product-catalog.md` 为 ALLOW。

### 测试 4：管理员 → 公开文档（ALLOW）

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

预期结果：`product-catalog.md` 为 ALLOW。

---

## 6. 规格实现状态

| # | 规格 | 状态 | 备注 |
|---|---------------|--------|-------|
| 1 | Next.js RAG Chatbot on Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF（IP/Geo 防护） | ✅ | 6 条规则 + 地理限制 |
| 3 | API IAM 认证 | ⚠️ | CDK 代码使用 IAM Auth + OAC 配置。POST 请求的 SigV4 签名存在问题（见下文） |
| 4 | 向量数据库 | ✅ | S3 Vectors（默认）/ OpenSearch Serverless（通过 `vectorStoreType` 选择） |
| 5 | Embedding（通过 Bedrock KB） | ✅ | Titan Embeddings v2 |
| 6 | 基于 SID 的权限过滤 | ✅ | DynamoDB + 元数据 SID 匹配 |

### IAM 认证的已知限制

在 CloudFront OAC + Lambda Function URL IAM 认证的组合中，存在 POST 请求的 SigV4 签名无法正确计算的问题（CloudFront 不会自动计算 POST 请求体的 SHA256 哈希值）。

- CDK 代码中保留了 IAM Auth 配置
- 在验证环境中，可以将 Function URL AuthType 更改为 NONE，并通过 WAF + 地理限制进行保护
- 在生产环境中，客户端需要包含 `x-Amz-Content-Sha256` 头

---

## 7. WebApp 容器更新步骤

前端代码变更后更新 Lambda 容器镜像的步骤。

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

## 8. KB Retrieve API 模型兼容性

Bedrock KB `RetrieveAndGenerate` API 仅支持 Anthropic 模型。KB Retrieve API（`route.ts`）对前端发送的模型 ID 执行以下自动转换。

| 发送的模型 | 转换为 | 原因 |
|------------|-------------|--------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Nova 模型不受 KB API 支持 |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | 移除推理配置文件前缀 |
| `anthropic.claude-3-haiku-20240307-v1:0` | 保持不变 | 无需转换 |

实现位置：`docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Bedrock Agent 验证（enableAgent=true）

### 验证 Agent 创建

```bash
# Agent IDとAlias IDを取得
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Permission-aware Action Group 验证

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

### 预期结果

| 用户 | Action Group SID 过滤 | Agent 响应 |
|------|------------------------|----------------|
| admin@example.com | 6/6 允许（SID：3 个） | 包含财务数据的详细响应 |
| user@example.com | 2/6 允许（SID：2 个） | "无法披露详情"等 |

### 检查 Action Group Lambda 日志

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

预期日志：
```
[PermSearch] KB: 6 SIDs: 3        # admin: 3 个 SID
[PermSearch] Allowed: 6 / 6       # admin: 所有文档允许

[PermSearch] KB: 6 SIDs: 2        # user: 2 个 SID
[PermSearch] Allowed: 2 / 6       # user: 仅公开文档
```

### UI 验证

1. 在浏览器中访问 CloudFront URL
2. 以 admin@example.com 登录
3. 点击头部的"🤖 Agent"按钮 → 切换到 Agent 模式
4. 在侧边栏中选择一个 Agent
5. 点击工作流"📊 财务报告分析" → 提示词自动填充
6. 提交 → 确认 Agent 响应包含财务数据
7. 退出登录 → 以 user@example.com 登录
8. 提出相同问题 → 确认不包含机密数据
