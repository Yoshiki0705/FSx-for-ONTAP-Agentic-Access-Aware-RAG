# Transfer Family 合作伙伴接入指南

**🌐 Language:** [日本語](../transfer-family-partner-onboarding.md) | [English](../en/transfer-family-partner-onboarding.md) | [한국어](../ko/transfer-family-partner-onboarding.md) | **简体中文** | [繁體中文](../zh-TW/transfer-family-partner-onboarding.md) | [Français](../fr/transfer-family-partner-onboarding.md) | [Deutsch](../de/transfer-family-partner-onboarding.md) | [Español](../es/transfer-family-partner-onboarding.md)

**最后更新**: 2026-05-23  
**适用对象**: 外部合作伙伴（律师事务所、审计机构、监管机构等）的 SFTP 访问设置

---

## 概述

本指南介绍如何使用 AWS Transfer Family 让外部合作伙伴通过 SFTP 上传文档，并自动摄取到 Permission-aware RAG Knowledge Base 的设置步骤。

### 架构

```
合作伙伴 (SFTP) → Transfer Family → FSx for ONTAP S3 AP → Metadata Generator → Bedrock KB
```

合作伙伴只需使用 SFTP 客户端即可操作。无需访问 Web UI 或 AWS 控制台。

---

## 1. 前提条件

### 系统管理员侧

- [x] 已使用 `enableTransferFamily=true` 完成 CDK 部署
- [x] S3 Access Point 已连接到 FSx for ONTAP 卷
- [x] 已在 DynamoDB 权限映射表中注册合作伙伴的权限设置

### 合作伙伴侧

- [x] SFTP 客户端（FileZilla、WinSCP、OpenSSH 等）
- [x] SSH 密钥对（RSA 4096bit 或 Ed25519）

---

## 2. SSH 密钥准备

### 合作伙伴生成密钥的情况

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

请将生成的**公钥**（`~/.ssh/transfer-family-key.pub`）发送给系统管理员。

> **安全注意事项**: 切勿共享私钥（`~/.ssh/transfer-family-key`）。

### 系统管理员注册密钥的情况

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. SFTP 连接参数

请向合作伙伴提供以下连接信息：

| 参数 | 值 |
|-----------|-----|
| 主机 | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| 端口 | `22` |
| 协议 | SFTP |
| 用户名 | `partner-a`（由管理员分配） |
| 认证方式 | SSH 公钥认证 |
| 主目录 | `/uploads/partner-a/` |

### 连接命令（OpenSSH）

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### FileZilla 设置

1. **站点管理器** → 新建站点
2. 协议: **SFTP**
3. 主机: `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. 登录类型: **密钥文件**
5. 用户: `partner-a`
6. 密钥文件: 指定私钥的路径

### WinSCP 设置

1. **新建会话**
2. 文件协议: **SFTP**
3. 主机名: Transfer Family 终端节点
4. 用户名: `partner-a`
5. **高级设置** → SSH → 认证 → 指定私钥文件

---

## 4. 文件上传步骤

### 目录结构

合作伙伴的主目录限制为 `/uploads/partner-a/`。

```
/uploads/partner-a/
├── contracts/          ← 合同
├── reports/            ← 报告
├── correspondence/     ← 往来文书
└── misc/               ← 其他
```

### 上传操作

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### 文件命名规则

| 规则 | 说明 |
|--------|------|
| 扩展名 | 推荐 `.pdf`、`.docx`、`.txt`、`.md`、`.html` |
| 文件名 | 使用字母数字、连字符、下划线 |
| 大小上限 | 5 GB（S3 Access Point 的限制） |
| 禁止操作 | 不支持文件重命名（rename）、追加写入（append） |

### 限制事项

- **禁止创建、修改、删除 `.metadata.json` 文件**（IAM Deny）
- 权限元数据由系统自动生成
- 由于 S3 Access Point 的限制，不支持文件的 rename/append 操作

---

## 5. 摄取确认

上传后，将按以下时间线进行处理：

| 步骤 | 所需时间 | 说明 |
|---------|---------|------|
| 文件检测 | 最多 5 分钟 | EventBridge Scheduler 轮询 |
| 元数据生成 | 数秒 | `.metadata.json` 自动生成 |
| KB 摄取 | 1-5 分钟 | 摄取到 Bedrock Knowledge Base |
| RAG 可检索 | 即时 | 摄取完成后 |

### 确认方法（面向系统管理员）

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. 故障排除

### 无法连接

| 症状 | 原因 | 处理 |
|------|------|------|
| `Permission denied (publickey)` | SSH 密钥未注册或不匹配 | 请管理员重新注册公钥 |
| `Connection timed out` | 网络限制（IP 允许列表） | 请管理员添加 IP 地址 |
| `no matching host key type found` | HostKeyAlgorithms 不匹配 | 添加 `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` |

### 无法上传

| 症状 | 原因 | 处理 |
|------|------|------|
| `put` 时出现 `Permission denied` | 访问主目录之外 | 上传至 `/uploads/partner-a/` 下 |
| `.metadata.json` 出现 `Permission denied` | IAM Deny 策略 | 禁止对元数据文件进行操作（正常行为） |
| `File too large` | 超过 5GB 限制 | 拆分文件后上传 |

### 文件未反映到 RAG

| 症状 | 原因 | 处理 |
|------|------|------|
| 超过 5 分钟仍未反映 | 等待轮询间隔或 Lambda 错误 | 请管理员确认 CloudWatch Logs |
| 摄取作业为 FAILED | 文件格式不支持 | 确认支持的格式（PDF、DOCX、TXT、MD、HTML） |

---

## 7. 安全模型

### 合作伙伴的访问范围

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### 权限元数据的自动生成

合作伙伴上传文件后，系统会自动生成 `.metadata.json`：

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

此权限信息从 DynamoDB 的管理员设置表中导出。合作伙伴无法直接指定权限。

---

## 8. 面向管理员：添加合作伙伴步骤

### 添加新合作伙伴

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

### 停用合作伙伴

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## 相关文档

- [Transfer Family E2E 验证报告](transfer-family-e2e-verification.md)
- [Transfer Family 网络前提条件](transfer-family-networking-prerequisites.md)
- [AWS Transfer Family + FSx S3 AP 文档](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
