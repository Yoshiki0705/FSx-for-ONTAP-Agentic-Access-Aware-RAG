# Active Directory権限とONTAP REST API

## 🎯 質問: ONTAP REST APIでActive Directory権限は取得できるか？

**回答**: **部分的に可能だが、制限がある**

## 📊 Active Directory統合の仕組み

### FSx for ONTAPとActive Directoryの関係

```
┌─────────────────────────────────────────────────────────────┐
│                    Active Directory                          │
│  - ユーザー: DOMAIN\user1, DOMAIN\user2                     │
│  - グループ: DOMAIN\Admins, DOMAIN\Users                    │
└─────────────────────────────────────────────────────────────┘
                              ↓ LDAP/Kerberos
┌─────────────────────────────────────────────────────────────┐
│              FSx for ONTAP (AD統合済み)                      │
│  - SVM: AD参加済み                                           │
│  - ファイル/ディレクトリ: NTFS ACL                           │
│    - Owner: DOMAIN\user1                                     │
│    - ACL: DOMAIN\Admins (Full Control)                      │
│          DOMAIN\Users (Read)                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓ ONTAP REST API
┌─────────────────────────────────────────────────────────────┐
│                    Lambda Function                           │
│  - ONTAP REST APIでACL取得                                   │
│  - ACLには "DOMAIN\Admins" などのAD情報が含まれる           │
└─────────────────────────────────────────────────────────────┘
```

## ✅ 取得できるもの

### 1. SMB Share ACL（AD統合）

**エンドポイント**:
```
GET /api/protocols/cifs/shares/{svm.uuid}/{share}/acls
```

**レスポンス例**:
```json
{
  "records": [
    {
      "user_or_group": "DOMAIN\\Admins",
      "type": "windows",
      "permission": "full_control"
    },
    {
      "user_or_group": "DOMAIN\\Users",
      "type": "windows",
      "permission": "read"
    },
    {
      "user_or_group": "DOMAIN\\user1",
      "type": "windows",
      "permission": "change"
    }
  ]
}
```

**取得できる情報**:
- ✅ ADユーザー名（例: `DOMAIN\user1`）
- ✅ ADグループ名（例: `DOMAIN\Admins`）
- ✅ 権限レベル（full_control, change, read）
- ✅ ACLタイプ（windows, unix）

### 2. File Security Permissions（NTFS ACL）

**エンドポイント**（ONTAP 9.9.1+）:
```
GET /api/protocols/file-security/permissions/{svm.uuid}/{path}
```

**レスポンス例**:
```json
{
  "acls": [
    {
      "user": "DOMAIN\\user1",
      "access": "access_allow",
      "rights": ["read_data", "write_data", "append_data"]
    },
    {
      "group": "DOMAIN\\Admins",
      "access": "access_allow",
      "rights": ["full_control"]
    }
  ],
  "owner": "DOMAIN\\user1",
  "group": "DOMAIN\\Domain Users"
}
```

**取得できる情報**:
- ✅ ファイル/ディレクトリのOwner（ADユーザー）
- ✅ ファイル/ディレクトリのGroup（ADグループ）
- ✅ 各ADユーザー/グループのACL
- ✅ 詳細な権限（read_data, write_data等）

## ❌ 取得できないもの

### 1. ADグループのメンバーシップ

**問題**: ONTAP REST APIは、ADグループに誰が所属しているかを返さない

**例**:
```
ACL: "DOMAIN\Admins" (Full Control)

ONTAP REST APIからは取得できない情報:
- DOMAIN\Admins に誰が所属しているか？
- user1 は DOMAIN\Admins のメンバーか？
```

**対処法**:
- Active Directory APIを直接照会
- AWS Directory Service APIを使用
- LDAPクエリを実行

### 2. 継承されたACL

**問題**: 親ディレクトリから継承されたACLの完全な解決

**例**:
```
/shared (ACL: DOMAIN\Users - Read)
  └── /shared/docs (継承: DOMAIN\Users - Read)
```

ONTAP REST APIは継承情報を返すが、完全な解決には複数のAPIコールが必要

### 3. 有効な権限（Effective Permissions）

**問題**: 特定のユーザーの「実際の」権限を計算できない

**例**:
```
user1 の所属:
- DOMAIN\Users
- DOMAIN\Admins
- DOMAIN\ProjectAlpha

/shared/doc.pdf のACL:
- DOMAIN\Users: Read
- DOMAIN\Admins: Full Control
- DOMAIN\ProjectAlpha: Change

user1 の有効な権限は？ → Full Control（最も強い権限）
```

ONTAP REST APIは、この計算を自動で行わない

## 🔄 実際の権限判定フロー

### パターン1: ADグループメンバーシップを考慮しない（簡易版）

```typescript
// ONTAP REST APIでACL取得
const acl = await ontapClient.getFileAcl(volumeUuid, '/shared/doc.pdf');

// ACLに直接ユーザー名が含まれているかチェック
const userAcl = acl.acls.find(entry => entry.user === 'DOMAIN\\user1');

if (userAcl && userAcl.rights.includes('read_data')) {
  return { read: true };
}

// ❌ 問題: user1がDOMAIN\Adminsのメンバーでも、検出できない
```

### パターン2: ADグループメンバーシップを考慮（完全版）

```typescript
// 1. ONTAP REST APIでACL取得
const acl = await ontapClient.getFileAcl(volumeUuid, '/shared/doc.pdf');

// 2. Active Directoryでユーザーのグループメンバーシップを取得
const userGroups = await adClient.getUserGroups('user1');
// 結果: ['DOMAIN\\Users', 'DOMAIN\\Admins', 'DOMAIN\\ProjectAlpha']

// 3. ACLとグループメンバーシップを照合
for (const aclEntry of acl.acls) {
  // ユーザー名が直接一致
  if (aclEntry.user === 'DOMAIN\\user1') {
    return { read: true };
  }
  
  // ユーザーが所属するグループが一致
  if (userGroups.includes(aclEntry.group)) {
    return { read: true };
  }
}

// ✅ 正しい: user1がDOMAIN\Adminsのメンバーであることを検出できる
```

## 🎯 推奨アーキテクチャ

### オプション1: ONTAP REST API + AWS Directory Service

```
┌─────────────────────────────────────────────────────────────┐
│              Lambda: Permission API                          │
└─────────────────────────────────────────────────────────────┘
         ↓ HTTPS                           ↓ HTTPS
┌──────────────────────────┐    ┌──────────────────────────┐
│  ONTAP REST API          │    │  AWS Directory Service   │
│  - SMB Share ACL取得     │    │  - ユーザーグループ取得  │
│  - File Security取得     │    │  - ADメンバーシップ      │
└──────────────────────────┘    └──────────────────────────┘
```

**実装**:
```typescript
// 1. ONTAP REST APIでACL取得
const acl = await ontapClient.getShareAcl(svmUuid, 'shared');

// 2. AWS Directory ServiceでADグループメンバーシップ取得
const userGroups = await directoryService.listGroupsForMember({
  DirectoryId: 'd-xxxxx',
  MemberName: 'user1'
});

// 3. 権限判定
const hasAccess = acl.some(entry => 
  entry.user === 'DOMAIN\\user1' || 
  userGroups.some(group => group.GroupName === entry.group)
);
```

### オプション2: DynamoDB同期方式（推奨）

```
┌─────────────────────────────────────────────────────────────┐
│         EC2: 定期同期ジョブ（5分ごと）                       │
│  1. ONTAP REST APIでACL取得                                  │
│  2. AWS Directory ServiceでADグループ解決                    │
│  3. ユーザーごとの有効な権限を計算                           │
│  4. DynamoDBに保存                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              DynamoDB: FSxPermissionMetadata                 │
│  {                                                           │
│    userId: "user1",                                          │
│    directories: [                                            │
│      { path: "/shared", permissions: ["read"] },            │
│      { path: "/admin", permissions: ["read", "write"] }     │
│    ],                                                        │
│    resolvedGroups: ["DOMAIN\\Users", "DOMAIN\\Admins"],    │
│    lastSynced: "2024-11-25T16:00:00Z"                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Lambda: Permission API                          │
│  - DynamoDBから読み取り（高速）                              │
│  - ADグループ解決済み                                        │
└─────────────────────────────────────────────────────────────┘
```

## 📝 結論

### ONTAP REST APIで取得できるもの
- ✅ SMB Share ACL（ADユーザー/グループ名を含む）
- ✅ File Security Permissions（NTFS ACL）
- ✅ ACLに記載されたADユーザー/グループ名

### ONTAP REST APIで取得できないもの
- ❌ ADグループのメンバーシップ
- ❌ ユーザーの有効な権限（Effective Permissions）
- ❌ 継承されたACLの完全な解決

### 推奨アプローチ
1. **ONTAP REST API**: ACL情報を取得
2. **AWS Directory Service**: ADグループメンバーシップを取得
3. **DynamoDB**: 計算済み権限をキャッシュ
4. **Lambda**: DynamoDBから高速読み取り

この3層アプローチにより、Active Directory権限を完全にサポートできます。
