# Next-Generation Features Design Document

**🌐 Language:** [日本語](../next-generation-features-design.md) | **English**

**Created**: 2026-05-24  
**Status**: Design complete (implementation proceeding in phases)

---

## Overview

As the next step after completing v4.3 operational hardening, this document organizes 15 directions into 5 categories.

---

## Category 1: Partner/SI Proposal Acceleration

### #1 Industry-Specific PoC Success Story Templates
**Status**: ✅ Implemented → `docs/poc-success-stories-template.md`

### #2 Multi-Tenant SaaS Template
**Status**: Designed → 3 patterns documented in `docs/partner-deployment-patterns.md`

**Additional Implementation Proposal**:
```
CDK Pipelines Template:
  Management Account → CodePipeline → Parallel deploy to Customer Accounts A/B/C
  
  Separate cdk.context.json per customer:
    configs/customer-a.json
    configs/customer-b.json
    
  Pipeline definition:
    lib/pipeline/multi-tenant-pipeline.ts
```

### #3 Customer-Facing Dashboard
**Status**: Design

**Design**:
```
CloudWatch Dashboard (read-only for customers):
  - Daily/weekly query count
  - Response accuracy (feedback-based)
  - Response time P50/P95
  - Permission filtering statistics (allow/deny ratio)
  - Cost trend (daily)
  - Smart Routing tier distribution

Access method:
  - CloudWatch Dashboard shared link (time-limited)
  - Or Grafana on ECS (for long-term operations)
```

---

## Category 2: Storage Reliability

### #4 S3 AP Performance Benchmark Automation
**Status**: Design

**Design**:
```python
# benchmarks/s3ap-benchmark.py
# Executed from within Lambda (in VPC, same subnet as FSx for ONTAP)

Test matrix:
  object_sizes: [1KB, 10KB, 100KB, 1MB, 10MB, 100MB]
  concurrency: [1, 5, 10, 20, 50]
  operations: [GetObject, PutObject, ListObjectsV2, HeadObject]
  
Output:
  - P50/P90/P95/P99/Max latency
  - Throughput (MB/s)
  - benchmark_run_id (for reproducibility)
  
CloudWatch Custom Metrics:
  Namespace: S3APBenchmark
  Dimensions: ObjectSize, Concurrency, Operation
```

### #5 FlexCache → S3 AP Migration Path
**Status**: Design (awaiting AWS feature release)

**Migration Steps (future)**:
```
1. Attach S3 AP to FlexCache Cache Volume (after feature release)
2. Set a parallel operation period for Embedding server path and S3 AP path
3. Verify S3 AP path operation (run benchmarks)
4. Stop the Embedding server
5. Delete the EmbeddingStack
```

### #6 DR / Read Path Separation Design
**Status**: Design

**Architecture**:
```
┌─────────────────┐     SnapMirror     ┌─────────────────┐
│ Primary Volume   │ ──────────────────▶ │ DR Volume        │
│ (write)          │                     │ (read-only)      │
│ + S3 AP (write)  │                     │ + S3 AP (read)   │
└─────────────────┘                     └────────┬────────┘
                                                  │
                                                  ▼
                                        ┌─────────────────┐
                                        │ Bedrock KB       │
                                        │ (RAG search)     │
                                        └─────────────────┘

Benefits:
  - I/O separation between production writes and RAG reads
  - Reads from DR volume do not impact production performance
  - Clear "maximum delay" based on SnapMirror RPO

Constraints:
  - Delay equal to SnapMirror sync interval (typically 15 min – 1 hour)
  - DR volume is read-only (no writes)
```

---

## Category 3: Governance / Accountability

### #7 RAG Response Provenance Tracking
**Status**: Design + partial implementation (Citations already displayed)

**Additional Implementation**:
```json
// Events recorded in the DynamoDB audit table
{
  "eventType": "RAG_RESPONSE_GENERATED",
  "timestamp": "2026-05-24T10:30:00Z",
  "userId": "admin@example.com",
  "query": "What are the company's sales?",
  "responseId": "resp-uuid-xxx",
  "citations": [
    {
      "documentKey": "confidential/financial-report.md",
      "chunkIndex": 3,
      "relevanceScore": 0.92,
      "permissionCheck": "ALLOWED",
      "matchedSids": ["S-1-5-21-xxx-512"]
    }
  ],
  "modelId": "anthropic.claude-sonnet-4-6",
  "routingTier": "complex",
  "totalTokens": 1536
}
```

### #8 Immediate Permission Change Reflection (Event-Driven ACL Sync)
**Status**: Design

**Architecture**:
```
ACL change event detection:
  Option A: FPolicy (FSx for ONTAP) → SQS → Lambda
  Option B: CloudTrail S3 Data Events → EventBridge → Lambda
  Option C: Periodic scan (current approach, up to 5-minute delay)

Lambda processing:
  1. Regenerate .metadata.json for the changed file
  2. Invalidate DynamoDB permission-cache
  3. Bedrock KB StartIngestionJob (affected file only)

Target: Under 1 minute from ACL change to RAG reflection
```

### #9 AI Usage Policy Organization Template
**Status**: ✅ Implemented → `docs/ai-usage-policy-template.md`

---

## Category 4: Business Value Visualization

### #10 ROI Auto-Measurement Dashboard
**Status**: Design

**Metrics Definition**:
```
ROI = (Time Saved × Hourly Rate) / System Cost

Measurement targets:
  - Search time reduction: (Manual search time - AI search time) × Query count
  - Inquiry reduction: Reduced tickets × Cost per ticket
  - Duplicate work reduction: Detected duplicates × Work cost

Data sources:
  - CloudWatch: Query count, response time
  - DynamoDB: User feedback (👍/👎)
  - Manual input: Before values (manual search time before deployment)
```

### #11 User Feedback Loop
**Status**: Design

**Implementation Proposal**:
```typescript
// Add 👍/👎 buttons to the chat UI
// POST /api/feedback
{
  "responseId": "resp-uuid-xxx",
  "rating": "positive" | "negative",
  "comment": "optional text",
  "userId": "user@example.com",
  "timestamp": "2026-05-24T10:30:00Z"
}

// Store in DynamoDB feedback table
// Aggregate in weekly reports → Use for RAG quality improvement
```

### #12 Gradual Feature Rollout (Feature Gate)
**Status**: Design

**Implementation Proposal**:
```json
// DynamoDB feature-gates table
{
  "featureId": "hybrid-search",
  "enabledGroups": ["engineering", "product"],
  "enabledUsers": ["admin@example.com"],
  "rolloutPercentage": 50,
  "startDate": "2026-06-01",
  "endDate": "2026-06-30"
}

// Extend /api/config/features on the frontend
// Control feature visibility based on user's group membership
```

---

## Category 5: Security / Operations Automation

### #13 Automatic Permission Cache Invalidation
**Status**: Design

**Implementation Proposal**:
```
Trigger:
  - DynamoDB Streams (changes to user-access table)
  - EventBridge Rule

Lambda processing:
  1. Detect the changed user ID
  2. Delete the corresponding record from the permission-cache table
  3. Emit CloudWatch metric (CacheInvalidation count)

CDK:
  - DynamoDB Stream → Lambda → permission-cache deletion
  - Also set TTL on the existing permission-cache table (fallback)
```

### #14 Automatic Escalation on Guardrails Violations
**Status**: Design

**Implementation Proposal**:
```
CloudWatch Alarm:
  Namespace: FSxNOps/Guardrails
  MetricName: GuardrailDecision
  Dimension: Decision=Blocked
  Threshold: 5 times / 1 hour
  
  → SNS → Lambda → Slack/PagerDuty Webhook

Additional:
  Bedrock Guardrails intervention rate:
  Namespace: BedrockGuardrails
  MetricName: GuardrailIntervention
  Threshold: 10 times / 1 hour
```

### #15 Cost Anomaly Detection
**Status**: Design

**Implementation Proposal**:
```
CloudWatch Anomaly Detection:
  Namespace: SmartRouting
  MetricName: RoutingCount
  Dimension: RoutingTier=full-context
  
  Normal: full-context is less than 5% of all queries
  Anomaly: Alert when full-context exceeds 20%

Additional:
  AWS Cost Anomaly Detection:
  - Detect cost anomalies for the Bedrock service
  - Notify when daily cost exceeds 200% of the previous week's average
```

---

## Implementation Priority

| Priority | Item | Rationale |
|----------|------|-----------|
| **P0** | #7 Provenance, #13 Cache Invalidation | Directly impacts security |
| **P1** | #11 Feedback, #14 Escalation, #15 Cost Anomaly | Operational quality |
| **P2** | #10 ROI, #3 Dashboard, #12 Feature Gate | Business value |
| **P3** | #4 Benchmark, #5 FlexCache, #6 DR | Infrastructure optimization |
| **P4** | #2 SaaS, #8 Immediate ACL Sync | Future expansion |

---

## Related Documents

- [PoC Success Stories Template](poc-success-stories-template.md)
- [AI Usage Policy Template](ai-usage-policy-template.md)
- [Governance & Audit Design](governance-and-audit.md)
- [CloudWatch Dashboard Guide](cloudwatch-dashboard-guide.md)
- [FSx for ONTAP Sizing & Performance Design](fsxn-sizing-and-performance.md)
