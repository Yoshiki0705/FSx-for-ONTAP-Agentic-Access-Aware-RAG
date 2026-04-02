# 认证与用户管理指南

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | **简体中文** | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**创建日期**: 2026-04-02
**版本**: 3.3.0

---

## 概述

本系统提供两种认证模式。可通过部署时的 CDK 上下文参数进行切换。

| 模式 | CDK 参数 | 用户创建 | SID 注册 | 推荐用途 |
|------|---------|---------|---------|---------|
| 邮箱/密码 | `enableAdFederation=false`（默认） | 管理员手动创建 | 管理员手动注册 | PoC / 演示 |
| AD Federation | `enableAdFederation=true` | 首次登录时自动创建 | 登录时自动注册 | 生产 / 企业 |

---

## 模式 1：邮箱/密码认证（默认）

### 工作原理

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

直接在 Cognito User Pool 中创建用户，使用邮箱地址和密码进行登录。

### 管理员操作

**Step 1：创建 Cognito 用户**

```bash
# post-deploy-setup.sh 自动执行，或手动执行：
bash demo-data/scripts/create-demo-users.sh
```

**Step 2：注册 DynamoDB SID 数据**

```bash
# 手动注册 SID 数据
bash demo-data/scripts/setup-user-access.sh
```

此脚本会在 DynamoDB `user-access` 表中注册以下内容：

| userId | userSID | groupSIDs | 访问范围 |
|--------|---------|-----------|---------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | 全部文档 |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | 仅 public |

### 限制

- 每次添加用户时，管理员都需要手动更新 Cognito 和 DynamoDB
- AD 组成员变更不会自动反映
- 不适合大规模运营

---

## 模式 2：AD Federation（推荐：企业级）

### 工作原理

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

当 AD 用户通过 SAML 登录时，以下操作将全部自动完成：

1. **Cognito 用户自动创建** — 从 SAML 断言的邮箱属性自动生成 Cognito 用户
2. **SID 自动获取** — AD Sync Lambda 从 AD 获取用户 SID + 组 SID
3. **DynamoDB 自动注册** — 将获取的 SID 数据保存到 `user-access` 表（24 小时缓存）

无需管理员手动操作。

### AD Sync Lambda 行为

| AD 方式 | SID 获取方法 | 所需基础设施 |
|---------|------------|------------|
| Managed AD | LDAP 或通过 SSM 执行 PowerShell | AWS Managed AD +（可选）Windows EC2 |
| Self-managed AD | 通过 SSM 执行 PowerShell | Windows EC2（已加入 AD） |

**缓存行为：**
- 首次登录：查询 AD 获取 SID，保存到 DynamoDB
- 后续登录（24 小时内）：使用 DynamoDB 缓存，跳过 AD 查询
- 24 小时后：下次登录时从 AD 重新获取

**错误时的行为：**
- AD Sync Lambda 失败时登录不会被阻止（仅记录错误日志）
- 如果没有 SID 数据，SID 过滤采用 Fail-Closed（拒绝所有文档）

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

**设置步骤：**
1. CDK 部署（创建 Managed AD + SAML IdP + Cognito Domain）
2. SVM 加入 AD（`post-deploy-setup.sh` 自动执行）
3. 在 IAM Identity Center 中创建面向 Cognito 的 SAML 应用程序（或通过 `samlMetadataUrl` 指定外部 IdP）
4. 从 Cognito Hosted UI 的"AD 登录"按钮执行 AD 认证

### 模式 B：Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**设置步骤：**
1. 将 Windows EC2 加入 AD 并启用 SSM Agent
2. 在 Entra ID 中创建 SAML 应用程序并获取元数据 URL
3. CDK 部署
4. 从 CloudFront UI 的"AD 登录"按钮执行 AD 认证

### CDK 参数列表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| `enableAdFederation` | boolean | `false` | 启用 SAML 联合认证 |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Managed AD 管理员密码 |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | 已加入 AD 的 Windows EC2 实例 ID |
| `samlMetadataUrl` | string | - | SAML IdP 元数据 URL |
| `adDomainName` | string | - | AD 域名（例：demo.local） |
| `adDnsIps` | string | - | AD DNS IP（逗号分隔） |
| `cloudFrontUrl` | string | - | OAuth 回调 URL |

---

## 与 SID 过滤的集成

无论认证模式如何，SID 过滤机制都是相同的。

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

**SID 数据注册来源的差异：**

| 认证模式 | SID 数据注册来源 | `source` 字段 |
|---------|----------------|--------------|
| 邮箱/密码 | `setup-user-access.sh`（手动） | `Demo` |
| AD Federation (Managed) | AD Sync Lambda（自动） | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda（自动） | `AD-Sync-self-managed` |

### DynamoDB user-access 表结构

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

## 故障排除

| 症状 | 原因 | 处理方法 |
|------|------|---------|
| 登录后所有文档被拒绝 | DynamoDB 中没有 SID 数据 | AD Federation：检查 AD Sync Lambda 日志。手动：执行 `setup-user-access.sh` |
| "AD 登录"按钮未显示 | `enableAdFederation=false` | 检查 CDK 参数并重新部署 |
| SAML 认证失败 | SAML 元数据 URL 错误 | Managed AD：检查 IAM Identity Center 设置。Self-managed：检查 Entra ID 元数据 URL |
| AD 组变更未反映 | SID 缓存（24 小时） | 等待 24 小时，或删除 DynamoDB 中的相关记录后重新登录 |
| AD Sync Lambda 超时 | 通过 SSM 执行 PowerShell 较慢 | 增加 `SSM_TIMEOUT` 环境变量（默认 60 秒） |

---

## 相关文档

- [README.md — AD SAML 联合认证](../../README.zh-CN.md#ad-saml-联合认证选项) — CDK 部署步骤
- [docs/implementation-overview.md — 第 3 节：IAM 认证](../zh-CN/implementation-overview.md#3-iam-认证--lambda-function-url-iam-auth--cloudfront-oac) — 基础设施层认证设计
- [docs/SID-Filtering-Architecture.md](../zh-CN/SID-Filtering-Architecture.md) — SID 过滤详细设计
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD 集成设置
