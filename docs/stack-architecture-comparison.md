# デモスタック・統合スタック アーキテクチャ比較

**最終更新**: 2026-03-29  
**ステータス**: 統一完了（Phase 1〜4 全て実装済み）

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
| Embeddingサーバー | FlexCache CIFSマウント + AOSS | `enableEmbeddingServer=true` | S3 AP非対応時の代替パス |

---

## データ取り込みパス

| パス | 方式 | 有効化 | 用途 |
|------|------|--------|------|
| メイン | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 通常ボリューム |
| フォールバック | S3バケット直接アップロード → Bedrock KB | `upload-demo-data.sh` | S3 AP非対応時 |
| 代替 | CIFSマウント → Embeddingサーバー → AOSS | `enableEmbeddingServer=true` | FlexCacheボリューム |

---

## CDKスタック構成（7スタック）

| # | Stack | 必須/任意 | 説明 |
|---|-------|----------|------|
| 1 | WafStack | 必須 | CloudFront用WAF（us-east-1） |
| 2 | NetworkingStack | 必須 | VPC, サブネット, SG |
| 3 | SecurityStack | 必須 | Cognito User Pool |
| 4 | StorageStack | 必須 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2 |
| 5 | AIStack | 必須 | Bedrock KB, OpenSearch Serverless, Agent（オプション） |
| 6 | WebAppStack | 必須 | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | 任意 | FlexCache CIFSマウント + Embeddingサーバー |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | デプロイ手順・CDKコンテキストパラメータ一覧 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDフィルタリング設計・データ取り込みパス詳細 |
| [embedding-server-design.md](embedding-server-design.md) | Embeddingサーバー設計（ONTAP ACL自動取得含む） |
| [ui-specification.md](ui-specification.md) | UI仕様（カードUI、KB/Agentモード切替） |
