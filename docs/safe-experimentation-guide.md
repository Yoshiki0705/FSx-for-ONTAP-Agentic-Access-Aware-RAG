# 安全な実験ガイド（Safe Experimentation Guide）

**🌐 Language:** **日本語** | [English](en/safe-experimentation-guide.md) | [한국어](ko/safe-experimentation-guide.md) | [简体中文](zh-CN/safe-experimentation-guide.md) | [繁體中文](zh-TW/safe-experimentation-guide.md) | [Français](fr/safe-experimentation-guide.md) | [Deutsch](de/safe-experimentation-guide.md) | [Español](es/safe-experimentation-guide.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: PoC 利用者、開発者、評価担当者向け

---

## 概要

本ドキュメントは、Permission-aware RAG システムを安全に試行錯誤するための範囲定義、禁止事項、ロールバック手順を提供します。「責任ある AI のポリシーやセキュリティの範囲内でトライアンドエラーできる環境」を明確にします。

---

## 安全に試せる範囲

### ✅ 推奨: デモデータのみで試す

| 操作 | リスク | 備考 |
|------|--------|------|
| デモデータでの検索テスト | なし | 同梱サンプルデータで動作確認 |
| ユーザー切替による権限確認 | なし | admin / user で検索結果の違いを確認 |
| Agent モードの試行 | なし | Agent Directory でのAgent作成・テスト |
| UI のカスタマイズ | なし | Next.js ソースの変更 |
| CDK パラメータの変更 | 低 | `cdk.context.json` の変更 → 再デプロイ |
| 新しいドキュメントの追加 | 低 | デモデータフォルダへの追加 |
| Guardrails ポリシーの調整 | 低 | `guardrailsConfig` の変更 |
| Smart Routing の ON/OFF | なし | サイドバーのトグル |
| モデル選択の変更 | 低 | コスト変動あり |
| 音声チャットの試行 | 低 | `enableVoiceChat=true` で有効化 |

### ⚠️ 注意: 実データ投入前チェックリスト

実際の業務データを投入する前に、以下を確認してください:

- [ ] **データ分類の実施**: 投入するデータの機密レベルを分類済み
- [ ] **PII の確認**: 個人情報が含まれる場合、マスキング or 承認済み
- [ ] **権限設計の確認**: `.metadata.json` の `allowed_group_sids` が正しく設定されている
- [ ] **監査ログの有効化**: CloudWatch Logs / CloudTrail が有効
- [ ] **アクセス制限の確認**: WAF / Geo 制限 / IP 制限が適切に設定されている
- [ ] **バックアップの確認**: FSx 自動バックアップが有効
- [ ] **利用者への通知**: PoC 参加者にデータ取り扱いルールを周知済み
- [ ] **データ削除手順の確認**: PoC 終了後のデータ削除手順を確認済み

### ❌ 禁止事項

| 禁止事項 | 理由 | 代替手段 |
|---------|------|---------|
| 本番 AD への直接接続（PoC 段階） | 本番環境への影響リスク | テスト AD / Cognito メール認証で代替 |
| PII 未分類データの投入 | 個人情報漏えいリスク | PII スキャン後に投入 |
| 監査ログ未設定での機密データ利用 | コンプライアンス違反 | 監査ログ有効化後に投入 |
| 暗号化なしでの機密データ保存 | データ漏えいリスク | `enableKmsEncryption=true` を設定 |
| 公開インターネットからのアクセス許可 | 不正アクセスリスク | IP 制限 / VPN 経由 |
| 本番アカウントでの PoC 実施 | 本番環境への影響 | サンドボックスアカウントを使用 |
| Guardrails 無効での機密データ利用 | 不適切な回答生成リスク | `enableGuardrails=true` を設定 |

---

## デモデータのみで試す手順

### Step 1: 最小構成でデプロイ

```bash
# 最小構成の cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# デプロイ
npx cdk deploy --all --require-approval never

# テストデータ + ユーザー作成
bash demo-data/scripts/post-deploy-setup.sh
```

### Step 2: 動作確認

```bash
# CloudFront URL を取得
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "アクセス URL: $URL"
```

### Step 3: 権限フィルタリングの確認

1. `admin@example.com` でサインイン → 全ドキュメントが検索可能
2. `user@example.com` でサインイン → 公開ドキュメントのみ検索可能
3. 同じ質問で異なる回答が返ることを確認

### Step 4: 評価

[evaluation.md](evaluation.md) の評価テンプレートを使用して PoC 評価を実施。

---

## 実データ投入手順（チェックリスト通過後）

### Step 1: データ準備

```bash
# 1. ドキュメントを分類
# 各ドキュメントに .metadata.json を作成
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. PII スキャン（推奨）
# Amazon Comprehend で PII 検出
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### Step 2: データ投入

```bash
# FSx ボリュームにファイルを配置（SMB 経由）
# または S3 バケットフォールバックパスを使用
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### Step 3: KB 同期

```bash
# KB 同期を実行
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 同期完了を待機
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### Step 4: 権限テスト

```bash
# 権限マトリクステストを実行
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## ロールバック / 環境削除手順

### 部分ロールバック（データのみ削除）

```bash
# 1. KB データソースの同期をクリア
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. S3 バケットのデータを削除
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. DynamoDB のユーザーデータを削除
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### 完全削除（全リソース）

```bash
# 1. S3 バケットを空にする（バージョニング有効の場合）
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy（全スタック削除）
npx cdk destroy --all --force

# 3. CDK Bootstrap リソースの削除（必要に応じて）
# ⚠️ 他のCDKプロジェクトがある場合は削除しないこと
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### コストクリーンアップ確認

```bash
# 残存リソースの確認
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# FSx ファイルシステムの確認（削除に時間がかかる）
aws fsx describe-file-systems --region ap-northeast-1

# OpenSearch Serverless コレクションの確認
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## トラブルシューティング

### よくある問題と対処

| 問題 | 原因 | 対処 |
|------|------|------|
| デプロイが 40 分以上かかる | FSx for ONTAP の作成に時間がかかる | 正常。FSx 作成は 20〜30 分 |
| 検索結果が 0 件 | KB 同期未完了 or データソース未設定 | `StartIngestionJob` の実行を確認 |
| 全ユーザーで同じ結果 | SID データ未登録 | DynamoDB `user-access` テーブルを確認 |
| Fail-Closed で全拒否 | DynamoDB 接続エラー or SID レコードなし | Lambda のログを確認 |
| Agent が動作しない | Agent 未作成 or PREPARED 状態でない | Bedrock コンソールで Agent ステータスを確認 |
| コストが想定以上 | OpenSearch Serverless の OCU | `vectorStoreType=s3vectors` に変更 |

### サポートリソース

| リソース | URL |
|---------|-----|
| GitHub Issues | リポジトリの Issues タブ |
| AWS ドキュメント（Bedrock） | https://docs.aws.amazon.com/bedrock/ |
| AWS ドキュメント（FSx ONTAP） | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [evaluation.md](evaluation.md) | RAG / Agent 評価メトリクス |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 本番化チェックリスト |
| [governance-and-audit.md](governance-and-audit.md) | ガバナンス・監査設計 |
| [permission-consistency.md](permission-consistency.md) | 権限変更時の整合性モデル |
