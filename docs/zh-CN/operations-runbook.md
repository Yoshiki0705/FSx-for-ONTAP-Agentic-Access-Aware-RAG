# 运维 Runbook

**🌐 语言:** [日本語](../operations-runbook.md) | [English](../en/operations-runbook.md) | **简体中文**

**创建日期**: 2026-06-08  
**状态**: 运营中  
**受众**: 运维人员、开发者、合作伙伴

---

## 概述

整合 Permission-aware RAG 系统日常运维、验证及故障排除流程的 Runbook。将部署验证中获得的知识系统化为可重现的操作流程。

---

## 1. ONTAP 版本检查

### 背景

S3 Access Points 需要 ONTAP 9.14.1 以上版本。FSx for ONTAP AWS API（`describe-file-systems`）不返回版本信息，需要直接访问 ONTAP REST API。

### 前提条件

- FSx Management 端点 IP（例：`10.0.3.72`）
- `fsxadmin` 密码（存储在 Secrets Manager 中）
- 同一 VPC 内启用 SSM 的实例（Management 端点仅限 Private IP）

### 操作步骤

```bash
# Step 1: Retrieve fsxadmin password from Secrets Manager
FSX_PASS=$(aws secretsmanager get-secret-value \
  --secret-id fsx-ontap-fsxadmin-credentials \
  --region ap-northeast-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['password'])")

# Step 2: Access ONTAP REST API from instance in same VPC
INSTANCE_ID="<SSM-enabled-instance-id>"
MGMT_IP="10.0.3.72"

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"curl -sk -u 'fsxadmin:${FSX_PASS}' 'https://${MGMT_IP}/api/cluster?fields=version'\"]" \
  --region ap-northeast-1 \
  --query 'Command.CommandId' --output text)

# Step 3: Get results (wait 5-10 seconds)
sleep 5
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region ap-northeast-1 \
  --query 'StandardOutputContent' --output text | python3 -m json.tool
```

### 预期输出

```json
{
  "version": {
    "full": "NetApp Release 9.17.1P6: Wed Mar 25 15:38:10 UTC 2026",
    "generation": 9,
    "major": 17,
    "minor": 1
  }
}
```

### 注意事项

- Management 端点 Security Group 必须允许 HTTPS（443）入站
- SSM 实例 IAM 角色不需要 `secretsmanager:GetSecretValue` 权限（密码在本地获取后嵌入 SSM 命令）
- `curl -sk`：`-s`（静默模式），`-k`（允许自签名证书）

---

## 2. Industry-Packs 演示数据导入

### 背景

7 个行业 × 5 个文档 = 35 个文档 + 35 个元数据文件，用于跨行业 Permission-aware RAG 演示。

### 操作步骤

```bash
S3AP_ALIAS="<S3 AP Alias>"
KB_ID="<Knowledge Base ID>"
DS_ID="<DataSource ID>"

# Step 1: Upload industry-packs via S3 AP
aws s3 sync demo-data/industry-packs/ \
  "s3://${S3AP_ALIAS}/industry-packs/" \
  --region ap-northeast-1 \
  --exclude "README.md" --exclude "DISCLAIMER.md"

# Step 2: Verify upload
aws s3 ls "s3://${S3AP_ALIAS}/industry-packs/" --recursive --region ap-northeast-1 | wc -l
# Expected: 70 files

# Step 3: Trigger KB sync (ingestion)
JOB_ID=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.ingestionJobId' --output text)

# Step 4: Wait for completion
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID --region ap-northeast-1 \
    --query 'ingestionJob.status' --output text)
  echo "[$i] $STATUS"
  if [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ]; then break; fi
done
```

### 行业 SID 映射

| 行业 | 文件夹 | SID（Domain Admins 之外） |
|------|--------|------------------------|
| 建筑 | `construction/` | `-8100` |
| 教育 | `education/` | `-2200` |
| 政府 | `government/` | `-2100` |
| 医疗 | `healthcare/` | `-2200` |
| 保险 | `insurance/` | `-8200` |
| 法律 | `legal/` | `-8300` |
| 制造 | `manufacturing/` | `-2300` |

---

## 3. WebApp Docker 构建与部署

### 背景

源代码变更后，Docker 层缓存会复用旧的源文件。默认使用 `--no-cache` 可解决此问题。

### 推荐流程

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### 故障排除：变更未生效

| 原因 | 检查方法 | 解决方案 |
|------|----------|----------|
| Docker 层缓存 | `docker images` 时间戳 | 使用 `--no-cache` 重新构建 |
| ECR `latest` 标签过期 | `aws ecr describe-images` digest | 使用显式标签 |
| Lambda 仍在更新中 | `get-function` LastUpdateStatus | `wait function-updated` |
| CloudFront 缓存 | 浏览器 DevTools 网络选项卡 | `create-invalidation` |
| `.next` 缓存 | `docker/nextjs/.next/` 是否存在 | `rm -rf docker/nextjs/.next` 后重新构建 |

---

## 4. Permission Filter 调试

### 验证步骤

```bash
# Check user SIDs in DynamoDB
aws dynamodb get-item \
  --table-name "<user-access-table>" \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1

# Retrieve document metadata from KB
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id $KB_ID \
  --region ap-northeast-1 \
  --retrieval-query '{"text":"test query"}' \
  --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":5}}' \
  --query 'retrievalResults[].metadata.allowed_group_sids'
```

### 元数据格式差异

| 格式 | 示例 | 解析方法 |
|------|------|----------|
| 数组 | `["S-1-1-0", "S-1-5-21-xxx-512"]` | 直接使用 |
| 逗号分隔字符串 | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| JSON 字符串 | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| 单一值 | `"S-1-1-0"` | `[value]` |

---

## 5. Prompt Caching 验证

### 前提条件

- **仅限 Anthropic Claude 模型**（不支持 Nova、OpenAI）
- 在 UI 中选择 Claude Sonnet 4.6 或 Opus 4.8
- Bedrock Prompt Cache TTL：5 分钟（ephemeral）

### 检查流程

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### 缓存未生效？

| 原因 | 检查方法 |
|------|----------|
| 使用 Nova / OpenAI 模型 | 检查响应中的 `modelId` |
| 系统提示词 < 2048 字符 | 检查 `prompt-templates.ts` 大小 |
| 查询间隔 > 5 分钟 | 检查 CloudWatch 日志时间戳 |
| 不同用户会话 | Prompt Cache 按用户×模型隔离 |

---

## 6. 完整部署验证清单

```bash
# === Basic Operation ===
# [ ] CDK deploy all stacks success
# [ ] Lambda update confirmed
# [ ] CloudFront health check

# === Permission-Aware RAG ===
# [ ] KB Retrieve (admin SID — full access)
# [ ] KB Retrieve (regular user SID — restricted)
# [ ] Fail-Closed (no metadata → access denied)

# === Model & Routing ===
# [ ] Default model (Nova 2 Lite) response
# [ ] Claude model Prompt Caching
# [ ] Smart Routing Auto Mode

# === UI/UX ===
# [ ] Sign-in page
# [ ] Chat input & response
# [ ] Citation display
# [ ] Permission badge
# [ ] Model indicator

# === Audit & Security ===
# [ ] CloudWatch Logs output
# [ ] DynamoDB user access table
# [ ] EMF metrics (RAG/TokenUsage, SmartRouting)
```

---

## 相关文档

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — 按错误分类的解决方案
- [Production Readiness Checklist](../production-readiness-checklist.md) — 投产前要求
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — 月度成本估算
- [metadata-json-schema](../metadata-json-schema.md) — .metadata.json 正式规范
