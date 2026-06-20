# Conception de la gestion des erreurs KB Auto-Sync

## Overview

KB Auto-Sync（`enableKbAutoSync=true`）のエラー発生時のフロー、リトライ戦略、アラート、および手動復旧手順を定義する。

## エラー検出メカニズム

### CloudWatch Alarm（自動検出）

```
EventBridge Scheduler (5分間隔)
  → Lambda実行
    → 成功: メトリクス正常
    → 失敗: Lambda Errorsメトリクス +1
      → 3回連続エラー: CloudWatch Alarm発報
        → SNS通知（enableMonitoring=true時）
```

**アラーム設定:**
- 名前: `${prefix}-kb-auto-sync-errors`
- 閾値: 1エラー × 3連続期間
- 期間: ポーリング間隔と同じ（デフォルト5分）
- 欠落データ: NOT_BREACHING（Lambda未実行時はアラームなし）

### EMFメトリクス（詳細監視）

KB Auto-Sync Lambda は以下のカスタムメトリクスを出力:

| メトリクス名 | Namespace | 意味 |
|-------------|-----------|------|
| `FilesScanned` | `KbAutoSync` | スキャンしたファイル数 |
| `FilesChanged` | `KbAutoSync` | 変更検出されたファイル数 |
| `IngestionJobTriggered` | `KbAutoSync` | インジェスションジョブ開始数 |
| `IngestionJobFailed` | `KbAutoSync` | インジェスションジョブ失敗数 |
| `InventoryDiffErrors` | `KbAutoSync` | インベントリ差分計算エラー数 |

## エラーパターンと対応

### Pattern 1: S3 Access Point ListObjectsV2 エラー

**原因**: FSx for ONTAP S3 AP接続エラー、IAM権限不足、S3 AP削除済み

**動作**:
- Lambda はエラーをログに出力して例外スロー
- CloudWatch Alarm が3回連続後に発報
- DynamoDBインベントリは変更されない（アトミック性維持）

**手動復旧**:
```bash
# 1. S3 AP存在確認
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. Lambda環境変数のS3 AP ARN確認
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. 手動実行テスト
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### Pattern 2: Bedrock KB Ingestion Job 失敗

**原因**: KBデータソース設定エラー、S3 APアクセス権限エラー、チャンキング/パーシングエラー

**動作**:
- Lambda は `StartIngestionJob` → `GetIngestionJob` でステータス追跡
- ジョブステータスが `FAILED` の場合:
  - DynamoDBインベントリのファイルを `status: "failed"` に更新
  - 次回ポーリング時に再取り込みを試行しない（無限リトライ防止）
  - `IngestionJobFailed` メトリクス出力
- ジョブステータスが `IN_PROGRESS` の場合:
  - 重複ジョブは起動しない（IN_PROGRESS排他制御）

**手動復旧**:
```bash
# 1. 失敗ジョブの詳細確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. 失敗ファイルのインベントリ確認
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. 失敗ファイルのインベントリをリセット（再取り込み可能に）
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. 手動インジェスション実行
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### Pattern 3: DynamoDB インベントリテーブルエラー

**原因**: DynamoDB容量超過、権限エラー、テーブル削除

**動作**:
- Lambda は例外スローで即時終了
- Fail-safe: インベントリ更新なし → 次回ポーリングで再スキャン
- CloudWatch Alarm が3回連続後に発報

**手動復旧**:
```bash
# インベントリテーブル存在確認
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# テーブルが存在しない場合: CDK再デプロイ
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### Pattern 4: Lambda タイムアウト（5分超過）

**原因**: 大量ファイルスキャン（>10,000ファイル）、ListObjectsV2の高レイテンシ

**動作**:
- Lambda は5分でタイムアウト → Errorsメトリクス
- 部分的にスキャンされたファイルはインベントリに記録されない（アトミック性維持）

**対策**:
- `kbAutoSyncIntervalMinutes` を長めに設定（15分等）
- ファイル数が非常に多い場合は S3 AP のプレフィックス分割を検討

## リトライ戦略

| エラーパターン | 自動リトライ | リトライ間隔 | 最大リトライ |
|--------------|-------------|-------------|------------|
| S3 AP接続エラー | ✅（次回ポーリング） | ポーリング間隔（5分） | 無制限（アラームで検知） |
| KB Ingestion失敗 | ❌（手動リセット要） | — | — |
| DynamoDB エラー | ✅（次回ポーリング） | ポーリング間隔（5分） | 無制限（アラームで検知） |
| Lambda タイムアウト | ✅（次回ポーリング） | ポーリング間隔（5分） | 無制限（アラームで検知） |

**設計判断**: Dead Letter Queue (DLQ) は採用していない。EventBridge Scheduler経由の定期ポーリングパターンでは、失敗した処理は次回ポーリングで自動的にリトライされるため、DLQは不要。ただし、KB Ingestion Job自体の失敗は自動リトライしない（データ品質問題の可能性があるため手動確認を要求）。

## インジェスション失敗時のFail-Closed原則

KB Auto-SyncのエラーがPermission-aware RAGのセキュリティに影響しないことを保証する:

1. **インベントリ未更新 = 既存インデックスが維持される** — 新ファイルが検索対象に入らないだけで、既存ファイルのPermission制御は維持
2. **失敗したファイルは `status: "failed"` でマーク** — 次回ポーリングで自動再取り込みしない（手動確認後にリセット）
3. **IN_PROGRESSジョブ排他制御** — 二重インジェスションによるデータ不整合を防止
4. **Permission metadata (.metadata.json) なしファイル** — KBに取り込まれてもRAG検索時にFail-closedフィルタで除外される（Fail-closed原則は常に適用）

## 監視ダッシュボード

`enableMonitoring=true` 時、CloudWatchダッシュボードに以下のウィジェットが追加される:

- **KB Auto-Sync Errors**: Lambda Errors メトリクス（5分間隔）
- **Ingestion Job Status**: 成功/失敗/進行中のジョブ数
- **Files Changed**: ポーリングあたりの変更検出ファイル数
- **Scan Duration**: Lambda実行時間（P50/P90/P99）

## 関連ドキュメント

- [権限整合性モデル](permission-consistency.md) — ACL変更伝播フローとKBインデックス更新の関係
- [CloudWatch ダッシュボードガイド](cloudwatch-dashboard-guide.md) — 監視メトリクスの見方
- [本番化チェックリスト](production-readiness-checklist.md) — KB Auto-Syncの本番化要件
