# Permission-Aware RAG 系统 — 实现概述

**🌐 Language:** [日本語](../implementation-overview.md) | [English](../en/implementation-overview.md) | [한국어](../ko/implementation-overview.md) | **简体中文** | [繁體中文](../zh-TW/implementation-overview.md) | [Français](../fr/implementation-overview.md) | [Deutsch](../de/implementation-overview.md) | [Español](../es/implementation-overview.md)

**创建日期**: 2026-03-25  
**版本**: 3.3.0

---

## 概述

本系统是一个结合 Amazon FSx for NetApp ONTAP 和 Amazon Bedrock 的 RAG（检索增强生成）聊天机器人系统，提供基于文件访问权限（SID）的过滤功能。它将每个用户的 NTFS ACL 信息作为元数据管理，并在搜索时实时过滤结果，实现安全的文档检索和 AI 驱动的答案生成。

所有基础设施使用 AWS CDK（TypeScript）定义，可通过 `npx cdk deploy --all` 一次性部署。

---

## 1. 聊天机器人应用 — Next.js RAG Chatbot on AWS Lambda

### 实现详情

使用 Next.js 15（App Router）构建的 RAG 聊天机器人应用通过 AWS Lambda Web Adapter 实现无服务器执行。

### 架构

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js (standalone)
```

### 技术栈

| 层 | 技术 |
|-------|-----------|
| 框架 | Next.js 15（App Router，standalone 输出） |
| UI | React 18 + Tailwind CSS |
| 认证 | Amazon Cognito（JWT） |
| AI/RAG | Amazon Bedrock Knowledge Base Retrieve API + Converse API |
| 运行时 | Lambda Web Adapter（Rust）+ Docker 容器 |
| CDN | Amazon CloudFront |

### 主要功能

- **RAG 搜索**：通过 Bedrock Knowledge Base 执行向量搜索，生成引用相关文档的答案
- **SID 过滤**：基于用户 SID 信息过滤搜索结果（详见第 7 节）
- **KB/Agent 模式切换**：通过头部切换在 KB 模式（文档搜索）和 Agent 模式（多步推理）之间切换
- **基于卡片的任务导向 UI**：在开始聊天前，KB 模式显示用途特定的卡片（文档搜索、摘要创建、测验生成等），Agent 模式显示工作流卡片（财务分析、项目管理等）的网格布局。支持收藏管理和类别过滤
- **Agent 模式（InvokeAgent API）**：通过 Bedrock Agent + Permission-aware Action Group 实现带 SID 过滤的多步推理。Agent 调用失败时回退到 KB 混合模式
- **多语言支持**：8 种语言 — 日语、英语、韩语、中文（简体/繁体）、法语、德语和西班牙语
- **Citation 显示**：显示作为答案依据的文档来源信息
- **Cognito 认证**：登录/退出和会话管理

### CDK 堆栈

`DemoWebAppStack`（`lib/stacks/demo/demo-webapp-stack.ts`）创建以下资源：
- Lambda DockerImageFunction（ECR 镜像，1024MB 内存，30 秒超时）
- Lambda Function URL（IAM 认证）
- CloudFront Distribution（OAC + 地理限制 + WAF 集成）
- CloudFront 访问日志的 S3 存储桶

---

## 2. AWS WAF — 通过 IP 和地理信息进行防护

### 实现详情

为 CloudFront 部署在 `us-east-1` 的 WAFv2 WebACL，通过多个安全规则保护应用。

### WAF 规则配置（按优先级）

| 优先级 | 规则名称 | 类型 | 说明 |
|----------|-----------|------|-------------|
| 100 | RateLimit | 自定义 | 5 分钟内每个 IP 超过 3,000 个请求时阻止 |
| 200 | AWSIPReputationList | AWS 托管 | 阻止来自僵尸网络、DDoS 源等的恶意 IP |
| 300 | AWSCommonRuleSet | AWS 托管 | OWASP Top 10 合规（XSS、LFI、RFI 等）。为 RAG 兼容性排除了部分规则 |
| 400 | AWSKnownBadInputs | AWS 托管 | 阻止利用已知漏洞（如 Log4j）的请求 |
| 500 | AWSSQLiRuleSet | AWS 托管 | 检测并阻止 SQL 注入攻击模式 |
| 600 | IPAllowList | 自定义（可选） | 仅在配置 `allowedIps` 时激活。阻止不在列表中的 IP |

### 地理限制

在 CloudFront 级别应用地理访问限制（默认：仅日本）。

### CDK 堆栈

`DemoWafStack`（`lib/stacks/demo/demo-waf-stack.ts`）创建以下资源：
- WAFv2 WebACL（CLOUDFRONT 范围，`us-east-1`）
- IP Set（配置 `allowedIps` 时）

### 配置

通过 `cdk.context.json` 控制：
```json
{
  "allowedIps": ["203.0.113.0/24"],
  "allowedCountries": ["JP", "US"]
}
```

---

## 3. IAM 认证 — Lambda Function URL IAM Auth + CloudFront OAC

### 实现详情

在 Lambda Function URL 上配置 IAM 认证（`AWS_IAM`），CloudFront Origin Access Control（OAC）通过 SigV4 签名提供源访问控制。

### 认证流程

```
Browser
  │
  ▼
CloudFront (OAC: 自动添加 SigV4 签名)
  │
  ▼
Lambda Function URL (AuthType: AWS_IAM)
  │ → 验证 SigV4 签名
  │ → 仅允许来自 CloudFront 的请求
  ▼
Next.js Application
  │
  ▼
Cognito JWT 验证（应用级认证）
```

### 安全层

| 层 | 技术 | 目的 |
|-------|-----------|---------|
| L1: 网络 | CloudFront 地理限制 | 地理访问限制 |
| L2: WAF | AWS WAF | 攻击模式检测和阻止 |
| L3: 源认证 | OAC（SigV4） | 防止绕过 CloudFront 的直接访问 |
| L4: API 认证 | Lambda Function URL IAM Auth | 通过 IAM 认证进行访问控制 |
| L5: 用户认证 | Cognito JWT | 用户级认证和授权 |
| L6: 数据授权 | SID 过滤 | 文档级访问控制 |

### CDK 实现

在 `DemoWebAppStack` 中：
- 使用 `lambda.FunctionUrlAuthType.AWS_IAM` 创建 Function URL
- 使用 `cloudfront.CfnOriginAccessControl` 创建 OAC（`signingBehavior: 'always'`）
- 使用 L1 escape hatch 将 OAC 关联到 Distribution

### 部署后注意事项

上述 IAM 认证 + OAC 配置推荐用于生产环境。但是，如果在验证环境中出现 POST 请求（聊天等）的兼容性问题，可能需要以下手动调整：
- 将 Lambda Function URL AuthType 更改为 `NONE`
- 移除 CloudFront OAC 关联

---

## 4. 向量数据库 — S3 Vectors / Amazon OpenSearch Serverless

### 实现详情

用于 RAG 搜索的向量数据库可通过 CDK context 参数 `vectorStoreType` 选择：
- **S3 Vectors**（默认）：低成本，亚秒级延迟。直接用作 Bedrock KB 的向量存储
- **Amazon OpenSearch Serverless（AOSS）**：高性能（约 10ms），高成本（约 $700/月）

### 设计决策

选择 S3 Vectors 作为默认的原因：
- 成本为每月几美元（小规模），与 OpenSearch Serverless 的约 $700/月相比显著降低
- 作为 Bedrock KB 的向量存储原生支持
- 支持元数据过滤（`$eq`、`$in`、`$and`、`$or`）
- 需要高性能时可从 S3 Vectors 一键导出到 AOSS

选择 AOSS 时的对比：

| 方面 | S3 Vectors | AOSS | Aurora Serverless v2 (pgvector) |
|--------|-----------|------|------|
| Bedrock KB 集成 | 原生支持 | 原生支持 | 需要自定义集成 |
| 成本 | 几美元/月（按使用量付费） | 约 $700/月（最少 2 个 OCU） | 取决于实例成本 |
| 延迟 | 亚秒级到 100ms | 约 10ms | 约 10ms |
| 元数据搜索 | 支持过滤运算符 | 存储在文本字段中 | 通过 SQL 查询灵活搜索 |
| 运维开销 | 无服务器（自动扩展） | 需要容量管理 |
| 成本 | 基于搜索量按使用量付费 | 适用最低 ACU 费用 |
| 元数据搜索 | 存储在文本字段中 | 通过 SQL 查询灵活搜索 |

### 向量存储配置

S3 Vectors 配置（默认）：
- S3 Vectors 向量存储桶 + 向量索引（1024 维，cosine）
- 通过自定义资源 Lambda 创建（CloudFormation 不支持）

AOSS 配置（`vectorStoreType=opensearch-serverless`）：

| 资源 | 说明 |
|----------|-------------|
| Collection | `VECTORSEARCH` 类型，加密策略（AWS 拥有的密钥） |
| Network Policy | 公共访问（用于从 Bedrock KB API 访问） |
| Data Access Policy | KB IAM 角色 + 索引创建 Lambda + Embedding EC2 角色 |
| Index | `bedrock-knowledge-base-default-index`（knn_vector 1024 维，HNSW/faiss/l2） |

### 索引映射

```json
{
  "bedrock-knowledge-base-default-vector": { "type": "knn_vector", "dimension": 1024 },
  "AMAZON_BEDROCK_TEXT_CHUNK": { "type": "text" },
  "AMAZON_BEDROCK_METADATA": { "type": "text", "index": false }
}
```

### CDK 堆栈

`DemoAIStack`（`lib/stacks/demo/demo-ai-stack.ts`）创建以下资源：
- `vectorStoreType=s3vectors`：S3 Vectors 向量存储桶 + 索引（自定义资源 Lambda）
- `vectorStoreType=opensearch-serverless`：OpenSearch Serverless 集合 + 安全策略（加密、网络、数据访问）
- 自动索引创建的自定义资源 Lambda
- Bedrock Knowledge Base + S3 数据源

---

## 5. Embedding 服务器 — FSx ONTAP CIFS 挂载 + 向量数据库写入

### 实现详情

在通过 CIFS/SMB 挂载 Amazon FSx for NetApp ONTAP 卷的 EC2 实例上，Docker 容器读取文档、向量化并索引到 OpenSearch Serverless（AOSS）。S3 Vectors 配置下不使用（仅 AOSS 配置）。

### 数据摄取路径概述

| 路径 | 方法 | CDK 激活方式 | 状态 |
|------|--------|---------------|--------|
| 选项 A（默认） | S3 存储桶 → Bedrock KB S3 数据源 | 始终启用 | ✅ |
| 选项 B（可选） | Embedding 服务器（CIFS 挂载）→ 直接向量存储写入 | `-c enableEmbeddingServer=true` | ✅（仅 AOSS 配置） |
| 选项 C（可选） | S3 Access Point → Bedrock KB | 部署后手动设置 | ✅ SnapMirror 支持，FlexCache 即将支持 |

> **关于 S3 Access Point**：StorageStack 自动为 FSx ONTAP 卷创建 S3 Access Point。根据卷的安全样式（NTFS/UNIX）和 AD 加入状态，将创建 WINDOWS 或 UNIX 用户类型的 S3 AP。可通过 CDK 上下文参数 `volumeSecurityStyle`、`s3apUserType`、`s3apUserName` 进行显式控制。

#### S3 Access Point 用户类型设计

| 模式 | 用户类型 | 用户来源 | 卷 Style | 条件 |
|------|---------|---------|---------|------|
| A | WINDOWS | 现有 AD 用户（Admin） | NTFS/UNIX | 已加入 AD 的 SVM（推荐：NTFS 环境） |
| B | WINDOWS | 新建专用 AD 用户 | NTFS/UNIX | 已加入 AD 的 SVM + 最小权限 |
| C | UNIX | 现有 UNIX 用户（root） | UNIX | 未加入 AD（推荐：UNIX 环境） |
| D | UNIX | 新建专用 UNIX 用户 | UNIX | 未加入 AD + 最小权限 |

SID 过滤在所有模式中使用相同逻辑（基于 `.metadata.json` 元数据），不依赖于卷的安全样式或 S3 AP 用户类型。

### 处理流程

1. 递归扫描 CIFS 挂载的目录（`.md`、`.txt`、`.html` 等文本文件）
2. 从每个文档的 `.metadata.json` 读取 SID 信息（`allowed_group_sids`）
   - 如果 `.metadata.json` 不存在且 `ENV_AUTO_METADATA=true`，则通过 ONTAP REST API（`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`）自动获取 ACL，提取 SID 并自动生成 `.metadata.json`
3. 将文本分割为 1,000 字符的块（200 字符重叠）
4. 使用 Amazon Bedrock Titan Embed Text v2 生成 1024 维向量
5. 以 Bedrock KB 兼容格式索引到 AOSS（`AMAZON_BEDROCK_TEXT_CHUNK` + `AMAZON_BEDROCK_METADATA`）
6. 在 `processed.json` 中记录已处理的文件（支持增量处理）

### 执行模式

| 模式 | 说明 | 配置 |
|------|-------------|---------------|
| 批处理模式 | 处理所有文件一次后退出 | `ENV_WATCH_MODE=false`（默认） |
| 监视模式 | 检测文件变更并自动处理 | `ENV_WATCH_MODE=true` |

在监视模式下，使用 `chokidar` 库实时检测文件系统变更（添加/更新）并自动执行向量化和索引。对于定时执行，也可以通过 EventBridge Scheduler 或 cron 定期启动批处理模式容器。

---

## 6. Amazon Titan Text Embeddings — 向量化模型

### 实现详情

使用 `amazon.titan-embed-text-v2:0` 进行文档向量化。

### 模型规格

| 项目 | 值 |
|------|-------|
| 模型 ID | `amazon.titan-embed-text-v2:0` |
| 向量维度 | 1024 |
| 最大输入长度 | 8,000 字符 |
| 归一化 | 启用（`normalize: true`） |

### 使用场景

| 组件 | 用途 |
|-----------|---------|
| Bedrock Knowledge Base | 从 S3 数据源摄取文档时的向量化 |
| Embedding 服务器 | CIFS 挂载文档的向量化（`docker/embed/src/index.ts`） |

---

## 7. SID 元数据 + 权限过滤

### 实现详情

在向量化文档时，基于文件 NTFS ACL 的 SID（安全标识符）信息作为元数据附加在 `.metadata.json` 文件中。在聊天界面中，将登录用户的 SID 与每个文档的 SID 进行比较，仅将 SID 匹配的文档包含在搜索结果中。

### 什么是 SID？

SID（安全标识符）是 Windows/NTFS 中安全主体（用户、组）的唯一标识符。

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
```

| SID | 名称 | 说明 |
|-----|------|-------------|
| `S-1-1-0` | Everyone | 所有用户 |
| `S-1-5-21-...-512` | Domain Admins | 域管理员组 |
| `S-1-5-21-...-1001` | User | 普通用户 |

### 文档到 SID 的映射

| 目录 | 访问级别 | allowed_group_sids | 管理员 | 普通用户 |
|-----------|-------------|-------------------|-------|-------------|
| `public/` | 公开 | `S-1-1-0`（Everyone） | ✅ 允许 | ✅ 允许 |
| `confidential/` | 机密 | `...-512`（Domain Admins） | ✅ 允许 | ❌ 拒绝 |
| `restricted/` | 受限 | `...-1100`（Engineering）+ `...-512`（DA） | ✅ 允许 | ❌ 拒绝 |

### 过滤处理流程（两阶段方法）

使用 Retrieve API 的原因：RetrieveAndGenerate API 不返回 Citation 元数据（`allowed_group_sids`），因此 SID 过滤无法工作。Retrieve API 正确返回元数据，因此采用两阶段方法（Retrieve → SID 过滤 → Converse）。

### Fail-Closed 回退

权限检查失败时，拒绝所有文档的访问。

| 情况 | 行为 |
|-----------|----------|
| DynamoDB 连接错误 | 拒绝所有文档 |
| 无用户 SID 记录 | 拒绝所有文档 |
| 元数据中无 SID 信息 | 拒绝对应文档 |
| SID 不匹配 | 拒绝对应文档 |
| SID 匹配 | 允许对应文档 |

### 实现文件

| 文件 | 角色 |
|------|------|
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | KB 搜索 API + SID 过滤集成（Lambda/内联切换支持） |
| `lambda/permissions/metadata-filter-handler.ts` | 基于元数据的权限过滤 Lambda（通过 `-c usePermissionFilterLambda=true` 启用） |
| `lambda/permissions/permission-filter-handler.ts` | 基于 ACL 的权限过滤 Lambda（用于未来扩展） |
| `lambda/permissions/permission-calculator.ts` | SID/ACL 匹配逻辑 |
| `demo-data/scripts/setup-user-access.sh` | 用户 SID 数据注册脚本 |
| `demo-data/documents/**/*.metadata.json` | 文档 SID 元数据 |

---

## 8. Bedrock Agent — 权限感知 Agentic AI

### 实现详情

使用 Bedrock Agent 实现多步推理 AI 代理。Agent 通过 Permission-aware Action Group 执行 KB 搜索，仅引用基于用户 SID 权限过滤后的文档生成答案。

### CDK 资源（`enableAgent=true`）

| 资源 | 说明 |
|----------|-------------|
| Bedrock Agent | Claude 3 Haiku，不直接关联 KB（仅通过 Action Group） |
| Agent Alias | 用于稳定调用的别名 |
| Action Group Lambda | 权限感知 KB 搜索（带 SID 过滤） |
| Agent IAM Role | Bedrock InvokeModel + KB Retrieve 权限 |

### 基于卡片的任务导向 UI

在开始聊天前显示模式特定的卡片网格。配置为 KB 模式 8 张卡片 + Agent 模式 14 张卡片（8 张研究 + 6 张输出），支持一键提示词输入。支持收藏管理和类别过滤。

### 动态 Agent-卡片绑定

点击卡片时，引用 AGENT_CATEGORY_MAP（10 个类别：financial、project、hr、search、presentation、approval、minutes、report、contract、onboarding）查找或动态创建对应的 Agent 并绑定到卡片。创建的 Agent 自动附加 Permission-aware Action Group。

---

## 9. 图像分析 RAG — Bedrock Vision API 集成

### 实现详情

在聊天输入中添加图像上传功能，使用 Bedrock Converse API 的多模态能力（Vision API）分析图像并将结果集成到 KB 搜索上下文中。

### 处理流程

```
用户 → 拖放图像或文件选择器
  → 验证（格式：JPEG/PNG/GIF/WebP，大小：≤3MB）
  → Base64 编码 → API 提交
  → Vision API（Claude 3 Haiku）图像分析
  → 分析结果 + 用户查询 → KB Retrieve API
  → SID 过滤 → 答案生成
```

---

## 10. Knowledge Base 连接 UI — Agent × KB 管理

### 实现详情

在 Agent Directory（`/genai/agents`）中创建或编辑 Agent 时，提供选择、连接和断开 Bedrock Knowledge Base 的 UI。

### API 扩展

在现有 `/api/bedrock/agent` 中添加 3 个操作（不更改现有操作）：

| 操作 | 说明 |
|--------|-------------|
| `associateKnowledgeBase` | 将 KB 连接到 Agent → PrepareAgent |
| `disassociateKnowledgeBase` | 从 Agent 断开 KB → PrepareAgent |
| `listAgentKnowledgeBases` | 获取连接到 Agent 的 KB 列表 |

---

## 11. Smart Routing — 成本优化模型选择

### 实现详情

根据查询复杂度自动路由。短的事实查询路由到轻量模型（Haiku），长的分析查询路由到高性能模型（Sonnet）。

### 分类算法（ComplexityClassifier）

| 特征 | 简单侧 | 复杂侧 |
|------|---------|---------|
| 字符数 | ≤100 字符（+0.3） | >100 字符（+0.3） |
| 句子数 | 1 句（+0.2） | 多句（+0.2） |
| 分析关键词 | 无 | 有（+0.3）（比較/分析/要約/explain/compare/analyze/summarize） |
| 多个问题 | 无 | 2 个或更多问号（+0.2） |

分数 < 0.5 → 简单，≥ 0.5 → 复杂。置信度 = |分数 - 0.5| × 2。

### 默认设置

- Smart Routing：默认关闭（不影响现有行为）
- 轻量模型：`anthropic.claude-haiku-4-5-20251001-v1:0`
- 高性能模型：`anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## 12. 监控与告警 — CloudWatch Dashboard + SNS Alerts + EventBridge

### 实现详情

通过 `enableMonitoring=true` 启用的可选功能，提供 CloudWatch 仪表板、SNS 告警和 EventBridge 集成。可在单个仪表板中查看整个系统状态，异常发生时发送邮件通知。

### 成本

| 资源 | 月费用 |
|--------|----------|
| CloudWatch Dashboard | $3.00 |
| CloudWatch Alarms（7 个） | $0.70 |
| SNS Email 通知 | 免费层内 |
| EventBridge Rule | 免费层内 |
| **合计** | **约 $4/月** |

---

## 13. AgentCore Memory — 对话上下文保持

### 实现详情

通过 `enableAgentCoreMemory=true` 启用的可选功能，通过 Bedrock AgentCore Memory 提供短期记忆（会话内对话历史）和长期记忆（跨会话用户偏好、摘要、语义知识）。

### 主要功能

- 会话内对话历史自动保存（短期记忆，TTL 3 天，最小值）
- 跨会话用户偏好和知识自动提取（semantic strategy）
- 会话对话摘要自动生成（summary strategy）
- 侧边栏显示会话列表和记忆部分
- KB 模式和 Agent 模式均支持对话上下文保持
- 8 种语言 i18n 支持（`agentcore.memory.*`、`agentcore.session.*`）

---

## 整体系统架构

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + S3 Vectors /   │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   OpenSearch SL  │ │ (SID data)   │   │ (Perm Cache) │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                     ┌────────────────┐     ┌──────────────────┐
                     │ S3 Bucket      │     │ FSx for ONTAP    │
                     │ (Metadata Sync)│     │ (SVM + Volume)   │
                     └────────────────┘     └────────┬─────────┘
                                                     │ CIFS/SMB
                                                     ▼
                                            ┌──────────────────┐
                                            │ Embedding EC2    │
                                            │ (Titan Embed v2) │
                                            └──────────────────┘
```

### CDK 堆栈结构（7 个堆栈）

| # | 堆栈 | 区域 | 主要资源 |
|---|------|------|-----------|
| 1 | WafStack | us-east-1 | WAF WebACL、IP Set |
| 2 | NetworkingStack | ap-northeast-1 | VPC、子网、安全组、VPC Endpoints（可选） |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool、Client、SAML IdP + Cognito Domain（AD Federation 启用时）、AD Sync Lambda（可选） |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume、S3、DynamoDB×2、AD、KMS 加密（可选）、CloudTrail（可选） |
| 5 | AIStack | ap-northeast-1 | Bedrock KB、S3 Vectors / OpenSearch Serverless（通过 `vectorStoreType` 选择）、Bedrock Guardrails（可选） |
| 6 | WebAppStack | ap-northeast-1 | Lambda（Docker）、CloudFront、Permission Filter Lambda（可选）、MonitoringConstruct（可选） |
| 7 | EmbeddingStack（可选） | ap-northeast-1 | EC2、ECR、ONTAP ACL 自动获取（可选） |
