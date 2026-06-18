# ドキュメントインデックス

**🌐 Language:** **日本語** | [English](en/DOCUMENTATION_INDEX.md) | [한국어](ko/DOCUMENTATION_INDEX.md) | [简体中文](zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](zh-TW/DOCUMENTATION_INDEX.md) | [Français](fr/DOCUMENTATION_INDEX.md) | [Deutsch](de/DOCUMENTATION_INDEX.md) | [Español](es/DOCUMENTATION_INDEX.md)

## はじめに読むべきドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | システム概要、アーキテクチャ、デプロイ手順、WAF/Geo設定 |
| [docs/auth-and-user-management.md](auth-and-user-management.md) | 認証・ユーザー管理ガイド（認証モード選択、AD Federation、SID自動登録、トラブルシューティング） |
| [docs/implementation-overview.md](implementation-overview.md) | 実装内容の詳細説明（14の観点: 画像分析RAG、KB接続UI、Smart Routing、監視・アラート、OIDC/LDAP Federation含む） |
| [docs/SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDベース権限フィルタリングの詳細設計 |
| [docs/verification-report.md](verification-report.md) | デプロイ後の検証手順とテストケース |
| [docs/ui-specification.md](ui-specification.md) | チャットボットUI仕様書（KB/Agentモード、Agent Directory、エンタープライズAgent機能、サイドバー設計） |
| [docs/demo-recording-guide.md](demo-recording-guide.md) | 検証デモ動画撮影手順書（6つの証跡） |
| [docs/embedding-server-design.md](embedding-server-design.md) | Embeddingサーバー設計・実装ドキュメント |
| [docs/stack-architecture-comparison.md](stack-architecture-comparison.md) | CDKスタック アーキテクチャガイド（ベクトルストア比較、実装知見） |
| [README.md#AD SAMLフェデレーション](../README.md#ad-samlフェデレーションオプション) | AD SAMLフェデレーション セットアップ手順（Managed AD / Self-managed AD） |

## セットアップ・検証

| ドキュメント | 内容 |
|-------------|------|
| [demo-data/guides/auth-mode-setup-guide.md](../demo-data/guides/auth-mode-setup-guide.md) | 認証モード別デモ環境構築ガイド（5モード、サンプル構成ファイル付き） |
| [demo-data/guides/demo-scenario.md](../demo-data/guides/demo-scenario.md) | 検証シナリオ（管理者 vs 一般ユーザーの権限差異確認、AD SSOサインイン、OIDC/LDAPサインイン） |
| [demo-data/guides/ontap-setup-guide.md](../demo-data/guides/ontap-setup-guide.md) | FSx for ONTAP + AD連携・CIFS共有・NTFS ACL設定・Name-Mapping設定（検証済み手順） |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | 検証環境のリソースID・アクセス情報・Embeddingサーバー手順 |

## エンタープライズ設計・運用ガイド

| ドキュメント | 内容 |
|-------------|------|
| [docs/production-readiness-checklist.md](production-readiness-checklist.md) | 本番化チェックリスト（Demo → PoC → Production の成熟度レベル定義、セキュリティ・監査・DR・運用の確認項目、承認者列付き） |
| [docs/poc-success-criteria-template.md](poc-success-criteria-template.md) | PoC 成功基準テンプレート（ステークホルダー定義、Go/No-Go 判定基準、次フェーズ条件、完了レポートテンプレート） |
| [docs/data-readiness-assessment.md](data-readiness-assessment.md) | データレディネス評価テンプレート（データ所在・分類・権限構造・品質・コンプライアンス確認、承認フロー） |
| [docs/partner-faq.md](partner-faq.md) | パートナー FAQ（顧客提案時の12の質問と回答、提案リソース一覧） |
| [docs/permission-consistency.md](permission-consistency.md) | 権限変更時の整合性モデル（ACL 変更の伝播フロー、最大遅延、緊急権限剥奪手順） |
| [docs/fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 性能・容量設計ガイド（規模別構成、S3 AP考慮点、QoS、ベクトルストア選定） |
| [docs/partner-deployment-patterns.md](partner-deployment-patterns.md) | マルチテナント・パートナー展開パターン（アカウント分離/SVM分離/ハイブリッド、コスト見積もりテンプレート） |
| [docs/governance-and-audit.md](governance-and-audit.md) | ガバナンス・監査設計（監査ログスキーマ、Responsible AI、Guardrailsポリシー、業種別ユースケース） |
| [docs/evaluation.md](evaluation.md) | RAG / Agent 評価メトリクス（ビジネスKPI、RAG品質、権限制御、Agent性能の4軸評価、PoC評価テンプレート） |
| [docs/safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全な実験ガイド（試行範囲定義、禁止事項、実データ投入チェックリスト、ロールバック手順） |
| [docs/threat-model.md](threat-model.md) | 脅威モデル（10の脅威カテゴリ、攻撃経路、既存緩和策、追加推奨、脅威→対策マッピング表） |
| [docs/cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | CloudWatch ダッシュボード運用ガイド（メトリクス一覧、アラーム定義、トラブルシューティングパターン） |
| [docs/poc-workshop-guide.md](poc-workshop-guide.md) | PoC ワークショップガイド（90分、デプロイ→テスト→評価→クリーンアップ） |
| [docs/cost-estimation-worksheet.md](cost-estimation-worksheet.md) | コスト見積もりワークシート（構成別月額概算テンプレート、計算式、最適化ポイント） |
| [docs/architecture-decision-records.md](architecture-decision-records.md) | Architecture Decision Records（6つの主要意思決定: ベクトルストア、権限フィルタ、認証、フロントエンド、同期、ルーティング） |
| [docs/managed-kb-migration-evaluation.md](managed-kb-migration-evaluation.md) | Amazon Bedrock Managed Knowledge Base 移行パス検討（既存 KB + OpenSearch Serverless / S3 Vectors との比較、Permission-aware RAG への影響、ACL メタデータフィルタ検証ポイント、段階移行手順）※AWS Summit NY 2026 |
| [docs/investigations/agentcore-web-search-integration.md](investigations/agentcore-web-search-integration.md) | AgentCore Web Search Tool を Permission-aware RAG のハイブリッド検索オプションとして統合する設計調査（UIトグル、us-east-1 クロスリージョン Gateway、Lambda Layer/inline、クエリ安全性・引用分離・プロンプトインジェクション防御、実装順序）※AWS Summit NY 2026 |
| [monitoring/athena-audit-tables.sql](../monitoring/athena-audit-tables.sql) | Athena テーブル定義（監査ログ分析用 DDL + サンプルクエリ） |
| [docs/benchmark-scenarios.md](benchmark-scenarios.md) | ベンチマークシナリオ（10K/100K/1M ファイル、5 計測シナリオ、理論的ベースライン推定値） |
| [demo-data/industry-packs/](../demo-data/industry-packs/) | 業種別デモデータパック（8 業種 × 5 ドキュメント: 行政・医療・法務・製造・建設・教育・保険 + 汎用） |
| [docs/s3ap-serverless-patterns-integration.md](s3ap-serverless-patterns-integration.md) | S3AP Serverless Patterns 連携アーキテクチャ（17 UC との 3 パターン連携） |
| [benchmarks/](../benchmarks/) | ベンチマークフレームワーク（テストデータ生成、実行スクリプト、結果テンプレート） |
| [tests/permission-matrix/](../tests/permission-matrix/) | 権限マトリクステスト（ACLエッジケース31シナリオ: Fail-Closed、グループネスティング、継承権限、緊急剥奪） |

## FSx for ONTAP 運用自動化

| ドキュメント | 内容 |
|-------------|------|
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | 運用自動化スイート概要（ディレクトリ構成、ユースケース一覧） |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | この構成で楽になる理由（設計判断、コスト見積もり、セキュリティ設計） |
| [automation/fsxn-ops/docs/aws-verification-report.md](../automation/fsxn-ops/docs/aws-verification-report.md) | AWS 環境統合検証レポート（2026-05-01実施、全Phase PASS） |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | 統合 CloudFormation テンプレート（VPC エンドポイント含む） |

## Transfer Family インジェスション

| ドキュメント | 内容 |
|-------------|------|
| [docs/transfer-family-e2e-verification.md](transfer-family-e2e-verification.md) | E2E検証レポート（SFTP接続→アップロード→KB取り込み完了、全ステップPASS） |
| [docs/transfer-family-partner-onboarding.md](transfer-family-partner-onboarding.md) | パートナーオンボーディングガイド（SSH鍵設定、SFTP接続、ファイル命名規則、トラブルシューティング） |
| [docs/transfer-family-networking-prerequisites.md](transfer-family-networking-prerequisites.md) | ネットワーキング前提条件（VPCエンドポイント、IP許可リスト、セキュリティグループ） |
| [docs/v4.2-demo-verification-supplement.md](v4.2-demo-verification-supplement.md) | v4.2 デモ検証補足ガイド（全ユースケースのテスト手順、期待結果、ログ取得方法） |

## サンプル構成ファイル

| ファイル | 認証モード | 内容 |
|---------|-----------|------|
| `demo-data/configs/mode-a-email-password.json` | メール/パスワード | 最小構成、手動SID登録 |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0（LDAPなし） |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP 同時有効化 |

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
| `demo-data/scripts/setup-openldap.sh` | OpenLDAPサーバー構築（EC2 VPC内、テストユーザー/グループ付き） |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API name-mappingルール設定 |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP統合検証（Lambda→LDAP→DynamoDB） |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP name-mapping検証（REST API接続・ルール取得） |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | モードC（OIDC+LDAP）ワンショットセットアップ（全Phase自動実行） |

## 推奨読書順序

### 初回セットアップ

1. **README.md** — システム全体像とデプロイ手順
2. **auth-and-user-management.md** — 認証モード選択とユーザー管理
3. **implementation-overview.md** — 22の観点での実装内容詳細
4. **SID-Filtering-Architecture.md** — コア機能の技術詳細
5. **safe-experimentation-guide.md** — 安全な実験ガイド（PoC開始前に必読）

### 検証・評価

6. **demo-recording-guide.md** — 検証デモ動画撮影手順書
7. **ontap-setup-guide.md** — FSx for ONTAP AD連携・CIFS共有設定
8. **demo-environment-guide.md** — 検証環境セットアップ
9. **demo-scenario.md** — 検証シナリオの実行
10. **evaluation.md** — PoC評価テンプレート

### 本番化・エンタープライズ設計

11. **production-readiness-checklist.md** — 本番化チェックリスト
12. **permission-consistency.md** — 権限変更時の整合性モデル
13. **fsxn-sizing-and-performance.md** — FSx for ONTAP 性能・容量設計
14. **governance-and-audit.md** — ガバナンス・監査設計
15. **partner-deployment-patterns.md** — マルチテナント展開パターン