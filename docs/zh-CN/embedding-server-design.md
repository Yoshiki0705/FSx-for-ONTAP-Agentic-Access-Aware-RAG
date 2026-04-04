# Embedding 服务器设计与实现文档

**🌐 Language:** [日本語](../embedding-server-design.md) | [English](../en/embedding-server-design.md) | [한국어](../ko/embedding-server-design.md) | **简体中文** | [繁體中文](../zh-TW/embedding-server-design.md) | [Français](../fr/embedding-server-design.md) | [Deutsch](../de/embedding-server-design.md) | [Español](../es/embedding-server-design.md)

**创建日期**: 2026-03-26  
**目标读者**: 开发人员和运维人员  
**源代码**: `docker/embed/`

---

## 概述

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

该服务器通过 CIFS/SMB 挂载读取 FSx ONTAP 上的文档，使用 Amazon Bedrock Titan Embed Text v2 进行向量化，并将其索引到 OpenSearch Serverless（AOSS）中。

> **注意**：Embedding 服务器仅在 AOSS 配置（`vectorStoreType=opensearch-serverless`）下可用。在 S3 Vectors 配置（默认）下，Bedrock KB 自动管理 Embedding，因此不需要 Embedding 服务器。

它作为 Bedrock KB S3 数据源（选项 A）或 S3 Access Point（选项 C）不可用时的替代路径（选项 B）使用。

---

## 架构

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. File scan (recursive, .md/.txt/.html, etc.)
  ├── 2. Read SID information from .metadata.json
  ├── 3. Text chunk splitting (1000 chars, 200 char overlap)
  ├── 4. Vectorize with Bedrock Titan Embed v2 (1024 dimensions)
  └── 5. Index into AOSS (Bedrock KB compatible format)
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## 源代码结构

```
docker/embed/
├── src/
│   ├── index.ts       # Main processing (scan → chunk → Embedding → index)
│   └── oss-client.ts  # AOSS SigV4 signing client (IMDS auth support)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild build definition
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## 执行模式

| 模式 | 环境变量 | 行为 |
|------|---------------------|----------|
| 批处理模式 | `ENV_WATCH_MODE=false`（默认） | 处理所有文件一次后退出 |
| 监视模式 | `ENV_WATCH_MODE=true` | 使用 chokidar 检测文件变更并自动处理 |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `ENV_REGION` | `ap-northeast-1` | AWS 区域 |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | CIFS 挂载的数据目录 |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | 已处理文件记录的存储位置 |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Embedding 模型 |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | AOSS 索引名称 |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | （必需） | AOSS 集合名称 |
| `ENV_WATCH_MODE` | `false` | 启用监视模式 |
| `ENV_AUTO_METADATA` | `false` | 通过 ONTAP REST API 自动生成 .metadata.json |
| `ENV_ONTAP_MGMT_IP` | （空） | ONTAP 管理端点 IP |
| `ENV_ONTAP_SVM_UUID` | （空） | SVM UUID |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | ONTAP 管理员用户名 |
| `ENV_ONTAP_PASSWORD` | （空） | ONTAP 管理员密码 |

---

## 处理流程

### 批处理模式

```
1. 初始化 AOSS 客户端（获取集合端点）
2. 加载 processed.json（用于差异处理）
3. 递归扫描 DATA_DIR（.md、.txt、.html、.csv、.json、.xml）
4. 对每个文件：
   a. 如果 mtime 与 processed.json 匹配则跳过
   b. 如果存在 .metadata.json 则使用
   c. 如果 .metadata.json 不存在且 ENV_AUTO_METADATA=true：
      - 通过 ONTAP REST API 获取 ACL（`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`）
      - 从 ACL 中提取 SID 并自动生成/写入 .metadata.json
   d. 读取文本 → 分块（1000 字符，200 字符重叠）
   e. 使用 Bedrock Titan Embed v2 对每个块进行向量化
   f. 索引到 AOSS（Bedrock KB 兼容格式）
   g. 更新 processed.json
5. 输出处理摘要并退出
```

### 监视模式

```
1-5. 与批处理模式相同（初始扫描）
6. 使用 chokidar 启动文件监视
   - awaitWriteFinish: 2 秒（等待写入完成）
7. 文件添加/变更事件 → 添加到队列
8. 从队列中逐个处理（通过 `processing` 标志防止并行执行）
   - processFile() → 更新 processed.json
9. 在无限循环中等待
```

---

## 差异处理机制

文件路径和修改时间（mtime）记录在 `processed.json` 中。

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- 如果文件的 mtime 未更改则跳过
- 如果文件已更新则重新处理（覆盖索引）
- 删除 `processed.json` 可重新处理所有文件

### 与先前版本的差异

| 项目 | 先前版本 | 当前版本 |
|------|-----------------|-----------------|
| 差异管理 | SQLite（drizzle-orm + better-sqlite3） | JSON 文件（processed.json） |
| 文件识别 | inode 编号（files.ino） | 文件路径 + mtime |
| 批量文件同时上传 | UNIQUE constraint failed | ✅ 通过顺序队列安全处理 |
| 依赖项 | drizzle-orm、better-sqlite3 | 无（标准 fs） |

---

## AOSS 索引格式

仅写入 3 个 Bedrock KB 兼容字段。

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024 dimensions
  "AMAZON_BEDROCK_TEXT_CHUNK": "Document text chunk",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### 重要：AOSS 索引 Schema 兼容性

AOSS 索引使用 `dynamic: false` 创建。这意味着：
- 即使写入上述 3 个以外的字段，索引映射也不会改变
- Bedrock KB 同步不会导致"storage configuration invalid"错误
- 元数据（SID 信息等）作为 JSON 字符串存储在 `AMAZON_BEDROCK_METADATA` 字段中

### 元数据结构

每个文档需要一个对应的 `.metadata.json` 文件。通过在此文件中包含 NTFS ACL SID 信息，实现 RAG 搜索时的访问控制。

#### 如何获取 `.metadata.json` 的 SID 信息

本系统具有从 NTFS ACL 自动获取 SID 的机制。

| 组件 | 实现文件 | 功能 |
|-----------|-------------------|----------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | 通过 SSM 执行 PowerShell 获取 AD 用户 SID 信息并存储到 DynamoDB |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | 通过 SSM 执行 Get-Acl 获取文件/目录的 NTFS ACL（SID） |
| AD Sync 配置 | `types/agentcore-config.ts`（`AdSyncConfig`） | AD 同步启用、缓存 TTL、SSM 超时等设置 |

这些是未来的扩展选项。在当前的演示堆栈配置（`lib/stacks/demo/`）中，为验证目的手动放置了示例 `.metadata.json` 文件。

#### SID 自动获取处理流程

```
1. AD Sync Lambda（用户 SID 获取）
   SSM → Windows EC2 → PowerShell (Get-ADUser) → 获取 SID → 存储到 DynamoDB user-access

2. FSx Permission Service（文件 ACL 获取）
   SSM → Windows EC2 → PowerShell (Get-Acl) → 获取 NTFS ACL → 提取 SID → 可生成 .metadata.json
```

#### 演示环境的简化设置

演示堆栈不使用上述自动化，而是通过以下手动步骤设置 SID 数据：

- `.metadata.json`：在 `demo-data/documents/` 下手动放置的示例
- DynamoDB user-access：使用 `demo-data/scripts/setup-user-access.sh` 手动注册邮箱到 SID 的映射

#### 生产环境的自动化选项

| 方法 | 说明 |
|--------|-------------|
| AD Sync Lambda | 通过 SSM 自动获取 AD 用户 SID 并存储到 DynamoDB（已实现） |
| FSx Permission Service | 通过 SSM 的 Get-Acl 获取 NTFS ACL（已实现） |
| ONTAP REST API | 通过 FSx ONTAP 管理端点直接获取 ACL（已实现：`ENV_AUTO_METADATA=true`） |
| S3 Access Point | 通过 S3 AP 访问文件时自动应用 NTFS ACL（CDK 支持：`useS3AccessPoint=true`） |

#### 使用 S3 Access Point 时（选项 C）

当 Bedrock KB 通过 S3 Access Point 摄取文档时，NTFS ACL 通过 S3 Access Point 的 `FileSystemIdentity`（WINDOWS 类型）自动应用。但是，Bedrock KB Retrieve API 返回的元数据是否包含 ACL 信息取决于 S3 Access Point 的实现。目前，通过 `.metadata.json` 进行 SID 管理是可靠的方法。

#### `.metadata.json` 格式

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → Value stored in AMAZON_BEDROCK_METADATA
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## AOSS 认证（SigV4 签名）

`oss-client.ts` 使用 AWS SigV4 签名访问 AOSS。

- 自动从 EC2 实例配置文件（IMDS）获取凭证
- 使用 `@aws-sdk/credential-provider-node` 的 defaultProvider
- 凭证在过期前 5 分钟自动刷新
- AOSS 的服务名称为 `aoss`

---

## 批量文件同时上传处理

在监视模式下同时上传 20 个或更多文件时：

1. 使用 chokidar 的 `awaitWriteFinish` 等待写入完成（2 秒）
2. 每个文件事件添加到队列
3. 从队列中逐个处理（通过 `processing` 标志进行排他控制）
4. 每个块 Embedding 后等待 200ms（Bedrock API 速率限制对策）
5. 处理完成后更新 `processed.json`

这确保了：
- 不违反 Bedrock API 速率限制
- 不会并发写入 `processed.json`
- 如果处理过程中进程停止，已记录在 `processed.json` 中的文件不会被重新处理

---

## CDK 堆栈

`DemoEmbeddingStack`（`lib/stacks/demo/demo-embedding-stack.ts`）创建以下资源：

| 资源 | 说明 |
|----------|-------------|
| EC2 Instance（m5.large） | 强制 IMDSv2，启用 SSM |
| ECR Repository | 用于 Embedding 容器镜像 |
| IAM Role | SSM、FSx、AOSS、Bedrock、ECR、Secrets Manager |
| Security Group | 允许与 FSx SG + AD SG 通信 |
| UserData | 自动 CIFS 挂载 + Docker 自动启动 |

### 启用方式

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## 故障排除

| 症状 | 原因 | 解决方案 |
|---------|-------|------------|
| AOSS 403 Forbidden | EC2 角色未添加到数据访问策略 | 将 Embedding EC2 角色添加到 AOSS 策略 |
| Bedrock ThrottlingException | API 速率限制超出 | 增加块之间的等待时间（200ms → 500ms） |
| CIFS 挂载失败 | SVM 未加入 AD 或 CIFS 共享未创建 | 验证 AD 加入 + 通过 ONTAP REST API 创建 CIFS 共享 |
| processed.json 损坏 | 进程中断 | 删除 `processed.json` 并重新运行 |
| KB 同步错误（storage config invalid） | AOSS 索引中存在 KB 不兼容的字段 | 删除索引 → 重新创建 → 重新创建数据源 → 同步 |
| 所有文档被 SID 过滤拒绝 | 通过 Embedding 服务器的文档没有元数据 | 验证 `.metadata.json` 存在且 `allowed_group_sids` 已设置 |

---

## 相关文档

| 文档 | 内容 |
|----------|---------|
| [README.md](../../README.zh-CN.md) | 部署步骤（选项 B） |
| [docs/implementation-overview.md](implementation-overview.md) | 实现概述（第 5 项：Embedding 服务器） |
| [docs/ui-specification.md](ui-specification.md) | UI 规格（目录显示） |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | 验证环境的操作步骤 |
