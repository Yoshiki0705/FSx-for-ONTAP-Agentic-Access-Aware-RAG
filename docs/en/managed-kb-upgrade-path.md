# Amazon Bedrock Managed Knowledge Base Upgrade Path (Validation Procedures)

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | **English** | [한국어](../ko/managed-kb-upgrade-path.md) | [简体中文](../zh-CN/managed-kb-upgrade-path.md) | [繁體中文](../zh-TW/managed-kb-upgrade-path.md) | [Français](../fr/managed-kb-upgrade-path.md) | [Deutsch](../de/managed-kb-upgrade-path.md) | [Español](../es/managed-kb-upgrade-path.md)

**Created**: 2026-06-18
**Target Region**: ap-northeast-1 (Tokyo) — Managed KB is available in the Tokyo region (GA 2026-06-17)
**Status**: Validation procedure document (migration not implemented / existing path maintained)
**Related**: [Managed KB Migration Evaluation](managed-kb-migration-evaluation.md) (decision criteria / trade-offs)

---

## 0. Purpose of This Document

This document translates the validation points organized in [Managed KB Migration Evaluation](managed-kb-migration-evaluation.md) into **actionable validation procedures**. Refer to the migration evaluation document for the discussion of decision criteria and trade-offs; this document focuses on "how to validate."

Important assumptions:

- This document is a **validation procedure guide** and does not recommend immediate migration.
- The existing path (Bedrock KB + OpenSearch Serverless / S3 Vectors) is **not removed**. This is additional validation of a parallel option.
- Managed KB is not "superior" to the conventional KB. It is a **right tool for the job** choice; whether it can meet this project's primary requirement of Permission-aware RAG (strict ACL enforcement) determines migration feasibility.
- Evidence tiers for the content below are classified as follows.

| Tier | Definition | Treatment in this document |
|------|-----------|----------------------------|
| Public evidence | Verifiable from AWS official docs / blogs | Cited with source links |
| Project-context expectation | Design decisions / expectations within this project (not publicly verifiable) | Explicitly labeled "this project's assumption" |

> ⚠️ **Validation Required**: The procedures in this document include the **assumption** that the AWS official tutorial ([for conventional KB](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)) is reinterpreted for Managed KB. Whether the Managed KB S3 connector recognizes the FSx for ONTAP S3 Access Point is officially unconfirmed, and validation V1 must verify this first.

---

## 1. Validation Overview

Validation for the migration feasibility decision consists of the following 3 phases. Each phase assumes the success of the previous one.

```
Phase A: Connection validation (V1, V2)
  └─ Can S3 AP be used as a data source / is metadata preserved
       │ PASS
       ▼
Phase B: Authorization validation (V3, V4, V5)
  └─ Does the ACL filter work / is it maintained through multi-hop / propagation latency
       │ PASS
       ▼
Phase C: Audit & operations validation (V6, V7)
  └─ lineage recording / ACL on conversation history & cache
       │ PASS
       ▼
Migration feasibility decision (→ Migration Evaluation doc §5)
```

> Every phase is performed against a **FlexClone-created validation volume, not production data** (see §4).

---

## 2. Phase A: S3 Access Point Data Source Connection Validation

### 2.1 Validation V1: Does the S3 Connector Recognize the S3 AP URI?

⚠️ **Validation Required**: The official tutorial is for the conventional KB, and whether the Managed KB S3 connector accepts the S3 AP alias-format URI is unconfirmed.

**Prerequisites**:

1. Create a validation volume with FlexClone (procedure in §4)
2. Create an S3 Access Point for the validation volume (refer to the logic in the existing `setup-kb-datasource.sh`)
3. Confirm the S3 AP alias (format: `<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` or ARN)

**Validation procedure**:

```bash
# 1. Create a Managed KB (managed vector storage)
#    ⚠️ The following is an assumed command. Verify the exact Managed KB API parameters in the GA documentation
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ The way to specify managed storage needs confirmation

# 2. Add the S3 connector as a data source and specify the S3 AP URI
#    Core of validation: whether the S3 AP alias / ARN format is accepted
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ Whether this is accepted is the essence of V1
    }
  }'
```

**Judgment criteria**:

| Result | Judgment | Next action |
|--------|----------|-------------|
| S3 AP ARN/alias accepted, sync succeeds | ✅ PASS | Proceed to V2 |
| S3 AP not possible but a normal S3 bucket works | △ Conditional | Consider a DataSync-based S3 relay path (additional validation needed for ACL metadata preservation) |
| S3 connector sync itself fails | ❌ FAIL | Migration not feasible. Maintain current configuration |

> **This project's assumption**: We assume connection is possible if the S3-compatible API works, but S3 AP-specific constraints (such as the ListObjectsV2 latency noted in the [FSx for ONTAP S3 AP compatibility matrix](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)) may affect the Managed KB crawler.

### 2.2 Validation V2: Metadata Preservation

**Validation procedure**:

1. Place `.metadata.json` (containing `allowed_group_sids`) on the validation volume
2. Run the Managed KB sync
3. Retrieve a document via the `Retrieve` API and check whether the metadata is included in the response

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "test query"}' \
  --region ap-northeast-1
# Check whether the metadata field of the response includes allowed_group_sids
```

**Judgment criteria**:

| Result | Judgment |
|--------|----------|
| `allowed_group_sids` is preserved as metadata and retrievable | ✅ PASS → Proceed to Phase B |
| Metadata is missing or converted to a different format | ❌ FAIL → ACL filter not possible. Maintain current configuration |

> ⚠️ How Managed KB Smart Parsing handles metadata is unconfirmed. Verify whether the `.metadata.json` sidecar approach works the same as the conventional KB, or whether a different metadata attribution method (connector attributes, etc.) is required.

---

## 3. Phase B: Permission-aware RAG Design Challenge Validation

This project's primary purpose is Permission-aware RAG, and strict ACL enforcement is a non-negotiable requirement. Unless Phase B validation is cleared, maintaining the current configuration remains the default policy.

### 3.1 Invariant with the Existing Approach

The current implementation uses a [vector-store-independent approach](s3-vectors-sid-architecture-guide.md).

```
Bedrock KB Retrieve → search results + allowed_group_sids
→ App side (route.ts) matches user SID ∩ document SID (Fail-Closed)
→ Only matched documents go to the Converse API
```

**Invariant to maintain during migration**: "Enforce final authorization on the app side, and deny all if SID retrieval is impossible (Fail-Closed)." Verify that Managed KB does not break this invariant.

### 3.2 Validation V3: SID Array Matching via `listContains`

According to the [AgentCore Gateway connector target documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html), the Managed KB `Retrieve` tool supports the `listContains` operator in `managedSearchConfiguration.filter` (summarized from the source).

**Validation procedure**:

```bash
# Retrieve only documents where the user's SID is in the allowed_group_sids array
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "confidential document test"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**Judgment criteria**:

| Test case | Expected result |
|-----------|-----------------|
| Document where user SID is in the array | Retrieved |
| Document where user SID is not in the array | Excluded |
| Document missing `allowed_group_sids` | Excluded (Fail-Closed) |

> ⚠️ **Important**: Even if `listContains` filters at the retrieval layer, this project's design principle is **re-authorization on the app side**. We recommend a two-layer defense that uses the Managed KB filter as a "primary filter" while maintaining final authorization on the app side (do not depend on the filter alone).

### 3.3 Validation V4: Filter Maintenance During Agentic Retrieval Multi-hop

This is the greatest Managed KB-specific risk. `AgenticRetrieveStream` decomposes a query into subqueries and iterates multiple searches. **If the metadata filter is not maintained at each hop, unauthorized data can be mixed in at an intermediate step.**

**Validation procedure**:

1. Prepare a complex query that requires spanning multiple documents with different permissions (e.g., "Compare Department A's confidential design document with the public specification")
2. Run `AgenticRetrieveStream` as a user who cannot access the unauthorized document (Department A confidential)
3. Inspect the trace of each hop (CloudWatch / intermediate steps in the response) and verify that the unauthorized document is **not referenced at any hop**

**Judgment criteria**:

| Result | Judgment |
|--------|----------|
| `userContext` / filter applied at all hops, no unauthorized data referenced | ✅ PASS |
| Filter drops at an intermediate hop and unauthorized data mixes in | ❌ FAIL → Disable multi-hop, use single `Retrieve` only |

> ⚠️ **Validation Required**: Filter propagation to each multi-hop step is not officially documented. If it cannot be confirmed in validation, restrict to single `Retrieve` + app-side matching without using `AgenticRetrieveStream` (prioritize ACL guarantees even at the cost of giving up the multi-hop benefit).

### 3.4 Validation V5: Permission Change / Deletion Propagation Latency

**Validation procedure**:

1. Remove a user's SID from a group (or change a document's `allowed_group_sids`)
2. After the Managed KB sync completes, re-search as that user
3. Measure the latency until the old-permission data no longer returns

**Judgment criteria**: Whether the propagation latency is within the acceptable range defined in this project's [permission consistency model](permission-consistency.md). If out of range, the design must separately guarantee emergency revocation via app-side cache invalidation.

---

## 4. Safe Validation Pattern Using FlexClone

Production data must never be made a direct crawl target of the Managed KB. Create a production-equivalent validation volume with FlexClone and validate in an isolated environment.

### 4.1 Why FlexClone

| Aspect | Direct production access | FlexClone validation |
|--------|--------------------------|----------------------|
| Impact on production I/O | Crawl load affects business workloads | No impact (clone is independent) |
| Data consistency | Possible inconsistency from updates during crawl | Consistent at point-in-time |
| Reproducibility of validation | Hard to reproduce due to production data changes | Reproducible any number of times from the same snapshot |
| Risk of accidents | Risk of erroneous writes to production data | Clone is disposable |
| Cost | — | Snapshot delta only (initially a few MB) |

### 4.2 Validation Clone Creation Procedure

```bash
# 1. Create a snapshot of the production volume (ONTAP REST API / CLI)
#    ⚠️ Access the ONTAP management endpoint from within the VPC
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. Create a FlexClone from the snapshot
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. Create an S3 Access Point for the clone volume
#    (Reuse the logic of the existing setup-kb-datasource.sh for validation)

# 4. After validation completes, destroy the clone (no impact on production)
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> For the exact ONTAP REST API parameters, refer to the ONTAP operations section of the [Operations Runbook](operations-runbook.md). Follow the production procedures for SSH key / management endpoint information.

### 4.3 Validation Environment Isolation Principles

- Create the validation Managed KB as a **separate resource** from the production KB; do not change the production KB ID
- The validation S3 AP points only to the validation clone (does not reference the production volume)
- Scope the validation IAM role with **least privilege** to the validation resources (do not grant read access to production data)
- After validation completes, destroy all of the clone / KB / S3 AP / IAM role

---

## 5. Audit & Lineage Validation (Phase C / Optional)

⚠️ **Validation Required**: Whether access via Managed KB is recorded in the Unity Catalog lineage of the integration target ([fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)) is unconfirmed.

**Validation aspects**:

- Whether Managed KB `Retrieve` / `AgenticRetrieveStream` calls are recorded in CloudTrail
- Whether "who, when, used information from which document, in which response" is traceable
- Whether ACL application to conversation history / cache is maintained on the app side (since the Managed-side cache behavior is unknown, control it explicitly on the app side)

For details of audit requirements, see [Governance & Audit Design](governance-and-audit.md).

---

## 6. Validation Checklist (Summary)

Clear all of the following before the migration feasibility decision.

- [ ] **V1**: S3 connector recognizes FSx for ONTAP S3 AP (Phase A)
- [ ] **V2**: `allowed_group_sids` is preserved as metadata (Phase A)
- [ ] **V3**: `listContains` SID array matching works (Phase B)
- [ ] **V4**: Filter maintained during Agentic Retrieval multi-hop (Phase B)
- [ ] **V5**: Permission change / deletion propagation latency within acceptable range (Phase B)
- [ ] **V6**: Recorded in CloudTrail / lineage (Phase C)
- [ ] **V7**: ACL application to conversation history / cache maintained (Phase C)
- [ ] All validation performed on a **FlexClone validation volume** (no production impact)
- [ ] App-side Fail-Closed re-authorization invariant maintained

> If any item FAILs, unless there is a design supplement that can tolerate that risk, **maintaining the current configuration (OpenSearch Serverless / S3 Vectors)** remains the default policy. Managed KB integration into the CDK stack begins only after all validation is cleared.

---

## 7. Related Documents

| Document | Content |
|----------|---------|
| [Managed KB Migration Evaluation](managed-kb-migration-evaluation.md) | Decision criteria / trade-offs / existing configuration comparison |
| [CDK Stack Architecture Guide](stack-architecture-comparison.md) | Vector store configuration comparison (incl. Managed KB column) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID filtering design |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | Vector-store-independent authorization approach |
| [Permission Consistency Model](permission-consistency.md) | ACL change propagation flow / acceptable latency |
| [Governance & Audit Design](governance-and-audit.md) | Audit log / lineage requirements |
| [Operations Runbook](operations-runbook.md) | ONTAP operations (FlexClone creation procedure) |

---

## Reference Links

- [Amazon Bedrock Managed Knowledge Base GA announcement](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [AWS official tutorial (conventional KB)](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [AgentCore Gateway connector target (Managed KB)](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> Content was rephrased for compliance with licensing restrictions. AWS official information is summarized and paraphrased while preserving the intent of the sources.
