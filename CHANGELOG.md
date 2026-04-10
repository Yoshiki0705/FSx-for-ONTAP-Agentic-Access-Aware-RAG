# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.0] - 2026-04

### Added
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

**最新バージョン**: 3.5.0
