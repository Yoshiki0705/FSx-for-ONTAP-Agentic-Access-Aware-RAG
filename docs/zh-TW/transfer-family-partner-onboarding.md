# Transfer Family 合作夥伴導入指南

**🌐 Language:** [日本語](../transfer-family-partner-onboarding.md) | [English](../en/transfer-family-partner-onboarding.md) | [한국어](../ko/transfer-family-partner-onboarding.md) | [简体中文](../zh-CN/transfer-family-partner-onboarding.md) | **繁體中文** | [Français](../fr/transfer-family-partner-onboarding.md) | [Deutsch](../de/transfer-family-partner-onboarding.md) | [Español](../es/transfer-family-partner-onboarding.md)

**最後更新**: 2026-05-23  
**適用對象**: 外部合作夥伴（律師事務所、審計機構、監管機構等）的 SFTP 存取設定

---

## 概述

本指南說明如何使用 AWS Transfer Family 讓外部合作夥伴透過 SFTP 上傳文件，並自動擷取至 Permission-aware RAG Knowledge Base 的設定步驟。

### 架構

```
合作夥伴 (SFTP) → Transfer Family → FSx for ONTAP S3 AP → Metadata Generator → Bedrock KB
```

合作夥伴僅需使用 SFTP 用戶端即可操作。無需存取 Web UI 或 AWS 主控台。

---

## 1. 先決條件

### 系統管理員側

- [x] 已使用 `enableTransferFamily=true` 完成 CDK 部署
- [x] S3 Access Point 已連接至 FSx for ONTAP 磁碟區
- [x] 已在 DynamoDB 權限對應表中註冊合作夥伴的權限設定

### 合作夥伴側

- [x] SFTP 用戶端（FileZilla、WinSCP、OpenSSH 等）
- [x] SSH 金鑰對（RSA 4096bit 或 Ed25519）

---

## 2. SSH 金鑰準備

### 合作夥伴產生金鑰的情況

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

請將產生的**公開金鑰**（`~/.ssh/transfer-family-key.pub`）傳送給系統管理員。

> **安全注意事項**: 切勿共享私密金鑰（`~/.ssh/transfer-family-key`）。

### 系統管理員註冊金鑰的情況

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. SFTP 連線參數

請向合作夥伴提供以下連線資訊：

| 參數 | 值 |
|-----------|-----|
| 主機 | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| 連接埠 | `22` |
| 通訊協定 | SFTP |
| 使用者名稱 | `partner-a`（由管理員指派） |
| 驗證方式 | SSH 公開金鑰驗證 |
| 主目錄 | `/uploads/partner-a/` |

### 連線命令（OpenSSH）

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### FileZilla 設定

1. **站台管理員** → 新增站台
2. 通訊協定: **SFTP**
3. 主機: `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. 登入類型: **金鑰檔案**
5. 使用者: `partner-a`
6. 金鑰檔案: 指定私密金鑰的路徑

### WinSCP 設定

1. **新增工作階段**
2. 檔案通訊協定: **SFTP**
3. 主機名稱: Transfer Family 端點
4. 使用者名稱: `partner-a`
5. **進階設定** → SSH → 驗證 → 指定私密金鑰檔案

---

## 4. 檔案上傳步驟

### 目錄結構

合作夥伴的主目錄限制為 `/uploads/partner-a/`。

```
/uploads/partner-a/
├── contracts/          ← 合約
├── reports/            ← 報告
├── correspondence/     ← 往來文書
└── misc/               ← 其他
```

### 上傳操作

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### 檔案命名規則

| 規則 | 說明 |
|--------|------|
| 副檔名 | 建議 `.pdf`、`.docx`、`.txt`、`.md`、`.html` |
| 檔案名稱 | 使用英數字、連字號、底線 |
| 大小上限 | 5 GB（S3 Access Point 的限制） |
| 禁止操作 | 不支援檔案重新命名（rename）、附加寫入（append） |

### 限制事項

- **禁止建立、變更、刪除 `.metadata.json` 檔案**（IAM Deny）
- 權限中繼資料由系統自動產生
- 由於 S3 Access Point 的限制，不支援檔案的 rename/append 操作

---

## 5. 擷取確認

上傳後，將依以下時間軸進行處理：

| 步驟 | 所需時間 | 說明 |
|---------|---------|------|
| 檔案偵測 | 最多 5 分鐘 | EventBridge Scheduler 輪詢 |
| 中繼資料產生 | 數秒 | `.metadata.json` 自動產生 |
| KB 擷取 | 1-5 分鐘 | 擷取至 Bedrock Knowledge Base |
| RAG 可檢索 | 即時 | 擷取完成後 |

### 確認方法（適用於系統管理員）

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. 疑難排解

### 無法連線

| 症狀 | 原因 | 處理 |
|------|------|------|
| `Permission denied (publickey)` | SSH 金鑰未註冊或不相符 | 請管理員重新註冊公開金鑰 |
| `Connection timed out` | 網路限制（IP 允許清單） | 請管理員新增 IP 位址 |
| `no matching host key type found` | HostKeyAlgorithms 不相符 | 新增 `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` |

### 無法上傳

| 症狀 | 原因 | 處理 |
|------|------|------|
| `put` 時出現 `Permission denied` | 存取主目錄以外的位置 | 上傳至 `/uploads/partner-a/` 下 |
| `.metadata.json` 出現 `Permission denied` | IAM Deny 政策 | 禁止對中繼資料檔案進行操作（正常行為） |
| `File too large` | 超過 5GB 限制 | 分割檔案後上傳 |

### 檔案未反映至 RAG

| 症狀 | 原因 | 處理 |
|------|------|------|
| 超過 5 分鐘仍未反映 | 等待輪詢間隔或 Lambda 錯誤 | 請管理員確認 CloudWatch Logs |
| 擷取作業為 FAILED | 不支援的檔案格式 | 確認支援的格式（PDF、DOCX、TXT、MD、HTML） |

---

## 7. 安全模型

### 合作夥伴的存取範圍

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### 權限中繼資料的自動產生

合作夥伴上傳檔案後，系統會自動產生 `.metadata.json`：

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-23T10:30:00Z"
}
```

此權限資訊從 DynamoDB 的管理員設定表中導出。合作夥伴無法直接指定權限。

---

## 8. 適用於管理員：新增合作夥伴步驟

### 新增合作夥伴

```bash
# 1. DynamoDB 権限マッピングに登録
aws dynamodb put-item \
  --table-name ${PREFIX}-transfer-permission-mapping \
  --item '{
    "userName": {"S": "partner-b"},
    "allowed_sids": {"L": [{"S": "S-1-5-21-xxx-2001"}]},
    "allowed_uids": {"L": [{"S": "2001"}]},
    "allowed_gids": {"L": [{"S": "2001"}]},
    "description": {"S": "Partner B - Audit Firm"}
  }' \
  --region ap-northeast-1

# 2. Transfer Family ユーザー作成（CDK再デプロイ or CLI）
# cdk.context.json の transferFamilyUsers に追加してデプロイ
# または CLI で直接作成:
aws transfer create-user \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --role arn:aws:iam::ACCOUNT:role/${PREFIX}-transfer-user-role \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/${S3_AP_ALIAS}/uploads/partner-b"}]' \
  --region ap-northeast-1

# 3. SSH公開鍵の登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-body "$(cat partner-b-public-key.pub)" \
  --region ap-northeast-1
```

### 停用合作夥伴

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## 相關文件

- [Transfer Family E2E 驗證報告](transfer-family-e2e-verification.md)
- [Transfer Family 網路先決條件](transfer-family-networking-prerequisites.md)
- [AWS Transfer Family + FSx S3 AP 文件](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
