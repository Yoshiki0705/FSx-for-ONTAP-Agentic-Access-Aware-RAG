# ローカル開発ガイド

AWS環境（Cognito / DynamoDB / Bedrock）なしで、Next.jsアプリケーションのUIを検証・開発するための手順です。

認証ミドルウェア（JWT検証・CSRF保護・i18nルーティング）はバイパスせず、本番と同じフローで動作します。

---

## 前提条件

| ツール | バージョン | 確認コマンド |
|--------|-----------|-------------|
| Node.js | 22以上 | `node -v` |
| npm | 10以上 | `npm -v` |

Docker は必須ではありません（Docker を使う方法も後述します）。

---

## 方法1: npm run dev（最もシンプル）

### 1. 依存関係のインストール

```bash
cd docker/nextjs
npm install
```

### 2. 環境変数の準備

```bash
cp .env.development .env.local
```

`.env.local` は Git に追跡されません。中身はすべて公開可能なダミー値です。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### 4. サインイン

ミドルウェアが自動的にサインインページ（`/ja/signin`）にリダイレクトします。以下のデモユーザーでログインしてください。

| ユーザー名 | パスワード | ロール | 権限 |
|-----------|-----------|--------|------|
| `admin` | `admin123` | administrator | 全権限 |
| `developer` | `dev123` | developer | 読み書き + Agent作成 |
| `user` | `user123` | user | 読み取りのみ |

### 仕組み

```
ブラウザ → http://localhost:3000
  ↓ ミドルウェア: JWTなし → /ja/signin にリダイレクト
  ↓ サインインフォーム送信
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID 未設定 → デモユーザーで認証
  ↓   JWT発行 → session-token Cookie設定
  ↓ ミドルウェア: JWT検証OK → ページ表示
```

Cognito や DynamoDB には一切接続しません。JWT の署名・検証は本番と同じ `jose` ライブラリで行われるため、ミドルウェアの認証フローは完全に本番同等です。

### 制限事項

| 機能 | 状態 | 理由 |
|------|------|------|
| サインイン・サインアウト | ✅ 動作 | JWT発行・Cookie管理のみ |
| ページ遷移・認証ガード | ✅ 動作 | ミドルウェアのJWT検証 |
| 言語切り替え | ✅ 動作 | next-intl（8言語） |
| ダークモード | ✅ 動作 | Zustand + localStorage |
| カードUI・レイアウト | ✅ 動作 | 静的コンポーネント |
| RAG検索（KB/Agent） | ❌ 不可 | Bedrock接続が必要 |
| セッション永続化 | ❌ 不可 | DynamoDB接続が必要 |
| ユーザー権限（SID） | ❌ 不可 | DynamoDB + FSx連携が必要 |

> セッション永続化が必要な場合は、方法2（Docker Compose + DynamoDB Local）を使用してください。

---

## 方法2: Docker Compose（DynamoDB Local付き）

DynamoDB Local を使ってセッション永続化も含めた検証を行う方法です。

### 前提条件（追加）

- Docker / Docker Compose

### 1. 起動

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

以下が自動的に起動します:

| サービス | ポート | 説明 |
|---------|--------|------|
| app | 3000 | Next.js 開発サーバー（ホットリロード対応） |
| dynamodb-local | 8000 | DynamoDB Local（インメモリ） |
| dynamodb-setup | — | セッションテーブル自動作成（起動時のみ） |

### 2. アクセス

http://localhost:3000 を開き、方法1と同じデモユーザーでサインインします。

### 3. 停止

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local はインメモリモードのため、停止するとセッションデータは消えます。

---

## サインインページの機能

サインインページには以下のコントロールがあります:

- 言語セレクター（右上）: 8言語を切り替え可能。選択した言語はサインイン後の画面に引き継がれます。
- ダークモードトグル（右上）: ライト/ダークを切り替え。サインイン後も維持されます。

---

## モード切り替えと言語・テーマの継承

| 遷移 | 言語 | テーマ |
|------|------|--------|
| サインイン → メイン画面 | ✅ URLロケール維持 | ✅ localStorage維持 |
| KBモード ↔ Agentモード | ✅ URLロケール維持 | ✅ localStorage維持 |
| メイン画面 → Agent一覧 | ✅ URLロケール維持 | ✅ localStorage維持 |
| Agent一覧 → KBモード | ✅ URLロケール維持 | ✅ localStorage維持 |

言語はURLのロケールプレフィックス（`/en/genai`, `/ja/genai` 等）で管理されるため、どの画面遷移でも維持されます。テーマは Zustand ストア（localStorage 永続化）で全ページ共有です。

---

## トラブルシューティング

### ポート3000が使用中

```bash
lsof -i :3000
kill -9 <PID>
```

### サインインできない

`.env.local` が存在し、`COGNITO_CLIENT_ID` が設定されていないことを確認してください。設定されているとCognito認証が試行されて失敗します。

```bash
# 確認
grep COGNITO_CLIENT_ID .env.local
# → 何も出力されなければOK
```

### 前回のセッションが残ってサインインページに行けない

ブラウザの Cookie（`session-token`）を削除するか、シークレットウィンドウで開いてください。

### `Module not found` エラー

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## ファイル構成

```
docker/nextjs/
├── .env.development          # 開発用環境変数（Git追跡対象、安全な値のみ）
├── .env.local                # ローカル上書き（Git追跡外、.env.developmentのコピー）
├── docker-compose.dev.yml    # Docker Compose（DynamoDB Local付き）
├── Dockerfile.dev            # 開発用Dockerfile
├── src/
│   ├── middleware.ts          # 認証ミドルウェア（JWT検証・CSRF・i18n）
│   └── app/api/auth/signin/
│       └── route.ts           # サインインAPI（デモ認証フォールバック付き）
└── messages/                  # 翻訳ファイル（8言語）
```
