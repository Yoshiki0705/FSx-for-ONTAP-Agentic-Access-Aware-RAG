# CDK 堆栈架构指南

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | [English](../en/stack-architecture-comparison.md) | [한국어](../ko/stack-architecture-comparison.md) | **简体中文** | [繁體中文](../zh-TW/stack-architecture-comparison.md) | [Français](../fr/stack-architecture-comparison.md) | [Deutsch](../de/stack-architecture-comparison.md) | [Español](../es/stack-architecture-comparison.md)

**最后更新**: 2026-03-31  
**状态**: 已整合至 demo 堆栈体系，S3 Vectors 集成已验证

---

## 概述

所有 CDK 堆栈整合在 `lib/stacks/demo/` 下。唯一的入口点是 `bin/demo-app.ts`。可选功能可通过 CDK context 参数启用。

---

## 功能对比

| 功能 | Demo 堆栈（当前） | CDK Context | 备注 |
|---------|---------------------|-------------|-------|
| 认证 | Cognito + AD（可选） | `adPassword`, `adDomainName` | 未配置 AD 时仅使用 Cognito |
| 自动 SID 获取 | AD Sync Lambda | `adType=managed\|self-managed` | 未配置 AD 时手动执行（`setup-user-access.sh`） |
| NTFS ACL 获取 | 在 Embedding 服务器内自动生成 | `ontapMgmtIp`, `ontapSvmUuid` | 未配置时手动创建 `.metadata.json` |
| 权限过滤 | 在 Next.js API Route 内（默认） | `usePermissionFilterLambda=true` | 也可迁移到专用 Lambda |
| Bedrock Agent | 动态 Agent 创建 + Action Group | `enableAgent=true` | 点击卡片时自动创建对应类别的 Agent |
| Bedrock Guardrails | 内容安全 + PII 保护 | `enableGuardrails=true` | |
| KMS 加密 | S3 / DynamoDB CMK 加密 | `enableKmsEncryption=true` | 已启用密钥轮换 |
| CloudTrail | S3 数据访问 + Lambda 审计 | `enableCloudTrail=true` | 90 天保留 |
| VPC Endpoints | S3、DynamoDB、Bedrock 等 | `enableVpcEndpoints=true` | 支持 6 项服务 |
| Embedding 服务器 | FlexCache CIFS 挂载 + 直接向量存储写入 | `enableEmbeddingServer=true` | S3 AP 不可用时的备用路径（仅 AOSS 配置） |
| 高级权限控制 | 时间基础访问控制 + 权限判定审计日志 | `enableAdvancedPermissions=true` | `permission-audit` DynamoDB 表 + GSI |

---

## 数据摄取路径

| 路径 | 方法 | 激活方式 | 使用场景 |
|------|--------|------------|----------|
| 主路径 | FSx for ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 标准卷 |
| 备用路径 | 直接上传到 S3 存储桶 → Bedrock KB | `upload-demo-data.sh` | S3 AP 不可用时 |
| 替代路径 | CIFS 挂载 → Embedding 服务器 → 直接向量存储写入 | `enableEmbeddingServer=true` | FlexCache 卷（仅 AOSS 配置） |

---

## Bedrock KB Ingestion Job — 配额与设计考量

Bedrock KB Ingestion Job 是一项托管服务，负责文档检索、分块、向量化和存储。它通过 S3 Access Point 直接从 FSx for ONTAP 读取数据，并通过增量同步仅处理已更改的文件。无需自定义 Embedding 管道（如 AWS Batch）。

### 服务配额（截至 2026 年 3 月，均不可调整）

| 配额 | 值 | 设计影响 |
|-------|-------|---------------|
| 每个作业的数据大小 | 100GB | 超出的数据不会被处理。超过 100GB 的数据源必须拆分为多个数据源 |
| 每个文件的大小 | 50MB | 大型 PDF 需要拆分 |
| 每个作业添加/更新的文件数 | 5,000,000 | 对于典型企业文档量来说足够 |
| 每个作业删除的文件数 | 5,000,000 | 同上 |
| 使用 BDA 解析器时的文件数 | 1,000 | 使用 Bedrock Data Automation 解析器时的限制 |
| 使用 FM 解析器时的文件数 | 1,000 | 使用 Foundation Model 解析器时的限制 |
| 每个 KB 的数据源数 | 5 | 将多个卷注册为单独数据源时的上限 |
| 每个账户的 KB 数 | 100 | 多租户设计的考量 |
| 每个账户的并发作业数 | 5 | 多个 KB 并行同步的约束 |
| 每个 KB 的并发作业数 | 1 | 无法对同一 KB 进行并行同步。必须等待上一个作业完成 |
| 每个数据源的并发作业数 | 1 | 同上 |

### 执行触发器和频率约束

| 项目 | 值 | 备注 |
|------|-------|-------|
| StartIngestionJob API 速率 | 0.1 请求/秒（每 10 秒一次） | **不可调整**。不适合高频自动同步 |
| 执行触发器 | 手动（API/CLI/控制台） | Bedrock KB 端没有自动调度功能 |
| 同步方式 | 增量同步 | 仅处理新增、变更和删除。无需完全重新处理 |
| 同步时长 | 取决于数据量（数十秒到数小时） | 小规模（数十个文件）：30 秒–2 分钟，大规模：数小时 |

### 调度自动同步

由于 Bedrock KB 没有内置的定时同步功能，如需定期同步，请使用以下方法实现：

```bash
# Periodic execution with EventBridge Scheduler (e.g., every hour)
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

或者，您可以通过 S3 事件通知检测 FSx for ONTAP 上的文件变更并触发 Ingestion Job。但请注意 StartIngestionJob API 的速率限制（每 10 秒一次）。

### 设计建议

1. **同步频率**：无法实现实时同步。最小间隔为 10 秒；实际建议 15 分钟到 1 小时
2. **大规模数据**：超过 100GB 的数据源应拆分到多个 FSx for ONTAP 卷（= 多个 S3 AP = 多个数据源）
3. **并行处理**：无法对同一 KB 进行并行同步。多个数据源需顺序同步
4. **错误处理**：实现作业失败的重试逻辑（通过 `GetIngestionJob` 监控状态）
5. **无需自定义 Embedding 管道**：由于 Bedrock KB 管理分块、向量化和存储，因此不需要 AWS Batch 等自定义管道

---

## CDK 堆栈结构（7 个堆栈）

| # | 堆栈 | 必需/可选 | 说明 |
|---|-------|-------------------|-------------|
| 1 | WafStack | 必需 | CloudFront 的 WAF（us-east-1） |
| 2 | NetworkingStack | 必需 | VPC、子网、安全组 |
| 3 | SecurityStack | 必需 | Cognito User Pool |
| 4 | StorageStack | 必需 | FSx for ONTAP + SVM + Volume（或引用现有资源）、S3、DynamoDB×2 |
| 5 | AIStack | 必需 | Bedrock KB、S3 Vectors 或 OpenSearch Serverless、Agent（可选） |
| 6 | WebAppStack | 必需 | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | 可选 | FlexCache CIFS 挂载 + Embedding 服务器 |

### 现有 FSx for ONTAP 引用模式

StorageStack 可以通过 `existingFileSystemId`/`existingSvmId`/`existingVolumeId` 参数引用现有的 FSx for ONTAP 资源。在这种情况下：
- 跳过创建新的 FSx/SVM/Volume（减少 30-40 分钟的部署时间）
- 同时跳过 Managed AD 创建（使用现有环境的 AD 配置）
- S3 存储桶、DynamoDB 表和 S3 AP 自定义资源照常创建
- `cdk destroy` 不会删除 FSx/SVM/Volume（在 CDK 管理范围之外）

---

## 向量存储配置对比

向量存储配置可通过 CDK context 参数 `vectorStoreType` 切换。第三种配置（S3 Vectors + AOSS 导出）作为在 S3 Vectors 配置基础上按需导出的操作步骤提供。第四种配置（Managed KB）是 AWS 完全托管向量存储和数据管道的选项。

> **区域支持**：S3 Vectors 在 `ap-northeast-1`（东京区域）可用。Managed KB 同样在 `ap-northeast-1` 可用（2026-06-17 GA）。

| 项目 | OpenSearch Serverless | S3 Vectors 独立 | S3 Vectors + AOSS 导出 | Managed KB (Agentic Retriever) |
|------|----------------------|----------------------|--------------------------|--------------------------------|
| **CDK 参数** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors`（默认） | 在配置 2 的基础上运行 `export-to-opensearch.sh` | ⚠️ 未实现（验证完成后添加） |
| **成本** | 约 $700/月（2 个 OCU 始终运行） | 几美元/月（小规模） | S3 Vectors + AOSS OCU（仅在导出期间） | 按数据大小 + 检索次数的按需计费 |
| **延迟** | 约 10ms | 亚秒级（冷启动），约 100ms（热启动） | 约 10ms（导出后 AOSS 搜索） | ⚠️ 未测量（多跳时多次检索累加） |
| **过滤** | 元数据过滤（`$eq`、`$ne`、`$in` 等） | 元数据过滤（`$eq`、`$in`、`$and`、`$or`） | 导出后使用 AOSS 过滤 | `filter` 运算符（含 `listContains`）+ `userContext`（⚠️ SID 匹配未验证） |
| **元数据约束** | 无约束 | filterable 2KB/向量（自定义实际约 1KB），non-filterable 键最多 10 个 | 导出后遵循 AOSS 约束 | ⚠️ 托管存储内的约束未公开 |
| **搜索方式** | 向量搜索 / Hybrid（取决于 kbSearchType） | 向量搜索 / Hybrid（取决于 kbSearchType） | AOSS 搜索功能 | 混合搜索 + Agentic Retrieval（多跳） |
| **数据管道** | 用户管理（StartIngestionJob） | 用户管理（StartIngestionJob） | 用户管理 | 托管（6 个连接器 + 自动同步） |
| **AgentCore Gateway 集成** | 自定义 target | 自定义 target | 自定义 target | 内置 connector target（MCP） |
| **Permission-aware RAG** | ✅ 应用端 SID 过滤（已验证） | ✅ 应用端 SID 过滤（已验证） | ✅ 应用端 SID 过滤（已验证） | ⚠️ Validation Required（见下文） |
| **运维负担** | 中（OCU 设计 / 扩展） | 低（仅 S3 计费） | 中（导出运维） | 低（完全托管） |
| **使用场景** | 需要高性能的生产环境 | 成本优化、演示、开发环境 | 临时高性能需求 | 降低运维负担、多跳搜索、Smart Parsing |
| **操作步骤** | 仅 CDK 部署 | 仅 CDK 部署 | CDK 部署后运行 `export-to-opensearch.sh`。导出 IAM 角色自动创建 | ⚠️ CDK 暂不支持。验证完成后实现 |

### Managed KB (Agentic Retriever) 验证状态

> ⚠️ **Validation Required**：Managed KB 已于 2026-06-17 GA，但与本项目 Permission-aware RAG 要求的兼容性**尚未验证**。在确认以下项目之前，不会进行 CDK 堆栈集成。

| # | 验证项目 | 状态 |
|---|---------|------|
| V1 | S3 连接器是否识别 FSx ONTAP S3 Access Point | 未验证 |
| V2 | `.metadata.json` 的 `allowed_group_sids` 是否在索引中保留 | 未验证 |
| V3 | `filter` 的 `listContains` 是否支持 SID 数组匹配 | 未验证 |
| V4 | Agentic Retrieval 多跳期间过滤是否保持 | 未验证 |
| V5 | 权限变更/删除的反映延迟是否在可接受范围 | 未验证 |

详情请参阅 [Managed KB 迁移评估](managed-kb-migration-evaluation.md) 和 [Managed KB 升级路径](managed-kb-upgrade-path.md)。

### 选择指南

| 优先事项 | 推荐配置 |
|---------|---------|
| 成本最小化（演示/开发） | S3 Vectors 独立 |
| 生产低延迟要求 | OpenSearch Serverless |
| 降低运维负担 / 多跳搜索 | Managed KB（验证完成后） |
| 临时高性能需求 | S3 Vectors + AOSS 导出 |
| ACL 严格执行为最优先 | 维持现行配置（OpenSearch Serverless / S3 Vectors） |

> **S3 Vectors 元数据约束**：使用 Bedrock KB + S3 Vectors 时，自定义元数据实际限制为 1KB 或更少（Bedrock KB 内部元数据消耗了 2KB filterable 元数据限制中的约 1KB）。CDK 代码将所有元数据设置为 non-filterable 以绕过 2KB 限制。SID 过滤在应用程序端执行，因此不需要 S3 Vectors QueryVectors 过滤。详情请参阅 [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md)。

### 导出注意事项

- 导出是**时间点副本**。S3 Vectors 数据更新后需要重新导出（不执行持续同步）
- 导出期间会自动创建 AOSS 集合、OSI 管道、IAM 服务角色和 DLQ S3 存储桶
- 控制台的"创建并使用新的服务角色"选项会自动创建 IAM 角色，因此无需预先创建角色
- 导出大约需要 15 分钟（AOSS 集合创建 5 分钟 + 管道创建 5 分钟 + 数据传输 5 分钟）
- OSI 管道在数据传输完成后**自动停止**（成本高效）
- 管道停止后 AOSS 集合仍可搜索
- **不再需要时请手动删除 AOSS 集合**（`cdk destroy` 不会删除，因为它们在 CDK 管理范围之外。OCU 计费将继续）

---

## S3 Vectors 实施经验教训（已验证）

以下是 2026-03-29 在 ap-northeast-1（东京区域）实际部署验证中获得的经验教训。

### SDK/API 相关

| 项目 | 经验教训 |
|------|--------|
| SDK v3 响应 | `CreateVectorBucketCommand`/`CreateIndexCommand` 响应不包含 `vectorBucketArn`/`indexArn`。仅返回 `$metadata`。ARN 必须使用模式 `arn:aws:s3vectors:{region}:{account}:bucket/{name}` 构建 |
| API 命令名称 | `CreateIndexCommand`/`DeleteIndexCommand` 是正确的。`CreateVectorBucketIndexCommand` 不存在 |
| CreateIndex 必需参数 | `dataType: 'float32'` 是必需的。省略会导致验证错误 |
| 元数据设计 | 所有元数据键默认可过滤。`metadataConfiguration` 仅指定 `nonFilterableMetadataKeys`。无需显式配置即可使 `allowed_group_sids` 可过滤 |

### Bedrock KB 相关

| 项目 | 经验教训 |
|------|--------|
| S3VectorsConfiguration | `indexArn` 和 `indexName` 互斥。同时指定会导致 `2 subschemas matched instead of one` 错误。仅使用 `indexArn` |
| IAM 权限验证 | Bedrock KB 在创建时验证 KB Role 的 `s3vectors:QueryVectors` 权限。IAM 策略必须在 KB 创建之前应用 |
| 必需的 IAM 操作 | 需要 5 个操作：`s3vectors:QueryVectors`、`s3vectors:PutVectors`、`s3vectors:DeleteVectors`、`s3vectors:GetVectors`、`s3vectors:ListVectors` |

### CDK/CloudFormation 相关

| 项目 | 经验教训 |
|------|--------|
| IAM 策略资源 ARN | 使用显式 ARN 模式而非自定义资源 `GetAtt` 令牌。这可以避免依赖问题 |
| CloudFormation Hook | 组织级别的 `AWS::EarlyValidation::ResourceExistenceCheck` Hook 阻止变更集，可通过 `--method=direct` 绕过 |
| 部署时间 | AI 堆栈（S3 Vectors 配置）部署时间约 83 秒（与 AOSS 配置的约 5 分钟相比显著缩短） |

---

---

## 未来扩展选项

以下功能目前未实现，但设计为可通过 CDK context 参数作为可选功能添加。

| 功能 | 概述 | 预期参数 |
|---------|----------|--------------------|
| 监控与告警 | CloudWatch 仪表板（跨堆栈指标）、SNS 告警（错误率/延迟阈值超出） | `enableMonitoring=true` |
| 高级权限控制 | 基于时间的访问控制（仅在工作时间允许）、地理访问限制（IP 地理定位）、DynamoDB 审计日志 | `enableAdvancedPermissions=true` |

---

## 相关文档

| 文档 | 内容 |
|----------|---------|
| [README.md](../../README.zh-CN.md) | 部署步骤和 CDK context 参数列表 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 过滤设计和数据摄取路径详情 |
| [embedding-server-design.md](embedding-server-design.md) | Embedding 服务器设计（包括 ONTAP ACL 自动获取） |
| [ui-specification.md](ui-specification.md) | UI 规格（卡片 UI、KB/Agent 模式切换） |
