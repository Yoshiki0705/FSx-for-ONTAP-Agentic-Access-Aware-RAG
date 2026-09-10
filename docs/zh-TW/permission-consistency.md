# 權限中繼資料變更一致性模型

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | **繁體中文** | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**建立日期**: 2026-05-21
**更新日期**: 2026-09-07（依據實作查核，撤回以 ACL 為起點的自動反映流程之敘述）
**狀態**: 草案
**目標讀者**: 維運設計師、安全工程師

---

## 概述

本文件定義搜尋時用於權限判定的資料發生變更後，何時反映至搜尋結果。用於判定的有兩項：文件側的 `.metadata.json` 與使用者側的 DynamoDB `user-access`。

**不存在自動跟隨 FSx for ONTAP 上檔案 NTFS ACL 變更的機制。** 權限索引並非 ACL 的投影，而是另行建置與維護的索引。原因與維運上的含意見「ACL 變更無法到達的原因」。

---

## 用於權限判定的資料

| 資料 | 存放位置 | 產生·更新主體 | 搜尋時的作用 |
|------|---------|------------|------------|
| `.metadata.json`（`allowed_group_sids` / `allowed_uids` / `allowed_gids`） | S3 AP 上的相鄰物件 → Bedrock KB 的中繼資料屬性 | 因路徑而異（見下表） | 取得區塊的許可 SID / UID / GID 集合 |
| `user-access`（`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`） | DynamoDB | AD / LDAP 同步 Lambda（`lambda/agent-core-ad-sync/`） | 呼叫者的 SID / UID / GID 集合 |
| `perm-cache` | DynamoDB（TTL 5 分鐘） | 權限過濾器 | 判定結果的快取 |

`.metadata.json` 的產生來源：

| 路徑 | 產生來源 | 契機 |
|------|--------|------|
| Transfer Family SFTP（`enableTransferFamily=true`） | 管理員維護的 DynamoDB 對應表（以上傳使用者名稱為鍵） | 檔案上傳時 |
| 自建嵌入伺服器（`ENV_AUTO_METADATA=true`，選用·非預設） | 透過 ONTAP REST API 取得真實 NTFS ACL | 偵測到未處理檔案時（以 mtime 判定） |
| 示範環境 | 手動放置儲存庫隨附的範例 | 手動 |

SFTP 使用者被授予對 `*.metadata.json` 的 IAM Deny，因此上傳者無法撰寫自己的權限。

---

## 反映路徑

自動反映的路徑有 2 條。

### 路徑 A：文件側權限變更

| 階段 | 承擔者 | 延遲 |
|------|-------|------|
| ① `.metadata.json` 更新 | 上表的產生來源，或管理員直接更新 | 取決於契機 |
| ② 差異偵測 | KB Auto-Sync（EventBridge Scheduler，比較 `size` / `lastModified` / `ETag`） | 輪詢間隔（預設 15 分鐘） |
| ③ 向量儲存更新 | `StartIngestionJob` | 1~15 分鐘（取決於件數） |
| ④ 判定結果快取失效 | `perm-cache` 的 TTL | 最長 5 分鐘 |

### 路徑 B：使用者側權限變更

| 階段 | 承擔者 | 延遲 |
|------|-------|------|
| ① AD 群組成員資格變更 | AD 複寫 | 通常 15 分鐘以內 |
| ② `user-access` 更新 | AD / LDAP 同步 Lambda。**由 Cognito 的 PostAuthentication / PostConfirmation 觸發，沒有排程執行** | 直到該使用者下次登入（不定） |
| ③ 判定結果快取失效 | `perm-cache` 的 TTL，或透過 `user-access` 的 DynamoDB Streams 明確失效 | 最長 5 分鐘 |

路徑 B 的 ② 對工作階段仍持續的使用者不會到達。若需可靠撤銷，請使用「緊急權限撤銷步驟」。

---

## ACL 變更無法到達的原因

即使變更檔案的 NTFS ACL，在任何部署設定下 `.metadata.json` 都不會被重新產生。實作查核結果如下。

| 機制 | ACL 變更時是否執行 | 依據 |
|------|---------------|------|
| AD / LDAP 同步 Lambda | 不執行 | 既未實作 ACL 取得，也未實作 `.metadata.json` 寫入。取得的僅為 AD 上的使用者 SID |
| Transfer Family 的中繼資料產生 | 不執行 | 契機為檔案上傳。產生來源是管理員維護的 DynamoDB 對應表，不參照 ACL |
| 自建嵌入伺服器（`ENV_AUTO_METADATA=true`） | 不執行 | 重新處理的判定基於 `mtime`。僅變更 ACL 不會改變 `mtime` |
| KB Auto-Sync | 不執行 | 差異判定基於 `size` / `lastModified` / `ETag`。ACL 變更不會改變其中任何一項 |
| FSx 權限服務（`lambda/permissions/fsx-permission-service.ts`） | 不在範圍內 | 讀取 ACL 的程式碼存在，但沒有任何 CDK 堆疊部署它 |

**含意**：要將 ACL 變更反映到搜尋結果，需由維運人員重新產生 `.metadata.json` 並放置到 S3 AP。該索引的正確性依賴維運，與 ACL 的一致並非自動保證。緊急阻斷存取請在使用者側執行（刪除 `user-access` + 清除快取 + 使工作階段失效），而非變更 ACL。

---

## 各階段的詳細

### 向量儲存更新（KB 重新同步）

| 方式 | 觸發 | 延遲 | 備註 |
|------|-----|------|------|
| KB Auto-Sync | EventBridge Scheduler（輪詢） | 設定間隔（預設：15 分鐘） | `enableKbAutoSync=true` 時。僅在偵測到檔案變更時執行 StartIngestionJob |
| 手動 KB 同步 | AWS 主控台 / CLI | 立即開始，完成需數分鐘 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail 事件 | S3 PutObject | 數分鐘 | Transfer Family 路徑下 `enableCloudTrailIngestion=true` 時 |

**KB 同步耗時參考：**

| 文件數 | 同步時間（參考） |
|-------|--------------|
| ~100 件 | 1~3 分鐘 |
| ~1,000 件 | 5~15 分鐘 |
| ~10,000 件 | 30~60 分鐘 |
| ~100,000 件 | 數小時（建議增量同步） |

### 權限快取失效

| 快取 | TTL | 失效方式 | 備註 |
|------|-----|--------|------|
| DynamoDB `perm-cache` | 5 分鐘 | TTL 自動過期 / 透過 `user-access` 的 Streams 明確刪除 | 過濾結果的快取 |
| DynamoDB `user-access` | 無（持久） | 需要明確更新 | 使用者 SID / 群組 SID |
| 瀏覽器工作階段 | 工作階段期間 | 登出 / 工作階段過期 | 前端的記憶體快取 |

---

## 最大延遲（Permission Propagation Delay）

| 起點 | 最大延遲 | 明細 |
|------|--------|------|
| 文件側權限變更（路徑 A，Auto-Sync 15 分鐘間隔） | 約 35 分鐘 | 輪詢 15 分鐘 + KB 同步 15 分鐘 + 快取 5 分鐘 |
| 文件側權限變更（Auto-Sync 5 分鐘間隔） | 約 25 分鐘 | 輪詢 5 分鐘 + KB 同步 15 分鐘 + 快取 5 分鐘 |
| 文件側權限變更（手動 KB 同步） | 約 20 分鐘 | KB 同步 15 分鐘 + 快取 5 分鐘 |
| 使用者側權限變更（路徑 B） | 無法定義 | AD 複寫 15 分鐘 + 直到下次登入（不定）+ 快取 5 分鐘 |
| 緊急權限撤銷（下述步驟） | 最長 5 分鐘 | 強制清除快取 + Fail-Closed |
| 檔案的 ACL 變更 | **無法定義** | 沒有自動跟隨的機制。前提是維運人員重新產生 `.metadata.json` |

KB 同步的 15 分鐘取決於文件數（參見上文耗時參考）。1 萬件規模為 30~60 分鐘，合計延遲也相應增加。

---

## 緊急權限撤銷步驟

需要立即撤銷使用者存取權限時：

### 步驟 1：從 DynamoDB 刪除使用者 SID（立即生效）

```bash
# 刪除使用者的 SID 資料 → 依據 Fail-Closed 拒絕全部文件
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 步驟 2：強制清除權限快取

```bash
# 刪除該使用者的快取項目
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

### 步驟 3：停用 Cognito 使用者（使工作階段失效）

```bash
# 停用 Cognito 使用者
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 效果

- 執行步驟 1 後：新的搜尋請求立即拒絕全部文件（Fail-Closed）
- 執行步驟 2 後：防止使用已快取的舊權限資訊
- 執行步驟 3 後：使使用者的工作階段本身失效

**請注意該步驟阻斷的是使用者側，而非文件側。** 只對某一個人隱藏某一份文件的操作，需要等待 `.metadata.json` 更新與 KB 重新同步，因此會受到路徑 A 的延遲影響。

---

## 各權限變更情境的行為

### 情境 1：文件的權限中繼資料變更

```
管理員從檔案 A 的 .metadata.json 中刪除 User X 的 SID
  → KB Auto-Sync 偵測到差異（ETag 變化）
  → 透過 StartIngestionJob 更新向量儲存的中繼資料
  → perm-cache 的 TTL 失效後，User X 的搜尋中排除檔案 A
```

**延遲**：最長約 35 分鐘（Auto-Sync 15 分鐘間隔時）

### 情境 2：AD 群組成員資格變更

```
管理員將 User X 從 Engineering 群組中刪除
  → AD 複寫（~15 分鐘）
  → 在 User X 下次登入時，AD 同步 Lambda 更新 user-access 的 groupSIDs
  → perm-cache 失效後，排除僅限 Engineering 的文件
```

**延遲**：AD 複寫 + 直到下次登入（不定）+ 快取 TTL。**工作階段持續期間不會反映。** 需要即時性時請使用緊急權限撤銷步驟。

### 情境 3：檔案移動（rename / move）

```
管理員將檔案 A 從 /public/ 移動到 /confidential/
  → 在 FSx 上重新計算繼承權限（僅 ONTAP 側的有效權限）
  → .metadata.json 不會自動跟隨目標位置的權限
  → 需由維運人員重新產生並放置 .metadata.json
```

**注意**：來源位置的許可 SID 仍然保留，因此僅移動不會改變搜尋上的可見性。若將目錄結構用作權限邊界，請把移動與 `.metadata.json` 更新合併為一個步驟。

### 情境 4：上層資料夾的 ACL 批次變更

```
管理員變更 /confidential/ 資料夾的 ACL（啟用繼承）
  → 其下全部檔案在 ONTAP 上的有效權限發生變更
  → .metadata.json 不跟隨（參見「ACL 變更無法到達的原因」）
  → 需要重新產生其下檔案的 .metadata.json 並重新同步 KB
```

**注意**：大量檔案的批次變更會使 KB 同步耗時。建議分階段變更。

---

## 一致性保證等級

**基於時間的存取控制（`enableAdvancedPermissions`）在失敗時分為兩種方向。** 設定缺陷（無效時區、無法按 `HH:mm` 解析的時刻）為 fail-open：解除時間限制並允許存取（避免將使用者鎖在外面）。而**當時鐘本身無法讀取時則拒絕** —— 在無法判斷是否處於時間範圍內的情況下允許存取，會使時間限制被靜默解除。兩種情況下 SID 比對都獨立生效，因此該分支不會削弱權限索引的判定。

| 等級 | 保證內容 | 實作方式 |
|------|--------|--------|
| **Fail-Closed** | 無法取得 SID 資訊時全部拒絕 | DynamoDB 出錯時 / 無記錄時 |
| **Eventually Consistent** | 權限中繼資料（`.metadata.json` / `user-access`）的變更最終反映到搜尋結果 | KB Auto-Sync + 快取 TTL + Streams 失效 |
| **No False Positive** | 不顯示無權限的文件 | SID 比對（集合的交集） |
| **Metadata Required** | 排除沒有中繼資料的文件 | 必須有 `.metadata.json` |
| **ACL 跟隨的不成立** | 檔案的 ACL 變更不會自動反映 | 前提是維運人員重新產生 `.metadata.json` |

### 注意：False Negative 的可能性

以下情況下，本應可存取的文件可能暫時不顯示（False Negative）：

- 授權後立即（`.metadata.json` 未更新，或在 KB 重新同步之前）
- KB 同步中（舊中繼資料仍殘留）
- AD 複寫延遲中，或目標使用者重新登入之前

**設計方針**：出於安全考量，允許 False Negative（應當可見的看不到），並以 False Positive（不應可見的被看到）為零為目標。

但**該方針以權限索引正確為前提。** 若收緊了 ACL 卻未更新 `.metadata.json`，索引側仍會回傳許可，從而產生 False Positive。索引的維護本身就是邊界。

---

## 監控·警示建議設定

```yaml
# CloudWatch Alarm 建議設定
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # 快取未命中率高 = 權限資料更新頻率高

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 連續 3 次失敗警示

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID 解析失敗立即警示

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed 觸發較多時需要調查
```

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 過濾設計詳情 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 正式環境化檢查清單 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 效能·容量設計 |
