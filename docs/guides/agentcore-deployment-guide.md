# Amazon Bedrock AgentCore デプロイメントガイド

**最終更新**: 2026-01-05  
**バージョン**: v2.5.0

---

## 📋 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [デプロイメント準備](#デプロイメント準備)
4. [設定ファイルの選択](#設定ファイルの選択)
5. [デプロイメント実行](#デプロイメント実行)
6. [デプロイ後の確認](#デプロイ後の確認)
7. [トラブルシューティング](#トラブルシューティング)
8. [ロールバック手順](#ロールバック手順)

---

## 概要

このガイドでは、Amazon Bedrock AgentCoreの9つのConstructsを本番環境にデプロイする手順を説明します。

### AgentCore Constructs

AgentCoreは以下の9つのConstructsで構成されています：

| Construct | スタック | 機能 |
|-----------|---------|------|
| Runtime | WebAppStack | イベント駆動実行 |
| Gateway | WebAppStack | API/Lambda/MCP統合 |
| Memory | WebAppStack | 長期記憶（フルマネージド） |
| Browser | WebAppStack | Web自動化 |
| CodeInterpreter | WebAppStack | コード実行 |
| Identity | SecurityStack | 認証・認可 |
| Policy | SecurityStack | ポリシー管理 |
| Observability | OperationsStack | 監視・トレーシング |
| Evaluations | OperationsStack | 評価・テスト |

### デプロイメント戦略

全てのAgentCore機能は**オプション**として実装されており、`cdk.context.json`で個別に有効化/無効化できます。

---

## 前提条件

### 必須要件

- ✅ AWS CDK v2.x インストール済み
- ✅ Node.js 18.x以上
- ✅ AWS CLI設定済み
- ✅ 適切なIAM権限
- ✅ TypeScriptコンパイル成功（0 errors）
- ✅ 全テスト合格（29/29テスト）

### 推奨要件

- ✅ EC2デプロイ環境（東京リージョン）
- ✅ Git同期済み
- ✅ バックアップ作成済み

### IAM権限

デプロイに必要な最小限のIAM権限：

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
        "events:*",
        "bedrock:*",
        "kms:*",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## デプロイメント準備

### 1. 環境確認

```bash
# Node.jsバージョン確認
node --version  # v18.x以上

# AWS CLIバージョン確認
aws --version

# CDKバージョン確認
npx cdk --version  # 2.x以上

# AWS認証情報確認
aws sts get-caller-identity
```

### 2. 依存関係のインストール

```bash
# プロジェクトルートで実行
npm install

# TypeScriptコンパイル
npm run build
```

### 3. テスト実行

```bash
# AgentCore設定バリデーションテスト
npm test -- tests/unit/config/agentcore-config-validator.test.ts

# 設定例ファイルテスト
npm test -- tests/unit/config/agentcore-config-examples.test.ts

# 全テスト実行
npm test
```

**期待される結果**:
- ✅ 29/29テスト合格
- ✅ TypeScriptエラー0件

### 4. CDK Bootstrap（初回のみ）

```bash
# 東京リージョンでBootstrap
npx cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1

# 複数リージョンの場合
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1
npx cdk bootstrap aws://ACCOUNT-ID/eu-west-1
```

---

## 設定ファイルの選択

AgentCoreのデプロイメントには、3つの設定例ファイルが用意されています。

### 1. 最小限の設定（開発環境向け）

**ファイル**: `cdk.context.json.minimal`

**特徴**:
- Runtime + Memory のみ有効化
- 最小限のコスト
- 開発・テスト環境に最適

**使用方法**:
```bash
cp cdk.context.json.minimal cdk.context.json
```

### 2. 完全な設定（検証環境向け）

**ファイル**: `cdk.context.json.example`

**特徴**:
- 全9機能を有効化
- 全機能のテストに最適
- コストが高い

**使用方法**:
```bash
cp cdk.context.json.example cdk.context.json
```

### 3. 本番推奨設定（本番環境向け）

**ファイル**: `cdk.context.json.production`

**特徴**:
- 本番環境に推奨される設定
- コストとパフォーマンスのバランス
- Provisioned Concurrency有効化

**使用方法**:
```bash
cp cdk.context.json.production cdk.context.json
```

### カスタム設定

必要に応じて、`cdk.context.json`を直接編集してカスタマイズできます：

```json
{
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "timeout": 300,
        "memorySize": 1024,
        "provisionedConcurrentExecutions": 2
      }
    },
    "gateway": {
      "enabled": false
    },
    "memory": {
      "enabled": true
    }
  }
}
```

---

## デプロイメント実行

### デプロイメント前チェックリスト

- [ ] 設定ファイル選択完了
- [ ] TypeScriptコンパイル成功
- [ ] テスト全合格
- [ ] AWS認証情報確認
- [ ] バックアップ作成

### 1. CDK Synth（テンプレート生成）

```bash
# 全スタックのテンプレート生成
npx cdk synth -c imageTag=agentcore-20260105-000000

# 特定のスタックのみ
npx cdk synth TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=agentcore-20260105-000000
```

**確認事項**:
- ✅ エラーなくテンプレート生成完了
- ✅ `cdk.out/`ディレクトリにテンプレート作成
- ✅ AgentCore Outputsが含まれている

### 2. CDK Diff（変更確認）

```bash
# 変更内容の確認
npx cdk diff --all -c imageTag=agentcore-20260105-000000
```

**確認事項**:
- ✅ 追加されるリソースの確認
- ✅ 削除されるリソースがないことを確認
- ✅ 変更されるリソースの確認

### 3. CDK Deploy（デプロイ実行）

#### 全スタックデプロイ

```bash
# 全スタックを一括デプロイ
npx cdk deploy --all \
  -c imageTag=agentcore-20260105-000000 \
  --require-approval never
```

#### 段階的デプロイ（推奨）

```bash
# Step 1: NetworkingStack
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Networking \
  -c imageTag=agentcore-20260105-000000

# Step 2: SecurityStack（AgentCore Identity, Policy含む）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Security \
  -c imageTag=agentcore-20260105-000000

# Step 3: DataStack
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data \
  -c imageTag=agentcore-20260105-000000

# Step 4: EmbeddingStack
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Embedding \
  -c imageTag=agentcore-20260105-000000

# Step 5: WebAppStack（AgentCore Runtime, Gateway, Memory, Browser, CodeInterpreter含む）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=agentcore-20260105-000000

# Step 6: OperationsStack（AgentCore Observability, Evaluations含む）
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Operations \
  -c imageTag=agentcore-20260105-000000
```

### 4. デプロイメント時間

| スタック | 推定時間 | AgentCore機能 |
|---------|---------|--------------|
| NetworkingStack | 5-10分 | なし |
| SecurityStack | 10-15分 | Identity, Policy |
| DataStack | 15-20分 | なし |
| EmbeddingStack | 10-15分 | なし |
| WebAppStack | 20-30分 | Runtime, Gateway, Memory, Browser, CodeInterpreter |
| OperationsStack | 10-15分 | Observability, Evaluations |
| **合計** | **70-105分** | **9機能** |

---

## デプロイ後の確認

### 1. CloudFormation Outputs確認

```bash
# WebAppStack Outputs
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs' \
  --region ap-northeast-1

# SecurityStack Outputs
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Security \
  --query 'Stacks[0].Outputs' \
  --region ap-northeast-1

# OperationsStack Outputs
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Operations \
  --query 'Stacks[0].Outputs' \
  --region ap-northeast-1
```

### 2. AgentCore Outputs確認

#### WebAppStack（5機能）

```bash
# Runtime Lambda Function ARN
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreRuntimeFunctionArn`].OutputValue' \
  --output text

# Gateway REST API Converter ARN
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayRestApiConverterArn`].OutputValue' \
  --output text

# Memory Resource ARN
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreMemoryResourceArn`].OutputValue' \
  --output text

# Browser Function ARN
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreBrowserFunctionArn`].OutputValue' \
  --output text

# CodeInterpreter Function ARN
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreCodeInterpreterFunctionArn`].OutputValue' \
  --output text
```

#### SecurityStack（2機能）

```bash
# Identity Table Name
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Security \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreIdentityTableName`].OutputValue' \
  --output text

# Policy Function ARN
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Security \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCorePolicyFunctionArn`].OutputValue' \
  --output text
```

#### OperationsStack（2機能）

```bash
# Observability Dashboard Name
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Operations \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreObservabilityDashboardName`].OutputValue' \
  --output text

# Evaluations Results Table Name
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Operations \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreEvaluationsResultsTableName`].OutputValue' \
  --output text
```

### 3. リソース動作確認

#### Runtime Lambda関数テスト

```bash
# Runtime Lambda関数を呼び出し
aws lambda invoke \
  --function-name $(aws cloudformation describe-stacks \
    --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
    --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreRuntimeFunctionArn`].OutputValue' \
    --output text | cut -d':' -f7) \
  --payload '{"test": true}' \
  /tmp/runtime-response.json

# レスポンス確認
cat /tmp/runtime-response.json
```

#### Identity DynamoDBテーブル確認

```bash
# テーブル存在確認
aws dynamodb describe-table \
  --table-name $(aws cloudformation describe-stacks \
    --stack-name TokyoRegion-permission-aware-rag-prod-Security \
    --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreIdentityTableName`].OutputValue' \
    --output text)
```

#### Observability Dashboard確認

```bash
# ダッシュボード存在確認
aws cloudwatch get-dashboard \
  --dashboard-name $(aws cloudformation describe-stacks \
    --stack-name TokyoRegion-permission-aware-rag-prod-Operations \
    --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreObservabilityDashboardName`].OutputValue' \
    --output text)
```

### 4. ヘルスチェック

```bash
# 全AgentCore機能のヘルスチェック
./development/scripts/deployment/agentcore-health-check.sh
```

---

## トラブルシューティング

### 問題1: CDK Synthが失敗する

**症状**:
```
Error: You are not authorized to perform this operation
```

**原因**: IAM権限不足

**解決策**:
1. IAM権限を確認
2. `ec2:DescribeAvailabilityZones`権限を追加
3. 再度CDK Synthを実行

### 問題2: Lambda関数が作成されない

**症状**: AgentCore Lambda関数のOutputsが空

**原因**: `enabled: false`になっている

**解決策**:
1. `cdk.context.json`を確認
2. 該当機能の`enabled`を`true`に変更
3. 再デプロイ

### 問題3: DynamoDBテーブルが作成されない

**症状**: Identity/Policy/EvaluationsテーブルがOutputsに表示されない

**原因**: 該当機能が無効化されている

**解決策**:
1. `cdk.context.json`で`identity.enabled`、`policy.enabled`、`evaluations.enabled`を確認
2. `true`に変更
3. 再デプロイ

### 問題4: Memory機能が動作しない

**症状**: Memory Resource ARNが取得できない

**原因**: Amazon Bedrock Memoryがリージョンで利用不可

**解決策**:
1. サポートされているリージョンを確認（us-east-1, us-west-2等）
2. リージョンを変更
3. 再デプロイ

### 問題5: デプロイが途中で失敗する

**症状**: CloudFormationスタックが`ROLLBACK_IN_PROGRESS`状態

**原因**: リソース作成エラー

**解決策**:
1. CloudFormationコンソールでエラーを確認
2. エラーの原因を特定
3. 設定を修正
4. スタックを削除
5. 再デプロイ

---

## ロールバック手順

### 1. 緊急ロールバック

```bash
# 全スタックを削除
npx cdk destroy --all -c imageTag=agentcore-20260105-000000

# 特定のスタックのみ削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=agentcore-20260105-000000
```

### 2. 段階的ロールバック

```bash
# Step 1: OperationsStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Operations

# Step 2: WebAppStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-WebApp

# Step 3: EmbeddingStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Embedding

# Step 4: DataStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Data

# Step 5: SecurityStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Security

# Step 6: NetworkingStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Networking
```

### 3. 部分的ロールバック（AgentCore機能のみ無効化）

```bash
# cdk.context.jsonで該当機能を無効化
# 例: Runtime機能を無効化
{
  "agentCore": {
    "runtime": {
      "enabled": false
    }
  }
}

# 再デプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=agentcore-20260105-000000
```

### 4. バックアップからの復元

```bash
# 設定ファイルのバックアップから復元
cp cdk.context.json.backup cdk.context.json

# 再デプロイ
npx cdk deploy --all -c imageTag=agentcore-20260105-000000
```

---

## 関連ドキュメント

- [Amazon Bedrock AgentCore実装ガイド](./bedrock-agentcore-implementation-guide.md)
- [クイックスタートガイド](./quick-start.md)
- [デバッグ・トラブルシューティングガイド](./debugging-troubleshooting-guide.md)
- [運用・保守ガイド](./operations-maintenance-guide-ja.md)

---

**このガイドは継続的に更新されます。最新情報は[GitHub](https://github.com/your-repo)を確認してください。**
