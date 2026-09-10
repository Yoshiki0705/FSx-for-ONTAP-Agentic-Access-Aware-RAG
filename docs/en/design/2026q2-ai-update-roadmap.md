# 2026 Q2 AI Update Implementation Roadmap

## Overview

An implementation roadmap for integrating the AWS AI updates from March to June 2026 into this project (Permission-aware RAG with FSx for ONTAP). Seven specs are implemented in stages, introducing new capabilities while keeping the permission boundary consistent.

## Core Invariant: Permission Boundary Classification

The following **permission boundary types** are the invariant that runs through every spec. Every data source falls into one of them, and the classification is used consistently in the UI, in logs, and in audit records.

| Type | Source | Permission guarantee | Trust level | Shown as |
|------|--------|----------------------|-------------|----------|
| `verified` | KB (FSx for ONTAP, SID-matched) | fail-closed, SID matching completed | HIGH | 🔒 internal document |
| `reference` | Web Search (Claude Platform) | not applicable (public information) | LOW | 🌐 external reference |
| `expanded` | Graph RAG expansion (Neptune) | real-time SID check (with delay) | MEDIUM | 🔗 related document |
| `memory` | Agent Memory (AgentCore) | tagged with an SID scope | MEDIUM | not shown (internal use) |

## Implementation Phases

### Phase 0: Foundation (Week 1-2)

**Spec: model-lifecycle-2026q2**

| Task | Content | Risk |
|------|---------|------|
| Confirm and update model IDs | Opus 4.8, Sonnet 4.6, Nova 2 Lite, GPT-5.5 GA | LOW |
| RAGAS quality gate | 31 permission-matrix scenarios plus a RAGAS regression run | LOW |
| CI/CD quality gate | automatic evaluation when model-defaults.ts changes | LOW |

**Exit criteria**: all tests pass and a RAGAS baseline is established.

---

### Phase 1: Core Hardening (Week 3-5)

**Spec: cost-optimization-bedrock** (prompt caching only)

| Task | Content | Risk |
|------|---------|------|
| Separate the prompt structure | split static and dynamic segments | LOW |
| Cache invalidation | hash of the permission rule version | LOW |
| Cost metrics | expose the cache hit/miss ratio | LOW |

**Expected impact**: 30-90% reduction in token cost.

**Spec: guardrails-automated-reasoning**

| Task | Content | Risk |
|------|---------|------|
| Define the Automated Reasoning policy | formal verification of fail-closed behaviour and SID matching | MEDIUM |
| Context-dependent guardrails | a profile per permission level | MEDIUM |
| Adversarial test set | deliberate permission-violation tests | LOW |

**Exit criteria**: with guardrails enabled, permission violations are detected and blocked.

---

### Phase 2: Platform Foundation (Week 6-9)

**Spec: agentcore-gateway-modernization**

| Task | Content | Risk |
|------|---------|------|
| Build the Gateway | CDK construct plus IAM authentication | MEDIUM |
| Permission Interceptor | Lambda plus a DynamoDB permission check | MEDIUM |
| Register MCP servers | the FSx for ONTAP, KB, and capacity tools | LOW |
| Observability | structured logs plus X-Ray | LOW |

**Exit criteria**: every agent tool call goes through the Gateway and passes the Permission Interceptor.

---

### Phase 3: Intelligence Expansion (Week 10-14)

**Spec: claude-platform-integration**

| Task | Content | Risk |
|------|---------|------|
| Web Search integration | Claude Platform API plus the sanitizer | MEDIUM |
| Permission boundary classification | display `verified` and `reference` separately | LOW |
| Citations | source attribution plus the boundary type | LOW |
| MCP connector | expose the FSx for ONTAP tools through the Gateway | LOW |

**Spec: agent-framework-evolution** (MVP)

| Task | Content | Risk |
|------|---------|------|
| Strands SDK foundation | migrate one agent only (the FSx for ONTAP agent) | MEDIUM |
| Memory permission tagging | memory scoped by SID | HIGH |
| Tool decorator | enforce `@permission_required` | LOW |

**Exit criteria**: the FSx for ONTAP agent runs on the Strands SDK and memory safety is confirmed.

---

### Phase 4: Advanced Capabilities (Week 15-20)

**Spec: knowledge-base-multimodal** (multimodal only)

| Task | Content | Risk |
|------|---------|------|
| Multimodal KB configuration | vectorize images and figures from PDFs | MEDIUM |
| Permission inheritance | inherit permissions from the parent document | LOW |
| UI integration | image thumbnails plus unified ranking | LOW |

**Spec: agent-framework-evolution** (full)

| Task | Content | Risk |
|------|---------|------|
| Migrate the RAG agent to Strands | turn `search_kb` and citations into tools | MEDIUM |
| Supervisor agent | multi-agent orchestration | HIGH |
| Claude managed agent | handler for simple queries | LOW |

---

### Phase 5: Graph and Full Integration (Week 21+)

**Spec: knowledge-base-multimodal** (GraphRAG)

| Task | Content | Risk |
|------|---------|------|
| Build Neptune Analytics | CDK plus VPC integration | HIGH |
| Graph builder Lambda | entity extraction plus relationship detection | MEDIUM |
| Real-time SID check | verify permissions on graph expansion results | HIGH |
| Permission graph | visualize user → group → document | MEDIUM |

**Spec: cost-optimization-bedrock** (distillation and batch)

| Task | Content | Risk |
|------|---------|------|
| Model distillation pipeline | training data plus evaluation | MEDIUM |
| Batch inference | KB Auto-Sync metadata enrichment | LOW |

---

## Risk Register

### Risk 1: Web Search results confused with the permission boundary
- **Impact**: a user reads a web search result as internally verified information
- **Likelihood**: HIGH (if the UI is ambiguous)
- **Severity**: HIGH
- **Mitigation**: permission boundary classification, a UI badge, and guardrail verification
- **Owner**: Frontend team
- **Phase**: Phase 3

### Risk 2: Memory leakage across scopes
- **Impact**: data belonging to a higher-privileged user reaches a lower-privileged one
- **Likelihood**: MEDIUM (given an implementation mistake)
- **Severity**: CRITICAL
- **Mitigation**: memory permission tagging, an SID scope filter, and audit logs
- **Owner**: Agent team
- **Phase**: Phase 3

### Risk 3: Stale permissions in graph expansion
- **Impact**: within five minutes of a permission being removed, graph expansion still surfaces the document
- **Likelihood**: MEDIUM
- **Severity**: MEDIUM
- **Mitigation**: real-time SID check plus display of the `expanded` boundary type
- **Owner**: Backend team
- **Phase**: Phase 5

### Risk 4: Quality regression from a model update
- **Impact**: a new model misjudges permissions and confidential information leaks
- **Likelihood**: LOW (a quality gate exists)
- **Severity**: CRITICAL
- **Mitigation**: RAGAS plus the permission-matrix CI gate, compared against the baseline
- **Owner**: ML team
- **Phase**: Phase 0

---

## Cost Tier Architecture

| Tier | Added capabilities | Estimated monthly increment | Intended for |
|------|--------------------|------------------------------|--------------|
| Essential | model update, prompt caching, Automated Reasoning guardrails | ~$50-100 | every environment |
| Professional | plus Gateway, citations, Web Search, Registry | ~$200-400 | standard environments |
| Enterprise | plus Strands multi-agent, multimodal, GraphRAG, distillation, memory | ~$800-1500 | enterprise environments |

---

## Quality Gates (All Phases)

- [ ] All 31 permission-matrix scenarios pass
- [ ] The RAGAS evaluation baseline is maintained
- [ ] `npx tsc --noEmit` → `npx cdk synth --quiet` → `npx jest --no-coverage` → `npx vitest run`
- [ ] CDK synth succeeds for every feature-flag combination
- [ ] Security: least-privilege IAM, fail-closed behaviour preserved
- [ ] Observability: every new capability emits CloudWatch metrics and logs
