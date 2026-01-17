# S3 Access Points + FSx for ONTAP ACL権限取得の可能性分析

**作成日**: 2024-11-25  
**目的**: S3 Access Pointsを介してFSx for ONTAPのACL権限を取得できるかを分析

## 🎯 質問

> S3 Access PointsがFSx for ONTAPをサポートした場合に、S3 Access Pointsを介してACL権限を取得してSSM AgentとEC2を無くすことは可能でしょうか？

## 📊 技術的分析

### 1. S3 Access Pointsの機能範囲

#### 現在の機能（S3標準）

```
S3 Access Points:
├── データアクセス（GetObject、PutObject）✅
├── バケットポリシー（IAMベース）✅
├── VPCエンドポイント統合 ✅
└── ACL取得（GetObjectAcl）✅ ← 重要！
```

**S3 APIでのACL取得**:
```bash
# S3標準バケットの場合
aws s3api get-object-acl \
  --bucket my-bucket \
  --key document.pdf

# レスポンス例
{
  "Owner": {
    "ID": "canonical-user-id"
  },
  "Grants": [
    {
      "Grantee": {
        "Type": "CanonicalUser",
        "ID": "canonical-user-id"
      },
      "Permission": "FULL_CONTROL"
    }
  ]
}
```

#### FSx for ONTAP S3 Access Pointsの場合

```
FSx for ONTAP S3 Access Points:
├── データアクセス（GetObject、PutObject）✅ 確認済み
├── バケットポリシー（IAMベース）✅ 確認済み
├── VPCエンドポイント統合 ✅ 確認済み
└── ACL取得（GetObjectAcl）❓ 未確認
```

### 2. FSx for ONTAPのACL構造

#### Windows ACL（NTFS）

```
ファイル: /vol1/documents/report.pdf
ACL:
├── Owner: DOMAIN\user01
├── Group: DOMAIN\Domain Users
└── Permissions:
    ├── DOMAIN\user01: Full Control
    ├── DOMAIN\Domain Admins: Full Control
    └── DOMAIN\Domain Users: Read & Execute
```

**SID形式**:
```
S-1-5-21-xxx-1001: Full Control
S-1-5-21-xxx-512: Full Control
S-1-5-21-xxx-513: Read & Execute
```

#### S3 ACL（Canonical User ID）

```
オブジェクト: s3://bucket/document.pdf
ACL:
├── Owner: canonical-user-id-xxxxx
└── Grants:
    ├── canonical-user-id-xxxxx: FULL_CONTROL
    └── canonical-user-id-yyyyy: READ
```

### 3. 重要な違い

| 項目 | Windows ACL（NTFS） | S3 ACL |
|------|-------------------|--------|
| 識別子 | SID（S-1-5-21-xxx-1001） | Canonical User ID |
| グループ | ADグループSID | IAMグループ |
| 権限 | Full Control、Modify、Read & Execute等 | FULL_CONTROL、READ、WRITE等 |
| 継承 | あり（親ディレクトリから継承） | なし |
| 拒否 | あり（Deny ACE） | なし |

## 🔍 可能性の検証

### シナリオ1: S3 ACLがWindows ACLにマッピングされる場合

**仮定**: FSx for ONTAPがWindows ACLをS3 ACL形式に変換して返す

```typescript
// S3 API経由でACL取得
const response = await s3Client.send(new GetObjectAclCommand({
  Bucket: 's3ap-vol1-xxxxx-ext-s3alias',
  Key: 'documents/report.pdf'
}));

// 期待されるレスポンス（理想的なケース）
{
  "Owner": {
    "ID": "S-1-5-21-xxx-1001"  // ← Windows SIDがそのまま返される？
  },
  "Grants": [
    {
      "Grantee": {
        "Type": "CanonicalUser",
        "ID": "S-1-5-21-xxx-1001"  // ← ユーザーSID
      },
      "Permission": "FULL_CONTROL"
    },
    {
      "Grantee": {
        "Type": "CanonicalUser",
        "ID": "S-1-5-21-xxx-513"  // ← グループSID
      },
      "Permission": "READ"
    }
  ]
}
```

**判定**: ✅ **可能性あり**

- FSx for ONTAPがWindows SIDをS3 ACLのCanonical User IDとして返す場合
- この場合、SSM/EC2不要でACL情報を取得可能

### シナリオ2: S3 ACLがIAMベースに変換される場合

**仮定**: FSx for ONTAPがWindows ACLをIAMプリンシパルに変換

```typescript
// S3 API経由でACL取得
const response = await s3Client.send(new GetObjectAclCommand({
  Bucket: 's3ap-vol1-xxxxx-ext-s3alias',
  Key: 'documents/report.pdf'
}));

// 期待されるレスポンス（IAM変換ケース）
{
  "Owner": {
    "ID": "arn:aws:iam::123456789012:user/user01"
  },
  "Grants": [
    {
      "Grantee": {
        "Type": "AmazonCustomerByEmail",
        "EmailAddress": "user01@example.com"
      },
      "Permission": "FULL_CONTROL"
    }
  ]
}
```

**判定**: ⚠️ **Windows SID情報が失われる**

- IAMプリンシパルに変換されると、元のWindows SIDが分からない
- この場合、SSM/EC2が必要

### シナリオ3: S3 ACLが取得できない場合

**仮定**: FSx for ONTAPがS3 ACL APIをサポートしない

```typescript
// S3 API経由でACL取得を試みる
const response = await s3Client.send(new GetObjectAclCommand({
  Bucket: 's3ap-vol1-xxxxx-ext-s3alias',
  Key: 'documents/report.pdf'
}));

// エラーレスポンス
{
  "Code": "NotImplemented",
  "Message": "ACL operations are not supported for FSx for ONTAP S3 Access Points"
}
```

**判定**: ❌ **SSM/EC2が必要**

- S3 ACL APIがサポートされない場合
- ONTAP REST APIまたはSSM PowerShellが必要

## 🎯 実現可能性の評価

### 技術的実現可能性

| アプローチ | 実現可能性 | 理由 |
|----------|----------|------|
| **S3 ACL API（SIDマッピング）** | 🟢 高い | NetAppはSID情報を保持しているため、S3 ACL形式で返すことは技術的に可能 |
| **S3 ACL API（IAM変換）** | 🟡 中程度 | IAM統合が必要だが、SID情報が失われる |
| **S3 ACL API（未サポート）** | 🔴 低い | 現在のPrivate Betaでは未確認 |

### NetApp ONTAPの既存機能

NetApp ONTAPは既に以下の機能を持っています：

1. **S3 API**: S3互換APIでオブジェクトアクセス
2. **ONTAP REST API**: 詳細なACL情報を取得可能
3. **Multi-Protocol**: SMB/NFS/S3の統合サポート

**重要**: NetApp ONTAPは**既にACL情報をS3 APIで返す機能**を持っている可能性があります。

### AWS側の対応

AWS側で必要な対応：

1. **S3 Access Points**: FSx for ONTAP S3 Access Points経由でのACL API転送
2. **IAM統合**: Windows SIDとIAMプリンシパルのマッピング（オプション）

## 📋 検証が必要な項目

### Phase 1: 現在のPrivate Betaでの検証

```bash
# 1. FSx for ONTAP S3 Access Point経由でACL取得を試みる
aws s3api get-object-acl \
  --bucket s3ap-vol1-xxxxx-ext-s3alias \
  --key documents/report.pdf \
  --region us-east-1

# 期待される結果:
# - 成功: ACL情報が返される（SID形式かIAM形式かを確認）
# - 失敗: NotImplementedエラー
```

### Phase 2: ONTAP REST API経由での確認

```bash
# ONTAP REST APIで同じファイルのACLを取得
curl -X GET "https://management.fs-xxxxx.fsx.amazonaws.com/api/protocols/cifs/shares/svm/vol1/acls" \
  -H "Authorization: Basic $(echo -n 'admin:password' | base64)"

# 比較:
# - S3 ACL APIとONTAP REST APIの結果を比較
# - SID情報が一致するか確認
```

### Phase 3: NetApp公式ドキュメント確認

NetApp ONTAPの公式ドキュメントで以下を確認：

1. **S3 ACL API対応**: ONTAPがS3 ACL APIをサポートしているか
2. **SIDマッピング**: Windows SIDをS3 ACL形式で返すか
3. **Multi-Protocol ACL**: SMB/NFS/S3間でのACL統合

## 🎯 結論

### 短期的（現在のPrivate Beta）

**判定**: ⚠️ **検証が必要**

- FSx for ONTAP S3 Access PointsでS3 ACL APIがサポートされているか不明
- 実際に検証する必要がある

**推奨アクション**:
1. Private Beta環境でS3 ACL API（GetObjectAcl）を試す
2. 結果に応じて実装方針を決定

### 中期的（GA後）

**判定**: 🟢 **実現可能性が高い**

理由：
1. NetApp ONTAPは既にACL情報を管理している
2. S3 APIでACL情報を返すことは技術的に可能
3. AWSとNetAppの協力により実現可能

**期待される機能**:
```typescript
// S3 Access Points経由でACL取得
const acl = await s3Client.send(new GetObjectAclCommand({
  Bucket: 's3ap-vol1-xxxxx-ext-s3alias',
  Key: 'documents/report.pdf'
}));

// Windows SIDがそのまま返される
acl.Grants.forEach(grant => {
  console.log(`SID: ${grant.Grantee.ID}`);  // S-1-5-21-xxx-1001
  console.log(`Permission: ${grant.Permission}`);  // FULL_CONTROL
});
```

### 長期的（将来の拡張）

**判定**: 🟢 **SSM/EC2を完全に排除可能**

理由：
1. S3 Access Points経由でACL情報を取得
2. Lambda関数から直接S3 APIを呼び出し
3. SSM/EC2インフラが不要

**アーキテクチャ**:
```
ユーザーリクエスト
    ↓
Lambda関数
    ↓
S3 Access Points（FSx for ONTAP）
    ├── GetObject（データ取得）
    └── GetObjectAcl（ACL取得）← 新機能
    ↓
ACL情報（Windows SID）
    ↓
user-access-tableのSIDと照合
    ↓
権限判定
```

**メリット**:
- ✅ SSM/EC2インフラ不要
- ✅ 低遅延（Lambda → S3 API直接）
- ✅ コスト削減（EC2インスタンス不要）
- ✅ シンプルなアーキテクチャ

## 📝 次のステップ

### 即座に実行可能

1. **Private Beta環境でS3 ACL API検証**
   ```bash
   aws s3api get-object-acl \
     --bucket s3ap-vol1-xxxxx-ext-s3alias \
     --key test-data/documents/product-catalog.txt \
     --region us-east-1
   ```

2. **結果に応じた実装方針決定**
   - 成功 → S3 Access Points中心のアーキテクチャ
   - 失敗 → ハイブリッドアプローチ（ONTAP REST API + SSM PowerShell）

### 中期的（GA後）

1. **AWSサポートに機能リクエスト**
   - S3 ACL API対応の要望
   - Windows SIDマッピングの要望

2. **NetAppコミュニティでの確認**
   - ONTAP S3 ACL API対応状況
   - ベストプラクティスの確認

---

**最終更新**: 2024-11-25  
**ステータス**: 検証待ち（Private Beta環境でのテストが必要）

