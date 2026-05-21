# 安全实验指南

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | [English](../en/safe-experimentation-guide.md) | [한국어](../ko/safe-experimentation-guide.md) | **简体中文** | [繁體中文](../zh-TW/safe-experimentation-guide.md) | [Français](../fr/safe-experimentation-guide.md) | [Deutsch](../de/safe-experimentation-guide.md) | [Español](../es/safe-experimentation-guide.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标读者**: PoC 用户、开发人员、评估人员

---

## 概述

本文档提供了安全实验 Permission-aware RAG 系统的范围定义、禁止操作和回滚流程。明确了"在负责任 AI 策略和安全边界内可以反复试错的环境。"

---

## 安全实验范围

### ✅ 推荐：仅使用演示数据实验

| 操作 | 风险 | 备注 |
|------|------|------|
| 使用演示数据进行搜索测试 | 无 | 使用内置示例数据验证操作 |
| 通过用户切换验证权限 | 无 | 确认 admin / user 之间的搜索结果差异 |
| Agent 模式实验 | 无 | 在 Agent Directory 中创建和测试 Agent |
| UI 自定义 | 无 | Next.js 源代码变更 |
| CDK 参数变更 | 低 | `cdk.context.json` 变更 → 重新部署 |
| 添加新文档 | 低 | 添加到演示数据文件夹 |
| Guardrails 策略调整 | 低 | `guardrailsConfig` 变更 |
| Smart Routing 开/关 | 无 | 侧边栏切换 |
| 模型选择变更 | 低 | 可能产生成本变化 |
| 语音聊天实验 | 低 | 通过 `enableVoiceChat=true` 启用 |

### ⚠️ 注意：真实数据导入前的检查清单

在导入实际业务数据前验证以下事项：

- [ ] **数据分类完成**：待导入数据的机密级别已分类
- [ ] **PII 验证**：如包含个人信息，掩码或审批已完成
- [ ] **权限设计验证**：`.metadata.json` 中的 `allowed_group_sids` 已正确配置
- [ ] **审计日志启用**：CloudWatch Logs / CloudTrail 已启用
- [ ] **访问限制验证**：WAF / 地理限制 / IP 限制已适当配置
- [ ] **备份验证**：FSx 自动备份已启用
- [ ] **用户通知**：PoC 参与者已被告知数据处理规则
- [ ] **数据删除流程确认**：PoC 完成后的数据删除流程已确认

### ❌ 禁止操作

| 禁止操作 | 原因 | 替代方案 |
|----------|------|----------|
| 直接连接生产 AD（PoC 阶段） | 影响生产环境的风险 | 使用测试 AD / Cognito 邮箱认证 |
| 导入未经 PII 分类的数据 | 个人信息泄露风险 | PII 扫描后导入 |
| 在未启用审计日志的情况下使用机密数据 | 合规违规 | 启用审计日志后导入 |
| 在未加密的情况下存储机密数据 | 数据泄露风险 | 设置 `enableKmsEncryption=true` |
| 允许从公共互联网访问 | 未授权访问风险 | 使用 IP 限制 / VPN |
| 在生产账户中运行 PoC | 影响生产环境 | 使用沙箱账户 |
| 在禁用 Guardrails 的情况下使用机密数据 | 不当回答生成风险 | 设置 `enableGuardrails=true` |

---

## 仅使用演示数据的实验流程

### 步骤 1：使用最小配置部署

```bash
# 最小 cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# 部署
npx cdk deploy --all --require-approval never

# 测试数据 + 用户创建
bash demo-data/scripts/post-deploy-setup.sh
```

### 步骤 2：验证操作

```bash
# 获取 CloudFront URL
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "Access URL: $URL"
```

### 步骤 3：验证权限过滤

1. 以 `admin@example.com` 登录 → 所有文档可搜索
2. 以 `user@example.com` 登录 → 仅公开文档可搜索
3. 确认相同问题返回不同答案

### 步骤 4：评估

使用 [evaluation.md](evaluation.md) 中的评估模板进行 PoC 评估。

---

## 真实数据导入流程（检查清单完成后）

### 步骤 1：数据准备

```bash
# 1. 分类文档
# 为每个文档创建 .metadata.json
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. PII 扫描（推荐）
# 使用 Amazon Comprehend 检测 PII
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### 步骤 2：数据导入

```bash
# 将文件放置到 FSx 卷（通过 SMB）
# 或使用 S3 bucket 回退路径
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### 步骤 3：KB 同步

```bash
# 执行 KB 同步
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 等待同步完成
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### 步骤 4：权限测试

```bash
# 执行权限矩阵测试
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## 回滚 / 环境删除流程

### 部分回滚（仅删除数据）

```bash
# 1. 清除 KB 数据源同步
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. 删除 S3 bucket 数据
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. 删除 DynamoDB 用户数据
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### 完全删除（所有资源）

```bash
# 1. 清空 S3 bucket（如果启用了版本控制）
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy（删除所有堆栈）
npx cdk destroy --all --force

# 3. 删除 CDK Bootstrap 资源（如需要）
# ⚠️ 如果存在其他 CDK 项目，请勿删除
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### 成本清理验证

```bash
# 检查剩余资源
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# 检查 FSx 文件系统（删除需要时间）
aws fsx describe-file-systems --region ap-northeast-1

# 检查 OpenSearch Serverless 集合
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## 故障排除

### 常见问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 部署超过 40 分钟 | FSx for ONTAP 创建需要时间 | 正常。FSx 创建需要 20–30 分钟 |
| 搜索返回 0 结果 | KB 同步未完成或数据源未配置 | 验证 `StartIngestionJob` 执行 |
| 所有用户返回相同结果 | SID 数据未注册 | 检查 DynamoDB `user-access` 表 |
| Fail-Closed 拒绝所有 | DynamoDB 连接错误或无 SID 记录 | 检查 Lambda 日志 |
| Agent 不工作 | Agent 未创建或不在 PREPARED 状态 | 在 Bedrock 控制台检查 Agent 状态 |
| 成本高于预期 | OpenSearch Serverless OCU | 切换到 `vectorStoreType=s3vectors` |

### 支持资源

| 资源 | URL |
|------|-----|
| GitHub Issues | 仓库 Issues 标签页 |
| AWS 文档（Bedrock） | https://docs.aws.amazon.com/bedrock/ |
| AWS 文档（FSx ONTAP） | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## 相关文档

| 文档 | 描述 |
|------|------|
| [evaluation.md](evaluation.md) | RAG / Agent 评估指标 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生产就绪检查清单 |
| [governance-and-audit.md](governance-and-audit.md) | 治理与审计设计 |
| [permission-consistency.md](permission-consistency.md) | 权限变更一致性模型 |
