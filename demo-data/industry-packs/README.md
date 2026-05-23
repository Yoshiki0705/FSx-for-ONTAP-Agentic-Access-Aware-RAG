# Industry Packs — 業種別デモデータパック

Permission-Aware RAG システムの業種別デモデータパックです。各業種に特化したリアルなドキュメントと権限メタデータを提供し、権限ベースのドキュメントアクセス制御をデモンストレーションできます。

## パック一覧

| パック | ドキュメント数 | 対象業種 |
|--------|-------------|---------|
| [government/](./government/) | 5 | 行政・自治体 |
| [healthcare/](./healthcare/) | 5 | 医療・病院 |
| [legal/](./legal/) | 5 | 法務・企業法務 |

## デプロイ方法

### 1. S3へのアップロード

```bash
# 特定のパックをデプロイ
aws s3 sync demo-data/industry-packs/government/ \
  s3://<YOUR-BUCKET>/industry-packs/government/ \
  --exclude "README.md"

# 全パックをデプロイ
aws s3 sync demo-data/industry-packs/ \
  s3://<YOUR-BUCKET>/industry-packs/ \
  --exclude "README.md"
```

### 2. FSx ONTAP経由でのアップロード（SFTP）

Transfer Family SFTP エンドポイント経由でアップロードする場合、`.metadata.json` はサービスロールが自動生成するため、ドキュメント本体のみをアップロードしてください。

```bash
# SFTPでアップロード（メタデータは自動生成される）
sftp -i <key.pem> user@<sftp-endpoint>
put government/policy-digital-transformation.md /government/
```

### 3. Knowledge Base 同期

```bash
# KB データソース同期をトリガー
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

## SID グループ定義

### 共通SID

| SID | グループ名 | 説明 |
|-----|-----------|------|
| `S-1-1-0` | Everyone | 全ユーザー（公開文書） |
| `S-1-5-21-...-512` | Domain Admins | ドメイン管理者 |

### Government（行政）パック

| SID 末尾 | グループ名 | 説明 |
|----------|-----------|------|
| `-2100` | 政策企画課 | DX推進方針等の政策文書にアクセス |
| `-2200` | 財政課 | 予算配分計画等の財務文書にアクセス |
| `-2300` | 危機管理課 | 災害対応計画等の危機管理文書にアクセス |

### Healthcare（医療）パック

| SID 末尾 | グループ名 | 説明 |
|----------|-----------|------|
| `-3100` | 内科 | 診療ガイドライン等の医療文書にアクセス |
| `-3200` | 看護部 | 手技手順書等の看護文書にアクセス |
| `-3300` | 薬剤部 | 薬物相互作用DB等の薬剤文書にアクセス |

### Legal（法務）パック

| SID 末尾 | グループ名 | 説明 |
|----------|-----------|------|
| `-4100` | 法務部 | 契約書テンプレート、コンプライアンス文書にアクセス |
| `-1100` | 開発部 | 特許ポートフォリオ（法務部と共有）にアクセス |

## デモシナリオ

### Government パック

| シナリオ | ユーザーロール | 期待結果 |
|---------|-------------|---------|
| 「DX推進方針を教えて」 | 政策企画課職員 | ✅ DX推進方針の内容を回答 |
| 「DX推進方針を教えて」 | 財政課職員 | ❌ アクセス拒否（権限なし） |
| 「予算配分を教えて」 | 財政課職員 | ✅ 予算配分計画の内容を回答 |
| 「住民窓口の対応方法は？」 | 任意の職員 | ✅ 公開文書のため全員アクセス可 |
| 「災害時の対応手順は？」 | 危機管理課職員 | ✅ 災害対応計画の内容を回答 |
| 「議会の議事録を見せて」 | 一般市民 | ✅ 公開文書のため全員アクセス可 |

### Healthcare パック

| シナリオ | ユーザーロール | 期待結果 |
|---------|-------------|---------|
| 「糖尿病の治療方針は？」 | 内科医師 | ✅ 診療ガイドラインの内容を回答 |
| 「糖尿病の治療方針は？」 | 薬剤師 | ❌ アクセス拒否（内科のみ） |
| 「注射の手順を教えて」 | 看護師 | ✅ 注射手技手順書の内容を回答 |
| 「注射の手順を教えて」 | 内科医師 | ✅ 内科もアクセス可能 |
| 「薬の相互作用は？」 | 薬剤師 | ✅ 薬物相互作用DBの内容を回答 |
| 「感染対策の基本は？」 | 任意の職員 | ✅ 公開文書のため全員アクセス可 |
| 「AI研究プロトコルは？」 | 管理者 | ✅ 管理者のみアクセス可 |

### Legal パック

| シナリオ | ユーザーロール | 期待結果 |
|---------|-------------|---------|
| 「NDAテンプレートを見せて」 | 法務部員 | ✅ NDAテンプレートの内容を回答 |
| 「NDAテンプレートを見せて」 | 営業部員 | ❌ アクセス拒否（法務部のみ） |
| 「訴訟リスクの状況は？」 | 管理者 | ✅ 管理者のみアクセス可 |
| 「特許ポートフォリオは？」 | 開発部員 | ✅ 開発部もアクセス可能 |
| 「契約レビューの手順は？」 | 任意の社員 | ✅ 公開文書のため全員アクセス可 |
| 「GDPR対応状況は？」 | 法務部員 | ✅ GDPRチェックリストの内容を回答 |

## 既存デモデータとの組み合わせ

Industry Packs は既存の `demo-data/` ディレクトリのデモデータと併用できます。

### 推奨構成

```
S3 Bucket (or FSx ONTAP volume)
├── demo-data/              # 既存の汎用デモデータ
│   ├── documents/
│   └── scripts/
└── industry-packs/         # 業種別パック（本ディレクトリ）
    ├── government/
    ├── healthcare/
    └── legal/
```

### Knowledge Base データソース設定

複数パックを同一 Knowledge Base に登録する場合、S3 プレフィックスでデータソースを分割することを推奨します：

```bash
# パックごとにデータソースを作成
aws bedrock-agent create-data-source \
  --knowledge-base-id <KB_ID> \
  --name "government-pack" \
  --data-source-configuration '{
    "s3Configuration": {
      "bucketArn": "arn:aws:s3:::<BUCKET>",
      "inclusionPrefixes": ["industry-packs/government/"]
    }
  }'
```

## メタデータ形式

各ドキュメントには対応する `.metadata.json` ファイルが必要です：

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-XXXX", "S-1-5-21-...-512"],
    "access_level": "internal",
    "doc_type": "policy"
  }
}
```

### フィールド説明

| フィールド | 説明 | 値の例 |
|-----------|------|--------|
| `allowed_group_sids` | アクセス許可されたADグループのSID一覧 | `["S-1-1-0"]`（全員） |
| `access_level` | 文書の機密レベル | `public`, `internal`, `medical`, `restricted`, `confidential` |
| `doc_type` | 文書の種類 | `policy`, `manual`, `budget`, `guideline`, `template` 等 |

### アクセスレベル定義

| レベル | 説明 |
|--------|------|
| `public` | 全ユーザーがアクセス可能（`S-1-1-0`） |
| `internal` | 組織内部のみ（特定部門グループ） |
| `medical` | 医療従事者のみ（医療パック固有） |
| `restricted` | 限定されたグループのみ |
| `confidential` | 管理者または特定の上位グループのみ |

## カスタムパックの作成

独自の業種パックを作成する場合：

1. `demo-data/industry-packs/<industry-name>/` ディレクトリを作成
2. Markdown形式でドキュメントを作成（日本語推奨、400〜500文字程度）
3. 各ドキュメントに対応する `.metadata.json` を作成
4. SIDグループの設計（`-XXXX` の番号体系を決定）
5. 本READMEにパック情報を追記
