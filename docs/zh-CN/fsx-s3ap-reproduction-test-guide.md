# FSx ONTAP S3 Access Point 复现测试指南

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | [English](../en/fsx-s3ap-reproduction-test-guide.md) | [한국어](../ko/fsx-s3ap-reproduction-test-guide.md) | **简体中文** | [繁體中文](../zh-TW/fsx-s3ap-reproduction-test-guide.md) | [Français](../fr/fsx-s3ap-reproduction-test-guide.md) | [Deutsch](../de/fsx-s3ap-reproduction-test-guide.md) | [Español](../es/fsx-s3ap-reproduction-test-guide.md)

**目的**: 隔离 FSx ONTAP S3 AP AccessDenied 问题是 Organization SCP 特有的还是 FSx ONTAP S3 AP 的固有限制

---

## 前提条件

- 没有 Organization SCP 限制的 AWS 账户（或已确认限制的账户）
- ap-northeast-1（东京）区域
- AWS CLI v2、CDK v2

## 复现步骤

### 步骤 1：FSx ONTAP + Managed AD 部署

```bash
# CDK bootstrap (use --method=direct to bypass CloudFormation Hook if present)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors

# Deploy all stacks (Networking + Security + Storage + AI + WebApp)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val \
  -c vectorStoreType=s3vectors -c enableAgent=true \
  -c imageTag=latest --require-approval never --method=direct
```

### 步骤 2：SVM AD 加入

```bash
# Get AD DNS IPs
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)
echo "AD DNS IPs: $AD_DNS_IPS"

# Get SVM ID
SVM_ID=$(aws fsx describe-storage-virtual-machines --region ap-northeast-1 \
  --query 'StorageVirtualMachines[0].StorageVirtualMachineId' --output text)
echo "SVM ID: $SVM_ID"

# Join SVM to AD (OU specification is required)
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1

# Wait for AD join to complete (2-3 minutes)
watch -n 10 "aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration.SelfManagedActiveDirectoryConfiguration.DomainName}'"
# Success when Lifecycle: CREATED, AD: DEMO.LOCAL
```

> **注意**：不指定 OU 时，状态会变为 MISCONFIGURED。FSx 安全组中需要 AD 端口（636、135、464、3268-3269、1024-65535）（已在 CDK 代码中反映）。

### 步骤 3：FSx ONTAP 管理员密码设置 + CIFS 共享创建

```bash
# Set FSx admin password
FS_ID=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].FileSystemId' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword": "FsxAdmin123!"}' --region ap-northeast-1

# Get ONTAP management IP
MGMT_IP=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# Create CIFS share from an EC2 instance within the VPC (ONTAP REST API)
# SVM name is generated from CDK projectName+environment (e.g., s3aptestval + svm)
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### 步骤 4：通过 SMB 放置文件

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# Place files via SMB from an EC2 instance within the VPC
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

# Create and upload test documents
echo "Test document content" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

# Verify files
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### 步骤 5：创建 S3 Access Point

```bash
VOL_ID=$(aws fsx describe-volumes --region ap-northeast-1 \
  --query 'Volumes[?OntapConfiguration.JunctionPath==`/data`].VolumeId' --output text)

# Create WINDOWS S3 AP
aws fsx create-and-attach-s3-access-point \
  --name s3ap-test-ap \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "'$VOL_ID'",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "demo.local\\Admin"}
    }
  }' --region ap-northeast-1

# Wait for AVAILABLE status (approximately 1 minute)
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### 步骤 6：配置 S3 AP 策略

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

aws s3control put-access-point-policy \
  --account-id $ACCOUNT_ID \
  --name s3ap-test-ap \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "AllowAccountAccess",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::'$ACCOUNT_ID':root"},
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/s3ap-test-ap",
        "arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/s3ap-test-ap/object/*"
      ]
    }]
  }' --region ap-northeast-1
```

### 步骤 7：S3 AP 访问测试（复现验证点）

```bash
# Get S3 AP alias
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[0].S3AccessPoint.Alias' --output text)
echo "S3 AP Alias: $S3AP_ALIAS"

# Test 1: ListObjectsV2
aws s3api list-objects-v2 --bucket "$S3AP_ALIAS" --region ap-northeast-1

# Test 2: GetObject
aws s3api get-object --bucket "$S3AP_ALIAS" --key "public/test.txt" /tmp/output.txt --region ap-northeast-1

# Test 3: s3 ls
aws s3 ls "s3://${S3AP_ALIAS}/" --region ap-northeast-1

# Test 4: PutObject
echo "new file" | aws s3 cp - "s3://${S3AP_ALIAS}/public/new-file.txt" --region ap-northeast-1
```

## 预期结果

### 如果问题是 Organization SCP（当前在此账户中发生）
- 步骤 7 中的所有测试返回 AccessDenied
- 在不同账户（无 SCP 限制）中成功

### 如果问题是 FSx ONTAP S3 AP 的固有限制
- 在不同账户中也出现相同的 AccessDenied

## 已验证的设置（已确认不是原因）

| 项目 | 状态 | 备注 |
|------|--------|-------|
| ONTAP 版本 | 9.17.1P4 | 满足 S3 AP 要求（9.17.1 或更高版本） |
| S3 协议 | 已启用 | `allowed_protocols` 包含 `s3` |
| SVM AD 加入 | CREATED | 通过指定 OU 成功 |
| S3 AP 状态 | AVAILABLE | 使用已加入 AD 的 SVM 创建 |
| NTFS ACL | Everyone: Full Control | 卷根 ACL |
| S3 AP 策略 | 账户根的 s3:* | Access Point ARN 格式 |
| IAM 策略 | AdministratorAccess | 包含 s3:* |
| 网络 | 同一 VPC/子网 | FSx 和 AD 在同一子网 |
| Block Public Access | 未配置（账户级别） | FSx S3 AP 默认强制执行 |
| UNIX 用户映射 | root（UID 0）已注册 | 可通过 name-service 解析 |

## 清理

```bash
# Delete S3 AP
aws fsx detach-and-delete-s3-access-point --name s3ap-test-ap --region ap-northeast-1

# Delete all stacks
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors \
  --force
```


---

## 隔离结果（2026-03-31）

### 测试结果

| 账户 | Organization | S3 AP 访问 | 结果 |
|---------|-------------|-------------|--------|
| 旧账户（个人） | 无 | ✅ 成功（空响应） | 无 AccessDenied |
| 新账户（CDS） | 有（SCP 限制） | ❌ AccessDenied | Organization SCP 正在阻止 |

### 结论

**FSx ONTAP S3 AP AccessDenied 问题是由 Organization SCP 引起的。**

已确认相同的 S3 AP 访问模式在旧账户（不属于 Organization）中正常工作。AccessDenied 仅在新账户（属于有 SCP 限制的 Organization）中发生。

### 修复方案

在 Organization 管理账户中执行以下操作之一：
1. 在 SCP 中添加允许访问 FSx ONTAP S3 AP 的语句
2. 将目标账户从 SCP 限制中排除
3. 识别 SCP 阻止的 S3 操作/资源模式，并排除 FSx S3 AP ARN 模式（`arn:aws:s3:<region>:<account>:accesspoint/*`）
