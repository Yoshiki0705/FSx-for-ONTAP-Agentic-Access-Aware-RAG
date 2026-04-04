# Embedding 伺服器設計與實作文件

**🌐 Language:** [日本語](../embedding-server-design.md) | [English](../en/embedding-server-design.md) | [한국어](../ko/embedding-server-design.md) | [简体中文](../zh-CN/embedding-server-design.md) | **繁體中文** | [Français](../fr/embedding-server-design.md) | [Deutsch](../de/embedding-server-design.md) | [Español](../es/embedding-server-design.md)

**建立日期**: 2026-03-26  
**對象讀者**: 開發人員與維運人員  
**原始碼**: `docker/embed/`

---

## 概述

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

此伺服器透過 CIFS/SMB 掛載讀取 FSx ONTAP 上的文件，使用 Amazon Bedrock Titan Embed Text v2 進行向量化，並索引至 OpenSearch Serverless (AOSS)。

> **注意**：Embedding 伺服器僅在 AOSS 設定（`vectorStoreType=opensearch-serverless`）下可用。使用 S3 Vectors 設定（預設）時，Bedrock KB 會自動管理 Embedding，因此不需要 Embedding 伺服器。

它作為 Bedrock KB S3 資料來源（選項 A）或 S3 Access Point（選項 C）無法使用時的替代路徑（選項 B）。

---

## 架構

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. 檔案掃描（遞迴，.md/.txt/.html 等）
  ├── 2. 從 .metadata.json 讀取 SID 資訊
  ├── 3. 文字分塊（1000 字元，200 字元重疊）
  ├── 4. 使用 Bedrock Titan Embed v2 向量化（1024 維度）
  └── 5. 索引至 AOSS（Bedrock KB 相容格式）
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## 原始碼結構

```
docker/embed/
├── src/
│   ├── index.ts       # 主要處理（掃描 → 分塊 → Embedding → 索引）
│   └── oss-client.ts  # AOSS SigV4 簽署用戶端（IMDS 認證支援）
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild 建構定義
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## 執行模式

| 模式 | 環境變數 | 行為 |
|------|---------|------|
| 批次模式 | `ENV_WATCH_MODE=false`（預設） | 處理所有檔案一次後結束 |
| 監視模式 | `ENV_WATCH_MODE=true` | 使用 chokidar 偵測檔案變更並自動處理 |

---

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `ENV_REGION` | `ap-northeast-1` | AWS 區域 |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | CIFS 掛載的資料目錄 |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | 已處理檔案記錄的儲存位置 |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Embedding 模型 |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | AOSS 索引名稱 |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | （必要） | AOSS 集合名稱 |
| `ENV_WATCH_MODE` | `false` | 啟用監視模式 |
| `ENV_AUTO_METADATA` | `false` | 透過 ONTAP REST API 自動產生 .metadata.json |
| `ENV_ONTAP_MGMT_IP` | （空） | ONTAP 管理端點 IP |
| `ENV_ONTAP_SVM_UUID` | （空） | SVM UUID |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | ONTAP 管理員使用者名稱 |
| `ENV_ONTAP_PASSWORD` | （空） | ONTAP 管理員密碼 |

---

## 處理流程

### 批次模式

```
1. 初始化 AOSS 用戶端（擷取集合端點）
2. 載入 processed.json（用於差異處理）
3. 遞迴掃描 DATA_DIR（.md、.txt、.html、.csv、.json、.xml）
4. 對每個檔案：
   a. 如果 mtime 與 processed.json 相符則跳過
   b. 如果存在 .metadata.json 則使用
   c. 如果 .metadata.json 不存在且 ENV_AUTO_METADATA=true：
      - 透過 ONTAP REST API 擷取 ACL（`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`）
      - 從 ACL 提取 SID 並自動產生/寫入 .metadata.json
   d. 讀取文字 → 分塊（1000 字元，200 字元重疊）
   e. 使用 Bedrock Titan Embed v2 向量化每個分塊
   f. 索引至 AOSS（Bedrock KB 相容格式）
   g. 更新 processed.json
5. 輸出處理摘要並結束
```

### 監視模式

```
1-5. 與批次模式相同（初始掃描）
6. 使用 chokidar 開始檔案監視
   - awaitWriteFinish: 2 秒（等待寫入完成）
7. 檔案新增/變更事件 → 加入佇列
8. 從佇列依序處理（透過 `processing` 旗標防止並行執行）
   - processFile() → 更新 processed.json
9. 在無限迴圈中等待
```

---

## 差異處理機制

檔案路徑和修改時間（mtime）記錄在 `processed.json` 中。

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- 如果檔案的 mtime 未變更則跳過
- 如果檔案已更新則重新處理（覆寫索引）
- 刪除 `processed.json` 可重新處理所有檔案

### 與先前版本的差異

| 項目 | 先前版本 | 目前版本 |
|------|---------|---------|
| 差異管理 | SQLite (drizzle-orm + better-sqlite3) | JSON 檔案 (processed.json) |
| 檔案識別 | inode 編號 (files.ino) | 檔案路徑 + mtime |
| 大量檔案同時上傳 | UNIQUE constraint failed | ✅ 透過循序佇列安全處理 |
| 相依性 | drizzle-orm, better-sqlite3 | 無（標準 fs） |

---

## AOSS 索引格式

僅寫入 3 個 Bedrock KB 相容欄位。

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024 維度
  "AMAZON_BEDROCK_TEXT_CHUNK": "文件文字分塊",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### 重要：AOSS 索引結構描述相容性

AOSS 索引以 `dynamic: false` 建立。這表示：
- 即使寫入上述 3 個以外的欄位，索引對應也不會變更
- Bedrock KB 同步不會導致「storage configuration invalid」錯誤
- 中繼資料（SID 資訊等）以 JSON 字串儲存在 `AMAZON_BEDROCK_METADATA` 欄位中

### 中繼資料結構

每個文件需要對應的 `.metadata.json` 檔案。透過在此檔案中包含 NTFS ACL SID 資訊，可實現 RAG 搜尋時的存取控制。

#### 如何取得 `.metadata.json` 的 SID 資訊

本系統具有從 NTFS ACL 自動擷取 SID 的機制。

| 元件 | 實作檔案 | 功能 |
|------|---------|------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | 透過 SSM 執行 PowerShell 擷取 AD 使用者 SID 資訊並儲存至 DynamoDB |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | 透過 SSM 執行 Get-Acl 擷取檔案/目錄的 NTFS ACL (SID) |
| AD Sync 設定 | `types/agentcore-config.ts` (`AdSyncConfig`) | AD 同步啟用、快取 TTL、SSM 逾時等設定 |

這些是未來擴充選項。在目前的 demo 堆疊設定（`lib/stacks/demo/`）中，為驗證目的手動放置範例 `.metadata.json` 檔案。

#### SID 自動擷取處理流程

```
1. AD Sync Lambda（使用者 SID 擷取）
   SSM → Windows EC2 → PowerShell (Get-ADUser) → 擷取 SID → 儲存至 DynamoDB user-access

2. FSx Permission Service（檔案 ACL 擷取）
   SSM → Windows EC2 → PowerShell (Get-Acl) → 擷取 NTFS ACL → 提取 SID → 可產生 .metadata.json
```

#### 示範環境的簡化設定

demo 堆疊不使用上述自動化，而是透過以下手動步驟設定 SID 資料：

- `.metadata.json`：手動放置在 `demo-data/documents/` 下的範例
- DynamoDB user-access：使用 `demo-data/scripts/setup-user-access.sh` 手動註冊電子郵件到 SID 的對應

#### 生產環境的自動化選項

| 方法 | 說明 |
|------|------|
| AD Sync Lambda | 透過 SSM 自動擷取 AD 使用者 SID 並儲存至 DynamoDB（已實作） |
| FSx Permission Service | 透過 SSM 的 Get-Acl 擷取 NTFS ACL（已實作） |
| ONTAP REST API | 透過 FSx ONTAP 管理端點直接擷取 ACL（已實作：`ENV_AUTO_METADATA=true`） |
| S3 Access Point | 透過 S3 AP 存取檔案時自動套用 NTFS ACL（CDK 支援：`useS3AccessPoint=true`） |

#### 使用 S3 Access Point 時（選項 C）

當 Bedrock KB 透過 S3 Access Point 匯入文件時，NTFS ACL 會透過 S3 Access Point 的 `FileSystemIdentity`（WINDOWS 類型）自動套用。但是，Bedrock KB Retrieve API 回傳的中繼資料是否包含 ACL 資訊取決於 S3 Access Point 的實作。目前，透過 `.metadata.json` 管理 SID 是可靠的方法。

#### `.metadata.json` 格式

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → 儲存在 AMAZON_BEDROCK_METADATA 中的值
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## AOSS 認證（SigV4 簽署）

`oss-client.ts` 使用 AWS SigV4 簽署存取 AOSS。

- 自動從 EC2 執行個體設定檔（IMDS）擷取憑證
- 使用 `@aws-sdk/credential-provider-node` 的 defaultProvider
- 憑證在到期前 5 分鐘自動更新
- AOSS 的服務名稱為 `aoss`

---

## 大量檔案同時上傳處理

在監視模式下同時上傳 20 個以上檔案時：

1. 使用 chokidar 的 `awaitWriteFinish` 等待寫入完成（2 秒）
2. 每個檔案事件加入佇列
3. 從佇列一次處理一個檔案（透過 `processing` 旗標進行排他控制）
4. 每個分塊 Embedding 後等待 200ms（Bedrock API 速率限制對策）
5. 處理完成後更新 `processed.json`

這確保了：
- 不違反 Bedrock API 速率限制
- 不會並行寫入 `processed.json`
- 如果處理中途停止，已記錄在 `processed.json` 中的檔案不會被重新處理

---

## CDK 堆疊

`DemoEmbeddingStack`（`lib/stacks/demo/demo-embedding-stack.ts`）建立以下資源：

| 資源 | 說明 |
|------|------|
| EC2 執行個體 (m5.large) | 強制 IMDSv2、啟用 SSM |
| ECR 儲存庫 | 用於 Embedding 容器映像 |
| IAM 角色 | SSM、FSx、AOSS、Bedrock、ECR、Secrets Manager |
| 安全群組 | 允許與 FSx SG + AD SG 通訊 |
| UserData | 自動 CIFS 掛載 + Docker 自動啟動 |

### 啟用方式

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## 疑難排解

| 症狀 | 原因 | 解決方式 |
|------|------|---------|
| AOSS 403 Forbidden | EC2 角色未加入資料存取政策 | 將 Embedding EC2 角色加入 AOSS 政策 |
| Bedrock ThrottlingException | API 速率限制超標 | 增加分塊間的等待時間（200ms → 500ms） |
| CIFS 掛載失敗 | SVM 未加入 AD 或未建立 CIFS 共用 | 驗證 AD 加入 + 透過 ONTAP REST API 建立 CIFS 共用 |
| processed.json 損毀 | 處理中斷 | 刪除 `processed.json` 並重新執行 |
| KB 同步錯誤（storage config invalid） | AOSS 索引中存在 KB 不相容的欄位 | 刪除索引 → 重新建立 → 重新建立資料來源 → 同步 |
| 所有文件被 SID 過濾拒絕 | 透過 Embedding 伺服器的文件沒有中繼資料 | 驗證 `.metadata.json` 存在且 `allowed_group_sids` 已設定 |

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [README.md](../../README.zh-TW.md) | 部署步驟（選項 B） |
| [docs/implementation-overview.md](implementation-overview.md) | 實作概述（第 5 項：Embedding 伺服器） |
| [docs/ui-specification.md](ui-specification.md) | UI 規格（目錄顯示） |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | 驗證環境操作程序 |