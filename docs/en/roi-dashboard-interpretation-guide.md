# ROI Dashboard Interpretation Guide

**🌐 Language:** [日本語](../roi-dashboard-interpretation-guide.md) | **English**

**Created**: 2026-05-24  
**Audience**: Business sponsors, Project managers, Evaluation leads

---

## How to Read the Dashboard

The ROI Dashboard (`{prefix}-roi-metrics`) consists of 3 rows and 6 widgets.

---

## Row 1: Usage

### Daily Query Count

| State | Meaning | Action |
|-------|---------|--------|
| Increasing trend | User adoption is progressing | Success. Begin considering the next phase |
| Flat | Stable usage | No action needed |
| Decreasing trend | Possible user attrition | Conduct user interviews. Check response quality |
| Zero | System unused or outage | Check alarms. Verify user awareness |

**Baseline Setting**: Record the average value from the first week after PoC launch as the "initial baseline."

### Smart Routing Distribution

| State | Meaning | Action |
|-------|---------|--------|
| Simple 80%+ | Normal (most queries are simple) | Cost-efficient state |
| Full-context 20%+ | Complex queries increasing | Possible cost increase. Review use cases |
| Full-context spike | Anomaly (attack or misconfiguration) | Check cost anomaly alerts. Review Guardrails |

### User Feedback

| State | Meaning | Action |
|-------|---------|--------|
| 👍 80%+ | High response quality | Success metric achieved |
| 👎 30%+ | Response quality issues | Analyze query patterns from negative feedback |
| No feedback | Buttons not being used | Improve UI visibility. Guide users |

---

## Row 2: Performance & Security

### Response Time P50/P95/P99

| Metric | Target (PoC) | Action When Exceeded |
|--------|-------------|---------------------|
| P50 | < 3 seconds | Normal range |
| P95 | < 10 seconds | Check model selection. Check context size |
| P99 | < 30 seconds | Check Cold Start impact. Consider Provisioned Concurrency |

### Permission Filtering (Denial Count)

| State | Meaning | Action |
|-------|---------|--------|
| Stable (low value) | Normal. Permission design is appropriate | No action needed |
| Spike | Permission change occurred or unauthorized access attempt | Check CloudTrail. Review permission design |
| Zero | Everyone can access all documents (permission design issue) | Review permission design |

### Cache Invalidations

| State | Meaning | Action |
|-------|---------|--------|
| Low frequency | Few permission changes (stable operations) | No action needed |
| High frequency | Frequent permission changes | Consider stabilizing permission design |

---

## Row 3: Operations

### KB Auto-Sync Activity

| State | Meaning | Action |
|-------|---------|--------|
| Changed Files > 0 | New documents are being added | Normal |
| Ingestion Jobs increasing | KB is being kept up to date | Normal |
| Changed Files = 0 (extended period) | Document additions have stopped | Check the data ingestion flow |

### Guardrail Decisions

| State | Meaning | Action |
|-------|---------|--------|
| Allowed >> Blocked | Normal usage | No action needed |
| Blocked spike | Increase in inappropriate queries or Guardrails settings too strict | Review Guardrails configuration |

---

## ROI Calculation Method

```
Monthly ROI = (Time Saved × Hourly Rate) - System Cost

Time Saved = (Manual search time - AI search time) × Monthly query count
           = (Before value - P50 response time) × Daily Query Count × Business days

Example:
  Before: 15 min/case (manual search)
  After: P50 = 3 seconds ≈ 0.05 min
  Monthly queries: 500
  Hourly rate: ¥5,000/hour

  Time Saved = (15 - 0.05) × 500 = 7,475 min = 124.6 hours
  Cost Saved = 124.6 × ¥5,000 = ¥623,000/month
  System Cost = $430 × 150 = ¥64,500/month
  Monthly ROI = ¥623,000 - ¥64,500 = ¥558,500/month
```

**How to Set the Before Value**: Before PoC launch, measure "current average search time" via user survey and set it as an Annotation (horizontal line) on the CloudWatch Dashboard.

---

## Related Documents

- [RAG / Agent Evaluation Framework](evaluation.md)
- [PoC Success Criteria Template](poc-success-criteria-template.md)
- [Cost Estimation Worksheet](cost-estimation-worksheet.md)
