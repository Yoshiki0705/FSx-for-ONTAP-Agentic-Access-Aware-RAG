# 基準測試場景（10K / 100K / 1M 檔案）

**🌐 Language:** [日本語](../benchmark-scenarios.md) | [English](../en/benchmark-scenarios.md) | [한국어](../ko/benchmark-scenarios.md) | [简体中文](../zh-CN/benchmark-scenarios.md) | **繁體中文** | [Français](../fr/benchmark-scenarios.md) | [Deutsch](../de/benchmark-scenarios.md) | [Español](../es/benchmark-scenarios.md)

**建立日期**: 2026-05-23  
**狀態**: 框架完成，等待實測  
**目標讀者**: 效能工程師、容量規劃人員

> **⚠️ 區分**: 本文件中的估算值是基於 AWS 文件的理論值。實測值請在測試環境中執行 `benchmarks/scripts/run-benchmark.sh` 取得。請勿混淆理論值與實測值。

---

## 概述

本文件定義了在 3 種規模下評估 Permission-aware RAG 系統效能的基準測試場景。

---

## 基準測試執行步驟

### Step 1: 產生測試資料

```bash
# 10K 檔案（PoC 規模）
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K 檔案（部門規模）
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M 檔案（企業規模）
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: 上傳資料 & 同步 KB

```bash
# 上傳到 S3
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# 同步 KB（測量初始索引時間）
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: 執行基準測試

```bash
bash benchmarks/scripts/run-benchmark.sh \
  --kb-id ${KB_ID} \
  --user-access-table ${USER_ACCESS_TABLE} \
  --scale 10k \
  --queries 200 \
  --concurrent 5 \
  --output benchmarks/results/10k-results.json
```

---

## 測量場景

### 場景 1: 搜尋延遲（單一使用者）

| 參數 | 值 |
|------|-----|
| 目的 | 測量 Retrieve API + SID 篩選器的基準延遲 |
| 查詢數 | 200 |
| 並行數 | 1 |
| 使用者 | admin（可存取所有文件） |
| 測量指標 | Retrieve API P50/P95/P99、SID Filter、End-to-End |

### 場景 2: 權限篩選效率

| 參數 | 值 |
|------|-----|
| 目的 | 按權限等級測量篩選效率和結果品質 |
| 查詢數 | 100 × 3 使用者 |
| 使用者 | admin（完全存取）、engineer（部分）、general（僅公開） |
| 測量指標 | 篩選前/後文件數比率、回答品質 |

### 場景 3: 並行存取負載

| 參數 | 值 |
|------|-----|
| 目的 | 測量並行存取時的延遲退化 |
| 查詢數 | 500 |
| 並行數 | 1, 5, 10, 20, 50 |
| 測量指標 | 各並行等級的 P95 延遲變化 |

### 場景 4: KB 同步效能

| 參數 | 值 |
|------|-----|
| 目的 | 測量初始索引和增量同步的所需時間 |
| 測量指標 | 初始同步時間、增量同步時間（5% 變更）、ListObjectsV2 時間 |

### 場景 5: 快取效果

| 參數 | 值 |
|------|-----|
| 目的 | 測量權限快取的效果 |
| 查詢數 | 100（同一使用者連續） |
| 測量指標 | 快取命中率、命中/未命中時的延遲差異 |

---

## 理論基準估算值

> 詳情請參閱 [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md)

| 規模 | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync（初始） |
|------|--------------------|--------------------|----------------|----------------|
| 10K | 200~500 ms | 100~200 ms | 2~4 秒 | 5~15 分鐘 |
| 100K | 300~800 ms | 100~200 ms | 3~6 秒 | 30~90 分鐘 |
| 1M | 500~1,500 ms | 100~300 ms | 4~8 秒 | 數小時 |

---

## 結果報告範本

執行基準測試後，請使用以下範本記錄結果。

```markdown
# Benchmark Results — [SCALE] files

## Environment
- Region: ap-northeast-1
- Vector Store: S3 Vectors / OpenSearch Serverless
- FSx Throughput: XXX MB/s
- Document Count: XXX
- Chunk Count: XXX (estimated)
- Date: YYYY-MM-DD

## Results

### Retrieve API Latency
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |
| P99 | XXX ms |

### SID Filter Latency
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |

### End-to-End (Retrieve + SID + Converse)
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |

### KB Sync
| Operation | Duration |
|-----------|----------|
| Initial sync | XXX min |
| Incremental (5% change) | XXX min |

### Throughput
| Metric | Value |
|--------|-------|
| Queries/minute (single user) | XXX |
| Queries/minute (5 concurrent) | XXX |

## Observations
- 
- 

## Recommendations
- 
- 
```

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP 效能與容量設計 |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | 成本估算工作表 |
| [benchmarks/README.md](../../benchmarks/README.md) | 基準測試框架 |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | 理論基準估算值 |
