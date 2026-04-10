# 認証モード別デモ環境構築ガイド

**作成日**: 2026-04-04
**対象**: 5つの認証モードそれぞれのデモ環境を再現可能な手順で構築する

---

## 概要

本システムは5つの認証モードをサポートしています。各モードのサンプル構成ファイルが `demo-data/configs/` に用意されており、`cdk.context.json` にコピーするだけでデプロイできます。

| モード | 構成ファイル | 認証方式 | 権限取得 | 追加インフラ |
|--------|-------------|---------|---------|------------|
| A | `mode-a-email-password.json` | メール/パスワード | 手動SID登録 | なし |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | OIDC Claims Only | OIDCトークン | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## 共通手順

全モード共通の前提条件とデプロイ手順です。

### 前提条件

```bash
# Node.js 22+, Docker, AWS CDK
node --version   # v22.x.x
docker --version # Docker version 2x.x.x
npx cdk --version

# AWS CLI設定済み
aws sts get-caller-identity
```

### デプロイ手順

```bash
# 1. 構成ファイルをコピー（モードに応じて選択）
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json

# 2. REPLACE_* プレースホルダーを実際の値に置換

# 3. プリデプロイ（ECRリポジトリ + Dockerイメージ）
bash demo-data/scripts/pre-deploy-setup.sh

# 4. CDKデプロイ（全スタック、約30-40分）
npx cdk deploy --all --require-approval never

# 5. ポストデプロイ（テストデータ + ユーザー作成）
bash demo-data/scripts/post-deploy-setup.sh

# 6. デプロイ検証
bash demo-data/scripts/verify-deployment.sh
```

---

## モードA: メール/パスワード認証（最小構成）

最もシンプルな構成。管理者がCognitoユーザーとDynamoDB SIDデータを手動登録します。

### 構成ファイル

```bash
cp demo-data/configs/mode-a-email-password.json cdk.context.json
```

### デプロイ

```bash
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
```

### 検証

```bash
# テストユーザーでサインイン
# admin@example.com / DemoPass1234 → 全ドキュメントアクセス可
# user@example.com  / DemoPass1234 → publicのみアクセス可
```

### サインイン画面

メール/パスワードフォームのみ表示されます。

---

## モードB: SAML AD Federation

ADユーザーがSAML経由でサインインし、SIDが自動取得されます。

### 前提条件

- AWS IAM Identity Center が有効化済み
- Managed ADをIDソースとして設定済み
- SAMLアプリケーション作成済み（メタデータURL取得済み）

### 構成ファイル

```bash
cp demo-data/configs/mode-b-saml-ad-federation.json cdk.context.json
# 以下を置換:
#   REPLACE_WITH_YOUR_METADATA_ID → IAM Identity CenterのSAMLメタデータID
#   REPLACE_WITH_YOUR_CLOUDFRONT_URL → CloudFront Distribution URL
```

### デプロイ

```bash
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh

# CloudFront URLを取得して cdk.context.json の cloudFrontUrl を更新
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text --region ap-northeast-1)
echo "CloudFront URL: $CF_URL"
# cdk.context.json の cloudFrontUrl を更新して再デプロイ
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp --require-approval never
```

### 検証

```bash
# CloudFront URLにアクセス → 「ADでサインイン」ボタンをクリック
# AD資格情報で認証 → チャット画面に遷移
# DynamoDB user-access テーブルにSIDデータが自動登録されることを確認
```

### サインイン画面

「ADでサインイン」ボタン + メール/パスワードフォームが表示されます。

---

## モードC: OIDC + LDAP（OpenLDAP + Auth0/Keycloak）

OIDCサインイン + LDAPからUID/GID/グループを自動取得する構成。

### 前提条件

- OIDC IdP（Auth0, Keycloak, Okta等）でクライアントアプリケーション作成済み
- `clientId`, `clientSecret`, `issuerUrl` を取得済み
- `clientSecret` をSecrets Managerに登録済み

### Step 1: OIDC IdP設定

```bash
# Auth0の場合:
# 1. Auth0 Dashboard → Applications → Create Application
# 2. Regular Web Application を選択
# 3. Settings:
#    - Allowed Callback URLs: https://YOUR_COGNITO_DOMAIN.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse
#    - Allowed Logout URLs: https://YOUR_CLOUDFRONT_URL/signin
# 4. clientId, clientSecret, issuerUrl をメモ

# clientSecretをSecrets Managerに登録
aws secretsmanager create-secret \
  --name oidc-client-secret \
  --secret-string "YOUR_CLIENT_SECRET" \
  --region ap-northeast-1
```

### Step 2: OpenLDAPサーバー構築

```bash
# CDKデプロイ後に実行（VPCが必要）
npx cdk deploy perm-rag-demo-demo-Networking --require-approval never

# OpenLDAPサーバー構築（EC2 + テストユーザー/グループ）
bash demo-data/scripts/setup-openldap.sh
# 出力されるLDAP URL, Secret ARNをメモ
```

### Step 3: 構成ファイル

```bash
cp demo-data/configs/mode-c-oidc-ldap.json cdk.context.json
# 以下を置換:
#   REPLACE_WITH_OIDC_CLIENT_ID → OIDCクライアントID
#   REPLACE_ACCOUNT → AWSアカウントID
#   REPLACE_WITH_OIDC_ISSUER → OIDCイシュアーURL
#   REPLACE_WITH_LDAP_IP → OpenLDAP EC2のプライベートIP
#   REPLACE_WITH_YOUR_CLOUDFRONT_URL → CloudFront URL
```

### Step 4: デプロイ

```bash
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never

# CloudFront URL取得 → cdk.context.json更新 → 再デプロイ
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text --region ap-northeast-1)
# cdk.context.json の cloudFrontUrl を更新
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp --require-approval never
```

### Step 5: ONTAP Name-Mapping設定（オプション）

```bash
bash demo-data/scripts/setup-ontap-namemapping.sh
```

### 検証

```bash
# LDAP統合検証
bash demo-data/scripts/verify-ldap-integration.sh

# ONTAP name-mapping検証
bash demo-data/scripts/verify-ontap-namemapping.sh

# LDAPヘルスチェック検証
# Lambda手動実行（接続・バインド・検索の各ステップ結果を確認）
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# CloudWatch Alarm状態確認（OK = 正常、ALARM = LDAP接続失敗）
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# EventBridge Rule確認（5分間隔の定期実行）
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# CloudWatch Logs確認（構造化ログ）
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h

# ブラウザ検証:
# CloudFront URL → 「Auth0でサインイン」→ Auth0認証 → チャット画面
# DynamoDB: uid, gid, source="OIDC-LDAP" を確認
```

> **検証済み結果（2026-04-10）**: OpenLDAP EC2（10.0.2.187:389）に対してLDAPヘルスチェックLambda手動実行で全ステップSUCCESS（connect: 12ms, bind: 12ms, search: 16ms, total: 501ms）。CloudWatch Alarm: OK、EventBridge Rule: 5分間隔ENABLED。NATゲートウェイ経由でSecrets Manager + CloudWatch Metricsアクセス正常。

### テストユーザー（OpenLDAP）

| ユーザー | メール | UID | GID | グループ |
|---------|--------|-----|-----|---------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### サインイン画面

「{providerName}でサインイン」ボタン + メール/パスワードフォームが表示されます。

---

## モードD: OIDC Claims Only（LDAPなし）

OIDCトークンのグループクレームのみで権限マッピングを行う最軽量のFederation構成。

### 前提条件

- OIDC IdPでグループクレームが設定済み
- Auth0の場合: Post Login Actionで名前空間付きクレームを設定

```javascript
// Auth0 Post Login Action
exports.onExecutePostLogin = async (event, api) => {
  const groups = event.authorization?.roles || [];
  api.idToken.setCustomClaim('https://rag-system/groups', groups);
  api.accessToken.setCustomClaim('https://rag-system/groups', groups);
};
```

### 構成ファイル

```bash
cp demo-data/configs/mode-d-oidc-claims-only.json cdk.context.json
# REPLACE_* プレースホルダーを置換
```

### デプロイ

```bash
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
# CloudFront URL取得 → cdk.context.json更新 → 再デプロイ
```

### 検証

```bash
# CloudFront URL → 「Oktaでサインイン」→ Okta認証 → チャット画面
# DynamoDB: source="OIDC-Claims", oidcGroups=["group1","group2"] を確認
```

---

## モードE: SAML + OIDC ハイブリッド

既存AD SAML FederationとOIDC IdPを同時に有効化する構成。

### 構成ファイル

```bash
cp demo-data/configs/mode-e-saml-oidc-hybrid.json cdk.context.json
# REPLACE_* プレースホルダーを置換
```

### デプロイ

モードBとモードCの手順を組み合わせます。

### 検証

```bash
# サインイン画面に3つの認証方式が表示されることを確認:
#   1. 「ADでサインイン」ボタン
#   2. 「Auth0でサインイン」ボタン
#   3. メール/パスワードフォーム
```

### サインイン画面

「ADでサインイン」+「{providerName}でサインイン」+ メール/パスワードフォームが表示されます。

---

## 認証方式の選択ガイド

### 意思決定フローチャート

既存の認証基盤に基づいて、最適な認証モードを選択してください。

```
既存の認証基盤は？
│
├─ なし（新規構築）
│   └─ → モードA（メール/パスワード）で開始
│       後からモードC/Dに移行可能
│
├─ Windows Active Directory（オンプレミスまたはManaged AD）
│   ├─ IAM Identity Center設定済み？
│   │   ├─ Yes → モードB（SAML AD Federation）
│   │   └─ No  → AD FS / Entra ID経由でSAML設定 → モードB
│   │
│   └─ OIDC IdPも併用したい？
│       └─ Yes → モードE（SAML + OIDC ハイブリッド）
│
├─ OIDC IdP（Keycloak / Okta / Entra ID / Auth0）
│   ├─ LDAP/FreeIPAサーバーもある？
│   │   └─ Yes → モードC（OIDC + LDAP）
│   │       UID/GIDベースの権限フィルタリングが可能
│   │
│   └─ LDAPなし（IdPのグループクレームのみ）
│       └─ → モードD（OIDC Claims Only）
│           IdP側でグループクレーム設定が必要
│
└─ 複数のIdPを同時利用（Okta + Keycloak等）
    └─ → oidcProviders配列（Phase 2マルチOIDC）
        サインイン画面に各IdPのボタンが動的表示
```

### 権限マッピング戦略の選択

`permissionMappingStrategy` パラメータで、ドキュメントアクセス制御の方式を選択します。

| 戦略 | 設定値 | 条件 | ドキュメントメタデータ | 推奨環境 |
|------|--------|------|---------------------|---------|
| SIDのみ | `sid-only` | Windows AD環境 | `allowed_group_sids` | NTFS ACLでファイル権限を管理している環境 |
| UID/GIDのみ | `uid-gid` | UNIX/Linux環境 | `allowed_uids`, `allowed_gids` | POSIX権限でファイル権限を管理している環境 |
| ハイブリッド | `hybrid` | 混在環境 | SID + UID/GID両方 | AD + LDAP両方のユーザーが存在する環境 |

```
ファイルサーバーの権限管理方式は？
│
├─ NTFS ACL（Windows AD環境）
│   └─ permissionMappingStrategy: "sid-only"
│       .metadata.json に allowed_group_sids を設定
│
├─ POSIX権限（UNIX/Linux環境）
│   └─ permissionMappingStrategy: "uid-gid"
│       .metadata.json に allowed_uids, allowed_gids を設定
│
├─ 両方（ADユーザー + UNIXユーザーが混在）
│   └─ permissionMappingStrategy: "hybrid"
│       SIDマッチを優先、失敗時にUID/GIDフォールバック
│
└─ OIDCグループのみ（ファイルサーバー権限と無関係）
    └─ permissionMappingStrategy: 任意
        .metadata.json に allowed_oidc_groups を設定
        全戦略でOIDCグループフォールバックが動作
```

### 既存IdPとの統合チェックリスト

OIDC IdPを統合する場合、IdP側で以下の設定が必要です。

#### 共通（全OIDC IdP）

- [ ] RAGシステム用のクライアントアプリケーション（Regular Web Application）を作成
- [ ] `clientId` と `clientSecret` を取得
- [ ] `clientSecret` をAWS Secrets Managerに登録
- [ ] Allowed Callback URLs に `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse` を設定
- [ ] Allowed Logout URLs に `https://{cloudfront-url}/signin` を設定
- [ ] `issuerUrl` を `/.well-known/openid-configuration` の `issuer` フィールドから取得（末尾スラッシュに注意）
- [ ] `openid`, `email`, `profile` スコープが有効であることを確認

#### Auth0固有

- [ ] `issuerUrl` に末尾スラッシュを付ける（例: `https://xxx.auth0.com/`）
- [ ] グループクレームを使用する場合: Post Login Actionで名前空間付きカスタムクレームを設定
- [ ] テストユーザーを作成し、メールアドレスを設定

#### Keycloak固有

- [ ] `issuerUrl` に末尾スラッシュを付けない（例: `https://keycloak.example.com/realms/main`）
- [ ] Client Protocol: `openid-connect`、Access Type: `confidential`
- [ ] グループクレーム: Client Scopes → `groups` マッパーを追加
- [ ] LDAPフェデレーション設定済みの場合: Keycloakが自動的にLDAPグループをトークンに含める

#### Okta固有

- [ ] `issuerUrl` に末尾スラッシュを付けない（例: `https://company.okta.com`）
- [ ] Application Type: `Web Application`
- [ ] グループクレーム: Authorization Server → Claims → `groups` クレームを追加（Filter: Matches regex `.*`）

#### Entra ID（旧Azure AD）固有

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → Redirect URIs にCallback URLを追加
- [ ] Token Configuration → Optional Claims → `groups` を追加
- [ ] API Permissions: `openid`, `email`, `profile` を付与

---

## モード間の移行手順

### モードA → モードC/D（メール/パスワード → OIDC Federation）

最も一般的な移行パターンです。PoCをモードAで開始し、本番環境でOIDC Federationに移行します。

```bash
# Step 1: 現在のcdk.context.jsonをバックアップ
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: OIDC設定を追加
# cdk.context.json に以下を追加:
#   "oidcProviderConfig": { ... }
#   "cloudFrontUrl": "https://dxxxxxxxx.cloudfront.net"
#   "permissionMappingStrategy": "hybrid"  (既存SIDデータとの共存)

# Step 3: 再デプロイ（SecurityスタックとWebAppスタックのみ）
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: OIDC IdP側のCallback URLを設定

# Step 5: 検証
# - 既存のメール/パスワードユーザーは引き続きサインイン可能
# - 新規OIDCユーザーは「{providerName}でサインイン」ボタンからサインイン
# - 両方のユーザーが同じKB検索を利用可能
```

**注意点:**
- 既存のCognitoユーザー（メール/パスワード）は削除されません
- 既存のDynamoDB SIDデータも保持されます
- `permissionMappingStrategy: "hybrid"` にすることで、SIDユーザーとUID/GIDユーザーが共存できます
- Cognito User Poolの`email.mutable`が`false`の場合、User Poolの再作成が必要です（Securityスタックの`cdk destroy`→再デプロイ）

### モードB → モードE（SAML AD → SAML + OIDC ハイブリッド）

既存のAD SAML Federationに、追加のOIDC IdPを統合します。

```bash
# Step 1: cdk.context.json に oidcProviderConfig を追加
# enableAdFederation: true はそのまま維持

# Step 2: 再デプロイ
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 3: サインイン画面に「ADでサインイン」+「{providerName}でサインイン」の両方が表示されることを確認
```

**注意点:**
- 既存のADユーザーのSIDデータは保持されます
- OIDCユーザーは初回サインイン時に新規Cognitoユーザーとして作成されます
- ADユーザーとOIDCユーザーが同じメールアドレスの場合、Cognito上で別ユーザーとして管理されます

### 認証方式の削除（OIDC → メール/パスワードのみに戻す）

```bash
# Step 1: cdk.context.json から oidcProviderConfig を削除
# Step 2: 再デプロイ
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# 注意: OIDC IdPで作成されたCognitoユーザーは残りますが、
# サインイン画面からOIDCボタンが消えるため、OIDCサインインはできなくなります。
# メール/パスワードでのサインインは引き続き可能です。
```

---

## クリーンアップ

```bash
# 全リソース削除
bash demo-data/scripts/cleanup-all.sh

# または個別スタック削除
npx cdk destroy --all
```

---

## トラブルシューティング

| 症状 | モード | 原因 | 対処 |
|------|--------|------|------|
| CDKデプロイ失敗 | 全て | CDK CLIバージョン不一致 | `npm install aws-cdk@latest` で更新 |
| サインイン後に全拒否 | A | SIDデータ未登録 | `post-deploy-setup.sh` を実行 |
| 「ADでサインイン」非表示 | B,E | `enableAdFederation=false` | `cdk.context.json` を確認 |
| OIDC認証失敗 | C,D,E | `clientId`/`issuerUrl` 不正 | OIDC IdP設定を確認。`issuerUrl`はIdPの`/.well-known/openid-configuration`の`issuer`値と完全一致させる（Auth0は末尾`/`付き） |
| OIDC `invalid_request` | C,D,E | issuerUrl末尾スラッシュ不一致 | Auth0: `https://xxx.auth0.com/`（末尾`/`必須）、Keycloak: 末尾`/`なし |
| OIDC `Attribute cannot be updated` | C,D,E | email属性が`mutable: false` | User Pool再作成が必要（`mutable`は作成後変更不可） |
| LDAP接続失敗 | C | SG/VPC設定不正 | Lambda CloudWatch Logsを確認 |
| OAuthコールバックエラー | B,C,D,E | `cloudFrontUrl` 未設定 | 初回デプロイ後にURL取得→再デプロイ |
| ONTAP REST API接続不可 | C | fsxadminパスワード未設定 | `aws fsx update-file-system` で設定 |
| OpenLDAP memberOf未動作 | C | memberOfオーバーレイ未設定 | `setup-openldap.sh` が自動設定 |

---

## 関連ドキュメント

- [認証・ユーザー管理ガイド](../../docs/auth-and-user-management.md) — 認証モードの詳細設計
- [FSx ONTAP設定ガイド](ontap-setup-guide.md) — ONTAP REST API / Name-Mapping設定
- [検証シナリオ](demo-scenario.md) — SIDフィルタリング検証手順
