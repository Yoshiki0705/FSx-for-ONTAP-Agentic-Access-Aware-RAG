# 成本估算工作表

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | [English](../en/cost-estimation-worksheet.md) | [한국어](../ko/cost-estimation-worksheet.md) | [简体中文](../zh-CN/cost-estimation-worksheet.md) | **繁體中文** | [Français](../fr/cost-estimation-worksheet.md) | [Deutsch](../de/cost-estimation-worksheet.md) | [Español](../es/cost-estimation-worksheet.md)

**建立日期**: 2026-05-23  
**狀態**: 草稿  
**對象**: 專案經理、合作夥伴提案負責人、預算制定者

> **⚠️ 注意**: 本工作表中的價格是基於 2026 年 5 月 ap-northeast-1 區域公開價格的參考值。實際成本因區域、使用量、折扣和價格調整而異。最新價格請參閱 [AWS Pricing](https://aws.amazon.com/pricing/)。

---

## 輸入參數

請填寫以下值以估算月度成本。

| 參數 | 值 | 備註 |
|------|-----|------|
| 文件數量 | _____ 個 | FSx 磁碟區上的檔案數 |
| 平均文件大小 | _____ KB | 文字換算 |
| 每日查詢數 | _____ 次/天 | 所有使用者合計 |
| 同時使用者數 | _____ 人 | 尖峰時段 |
| 註冊使用者數 | _____ 人 | Cognito User Pool |
| KB 同步頻率 | _____ 次/天 | 由 Auto-Sync 間隔計算 |
| Agent 模式使用率 | _____ % | 所有查詢中 Agent 使用比例 |
| 可用性要求 | Single-AZ / Multi-AZ | FSx 組態 |

---

## 成本計算公式

### 1. FSx for ONTAP

```
月費 = throughput 費用 + SSD 費用 + Capacity Pool 費用 + 備份費用

throughput 費用:
  128 MB/s: ~$210/月
  256 MB/s: ~$420/月
  512 MB/s: ~$840/月
  1,024 MB/s: ~$1,680/月

SSD 費用: $0.125/GiB/月 × SSD 容量 (GiB)
Capacity Pool 費用: $0.0125/GiB/月 × Capacity Pool 使用量 (GiB)
備份費用: $0.025/GiB/月 × 備份容量 (GiB)

Multi-AZ 情況下: throughput + SSD 費用約為 2 倍
```

**計算範例**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/月**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/月**

### 2. 向量儲存

```
S3 Vectors:
  儲存: $0.023/GB/月 × 向量資料大小
  請求: $0.005/1,000 PUT + $0.0004/1,000 GET
  估算: 10,000 個文件 → ~$5/月

OpenSearch Serverless:
  OCU: $0.24/OCU/小時 × 24 × 30 = $172.80/OCU/月
  最少 2 OCU (搜尋 + 索引): ~$346/月
  建議 4 OCU: ~$691/月
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2: $0.0001/1,000 tokens

初始 Embedding:
  = 文件數 × 平均大小(KB) × 1,000 / 4 × $0.0001/1K
  範例: 10,000 個 × 10 KB × 250 tokens/KB × $0.0001/1K = $2.50

每月增量 Embedding:
  = 變更文件數 × 平均大小 × $0.0001/1K
  範例: 500 個/月 × 10 KB × 250 tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock (生成模型)

```
Smart Routing 分佈 (預設假設):
  Simple (Haiku): 60% → $0.001/query
  Complex (Sonnet): 30% → $0.01/query
  Full-context (Opus): 10% → $0.10/query

加權平均成本/查詢:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

月費:
  = 每日查詢數 × 30 × $0.014
  範例: 100 queries/天 × 30 × $0.014 = $42/月
  範例: 1,000 queries/天 × 30 × $0.014 = $420/月
```

### 5. Lambda

```
WebApp Lambda:
  請求: $0.20/100萬請求
  運算: $0.0000166667/GB-秒
  記憶體: 1,024 MB, 平均執行時間: 3 秒
  
  月費 = 請求數 × (記憶體GB × 執行秒 × $0.0000166667 + $0.0000002)
  範例: 100,000 req/月 × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/月

同步 Lambda (KB Auto-Sync, AD Sync):
  5 分鐘間隔 × 30 天 = 8,640 次/月
  128 MB × 5 秒 = ~$0.60/月
```

### 6. 其他

```
CloudFront: $0.114/GB (日本) × 傳輸量
  範例: 10 GB/月 = $1.14/月

WAF: $5/WebACL + $1/規則 × 6 + $0.60/100萬請求
  基本: $11/月 + 請求按量

DynamoDB (隨需):
  寫入: $1.25/100萬 WRU
  讀取: $0.25/100萬 RRU
  儲存: $0.25/GB/月
  範例: ~$5/月 (小規模)

Cognito:
  前 50,000 MAU: 免費
  50,001–100,000: $0.0055/MAU
  範例: 100 MAU = $0 (免費額度內)

CloudWatch:
  日誌擷取: $0.76/GB
  日誌儲存: $0.033/GB/月
  指標: $0.30/指標/月 (前 10,000)
  範例: ~$10–$30/月
```

---

## 按組態的月度成本估算範本

### 範本 A: 小規模 PoC

| 資源 | 組態 | 月費 |
|------|------|------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 向量 | $5 |
| Bedrock Embedding | 初始 + 增量 | $3 |
| Bedrock 生成 | 100 queries/天, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | 基本 | $15 |
| DynamoDB | 隨需 | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | 基本 | $10 |
| **合計** | | **~$430/月** |

### 範本 B: 中規模正式環境

| 資源 | 組態 | 月費 |
|------|------|------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | 定期同步 | $10 |
| Bedrock 生成 | 1,000 queries/天, Smart Routing | $420 |
| Lambda | WebApp + Sync + 監控 | $30 |
| CloudFront + WAF | 正式環境流量 | $50 |
| DynamoDB | 佈建 | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | 日誌 + 指標 + 警示 | $50 |
| **合計** | | **~$3,626/月** |

### 範本 C: 大規模企業

| 資源 | 組態 | 月費 |
|------|------|------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | 大規模同步 | $50 |
| Bedrock 生成 | 5,000 queries/天, Smart Routing | $2,100 |
| Lambda | 全功能 | $100 |
| CloudFront + WAF | 高流量 | $200 |
| DynamoDB | 佈建 + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | 全面監控 | $100 |
| **合計** | | **~$8,512/月** |

---

## 成本最佳化要點

| 方法 | 節省效果 | 適用條件 |
|------|---------|---------|
| S3 Vectors (替代 AOSS) | -$700/月 | QPS < 10, 可容忍延遲 |
| Smart Routing (Haiku 優先) | -30~50% | 簡單問題居多的情況 |
| Capacity Pool Tiering | -50~80% (儲存) | 存取頻率低的資料較多的情況 |
| throughput 縮減 (營運階段) | -50% | 初始索引完成後 |
| Savings Plans (Lambda) | -17% | 1 年承諾 |
| Reserved Capacity (AOSS) | 需洽詢 | 確定長期使用時 |

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP 效能與容量規劃 |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | 合作夥伴部署模式 (含成本比較) |
| [evaluation.md](../evaluation.md) | RAG / Agent 評估指標 |
