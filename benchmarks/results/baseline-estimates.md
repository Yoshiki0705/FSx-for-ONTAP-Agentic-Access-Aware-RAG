# ベースライン推定値（理論値）

> **⚠️ 重要**: 本ドキュメントの値は AWS ドキュメント、公開ベンチマーク、およびデモ環境（2 ドキュメント）での実測に基づく**理論的推定値**です。実際の性能は、ドキュメント内容、チャンクサイズ、embedding 品質、同時アクセス数、リージョン、時間帯により大きく変動します。本番環境での意思決定には、必ず `scripts/run-benchmark.sh` による実測を行ってください。

---

## 推定値の根拠

| 情報源 | 内容 | 信頼度 |
|--------|------|--------|
| AWS ドキュメント（FSx for ONTAP Performance） | throughput / IOPS / レイテンシ仕様 | 高 |
| AWS ドキュメント（S3 Vectors） | クエリレイテンシ特性 | 高 |
| デモ環境実測（2 ドキュメント、ap-northeast-1） | Retrieve API レイテンシ | 中（規模が小さい） |
| AWS Storage Blog（FSx for ONTAP S3 AP） | S3 AP アクセス特性 | 中 |
| 一般的な DynamoDB レイテンシ | 単一項目 GetItem | 高 |

---

## 規模別推定値

### 10,000 ファイル（~50,000 チャンク）

| メトリクス | S3 Vectors | OpenSearch Serverless | 備考 |
|-----------|-----------|---------------------|------|
| KB Sync Duration（初回） | 5〜15 分 | 5〜15 分 | Bedrock KB 側の処理 |
| KB Sync Duration（差分 500 件） | 1〜3 分 | 1〜3 分 | 変更ファイル数に依存 |
| Retrieve API P50 | 200〜500 ms | 100〜200 ms | S3 Vectors はコールド時遅い |
| Retrieve API P95 | 500〜1,500 ms | 150〜300 ms | ウォームアップ後は安定 |
| SID Filter Duration | 5〜20 ms | 5〜20 ms | DynamoDB GetItem + 集合演算 |
| End-to-End P50（Retrieve + SID） | 210〜520 ms | 105〜220 ms | Converse API 除く |
| End-to-End P50（全体） | 2〜4 秒 | 1.5〜3 秒 | Converse API 含む |
| Permission Cache Hit Rate | 60〜80% | 60〜80% | TTL 5 分、同一ユーザー連続クエリ |

### 100,000 ファイル（~500,000 チャンク）

| メトリクス | S3 Vectors | OpenSearch Serverless | 備考 |
|-----------|-----------|---------------------|------|
| KB Sync Duration（初回） | 30〜90 分 | 30〜90 分 | 並列処理で短縮可能 |
| KB Sync Duration（差分 2,000 件） | 5〜15 分 | 5〜15 分 | |
| Retrieve API P50 | 300〜800 ms | 100〜200 ms | S3 Vectors はインデックスサイズに依存 |
| Retrieve API P95 | 800〜2,000 ms | 200〜400 ms | |
| SID Filter Duration | 5〜20 ms | 5〜20 ms | ドキュメント数に非依存 |
| End-to-End P50（全体） | 3〜6 秒 | 2〜4 秒 | |
| ListObjectsV2（Auto-Sync） | 10〜30 秒 | 10〜30 秒 | ファイル数に比例 |

### 1,000,000 ファイル（~5,000,000 チャンク）

| メトリクス | S3 Vectors | OpenSearch Serverless | 備考 |
|-----------|-----------|---------------------|------|
| KB Sync Duration（初回） | 数時間〜1 日 | 数時間〜1 日 | バッチ分割推奨 |
| KB Sync Duration（差分 10,000 件） | 30〜60 分 | 30〜60 分 | |
| Retrieve API P50 | 500〜1,500 ms | 100〜300 ms | 大規模では AOSS が低レイテンシ／S3 Vectors は低コスト（用途で選択） |
| Retrieve API P95 | 1,500〜5,000 ms | 200〜500 ms | |
| SID Filter Duration | 5〜30 ms | 5〜30 ms | グループ SID 数に依存 |
| End-to-End P50（全体） | 4〜8 秒 | 2〜5 秒 | |
| ListObjectsV2（Auto-Sync） | 2〜10 分 | 2〜10 分 | Lambda タイムアウト注意 |

---

## FSx for ONTAP 推定値

| 操作 | 128 MB/s | 512 MB/s | 1,024 MB/s |
|------|---------|---------|-----------|
| 初回 Indexing（10K × 10KB） | 1〜2 分 | < 1 分 | < 30 秒 |
| 初回 Indexing（100K × 10KB） | 10〜20 分 | 3〜5 分 | 1〜3 分 |
| 初回 Indexing（1M × 10KB） | 2〜4 時間 | 30〜60 分 | 15〜30 分 |
| S3 AP ListObjectsV2（10K） | 2〜5 秒 | 2〜5 秒 | 2〜5 秒 |
| S3 AP ListObjectsV2（100K） | 20〜60 秒 | 20〜60 秒 | 20〜60 秒 |
| S3 AP ListObjectsV2（1M） | 3〜10 分 | 3〜10 分 | 3〜10 分 |
| S3 AP GetObject（単一ファイル） | 50〜200 ms | 50〜200 ms | 50〜200 ms |

---

## コスト推定値（月額）

| 規模 | S3 Vectors 構成 | AOSS 構成 | 差額 |
|------|----------------|-----------|------|
| 10K | ~$430 | ~$1,130 | +$700 |
| 100K | ~$800 | ~$1,500 | +$700 |
| 1M | ~$2,500 | ~$3,900 | +$1,400（OCU 増） |

> 詳細は [docs/cost-estimation-worksheet.md](../../docs/cost-estimation-worksheet.md) を参照

---

## 推奨構成の判断基準

| 条件 | 推奨 |
|------|------|
| ドキュメント < 10K、QPS < 5 | S3 Vectors + 128 MB/s |
| ドキュメント 10K〜100K、QPS < 20 | S3 Vectors + 256 MB/s（レイテンシ許容時）|
| ドキュメント 10K〜100K、P95 < 500ms 必須 | OpenSearch Serverless + 256 MB/s |
| ドキュメント > 100K | OpenSearch Serverless + 512 MB/s 以上 |
| 初回 Indexing 高速化が必要 | throughput 一時引き上げ → 運用時に戻す |

---

## 実測時の注意事項

1. **ウォームアップ**: S3 Vectors は初回クエリが遅い。ベンチマーク前に 10〜20 回のウォームアップクエリを実行
2. **時間帯**: AWS サービスの負荷は時間帯で変動。同一条件で複数回計測し平均を取る
3. **同時実行**: 単一スレッドと並列実行で結果が異なる。本番想定の同時実行数で計測
4. **リージョン**: ap-northeast-1 と us-east-1 でレイテンシが異なる可能性
5. **モデル**: Converse API のレイテンシはモデルとトークン数に大きく依存。Retrieve + SID のみの計測と分離する
