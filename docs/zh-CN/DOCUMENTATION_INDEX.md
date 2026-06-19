# 文档索引

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | **简体中文** | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## 必读文档

| 文档 | 说明 |
|------|------|
| [README.md](../../README.zh-CN.md) | 系统概述、架构、部署步骤、WAF/Geo 设置 |
| [auth-and-user-management.md](auth-and-user-management.md) | 认证与用户管理指南（认证模式选择、AD Federation、自动 SID 注册、故障排除） |
| [implementation-overview.md](implementation-overview.md) | 详细实现（22个方面：图像分析 RAG、KB 连接 UI、Smart Routing、监控与告警、OIDC/LDAP Federation） |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | 基于 SID 的权限过滤详细设计 |
| [verification-report.md](verification-report.md) | 部署后验证流程和测试用例 |
| [ui-specification.md](ui-specification.md) | Chatbot UI 规格（KB/Agent 模式、Agent Directory、企业级 Agent 功能、侧边栏设计） |
| [demo-recording-guide.md](demo-recording-guide.md) | 演示视频录制指南（6项证据） |
| [embedding-server-design.md](embedding-server-design.md) | Embedding 服务器设计与实现文档 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | CDK 堆栈架构指南（向量存储比较、实现洞察） |
| [README - AD SAML Federation](../../README.zh-CN.md#ad-saml-federation-optional) | AD SAML federation 设置（Managed AD / Self-managed AD） |

## 设置与验证

| 文档 | 说明 |
|------|------|
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | 认证模式演示环境搭建指南（5种模式，附带示例配置文件） |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | 验证场景（管理员与普通用户权限差异、AD SSO 登录、OIDC/LDAP 登录） |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx for ONTAP + AD 集成、CIFS 共享、NTFS ACL 配置、Name-Mapping 设置（已验证流程） |
| [demo-environment-guide.md](demo-environment-guide.md) | 验证环境资源 ID、访问信息、Embedding 服务器流程 |

## 企业设计与运维指南

| 文档 | 说明 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生产就绪检查清单（Demo → PoC → Production 成熟度级别定义、安全/审计/DR/运维确认项、含审批人列） |
| [poc-success-criteria-template.md](poc-success-criteria-template.md) | PoC 成功标准模板（利益相关者定义、Go/No-Go 判定标准、下一阶段条件、完成报告模板） |
| [data-readiness-assessment.md](data-readiness-assessment.md) | 数据就绪度评估模板（数据位置·分类·权限结构·质量·合规确认、审批流程） |
| [partner-faq.md](partner-faq.md) | 合作伙伴 FAQ（客户提案时的12个问答、提案资源列表） |
| [permission-consistency.md](permission-consistency.md) | 权限变更一致性模型（ACL 变更 → 元数据再生成 → KB 重新同步 → 缓存失效流程、最大延迟、紧急权限撤销流程） |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 性能与容量设计指南（按规模配置、S3 AP 考虑事项、QoS、向量存储选型） |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 多租户与合作伙伴部署模式（账户隔离/SVM 隔离/混合、成本估算模板） |
| [governance-and-audit.md](governance-and-audit.md) | 治理与审计设计（审计日志模式、Responsible AI、Guardrails 策略、行业特定用例） |
| [evaluation.md](evaluation.md) | RAG / Agent 评估指标（4轴评估：业务 KPI、RAG 质量、权限控制、Agent 性能；PoC 评估模板） |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全实验指南（范围定义、禁止事项、真实数据导入检查清单、回滚流程） |
| [threat-model.md](threat-model.md) | 威胁模型（10个威胁类别、攻击路径、现有缓解措施、额外建议、威胁→对策映射表） |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | CloudWatch 仪表板运维指南（指标列表、告警定义、故障排除模式） |
| [poc-workshop-guide.md](poc-workshop-guide.md) | PoC 工作坊指南（90分钟：部署 → 测试 → 评估 → 清理） |
| [cost-estimation-worksheet.md](cost-estimation-worksheet.md) | 成本估算工作表（按配置月度概算模板、计算公式、优化要点） |
| [architecture-decision-records.md](architecture-decision-records.md) | Architecture Decision Records（6个主要决策：向量存储、权限过滤、认证、前端、同步、路由） |
| [managed-kb-migration-evaluation.md](managed-kb-migration-evaluation.md) | Amazon Bedrock Managed Knowledge Base 迁移路径评估（与现有 KB + OpenSearch Serverless / S3 Vectors 的比较、对 Permission-aware RAG 的影响、ACL 元数据过滤验证要点、分阶段迁移）※AWS Summit NY 2026 |
| [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) | Managed KB 升级路径（S3 AP 数据源连接验证步骤 V1–V4、Permission-aware 设计课题、使用 FlexClone 的安全验证模式、按用途选择指南）※并行选项·验证步骤 |
| [investigations/agentcore-web-search-integration.md](investigations/agentcore-web-search-integration.md) | 将 AgentCore Web Search Tool 集成为 Permission-aware RAG 混合搜索选项的设计调查（UI 切换、us-east-1 跨区域 Gateway、Lambda Layer/inline、查询安全性·引用分离·提示注入防御、实现顺序）※AWS Summit NY 2026 |
| [monitoring/athena-audit-tables.sql](../../monitoring/athena-audit-tables.sql) | Athena 表定义（审计日志分析用 DDL + 示例查询） |
| [benchmark-scenarios.md](benchmark-scenarios.md) | 基准测试场景（10K/100K/1M 文件、5个计测场景、理论基线估算值） |
| [demo-data/industry-packs/](../../demo-data/industry-packs/) | 行业演示数据包（8个行业 × 5个文档：行政·医疗·法务·制造·建设·教育·保险 + 通用） |
| [s3ap-serverless-patterns-integration.md](s3ap-serverless-patterns-integration.md) | S3AP Serverless Patterns 联动架构（与 17 UC 的 3 模式联动） |
| [benchmarks/](../../benchmarks/) | 基准测试框架（测试数据生成、执行脚本、结果模板） |
| [tests/permission-matrix/](../../tests/permission-matrix/) | 权限矩阵测试（31个 ACL 边缘场景：Fail-Closed、组嵌套、继承权限、紧急撤销） |

## FSx for ONTAP 运维自动化

| 文档 | 说明 |
|------|------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | 运维自动化套件概述（目录结构、用例） |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | 此架构如何简化 FSx for ONTAP 运维（设计决策、成本估算、安全设计） |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | AWS 集成验证报告（2026-05-01，所有阶段通过） |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | 集成 CloudFormation 模板（含 VPC 端点） |

## Transfer Family 摄取

| 文档 | 说明 |
|------|------|
| [transfer-family-e2e-verification.md](transfer-family-e2e-verification.md) | E2E 验证报告（SFTP 连接 → 上传 → KB 摄取完成、全步骤 PASS） |
| [transfer-family-partner-onboarding.md](transfer-family-partner-onboarding.md) | 合作伙伴入门指南（SSH 密钥设置、SFTP 连接、文件命名规则、故障排除） |
| [transfer-family-networking-prerequisites.md](transfer-family-networking-prerequisites.md) | 网络前提条件（VPC 端点、IP 允许列表、安全组） |
| [v4.2-demo-verification-supplement.md](v4.2-demo-verification-supplement.md) | v4.2 演示验证补充指南（全用例测试流程、预期结果、日志获取方法） |

## 示例配置文件

| 文件 | 认证模式 | 说明 |
|------|----------|------|
| `demo-data/configs/mode-a-email-password.json` | 邮箱/密码 | 最小配置，手动 SID 注册 |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0（无 LDAP） |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP 同时启用 |

## Embedding 服务器（通过 FlexCache CIFS 挂载）

| 文档 / 文件 | 说明 |
|-------------|------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Embedding 服务器部署与运维流程 |
| `docker/embed/src/index.ts` | Embedding 应用（文档扫描 → 分块 → 向量化 → 索引） |
| `docker/embed/src/oss-client.ts` | OpenSearch Serverless SigV4 签名客户端（IMDS 认证支持） |
| `docker/embed/Dockerfile` | Embedding 容器定义（node:22-slim、cifs-utils） |
| `docker/embed/buildspec.yml` | CodeBuild 构建定义 |
| `lib/stacks/demo/demo-embedding-stack.ts` | EmbeddingStack CDK 定义（EC2 + ECR + IAM） |

## 设置脚本

| 脚本 | 说明 |
|------|------|
| `demo-data/scripts/create-demo-users.sh` | 创建 Cognito 测试用户 |
| `demo-data/scripts/setup-user-access.sh` | 在 DynamoDB 中注册 SID 数据 |
| `demo-data/scripts/upload-demo-data.sh` | 上传测试文档到 S3 |
| `demo-data/scripts/sync-kb-datasource.sh` | 同步 Bedrock KB 数据源 |
| `demo-data/scripts/setup-openldap.sh` | OpenLDAP 服务器设置（VPC 内 EC2，测试用户/组） |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API name-mapping 规则设置 |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP 集成验证（Lambda → LDAP → DynamoDB） |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP name-mapping 验证（REST API 连接与规则获取） |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | 模式 C（OIDC+LDAP）一键设置（全阶段自动执行） |

## 推荐阅读顺序

### 第一阶段：初始设置

1. **README.md** — 系统概述和部署步骤
2. **auth-and-user-management.md** — 认证模式选择与用户管理
3. **implementation-overview.md** — 22个方面的详细实现
4. **SID-Filtering-Architecture.md** — 核心功能技术详情
5. **safe-experimentation-guide.md** — 安全实验指南（PoC 开始前必读）

### 第二阶段：验证与评估

6. **demo-recording-guide.md** — 演示视频录制指南
7. **ontap-setup-guide.md** — FSx for ONTAP AD 集成、CIFS 共享设置
8. **demo-environment-guide.md** — 验证环境设置
9. **demo-scenario.md** — 执行验证场景
10. **evaluation.md** — PoC 评估模板

### 第三阶段：生产与企业设计

11. **production-readiness-checklist.md** — 生产就绪检查清单
12. **permission-consistency.md** — 权限变更一致性模型
13. **fsxn-sizing-and-performance.md** — FSx for ONTAP 性能与容量设计
14. **governance-and-audit.md** — 治理与审计设计
15. **partner-deployment-patterns.md** — 多租户部署模式
