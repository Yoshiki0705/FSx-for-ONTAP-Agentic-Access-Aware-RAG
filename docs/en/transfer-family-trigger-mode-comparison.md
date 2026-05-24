# Transfer Family Trigger Mode Comparison (Polling vs CloudTrail)

**🌐 Language:** [日本語](../transfer-family-trigger-mode-comparison.md) | **English**

**Created**: 2026-05-24  
**Audience**: Selecting the trigger mode for the Transfer Family ingestion pipeline

---

## Overview

The Transfer Family ingestion pipeline supports two trigger modes:

| Mode | CDK Parameter | Detection Method |
|------|--------------|-----------------|
| **Polling** (default) | `transferFamilyTriggerMode: "polling"` | Periodic scan via EventBridge Scheduler |
| **CloudTrail** | `transferFamilyTriggerMode: "cloudtrail"` | S3 Data Events → EventBridge Rule |

---

## Comparison Table

| Item | Polling | CloudTrail |
|------|---------|-----------|
| **Detection Latency** | Up to N minutes (polling interval) | 1–5 minutes (CloudTrail delivery delay) |
| **Default Interval** | 5 minutes | — (event-driven) |
| **Cost Structure** | Lambda invocations only | CloudTrail Data Events + Lambda |
| **Monthly Cost (100 files/day)** | ~$0.50 | ~$3.50 |
| **Monthly Cost (1,000 files/day)** | ~$0.50 | ~$6.00 |
| **Monthly Cost (10,000 files/day)** | ~$0.50 | ~$33.00 |
| **Scalability** | Independent of file count | Proportional to file count |
| **Risk of Missed Files** | None (full scan) | None (event-driven) |
| **DLQ** | None | Yes (after 2 retries) |
| **CDK Resources** | EventBridge Scheduler + Lambda | CloudTrail Trail + EventBridge Rule + DLQ + Lambda |

---

## Cost Details

### Polling Mode

```
Cost = Lambda invocations × Lambda unit price

- Polling interval: 5 min → 288 invocations/day → 8,640 invocations/month
- Lambda execution time: avg 5s × 256MB
- Lambda cost: 8,640 × 5s × 256MB / 1024 × $0.0000166667 = ~$0.18/month
- EventBridge Scheduler: Free (up to 1M invocations/month)
- Total: ~$0.20/month (independent of file count)
```

### CloudTrail Mode

```
Cost = CloudTrail Data Events + Lambda invocations

- CloudTrail S3 Data Events: $0.10 / 100,000 events
  - 100 files/day: 3,000/month → ~$0.003/month
  - 1,000 files/day: 30,000/month → ~$0.03/month
  - 10,000 files/day: 300,000/month → ~$0.30/month
- CloudTrail Trail management events: First Trail is free
- Lambda invocations: Proportional to event count
  - 100 files/day: 3,000 invocations/month × 2s = ~$0.01/month
  - 10,000 files/day: 300,000 invocations/month × 2s = ~$1.00/month
- CloudTrail log storage (S3): ~$2–5/month (depends on log volume)
- Total: $3–33/month (proportional to file count)
```

---

## Selection Guide

### When to Choose Polling

- PoC / demo environments (minimize cost)
- Low file upload frequency (a few dozen files per day or less)
- 5-minute detection delay is acceptable
- Simpler architecture is preferred

### When to Choose CloudTrail

- Production environments requiring near-real-time detection
- SLA guarantees "searchable via RAG within 5 minutes of upload"
- File uploads are irregular (bursty), and you want to avoid wasted polling
- Audit trail (CloudTrail logs) is required

---

## Configuration

### Polling Mode (Default)

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5
}
```

### CloudTrail Mode

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "cloudtrail"
}
```

---

## Notes

- In CloudTrail mode, S3 Data Event delivery has a 1–5 minute delay (AWS specification)
- CloudTrail Trails have a per-account limit (default: 5)
- If you already have a Trail recording S3 Data Events, be aware of duplicate charges
- Polling mode and CloudTrail mode are mutually exclusive (cannot be enabled simultaneously)
