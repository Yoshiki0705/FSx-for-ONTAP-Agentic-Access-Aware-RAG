# コスト見積もりワークシート

**🌐 Language:** **日本語** | [English](en/cost-estimation-worksheet.md) | [한국어](ko/cost-estimation-worksheet.md) | [简体中文](zh-CN/cost-estimation-worksheet.md) | [繁體中文](zh-TW/cost-estimation-worksheet.md) | [Français](fr/cost-estimation-worksheet.md) | [Deutsch](de/cost-estimation-worksheet.md) | [Español](es/cost-estimation-worksheet.md)

**作成日**: 2026-05-23  
**ステータス**: ドラフト  
**対象**: プロジェクトマネージャー、パートナー提案担当者、予算策定者向け

> **⚠️ 注記**: 本ワークシートの料金は 2026 年 5 月時点の ap-northeast-1 リージョンの公開料金に基づく参考値です。実際のコストはリージョン、利用量、割引、料金改定により変動します。最新の料金は [AWS Pricing](https://aws.amazon.com/pricing/) を参照してください。

---

## 入力パラメータ

以下の値を埋めて、月額コストを概算してください。

| パラメータ | 値 | 備考 |
|-----------|-----|------|
| ドキュメント数 | _____ 件 | FSx ボリューム上のファイル数 |
| 平均ドキュメントサイズ | _____ KB | テキスト換算 |
| 日次クエリ数 | _____ 回/日 | 全ユーザー合計 |
| 同時ユーザー数 | _____ 人 | ピーク時 |
| 登録ユーザー数 | _____ 人 | Cognito User Pool |
| KB 同期頻度 | _____ 回/日 | Auto-Sync 間隔から算出 |
| Agent モード利用率 | _____ % | 全クエリ中の Agent 利用割合 |
| 可用性要件 | Single-AZ / Multi-AZ | FSx 構成 |

---

## コスト計算式

### 1. FSx for ONTAP

```
月額 = throughput 料金 + SSD 料金 + Capacity Pool 料金 + バックアップ料金

throughput 料金:
  128 MB/s: ~$210/月
  256 MB/s: ~$420/月
  512 MB/s: ~$840/月
  1,024 MB/s: ~$1,680/月

SSD 料金: $0.125/GiB/月 × SSD 容量 (GiB)
Capacity Pool 料金: $0.0125/GiB/月 × Capacity Pool 使用量 (GiB)
バックアップ料金: $0.025/GiB/月 × バックアップ容量 (GiB)

Multi-AZ の場合: throughput + SSD 料金が約 2 倍
```

**計算例**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/月**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/月**

### 2. ベクトルストア

```
S3 Vectors:
  ストレージ: $0.023/GB/月 × ベクトルデータサイズ
  リクエスト: $0.005/1,000 PUT + $0.0004/1,000 GET
  概算: ドキュメント 10,000 件 → ~$5/月

OpenSearch Serverless:
  OCU: $0.24/OCU/時間 × 24 × 30 = $172.80/OCU/月
  最小 2 OCU（検索 + インデックス）: ~$346/月
  推奨 4 OCU: ~$691/月
```

### 3. Bedrock（Embedding）

```
Titan Embed Text v2: $0.0001/1,000 tokens

初回 Embedding:
  = ドキュメント数 × 平均サイズ(KB) × 1,000 / 4 × $0.0001/1K
  例: 10,000 件 × 10 KB × 250 tokens/KB × $0.0001/1K = $2.50

月次差分 Embedding:
  = 変更ドキュメント数 × 平均サイズ × $0.0001/1K
  例: 500 件/月 × 10 KB × 250 tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock（生成モデル）

```
Smart Routing 分布（デフォルト想定）:
  Simple (Haiku): 60% → $0.001/query
  Complex (Sonnet): 30% → $0.01/query
  Full-context (Opus): 10% → $0.10/query

加重平均コスト/クエリ:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

月額:
  = 日次クエリ数 × 30 × $0.014
  例: 100 queries/日 × 30 × $0.014 = $42/月
  例: 1,000 queries/日 × 30 × $0.014 = $420/月
```

### 5. Lambda

```
WebApp Lambda:
  リクエスト: $0.20/100万リクエスト
  コンピュート: $0.0000166667/GB-秒
  メモリ: 1,024 MB、平均実行時間: 3 秒
  
  月額 = リクエスト数 × (メモリGB × 実行秒 × $0.0000166667 + $0.0000002)
  例: 100,000 req/月 × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/月

同期 Lambda (KB Auto-Sync, AD Sync):
  5 分間隔 × 30 日 = 8,640 回/月
  128 MB × 5 秒 = ~$0.60/月
```

### 6. その他

```
CloudFront: $0.114/GB (日本) × 転送量
  例: 10 GB/月 = $1.14/月

WAF: $5/WebACL + $1/ルール × 6 + $0.60/100万リクエスト
  基本: $11/月 + リクエスト従量

DynamoDB (オンデマンド):
  書き込み: $1.25/100万 WRU
  読み取り: $0.25/100万 RRU
  ストレージ: $0.25/GB/月
  例: ~$5/月（小規模）

Cognito:
  最初 50,000 MAU: 無料
  50,001–100,000: $0.0055/MAU
  例: 100 MAU = $0（無料枠内）

CloudWatch:
  ログ取り込み: $0.76/GB
  ログストレージ: $0.033/GB/月
  メトリクス: $0.30/メトリクス/月（最初 10,000）
  例: ~$10–$30/月
```

---

## 構成別月額概算テンプレート

### テンプレート A: 小規模 PoC

| リソース | 構成 | 月額 |
|---------|------|------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 ベクトル | $5 |
| Bedrock Embedding | 初回 + 差分 | $3 |
| Bedrock 生成 | 100 queries/日, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | 基本 | $15 |
| DynamoDB | オンデマンド | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | 基本 | $10 |
| **合計** | | **~$430/月** |

### テンプレート B: 中規模本番

| リソース | 構成 | 月額 |
|---------|------|------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | 定期同期 | $10 |
| Bedrock 生成 | 1,000 queries/日, Smart Routing | $420 |
| Lambda | WebApp + Sync + 監視 | $30 |
| CloudFront + WAF | 本番トラフィック | $50 |
| DynamoDB | プロビジョンド | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | ログ + メトリクス + アラート | $50 |
| **合計** | | **~$3,626/月** |

### テンプレート C: 大規模エンタープライズ

| リソース | 構成 | 月額 |
|---------|------|------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | 大規模同期 | $50 |
| Bedrock 生成 | 5,000 queries/日, Smart Routing | $2,100 |
| Lambda | 全機能 | $100 |
| CloudFront + WAF | 高トラフィック | $200 |
| DynamoDB | プロビジョンド + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | フル監視 | $100 |
| **合計** | | **~$8,512/月** |

---

## コスト最適化のポイント

| 手法 | 削減効果 | 適用条件 |
|------|---------|---------|
| S3 Vectors（AOSS の代わり） | -$700/月 | QPS < 10、レイテンシ許容 |
| Smart Routing（Haiku 優先） | -30〜50% | 簡単な質問が多い場合 |
| Capacity Pool Tiering | -50〜80%（ストレージ） | アクセス頻度の低いデータが多い場合 |
| throughput 削減（運用フェーズ） | -50% | 初回 indexing 完了後 |
| Savings Plans（Lambda） | -17% | 1 年コミット |
| Reserved Capacity（AOSS） | 要問合せ | 長期利用確定時 |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 性能・容量設計 |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | パートナー展開パターン（コスト比較含む） |
| [evaluation.md](evaluation.md) | RAG / Agent 評価メトリクス |
