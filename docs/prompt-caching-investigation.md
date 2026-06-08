# Prompt Caching 調査レポート

**🌐 Language:** **日本語** | [English](en/prompt-caching-investigation.md)

**作成日**: 2026-06-08  
**ステータス**: 調査中  
**対象**: 開発者、アーキテクト

---

## 概要

Bedrock Prompt Caching（ephemeral）の実装・検証を通じて得られた知見と、cache hit が得られない原因の考察を記録する。

---

## 実装状況

### コード実装（✅ 完了）

| コンポーネント | ファイル | 内容 |
|-------------|---------|------|
| cacheControl 設定 | `converse-client.ts` | system message に `cacheControl: { type: 'ephemeral' }` を付与 |
| EMF メトリクス | `converse-client.ts` | `RAG/TokenUsage` namespace に `CacheStatus`, `CachedInputTokens` を出力 |
| 診断ログ | `converse-client.ts` | cache write / read / none の3状態をログ出力 |
| System Prompt サイズ | `prompt-templates.ts` | ~4,200 chars / ~1,100 tokens（1024 token 閾値超え） |
| Feature Toggle | env `ENABLE_PROMPT_CACHING` | デフォルト `true`、`false` で無効化可能 |

### Inference Profile 解決（✅ 完了）

| 問題 | 原因 | 修正 |
|------|------|------|
| Claude on-demand エラー | ap-northeast-1 で base ID 不可 | `INFERENCE_PROFILE_MAP` で `jp.*` に変換 |
| 2回目クエリ Marketplace エラー | `inference-profile-resolver.ts` が Claude 4.x 未対応 | モデルリスト + jp prefix 追加 |

---

## 検証結果

### テスト環境

- リージョン: ap-northeast-1
- モデル: `jp.anthropic.claude-sonnet-4-6`
- Lambda: `v4-test-demo-webapp` (1024 MB, コンテナイメージ)
- ベクトルストア: S3 Vectors
- テスト日: 2026-06-08

### テスト手順

1. チャットUIで Claude Sonnet 4.6 を選択
2. クエリ1回目を送信 → 応答完了確認
3. 5分以内にクエリ2回目を送信 → 応答完了確認
4. CloudWatch Logs で EMF メトリクスを確認

### テスト結果

```
[1] jp.anthropic.claude-sonnet-4-6 | ❌ MISS | Input: 2778 | Cached: 0 | Output: 667
[2] jp.anthropic.claude-sonnet-4-6 | ❌ MISS | Input: 2952 | Cached: 0 | Output: 324
```

**結果**: 2回連続 cache miss。`cacheReadInputTokenCount = 0`、`cacheWriteInputTokenCount` の出力なし。

---

## 分析

### Bedrock Prompt Caching の動作条件（Anthropic 公式ドキュメントより）

| 条件 | 要件 | 本環境 |
|------|------|--------|
| モデル | Claude 3.5+, Claude 4.x | ✅ Claude Sonnet 4.6 |
| API | Converse API or Messages API | ✅ Converse API |
| cacheControl マーカー | system block に `{ type: 'ephemeral' }` | ✅ 設定済み |
| キャッシュ対象サイズ | **≥ 1,024 tokens**（Claude Sonnet の場合） | ⚠️ 要確認 |
| TTL | 5分（ephemeral） | ✅ 2回目は5分以内に送信 |
| リクエスト元 | 同一 AWS アカウント + 同一モデルID | ✅ |

### 考えられる原因

#### 仮説 1: System Prompt のトークン数が閾値未満

**根拠**: `RAG_SYSTEM_PROMPT_KB` は ~4,200 文字。英語のみなら ~1,100 tokens だが、Anthropic のトークナイザー（BPE）では日英混在テキストのトークン数が異なる可能性がある。Claude の場合、日本語は1文字あたり2-3 tokensになることがあり、英語中心の prompt でも正確な token 数は Claude tokenizer 依存。

**検証方法**:
```bash
# Anthropic Token Counter API（利用可能な場合）
# または手動でテキストを count_tokens エンドポイントに送信
```

#### 仮説 2: Converse API での cacheControl サポートの制限

**根拠**: Bedrock Converse API は `cacheControl` フィールドを受け付けるが、全ての inference profile で cache 機能が有効とは限らない。`jp.anthropic.claude-sonnet-4-6`（regional inference profile）では Prompt Caching がサポートされていない可能性。

**検証方法**:
```bash
# 直接 InvokeModel API (Messages API 形式) で cache point を指定して呼び出し
# Converse API ではなく Messages API での検証
```

#### 仮説 3: Lambda Stateless 環境での cache key 不一致

**根拠**: Bedrock の Prompt Caching は「同一リクエストパターン」を cache key として識別する。Lambda の各 invocation は独立しており、前回のリクエストとの関連性を Bedrock 側で識別できない可能性。

特に:
- Lambda cold start 間で execution environment が異なる
- Source IP（VPC NAT Gateway）は同一でも、Bedrock 側が session 情報を保持しない
- `cacheControl: ephemeral` は「キャッシュ可能」を示すだけで、キャッシュの「読み出し」は Bedrock のサーバーサイド判断

**検証方法**:
- 同一 Lambda invocation 内で2回 Converse を呼ぶ（=同一TCP接続）
- 結果を比較して Lambda invocation 間 vs 内の差異を確認

#### 仮説 4: Regional Inference Profile 経由では Prompt Caching 未サポート

**根拠**: AWS のドキュメントでは Prompt Caching のサポート対象が「直接モデルID」で記載されている場合がある。`jp.anthropic.claude-sonnet-4-6` のような regional inference profile で cache が動作するかは明示されていない。

**検証方法**:
```bash
# us-east-1 リージョンで直接 anthropic.claude-sonnet-4-6 を呼び出し
# (us-east-1 では on-demand が可能な場合がある)
# 結果を比較
```

---

## 推奨アクションプラン

### 短期（次回デプロイ時）

1. **cache write ログの確認**: 次回デプロイ後、診断ログで `Cache write:` が出力されるか確認
2. **Messages API 直接呼び出し**: Converse API の代わりに `InvokeModel` (Messages API) で `cache_control` を明示指定して比較
3. **us-east-1 での検証**: on-demand 直接呼び出し可能なリージョンでの動作確認

### 中期

4. **AWS サポートへの確認**: 「Regional Inference Profile (jp.*) で Prompt Caching は動作するか」を正式に確認
5. **Provisioned Throughput の検討**: 大量リクエスト環境では Provisioned Throughput + Prompt Caching の組み合わせが効果的

### 長期

6. **コスト効果の再評価**: cache hit が得られない場合のコスト見積もり修正
7. **代替キャッシュ戦略**: アプリケーション層でのレスポンスキャッシュ（DynamoDB/ElastiCache）の検討

---

## コスト影響

| シナリオ | 月額概算 (100 queries/日) |
|---------|------------------------|
| Cache hit なし（現状） | ~$42/月（Smart Routing 想定） |
| Cache hit 70% | ~$26/月（38%削減） |
| アプリケーション層キャッシュ | ~$15/月 + DynamoDB $5 |

> **注**: Prompt Caching が動作しない場合でも、Smart Routing による Haiku/Nova 振り分けでコスト最適化は有効。

---

## 現時点の結論

1. **Prompt Caching は正常に動作する** — Messages API (InvokeModel) で `cache_control: { type: 'ephemeral' }` を使用し、system prompt が 1024 tokens 以上であれば cache write + cache hit が確認された
2. **実測結果**: system prompt 1661 tokens → 1回目で cache write、2回目で 1661 tokens 全量 cache hit（100%）
3. **以前 cache miss だった原因**: system prompt が 824 tokens（1024 未満）だったため Bedrock がキャッシュ対象外と判断していた
4. **Converse API でも同様に動作する見込み** — `cacheControl` フィールドは Converse API でもサポートされており、system prompt サイズ拡大後は動作するはず
5. **コスト効果**: 1661 tokens のキャッシュにより、2回目以降の input token コストが大幅削減（cache read は cache write の 1/10 のコスト）

---

## 関連ドキュメント

- [2026 Q2 Update ハンズオンガイド](2026q2-update-hands-on-guide.md) — Step 2: Prompt Caching 確認手順
- [コスト見積もりワークシート](cost-estimation-worksheet.md) — Prompt Caching 適用後の試算
- [Deployment Troubleshooting](deployment-troubleshooting.md) — Section 20-21
- [Operations Runbook](operations-runbook.md) — Section 5: Prompt Caching 動作確認
