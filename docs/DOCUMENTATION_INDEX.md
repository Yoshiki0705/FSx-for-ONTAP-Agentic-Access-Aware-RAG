# ドキュメントインデックス

## はじめに読むべきドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | システム概要、アーキテクチャ、デプロイ手順、WAF/Geo設定 |
| [docs/implementation-overview.md](implementation-overview.md) | 実装内容の詳細説明（7つの観点） |
| [docs/SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDベース権限フィルタリングの詳細設計 |
| [docs/verification-report.md](verification-report.md) | デプロイ後の検証手順とテストケース |
| [docs/demo-recording-guide.md](demo-recording-guide.md) | 検証デモ動画撮影手順書（6つの証跡） |

## セットアップ・検証

| ドキュメント | 内容 |
|-------------|------|
| [demo-data/guides/demo-scenario.md](../demo-data/guides/demo-scenario.md) | 検証シナリオ（管理者 vs 一般ユーザーの権限差異確認） |
| [demo-data/guides/ontap-setup-guide.md](../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD連携・CIFS共有・NTFS ACL設定（検証済み手順） |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | 検証環境のリソースID・アクセス情報・Embeddingサーバー手順 |

## Embeddingサーバー（FlexCache CIFSマウント経由）

| ドキュメント / ファイル | 内容 |
|------------------------|------|
| [docs/demo-environment-guide.md#6](demo-environment-guide.md) | Embeddingサーバーのデプロイ・運用手順 |
| `docker/embed/src/index.ts` | Embeddingアプリ本体（ドキュメントスキャン→チャンク分割→ベクトル化→インデックス） |
| `docker/embed/src/oss-client.ts` | OpenSearch Serverless SigV4署名クライアント（IMDS認証対応） |
| `docker/embed/Dockerfile` | Embeddingコンテナ定義（node:22-slim, cifs-utils） |
| `docker/embed/buildspec.yml` | CodeBuild用ビルド定義 |
| `lib/stacks/demo/demo-embedding-stack.ts` | EmbeddingStack CDK定義（EC2 + ECR + IAM） |

## セットアップスクリプト

| スクリプト | 内容 |
|-----------|------|
| `demo-data/scripts/create-demo-users.sh` | Cognitoテストユーザー作成 |
| `demo-data/scripts/setup-user-access.sh` | DynamoDB SIDデータ登録 |
| `demo-data/scripts/upload-demo-data.sh` | S3へのテストドキュメントアップロード |
| `demo-data/scripts/sync-kb-datasource.sh` | Bedrock KBデータソース同期 |

## 推奨読書順序

1. **README.md** — システム全体像とデプロイ手順
2. **implementation-overview.md** — 7つの観点での実装内容詳細
3. **SID-Filtering-Architecture.md** — コア機能の技術詳細
4. **demo-recording-guide.md** — 検証デモ動画撮影手順書
5. **ontap-setup-guide.md** — FSx ONTAP AD連携・CIFS共有設定
6. **demo-environment-guide.md** — 検証環境セットアップ（Embeddingサーバー含む）
7. **demo-scenario.md** — 検証シナリオの実行
8. **verification-report.md** — API レベルの検証手順
