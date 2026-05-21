# Production Readiness Checklist

**🌐 Language:** [日本語](../production-readiness-checklist.md) | **English** | [한국어](../ko/production-readiness-checklist.md) | [简体中文](../zh-CN/production-readiness-checklist.md) | [繁體中文](../zh-TW/production-readiness-checklist.md) | [Français](../fr/production-readiness-checklist.md) | [Deutsch](../de/production-readiness-checklist.md) | [Español](../es/production-readiness-checklist.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Teams considering PoC → Production migration

---

## Overview

This document provides a checklist of items to verify when migrating the Permission-aware RAG system from a PoC environment to a production environment.

---

## Maturity Level Definitions

| Level | Name | Description | Target |
|-------|------|-------------|--------|
| L1 | Demo | Verify operation with bundled sample data and users. Fastest deployment | Technical validation, internal demos |
| L2 | PoC | Connect customer AD/IdP, ingest real files, collect evaluation logs | Customer proposals, effectiveness verification |
| L3 | Production | Multi-account, audit log retention, DR, SLO, threat model, operations Runbook | Production business use |

---

## L1 → L2 (Demo → PoC) Checklist

### Authentication & ID Federation

- [ ] Connect Cognito User Pool to customer IdP (OIDC / SAML / LDAP)
- [ ] Confirm successful SSO sign-in with test users
- [ ] Confirm automatic SID / UID+GID retrieval is working
- [ ] Set `authFailureMode` to `fail-closed` and confirm blocking behavior on permission retrieval failure

### Data Ingestion

- [ ] Place real files (10–100) on FSx for ONTAP volume
- [ ] Confirm `.metadata.json` is generated correctly
- [ ] Confirm Bedrock KB data source sync completes successfully
- [ ] Confirm search results are correctly filtered for users with different permissions

### Evaluation

- [ ] Qualitative evaluation of answer accuracy (10+ questions)
- [ ] Confirm zero permission violations
- [ ] Measure response times (P50 / P95 / P99)

---

## L2 → L3 (PoC → Production) Checklist

### 1. Security

#### Encryption

- [ ] KMS CMK encryption for S3 / DynamoDB / FSx (`enableKmsEncryption=true`)
- [ ] Enable KMS key rotation
- [ ] Enforce TLS 1.2 or higher (CloudFront, ALB, FSx)
- [ ] Manage passwords and API keys with Secrets Manager (do not hardcode in `cdk.context.json`)

#### Network

- [ ] Enable VPC endpoints (`enableVpcEndpoints=true`)
  - S3, DynamoDB, Bedrock, Bedrock Agent, CloudWatch Logs, STS
- [ ] Minimize security group permissions (remove unnecessary inbound rules)
- [ ] Restrict outbound traffic via NAT Gateway
- [ ] Configure appropriate CloudFront Geo restrictions

#### WAF

- [ ] Set production rate limit values (default: 2000 req/5min)
- [ ] Configure IP allow list (internal IPs only)
- [ ] Enable WAF log storage to S3
- [ ] Consider adding Bot Control rules

#### IAM

- [ ] Minimize Lambda execution role permissions
- [ ] Minimize Bedrock KB role permissions
- [ ] Restrict cross-account access
- [ ] Detect unused permissions with IAM Access Analyzer

### 2. Audit & Logging

- [ ] Enable CloudTrail (all regions, management events + data events)
- [ ] Set CloudWatch Logs retention period (minimum 1 year)
- [ ] Enable S3 access logging
- [ ] Track permission changes via DynamoDB Streams
- [ ] Enable Bedrock model invocation logging
- [ ] Prevent audit log tampering (S3 Object Lock / Glacier Vault Lock)
- [ ] Store RAG search logs (user ID, query, referenced documents, filtering results)

### 3. Availability & DR

- [ ] Confirm FSx for ONTAP Multi-AZ configuration
- [ ] Enable DynamoDB Point-in-Time Recovery (PITR)
- [ ] Enable S3 versioning
- [ ] Configure backup schedule (FSx automatic backups)
- [ ] Define and verify RTO / RPO
- [ ] Select DR region and design SnapMirror replication
- [ ] Create manual failover procedure documentation

### 4. Operations

- [ ] Configure CloudWatch dashboard (`enableMonitoring=true`)
- [ ] Set alert thresholds
  - Lambda error rate > 1%
  - Bedrock latency P95 > 10s
  - DynamoDB throttling
  - FSx storage utilization > 80%
- [ ] Create operations Runbook
  - KB re-sync procedure
  - Permission cache force-clear procedure
  - Emergency permission revocation procedure
  - Rollback procedure
- [ ] Define incident response flow
- [ ] Establish on-call structure

### 5. Cost Management

- [ ] Set cost alerts with AWS Budgets
- [ ] Define tagging strategy (Environment, Project, CostCenter)
- [ ] S3 lifecycle policy (Glacier migration for logs)
- [ ] Set appropriate Lambda memory and timeout values
- [ ] Monitor Bedrock model usage
- [ ] Establish monthly cost review process

### 6. Scalability

- [ ] Select DynamoDB capacity mode (On-Demand vs Provisioned)
- [ ] Configure Lambda concurrency limits
- [ ] Verify Bedrock throughput (consider Provisioned Throughput)
- [ ] Set appropriate FSx throughput capacity
- [ ] Optimize CloudFront caching strategy

### 7. Compliance

- [ ] Establish data classification policy (Confidential, Internal, Public)
- [ ] Define personal information handling rules
- [ ] Define data retention periods
- [ ] Prepare terms of service and privacy policy
- [ ] Address industry-specific regulations (Healthcare: HIPAA, Finance: FISC, Public: ISMAP)

### 8. Testing

- [ ] Execute permission matrix tests (see [tests/permission-matrix/](../tests/permission-matrix/))
- [ ] Load testing (2x expected concurrent users)
- [ ] Security testing (penetration testing)
- [ ] DR testing (failover / failback)
- [ ] Permission change propagation testing (ACL change → search result reflection)

---

## Final Verification Before Production Deployment

```bash
# 1. Verify changes with CDK diff
npx cdk diff --all

# 2. Security scan
npx cdk synth --quiet | cfn-nag

# 3. Run tests
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. Deploy (with approval)
npx cdk deploy --all --require-approval broadening
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [permission-consistency.md](permission-consistency.md) | Permission Change Consistency Model |
| [governance-and-audit.md](governance-and-audit.md) | Governance and Audit Design |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Multi-Tenant Deployment Patterns |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Safe Experimentation Guide |
| [evaluation.md](evaluation.md) | RAG / Agent Evaluation Metrics |
