# Alert Management System Guide

## 概要

Embedding Batch Workload用の包括的なアラート管理システムです。CloudWatchアラーム、SNS通知、自動修復、エスカレーション機能を統合し、システムの健全性を24時間監視します。

## 主な機能

### 🚨 多層アラートシステム
- **CRITICAL**: システムダウン、データ損失リスク
- **HIGH**: 高CPU使用率、ジョブキューバックログ
- **MEDIUM**: 長時間実行ジョブ、高メモリ使用率
- **LOW**: 低スループット、未使用リソース

### 📧 多チャネル通知
- **Email**: SES統合、カスタムテンプレート
- **SMS**: SNS統合、緊急時通知
- **Slack**: Webhook統合、チャネル別通知
- **PagerDuty**: インシデント管理統合
- **Webhook**: カスタム統合

### 🔧 自動修復機能
- **スケールアップ**: リソース不足時の自動拡張
- **再起動**: 障害時の自動復旧
- **フェイルオーバー**: 冗長性確保
- **安全チェック**: コスト制限、依存関係確認

### 📈 エスカレーション機能
- **段階的エスカレーション**: 未対応アラートの自動エスカレーション
- **役割ベース通知**: 責任者への適切な通知
- **インシデント作成**: 重大な問題の自動チケット化

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudWatch    │    │   SNS Topics    │    │   Lambda        │
│   Alarms        │───▶│   (4 Severity   │───▶│   Functions     │
│                 │    │   Levels)       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Composite     │    │   External      │    │   Auto          │
│   Alarms        │    │   Integrations  │    │   Remediation   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## セットアップ

### 1. 基本設定

```bash
# アラートシステムの設定
./scripts/setup-alerts.sh --environment prod --setup-contacts

# 設定の検証
./scripts/setup-alerts.sh --validate --config custom-config.json

# デプロイ
./scripts/setup-alerts.sh --deploy --environment prod
```

### 2. 設定ファイル

#### 本番環境設定例
```json
{
  "enabled": true,
  "contacts": [
    {
      "name": "Primary Operations Team",
      "email": "ops-primary@company.com",
      "sms": "+1234567890",
      "severity": ["CRITICAL", "HIGH"],
      "role": "PRIMARY_ONCALL"
    }
  ],
  "thresholds": {
    "critical": {
      "systemDownMinutes": 3,
      "jobFailureRatePercent": 75,
      "fsxUnavailableMinutes": 2,
      "dataLossRisk": true
    }
  }
}
```

#### 開発環境設定例
```json
{
  "enabled": true,
  "contacts": [
    {
      "name": "Development Team",
      "email": "dev-team@company.com",
      "severity": ["CRITICAL", "HIGH"],
      "role": "ENGINEER"
    }
  ],
  "thresholds": {
    "critical": {
      "systemDownMinutes": 10,
      "jobFailureRatePercent": 90
    }
  }
}
```

### 3. 外部統合設定

#### Slack統合
```bash
# Slack Webhook URLの設定
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# 統合設定
./scripts/setup-alerts.sh --setup-integrations
```

#### PagerDuty統合
```bash
# PagerDuty統合キーの設定
export PAGERDUTY_INTEGRATION_KEY="your-pagerduty-key"

# 統合設定
./scripts/setup-alerts.sh --setup-integrations
```

## アラーム詳細

### Critical Alarms

#### System Down Alarm
- **メトリック**: AWS/Batch RunningJobs
- **閾値**: 0 (3回連続)
- **説明**: システムが完全にダウンしている状態
- **自動修復**: コンピュート環境の再有効化、スケールアップ

#### High Job Failure Rate
- **メトリック**: (FailedJobs / (CompletedJobs + FailedJobs)) * 100
- **閾値**: 50% (2回連続)
- **説明**: ジョブ失敗率が異常に高い状態
- **自動修復**: 失敗パターン分析、リソース調整

#### FSx Unavailable
- **メトリック**: AWS/FSx ClientConnections
- **閾値**: < 1 (3回連続)
- **説明**: FSxファイルシステムが利用不可
- **自動修復**: 接続確認、ネットワーク診断

### High Priority Alarms

#### High CPU Utilization
- **メトリック**: AWS/EC2 CPUUtilization
- **閾値**: 85% (3回連続)
- **説明**: CPU使用率が高い状態
- **自動修復**: Auto Scaling Group拡張

#### Job Queue Backlog
- **メトリック**: AWS/Batch RunnableJobs
- **閾値**: 100 (2回連続)
- **説明**: ジョブキューにバックログが蓄積
- **自動修復**: コンピュート環境スケールアップ

#### DynamoDB Throttling
- **メトリック**: AWS/DynamoDB ThrottledRequests
- **閾値**: 10 (2回連続)
- **説明**: DynamoDBリクエストがスロットリング
- **自動修復**: 容量調整の提案

### Medium Priority Alarms

#### Long Running Jobs
- **メトリック**: カスタムメトリック JobDuration
- **閾値**: 3600秒 (2回連続)
- **説明**: ジョブが予想以上に長時間実行
- **自動修復**: ジョブ分析、リソース最適化

#### High Memory Usage
- **メトリック**: CWAgent mem_used_percent
- **閾値**: 80% (3回連続)
- **説明**: メモリ使用率が高い状態
- **自動修復**: メモリ最適化の提案

### Low Priority Alarms

#### Low Job Throughput
- **メトリック**: AWS/Batch CompletedJobs
- **閾値**: < 10 (1時間あたり、2回連続)
- **説明**: ジョブスループットが低い状態
- **自動修復**: パフォーマンス分析

## 自動修復機能

### 修復アクション

#### システムダウン対応
```typescript
// コンピュート環境の再有効化
await batch.updateComputeEnvironment({
  computeEnvironment: computeEnvironmentName,
  state: 'ENABLED'
}).promise();

// 容量のスケールアップ
await batch.updateComputeEnvironment({
  computeEnvironment: computeEnvironmentName,
  computeResources: {
    desiredvCpus: 10
  }
}).promise();
```

#### 高CPU使用率対応
```typescript
// Auto Scaling Groupの拡張
await autoscaling.setDesiredCapacity({
  AutoScalingGroupName: asgName,
  DesiredCapacity: currentCapacity + 2
}).promise();
```

#### ジョブバックログ対応
```typescript
// コンピュート環境の動的スケーリング
const newCapacity = Math.min(currentCapacity * 1.5, maxCapacity);
await batch.updateComputeEnvironment({
  computeEnvironment: computeEnvironmentName,
  computeResources: {
    desiredvCpus: newCapacity
  }
}).promise();
```

### 安全チェック

#### コスト制限
```json
{
  "name": "cost_limit_check",
  "type": "cost_limit",
  "parameters": {
    "maxHourlyCost": 200,
    "maxDailyCost": 2000
  },
  "failureAction": "abort"
}
```

#### リソース制限
```json
{
  "name": "resource_limit_check",
  "type": "resource_limit",
  "parameters": {
    "maxInstances": 50,
    "maxVcpus": 1000
  },
  "failureAction": "notify"
}
```

#### 依存関係チェック
```json
{
  "name": "dependency_check",
  "type": "dependency_check",
  "parameters": {
    "requiredServices": ["fsx", "dynamodb", "s3"],
    "healthCheckEndpoint": "/health"
  },
  "failureAction": "abort"
}
```

## エスカレーション機能

### エスカレーションルール

#### レベル1: 15分後
```json
{
  "level": 1,
  "triggerAfterMinutes": 15,
  "conditions": [
    {
      "type": "unacknowledged",
      "value": "true",
      "operator": "equals"
    }
  ],
  "actions": [
    {
      "type": "notify",
      "target": "manager",
      "parameters": {
        "method": "sms"
      }
    }
  ]
}
```

#### レベル2: 30分後
```json
{
  "level": 2,
  "triggerAfterMinutes": 30,
  "conditions": [
    {
      "type": "unacknowledged",
      "value": "true",
      "operator": "equals"
    }
  ],
  "actions": [
    {
      "type": "page",
      "target": "executive-team",
      "parameters": {
        "urgency": "high"
      }
    }
  ]
}
```

#### レベル3: 60分後
```json
{
  "level": 3,
  "triggerAfterMinutes": 60,
  "conditions": [
    {
      "type": "repeated",
      "value": "5",
      "operator": "greater_than"
    }
  ],
  "actions": [
    {
      "type": "create_incident",
      "target": "incident-management",
      "parameters": {
        "severity": "P1"
      }
    }
  ]
}
```

## 通知設定

### メールテンプレート

#### Critical Alert Template
```html
<html>
<body>
  <h1 style="color: red;">🚨 CRITICAL ALERT</h1>
  <h2>{{alarmName}}</h2>
  <p><strong>Description:</strong> {{alarmDescription}}</p>
  <p><strong>Time:</strong> {{timestamp}}</p>
  <p><strong>Region:</strong> {{region}}</p>
  <p><strong>State:</strong> {{newState}}</p>
  <p><strong>Reason:</strong> {{reason}}</p>
  <hr>
  <p>This is a critical alert requiring immediate attention.</p>
  <p>For escalation, contact the on-call manager.</p>
</body>
</html>
```

#### Slack通知例
```json
{
  "text": "🚨 Alert: System Down Detected",
  "attachments": [{
    "color": "danger",
    "fields": [
      {"title": "Alarm", "value": "system-down", "short": true},
      {"title": "State", "value": "ALARM", "short": true},
      {"title": "Reason", "value": "No running jobs detected", "short": false},
      {"title": "Time", "value": "2024-01-15T10:30:00Z", "short": true}
    ]
  }]
}
```

### SMS通知
```
🚨 CRITICAL: System Down
Time: 10:30 AM
Reason: No running jobs
Action: Check compute environment
```

## 運用ガイド

### 日常監視

#### ダッシュボード確認
1. CloudWatchダッシュボードでシステム状態確認
2. アラーム状態の定期チェック
3. メトリクス傾向の分析

#### 週次レビュー
1. アラート発生頻度の分析
2. 自動修復成功率の確認
3. 閾値調整の検討

#### 月次レビュー
1. エスカレーション発生状況の分析
2. 連絡先情報の更新
3. 統合設定の見直し

### トラブルシューティング

#### アラートが発生しない場合
1. CloudWatchアラームの状態確認
2. メトリクスデータの確認
3. SNSトピックの設定確認

#### 通知が届かない場合
1. SNSサブスクリプションの確認
2. メールアドレス/電話番号の確認
3. 外部統合の設定確認

#### 自動修復が動作しない場合
1. Lambda関数のログ確認
2. IAM権限の確認
3. 安全チェックの状態確認

### パフォーマンス最適化

#### 閾値調整
```bash
# 現在の閾値確認
jq '.thresholds' alert-config.json

# 閾値の調整
jq '.thresholds.high.cpuUtilizationPercent = 90' alert-config.json > temp.json
mv temp.json alert-config.json
```

#### 通知頻度調整
```bash
# 重複抑制時間の調整
jq '.notifications.filtering.duplicateSuppressionMinutes = 20' alert-config.json > temp.json
mv temp.json alert-config.json
```

#### バッチング設定
```bash
# バッチング有効化
jq '.notifications.batching.enabled = true' alert-config.json > temp.json
mv temp.json alert-config.json
```

## セキュリティ考慮事項

### 機密情報の保護
- Webhook URL、API キーの暗号化
- IAM権限の最小化
- ログ出力での機密情報マスキング

### アクセス制御
- SNSトピックへのアクセス制限
- Lambda関数の実行権限制限
- CloudWatchアラームの変更権限制限

### 監査ログ
- アラート発生履歴の記録
- 自動修復アクション履歴の記録
- 設定変更履歴の記録

## FAQ

### Q: アラートが多すぎる場合はどうすればよいですか？
A: 閾値の調整、重複抑制時間の延長、バッチング機能の有効化を検討してください。

### Q: 自動修復が失敗する場合はどうすればよいですか？
A: Lambda関数のログを確認し、IAM権限や安全チェックの設定を見直してください。

### Q: 新しい統合を追加したい場合はどうすればよいですか？
A: `setup-alerts.sh --setup-integrations`を実行し、カスタムWebhook統合を設定してください。

### Q: 環境別に異なる設定を使いたい場合はどうすればよいですか？
A: 環境別の設定ファイルを作成し、`--config`オプションで指定してください。

## 関連ドキュメント

- [Monitoring Dashboard Guide](MONITORING_DASHBOARD_GUIDE.md)
- [Operations Guide](OPERATIONS_MONITORING_GUIDE.md)
- [Security Best Practices](SECURITY_BEST_PRACTICES_GUIDE.md)
- [Cost Optimization Guide](COST_OPTIMIZATION_GUIDE.md)