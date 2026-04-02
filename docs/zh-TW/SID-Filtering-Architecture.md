# 基於 SID 的權限過濾架構

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | [English](../en/SID-Filtering-Architecture.md) | [한국어](../ko/SID-Filtering-Architecture.md) | [简体中文](../zh-CN/SID-Filtering-Architecture.md) | **繁體中文** | [Français](../fr/SID-Filtering-Architecture.md) | [Deutsch](../de/SID-Filtering-Architecture.md) | [Español](../es/SID-Filtering-Architecture.md)

## 概述

本系統利用 NTFS ACL SID（Security Identifier）按使用者過濾 RAG 搜尋結果。FSx for NetApp ONTAP 檔案系統的存取權限資訊以中繼資料形式儲存在向量資料庫中，並在搜尋時即時執行權限檢查。

---

## 整體架構圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        資料匯入流程                                      │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ 透過 S3 相容    │    │ ・使用 Titan Embed v2 │  │
│  │ 檔案         │    │ 介面公開 FSx    │    │   進行向量化          │  │
│  │ 權限         │    │ 磁碟區          │    │ ・中繼資料（SID）也   │  │
│  │ + .metadata  │    └─────────────────┘    │   一併儲存            │  │
│  │   .json      │                           └───────────┬───────────┘  │
│  └──────────────┘                                       │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ 向量儲存                  │  │
│                                          │（透過 vectorStoreType    │  │
│                                          │  選擇）                   │  │
│                                          │ ・S3 Vectors（預設）      │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ 向量資料 +               │  │
│                                          │ 中繼資料（SID 等）       │  │
│                                          │ 已儲存                   │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        搜尋與過濾流程                                    │
│                                                                         │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ 使用者    │───▶│ Next.js          │───▶│ Bedrock KB               │  │
│  │（瀏覽器） │    │ KB Retrieve API  │    │ Retrieve API             │  │
│  └──────────┘    └────────┬─────────┘    └────────────┬─────────────┘  │
│                           │                           │                │
│                           │                           ▼                │
│                           │              ┌──────────────────────────┐  │
│                           │              │ 搜尋結果                  │  │
│                           │              │ ・引用（來源文件）        │  │
│                           │              │   └─ 中繼資料             │  │
│                           │              │       └─ allowed_group_sids│ │
│                           │              └────────────┬─────────────┘  │
│                           │                           │                │
│                           ▼                           ▼                │
│              ┌──────────────────┐    ┌──────────────────────────────┐  │
│              │ DynamoDB         │    │ SID 過濾處理                  │  │
│              │ user-access      │───▶│                              │  │
│              │ ・userId          │    │ 使用者 SID ∩ 文件 SID       │  │
│              │ ・userSID         │    │ = 符合 → 允許存取           │  │
│              │ ・groupSIDs       │    │ ≠ 不符合 → 拒絕存取        │  │
│              └──────────────────┘    └──────────────┬───────────────┘  │
│                                                     │                │
│                                                     ▼                │
│                                      ┌──────────────────────────────┐  │
│                                      │ Converse API                 │  │
│                                      │ ・僅使用允許的文件           │  │
│                                      │   產生回應                   │  │
│                                      │ ・回傳過濾後的引用          │  │
│                                      └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **關於 S3 Access Point**：FSx for ONTAP 的 S3 Access Point 透過 S3 相容介面直接公開 FSx 磁碟區上的檔案。不需要將檔案複製到另一個 S3 儲存桶。Bedrock KB 將 S3 AP 別名作為資料來源參考，直接從 FSx 磁碟區匯入文件（包括 `.metadata.json`）。

---

## 詳細 SID 過濾邏輯

### 步驟 1：擷取使用者 SID

當使用者在聊天中提交問題時，KB Retrieve API 從 DynamoDB `user-access` 資料表擷取使用者的 SID 資訊。

```
DynamoDB user-access 資料表
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ (Administrator)      │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ (一般使用者)          │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ 使用者的完整 SID 列表 = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### 步驟 2：擷取文件中繼資料

Bedrock KB 搜尋結果中的每個引用都包含從 S3 上的 `.metadata.json` 檔案匯入的中繼資料。

> **`.metadata.json` 的建立方式**：本系統包含由 AD Sync Lambda（`lambda/agent-core-ad-sync/`）和 FSx 權限服務（`lambda/permissions/fsx-permission-service.ts`）實作的自動 NTFS ACL 擷取。在示範環境中，為驗證目的手動放置範例資料。詳情請參閱 [docs/embedding-server-design.md](embedding-server-design.md) 的「中繼資料結構」章節。

```
文件中繼資料（.metadata.json）
┌──────────────────────────┬──────────────────────────────────────┐
│ 文件                      │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone（所有使用者）            │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone（所有使用者）            │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ 僅限 Domain Admins               │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ 僅限 Domain Admins               │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### 步驟 3：SID 比對

將使用者的 SID 列表與文件的 `allowed_group_sids` 進行比較。

```
比對規則：使用者 SID ∩ 文件 SID ≠ ∅ → 允許

■ 管理員使用者（admin@example.com）
  使用者 SID：[S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ 使用者 SID → ✅ 允許
  public/company-overview   → S-1-1-0 ∈ 使用者 SID → ✅ 允許
  confidential/financial    → S-1-5-21-...-512 ∈ 使用者 SID → ✅ 允許
  confidential/hr-policy    → S-1-5-21-...-512 ∈ 使用者 SID → ✅ 允許
  restricted/project-plan   → S-1-5-21-...-512 ∈ 使用者 SID → ✅ 允許

■ 一般使用者（user@example.com）
  使用者 SID：[S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ 使用者 SID → ✅ 允許
  public/company-overview   → S-1-1-0 ∈ 使用者 SID → ✅ 允許
  confidential/financial    → S-1-5-21-...-512 ∉ 使用者 SID → ❌ 拒絕
  confidential/hr-policy    → S-1-5-21-...-512 ∉ 使用者 SID → ❌ 拒絕
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ 拒絕
```

### 步驟 4：失敗安全備援

當無法擷取 SID 資訊時（DynamoDB 中無記錄、連線錯誤等），系統會退回到安全側並拒絕所有文件的存取。

```
SID 擷取失敗時的流程：
  DynamoDB → 錯誤或無記錄
    → allUserSIDs = []（空）
    → 所有文件拒絕
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## 關於 SID（Security Identifier）

### SID 結構

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              網域識別碼                        相對 ID
│ │ │  └─ 子授權計數
│ │ └─ 識別碼授權（5 = NT Authority）
│ └─ 修訂版本
└─ SID 前綴
```

### 主要 SID

| SID | 名稱 | 說明 |
|-----|------|------|
| `S-1-1-0` | Everyone | 所有使用者 |
| `S-1-5-21-...-500` | Administrator | 網域管理員 |
| `S-1-5-21-...-512` | Domain Admins | 網域管理員群組 |
| `S-1-5-21-...-1001` | User | 一般使用者 |
| `S-1-5-21-...-1100` | Engineering | 工程群組 |

### FSx for ONTAP 中的 SID

FSx for ONTAP 在 NTFS 安全樣式磁碟區上支援 Windows ACL。每個檔案/目錄都設定了 ACL（存取控制清單），並以 SID 為基礎管理存取權限。

透過 S3 Access Point 存取 FSx 上的檔案時，NTFS ACL 資訊會以中繼資料形式公開。本系統將此 ACL 資訊（SID）作為 Bedrock KB 中繼資料匯入，並在搜尋時用於過濾。

---

## 詳細資料流程

### 1. 資料匯入時（Embedding）

```
FSx for ONTAP                    S3 Access Point              Bedrock KB
┌─────────────┐                ┌──────────────┐             ┌──────────────┐
│ file.md     │  S3 Access     │ S3 相容      │  KB 同步    │ 向量化       │
│ NTFS ACL:   │──Point──▶     │ 介面         │────────▶   │ + 中繼資料   │
│  Admin:Full │                │              │             │ 儲存         │
│  Users:Read │                │ file.md      │             │              │
│             │                │ file.md      │             └──────┬───────┘
│ file.md     │                │ .metadata    │                    │
│ .metadata   │                │ .json        │                    ▼
│ .json       │                │（直接從 FSx  │             ┌──────────────┐
│ {           │                │  公開）       │             │ OpenSearch   │
│  "allowed_  │                └──────────────┘             │ Serverless   │
│   group_sids│                                             │ ・vector     │
│  :["S-1-.."]│                                             │ ・text_chunk │
│ }           │                                             │ ・metadata   │
└─────────────┘                                             │  （SID 資訊）│
                                                            └──────────────┘
```

> S3 Access Point 透過 S3 相容介面直接公開 FSx 磁碟區檔案，因此不需要複製到 S3 儲存桶。

### 資料匯入路徑選項

本系統提供三條資料匯入路徑。由於截至 2026 年 3 月 S3 Access Point 不適用於 FlexCache Cache 磁碟區，因此需要備援設定。

| # | 路徑 | 方法 | CDK 啟用方式 | 使用情境 |
|---|------|------|-------------|---------|
| 1 | 主要 | FSx ONTAP Volume → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 標準磁碟區（支援 S3 AP） |
| 2 | 備援 | 手動上傳至 S3 儲存桶 → Bedrock KB | `upload-demo-data.sh` | FlexCache 磁碟區及其他不支援 S3 AP 的情況 |
| 3 | 替代 | CIFS 掛載 → Embedding 伺服器 → 直接寫入 AOSS | `-c enableEmbeddingServer=true` | FlexCache 磁碟區 + 需要直接控制 AOSS 的情況 |

路徑 2 的 S3 儲存桶（`${prefix}-kb-data-${ACCOUNT_ID}`）由 StorageStack 始終建立。當 S3 AP 不可用時，您可以將文件 + `.metadata.json` 上傳至此儲存桶並設定為 KB 資料來源，以啟用 SID 過濾。

### 2. 搜尋時（兩階段方法：Retrieve + Converse）

```
使用者            Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ 提交問題         │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ 取得 SID           │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ Retrieve API（向量搜尋 + 中繼資料）    │                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ 搜尋結果 + 中繼資料（SID）            │                │
  │                  │                    │                  │                │
  │                  │ SID 比對           │                  │                │
  │                  │（使用者 SID ∩      │                  │                │
  │                  │  文件 SID）        │                  │                │
  │                  │                    │                  │                │
  │                  │ 僅使用允許的文件產生回應                │                │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ 過濾後的結果     │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

> 使用 Retrieve API 而非 RetrieveAndGenerate API 的原因：RetrieveAndGenerate API 不會在引用的 `metadata` 欄位中包含 `.metadata.json` 的 `allowed_group_sids`，因此 SID 過濾無法運作。由於 Retrieve API 正確回傳中繼資料，因此採用兩階段方法（Retrieve → SID 過濾 → Converse）。

### 3. Agent 模式搜尋時（混合方法）

在 Agent 模式中，採用混合方法實現權限感知 RAG。由於 InvokeAgent API 不允許在應用程式端進行 SID 過濾，因此透過 KB Retrieve API + SID 過濾 + Converse API（搭配 Agent 系統提示詞）的組合來實現。

```
使用者            Next.js API           Bedrock KB          DynamoDB         Converse API
  │                  │                    │                    │                │
  │ 提交問題         │                    │                    │                │
  │─────────────────▶│                    │                    │                │
  │                  │ Retrieve API       │                    │                │
  │                  │───────────────────▶│                    │                │
  │                  │◀───────────────────│                    │                │
  │                  │ 結果 + 中繼資料    │                    │                │
  │                  │                    │                    │                │
  │                  │ 取得 SID                                │                │
  │                  │────────────────────────────────────────▶│                │
  │                  │◀────────────────────────────────────────│                │
  │                  │                    │                    │                │
  │                  │ SID 過濾           │                    │                │
  │                  │（與 KB 模式相同）  │                    │                │
  │                  │                    │                    │                │
  │                  │ 使用允許的文件 + Agent 系統提示詞產生回應│                │
  │                  │─────────────────────────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────────────────────────│
  │                  │                    │                    │                │
  │ Agent 回應       │                    │                    │                │
  │ + 引用           │                    │                    │                │
  │◀─────────────────│                    │                    │                │
```

> Bedrock Agent InvokeAgent API 也可使用，但由於 InvokeAgent API 不允許在應用程式端進行 SID 過濾，因此僅作為備援使用。混合方法是預設方式，以保證權限感知行為。

---

## API 回應範例

### 過濾日誌（filterLog）

```json
{
  "totalDocuments": 5,
  "allowedDocuments": 2,
  "deniedDocuments": 3,
  "userId": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
  "userSIDs": [
    "S-1-5-21-0000000000-0000000000-0000000000-1001",
    "S-1-1-0"
  ],
  "filterMethod": "SID_MATCHING",
  "details": [
    {
      "fileName": "product-catalog.md",
      "documentSIDs": ["S-1-1-0"],
      "matched": true,
      "matchedSID": "S-1-1-0"
    },
    {
      "fileName": "financial-report.md",
      "documentSIDs": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
      "matched": false
    }
  ]
}
```

---

## 安全設計

### 失敗安全備援原則

本系統遵循「Fail-Closed」原則，在權限檢查失敗時拒絕所有文件的存取。

| 情況 | 行為 |
|------|------|
| DynamoDB 連線錯誤 | 拒絕所有文件 |
| 無使用者 SID 記錄 | 拒絕所有文件 |
| 中繼資料中無 SID 資訊 | 拒絕對應文件 |
| SID 不符合 | 拒絕對應文件 |
| SID 符合 | 允許對應文件 |

### 權限快取

過濾結果快取在 DynamoDB `permission-cache` 資料表中，以加速相同使用者和文件組合的重複檢查（TTL：5 分鐘）。