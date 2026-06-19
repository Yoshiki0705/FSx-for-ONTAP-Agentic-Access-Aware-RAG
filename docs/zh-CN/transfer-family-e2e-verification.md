# Transfer Family FSx for ONTAP E2E 验证报告

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | [English](../en/transfer-family-e2e-verification.md) | [한국어](../ko/transfer-family-e2e-verification.md) | **简体中文** | [繁體中文](../zh-TW/transfer-family-e2e-verification.md) | [Français](../fr/transfer-family-e2e-verification.md) | [Deutsch](../de/transfer-family-e2e-verification.md) | [Español](../es/transfer-family-e2e-verification.md)

**验证日期**: 2026-05-13
**区域**: ap-northeast-1
**服务器 ID**: s-fb47244ef5ac43a28
**终端节点**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## E2E 流程验证结果

| 步骤 | 结果 | 详情 |
|---------|------|------|
| 1. SSH 密钥生成 | ✅ | RSA 4096bit |
| 2. Transfer Family 用户密钥注册 | ✅ | `import-ssh-public-key` API |
| 3. SFTP 连接 | ✅ | 认证成功（publickey） |
| 4. 文件列表显示（ls） | ✅ | 显示 2 个文件 |
| 5. 文件上传（put） | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 检测到 1 个文件变更 |
| 7. KB StartIngestionJob | ✅ | 作业 ID `JIGLRZMPEU` |
| 8. 摄取完成 | ✅ | `COMPLETE`，1 个文档新建索引 |

---

## 运行所需的必备配置

### 1. CDK 上下文参数

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **重要**: `transferFamilyS3ApAlias` 必须在 S3 Access Point 创建之后取得（CDK synth 时未知）。

### 2. S3 Access Point Alias 的取得方法

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. HomeDirectoryMappings Target 格式

```
✅ 正确: /{s3-access-point-alias}/uploads/demo-user
❌ 错误: /{ap-name}/uploads/demo-user
❌ 错误: /{ap-arn}/uploads/demo-user
❌ 错误: /{alias}/uploads/demo-user/  （尾部斜杠）
```

### 4. IAM 策略 Resource 格式

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ 不要在 IAM Resource 中使用 alias
```

### 5. s3:prefix 条件

```
✅ 正确: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ 错误: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
不需要前导斜杠。

### 6. 所需的 IAM 操作

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. SFTP 连接命令

```bash
# 从 macOS/Linux 连接（需要指定 HostKeyAlgorithms）
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

> **⚠️ 生产环境注意事项**: 上述 `StrictHostKeyChecking=no` 仅用于首次验证。在生产环境中，请将 Transfer Family 服务器的 HostKey 注册到 `~/.ssh/known_hosts`，并以 `StrictHostKeyChecking=yes`（默认值）运行。HostKey 可通过 `aws transfer describe-server --server-id <ID> --query 'Server.HostKeyFingerprint'` 获取。

### 8. FSx for ONTAP 文件系统权限

为使 Transfer Family 用户能够读写文件，FSx for ONTAP 卷上的 S3 Access Point 文件系统用户（例如 `root`）必须对上传目标目录拥有读写权限。

---

## 发现的问题与解决方案

### 问题 1: StructuredLogDestinations EarlyValidation

**症状**: 创建 ChangeSet 时出现 `AWS::EarlyValidation::PropertyValidation` 错误
**解决**: 删除 `structuredLogDestinations` 属性。仅通过 `loggingRole` 进行标准日志输出。

### 问题 2: HomeDirectoryMappings 尾部斜杠

**症状**: `Target in mapping has a trailing '/'`
**解决**: 将 `homeDirectoryPrefix` 的默认值改为 `/uploads/${userName}`（无尾部斜杠）

### 问题 3: 在 HomeDirectoryMappings Target 中使用 AP 名称

**症状**: `ls` 时出现 `No such file or directory`
**解决**: 使用 S3 AP **alias** 而非 AP 名称。格式为 `/{alias}/path`。

### 问题 4: IAM s3:prefix 中的前导斜杠

**症状**: `ls` 时出现 `Permission denied`
**解决**: 从 `s3:prefix` 条件中删除前导斜杠。`uploads/user/*` 才是正确的。

### 问题 5: SSH HostKeyAlgorithms 不匹配

**症状**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**解决**: 在 SFTP 命令中添加 `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512`。

### 问题 6: 占位符 SSH 密钥

**症状**: `Permission denied (publickey)` — 旧的占位符密钥仍然存在
**解决**: 使用 `aws transfer delete-ssh-public-key` 删除旧密钥，仅保留实际密钥。

---

## 部署后的手动设置步骤

1. **创建 S3 Access Point**（CDK 之外）
2. **取得 S3 AP Alias** → 设置到 `cdk.context.json`
3. **CDK 部署** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **生成 SSH 密钥** (`ssh-keygen -t rsa -b 4096`)
5. **注册 SSH 公钥** (`aws transfer import-ssh-public-key`)
6. **删除占位符密钥** (`aws transfer delete-ssh-public-key`)
7. **SFTP 连接测试**
8. **手动执行 Ingestion Trigger Lambda** 以确认检测

---

## AWS 控制台屏幕截图

### Transfer Family 服务器详情

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Ingestion Trigger Lambda 监控

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Lambda 函数名: `v4-test-demo-ingestion-trigger`
- 已确认执行成功

### Bedrock KB 摄取完成

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
