# 認證模式示範環境建置指南

**建立日期**: 2026-04-04
**建立日期**: 為5種認證模式分別建置可重現的示範環境

---

## 概述

本系統支援5種認證模式。範例設定檔位於 `demo-data/configs/`，複製到 `cdk.context.json` 即可部署。

| 模式 | 設定檔 | 認證方式 | 權限取得 | 額外基礎設施 |
|--------|----------|--------|--------|---------|
| A | `mode-a-email-password.json` | 電子郵件/密碼 | 手動SID註冊 | 無 |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | 僅OIDC Claims | OIDC權杖 | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## 通用步驟

### 前提條件

```bash
node --version   # v22.x.x
docker --version
npx cdk --version
aws sts get-caller-identity
```

### 部署

```bash
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
bash demo-data/scripts/verify-deployment.sh
```

---

## 認證模式選擇指南

### 決策流程圖

根據現有認證基礎設施選擇最佳認證模式。

```
What is your existing authentication infrastructure?
│
├─ None (new setup)
│   └─ → Mode A (Email/Password) to start
│       Can migrate to Mode C/D later
│
├─ Windows Active Directory (on-premises or Managed AD)
│   ├─ IAM Identity Center configured?
│   │   ├─ Yes → Mode B (SAML AD Federation)
│   │   └─ No  → Configure SAML via AD FS / Entra ID → Mode B
│   │
│   └─ Want to also use an OIDC IdP?
│       └─ Yes → Mode E (SAML + OIDC Hybrid)
│
├─ OIDC IdP (Keycloak / Okta / Entra ID / Auth0)
│   ├─ Also have LDAP/FreeIPA server?
│   │   └─ Yes → Mode C (OIDC + LDAP)
│   │       UID/GID-based permission filtering available
│   │
│   └─ No LDAP (IdP group claims only)
│       └─ → Mode D (OIDC Claims Only)
│           Group claim configuration required on IdP side
│
└─ Multiple IdPs simultaneously (Okta + Keycloak, etc.)
    └─ → oidcProviders array (Phase 2 Multi-OIDC)
        Each IdP button dynamically displayed on sign-in screen
```

### 權限對應策略選擇

`permissionMappingStrategy` 參數控制文件存取控制的運作方式。

| 策略 | 值 | 條件 | 文件中繼資料 | 建議環境 |
|----------|-------|-----------|-------------------|------------------------|
| 僅SID | `sid-only` | Windows AD 環境 | `allowed_group_sids` | NTFS ACL 管理的檔案權限 |
| 僅UID/GID | `uid-gid` | UNIX/Linux 環境 | `allowed_uids`, `allowed_gids` | POSIX 權限管理的檔案 |
| 混合 | `hybrid` | 混合環境 | SID + UID/GID 兩者 | AD 和 LDAP 使用者共存 |

### OIDC IdP 整合檢查清單

整合 OIDC IdP 時，需要在 IdP 端進行以下設定。

#### 通用（所有 OIDC IdP）

- [ ] 為 RAG 系統建立用戶端應用程式（Regular Web Application）
- [ ] 取得 `clientId` 和 `clientSecret`
- [ ] 將 `clientSecret` 儲存至 AWS Secrets Manager
- [ ] 將 Allowed Callback URLs 設定為 `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`
- [ ] 將 Allowed Logout URLs 設定為 `https://{cloudfront-url}/signin`
- [ ] 從 `/.well-known/openid-configuration` 的 `issuer` 欄位取得 `issuerUrl`（注意尾部斜線）
- [ ] 確認 `openid`、`email`、`profile` 範圍已啟用

#### Auth0 專用

- [ ] `issuerUrl` 需加上尾部斜線（例：`https://xxx.auth0.com/`）
- [ ] 群組宣告：設定包含命名空間自訂宣告的 Post Login Action

#### Keycloak 專用

- [ ] `issuerUrl` 無尾部斜線（例：`https://keycloak.example.com/realms/main`）
- [ ] Client Protocol: `openid-connect`，Access Type: `confidential`
- [ ] 群組宣告：在 Client Scopes 中新增 `groups` mapper

#### Okta 專用

- [ ] `issuerUrl` 無尾部斜線（例：`https://company.okta.com`）
- [ ] Application Type: `Web Application`
- [ ] 群組宣告：Authorization Server → Claims → 新增 `groups` 宣告

#### Entra ID（前身為 Azure AD）專用

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → 新增 Redirect URI
- [ ] Token Configuration → Optional Claims → 新增 `groups`

---

## LDAP 健康檢查驗證（模式 C）

當設定了 `ldapConfig` 時，系統會自動建立 LDAP 健康檢查 Lambda。使用以下命令驗證其是否正常運作。

```bash
# 手動 Lambda 呼叫（檢查 connect/bind/search 步驟結果）
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# CloudWatch Alarm 狀態（OK = 健康，ALARM = LDAP 連線失敗）
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# EventBridge Rule（5分鐘間隔排程執行）
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# CloudWatch Logs（結構化 JSON 日誌）
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **已驗證 (2026-04-10)**：針對 OpenLDAP EC2 (10.0.2.187:389) 的 LDAP 健康檢查 Lambda 手動呼叫 — 所有步驟 SUCCESS（connect: 12ms, bind: 12ms, search: 16ms, total: 501ms）。CloudWatch Alarm: OK，EventBridge Rule: 5min ENABLED。已確認透過 NAT Gateway 存取 Secrets Manager + CloudWatch Metrics。

---

## 模式間遷移

### Mode A → Mode C/D（電子郵件/密碼 → OIDC Federation）

最常見的遷移模式。從 Mode A 開始進行 PoC，然後遷移至 OIDC Federation 用於正式環境。

```bash
# Step 1: 備份目前的 cdk.context.json
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: 在 cdk.context.json 中新增 OIDC 設定
# Step 3: 重新部署（僅 Security + WebApp 堆疊）
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: 在 OIDC IdP 端設定 Callback URLs
# Step 5: 驗證 - 確認現有電子郵件/密碼使用者仍可登入
```

**注意：**
- 現有 Cognito 使用者（電子郵件/密碼）不會被刪除
- 現有 DynamoDB SID 資料會被保留
- 使用 `permissionMappingStrategy: "hybrid"` 實現 SID + UID/GID 使用者共存
- 如果 Cognito User Pool 的 `email.mutable` 為 `false`，則需要重新建立 User Pool

### Mode B → Mode E（SAML AD → SAML + OIDC 混合）

在現有 AD SAML Federation 基礎上新增 OIDC IdP。

```bash
# Step 1: 在 cdk.context.json 中新增 oidcProviderConfig（保持 enableAdFederation: true）
# Step 2: 重新部署 Security + WebApp 堆疊
# Step 3: 驗證 "Sign in with AD" 和 "{providerName}" 按鈕是否同時顯示
```

---

## 清理

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## 疑難排解

| | 模式 | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC認證失敗 | C,D,E | `clientId`/`issuerUrl` 錯誤 | 檢查OIDC IdP設定。`issuerUrl`必須與IdP的`/.well-known/openid-configuration`的`issuer`值完全一致（Auth0需要尾部`/`） |
| OIDC `invalid_request` | C,D,E | issuerUrl尾部斜線不匹配 | Auth0: `https://xxx.auth0.com/`（尾部`/`必須），Keycloak: 無尾部`/` |
| OIDC `Attribute cannot be updated` | C,D,E | email屬性為`mutable: false` | 需要重新建立User Pool（`mutable`建立後不可變更） |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## 相關文件

- [認證與使用者管理指南](../../docs/zh-TW/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
