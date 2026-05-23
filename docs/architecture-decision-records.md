# Architecture Decision Records (ADR)

**🌐 Language:** **日本語** | [English](en/architecture-decision-records.md) | [한국어](ko/architecture-decision-records.md) | [简体中文](zh-CN/architecture-decision-records.md) | [繁體中文](zh-TW/architecture-decision-records.md) | [Français](fr/architecture-decision-records.md) | [Deutsch](de/architecture-decision-records.md) | [Español](es/architecture-decision-records.md)

**作成日**: 2026-05-23  
**ステータス**: 承認済み  
**対象**: アーキテクト、技術リード、意思決定の経緯を理解したい方向け

---

## 概要

本ドキュメントは、Permission-aware Agentic RAG システムの主要なアーキテクチャ意思決定とその根拠を記録します。「なぜこの構成を選んだのか」を説明し、将来の変更判断に役立てることを目的とします。

---

## ADR-001: ベクトルストア — S3 Vectors をデフォルト採用

| 項目 | 内容 |
|------|------|
| **ステータス** | 承認済み |
| **日付** | 2026-03-29 |
| **コンテキスト** | RAG 検索のベクトルストアとして S3 Vectors と OpenSearch Serverless のどちらをデフォルトにするか |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|----------|
| S3 Vectors（採用） | 月数ドル、運用ゼロ、ワンクリックで AOSS エクスポート可能 | コールドクエリ: サブ秒、高 QPS 非対応 |
| OpenSearch Serverless | 常時 50ms、高 QPS 対応、全文検索可能 | 最低 $700/月（2 OCU）、OCU 管理必要 |

### 決定

**S3 Vectors をデフォルト**とし、`vectorStoreType` パラメータで OpenSearch Serverless に切替可能にする。

### 根拠

1. PoC / 小規模利用では月数ドルで開始でき、採用障壁が低い
2. Bedrock KB 経由のアクセスではベクトルストアに依存しないため、SID フィルタリングロジックは共通
3. 性能要件が高まった場合、コンソールからワンクリックで AOSS にエクスポート可能（約 15 分）
4. S3 Vectors のメタデータは全て filterable（追加設定不要）

### 影響

- デフォルトデプロイのコストが大幅に低下（$700/月 → $5/月）
- 高 QPS 環境では `vectorStoreType=opensearch` への切替が必要
- S3 Vectors の 2KB filterable metadata 制限に注意（PDF メタデータが大きい場合）

---

## ADR-002: 権限フィルタリング — アプリ側 SID マッチング

| 項目 | 内容 |
|------|------|
| **ステータス** | 承認済み |
| **日付** | 2026-01-15 |
| **コンテキスト** | RAG 検索結果の権限フィルタリングをどのレイヤーで実施するか |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|----------|
| アプリ側 SID マッチング（採用） | ベクトルストア非依存、LLM バイパス不可、Fail-Closed 実装容易 | 検索後フィルタのため、取得件数 > 表示件数 |
| ベクトルストア metadata filter | 検索時にフィルタ、効率的 | Bedrock KB Retrieve API では直接制御不可 |
| Bedrock KB RetrieveAndGenerate | 1 API で完結 | metadata が返らないため SID フィルタ不可能 |

### 決定

**Bedrock KB Retrieve API + アプリ側 SID マッチング + Converse API** の 2 段階方式を採用。

### 根拠

1. RetrieveAndGenerate API は citation の metadata に `allowed_group_sids` を含めないため、SID フィルタリングが不可能
2. アプリ側フィルタリングは LLM の外側で実行されるため、Prompt Injection でバイパスできない
3. ベクトルストアの種類（S3 Vectors / AOSS）に依存しない共通ロジック
4. Fail-Closed（SID 取得失敗時は全拒否）の実装が明確

### 影響

- Retrieve API で取得した全ドキュメントに対してフィルタリングするため、取得件数を多めに設定する必要がある
- フィルタリング後のドキュメント数が少ない場合、回答品質が低下する可能性
- 権限キャッシュ（DynamoDB、TTL 5 分）で繰り返しチェックを高速化

---

## ADR-003: 認証方式 — Cognito + マルチ IdP フェデレーション

| 項目 | 内容 |
|------|------|
| **ステータス** | 承認済み |
| **日付** | 2026-02-01 |
| **コンテキスト** | ユーザー認証と SID/UID/GID 取得の方式選定 |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|----------|
| Cognito + SAML/OIDC/LDAP（採用） | 5 モード対応、CDK パラメータで切替、Fail-Closed 対応 | Cognito の制約（カスタム属性数、トークンサイズ） |
| IAM Identity Center 直接利用 | AWS ネイティブ SSO | RAG アプリとの統合が複雑 |
| カスタム認証（Lambda Authorizer） | 完全な柔軟性 | 実装・運用コスト大 |

### 決定

**Cognito User Pool** をハブとし、SAML（AD Federation）、OIDC（Auth0/Keycloak/Okta）、LDAP（OpenLDAP/FreeIPA）、メール/パスワードの 5 モードを CDK パラメータで切替可能にする。

### 根拠

1. Cognito は CloudFront + Lambda Function URL (IAM Auth) との統合が容易
2. Post-Authentication Trigger で SID/UID/GID の自動取得・DynamoDB 登録が可能
3. `authFailureMode=fail-closed` で権限取得失敗時のサインインブロックを実現
4. 顧客の既存 IdP に合わせてモードを選択できる柔軟性

### 影響

- Cognito の制約（カスタム属性 50 個、トークンサイズ 2KB）に注意
- SAML メタデータ URL の管理が必要（IdP 側の証明書更新時）
- LDAP 直接クエリは VPC 内 Lambda が必要

---

## ADR-004: フロントエンド — Lambda Web Adapter + Next.js 15

| 項目 | 内容 |
|------|------|
| **ステータス** | 承認済み |
| **日付** | 2026-01-10 |
| **コンテキスト** | Web アプリケーションのホスティング方式選定 |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|----------|
| Lambda Web Adapter + Next.js（採用） | サーバーレス、IAM Auth + OAC、コールドスタート許容 | コールドスタート 3-5 秒、Docker イメージサイズ |
| ECS Fargate | 常時起動、低レイテンシ | 最低 $30/月（常時稼働）、ALB 必要 |
| Amplify Hosting | マネージド、CI/CD 統合 | IAM Auth 非対応、カスタマイズ制限 |
| App Runner | 簡単デプロイ、自動スケール | IAM Auth 非対応、VPC 統合制限 |

### 決定

**Lambda Web Adapter** で Next.js 15 をサーバーレス実行し、CloudFront OAC + IAM Auth で保護する。

### 根拠

1. IAM 認証（Function URL + OAC）により、CloudFront 以外からの直接アクセスを完全に防止
2. サーバーレスのため、利用がない時間帯のコストがゼロ
3. CDK でワンコマンドデプロイ可能（Docker イメージビルド含む）
4. Next.js 15 の App Router + Server Components で SSR/ISR が利用可能

### 影響

- コールドスタート（3-5 秒）は初回アクセス時に発生。Provisioned Concurrency で緩和可能
- Docker イメージサイズの最適化が必要（マルチステージビルド）
- Apple Silicon (M1/M2/M3) ではプリビルドモードが必要（x86_64 Lambda 互換）

---

## ADR-005: データ同期 — KB Auto-Sync（ポーリング方式）

| 項目 | 内容 |
|------|------|
| **ステータス** | 承認済み |
| **日付** | 2026-04-15 |
| **コンテキスト** | FSx for ONTAP 上のファイル変更を Bedrock KB に反映する方式 |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|----------|
| EventBridge Scheduler ポーリング（採用） | シンプル、FSx イベント不要、S3 AP 互換 | 最大 15 分遅延、ListObjectsV2 コスト |
| CloudTrail + EventBridge（イベント駆動） | ニアリアルタイム | S3 AP の CloudTrail 対応が限定的 |
| FSx Audit Log + EventBridge | ファイルレベルイベント | 設定複雑、ログ量大 |
| 手動トリガーのみ | 最もシンプル | 運用負荷、同期忘れリスク |

### 決定

**EventBridge Scheduler による 5-15 分間隔ポーリング**をデフォルトとし、変更検出時のみ `StartIngestionJob` を実行する。

### 根拠

1. FSx for ONTAP S3 Access Point は CloudTrail データイベントの対応が限定的
2. ListObjectsV2 + DynamoDB インベントリ比較で確実に変更を検出
3. IN_PROGRESS ジョブの重複排除で無駄な同期を防止
4. 3 回連続失敗で CloudWatch Alarm → 運用チームに通知

### 影響

- 最大 15 分の同期遅延（ポーリング間隔に依存）
- 大規模環境（100,000+ ファイル）では ListObjectsV2 の所要時間に注意
- Transfer Family パスでは CloudTrail イベント駆動モードも選択可能

---

## ADR-006: Smart Routing — 3 層モデル自動選択

| 項目 | 内容 |
|------|------|
| **ステータス** | 承認済み |
| **日付** | 2026-05-01 |
| **コンテキスト** | コスト最適化のためのモデル選択戦略 |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|----------|
| 3 層自動ルーティング（採用） | コスト 60-80% 削減、品質維持 | 分類精度に依存、誤分類リスク |
| 単一モデル固定 | シンプル、予測可能 | コスト非効率 or 品質不足 |
| ユーザー手動選択 | ユーザー制御 | UX 悪化、コスト管理困難 |

### 決定

クエリ複雑度に基づく **3 層自動ルーティング**（Simple → Haiku、Complex → Sonnet、Full-context → Opus）をデフォルトとし、手動選択オプションも提供する。

### 根拠

1. エンタープライズ RAG では質問の 60% 以上が簡単な事実確認（Haiku で十分）
2. 加重平均コスト ~$0.014/query は、全て Sonnet の ~$0.01 と比較して品質向上しつつコスト同等
3. CloudWatch EMF メトリクスでルーティング分布を可視化し、閾値調整が可能
4. フォールバック機構（モデル不可時に次のティアに自動切替）で可用性確保

### 影響

- 分類器の精度がコストと品質に直結（定期的な閾値チューニング推奨）
- Opus 利用時のコストスパイクに注意（日次コスト上限の設定推奨）
- Smart Routing OFF 時は従来通り単一モデル固定

---

## 関連ドキュメント

| ドキュメント | 関連 ADR |
|-------------|---------|
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](permission-consistency.md) | ADR-005 |
| [evaluation.md](evaluation.md) | ADR-006 |
