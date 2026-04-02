# S3 Vectors + SID Filtering Architecture Guide

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | **English** | [한국어](../ko/s3-vectors-sid-architecture-guide.md) | [简体中文](../zh-CN/s3-vectors-sid-architecture-guide.md) | [繁體中文](../zh-TW/s3-vectors-sid-architecture-guide.md) | [Français](../fr/s3-vectors-sid-architecture-guide.md) | [Deutsch](../de/s3-vectors-sid-architecture-guide.md) | [Español](../es/s3-vectors-sid-architecture-guide.md)

**Created**: 2026-03-29
**Verification Environment**: ap-northeast-1 (Tokyo)
**Status**: CDK deployment verified, SID filtering verified

---

## Overview

This document summarizes the architectural decisions for adopting Amazon S3 Vectors as the vector store for a Permission-aware RAG system, along with integration patterns for SID-based access control. It includes verification results and recommendations in response to expert feedback.

---

## Evaluation of SID Filtering Patterns

### Current Approach in This System

This system uses the Bedrock KB Retrieve API to perform vector searches and matches the `allowed_group_sids` field in the returned metadata on the application side. This approach is vector store agnostic.

```
Bedrock KB Retrieve API → Search results + Metadata (allowed_group_sids)
→ Application-side matching: User SID ∩ Document SID
→ Call Converse API only with matched documents
```

### Pattern A: Attach SID as Filterable Metadata (Recommended Pattern)

Since all metadata in S3 Vectors is filterable by default, `allowed_group_sids` can be filtered without additional configuration.

#### Application in This System

Since this system accesses S3 Vectors through Bedrock KB, the `QueryVectors` filter parameter cannot be directly controlled. The Bedrock KB Retrieve API performs the vector search and returns results including metadata. SID filtering is performed on the application side.

Advantages of this approach:
- The Bedrock KB Retrieve API is vector store agnostic, so the same application code works with both S3 Vectors and AOSS
- `allowed_group_sids` from `.metadata.json` is stored and returned as-is as metadata
- The application-side SID filtering logic (`route.ts`) requires no changes

#### Response to Expert Feedback

> Please ensure through testing that the application always applies the SID filter. S3 Vectors metadata filter is convenient, but it is not a substitute for access control itself.

This system ensures this through the following:
1. SID filtering is built into the KB Retrieve API route (`route.ts`) and cannot be bypassed
2. If SID information cannot be retrieved from DynamoDB, all documents are denied (Fail-Closed principle)
3. Property-based testing (Property 5) has verified the vector store independence of SID filtering

### Pattern B: Index Separation per SID/Tenant

#### Evaluation for This System

The SIDs in this system are group SIDs based on Active Directory NTFS ACL, and multiple SIDs are assigned per document (e.g., `["S-1-5-21-...-512", "S-1-1-0"]`). Separating indexes per SID is inappropriate for the following reasons:

1. **Many-to-many SID relationships**: A single document belongs to multiple SID groups, and a single user has multiple SIDs. Index separation would require duplicate document storage
2. **Dynamic SID count changes**: The number of SIDs fluctuates as AD groups are added or modified. Index management becomes complex
3. **10,000 indexes/bucket limit**: In large-scale AD environments, the number of SIDs may approach this limit

#### Hybrid Design Consideration

As experts pointed out, a hybrid design that separates indexes by tenant/customer and uses SID filter within each index is effective. Since this system assumes a single tenant (single AD environment), index separation is not needed at this time. This will be considered when extending to multi-tenant.

---

## Migration Checklist Verification Results

### 1. Embedding Model / Dimension / Metric Verification

| Item | Current (AOSS) | S3 Vectors | Compatibility |
|------|----------------|-----------|---------------|
| Embedding Model | Amazon Titan Embed Text v2 | Same | ✅ |
| Dimension | 1024 | 1024 | ✅ |
| Distance Metric | l2 (AOSS/faiss) | cosine (S3 Vectors) | ⚠️ Needs verification |
| Data Type | - | float32 (required) | ✅ |

> **Note**: The current AOSS uses l2 (Euclidean distance), while S3 Vectors uses cosine. Since Bedrock KB manages the consistency between embedding and metric, there is no issue when accessing through KB. However, be aware of the metric difference when using the S3 Vectors API directly. S3 Vectors does not allow changing dimension and metric after index creation.

### 2. Metadata Design

| Metadata Key | Purpose | Filterable | Notes |
|-------------|---------|-----------|-------|
| `allowed_group_sids` | SID filtering | non-filterable recommended | S3 Vectors filter is not needed since application-side filtering is done via Bedrock KB Retrieve API |
| `access_level` | Access level display | non-filterable recommended | For UI display |
| `doc_type` | Document type | non-filterable recommended | For future filtering |
| `source_uri` | Source file path | non-filterable | Not searchable, reference only |
| `chunk_text` | Chunk text | non-filterable | Not searchable, large data |

#### S3 Vectors Metadata Constraints (Actual Values Discovered During Verification)

| Constraint | Nominal Value | Effective Value with Bedrock KB | Mitigation |
|-----------|---------------|-------------------------------|------------|
| Filterable metadata | 2KB/vector | **Custom metadata up to 1KB** (remaining 1KB consumed by Bedrock KB internal metadata) | Minimize custom metadata |
| Non-filterable metadata keys | Max 10 keys/index | 10 keys (5 Bedrock KB auto keys + 5 custom keys) | Prioritize Bedrock KB auto keys as non-filterable |
| Total metadata keys | Max 50 keys/vector | 35 keys (when using Bedrock KB) | No issue |

#### Metadata Keys Automatically Added by Bedrock KB

The following keys are automatically stored by Bedrock KB in S3 Vectors. If not included in `nonFilterableMetadataKeys`, they are treated as filterable and consume the 2KB limit.

| Key | Description | non-filterable Recommended |
|-----|-------------|---------------------------|
| `x-amz-bedrock-kb-source-file-modality` | File type (TEXT, etc.) | ✅ |
| `x-amz-bedrock-kb-chunk-id` | Chunk ID (UUID) | ✅ |
| `x-amz-bedrock-kb-data-source-id` | Data source ID | ✅ |
| `x-amz-bedrock-kb-source-uri` | Source URI | ✅ |
| `x-amz-bedrock-kb-document-page-number` | PDF page number | ✅ |

> **Important**: Filterable metadata may exceed 2KB due to PDF page number metadata, etc. Include all Bedrock KB auto keys in `nonFilterableMetadataKeys` and make custom metadata non-filterable as much as possible.

### 3. Pre-Verification of Insufficient Permissions

Required IAM actions confirmed through verification:

```
KB Role (for Bedrock KB):
  s3vectors:QueryVectors   ← Required for search
  s3vectors:PutVectors     ← Required for data sync
  s3vectors:DeleteVectors  ← Required for data sync
  s3vectors:GetVectors     ← Required for metadata retrieval (as experts pointed out)
  s3vectors:ListVectors    ← Found to be required during verification

Custom Resource Lambda (for resource management):
  s3vectors:CreateVectorBucket
  s3vectors:DeleteVectorBucket
  s3vectors:CreateIndex
  s3vectors:DeleteIndex
  s3vectors:ListVectorBuckets
  s3vectors:GetVectorBucket
  s3vectors:ListIndexes
  s3vectors:GetIndex
```

> **Discovered during verification**: Not only `s3vectors:GetVectors` but also `s3vectors:ListVectors` is required for the KB Role. Missing it causes a 403 error.

### 4. Performance Verification

> **Status**: CDK deployment verification complete. Retrieve API latency verification complete.

S3 Vectors nominal performance:
- Cold query: Sub-second (within 1 second)
- Warm query: ~100ms or less
- High-frequency queries: Reduced latency

Retrieve API verification results (2 documents, ap-northeast-1):
- Confirmed that Bedrock KB Retrieve API correctly returns SID metadata (`allowed_group_sids`)
- Public document: `allowed_group_sids: ["S-1-1-0"]` (Everyone SID)
- Confidential document: `allowed_group_sids: ["S-1-5-21-...-512"]` (Domain Admins SID)
- Custom metadata such as `access_level` and `doc_type` are also correctly returned
- Existing SID filtering logic (`route.ts`) works without modification

### 5. Phased Migration Design

This system supports phased migration through switching via the CDK context parameter `vectorStoreType`:

1. **Phase 1**: New deployment with `vectorStoreType=s3vectors` (verification environment) ← Currently here
2. **Phase 2**: Data source addition/sync, SID metadata retrieval verification via Retrieve API
3. **Phase 3**: Performance verification (latency, concurrency)
4. **Phase 4**: Decision on production environment adoption

Migration from AOSS to S3 Vectors can be achieved by re-syncing the Bedrock KB data source (vector data is auto-generated by KB, so manual migration is unnecessary).

---

## CDK Deployment Verification Results

### Verification Environment

- Region: ap-northeast-1 (Tokyo)
- Stack names: s3v-test-val-AI (standalone verification), perm-rag-demo-demo-* (full stack verification)
- vectorStoreType: s3vectors
- Deployment time: AI stack standalone ~83 seconds, full stack (6 stacks) ~30 minutes

### Full Stack E2E Verification Results (2026-03-30)

E2E verification of the S3 Vectors configuration was performed with all 6 stacks deployed (Networking, Security, Storage, AI, WebApp + WAF).

#### SID Filtering Operation Verification

| User | SID | Question | Referenced Documents | Result |
|------|-----|----------|---------------------|--------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "Tell me about the company's sales" | confidential/financial-report.txt + public/product-catalog.txt (2 docs) | ✅ Response includes 15 billion yen sales information |
| user@example.com | Regular User (-1001) + Everyone (S-1-1-0) | "Tell me about the company's sales" | public/product-catalog.txt (1 doc only) | ✅ No sales information (confidential document correctly excluded) |

#### Agent Mode Verification (admin@example.com)

| Test | Question | Result |
|------|----------|--------|
| KB search via Agent Action Group | "Tell me about the company's sales" | ✅ Response includes 15 billion yen sales information. Agent calls Retrieve API via Permission-aware Search Action Group and generates response from SID-filtered results |

Agent mode lessons:
- Bedrock Agent Action Group uses the Bedrock KB Retrieve API, so it is independent of the vector store type (S3 Vectors / AOSS)
- Agent created via CDK (`enableAgent=true`) operates normally in PREPARED state even with S3 Vectors configuration
- SID filtering via Agent uses the same logic as KB mode (`route.ts` hybrid approach)

#### Additional Lessons Discovered During Verification

| # | Lesson | Impact |
|---|--------|--------|
| 1 | Application sends email address as userId instead of Cognito sub | DynamoDB keys need to be registered with email addresses |
| 2 | SVM AD join requires AD port opening in VPC security group | Ports 636, 135, 464, 3268-3269, 1024-65535 need to be added to FSx SG. Requires update in CDK NetworkingStack |
| 3 | Missing `@aws-sdk/client-scheduler` dependency | Caused by feature additions in other threads. Resolved by adding to package.json |
| 4 | SVM AD join requires OU specification | For AWS Managed AD, `OrganizationalUnitDistinguishedName` must specify `OU=Computers,OU=<ShortName>,DC=<domain>,DC=<tld>` |
| 5 | FSx ONTAP S3 AP access requires bucket policy configuration | SSO assumed role cannot access S3 AP by default. Both S3 AP policy (`s3:*`) + IAM identity-based policy (S3 AP ARN pattern) are required. Additionally, files must exist on the volume and NTFS ACL must allow access (dual-layer authorization) |
| 6 | FSx ONTAP S3 AP uses a dual-layer authorization model | Both IAM authentication (S3 AP policy + identity-based policy) and file system authentication (NTFS ACL) are required. AccessDenied also occurs when the volume is empty or CIFS share is not created |
| 7 | FSx ONTAP admin password is separate from CDK AD password | The FSx ONTAP `fsxadmin` password is auto-generated at file system creation. This password is required for CIFS share creation via ONTAP REST API. Either set `FsxAdminPassword` in CDK or set it later with `update-file-system` |
| 8 | FSx ONTAP S3 AP AccessDenied issue | **Root cause identified: Organization SCP**. S3 AP access succeeds in old account (no Organization SCP restrictions). AccessDenied in new account (with Organization SCP restrictions). SCP modification required in Organization management account |
| 9 | S3 Vectors filterable metadata 2KB limit | With Bedrock KB + S3 Vectors, custom metadata is limited to **1KB** (not the standalone S3 Vectors 2KB, as Bedrock KB internal metadata consumes the remaining 1KB). Additionally, metadata keys auto-added by Bedrock KB (`x-amz-bedrock-kb-chunk-id`, `x-amz-bedrock-kb-data-source-id`, `x-amz-bedrock-kb-source-file-modality`, `x-amz-bedrock-kb-document-page-number`, etc.) are treated as filterable, and PDF page number metadata may exceed the 2KB limit. Even specifying all metadata keys in `nonFilterableMetadataKeys` (max 10 keys) may not be sufficient when there are many Bedrock KB auto-added keys. **Mitigation**: (1) Minimize metadata keys (only `sids`, short values), (2) Use PDF files without metadata, (3) S3 bucket fallback path verified with no issues in new account (no 2KB limit with AOSS configuration) |

#### FSx ONTAP S3 AP Path Verification Status

| Step | Status | Notes |
|------|--------|-------|
| SVM AD join | ✅ Complete | Resolved with OU specification + SG port additions |
| CIFS share creation | ✅ Complete | Created `data` share via ONTAP REST API |
| File placement via SMB | ✅ Complete | Placed files in public/confidential using `demo.local\Admin` |
| S3 AP creation | ✅ AVAILABLE | Created with WINDOWS user type, AD-joined SVM |
| Access via S3 AP | ❌ AccessDenied (new account only) | **Root cause identified: Organization SCP**. Access succeeds in old account (no SCP restrictions). SCP modification required in Organization management account |
| KB sync (via S3 AP) | ⚠️ Metadata 2KB limit | KB sync via S3 AP itself succeeds, but PDF file metadata may exceed the 2KB limit |
| KB sync (via S3 bucket) | ✅ Complete | KB sync of documents with SID metadata succeeded via S3 bucket fallback path |
| cdk destroy | ✅ Complete | S3 Vectors custom resources (bucket + index) deleted normally. FSx remains in existing FSx reference mode (by design) |

> **Alternative Path**: E2E verification via S3 bucket fallback path (S3 bucket → KB sync → S3 Vectors → SID filtering) is complete. Since SID filtering is independent of the vector store and data source type, verification results from the S3 bucket path also apply to the S3 AP path.

### S3 Vectors → OpenSearch Serverless Export Verification Results

One-click export from the console was verified with the following results:

| Step | Duration | Result |
|------|----------|--------|
| AOSS collection auto-creation | ~5 minutes | ACTIVE |
| OSI pipeline auto-creation | ~5 minutes | ACTIVE → Data transfer started |
| Data transfer complete | ~5 minutes | Pipeline auto-STOPPING |
| Total | ~15 minutes | Export complete |

Resources automatically created during export:
- AOSS collection (`s3vectors-collection-<timestamp>`)
- OSI pipeline (`s3vectors-pipeline<timestamp>`)
- IAM service role (`S3VectorsOSIRole-<timestamp>`)
- DLQ S3 bucket

Export lessons:
- The console's "Create and use a new service role" option auto-creates the IAM role. No need to create the role in advance with a script
- The OSI pipeline automatically stops after data transfer is complete (cost efficient)
- The AOSS collection remains searchable after the pipeline stops
- The AOSS collection's max OCU defaults to 100 (configurable in the console)
- The export script (`export-to-opensearch.sh`) trust policy uses only `osis-pipelines.amazonaws.com` (`s3vectors.amazonaws.com` is an invalid service principal in IAM)

#### Export Console Screen

![S3 Vectors → OpenSearch Serverless Export Configuration Screen](screenshots/s3vectors-export-to-opensearch.png)

The console automates the following:
- Creation of OpenSearch Serverless vector collection (max OCU: 100)
- Creation of IAM service role (S3 Vectors read + AOSS write)
- Creation of OpenSearch Ingestion pipeline (including DLQ S3 bucket)

### Created Resources (Example)

| Resource | ARN/ID Pattern |
|----------|---------------|
| Knowledge Base | `<KB_ID>` |
| Vector Bucket | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors` |
| Vector Index | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors/index/bedrock-knowledge-base-default-index` |

### Issues Discovered and Fixed During Deployment

| # | Issue | Cause | Fix |
|---|-------|-------|-----|
| 1 | No ARN in SDK v3 response | S3 Vectors API specification | Construct ARN from pattern |
| 2 | S3VectorsConfiguration validation error | Mutual exclusivity of indexArn and indexName | Use indexArn only |
| 3 | 403 error during KB creation | IAM policy dependency | Use explicit ARN patterns |
| 4 | DeleteIndexCommand not a constructor | SDK API command name difference | Use CreateIndex/DeleteIndex |
| 5 | CloudFormation Hook | Organization-level Hook | Use --method=direct |

---

## Related Documents

| Document | Content |
|----------|---------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID filtering design details |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3-configuration comparison table and implementation lessons |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | Technical design document |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | Requirements document |
