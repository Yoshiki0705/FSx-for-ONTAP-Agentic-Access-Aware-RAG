# Permission-Aware RAG 系統 — 實現概述

**🌐 Language:** [日本語](../implementation-overview.md) | [English](../en/implementation-overview.md) | [한국어](../ko/implementation-overview.md) | [简体中文](../zh-CN/implementation-overview.md) | **繁體中文** | [Français](../fr/implementation-overview.md) | [Deutsch](../de/implementation-overview.md) | [Español](../es/implementation-overview.md)

**建立日期**: 2026-03-25  
**版本**: 3.3.0

---

## 概述

本系統是一個結合 Amazon FSx for NetApp ONTAP 和 Amazon Bedrock 的 RAG（檢索增強生成）聊天機器人系統，提供基於文件存取權限（SID）的過濾功能。它將每個使用者的 NTFS ACL 資訊作為元資料管理，並在搜尋時實時過濾結果，實現安全的文件檢索和 AI 驅動的答案生成。

所有基礎設施使用 AWS CDK（TypeScript）定義，可透過 `npx cdk deploy --all` 一次性部署。

---

## 1. 聊天機器人應用 — Next.js RAG Chatbot on AWS Lambda

### 實現詳情

使用 Next.js 15（App Router）建構的 RAG 聊天機器人應用透過 AWS Lambda Web Adapter 實現無服务器執行。

### 架構

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js (standalone)
```

### 技术堆積疊

| 层 | 技术 |
|-------|-----------|
| 框架 | Next.js 15（App Router，standalone 输出） |
| UI | React 18 + Tailwind CSS |
| 認证 | Amazon Cognito（JWT） |
| AI/RAG | Amazon Bedrock Knowledge Base Retrieve API + Converse API |
| 運行時 | Lambda Web Adapter（Rust）+ Docker 容器 |
| CDN | Amazon CloudFront |

### 主要功能

- **RAG 搜尋**：透過 Bedrock Knowledge Base 執行向量搜尋，生成引用相關文件的答案
- **SID 過濾**：基於使用者 SID 資訊過濾搜尋結果（详見第 7 節）
- **KB/Agent 模式切換**：透過头部切換在 KB 模式（文件搜尋）和 Agent 模式（多步推理）之间切換
- **基於卡片的任务导向 UI**：在開始聊天前，KB 模式顯示用途特定的卡片（文件搜尋、摘要建建、测验生成等），Agent 模式顯示工作流卡片（财务分析、项目管理等）的网格佈局。支援收藏管理和類別過濾
- **Agent 模式（InvokeAgent API）**：透過 Bedrock Agent + Permission-aware Action Group 實現带 SID 過濾的多步推理。Agent 呼叫失敗時退回到 KB 混合模式
- **多語言支援**：8 种語言 — 日语、英语、韩语、中文（簡體/繁體）、法语、德语和西班牙语
- **Citation 顯示**：顯示作為答案依据的文件來源資訊
- **Cognito 認证**：登錄/退出和會話管理

### CDK 堆積堆積疊

`DemoWebAppStack`（`lib/stacks/demo/demo-webapp-stack.ts`）建建以下資源：
- Lambda DockerImageFunction（ECR 映像，1024MB 内存，30 秒超時）
- Lambda Function URL（IAM 認证）
- CloudFront Distribution（OAC + 地理限制 + WAF 整合）
- CloudFront 存取日誌的 S3 儲存桶

---

## 2. AWS WAF — 透過 IP 和地理資訊進行防护

### 實現詳情

為 CloudFront 部署在 `us-east-1` 的 WAFv2 WebACL，透過多個安全規則保护應用。

### WAF 規則設定（按优先級）

| 优先級 | 規則名称 | 類型 | 說明 |
|----------|-----------|------|-------------|
| 100 | RateLimit | 自訂 | 5 分钟内每個 IP 超過 3,000 個請求時阻止 |
| 200 | AWSIPReputationList | AWS 托管 | 阻止來自僵尸網路、DDoS 源等的恶意 IP |
| 300 | AWSCommonRuleSet | AWS 托管 | OWASP Top 10 合規（XSS、LFI、RFI 等）。為 RAG 相容性排除了部分規則 |
| 400 | AWSKnownBadInputs | AWS 托管 | 阻止利用已知漏洞（如 Log4j）的請求 |
| 500 | AWSSQLiRuleSet | AWS 托管 | 检测並阻止 SQL 注入攻击模式 |
| 600 | IPAllowList | 自訂（可选） | 僅在設定 `allowedIps` 時激活。阻止不在列表中的 IP |

### 地理限制

在 CloudFront 級別應用地理存取限制（預設：僅日本）。

### CDK 堆積堆積疊

`DemoWafStack`（`lib/stacks/demo/demo-waf-stack.ts`）建建以下資源：
- WAFv2 WebACL（CLOUDFRONT 範圍，`us-east-1`）
- IP Set（設定 `allowedIps` 時）

### 設定

透過 `cdk.context.json` 控制：
```json
{
  "allowedIps": ["203.0.113.0/24"],
  "allowedCountries": ["JP", "US"]
}
```

---

## 3. IAM 認证 — Lambda Function URL IAM Auth + CloudFront OAC

### 實現詳情

在 Lambda Function URL 上設定 IAM 認证（`AWS_IAM`），CloudFront Origin Access Control（OAC）透過 SigV4 簽署提供源存取控制。

### 認证流程

```
Browser
  │
  ▼
CloudFront (OAC: 自動添加 SigV4 簽署)
  │
  ▼
Lambda Function URL (AuthType: AWS_IAM)
  │ → 驗證 SigV4 簽署
  │ → 僅允许來自 CloudFront 的請求
  ▼
Next.js Application
  │
  ▼
Cognito JWT 驗證（應用級認证）
```

### 安全层

| 层 | 技术 | 目的 |
|-------|-----------|---------|
| L1: 網路 | CloudFront 地理限制 | 地理存取限制 |
| L2: WAF | AWS WAF | 攻击模式检测和阻止 |
| L3: 源認证 | OAC（SigV4） | 防止绕過 CloudFront 的直接存取 |
| L4: API 認证 | Lambda Function URL IAM Auth | 透過 IAM 認证進行存取控制 |
| L5: 使用者認证 | Cognito JWT | 使用者級認证和授權 |
| L6: 資料授權 | SID 過濾 | 文件級存取控制 |

### CDK 實現

在 `DemoWebAppStack` 中：
- 使用 `lambda.FunctionUrlAuthType.AWS_IAM` 建建 Function URL
- 使用 `cloudfront.CfnOriginAccessControl` 建建 OAC（`signingBehavior: 'always'`）
- 使用 L1 escape hatch 將 OAC 關联到 Distribution

### 部署後注意事项

上述 IAM 認证 + OAC 設定推荐用於生产環境。但是，如果在驗證環境中出現 POST 請求（聊天等）的相容性問題，可能需要以下手動调整：
- 將 Lambda Function URL AuthType 更改為 `NONE`
- 移除 CloudFront OAC 關联

---

## 4. 向量資料庫 — S3 Vectors / Amazon OpenSearch Serverless

### 實現詳情

用於 RAG 搜尋的向量資料庫可透過 CDK context 參數 `vectorStoreType` 選擇：
- **S3 Vectors**（預設）：低成本，亚秒級延遲。直接用作 Bedrock KB 的向量儲存
- **Amazon OpenSearch Serverless（AOSS）**：高效能（约 10ms），高成本（约 $700/月）

### 設計决策

選擇 S3 Vectors 作為預設的原因：
- 成本為每月几美元（小規模），與 OpenSearch Serverless 的约 $700/月相比显著降低
- 作為 Bedrock KB 的向量儲存原生支援
- 支援元資料過濾（`$eq`、`$in`、`$and`、`$or`）
- 需要高效能時可從 S3 Vectors 一鍵匯出到 AOSS

選擇 AOSS 時的對比：

| 方面 | S3 Vectors | AOSS | Aurora Serverless v2 (pgvector) |
|--------|-----------|------|------|
| Bedrock KB 整合 | 原生支援 | 原生支援 | 需要自訂整合 |
| 成本 | 几美元/月（按使用量付费） | 约 $700/月（最少 2 個 OCU） | 取决於實例成本 |
| 延遲 | 亚秒級到 100ms | 约 10ms | 约 10ms |
| 元資料搜尋 | 支援過濾運算符 | 儲存在文本字段中 | 透過 SQL 查询灵活搜尋 |
| 運维開销 | 無服务器（自動擴展） | 需要容量管理 |
| 成本 | 基於搜尋量按使用量付费 | 適用最低 ACU 费用 |
| 元資料搜尋 | 儲存在文本字段中 | 透過 SQL 查询灵活搜尋 |

### 向量儲存設定

S3 Vectors 設定（預設）：
- S3 Vectors 向量儲存桶 + 向量索引（1024 维，cosine）
- 透過自訂資源 Lambda 建建（CloudFormation 不支援）

AOSS 設定（`vectorStoreType=opensearch-serverless`）：

| 資源 | 說明 |
|----------|-------------|
| Collection | `VECTORSEARCH` 類型，加密政策（AWS 拥有的密钥） |
| Network Policy | 公共存取（用於從 Bedrock KB API 存取） |
| Data Access Policy | KB IAM 角色 + 索引建建 Lambda + Embedding EC2 角色 |
| Index | `bedrock-knowledge-base-default-index`（knn_vector 1024 维，HNSW/faiss/l2） |

### 索引映射

```json
{
  "bedrock-knowledge-base-default-vector": { "type": "knn_vector", "dimension": 1024 },
  "AMAZON_BEDROCK_TEXT_CHUNK": { "type": "text" },
  "AMAZON_BEDROCK_METADATA": { "type": "text", "index": false }
}
```

### CDK 堆積堆積疊

`DemoAIStack`（`lib/stacks/demo/demo-ai-stack.ts`）建建以下資源：
- `vectorStoreType=s3vectors`：S3 Vectors 向量儲存桶 + 索引（自訂資源 Lambda）
- `vectorStoreType=opensearch-serverless`：OpenSearch Serverless 集合 + 安全政策（加密、網路、資料存取）
- 自動索引建建的自訂資源 Lambda
- Bedrock Knowledge Base + S3 資料源

---

## 5. Embedding 服务器 — FSx ONTAP CIFS 掛載 + 向量資料庫写入

### 實現詳情

在透過 CIFS/SMB 掛載 Amazon FSx for NetApp ONTAP 卷的 EC2 實例上，Docker 容器读取文件、向量化並索引到 OpenSearch Serverless（AOSS）。S3 Vectors 設定下不使用（僅 AOSS 設定）。

### 資料摄取路径概述

| 路径 | 方法 | CDK 激活方式 | 狀態 |
|------|--------|---------------|--------|
| 选项 A（預設） | S3 儲存桶 → Bedrock KB S3 資料源 | 始终啟用 | ✅ |
| 选项 B（可选） | Embedding 服务器（CIFS 掛載）→ 直接向量儲存写入 | `-c enableEmbeddingServer=true` | ✅（僅 AOSS 設定） |
| 选项 C（可选） | S3 Access Point → Bedrock KB | 部署後手動設定 | ✅ SnapMirror 支援，FlexCache 即將支援 |

> **關於 S3 Access Point**：StorageStack 自動為 FSx ONTAP 卷建立 S3 Access Point。根據卷的安全樣式（NTFS/UNIX）和 AD 加入狀態，將建立 WINDOWS 或 UNIX 使用者類型的 S3 AP。可透過 CDK 上下文參數 `volumeSecurityStyle`、`s3apUserType`、`s3apUserName` 進行明確控制。

#### S3 Access Point 使用者類型設計

| 模式 | 使用者類型 | 使用者來源 | 卷 Style | 條件 |
|------|----------|----------|---------|------|
| A | WINDOWS | 現有 AD 使用者（Admin） | NTFS/UNIX | 已加入 AD 的 SVM（推薦：NTFS 環境） |
| B | WINDOWS | 新建專用 AD 使用者 | NTFS/UNIX | 已加入 AD 的 SVM + 最小權限 |
| C | UNIX | 現有 UNIX 使用者（root） | UNIX | 未加入 AD（推薦：UNIX 環境） |
| D | UNIX | 新建專用 UNIX 使用者 | UNIX | 未加入 AD + 最小權限 |

SID 過濾在所有模式中使用相同邏輯（基於 `.metadata.json` 中繼資料），不依賴於卷的安全樣式或 S3 AP 使用者類型。

### 處理流程

1. 遞迴扫描 CIFS 掛載的目錄（`.md`、`.txt`、`.html` 等文本文件）
2. 從每個文件的 `.metadata.json` 读取 SID 資訊（`allowed_group_sids`）
   - 如果 `.metadata.json` 不存在且 `ENV_AUTO_METADATA=true`，則透過 ONTAP REST API（`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`）自動擷取 ACL，提取 SID 並自動生成 `.metadata.json`
3. 將文本分割為 1,000 字符的块（200 字符重叠）
4. 使用 Amazon Bedrock Titan Embed Text v2 生成 1024 维向量
5. 以 Bedrock KB 相容格式索引到 AOSS（`AMAZON_BEDROCK_TEXT_CHUNK` + `AMAZON_BEDROCK_METADATA`）
6. 在 `processed.json` 中記錄已處理的文件（支援增量處理）

### 執行模式

| 模式 | 說明 | 設定 |
|------|-------------|---------------|
| 批處理模式 | 處理所有文件一次後退出 | `ENV_WATCH_MODE=false`（預設） |
| 监视模式 | 检测文件变更並自動處理 | `ENV_WATCH_MODE=true` |

在监视模式下，使用 `chokidar` 库實時检测文件系統变更（添加/更新）並自動執行向量化和索引。對於定時執行，也可以透過 EventBridge Scheduler 或 cron 定期启動批處理模式容器。

---

## 6. Amazon Titan Text Embeddings — 向量化模型

### 實現詳情

使用 `amazon.titan-embed-text-v2:0` 進行文件向量化。

### 模型規格

| 项目 | 值 |
|------|-------|
| 模型 ID | `amazon.titan-embed-text-v2:0` |
| 向量維度 | 1024 |
| 最大输入长度 | 8,000 字符 |
| 归一化 | 啟用（`normalize: true`） |

### 使用場景

| 組件 | 用途 |
|-----------|---------|
| Bedrock Knowledge Base | 從 S3 資料源摄取文件時的向量化 |
| Embedding 服务器 | CIFS 掛載文件的向量化（`docker/embed/src/index.ts`） |

---

## 7. SID 元資料 + 權限過濾

### 實現詳情

在向量化文件時，基於文件 NTFS ACL 的 SID（安全標識符）資訊作為元資料附加在 `.metadata.json` 文件中。在聊天界面中，將登錄使用者的 SID 與每個文件的 SID 進行比较，僅將 SID 匹配的文件包含在搜尋結果中。

### 什么是 SID？

SID（安全標識符）是 Windows/NTFS 中安全主體（使用者、組）的唯一標識符。

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
```

| SID | 名称 | 說明 |
|-----|------|-------------|
| `S-1-1-0` | Everyone | 所有使用者 |
| `S-1-5-21-...-512` | Domain Admins | 域管理员組 |
| `S-1-5-21-...-1001` | User | 普通使用者 |

### 文件到 SID 的映射

| 目錄 | 存取級別 | allowed_group_sids | 管理员 | 普通使用者 |
|-----------|-------------|-------------------|-------|-------------|
| `public/` | 公開 | `S-1-1-0`（Everyone） | ✅ 允许 | ✅ 允许 |
| `confidential/` | 机密 | `...-512`（Domain Admins） | ✅ 允许 | ❌ 拒绝 |
| `restricted/` | 受限 | `...-1100`（Engineering）+ `...-512`（DA） | ✅ 允许 | ❌ 拒绝 |

### 過濾處理流程（两阶段方法）

使用 Retrieve API 的原因：RetrieveAndGenerate API 不回傳 Citation 元資料（`allowed_group_sids`），因此 SID 過濾無法工作。Retrieve API 正确回傳元資料，因此采用两阶段方法（Retrieve → SID 過濾 → Converse）。

### Fail-Closed 退回

權限檢查失敗時，拒绝所有文件的存取。

| 情况 | 行為 |
|-----------|----------|
| DynamoDB 連接錯誤 | 拒绝所有文件 |
| 無使用者 SID 記錄 | 拒绝所有文件 |
| 元資料中無 SID 資訊 | 拒绝對应文件 |
| SID 不匹配 | 拒绝對应文件 |
| SID 匹配 | 允许對应文件 |

### 實現文件

| 文件 | 角色 |
|------|------|
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | KB 搜尋 API + SID 過濾整合（Lambda/内联切換支援） |
| `lambda/permissions/metadata-filter-handler.ts` | 基於元資料的權限過濾 Lambda（透過 `-c usePermissionFilterLambda=true` 啟用） |
| `lambda/permissions/permission-filter-handler.ts` | 基於 ACL 的權限過濾 Lambda（用於未來擴展） |
| `lambda/permissions/permission-calculator.ts` | SID/ACL 匹配逻辑 |
| `demo-data/scripts/setup-user-access.sh` | 使用者 SID 資料註冊脚本 |
| `demo-data/documents/**/*.metadata.json` | 文件 SID 元資料 |

---

## 8. Bedrock Agent — 權限感知 Agentic AI

### 實現詳情

使用 Bedrock Agent 實現多步推理 AI 代理。Agent 透過 Permission-aware Action Group 執行 KB 搜尋，僅引用基於使用者 SID 權限過濾後的文件生成答案。

### CDK 資源（`enableAgent=true`）

| 資源 | 說明 |
|----------|-------------|
| Bedrock Agent | Claude 3 Haiku，不直接關联 KB（僅透過 Action Group） |
| Agent Alias | 用於稳定呼叫的別名 |
| Action Group Lambda | 權限感知 KB 搜尋（带 SID 過濾） |
| Agent IAM Role | Bedrock InvokeModel + KB Retrieve 權限 |

### 基於卡片的任务导向 UI

在開始聊天前顯示模式特定的卡片网格。設定為 KB 模式 8 张卡片 + Agent 模式 14 张卡片（8 张研究 + 6 张输出），支援一鍵提示词输入。支援收藏管理和類別過濾。

### 動态 Agent-卡片绑定

點击卡片時，引用 AGENT_CATEGORY_MAP（10 個類別：financial、project、hr、search、presentation、approval、minutes、report、contract、onboarding）查找或動态建建對应的 Agent 並绑定到卡片。建建的 Agent 自動附加 Permission-aware Action Group。

---

## 9. 圖像分析 RAG — Bedrock Vision API 整合

### 實現詳情

在聊天输入中添加圖像上傳功能，使用 Bedrock Converse API 的多模态能力（Vision API）分析圖像並將結果整合到 KB 搜尋上下文中。

### 處理流程

```
使用者 → 拖放圖像或文件選擇器
  → 驗證（格式：JPEG/PNG/GIF/WebP，大小：≤3MB）
  → Base64 编码 → API 提交
  → Vision API（Claude 3 Haiku）圖像分析
  → 分析結果 + 使用者查询 → KB Retrieve API
  → SID 過濾 → 答案生成
```

---

## 10. Knowledge Base 連接 UI — Agent × KB 管理

### 實現詳情

在 Agent Directory（`/genai/agents`）中建建或編輯 Agent 時，提供選擇、連接和斷開 Bedrock Knowledge Base 的 UI。

### API 擴展

在現有 `/api/bedrock/agent` 中添加 3 個操作（不更改現有操作）：

| 操作 | 說明 |
|--------|-------------|
| `associateKnowledgeBase` | 將 KB 連接到 Agent → PrepareAgent |
| `disassociateKnowledgeBase` | 從 Agent 斷開 KB → PrepareAgent |
| `listAgentKnowledgeBases` | 擷取連接到 Agent 的 KB 列表 |

---

## 11. Smart Routing — 成本最佳化模型選擇

### 實現詳情

根据查询複雜度自動路由。短的事實查询路由到轻量模型（Haiku），长的分析查询路由到高效能模型（Sonnet）。

### 分類演算法（ComplexityClassifier）

| 特征 | 簡單侧 | 複雜侧 |
|------|---------|---------|
| 字符数 | ≤100 字符（+0.3） | >100 字符（+0.3） |
| 句子数 | 1 句（+0.2） | 多句（+0.2） |
| 分析關鍵词 | 無 | 有（+0.3）（比較/分析/要約/explain/compare/analyze/summarize） |
| 多個問題 | 無 | 2 個或更多问號（+0.2） |

分数 < 0.5 → 簡單，≥ 0.5 → 複雜。置信度 = |分数 - 0.5| × 2。

### 預設設定

- Smart Routing：預設關闭（不影响現有行為）
- 轻量模型：`anthropic.claude-haiku-4-5-20251001-v1:0`
- 高效能模型：`anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## 12. 監控與告警 — CloudWatch Dashboard + SNS Alerts + EventBridge

### 實現詳情

透過 `enableMonitoring=true` 啟用的可选功能，提供 CloudWatch 儀表板、SNS 告警和 EventBridge 整合。可在單個儀表板中查看整個系統狀態，异常發生時發送邮件通知。

### 成本

| 資源 | 月费用 |
|--------|----------|
| CloudWatch Dashboard | $3.00 |
| CloudWatch Alarms（7 個） | $0.70 |
| SNS Email 通知 | 免费层内 |
| EventBridge Rule | 免费层内 |
| **合计** | **约 $4/月** |

---

## 13. AgentCore Memory — 對話上下文保持

### 實現詳情

透過 `enableAgentCoreMemory=true` 啟用的可选功能，透過 Bedrock AgentCore Memory 提供短期記忆（會話内對話歷史）和长期記忆（跨會話使用者偏好、摘要、語義知識）。

### 主要功能

- 會話内對話歷史自動儲存（短期記忆，TTL 3 天，最小值）
- 跨會話使用者偏好和知識自動提取（semantic strategy）
- 會話對話摘要自動生成（summary strategy）
- 側邊欄顯示會話列表和記忆部分
- KB 模式和 Agent 模式均支援對話上下文保持
- 8 种語言 i18n 支援（`agentcore.memory.*`、`agentcore.session.*`）

---

## 整體系統架構

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

### CDK 堆積堆積疊结構（7 個堆積堆積疊）

| # | 堆積堆積疊 | 区域 | 主要資源 |
|---|------|------|-----------|
| 1 | WafStack | us-east-1 | WAF WebACL、IP Set |
| 2 | NetworkingStack | ap-northeast-1 | VPC、子網路、安全組、VPC Endpoints（可选） |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool、Client、SAML IdP + Cognito Domain（AD Federation 啟用時）、AD Sync Lambda（可选） |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume、S3、DynamoDB×2、AD、KMS 加密（可选）、CloudTrail（可选） |
| 5 | AIStack | ap-northeast-1 | Bedrock KB、S3 Vectors / OpenSearch Serverless（透過 `vectorStoreType` 選擇）、Bedrock Guardrails（可选） |
| 6 | WebAppStack | ap-northeast-1 | Lambda（Docker）、CloudFront、Permission Filter Lambda（可选）、MonitoringConstruct（可选） |
| 7 | EmbeddingStack（可选） | ap-northeast-1 | EC2、ECR、ONTAP ACL 自動擷取（可选） |
