# PoC Success Criteria Template

**🌐 Language:** [日本語](../poc-success-criteria-template.md) | **English**

**Created**: 2026-05-24  
**Purpose**: A template for defining success criteria to be agreed upon with customers and partners before starting a PoC

---

## Pre-PoC Agreement Items

### 1. Stakeholders

| Role | Name | Organization | Responsibility |
|------|------|--------------|----------------|
| **Business Sponsor** | __________ | __________ | Final Go/No-Go decision, budget approval |
| **Data Owner** | __________ | __________ | Data classification/approval, permission design verification |
| **Technical Lead** | __________ | __________ | Deployment, configuration, technical validation |
| **Evaluator** | __________ | __________ | Answer quality assessment, KPI measurement |
| **Security Lead** | __________ | __________ | Permission design review, audit log verification |
| **Operations Lead** | __________ | __________ | Production migration operations design, SLO definition |

---

### 2. PoC Objectives and Scope

| Item | Details |
|------|---------|
| **Business Problem to Solve** | (e.g., Searching design documents takes an average of 15 minutes, causing project delays) |
| **Target Departments** | (e.g., Design department + Quality management department, 30 people total) |
| **Target Data** | (e.g., 500 design drawing PDFs, 200 technical specifications, 100 quality reports) |
| **PoC Duration** | (e.g., 4 weeks — 2026/06/01 to 2026/06/28) |
| **Budget Cap** | (e.g., AWS costs within $2,000/month) |

---

### 3. Success Metrics (Go/No-Go Criteria)

#### Required Metrics (All must be achieved for Go)

| # | Metric | Target | Measurement Method | Achieved? |
|---|--------|--------|-------------------|-----------|
| 1 | Permission violations | **0 incidents** | Permission matrix test + manual verification | ☐ |
| 2 | Answer accuracy (relevance score) | **3.5/5.0 or higher** | Qualitative evaluation of 10+ questions by evaluator | ☐ |
| 3 | Response time (P95) | **Within 10 seconds** | CloudWatch metrics | ☐ |
| 4 | Availability | **99% or higher** (during PoC period) | CloudWatch alarms | ☐ |

#### Desirable Metrics (Achievement earns bonus points)

| # | Metric | Target | Measurement Method | Achieved? |
|---|--------|--------|-------------------|-----------|
| 5 | Search time reduction rate | 50% or more | User survey (Before/After) | ☐ |
| 6 | First-answer resolution rate | 60% or more | User feedback (👍/👎) | ☐ |
| 7 | User satisfaction | 4.0/5.0 or higher | Post-PoC survey | ☐ |
| 8 | Citation-included answer rate | 90% or more | Automated aggregation | ☐ |

---

### 4. Go/No-Go Decision Criteria

| Decision | Conditions |
|----------|------------|
| **Go (Proceed to next phase)** | All required metrics #1–#4 achieved + 2 or more desirable metrics achieved |
| **Conditional Go** | All required metrics #1–#4 achieved + 1 or fewer desirable metrics → Develop improvement plan and re-evaluate |
| **No-Go (Stop/Reconsider)** | Any required metric not achieved → Root cause analysis → Re-PoC or change direction |

**Decision Date**: Within 5 business days after PoC period ends  
**Decision Maker**: Business Sponsor (as listed in the stakeholder table above)

---

### 5. Next Phase Conditions

After a Go decision, additional conditions for proceeding to production (L2→L3):

- [ ] Security review completed ([Production Readiness Checklist](production-readiness-checklist.md) L2→L3 section)
- [ ] Operations design completed (SLO definition, alarm configuration, runbook creation)
- [ ] Cost estimate approved ([Cost Estimation Worksheet](cost-estimation-worksheet.md))
- [ ] Data Owner approval for production data ingestion
- [ ] Audit log retention design approved

---

### 6. Risks and Assumptions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor data quality (OCR accuracy, missing metadata) | Reduced answer accuracy | Verify quality with sample data before PoC |
| Low user participation rate | Insufficient evaluation data | Share objectives at kickoff, weekly follow-ups |
| Permission design too complex | Increased configuration effort | Start with minimal permission groups |
| Model answer quality below expectations | PoC failure | Address with prompt tuning, chunking strategy changes |

| Assumption | Status |
|------------|--------|
| AWS account available | ☐ Confirmed |
| Target data can be provided | ☐ Confirmed |
| Evaluator assigned | ☐ Confirmed |
| Network requirements (VPN, etc.) confirmed | ☐ Confirmed |

---

### 7. PoC Completion Report Template

At the end of the PoC, create the following report and submit it to the Business Sponsor:

```markdown
## PoC Completion Report

### Summary
- PoC Period: YYYY/MM/DD – YYYY/MM/DD
- Number of Participating Users: XX
- Total Queries: XXX

### Success Metric Achievement Status
| Metric | Target | Actual | Result |
|--------|--------|--------|--------|
| ... | ... | ... | ✅/❌ |

### Go/No-Go Decision
- Decision: Go / Conditional Go / No-Go
- Rationale: ...

### Recommendations for Next Phase
1. ...
2. ...

### Outstanding Issues
1. ...
```

---

## Related Documents

- [Safe Experimentation Guide](safe-experimentation-guide.md) — Defining what can be safely tested during PoC
- [RAG / Agent Evaluation Framework](evaluation.md) — Detailed evaluation metrics and measurement methods
- [Production Readiness Checklist](production-readiness-checklist.md) — Full checklist for L2→L3 migration
- [Cost Estimation Worksheet](cost-estimation-worksheet.md) — Monthly cost estimates by configuration
