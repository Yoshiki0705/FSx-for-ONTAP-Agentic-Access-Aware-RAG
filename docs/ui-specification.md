# チャットボットUI仕様書

**作成日**: 2026-03-26  
**対象**: 開発者・運用者  
**アプリケーション**: Permission-aware RAG Chatbot

---

## 概要

本ドキュメントは、RAGチャットボットのUI各要素の仕様と、バックエンドとの連携を説明します。

---

## 1. サイドバー — ユーザー情報セクション

### 表示内容

| 項目 | データソース | 説明 |
|------|------------|------|
| ユーザー名 | Cognito JWT | サインイン時のメールアドレス |
| ロール | Cognito JWT | `admin` または `user` |

### アクセス権限表示

| 項目 | データソース | 説明 |
|------|------------|------|
| ディレクトリ | `/api/fsx/directories` | SIDベースのアクセス可能ディレクトリ |
| 読み取り | 同上 | SIDデータが存在すれば `✅` |
| 書き込み | 同上 | Domain Admins SIDを持つ場合のみ `✅` |

### アクセス可能ディレクトリの仕組み

Introduction Messageには3種類のディレクトリ情報が表示されます。

| 項目 | アイコン | データソース | 説明 |
|------|---------|------------|------|
| FSxアクセス可能ディレクトリ | 📁 | DynamoDB SID → SID_DIRECTORY_MAP | FSx ONTAP上でファイルレベルでアクセス可能なディレクトリ |
| RAG検索可能ディレクトリ | 🔍 | S3 `.metadata.json` のSID照合 | KB検索でSIDマッチするドキュメントのディレクトリ |
| Embedding対象ディレクトリ | 📚 | S3バケット内の全`.metadata.json` | KBにインデックスされている全ディレクトリ |

#### ユーザー別の表示例

| ユーザー | FSxアクセス | RAG検索 | Embedding対象 |
|---------|-----------|---------|-------------|
| admin@example.com | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/`（表示あり） |
| user@example.com | `public/` | `public/` | 非表示（セキュリティ上、アクセス不可ディレクトリの存在を隠す） |

一般ユーザーにはEmbedding対象ディレクトリは表示されません（アクセスできないディレクトリの存在を知らせないため）。管理者のようにRAG検索可能ディレクトリとEmbedding対象ディレクトリが同一の場合のみ、📚 Embedding対象ディレクトリが表示されます。

#### データ取得フロー

```
/api/fsx/directories?username={email}
  ↓
1. DynamoDB user-access → ユーザーSID取得
  ↓
2. FSxディレクトリ: SID → SID_DIRECTORY_MAP で計算
  ↓
3. RAG/Embeddingディレクトリ: S3バケットの.metadata.jsonをスキャン
   - 各ファイルの allowed_group_sids とユーザーSIDを照合
   - マッチ → RAGアクセス可能
   - 全ディレクトリ → Embedding対象
  ↓
4. 3種類のディレクトリ情報を返却
```

#### SIDとディレクトリのマッピング

| SID | 名前 | アクセス可能ディレクトリ |
|-----|------|----------------------|
| `S-1-1-0` | Everyone | `public/` |
| `S-1-5-21-...-512` | Domain Admins | `confidential/`, `restricted/` |
| `S-1-5-21-...-1100` | Engineering | `restricted/` |

#### ユーザー別の表示例

| ユーザー | 保有SID | 表示されるディレクトリ |
|---------|--------|---------------------|
| admin@example.com | Everyone + Domain Admins | `public/`, `confidential/`, `restricted/` |
| user@example.com | Everyone のみ | `public/` |

#### 環境タイプ表示

| directoryType | 表示 | 条件 |
|--------------|------|------|
| `sid-based` | 🔐 SIDベースのアクセス権限 | DynamoDB SIDデータから正常取得 |
| `actual` | 🟢 FSx for ONTAP本番環境 | FSx APIから直接取得（将来対応） |
| `fallback` | ⚠️ シミュレーション環境 | DynamoDBエラー時 |
| `no-table` | ⚠️ シミュレーション環境 | USER_ACCESS_TABLE_NAME未設定 |

### 新しいディレクトリを追加する場合

1. S3にドキュメントと`.metadata.json`をアップロード
2. `.metadata.json`の`allowed_group_sids`に適切なSIDを設定
3. Bedrock KBデータソースを同期
4. `/api/fsx/directories`の`SID_DIRECTORY_MAP`にマッピングを追加

```typescript
// docker/nextjs/src/app/api/fsx/directories/route.ts
const SID_DIRECTORY_MAP: Record<string, string[]> = {
  'S-1-1-0': ['public/'],
  'S-1-5-21-...-512': ['confidential/', 'restricted/'],
  'S-1-5-21-...-1100': ['restricted/'],
  // 新しいディレクトリを追加:
  'S-1-5-21-...-1200': ['engineering-docs/'],
};
```

---

## 2. サイドバー — Bedrockリージョンセクション

### 表示内容

| 項目 | データソース | 説明 |
|------|------------|------|
| リージョン名 | `RegionConfigManager` | 選択中リージョンの日本語名 |
| リージョンID | `regionStore` | `ap-northeast-1` 等 |
| モデル数 | `/api/bedrock/region-info` | 選択中リージョンの利用可能モデル数 |

### リージョン変更フロー

```
ユーザーがリージョン選択
  ↓
RegionSelector → /api/bedrock/change-region (POST)
  ↓
Cookie bedrock_region を更新
  ↓
ページリロード
  ↓
/api/bedrock/region-info → 新リージョンのモデル一覧取得
  ↓
/api/bedrock/models → モデルセレクターを更新
```

### リージョン別モデル数（2026-03-25時点）

| リージョン | モデル数 | 備考 |
|-----------|---------|------|
| 東京 (ap-northeast-1) | 57 | プライマリ |
| 大阪 (ap-northeast-3) | 9 | |
| シンガポール (ap-southeast-1) | 18 | |
| シドニー (ap-southeast-2) | 59 | |
| ムンバイ (ap-south-1) | 58 | |
| ソウル (ap-northeast-2) | 19 | |
| アイルランド (eu-west-1) | 50 | |
| フランクフルト (eu-central-1) | 29 | |
| ロンドン (eu-west-2) | 52 | |
| パリ (eu-west-3) | 25 | |
| バージニア (us-east-1) | 96 | |
| オレゴン (us-west-2) | 103 | 最多 |
| オハイオ (us-east-2) | 76 | |
| サンパウロ (sa-east-1) | 43 | |

> モデル数は`ListFoundationModels(byOutputModality=TEXT)`の結果です。新モデル追加時は`/api/bedrock/region-info`の`REGION_MODEL_COUNTS`を更新してください。

---

## 3. AIモデル選択セクション

### モデル一覧の取得

```
/api/bedrock/models (GET)
  ↓
ListFoundationModels API (byOutputModality=TEXT)
  ↓
provider-patterns.ts でプロバイダー自動検出
  ↓
全モデルを返却（Unknownプロバイダーも含む）
```

### 対応プロバイダー（13社）

amazon, anthropic, cohere, deepseek, google, minimax, mistral, moonshot, nvidia, openai, qwen, twelvelabs, zai

### モデル選択時の処理

KB Retrieve APIでは、選択されたモデルIDに応じてConverse APIの呼び出し方法が変わります。

| モデルIDパターン | 処理 |
|----------------|------|
| `apac.xxx` / `us.xxx` / `eu.xxx` | inference profileとしてそのまま使用 |
| `anthropic.xxx` | on-demandで直接呼び出し |
| `google.xxx`, `qwen.xxx`, `deepseek.xxx` 等 | on-demandで直接呼び出し |
| `amazon.nova-pro-v1:0` 等（プレフィックスなし） | Claude Haikuにフォールバック |
| Legacyモデル | 自動フォールバック（Nova Lite → Claude Haiku） |

### フォールバックチェーン

```
選択モデル → (失敗) → apac.amazon.nova-lite-v1:0 → (失敗) → anthropic.claude-3-haiku-20240307-v1:0
```

Legacyモデルエラー、on-demand不可エラー、ValidationExceptionが発生した場合に自動的に次のモデルを試行します。

---

## 4. チャットエリア — Introduction Message

### 表示内容

サインイン後に自動生成される初期メッセージです。

| セクション | 内容 |
|-----------|------|
| あいさつ | ユーザー名を含むウェルカムメッセージ |
| アクセス権限 | ユーザー名、ロール、アクセス可能ディレクトリ |
| 環境タイプ | SIDベース / FSx本番 / シミュレーション |
| 権限詳細 | 読み取り / 書き込み / 実行 の可否 |
| 利用可能な機能 | 文書検索とQ&A、権限ベースのアクセス制御 |

### 多言語対応

8言語対応（ja, en, de, es, fr, ko, zh-CN, zh-TW）。翻訳キーは`docker/nextjs/src/messages/{locale}.json`の`introduction`セクションに定義されています。

---

## 5. チャットエリア — RAG検索フロー

### 2段階方式（Retrieve + Converse）

```
ユーザー質問
  ↓
/api/bedrock/kb/retrieve (POST)
  ↓
Step 1: DynamoDB user-access → ユーザーSID取得
  ↓
Step 2: Bedrock KB Retrieve API → ベクトル検索（メタデータ付き）
  ↓
Step 3: SIDフィルタリング
  - ドキュメントの allowed_group_sids とユーザーSIDを照合
  - マッチ → ALLOW、不一致 → DENY
  ↓
Step 4: Converse API → 許可ドキュメントのみで回答生成
  ↓
回答 + Citation + filterLog を返却
```

### RetrieveAndGenerate APIを使わない理由

RetrieveAndGenerate APIはcitationの`metadata`フィールドに`.metadata.json`の`allowed_group_sids`を含めません。Retrieve APIはメタデータを正しく返すため、2段階方式を採用しています。

### フロントエンドのフォールバック

KB Retrieve APIが500エラーを返した場合、フロントエンドは通常のBedrock Chat API（`/api/bedrock/chat`）にフォールバックします。この場合、KBドキュメントを参照しない一般的なAI回答が返されます。

---

## 6. API一覧

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/bedrock/kb/retrieve` | POST | RAG検索 + SIDフィルタリング + 回答生成 |
| `/api/bedrock/chat` | POST | 通常チャット（KB不使用、フォールバック用） |
| `/api/bedrock/models` | GET | 利用可能モデル一覧 |
| `/api/bedrock/region-info` | GET | リージョン情報 + モデル数 |
| `/api/bedrock/change-region` | POST | リージョン変更（Cookie更新） |
| `/api/fsx/directories` | GET | ユーザーのアクセス可能ディレクトリ（SIDベース） |
| `/api/auth/signin` | POST | Cognito認証 |
| `/api/auth/session` | GET | セッション情報 |
| `/api/auth/signout` | POST | サインアウト |
| `/api/health` | GET | ヘルスチェック |

---

## 7. 環境変数

Lambda関数に設定する環境変数です。

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATA_BUCKET_NAME` | KBデータソースS3バケット名 | `perm-rag-demo-demo-kb-data-178625946981` |
| `BEDROCK_KB_ID` | Knowledge Base ID | `3ZZMK6YA0Q` |
| `BEDROCK_REGION` | Bedrockリージョン | `ap-northeast-1` |
| `USER_ACCESS_TABLE_NAME` | DynamoDB user-accessテーブル名 | `perm-rag-demo-demo-user-access` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxx` |
| `ENABLE_PERMISSION_CHECK` | 権限チェック有効化 | `true` |

---

## 8. トラブルシューティング

### チャットでドキュメントの情報が返らない

| 症状 | 原因 | 対処 |
|------|------|------|
| 全ユーザーで情報が返らない | KB未同期 or BEDROCK_KB_ID未設定 | `sync-kb-datasource.sh`実行、環境変数確認 |
| adminでも機密情報が返らない | SIDデータ未登録 | `setup-user-access.sh`実行 |
| 回答は返るがCitationがない | フォールバックChat APIが使われている | Lambdaログで500エラーを確認 |
| 「アクセス権限のあるドキュメントが見つかりませんでした」 | SIDマッチなし | DynamoDBのSIDデータとメタデータのSIDを確認 |

### モデル選択で500エラー

| 症状 | 原因 | 対処 |
|------|------|------|
| 特定モデルで500 | Legacyモデル or on-demand不可 | 自動フォールバックで対応済み |
| 全モデルで500 | Lambda タイムアウト | Lambdaタイムアウトを30秒以上に設定 |

### ディレクトリ表示が「❓ 不明な環境」

| 症状 | 原因 | 対処 |
|------|------|------|
| 不明な環境と表示 | `directoryType`が未対応の値 | `page.tsx`のswitchケースを確認 |
| ディレクトリが空 | SIDデータ未登録 | `setup-user-access.sh`実行 |


---

## 8. KB/Agentモード切替

### 概要

ヘッダーにKB/Agentモード切替トグルを配置し、2つのモードをシームレスに切り替えられます。

```
┌─────────────────────────────────────────────────────────┐
│ ≡  RAG System  [📚 KB] [🤖 Agent]  ➕  Nova Pro  🇯🇵  │
│                                                         │
│    📚 Knowledge Base  ← モードに応じて動的に変化        │
│    🤖 Agent                                             │
└─────────────────────────────────────────────────────────┘
```

### モード切替の仕組み

| 項目 | 説明 |
|------|------|
| トグル位置 | ヘッダーのタイトル右横 |
| 状態管理 | `useState` + URLパラメータ（`?mode=agent`） |
| 永続化 | URLパラメータで永続化（ブックマーク可能） |
| デフォルト | KBモード（`?mode`パラメータなし） |

### モード別の動作

| 機能 | KBモード | Agentモード |
|------|---------|------------|
| サイドバー | KBModeSidebar（インライン） | AgentModeSidebar（コンポーネント） |
| モデルリスト | `/api/bedrock/region-info`（全モデル） | `/api/bedrock/agent-models`（Agent対応モデルのみ） |
| モデル取得方式 | 静的設定 + API | Bedrock `ListFoundationModels` API（`ON_DEMAND` + `TEXT`フィルタ） |
| チャットAPI | `/api/bedrock/kb/retrieve` | `/api/bedrock/kb/retrieve`（`agentMode=true`フラグ付き） |
| SIDフィルタリング | ✅ あり | ✅ あり（ハイブリッド方式） |
| ヘッダーバッジ | 📚 Knowledge Base（青） | 🤖 Agent（紫） |
| 動作モード表示 | 📚 Knowledge Base | 🤖 Agent |

### Agentモードのハイブリッド方式

Agentモードでは、Permission-awareなRAGを実現するためにハイブリッド方式を採用しています。

```
ユーザー質問
  │
  ▼
KB Retrieve API（ベクトル検索）
  │
  ▼
SIDフィルタリング（KBモードと同じパイプライン）
  │ ユーザーSID ∩ ドキュメントSID → 許可/拒否
  ▼
許可ドキュメントのみをコンテキストとして
  │
  ▼
Converse API（Agent用システムプロンプト付き）
  │ 「AIエージェントとして多段階推論と文書検索を活用して回答」
  ▼
回答 + Citation表示
```

**なぜハイブリッド方式か:**
- Bedrock Agent InvokeAgent APIはアプリ側でのSIDフィルタリングの余地がない
- KB Retrieve APIはメタデータ（`allowed_group_sids`）を返すため、SIDフィルタリングが可能
- 既存のSIDフィルタリングパイプラインをそのまま再利用できる

### Agent対応モデルの動的取得

Agent対応モデルはハードコードせず、Bedrock APIから動的に取得します。

```
/api/bedrock/agent-models?region=ap-northeast-1
  │
  ▼
BedrockClient.ListFoundationModels({
  byOutputModality: 'TEXT',
  byInferenceType: 'ON_DEMAND',
})
  │
  ▼
フィルタ:
  - TEXT入力 + TEXT出力
  - ON_DEMAND推論サポート
  - Embeddingモデル除外
  │
  ▼
Agent対応モデルリスト（メンテナンス不要）
```

### AgentModeSidebarの構成

```
┌─────────────────────────┐
│ Agent情報               │
│  [Agent選択 ▼]          │
│  Agent ID: RVAPZQREEU   │
│  Agent名: CustomerSupp..│
│  ステータス: ✅ PREPARED │
│  [🚀 新規作成] [🗑️ 削除]│
├─────────────────────────┤
│ Bedrockリージョン       │
│  🏆 東京 (ap-northeast-1)│
├─────────────────────────┤
│ AIモデル選択            │
│  ✅ Nova Pro (amazon)   │
│  ▶ amazon 6個           │
│  ▶ anthropic 8個        │
│  ...                    │
├─────────────────────────┤
│ 機能                    │
│  多段階推論             │
│  自動文書検索           │
│  コンテキスト最適化     │
├─────────────────────────┤
│ チャット履歴            │
│  □ 履歴保存             │
│  □ 自動タイトル生成     │
└─────────────────────────┘
```

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | モード切替トグル、条件付きサイドバーレンダリング |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Agentモードサイドバー |
| `docker/nextjs/src/components/bedrock/AgentInfoSection.tsx` | Agent選択・情報表示 |
| `docker/nextjs/src/components/bedrock/ModelSelector.tsx` | モデル選択（`mode`プロパティでKB/Agent切替） |
| `docker/nextjs/src/app/api/bedrock/agent-models/route.ts` | Agent対応モデルAPI（動的取得） |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | Agent API（invoke, create, delete, list） |
| `docker/nextjs/src/hooks/useAgentMode.ts` | モード切替ロジック |
| `docker/nextjs/src/hooks/useAgentsList.ts` | Agent一覧取得 |
| `docker/nextjs/src/store/useAgentStore.ts` | Agent状態管理（Zustand） |
