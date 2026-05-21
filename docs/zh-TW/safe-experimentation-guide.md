# 安全實驗指南

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | [English](../en/safe-experimentation-guide.md) | [한국어](../ko/safe-experimentation-guide.md) | [简体中文](../zh-CN/safe-experimentation-guide.md) | **繁體中文** | [Français](../fr/safe-experimentation-guide.md) | [Deutsch](../de/safe-experimentation-guide.md) | [Español](../es/safe-experimentation-guide.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標讀者**: PoC 使用者、開發人員、評估人員

---

## 概述

本文件提供安全實驗 Permission-aware RAG 系統的範圍定義、禁止操作和回滾程序。闡明「在負責任 AI 政策和安全邊界內可以反覆試驗的環境。」

---

## 安全實驗範圍

### ✅ 建議：僅使用展示資料進行實驗

| 操作 | 風險 | 備註 |
|------|------|------|
| 使用展示資料進行搜尋測試 | 無 | 使用內建範例資料驗證運作 |
| 透過使用者切換進行權限驗證 | 無 | 確認 admin / user 之間的搜尋結果差異 |
| Agent 模式實驗 | 無 | 在 Agent Directory 中建立和測試 Agent |
| UI 自訂 | 無 | Next.js 原始碼變更 |
| CDK 參數變更 | 低 | `cdk.context.json` 變更 → 重新部署 |
| 新增文件 | 低 | 新增至展示資料資料夾 |
| Guardrails 政策調整 | 低 | `guardrailsConfig` 變更 |
| Smart Routing 開/關 | 無 | 側邊欄切換 |
| 模型選擇變更 | 低 | 可能產生成本變動 |
| 語音聊天實驗 | 低 | 使用 `enableVoiceChat=true` 啟用 |

### ⚠️ 注意：匯入實際資料前的檢查清單

匯入實際商業資料前請驗證以下項目：

- [ ] **資料分類完成**：待匯入資料的機密等級已分類
- [ ] **PII 驗證**：若包含個人資訊，遮罩或核准已完成
- [ ] **權限設計驗證**：`.metadata.json` 中的 `allowed_group_sids` 已正確設定
- [ ] **稽核日誌啟用**：CloudWatch Logs / CloudTrail 已啟用
- [ ] **存取限制驗證**：WAF / 地理限制 / IP 限制已適當設定
- [ ] **備份驗證**：FSx 自動備份已啟用
- [ ] **使用者通知**：PoC 參與者已被告知資料處理規則
- [ ] **資料刪除程序確認**：PoC 完成後的資料刪除程序已確認

### ❌ 禁止操作

| 禁止操作 | 原因 | 替代方案 |
|----------|------|----------|
| 直接連接生產 AD（PoC 階段） | 影響生產環境的風險 | 使用測試 AD / Cognito 電子郵件認證 |
| 匯入未分類 PII 的資料 | 個人資訊洩漏風險 | PII 掃描後再匯入 |
| 未啟用稽核日誌即使用機密資料 | 合規違規 | 啟用稽核日誌後再匯入 |
| 未加密儲存機密資料 | 資料洩漏風險 | 設定 `enableKmsEncryption=true` |
| 允許從公共網際網路存取 | 未授權存取風險 | 使用 IP 限制 / VPN |
| 在生產帳戶中執行 PoC | 影響生產環境 | 使用沙箱帳戶 |
| 停用 Guardrails 使用機密資料 | 產生不當回答的風險 | 設定 `enableGuardrails=true` |


---

## 僅使用展示資料的實驗程序

### 步驟 1：以最小設定部署

```bash
# 最小 cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# 部署
npx cdk deploy --all --require-approval never

# 測試資料 + 使用者建立
bash demo-data/scripts/post-deploy-setup.sh
```

### 步驟 2：驗證運作

```bash
# 取得 CloudFront URL
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "Access URL: $URL"
```

### 步驟 3：驗證權限過濾

1. 以 `admin@example.com` 登入 → 所有文件皆可搜尋
2. 以 `user@example.com` 登入 → 僅公開文件可搜尋
3. 確認相同問題回傳不同回答

### 步驟 4：評估

使用 [evaluation.md](evaluation.md) 中的評估範本進行 PoC 評估。

---

## 實際資料匯入程序（檢查清單完成後）

### 步驟 1：資料準備

```bash
# 1. 分類文件
# 為每個文件建立 .metadata.json
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. PII 掃描（建議）
# 使用 Amazon Comprehend 偵測 PII
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### 步驟 2：資料匯入

```bash
# 將檔案放置於 FSx 磁碟區（透過 SMB）
# 或使用 S3 bucket fallback 路徑
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### 步驟 3：KB 同步

```bash
# 執行 KB 同步
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 等待同步完成
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### 步驟 4：權限測試

```bash
# 執行權限矩陣測試
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## 回滾 / 環境刪除程序

### 部分回滾（僅刪除資料）

```bash
# 1. 清除 KB 資料來源同步
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. 刪除 S3 bucket 資料
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. 刪除 DynamoDB 使用者資料
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### 完全刪除（所有資源）

```bash
# 1. 清空 S3 bucket（若啟用版本控制）
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy（刪除所有堆疊）
npx cdk destroy --all --force

# 3. 刪除 CDK Bootstrap 資源（如需要）
# ⚠️ 若存在其他 CDK 專案請勿刪除
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### 成本清理驗證

```bash
# 檢查殘留資源
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# 檢查 FSx 檔案系統（刪除需要時間）
aws fsx describe-file-systems --region ap-northeast-1

# 檢查 OpenSearch Serverless collections
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## 疑難排解

### 常見問題與解決方案

| 問題 | 原因 | 解決方案 |
|------|------|----------|
| 部署超過 40 分鐘 | FSx for ONTAP 建立需要時間 | 正常。FSx 建立需要 20–30 分鐘 |
| 搜尋回傳 0 結果 | KB 同步未完成或資料來源未設定 | 驗證 `StartIngestionJob` 執行 |
| 所有使用者結果相同 | SID 資料未註冊 | 檢查 DynamoDB `user-access` 表 |
| Fail-Closed 拒絕所有 | DynamoDB 連線錯誤或無 SID 記錄 | 檢查 Lambda 日誌 |
| Agent 無法運作 | Agent 未建立或不在 PREPARED 狀態 | 在 Bedrock 主控台檢查 Agent 狀態 |
| 成本高於預期 | OpenSearch Serverless OCU | 切換至 `vectorStoreType=s3vectors` |

### 支援資源

| 資源 | URL |
|------|-----|
| GitHub Issues | Repository Issues 分頁 |
| AWS 文件（Bedrock） | https://docs.aws.amazon.com/bedrock/ |
| AWS 文件（FSx ONTAP） | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [evaluation.md](evaluation.md) | RAG / Agent 評估指標 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生產就緒檢查清單 |
| [governance-and-audit.md](governance-and-audit.md) | 治理與稽核設計 |
| [permission-consistency.md](permission-consistency.md) | 權限變更一致性模型 |
