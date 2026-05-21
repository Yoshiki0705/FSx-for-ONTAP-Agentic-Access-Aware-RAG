# 治理與稽核設計

**🌐 Language:** [日本語](../governance-and-audit.md) | [English](../en/governance-and-audit.md) | [한국어](../ko/governance-and-audit.md) | [简体中文](../zh-CN/governance-and-audit.md) | **繁體中文** | [Français](../fr/governance-and-audit.md) | [Deutsch](../de/governance-and-audit.md) | [Español](../es/governance-and-audit.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標讀者**: 安全長、合規長、公部門/醫療/金融業

---

## 概述

本文件整理 Permission-aware RAG 系統的稽核日誌設計、治理框架和負責任 AI 實作指南。目標是使其可解釋：「誰、何時、基於哪些文件、收到了什麼回答。」

---

## 稽核日誌結構

### RAG 搜尋稽核日誌

所有 RAG 搜尋請求都會記錄以下資訊。

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Agent 模式稽核日誌

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### 權限變更稽核日誌

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## 日誌儲存與保護架構

```
┌──────────────────────────────────────────────────────────────────┐
│                        稽核日誌流程                                 │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3（稽核日誌 Bucket）    │ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock（WORM）   │ │
│  └──────────┘    │ 保留：1 年   │    │ ・KMS 加密             │ │
│                  └──────────────┘    │ ・Lifecycle：           │ │
│                                      │   90d→IA, 365d→Glacier  │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API 呼叫 │    │ (資料事件)   │                                │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ 權限     │    │ Streams      │───▶ 權限變更稽核日誌            │
│  │ 變更     │    └──────────────┘                                │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 建議設定

| 元件 | 設定 | 用途 |
|------|------|------|
| CloudWatch Logs | 保留：1 年 | 維運日誌、除錯 |
| S3 稽核日誌 Bucket | Object Lock（Governance Mode） | 防竄改 |
| KMS CMK | 啟用自動輪換 | 加密 |
| CloudTrail | 管理事件 + 資料事件 | API 呼叫追蹤 |
| S3 Lifecycle | 90 天 → IA、365 天 → Glacier | 成本最佳化 |
| Athena | 分區表 | 日誌分析和搜尋 |

---

## 負責任 AI / Guardrails 設計

### 運用 Bedrock Guardrails

使用 `enableGuardrails=true` 啟用的 Guardrails 設定：

| 政策 | 用途 | 設定範例 |
|------|------|----------|
| 內容過濾 | 偵測並阻擋有害內容 | HATE: HIGH、VIOLENCE: HIGH |
| 主題政策 | 定義禁止主題 | 競爭對手資訊、投資建議 |
| PII 偵測 | 偵測並遮罩個人資訊 | 姓名、電話號碼、電子郵件地址 |
| 詞彙過濾 | 阻擋禁止用語 | 內部代號、未公開資訊 |

### Guardrails 範例政策

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### 依資料分類的控制

| 資料分類 | 搜尋 | 摘要 | 引用 | Agent 使用 |
|----------|------|------|------|-----------|
| 公開 | ✅ 允許 | ✅ 允許 | ✅ 允許 | ✅ 允許 |
| 內部 | ✅ 允許 | ✅ 允許 | ⚠️ 僅摘要 | ✅ 允許 |
| 機密 | ✅ 允許（僅授權者） | ⚠️ 受限 | ❌ 禁止逐字引用 | ⚠️ 需核准 |
| 極機密 | ⚠️ 需核准 | ❌ 禁止 | ❌ 禁止 | ❌ 禁止 |

### Agent 模式的人工核准

Agent 在執行外部動作前請求人工核准的設計：

```
Agent 嘗試呼叫「傳送電子郵件」工具
  → AgentCore Policy 偵測到「外部通訊」類別
  → 產生人工核准請求
  → UI 向使用者顯示核准/拒絕提示
  → 僅在核准後執行動作
```

---

## 產業特定使用案例與法規合規

### 醫療業

| 需求 | 實作方式 |
|------|----------|
| 病患資訊隔離 | 科別專用 SID 群組 + PII 遮罩 |
| 科別專用作業程序搜尋 | 依科別 SID 過濾 |
| 稽核軌跡 | 所有搜尋日誌保留 5 年 |
| 同意管理 | 在中繼資料中包含病患同意旗標 |
| 禁止醫療診斷 | 透過 Guardrails 主題政策 DENY |

**法規合規**：醫療資訊系統安全管理指南（厚生勞動省）

### 政府 / 公部門

| 需求 | 實作方式 |
|------|----------|
| 局處文件隔離 | 局處 SID 群組 |
| 政策與非公開資料分離 | `access_level` 中繼資料 + SID |
| 資訊公開請求支援 | 搜尋日誌保存和匯出功能 |
| 個人資訊保護 | PII 偵測 + 遮罩 |
| 行政文件管理 | 文件分類中繼資料指派 |

**法規合規**：個人資訊保護法、ISMAP

### 金融機構

| 需求 | 實作方式 |
|------|----------|
| 嚴格客戶資訊隔離 | 基於客戶 ID 的存取控制 |
| 禁止投資建議 | Guardrails 主題政策 |
| 交易記錄保存 | 稽核日誌保留 10 年 |
| 內部控制 | 定期審查操作日誌 |
| 加密需求 | KMS CMK + TLS 1.2 |

**法規合規**：FISC 安全指南、金融商品交易法

### 教育機構

| 需求 | 實作方式 |
|------|----------|
| 教職員/學生權限分離 | 基於角色的 SID 群組 |
| 實驗室專用資料隔離 | 實驗室 SID 群組 |
| 學生個人資訊保護 | PII 遮罩 |
| 研究資料機密性 | 每研究專案的存取控制 |

---

## 稽核報告產生

### 定期報告項目

| 報告 | 頻率 | 內容 |
|------|------|------|
| 存取摘要 | 每日 | 每使用者搜尋次數、拒絕次數 |
| 權限違規報告 | 每日 | Fail-Closed 觸發、異常存取模式 |
| Guardrails 介入報告 | 每週 | 過濾觸發次數、依主題統計 |
| 成本與使用報告 | 每月 | Token 消耗、API 呼叫次數、儲存使用量 |
| 合規報告 | 每季 | 法規需求符合狀態、改善項目 |

### Athena 查詢範例

```sql
-- 過去 7 天的權限拒絕事件
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- 每使用者搜尋模式分析
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## 個人與敏感資訊處理

### 遮罩 / 分類流程

```
文件匯入
  → PII 掃描（Comprehend / Guardrails）
  → 分類標籤指派（機密等級 + PII 有無）
  → 在 .metadata.json 中記錄分類資訊
  → KB 同步
  
搜尋時
  → SID 過濾（存取權限）
  → Guardrails PII 偵測（輸出遮罩）
  → 回答產生（已遮罩）
```

### 核准流程（機密資料存取）

需要存取極機密資料時的核准流程：

1. 使用者提交搜尋請求
2. SID 比對識別出「需要核准」類別
3. 向管理員發送核准請求通知（SNS / Slack）
4. 管理員核准 → 發行臨時存取權杖
5. 僅在權杖有效期間內可存取
6. 存取日誌記錄於稽核表

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生產就緒檢查清單 |
| [permission-consistency.md](permission-consistency.md) | 權限變更一致性模型 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 過濾架構 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全實驗指南 |
