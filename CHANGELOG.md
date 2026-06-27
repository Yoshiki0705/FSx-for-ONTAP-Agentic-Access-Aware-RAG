# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

AWS Summit New York 2026 (2026-06-17) の新機能統合。Preview/未検証 API を含む機能は
すべて opt-in（デフォルト無効）であり、本番有効化前の検証が前提。

### Added
- **Policy Engine + Bedrock Guardrails 統合**: `CfnPolicyEngine` + `CfnPolicy`(Cedar) を Gateway の `policyEngineConfiguration` に紐付け。`policyEngineMode` で `LOG_ONLY`/`ENFORCE` を切替。`enableGuardrails=true` + `enableAgentCoreGateway=true` で有効化（東京リージョン GA）。⚠️ Cedar の Guardrails context スキーマは UNVERIFIED（コードにドキュメント参照付きで明記）
- **AgentCore Web Search**: Gateway の built-in connector target を `AwsCustomResource` で追加。`enableWebSearch=true` で有効化（`enableAgentCoreGateway` 前提）。⚠️ target 構成・エンドポイントは UNVERIFIED。`WEB_SEARCH_TARGET_ENDPOINT` で上書き可能
- **Chunk Safety Filter (InvokeGuardrailChecks 思想)**: KB Retrieve → SID Filter の後段でチャンク単位のインライン安全性チェック。`GUARDRAIL_ID` 設定時は `ApplyGuardrail`(source=INPUT)、未設定時は多言語ヒューリスティック（en/ja/zh/ko）。Fail-Open + 並列度制限 + EMF メトリクス。`enableGuardrails=true` で自動有効化。閾値/タイムアウト/並列度は `CHUNK_SAFETY_THRESHOLD`/`CHUNK_SAFETY_TIMEOUT_MS`/`CHUNK_SAFETY_CONCURRENCY` で調整
- **AgentCore Optimization (Preview)**: Configuration Bundle + Recommendations + A/B Testing の基盤。`enableAgentOptimization=true` で有効化（`enableAgentCoreGateway` 前提）。CDK は Config Bundle + IAM ロールを provision、Recommendations/A/B テストは agentcore CLI/SDK で実行。⚠️ `createConfigurationBundle` パラメータは UNVERIFIED
- **Managed KB 移行検討ドキュメント**: `docs/managed-kb-migration-evaluation.md`（全8言語）。既存 KB + OpenSearch Serverless / S3 Vectors との比較、Permission-aware RAG への影響（V1〜V7 検証ポイント）、段階移行手順、推奨判定（REQUEST CHANGES — 検証完了まで保留）
- **Managed KB 検証手順ドキュメント**: `docs/managed-kb-upgrade-path.md`（全8言語）。S3 AP データソース接続検証（Phase A/B/C）、`listContains` による SID 配列照合、Agentic Retrieval マルチホップ中のフィルタ維持、FlexClone を使った安全な検証パターン、用途に応じた選択ガイド（並列オプションとして追加・既存パス非削除）
- **Tests**: `chunk-safety-filter.property.test.ts`（Vitest + fast-check 15テスト）— 多言語インジェクション検出、PII、スコアリング、ベナイン誤検出なしの property test

### Changed
- **8言語ドキュメント同期**: README（ja/en/ko/zh-CN/zh-TW/fr/de/es）に Feature #19 拡張（Policy+Guardrails 統合）、#19.1（Web Search）、#19.2（Optimization）を追加。AGENTS.md に feature flags・アーキテクチャパターン・Pitfalls を追記
- **Managed KB 全8言語化**: `managed-kb-migration-evaluation.md` / `managed-kb-upgrade-path.md` を全8言語で整備（言語セレクター付き）。`stack-architecture-comparison.md`（全8言語）のベクトルストア比較表に Managed KB (Agentic Retriever) 列・検証ステータス・選び方ガイドを追加。README（全8言語）に並列オプションとして1行追記。`DOCUMENTATION_INDEX.md`（全8言語）に両ドキュメントを登録

### Security
- **最小権限 IAM**: Web Search / Config Bundle の `AwsCustomResource` ポリシーを `*` から `gateway/*/target/*` および `configuration-bundle/*` にスコープ化
- **信頼ポリシー絞り込み**: Optimization ロールの `assumedBy` から `AccountPrincipal`（アカウント全体）を除去し、AgentCore サービスのみに限定
- **ApplyGuardrail source=INPUT**: 取得チャンクのプロンプトインジェクション検出が正しく発火するよう修正（OUTPUT では PROMPT_ATTACK フィルタ非発火）
- **Cedar ポリシー修正**: ドキュメント突合せで、当初の `context.guardrails.evaluation` ベースのポリシーが**存在しない Cedar context フィールドに依存しており、ENFORCE 時に全ツール呼び出しを拒否しうる**ことが判明。検証済み構文のベースライン `permit(principal, action, resource)`（LOG_ONLY 観測用）に置換。本番 ENFORCE 前にツール単位の least-privilege ポリシー作成と Guardrails の正式な付与機構の利用が必要

## [4.3.0] - 2026-06-08

### Added
- **Model Lifecycle Update (Phase 0)**: Claude Opus 4.8, Sonnet 4.6, Nova 2 Lite をデフォルトモデルに設定。`DEPRECATED_MODEL_MAP` で旧モデルIDの透過的リダイレクト
- **Prompt Caching (Phase 1)**: Messages API (InvokeModel) 経由でシステムプロンプト（1161 tokens）のキャッシュ。2回目以降の呼び出しで 33% input token コスト削減を実証
- **Inference Profile Resolution**: `INFERENCE_PROFILE_MAP` でベースモデルID → リージョナル inference profile (`jp.*`) への自動変換。ap-northeast-1 での Claude on-demand エラーを解消
- **Automated Reasoning Guardrails (Phase 2)**: 5つのPermission推論ルールを定義。`enableGuardrails=true` + `enableAutomatedReasoning` で有効化
- **AgentCore Gateway (Phase 2)**: `CfnGateway` + Lambda Permission Interceptor。ツール実行前の権限チェック（16 pytest）
- **Citations + Permission Boundary (Phase 3)**: 引用元ドキュメントに「管理者のみ」「全員アクセス可」バッジ表示。`document-name-resolver.ts` でUUID→人間可読名変換
- **Graph RAG (Phase 4)**: Neptune Analytics `CfnGraph`。`enableGraphRAG=true` で有効化
- **Industry-Packs Demo Data**: 7業種（建設/教育/行政/医療/保険/法務/製造）× 5ドキュメント = 35ファイル + メタデータ
- **Operations Runbook**: 8言語対応の運用手順書（ONTAP バージョン確認、データ投入、Permission デバッグ、Prompt Caching 検証）
- **`.metadata.json` Formal Schema**: `lib/schemas/metadata-schema.ts` でバリデーション + 正規化関数。19テスト
- **Prompt Caching Investigation Report**: Converse API 非対応の知見と Messages API 動作確認を文書化

### Fixed
- **SID Filter カンマ区切り対応**: Bedrock KB がメタデータを返す際のカンマ区切り文字列形式（`"S-1-1-0,S-1-5-21-xxx-512"`）を正しくパース（commit `578435b`）
- **Claude Inference Profile (MODEL-001)**: `anthropic.claude-sonnet-4-6` → `jp.anthropic.claude-sonnet-4-6` 自動解決。PR #68
- **Nova 2 Lite ON_DEMAND_BLOCKED 誤設定**: `INFERENCE_PROFILE_MAP` で解決すべきところを Haiku にフォールバックしていた問題を修正
- **`@aws-sdk/client-secrets-manager` 依存関係欠落**: claude-platform client のDocker ビルド失敗を修正
- **`inference-profile-resolver.ts` Claude 4.x 未対応**: モデルリストと jp prefix を追加

### Verified (Deploy Environment — ap-northeast-1)
- **Permission-Aware RAG**: Admin 25/25 ALLOW, Regular User 0/25 DENY。Fail-Closed 完全動作
- **Prompt Caching**: Messages API で Cache write 1161 + Cache hit 1161 tokens (33% cached) 確認
- **Hallucination Rejection**: 3/3 negative テストで「回答できない」を正しく返却
- **Permission Matrix**: 31/31 ロジックテスト通過 + Deploy E2E 通過
- **ONTAP Version**: 9.17.1P6（ONTAP REST API via SSM RunCommand で確認）
- **KB Ingestion**: 91ドキュメント スキャン、58ドキュメント インデックス済み
- **Smart Routing**: UI toggle + Auto Mode 動作確認
- **Claude Sonnet 4.6**: `jp.anthropic.claude-sonnet-4-6` で正常応答

### Known Issues
- **S3 Vectors 2048B 制限**: filterable metadata が2048バイトを超えるチャンクはインデックス失敗（31件）。長い SID リストが原因。OpenSearch Serverless で回避可能
- **Converse API Prompt Caching 非対応**: `cacheControl` フィールドを Converse API は無視する。Messages API (InvokeModel) でのみ動作
- **RAGAS Faithfulness メトリクス未計算**: `langchain_community` 内部依存エラー。基本メトリクス（Retrieval 100%, Hallucination Rejection 100%）は取得済み

## [4.2.0] - 2026-06

### Added
- **Voice Chat Phase 2 (WebRTC)**: Amazon Bedrock AgentCore Runtime + Pipecat Voice Agent + KVS WebRTC による低レイテンシ音声対話
  - KVS Signaling Channel: WebRTC シグナリング用 Amazon Kinesis Video Streams チャネル
  - Strategy パターン（REST/WebRTC）: `VoiceChatStrategy` インターフェースで REST（Phase 1）と WebRTC（Phase 2）を切替可能
  - Fallback メカニズム: WebRTC 接続失敗時に REST ベースの音声チャットに自動フォールバック
  - Pipecat Voice Agent 定義: AgentCore Runtime 用の音声エージェント構成（Docker イメージ + エージェント定義）
  - VoiceButton: `genai/page.tsx` に直接レンダリング（MessageInput.tsx は未使用）
  - `useVoiceCapability` フック: マイク権限状態（granted/prompt/denied）の正確なマッピング
  - Docker イメージ OCI 形式修正: `docker buildx build --provenance=false --sbom=false` で Docker V2 manifest を保証
  - `cdk.context.json` `imageTag` パラメータ: 明示的タグによる CDK イメージ変更検出

- **Transfer Family FSx for ONTAP Ingestion**: AWS Transfer Family SFTP サーバーと FSx for ONTAP S3 Access Points を統合し、ドキュメントアップロードから Bedrock KB 自動インジェスションパイプラインを構築
  - `DemoTransferFamilyStack`: 新規 CDK スタック。`enableTransferFamily=true` で有効化
  - Transfer Family SFTP サーバー: `TransferSecurityPolicy-2024-01`、PUBLIC エンドポイント、SFTP プロトコル
  - SFTP ユーザー管理: SSH 鍵認証、論理ホームディレクトリ（`/uploads/{userName}`）、スコープ IAM ロール
  - Ingestion Trigger Lambda (Python 3.12): S3 AP ファイル変更検出 → Bedrock KB StartIngestionJob 自動トリガー（ポーリング / CloudTrail 2モード対応）
  - Metadata Generator Lambda (Python 3.12): 権限メタデータ `.metadata.json` 自動生成（既存 RAG パイプライン互換）
  - DynamoDB テーブル × 3: スキャン状態（TTL 30日）、ファイルインベントリ、権限マッピング
  - EventBridge Scheduler（ポーリングモード、デフォルト5分間隔）/ EventBridge Rule（CloudTrail モード）
  - IN_PROGRESS ジョブ重複排除: 既存ジョブ実行中は新規トリガーをスキップ
  - CloudWatch EMF メトリクス: `TransferFamilyIngestion` 名前空間（DetectedFiles, ChangedFiles, IngestionJobTriggered, ScanDurationMs）
  - CloudWatch アラーム + SNS 通知: Lambda エラー率、インジェスションジョブ失敗、SFTP ログイン失敗（`enableMonitoring=true` 時）
  - CloudWatch ダッシュボード: Transfer Family + インジェスションパイプラインメトリクス（`enableMonitoring=true` 時）
  - CDK パラメータ: `enableTransferFamily`, `transferFamilyEndpointType`, `transferFamilyProtocols`, `transferFamilyAllowedCidrs`, `transferFamilyUsers`, `transferFamilyPollingIntervalMinutes`, `transferFamilyTriggerMode`, `transferFamilyDefaultPermissions`
  - テスト 60 件: CDK Assertion Tests 26 件 + Python Lambda Tests 34 件（うち Property-Based Tests 6 件、Hypothesis）
  - CDK Property Test（fast-check）: ユーザーアクセススコーピング

### Verified (Transfer Family FSx for ONTAP Ingestion デプロイ検証 — ap-northeast-1)
- **Transfer Family Server**: ONLINE 状態、PUBLIC エンドポイント、SFTP プロトコル、SecurityPolicy-2024-01
- **サーバーエンドポイント**: `s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com`
- **SFTP User**: demo-user、LOGICAL ホームディレクトリ、スコープ IAM ロール
- **Ingestion Trigger Lambda**: 手動実行成功、0 ファイル検出（/uploads/ 配下にファイル未配置のため正常動作）
- **EventBridge Scheduler**: ENABLED 状態、5分間隔ポーリング
- **DynamoDB テーブル**: 3 テーブル正常作成（scan-state, file-inventory, permission-mapping）

### Known Issues (Voice Chat WebRTC)
- **AgentCore Runtime CloudFormation 未サポート**: `AWS::BedrockAgentCore::AgentRuntime` および `AWS::KinesisVideo::SignalingChannelPolicy` は CloudFormation リソースタイプとして未サポート。Voice Agent は CLI/SDK で手動デプロイが必要
- **Pipecat Voice Agent Docker イメージ未ビルド**: AgentCore Runtime 用の Pipecat エージェント Docker イメージのビルド・プッシュが未実施
- **WebRTC E2E フロー未検証**: AgentCore Runtime エージェントが稼働していないため、WebRTC 経由の音声対話フローは未テスト
- **KVS TURN リレー未検証**: NAT/ファイアウォール環境での TURN リレー経由接続は未テスト
- **Fallback メカニズム未検証**: WebRTC → REST フォールバックの本番環境での動作は未テスト
- **音声 → 文字起こし → RAG 検索 → 音声応答フロー未検証**: エンドツーエンドの音声 RAG パイプラインは未テスト
- **CloudWatch Dashboard 音声メトリクス未作成**: Voice Chat 関連メトリクスのダッシュボードウィジェットが未追加

### Fixed (Voice Chat WebRTC)
- **useVoiceCapability "prompt" 状態バグ**: マイク権限が "prompt"（未確認）状態のとき `canUseVoice` が `false` を返しマイクボタンが非表示になる問題を修正。"prompt" → `null`、"granted" → `true`、"denied" → `false` にマッピングし、`canUseVoice` 条件を `isMicrophonePermitted !== false` に変更
- **Docker イメージ OCI 形式問題**: CodeBuild Standard 7.0 および BuildKit 有効環境で OCI Image Index 形式が生成され Lambda が拒否する問題を修正。`docker buildx build --provenance=false --sbom=false --push` を使用して Docker V2 manifest 形式を保証
- **CDK イメージタグキャッシュ**: `latest` タグ使用時に CDK がイメージ変更を検出しない問題。`cdk.context.json` の `imageTag` パラメータで明示的タグを使用するよう変更
- **VoiceButton ページ統合**: `genai/page.tsx` が MessageInput コンポーネントを使用せず直接 `<input>` をレンダリングしていたため VoiceButton が表示されない問題を修正。VoiceButton を `genai/page.tsx` に直接インポート・レンダリング

### Known Issues (Transfer Family)
- **StructuredLogDestinations EarlyValidation**: `AWS::Transfer::Server` の `StructuredLogDestinations` プロパティが `AWS::EarlyValidation::PropertyValidation` エラーを発生させるため削除。Transfer Family は `loggingRole` 経由で CloudWatch Logs に標準形式でログ出力（構造化 JSON ログは利用不可）
- **HomeDirectoryMappings Target フォーマット**: Target は `/{ap-name}/prefix` 形式が必須。ARN 全体や末尾スラッシュ付きは拒否される。`homeDirectoryPrefix` のデフォルトを `/uploads/${userName}` に修正済み（末尾スラッシュなし）
- **デモユーザー SSH 鍵**: プレースホルダー SSH 公開鍵を使用。実運用には Secrets Manager に実際の SSH 鍵を登録し Transfer Family ユーザーを更新する必要あり
- **SFTP 接続テスト未実施**: 実際の SSH 鍵によるファイルアップロードフローは未検証
- **エンドツーエンドフロー未検証**: Upload → detect → metadata → ingestion の完全フローは SSH 鍵 + ファイルアップロードが必要
- **CloudTrail モード未検証**: ポーリングモードのみデプロイ・検証済み。CloudTrail データイベント検出モードは未テスト
- **PUBLIC エンドポイント IP 制限**: Transfer Family PUBLIC エンドポイントは NLB なしでの IP 許可リストをネイティブサポートしない（制限事項として文書化済み）

## [4.1.0] - 2026-05

### Added
- **KB Auto-Sync**: EventBridge Scheduler ポーリングによる FSx for ONTAP S3 AP ファイル変更検出 + Bedrock KB StartIngestionJob 自動トリガー
  - KbAutoSyncConstruct: CDK Construct（AIStack 内）。`enableKbAutoSync=true` で有効化
  - EventBridge Scheduler: `rate(N minutes)` 定期ポーリング（デフォルト: 5分間隔）
  - Lambda (Python 3.12): ListObjectsV2 → DynamoDB 差分比較 → StartIngestionJob
  - DynamoDB インベントリテーブル: fileKey (PK), size, lastModified, eTag, firstDetectedAt, lastSyncedJobId
  - CloudWatch EMF メトリクス: `KbAutoSync` 名前空間、`FunctionName` ディメンション（ScannedFileCount, ChangedFileCount, IngestionJobTriggered, ScanDurationMs）
  - CloudWatch Alarm: 3回連続エラー閾値
  - 構造化 JSON ログ: scannedFiles, addedFiles, updatedFiles, deletedFiles, ingestionJobId, durationMs
  - IN_PROGRESS ジョブ重複排除: 既存ジョブ実行中は新規トリガーをスキップ
  - 初回実行（空インベントリ）: フルスキャンとして全ファイルを検出しインジェスションジョブをトリガー
  - CDK パラメータ: `enableKbAutoSync`, `s3AccessPointArn`, `kbDataSourceId`, `kbAutoSyncIntervalMinutes`
  - 8 Property-Based Tests（hypothesis）: 差分検出正確性、トリガー判定、間隔バリデーション、インベントリ整合性、空インベントリ、ログ完全性、EMF 完全性、冪等リカバリ

- **Capacity Guardrails**: FSx for ONTAP 自動拡張に対する安全制御モジュール
  - Guardrails モジュール (`lambda/common/guardrails.py`): per-action rate limit、daily cap、cooldown の3段階チェック
  - DynamoDB 永続追跡: 日次拡張合計、最終アクションタイムスタンプ、アクション回数、TTL 7日自動クリーンアップ (`ttl_epoch`)
  - CloudWatch カスタムメトリクス: `FSxNOps/Guardrails` 名前空間、`GuardrailDecision` メトリクス（Allowed/Blocked/DryRun × ResourceType × ResourceId）
  - CloudWatch Dashboard (`FSxNOps-Guardrails-Dashboard`): Decision Counts、Daily Expansion Totals、Blocked Actions の3ウィジェット
  - CloudFormation パラメータ: `MaxGrowPerActionPct`（デフォルト50%）、`MaxGrowPerDayGiB`（デフォルト500GiB）、`CooldownMinutes`（デフォルト30分）
  - capacity_monitor リファクタリング: インライン制限ロジックを guardrails モジュールに委譲
  - DynamoDB VPC Gateway Endpoint（`CreateVpcEndpoints=true` 時に作成）
  - IAM ポリシー追加: `dynamodb:GetItem/UpdateItem/PutItem` + `cloudwatch:PutMetricData`
  - Fail-safe 設計: DynamoDB 読み書きエラー時は Blocked を返却（未追跡の拡張を防止）
  - 9 Property-Based Tests（hypothesis）: 決定出力ドメイン、無効設定検出、per-action 正確性、daily cap 正確性、cooldown 正確性、DynamoDB エラー fail-safe、dry-run マッピング、CloudWatch 障害耐性、独立リソース追跡

### Verified (KB Auto-Sync デプロイ検証 — ap-northeast-1)
- **初回スキャン**: 空 DynamoDB インベントリから 18 ファイル全検出 → ingestion job HDSUZI6JCC トリガー → COMPLETE
- **2回目実行**: 0 変更検出 → インジェスションスキップ（正常動作）
- **EMF メトリクス**: CloudWatch `KbAutoSync` 名前空間に全4メトリクス正常出力
- **構造化ログ**: JSON 形式で全必須フィールド出力確認
- **EventBridge Scheduler**: `rate(5 minutes)` ENABLED 状態
- **CloudWatch Alarm**: OK 状態（3回連続エラー閾値）

### Verified (Capacity Guardrails デプロイ検証 — ap-northeast-1)
- **CloudFormation スタック**: `fsxn-ops` スタック正常デプロイ（全パラメータ反映）
- **DynamoDB テーブル**: `fsxn-ops-guardrails-{stack-name}` 作成確認、TTL (`ttl_epoch`) ENABLED
- **CloudWatch Dashboard**: `FSxNOps-Guardrails-Dashboard` 作成確認（3ウィジェット）
- **Lambda 環境変数**: `GUARDRAILS_TABLE_NAME`, `MAX_GROW_PER_ACTION_PCT`, `MAX_GROW_PER_DAY_GIB`, `COOLDOWN_MINUTES` 設定確認
- **ガードレール評価タイミング**: 閾値超過 AND `auto_resize=true` の場合のみ評価（正常動作）
- **CloudWatch メトリクス**: 自動拡張試行時のみ `FSxNOps/Guardrails` 名前空間にメトリクス出力（閾値未超過時はメトリクスなし — 正常動作）
- **VPC Endpoints**: `CreateVpcEndpoints=false` で CDK VPC 既存エンドポイントを利用
- **Lambda コードデプロイ**: `aws lambda update-function-code --zip-file` による個別デプロイ確認
- **DynamoDB インベントリ**: 全18アイテム正常格納（fileKey, size, lastModified, eTag, firstDetectedAt, lastSyncedJobId）

- **Smart Routing 3-Tier Model Expansion**: 2層ルーティングを3層に拡張
  - 3-tier分類: simple → Claude Haiku 4.5（軽量）、complex → Claude Sonnet 3.5（高性能）、full-context → Claude Opus 4（重量）
  - Full-context分類条件: ドキュメント分析意図キーワード（JP/EN）AND contextSize > 4000文字
  - GPT-5.5 手動選択オプション: ModelSelector に OpenAI カテゴリとして追加、ModelAccessVerifier による可用性検証
  - CloudWatch EMF メトリクス: `SmartRouting` 名前空間、`RoutingTier` ディメンション（simple/complex/full-context/manual）
  - Document Analysis Intent 検出: 日本語8キーワード + 英語7キーワード
  - Zustand Store 拡張: `heavyModelId`, `contextSizeThreshold` 状態管理
  - 11 Property-Based Tests（fast-check）: 分類出力ドメイン、full-context トリガー条件、GPT-5.5 自動ルーティング除外、後方互換性等

### Verified (デプロイ検証で確認済み — ap-northeast-1)
- **Smart Routing 3-Tier**: 全3層ルーティング正常動作確認
- **CloudWatch EMF**: `SmartRouting` 名前空間に `RoutingTier` ディメンション付きメトリクス正常出力
- **GPT-5.5 選択**: ModelSelector に表示、可用性検証（リージョン非対応時インラインエラー表示）
- **Auto Mode UX**: Smart Routing ON + モデル手動選択時は "Manual override active" モード。「⚡自動」ボタンで自動ルーティング有効化

### Known Issues
- **contextSize 初回クエリ制限**: RAG検索はルーティング後に実行されるため、full-context分類は初回クエリでは発動しない。v4.1.0で会話コンテキスト長（AgentCore Memory）を代替指標として渡す修正を適用済み。AgentCore Memory 無効時は contextSize=0 のまま
- **CloudFormation Guard Hook 干渉**: 別プロジェクトの `FSxNS3AP::Guard::Hook` がアカウント内でアクティブな場合、全リソース作成がブロックされる。デプロイ前に `aws cloudformation deactivate-type --type HOOK --type-name "FSxNS3AP::Guard::Hook"` で無効化が必要
- **CloudWatch Dashboard 未対応**: RoutingTier / KbAutoSync メトリクスウィジェットが CloudWatch Dashboard に未追加（MonitoringConstruct の拡張が必要）
- **KB Auto-Sync: rate(1 minutes) 単数形問題**: `kbAutoSyncIntervalMinutes=1` 設定時に `rate(1 minutes)` が生成される。EventBridge Scheduler は `rate(1 minute)` （単数形）を要求する。現在のデフォルト値（5分）では問題なし。修正予定: CDK Construct で `intervalMinutes === 1` の場合に `rate(1 minute)` を生成するよう条件分岐を追加
- **KB Auto-Sync: S3 AP / Data Source 手動作成**: S3 Access Point と KB Data Source は CDK 外で手動作成が必要（`post-deploy-setup.sh` で自動化済み）。CDK 内での完全自動化は FSx for ONTAP S3 AP の CloudFormation 未サポートにより不可
- **Capacity Guardrails: Lambda コード手動デプロイ**: CloudFormation テンプレートは `ZipFile` インラインプレースホルダーを使用。実際の Lambda コードは `aws lambda update-function-code --zip-file` で個別デプロイが必要（fsxn-ops スタンドアロンスタックの既知パターン）
- **Capacity Guardrails: メトリクス出力条件**: CloudWatch `FSxNOps/Guardrails` メトリクスは自動拡張が試行された場合のみ出力される。閾値未超過時（通常監視）はガードレール評価自体が行われないためメトリクスなし
- **Capacity Guardrails: rate(1 minutes) 単数形問題**: EventBridge Scheduler の `rate(1 minutes)` 単数形問題は fsxn-ops スタックにも該当（デフォルト5分では問題なし）
- **Capacity Guardrails: フルフロー統合テスト未実装**: 閾値超過 → ガードレール評価 → ブロック/許可 → DynamoDB 記録の自動化された統合テストが未実装。現在は手動検証のみ

### Fixed
- **contextSize パラメータ連携**: `routeQuery()` 呼び出し時に会話コンテキスト長を `contextSize` として渡すよう修正。AgentCore Memory 有効時、直近の会話履歴が4000文字を超えた状態でドキュメント分析意図クエリを送信すると full-context ルーティングが発動する

---

## [4.0.0] - 2026-04

### Verified (2026-04-25)
- **AWS環境デプロイ検証完了**: 全6スタック正常デプロイ、27項目全チェック合格
- **エンドツーエンドフロー確認**: Cognito認証→KB検索→Agent実行→レスポンス返却
- **検証スクリプト追加**: `demo-data/scripts/verify-deployment.sh` — 自動検証27項目
- **テスト全パス**: 90ファイル / 709テストケース (Vitest + fast-check)

### Fixed
- TypeScript型不整合修正: `Message`/`ChatMessage`/`ChatSession` 型を統一
- テストフレームワーク移行: `jest.fn()` → `vi.fn()`, `react-dom/test-utils` → `react`
- `policy-evaluation.ts`: `policyId` プロパティ欠落修正
- `episodic-memory.ts`: `DeleteMemoryRecordCommand` の不正パラメータ修正
- `useAgentCore.ts`: `User` 型の `userId` → `username` 修正
- `agentcore-client.ts`: 無効な `source` 値修正
- `genai/page.tsx`: `CollaboratorConfig.name` → `agentName` 修正
- 未使用ファイル削除: `src/page.tsx`, `lib/storage-manager.ts`, `lib/api/client.ts`

### Added
- **AgentCore Policy**: エージェント行動制御（AgentCore Policy 統合）
  - `enableAgentPolicy` CDK パラメータ: AgentCore Policy のオプトイン有効化（デフォルト: `false`）
  - `policyFailureMode` CDK パラメータ: ポリシー評価失敗時の挙動（`fail-open` | `fail-closed`、デフォルト: `fail-open`）
  - Lambda IAM: `bedrock:EvaluateAgentPolicy`, `bedrock:CreateAgentPolicy`, `bedrock:GetAgentPolicy`, `bedrock:UpdateAgentPolicy`, `bedrock:DeleteAgentPolicy`, `bedrock:ListAgentPolicies`（6 アクション）
  - ポリシー CRUD API Route (`/api/bedrock/agent-policy`): 作成・取得・更新・削除
  - PolicyEvaluationMiddleware (`lib/policy-evaluation.ts`): 3 秒タイムアウト、fail-open/fail-closed 対応
  - PolicySection: Agent 作成・編集フォーム内のポリシー設定セクション
  - PolicyTemplateSelector: 3 種類のテンプレート（セキュリティ重視、コスト重視、柔軟性重視）
  - PolicyDisplay: Agent 詳細パネル内のポリシー表示（折りたたみ可能）
  - PolicyBadge: ポリシー適用状態バッジ（🛡️）
  - 違反ログ（EMF 形式）: `PermissionAwareRAG/AgentPolicy` 名前空間
  - MonitoringConstruct 拡張: PolicyEvaluationCount, PolicyViolationCount, PolicyEvaluationLatency ウィジェット
  - 8 言語 i18n 対応（`agentDirectory.policy` 名前空間）

- **Amazon Nova Sonic 音声チャット**: 音声対話機能
  - `enableVoiceChat` CDK パラメータ: 音声チャットのオプトイン有効化（デフォルト: `false`）
  - Lambda IAM: `bedrock:InvokeModelWithBidirectionalStream`（Nova Sonic モデル ARN に限定）
  - Voice Stream API Route (`/api/voice/stream`): WebSocket プロキシ（ブラウザ ↔ Lambda ↔ Nova Sonic）
  - Voice Config API Route (`/api/voice/config`): 音声チャット設定取得
  - VoiceButton: 🎤 マイクボタン（録音中パルスアニメーション、Ctrl+Shift+V ショートカット）
  - WaveformAnimation: Canvas ベース波形描画（入力=青、出力=緑、reduced-motion 対応）
  - VoicePlaybackControls: 一時停止/再開、音量調整、停止
  - useVoiceSession: WebSocket 接続、マイクストリーム、無音検出（30秒）、自動再接続（最大3回）
  - useVoiceCapability: 音声機能利用可否判定
  - useVoiceStore: Zustand グローバル状態管理
  - 8言語 i18n 対応（`chat.voice` 名前空間）
  - 推定月額コスト: $70〜$100

- **AgentCore Episodic Memory**: エピソード記憶（Episodic Memory）機能
  - `enableEpisodicMemory` CDK パラメータ: エピソード記憶のオプトイン有効化（`enableAgentCoreMemory=true` が前提条件）
  - CfnMemory `episodicMemoryStrategy`: 既存の semantic/summary に加えて episodic 戦略を条件付き追加
  - 5 API ルート: エピソード一覧取得、検索、削除、類似エピソード検索、振り返りトリガー
  - EpisodeTab: MemorySection 内のタブ切替 UI（メモリ ↔ エピソード）
  - EpisodeCard: 目標サマリー、ステップ数、結果ステータスアイコン（✅⚠️❌）、作成日時表示
  - EpisodeDetailPanel: 折りたたみ可能なセクション（推論ステップ、アクション、振り返り）
  - EpisodeSearch: 300ms デバウンス付きセマンティック検索
  - EpisodeReferenceBadge: チャット応答への「📚 過去の経験を参照」バッジ
  - 類似エピソード自動注入: タスク実行時に上位3件の類似エピソードを推論コンテキストに注入
  - Background Reflection: 会話完了後のエピソード自動抽出トリガー
  - 楽観的 UI 更新: エピソード削除時の即座除去 + 失敗時ロールバック
  - Graceful Degradation: エピソード記憶障害時もコアエージェント機能を継続
  - IAM ポリシー: `SearchMemory`, `DeleteMemoryRecord` の条件付き付与
  - 8 言語 i18n 対応（`agentcore.episodes.*` 名前空間）
- **Guardrails Organizational Safeguards**: Bedrock Guardrails 統合の拡張
  - `guardrailsConfig` CDK パラメータ: コンテンツフィルタ強度・トピックポリシー・PII 検出設定の詳細制御
  - `buildGuardrailProps` 純粋変換関数: `guardrailsConfig` → CfnGuardrail プロパティマッピング
  - Organizational Safeguards 検出: `ListGuardrails` API による組織ポリシーの自動検出・表示
  - GuardrailsStatusBadge: チャット応答への Guardrails 処理結果バッジ（✅ safe / ⚠️ filtered / ⚠️ チェック不可）
  - Guardrails 介入ログ: 構造化 JSON ログ（プライバシー保護付き、ブロックテキスト非記録）
  - EMF カスタムメトリクス: `GuardrailsInputBlocked`, `GuardrailsOutputFiltered`, `GuardrailsPassthrough`
  - MonitoringConstruct 拡張: CloudWatch ダッシュボード Guardrails セクション、介入率 SNS アラート
  - GuardrailsAdminPanel: サイドバー System Management セクションの読み取り専用管理パネル
  - Fail-Open エラーハンドリング: Guardrails API タイムアウト・5xx 時のチャット機能継続
  - 8 言語 i18n 対応（`sidebar.guardrailsPanel.*`, `chat.guardrailsStatus.*` 名前空間）
- **新規 CDK パラメータ**: `guardrailsConfig`（object, オプション）
- **新規 API ルート**: `/api/bedrock/guardrails/status`
- **新規 UI コンポーネント**: GuardrailsStatusBadge, GuardrailsAdminPanel
- **マルチモーダル RAG 検索**: Amazon Nova Multimodal Embeddings によるテキスト・画像・動画・音声のクロスモーダル検索
  - Embedding Model Registry パターン: モデル定義を構成オブジェクトとして抽象化、新モデル追加はカタログ登録のみ
  - KB Config Strategy: Registry から取得したモデル定義に基づく動的 KB 構成生成
  - Multi-KB Query Router: Dual KB モード時のクエリ特性ベースルーティング
  - MediaPreviewService: S3 署名付き URL 生成（15 分有効期限、権限チェック付き）
  - 画像類似検索: アップロード画像をクロスモーダル類似検索クエリとして使用
  - Dual KB アーキテクチャ: テキスト専用 KB + マルチモーダル KB の並行運用
  - 対応メディア: JPEG, PNG, GIF, WebP, MP4, MOV, AVI, MP3, WAV, FLAC, M4A
  - 8 言語 i18n 対応（`chat.multimodal.*` 名前空間）
- **新規 CDK パラメータ**: `embeddingModel`（string, デフォルト: `titan-text-v2`）、`multimodalKbMode`（string, デフォルト: `replace`）
- **新規コンポーネント**: EmbeddingModelRegistry, KBConfigStrategy, KBQueryRouter, MediaPreviewService, MediaTypeIndicator, MediaPreview, MediaTypeFilter, ImageSearchAction, EmbeddingModelInfo, DualKBToggle
- **マイグレーションガイド**: `docs/migration-guide-multimodal.md` — titan-text-v2 → nova-multimodal 移行手順
- **Agent Registry 統合**: Agent Directory に AWS Agent Registry（Amazon Bedrock AgentCore）タブを追加
  - 組織内の Agent・ツール・MCP サーバーをセマンティック検索・閲覧
  - Registry レコードからローカル Bedrock Agent へのインポート（名前重複時は `_imported_YYYYMMDD` サフィックス付与）
  - ローカル Agent の Registry へのパブリッシュ（承認ワークフロー対応）
  - リソースタイプフィルタ（Agent / Tool / McpServer）、ページネーション（20件/ページ）
  - クロスリージョンアクセス（`agentRegistryRegion` パラメータ）
  - フォールトアイソレーション（Registry エラーが他タブに影響しない）
  - 8言語 i18n 対応（ja, en, ko, zh-CN, zh-TW, fr, de, es）
- **新規 CDK パラメータ**: `enableAgentRegistry`（boolean, デフォルト: false）、`agentRegistryRegion`（string, オプション）
- **新規 API ルート**: `/api/bedrock/agent-registry/search`, `/detail`, `/import`, `/publish`
- **新規 UI コンポーネント**: RegistryPanel, RegistrySearchBar, RegistryTypeFilter, RegistryCardGrid, RegistryCard, RegistryDetailPanel, RegistryImportDialog, RegistryRegionBadge, RegistryErrorFallback

### Technical Notes
- **Agent Registry**: Preview API (April 2026). SDK commands (`search_registry_records`, `create_registry_record`, etc.) are available in boto3/AWS CLI. Node.js SDK uses SigV4-signed HTTP with REST path mapping (`/registry-records/search`, `/registries/{id}/records`). Requires a registry to be created first via `create_registry` (control plane). `agentRegistryArn` CDK context parameter passes the registry ARN to Lambda environment.
- **Voice Chat**: Phase 1 implementation uses REST + Bedrock Converse API for audio processing. Phase 2 (WebSocket via API Gateway + Nova Sonic InvokeModelWithBidirectionalStream) planned for real-time streaming
- **AgentCore Policy**: GA (March 2026). Architecture changed from direct API calls to Policy Engine + Gateway model. Policies are written in Cedar language (or natural language auto-conversion). IAM actions updated to `bedrock-agentcore:CreatePolicyEngine`, `CreatePolicy`, `GetPolicy`, `UpdatePolicy`, `DeletePolicy`, `CreateGateway`, etc.
- **Episodic Memory**: GA (part of AgentCore Memory). `episodicMemoryStrategy` requires `reflectionConfiguration.namespaces` parameter. Without it, `CreateMemory` returns "Invalid memory strategy input" error. Correct configuration: `{ episodicMemoryStrategy: { name: 'episodic', namespaceTemplates: [...], reflectionConfiguration: { namespaces: [...] } } }`
- **npm dependencies**: Added `@aws-crypto/sha256-js`, `@smithy/signature-v4`, `@smithy/protocol-http`, `@aws-sdk/credential-provider-node` for SigV4 signing

### Verified (デプロイ検証で確認済み — ap-northeast-1)
- **Agent Registry**: `SearchRegistryRecords` API 正常動作（空レジストリに対して空結果返却）。IAM アクション更新済み（`SearchRegistryRecords`, `CreateRegistryRecord` 等）。レジストリ作成（`create_registry`）→ 検索の E2E フロー確認
- **Guardrails**: GuardrailId 作成成功（READY 状態）。Agent 応答に `guardrailResult` フィールド含む（`inputAssessment: PASSED`, `outputAssessment: PASSED`）。Fail-Open 動作確認
- **AgentCore Memory**: 3 ストラテジー全て ACTIVE（semantic, summary, episodic）。`reflectionConfiguration.namespaces` パラメータ追加で episodic 作成成功
- **Voice Chat**: `/api/voice/config` が正常応答（`enabled: true`, `modelId: amazon.nova-sonic-v1:0`, 8 言語対応）
- **AgentCore Policy**: GA 版 Policy Engine + Gateway API 正常応答。IAM アクション更新済み（`bedrock-agentcore:CreatePolicyEngine` 等）
- **KB Retrieve**: 権限フィルタリング正常動作（admin: 機密文書アクセス可、user: 公開文書のみ）
- **Agent Invoke**: Bedrock Agent 正常応答 + Guardrails 統合確認
- **既存 FSx 流用**: `existingFileSystemId` / `existingSvmId` / `existingVolumeId` 指定でデプロイ時間大幅短縮（FSx 作成 30-40 分スキップ）
- **S3 Access Point**: UNIX セキュリティスタイル + root ユーザーで正常作成・データアクセス確認
- **UI ブラウザ動作確認**: KBモード（カードグリッド14枚、サイドバー、権限表示）、シングルAgentモード（6 Agent 表示、Agent選択ドロップダウン）、マルチAgentモード（3モードトグル切替）、Agent Directory（Registry タブ、Teams タブ、テンプレート10種）、言語切替（8言語、タブ状態 `?tab=registry` 保持）、Feature Flags ランタイム API（Registry タブ・Guardrails パネルの条件表示）を確認
- **KB 検索**: admin@example.com で Permission-aware 検索正常動作。Citation 6件（confidential + public）、アクセスレベルバッジ（管理者のみ / 全員アクセス可）表示確認
- **enableMultiAgent デフォルト有効化**: `enableAgent=true` 時に Supervisor Agent（R81K1Z819W）が自動作成され、マルチAgentモードが利用可能であることを確認

### Changed
- `enableMultiAgent` のデフォルト値を `enableAgent=true` 時に自動有効化に変更。Bedrock Agent は待機コストゼロのため、有効化しても追加ランニングコストは発生しない。マルチAgentモードで実際にチャットした場合のみトークン消費が 3-6 倍になる。明示的に `enableMultiAgent: false` を設定した場合のみ無効化される
- Supervisor Agent の `agentCollaboration` を `DISABLED` + `autoPrepare: false` で作成し、Custom Resource Lambda で `SUPERVISOR_ROUTER` に変更する方式に修正（CloudFormation の Bedrock Agent リソースハンドラーが `SUPERVISOR_ROUTER` で作成時に Collaborator なしで PrepareAgent を実行して失敗する問題を回避）
- Agent Registry クライアントを GA 版 SDK API（`SearchRegistryRecords`, `CreateRegistryRecord` 等）に対応。SigV4 HTTP + REST パスマッピング方式
- AgentCore Policy API を GA 版 Policy Engine + Gateway アーキテクチャに対応。IAM アクションを `bedrock-agentcore:CreatePolicyEngine` 等に更新
- `NEXT_PUBLIC_*` フィーチャーフラグのビルド時インライン化問題を解決。`/api/config/features` API + `useFeatureFlags` フックによるランタイム取得方式に統一
- TeamCreateWizard の全テキストを 8 言語 i18n 対応（`teamWizard` 名前空間）
- LanguageSwitcher の言語切替時にタブ状態（`?tab=teams` 等）を URL クエリパラメータで保持
- マルチAgent モード有効化判定に Supervisor Agent 名検出を追加（Agent Teams 未作成でも Supervisor Agent がデプロイ済みなら有効化）

## [3.5.1] - 2026-04-11

### Changed
- UI/UX最適化の全実装をリリース（統合3モードトグル、ヘッダーリファクタリング、i18n対応、プロパティテスト、スクリーンショット更新）
- CDK SupervisorAgent `agentCollaboration` を `DISABLED` → `SUPERVISOR_ROUTER` に修正
- `cdk-outputs.json` を `.gitignore` に追加

## [3.5.0] - 2026-04

### Added
- **UI/UX最適化**: ヘッダーバーの情報過多・モード表示の重複・レイアウトシフトを解消
  - 統合3モードトグル（KB / シングルAgent / マルチAgent）をヘッダーに配置。既存の2段階トグル（KB/Agent + Single/Multi）を1つのセグメントコントロールに統合
  - Agent選択ドロップダウンをヘッダーに昇格。シングルAgentモードでは個別Agent、マルチAgentモードではSupervisor Agentのみを表示。Agent Directoryリンクもドロップダウン内に配置
  - アクセス権限セクションをAgentモードのサイドバーにも追加。全モード（KB/シングルAgent/マルチAgent）でディレクトリ名・読み取り/書き込み権限を表示
  - ModelIndicatorをヘッダーから削除し、サイドバーのシステム管理に集約
  - UserMenuをサインアウトのみに簡素化
  - サイドバーの折りたたみアニメーション（`transition-all duration-300`）とレスポンシブ対応（md未満でオーバーレイ表示）
  - 全8言語（ja, en, de, es, fr, ko, zh-CN, zh-TW）のi18n翻訳キーを追加
- **Phase 2 認証拡張機能**: 7つの認証・セキュリティ拡張機能を追加
- **マルチOIDC IdPサポート**: `oidcProviders` 配列で複数のOIDC IdP（Okta + Keycloak等）を同時登録。サインイン画面に各IdPのボタンを動的表示。`oidcProviderConfig`（単一）と排他的設定
- **OIDCグループベースドキュメントアクセス制御**: `allowed_oidc_groups` メタデータによるドキュメントアクセス制御。`checkOidcGroupAccess` 関数。SID/UID-GIDマッチ失敗時のフォールバックとしても機能
- **LDAP TLS証明書検証**: `tlsCaCertArn`（Secrets ManagerのCA証明書ARN）と `tlsRejectUnauthorized` でLDAPS接続のカスタムCA証明書検証を制御。開発環境での自己署名証明書許可
- **トークンリフレッシュとセッション管理**: `/api/auth/refresh` エンドポイント、`useTokenRefresh` フック。有効期限5分前にバックグラウンドリフレッシュ、期限切れ時はサインイン画面にリダイレクト
- **Fail-Closedモード**: `authFailureMode: "fail-closed"` で権限取得失敗時にサインインをブロック。構造化ログにブロック理由を記録。サインイン画面にエラーメッセージ表示
- **LDAPヘルスチェック**: `ldapConfig` 指定時に自動有効化（`healthCheckEnabled`）。EventBridge 5分間隔定期実行、CloudWatch Alarm（`LdapHealthCheck/Failure >= 1`）。接続・バインド・検索の各ステップ計測
- **認証監査ログ**: `auditLogEnabled: true` でDynamoDB監査テーブル（`{prefix}-auth-audit-log`）を作成。サインイン成功/失敗イベントを記録。TTL自動削除（`auditLogRetentionDays`、デフォルト90日）
- `lambda/ldap-health-check/index.ts`: LDAPヘルスチェックLambda関数
- `lambda/agent-core-ad-sync/audit-logger.ts`: 監査ログ書き込みモジュール
- `docker/nextjs/src/app/api/auth/refresh/route.ts`: トークンリフレッシュAPIエンドポイント
- `docker/nextjs/src/hooks/useTokenRefresh.ts`: トークン自動リフレッシュフック
- プロパティベーステスト11件追加（Property 18-28）
- ユニットテスト: マルチOIDC IdP 15件、OIDCグループアクセス制御 13件

### Changed
- `lib/stacks/demo/demo-security-stack.ts`: `oidcProviders`、`authFailureMode`、`auditLogEnabled`、`auditLogRetentionDays`、`healthCheckEnabled`、`tlsCaCertArn`、`tlsRejectUnauthorized` パラメータ追加。LDAPヘルスチェックLambda + EventBridge Rule + CloudWatch Alarm作成ロジック。監査テーブル作成ロジック
- `lambda/agent-core-ad-sync/index.ts`: `getGroupClaimForProvider`（IdPごとのグループクレーム名解決）、Fail-Closedモード、監査ログ統合、TLS CA証明書取得
- `lambda/agent-core-ad-sync/ldap-connector.ts`: `tlsCaCert`、`tlsRejectUnauthorized` TLS設定フィールド追加。TLS接続エラー時の証明書検証詳細ログ
- `lambda/permissions/metadata-filter-handler.ts`: `checkOidcGroupAccess` 関数、`filterByStrategy` にOIDCグループフォールバック統合
- `docker/nextjs/components/login-form.tsx`: マルチOIDCボタン動的レンダリング（`parseOidcProviders`）
- `bin/demo-app.ts`: `oidcProviders`、`authFailureMode`、`auditLogEnabled`、`auditLogRetentionDays` CDKコンテキスト読み込み
- `cdk.context.json.example`: Phase 2拡張機能の設定例追加、issuer URL末尾スラッシュ注意事項追加
- README（8言語）: Phase 2拡張機能のドキュメント追加、OIDCトラブルシューティング3件追加

### Fixed
- Cognito User Poolの`email`属性を`mutable: true`に変更（OIDC IdP経由のサインイン時に`user.email: Attribute cannot be updated`エラーが発生する問題を修正）
- `writeAuditLog`呼び出しに`await`を追加（Lambda終了前にDynamoDB書き込みが完了しない問題を修正）
- Auth0の`issuerUrl`に末尾スラッシュを追加（CognitoのIDトークン`iss`クレーム検証で`invalid_request`が発生する問題を修正）
- OAuthコールバックのエラーログに`error_description`を追加（デバッグ情報の改善）
- トークンリフレッシュをCookieベースに変更（OAuthコールバックで`refresh-token` httpOnly Cookie + `token-expiry` Cookie を設定。`useTokenRefresh`フックがCookieから有効期限を読み取りバックグラウンドリフレッシュを実行）
- `AD_TYPE`のデフォルト値を`self-managed`から`none`に変更（AD未設定時のメール/パスワードサインインで`AD_EC2_INSTANCE_ID is required`エラーが発生する問題を修正）
- `handleSamlDirectPath`にAD未設定時の早期リターンを追加（`AD_TYPE=none`の場合はSID同期をスキップ）
- `oidcProviders`配列の最初のIdPのCDKリソースIDを`OidcIdP`に固定（`oidcProviderConfig`→`oidcProviders`移行時のCognito IdP競合を回避）
- サインインページの`NEXT_PUBLIC_*`環境変数を`/api/auth/config`エンドポイント経由で取得するように変更（Lambda環境変数はビルド時にインライン化されないため、ランタイムでサーバーサイドAPIから取得）
- `AuthOptionsSection`（`[locale]/signin/page.tsx`）にマルチOIDCプロバイダーボタンの動的レンダリングを追加
- `/api/auth/ad-config`エンドポイントに`oidcProviders`フィールドを追加

### Verified (デプロイ検証で確認済み)
- **OIDC（Auth0）サインイン**: Cognito OIDC IdP経由のサインイン→チャット画面遷移→KB検索を確認。`oidctest@example.com`でPermission-aware検索が動作
- **認証監査ログ**: OIDCサインイン時にDynamoDB `auth-audit-log` テーブルに`sign-in`イベントが記録されることを確認（authSource: oidc, idpName: Auth0, TTL設定済み）
- **LDAPヘルスチェック**: OpenLDAP EC2（10.0.2.187:389）に対してLambda手動実行で全ステップSUCCESS（connect: 12ms, bind: 12ms, search: 16ms, total: 501ms）。CloudWatch Alarm: OK、EventBridge Rule: 5分間隔ENABLED
- **NATゲートウェイ経由アクセス**: VPC内LambdaがNATゲートウェイ経由でSecrets Manager（バインドパスワード取得）+ CloudWatch Metrics（PutMetricData）にアクセスできることを確認
- **構造化ログ**: LDAPヘルスチェックLambdaのCloudWatch LogsにJSON形式の構造化ログが正常出力されることを確認
- **メール/パスワードサインイン**: admin@example.comでKBモードPermission-aware検索（confidential含む5件アクセス可）を確認
- **2段階デプロイ**: `cloudFrontUrl`なし→URL取得→再デプロイ→Auth0 Callback URL設定の手順を検証済み
- **OIDC→LDAP E2Eフロー**: Identity Sync Lambda直接呼び出しで`alice@demo.local`のLDAP検索を確認。UID: 10001、GID: 5001、グループ3件取得、source: `OIDC-LDAP`としてDynamoDB保存
- **Fail-Openフォールバック**: LDAPユーザー未検出時にOIDCクレームのみにフォールバックし、サインインを継続することを確認
- **Fail-Closedモード**: `AUTH_FAILURE_MODE=fail-closed`設定時、LDAPユーザー未検出はエラーではなくフォールバック動作（設計通り）。Fail-Closedが発動するのはLDAP接続エラー等の致命的エラー時のみ
- **AD未設定時のdirect認証**: `AD_TYPE=none`でメール/パスワードサインイン時にSID同期をスキップし、エラーなしで正常動作することを確認（バグ修正後）
- **`--exclusively`デプロイ**: Networkingスタック依存関係エラー回避のため、Security + WebAppスタックのみの個別デプロイが正常動作することを確認
- **マルチOIDC IdP**: `oidcProviders`配列でCognito User Poolに2つのOIDC IdP（Auth0 + Auth0Dev）を登録。サインイン画面に2つのOIDCボタンが動的表示され、既存Auth0サインインが引き続き正常動作することを確認
- **`oidcProviderConfig`→`oidcProviders`移行**: CDKリソースID修正により、既存のCognito OIDC IdPを維持したまま`oidcProviders`配列に移行できることを確認
- **ONTAP name-mapping**: ONTAP REST API経由でname-mappingルール（alice→DEMO\Admin）の作成・取得を確認。fsxadminパスワードは`aws fsx update-file-system`で事前設定が必要

## [3.4.0] - 2026-04

### Added
- **OIDC/LDAP Federation — ゼロタッチユーザープロビジョニング**: OIDC IdP（Keycloak、Okta、Entra ID等）およびLDAP直接クエリによる権限自動マッピング。ファイルサーバーの既存ユーザー権限がRAGシステムのUIユーザーに自動マッピングされ、管理者やユーザー自身による手動登録は不要
- `cognito.UserPoolIdentityProviderOidc` CDKリソース（`oidcProviderConfig` 指定時に自動作成）
- SAML + OIDC ハイブリッド構成サポート（サインイン画面に両方のボタンを動的表示）
- Identity Sync Lambda: 認証ソース判別（`detectAuthSource`）、OIDCクレームパーサー（`parseOidcClaims`）、OIDC/LDAP権限取得パス
- LDAP Connector モジュール（`lambda/agent-core-ad-sync/ldap-connector.ts`）: LDAP/LDAPS接続、バインド認証、ユーザー検索、グループメンバーシップ取得、LDAPインジェクション防止（`escapeFilter`）、Secrets Managerパスワード取得（リトライ1回）
- Permission Resolver拡張: UID/GIDベースフィルタリング（`resolvePermissionStrategy`、`checkUidGidAccess`）、SID/UID-GID/Hybrid/Deny All戦略自動選択
- ONTAP name-mapping連携: `getNameMappingRules`、`resolveWindowsUser`（UNIX→Windowsユーザー対応付け）
- DynamoDB `user-access` テーブル拡張スキーマ: `uid`、`gid`、`unixGroups`、`oidcGroups`、`authSource` フィールド追加（後方互換性維持）
- サインインUI: OIDCサインインボタン（`buildOidcSignInUrl`）、設定駆動の動的表示
- CDKコンテキストパラメータ: `oidcProviderConfig`、`ldapConfig`、`ontapNameMappingEnabled`、`permissionMappingStrategy`
- 構造化ログ出力（JSON形式、シークレット自動除外）
- プロパティベーステスト17件（Property 1-17: CDKバリデーション、認証ソース判別、LDAP属性抽出、インジェクション防止、エラー非ブロッキング、DynamoDB保存フォーマット、キャッシュTTL、Permission Resolver戦略、UID/GIDマッチング、IdP登録組み合わせ、OIDCクレーム解析、ONTAP name-mappingフォールバック、ログシークレット除外等）
- ユニットテスト: CDK Stack OIDC拡張34件、Identity Sync Lambda OIDC拡張23件、LDAP Connector 35件、Permission Resolver 18件、ONTAP name-mapping 12件
- `cdk.context.json.example`: OIDC + LDAP構成例、SAML + OIDCハイブリッド構成例、ONTAP name-mapping REST API設定例追加
- **認証モード別デモ環境構築ガイド** (`demo-data/guides/auth-mode-setup-guide.md`): 5モード（メール/パスワード、SAML AD、OIDC+LDAP、OIDC Claims Only、SAML+OIDCハイブリッド）のサンプル構成ファイルと再現可能な構築手順。8言語対応
- **サンプル構成ファイル** (`demo-data/configs/mode-a~e-*.json`): 認証モード別の`cdk.context.json`テンプレート5種。`REPLACE_*`プレースホルダーで環境非依存
- **OpenLDAPセットアップスクリプト** (`demo-data/scripts/setup-openldap.sh`): VPC内EC2にOpenLDAPを自動構築、テストユーザー3名+グループ5つ+memberOfオーバーレイ設定
- **ONTAP name-mappingセットアップスクリプト** (`demo-data/scripts/setup-ontap-namemapping.sh`): FSx for ONTAP REST API経由でname-mappingルールを自動設定
- **検証スクリプト**: `verify-ldap-integration.sh`（LDAP→Lambda→DynamoDB検証）、`verify-ontap-namemapping.sh`（REST API接続・ルール取得検証）
- **モードCワンショットスクリプト** (`demo-data/scripts/setup-mode-c-oidc-ldap.sh`): 環境変数3つで全7フェーズ自動実行
- **サインイン画面多言語対応**: `[locale]/signin/page.tsx`の全テキストを`useTranslations('signin')`に置き換え、8言語21キー追加。`/signin`フォールバックページはブラウザ言語検出→ロケール付きページへ自動リダイレクト
- **実装概要14の観点**: README（8言語）に「OIDC/LDAP Federation + ONTAP Name-Mapping」を14番目の観点として追加
- `cleanup-all.sh`: OpenLDAP EC2/IAM/SG/Secrets Manager自動削除ステップ追加

### Changed
- `lib/stacks/demo/demo-security-stack.ts`: `DemoSecurityStackProps` にOIDC/LDAP設定インターフェース追加、OIDC IdP登録ロジック、LDAP Lambda VPC配置・IAM権限、環境変数設定
- `lambda/agent-core-ad-sync/index.ts`: 認証ソース判別、OIDCパスハンドラー、DynamoDB保存ロジック拡張、LDAP Connector統合
- `lambda/agent-core-ad-sync/ldap-connector.ts`: グループ整形のgidNumber二次クエリ制約をコードコメントに明記
- `lambda/permissions/metadata-filter-handler.ts`: Permission Resolver戦略選択、UID/GIDフィルタリング、ONTAP name-mapping統合
- `lambda/permissions/ontap-rest-api-client.ts`: name-mapping取得メソッド、`resolveWindowsUser` 関数追加
- `lambda/permissions/unified-permission-service.ts`: TODOコメントを実態に合わせた説明コメントに更新
- `docker/nextjs/components/login-form.tsx`: OIDCサインインボタン、`buildOidcSignInUrl` 関数追加
- `docker/nextjs/src/app/[locale]/signin/page.tsx`: 全テキストを`useTranslations`に置き換え（21キー）
- `docker/nextjs/src/app/signin/page.tsx`: ブラウザ言語検出→ロケール付きページへリダイレクトに変更
- `docker/nextjs/src/messages/*.json` (8言語): `signin`セクション21キー追加
- `lib/stacks/demo/demo-webapp-stack.ts`: `oidcProviderName`、`cognitoDomainUrl` props追加
- `bin/demo-app.ts`: OIDC/LDAP設定のCDKコンテキスト読み込み、スタック間連携
- `cdk.context.json.minimal`: 本CDKアプリのパラメータ形式に修正
- `cdk.context.json.staging`: 本CDKアプリのパラメータ形式に修正（OIDC+LDAP+監視構成）
- `cdk.context.json.production`: 本CDKアプリのパラメータ形式に修正（全機能有効構成）
- `demo-data/scripts/cleanup-all.sh`: OpenLDAP EC2/IAM/SG/Secrets Manager削除ステップ追加
- `demo-data/guides/demo-scenario.md`: シナリオ4（OIDC+LDAP Federation検証）追加
- `demo-data/guides/ontap-setup-guide.md`: セクション10（ONTAP Name-Mapping設定）追加
- `docs/auth-and-user-management.md` + 全7言語版: OpenLDAP考慮点、セットアップスクリプト、LDAP/ONTAP実環境テスト結果追加
- `docs/DOCUMENTATION_INDEX.md` + 全7言語版: 新規スクリプト・構成ファイル・ガイドへの参照追加
- `README.md` + 全7言語版: 実装概要14の観点、認証モード別ガイドへのリンク追加
- `docs/screenshots/signin-page-saml-oidc-hybrid.png`: 最新のサインイン画面に差し替え

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
- **S3 Access Point データソース**: FSx for ONTAP S3 AP経由のBedrock KBデータソース設定・検証完了
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

**最新バージョン**: 4.0.0
