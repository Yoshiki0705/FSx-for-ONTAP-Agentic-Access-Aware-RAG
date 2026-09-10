# 2026 Q2 AI 更新實作指南

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | [English](../en/2026q2-update-hands-on-guide.md) | [한국어](../ko/2026q2-update-hands-on-guide.md) | [简体中文](../zh-CN/2026q2-update-hands-on-guide.md) | **繁體中文** | [Français](../fr/2026q2-update-hands-on-guide.md) | [Deutsch](../de/2026q2-update-hands-on-guide.md) | [Español](../es/2026q2-update-hands-on-guide.md)

**建立日期**: 2026-06-07  
**預計時間**: 約 60 分鐘  
**讀者**: 想親自體驗新功能的開發者與合作夥伴

---

## 概述

本指南帶你體驗 2026 Q2 AI 更新（Phase 0-5）新增的功能。在既有部署環境上逐步啟用各項功能並確認其行為。

---

## 前提條件

- 已部署的 Permission-aware RAG 環境
- 已設定 AWS CLI
- Node.js 22+, npm

---

## Step 1：確認模型更新（5 分鐘）

確認 Phase 0 中更新的模型 ID 是否如預期運作。

```bash
# 檢視目前的模型設定
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# 期望值：
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

在聊天介面送出查詢，確認回應中繼資料的 `modelId` 為新模型。

---

## Step 2：確認 Prompt Caching 效果（10 分鐘）

> **前提條件**：Prompt Caching 僅支援 **Anthropic Claude 模型**。預設設定（未選擇模型 → 回退到 Nova 2 Lite）下快取不會生效。執行以下步驟前，請在側邊欄的模型選擇中選擇 **Claude Sonnet 4.6** 或 **Claude Opus 4.8**。

在同一工作階段中連續送出查詢，確認快取命中。

```bash
# 1. 在聊天介面提出問題
# 2. 5 分鐘內提出第二個問題
# 3. 在 CloudWatch Logs 中確認：
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# 期望的日誌：
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

透過 CloudWatch 指標確認：
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

## Step 3：Automated Reasoning Guardrails（15 分鐘）

刻意觸發權限違規，確認 Automated Reasoning 會攔截。

```bash
# 1. 啟用 Guardrails 部署
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=true

# 2. 在聊天介面嘗試超出權限邊界的查詢
#    例：以一般使用者帳號詢問僅管理員可見的文件
#    → 確認回傳「該回答已受安全政策限制」之類的提示

# 3. 確認 Guardrail 介入日誌
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailAction"' \
  --region ap-northeast-1
```

---

## Step 4：AgentCore Gateway + Permission Interceptor（15 分鐘）

```bash
# 1. 啟用 Gateway 部署
npx cdk deploy --all -c enableAgentCoreGateway=true

# 2. 從堆疊輸出取得 Gateway URL
aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayUrl`].OutputValue' \
  --output text

# 3. 確認 Interceptor Lambda 的日誌
aws logs tail "/aws/lambda/${PREFIX}-permission-interceptor" --follow --region ap-northeast-1
```

---

## Step 5：Citations 與權限邊界確認（10 分鐘）

在聊天介面送出查詢，並檢視回應中的 Citations。

```bash
# 確認 API 回應的 citations 欄位
curl -s -X POST "${APP_URL}/api/bedrock/kb/retrieve" \
  -H 'content-type: application/json' \
  -d '{"query":"請介紹一下銷售報告","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -m json.tool

# 期望值：
# "citations": [{ "boundaryType": "verified", "permissionVerified": true, ... }]
```

---

## Step 6：Graph RAG（選用，5 分鐘）

```bash
# 1. 啟用 Graph RAG 部署（Neptune Analytics 啟動約需 10 分鐘）
npx cdk deploy --all -c enableGraphRAG=true

# 2. 確認 Neptune Analytics 端點
aws neptune-graph list-graphs --region ap-northeast-1

# 3. 對圖執行測試查詢（透過 Lambda）
# 建構文件關聯圖需要另外執行腳本
```

---

## 清理

停用新功能以節省成本：

```bash
# 停用 Graph RAG（停止 Neptune Analytics）
npx cdk deploy --all -c enableGraphRAG=false

# 停用 Gateway
npx cdk deploy --all -c enableAgentCoreGateway=false

# 停用 Guardrails
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=false
```

---

## 相關文件

- [分塊策略選型指南](chunking-strategy-guide.md)
- [成本估算工作表](cost-estimation-worksheet.md)
- [生產就緒檢查清單](production-readiness-checklist.md)
