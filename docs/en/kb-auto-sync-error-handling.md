# KB Auto-Sync Error Handling Design

## Overview

This document defines the failure flow, retry strategy, alerting, and manual recovery procedures for KB Auto-Sync (`enableKbAutoSync=true`).

## Error Detection Mechanisms

### CloudWatch Alarm (automatic detection)

```
EventBridge Scheduler (every 5 min)
  → Lambda invocation
    → success: metrics normal
    → failure: Lambda Errors metric +1
      → 3 consecutive errors: CloudWatch Alarm fires
        → SNS notification (when enableMonitoring=true)
```

**Alarm configuration:**
- Name: `${prefix}-kb-auto-sync-errors`
- Threshold: 1 error × 3 consecutive periods
- Period: same as the polling interval (5 minutes by default)
- Missing data: NOT_BREACHING (no alarm while the Lambda is not running)

### EMF metrics (detailed monitoring)

The KB Auto-Sync Lambda emits the following custom metrics:

| Metric | Namespace | Meaning |
|--------|-----------|---------|
| `FilesScanned` | `KbAutoSync` | Number of files scanned |
| `FilesChanged` | `KbAutoSync` | Number of files detected as changed |
| `IngestionJobTriggered` | `KbAutoSync` | Number of ingestion jobs started |
| `IngestionJobFailed` | `KbAutoSync` | Number of ingestion jobs that failed |
| `InventoryDiffErrors` | `KbAutoSync` | Number of inventory diff computation errors |

## Failure Patterns and Responses

### Pattern 1: S3 Access Point ListObjectsV2 error

**Cause**: FSx for ONTAP S3 AP connectivity failure, insufficient IAM permissions, or a deleted S3 AP.

**Behaviour**:
- The Lambda logs the error and throws.
- The CloudWatch Alarm fires after three consecutive failures.
- The DynamoDB inventory is left unchanged, preserving atomicity.

**Manual recovery**:
```bash
# 1. Confirm the S3 AP exists
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. Check the S3 AP ARN in the Lambda environment
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. Test with a manual invocation
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### Pattern 2: Bedrock KB ingestion job failure

**Cause**: KB data source misconfiguration, S3 AP permission errors, or chunking/parsing errors.

**Behaviour**:
- The Lambda tracks status with `StartIngestionJob` followed by `GetIngestionJob`.
- When the job status is `FAILED`:
  - The file is marked `status: "failed"` in the DynamoDB inventory.
  - It is not re-ingested on the next poll, which prevents an infinite retry loop.
  - The `IngestionJobFailed` metric is emitted.
- When the job status is `IN_PROGRESS`:
  - No duplicate job is started (IN_PROGRESS acts as a mutual exclusion).

**Manual recovery**:
```bash
# 1. Inspect the failed job
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. Find the failed files in the inventory
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. Reset the inventory entry so the file can be ingested again
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. Start ingestion manually
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### Pattern 3: DynamoDB inventory table error

**Cause**: DynamoDB capacity exhaustion, permission errors, or a deleted table.

**Behaviour**:
- The Lambda throws and terminates immediately.
- Fail-safe: no inventory update, so the next poll rescans from scratch.
- The CloudWatch Alarm fires after three consecutive failures.

**Manual recovery**:
```bash
# Confirm the inventory table exists
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# If the table is missing, redeploy with CDK
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### Pattern 4: Lambda timeout (beyond 5 minutes)

**Cause**: Scanning a large number of files (>10,000), or high ListObjectsV2 latency.

**Behaviour**:
- The Lambda times out at 5 minutes and the Errors metric increments.
- Partially scanned files are not recorded in the inventory, preserving atomicity.

**Mitigation**:
- Set `kbAutoSyncIntervalMinutes` to a longer interval (for example 15 minutes).
- For very large file counts, consider splitting the S3 AP by prefix.

## Retry Strategy

| Failure pattern | Automatic retry | Retry interval | Maximum retries |
|-----------------|-----------------|----------------|-----------------|
| S3 AP connectivity error | ✅ (next poll) | polling interval (5 min) | unbounded (detected by the alarm) |
| KB ingestion failure | ❌ (manual reset required) | — | — |
| DynamoDB error | ✅ (next poll) | polling interval (5 min) | unbounded (detected by the alarm) |
| Lambda timeout | ✅ (next poll) | polling interval (5 min) | unbounded (detected by the alarm) |

**Design decision**: there is no Dead Letter Queue. In a scheduled polling pattern driven by EventBridge Scheduler, a failed run is retried automatically on the next poll, so a DLQ adds nothing. A failed KB ingestion job is the exception and is *not* retried automatically, because it may indicate a data quality problem that a human should look at.

## Fail-Closed Behaviour When Ingestion Fails

KB Auto-Sync failures do not weaken the permission boundary of the RAG pipeline:

1. **An un-updated inventory leaves the existing index in place.** New files simply do not become searchable; permission control over existing files is unaffected.
2. **Failed files are marked `status: "failed"`.** They are not re-ingested automatically; the entry is reset after a human has looked at it.
3. **IN_PROGRESS jobs are mutually exclusive.** This prevents the data inconsistency that a double ingestion would cause.
4. **Files without permission metadata (`.metadata.json`)** are excluded by the fail-closed filter at retrieval time even if they reach the KB. The fail-closed rule always applies.

## Monitoring Dashboard

When `enableMonitoring=true`, the CloudWatch dashboard gains these widgets:

- **KB Auto-Sync Errors**: the Lambda Errors metric (5-minute periods)
- **Ingestion Job Status**: counts of succeeded, failed, and in-progress jobs
- **Files Changed**: files detected as changed per poll
- **Scan Duration**: Lambda execution time (P50/P90/P99)

## Related Documents

- [Permission Metadata Consistency Model](permission-consistency.md) — how permission metadata updates relate to KB index updates, including why ACL changes are not reflected automatically
- [CloudWatch Dashboard Guide](cloudwatch-dashboard-guide.md) — how to read the monitoring metrics
- [Production Readiness Checklist](production-readiness-checklist.md) — requirements before running KB Auto-Sync in production
