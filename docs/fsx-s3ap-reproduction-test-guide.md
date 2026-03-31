# FSx ONTAP S3 Access Point 再現試験ガイド

**目的**: FSx ONTAP S3 APのAccessDenied問題がOrganization SCP固有の問題か、FSx ONTAP S3 APの仕様上の問題かを切り分ける

---

## 前提条件

- Organization SCPの制限がないAWSアカウント（または制限が確認済みのアカウント）
- ap-northeast-1（東京）リージョン
- AWS CLI v2、CDK v2

## 再現手順

### Step 1: FSx ONTAP + Managed AD デプロイ

```bash
# CDKブートストラップ（CloudFormation Hookがある場合は--method=directで回避）
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors

# 全スタックデプロイ（Networking + Security + Storage + AI + WebApp）
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val \
  -c vectorStoreType=s3vectors -c enableAgent=true \
  -c imageTag=latest --require-approval never --method=direct
```

### Step 2: SVM AD参加

```bash
# AD DNS IP取得
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)
echo "AD DNS IPs: $AD_DNS_IPS"

# SVM ID取得
SVM_ID=$(aws fsx describe-storage-virtual-machines --region ap-northeast-1 \
  --query 'StorageVirtualMachines[0].StorageVirtualMachineId' --output text)
echo "SVM ID: $SVM_ID"

# SVM AD参加（OU指定が必須）
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

# AD参加完了待ち（2-3分）
watch -n 10 "aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration.SelfManagedActiveDirectoryConfiguration.DomainName}'"
# Lifecycle: CREATED, AD: DEMO.LOCAL になれば成功
```

> **注意**: OU指定なしだとMISCONFIGUREDになる。FSx SGにADポート（636, 135, 464, 3268-3269, 1024-65535）が必要（CDKコードに反映済み）。

### Step 3: FSx ONTAP管理パスワード設定 + CIFS共有作成

```bash
# FSx管理パスワード設定
FS_ID=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].FileSystemId' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword": "FsxAdmin123!"}' --region ap-northeast-1

# ONTAP管理IPを取得
MGMT_IP=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# VPC内のEC2からCIFS共有を作成（ONTAP REST API）
# SVM名はCDKのprojectName+environmentから生成される（例: s3aptestval + svm）
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### Step 4: SMBでファイル配置

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# VPC内のEC2からSMBでファイル配置
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

# テストドキュメント作成・アップロード
echo "テスト文書の内容" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

# ファイル確認
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### Step 5: S3 Access Point作成

```bash
VOL_ID=$(aws fsx describe-volumes --region ap-northeast-1 \
  --query 'Volumes[?OntapConfiguration.JunctionPath==`/data`].VolumeId' --output text)

# WINDOWS S3 AP作成
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

# AVAILABLE待ち（約1分）
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### Step 6: S3 APポリシー設定

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

### Step 7: S3 APアクセステスト（再現確認ポイント）

```bash
# S3 APエイリアス取得
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[0].S3AccessPoint.Alias' --output text)
echo "S3 AP Alias: $S3AP_ALIAS"

# テスト1: ListObjectsV2
aws s3api list-objects-v2 --bucket "$S3AP_ALIAS" --region ap-northeast-1

# テスト2: GetObject
aws s3api get-object --bucket "$S3AP_ALIAS" --key "public/test.txt" /tmp/output.txt --region ap-northeast-1

# テスト3: s3 ls
aws s3 ls "s3://${S3AP_ALIAS}/" --region ap-northeast-1

# テスト4: PutObject
echo "new file" | aws s3 cp - "s3://${S3AP_ALIAS}/public/new-file.txt" --region ap-northeast-1
```

## 期待される結果

### Organization SCP問題の場合（現在のアカウントで発生）
- Step 7の全テストがAccessDenied
- 別アカウント（SCP制限なし）では成功

### FSx ONTAP S3 APの仕様上の問題の場合
- 別アカウントでも同じAccessDenied

## 確認済みの設定（問題ではないことが確認済み）

| 項目 | 状態 | 備考 |
|------|------|------|
| ONTAPバージョン | 9.17.1P4 | S3 AP要件（9.17.1以降）を満たす |
| S3プロトコル | 有効 | `allowed_protocols`に`s3`含む |
| SVM AD参加 | CREATED | OU指定で成功 |
| S3 AP状態 | AVAILABLE | AD参加済みSVMで作成 |
| NTFS ACL | Everyone: Full Control | ボリュームルートのACL |
| S3 APポリシー | s3:* for account root | アクセスポイントARN形式 |
| IAMポリシー | AdministratorAccess | s3:*を含む |
| ネットワーク | 同一VPC/サブネット | FSxとADが同一サブネット |
| Block Public Access | 未設定（アカウントレベル） | FSx S3 APはデフォルトで強制 |
| UNIXユーザーマッピング | root (UID 0) 登録済み | name-serviceで解決可能 |

## クリーンアップ

```bash
# S3 AP削除
aws fsx detach-and-delete-s3-access-point --name s3ap-test-ap --region ap-northeast-1

# 全スタック削除
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors \
  --force
```


---

## 切り分け結果（2026-03-31）

### テスト結果

| アカウント | Organization | S3 APアクセス | 結果 |
|-----------|-------------|-------------|------|
| 旧アカウント（個人） | なし | ✅ 成功（空レスポンス） | AccessDeniedなし |
| 新アカウント（CDS） | あり（SCP制限） | ❌ AccessDenied | Organization SCPがブロック |

### 結論

**FSx ONTAP S3 APのAccessDenied問題はOrganization SCPが原因。**

旧アカウント（Organization未参加）では同じS3 APアクセスパターンが正常に動作することを確認。新アカウント（Organization参加、SCP制限あり）でのみAccessDeniedが発生。

### 対処方法

Organization管理アカウントで以下のいずれかを実施：
1. SCPにFSx ONTAP S3 APへのアクセスを許可するステートメントを追加
2. 該当アカウントをSCP制限の対象外にする
3. SCPでブロックしているS3アクション/リソースパターンを特定し、FSx S3 APのARNパターン（`arn:aws:s3:<region>:<account>:accesspoint/*`）を除外
