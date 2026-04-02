# 聊天機器人 UI 規格

**🌐 Language:** [日本語](../ui-specification.md) | [English](../en/ui-specification.md) | [한국어](../ko/ui-specification.md) | [简体中文](../zh-CN/ui-specification.md) | **繁體中文** | [Français](../fr/ui-specification.md) | [Deutsch](../de/ui-specification.md) | [Español](../es/ui-specification.md)

**建立日期**: 2026-03-26  
**目標讀者**: 開發人員和運维人員  
**應用**: Permission-aware RAG Chatbot

---

## 概述

本文件描述了 RAG 聊天機器人各 UI 元素的規格及其與後端的整合。

---

## 1. 側邊欄 — 使用者資訊部分

### 顯示內容

| 项目 | 資料源 | 說明 |
|------|------------|-------------|
| 使用者名 | Cognito JWT | 登錄時的邮箱地址 |
| 角色 | Cognito JWT | `admin` 或 `user` |

### 存取權限顯示

| 项目 | 資料源 | 說明 |
|------|------------|-------------|
| 目錄 | `/api/fsx/directories` | 基於 SID 的可存取目錄 |
| 读取 | 同上 | SID 資料存在時為 `✅` |
| 写入 | 同上 | 僅当使用者拥有 Domain Admins SID 時為 `✅` |

### 可存取目錄的工作原理

Introduction Message 顯示三种類型的目錄資訊。

| 项目 | 圖標 | 資料源 | 說明 |
|------|------|------------|-------------|
| FSx 可存取目錄 | 📁 | DynamoDB SID → SID_DIRECTORY_MAP | FSx ONTAP 上文件級別可存取的目錄 |
| RAG 可搜尋目錄 | 🔍 | S3 `.metadata.json` 中的 SID 匹配 | KB 搜尋中 SID 匹配的文件目錄 |
| Embedding 目標目錄 | 📚 | S3 儲存桶中所有 `.metadata.json` | KB 中索引的所有目錄 |

#### 按使用者的顯示示例

| 使用者 | FSx 存取 | RAG 搜尋 | Embedding 目標 |
|------|-----------|---------|----------------|
| admin@example.com | `public/`、`confidential/`、`restricted/` | `public/`、`confidential/`、`restricted/` | `public/`、`confidential/`、`restricted/`（顯示） |
| user@example.com | `public/` | `public/` | 隐藏（出於安全考虑隐藏不可存取目錄的存在） |

Embedding 目標目錄不向普通使用者顯示（以避免暴露他们無法存取的目錄的存在）。📚 Embedding 目標目錄僅在 RAG 可搜尋目錄和 Embedding 目標目錄相同時顯示，如管理员的情况。

---

## 2. 側邊欄 — Bedrock 区域部分

### 顯示內容

| 项目 | 資料源 | 說明 |
|------|------------|-------------|
| 区網域名稱称 | `RegionConfigManager` | 所选区域的顯示名称 |
| 区域 ID | `regionStore` | 例如 `ap-northeast-1` |
| 模型数量 | `/api/bedrock/region-info` | 所选区域中可用模型的数量 |

---

## 3. AI 模型選擇部分

### 擷取模型列表

```
/api/bedrock/models (GET)
  ↓
ListFoundationModels API (byOutputModality=TEXT)
  ↓
透過 provider-patterns.ts 自動检测提供商
  ↓
回傳所有模型（包括 Unknown 提供商）
```

### 支援的提供商（13 個）

amazon、anthropic、cohere、deepseek、google、minimax、mistral、moonshot、nvidia、openai、qwen、twelvelabs、zai

### 退回鏈

```
選擇的模型 → （失敗） → apac.amazon.nova-lite-v1:0 → （失敗） → anthropic.claude-3-haiku-20240307-v1:0
```

当 Legacy 模型錯誤、按需不可用錯誤或 ValidationException 發生時自動尝试下一個模型。

---

## 4. 聊天区域 — Introduction Message

### 顯示內容

登錄後自動生成的初始訊息。

| 部分 | 內容 |
|---------|---------|
| 问候语 | 包含使用者名的欢迎訊息 |
| 存取權限 | 使用者名、角色、可存取目錄 |
| 環境類型 | 基於 SID / FSx 生产 / 模拟 |
| 權限詳情 | 读取 / 写入 / 執行可用性 |
| 可用功能 | 文件搜尋和问答、基於權限的存取控制 |

### 多語言支援

支援 8 种語言（ja、en、de、es、fr、ko、zh-CN、zh-TW）。翻译鍵定義在 `docker/nextjs/src/messages/{locale}.json` 的 `introduction` 部分。

---

## 5. 聊天区域 — RAG 搜尋流程

### 两阶段方法（Retrieve + Converse）

```
使用者問題
  ↓
/api/bedrock/kb/retrieve (POST)
  ↓
步骤 1：DynamoDB user-access → 擷取使用者 SID
  ↓
步骤 2：Bedrock KB Retrieve API → 向量搜尋（带元資料）
  ↓
步骤 3：SID 過濾
  - 將文件的 allowed_group_sids 與使用者 SID 匹配
  - 匹配 → ALLOW，不匹配 → DENY
  ↓
步骤 4：Converse API → 僅使用允许的文件生成回應
  ↓
回傳回應 + Citation + filterLog
```

### 為什么不使用 RetrieveAndGenerate API

RetrieveAndGenerate API 不會在 Citation 的 `metadata` 字段中包含 `.metadata.json` 中的 `allowed_group_sids`。由於 Retrieve API 正确回傳元資料，因此采用两阶段方法。

### 前端退回

如果 KB Retrieve API 回傳 500 錯誤，前端退回到常規 Bedrock Chat API（`/api/bedrock/chat`）。在這种情况下，回傳不引用 KB 文件的通用 AI 回應。

---

## 6. API 列表

| 端點 | 方法 | 說明 |
|----------|--------|-------------|
| `/api/bedrock/kb/retrieve` | POST | RAG 搜尋 + SID 過濾 + 回應生成 |
| `/api/bedrock/chat` | POST | 常規聊天（無 KB，用於退回） |
| `/api/bedrock/models` | GET | 可用模型列表 |
| `/api/bedrock/region-info` | GET | 区域資訊 + 模型数量 |
| `/api/bedrock/change-region` | POST | 更改区域（Cookie 更新） |
| `/api/fsx/directories` | GET | 使用者的可存取目錄（基於 SID） |
| `/api/auth/signin` | POST | Cognito 認证 |
| `/api/auth/session` | GET | 會話資訊 |
| `/api/auth/signout` | POST | 退出登錄 |
| `/api/health` | GET | 健康檢查 |

---

## 7. 環境變數

為 Lambda 函式設定的環境變數。

| 變數名 | 說明 | 示例 |
|--------------|-------------|---------|
| `DATA_BUCKET_NAME` | KB 資料源 S3 儲存桶名称 | `perm-rag-demo-demo-kb-data-${ACCOUNT_ID}` |
| `BEDROCK_KB_ID` | Knowledge Base ID | `3ZZMK6YA0Q` |
| `BEDROCK_REGION` | Bedrock 区域 | `ap-northeast-1` |
| `USER_ACCESS_TABLE_NAME` | DynamoDB user-access 表名 | `perm-rag-demo-demo-user-access` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxx` |
| `ENABLE_PERMISSION_CHECK` | 啟用權限檢查 | `true` |

---

## 8. KB/Agent 模式切換

### 概述

在头部放置 KB/Agent 模式切換，允许在两种模式之间無缝切換。

### 模式切換机制

| 项目 | 說明 |
|------|-------------|
| 切換位置 | 头部標题右侧 |
| 狀態管理 | `useState` + URL 參數（`?mode=agent`） |
| 持久化 | 透過 URL 參數持久化（可收藏） |
| 預設 | KB 模式（無 `?mode` 參數） |

### 按模式的行為

| 功能 | KB 模式 | Agent 模式 |
|---------|---------|------------|
| 側邊欄 | KBModeSidebar（内联） | AgentModeSidebar（組件） |
| 模型列表 | `/api/bedrock/region-info`（所有模型） | `/api/bedrock/agent-models`（僅 Agent 相容模型） |
| 聊天 API | `/api/bedrock/kb/retrieve` | `/api/bedrock/kb/retrieve`（带 `agentMode=true` 標志） |
| SID 過濾 | ✅ 是 | ✅ 是（混合方法） |
| 头部徽章 | 📚 Knowledge Base（蓝色） | 🤖 Agent（紫色） |

### Agent 模式混合方法

Agent 模式采用混合方法實現 Permission-aware RAG。

```
使用者問題
  │
  ▼
KB Retrieve API（向量搜尋）
  │
  ▼
SID 過濾（與 KB 模式相同的管道）
  │ 使用者 SID ∩ 文件 SID → 允许/拒绝
  ▼
僅允许的文件作為上下文
  │
  ▼
Converse API（带 Agent 系統提示词）
  ▼
回應 + Citation 顯示
```

---

## 9. 基於卡片的任务导向 UI

### 概述

在聊天区域的初始狀態（無使用者訊息時）顯示卡片网格的功能。KB 模式顯示 14 张用途特定的卡片（文件搜尋、摘要建建等），Agent 模式顯示 14 张工作流卡片（财务分析、项目管理、演示文稿建建等），允许使用者一鍵输入提示词。

### 組件结構

| 組件 | 文件路径 | 角色 |
|-----------|----------|------|
| CardGrid | `docker/nextjs/src/components/cards/CardGrid.tsx` | 主容器。整合 InfoBanner、CategoryFilter 和 TaskCard |
| TaskCard | `docker/nextjs/src/components/cards/TaskCard.tsx` | 單個卡片組件（KB/Agent 共享） |
| InfoBanner | `docker/nextjs/src/components/cards/InfoBanner.tsx` | 權限資訊横幅（可摺疊/展開） |
| CategoryFilter | `docker/nextjs/src/components/cards/CategoryFilter.tsx` | 類別過濾芯片 |

### KB 模式卡片列表（14 张）

#### 研究類別（8 张）

| ID | 圖標 | 類別 | 用途 |
|----|------|---------|---------|
| `kb-doc-search` | 🔍 | search | 文件搜尋 |
| `kb-doc-summary` | 📝 | summary | 摘要建建 |
| `kb-quiz-gen` | 📚 | learning | 测验生成 |
| `kb-compare` | ⚖️ | analysis | 比较分析 |
| `kb-keyword-search` | 🏷️ | search | 關鍵词搜尋 |
| `kb-report-summary` | 📊 | summary | 报告摘要 |
| `kb-qa-gen` | ❓ | learning | 问答生成 |
| `kb-trend-analysis` | 📈 | analysis | 趋势分析 |

#### 输出類別（6 张）

| ID | 圖標 | 類別 | 用途 |
|----|------|---------|---------|
| `kb-presentation` | 🎬 | output | 演示文稿建建 |
| `kb-approval` | 📋 | output | 审批文件建建 |
| `kb-minutes` | 🗒️ | output | 會议纪要建建 |
| `kb-report-gen` | 📑 | output | 自動报告生成 |
| `kb-contract` | 📄 | output | 合同审查 |
| `kb-onboarding` | 🎓 | output | 入职材料 |

#### Agent 模式卡片列表（14 张）

##### 研究類別（8 张）

| ID | 圖標 | 類別 | 用途 |
|----|------|---------|---------|
| `agent-financial` | 📊 | financial | 财务报告分析 |
| `agent-project` | 📝 | project | 项目進度檢查 |
| `agent-cross-search` | 🔍 | search | 跨文件搜尋 |
| `agent-hr` | 📋 | hr | HR 政策檢查 |
| `agent-risk` | ⚠️ | financial | 风险分析 |
| `agent-milestone` | 🎯 | project | 里程碑管理 |
| `agent-compliance` | 🔐 | hr | 合規檢查 |
| `agent-data-analysis` | 📉 | search | 資料分析 |

##### 输出類別（6 张）

| ID | 圖標 | 類別 | 用途 |
|----|------|---------|---------|
| `agent-presentation` | 📊 | presentation | 演示文稿建建 |
| `agent-approval` | 📋 | approval | 审批文件建建 |
| `agent-minutes` | 📝 | minutes | 會议纪要建建 |
| `agent-report` | 📈 | report | 报告建建 |
| `agent-contract` | 📄 | contract | 合同审查 |
| `agent-onboarding` | 🎓 | onboarding | 入职材料建建 |

### 顯示條件

CardGrid 顯示由使用者訊息的存在控制。

| 條件 | 顯示內容 |
|-----------|----------------|
| 無使用者訊息（`messages` 中 `role === 'user'` 的条目為 0） | 顯示 CardGrid |
| 存在使用者訊息（`role === 'user'` 有 1 個或更多条目） | 正常訊息列表顯示 + "🔄 回傳工作流選擇"按钮 |
| 點击"新聊天"按钮 | 建建新會話 → 重新顯示 CardGrid |
| 點击"🔄 回傳工作流選擇"按钮 | 建建新會話 → 重新顯示 CardGrid |

### 收藏管理

| 项目 | 說明 |
|------|-------------|
| 持久化方式 | Zustand `persist` 中间件 + localStorage |
| localStorage 鍵 | `card-favorites-storage` |
| 退回 | localStorage 不可用時僅内存（會話期间保留） |
| 排序行為 | 收藏卡片顯示在网格顶部。每組内的相對顺序保持不变 |

### 類別過濾

#### KB 模式類別

| 類別 ID | 顯示名称 |
|------------|-------------------|
| `all` | 全部 |
| `search` | 搜尋 |
| `summary` | 摘要 |
| `learning` | 学习 |
| `analysis` | 分析 |
| `output` | 文件建建 |

#### Agent 模式類別

| 類別 ID | 顯示名称 |
|------------|-------------------|
| `all` | 全部 |
| `financial` | 财务 |
| `project` | 项目 |
| `hr` | 人力資源 |
| `search` | 搜尋 |
| `presentation` | 文件建建 |
| `approval` | 审批 |
| `minutes` | 纪要 |
| `report` | 报告 |
| `contract` | 合同 |
| `onboarding` | 入职 |

### InfoBanner

將現有 Introduction Text 資訊整合為紧凑的横幅。

#### 摺疊狀態（預設）

單行顯示：`使用者名 | 角色 | 📁 可存取 N 個目錄`

#### 展開狀態

| 顯示项目 | 說明 |
|-------------|-------------|
| 使用者名 | Cognito JWT 中的邮箱地址 |
| 角色 | `admin` 或 `user` |
| SID | 使用者的安全標識符 |
| 目錄列表 | 三种類型：FSx / RAG / Embedding |
| 權限詳情 | 读取 ✅/❌、写入 ✅/❌、執行 ✅/❌ |

### 翻译

支援所有 8 种語言。翻译鍵定義在每种語言的 `messages/{locale}.json` 中的 `cards` 命名空间内。

---

## 10. 側邊欄佈局重新設計

### 概述

重新設計 Agent 模式側邊欄，使系統設定（区域、模型選擇等）可摺疊，工作流部分放置在側邊欄顶部。

### 佈局结構

KB 模式和 Agent 模式中，系統管理部分（区域、模型選擇等）均可摺疊。

### 新組件

| 組件 | 文件路径 | 角色 |
|-----------|----------|------|
| CollapsiblePanel | `docker/nextjs/src/components/ui/CollapsiblePanel.tsx` | 可摺疊/展開面板。包裹系統設定部分 |
| WorkflowSection | `docker/nextjs/src/components/ui/WorkflowSection.tsx` | 工作流卡片列表。在 Agent 模式下顯示在側邊欄顶部 |

---

## 11. 動态 Agent-卡片绑定

### 概述

點击卡片時搜尋對应類別的 Agent，如果不存在則動态建建並绑定到卡片的功能。

### AGENT_CATEGORY_MAP（10 個類別）

定義卡片類別與 Agent 對应關系的映射。每個類別設定了 Agent 名称前缀、系統提示词和推荐模型。

| 類別 | Agent 名称前缀 | 用途 |
|----------|------------------|---------|
| financial | FinancialAnalysis | 财务报告分析和风险分析 |
| project | ProjectManagement | 项目進度和里程碑管理 |
| hr | HRPolicy | HR 政策和合規 |
| search | DocumentSearch | 跨文件搜尋和資料分析 |
| presentation | PresentationDraft | 演示文稿建建 |
| approval | ApprovalDocument | 审批文件建建 |
| minutes | MeetingMinutes | 會议纪要建建 |
| report | ReportGeneration | 报告建建 |
| contract | ContractReview | 合同审查 |
| onboarding | OnboardingGuide | 入职 |

---

## 12. 输出导向工作流卡片

### 概述

將 Agent 模式卡片擴展為总共 14 张：8 张"研究"+ 6 张"输出"。输出卡片設計用於生成特定交付物（演示文稿、审批文件、會议纪要、报告、合同、入职材料）。

---

## 13. Citation 顯示 — 文件路径顯示和存取級別徽章

### 概述

CitationDisplay 組件（`docker/nextjs/src/components/chat/CitationDisplay.tsx`）在 RAG 搜尋結果中顯示每個源文件的 FSx 文件路径和存取級別徽章。

### 存取級別徽章

| `access_level` 值 | 徽章颜色 | 顯示標签 | 含义 |
|---------------------|-------------|--------------|---------|
| `public` | 绿色 | 所有人可存取 | Everyone SID — 所有使用者可存取 |
| `confidential` | 红色 | 僅管理员 | 僅 Domain Admins SID 可存取 |
| `restricted` | 黄色 | 特定組 | 特定組（例如 Engineering + Domain Admins） |
| 其他 / 未設定 | 黄色 | （原始值原样顯示） | 未分類的存取級別 |

---

## 10. Agent Directory — Agent 管理界面

**最後更新**: 2026-03-29

### 概述

Agent Directory（`/[locale]/genai/agents`）是以目錄格式列出和管理 Bedrock Agent 的专用界面。参考 Bedrock Engineer Agent Directory UX 模式設計。

### 导航栏

界面顶部顯示三個標签。

| 標签 | 目標 | 說明 |
|-----|------------|-------------|
| Agent 模式 | `/genai?mode=agent` | Agent 模式卡片网格界面 |
| Agent 列表 | `/genai/agents` | Agent Directory（目前界面） |
| KB 模式 | `/genai` | KB 模式卡片网格界面 |

### Agent 列表（网格视圖）

#### 搜尋和過濾

| 功能 | 說明 |
|---------|-------------|
| 文本搜尋 | 對 Agent 名称和描述進行不区分大小写的部分匹配搜尋 |
| 類別過濾 | 10 個類別（financial、project、hr、search、presentation、approval、minutes、report、contract、onboarding）+ "全部" |

### Agent 詳情面板

點击 Agent 卡片時顯示的詳情界面。

#### 操作按钮

| 按钮 | 行為 |
|--------|----------|
| 在聊天中使用 | 設定 `useAgentStore.selectedAgentId` 並导航到 `/genai?mode=agent` |
| 編輯 | 切換到内联編輯表單 |
| 匯出 | 將 Agent 設定下載為 JSON 文件（当 `enableAgentSharing` 時） |
| 上傳到共享儲存桶 | 將 Agent 設定上傳到 S3 共享儲存桶（当 `enableAgentSharing` 時） |
| 建建计划 | 使用 EventBridge Scheduler 設定 cron 定期執行（当 `enableAgentSchedules` 時） |
| 刪除 | 包含 Agent 名称的確認對話框 → 執行 Delete API |

### Agent 建建表單（從模板建建）

點击模板卡片上的"從模板建建"時顯示，或在 Agent 模式中點击卡片時 Agent 尚未建建時顯示。

---

## 11. 側邊欄 — 聊天歷史設定

**最後更新**: 2026-03-29

### 概述

聊天歷史儲存設定作為獨立部分顯示在側邊欄中，KB 模式和 Agent 模式通用（放置在系統管理 CollapsiblePanel 上方）。

### 顯示內容

| 狀態 | 圖標 | 文本 | 背景色 |
|-------|------|------|-----------------|
| 儲存啟用 | 💾 | "儲存歷史" + "自動儲存" | 绿色（`bg-green-100`） |
| 儲存停用 | 🚫 | "歷史已停用" + "僅會話" | 灰色（`bg-gray-50`） |

---

## 12. 訊息输入区域

**最後更新**: 2026-03-29

### 佈局

```
[➕] [文本输入框                              ] [發送按钮]
```

| 元素 | 說明 |
|---------|-------------|
| ➕ 按钮 | 開始新的聊天會話。回傳卡片网格 |
| 文本输入 | 訊息输入。發送期间停用 |
| 發送按钮 | 發送訊息。输入為空或發送期间停用 |

聊天期间，输入区域上方顯示"🔄 回傳工作流選擇"鏈接。

---

## 14. 企业 Agent 功能（可选）

**最後更新**: 2026-03-30

### 概述

一組面向企业的 Agent 管理功能，可在 CDK 部署期间透過可选參數啟用。

### 啟用方式

```bash
# Enable Agent sharing feature
npx cdk deploy --all -c enableAgentSharing=true

# Enable Agent scheduled execution feature
npx cdk deploy --all -c enableAgentSchedules=true

# Enable both
npx cdk deploy --all -c enableAgent=true -c enableAgentSharing=true -c enableAgentSchedules=true
```

### 5 项功能

| # | 功能 | CDK 參數 | 额外資源 |
|---|---------|--------------|---------------------|
| 1 | Agent 工具選擇 UI | 無（僅 UI 功能） | 無 |
| 2 | Guardrails UI 設定 | `enableGuardrails` | Bedrock Guardrail |
| 3 | 應用推理設定文件 | 無（僅 UI 功能） | 無 |
| 4 | 組織共享 | `enableAgentSharing` | S3 儲存桶（`${prefix}-shared-agents`） |
| 5 | 後台 Agent | `enableAgentSchedules` | Lambda + DynamoDB + EventBridge Scheduler |

---

## 14. AD 登錄 UI — SAML Federation 支援

### 概述

当啟用 AD SAML federation（`enableAdFederation=true`）時，在登錄页面添加"使用 AD 登錄"按钮以支援透過 Cognito Hosted UI 的 SAML 流程。

### 顯示條件

| 條件 | 顯示內容 |
|-----------|----------------|
| 設定了 `COGNITO_DOMAIN` 環境變數 | "使用 AD 登錄"按钮 + 現有邮箱/密码表單 |
| 未設定 `COGNITO_DOMAIN` 環境變數 | 僅現有邮箱/密码表單（向後相容） |

### 多語言支援（8 种語言）

| 翻译鍵 | ja | en |
|----------------|----|----|
| `signin.adSignIn` | ADでサインイン | Sign in with AD |
| `signin.adSignInDesc` | Active Directory認証を使用 | Use Active Directory authentication |
| `signin.orDivider` | または | or |

---

## 圖像上傳 UI（高級 RAG 功能）

### ImageUploadZone

放置在聊天输入区域内的拖放区域和文件選擇器按钮。

| 项目 | 規格 |
|------|--------------|
| 位置 | 聊天输入表單内，文本输入左侧 |
| 支援格式 | JPEG、PNG、GIF、WebP |
| 大小限制 | 3MB |

### ImageThumbnail

聊天訊息气泡内的圖像缩略圖。

| 项目 | 規格 |
|------|--------------|
| 最大尺寸 | 200×200px，`object-contain` |
| 點击 | 在 ImageModal 中全尺寸顯示 |

---

## Smart Routing UI（高級 RAG 功能）

### RoutingToggle

放置在側邊欄設定部分的 Smart Routing 開/關切換。

| 项目 | 規格 |
|------|--------------|
| 位置 | KB 模式側邊欄，ModelSelector 下方 |
| 切換 | `role="switch"`，`aria-checked` |
| 開启時 | 顯示轻量模型名称 / 高效能模型名称對（蓝色背景） |
| 關闭時 | 不顯示模型對 |
| 持久化 | localStorage（`smart-routing-enabled` 鍵） |
| 預設 | 關闭 |

### ResponseMetadata

助手訊息下方的模型資訊顯示。

| 项目 | 規格 |
|------|--------------|
| 模型名称 | 可點击（弹出詳情） |
| Auto 徽章 | 蓝色（`bg-blue-100`），Smart Routing 開启 + 自動選擇時 |
| Manual 徽章 | 灰色（`bg-gray-100`），手動覆盖時 |
| 相机圖標 | 📷，使用圖像分析時 |
