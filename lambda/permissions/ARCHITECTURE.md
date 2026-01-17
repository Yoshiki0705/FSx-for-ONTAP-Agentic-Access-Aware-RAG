# Permission API アーキテクチャ

## 概要

このPermission APIは、既存の3つの権限システムを統合した**統合権限管理システム**です。

## 統合される権限システム

### 1. DynamoDB権限システム (`permission-filter/`)

**役割**: アプリケーションレベルの権限管理

**データソース**: DynamoDB `PermissionConfig` テーブル

**権限レベル**:
- `admin`: 管理者（全権限）
- `emergency`: 緊急対応ユーザー（時間・地理制限なし）
- `security`: セキュリティ管理者
- `system`: システム管理者
- `project`: プロジェクトメンバー
- `basic`: 基本ユーザー

**チェック内容**:
- ユーザープロファイルの存在確認
- アクション別の権限チェック（bedrock-chat, document-access等）
- 部署・役割ベースのアクセス制御

### 2. 時間・地理制限システム (`advanced-permission/`)

**役割**: コンテキストベースのアクセス制御

**チェック内容**:
- **営業時間制限**: 平日 9:00-18:00のみアクセス可能
- **地理的制限**: 許可されたIPアドレスレンジからのみアクセス可能
- **緊急ユーザー例外**: admin001, emergency001等は制限を受けない

**許可IPレンジ**:
```
127.0.0.1, ::1          # ローカルホスト
192.168.x.x             # プライベートネットワーク
10.0.x.x                # プライベートネットワーク
172.16.x.x              # プライベートネットワーク
203.0.113.x             # テスト用
198.51.100.x            # テスト用
192.0.2.x               # テスト用
```

### 3. FSx ACL権限システム (`permissions/` - 新規)

**役割**: ファイルシステムレベルの権限管理

**データソース**: FSx for ONTAP NFS/SMB ACL

**チェック内容**:
- ディレクトリ単位のアクセス権限（read/write）
- ファイル単位のアクセス権限
- POSIX ACL（getfaclコマンド）による詳細な権限チェック

**ディレクトリ構造例**:
```
/shared     - read: all, write: admin
/public     - read: all, write: all
/private    - read: owner, write: owner
/admin      - read: admin, write: admin
/projects   - read: project members, write: project members
```

## 統合判定フロー

```
┌─────────────────────────────────────────────────────────────┐
│                    GET /api/user/permissions                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              1. Cognito認証（JWT検証）                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         2. UnifiedPermissionService.checkUnifiedPermissions  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2.1 DynamoDB権限取得                                  │  │
│  │     - PermissionConfigテーブルからユーザー情報取得    │  │
│  │     - permissionLevel, department, role等             │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2.2 FSx ACL権限取得                                   │  │
│  │     - FsxPermissionService.queryUserPermissions()     │  │
│  │     - getfaclコマンドでACL照会                        │  │
│  │     - アクセス可能ディレクトリリスト取得              │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2.3 時間制限チェック                                  │  │
│  │     - 営業時間内か？（平日 9:00-18:00）              │  │
│  │     - 緊急ユーザーか？                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2.4 地理的制限チェック                                │  │
│  │     - 許可されたIPレンジか？                          │  │
│  │     - 緊急ユーザーは例外                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2.5 統合判定                                          │  │
│  │     - 全てのチェックをAND条件で評価                   │  │
│  │     - 拒否理由を生成                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    3. レスポンス返却                         │
│                                                              │
│  allowed: true の場合:                                       │
│  {                                                           │
│    userId: "user123",                                        │
│    userName: "山田太郎",                                     │
│    role: "project-member",                                   │
│    accessibleDirectories: [                                  │
│      { path: "/shared", permissions: ["read"] },            │
│      { path: "/projects/alpha", permissions: ["read", "write"] } │
│    ],                                                        │
│    lastUpdated: "2024-11-25T15:30:00Z"                      │
│  }                                                           │
│                                                              │
│  allowed: false の場合:                                      │
│  {                                                           │
│    error: "Unauthorized",                                    │
│    message: "営業時間外のアクセスです, 許可されていない地域からのアクセスです", │
│    statusCode: 401                                           │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

## 統合判定ロジック

### AND条件（全て満たす必要がある）

1. ✅ **DynamoDB権限**: ユーザープロファイルが存在する
2. ✅ **時間制限**: 営業時間内 OR 緊急ユーザー
3. ✅ **地理的制限**: 許可されたIP OR 緊急ユーザー
4. ✅ **FSx ACL**: 少なくとも1つのディレクトリにアクセス可能
5. ✅ **リソース権限**: リクエストされたリソースへのアクセス権限がある（オプション）

### 優先順位

1. **緊急ユーザー（admin, emergency）**: 時間・地理制限を受けない
2. **管理者レベル（admin, security, system）**: 全FSxディレクトリにアクセス可能
3. **プロジェクトレベル**: /shared, /public, /projects/ にアクセス可能
4. **基本レベル**: /shared, /public にアクセス可能

## エラーハンドリング

### リトライロジック（Exponential Backoff）

```typescript
maxRetries: 3
initialDelay: 1000ms
maxDelay: 5000ms
backoffMultiplier: 2

試行1: 失敗 → 1秒待機
試行2: 失敗 → 2秒待機
試行3: 失敗 → 4秒待機
試行4: エラー返却
```

### サーキットブレーカー

```
CLOSED状態（正常）
  ↓ 5回連続失敗
OPEN状態（遮断）
  ↓ 30秒経過
HALF_OPEN状態（試行）
  ↓ 成功
CLOSED状態（正常）
```

### タイムアウト

- デフォルト: 30秒
- 環境変数 `REQUEST_TIMEOUT` で設定可能

## キャッシュ戦略

### FSx ACL権限キャッシュ

- **TTL**: 5分
- **キャッシュキー**: userId
- **無効化**: TTL経過時に自動削除

## 監査ログ

全てのアクセス試行は `AuditLogs` テーブルに記録されます：

```json
{
  "userId": "user123",
  "timestamp": "2024-11-25T15:30:00Z",
  "action": "get-permissions",
  "result": "ALLOWED" | "DENIED",
  "reason": "営業時間外のアクセスです",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "restrictions": ["time-restriction", "geographic-restriction"]
}
```

## 環境変数

```bash
# FSx設定
FSX_MOUNT_POINT=/mnt/fsx
FSX_DNS_NAME=fs-xxxxx.fsx.ap-northeast-1.amazonaws.com
FSX_VOLUME_PATH=/vol1

# DynamoDB設定
PERMISSION_TABLE=TokyoRegion-permission-aware-rag-prod-PermissionConfig
AUDIT_TABLE=TokyoRegion-permission-aware-rag-prod-AuditLogs

# タイムアウト設定
REQUEST_TIMEOUT=30000

# AWS設定
AWS_REGION=ap-northeast-1
```

## テスト

### ユニットテスト

```bash
cd lambda/permissions
npm test
```

### 統合テスト

```bash
# テストユーザーで権限取得
curl -H "Authorization: Bearer <token>" \
  https://api.example.com/api/user/permissions

# リソース指定で権限チェック
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api/user/permissions?resource=/admin/secret.pdf"
```

## 今後の拡張

1. **グループベース権限**: ADグループとの統合
2. **動的権限更新**: リアルタイムでの権限変更反映
3. **詳細監査**: より詳細なアクセスログ記録
4. **権限委譲**: 一時的な権限付与機能
5. **MFA統合**: 多要素認証との連携
