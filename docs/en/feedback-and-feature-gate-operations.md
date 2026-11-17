# Feedback Utilization & Feature Gate Operations Guide

**🌐 Language:** [日本語](../feedback-and-feature-gate-operations.md) | **English**

**Created**: 2026-05-24  
**Audience**: Operations team, Product Owners

---

## Part 1: Feedback → Improvement Flow
### Turning it on, and what is stored
Saving feedback is off by default. It stores the question text (up to 500 characters), so it is switched on deliberately.

```bash
npx cdk deploy --all -c enableFeedback=true            # retention is 90 days by default
npx cdk deploy --all -c enableFeedback=true -c feedbackRetentionDays=30
```

When on, the WebApp stack gets the DynamoDB table `${PREFIX}-rag-feedback` and the Lambda `${PREFIX}-feedback-collector`, and each chat answer shows thumbs up and down. When off, the buttons are not shown and `/api/feedback` answers 503 (`feedback_disabled`). If saving fails, the screen shows an error and does not mark the answer as sent.

| Stored field | Content |
|---|---|
| `userId` | The user of the signed-in session (a value sent by the browser is not used) |
| `rating`, `comment` | `positive` / `negative`. The comment is optional, up to 1,000 characters |
| `query` | The question text, up to 500 characters |
| `responseId`, `modelId`, `routingTier` | The answer ID, the model name, the routing class |
| `sourceDocIds` | IDs of the documents the answer cited: the first 24 characters of the SHA-256 of the S3 URI, so no file name is kept (up to 20) |
| `timestamp`, `date`, `ttlEpoch` | Time, date (UTC), and expiry (after the retention days) |

The answer text and the text and names of documents are not stored. Only citations the user was allowed to see are hashed.

### Who can read the feedback
The web app only invokes the collector Lambda and cannot read the table. The operators who run the weekly review read it: attach the managed policy `${PREFIX}-feedback-reader` (output `FeedbackReaderPolicyArn`) to their role. It allows `Query`, `GetItem`, `BatchGetItem` and `Scan` only.

### Weekly Feedback Review Procedure
```
Every Monday:
1. Count the previous 7 days of positive / negative with date-rating-index
2. Analyze the patterns in the negative query (question text)
3. Turn the cited document IDs back into names (below)
4. Decide improvement actions and check the effect the following week
```

### Aggregation Query (CLI)
```bash
# Positive / negative counts for one day
for r in positive negative; do
  aws dynamodb query \
    --table-name ${PREFIX}-rag-feedback \
    --index-name date-rating-index \
    --key-condition-expression "#d = :date AND rating = :r" \
    --expression-attribute-names '{"#d":"date"}' \
    --expression-attribute-values '{":date":{"S":"2026-11-10"},":r":{"S":"'$r'"}}' \
    --select COUNT --region ap-northeast-1 --query Count
done

# The question text (query attribute) and cited document IDs of negative feedback
aws dynamodb query \
  --table-name ${PREFIX}-rag-feedback \
  --index-name date-rating-index \
  --key-condition-expression "#d = :date AND rating = :r" \
  --expression-attribute-names '{"#d":"date"}' \
  --expression-attribute-values '{":date":{"S":"2026-11-10"},":r":{"S":"negative"}}' \
  --projection-expression "query,modelId,routingTier,sourceDocIds,comment" \
  --region ap-northeast-1
```

### Turning a document ID back into a name
`sourceDocIds` carries no name, so an operator who can only read the feedback cannot tell which document it was. An operator who can list the bucket (or the S3 Access Points alias) can turn the IDs back with this script:

```bash
aws s3api list-objects-v2 --bucket <alias> --query 'Contents[].Key' --output text \
  | tr '\t' '\n' | python3 scripts/resolve-feedback-doc-ids.py --bucket <alias> <ID> [<ID> ...]
```

### Deleting a user's feedback (on a deletion request)
Collect `feedbackId` and `timestamp` from `userId-timestamp-index`, then `delete-item` each one. Records past their retention are removed by the DynamoDB TTL, which does not necessarily remove them right after the expiry.

```bash
aws dynamodb query --table-name ${PREFIX}-rag-feedback --index-name userId-timestamp-index \
  --key-condition-expression "userId = :u" --expression-attribute-values '{":u":{"S":"<user>"}}' \
  --projection-expression "feedbackId,#t" --expression-attribute-names '{"#t":"timestamp"}' --region ap-northeast-1
```

### Improvement Action Matrix
| Negative pattern | Likely cause | Action |
|-----------------|-------------|--------|
| "Tell me about X" → no answer | Document not registered | Add the document to the KB |
| Inaccurate answer | Inappropriate chunking | Change the chunking strategy to HIERARCHICAL |
| Outdated answer | KB sync delay | Shorten the polling interval or switch to CloudTrail mode |
| Answer too long / too short | Prompt issue | Adjust the Agent instruction |
| Permission error | Permission design issue | Check allowed_group_sids in .metadata.json |
---
## Part 2: Feature Gate Operations Guide
> **About Feature Gate**: `FeatureGateConstruct` and its Lambda exist, but no stack includes them and the `/api/config/feature-gates` route they expect does not exist (origin/main on 2026-11-17). The procedures below apply once they are wired in.


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
