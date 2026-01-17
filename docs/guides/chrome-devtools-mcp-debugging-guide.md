# Chrome DevTools MCP デバッグガイド

**作成日**: 2026-01-04  
**対象**: Next.js + Lambda Web Adapter環境でのデバッグ  
**ツール**: Chrome DevTools MCP

---

## 🎯 目的

このガイドは、Chrome DevTools MCPを使用した効果的なデバッグ手法を提供します。言語切り替え機能復旧とAgentモード切り替えエラー対応の実践から抽出された知見に基づいています。

---

## 📋 基本原則

### 原則1: 推測でコーディングしない

**❌ 悪い例**:
```typescript
// APIレスポンスの構造を推測
const userData = data.session.user;     // 存在しないフィールド
const status = response.status;         // responseがnullの可能性
if ('status' in response) {             // responseがnullの場合エラー
  // ...
}
```

**✅ 良い例**:
```typescript
// Chrome DevTools MCPで実際の構造を確認してから実装
// 1. Network Requestsでレスポンスを確認
// 2. 実際のレスポンス構造を確認
// 3. その構造に基づいて実装

const userData = {
  username: data.session.username,  // 実際に存在するフィールド
  userId: data.session.userId,      // 実際に存在するフィールド
  role: 'user'
};

// nullチェックを追加
if (response && 'status' in response) {
  const status = response.status;
}
```

### 原則2: デプロイ後は必ずChrome DevTools MCPで検証

**検証項目**:
- ✅ Console Logsにエラーがない
- ✅ Network Requestsに異常なリダイレクトがない
- ✅ APIレスポンスが期待通りの構造
- ✅ ページコンテンツが正しく表示される

### 原則3: エラーログから根本原因を特定

**エラーログの読み方**:
```javascript
// エラー例:
Uncaught TypeError: Cannot use 'in' operator to search for 'status' in null
at U (page-8f539e1940ee8cad.js:1:25097)

// 読み取れる情報:
// 1. エラータイプ: TypeError
// 2. 原因: 'in' operatorをnullに対して使用
// 3. 問題のプロパティ: 'status'
// 4. 発生場所: page-8f539e1940ee8cad.js:1:25097

// 対策:
// 1. Chrome DevTools MCPでAPIレスポンスを確認
// 2. responseがnullを返していることを確認
// 3. nullチェックを追加
```

---

## 🔧 Chrome DevTools MCP活用パターン

### パターン1: APIレスポンス構造の確認

**使用場面**:
- APIレスポンスを扱うコードを実装する前
- 型エラー「Cannot use 'in' operator to search for 'X' in null」が発生した場合
- 「Property 'X' does not exist on type 'Y'」エラーが発生した場合

**手順**:

```typescript
// Step 1: ページにアクセス
mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/ja/genai",
  ignoreCache: true
})

// Step 2: Network Requestsを確認
mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["xhr", "fetch"]
})

// Step 3: 特定のリクエストの詳細を確認
mcp_chrome_devtool_get_network_request({
  reqid: 123  // Step 2で取得したreqid
})

// Step 4: レスポンス構造を確認
// - responseBodyを確認
// - statusCodeを確認
// - headersを確認

// Step 5: 実際の構造に基づいて実装
```

**実践例（Agentモード切り替えエラー）**:

```typescript
// エラー: Cannot use 'in' operator to search for 'status' in null

// Step 1: Network Requestsでモード切り替えAPIを確認
const requests = await mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["xhr", "fetch"]
})

// Step 2: モード切り替えAPIのreqidを特定
// 例: reqid: 456

// Step 3: レスポンスの詳細を確認
const response = await mcp_chrome_devtool_get_network_request({
  reqid: 456
})

// Step 4: レスポンスがnullを返していることを確認
// responseBody: null

// Step 5: nullチェックを追加して修正
if (response && typeof response === 'object' && 'status' in response) {
  const status = response.status;
} else {
  console.error('Invalid response:', response);
  // エラーハンドリング
}
```

### パターン2: Console Logsでの動作確認

**使用場面**:
- ページの動作を確認する場合
- ロケール検出の動作を確認する場合
- イベントリスナーの動作を確認する場合

**手順**:

```typescript
// Step 1: ページにアクセス
mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/en/genai",
  ignoreCache: true
})

// Step 2: Console Logsを確認
mcp_chrome_devtool_list_console_messages({
  pageSize: 50
})

// Step 3: ログから動作を確認
// 例: [LanguageSwitcher] Mounted with currentLocale: en
// 例: [i18n/request] requestLocaleから取得: en

// Step 4: 期待通りの動作か確認
// ✅ 正常: currentLocale が en
// ❌ 異常: currentLocale が ja（URLは /en/genai なのに）
```

**実践例（言語切り替え機能）**:

```typescript
// 問題: URLが /en/genai でも、useLocale() が 'ja' を返す

// Step 1: 英語ページにアクセス
await mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/en/genai",
  ignoreCache: true
})

// Step 2: Console Logsを確認
const logs = await mcp_chrome_devtool_list_console_messages({
  pageSize: 50
})

// Step 3: ログから問題を特定
// [LanguageSwitcher] Mounted with currentLocale: ja  ← 問題！
// [i18n/request] requestLocaleから取得: ja          ← URLのロケールが無視されている

// Step 4: HTTPヘッダーを確認するログを追加
// [i18n/request] Headers確認: {...}

// Step 5: HTTPヘッダーからロケールを取得する実装を追加
```

### パターン3: Network Requestsでのループ検出

**使用場面**:
- サインインループが発生している場合
- 無限リダイレクトが発生している場合
- ページが正常に表示されない場合

**手順**:

```typescript
// Step 1: サインインを実行
await mcp_chrome_devtool_fill_form({
  elements: [
    { uid: "username_field", value: "admin" },
    { uid: "password_field", value: "admin123" }
  ]
})
await mcp_chrome_devtool_click({ uid: "signin_button" })

// Step 2: Network Requestsを確認
const requests = await mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["document"]
})

// Step 3: リダイレクトループを検出
// ✅ 正常: /signin へのリクエストが0回
// ❌ 異常: /signin へのリクエストが複数回

// Step 4: 307リダイレクトを確認
// 例: GET /signin?_rsc=plmlv [307 Redirect]
// 例: GET /ja/signin [200 OK]
// 例: GET /signin?_rsc=plmlv [307 Redirect] ← ループ！
```

**実践例（サインインループ）**:

```typescript
// 問題: サインイン成功後、/ja/chatbot と /ja/signin の間でループ

// Step 1: サインインを実行
// ...

// Step 2: Network Requestsを確認
const requests = await mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["document"]
})

// Step 3: ループを検出
// GET /ja/signin                    [200 OK]
// POST /api/auth/signin             [200 OK]
// GET /ja/chatbot                   [200 OK]
// GET /signin?_rsc=plmlv            [307 Redirect] ← ループの兆候
// GET /ja/signin                    [200 OK]
// GET /signin?_rsc=plmlv            [307 Redirect] ← ループ確定

// Step 4: ミドルウェアで /signin を明示的に処理
if (pathname === '/signin') {
  const locale = localeCookie || 'ja';
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/signin`;
  return NextResponse.redirect(url);
}
```

### パターン4: ページコンテンツの確認

**使用場面**:
- ページが正しく表示されているか確認する場合
- 言語切り替えが正常に動作しているか確認する場合
- UIコンポーネントの状態を確認する場合

**手順**:

```typescript
// Step 1: ページにアクセス
await mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/en/genai",
  ignoreCache: true
})

// Step 2: ページスナップショットを取得
const snapshot = await mcp_chrome_devtool_take_snapshot()

// Step 3: コンテンツを確認
// 例: uid=54_81 button "🇺🇸 English"
// 例: uid=54_86 StaticText "Hello, admin!"

// Step 4: 期待通りの表示か確認
// ✅ 正常: 言語ボタンが "🇺🇸 English"
// ✅ 正常: ページコンテンツが英語
// ❌ 異常: 言語ボタンが "🇯🇵 日本語"（URLは /en/genai なのに）
```

**実践例（言語切り替え機能）**:

```typescript
// 問題: URLが /en/genai でも、ページ内容が日本語

// Step 1: 英語ページにアクセス
await mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/en/genai",
  ignoreCache: true
})

// Step 2: ページスナップショットを取得
const snapshot = await mcp_chrome_devtool_take_snapshot()

// Step 3: 言語ボタンを確認
// uid=54_81 button "🇯🇵 日本語" ← 問題！

// Step 4: ページコンテンツを確認
// uid=54_86 StaticText "こんにちは、adminさん！" ← 問題！

// Step 5: Console Logsと合わせて根本原因を特定
// [LanguageSwitcher] Mounted with currentLocale: ja
// → requestLocale が正しく動作していない
```

---

## 🎓 実践的なデバッグワークフロー

### ワークフロー1: 新機能実装時

```typescript
// Step 1: Chrome DevTools MCPでAPIレスポンスを確認
// - Network Requestsでレスポンス構造を確認
// - Console Logsでエラーを確認

// Step 2: 実際のレスポンス構造に基づいて実装
// - nullチェックを追加
// - 型定義を作成

// Step 3: ローカルでビルド・型チェック
// - npx tsc --noEmit

// Step 4: EC2にデプロイ
// - クリーンビルド
// - Docker Image検証
// - Lambda更新
// - CloudFrontキャッシュ無効化

// Step 5: Chrome DevTools MCPで検証
// - Console Logsにエラーがないか確認
// - Network Requestsに異常がないか確認
// - ページコンテンツが正しく表示されるか確認
```

### ワークフロー2: エラー発生時

```typescript
// Step 1: エラーログを確認
// - Console Logsでエラーメッセージを確認
// - エラータイプと原因を特定

// Step 2: Chrome DevTools MCPで根本原因を特定
// - Network Requestsでレスポンスを確認
// - Console Logsで動作を確認

// Step 3: 修正を実装
// - nullチェックを追加
// - 型定義を修正
// - エラーハンドリングを追加

// Step 4: デプロイ・検証
// - EC2にデプロイ
// - Chrome DevTools MCPで検証
```

### ワークフロー3: 言語切り替え機能のデバッグ

```typescript
// Step 1: 英語ページにアクセス
await mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/en/genai",
  ignoreCache: true
})

// Step 2: Console Logsを確認
const logs = await mcp_chrome_devtool_list_console_messages({
  pageSize: 50
})
// 確認項目:
// - [LanguageSwitcher] Mounted with currentLocale: en ← 正常
// - [i18n/request] requestLocaleから取得: en ← 正常

// Step 3: ページスナップショットを確認
const snapshot = await mcp_chrome_devtool_take_snapshot()
// 確認項目:
// - 言語ボタンが "🇺🇸 English" ← 正常
// - ページコンテンツが英語 ← 正常

// Step 4: 言語切り替えを実行
await mcp_chrome_devtool_click({ uid: "language_button" })
await mcp_chrome_devtool_click({ uid: "japanese_option" })

// Step 5: URLが変更されたことを確認
// /en/genai → /ja/genai

// Step 6: Console Logsを再確認
const logs2 = await mcp_chrome_devtool_list_console_messages({
  pageSize: 50
})
// 確認項目:
// - [LanguageSwitcher] Mounted with currentLocale: ja ← 正常

// Step 7: ページスナップショットを再確認
const snapshot2 = await mcp_chrome_devtool_take_snapshot()
// 確認項目:
// - 言語ボタンが "🇯🇵 日本語" ← 正常
// - ページコンテンツが日本語 ← 正常
```

---

## 📊 デバッグチェックリスト

### デプロイ後の必須チェック

- [ ] Console Logsにエラーがない
- [ ] Network Requestsに異常なリダイレクトがない
- [ ] APIレスポンスが期待通りの構造
- [ ] ページコンテンツが正しく表示される
- [ ] 言語切り替えが正常に動作する
- [ ] サインインが正常に動作する

### エラー発生時のチェック

- [ ] エラーログを確認
- [ ] Chrome DevTools MCPでAPIレスポンスを確認
- [ ] Chrome DevTools MCPでConsole Logsを確認
- [ ] Chrome DevTools MCPでNetwork Requestsを確認
- [ ] 根本原因を特定
- [ ] 修正を実装
- [ ] デプロイ・検証

### 言語切り替え機能のチェック

- [ ] 英語ページにアクセス
- [ ] Console Logsで currentLocale が en であることを確認
- [ ] 言語ボタンが "🇺🇸 English" と表示されることを確認
- [ ] ページコンテンツが英語であることを確認
- [ ] 日本語に切り替え
- [ ] URLが /ja/genai に変更されることを確認
- [ ] Console Logsで currentLocale が ja であることを確認
- [ ] 言語ボタンが "🇯🇵 日本語" と表示されることを確認
- [ ] ページコンテンツが日本語であることを確認

---

## 🔗 関連ドキュメント

- `.kiro/steering/nextjs-routing-middleware-rules.md` - Next.jsルーティング・ミドルウェアルール
- `.kiro/steering/typescript-type-safety-debugging-rules.md` - TypeScript型安全性ルール
- `.kiro/steering/consolidated-development-rules.md` - 統合開発ルール
- `development/docs/reports/local/01-04-language-switcher-fix-v6-completion-report.md` - 言語切り替え機能復旧完了レポート

---

**作成者**: Kiro AI  
**作成日**: 2026-01-04  
**ステータス**: アクティブ
