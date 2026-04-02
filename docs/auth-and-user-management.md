# 認証・ユーザー管理ガイド

**🌐 Language:** **日本語** | [English](en/auth-and-user-management.md)

**作成日**: 2026-04-02
**バージョン**: 3.3.0

---

## 概要

本システムは2つの認証モードを提供します。デプロイ時のCDKコンテキストパラメータで切り替えます。

| モード | CDKパラメータ | ユーザー作成 | SID登録 | 推奨用途 |
|--------|-------------|------------|---------|---------|
| メール/パスワード | `enableAdFederation=false`（デフォルト） | 管理者が手動作成 | 管理者が手動登録 | PoC・デモ |
| AD Federation | `enableAdFederation=true` | 初回サインイン時に自動作成 | サインイン時に自動登録 | 本番・エンタープライズ |

---

## モード1: メール/パスワード認証（デフォルト）

### 仕組み

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

Cognito User Poolに直接ユーザーを作成し、メールアドレスとパスワードでサインインします。

### 管理者の作業

**Step 1: Cognitoユーザー作成**

```bash
# post-deploy-setup.sh が自動実行、または手動で:
bash demo-data/scripts/create-demo-users.sh
```

**Step 2: DynamoDB SIDデータ登録**

```bash
# SIDデータを手動登録
bash demo-data/scripts/setup-user-access.sh
```

このスクリプトはDynamoDB `user-access` テーブルに以下を登録します:

| userId | userSID | groupSIDs | アクセス範囲 |
|--------|---------|-----------|------------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | 全ドキュメント |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | publicのみ |

### 制約

- ユーザー追加のたびに管理者がCognito + DynamoDBの両方を手動更新する必要がある
- ADのグループメンバーシップ変更が自動反映されない
- 大規模運用には不向き

---

## モード2: AD Federation（推奨: エンタープライズ）

### 仕組み

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

ADユーザーがSAML経由でサインインすると、以下が全て自動で行われます:

1. **Cognitoユーザー自動作成** — SAMLアサーションのメール属性からCognitoユーザーを自動生成
2. **SID自動取得** — AD Sync LambdaがADからユーザーSID + グループSIDを取得
3. **DynamoDB自動登録** — 取得したSIDデータを `user-access` テーブルに保存（24時間キャッシュ）

管理者の手動作業は不要です。

### AD Sync Lambda の動作

| AD方式 | SID取得方法 | 必要なインフラ |
|--------|-----------|--------------|
| Managed AD | LDAP or SSM経由PowerShell | AWS Managed AD + (オプション) Windows EC2 |
| Self-managed AD | SSM経由PowerShell | Windows EC2 (AD参加済み) |

**キャッシュ動作:**
- 初回サインイン: ADにクエリしてSIDを取得、DynamoDBに保存
- 2回目以降（24時間以内）: DynamoDBキャッシュを使用、ADクエリをスキップ
- 24時間経過後: 次回サインイン時にADから再取得

**エラー時の動作:**
- AD Sync Lambda失敗時もサインインはブロックされない（エラーログのみ）
- SIDデータがない場合、SIDフィルタリングはFail-Closed（全ドキュメント拒否）

### パターンA: AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**セットアップ手順:**
1. CDKデプロイ（Managed AD + SAML IdP + Cognito Domain作成）
2. SVM AD参加（`post-deploy-setup.sh` が自動実行）
3. IAM Identity CenterでCognito向けSAMLアプリケーション作成（または `samlMetadataUrl` で外部IdP指定）
4. Cognito Hosted UIの「ADでサインイン」ボタンからAD認証を実行

### パターンB: Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**セットアップ手順:**
1. Windows EC2をADに参加させ、SSM Agentを有効化
2. Entra IDでSAMLアプリケーションを作成し、メタデータURLを取得
3. CDKデプロイ
4. CloudFront UIの「ADでサインイン」ボタンからAD認証を実行

### CDKパラメータ一覧

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enableAdFederation` | boolean | `false` | SAMLフェデレーション有効化 |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Managed ADの管理者パスワード |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | AD参加済みWindows EC2インスタンスID |
| `samlMetadataUrl` | string | - | SAML IdPメタデータURL |
| `adDomainName` | string | - | ADドメイン名（例: demo.local） |
| `adDnsIps` | string | - | AD DNS IP（カンマ区切り） |
| `cloudFrontUrl` | string | - | OAuthコールバックURL |

---

## SIDフィルタリングとの連携

認証モードに関わらず、SIDフィルタリングの仕組みは同じです。

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs
  v
Bedrock KB Retrieve API -> Results + metadata (allowed_group_sids)
  |
  | userSIDs n documentSIDs
  v
Match -> ALLOW, No match -> DENY
```

**SIDデータの登録元の違い:**

| 認証モード | SIDデータの登録元 | `source` フィールド |
|-----------|-----------------|-------------------|
| メール/パスワード | `setup-user-access.sh`（手動） | `Demo` |
| AD Federation (Managed) | AD Sync Lambda（自動） | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda（自動） | `AD-Sync-self-managed` |

### DynamoDB user-access テーブルのスキーマ

```json
{
  "userId": "admin@example.com",
  "userSID": "S-1-5-21-...-500",
  "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
  "displayName": "Admin User",
  "email": "admin@example.com",
  "source": "AD-Sync-managed",
  "retrievedAt": 1705750800000,
  "ttl": 1705837200
}
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| サインイン後に全ドキュメントが拒否される | DynamoDBにSIDデータがない | AD Federation: AD Sync Lambdaのログを確認。手動: `setup-user-access.sh` を実行 |
| 「ADでサインイン」ボタンが表示されない | `enableAdFederation=false` | CDKパラメータを確認して再デプロイ |
| SAML認証失敗 | SAMLメタデータURL不正 | Managed AD: IAM Identity Center設定を確認。Self-managed: Entra IDメタデータURLを確認 |
| ADグループ変更が反映されない | SIDキャッシュ（24時間） | 24時間待つか、DynamoDBの該当レコードを削除して再サインイン |
| AD Sync Lambda タイムアウト | SSM経由のPowerShell実行が遅い | `SSM_TIMEOUT` 環境変数を増やす（デフォルト60秒） |

---

## 関連ドキュメント

- [README.md — AD SAMLフェデレーション](../README.md#ad-samlフェデレーションオプション) — CDKデプロイ手順
- [docs/implementation-overview.md — セクション3: IAM認証](implementation-overview.md#3-iam認証--lambda-function-url-iam-auth--cloudfront-oac) — インフラ層の認証設計
- [docs/SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — SIDフィルタリングの詳細設計
- [demo-data/guides/ontap-setup-guide.md](../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD連携設定
