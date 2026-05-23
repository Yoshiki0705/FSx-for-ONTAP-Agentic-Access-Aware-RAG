# Data Readiness Assessment Template

**🌐 Language:** [日本語](../data-readiness-assessment.md) | **English**

**Created**: 2026-05-24  
**Purpose**: A template for assessing data readiness before starting a PoC

---

## Overview

This template helps assess the readiness of data to be ingested into the Permission-aware RAG system, supporting safe and effective PoC execution. It should be completed jointly by the Data Owner and Technical Lead.

---

## 1. Data Location Verification

| # | Item | Response |
|---|------|----------|
| 1.1 | Where is the data physically stored? | ☐ On-premises file server ☐ On AWS (S3/EFS/FSx) ☐ SaaS ☐ Other: ________ |
| 1.2 | Data volume (file count / total size) | File count: ________, Total size: ________ GB |
| 1.3 | File format breakdown | PDF: ___% / DOCX: ___% / TXT: ___% / Other: ___% |
| 1.4 | Data update frequency | ☐ Daily ☐ Weekly ☐ Monthly ☐ Ad-hoc ☐ Static (no updates) |
| 1.5 | Data language | ☐ Japanese ☐ English ☐ Mixed ☐ Other: ________ |

---

## 2. Data Classification

| Sensitivity Level | Definition | Number of Files | Examples |
|-------------------|------------|-----------------|----------|
| **Public** | Can be shared externally | ________ files | Product catalogs, press releases |
| **Internal** | Accessible to all employees | ________ files | Internal policies, benefits information |
| **Department-restricted** | Specific departments only | ________ files | Project plans, technical specifications |
| **Confidential** | Specific roles only | ________ files | Financial reports, HR information |
| **Top Secret** | Named individuals only | ________ files | M&A materials, legal dispute documents |

---

## 3. Permission Structure Verification

| # | Item | Response |
|---|------|----------|
| 3.1 | Current permission management method? | ☐ NTFS ACL (Active Directory) ☐ UNIX permissions ☐ Application-specific ☐ None (everyone has access) |
| 3.2 | Number of permission groups | ________ groups |
| 3.3 | Permission hierarchy structure | ☐ Flat ☐ 2 levels ☐ 3+ levels ☐ Unknown |
| 3.4 | Permission change frequency | ☐ Daily ☐ Weekly ☐ Monthly ☐ Quarterly ☐ Rarely |
| 3.5 | Confidence in permission accuracy | ☐ High ☐ Medium ☐ Low (audit needed) |

---

## 4. Data Quality Verification

| # | Item | Response | Impact |
|---|------|----------|--------|
| 4.1 | Are there scanned PDFs requiring OCR? | ☐ None ☐ Some ☐ Most | Affects RAG accuracy |
| 4.2 | Do file names reflect content? | ☐ Yes ☐ Partially ☐ No | Affects search accuracy |
| 4.3 | Is the folder structure logically organized? | ☐ Yes ☐ Partially ☐ No | Affects permission design |
| 4.4 | Are there duplicate files? | ☐ None ☐ Few ☐ Many | Affects storage costs |
| 4.5 | Are outdated/invalid files mixed in? | ☐ None ☐ Few ☐ Many | Affects answer accuracy |

---

## 5. Compliance and Privacy Verification

| # | Item | Response | Action |
|---|------|----------|--------|
| 5.1 | Does it contain PII? | ☐ No ☐ Yes → Type: ________ | Masking or Guardrails PII detection |
| 5.2 | Is it regulated data? | ☐ No ☐ Yes → Regulation: ________ | Legal review required |
| 5.3 | Are there data export restrictions? | ☐ No ☐ Yes | Affects region selection |
| 5.4 | Are there data retention requirements? | ☐ No ☐ Yes → Period: ________ | Affects backup design |
| 5.5 | Are there audit trail retention requirements? | ☐ No ☐ Yes | `enableMonitoring=true` required |

---

## 6. Data Owner Approval

| Approval Item | Approver | Date | Signature |
|---------------|----------|------|-----------|
| Approve data ingestion for PoC | __________ | ____/____/____ | ________ |
| Confirm data classification accuracy | __________ | ____/____/____ | ________ |
| Confirm permission design validity | __________ | ____/____/____ | ________ |
| Agree to data deletion after PoC | __________ | ____/____/____ | ________ |

---

## 7. Readiness Assessment

Based on responses across all sections, make the following determination:

| Assessment | Conditions |
|------------|------------|
| **Ready** | All sections 1-6 completed, PII addressed, Data Owner approval obtained |
| **Conditional** | Some items incomplete, but can start with demo data → Prepare data in parallel |
| **Not Ready** | Data location unknown, permission structure unknown, PII unconfirmed → Data preparation phase needed first |

**Assessment Result**: ☐ Ready ☐ Conditional ☐ Not Ready

**Assessment Date**: ____/____/____  
**Assessor**: __________

---

## Related Documents

- [Safe Experimentation Guide](safe-experimentation-guide.md) — What can be safely tested and what is prohibited
- [PoC Success Criteria Template](poc-success-criteria-template.md) — Go/No-Go decision criteria
- [Production Readiness Checklist](production-readiness-checklist.md) — L2→L3 migration checklist
- [Governance and Audit Design](governance-and-audit.md) — Audit log schema and retention requirements
