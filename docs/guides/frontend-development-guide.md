# フロントエンド開発ガイド

**最終更新**: 2024年11月18日  
**対象**: Next.js フロントエンド開発者

## 📋 目次

1. [プロジェクト構造](#プロジェクト構造)
2. [アクセシビリティ実装](#アクセシビリティ実装)
3. [エラーハンドリング](#エラーハンドリング)
4. [チャットUI/UX](#チャットuiux)
5. [カスタムフック](#カスタムフック)
6. [型定義](#型定義)
7. [ベストプラクティス](#ベストプラクティス)

---

## プロジェクト構造

```
docker/nextjs/src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # サインインページ
│   └── genai/
│       └── page.tsx              # チャットボットページ
├── components/                   # Reactコンポーネント
│   ├── accessibility/            # アクセシビリティ専用
│   │   ├── SkipToContent.tsx    # スキップリンク
│   │   ├── ScreenReaderOnly.tsx # スクリーンリーダー専用
│   │   └── ShortcutHelp.tsx     # ショートカット一覧
│   ├── bedrock/                  # Bedrock関連
│   │   ├── ModelSelector.tsx    # モデル選択
│   │   └── RegionSelector.tsx   # リージョン選択
│   ├── chat/                     # チャット機能
│   │   ├── MessageList.tsx      # メッセージリスト
│   │   ├── MessageActions.tsx   # メッセージアクション
│   │   ├── MessageInput.tsx     # メッセージ入力
│   │   └── CodeBlock.tsx        # コードブロック
│   ├── error/                    # エラー処理
│   │   ├── ErrorBoundary.tsx    # エラーバウンダリ
│   │   └── OfflineBanner.tsx    # オフライン通知
│   └── ui/                       # 共通UI
│       ├── ThemeToggle.tsx      # テーマ切り替え
│       └── Toast.tsx            # トースト通知
├── hooks/                        # カスタムフック
│   ├── useKeyboardShortcuts.ts  # キーボードショートカット
│   ├── useFocusTrap.ts          # フォーカストラップ
│   ├── useOnlineStatus.ts       # オンライン状態監視
│   └── useChatHistory.ts        # チャット履歴管理
├── lib/                          # ユーティリティ
│   ├── error-handler.ts         # エラーハンドラー
│   ├── bedrock-client.ts        # Bedrockクライアント
│   └── bedrock-response-parser.ts # レスポンスパーサー
├── store/                        # 状態管理（Zustand）
│   ├── useChatStore.ts          # チャット状態
│   └── useThemeStore.ts         # テーマ状態
└── types/                        # TypeScript型定義
    └── chat.ts                   # チャット型定義
```

---

## アクセシビリティ実装

### 1. キーボードショートカット

**実装場所**: `hooks/useKeyboardShortcuts.ts`

```typescript
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

const shortcuts: KeyboardShortcut[] = [
  {
    key: 'k',
    ctrl: true,
    description: 'モデル選択を開く',
    action: () => setModelSelectorOpen(true)
  },
  {
    key: 'n',
    ctrl: true,
    description: '新しいチャット',
    action: createNewChat
  },
  {
    key: 's',
    ctrl: true,
    description: 'サイドバー切り替え',
    action: () => setSidebarOpen(prev => !prev)
  }
];

useKeyboardShortcuts(shortcuts, isEnabled);
```

**標準ショートカット**:
- `Ctrl + K`: モデル選択
- `Ctrl + N`: 新しいチャット
- `Ctrl + S`: サイドバー切り替え
- `Ctrl + /`: ショートカット一覧
- `Escape`: モーダルを閉じる

### 2. フォーカス管理

**実装場所**: `hooks/useFocusTrap.ts`

```typescript
import { useFocusTrap } from '@/hooks/useFocusTrap';

function Modal({ isOpen, onClose, children }) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

**機能**:
- モーダル内でのフォーカストラップ
- Tab/Shift+Tabでの循環ナビゲーション
- 自動フォーカス復元

### 3. スキップリンク

**実装場所**: `components/accessibility/SkipToContent.tsx`

```typescript
import { SkipToContent } from '@/components/accessibility/SkipToContent';

export default function Page() {
  return (
    <>
      <SkipToContent targetId="main-content" />
      <main id="main-content">
        {/* メインコンテンツ */}
      </main>
    </>
  );
}
```

### 4. スクリーンリーダー専用テキスト

**実装場所**: `components/accessibility/ScreenReaderOnly.tsx`

```typescript
import { ScreenReaderOnly } from '@/components/accessibility/ScreenReaderOnly';

<button onClick={handleClick}>
  <Icon />
  <ScreenReaderOnly>メッセージを送信</ScreenReaderOnly>
</button>
```

### 5. ARIA属性のベストプラクティス

```typescript
// ボタン
<button
  aria-label="メッセージを編集"
  aria-describedby="edit-help"
>
  <EditIcon />
</button>

// 入力フィールド
<input
  aria-label="メッセージを入力"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "error-message" : undefined}
/>

// ライブリージョン
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// モーダル
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">タイトル</h2>
  <p id="modal-description">説明</p>
</div>
```

---

## エラーハンドリング

### 1. ErrorBoundary

**実装場所**: `components/error/ErrorBoundary.tsx`

```typescript
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

**機能**:
- Reactエラーのキャッチ
- フォールバックUIの表示
- エラーログの記録
- リトライ機能

### 2. エラー分類システム

**実装場所**: `lib/error-handler.ts`

```typescript
import { classifyError, handleError } from '@/lib/error-handler';

try {
  await apiCall();
} catch (error) {
  const classified = classifyError(error);
  const result = await handleError(classified);
  
  if (result.shouldRetry) {
    // リトライ処理
  }
}
```

**エラータイプ**:
1. `NETWORK_ERROR`: ネットワークエラー
2. `API_ERROR`: APIエラー
3. `VALIDATION_ERROR`: バリデーションエラー
4. `AUTHENTICATION_ERROR`: 認証エラー
5. `AUTHORIZATION_ERROR`: 認可エラー
6. `RATE_LIMIT_ERROR`: レート制限エラー
7. `TIMEOUT_ERROR`: タイムアウトエラー
8. `UNKNOWN_ERROR`: 不明なエラー

### 3. 自動リトライ

```typescript
import { retryWithBackoff } from '@/lib/error-handler';

const result = await retryWithBackoff(
  async () => await apiCall(),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  }
);
```

**リトライ戦略**:
- 指数バックオフ（1秒 → 2秒 → 4秒）
- 最大3回リトライ
- リトライ可能エラーのみ対象

### 4. オフライン検出

**実装場所**: `hooks/useOnlineStatus.ts`

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function Component() {
  const isOnline = useOnlineStatus();
  
  return (
    <div>
      {!isOnline && <OfflineBanner />}
      {/* コンテンツ */}
    </div>
  );
}
```

---

## チャットUI/UX

### 1. メッセージリスト

**実装場所**: `components/chat/MessageList.tsx`

```typescript
import { MessageList } from '@/components/chat/MessageList';

<MessageList
  messages={messages}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onCopy={handleCopy}
/>
```

**機能**:
- コードブロック自動検出
- インラインコード自動検出
- タイムスタンプ表示
- メッセージアクション統合

**コードブロック対応**:
```markdown
# コードブロック
```javascript
const hello = 'world';
```

# インラインコード
これは`インラインコード`です
```

### 2. メッセージアクション

**実装場所**: `components/chat/MessageActions.tsx`

```typescript
import { MessageActions } from '@/components/chat/MessageActions';

<MessageActions
  messageId={message.id}
  content={message.content}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onCopy={handleCopy}
/>
```

**機能**:
- 編集ボタン（鉛筆アイコン）
- 削除ボタン（ゴミ箱アイコン）
- コピーボタン（クリップボードアイコン）
- ホバー時のみ表示

### 3. コードブロック

**実装場所**: `components/chat/CodeBlock.tsx`

```typescript
import { CodeBlock, InlineCode } from '@/components/chat/CodeBlock';

// コードブロック
<CodeBlock code={code} language="javascript" />

// インラインコード
<InlineCode>const x = 1;</InlineCode>
```

**機能**:
- シンタックスハイライト
- コピー機能
- 言語表示
- ダークテーマ対応

### 4. メッセージ入力

**実装場所**: `components/chat/MessageInput.tsx`

```typescript
import { MessageInput } from '@/components/chat/MessageInput';

<MessageInput
  onSend={handleSend}
  placeholder="メッセージを入力..."
  disabled={isLoading}
/>
```

**機能**:
- 自動リサイズ（1-10行）
- Enter: 送信
- Shift+Enter: 改行
- ローディング状態表示

### 5. チャット履歴管理

**実装場所**: `hooks/useChatHistory.ts`

```typescript
import { useChatHistory } from '@/hooks/useChatHistory';

const {
  historySessions,
  currentHistorySession,
  switchHistorySession,
  deleteHistorySession,
  clearAllHistory,
  isLoading,
  error
} = useChatHistory();

// セッション切り替え
switchHistorySession('session-id');

// セッション削除
await deleteHistorySession('session-id');

// 全履歴削除
await clearAllHistory();
```

**機能**:
- API連携（GET/DELETE /api/chat/history）
- セッション一覧取得
- セッション切り替え
- セッション削除（個別・全削除）
- エラーハンドリング
- ローディング状態管理

**重要な実装パターン（Task 3.1.5）**:

#### React Hooksのクロージャ問題対策

```typescript
// ❌ 悪い例: クロージャ問題
const handleDelete = (sessionId: string) => {
  // historySessions は古い値を参照する可能性
  const updated = historySessions.filter(s => s.id !== sessionId);
  setHistorySessions(updated);
};

// ✅ 良い例: 関数形式のsetStateを使用
const handleDelete = (sessionId: string) => {
  setHistorySessions(prev => prev.filter(s => s.id !== sessionId));
};
```

#### 削除確認ダイアログ（多言語対応）

```typescript
const handleDelete = async (sessionId: string) => {
  const message = locale === 'ja' 
    ? 'このチャット履歴を削除しますか？'
    : 'Are you sure you want to delete this chat history?';
  
  if (confirm(message)) {
    await deleteHistorySession(sessionId);
  }
};
```

#### UIへの統合例（KBモードサイドバー）

```typescript
<div className="space-y-1">
  {historySessions.map((session) => (
    <div key={session.id} className="group relative">
      <button
        onClick={() => switchHistorySession(session.id)}
        className={`w-full text-left px-3 py-2 rounded-lg ${
          currentHistorySession?.id === session.id
            ? 'bg-blue-50 dark:bg-blue-900/30'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`}
      >
        <div className="text-sm font-medium truncate">
          {session.title || 'Untitled Chat'}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(session.createdAt).toLocaleDateString(
            memoizedLocale === 'ja' ? 'ja-JP' : 'en-US'
          )}
        </div>
      </button>
      
      {/* 削除ボタン */}
      <button
        onClick={() => handleDeleteSession(session.id)}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
        title={t('delete')}
      >
        ❌
      </button>
    </div>
  ))}
</div>

{/* 全履歴削除ボタン */}
<button
  onClick={handleClearAllHistory}
  className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400"
>
  🗑️ {t('clearAllHistory')}
</button>
```

---

## カスタムフック

### 1. useKeyboardShortcuts

**用途**: キーボードショートカットの実装

```typescript
const shortcuts: KeyboardShortcut[] = [
  {
    key: 'k',
    ctrl: true,
    shift: false,
    alt: false,
    description: 'モデル選択',
    action: () => console.log('Ctrl+K pressed')
  }
];

useKeyboardShortcuts(shortcuts, isEnabled);
```

### 2. useFocusTrap

**用途**: モーダル内でのフォーカストラップ

```typescript
const modalRef = useFocusTrap<HTMLDivElement>(isOpen);

<div ref={modalRef}>
  {/* モーダルコンテンツ */}
</div>
```

### 3. useOnlineStatus

**用途**: オンライン/オフライン状態の監視

```typescript
const isOnline = useOnlineStatus();

{!isOnline && <OfflineBanner />}
```

### 4. useChatHistory

**用途**: チャット履歴の管理

```typescript
const {
  messages,
  addMessage,
  editMessage,
  deleteMessage
} = useChatHistory();
```

---

## 型定義

### チャット関連型

**実装場所**: `types/chat.ts`

```typescript
// メッセージ型
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: {
    model?: string;
    region?: string;
    tokens?: number;
  };
}

// セッション型
interface ChatSession {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}

// 設定型
interface ChatSettings {
  model: string;
  region: string;
  temperature?: number;
  maxTokens?: number;
}

// エラー型
interface ChatError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}
```

---

## ベストプラクティス

### 1. アクセシビリティ

✅ **必須事項**:
- すべてのインタラクティブ要素に`aria-label`
- キーボード操作対応（Tab, Enter, Escape）
- フォーカスインジケーターの表示
- スクリーンリーダー対応

❌ **禁止事項**:
- `div`や`span`をボタンとして使用
- `aria-label`なしのアイコンボタン
- キーボードでアクセスできない要素

### 2. エラーハンドリング

✅ **必須事項**:
- すべての非同期処理にtry-catch
- エラー分類とログ記録
- ユーザーフレンドリーなエラーメッセージ
- リトライ可能なエラーの自動リトライ

❌ **禁止事項**:
- エラーの無視
- 技術的なエラーメッセージの直接表示
- エラーログの欠如

### 3. パフォーマンス

✅ **推奨事項**:
- `useCallback`でイベントハンドラーをメモ化
- `useMemo`で重い計算をメモ化
- 仮想スクロールで大量データを表示
- 画像の遅延読み込み

❌ **避けるべき**:
- 不要な再レンダリング
- 大量のデータの一括レンダリング
- 最適化されていない画像

### 4. コード品質

✅ **必須事項**:
- TypeScript型定義の使用
- コンポーネントの単一責任原則
- 適切なコメント（日本語）
- 一貫した命名規則

❌ **禁止事項**:
- `any`型の使用
- 巨大なコンポーネント（500行超）
- ハードコードされた値
- 重複コード

### 5. セキュリティ

✅ **必須事項**:
- XSS対策（入力のサニタイズ）
- CSRF対策
- 機密情報のlocalStorage保存禁止
- HTTPS通信

❌ **禁止事項**:
- `dangerouslySetInnerHTML`の無制限使用
- パスワードのlocalStorage保存
- HTTP通信

---

## テスト

### 単体テスト

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageInput } from '@/components/chat/MessageInput';

describe('MessageInput', () => {
  it('Enterキーで送信される', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'テスト' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onSend).toHaveBeenCalledWith('テスト');
  });
});
```

### アクセシビリティテスト

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('アクセシビリティ違反がない', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## デバッグ

### React DevTools

```typescript
// コンポーネント名の表示
Component.displayName = 'MyComponent';

// デバッグ用のログ
if (process.env.NODE_ENV === 'development') {
  console.log('[MyComponent] State:', state);
}
```

### エラーログ

```typescript
import { logError } from '@/lib/error-handler';

try {
  await apiCall();
} catch (error) {
  logError(error, {
    component: 'MyComponent',
    action: 'apiCall',
    userId: user.id
  });
}
```

---

## リソース

### 公式ドキュメント
- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### アクセシビリティ
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### ツール
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

---

**最終更新**: 2024年11月18日  
**メンテナンス**: このガイドは新機能追加時に更新してください


## 10. サイドバーとナビゲーション改善（Phase 10）

Phase 10では、サイドバーの機能性とユーザビリティを大幅に向上させました。

### 10.1 実装内容

#### サイドバー状態管理
- useSidebarStoreの作成（Zustand）
- localStorage永続化
- 開閉状態の復元
- 検索クエリの保存

#### アニメーション
- AnimatedSidebarコンポーネント
- Framer Motionによるスライドアニメーション
- 300msのスムーズな遷移
- イージング設定（easeInOut）

#### チャット履歴検索
- ChatHistorySearchコンポーネント
- リアルタイム検索（デバウンス300ms）
- クリアボタン
- 検索結果のハイライト

#### 仮想スクロール
- VirtualChatHistoryコンポーネント
- @tanstack/react-virtualの活用
- 大量データの効率的表示
- 推定高さ80px、オーバースキャン5アイテム

#### チャット履歴アイテム
- ChatHistoryItemコンポーネント
- アクティブセッションのハイライト
- ホバー時の削除ボタン表示
- date-fnsによる相対時間表示

#### アコーディオンセクション
- SidebarSectionsコンポーネント
- Radix UI Accordionの活用
- 「最近」「今週」「過去」のセクション分け
- セクション別アイテム数表示

#### 設定パネル分離
- SettingsPanelコンポーネント
- モーダルダイアログ形式
- タブ形式のUI（一般、外観、通知、高度な設定）
- Radix UI Dialogの活用

### 10.2 実装ファイル

```
docker/nextjs/src/
├── components/
│   ├── sidebar/
│   │   ├── AnimatedSidebar.tsx      # アニメーション付きサイドバー
│   │   ├── ChatHistorySearch.tsx    # 検索機能
│   │   ├── VirtualChatHistory.tsx   # 仮想スクロール
│   │   ├── ChatHistoryItem.tsx      # 履歴アイテム
│   │   ├── SidebarSections.tsx      # アコーディオン
│   │   └── Sidebar.tsx              # メインサイドバー
│   └── settings/
│       └── SettingsPanel.tsx        # 設定パネル
└── store/
    └── useSidebarStore.ts           # サイドバー状態管理
```

### 10.3 使用方法

#### サイドバーの統合

```typescript
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useSidebarStore } from '@/store/useSidebarStore';

export default function ChatbotPage() {
  const { isOpen, toggle } = useSidebarStore();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1">
        {/* メインコンテンツ */}
      </main>
    </div>
  );
}
```

#### 設定パネルの使用

```typescript
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { Settings } from 'lucide-react';

export default function Header() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <button onClick={() => setShowSettings(true)}>
        <Settings className="w-5 h-5" />
      </button>
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  );
}
```

### 10.4 キーボードショートカット

- `Ctrl+B`: サイドバーの開閉
- `Ctrl+F`: チャット履歴検索にフォーカス
- `Ctrl+,`: 設定パネルを開く
- `Esc`: モーダル・パネルを閉じる

### 10.5 パフォーマンス最適化

#### 仮想スクロール
大量のチャット履歴（1000件以上）でもスムーズにスクロールできるよう、@tanstack/react-virtualを使用しています。

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: filteredSessions.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
  overscan: 5,
});
```

#### デバウンス検索
検索入力時の不要な再レンダリングを防ぐため、300msのデバウンスを適用しています。

```typescript
const debouncedSearch = useDebounce(searchQuery, 300);
```

### 10.6 アクセシビリティ

- キーボードナビゲーション対応
- ARIA属性の適切な設定
- フォーカス管理
- スクリーンリーダー対応



## 11. モデル選択UI改善（Phase 11）

Phase 11では、モデル選択UIを大幅に改善し、カード形式の視覚的なインターフェースを実装しました。

### 11.1 実装内容

#### ModelCard コンポーネント
- プロバイダー別カラーテーマ
- 利用可能状態の表示（✅/❌/🔒）
- 性能指標の表示（トークン、レイテンシ、コスト）
- ホバー時のスケールアップアニメーション
- Radix UI Tooltipによる詳細情報

#### ModelFilter コンポーネント
- プロバイダーフィルター（6プロバイダー）
- モダリティフィルター（4種類）
- 利用可能性フィルター（3オプション）
- フィルタークリア機能
- アクティブフィルター数表示

#### ModelGrid コンポーネント
- レスポンシブグリッドレイアウト（デスクトップ3列、タブレット2列、モバイル1列）
- プロバイダー別グループ化
- フィルタリング機能統合
- 結果サマリー表示

#### ModelConfirmDialog コンポーネント
- Radix UI Dialogの活用
- モデル情報の表示
- 確認/キャンセルボタン
- アニメーション（フェード・ズーム）

#### ModelSelectionModal コンポーネント
- フルスクリーンモーダル（95vw × 90vh）
- フィルターサイドバー統合
- モデルグリッド表示
- 確認ダイアログ統合

#### useModelStore（状態管理）
- Zustandによる状態管理
- localStorage永続化
- フィルター状態の保存
- モデル選択フロー管理

### 11.2 実装ファイル

```
docker/nextjs/src/
├── components/
│   └── model/
│       ├── ModelCard.tsx              # モデルカード
│       ├── ModelFilter.tsx            # フィルター
│       ├── ModelGrid.tsx              # グリッド表示
│       ├── ModelConfirmDialog.tsx     # 確認ダイアログ
│       ├── ModelSelectionModal.tsx    # モーダル統合
│       └── index.ts                   # エクスポート
└── store/
    └── useModelStore.ts               # 状態管理
```

### 11.3 genai/page.tsx への統合

#### ヘッダーにモデル選択ボタン追加

```typescript
<button
  onClick={() => setShowModelSelectionModal(true)}
  className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
  title="モデルを選択"
>
  <Sparkles className="w-4 h-4" />
  {selectedModelName}
</button>
```

#### ModelSelectionModal の使用

```typescript
import { ModelSelectionModal } from '@/components/model/ModelSelectionModal';

const [showModelSelectionModal, setShowModelSelectionModal] = useState(false);
const [availableModels, setAvailableModels] = useState<string[]>([]);

// 利用可能なモデルを取得
useEffect(() => {
  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('/api/bedrock/region-info');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const available = data.data.availableModels || [];
          setAvailableModels(available.map((m: any) => m.modelId));
        }
      }
    } catch (error) {
      console.error('Failed to fetch available models:', error);
    }
  };

  if (isClient && user) {
    fetchAvailableModels();
  }
}, [isClient, user]);

// モーダルのレンダリング
<ModelSelectionModal
  isOpen={showModelSelectionModal}
  onClose={() => setShowModelSelectionModal(false)}
  currentModelId={selectedModelId}
  availableModels={availableModels}
  onModelChange={(modelId) => {
    setSelectedModelId(modelId);
    const model = getModelById(modelId);
    if (model) {
      setSelectedModelName(model.name);
      showToast({
        message: `モデルを${model.name}に変更しました`,
        type: 'success',
        duration: 3000,
      });
    }
  }}
/>
```

### 11.4 デザインシステム

#### プロバイダー別カラー

```typescript
const providerColors = {
  Amazon: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200',
  Anthropic: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200',
  Meta: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200',
  Cohere: 'bg-green-50 dark:bg-green-900/20 border-green-200',
  'Mistral AI': 'bg-red-50 dark:bg-red-900/20 border-red-200',
  'AI21 Labs': 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200',
};
```

#### アニメーション

```typescript
const animations = {
  cardHover: 'hover:scale-105 hover:shadow-lg',
  dialogFade: 'animate-in fade-in-0 zoom-in-95',
  transition: 'transition-all duration-200',
};
```

### 11.5 キーボードショートカット

- `Ctrl+K`: モデル選択モーダルを開く
- `Tab`: 次のモデルカードに移動
- `Shift+Tab`: 前のモデルカードに移動
- `Enter/Space`: モデルを選択
- `Esc`: モーダルを閉じる

### 11.6 パフォーマンス最適化

#### メモ化

```typescript
const filteredModels = useMemo(() => {
  return models.filter(model => {
    // フィルター条件
  });
}, [models, providerFilter, modalityFilter, availabilityFilter]);
```

#### グループ化

```typescript
const groupedModels = useMemo(() => {
  const groups: Record<string, BedrockModel[]> = {};
  filteredModels.forEach(model => {
    if (!groups[model.provider]) {
      groups[model.provider] = [];
    }
    groups[model.provider].push(model);
  });
  return groups;
}, [filteredModels]);
```

### 11.7 アクセシビリティ

#### ARIA属性

```typescript
<div
  role="button"
  tabIndex={0}
  aria-label={`${model.name}を選択`}
  aria-pressed={isSelected}
  aria-disabled={!isAvailable}
>
```

#### フォーカス管理
- Tab/Shift+Tabナビゲーション
- フォーカストラップ（モーダル内）
- フォーカスインジケーター



---

## 12. アニメーションシステム

**実装日**: 2024年11月19日  
**ライブラリ**: Framer Motion 12.23.24

### 12.1 概要

Framer Motionを使用した包括的なアニメーションシステムを実装しています。全てのアニメーションは`prefers-reduced-motion`に対応し、アクセシビリティを確保しています。

### 12.2 コンポーネント一覧

#### PageTransition（ページ遷移）

**実装場所**: `components/animation/PageTransition.tsx`

```typescript
import { PageTransition } from '@/components/animation';

export default function Page() {
  return (
    <PageTransition>
      <div className="container">
        <h1>ページコンテンツ</h1>
      </div>
    </PageTransition>
  );
}
```

**特徴**:
- フェードイン/アウト: 300ms
- Y軸移動: 20px
- イージング: easeInOut
- AnimatePresence使用

#### Modal（モーダルアニメーション）

**実装場所**: `components/ui/Modal.tsx`

```typescript
import { Modal } from '@/components/ui/Modal';

<Modal isOpen={isOpen} onClose={onClose} title="タイトル">
  <ModalContent />
</Modal>
```

**特徴**:
- スケールアップ: 0.95 → 1.0
- オーバーレイフェード
- 継続時間: 200ms
- ESCキー対応
- フォーカストラップ

#### AnimatedList（リストアニメーション）

**実装場所**: `components/animation/AnimatedList.tsx`

```typescript
import { AnimatedList, AnimatedListItem } from '@/components/animation';

<AnimatedList className="space-y-2">
  {items.map(item => (
    <AnimatedListItem key={item.id} id={item.id}>
      <ItemContent item={item} />
    </AnimatedListItem>
  ))}
</AnimatedList>
```

**特徴**:
- スライドイン: x: -20 → 0
- スライドアウト: x: 0 → 20
- layoutアニメーション
- 継続時間: 250ms
- mode: popLayout

#### AnimatedCard/Button（ホバーエフェクト）

**実装場所**: `components/animation/AnimatedCard.tsx`

```typescript
import { AnimatedCard, AnimatedButton } from '@/components/animation';

// カード
<AnimatedCard onClick={handleClick} className="p-4 border rounded-lg">
  <CardContent />
</AnimatedCard>

// ボタン
<AnimatedButton onClick={handleClick} className="px-4 py-2">
  クリック
</AnimatedButton>
```

**特徴**:
- ホバー: scale: 1.02
- タップ: scale: 0.98
- 継続時間: 200ms
- disabled状態対応

### 12.3 useReducedMotionフック

**実装場所**: `hooks/useReducedMotion.ts`

```typescript
import { useReducedMotion } from '@/hooks/useReducedMotion';

function MyComponent() {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    // アニメーションなしのUI
    return <div>{content}</div>;
  }
  
  // アニメーション付きのUI
  return <motion.div animate={{ opacity: 1 }}>{content}</motion.div>;
}
```

**特徴**:
- prefers-reduced-motionメディアクエリ検出
- リアルタイム変更監視
- 全アニメーションコンポーネントで使用

### 12.4 アニメーション仕様

#### タイミング

| アニメーション | 継続時間 | イージング |
|--------------|---------|-----------|
| ページ遷移 | 300ms | easeInOut |
| モーダル | 200ms | easeInOut |
| リスト | 250ms | easeInOut |
| ホバー | 200ms | easeInOut |

#### スケール値

| 状態 | スケール |
|-----|---------|
| 通常 | 1.0 |
| ホバー | 1.02 |
| タップ | 0.98 |
| モーダル初期 | 0.95 |

#### 移動距離

| アニメーション | X軸 | Y軸 |
|--------------|-----|-----|
| ページ遷移（開始） | 0 | 20px |
| ページ遷移（終了） | 0 | -20px |
| リスト追加 | -20px → 0 | 0 |
| リスト削除 | 0 → 20px | 0 |

### 12.5 使用例

#### チャットメッセージリスト

```typescript
import { AnimatedList, AnimatedListItem } from '@/components/animation';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <AnimatedList className="space-y-2">
      {messages.map(message => (
        <AnimatedListItem key={message.id} id={message.id}>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
            <p>{message.text}</p>
          </div>
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}
```

#### モデル選択カード

```typescript
import { AnimatedCard } from '@/components/animation';

export function ModelCard({ model, onSelect }: ModelCardProps) {
  return (
    <AnimatedCard
      onClick={() => onSelect(model)}
      className="p-4 border rounded-lg cursor-pointer hover:border-blue-500"
    >
      <h3 className="font-semibold">{model.name}</h3>
      <p className="text-sm text-gray-600">{model.description}</p>
    </AnimatedCard>
  );
}
```

#### 設定モーダル

```typescript
import { Modal } from '@/components/ui/Modal';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="設定">
      <div className="space-y-4">
        <SettingItem label="テーマ" />
        <SettingItem label="言語" />
        <SettingItem label="通知" />
      </div>
    </Modal>
  );
}
```

### 12.6 アクセシビリティ対応

#### prefers-reduced-motion

全てのアニメーションコンポーネントは`useReducedMotion`フックを使用し、ユーザーがアニメーション削減を希望している場合は自動的にアニメーションを無効化します。

```typescript
const prefersReducedMotion = useReducedMotion();

// アニメーション無効時は通常のHTML要素を返す
if (prefersReducedMotion) {
  return <div className={className}>{children}</div>;
}

// アニメーション有効時はFramer Motionコンポーネントを返す
return (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className={className}
  >
    {children}
  </motion.div>
);
```

#### 設定方法

**macOS**:
```
システム設定 > アクセシビリティ > ディスプレイ > 視差効果を減らす
```

**Windows**:
```
設定 > 簡単操作 > ディスプレイ > Windowsでアニメーションを表示する
```

### 12.7 パフォーマンス最適化

#### GPU加速

```typescript
// transform、opacityを使用してGPU加速
<motion.div
  animate={{ 
    scale: 1.02,      // GPU加速
    opacity: 1        // GPU加速
  }}
/>
```

#### 条件付きレンダリング

```typescript
// アニメーション無効時は軽量なHTML要素を使用
if (prefersReducedMotion) {
  return <div>{children}</div>;  // 軽量
}

return <motion.div>{children}</motion.div>;  // Framer Motion
```

#### layoutアニメーション

```typescript
// Framer Motionの最適化されたlayoutアニメーション
<motion.div layout>
  {items.map(item => (
    <motion.div key={item.id} layout>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### 12.8 ベストプラクティス

#### 1. 一貫性のあるタイミング

```typescript
// 統一されたトランジション設定
const transition = {
  duration: 0.2,
  ease: 'easeInOut',
};
```

#### 2. 適切なアニメーションの選択

- **ページ遷移**: PageTransition
- **モーダル**: Modal（既にアニメーション統合済み）
- **リスト**: AnimatedList + AnimatedListItem
- **カード/ボタン**: AnimatedCard / AnimatedButton

#### 3. アクセシビリティ優先

```typescript
// 必ずuseReducedMotionを使用
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  // アニメーションなし
}
```

#### 4. パフォーマンス考慮

```typescript
// GPU加速プロパティを使用
// ✅ 推奨: transform, opacity
// ❌ 非推奨: width, height, top, left

<motion.div
  animate={{ 
    scale: 1.02,     // ✅ GPU加速
    opacity: 1       // ✅ GPU加速
  }}
/>
```

### 12.9 トラブルシューティング

#### アニメーションが動作しない

1. **Framer Motionのインストール確認**
```bash
npm list framer-motion
# framer-motion@12.23.24 が表示されるはず
```

2. **useReducedMotionの確認**
```typescript
const prefersReducedMotion = useReducedMotion();
console.log('Reduced motion:', prefersReducedMotion);
```

3. **AnimatePresenceの使用確認**
```typescript
// 条件付きレンダリングにはAnimatePresenceが必要
<AnimatePresence>
  {isOpen && <motion.div>...</motion.div>}
</AnimatePresence>
```

#### パフォーマンスが悪い

1. **GPU加速プロパティを使用**
```typescript
// ❌ 避ける
animate={{ width: 200, height: 200 }}

// ✅ 推奨
animate={{ scale: 1.5 }}
```

2. **不要なアニメーションを削除**
```typescript
// 必要な場合のみアニメーションを適用
{shouldAnimate && <motion.div>...</motion.div>}
```

### 12.10 関連ドキュメント

- **実装レポート**: `development/docs/completion/phase12-animation-system-implementation-20251119.md`
- **Framer Motion公式**: https://www.framer.com/motion/
- **アクセシビリティガイド**: `docs/guides/ui-ux-guide.md`

---

## 13. 検索とフィルタリング機能

**実装日**: 2024年11月19日  
**フック**: useChatSearch

### 13.1 概要

チャット履歴の全文検索、高度なフィルタリング、検索履歴管理機能を実装しています。デバウンス処理により、パフォーマンスを最適化しています。

### 13.2 コンポーネント一覧

#### useChatSearchフック

**実装場所**: `hooks/useChatSearch.ts`

```typescript
import { useChatSearch } from '@/hooks/useChatSearch';

function ChatSearchPage() {
  const {
    searchQuery,
    filters,
    searchHistory,
    activeFilterCount,
    searchMessages,
    updateSearchQuery,
    updateFilters,
    clearFilters,
  } = useChatSearch();

  const results = searchMessages(messages, searchQuery, filters);

  return (
    <div>
      <input
        value={searchQuery}
        onChange={(e) => updateSearchQuery(e.target.value)}
        placeholder="検索..."
      />
      <div>検索結果: {results.length}件</div>
    </div>
  );
}
```

**機能**:
- 全文検索（メッセージ・セッション）
- 高度なフィルタリング（日付、モデル、ロール）
- 検索履歴管理（localStorage、最大10件）
- マッチ位置検出
- デバウンス処理（300ms）

#### SearchHighlightコンポーネント

**実装場所**: `components/search/SearchHighlight.tsx`

```typescript
import { SearchHighlight } from '@/components/search';

<SearchHighlight
  text="これはテストメッセージです"
  query="テスト"
  highlightClassName="bg-yellow-200 dark:bg-yellow-900"
/>
```

**機能**:
- テキスト内の検索クエリをハイライト
- 複数マッチの全てをハイライト
- ダークモード対応
- カスタマイズ可能なスタイル

#### AdvancedFiltersコンポーネント

**実装場所**: `components/search/AdvancedFilters.tsx`

```typescript
import { AdvancedFilters } from '@/components/search';

<AdvancedFilters
  filters={filters}
  onFiltersChange={updateFilters}
  availableModels={['claude-3', 'gpt-4']}
/>
```

**機能**:
- 日付範囲フィルター（カレンダー入力）
- モデルフィルター（チェックボックス）
- ロールフィルター（user/assistant/system）
- アクティブフィルター数バッジ
- フィルタークリア機能

#### SearchHistoryコンポーネント

**実装場所**: `components/search/SearchHistory.tsx`

```typescript
import { SearchHistory } from '@/components/search';

<SearchHistory
  history={searchHistory}
  onSelect={(query) => updateSearchQuery(query)}
  onRemove={removeFromHistory}
  onClearAll={clearSearchHistory}
/>
```

**機能**:
- 検索履歴の表示（最大10件）
- 相対時間表示（「2分前」等）
- 履歴からの再検索
- 個別削除・全削除機能

#### SearchPanelコンポーネント

**実装場所**: `components/search/SearchPanel.tsx`

```typescript
import { SearchPanel } from '@/components/search';

<SearchPanel
  messages={messages}
  sessions={sessions}
  onResultSelect={(result) => console.log(result)}
  availableModels={['claude-3', 'gpt-4']}
/>
```

**機能**:
- 統合検索UI
- 検索入力（デバウンス付き）
- フィルター設定
- 検索履歴ドロップダウン
- 検索結果表示（ハイライト付き）
- 結果の展開/折りたたみ

### 13.3 型定義

```typescript
// 検索フィルター
interface SearchFilters {
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  models?: string[];
  users?: string[];
  roles?: Array<'user' | 'assistant' | 'system'>;
}

// 検索結果
interface SearchResult {
  message: Message;
  matchIndices: number[];
  matchedText: string[];
  session?: ChatSession;
}

// 検索履歴エントリー
interface SearchHistoryEntry {
  query: string;
  timestamp: number;
}
```

### 13.4 使用例

#### 基本的な検索

```typescript
import { SearchPanel } from '@/components/search';
import { useChatHistory } from '@/hooks/useChatHistory';

export default function ChatPage() {
  const { messages } = useChatHistory();

  const handleResultSelect = (result: SearchResult) => {
    console.log('選択されたメッセージ:', result.message);
    // メッセージにスクロール、ハイライト表示など
  };

  return (
    <SearchPanel
      messages={messages}
      onResultSelect={handleResultSelect}
      availableModels={['claude-3', 'gpt-4']}
    />
  );
}
```

#### セッション検索

```typescript
import { SearchPanel } from '@/components/search';

export default function ChatHistoryPage() {
  const sessions: ChatSession[] = [
    {
      id: 'session-1',
      userId: 'user-1',
      title: 'プロジェクト相談',
      messages: [...],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  return (
    <SearchPanel
      sessions={sessions}
      availableModels={['claude-3', 'gpt-4']}
    />
  );
}
```

#### カスタム検索ロジック

```typescript
import { useChatSearch } from '@/hooks/useChatSearch';

function CustomSearch() {
  const {
    searchMessages,
    updateSearchQuery,
    updateFilters,
  } = useChatSearch();

  const handleSearch = (query: string) => {
    updateSearchQuery(query);
    
    // カスタムフィルター
    updateFilters({
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date()
      },
      roles: ['user', 'assistant']
    });
  };

  const results = searchMessages(messages, searchQuery, filters);

  return (
    <div>
      {results.map(result => (
        <div key={result.message.id}>
          <SearchHighlight
            text={result.message.content}
            query={searchQuery}
          />
        </div>
      ))}
    </div>
  );
}
```

### 13.5 検索アルゴリズム

#### 大文字小文字を区別しない検索

```typescript
const lowerText = text.toLowerCase();
const lowerQuery = query.toLowerCase();
const matches = lowerText.indexOf(lowerQuery);
```

#### 複数マッチの検出

```typescript
const matches: number[] = [];
let index = 0;
while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
  matches.push(index);
  index += lowerQuery.length;
}
```

#### フィルタリングロジック

```typescript
// 日付範囲フィルター
if (filters.dateRange) {
  const messageDate = new Date(message.timestamp);
  if (filters.dateRange.start && messageDate < filters.dateRange.start) {
    return false;
  }
  if (filters.dateRange.end && messageDate > filters.dateRange.end) {
    return false;
  }
}

// モデルフィルター
if (filters.models && filters.models.length > 0) {
  const messageModel = message.metadata?.model;
  if (!messageModel || !filters.models.includes(messageModel)) {
    return false;
  }
}
```

### 13.6 パフォーマンス最適化

#### デバウンス処理

```typescript
// 既存のuseDebounceフックを活用
const debouncedQuery = useDebounce(query, 300);

useEffect(() => {
  onSearch(debouncedQuery);
}, [debouncedQuery, onSearch]);
```

#### メモ化

```typescript
// ハイライト結果のキャッシュ
const highlightedContent = useMemo(() => {
  // ハイライト処理
}, [text, query, highlightClassName]);

// フィルタリング結果のキャッシュ
const filteredResults = useMemo(() => {
  return searchMessages(messages, searchQuery, filters);
}, [messages, searchQuery, filters]);
```

### 13.7 アクセシビリティ

#### ARIA属性

```typescript
<input
  type="search"
  aria-label="チャット履歴を検索"
  aria-describedby="search-help"
/>

<button
  aria-label="検索をクリア"
  aria-pressed={hasQuery}
>
  <X className="w-4 h-4" />
</button>

<div
  role="region"
  aria-label="検索結果"
  aria-live="polite"
>
  {results.length}件の結果
</div>
```

#### キーボード操作

- `Tab`: フォーカス移動
- `Enter`: 検索実行
- `Escape`: 検索クリア、フィルターパネルを閉じる
- `↑/↓`: 検索結果のナビゲーション

### 13.8 ベストプラクティス

#### 1. デバウンス処理の使用

```typescript
// ✅ 推奨: デバウンス処理
const debouncedQuery = useDebounce(query, 300);

// ❌ 非推奨: 即座に検索
onChange={(e) => search(e.target.value)}
```

#### 2. 検索履歴の管理

```typescript
// ✅ 推奨: 最大件数制限
const MAX_HISTORY_SIZE = 10;
const trimmed = history.slice(0, MAX_HISTORY_SIZE);

// ✅ 推奨: 重複削除
const filtered = history.filter(entry => entry.query !== newQuery);
```

#### 3. パフォーマンス考慮

```typescript
// ✅ 推奨: メモ化
const results = useMemo(() => 
  searchMessages(messages, query, filters),
  [messages, query, filters]
);

// ❌ 非推奨: 毎回計算
const results = searchMessages(messages, query, filters);
```

### 13.9 トラブルシューティング

#### 検索結果が表示されない

1. **検索クエリの確認**
```typescript
console.log('Search query:', searchQuery);
console.log('Filters:', filters);
```

2. **メッセージデータの確認**
```typescript
console.log('Messages:', messages);
console.log('Message count:', messages.length);
```

#### ハイライトが表示されない

1. **クエリの確認**
```typescript
console.log('Query:', query);
console.log('Text:', text);
```

2. **CSSクラスの確認**
```typescript
// Tailwind CSSクラスが適用されているか確認
<mark className="bg-yellow-200 dark:bg-yellow-900">
  {matchedText}
</mark>
```

### 13.10 関連ドキュメント

- **実装レポート**: `development/docs/completion/phase13-search-filtering-implementation-20251119.md`
- **要件定義**: `.kiro/specs/user-experience-enhancement/requirements.md` (Requirement 12.1-12.5)
- **タスク管理**: `.kiro/specs/user-experience-enhancement/tasks.md` (Phase 13)

---

## まとめ

このガイドでは、Permission-aware RAG ChatbotのNext.jsフロントエンド開発における主要な実装パターンとベストプラクティスを説明しました。

**実装済み機能**:
- ✅ アクセシビリティ（Phase 7）
- ✅ エラーハンドリング（Phase 8）
- ✅ チャットUI/UX（Phase 9）
- ✅ サイドバー・ナビゲーション（Phase 10）
- ✅ モデル選択UI（Phase 11）
- ✅ アニメーションシステム（Phase 12）
- ✅ 検索とフィルタリング機能（Phase 13）

**次のフェーズ**:
- 🔄 Phase 14: ユーザー設定とカスタマイズ
- 🔄 Phase 15: セキュリティとプライバシー
- 🔄 Phase 16: PWA対応とオフライン機能

新しい機能を実装する際は、このガイドのパターンに従い、アクセシビリティ、エラーハンドリング、パフォーマンスを常に考慮してください。

## テーマ切り替え機能

**実装日**: 2025年11月29日  
**ライブラリ**: Zustand (状態管理)

### 概要

ライト/ダークモードの切り替え機能を実装しています。システムのダークモード設定に影響されず、アプリケーション独自のテーマ管理が可能です。

### 重要な設定: Tailwind CSS darkMode

**最重要**: システムのダークモード設定（`prefers-color-scheme: dark`）を無視するため、Tailwind CSSの`darkMode`設定を以下のように指定します。

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'], // ← 配列形式で指定（必須）
  // ...
}
```

**なぜ必要か**:
- `darkMode: 'class'`だけでは、システムのダークモード設定が優先される場合がある
- 配列形式で指定することで、メディアクエリ（`@media (prefers-color-scheme: dark)`）を完全に無効化
- これにより、システムがダークモードでもアプリケーションのライトモードが正しく表示される

### コンポーネント構成

```
src/
├── store/
│   └── useThemeStore.ts          # Zustandストア（状態管理）
├── components/
│   ├── providers/
│   │   └── ThemeProvider.tsx     # テーマプロバイダー
│   └── ui/
│       └── ThemeToggle.tsx       # テーマ切り替えボタン
└── app/
    └── globals.css               # グローバルCSS
```

### useThemeStore（状態管理）

**実装場所**: `docker/nextjs/src/store/useThemeStore.ts`

```typescript
import { useThemeStore } from '@/store/useThemeStore';

function MyComponent() {
  const { theme, effectiveTheme, setTheme, toggleTheme } = useThemeStore();
  
  return (
    <div>
      <p>現在のテーマ: {effectiveTheme}</p>
      <button onClick={toggleTheme}>テーマ切り替え</button>
    </div>
  );
}
```

**機能**:
- テーマ状態管理（light/dark/system）
- localStorageへの永続化
- DOM更新（`requestAnimationFrame`使用）
- `data-theme`属性の設定

### ThemeProvider

**実装場所**: `docker/nextjs/src/components/providers/ThemeProvider.tsx`

```typescript
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**機能**:
- テーマの初期化
- DOM更新（`light`/`dark`クラスの追加・削除）
- テーマ変更の監視

### ThemeToggle（切り替えボタン）

**実装場所**: `docker/nextjs/src/components/ui/ThemeToggle.tsx`

```typescript
import { ThemeToggle } from '@/components/ui/ThemeToggle';

<ThemeToggle />
```

**機能**:
- ライト/ダークモードの切り替え
- アイコン表示（Sun/Moon）
- アクセシビリティ対応（aria-label）

### グローバルCSS設定

**実装場所**: `docker/nextjs/src/app/globals.css`

```css
/* ライトモード時の明示的な背景色 */
html:not(.dark),
html:not(.dark) body {
  background-color: #ffffff !important;
  color: #0a0a0a !important;
}

/* ダークモード時の明示的な背景色 */
html.dark,
html.dark body {
  background-color: #111827 !important;
  color: #f9fafb !important;
}
```

**重要ポイント**:
- `!important`を使用してTailwindのデフォルトスタイルを上書き
- `html:not(.dark)`でライトモード時のスタイルを明示的に指定

### トラブルシューティング

#### 問題: システムのダークモード設定が優先される

**症状**:
- HTMLに`light`クラスが付いているのに、画面が暗いまま
- `window.matchMedia('(prefers-color-scheme: dark)').matches`が`true`

**解決策**:
```javascript
// tailwind.config.js
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'], // ← 配列形式で指定
}
```

#### 問題: テーマ切り替えボタンが反応しない

**解決策**:
```typescript
// useCallbackを使用してイベントハンドラーをメモ化
const handleClick = useCallback(() => {
  const currentTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(currentTheme);
}, [theme, setTheme]);
```

#### 問題: ページリロード後にテーマが戻る

**解決策**:
```typescript
// Zustandのpersistミドルウェアを使用
export const useThemeStore = create()(
  persist(
    (set, get) => ({
      // ...
    }),
    {
      name: 'theme-storage', // ← localStorageのキー名
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
```

### デバッグ方法

```javascript
// ブラウザコンソールで確認
const html = document.documentElement;
console.log('HTML classes:', html.className);
console.log('Has dark class:', html.classList.contains('dark'));
console.log('Has light class:', html.classList.contains('light'));
console.log('System prefers dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);
```

### 詳細ドキュメント

完全な実装ガイドは以下を参照してください：
- **テーマ実装ガイド**: `docs/guides/theme-implementation-guide.md`

---

## アニメーションシステム (Phase 12)

### Framer Motion統合

**インストール済みパッケージ**:
- `framer-motion@12.23.24`

**基本的な使用方法**:
```typescript
import { motion, AnimatePresence } from 'framer-motion';

// フェードイン/アウト
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  コンテンツ
</motion.div>

// スケールアニメーション
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
  ボタン
</motion.button>
```

### useReducedMotionフック

**実装場所**: `docker/nextjs/src/hooks/useReducedMotion.ts`

```typescript
import { useReducedMotion } from '@/hooks/useReducedMotion';

function MyComponent() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      animate={shouldReduceMotion ? {} : { scale: 1.1 }}
    >
      コンテンツ
    </motion.div>
  );
}
```

## 検索とフィルタリング (Phase 13)

### useChatSearchフック

**実装場所**: `docker/nextjs/src/hooks/useChatSearch.ts`

**機能**:
- 全文検索（メッセージ内容・タイトル・日付）
- デバウンス処理（300ms）
- 検索履歴管理（localStorage、最大10件）
- 高度なフィルタリング（日付範囲・モデル・ロール）

**使用例**:
```typescript
import { useChatSearch } from '@/hooks/useChatSearch';

function ChatHistory() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    filters,
    updateFilters,
    searchHistory,
  } = useChatSearch(messages);
  
  return (
    <div>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="検索..."
      />
      {searchResults.map(result => (
        <div key={result.id}>{result.content}</div>
      ))}
    </div>
  );
}
```

### SearchHighlightコンポーネント

**実装場所**: `docker/nextjs/src/components/search/SearchHighlight.tsx`

**使用例**:
```typescript
import { SearchHighlight } from '@/components/search';

<SearchHighlight
  text="検索対象のテキスト"
  searchQuery="検索"
/>
```

## ユーザー設定 (Phase 14)

### useSettingsStoreストア

**実装場所**: `docker/nextjs/src/store/useSettingsStore.ts`

**設定項目**:
- フォントサイズ（small/medium/large）
- 通知設定（desktop/sound/volume）
- チャット設定（autoSave/sendOnEnter/syntaxHighlight）
- アクセシビリティ設定（reduceMotion/keyboardShortcuts/showFocusIndicator）

**使用例**:
```typescript
import { useSettingsStore } from '@/store/useSettingsStore';

function Settings() {
  const {
    fontSize,
    setFontSize,
    notifications,
    updateNotifications,
    exportSettings,
    importSettings,
  } = useSettingsStore();
  
  return (
    <div>
      <select value={fontSize} onChange={(e) => setFontSize(e.target.value)}>
        <option value="small">小</option>
        <option value="medium">中</option>
        <option value="large">大</option>
      </select>
    </div>
  );
}
```

### フォントサイズのCSS変数

**グローバルCSS**: `docker/nextjs/src/app/globals.css`

```css
:root {
  --font-size-base: 16px;
  --font-size-sm: 14px;
  --font-size-lg: 18px;
}

.text-base {
  font-size: var(--font-size-base);
}
```

## セキュリティとプライバシー (Phase 15)

### useSessionTimeoutフック

**実装場所**: `docker/nextjs/src/hooks/useSessionTimeout.ts`

**機能**:
- 30分間非アクティブでタイムアウト
- 5分前に警告表示
- 自動サインアウト
- 機密情報の自動削除

**使用例**:
```typescript
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/security';

function App() {
  const [showWarning, setShowWarning] = useState(false);
  
  useSessionTimeout({
    timeout: 30 * 60 * 1000, // 30分
    onWarning: () => setShowWarning(true),
    onTimeout: () => router.push('/signin?reason=timeout'),
  });
  
  return (
    <SessionTimeoutWarning
      show={showWarning}
      remainingTime={300}
      onContinue={() => setShowWarning(false)}
      onSignOut={() => router.push('/signin')}
    />
  );
}
```

### セキュリティユーティリティ

**実装場所**: `docker/nextjs/src/lib/security-utils.ts`

**機能**:
- 機密情報検出（`containsSensitiveInfo`）
- 機密情報マスク（`maskSensitiveInfo`）
- localStorageクリア（`clearSensitiveData`）
- XSSサニタイズ（`sanitizeInput`）
- CSRFトークン生成（`generateCSRFToken`）

**使用例**:
```typescript
import {
  containsSensitiveInfo,
  maskSensitiveInfo,
  sanitizeInput,
} from '@/lib/security-utils';

// 機密情報チェック
if (containsSensitiveInfo(userInput)) {
  console.warn('機密情報が含まれています');
}

// マスク処理
const masked = maskSensitiveInfo('test@example.com'); // '[EMAIL]'

// サニタイズ
const safe = sanitizeInput('<script>alert("xss")</script>');
```

### Content Security Policy

**設定場所**: `docker/nextjs/next.config.js`

**設定されたヘッダー**:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

## PWA対応とオフライン機能 (Phase 16)

### next-pwaの設定

**実装場所**: `docker/nextjs/next.config.js`

**キャッシュ戦略**:
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1年
        }
      }
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24時間
        }
      }
    }
  ]
});
```

### メッセージキューイング

**実装場所**: `docker/nextjs/src/lib/message-queue.ts`

**機能**:
- IndexedDBベースのメッセージキュー
- オフライン時のメッセージ保存
- オンライン復旧時の自動送信
- リトライ機能（最大3回）

**使用例**:
```typescript
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { QueueStatus } from '@/components/pwa';

function ChatInterface() {
  const {
    queueCount,
    isProcessing,
    queueMessage,
    processQueue
  } = useMessageQueue();
  
  const handleSendMessage = async (message: string) => {
    if (!navigator.onLine) {
      // オフライン時はキューに追加
      await queueMessage({
        text: message,
        userId: currentUser.id,
        timestamp: Date.now()
      });
      toast.success('メッセージをキューに追加しました');
    } else {
      // オンライン時は直接送信
      await sendMessage(message);
    }
  };
  
  return (
    <>
      <QueueStatus
        count={queueCount}
        isProcessing={isProcessing}
        onProcess={processQueue}
      />
      <MessageInput onSend={handleSendMessage} />
    </>
  );
}
```

### インストールプロンプト

**実装場所**: `docker/nextjs/src/components/pwa/InstallPrompt.tsx`

**機能**:
- PWAインストール可能時にプロンプト表示
- ユーザーの選択を記憶（7日間）
- プラットフォーム別の説明

**使用例**:
```typescript
import { InstallPrompt } from '@/components/pwa';

function Layout({ children }) {
  return (
    <>
      <InstallPrompt />
      {children}
    </>
  );
}
```

### Service Worker

**実装場所**: `docker/nextjs/public/sw.js`

**機能**:
- オフライン時のフォールバックUI
- ネットワークリクエストのインターセプト
- バックグラウンド同期
- キャッシュ管理

**オフラインページ**: `/offline`
- ネットワーク接続状態の表示
- オンライン復旧の自動検出
- 再試行ボタン

## 実装完了フェーズ

### Phase 1-6: 基盤整備
- ✅ テーマシステム
- ✅ 国際化（i18n）
- ✅ 共通UIコンポーネント
- ✅ レスポンシブレイアウト
- ✅ パフォーマンス最適化

### Phase 7-9: コア機能
- ✅ アクセシビリティ
- ✅ エラーハンドリング
- ✅ チャットUI/UX

### Phase 10-11: 高度な機能
- ✅ サイドバーとナビゲーション
- ✅ モデル選択UI

### Phase 12-16: 拡張機能
- ✅ アニメーションシステム
- ✅ 検索とフィルタリング
- ✅ ユーザー設定
- ✅ セキュリティとプライバシー
- ✅ PWA対応とオフライン機能

---

**最終更新**: 2025年11月19日  
**バージョン**: 2.1  
**全体進捗**: 100% (16/16実装フェーズ完了)


---

## 14. Next.js 15 Dynamic Import とTree Shaking対策

**実装日**: 2024年12月5日  
**対象**: Next.js 15のTree Shaking問題への対応

### 14.1 概要

Next.js 15では、条件付きレンダリングされるコンポーネントがTree Shakingの対象となり、ビルド時に除外される問題が発生します。この問題を解決するため、Dynamic Importを使用した実装パターンを確立しました。

### 14.2 問題の背景

#### Tree Shaking問題

```typescript
// ❌ 問題のあるコード
import { AgentModeSidebar } from '@/components/sidebar/AgentModeSidebar';

// Agentモード時のみ表示
{agentMode ? (
  <AgentModeSidebar />  // ← ビルド時に除外される可能性
) : (
  <RegularSidebar />
)}
```

**症状**:
- Agentモード時にサイドバーが表示されない
- ビルドログに警告なし
- 開発環境では正常動作

**原因**:
- Next.js 15のTree Shakingが条件付きコンポーネントを「未使用」と判断
- 初期バンドルサイズ削減のため、積極的に除外

### 14.3 解決策: Dynamic Import

#### 基本パターン

```typescript
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic Importでコンポーネントを読み込み
const AgentModeSidebar = dynamic(
  () => import('../../../components/sidebar/AgentModeSidebar').then(mod => ({ 
    default: mod.AgentModeSidebar 
  })),
  { ssr: false }
);

// Suspenseでラップして使用
{agentMode ? (
  <Suspense fallback={<div className="w-80 bg-white dark:bg-gray-800 border-r" />}>
    <AgentModeSidebar
      currentSessionId={currentSession?.id}
      onNewChat={handleNewChat}
      userName={user.username}
      userEmail={user.email}
    />
  </Suspense>
) : (
  <RegularSidebar />
)}
```

#### 実装のポイント

1. **named exportの場合**
```typescript
// ✅ 正しい実装
const Component = dynamic(
  () => import('./Component').then(mod => ({ default: mod.ComponentName })),
  { ssr: false }
);
```

2. **default exportの場合**
```typescript
// ✅ 正しい実装
const Component = dynamic(
  () => import('./Component'),
  { ssr: false }
);
```

3. **Suspenseでラップ**
```typescript
// ✅ 必須: Suspenseでラップ
<Suspense fallback={<LoadingSpinner />}>
  <DynamicComponent />
</Suspense>
```

### 14.4 効果

#### バンドルサイズ削減

```
Before (通常のimport):
├─ First Load JS: 70.3 kB
└─ Shared by all: 70.3 kB

After (Dynamic Import):
├─ First Load JS: 33.3 kB  (-52.6%)
└─ Shared by all: 33.3 kB
└─ Agent Mode Chunk: 37.0 kB (遅延読み込み)
```

**効果**:
- 初期バンドルサイズ: 52.6%削減
- Code Splitting: Agentモード専用コードが別チャンクに分離
- Tree Shaking問題: 完全解決

### 14.5 Context外での安全な使用

Dynamic Importしたコンポーネント内でContextを使用する場合、Provider外でレンダリングされる可能性があります。

#### 問題のあるコード

```typescript
// ❌ エラーが発生する可能性
export function Button() {
  const { theme } = useTheme(); // ThemeProvider外でエラー
  return <button className={theme === 'dark' ? 'dark' : 'light'}>Click</button>;
}
```

#### 安全な実装

```typescript
// ✅ 安全な実装
export function Button() {
  let theme: 'light' | 'dark' = 'light';
  
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch (error) {
    console.warn('Button: ThemeProvider外で使用されています。デフォルトテーマを使用します。');
  }
  
  return <button className={theme === 'dark' ? 'dark' : 'light'}>Click</button>;
}
```

### 14.6 useEffect無限ループの回避

コールバック関数を依存配列に含めると無限ループが発生する可能性があります。

#### 問題のあるコード

```typescript
// ❌ 無限ループの原因
const fetchData = useCallback(() => {
  // API呼び出し
}, [onSuccess, onError]); // onSuccess, onErrorが変わるたびに再生成

useEffect(() => {
  fetchData();
}, [fetchData]); // fetchDataが変わるたびに実行 → 無限ループ
```

#### 修正版

```typescript
// ✅ 修正版
useEffect(() => {
  if (condition) {
    fetchData();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [condition]); // fetchDataを依存配列から除外
```

### 14.7 実装チェックリスト

Dynamic Importを実装する際は、以下を確認してください:

- [ ] `dynamic`をインポート
- [ ] `Suspense`をインポート
- [ ] named exportの場合は`.then(mod => ({ default: mod.Name }))`を使用
- [ ] `{ ssr: false }`オプションを設定
- [ ] `Suspense`でラップ
- [ ] fallbackコンポーネントを設定
- [ ] Context使用時はtry-catchで保護
- [ ] useEffectの依存配列を確認

### 14.8 ベストプラクティス

#### 1. 条件付きレンダリングコンポーネント

```typescript
// ✅ 推奨: Dynamic Import
const ConditionalComponent = dynamic(
  () => import('./ConditionalComponent'),
  { ssr: false }
);

{condition && (
  <Suspense fallback={<div>Loading...</div>}>
    <ConditionalComponent />
  </Suspense>
)}
```

#### 2. 大きなコンポーネント

```typescript
// ✅ 推奨: 初期表示に不要な大きなコンポーネント
const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  { 
    ssr: false,
    loading: () => <Skeleton />
  }
);
```

#### 3. モーダル・ダイアログ

```typescript
// ✅ 推奨: 開閉するモーダル
const Modal = dynamic(
  () => import('./Modal'),
  { ssr: false }
);

{isOpen && (
  <Suspense fallback={null}>
    <Modal onClose={() => setIsOpen(false)} />
  </Suspense>
)}
```

### 14.9 トラブルシューティング

#### コンポーネントが表示されない

1. **Dynamic Importの確認**
```typescript
// ✅ 正しい
const Component = dynamic(() => import('./Component'), { ssr: false });

// ❌ 間違い
import { Component } from './Component';
```

2. **Suspenseの確認**
```typescript
// ✅ 必須
<Suspense fallback={<div>Loading...</div>}>
  <DynamicComponent />
</Suspense>
```

3. **ビルド確認**
```bash
npm run build
# .next/server/app/[locale]/genai/page.js を確認
# Dynamic Importされたコンポーネントが含まれているか確認
```

#### 無限ループが発生する

1. **useEffectの依存配列を確認**
```typescript
// ❌ 無限ループ
useEffect(() => {
  fetchData();
}, [fetchData]);

// ✅ 修正
useEffect(() => {
  fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

2. **useCallbackの依存配列を確認**
```typescript
// ❌ 無限ループ
const callback = useCallback(() => {
  // ...
}, [prop1, prop2, prop3]); // 多すぎる依存

// ✅ 修正
const callback = useCallback(() => {
  // ...
}, []); // 必要最小限の依存
```

### 14.10 関連ドキュメント

- **実装レポート**: `development/docs/reports/local/agent-info-section-dynamic-import-success-20251205.md`
- **Next.js Dynamic Import**: https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading
- **React Suspense**: https://react.dev/reference/react/Suspense

---

**最終更新**: 2024年12月5日  
**メンテナンス**: このガイドは新機能追加時に更新してください
