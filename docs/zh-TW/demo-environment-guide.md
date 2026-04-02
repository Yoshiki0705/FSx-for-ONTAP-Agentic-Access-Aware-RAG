# Permission-aware RAG 驗證環境指南

**🌐 Language:** [日本語](../demo-environment-guide.md) | [English](../en/demo-environment-guide.md) | [한국어](../ko/demo-environment-guide.md) | [简体中文](../zh-CN/demo-environment-guide.md) | **繁體中文** | [Français](../fr/demo-environment-guide.md) | [Deutsch](../de/demo-environment-guide.md) | [Español](../es/demo-environment-guide.md)

**最後更新**: 2026-03-25  
**區域**: ap-northeast-1（東京）

---

## 1. 存取資訊

### Web 應用程式 URL

| 端點 | URL |
|------|-----|
| CloudFront（生產） | `<CDK 部署後從 CloudFormation 輸出取得>` |
| Lambda Function URL（直接） | `<CDK 部署後從 CloudFormation 輸出取得>` |

```bash
# 擷取 URL 的指令
STACK_PREFIX="perm-rag-demo-demo"
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text
```

### 測試使用者

| 使用者 | 電子郵件 | 密碼 | 角色 | 權限 |
|--------|---------|------|------|------|
| 管理員 | `admin@example.com` | `DemoAdmin123!` | administrator | 可檢視所有文件 |
| 一般使用者 | `user@example.com` | `DemoUser123!` | user | 僅公開文件 |

認證由 Amazon Cognito 管理。

---

## 2. CDK 堆疊設定（6+1 個堆疊）

| 堆疊名稱 | 區域 | 說明 |
|---------|------|------|
| `${prefix}-Waf` | us-east-1 | CloudFront 的 WAF WebACL |
| `${prefix}-Networking` | ap-northeast-1 | VPC、子網路、安全群組 |
| `${prefix}-Security` | ap-northeast-1 | Cognito User Pool、認證 |
| `${prefix}-Storage` | ap-northeast-1 | FSx ONTAP + SVM + Volume + S3 + DynamoDB + AD |
| `${prefix}-AI` | ap-northeast-1 | Bedrock KB + S3 Vectors / OpenSearch Serverless（透過 `vectorStoreType` 選擇） |
| `${prefix}-WebApp` | ap-northeast-1 | Lambda Web Adapter (Next.js) + CloudFront |
| `${prefix}-Embedding`（選用） | ap-northeast-1 | Embedding EC2 + ECR（FlexCache CIFS 掛載） |

### 擷取資源 ID

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 一次擷取所有堆疊的輸出
for stack in Waf Networking Security Storage AI WebApp Embedding; do
  echo "=== ${STACK_PREFIX}-${stack} ==="
  aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${stack} \
    --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' --output table 2>/dev/null || echo "  (未部署)"
done
```

---

## 3. 驗證情境

### 基本流程

1. 存取 CloudFront URL → `/ja/signin`
2. 以測試使用者登入
3. **KB 模式**：在聊天畫面選擇模型 → 驗證 RAG 搜尋中的權限過濾
4. **Agent 模式**：點擊標題列中的「🤖 Agent」按鈕 → 選擇 Agent → 選擇工作流程或自由聊天

### 驗證權限差異

管理員和一般使用者詢問相同問題時，SID 過濾會回傳不同結果。
KB 模式和 Agent 模式都適用相同的權限控制。

| 範例問題 | admin（KB/Agent） | user（KB/Agent） |
|---------|-------------------|-----------------|
| 「公司的營業額是多少？」 | ✅ 參考財務報告（6/6 允許） | ❌ 僅公開資訊（2/6 允許） |
| 「遠端工作政策是什麼？」 | ✅ 參考人事政策 | ❌ 存取被拒絕 |
| 「專案計畫是什麼？」 | ✅ 參考專案計畫 | ❌ 存取被拒絕 |

### Agent 模式驗證

1. 點擊標題列中的「🤖 Agent」按鈕
2. 在側邊欄選擇 Agent（`perm-rag-demo-demo-agent`）
3. 選擇工作流程（📊 財務報告分析等）或輸入聊天訊息
4. 驗證 Agent 回應（透過 Permission-aware Action Group 套用 SID 過濾）

### 動態 Agent 建立功能

在 Agent 模式中點擊工作流程卡片時，會自動搜尋並建立對應類別的 Bedrock Agent。

| 項目 | 說明 |
|------|------|
| 觸發 | 點擊工作流程卡片 |
| 行為 | 透過 AGENT_CATEGORY_MAP 判斷類別 → 搜尋現有 Agent → 未找到時透過 CreateAgent API 動態建立 |
| 時間 | 首次建立需 30-60 秒（顯示載入 UI），第二次起因 localStorage 快取而即時 |
| Action Group | Permission-aware Action Group 自動附加至動態建立的 Agent（透過 `PERM_SEARCH_LAMBDA_ARN` 環境變數指定） |
| 快取 | 卡片-Agent 對應透過 `useCardAgentMappingStore`（Zustand + localStorage）持久化 |
| 必要權限 | Lambda IAM 角色需要 `bedrock:CreateAgent`、`bedrock:PrepareAgent`、`bedrock:CreateAgentAlias`、`bedrock:CreateAgentActionGroup`、`iam:PassRole` |

### CDK 部署選項

```bash
# Agent + 所有選項啟用
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableGuardrails=true \
  --require-approval never
```
| 「請告訴我產品概覽」 | ✅ 參考產品目錄 | ✅ 參考產品目錄 |

詳情請參閱 [demo-data/guides/demo-scenario.md](../../demo-data/guides/demo-scenario.md)。

---

## 4. Active Directory 整合

### AD 資訊

| 項目 | 值 |
|------|-----|
| 網域名稱 | `demo.local` |
| 版本 | Standard |
| DNS IP | `<AD 部署後取得>` |

```bash
# 擷取 AD 資訊
aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].{Id:DirectoryId,Stage:Stage,DnsIps:DnsIpAddrs}' \
  --output table
```

### SVM AD 加入程序

CDK 建立 SVM 時不含 AD 設定。部署後透過 CLI 加入 AD 網域。

#### 前提條件：安全群組設定

SVM AD 加入需要 FSx SG 和 AD SG 之間的通訊。CDK 設定 `allowAllOutbound: true`，但也需要以下入站規則。

```bash
# 擷取 FSx SG ID 和 AD SG ID
FSX_SG_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking \
  --query 'Stacks[0].Outputs[?OutputKey==`FsxSgId`].OutputValue' --output text)
AD_SG_ID=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].VpcSettings.SecurityGroupId' --output text)

# 將 AD 通訊連接埠加入 FSx SG（如果 CDK 中缺少）
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 135 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 636 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 123 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 1024-65535 --source-group $AD_SG_ID --region ap-northeast-1

# 雙向通訊：AD SG ↔ FSx SG 允許所有流量
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1
```

#### SVM AD 加入指令

```bash
SVM_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`SvmId`].OutputValue' --output text)
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# 重要：對於 AWS Managed AD，必須明確指定 OrganizationalUnitDistinguishedName
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

> **重要**：使用 AWS Managed AD 時，省略 `OrganizationalUnitDistinguishedName` 會導致 MISCONFIGURED 狀態。請以 `OU=Computers,OU=<NetBIOS 簡稱>,DC=<domain>,DC=<tld>` 格式指定。

#### 驗證 AD 加入狀態

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration' \
  --region ap-northeast-1 --output json
```

如果顯示 `NetBiosName` 且 `SelfManagedActiveDirectoryConfiguration` 包含網域資訊，則加入成功。

詳細程序請參閱 [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md)。

---

## 5. Knowledge Base 資料

### 選項 A：透過 S3 儲存桶（預設）

以下文件已註冊在 S3 儲存桶中。每個文件透過 `.metadata.json` 附加 SID 資訊。

| 檔案 | 存取層級 | allowed_group_sids | admin | user |
|------|---------|-------------------|-------|------|
| `public/company-overview.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `public/product-catalog.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `restricted/project-plan.md` | restricted | ...-1100, ...-512 | ✅ | ❌ |
| `confidential/financial-report.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |
| `confidential/hr-policy.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |

### 選項 B：透過 Embedding 伺服器（FlexCache CIFS 掛載）

透過 CIFS 掛載 FlexCache Cache 磁碟區，使用 Embedding 伺服器直接向量化文件，然後索引至 OpenSearch Serverless (AOSS)。這是 S3 Access Point 不可用時的替代路徑（截至 2026 年 3 月不支援 FlexCache Cache 磁碟區）。僅在 AOSS 設定（`vectorStoreType=opensearch-serverless`）下可用。

詳情請參閱 [6. Embedding 伺服器](#6-embedding-伺服器選用)。

---

## 6. Embedding 伺服器（選用）

### 概述

EmbeddingStack（第 7 個 CDK 堆疊）是一個基於 EC2 的伺服器，直接讀取 FSx ONTAP 上 CIFS 共用的文件，使用 Amazon Bedrock Titan Embed Text v2 向量化，並索引至 OpenSearch Serverless (AOSS)。僅在 AOSS 設定（`vectorStoreType=opensearch-serverless`）下可用。

### 架構

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    Mount          │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ - scan docs  │ │
                                       │ │ - embedding  │ │
                                       │ │ - indexing   │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    │（向量產生）       │              │（索引）          │
                    └──────────────────┘              └──────────────────┘
```

### 部署程序

#### 步驟 1：在 Secrets Manager 中註冊密碼

```bash
AD_SECRET_ARN=$(aws secretsmanager create-secret \
  --name perm-rag-demo-ad-password \
  --secret-string '{"password":"<AD_PASSWORD>"}' \
  --region ap-northeast-1 \
  --query 'ARN' --output text)
echo "Secret ARN: $AD_SECRET_ARN"
```

#### 步驟 2：部署 EmbeddingStack

```bash
npx cdk deploy ${STACK_PREFIX}-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=$AD_SECRET_ARN \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local \
  --require-approval never
```

#### 步驟 3：建構並推送 Docker 映像

如果 EC2 執行個體上沒有 Docker，請使用 CodeBuild。

```bash
# 擷取 ECR 儲存庫 URI
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' \
  --output text)

# 使用 CodeBuild 建構（使用 docker/embed/buildspec.yml）
pushd docker/embed && zip -r /tmp/embed-source.zip . -x "node_modules/*" && popd
aws s3 cp /tmp/embed-source.zip s3://<DATA_BUCKET>/codebuild/embed-source.zip
aws codebuild start-build --project-name embed-image-builder --region ap-northeast-1
```

如果有 Docker 環境，可以直接建構：

```bash
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

#### 步驟 4：建立 CIFS 共用

設定 FSx ONTAP 管理員密碼並透過 REST API 建立 CIFS 共用。

```bash
FS_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`FileSystemId`].OutputValue' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword":"<ADMIN_PASSWORD>"}' \
  --region ap-northeast-1

MGMT_IP=$(aws fsx describe-file-systems --file-system-ids $FS_ID \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

SVM_UUID=$(curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/svm/svms" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][0]['uuid'])")

curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  -X POST "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H "Content-Type: application/json" \
  -d "{\"svm\":{\"uuid\":\"${SVM_UUID}\"},\"name\":\"data\",\"path\":\"/data\"}"
```

#### 步驟 5：CIFS 掛載和資料匯入

```bash
EMBED_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingInstanceId`].OutputValue' --output text)

SMB_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

sudo mkdir -p /mnt/cifs-data
sudo mount -t cifs //${SMB_IP}/data /mnt/cifs-data \
  -o user=Admin,password=<AD_PASSWORD>,domain=demo.local,iocharset=utf8

sudo mkdir -p /mnt/cifs-data/{public,confidential,restricted}
# 複製每個文件和 .metadata.json
```

#### 步驟 6：更新 OpenSearch Serverless 資料存取政策

必須將 Embedding EC2 IAM 角色加入 AOSS 資料存取政策。

```bash
POLICY_VERSION=$(aws opensearchserverless get-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --query 'accessPolicyDetail.policyVersion' --output text --region ap-northeast-1)

aws opensearchserverless update-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --policy-version "$POLICY_VERSION" \
  --policy '<updated_policy_json>' \
  --region ap-northeast-1
```

#### 步驟 7：執行 Embedding 容器

```bash
sudo aws ecr get-login-password --region ap-northeast-1 | \
  sudo docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
sudo docker pull ${ECR_URI}:latest

sudo docker run -d --name embed-app \
  -v /mnt/cifs-data:/opt/netapp/ai/data \
  -v /tmp/embed-db:/opt/netapp/ai/db \
  -e ENV_REGION=ap-northeast-1 \
  -e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME=<COLLECTION_NAME> \
  -e ENV_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0 \
  -e ENV_INDEX_NAME=bedrock-knowledge-base-default-index \
  ${ECR_URI}:latest

sudo docker logs -f embed-app
```

### Embedding 應用程式結構

```
docker/embed/
├── Dockerfile          # node:22-slim 基礎，包含 cifs-utils
├── package.json        # AWS SDK v3, chokidar, dotenv
├── tsconfig.json
├── buildspec.yml       # CodeBuild 建構定義
├── .env                # 預設環境變數
└── src/
    ├── index.ts        # 主要：文件掃描 → 分塊 → embedding → 索引
    └── oss-client.ts   # OpenSearch Serverless SigV4 簽署用戶端（IMDS 認證支援）
```

### 處理流程

1. 遞迴掃描 CIFS 掛載的目錄（.md、.txt、.html 等）
2. 從每個文件的 `.metadata.json` 讀取 SID 資訊
3. 將文字分割為 1000 字元的分塊（200 字元重疊）
4. 使用 Bedrock Titan Embed Text v2 產生 1024 維度向量
5. 以 Bedrock KB 相容格式索引至 OpenSearch Serverless
6. 在 `processed.json` 中記錄已處理的檔案（支援增量處理）

---

## 7. API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/signin` | 登入（Cognito 認證） |
| POST | `/api/auth/signout` | 登出 |
| GET | `/api/auth/session` | 擷取工作階段資訊 |
| GET | `/api/bedrock/models` | 列出可用模型 |
| POST | `/api/bedrock/chat` | 聊天 |
| POST | `/api/bedrock/kb/retrieve` | RAG 搜尋（含 SID 過濾） |
| GET | `/api/health` | 健康檢查 |

---

## 8. 設定程序（部署後）

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 1. 擷取資源 ID
COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPoolId`)].OutputValue' --output text)
USER_ACCESS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
DATA_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
BEDROCK_KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 2. 建立測試使用者
export COGNITO_USER_POOL_ID
bash demo-data/scripts/create-demo-users.sh

# 3. 註冊 SID 資料（應用程式的 JWT 使用電子郵件作為 userId）
export USER_ACCESS_TABLE_NAME
bash demo-data/scripts/setup-user-access.sh

# 4. 上傳測試資料
export DATA_BUCKET_NAME
bash demo-data/scripts/upload-demo-data.sh

# 5. 同步 KB
export BEDROCK_KB_ID
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## 9. 疑難排解

| 症狀 | 原因 | 解決方式 |
|------|------|---------|
| 無法登入 | Cognito 使用者未建立 | 執行 `create-demo-users.sh` |
| KB 搜尋無結果 | 資料來源未同步 | 執行 `sync-kb-datasource.sh` |
| 所有文件被拒絕 | SID 資料未註冊 | 執行 `setup-user-access.sh` |
| SVM AD 加入為 MISCONFIGURED | 未指定 OU 或 SG 不足 | 明確指定 OU 路徑 + 允許 FSx/AD SG 之間的通訊 |
| Embedding 403 Forbidden | AOSS 資料存取政策缺失 | 將 Embedding EC2 角色加入 AOSS 政策 |
| Embedding 容器認證錯誤 | IMDS hop limit 不足 | 驗證 EC2 metadata hop limit = 2 |
| 頁面無法顯示 | CloudFront 快取 | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| 冷啟動延遲 | Lambda 初始啟動 | 等待 10-15 秒（正常行為） |


---

## 環境刪除

### 刪除注意事項

您可以使用 `cdk destroy --all` 刪除所有資源，但由於以下相依性可能需要手動介入。

| 問題 | 原因 | CDK 處理 |
|------|------|---------|
| AI 堆疊刪除失敗 | KB 中殘留資料來源 | ✅ 由 KbCleanup 自訂資源自動刪除 |
| Storage 堆疊刪除失敗 | S3 AP 附加至磁碟區 | ✅ 由 S3 AP 自訂資源 Delete 處理程式自動刪除 |
| Networking 堆疊刪除失敗 | AD Controller SG 成為孤立 | ❌ 需手動刪除（見下方腳本） |
| Embedding 堆疊未被識別 | 取決於 CDK context | ❌ 需先手動刪除 |
| 手動建立的資源殘留 | CodeBuild、ECR、IAM 政策 | ❌ 使用下方腳本刪除 |

### 建議的刪除程序

```bash
# 1. 刪除 Embedding 堆疊（如果存在）
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null

# 2. 刪除 KB 資料來源
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ]; then
  for DS_ID in $(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null); do
    aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
  done
  sleep 10
fi

# 3. 刪除 S3 AP
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1 2>/dev/null
sleep 30

# 4. CDK destroy
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force

# 5. 刪除孤立的 AD SG（使用 Managed AD 時）
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region ap-northeast-1 \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null)
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
    --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region ap-northeast-1
  done
  aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
  aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
fi
```