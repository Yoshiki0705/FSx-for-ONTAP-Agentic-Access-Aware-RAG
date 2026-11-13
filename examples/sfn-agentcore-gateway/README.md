# Step Functions as Agent Tools — Strands sample

**🌐 Language:** **English** | [日本語](README.ja.md)

A standalone [Strands Agents](https://strandsagents.com/) sample that calls the
Step Functions tools exposed by the `DemoSfnToolsGatewayStack` through Amazon
Bedrock AgentCore Gateway (MCP).

This is a reference implementation, not part of the deployed web app. It shows
how an agent discovers and calls the workflow tools, and how the pinned state
machine and the Cedar write-op guard behave.

## What it demonstrates

- Connecting to the Gateway MCP endpoint with IAM (SigV4) auth.
- Filtering the Gateway's tools down to the Step Functions targets.
- Letting the agent decide **when** to run a workflow and **what** input to pass,
  while the state machine enforces **which steps run and in what order**.
- The default scope is **read-only** (status queries). Write ops
  (`StartExecution` / `StopExecution`) are opt-in on the stack and gated by Cedar.

## Prerequisites

1. Deploy the Step Functions tools Gateway (read-only shown here):

   ```bash
   npx cdk deploy perm-rag-demo-demo-SfnToolsGateway --require-approval never \
     -c enableSfnTools=true \
     -c sfnFailoverArn=arn:aws:states:<region>:<account>:stateMachine:<your-standard-workflow>
   ```

   The deploy output prints `SfnGatewayUrl`. Export it:

   ```bash
   export GATEWAY_URL=<SfnGatewayUrl from the deploy output>
   export AWS_REGION=<the Gateway's region>
   ```

2. The IAM principal that runs this sample needs `bedrock-agentcore:InvokeGateway`
   on the Gateway (an admin role already has it).

3. Python 3.12+ and [`uv`](https://docs.astral.sh/uv/). Dependencies are pinned in
   `pyproject.toml`.

   > **Dependency note** `mcp-proxy-for-aws` is pinned to `1.7.0`. With the latest
   > `mcp` on Python 3.15 the proxy fails to import (`McpError` was renamed to
   > `MCPError`). Pinning `mcp-proxy-for-aws==1.7.0` resolves a compatible `mcp`.
   > **[verified 2026-10-31 / local]** reproduced on macOS arm64, Python 3.15.

## Run

List the tools the Gateway exposes (read-only check, no execution started):

```bash
uv run list_tools.py
```

Ask the agent to report on recent executions (read-only):

```bash
uv run store_agent.py "直近の実行状況を確認して"
```

## Files

| File | Purpose |
|------|---------|
| `gateway_tools.py` | Gateway MCP client, tool filtering, and the non-ASCII escape hook |
| `list_tools.py` | One-shot `tools/list` of the Gateway |
| `store_agent.py` | A Strands agent wired to the Step Functions tools |
| `pyproject.toml` | Pinned dependencies |

## Scope and what is not verified here

- **[verified 2026-10-31 / ap-northeast-1]** `tools/list` returns the four
  read-only tools and a `DescribeStateMachine` call succeeds against a pinned
  Standard state machine. The pinned `stateMachineArn` is absent from the tool
  schema, so the agent cannot change it.
- **[hypothesis]** `StartExecution` / `StopExecution` behaviour with a real
  SnapMirror input, and the Cedar `ENFORCE` deny path, are **unverified** in
  this sample. Enabling write ops runs a real workflow, which has side effects.
- **[field-observation]** A separate report noted that Japanese passed through the
  Gateway input could arrive mojibake'd; **reproduction not confirmed** here because
  the read-only tools take no free-text Japanese input. The escape hook in
  `gateway_tools.py` is kept as a mitigation for when write ops are used.

See `.private/design/stepfunctions-agentcore-gateway-integration.ja.md` (local,
not shipped) for the full plan and verification record.
