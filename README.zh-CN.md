# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

> 针对存储在 FSx for ONTAP 上的企业数据，提供在查询时自动应用 NTFS ACL / UNIX 权限的 Permission-aware RAG + Agentic AI 参考实现。AWS CDK 单命令部署，支持从 PoC 到生产评估。

---

## 快速开始

| 我想要... | 指南 | 所需时间 |
|----------|------|---------|
| 快速体验 | [PoC 工作坊指南](docs/zh-CN/poc-workshop-guide.md) | 90 分钟 |
| 部署到我的账户 | [部署指南](docs/deployment-guide.md) | 30-40 分钟 |
| 使用真实数据验证 | [安全实验指南](docs/zh-CN/safe-experimentation-guide.md) | 2-4 周 |
| 评估准确性和成本 | [RAG/Agent 评估框架](docs/zh-CN/evaluation.md) | 1 周 |
| 评估生产就绪性 | [生产就绪检查清单](docs/zh-CN/production-readiness-checklist.md) | — |
| 估算成本 | [成本估算工作表](docs/zh-CN/cost-estimation-worksheet.md) | — |

<details><summary>📂 全部功能与设计指南</summary>

| 类别 | 指南 | 内容 |
|------|------|------|
| 架构 | [实现概览（22 个方面）](docs/zh-CN/implementation-overview.md) | 全组件技术详情 |
| 架构 | [Architecture Decision Records](docs/zh-CN/architecture-decision-records.md) | 6 项关键设计决策依据 |
| 权限 | [SID 过滤架构](docs/zh-CN/SID-Filtering-Architecture.md) | 权限匹配机制 |
| 认证 | [认证与用户管理](docs/zh-CN/auth-and-user-management.md) | OIDC / SAML / LDAP 集成 |
| 安全 | [威胁模型](docs/zh-CN/threat-model.md) | 10 个威胁类别、攻击路径、缓解措施 |
| 安全 | [治理与审计设计](docs/zh-CN/governance-and-audit.md) | 审计日志、Responsible AI、Guardrails |
| 演示 | [行业演示数据（7 个行业）](demo-data/industry-packs/) | 政务・医疗・法务・制造・建筑・教育・保险 |
| 全部文档 | [文档索引](docs/zh-CN/DOCUMENTATION_INDEX.md) | 含推荐阅读顺序的完整列表 |

</details>

---

## 架构

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (认证: OIDC/SAML/Email)    (RAG 搜索 + Embedding)       (SID/权限数据)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**处理流程**: 用户认证 → 从 DynamoDB 获取 SID → Bedrock KB 向量检索 → SID 匹配过滤 → 仅使用授权文档生成回答

主要特性:
- **Permission-aware RAG** — 在检索时自动应用 NTFS ACL / UNIX 权限（Fail-Closed）
- **Agentic AI** — KB 模式（文档搜索）与 Agent 模式（多步推理）一键切换
- **Smart Routing** — 根据查询复杂度自动选择 Haiku / Sonnet / Opus（成本降低 40-60%）
- **低成本** — 默认使用 S3 Vectors（每月数美元）
- **22 项集成功能** — 语音聊天、Guardrails、Graph RAG、Web Search 等（[详情](docs/zh-CN/implementation-overview.md)）

<details><summary>⚠️ 前提条件与限制</summary>

| 项目 | 内容 |
|------|------|
| 前提环境 | Node.js 22+、Docker、已配置 AWS CLI、AdministratorAccess 等效权限 |
| 部署区域 | ap-northeast-1（可更改）+ us-east-1（WAF/Web Search 用，固定） |
| ONTAP 版本 | 9.17.1 以上（S3 Access Points 要求） |
| S3 AP 主要限制 | 不支持条件写入、不支持 Event Notifications、ListObjectsV2 高延迟 |
| 向量存储 | S3 Vectors（默认，filterable 2KB 限制）/ OpenSearch Serverless（高性能） |
| Responsible AI | AI 输出为辅助信号，最终决策由人负责。[详情](docs/zh-CN/governance-and-audit.md) |

完整 S3 AP 兼容性矩阵请参见 [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)。

</details>

<details><summary>📚 相关仓库</summary>

| 仓库 | 用途 | 概述 |
|------|------|------|
| **[本仓库]** | AI / RAG | 权限过滤 RAG + Agentic AI |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless 自动化 | 17 个行业无服务器模式 |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Athena / Glue / EMR / SageMaker 集成 |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability | 无需 EC2 即可将审计日志投递到 Datadog / Splunk / Grafana |

</details>

<details><summary>🔧 开发者</summary>

```bash
npx tsc --noEmit
npx cdk synth --quiet
npx jest --no-coverage
cd docker/nextjs && npx vitest run
```

项目结构与编码规范请参见 [CONTRIBUTING.md](CONTRIBUTING.md)，变更日志请参见 [CHANGELOG.md](CHANGELOG.md)。

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)
