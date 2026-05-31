# Event-Driven Agent Trigger — 設計ドキュメント

**作成日**: 2026-05-31
**ステータス**: 設計中（Phase 2）
**参考実装**: [aws-samples/sample-multi-agent-orchestration-chat-on-agentcore](https://github.com/aws-samples/sample-multi-agent-orchestration-chat-on-agentcore/tree/main/packages/trigger)

---

## 概要

KB Auto-Sync や Transfer Family インジェスション完了後に、Agent を自動起動して後処理（要約生成、分類、通知等）を実行するイベント駆動パターン。

MOCA リポジトリの `packages/trigger/` が実装する EventBridge Scheduler + Custom Event Handler パターンを、本プロジェクトの Permission-aware RAG パイプラインに適用する。

---

## ユースケース

| トリガーイベント | 自動起動 Agent | 出力 |
|----------------|---------------|------|
| KB Ingestion Job COMPLETE | 要約生成 Agent | 新規ドキュメントの要約を DynamoDB に保存 |
| Transfer Family ファイルアップロード | 分類 Agent | ドキュメントカテゴリを `.metadata.json` に追記 |
| Capacity Guardrails BREAK_GLASS 発動 | 通知 Agent | Slack/Teams に構造化アラート送信 |
| スケジュール（毎日 9:00） | レポート Agent | 日次 RAG 利用統計レポート生成 |

---

## アーキテクチャ

```
┌─────────────────────┐     ┌──────────────────────┐
│ EventBridge Rule    │     │ EventBridge Scheduler│
│ (KB Ingestion       │     │ (Daily 09:00 JST)    │
│  COMPLETE event)    │     │                      │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────┐
│           Agent Trigger Lambda                   │
│  1. Resolve trigger config (DynamoDB)            │
│  2. Authenticate (Machine User token)            │
│  3. Invoke Agent (fire-and-forget)               │
│  4. Record execution (DynamoDB)                  │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│           Bedrock Agent / Strands Agent           │
│  • Permission-aware Search (SID filtering)       │
│  • Document summarization                        │
│  • Classification                                │
│  • Notification dispatch                         │
└─────────────────────────────────────────────────┘
```

---

## MOCA パターンとの対応

| MOCA コンポーネント | 本プロジェクトでの対応 |
|-------------------|---------------------|
| `schedule-handler.ts` | EventBridge Scheduler → Lambda → Agent 呼び出し |
| `custom-event-handler.ts` | KB Ingestion COMPLETE イベント → Agent 呼び出し |
| `AuthService` (Machine User token) | Cognito App Client credentials flow |
| `AgentInvoker` (fire-and-forget) | Bedrock InvokeAgent API (async) |
| `ExecutionRecorder` (DynamoDB) | 実行履歴テーブル（triggerId, sessionId, status） |
| GSI2 (eventSourceId → triggers) | DynamoDB GSI で eventSource → 対象 trigger を検索 |

---

## DynamoDB テーブル設計

### agent-triggers テーブル

| キー | 型 | 説明 |
|------|-----|------|
| PK: `userId` | S | トリガー所有者 |
| SK: `triggerId` | S | トリガー ID (ULID) |
| GSI1PK: `AGENT#{agentId}` | S | Agent 別検索 |
| GSI2PK: `EVENTSOURCE#{eventSourceId}` | S | イベントソース別検索 |
| name | S | トリガー名 |
| agentId | S | 起動する Agent ID |
| prompt | S | Agent に渡すプロンプト |
| eventSourceId | S | イベントソース識別子 |
| enabled | BOOL | 有効/無効 |
| lastExecutionAt | S | 最終実行日時 |

### agent-trigger-executions テーブル

| キー | 型 | 説明 |
|------|-----|------|
| PK: `triggerId` | S | トリガー ID |
| SK: `executionId` | S | 実行 ID (ULID) |
| sessionId | S | Agent セッション ID |
| status | S | success / failure |
| error | S | エラーメッセージ（失敗時） |
| eventDetail | M | トリガーイベント詳細 |
| TTL | N | 30 日後に自動削除 |

---

## CDK 実装方針

```typescript
// lib/constructs/event-driven-agent-construct.ts
export interface EventDrivenAgentProps {
  agentId: string;
  triggerTable: dynamodb.ITable;
  executionTable: dynamodb.ITable;
  cognitoUserPool: cognito.IUserPool;
  // EventBridge ルール定義
  eventRules?: {
    kbIngestionComplete?: boolean;  // KB Ingestion COMPLETE イベント
    capacityBreakGlass?: boolean;   // BREAK_GLASS 発動イベント
  };
  // スケジュール定義
  schedules?: {
    dailyReport?: string;  // cron 式
  };
}
```

---

## 実装フェーズ

### Phase 2.1: 基盤（2-3日）
- [ ] DynamoDB テーブル定義（CDK）
- [ ] Agent Trigger Lambda 実装（TypeScript）
- [ ] EventBridge Rule: KB Ingestion COMPLETE

### Phase 2.2: UI（2-3日）
- [ ] トリガー管理 UI（Agent Directory に「Triggers」タブ追加）
- [ ] 実行履歴表示
- [ ] 有効/無効トグル

### Phase 2.3: 拡張（1-2日）
- [ ] スケジュールトリガー（EventBridge Scheduler）
- [ ] カスタムイベントトリガー（Transfer Family, BREAK_GLASS）
- [ ] 実行結果の AppSync Events リアルタイム通知

---

## 前提条件

- `enableAgent=true`（Bedrock Agent が有効）
- KB Auto-Sync が有効（`enableKbAutoSync=true`）— KB Ingestion イベントの発生源
- Cognito App Client（Machine-to-Machine 認証用）

---

## セキュリティ考慮事項

- Agent Trigger Lambda は Machine User トークンで Agent を呼び出す
- Agent 実行時の SID フィルタリングは通常通り適用（トリガー所有者の権限で実行）
- 実行履歴に prompt 内容は保存しない（PII リスク回避）
- BREAK_GLASS トリガーは SNS 通知と併用（Agent 失敗時のフォールバック）

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [implementation-overview.md](implementation-overview.md) | 項目 21: KB Auto-Sync |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR-005: データ同期方式 |
| [next-generation-features-design.md](next-generation-features-design.md) | 次世代機能設計 |
