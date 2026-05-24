# Feedback Utilization & Feature Gate Operations Guide

**🌐 Language:** [日本語](../feedback-and-feature-gate-operations.md) | **English**

**Created**: 2026-05-24  
**Audience**: Operations team, Product Owners

---

## Part 1: Feedback → Improvement Flow

### Weekly Feedback Review Procedure

```
Every Monday:
1. Aggregate the previous week's data from the DynamoDB feedback table
2. Analyze query patterns from negative feedback
3. Determine improvement actions
4. Verify effectiveness the following week
```

### Aggregation Query (Athena or CLI)

```bash
# Previous week's positive/negative ratio
aws dynamodb query \
  --table-name ${PREFIX}-rag-feedback \
  --index-name date-rating-index \
  --key-condition-expression "#d = :date" \
  --expression-attribute-names '{"#d":"date"}' \
  --expression-attribute-values '{":date":{"S":"2026-05-20"}}' \
  --region ap-northeast-1

# Query patterns with the most negative feedback
# → Identify patterns using the queryPreview field
```

### Improvement Action Matrix

| Negative Pattern | Probable Cause | Action |
|-----------------|----------------|--------|
| "Tell me about XX" → No answer | Document not registered | Add the relevant document to the KB |
| Inaccurate answer | Inappropriate chunking | Change chunking strategy to HIERARCHICAL |
| Outdated answer | KB sync delay | Shorten polling interval or switch to CloudTrail mode |
| Answer too long/short | Prompt issue | Adjust Agent instruction |
| Permission error | Permission design issue | Check `allowed_group_sids` in `.metadata.json` |

---

## Part 2: Feature Gate Operations Guide

### Recommended Gradual Rollout Flow

```
Stage 1: Internal testing (enabledUsers only)
  ↓ 1 week, error rate < 1%, negative feedback < 10%
Stage 2: 25% rollout (rolloutPercentage: 25)
  ↓ 1 week, same criteria
Stage 3: 50% rollout
  ↓ 1 week, same criteria
Stage 4: 100% rollout (defaultEnabled: true)
```

### Verification Checklist for Each Stage

| Check Item | Threshold | Action When Exceeded |
|-----------|-----------|---------------------|
| Lambda error rate | < 1% | Rollback (revert rolloutPercentage to previous stage) |
| Negative feedback rate | < 20% | Root cause analysis → fix then resume |
| Response time P95 | < 10 seconds | Performance investigation |
| Cost increase rate | < 150% of baseline | Cost optimization → resume |

### Rollback Procedure

```bash
# Immediate rollback: Set rolloutPercentage to 0
aws dynamodb update-item \
  --table-name ${PREFIX}-feature-gates \
  --key '{"featureId":{"S":"hybrid-search"}}' \
  --update-expression "SET rolloutPercentage = :zero" \
  --expression-attribute-values '{":zero":{"N":"0"}}' \
  --region ap-northeast-1

# Full disable: Set defaultEnabled to false
aws dynamodb update-item \
  --table-name ${PREFIX}-feature-gates \
  --key '{"featureId":{"S":"hybrid-search"}}' \
  --update-expression "SET defaultEnabled = :false, rolloutPercentage = :zero" \
  --expression-attribute-values '{":false":{"BOOL":false},":zero":{"N":"0"}}' \
  --region ap-northeast-1
```

### Feature Gate Change Auditing

Changes to the Feature Gate table are automatically recorded in CloudTrail. To review change history:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=${PREFIX}-feature-gates \
  --region ap-northeast-1 \
  --query 'Events[*].{Time:EventTime,User:Username,Event:EventName}'
```

---

## Related Documents

- [ROI Dashboard Interpretation Guide](roi-dashboard-interpretation-guide.md)
- [RAG / Agent Evaluation Framework](evaluation.md)
- [Safe Experimentation Guide](safe-experimentation-guide.md)
