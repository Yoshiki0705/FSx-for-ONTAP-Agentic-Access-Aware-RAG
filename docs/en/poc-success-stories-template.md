# PoC Success Stories Template

**🌐 Language:** [日本語](../poc-success-stories-template.md) | **English**

**Created**: 2026-05-24  
**Audience**: A collection of success patterns that partners can reference in customer proposals

---

## Template Structure

Each success story is recorded using the following structure:

```markdown
## [Industry] [Company Size] — [One-line summary of the challenge]

### Background
- Industry: 
- Number of employees: 
- Number of files: 
- Existing environment: 

### Challenge
- [Specific challenge 1]
- [Specific challenge 2]

### Deployment Configuration
- Authentication method: 
- Vector store: 
- Permission design: 
- Additional features: 

### Results (Quantitative)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Search time | | | |
| First-response rate | | | |
| Number of inquiries | | | |

### PoC Duration & Cost
- Duration: 
- Monthly AWS cost: 
- Go/No-Go decision: 

### Success Factors
1. 
2. 
3. 

### Next Phase
- 
```

---

## Case 1: Manufacturing (Mid-size) — Improving Design Document Search Efficiency

### Background
- Industry: Manufacturing (precision instruments)
- Number of employees: 500
- Number of files: ~30,000 (design drawing PDFs, technical specifications, quality reports)
- Existing environment: Windows Server 2019 file server + Active Directory

### Challenge
- Design review preparation required an average of 20 minutes per document search
- Same documents managed redundantly across departments (version inconsistencies)
- New employees unable to access past design knowledge

### Deployment Configuration
- Authentication method: SAML Federation (existing AD integration)
- Vector store: S3 Vectors (low cost)
- Permission design: Department SID × Project GID (3 levels)
- Additional features: Smart Routing, KB Auto-Sync

### Results (Quantitative)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Design document search time | 20 min/case | 3 min/case | 85% reduction |
| First-response rate | — | 72% | — |
| Design review preparation time | 2 hours | 30 min | 75% reduction |
| Permission violations | — | 0 cases | — |

### PoC Duration & Cost
- Duration: 3 weeks
- Monthly AWS cost: $480 (S3 Vectors + 128MB/s FSx)
- Go/No-Go decision: **Go** (all required metrics met + 3/4 desirable metrics achieved)

### Success Factors
1. The data owner (Engineering Director) committed early and led test data selection
2. The existing AD group structure could be used directly for permission design
3. Smart Routing processed 90% of queries with Haiku, keeping costs within budget

### Next Phase
- Company-wide rollout (adding Quality Management and Procurement departments)
- Automated quality report ingestion from suppliers via Transfer Family

---

## Case 2: Finance (Regional Bank) — Accelerating Regulatory Document Search

### Background
- Industry: Finance (regional bank)
- Number of employees: 2,000
- Number of files: ~80,000 (regulatory documents, internal audit reports, circulars)
- Existing environment: NetApp FAS + Active Directory + CIFS shares

### Challenge
- Identifying relevant documents during financial regulator examinations took several days
- Per-department access controls were manually managed, creating leakage risk
- Cross-referencing past audit findings was impossible

### Deployment Configuration
- Authentication method: SAML Federation (existing AD)
- Vector store: S3 Vectors
- Permission design: Department SID × Job level × Customer information isolation
- Additional features: Guardrails (PII detection), audit logging, Fail-Closed

### Results (Quantitative)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Regulatory document search time | 4 hours | 15 min | 94% reduction |
| Examination preparation period | 5 days | 1 day | 80% reduction |
| Permission violations | — | 0 cases | — |
| PII detection & masking | — | 100% | — |

### PoC Duration & Cost
- Duration: 4 weeks (including security review)
- Monthly AWS cost: $650 (Guardrails + enhanced monitoring configuration)
- Go/No-Go decision: **Go** (after Legal department approval)

### Success Factors
1. Legal department was included as a stakeholder early, and AI usage policy was agreed upon in advance
2. Fail-Closed design ("deny access when permissions are unclear") earned the trust of the Security department
3. Guardrails PII detection prevented unintended display of customer information

### Next Phase
- Production migration (adding KMS encryption, VPC endpoints)
- Building an Athena analysis platform for audit logs

---

## Case 3: Public Sector (Municipality) — Cross-Referencing Policy Documents

### Background
- Industry: Public sector (city government, population ~300,000)
- Number of staff: 3,000
- Number of files: ~50,000 (ordinances, guidelines, notices, meeting minutes, plans)
- Existing environment: On-premises file server + LGWAN connection

### Challenge
- Similar policy studies duplicated across departments (past findings couldn't be located)
- Collecting relevant documents for legislative session preparation took over a day
- Knowledge from predecessors was not transferred during personnel rotations

### Deployment Configuration
- Authentication method: OIDC (municipal authentication platform integration)
- Vector store: S3 Vectors
- Permission design: Department GID × Position level × Public/Confidential
- Additional features: Voice chat (hands-free search during meetings)

### Results (Quantitative)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Policy document search time | 45 min | 5 min | 89% reduction |
| Legislative session preparation time | 8 hours | 2 hours | 75% reduction |
| Cross-department duplicate studies | 3/month | 0/month | 100% reduction |

### PoC Duration & Cost
- Duration: 4 weeks (led by Information Policy Division)
- Monthly AWS cost: $430 (minimal configuration)
- Go/No-Go decision: **Conditional Go** (additional LGWAN connectivity verification required)

### Success Factors
1. Information Policy Division conducted a data readiness assessment in advance and carefully selected input data
2. Positioning "AI responses are reference information" was communicated to all staff (leveraging the Responsible AI Statement)
3. Voice chat matched the need for instant search during meetings

### Next Phase
- VPC endpoint connectivity verification via LGWAN
- Automated meeting minutes ingestion (Transfer Family)

---

## Disclaimer

> **⚠️ All cases in this document are entirely fictional samples.** They have no relation to any real companies or municipalities. Partners should use these as references for "what kind of results can be expected" during proposals. Actual results will vary significantly depending on the customer's environment, data quality, and usage patterns.

---

## Related Documents

- [PoC Success Criteria Template](poc-success-criteria-template.md)
- [Cost Estimation Worksheet](cost-estimation-worksheet.md)
- [Partner FAQ](partner-faq.md)
