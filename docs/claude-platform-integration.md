# Claude Platform on AWS 連携ガイド

**🌐 Language:** **日本語** | [English](en/claude-platform-integration.md)

**作成日**: 2026-06-08  
**ステータス**: 実装完了・未有効化  
**対象**: 開発者、運用担当者

---

## 概要

Claude Platform on AWS は、Anthropic が AWS 上で提供するネイティブプラットフォーム。Web Search、Citations、MCP Connector、Managed Agents 等の機能を提供する。

本システムでは、**KB 検索結果が不十分な場合に Claude Platform の Web Search をフォールバックとして使用**し、公開 Web 情報で参考回答を生成する。

---

## アーキテクチャ

```
User Query
  │
  ▼
KB Retrieve API (Permission-Aware RAG)
  │
  ├── 結果あり (score ≥ threshold) ──→ Bedrock Messages/Converse API → 回答
  │
  └── 結果なし or 不十分 ──→ Invocation Router 判定
       │
       ├── CLAUDE_PLATFORM_MODE=disabled → 「情報なし」回答
       │
       └── CLAUDE_PLATFORM_MODE=web-search-only/full
            │
            ▼
       Web Search Sanitizer (PII除去)
            │
            ▼
       Claude Platform Messages API (Web Search tool)
            │
            ▼
       回答 + Citations (boundary: 'reference')
```

### Permission Boundary の分離

| ソース | boundary | UI 表示 | 意味 |
|--------|----------|---------|------|
| KB 検索結果 | `verified` | 🔒 | Permission 検証済み内部文書 |
| Web Search 結果 | `reference` | 🌐 | 公開 Web 情報（権限検証なし） |

---

## 実装ファイル

| ファイル | 役割 |
|---------|------|
| `lib/claude-platform/client.ts` | Claude Platform API クライアント（Web Search、API Key 管理） |
| `lib/claude-platform/invocation-router.ts` | Bedrock / Claude Platform パス振り分けロジック |
| `lib/claude-platform/index.ts` | 公開 API エクスポート |
| `lib/web-search/sanitizer.ts` | Web Search クエリの PII 除去・サニタイズ |
| `app/api/bedrock/kb/retrieve/route.ts` | KB retrieve ルート内のフォールバック統合 |

---

## 設定方法

### 環境変数

| 変数 | 値 | 説明 |
|------|-----|------|
| `CLAUDE_PLATFORM_MODE` | `disabled` (デフォルト) / `web-search-only` / `full` | 機能の有効範囲 |
| `CLAUDE_PLATFORM_API_KEY` | Secrets Manager ARN or 直接キー | Claude Platform API キー |
| `CLAUDE_PLATFORM_REGION` | `ap-northeast-1` (デフォルト) | Claude Platform リージョン |
| `ENABLE_WEB_SEARCH` | `true` / `false` | Web Search フォールバック有効化 |
| `WEB_SEARCH_FALLBACK_THRESHOLD` | `0.5` (デフォルト) | KB score がこの値未満で Web Search に切り替え |

### 有効化手順

```bash
# Step 1: Claude Platform API Key を取得
# Anthropic Console (console.anthropic.com) で AWS 連携キーを発行

# Step 2: Secrets Manager に登録
aws secretsmanager create-secret \
  --name "claude-platform-api-key" \
  --secret-string "<YOUR_API_KEY>" \
  --region ap-northeast-1

# Step 3: Lambda 環境変数を設定（CDK context 推奨）
# cdk.context.json:
#   "claudePlatformMode": "web-search-only",
#   "claudePlatformApiKeyArn": "arn:aws:secretsmanager:ap-northeast-1:...:secret:claude-platform-api-key"

# Step 4: デプロイ
npx cdk deploy <prefix>-WebApp
```

### 手動設定（CDK 外）

```bash
# Lambda 環境変数を直接更新
python3 -c "
import boto3, json
lam = boto3.client('lambda', region_name='ap-northeast-1')
config = lam.get_function_configuration(FunctionName='<function-name>')
env = config['Environment']['Variables']
env['CLAUDE_PLATFORM_MODE'] = 'web-search-only'
env['CLAUDE_PLATFORM_API_KEY'] = 'arn:aws:secretsmanager:ap-northeast-1:178625946981:secret:claude-platform-api-key'
env['ENABLE_WEB_SEARCH'] = 'true'
lam.update_function_configuration(FunctionName='<function-name>', Environment={'Variables': env})
"
```

---

## 動作モード

### `disabled`（デフォルト）

- Claude Platform は使用しない
- KB に情報がない場合は「利用可能なドキュメントに含まれていません」を返す
- API Key 不要、追加コストなし

### `web-search-only`

- KB 結果が不十分な場合のみ Web Search をフォールバックとして使用
- Web 結果は `boundary: 'reference'` として明示（内部文書と区別）
- 追加コスト: Claude Platform API 利用料（下記参照）

### コスト見積もり

Claude Platform on AWS の料金は Anthropic API と同一（[aws.amazon.com/claude-platform](https://aws.amazon.com/claude-platform/)参照）。AWS Marketplace 経由で課金され、EDP/PPA コミットメントから引き落とし可能。

| モデル | Input (per 1M tokens) | Output (per 1M tokens) |
|--------|----------------------|----------------------|
| Claude Haiku 4.5 | $1.00 | $5.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| Claude Opus 4.7/4.8 | $5.00 | $25.00 |

> ⚠️ 上記は2026年5月時点の公開情報に基づく参考値です。最新料金は [Anthropic Pricing](https://www.anthropic.com/pricing) および [AWS Claude Platform](https://aws.amazon.com/claude-platform/) を参照してください。

**Web Search fallback の追加コスト**:
- Web Search tool 自体に追加料金なし（通常のトークン課金のみ）
- 1回の Web Search で +2,000-5,000 input tokens（取得した Web コンテンツ分）
- Sonnet 4.6 使用時: 約 $0.02/回

**月間想定（100 queries/日、10% が Web Search fallback）**:
```
10 queries/日 × 30日 × $0.02 = ~$6/月
```

### `full`（将来拡張）

- Web Search + MCP Connector + Extended Citations
- 現時点では `web-search-only` と同等動作

---

## セキュリティ設計

### PII サニタイズ

Web Search クエリに送信する前に、`sanitizeWebSearchQuery()` で以下を除去:

- メールアドレス
- 電話番号
- 個人名（検出可能な場合）
- 社内固有の識別子

### API Key 管理

- API Key は **Secrets Manager に格納**（環境変数に直接記載も可だが非推奨）
- 5分間の TTL キャッシュ（Secrets Manager rotation 対応）
- ログに API Key を出力しない設計

### タイムアウト

- Claude Platform API 呼び出しは **10秒タイムアウト**
- タイムアウト時は「情報なし」回答にフォールバック（Bedrock 側は影響なし）

---

## CloudWatch メトリクス

| Namespace | メトリクス | ディメンション | 意味 |
|-----------|----------|---------------|------|
| `RAG/InvocationRouting` | `RoutingDecisions` | `InvocationPath` (bedrock/claude-platform) | ルーティング判断回数 |
| `RAG/ClaudePlatform` | `Errors` | `ErrorType` (timeout/network/api_error) | Claude Platform エラー回数 |

---

## テスト

```bash
# ユニットテスト（fetch mock）
cd docker/nextjs && npx vitest run src/__tests__/claude-platform/

# 結合テスト（API Key 必要）
# KB に存在しない質問を送信して Web Search fallback を確認
curl -X POST https://<cloudfront-url>/api/bedrock/kb/retrieve \
  -H "Authorization: Bearer <token>" \
  -d '{"query":"今日の東京の天気は？","userId":"test@example.com","useWebSearch":true}'
```

---

## 関連ドキュメント

- [2026 Q2 AI Update Roadmap](design/2026q2-ai-update-roadmap.md) — Phase 3: Claude Platform
- [Prompt Caching Investigation](prompt-caching-investigation.md) — Messages API 知見
- [Operations Runbook](operations-runbook.md) — 運用手順
- [Cost Estimation Worksheet](cost-estimation-worksheet.md) — コスト見積もり
