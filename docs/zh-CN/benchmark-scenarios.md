# 基准测试场景（10K / 100K / 1M 文件）

**🌐 Language:** [日本語](../benchmark-scenarios.md) | [English](../en/benchmark-scenarios.md) | [한국어](../ko/benchmark-scenarios.md) | **简体中文** | [繁體中文](../zh-TW/benchmark-scenarios.md) | [Français](../fr/benchmark-scenarios.md) | [Deutsch](../de/benchmark-scenarios.md) | [Español](../es/benchmark-scenarios.md)

**创建日期**: 2026-05-23  
**状态**: 框架完成，等待实测  
**目标读者**: 性能工程师、容量规划人员

> **⚠️ 区分**: 本文档中的估算值是基于 AWS 文档的理论值。实测值请在测试环境中运行 `benchmarks/scripts/run-benchmark.sh` 获取。请勿混淆理论值与实测值。

---

## 概述

本文档定义了在 3 种规模下评估 Permission-aware RAG 系统性能的基准测试场景。

---

## 基准测试执行步骤

### Step 1: 生成测试数据

```bash
# 10K 文件（PoC 规模）
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K 文件（部门规模）
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M 文件（企业规模）
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: 上传数据 & 同步 KB

```bash
# 上传到 S3
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# 同步 KB（测量初始索引时间）
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: 运行基准测试

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

## 测量场景

### 场景 1: 搜索延迟（单用户）

| 参数 | 值 |
|------|-----|
| 目的 | 测量 Retrieve API + SID 过滤器的基准延迟 |
| 查询数 | 200 |
| 并发数 | 1 |
| 用户 | admin（可访问所有文档） |
| 测量指标 | Retrieve API P50/P95/P99、SID Filter、End-to-End |

### 场景 2: 权限过滤效率

| 参数 | 值 |
|------|-----|
| 目的 | 按权限级别测量过滤效率和结果质量 |
| 查询数 | 100 × 3 用户 |
| 用户 | admin（完全访问）、engineer（部分）、general（仅公开） |
| 测量指标 | 过滤前/后文档数比率、回答质量 |

### 场景 3: 并发访问负载

| 参数 | 值 |
|------|-----|
| 目的 | 测量并发访问时的延迟退化 |
| 查询数 | 500 |
| 并发数 | 1, 5, 10, 20, 50 |
| 测量指标 | 各并发级别的 P95 延迟变化 |

### 场景 4: KB 同步性能

| 参数 | 值 |
|------|-----|
| 目的 | 测量初始索引和增量同步的所需时间 |
| 测量指标 | 初始同步时间、增量同步时间（5% 变更）、ListObjectsV2 时间 |

### 场景 5: 缓存效果

| 参数 | 值 |
|------|-----|
| 目的 | 测量权限缓存的效果 |
| 查询数 | 100（同一用户连续） |
| 测量指标 | 缓存命中率、命中/未命中时的延迟差异 |

---

## 理论基准估算值

> 详情请参阅 [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md)

| 规模 | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync（初始） |
|------|--------------------|--------------------|----------------|----------------|
| 10K | 200~500 ms | 100~200 ms | 2~4 秒 | 5~15 分钟 |
| 100K | 300~800 ms | 100~200 ms | 3~6 秒 | 30~90 分钟 |
| 1M | 500~1,500 ms | 100~300 ms | 4~8 秒 | 数小时 |

---

## 结果报告模板

运行基准测试后，请使用以下模板记录结果。

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

## 相关文档

| 文档 | 内容 |
|------|------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP 性能与容量设计 |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | 成本估算工作表 |
| [benchmarks/README.md](../../benchmarks/README.md) | 基准测试框架 |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | 理论基准估算值 |
