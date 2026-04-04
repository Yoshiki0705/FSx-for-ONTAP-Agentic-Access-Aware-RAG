# 认证模式演示环境搭建指南

**创建日期**: 2026-04-04
**创建日期**: 为5种认证模式分别搭建可重现的演示环境

---

## 概述

本系统支持5种认证模式。示例配置文件位于 `demo-data/configs/`，复制到 `cdk.context.json` 即可部署。

| 模式 | 配置文件 | 认证方式 | 权限获取 | 额外基础设施 |
|--------|----------|--------|--------|---------|
| A | `mode-a-email-password.json` | 邮箱/密码 | 手动SID注册 | 无 |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | 仅OIDC Claims | OIDC令牌 | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## 通用步骤

### 前提条件

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

## 故障排除

| | 模式 | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## 相关文档

- [认证与用户管理指南](../../docs/zh-CN/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
