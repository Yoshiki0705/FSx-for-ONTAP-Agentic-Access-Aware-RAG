---
title: "Smart Routing, Transfer Family Ingestion, and Voice Chat — Permission-Aware RAG v4.2"
published: false
description: "Five new features for the Agentic Access-Aware RAG system: 3-tier model routing, SFTP-to-KB ingestion via Transfer Family, KB Auto-Sync, Capacity Guardrails, and WebRTC Voice Chat."
tags: aws, amazonfsxfornetappontap, serverless, bedrock
series: "Permission-Aware RAG with FSx for ONTAP"
cover_image:
---

## What This Post Covers

This is a companion article to the [FSx for ONTAP S3 Access Points Serverless Patterns](https://dev.to/yoshikifujiwara/fpolicy-event-driven-pipeline-multi-account-stacksets-and-cost-optimization-fsx-for-ontap-s3-5bd6) series. While that series focuses on serverless patterns for FSx for ONTAP S3 Access Points across industries, this post covers the **v4.2 release** of the [Agentic Access-Aware RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG) system — a permission-aware RAG application built on FSx for ONTAP + Amazon Bedrock, production-grade in the sense of CI coverage, permission filtering, guardrails, and deployment parameterization — while some v4.2 features still have follow-up E2E items listed in What's Next.

The v4.2 release adds five features that address real-world enterprise needs: intelligent model routing for cost optimization, SFTP-based document ingestion for partners who can't use web UIs, automatic KB synchronization, operational guardrails for FSx ONTAP automation, and voice-based interaction via WebRTC.

---

## 1. Smart Routing Model Expansion

### The Problem

Enterprise RAG workloads have wildly different complexity levels. A simple "What's the office address?" query doesn't need the same model as "Analyze the Q4 financial report across all subsidiaries and identify cost reduction opportunities." Routing everything through a single model either wastes money or delivers poor quality.

### The Solution: 3-Tier Automatic Routing

The default routing tiers are configured for the model set currently enabled in this deployment:

- **Simple** (greetings, factual lookups) → Claude Haiku 4.5 (`anthropic.claude-haiku-4-5-20251001-v1:0`)
- **Complex** (analysis, comparison, summarization) → Claude 3.5 Sonnet v2 (`anthropic.claude-3-5-sonnet-20241022-v2:0`)
- **Full-context** (multi-document reasoning, financial analysis) → Claude Opus 4 (`anthropic.claude-opus-4-0-20250514-v1:0`)

The exact model IDs are deployment parameters (`lightweightModelId`, `powerfulModelId`, `heavyModelId`), so teams can update to newer Sonnet/Opus releases without changing the routing logic.

```
┌─────────────────────────────────────────────────────┐
│                  User Query                          │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Complexity     │
              │  Classifier     │
              └───┬────┬────┬───┘
                  │    │    │
         Simple   │    │    │  Full-context
                  ▼    ▼    ▼
        ┌──────┐ ┌──────┐ ┌──────┐
        │Haiku │ │Sonnet│ │ Opus │
        │ 4.5  │ │3.5 v2│ │  4   │
        └──────┘ └──────┘ └──────┘
```

The cost labels below are illustrative per-query estimates for typical RAG prompts (~1K input tokens, ~500 output tokens) in this deployment, not fixed model prices. Actual cost depends on input/output tokens, prompt caching, region, and inference configuration.

| Tier | Illustrative per-query cost |
|------|----------------------------|
| Haiku 4.5 | ~$0.001 |
| Sonnet 3.5 v2 | ~$0.01 |
| Opus 4 | ~$0.10 |

Additionally, GPT-5.5 can be exposed as a manual selection option when OpenAI models on Amazon Bedrock are enabled for the account. In this deployment, the manual route is parameterized as `openai.gpt-5-5`, but teams should verify the exact model ID, Region availability, inference profile, and preview access status in their own AWS account.

If the selected model is unavailable or throttled, the router falls back to the next configured tier and emits a `RoutingFallback` metric.

### Implementation

The classifier analyzes query characteristics — keyword count, presence of analytical terms, document references, context size — and routes to the appropriate tier:

```typescript
// complexity-classifier.ts
export function classifyQuery(
  query: string, contextSize: number, threshold: number
): ClassificationResult {
  const features = extractFeatures(query);
  
  if (features.isGreeting || features.wordCount < 5) 
    return { classification: 'simple', confidence: 0.9 };
  if (features.hasAnalyticalTerms || contextSize > threshold) 
    return { classification: 'full-context', confidence: 0.8 };
  return { classification: 'complex', confidence: 0.7 };
}
```

CloudWatch EMF metrics track routing decisions, enabling cost analysis and route distribution monitoring:

```
Namespace: SmartRouting
Metrics: RoutingCount
Dimensions: RoutingTier (simple | complex | full-context | manual)
```

---

## 2. Transfer Family FSx ONTAP Ingestion

### The Problem

Many enterprise partners — law firms, auditors, regulatory bodies — exchange documents via SFTP. They won't adopt a web UI. But their documents still need to flow into the RAG knowledge base with proper permission metadata.

### Prerequisites and Limits

This pattern assumes:
- FSx for ONTAP is running **ONTAP 9.17.1 or later**
- The FSx file system and S3 Access Point are in the **same AWS Region**
- The **same AWS account** owns the file system and access point
- Transfer Family file operations follow the [FSx S3 Access Point compatibility limits](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/access-points-for-fsxn-object-api-support.html), including the **5 GB upload limit** and unsupported rename/append operations

### The Solution: SFTP → S3 Access Point → Bedrock KB

This feature bridges AWS Transfer Family with the existing permission-aware RAG pipeline. The architecture aligns with the approach described in the [AWS Storage Blog](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/) — internal users access data via SMB/NFS, while external partners use SFTP, all reading/writing to the same FSx for ONTAP file system through S3 Access Points.

```
┌──────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Partner │     │ Transfer Family │     │ FSx ONTAP        │
│  (SFTP)  │────▶│ SFTP Server     │────▶│ S3 Access Point  │
└──────────┘     └─────────────────┘     └────────┬─────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  EventBridge Scheduler      │
                                    │  (5-min polling)            │
                                    └──────────────┬──────────────┘
                                                   │
                              ┌─────────────────────▼─────────────────────┐
                              │         Ingestion Trigger Lambda           │
                              │  • ListObjectsV2 → detect changes         │
                              │  • Invoke Metadata Generator (async)       │
                              │  • StartIngestionJob (deduplicated)        │
                              └─────────────────────┬─────────────────────┘
                                                    │
                    ┌───────────────────────────────┬┘
                    ▼                               ▼
        ┌───────────────────┐          ┌────────────────────┐
        │ Metadata Generator│          │ Bedrock KB         │
        │ (.metadata.json)  │          │ StartIngestionJob  │
        └───────────────────┘          └────────────────────┘
```

This remains a polling-based sync path; an event-based CloudTrail/EventBridge mode is listed in What's Next.

### Key Design Decisions

**1. HomeDirectoryMappings uses S3 AP Alias, not ARN**

The [Transfer Family documentation](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html) explains that FSx-backed Transfer Family access uses S3 Access Point aliases, but the failure mode is not obvious: using the full ARN in `HomeDirectoryMappings.Target` produced cryptic access-denied errors in my deployment.

```typescript
// Correct: use alias (e.g., "my-ap-ext-s3alias")
homeDirectoryMappings: [{
  entry: '/',
  target: `/${s3AccessPointAlias}/uploads/${userName}`,
}]
```

**2. Deduplication via IN_PROGRESS check**

Before triggering `StartIngestionJob`, the Lambda checks if a job is already running:

```python
def should_trigger_ingestion(has_changes: bool, current_job_status: Optional[str]) -> bool:
    if not has_changes:
        return False
    if current_job_status == 'IN_PROGRESS':
        return False
    return True
```

**3. Permission metadata auto-generation and trust boundary**

When a new file is detected without a corresponding `.metadata.json`, the Metadata Generator Lambda creates one based on the SFTP user's permission mapping in DynamoDB:

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-14T10:30:00Z"
}
```

The SFTP user does not supply permission metadata directly. The Metadata Generator derives it from an **administrator-managed DynamoDB mapping** and writes `.metadata.json` using a service role. Partner upload roles are scoped to their home directory (`/uploads/{userName}/*`).

> **Security note**: The SFTP user's IAM role includes an explicit `Deny` statement for `s3:PutObject` and `s3:DeleteObject` on `*.metadata.json` keys within their home directory. This prevents partners from overwriting permission metadata generated by the service role.

This integrates seamlessly with the existing permission-filtering RAG pipeline.

### CDK Deployment

```bash
npx cdk deploy --all \
  -c enableTransferFamily=true \
  -c s3AccessPointArn="arn:aws:s3:ap-northeast-1:ACCOUNT:accesspoint/my-ap" \
  -c transferFamilyS3ApAlias="my-ap-ext-s3alias"
```

---

## 3. KB Auto-Sync

### The Problem

Documents on FSx for ONTAP change continuously — new files added, existing files updated. Without automatic synchronization, the Bedrock Knowledge Base becomes stale.

### The Solution

A lightweight Lambda (Python 3.12) polls the S3 Access Point every 5 minutes, compares against a DynamoDB inventory, and triggers `StartIngestionJob` only when changes are detected. The inventory is updated after `StartIngestionJob` is accepted (i.e., a `job_id` is returned). A future enhancement will move this to a pending/commit model so ingestion jobs that fail after start do not hide changes from the next scan:

```python
# Scan → Diff → Start job → Update inventory (on job accepted)
current_files = scan_s3_access_point(s3_ap_arn)
previous = get_inventory(table)
diff = compute_diff(current_files, previous)

if diff.has_changes:
    job_id = trigger_ingestion_if_needed(kb_id, ds_id, diff)
    if job_id:
        # Inventory updated after StartIngestionJob is accepted.
        # Future: move to pending/commit model keyed on job SUCCEEDED.
        update_inventory(table, current_files, previous, job_id)
```

Enable with a single context parameter:

```bash
npx cdk deploy --all -c enableKbAutoSync=true
```

---

## 4. Capacity Guardrails

### The Problem

The FSx ONTAP operations automation (volume resize, snapshot management) can be dangerous if triggered too frequently — especially during incidents where monitoring alerts cascade.

### The Solution

A guardrails module that enforces:
- **Per-action rate limit**: Max N executions per action per time window
- **Daily cap**: Maximum total operations per day
- **Cooldown**: Minimum interval between consecutive executions of the same action

```python
@with_guardrails(action_name="volume_resize", max_per_hour=3, daily_cap=10, cooldown_seconds=300)
def resize_volume(volume_id: str, new_size_gb: int):
    # Only executes if guardrails pass
    ...
```

State is tracked in DynamoDB with TTL-based cleanup. The `update_item` call uses a `ConditionExpression` (`attribute_not_exists(action_count) OR action_count < :max_actions`) to prevent concurrent requests from bypassing the daily cap. Concurrent resize requests can still succeed while capacity remains under the configured cap, but the conditional update prevents them from collectively exceeding it. CloudWatch metrics expose guardrail rejections for operational visibility.

---

## 5. Voice Chat WebRTC (Phase 2)

### The Problem

Knowledge workers often want to ask questions hands-free — during meetings, while reviewing physical documents, or when multitasking.

### The Solution

A Strategy pattern implementation supporting both REST-based (Phase 1) and WebRTC-based (Phase 2) voice interaction:

```typescript
interface VoiceSessionStrategy {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendAudio(data: ArrayBuffer): Promise<void>;
  onTranscript(callback: (text: string) => void): void;
}
```

Phase 2 uses:
- **Amazon Kinesis Video Streams** Signaling Channel for WebRTC negotiation
- **Pipecat Voice Agent** on Bedrock AgentCore Runtime for speech-to-text-to-RAG-to-speech
- **Automatic fallback**: If WebRTC connection fails, seamlessly falls back to REST-based voice

Phase 2 implements the client/server strategy and fallback behavior; full AgentCore Runtime deployment automation remains in What's Next.

The WebRTC path is implemented behind the existing voice strategy interface, but production deployments should add authentication, rate limiting, CORS tightening, sanitized logging, and input validation around the signaling and session launch APIs — as noted in the [Pipecat AgentCore WebRTC KVS example](https://github.com/pipecat-ai/pipecat-examples/tree/main/deployment/aws-agentcore-webrtc-kvs).

---

## Testing Strategy

All features are backed by comprehensive tests:

| Category | Framework | Tests |
|----------|-----------|-------|
| CDK Assertion | Jest + aws-cdk-lib/assertions | 42 |
| Python Lambda Unit | pytest + moto | 85 |
| Property-Based | Hypothesis (Python) | 6 |
| Property-Based | fast-check (TypeScript) | 12 |
| Voice WebRTC | Jest | 61 |
| Smart Routing | Jest + fast-check | 64 |

The Hypothesis property-based tests verify invariants like:
- Change detection correctly classifies new/changed/unchanged files for any input combination
- Ingestion deduplication logic is correct for all (changes × job_status) combinations
- Metadata JSON always conforms to the required schema regardless of input permissions

---

## Security & Portability

Before publishing, we ensured:

1. **No hardcoded AWS account IDs** in any public source file
2. **Parameterized ECR repository name** (`ecrRepositoryName` CDK prop)
3. **Parameterized REGION** in all shell scripts (`${AWS_REGION:-ap-northeast-1}`)
4. **Masked screenshots** — AWS account IDs in console screenshots are covered
5. **`.gitignore` coverage** — `cdk.context.json`, `cdk.out/`, `.env`, `.hypothesis/` all excluded

---

## What's Next

- **AgentCore Runtime deployment** for the Pipecat Voice Agent (currently requires CLI — CloudFormation support pending)
- **CloudTrail/EventBridge mode** for Transfer Family ingestion (near-real-time event-based detection instead of 5-minute polling)
- **End-to-end SFTP upload test** with actual SSH keys and partner simulation

---

## End-to-End Architecture Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────────────┐
│ External     │     │ Transfer Family │     │ FSx for ONTAP            │
│ Partner      │────▶│ SFTP Server     │────▶│ S3 Access Point          │
│ (SFTP)       │     └─────────────────┘     │ (data stays on FSxN)     │
└──────────────┘                             └─────────────┬────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │ Metadata Generator Lambda   │
                                            │ (admin-managed permissions) │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │ KB Auto-Sync / Ingestion    │
                                            │ Trigger Lambda              │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │ Amazon Bedrock              │
                                            │ Knowledge Base              │
                                            └──────────────┬──────────────┘
                                                           │
┌──────────────┐     ┌─────────────────┐     ┌─────────────▼────────────┐
│ End User     │────▶│ Smart Routing   │────▶│ Permission-Aware RAG     │
│ (Chat/Voice) │     │ (Haiku/Sonnet/  │     │ (fail-closed: missing    │
└──────────────┘     │  Opus)          │     │  metadata = excluded)    │
                     └─────────────────┘     └──────────────────────────┘
```

The RAG retrieval path is designed to fail closed: if permission metadata is missing, malformed, or unverifiable for a document, that document is excluded from retrieval results rather than exposed broadly. This fail-closed behavior is the core safety boundary of the permission-aware RAG design: a document without trusted metadata is treated as not retrievable.

---

## Known Limitations

v4.2 is production-oriented, but a few items remain follow-up work:

- **KB Auto-Sync** currently updates inventory when `StartIngestionJob` is accepted rather than when the job reaches `SUCCEEDED`. Failed ingestion jobs may mask unprocessed changes until the pending/commit model is implemented.
- **Transfer Family ingestion** is implemented and unit-tested; full partner-style E2E validation with SSH keys is still planned. The current auto-sync path focuses on detecting additions and updates — delete reconciliation is follow-up work.
- **AgentCore Runtime** deployment automation is not yet CloudFormation-based; the Pipecat Voice Agent requires CLI/SDK deployment.
- **Voice sessions** require production policies for authentication, rate limiting, transcript retention, and sanitized logging before production rollout.
- **Smart Routing** emits routing metrics, but monthly cost dashboards, budget enforcement, and savings-vs-baseline reporting are follow-up work.
- **Fail-closed enforcement** happens in the retrieval filtering layer: documents without valid, trusted permission metadata are excluded before the model receives context. Audit events for retrieval decisions (`DocumentSuppressedByPermission`) are candidates for the next release.

Manual high-cost or preview model selection (GPT-5.5) should be governed by application-level authorization and audited separately from automatic routing. The networking model — public Transfer Family endpoint vs VPC-hosted endpoint, partner IP allowlists, and private DNS requirements — should be selected per customer environment.

---

## Who Should Care About v4.2?

- **AI platform teams** get model routing that balances quality and cost without manual intervention.
- **Security teams** get administrator-derived permission metadata and explicit IAM protection against metadata overwrite.
- **Data teams** get automatic KB synchronization from FSx for ONTAP through S3 Access Points.
- **Partners and SIs** get an SFTP-to-RAG ingestion path for customers who exchange documents with external organizations.
- **Operations teams** get guardrails for FSx ONTAP automation actions with conditional write protection.
- **Application teams** get a WebRTC voice strategy with REST fallback.

---

## Conclusion

v4.2 moves the permission-aware RAG system from a secure document Q&A application toward an enterprise ingestion and interaction platform.

Smart Routing reduces model cost without removing access to stronger models. Transfer Family ingestion lets partners keep using SFTP while documents land directly on FSx for ONTAP through S3 Access Points. KB Auto-Sync keeps Bedrock Knowledge Bases fresh, Capacity Guardrails make ONTAP automation safer, and WebRTC Voice Chat opens a lower-friction interaction path.

The common theme is the same as the FSx for ONTAP S3 Access Points pattern series: keep enterprise file data on FSx for ONTAP, expose it safely through S3-compatible access paths, and automate around it with serverless and managed AWS services.

---

## Resources

- **GitHub**: [FSx-for-ONTAP-Agentic-Access-Aware-RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG)
- **Release**: [v4.2.0](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/releases/tag/v4.2.0)
- **Related series**: [FSx for ONTAP S3 Access Points Serverless Patterns](https://dev.to/yoshikifujiwara/fpolicy-event-driven-pipeline-multi-account-stacksets-and-cost-optimization-fsx-for-ontap-s3-5bd6)
- **AWS Blog**: [Secure SFTP file sharing with AWS Transfer Family, Amazon FSx for NetApp ONTAP, and S3 Access Points](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
- **AWS Docs**: [Access your FSx for NetApp ONTAP file systems with Transfer Family](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)


---

## Update: Enterprise Readiness Guides Added

Based on feedback from AWS solution architecture perspectives (storage, partner/SaaS, public sector/healthcare, and generative AI/business value), I added a set of enterprise readiness documents covering:

- **[Production readiness checklist](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/production-readiness-checklist.md)** — Demo/PoC/Production maturity levels with security, audit, DR, and operations checklists
- **[Permission consistency and cache invalidation model](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/permission-consistency.md)** — ACL change propagation flow, max delay (RPO-style), emergency revocation procedure
- **[FSx for ONTAP sizing and performance guide](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/fsxn-sizing-and-performance.md)** — Scale-based configurations (10K/100K/1M files), S3 AP considerations, QoS design
- **[Partner / SaaS deployment patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/partner-deployment-patterns.md)** — Multi-tenant isolation (account/SVM/hybrid), cost estimation templates
- **[Governance and audit log design](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/governance-and-audit.md)** — Audit log schema (JSON), Responsible AI, Guardrails policy examples, industry use cases (healthcare, government, finance, education)
- **[RAG and Agent evaluation metrics](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/evaluation.md)** — 4-axis evaluation framework with PoC report template
- **[Safe experimentation guide](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/en/safe-experimentation-guide.md)** — Safe scope definition, prohibited actions, rollback procedures

I also added a **[permission test suite](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/tree/main/tests/permission-matrix)** (31 scenarios) covering ACL filtering, group nesting, inherited permissions, fail-closed behavior, permission propagation, and edge cases — all passing.

All documentation is available in 8 languages (Japanese, English, Korean, Simplified Chinese, Traditional Chinese, French, German, Spanish).

---

## Update: Industry Demo Data Packs

I also added **[industry-specific demo data packs](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/tree/main/demo-data/industry-packs)** covering 8 sectors (35 documents with permission metadata):

| Sector | Documents | Permission Groups | S3AP UC |
|--------|-----------|-------------------|---------|
| Government | 5 | 政策企画課, 財政課, 危機管理課 | UC16 |
| Healthcare | 5 | 内科, 看護部, 薬剤部 | UC5 |
| Legal | 5 | 法務部 | UC1 |
| Manufacturing | 5 | 品質管理部, 生産管理部 | UC3 |
| Construction | 5 | 設計部, 工事管理部 | UC10 |
| Education | 5 | 研究室, 教務課 | UC13 |
| Insurance | 5 | 損害査定部, 不正対策室 | UC14 |

Each pack demonstrates department-level access control with realistic Japanese business documents. The packs integrate with the [FSx for ONTAP S3AP Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) repository — processing results from those 17 UCs can be used as RAG search sources in this project.
