# 2026 Q2 AI 更新实操指南

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | [English](../en/2026q2-update-hands-on-guide.md) | [한국어](../ko/2026q2-update-hands-on-guide.md) | **简体中文** | [繁體中文](../zh-TW/2026q2-update-hands-on-guide.md) | [Français](../fr/2026q2-update-hands-on-guide.md) | [Deutsch](../de/2026q2-update-hands-on-guide.md) | [Español](../es/2026q2-update-hands-on-guide.md)

**创建日期**: 2026-06-07  
**预计用时**: 约 60 分钟  
**读者**: 希望亲自体验新功能的开发者与合作伙伴

---

## 概述

本指南带你体验 2026 Q2 AI 更新（Phase 0-5）新增的功能。在既有部署环境上逐步启用各项功能并确认其行为。

---

## 前提条件

- 已部署的 Permission-aware RAG 环境
- 已配置 AWS CLI
- Node.js 22+, npm

---

## Step 1：确认模型更新（5 分钟）

确认 Phase 0 中更新的模型 ID 是否按预期工作。

```bash
# 查看当前模型配置
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# 期望值：
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

在聊天界面发送查询，确认响应元数据中的 `modelId` 为新模型。

---

## Step 2：确认 Prompt Caching 效果（10 分钟）

> **前提条件**：Prompt Caching 仅支持 **Anthropic Claude 模型**。默认配置（未选择模型 → 回退到 Nova 2 Lite）下缓存不会生效。执行以下步骤前，请在侧边栏的模型选择中选择 **Claude Sonnet 4.6** 或 **Claude Opus 4.8**。

在同一会话中连续发送查询，确认缓存命中。

```bash
# 1. 在聊天界面提交问题
# 2. 5 分钟内提交第二个问题
# 3. 在 CloudWatch Logs 中确认：
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# 期望的日志：
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

通过 CloudWatch 指标确认：
```bash
aws cloudwatch get-metric-statistics \
  --namespace "RAG/TokenUsage" \
  --metric-name "CachedInputTokens" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## Step 3：Automated Reasoning Guardrails（15 分钟）

故意触发权限违规，确认 Automated Reasoning 会拦截。

```bash
# 1. 启用 Guardrails 部署
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=true

# 2. 在聊天界面尝试超出权限边界的查询
#    例：以普通用户账号询问仅管理员可见的文档
#    → 确认返回“该回答已受安全策略限制”之类的提示

# 3. 确认 Guardrail 介入日志
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailAction"' \
  --region ap-northeast-1
```

---

## Step 4：AgentCore Gateway + Permission Interceptor（15 分钟）

```bash
# 1. 启用 Gateway 部署
npx cdk deploy --all -c enableAgentCoreGateway=true

# 2. 从堆栈输出中获取 Gateway URL
aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayUrl`].OutputValue' \
  --output text

# 3. 确认 Interceptor Lambda 的日志
aws logs tail "/aws/lambda/${PREFIX}-permission-interceptor" --follow --region ap-northeast-1
```

---

## Step 5：Citations 与权限边界确认（10 分钟）

在聊天界面发送查询，并查看响应中的 Citations。

```bash
# 确认 API 响应的 citations 字段
curl -s -X POST "${APP_URL}/api/bedrock/kb/retrieve" \
  -H 'content-type: application/json' \
  -d '{"query":"请介绍一下销售报告","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -m json.tool

# 期望值：
# "citations": [{ "boundaryType": "verified", "permissionVerified": true, ... }]
```

---

## Step 6：Graph RAG（可选，5 分钟）

```bash
# 1. 启用 Graph RAG 部署（Neptune Analytics 启动约需 10 分钟）
npx cdk deploy --all -c enableGraphRAG=true

# 2. 确认 Neptune Analytics 端点
aws neptune-graph list-graphs --region ap-northeast-1

# 3. 对图执行测试查询（通过 Lambda）
# 构建文档关联图需要单独执行脚本
```

---

## 清理

停用新功能以节省成本：

```bash
# 停用 Graph RAG（停止 Neptune Analytics）
npx cdk deploy --all -c enableGraphRAG=false

# 停用 Gateway
npx cdk deploy --all -c enableAgentCoreGateway=false

# 停用 Guardrails
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=false
```

---

## 相关文档

- [分块策略选型指南](chunking-strategy-guide.md)
- [成本估算工作表](cost-estimation-worksheet.md)
- [生产就绪检查清单](production-readiness-checklist.md)
