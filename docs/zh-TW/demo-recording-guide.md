# 驗證示範影片錄製指南

**🌐 Language:** [日本語](../demo-recording-guide.md) | [English](../en/demo-recording-guide.md) | [한국어](../ko/demo-recording-guide.md) | [简体中文](../zh-CN/demo-recording-guide.md) | **繁體中文** | [Français](../fr/demo-recording-guide.md) | [Deutsch](../de/demo-recording-guide.md) | [Español](../es/demo-recording-guide.md)

**最後更新**: 2026-03-29  
**目的**: Permission-Aware RAG 系統驗證示範影片的逐步錄製指南  
**前提條件**: AWS 帳戶（AdministratorAccess 同等權限）、EC2 執行個體（Ubuntu 22.04、t3.large 以上、50GB EBS）

---

## 需要錄製的證據（6 項）

| # | 證據 | 內容 |
|---|------|------|
| (1) | 建構基於 RAG 的 AI 聊天機器人平台 | 架構說明 |
| (2) | 使用 AWS CDK 部署聊天機器人平台 | CDK 部署流程 |
| (3) | 將儲存資料放置於 FSx ONTAP 磁碟區 | 透過 S3 Access Point 進行資料匯入 |
| (4) | 反映存取權限資訊 | 在 `.metadata.json` 中設定並驗證 SID 資訊 |
| (5) | 根據每位使用者的權限判斷資料存取 | SID 過濾驗證 |
| (6) | 初始驗證 | 驗證卡片 UI、KB/Agent 模式及引用顯示 |

---

## 準備工作

### 啟動 EC2 執行個體

```bash
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

### 在 EC2 上安裝必要工具

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io jq

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

sudo npm install -g aws-cdk typescript ts-node
```

### 複製儲存庫

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

---

## 證據 (1)：建構基於 RAG 的 AI 聊天機器人平台

**錄製內容**：系統架構說明

### 架構圖

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
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └──────────────────┘
```

### 需要說明的 8 個元件

1. **Next.js RAG Chatbot on AWS Lambda** — 透過 Lambda Web Adapter 實現無伺服器執行。卡片式任務導向 UI
2. **AWS WAF** — 速率限制、IP 信譽、OWASP 合規規則、SQLi 防護
3. **IAM 認證** — Lambda Function URL IAM Auth + CloudFront OAC (SigV4)
4. **向量儲存** — S3 Vectors（預設，低成本）/ OpenSearch Serverless（高效能，透過 `vectorStoreType` 選擇）
5. **FSx ONTAP + S3 Access Point** — 透過 S3 AP 直接向 Bedrock KB 提供文件
6. **Titan Embed Text v2** — Amazon Bedrock 文字向量化模型（1024 維度）
7. **SID 過濾** — 使用 NTFS ACL SID 資訊進行文件層級存取控制
8. **KB/Agent 模式切換** — KB 模式（文件搜尋）和 Agent 模式（動態 Agent 建立 + 多步驟推理）

### 錄製流程

1. 在螢幕上顯示 `docs/implementation-overview.md`
2. 展示架構圖的同時說明各元件
3. 說明 CDK 堆疊結構（7 個堆疊）
4. 說明 SID 過濾流程圖

---

## 證據 (2)：使用 AWS CDK 部署聊天機器人平台

**錄製內容**：CDK 部署執行及完成驗證

### 步驟 1：部署前設定（ECR 映像準備）

```bash
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK

# 建立 ECR 儲存庫 + 建構 Docker 映像 + 推送
bash demo-data/scripts/pre-deploy-setup.sh
```

### 步驟 2：CDK 部署（全部 6 個堆疊）

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

> **預估時間**：約 30-40 分鐘（FSx ONTAP 建立需 20-30 分鐘）

### 步驟 3：部署後設定（單一指令）

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

自動執行的任務：
1. S3 Access Point 建立 + 政策設定
2. 透過 S3 AP 上傳示範資料至 FSx ONTAP
3. Bedrock KB 資料來源新增 + 同步
4. 在 DynamoDB 中註冊使用者 SID 資料
5. 在 Cognito 中建立示範使用者

### 步驟 4：部署驗證

```bash
bash demo-data/scripts/verify-deployment.sh
```

### 錄製重點

- `pre-deploy-setup.sh` 的執行（ECR 映像準備）
- `cdk deploy --all` 執行畫面
- `post-deploy-setup.sh` 的執行（S3 AP 建立 → KB 同步 → 使用者建立）
- `verify-deployment.sh` 的測試結果

---

## 證據 (3)：將儲存資料放置於 FSx ONTAP 磁碟區

**錄製內容**：驗證透過 S3 Access Point 進行的資料匯入

`post-deploy-setup.sh` 會自動透過 S3 AP 上傳示範資料。手動驗證方式：

```bash
STACK_PREFIX="perm-rag-demo-demo"
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)

# 透過 S3 AP 列出檔案
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region ap-northeast-1
```

### 錄製重點

- 顯示透過 S3 AP 的檔案列表
- 驗證文件內容（3 種類型：public / confidential / restricted）

---

## 證據 (4)：反映存取權限資訊

**錄製內容**：透過 `.metadata.json` 驗證 SID 資訊

```bash
# 透過 S3 AP 檢查 .metadata.json
aws s3 cp "s3://${S3AP_ALIAS}/public/company-overview.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/confidential/financial-report.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/restricted/project-plan.md.metadata.json" - | python3 -m json.tool
```

### SID 與存取權限對應

| 目錄 | allowed_group_sids | 管理員 | 一般使用者 |
|------|-------------------|--------|-----------|
| `public/` | `S-1-1-0` (Everyone) | ✅ 可檢視 | ✅ 可檢視 |
| `confidential/` | `...-512` (Domain Admins) | ✅ 可檢視 | ❌ 不可檢視 |
| `restricted/` | `...-1100` + `...-512` | ✅ 可檢視 | ❌ 不可檢視 |

### 錄製重點

- 在螢幕上顯示 `.metadata.json` 內容
- 說明 SID 的含義（Everyone、Domain Admins 等）

---

## 證據 (5)：根據每位使用者的權限判斷資料存取

**錄製內容**：驗證管理員和一般使用者取得不同的搜尋結果

### 檢查 DynamoDB SID 資料

```bash
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"admin@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"user@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool
```

### 透過 curl 進行 SID 過濾驗證

```bash
LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 管理員使用者
echo "=== admin@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"

# 一般使用者
echo "=== user@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"
```

### 錄製重點

- 在螢幕上顯示 DynamoDB SID 資料
- 強調管理員可存取所有文件，而一般使用者只能存取公開文件

---

## 證據 (6)：初始驗證 — 卡片 UI、KB/Agent 模式及引用顯示

**錄製內容**：在瀏覽器中進行端對端驗證

### 步驟 1：透過瀏覽器存取

```bash
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "Access URL: ${CF_URL}/ja/signin"
```

### 步驟 2：以管理員使用者驗證（KB 模式）

1. 以 `admin@example.com` 登入
2. 顯示卡片網格（14 張卡片：8 張研究 + 6 張輸出）
3. InfoBanner 顯示權限資訊（3 個目錄，讀取 ✅，寫入 ✅）
4. 點擊「文件搜尋」卡片 → 提示詞設定至輸入欄位
5. 詢問「公司的營業額是多少？」
6. 回應中顯示引用（FSx 檔案路徑 + 存取層級徽章）
   - `confidential/financial-report.md` — 僅限管理員（紅色徽章）
   - `public/company-overview.md` — 所有人可存取（綠色徽章）
7. 點擊「🔄 返回工作流程選擇」按鈕回到卡片網格

### 步驟 3：以管理員使用者驗證（Agent 模式）

1. 使用標題列中的「🤖 Agent」按鈕切換至 Agent 模式
2. 顯示 Agent 模式卡片網格（14 張卡片：8 張研究 + 6 張輸出）
3. 點擊「財務報告分析」卡片
4. 自動搜尋並動態建立 Bedrock Agent（首次使用需等待數秒）
5. 針對問題顯示 Agent 回應 + 引用

### 步驟 4：以一般使用者驗證

1. 登出 → 以 `user@example.com` 登入
2. InfoBanner 顯示權限資訊（僅 1 個目錄）
3. 詢問「公司的營業額是多少？」
4. 確認回應中不包含機密文件的引用
5. 詢問「請告訴我產品概覽」
6. 確認顯示公開文件的引用

### 驗證結果摘要

| 問題 | admin | user | 原因 |
|------|-------|------|------|
| 公司營業額 | ✅ 參考財務報告 | ❌ 僅公開資訊 | financial-report.md 僅限 Domain Admins |
| 遠端工作政策 | ✅ 參考人事政策 | ❌ 存取被拒絕 | hr-policy.md 僅限 Domain Admins |
| 產品概覽 | ✅ 參考產品目錄 | ✅ 參考產品目錄 | product-catalog.md 為 Everyone |

### 錄製重點

- KB 模式：卡片網格 → 提問 → 引用（檔案路徑 + 存取層級徽章）
- Agent 模式：點擊卡片 → 動態 Agent 建立 → 回應
- 管理員與一般使用者結果比較
- 「返回工作流程選擇」按鈕行為

---

## 資源清理

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## 疑難排解

| 症狀 | 原因 | 解決方式 |
|------|------|---------|
| CDK 部署時 schema version mismatch | CDK CLI 版本不符 | 使用 `npm install aws-cdk@latest` + `npx cdk` |
| KB 搜尋無結果 | 資料來源未同步 | 重新執行 `post-deploy-setup.sh` |
| 所有文件被拒絕 | SID 資料未註冊 | 重新執行 `post-deploy-setup.sh` |
| 頁面無法顯示 | CloudFront 快取 | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Docker 權限錯誤 | 未加入 docker 群組 | `sudo usermod -aG docker ubuntu && newgrp docker` |
| 動態 Agent 建立失敗 | Lambda IAM 權限不足 | 在 CDK 中指定 `enableAgent=true` 進行部署 |
