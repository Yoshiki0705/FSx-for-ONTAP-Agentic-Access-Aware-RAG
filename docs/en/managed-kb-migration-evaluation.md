# Amazon Bedrock Managed Knowledge Base Migration Path Evaluation

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | **English** | [한국어](../ko/managed-kb-migration-evaluation.md) | [简体中文](../zh-CN/managed-kb-migration-evaluation.md) | [繁體中文](../zh-TW/managed-kb-migration-evaluation.md) | [Français](../fr/managed-kb-migration-evaluation.md) | [Deutsch](../de/managed-kb-migration-evaluation.md) | [Español](../es/managed-kb-migration-evaluation.md)

**Created**: 2026-06-18
**Target region**: ap-northeast-1 (Tokyo) — Managed KB is available in the Tokyo Region
**Status**: Evaluation document (migration not performed / existing path retained)
**Related**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md` (origin)

---

## 0. Purpose of This Document

This document evaluates the **migration path** for upgrading this repository's existing Permission-aware RAG configuration (Bedrock KB + OpenSearch Serverless / S3 Vectors) to [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/), which became generally available at AWS Summit New York 2026 (2026-06-17).

Key assumptions:

- This is an **evaluation document**; it does not recommend immediate migration.
- The existing path (Bedrock KB + OpenSearch Serverless / S3 Vectors) is **not removed**.
- Content is classified into two evidence tiers.

| Tier | Definition | Treatment in this document |
|------|-----------|---------------------------|
| Public evidence | Verifiable from official AWS docs/blogs | Cited with source links |
| Project-context expectation | Design decisions/expectations within this project (not publicly verifiable) | Labeled as "project assumption" |

> ⚠️ **Distinction discipline**: We clearly separate "general feature description" from "behavior verified in this project." Managed KB feature descriptions are general explanations based on public AWS information; ACL integration behavior in this project is **unverified** (see verification points below).

---

## 1. Managed KB Key Features (Public Evidence)

Based on the [Introducing Amazon Bedrock Managed Knowledge Base blog](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) and the [GA announcement](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/). Content was rephrased for compliance with licensing restrictions while preserving the source's intent.

| Feature | Overview | Relevance to this project |
|---------|----------|--------------------------|
| 6 native data connectors | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler. Auto-ingests data and permissions | Whether the **S3 connector** can connect to FSx for ONTAP S3 Access Point is the key question |
| Smart Parsing | Automatically selects the optimal parsing strategy per data type and connector (PDF, Office, tables, multimodal) | Could automate the existing manual chunking strategy selection |
| Agentic Retriever | Decomposes complex queries into sub-queries and runs iterative multi-hop retrieval | Requires re-authorization in the Permission-aware context (see below) |
| Managed vector storage | No vector DB provisioning. Price-performance optimized | Removes OpenSearch Serverless / S3 Vectors operational burden |
| AgentCore Gateway integration | Exposed as a built-in connector target (MCP) with two tools: `Retrieve` and `AgenticRetrieveStream` | Integrable with this project's AgentCore Gateway (already implemented) |
| Existing API compatibility | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` etc. are the same | KB ID change only, no code change (AWS claim, to be verified) |
| Regions | GA in multiple regions including Tokyo | Consistent with ap-northeast-1 deployment |

### Pricing Model (Public Evidence)

Per [AWS's description](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/), billing has two dimensions (indexed data size + on-demand retrieval count). No upfront commitment.

> ⚠️ **Cost estimation note**: The above is the structure of the published pricing model; actual cost for this project's workload is unmeasured. Before any migration decision, perform a unit-cost comparison between "current (OpenSearch Serverless OCU / S3 Vectors storage)" and "Managed KB (data size + retrieval count)" using expected query and data volumes.

---

## 2. Comparison with Existing Configuration

### 2.1 Architecture Comparison

| Aspect | Current (Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|--------|------------------------------------------------------------------|------------|
| Vector store operations | Self-managed (AOSS OCU design / S3 Vectors index management) | Fully managed (no provisioning) |
| Data source | FSx for ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | Via S3 connector (S3 AP connection to be verified) |
| Parsing & chunking | Manual selection via `kbChunkingStrategy` (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing auto-selects (customizable) |
| Embedding model | Fixed at deploy time (`embeddingModel`, change requires recreation) | Default auto-selected + optional Bedrock model |
| Retrieval | Single Retrieve + app-side SID filter | `Retrieve` (single hybrid) + `AgenticRetrieveStream` (multi-hop) |
| ACL filter | App-side `allowed_group_sids` matching (vector-store agnostic) | Metadata `filter` operators + `userContext` (to be verified) |
| Gateway integration | Custom (implemented AgentCore Gateway + Permission Interceptor) | Built-in connector target |
| Operational burden | Medium (vector store / pipeline design required) | Low (managed) |
| Customizability | High (all components controllable) | Medium (tunable within managed scope) |

### 2.2 Existing SID Filtering Approach (Project-context)

Per [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md), this project uses the following vector-store-agnostic approach.

```
Bedrock KB Retrieve API → search results + metadata(allowed_group_sids)
→ app-side (route.ts) matches user SID ∩ document SID
→ only matched documents go to Converse API
→ Fail-Closed: deny all if SID retrieval fails
```

The strength of this approach is that **the app-side authorization logic stays unchanged** even if the vector store (AOSS / S3 Vectors) changes. Whether this invariant can be preserved after migrating to Managed KB is the most critical point.

---

## 3. Migration Decision Criteria

Framed as "right tool for the job," not "replacing a competitor." Tradeoffs of both configurations are stated symmetrically.

### 3.1 When to Consider Migrating to Managed KB

- You want to **reduce the operational/design burden** of the vector store (OpenSearch Serverless OCU / S3 Vectors index)
- You want to leverage Smart Parsing for **automatic parsing of multi-format documents** (PDF, Office, tables)
- You seek accuracy improvements for **multi-hop, complex queries** via Agentic Retriever
- You want to **adopt new embedding/re-ranking models without rebuilding infrastructure**
- You want to integrate into an AgentCore Gateway-centric architecture and **simplify connection via a built-in connector target**

### 3.2 When to Retain the Current Configuration

- You have a **requirement to strictly apply file-level ACL (NTFS / SID) at retrieval time** and want full control over `allowed_group_sids` matching behavior
- You have **custom logic for immediate reflection** of permission changes, deletions, and renames (whether managed sync can match this is unverified)
- You want **fine-grained control over the vector store's filter / ranking / reranking**
- You don't want to compromise production Fail-Closed guarantees while **ACL metadata retention/filtering in managed storage is unverified**
- Data sovereignty or audit requirements demand **explicitly managing where vector data is stored**

### 3.3 Decision Flow

```
Do you need to strictly apply ACL at retrieval time?
├─ YES → Can you clear all verification points in §4?
│        ├─ YES → Consider phased migration (§5)
│        └─ NO  → Retain current configuration (prioritize ACL guarantee)
└─ NO  → Prioritize operational burden / accuracy; consider Managed KB
```

> ⚠️ This project's primary purpose is **Permission-aware RAG**, and strict ACL enforcement is a non-negotiable requirement. Therefore, unless the §4 verification is cleared, retaining the current configuration is the default policy.

---

## 4. Impact on Permission-aware RAG (Most Critical)

Can this project's SID-based ACL filter be preserved with Managed KB's managed storage? We organize the public evidence and verification points.

### 4.1 Public Evidence: Managed KB Access Control Methods

Per the [AgentCore Gateway connector target documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html), Managed KB has two access control methods.

**(A) Metadata `filter` operators (`Retrieve` tool)**

`managedSearchConfiguration.filter` supports these operators (summarizing the source's intent):
`equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `in`, `notIn`, `startsWith`, `listContains`, `stringContains`, `andAll`, `orAll`

→ **`listContains` may be usable to match a user SID against `allowed_group_sids` (an array)**. This could push the current app-side matching down into the retrieval layer.

**(B) Access control filtering via `userContext`**

Per the documentation, when a KB applies per-user/group access control, the calling application includes `userContext` (e.g., `userId`) in the request. The Gateway passes this through to the KB, which applies filtering based on `userContext`. Critically, **the Gateway does not populate `userContext` from the caller's IAM identity — the application must supply it explicitly**. It is also explicitly stated that **`userContext` is supplied by the application, not the model**.

→ This "application explicitly supplies it" / "not left to the model" design aligns directionally with this project's **Fail-Closed, app-enforced** principle.

### 4.2 Verification Points (Confirm Before Migration)

All of the following are **unverified** and determine migration feasibility. Project-context assumptions are noted alongside.

| # | Verification item | Project assumption | Risk |
|---|-------------------|-------------------|------|
| V1 | Can the S3 connector use **FSx for ONTAP S3 Access Point** as a data source (alias format, IAM boundary)? | Assumed connectable if S3-compatible | If not connectable, migration is infeasible |
| V2 | Is `.metadata.json`'s `allowed_group_sids` **retained as metadata** in the Managed KB index? | Assumed retained | If not retained, ACL filter is impossible |
| V3 | Does `Retrieve`'s `filter` work for **SID array matching via `listContains`**? | Assumed functional | If not, switch to userContext method |
| V4 | Is the `userContext` method valid for **S3-connector-ingested data** (not SaaS-connector-only)? | Unknown whether valid for S3 | If invalid for S3, depends on filter method |
| V5 | Is ACL filtering applied at **each step of `AgenticRetrieveStream` (multi-hop)**? | Per-step application required | Risk of unauthorized data entering at intermediate steps |
| V6 | Is **reflection latency for permission changes/deletions/renames** acceptable in managed storage? | Expect same immediacy as existing | Risk of stale-permission data due to reflection delay |
| V7 | Is **ACL application maintained for conversation history/cache**? | Maintained app-side | Managed-side cache behavior unknown |

> ⚠️ **Non-negotiable**: If any of V2, V3 (or V4), or V5 is unmet, migration is **BLOCKED** because **unauthorized data may enter search results**. This would violate the FSx for ONTAP AI/RAG architecture review non-negotiable requirements ("a design where unauthorized data may enter vector search results," "a design with no authorization check on the context passed to the LLM").

### 4.3 Maintaining Defense-in-Depth

Even when migrating, maintain defense-in-depth without depending on a single method.

```
1. User authentication via IdP / Cognito / AD
2. Retrieve user principal / group SIDs (DynamoDB user-access)
3. filter (listContains) or userContext at Managed KB retrieval time
4. ★ App-side ACL re-matching immediately before LLM context injection (keep current route.ts logic) ★
5. Re-authorization after each step when using AgenticRetrieveStream
6. Re-authorization when displaying citation source links
7. Audit log (who used what SID-derived information, and when)
```

→ Even when using Managed KB-side filtering, we **strongly recommend keeping step 4 (app-side final ACL match)**. This ensures Fail-Closed even if the managed-side filter behaves differently than expected.

---

## 5. Migration Path (Phased / Existing Path Retained)

Like the existing Dual KB migration pattern ([migration-guide-multimodal.md](migration-guide-multimodal.md)), verify in stages with **parallel operation**. The existing path is not removed.

### Phase 0: PoC Verification (No Production Impact)

1. Create a Managed KB with a small verification dataset (consistent data from Snapshot / FlexClone recommended)
2. Verify V1–V7 from §4.2 in order
3. Confirm SID filtering (filter / userContext) behavior against the 31 scenarios in [tests/permission-matrix/](../../tests/permission-matrix/)

### Phase 1: Parallel Operation (Shadow)

1. Keep the existing KB and run the Managed KB as a **read-only shadow** in parallel
2. Send identical queries to both systems and compare search results, ACL filter results, and citation consistency
3. Compare accuracy and citation precision with RAGAS etc. ([evaluation.md](evaluation.md))

### Phase 2: Phased Migration (Canary)

1. Use AgentCore Gateway A/B testing (AgentCore Optimization — already implemented in this repository) to route a portion of traffic to the Managed KB path
2. Confirm all permission tests (Fail-Closed, group nesting, ACL edge cases) pass
3. After confirming statistical significance, gradually shift traffic

### Phase 3: Cutover Decision

- All verifications cleared → make Managed KB the default path
- Any unmet items → retain current configuration; keep Managed KB as shadow or withdraw

> We recommend keeping the existing path (Bedrock KB + OpenSearch Serverless / S3 Vectors) as a **rollback path for a period** even after migration completes.

---

## 6. Verification Checklist

Confirm all of the following before a migration decision.

### Data Foundation
- [ ] V1: S3 connector can register FSx for ONTAP S3 AP as a data source
- [ ] PoC performed with consistent data from Snapshot / FlexClone
- [ ] Production data is not subjected to heavy direct crawling

### Permission-aware RAG (Most Critical)
- [ ] V2: `allowed_group_sids` is retained as metadata
- [ ] V3 or V4: SID filter works via `listContains` filter or `userContext`
- [ ] V5: ACL is applied at each AgenticRetrieveStream step
- [ ] Defense-in-depth step 4 (app-side final match) is maintained
- [ ] Fail-Closed: deny all when SID retrieval fails
- [ ] All 31 permission test scenarios pass

### Data Lifecycle
- [ ] V6: Reflection latency for permission changes/deletions/renames is acceptable
- [ ] V7: ACL is applied to conversation history/cache

### Cost & Performance
- [ ] Unit-cost comparison of current vs Managed KB performed (data size + retrieval count)
- [ ] Monthly estimate created for expected query volume

### Operations
- [ ] Rollback procedure (return to existing path) documented in a runbook
- [ ] Usage history traceable via audit log

---

## 7. Recommendation

**Current verdict: REQUEST CHANGES (migration on hold until verification complete)**

Conditions to lift:

1. Verify points V1–V7 in §4.2 via PoC
2. Specifically clear **V2, V3 (or V4), and V5** (BLOCKED if unmet)
3. Design must maintain defense-in-depth step 4 (app-side final ACL match)
4. Cost comparison shows no disadvantage vs current, or operational-burden reduction outweighs any cost increase

**Rationale:**

- Managed KB's operational-burden reduction, Smart Parsing, and Agentic Retriever offer clear value for this project (public evidence).
- However, this project's **top-priority requirement is strict ACL enforcement for Permission-aware RAG**, and SID filter behavior in managed storage is **unverified**.
- `userContext` (app-supplied, model-independent) and the `listContains` filter align directionally, so **migration is quite feasible depending on verification**.

> This document is an evaluation. Actual migration should be performed only after the above verification and approval through the relevant review (FSx for ONTAP AI/RAG architecture review).

---

## Related Documents

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Managed KB validation procedures (S3 AP connection validation / FlexClone safe validation pattern)
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — SID filtering fundamental design
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — S3 Vectors + SID integration
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — Existing stack configuration and KB quotas
- [metadata-json-schema.md](metadata-json-schema.md) — `allowed_group_sids` metadata schema
- [migration-guide-multimodal.md](migration-guide-multimodal.md) — Reference pattern for Dual KB phased migration
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — Current chunking strategy
- [evaluation.md](evaluation.md) — RAG evaluation methods
