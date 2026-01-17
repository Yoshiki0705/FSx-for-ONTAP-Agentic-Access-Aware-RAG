# FAQ - よくある質問

## 📖 目次

- [一般的な質問](#一般的な質問)
- [サインインと認証](#サインインと認証)
- [チャットボットの使用](#チャットボットの使用)
- [モデルとリージョン](#モデルとリージョン)
- [アクセシビリティ](#アクセシビリティ)
- [トラブルシューティング](#トラブルシューティング)

---

## 一般的な質問

### Q: このシステムは何ができますか？

A: Permission-aware RAG Systemは、Amazon Bedrockを使用したAIチャットボットシステムです。以下の機能を提供します：

- 複数のAIモデルとの会話
- グローバルリージョンでの利用
- 権限ベースの文書検索
- 多言語対応（8言語）
- アクセシビリティ対応

### Q: 無料で使用できますか？

A: システムの使用には、AWSアカウントとAmazon Bedrockへのアクセスが必要です。使用料金は、選択したモデルとリージョン、使用量によって異なります。詳細は[AWS料金ページ](https://aws.amazon.com/bedrock/pricing/)を参照してください。

### Q: どのブラウザに対応していますか？

A: 以下のモダンブラウザに対応しています：

- Google Chrome（最新版）
- Mozilla Firefox（最新版）
- Safari（最新版）
- Microsoft Edge（最新版）

### Q: モバイルデバイスで使用できますか？

A: はい、レスポンシブデザインにより、スマートフォンやタブレットでも快適に使用できます。

---

## サインインと認証

### Q: テストアカウントはありますか？

A: はい、以下のテストアカウントが利用可能です：

- **テストユーザー**: `testuser` / `Test1234!`
- **管理者**: `admin` / `Admin1234!`
- **複数テストユーザー**: `testuser0` ～ `testuser49`

### Q: パスワードを忘れました

A: 現在のバージョンでは、パスワードリセット機能は実装されていません。管理者に連絡してパスワードをリセットしてもらってください。

### Q: 自分のアカウントを作成できますか？

A: 現在のバージョンでは、ユーザー登録機能は実装されていません。管理者がアカウントを作成する必要があります。

### Q: セッションはいつまで有効ですか？

A: セッションは24時間有効です。24時間後、または明示的にサインアウトすると、再度サインインが必要になります。

---

## チャットボットの使用

### Q: どのAIモデルが利用できますか？

A: 以下のモデルが利用可能です（リージョンによって異なります）：

**Amazon Nova シリーズ**:
- Nova Micro（高速・軽量）
- Nova Lite（バランス型）
- Nova Pro（高性能）

**Claude シリーズ**:
- Claude 3.5 Sonnet v2（最新・高性能）
- Claude 3.5 Haiku（高速）
- Claude 3 Opus（最高性能）

**その他**:
- Mistral Large 2
- Llama 3.1/3.2/3.3 シリーズ
- AI21 Jamba シリーズ
- Cohere Command R/R+

### Q: どのモデルを選べばいいですか？

A: 用途によって推奨モデルが異なります：

- **簡単な質問**: Nova Micro（高速）
- **一般的な質問**: Nova Pro（バランス）
- **複雑な質問**: Claude 3.5 Sonnet v2（高性能）
- **コスト重視**: Nova Micro（低コスト）

### Q: 会話履歴はどこに保存されますか？

A: 会話履歴はAmazon DynamoDBに安全に保存されます。ユーザーごとに分離されており、他のユーザーからはアクセスできません。

### Q: 会話履歴を削除できますか？

A: はい、左サイドバーの会話履歴から、削除したい会話にマウスをホバーし、削除アイコンをクリックすることで削除できます。

### Q: 会話履歴をエクスポートできますか？

A: 現在のバージョンでは、エクスポート機能は実装されていません。将来のバージョンで追加される予定です。

### Q: 画像や添付ファイルを送信できますか？

A: 現在のバージョンでは、テキストメッセージのみ対応しています。画像や添付ファイルの送信機能は将来のバージョンで追加される予定です。

---

## モデルとリージョン

### Q: どのリージョンが利用できますか？

A: 以下のリージョンが利用可能です：

**アジア太平洋**:
- 東京（ap-northeast-1）
- ソウル（ap-northeast-2）
- シンガポール（ap-southeast-1）
- シドニー（ap-southeast-2）
- ムンバイ（ap-south-1）

**北米**:
- バージニア北部（us-east-1）
- オレゴン（us-west-2）

**ヨーロッパ**:
- フランクフルト（eu-central-1）
- アイルランド（eu-west-1）
- ロンドン（eu-west-2）
- パリ（eu-west-3）

**南米**:
- サンパウロ（sa-east-1）

### Q: リージョンによって何が違いますか？

A: リージョンによって以下が異なります：

1. **利用可能なモデル**: リージョンによって利用できるモデルが異なります
2. **レイテンシ**: 地理的に近いリージョンの方が応答が速い
3. **料金**: リージョンによって料金が異なる場合があります
4. **データ主権**: データが保存される地理的な場所

### Q: どのリージョンを選べばいいですか？

A: 以下の基準で選択してください：

- **レイテンシ重視**: 地理的に近いリージョン（日本なら東京）
- **モデル重視**: 使いたいモデルが利用可能なリージョン
- **コンプライアンス**: データ主権要件に準拠したリージョン

### Q: リージョンを変更すると会話履歴は消えますか？

A: いいえ、会話履歴はリージョンに依存しません。どのリージョンを選択しても、同じ会話履歴にアクセスできます。

---

## アクセシビリティ

### Q: スクリーンリーダーに対応していますか？

A: はい、以下のスクリーンリーダーに対応しています：

- NVDA（Windows）
- JAWS（Windows）
- VoiceOver（macOS/iOS）
- TalkBack（Android）

### Q: キーボードだけで操作できますか？

A: はい、すべての機能がキーボードで操作可能です。主なショートカット：

- `Tab`: 次の要素に移動
- `Shift + Tab`: 前の要素に移動
- `Enter`: ボタンやリンクを実行
- `Esc`: モーダルやドロップダウンを閉じる
- `Ctrl/Cmd + Enter`: メッセージ送信
- `Ctrl/Cmd + N`: 新規会話開始

### Q: ダークモードはありますか？

A: はい、ダークモードに対応しています。ヘッダー右上のテーマトグルボタンで切り替えられます。また、システムの設定に応じて自動的に切り替わります。

### Q: フォントサイズを変更できますか？

A: ブラウザのズーム機能を使用してフォントサイズを変更できます：

- 拡大: `Ctrl/Cmd + +`
- 縮小: `Ctrl/Cmd + -`
- リセット: `Ctrl/Cmd + 0`

---

## トラブルシューティング

### Q: サインインできません

A: 以下を確認してください：

1. ユーザー名とパスワードが正しいか
2. Caps Lockがオンになっていないか
3. ブラウザのCookieが有効か
4. インターネット接続が正常か

### Q: メッセージが送信できません

A: 以下を試してください：

1. インターネット接続を確認
2. ブラウザのコンソールでエラーを確認
3. ページをリロード（`Ctrl/Cmd + Shift + R`）
4. 別のブラウザで試す

### Q: AIからの応答が遅いです

A: 以下を試してください：

1. 地理的に近いリージョンを選択
2. より高速なモデル（Nova Micro）を選択
3. ネットワーク接続を確認
4. ブラウザのキャッシュをクリア

### Q: ページが正しく表示されません

A: 以下を試してください：

1. ブラウザのキャッシュをクリア
2. ページを強制リロード（`Ctrl/Cmd + Shift + R`）
3. ブラウザを最新版に更新
4. 別のブラウザで試す

### Q: ダークモードが切り替わりません

A: 以下を試してください：

1. ブラウザのJavaScriptが有効か確認
2. ローカルストレージをクリア
3. ページをリロード
4. ブラウザを再起動

### Q: 言語が切り替わりません

A: 以下を試してください：

1. ページをリロード
2. ブラウザのCookieを確認
3. 別のブラウザで試す

### Q: エラーメッセージが表示されます

A: エラーメッセージの内容によって対処方法が異なります：

- **認証エラー**: サインインし直す
- **ネットワークエラー**: インターネット接続を確認
- **モデルエラー**: 別のモデルやリージョンを試す
- **その他のエラー**: ページをリロードして再試行

---

---

## Amazon Bedrock AgentCore

### Q: AgentCore機能とは何ですか？

A: AgentCore機能は、Amazon Bedrock Agentの高度な機能を提供するモジュラーシステムです。以下の4つのコアコンポーネントで構成されています：

1. **Runtime**: イベント駆動実行とスケーリング
2. **Gateway**: REST API/Lambda/MCPサーバー統合
3. **Memory**: フルマネージドメモリ管理
4. **Identity**: 認証・認可（RBAC/ABAC）

### Q: AgentCore Runtimeは何ができますか？

A: Runtime Constructは、Bedrock Agentのイベント駆動実行とスケーリングを管理します：

- **Lambda統合**: Node.js 22.x Lambda関数による実行
- **EventBridge統合**: 非同期イベント処理
- **自動スケーリング**: Reserved/Provisioned Concurrency
- **KMS暗号化**: 環境変数の暗号化

### Q: AgentCore Gatewayは何ができますか？

A: Gateway Constructは、外部APIをBedrock Agent Toolに変換します：

- **REST API変換**: OpenAPI仕様からTool定義を生成
- **Lambda関数変換**: Lambda関数メタデータからTool定義を生成
- **MCPサーバー統合**: MCP Tool定義をBedrock Agent Toolに変換

### Q: AgentCore Memoryは何ができますか？

A: Memory Constructは、Bedrock Agentのフルマネージドメモリ機能を提供します：

- **Memory Resource**: フルマネージドメモリリソース
- **Memory Strategies**: Semantic, Summary, User Preference
- **短期メモリ**: 会話履歴（Events）
- **長期メモリ**: 重要情報の自動抽出（Records）

### Q: AgentCore Identityは何ができますか？

A: Identity Constructは、エージェントID管理とアクセス制御を提供します：

- **エージェントID管理**: 一意のエージェントIDの生成・管理
- **RBAC**: ロールベースアクセス制御（Admin, User, ReadOnly）
- **ABAC**: 属性ベースアクセス制御（部署、プロジェクト、機密度）

### Q: RBACとABACの違いは何ですか？

A: RBACとABACは、異なるアクセス制御モデルです：

**RBAC（ロールベースアクセス制御）**:
- ロール（Admin, User, ReadOnly）に基づいてアクセスを制御
- シンプルで管理しやすい
- 静的な権限管理

**ABAC（属性ベースアクセス制御）**:
- 属性（部署、プロジェクト、機密度）に基づいてアクセスを制御
- 柔軟で細かい制御が可能
- 動的な権限管理

### Q: Memory Strategiesとは何ですか？

A: Memory Strategiesは、Bedrock Agentのメモリ管理戦略です：

**Semantic Strategy**:
- 会話履歴から重要な情報を自動抽出
- エピソード記憶として保存
- 会話の文脈理解に使用

**Summary Strategy**:
- 会話を要約し、重要なポイントを保存
- 長い会話の要約に使用
- 会話の主要トピックの抽出

**User Preference Strategy**:
- ユーザーの好みや設定を学習
- パーソナライズされた応答に使用
- ユーザー固有の設定の保存

### Q: OpenAPI仕様からTool定義を生成する方法は？

A: Gateway Constructを使用して、OpenAPI仕様から自動的にTool定義を生成できます：

1. **OpenAPI仕様を準備**:
```yaml
openapi: 3.0.0
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

2. **S3にアップロード**:
```bash
aws s3 cp openapi.yaml s3://my-bucket/openapi.yaml
```

3. **Gateway Constructを設定**:
```typescript
const gateway = new BedrockAgentCoreGatewayConstruct(this, 'Gateway', {
  enabled: true,
  restApiConfig: {
    enabled: true,
    openApiSpecPath: 's3://my-bucket/openapi.yaml',
  },
});
```

4. **Tool定義が自動生成される**:
```json
{
  "name": "get_users_userId",
  "description": "Get user by ID",
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" }
    },
    "required": ["userId"]
  }
}
```

### Q: エージェントIDの形式は？

A: エージェントIDは以下の形式で生成されます：

```
agent-{timestamp}-{random}
```

例: `agent-1234567890-abc123`

### Q: 機密度レベルの階層は？

A: 機密度レベルは以下の階層構造になっています：

```
public < internal < confidential < secret
```

例えば、`secret`レベルのエージェントは、`confidential`、`internal`、`public`レベルのリソースにアクセスできます。

### Q: AgentCore機能のトラブルシューティング方法は？

A: 以下の方法でトラブルシューティングできます：

1. **CloudWatch Logsの確認**:
```bash
aws logs tail /aws/lambda/my-function --follow
```

2. **Lambda関数の環境変数を確認**:
```bash
aws lambda get-function-configuration \
  --function-name my-function \
  --query 'Environment'
```

3. **DynamoDBテーブルの確認**:
```bash
aws dynamodb describe-table \
  --table-name agent-identity
```

4. **詳細ドキュメントを参照**:
- [Bedrock AgentCore実装ガイド](./bedrock-agentcore-implementation-guide.md)

---

## 📚 さらに詳しく

より詳細な情報は、以下のガイドを参照してください：

- **[クイックスタートガイド](./quick-start.md)**: 基本的な使い方
- **[UI/UXガイド](./ui-ux-guide.md)**: 詳細な機能説明
- **[セキュリティガイド](./security-guide.md)**: セキュリティのベストプラクティス

---

## 🤝 サポート

この FAQで解決しない問題がある場合は、以下の方法でサポートを受けられます：

1. **GitHub Issues**: バグ報告や機能リクエスト
2. **ドキュメント**: 詳細なガイドを参照
3. **コミュニティ**: ディスカッションで質問

---

**最終更新**: 2025年11月18日
