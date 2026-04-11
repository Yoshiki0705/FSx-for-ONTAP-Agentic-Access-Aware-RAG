# 検証シナリオガイド

## 概要

Permission-aware RAGシステムの動作検証手順です。NTFS ACLのSID（Security Identifier）に基づく権限フィルタリングにより、2種類のユーザーで同じ質問に対して異なる検索結果が返ることを確認します。

## SIDフィルタリングの仕組み

```
┌──────────────────────────────────────────────────────────────────┐
│                    SIDベース権限フィルタリング                     │
│                                                                  │
│  ユーザーのSIDリスト        ドキュメントのallowed_group_sids      │
│  (DynamoDB user-access)     (.metadata.json)                     │
│                                                                  │
│  ┌─────────────────┐        ┌─────────────────────────┐         │
│  │ admin:           │        │ public/:                 │         │
│  │  -500 (Admin)    │   ∩    │  [S-1-1-0] (Everyone)   │ → ✅   │
│  │  -512 (DA)       │        │                         │         │
│  │  S-1-1-0 (All)   │        │ confidential/:           │         │
│  └─────────────────┘   ∩    │  [-512] (Domain Admins)  │ → ✅   │
│                              │                         │         │
│  ┌─────────────────┐        │ restricted/:              │         │
│  │ user:            │   ∩    │  [-1100, -512]           │         │
│  │  -1001 (User)    │        │  (Eng + DA)             │ → ❌   │
│  │  S-1-1-0 (All)   │        └─────────────────────────┘         │
│  └─────────────────┘                                             │
│                                                                  │
│  判定: ユーザーSID ∩ ドキュメントSID ≠ ∅ → ALLOW                │
│        ユーザーSID ∩ ドキュメントSID = ∅ → DENY                 │
└──────────────────────────────────────────────────────────────────┘
```

## テストユーザー

| ユーザー | メール | パスワード | 個人SID | グループSID | アクセス可能 |
|---------|--------|-----------|---------|------------|------------|
| 管理者 | admin@example.com | DemoAdmin123! | ...-500 (Administrator) | ...-512 (Domain Admins), S-1-1-0 (Everyone) | 全ドキュメント |
| 一般ユーザー | user@example.com | DemoUser123! | ...-1001 (Regular User) | S-1-1-0 (Everyone) | publicのみ |

## ドキュメントとSIDの対応

| ドキュメント | allowed_group_sids | admin | user |
|-------------|-------------------|-------|------|
| public/product-catalog.md | S-1-1-0 (Everyone) | ✅ | ✅ |
| public/company-overview.md | S-1-1-0 (Everyone) | ✅ | ✅ |
| confidential/financial-report.md | ...-512 (Domain Admins) | ✅ | ❌ |
| confidential/hr-policy.md | ...-512 (Domain Admins) | ✅ | ❌ |
| restricted/project-plan.md | ...-1100 (Engineering), ...-512 (Domain Admins) | ✅ | ❌ |

## 検証シナリオ

### シナリオ1: 管理者ユーザーでの検索

1. CloudFront URLにアクセス
2. `admin@example.com` / `DemoAdmin123!` でサインイン
3. チャットで以下の質問を入力:

**質問例:**
- 「会社の売上はいくらですか？」
  - 期待結果: 財務レポートの情報を含む回答（¥500,000,000等）
  - ソース: `confidential/financial-report.md`
  - SIDマッチ: ユーザーの `-512` (Domain Admins) がドキュメントの `allowed_group_sids` にマッチ

- 「リモートワークのポリシーを教えてください」
  - 期待結果: 人事ポリシーの詳細を含む回答
  - ソース: `confidential/hr-policy.md`
  - SIDマッチ: ユーザーの `-512` (Domain Admins) がマッチ

- 「プロジェクトのスケジュールは？」
  - 期待結果: プロジェクト計画の情報を含む回答
  - ソース: `restricted/project-plan.md`
  - SIDマッチ: ユーザーの `-512` (Domain Admins) がマッチ

- 「製品の概要を教えてください」
  - 期待結果: 製品カタログの情報を含む回答
  - ソース: `public/product-catalog.md`
  - SIDマッチ: ユーザーの `S-1-1-0` (Everyone) がマッチ

### シナリオ2: 一般ユーザーでの検索

1. サインアウト
2. `user@example.com` / `DemoUser123!` でサインイン
3. 同じ質問を入力:

**質問例:**
- 「会社の売上はいくらですか？」
  - 期待結果: 財務情報にアクセスできないため、公開情報のみで回答
  - SID判定: ユーザーSID `[-1001, S-1-1-0]` ∩ ドキュメントSID `[-512]` = ∅ → DENY
  - ソース: `public/company-overview.md`（財務レポートは非表示）

- 「リモートワークのポリシーを教えてください」
  - 期待結果: 人事ポリシーにアクセスできないため、情報なしまたは公開情報のみ
  - SID判定: マッチなし → DENY

- 「製品の概要を教えてください」
  - 期待結果: 製品カタログの情報を含む回答（publicなのでアクセス可能）
  - SID判定: ユーザーSID `S-1-1-0` ∈ ドキュメントSID `[S-1-1-0]` → ALLOW
  - ソース: `public/product-catalog.md`

## 確認ポイント

1. **SIDベースフィルタリング**: 同じ質問でも、ユーザーのSIDに基づいて検索結果が異なることを確認
2. **ソースドキュメント表示**: 回答に使用されたドキュメントのcitation情報を確認
3. **機密情報の保護**: 一般ユーザーにconfidential/restrictedドキュメントの内容が表示されないことを確認
4. **安全側フォールバック**: SID情報がない場合は全ドキュメントが拒否されることを確認

## セットアップ手順

```bash
# 1. テストユーザー作成（Cognito）
export COGNITO_USER_POOL_ID=<User Pool ID>
bash demo-data/scripts/create-demo-users.sh

# 2. ユーザーSIDデータ登録（DynamoDB）
export USER_ACCESS_TABLE_NAME=<user-access table name>
export ADMIN_USER_SUB=<admin Cognito sub>
export REGULAR_USER_SUB=<user Cognito sub>
bash demo-data/scripts/setup-user-access.sh

# 3. テストデータアップロード（S3）
export DATA_BUCKET_NAME=<S3 bucket name>
bash demo-data/scripts/upload-demo-data.sh

# 4. Bedrock KBデータソース同期
export BEDROCK_KB_ID=<Knowledge Base ID>
bash demo-data/scripts/sync-kb-datasource.sh
```

## トラブルシューティング

### シナリオ3: AD SSOでのサインイン

> **前提条件**: `enableAdFederation=true` でCDKデプロイ済み。SAML IdPとCognito Domainが設定済みであること。

#### 3-1. AD SSOサインインフロー

1. CloudFront URLにアクセス
2. サインインページで「ADでサインイン」ボタンをクリック
3. Cognito Hosted UI経由でSAML IdP（AD）の認証画面にリダイレクト
4. AD資格情報（ドメインユーザー名/パスワード）を入力
5. 認証成功後、Cognito User Poolにユーザーが自動作成される
6. Post-Authentication TriggerによりAD Sync LambdaがDynamoDB user-accessテーブルにSIDデータを自動登録
7. OAuthコールバック経由でセッションCookieが設定され、チャット画面に遷移

#### 3-2. 確認ポイント

| 確認項目 | 期待結果 |
|---------|---------|
| 「ADでサインイン」ボタン表示 | `COGNITO_DOMAIN`環境変数設定時のみ表示 |
| SAML認証リダイレクト | Cognito Hosted UI → AD認証画面 |
| Cognitoユーザー自動作成 | Cognito User Poolにフェデレーションユーザーが作成される |
| SIDデータ自動登録 | DynamoDB user-accessテーブルにSIDデータが登録される |
| チャット画面遷移 | 認証成功後、チャット画面に正常遷移 |
| SIDフィルタリング | ADユーザーのSIDに基づいた権限フィルタリングが動作 |

#### 3-3. フェデレーション無効時のフォールバック

`enableAdFederation=false`（デフォルト）の場合:
- 「ADでサインイン」ボタンは非表示
- 既存のメール/パスワード認証フォームのみ表示
- シナリオ1・2の手順で検証可能

## トラブルシューティング

- **検索結果が返らない**: Bedrock KBデータソースの同期が完了しているか確認
- **全ドキュメントが拒否される**: DynamoDB user-accessテーブルにユーザーのSIDデータが登録されているか確認。**注意**: アプリはCognitoの`sub`ではなくメールアドレスを`userId`として送信するため、DynamoDBの`userId`キーにはメールアドレスを使用すること
- **SIDフィルタリングが効かない**: `.metadata.json` の `allowed_group_sids` が正しく設定されているか確認
- **サインインできない**: Cognito User Poolのユーザーステータスを確認

---

## シナリオ4: OIDC + LDAP Federation検証

> **前提条件**: `oidcProviderConfig` + `ldapConfig` でCDKデプロイ済み。OpenLDAPサーバーがVPC内で稼働中。

### 4-1. OpenLDAPセットアップ

```bash
# OpenLDAPサーバー構築（EC2 + user-data）
bash demo-data/scripts/setup-openldap.sh

# cdk.context.json に ldapConfig を追加してCDKデプロイ
npx cdk deploy perm-rag-demo-demo-Security
```

### 4-2. LDAPテストユーザー

| ユーザー | メール | UID | GID | グループ |
|---------|--------|-----|-----|---------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-3. OIDC + LDAPサインインフロー

1. CloudFront URLにアクセス
2. 「Auth0でサインイン」ボタンをクリック
3. Auth0認証画面でメールアドレス/パスワードを入力
4. 認証成功後、Post-Auth TriggerでIdentity Sync Lambdaが実行
5. LDAP Connectorがalice@demo.localでOpenLDAPを検索
6. UID(10001)/GID(5001)/memberOf(3グループ)を取得
7. DynamoDBに `source: "OIDC-LDAP"` で保存
8. チャット画面に遷移

### 4-4. 確認ポイント

| 確認項目 | 期待結果 |
|---------|---------|
| DynamoDB `uid` | 10001（LDAPから取得） |
| DynamoDB `gid` | 5001（LDAPから取得） |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| DynamoDB `oidcGroups` | OIDCトークンのグループクレーム値 |
| Lambda CloudWatch Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. 検証スクリプト

```bash
# LDAP統合検証
bash demo-data/scripts/verify-ldap-integration.sh

# ONTAP name-mapping検証
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. OpenLDAP構築時の考慮点

| 項目 | 内容 |
|------|------|
| memberOfオーバーレイ | 基本OpenLDAPでは`memberOf`属性が自動付与されない。`moduleload memberof` + `overlay memberof` を `slapd.conf` に追加し、`groupOfNames` エントリを作成する必要がある |
| posixGroupとgroupOfNames | `posixGroup`（`memberUid`属性）と`groupOfNames`（`member`属性）は構造クラスが異なり混在不可。`memberOf`オーバーレイには`groupOfNames`が必要 |
| slapd.confモード | Amazon Linux 2023では `slapd.d` (cn=config) がデフォルトだが、`slapd.conf` モードの方が設定が簡単。systemdオーバーライドで `-f /etc/openldap/slapd.conf` を指定 |
| セキュリティグループ | Lambda SGからLDAP SG へのポート389/636インバウンドを許可。LDAP SGからのHTTPS(443)アウトバウンドも必要（Secrets Manager/DynamoDB用） |
| Secrets Manager | バインドパスワードはプレーンテキスト文字列として保存（JSON不要） |
| VPC配置 | `ldapConfig` 指定時、CDKが自動的にLambdaをVPC内に配置し、LDAP用SGを作成 |


---

## 5. マルチエージェント協調デモ

### 前提条件

`cdk.context.json` で `enableMultiAgent: true` を設定してデプロイ済みであること。

### 5-1. マルチエージェントモードの有効化

1. チャット画面のヘッダーで **[マルチAgent]** トグルをクリック
2. ヘッダーの **[Agent選択]** ドロップダウンからSupervisor Agent（`perm-rag-demo-demo-supervisor`）を選択
3. 新しいマルチエージェントセッションが自動作成される

### 5-2. 権限フィルタリング付きマルチエージェント検索

**admin ユーザーでサインイン:**

```
質問: 財務レポートの概要を教えてください
```

- Permission Resolver → SID解決 → Retrieval Agent → KB検索（フィルタ付き） → Analysis Agent → 回答生成
- Agent Trace UIでタイムライン・コスト内訳を確認

**user ユーザーでサインイン:**

同じ質問を送信し、権限フィルタリングにより異なる結果が返ることを確認。

### 5-3. Single Agent vs Multi-Agent 比較

1. **Single モード**で質問を送信 → レスポンス時間・コストを記録
2. **Multi モード**に切替 → 同じ質問を送信 → レスポンス時間・コストを比較
3. Agent Trace UIで各Collaboratorの実行時間・トークン消費を確認

### 5-4. デプロイ時の注意事項

マルチエージェント機能のデプロイには以下の技術的制約があります:

- **CloudFormation `AgentCollaboration` 有効値**: `DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` のみ。`COLLABORATOR` は無効値
- **2段階デプロイ**: Supervisor Agent は `DISABLED` で作成後、Custom Resource Lambda で `SUPERVISOR_ROUTER` に変更 → `AssociateAgentCollaborator` → `PrepareAgent` の順で実行
- **IAM 権限**: Supervisor ロールに `bedrock:GetAgentAlias` + `bedrock:InvokeAgent`（`agent-alias/*/*`）、Custom Resource Lambda に `iam:PassRole` が必要
- **Collaborator Alias**: 各 Collaborator Agent は `CfnAgentAlias` が必須（Supervisor からの参照に必要）
- **autoPrepare=true 不可**: Supervisor Agent では Collaborator なしの状態で失敗するため使用不可

### 5-5. 動作確認で得た知見

- **Team一覧フェッチ**: チャットページのMultiモードトグルは、ページロード時にTeam一覧をAPIフェッチして`teams.length > 0`を確認する。Team未作成の場合はMultiモードが無効化される（設計通り）
- **Supervisor Agent直接選択**: Supervisor Agentをドロップダウンから直接選択してSingle Agentモードで呼び出しても、Bedrock Agent側でマルチエージェント協調が処理される（Supervisor → Collaborator の実行フローが動作する）
- **権限フィルタリング**: Supervisor Agent経由のレスポンスにも権限フィルタリング済みのcitationが含まれる（adminユーザーはconfidentialドキュメントも参照可能、一般ユーザーはpublicのみ）
- **Docker イメージ更新**: コード変更後は `docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation` の3ステップが必要（CDKは`latest`タグの変更を検出しない）
- **Multiモード統合**: Multiモードトグル → `/api/bedrock/agent-team/invoke` 呼び出し → `multiAgentTrace` 付きレスポンス → MultiAgentTraceTimeline + CostSummary の条件付きレンダリングが動作確認済み
- **Collaboratorトレース**: Bedrock Agent InvokeAgent APIのトレースイベントからCollaborator実行情報を抽出する `buildCollaboratorTraces` は、Supervisor内部のCollaborator呼び出しがトレースに含まれない場合がある（Bedrock側の制約）。レスポンス自体は正常に返される
- **Supervisor instruction改善**: Supervisor Agentの instruction を「必ずCollaboratorを呼び出す」よう明示的に記述することで、Collaborator呼び出しが安定する。Alias更新時に自動的に新バージョンが作成される（`update-agent-alias` → 新バージョン自動作成）
- **Collaboratorトレース推定**: Bedrock Agent `SUPERVISOR_ROUTER` モードでは、Collaborator呼び出しのトレースが `collaboratorInvocationInput/Output` として返されない場合がある。`buildCollaboratorTraces` は rationale + modelInvocationOutput から推定トレースを構築するフォールバック戦略を実装
- **routingClassifierTrace**: `SUPERVISOR_ROUTER` モードでは、Collaborator呼び出しのトレースは `orchestrationTrace` ではなく `routingClassifierTrace` 内の `agentCollaboratorInvocationInput/Output` に含まれる。`buildCollaboratorTraces` は両方のトレース形式を検索するよう修正済み
- **filteredSearch Lambda SID自動解決**: Supervisor → RetrievalAgent → filteredSearch Lambda の呼び出しチェーンでは、`sessionAttributes` が Collaborator に伝播される。filteredSearch Lambda は `sessionAttributes.userId` から DynamoDB User Access Table を参照してSID情報を自動解決するフォールバックを実装。SIDパラメータなしでも権限フィルタリングが動作する
- **KBメタデータのクォート問題**: Bedrock KB の `allowed_group_sids` メタデータは `['"S-1-1-0"']` のように余分なダブルクォートを含む場合がある。`cleanSID` 関数で除去して正しいSIDマッチングを実現
- **Retrieval Agent instruction**: 「必ずfilteredSearchを呼び出す」「SIDが必要と自分で判断しない」と明示的に記述することで、Action Group Lambda の確実な呼び出しが実現
- **Agent instruction多言語対応**: CDK `agentLanguage` プロパティ（デフォルト: `'auto'`）により、Agent instruction を英語ベースで記述し、回答言語はユーザーの入力言語に自動追従。`cdk.context.json` で `"agentLanguage": "Japanese"` 等の固定指定も可能
- **E2E動作確認成功**: admin ユーザーで Multiモード → 「製品カタログの内容を教えてください」→ FSx for ONTAP 上の `product-catalog.md` の内容が権限フィルタリング済みで返却。RetrievalAgent 詳細パネル（実行時間 8.1s）、CostSummary（$0.049、入力11.6Kトークン）が正常表示
