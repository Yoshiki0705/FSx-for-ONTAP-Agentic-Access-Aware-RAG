# 治理与审计设计

**🌐 Language:** [日本語](../governance-and-audit.md) | [English](../en/governance-and-audit.md) | [한국어](../ko/governance-and-audit.md) | **简体中文** | [繁體中文](../zh-TW/governance-and-audit.md) | [Français](../fr/governance-and-audit.md) | [Deutsch](../de/governance-and-audit.md) | [Español](../es/governance-and-audit.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标读者**: 安全负责人、合规负责人、公共/医疗/金融行业

---

## 概述

本文档整理了 Permission-aware RAG 系统的审计日志设计、治理框架和负责任 AI 实施指南。目标是使其可解释："谁、在什么时候、基于哪些文档、收到了什么回答。"

---

## 审计日志模式

### RAG 搜索审计日志

所有 RAG 搜索请求记录以下信息。

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Agent 模式审计日志

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### 权限变更审计日志

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## 日志存储与保护架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        审计日志流程                                 │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3（审计日志桶）          │ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock (WORM)    │ │
│  └──────────┘    │ 保留期：1年   │    │ ・KMS 加密             │ │
│                  └──────────────┘    │ ・生命周期：            │ │
│                                      │   90天→IA, 365天→Glacier │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API 调用 │    │ (数据事件)    │                                │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ 权限     │    │ Streams      │───▶ 权限变更审计日志             │
│  │ 变更     │    └──────────────┘                                │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 推荐配置

| 组件 | 设置 | 目的 |
|------|------|------|
| CloudWatch Logs | 保留期：1 年 | 运维日志、调试 |
| S3 审计日志桶 | Object Lock（Governance 模式） | 防篡改 |
| KMS CMK | 自动轮换启用 | 加密 |
| CloudTrail | 管理事件 + 数据事件 | API 调用追踪 |
| S3 生命周期 | 90 天 → IA，365 天 → Glacier | 成本优化 |
| Athena | 分区表 | 日志分析和搜索 |

---

## 负责任 AI / Guardrails 设计

### 利用 Bedrock Guardrails

通过 `enableGuardrails=true` 启用的 Guardrails 配置：

| 策略 | 目的 | 配置示例 |
|------|------|----------|
| 内容过滤 | 检测和阻止有害内容 | HATE: HIGH, VIOLENCE: HIGH |
| 主题策略 | 定义禁止的主题 | 竞争对手信息、投资建议 |
| PII 检测 | 检测和掩码个人信息 | 姓名、电话号码、电子邮件地址 |
| 词语过滤 | 阻止禁止的短语 | 内部代号、未发布信息 |

### Guardrails 示例策略

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### 按数据分类的控制

| 数据分类 | 搜索 | 摘要 | 引用 | Agent 使用 |
|----------|------|------|------|-----------|
| 公开 | ✅ 允许 | ✅ 允许 | ✅ 允许 | ✅ 允许 |
| 内部 | ✅ 允许 | ✅ 允许 | ⚠️ 仅摘要 | ✅ 允许 |
| 机密 | ✅ 允许（仅授权人员） | ⚠️ 受限 | ❌ 不允许逐字引用 | ⚠️ 需审批 |
| 绝密 | ⚠️ 需审批 | ❌ 禁止 | ❌ 禁止 | ❌ 禁止 |

### Agent 模式的人工审批

Agent 在执行外部操作前请求人工审批的设计：

```
Agent 尝试调用 "发送邮件" 工具
  → AgentCore Policy 检测到 "外部通信" 类别
  → 生成人工审批请求
  → UI 向用户显示批准/拒绝提示
  → 仅在批准后执行操作
```

---

## 行业特定使用场景与法规合规

### 医疗

| 要求 | 实现方式 |
|------|----------|
| 患者信息隔离 | 科室特定 SID 组 + PII 掩码 |
| 按科室搜索操作规程 | 按科室 SID 过滤 |
| 审计追踪 | 所有搜索日志保留 5 年 |
| 同意管理 | 在元数据中包含患者同意标志 |
| 禁止医疗诊断 | 通过 Guardrails 主题策略 DENY |

**法规合规**：医疗信息系统安全管理指南（厚生劳动省）

### 政府 / 公共部门

| 要求 | 实现方式 |
|------|----------|
| 按局文档隔离 | 局 SID 组 |
| 政策与非公开材料分离 | `access_level` 元数据 + SID |
| 信息公开请求支持 | 搜索日志保存和导出功能 |
| 个人信息保护 | PII 检测 + 掩码 |
| 行政文档管理 | 文档分类元数据分配 |

**法规合规**：个人信息保护法、ISMAP

### 金融机构

| 要求 | 实现方式 |
|------|----------|
| 严格的客户信息隔离 | 基于客户 ID 的访问控制 |
| 禁止投资建议 | Guardrails 主题策略 |
| 交易记录保存 | 审计日志保留 10 年 |
| 内部控制 | 定期审查操作日志 |
| 加密要求 | KMS CMK + TLS 1.2 |

**法规合规**：FISC 安全指南、金融商品交易法

### 教育机构

| 要求 | 实现方式 |
|------|----------|
| 教职工/学生权限分离 | 基于角色的 SID 组 |
| 实验室特定材料隔离 | 实验室 SID 组 |
| 学生个人信息保护 | PII 掩码 |
| 研究数据保密 | 按研究项目的访问控制 |

---

## 审计报告生成

### 定期报告项目

| 报告 | 频率 | 内容 |
|------|------|------|
| 访问摘要 | 每日 | 按用户搜索次数、拒绝次数 |
| 权限违规报告 | 每日 | Fail-Closed 触发、异常访问模式 |
| Guardrails 干预报告 | 每周 | 过滤触发次数、按主题统计 |
| 成本与使用报告 | 每月 | Token 消耗、API 调用次数、存储使用量 |
| 合规报告 | 每季度 | 法规要求符合状态、改进事项 |

### Athena 查询示例

```sql
-- 过去 7 天的权限拒绝事件
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- 按用户的搜索模式分析
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## 个人信息与敏感信息处理

### 掩码 / 分类流程

```
文档导入
  → PII 扫描（Comprehend / Guardrails）
  → 分类标签分配（机密级别 + PII 存在）
  → 在 .metadata.json 中记录分类信息
  → KB 同步
  
搜索时
  → SID 过滤（访问权限）
  → Guardrails PII 检测（输出掩码）
  → 回答生成（已掩码）
```

### 审批流程（机密数据访问）

需要访问绝密数据时的审批流程：

1. 用户提交搜索请求
2. SID 匹配识别"需要审批"类别
3. 向管理员发送审批请求通知（SNS / Slack）
4. 管理员批准 → 发放临时访问令牌
5. 仅在令牌有效期内可访问
6. 访问日志记录在审计表中

---

## 相关文档

| 文档 | 描述 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生产就绪检查清单 |
| [permission-consistency.md](permission-consistency.md) | 权限变更一致性模型 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 过滤架构 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全实验指南 |
