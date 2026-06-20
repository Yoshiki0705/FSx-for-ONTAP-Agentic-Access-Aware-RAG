# Amazon Bedrock Managed Knowledge Base 迁移路径评估

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | [English](../en/managed-kb-migration-evaluation.md) | [한국어](../ko/managed-kb-migration-evaluation.md) | **简体中文** | [繁體中文](../zh-TW/managed-kb-migration-evaluation.md) | [Français](../fr/managed-kb-migration-evaluation.md) | [Deutsch](../de/managed-kb-migration-evaluation.md) | [Español](../es/managed-kb-migration-evaluation.md)

**创建日期**: 2026-06-18
**目标区域**: ap-northeast-1（东京）— Managed KB 在东京区域可用
**状态**: 评估文档（未执行迁移 / 保留现有路径）
**相关**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md`（来源）

---

## 0. 本文档的定位

本文档评估将本仓库现有的 Permission-aware RAG 配置（Bedrock KB + OpenSearch Serverless / S3 Vectors）升级到在 AWS Summit New York 2026（2026-06-17）正式发布（GA）的 [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/) 时的**迁移路径**。

关键前提：

- 本文档为**评估资料**，并非建议立即迁移。
- 现有路径（Bedrock KB + OpenSearch Serverless / S3 Vectors）**不会删除**。
- 记述内容按以下两个证据层级分类。

| 层级 | 定义 | 本文档中的处理 |
|------|------|--------------|
| Public evidence | 可从 AWS 官方文档·博客验证 | 附出处链接记述 |
| Project-context expectation | 本项目内的设计判断·预期值（无法公开验证） | 标注为"本项目的假设" |

> ⚠️ **Distinction discipline**: 明确区分"示例功能的一般说明"与"本项目中已验证的行为"。Managed KB 的功能描述是基于 AWS 公开信息的一般说明，本项目中的 ACL 联动行为**尚未验证**（参见后述验证要点）。

---

## 1. Managed KB 的主要功能 (Public evidence)

基于 [Introducing Amazon Bedrock Managed Knowledge Base 博客](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) 和 [GA 公告](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)。为遵守许可限制，已在保留出处主旨的前提下进行了概括·改写。

| 功能 | 概要 | 与本项目的关联 |
|------|------|--------------|
| 6 个原生数据连接器 | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler。自动摄取数据和权限 | **S3 连接器**能否连接 FSx for ONTAP S3 Access Point 是关键 |
| Smart Parsing | 按数据类型·连接器自动选择最优解析策略（PDF·Office·表格·多模态） | 可能将现有的手动分块策略选择自动化 |
| Agentic Retriever | 将复杂查询分解为子查询，反复执行多跳检索 | 在 Permission-aware 上下文中需要重新授权（后述） |
| 托管向量存储 | 无需向量 DB 预置。已优化性价比 | 无需 OpenSearch Serverless / S3 Vectors 的运维负担 |
| AgentCore Gateway 集成 | 作为内置 connector target（MCP）公开。`Retrieve` 和 `AgenticRetrieveStream` 两个工具 | 可与本项目的 AgentCore Gateway（已实现）集成 |
| 现有 API 兼容 | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` 等相同 | 仅更改 KB ID 即可，无需代码更改（AWS 主张，待验证） |
| 区域 | 在包括东京在内的多个区域 GA | 与 ap-northeast-1 部署一致 |

### 价格模型 (Public evidence)

根据 [AWS 的说明](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/)，计费为两个维度（已索引数据大小 + 检索次数的按需计费）。无预付承诺。

> ⚠️ **成本估算注意**: 上述为已公开价格模型的结构，本项目工作负载下的实际成本尚未测量。在做出迁移决策前，请使用预期查询量·数据量对"现行（OpenSearch Serverless OCU / S3 Vectors 存储）"与"Managed KB（数据大小 + 检索次数）"进行单价比较。

---

## 2. 与现有配置的比较

### 2.1 架构比较

| 视角 | 现行 (Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|------|--------------------------------------------------------------|------------|
| 向量存储运维 | 自行管理（AOSS 的 OCU 设计 / S3 Vectors index 管理） | 完全托管（无需预置） |
| 数据源 | FSx for ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | 经由 S3 连接器（S3 AP 连接待验证） |
| 解析·分块 | 通过 `kbChunkingStrategy` 手动选择 (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing 自动选择（可自定义） |
| 嵌入模型 | 部署时固定 (`embeddingModel`，更改需重建) | 默认自动选择 + 可选指定 Bedrock 模型 |
| 检索 | 单次 Retrieve + 应用端 SID 过滤 | `Retrieve`（单次混合）+ `AgenticRetrieveStream`（多跳） |
| ACL 过滤 | 应用端 `allowed_group_sids` 匹配（与向量存储无关） | 元数据 `filter` 运算符 + `userContext`（待验证） |
| Gateway 集成 | 自定义（已实现的 AgentCore Gateway + Permission Interceptor） | 内置 connector target |
| 运维负担 | 中（需要向量存储·管道设计） | 低（托管） |
| 可定制性 | 高（所有组件可控） | 中（在托管范围内调整） |

### 2.2 现有系统的 SID 过滤方式 (Project-context)

本项目如 [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) 所述，采用以下与向量存储无关的方式。

```
Bedrock KB Retrieve API → 检索结果 + 元数据(allowed_group_sids)
→ 应用端(route.ts)匹配 用户SID ∩ 文档SID
→ 仅匹配的文档进入 Converse API
→ Fail-Closed: SID 获取失败则全部拒绝
```

该方式的优势在于，即使更换向量存储（AOSS / S3 Vectors），**应用端授权逻辑保持不变**。能否在迁移到 Managed KB 后保持这一不变条件，是最关键的论点。

---

## 3. 迁移判断标准

以"按用途选择（right tool for the job）"而非"替换竞品"来整理。对称地记述两种配置的权衡。

### 3.1 应考虑迁移到 Managed KB 的情况

- 希望**降低向量存储（OpenSearch Serverless OCU / S3 Vectors index）的运维·设计负担**
- 希望利用 Smart Parsing 进行**多格式文档（PDF·Office·表格）的自动解析**
- 寻求通过 Agentic Retriever 提升**多跳·复杂查询**的准确度
- 希望**无需重建基础设施即可跟进**新的嵌入·重排模型
- 希望集成到以 AgentCore Gateway 为中心的架构，通过**内置 connector target** 简化连接

### 3.2 应保留现行配置的情况

- 有**在检索时严格应用文件级 ACL（NTFS / SID）的要求**，并希望完全控制 `allowed_group_sids` 匹配行为
- 已**自行实现权限变更·删除·重命名的即时反映逻辑**（Managed 的托管同步能否同等保持尚未验证）
- 希望**精细控制向量存储的 filter / ranking / reranking**
- 在**托管存储中的 ACL 元数据保留·过滤尚未验证**的阶段，不希望破坏生产环境的 Fail-Closed 保证
- 出于数据主权·审计要求，需要**明确管理向量数据的存储位置**

### 3.3 判断流程

```
是否需要在检索时严格应用 ACL？
├─ YES → 能否清除 §4 的所有验证要点？
│        ├─ YES → 考虑分阶段迁移 (§5)
│        └─ NO  → 保留现行配置（优先 ACL 保证）
└─ NO  → 重视运维负担·准确度，优先考虑 Managed KB
```

> ⚠️ 本项目的主要目的是 **Permission-aware RAG**，ACL 严格应用是不可让步的要求。因此，除非清除 §4 的验证，否则保留现行配置为默认方针。

---

## 4. 对 Permission-aware RAG 的影响 (最重要)

能否在 Managed KB 的托管存储中保持本项目基于 SID 的 ACL 过滤。整理 Public evidence 与验证要点。

### 4.1 Public evidence: Managed KB 的访问控制手段

根据 [AgentCore Gateway connector target 文档](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)，Managed KB 拥有两种访问控制手段。

**(A) 元数据 `filter` 运算符 (`Retrieve` 工具)**

`managedSearchConfiguration.filter` 支持以下运算符（概括出处主旨）：
`equals`、`notEquals`、`greaterThan`、`greaterThanOrEquals`、`lessThan`、`lessThanOrEquals`、`in`、`notIn`、`startsWith`、`listContains`、`stringContains`、`andAll`、`orAll`

→ **`listContains` 有可能用于将用户 SID 与 `allowed_group_sids`（数组）匹配**。这可将现行的应用端匹配下推到检索层。

**(B) 通过 `userContext` 的访问控制过滤**

根据文档，当 KB 执行用户/组级访问控制时，调用应用在请求中包含 `userContext`（例如 `userId`）。Gateway 将其传递给 KB，KB 基于 `userContext` 应用过滤。关键在于，**Gateway 不会从调用者的 IAM 身份自动补全 `userContext`，应用必须显式传递**。此外明确指出，**`userContext` 由应用而非模型提供**。

→ 这种"由应用显式提供""不交给模型"的设计，与本项目的 **Fail-Closed·应用强制**原则方向一致。

### 4.2 验证要点 (迁移前必须确认)

以下均**尚未验证**，决定迁移可行性。一并标注 Project-context 的假设。

| # | 验证项目 | 本项目的假设 | 风险 |
|---|---------|-------------|------|
| V1 | S3 连接器能否将 **FSx for ONTAP S3 Access Point** 作为数据源（alias 格式·IAM 边界） | 假设 S3 兼容则可连接 | 无法连接则迁移本身不成立 |
| V2 | `.metadata.json` 的 `allowed_group_sids` 是否在 Managed KB 索引中**作为元数据保留** | 假设保留 | 不保留则无法 ACL 过滤 |
| V3 | `Retrieve` 的 `filter` 是否支持 **`listContains` 的 SID 数组匹配** | 假设可用 | 不可用则切换到 userContext 方式 |
| V4 | `userContext` 方式在 **S3 连接器摄取的数据**中是否有效（是否仅限 SaaS 连接器） | S3 是否有效不明 | S3 无效则依赖 filter 方式 |
| V5 | **`AgenticRetrieveStream`（多跳）的每个步骤**是否应用 ACL 过滤 | 需要每步应用 | 中间步骤混入权限外数据的风险 |
| V6 | 托管存储中**权限变更·删除·重命名的反映延迟**是否在可接受范围 | 期望与现有同等的即时性 | 反映延迟导致旧权限数据残留的风险 |
| V7 | 对话历史·缓存的 **ACL 应用**是否维持 | 应用端维持 | Managed 端缓存的行为不明 |

> ⚠️ **不可让步**: 若 V2、V3（或 V4）、V5 中任一未满足，因**权限外数据可能混入检索结果**，迁移为 **BLOCKED**。这违反 FSx for ONTAP AI/RAG 架构审查的不可让步要求（"权限外数据可能混入 vector search 结果的设计""无对传递给 LLM 的 context 进行授权检查的设计"）。

### 4.3 维持纵深防御

即使迁移，也不依赖单一手段，维持纵深防御。

```
1. 通过 IdP / Cognito / AD 进行用户认证
2. 获取用户 principal / 组 SID (DynamoDB user-access)
3. Managed KB 检索时的 filter (listContains) 或 userContext
4. ★ LLM context 注入前的应用端 ACL 重新匹配（保留现行 route.ts 逻辑）★
5. 使用 AgenticRetrieveStream 时每步后重新授权
6. 显示引用来源链接时重新授权
7. 审计日志（谁在何时使用了哪些 SID 来源信息）
```

→ 即使使用 Managed KB 端过滤，也**强烈建议保留步骤 4（应用端最终 ACL 匹配）**。这样即使托管端过滤行为与预期不同，也能保证 Fail-Closed。

---

## 5. 迁移路径 (分阶段 / 保留现有路径)

与现有的 Dual KB 迁移模式（[migration-guide-multimodal.md](../en/migration-guide-multimodal.md)）一样，通过**并行运行**分阶段验证。现有路径不会删除。

### Phase 0: PoC 验证 (无生产影响)

1. 用小规模验证数据集创建 Managed KB（建议使用 Snapshot / FlexClone 的一致数据）
2. 按顺序验证 §4.2 的 V1~V7
3. 针对 [tests/permission-matrix/](../../tests/permission-matrix/) 的 31 个场景，确认 SID 过滤（filter / userContext）的行为

### Phase 1: 并行运行 (Shadow)

1. 保留现有 KB，将 Managed KB 作为**只读 shadow** 并行运行
2. 向两个系统发送相同查询，比较检索结果·ACL 过滤结果·引用一致性
3. 用 RAGAS 等比较准确度·citation precision（[evaluation.md](evaluation.md)）

### Phase 2: 分阶段迁移 (Canary)

1. 用 AgentCore Gateway A/B 测试（AgentCore Optimization — 本仓库已实现）将部分流量路由到 Managed KB 路径
2. 确认所有权限测试（Fail-Closed、组嵌套、ACL 边界情况）通过
3. 确认统计显著性后，逐步迁移流量

### Phase 3: 切换判断

- 所有验证清除 → 将 Managed KB 设为默认路径
- 有未满足项 → 保留现行配置，Managed KB 保持 shadow 或撤回

> 建议即使迁移完成后，也将现有路径（Bedrock KB + OpenSearch Serverless / S3 Vectors）作为**一段时间的回滚路径**保留。

---

## 6. 验证清单

在做出迁移判断前，请清除以下所有项。

### 数据基础
- [ ] V1: S3 连接器可将 FSx for ONTAP S3 AP 注册为数据源
- [ ] 使用 Snapshot / FlexClone 的一致数据执行 PoC
- [ ] 不将生产数据直接作为重度爬取对象

### Permission-aware RAG (最重要)
- [ ] V2: `allowed_group_sids` 作为元数据保留
- [ ] V3 或 V4: 通过 `listContains` filter 或 `userContext` 使 SID 过滤生效
- [ ] V5: AgenticRetrieveStream 的每步应用 ACL
- [ ] 维持纵深防御步骤 4（应用端最终匹配）
- [ ] Fail-Closed: SID 获取失败则全部拒绝
- [ ] 31 个权限测试场景全部通过

### 数据生命周期
- [ ] V6: 权限变更·删除·重命名的反映延迟在可接受范围内
- [ ] V7: 对话历史·缓存应用 ACL

### 成本·性能
- [ ] 执行现行 vs Managed KB 的单价比较（数据大小 + 检索次数）
- [ ] 创建预期查询量下的月度估算

### 运维
- [ ] 将回滚步骤（返回现有路径）编写为 runbook
- [ ] 可通过审计日志追踪使用历史

---

## 7. 推荐判定

**当前判定: REQUEST CHANGES（验证完成前暂缓迁移）**

解除条件：

1. 通过 PoC 验证 §4.2 的验证要点 V1~V7
2. 特别是清除 **V2·V3（或 V4）·V5**（未满足则 BLOCKED）
3. 设计须维持纵深防御步骤 4（应用端最终 ACL 匹配）
4. 成本单价比较显示不逊于现行，或运维负担降低超过成本增加

**判定依据：**

- Managed KB 的运维负担降低·Smart Parsing·Agentic Retriever 对本项目有明确价值（Public evidence）。
- 然而，本项目的**最优先要求是 Permission-aware RAG 的 ACL 严格应用**，而托管存储中的 SID 过滤行为**尚未验证**。
- `userContext`（应用显式提供·与模型无关）与 `listContains` filter 方向一致，因此**视验证情况，迁移完全可行**。

> 本文档为评估资料。实际迁移应在经过上述验证并获得相关审查（FSx for ONTAP AI/RAG 架构审查）批准后实施。

---

## 相关文档

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Managed KB 验证步骤（S3 AP 连接验证 / FlexClone 安全验证模式）
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — SID 过滤的基本设计
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — S3 Vectors + SID 集成
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — 现有堆栈配置与 KB 配额
- [metadata-json-schema.md](metadata-json-schema.md) — `allowed_group_sids` 元数据模式
- [migration-guide-multimodal.md](../en/migration-guide-multimodal.md) — Dual KB 分阶段迁移的参考模式（英文）
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — 现行分块策略
- [evaluation.md](evaluation.md) — RAG 评估方法
