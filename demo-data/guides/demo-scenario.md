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
