# FSx for ONTAP 権限取得の実装オプション

## 問題点

**Lambda関数からFSx for ONTAPに直接マウントすることはできません**

理由：
- Lambda関数はVPC内で実行されるが、ファイルシステムのマウントには特権が必要
- Lambda実行環境は読み取り専用（/tmpを除く）
- NFSマウントには永続的なネットワーク接続が必要

## 実現可能な3つのアプローチ

### 🎯 推奨: オプション1 - DynamoDB権限メタデータ同期方式

**概要**: FSx ACLをDynamoDBに同期し、Lambdaはそこから読み取る

```
┌─────────────────────────────────────────────────────────────┐
│                    FSx for ONTAP                             │
│  /shared, /public, /admin, /projects                        │
└─────────────────────────────────────────────────────────────┘
                              ↓ 定期同期（EventBridge + EC2）
┌─────────────────────────────────────────────────────────────┐
│              DynamoDB: FSxPermissionMetadata                 │
│  {                                                           │
│    userId: "user123",                                        │
│    directories: [                                            │
│      { path: "/shared", permissions: ["read"] },            │
│      { path: "/projects/alpha", permissions: ["read","write"] } │
│    ],                                                        │
│    lastSynced: "2024-11-25T15:00:00Z"                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓ 読み取り
┌─────────────────────────────────────────────────────────────┐
│              Lambda: Permission API                          │
│  - DynamoDBから権限メタデータを取得                          │
│  - 高速（数ms）                                              │
│  - スケーラブル                                              │
└─────────────────────────────────────────────────────────────┘
```

**実装**:

1. **同期Lambda（EC2上で実行）**
```typescript
// lambda/permissions/sync-fsx-permissions.ts
// EC2インスタンス上で定期実行（EventBridge Scheduler）

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// FSxマウントポイント（EC2上）
const FSX_MOUNT = '/mnt/fsx';

async function syncFsxPermissions() {
  // 1. FSxから全ユーザーの権限を取得
  const users = await getAllUsers();
  
  for (const user of users) {
    const permissions = await scanUserPermissions(user.userId);
    
    // 2. DynamoDBに保存
    await saveToDynamoDB(user.userId, permissions);
  }
}

async function scanUserPermissions(userId: string): Promise<DirectoryPermission[]> {
  const directories = await fs.readdir(FSX_MOUNT);
  const permissions: DirectoryPermission[] = [];
  
  for (const dir of directories) {
    const fullPath = `${FSX_MOUNT}/${dir}`;
    const acl = await getAcl(fullPath);
    
    if (hasAccess(userId, acl)) {
      permissions.push({
        path: `/${dir}`,
        permissions: getPermissionLevel(userId, acl),
        owner: acl.owner,
        group: acl.group,
      });
    }
  }
  
  return permissions;
}

async function getAcl(path: string) {
  const { stdout } = await execAsync(`getfacl "${path}"`);
  return parseAcl(stdout);
}
```

2. **Permission API（Lambda）**
```typescript
// lambda/permissions/fsx-permission-service.ts（修正版）

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const FSX_PERMISSION_TABLE = 'TokyoRegion-permission-aware-rag-prod-FSxPermissions';

export class FsxPermissionService {
  async queryUserPermissions(userId: string): Promise<DirectoryPermission[]> {
    // DynamoDBから同期済み権限を取得
    const command = new GetCommand({
      TableName: FSX_PERMISSION_TABLE,
      Key: { userId },
    });
    
    const result = await dynamodb.send(command);
    
    if (!result.Item) {
      return [];
    }
    
    // キャッシュの鮮度チェック（5分以内）
    const lastSynced = new Date(result.Item.lastSynced);
    const now = new Date();
    const ageMinutes = (now.getTime() - lastSynced.getTime()) / 60000;
    
    if (ageMinutes > 5) {
      console.warn(`FSx permissions cache is stale (${ageMinutes} minutes old)`);
    }
    
    return result.Item.directories || [];
  }
}
```

**メリット**:
- ✅ Lambda制約を回避
- ✅ 高速（DynamoDB読み取り）
- ✅ スケーラブル
- ✅ コスト効率的

**デメリット**:
- ⚠️ 最大5分の遅延（同期間隔による）
- ⚠️ 同期処理の実装が必要

---

### オプション2 - EC2プロキシ方式

**概要**: EC2インスタンスをプロキシとして、LambdaからHTTP経由でFSx ACLを照会

```
┌─────────────────────────────────────────────────────────────┐
│              Lambda: Permission API                          │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│         EC2: FSx Permission Proxy Service                    │
│  - Express.js API                                            │
│  - GET /permissions/:userId                                  │
│  - FSxマウント済み                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓ NFS/SMB
┌─────────────────────────────────────────────────────────────┐
│                    FSx for ONTAP                             │
└─────────────────────────────────────────────────────────────┘
```

**実装**:

1. **EC2プロキシサービス**
```typescript
// ec2-proxy/server.ts
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const app = express();
const execAsync = promisify(exec);

app.get('/permissions/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const permissions = await scanUserPermissions(userId);
    res.json({ userId, permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

2. **Lambda（HTTP クライアント）**
```typescript
// lambda/permissions/fsx-permission-service.ts（修正版）

export class FsxPermissionService {
  private proxyUrl: string;
  
  constructor() {
    this.proxyUrl = process.env.FSX_PROXY_URL || 'http://ec2-proxy:3000';
  }
  
  async queryUserPermissions(userId: string): Promise<DirectoryPermission[]> {
    const response = await fetch(`${this.proxyUrl}/permissions/${userId}`);
    
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.permissions;
  }
}
```

**メリット**:
- ✅ リアルタイム権限取得
- ✅ 実装がシンプル

**デメリット**:
- ⚠️ EC2インスタンスの運用コスト
- ⚠️ 単一障害点（EC2ダウン時）
- ⚠️ レイテンシー増加

---

### オプション3 - ONTAP REST API方式

**概要**: FSx for ONTAP Management APIを使用してACLを照会

```
┌─────────────────────────────────────────────────────────────┐
│              Lambda: Permission API                          │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│         FSx for ONTAP Management API                         │
│  - REST API                                                  │
│  - GET /api/storage/volumes/{volume}/files/{path}/acl       │
└─────────────────────────────────────────────────────────────┘
```

**実装**:

```typescript
// lambda/permissions/ontap-api-client.ts

import axios from 'axios';

export class OntapApiClient {
  private baseUrl: string;
  private credentials: { username: string; password: string };
  
  constructor() {
    this.baseUrl = `https://${process.env.FSX_MANAGEMENT_ENDPOINT}`;
    this.credentials = {
      username: process.env.ONTAP_USERNAME!,
      password: process.env.ONTAP_PASSWORD!,
    };
  }
  
  async getFileAcl(volumeName: string, filePath: string) {
    const url = `${this.baseUrl}/api/storage/volumes/${volumeName}/files/${filePath}/acl`;
    
    const response = await axios.get(url, {
      auth: this.credentials,
      headers: { 'Accept': 'application/json' },
    });
    
    return response.data;
  }
  
  async listDirectories(volumeName: string) {
    const url = `${this.baseUrl}/api/storage/volumes/${volumeName}/files`;
    
    const response = await axios.get(url, {
      auth: this.credentials,
      params: { type: 'directory' },
    });
    
    return response.data.records;
  }
}
```

**メリット**:
- ✅ AWS公式サポート
- ✅ リアルタイム権限取得
- ✅ EC2不要

**デメリット**:
- ⚠️ ONTAP REST APIの学習コスト
- ⚠️ 認証情報の管理（Secrets Manager必須）
- ⚠️ API制限の考慮が必要

---

## 推奨実装

### フェーズ1: DynamoDB同期方式（短期）

**理由**:
- 最も実装が簡単
- Lambda制約を完全に回避
- 既存のDynamoDB権限システムと統合しやすい

**実装手順**:
1. DynamoDBテーブル `FSxPermissionMetadata` を作成
2. EC2上で同期Lambda（またはcronジョブ）を実装
3. EventBridge Schedulerで5分ごとに実行
4. Permission APIはDynamoDBから読み取り

### フェーズ2: ONTAP REST API方式（長期）

**理由**:
- リアルタイム権限取得
- EC2不要でコスト削減
- AWSネイティブソリューション

**実装手順**:
1. FSx for ONTAP Management APIの調査
2. Secrets Managerで認証情報管理
3. OntapApiClientの実装
4. Permission APIを更新

---

## 次のアクション

どのアプローチを採用しますか？

1. **DynamoDB同期方式** - 推奨、すぐに実装可能
2. **EC2プロキシ方式** - リアルタイム必須の場合
3. **ONTAP REST API方式** - 長期的な最適解

選択いただければ、そのアプローチで実装を進めます。
