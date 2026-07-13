# FSx for ONTAP S3 Access Point + AD Prerequisites Guide

**🌐 Language:** [日本語](../s3ap-ad-prerequisites.md) | **English**

**Created**: 2026-07-13
**Verified Environment**: ap-northeast-1 (Tokyo), ONTAP 9.17.1P7D1
**Status**: E2E Verified

---

## Overview

When using S3 Access Points on AD-joined SVMs in Amazon FSx for NetApp ONTAP, specific prerequisites and constraints apply. This document consolidates these findings to enable operations teams to troubleshoot quickly.

---

## Critical Constraint: AD DC Reachability

### Root Cause

On AD-joined SVMs (CIFS enabled), **all S3 AP data operations** (ListObjectsV2, GetObject, PutObject) trigger ONTAP's `unix→win` reverse name-mapping lookup. This lookup requires LDAP/Kerberos connectivity to AD domain controllers.

When AD DCs are unreachable, data operations return `AccessDenied`.

### Confusing Diagnostic Pattern

| Test | AD DC Reachable | AD DC Unreachable |
|------|:---:|:---:|
| HeadBucket | ✅ Success | ✅ Success (false positive) |
| ListObjectsV2 | ✅ Success | ❌ AccessDenied |
| GetObject | ✅ Success | ❌ AccessDenied |
| PutObject | ✅ Success | ❌ AccessDenied |

> **HeadBucket is NOT a reliable health check**: HeadBucket only validates the AP exists at the S3 layer — it does not touch the file-system layer. A successful HeadBucket does NOT guarantee data operations will succeed.

### Typical Misdiagnosis Flow

1. ListObjectsV2 returns AccessDenied → investigate IAM policy
2. IAM policy is correct → investigate S3 AP resource policy
3. AP policy is correct → investigate network configuration
4. VPC Endpoint / Security Group is correct → **stuck with unknown cause**

Actual cause: SVM has lost connectivity to AD domain controllers.

---

## Recommended Architecture Patterns

### Internet-origin AP + VPC-external Lambda (Verified, Recommended)

```
Lambda (no VPC) → Internet-origin S3 AP → FSx for ONTAP Volume
                                           ↕
                                      AD DC (in VPC)
```

- S3 AP: `NetworkOrigin: Internet` (no VpcConfiguration)
- Lambda: No `VpcConfig` (runs outside VPC)
- Same-account: `put_access_point_policy` not required (IAM identity policy sufficient)

### VPC-origin AP (Environment-Dependent Issues)

```
Lambda (in VPC) → S3 Gateway EP → VPC-origin S3 AP → FSx for ONTAP Volume
```

The combination of VPC-origin AP + VPC-internal Lambda + S3 Gateway Endpoint has been observed to produce AccessDenied in some environments. The Internet-origin pattern is recommended.

---

## S3 AP Resource Policy

### Same-Account Access

For same-account access (caller and AP in the same AWS account), an S3 AP resource policy is **not required**. IAM identity policy (`s3:ListBucket`, `s3:GetObject` on AP ARN) is sufficient for authorization.

AP resource policy is only needed for:
- Cross-account access
- Using condition keys (`aws:PrincipalAccount`, `s3:DataAccessPointAccount`)
- Restricting access beyond what IAM allows

---

## FSx API Sync Delay

### FlexClone Discovery Delay

After creating a FlexClone, the FSx API (`DescribeVolumes`) takes **12–36 minutes** to discover the volume (measured, trend increasing).

### Recommended Timing Budget for Step Functions

```
FlexClone Creation → Static Wait (10 min)
  → Polling Loop (120s interval × max 25 iterations = 50 min)
  → Total 60 min budget
```

Immediate confirmation via ONTAP REST API is possible, but allocate this budget when FSx API-level confirmation is required.

---

## FSx Auto-Managed Name-Mapping

When an S3 AP is attached to an FSx for ONTAP volume, FSx **automatically creates** a `s3_unix` direction name-mapping entry on the SVM:

```
s3_unix: amazon-fsx-<RANDOM> → <UNIX user specified in FileSystemIdentity>
```

This mapping is deleted when the AP is detached. **No manual name-mapping configuration is needed.**

---

## Required AD DC Ports

Ports required for SVM ENI to AD DC connectivity:

| Port | Protocol | Service |
|------|----------|---------|
| 53 | TCP/UDP | DNS |
| 88 | TCP/UDP | Kerberos |
| 389 | TCP/UDP | LDAP |
| 445 | TCP | SMB/CIFS |
| 636 | TCP | LDAPS |
| 3268 | TCP | Global Catalog |

---

## Troubleshooting Procedure

### Isolating S3 AP AccessDenied

```bash
# Step 1: Verify S3 layer connectivity with HeadBucket
aws s3api head-bucket --bucket <S3_AP_ARN>
# Success → S3 layer is OK

# Step 2: Attempt a data operation with ListObjectsV2
aws s3api list-objects-v2 --bucket <S3_AP_ARN> --max-keys 1
# AccessDenied → File-system layer issue

# Step 3: HeadBucket=OK + ListObjectsV2=AccessDenied → AD DC issue
# Verify DC discovery via ONTAP REST API:
curl -k -u admin:pass \
  "https://<MGMT_LIF>/api/protocols/cifs/domains?svm.name=<SVM>&fields=discovered_servers"
# Empty discovered_servers = AD DC unreachable
```

### Recovering AD DC Reachability

1. **Security Group**: Verify SVM ENI's SG allows the required ports to AD DCs
2. **NACL**: Verify SVM subnet NACLs are not blocking traffic
3. **DNS**: Verify SVM's DNS configuration can resolve AD DC hostnames
4. **AD DC Status**: Verify AD DCs are running (for AWS Managed AD, check Service Health Dashboard)

### Detecting AD Issues in Lambda Logs

This system's Lambdas (KB Auto-Sync, Transfer Family Ingestion Trigger) emit diagnostic logs on AccessDenied:

```json
{
  "message": "S3 AP AccessDenied — possible AD DC reachability issue",
  "headBucketOk": true,
  "likelyAdIssue": true,
  "guidance": "HeadBucket succeeded but ListObjectsV2 returned AccessDenied..."
}
```

When `likelyAdIssue: true` appears, investigate AD DC reachability — not IAM/policy.

---

## Environment Variable Reference

Optional environment variables for AD DC diagnostics:

| Variable | Purpose | Set On |
|----------|---------|--------|
| `SVM_ID` | AD join state verification via FSx API | KB Auto-Sync, Transfer Family Lambda |

When `SVM_ID` is set, the Lambda calls FSx `DescribeStorageVirtualMachines` on AccessDenied to confirm the SVM's AD configuration, providing more accurate diagnostics.

---

## Related Documents

- [S3 Vectors + SID Filtering Architecture Guide](s3-vectors-sid-architecture-guide.md)
- [Global Steering: FSx for ONTAP AD Integration](~/.kiro/steering/global-fsx-ontap-ad-integration.md) (local)
- [AWS Docs: FSx for ONTAP S3 Access Points](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/accessing-data-via-s3-access-points.html)
