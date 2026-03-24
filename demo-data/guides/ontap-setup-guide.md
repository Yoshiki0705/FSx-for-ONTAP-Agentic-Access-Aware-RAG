# FSx ONTAP + Active Directory 連携・CIFS共有設定ガイド

**最終更新**: 2026-03-25  
**検証済み環境**: ap-northeast-1, AWS Managed Microsoft AD (Standard), FSx for ONTAP Multi-AZ

---

## 前提条件

- FSx for ONTAPファイルシステムがデプロイ済み（CDK StorageStack）
- AWS Managed Microsoft ADがデプロイ済み（CDK StorageStack、`adPassword` 設定時）
- SSM Session Manager経由でEC2にアクセス可能

## 1. セキュリティグループの設定（AD参加前に必須）

SVM AD参加にはFSx SGとAD SG間で以下のポートが開いている必要があります。

### 必要なポート

| プロトコル | ポート | 用途 |
|-----------|--------|------|
| TCP | 135 | RPC Endpoint Mapper |
| TCP/UDP | 464 | Kerberos Password Change |
| TCP | 636 | LDAPS |
| UDP | 123 | NTP |
| TCP | 1024-65535 | RPC Dynamic Ports |
| TCP/UDP | 53 | DNS（通常CDKで設定済み） |
| TCP/UDP | 88 | Kerberos（通常CDKで設定済み） |
| TCP | 389 | LDAP（通常CDKで設定済み） |
| TCP | 445 | SMB（通常CDKで設定済み） |

### SGルール追加コマンド

```bash
FSX_SG_ID=<FSx Security Group ID>
AD_SG_ID=<AD Security Group ID>

# FSx SG に不足ポートを追加
for PORT in 135 464 636; do
  aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
    --protocol tcp --port $PORT --source-group $AD_SG_ID --region ap-northeast-1
done
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 123 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 1024-65535 --source-group $AD_SG_ID --region ap-northeast-1

# 双方向通信: AD SG ↔ FSx SG 全トラフィック許可（推奨）
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1
```

> **重要**: CDKの `allowAllOutbound: true` はアウトバウンドのみ。インバウンドルールは別途追加が必要です。

---

## 2. SVM AD参加

### AWS Managed ADの場合の注意点

AWS Managed ADでは、コンピュータオブジェクトの作成先OUを明示的に指定する必要があります。省略するとMISCONFIGURED状態になります。

OU形式: `OU=Computers,OU=<NetBIOS短縮名>,DC=<domain>,DC=<tld>`

例: ドメイン `demo.local` の場合 → `OU=Computers,OU=demo,DC=demo,DC=local`

### AD参加コマンド

```bash
SVM_ID=<SVM ID>
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

### AD参加状態の確認

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration}' \
  --region ap-northeast-1 --output json
```

### MISCONFIGUREDからの復旧

MISCONFIGUREDになった場合、同じコマンドを正しいOU pathで再実行すれば復旧します。

---

## 3. FSx ONTAP管理パスワードの設定

ONTAP REST APIを使用するには、fsxadminパスワードの設定が必要です。

```bash
FS_ID=<File System ID>
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword":"<ADMIN_PASSWORD>"}' \
  --region ap-northeast-1
```

---

## 4. CIFS共有の作成（ONTAP REST API）

### SVM情報の取得

```bash
MGMT_IP=<FSx Management Endpoint IP>

# SVM UUID取得
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/svm/svms" | python3 -m json.tool
```

### CIFS共有作成

```bash
SVM_UUID=<SVM UUID from above>

curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  -X POST "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H "Content-Type: application/json" \
  -d '{
    "svm": {"uuid": "'${SVM_UUID}'"},
    "name": "data",
    "path": "/data"
  }'
```

### CIFS共有の確認

```bash
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/protocols/cifs/shares?svm.uuid=${SVM_UUID}" \
  | python3 -m json.tool
```

---

## 5. CIFSマウント

### EC2からのマウント

```bash
# cifs-utilsインストール（Amazon Linux 2）
sudo yum install -y cifs-utils

# マウントポイント作成
sudo mkdir -p /mnt/cifs-data

# SMBエンドポイントIP取得
SMB_IP=$(aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' \
  --output text --region ap-northeast-1)

# CIFSマウント
sudo mount -t cifs //${SMB_IP}/data /mnt/cifs-data \
  -o user=Admin,password=<AD_PASSWORD>,domain=demo.local,iocharset=utf8

# マウント確認
df -h /mnt/cifs-data
ls -la /mnt/cifs-data/
```

---

## 6. テストデータの投入

### ディレクトリ構造

```
/mnt/cifs-data/
├── public/
│   ├── company-overview.md
│   ├── company-overview.md.metadata.json
│   ├── product-catalog.md
│   └── product-catalog.md.metadata.json
├── confidential/
│   ├── financial-report.md
│   ├── financial-report.md.metadata.json
│   ├── hr-policy.md
│   └── hr-policy.md.metadata.json
└── restricted/
    ├── project-plan.md
    └── project-plan.md.metadata.json
```

### データ投入コマンド

```bash
sudo mkdir -p /mnt/cifs-data/{public,confidential,restricted}

# demo-data/documents/ からコピー（EC2上にリポジトリがある場合）
sudo cp -r demo-data/documents/public/* /mnt/cifs-data/public/
sudo cp -r demo-data/documents/confidential/* /mnt/cifs-data/confidential/
sudo cp -r demo-data/documents/restricted/* /mnt/cifs-data/restricted/

# 確認
find /mnt/cifs-data -type f | sort
```

---

## 7. ボリューム管理（ONTAP REST API）

### ボリューム一覧

```bash
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/storage/volumes?svm.uuid=${SVM_UUID}" \
  | python3 -m json.tool
```

### CIFS共有ACL確認

```bash
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/protocols/cifs/shares/${SVM_UUID}/data/acls" \
  | python3 -m json.tool
```

---

## 8. FlexCacheボリューム構成（参考）

FlexCache CacheボリュームはオリジンボリュームのデータをキャッシュするONTAP機能です。

```bash
# FlexCacheボリューム作成（ONTAP CLI経由）
volume flexcache create -vserver <SVM_NAME> \
  -volume demo_cache \
  -origin-vserver <ORIGIN_SVM> \
  -origin-volume <ORIGIN_VOLUME> \
  -aggregate aggr1 \
  -size 50GB \
  -junction-path /demo_cache
```

> **注意**: FlexCache CacheボリュームではS3 Access Pointが利用できません（2026年3月時点）。代わりにEmbeddingサーバーでCIFSマウント経由のデータ取り込みを使用します。

---

## 9. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| SVM AD参加がMISCONFIGURED | OU path未指定 | `OrganizationalUnitDistinguishedName` を明示指定 |
| SVM AD参加がMISCONFIGURED | SGルール不足 | FSx SG ↔ AD SG間の全ポート開放 |
| CIFSマウント失敗 | SVM未AD参加 | 先にSVM AD参加を完了させる |
| CIFSマウント失敗 | CIFS共有未作成 | ONTAP REST APIでCIFS共有を作成 |
| ONTAP REST API接続不可 | fsxadminパスワード未設定 | `aws fsx update-file-system` でパスワード設定 |
| ONTAP REST API 401 | パスワード不一致 | 正しいfsxadminパスワードを確認 |
