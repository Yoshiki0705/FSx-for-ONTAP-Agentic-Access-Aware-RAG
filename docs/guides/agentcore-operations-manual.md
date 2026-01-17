# Amazon Bedrock AgentCore - 運用手順書

**バージョン**: 1.0.0  
**作成日**: 2026-01-05  
**最終更新**: 2026-01-05  
**対象**: 運用チーム、DevOpsエンジニア

---

## 📋 目次

1. [概要](#概要)
2. [日次運用チェックリスト](#日次運用チェックリスト)
3. [週次運用チェックリスト](#週次運用チェックリスト)
4. [月次運用チェックリスト](#月次運用チェックリスト)
5. [定期メンテナンス手順](#定期メンテナンス手順)
6. [バックアップ・リストア手順](#バックアップリストア手順)
7. [スケーリング手順](#スケーリング手順)
8. [緊急時対応手順](#緊急時対応手順)

---

## 概要

本ドキュメントは、Amazon Bedrock AgentCore機能の日常運用に必要な手順を記載しています。

### 対象システム

- **AgentCore Runtime**: エージェント実行環境
- **AgentCore Gateway**: API/Lambda/MCP統合
- **AgentCore Memory**: 会話記憶管理
- **AgentCore Identity**: 認証・認可
- **AgentCore Browser**: Webブラウザ自動化
- **AgentCore Code Interpreter**: コード実行環境
- **AgentCore Observability**: 監視・ログ
- **AgentCore Evaluations**: 品質評価
- **AgentCore Policy**: ポリシー管理

### 運用体制

- **運用時間**: 24時間365日
- **監視体制**: CloudWatch Alarms + X-Ray
- **エスカレーション**: 重大インシデント発生時は即座にエスカレーション

---

## 日次運用チェックリスト

### 実施時間

- **午前**: 9:00 AM（JST）
- **午後**: 6:00 PM（JST）

### チェック項目

#### 1. システム稼働状況確認

```bash
# CloudWatch Dashboardで確認
# https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=AgentCore-Dashboard

# 確認項目:
# - Lambda関数の実行回数
# - Lambda関数のエラー率
# - Lambda関数の平均実行時間
# - DynamoDB読み書きスループット
# - S3バケットのリクエスト数
```

**合格基準**:
- ✅ Lambda関数エラー率 < 1%
- ✅ Lambda関数平均実行時間 < 3秒
- ✅ DynamoDBスロットリングエラー = 0
- ✅ S3エラー率 < 0.1%

#### 2. アラーム状態確認

```bash
# CloudWatch Alarmsで確認
aws cloudwatch describe-alarms \
  --region ap-northeast-1 \
  --alarm-name-prefix "AgentCore" \
  --state-value ALARM

# 期待結果: アラーム状態のアラームが0件
```

**対応**:
- ❌ アラームが発生している場合 → トラブルシューティングガイド参照

#### 3. ログエラー確認

```bash
# CloudWatch Logsで過去24時間のエラーログを確認
aws logs filter-log-events \
  --region ap-northeast-1 \
  --log-group-name "/aws/lambda/TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime" \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '24 hours ago' +%s)000

# 同様に他のLambda関数のログも確認
```

**対応**:
- ❌ エラーログが多数ある場合 → 原因調査とエスカレーション

#### 4. X-Rayトレース確認

```bash
# X-Ray Service Mapで確認
# https://console.aws.amazon.com/xray/home?region=ap-northeast-1#/service-map

# 確認項目:
# - サービス間の接続状態
# - レイテンシの異常
# - エラー率の異常
```

**合格基準**:
- ✅ 全サービスが正常に接続されている
- ✅ レイテンシが通常範囲内（< 1秒）
- ✅ エラー率 < 1%

#### 5. コスト確認

```bash
# Cost Explorerで当日のコストを確認
# https://console.aws.amazon.com/cost-management/home?region=ap-northeast-1#/cost-explorer

# 確認項目:
# - 当日のコストが予算内か
# - 異常なコスト増加がないか
```

**対応**:
- ❌ コストが予算を超過している場合 → 原因調査とコスト最適化

---

## 週次運用チェックリスト

### 実施時間

- **毎週月曜日**: 10:00 AM（JST）

### チェック項目

#### 1. パフォーマンストレンド分析

```bash
# CloudWatch Insightsで過去7日間のパフォーマンストレンドを分析
aws logs start-query \
  --region ap-northeast-1 \
  --log-group-name "/aws/lambda/TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime" \
  --start-time $(date -u -d '7 days ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @duration | stats avg(@duration) as avg_duration by bin(5m)'
```

**分析項目**:
- Lambda関数の平均実行時間の推移
- エラー率の推移
- スループットの推移

**対応**:
- ⚠️ パフォーマンス劣化が見られる場合 → 原因調査とチューニング

#### 2. セキュリティログ確認

```bash
# CloudTrailで過去7日間のセキュリティイベントを確認
aws cloudtrail lookup-events \
  --region ap-northeast-1 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=ConsoleLogin \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)

# 確認項目:
# - 不正なログイン試行
# - 権限変更
# - リソース削除
```

**対応**:
- ❌ 不正なアクセスが検出された場合 → セキュリティインシデント対応手順に従う

#### 3. バックアップ状態確認

```bash
# DynamoDBバックアップ状態確認
aws dynamodb list-backups \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity

# S3バケットバージョニング確認
aws s3api get-bucket-versioning \
  --bucket tokyoregion-permission-aware-rag-prod-browser-screenshots
```

**合格基準**:
- ✅ DynamoDBバックアップが過去7日間毎日作成されている
- ✅ S3バケットバージョニングが有効

#### 4. コスト週次レビュー

```bash
# Cost Explorerで過去7日間のコストを確認
# 前週との比較
# サービス別コスト内訳
```

**分析項目**:
- 週次コストトレンド
- サービス別コスト内訳
- 予算との差異

#### 5. 品質メトリクス確認

```bash
# AgentCore Evaluationsの品質メトリクスを確認
# CloudWatch Dashboardで確認
# - 正確性（Accuracy）
# - 関連性（Relevance）
# - 有用性（Helpfulness）
```

**合格基準**:
- ✅ 正確性 > 90%
- ✅ 関連性 > 85%
- ✅ 有用性 > 80%

---

## 月次運用チェックリスト

### 実施時間

- **毎月1日**: 10:00 AM（JST）

### チェック項目

#### 1. 月次パフォーマンスレポート作成

```bash
# CloudWatch Insightsで過去30日間のパフォーマンスレポートを作成
# - Lambda関数実行回数
# - 平均実行時間
# - エラー率
# - スループット
```

**レポート項目**:
- 月次パフォーマンスサマリー
- 前月との比較
- 改善提案

#### 2. 月次コストレポート作成

```bash
# Cost Explorerで過去30日間のコストレポートを作成
# - サービス別コスト
# - リージョン別コスト
# - タグ別コスト
```

**レポート項目**:
- 月次コストサマリー
- 前月との比較
- コスト最適化提案

#### 3. セキュリティ監査

```bash
# IAM Access Analyzerで権限の過剰付与を確認
aws accessanalyzer list-findings \
  --region ap-northeast-1 \
  --analyzer-arn arn:aws:access-analyzer:ap-northeast-1:ACCOUNT_ID:analyzer/AgentCore

# AWS Configで設定変更履歴を確認
aws configservice describe-configuration-recorder-status \
  --region ap-northeast-1
```

**確認項目**:
- IAM権限の過剰付与
- セキュリティグループの設定変更
- 暗号化設定の変更

#### 4. バックアップテスト

```bash
# DynamoDBバックアップからのリストアテスト（テスト環境）
aws dynamodb restore-table-from-backup \
  --region ap-northeast-1 \
  --target-table-name TokyoRegion-permission-aware-rag-test-AgentCore-Identity-Restore \
  --backup-arn arn:aws:dynamodb:ap-northeast-1:ACCOUNT_ID:table/TokyoRegion-permission-aware-rag-prod-AgentCore-Identity/backup/BACKUP_ID

# リストア後の動作確認
# - データ整合性確認
# - 機能動作確認
```

**合格基準**:
- ✅ リストアが成功する
- ✅ データ整合性が保たれている
- ✅ 機能が正常に動作する

#### 5. ドキュメント更新

```bash
# 以下のドキュメントを最新化
# - 運用手順書（本ドキュメント）
# - トラブルシューティングガイド
# - セキュリティベストプラクティス
# - FAQ
```

**更新項目**:
- 新しい問題と解決策の追加
- 手順の改善
- 連絡先の更新

---

## 定期メンテナンス手順

### Lambda関数の定期メンテナンス

#### 実施頻度

- **毎月第2土曜日**: 2:00 AM - 4:00 AM（JST）

#### メンテナンス内容

1. **Lambda関数のランタイム更新**

```bash
# Node.js 22.xの最新パッチバージョンに更新
aws lambda update-function-configuration \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --runtime nodejs22.x

# 同様に他のLambda関数も更新
```

2. **Lambda Layerの更新**

```bash
# 依存パッケージの更新
cd lambda/agent-core-runtime
npm update
npm audit fix

# 新しいLayerバージョンの作成
zip -r layer.zip node_modules
aws lambda publish-layer-version \
  --region ap-northeast-1 \
  --layer-name AgentCore-Runtime-Dependencies \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs22.x
```

3. **動作確認**

```bash
# Lambda関数の動作確認
aws lambda invoke \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --payload '{"test": true}' \
  /tmp/response.json

# レスポンス確認
cat /tmp/response.json
```

### DynamoDBの定期メンテナンス

#### 実施頻度

- **毎月第3土曜日**: 2:00 AM - 4:00 AM（JST）

#### メンテナンス内容

1. **テーブルのバックアップ作成**

```bash
# オンデマンドバックアップ作成
aws dynamodb create-backup \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --backup-name "monthly-backup-$(date +%Y%m%d)"
```

2. **古いバックアップの削除**

```bash
# 90日以上前のバックアップを削除
aws dynamodb list-backups \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --time-range-lower-bound $(date -u -d '90 days ago' +%s) \
  --time-range-upper-bound $(date -u -d '91 days ago' +%s) \
  | jq -r '.BackupSummaries[].BackupArn' \
  | xargs -I {} aws dynamodb delete-backup --region ap-northeast-1 --backup-arn {}
```

3. **テーブルメトリクスの確認**

```bash
# 読み書きスループットの確認
aws cloudwatch get-metric-statistics \
  --region ap-northeast-1 \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average
```

---

## バックアップ・リストア手順

### DynamoDBバックアップ

#### 自動バックアップ（Point-in-Time Recovery）

```bash
# PITRの有効化確認
aws dynamodb describe-continuous-backups \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity

# PITRが無効の場合は有効化
aws dynamodb update-continuous-backups \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

#### オンデマンドバックアップ

```bash
# バックアップ作成
aws dynamodb create-backup \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --backup-name "manual-backup-$(date +%Y%m%d-%H%M%S)"

# バックアップ一覧確認
aws dynamodb list-backups \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity
```

### DynamoDBリストア

#### PITRからのリストア

```bash
# 特定時点へのリストア
aws dynamodb restore-table-to-point-in-time \
  --region ap-northeast-1 \
  --source-table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --target-table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity-Restored \
  --restore-date-time "2026-01-05T10:00:00Z"

# リストア状態確認
aws dynamodb describe-table \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity-Restored
```

#### バックアップからのリストア

```bash
# バックアップからのリストア
aws dynamodb restore-table-from-backup \
  --region ap-northeast-1 \
  --target-table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity-Restored \
  --backup-arn arn:aws:dynamodb:ap-northeast-1:ACCOUNT_ID:table/TokyoRegion-permission-aware-rag-prod-AgentCore-Identity/backup/BACKUP_ID

# リストア完了待機
aws dynamodb wait table-exists \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity-Restored
```

### S3バックアップ

#### バージョニングの有効化

```bash
# バージョニング有効化
aws s3api put-bucket-versioning \
  --bucket tokyoregion-permission-aware-rag-prod-browser-screenshots \
  --versioning-configuration Status=Enabled

# バージョニング状態確認
aws s3api get-bucket-versioning \
  --bucket tokyoregion-permission-aware-rag-prod-browser-screenshots
```

#### オブジェクトのリストア

```bash
# 削除されたオブジェクトのバージョン一覧確認
aws s3api list-object-versions \
  --bucket tokyoregion-permission-aware-rag-prod-browser-screenshots \
  --prefix "screenshots/2026/01/05/"

# 特定バージョンのリストア
aws s3api copy-object \
  --bucket tokyoregion-permission-aware-rag-prod-browser-screenshots \
  --copy-source "tokyoregion-permission-aware-rag-prod-browser-screenshots/screenshots/2026/01/05/screenshot.png?versionId=VERSION_ID" \
  --key "screenshots/2026/01/05/screenshot.png"
```

---

## スケーリング手順

### Lambda関数のスケーリング

#### Reserved Concurrencyの調整

```bash
# 現在の設定確認
aws lambda get-function-concurrency \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime

# Reserved Concurrencyの増加（10 → 20）
aws lambda put-function-concurrency \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --reserved-concurrent-executions 20

# 動作確認
aws lambda invoke \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --payload '{"test": true}' \
  /tmp/response.json
```

#### Provisioned Concurrencyの設定

```bash
# Provisioned Concurrencyの設定
aws lambda put-provisioned-concurrency-config \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --provisioned-concurrent-executions 5 \
  --qualifier "$LATEST"

# 設定確認
aws lambda get-provisioned-concurrency-config \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --qualifier "$LATEST"
```

### DynamoDBのスケーリング

#### オンデマンドモードへの切り替え

```bash
# オンデマンドモードに切り替え
aws dynamodb update-table \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --billing-mode PAY_PER_REQUEST

# 設定確認
aws dynamodb describe-table \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity
```

#### プロビジョニングモードのスケーリング

```bash
# 読み書きキャパシティの増加
aws dynamodb update-table \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10

# Auto Scalingの設定
aws application-autoscaling register-scalable-target \
  --region ap-northeast-1 \
  --service-namespace dynamodb \
  --resource-id "table/TokyoRegion-permission-aware-rag-prod-AgentCore-Identity" \
  --scalable-dimension "dynamodb:table:ReadCapacityUnits" \
  --min-capacity 5 \
  --max-capacity 100
```

---

## 緊急時対応手順

### Lambda関数の緊急停止

```bash
# Reserved Concurrencyを0に設定（新規実行を停止）
aws lambda put-function-concurrency \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --reserved-concurrent-executions 0

# 実行中のインスタンスが完了するまで待機（最大15分）
sleep 900

# 停止確認
aws cloudwatch get-metric-statistics \
  --region ap-northeast-1 \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
```

### Lambda関数の緊急再起動

```bash
# Reserved Concurrencyを元に戻す
aws lambda delete-function-concurrency \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime

# 動作確認
aws lambda invoke \
  --region ap-northeast-1 \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime \
  --payload '{"test": true}' \
  /tmp/response.json
```

### DynamoDBの緊急スロットリング対応

```bash
# オンデマンドモードに緊急切り替え
aws dynamodb update-table \
  --region ap-northeast-1 \
  --table-name TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --billing-mode PAY_PER_REQUEST

# スロットリングエラーの確認
aws cloudwatch get-metric-statistics \
  --region ap-northeast-1 \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=TokyoRegion-permission-aware-rag-prod-AgentCore-Identity \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
```

---

## 連絡先

### 運用チーム

- **メール**: ops-team@example.com
- **Slack**: #agentcore-ops
- **電話**: +81-3-XXXX-XXXX（緊急時のみ）

### エスカレーション

- **レベル1**: 運用チーム（通常の問題）
- **レベル2**: DevOpsチーム（技術的な問題）
- **レベル3**: 開発チーム（コード修正が必要な問題）
- **レベル4**: アーキテクト（アーキテクチャ変更が必要な問題）

---

**このドキュメントは定期的に更新されます。最新版を必ず参照してください。**
