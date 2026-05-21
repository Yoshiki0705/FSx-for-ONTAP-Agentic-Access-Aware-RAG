# CloudWatch 仪表板运维指南

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | [English](../en/cloudwatch-dashboard-guide.md) | [한국어](../ko/cloudwatch-dashboard-guide.md) | **简体中文** | [繁體中文](../zh-TW/cloudwatch-dashboard-guide.md) | [Français](../fr/cloudwatch-dashboard-guide.md) | [Deutsch](../de/cloudwatch-dashboard-guide.md) | [Español](../es/cloudwatch-dashboard-guide.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标受众**: 运维团队、SRE、平台工程师

---

## 概述

本文档是 Permission-aware RAG 系统运营监控所需的 CloudWatch 仪表板和告警的设计与导入指南。除了通过 `enableMonitoring=true` 由 CDK 自动创建的仪表板外，还整理了需要额外配置的指标和告警。

---

## 监控指标一览

### RAG 搜索性能

| 指标 | 命名空间 | 维度 | 说明 | 告警阈值 |
|------|---------|------|------|---------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | 从搜索到回答生成的整体延迟 | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Bedrock API 调用次数 | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Bedrock API 错误次数 | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | 从 KB 获取的分块数 | — |

### 权限控制

| 指标 | 命名空间 | 维度 | 说明 | 告警阈值 |
|------|---------|------|------|---------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | SID 过滤拒绝的文档数 | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | 缓存命中率 | < 20%（异常） |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | 缓存未命中率 | > 80%（异常） |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Fail-Closed 触发次数 | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | SID 解析失败次数 | > 0 |

### 数据同步

| 指标 | 命名空间 | 维度 | 说明 | 告警阈值 |
|------|---------|------|------|---------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | KB 同步所需时间 | > 30min |
| KB Sync Success | `KbAutoSync` | — | 同步成功次数 | — |
| KB Sync Failure | `KbAutoSync` | — | 同步失败次数 | 连续 3 次 |
| ACL Sync Success | `PermissionAwareRAG` | — | ACL 同步成功次数 | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | ACL 同步失败次数 | > 0 |


### Guardrails

| 指标 | 命名空间 | 维度 | 说明 | 告警阈值 |
|------|---------|------|------|---------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Guardrails 阻断次数 | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | 全部请求中的干预率 | > 10% |

### Agent

| 指标 | 命名空间 | 维度 | 说明 | 告警阈值 |
|------|---------|------|------|---------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | 工具调用次数 | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Agent 执行步骤数 | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Agent 错误次数 | > 3/5min |

### 成本

| 指标 | 命名空间 | 维度 | 说明 | 告警阈值 |
|------|---------|------|------|---------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | 预估令牌成本（USD） | 日均 > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | 路由目标分布 | — |

---

## 仪表板布局

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

## 告警定义

### Critical（即时响应）

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

### Warning（需要调查）

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

## 故障排除模式

### 模式 1: Deny All Fallback 频繁触发

```
症状: DenyAllFallbackCount 急剧增加
可能原因:
  1. 与 DynamoDB user-access 表的连接故障
  2. 新用户的 SID 数据未注册
  3. AD Sync Lambda 执行失败

调查步骤:
  1. 在 CloudWatch Logs 中确认 Lambda 错误
  2. 确认 DynamoDB 表的限流情况
  3. 确认 AD Sync Lambda 的最近执行结果
```

### 模式 2: 延迟急剧增加

```
症状: QueryLatency P95 超过 10 秒
可能原因:
  1. Bedrock API 限流
  2. S3 Vectors 冷启动
  3. KB 同步期间的负载

调查步骤:
  1. 确认 Bedrock InvocationLatency
  2. 确认 S3 Vectors 的查询延迟
  3. 确认 KB 同步作业的执行状态
```

### 模式 3: 成本急剧增加

```
症状: EstimatedTokenCost 超过平时的 3 倍以上
可能原因:
  1. Smart Routing 偏向高成本模型
  2. Agent 模式的过度使用
  3. 非法的大量请求

调查步骤:
  1. 确认 SmartRouting RoutingTier 的分布
  2. 确认 Agent StepCount 的异常值
  3. 确认 WAF 速率限制的阻断数
```

---

## 仪表板导入步骤

### CDK 自动创建（推荐）

```bash
# enableMonitoring=true 自动创建
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### 手动导入

```bash
# 使用 monitoring/cloudwatch-dashboard.json
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生产化检查清单（监控设置项目） |
| [permission-consistency.md](permission-consistency.md) | 权限变更时的监控推荐设置 |
| [governance-and-audit.md](governance-and-audit.md) | 审计日志与报告生成 |
| [threat-model.md](threat-model.md) | 威胁模型（监控应检测的威胁） |
