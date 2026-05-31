# Strands Agents SDK 移行ガイド

**作成日**: 2026-05-31
**ステータス**: PoC 実装完了、評価中
**参考**: [Strands Agents TypeScript SDK](https://github.com/strands-agents/sdk-typescript)

---

## 概要

本プロジェクトの Agent モードを、現在の Bedrock Agent (InvokeAgent API) から Strands Agents SDK ベースに移行するための評価・設計ドキュメント。

---

## 現行アーキテクチャ vs Strands アーキテクチャ

| 観点 | 現行 (Bedrock Agent) | Strands Agents SDK |
|------|---------------------|-------------------|
| Agent 定義 | AWS コンソール / CDK (CfnAgent) | TypeScript コード |
| ツール統合 | Action Group Lambda | `tool()` 関数（TypeScript） |
| テスタビリティ | デプロイ後のみ | ローカル実行可能 |
| モデル切替 | Agent 再作成が必要 | `BedrockModel({ modelId })` で即時切替 |
| ストリーミング | InvokeAgent レスポンスストリーム | Async Iterator |
| 会話管理 | Agent 内部管理 | `SlidingWindowConversationManager` |
| デプロイ先 | Bedrock Agent (マネージド) | AgentCore Runtime / Lambda / Docker |
| コスト | Agent 待機コスト $0 + トークン | 同じ（トークンのみ） |
| 権限フィルタリング | Action Group 内で実装 | `permission_aware_search` tool 内で実装 |

---

## 実装済み PoC

### ファイル構成

```
docker/nextjs/src/lib/strands-agent/
├── index.ts                         — Public API
├── create-rag-agent.ts              — Agent ファクトリ（MOCA パターン）
└── permission-aware-search-tool.ts  — SID フィルタリング付き KB 検索ツール
```

### Permission-Aware Search Tool

```typescript
import { tool } from '@strands-agents/sdk';
import z from 'zod';
import { filterByPermissions } from '@/lib/rag-pipeline';

export const permissionAwareSearch = tool({
  name: 'permission_aware_search',
  description: 'Search the knowledge base with automatic permission filtering',
  inputSchema: z.object({
    query: z.string(),
    userId: z.string(),
    maxResults: z.number().optional().default(10),
  }),
  callback: async (input) => {
    // 1. KB Retrieve
    // 2. SID Permission Filter (reuses rag-pipeline/sid-filter)
    // 3. Format results for Agent
  },
});
```

### Agent 作成

```typescript
import { createRagAgent } from '@/lib/strands-agent';

const agent = createRagAgent({
  userId: 'admin@example.com',
  modelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
});

const result = await agent.invoke('Q4の売上について教えてください');
console.log(result.lastMessage);
```

---

## 移行メリット

1. **ローカルテスト可能**: `npx tsx` で Agent をローカル実行。デプロイ不要で開発サイクルが高速化
2. **型安全なツール定義**: Zod スキーマによる入力バリデーション。Action Group の OpenAPI スキーマより簡潔
3. **rag-pipeline モジュール再利用**: `filterByPermissions()` をそのまま使用。SID フィルタリングロジックの重複なし
4. **Smart Routing 統合**: Agent 内部でモデルを動的に切り替え可能（Haiku → Sonnet → Opus）
5. **AgentCore Runtime デプロイ**: 本番環境では AgentCore Runtime にデプロイし、スケーラビリティを確保

---

## 移行ステップ（推奨）

### Phase A: 並行運用（現在）
- 既存の Bedrock Agent (InvokeAgent API) はそのまま維持
- Strands Agent を新しい API ルート (`/api/strands-agent/invoke`) で公開
- UI に「Strands Agent (Beta)」オプションを追加

### Phase B: 機能パリティ確認
- Permission-aware Search の動作検証（SID フィルタリング）
- Multi-turn 会話の動作検証（SlidingWindowConversationManager）
- ストリーミングレスポンスの UI 統合

### Phase C: 切替
- デフォルト Agent を Strands に切替
- Bedrock Agent を deprecated として残す（フォールバック用）
- AgentCore Runtime へのデプロイ自動化

---

## 前提条件

```bash
# Strands Agents SDK インストール
cd docker/nextjs
npm install @strands-agents/sdk zod
```

---

## 制約・注意事項

- Strands TypeScript SDK は 2026年6月時点で v1.0（GA）
- AgentCore Runtime デプロイは CloudFormation 未サポート（CLI/SDK のみ）
- `SlidingWindowConversationManager` はメモリ内管理。永続化には AgentCore Memory との統合が必要
- ブラウザ実行もサポートされているが、本プロジェクトでは Lambda (Node.js) 実行を想定

---

## ストリーミングレスポンス統合設計

Strands SDK は Async Iterator でストリーミングをサポート。UI 統合の設計:

```typescript
// API Route (Next.js) — SSE 変換
export async function POST(request: NextRequest) {
  const agent = createRagAgent({ userId, modelId });

  // Strands Async Iterator → ReadableStream (SSE)
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const event of agent.stream(query)) {
        if (event.type === 'text') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.data })}\n\n`));
        } else if (event.type === 'tool_use') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool: event.name, status: 'running' })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

UI 側は既存の `useChat` フックを拡張し、SSE イベントを処理:
- `text` イベント → チャットバブルにインクリメンタル表示
- `tool_use` イベント → 「🔍 検索中...」インジケーター表示
- `[DONE]` → ストリーム完了、Citation 表示

---

## 関連ドキュメント

### マルチテナント環境での Strands Agent 分離

| パターン | 分離レベル | コスト | 適用シナリオ |
|---------|-----------|--------|------------|
| **Shared Agent + userId 分離** | 論理分離（SID フィルタリング） | 低 | 単一組織内の部門分離 |
| **Per-tenant Agent インスタンス** | Agent インスタンス分離 | 中 | マルチテナント SaaS |
| **Per-tenant AgentCore Runtime** | ランタイム分離 | 高 | 規制要件（医療、金融） |

推奨: 本プロジェクトの SID フィルタリングは「Shared Agent + userId 分離」パターンで設計されている。`permission_aware_search` ツールが userId に基づいてドキュメントアクセスを制御するため、Agent インスタンスを分離する必要はない。ただし、テナント間でモデル選択やプロンプトを変えたい場合は Per-tenant Agent インスタンスを検討する。

---

| ドキュメント | 内容 |
|-------------|------|
| [Strands Agents TypeScript Quickstart](https://strandsagents.com/docs/user-guide/quickstart/typescript/) | SDK 入門 |
| [AgentCore Runtime デプロイ](https://strandsagents.com/docs/user-guide/deploy/deploy_to_bedrock_agentcore/typescript/) | 本番デプロイ手順 |
| [next-phase-event-driven-agents.md](next-phase-event-driven-agents.md) | Event-Driven Agent Trigger 設計 |
| [implementation-overview.md](implementation-overview.md) | 項目 8: Bedrock Agent 実装 |
