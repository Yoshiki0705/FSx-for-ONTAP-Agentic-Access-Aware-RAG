# ONTAP REST API 検証が必要

## ⚠️ 重要な問題

現在の実装で使用している以下のAPIエンドポイントは、**実際のONTAP REST APIで利用可能か未確認**です：

```
GET /api/storage/volumes/{volume-uuid}/files/{path}/acl
```

このエンドポイントは推測に基づいて実装されており、実際には存在しない可能性があります。

## 🔍 検証が必要な項目

### 1. ファイル/ディレクトリACL取得API

**想定しているエンドポイント**:
```
GET /api/storage/volumes/{volume-uuid}/files/{path}/acl
```

**確認方法**:
```bash
# FSx for ONTAP Management Endpointに対して実行
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/storage/volumes/VOLUME_UUID/files/%2Fshared/acl
```

### 2. ファイル/ディレクトリ一覧取得API

**想定しているエンドポイント**:
```
GET /api/storage/volumes/{volume-uuid}/files/{path}
```

**確認方法**:
```bash
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/storage/volumes/VOLUME_UUID/files/%2F
```

## 📚 正しいアプローチ

### オプション1: ONTAP CLI経由でACL取得

ONTAP REST APIには、CLIコマンドを実行するエンドポイントがあります：

```
POST /api/private/cli
```

**例**:
```bash
curl -k -u fsxadmin:PASSWORD \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "command": "vserver security file-directory show",
    "privilege_level": "admin",
    "vserver": "svm_name",
    "path": "/vol1/shared"
  }' \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/private/cli
```

### オプション2: NAS Security API

ONTAP REST APIには、NASセキュリティ関連のエンドポイントがあります：

```
GET /api/protocols/file-security/permissions/{svm.uuid}/{path}
```

**参考**: ONTAP 9.9.1以降で利用可能

**例**:
```bash
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/file-security/permissions/SVM_UUID/%2Fvol1%2Fshared
```

### オプション3: Export Policy経由で権限管理

NFSの場合、Export Policyで権限を管理できます：

```
GET /api/protocols/nfs/export-policies
GET /api/protocols/nfs/export-policies/{policy.id}/rules
```

**例**:
```bash
# Export Policy一覧
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/nfs/export-policies

# Export Policy Rules
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/nfs/export-policies/1/rules
```

### オプション4: SMB Share ACL

SMBの場合、Share ACLで権限を管理できます：

```
GET /api/protocols/cifs/shares
GET /api/protocols/cifs/shares/{svm.uuid}/{share}/acls
```

**例**:
```bash
# SMB Share一覧
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/cifs/shares

# SMB Share ACL
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/cifs/shares/SVM_UUID/share_name/acls
```

## 🎯 推奨される実装アプローチ

### フェーズ1: Export Policy / SMB Share ACLベース（推奨）

**理由**:
- ONTAP REST APIで確実にサポートされている
- ボリューム/共有レベルの権限管理
- 実装が比較的シンプル

**実装**:
1. Export Policy（NFS）またはSMB Share ACLを取得
2. ユーザーのアクセス可能な共有/エクスポートをフィルタリング
3. DynamoDBに権限情報をキャッシュ

**制限**:
- ファイル単位の細かい権限は取得できない
- ボリューム/共有レベルの権限のみ

### フェーズ2: File Security Permissions API（要検証）

**理由**:
- ファイル/ディレクトリ単位の詳細な権限取得
- ONTAP 9.9.1以降でサポート

**実装**:
1. `/api/protocols/file-security/permissions` エンドポイントを使用
2. ファイル/ディレクトリごとのACLを取得
3. ユーザーの権限を判定

**制限**:
- ONTAP 9.9.1以降が必要
- FSx for ONTAPのバージョン確認が必要

### フェーズ3: CLI経由（最終手段）

**理由**:
- 全てのONTAP CLIコマンドが使用可能
- 柔軟性が高い

**実装**:
1. `/api/private/cli` エンドポイントを使用
2. `vserver security file-directory show` コマンドを実行
3. 出力をパースして権限情報を取得

**制限**:
- Private APIのため、将来的に変更される可能性
- 出力のパースが必要

## 📝 次のアクション

1. **FSx for ONTAPのバージョン確認**
   ```bash
   curl -k -u fsxadmin:PASSWORD \
     https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/cluster \
     | jq '.version'
   ```

2. **利用可能なAPIエンドポイントの確認**
   ```bash
   # API一覧を取得
   curl -k -u fsxadmin:PASSWORD \
     https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api
   ```

3. **Export Policy / SMB Share ACL APIのテスト**
   ```bash
   # NFS Export Policy
   curl -k -u fsxadmin:PASSWORD \
     https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/nfs/export-policies

   # SMB Share ACL
   curl -k -u fsxadmin:PASSWORD \
     https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/cifs/shares
   ```

4. **File Security Permissions APIのテスト（ONTAP 9.9.1+）**
   ```bash
   curl -k -u fsxadmin:PASSWORD \
     https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/protocols/file-security/permissions/SVM_UUID/%2Fvol1%2Fshared
   ```

## 🔄 実装の修正が必要

現在の`ontap-rest-api-client.ts`は、未検証のAPIエンドポイントを使用しているため、**実際のAPIに合わせて修正が必要**です。

実際のFSx for ONTAP環境で上記のAPIをテストし、利用可能なエンドポイントを確認してから、実装を修正してください。
