# 基于 SID 的权限过滤架构

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | [English](../en/SID-Filtering-Architecture.md) | [한국어](../ko/SID-Filtering-Architecture.md) | **简体中文** | [繁體中文](../zh-TW/SID-Filtering-Architecture.md) | [Français](../fr/SID-Filtering-Architecture.md) | [Deutsch](../de/SID-Filtering-Architecture.md) | [Español](../es/SID-Filtering-Architecture.md)

## 概述

本系统利用 NTFS ACL SID（安全标识符）按用户过滤 RAG 搜索结果。来自 FSx for NetApp ONTAP 文件系统的访问权限信息作为元数据存储在向量数据库中，并在搜索时实时执行权限检查。

---

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        数据摄取流程                                      │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ 通过 S3 兼容    │    │ ・使用 Titan Embed v2 │  │
│  │ 文件         │    │ 接口暴露 FSx    │    │   进行向量化          │  │
│  │ 权限         │    │ 卷              │    │ ・元数据（SID）也     │  │
│  │ + .metadata  │    └─────────────────┘    │   一并存储            │  │
│  │   .json      │                           └───────────┬───────────┘  │
│  └──────────────┘                                       │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ 向量存储                  │  │
│                                          │ （通过 vectorStoreType   │  │
│                                          │  选择）                   │  │
│                                          │ ・S3 Vectors（默认）     │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ 向量数据 +               │  │
│                                          │ 元数据（SID 等）         │  │
│                                          │ 已存储                   │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        搜索与过滤流程                                    │
│                                                                         │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ 用户      │───▶│ Next.js          │───▶│ Bedrock KB               │  │
│  │（浏览器） │    │ KB Retrieve API  │    │ Retrieve API             │  │
│  └──────────┘    └────────┬─────────┘    └────────────┬─────────────┘  │
│                           │                           │                │
│                           │                           ▼                │
│                           │              ┌──────────────────────────┐  │
│                           │              │ 搜索结果                  │  │
│                           │              │ ・Citation（源文档）      │  │
│                           │              │   └─ metadata             │  │
│                           │              │       └─ allowed_group_sids│ │
│                           │              └────────────┬─────────────┘  │
│                           │                           │                │
│                           ▼                           ▼                │
│              ┌──────────────────┐    ┌──────────────────────────────┐  │
│              │ DynamoDB         │    │ SID 过滤处理                  │  │
│              │ user-access      │───▶│                              │  │
│              │ ・userId          │    │ 用户 SID ∩ 文档 SID         │  │
│              │ ・userSID         │    │ = 匹配 → 允许访问           │  │
│              │ ・groupSIDs       │    │ ≠ 不匹配 → 拒绝访问        │  │
│              └──────────────────┘    └──────────────┬───────────────┘  │
│                                                     │                │
│                                                     ▼                │
│                                      ┌──────────────────────────────┐  │
│                                      │ Converse API                 │  │
│                                      │ ・仅使用允许的文档           │  │
│                                      │   生成响应                   │  │
│                                      │ ・返回过滤后的 Citation      │  │
│                                      └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **关于 S3 Access Point**：FSx for ONTAP 的 S3 Access Point 通过 S3 兼容接口直接暴露 FSx 卷上的文件。无需将文件复制到单独的 S3 存储桶。Bedrock KB 将 S3 AP 别名作为数据源引用，直接从 FSx 卷摄取文档（包括 `.metadata.json`）。

---

## SID 过滤逻辑详解

### 步骤 1：获取用户 SID

当用户在聊天中提交问题时，KB Retrieve API 从 DynamoDB `user-access` 表中获取用户的 SID 信息。

```
DynamoDB user-access 表
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ （管理员）            │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ （普通用户）          │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ 用户的完整 SID 列表 = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### 步骤 2：获取文档元数据

Bedrock KB 搜索结果中的每个 Citation 包含从 S3 上的 `.metadata.json` 文件摄取的元数据。

> **`.metadata.json` 的创建方式**：本系统包含由 AD Sync Lambda（`lambda/agent-core-ad-sync/`）和 FSx 权限服务（`lambda/permissions/fsx-permission-service.ts`）实现的自动 NTFS ACL 获取功能。在演示环境中，为验证目的手动放置了示例数据。详情请参阅 [docs/embedding-server-design.md](embedding-server-design.md) 中的"元数据结构"部分。

```
文档元数据（.metadata.json）
┌──────────────────────────┬──────────────────────────────────────┐
│ 文档                     │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone（所有用户）              │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone（所有用户）              │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ 仅 Domain Admins                 │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ 仅 Domain Admins                 │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### 步骤 3：SID 匹配

将用户的 SID 列表与文档的 `allowed_group_sids` 进行比较。

```
匹配规则：用户 SID ∩ 文档 SID ≠ ∅ → ALLOW

■ 管理员用户（admin@example.com）
  用户 SID: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ 用户 SID → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ 用户 SID → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∈ 用户 SID → ✅ ALLOW
  confidential/hr-policy    → S-1-5-21-...-512 ∈ 用户 SID → ✅ ALLOW
  restricted/project-plan   → S-1-5-21-...-512 ∈ 用户 SID → ✅ ALLOW

■ 普通用户（user@example.com）
  用户 SID: [S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ 用户 SID → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ 用户 SID → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∉ 用户 SID → ❌ DENY
  confidential/hr-policy    → S-1-5-21-...-512 ∉ 用户 SID → ❌ DENY
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ DENY
```

### 步骤 4：故障安全回退

当无法获取 SID 信息时（DynamoDB 中无记录、连接错误等），系统回退到安全侧，拒绝所有文档的访问。

```
SID 获取失败时的流程：
  DynamoDB → 错误或无记录
    → allUserSIDs = []（空）
    → 所有文档 DENY
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## 关于 SID（安全标识符）

### SID 结构

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              域标识符                          相对 ID
│ │ │  └─ 子权限计数
│ │ └─ 标识符权限（5 = NT Authority）
│ └─ 修订版本
└─ SID 前缀
```

### 关键 SID

| SID | 名称 | 说明 |
|-----|------|-------------|
| `S-1-1-0` | Everyone | 所有用户 |
| `S-1-5-21-...-500` | Administrator | 域管理员 |
| `S-1-5-21-...-512` | Domain Admins | 域管理员组 |
| `S-1-5-21-...-1001` | User | 普通用户 |
| `S-1-5-21-...-1100` | Engineering | 工程组 |

### FSx for ONTAP 中的 SID

FSx for ONTAP 在 NTFS 安全样式卷上支持 Windows ACL。每个文件/目录都配置了 ACL（访问控制列表），并基于 SID 管理访问权限。

通过 S3 Access Point 访问 FSx 上的文件时，NTFS ACL 信息作为元数据暴露。本系统将此 ACL 信息（SID）作为 Bedrock KB 元数据摄取，并在搜索时用于过滤。

---

## 详细数据流

### 1. 数据摄取时（Embedding）

```
FSx for ONTAP                    S3 Access Point              Bedrock KB
┌─────────────┐                ┌──────────────┐             ┌──────────────┐
│ file.md     │  S3 Access     │ S3 兼容      │  KB Sync    │ 向量化       │
│ NTFS ACL:   │──Point──▶     │ 接口         │────────▶   │ + 元数据     │
│  Admin:Full │                │              │             │ 存储         │
│  Users:Read │                │ file.md      │             │              │
│             │                │ file.md      │             └──────┬───────┘
│ file.md     │                │ .metadata    │                    │
│ .metadata   │                │ .json        │                    ▼
│ .json       │                │ （直接从     │             ┌──────────────┐
│ {           │                │  FSx 暴露）  │             │ OpenSearch   │
│  "allowed_  │                └──────────────┘             │ Serverless   │
│   group_sids│                                             │ ・vector     │
│  :["S-1-.."]│                                             │ ・text_chunk │
│ }           │                                             │ ・metadata   │
└─────────────┘                                             │   (SID 信息) │
                                                            └──────────────┘
```

> S3 Access Point 通过 S3 兼容接口直接暴露 FSx 卷文件，因此不需要复制到 S3 存储桶。

### 数据摄取路径选项

本系统提供三条数据摄取路径。由于截至 2026 年 3 月 S3 Access Point 不适用于 FlexCache Cache 卷，因此需要备用配置。

| # | 路径 | 方法 | CDK 激活方式 | 使用场景 |
|---|------|--------|----------------|----------|
| 1 | 主路径 | FSx ONTAP Volume → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 标准卷（支持 S3 AP） |
| 2 | 备用路径 | 手动上传到 S3 存储桶 → Bedrock KB | `upload-demo-data.sh` | FlexCache 卷及其他不支持 S3 AP 的情况 |
| 3 | 替代路径 | CIFS 挂载 → Embedding 服务器 → 直接写入 AOSS | `-c enableEmbeddingServer=true` | FlexCache 卷 + 需要直接 AOSS 控制的情况 |

路径 2 的 S3 存储桶（`${prefix}-kb-data-${ACCOUNT_ID}`）始终由 StorageStack 创建。当 S3 AP 不可用时，您可以将文档 + `.metadata.json` 上传到此存储桶并将其配置为 KB 数据源以启用 SID 过滤。

### 2. 搜索时（两阶段方法：Retrieve + Converse）

```
用户              Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ 提交问题         │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ 获取 SID           │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ Retrieve API（向量搜索 + 元数据）      │                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ 搜索结果 + 元数据（SID）              │                │
  │                  │                    │                  │                │
  │                  │ SID 匹配           │                  │                │
  │                  │（用户 SID ∩        │                  │                │
  │                  │  文档 SID）        │                  │                │
  │                  │                    │                  │                │
  │                  │ 仅使用允许的文档生成响应                │                │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ 过滤后的结果     │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

> 使用 Retrieve API 而非 RetrieveAndGenerate API 的原因：RetrieveAndGenerate API 不会在 Citation 的 `metadata` 字段中包含 `.metadata.json` 中的 `allowed_group_sids`，因此无法进行 SID 过滤。由于 Retrieve API 正确返回元数据，因此采用两阶段方法（Retrieve → SID 过滤 → Converse）。

### 3. Agent 模式搜索时（混合方法）

在 Agent 模式中，采用混合方法实现权限感知 RAG。由于 InvokeAgent API 不允许在应用程序端进行 SID 过滤，因此通过 KB Retrieve API + SID 过滤 + Converse API（使用 Agent 系统提示词）的组合来实现。

```
用户              Next.js API           Bedrock KB          DynamoDB         Converse API
  │                  │                    │                    │                │
  │ 提交问题         │                    │                    │                │
  │─────────────────▶│                    │                    │                │
  │                  │ Retrieve API       │                    │                │
  │                  │───────────────────▶│                    │                │
  │                  │◀───────────────────│                    │                │
  │                  │ 结果 + 元数据      │                    │                │
  │                  │                    │                    │                │
  │                  │ 获取 SID                                │                │
  │                  │────────────────────────────────────────▶│                │
  │                  │◀────────────────────────────────────────│                │
  │                  │                    │                    │                │
  │                  │ SID 过滤           │                    │                │
  │                  │（与 KB 模式相同）  │                    │                │
  │                  │                    │                    │                │
  │                  │ 使用允许的文档 + Agent 系统提示词生成响应│                │
  │                  │─────────────────────────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────────────────────────│
  │                  │                    │                    │                │
  │ Agent 响应       │                    │                    │                │
  │ + Citation       │                    │                    │                │
  │◀─────────────────│                    │                    │                │
```

> Bedrock Agent InvokeAgent API 也可用，但由于 InvokeAgent API 不允许在应用程序端进行 SID 过滤，因此仅作为回退使用。混合方法是默认方式，以保证权限感知行为。

---

## API 响应示例

### 过滤日志（filterLog）

```json
{
  "totalDocuments": 5,
  "allowedDocuments": 2,
  "deniedDocuments": 3,
  "userId": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
  "userSIDs": [
    "S-1-5-21-0000000000-0000000000-0000000000-1001",
    "S-1-1-0"
  ],
  "filterMethod": "SID_MATCHING",
  "details": [
    {
      "fileName": "product-catalog.md",
      "documentSIDs": ["S-1-1-0"],
      "matched": true,
      "matchedSID": "S-1-1-0"
    },
    {
      "fileName": "financial-report.md",
      "documentSIDs": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
      "matched": false
    }
  ]
}
```

---

## 安全设计

### 故障安全回退原则

本系统遵循"Fail-Closed"原则，在权限检查失败时拒绝所有文档的访问。

| 情况 | 行为 |
|-----------|----------|
| DynamoDB 连接错误 | 拒绝所有文档 |
| 无用户 SID 记录 | 拒绝所有文档 |
| 元数据中无 SID 信息 | 拒绝对应文档 |
| SID 不匹配 | 拒绝对应文档 |
| SID 匹配 | 允许对应文档 |

### 权限缓存

过滤结果缓存在 DynamoDB `permission-cache` 表中，以加速对同一用户和文档组合的重复检查（TTL：5 分钟）。
