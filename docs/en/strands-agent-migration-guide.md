# Migration to Strands Agents on AgentCore Runtime

**🌐 Language:** [日本語](../strands-agent-migration-guide.md) | **English**

Agent-mode agents moved from Amazon Bedrock Agents (`CfnAgent` + Action Group) to Strands Agents (Python) on Amazon Bedrock AgentCore Runtime. This document lists what changed, what did not, and how long the old backend stays available. The full design is in [Implementation Overview, section 8](implementation-overview.md#8-agent-mode--permission-aware-agentic-ai-on-amazon-bedrock-agentcore).

## Summary of Changes

| Aspect | Before (Amazon Bedrock Agents) | Now (AgentCore Runtime + Strands Agents) |
|--------|-------------------------------|------------------------------------------|
| Agent definition | `CfnAgent`, plus `CreateAgent` + `PrepareAgent` + an alias for each agent created in the UI | One item in DynamoDB `${prefix}-agent-definitions`. Creating is one write, and the status is always `PREPARED` |
| Run | `InvokeAgent` (agent ID + alias ID) | `InvokeAgentRuntime`. One generic Runtime receives the definition, the message and the `userId` |
| Agent code | None (managed) | `docker/agentcore-agent/` (Python 3.12, Strands Agents, arm64). CDK builds and deploys the image |
| Search tool | Action Group Lambda | Lambda target `permission-search` on an AgentCore Gateway (AWS_IAM, MCP) |
| Permission filter | SID matching inside the Action Group Lambda | `docker/nextjs/src/lib/rag-pipeline/sid-filter.ts` bundled into the Lambda; one implementation shared with KB mode |
| Model change | Update the agent, prepare it again, repoint the alias | Rewrite `foundationModel` in the definition; the next run uses it |
| Multi-agent | Supervisor + Collaborators (associated per alias) | Strands agents-as-tools. The supervisor calls each collaborator as a tool |
| Screens and API | Agent Directory and `/api/bedrock/*` | Unchanged. The API returns the same response shapes as before |

## What Did Not Change

- **The permission boundary.** The search tool the model sees takes only `query` and `max_results`. The web app takes `userId` from the session cookie (`session-token`), and the Runtime code adds it to the Gateway call. A request body `userId` that differs from the session returns 403; no session returns 401. A call without `userId`, and a user with no SID record, get no documents (Fail-Closed)
- **The screens.** Agent Directory, creating, editing and deleting agents, creating and running teams, and on-demand creation from cards work on the same screens
- **AgentCore Memory.** `enableAgentCoreMemory` is now independent of `enableAgent`, and it creates the same resources

## Design Choices

| Choice | Option not taken, and why |
|--------|---------------------------|
| One generic Runtime + definitions in DynamoDB | A Runtime per agent: creation takes minutes, and each forgotten Runtime keeps billing |
| Search runs the TypeScript `sid-filter.ts` in the Gateway's Lambda | A Python port: two implementations of the permission boundary, and only one of them gets fixed |
| One extra Gateway for the agents (AWS_IAM) | Sharing the `enableAgentCoreGateway` Gateway: it carries an interceptor and a Policy Engine and is removed by a different flag |

## The Old Backend

With `-c agentBackend=bedrock-agents`, the stack creates the earlier `CfnAgent` + Action Group, and the API takes the earlier path. This value stays for one release and is removed in the next. CI synth has a lane for it (`agent-bedrock-agents-legacy`), which is removed at the same time.

Agents created with the old backend are not moved to the new one. Create them again in Agent Directory (one DynamoDB write; it takes seconds).

## The Earlier TypeScript PoC

The TypeScript PoC placed in `docker/nextjs/src/lib/strands-agent/` in 2026-05 was imported nowhere, and its SDK was not in the dependencies, so this migration removed it. The implementation is the Python one (`docker/agentcore-agent/`).

## Next Steps

This migration moved agent creation, runs, multi-agent, model change and Memory to AgentCore. The next change moves these three:

1. Switch the run-trace view to AgentCore Observability
2. Switch scheduled runs to EventBridge Scheduler calling the Runtime
3. Run Agent Registry import and publish against the DynamoDB definitions

## Related Documents

| Document | Content |
|----------|---------|
| [Implementation Overview, section 8](implementation-overview.md#8-agent-mode--permission-aware-agentic-ai-on-amazon-bedrock-agentcore) | Architecture, CDK resources, permission boundary |
| [Agent Mode Development Guide](agent-mode-development-guide.md) | Screen-side implementation |
| [Deploying Strands Agents to AgentCore Runtime](https://strandsagents.com/latest/documentation/docs/user-guide/deploy/deploy_to_bedrock_agentcore/) | Official Strands Agents procedure |
| [Amazon Bedrock AgentCore Developer Guide](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html) | Runtime and Gateway |
