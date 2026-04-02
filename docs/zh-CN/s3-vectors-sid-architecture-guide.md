# S3 Vectors + SID 过滤架构指南

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | [English](../en/s3-vectors-sid-architecture-guide.md) | [한국어](../ko/s3-vectors-sid-architecture-guide.md) | **简体中文** | [繁體中文](../zh-TW/s3-vectors-sid-architecture-guide.md) | [Français](../fr/s3-vectors-sid-architecture-guide.md) | [Deutsch](../de/s3-vectors-sid-architecture-guide.md) | [Español](../es/s3-vectors-sid-architecture-guide.md)

**创建日期**: 2026-03-29
**验证环境**: ap-northeast-1（东京）
**状态**: CDK 部署已验证，SID 过滤已验证

---

## 概述

本文档总结了在权限感知 RAG 系统中采用 Amazon S3 Vectors 作为向量存储的架构决策，以及基于 SID 的访问控制集成模式。包含针对专家反馈的验证结果和建议。

---

## SID 过滤模式评估

### 本系统的当前方法

本系统使用 Bedrock KB Retrieve API 执行向量搜索，并在应用程序端匹配返回元数据中的 `allowed_group_sids` 字段。此方法与向量存储无关。

```
Bedrock KB Retrieve API → 搜索结果 + 元数据（allowed_group_sids）
→ 应用程序端匹配：用户 SID ∩ 文档 SID
→ 仅使用匹配的文档调用 Converse API
```

### 模式 A：将 SID 附加为可过滤元数据（推荐模式）

由于 S3 Vectors 中的所有元数据默认可过滤，`allowed_group_sids` 无需额外配置即可过滤。

#### 在本系统中的应用

由于本系统通过 Bedrock KB 访问 S3 Vectors，因此无法直接控制 `QueryVectors` 过滤参数。Bedrock KB Retrieve API 执行向量搜索并返回包含元数据的结果。SID 过滤在应用程序端执行。

此方法的优势：
- Bedrock KB Retrieve API 与向量存储无关，因此相同的应用程序代码可同时适用于 S3 Vectors 和 AOSS
- `.metadata.json` 中的 `allowed_group_sids` 作为元数据原样存储和返回
- 应用程序端的 SID 过滤逻辑（`route.ts`）无需更改

#### 对专家反馈的回应

> 请通过测试确保应用程序始终应用 SID 过滤。S3 Vectors 元数据过滤很方便，但它不能替代访问控制本身。

本系统通过以下方式确保这一点：
1. SID 过滤内置于 KB Retrieve API 路由（`route.ts`）中，无法绕过
2. 如果无法从 DynamoDB 获取 SID 信息，则拒绝所有文档（Fail-Closed 原则）
3. 基于属性的测试（属性 5）已验证 SID 过滤的向量存储独立性

### 模式 B：按 SID/租户分离索引

#### 对本系统的评估

本系统中的 SID 是基于 Active Directory NTFS ACL 的组 SID，每个文档分配多个 SID（例如 `["S-1-5-21-...-512", "S-1-1-0"]`）。按 SID 分离索引不适合，原因如下：

1. **多对多 SID 关系**：单个文档属于多个 SID 组，单个用户拥有多个 SID。索引分离需要重复存储文档
2. **动态 SID 数量变化**：随着 AD 组的添加或修改，SID 数量会波动。索引管理变得复杂
3. **10,000 索引/存储桶限制**：在大规模 AD 环境中，SID 数量可能接近此限制

#### 混合设计考量

正如专家指出的，按租户/客户分离索引并在每个索引内使用 SID 过滤的混合设计是有效的。由于本系统假设单租户（单 AD 环境），目前不需要索引分离。扩展到多租户时将予以考虑。

---

## 迁移检查清单验证结果

### 1. Embedding 模型/维度/度量验证

| 项目 | 当前（AOSS） | S3 Vectors | 兼容性 |
|------|----------------|-----------|---------------|
| Embedding 模型 | Amazon Titan Embed Text v2 | 相同 | ✅ |
| 维度 | 1024 | 1024 | ✅ |
| 距离度量 | l2（AOSS/faiss） | cosine（S3 Vectors） | ⚠️ 需要验证 |
| 数据类型 | - | float32（必需） | ✅ |

> **注意**：当前 AOSS 使用 l2（欧几里得距离），而 S3 Vectors 使用 cosine。由于 Bedrock KB 管理 embedding 和度量之间的一致性，通过 KB 访问时没有问题。但是，直接使用 S3 Vectors API 时请注意度量差异。S3 Vectors 不允许在索引创建后更改维度和度量。

### 2. 元数据设计

| 元数据键 | 用途 | 可过滤 | 备注 |
|-------------|---------|-----------|-------|
| `allowed_group_sids` | SID 过滤 | 建议 non-filterable | 由于通过 Bedrock KB Retrieve API 进行应用程序端过滤，不需要 S3 Vectors 过滤 |
| `access_level` | 访问级别显示 | 建议 non-filterable | 用于 UI 显示 |
| `doc_type` | 文档类型 | 建议 non-filterable | 用于未来过滤 |
| `source_uri` | 源文件路径 | non-filterable | 不可搜索，仅供参考 |
| `chunk_text` | 块文本 | non-filterable | 不可搜索，大数据 |

#### S3 Vectors 元数据约束（验证中发现的实际值）

| 约束 | 标称值 | 使用 Bedrock KB 时的有效值 | 缓解措施 |
|-----------|---------------|-------------------------------|------------|
| 可过滤元数据 | 2KB/向量 | **自定义元数据最多 1KB**（剩余 1KB 被 Bedrock KB 内部元数据消耗） | 最小化自定义元数据 |
| Non-filterable 元数据键 | 最多 10 个键/索引 | 10 个键（5 个 Bedrock KB 自动键 + 5 个自定义键） | 优先将 Bedrock KB 自动键设为 non-filterable |
| 总元数据键 | 最多 50 个键/向量 | 35 个键（使用 Bedrock KB 时） | 无问题 |

#### Bedrock KB 自动添加的元数据键

以下键由 Bedrock KB 自动存储在 S3 Vectors 中。如果未包含在 `nonFilterableMetadataKeys` 中，它们将被视为可过滤并消耗 2KB 限制。

| 键 | 说明 | 建议 non-filterable |
|-----|-------------|---------------------------|
| `x-amz-bedrock-kb-source-file-modality` | 文件类型（TEXT 等） | ✅ |
| `x-amz-bedrock-kb-chunk-id` | 块 ID（UUID） | ✅ |
| `x-amz-bedrock-kb-data-source-id` | 数据源 ID | ✅ |
| `x-amz-bedrock-kb-source-uri` | 源 URI | ✅ |
| `x-amz-bedrock-kb-document-page-number` | PDF 页码 | ✅ |

> **重要**：由于 PDF 页码元数据等原因，可过滤元数据可能超过 2KB。将所有 Bedrock KB 自动键包含在 `nonFilterableMetadataKeys` 中，并尽可能将自定义元数据设为 non-filterable。

### 3. 权限不足的预验证

通过验证确认的必需 IAM 操作：

```
KB Role（用于 Bedrock KB）：
  s3vectors:QueryVectors   ← 搜索所需
  s3vectors:PutVectors     ← 数据同步所需
  s3vectors:DeleteVectors  ← 数据同步所需
  s3vectors:GetVectors     ← 元数据获取所需（如专家所指出）
  s3vectors:ListVectors    ← 验证中发现为必需

Custom Resource Lambda（用于资源管理）：
  s3vectors:CreateVectorBucket
  s3vectors:DeleteVectorBucket
  s3vectors:CreateIndex
  s3vectors:DeleteIndex
  s3vectors:ListVectorBuckets
  s3vectors:GetVectorBucket
  s3vectors:ListIndexes
  s3vectors:GetIndex
```

> **验证中发现**：KB Role 不仅需要 `s3vectors:GetVectors`，还需要 `s3vectors:ListVectors`。缺少它会导致 403 错误。

### 4. 性能验证

> **状态**：CDK 部署验证完成。Retrieve API 延迟验证完成。

S3 Vectors 标称性能：
- 冷查询：亚秒级（1 秒内）
- 热查询：约 100ms 或更低
- 高频查询：延迟降低

Retrieve API 验证结果（2 个文档，ap-northeast-1）：
- 确认 Bedrock KB Retrieve API 正确返回 SID 元数据（`allowed_group_sids`）
- 公开文档：`allowed_group_sids: ["S-1-1-0"]`（Everyone SID）
- 机密文档：`allowed_group_sids: ["S-1-5-21-...-512"]`（Domain Admins SID）
- `access_level` 和 `doc_type` 等自定义元数据也正确返回
- 现有 SID 过滤逻辑（`route.ts`）无需修改即可工作

### 5. 分阶段迁移设计

本系统通过 CDK context 参数 `vectorStoreType` 的切换支持分阶段迁移：

1. **阶段 1**：使用 `vectorStoreType=s3vectors` 进行新部署（验证环境） ← 当前阶段
2. **阶段 2**：数据源添加/同步，通过 Retrieve API 验证 SID 元数据获取
3. **阶段 3**：性能验证（延迟、并发）
4. **阶段 4**：生产环境采用决策

从 AOSS 到 S3 Vectors 的迁移可通过重新同步 Bedrock KB 数据源实现（向量数据由 KB 自动生成，因此无需手动迁移）。

---

## CDK 部署验证结果

### 验证环境

- 区域：ap-northeast-1（东京）
- 堆栈名称：s3v-test-val-AI（独立验证）、perm-rag-demo-demo-*（全堆栈验证）
- vectorStoreType：s3vectors
- 部署时间：AI 堆栈独立约 83 秒，全堆栈（6 个堆栈）约 30 分钟

### 全堆栈 E2E 验证结果（2026-03-30）

使用所有 6 个堆栈（Networking、Security、Storage、AI、WebApp + WAF）部署的 S3 Vectors 配置进行了 E2E 验证。

#### SID 过滤操作验证

| 用户 | SID | 问题 | 引用的文档 | 结果 |
|------|-----|----------|---------------------|--------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "告诉我公司的销售额" | confidential/financial-report.txt + public/product-catalog.txt（2 个文档） | ✅ 响应包含 150 亿日元销售信息 |
| user@example.com | 普通用户 (-1001) + Everyone (S-1-1-0) | "告诉我公司的销售额" | public/product-catalog.txt（仅 1 个文档） | ✅ 无销售信息（机密文档正确排除） |

#### Agent 模式验证（admin@example.com）

| 测试 | 问题 | 结果 |
|------|----------|--------|
| 通过 Agent Action Group 的 KB 搜索 | "告诉我公司的销售额" | ✅ 响应包含 150 亿日元销售信息。Agent 通过 Permission-aware Search Action Group 调用 Retrieve API 并从 SID 过滤结果生成响应 |

Agent 模式经验教训：
- Bedrock Agent Action Group 使用 Bedrock KB Retrieve API，因此与向量存储类型（S3 Vectors / AOSS）无关
- 通过 CDK 创建的 Agent（`enableAgent=true`）在 S3 Vectors 配置下也能以 PREPARED 状态正常运行
- 通过 Agent 的 SID 过滤使用与 KB 模式相同的逻辑（`route.ts` 混合方法）

#### 验证中发现的额外经验教训

| # | 经验教训 | 影响 |
|---|--------|--------|
| 1 | 应用程序发送邮箱地址作为 userId 而非 Cognito sub | DynamoDB 键需要使用邮箱地址注册 |
| 2 | SVM AD 加入需要在 VPC 安全组中开放 AD 端口 | 需要在 FSx SG 中添加端口 636、135、464、3268-3269、1024-65535。需要在 CDK NetworkingStack 中更新 |
| 3 | 缺少 `@aws-sdk/client-scheduler` 依赖 | 由其他线程的功能添加引起。通过添加到 package.json 解决 |
| 4 | SVM AD 加入需要指定 OU | 对于 AWS Managed AD，`OrganizationalUnitDistinguishedName` 必须指定 `OU=Computers,OU=<ShortName>,DC=<domain>,DC=<tld>` |
| 5 | FSx ONTAP S3 AP 访问需要存储桶策略配置 | SSO 假设角色默认无法访问 S3 AP。需要 S3 AP 策略（`s3:*`）+ IAM 基于身份的策略（S3 AP ARN 模式）。此外，卷上必须存在文件且 NTFS ACL 必须允许访问（双层授权） |
| 6 | FSx ONTAP S3 AP 使用双层授权模型 | 需要 IAM 认证（S3 AP 策略 + 基于身份的策略）和文件系统认证（NTFS ACL）。当卷为空或未创建 CIFS 共享时也会出现 AccessDenied |
| 7 | FSx ONTAP 管理员密码与 CDK AD 密码分开 | FSx ONTAP `fsxadmin` 密码在文件系统创建时自动生成。通过 ONTAP REST API 创建 CIFS 共享需要此密码。可在 CDK 中设置 `FsxAdminPassword` 或稍后使用 `update-file-system` 设置 |
| 8 | FSx ONTAP S3 AP AccessDenied 问题 | **根本原因已确定：Organization SCP**。S3 AP 访问在旧账户（无 Organization SCP 限制）中成功。在新账户（有 Organization SCP 限制）中出现 AccessDenied。需要在 Organization 管理账户中修改 SCP |
| 9 | S3 Vectors 可过滤元数据 2KB 限制 | 使用 Bedrock KB + S3 Vectors 时，自定义元数据限制为 **1KB**（不是独立 S3 Vectors 的 2KB，因为 Bedrock KB 内部元数据消耗了剩余的 1KB）。此外，Bedrock KB 自动添加的元数据键（`x-amz-bedrock-kb-chunk-id`、`x-amz-bedrock-kb-data-source-id`、`x-amz-bedrock-kb-source-file-modality`、`x-amz-bedrock-kb-document-page-number` 等）被视为可过滤，PDF 页码元数据可能超过 2KB 限制。即使在 `nonFilterableMetadataKeys`（最多 10 个键）中指定所有元数据键，当 Bedrock KB 自动添加的键较多时也可能不够。**缓解措施**：(1) 最小化元数据键（仅 `sids`，短值），(2) 使用不带元数据的 PDF 文件，(3) S3 存储桶备用路径在新账户中验证无问题（AOSS 配置无 2KB 限制） |

#### FSx ONTAP S3 AP 路径验证状态

| 步骤 | 状态 | 备注 |
|------|--------|-------|
| SVM AD 加入 | ✅ 完成 | 通过指定 OU + 添加 SG 端口解决 |
| CIFS 共享创建 | ✅ 完成 | 通过 ONTAP REST API 创建 `data` 共享 |
| 通过 SMB 放置文件 | ✅ 完成 | 使用 `demo.local\Admin` 在 public/confidential 中放置文件 |
| S3 AP 创建 | ✅ AVAILABLE | 使用 WINDOWS 用户类型、已加入 AD 的 SVM 创建 |
| 通过 S3 AP 访问 | ❌ AccessDenied（仅新账户） | **根本原因已确定：Organization SCP**。在旧账户（无 SCP 限制）中访问成功。需要在 Organization 管理账户中修改 SCP |
| KB 同步（通过 S3 AP） | ⚠️ 元数据 2KB 限制 | 通过 S3 AP 的 KB 同步本身成功，但 PDF 文件元数据可能超过 2KB 限制 |
| KB 同步（通过 S3 存储桶） | ✅ 完成 | 通过 S3 存储桶备用路径的带 SID 元数据文档 KB 同步成功 |
| cdk destroy | ✅ 完成 | S3 Vectors 自定义资源（存储桶 + 索引）正常删除。FSx 在现有 FSx 引用模式下保留（设计如此） |

> **替代路径**：通过 S3 存储桶备用路径（S3 存储桶 → KB 同步 → S3 Vectors → SID 过滤）的 E2E 验证已完成。由于 SID 过滤与向量存储和数据源类型无关，S3 存储桶路径的验证结果也适用于 S3 AP 路径。

### S3 Vectors → OpenSearch Serverless 导出验证结果

通过控制台一键导出验证，结果如下：

| 步骤 | 时长 | 结果 |
|------|----------|--------|
| AOSS 集合自动创建 | 约 5 分钟 | ACTIVE |
| OSI 管道自动创建 | 约 5 分钟 | ACTIVE → 数据传输开始 |
| 数据传输完成 | 约 5 分钟 | 管道自动 STOPPING |
| 总计 | 约 15 分钟 | 导出完成 |

导出期间自动创建的资源：
- AOSS 集合（`s3vectors-collection-<timestamp>`）
- OSI 管道（`s3vectors-pipeline<timestamp>`）
- IAM 服务角色（`S3VectorsOSIRole-<timestamp>`）
- DLQ S3 存储桶

导出经验教训：
- 控制台的"创建并使用新的服务角色"选项自动创建 IAM 角色。无需预先使用脚本创建角色
- OSI 管道在数据传输完成后自动停止（成本高效）
- 管道停止后 AOSS 集合仍可搜索
- AOSS 集合的最大 OCU 默认为 100（可在控制台中配置）
- 导出脚本（`export-to-opensearch.sh`）信任策略仅使用 `osis-pipelines.amazonaws.com`（`s3vectors.amazonaws.com` 在 IAM 中是无效的服务主体）

#### 导出控制台界面

![S3 Vectors → OpenSearch Serverless 导出配置界面](screenshots/s3vectors-export-to-opensearch.png)

控制台自动化以下操作：
- 创建 OpenSearch Serverless 向量集合（最大 OCU：100）
- 创建 IAM 服务角色（S3 Vectors 读取 + AOSS 写入）
- 创建 OpenSearch Ingestion 管道（包括 DLQ S3 存储桶）

### 创建的资源（示例）

| 资源 | ARN/ID 模式 |
|----------|---------------|
| Knowledge Base | `<KB_ID>` |
| Vector Bucket | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors` |
| Vector Index | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors/index/bedrock-knowledge-base-default-index` |

### 部署中发现并修复的问题

| # | 问题 | 原因 | 修复 |
|---|-------|-------|-----|
| 1 | SDK v3 响应中无 ARN | S3 Vectors API 规格 | 从模式构建 ARN |
| 2 | S3VectorsConfiguration 验证错误 | indexArn 和 indexName 互斥 | 仅使用 indexArn |
| 3 | KB 创建时 403 错误 | IAM 策略依赖 | 使用显式 ARN 模式 |
| 4 | DeleteIndexCommand 不是构造函数 | SDK API 命令名称差异 | 使用 CreateIndex/DeleteIndex |
| 5 | CloudFormation Hook | 组织级别 Hook | 使用 --method=direct |

---

## 相关文档

| 文档 | 内容 |
|----------|---------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 过滤设计详情 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3 种配置对比表和实施经验教训 |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | 技术设计文档 |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | 需求文档 |
