# 認證與使用者管理指南

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | **繁體中文** | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**建立日期**: 2026-04-02
**版本**: 3.4.0

---

## 概述

本系統提供兩種認證模式。可透過部署時的 CDK 上下文參數進行切換。

| 模式 | CDK 參數 | 使用者建立 | SID 註冊 | 建議用途 |
|------|---------|----------|---------|---------|
| 電子郵件/密碼 | `enableAdFederation=false`（預設） | 管理員手動建立 | 管理員手動註冊 | PoC / 展示 |
| AD Federation | `enableAdFederation=true` | 首次登入時自動建立 | 登入時自動註冊 | 正式環境 / 企業 |
| OIDC/LDAP Federation | `oidcProviderConfig` 指定 | 首次登入時自動建立 | 登入時自動註冊 | 多 IdP / LDAP 環境 |

### 零接觸使用者佈建

AD Federation 和 OIDC/LDAP Federation 模式實現了「零接觸使用者佈建」。這是一種將檔案伺服器（FSx for NetApp ONTAP）的現有使用者權限自動對應到 RAG 系統 UI 使用者的機制。

- 管理員無需在 RAG 系統中手動建立使用者
- 使用者也無需自行註冊
- 由 IdP（AD/Keycloak/Okta/Entra ID 等）管理的使用者首次登入時，Cognito 使用者建立 → 權限資訊取得 → DynamoDB 註冊全部自動完成
- 檔案伺服器端的權限變更在快取 TTL（24 小時）過期後的下次登入時自動反映

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

## 模式 3：OIDC/LDAP Federation（多 IdP / LDAP 環境）

### 運作方式

```
OIDC User -> CloudFront UI -> "OIDC 登入" button
  -> Cognito Hosted UI -> OIDC IdP (Keycloak/Okta/Entra ID)
  -> OIDC authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> Identity Sync Lambda
  -> LDAP Query or OIDC Claims -> DynamoDB auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

OIDC 使用者登入時，以下操作將全部自動完成：

1. **Cognito 使用者自動建立** — 從 OIDC 斷言的 email 屬性自動產生 Cognito 使用者
2. **權限資訊自動取得** — Identity Sync Lambda 從 LDAP 伺服器或 OIDC 聲明中取得 SID/UID/GID/群組資訊
3. **DynamoDB 自動註冊** — 將取得的權限資料儲存到 `user-access` 資料表（24 小時快取）

### 設定驅動的自動啟用

各認證方式在提供設定值時自動啟用。幾乎沒有額外的 AWS 資源成本。

| 功能 | 啟用條件 | 額外成本 |
|------|---------|---------|
| OIDC Federation | `oidcProviderConfig` 指定 | 無（Cognito IdP 註冊免費） |
| LDAP 權限取得 | `ldapConfig` 指定 | 無（僅 Lambda 按執行計費） |
| OIDC 聲明權限取得 | `oidcProviderConfig` 指定 + 無 `ldapConfig` | 無 |
| UID/GID 權限過濾 | `permissionMappingStrategy` 為 `uid-gid` 或 `hybrid` | 無 |
| ONTAP name-mapping | `ontapNameMappingEnabled=true` | 無 |

> **CDK 自動配置**: 指定 `oidcProviderConfig` 部署 CDK 時，以下內容會自動配置：
> - OIDC IdP 註冊到 Cognito User Pool
> - 建立 Cognito Domain（如果 `enableAdFederation=true` 尚未建立）
> - OIDC IdP 作為支援的提供者新增到 User Pool Client
> - 建立 Identity Sync Lambda 並註冊為 Post-Authentication Trigger
> - WebAppStack Lambda 自動設定 OAuth 環境變數（`COGNITO_DOMAIN`、`COGNITO_CLIENT_SECRET`、`CALLBACK_URL`）
>
> 同時指定 `enableAdFederation=true` 和 `oidcProviderConfig` 時，SAML + OIDC 均受支援，登入畫面顯示兩個按鈕。

### 模式 C：OIDC + LDAP（OpenLDAP/FreeIPA + Keycloak）

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
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password",
    "userSearchFilter": "(mail={email})",
    "groupSearchFilter": "(member={dn})"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

### 模式 D：OIDC Claims Only（無 LDAP）

```json
{
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com",
    "groupClaimName": "groups"
  }
}
```

> **Auth0 使用時的重要注意事項**: Auth0 的 OIDC 合規應用程式要求 ID 權杖中的自訂聲明使用命名空間（URL 前綴）。沒有命名空間的 `groups` 聲明會從 ID 權杖中被自動移除。請在 Auth0 的 Post Login Action 中按如下方式設定帶命名空間的聲明：
>
> ```javascript
> // Auth0 Post Login Action
> exports.onExecutePostLogin = async (event, api) => {
>   const groups = ['developers', 'rag-users']; // 使用者的群組
>   api.idToken.setCustomClaim('https://rag-system/groups', groups);
>   api.accessToken.setCustomClaim('https://rag-system/groups', groups);
> };
> ```
>
> CDK 端的 `groupClaimName` 維持 `groups` 即可。CDK 會自動配置 `https://rag-system/groups` → `custom:oidc_groups` 的屬性對應。

### 模式 E：SAML + OIDC 混合

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com"
  },
  "permissionMappingStrategy": "hybrid",
  "cloudFrontUrl": "https://dxxxxxxxx.cloudfront.net"
}
```

### CDK 參數列表（OIDC/LDAP）

| 參數 | 類型 | 預設值 | 說明 |
|------|------|-------|------|
| `oidcProviderConfig.providerName` | string | `OIDCProvider` | IdP 顯示名稱（顯示在登入按鈕上） |
| `oidcProviderConfig.clientId` | string | **必填** | OIDC 用戶端 ID |
| `oidcProviderConfig.clientSecret` | string | **必填** | OIDC 用戶端密鑰（支援 Secrets Manager ARN，CDK 在部署時自動解析值） |
| `oidcProviderConfig.issuerUrl` | string | **必填** | OIDC 簽發者 URL |
| `oidcProviderConfig.groupClaimName` | string | `groups` | 群組資訊聲明名稱 |
| `ldapConfig.ldapUrl` | string | - | LDAP/LDAPS URL（例：`ldaps://ldap.example.com:636`） |
| `ldapConfig.baseDn` | string | - | 搜尋基礎 DN（例：`dc=example,dc=com`） |
| `ldapConfig.bindDn` | string | - | 繫結 DN（例：`cn=readonly,dc=example,dc=com`） |
| `ldapConfig.bindPasswordSecretArn` | string | - | 繫結密碼 Secrets Manager ARN |
| `ldapConfig.userSearchFilter` | string | `(mail={email})` | 使用者搜尋篩選器 |
| `ldapConfig.groupSearchFilter` | string | `(member={dn})` | 群組搜尋篩選器 |
| `permissionMappingStrategy` | string | `sid-only` | 權限對應策略：`sid-only`、`uid-gid`、`hybrid` |
| `ontapNameMappingEnabled` | boolean | `false` | ONTAP name-mapping 整合 |

> **CDK 部署注意事項**：
> - 當 `clientSecret` 指定 Secrets Manager ARN 時，CDK 會在部署時自動解析密鑰值。
> - Cognito 自訂屬性建立後無法修改或刪除（CloudFormation 限制）。因此，`oidc_groups` 被排除在 CDK User Pool 定義之外。
> - CDK 部署後，Cognito 重新解析 OIDC 端點期間，OIDC 登入可能會暫時失敗（1~2 分鐘）。
> - `AdminGetUser` 權限使用萬用字元 ARN 以避免循環依賴。

---

## 與權限過濾的整合

無論認證模式為何，權限過濾機制都是相同的。Permission Resolver 根據認證來源自動選擇適當的過濾策略。

### 過濾策略

| 策略 | 條件 | 行為 |
|------|------|------|
| SID Matching | 僅存在 `userSID` | 將文件的 `allowed_group_sids` 與使用者 SID 進行比對 |
| UID/GID Matching | 僅存在 `uid` + `gid` | 將文件的 `allowed_uids` / `allowed_gids` 與使用者 UID/GID 進行比對 |
| Hybrid Matching | `userSID` 和 `uid` 同時存在 | SID 比對優先，UID/GID 回退 |
| Deny All (Fail-Closed) | 無權限資訊 | 拒絕所有文件存取 |

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs + uid + gid + unixGroups
  v
Permission Resolver (策略自動選擇)
  |
  ├─ SID Matching: userSIDs ∩ documentSIDs
  ├─ UID/GID Matching: uid ∈ allowed_uids OR gid ∈ allowed_gids
  └─ Hybrid: SID 優先 → UID/GID 回退
  v
Match -> ALLOW, No match -> DENY
```

**SID 資料註冊來源的差異：**

| 認證模式 | SID 資料註冊來源 | `source` 欄位 |
|---------|----------------|--------------|
| 電子郵件/密碼 | `setup-user-access.sh`（手動） | `Demo` |
| AD Federation (Managed) | AD Sync Lambda（自動） | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda（自動） | `AD-Sync-self-managed` |
| OIDC + LDAP | Identity Sync Lambda（自動） | `OIDC-LDAP` |
| OIDC + Claims | Identity Sync Lambda（自動） | `OIDC-Claims` |

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
| 登入後所有文件被拒絕 | DynamoDB 中沒有 SID/UID/GID 資料 | AD Federation：檢查 AD Sync Lambda 日誌。OIDC：檢查 Identity Sync Lambda 日誌。手動：執行 `setup-user-access.sh` |
| 「AD 登入」按鈕未顯示 | `enableAdFederation=false` | 檢查 CDK 參數並重新部署 |
| 「OIDC 登入」按鈕未顯示 | `oidcProviderConfig` 未設定 | 在 CDK 參數中新增 `oidcProviderConfig` 並重新部署 |
| SAML 認證失敗 | SAML 中繼資料 URL 錯誤 | Managed AD：檢查 IAM Identity Center 設定。Self-managed：檢查 Entra ID 中繼資料 URL |
| OIDC 認證失敗 | `clientId` / `issuerUrl` 錯誤 | 確認 OIDC IdP 端的用戶端設定與 CDK 參數一致 |
| LDAP 權限取得失敗 | LDAP 連線錯誤 | 在 CloudWatch Logs 中檢查 Identity Sync Lambda 錯誤。登入本身不會被阻擋（Fail-Open） |
| AD 群組變更未反映 | SID 快取（24 小時） | 等待 24 小時，或刪除 DynamoDB 中的相關記錄後重新登入 |
| AD Sync Lambda 逾時 | 透過 SSM 執行 PowerShell 較慢 | 增加 `SSM_TIMEOUT` 環境變數（預設 60 秒） |
| OIDC 群組未取得 | IdP 端未設定群組聲明，或未使用命名空間聲明 | Auth0 等 OIDC 合規 IdP 要求 ID 權杖中的自訂聲明使用命名空間（URL 前綴）。對於 Auth0，在 Post Login Action 中使用 `api.idToken.setCustomClaim('https://rag-system/groups', groups)` 設定帶命名空間的聲明，並確保 Cognito 屬性對應也匹配 `https://rag-system/groups` → `custom:oidc_groups` |
| OIDC 登入後 DynamoDB 中未註冊權限資料 | Post-Auth Trigger 或 Identity Sync Lambda 未建立 | 指定 `oidcProviderConfig` 部署 CDK 會自動建立 Identity Sync Lambda 和 Post-Auth Trigger。在 CloudWatch Logs 中檢查 Lambda 執行日誌 |
| PostConfirmation 觸發器中自訂屬性為空 | Cognito 規範中 PostConfirmation 事件可能不包含自訂屬性 | Identity Sync Lambda 已實作 Cognito AdminGetUser API 回退。確認 Lambda 執行角色已授予 `cognito-idp:AdminGetUser` 權限 |
| OAuth 回呼錯誤（OIDC 配置） | `cloudFrontUrl` 未設定 | OIDC 配置也需要 `cloudFrontUrl`。在 `cdk.context.json` 中設定並重新部署 |

---


### OpenLDAP 環境中的 LDAP Connector 注意事項

| 項目 | 內容 |
|------|------|
| memberOf 覆蓋層 | 基本 OpenLDAP 不會自動填充 `memberOf`。需要在 `slapd.conf` 中新增 `moduleload memberof` 和 `overlay memberof`，並建立 `groupOfNames` 條目 |
| posixGroup vs groupOfNames | 具有不同的結構類別，不能在同一條目中共存 |
| Secrets Manager | 繫結密碼以純文字字串儲存 |
| VPC 部署 | 指定 `ldapConfig` 時，CDK 自動將 Lambda 部署到 VPC 內 |

### 設定和驗證腳本

```bash
bash demo-data/scripts/setup-openldap.sh
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/setup-ontap-namemapping.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

## 驗證結果

### CDK Synth + 部署驗證（v3.4.0）

- CDK synth/deploy: ✅ 成功
- Cognito OIDC IdP 註冊: ✅ Auth0
- 登入畫面: ✅ SAML + OIDC 混合
- OIDC 認證流程: ✅ 端到端成功
- Post-Auth Trigger: ✅ PostConfirmation
- DynamoDB 自動儲存: ✅ OIDC-Claims
- OIDC 群組聲明管道: ✅ Auth0 Post Login Action → 命名空間聲明(`https://rag-system/groups`) → Cognito `custom:oidc_groups` → Identity Sync Lambda → DynamoDB `oidcGroups: ["developers","rag-users"]`
- Cognito AdminGetUser API 回退: ✅ PostConfirmation 觸發器事件中自訂屬性未包含時，透過 Cognito API 直接取得並正常運作
- 單元測試: ✅ 130 通過
- 屬性測試: ✅ 52 通過
- LDAP 實環境測試: ✅ OpenLDAP (VPC 內 EC2) → LDAP Connector → DynamoDB (uid:10001, gid:5001, source:OIDC-LDAP)
- ONTAP name-mapping 實環境測試: ✅ ONTAP REST API 連線 → 3條 name-mapping 規則建立/取得 → resolveWindowsUser 驗證

![登入畫面（SAML + OIDC 混合）](../docs/screenshots/signin-page-saml-oidc-hybrid.png)

![Auth0 OIDC 登入頁面](../docs/screenshots/oidc-auth0-login-page.png)

![OIDC 登入成功後的聊天畫面](../docs/screenshots/oidc-auth0-signin-success.png)

---

## 相關文件

- [README.md — AD SAML 聯合認證](../../README.zh-TW.md#ad-saml-聯合認證選項) — CDK 部署步驟
- [docs/implementation-overview.md — 第 3 節：IAM 認證](../zh-TW/implementation-overview.md#3-iam-認證--lambda-function-url-iam-auth--cloudfront-oac) — 基礎設施層認證設計
- [docs/SID-Filtering-Architecture.md](../zh-TW/SID-Filtering-Architecture.md) — SID 過濾詳細設計
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD 整合設定
