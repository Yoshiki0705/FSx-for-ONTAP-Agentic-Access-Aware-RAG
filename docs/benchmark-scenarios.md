# ベンチマークシナリオ（10K / 100K / 1M ファイル）

**🌐 Language:** **日本語** | [English](en/benchmark-scenarios.md) | [한국어](ko/benchmark-scenarios.md) | [简体中文](zh-CN/benchmark-scenarios.md) | [繁體中文](zh-TW/benchmark-scenarios.md) | [Français](fr/benchmark-scenarios.md) | [Deutsch](de/benchmark-scenarios.md) | [Español](es/benchmark-scenarios.md)

**作成日**: 2026-05-23  
**ステータス**: フレームワーク完成、実測待ち  
**対象**: パフォーマンスエンジニア、キャパシティプランナー向け

> **⚠️ Distinction**: 本ドキュメントの推定値は AWS ドキュメントに基づく理論値です。実測値は検証環境で `benchmarks/scripts/run-benchmark.sh` を実行して取得してください。理論値と実測値を混同しないでください。

---

## 概要

本ドキュメントは、Permission-aware RAG システムの性能を 3 つの規模で評価するためのベンチマークシナリオを定義します。

---

## ベンチマーク実行手順

### Step 1: テストデータ生成

```bash
# 10K ファイル（PoC 規模）
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K ファイル（部門規模）
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M ファイル（エンタープライズ規模）
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: データアップロード & KB 同期

```bash
# S3 にアップロード
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# KB 同期（初回 Indexing 時間を計測）
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: ベンチマーク実行

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

## 計測シナリオ

### シナリオ 1: 検索レイテンシ（単一ユーザー）

| パラメータ | 値 |
|-----------|-----|
| 目的 | Retrieve API + SID フィルタの基本レイテンシ計測 |
| クエリ数 | 200 |
| 同時実行 | 1 |
| ユーザー | admin（全ドキュメントアクセス可） |
| 計測対象 | Retrieve API P50/P95/P99、SID Filter、End-to-End |

### シナリオ 2: 権限フィルタリング効率

| パラメータ | 値 |
|-----------|-----|
| 目的 | 権限レベル別のフィルタリング効率と結果品質 |
| クエリ数 | 100 × 3 ユーザー |
| ユーザー | admin（全アクセス）、engineer（部分）、general（公開のみ） |
| 計測対象 | フィルタ前/後のドキュメント数比率、回答品質 |

### シナリオ 3: 同時アクセス負荷

| パラメータ | 値 |
|-----------|-----|
| 目的 | 同時アクセス時のレイテンシ劣化を計測 |
| クエリ数 | 500 |
| 同時実行 | 1, 5, 10, 20, 50 |
| 計測対象 | 同時実行数別の P95 レイテンシ変化 |

### シナリオ 4: KB 同期性能

| パラメータ | 値 |
|-----------|-----|
| 目的 | 初回 Indexing と差分同期の所要時間 |
| 計測対象 | 初回同期時間、差分同期時間（5%変更）、ListObjectsV2 時間 |

### シナリオ 5: キャッシュ効果

| パラメータ | 値 |
|-----------|-----|
| 目的 | 権限キャッシュの効果を計測 |
| クエリ数 | 100（同一ユーザー連続） |
| 計測対象 | キャッシュヒット率、ヒット時/ミス時のレイテンシ差 |

---

## 理論的ベースライン推定値

> 詳細は [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md) を参照

| 規模 | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync（初回） |
|------|--------------------|--------------------|----------------|----------------|
| 10K | 200〜500 ms | 100〜200 ms | 2〜4 秒 | 5〜15 分 |
| 100K | 300〜800 ms | 100〜200 ms | 3〜6 秒 | 30〜90 分 |
| 1M | 500〜1,500 ms | 100〜300 ms | 4〜8 秒 | 数時間 |

---

## 結果レポートテンプレート

ベンチマーク実行後、以下のテンプレートで結果を記録してください。

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

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 性能・容量設計 |
| [cost-estimation-worksheet.md](cost-estimation-worksheet.md) | コスト見積もりワークシート |
| [benchmarks/README.md](../benchmarks/README.md) | ベンチマークフレームワーク |
| [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md) | 理論的ベースライン推定値 |
