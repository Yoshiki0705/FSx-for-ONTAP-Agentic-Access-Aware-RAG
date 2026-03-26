# Embeddingサーバー 設計・実装ドキュメント

**作成日**: 2026-03-26  
**対象**: 開発者・運用者  
**ソースコード**: `docker/embed/`

---

## 概要

FSx ONTAP上のドキュメントをCIFS/SMBマウント経由で読み取り、Amazon Bedrock Titan Embed Text v2でベクトル化し、OpenSearch Serverless（AOSS）にインデックスするサーバーです。

Bedrock KBのS3データソース（Option A）やS3 Access Point（Option C）が使えない場合の代替パス（Option B）として使用します。

---

## アーキテクチャ

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB マウント
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. ファイルスキャン（再帰、.md/.txt/.html等）
  ├── 2. .metadata.json からSID情報読み取り
  ├── 3. テキストチャンク分割（1000文字、200文字オーバーラップ）
  ├── 4. Bedrock Titan Embed v2 でベクトル化（1024次元）
  └── 5. AOSS にインデックス（Bedrock KB互換フォーマット）
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## ソースコード構成

```
docker/embed/
├── src/
│   ├── index.ts       # メイン処理（スキャン→チャンク→Embedding→インデックス）
│   └── oss-client.ts  # AOSS SigV4署名クライアント（IMDS認証対応）
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild用ビルド定義
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## 実行モード

| モード | 環境変数 | 動作 |
|--------|---------|------|
| バッチモード | `ENV_WATCH_MODE=false`（デフォルト） | 全ファイルを1回処理して終了 |
| 監視モード | `ENV_WATCH_MODE=true` | chokidarでファイル変更を検知し自動処理 |

---

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|----------|------|
| `ENV_REGION` | `ap-northeast-1` | AWSリージョン |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | CIFSマウントされたデータディレクトリ |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | 処理済みファイル記録の保存先 |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Embeddingモデル |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | AOSSインデックス名 |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | (必須) | AOSSコレクション名 |
| `ENV_WATCH_MODE` | `false` | 監視モード有効化 |
| `ENV_AUTO_METADATA` | `false` | ONTAP REST APIによる.metadata.json自動生成 |
| `ENV_ONTAP_MGMT_IP` | (空) | ONTAP管理エンドポイントIP |
| `ENV_ONTAP_SVM_UUID` | (空) | SVM UUID |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | ONTAP管理者ユーザー名 |
| `ENV_ONTAP_PASSWORD` | (空) | ONTAP管理者パスワード |

---

## 処理フロー

### バッチモード

```
1. AOSS クライアント初期化（コレクションエンドポイント取得）
2. processed.json をロード（差分処理用）
3. DATA_DIR を再帰スキャン（.md, .txt, .html, .csv, .json, .xml）
4. 各ファイルについて:
   a. mtime が processed.json と同じならスキップ
   b. .metadata.json が存在すればそれを使用
   c. .metadata.json が存在せず ENV_AUTO_METADATA=true の場合:
      - ONTAP REST API (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`) でACL取得
      - ACLからSIDを抽出し .metadata.json を自動生成・書き込み
   d. テキスト読み取り → チャンク分割（1000文字、200文字オーバーラップ）
   e. 各チャンクを Bedrock Titan Embed v2 でベクトル化
   f. AOSS にインデックス（Bedrock KB互換フォーマット）
   g. processed.json を更新
5. 処理完了サマリーを出力して終了
```

### 監視モード

```
1-5. バッチモードと同じ（初回スキャン）
6. chokidar でファイル監視開始
   - awaitWriteFinish: 2秒（書き込み完了を待機）
7. ファイル追加/変更イベント → キューに追加
8. キューから順次処理（並行実行防止）
   - processFile() → processed.json 更新
9. 無限ループで待機
```

---

## 差分処理の仕組み

`processed.json`でファイルパスと更新日時（mtime）を記録します。

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- ファイルのmtimeが変わっていなければスキップ
- ファイルが更新されていれば再処理（上書きインデックス）
- `processed.json`を削除すれば全ファイルを再処理

### 以前のバージョンとの違い

| 項目 | 以前のバージョン | 現在のバージョン |
|------|----------------|----------------|
| 差分管理 | SQLite (drizzle-orm + better-sqlite3) | JSON ファイル (processed.json) |
| ファイル識別 | inode番号 (files.ino) | ファイルパス + mtime |
| 大量ファイル同時アップロード | UNIQUE constraint failed | ✅ 順次キューで安全に処理 |
| 依存関係 | drizzle-orm, better-sqlite3 | なし（標準fs） |

---

## AOSSインデックスフォーマット

Bedrock KB互換の3フィールドのみを書き込みます。

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024次元
  "AMAZON_BEDROCK_TEXT_CHUNK": "ドキュメントのテキストチャンク",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### 重要: AOSSインデックスのスキーマ互換性

AOSSインデックスは`dynamic: false`で作成されています。これにより:
- 上記3フィールド以外のフィールドが書き込まれてもインデックスマッピングは変わらない
- Bedrock KBの同期が「storage configuration invalid」エラーを起こさない
- メタデータ（SID情報等）は`AMAZON_BEDROCK_METADATA`フィールド内のJSON文字列として格納

### メタデータの構造

各ドキュメントには対応する`.metadata.json`ファイルが必要です。このファイルにNTFS ACLのSID情報を記載することで、RAG検索時のアクセス制御が実現されます。

#### `.metadata.json`のSID情報の取得方法

本システムには、NTFS ACLからSIDを自動取得する仕組みが実装されています。

| コンポーネント | 実装ファイル | 機能 |
|--------------|------------|------|
| AD同期Lambda | `lambda/agent-core-ad-sync/index.ts` | SSM経由でPowerShellを実行し、ADユーザーのSID情報を取得してDynamoDBに保存 |
| FSx権限サービス | `lambda/permissions/fsx-permission-service.ts` | SSM経由でGet-Aclを実行し、ファイル/ディレクトリのNTFS ACL（SID）を取得 |
| AD Sync設定 | `types/agentcore-config.ts` (`AdSyncConfig`) | AD同期の有効化、キャッシュTTL、SSMタイムアウト等の設定 |

これらは統合スタック構成（`lib/stacks/integrated/`）に組み込まれています。デモスタック構成（`lib/stacks/demo/`）では、検証用にサンプルの`.metadata.json`を手動配置しています。

#### SID自動取得の処理フロー

```
1. AD同期Lambda（ユーザーSID取得）
   SSM → Windows EC2 → PowerShell (Get-ADUser) → SID取得 → DynamoDB user-access に保存

2. FSx権限サービス（ファイルACL取得）
   SSM → Windows EC2 → PowerShell (Get-Acl) → NTFS ACL取得 → SID抽出 → .metadata.json 生成可能
```

#### デモ環境での簡易セットアップ

デモスタックでは上記の自動化を使わず、以下の手動手順でSIDデータを設定しています:

- `.metadata.json`: `demo-data/documents/`配下にサンプルを手動配置
- DynamoDB user-access: `demo-data/scripts/setup-user-access.sh`でメールアドレスとSIDの対応を手動登録

#### 本番環境での自動化オプション

| 方法 | 説明 |
|------|------|
| AD同期Lambda | SSM経由でADユーザーのSIDを自動取得しDynamoDBに保存（実装済み） |
| FSx権限サービス | SSM経由でGet-AclでNTFS ACLを取得（実装済み） |
| ONTAP REST API | FSx ONTAP管理エンドポイント経由でACLを直接取得（実装済み: `ENV_AUTO_METADATA=true`） |
| S3 Access Point | S3 AP経由でファイルアクセス時にNTFS ACLが自動適用される（CDK対応済み: `useS3AccessPoint=true`） |

#### S3 Access Point利用時（Option C）

S3 Access Point経由でBedrock KBがドキュメントを取り込む場合、NTFS ACLはS3 Access Pointの`FileSystemIdentity`（WINDOWSタイプ）で自動適用されます。ただし、Bedrock KBのRetrieve APIが返すメタデータにACL情報が含まれるかは、S3 Access Pointの実装に依存します。現時点では`.metadata.json`によるSID管理が確実な方法です。

#### `.metadata.json`のフォーマット

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → AMAZON_BEDROCK_METADATA に格納される値
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## AOSS認証（SigV4署名）

`oss-client.ts`はAWS SigV4署名を使用してAOSSにアクセスします。

- EC2インスタンスプロファイル（IMDS）から認証情報を自動取得
- `@aws-sdk/credential-provider-node`のdefaultProviderを使用
- 認証情報は有効期限5分前に自動リフレッシュ
- AOSSのサービス名は`aoss`

---

## 大量ファイル同時アップロード対策

監視モードで20ファイル以上が同時にアップロードされた場合:

1. chokidarの`awaitWriteFinish`（2秒）で書き込み完了を待機
2. 各ファイルイベントはキューに追加
3. キューから1ファイルずつ順次処理（`processing`フラグで排他制御）
4. 各チャンクのEmbedding後に200msの待機（Bedrock APIレートリミット対策）
5. 処理完了後に`processed.json`を更新

これにより:
- Bedrock APIのレートリミットに引っかからない
- `processed.json`への同時書き込みが発生しない
- 処理中にプロセスが停止しても、`processed.json`に記録済みのファイルは再処理されない

---

## CDKスタック

`DemoEmbeddingStack`（`lib/stacks/demo/demo-embedding-stack.ts`）で以下を作成:

| リソース | 説明 |
|---------|------|
| EC2インスタンス (m5.large) | IMDSv2強制、SSM対応 |
| ECRリポジトリ | Embeddingコンテナイメージ用 |
| IAMロール | SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager |
| セキュリティグループ | FSx SG + AD SGとの通信許可 |
| UserData | CIFS自動マウント + Docker自動起動 |

### 有効化

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| AOSS 403 Forbidden | データアクセスポリシーにEC2ロール未追加 | AOSSポリシーにEmbedding EC2ロールを追加 |
| Bedrock ThrottlingException | APIレートリミット超過 | チャンク間の待機時間を増やす（200ms→500ms） |
| CIFSマウント失敗 | SVM未AD参加 or CIFS共有未作成 | AD参加確認 + ONTAP REST APIでCIFS共有作成 |
| processed.json破損 | プロセス中断 | `processed.json`を削除して再実行 |
| KB同期エラー (storage config invalid) | AOSSインデックスにKB非互換フィールドが存在 | インデックス削除→再作成→データソース再作成→同期 |
| 全ドキュメントがSIDフィルタリングでDENY | Embeddingサーバー経由のドキュメントにメタデータなし | `.metadata.json`が存在し`allowed_group_sids`が設定されているか確認 |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | デプロイ手順（Option B） |
| [docs/implementation-overview.md](implementation-overview.md) | 実装概要（項目5: Embedding Server） |
| [docs/ui-specification.md](ui-specification.md) | UI仕様（ディレクトリ表示） |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | 検証環境での運用手順 |
