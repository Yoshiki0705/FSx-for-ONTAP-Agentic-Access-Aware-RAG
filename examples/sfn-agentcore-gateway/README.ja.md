# Step Functions をエージェントツールにする — Strands サンプル

**🌐 Language:** [English](README.md) | **日本語**

`DemoSfnToolsGatewayStack` が Amazon Bedrock AgentCore Gateway（MCP）経由で公開する
Step Functions ツールを呼び出す、スタンドアロンの [Strands Agents](https://strandsagents.com/)
サンプルです。

これはデプロイされる Web アプリの一部ではなく、参照実装です。エージェントがワークフロー
ツールを発見して呼び出す流れと、固定したステートマシン・Cedar の書き込みガードの挙動を示します。

## 示すこと

- Gateway の MCP エンドポイントへ IAM（SigV4）認証で接続する。
- Gateway のツールを Step Functions ターゲットだけに絞り込む。
- 「いつワークフローを動かすか」「何を入力するか」はエージェントが判断し、「どの手順を
  どの順で実行するか」はステートマシンが強制する、という役割分担。
- 既定スコープは**読み取り専用**（状況照会）。書き込み（`StartExecution` / `StopExecution`）は
  スタック側で opt-in し、Cedar で限定する。

## 前提

1. Step Functions ツール Gateway をデプロイする（下は読み取り専用の例）:

   ```bash
   npx cdk deploy perm-rag-demo-demo-SfnToolsGateway --require-approval never \
     -c enableSfnTools=true \
     -c sfnFailoverArn=arn:aws:states:<region>:<account>:stateMachine:<your-standard-workflow>
   ```

   デプロイ出力に `SfnGatewayUrl` が出る。環境変数に入れる:

   ```bash
   export GATEWAY_URL=<デプロイ出力の SfnGatewayUrl>
   export AWS_REGION=<Gateway のリージョン>
   ```

2. このサンプルを実行する IAM プリンシパルに、Gateway への `bedrock-agentcore:InvokeGateway`
   を許可しておく（管理者ロールなら既にある）。

3. Python 3.12 以上と [`uv`](https://docs.astral.sh/uv/)。依存は `pyproject.toml` に pin 済み。

   > **依存の注意** `mcp-proxy-for-aws` は `1.7.0` に pin している。Python 3.15 + 最新の
   > `mcp` では、プロキシの import が失敗する（`McpError` が `MCPError` に改名された）。
   > `mcp-proxy-for-aws==1.7.0` を pin すると互換の `mcp` が解決される。
   > **[verified 2026-10-31 / local]** macOS arm64, Python 3.15 で再現。

## 実行

Gateway が公開するツールを一覧する（読み取り確認、実行は開始しない）:

```bash
uv run list_tools.py
```

直近の実行状況をエージェントに尋ねる（読み取り）:

```bash
uv run store_agent.py "直近の実行状況を確認して"
```

## ファイル

| ファイル | 内容 |
|---------|------|
| `gateway_tools.py` | Gateway の MCP クライアント、ツールの絞り込み、非 ASCII エスケープフック |
| `list_tools.py` | Gateway の `tools/list` を 1 回実行 |
| `store_agent.py` | Step Functions ツールに接続した Strands エージェント |
| `pyproject.toml` | pin した依存 |

## 範囲と未検証の点

- **[verified 2026-10-31 / ap-northeast-1]** `tools/list` が読み取り系4ツールを返し、
  固定した STANDARD ステートマシンに対する `DescribeStateMachine` 呼び出しが成功した。
  固定した `stateMachineArn` はツールスキーマに現れないため、エージェントは変更できない。
- **[hypothesis]** 実際の SnapMirror 入力での `StartExecution` / `StopExecution` の挙動と、
  Cedar `ENFORCE` の拒否経路は、このサンプルでは**未検証**。書き込みを有効化すると実際の
  ワークフローが走り、副作用が生じる。
- **[field-observation]** 別の報告で、Gateway に渡した日本語入力が文字化けしうると観測された
  が、ここでは**再現未確認**。読み取り系ツールは自由入力の日本語を取らないため。
  `gateway_tools.py` のエスケープフックは、書き込みを使うときの緩和策として残している。

全体計画と検証記録は `.private/design/stepfunctions-agentcore-gateway-integration.ja.md`
（ローカル専用、リポジトリには含まれない）にある。
