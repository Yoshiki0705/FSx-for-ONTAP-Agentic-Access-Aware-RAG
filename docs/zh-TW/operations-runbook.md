# 運維 Runbook

**🌐 語言:** [日本語](../operations-runbook.md) | [English](../en/operations-runbook.md) | **繁體中文**

**建立日期**: 2026-06-08  
**狀態**: 運營中  
**對象**: 維運人員、開發者、合作夥伴

---

## 概述

整合 Permission-aware RAG 系統日常維運、驗證及故障排除程序的 Runbook。將部署驗證中獲得的知識系統化為可重現的操作流程。

---

## 1. ONTAP 版本確認

### 背景

S3 Access Points 需要 ONTAP 9.14.1 以上版本。FSx for ONTAP AWS API（`describe-file-systems`）不會傳回版本資訊，需要直接存取 ONTAP REST API。

### 先決條件

- FSx Management 端點 IP（例：`10.0.3.72`）
- `fsxadmin` 密碼（儲存於 Secrets Manager）
- 同一 VPC 內啟用 SSM 的執行個體（Management 端點僅限 Private IP）

### 操作步驟

```bash
# Step 1: Retrieve fsxadmin password from Secrets Manager
FSX_PASS=$(aws secretsmanager get-secret-value \
  --secret-id fsx-ontap-fsxadmin-credentials \
  --region ap-northeast-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['password'])")

# Step 2: Access ONTAP REST API from instance in same VPC
INSTANCE_ID="<SSM-enabled-instance-id>"
MGMT_IP="10.0.3.72"

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"curl -sk -u 'fsxadmin:${FSX_PASS}' 'https://${MGMT_IP}/api/cluster?fields=version'\"]" \
  --region ap-northeast-1 \
  --query 'Command.CommandId' --output text)

# Step 3: Get results (wait 5-10 seconds)
sleep 5
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region ap-northeast-1 \
  --query 'StandardOutputContent' --output text | python3 -m json.tool
```

### 預期輸出

```json
{
  "version": {
    "full": "NetApp Release 9.17.1P6: Wed Mar 25 15:38:10 UTC 2026",
    "generation": 9,
    "major": 17,
    "minor": 1
  }
}
```

### 注意事項

- Management 端點 Security Group 必須允許 HTTPS（443）入站
- SSM 執行個體 IAM 角色不需要 `secretsmanager:GetSecretValue` 權限（密碼在本機取得後嵌入 SSM 命令）
- `curl -sk`：`-s`（靜默模式），`-k`（允許自簽憑證）

---

## 2. Industry-Packs 展示資料匯入

### 背景

7 個產業 × 5 份文件 = 35 份文件 + 35 個中繼資料檔案，用於跨產業 Permission-aware RAG 展示。

### 操作步驟

```bash
S3AP_ALIAS="<S3 AP Alias>"
KB_ID="<Knowledge Base ID>"
DS_ID="<DataSource ID>"

# Step 1: Upload industry-packs via S3 AP
aws s3 sync demo-data/industry-packs/ \
  "s3://${S3AP_ALIAS}/industry-packs/" \
  --region ap-northeast-1 \
  --exclude "README.md" --exclude "DISCLAIMER.md"

# Step 2: Verify upload
aws s3 ls "s3://${S3AP_ALIAS}/industry-packs/" --recursive --region ap-northeast-1 | wc -l
# Expected: 70 files

# Step 3: Trigger KB sync (ingestion)
JOB_ID=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.ingestionJobId' --output text)

# Step 4: Wait for completion
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID --region ap-northeast-1 \
    --query 'ingestionJob.status' --output text)
  echo "[$i] $STATUS"
  if [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ]; then break; fi
done
```

### 產業 SID 對應表

| 產業 | 資料夾 | SID（Domain Admins 以外） |
|------|--------|------------------------|
| 建設 | `construction/` | `-8100` |
| 教育 | `education/` | `-2200` |
| 政府 | `government/` | `-2100` |
| 醫療 | `healthcare/` | `-2200` |
| 保險 | `insurance/` | `-8200` |
| 法律 | `legal/` | `-8300` |
| 製造 | `manufacturing/` | `-2300` |

---

## 3. WebApp Docker 建置與部署

### 背景

原始碼變更後，Docker 層快取會重複使用舊的原始碼。預設使用 `--no-cache` 可解決此問題。

### 建議流程

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### 故障排除：變更未生效

| 原因 | 確認方法 | 解決方案 |
|------|----------|----------|
| Docker 層快取 | `docker images` 時間戳記 | 使用 `--no-cache` 重新建置 |
| ECR `latest` 標籤過期 | `aws ecr describe-images` digest | 使用明確標籤 |
| Lambda 仍在更新中 | `get-function` LastUpdateStatus | `wait function-updated` |
| CloudFront 快取 | 瀏覽器 DevTools 網路分頁 | `create-invalidation` |
| `.next` 快取 | `docker/nextjs/.next/` 是否存在 | `rm -rf docker/nextjs/.next` 後重新建置 |

---

## 4. Permission Filter 除錯

### 驗證步驟

```bash
# Check user SIDs in DynamoDB
aws dynamodb get-item \
  --table-name "<user-access-table>" \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1

# Retrieve document metadata from KB
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id $KB_ID \
  --region ap-northeast-1 \
  --retrieval-query '{"text":"test query"}' \
  --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":5}}' \
  --query 'retrievalResults[].metadata.allowed_group_sids'
```

### 中繼資料格式差異

| 格式 | 範例 | 解析方法 |
|------|------|----------|
| 陣列 | `["S-1-1-0", "S-1-5-21-xxx-512"]` | 直接使用 |
| 逗號分隔字串 | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| JSON 字串 | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| 單一值 | `"S-1-1-0"` | `[value]` |

---

## 5. Prompt Caching 驗證

### 先決條件

- **僅限 Anthropic Claude 模型**（不支援 Nova、OpenAI）
- 在 UI 中選擇 Claude Sonnet 4.6 或 Opus 4.8
- Bedrock Prompt Cache TTL：5 分鐘（ephemeral）

### 確認流程

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### 快取未生效？

| 原因 | 確認方法 |
|------|----------|
| 使用 Nova / OpenAI 模型 | 檢查回應中的 `modelId` |
| 系統提示詞 < 2048 字元 | 檢查 `prompt-templates.ts` 大小 |
| 查詢間隔 > 5 分鐘 | 檢查 CloudWatch 日誌時間戳記 |
| 不同使用者工作階段 | Prompt Cache 按使用者×模型隔離 |

---

## 6. 完整部署驗證檢查清單

```bash
# === Basic Operation ===
# [ ] CDK deploy all stacks success
# [ ] Lambda update confirmed
# [ ] CloudFront health check

# === Permission-Aware RAG ===
# [ ] KB Retrieve (admin SID — full access)
# [ ] KB Retrieve (regular user SID — restricted)
# [ ] Fail-Closed (no metadata → access denied)

# === Model & Routing ===
# [ ] Default model (Nova 2 Lite) response
# [ ] Claude model Prompt Caching
# [ ] Smart Routing Auto Mode

# === UI/UX ===
# [ ] Sign-in page
# [ ] Chat input & response
# [ ] Citation display
# [ ] Permission badge
# [ ] Model indicator

# === Audit & Security ===
# [ ] CloudWatch Logs output
# [ ] DynamoDB user access table
# [ ] EMF metrics (RAG/TokenUsage, SmartRouting)
```

---

## 相關文件

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — 依錯誤分類的解決方案
- [Production Readiness Checklist](../production-readiness-checklist.md) — 上線前要求
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — 每月成本估算
- [metadata-json-schema](../metadata-json-schema.md) — .metadata.json 正式規格
