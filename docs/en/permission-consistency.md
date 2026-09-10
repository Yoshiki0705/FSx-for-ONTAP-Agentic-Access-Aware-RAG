# Permission Metadata Consistency Model

**🌐 Language:** [日本語](../permission-consistency.md) | **English** | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**Created**: 2026-05-21
**Updated**: 2026-09-07 (withdrew the ACL-originated automatic propagation flow after verifying the implementation)
**Status**: Draft
**Audience**: Operations designers, security engineers

---

## Overview

This document defines when a change to the data used for permission decisions at query time becomes visible in search results. Two data sets are used: `.metadata.json` on the document side, and the DynamoDB `user-access` table on the user side.

**There is no mechanism that automatically tracks NTFS ACL changes on files in FSx for ONTAP.** The permission index is not a projection of the ACL; it is a separate index that is built and maintained on its own. The reasons and operational implications are in "Why ACL changes do not arrive".

---

## Data used for permission decisions

| Data | Location | Produced/updated by | Role at query time |
|------|----------|--------------------|--------------------|
| `.metadata.json` (`allowed_group_sids` / `allowed_uids` / `allowed_gids`) | Sidecar object on the S3 AP → metadata attribute in the Bedrock KB | Depends on the path (see below) | Allowed SID / UID / GID set of the retrieved chunk |
| `user-access` (`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`) | DynamoDB | AD / LDAP sync Lambda (`lambda/agent-core-ad-sync/`) | SID / UID / GID set of the caller |
| `perm-cache` | DynamoDB (5-minute TTL) | Permission filter | Cache of decision results |

Origin of `.metadata.json`:

| Path | Origin | Trigger |
|------|--------|---------|
| Transfer Family SFTP (`enableTransferFamily=true`) | Administrator-managed DynamoDB mapping, keyed by upload user name | On file upload |
| Self-hosted embedding server (`ENV_AUTO_METADATA=true`, optional, non-default) | Real NTFS ACL retrieved via the ONTAP REST API | On detecting an unprocessed file (mtime-based) |
| Demo environment | Sample files shipped in the repository, placed by hand | Manual |

SFTP users carry an IAM Deny on `*.metadata.json`, so an uploader cannot author their own permissions.

---

## Propagation paths

Two paths propagate automatically.

### Path A: document-side permission change

| Step | Handled by | Latency |
|------|-----------|---------|
| ① `.metadata.json` update | The origin in the table above, or a direct update by an administrator | Trigger-dependent |
| ② Change detection | KB Auto-Sync (EventBridge Scheduler; compares `size` / `lastModified` / `ETag`) | Polling interval (default 15 min) |
| ③ Vector store update | `StartIngestionJob` | 1–15 min (depends on document count) |
| ④ Decision cache expiry | `perm-cache` TTL | Up to 5 min |

### Path B: user-side permission change

| Step | Handled by | Latency |
|------|-----------|---------|
| ① AD group membership change | AD replication | Usually within 15 min |
| ② `user-access` update | AD / LDAP sync Lambda. **Triggered by Cognito PostAuthentication / PostConfirmation; there is no scheduled execution** | Until the user's next sign-in (indefinite) |
| ③ Decision cache expiry | `perm-cache` TTL, or explicit invalidation via `user-access` DynamoDB Streams | Up to 5 min |

Step ② of path B never arrives for a user whose session continues. To revoke reliably, use the emergency revocation procedure.

---

## Why ACL changes do not arrive

Changing a file's NTFS ACL does not regenerate `.metadata.json` in any deployment configuration. Verified against the implementation:

| Mechanism | Runs on an ACL change? | Basis |
|-----------|------------------------|-------|
| AD / LDAP sync Lambda | No | Neither ACL retrieval nor `.metadata.json` writing is implemented. It retrieves only user SIDs from AD |
| Transfer Family metadata generation | No | Triggered by file upload. The origin is an administrator-managed DynamoDB mapping, which does not consult the ACL |
| Self-hosted embedding server (`ENV_AUTO_METADATA=true`) | No | Reprocessing is keyed on `mtime`. An ACL-only change does not move `mtime` |
| KB Auto-Sync | No | Diffs on `size` / `lastModified` / `ETag`. An ACL change moves none of them |
| FSx permission service (`lambda/permissions/fsx-permission-service.ts`) | Out of scope | Code that reads ACLs exists, but it is not deployed by any CDK stack |

**Implication**: to reflect an ACL change in search results, an operator has to regenerate `.metadata.json` and place it on the S3 AP. The correctness of this index depends on operations; agreement with the ACL is not guaranteed automatically. For urgent access stops, act on the user side (delete from `user-access`, clear the cache, invalidate the session) rather than on the ACL.

---

## Step details

### Vector store update (KB re-sync)

| Method | Trigger | Latency | Notes |
|--------|---------|---------|-------|
| KB Auto-Sync | EventBridge Scheduler (polling) | Configured interval (default: 15 min) | With `enableKbAutoSync=true`. StartIngestionJob runs only when a file change is detected |
| Manual KB sync | AWS Console / CLI | Starts immediately, completes in minutes | `aws bedrock-agent start-ingestion-job` |
| CloudTrail event | S3 PutObject | Minutes | On the Transfer Family path with `enableCloudTrailIngestion=true` |

**KB sync duration guide:**

| Document count | Sync time (guide) |
|----------------|-------------------|
| up to 100 | 1–3 min |
| up to 1,000 | 5–15 min |
| up to 10,000 | 30–60 min |
| up to 100,000 | Hours (incremental sync recommended) |

### Permission cache invalidation

| Cache | TTL | Invalidation | Notes |
|-------|-----|--------------|-------|
| DynamoDB `perm-cache` | 5 min | TTL expiry / explicit deletion via `user-access` Streams | Cache of filtering results |
| DynamoDB `user-access` | None (persistent) | Requires an explicit update | User SID / group SIDs |
| Browser session | For the session | Logout / session expiry | Front-end in-memory cache |

---

## Permission propagation delay

| Origin | Maximum delay | Breakdown |
|--------|---------------|-----------|
| Document-side change (path A, Auto-Sync every 15 min) | ~35 min | 15 min polling + 15 min KB sync + 5 min cache |
| Document-side change (Auto-Sync every 5 min) | ~25 min | 5 min polling + 15 min KB sync + 5 min cache |
| Document-side change (manual KB sync) | ~20 min | 15 min KB sync + 5 min cache |
| User-side change (path B) | Undefined | 15 min AD replication + until next sign-in (indefinite) + 5 min cache |
| Emergency revocation (procedure below) | Up to 5 min | Forced cache clear + Fail-Closed |
| File ACL change | **Undefined** | No mechanism tracks it. Requires operator regeneration of `.metadata.json` |

The 15 minutes for KB sync depends on document count (see the duration guide above). At 10,000 documents it becomes 30–60 min, and the total delay grows accordingly.

---

## Emergency permission revocation

When a user's access must be revoked immediately:

### Step 1: Delete the user's SIDs from DynamoDB (immediate effect)

```bash
# Delete the user's SID data → Fail-Closed denies all documents
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Step 2: Force-clear the permission cache

```bash
# Delete the user's cache entries
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

### Step 3: Disable the Cognito user (session invalidation)

```bash
# Disable the Cognito user
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Effect

- After step 1: new search requests are denied for all documents immediately (Fail-Closed)
- After step 2: stale cached permission data can no longer be used
- After step 3: the user's session itself is invalidated

**Note that this procedure stops the user side, not the document side.** Hiding one specific document from one person goes through the `.metadata.json` update and KB re-sync, so it incurs the path A delay.

---

## Behaviour per change scenario

### Scenario 1: document permission metadata change

```
Administrator removes User X's SID from file A's .metadata.json
  → KB Auto-Sync detects the diff (ETag changed)
  → StartIngestionJob updates the vector store metadata
  → After perm-cache TTL expiry, file A is excluded from User X's searches
```

**Delay**: up to ~35 min (Auto-Sync every 15 min)

### Scenario 2: AD group membership change

```
Administrator removes User X from the Engineering group
  → AD replication (~15 min)
  → At User X's next sign-in, the AD sync Lambda updates groupSIDs in user-access
  → After perm-cache expiry, Engineering-only documents are excluded
```

**Delay**: AD replication + until next sign-in (indefinite) + cache TTL. **Nothing is reflected while the session continues.** When immediacy is required, use the emergency revocation procedure.

### Scenario 3: file move (rename / move)

```
Administrator moves file A from /public/ to /confidential/
  → Inherited permissions are recomputed on FSx (effective permissions on the ONTAP side only)
  → .metadata.json does not follow the destination's permissions
  → An operator has to regenerate and place .metadata.json
```

**Note**: the source location's allowed SIDs remain, so a move alone does not change visibility in search. If directory structure is used as a permission boundary, make the move and the `.metadata.json` update a single procedure.

### Scenario 4: bulk ACL change on a parent folder

```
Administrator changes the ACL on /confidential/ (inheritance enabled)
  → Effective permissions change on ONTAP for all files underneath
  → .metadata.json does not follow (see "Why ACL changes do not arrive")
  → Regeneration of .metadata.json for those files plus a KB re-sync is required
```

**Note**: bulk changes over many files take time to re-sync. Phased changes are recommended.

---

## Consistency guarantees

**Time-based access control (`enableAdvancedPermissions`) fails in two different directions.** A configuration defect — an invalid timezone, or a time that cannot be read as `HH:mm` — fails open: the time restriction is dropped and access is allowed, to avoid locking users out. **An unreadable clock is denied instead**, because allowing access without being able to tell whether we are inside the window would silently remove the restriction. In both cases SID matching is applied separately, so this branch never weakens the permission-index decision.

| Level | Guarantee | Implementation |
|-------|-----------|----------------|
| **Fail-Closed** | Deny everything when SID information cannot be retrieved | On DynamoDB error / missing record |
| **Eventually Consistent** | Changes to permission metadata (`.metadata.json` / `user-access`) eventually reach search results | KB Auto-Sync + cache TTL + Streams invalidation |
| **No False Positive** | Documents the user has no permission for are not shown | SID matching (set intersection) |
| **Metadata Required** | Documents without metadata are excluded | `.metadata.json` required |
| **No ACL tracking** | File ACL changes are not reflected automatically | Requires operator regeneration of `.metadata.json` |

### Note: possible false negatives

In the following cases, a document the user is entitled to may temporarily not appear (false negative):

- Immediately after a grant (`.metadata.json` not yet updated, or before KB re-sync)
- During KB sync (stale metadata still present)
- During AD replication delay, or before the user signs in again

**Design stance**: for security, false negatives (something that should be visible is not) are accepted, and false positives (something that must not be visible is) are targeted at zero.

However, **this stance assumes the permission index is correct.** If an ACL was narrowed but `.metadata.json` was not updated, the index still returns an allow, which is a false positive. Maintaining the index is the boundary itself.

---

## Recommended monitoring and alerts

```yaml
# Recommended CloudWatch alarms
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # high miss rate = frequent permission data updates

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # alert after 3 consecutive failures

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # alert immediately on SID resolution failure

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # frequent Fail-Closed triggers warrant investigation
```

---

## Related documents

| Document | Content |
|----------|---------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID filtering design details |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production readiness checklist |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP performance and capacity design |
