# Permission Aware 型 RAGシステム 実装内容について

**作成日**: 2026-03-25  
**バージョン**: 3.0.0

---

## 概要

本システムは、Amazon FSx for NetApp ONTAPとAmazon Bedrockを組み合わせた、ファイルアクセス権限（SID）に基づくRAG（Retrieval-Augmented Generation）チャットボットシステムです。ユーザーごとのNTFS ACL情報をメタデータとして管理し、検索結果をリアルタイムでフィルタリングすることで、セキュアなドキュメント検索とAI回答生成を実現します。

全インフラストラクチャはAWS CDK（TypeScript）で定義されており、`npx cdk deploy --all` で一括デプロイが可能です。

---

## 1. Chatbotアプリケーション — Next.js RAG Chatbot on AWS Lambda

### 実装内容

Next.js 15（App Router）で実装したRAGチャットボットアプリケーションを、AWS Lambda Web Adapter経由でサーバーレス実行しています。

### アーキテクチャ

```
ブラウザ → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js (standalone)
```

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router, standalone output) |
| UI | React 18 + Tailwind CSS |
| 認証 | Amazon Cognito (JWT) |
| AI/RAG | Amazon Bedrock Knowledge Base Retrieve API + Converse API |
| ランタイム | Lambda Web Adapter (Rust) + Docker コンテナ |
| CDN | Amazon CloudFront |

### 主要機能

- **RAG検索**: Bedrock Knowledge Base経由でベクトル検索し、関連ドキュメントを参照した回答を生成
- **SIDフィルタリング**: 検索結果をユーザーのSID情報に基づいてフィルタリング（後述の項目7で詳細説明）
- **KB/Agentモード切替**: ヘッダーのトグルでKBモード（文書検索）とAgentモード（多段階推論）を切替
- **Agentモード（InvokeAgent API）**: Bedrock Agent + Permission-aware Action Groupで、SIDフィルタリング付きの多段階推論を実現。Agent呼び出し失敗時はKBハイブリッド方式にフォールバック
- **多言語対応**: 日本語・英語・韓国語・中国語（簡体/繁体）・フランス語・ドイツ語・スペイン語の8言語
- **Citation表示**: 回答の根拠となったドキュメントのソース情報を表示
- **Cognito認証**: サインイン/サインアウト、セッション管理

### CDKスタック

`DemoWebAppStack`（`lib/stacks/demo/demo-webapp-stack.ts`）で以下を作成:
- Lambda DockerImageFunction（ECRイメージ、メモリ1024MB、タイムアウト30秒）
- Lambda Function URL（IAM認証）
- CloudFront Distribution（OAC + Geo制限 + WAF連携）
- CloudFrontアクセスログ用S3バケット

---

## 2. AWS WAF — IPやGeo情報による保護

### 実装内容

CloudFront用のWAFv2 WebACLを`us-east-1`にデプロイし、複数のセキュリティルールでアプリケーションを保護しています。

### WAFルール構成（優先度順）

| 優先度 | ルール名 | 種別 | 説明 |
|--------|---------|------|------|
| 100 | RateLimit | カスタム | 1 IPあたり5分間3000リクエスト超でブロック |
| 200 | AWSIPReputationList | AWSマネージド | ボットネット・DDoS送信元等の悪意あるIPをブロック |
| 300 | AWSCommonRuleSet | AWSマネージド | OWASP Top 10準拠（XSS, LFI, RFI等）。RAG互換のため一部ルール除外 |
| 400 | AWSKnownBadInputs | AWSマネージド | Log4j等の既知脆弱性を悪用するリクエストをブロック |
| 500 | AWSSQLiRuleSet | AWSマネージド | SQLインジェクション攻撃パターンを検出・ブロック |
| 600 | IPAllowList | カスタム（任意） | `allowedIps`設定時のみ有効。リスト外IPをブロック |

### Geo制限

CloudFrontレベルで地理的アクセス制限を適用します（デフォルト: 日本のみ）。

### CDKスタック

`DemoWafStack`（`lib/stacks/demo/demo-waf-stack.ts`）で以下を作成:
- WAFv2 WebACL（CLOUDFRONT スコープ、`us-east-1`）
- IPセット（`allowedIps`設定時）

### 設定方法

`cdk.context.json`で制御:
```json
{
  "allowedIps": ["203.0.113.0/24"],
  "allowedCountries": ["JP", "US"]
}
```

---

## 3. IAM認証 — Lambda Function URL IAM Auth + CloudFront OAC

### 実装内容

Lambda Function URLにIAM認証（`AWS_IAM`）を設定し、CloudFront Origin Access Control（OAC）でSigV4署名によるオリジンアクセス制御を実現しています。

### 認証フロー

```
ブラウザ
  │
  ▼
CloudFront (OAC: SigV4署名を自動付与)
  │
  ▼
Lambda Function URL (AuthType: AWS_IAM)
  │ → SigV4署名を検証
  │ → CloudFrontからのリクエストのみ許可
  ▼
Next.js アプリケーション
  │
  ▼
Cognito JWT検証 (アプリケーションレベル認証)
```

### セキュリティレイヤー

| レイヤー | 技術 | 目的 |
|---------|------|------|
| L1: ネットワーク | CloudFront Geo制限 | 地理的アクセス制限 |
| L2: WAF | AWS WAF | 攻撃パターン検出・ブロック |
| L3: オリジン認証 | OAC (SigV4) | CloudFront以外からの直接アクセス防止 |
| L4: API認証 | Lambda Function URL IAM Auth | IAM認証によるアクセス制御 |
| L5: ユーザー認証 | Cognito JWT | ユーザーレベルの認証・認可 |
| L6: データ認可 | SIDフィルタリング | ドキュメントレベルのアクセス制御 |

### CDK実装

`DemoWebAppStack`内で:
- `lambda.FunctionUrlAuthType.AWS_IAM` でFunction URLを作成
- `cloudfront.CfnOriginAccessControl` でOACを作成（`signingBehavior: 'always'`）
- L1エスケープハッチでOACをDistributionに関連付け

### デプロイ後の注意事項

本番運用では上記のIAM認証 + OAC構成が推奨されますが、検証環境でPOSTリクエスト（チャット等）の互換性問題が発生する場合は、以下の手動調整が必要になることがあります:
- Lambda Function URL AuthType を `NONE` に変更
- CloudFront OACの関連付けを解除

---

## 4. ベクトルデータベース — Amazon OpenSearch Serverless

### 実装内容

RAG検索で利用するベクトルデータベースとして、Amazon OpenSearch Serverless（AOSS）のベクトル検索コレクションを使用しています。

### 設計判断

本システムではAOSSを選択していますが、アーキテクチャ上はAmazon Aurora Serverless v2（pgvector拡張）も選択肢として検討可能です。AOSSを選択した理由:

| 観点 | AOSS | Aurora Serverless v2 (pgvector) |
|------|------|------|
| Bedrock KB統合 | ネイティブ対応 | カスタム統合が必要 |
| 運用負荷 | サーバーレス（自動スケーリング） | 容量管理が必要 |
| コスト | 検索量に応じた従量課金 | 最小ACU課金あり |
| メタデータ検索 | テキストフィールドで格納 | SQLクエリで柔軟に検索可能 |

### AOSS構成

| リソース | 説明 |
|---------|------|
| コレクション | `VECTORSEARCH`タイプ、暗号化ポリシー（AWS所有キー） |
| ネットワークポリシー | パブリックアクセス（Bedrock KB APIからのアクセスのため） |
| データアクセスポリシー | KB IAMロール + インデックス作成Lambda + Embedding EC2ロール |
| インデックス | `bedrock-knowledge-base-default-index`（knn_vector 1024次元、HNSW/faiss/l2） |

### インデックスマッピング

```json
{
  "bedrock-knowledge-base-default-vector": { "type": "knn_vector", "dimension": 1024 },
  "AMAZON_BEDROCK_TEXT_CHUNK": { "type": "text" },
  "AMAZON_BEDROCK_METADATA": { "type": "text", "index": false }
}
```

### CDKスタック

`DemoAIStack`（`lib/stacks/demo/demo-ai-stack.ts`）で以下を作成:
- OpenSearch Serverless コレクション + セキュリティポリシー（暗号化・ネットワーク・データアクセス）
- カスタムリソースLambdaによるインデックス自動作成
- Bedrock Knowledge Base + S3データソース

---

## 5. Embedding Server — FSx ONTAP CIFSマウント + ベクトルDB書き込み

### 実装内容

Amazon FSx for NetApp ONTAPのボリュームをCIFS/SMBでマウントしたEC2インスタンス上で、Dockerコンテナがドキュメントを読み取り、ベクトル化してOpenSearch Serverlessにインデックスします。

### データ取り込みパスの全体像

| パス | 方式 | CDK有効化 | 状況 |
|------|------|----------|------|
| Option A（デフォルト） | S3バケット → Bedrock KB S3データソース | 常に有効 | ✅ |
| Option B（オプション） | Embeddingサーバー（CIFSマウント）→ AOSS直接書き込み | `-c enableEmbeddingServer=true` | ✅ |
| Option C（オプション） | S3 Access Point → Bedrock KB | デプロイ後に手動設定 | ✅ SnapMirror対応、FlexCache近日対応 |

> **S3 Access Pointについて**: StorageStackはFSx ONTAPボリュームにS3 Access Pointを自動作成しますが、FlexCache CacheボリュームではS3 Access Pointが利用不可（2026年3月時点）のため、Bedrock KBデータソースとしては未使用です。将来FlexCache対応が実現した際にOption Cとして活用できるよう基盤を準備しています。

### アーキテクチャ

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    マウント        │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ 1. スキャン   │ │
                                       │ │ 2. チャンク化 │ │
                                       │ │ 3. Embedding │ │
                                       │ │ 4. インデックス│ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    └──────────────────┘              └──────────────────┘
```

### 処理フロー

1. CIFSマウントされたディレクトリを再帰スキャン（`.md`, `.txt`, `.html`等のテキストファイル）
2. 各ドキュメントの`.metadata.json`からSID情報（`allowed_group_sids`）を読み取り
   - `.metadata.json`が存在しない場合、`ENV_AUTO_METADATA=true`であればONTAP REST API（`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`）でACLを自動取得し、SIDを抽出して`.metadata.json`を自動生成
3. テキストを1000文字チャンク（200文字オーバーラップ）に分割
4. Amazon Bedrock Titan Embed Text v2で1024次元ベクトルを生成
5. Bedrock KB互換フォーマット（`AMAZON_BEDROCK_TEXT_CHUNK` + `AMAZON_BEDROCK_METADATA`）でAOSSにインデックス
6. 処理済みファイルを`processed.json`に記録（差分処理対応）

### 実行モード

| モード | 説明 | 設定 |
|--------|------|------|
| バッチモード | 全ファイルを1回処理して終了 | `ENV_WATCH_MODE=false`（デフォルト） |
| 監視モード | ファイル変更を検知して自動処理 | `ENV_WATCH_MODE=true` |

監視モードでは`chokidar`ライブラリを使用してファイルシステムの変更（追加・更新）をリアルタイムに検知し、自動的にベクトル化・インデックスを実行します。定期実行が必要な場合は、EventBridgeスケジューラやcronでバッチモードのコンテナを定期起動する構成も可能です。

### CDKスタック

`DemoEmbeddingStack`（`lib/stacks/demo/demo-embedding-stack.ts`）で以下を作成:
- EC2インスタンス（m5.large、IMDSv2強制）
- ECRリポジトリ（Embeddingコンテナイメージ用）
- IAMロール（SSM、FSx、AOSS、Bedrock、ECR、Secrets Manager）
- セキュリティグループ
- UserData（CIFS自動マウント + Docker自動起動）

### ソースコード

```
docker/embed/
├── src/index.ts      # メイン処理（スキャン→チャンク→Embedding→インデックス）
├── src/oss-client.ts  # AOSS SigV4署名クライアント（IMDS認証対応）
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild用ビルド定義
└── package.json       # AWS SDK v3, chokidar, dotenv
```

---

## 6. Amazon Titan Text Embeddings — ベクトル化モデル

### 実装内容

ドキュメントのベクトル化に`amazon.titan-embed-text-v2:0`を使用しています。

### モデル仕様

| 項目 | 値 |
|------|-----|
| モデルID | `amazon.titan-embed-text-v2:0` |
| ベクトル次元数 | 1024 |
| 最大入力長 | 8,000文字 |
| 正規化 | 有効（`normalize: true`） |

### 使用箇所

| コンポーネント | 用途 |
|---------------|------|
| Bedrock Knowledge Base | S3データソースからのドキュメント取り込み時のベクトル化 |
| Embeddingサーバー | CIFSマウントドキュメントのベクトル化（`docker/embed/src/index.ts`） |

### Embedding呼び出し

```typescript
// Bedrock InvokeModel API
const body = JSON.stringify({
  inputText: text.substring(0, 8000),
  dimensions: 1024,
  normalize: true,
});
const resp = await bedrock.send(new InvokeModelCommand({
  modelId: 'amazon.titan-embed-text-v2:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: Buffer.from(body),
}));
```

### CDK設定

`DemoAIStack`のKnowledge Base設定:
```typescript
embeddingModelArn: `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`
```

---

## 7. SIDメタデータ + 権限フィルタリング

### 実装内容

ドキュメントをベクトル化する際に、ファイルのNTFS ACLに基づくSID（Security Identifier）情報を`.metadata.json`としてメタデータ化して付与しています。チャットインターフェースでは、ログインユーザーのSIDと各ドキュメントのSIDを照合し、マッチした場合のみ対象ファイルの情報を検索結果に含めます。

### SIDとは

SID（Security Identifier）は、Windows/NTFSにおけるセキュリティプリンシパル（ユーザー、グループ）の一意識別子です。

```
S-1-5-21-{ドメインID1}-{ドメインID2}-{ドメインID3}-{RID}
```

| SID | 名前 | 説明 |
|-----|------|------|
| `S-1-1-0` | Everyone | すべてのユーザー |
| `S-1-5-21-...-512` | Domain Admins | ドメイン管理者グループ |
| `S-1-5-21-...-1001` | User | 一般ユーザー |

### メタデータファイル（`.metadata.json`）

各ドキュメントに対応する`.metadata.json`ファイルで、アクセス許可SIDリストを定義します。

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
    "access_level": "confidential"
  }
}
```

### ドキュメントとSIDの対応

| ディレクトリ | アクセスレベル | allowed_group_sids | 管理者 | 一般ユーザー |
|-------------|-------------|-------------------|--------|------------|
| `public/` | 公開 | `S-1-1-0` (Everyone) | ✅ 許可 | ✅ 許可 |
| `confidential/` | 機密 | `...-512` (Domain Admins) | ✅ 許可 | ❌ 拒否 |
| `restricted/` | 制限 | `...-1100` (Engineering) + `...-512` (DA) | ✅ 許可 | ❌ 拒否 |

### ユーザーSID管理

DynamoDB `user-access`テーブルでユーザーごとのSID情報を管理します。アプリケーションのJWTではメールアドレスが`userId`として使用されます。

```
DynamoDB user-access テーブル
┌──────────────────────┬──────────────────────┬────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs              │
├──────────────────────┼──────────────────────┼────────────────────────┤
│ admin@example.com    │ S-1-5-21-...-500     │ [S-1-5-21-...-512,     │
│                      │ (Administrator)      │  S-1-1-0]              │
├──────────────────────┼──────────────────────┼────────────────────────┤
│ user@example.com     │ S-1-5-21-...-1001    │ [S-1-1-0]              │
│                      │ (Regular User)       │                        │
└──────────────────────┴──────────────────────┴────────────────────────┘
```

### フィルタリング処理フロー（2段階方式）

```
ユーザー          Next.js API Route        DynamoDB          Bedrock KB        Bedrock Converse
  │                  │                       │                  │                  │
  │ 1. 質問送信      │                       │                  │                  │
  │─────────────────▶│                       │                  │                  │
  │                  │ 2. ユーザーSID取得     │                  │                  │
  │                  │──────────────────────▶│                  │                  │
  │                  │◀──────────────────────│                  │                  │
  │                  │ userSID + groupSIDs   │                  │                  │
  │                  │                       │                  │                  │
  │                  │ 3. Retrieve API（ベクトル検索）           │                  │
  │                  │─────────────────────────────────────────▶│                  │
  │                  │◀─────────────────────────────────────────│                  │
  │                  │ 検索結果 + メタデータ(allowed_group_sids) │                  │
  │                  │                       │                  │                  │
  │                  │ 4. SIDマッチング       │                  │                  │
  │                  │ ユーザーSID ∩ ドキュメントSID             │                  │
  │                  │ → マッチ: ALLOW                          │                  │
  │                  │ → 不一致: DENY                           │                  │
  │                  │                       │                  │                  │
  │                  │ 5. Converse API（許可ドキュメントのみで回答生成）            │
  │                  │────────────────────────────────────────────────────────────▶│
  │                  │◀────────────────────────────────────────────────────────────│
  │                  │                       │                  │                  │
  │ 6. フィルタ済み  │                       │                  │                  │
  │    回答+Citation │                       │                  │                  │
  │◀─────────────────│                       │                  │                  │
```

Retrieve APIを使用する理由: RetrieveAndGenerate APIはcitationのメタデータ（`allowed_group_sids`）を返さないため、SIDフィルタリングが機能しません。Retrieve APIはメタデータを正しく返すため、2段階方式（Retrieve → SIDフィルタ → Converse）を採用しています。

### 安全側フォールバック（Fail-Closed）

権限チェックに失敗した場合は、全ドキュメントへのアクセスを拒否します。

| 状況 | 動作 |
|------|------|
| DynamoDB接続エラー | 全ドキュメント拒否 |
| ユーザーSIDレコードなし | 全ドキュメント拒否 |
| メタデータにSID情報なし | 該当ドキュメント拒否 |
| SIDマッチなし | 該当ドキュメント拒否 |
| SIDマッチあり | 該当ドキュメント許可 |

### 実装ファイル

| ファイル | 役割 |
|---------|------|
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | KB検索API + SIDフィルタリング統合（Lambda/インライン切替対応） |
| `lambda/permissions/metadata-filter-handler.ts` | メタデータベース権限フィルタリングLambda（`-c usePermissionFilterLambda=true`で有効化） |
| `lambda/permissions/permission-filter-handler.ts` | ACLベース権限フィルタリングLambda（統合スタック用） |
| `lambda/permissions/permission-calculator.ts` | SID/ACL照合ロジック |
| `demo-data/scripts/setup-user-access.sh` | ユーザーSIDデータ登録スクリプト |
| `demo-data/documents/**/*.metadata.json` | ドキュメントSIDメタデータ |

---

## 8. Bedrock Agent — Permission-aware Agentic AI

### 実装内容

Bedrock Agentを使用した多段階推論AIエージェントを実装しています。AgentはPermission-aware Action Groupを通じてKB検索を行い、ユーザーのSID権限に基づいてフィルタリングされた文書のみを参照して回答を生成します。

### アーキテクチャ

```
ユーザー → InvokeAgent API → Bedrock Agent (Claude 3 Haiku)
  │
  ├── Permission-aware Search Action Group
  │   ├── KB Retrieve API（ベクトル検索）
  │   ├── DynamoDB user-access（ユーザーSID取得）
  │   ├── SIDマッチング（allowed_group_sids ∩ userSIDs）
  │   └── 許可ドキュメントのみ返却
  │
  └── Agent 多段階推論 → 回答生成
```

### CDKリソース（`enableAgent=true`）

| リソース | 説明 |
|---------|------|
| Bedrock Agent | Claude 3 Haiku、KB直接紐づけなし（Action Group経由のみ） |
| Agent Alias | 安定した呼び出し用エイリアス |
| Action Group Lambda | Permission-aware KB検索（SIDフィルタリング付き） |
| Agent IAMロール | Bedrock InvokeModel + KB Retrieve権限 |

### Permission-aware Action Group

AgentはKBを直接検索せず、必ずAction Group（`permissionAwareSearch`）経由でアクセスします。これにより:
- ユーザーのSID情報に基づくフィルタリングが常に適用される
- 管理者は全ドキュメント、一般ユーザーは公開ドキュメントのみ参照
- Agentの多段階推論はフィルタ済みドキュメントのみで実行

### ワークフローUI

AgentModeSidebarにプリセットワークフローを配置:
- 📊 財務レポート分析
- 📝 プロジェクト進捗確認
- 🔍 ドキュメント横断検索
- 📋 人事ポリシー確認

### 実装ファイル

| ファイル | 役割 |
|---------|------|
| `lib/stacks/demo/demo-ai-stack.ts` | Agent + Action Group CDKリソース |
| `lambda/bedrock-agent-actions/permission-aware-search.ts` | Action Group Lambda（TypeScript版） |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | InvokeAgent API Route |
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | Agent UI（モード切替、ワークフロー） |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Agentサイドバー |

---

## システム全体アーキテクチャ

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ ブラウザ  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + OpenSearch     │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   Serverless     │ │ (SIDデータ)  │   │ (権限Cache)  │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                     ┌────────────────┐     ┌──────────────────┐
                     │ S3 Bucket      │     │ FSx for ONTAP    │
                     │ (メタデータ同期)│     │ (SVM + Volume)   │
                     └────────────────┘     └────────┬─────────┘
                                                     │ CIFS/SMB
                                                     ▼
                                            ┌──────────────────┐
                                            │ Embedding EC2    │
                                            │ (Titan Embed v2) │
                                            └──────────────────┘
```

### CDKスタック構成（7スタック）

| # | スタック | リージョン | 主要リソース |
|---|---------|-----------|-------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IPセット |
| 2 | NetworkingStack | ap-northeast-1 | VPC, サブネット, セキュリティグループ, VPCエンドポイント（オプション） |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, AD Sync Lambda（オプション） |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, AD, KMS暗号化（オプション）, CloudTrail（オプション） |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, OpenSearch Serverless, Bedrock Guardrails（オプション） |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker), CloudFront, Permission Filter Lambda（オプション） |
| 7 | EmbeddingStack（任意） | ap-northeast-1 | EC2, ECR, ONTAP ACL自動取得（オプション） |

### CDKコンテキストパラメータ一覧

| パラメータ | Phase | デフォルト | 説明 |
|-----------|-------|----------|------|
| `enableEmbeddingServer` | - | `false` | Embeddingサーバー有効化 |
| `ontapMgmtIp` | 2 | (なし) | ONTAP管理IP（ACL自動取得） |
| `ontapSvmUuid` | 2 | (なし) | SVM UUID（ACL自動取得） |
| `useS3AccessPoint` | 2 | `false` | S3 APをKBデータソースに使用 |
| `usePermissionFilterLambda` | 3 | `false` | Permission Filter Lambda有効化 |
| `enableGuardrails` | 4 | `false` | Bedrock Guardrails有効化 |
| `enableKmsEncryption` | 4 | `false` | KMS暗号化（S3, DynamoDB） |
| `enableCloudTrail` | 4 | `false` | CloudTrail監査ログ |
| `enableVpcEndpoints` | 4 | `false` | VPCエンドポイント（Bedrock, SSM等） |
