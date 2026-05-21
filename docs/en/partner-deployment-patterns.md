# Multi-Tenant / Partner Deployment Patterns

**🌐 Language:** [日本語](../partner-deployment-patterns.md) | **English** | [한국어](../ko/partner-deployment-patterns.md) | [简体中文](../zh-CN/partner-deployment-patterns.md) | [繁體中文](../zh-TW/partner-deployment-patterns.md) | [Français](../fr/partner-deployment-patterns.md) | [Deutsch](../de/partner-deployment-patterns.md) | [Español](../es/partner-deployment-patterns.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Partner companies, SaaS providers, multi-tenant architects

---

## Overview

This document organizes architecture patterns for partner companies deploying the Permission-aware RAG system to multiple customers. It provides design guidelines for per-customer data isolation, authentication isolation, and cost isolation.

---

## Target Customers & Industries

| Industry | Use Case | Permission Requirements |
|----------|----------|------------------------|
| Manufacturing | Department-based search of design drawings and technical documents | Department × Project × Confidentiality level |
| Finance | Permission-based search of regulatory documents and internal reports | Department × Role × Customer information isolation |
| Public Sector | Bureau-based search of policy documents and internal materials | Bureau × Position × Public/Non-public |
| Healthcare | Department-based search of procedure manuals and research materials | Department × Profession × Patient information isolation |
| Legal | Case-based search of contracts and precedents | Case × Assignee × Client isolation |
| Education | Faculty-based search of teaching materials and research resources | Faculty × Staff/Student × Lab |

---

## Deployment Pattern Comparison

### Pattern A: AWS Account Isolation per Customer (Recommended: Enterprise)

```
┌─────────────────────────────────────────────────────────┐
│ Partner Management Account                                │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ CDK Pipelines   │  │ StackSets       │               │
│ │ / CodePipeline  │  │ (Template dist) │               │
│ └────────┬────────┘  └────────┬────────┘               │
└──────────┼────────────────────┼─────────────────────────┘
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐      ┌──────────────┐
    │ Customer A  │      │ Customer B  │      │ Customer C   │
    │ Account     │      │ Account     │      │ Account      │
    │             │      │             │      │              │
    │ ・FSx ONTAP │      │ ・FSx ONTAP │      │ ・FSx ONTAP  │
    │ ・Bedrock KB│      │ ・Bedrock KB│      │ ・Bedrock KB │
    │ ・Cognito   │      │ ・Cognito   │      │ ・Cognito    │
    │ ・DynamoDB  │      │ ・DynamoDB  │      │ ・DynamoDB   │
    │ ・CloudFront│      │ ・CloudFront│      │ ・CloudFront │
    └─────────────┘      └─────────────┘      └──────────────┘
```

**Advantages**:
- Complete data isolation (AWS account boundary)
- Per-customer billing separation
- Limited blast radius for security incidents
- Independent operations and scaling per customer

**Disadvantages**:
- Account management operational overhead
- Duplicate costs for shared components
- Deployment pipeline complexity

**Applicable when**:
- Customers have their own AWS accounts
- Strict data isolation requirements exist (finance, healthcare, public sector)
- Customer count is 10 or fewer

### Pattern B: SVM / Volume / Prefix Isolation within 1 Account

```
┌─────────────────────────────────────────────────────────────────┐
│ Shared AWS Account                                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ FSx for ONTAP File System                                  │    │
│  │                                                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │ SVM-A    │  │ SVM-B    │  │ SVM-C    │               │    │
│  │  │(Customer │  │(Customer │  │(Customer │               │    │
│  │  │ A)       │  │ B)       │  │ C)       │               │    │
│  │  │ Vol-A1   │  │ Vol-B1   │  │ Vol-C1   │               │    │
│  │  │ Vol-A2   │  │ Vol-B2   │  │ Vol-C2   │               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ KB-A     │  │ KB-B     │  │ KB-C     │  ← KB per tenant     │
│  │ S3 AP-A  │  │ S3 AP-B  │  │ S3 AP-C  │  ← AP per tenant    │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Shared Resources                                           │    │
│  │ ・CloudFront + WAF (shared, path-based routing)           │    │
│  │ ・Cognito User Pool (isolated by tenant attribute)        │    │
│  │ ・DynamoDB (tenant ID partition key)                      │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Advantages**:
- Consolidated operations (single account management)
- Shared cost for common components
- Simplified deployment

**Disadvantages**:
- Data isolation at application level (misconfiguration risk)
- Billing apportionment required
- Potential noisy neighbor issues

**Applicable when**:
- Customer count is large (10+ companies)
- Cost efficiency is prioritized
- Data isolation requirements are relatively relaxed

### Pattern C: Hybrid (Shared Management Plane + Isolated Data Plane)

```
┌─────────────────────────────────────────────────────────┐
│ Partner Management Account                                │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Management Plane (Shared)                             │  │
│ │ ・CDK Pipelines / Deployment automation              │  │
│ │ ・Tenant management API                              │  │
│ │ ・Monitoring dashboard (aggregated)                  │  │
│ │ ・Billing management                                 │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │ Data Plane (Isolated per customer)            │
    │                                              │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │Customer A│  │Customer B│  │Customer C│  │
    │  │ VPC      │  │ VPC      │  │ VPC      │  │
    │  │ FSx+KB   │  │ FSx+KB   │  │ FSx+KB   │  │
    │  └──────────┘  └──────────┘  └──────────┘  │
    └─────────────────────────────────────────────┘
```

---

## Tenant Isolation Design Elements

### 1. Storage Isolation

| Isolation Level | Method | Data Isolation Strength | Cost |
|----------------|--------|------------------------|------|
| File system isolation | FSx file system per customer | Highest | High |
| SVM isolation | SVM isolation within 1 file system | High | Medium |
| Volume isolation | Volume isolation within 1 SVM | Medium | Low |
| Prefix isolation | Directory isolation within 1 volume | Low | Lowest |

**Recommended**: SVM isolation (Pattern B) or file system isolation (Pattern A)

### 2. Vector Store Isolation

| Method | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| KB per tenant | Separate KB + Index | Separate KB + Collection |
| Shared KB + metadata filter | Filter by `tenant_id` metadata | Filter by `tenant_id` field |

**Recommended**: KB per tenant (clear security boundary)

### 3. Authentication Isolation

| Method | Description | Applicable Pattern |
|--------|-------------|-------------------|
| Cognito User Pool isolation | User Pool per tenant | Pattern A |
| Cognito group isolation | Shared User Pool + tenant groups | Pattern B |
| Custom attribute isolation | `custom:tenant_id` attribute | Pattern B |
| External IdP isolation | OIDC/SAML IdP per tenant | Pattern A/C |

### 4. Log & Audit Isolation

| Resource | Isolation Method |
|----------|-----------------|
| CloudWatch Logs | Log group or prefix per tenant |
| CloudTrail | Trail per tenant (Pattern A) or shared Trail + filter |
| DynamoDB audit table | `tenantId` partition key |
| S3 log bucket | Prefix per tenant + bucket policy |

### 5. KMS Encryption Isolation

| Method | Description | Cost |
|--------|-------------|------|
| CMK per tenant | Complete encryption isolation | CMK × tenant count |
| Shared CMK + key policy | Cost efficiency priority | 1 CMK |
| Tenant-managed CMK (BYOK) | Customer manages keys | Customer bears cost |

---

## Automated Deployment with CDK

### StackSets Pattern (for Pattern A)

```typescript
// Deploy from partner management account to customer accounts
const stackSet = new CfnStackSet(this, 'TenantStackSet', {
  stackSetName: 'permission-aware-rag-tenant',
  templateBody: tenantTemplate,
  parameters: [
    { parameterKey: 'TenantId', parameterValue: tenantId },
    { parameterKey: 'TenantDomain', parameterValue: tenantDomain },
  ],
  permissionModel: 'SERVICE_MANAGED',
  autoDeployment: { enabled: true, retainStacksOnAccountRemoval: false },
});
```

### CDK Pipelines Pattern (for Pattern C)

```typescript
// Add a stage for each tenant
for (const tenant of tenants) {
  pipeline.addStage(new TenantStage(this, `Tenant-${tenant.id}`, {
    env: { account: tenant.accountId, region: tenant.region },
    tenantConfig: tenant,
  }));
}
```

---

## Proposal Template

### Before / After

| Aspect | Before (Current State) | After (With This System) |
|--------|----------------------|--------------------------|
| File search | Manual exploration of shared folders, low search accuracy | AI presents optimal documents within permission scope |
| Permission management | Risk of permission boundaries disappearing during AI use | Existing NTFS ACL directly reflected in AI |
| Knowledge utilization | Knowledge silos between departments, person-dependent | Cross-organizational knowledge search while respecting permissions |
| Operational overhead | Data copy and permission reconfiguration needed for AI | Connect data on FSx directly to AI |

### PoC Success Criteria

| Metric | Target Value | Measurement Method |
|--------|-------------|-------------------|
| Answer accuracy | 80%+ (human evaluation) | Judged with 50-question evaluation set |
| Permission control | 0 violations | Verified with permission matrix test |
| Response time | P95 < 10 seconds | CloudWatch metrics |
| Operational effort | 50% reduction vs. current | Admin interviews |

### Additional Considerations for Production

| Category | Considerations |
|----------|---------------|
| ID federation | SSO integration with existing AD / IdP, MFA requirements |
| Audit | Search log retention, access trail, periodic review |
| Data classification | Confidentiality level definitions, AI usage eligibility criteria |
| Cost management | Monthly budget, scaling plan, cost allocation |
| SLA | Availability targets, RPO/RTO, support structure |
| Legal | Terms of service, data processing agreement, responsibility boundaries |

---

## Cost Estimation Template

### Monthly Estimate (Small-scale PoC)

| Resource | Configuration | Monthly Estimate |
|----------|---------------|-----------------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $300 |
| S3 Vectors | ~10,000 vectors | $5 |
| Bedrock (Titan Embed) | Initial + incremental sync | $10 |
| Bedrock (Claude) | 1,000 queries/month | $50 |
| Lambda | WebApp + sync | $20 |
| CloudFront + WAF | Base fee | $15 |
| DynamoDB | On-demand | $5 |
| Cognito | ~50 users | $0 (free tier) |
| **Total** | | **~$400/month** |

### Monthly Estimate (Production: Medium-scale)

| Resource | Configuration | Monthly Estimate |
|----------|---------------|-----------------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $3,000 |
| OpenSearch Serverless | 4 OCU | $1,400 |
| Bedrock (Titan Embed) | Periodic sync | $50 |
| Bedrock (Claude Sonnet) | 10,000 queries/month | $500 |
| Lambda | WebApp + sync + monitoring | $100 |
| CloudFront + WAF | Production traffic | $100 |
| DynamoDB | Provisioned | $50 |
| Cognito | ~500 users | $25 |
| CloudWatch | Logs + metrics + alarms | $50 |
| **Total** | | **~$5,300/month** |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production Readiness Checklist |
| [governance-and-audit.md](governance-and-audit.md) | Governance and Audit Design |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Sizing and Performance |
