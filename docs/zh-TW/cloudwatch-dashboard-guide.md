# CloudWatch 儀表板維運指南

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | [English](../en/cloudwatch-dashboard-guide.md) | [한국어](../ko/cloudwatch-dashboard-guide.md) | [简体中文](../zh-CN/cloudwatch-dashboard-guide.md) | **繁體中文** | [Français](../fr/cloudwatch-dashboard-guide.md) | [Deutsch](../de/cloudwatch-dashboard-guide.md) | [Español](../es/cloudwatch-dashboard-guide.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標對象**: 維運團隊、SRE、平台工程師

---

## 概述

本文件為 Permission-aware RAG 系統維運監控所需的 CloudWatch 儀表板與告警的設計及導入指南。除了以 `enableMonitoring=true` 由 CDK 自動建立的儀表板外，也整理了應額外設定的指標與告警。

---

## 監控指標一覽

### RAG 搜尋效能

| 指標 | 命名空間 | 維度 | 說明 | 告警閾值 |
|------|---------|------|------|---------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | 從搜尋到回答產生的整體延遲 | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Bedrock API 呼叫次數 | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Bedrock API 錯誤次數 | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | 從 KB 取得的區塊數 | — |

### 權限控制

| 指標 | 命名空間 | 維度 | 說明 | 告警閾值 |
|------|---------|------|------|---------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | SID 過濾拒絕的文件數 | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | 快取命中率 | < 20%（異常） |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | 快取未命中率 | > 80%（異常） |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Fail-Closed 觸發次數 | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | SID 解析失敗次數 | > 0 |

### 資料同步

| 指標 | 命名空間 | 維度 | 說明 | 告警閾值 |
|------|---------|------|------|---------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | KB 同步所需時間 | > 30min |
| KB Sync Success | `KbAutoSync` | — | 同步成功次數 | — |
| KB Sync Failure | `KbAutoSync` | — | 同步失敗次數 | 連續 3 次 |
| ACL Sync Success | `PermissionAwareRAG` | — | ACL 同步成功次數 | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | ACL 同步失敗次數 | > 0 |

### Guardrails

| 指標 | 命名空間 | 維度 | 說明 | 告警閾值 |
|------|---------|------|------|---------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Guardrails 封鎖次數 | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | 所有請求中的介入率 | > 10% |

### Agent

| 指標 | 命名空間 | 維度 | 說明 | 告警閾值 |
|------|---------|------|------|---------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | 工具呼叫次數 | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Agent 執行步驟數 | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Agent 錯誤次數 | > 3/5min |

### 成本

| 指標 | 命名空間 | 維度 | 說明 | 告警閾值 |
|------|---------|------|------|---------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | 預估 Token 成本（USD） | 每日 > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | 路由目標的分佈 | — |

---

## 儀表板版面配置

```
┌─────────────────────────────────────────────────────────────────┐
│ Permission-Aware RAG Operations Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Query Latency       │  │ Bedrock Invocations  │              │
│  │ (P50/P95/P99)       │  │ (by Model)           │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Permission Denied   │  │ Cache Hit/Miss Rate  │              │
│  │ Count               │  │                      │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ KB Sync Status      │  │ Guardrails Blocked   │              │
│  │ (Success/Failure)   │  │ Count                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Agent Tool Calls    │  │ Estimated Cost       │              │
│  │ (by Tool)           │  │ Trend                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 告警定義

### Critical（即時回應）

```yaml
- AlarmName: RAG-PermissionDenyAllFallback
  MetricName: DenyAllFallbackCount
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]

- AlarmName: RAG-SIDResolutionFailure
  MetricName: SIDResolutionFailure
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 0
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]
```

### Warning（需要調查）

```yaml
- AlarmName: RAG-HighLatency
  MetricName: QueryLatency
  Namespace: PermissionAwareRAG
  ExtendedStatistic: p95
  Period: 300
  EvaluationPeriods: 3
  Threshold: 10000  # 10 seconds in ms
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-KBSyncConsecutiveFailure
  MetricName: KBSyncFailure
  Namespace: KbAutoSync
  Statistic: Sum
  Period: 900
  EvaluationPeriods: 3
  Threshold: 1
  ComparisonOperator: GreaterThanOrEqualToThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-HighCacheMissRate
  MetricName: PermissionCacheMissRate
  Namespace: PermissionAwareRAG
  Statistic: Average
  Period: 300
  EvaluationPeriods: 3
  Threshold: 80
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]
```

---

## 疑難排解模式

### 模式 1: Deny All Fallback 頻繁觸發

```
症狀: DenyAllFallbackCount 急遽增加
可能原因:
  1. DynamoDB user-access 資料表連線障礙
  2. 新使用者的 SID 資料未註冊
  3. AD Sync Lambda 執行失敗

調查步驟:
  1. 在 CloudWatch Logs 確認 Lambda 錯誤
  2. 確認 DynamoDB 資料表的節流狀況
  3. 確認 AD Sync Lambda 的最近一次執行結果
```

### 模式 2: 延遲急增

```
症狀: QueryLatency P95 超過 10 秒
可能原因:
  1. Bedrock API 節流
  2. S3 Vectors 冷啟動
  3. KB 同步期間的負載

調查步驟:
  1. 確認 Bedrock InvocationLatency
  2. 確認 S3 Vectors 的查詢延遲
  3. 確認 KB 同步作業的執行狀況
```

### 模式 3: 成本急增

```
症狀: EstimatedTokenCost 為平常的 3 倍以上
可能原因:
  1. Smart Routing 偏向高成本模型
  2. Agent 模式過度使用
  3. 非法大量請求

調查步驟:
  1. 確認 SmartRouting RoutingTier 的分佈
  2. 確認 Agent StepCount 的異常值
  3. 確認 WAF 速率限制的封鎖數
```

---

## 儀表板匯入步驟

### CDK 自動建立（建議）

```bash
# 以 enableMonitoring=true 自動建立
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### 手動匯入

```bash
# 使用 monitoring/cloudwatch-dashboard.json
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [production-readiness-checklist.md](../production-readiness-checklist.md) | 正式環境化檢查清單（監控設定項目） |
| [permission-consistency.md](../permission-consistency.md) | 權限變更時的監控建議設定 |
| [governance-and-audit.md](../governance-and-audit.md) | 稽核日誌與報告產生 |
| [threat-model.md](threat-model.md) | 威脅模型（監控應偵測的威脅） |
