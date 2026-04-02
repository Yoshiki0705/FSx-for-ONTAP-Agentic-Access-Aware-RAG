# S3 Vectors + SID 過濾架構指南

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | [English](../en/s3-vectors-sid-architecture-guide.md) | [한국어](../ko/s3-vectors-sid-architecture-guide.md) | [简体中文](../zh-CN/s3-vectors-sid-architecture-guide.md) | **繁體中文** | [Français](../fr/s3-vectors-sid-architecture-guide.md) | [Deutsch](../de/s3-vectors-sid-architecture-guide.md) | [Español](../es/s3-vectors-sid-architecture-guide.md)

**建立日期**: 2026-03-29
**驗證環境**: ap-northeast-1（东京）
**狀態**: CDK 部署已驗證，SID 過濾已驗證

---

## 概述

本文件总结了在權限感知 RAG 系統中采用 Amazon S3 Vectors 作為向量儲存的架構决策，以及基於 SID 的存取控制整合模式。包含针對专家反馈的驗證結果和建議。

---

## SID 過濾模式評估

### 本系統的目前方法

本系統使用 Bedrock KB Retrieve API 執行向量搜尋，並在應用程序端匹配回傳元資料中的 `allowed_group_sids` 字段。此方法與向量儲存無關。

```
Bedrock KB Retrieve API → 搜尋結果 + 元資料（allowed_group_sids）
→ 應用程序端匹配：使用者 SID ∩ 文件 SID
→ 僅使用匹配的文件呼叫 Converse API
```

### 模式 A：將 SID 附加為可過濾元資料（推荐模式）

由於 S3 Vectors 中的所有元資料預設可過濾，`allowed_group_sids` 無需额外設定即可過濾。

#### 在本系統中的應用

由於本系統透過 Bedrock KB 存取 S3 Vectors，因此無法直接控制 `QueryVectors` 過濾參數。Bedrock KB Retrieve API 執行向量搜尋並回傳包含元資料的結果。SID 過濾在應用程序端執行。

此方法的优势：
- Bedrock KB Retrieve API 與向量儲存無關，因此相同的應用程序代码可同時適用於 S3 Vectors 和 AOSS
- `.metadata.json` 中的 `allowed_group_sids` 作為元資料原样儲存和回傳
- 應用程序端的 SID 過濾逻辑（`route.ts`）無需更改

#### 對专家反馈的回应

> 请透過測試確保應用程序始终應用 SID 過濾。S3 Vectors 元資料過濾很方便，但它不能替代存取控制本身。

本系統透過以下方式確保這一點：
1. SID 過濾内置於 KB Retrieve API 路由（`route.ts`）中，無法绕過
2. 如果無法從 DynamoDB 擷取 SID 資訊，則拒绝所有文件（Fail-Closed 原則）
3. 基於屬性的測試（屬性 5）已驗證 SID 過濾的向量儲存獨立性

### 模式 B：按 SID/租户分离索引

#### 對本系統的評估

本系統中的 SID 是基於 Active Directory NTFS ACL 的組 SID，每個文件分配多個 SID（例如 `["S-1-5-21-...-512", "S-1-1-0"]`）。按 SID 分离索引不适合，原因如下：

1. **多對多 SID 關系**：單個文件属於多個 SID 組，單個使用者拥有多個 SID。索引分离需要重複儲存文件
2. **動态 SID 数量变化**：随着 AD 組的添加或修改，SID 数量會波動。索引管理变得複雜
3. **10,000 索引/儲存桶限制**：在大規模 AD 環境中，SID 数量可能接近此限制

#### 混合設計考量

正如专家指出的，按租户/客户分离索引並在每個索引内使用 SID 過濾的混合設計是有效的。由於本系統假设單租户（單 AD 環境），目前不需要索引分离。擴展到多租户時將予以考虑。

---

## 迁移檢查清單驗證結果

### 1. Embedding 模型/維度/度量驗證

| 项目 | 目前（AOSS） | S3 Vectors | 相容性 |
|------|----------------|-----------|---------------|
| Embedding 模型 | Amazon Titan Embed Text v2 | 相同 | ✅ |
| 維度 | 1024 | 1024 | ✅ |
| 距离度量 | l2（AOSS/faiss） | cosine（S3 Vectors） | ⚠️ 需要驗證 |
| 資料類型 | - | float32（必需） | ✅ |

> **注意**：目前 AOSS 使用 l2（欧几里得距离），而 S3 Vectors 使用 cosine。由於 Bedrock KB 管理 embedding 和度量之间的一致性，透過 KB 存取時没有問題。但是，直接使用 S3 Vectors API 時请注意度量差异。S3 Vectors 不允许在索引建立後更改維度和度量。

### 2. 元資料設計

| 元資料鍵 | 用途 | 可過濾 | 备注 |
|-------------|---------|-----------|-------|
| `allowed_group_sids` | SID 過濾 | 建議 non-filterable | 由於透過 Bedrock KB Retrieve API 進行應用程序端過濾，不需要 S3 Vectors 過濾 |
| `access_level` | 存取級別顯示 | 建議 non-filterable | 用於 UI 顯示 |
| `doc_type` | 文件類型 | 建議 non-filterable | 用於未來過濾 |
| `source_uri` | 源文件路径 | non-filterable | 不可搜尋，僅供参考 |
| `chunk_text` | 块文本 | non-filterable | 不可搜尋，大資料 |

#### S3 Vectors 元資料約束（驗證中發現的實際值）

| 約束 | 標称值 | 使用 Bedrock KB 時的有效值 | 缓解措施 |
|-----------|---------------|-------------------------------|------------|
| 可過濾元資料 | 2KB/向量 | **自訂元資料最多 1KB**（剩余 1KB 被 Bedrock KB 內部元資料消耗） | 最小化自訂元資料 |
| Non-filterable 元資料鍵 | 最多 10 個鍵/索引 | 10 個鍵（5 個 Bedrock KB 自動鍵 + 5 個自訂鍵） | 优先將 Bedrock KB 自動鍵设為 non-filterable |
| 总元資料鍵 | 最多 50 個鍵/向量 | 35 個鍵（使用 Bedrock KB 時） | 無問題 |

#### Bedrock KB 自動添加的元資料鍵

以下鍵由 Bedrock KB 自動儲存在 S3 Vectors 中。如果未包含在 `nonFilterableMetadataKeys` 中，它们將被视為可過濾並消耗 2KB 限制。

| 鍵 | 說明 | 建議 non-filterable |
|-----|-------------|---------------------------|
| `x-amz-bedrock-kb-source-file-modality` | 文件類型（TEXT 等） | ✅ |
| `x-amz-bedrock-kb-chunk-id` | 块 ID（UUID） | ✅ |
| `x-amz-bedrock-kb-data-source-id` | 資料源 ID | ✅ |
| `x-amz-bedrock-kb-source-uri` | 源 URI | ✅ |
| `x-amz-bedrock-kb-document-page-number` | PDF 页码 | ✅ |

> **重要**：由於 PDF 页码元資料等原因，可過濾元資料可能超過 2KB。將所有 Bedrock KB 自動鍵包含在 `nonFilterableMetadataKeys` 中，並尽可能將自訂元資料设為 non-filterable。

### 3. 權限不足的预驗證

透過驗證確認的必需 IAM 操作：

```
KB Role（用於 Bedrock KB）：
  s3vectors:QueryVectors   ← 搜尋所需
  s3vectors:PutVectors     ← 資料同步所需
  s3vectors:DeleteVectors  ← 資料同步所需
  s3vectors:GetVectors     ← 元資料擷取所需（如专家所指出）
  s3vectors:ListVectors    ← 驗證中發現為必需

Custom Resource Lambda（用於資源管理）：
  s3vectors:CreateVectorBucket
  s3vectors:DeleteVectorBucket
  s3vectors:CreateIndex
  s3vectors:DeleteIndex
  s3vectors:ListVectorBuckets
  s3vectors:GetVectorBucket
  s3vectors:ListIndexes
  s3vectors:GetIndex
```

> **驗證中發現**：KB Role 不僅需要 `s3vectors:GetVectors`，還需要 `s3vectors:ListVectors`。缺少它會导致 403 錯誤。

### 4. 效能驗證

> **狀態**：CDK 部署驗證完成。Retrieve API 延遲驗證完成。

S3 Vectors 標称效能：
- 冷查询：亚秒級（1 秒内）
- 热查询：约 100ms 或更低
- 高频查询：延遲降低

Retrieve API 驗證結果（2 個文件，ap-northeast-1）：
- 確認 Bedrock KB Retrieve API 正确回傳 SID 元資料（`allowed_group_sids`）
- 公開文件：`allowed_group_sids: ["S-1-1-0"]`（Everyone SID）
- 机密文件：`allowed_group_sids: ["S-1-5-21-...-512"]`（Domain Admins SID）
- `access_level` 和 `doc_type` 等自訂元資料也正确回傳
- 現有 SID 過濾逻辑（`route.ts`）無需修改即可工作

### 5. 分阶段迁移設計

本系統透過 CDK context 參數 `vectorStoreType` 的切換支援分阶段迁移：

1. **阶段 1**：使用 `vectorStoreType=s3vectors` 進行新部署（驗證環境） ← 目前阶段
2. **阶段 2**：資料源添加/同步，透過 Retrieve API 驗證 SID 元資料擷取
3. **阶段 3**：效能驗證（延遲、並發）
4. **阶段 4**：生产環境采用决策

從 AOSS 到 S3 Vectors 的迁移可透過重新同步 Bedrock KB 資料源實現（向量資料由 KB 自動生成，因此無需手動迁移）。

---

## CDK 部署驗證結果

### 驗證環境

- 区域：ap-northeast-1（东京）
- 堆積堆積疊名称：s3v-test-val-AI（獨立驗證）、perm-rag-demo-demo-*（全堆積堆積疊驗證）
- vectorStoreType：s3vectors
- 部署時間：AI 堆積堆積疊獨立约 83 秒，全堆積堆積疊（6 個堆積堆積疊）约 30 分钟

### 全堆積堆積疊 E2E 驗證結果（2026-03-30）

使用所有 6 個堆積堆積疊（Networking、Security、Storage、AI、WebApp + WAF）部署的 S3 Vectors 設定進行了 E2E 驗證。

#### SID 過濾操作驗證

| 使用者 | SID | 問題 | 引用的文件 | 結果 |
|------|-----|----------|---------------------|--------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "告诉我公司的销售额" | confidential/financial-report.txt + public/product-catalog.txt（2 個文件） | ✅ 回應包含 150 亿日元销售資訊 |
| user@example.com | 普通使用者 (-1001) + Everyone (S-1-1-0) | "告诉我公司的销售额" | public/product-catalog.txt（僅 1 個文件） | ✅ 無销售資訊（机密文件正确排除） |

#### Agent 模式驗證（admin@example.com）

| 測試 | 問題 | 結果 |
|------|----------|--------|
| 透過 Agent Action Group 的 KB 搜尋 | "告诉我公司的销售额" | ✅ 回應包含 150 亿日元销售資訊。Agent 透過 Permission-aware Search Action Group 呼叫 Retrieve API 並從 SID 過濾結果生成回應 |

Agent 模式經验教训：
- Bedrock Agent Action Group 使用 Bedrock KB Retrieve API，因此與向量儲存類型（S3 Vectors / AOSS）無關
- 透過 CDK 建立的 Agent（`enableAgent=true`）在 S3 Vectors 設定下也能以 PREPARED 狀態正常運行
- 透過 Agent 的 SID 過濾使用與 KB 模式相同的逻辑（`route.ts` 混合方法）

#### 驗證中發現的额外經验教训

| # | 經验教训 | 影响 |
|---|--------|--------|
| 1 | 應用程序發送邮箱地址作為 userId 而非 Cognito sub | DynamoDB 鍵需要使用邮箱地址註冊 |
| 2 | SVM AD 加入需要在 VPC 安全組中開放 AD 連接埠 | 需要在 FSx SG 中添加連接埠 636、135、464、3268-3269、1024-65535。需要在 CDK NetworkingStack 中更新 |
| 3 | 缺少 `@aws-sdk/client-scheduler` 相依 | 由其他線程的功能添加引起。透過添加到 package.json 解決 |
| 4 | SVM AD 加入需要指定 OU | 對於 AWS Managed AD，`OrganizationalUnitDistinguishedName` 必須指定 `OU=Computers,OU=<ShortName>,DC=<domain>,DC=<tld>` |
| 5 | FSx ONTAP S3 AP 存取需要儲存桶政策設定 | SSO 假设角色預設無法存取 S3 AP。需要 S3 AP 政策（`s3:*`）+ IAM 基於身分的政策（S3 AP ARN 模式）。此外，卷上必須存在文件且 NTFS ACL 必須允许存取（双层授權） |
| 6 | FSx ONTAP S3 AP 使用双层授權模型 | 需要 IAM 認证（S3 AP 政策 + 基於身分的政策）和文件系統認证（NTFS ACL）。当卷為空或未建立 CIFS 共享時也會出現 AccessDenied |
| 7 | FSx ONTAP 管理员密码與 CDK AD 密码分開 | FSx ONTAP `fsxadmin` 密码在文件系統建立時自動生成。透過 ONTAP REST API 建立 CIFS 共享需要此密码。可在 CDK 中設定 `FsxAdminPassword` 或稍後使用 `update-file-system` 設定 |
| 8 | FSx ONTAP S3 AP AccessDenied 問題 | **根本原因已确定：Organization SCP**。S3 AP 存取在旧账户（無 Organization SCP 限制）中成功。在新账户（有 Organization SCP 限制）中出現 AccessDenied。需要在 Organization 管理账户中修改 SCP |
| 9 | S3 Vectors 可過濾元資料 2KB 限制 | 使用 Bedrock KB + S3 Vectors 時，自訂元資料限制為 **1KB**（不是獨立 S3 Vectors 的 2KB，因為 Bedrock KB 內部元資料消耗了剩余的 1KB）。此外，Bedrock KB 自動添加的元資料鍵（`x-amz-bedrock-kb-chunk-id`、`x-amz-bedrock-kb-data-source-id`、`x-amz-bedrock-kb-source-file-modality`、`x-amz-bedrock-kb-document-page-number` 等）被视為可過濾，PDF 页码元資料可能超過 2KB 限制。即使在 `nonFilterableMetadataKeys`（最多 10 個鍵）中指定所有元資料鍵，当 Bedrock KB 自動添加的鍵较多時也可能不夠。**缓解措施**：(1) 最小化元資料鍵（僅 `sids`，短值），(2) 使用不带元資料的 PDF 文件，(3) S3 儲存桶备用路径在新账户中驗證無問題（AOSS 設定無 2KB 限制） |

#### FSx ONTAP S3 AP 路径驗證狀態

| 步骤 | 狀態 | 备注 |
|------|--------|-------|
| SVM AD 加入 | ✅ 完成 | 透過指定 OU + 添加 SG 連接埠解決 |
| CIFS 共享建立 | ✅ 完成 | 透過 ONTAP REST API 建立 `data` 共享 |
| 透過 SMB 放置文件 | ✅ 完成 | 使用 `demo.local\Admin` 在 public/confidential 中放置文件 |
| S3 AP 建立 | ✅ AVAILABLE | 使用 WINDOWS 使用者類型、已加入 AD 的 SVM 建立 |
| 透過 S3 AP 存取 | ❌ AccessDenied（僅新账户） | **根本原因已确定：Organization SCP**。在旧账户（無 SCP 限制）中存取成功。需要在 Organization 管理账户中修改 SCP |
| KB 同步（透過 S3 AP） | ⚠️ 元資料 2KB 限制 | 透過 S3 AP 的 KB 同步本身成功，但 PDF 文件元資料可能超過 2KB 限制 |
| KB 同步（透過 S3 儲存桶） | ✅ 完成 | 透過 S3 儲存桶备用路径的带 SID 元資料文件 KB 同步成功 |
| cdk destroy | ✅ 完成 | S3 Vectors 自訂資源（儲存桶 + 索引）正常刪除。FSx 在現有 FSx 引用模式下保留（設計如此） |

> **替代路径**：透過 S3 儲存桶备用路径（S3 儲存桶 → KB 同步 → S3 Vectors → SID 過濾）的 E2E 驗證已完成。由於 SID 過濾與向量儲存和資料源類型無關，S3 儲存桶路径的驗證結果也適用於 S3 AP 路径。

### S3 Vectors → OpenSearch Serverless 匯出驗證結果

透過控制台一鍵匯出驗證，結果如下：

| 步骤 | 時长 | 結果 |
|------|----------|--------|
| AOSS 集合自動建立 | 约 5 分钟 | ACTIVE |
| OSI 管道自動建立 | 约 5 分钟 | ACTIVE → 資料传输開始 |
| 資料传输完成 | 约 5 分钟 | 管道自動 STOPPING |
| 总计 | 约 15 分钟 | 匯出完成 |

匯出期间自動建立的資源：
- AOSS 集合（`s3vectors-collection-<timestamp>`）
- OSI 管道（`s3vectors-pipeline<timestamp>`）
- IAM 服务角色（`S3VectorsOSIRole-<timestamp>`）
- DLQ S3 儲存桶

匯出經验教训：
- 控制台的"建立並使用新的服务角色"选项自動建立 IAM 角色。無需预先使用脚本建立角色
- OSI 管道在資料传输完成後自動停止（成本高效）
- 管道停止後 AOSS 集合仍可搜尋
- AOSS 集合的最大 OCU 預設為 100（可在控制台中設定）
- 匯出脚本（`export-to-opensearch.sh`）信任政策僅使用 `osis-pipelines.amazonaws.com`（`s3vectors.amazonaws.com` 在 IAM 中是無效的服务主體）

#### 匯出控制台界面

![S3 Vectors → OpenSearch Serverless 匯出設定界面](screenshots/s3vectors-export-to-opensearch.png)

控制台自動化以下操作：
- 建立 OpenSearch Serverless 向量集合（最大 OCU：100）
- 建立 IAM 服务角色（S3 Vectors 读取 + AOSS 写入）
- 建立 OpenSearch Ingestion 管道（包括 DLQ S3 儲存桶）

### 建立的資源（示例）

| 資源 | ARN/ID 模式 |
|----------|---------------|
| Knowledge Base | `<KB_ID>` |
| Vector Bucket | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors` |
| Vector Index | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors/index/bedrock-knowledge-base-default-index` |

### 部署中發現並修複的問題

| # | 問題 | 原因 | 修複 |
|---|-------|-------|-----|
| 1 | SDK v3 回應中無 ARN | S3 Vectors API 規格 | 從模式建構 ARN |
| 2 | S3VectorsConfiguration 驗證錯誤 | indexArn 和 indexName 互斥 | 僅使用 indexArn |
| 3 | KB 建立時 403 錯誤 | IAM 政策相依 | 使用显式 ARN 模式 |
| 4 | DeleteIndexCommand 不是構造函式 | SDK API 命令名称差异 | 使用 CreateIndex/DeleteIndex |
| 5 | CloudFormation Hook | 組織級別 Hook | 使用 --method=direct |

---

## 相關文件

| 文件 | 內容 |
|----------|---------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 過濾設計詳情 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3 种設定對比表和實施經验教训 |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | 技术設計文件 |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | 需求文件 |
