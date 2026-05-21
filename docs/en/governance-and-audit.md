# Governance and Audit Design

**🌐 Language:** [日本語](../governance-and-audit.md) | **English** | [한국어](../ko/governance-and-audit.md) | [简体中文](../zh-CN/governance-and-audit.md) | [繁體中文](../zh-TW/governance-and-audit.md) | [Français](../fr/governance-and-audit.md) | [Deutsch](../de/governance-and-audit.md) | [Español](../es/governance-and-audit.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Security officers, compliance officers, public/healthcare/financial sector

---

## Overview

This document organizes the audit log design, governance framework, and Responsible AI implementation guidelines for the Permission-aware RAG system. The goal is to make it explainable: "who, when, based on which documents, received what answers."

---

## Audit Log Schema

### RAG Search Audit Log

The following information is recorded for all RAG search requests.

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Agent Mode Audit Log

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### Permission Change Audit Log

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## Log Storage & Protection Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Audit Log Flow                              │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3 (Audit Log Bucket)   │ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock (WORM)    │ │
│  └──────────┘    │ Retention:1yr│    │ ・KMS Encryption        │ │
│                  └──────────────┘    │ ・Lifecycle:            │ │
│                                      │   90d→IA, 365d→Glacier  │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API calls│    │ (Data events)│                                │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ Perm     │    │ Streams      │───▶ Permission Change Audit Log │
│  │ changes  │    └──────────────┘                                │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Configuration

| Component | Setting | Purpose |
|-----------|---------|---------|
| CloudWatch Logs | Retention: 1 year | Operational logs, debugging |
| S3 Audit Log Bucket | Object Lock (Governance Mode) | Tamper prevention |
| KMS CMK | Auto-rotation enabled | Encryption |
| CloudTrail | Management + Data events | API call tracking |
| S3 Lifecycle | 90 days → IA, 365 days → Glacier | Cost optimization |
| Athena | Partitioned tables | Log analysis and search |

---

## Responsible AI / Guardrails Design

### Leveraging Bedrock Guardrails

Guardrails configuration enabled with `enableGuardrails=true`:

| Policy | Purpose | Configuration Example |
|--------|---------|----------------------|
| Content filter | Detect and block harmful content | HATE: HIGH, VIOLENCE: HIGH |
| Topic policy | Define prohibited topics | Competitor information, investment advice |
| PII detection | Detect and mask personal information | Names, phone numbers, email addresses |
| Word filter | Block prohibited phrases | Internal code names, unreleased information |

### Guardrails Sample Policy

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### Controls by Data Classification

| Data Classification | Search | Summary | Citation | Agent Use |
|--------------------|--------|---------|----------|-----------|
| Public | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Internal | ✅ Allowed | ✅ Allowed | ⚠️ Summary only | ✅ Allowed |
| Confidential | ✅ Allowed (authorized only) | ⚠️ Restricted | ❌ No verbatim citation | ⚠️ With approval |
| Top Secret | ⚠️ With approval | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited |

### Human Approval for Agent Mode

Design where the Agent requests human approval before executing external actions:

```
Agent attempts to invoke "Send Email" tool
  → AgentCore Policy detects "External Communication" category
  → Generates Human Approval request
  → UI displays approval/rejection prompt to user
  → Action executed only after approval
```

---

## Industry-Specific Use Cases and Regulatory Compliance

### Healthcare

| Requirement | Implementation |
|-------------|---------------|
| Patient information isolation | Department-specific SID groups + PII masking |
| Department-specific procedure search | Filter by department SID |
| Audit trail | 5-year retention of all search logs |
| Consent management | Include patient consent flag in metadata |
| Prohibit medical diagnosis | DENY via Guardrails topic policy |

**Regulatory compliance**: Guidelines for Safety Management of Healthcare Information Systems (Ministry of Health, Labour and Welfare)

### Government / Public Sector

| Requirement | Implementation |
|-------------|---------------|
| Bureau-specific document isolation | Bureau SID groups |
| Separation of policy and non-public materials | `access_level` metadata + SID |
| Freedom of information request support | Search log preservation and export capability |
| Personal information protection | PII detection + masking |
| Administrative document management | Document classification metadata assignment |

**Regulatory compliance**: Personal Information Protection Act, ISMAP

### Financial Institutions

| Requirement | Implementation |
|-------------|---------------|
| Strict customer information isolation | Customer ID-based access control |
| Prohibit investment advice | Guardrails topic policy |
| Transaction record preservation | 10-year audit log retention |
| Internal controls | Periodic review of operation logs |
| Encryption requirements | KMS CMK + TLS 1.2 |

**Regulatory compliance**: FISC Security Guidelines, Financial Instruments and Exchange Act

### Educational Institutions

| Requirement | Implementation |
|-------------|---------------|
| Faculty/student permission separation | Role-based SID groups |
| Lab-specific material isolation | Lab SID groups |
| Student personal information protection | PII masking |
| Research data confidentiality | Per-research-project access control |

---

## Audit Report Generation

### Periodic Report Items

| Report | Frequency | Content |
|--------|-----------|---------|
| Access summary | Daily | Search count by user, denial count |
| Permission violation report | Daily | Fail-Closed triggers, anomalous access patterns |
| Guardrails intervention report | Weekly | Filter trigger count, statistics by topic |
| Cost & usage report | Monthly | Token consumption, API call count, storage usage |
| Compliance report | Quarterly | Regulatory requirement conformance status, improvement items |

### Athena Query Examples

```sql
-- Permission denial events in the past 7 days
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- Search pattern analysis by user
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## Handling Personal and Sensitive Information

### Masking / Classification Flow

```
Document ingestion
  → PII scan (Comprehend / Guardrails)
  → Classification label assignment (confidentiality level + PII presence)
  → Record classification info in .metadata.json
  → KB sync
  
At search time
  → SID filtering (access permissions)
  → Guardrails PII detection (output masking)
  → Answer generation (masked)
```

### Approval Flow (Confidential Data Access)

Approval flow when access to top-secret data is required:

1. User submits search request
2. SID matching identifies "approval required" category
3. Approval request notification sent to admin (SNS / Slack)
4. Admin approves → temporary access token issued
5. Access available only during token validity period
6. Access log recorded in audit table

---

## Related Documents

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production Readiness Checklist |
| [permission-consistency.md](permission-consistency.md) | Permission Change Consistency Model |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID Filtering Architecture |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Safe Experimentation Guide |
