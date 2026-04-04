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

## 清理

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## 疑難排解

| | 模式 | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## 相關文件

- [認證與使用者管理指南](../../docs/zh-TW/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
