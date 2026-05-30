# 威胁模型 — Access-Aware Agentic RAG

**🌐 Language:** [日本語](../threat-model.md) | [English](../en/threat-model.md) | [한국어](../ko/threat-model.md) | **简体中文** | [繁體中文](../zh-TW/threat-model.md) | [Français](../fr/threat-model.md) | [Deutsch](../de/threat-model.md) | [Español](../es/threat-model.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标受众**: 安全架构师、威胁建模负责人、CISO

---

## 概述

本文档是针对 Permission-aware Agentic RAG 系统的主要威胁、攻击路径、影响、现有缓解措施及建议追加对策的威胁模型。

---

## 系统边界和信任边界

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 信任边界 1: 互联网 → CloudFront                                          │
│  攻击者: 外部用户、机器人、脚本                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ 信任边界 2: CloudFront → Lambda (WebApp)                                 │
│  攻击者: 已认证但越权的用户                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ 信任边界 3: Lambda → Bedrock / DynamoDB / FSx                            │
│  攻击者: 内部威胁、配置错误、供应链                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ 信任边界 4: FSx for ONTAP → S3 Access Point → Bedrock KB                     │
│  攻击者: 权限提升、元数据篡改                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 威胁目录

### T1: Prompt Injection

| 项目 | 内容 |
|------|------|
| **威胁** | 恶意提示词导致系统忽略系统提示词、绕过权限检查、引发非预期的信息泄露 |
| **攻击路径** | 用户输入 → Converse API / Agent |
| **影响** | 高 — 越权文档内容泄露、系统行为被篡改 |
| **现有缓解措施** | Bedrock Guardrails（内容过滤）、SID 过滤在应用层实施（LLM 无法绕过） |
| **追加建议** | 启用 Guardrails 的 Prompt Attack 过滤器、输入长度限制、添加输出验证层 |
| **残余风险** | 间接 Prompt Injection（嵌入在文档中的指令）无法完全防御 |

**重要**: 本系统的 SID 过滤在 LLM 外部（应用层）执行，因此 Prompt Injection 无法绕过权限检查本身。但仍存在以非预期方式泄露已授权文档内信息的风险。

---

### T2: Retrieval Poisoning

| 项目 | 内容 |
|------|------|
| **威胁** | 将恶意文档放置到 FSx 卷中，污染 RAG 检索结果 |
| **攻击路径** | CIFS/SMB 访问 → FSx 卷 → S3 AP → Bedrock KB |
| **影响** | 中〜高 — 生成错误信息、钓鱼诱导、间接 Prompt Injection |
| **现有缓解措施** | NTFS ACL 写入限制、Transfer Family 的 IAM 角色限制、`.metadata.json` 仅由服务角色生成 |
| **追加建议** | 文档导入时的恶意软件扫描、内容验证管道、异常检测（文档急剧增加告警） |
| **残余风险** | 拥有合法写入权限的内部用户进行的蓄意污染 |

---

### T3: Cross-User Data Leakage

| 项目 | 内容 |
|------|------|
| **威胁** | 用户 A 的搜索结果中包含仅用户 B 可访问的文档 |
| **攻击路径** | SID 过滤实现缺陷、缓存污染、会话混淆 |
| **影响** | 高 — 机密信息泄露、合规违规 |
| **现有缓解措施** | SID 匹配（集合交集）、Fail-Closed 原则、权限矩阵测试（31 个场景） |
| **追加建议** | 定期自动执行权限矩阵测试、异常检测（访问通常不会访问的文档的模式） |
| **残余风险** | 低 — SID 过滤在 LLM 外部执行，除实现缺陷外难以绕过 |


---

### T4: Stale ACL / Permission Drift

| 项目 | 内容 |
|------|------|
| **威胁** | 文件 ACL 已变更，但向量存储的元数据或权限缓存中仍残留旧权限 |
| **攻击路径** | ACL 变更 → 元数据未更新 → 以旧权限可检索 |
| **影响** | 中 — 权限撤销后仍可在一定时间内访问（最长 35 分钟） |
| **现有缓解措施** | KB Auto-Sync（15 分钟间隔）、权限缓存 TTL（5 分钟）、紧急权限撤销流程 |
| **追加建议** | ACL 变更事件的即时检测（FSx Audit Log → EventBridge）、考虑缩短缓存 TTL、权限变更审计日志 |
| **残余风险** | 由于采用 Eventually Consistent 模型，无法实现完全实时反映。紧急情况下通过手动撤销应对 |

**详细信息**: 参见 [permission-consistency.md](permission-consistency.md)

---

### T5: Over-Permissive Cache

| 项目 | 内容 |
|------|------|
| **威胁** | 权限缓存以过度许可的状态固定，持续允许本应拒绝的访问 |
| **攻击路径** | 缓存写入时的竞态条件、TTL 配置错误、缓存键冲突 |
| **影响** | 高 — 持续访问越权文档 |
| **现有缓解措施** | DynamoDB TTL 自动过期（5 分钟）、缓存键包含用户 ID + 文档 ID |
| **追加建议** | 监控缓存命中率、异常高命中率告警、定期全量清除缓存（每日） |
| **残余风险** | 低 — TTL 较短，即使被污染也会在 5 分钟内自动恢复 |

---

### T6: Agent Tool Abuse

| 项目 | 内容 |
|------|------|
| **威胁** | Agent 调用非预期的工具，执行数据变更、删除或外部发送 |
| **攻击路径** | Prompt Injection → Agent 行动计划被篡改 → 调用危险工具 |
| **影响** | 高 — 数据破坏、信息泄露、成本爆炸 |
| **现有缓解措施** | AgentCore Policy（工具访问限制）、Action Group 的 IAM 角色最小权限化、默认仅提供只读工具 |
| **追加建议** | Human Approval（外部操作执行前的审批）、工具调用次数限制、成本上限设置 |
| **残余风险** | 中 — Agent 自主性与安全性的权衡。限制为只读可降低风险 |

---

### T7: Audit Log Tampering

| 项目 | 内容 |
|------|------|
| **威胁** | 篡改或删除审计日志，隐藏非法访问的证据 |
| **攻击路径** | Lambda 执行角色的权限提升 → 篡改 CloudWatch Logs / S3 |
| **影响** | 高 — 无法进行事件调查、合规违规 |
| **现有缓解措施** | CloudWatch Logs 的保留策略、IAM 最小权限 |
| **追加建议** | S3 Object Lock（WORM）、CloudTrail 日志保存到独立账户、日志完整性验证（CloudTrail Digest） |
| **残余风险** | 低 — S3 Object Lock + 独立账户保存使篡改实质上不可能 |

**详细信息**: 参见 [governance-and-audit.md](governance-and-audit.md)

---

### T8: Misconfigured Identity Federation

| 项目 | 内容 |
|------|------|
| **威胁** | OIDC / SAML / LDAP 配置错误导致非法用户通过认证，或正规用户被授予过多权限 |
| **攻击路径** | IdP 配置错误 → 非法令牌签发 → 通过 Cognito 认证 → 过多 SID 授予 |
| **影响** | 高 — 权限提升、访问所有文档 |
| **现有缓解措施** | `authFailureMode=fail-closed`（权限获取失败时阻断）、Cognito 令牌验证、LDAP 健康检查 |
| **追加建议** | IdP 配置的定期审计、联合身份元数据的自动验证、异常组 SID 数量告警 |
| **残余风险** | 中 — IdP 侧的配置不在本系统控制范围内。通过 Fail-Closed 限制影响 |

---

### T9: Vector Metadata Leakage

| 项目 | 内容 |
|------|------|
| **威胁** | 向量存储的元数据（SID 信息、文件路径）意外暴露，泄露组织结构和访问权限信息 |
| **攻击路径** | 直接访问 S3 Vectors / OpenSearch Serverless、API 响应返回过多信息 |
| **影响** | 中 — 推测组织结构、为定向攻击收集情报 |
| **现有缓解措施** | 通过 VPC 端点限制访问、IAM 策略防止直接访问、前端 API 响应中排除 SID 信息 |
| **追加建议** | S3 Vectors 桶策略最小权限化、OpenSearch Serverless 数据访问策略审计、元数据加密 |
| **残余风险** | 低 — 仅允许通过 Bedrock KB 访问，IAM 防止直接访问 |

---

### T10: Denial of Wallet / Cost Abuse

| 项目 | 内容 |
|------|------|
| **威胁** | 通过大量请求或蓄意使用高成本模型，导致 AWS 使用费用暴增 |
| **攻击路径** | 已认证用户的大量查询、Agent 模式的无限循环、连续使用高成本模型 |
| **影响** | 高 — 意外的高额账单 |
| **现有缓解措施** | WAF 速率限制（2000 req/5min）、Smart Routing（优先使用低成本模型）、Lambda 并发执行数限制 |
| **追加建议** | AWS Budgets 告警、用户级每日查询上限、Agent 步骤数上限、考虑 Bedrock Provisioned Throughput |
| **残余风险** | 中 — 速率限制可缓解，但无法完全防止正规用户的过度使用 |

---

## 威胁 → 对策映射表

| 威胁 | WAF | Guardrails | SID Filter | Fail-Closed | IAM | KMS | Audit | AgentCore Policy |
|------|-----|-----------|-----------|------------|-----|-----|-------|-----------------|
| T1: Prompt Injection | — | ✅ | — | — | — | — | ✅ | — |
| T2: Retrieval Poisoning | — | ✅ | — | — | ✅ | — | ✅ | — |
| T3: Cross-User Leakage | — | — | ✅ | ✅ | — | — | ✅ | — |
| T4: Stale ACL | — | — | — | ✅ | — | — | ✅ | — |
| T5: Over-Permissive Cache | — | — | ✅ | ✅ | — | — | ✅ | — |
| T6: Agent Tool Abuse | — | ✅ | — | — | ✅ | — | ✅ | ✅ |
| T7: Audit Log Tampering | — | — | — | — | ✅ | ✅ | — | — |
| T8: Misconfigured IdP | — | — | — | ✅ | ✅ | — | ✅ | — |
| T9: Metadata Leakage | — | — | — | — | ✅ | ✅ | ✅ | — |
| T10: Cost Abuse | ✅ | — | — | — | — | — | ✅ | ✅ |

---

## 风险评估摘要

| 威胁 | 发生可能性 | 影响度 | 残余风险 | 优先级 |
|------|-----------|--------|---------|--------|
| T1: Prompt Injection | 高 | 中 | 中 | P1 |
| T2: Retrieval Poisoning | 低 | 高 | 低 | P2 |
| T3: Cross-User Leakage | 低 | 高 | 低 | P1 |
| T4: Stale ACL | 中 | 中 | 中 | P2 |
| T5: Over-Permissive Cache | 低 | 高 | 低 | P3 |
| T6: Agent Tool Abuse | 中 | 高 | 中 | P1 |
| T7: Audit Log Tampering | 低 | 高 | 低 | P2 |
| T8: Misconfigured IdP | 中 | 高 | 中 | P1 |
| T9: Metadata Leakage | 低 | 中 | 低 | P3 |
| T10: Cost Abuse | 中 | 中 | 中 | P2 |

---

## 建议追加对策（按优先级排序）

### 即时应对（P1）

1. **启用 Guardrails Prompt Attack 过滤器** — T1 对策
2. **实现 Agent 工具调用的 Human Approval** — T6 对策
3. **建立 IdP 配置的定期审计流程** — T8 对策
4. **将权限矩阵测试纳入 CI/CD** — T3 对策

### 短期应对（P2）

5. **通过 S3 Object Lock 保护审计日志** — T7 对策
6. **ACL 变更事件的即时检测** — T4 对策
7. **文档导入时的内容验证** — T2 对策
8. **AWS Budgets + 用户级查询上限** — T10 对策

### 中期应对（P3）

9. **缓存命中率的异常检测** — T5 对策
10. **向量存储元数据的加密** — T9 对策

---

## 相关文档

| 文档 | 相关威胁 |
|------|---------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 所有威胁（生产化时的对策确认） |
| [permission-consistency.md](permission-consistency.md) | T3, T4, T5（权限一致性） |
| [governance-and-audit.md](governance-and-audit.md) | T7, T8, T9（审计与治理） |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | T2, T10（安全实验范围） |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | T1, T3, T5（SID 过滤架构设计） |
