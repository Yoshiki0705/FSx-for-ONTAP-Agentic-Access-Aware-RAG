# CloudWatch Dashboard Operations Guide

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | **English** | [한국어](../ko/cloudwatch-dashboard-guide.md) | [简体中文](../zh-CN/cloudwatch-dashboard-guide.md) | [繁體中文](../zh-TW/cloudwatch-dashboard-guide.md) | [Français](../fr/cloudwatch-dashboard-guide.md) | [Deutsch](../de/cloudwatch-dashboard-guide.md) | [Español](../es/cloudwatch-dashboard-guide.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Operations Teams, SREs, Platform Engineers

---

## Overview

This document is a design and implementation guide for CloudWatch dashboards and alarms required for operational monitoring of the Permission-aware RAG system. In addition to the dashboard automatically created by CDK with `enableMonitoring=true`, it organizes additional metrics and alarms that should be configured.

---

## Monitoring Metrics List

### RAG Search Performance

| Metric | Namespace | Dimension | Description | Alert Threshold |
|--------|-----------|-----------|-------------|-----------------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | End-to-end latency from search to response generation | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Bedrock API invocation count | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Bedrock API error count | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | Number of chunks retrieved from KB | — |

### Permission Control

| Metric | Namespace | Dimension | Description | Alert Threshold |
|--------|-----------|-----------|-------------|-----------------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | Number of documents denied by SID filtering | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | Cache hit rate | < 20% (anomaly) |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | Cache miss rate | > 80% (anomaly) |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Fail-Closed activation count | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | SID resolution failure count | > 0 |

### Data Synchronization

| Metric | Namespace | Dimension | Description | Alert Threshold |
|--------|-----------|-----------|-------------|-----------------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | KB sync duration | > 30min |
| KB Sync Success | `KbAutoSync` | — | Sync success count | — |
| KB Sync Failure | `KbAutoSync` | — | Sync failure count | 3 consecutive |
| ACL Sync Success | `PermissionAwareRAG` | — | ACL sync success count | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | ACL sync failure count | > 0 |

### Guardrails

| Metric | Namespace | Dimension | Description | Alert Threshold |
|--------|-----------|-----------|-------------|-----------------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Number of blocks by Guardrails | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | Intervention rate across all requests | > 10% |

### Agent

| Metric | Namespace | Dimension | Description | Alert Threshold |
|--------|-----------|-----------|-------------|-----------------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | Tool invocation count | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Agent execution step count | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Agent error count | > 3/5min |

### Cost

| Metric | Namespace | Dimension | Description | Alert Threshold |
|--------|-----------|-----------|-------------|-----------------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | Estimated token cost (USD) | Daily > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | Routing destination distribution | — |

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Permission-Aware RAG Operations Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Query Latency       │  │ Bedrock Invocations  │              │
│  │ (P50/P95/P99)       │  │ (by Model)           │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Permission Denied   │  │ Cache Hit/Miss Rate  │              │
│  │ Count               │  │                      │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ KB Sync Status      │  │ Guardrails Blocked   │              │
│  │ (Success/Failure)   │  │ Count                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Agent Tool Calls    │  │ Estimated Cost       │              │
│  │ (by Tool)           │  │ Trend                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alarm Definitions

### Critical (Immediate Response)

```yaml
- AlarmName: RAG-PermissionDenyAllFallback
  MetricName: DenyAllFallbackCount
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]

- AlarmName: RAG-SIDResolutionFailure
  MetricName: SIDResolutionFailure
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 0
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]
```

### Warning (Investigation Required)

```yaml
- AlarmName: RAG-HighLatency
  MetricName: QueryLatency
  Namespace: PermissionAwareRAG
  ExtendedStatistic: p95
  Period: 300
  EvaluationPeriods: 3
  Threshold: 10000  # 10 seconds in ms
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-KBSyncConsecutiveFailure
  MetricName: KBSyncFailure
  Namespace: KbAutoSync
  Statistic: Sum
  Period: 900
  EvaluationPeriods: 3
  Threshold: 1
  ComparisonOperator: GreaterThanOrEqualToThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-HighCacheMissRate
  MetricName: PermissionCacheMissRate
  Namespace: PermissionAwareRAG
  Statistic: Average
  Period: 300
  EvaluationPeriods: 3
  Threshold: 80
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]
```

---

## Troubleshooting Patterns

### Pattern 1: Frequent Deny All Fallback

```
Symptoms: DenyAllFallbackCount spikes
Possible Causes:
  1. Connection failure to DynamoDB user-access table
  2. SID data not registered for new users
  3. AD Sync Lambda failure

Investigation Steps:
  1. Check Lambda errors in CloudWatch Logs
  2. Check DynamoDB table throttling
  3. Check AD Sync Lambda last execution result
```

### Pattern 2: Latency Spike

```
Symptoms: QueryLatency P95 exceeds 10 seconds
Possible Causes:
  1. Bedrock API throttling
  2. S3 Vectors cold start
  3. Load during KB sync

Investigation Steps:
  1. Check Bedrock InvocationLatency
  2. Check S3 Vectors query latency
  3. Check KB sync job execution status
```

### Pattern 3: Cost Spike

```
Symptoms: EstimatedTokenCost is 3x or more above normal
Possible Causes:
  1. Smart Routing biased toward high-cost models
  2. Excessive use of Agent mode
  3. Unauthorized mass requests

Investigation Steps:
  1. Check SmartRouting RoutingTier distribution
  2. Check Agent StepCount for anomalies
  3. Check WAF rate limit block count
```

---

## Dashboard Import Procedure

### CDK Auto-Creation (Recommended)

```bash
# Auto-created with enableMonitoring=true
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### Manual Import

```bash
# Use monitoring/cloudwatch-dashboard.json
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [production-readiness-checklist.md](../production-readiness-checklist.md) | Production readiness checklist (monitoring configuration items) |
| [permission-consistency.md](../permission-consistency.md) | Recommended monitoring settings for permission changes |
| [governance-and-audit.md](../governance-and-audit.md) | Audit logs and report generation |
| [threat-model.md](../threat-model.md) | Threat model (threats to detect through monitoring) |
