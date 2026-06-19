# Transfer Family FSx for ONTAP E2E 驗證報告

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | [English](../en/transfer-family-e2e-verification.md) | [한국어](../ko/transfer-family-e2e-verification.md) | [简体中文](../zh-CN/transfer-family-e2e-verification.md) | **繁體中文** | [Français](../fr/transfer-family-e2e-verification.md) | [Deutsch](../de/transfer-family-e2e-verification.md) | [Español](../es/transfer-family-e2e-verification.md)

**驗證日期**: 2026-05-13
**區域**: ap-northeast-1
**伺服器 ID**: s-fb47244ef5ac43a28
**端點**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## E2E 流程驗證結果

| 步驟 | 結果 | 詳情 |
|---------|------|------|
| 1. SSH 金鑰產生 | ✅ | RSA 4096bit |
| 2. Transfer Family 使用者金鑰註冊 | ✅ | `import-ssh-public-key` API |
| 3. SFTP 連線 | ✅ | 認證成功（publickey） |
| 4. 檔案清單顯示（ls） | ✅ | 顯示 2 個檔案 |
| 5. 檔案上傳（put） | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 偵測到 1 個檔案變更 |
| 7. KB StartIngestionJob | ✅ | 作業 ID `JIGLRZMPEU` |
| 8. 擷取完成 | ✅ | `COMPLETE`，1 個文件新建索引 |

---

## 運行所需的必備設定

### 1. CDK 上下文參數

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **重要**: `transferFamilyS3ApAlias` 必須在 S3 Access Point 建立之後取得（CDK synth 時未知）。

### 2. S3 Access Point Alias 的取得方法

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. HomeDirectoryMappings Target 格式

```
✅ 正確: /{s3-access-point-alias}/uploads/demo-user
❌ 錯誤: /{ap-name}/uploads/demo-user
❌ 錯誤: /{ap-arn}/uploads/demo-user
❌ 錯誤: /{alias}/uploads/demo-user/  （尾端斜線）
```

### 4. IAM 政策 Resource 格式

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ 請勿在 IAM Resource 中使用 alias
```

### 5. s3:prefix 條件

```
✅ 正確: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ 錯誤: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
不需要前導斜線。

### 6. 所需的 IAM 動作

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. SFTP 連線命令

```bash
# 從 macOS/Linux 連線（需要指定 HostKeyAlgorithms）
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

> **⚠️ 生產環境注意事項**: 上述 `StrictHostKeyChecking=no` 僅供首次驗證使用。在生產環境中，請將 Transfer Family 伺服器的 HostKey 註冊至 `~/.ssh/known_hosts`，並以 `StrictHostKeyChecking=yes`（預設值）運行。HostKey 可透過 `aws transfer describe-server --server-id <ID> --query 'Server.HostKeyFingerprint'` 取得。

### 8. FSx for ONTAP 檔案系統權限

為使 Transfer Family 使用者能夠讀寫檔案，FSx for ONTAP 磁碟區上的 S3 Access Point 檔案系統使用者（例如 `root`）必須對上傳目標目錄擁有讀寫權限。

---

## 發現的問題與解決方案

### 問題 1: StructuredLogDestinations EarlyValidation

**症狀**: 建立 ChangeSet 時出現 `AWS::EarlyValidation::PropertyValidation` 錯誤
**解決**: 移除 `structuredLogDestinations` 屬性。僅透過 `loggingRole` 進行標準日誌輸出。

### 問題 2: HomeDirectoryMappings 尾端斜線

**症狀**: `Target in mapping has a trailing '/'`
**解決**: 將 `homeDirectoryPrefix` 的預設值改為 `/uploads/${userName}`（無尾端斜線）

### 問題 3: 在 HomeDirectoryMappings Target 中使用 AP 名稱

**症狀**: `ls` 時出現 `No such file or directory`
**解決**: 使用 S3 AP **alias** 而非 AP 名稱。格式為 `/{alias}/path`。

### 問題 4: IAM s3:prefix 中的前導斜線

**症狀**: `ls` 時出現 `Permission denied`
**解決**: 從 `s3:prefix` 條件中移除前導斜線。`uploads/user/*` 才是正確的。

### 問題 5: SSH HostKeyAlgorithms 不相符

**症狀**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**解決**: 在 SFTP 命令中加入 `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512`。

### 問題 6: 預留位置 SSH 金鑰

**症狀**: `Permission denied (publickey)` — 舊的預留位置金鑰仍然存在
**解決**: 使用 `aws transfer delete-ssh-public-key` 刪除舊金鑰，僅保留實際金鑰。

---

## 部署後的手動設定步驟

1. **建立 S3 Access Point**（CDK 之外）
2. **取得 S3 AP Alias** → 設定至 `cdk.context.json`
3. **CDK 部署** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **產生 SSH 金鑰** (`ssh-keygen -t rsa -b 4096`)
5. **註冊 SSH 公開金鑰** (`aws transfer import-ssh-public-key`)
6. **刪除預留位置金鑰** (`aws transfer delete-ssh-public-key`)
7. **SFTP 連線測試**
8. **手動執行 Ingestion Trigger Lambda** 以確認偵測

---

## AWS 主控台螢幕截圖

### Transfer Family 伺服器詳情

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Ingestion Trigger Lambda 監控

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Lambda 函數名: `v4-test-demo-ingestion-trigger`
- 已確認執行成功

### Bedrock KB 擷取完成

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
