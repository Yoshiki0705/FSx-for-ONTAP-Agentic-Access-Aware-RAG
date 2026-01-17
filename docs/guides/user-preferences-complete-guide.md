# ユーザー設定完全ガイド

**最終更新**: 2026年1月18日  
**バージョン**: 2.0  
**対象**: Permission-aware RAG System ユーザー設定システム

---

## 目次

1. [概要](#1-概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [API仕様](#3-api仕様)
4. [フロントエンド実装](#4-フロントエンド実装)
5. [データベース設計](#5-データベース設計)
6. [CDK実装](#6-cdk実装)
7. [デプロイメント](#7-デプロイメント)
8. [セキュリティ](#8-セキュリティ)
9. [パフォーマンス](#9-パフォーマンス)
10. [トラブルシューティング](#10-トラブルシューティング)

---

## 1. 概要

### 1.1 システム概要

ユーザー設定システム（v2.6.0）は、ユーザーの設定情報をDynamoDBに永続化し、クロスデバイス同期を実現するシステムです。

**主要機能**:
- **設定永続化**: DynamoDBへの自動保存
- **クロスデバイス同期**: 複数デバイス間での設定共有
- **リアルタイム反映**: 設定変更の即座UI反映
- **フォールバック**: オフライン時のデフォルト設定

### 1.2 AgentCore Memoryとの違い

| 項目 | User Preferences | AgentCore Memory |
|------|-----------------|------------------|
| **目的** | アプリケーション設定の永続化 | 会話履歴・コンテキストの保存 |
| **技術** | 独自DynamoDBテーブル | Amazon Bedrock Agent Runtime |
| **データ** | テーマ、リージョン、言語等 | AIとの対話履歴、会話コンテキスト |
| **API** | `/api/preferences` | Bedrock Agent Runtime API |
| **制約** | なし（任意の設定データ） | Bedrock Agentの仕様に依存 |
| **同期** | クロスデバイス同期可能 | Agent内でのみ利用 |
| **実装** | 独自実装 | AWS管理サービス |

**重要**: ユーザー設定データはAgentCore Memoryには保存できません。AgentCore MemoryはAmazon Bedrock Agent Runtimeの機能であり、会話履歴やコンテキストの保存に特化しているためです。

---

## 2. アーキテクチャ

### 2.1 システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    フロントエンド (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│ usePreferences Hook          │ usePreferencesSync Hook        │
│ - DynamoDB API呼び出し        │ - Zustand Store同期           │
│ - 設定の読み込み・更新         │ - テーマ・リージョン管理        │
├─────────────────────────────────────────────────────────────┤
│ PreferencesSyncProvider      │ Zustand Stores               │
│ - アプリケーション統合         │ - useThemeStore              │
│ - 認証状態連携               │ - useRegionStore             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    バックエンド (Lambda)                      │
├─────────────────────────────────────────────────────────────┤
│ /api/preferences             │ Lambda Function              │
│ - GET: 設定取得              │ - Next.js API Routes         │
│ - PUT: 設定作成              │ - 認証・認可                  │
│ - PATCH: 設定更新            │ - エラーハンドリング           │
│ - DELETE: 設定削除           │                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DynamoDB テーブル                         │
├─────────────────────────────────────────────────────────────┤
│ permission-aware-rag-preferences                            │
│ - Partition Key: userId                                     │
│ - Sort Key: settingKey                                      │
│ - 設定データ: JSON形式                                        │
│ - TTL: なし（永続保存）                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 データフロー

```
1. ユーザーログイン
   ↓
2. PreferencesSyncProvider起動
   ↓
3. usePreferences Hook → DynamoDB読み込み
   ↓
4. usePreferencesSync Hook → Zustand Store同期
   ↓
5. UI反映（テーマ、リージョン等）

設定変更時:
1. UI操作（テーマ切り替え等）
   ↓
2. useThemePreference.setThemeWithSync()
   ↓
3. Zustand Store更新（即座UI反映）
   ↓
4. DynamoDB保存（バックグラウンド）
```

---

## 3. API仕様

### 3.1 エンドポイント

**Base URL**: `/api/preferences`

### 3.2 GET /api/preferences

ユーザーの設定を取得します。

**Request**:
```http
GET /api/preferences
Authorization: Bearer <session-token>
```

**Response**:
```json
{
  "success": true,
  "preferences": {
    "theme": "dark",
    "defaultRegion": "ap-northeast-1",
    "language": "ja",
    "notifications": {
      "desktop": true,
      "sound": true,
      "volume": 0.8
    },
    "accessibility": {
      "reduceMotion": false,
      "showFocusIndicator": true
    }
  }
}
```

### 3.3 PUT /api/preferences

ユーザーの設定を作成または完全更新します。

**Request**:
```http
PUT /api/preferences
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "theme": "light",
  "defaultRegion": "us-east-1",
  "language": "en"
}
```

**Response**:
```json
{
  "success": true,
  "message": "設定を保存しました",
  "preferences": {
    "theme": "light",
    "defaultRegion": "us-east-1",
    "language": "en"
  }
}
```

### 3.4 PATCH /api/preferences

ユーザーの設定を部分更新します。

**Request**:
```http
PATCH /api/preferences
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "theme": "dark"
}
```

**Response**:
```json
{
  "success": true,
  "message": "設定を更新しました",
  "updatedFields": ["theme"]
}
```

### 3.5 DELETE /api/preferences

ユーザーの設定を削除します。

**Request**:
```http
DELETE /api/preferences
Authorization: Bearer <session-token>
```

**Response**:
```json
{
  "success": true,
  "message": "設定を削除しました"
}
```

### 3.6 エラーレスポンス

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "認証が必要です"
}
```

**エラーコード**:
- `UNAUTHORIZED`: 認証エラー
- `VALIDATION_ERROR`: バリデーションエラー
- `INTERNAL_ERROR`: サーバー内部エラー
- `NOT_FOUND`: 設定が見つからない

---

## 4. フロントエンド実装

### 4.1 usePreferences Hook

**実装場所**: `docker/nextjs/src/hooks/usePreferences.ts`

```typescript
import { usePreferences } from '@/hooks/usePreferences';

function SettingsComponent() {
  const {
    preferences,
    isLoading,
    error,
    updatePreference,
    updatePreferences,
    deletePreferences,
    refetch
  } = usePreferences();

  const handleThemeChange = async (theme: string) => {
    try {
      await updatePreference('theme', theme);
      console.log('テーマを更新しました:', theme);
    } catch (error) {
      console.error('テーマ更新エラー:', error);
    }
  };

  if (isLoading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error.message}</div>;

  return (
    <div>
      <select value={preferences.theme} onChange={(e) => handleThemeChange(e.target.value)}>
        <option value="light">ライト</option>
        <option value="dark">ダーク</option>
        <option value="system">システム</option>
      </select>
    </div>
  );
}
```

### 4.2 usePreferencesSync Hook

**実装場所**: `docker/nextjs/src/hooks/usePreferencesSync.ts`

```typescript
import { usePreferencesSync, useThemePreference } from '@/hooks/usePreferencesSync';

// アプリケーション全体の同期
function App() {
  usePreferencesSync(); // DynamoDB ↔ Zustand Store同期
  return <YourApp />;
}

// テーマ設定の個別管理
function ThemeToggle() {
  const { theme, setThemeWithSync } = useThemePreference();
  
  const handleToggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await setThemeWithSync(newTheme); // ローカル + DynamoDB保存
  };
  
  return <button onClick={handleToggle}>テーマ切り替え</button>;
}
```

### 4.3 PreferencesSyncProvider

**実装場所**: `docker/nextjs/src/components/providers/PreferencesSyncProvider.tsx`

```typescript
import { PreferencesSyncProvider } from '@/components/providers/PreferencesSyncProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthInitProvider>
          <PreferencesSyncProvider>
            {children}
          </PreferencesSyncProvider>
        </AuthInitProvider>
      </body>
    </html>
  );
}
```

### 4.4 Zustand Store統合

#### useThemeStore

```typescript
import { useThemeStore } from '@/store/useThemeStore';

const { theme, effectiveTheme, setTheme, toggleTheme } = useThemeStore();
```

#### useRegionStore

```typescript
import { useRegionStore } from '@/store/useRegionStore';

const { selectedRegion, setRegion } = useRegionStore();
```

---

## 5. データベース設計

### 5.1 DynamoDBテーブル

**テーブル名**: `permission-aware-rag-preferences` または `{environment}-user-preferences`

#### テーブル構造

```json
{
  "TableName": "permission-aware-rag-preferences",
  "KeySchema": [
    {
      "AttributeName": "userId",
      "KeyType": "HASH"
    },
    {
      "AttributeName": "settingKey",
      "KeyType": "RANGE"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "userId",
      "AttributeType": "S"
    },
    {
      "AttributeName": "settingKey",
      "AttributeType": "S"
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
```

#### データ形式

```json
{
  "userId": "user123",
  "settingKey": "theme",
  "settingValue": "dark",
  "updatedAt": "2026-01-18T10:00:00.000Z",
  "createdAt": "2026-01-18T10:00:00.000Z"
}
```

**複数設定の例**:
```json
[
  {
    "userId": "user123",
    "settingKey": "theme",
    "settingValue": "dark",
    "updatedAt": "2026-01-18T10:00:00.000Z"
  },
  {
    "userId": "user123",
    "settingKey": "defaultRegion",
    "settingValue": "ap-northeast-1",
    "updatedAt": "2026-01-18T10:00:00.000Z"
  },
  {
    "userId": "user123",
    "settingKey": "language",
    "settingValue": "ja",
    "updatedAt": "2026-01-18T10:00:00.000Z"
  }
]
```

### 5.2 インデックス

現在、セカンダリインデックスは使用していません。将来的に以下のインデックスを追加する可能性があります：

- **GSI1**: `theme-index` - テーマ別の統計取得用
- **GSI2**: `region-index` - リージョン別の統計取得用

---

## 6. CDK実装

### 6.1 DynamoDBテーブル定義

**ファイル**: `lib/modules/database/constructs/user-preferences-table-construct.ts`

**テーブル設計**:
```typescript
{
  tableName: `${environment}-user-preferences`,
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'settingKey', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: environment === 'prod',
  removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
}
```

**特徴**:
- 複合キー（userId + settingKey）による柔軟な設定管理
- PAY_PER_REQUEST課金モード（コスト最適化）
- AWS管理暗号化（セキュリティ）
- 本番環境でのポイントインタイムリカバリ（データ保護）
- 環境別削除ポリシー（本番: RETAIN、開発: DESTROY）

### 6.2 DataStack統合

**ファイル**: `lib/stacks/integrated/data-stack.ts`

**実装箇所**:

#### インポート
```typescript
import { UserPreferencesTableConstruct } from '../../modules/database/constructs/user-preferences-table-construct';
```

#### プロパティ定義
```typescript
/** ユーザー設定用DynamoDBテーブル */
public userPreferencesTable?: dynamodb.Table;
```

#### テーブル作成
```typescript
// ユーザー設定テーブル
const userPreferencesTable = new UserPreferencesTableConstruct(this, 'UserPreferencesTable', {
  tableName: `${this.environmentName}-user-preferences`,
  environment: this.environmentName,
});
this.dynamoDbTableNames['userPreferences'] = userPreferencesTable.table.tableName;
this.userPreferencesTable = userPreferencesTable.table;
```

#### CloudFormation Output
```typescript
new cdk.CfnOutput(this, 'UserPreferencesTableName', {
  value: userPreferencesTable.table.tableName,
  description: 'User Preferences Table Name',
  exportName: `${this.stackName}-UserPreferencesTableName`,
});
```

### 6.3 WebAppStack統合

**ファイル**: `lib/stacks/integrated/webapp-stack.ts`

**実装箇所**:

#### Lambda環境変数
```typescript
environment: {
  // ...
  PREFERENCES_TABLE_NAME: props.dataStack?.userPreferencesTable?.tableName || 'permission-aware-rag-preferences',
  // ...
}
```

#### アクセス権限付与
```typescript
// UserPreferencesテーブルへのアクセス権限付与
if (props.dataStack?.userPreferencesTable) {
  props.dataStack.userPreferencesTable.grantReadWriteData(this.webAppFunction);
  console.log('✅ UserPreferencesTableへのアクセス権限付与完了');
}
```

---

## 7. デプロイメント

### 7.1 CDKデプロイ（推奨）

```bash
# 1. DataStackをデプロイ（DynamoDBテーブル作成）
npx cdk deploy DataStack --region ap-northeast-1

# 2. WebAppStackをデプロイ（Lambda環境変数・IAM権限設定）
npx cdk deploy WebAppStack --region ap-northeast-1
```

### 7.2 手動デプロイ

#### Step 1: DynamoDBテーブル作成

```bash
aws dynamodb create-table \
  --table-name permission-aware-rag-preferences \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=settingKey,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=settingKey,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

#### Step 2: IAMポリシー更新

```json
{
  "Action": [
    "dynamodb:BatchGetItem",
    "dynamodb:BatchWriteItem",
    "dynamodb:DeleteItem",
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:Query",
    "dynamodb:Scan",
    "dynamodb:UpdateItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:ap-northeast-1:YOUR_ACCOUNT_ID:table/permission-aware-rag-preferences",
    "arn:aws:dynamodb:ap-northeast-1:YOUR_ACCOUNT_ID:table/permission-aware-rag-preferences/index/*"
  ],
  "Effect": "Allow"
}
```

#### Step 3: Lambda環境変数更新

```bash
aws lambda update-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --environment Variables="{
    PREFERENCES_TABLE_NAME=permission-aware-rag-preferences,
    ...
  }" \
  --region ap-northeast-1
```

#### Step 4: Lambda関数再起動

```bash
# Reserved Concurrency方式でコンテナキャッシュクリア
aws lambda put-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --reserved-concurrent-executions 0 \
  --region ap-northeast-1

sleep 10

aws lambda delete-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1

# ウォームアップ
for i in {1..30}; do
  aws lambda invoke \
    --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
    --payload '{"rawPath": "/health"}' \
    --region ap-northeast-1 \
    /tmp/response-${i}.json > /dev/null 2>&1
  sleep 1
done
```

### 7.3 デプロイ検証

#### 1. DynamoDBテーブル確認

```bash
aws dynamodb describe-table \
  --table-name permission-aware-rag-preferences \
  --region ap-northeast-1 \
  --query 'Table.[TableName,TableStatus]'
```

#### 2. Lambda環境変数確認

```bash
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query 'Environment.Variables.PREFERENCES_TABLE_NAME'
```

#### 3. API動作確認

```bash
# GET /api/preferences
curl -X GET https://YOUR_CLOUDFRONT_DOMAIN/api/preferences \
  -H "Cookie: session-token=YOUR_SESSION_TOKEN"

# PATCH /api/preferences
curl -X PATCH https://YOUR_CLOUDFRONT_DOMAIN/api/preferences \
  -H "Content-Type: application/json" \
  -H "Cookie: session-token=YOUR_SESSION_TOKEN" \
  -d '{"key": "theme", "value": "dark"}'
```

---

## 8. セキュリティ

### 8.1 認証・認可

#### セッション認証

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.userId) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: '認証が必要です' },
      { status: 401 }
    );
  }
  
  // 設定取得処理
}
```

#### ユーザー分離

- 各ユーザーは自分の設定のみアクセス可能
- `userId`をPartition Keyとして完全分離
- 他ユーザーの設定は取得・更新不可

### 8.2 データ保護

#### 入力検証

```typescript
const preferencesSchema = {
  theme: ['light', 'dark', 'system'],
  defaultRegion: /^[a-z]{2}-[a-z]+-\d+$/,
  language: ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de'],
  notifications: {
    desktop: 'boolean',
    sound: 'boolean',
    volume: 'number[0-1]'
  }
};
```

#### サニタイゼーション

```typescript
function sanitizePreferences(preferences: any): UserPreferences {
  return {
    theme: sanitizeEnum(preferences.theme, ['light', 'dark', 'system']),
    defaultRegion: sanitizeString(preferences.defaultRegion, /^[a-z0-9-]+$/),
    language: sanitizeEnum(preferences.language, SUPPORTED_LANGUAGES),
  };
}
```

---

## 9. パフォーマンス

### 9.1 最適化戦略

#### 1. ローカル状態の即座更新

```typescript
const updatePreference = async (key: string, value: any) => {
  // 1. ローカル状態を即座に更新（UI応答性向上）
  setPreferences(prev => ({ ...prev, [key]: value }));
  
  // 2. バックグラウンドでDynamoDBに保存
  try {
    await fetch('/api/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ [key]: value }),
    });
  } catch (error) {
    // エラー時はローカル状態を元に戻す
    setPreferences(prev => ({ ...prev, [key]: originalValue }));
    toast.error('設定の保存に失敗しました');
  }
};
```

#### 2. 設定変更のデバウンス

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const debouncedUpdatePreference = useDebounce(updatePreference, 500);

// 連続した変更をまとめて保存
const handleVolumeChange = (volume: number) => {
  debouncedUpdatePreference('notifications.volume', volume);
};
```

#### 3. キャッシュ戦略

```typescript
// React Query / SWRを使用したキャッシュ
const { data: preferences, mutate } = useSWR('/api/preferences', fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000, // 1分間は重複リクエストを防ぐ
});
```

### 9.2 パフォーマンス指標

#### 目標値

- **設定読み込み**: < 200ms
- **設定更新**: < 100ms（ローカル）、< 500ms（DynamoDB）
- **UI反映**: < 50ms
- **同期遅延**: < 1秒

---

## 10. トラブルシューティング

### 10.1 よくある問題

#### 問題1: 設定が保存されない

**症状**: 設定変更後、ページリロードで元に戻る

**原因と解決策**:

```typescript
// 原因1: 認証エラー
const session = await getServerSession();
if (!session?.userId) {
  console.error('認証されていません');
  // 解決策: サインイン状態を確認
}

// 原因2: ネットワークエラー
try {
  await fetch('/api/preferences', { method: 'PATCH', ... });
} catch (error) {
  console.error('ネットワークエラー:', error);
  // 解決策: オフライン対応、リトライ機能
}
```

#### 問題2: 設定が同期されない

**症状**: デバイス間で設定が異なる

**デバッグ手順**:

```typescript
// 1. ユーザーIDの確認
console.log('Current userId:', session?.userId);

// 2. DynamoDB内容の確認
const response = await fetch('/api/preferences');
const data = await response.json();
console.log('DynamoDB preferences:', data.preferences);

// 3. ローカル状態の確認
console.log('Local theme store:', useThemeStore.getState());
```

#### 問題3: AccessDeniedException

**症状**:
```
User is not authorized to perform: dynamodb:Query
```

**原因**: Lambda実行ロールがPreferencesテーブルへのアクセス権限を持っていない

**解決策**: IAMポリシー更新を実行

#### 問題4: ValidationException

**症状**:
```
ValidationException: ExpressionAttributeValues must not be empty
```

**原因**: DynamoDBテーブルが存在しない、またはテーブル名が間違っている

**解決策**: テーブル名を確認し、必要に応じてテーブルを作成

### 10.2 緊急時対応

#### 設定リセット

```typescript
// 管理者用: 特定ユーザーの設定をリセット
async function resetUserPreferences(userId: string) {
  const response = await fetch(`/api/preferences?userId=${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer <admin-token>' }
  });
}
```

#### デフォルト設定の復元

```typescript
const resetToDefaults = async () => {
  const defaultPreferences = {
    theme: 'system',
    defaultRegion: 'ap-northeast-1',
    language: 'ja',
    notifications: {
      desktop: true,
      sound: true,
      volume: 0.5,
    },
  };
  
  await updatePreferences(defaultPreferences);
};
```

---

## 11. ベストプラクティス

### 11.1 環境別設定

```typescript
// 本番環境
{
  pointInTimeRecovery: true,
  removalPolicy: RemovalPolicy.RETAIN,
  encryption: TableEncryption.CUSTOMER_MANAGED,
}

// 開発環境
{
  pointInTimeRecovery: false,
  removalPolicy: RemovalPolicy.DESTROY,
  encryption: TableEncryption.AWS_MANAGED,
}
```

### 11.2 コスト最適化

```typescript
// PAY_PER_REQUEST課金モード（推奨）
billingMode: BillingMode.PAY_PER_REQUEST,
```

### 11.3 セキュリティ

```typescript
// KMS暗号化（本番環境推奨）
encryption: TableEncryption.CUSTOMER_MANAGED,
encryptionKey: kmsKey,
```

---

## 12. 関連ドキュメント

- [フロントエンド完全ガイド](./frontend-complete-guide.md)
- [デプロイメント完全ガイド](./deployment-complete-guide.md)
- [運用・設定ガイド](./operations-configuration-guide.md)

---

## 13. 更新履歴

### v2.6.0 (2026-01-07)
- 初版リリース
- DynamoDB永続化機能
- クロスデバイス同期機能
- テーマ・リージョン設定対応

### v2.0 (2026-01-18)
- ドキュメント統合（3ファイル → 1ファイル）
- CDK実装セクション追加
- デプロイメントセクション拡充
- トラブルシューティング強化

---

**最終更新**: 2026年1月18日  
**バージョン**: 2.0  
**ライセンス**: プロジェクトライセンスに準拠
