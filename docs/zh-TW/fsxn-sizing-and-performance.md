# FSx for ONTAP 容量規劃與效能指南

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | [English](../en/fsxn-sizing-and-performance.md) | [한국어](../ko/fsxn-sizing-and-performance.md) | [简体中文](../zh-CN/fsxn-sizing-and-performance.md) | **繁體中文** | [Français](../fr/fsxn-sizing-and-performance.md) | [Deutsch](../de/fsxn-sizing-and-performance.md) | [Español](../es/fsxn-sizing-and-performance.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標讀者**: 基礎架構架構師、儲存管理員

---

## 概述

本文件提供 Permission-aware RAG 系統中 FSx for ONTAP 的容量規劃與效能設計指南。根據檔案數量、檔案大小、存取頻率和重新同步頻率整理設定建議。

---

## 依規模的建議設定

### 小型（~10,000 個檔案）— PoC / 部門使用

| 項目 | 建議值 | 備註 |
|------|--------|------|
| FSx 吞吐量容量 | 128 MB/s | 最小設定 |
| SSD 儲存容量 | 1,024 GiB | 最小設定 |
| 容量池分層 | 啟用 | 成本最佳化 |
| 向量儲存 | S3 Vectors | 低成本（每月數美元） |
| KB Auto-Sync 間隔 | 15 分鐘 | 預設值 |
| 初始索引時間 | 5–15 分鐘 | 取決於文件大小 |
| 每月預估（僅 FSx） | 約 $300–$500 | 吞吐量 + SSD |

### 中型（10,000–100,000 個檔案）— 事業單位 / 全公司使用

| 項目 | 建議值 | 備註 |
|------|--------|------|
| FSx 吞吐量容量 | 256–512 MB/s | 根據並行存取數量 |
| SSD 儲存容量 | 2,048–10,240 GiB | 根據熱資料量 |
| 容量池分層 | 啟用 | 自動將冷資料分層 |
| 向量儲存 | S3 Vectors 或 OpenSearch Serverless | 根據 QPS 需求選擇 |
| KB Auto-Sync 間隔 | 5–15 分鐘 | 根據更新頻率 |
| 初始索引時間 | 30–120 分鐘 | 可透過平行處理縮短 |
| 每月預估（僅 FSx） | 約 $1,000–$5,000 | 吞吐量 + SSD + 容量池 |

### 大型（100,000–1,000,000 個檔案）— 企業級

| 項目 | 建議值 | 備註 |
|------|--------|------|
| FSx 吞吐量容量 | 1,024–4,096 MB/s | Multi-AZ + 高吞吐量 |
| SSD 儲存容量 | 10,240+ GiB | 根據熱資料量 |
| 容量池分層 | 啟用 | 大部分資料在容量池中 |
| 向量儲存 | OpenSearch Serverless | 高 QPS、低延遲 |
| KB Auto-Sync 間隔 | 需要增量同步設計 | 全量掃描不切實際 |
| 初始索引時間 | 數小時至 1 天 | 建議批次分割 |
| 每月預估（僅 FSx） | 約 $5,000–$30,000+ | 高度取決於設定 |

---

## FSx for ONTAP 效能特性

### 吞吐量容量

FSx for ONTAP 吞吐量容量在檔案系統層級設定。

| 吞吐量 | 讀取 IOPS（SSD） | 寫入 IOPS | 網路頻寬 | 使用案例 |
|--------|-----------------|-----------|----------|----------|
| 128 MB/s | 6,000 | 1,500 | 最高 600 MB/s | PoC、小規模 |
| 256 MB/s | 12,000 | 3,000 | 最高 1.2 GB/s | 部門使用 |
| 512 MB/s | 40,000 | 10,000 | 最高 2.4 GB/s | 全公司 |
| 1,024 MB/s | 80,000 | 20,000 | 最高 4.8 GB/s | 大規模 |
| 2,048 MB/s | 160,000 | 40,000 | 最高 9.6 GB/s | 關鍵任務 |

> **參考**：Amazon FSx for ONTAP 支援最高 72 GB/s 吞吐量（12 HA pair 設定）。

### 儲存分層（Capacity Pool Tiering）

| 層級 | 特性 | 成本 | 使用案例 |
|------|------|------|----------|
| SSD | 亞毫秒延遲 | 高 | 頻繁存取的檔案 |
| 容量池 | 數十毫秒延遲 | 低（約 SSD 的 1/10） | 歸檔、不常存取 |

**RAG 系統建議**：
- `.metadata.json` 和頻繁搜尋的文件 → SSD 層級
- 歸檔文件、舊版本 → 容量池

**分層政策**：
- `auto`：一段時間未存取後自動移至容量池（建議）
- `snapshot-only`：僅將快照資料移至容量池
- `all`：將所有資料移至容量池（成本優先）
- `none`：將所有資料保留在 SSD（效能優先）

---

## S3 Access Point 注意事項

### 效能特性

FSx for ONTAP 的 S3 Access Point 透過 S3 相容介面公開 FSx 磁碟區上的檔案。

| 操作 | 延遲 | 吞吐量 | 備註 |
|------|------|--------|------|
| ListObjectsV2 | 數百毫秒 | — | 與檔案數量成正比 |
| GetObject（小檔案） | 數十至數百毫秒 | — | 針對 SSD 層級 |
| GetObject（大檔案） | 與檔案大小成正比 | 取決於 FSx 吞吐量 | 串流 |
| HeadObject | 數十毫秒 | — | 僅中繼資料 |

### Bedrock KB 同步期間的負載

KB 同步（StartIngestionJob）期間，Bedrock 透過 S3 Access Point 讀取所有文件。

| 文件數量 | 同步期間讀取負載 | 建議吞吐量 |
|----------|-----------------|-----------|
| ~1,000 | 低（數 GB） | 128 MB/s 即足夠 |
| ~10,000 | 中（數十 GB） | 建議 256 MB/s |
| ~100,000 | 高（數百 GB） | 建議 512 MB/s 或更高 |

### 雙層授權

透過 S3 Access Point 存取需要 2 層認證：

1. **IAM 認證**：S3 Access Point 政策 + IAM 身分型政策
2. **檔案系統認證**：NTFS ACL（Windows 使用者對應）

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## 向量儲存選擇標準

### S3 Vectors vs OpenSearch Serverless

| 面向 | S3 Vectors | OpenSearch Serverless |
|------|-----------|---------------------|
| 成本（小規模） | 每月數美元 | $700+/月（最少 2 OCU） |
| 成本（大規模） | 與向量數量成正比 | 與 OCU 數量成正比 |
| 查詢延遲 | 冷啟動：亞秒級，暖啟動：約 100ms | 始終約 50ms |
| 最大向量數量 | 10,000 索引/bucket | 幾乎無限制 |
| 中繼資料過濾 | 2KB/向量（可過濾） | 限制寬鬆 |
| 可擴展性 | 自動 | 手動/自動 OCU 擴展 |
| 維運負擔 | 幾乎為零 | 需要 OCU 監控 |
| 匯出 | → OpenSearch Serverless（一鍵匯出） | — |

### 選擇流程圖

```
並行使用者 < 10 且文件數量 < 10,000？
  → 是：S3 Vectors（成本優先）
  → 否：
    延遲需求 < 100ms？
      → 是：OpenSearch Serverless
      → 否：
        每月預算 < $1,000？
          → 是：S3 Vectors（延遲可接受）
          → 否：OpenSearch Serverless
```

### 遷移路徑

從 S3 Vectors → OpenSearch Serverless 的遷移可透過主控台一鍵匯出完成（約需 15 分鐘）。反向遷移透過 KB 重新同步實現。

---

## 初始索引設計

### 建議方法

| 文件數量 | 方法 | 備註 |
|----------|------|------|
| ~1,000 | 批次 KB 同步 | 單次 `StartIngestionJob` 即可完成 |
| ~10,000 | 批次 KB 同步 | 等待同步完成（30–60 分鐘） |
| ~100,000 | 批次分割 | 分割資料來源並增量同步 |
| 100,000+ | 逐步匯入 | 按資料夾匯入 → 重複同步 |

### 初始索引注意事項

1. **暫時增加 FSx 吞吐量**：初始索引期間讀取負載高，考慮暫時增加吞吐量容量
2. **S3 Access Point 並行連線**：Bedrock KB 平行讀取檔案，注意 FSx 並行連線限制
3. **預先準備 `.metadata.json`**：開始同步前確認所有文件都有 `.metadata.json`
4. **同步期間的檔案變更**：同步期間修改檔案可能導致不一致。建議初始同步期間凍結變更

---

## 增量同步設計

### KB Auto-Sync 行為

啟用 `enableKbAutoSync=true` 時的增量同步機制：

```
EventBridge Scheduler（5–15 分鐘間隔）
  → Lambda：透過 ListObjectsV2 從 S3 AP 取得檔案清單
  → DynamoDB：與先前的清單比較
  → 僅在偵測到變更時：執行 StartIngestionJob
  → 若存在 IN_PROGRESS 的工作：跳過（去重複）
```

### 變更偵測機制

| 偵測目標 | 方法 | 備註 |
|----------|------|------|
| 新檔案 | LastModified 比較 | DynamoDB 清單中不存在的 Key |
| 更新的檔案 | ETag / LastModified 比較 | 值已變更的 Key |
| 刪除的檔案 | 清單差異 | DynamoDB 中存在但 S3 AP 中不存在的 Key |

### 大規模增量同步的挑戰

| 檔案數量 | ListObjectsV2 耗時 | 對策 |
|----------|-------------------|------|
| ~10,000 | 數秒 | 無問題 |
| ~100,000 | 數十秒 | 延長 Lambda 逾時（15 分鐘） |
| 100,000+ | 數分鐘以上 | 前綴分割、Step Functions |

---

## QoS（服務品質）設計

當多個租戶或工作負載共享 FSx 時，可透過 QoS 政策控制效能。

### 建議 QoS 設定

| 工作負載 | 優先順序 | IOPS 限制 | 吞吐量限制 |
|----------|----------|-----------|-----------|
| RAG 搜尋（透過 S3 AP） | 高 | 無限制 | 無限制 |
| KB 同步（批次） | 中 | 5,000 IOPS | 100 MB/s |
| 使用者 CIFS/SMB 存取 | 高 | 無限制 | 無限制 |
| 備份 / SnapMirror | 低 | 2,000 IOPS | 50 MB/s |

### 套用 QoS 政策

```bash
# 透過 ONTAP CLI 建立 QoS 政策群組
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# 將 QoS 政策套用至磁碟區
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## 容量監控與自動擴展

### 監控指標

| 指標 | 閾值 | 動作 |
|------|------|------|
| SSD 使用率 | > 80% | 擴展容量或檢視分層政策 |
| 容量池使用率 | > 90% | 擴展容量 |
| IOPS 使用率 | > 80% | 增加吞吐量容量 |
| 網路頻寬使用率 | > 70% | 增加吞吐量容量 |

### 自動擴展（FSx for ONTAP Ops）

`automation/fsxn-ops/` 中包含的容量監控 Lambda 執行自動擴展：

- 透過 EventBridge 每 5 分鐘監控磁碟區使用率
- 超過閾值時自動擴展磁碟區大小
- 容量護欄（每日限制、冷卻期間）防止過度擴展
- CloudWatch Dashboard 視覺化擴展歷史

---

## 成本最佳化技巧

### 1. 善用容量池分層

大多數 RAG 搜尋目標文件在嵌入後很少被存取。將分層政策設為 `auto`，自動將不常存取的資料移至低成本層級。

### 2. 適當調整吞吐量容量

初始索引後讀取負載大幅降低。初始時使用高吞吐量同步，然後在運作階段降低吞吐量以削減成本。

```bash
# 變更吞吐量容量（無停機時間）
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. 善用 S3 Vectors

對於中小型環境，使用 S3 Vectors（每月數美元）以避免 OpenSearch Serverless 成本（$700+/月）。當效能需求增加時可一鍵匯出。

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [permission-consistency.md](permission-consistency.md) | 權限變更一致性模型 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | S3 Vectors + SID 架構 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3 種設定比較 |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | FSx for ONTAP 維運自動化 |
