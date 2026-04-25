# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **ONTAP name-mappingセットアップスクリプト** (`demo-data/scripts/setup-ontap-namemapping.sh`): FSx ONTAP REST API経由でname-mappingルールを自動設定
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

**最新バージョン**: 4.0.0
