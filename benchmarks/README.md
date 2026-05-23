# ベンチマークシナリオ — Permission-Aware RAG

## 概要

本ディレクトリは、Permission-aware RAG システムの性能を 3 つの規模（10K / 100K / 1M ファイル）で計測するためのベンチマークフレームワークです。

> **⚠️ Distinction**: `results/baseline-estimates.md` は AWS ドキュメントに基づく理論的推定値です。実測値は検証環境で `scripts/run-benchmark.sh` を実行して取得してください。

## ディレクトリ構成

```
benchmarks/
├── README.md                          # 本ドキュメント
├── scripts/
│   ├── generate-test-data.py          # テストデータ生成（10K/100K/1M）
│   ├── run-benchmark.sh               # ベンチマーク実行スクリプト
│   └── analyze-results.py             # 結果分析・レポート生成
└── results/
    └── baseline-estimates.md          # 理論的ベースライン推定値
```

## 前提条件

- AWS アカウント（デプロイ済み環境）
- Python 3.12+
- AWS CLI v2 設定済み
- jq, bc コマンド

## クイックスタート

```bash
# 1. テストデータ生成（ローカル）
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-data

# 2. テストデータを S3 にアップロード
aws s3 sync /tmp/bench-data/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# 3. KB 同期を待機
aws bedrock-agent start-ingestion-job --knowledge-base-id ${KB_ID} --data-source-id ${DS_ID}

# 4. ベンチマーク実行
bash benchmarks/scripts/run-benchmark.sh \
  --kb-id ${KB_ID} \
  --user-access-table ${USER_ACCESS_TABLE} \
  --scale 10k \
  --queries 100 \
  --output benchmarks/results/10k-results.json
```

## 計測メトリクス

| メトリクス | 説明 | 単位 |
|-----------|------|------|
| KB Sync Duration | StartIngestionJob 完了までの時間 | 秒 |
| Retrieve API Latency (P50/P95/P99) | Bedrock KB Retrieve API のレイテンシ | ミリ秒 |
| SID Filter Duration | アプリ側 SID フィルタリングの所要時間 | ミリ秒 |
| End-to-End Latency (P50/P95/P99) | 質問送信〜回答受信の全体レイテンシ | ミリ秒 |
| Permission Cache Hit Rate | DynamoDB キャッシュヒット率 | % |
| Converse API Latency | Bedrock Converse API のレイテンシ | ミリ秒 |
| Throughput | 1 分あたりの処理クエリ数 | queries/min |
| Error Rate | エラー発生率 | % |

## 規模別シナリオ

| シナリオ | ファイル数 | チャンク数（推定） | ユーザー数 | 同時クエリ |
|---------|-----------|------------------|-----------|-----------|
| Small (10K) | 10,000 | ~50,000 | 10 | 5 |
| Medium (100K) | 100,000 | ~500,000 | 50 | 20 |
| Large (1M) | 1,000,000 | ~5,000,000 | 200 | 50 |
