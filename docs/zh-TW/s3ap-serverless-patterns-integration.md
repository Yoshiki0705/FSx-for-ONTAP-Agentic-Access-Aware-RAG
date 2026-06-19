# S3AP Serverless Patterns 整合架構

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | [English](../en/s3ap-serverless-patterns-integration.md) | [한국어](../ko/s3ap-serverless-patterns-integration.md) | [简体中文](../zh-CN/s3ap-serverless-patterns-integration.md) | **繁體中文** | [Français](../fr/s3ap-serverless-patterns-integration.md) | [Deutsch](../de/s3ap-serverless-patterns-integration.md) | [Español](../es/s3ap-serverless-patterns-integration.md)

**建立日期**: 2026-05-23  
**狀態**: 草稿  
**對象**: 架構師、合作夥伴 SA

---

## 概述

本文件說明 [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns)(17 UC 無伺服器處理模式)與本專案(Permission-aware Agentic RAG)的整合架構。

---

## 兩個專案的定位

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (企業檔案伺服器)                                            │
│                                                                         │
│  NAS 資料: 設計圖面、合約、診療記錄、財務報告、研究論文...                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (處理·轉換·分析)              │  │ (基於權限的 AI 檢索·對話)     │
│                              │  │                              │
│ • Step Functions 批次處理     │  │ • Bedrock KB + Converse API  │
│ • AI/ML 服務整合              │  │ • SID 過濾                    │
│ • 將處理結果寫回 FSx          │  │ • 聊天 UI (Next.js)          │
│                              │  │ • Agent 模式                 │
│ 17 個產業 UC                 │  │ 14 個 Agent 範本             │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## 整合模式

### 模式 A: 將處理結果作為 RAG 檢索對象

將 S3AP Serverless Patterns 處理·分析後的結果作為 RAG 的檢索對象文件加以運用。

```
FSx for ONTAP (原始資料: DICOM 影像、合約 PDF、IoT 日誌)
  ↓ S3 AP (讀取)
S3AP Serverless Patterns
  ├─ UC5: DICOM → 元資料擷取·匿名化
  ├─ UC1: 合約 → 實體擷取·分類
  └─ UC3: IoT 日誌 → 異常偵測·報告產生
  ↓ S3 AP (寫回) or S3 儲存貯體
FSx for ONTAP (已處理資料 + .metadata.json)
  ↓ S3 AP (讀取)
Permission-aware RAG (Bedrock KB)
  ↓ SID 過濾
使用者: 「上個月品質檢查中出現異常的產品有哪些?」
```

**優勢**:
- 將原始資料(影像、二進位)轉換為 AI 可理解的文字後再匯入 RAG
- 為處理結果附加權限元資料，維持部門層級的存取控制
- 兩個系統共用同一個 FSx for ONTAP 磁碟區(無需複製資料)

### 模式 B: 從 RAG 觸發處理管線

在 Agent 模式下指示「執行分析」時，將觸發 S3AP 模式的 Step Functions。

```
使用者: 「分析最新的品質檢查影像並產生報告」
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: 製造業分析)
  ↓ 處理完成
Agent: 「分析已完成。結果如下: ...」
```

### 模式 C: 稽核·合規的整合

將 S3AP UC1(法務·合規)的稽核結果透過 RAG 實現可檢索，以對話方式確認合規狀況。

```
S3AP UC1: 檔案伺服器稽核 → 稽核報告產生
  ↓
RAG: 「是否存在違反合規的檔案?」
  → 從稽核報告中回答權限範圍內的資訊
```

---

## 產業整合對應

| S3AP UC | 產業 | RAG 運用方式 | Agent 範本 |
|---------|------|----------------|------------------|
| UC1 | 法務 | 稽核報告檢索、合規狀況確認 | `legalCompliance` |
| UC2 | 金融 | 檢索 OCR 處理後的發票·合約 | `financial` |
| UC3 | 製造 | 檢索品質檢查報告·異常偵測結果 | `search` |
| UC5 | 醫療 | 檢索 DICOM 元資料·匿名化後的所見 | `medicalGuideline` |
| UC10 | 營建 | 檢索 BIM 元資料·安全合規報告 | `project` |
| UC13 | 教育 | 檢索論文分類結果·引用網路 | `search` |
| UC14 | 保險 | 檢索理賠評估報告·損害評估結果 | `insuranceClaim` |
| UC16 | 政府 | 檢索公文分類·遮蔽處理文件 | `publicDocument` |

---

## 部署組態範例

### 最小組態(單一帳戶)

```
AWS Account
├── FSx for ONTAP (共用磁碟區)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (選擇性部署)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### 企業組態(多帳戶)

```
Management Account
├── StackSets (S3AP 模式發佈)
└── CDK Pipelines (RAG 發佈)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## 相關文件

| 文件 | 內容 |
|-------------|------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 多租戶部署模式 |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR(向量儲存、權限過濾器等) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | 17 UC 詳情 |
