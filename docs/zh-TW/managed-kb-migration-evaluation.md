# Amazon Bedrock Managed Knowledge Base 遷移路徑評估

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | [English](../en/managed-kb-migration-evaluation.md) | [한국어](../ko/managed-kb-migration-evaluation.md) | [简体中文](../zh-CN/managed-kb-migration-evaluation.md) | **繁體中文** | [Français](../fr/managed-kb-migration-evaluation.md) | [Deutsch](../de/managed-kb-migration-evaluation.md) | [Español](../es/managed-kb-migration-evaluation.md)

**建立日期**: 2026-06-18
**目標區域**: ap-northeast-1（東京）— Managed KB 在東京區域可用
**狀態**: 評估文件（未執行遷移 / 保留現有路徑）
**相關**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md`（來源）

---

## 0. 本文件的定位

本文件評估將本儲存庫現有的 Permission-aware RAG 設定（Bedrock KB + OpenSearch Serverless / S3 Vectors）升級到在 AWS Summit New York 2026（2026-06-17）正式發布（GA）的 [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/) 時的**遷移路徑**。

關鍵前提：

- 本文件為**評估資料**，並非建議立即遷移。
- 現有路徑（Bedrock KB + OpenSearch Serverless / S3 Vectors）**不會刪除**。
- 記述內容按以下兩個證據層級分類。

| 層級 | 定義 | 本文件中的處理 |
|------|------|--------------|
| Public evidence | 可從 AWS 官方文件·部落格驗證 | 附出處連結記述 |
| Project-context expectation | 本專案內的設計判斷·預期值（無法公開驗證） | 標註為「本專案的假設」 |

> ⚠️ **Distinction discipline**: 明確區分「範例功能的一般說明」與「本專案中已驗證的行為」。Managed KB 的功能描述是基於 AWS 公開資訊的一般說明，本專案中的 ACL 連動行為**尚未驗證**（參見後述驗證要點）。

---

## 1. Managed KB 的主要功能 (Public evidence)

基於 [Introducing Amazon Bedrock Managed Knowledge Base 部落格](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) 和 [GA 公告](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)。為遵守授權限制，已在保留出處主旨的前提下進行概括·改寫。

| 功能 | 概要 | 與本專案的關聯 |
|------|------|--------------|
| 6 個原生資料連接器 | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler。自動擷取資料和權限 | **S3 連接器**能否連接 FSx for ONTAP S3 Access Point 是關鍵 |
| Smart Parsing | 按資料類型·連接器自動選擇最佳解析策略（PDF·Office·表格·多模態） | 可能將現有的手動分塊策略選擇自動化 |
| Agentic Retriever | 將複雜查詢分解為子查詢，反覆執行多跳檢索 | 在 Permission-aware 上下文中需要重新授權（後述） |
| 託管向量儲存 | 無需向量 DB 佈建。已最佳化性價比 | 無需 OpenSearch Serverless / S3 Vectors 的維運負擔 |
| AgentCore Gateway 整合 | 作為內建 connector target（MCP）公開。`Retrieve` 和 `AgenticRetrieveStream` 兩個工具 | 可與本專案的 AgentCore Gateway（已實作）整合 |
| 現有 API 相容 | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` 等相同 | 僅變更 KB ID 即可，無需程式碼變更（AWS 主張，待驗證） |
| 區域 | 在包括東京在內的多個區域 GA | 與 ap-northeast-1 部署一致 |

### 價格模型 (Public evidence)

根據 [AWS 的說明](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/)，計費為兩個維度（已索引資料大小 + 檢索次數的按需計費）。無預付承諾。

> ⚠️ **成本估算注意**: 上述為已公開價格模型的結構，本專案工作負載下的實際成本尚未測量。在做出遷移決策前，請使用預期查詢量·資料量對「現行（OpenSearch Serverless OCU / S3 Vectors 儲存）」與「Managed KB（資料大小 + 檢索次數）」進行單價比較。

---

## 2. 與現有設定的比較

### 2.1 架構比較

| 視角 | 現行 (Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|------|--------------------------------------------------------------|------------|
| 向量儲存維運 | 自行管理（AOSS 的 OCU 設計 / S3 Vectors index 管理） | 完全託管（無需佈建） |
| 資料來源 | FSx for ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | 經由 S3 連接器（S3 AP 連接待驗證） |
| 解析·分塊 | 透過 `kbChunkingStrategy` 手動選擇 (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing 自動選擇（可自訂） |
| 嵌入模型 | 部署時固定 (`embeddingModel`，變更需重建) | 預設自動選擇 + 可選指定 Bedrock 模型 |
| 檢索 | 單次 Retrieve + 應用端 SID 過濾 | `Retrieve`（單次混合）+ `AgenticRetrieveStream`（多跳） |
| ACL 過濾 | 應用端 `allowed_group_sids` 比對（與向量儲存無關） | 中繼資料 `filter` 運算子 + `userContext`（待驗證） |
| Gateway 整合 | 自訂（已實作的 AgentCore Gateway + Permission Interceptor） | 內建 connector target |
| 維運負擔 | 中（需要向量儲存·管線設計） | 低（託管） |
| 可自訂性 | 高（所有元件可控） | 中（在託管範圍內調整） |

### 2.2 現有系統的 SID 過濾方式 (Project-context)

本專案如 [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) 所述，採用以下與向量儲存無關的方式。

```
Bedrock KB Retrieve API → 檢索結果 + 中繼資料(allowed_group_sids)
→ 應用端(route.ts)比對 使用者SID ∩ 文件SID
→ 僅比對相符的文件進入 Converse API
→ Fail-Closed: SID 取得失敗則全部拒絕
```

該方式的優勢在於，即使更換向量儲存（AOSS / S3 Vectors），**應用端授權邏輯保持不變**。能否在遷移到 Managed KB 後保持這一不變條件，是最關鍵的論點。

---

## 3. 遷移判斷標準

以「按用途選擇（right tool for the job）」而非「替換競品」來整理。對稱地記述兩種設定的權衡。

### 3.1 應考慮遷移到 Managed KB 的情況

- 希望**降低向量儲存（OpenSearch Serverless OCU / S3 Vectors index）的維運·設計負擔**
- 希望利用 Smart Parsing 進行**多格式文件（PDF·Office·表格）的自動解析**
- 尋求透過 Agentic Retriever 提升**多跳·複雜查詢**的準確度
- 希望**無需重建基礎設施即可跟進**新的嵌入·重排模型
- 希望整合到以 AgentCore Gateway 為中心的架構，透過**內建 connector target** 簡化連接

### 3.2 應保留現行設定的情況

- 有**在檢索時嚴格套用檔案級 ACL（NTFS / SID）的要求**，並希望完全控制 `allowed_group_sids` 比對行為
- 已**自行實作權限變更·刪除·重新命名的即時反映邏輯**（Managed 的託管同步能否同等保持尚未驗證）
- 希望**精細控制向量儲存的 filter / ranking / reranking**
- 在**託管儲存中的 ACL 中繼資料保留·過濾尚未驗證**的階段，不希望破壞生產環境的 Fail-Closed 保證
- 出於資料主權·稽核要求，需要**明確管理向量資料的儲存位置**

### 3.3 判斷流程

```
是否需要在檢索時嚴格套用 ACL？
├─ YES → 能否清除 §4 的所有驗證要點？
│        ├─ YES → 考慮分階段遷移 (§5)
│        └─ NO  → 保留現行設定（優先 ACL 保證）
└─ NO  → 重視維運負擔·準確度，優先考慮 Managed KB
```

> ⚠️ 本專案的主要目的是 **Permission-aware RAG**，ACL 嚴格套用是不可讓步的要求。因此，除非清除 §4 的驗證，否則保留現行設定為預設方針。

---

## 4. 對 Permission-aware RAG 的影響 (最重要)

能否在 Managed KB 的託管儲存中保持本專案基於 SID 的 ACL 過濾。整理 Public evidence 與驗證要點。

### 4.1 Public evidence: Managed KB 的存取控制手段

根據 [AgentCore Gateway connector target 文件](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)，Managed KB 擁有兩種存取控制手段。

**(A) 中繼資料 `filter` 運算子 (`Retrieve` 工具)**

`managedSearchConfiguration.filter` 支援以下運算子（概括出處主旨）：
`equals`、`notEquals`、`greaterThan`、`greaterThanOrEquals`、`lessThan`、`lessThanOrEquals`、`in`、`notIn`、`startsWith`、`listContains`、`stringContains`、`andAll`、`orAll`

→ **`listContains` 有可能用於將使用者 SID 與 `allowed_group_sids`（陣列）比對**。這可將現行的應用端比對下推到檢索層。

**(B) 透過 `userContext` 的存取控制過濾**

根據文件，當 KB 執行使用者/群組級存取控制時，呼叫應用在請求中包含 `userContext`（例如 `userId`）。Gateway 將其傳遞給 KB，KB 基於 `userContext` 套用過濾。關鍵在於，**Gateway 不會從呼叫者的 IAM 身分自動補全 `userContext`，應用必須明確傳遞**。此外明確指出，**`userContext` 由應用而非模型提供**。

→ 這種「由應用明確提供」「不交給模型」的設計，與本專案的 **Fail-Closed·應用強制**原則方向一致。

### 4.2 驗證要點 (遷移前必須確認)

以下均**尚未驗證**，決定遷移可行性。一併標註 Project-context 的假設。

| # | 驗證項目 | 本專案的假設 | 風險 |
|---|---------|-------------|------|
| V1 | S3 連接器能否將 **FSx for ONTAP S3 Access Point** 作為資料來源（alias 格式·IAM 邊界） | 假設 S3 相容則可連接 | 無法連接則遷移本身不成立 |
| V2 | `.metadata.json` 的 `allowed_group_sids` 是否在 Managed KB 索引中**作為中繼資料保留** | 假設保留 | 不保留則無法 ACL 過濾 |
| V3 | `Retrieve` 的 `filter` 是否支援 **`listContains` 的 SID 陣列比對** | 假設可用 | 不可用則切換到 userContext 方式 |
| V4 | `userContext` 方式在 **S3 連接器擷取的資料**中是否有效（是否僅限 SaaS 連接器） | S3 是否有效不明 | S3 無效則依賴 filter 方式 |
| V5 | **`AgenticRetrieveStream`（多跳）的每個步驟**是否套用 ACL 過濾 | 需要每步套用 | 中間步驟混入權限外資料的風險 |
| V6 | 託管儲存中**權限變更·刪除·重新命名的反映延遲**是否在可接受範圍 | 期望與現有同等的即時性 | 反映延遲導致舊權限資料殘留的風險 |
| V7 | 對話歷史·快取的 **ACL 套用**是否維持 | 應用端維持 | Managed 端快取的行為不明 |

> ⚠️ **不可讓步**: 若 V2、V3（或 V4）、V5 中任一未滿足，因**權限外資料可能混入檢索結果**，遷移為 **BLOCKED**。這違反 FSx for ONTAP AI/RAG 架構審查的不可讓步要求（「權限外資料可能混入 vector search 結果的設計」「無對傳遞給 LLM 的 context 進行授權檢查的設計」）。

### 4.3 維持縱深防禦

即使遷移，也不依賴單一手段，維持縱深防禦。

```
1. 透過 IdP / Cognito / AD 進行使用者認證
2. 取得使用者 principal / 群組 SID (DynamoDB user-access)
3. Managed KB 檢索時的 filter (listContains) 或 userContext
4. ★ LLM context 注入前的應用端 ACL 重新比對（保留現行 route.ts 邏輯）★
5. 使用 AgenticRetrieveStream 時每步後重新授權
6. 顯示引用來源連結時重新授權
7. 稽核日誌（誰在何時使用了哪些 SID 來源資訊）
```

→ 即使使用 Managed KB 端過濾，也**強烈建議保留步驟 4（應用端最終 ACL 比對）**。這樣即使託管端過濾行為與預期不同，也能保證 Fail-Closed。

---

## 5. 遷移路徑 (分階段 / 保留現有路徑)

與現有的 Dual KB 遷移模式（[migration-guide-multimodal.md](../en/migration-guide-multimodal.md)）一樣，透過**並行運行**分階段驗證。現有路徑不會刪除。

### Phase 0: PoC 驗證 (無生產影響)

1. 用小規模驗證資料集建立 Managed KB（建議使用 Snapshot / FlexClone 的一致資料）
2. 按順序驗證 §4.2 的 V1~V7
3. 針對 [tests/permission-matrix/](../../tests/permission-matrix/) 的 31 個情境，確認 SID 過濾（filter / userContext）的行為

### Phase 1: 並行運行 (Shadow)

1. 保留現有 KB，將 Managed KB 作為**唯讀 shadow** 並行運行
2. 向兩個系統傳送相同查詢，比較檢索結果·ACL 過濾結果·引用一致性
3. 用 RAGAS 等比較準確度·citation precision（[evaluation.md](evaluation.md)）

### Phase 2: 分階段遷移 (Canary)

1. 用 AgentCore Gateway A/B 測試（AgentCore Optimization — 本儲存庫已實作）將部分流量路由到 Managed KB 路徑
2. 確認所有權限測試（Fail-Closed、群組巢狀、ACL 邊界情況）通過
3. 確認統計顯著性後，逐步遷移流量

### Phase 3: 切換判斷

- 所有驗證清除 → 將 Managed KB 設為預設路徑
- 有未滿足項 → 保留現行設定，Managed KB 保持 shadow 或撤回

> 建議即使遷移完成後，也將現有路徑（Bedrock KB + OpenSearch Serverless / S3 Vectors）作為**一段時間的回滾路徑**保留。

---

## 6. 驗證清單

在做出遷移判斷前，請清除以下所有項。

### 資料基礎
- [ ] V1: S3 連接器可將 FSx for ONTAP S3 AP 註冊為資料來源
- [ ] 使用 Snapshot / FlexClone 的一致資料執行 PoC
- [ ] 不將生產資料直接作為重度爬取對象

### Permission-aware RAG (最重要)
- [ ] V2: `allowed_group_sids` 作為中繼資料保留
- [ ] V3 或 V4: 透過 `listContains` filter 或 `userContext` 使 SID 過濾生效
- [ ] V5: AgenticRetrieveStream 的每步套用 ACL
- [ ] 維持縱深防禦步驟 4（應用端最終比對）
- [ ] Fail-Closed: SID 取得失敗則全部拒絕
- [ ] 31 個權限測試情境全部通過

### 資料生命週期
- [ ] V6: 權限變更·刪除·重新命名的反映延遲在可接受範圍內
- [ ] V7: 對話歷史·快取套用 ACL

### 成本·效能
- [ ] 執行現行 vs Managed KB 的單價比較（資料大小 + 檢索次數）
- [ ] 建立預期查詢量下的月度估算

### 維運
- [ ] 將回滾步驟（返回現有路徑）編寫為 runbook
- [ ] 可透過稽核日誌追蹤使用歷史

---

## 7. 推薦判定

**目前判定: REQUEST CHANGES（驗證完成前暫緩遷移）**

解除條件：

1. 透過 PoC 驗證 §4.2 的驗證要點 V1~V7
2. 特別是清除 **V2·V3（或 V4）·V5**（未滿足則 BLOCKED）
3. 設計須維持縱深防禦步驟 4（應用端最終 ACL 比對）
4. 成本單價比較顯示不遜於現行，或維運負擔降低超過成本增加

**判定依據：**

- Managed KB 的維運負擔降低·Smart Parsing·Agentic Retriever 對本專案有明確價值（Public evidence）。
- 然而，本專案的**最優先要求是 Permission-aware RAG 的 ACL 嚴格套用**，而託管儲存中的 SID 過濾行為**尚未驗證**。
- `userContext`（應用明確提供·與模型無關）與 `listContains` filter 方向一致，因此**視驗證情況，遷移完全可行**。

> 本文件為評估資料。實際遷移應在經過上述驗證並獲得相關審查（FSx for ONTAP AI/RAG 架構審查）批准後實施。

---

## 相關文件

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Managed KB 驗證步驟（S3 AP 連接驗證 / FlexClone 安全驗證模式）
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — SID 過濾的基本設計
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — S3 Vectors + SID 整合
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — 現有堆疊設定與 KB 配額
- [metadata-json-schema.md](metadata-json-schema.md) — `allowed_group_sids` 中繼資料結構
- [migration-guide-multimodal.md](../en/migration-guide-multimodal.md) — Dual KB 分階段遷移的參考模式（英文）
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — 現行分塊策略
- [evaluation.md](evaluation.md) — RAG 評估方法
