# Transfer Family トリガーモード比較（Polling vs CloudTrail）

**作成日**: 2026-05-24  
**対象**: Transfer Family インジェスションのトリガーモード選択

---

## 概要

Transfer Family インジェスションパイプラインは2つのトリガーモードをサポートします:

| モード | CDK パラメータ | 検出方式 |
|--------|--------------|---------|
| **Polling** (デフォルト) | `transferFamilyTriggerMode: "polling"` | EventBridge Scheduler で定期スキャン |
| **CloudTrail** | `transferFamilyTriggerMode: "cloudtrail"` | S3 データイベント → EventBridge Rule |

---

## 比較表

| 項目 | Polling | CloudTrail |
|------|---------|-----------|
| **検出レイテンシ** | 最大 N 分（ポーリング間隔） | 1-5 分（CloudTrail 配信遅延） |
| **デフォルト間隔** | 5 分 | — (イベント駆動) |
| **コスト構造** | Lambda 実行回数のみ | CloudTrail データイベント + Lambda |
| **月額コスト（100ファイル/日）** | ~$0.50 | ~$3.50 |
| **月額コスト（1,000ファイル/日）** | ~$0.50 | ~$6.00 |
| **月額コスト（10,000ファイル/日）** | ~$0.50 | ~$33.00 |
| **スケーラビリティ** | ファイル数に依存しない | ファイル数に比例 |
| **見逃しリスク** | なし（全件スキャン） | なし（イベント駆動） |
| **DLQ** | なし | あり（2回リトライ後） |
| **CDK リソース** | EventBridge Scheduler + Lambda | CloudTrail Trail + EventBridge Rule + DLQ + Lambda |

---

## コスト詳細

### Polling モード

```
コスト = Lambda 実行回数 × Lambda 単価

- ポーリング間隔: 5分 → 288回/日 → 8,640回/月
- Lambda 実行時間: 平均 5秒 × 256MB
- Lambda コスト: 8,640 × 5s × 256MB / 1024 × $0.0000166667 = ~$0.18/月
- EventBridge Scheduler: 無料（月100万回まで）
- 合計: ~$0.20/月（ファイル数に依存しない）
```

### CloudTrail モード

```
コスト = CloudTrail データイベント + Lambda 実行

- CloudTrail S3 データイベント: $0.10 / 100,000 イベント
  - 100 ファイル/日: 3,000/月 → ~$0.003/月
  - 1,000 ファイル/日: 30,000/月 → ~$0.03/月
  - 10,000 ファイル/日: 300,000/月 → ~$0.30/月
- CloudTrail Trail 管理イベント: 最初のTrailは無料
- Lambda 実行: イベント数に比例
  - 100 ファイル/日: 3,000回/月 × 2s = ~$0.01/月
  - 10,000 ファイル/日: 300,000回/月 × 2s = ~$1.00/月
- CloudTrail ログ保存（S3）: ~$2-5/月（ログ量に依存）
- 合計: $3-33/月（ファイル数に比例）
```

---

## 選択ガイド

### Polling を推奨する場合

- PoC / デモ環境（コスト最小化）
- ファイルアップロード頻度が低い（1日数十件以下）
- 5分の検出遅延が許容できる
- シンプルな構成を優先する

### CloudTrail を推奨する場合

- 本番環境でニアリアルタイム検出が必要
- SLA で「アップロードから5分以内にRAG検索可能」を保証する必要がある
- ファイルアップロードが不定期（バースト的）で、ポーリングの無駄を避けたい
- 監査証跡（CloudTrail ログ）が必要

---

## 設定方法

### Polling モード（デフォルト）

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5
}
```

### CloudTrail モード

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "cloudtrail"
}
```

---

## 注意事項

- CloudTrail モードでは、S3 データイベントの配信に 1-5 分の遅延があります（AWS の仕様）
- CloudTrail Trail は AWS アカウントあたりの上限があります（デフォルト 5）
- 既に S3 データイベントを記録する Trail がある場合、重複課金に注意してください
- Polling モードと CloudTrail モードは排他的です（同時有効化は不可）
