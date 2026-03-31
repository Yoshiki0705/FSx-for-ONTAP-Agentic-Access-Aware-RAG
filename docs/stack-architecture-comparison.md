# デモスタック・統合スタック アーキテクチャ比較

**最終更新**: 2026-03-29  
**ステータス**: 統一完了（Phase 1〜4 全て実装済み）、S3 Vectors統合検証済み

---

## 概要

デモスタック（`lib/stacks/demo/`）に統合スタック（`lib/stacks/integrated/`）の自動化機能を段階的に組み込み、統一を完了しました。本ドキュメントは両スタックの機能差分と、デモスタックで利用可能なオプション機能をまとめています。

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

---

## データ取り込みパス

| パス | 方式 | 有効化 | 用途 |
|------|------|--------|------|
| メイン | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 通常ボリューム |
| フォールバック | S3バケット直接アップロード → Bedrock KB | `upload-demo-data.sh` | S3 AP非対応時 |
| 代替 | CIFSマウント → Embeddingサーバー → ベクトルストア直接書き込み | `enableEmbeddingServer=true` | FlexCacheボリューム（AOSS構成時のみ） |

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

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | デプロイ手順・CDKコンテキストパラメータ一覧 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDフィルタリング設計・データ取り込みパス詳細 |
| [embedding-server-design.md](embedding-server-design.md) | Embeddingサーバー設計（ONTAP ACL自動取得含む） |
| [ui-specification.md](ui-specification.md) | UI仕様（カードUI、KB/Agentモード切替） |
