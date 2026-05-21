# Permission Change Consistency Model

**🌐 Language:** [日本語](../permission-consistency.md) | **English** | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Operations designers, security engineers

---

## Overview

This document clarifies when and how changes to file ACLs on FSx for ONTAP are reflected in the vector store and permission cache, and defines the consistency guarantee levels during permission changes.

---

## Overall Permission Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Permission Change Propagation Flow                         │
│                                                                              │
│  ① ACL Change       ② Metadata Regeneration  ③ KB Re-sync        ④ Cache    │
│                                                                    Invalidation│
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json update │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ Change   │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │expiry  │  │
│  Admin changes      Service role          KB Auto-Sync          └────────┘  │
│  file permissions   Lambda re-retrieves   (EventBridge           5-min TTL   │
│                     ACL                   Scheduler)             auto-       │
│                                           or manual trigger      invalidation│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Step Details

### Step ①: ACL Change (FSx for ONTAP)

| Operation | Reflection Timing | Notes |
|-----------|-------------------|-------|
| File ACL change | Immediate (on FSx) | NTFS ACL is immediately reflected on FSx volume |
| Group membership change | After AD propagation (typically within 15 min) | Depends on AD replication delay |
| File move (rename/move) | Immediate (on FSx) | Inherited permissions are recalculated |
| Inherited permission change | Immediate (on FSx) | Parent folder ACL changes propagate to children |

### Step ②: Metadata Regeneration

Methods to update `allowed_group_sids` in `.metadata.json`:

| Method | Trigger | Delay | Notes |
|--------|---------|-------|-------|
| Upload via Transfer Family | On file upload | Immediate | When `enableTransferFamily=true`. Auto-generates metadata for uploaded files |
| AD Sync Lambda | Manual / Scheduled | Depends on configuration | `lambda/agent-core-ad-sync/` re-retrieves NTFS ACL |
| Manual update | Admin operation | Immediate | For S3 bucket fallback path, directly update `.metadata.json` |

### Step ③: Vector Store Update (KB Re-sync)

| Method | Trigger | Delay | Notes |
|--------|---------|-------|-------|
| KB Auto-Sync | EventBridge Scheduler (polling) | Configured interval (default: 15 min) | When `enableKbAutoSync=true`. Executes StartIngestionJob only when file changes detected |
| Manual KB sync | AWS Console / CLI | Starts immediately, completes in minutes | `aws bedrock-agent start-ingestion-job` |
| CloudTrail event | S3 PutObject | Several minutes | When `enableCloudTrailIngestion=true` on Transfer Family path |

**Estimated KB sync duration:**

| Document Count | Sync Time (estimate) |
|----------------|---------------------|
| ~100 | 1–3 min |
| ~1,000 | 5–15 min |
| ~10,000 | 30–60 min |
| ~100,000 | Several hours (incremental sync recommended) |

### Step ④: Permission Cache Invalidation

| Cache | TTL | Invalidation Method | Notes |
|-------|-----|---------------------|-------|
| DynamoDB `perm-cache` | 5 min | Automatic TTL expiry | Filtering result cache |
| DynamoDB `user-access` | None (persistent) | Explicit update required | User SID / Group SID |
| Browser session | During session | Logout / session expiry | Frontend memory cache |

---

## Maximum Permission Propagation Delay

### Normal Operations

```
ACL Change → Metadata Regeneration → KB Re-sync → Cache Expiry
  0 min        0–15 min              1–15 min      0–5 min
                                              
Max delay: ~35 min (15 min polling + 15 min KB sync + 5 min cache)
```

### RPO-style Expression

| Scenario | Max Delay | Description |
|----------|-----------|-------------|
| Normal operations (KB Auto-Sync 15-min interval) | Max 35 min | Polling interval + KB sync + cache TTL |
| High-frequency sync (KB Auto-Sync 5-min interval) | Max 15 min | Reduced polling interval |
| Manual immediate sync | Max 10 min | Manual KB sync + cache TTL |
| Emergency permission revocation | Max 5 min | Forced cache clear + Fail-Closed |

---

## Emergency Permission Revocation Procedure

When immediate revocation of a user's access permissions is required:

### Step 1: Delete User SID from DynamoDB (Immediate Effect)

```bash
# Delete user's SID data → Fail-Closed denies all documents
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Step 2: Force-Clear Permission Cache

```bash
# Delete cache entries for the target user
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### Step 3: Disable Cognito User (Session Invalidation)

```bash
# Disable Cognito user
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Effect

- After Step 1: New search requests immediately deny all documents (Fail-Closed)
- After Step 2: Prevents use of cached old permission information
- After Step 3: Invalidates the user's session itself

---

## Behavior by Permission Change Scenario

### Scenario 1: File ACL Change

```
Admin removes User X from File A's ACL
  → Remove User X's SID from .metadata.json allowed_group_sids
  → KB re-sync updates vector store metadata
  → File A is excluded from User X's next search results
```

**Delay**: Max 35 min (normal operations)

### Scenario 2: AD Group Membership Change

```
Admin removes User X from Engineering group
  → AD replication (~15 min)
  → DynamoDB user-access groupSIDs updated (on AD Sync Lambda execution)
  → Engineering group-restricted documents excluded from User X's next search
```

**Delay**: AD replication + AD Sync Lambda execution interval + cache TTL

### Scenario 3: File Move (rename / move)

```
Admin moves File A from /public/ to /confidential/
  → Inherited permissions recalculated on FSx
  → .metadata.json regeneration required
  → KB re-sync updates vector store metadata
```

**Note**: Automatic `.metadata.json` regeneration may not occur on file move. A design where KB Auto-Sync polling detects file path changes and triggers metadata regeneration is recommended.

### Scenario 4: Inherited Permission Change

```
Admin changes ACL on /confidential/ folder (inheritance enabled)
  → Effective permissions change for all files underneath
  → .metadata.json regeneration required for each file
  → KB re-sync
```

**Note**: Bulk permission changes for large numbers of files take time for KB sync. Gradual changes are recommended.

---

## Consistency Guarantee Levels

| Level | Guarantee | Implementation |
|-------|-----------|----------------|
| **Fail-Closed** | Deny all if SID information cannot be retrieved | On DynamoDB error / no record |
| **Eventually Consistent** | ACL changes are eventually reflected in search results | KB Auto-Sync + cache TTL |
| **No False Positive** | Documents without permission are never displayed | SID matching (set intersection) |
| **Metadata Required** | Documents without metadata are excluded | `.metadata.json` required |

### Note: Possibility of False Negatives

In the following cases, documents that should be accessible may temporarily not be displayed (False Negative):

- Immediately after permission grant (metadata not yet updated)
- During KB sync (old metadata remains)
- During AD replication delay

**Design principle**: For security, False Negatives (accessible items not visible) are tolerated, while False Positives (restricted items visible) target zero occurrences.

---

## Recommended Monitoring & Alert Configuration

```yaml
# Recommended CloudWatch Alarm settings
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # High cache miss rate = high permission data update frequency
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # Alert on 3 consecutive failures
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # Immediate alert on SID resolution failure
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Investigate if Fail-Closed triggers frequently
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID Filtering Architecture Details |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production Readiness Checklist |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Sizing and Performance |
