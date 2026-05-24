# Audit Event Candidates

**🌐 Language:** [日本語](../audit-event-candidates.md) | **English**

**Created**: 2026-05  
**Status**: Design Candidate (Not Implemented)  
**Purpose**: Audit trail design for the Permission-aware RAG system

---

## Overview

In regulated industries and enterprise environments, the following audit requirements are expected:
1. **Who** uploaded which document
2. **What permission metadata** was generated
3. **When** it was ingested into the Knowledge Base
4. **Why** a specific document was excluded from search results
5. **Voice session** transcript retention policies

---

## Audit Event List

### Document Ingestion Pipeline

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `UploadReceived` | Transfer Family CloudWatch Logs | Partner uploaded a file via SFTP | `userName`, `fileKey`, `fileSize`, `timestamp` |
| `MetadataGenerated` | Metadata Generator Lambda | Permission metadata `.metadata.json` was generated | `fileKey`, `metadataKey`, `uploadedBy`, `allowed_sids`, `allowed_uids`, `allowed_gids` |
| `MetadataGenerationFailed` | Metadata Generator Lambda | Metadata generation failed | `fileKey`, `uploadedBy`, `error`, `snsNotified` |
| `MetadataValidationFailed` | (Future implementation) | Metadata is invalid or tampered | `fileKey`, `metadataKey`, `validationError` |
| `KbIngestionStarted` | Ingestion Trigger Lambda | Bedrock KB StartIngestionJob was initiated | `ingestionJobId`, `knowledgeBaseId`, `dataSourceId`, `detectedFiles`, `changedFiles` |
| `KbIngestionCompleted` | (Future: job completion monitoring) | Bedrock KB ingestion job completed | `ingestionJobId`, `status` (SUCCEEDED/FAILED), `duration` |
| `InventoryUpdated` | KB Auto-Sync Lambda | DynamoDB inventory was updated | `jobId`, `fileCount`, `status` (pending/committed) |

### RAG Retrieval Pipeline

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `DocumentRetrieved` | Next.js API Route (KB Retrieve) | Document was included in RAG search results | `userId`, `queryHash`, `documentKey`, `relevanceScore` |
| `DocumentSuppressedByPermission` | Permission Filter | Document was excluded due to insufficient permissions | `userId`, `documentKey`, `userSids`, `requiredSids`, `reason` |
| `PermissionCheckFailed` | Permission Filter | Permission check itself failed (fail-closed: document excluded) | `userId`, `documentKey`, `error` |
| `RetrievalDecision` | (Future implementation) | Final decision log for search results | `userId`, `queryHash`, `totalRetrieved`, `totalSuppressed`, `totalReturned` |

### Voice Session Pipeline

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `VoiceSessionStarted` | Voice API Route | Voice session was started | `userId`, `sessionId`, `connectionMode` (webrtc/rest), `timestamp` |
| `VoiceSessionEnded` | Voice API Route | Voice session ended | `userId`, `sessionId`, `duration`, `fallbackOccurred` |
| `VoiceTranscriptGenerated` | (Future implementation) | Audio was transcribed to text | `sessionId`, `transcriptHash`, `retentionPolicy` |

### Capacity Guardrails

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `GuardrailCheckPassed` | Guardrails Module | Guardrail check passed | `resourceId`, `actionName`, `mode`, `dailyCount`, `dailyCap` |
| `GuardrailCheckRejected` | Guardrails Module | Operation was rejected by guardrails | `resourceId`, `actionName`, `mode`, `reason`, `dailyCount`, `dailyCap` |
| `GuardrailBreakGlass` | (Future implementation) | All guardrails bypassed via break-glass mode | `resourceId`, `actionName`, `operator`, `justification` |

### Smart Routing

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `RoutingDecision` | Smart Router (EMF) | Model routing decision | `queryHash`, `classification`, `selectedModel`, `confidence`, `isAutoRouted` |
| `RoutingFallback` | Smart Router | Fallback when model is unavailable | `originalModel`, `fallbackModel`, `reason` |
| `ManualModelSelection` | Smart Router | User manually selected a model | `userId`, `selectedModel`, `isPreviewModel` |

---

## Implementation Strategy (Future)

### Phase 1: Structured Log-Based
- Leverage existing CloudWatch Logs structured logs as audit events
- Include the above fields in Lambda function JSON logs
- Queryable via CloudWatch Logs Insights

### Phase 2: Dedicated Audit Table
- DynamoDB audit table (with TTL)
- Audit event publishing via EventBridge
- Long-term storage in S3 (Glacier transition)

### Phase 3: Unified Audit Dashboard
- Add audit widgets to CloudWatch Dashboard
- Anomaly detection alarms (mass suppression, break-glass usage, etc.)
- Automated compliance report generation

---

## Data Retention Policy (Recommended)

| Data Type | Retention Period | Storage | Notes |
|-----------|----------------|---------|-------|
| Upload logs | 1 year | CloudWatch Logs | Transfer Family structured logs |
| Metadata generation logs | 1 year | CloudWatch Logs | Lambda logs |
| KB Ingestion logs | 90 days | CloudWatch Logs | Lambda logs |
| Retrieval Decision logs | 90 days | CloudWatch Logs / DynamoDB | High frequency |
| Voice Transcript | Not stored (default) | — | Adjust per regulatory requirements |
| Voice Audio | Not stored (default) | — | Adjust per regulatory requirements |
| Guardrail decision logs | 30 days | CloudWatch Logs + DynamoDB TTL | |
| Routing Decision | 30 days | CloudWatch Logs (EMF) | Aggregated as metrics |

---

## Security Considerations

### Permission Metadata is Security-Critical Control Data

```
Permission metadata should be treated as security-critical control data,
not application metadata. Changes to permission mappings, metadata generation
logic, or retrieval filtering rules should require the same change management
process as IAM policy changes.
```

### Fail-Closed Responsibility Boundary

```
Fail-closed enforcement happens in the retrieval filtering layer:
documents without valid, trusted permission metadata are excluded
before the model receives context.

Responsibility chain:
1. Metadata Generator Lambda → generates .metadata.json
2. Bedrock KB Ingestion → indexes document + metadata
3. KB Retrieve API → returns documents with metadata
4. Permission Filter (Next.js) → excludes unauthorized documents
5. LLM → receives only authorized context
```

---

## Related Documents

- [Transfer Family Networking Prerequisites](transfer-family-networking-prerequisites.md)
- [Transfer Family E2E Verification](transfer-family-e2e-verification.md)
- [Voice Chat WebRTC Remaining Issues](voice-chat-webrtc-remaining-issues.md)
- [Deployment Troubleshooting](deployment-troubleshooting.md)
