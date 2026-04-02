# FSx ONTAP S3 Access Point 重現測試指南

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | [English](../en/fsx-s3ap-reproduction-test-guide.md) | [한국어](../ko/fsx-s3ap-reproduction-test-guide.md) | [简体中文](../zh-CN/fsx-s3ap-reproduction-test-guide.md) | **繁體中文** | [Français](../fr/fsx-s3ap-reproduction-test-guide.md) | [Deutsch](../de/fsx-s3ap-reproduction-test-guide.md) | [Español](../es/fsx-s3ap-reproduction-test-guide.md)

**目的**: 隔離 FSx ONTAP S3 AP AccessDenied 問題是 Organization SCP 特有的還是 FSx ONTAP S3 AP 的固有限制

---

## 前提條件

- 沒有 Organization SCP 限制的 AWS 帳戶（或已確認限制的帳戶）
- ap-northeast-1（東京）區域
- AWS CLI v2、CDK v2

## 重現步驟

### 步驟 1：FSx ONTAP + Managed AD 部署

```bash
# CDK bootstrap（如有 CloudFormation Hook，使用 --method=direct 繞過）
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors

# 部署所有堆疊（Networking + Security + Storage + AI + WebApp）
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val \
  -c vectorStoreType=s3vectors -c enableAgent=true \
  -c imageTag=latest --require-approval never --method=direct
```

### 步驟 2：SVM AD 加入

```bash
# 取得 AD DNS IP
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)
echo "AD DNS IPs: $AD_DNS_IPS"

# 取得 SVM ID
SVM_ID=$(aws fsx describe-storage-virtual-machines --region ap-northeast-1 \
  --query 'StorageVirtualMachines[0].StorageVirtualMachineId' --output text)
echo "SVM ID: $SVM_ID"

# 將 SVM 加入 AD（必須指定 OU）
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

# 等待 AD 加入完成（2-3 分鐘）
watch -n 10 "aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration.SelfManagedActiveDirectoryConfiguration.DomainName}'"
# 成功時 Lifecycle: CREATED, AD: DEMO.LOCAL
```

> **注意**：未指定 OU 時狀態會變為 MISCONFIGURED。FSx SG 中需要 AD 連接埠（636、135、464、3268-3269、1024-65535）（已反映在 CDK 程式碼中）。

### 步驟 3：FSx ONTAP 管理員密碼設定 + CIFS 共用建立

```bash
# 設定 FSx 管理員密碼
FS_ID=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].FileSystemId' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword": "FsxAdmin123!"}' --region ap-northeast-1

# 取得 ONTAP 管理 IP
MGMT_IP=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# 從 VPC 內的 EC2 執行個體建立 CIFS 共用（ONTAP REST API）
# SVM 名稱由 CDK projectName+environment 產生（例如：s3aptestval + svm）
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### 步驟 4：透過 SMB 放置檔案

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# 從 VPC 內的 EC2 執行個體透過 SMB 放置檔案
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

# 建立並上傳測試文件
echo "Test document content" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

# 驗證檔案
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### 步驟 5：建立 S3 Access Point

```bash
VOL_ID=$(aws fsx describe-volumes --region ap-northeast-1 \
  --query 'Volumes[?OntapConfiguration.JunctionPath==`/data`].VolumeId' --output text)

# 建立 WINDOWS S3 AP
aws fsx create-and-attach-s3-access-point \
  --name s3ap-test-ap \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "'$VOL_ID'",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "Admin"}
    }
  }' --region ap-northeast-1
# ⚠️ 重要：WindowsUser 不得包含網域前綴（例如 DEMO\Admin 或 demo.local\Admin）。
# 網域前綴會導致資料平面 API（ListObjects、GetObject）回傳 AccessDenied。
# 只需指定使用者名稱（例如 "Admin"）。

# 等待 AVAILABLE 狀態（約 1 分鐘）
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### 步驟 6：設定 S3 AP 政策

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

### 步驟 7：S3 AP 存取測試（重現驗證點）

```bash
# 取得 S3 AP 別名
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[0].S3AccessPoint.Alias' --output text)
echo "S3 AP Alias: $S3AP_ALIAS"

# 測試 1：ListObjectsV2
aws s3api list-objects-v2 --bucket "$S3AP_ALIAS" --region ap-northeast-1

# 測試 2：GetObject
aws s3api get-object --bucket "$S3AP_ALIAS" --key "public/test.txt" /tmp/output.txt --region ap-northeast-1

# 測試 3：s3 ls
aws s3 ls "s3://${S3AP_ALIAS}/" --region ap-northeast-1

# 測試 4：PutObject
echo "new file" | aws s3 cp - "s3://${S3AP_ALIAS}/public/new-file.txt" --region ap-northeast-1
```

## 預期結果

### 如果問題是 Organization SCP（目前在此帳戶中發生）
- 步驟 7 中的所有測試回傳 AccessDenied
- 在不同帳戶（無 SCP 限制）中成功

### 如果問題是 FSx ONTAP S3 AP 的固有限制
- 在不同帳戶中也發生相同的 AccessDenied

## 已驗證的設定（已確認非原因）

| 項目 | 狀態 | 備註 |
|------|------|------|
| ONTAP 版本 | 9.17.1P4 | 符合 S3 AP 要求（9.17.1 以上） |
| S3 協定 | 已啟用 | `allowed_protocols` 包含 `s3` |
| SVM AD 加入 | CREATED | 指定 OU 後成功 |
| S3 AP 狀態 | AVAILABLE | 使用已加入 AD 的 SVM 建立 |
| NTFS ACL | Everyone: Full Control | 磁碟區根目錄 ACL |
| S3 AP 政策 | 帳戶根目錄的 s3:* | Access Point ARN 格式 |
| IAM 政策 | AdministratorAccess | 包含 s3:* |
| 網路 | 相同 VPC/子網路 | FSx 和 AD 在相同子網路 |
| Block Public Access | 未設定（帳戶層級） | FSx S3 AP 預設強制執行 |
| UNIX 使用者對應 | root (UID 0) 已註冊 | 可透過 name-service 解析 |

## 清理

```bash
# 刪除 S3 AP
aws fsx detach-and-delete-s3-access-point --name s3ap-test-ap --region ap-northeast-1

# 刪除所有堆疊
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors \
  --force
```


---

## 隔離結果（2026-03-31）

### 測試結果

| 帳戶 | Organization | S3 AP 存取 | 結果 |
|------|-------------|-----------|------|
| 舊帳戶（個人） | 無 | ✅ 成功（空回應） | 無 AccessDenied |
| 新帳戶（CDS） | 有（SCP 限制） | ❌ AccessDenied | Organization SCP 正在阻擋 |

### 結論

**FSx ONTAP S3 AP AccessDenied 問題是由 Organization SCP 造成的。**

已確認相同的 S3 AP 存取模式在舊帳戶（非 Organization 成員）中正常運作。AccessDenied 僅在新帳戶（具有 SCP 限制的 Organization 成員）中發生。

### 修復方式

在 Organization 管理帳戶中執行以下其中一項：
1. 在 SCP 中新增允許存取 FSx ONTAP S3 AP 的陳述
2. 將目標帳戶從 SCP 限制中排除
3. 識別 SCP 阻擋的 S3 動作/資源模式，並排除 FSx S3 AP ARN 模式（`arn:aws:s3:<region>:<account>:accesspoint/*`）
