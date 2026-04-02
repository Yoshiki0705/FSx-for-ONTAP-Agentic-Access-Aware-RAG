# CDK Stack Architecture Guide

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | **English** | [한국어](../ko/stack-architecture-comparison.md) | [简体中文](../zh-CN/stack-architecture-comparison.md) | [繁體中文](../zh-TW/stack-architecture-comparison.md) | [Français](../fr/stack-architecture-comparison.md) | [Deutsch](../de/stack-architecture-comparison.md) | [Español](../es/stack-architecture-comparison.md)

**Last Updated**: 2026-03-31  
**Status**: Consolidated to demo stack lineage, S3 Vectors integration verified

---

## Overview

All CDK stacks are consolidated under `lib/stacks/demo/`. The sole entry point is `bin/demo-app.ts`. Optional features can be enabled via CDK context parameters.

---

## Feature Comparison

| Feature | Demo Stack (Current) | CDK Context | Notes |
|---------|---------------------|-------------|-------|
| Authentication | Cognito + AD (optional) | `adPassword`, `adDomainName` | Cognito only when AD is not configured |
| Automatic SID Retrieval | AD Sync Lambda | `adType=managed\|self-managed` | Manual (`setup-user-access.sh`) when AD is not configured |
| NTFS ACL Retrieval | Auto-generated within Embedding server | `ontapMgmtIp`, `ontapSvmUuid` | Manual `.metadata.json` when not configured |
| Permission Filtering | Within Next.js API Route (default) | `usePermissionFilterLambda=true` | Can also be migrated to a dedicated Lambda |
| Bedrock Agent | Dynamic Agent creation + Action Group | `enableAgent=true` | Auto-creates category-specific Agent on card click |
| Bedrock Guardrails | Content safety + PII protection | `enableGuardrails=true` | |
| KMS Encryption | S3 / DynamoDB CMK encryption | `enableKmsEncryption=true` | Key rotation enabled |
| CloudTrail | S3 data access + Lambda audit | `enableCloudTrail=true` | 90-day retention |
| VPC Endpoints | S3, DynamoDB, Bedrock, etc. | `enableVpcEndpoints=true` | Supports 6 services |
| Embedding Server | FlexCache CIFS mount + direct vector store write | `enableEmbeddingServer=true` | Fallback path when S3 AP is unavailable (AOSS configuration only) |

---

## Data Ingestion Paths

| Path | Method | Activation | Use Case |
|------|--------|------------|----------|
| Main | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Standard volumes |
| Fallback | Direct S3 bucket upload → Bedrock KB | `upload-demo-data.sh` | When S3 AP is unavailable |
| Alternative | CIFS mount → Embedding server → Direct vector store write | `enableEmbeddingServer=true` | FlexCache volumes (AOSS configuration only) |

---

## Bedrock KB Ingestion Job — Quotas and Design Considerations

Bedrock KB Ingestion Job is a managed service that handles document retrieval, chunking, vectorization, and storage. It reads data directly from FSx ONTAP via S3 Access Point and processes only changed files through incremental sync. No custom Embedding pipeline (such as AWS Batch) is required.

### Service Quotas (As of March 2026, All Non-Adjustable)

| Quota | Value | Design Impact |
|-------|-------|---------------|
| Data size per job | 100GB | Excess data is not processed. Data sources exceeding 100GB must be split into multiple data sources |
| File size per file | 50MB | Large PDFs need to be split |
| Added/updated files per job | 5,000,000 | Sufficient for typical enterprise document volumes |
| Deleted files per job | 5,000,000 | Same as above |
| Files when using BDA parser | 1,000 | Limit when using Bedrock Data Automation parser |
| Files when using FM parser | 1,000 | Limit when using Foundation Model parser |
| Data sources per KB | 5 | Upper limit when registering multiple volumes as individual data sources |
| KBs per account | 100 | Consideration for multi-tenant design |
| Concurrent jobs per account | 5 | Constraint for parallel sync across multiple KBs |
| Concurrent jobs per KB | 1 | Parallel sync to the same KB is not possible. Must wait for the previous job to complete |
| Concurrent jobs per data source | 1 | Same as above |

### Execution Triggers and Frequency Constraints

| Item | Value | Notes |
|------|-------|-------|
| StartIngestionJob API rate | 0.1 req/sec (once every 10 seconds) | **Non-adjustable**. Not suitable for high-frequency automatic sync |
| Execution trigger | Manual (API/CLI/Console) | No automatic scheduling feature on the Bedrock KB side |
| Sync method | Incremental sync | Processes only additions, changes, and deletions. Full reprocessing is not required |
| Sync duration | Depends on data volume (tens of seconds to hours) | Small scale (tens of files): 30 sec–2 min, Large scale: hours |

### Scheduling Automatic Sync

Since Bedrock KB does not have a built-in scheduled sync feature, implement periodic sync using the following methods if needed:

```bash
# Periodic execution with EventBridge Scheduler (e.g., every hour)
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

Alternatively, you can detect file changes on FSx ONTAP via S3 event notifications and trigger an Ingestion Job. However, be aware of the StartIngestionJob API rate limit (once every 10 seconds).

### Design Recommendations

1. **Sync frequency**: Real-time sync is not possible. Minimum interval is 10 seconds; practically, 15 minutes to 1 hour is recommended
2. **Large-scale data**: Data sources exceeding 100GB should be split across multiple FSx ONTAP volumes (= multiple S3 APs = multiple data sources)
3. **Parallel processing**: Parallel sync to the same KB is not possible. Sync multiple data sources sequentially
4. **Error handling**: Implement retry logic for job failures (monitor status with `GetIngestionJob`)
5. **No custom Embedding pipeline needed**: Since Bedrock KB manages chunking, vectorization, and storage, custom pipelines such as AWS Batch are unnecessary

---

## CDK Stack Structure (7 Stacks)

| # | Stack | Required/Optional | Description |
|---|-------|-------------------|-------------|
| 1 | WafStack | Required | WAF for CloudFront (us-east-1) |
| 2 | NetworkingStack | Required | VPC, Subnets, SG |
| 3 | SecurityStack | Required | Cognito User Pool |
| 4 | StorageStack | Required | FSx ONTAP + SVM + Volume (or existing reference), S3, DynamoDB×2 |
| 5 | AIStack | Required | Bedrock KB, S3 Vectors or OpenSearch Serverless, Agent (optional) |
| 6 | WebAppStack | Required | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | Optional | FlexCache CIFS mount + Embedding server |

### Existing FSx for ONTAP Reference Mode

StorageStack can reference existing FSx ONTAP resources using the `existingFileSystemId`/`existingSvmId`/`existingVolumeId` parameters. In this case:
- Skips creation of new FSx/SVM/Volume (reduces deployment time by 30-40 minutes)
- Also skips Managed AD creation (uses existing environment's AD configuration)
- S3 buckets, DynamoDB tables, and S3 AP custom resources are created as usual
- `cdk destroy` does not delete FSx/SVM/Volume (outside CDK management)

---

## Vector Store Configuration Comparison

The vector store configuration can be switched using the CDK context parameter `vectorStoreType`. The third configuration (S3 Vectors + AOSS Export) is provided as an operational procedure for on-demand export on top of the S3 Vectors configuration.

> **Region Support**: S3 Vectors is available in `ap-northeast-1` (Tokyo region).

| Item | OpenSearch Serverless | S3 Vectors Standalone | S3 Vectors + AOSS Export |
|------|----------------------|----------------------|--------------------------|
| **CDK Parameter** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors` (default) | Run `export-to-opensearch.sh` on top of configuration 2 |
| **Cost** | ~$700/month (2 OCUs always running) | A few dollars/month (small scale) | S3 Vectors + AOSS OCU (only during export) |
| **Latency** | ~10ms | Sub-second (cold), ~100ms (warm) | ~10ms (AOSS search after export) |
| **Filtering** | Metadata filter (`$eq`, `$ne`, `$in`, etc.) | Metadata filter (`$eq`, `$in`, `$and`, `$or`) | AOSS filtering after export |
| **Metadata Constraints** | No constraints | filterable 2KB/vector (effectively 1KB for custom), non-filterable keys max 10 | Follows AOSS constraints after export |
| **Use Case** | Production environments requiring high performance | Cost optimization, demo, development environments | Temporary high-performance demand |
| **Operational Procedure** | CDK deploy only | CDK deploy only | Run `export-to-opensearch.sh` after CDK deploy. Export IAM role is auto-created |

> **S3 Vectors Metadata Constraint**: When using Bedrock KB + S3 Vectors, custom metadata is effectively limited to 1KB or less (Bedrock KB internal metadata consumes ~1KB of the 2KB filterable metadata limit). The CDK code sets all metadata to non-filterable to bypass the 2KB limit. SID filtering is performed on the application side, so S3 Vectors QueryVectors filter is not needed. See [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) for details.

### Notes on Export

- Export is a **point-in-time copy**. Re-export is required after S3 Vectors data updates (continuous sync is not performed)
- During export, an AOSS collection, OSI pipeline, IAM service role, and DLQ S3 bucket are automatically created
- The console's "Create and use a new service role" option auto-creates the IAM role, so no prior role creation is needed
- Export takes approximately 15 minutes (AOSS collection creation 5 min + pipeline creation 5 min + data transfer 5 min)
- The OSI pipeline **automatically stops** after data transfer is complete (cost efficient)
- The AOSS collection remains searchable after the pipeline stops
- **Manually delete AOSS collections when no longer needed** (not deleted by `cdk destroy` as they are outside CDK management. OCU billing continues)

---

## Lessons Learned from S3 Vectors Implementation (Verified)

The following are lessons learned from actual deployment verification in ap-northeast-1 (Tokyo region) on 2026-03-29.

### SDK/API Related

| Item | Lesson |
|------|--------|
| SDK v3 response | `CreateVectorBucketCommand`/`CreateIndexCommand` responses do not include `vectorBucketArn`/`indexArn`. Only `$metadata` is returned. ARN must be constructed using the pattern `arn:aws:s3vectors:{region}:{account}:bucket/{name}` |
| API command names | `CreateIndexCommand`/`DeleteIndexCommand` are correct. `CreateVectorBucketIndexCommand` does not exist |
| CreateIndex required parameters | `dataType: 'float32'` is required. Omitting it causes a validation error |
| Metadata design | All metadata keys are filterable by default. `metadataConfiguration` only specifies `nonFilterableMetadataKeys`. No explicit configuration is needed to make `allowed_group_sids` filterable |

### Bedrock KB Related

| Item | Lesson |
|------|--------|
| S3VectorsConfiguration | `indexArn` and `indexName` are mutually exclusive. Specifying both causes a `2 subschemas matched instead of one` error. Use `indexArn` only |
| IAM permission validation | Bedrock KB validates the KB Role's `s3vectors:QueryVectors` permission at creation time. The IAM policy must be applied before KB creation |
| Required IAM actions | 5 actions are required: `s3vectors:QueryVectors`, `s3vectors:PutVectors`, `s3vectors:DeleteVectors`, `s3vectors:GetVectors`, `s3vectors:ListVectors` |

### CDK/CloudFormation Related

| Item | Lesson |
|------|--------|
| IAM policy resource ARN | Use explicit ARN patterns instead of custom resource `GetAtt` tokens. This avoids dependency issues |
| CloudFormation Hook | Organization-level `AWS::EarlyValidation::ResourceExistenceCheck` Hook blocking change-sets can be bypassed with `--method=direct` |
| Deployment time | AI stack (S3 Vectors configuration) deployment time is approximately 83 seconds (significantly reduced compared to ~5 minutes for AOSS configuration) |

---

---

## Future Extension Options

The following features are currently not implemented but are designed to be added as optional features via CDK context parameters.

| Feature | Overview | Expected Parameter |
|---------|----------|--------------------|
| Monitoring & Alerts | CloudWatch dashboard (cross-stack metrics), SNS alerts (error rate / latency threshold exceeded) | `enableMonitoring=true` |
| Advanced Permission Control | Time-based access control (allow only during business hours), geographic access restriction (IP geolocation), DynamoDB audit log | `enableAdvancedPermissions=true` |

---

## Related Documents

| Document | Content |
|----------|---------|
| [README.md](../README.md) | Deployment procedures and CDK context parameter list |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID filtering design and data ingestion path details |
| [embedding-server-design.md](embedding-server-design.md) | Embedding server design (including ONTAP ACL auto-retrieval) |
| [ui-specification.md](ui-specification.md) | UI specification (card UI, KB/Agent mode switching) |
