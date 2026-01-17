# Amazon Bedrock AgentCore ステージング環境テスト実施ガイド

**作成日**: 2026-01-05  
**バージョン**: v1.0.0  
**対象システム**: Permission-aware RAG System with Amazon FSx for NetApp ONTAP  
**対象環境**: ステージング環境（ap-northeast-1）

---

## 📋 目次

1. [概要](#概要)
2. [事前準備](#事前準備)
3. [ステージング環境構築](#ステージング環境構築)
4. [テスト実施](#テスト実施)
5. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### 目的

このガイドは、Amazon Bedrock AgentCoreの9つの機能コンポーネントをステージング環境でテストするための実施手順を提供します。

### 前提条件

- AWS CLIがインストールされている
- Node.js v20.x以上がインストールされている
- AWS CDKがインストールされている
- AWS認証情報が設定されている
- 適切なIAM権限がある

### 必要な権限

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "dynamodb:*",
        "s3:*",
        "iam:*",
        "logs:*",
        "xray:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 事前準備

### Step 1: リポジトリクローン

```bash
# リポジトリクローン
git clone https://github.com/your-org/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK

# mainブランチに切り替え
git checkout main
git pull origin main
```

### Step 2: 依存関係インストール

```bash
# Node.js依存関係インストール
npm install

# TypeScriptビルド
npm run build
```

### Step 3: AWS認証情報設定

```bash
# AWS認証情報設定
export AWS_PROFILE=staging
export AWS_REGION=ap-northeast-1

# 認証情報確認
aws sts get-caller-identity
```

### Step 4: 設定ファイル確認

```bash
# ステージング環境設定ファイル確認
cat cdk.context.json.staging

# 必要に応じて編集
# - vpcId
# - availabilityZones
# - sslCertificateArn
# - snsTopicArn
# など
```

---

## ステージング環境構築

### 自動デプロイ（推奨）

```bash
# デプロイスクリプト実行
./development/scripts/deployment/deploy-staging.sh
```

このスクリプトは以下を自動実行します：
1. 前提条件チェック
2. 依存関係インストール
3. TypeScriptビルド
4. CDK Bootstrap
5. CDK Synth
6. CDK Deploy
7. デプロイ後検証
8. Lambda関数確認
9. DynamoDBテーブル確認

### 手動デプロイ

#### Step 1: CDK Bootstrap

```bash
# Bootstrap実行（初回のみ）
cdk bootstrap \
  --context "@aws-cdk/core:newStyleStackSynthesis=true" \
  --region ap-northeast-1
```

#### Step 2: CDK Synth

```bash
# CloudFormationテンプレート生成
cdk synth \
  --context-file cdk.context.json.staging \
  --region ap-northeast-1 \
  --all
```

#### Step 3: CDK Deploy

```bash
# 全スタックデプロイ
cdk deploy \
  --context-file cdk.context.json.staging \
  --region ap-northeast-1 \
  --all \
  --require-approval never
```

**注意**: デプロイには10-20分かかる場合があります。

#### Step 4: デプロイ確認

```bash
# スタック状態確認
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --region ap-northeast-1 \
  --query 'StackSummaries[?contains(StackName, `staging`)].{Name:StackName,Status:StackStatus}'

# Lambda関数確認
aws lambda list-functions \
  --region ap-northeast-1 \
  --query 'Functions[?contains(FunctionName, `staging`)].FunctionName'

# DynamoDBテーブル確認
aws dynamodb list-tables \
  --region ap-northeast-1 \
  --query 'TableNames[?contains(@, `staging`)]'
```

---

## テスト実施

### 自動テスト実行（推奨）

#### 全Phaseテスト実行

```bash
# 全Phaseテスト実行
./development/scripts/testing/run-staging-tests.sh all
```

#### Phase別テスト実行

```bash
# Phase 1のみ実行
./development/scripts/testing/run-staging-tests.sh phase1

# Phase 2のみ実行
./development/scripts/testing/run-staging-tests.sh phase2

# Phase 3のみ実行
./development/scripts/testing/run-staging-tests.sh phase3
```

### 手動テスト実行

#### Phase 1: コア機能テスト

**RT-001: Runtime機能テスト**

```bash
# Lambda関数呼び出し
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Runtime-Function \
  --payload '{"agentId":"test-agent-001","sessionId":"test-session-001","message":"テストメッセージ"}' \
  --region ap-northeast-1 \
  response.json

# レスポンス確認
cat response.json | jq .

# ログ確認
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-staging-Runtime-Function \
  --follow \
  --region ap-northeast-1
```

**MEM-001: Memory機能テスト**

```bash
# イベント書き込み
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Memory-Function \
  --payload '{"action":"writeEvent","agentId":"test-agent-001","sessionId":"test-session-001","event":{"type":"user_message","content":"テストメッセージ"}}' \
  --region ap-northeast-1 \
  response.json

# 短期メモリ取得
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Memory-Function \
  --payload '{"action":"getLastKTurns","agentId":"test-agent-001","sessionId":"test-session-001","k":5}' \
  --region ap-northeast-1 \
  response.json

# 長期メモリ検索
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Memory-Function \
  --payload '{"action":"searchLongTermMemories","agentId":"test-agent-001","query":"テストメッセージ","limit":10}' \
  --region ap-northeast-1 \
  response.json
```

**ID-001: Identity機能テスト**

```bash
# エージェントID作成
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Identity-Function \
  --payload '{"action":"create","agentId":"test-agent-001","attributes":{"name":"Test Agent","department":"Engineering"}}' \
  --region ap-northeast-1 \
  response.json

# ロール割り当て
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Identity-Function \
  --payload '{"action":"assignRole","agentId":"test-agent-001","role":"admin"}' \
  --region ap-northeast-1 \
  response.json

# 権限チェック
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Identity-Function \
  --payload '{"action":"checkPermission","agentId":"test-agent-001","resource":"s3://test-bucket/test-file.txt","action":"read"}' \
  --region ap-northeast-1 \
  response.json
```

**OBS-001: Observability機能テスト**

```bash
# X-Rayトレース確認
aws xray get-trace-summaries \
  --start-time $(date -u -d '5 minutes ago' +%s) \
  --end-time $(date -u +%s) \
  --region ap-northeast-1

# CloudWatchメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AgentCore \
  --metric-name InvocationCount \
  --start-time $(date -u -d '5 minutes ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1

# CloudWatch Dashboard確認
aws cloudwatch get-dashboard \
  --dashboard-name AgentCore-Staging-Dashboard \
  --region ap-northeast-1
```

#### Phase 2: 拡張機能テスト

**GW-001: Gateway機能テスト**

```bash
# REST API変換テスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Gateway-Function \
  --payload '{"action":"convertRestApi","apiUrl":"https://api.example.com/v1/users","method":"GET"}' \
  --region ap-northeast-1 \
  response.json
```

**BR-001: Browser機能テスト**

```bash
# スクリーンショット撮影テスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Browser-Function \
  --payload '{"action":"screenshot","url":"https://example.com","viewport":{"width":1920,"height":1080}}' \
  --region ap-northeast-1 \
  response.json
```

**CI-001: CodeInterpreter機能テスト**

```bash
# セッション作成テスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-CodeInterpreter-Function \
  --payload '{"action":"createSession","sessionId":"test-session-001","timeout":300}' \
  --region ap-northeast-1 \
  response.json
```

**POL-001: Policy機能テスト**

```bash
# 自然言語ポリシー解析テスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Policy-Function \
  --payload '{"action":"parseNaturalLanguage","text":"開発者は全てのS3バケットを読み取ることができる","language":"ja"}' \
  --region ap-northeast-1 \
  response.json
```

**EVAL-001: Evaluations機能テスト**

```bash
# 品質メトリクス評価テスト
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Evaluations-Function \
  --payload '{"action":"evaluateQuality","agentId":"test-agent-001","sessionId":"test-session-001","metrics":{"accuracy":0.95,"latency":500}}' \
  --region ap-northeast-1 \
  response.json
```

#### Phase 3: 統合テスト

**INT-001: Runtime → Gateway → Memory連携テスト**

```bash
# Runtime呼び出し（Gateway、Memoryが自動連携）
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-staging-Runtime-Function \
  --payload '{"agentId":"test-agent-001","sessionId":"test-session-001","message":"外部APIを呼び出してください"}' \
  --region ap-northeast-1 \
  response.json

# DynamoDBテーブル確認（Memory保存確認）
aws dynamodb scan \
  --table-name TokyoRegion-permission-aware-rag-staging-Memory-Table \
  --region ap-northeast-1 \
  --filter-expression "agentId = :agentId AND sessionId = :sessionId" \
  --expression-attribute-values '{":agentId":{"S":"test-agent-001"},":sessionId":{"S":"test-session-001"}}'
```

### テスト結果確認

```bash
# テスト結果ディレクトリ確認
ls -la test-results/staging/

# 最新のテスト結果確認
cat test-results/staging/$(ls -t test-results/staging/ | head -1)/test-results.json | jq .

# 成功率計算
cat test-results/staging/$(ls -t test-results/staging/ | head -1)/test-results.json | \
  jq -s '[.[] | select(.status == "PASS")] | length'
```

---

## トラブルシューティング

### 問題1: CDK Deploy失敗

**症状**: `cdk deploy`が失敗する

**原因**:
- IAM権限不足
- リソース制限超過
- 設定ファイルエラー

**対処法**:

```bash
# エラーログ確認
cdk deploy --verbose

# IAM権限確認
aws iam get-user

# リソース制限確認
aws service-quotas list-service-quotas \
  --service-code lambda \
  --region ap-northeast-1
```

### 問題2: Lambda関数呼び出し失敗

**症状**: Lambda関数が呼び出せない

**原因**:
- 関数が存在しない
- タイムアウト
- メモリ不足

**対処法**:

```bash
# Lambda関数存在確認
aws lambda get-function \
  --function-name TokyoRegion-permission-aware-rag-staging-Runtime-Function \
  --region ap-northeast-1

# ログ確認
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-staging-Runtime-Function \
  --region ap-northeast-1

# 設定確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-staging-Runtime-Function \
  --region ap-northeast-1
```

### 問題3: テストスクリプト実行失敗

**症状**: `run-staging-tests.sh`が失敗する

**原因**:
- AWS CLI未インストール
- jq未インストール
- bc未インストール

**対処法**:

```bash
# AWS CLIインストール確認
which aws

# jqインストール確認
which jq

# bcインストール確認
which bc

# macOSの場合
brew install jq bc

# Linuxの場合
sudo apt-get install jq bc
```

### 問題4: DynamoDBテーブルが見つからない

**症状**: DynamoDBテーブルが存在しない

**原因**:
- デプロイ未完了
- 設定で無効化されている

**対処法**:

```bash
# テーブル一覧確認
aws dynamodb list-tables \
  --region ap-northeast-1

# 設定ファイル確認
cat cdk.context.json.staging | jq '.agentCore'

# 再デプロイ
cdk deploy --context-file cdk.context.json.staging --all
```

---

## 参考資料

- [ステージング環境テスト計画書](./agentcore-staging-test-plan.md)
- [AgentCoreデプロイガイド](./agentcore-deployment-guide.md)
- [本番環境デプロイ計画書](./agentcore-production-deployment-plan.md)

---

**ドキュメント終了**
