# 權限變更一致性模型

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | **繁體中文** | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標讀者**: 維運設計師、安全工程師

---

## 概述

本文件闡明 FSx for ONTAP 上的檔案 ACL 變更何時以及如何反映至向量儲存和權限快取，並定義權限變更期間的一致性保證等級。

---

## 整體權限資料流

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     權限變更傳播流程                                            │
│                                                                              │
│  ① ACL 變更        ② 中繼資料重新產生   ③ KB 重新同步       ④ 快取           │
│                                                                    失效      │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json update │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ Change   │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │expiry  │  │
│  管理員變更          服務角色              KB Auto-Sync          └────────┘  │
│  檔案權限           Lambda 重新取得       （EventBridge           5 分鐘 TTL  │
│                     ACL                   Scheduler）            自動失效    │
│                                           或手動觸發                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 步驟詳細說明

### 步驟 ①：ACL 變更（FSx for ONTAP）

| 操作 | 反映時機 | 備註 |
|------|----------|------|
| 檔案 ACL 變更 | 立即（在 FSx 上） | NTFS ACL 立即反映於 FSx 磁碟區 |
| 群組成員變更 | AD 傳播後（通常 15 分鐘內） | 取決於 AD 複寫延遲 |
| 檔案移動（rename/move） | 立即（在 FSx 上） | 繼承權限重新計算 |
| 繼承權限變更 | 立即（在 FSx 上） | 父資料夾 ACL 變更傳播至子項目 |

### 步驟 ②：中繼資料重新產生

更新 `.metadata.json` 中 `allowed_group_sids` 的方法：

| 方法 | 觸發條件 | 延遲 | 備註 |
|------|----------|------|------|
| 透過 Transfer Family 上傳 | 檔案上傳時 | 立即 | 當 `enableTransferFamily=true` 時。自動為上傳檔案產生中繼資料 |
| AD Sync Lambda | 手動 / 排程 | 取決於設定 | `lambda/agent-core-ad-sync/` 重新取得 NTFS ACL |
| 手動更新 | 管理員操作 | 立即 | 對於 S3 bucket fallback 路徑，直接更新 `.metadata.json` |

### 步驟 ③：向量儲存更新（KB 重新同步）

| 方法 | 觸發條件 | 延遲 | 備註 |
|------|----------|------|------|
| KB Auto-Sync | EventBridge Scheduler（輪詢） | 設定間隔（預設：15 分鐘） | 當 `enableKbAutoSync=true` 時。僅在偵測到檔案變更時執行 StartIngestionJob |
| 手動 KB 同步 | AWS Console / CLI | 立即開始，數分鐘內完成 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail 事件 | S3 PutObject | 數分鐘 | 當 Transfer Family 路徑啟用 `enableCloudTrailIngestion=true` 時 |

**KB 同步預估時間：**

| 文件數量 | 同步時間（預估） |
|----------|-----------------|
| ~100 | 1–3 分鐘 |
| ~1,000 | 5–15 分鐘 |
| ~10,000 | 30–60 分鐘 |
| ~100,000 | 數小時（建議使用增量同步） |

### 步驟 ④：權限快取失效

| 快取 | TTL | 失效方法 | 備註 |
|------|-----|----------|------|
| DynamoDB `perm-cache` | 5 分鐘 | 自動 TTL 到期 | 過濾結果快取 |
| DynamoDB `user-access` | 無（持久性） | 需明確更新 | 使用者 SID / 群組 SID |
| 瀏覽器工作階段 | 工作階段期間 | 登出 / 工作階段到期 | 前端記憶體快取 |

---

## 最大權限傳播延遲

### 正常運作

```
ACL 變更 → 中繼資料重新產生 → KB 重新同步 → 快取到期
  0 分鐘      0–15 分鐘          1–15 分鐘     0–5 分鐘
                                              
最大延遲：約 35 分鐘（15 分鐘輪詢 + 15 分鐘 KB 同步 + 5 分鐘快取）
```

### RPO 風格表達

| 情境 | 最大延遲 | 說明 |
|------|----------|------|
| 正常運作（KB Auto-Sync 15 分鐘間隔） | 最大 35 分鐘 | 輪詢間隔 + KB 同步 + 快取 TTL |
| 高頻同步（KB Auto-Sync 5 分鐘間隔） | 最大 15 分鐘 | 縮短輪詢間隔 |
| 手動立即同步 | 最大 10 分鐘 | 手動 KB 同步 + 快取 TTL |
| 緊急權限撤銷 | 最大 5 分鐘 | 強制清除快取 + Fail-Closed |

---

## 緊急權限撤銷程序

當需要立即撤銷使用者的存取權限時：

### 步驟 1：從 DynamoDB 刪除使用者 SID（立即生效）

```bash
# 刪除使用者的 SID 資料 → Fail-Closed 拒絕所有文件
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 步驟 2：強制清除權限快取

```bash
# 刪除目標使用者的快取項目
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### 步驟 3：停用 Cognito 使用者（工作階段失效）

```bash
# 停用 Cognito 使用者
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 效果

- 步驟 1 之後：新的搜尋請求立即拒絕所有文件（Fail-Closed）
- 步驟 2 之後：防止使用快取的舊權限資訊
- 步驟 3 之後：使使用者的工作階段本身失效

---

## 各權限變更情境的行為

### 情境 1：檔案 ACL 變更

```
管理員從檔案 A 的 ACL 中移除使用者 X
  → 從 .metadata.json 的 allowed_group_sids 中移除使用者 X 的 SID
  → KB 重新同步更新向量儲存中繼資料
  → 檔案 A 從使用者 X 的下次搜尋結果中排除
```

**延遲**：最大 35 分鐘（正常運作）

### 情境 2：AD 群組成員變更

```
管理員從 Engineering 群組中移除使用者 X
  → AD 複寫（約 15 分鐘）
  → DynamoDB user-access 的 groupSIDs 更新（在 AD Sync Lambda 執行時）
  → Engineering 群組限制的文件從使用者 X 的下次搜尋中排除
```

**延遲**：AD 複寫 + AD Sync Lambda 執行間隔 + 快取 TTL

### 情境 3：檔案移動（rename / move）

```
管理員將檔案 A 從 /public/ 移動至 /confidential/
  → FSx 上重新計算繼承權限
  → 需要重新產生 .metadata.json
  → KB 重新同步更新向量儲存中繼資料
```

**注意**：檔案移動時可能不會自動重新產生 `.metadata.json`。建議設計為 KB Auto-Sync 輪詢偵測檔案路徑變更並觸發中繼資料重新產生。

### 情境 4：繼承權限變更

```
管理員變更 /confidential/ 資料夾的 ACL（啟用繼承）
  → 底下所有檔案的有效權限變更
  → 每個檔案都需要重新產生 .metadata.json
  → KB 重新同步
```

**注意**：大量檔案的批次權限變更需要較長的 KB 同步時間。建議逐步變更。

---

## 一致性保證等級

| 等級 | 保證 | 實作方式 |
|------|------|----------|
| **Fail-Closed** | 無法取得 SID 資訊時拒絕所有 | DynamoDB 錯誤 / 無記錄時 |
| **最終一致性** | ACL 變更最終會反映在搜尋結果中 | KB Auto-Sync + 快取 TTL |
| **無偽陽性** | 無權限的文件永遠不會顯示 | SID 比對（集合交集） |
| **需要中繼資料** | 沒有中繼資料的文件會被排除 | 需要 `.metadata.json` |

### 注意：偽陰性的可能性

在以下情況下，應可存取的文件可能暫時不會顯示（偽陰性）：

- 權限授予後立即（中繼資料尚未更新）
- KB 同步期間（舊中繼資料仍存在）
- AD 複寫延遲期間

**設計原則**：基於安全考量，容許偽陰性（可存取的項目不可見），而偽陽性（受限項目可見）以零發生為目標。

---

## 建議的監控與警報設定

```yaml
# 建議的 CloudWatch Alarm 設定
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # 高快取未命中率 = 權限資料更新頻率高
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 連續 3 次失敗時警報
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID 解析失敗時立即警報
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed 頻繁觸發時調查
```

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 過濾架構詳細說明 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生產就緒檢查清單 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 容量規劃與效能 |
