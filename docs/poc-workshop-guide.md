# PoC ワークショップガイド（90 分）

**🌐 Language:** **日本語** | [English](en/poc-workshop-guide.md) | [한국어](ko/poc-workshop-guide.md) | [简体中文](zh-CN/poc-workshop-guide.md) | [繁體中文](zh-TW/poc-workshop-guide.md) | [Français](fr/poc-workshop-guide.md) | [Deutsch](de/poc-workshop-guide.md) | [Español](es/poc-workshop-guide.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: ソリューションアーキテクト、パートナーエンジニア、顧客クラウドチーム

---

## 概要

本ワークショップでは、Permission-aware Agentic RAG システムを 90 分でデプロイし、
権限付き検索の動作を体験します。

---

## 前提条件

| 項目 | 要件 |
|------|------|
| AWS アカウント | AdministratorAccess 相当の権限 |
| AWS CLI | v2 設定済み（`aws sts get-caller-identity` が成功すること） |
| Node.js | 22 以上 |
| Docker | 起動済み（`docker info` が成功すること） |
| CDK Bootstrap | 未実施の場合はワークショップ内で実施 |
| Bedrock モデルアクセス | Claude Haiku / Sonnet、Titan Embed v2 が有効 |

---

## アジェンダ

| 時間 | セクション | 内容 |
|------|-----------|------|
| 0:00–0:10 | 0. イントロダクション | アーキテクチャ概要、ユースケース説明 |
| 0:10–0:40 | 1. 環境デプロイ | クローン、依存関係、Bootstrap、デプロイ |
| 0:40–0:55 | 2. デモデータ投入 | ユーザー作成、テストドキュメント配置 |
| 0:55–1:15 | 3. 権限付き RAG テスト | 異なるユーザーでの検索、結果比較 |
| 1:15–1:25 | 4. エンタープライズガイド確認 | 本番化チェックリスト、評価テンプレート |
| 1:25–1:30 | 5. クリーンアップ | リソース削除、コスト確認 |

---

## 0. イントロダクション（10 分）

### このシステムが解決する課題

```
従来の RAG:
  企業ファイル → AI に全文書を渡す → 誰でも全情報にアクセス可能
  → 権限境界が消失 → 機密漏えいリスク

Permission-aware RAG:
  企業ファイル → 既存 ACL を維持 → ユーザーごとに見える文書が異なる
  → 権限を守りながら AI 活用 → セキュリティと利便性の両立
```

### アーキテクチャ（ホワイトボード用）

```
ユーザー → CloudFront → Lambda (Next.js)
                              ↓
                    Bedrock KB Retrieve API
                              ↓
                    SID フィルタリング（アプリ側）
                              ↓
                    許可ドキュメントのみで回答生成
```

---

## 1. 環境デプロイ（30 分）

### Step 1.1: リポジトリクローン

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2: CDK Bootstrap

```bash
# メインリージョン
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# WAF 用（CloudFront は us-east-1 必須）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3: 設定ファイル作成

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **注意**: `allowedCountries` を参加者の国に合わせて変更してください。

### Step 1.4: Docker イメージ準備 & デプロイ

```bash
# Docker イメージビルド
bash demo-data/scripts/pre-deploy-setup.sh

# デプロイ（約 30 分）
npx cdk deploy --all --require-approval never
```

> デプロイ中に次のセクションの説明を行うと時間を有効活用できます。

---

## 2. デモデータ投入（15 分）

### Step 2.1: テストユーザー & データ作成

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

このスクリプトは以下を実行します:
- Cognito テストユーザー作成（admin@example.com, user@example.com）
- DynamoDB に SID データ登録
- S3 にテストドキュメント + `.metadata.json` アップロード
- Bedrock KB データソース同期

### Step 2.2: アクセス URL 取得

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. 権限付き RAG テスト（20 分）

### テスト 1: 管理者ユーザーでサインイン

1. CloudFront URL にアクセス
2. `admin@example.com` / パスワード（post-deploy-setup.sh の出力を確認）でサインイン
3. 「会社の売上について教えてください」と質問
4. **期待結果**: 150 億円の売上情報を含む回答（機密ドキュメント参照）

### テスト 2: 一般ユーザーでサインイン

1. ログアウト
2. `user@example.com` でサインイン
3. 同じ質問「会社の売上について教えてください」
4. **期待結果**: 売上情報なし（公開ドキュメントのみ参照）

### テスト 3: Agent モード

1. ヘッダーのモードトグルで「Agent」に切替
2. 「製品カタログの内容を要約してください」と質問
3. **期待結果**: Agent が KB 検索ツールを使用し、権限範囲内で回答

### 確認ポイント

- [ ] 同じ質問で異なる回答が返ること
- [ ] Citation にアクセスレベルバッジが表示されること
- [ ] 一般ユーザーに機密ドキュメントの Citation が表示されないこと

---

## 3.5 Wow Moment: 権限変更のリアルタイム反映（5 分）

### デモ: DynamoDB の SID 変更で検索結果が即座に変わる

1. `user@example.com` でサインイン
2. 「プロジェクトのロードマップを教えてください」と質問
3. **期待結果**: アクセス拒否（restricted ドキュメントは表示されない）

4. **権限を追加**（別ターミナルで実行）:
```bash
# user に Engineering グループを追加
aws dynamodb update-item \
  --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId": {"S": "user@example.com"}}' \
  --update-expression "SET groupSIDs = list_append(groupSIDs, :newSid)" \
  --expression-attribute-values '{":newSid": {"L": [{"S": "S-1-5-21-0000000000-0000000000-0000000000-1100"}]}}' \
  --region ap-northeast-1
```

5. 5 分待機（キャッシュ TTL 期限切れ）、または権限キャッシュを手動クリア
6. 同じ質問を再度入力
7. **期待結果**: Engineering ドキュメント（ロードマップ）が表示される！

> **ポイント**: ファイルサーバーの権限変更が AI の検索結果にリアルタイムで反映されることを体験できます。

---

## 3.6 オプション: Transfer Family SFTP インジェスション

> **前提**: `enableTransferFamily=true` でデプロイ済みの場合のみ実施可能

### デモ: SFTP でファイルをアップロードし、数分後に検索可能になる

```bash
# 1. SFTP でファイルをアップロード
sftp -i partner-key.pem partner-a@${TRANSFER_FAMILY_ENDPOINT}
sftp> put new-document.md /uploads/partner-a/
sftp> exit

# 2. 数分待機（KB Auto-Sync がファイル変更を検出）

# 3. チャットで「new-document の内容を教えてください」と質問
# → アップロードしたドキュメントが検索結果に表示される
```

> **ポイント**: パートナー企業が SFTP でドキュメントを投入するだけで、権限メタデータが自動生成され、AI 検索に反映されます。Web UI を使えない外部組織との連携に最適です。

---

## 4. エンタープライズガイド確認（10 分）

以下のドキュメントを参加者に紹介:

| ドキュメント | 確認ポイント |
|-------------|-------------|
| [本番化チェックリスト](production-readiness-checklist.md) | Demo/PoC/Production の成熟度レベル |
| [評価テンプレート](evaluation.md) | PoC 評価レポートの 1 枚サマリー |
| [安全な実験ガイド](safe-experimentation-guide.md) | 実データ投入前のチェックリスト |
| [脅威モデル](threat-model.md) | 10 の脅威カテゴリと対策マッピング |

---

## 5. クリーンアップ（5 分）

```bash
# 全リソース削除
npx cdk destroy --all --force
```

> **注意**: FSx for ONTAP の削除に 10〜15 分かかります。コマンド完了後も AWS コンソールで削除状況を確認してください。

### コスト確認

```bash
# 残存リソースの確認
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## 成功基準

| 基準 | 確認方法 |
|------|---------|
| 環境が正常にデプロイされた | CloudFront URL にアクセス可能 |
| 異なるユーザーで異なる回答が返る | テスト 1 と テスト 2 の比較 |
| 権限拒否シナリオが Fail-Closed で動作 | 一般ユーザーに機密情報が表示されない |
| 監査ログが生成される | CloudWatch Logs に検索ログが記録 |
| クリーンアップが完了 | 残存リソースなし |

---

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| CDK Bootstrap 失敗 | AWS CLI の認証情報を確認。`aws sts get-caller-identity` が成功するか |
| Docker ビルド失敗 | Docker が起動しているか確認。`docker info` |
| デプロイが 40 分以上 | FSx for ONTAP 作成は 20〜30 分かかるため正常 |
| サインインできない | Cognito ユーザーが作成されているか確認。`post-deploy-setup.sh` の出力を確認 |
| 検索結果が 0 件 | KB 同期が完了しているか確認。数分待って再試行 |

---

## 次のステップ

ワークショップ完了後、以下を検討:

1. **実データでの PoC**: [安全な実験ガイド](safe-experimentation-guide.md) に従って実データを投入
2. **評価**: [評価テンプレート](evaluation.md) で PoC 結果を定量評価
3. **本番化検討**: [本番化チェックリスト](production-readiness-checklist.md) で必要な対策を確認

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [README.md](../README.md) | システム全体像、デプロイ手順 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全な実験ガイド |
| [evaluation.md](evaluation.md) | RAG / Agent 評価メトリクス |
| [threat-model.md](threat-model.md) | 脅威モデル |
