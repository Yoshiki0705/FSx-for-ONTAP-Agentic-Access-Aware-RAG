# CloudWatch ダッシュボード運用ガイド

**🌐 Language:** **日本語** | [English](en/cloudwatch-dashboard-guide.md) | [한국어](ko/cloudwatch-dashboard-guide.md) | [简体中文](zh-CN/cloudwatch-dashboard-guide.md) | [繁體中文](zh-TW/cloudwatch-dashboard-guide.md) | [Français](fr/cloudwatch-dashboard-guide.md) | [Deutsch](de/cloudwatch-dashboard-guide.md) | [Español](es/cloudwatch-dashboard-guide.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: 運用チーム、SRE、プラットフォームエンジニア向け

---

## 概要

本ドキュメントは、Permission-aware RAG システムの運用監視に必要な CloudWatch ダッシュボードとアラームの設計・導入ガイドです。`enableMonitoring=true` で CDK が自動作成するダッシュボードに加え、追加で設定すべきメトリクスとアラームを整理します。

---

## 監視メトリクス一覧

### RAG 検索パフォーマンス

| メトリクス | 名前空間 | ディメンション | 説明 | アラート閾値 |
|-----------|---------|-------------|------|------------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | 検索〜回答生成の全体レイテンシ | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Bedrock API 呼び出し回数 | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Bedrock API エラー回数 | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | KB から取得したチャンク数 | — |

### 権限制御

| メトリクス | 名前空間 | ディメンション | 説明 | アラート閾値 |
|-----------|---------|-------------|------|------------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | SID フィルタリングで拒否されたドキュメント数 | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | キャッシュヒット率 | < 20%（異常） |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | キャッシュミス率 | > 80%（異常） |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Fail-Closed 発動回数 | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | SID 解決失敗回数 | > 0 |

### データ同期

| メトリクス | 名前空間 | ディメンション | 説明 | アラート閾値 |
|-----------|---------|-------------|------|------------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | KB 同期所要時間 | > 30min |
| KB Sync Success | `KbAutoSync` | — | 同期成功回数 | — |
| KB Sync Failure | `KbAutoSync` | — | 同期失敗回数 | 3 回連続 |
| ACL Sync Success | `PermissionAwareRAG` | — | ACL 同期成功回数 | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | ACL 同期失敗回数 | > 0 |

### Guardrails

| メトリクス | 名前空間 | ディメンション | 説明 | アラート閾値 |
|-----------|---------|-------------|------|------------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Guardrails によるブロック回数 | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | 全リクエスト中の介入率 | > 10% |

### Agent

| メトリクス | 名前空間 | ディメンション | 説明 | アラート閾値 |
|-----------|---------|-------------|------|------------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | ツール呼び出し回数 | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Agent 実行ステップ数 | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Agent エラー回数 | > 3/5min |

### コスト

| メトリクス | 名前空間 | ディメンション | 説明 | アラート閾値 |
|-----------|---------|-------------|------|------------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | 推定トークンコスト（USD） | 日次 > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | ルーティング先の分布 | — |

---

## ダッシュボードレイアウト

```
┌─────────────────────────────────────────────────────────────────┐
│ Permission-Aware RAG Operations Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Query Latency       │  │ Bedrock Invocations  │              │
│  │ (P50/P95/P99)       │  │ (by Model)           │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Permission Denied   │  │ Cache Hit/Miss Rate  │              │
│  │ Count               │  │                      │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ KB Sync Status      │  │ Guardrails Blocked   │              │
│  │ (Success/Failure)   │  │ Count                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Agent Tool Calls    │  │ Estimated Cost       │              │
│  │ (by Tool)           │  │ Trend                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## アラーム定義

### Critical（即時対応）

```yaml
- AlarmName: RAG-PermissionDenyAllFallback
  MetricName: DenyAllFallbackCount
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]

- AlarmName: RAG-SIDResolutionFailure
  MetricName: SIDResolutionFailure
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 0
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]
```

### Warning（調査必要）

```yaml
- AlarmName: RAG-HighLatency
  MetricName: QueryLatency
  Namespace: PermissionAwareRAG
  ExtendedStatistic: p95
  Period: 300
  EvaluationPeriods: 3
  Threshold: 10000  # 10 seconds in ms
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-KBSyncConsecutiveFailure
  MetricName: KBSyncFailure
  Namespace: KbAutoSync
  Statistic: Sum
  Period: 900
  EvaluationPeriods: 3
  Threshold: 1
  ComparisonOperator: GreaterThanOrEqualToThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-HighCacheMissRate
  MetricName: PermissionCacheMissRate
  Namespace: PermissionAwareRAG
  Statistic: Average
  Period: 300
  EvaluationPeriods: 3
  Threshold: 80
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]
```

---

## トラブルシューティングパターン

### パターン 1: Deny All Fallback が頻発

```
症状: DenyAllFallbackCount が急増
原因候補:
  1. DynamoDB user-access テーブルへの接続障害
  2. 新規ユーザーの SID データ未登録
  3. AD Sync Lambda の失敗

調査手順:
  1. CloudWatch Logs で Lambda エラーを確認
  2. DynamoDB テーブルのスロットリングを確認
  3. AD Sync Lambda の最終実行結果を確認
```

### パターン 2: レイテンシ急増

```
症状: QueryLatency P95 が 10 秒超
原因候補:
  1. Bedrock API のスロットリング
  2. S3 Vectors のコールドスタート
  3. KB 同期中の負荷

調査手順:
  1. Bedrock InvocationLatency を確認
  2. S3 Vectors のクエリレイテンシを確認
  3. KB 同期ジョブの実行状況を確認
```

### パターン 3: コスト急増

```
症状: EstimatedTokenCost が通常の 3 倍以上
原因候補:
  1. Smart Routing が高コストモデルに偏っている
  2. Agent モードの過剰利用
  3. 不正な大量リクエスト

調査手順:
  1. SmartRouting RoutingTier の分布を確認
  2. Agent StepCount の異常値を確認
  3. WAF レートリミットのブロック数を確認
```

---

## ダッシュボードのインポート手順

### CDK 自動作成（推奨）

```bash
# enableMonitoring=true で自動作成
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### 手動インポート

```bash
# monitoring/cloudwatch-dashboard.json を使用
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 本番化チェックリスト（監視設定項目） |
| [permission-consistency.md](permission-consistency.md) | 権限変更時の監視推奨設定 |
| [governance-and-audit.md](governance-and-audit.md) | 監査ログとレポート生成 |
| [threat-model.md](threat-model.md) | 脅威モデル（監視で検出すべき脅威） |
