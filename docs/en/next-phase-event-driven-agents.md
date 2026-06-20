# Event-Driven Agent Trigger — Design Document

**🌐 Language:** [日本語](../next-phase-event-driven-agents.md) | **English**

**Created**: 2026-05-31  
**Status**: In Design (Phase 2)  
**Reference Implementation**: [aws-samples/sample-multi-agent-orchestration-chat-on-agentcore](https://github.com/aws-samples/sample-multi-agent-orchestration-chat-on-agentcore/tree/main/packages/trigger)

---

## Overview

An event-driven pattern that automatically triggers Agents for post-processing (summarization, classification, notification) after KB Auto-Sync or Transfer Family ingestion completes.

This applies the EventBridge Scheduler + Custom Event Handler pattern implemented in the MOCA repository's `packages/trigger/` to this project's Permission-aware RAG pipeline.

---

## Use Cases

| Trigger Event | Auto-Triggered Agent | Output |
|---------------|---------------------|--------|
| KB Ingestion Job COMPLETE | Summary Agent | Saves summaries of new documents to DynamoDB |
| Transfer Family file upload | Classification Agent | Appends document category to `.metadata.json` |
| Capacity Guardrails BREAK_GLASS activation | Notification Agent | Sends structured alert to Slack/Teams |
| Schedule (daily at 9:00) | Report Agent | Generates daily RAG usage statistics report |

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│ EventBridge Rule    │     │ EventBridge Scheduler│
│ (KB Ingestion       │     │ (Daily 09:00 JST)    │
│  COMPLETE event)    │     │                      │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────┐
│           Agent Trigger Lambda                   │
│  1. Resolve trigger config (DynamoDB)            │
│  2. Authenticate (Machine User token)            │
│  3. Invoke Agent (fire-and-forget)               │
│  4. Record execution (DynamoDB)                  │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│           Bedrock Agent / Strands Agent           │
│  • Permission-aware Search (SID filtering)       │
│  • Document summarization                        │
│  • Classification                                │
│  • Notification dispatch                         │
└─────────────────────────────────────────────────┘
```

---

## MOCA Pattern Mapping

| MOCA Component | Corresponding Element in This Project |
|----------------|--------------------------------------|
| `schedule-handler.ts` | EventBridge Scheduler → Lambda → Agent invocation |
| `custom-event-handler.ts` | KB Ingestion COMPLETE event → Agent invocation |
| `AuthService` (Machine User token) | Cognito App Client credentials flow |
| `AgentInvoker` (fire-and-forget) | Bedrock InvokeAgent API (async) |
| `ExecutionRecorder` (DynamoDB) | Execution history table (triggerId, sessionId, status) |
| GSI2 (eventSourceId → triggers) | DynamoDB GSI to look up target triggers by eventSource |

---

## DynamoDB Table Design

### agent-triggers Table

| Key | Type | Description |
|-----|------|-------------|
| PK: `userId` | S | Trigger owner |
| SK: `triggerId` | S | Trigger ID (ULID) |
| GSI1PK: `AGENT#{agentId}` | S | Lookup by Agent |
| GSI2PK: `EVENTSOURCE#{eventSourceId}` | S | Lookup by event source |
| name | S | Trigger name |
| agentId | S | Agent ID to invoke |
| prompt | S | Prompt to pass to the Agent |
| eventSourceId | S | Event source identifier |
| enabled | BOOL | Enabled/Disabled |
| lastExecutionAt | S | Last execution timestamp |

### agent-trigger-executions Table

| Key | Type | Description |
|-----|------|-------------|
| PK: `triggerId` | S | Trigger ID |
| SK: `executionId` | S | Execution ID (ULID) |
| sessionId | S | Agent session ID |
| status | S | success / failure |
| error | S | Error message (on failure) |
| eventDetail | M | Trigger event details |
| TTL | N | Auto-delete after 30 days |

---

## CDK Implementation Approach

```typescript
// lib/constructs/event-driven-agent-construct.ts
export interface EventDrivenAgentProps {
  agentId: string;
  triggerTable: dynamodb.ITable;
  executionTable: dynamodb.ITable;
  cognitoUserPool: cognito.IUserPool;
  // EventBridge rule definitions
  eventRules?: {
    kbIngestionComplete?: boolean;  // KB Ingestion COMPLETE event
    capacityBreakGlass?: boolean;   // BREAK_GLASS activation event
  };
  // Schedule definitions
  schedules?: {
    dailyReport?: string;  // cron expression
  };
}
```

---

## Implementation Phases

### Phase 2.1: Foundation (2-3 days)
- [ ] DynamoDB table definitions (CDK)
- [ ] Agent Trigger Lambda implementation (TypeScript)
- [ ] EventBridge Rule: KB Ingestion COMPLETE

### Phase 2.2: UI (2-3 days)
- [ ] Trigger management UI (add "Triggers" tab to Agent Directory)
- [ ] Execution history display
- [ ] Enable/Disable toggle

### Phase 2.3: Extensions (1-2 days)
- [ ] Schedule triggers (EventBridge Scheduler)
- [ ] Custom event triggers (Transfer Family, BREAK_GLASS)
- [ ] Real-time notification of execution results via AppSync Events

---

## Prerequisites

- `enableAgent=true` (Bedrock Agent enabled)
- KB Auto-Sync enabled (`enableKbAutoSync=true`) — source of KB Ingestion events
- Cognito App Client (for Machine-to-Machine authentication)

---

## Security Considerations

- Agent Trigger Lambda invokes Agents using a Machine User token
- SID filtering during Agent execution is applied as usual (executes with the trigger owner's permissions)
- Prompt content is not stored in execution history (PII risk avoidance)
- BREAK_GLASS triggers are used in conjunction with SNS notifications (fallback if Agent fails)

### Agent Output Storage and PII Control

| Item | Design | Rationale |
|------|--------|-----------|
| Agent response storage | **Not stored** in DynamoDB (execution table) | PII contamination risk avoidance. Agent responses are only accessible within the session |
| Daily report storage | Stored in S3 (encrypted, 90-day TTL) | Operational reports are auditable. Assumes prompt design that excludes PII |
| Guardrails integration | Bedrock Guardrails applied to Agent output | PII detection and masking. Automatically applied when `enableGuardrails=true` |
| Log output | Agent responses **not logged** in CloudWatch Logs | `prompt` field is excluded from logs by design (MOCA pattern compliance) |
| Healthcare/Public Sector | Agent output retention period aligned with customer policy | Controlled via DynamoDB TTL or S3 Lifecycle |

**Additional recommendations for regulated workloads:**
- Set Guardrails PII detection to `HIGH` sensitivity
- Store Agent output in a VPC-internal S3 bucket (no public access)
- Enable CloudTrail data events to audit access to Agent outputs

---

## Related Documents

| Document | Content |
|----------|---------|
| [implementation-overview.md](implementation-overview.md) | Item 21: KB Auto-Sync |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR-005: Data synchronization approach |
| [next-generation-features-design.md](next-generation-features-design.md) | Next-generation features design |
