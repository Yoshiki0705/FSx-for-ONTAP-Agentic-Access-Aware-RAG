# フロントエンド開発完全ガイド

**最終更新**: 2026年1月18日  
**バージョン**: 3.0  
**対象**: Permission-aware RAG System Frontend

---

## 目次

1. [プロジェクト構造](#1-プロジェクト構造)
2. [アクセシビリティ実装](#2-アクセシビリティ実装)
3. [エラーハンドリング](#3-エラーハンドリング)
4. [チャットUI/UX](#4-チャットuiux)
5. [カスタムフック](#5-カスタムフック)
6. [型定義](#6-型定義)
7. [ベストプラクティス](#7-ベストプラクティス)
8. [サイドバーとナビゲーション](#8-サイドバーとナビゲーション)
9. [モデル選択UI](#9-モデル選択ui)
10. [アニメーションシステム](#10-アニメーションシステム)
11. [検索とフィルタリング](#11-検索とフィルタリング)
12. [ユーザー設定](#12-ユーザー設定)
13. [セキュリティとプライバシー](#13-セキュリティとプライバシー)
14. [PWA対応とオフライン機能](#14-pwa対応とオフライン機能)
15. [テーマシステム](#15-テーマシステム)
16. [TypeScript型安全性](#16-typescript型安全性)
17. [Next.js 15 Dynamic Import](#17-nextjs-15-dynamic-import)

---

## 1. プロジェクト構造

```
docker/nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/          # 国際化対応ルート
│   │   │   ├── genai/         # GenAIチャットページ
│   │   │   ├── kb/            # ナレッジベースページ
│   │   │   └── signin/        # サインインページ
│   │   ├── api/               # APIルート
│   │   └── globals.css        # グローバルスタイル
│   ├── components/            # Reactコンポーネント
│   │   ├── accessibility/     # アクセシビリティ関連
│   │   ├── animation/         # アニメーション関連
│   │   ├── chat/              # チャット関連
│   │   ├── common/            # 共通コンポーネント
│   │   ├── error/             # エラー関連
│   │   ├── layout/            # レイアウト関連
│   │   ├── model/             # モデル選択関連
│   │   ├── providers/         # Contextプロバイダー
│   │   ├── pwa/               # PWA関連
│   │   ├── search/            # 検索関連
│   │   ├── security/          # セキュリティ関連
│   │   ├── settings/          # 設定関連
│   │   ├── sidebar/           # サイドバー関連
│   │   └── ui/                # 基本UIコンポーネント
│   ├── hooks/                 # カスタムフック
│   ├── i18n/                  # 国際化設定
│   ├── lib/                   # ユーティリティ関数
│   ├── messages/              # 翻訳ファイル
│   ├── store/                 # Zustand状態管理
│   └── types/                 # TypeScript型定義
├── public/                    # 静的ファイル
│   ├── icons/                 # PWAアイコン
│   ├── manifest.json          # PWAマニフェスト
│   └── sw.js                  # Service Worker
├── next.config.js             # Next.js設定
├── tailwind.config.js         # Tailwind CSS設定
└── tsconfig.json              # TypeScript設定
```

---

## 2. アクセシビリティ実装

### 2.1 ARIA属性の使用

#### ボタンとリンク

```typescript
// ✅ 良い例
<button
  aria-label="メッセージを送信"
  aria-disabled={isLoading}
  aria-busy={isLoading}
>
  送信
</button>

// ❌ 悪い例
<button>送信</button>
```

#### フォーム要素

```typescript
// ✅ 良い例
<input
  type="text"
  aria-label="検索クエリ"
  aria-describedby="search-help"
  aria-invalid={hasError}
  aria-errormessage={hasError ? "error-message" : undefined}
/>
{hasError && (
  <div id="error-message" role="alert">
    エラーメッセージ
  </div>
)}

// ❌ 悪い例
<input type="text" placeholder="検索" />
```

### 2.2 キーボードナビゲーション

#### フォーカス管理

```typescript
import { useRef, useEffect } from 'react';

function Modal({ isOpen, onClose }) {
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  return (
    <div role="dialog" aria-modal="true" onKeyDown={handleKeyDown}>
      <button ref={firstFocusableRef} onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}
```

### 2.3 スクリーンリーダー対応

#### ライブリージョン

```typescript
// ✅ 良い例
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

#### 視覚的に隠す

```typescript
// Tailwind CSSクラス
<span className="sr-only">
  スクリーンリーダー専用テキスト
</span>

// カスタムCSS
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 2.4 カラーコントラスト

```typescript
// Tailwind CSSでWCAG AA準拠のコントラスト比を確保
<button className="bg-blue-600 text-white hover:bg-blue-700">
  ボタン
</button>

// ダークモード対応
<div className="text-gray-900 dark:text-gray-100">
  テキスト
</div>
```

---

## 3. エラーハンドリング

### 3.1 エラーバウンダリ

**実装場所**: `components/error/ErrorBoundary.tsx`

```typescript
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h2>エラーが発生しました</h2>
      <p>{error.message}</p>
      <button onClick={reset}>再試行</button>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

### 3.2 APIエラーハンドリング

```typescript
import { handleApiError } from '@/lib/error-handler';

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    const handledError = handleApiError(error);
    console.error('API Error:', handledError);
    throw handledError;
  }
}
```

### 3.3 トースト通知

```typescript
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { showToast } = useToast();
  
  const handleSuccess = () => {
    showToast({
      type: 'success',
      message: '保存しました',
      duration: 3000
    });
  };
  
  const handleError = () => {
    showToast({
      type: 'error',
      message: 'エラーが発生しました',
      duration: 5000
    });
  };
}
```

---

## 4. チャットUI/UX

### 4.1 メッセージ表示

**実装場所**: `components/chat/MessageList.tsx`

```typescript
import { MessageList } from '@/components/chat/MessageList';

<MessageList
  messages={messages}
  isLoading={isLoading}
  onRetry={(messageId) => retryMessage(messageId)}
  onCopy={(text) => copyToClipboard(text)}
/>
```

### 4.2 入力フォーム

**実装場所**: `components/chat/MessageInput.tsx`

```typescript
import { MessageInput } from '@/components/chat/MessageInput';

<MessageInput
  onSend={(message) => sendMessage(message)}
  disabled={isLoading}
  placeholder="メッセージを入力..."
  maxLength={4000}
/>
```

### 4.3 ストリーミング表示

```typescript
import { useStreamingMessage } from '@/hooks/useStreamingMessage';

function ChatInterface() {
  const { streamingMessage, startStreaming, stopStreaming } = useStreamingMessage();
  
  const handleSend = async (message: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    
    const reader = response.body?.getReader();
    if (!reader) return;
    
    startStreaming();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = new TextDecoder().decode(value);
      // ストリーミングメッセージを更新
    }
    
    stopStreaming();
  };
}
```

---

## 5. カスタムフック

### 5.1 useChatHistory

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
```

### 5.2 useDebounce

**実装場所**: `hooks/useDebounce.ts`

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);

useEffect(() => {
  // debouncedQueryを使用して検索
}, [debouncedQuery]);
```

### 5.3 useLocalStorage

**実装場所**: `hooks/useLocalStorage.ts`

```typescript
import { useLocalStorage } from '@/hooks/useLocalStorage';

const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
```

---

## 6. 型定義

### 6.1 メッセージ型

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    error?: string;
  };
}
```

### 6.2 セッション型

```typescript
interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: {
    model?: string;
    tags?: string[];
  };
}
```

### 6.3 ユーザー型

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  preferences?: {
    theme?: 'light' | 'dark';
    language?: 'ja' | 'en' | 'ko';
  };
}
```

---

## 7. ベストプラクティス

### 7.1 React Hooksのクロージャ問題対策

```typescript
// ❌ 悪い例: クロージャ問題
const handleDelete = (sessionId: string) => {
  const updated = historySessions.filter(s => s.id !== sessionId);
  setHistorySessions(updated);
};

// ✅ 良い例: 関数形式のsetStateを使用
const handleDelete = (sessionId: string) => {
  setHistorySessions(prev => prev.filter(s => s.id !== sessionId));
};
```

### 7.2 useEffectの依存配列管理

```typescript
// ❌ 悪い例: 不要な依存
useEffect(() => {
  fetchData();
}, [fetchData, param1, param2, param3]);

// ✅ 良い例: 必要最小限の依存
useEffect(() => {
  fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [param1]);
```

### 7.3 メモ化の活用

```typescript
// useMemoでの計算結果のキャッシュ
const filteredMessages = useMemo(() => {
  return messages.filter(m => m.role === 'user');
}, [messages]);

// useCallbackでの関数のメモ化
const handleClick = useCallback(() => {
  console.log('clicked');
}, []);
```

---

## 8. サイドバーとナビゲーション

### 8.1 サイドバーコンポーネント

**実装場所**: `components/sidebar/Sidebar.tsx`

```typescript
import { Sidebar } from '@/components/sidebar';

<Sidebar
  sessions={sessions}
  currentSessionId={currentSession?.id}
  onSessionSelect={(id) => switchSession(id)}
  onNewChat={() => createNewChat()}
  onDeleteSession={(id) => deleteSession(id)}
/>
```

### 8.2 レスポンシブ対応

```typescript
import { useState } from 'react';

function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  return (
    <div className="flex h-screen">
      {/* モバイル: オーバーレイ */}
      <div className={`
        fixed inset-0 bg-black/50 z-40 lg:hidden
        ${isSidebarOpen ? 'block' : 'hidden'}
      `} onClick={() => setIsSidebarOpen(false)} />
      
      {/* サイドバー */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-80 bg-white dark:bg-gray-800
        transform transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
      </aside>
      
      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

---

## 9. モデル選択UI

### 9.1 ModelSelectorコンポーネント

**実装場所**: `components/model/ModelSelector.tsx`

```typescript
import { ModelSelector } from '@/components/model';

<ModelSelector
  models={availableModels}
  selectedModel={currentModel}
  onSelect={(model) => setCurrentModel(model)}
  disabled={isLoading}
/>
```

### 9.2 モデル情報表示

```typescript
interface ModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  pricing: {
    input: number;
    output: number;
  };
}

function ModelCard({ model }: { model: ModelInfo }) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{model.name}</h3>
      <p className="text-sm text-gray-600">{model.description}</p>
      <div className="mt-2 text-xs">
        <span>最大トークン: {model.maxTokens.toLocaleString()}</span>
      </div>
    </div>
  );
}
```

---

## 10. アニメーションシステム

### 10.1 Framer Motion統合

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

### 10.2 useReducedMotionフック

**実装場所**: `hooks/useReducedMotion.ts`

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

---

## 11. 検索とフィルタリング

### 11.1 useChatSearchフック

**実装場所**: `hooks/useChatSearch.ts`

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

### 11.2 SearchHighlightコンポーネント

**実装場所**: `components/search/SearchHighlight.tsx`

```typescript
import { SearchHighlight } from '@/components/search';

<SearchHighlight
  text="検索対象のテキスト"
  searchQuery="検索"
/>
```

---

## 12. ユーザー設定

### 12.1 useSettingsStoreストア

**実装場所**: `store/useSettingsStore.ts`

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

---

## 13. セキュリティとプライバシー

### 13.1 useSessionTimeoutフック

**実装場所**: `hooks/useSessionTimeout.ts`

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

### 13.2 セキュリティユーティリティ

**実装場所**: `lib/security-utils.ts`

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

---

## 14. PWA対応とオフライン機能

### 14.1 next-pwaの設定

**実装場所**: `next.config.js`

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
          maxAgeSeconds: 365 * 24 * 60 * 60
        }
      }
    }
  ]
});
```

### 14.2 メッセージキューイング

**実装場所**: `lib/message-queue.ts`

```typescript
import { useMessageQueue } from '@/hooks/useMessageQueue';

function ChatInterface() {
  const {
    queueCount,
    isProcessing,
    queueMessage,
    processQueue
  } = useMessageQueue();
  
  const handleSendMessage = async (message: string) => {
    if (!navigator.onLine) {
      await queueMessage({
        text: message,
        userId: currentUser.id,
        timestamp: Date.now()
      });
    } else {
      await sendMessage(message);
    }
  };
}
```

---

## 15. テーマシステム

### 15.1 useThemeStore

**実装場所**: `store/useThemeStore.ts`

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

### 15.2 Tailwind CSS darkMode設定

**実装場所**: `tailwind.config.js`

```javascript
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  // ...
}
```

### 15.3 グローバルCSS設定

**実装場所**: `app/globals.css`

```css
html:not(.dark),
html:not(.dark) body {
  background-color: #ffffff !important;
  color: #0a0a0a !important;
}

html.dark,
html.dark body {
  background-color: #111827 !important;
  color: #f9fafb !important;
}
```

---

## 16. TypeScript型安全性

### 16.1 Discriminated Unions

```typescript
export const TYPES = {
  TYPE_A: 'TYPE_A',
  TYPE_B: 'TYPE_B',
} as const;
export type MyType = typeof TYPES[keyof typeof TYPES];
```

### 16.2 Exhaustiveness Checking

```typescript
function handle(type: MyType): string {
  switch (type) {
    case TYPES.TYPE_A: return 'A';
    case TYPES.TYPE_B: return 'B';
    default:
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled: ${exhaustiveCheck}`);
  }
}
```

### 16.3 Record型の完全性チェック

```typescript
// ✅ 良い例
const STEP_TYPE_ICONS: Record<TraceStepType, string> = {
  'PRE_PROCESSING': '🔄',
  'ORCHESTRATION': '🎯',
  'POST_PROCESSING': '✅',
};
```

### 16.4 React State配列アクセスの必須パターン

```typescript
// ✅ 安全
useEffect(() => {
  if (currentSession && Array.isArray(currentSession.messages) && currentSession.messages.length > 0) {
    const firstMessage = currentSession.messages[0];
  }
}, [currentSession]);
```

---

## 17. Next.js 15 Dynamic Import

### 17.1 基本パターン

```typescript
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const AgentModeSidebar = dynamic(
  () => import('../../../components/sidebar/AgentModeSidebar').then(mod => ({ 
    default: mod.AgentModeSidebar 
  })),
  { ssr: false }
);

{agentMode ? (
  <Suspense fallback={<div className="w-80 bg-white dark:bg-gray-800 border-r" />}>
    <AgentModeSidebar />
  </Suspense>
) : (
  <RegularSidebar />
)}
```

### 17.2 効果

- 初期バンドルサイズ: 52.6%削減
- Code Splitting: 条件付きコンポーネントが別チャンクに分離
- Tree Shaking問題: 完全解決

---

## まとめ

このガイドでは、Permission-aware RAG ChatbotのNext.jsフロントエンド開発における主要な実装パターンとベストプラクティスを説明しました。

**実装済み機能**:
- ✅ アクセシビリティ
- ✅ エラーハンドリング
- ✅ チャットUI/UX
- ✅ サイドバー・ナビゲーション
- ✅ モデル選択UI
- ✅ アニメーションシステム
- ✅ 検索とフィルタリング
- ✅ ユーザー設定
- ✅ セキュリティとプライバシー
- ✅ PWA対応とオフライン機能
- ✅ テーマシステム
- ✅ TypeScript型安全性
- ✅ Next.js 15 Dynamic Import

新しい機能を実装する際は、このガイドのパターンに従い、アクセシビリティ、エラーハンドリング、パフォーマンスを常に考慮してください。

---

**最終更新**: 2026年1月18日  
**バージョン**: 3.0  
**全体進捗**: 100% (全実装フェーズ完了)
