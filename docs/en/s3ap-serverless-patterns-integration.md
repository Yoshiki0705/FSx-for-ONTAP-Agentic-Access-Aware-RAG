# S3AP Serverless Patterns Integration Architecture

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | **English** | [한국어](../ko/s3ap-serverless-patterns-integration.md) | [简体中文](../zh-CN/s3ap-serverless-patterns-integration.md) | [繁體中文](../zh-TW/s3ap-serverless-patterns-integration.md) | [Français](../fr/s3ap-serverless-patterns-integration.md) | [Deutsch](../de/s3ap-serverless-patterns-integration.md) | [Español](../es/s3ap-serverless-patterns-integration.md)

**Created**: 2026-05-23  
**Status**: Draft  
**Audience**: Architects, Partner SAs

---

## Overview

This document describes the integration architecture between [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) (17 UC serverless processing patterns) and this project (Permission-aware Agentic RAG).

---

## Positioning of the Two Projects

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (Enterprise File Server)                                   │
│                                                                         │
│  NAS Data: Blueprints, Contracts, Medical Records, Financial Reports... │
└────────────────────────────────────┬────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (Processing/Transform/       │  │ (Permission-based AI Search  │
│  Analysis)                   │  │  & Conversation)             │
│                              │  │                              │
│ • Step Functions batch       │  │ • Bedrock KB + Converse API  │
│ • AI/ML service integration  │  │ • SID filtering              │
│ • Write results back to FSx  │  │ • Chat UI (Next.js)         │
│                              │  │ • Agent mode                 │
│ 17 Industry UCs              │  │ 14 Agent templates           │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## Integration Patterns

### Pattern A: Making Processing Results Searchable via RAG

Results processed and analyzed by S3AP Serverless Patterns are used as searchable documents in RAG.

```
FSx for ONTAP (Raw Data: DICOM images, Contract PDFs, IoT logs)
  ↓ S3 AP (read)
S3AP Serverless Patterns
  ├─ UC5: DICOM → Metadata extraction & anonymization
  ├─ UC1: Contracts → Entity extraction & classification
  └─ UC3: IoT logs → Anomaly detection & report generation
  ↓ S3 AP (write-back) or S3 bucket
FSx for ONTAP (Processed data + .metadata.json)
  ↓ S3 AP (read)
Permission-aware RAG (Bedrock KB)
  ↓ SID filtering
User: "Which products had quality inspection anomalies last month?"
```

**Benefits**:
- Raw data (images, binaries) is converted to AI-readable text before RAG ingestion
- Permission metadata is attached to processing results, maintaining department-level access control
- Both systems share the same FSx for ONTAP volume (no data copying required)

### Pattern B: Triggering Processing Pipelines from RAG

When a user instructs "Run an analysis" in Agent mode, it triggers the S3AP pattern's Step Functions.

```
User: "Analyze the latest quality inspection images and create a report"
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: Manufacturing Analysis)
  ↓ Processing complete
Agent: "Analysis complete. Here are the results: ..."
```

### Pattern C: Unified Audit & Compliance

S3AP UC1 (Legal/Compliance) audit results are made searchable via RAG, enabling interactive compliance status checks.

```
S3AP UC1: File server audit → Audit report generation
  ↓
RAG: "Are there any files with compliance violations?"
  → Answers from audit reports within the user's permission scope
```

---

## Industry-Specific Integration Mapping

| S3AP UC | Industry | RAG Usage | Agent Template |
|---------|----------|-----------|----------------|
| UC1 | Legal | Audit report search, compliance status checks | `legalCompliance` |
| UC2 | Finance | Search OCR-processed invoices & contracts | `financial` |
| UC3 | Manufacturing | Search quality inspection reports & anomaly detection results | `search` |
| UC5 | Healthcare | Search DICOM metadata & anonymized findings | `medicalGuideline` |
| UC10 | Construction | Search BIM metadata & safety compliance reports | `project` |
| UC13 | Education | Search paper classification results & citation networks | `search` |
| UC14 | Insurance | Search assessment reports & damage evaluation results | `insuranceClaim` |
| UC16 | Government | Search document classification & redacted documents | `publicDocument` |

---

## Deployment Configuration Examples

### Minimal Configuration (Single Account)

```
AWS Account
├── FSx for ONTAP (shared volume)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (selective deployment)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### Enterprise Configuration (Multi-Account)

```
Management Account
├── StackSets (S3AP pattern distribution)
└── CDK Pipelines (RAG distribution)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Multi-tenant deployment patterns |
| [architecture-decision-records.md](architecture-decision-records.md) | ADRs (vector store, permission filter, etc.) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Details of 17 UCs |
