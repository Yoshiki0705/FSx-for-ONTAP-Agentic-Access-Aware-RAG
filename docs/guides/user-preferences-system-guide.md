# ユーザー設定システムガイド

**最終更新**: 2026年1月7日  
**対象**: 開発者・システム管理者

## 📋 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [API仕様](#api仕様)
4. [フロントエンド実装](#フロントエンド実装)
5. [データベース設計](#データベース設計)
6. [セキュリティ](#セキュリティ)
7. [パフォーマンス](#パフォーマンス)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

ユーザー設定システム（v2.6.0）は、ユーザーの設定情報をDynamoDBに永続化し、クロスデバイス同期を実現するシステムです。

### 主要機能

- **設定永続化**: DynamoDBへの自動保存
- **クロスデバイス同期**: 複数デバイス間での設定共有
- **リアルタイム反映**: 設定変更の即座UI反映
- **フォールバック**: オフライン時のデフォルト設定

### AgentCore Memoryとの違い

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

## アーキテクチャ

### システム構成

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
│ - 設定データ: JSON形式                                        │
│ - TTL: なし（永続保存）                                       │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

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

## API仕様

### エンドポイント

**Base URL**: `/api/preferences`

### GET /api/preferences

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

### PUT /api/preferences

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

### PATCH /api/preferences

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

### DELETE /api/preferences

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

### エラーレスポンス

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

## フロントエンド実装

### usePreferences Hook

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

### usePreferencesSync Hook

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

### PreferencesSyncProvider

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

### Zustand Store統合

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

## データベース設計

### DynamoDBテーブル

**テーブル名**: `permission-aware-rag-preferences`

#### テーブル構造

```json
{
  "TableName": "permission-aware-rag-preferences",
  "KeySchema": [
    {
      "AttributeName": "userId",
      "KeyType": "HASH"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "userId",
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
  },
  "createdAt": "2026-01-07T10:00:00.000Z",
  "updatedAt": "2026-01-07T15:30:00.000Z"
}
```

#### インデックス

現在、セカンダリインデックスは使用していません。将来的に以下のインデックスを追加する可能性があります：

- **GSI1**: `theme-index` - テーマ別の統計取得用
- **GSI2**: `region-index` - リージョン別の統計取得用

---

## セキュリティ

### 認証・認可

#### セッション認証

```typescript
// API Routes内での認証チェック
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

### データ保護

#### 入力検証

```typescript
// バリデーションスキーマ
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
// 危険な文字列の除去
function sanitizePreferences(preferences: any): UserPreferences {
  return {
    theme: sanitizeEnum(preferences.theme, ['light', 'dark', 'system']),
    defaultRegion: sanitizeString(preferences.defaultRegion, /^[a-z0-9-]+$/),
    language: sanitizeEnum(preferences.language, SUPPORTED_LANGUAGES),
    // ...
  };
}
```

### IAMポリシー

Lambda実行ロールに必要な権限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/permission-aware-rag-preferences"
    }
  ]
}
```

---

## パフォーマンス

### 最適化戦略

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

### パフォーマンス指標

#### 目標値

- **設定読み込み**: < 200ms
- **設定更新**: < 100ms（ローカル）、< 500ms（DynamoDB）
- **UI反映**: < 50ms
- **同期遅延**: < 1秒

#### 監視方法

```typescript
// パフォーマンス測定
const startTime = performance.now();
await updatePreference('theme', 'dark');
const endTime = performance.now();
console.log(`設定更新時間: ${endTime - startTime}ms`);
```

---

## トラブルシューティング

### よくある問題

#### 1. 設定が保存されない

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

// 原因3: バリデーションエラー
const isValid = validatePreferences(preferences);
if (!isValid) {
  console.error('無効な設定値');
  // 解決策: 入力値の検証
}
```

#### 2. 設定が同期されない

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
console.log('Local region store:', useRegionStore.getState());
```

#### 3. パフォーマンス問題

**症状**: 設定変更が遅い、UIが固まる

**解決策**:

```typescript
// 1. 非同期処理の最適化
const updatePreferenceOptimized = useCallback(async (key, value) => {
  // ローカル状態を即座に更新
  setPreferences(prev => ({ ...prev, [key]: value }));
  
  // バックグラウンドで保存
  setTimeout(async () => {
    try {
      await fetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      // エラー処理
    }
  }, 0);
}, []);

// 2. デバウンス処理
const debouncedUpdate = useDebounce(updatePreferenceOptimized, 300);
```

### ログ分析

#### フロントエンドログ

```typescript
// usePreferences.ts
console.log('🔄 [usePreferences] 設定読み込み開始');
console.log('✅ [usePreferences] 設定読み込み完了:', preferences);
console.log('❌ [usePreferences] 設定読み込みエラー:', error);
```

#### バックエンドログ

```typescript
// /api/preferences/route.ts
console.log('📥 [API] 設定取得リクエスト:', { userId });
console.log('📤 [API] 設定取得レスポンス:', { success: true });
console.log('⚠️ [API] 設定取得エラー:', { error: error.message });
```

#### DynamoDBログ

```typescript
// CloudWatch Logsで確認
// ログストリーム: /aws/lambda/TokyoRegion-permission-aware-rag-prod-WebApp-Function
```

### 緊急時対応

#### 設定リセット

```typescript
// 管理者用: 特定ユーザーの設定をリセット
async function resetUserPreferences(userId: string) {
  const response = await fetch(`/api/preferences?userId=${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer <admin-token>' }
  });
  
  if (response.ok) {
    console.log('設定をリセットしました:', userId);
  }
}
```

#### デフォルト設定の復元

```typescript
// フロントエンド: デフォルト設定に戻す
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

## 関連ドキュメント

### 開発者向け
- **[フロントエンド開発ガイド](./frontend-development-guide.md)** - フロントエンド実装パターン
- **[API仕様書](../../docker/nextjs/src/app/api/preferences/route.ts)** - 詳細なAPI実装
- **[型定義](../../docker/nextjs/src/types/preferences.ts)** - TypeScript型定義

### ユーザー向け
- **[UI/UXガイド](./ui-ux-guide.md)** - ユーザーインターフェースの使い方
- **[FAQ](./faq.md)** - よくある質問と回答

### 運用・保守
- **[デプロイメントガイド](./deployment-guide.md)** - デプロイ手順
- **[監視・運用ガイド](./operations-maintenance-guide-ja.md)** - 運用管理の詳細

---

## 更新履歴

### v2.6.0 (2026-01-07)
- 初版リリース
- DynamoDB永続化機能
- クロスデバイス同期機能
- テーマ・リージョン設定対応

### 今後の予定

#### v2.7.0 (予定)
- 通知設定の詳細化
- アクセシビリティ設定の拡張
- 設定のエクスポート/インポート機能

#### v2.8.0 (予定)
- 設定の履歴管理
- 設定の共有機能
- 管理者向け設定管理UI

---

**最終更新**: 2026年1月7日  
**メンテナンス**: このガイドは新機能追加時に更新してください