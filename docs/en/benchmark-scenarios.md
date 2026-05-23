# Benchmark Scenarios (10K / 100K / 1M Files)

**🌐 Language:** [日本語](../benchmark-scenarios.md) | **English** | [한국어](../ko/benchmark-scenarios.md) | [简体中文](../zh-CN/benchmark-scenarios.md) | [繁體中文](../zh-TW/benchmark-scenarios.md) | [Français](../fr/benchmark-scenarios.md) | [Deutsch](../de/benchmark-scenarios.md) | [Español](../es/benchmark-scenarios.md)

**Created**: 2026-05-23  
**Status**: Framework complete, awaiting measurements  
**Audience**: Performance engineers, capacity planners

> **⚠️ Distinction**: The estimates in this document are theoretical values based on AWS documentation. For actual measurements, run `benchmarks/scripts/run-benchmark.sh` in your test environment. Do not confuse theoretical values with actual measurements.

---

## Overview

This document defines benchmark scenarios for evaluating the performance of the Permission-aware RAG system at three different scales.

---

## Benchmark Execution Steps

### Step 1: Generate Test Data

```bash
# 10K files (PoC scale)
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K files (department scale)
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M files (enterprise scale)
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: Upload Data & Sync KB

```bash
# Upload to S3
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# Sync KB (measure initial indexing time)
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: Run Benchmark

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

## Measurement Scenarios

### Scenario 1: Search Latency (Single User)

| Parameter | Value |
|-----------|-------|
| Objective | Measure baseline latency of Retrieve API + SID filter |
| Queries | 200 |
| Concurrency | 1 |
| User | admin (full document access) |
| Metrics | Retrieve API P50/P95/P99, SID Filter, End-to-End |

### Scenario 2: Permission Filtering Efficiency

| Parameter | Value |
|-----------|-------|
| Objective | Measure filtering efficiency and result quality by permission level |
| Queries | 100 × 3 users |
| Users | admin (full access), engineer (partial), general (public only) |
| Metrics | Document count ratio before/after filtering, answer quality |

### Scenario 3: Concurrent Access Load

| Parameter | Value |
|-----------|-------|
| Objective | Measure latency degradation under concurrent access |
| Queries | 500 |
| Concurrency | 1, 5, 10, 20, 50 |
| Metrics | P95 latency change by concurrency level |

### Scenario 4: KB Sync Performance

| Parameter | Value |
|-----------|-------|
| Objective | Measure initial indexing and incremental sync duration |
| Metrics | Initial sync time, incremental sync time (5% change), ListObjectsV2 time |

### Scenario 5: Cache Effectiveness

| Parameter | Value |
|-----------|-------|
| Objective | Measure the effect of permission caching |
| Queries | 100 (same user, consecutive) |
| Metrics | Cache hit rate, latency difference between hit/miss |

---

## Theoretical Baseline Estimates

> For details, see [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md)

| Scale | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync (Initial) |
|-------|--------------------|--------------------|----------------|-------------------|
| 10K | 200–500 ms | 100–200 ms | 2–4 sec | 5–15 min |
| 100K | 300–800 ms | 100–200 ms | 3–6 sec | 30–90 min |
| 1M | 500–1,500 ms | 100–300 ms | 4–8 sec | Several hours |

---

## Results Report Template

After running the benchmark, record results using the following template.

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

## Related Documents

| Document | Description |
|----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP performance & capacity planning |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | Cost estimation worksheet |
| [benchmarks/README.md](../../benchmarks/README.md) | Benchmark framework |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | Theoretical baseline estimates |
