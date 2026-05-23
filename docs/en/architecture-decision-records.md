# Architecture Decision Records (ADR)

**🌐 Language:** [日本語](../architecture-decision-records.md) | **English** | [한국어](../ko/architecture-decision-records.md) | [简体中文](../zh-CN/architecture-decision-records.md) | [繁體中文](../zh-TW/architecture-decision-records.md) | [Français](../fr/architecture-decision-records.md) | [Deutsch](../de/architecture-decision-records.md) | [Español](../es/architecture-decision-records.md)

**Created**: 2026-05-23  
**Status**: Approved  
**Audience**: Architects, technical leads, and anyone who wants to understand the decision rationale

---

## Overview

This document records the key architectural decisions and their rationale for the Permission-aware Agentic RAG system. It explains "why this configuration was chosen" and serves as a reference for future change decisions.

---

## ADR-001: Vector Store — S3 Vectors as Default

| Item | Details |
|------|---------|
| **Status** | Approved |
| **Date** | 2026-03-29 |
| **Context** | Whether to use S3 Vectors or OpenSearch Serverless as the default vector store for RAG search |

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| S3 Vectors (adopted) | A few dollars/month, zero operations, one-click AOSS export | Cold query: sub-second, not suited for high QPS |
| OpenSearch Serverless | Consistent 50ms, high QPS support, full-text search | Minimum $700/month (2 OCU), OCU management required |

### Decision

**S3 Vectors as default**, with the ability to switch to OpenSearch Serverless via the `vectorStoreType` parameter.

### Rationale

1. For PoC / small-scale use, starting at a few dollars/month lowers the adoption barrier
2. Access via Bedrock KB is vector-store-agnostic, so SID filtering logic is shared
3. When performance requirements increase, one-click export to AOSS from the console (~15 minutes)
4. All S3 Vectors metadata is filterable (no additional configuration needed)

### Impact

- Default deployment cost significantly reduced ($700/month → $5/month)
- High QPS environments require switching to `vectorStoreType=opensearch`
- Note the 2KB filterable metadata limit in S3 Vectors (when PDF metadata is large)

---

## ADR-002: Permission Filtering — Application-Side SID Matching

| Item | Details |
|------|---------|
| **Status** | Approved |
| **Date** | 2026-01-15 |
| **Context** | At which layer to implement permission filtering of RAG search results |

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Application-side SID matching (adopted) | Vector-store-agnostic, LLM bypass impossible, easy Fail-Closed implementation | Post-search filter, so retrieved count > displayed count |
| Vector store metadata filter | Filters at search time, efficient | Not directly controllable via Bedrock KB Retrieve API |
| Bedrock KB RetrieveAndGenerate | Single API call | Metadata not returned, SID filtering impossible |

### Decision

Adopt a **two-stage approach: Bedrock KB Retrieve API + application-side SID matching + Converse API**.

### Rationale

1. RetrieveAndGenerate API does not include `allowed_group_sids` in citation metadata, making SID filtering impossible
2. Application-side filtering runs outside the LLM, so it cannot be bypassed via Prompt Injection
3. Common logic independent of vector store type (S3 Vectors / AOSS)
4. Fail-Closed implementation (deny all on SID retrieval failure) is straightforward

### Impact

- Need to set a higher retrieval count since filtering is applied to all documents from Retrieve API
- Answer quality may degrade if few documents remain after filtering
- Permission cache (DynamoDB, TTL 5 minutes) speeds up repeated checks

---

## ADR-003: Authentication — Cognito + Multi-IdP Federation

| Item | Details |
|------|---------|
| **Status** | Approved |
| **Date** | 2026-02-01 |
| **Context** | Selection of user authentication and SID/UID/GID retrieval method |

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Cognito + SAML/OIDC/LDAP (adopted) | 5 modes supported, CDK parameter switching, Fail-Closed support | Cognito limitations (custom attribute count, token size) |
| IAM Identity Center direct use | AWS-native SSO | Complex integration with RAG app |
| Custom authentication (Lambda Authorizer) | Full flexibility | High implementation and operational cost |

### Decision

Use **Cognito User Pool** as the hub, with 5 modes switchable via CDK parameters: SAML (AD Federation), OIDC (Auth0/Keycloak/Okta), LDAP (OpenLDAP/FreeIPA), and email/password.

### Rationale

1. Cognito integrates easily with CloudFront + Lambda Function URL (IAM Auth)
2. Post-Authentication Trigger enables automatic SID/UID/GID retrieval and DynamoDB registration
3. `authFailureMode=fail-closed` blocks sign-in when permission retrieval fails
4. Flexibility to select mode based on customer's existing IdP

### Impact

- Note Cognito limitations (50 custom attributes, 2KB token size)
- SAML metadata URL management required (during IdP certificate renewal)
- LDAP direct query requires VPC-internal Lambda

---

## ADR-004: Frontend — Lambda Web Adapter + Next.js 15

| Item | Details |
|------|---------|
| **Status** | Approved |
| **Date** | 2026-01-10 |
| **Context** | Selection of web application hosting method |

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Lambda Web Adapter + Next.js (adopted) | Serverless, IAM Auth + OAC, cold start acceptable | Cold start 3-5 seconds, Docker image size |
| ECS Fargate | Always running, low latency | Minimum $30/month (always-on), ALB required |
| Amplify Hosting | Managed, CI/CD integration | IAM Auth not supported, customization limitations |
| App Runner | Easy deployment, auto-scaling | IAM Auth not supported, VPC integration limitations |

### Decision

Run Next.js 15 serverlessly with **Lambda Web Adapter**, protected by CloudFront OAC + IAM Auth.

### Rationale

1. IAM authentication (Function URL + OAC) completely prevents direct access from outside CloudFront
2. Serverless means zero cost during idle periods
3. One-command CDK deployment (including Docker image build)
4. Next.js 15 App Router + Server Components enable SSR/ISR

### Impact

- Cold start (3-5 seconds) occurs on first access. Can be mitigated with Provisioned Concurrency
- Docker image size optimization needed (multi-stage build)
- Apple Silicon (M1/M2/M3) requires pre-build mode (x86_64 Lambda compatibility)

---

## ADR-005: Data Sync — KB Auto-Sync (Polling Method)

| Item | Details |
|------|---------|
| **Status** | Approved |
| **Date** | 2026-04-15 |
| **Context** | Method to reflect file changes on FSx for ONTAP to Bedrock KB |

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| EventBridge Scheduler polling (adopted) | Simple, no FSx events needed, S3 AP compatible | Up to 15-minute delay, ListObjectsV2 cost |
| CloudTrail + EventBridge (event-driven) | Near real-time | Limited CloudTrail support for S3 AP |
| FSx Audit Log + EventBridge | File-level events | Complex setup, high log volume |
| Manual trigger only | Simplest | Operational burden, risk of missed syncs |

### Decision

**EventBridge Scheduler polling at 5-15 minute intervals** as default, executing `StartIngestionJob` only when changes are detected.

### Rationale

1. FSx for ONTAP S3 Access Point has limited CloudTrail data event support
2. ListObjectsV2 + DynamoDB inventory comparison reliably detects changes
3. IN_PROGRESS job deduplication prevents unnecessary syncs
4. 3 consecutive failures trigger CloudWatch Alarm → operations team notification

### Impact

- Up to 15-minute sync delay (depends on polling interval)
- Large environments (100,000+ files) should note ListObjectsV2 execution time
- Transfer Family path also supports CloudTrail event-driven mode

---

## ADR-006: Smart Routing — 3-Tier Automatic Model Selection

| Item | Details |
|------|---------|
| **Status** | Approved |
| **Date** | 2026-05-01 |
| **Context** | Model selection strategy for cost optimization |

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| 3-tier automatic routing (adopted) | 60-80% cost reduction, quality maintained | Depends on classification accuracy, misclassification risk |
| Single fixed model | Simple, predictable | Cost-inefficient or quality-insufficient |
| User manual selection | User control | Poor UX, difficult cost management |

### Decision

**3-tier automatic routing** based on query complexity (Simple → Haiku, Complex → Sonnet, Full-context → Opus) as default, with manual selection option also available.

### Rationale

1. In enterprise RAG, 60%+ of questions are simple fact checks (Haiku is sufficient)
2. Weighted average cost ~$0.014/query improves quality while maintaining similar cost to all-Sonnet (~$0.01)
3. CloudWatch EMF metrics visualize routing distribution, enabling threshold adjustment
4. Fallback mechanism (automatic switch to next tier when model unavailable) ensures availability

### Impact

- Classifier accuracy directly affects cost and quality (periodic threshold tuning recommended)
- Watch for cost spikes during Opus usage (daily cost cap setting recommended)
- When Smart Routing is OFF, single fixed model is used as before

---

## Related Documents

| Document | Related ADR |
|----------|------------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
