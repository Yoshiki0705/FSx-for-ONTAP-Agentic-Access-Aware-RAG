# Architecture Decision Records (ADR) — 架構決策記錄

**🌐 Language:** [日本語](../architecture-decision-records.md) | [English](../en/architecture-decision-records.md) | [한국어](../ko/architecture-decision-records.md) | [简体中文](../zh-CN/architecture-decision-records.md) | **繁體中文** | [Français](../fr/architecture-decision-records.md) | [Deutsch](../de/architecture-decision-records.md) | [Español](../es/architecture-decision-records.md)

**建立日期**: 2026-05-23  
**狀態**: 已核准  
**對象**: 架構師、技術負責人、希望了解決策經過的人員

---

## 概述

本文件記錄了 Permission-aware Agentic RAG 系統的主要架構決策及其依據。旨在說明「為什麼選擇了這種組態」，為未來的變更決策提供參考。

---

## ADR-001: 向量儲存 — 預設採用 S3 Vectors

| 項目 | 內容 |
|------|------|
| **狀態** | 已核准 |
| **日期** | 2026-03-29 |
| **脈絡** | RAG 搜尋的向量儲存選擇 S3 Vectors 還是 OpenSearch Serverless 作為預設 |

### 考慮的選項

| 選項 | 優點 | 缺點 |
|------|------|------|
| S3 Vectors (採用) | 每月數美元、零維運、一鍵匯出到 AOSS | 冷查詢: 亞秒級、不支援高 QPS |
| OpenSearch Serverless | 持續 50ms、支援高 QPS、全文搜尋 | 最低 $700/月 (2 OCU)、需要 OCU 管理 |

### 決策

**S3 Vectors 作為預設**，透過 `vectorStoreType` 參數可切換到 OpenSearch Serverless。

### 依據

1. PoC / 小規模使用每月數美元即可開始，降低了採用門檻
2. 透過 Bedrock KB 存取不依賴向量儲存，SID 過濾邏輯通用
3. 效能需求提高時，可從主控台一鍵匯出到 AOSS（約 15 分鐘）
4. S3 Vectors 的中繼資料全部可過濾（無需額外設定）

### 影響

- 預設部署成本大幅降低（$700/月 → $5/月）
- 高 QPS 環境需要切換到 `vectorStoreType=opensearch`
- 注意 S3 Vectors 的 2KB 可過濾中繼資料限制（PDF 中繼資料較大時）

---

## ADR-002: 權限過濾 — 應用端 SID 比對

| 項目 | 內容 |
|------|------|
| **狀態** | 已核准 |
| **日期** | 2026-01-15 |
| **脈絡** | 在哪個層實施 RAG 搜尋結果的權限過濾 |

### 考慮的選項

| 選項 | 優點 | 缺點 |
|------|------|------|
| 應用端 SID 比對 (採用) | 不依賴向量儲存、LLM 無法繞過、易於實現 Fail-Closed | 搜尋後過濾，取得數 > 顯示數 |
| 向量儲存 metadata filter | 搜尋時過濾、高效 | Bedrock KB Retrieve API 無法直接控制 |
| Bedrock KB RetrieveAndGenerate | 單一 API 完成 | 不回傳 metadata，無法進行 SID 過濾 |

### 決策

採用 **Bedrock KB Retrieve API + 應用端 SID 比對 + Converse API** 的兩階段方式。

### 依據

1. RetrieveAndGenerate API 不在 citation 的 metadata 中包含 `allowed_group_sids`，無法進行 SID 過濾
2. 應用端過濾在 LLM 外部執行，無法透過 Prompt Injection 繞過
3. 不依賴向量儲存類型（S3 Vectors / AOSS）的通用邏輯
4. Fail-Closed（SID 取得失敗時全部拒絕）的實現明確

### 影響

- 需要對 Retrieve API 取得的所有文件進行過濾，因此需要設定較多的取得數
- 過濾後文件數較少時，回答品質可能下降
- 權限快取（DynamoDB、TTL 5 分鐘）加速重複檢查

---

## ADR-003: 認證方式 — Cognito + 多 IdP 聯合

| 項目 | 內容 |
|------|------|
| **狀態** | 已核准 |
| **日期** | 2026-02-01 |
| **脈絡** | 使用者認證及 SID/UID/GID 取得方式選定 |

### 考慮的選項

| 選項 | 優點 | 缺點 |
|------|------|------|
| Cognito + SAML/OIDC/LDAP (採用) | 支援 5 種模式、CDK 參數切換、支援 Fail-Closed | Cognito 限制（自訂屬性數、權杖大小） |
| IAM Identity Center 直接使用 | AWS 原生 SSO | 與 RAG 應用整合複雜 |
| 自訂認證 (Lambda Authorizer) | 完全彈性 | 實作和維運成本高 |

### 決策

以 **Cognito User Pool** 為中心，透過 CDK 參數切換 SAML（AD Federation）、OIDC（Auth0/Keycloak/Okta）、LDAP（OpenLDAP/FreeIPA）、電子郵件/密碼 5 種模式。

### 依據

1. Cognito 與 CloudFront + Lambda Function URL (IAM Auth) 整合容易
2. Post-Authentication Trigger 可自動取得 SID/UID/GID 並註冊到 DynamoDB
3. `authFailureMode=fail-closed` 實現權限取得失敗時阻止登入
4. 可根據客戶現有 IdP 彈性選擇模式

### 影響

- 注意 Cognito 限制（50 個自訂屬性、2KB 權杖大小）
- 需要管理 SAML 中繼資料 URL（IdP 端憑證更新時）
- LDAP 直接查詢需要 VPC 內 Lambda

---

## ADR-004: 前端 — Lambda Web Adapter + Next.js 15

| 項目 | 內容 |
|------|------|
| **狀態** | 已核准 |
| **日期** | 2026-01-10 |
| **脈絡** | Web 應用程式託管方式選定 |

### 考慮的選項

| 選項 | 優點 | 缺點 |
|------|------|------|
| Lambda Web Adapter + Next.js (採用) | 無伺服器、IAM Auth + OAC、冷啟動可接受 | 冷啟動 3-5 秒、Docker 映像大小 |
| ECS Fargate | 常駐執行、低延遲 | 最低 $30/月（常駐）、需要 ALB |
| Amplify Hosting | 託管、CI/CD 整合 | 不支援 IAM Auth、客製化限制 |
| App Runner | 簡易部署、自動擴展 | 不支援 IAM Auth、VPC 整合限制 |

### 決策

使用 **Lambda Web Adapter** 無伺服器執行 Next.js 15，透過 CloudFront OAC + IAM Auth 保護。

### 依據

1. IAM 認證（Function URL + OAC）完全防止 CloudFront 以外的直接存取
2. 無伺服器，閒置時段成本為零
3. CDK 一鍵部署（包含 Docker 映像建置）
4. Next.js 15 的 App Router + Server Components 支援 SSR/ISR

### 影響

- 冷啟動（3-5 秒）在首次存取時發生。可透過 Provisioned Concurrency 緩解
- 需要最佳化 Docker 映像大小（多階段建置）
- Apple Silicon (M1/M2/M3) 需要預建置模式（x86_64 Lambda 相容）

---

## ADR-005: 資料同步 — KB Auto-Sync（輪詢方式）

| 項目 | 內容 |
|------|------|
| **狀態** | 已核准 |
| **日期** | 2026-04-15 |
| **脈絡** | 將 FSx for ONTAP 上的檔案變更反映到 Bedrock KB 的方式 |

### 考慮的選項

| 選項 | 優點 | 缺點 |
|------|------|------|
| EventBridge Scheduler 輪詢 (採用) | 簡單、不需要 FSx 事件、S3 AP 相容 | 最大 15 分鐘延遲、ListObjectsV2 成本 |
| CloudTrail + EventBridge（事件驅動） | 近即時 | S3 AP 的 CloudTrail 支援有限 |
| FSx Audit Log + EventBridge | 檔案層級事件 | 設定複雜、日誌量大 |
| 僅手動觸發 | 最簡單 | 維運負擔、同步遺漏風險 |

### 決策

預設使用 **EventBridge Scheduler 5-15 分鐘間隔輪詢**，僅在偵測到變更時執行 `StartIngestionJob`。

### 依據

1. FSx for ONTAP S3 Access Point 對 CloudTrail 資料事件的支援有限
2. ListObjectsV2 + DynamoDB 清單比較可靠地偵測變更
3. IN_PROGRESS 作業去重防止不必要的同步
4. 連續 3 次失敗觸發 CloudWatch Alarm → 通知維運團隊

### 影響

- 最大 15 分鐘同步延遲（取決於輪詢間隔）
- 大規模環境（100,000+ 檔案）需注意 ListObjectsV2 執行時間
- Transfer Family 路徑也支援 CloudTrail 事件驅動模式

---

## ADR-006: Smart Routing — 3 層模型自動選擇

| 項目 | 內容 |
|------|------|
| **狀態** | 已核准 |
| **日期** | 2026-05-01 |
| **脈絡** | 成本最佳化的模型選擇策略 |

### 考慮的選項

| 選項 | 優點 | 缺點 |
|------|------|------|
| 3 層自動路由 (採用) | 成本降低 60-80%、品質維持 | 依賴分類精度、誤分類風險 |
| 單一模型固定 | 簡單、可預測 | 成本低效或品質不足 |
| 使用者手動選擇 | 使用者控制 | UX 惡化、成本管理困難 |

### 決策

基於查詢複雜度的 **3 層自動路由**（Simple → Haiku、Complex → Sonnet、Full-context → Opus）作為預設，同時提供手動選擇選項。

### 依據

1. 企業 RAG 中 60% 以上的問題是簡單的事實確認（Haiku 即可滿足）
2. 加權平均成本 ~$0.014/query 在提升品質的同時與全部使用 Sonnet 的 ~$0.01 成本相當
3. CloudWatch EMF 指標視覺化路由分佈，支援閾值調整
4. 回退機制（模型不可用時自動切換到下一層）確保可用性

### 影響

- 分類器精度直接影響成本和品質（建議定期調整閾值）
- 注意 Opus 使用時的成本尖峰（建議設定每日成本上限）
- Smart Routing 關閉時按傳統方式使用單一固定模型

---

## 相關文件

| 文件 | 相關 ADR |
|------|---------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
