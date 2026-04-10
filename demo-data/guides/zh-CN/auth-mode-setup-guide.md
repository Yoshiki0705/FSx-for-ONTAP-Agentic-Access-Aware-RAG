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

## 认证模式选择指南

### 决策流程图

根据现有认证基础设施选择最佳认证模式。

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

### 权限映射策略选择

`permissionMappingStrategy` 参数控制文档访问控制的工作方式。

| 策略 | 值 | 条件 | 文档元数据 | 推荐环境 |
|----------|-------|-----------|-------------------|------------------------|
| 仅SID | `sid-only` | Windows AD 环境 | `allowed_group_sids` | NTFS ACL 管理的文件权限 |
| 仅UID/GID | `uid-gid` | UNIX/Linux 环境 | `allowed_uids`, `allowed_gids` | POSIX 权限管理的文件 |
| 混合 | `hybrid` | 混合环境 | SID + UID/GID 两者 | AD 和 LDAP 用户共存 |

### OIDC IdP 集成检查清单

集成 OIDC IdP 时，需要在 IdP 端进行以下设置。

#### 通用（所有 OIDC IdP）

- [ ] 为 RAG 系统创建客户端应用程序（Regular Web Application）
- [ ] 获取 `clientId` 和 `clientSecret`
- [ ] 将 `clientSecret` 存储到 AWS Secrets Manager
- [ ] 将 Allowed Callback URLs 设置为 `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`
- [ ] 将 Allowed Logout URLs 设置为 `https://{cloudfront-url}/signin`
- [ ] 从 `/.well-known/openid-configuration` 的 `issuer` 字段获取 `issuerUrl`（注意尾部斜杠）
- [ ] 确认 `openid`、`email`、`profile` 作用域已启用

#### Auth0 专用

- [ ] `issuerUrl` 需添加尾部斜杠（例：`https://xxx.auth0.com/`）
- [ ] 组声明：配置包含命名空间自定义声明的 Post Login Action

#### Keycloak 专用

- [ ] `issuerUrl` 无尾部斜杠（例：`https://keycloak.example.com/realms/main`）
- [ ] Client Protocol: `openid-connect`，Access Type: `confidential`
- [ ] 组声明：在 Client Scopes 中添加 `groups` mapper

#### Okta 专用

- [ ] `issuerUrl` 无尾部斜杠（例：`https://company.okta.com`）
- [ ] Application Type: `Web Application`
- [ ] 组声明：Authorization Server → Claims → 添加 `groups` 声明

#### Entra ID（原 Azure AD）专用

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → 添加 Redirect URI
- [ ] Token Configuration → Optional Claims → 添加 `groups`

---

## LDAP 健康检查验证（模式 C）

当配置了 `ldapConfig` 时，系统会自动创建 LDAP 健康检查 Lambda。使用以下命令验证其是否正常工作。

```bash
# 手动 Lambda 调用（检查 connect/bind/search 步骤结果）
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# CloudWatch Alarm 状态（OK = 健康，ALARM = LDAP 连接失败）
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# EventBridge Rule（5分钟间隔定时执行）
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# CloudWatch Logs（结构化 JSON 日志）
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **已验证 (2026-04-10)**：针对 OpenLDAP EC2 (10.0.2.187:389) 的 LDAP 健康检查 Lambda 手动调用 — 所有步骤 SUCCESS（connect: 12ms, bind: 12ms, search: 16ms, total: 501ms）。CloudWatch Alarm: OK，EventBridge Rule: 5min ENABLED。已确认通过 NAT Gateway 访问 Secrets Manager + CloudWatch Metrics。

---

## 模式间迁移

### Mode A → Mode C/D（邮箱/密码 → OIDC Federation）

最常见的迁移模式。从 Mode A 开始进行 PoC，然后迁移到 OIDC Federation 用于生产环境。

```bash
# Step 1: 备份当前 cdk.context.json
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: 在 cdk.context.json 中添加 OIDC 配置
# Step 3: 重新部署（仅 Security + WebApp 堆栈）
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: 在 OIDC IdP 端配置 Callback URLs
# Step 5: 验证 - 确认现有邮箱/密码用户仍可登录
```

**注意：**
- 现有 Cognito 用户（邮箱/密码）不会被删除
- 现有 DynamoDB SID 数据会被保留
- 使用 `permissionMappingStrategy: "hybrid"` 实现 SID + UID/GID 用户共存
- 如果 Cognito User Pool 的 `email.mutable` 为 `false`，则需要重新创建 User Pool

### Mode B → Mode E（SAML AD → SAML + OIDC 混合）

在现有 AD SAML Federation 基础上添加 OIDC IdP。

```bash
# Step 1: 在 cdk.context.json 中添加 oidcProviderConfig（保持 enableAdFederation: true）
# Step 2: 重新部署 Security + WebApp 堆栈
# Step 3: 验证 "Sign in with AD" 和 "{providerName}" 按钮是否同时显示
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
| OIDC认证失败 | C,D,E | `clientId`/`issuerUrl` 错误 | 检查OIDC IdP设置。`issuerUrl`必须与IdP的`/.well-known/openid-configuration`的`issuer`值完全一致（Auth0需要尾部`/`） |
| OIDC `invalid_request` | C,D,E | issuerUrl尾部斜杠不匹配 | Auth0: `https://xxx.auth0.com/`（尾部`/`必须），Keycloak: 无尾部`/` |
| OIDC `Attribute cannot be updated` | C,D,E | email属性为`mutable: false` | 需要重新创建User Pool（`mutable`创建后不可更改） |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## 相关文档

- [认证与用户管理指南](../../docs/zh-CN/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
