# CDKスタック アーキテクチャガイド

**🌐 Language:** **日本語** | [English](en/stack-architecture-comparison.md) | [한국어](ko/stack-architecture-comparison.md) | [简体中文](zh-CN/stack-architecture-comparison.md) | [繁體中文](zh-TW/stack-architecture-comparison.md) | [Français](fr/stack-architecture-comparison.md) | [Deutsch](de/stack-architecture-comparison.md) | [Español](es/stack-architecture-comparison.md)

**最終更新**: 2026-03-31  
**ステータス**: デモスタック系統に一本化完了、S3 Vectors統合検証済み

---

## 概要

全てのCDKスタックは `lib/stacks/demo/` に一本化されています。エントリーポイントは `bin/demo-app.ts` のみです。CDKコンテキストパラメータでオプション機能を有効化できます。

---

## 機能比較

| 機能 | デモスタック（現行） | CDKコンテキスト | 備考 |
|------|---------------------|----------------|------|
| 認証 | Cognito + AD（オプション） | `adPassword`, `adDomainName` | AD未設定時はCognitoのみ |
| SID自動取得 | AD Sync Lambda | `adType=managed\|self-managed` | AD未設定時は手動（`setup-user-access.sh`） |
| NTFS ACL取得 | Embeddingサーバー内で自動生成 | `ontapMgmtIp`, `ontapSvmUuid` | 未設定時は手動`.metadata.json` |
| 権限フィルタリング | Next.js API Route内（デフォルト） | `usePermissionFilterLambda=true` | 専用Lambda移行も可能 |
| Bedrock Agent | 動的Agent作成 + Action Group | `enableAgent=true` | カードクリック時にカテゴリ別Agent自動作成 |
| Bedrock Guardrails | コンテンツ安全性 + PII保護 | `enableGuardrails=true` | |
| KMS暗号化 | S3・DynamoDB CMK暗号化 | `enableKmsEncryption=true` | キーローテーション有効 |
| CloudTrail | S3データアクセス + Lambda監査 | `enableCloudTrail=true` | 90日保持 |
| VPCエンドポイント | S3, DynamoDB, Bedrock等 | `enableVpcEndpoints=true` | 6サービス対応 |
| Embeddingサーバー | FlexCache CIFSマウント + ベクトルストア直接書き込み | `enableEmbeddingServer=true` | S3 AP非対応時の代替パス（AOSS構成時のみ） |
| 高度権限制御 | 時間ベースアクセス制御 + 権限判定監査ログ | `enableAdvancedPermissions=true` | `permission-audit` DynamoDBテーブル + GSI |

---

## データ取り込みパス

| パス | 方式 | 有効化 | 用途 |
|------|------|--------|------|
| メイン | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 通常ボリューム |
| フォールバック | S3バケット直接アップロード → Bedrock KB | `upload-demo-data.sh` | S3 AP非対応時 |
| 代替 | CIFSマウント → Embeddingサーバー → ベクトルストア直接書き込み | `enableEmbeddingServer=true` | FlexCacheボリューム（AOSS構成時のみ） |

---

## Bedrock KB Ingestion Job — クォータと設計考慮点

Bedrock KB Ingestion Jobはドキュメントの取得・チャンク分割・ベクトル化・格納を全て管理するマネージドサービスです。S3 Access Point経由でFSx ONTAPのデータを直接読み取り、差分同期（インクリメンタル）で変更されたファイルのみ処理します。独自のEmbeddingパイプライン（AWS Batch等）は不要です。

### サービスクォータ（2026年3月時点、全て調整不可）

| クォータ | 値 | 設計への影響 |
|---------|-----|-------------|
| 1ジョブあたりのデータサイズ | 100GB | 超過分は処理されない。100GB超のデータソースは複数データソースに分割が必要 |
| 1ファイルあたりのサイズ | 50MB | 大容量PDFは分割が必要 |
| 1ジョブあたりの追加・更新ファイル数 | 5,000,000 | 通常の企業ドキュメント規模では十分 |
| 1ジョブあたりの削除ファイル数 | 5,000,000 | 同上 |
| BDAパーサー使用時のファイル数 | 1,000 | Bedrock Data Automationパーサー使用時の制限 |
| FMパーサー使用時のファイル数 | 1,000 | Foundation Modelパーサー使用時の制限 |
| データソース数/KB | 5 | 複数ボリュームを個別データソースとして登録する場合の上限 |
| KB数/アカウント | 100 | マルチテナント設計時の考慮点 |
| 同時実行ジョブ数/アカウント | 5 | 複数KBの並行同期時の制約 |
| 同時実行ジョブ数/KB | 1 | 同一KBへの並行同期は不可。前のジョブ完了を待つ必要あり |
| 同時実行ジョブ数/データソース | 1 | 同上 |

### 実行トリガーと頻度の制約

| 項目 | 値 | 備考 |
|------|-----|------|
| StartIngestionJob APIレート | 0.1 req/sec（10秒に1回） | **調整不可**。高頻度の自動同期には不向き |
| 実行トリガー | 手動（API/CLI/コンソール） | 自動スケジュール機能はBedrock KB側にはない |
| 同期方式 | 差分同期（インクリメンタル） | 追加・変更・削除のみ処理。全件再処理は不要 |
| 同期所要時間 | データ量依存（数十秒〜数時間） | 小規模（数十ファイル）: 30秒〜2分、大規模: 数時間 |

### 自動同期のスケジューリング

Bedrock KB自体にはスケジュール同期機能がないため、定期同期が必要な場合は以下の方法で実装します:

```bash
# EventBridge Schedulerで定期実行（例: 1時間ごと）
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

または、FSx ONTAPのファイル変更をS3イベント通知経由で検知してIngestion Jobをトリガーする方法もあります。ただし、StartIngestionJob APIのレートリミット（10秒に1回）に注意が必要です。

### 設計上の推奨事項

1. **同期頻度**: リアルタイム同期は不可。最短でも10秒間隔、実用的には15分〜1時間間隔を推奨
2. **大規模データ**: 100GB超のデータソースは複数のFSx ONTAPボリューム（= 複数S3 AP = 複数データソース）に分割
3. **並行処理**: 同一KBへの並行同期は不可。複数データソースの同期は順次実行
4. **エラーハンドリング**: ジョブ失敗時のリトライロジックを実装（`GetIngestionJob`でステータス監視）
5. **独自Embeddingパイプライン不要**: Bedrock KBがチャンク分割・ベクトル化・格納を全て管理するため、AWS Batch等の独自パイプラインは不要

---

## CDKスタック構成（7スタック）

| # | Stack | 必須/任意 | 説明 |
|---|-------|----------|------|
| 1 | WafStack | 必須 | CloudFront用WAF（us-east-1） |
| 2 | NetworkingStack | 必須 | VPC, サブネット, SG |
| 3 | SecurityStack | 必須 | Cognito User Pool |
| 4 | StorageStack | 必須 | FSx ONTAP + SVM + Volume（または既存参照）, S3, DynamoDB×2 |
| 5 | AIStack | 必須 | Bedrock KB, S3 Vectors or OpenSearch Serverless, Agent（オプション） |
| 6 | WebAppStack | 必須 | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | 任意 | FlexCache CIFSマウント + Embeddingサーバー |

### 既存FSx for ONTAP参照モード

StorageStackは`existingFileSystemId`/`existingSvmId`/`existingVolumeId`パラメータで既存FSx ONTAPリソースを参照できます。この場合：
- FSx/SVM/Volumeの新規作成をスキップ（デプロイ時間30-40分短縮）
- Managed ADの作成もスキップ（既存環境のAD設定を使用）
- S3バケット、DynamoDBテーブル、S3 APカスタムリソースは通常通り作成
- `cdk destroy`でFSx/SVM/Volumeは削除されない（CDK管理外）

---

## ベクトルストア構成比較

CDKコンテキストパラメータ`vectorStoreType`により、ベクトルストア構成を切り替えられます。3つ目の構成（S3 Vectors + AOSSエクスポート）は、S3 Vectors構成上でオンデマンドにエクスポートする運用手順として提供されます。

> **リージョン対応**: S3 Vectorsは`ap-northeast-1`（東京リージョン）で利用可能です。

| 項目 | OpenSearch Serverless | S3 Vectors 単体 | S3 Vectors + AOSS Export |
|------|----------------------|-----------------|--------------------------|
| **CDKパラメータ** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors`（デフォルト） | 構成2の上で`export-to-opensearch.sh`を実行 |
| **コスト** | ~$700/月（2 OCU常時稼働） | 月数ドル（小規模） | S3 Vectors + AOSS OCU（エクスポート時のみ） |
| **レイテンシ** | ~10ms | サブ秒（コールド）、~100ms（ウォーム） | ~10ms（エクスポート後のAOSS検索） |
| **フィルタリング** | メタデータフィルタ（`$eq`, `$ne`, `$in`等） | メタデータフィルタ（`$eq`, `$in`, `$and`, `$or`） | エクスポート後はAOSSのフィルタリング |
| **メタデータ制約** | 制約なし | filterable 2KB/vector（カスタムは実質1KB）、non-filterable keys最大10個 | エクスポート後はAOSSの制約に従う |
| **ユースケース** | 高パフォーマンス必須の本番環境 | コスト最適化・デモ・開発環境 | 一時的な高パフォーマンス需要 |
| **運用手順** | CDKデプロイのみ | CDKデプロイのみ | CDKデプロイ後に`export-to-opensearch.sh`を実行。エクスポート用IAMロール自動作成 |

> **S3 Vectorsメタデータ制約**: Bedrock KB + S3 Vectorsの場合、カスタムメタデータは実質1KB以下に制限されます（filterable metadata 2KBのうち~1KBをBedrock KB内部メタデータが消費）。CDKコードでは全メタデータをnon-filterableに設定して2KB制限を回避しています。SIDフィルタリングはアプリ側で実施するため、S3 VectorsのQueryVectors filterは不要です。詳細は[docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md)を参照。

### エクスポートに関する注意事項

- エクスポートは**ポイントインタイムのコピー**です。S3 Vectorsのデータ更新後は再エクスポートが必要です（継続的な同期は行われません）
- エクスポート時にAOSSコレクション、OSIパイプライン、IAMサービスロール、DLQ用S3バケットが自動作成されます
- コンソールの「Create and use a new service role」オプションでIAMロールが自動作成されるため、事前のロール作成は不要です
- エクスポート所要時間は約15分（AOSSコレクション作成5分 + パイプライン作成5分 + データ転送5分）
- OSIパイプラインはデータ転送完了後に**自動停止**します（コスト効率）
- OSIパイプライン停止後もAOSSコレクションは検索可能です
- **不要になったAOSSコレクションは手動で削除してください**（CDK管理外のため`cdk destroy`では削除されません。OCU課金が継続します）

---

## S3 Vectors実装時の知見（検証済み）

以下はap-northeast-1（東京リージョン）での実デプロイ検証（2026-03-29）で得られた知見です。

### SDK/API関連

| 項目 | 知見 |
|------|------|
| SDK v3レスポンス | `CreateVectorBucketCommand`/`CreateIndexCommand`のレスポンスに`vectorBucketArn`/`indexArn`が含まれない。`$metadata`のみ。ARNは`arn:aws:s3vectors:{region}:{account}:bucket/{name}`パターンで構築が必要 |
| APIコマンド名 | `CreateIndexCommand`/`DeleteIndexCommand`が正しい。`CreateVectorBucketIndexCommand`は存在しない |
| CreateIndex必須パラメータ | `dataType: 'float32'`が必須。省略するとバリデーションエラー |
| メタデータ設計 | 全メタデータキーはデフォルトでfilterable。`metadataConfiguration`は`nonFilterableMetadataKeys`のみを指定する。`allowed_group_sids`をfilterableにするための明示的設定は不要 |

### Bedrock KB関連

| 項目 | 知見 |
|------|------|
| S3VectorsConfiguration | `indexArn`と`indexName`は排他的。両方指定すると`2 subschemas matched instead of one`エラー。`indexArn`のみを使用する |
| IAM権限検証 | Bedrock KBはCreate時にKB Roleの`s3vectors:QueryVectors`権限を検証する。IAMポリシーがKB作成前に適用されている必要がある |
| 必要なIAMアクション | `s3vectors:QueryVectors`, `s3vectors:PutVectors`, `s3vectors:DeleteVectors`, `s3vectors:GetVectors`, `s3vectors:ListVectors`の5つが必要 |

### CDK/CloudFormation関連

| 項目 | 知見 |
|------|------|
| IAMポリシーのリソースARN | カスタムリソースの`GetAtt`トークンではなく、明示的ARNパターンを使用する。これにより依存関係の問題を回避 |
| CloudFormation Hook | Organization-levelの`AWS::EarlyValidation::ResourceExistenceCheck` Hookがchange-setをブロックする場合、`--method=direct`で回避可能 |
| デプロイ時間 | AIスタック（S3 Vectors構成）のデプロイ時間は約83秒（AOSS構成の約5分と比較して大幅に短縮） |

---

---

## 将来の拡張オプション

以下の機能は現在未実装ですが、CDKコンテキストパラメータによるオプション機能として追加可能な設計です。

| 機能 | 概要 | 想定パラメータ |
|------|------|---------------|
| 監視・アラート | CloudWatchダッシュボード（全スタック横断メトリクス）、SNSアラート（エラー率・レイテンシ閾値超過） | `enableMonitoring=true` |
| 高度権限制御 | 時間ベースアクセス制御（業務時間内のみ許可）、地理的アクセス制限（IPジオロケーション）、DynamoDB監査ログ | `enableAdvancedPermissions=true` |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | デプロイ手順・CDKコンテキストパラメータ一覧 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDフィルタリング設計・データ取り込みパス詳細 |
| [embedding-server-design.md](embedding-server-design.md) | Embeddingサーバー設計（ONTAP ACL自動取得含む） |
| [ui-specification.md](ui-specification.md) | UI仕様（カードUI、KB/Agentモード切替） |