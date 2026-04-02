# 認證與使用者管理指南

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | **繁體中文** | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**建立日期**: 2026-04-02
**版本**: 3.3.0

---

## 概述

本系統提供兩種認證模式。可透過部署時的 CDK 上下文參數進行切換。

| 模式 | CDK 參數 | 使用者建立 | SID 註冊 | 建議用途 |
|------|---------|----------|---------|---------|
| 電子郵件/密碼 | `enableAdFederation=false`（預設） | 管理員手動建立 | 管理員手動註冊 | PoC / 展示 |
| AD Federation | `enableAdFederation=true` | 首次登入時自動建立 | 登入時自動註冊 | 正式環境 / 企業 |

---

## 模式 1：電子郵件/密碼認證（預設）

### 運作方式

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

直接在 Cognito User Pool 中建立使用者，使用電子郵件地址和密碼進行登入。

### 管理員操作

**Step 1：建立 Cognito 使用者**

```bash
# post-deploy-setup.sh 自動執行，或手動執行：
bash demo-data/scripts/create-demo-users.sh
```

**Step 2：註冊 DynamoDB SID 資料**

```bash
# 手動註冊 SID 資料
bash demo-data/scripts/setup-user-access.sh
```

此腳本會在 DynamoDB `user-access` 資料表中註冊以下內容：

| userId | userSID | groupSIDs | 存取範圍 |
|--------|---------|-----------|---------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | 全部文件 |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | 僅 public |

### 限制

- 每次新增使用者時，管理員都需要手動更新 Cognito 和 DynamoDB
- AD 群組成員變更不會自動反映
- 不適合大規模營運

---

## 模式 2：AD Federation（建議：企業級）

### 運作方式

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

當 AD 使用者透過 SAML 登入時，以下操作將全部自動完成：

1. **Cognito 使用者自動建立** — 從 SAML 斷言的電子郵件屬性自動產生 Cognito 使用者
2. **SID 自動取得** — AD Sync Lambda 從 AD 取得使用者 SID + 群組 SID
3. **DynamoDB 自動註冊** — 將取得的 SID 資料儲存到 `user-access` 資料表（24 小時快取）

無需管理員手動操作。

### AD Sync Lambda 行為

| AD 方式 | SID 取得方法 | 所需基礎設施 |
|---------|------------|------------|
| Managed AD | LDAP 或透過 SSM 執行 PowerShell | AWS Managed AD +（選用）Windows EC2 |
| Self-managed AD | 透過 SSM 執行 PowerShell | Windows EC2（已加入 AD） |

**快取行為：**
- 首次登入：查詢 AD 取得 SID，儲存到 DynamoDB
- 後續登入（24 小時內）：使用 DynamoDB 快取，略過 AD 查詢
- 24 小時後：下次登入時從 AD 重新取得

**錯誤時的行為：**
- AD Sync Lambda 失敗時登入不會被阻擋（僅記錄錯誤日誌）
- 如果沒有 SID 資料，SID 過濾採用 Fail-Closed（拒絕所有文件）

### 模式 A：AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**設定步驟：**
1. CDK 部署（建立 Managed AD + SAML IdP + Cognito Domain）
2. SVM 加入 AD（`post-deploy-setup.sh` 自動執行）
3. 在 IAM Identity Center 中建立面向 Cognito 的 SAML 應用程式（或透過 `samlMetadataUrl` 指定外部 IdP）
4. 從 Cognito Hosted UI 的「AD 登入」按鈕執行 AD 認證

### 模式 B：Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**設定步驟：**
1. 將 Windows EC2 加入 AD 並啟用 SSM Agent
2. 在 Entra ID 中建立 SAML 應用程式並取得中繼資料 URL
3. CDK 部署
4. 從 CloudFront UI 的「AD 登入」按鈕執行 AD 認證

### CDK 參數列表

| 參數 | 類型 | 預設值 | 說明 |
|------|------|-------|------|
| `enableAdFederation` | boolean | `false` | 啟用 SAML 聯合認證 |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Managed AD 管理員密碼 |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | 已加入 AD 的 Windows EC2 執行個體 ID |
| `samlMetadataUrl` | string | - | SAML IdP 中繼資料 URL |
| `adDomainName` | string | - | AD 網域名稱（例：demo.local） |
| `adDnsIps` | string | - | AD DNS IP（逗號分隔） |
| `cloudFrontUrl` | string | - | OAuth 回呼 URL |

---

## 與 SID 過濾的整合

無論認證模式為何，SID 過濾機制都是相同的。

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs
  v
Bedrock KB Retrieve API -> Results + metadata (allowed_group_sids)
  |
  | userSIDs n documentSIDs
  v
Match -> ALLOW, No match -> DENY
```

**SID 資料註冊來源的差異：**

| 認證模式 | SID 資料註冊來源 | `source` 欄位 |
|---------|----------------|--------------|
| 電子郵件/密碼 | `setup-user-access.sh`（手動） | `Demo` |
| AD Federation (Managed) | AD Sync Lambda（自動） | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda（自動） | `AD-Sync-self-managed` |

### DynamoDB user-access 資料表結構

```json
{
  "userId": "admin@example.com",
  "userSID": "S-1-5-21-...-500",
  "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
  "displayName": "Admin User",
  "email": "admin@example.com",
  "source": "AD-Sync-managed",
  "retrievedAt": 1705750800000,
  "ttl": 1705837200
}
```

---

## 疑難排解

| 症狀 | 原因 | 處理方法 |
|------|------|---------|
| 登入後所有文件被拒絕 | DynamoDB 中沒有 SID 資料 | AD Federation：檢查 AD Sync Lambda 日誌。手動：執行 `setup-user-access.sh` |
| 「AD 登入」按鈕未顯示 | `enableAdFederation=false` | 檢查 CDK 參數並重新部署 |
| SAML 認證失敗 | SAML 中繼資料 URL 錯誤 | Managed AD：檢查 IAM Identity Center 設定。Self-managed：檢查 Entra ID 中繼資料 URL |
| AD 群組變更未反映 | SID 快取（24 小時） | 等待 24 小時，或刪除 DynamoDB 中的相關記錄後重新登入 |
| AD Sync Lambda 逾時 | 透過 SSM 執行 PowerShell 較慢 | 增加 `SSM_TIMEOUT` 環境變數（預設 60 秒） |

---

## 相關文件

- [README.md — AD SAML 聯合認證](../../README.zh-TW.md#ad-saml-聯合認證選項) — CDK 部署步驟
- [docs/implementation-overview.md — 第 3 節：IAM 認證](../zh-TW/implementation-overview.md#3-iam-認證--lambda-function-url-iam-auth--cloudfront-oac) — 基礎設施層認證設計
- [docs/SID-Filtering-Architecture.md](../zh-TW/SID-Filtering-Architecture.md) — SID 過濾詳細設計
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD 整合設定
