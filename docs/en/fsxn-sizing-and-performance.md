# FSx for ONTAP Sizing and Performance Guide

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | **English** | [한국어](../ko/fsxn-sizing-and-performance.md) | [简体中文](../zh-CN/fsxn-sizing-and-performance.md) | [繁體中文](../zh-TW/fsxn-sizing-and-performance.md) | [Français](../fr/fsxn-sizing-and-performance.md) | [Deutsch](../de/fsxn-sizing-and-performance.md) | [Español](../es/fsxn-sizing-and-performance.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Infrastructure architects, storage administrators

---

## Overview

This document provides sizing and performance design guidelines for FSx for ONTAP in the Permission-aware RAG system. It organizes configuration recommendations based on file count, file size, access frequency, and re-sync frequency.

---

## Recommended Configurations by Scale

### Small (~10,000 files) — PoC / Department Use

| Item | Recommended Value | Notes |
|------|-------------------|-------|
| FSx throughput capacity | 128 MB/s | Minimum configuration |
| SSD storage capacity | 1,024 GiB | Minimum configuration |
| Capacity pool tiering | Enabled | Cost optimization |
| Vector store | S3 Vectors | Low cost (a few dollars/month) |
| KB Auto-Sync interval | 15 min | Default |
| Initial indexing time | 5–15 min | Depends on document size |
| Monthly estimate (FSx only) | ~$300–$500 | throughput + SSD |

### Medium (10,000–100,000 files) — Business Unit / Company-wide Use

| Item | Recommended Value | Notes |
|------|-------------------|-------|
| FSx throughput capacity | 256–512 MB/s | Based on concurrent access count |
| SSD storage capacity | 2,048–10,240 GiB | Based on hot data volume |
| Capacity pool tiering | Enabled | Auto-tier cold data |
| Vector store | S3 Vectors or OpenSearch Serverless | Choose based on QPS requirements |
| KB Auto-Sync interval | 5–15 min | Based on update frequency |
| Initial indexing time | 30–120 min | Can be shortened with parallel processing |
| Monthly estimate (FSx only) | ~$1,000–$5,000 | throughput + SSD + capacity pool |

### Large (100,000–1,000,000 files) — Enterprise

| Item | Recommended Value | Notes |
|------|-------------------|-------|
| FSx throughput capacity | 1,024–4,096 MB/s | Multi-AZ + high throughput |
| SSD storage capacity | 10,240+ GiB | Based on hot data volume |
| Capacity pool tiering | Enabled | Most data in capacity pool |
| Vector store | OpenSearch Serverless | High QPS, low latency |
| KB Auto-Sync interval | Incremental sync design required | Full scan is impractical |
| Initial indexing time | Several hours to 1 day | Batch splitting recommended |
| Monthly estimate (FSx only) | ~$5,000–$30,000+ | Highly dependent on configuration |

---

## FSx for ONTAP Performance Characteristics

### Throughput Capacity

FSx for ONTAP throughput capacity is configured at the file system level.

| Throughput | Read IOPS (SSD) | Write IOPS | Network Bandwidth | Use Case |
|-----------|-----------------|------------|-------------------|----------|
| 128 MB/s | 6,000 | 1,500 | Up to 600 MB/s | PoC, small scale |
| 256 MB/s | 12,000 | 3,000 | Up to 1.2 GB/s | Department use |
| 512 MB/s | 40,000 | 10,000 | Up to 2.4 GB/s | Company-wide |
| 1,024 MB/s | 80,000 | 20,000 | Up to 4.8 GB/s | Large scale |
| 2,048 MB/s | 160,000 | 40,000 | Up to 9.6 GB/s | Mission critical |

> **Reference**: Amazon FSx for ONTAP supports up to 72 GB/s throughput (12 HA pair configuration).

### Storage Tiering (Capacity Pool Tiering)

| Tier | Characteristics | Cost | Use Case |
|------|----------------|------|----------|
| SSD | Sub-millisecond latency | High | Frequently accessed files |
| Capacity Pool | Tens of milliseconds latency | Low (~1/10 of SSD) | Archive, infrequent access |

**Recommendations for RAG systems**:
- `.metadata.json` and frequently searched documents → SSD tier
- Archive documents, old versions → Capacity Pool

**Tiering policies**:
- `auto`: Automatically moves data to Capacity Pool after a period of no access (recommended)
- `snapshot-only`: Only moves snapshot data to Capacity Pool
- `all`: Moves all data to Capacity Pool (cost priority)
- `none`: Keeps all data on SSD (performance priority)

---

## S3 Access Point Considerations

### Performance Characteristics

FSx for ONTAP's S3 Access Point exposes files on FSx volumes via an S3-compatible interface.

| Operation | Latency | Throughput | Notes |
|-----------|---------|------------|-------|
| ListObjectsV2 | Hundreds of milliseconds | — | Proportional to file count |
| GetObject (small files) | Tens to hundreds of milliseconds | — | For SSD tier |
| GetObject (large files) | Proportional to file size | Depends on FSx throughput | Streaming |
| HeadObject | Tens of milliseconds | — | Metadata only |

### Load During Bedrock KB Sync

During KB sync (StartIngestionJob), Bedrock reads all documents via the S3 Access Point.

| Document Count | Read Load During Sync | Recommended Throughput |
|----------------|----------------------|----------------------|
| ~1,000 | Low (several GB) | 128 MB/s is sufficient |
| ~10,000 | Medium (tens of GB) | 256 MB/s recommended |
| ~100,000 | High (hundreds of GB) | 512 MB/s or higher recommended |

### Dual-Layer Authorization

Access via S3 Access Point requires 2 layers of authentication:

1. **IAM Authentication**: S3 Access Point policy + IAM identity-based policy
2. **File System Authentication**: NTFS ACL (Windows user mapping)

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## Vector Store Selection Criteria

### S3 Vectors vs OpenSearch Serverless

| Aspect | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| Cost (small scale) | A few dollars/month | $700+/month (minimum 2 OCU) |
| Cost (large scale) | Proportional to vector count | Proportional to OCU count |
| Query latency | Cold: sub-second, Warm: ~100ms | Always ~50ms |
| Max vector count | 10,000 indexes/bucket | Virtually unlimited |
| Metadata filter | 2KB/vector (filterable) | Relaxed limits |
| Scalability | Automatic | Manual/auto OCU scaling |
| Operational overhead | Nearly zero | OCU monitoring required |
| Export | → OpenSearch Serverless (one-click) | — |

### Selection Flowchart

```
Concurrent users < 10 AND document count < 10,000?
  → Yes: S3 Vectors (cost priority)
  → No:
    Latency requirement < 100ms?
      → Yes: OpenSearch Serverless
      → No:
        Monthly budget < $1,000?
          → Yes: S3 Vectors (latency acceptable)
          → No: OpenSearch Serverless
```

### Migration Path

Migration from S3 Vectors → OpenSearch Serverless can be done with one-click export from the console (takes ~15 min). Reverse migration is achieved via KB re-sync.

---

## Initial Indexing Design

### Recommended Approach

| Document Count | Method | Notes |
|----------------|--------|-------|
| ~1,000 | Batch KB sync | Completes with a single `StartIngestionJob` |
| ~10,000 | Batch KB sync | Wait for sync completion (30–60 min) |
| ~100,000 | Batch splitting | Split data sources and sync incrementally |
| 100,000+ | Gradual ingestion | Ingest by folder → repeat sync |

### Initial Indexing Considerations

1. **Temporary FSx throughput increase**: Read load is high during initial indexing, so consider temporarily increasing throughput capacity
2. **S3 Access Point concurrent connections**: Bedrock KB reads files in parallel, so be aware of FSx concurrent connection limits
3. **Pre-prepare `.metadata.json`**: Confirm all documents have `.metadata.json` before starting sync
4. **File changes during sync**: Inconsistencies may occur if files are modified during sync. A change freeze during initial sync is recommended

---

## Incremental Sync Design

### KB Auto-Sync Behavior

Incremental sync mechanism enabled with `enableKbAutoSync=true`:

```
EventBridge Scheduler (5–15 min interval)
  → Lambda: Get file list from S3 AP via ListObjectsV2
  → DynamoDB: Compare with previous inventory
  → On change detection only: Execute StartIngestionJob
  → If IN_PROGRESS job exists: Skip (deduplication)
```

### Change Detection Mechanism

| Detection Target | Method | Notes |
|-----------------|--------|-------|
| New files | LastModified comparison | Keys not present in DynamoDB inventory |
| Updated files | ETag / LastModified comparison | Keys with changed values |
| Deleted files | Inventory diff | Keys present in DynamoDB but not in S3 AP |

### Incremental Sync Challenges at Scale

| File Count | ListObjectsV2 Duration | Countermeasure |
|-----------|------------------------|----------------|
| ~10,000 | Several seconds | No issues |
| ~100,000 | Tens of seconds | Extend Lambda timeout (15 min) |
| 100,000+ | Several minutes or more | Prefix splitting, Step Functions |

---

## QoS (Quality of Service) Design

When multiple tenants or workloads share FSx, QoS policies can control performance.

### Recommended QoS Settings

| Workload | Priority | IOPS Limit | Throughput Limit |
|----------|----------|-----------|-----------------|
| RAG search (via S3 AP) | High | Unlimited | Unlimited |
| KB sync (batch) | Medium | 5,000 IOPS | 100 MB/s |
| User CIFS/SMB access | High | Unlimited | Unlimited |
| Backup / SnapMirror | Low | 2,000 IOPS | 50 MB/s |

### Applying QoS Policies

```bash
# Create QoS policy group via ONTAP CLI
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# Apply QoS policy to volume
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## Capacity Monitoring and Auto-Expansion

### Monitoring Metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| SSD utilization | > 80% | Expand capacity or review tiering policy |
| Capacity Pool utilization | > 90% | Expand capacity |
| IOPS utilization | > 80% | Increase throughput capacity |
| Network bandwidth utilization | > 70% | Increase throughput capacity |

### Auto-Expansion (FSx ONTAP Ops)

The capacity monitoring Lambda included in `automation/fsxn-ops/` performs auto-expansion:

- Monitors volume utilization every 5 minutes via EventBridge
- Automatically expands volume size when threshold is exceeded
- Capacity Guardrails (daily limit, cooldown period) prevent over-expansion
- CloudWatch Dashboard visualizes expansion history

---

## Cost Optimization Tips

### 1. Leverage Capacity Pool Tiering

Most documents targeted for RAG search are rarely accessed once embedded. Set tiering policy to `auto` to automatically move infrequently accessed data to the low-cost tier.

### 2. Right-size Throughput Capacity

Read load decreases significantly after initial indexing. Sync with high throughput initially, then reduce throughput during the operational phase to cut costs.

```bash
# Change throughput capacity (no downtime)
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. Leverage S3 Vectors

For small to medium environments, use S3 Vectors (a few dollars/month) to avoid OpenSearch Serverless costs ($700+/month). One-click export is available when performance requirements increase.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [permission-consistency.md](permission-consistency.md) | Permission Change Consistency Model |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | S3 Vectors + SID Architecture |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3-Configuration Comparison |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | FSx ONTAP Operations Automation |
