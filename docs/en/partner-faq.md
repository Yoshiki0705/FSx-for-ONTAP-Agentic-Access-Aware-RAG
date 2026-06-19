# Partner FAQ (Frequently Asked Questions)

**🌐 Language:** [日本語](../partner-faq.md) | **English** | [한국어](../ko/partner-faq.md) | [简体中文](../zh-CN/partner-faq.md) | [繁體中文](../zh-TW/partner-faq.md) | [Français](../fr/partner-faq.md) | [Deutsch](../de/partner-faq.md) | [Español](../es/partner-faq.md)

**Created**: 2026-05-24  
**Audience**: Partner companies, system integrators, and consulting firms

---

## Common Questions During Customer Proposals

### Q1. Is it possible to migrate from an existing file server (Windows Server)?

**A**: Yes. FSx for ONTAP supports the same SMB/CIFS protocol as Windows Server file servers and preserves NTFS ACLs as-is. By joining it to your existing Active Directory domain, the user experience remains unchanged. AWS DataSync or robocopy can be used for migration.

**Related Document**: [FSx for ONTAP Sizing and Performance Design](fsxn-sizing-and-performance.md)

---

### Q2. Who configures permissions? Is additional setup required?

**A**: Existing NTFS ACLs / UNIX permissions are automatically reflected in RAG search results. No additional permission configuration is needed. When file server administrators set folder permissions as usual, those permissions are automatically applied to RAG search results.

**How it works**: Permission information (SID/UID/GID) is recorded in each file's `.metadata.json`, and at search time, results are filtered by matching against the user's permissions.

---

### Q3. How many files can the system handle?

**A**: We recommend the following configurations by scale:

| Scale | File Count | FSx Configuration | Monthly Estimate |
|-------|-----------|-------------------|-----------------|
| Small (PoC) | Up to 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| Medium | Up to 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| Large | Up to 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**Related Document**: [Cost Estimation Worksheet](cost-estimation-worksheet.md)

---

### Q4. Can it integrate with existing identity providers (Active Directory / Okta / Auth0)?

**A**: Yes. The following authentication methods are supported:

| Authentication Method | Supported IdPs | SID/Permission Retrieval |
|----------------------|----------------|--------------------------|
| SAML Federation | AD + IAM Identity Center, AD FS | Post-Auth Trigger retrieves SID from AD automatically |
| OIDC | Auth0, Okta, Keycloak, Entra ID | OIDC group claims + LDAP query |
| LDAP | OpenLDAP, FreeIPA | Direct UID/GID retrieval |
| Email/Password | Cognito | Manual registration in DynamoDB |

**Related Document**: [Authentication and User Management Guide](auth-and-user-management.md)

---

### Q5. How long does a PoC take and what does it cost?

**A**: 

| Phase | Duration | AWS Cost | Activities |
|-------|----------|----------|------------|
| Deployment | 1 day | — | CDK deploy + test data ingestion |
| Basic Validation | 1 week | ~$100 | Functional verification with demo data |
| Customer Data PoC | 2-4 weeks | ~$430/month | Real data ingestion + evaluation |

A **90-minute hands-on workshop** is also available → [PoC Workshop Guide](poc-workshop-guide.md)

---

### Q6. Can this be proposed to customers with strict security requirements (finance, healthcare, public sector)?

**A**: Yes. The system includes the following security features:

- 6-layer defense (Geo restriction → WAF → OAC → IAM Auth → Cognito → SID filtering)
- KMS encryption (S3, DynamoDB, FSx)
- VPC endpoints (no internet traversal)
- Audit logs (CloudTrail + DynamoDB audit table)
- Fail-Closed design (access denied when permissions are unknown)
- Bedrock Guardrails (content filtering, PII detection)

**However**: The technical security features of this system do not automatically satisfy legal or compliance requirements. For regulated workloads, customer-specific legal and compliance assessments are required.

**Related Documents**: [Production Readiness Checklist](production-readiness-checklist.md), [Threat Model](threat-model.md)

---

### Q7. Is multi-tenancy (deployment to multiple customers) possible?

**A**: Yes. Three deployment patterns are available:

| Pattern | Isolation Level | Applicable Conditions |
|---------|----------------|----------------------|
| A: Account isolation | Highest | Strict data isolation requirements (finance, healthcare) |
| B: SVM isolation | High | Isolate customer data within the same account |
| C: Prefix isolation | Medium | Cost-focused, small-scale customers |

**Related Document**: [Partner Deployment Patterns](partner-deployment-patterns.md)

---

### Q8. How are documents received from external partners (law firms, audit firms)?

**A**: SFTP ingestion via AWS Transfer Family is supported. Partners simply upload files using an SFTP client, and permission metadata is automatically assigned before ingestion into the RAG Knowledge Base.

- Partners do not need access to the Web UI or AWS Console
- `.metadata.json` overwrite is prevented by IAM Deny (trust boundary protection)
- Files become RAG-searchable within 5 minutes

**Related Document**: [Transfer Family Partner Onboarding](transfer-family-partner-onboarding.md)

---

### Q9. Can questions be asked via voice?

**A**: Yes. Two voice chat modes are available:

| Mode | Technology | Latency | Status |
|------|-----------|---------|--------|
| Phase 1 (REST) | Amazon Nova Sonic | Medium | GA, CDK deployable |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | Low | Implemented, CLI deploy |

Permission filtering is applied throughout the entire flow: voice input → text conversion → permission-aware RAG search → voice output.

---

### Q10. What about integration with other AWS services?

**A**: The following services are already integrated:

| Service | Purpose |
|---------|---------|
| Amazon Bedrock (KB + Agent) | RAG search + multi-agent collaboration |
| Amazon Cognito | Authentication and user management |
| Amazon CloudFront + WAF | CDN + security |
| Amazon S3 Vectors | Vector DB (low cost) |
| Amazon EventBridge | KB auto-sync scheduling |
| AWS Transfer Family | SFTP ingestion |
| Amazon CloudWatch | Monitoring, alerts, dashboards |
| AWS Step Functions | FSx for ONTAP operations automation |

---

## Technical FAQ

### Q11. What is the difference between S3 Access Point and S3 bucket?

**A**: S3 Access Point is an S3-compatible access interface for FSx for ONTAP volumes. Unlike S3 buckets:

- Data remains on FSx for ONTAP (it is not copied to S3)
- The same data can be accessed via both NFS/SMB and S3 API
- There is a 5GB upload size limit
- rename / append operations are not supported

---

### Q12. What about rollback if deployment fails?

**A**: CDK is CloudFormation-based, so failed deployments are automatically rolled back. If manual rollback is needed:

```bash
# Delete a specific stack
npx cdk destroy <stack-name>

# Delete all stacks
npx cdk destroy --all --force
```

**Related Document**: [Deployment Troubleshooting](deployment-troubleshooting.md)

---

## Resources for Proposals and Workshops

| Resource | Purpose | Link |
|----------|---------|------|
| Industry-specific demo data | Demos tailored to customer industry | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| 90-minute workshop | Hands-on experience | [PoC Workshop Guide](poc-workshop-guide.md) |
| Cost estimation | Proposal attachment | [Cost Estimation Worksheet](cost-estimation-worksheet.md) |
| PoC success criteria | Customer agreement | [PoC Success Criteria Template](poc-success-criteria-template.md) |
| Production readiness checklist | Migration planning | [Production Readiness Checklist](production-readiness-checklist.md) |
| Architecture diagram | Proposal attachment | Architecture section in README.md |
