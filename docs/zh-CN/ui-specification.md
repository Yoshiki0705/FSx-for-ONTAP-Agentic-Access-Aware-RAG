# 聊天机器人 UI 规格

**🌐 Language:** [日本語](../ui-specification.md) | [English](../en/ui-specification.md) | [한국어](../ko/ui-specification.md) | **简体中文** | [繁體中文](../zh-TW/ui-specification.md) | [Français](../fr/ui-specification.md) | [Deutsch](../de/ui-specification.md) | [Español](../es/ui-specification.md)

**创建日期**: 2026-03-26  
**目标读者**: 开发人员和运维人员  
**应用**: Permission-aware RAG Chatbot

---

## 概述

本文档描述了 RAG 聊天机器人各 UI 元素的规格及其与后端的集成。

---

## 1. 侧边栏 — 用户信息部分

### 显示内容

| 项目 | 数据源 | 说明 |
|------|------------|-------------|
| 用户名 | Cognito JWT | 登录时的邮箱地址 |
| 角色 | Cognito JWT | `admin` 或 `user` |

### 访问权限显示

| 项目 | 数据源 | 说明 |
|------|------------|-------------|
| 目录 | `/api/fsx/directories` | 基于 SID 的可访问目录 |
| 读取 | 同上 | SID 数据存在时为 `✅` |
| 写入 | 同上 | 仅当用户拥有 Domain Admins SID 时为 `✅` |

### 可访问目录的工作原理

Introduction Message 显示三种类型的目录信息。

| 项目 | 图标 | 数据源 | 说明 |
|------|------|------------|-------------|
| FSx 可访问目录 | 📁 | DynamoDB SID → SID_DIRECTORY_MAP | FSx ONTAP 上文件级别可访问的目录 |
| RAG 可搜索目录 | 🔍 | S3 `.metadata.json` 中的 SID 匹配 | KB 搜索中 SID 匹配的文档目录 |
| Embedding 目标目录 | 📚 | S3 存储桶中所有 `.metadata.json` | KB 中索引的所有目录 |

#### 按用户的显示示例

| 用户 | FSx 访问 | RAG 搜索 | Embedding 目标 |
|------|-----------|---------|----------------|
| admin@example.com | `public/`、`confidential/`、`restricted/` | `public/`、`confidential/`、`restricted/` | `public/`、`confidential/`、`restricted/`（显示） |
| user@example.com | `public/` | `public/` | 隐藏（出于安全考虑隐藏不可访问目录的存在） |

Embedding 目标目录不向普通用户显示（以避免暴露他们无法访问的目录的存在）。📚 Embedding 目标目录仅在 RAG 可搜索目录和 Embedding 目标目录相同时显示，如管理员的情况。

---

## 2. 侧边栏 — Bedrock 区域部分

### 显示内容

| 项目 | 数据源 | 说明 |
|------|------------|-------------|
| 区域名称 | `RegionConfigManager` | 所选区域的显示名称 |
| 区域 ID | `regionStore` | 例如 `ap-northeast-1` |
| 模型数量 | `/api/bedrock/region-info` | 所选区域中可用模型的数量 |

---

## 3. AI 模型选择部分

### 获取模型列表

```
/api/bedrock/models (GET)
  ↓
ListFoundationModels API (byOutputModality=TEXT)
  ↓
通过 provider-patterns.ts 自动检测提供商
  ↓
返回所有模型（包括 Unknown 提供商）
```

### 支持的提供商（13 个）

amazon、anthropic、cohere、deepseek、google、minimax、mistral、moonshot、nvidia、openai、qwen、twelvelabs、zai

### 回退链

```
选择的模型 → （失败） → apac.amazon.nova-lite-v1:0 → （失败） → anthropic.claude-3-haiku-20240307-v1:0
```

当 Legacy 模型错误、按需不可用错误或 ValidationException 发生时自动尝试下一个模型。

---

## 4. 聊天区域 — Introduction Message

### 显示内容

登录后自动生成的初始消息。

| 部分 | 内容 |
|---------|---------|
| 问候语 | 包含用户名的欢迎消息 |
| 访问权限 | 用户名、角色、可访问目录 |
| 环境类型 | 基于 SID / FSx 生产 / 模拟 |
| 权限详情 | 读取 / 写入 / 执行可用性 |
| 可用功能 | 文档搜索和问答、基于权限的访问控制 |

### 多语言支持

支持 8 种语言（ja、en、de、es、fr、ko、zh-CN、zh-TW）。翻译键定义在 `docker/nextjs/src/messages/{locale}.json` 的 `introduction` 部分。

---

## 5. 聊天区域 — RAG 搜索流程

### 两阶段方法（Retrieve + Converse）

```
用户问题
  ↓
/api/bedrock/kb/retrieve (POST)
  ↓
步骤 1：DynamoDB user-access → 获取用户 SID
  ↓
步骤 2：Bedrock KB Retrieve API → 向量搜索（带元数据）
  ↓
步骤 3：SID 过滤
  - 将文档的 allowed_group_sids 与用户 SID 匹配
  - 匹配 → ALLOW，不匹配 → DENY
  ↓
步骤 4：Converse API → 仅使用允许的文档生成响应
  ↓
返回响应 + Citation + filterLog
```

### 为什么不使用 RetrieveAndGenerate API

RetrieveAndGenerate API 不会在 Citation 的 `metadata` 字段中包含 `.metadata.json` 中的 `allowed_group_sids`。由于 Retrieve API 正确返回元数据，因此采用两阶段方法。

### 前端回退

如果 KB Retrieve API 返回 500 错误，前端回退到常规 Bedrock Chat API（`/api/bedrock/chat`）。在这种情况下，返回不引用 KB 文档的通用 AI 响应。

---

## 6. API 列表

| 端点 | 方法 | 说明 |
|----------|--------|-------------|
| `/api/bedrock/kb/retrieve` | POST | RAG 搜索 + SID 过滤 + 响应生成 |
| `/api/bedrock/chat` | POST | 常规聊天（无 KB，用于回退） |
| `/api/bedrock/models` | GET | 可用模型列表 |
| `/api/bedrock/region-info` | GET | 区域信息 + 模型数量 |
| `/api/bedrock/change-region` | POST | 更改区域（Cookie 更新） |
| `/api/fsx/directories` | GET | 用户的可访问目录（基于 SID） |
| `/api/auth/signin` | POST | Cognito 认证 |
| `/api/auth/session` | GET | 会话信息 |
| `/api/auth/signout` | POST | 退出登录 |
| `/api/health` | GET | 健康检查 |

---

## 7. 环境变量

为 Lambda 函数设置的环境变量。

| 变量名 | 说明 | 示例 |
|--------------|-------------|---------|
| `DATA_BUCKET_NAME` | KB 数据源 S3 存储桶名称 | `perm-rag-demo-demo-kb-data-${ACCOUNT_ID}` |
| `BEDROCK_KB_ID` | Knowledge Base ID | `3ZZMK6YA0Q` |
| `BEDROCK_REGION` | Bedrock 区域 | `ap-northeast-1` |
| `USER_ACCESS_TABLE_NAME` | DynamoDB user-access 表名 | `perm-rag-demo-demo-user-access` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxx` |
| `ENABLE_PERMISSION_CHECK` | 启用权限检查 | `true` |

---

## 8. KB/Agent 模式切换

### 概述

在头部放置 KB/Agent 模式切换，允许在两种模式之间无缝切换。

### 模式切换机制

| 项目 | 说明 |
|------|-------------|
| 切换位置 | 头部标题右侧 |
| 状态管理 | `useState` + URL 参数（`?mode=agent`） |
| 持久化 | 通过 URL 参数持久化（可收藏） |
| 默认 | KB 模式（无 `?mode` 参数） |

### 按模式的行为

| 功能 | KB 模式 | Agent 模式 |
|---------|---------|------------|
| 侧边栏 | KBModeSidebar（内联） | AgentModeSidebar（组件） |
| 模型列表 | `/api/bedrock/region-info`（所有模型） | `/api/bedrock/agent-models`（仅 Agent 兼容模型） |
| 聊天 API | `/api/bedrock/kb/retrieve` | `/api/bedrock/kb/retrieve`（带 `agentMode=true` 标志） |
| SID 过滤 | ✅ 是 | ✅ 是（混合方法） |
| 头部徽章 | 📚 Knowledge Base（蓝色） | 🤖 Agent（紫色） |

### Agent 模式混合方法

Agent 模式采用混合方法实现 Permission-aware RAG。

```
用户问题
  │
  ▼
KB Retrieve API（向量搜索）
  │
  ▼
SID 过滤（与 KB 模式相同的管道）
  │ 用户 SID ∩ 文档 SID → 允许/拒绝
  ▼
仅允许的文档作为上下文
  │
  ▼
Converse API（带 Agent 系统提示词）
  ▼
响应 + Citation 显示
```

---

## 9. 基于卡片的任务导向 UI

### 概述

在聊天区域的初始状态（无用户消息时）显示卡片网格的功能。KB 模式显示 14 张用途特定的卡片（文档搜索、摘要创建等），Agent 模式显示 14 张工作流卡片（财务分析、项目管理、演示文稿创建等），允许用户一键输入提示词。

### 组件结构

| 组件 | 文件路径 | 角色 |
|-----------|----------|------|
| CardGrid | `docker/nextjs/src/components/cards/CardGrid.tsx` | 主容器。集成 InfoBanner、CategoryFilter 和 TaskCard |
| TaskCard | `docker/nextjs/src/components/cards/TaskCard.tsx` | 单个卡片组件（KB/Agent 共享） |
| InfoBanner | `docker/nextjs/src/components/cards/InfoBanner.tsx` | 权限信息横幅（可折叠/展开） |
| CategoryFilter | `docker/nextjs/src/components/cards/CategoryFilter.tsx` | 类别过滤芯片 |

### KB 模式卡片列表（14 张）

#### 研究类别（8 张）

| ID | 图标 | 类别 | 用途 |
|----|------|---------|---------|
| `kb-doc-search` | 🔍 | search | 文档搜索 |
| `kb-doc-summary` | 📝 | summary | 摘要创建 |
| `kb-quiz-gen` | 📚 | learning | 测验生成 |
| `kb-compare` | ⚖️ | analysis | 比较分析 |
| `kb-keyword-search` | 🏷️ | search | 关键词搜索 |
| `kb-report-summary` | 📊 | summary | 报告摘要 |
| `kb-qa-gen` | ❓ | learning | 问答生成 |
| `kb-trend-analysis` | 📈 | analysis | 趋势分析 |

#### 输出类别（6 张）

| ID | 图标 | 类别 | 用途 |
|----|------|---------|---------|
| `kb-presentation` | 🎬 | output | 演示文稿创建 |
| `kb-approval` | 📋 | output | 审批文档创建 |
| `kb-minutes` | 🗒️ | output | 会议纪要创建 |
| `kb-report-gen` | 📑 | output | 自动报告生成 |
| `kb-contract` | 📄 | output | 合同审查 |
| `kb-onboarding` | 🎓 | output | 入职材料 |

#### Agent 模式卡片列表（14 张）

##### 研究类别（8 张）

| ID | 图标 | 类别 | 用途 |
|----|------|---------|---------|
| `agent-financial` | 📊 | financial | 财务报告分析 |
| `agent-project` | 📝 | project | 项目进度检查 |
| `agent-cross-search` | 🔍 | search | 跨文档搜索 |
| `agent-hr` | 📋 | hr | HR 政策检查 |
| `agent-risk` | ⚠️ | financial | 风险分析 |
| `agent-milestone` | 🎯 | project | 里程碑管理 |
| `agent-compliance` | 🔐 | hr | 合规检查 |
| `agent-data-analysis` | 📉 | search | 数据分析 |

##### 输出类别（6 张）

| ID | 图标 | 类别 | 用途 |
|----|------|---------|---------|
| `agent-presentation` | 📊 | presentation | 演示文稿创建 |
| `agent-approval` | 📋 | approval | 审批文档创建 |
| `agent-minutes` | 📝 | minutes | 会议纪要创建 |
| `agent-report` | 📈 | report | 报告创建 |
| `agent-contract` | 📄 | contract | 合同审查 |
| `agent-onboarding` | 🎓 | onboarding | 入职材料创建 |

### 显示条件

CardGrid 显示由用户消息的存在控制。

| 条件 | 显示内容 |
|-----------|----------------|
| 无用户消息（`messages` 中 `role === 'user'` 的条目为 0） | 显示 CardGrid |
| 存在用户消息（`role === 'user'` 有 1 个或更多条目） | 正常消息列表显示 + "🔄 返回工作流选择"按钮 |
| 点击"新聊天"按钮 | 创建新会话 → 重新显示 CardGrid |
| 点击"🔄 返回工作流选择"按钮 | 创建新会话 → 重新显示 CardGrid |

### 收藏管理

| 项目 | 说明 |
|------|-------------|
| 持久化方式 | Zustand `persist` 中间件 + localStorage |
| localStorage 键 | `card-favorites-storage` |
| 回退 | localStorage 不可用时仅内存（会话期间保留） |
| 排序行为 | 收藏卡片显示在网格顶部。每组内的相对顺序保持不变 |

### 类别过滤

#### KB 模式类别

| 类别 ID | 显示名称 |
|------------|-------------------|
| `all` | 全部 |
| `search` | 搜索 |
| `summary` | 摘要 |
| `learning` | 学习 |
| `analysis` | 分析 |
| `output` | 文档创建 |

#### Agent 模式类别

| 类别 ID | 显示名称 |
|------------|-------------------|
| `all` | 全部 |
| `financial` | 财务 |
| `project` | 项目 |
| `hr` | 人力资源 |
| `search` | 搜索 |
| `presentation` | 文档创建 |
| `approval` | 审批 |
| `minutes` | 纪要 |
| `report` | 报告 |
| `contract` | 合同 |
| `onboarding` | 入职 |

### InfoBanner

将现有 Introduction Text 信息整合为紧凑的横幅。

#### 折叠状态（默认）

单行显示：`用户名 | 角色 | 📁 可访问 N 个目录`

#### 展开状态

| 显示项目 | 说明 |
|-------------|-------------|
| 用户名 | Cognito JWT 中的邮箱地址 |
| 角色 | `admin` 或 `user` |
| SID | 用户的安全标识符 |
| 目录列表 | 三种类型：FSx / RAG / Embedding |
| 权限详情 | 读取 ✅/❌、写入 ✅/❌、执行 ✅/❌ |

### 翻译

支持所有 8 种语言。翻译键定义在每种语言的 `messages/{locale}.json` 中的 `cards` 命名空间内。

---

## 10. 侧边栏布局重新设计

### 概述

重新设计 Agent 模式侧边栏，使系统设置（区域、模型选择等）可折叠，工作流部分放置在侧边栏顶部。

### 布局结构

KB 模式和 Agent 模式中，系统管理部分（区域、模型选择等）均可折叠。

### 新组件

| 组件 | 文件路径 | 角色 |
|-----------|----------|------|
| CollapsiblePanel | `docker/nextjs/src/components/ui/CollapsiblePanel.tsx` | 可折叠/展开面板。包裹系统设置部分 |
| WorkflowSection | `docker/nextjs/src/components/ui/WorkflowSection.tsx` | 工作流卡片列表。在 Agent 模式下显示在侧边栏顶部 |

---

## 11. 动态 Agent-卡片绑定

### 概述

点击卡片时搜索对应类别的 Agent，如果不存在则动态创建并绑定到卡片的功能。

### AGENT_CATEGORY_MAP（10 个类别）

定义卡片类别与 Agent 对应关系的映射。每个类别配置了 Agent 名称前缀、系统提示词和推荐模型。

| 类别 | Agent 名称前缀 | 用途 |
|----------|------------------|---------|
| financial | FinancialAnalysis | 财务报告分析和风险分析 |
| project | ProjectManagement | 项目进度和里程碑管理 |
| hr | HRPolicy | HR 政策和合规 |
| search | DocumentSearch | 跨文档搜索和数据分析 |
| presentation | PresentationDraft | 演示文稿创建 |
| approval | ApprovalDocument | 审批文档创建 |
| minutes | MeetingMinutes | 会议纪要创建 |
| report | ReportGeneration | 报告创建 |
| contract | ContractReview | 合同审查 |
| onboarding | OnboardingGuide | 入职 |

---

## 12. 输出导向工作流卡片

### 概述

将 Agent 模式卡片扩展为总共 14 张：8 张"研究"+ 6 张"输出"。输出卡片设计用于生成特定交付物（演示文稿、审批文档、会议纪要、报告、合同、入职材料）。

---

## 13. Citation 显示 — 文件路径显示和访问级别徽章

### 概述

CitationDisplay 组件（`docker/nextjs/src/components/chat/CitationDisplay.tsx`）在 RAG 搜索结果中显示每个源文档的 FSx 文件路径和访问级别徽章。

### 访问级别徽章

| `access_level` 值 | 徽章颜色 | 显示标签 | 含义 |
|---------------------|-------------|--------------|---------|
| `public` | 绿色 | 所有人可访问 | Everyone SID — 所有用户可访问 |
| `confidential` | 红色 | 仅管理员 | 仅 Domain Admins SID 可访问 |
| `restricted` | 黄色 | 特定组 | 特定组（例如 Engineering + Domain Admins） |
| 其他 / 未设置 | 黄色 | （原始值原样显示） | 未分类的访问级别 |

---

## 10. Agent Directory — Agent 管理界面

**最后更新**: 2026-03-29

### 概述

Agent Directory（`/[locale]/genai/agents`）是以目录格式列出和管理 Bedrock Agent 的专用界面。参考 Bedrock Engineer Agent Directory UX 模式设计。

### 导航栏

界面顶部显示三个标签。

| 标签 | 目标 | 说明 |
|-----|------------|-------------|
| Agent 模式 | `/genai?mode=agent` | Agent 模式卡片网格界面 |
| Agent 列表 | `/genai/agents` | Agent Directory（当前界面） |
| KB 模式 | `/genai` | KB 模式卡片网格界面 |

### Agent 列表（网格视图）

#### 搜索和过滤

| 功能 | 说明 |
|---------|-------------|
| 文本搜索 | 对 Agent 名称和描述进行不区分大小写的部分匹配搜索 |
| 类别过滤 | 10 个类别（financial、project、hr、search、presentation、approval、minutes、report、contract、onboarding）+ "全部" |

### Agent 详情面板

点击 Agent 卡片时显示的详情界面。

#### 操作按钮

| 按钮 | 行为 |
|--------|----------|
| 在聊天中使用 | 设置 `useAgentStore.selectedAgentId` 并导航到 `/genai?mode=agent` |
| 编辑 | 切换到内联编辑表单 |
| 导出 | 将 Agent 配置下载为 JSON 文件（当 `enableAgentSharing` 时） |
| 上传到共享存储桶 | 将 Agent 配置上传到 S3 共享存储桶（当 `enableAgentSharing` 时） |
| 创建计划 | 使用 EventBridge Scheduler 设置 cron 定期执行（当 `enableAgentSchedules` 时） |
| 删除 | 包含 Agent 名称的确认对话框 → 执行 Delete API |

### Agent 创建表单（从模板创建）

点击模板卡片上的"从模板创建"时显示，或在 Agent 模式中点击卡片时 Agent 尚未创建时显示。

---

## 11. 侧边栏 — 聊天历史设置

**最后更新**: 2026-03-29

### 概述

聊天历史保存设置作为独立部分显示在侧边栏中，KB 模式和 Agent 模式通用（放置在系统管理 CollapsiblePanel 上方）。

### 显示内容

| 状态 | 图标 | 文本 | 背景色 |
|-------|------|------|-----------------|
| 保存启用 | 💾 | "保存历史" + "自动保存" | 绿色（`bg-green-100`） |
| 保存禁用 | 🚫 | "历史已禁用" + "仅会话" | 灰色（`bg-gray-50`） |

---

## 12. 消息输入区域

**最后更新**: 2026-03-29

### 布局

```
[➕] [文本输入框                              ] [发送按钮]
```

| 元素 | 说明 |
|---------|-------------|
| ➕ 按钮 | 开始新的聊天会话。返回卡片网格 |
| 文本输入 | 消息输入。发送期间禁用 |
| 发送按钮 | 发送消息。输入为空或发送期间禁用 |

聊天期间，输入区域上方显示"🔄 返回工作流选择"链接。

---

## 14. 企业 Agent 功能（可选）

**最后更新**: 2026-03-30

### 概述

一组面向企业的 Agent 管理功能，可在 CDK 部署期间通过可选参数启用。

### 启用方式

```bash
# Enable Agent sharing feature
npx cdk deploy --all -c enableAgentSharing=true

# Enable Agent scheduled execution feature
npx cdk deploy --all -c enableAgentSchedules=true

# Enable both
npx cdk deploy --all -c enableAgent=true -c enableAgentSharing=true -c enableAgentSchedules=true
```

### 5 项功能

| # | 功能 | CDK 参数 | 额外资源 |
|---|---------|--------------|---------------------|
| 1 | Agent 工具选择 UI | 无（仅 UI 功能） | 无 |
| 2 | Guardrails UI 设置 | `enableGuardrails` | Bedrock Guardrail |
| 3 | 应用推理配置文件 | 无（仅 UI 功能） | 无 |
| 4 | 组织共享 | `enableAgentSharing` | S3 存储桶（`${prefix}-shared-agents`） |
| 5 | 后台 Agent | `enableAgentSchedules` | Lambda + DynamoDB + EventBridge Scheduler |

---

## 14. AD 登录 UI — SAML Federation 支持

### 概述

当启用 AD SAML federation（`enableAdFederation=true`）时，在登录页面添加"使用 AD 登录"按钮以支持通过 Cognito Hosted UI 的 SAML 流程。

### 显示条件

| 条件 | 显示内容 |
|-----------|----------------|
| 设置了 `COGNITO_DOMAIN` 环境变量 | "使用 AD 登录"按钮 + 现有邮箱/密码表单 |
| 未设置 `COGNITO_DOMAIN` 环境变量 | 仅现有邮箱/密码表单（向后兼容） |

### 多语言支持（8 种语言）

| 翻译键 | ja | en |
|----------------|----|----|
| `signin.adSignIn` | ADでサインイン | Sign in with AD |
| `signin.adSignInDesc` | Active Directory認証を使用 | Use Active Directory authentication |
| `signin.orDivider` | または | or |

---

## 图像上传 UI（高级 RAG 功能）

### ImageUploadZone

放置在聊天输入区域内的拖放区域和文件选择器按钮。

| 项目 | 规格 |
|------|--------------|
| 位置 | 聊天输入表单内，文本输入左侧 |
| 支持格式 | JPEG、PNG、GIF、WebP |
| 大小限制 | 3MB |

### ImageThumbnail

聊天消息气泡内的图像缩略图。

| 项目 | 规格 |
|------|--------------|
| 最大尺寸 | 200×200px，`object-contain` |
| 点击 | 在 ImageModal 中全尺寸显示 |

---

## Smart Routing UI（高级 RAG 功能）

### RoutingToggle

放置在侧边栏设置部分的 Smart Routing 开/关切换。

| 项目 | 规格 |
|------|--------------|
| 位置 | KB 模式侧边栏，ModelSelector 下方 |
| 切换 | `role="switch"`，`aria-checked` |
| 开启时 | 显示轻量模型名称 / 高性能模型名称对（蓝色背景） |
| 关闭时 | 不显示模型对 |
| 持久化 | localStorage（`smart-routing-enabled` 键） |
| 默认 | 关闭 |

### ResponseMetadata

助手消息下方的模型信息显示。

| 项目 | 规格 |
|------|--------------|
| 模型名称 | 可点击（弹出详情） |
| Auto 徽章 | 蓝色（`bg-blue-100`），Smart Routing 开启 + 自动选择时 |
| Manual 徽章 | 灰色（`bg-gray-100`），手动覆盖时 |
| 相机图标 | 📷，使用图像分析时 |
