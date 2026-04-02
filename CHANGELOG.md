# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2026-04

### Added
- **AgentCore Memory統合**: `enableAgentCoreMemory=true` で有効化。Bedrock AgentCore Memoryによる短期メモリ（セッション内会話履歴、TTL 3日間）+ 長期メモリ（semantic戦略: 事実・知識自動抽出、summary戦略: セッション要約自動生成）
- `CfnMemory` CDKリソース（AIStack内、`enableAgent=true` AND `enableAgentCoreMemory=true` 時のみ作成）
- バックエンドAPI: `/api/agentcore/memory/session`（CRUD）、`/api/agentcore/memory/event`（記録・取得）、`/api/agentcore/memory/search`（セマンティック検索）
- サイドバーUI: セッション一覧（`SessionList.tsx`）、長期メモリ表示・削除（`MemorySection.tsx`）
- KBモード会話コンテキスト統合（AgentCore Memoryから直近の会話履歴をConverse APIに追加）
- i18n: `agentcore.memory.*` / `agentcore.session.*` 翻訳キー（8言語対応）
- プロパティベーステスト + ユニットテスト追加
- **Advanced Permission Control**: `enableAdvancedPermissions=true` で有効化。時間ベースアクセス制御（`accessSchedule`フィールド）+ 権限判定監査ログ（`permission-audit` DynamoDBテーブル、GSI、TTL 90日）
- `ScheduleEvaluator`: タイムゾーン・曜日・時刻範囲によるアクセス制御（フェイルオープン設計）
- `AuditLogger`: 非ブロッキング監査ログ記録（リトライ3回、指数バックオフ）
- プロパティベーステスト6件（Property 1-6: ラウンドトリップ、スケジュール正当性、後方互換性、監査完全性、TTL正当性、SID不変性）
- **多言語ドキュメント**: `docs/` 配下の全11ドキュメントを8言語に翻訳（`docs/{en,ko,zh-CN,zh-TW,fr,de,es}/`）
- **S3 Access Point データソース**: FSx ONTAP S3 AP経由のBedrock KBデータソース設定・検証完了
- Steeringファイル: `.kiro/steering/multilingual-docs.md`（ドキュメント更新時の多言語自動反映ルール）
- **S3 Access Point ユーザータイプ設計ガイド**: NTFS×WINDOWS / NTFS×新規WINDOWS / UNIX×既存UNIX / UNIX×新規UNIX の4パターン決定マトリクス。CDKコンテキストパラメータ `volumeSecurityStyle`、`s3apUserType`、`s3apUserName` による明示的制御
- **README 8言語版**: `README.{en,ko,zh-CN,zh-TW,fr,de,es}.md` — 言語セレクター付き、S3 AP 4パターンガイド含む

### Changed
- `bin/demo-app.ts`: `enableAgentCoreMemory` コンテキストパラメータ追加
- `lib/stacks/demo/demo-ai-stack.ts`: CfnMemory リソース作成、Memory IAMロール（`bedrock-agentcore.amazonaws.com`）追加、Tags マップ形式上書き
- `lib/stacks/demo/demo-webapp-stack.ts`: `AGENTCORE_MEMORY_ID` / `ENABLE_AGENTCORE_MEMORY` 環境変数追加、`bedrock-agentcore:*` IAMポリシー条件付き追加、Lambda x86_64アーキテクチャ設計コメント追加
- `lib/agentcore/auth.ts`: 新規 — Cookie JWT検証共通モジュール（DynamoDBアクセスなし、actorIdサニタイズ）
- `docker/nextjs/Dockerfile`: x86_64固定ビルド、アーキテクチャ設計コメント追加
- `docker/nextjs/Dockerfile.prebuilt`: 新規 — Apple Silicon向けプリビルドモード
- `docker/nextjs/.dockerignore`: 新規 — ビルドコンテキスト最適化
- `demo-data/scripts/pre-deploy-setup.sh`: ホストアーキテクチャ自動検出、Apple Silicon対応
- `README.md`: デプロイ手順をローカル/EC2両対応に更新、スクリーンショット追加
- `docs/implementation-overview.md`: セクション13「AgentCore Memory」追加、デプロイ注意事項テーブル追加、S3 AP ユーザータイプ設計セクション追加
- `cdk.context.json.example`: `volumeSecurityStyle`、`s3apUserType`、`s3apUserName` パラメータ追加
- 実装概要の観点数を8→13に修正（全8言語README + docs）

### Fixed (デプロイ検証で発見)
- CfnMemory `EventExpiryDuration`: 86400（秒）→ 3（日数）に修正。CloudFormationスキーマは日数を期待（min: 3, max: 365）
- CfnMemory `Name`: ハイフン不可パターン `^[a-zA-Z][a-zA-Z0-9_]{0,47}$` に対応。`prefix.replace(/-/g, '_')` で変換
- Memory IAMロール: サービスプリンシパル `bedrock.amazonaws.com` → `bedrock-agentcore.amazonaws.com` に修正
- CfnMemory Tags: CDKデフォルトの配列形式 → マップ形式に `addPropertyOverride` で上書き
- API認証: `sessionManager.getSessionFromCookies()`（DynamoDB依存）→ Cookie JWT直接検証に変更
- actorId: メールアドレスの `@` `.` を `_at_` `_dot_` に置換（AgentCore APIバリデーション対応）
- Lambda IAM: `bedrock-agentcore:*` ポリシーをWebApp Lambda実行ロールに条件付き追加

### Fixed
- **S3 Access Point WindowsUser**: ドメインプレフィクス付き（`DEMO\Admin`）でCLI作成するとデータプレーンAPIがAccessDenied。`Admin`（プレフィクスなし）に修正。CDKカスタムリソースにドメインプレフィクス自動除去の安全策追加
- **SIDメタデータ ダブルクォート**: S3 Vectors経由でインジェストされた `allowed_group_sids` 配列要素に余分なダブルクォートが付加される問題。route.tsとadvanced-permission-filter.tsのSIDパース処理に `.replace(/^"|"$/g, '')` を追加
- **schedule-evaluator importパス**: Next.js standaloneビルドで `lambda/permissions/` パスが解決できない問題。モジュールを `docker/nextjs/src/lib/permissions/` にコピーして `@/lib/permissions/` パスに変更
- **actorIdバリデーション**: route.tsでAgentCore Memory呼び出し時にuserIdのメールアドレスをサニタイズせず渡していた問題。`@` → `_at_`、`.` → `_dot_` 置換を追加
- **i18n翻訳キー不足**: 6言語（ko/zh-CN/zh-TW/fr/de/es）で60-91キーが不足。permissions.*, model.selector.*, sidebar.*, chat.*等を全言語に追加。`messages/` と `src/messages/` の二重管理を同期

## [3.2.0] - 2026-04

### Added
- **監視・アラート機能（Monitoring & Alerting）**: `enableMonitoring=true` で有効化されるオプション機能。CloudWatchダッシュボード（Lambda/CloudFront/DynamoDB/Bedrock/WAF/Advanced RAG統合）、SNSアラート（エラー率・レイテンシ閾値超過通知）、EventBridge KB Ingestion Job失敗通知、EMFカスタムメトリクス。`enableAgentCoreObservability=true` でAgentCore Runtimeメトリクスも統合可能。コスト: 約$4/月
- `lib/constructs/monitoring-construct.ts`: MonitoringConstruct（DemoWebAppStack内に条件付き作成）
- `docker/nextjs/src/lib/monitoring/metrics.ts`: EMFメトリクスヘルパー（enabled/no-op切り替え）
- 17テストケース追加（Property 7 + Unit 10）— `tests/unit/monitoring-construct.property.test.ts`
- CDKコンテキストパラメータ: `enableMonitoring`, `monitoringEmail`, `enableAgentCoreObservability`, `alarmEvaluationPeriods`, `dashboardRefreshInterval`

### Changed
- `bin/demo-app.ts`: 監視関連コンテキストパラメータの読み取りとWebAppStackへの受け渡し追加
- `lib/stacks/demo/demo-webapp-stack.ts`: DemoWebAppStackPropsに監視プロパティ追加、MonitoringConstruct統合
- `cdk.context.json.example`: 監視パラメータサンプル追加
- `README.md`: 実装概要テーブルに監視・アラート追加、CDKパラメータテーブル更新、デプロイ例追加
- `docs/implementation-overview.md`: セクション12「監視・アラート」追加

### Security
- `development/` フォルダをgit追跡から除外（機密情報を含むレポート・スクリプトの保護）
- `cdk.context.json.production` / `.staging` / `.minimal` をgit追跡から除外
- `.gitignore` の `config/environments/` パターンに `.example` ファイルの除外ルール追加

## [3.1.0] - 2026-04

### Added
- **画像分析RAG（Image Recognition）**: チャット入力に画像アップロード（ドラッグ＆ドロップ / ファイルピッカー）を追加。Bedrock Vision API（Claude 3 Haiku）で画像を分析し、結果をKB検索コンテキストに統合。JPEG/PNG/GIF/WebP対応、5MB上限、30秒タイムアウト、テキストのみフォールバック
- **Knowledge Base接続UI**: Agent作成・編集フォームにKBSelector追加。AgentとKnowledge Baseの接続・解除・一覧表示。Agent詳細パネルに接続済みKB表示。Bedrock Agent APIに3アクション追加（associate/disassociate/listAgentKnowledgeBases）
- **コスト最適化ルーティング（Smart Routing）**: クエリ複雑度分類エンジン（ComplexityClassifier）で simple/complex を判定し、軽量モデル（Haiku）または高性能モデル（Sonnet）を自動選択。サイドバーにRoutingToggle、レスポンスにAuto/Manualバッジ表示。ModelSelectorに「自動」オプション追加。localStorage永続化
- 36プロパティのfast-checkプロパティベーステスト（7テストファイル、64テストケース）
- 全3機能の8言語i18n対応（ja, en, ko, zh-CN, zh-TW, fr, de, es）

### Changed
- `/api/bedrock/kb/retrieve/route.ts`: imageData/imageMimeTypeフィールド追加、Vision API統合
- `/api/bedrock/agent/route.ts`: KB接続管理3アクション追加（既存アクション変更なし）
- `ModelSelector.tsx`: Smart Routing ON時に「自動」オプション表示
- `AgentCreator.tsx` / `AgentEditor.tsx` / `AgentDetailPanel.tsx`: KBSelector/ConnectedKBList統合

## [3.0.0] - 2026-03

### Added
- Permission-aware RAGデモ環境（KBモード専用）
- 5スタック構成のCDKデプロイメント（Networking, Security, Storage, AI, WebApp）
- FSx for ONTAP + FlexCacheによるキャッシュボリューム構成
- Bedrock Knowledge Base + OpenSearch Serverlessによるベクトル検索
- SID/ACLベースのPermission-awareフィルタリング
- DynamoDB権限キャッシュ（TTL: 5分）
- デモデータ・セットアップスクリプト一式
- プロパティベーステスト（fast-check）

### Changed
- KBモード専用に簡素化（Agent Mode除外）
- パブリックリポジトリ向けコード整理
- EC2ベースのビルド・デプロイ手順に統一

## [2.0.0] - 2025-11

### Added
- Amazon Nova Pro統合
- 多言語対応（日本語・英語）

## [1.0.0] - 2024

### Added
- 初期リリース
- モジュラーアーキテクチャ実装
- 基本的なRAG機能

---

**最新バージョン**: 3.3.0
