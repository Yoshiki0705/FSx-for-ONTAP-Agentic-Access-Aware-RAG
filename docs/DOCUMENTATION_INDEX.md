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
| [demo-data/guides/ontap-setup-guide.md](../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP CLI/REST APIによるボリューム・ACL設定 |

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
3. **demo-scenario.md** — 検証シナリオの実行
4. **verification-report.md** — API レベルの検証手順
