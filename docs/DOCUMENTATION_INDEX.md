# ドキュメントインデックス

## はじめに読むべきドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | システム概要、アーキテクチャ、デプロイ手順、WAF/Geo設定 |
| [docs/SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDベース権限フィルタリングの詳細設計 |
| [docs/verification-report.md](verification-report.md) | デプロイ後の検証手順とテストケース |

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
2. **SID-Filtering-Architecture.md** — コア機能の技術詳細
3. **ontap-setup-guide.md** — FSx ONTAP AD連携・CIFS共有設定
4. **demo-environment-guide.md** — 検証環境セットアップ（Embeddingサーバー含む）
5. **demo-scenario.md** — 検証シナリオの実行
6. **verification-report.md** — API レベルの検証手順
