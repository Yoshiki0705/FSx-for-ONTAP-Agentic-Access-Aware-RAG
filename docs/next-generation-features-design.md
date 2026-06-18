# 次世代機能設計ドキュメント

**作成日**: 2026-05-24  
**ステータス**: 設計完了（実装は段階的に進行）

---

## 概要

v4.3 運用強化完了後の次のステップとして、15の方向性を5つのカテゴリに分類し、設計を整理します。

---

## カテゴリ1: パートナー/SI提案加速

### #1 業種別PoC成功事例テンプレート
**ステータス**: ✅ 実装済み → `docs/poc-success-stories-template.md`

### #2 マルチテナントSaaS化テンプレート
**ステータス**: 設計済み → `docs/partner-deployment-patterns.md` に3パターン記載

**追加実装案**:
```
CDK Pipelines テンプレート:
  管理アカウント → CodePipeline → 顧客アカウントA/B/C に並行デプロイ
  
  cdk.context.json を顧客ごとに分離:
    configs/customer-a.json
    configs/customer-b.json
    
  パイプライン定義:
    lib/pipeline/multi-tenant-pipeline.ts
```

### #3 顧客向けダッシュボード
**ステータス**: 設計

**設計**:
```
CloudWatch Dashboard (顧客向け読み取り専用):
  - 日次/週次クエリ数
  - 回答精度（フィードバックベース）
  - 応答時間 P50/P95
  - 権限フィルタリング統計（許可/拒否比率）
  - コスト推移（日次）
  - Smart Routing ティア分布

アクセス方式:
  - CloudWatch Dashboard の共有リンク（期間限定）
  - または Grafana on ECS（長期運用向け）
```

---

## カテゴリ2: ストレージ信頼性

### #4 S3 AP パフォーマンスベンチマーク自動化
**ステータス**: 設計

**設計**:
```python
# benchmarks/s3ap-benchmark.py
# Lambda 内から実行（VPC内、FSx for ONTAP と同じサブネット）

テストマトリクス:
  object_sizes: [1KB, 10KB, 100KB, 1MB, 10MB, 100MB]
  concurrency: [1, 5, 10, 20, 50]
  operations: [GetObject, PutObject, ListObjectsV2, HeadObject]
  
出力:
  - P50/P90/P95/P99/Max レイテンシ
  - スループット (MB/s)
  - benchmark_run_id（再現性のため）
  
CloudWatch Custom Metrics:
  Namespace: S3APBenchmark
  Dimensions: ObjectSize, Concurrency, Operation
```

### #5 FlexCache → S3 AP 移行パス
**ステータス**: 設計（AWS機能リリース待ち）

**移行手順（将来）**:
```
1. FlexCache Cache Volume に S3 AP をアタッチ（機能リリース後）
2. Embedding サーバー経由パスと S3 AP パスの並行運用期間を設定
3. S3 AP パスの動作確認（ベンチマーク実行）
4. Embedding サーバーの停止
5. EmbeddingStack の削除
```

### #6 DR/読み取りパス分離設計
**ステータス**: 設計

**アーキテクチャ**:
```
┌─────────────────┐     SnapMirror     ┌─────────────────┐
│ Primary Volume   │ ──────────────────▶ │ DR Volume        │
│ (書き込み)       │                     │ (読み取り専用)    │
│ + S3 AP (write)  │                     │ + S3 AP (read)   │
└─────────────────┘                     └────────┬────────┘
                                                  │
                                                  ▼
                                        ┌─────────────────┐
                                        │ Bedrock KB       │
                                        │ (RAG検索)        │
                                        └─────────────────┘

メリット:
  - 本番書き込みとRAG読み取りの I/O 分離
  - DR ボリュームからの読み取りは本番パフォーマンスに影響しない
  - SnapMirror RPO に基づく「最大遅延」が明確

制約:
  - SnapMirror 同期間隔分の遅延（通常 15分〜1時間）
  - DR ボリュームは読み取り専用（書き込み不可）
```

---

## カテゴリ3: ガバナンス/説明責任

### #7 RAG回答の根拠追跡（Provenance）
**ステータス**: 設計 + 部分実装（Citation は既に表示済み）

**追加実装**:
```json
// DynamoDB 監査テーブルに記録するイベント
{
  "eventType": "RAG_RESPONSE_GENERATED",
  "timestamp": "2026-05-24T10:30:00Z",
  "userId": "admin@example.com",
  "query": "会社の売上は？",
  "responseId": "resp-uuid-xxx",
  "citations": [
    {
      "documentKey": "confidential/financial-report.md",
      "chunkIndex": 3,
      "relevanceScore": 0.92,
      "permissionCheck": "ALLOWED",
      "matchedSids": ["S-1-5-21-xxx-512"]
    }
  ],
  "modelId": "anthropic.claude-sonnet-4-6",
  "routingTier": "complex",
  "totalTokens": 1536
}
```

### #8 権限変更の即時反映（Event-Driven ACL Sync）
**ステータス**: 設計

**アーキテクチャ**:
```
ACL変更イベント検出:
  Option A: FPolicy (FSx for ONTAP) → SQS → Lambda
  Option B: CloudTrail S3 Data Events → EventBridge → Lambda
  Option C: 定期スキャン（現行、最大5分遅延）

Lambda処理:
  1. 変更されたファイルの .metadata.json を再生成
  2. DynamoDB permission-cache を無効化
  3. Bedrock KB StartIngestionJob（該当ファイルのみ）

目標: ACL変更から RAG 反映まで 1分以内
```

### #9 AI利用ポリシー組織テンプレート
**ステータス**: ✅ 実装済み → `docs/ai-usage-policy-template.md`

---

## カテゴリ4: ビジネス価値可視化

### #10 ROI自動計測ダッシュボード
**ステータス**: 設計

**メトリクス定義**:
```
ROI = (削減された時間 × 時間単価) / システムコスト

計測対象:
  - 検索時間削減: (手動検索時間 - AI検索時間) × クエリ数
  - 問い合わせ削減: 削減チケット数 × 対応コスト/件
  - 重複作業削減: 検出された重複 × 作業コスト

データソース:
  - CloudWatch: クエリ数、応答時間
  - DynamoDB: ユーザーフィードバック（👍/👎）
  - 手動入力: Before値（導入前の手動検索時間）
```

### #11 ユーザーフィードバックループ
**ステータス**: 設計

**実装案**:
```typescript
// チャットUIに👍/👎ボタンを追加
// POST /api/feedback
{
  "responseId": "resp-uuid-xxx",
  "rating": "positive" | "negative",
  "comment": "optional text",
  "userId": "user@example.com",
  "timestamp": "2026-05-24T10:30:00Z"
}

// DynamoDB feedback テーブルに保存
// 週次レポートで集計 → RAG品質改善に活用
```

### #12 段階的機能開放（Feature Gate）
**ステータス**: 設計

**実装案**:
```json
// DynamoDB feature-gates テーブル
{
  "featureId": "hybrid-search",
  "enabledGroups": ["engineering", "product"],
  "enabledUsers": ["admin@example.com"],
  "rolloutPercentage": 50,
  "startDate": "2026-06-01",
  "endDate": "2026-06-30"
}

// フロントエンドで /api/config/features を拡張
// ユーザーのグループに基づいて機能の表示/非表示を制御
```

---

## カテゴリ5: セキュリティ/運用自動化

### #13 権限キャッシュ自動無効化
**ステータス**: 設計

**実装案**:
```
トリガー:
  - DynamoDB Streams (user-access テーブルの変更)
  - EventBridge Rule

Lambda処理:
  1. 変更されたユーザーIDを検出
  2. permission-cache テーブルから該当ユーザーのレコードを削除
  3. CloudWatch メトリクス発行（CacheInvalidation カウント）

CDK:
  - DynamoDB Stream → Lambda → permission-cache 削除
  - 既存の permission-cache テーブルに TTL も設定（フォールバック）
```

### #14 Guardrails違反の自動エスカレーション
**ステータス**: 設計

**実装案**:
```
CloudWatch Alarm:
  Namespace: FSxNOps/Guardrails
  MetricName: GuardrailDecision
  Dimension: Decision=Blocked
  Threshold: 5回/1時間
  
  → SNS → Lambda → Slack/PagerDuty Webhook

追加:
  Bedrock Guardrails 介入率:
  Namespace: BedrockGuardrails
  MetricName: GuardrailIntervention
  Threshold: 10回/1時間
```

### #15 コスト異常検知
**ステータス**: 設計

**実装案**:
```
CloudWatch Anomaly Detection:
  Namespace: SmartRouting
  MetricName: RoutingCount
  Dimension: RoutingTier=full-context
  
  通常: full-context は全クエリの5%以下
  異常: full-context が20%を超えた場合 → アラート

追加:
  AWS Cost Anomaly Detection:
  - Bedrock サービスのコスト異常を検知
  - 日次コストが前週平均の200%を超えた場合に通知
```

---

## 実装優先度

| 優先度 | 項目 | 理由 |
|--------|------|------|
| **P0** | #7 Provenance, #13 キャッシュ無効化 | セキュリティ直結 |
| **P1** | #11 フィードバック, #14 エスカレーション, #15 コスト異常 | 運用品質 |
| **P2** | #10 ROI, #3 ダッシュボード, #12 Feature Gate | ビジネス価値 |
| **P3** | #4 ベンチマーク, #5 FlexCache, #6 DR | インフラ最適化 |
| **P4** | #2 SaaS化, #8 ACL即時反映 | 将来拡張 |

---

## 関連ドキュメント

- [PoC 成功事例テンプレート](poc-success-stories-template.md)
- [AI利用ポリシーテンプレート](ai-usage-policy-template.md)
- [ガバナンス・監査設計](governance-and-audit.md)
- [CloudWatch ダッシュボードガイド](cloudwatch-dashboard-guide.md)
- [FSx for ONTAP サイジング・性能設計](fsxn-sizing-and-performance.md)
