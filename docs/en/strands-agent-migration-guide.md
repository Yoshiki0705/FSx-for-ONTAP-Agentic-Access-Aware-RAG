# Strands Agents SDK Migration Guide

**🌐 Language:** [日本語](../strands-agent-migration-guide.md) | **English**

**Created**: 2026-05-31  
**Status**: PoC implementation complete, under evaluation  
**Reference**: [Strands Agents TypeScript SDK](https://github.com/strands-agents/sdk-typescript)

---

## Overview

An evaluation and design document for migrating this project's Agent mode from the current Bedrock Agent (InvokeAgent API) to a Strands Agents SDK-based implementation.

---

## Current Architecture vs Strands Architecture

| Aspect | Current (Bedrock Agent) | Strands Agents SDK |
|--------|------------------------|-------------------|
| Agent definition | AWS Console / CDK (CfnAgent) | TypeScript code |
| Tool integration | Action Group Lambda | `tool()` function (TypeScript) |
| Testability | Only after deployment | Local execution possible |
| Model switching | Requires Agent recreation | Instant switch with `BedrockModel({ modelId })` |
| Streaming | InvokeAgent response stream | Async Iterator |
| Conversation management | Managed internally by Agent | `SlidingWindowConversationManager` |
| Deployment target | Bedrock Agent (managed) | AgentCore Runtime / Lambda / Docker |
| Cost | Agent standby cost $0 + tokens | Same (tokens only) |
| Permission filtering | Implemented within Action Group | Implemented within `permission_aware_search` tool |

---

## Implemented PoC

### File Structure

```
docker/nextjs/src/lib/strands-agent/
├── index.ts                         — Public API
├── create-rag-agent.ts              — Agent factory (MOCA pattern)
└── permission-aware-search-tool.ts  — KB search tool with SID filtering
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

### Agent Creation

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

## Migration Benefits

1. **Local testing**: Run agents locally with `npx tsx`. No deployment needed, dramatically faster development cycles
2. **Type-safe tool definitions**: Input validation via Zod schemas. More concise than Action Group OpenAPI schemas
3. **rag-pipeline module reuse**: Uses `filterByPermissions()` directly. No duplication of SID filtering logic
4. **Smart Routing integration**: Dynamically switch models within the Agent (Haiku → Sonnet → Opus)
5. **AgentCore Runtime deployment**: Deploy to AgentCore Runtime in production for scalability

---

## Migration Steps (Recommended)

### Phase A: Parallel Operation (Current)
- Keep the existing Bedrock Agent (InvokeAgent API) as-is
- Expose the Strands Agent on a new API route (`/api/strands-agent/invoke`)
- Add a "Strands Agent (Beta)" option in the UI

### Phase B: Feature Parity Verification
- Validate Permission-aware Search behavior (SID filtering)
- Validate multi-turn conversation behavior (SlidingWindowConversationManager)
- UI integration of streaming responses

### Phase C: Switchover
- Switch default Agent to Strands
- Keep Bedrock Agent as deprecated (for fallback)
- Automate deployment to AgentCore Runtime

---

## Prerequisites

```bash
# Install Strands Agents SDK
cd docker/nextjs
npm install @strands-agents/sdk zod
```

---

## Constraints and Notes

- Strands TypeScript SDK is v1.0 (GA) as of June 2026
- AgentCore Runtime deployment is not supported by CloudFormation (CLI/SDK only)
- `SlidingWindowConversationManager` is in-memory. Persistence requires integration with AgentCore Memory
- Browser execution is also supported, but this project targets Lambda (Node.js) execution

---

## Streaming Response Integration Design

The Strands SDK supports streaming via Async Iterator. Design for UI integration:

```typescript
// API Route (Next.js) — SSE conversion
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

The UI side extends the existing `useChat` hook to process SSE events:
- `text` event → Incremental display in chat bubble
- `tool_use` event → Display "🔍 Searching..." indicator
- `[DONE]` → Stream complete, display citations

---

## Multi-Tenant Isolation Patterns

| Pattern | Isolation Level | Cost | Applicable Scenario |
|---------|----------------|------|---------------------|
| **Shared Agent + userId isolation** | Logical isolation (SID filtering) | Low | Department isolation within a single organization |
| **Per-tenant Agent instance** | Agent instance isolation | Medium | Multi-tenant SaaS |
| **Per-tenant AgentCore Runtime** | Runtime isolation | High | Regulatory requirements (healthcare, finance) |

Recommendation: This project's SID filtering is designed with the "Shared Agent + userId isolation" pattern. Since the `permission_aware_search` tool controls document access based on userId, there is no need to isolate Agent instances. However, consider Per-tenant Agent instances if you need different model selections or prompts per tenant.

---

## Related Documents

| Document | Content |
|----------|---------|
| [Strands Agents TypeScript Quickstart](https://strandsagents.com/docs/user-guide/quickstart/typescript/) | SDK introduction |
| [AgentCore Runtime Deployment](https://strandsagents.com/docs/user-guide/deploy/deploy_to_bedrock_agentcore/typescript/) | Production deployment procedure |
| [next-phase-event-driven-agents.md](next-phase-event-driven-agents.md) | Event-Driven Agent Trigger design |
| [implementation-overview.md](implementation-overview.md) | Item 8: Bedrock Agent implementation |
