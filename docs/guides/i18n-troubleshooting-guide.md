# 国際化（i18n）トラブルシューティングガイド

**最終更新**: 2026-01-06  
**対象**: 開発者・運用者

---

## 📋 目次

1. [概要](#概要)
2. [よくある問題と解決策](#よくある問題と解決策)
3. [言語切り替えの仕組み](#言語切り替えの仕組み)
4. [デバッグ方法](#デバッグ方法)
5. [ベストプラクティス](#ベストプラクティス)
6. [既知の問題](#既知の問題)

---

## 概要

このアプリケーションは、Next.js 15とnext-intlを使用して8言語（日本語、英語、韓国語、中国語簡体字・繁体字、スペイン語、ドイツ語、フランス語）をサポートしています。

### アーキテクチャ

```
docker/nextjs/
├── i18n.ts                    # i18n設定（プロジェクトルート）
├── src/
│   ├── i18n/
│   │   ├── config.ts          # ロケール設定
│   │   └── request.ts         # リクエストロケール取得
│   ├── middleware.ts          # ルーティング・認証
│   └── components/
│       └── ui/
│           └── LanguageSwitcher.tsx  # 言語切り替えUI
└── messages/
    ├── ja.json                # 日本語翻訳
    ├── en.json                # 英語翻訳
    ├── ko.json                # 韓国語翻訳
    ├── zh-CN.json             # 中国語簡体字翻訳
    ├── zh-TW.json             # 中国語繁体字翻訳
    ├── es.json                # スペイン語翻訳
    ├── de.json                # ドイツ語翻訳
    └── fr.json                # フランス語翻訳
```

---

## よくある問題と解決策

### 問題1: 言語切り替え後、一部のコンポーネントが更新されない

**症状**:
- 言語ドロップダウンで韓国語を選択
- ヘッダーやメインコンテンツは韓国語に変更される
- サイドバーの一部（Bedrockリージョン、AIモデル選択）が日本語のまま

**原因**:
コンポーネントが`useLocale`フックを使用しておらず、ロケール変更時に再レンダリングされない。

**解決策**:

#### Step 1: useLocaleをインポート
```typescript
import { useTranslations, useLocale } from 'next-intl';
```

#### Step 2: コンポーネント内でuseLocaleを呼び出し
```typescript
export function MyComponent() {
  const t = useTranslations('namespace');
  const locale = useLocale(); // ロケールを取得
  
  // ...
}
```

#### Step 3: useMemoの依存配列にlocaleを追加
```typescript
const categorizedData = useMemo(() => {
  // データ処理
  return processedData;
}, [data, locale]); // localeを依存配列に追加
```

**修正例**:
```typescript
// ❌ 悪い例
const categorizedModels = useMemo(() => {
  // モデルをカテゴリ別に分類
  return categories;
}, [models]); // localeが依存配列にない

// ✅ 良い例
const locale = useLocale(); // ロケールを取得
const categorizedModels = useMemo(() => {
  // モデルをカテゴリ別に分類
  return categories;
}, [models, locale]); // localeを依存配列に追加
```

---

### 問題2: サインインループが発生する

**症状**:
- `/signin`にアクセスすると無限リダイレクトループが発生
- ブラウザが「リダイレクトが多すぎます」エラーを表示

**原因**:
middlewareでロケールなしパス（`/signin`）を処理する前に、intlMiddlewareがロケール付きパス（`/ja/signin`）にリダイレクトし、その後再度`/signin`にリダイレクトされる。

**解決策**:

#### middleware.tsの修正
```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ✅ ロケールなしパスを intlMiddleware の前に処理
  if (pathname === '/signin') {
    const locale = localeCookie || 'ja';
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/signin`;
    return NextResponse.redirect(url);
  }
  
  // intlMiddlewareを実行
  const intlResponse = intlMiddleware(request);
  // ...
}
```

**重要ポイント**:
1. ロケールなしパス（`/signin`）を最初に処理
2. ロケール付きパス（`/ja/signin`）にリダイレクト
3. その後、intlMiddlewareを実行

---

### 問題3: Agentモード切り替え時にエラーが発生

**症状**:
```
Uncaught TypeError: Cannot use 'in' operator to search for 'status' in null
```

**原因**:
APIレスポンスがnullの状態で、'in'演算子を使用してプロパティの存在をチェックしている。

**解決策**:

#### nullチェックを追加
```typescript
// ❌ 悪い例
if ('status' in response) {  // responseがnullの場合エラー
  const status = response.status;
}

// ✅ 良い例
if (response && 'status' in response) {  // nullチェックを追加
  const status = response.status;
}
```

#### Chrome DevTools MCPで実際のレスポンス構造を確認
```typescript
// Step 1: Network Requestsでレスポンスを確認
mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["xhr", "fetch"]
})

// Step 2: 特定のリクエストの詳細を確認
mcp_chrome_devtool_get_network_request({ reqid: 123 })

// Step 3: 実際のレスポンス構造に基づいて実装
const userData = {
  username: data.session.username,  // 実際に存在するフィールド
  userId: data.session.userId,      // 実際に存在するフィールド
  role: 'user'
};
```

**重要**: 推測でコーディングせず、実際のAPIレスポンス構造を確認してから実装する。

---

### 問題4: Next.js 15のi18n設定が認識されない

**症状**:
- `src/i18n.ts`を作成したが、i18n設定が認識されない
- ビルド時にエラーが発生

**原因**:
Next.js 15は、プロジェクトルートの`i18n.ts`を優先的に探す。

**解決策**:

#### i18n.tsをプロジェクトルートに配置
```
docker/nextjs/
├── i18n.ts              # ✅ プロジェクトルート
└── src/
    └── i18n.ts          # ❌ srcディレクトリ（認識されない）
```

#### i18n.tsの内容
```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  
  if (!locale) {
    const cookieStore = await cookies();
    locale = cookieStore.get('NEXT_LOCALE')?.value || 'ja';
  }
  
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
```

---

### 問題5: 翻訳キーが見つからない

**症状**:
```
MISSING_MESSAGE: chat.introduction.loading (ko)
```

**原因**:
翻訳ファイルに該当するキーが存在しない。

**解決策**:

#### Step 1: 翻訳キーを追加
```json
// messages/ko.json
{
  "chat": {
    "introduction": {
      "loading": "로딩 중...",
      "checkingPermissions": "권한 확인 중..."
    }
  }
}
```

#### Step 2: 全言語に同じキーを追加
```bash
# 日本語
"loading": "読み込み中..."

# 英語
"loading": "Loading..."

# 中国語簡体字
"loading": "加载中..."
```

#### Step 3: TypeScriptサーバーを再起動
```bash
# VSCodeの場合
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## 言語切り替えの仕組み

### フロー

```
1. ユーザーが言語ドロップダウンをクリック
   ↓
2. LanguageSwitcher.tsxがAPIリクエストを送信
   POST /api/locale
   Body: { locale: 'ko' }
   ↓
3. APIがCookieを設定
   Set-Cookie: NEXT_LOCALE=ko
   ↓
4. ページをリロード
   window.location.href = `/${newLocale}${pathname}`
   ↓
5. middlewareがCookieを読み取り、ロケールを設定
   ↓
6. useLocaleを使用しているコンポーネントが再レンダリング
```

### 重要なファイル

#### 1. LanguageSwitcher.tsx
```typescript
const handleLanguageChange = async (newLocale: string) => {
  try {
    // APIでCookieを設定
    const response = await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    });
    
    if (response.ok) {
      // ページをリロード
      window.location.href = `/${newLocale}${pathname}`;
    }
  } catch (error) {
    console.error('Failed to change language:', error);
  }
};
```

#### 2. /api/locale/route.ts
```typescript
export async function POST(request: Request) {
  const { locale } = await request.json();
  
  // Cookieを設定
  const response = NextResponse.json({ success: true });
  response.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1年
  });
  
  return response;
}
```

#### 3. middleware.ts
```typescript
export async function middleware(request: NextRequest) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  
  // Cookieからロケールを取得
  const locale = localeCookie || 'ja';
  
  // intlMiddlewareを実行
  return intlMiddleware(request);
}
```

---

## デバッグ方法

### Chrome DevTools MCPを使用

#### 1. Console Logsを確認
```typescript
mcp_chrome_devtool_list_console_messages({
  pageSize: 50,
  types: ["error", "warn"]
})
```

#### 2. Network Requestsを確認
```typescript
mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["xhr", "fetch"]
})
```

#### 3. 特定のリクエストの詳細を確認
```typescript
mcp_chrome_devtool_get_network_request({ reqid: 123 })
```

### ブラウザのDevTools

#### 1. Cookieを確認
```
Application → Cookies → https://d3p7l2uoh6npdr.cloudfront.net
→ NEXT_LOCALE の値を確認
```

#### 2. Networkタブでリクエストを確認
```
Network → Fetch/XHR → /api/locale
→ Request Payload: { locale: 'ko' }
→ Response Headers: Set-Cookie: NEXT_LOCALE=ko
```

#### 3. Consoleでロケールを確認
```javascript
document.cookie.split(';').find(c => c.includes('NEXT_LOCALE'))
```

---

## ベストプラクティス

### 1. useLocaleの使用

**全てのコンポーネントでuseLocaleを使用**:
```typescript
export function MyComponent() {
  const t = useTranslations('namespace');
  const locale = useLocale(); // 必須
  
  // useMemoの依存配列にlocaleを追加
  const data = useMemo(() => {
    return processData();
  }, [rawData, locale]);
}
```

### 2. 翻訳キーの命名規則

**階層構造を使用**:
```json
{
  "model": {
    "selector": {
      "title": "AIモデル選択",
      "availableModels": "利用可能なモデル",
      "noModelSelected": "モデルが選択されていません"
    }
  }
}
```

**使用方法**:
```typescript
const t = useTranslations('model.selector');
<h3>{t('title')}</h3>
<p>{t('availableModels')}</p>
```

### 3. ハードコードされたテキストの禁止

**❌ 悪い例**:
```typescript
<div>モデルが選択されていません</div>
```

**✅ 良い例**:
```typescript
<div>{t('noModelSelected')}</div>
```

### 4. テンプレートリテラルのエスケープ

**翻訳ファイル**:
```json
{
  "welcome": "こんにちは、\\{username\\}さん！"
}
```

**使用方法**:
```typescript
t('welcome', { username: 'admin' })
```

### 5. useTranslationsはコンポーネントトップレベルで呼び出し

**❌ 悪い例**:
```typescript
function MyComponent() {
  const handleClick = () => {
    const t = useTranslations('namespace'); // ❌ イベントハンドラ内
    alert(t('message'));
  };
}
```

**✅ 良い例**:
```typescript
function MyComponent() {
  const t = useTranslations('namespace'); // ✅ トップレベル
  
  const handleClick = () => {
    alert(t('message'));
  };
}
```

---

## 既知の問題

### 1. TypeScript型エラー

**症状**:
```
Argument of type '"unavailableModels"' is not assignable to parameter of type 'MessageKeys<...>'
```

**原因**:
TypeScriptサーバーが翻訳ファイルの更新を認識していない。

**対策**:
1. TypeScriptサーバーを再起動
2. ビルドを実行して型定義を更新
3. 実行時には問題なく動作する

### 2. ビルド警告

**症状**:
```
Attempted import error: 'REGION_MODEL_AVAILABILITY' is not exported from '@/config/bedrock-models'
```

**原因**:
未使用のインポートが残っている。

**対策**:
実行時には影響しないため、無視しても問題ない。

### 3. 翻訳キーの不足

**症状**:
```
MISSING_MESSAGE: chat.introduction.loading (ko)
```

**原因**:
一部の翻訳キーが全言語に追加されていない。

**対策**:
1. 不足している翻訳キーを特定
2. 全8言語の翻訳ファイルに追加
3. デプロイ

---

## Tips

### 1. 新しい翻訳キーを追加する手順

```bash
# Step 1: 日本語翻訳ファイルに追加
vim docker/nextjs/messages/ja.json

# Step 2: 他の7言語にも追加
# en.json, ko.json, zh-CN.json, zh-TW.json, es.json, de.json, fr.json

# Step 3: TypeScriptサーバーを再起動
# VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Step 4: ビルドして確認
cd docker/nextjs
npm run build
```

### 2. 言語切り替えのテスト

```bash
# Chrome DevTools MCPを使用
mcp_chrome_devtool_take_snapshot()

# 言語ドロップダウンをクリック
mcp_chrome_devtool_click({ uid: "language_dropdown_uid" })

# 韓国語を選択
mcp_chrome_devtool_click({ uid: "korean_option_uid" })

# スナップショットを取得して確認
mcp_chrome_devtool_take_snapshot()
```

### 3. 翻訳の一貫性を保つ

**翻訳管理ツールを使用**:
- Google Sheets: 全言語の翻訳を一元管理
- i18n-ally (VSCode拡張): 翻訳ファイルの編集・管理

**命名規則を統一**:
- camelCase: `noModelSelected`, `availableModels`
- 階層構造: `model.selector.title`

---

## Pitfalls（落とし穴）

### 1. i18n.tsの配置場所

**❌ 間違い**: `src/i18n.ts`に配置
**✅ 正しい**: プロジェクトルートの`i18n.ts`に配置

### 2. useLocaleの忘れ

**❌ 間違い**: useLocaleを使用せず、useMemoの依存配列にlocaleを追加しない
**✅ 正しい**: useLocaleを使用し、useMemoの依存配列にlocaleを追加

### 3. middlewareの処理順序

**❌ 間違い**: intlMiddlewareを先に実行してから、ロケールなしパスを処理
**✅ 正しい**: ロケールなしパスを先に処理してから、intlMiddlewareを実行

### 4. nullチェックの忘れ

**❌ 間違い**: `if ('status' in response)`
**✅ 正しい**: `if (response && 'status' in response)`

### 5. 推測でコーディング

**❌ 間違い**: APIレスポンス構造を推測してコーディング
**✅ 正しい**: Chrome DevTools MCPで実際のレスポンス構造を確認してから実装

---

## 参考資料

- [Next.js 15 Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Chrome DevTools MCP Debugging Guide](./chrome-devtools-mcp-debugging-guide.md)
- [TypeScript Type Safety Debugging Rules](./.kiro/steering/typescript-type-safety-debugging-rules.md)
- [Next.js Routing Middleware Rules](./.kiro/steering/nextjs-routing-middleware-rules.md)

---

**最終更新**: 2026-01-06  
**作成者**: Development Team
