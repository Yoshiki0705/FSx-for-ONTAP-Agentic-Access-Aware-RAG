---
title: "Bedrock Prompt Caching: Converse API では動かない — Messages API で解決した話"
published: false
description: "Bedrock Prompt Caching は Messages API (InvokeModel) でのみ動作し Converse API は cacheControl を無視する。Claude + Permission-Aware RAG でのハイブリッド実装と 33% コスト削減の実測結果。"
tags: aws, bedrock, generativeai, コスト最適化
series: "Permission-Aware RAG with FSx for ONTAP"
cover_image:
---

## TL;DR

- Bedrock の Prompt Caching は **Messages API (InvokeModel) でのみ動作**する
- Converse API は `cacheControl` フィールドを**無視する**（エラーも出ない）
- System prompt ≥ 1024 tokens が最小要件（Claude tokenizer 基準）
- Permission-Aware RAG で Claude + Messages API のハイブリッド方式を実装して解決

---

## 背景

Amazon FSx for NetApp ONTAP に保存された企業文書に対して、ユーザーのファイル権限（NTFS ACL / SID）を守りながら AI が回答する「Permission-Aware RAG」を構築しています。

コスト最適化のため Bedrock Prompt Caching（ephemeral, 5 分 TTL）を導入しようとしました。

## 期待した動作

```
1回目: System Prompt (1161 tokens) → cache write → 通常料金
2回目: System Prompt → cache read → 1/10 の料金
```

## 試したこと（Converse API）

```typescript
const input: ConverseCommandInput = {
  modelId: 'jp.anthropic.claude-sonnet-4-6',
  messages,
  system: [{
    text: systemPrompt,
    cacheControl: { type: 'ephemeral' },  // ← 設定した
  }],
};
const resp = await client.send(new ConverseCommand(input));
```

**結果**: `cacheReadInputTokenCount = 0`, `cacheWriteInputTokenCount = 0`。何も起きない。エラーも出ない。

---

## 検証結果

| テスト | API | cache_creation | cache_read |
|--------|-----|---------------|------------|
| Converse API + cacheControl | ConverseCommand | 0 | 0 |
| Messages API + cache_control | InvokeModelCommand | **1161** | **1161** |

Messages API (InvokeModel) に切り替えた瞬間にキャッシュが動作しました。

---

## 解決策: ハイブリッド方式

```typescript
export async function callConverse(...) {
  if (isClaudeModel(mid) && systemPrompt && PROMPT_CACHING_ENABLED) {
    // Messages API: cache_control が正しく処理される
    try {
      const { text, usage } = await callMessagesAPI(client, mid, prompt, history, systemPrompt);
      emitMessagesAPIMetrics(usage, mid);
      return { text, usedModel: mid };
    } catch {
      // Fallback to Converse API
    }
  }
  // Converse API: Non-Claude or fallback
}
```

- Claude モデル → Messages API（Prompt Caching 有効）
- Non-Claude モデル → Converse API（従来通り）

---

## Messages API での呼び出し

```typescript
const body = {
  anthropic_version: 'bedrock-2023-05-31',
  system: [{
    type: 'text',
    text: systemPrompt,
    cache_control: { type: 'ephemeral' }  // ← これが効く
  }],
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 2000,
};

const resp = await client.send(new InvokeModelCommand({
  modelId: 'jp.anthropic.claude-sonnet-4-6',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify(body),
}));
```

---

## 最小トークン要件

| System Prompt サイズ | tokens (実測) | Prompt Caching |
|---------------------|--------------|---------------|
| 3,836 chars | 824 tokens | ❌ cache_creation = 0 |
| 5,579 chars | 1,161 tokens | ✅ cache_creation = 1161 |

最小要件は **1024 tokens**。Claude BPE tokenizer では英語 ~4.5 文字 = 1 token。

---

## Permission-Aware RAG での効果

```
Call 1: cache_creation_input_tokens = 1161  📝 WRITE
Call 2: cache_read_input_tokens = 1161      🎯 HIT (33% of input cached)
```

同一ユーザーの連続クエリ（5 分以内）で、system prompt 部分（Permission rules, Security context, Industry guidance）のコストが **1/10** に削減。

---

## ap-northeast-1 での追加知見

| 知見 | 対策 |
|------|------|
| Claude Sonnet 4.6 は on-demand 不可 | Inference Profile (`jp.anthropic.claude-sonnet-4-6`) を使用 |
| Bedrock Agent は inference profile 不可 | `anthropic.claude-3-haiku-20240307-v1:0` を使用 |
| Agent Alias 更新に `create_agent_version` 必要だが boto3 未対応 | `update_agent_alias(routingConfiguration=[])` で自動バージョン作成 |

---

## まとめ

1. **Converse API は Anthropic モデルの Prompt Caching 非対応**（2026 年 6 月時点。Bedrock の Converse API は `cacheControl` フィールドを受け付けるが、Anthropic モデルでは実際にはキャッシュが動作しない。将来対応される可能性はあるため、定期的に公式ドキュメントを確認推奨）
2. **Messages API (InvokeModel) を使えば正常動作**
3. **System prompt ≥ 1024 tokens** が必要
4. ハイブリッド方式（Claude → Messages, Others → Converse）が現実的な解決策

実装の詳細: [GitHub リポジトリ](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG)（`docker/nextjs/src/lib/rag-pipeline/converse-client.ts`）

---

*Yoshiki Fujiwara — AWS Community Builder*
