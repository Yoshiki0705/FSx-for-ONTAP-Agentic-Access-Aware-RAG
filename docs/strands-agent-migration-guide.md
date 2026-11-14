# Strands Agents と AgentCore Runtime への移行

**🌐 Language:** **日本語** | [English](en/strands-agent-migration-guide.md)

Agent モードのエージェントは、Amazon Bedrock Agents（`CfnAgent` + Action Group）から、Amazon Bedrock AgentCore Runtime 上の Strands Agents（Python）に移りました。この文書は、移行で何が変わり、何が変わっていないか、旧バックエンドをいつまで使えるかをまとめたものです。仕組みの全体は [実装概要の項目 8](implementation-overview.md#8-agent-モード--amazon-bedrock-agentcore-上の-permission-aware-agentic-ai) にあります。

## 変更点の一覧

| 観点 | 以前（Amazon Bedrock Agents） | 現在（AgentCore Runtime + Strands Agents） |
|------|------------------------------|------------------------------------------|
| エージェントの定義 | `CfnAgent` と、画面から作るたびに `CreateAgent` + `PrepareAgent` + エイリアス | DynamoDB `${prefix}-agent-definitions` の 1 項目。作成は書き込み 1 回で、状態は常に `PREPARED` |
| 実行 | `InvokeAgent`（エージェント ID + エイリアス ID） | `InvokeAgentRuntime`。1 つの汎用 Runtime に定義・メッセージ・`userId` を渡す |
| エージェントのコード | なし（マネージド） | `docker/agentcore-agent/`（Python 3.12、Strands Agents、arm64）。CDK がイメージをビルドしてデプロイする |
| 検索ツール | Action Group Lambda | AgentCore Gateway（AWS_IAM、MCP）の Lambda ターゲット `permission-search` |
| 権限フィルタ | Action Group Lambda 内の SID 照合 | `docker/nextjs/src/lib/rag-pipeline/sid-filter.ts` を Lambda に同梱。KB モードと同じ 1 つの実装 |
| モデル変更 | Agent の更新と再 Prepare、エイリアスの付け替え | 定義の `foundationModel` を書き換えるだけ。次の実行から反映 |
| マルチエージェント | Supervisor + Collaborator（エイリアスごとの関連付け） | Strands の agents-as-tools。監督役が各協調エージェントをツールとして呼ぶ |
| 画面と API | Agent Directory と `/api/bedrock/*` | 変更なし。API は以前と同じ形の応答を返す |

## 変えなかったこと

- **権限の境界。** モデルが見る検索ツールの引数は `query` と `max_results` だけです。`userId` は WebApp がセッション Cookie（`session-token`）から取り、Runtime のコードが Gateway 呼び出しに付けます。リクエスト本文の `userId` がセッションと違えば 403、セッションが無ければ 401 です。`userId` の無い呼び出しと、SID の記録が無いユーザーには文書を返しません（Fail-Closed）
- **画面。** Agent Directory、エージェントの作成・編集・削除、チームの作成と実行、カードからの動的作成は、同じ画面のまま動きます
- **AgentCore Memory。** `enableAgentCoreMemory` は `enableAgent` から独立したフラグになりましたが、作られるリソースは同じです

## 設計で選んだこと

| 選択 | 採らなかった案と理由 |
|------|------------------|
| 汎用 Runtime 1 つ + 定義は DynamoDB | エージェントごとの Runtime: 作成に数分かかり、消し忘れた Runtime の分だけ課金が残る |
| 検索は TypeScript の `sid-filter.ts` を Gateway の Lambda で実行 | Python への移植: 権限の境界の実装が 2 つになり、片方だけ直される |
| Gateway は Agent 専用に 1 つ追加（AWS_IAM） | `enableAgentCoreGateway` の Gateway の共用: そちらは interceptor と Policy Engine を持ち、別のフラグで消える |

## 旧バックエンドの扱い

`-c agentBackend=bedrock-agents` を付けると、以前の `CfnAgent` + Action Group が作られ、API も以前の経路を通ります。この値は 1 リリースだけ残し、次のリリースで削除します。CI の synth には旧バックエンドのレーン（`agent-bedrock-agents-legacy`）があり、削除と同時に外します。

旧バックエンドで作ったエージェントは、新しいバックエンドに自動では移りません。Agent Directory で作り直してください（DynamoDB への書き込み 1 回で、数秒で終わります）。

## 以前の TypeScript PoC

2026-05 に `docker/nextjs/src/lib/strands-agent/` に置いた TypeScript 版の PoC は、どこからも呼ばれず、SDK も依存関係に入っていなかったため、この移行で削除しました。実装は Python 版（`docker/agentcore-agent/`）に一本化しています。

## 次の段階

この移行では、エージェントの作成・実行・マルチエージェント・モデル変更・Memory を AgentCore に移しました。次の 3 つは次の変更で移します。

1. 実行トレースの表示を AgentCore Observability に切り替える
2. スケジュール実行を、Runtime を呼ぶ EventBridge Scheduler に切り替える
3. Agent Registry のインポート・パブリッシュを、DynamoDB の定義に対して行う

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [実装概要の項目 8](implementation-overview.md#8-agent-モード--amazon-bedrock-agentcore-上の-permission-aware-agentic-ai) | アーキテクチャ、CDK リソース、権限の境界 |
| [Agent Mode 開発ガイド](agent-mode-development-guide.md) | 画面側の実装 |
| [Strands Agents の AgentCore Runtime へのデプロイ](https://strandsagents.com/latest/documentation/docs/user-guide/deploy/deploy_to_bedrock_agentcore/) | Strands Agents の公式手順 |
| [Amazon Bedrock AgentCore 開発者ガイド](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html) | Runtime と Gateway |
