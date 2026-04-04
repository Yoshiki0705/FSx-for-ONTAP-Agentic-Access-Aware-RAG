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

# ブラウザ検証:
# CloudFront URL → 「Auth0でサインイン」→ Auth0認証 → チャット画面
# DynamoDB: uid, gid, source="OIDC-LDAP" を確認
```

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
| OIDC認証失敗 | C,D,E | `clientId`/`issuerUrl` 不正 | OIDC IdP設定を確認 |
| LDAP接続失敗 | C | SG/VPC設定不正 | Lambda CloudWatch Logsを確認 |
| OAuthコールバックエラー | B,C,D,E | `cloudFrontUrl` 未設定 | 初回デプロイ後にURL取得→再デプロイ |
| ONTAP REST API接続不可 | C | fsxadminパスワード未設定 | `aws fsx update-file-system` で設定 |
| OpenLDAP memberOf未動作 | C | memberOfオーバーレイ未設定 | `setup-openldap.sh` が自動設定 |

---

## 関連ドキュメント

- [認証・ユーザー管理ガイド](../../docs/auth-and-user-management.md) — 認証モードの詳細設計
- [FSx ONTAP設定ガイド](ontap-setup-guide.md) — ONTAP REST API / Name-Mapping設定
- [検証シナリオ](demo-scenario.md) — SIDフィルタリング検証手順
