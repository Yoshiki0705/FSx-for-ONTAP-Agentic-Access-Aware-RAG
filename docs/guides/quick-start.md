# クイックスタートガイド - Permission-aware RAG System

## 🚀 はじめに

このガイドでは、Permission-aware RAG Systemを初めて使用する方向けに、基本的な使い方を説明します。

## 📝 目次

1. [サインイン](#サインイン)
2. [チャットボットの基本操作](#チャットボットの基本操作)
3. [モデルとリージョンの選択](#モデルとリージョンの選択)
4. [会話履歴の管理](#会話履歴の管理)
5. [設定のカスタマイズ](#設定のカスタマイズ)

---

## サインイン

### 1. サインインページにアクセス

ブラウザでシステムのURLにアクセスします。

### 2. 言語を選択（オプション）

ページ右上の言語セレクターから、希望の言語を選択できます。

**対応言語**:
- 🇯🇵 日本語
- 🇺🇸 英語
- 🇨🇳 中国語（簡体字・繁体字）
- 🇰🇷 韓国語
- 🇪🇸 スペイン語
- 🇫🇷 フランス語
- 🇩🇪 ドイツ語

### 3. 認証情報を入力

**テストユーザー**:
- ユーザー名: `testuser`
- パスワード: `Test1234!`

**管理者**:
- ユーザー名: `admin`
- パスワード: `Admin1234!`

### 4. サインインボタンをクリック

認証が成功すると、チャットボットページにリダイレクトされます。

---

## チャットボットの基本操作

### メッセージの送信

1. 画面下部のテキスト入力欄にメッセージを入力
2. `Enter`キーを押すか、送信ボタンをクリック
3. AIからの応答を待つ

**ショートカット**:
- `Ctrl/Cmd + Enter`: メッセージ送信

### 新しい会話の開始

1. 左サイドバーの「新しい会話」ボタンをクリック
2. または、`Ctrl/Cmd + N`を押す

### 会話の切り替え

1. 左サイドバーの会話履歴から、表示したい会話をクリック
2. 選択した会話の内容が表示されます

---

## モデルとリージョンの選択

### AIモデルの選択

1. チャット画面上部のモデルセレクターをクリック
2. 利用可能なモデルのリストから選択

**推奨モデル**:
- **Nova Pro**: バランスの取れた高性能モデル
- **Claude 3.5 Sonnet v2**: 最新の高性能モデル
- **Nova Micro**: 高速・軽量モデル

### リージョンの選択

1. チャット画面上部のリージョンセレクターをクリック
2. 希望のリージョンを選択

**主要リージョン**:
- **東京** (ap-northeast-1): 日本国内での低レイテンシ
- **バージニア北部** (us-east-1): 最も多くのモデルが利用可能
- **フランクフルト** (eu-central-1): ヨーロッパでの低レイテンシ

**注意**: リージョンによって利用可能なモデルが異なります。

---

## 会話履歴の管理

### 会話の検索

1. 左サイドバー上部の検索ボックスにキーワードを入力
2. 該当する会話がフィルタリングされます

### 会話の削除

1. 削除したい会話にマウスをホバー
2. 表示される削除アイコンをクリック
3. 確認ダイアログで「削除」をクリック

### 会話のエクスポート（準備中）

将来のバージョンで、会話履歴をエクスポートする機能が追加される予定です。

---

## 設定のカスタマイズ

### ダークモードの切り替え

1. ヘッダー右上のテーマトグルボタン（月/太陽アイコン）をクリック
2. ダークモード/ライトモードが切り替わります

**自動切り替え**: システムの設定に応じて自動的に切り替わります。

### 言語の変更

1. ヘッダーの言語セレクターをクリック
2. 希望の言語を選択
3. UI要素が即座に選択した言語で表示されます

### キーボードショートカットの確認

1. `Ctrl/Cmd + /`を押す
2. 利用可能なショートカット一覧が表示されます

---

---

## Amazon Bedrock AgentCore機能

### AgentCore Runtimeの使用

#### 5分で始めるRuntime機能

1. **CDK設定ファイルを編集**

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true
    }
  }
}
```

2. **CDKデプロイ**

```bash
npx cdk deploy --all
```

3. **動作確認**

```bash
# Lambda関数の確認
aws lambda list-functions --query 'Functions[?contains(FunctionName, `runtime`)].FunctionName'

# Lambda関数の実行
aws lambda invoke \
  --function-name my-project-prod-runtime-function \
  --payload '{"test": true}' \
  response.json
```

### AgentCore Gatewayの使用

#### 5分で始めるGateway機能

1. **OpenAPI仕様を準備**

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /users/{userId}:
    get:
      summary: Get user by ID
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
```

2. **S3にアップロード**

```bash
aws s3 cp openapi.yaml s3://my-bucket/openapi.yaml
```

3. **CDK設定ファイルを編集**

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "restApi": {
        "enabled": true,
        "openApiSpecPath": "s3://my-bucket/openapi.yaml"
      }
    }
  }
}
```

4. **CDKデプロイ**

```bash
npx cdk deploy --all
```

### AgentCore Memoryの使用

#### 5分で始めるMemory機能

1. **CDK設定ファイルを編集**

```json
{
  "bedrockAgentCore": {
    "memory": {
      "enabled": true,
      "strategies": {
        "semantic": { "enabled": true },
        "summary": { "enabled": true }
      }
    }
  }
}
```

2. **CDKデプロイ**

```bash
npx cdk deploy --all
```

3. **Memory APIの使用**

```typescript
// イベント書き込み
await memoryClient.writeEvent({
  memoryId: 'memory-123',
  sessionId: 'session-456',
  event: {
    type: 'user_message',
    content: 'こんにちは',
  },
});

// 短期メモリ取得
const events = await memoryClient.getLastKTurns({
  memoryId: 'memory-123',
  sessionId: 'session-456',
  k: 10,
});
```

### AgentCore Identityの使用

#### 5分で始めるIdentity機能

1. **CDK設定ファイルを編集**

```json
{
  "bedrockAgentCore": {
    "identity": {
      "enabled": true,
      "rbac": { "enabled": true },
      "abac": { "enabled": true }
    }
  }
}
```

2. **CDKデプロイ**

```bash
npx cdk deploy --all
```

3. **エージェントID作成**

```bash
# Lambda関数経由でエージェントIDを作成
aws lambda invoke \
  --function-name my-project-prod-identity-function \
  --payload '{
    "action": "create",
    "role": "User",
    "attributes": {
      "department": "engineering",
      "project": "rag-system"
    }
  }' \
  response.json

# レスポンスを確認
cat response.json
```

4. **権限チェック**

```bash
# 権限チェック
aws lambda invoke \
  --function-name my-project-prod-identity-function \
  --payload '{
    "action": "checkPermission",
    "agentId": "agent-1234567890-abc123",
    "permission": "bedrock:InvokeAgent"
  }' \
  response.json
```

---

## 💡 ヒントとコツ

### 効果的な質問の仕方

1. **具体的に質問する**: 「Pythonでファイルを読み込む方法」より「Pythonでテキストファイルを1行ずつ読み込む方法」
2. **コンテキストを提供する**: 「エラーが出ます」より「Pythonでファイルを開こうとすると FileNotFoundError が出ます」
3. **段階的に質問する**: 複雑な問題は、小さな質問に分けて聞く

### モデルの使い分け

- **Nova Micro**: 簡単な質問、高速な応答が必要な場合
- **Nova Pro**: 一般的な質問、バランスの取れた性能
- **Claude 3.5 Sonnet v2**: 複雑な質問、高度な推論が必要な場合

### リージョンの選択基準

- **レイテンシ重視**: 地理的に近いリージョンを選択
- **モデル重視**: 使いたいモデルが利用可能なリージョンを選択
- **コスト重視**: リージョンによって料金が異なる場合があります

---

## 🆘 トラブルシューティング

### サインインできない

1. ユーザー名とパスワードを確認
2. Caps Lockがオンになっていないか確認
3. ブラウザのCookieが有効か確認

### メッセージが送信できない

1. インターネット接続を確認
2. ブラウザのコンソールでエラーを確認
3. ページをリロード

### AIからの応答が遅い

1. 選択しているリージョンを確認（地理的に近いリージョンを選択）
2. 選択しているモデルを確認（Nova Microは高速）
3. ネットワーク接続を確認

### ページが正しく表示されない

1. ブラウザのキャッシュをクリア
2. ページを強制リロード（`Ctrl/Cmd + Shift + R`）
3. 別のブラウザで試す

---

## 📚 次のステップ

基本的な使い方を理解したら、以下のガイドも参照してください：

- **[UI/UXガイド](./ui-ux-guide.md)**: より詳細な機能説明
- **[FAQ](./faq.md)**: よくある質問と回答
- **[セキュリティガイド](./security-guide.md)**: セキュリティのベストプラクティス

---

## 🤝 サポート

問題が解決しない場合は、以下の方法でサポートを受けられます：

1. **GitHub Issues**: バグ報告や機能リクエスト
2. **ドキュメント**: 詳細なガイドを参照
3. **コミュニティ**: ディスカッションで質問

---

**最終更新**: 2025年11月18日
