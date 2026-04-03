# 具備權限感知的 RAG 系統（搭配 Amazon FSx for NetApp ONTAP）

**🌐 Language / 語言:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

本儲存庫是一個範例，使用 AWS CDK 部署由 Amazon Bedrock 驅動的存取控制感知 Agentic RAG，利用 Amazon FSx for NetApp ONTAP 上的企業資料和存取權限。以 FSx for ONTAP 作為資料來源，實現考慮 ACL / 權限資訊的搜尋和回應生成。向量儲存可選擇 Amazon S3 Vectors（預設，低成本）或 Amazon OpenSearch Serverless（高效能）。採用基於卡片的任務導向 UI，使用 Next.js 15 在 AWS Lambda（Lambda Web Adapter）上構建，讓您能夠驗證適用於企業的安全 RAG / AI 助理配置。

---

## 架構

```
+----------+     +----------+     +------------+     +---------------------+
| Browser  |---->| AWS WAF  |---->| CloudFront |---->| Lambda Web Adapter  |
+----------+     +----------+     | (OAC+Geo)  |     | (Next.js, IAM Auth) |
                                  +------------+     +------+--------------+
                                                            |
                      +---------------------+---------------+--------------------+
                      v                     v               v                    v
             +-------------+    +------------------+ +--------------+   +--------------+
             | Cognito     |    | Bedrock KB       | | DynamoDB     |   | DynamoDB     |
             | User Pool   |    | + S3 Vectors /   | | user-access  |   | perm-cache   |
             +-------------+    |   OpenSearch SL  | | (SID Data)   |   | (Perm Cache) |
                                +--------+---------+ +--------------+   +--------------+
                                         |
                                         v
                                +------------------+
                                | FSx for ONTAP    |
                                | (SVM + Volume)   |
                                | + S3 Access Point|
                                +--------+---------+
                                         | CIFS/SMB (optional)
                                         v
                                +------------------+
                                | Embedding EC2    |
                                | (Titan Embed v2) |
                                | (optional)       |
                                +------------------+
```

## 實作概覽（13 個面向）

本系統的實作分為 13 個面向。各項目的詳細資訊請參閱 [docs/implementation-overview.md](docs/implementation-overview.md)。

| # | 面向 | 概覽 | 相關 CDK Stack |
|---|------|------|----------------|
| 1 | 聊天機器人應用程式 | Next.js 15（App Router）透過 Lambda Web Adapter 以無伺服器方式運行。支援 KB/Agent 模式切換。基於卡片的任務導向 UI | WebAppStack |
| 2 | AWS WAF | 6 條規則配置：速率限制、IP 信譽、OWASP 合規規則、SQLi 防護、IP 白名單 | WafStack |
| 3 | IAM 認證 | Lambda Function URL + CloudFront OAC 的多層安全性 | WebAppStack |
| 4 | 向量資料庫 | S3 Vectors（預設，低成本）/ OpenSearch Serverless（高效能）。透過 `vectorStoreType` 選擇 | AIStack |
| 5 | 嵌入伺服器 | 在 EC2 上透過 CIFS/SMB 掛載 FSx ONTAP 磁碟區進行文件向量化，並寫入 AOSS（僅限 AOSS 配置） | EmbeddingStack |
| 6 | Titan Text Embeddings | KB 擷取和嵌入伺服器均使用 `amazon.titan-embed-text-v2:0`（1024 維度） | AIStack |
| 7 | SID 中繼資料 + 權限過濾 | 透過 `.metadata.json` 管理 NTFS ACL SID 資訊，並在搜尋時透過比對使用者 SID 進行過濾 | StorageStack |
| 8 | KB/Agent 模式切換 | 在 KB 模式（文件搜尋）和 Agent 模式（多步驟推理）之間切換。Agent 目錄（`/genai/agents`）提供目錄式 Agent 管理、範本建立、編輯和刪除。動態 Agent 建立和卡片綁定。輸出導向工作流程（簡報、審批文件、會議記錄、報告、合約、入職）。8 語言 i18n 支援。兩種模式均具備權限感知 | WebAppStack |
| 9 | 圖片分析 RAG | 在聊天輸入中新增圖片上傳（拖放 / 檔案選擇器）。使用 Bedrock Vision API（Claude Haiku 4.5）分析圖片並將結果整合到 KB 搜尋上下文中。支援 JPEG/PNG/GIF/WebP，3MB 限制 | WebAppStack |
| 10 | KB 連接 UI | 在 Agent 建立/編輯時選擇、連接和斷開 Bedrock Knowledge Base 的 UI。在 Agent 詳細面板中顯示已連接的 KB 列表 | WebAppStack |
| 11 | 智慧路由 | 根據查詢複雜度自動選擇模型。簡短事實查詢路由到輕量模型（Haiku），長篇分析查詢路由到高效能模型（Sonnet）。側邊欄中的開/關切換 | WebAppStack |
| 12 | 監控與警報 | CloudWatch 儀表板（Lambda/CloudFront/DynamoDB/Bedrock/WAF/進階 RAG 整合）、SNS 警報（錯誤率和延遲閾值通知）、EventBridge KB Ingestion Job 失敗通知、EMF 自訂指標。透過 `enableMonitoring=true` 啟用 | WebAppStack (MonitoringConstruct) |
| 13 | AgentCore Memory | 透過 AgentCore Memory 維護對話上下文（短期和長期記憶）。會話內對話歷史（短期）+ 跨會話使用者偏好和摘要（長期）。透過 `enableAgentCoreMemory=true` 啟用 | AIStack |

## UI 截圖

### KB 模式 — 卡片網格（初始狀態）

聊天區域的初始狀態以網格佈局顯示 14 張用途特定的卡片（8 張研究 + 6 張輸出）。具備分類篩選器、收藏功能和 InfoBanner（權限資訊）。

![KB Mode Card Grid](docs/screenshots/kb-mode-cards-full.png)

### Agent 模式 — 卡片網格 + 側邊欄

Agent 模式顯示 14 張工作流程卡片（8 張研究 + 6 張輸出）。點擊卡片會自動搜尋 Bedrock Agent，如果尚未建立，則導航到 Agent 目錄建立表單。側邊欄包含 Agent 選擇下拉選單、聊天歷史設定和可摺疊的系統管理區段。

![Agent Mode Card Grid](docs/screenshots/agent-mode-card-grid.png)

### Agent 目錄 — Agent 列表與管理畫面

可在 `/[locale]/genai/agents` 存取的專用 Agent 管理畫面。提供已建立 Bedrock Agent 的目錄顯示、搜尋和分類篩選器、詳細面板、基於範本的建立以及內聯編輯/刪除。導航列允許在 Agent 模式 / Agent 列表 / KB 模式之間切換。啟用企業功能時，會新增「共享 Agent」和「排程任務」標籤。

![Agent Directory](docs/screenshots/agent-directory-enterprise.png)

#### Agent 目錄 — 共享 Agent 標籤

透過 `enableAgentSharing=true` 啟用。列出、預覽和匯入 S3 共享儲存桶中的 Agent 配置。

![Shared Agents Tab](docs/screenshots/agent-directory-shared-tab.png)

### Agent 目錄 — Agent 建立表單

在範本卡片上點擊「從範本建立」會顯示建立表單，您可以編輯 Agent 名稱、描述、系統提示和 AI 模型。在 Agent 模式中點擊尚未建立 Agent 的卡片時也會顯示相同的表單。

![Agent Creation Form](docs/screenshots/agent-creator-form.png)

### Agent 目錄 — Agent 詳細資訊與編輯

點擊 Agent 卡片會顯示詳細面板，顯示 Agent ID、狀態、模型、版本、建立日期、系統提示（可摺疊）和動作群組。可用操作包括「編輯」進行內聯編輯、「在聊天中使用」導航到 Agent 模式、「匯出」下載 JSON 配置、「上傳到共享儲存桶」進行 S3 共享、「建立排程」進行定期執行設定，以及帶確認對話框的「刪除」。

![Agent Detail Panel](docs/screenshots/agent-detail-panel.png)

### 聊天回應 — 引用顯示 + 存取等級徽章

RAG 搜尋結果顯示 FSx 檔案路徑和存取等級徽章（所有人可存取 / 僅管理員 / 特定群組）。聊天期間，「🔄 返回工作流程選擇」按鈕可返回卡片網格。訊息輸入欄位左側的「➕」按鈕可開始新的聊天。

![Chat Response + Citation](docs/screenshots/kb-mode-chat-citation.png)

### 圖片上傳 — 拖放 + 檔案選擇器（v3.1.0）

在聊天輸入區域新增圖片上傳功能。透過拖放區域和 📎 檔案選擇器按鈕附加圖片，使用 Bedrock Vision API（Claude Haiku 4.5）進行分析，並整合到 KB 搜尋上下文中。支援 JPEG/PNG/GIF/WebP，3MB 限制。

![Image Upload Zone](docs/screenshots/kb-mode-image-upload-zone.png)

### 智慧路由 — 成本最佳化自動模型選擇（v3.1.0）

當側邊欄中的智慧路由切換開啟時，會根據查詢複雜度自動選擇輕量模型（Haiku）或高效能模型（Sonnet）。ModelSelector 中新增「⚡ Auto」選項，回應會顯示使用的模型名稱和「Auto」徽章。

![Smart Routing ON + ResponseMetadata](docs/screenshots/kb-mode-response-metadata-auto.png)

### AgentCore Memory — 會話列表 + 記憶區段（v3.3.0）

透過 `enableAgentCoreMemory=true` 啟用。在 Agent 模式側邊欄中新增會話列表（SessionList）和長期記憶顯示（MemorySection）。聊天歷史設定被替換為「AgentCore Memory: Enabled」徽章。

![AgentCore Memory Sidebar](docs/screenshots/agent-mode-agentcore-memory-sidebar.png)

## CDK Stack 結構

| # | Stack | 區域 | 資源 | 說明 |
|---|-------|------|------|------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set | CloudFront 的 WAF（速率限制、受管規則） |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints（可選） | 網路基礎設施 |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + OIDC IdP + Cognito Domain（啟用 Federation 時）, Identity Sync Lambda（可選） | 認證與授權（SAML/OIDC/電子郵件） |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, (AD), KMS 加密（可選）, CloudTrail（可選） | 儲存、SID 資料、權限快取 |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless（透過 `vectorStoreType` 選擇）, Bedrock Guardrails（可選） | RAG 搜尋基礎設施（Titan Embed v2） |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker, IAM Auth + OAC), CloudFront, Permission Filter Lambda（可選）, MonitoringConstruct（可選） | Web 應用程式、Agent 管理、監控與警報 |
| 7 | EmbeddingStack（可選） | ap-northeast-1 | EC2 (m5.large), ECR, ONTAP ACL 自動擷取（可選） | FlexCache CIFS 掛載 + 嵌入伺服器 |

### 安全功能（6 層防禦）

| 層級 | 技術 | 用途 |
|------|------|------|
| L1: 網路 | CloudFront Geo Restriction | 地理存取限制（預設：僅限日本） |
| L2: WAF | AWS WAF（6 條規則） | 攻擊模式偵測與阻擋 |
| L3: 來源認證 | CloudFront OAC (SigV4) | 防止繞過 CloudFront 的直接存取 |
| L4: API 認證 | Lambda Function URL IAM Auth | 透過 IAM 認證進行存取控制 |
| L5: 使用者認證 | Cognito JWT / SAML / OIDC Federation | 使用者層級的認證與授權 |
| L6: 資料授權 | SID / UID+GID Filtering | 文件層級的存取控制 |

## 先決條件

- AWS 帳戶（具有 AdministratorAccess 等效權限）
- Node.js 22+、npm
- Docker（Colima、Docker Desktop 或 EC2 上的 docker.io）
- CDK 已引導（`cdk bootstrap aws://ACCOUNT_ID/REGION`）

> **注意**：建置可在本機（macOS / Linux）或 EC2 上執行。對於 Apple Silicon（M1/M2/M3），`pre-deploy-setup.sh` 會自動使用預建置模式（本機 Next.js 建置 + Docker 打包）來生成 x86_64 Lambda 相容映像。在 EC2（x86_64）上，會執行完整的 Docker 建置。

## 部署步驟

### 步驟 1：環境設定

可在本機（macOS / Linux）或 EC2 上執行。

#### 本機（macOS）

```bash
# Node.js 22+（Homebrew）
brew install node@22

# Docker（擇一）
brew install --cask docker          # Docker Desktop（需要 sudo）
brew install docker colima          # Colima（不需要 sudo，推薦）
colima start --cpu 4 --memory 8     # 啟動 Colima

# AWS CDK
npm install -g aws-cdk typescript ts-node
```

#### EC2 (Ubuntu 22.04)

```bash
# 在公有子網中啟動 t3.large（具有啟用 SSM 的 IAM 角色）
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

安全群組只需開放出站 443（HTTPS）即可讓 SSM Session Manager 運作。不需要入站規則。

### 步驟 2：工具安裝（適用於 EC2）

透過 SSM Session Manager 連線後，執行以下命令。

```bash
# 系統更新 + 基本工具
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 啟用 Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# AWS CDK（全域）
sudo npm install -g aws-cdk typescript ts-node
```

#### ⚠️ CDK CLI 版本注意事項

透過 `npm install -g aws-cdk` 安裝的 CDK CLI 版本可能與專案的 `aws-cdk-lib` 不相容。

```bash
# 如何檢查
cdk --version          # 全域 CLI 版本
npx cdk --version      # 專案本地 CLI 版本
```

本專案使用 `aws-cdk-lib@2.244.0`。如果 CLI 版本過舊，您會看到以下錯誤：

```
Cloud assembly schema version mismatch: Maximum schema version supported is 48.x.x, but found 52.0.0
```

**解決方案**：將專案本地的 CDK CLI 更新到最新版本。

```bash
cd Permission-aware-RAG-FSxN-CDK
npm install aws-cdk@latest
npx cdk --version  # 驗證更新後的版本
```

> **重要**：使用 `npx cdk` 而非 `cdk`，以確保使用專案本地的最新 CLI。

### 步驟 3：複製儲存庫並安裝相依套件

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### 步驟 4：CDK Bootstrap（僅首次）

如果目標區域尚未執行 CDK Bootstrap，請執行此步驟。由於 WAF stack 部署到 us-east-1，兩個區域都需要 Bootstrap。

```bash
# ap-northeast-1（主要區域）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1（用於 WAF stack）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> **部署到不同 AWS 帳戶時**：從 `cdk.context.json` 中刪除 AZ 快取（`availability-zones:account=...`）。CDK 會自動擷取新帳戶的 AZ 資訊。

### 步驟 5：CDK Context 配置

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

#### Active Directory 整合（可選）

若要將 FSx ONTAP SVM 加入 Active Directory 網域並使用 NTFS ACL（基於 SID）搭配 CIFS 共享，請將以下內容新增到 `cdk.context.json`。

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `adPassword` | string | 未設定（不建立 AD） | AWS Managed Microsoft AD 管理員密碼。設定後會建立 AD 並將 SVM 加入網域 |
| `adDomainName` | string | `demo.local` | AD 網域名稱（FQDN） |

> **注意**：AD 建立需要額外 20-30 分鐘。無需 AD 也可進行 SID 過濾示範（使用 DynamoDB SID 資料驗證）。

#### AD SAML Federation（可選）

您可以啟用 SAML 聯合，讓 AD 使用者直接從 CloudFront UI 登入，並自動建立 Cognito 使用者 + 自動註冊 DynamoDB SID 資料。

**架構概覽：**

```
AD User → CloudFront UI → "Sign in with AD" button
  → Cognito Hosted UI → SAML IdP (AD) → AD Authentication
  → Automatic Cognito User Creation
  → Post-Auth Trigger → AD Sync Lambda → DynamoDB SID Data Registration
  → OAuth Callback → Session Cookie → Chat Screen
```

**CDK 參數：**

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `enableAdFederation` | boolean | `false` | SAML 聯合啟用旗標 |
| `cloudFrontUrl` | string | 未設定 | 用於 OAuth 回呼 URL 的 CloudFront URL（例如 `https://d3xxxxx.cloudfront.net`） |
| `samlMetadataUrl` | string | 未設定 | 自管 AD 用：Entra ID 聯合中繼資料 URL |
| `adEc2InstanceId` | string | 未設定 | 自管 AD 用：EC2 執行個體 ID |

> **環境變數自動配置**: 使用 `enableAdFederation=true` 或指定 `oidcProviderConfig` 部署 CDK 時，WebAppStack Lambda 函數會自動設定 Federation 環境變數（`COGNITO_DOMAIN`、`COGNITO_CLIENT_SECRET`、`CALLBACK_URL`、`IDP_NAME`）。無需手動配置 Lambda 環境變數。

**受管 AD 模式：**

使用 AWS Managed Microsoft AD 時。

> **⚠️ 需要 IAM Identity Center（前身為 AWS SSO）配置：**
> 若要使用受管 AD SAML 中繼資料 URL（`portal.sso.{region}.amazonaws.com/saml/metadata/{directoryId}`），您需要啟用 AWS IAM Identity Center、將受管 AD 配置為身分來源，並建立 SAML 應用程式。僅建立受管 AD 不會提供 SAML 中繼資料端點。
>
> 如果配置 IAM Identity Center 有困難，您也可以透過 `samlMetadataUrl` 參數直接指定外部 IdP（AD FS 等）中繼資料 URL。

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net",
  // 可選：使用 IAM Identity Center 以外的 SAML 中繼資料 URL 時
  // "samlMetadataUrl": "https://your-adfs-server/federationmetadata/2007-06/federationmetadata.xml"
}
```

設定步驟：
1. 設定 `adPassword` 並部署 CDK（建立受管 AD + SAML IdP + Cognito Domain）
2. 啟用 AWS IAM Identity Center 並將身分來源變更為受管 AD
3. 為 AD 使用者設定電子郵件地址（PowerShell: `Set-ADUser -Identity Admin -EmailAddress "admin@demo.local"`）
4. 在 IAM Identity Center 中，前往「管理同步」→「引導式設定」以同步 AD 使用者
5. 在 IAM Identity Center 中建立 SAML 應用程式「Permission-aware RAG Cognito」：
   - ACS URL: `https://{cognito-domain}.auth.{region}.amazoncognito.com/saml2/idpresponse`
   - SAML 對象: `urn:amazon:cognito:sp:{user-pool-id}`
   - 屬性對應: Subject → `${user:email}` (emailAddress), emailaddress → `${user:email}`
6. 將 AD 使用者指派到 SAML 應用程式
7. 部署後，在 `cloudFrontUrl` 中設定 CloudFront URL 並重新部署
8. 從 CloudFront UI 上的「使用 AD 登入」按鈕執行 AD 認證

**自管 AD 模式（EC2 上，搭配 Entra Connect 整合）：**

將 EC2 上的 AD 與 Entra ID（前身為 Azure AD）整合，並使用 Entra ID 聯合中繼資料 URL。

```json
{
  "enableAdFederation": true,
  "adEc2InstanceId": "i-0123456789abcdef0",
  "samlMetadataUrl": "https://login.microsoftonline.com/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net"
}
```

設定步驟：
1. 在 EC2 上安裝 AD DS 並配置與 Entra Connect 的同步
2. 取得 Entra ID 聯合中繼資料 URL
3. 設定上述參數並部署 CDK
4. 從 CloudFront UI 上的「Sign in with AD」按鈕執行 AD 認證

**模式比較：**

| 項目 | 受管 AD | 自管 AD |
|------|---------|---------|
| SAML 中繼資料 | 透過 IAM Identity Center 或 `samlMetadataUrl` 指定 | Entra ID 中繼資料 URL（`samlMetadataUrl` 指定） |
| SID 擷取方法 | LDAP 或透過 SSM | SSM → EC2 → PowerShell |
| 必要參數 | `adPassword`、`cloudFrontUrl` + IAM Identity Center 設定（或 `samlMetadataUrl`） | `adEc2InstanceId`、`samlMetadataUrl`、`cloudFrontUrl` |
| AD 管理 | AWS 受管 | 使用者自管 |
| 成本 | 受管 AD 定價 | EC2 執行個體定價 |

**疑難排解：**

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| SAML 認證失敗 | 無效的 SAML IdP 中繼資料 URL | 受管 AD：檢查 IAM Identity Center 配置，或透過 `samlMetadataUrl` 直接指定。自管：驗證 Entra ID 中繼資料 URL |
| OAuth 回呼錯誤 | `cloudFrontUrl` 未設定或不匹配 | 驗證 CDK context 中的 `cloudFrontUrl` 是否與 CloudFront Distribution URL 匹配 |
| Post-Auth Trigger 失敗 | AD Sync Lambda 權限不足 | 檢查 CloudWatch Logs 中的錯誤詳情。登入本身不會被阻擋 |
| KB 搜尋中的 S3 存取錯誤 | KB IAM 角色缺少直接 S3 儲存桶存取權限 | KB IAM 角色僅透過 S3 Access Point 擁有權限。直接使用 S3 儲存桶作為資料來源時，需要新增 `s3:GetObject` 和 `s3:ListBucket` 權限（非 AD Federation 特有） |
| S3 AP 資料平面 API AccessDenied | WindowsUser 包含網域前綴 | S3 AP 的 WindowsUser 不得包含網域前綴（例如 `DEMO\Admin`）。僅指定使用者名稱（例如 `Admin`）。CLI 接受網域前綴但資料平面 API 會失敗 |
| Cognito Domain 建立失敗 | 網域前綴衝突 | 檢查 `{projectName}-{environment}-auth` 前綴是否與其他帳戶衝突 |
| USER_PASSWORD_AUTH 401 錯誤 | Client Secret 啟用時未傳送 SECRET_HASH | `enableAdFederation=true` 時 User Pool Client 設定了 Client Secret。登入 API 需要從 `COGNITO_CLIENT_SECRET` 環境變數計算 SECRET_HASH 並傳送 |
| Post-Auth Trigger `Cannot find module 'index'` | Lambda TypeScript 未編譯 | CDK `Code.fromAsset` 有 esbuild 打包選項。`npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=index.js --external:@aws-sdk/*` |
| OAuth Callback `0.0.0.0` 重新導向 | Lambda Web Adapter `request.url` 為 `http://0.0.0.0:3000/...` | 使用 `CALLBACK_URL` 環境變數建構重新導向基礎 URL |

#### OIDC/LDAP Federation（選用）— 零接觸使用者佈建

除 SAML AD Federation 外，還可以啟用 OIDC IdP（Keycloak、Okta、Entra ID 等）和 LDAP 直接查詢，實現零接觸使用者佈建。檔案伺服器的現有使用者權限會自動對應到 RAG 系統 UI 使用者，無需管理員或使用者手動註冊。

各認證方式採用「設定驅動自動啟用」機制。只需在 `cdk.context.json` 中新增設定值即可啟用，幾乎不產生額外 AWS 資源成本。SAML + OIDC 同時啟用也受支援。

**OIDC + LDAP 設定範例（OpenLDAP/FreeIPA + Keycloak）：**

```json
{
  "oidcProviderConfig": {
    "providerName": "Keycloak",
    "clientId": "rag-system",
    "clientSecret": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oidc-client-secret",
    "issuerUrl": "https://keycloak.example.com/realms/main",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldaps://ldap.example.com:636",
    "baseDn": "dc=example,dc=com",
    "bindDn": "cn=readonly,dc=example,dc=com",
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

**CDK 參數：**

| 參數 | 類型 | 說明 |
|------|------|------|
| `oidcProviderConfig` | object | OIDC IdP 設定（`providerName`, `clientId`, `clientSecret`, `issuerUrl`, `groupClaimName`） |
| `ldapConfig` | object | LDAP 連線設定（`ldapUrl`, `baseDn`, `bindDn`, `bindPasswordSecretArn`, `userSearchFilter`, `groupSearchFilter`） |
| `permissionMappingStrategy` | string | 權限對應策略：`sid-only`（預設）、`uid-gid`、`hybrid` |
| `ontapNameMappingEnabled` | boolean | ONTAP name-mapping 整合（UNIX 使用者→Windows 使用者對應） |

#### 企業功能（可選）

以下 CDK context 參數可啟用安全增強和架構統一功能。

```json
{
  "useS3AccessPoint": "true",
  "usePermissionFilterLambda": "true",
  "enableGuardrails": "true",
  "enableKmsEncryption": "true",
  "enableCloudTrail": "true",
  "enableVpcEndpoints": "true"
}
```

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `ontapMgmtIp` | （無） | ONTAP 管理 IP。設定後，嵌入伺服器會從 ONTAP REST API 自動生成 `.metadata.json` |
| `ontapSvmUuid` | （無） | SVM UUID（與 `ontapMgmtIp` 搭配使用） |
| `ontapAdminSecretArn` | （無） | ONTAP 管理員密碼的 Secrets Manager ARN |
| `useS3AccessPoint` | `false` | 使用 S3 Access Point 作為 Bedrock KB 資料來源 |
| `volumeSecurityStyle` | `NTFS` | FSx ONTAP 磁碟區安全樣式（`NTFS` or `UNIX`） |
| `s3apUserType` | （自動） | S3 AP 使用者類型（`WINDOWS` or `UNIX`）。預設：已設定 AD→WINDOWS，未設定 AD→UNIX |
| `s3apUserName` | （自動） | S3 AP 使用者名稱。預設：WINDOWS→`Admin`，UNIX→`root` |
| `usePermissionFilterLambda` | `false` | 透過專用 Lambda 執行 SID 過濾（具有內聯過濾回退） |
| `enableGuardrails` | `false` | Bedrock Guardrails（有害內容過濾 + PII 保護） |
| `enableAgent` | `false` | Bedrock Agent + 權限感知 Action Group（KB 搜尋 + SID 過濾）。動態 Agent 建立（點擊卡片時自動建立並綁定分類特定的 Agent） |
| `enableAgentSharing` | `false` | Agent 配置共享 S3 儲存桶。Agent 配置的 JSON 匯出/匯入，透過 S3 進行組織範圍共享 |
| `enableAgentSchedules` | `false` | Agent 排程執行基礎設施（EventBridge Scheduler + Lambda + DynamoDB 執行歷史表） |
| `enableKmsEncryption` | `false` | S3 和 DynamoDB 的 KMS CMK 加密（已啟用金鑰輪換） |
| `enableCloudTrail` | `false` | CloudTrail 稽核日誌（S3 資料存取 + Lambda 呼叫，90 天保留） |
| `enableVpcEndpoints` | `false` | VPC Endpoints（S3、DynamoDB、Bedrock、SSM、Secrets Manager、CloudWatch Logs） |
| `enableMonitoring` | `false` | CloudWatch 儀表板 + SNS 警報 + EventBridge KB Ingestion 監控。成本：儀表板 $3/月 + 警報 $0.10/警報/月 |
| `monitoringEmail` | *（無）* | 警報通知電子郵件地址（`enableMonitoring=true` 時有效） |
| `enableAgentCoreMemory` | `false` | 啟用 AgentCore Memory（短期和長期記憶）。需要 `enableAgent=true` |
| `enableAgentCoreObservability` | `false` | 將 AgentCore Runtime 指標整合到儀表板（`enableMonitoring=true` 時有效） |
| `enableAdvancedPermissions` | `false` | 時間基礎存取控制 + 權限判定稽核日誌。建立 `permission-audit` DynamoDB 資料表 |
| `alarmEvaluationPeriods` | `1` | 警報評估期間數（連續 N 次超過閾值後觸發警報） |
| `dashboardRefreshInterval` | `300` | 儀表板自動重新整理間隔（秒） |

#### 向量儲存配置選擇

使用 `vectorStoreType` 參數切換向量儲存。預設為 S3 Vectors（低成本）。

| 配置 | 成本 | 延遲 | 建議用途 |
|------|------|------|----------|
| `s3vectors`（預設） | 每月幾美元 | 亞秒到 100ms | 示範、開發、成本最佳化 |

#### 使用現有的 FSx for ONTAP

如果 FSx for ONTAP 檔案系統已存在，您可以參考現有資源而非建立新的。這可大幅縮短部署時間（省去 FSx ONTAP 建立的 30-40 分鐘等待）。

```bash
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c existingFileSystemId=fs-0123456789abcdef0 \
  -c existingSvmId=svm-0123456789abcdef0 \
  -c existingVolumeId=fsvol-0123456789abcdef0 \
  -c vectorStoreType=s3vectors \
  -c enableAgent=true
```

| 參數 | 說明 |
|------|------|
| `existingFileSystemId` | 現有 FSx ONTAP 檔案系統 ID（例如 `fs-0123456789abcdef0`） |
| `existingSvmId` | 現有 SVM ID（例如 `svm-0123456789abcdef0`） |
| `existingVolumeId` | 現有 Volume ID（例如 `fsvol-0123456789abcdef0`） |

> **注意**：在現有 FSx 參考模式下，FSx/SVM/Volume 不在 CDK 管理範圍內。`cdk destroy` 不會刪除它們。受管 AD 也不會建立（使用現有環境的 AD 設定）。

| 配置 | 成本 | 延遲 | 建議用途 | 中繼資料限制 |
|------|------|------|----------|-------------|
| `s3vectors`（預設） | 每月幾美元 | 亞秒到 100ms | 示範、開發、成本最佳化 | filterable 2KB 限制（見下方） |
| `opensearch-serverless` | 約 $700/月 | 約 10ms | 高效能生產環境 | 無限制 |

```bash
# S3 Vectors 配置（預設）
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=s3vectors

# OpenSearch Serverless 配置
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=opensearch-serverless
```

如果在使用 S3 Vectors 配置時需要高效能，可以使用 `demo-data/scripts/export-to-opensearch.sh` 按需匯出到 OpenSearch Serverless。詳情請參閱 [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md)。

### 步驟 6：部署前設定（ECR 映像準備）

WebApp stack 參考 ECR 儲存庫中的 Docker 映像，因此必須在 CDK 部署前準備映像。

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

此腳本自動執行以下操作：
1. 建立 ECR 儲存庫（`permission-aware-rag-webapp`）
2. 建置並推送 Docker 映像

建置模式根據主機架構自動選擇：

| 主機 | 建置模式 | 說明 |
|------|----------|------|
| x86_64（EC2 等） | 完整 Docker 建置 | Dockerfile 內執行 npm install + next build |
| arm64（Apple Silicon） | 預建置模式 | 本機 next build → Docker 打包 |

> **所需時間**：EC2（x86_64）：3-5 分鐘，本機（Apple Silicon）：5-8 分鐘，CodeBuild：5-10 分鐘

> **Apple Silicon 注意事項**：需要 `docker buildx`（`brew install docker-buildx`）。推送到 ECR 時，指定 `--provenance=false`（因為 Lambda 不支援 manifest list 格式）。

### 步驟 7：CDK 部署

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

啟用企業功能：

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableAgentSharing=true \
  -c enableAgentSchedules=true \
  --require-approval never
```

啟用監控與警報：

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  --require-approval never
```

> **監控成本估算**：CloudWatch Dashboard $3/月 + Alarms $0.10/警報/月（7 個警報 = $0.70/月）+ SNS 通知在免費額度內。總計約 $4/月。

> **所需時間**：FSx for ONTAP 建立需要 20-30 分鐘，因此總計約 30-40 分鐘。

### 步驟 8：部署後設定（單一命令）

CDK 部署完成後，使用此單一命令完成所有設定：

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

此腳本自動執行以下操作：
1. 建立 S3 Access Point + 配置策略
2. 上傳示範資料到 FSx ONTAP（透過 S3 AP）
3. 新增 Bedrock KB 資料來源 + 同步
4. 在 DynamoDB 中註冊使用者 SID 資料
5. 在 Cognito 中建立示範使用者（admin / user）

> **所需時間**：2-5 分鐘（包含 KB 同步等待）

### 步驟 9：部署驗證（自動化測試）

執行自動化測試腳本以驗證所有功能。

```bash
bash demo-data/scripts/verify-deployment.sh
```

測試結果自動生成在 `docs/test-results.md`。驗證項目：
- Stack 狀態（所有 6 個 stack CREATE/UPDATE_COMPLETE）
- 資源存在性（Lambda URL、KB、Agent）
- 應用程式回應（登入頁面 HTTP 200）
- KB 模式權限感知（admin：所有文件允許，user：僅公開）
- Agent 模式權限感知（Action Group SID 過濾）
- S3 Access Point（AVAILABLE）
- 企業 Agent 功能（S3 共享儲存桶、DynamoDB 執行歷史表、排程器 Lambda、Sharing/Schedules API 回應）*僅在啟用 `enableAgentSharing`/`enableAgentSchedules` 時

### 步驟 10：瀏覽器存取

從 CloudFormation 輸出中擷取 URL 並在瀏覽器中存取。

```bash
aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### 資源清理

使用一次刪除所有資源（CDK stack + 手動建立的資源）的腳本：

```bash
bash demo-data/scripts/cleanup-all.sh
```

此腳本自動執行以下操作：
1. 刪除手動建立的資源（S3 AP、ECR、CodeBuild）
2. 刪除 Bedrock KB 資料來源（CDK destroy 前必須）
3. 刪除動態建立的 Bedrock Agent（CDK 管理外的 Agent）
4. 刪除企業 Agent 功能資源（EventBridge Scheduler 排程和群組、S3 共享儲存桶）
5. 刪除 Embedding stack（如果存在）
6. CDK destroy（所有 stack）
7. 個別刪除剩餘 stack + 孤立 AD SG 刪除
8. 刪除 VPC 中非 CDK 管理的 EC2 執行個體和 SG + Networking stack 重新刪除
9. CDKToolkit + CDK staging S3 儲存桶刪除（兩個區域，版本控制感知）

> **注意**：FSx ONTAP 刪除需要 20-30 分鐘，因此總計約 30-40 分鐘。

## 疑難排解

### WebApp Stack 建立失敗（找不到 ECR 映像）

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| `Source image ... does not exist` | ECR 儲存庫中沒有 Docker 映像 | 先執行 `bash demo-data/scripts/pre-deploy-setup.sh` |

> **重要**：對於新帳戶，務必在 CDK 部署前執行 `pre-deploy-setup.sh`。WebApp stack 參考 ECR 中的 `permission-aware-rag-webapp:latest` 映像。

### CDK CLI 版本不匹配

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| `Cloud assembly schema version mismatch` | 全域 CDK CLI 過舊 | 使用 `npm install aws-cdk@latest` 更新專案本地版本並使用 `npx cdk` |

### 因 CloudFormation Hook 導致部署失敗

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| `The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]` | 組織層級的 CloudFormation Hook 阻擋 ChangeSet | 新增 `--method=direct` 選項以繞過 ChangeSet |

```bash
# 在啟用 CloudFormation Hook 的環境中部署
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never

# Bootstrap 也使用 create-stack 進行直接建立
aws cloudformation create-stack --stack-name CDKToolkit \
  --template-body file://cdk-bootstrap-template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

### Docker 權限錯誤

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| `permission denied while trying to connect to the Docker daemon` | 使用者不在 docker 群組中 | `sudo usermod -aG docker ubuntu && newgrp docker` |

### AgentCore Memory 部署失敗

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| `EarlyValidation::PropertyValidation` | CfnMemory 屬性不符合 schema | Name 中不允許連字號（替換為 `_`），EventExpiryDuration 以天為單位（最小：3，最大：365） |
| `Please provide a role with a valid trust policy` | Memory IAM 角色的服務主體無效 | 使用 `bedrock-agentcore.amazonaws.com`（非 `bedrock.amazonaws.com`） |
| `actorId failed to satisfy constraint` | actorId 包含電子郵件地址中的 `@` `.` | 已在 `lib/agentcore/auth.ts` 中處理：`@` → `_at_`、`.` → `_dot_` |
| `AccessDeniedException: bedrock-agentcore:CreateEvent` | Lambda 執行角色缺少 AgentCore 權限 | 使用 `enableAgentCoreMemory=true` 部署 CDK 時自動新增 |
| `exec format error`（Lambda 啟動失敗） | Docker 映像架構與 Lambda 不匹配 | Lambda 為 x86_64。在 Apple Silicon 上，使用 `docker buildx` + `--platform linux/amd64` |

### SSM Session Manager 連線失敗

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| SSM 中未顯示執行個體 | IAM 角色未配置或出站 443 被阻擋 | 檢查 IAM 執行個體設定檔和 SG 出站規則 |

### `cdk destroy` 期間的刪除順序問題

刪除環境時可能依序發生以下問題。

#### 已知問題：Storage Stack UPDATE_ROLLBACK_COMPLETE

CDK 範本變更後（例如 S3 AP 自訂資源屬性變更），執行 `cdk deploy --all` 可能導致 Storage stack 進入 UPDATE_ROLLBACK_COMPLETE。

- **影響**：`cdk deploy --all` 失敗。資源本身正常運作
- **解決方法**：使用 `npx cdk deploy <STACK> --exclusively` 個別更新 stack
- **根本修復**：使用 `cdk destroy` 完全刪除後重新部署

#### 問題 1：Embedding Stack 存在時無法刪除 AI Stack

如果使用 `enableEmbeddingServer=true` 部署，`cdk destroy --all` 不會識別 Embedding stack（因為它依賴 CDK context）。

```bash
# 先手動刪除 Embedding stack
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1

# 然後執行 cdk destroy
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force
```

#### 問題 2：Bedrock KB 中存在資料來源時刪除失敗

附加資料來源時無法刪除 KB。如果 AI stack 刪除結果為 `DELETE_FAILED`：

```bash
# 先刪除資料來源
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
DS_IDS=$(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
  --query 'dataSourceSummaries[].dataSourceId' --output text)
for DS_ID in $DS_IDS; do
  aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
done
sleep 10

# 重試 AI stack 刪除
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-AI --region ap-northeast-1
```

#### 問題 3：附加 S3 Access Point 時 FSx Volume 刪除失敗

附加 S3 AP 時無法刪除 Storage stack 的 FSx ONTAP volume：

```bash
# 分離並刪除 S3 AP
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1
sleep 30

# 重試 Storage stack 刪除
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Storage --region ap-northeast-1
```

#### 問題 4：孤立的 AD Controller SG 阻擋 VPC 刪除

使用受管 AD 時，AD 刪除後 AD Controller SG 可能殘留：

```bash
# 識別孤立的 SG
VPC_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text)
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
  --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text

# 刪除 SG
aws ec2 delete-security-group --group-id <SG_ID> --region ap-northeast-1

# 重試 Networking stack 刪除
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
```

#### 問題 5：VPC 子網中存在 EC2 執行個體時 Networking Stack 刪除失敗

如果非 CDK 管理的 EC2 執行個體（例如 Docker 建置 EC2）殘留在 VPC 子網中，`cdk destroy` 會導致 Networking stack 進入 `DELETE_FAILED`。

| 症狀 | 原因 | 解決方案 |
|------|------|----------|
| `The subnet 'subnet-xxx' has dependencies and cannot be deleted` | 子網中存在非 CDK 管理的 EC2 | 終止 EC2 → 刪除 SG → 刪除金鑰對 → 重試 stack 刪除 |

```bash
# 識別 VPC 中的 EC2 執行個體
VPC_ID="vpc-xxx"
aws ec2 describe-instances --filters "Name=vpc-id,Values=$VPC_ID" "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[].Instances[].{Id:InstanceId,Name:Tags[?Key==`Name`].Value|[0]}' --output table

# 終止 EC2
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>
aws ec2 wait instance-terminated --instance-ids <INSTANCE_ID>

# 刪除剩餘的 SG
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[?GroupName!=`default`].{Id:GroupId,Name:GroupName}' --output table
aws ec2 delete-security-group --group-id <SG_ID>

# 刪除金鑰對（如果不再需要）
aws ec2 delete-key-pair --key-name <KEY_NAME>

# 重試 Networking stack 刪除
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking
```

#### 問題 6：因版本控制導致 CDK Staging S3 儲存桶刪除失敗

CDK Bootstrap 建立的 S3 staging 儲存桶（`cdk-hnb659fds-assets-*`）已啟用版本控制。`aws s3 rb --force` 會留下物件版本和 DeleteMarker，導致儲存桶刪除失敗。

```bash
# 刪除儲存桶前先刪除所有版本和 DeleteMarker
BUCKET="cdk-hnb659fds-assets-ACCOUNT_ID-REGION"

# 刪除物件版本
aws s3api list-object-versions --bucket "$BUCKET" \
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json | \
  aws s3api delete-objects --bucket "$BUCKET" --delete file:///dev/stdin

# 刪除 DeleteMarker
aws s3api list-object-versions --bucket "$BUCKET" \
  --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json | \
  aws s3api delete-objects --bucket "$BUCKET" --delete file:///dev/stdin

# 刪除儲存桶
aws s3api delete-bucket --bucket "$BUCKET"
```

#### 問題 5：建置 EC2 阻擋子網刪除

如果建置 EC2 執行個體殘留在 VPC 中，Networking stack 子網刪除將失敗：

```bash
# 終止建置 EC2
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[?Tags[?Key==`Name` && contains(Value, `build`)]].InstanceId' \
  --output text --region ap-northeast-1
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region ap-northeast-1

# 等待 60 秒後重試 Networking stack 刪除
sleep 60
aws cloudformation delete-stack --stack-name <PREFIX>-Networking --regio
```

#### 問題 6：使用現有 FSx 參考模式時的 cdk destroy

使用 `existingFileSystemId` 指定部署時，`cdk destroy` 不會刪除 FSx/SVM/Volume（CDK 管理外）。S3 Vectors 向量儲存桶和索引會正常刪除。

#### 建議：完整清理腳本

避免上述問題的完整刪除程序已自動化在 `demo-data/scripts/cleanup-all.sh` 中：

```bash
bash demo-data/scripts/cleanup-all.sh
```

此腳本依序執行以下操作：
1. 刪除手動建立的資源（S3 AP、ECR、CodeBuild、CodeBuild S3 儲存桶）
2. 刪除 Bedrock KB 資料來源（CDK destroy 前必須）
3. 刪除動態建立的 Bedrock Agent（CDK 管理外的 Agent）
4. 刪除企業 Agent 功能資源（EventBridge Scheduler 排程和群組、S3 共享儲存桶）
5. 刪除 Embedding stack（如果存在）
6. CDK destroy（所有 stack）
7. 個別刪除剩餘 stack + 孤立 AD SG 刪除
8. 刪除 VPC 中非 CDK 管理的 EC2 執行個體和 SG + Networking stack 重新刪除
9. CDKToolkit + CDK staging S3 儲存桶刪除（兩個區域，版本控制感知）

## WAF 與地理限制配置

### WAF 規則配置

CloudFront WAF 部署到 `us-east-1`，由 6 條規則組成（按優先順序評估）。

| 優先順序 | 規則名稱 | 類型 | 說明 |
|----------|----------|------|------|
| 100 | RateLimit | 自訂 | 單一 IP 位址在 5 分鐘內超過 3000 個請求時阻擋 |
| 200 | AWSIPReputationList | AWS 受管 | 阻擋殭屍網路和 DDoS 來源等惡意 IP 位址 |
| 300 | AWSCommonRuleSet | AWS 受管 | OWASP Top 10 合規通用規則（XSS、LFI、RFI 等）。為 RAG 請求相容性排除 `GenericRFI_BODY`、`SizeRestrictions_BODY`、`CrossSiteScripting_BODY` |
| 400 | AWSKnownBadInputs | AWS 受管 | 阻擋利用已知漏洞的請求，例如 Log4j（CVE-2021-44228） |
| 500 | AWSSQLiRuleSet | AWS 受管 | 偵測並阻擋 SQL 注入攻擊模式 |
| 600 | IPAllowList | 自訂（可選） | 僅在配置 `allowedIps` 時啟用。阻擋不在列表中的 IP |

### 地理限制

在 CloudFront 層級套用地理存取限制。這是與 WAF 分開的保護層。

- 預設：僅限日本（`JP`）
- 透過 CloudFront 的 `GeoRestriction.allowlist` 實作
- 來自非允許國家的存取返回 `403 Forbidden`

### 配置

修改 `cdk.context.json` 中的以下值。

```json
{
  "allowedIps": ["203.0.113.0/24", "198.51.100.1/32"],
  "allowedCountries": ["JP", "US"]
}
```

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `allowedIps` | string[] | `[]`（無限制） | 允許的 IP 位址 CIDR 列表。為空時，IP 過濾規則本身不會建立 |
| `allowedCountries` | string[] | `["JP"]` | CloudFront 地理限制允許的國家代碼（ISO 3166-1 alpha-2） |

### 自訂範例

若要變更速率限制閾值或新增/排除規則，直接編輯 `lib/stacks/demo/demo-waf-stack.ts`。

```typescript
// 將速率限制變更為 1000 req/5min
rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' },

// 變更 Common Rule Set 排除規則
excludedRules: [
  { name: 'GenericRFI_BODY' },
  { name: 'SizeRestrictions_BODY' },
  // 移除此行以從排除列表中移除 CrossSiteScripting_BODY（啟用它）
],
```

變更後，使用 `npx cdk deploy --all --app "npx ts-node bin/demo-app.ts"` 套用。由於 WAF stack 部署到 `us-east-1`，會自動執行跨區域部署。

## 嵌入伺服器（可選）

透過 CIFS 掛載 FlexCache Cache volume 並執行嵌入的 EC2 伺服器。當 FSx ONTAP S3 Access Point 不可用時（截至 2026 年 3 月，FlexCache Cache volume 不支援）作為替代路徑使用。

### 資料擷取路徑

本系統使用單一路徑架構：FSx ONTAP → S3 Access Point → Bedrock KB。Bedrock KB 管理所有文件擷取、分塊、向量化和儲存。

```
FSx ONTAP Volume (/data)
  ├── public/company-overview.md
  ├── public/company-overview.md.metadata.json
  ├── confidential/financial-report.md
  ├── confidential/financial-report.md.metadata.json
  └── ...
      │ S3 Access Point
      ▼
  Bedrock KB Data Source (S3 AP alias)
      │ Ingestion Job (chunking + vectorization with Titan Embed v2)
      ▼
  Vector Store (selected via vectorStoreType)
    ├── S3 Vectors (default: low cost, sub-second latency)
    └── OpenSearch Serverless (high performance, ~$700/month)
```

Bedrock KB Ingestion Job 執行的處理：
1. 透過 S3 Access Point 從 FSx ONTAP 讀取文件和 `.metadata.json`
2. 文件分塊
3. 使用 Amazon Titan Embed Text v2（1024 維度）進行向量化
4. 將向量 + 中繼資料（包含 `allowed_group_sids`）儲存到向量儲存

> **Ingestion Job 配額和設計考量**：限制包括每個 job 100GB/每個檔案 50MB、不能對同一 KB 進行平行同步、StartIngestionJob API 速率 0.1 req/sec（每 10 秒一次）等。包含定期同步排程方法的詳情，請參閱 [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md#bedrock-kb-ingestion-job--クォータと設計考慮点)。

搜尋流程：
```
App → Bedrock KB Retrieve API → Vector Store (vector search)
  → Search results + metadata (allowed_group_sids) returned
  → App-side SID filtering → Converse API (response generation)
```

### 嵌入目標文件配置

嵌入到 Bedrock KB 中的文件由 FSx ONTAP volume 上的檔案結構決定。

#### 目錄結構和 SID 中繼資料

```
FSx ONTAP Volume (/data)
  ├── public/                          ← 所有使用者可存取
  │   ├── product-catalog.md           ← 文件本體
  │   └── product-catalog.md.metadata.json  ← SID 中繼資料
  ├── confidential/                    ← 僅管理員
  │   ├── financial-report.md
  │   └── financial-report.md.metadata.json
  └── restricted/                      ← 僅特定群組
      ├── project-plan.md
      └── project-plan.md.metadata.json
```

#### .metadata.json 格式

在每個文件對應的 `.metadata.json` 檔案中設定基於 SID 的存取控制。

```json
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-1-0\"]",
    "access_level": "public",
    "doc_type": "catalog"
  }
}
```

| 欄位 | 必要 | 說明 |
|------|------|------|
| `allowed_group_sids` | ✅ | 允許存取的 SID JSON 陣列字串。`S-1-1-0` 為 Everyone |
| `access_level` | 可選 | UI 顯示用的存取等級（`public`、`confidential`、`restricted`） |
| `doc_type` | 可選 | 文件類型（供未來過濾使用） |

#### 關鍵 SID 值

| SID | 名稱 | 用途 |
|-----|------|------|
| `S-1-1-0` | Everyone | 發布給所有使用者的文件 |
| `S-1-5-21-...-512` | Domain Admins | 僅管理員可存取的文件 |
| `S-1-5-21-...-1100` | Engineering | 工程群組的文件 |

> **詳情**：SID 過濾機制請參閱 [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md)。

#### S3 Vectors 中繼資料限制和注意事項

使用 S3 Vectors 配置（`vectorStoreType=s3vectors`）時，請注意以下中繼資料限制。

| 限制 | 值 | 影響 |
|------|-----|------|
| 可過濾中繼資料 | 2KB/向量 | 包含 Bedrock KB 內部中繼資料（約 1KB），自訂中繼資料實際上為 **1KB 以下** |
| 不可過濾中繼資料鍵 | 最多 10 個鍵/索引 | Bedrock KB 自動鍵（5 個）+ 自訂鍵（5 個）即達上限 |
| 總中繼資料 | 40KB/向量 | 通常不是問題 |

CDK 程式碼中實作了以下緩解措施：
- Bedrock KB 自動分配的中繼資料鍵（`x-amz-bedrock-kb-chunk-id` 等，5 個鍵）設定為 `nonFilterableMetadataKeys`
- 包含 `allowed_group_sids` 在內的所有自訂中繼資料也設定為不可過濾
- SID 過濾透過 Bedrock KB Retrieve API 中繼資料返回 + 應用程式端比對實現（不使用 S3 Vectors QueryVectors 過濾）

新增自訂中繼資料時的注意事項：
- `.metadata.json` 中的鍵數量保持在 5 個以下（因為 10 個不可過濾鍵的限制）
- 保持值大小較小（建議使用縮短的 SID 值，例如 `S-1-5-21-...-512` → `S-1-5-21-512`）
- PDF 檔案會自動分配頁碼中繼資料，容易導致自訂中繼資料總量超過 2KB
- OpenSearch Serverless 配置（`vectorStoreType=opensearch-serverless`）沒有此類限制

> **詳情**：S3 Vectors 中繼資料限制驗證結果請參閱 [docs/s3-vectors-sid-architecture-guide.md](docs/s3-vectors-sid-architecture-guide.md)。

### 資料擷取路徑選擇

| 路徑 | 方法 | CDK 啟用 | 狀態 |
|------|------|----------|------|
| 主要 | FSx ONTAP → S3 Access Point → Bedrock KB → Vector Store | CDK 部署後執行 `post-deploy-setup.sh` | ✅ |
| 備用 | 直接 S3 儲存桶上傳 → Bedrock KB → Vector Store | 手動（`upload-demo-data.sh`） | ✅ |
| 替代（可選） | 嵌入伺服器（CIFS 掛載）→ 直接 AOSS 寫入 | `-c enableEmbeddingServer=true` | ✅（僅限 AOSS 配置） |

> **備用路徑**：如果 FSx ONTAP S3 AP 不可用（例如 Organization SCP 限制），您可以直接將文件 + `.metadata.json` 上傳到 S3 儲存桶並將其配置為 KB 資料來源。SID 過濾不依賴資料來源類型。

### 手動管理嵌入目標文件

您可以在不進行 CDK 部署的情況下新增、修改和刪除嵌入目標文件。

#### 新增文件

透過 FSx ONTAP S3 Access Point（主要路徑）：

```bash
# 透過 VPC 內的 EC2 或 WorkSpaces 經由 SMB 將檔案放置到 FSx ONTAP
SVM_IP=<SVM_SMB_IP>
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put new-document.md; put new-document.md.metadata.json"

# 執行 KB 同步（新增文件後必須）
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

直接 S3 儲存桶上傳（備用路徑）：

```bash
# 上傳文件 + 中繼資料到 S3 儲存桶
aws s3 cp new-document.md s3://<DATA_BUCKET>/public/new-document.md
aws s3 cp new-document.md.metadata.json s3://<DATA_BUCKET>/public/new-document.md.metadata.json

# KB 同步
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### 更新文件

覆寫文件後，重新執行 KB 同步。Bedrock KB 會自動偵測變更的文件並重新嵌入。

```bash
# 透過 SMB 覆寫文件
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put updated-document.md product-catalog.md"

# KB 同步（變更偵測 + 重新嵌入）
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### 刪除文件

```bash
# 透過 SMB 刪除文件
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; del old-document.md; del old-document.md.metadata.json"

# KB 同步（刪除偵測 + 從向量儲存中移除）
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### 變更 SID 中繼資料（存取權限變更）

若要變更文件存取權限，更新 `.metadata.json` 並執行 KB 同步。

```bash
# 範例：將公開文件變更為機密
cat > financial-report.md.metadata.json << 'EOF'
{"metadataAttributes":{"allowed_group_sids":"[\"S-1-5-21-...-512\"]","access_level":"confidential","doc_type":"financial"}}
EOF

smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd confidential; put financial-report.md.metadata.json"

# KB 同步
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

> **注意**：新增、更新或刪除文件後務必執行 KB 同步。不同步的話，變更不會反映在向量儲存中。同步通常在 30 秒到 2 分鐘內完成。

## 權限感知 RAG 的運作方式

### 處理流程（2 階段方法：Retrieve + Converse）

```
User              Next.js API             DynamoDB            Bedrock KB         Converse API
  |                    |                      |                    |                  |
  | 1. Send query      |                      |                    |                  |
  |------------------->|                      |                    |                  |
  |                    | 2. Get user SIDs     |                    |                  |
  |                    |--------------------->|                    |                  |
  |                    |<---------------------|                    |                  |
  |                    | userSID + groupSIDs  |                    |                  |
  |                    |                      |                    |                  |
  |                    | 3. Retrieve API      |                    |                  |
  |                    |  (vector search)     |                    |                  |
  |                    |--------------------->|------------------->|                  |
  |                    |<---------------------|                    |                  |
  |                    | Results + metadata   |                    |                  |
  |                    |  (allowed_group_sids)|                    |                  |
  |                    |                      |                    |                  |
  |                    | 4. SID matching      |                    |                  |
  |                    | userSIDs n docSIDs   |                    |                  |
  |                    | -> Match: ALLOW      |                    |                  |
  |                    | -> No match: DENY    |                    |                  |
  |                    |                      |                    |                  |
  |                    | 5. Generate answer   |                    |                  |
  |                    |  (allowed docs only) |                    |                  |
  |                    |--------------------->|------------------->|----------------->|
  |                    |<---------------------|                    |                  |
  |                    |                      |                    |                  |
  | 6. Filtered result |                      |                    |                  |
  |<-------------------|                      |                    |                  |
```

1. 使用者透過聊天發送問題
2. 從 DynamoDB `user-access` 表擷取使用者的 SID 列表（個人 SID + 群組 SID）
3. Bedrock KB Retrieve API 執行向量搜尋以擷取相關文件（中繼資料包含 SID 資訊）
4. 將每個文件的 `allowed_group_sids` 與使用者的 SID 列表進行比對，僅允許匹配的文件
5. 透過 Converse API 僅使用使用者有權存取的文件作為上下文生成回應
6. 顯示過濾後的回應和引用資訊

### SID 過濾的運作方式

每個文件透過 `.metadata.json` 附加 NTFS ACL SID 資訊。搜尋時，使用者 SID 與文件 SID 進行比對，僅在匹配時允許存取。

```
■ 管理員使用者：SID = [...-512 (Domain Admins), S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 匹配 → ✅ 允許
  confidential/ (Domain Admins) → ...-512 匹配 → ✅ 允許
  restricted/ (Engineering+DA) → ...-512 匹配 → ✅ 允許

■ 一般使用者：SID = [...-1001, S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 匹配 → ✅ 允許
  confidential/ (Domain Admins) → 不匹配    → ❌ 拒絕
  restricted/ (Engineering+DA) → 不匹配    → ❌ 拒絕
```

詳情請參閱 [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md)。

## 技術堆疊

| 層級 | 技術 |
|------|------|
| IaC | AWS CDK v2 (TypeScript) |
| 前端 | Next.js 15 + React 18 + Tailwind CSS |
| 認證 | Amazon Cognito |
| AI/RAG | Amazon Bedrock Knowledge Base + S3 Vectors / OpenSearch Serverless |
| 嵌入 | Amazon Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`, 1024 dimensions) |
| 儲存 | Amazon FSx for NetApp ONTAP + S3 |
| 運算 | Lambda Web Adapter + CloudFront |
| 權限 | DynamoDB (user-access: SID data, perm-cache: permission cache) |
| 安全 | AWS WAF + IAM Auth + OAC + Geo Restriction |

## 驗證情境

權限過濾驗證程序請參閱 [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md)。

當兩種類型的使用者（管理員和一般使用者）提出相同問題時，您可以確認根據存取權限返回不同的搜尋結果。

## 文件列表

| 文件 | 內容 |
|------|------|
| [docs/implementation-overview.md](docs/implementation-overview.md) | 詳細實作說明（13 個面向） |
| [docs/ui-specification.md](docs/ui-specification.md) | UI 規格（KB/Agent 模式切換、Agent 目錄、側邊欄設計、引用顯示） |
| [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) | 基於 SID 的權限過濾架構詳情 |
| [docs/embedding-server-design.md](docs/embedding-server-design.md) | 嵌入伺服器設計（包含 ONTAP ACL 自動擷取） |
| [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md) | CDK stack 架構指南（向量儲存比較、實作洞察） |
| [docs/verification-report.md](docs/verification-report.md) | 部署後驗證程序和測試案例 |
| [docs/demo-recording-guide.md](docs/demo-recording-guide.md) | 驗證示範影片錄製指南（6 項證據） |
| [docs/demo-environment-guide.md](docs/demo-environment-guide.md) | 驗證環境設定指南 |
| [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) | 文件索引（建議閱讀順序） |
| [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) | 驗證情境（管理員 vs. 一般使用者權限差異確認） |
| [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD 整合、CIFS 共享、NTFS ACL 配置 |

## FSx ONTAP + Active Directory 設定

FSx ONTAP AD 整合、CIFS 共享和 NTFS ACL 配置程序請參閱 [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md)。

CDK 部署會建立 AWS Managed Microsoft AD 和 FSx ONTAP（SVM + Volume）。SVM AD 網域加入在部署後透過 CLI 執行（用於時序控制）。

```bash
# 取得 AD DNS IP
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# 將 SVM 加入 AD
# 注意：對於 AWS Managed AD，必須指定 OrganizationalUnitDistinguishedName
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id <SVM_ID> \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": <AD_DNS_IPS>,
      "FileSystemAdministratorsGroup": "Domain Admins",
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1
```

> **重要**：對於 AWS Managed AD，如果未指定 `OrganizationalUnitDistinguishedName`，SVM AD 加入將變為 `MISCONFIGURED`。OU 路徑格式為 `OU=Computers,OU=<AD ShortName>,DC=<domain>,DC=<tld>`。

S3 Access Point 的設計決策（WINDOWS 使用者類型、Internet 存取）也記錄在指南中。

### S3 Access Point 使用者設計指南

建立 S3 Access Point 時指定的使用者類型和使用者名稱的組合，根據磁碟區的安全樣式和 AD 加入狀態有 4 種模式。

#### 4 種模式決策矩陣

| 模式 | 使用者類型 | 使用者來源 | 條件 | CDK 參數範例 |
|------|-----------|-----------|------|-------------|
| A | WINDOWS | 現有 AD 使用者 | 已加入 AD 的 SVM + NTFS/UNIX 磁碟區 | `s3apUserType=WINDOWS`（預設） |
| B | WINDOWS | 新建專用使用者 | 已加入 AD 的 SVM + 專用服務帳戶 | `s3apUserType=WINDOWS s3apUserName=s3ap-service` |
| C | UNIX | 現有 UNIX 使用者 | 未加入 AD 或 UNIX 磁碟區 | `s3apUserType=UNIX`（預設） |
| D | UNIX | 新建專用使用者 | 未加入 AD + 專用使用者 | `s3apUserType=UNIX s3apUserName=s3ap-user` |

#### 模式選擇流程圖

```
SVM 是否已加入 AD？
  ├── 是 → NTFS 磁碟區？
  │           ├── 是 → 模式 A（WINDOWS + 現有 AD 使用者）推薦
  │           └── 否 → 模式 A 或 C（兩者皆可）
  └── 否 → 模式 C（UNIX + root）推薦
```

#### 各模式詳細說明

**模式 A：WINDOWS + 現有 AD 使用者（推薦：NTFS 環境）**

```bash
# CDK 部署
npx cdk deploy --all -c adPassword=<PASSWORD> -c volumeSecurityStyle=NTFS
# → S3 AP: WINDOWS, Admin（自動設定）
```

- 基於 NTFS ACL 的檔案層級存取控制已啟用
- 透過 AD 的 `Admin` 使用者進行 S3 AP 檔案存取
- 重要：不要加上網域前綴（`DEMO\Admin`）。僅指定 `Admin`

**模式 B：WINDOWS + 新建專用使用者**

```bash
# 1. 在 AD 中建立專用服務帳戶（PowerShell）
New-ADUser -Name "s3ap-service" -AccountPassword (ConvertTo-SecureString "P@ssw0rd" -AsPlainText -Force) -Enabled $true

# 2. CDK 部署
npx cdk deploy --all -c adPassword=<PASSWORD> -c s3apUserName=s3ap-service
```

- 基於最小權限原則的專用帳戶
- 可在稽核日誌中明確識別 S3 AP 存取

**模式 C：UNIX + 現有 UNIX 使用者（推薦：UNIX 環境）**

```bash
# CDK 部署（無 AD 設定）
npx cdk deploy --all -c volumeSecurityStyle=UNIX
# → S3 AP: UNIX, root（自動設定）
```

- 基於 POSIX 權限（uid/gid）的存取控制
- 使用 `root` 使用者可存取所有檔案
- SID 過濾基於 `.metadata.json` 的中繼資料運作（不依賴檔案系統 ACL）

**模式 D：UNIX + 新建專用使用者**

```bash
# 1. 透過 ONTAP CLI 建立專用 UNIX 使用者
vserver services unix-user create -vserver <SVM_NAME> -user s3ap-user -id 1100 -primary-gid 0

# 2. CDK 部署
npx cdk deploy --all -c volumeSecurityStyle=UNIX -c s3apUserType=UNIX -c s3apUserName=s3ap-user
```

- 基於最小權限原則的專用帳戶
- 使用 `root` 以外的使用者存取時，需要設定磁碟區的 POSIX 權限

#### 與 SID 過濾的關係

SID 過濾不依賴於 S3 AP 的使用者類型。所有模式中運作相同的邏輯：

```
.metadata.json 中的 allowed_group_sids
  ↓
透過 Bedrock KB Retrieve API 作為中繼資料回傳
  ↓
在 route.ts 中與使用者 SID（DynamoDB user-access）進行比對
  ↓
比對成功 → ALLOW，不符 → DENY
```

無論是 NTFS 磁碟區還是 UNIX 磁碟區，只要在 `.metadata.json` 中記錄了 SID 資訊，就會套用相同的 SID 過濾。

## 授權

[Apache License 2.0](LICENSE)
