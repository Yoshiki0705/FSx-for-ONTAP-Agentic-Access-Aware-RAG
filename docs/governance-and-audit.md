# ガバナンス・監査設計（Governance and Audit）

**🌐 Language:** **日本語** | [English](en/governance-and-audit.md) | [한국어](ko/governance-and-audit.md) | [简体中文](zh-CN/governance-and-audit.md) | [繁體中文](zh-TW/governance-and-audit.md) | [Français](fr/governance-and-audit.md) | [Deutsch](de/governance-and-audit.md) | [Español](es/governance-and-audit.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: セキュリティ担当者、コンプライアンス担当者、公共・医療・金融セクター向け

---

## 概要

本ドキュメントは、Permission-aware RAG システムにおける監査ログ設計、ガバナンスフレームワーク、Responsible AI の実装指針を整理します。「誰が、いつ、どの文書に基づいて、どんな回答を得たか」を説明可能にすることを目的とします。

> **⚠️ 免責事項**: 本ドキュメントはガバナンス設計の参考情報であり、法的・規制上の判断を代替するものではありません。業界固有の規制（FISC、ISMAP、HIPAA 等）への準拠については、必ず法務・コンプライアンス部門または専門家の判断を仰いでください。

---

## 監査ログスキーマ

### RAG 検索監査ログ

すべての RAG 検索リクエストに対して、以下の情報を記録します。

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Agent モード監査ログ

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### 権限変更監査ログ

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## ログ保存・保護アーキテクチャ

```
┌──────────────────────────────────────────────────────────────────┐
│                        監査ログフロー                              │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3 (監査ログバケット)    │ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock (WORM)    │ │
│  └──────────┘    │ 保持: 1年    │    │ ・KMS 暗号化            │ │
│                  └──────────────┘    │ ・ライフサイクル:        │ │
│                                      │   90日→IA, 365日→Glacier│ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API呼出  │    │ (データイベント)│                               │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ 権限変更 │    │ Streams      │───▶ 権限変更監査ログ            │
│  └──────────┘    └──────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

### 推奨構成

| コンポーネント | 設定 | 目的 |
|--------------|------|------|
| CloudWatch Logs | 保持期間: 1 年 | 運用ログ、デバッグ |
| S3 監査ログバケット | Object Lock (Governance Mode) | 改ざん防止 |
| KMS CMK | 自動ローテーション有効 | 暗号化 |
| CloudTrail | 管理 + データイベント | API 呼び出し追跡 |
| S3 ライフサイクル | 90 日 → IA、365 日 → Glacier | コスト最適化 |
| Athena | パーティション化テーブル | ログ分析・検索 |

---

## Responsible AI / Guardrails 設計

### Bedrock Guardrails の活用

`enableGuardrails=true` で有効化される Guardrails の構成:

| ポリシー | 目的 | 設定例 |
|---------|------|--------|
| コンテンツフィルタ | 有害コンテンツの検出・ブロック | HATE: HIGH, VIOLENCE: HIGH |
| トピックポリシー | 禁止トピックの定義 | 競合他社情報、投資助言 |
| PII 検出 | 個人情報の検出・マスキング | 氏名、電話番号、メールアドレス |
| Word フィルタ | 禁止語句のブロック | 社内コードネーム、未公開情報 |

### Guardrails サンプルポリシー

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### データ分類別の制御

| データ分類 | 検索 | 要約 | 引用 | Agent 利用 |
|-----------|------|------|------|-----------|
| 公開 | ✅ 許可 | ✅ 許可 | ✅ 許可 | ✅ 許可 |
| 社外秘 | ✅ 許可 | ✅ 許可 | ⚠️ 要約のみ | ✅ 許可 |
| 機密 | ✅ 許可（権限者のみ） | ⚠️ 制限付き | ❌ 原文引用禁止 | ⚠️ 承認付き |
| 極秘 | ⚠️ 承認付き | ❌ 禁止 | ❌ 禁止 | ❌ 禁止 |

### Agent モードの Human Approval

Agent が外部アクションを実行する前に人間の承認を求める設計:

```
Agent が「メール送信」ツールを呼び出そうとする
  → AgentCore Policy で「外部通信」カテゴリを検出
  → Human Approval リクエストを生成
  → ユーザーに承認/拒否を求める UI 表示
  → 承認後にのみアクション実行
```

---

## 業種別ユースケースと規制対応

### 医療機関

| 要件 | 実装方式 |
|------|---------|
| 患者情報の分離 | 診療科別 SID グループ + PII マスキング |
| 手順書の部門別検索 | 部門 SID でフィルタリング |
| 監査証跡 | 全検索ログの 5 年保存 |
| 同意管理 | 患者同意フラグをメタデータに含める |
| 医療診断の禁止 | Guardrails トピックポリシーで DENY |

**規制対応**: 医療情報システムの安全管理に関するガイドライン（厚生労働省）

### 自治体・公共機関

| 要件 | 実装方式 |
|------|---------|
| 部局別文書分離 | 部局 SID グループ |
| 政策資料と非公開資料の分離 | `access_level` メタデータ + SID |
| 情報公開請求対応 | 検索ログの保全・提出機能 |
| 個人情報保護 | PII 検出 + マスキング |
| 行政文書管理 | 文書分類メタデータの付与 |

**規制対応**: 個人情報保護法、行政機関個人情報保護法、ISMAP

### 金融機関

| 要件 | 実装方式 |
|------|---------|
| 顧客情報の厳格な分離 | 顧客 ID ベースのアクセス制御 |
| 投資助言の禁止 | Guardrails トピックポリシー |
| 取引記録の保全 | 監査ログの 10 年保存 |
| 内部統制 | 操作ログの定期レビュー |
| 暗号化要件 | KMS CMK + TLS 1.2 |

**規制対応**: FISC 安全対策基準、金融商品取引法

### 教育機関

| 要件 | 実装方式 |
|------|---------|
| 教職員/学生の権限分離 | ロールベース SID グループ |
| 研究室別資料の分離 | 研究室 SID グループ |
| 学生の個人情報保護 | PII マスキング |
| 研究データの機密保持 | 研究プロジェクト別アクセス制御 |

---

## 監査レポート生成

### 定期レポート項目

| レポート | 頻度 | 内容 |
|---------|------|------|
| アクセスサマリー | 日次 | ユーザー別検索回数、拒否回数 |
| 権限違反レポート | 日次 | Fail-Closed 発動、異常アクセスパターン |
| Guardrails 介入レポート | 週次 | フィルタリング発動回数、トピック別統計 |
| コスト・利用量レポート | 月次 | トークン消費、API 呼び出し数、ストレージ使用量 |
| コンプライアンスレポート | 四半期 | 規制要件への適合状況、改善事項 |

### Athena クエリ例

```sql
-- 過去7日間の権限拒否イベント
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- ユーザー別の検索パターン分析
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## 個人情報・機微情報の取り扱い

### マスキング/分類フロー

```
ドキュメント投入
  → PII スキャン（Comprehend / Guardrails）
  → 分類ラベル付与（機密レベル + PII 有無）
  → .metadata.json に分類情報を記録
  → KB 同期
  
検索時
  → SID フィルタリング（アクセス権限）
  → Guardrails PII 検出（出力時マスキング）
  → 回答生成（マスキング済み）
```

### 承認フロー（機密データアクセス）

極秘データへのアクセスが必要な場合の承認フロー:

1. ユーザーが検索リクエスト送信
2. SID マッチングで「承認付き」カテゴリに該当
3. 承認リクエストを管理者に通知（SNS / Slack）
4. 管理者が承認 → 一時的なアクセストークン発行
5. トークン有効期間内のみアクセス可能
6. アクセスログを監査テーブルに記録

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 本番化チェックリスト |
| [permission-consistency.md](permission-consistency.md) | 権限変更時の整合性モデル |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID フィルタリング設計 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全な実験ガイド |
