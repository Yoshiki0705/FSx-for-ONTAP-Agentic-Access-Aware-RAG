# Permission Aware 型 RAGシステム 実装内容について

**🌐 Language:** **日本語** | [English](en/implementation-overview.md) | [한국어](ko/implementation-overview.md) | [简体中文](zh-CN/implementation-overview.md) | [繁體中文](zh-TW/implementation-overview.md) | [Français](fr/implementation-overview.md) | [Deutsch](de/implementation-overview.md) | [Español](es/implementation-overview.md)

**作成日**: 2026-03-25  
**バージョン**: 3.3.0

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
- **カードベースのタスク指向UI**: チャット開始前にKBモードでは目的別カード（文書検索、要約作成、学習問題作成等）、Agentモードではワークフローカード（財務分析、プロジェクト管理等）をグリッド表示。お気に入り管理・カテゴリフィルタリング対応
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

> 認証モードの選択（メール/パスワード vs AD Federation）、ユーザーのSID自動登録、AD連携設定の詳細は [認証・ユーザー管理ガイド](auth-and-user-management.md) を参照してください。

### 実装内容

Lambda Function URLにIAM認証（`AWS_IAM`）を設定し、CloudFront Origin Access Control（OAC）でSigV4署名によるオリジンアクセス制御を実現しています。

### 認証フロー

```
Browser
  |
  v
CloudFront (OAC: auto SigV4 signing)
  |
  v
Lambda Function URL (AuthType: AWS_IAM)
  | -> Validate SigV4 signature
  | -> Allow only requests from CloudFront
  v
Next.js Application
  |
  v
Cognito JWT Validation (Application-level auth)
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

## 4. ベクトルデータベース — S3 Vectors / Amazon OpenSearch Serverless

### 実装内容

RAG検索で利用するベクトルデータベースとして、CDKコンテキストパラメータ`vectorStoreType`で以下を選択できます:
- **S3 Vectors**（デフォルト）: 低コスト、サブ秒レイテンシ。Bedrock KBのベクトルストアとして直接利用
- **Amazon OpenSearch Serverless（AOSS）**: 高パフォーマンス（~10ms）、高コスト（~$700/月）

### 設計判断

S3 Vectorsをデフォルトとした理由:
- コストが月数ドル（小規模）で、OpenSearch Serverlessの~$700/月と比較して大幅に低い
- Bedrock KBのベクトルストアとしてネイティブ対応
- メタデータフィルタリング（`$eq`, `$in`, `$and`, `$or`）をサポート
- 高パフォーマンスが必要な場合はS3 VectorsからAOSSへのワンクリックエクスポートが可能

AOSSを選択する場合の比較:

| 観点 | S3 Vectors | AOSS | Aurora Serverless v2 (pgvector) |
|------|-----------|------|------|
| Bedrock KB統合 | ネイティブ対応 | ネイティブ対応 | カスタム統合が必要 |
| コスト | 月数ドル（従量課金） | ~$700/月（2 OCU最低） | インスタンスコスト依存 |
| レイテンシ | サブ秒〜100ms | ~10ms | ~10ms |
| メタデータ検索 | フィルタリング演算子対応 | テキストフィールドで格納 | SQLクエリで柔軟に検索可能 |
| 運用負荷 | サーバーレス（自動スケーリング） | 容量管理が必要 |
| コスト | 検索量に応じた従量課金 | 最小ACU課金あり |
| メタデータ検索 | テキストフィールドで格納 | SQLクエリで柔軟に検索可能 |

### ベクトルストア構成

S3 Vectors構成（デフォルト）:
- S3 Vectorsベクトルバケット + ベクトルインデックス（1024次元、cosine）
- カスタムリソースLambdaで作成（CloudFormation未サポート）

AOSS構成（`vectorStoreType=opensearch-serverless`）:

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
- `vectorStoreType=s3vectors`: S3 Vectorsベクトルバケット + インデックス（カスタムリソースLambda）
- `vectorStoreType=opensearch-serverless`: OpenSearch Serverless コレクション + セキュリティポリシー（暗号化・ネットワーク・データアクセス）
- カスタムリソースLambdaによるインデックス自動作成
- Bedrock Knowledge Base + S3データソース

---

## 5. Embedding Server — FSx ONTAP CIFSマウント + ベクトルDB書き込み

### 実装内容

Amazon FSx for NetApp ONTAPのボリュームをCIFS/SMBでマウントしたEC2インスタンス上で、Dockerコンテナがドキュメントを読み取り、ベクトル化してOpenSearch Serverless（AOSS）にインデックスします。S3 Vectors構成では使用しません（AOSS構成時のみ）。

### データ取り込みパスの全体像

| パス | 方式 | CDK有効化 | 状況 |
|------|------|----------|------|
| Option A（デフォルト） | S3バケット → Bedrock KB S3データソース | 常に有効 | ✅ |
| Option B（オプション） | Embeddingサーバー（CIFSマウント）→ ベクトルストア直接書き込み | `-c enableEmbeddingServer=true` | ✅（AOSS構成時のみ） |
| Option C（オプション） | S3 Access Point → Bedrock KB | デプロイ後に手動設定 | ✅ SnapMirror対応、FlexCache近日対応 |

> **S3 Access Pointについて**: StorageStackはFSx ONTAPボリュームにS3 Access Pointを自動作成します。ボリュームのセキュリティスタイル（NTFS/UNIX）とAD参加状況に応じて、WINDOWSまたはUNIXユーザータイプのS3 APが作成されます。CDKコンテキストパラメータ `volumeSecurityStyle`、`s3apUserType`、`s3apUserName` で明示的に制御可能です。

#### S3 Access Point ユーザータイプ設計

| パターン | ユーザータイプ | ユーザーソース | ボリュームStyle | 条件 |
|---------|-------------|-------------|--------------|------|
| A | WINDOWS | 既存ADユーザー（Admin） | NTFS/UNIX | AD参加済みSVM（推奨: NTFS環境） |
| B | WINDOWS | 新規専用ADユーザー | NTFS/UNIX | AD参加済みSVM + 最小権限 |
| C | UNIX | 既存UNIXユーザー（root） | UNIX | AD非参加（推奨: UNIX環境） |
| D | UNIX | 新規専用UNIXユーザー | UNIX | AD非参加 + 最小権限 |

SIDフィルタリングは全パターンで同一ロジック（`.metadata.json`のメタデータベース）で動作し、ボリュームのセキュリティスタイルやS3 APユーザータイプに依存しません。

### アーキテクチャ

```
+------------------+     CIFS/SMB      +------------------+
| FSx ONTAP        |<-----------------| Embedding EC2    |
| (SVM + Volume)   |    Mount         | (m5.large)       |
| /data            |                  |                  |
+------------------+                  | Docker Container |
                                      | +--------------+ |
                                      | | embed-app    | |
                                      | | 1. Scan      | |
                                      | | 2. Chunk     | |
                                      | | 3. Embedding | |
                                      | | 4. Index     | |
                                      | +------+-------+ |
                                      +--------+---------+
                             +-----------------+-----------------+
                             v                                   v
                   +------------------+              +------------------+
                   | Bedrock          |              | OpenSearch       |
                   | Titan Embed v2   |              | Serverless       |
                   +------------------+              +------------------+
```

### 処理フロー

1. CIFSマウントされたディレクトリを再帰スキャン（`.md`, `.txt`, `.html`等のテキストファイル）
2. 各ドキュメントの`.metadata.json`からSID情報（`allowed_group_sids`）を読み取り
   - `.metadata.json`が存在しない場合、`ENV_AUTO_METADATA=true`であればONTAP REST API（`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`）でACLを自動取得し、SIDを抽出して`.metadata.json`を自動生成
3. テキストを1000文字チャンク（200文字オーバーラップ）に分割
4. Amazon Bedrock Titan Embed Text v2で1024次元ベクトルを生成
5. Bedrock KB互換フォーマット（`AMAZON_BEDROCK_TEXT_CHUNK` + `AMAZON_BEDROCK_METADATA`）でAOSS（OpenSearch Serverless）にインデックス
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
+-- src/index.ts       # Main processing (Scan -> Chunk -> Embedding -> Index)
+-- src/oss-client.ts  # AOSS SigV4 signing client (IMDS auth support)
+-- Dockerfile         # node:22-slim + cifs-utils
+-- buildspec.yml      # CodeBuild build definition
+-- package.json       # AWS SDK v3, chokidar, dotenv
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
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
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
DynamoDB user-access Table
+----------------------+----------------------+------------------------+
| userId (PK)          | userSID              | groupSIDs              |
+----------------------+----------------------+------------------------+
| admin@example.com    | S-1-5-21-...-500     | [S-1-5-21-...-512,     |
|                      | (Administrator)      |  S-1-1-0]              |
+----------------------+----------------------+------------------------+
| user@example.com     | S-1-5-21-...-1001    | [S-1-1-0]              |
|                      | (Regular User)       |                        |
+----------------------+----------------------+------------------------+
```

### フィルタリング処理フロー（2段階方式）

```
User            Next.js API         DynamoDB        Bedrock KB      Converse API
  |                  |                  |                |                |
  | 1. Send query    |                  |                |                |
  |----------------->|                  |                |                |
  |                  | 2. Get user SIDs |                |                |
  |                  |----------------->|                |                |
  |                  |<-----------------|                |                |
  |                  | userSID+groupSIDs|                |                |
  |                  |                  |                |                |
  |                  | 3. Retrieve API  |                |                |
  |                  |  (vector search) |                |                |
  |                  |----------------->|--------------->|                |
  |                  |<-----------------|                |                |
  |                  | Results+metadata |                |                |
  |                  | (allowed_group   |                |                |
  |                  |  _sids)          |                |                |
  |                  |                  |                |                |
  |                  | 4. SID matching  |                |                |
  |                  |  userSIDs n      |                |                |
  |                  |  documentSIDs    |                |                |
  |                  |  Match->ALLOW    |                |                |
  |                  |  No match->DENY  |                |                |
  |                  |                  |                |                |
  |                  | 5. Converse API  |                |                |
  |                  |  (allowed docs)  |                |                |
  |                  |----------------->|--------------->|--------------->|
  |                  |<-----------------|                |                |
  |                  |                  |                |                |
  | 6. Filtered      |                  |                |                |
  |    result        |                  |                |                |
  |<-----------------|                  |                |                |
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
| `lambda/permissions/permission-filter-handler.ts` | ACLベース権限フィルタリングLambda（将来拡張用） |
| `lambda/permissions/permission-calculator.ts` | SID/ACL照合ロジック |
| `demo-data/scripts/setup-user-access.sh` | ユーザーSIDデータ登録スクリプト |
| `demo-data/documents/**/*.metadata.json` | ドキュメントSIDメタデータ |

---

## 8. Bedrock Agent — Permission-aware Agentic AI

### 実装内容

Bedrock Agentを使用した多段階推論AIエージェントを実装しています。AgentはPermission-aware Action Groupを通じてKB検索を行い、ユーザーのSID権限に基づいてフィルタリングされた文書のみを参照して回答を生成します。

### アーキテクチャ

```
User -> InvokeAgent API -> Bedrock Agent (Claude 3 Haiku)
  |
  +-- Permission-aware Search Action Group
  |   +-- KB Retrieve API (vector search)
  |   +-- DynamoDB user-access (get user SIDs)
  |   +-- SID matching (allowed_group_sids ∩ userSIDs)
  |   +-- Return only allowed documents
  |
  +-- Agent multi-step reasoning -> Answer generation
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

### カードベースのタスク指向UI

チャット開始前にモード別のカードグリッドを表示。KBモード8枚 + Agentモード14枚（リサーチ系8枚 + アウトプット系6枚）の構成で、ワンクリックでプロンプトを入力可能。お気に入り管理・カテゴリフィルタリング対応。

### サイドバーレイアウト

AgentModeSidebarはCollapsiblePanelでSystem Settings（リージョン・モデル選択等）を折りたたみ可能にし、WorkflowSectionをサイドバー上部に配置。KBモード時はSystem Settings展開、Agentモード時はワークフロー展開がデフォルト。

### 動的Agent-Card紐付け

カードクリック時にAGENT_CATEGORY_MAP（10カテゴリ: financial, project, hr, search, presentation, approval, minutes, report, contract, onboarding）を参照し、対応するAgentを検索または動的に作成してカードと紐付ける。作成されたAgentにはPermission-aware Action Groupが自動アタッチされる。

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

## 9. 画像分析RAG — Bedrock Vision API統合

### 実装内容

チャット入力に画像アップロード機能を追加し、Bedrock Converse APIのマルチモーダル機能（Vision API）で画像を分析、その結果をKB検索コンテキストに統合します。

### 処理フロー

```
User -> Drag & drop image or file picker
  -> Validation (format: JPEG/PNG/GIF/WebP, size: <=3MB)
  -> Base64 encoding -> API submission
  -> Vision API (Claude 3 Haiku) image analysis
  -> Analysis result + user query -> KB Retrieve API
  -> SID filtering -> Answer generation
```

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `docker/nextjs/src/hooks/useImageUpload.ts` | 画像バリデーション・Base64変換フック |
| `docker/nextjs/src/components/chat/ImageUploadZone.tsx` | ドラッグ＆ドロップ領域 + ファイルピッカー |
| `docker/nextjs/src/components/chat/ImagePreview.tsx` | 添付画像プレビュー + 削除ボタン |
| `docker/nextjs/src/components/chat/ImageThumbnail.tsx` | メッセージ内サムネイル（max 200×200px） |
| `docker/nextjs/src/components/chat/ImageModal.tsx` | フルサイズ画像モーダル |
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | Vision API呼び出し（30秒タイムアウト、テキストのみフォールバック） |

### エラーハンドリング

- 非対応形式 → エラーメッセージ表示（i18n対応）
- 5MB超過 → エラーメッセージ表示
- Vision API失敗 → テキストのみクエリにフォールバック（ユーザー体験を中断しない）
- Vision API 15秒タイムアウト → AbortControllerで中断、フォールバック

### 現在の画像データライフサイクル

現在の実装では、画像データはどこにも永続的に保管されない完全ステートレスなフローです。

```
Browser (FileReader -> Base64 -> useState)
  -> Include in API request JSON body via POST
  -> Lambda (Buffer.from -> Bedrock Converse API -> Get text result)
  -> After response, image data is discarded by GC
```

- S3やDynamoDB等への画像保存は一切なし
- 画像データはリクエスト処理中のLambdaメモリ上にのみ存在
- Bedrock側もトレーニングに使用しない
- チャット履歴にも画像データは保存されない（テキストメッセージのみ）
- ページリロード後に「どの画像について質問したか」は復元不可

### 将来の実装検討 — 画像データの永続化とAgentCore Memory統合

#### 検討背景

現在のステートレス設計はプライバシー・コスト面で適切だが、チャット履歴に画像が残らないため「前回アップロードした画像について」という文脈の継続ができない。将来的に画像の永続化と会話文脈への統合を検討する。

#### 方式比較

| 方式 | コスト | 実装難易度 | 適合度 | 備考 |
|------|--------|-----------|--------|------|
| S3 + DynamoDB | 月数セント | 低 | 最適 | S3に画像保存、DynamoDBにメッセージIDとS3キーの紐付け。既存インフラで完結 |
| AgentCore Memory (blob) | 不明（高い可能性） | 中 | 過剰 | `create_blob_event`でBase64画像を格納可能だが、会話文脈管理が主目的で画像保管には不向き |
| AgentCore Memory (テキストのみ) | 低 | 中 | 適切 | Vision分析結果のテキストだけをSemantic Strategyで長期記憶として保持 |
| ハイブリッド（推奨） | 低〜中 | 中 | 最適 | S3に画像保存 + AgentCore MemoryにVision分析結果テキストを保持 |

#### AgentCore Memoryの考慮点

- AgentCore Memoryのイベントペイロードは `conversational`（テキスト）と `blob`（バイナリ）の2種類
- Semantic Memory Strategy / Summary Strategyは会話テキストからファクトや要約を抽出する仕組みで、画像バイナリに対しては意味のある抽出ができない
- イベント保持期間（デフォルト90日）とストレージ量に基づく課金が想定され、5MBの画像を毎回保存するとコストが膨らむリスクがある
- AgentCore Memory SDKはPython（`bedrock-agentcore`パッケージ）が主で、TypeScript/Node.jsからはAWS SDK for JavaScript v3の低レベルAPIを直接使用する必要がある
- AgentCore Memoryは2025年7月にGA、ap-northeast-1リージョンでの利用可否は要確認

#### 推奨アーキテクチャ（将来実装時）

```
On image upload:
  Browser -> S3 presigned URL -> S3 bucket (image storage, with TTL)
  -> DynamoDB (messageId -> s3Key mapping)

After Vision analysis:
  Analysis result text -> AgentCore Memory create_event (conversational payload)
  -> Semantic Strategy -> Auto-extracted as long-term memory

Chat history display:
  DynamoDB -> Get s3Key -> Generate S3 presigned URL -> ImageThumbnail display

Context continuation:
  AgentCore Memory retrieve_memories -> Get past Vision analysis result text
  -> Include in LLM context for answer generation
```

この方式により、画像自体はS3で低コスト保管し、Vision分析結果のテキストはAgentCore Memoryのセマンティック検索で文脈復元に活用できる。

---

## 10. Knowledge Base接続UI — Agent × KB管理

### 実装内容

Agent Directory（`/genai/agents`）のAgent作成・編集時に、Bedrock Knowledge Baseの選択・接続・解除を行うUIを提供します。

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `docker/nextjs/src/components/agents/KBSelector.tsx` | KB一覧表示・複数選択（ACTIVEのみ選択可） |
| `docker/nextjs/src/components/agents/ConnectedKBList.tsx` | Agent詳細パネル内の接続済みKB表示 |
| `docker/nextjs/src/hooks/useKnowledgeBases.ts` | KB一覧取得・接続KB取得フック |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | 3アクション追加（associate/disassociate/listAgentKBs） |

### API拡張

既存の `/api/bedrock/agent` に3つのアクションを追加（既存アクション変更なし）:

| アクション | 説明 |
|-----------|------|
| `associateKnowledgeBase` | AgentにKBを接続 → PrepareAgent |
| `disassociateKnowledgeBase` | AgentからKBを解除 → PrepareAgent |
| `listAgentKnowledgeBases` | Agentに接続済みのKB一覧取得 |

---

## 11. Smart Routing — コスト最適化モデル選択

### 実装内容

クエリの複雑度に基づいて自動的にモデルを振り分けます。短い事実確認クエリは軽量モデル（Haiku）へ、長い分析的クエリは高性能モデル（Sonnet）へルーティングします。

### 分類アルゴリズム（ComplexityClassifier）

| 特徴量 | simple寄り | complex寄り |
|--------|-----------|------------|
| 文字数 | ≤100文字 (+0.3) | >100文字 (+0.3) |
| 文の数 | 1文 (+0.2) | 複数文 (+0.2) |
| 分析的キーワード | なし | あり (+0.3)（比較/分析/要約/explain/compare/analyze/summarize） |
| 複数質問 | なし | 2+疑問符 (+0.2) |

スコア < 0.5 → simple、≥ 0.5 → complex。信頼度 = |score - 0.5| × 2。

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `docker/nextjs/src/lib/complexity-classifier.ts` | クエリ複雑度分類（純粋関数） |
| `docker/nextjs/src/lib/smart-router.ts` | モデルルーティング判断 |
| `docker/nextjs/src/store/useSmartRoutingStore.ts` | Zustandストア（localStorage永続化） |
| `docker/nextjs/src/components/sidebar/RoutingToggle.tsx` | ON/OFFトグル + モデルペア表示 |
| `docker/nextjs/src/components/chat/ResponseMetadata.tsx` | 使用モデル名 + Auto/Manualバッジ |

### デフォルト設定

- Smart Routing: デフォルトOFF（既存動作に影響なし）
- 軽量モデル: `anthropic.claude-haiku-4-5-20251001-v1:0`
- 高性能モデル: `anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## 12. 監視・アラート — CloudWatch Dashboard + SNS Alerts + EventBridge

### 実装内容

`enableMonitoring=true` で有効化されるオプション機能として、CloudWatchダッシュボード、SNSアラート、EventBridge連携を提供します。システム全体の稼働状況を1つのダッシュボードで確認でき、異常時にはメール通知を受け取れます。

### アーキテクチャ

```
MonitoringConstruct (in WebAppStack)
+-- CloudWatch Dashboard (unified)
|   +-- Lambda Overview (WebApp / PermFilter / AgentScheduler / AD Sync)
|   +-- CloudFront (requests, error rate, cache hit rate)
|   +-- DynamoDB (capacity, throttling)
|   +-- Bedrock (API calls, latency)
|   +-- WAF (blocked requests)
|   +-- Advanced RAG (Vision API, Smart Routing, KB connection mgmt)
|   +-- AgentCore (conditional: enableAgentCoreObservability=true)
|   +-- KB Ingestion Jobs (execution history)
+-- CloudWatch Alarms -> SNS Topic -> Email
|   +-- WebApp Lambda error rate > 5%
|   +-- WebApp Lambda P99 Duration > 25s
|   +-- CloudFront 5xx error rate > 1%
|   +-- DynamoDB throttling >= 1
|   +-- Permission Filter Lambda error rate > 10% (conditional)
|   +-- Vision API timeout rate > 20%
|   +-- Agent execution error rate > 10% (conditional)
+-- EventBridge Rule -> SNS Topic
    +-- Bedrock KB Ingestion Job FAILED
```

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| ダッシュボード | CloudWatch Dashboard（自動リフレッシュ5分） |
| アラーム | CloudWatch Alarms（OK↔ALARM両方向通知） |
| 通知 | SNS Topic + Email Subscription |
| イベント監視 | EventBridge Rule（KB Ingestion Job失敗検知） |
| カスタムメトリクス | CloudWatch Embedded Metric Format (EMF) |
| CDKコンストラクト | `lib/constructs/monitoring-construct.ts` |

### カスタムメトリクス（EMF）

Lambda関数内で `PermissionAwareRAG/AdvancedFeatures` 名前空間にカスタムメトリクスを出力します。`enableMonitoring=false` 時はno-op実装でパフォーマンス影響なし。

| メトリクス | ディメンション | 出力元 |
|-----------|---------------|--------|
| VisionApiInvocations / Timeouts / Fallbacks / Latency | Operation=vision | Vision API呼び出し時 |
| SmartRoutingSimple / Complex / AutoSelect / ManualOverride | Operation=routing | Smart Router選択時 |
| KbAssociateInvocations / KbDisassociateInvocations / KbMgmtErrors | Operation=kb-mgmt | KB接続管理API呼び出し時 |

### コスト

| リソース | 月額コスト |
|---------|-----------|
| CloudWatch Dashboard | $3.00 |
| CloudWatch Alarms（7個） | $0.70 |
| SNS Email通知 | 無料枠内 |
| EventBridge Rule | 無料枠内 |
| **合計** | **約 $4/月** |

### CDKスタック

`DemoWebAppStack` 内の `MonitoringConstruct` として実装。`enableMonitoring=true` 時のみリソースが作成されます。

```bash
# 監視機能を有効化してデプロイ
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com

# AgentCore Observabilityも有効化
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  -c enableAgentCoreObservability=true
```

---

## 13. AgentCore Memory — 会話コンテキスト維持

### 実装内容

`enableAgentCoreMemory=true` で有効化されるオプション機能として、Bedrock AgentCore Memoryによる短期メモリ（セッション内会話履歴）と長期メモリ（セッション横断のユーザー嗜好・要約・セマンティック知識）を提供します。

### アーキテクチャ

```
AIStack (CfnMemory)
+-- Event Store (short-term: in-session conversation history, TTL 3 days)
+-- Semantic Strategy (long-term: auto-extract facts/knowledge from conversations)
+-- Summary Strategy (long-term: auto-generate session conversation summaries)

Next.js API Routes
+-- POST/GET/DELETE /api/agentcore/memory/session -- Session management
+-- POST/GET /api/agentcore/memory/event -- Event recording/retrieval
+-- POST /api/agentcore/memory/search -- Semantic search

Authentication Flow
+-- lib/agentcore/auth.ts -- Cookie JWT validation (no DynamoDB access)
+-- actorId = userId (@ -> _at_, . -> _dot_ replacement)
```

### CDKリソース

| リソース | 説明 |
|---------|------|
| `CfnMemory` | AgentCore Memoryリソース（`enableAgent=true` AND `enableAgentCoreMemory=true` 時のみ作成） |
| Memory IAMロール | `bedrock-agentcore.amazonaws.com` サービスプリンシパル |
| Lambda IAMポリシー | `bedrock-agentcore:CreateEvent/ListEvents/DeleteEvent/ListSessions/RetrieveMemoryRecords`（memoryId設定時のみ追加） |

### 主要機能

- セッション内会話履歴の自動保持（短期メモリ、TTL 3日間、最小値）
- セッション横断のユーザー嗜好・知識の自動抽出（semantic戦略）
- セッション会話要約の自動生成（summary戦略）
- サイドバーにセッション一覧・メモリセクション表示
- KBモード・Agentモード両方で会話コンテキスト維持
- 8言語i18n対応（`agentcore.memory.*`, `agentcore.session.*`）

### デプロイ時の注意事項

| 項目 | 制約 | 対応 |
|------|------|------|
| Memory Name | `^[a-zA-Z][a-zA-Z0-9_]{0,47}$`（ハイフン不可） | `prefix.replace(/-/g, '_')` で変換 |
| EventExpiryDuration | 日数（min: 3, max: 365） | 3日間（最小値） |
| サービスプリンシパル | `bedrock-agentcore.amazonaws.com` | `bedrock.amazonaws.com` ではない |
| Tags形式 | マップ `{ key: value }` | CDKデフォルトの配列形式を `addPropertyOverride` で上書き |
| actorId | `[a-zA-Z0-9][a-zA-Z0-9-_/]*` | メールアドレスの `@` `.` を置換 |

### CDKコンテキストパラメータ

| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `enableAgentCoreMemory` | `false` | AgentCore Memory有効化（`enableAgent=true` が前提条件） |

### 環境変数

| 変数名 | 説明 |
|--------|------|
| `AGENTCORE_MEMORY_ID` | AgentCore Memory ID（CDK出力） |
| `ENABLE_AGENTCORE_MEMORY` | Memory機能有効フラグ |

---

## システム全体アーキテクチャ

```
+----------+     +----------+     +------------+     +---------------------+
| Browser  |---->| AWS WAF  |---->| CloudFront |---->| Lambda Web Adapter  |
+----------+     +----------+     | (OAC+Geo)  |     | (Next.js, IAM Auth) |
                                  +------------+     +------+--------------+
                                                            |
                      +---------------------+---------------+--------------------+
                      v                     v               v                    v
             +-------------+    +------------------+ +--------------+   +--------------+
             | Cognito     |    | Bedrock KB       | | DynamoDB     |   | DynamoDB     |
             | User Pool   |    | + S3 Vectors /   | | user-access  |   | perm-cache   |
             +-------------+    |   OpenSearch SL  | | (SID Data)   |   | (Perm Cache) |
                                +--------+---------+ +--------------+   +--------------+
                                         |
                             +-----------+-----------+
                             v                       v
                    +----------------+     +------------------+
                    | S3 Bucket      |     | FSx for ONTAP    |
                    | (Metadata Sync)|     | (SVM + Volume)   |
                    +----------------+     +--------+---------+
                                                    | CIFS/SMB
                                                    v
                                           +------------------+
                                           | Embedding EC2    |
                                           | (Titan Embed v2) |
                                           +------------------+
```

### CDKスタック構成（7スタック）

| # | スタック | リージョン | 主要リソース |
|---|---------|-----------|-------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IPセット |
| 2 | NetworkingStack | ap-northeast-1 | VPC, サブネット, セキュリティグループ, VPCエンドポイント（オプション） |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + Cognito Domain（AD Federation有効時）, AD Sync Lambda（オプション） |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, AD, KMS暗号化（オプション）, CloudTrail（オプション） |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless（`vectorStoreType`で選択）, Bedrock Guardrails（オプション） |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker), CloudFront, Permission Filter Lambda（オプション）, MonitoringConstruct（オプション） |
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
| `enableMonitoring` | - | `false` | CloudWatchダッシュボード + SNSアラート + EventBridge監視 |
| `monitoringEmail` | - | (なし) | アラート通知先メールアドレス |
| `enableAgentCoreMemory` | - | `false` | AgentCore Memory（短期・長期メモリ）を有効化（`enableAgent=true` が前提条件） |
| `enableAgentCoreObservability` | - | `false` | AgentCore Runtimeメトリクスをダッシュボードに統合 |
| `enableAdvancedPermissions` | - | `false` | 時間ベースアクセス制御 + 権限判定監査ログ |