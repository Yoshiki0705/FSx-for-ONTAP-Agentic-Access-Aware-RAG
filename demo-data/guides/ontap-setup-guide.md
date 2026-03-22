# ONTAP CLI/REST API ボリューム設定・アクセス権設定ガイド

## 前提条件

- FSx for ONTAPファイルシステムがデプロイ済み
- SSM Session Manager経由でONTAP CLIにアクセス可能
- Management Endpointが取得済み

## 1. SVM（Storage Virtual Machine）作成

```bash
# ONTAP CLIにSSM経由でアクセス
aws ssm start-session --target <instance-id>

# SVM作成
vserver create -vserver demo-svm -subtype default -rootvolume demo_root -aggregate aggr1

# SVM確認
vserver show -vserver demo-svm
```

## 2. データボリューム作成

```bash
# メインデータボリューム
volume create -vserver demo-svm -volume demo_data \
  -aggregate aggr1 -size 100GB \
  -junction-path /demo_data \
  -security-style ntfs

# ボリューム確認
volume show -vserver demo-svm
```

## 3. NFS エクスポートポリシー設定

```bash
# エクスポートポリシールール作成（VPC内からのアクセスを許可）
export-policy rule create -vserver demo-svm \
  -policyname default \
  -clientmatch 10.0.0.0/16 \
  -rorule sys -rwrule sys -superuser sys \
  -protocol nfs

# エクスポートポリシー確認
export-policy rule show -vserver demo-svm
```

## 4. CIFS共有設定（Windows ACL用）

```bash
# CIFS共有作成
cifs share create -vserver demo-svm \
  -share-name demo_data \
  -path /demo_data

# ACL設定: Everyone（読み取り）
cifs share access-control create -vserver demo-svm \
  -share demo_data \
  -user-or-group Everyone \
  -permission read

# ACL設定: Administrators（フルコントロール）
cifs share access-control create -vserver demo-svm \
  -share demo_data \
  -user-or-group "BUILTIN\\Administrators" \
  -permission full_control

# ACL設定: プロジェクトグループ（変更）
cifs share access-control create -vserver demo-svm \
  -share demo_data \
  -user-or-group "DEMO\\ProjectMembers" \
  -permission change

# ACL確認
cifs share access-control show -vserver demo-svm -share demo_data
```

## 5. FlexCacheボリューム構成（オプション）

```bash
# FlexCacheボリューム作成（キャッシュ用）
volume flexcache create -vserver demo-svm \
  -volume demo_cache \
  -origin-vserver demo-svm \
  -origin-volume demo_data \
  -aggregate aggr1 \
  -size 50GB \
  -junction-path /demo_cache

# FlexCache確認
volume flexcache show
```

## 6. ONTAP REST API によるACL確認

```bash
# Management Endpoint
MGMT_EP="<FSx Management Endpoint>"
ONTAP_USER="fsxadmin"
ONTAP_PASS="<password>"

# SVM一覧
curl -sk -u "${ONTAP_USER}:${ONTAP_PASS}" \
  "https://${MGMT_EP}/api/svm/svms" | python3 -m json.tool

# CIFS共有ACL取得
curl -sk -u "${ONTAP_USER}:${ONTAP_PASS}" \
  "https://${MGMT_EP}/api/protocols/cifs/shares/demo-svm/demo_data/acls" \
  | python3 -m json.tool

# ボリューム一覧
curl -sk -u "${ONTAP_USER}:${ONTAP_PASS}" \
  "https://${MGMT_EP}/api/storage/volumes?svm.name=demo-svm" \
  | python3 -m json.tool
```

## 7. S3データ同期設定

FSx ONTAPのデータをS3にミラーリングしてBedrock KBのデータソースとして使用します。

```bash
# AWS DataSync タスク作成（FSx ONTAP → S3）
aws datasync create-task \
  --source-location-arn <fsx-location-arn> \
  --destination-location-arn <s3-location-arn> \
  --name "demo-fsx-to-s3-sync" \
  --options '{"VerifyMode":"ONLY_FILES_TRANSFERRED","OverwriteMode":"ALWAYS"}'
```
