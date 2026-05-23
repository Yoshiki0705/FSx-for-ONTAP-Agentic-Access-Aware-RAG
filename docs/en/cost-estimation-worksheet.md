# Cost Estimation Worksheet

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | **English** | [한국어](../ko/cost-estimation-worksheet.md) | [简体中文](../zh-CN/cost-estimation-worksheet.md) | [繁體中文](../zh-TW/cost-estimation-worksheet.md) | [Français](../fr/cost-estimation-worksheet.md) | [Deutsch](../de/cost-estimation-worksheet.md) | [Español](../es/cost-estimation-worksheet.md)

**Created**: 2026-05-23  
**Status**: Draft  
**Audience**: Project managers, partner proposal leads, budget planners

> **⚠️ Note**: Prices in this worksheet are reference values based on publicly available ap-northeast-1 region pricing as of May 2026. Actual costs vary by region, usage, discounts, and pricing updates. See [AWS Pricing](https://aws.amazon.com/pricing/) for the latest rates.

---

## Input Parameters

Fill in the values below to estimate your monthly cost.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Number of documents | _____ | Files on FSx volume |
| Average document size | _____ KB | Text equivalent |
| Daily queries | _____ /day | All users combined |
| Concurrent users | _____ | Peak |
| Registered users | _____ | Cognito User Pool |
| KB sync frequency | _____ /day | Derived from Auto-Sync interval |
| Agent mode usage rate | _____ % | Percentage of queries using Agent |
| Availability requirement | Single-AZ / Multi-AZ | FSx configuration |

---

## Cost Formulas

### 1. FSx for ONTAP

```
Monthly = throughput cost + SSD cost + Capacity Pool cost + backup cost

Throughput cost:
  128 MB/s: ~$210/month
  256 MB/s: ~$420/month
  512 MB/s: ~$840/month
  1,024 MB/s: ~$1,680/month

SSD cost: $0.125/GiB/month × SSD capacity (GiB)
Capacity Pool cost: $0.0125/GiB/month × Capacity Pool usage (GiB)
Backup cost: $0.025/GiB/month × backup capacity (GiB)

For Multi-AZ: throughput + SSD costs approximately double
```

**Calculation examples**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/month**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/month**

### 2. Vector Store

```
S3 Vectors:
  Storage: $0.023/GB/month × vector data size
  Requests: $0.005/1,000 PUT + $0.0004/1,000 GET
  Estimate: 10,000 documents → ~$5/month

OpenSearch Serverless:
  OCU: $0.24/OCU/hour × 24 × 30 = $172.80/OCU/month
  Minimum 2 OCU (search + index): ~$346/month
  Recommended 4 OCU: ~$691/month
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2: $0.0001/1,000 tokens

Initial Embedding:
  = number of documents × average size (KB) × 1,000 / 4 × $0.0001/1K
  Example: 10,000 docs × 10 KB × 250 tokens/KB × $0.0001/1K = $2.50

Monthly incremental Embedding:
  = changed documents × average size × $0.0001/1K
  Example: 500 docs/month × 10 KB × 250 tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock (Generation Models)

```
Smart Routing distribution (default assumption):
  Simple (Haiku): 60% → $0.001/query
  Complex (Sonnet): 30% → $0.01/query
  Full-context (Opus): 10% → $0.10/query

Weighted average cost/query:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

Monthly:
  = daily queries × 30 × $0.014
  Example: 100 queries/day × 30 × $0.014 = $42/month
  Example: 1,000 queries/day × 30 × $0.014 = $420/month
```

### 5. Lambda

```
WebApp Lambda:
  Requests: $0.20/1 million requests
  Compute: $0.0000166667/GB-second
  Memory: 1,024 MB, average execution time: 3 seconds
  
  Monthly = requests × (memory_GB × exec_seconds × $0.0000166667 + $0.0000002)
  Example: 100,000 req/month × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/month

Sync Lambda (KB Auto-Sync, AD Sync):
  5-minute interval × 30 days = 8,640 invocations/month
  128 MB × 5 seconds = ~$0.60/month
```

### 6. Other Services

```
CloudFront: $0.114/GB (Japan) × transfer volume
  Example: 10 GB/month = $1.14/month

WAF: $5/WebACL + $1/rule × 6 + $0.60/1 million requests
  Base: $11/month + request-based charges

DynamoDB (On-Demand):
  Writes: $1.25/1 million WRU
  Reads: $0.25/1 million RRU
  Storage: $0.25/GB/month
  Example: ~$5/month (small scale)

Cognito:
  First 50,000 MAU: Free
  50,001–100,000: $0.0055/MAU
  Example: 100 MAU = $0 (within free tier)

CloudWatch:
  Log ingestion: $0.76/GB
  Log storage: $0.033/GB/month
  Metrics: $0.30/metric/month (first 10,000)
  Example: ~$10–$30/month
```

---

## Monthly Cost Estimate Templates by Configuration

### Template A: Small-Scale PoC

| Resource | Configuration | Monthly |
|----------|--------------|---------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 vectors | $5 |
| Bedrock Embedding | Initial + incremental | $3 |
| Bedrock Generation | 100 queries/day, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | Basic | $15 |
| DynamoDB | On-Demand | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | Basic | $10 |
| **Total** | | **~$430/month** |

### Template B: Mid-Scale Production

| Resource | Configuration | Monthly |
|----------|--------------|---------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | Periodic sync | $10 |
| Bedrock Generation | 1,000 queries/day, Smart Routing | $420 |
| Lambda | WebApp + Sync + Monitoring | $30 |
| CloudFront + WAF | Production traffic | $50 |
| DynamoDB | Provisioned | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | Logs + Metrics + Alarms | $50 |
| **Total** | | **~$3,626/month** |

### Template C: Large-Scale Enterprise

| Resource | Configuration | Monthly |
|----------|--------------|---------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | Large-scale sync | $50 |
| Bedrock Generation | 5,000 queries/day, Smart Routing | $2,100 |
| Lambda | Full features | $100 |
| CloudFront + WAF | High traffic | $200 |
| DynamoDB | Provisioned + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | Full monitoring | $100 |
| **Total** | | **~$8,512/month** |

---

## Cost Optimization Tips

| Method | Savings | Applicable When |
|--------|---------|-----------------|
| S3 Vectors (instead of AOSS) | -$700/month | QPS < 10, latency tolerant |
| Smart Routing (Haiku priority) | -30–50% | Majority of queries are simple |
| Capacity Pool Tiering | -50–80% (storage) | Large amount of infrequently accessed data |
| Throughput reduction (operational phase) | -50% | After initial indexing is complete |
| Savings Plans (Lambda) | -17% | 1-year commitment |
| Reserved Capacity (AOSS) | Contact AWS | Long-term usage confirmed |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP performance and capacity planning |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | Partner deployment patterns (includes cost comparison) |
| [evaluation.md](../evaluation.md) | RAG / Agent evaluation metrics |
