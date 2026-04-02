# 文档索引

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | **简体中文** | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## 必读文档

| 文档 | 说明 |
|------|------|
| [README.md](../../README.zh-CN.md) | 系统概述、架构、部署步骤、WAF/Geo 设置 |
| [implementation-overview.md](implementation-overview.md) | 详细实现（12个方面：图像分析 RAG、KB 连接 UI、Smart Routing、监控与告警） |
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
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | 验证场景（管理员与普通用户权限差异、AD SSO 登录） |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD 集成、CIFS 共享、NTFS ACL 配置（已验证流程） |
| [demo-environment-guide.md](demo-environment-guide.md) | 验证环境资源 ID、访问信息、Embedding 服务器流程 |

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

## 推荐阅读顺序

1. **README.md** — 系统概述和部署步骤
2. **implementation-overview.md** — 8个方面的详细实现
3. **SID-Filtering-Architecture.md** — 核心功能技术详情
4. **demo-recording-guide.md** — 演示视频录制指南
5. **ontap-setup-guide.md** — FSx ONTAP AD 集成、CIFS 共享设置
6. **README.md - AD SAML Federation** — AD SAML federation 设置（可选）
7. **demo-environment-guide.md** — 验证环境设置（包含 Embedding 服务器）
8. **demo-scenario.md** — 执行验证场景（AD SSO 登录）
9. **verification-report.md** — API 级别验证流程
