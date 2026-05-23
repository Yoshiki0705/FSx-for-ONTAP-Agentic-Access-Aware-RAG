# Architecture Decision Records (ADR) — 架构决策记录

**🌐 Language:** [日本語](../architecture-decision-records.md) | [English](../en/architecture-decision-records.md) | [한국어](../ko/architecture-decision-records.md) | **简体中文** | [繁體中文](../zh-TW/architecture-decision-records.md) | [Français](../fr/architecture-decision-records.md) | [Deutsch](../de/architecture-decision-records.md) | [Español](../es/architecture-decision-records.md)

**创建日期**: 2026-05-23  
**状态**: 已批准  
**目标读者**: 架构师、技术负责人、希望了解决策经过的人员

---

## 概述

本文档记录了 Permission-aware Agentic RAG 系统的主要架构决策及其依据。旨在说明"为什么选择了这种配置"，为未来的变更决策提供参考。

---

## ADR-001: 向量存储 — 默认采用 S3 Vectors

| 项目 | 内容 |
|------|------|
| **状态** | 已批准 |
| **日期** | 2026-03-29 |
| **上下文** | RAG 搜索的向量存储选择 S3 Vectors 还是 OpenSearch Serverless 作为默认 |

### 考虑的选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| S3 Vectors (采用) | 每月数美元、零运维、一键导出到 AOSS | 冷查询: 亚秒级、不支持高 QPS |
| OpenSearch Serverless | 持续 50ms、支持高 QPS、全文搜索 | 最低 $700/月 (2 OCU)、需要 OCU 管理 |

### 决策

**S3 Vectors 作为默认**，通过 `vectorStoreType` 参数可切换到 OpenSearch Serverless。

### 依据

1. PoC / 小规模使用每月数美元即可开始，降低了采用门槛
2. 通过 Bedrock KB 访问不依赖向量存储，SID 过滤逻辑通用
3. 性能需求提高时，可从控制台一键导出到 AOSS（约 15 分钟）
4. S3 Vectors 的元数据全部可过滤（无需额外配置）

### 影响

- 默认部署成本大幅降低（$700/月 → $5/月）
- 高 QPS 环境需要切换到 `vectorStoreType=opensearch`
- 注意 S3 Vectors 的 2KB 可过滤元数据限制（PDF 元数据较大时）

---

## ADR-002: 权限过滤 — 应用侧 SID 匹配

| 项目 | 内容 |
|------|------|
| **状态** | 已批准 |
| **日期** | 2026-01-15 |
| **上下文** | 在哪个层实施 RAG 搜索结果的权限过滤 |

### 考虑的选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| 应用侧 SID 匹配 (采用) | 不依赖向量存储、LLM 无法绕过、易于实现 Fail-Closed | 搜索后过滤，获取数 > 显示数 |
| 向量存储 metadata filter | 搜索时过滤、高效 | Bedrock KB Retrieve API 无法直接控制 |
| Bedrock KB RetrieveAndGenerate | 单个 API 完成 | 不返回 metadata，无法进行 SID 过滤 |

### 决策

采用 **Bedrock KB Retrieve API + 应用侧 SID 匹配 + Converse API** 的两阶段方式。

### 依据

1. RetrieveAndGenerate API 不在 citation 的 metadata 中包含 `allowed_group_sids`，无法进行 SID 过滤
2. 应用侧过滤在 LLM 外部执行，无法通过 Prompt Injection 绕过
3. 不依赖向量存储类型（S3 Vectors / AOSS）的通用逻辑
4. Fail-Closed（SID 获取失败时全部拒绝）的实现明确

### 影响

- 需要对 Retrieve API 获取的所有文档进行过滤，因此需要设置较多的获取数
- 过滤后文档数较少时，回答质量可能下降
- 权限缓存（DynamoDB、TTL 5 分钟）加速重复检查

---

## ADR-003: 认证方式 — Cognito + 多 IdP 联合

| 项目 | 内容 |
|------|------|
| **状态** | 已批准 |
| **日期** | 2026-02-01 |
| **上下文** | 用户认证及 SID/UID/GID 获取方式选定 |

### 考虑的选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| Cognito + SAML/OIDC/LDAP (采用) | 支持 5 种模式、CDK 参数切换、支持 Fail-Closed | Cognito 限制（自定义属性数、令牌大小） |
| IAM Identity Center 直接使用 | AWS 原生 SSO | 与 RAG 应用集成复杂 |
| 自定义认证 (Lambda Authorizer) | 完全灵活 | 实现和运维成本高 |

### 决策

以 **Cognito User Pool** 为中心，通过 CDK 参数切换 SAML（AD Federation）、OIDC（Auth0/Keycloak/Okta）、LDAP（OpenLDAP/FreeIPA）、邮箱/密码 5 种模式。

### 依据

1. Cognito 与 CloudFront + Lambda Function URL (IAM Auth) 集成容易
2. Post-Authentication Trigger 可自动获取 SID/UID/GID 并注册到 DynamoDB
3. `authFailureMode=fail-closed` 实现权限获取失败时阻止登录
4. 可根据客户现有 IdP 灵活选择模式

### 影响

- 注意 Cognito 限制（50 个自定义属性、2KB 令牌大小）
- 需要管理 SAML 元数据 URL（IdP 侧证书更新时）
- LDAP 直接查询需要 VPC 内 Lambda

---

## ADR-004: 前端 — Lambda Web Adapter + Next.js 15

| 项目 | 内容 |
|------|------|
| **状态** | 已批准 |
| **日期** | 2026-01-10 |
| **上下文** | Web 应用托管方式选定 |

### 考虑的选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| Lambda Web Adapter + Next.js (采用) | 无服务器、IAM Auth + OAC、冷启动可接受 | 冷启动 3-5 秒、Docker 镜像大小 |
| ECS Fargate | 常驻运行、低延迟 | 最低 $30/月（常驻）、需要 ALB |
| Amplify Hosting | 托管、CI/CD 集成 | 不支持 IAM Auth、定制限制 |
| App Runner | 简单部署、自动扩展 | 不支持 IAM Auth、VPC 集成限制 |

### 决策

使用 **Lambda Web Adapter** 无服务器运行 Next.js 15，通过 CloudFront OAC + IAM Auth 保护。

### 依据

1. IAM 认证（Function URL + OAC）完全防止 CloudFront 以外的直接访问
2. 无服务器，空闲时段成本为零
3. CDK 一键部署（包含 Docker 镜像构建）
4. Next.js 15 的 App Router + Server Components 支持 SSR/ISR

### 影响

- 冷启动（3-5 秒）在首次访问时发生。可通过 Provisioned Concurrency 缓解
- 需要优化 Docker 镜像大小（多阶段构建）
- Apple Silicon (M1/M2/M3) 需要预构建模式（x86_64 Lambda 兼容）

---

## ADR-005: 数据同步 — KB Auto-Sync（轮询方式）

| 项目 | 内容 |
|------|------|
| **状态** | 已批准 |
| **日期** | 2026-04-15 |
| **上下文** | 将 FSx for ONTAP 上的文件变更反映到 Bedrock KB 的方式 |

### 考虑的选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| EventBridge Scheduler 轮询 (采用) | 简单、不需要 FSx 事件、S3 AP 兼容 | 最大 15 分钟延迟、ListObjectsV2 成本 |
| CloudTrail + EventBridge（事件驱动） | 近实时 | S3 AP 的 CloudTrail 支持有限 |
| FSx Audit Log + EventBridge | 文件级事件 | 配置复杂、日志量大 |
| 仅手动触发 | 最简单 | 运维负担、同步遗漏风险 |

### 决策

默认使用 **EventBridge Scheduler 5-15 分钟间隔轮询**，仅在检测到变更时执行 `StartIngestionJob`。

### 依据

1. FSx for ONTAP S3 Access Point 对 CloudTrail 数据事件的支持有限
2. ListObjectsV2 + DynamoDB 清单比较可靠地检测变更
3. IN_PROGRESS 作业去重防止不必要的同步
4. 连续 3 次失败触发 CloudWatch Alarm → 通知运维团队

### 影响

- 最大 15 分钟同步延迟（取决于轮询间隔）
- 大规模环境（100,000+ 文件）需注意 ListObjectsV2 执行时间
- Transfer Family 路径也支持 CloudTrail 事件驱动模式

---

## ADR-006: Smart Routing — 3 层模型自动选择

| 项目 | 内容 |
|------|------|
| **状态** | 已批准 |
| **日期** | 2026-05-01 |
| **上下文** | 成本优化的模型选择策略 |

### 考虑的选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| 3 层自动路由 (采用) | 成本降低 60-80%、质量保持 | 依赖分类精度、误分类风险 |
| 单一模型固定 | 简单、可预测 | 成本低效或质量不足 |
| 用户手动选择 | 用户控制 | UX 恶化、成本管理困难 |

### 决策

基于查询复杂度的 **3 层自动路由**（Simple → Haiku、Complex → Sonnet、Full-context → Opus）作为默认，同时提供手动选择选项。

### 依据

1. 企业 RAG 中 60% 以上的问题是简单的事实确认（Haiku 即可满足）
2. 加权平均成本 ~$0.014/query 在提升质量的同时与全部使用 Sonnet 的 ~$0.01 成本相当
3. CloudWatch EMF 指标可视化路由分布，支持阈值调整
4. 回退机制（模型不可用时自动切换到下一层）确保可用性

### 影响

- 分类器精度直接影响成本和质量（建议定期调整阈值）
- 注意 Opus 使用时的成本峰值（建议设置每日成本上限）
- Smart Routing 关闭时按传统方式使用单一固定模型

---

## 相关文档

| 文档 | 相关 ADR |
|------|---------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
