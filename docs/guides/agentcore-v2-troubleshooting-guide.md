# AgentCore統合v2 トラブルシューティングガイド

**最終更新**: 2026年1月8日  
**対象**: AgentCore統合v2ハイブリッドアーキテクチャシステム

## 📋 概要

このガイドでは、AgentCore統合v2システムで発生する可能性のある問題と、その解決方法を詳細に説明します。実際のデプロイ経験に基づいた実践的な解決策を提供します。

## 🚨 緊急時対応フロー

### Phase 1: 即座の状況確認 (2分以内)

```bash
# 1. Lambda関数の状態確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1 \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus,StateReason:StateReason}'

# 2. DynamoDBテーブルの状態確認
aws dynamodb describe-table \
  --table-name TokyoRegion-permission-aware-rag-prod-UserPrefs-V2 \
  --region ap-northeast-1 \
  --query 'Table.{TableStatus:TableStatus,ItemCount:ItemCount}'

# 3. EventBridgeの状態確認
aws events list-event-buses \
  --name-prefix TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --region ap-northeast-1 \
  --query 'EventBuses[0].{Name:Name,State:State}'
```

### Phase 2: 基本機能テスト (3分以内)

```bash
# ヘルスチェック実行
echo '{"httpMethod": "GET", "rawPath": "/health"}' | base64 | tr -d '\n' > /tmp/health-payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --payload file:///tmp/health-payload.b64 \
  /tmp/health-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/health-response.json | jq '.'
```

**正常な応答例**:
```json
{
  "statusCode": 200,
  "body": "{\"status\":\"healthy\",\"version\":\"2.0.0\",\"timestamp\":\"2026-01-08T02:28:56.455Z\",\"runtime\":\"agentcore-v2\"}"
}
```

## 🔧 よくある問題と解決方法

### 1. Lambda関数名64文字制限エラー

**症状**:
```
ValidationException: Function name can not be longer than 64 characters
```

**原因**: AWS Lambda関数名の制限（64文字以内）

**解決方法**:
```bash
# 現在の関数名を確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `AgentCore`)].[FunctionName]' \
  --region ap-northeast-1

# 関数名が64文字を超えている場合、CDKスタックを更新
# lib/stacks/integrated/agentcore-integration-stack-v2.ts で関数名を短縮
```

**予防策**:
- 関数名は47文字以内に設定
- プロジェクト名、環境名を短縮
- 不要な接頭辞・接尾辞を削除

### 2. SNSトピック名競合エラー

**症状**:
```
Resource of type 'AWS::SNS::Topic' with identifier 'permission-aware-rag-agentcore-v2-alerts' already exists
```

**原因**: 環境間でのSNSトピック名重複

**解決方法**:
```bash
# 既存SNSトピックの確認
aws sns list-topics \
  --query 'Topics[?contains(TopicArn, `permission-aware-rag-agentcore-v2`)]' \
  --region ap-northeast-1

# 競合するトピックを削除
aws sns delete-topic \
  --topic-arn "arn:aws:sns:ap-northeast-1:ACCOUNT:permission-aware-rag-agentcore-v2-alerts" \
  --region ap-northeast-1

# 失敗したスタックを削除
aws cloudformation delete-stack \
  --stack-name STACK_NAME \
  --region ap-northeast-1

# 再デプロイ実行
DEPLOY_MODE=production CONFIG_ENV=production npx cdk deploy \
  TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts'
```

**予防策**:
- 環境名をSNSトピック名に含める
- 開発環境: `permission-aware-rag-agentcore-v2-dev-alerts`
- 本番環境: `permission-aware-rag-agentcore-v2-prod-alerts`

### 3. FSx統合機能の関数名制限

**症状**: FSx統合機能のLambda関数名が64文字を超過

**原因**: FSx統合機能の長い関数名

**解決方法**:
```bash
# 本番環境でFSx統合機能を一時的に無効化
# lib/config/environments/tokyo-production-config.ts
features: {
  enableFsxIntegration: false, // 一時的に無効化
  enableAgentCoreIntegration: true, // AgentCoreは有効
}

# 再デプロイ実行
CONFIG_ENV=production npx cdk deploy --all
```

**長期的解決策**:
- FSx統合機能の関数名を短縮
- モジュール名の最適化
- 統合スタックでの名前管理

### 4. Lambda関数が応答しない

**症状**: Lambda関数呼び出しがタイムアウトまたは無応答

**診断手順**:
```bash
# 1. Lambda関数の詳細状態確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1

# 2. 最近のログを確認
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --follow --region ap-northeast-1

# 3. Lambda関数のメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average,Maximum \
  --region ap-northeast-1
```

**解決方法**:
```bash
# Lambda関数の強制更新
aws lambda update-function-code \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --image-uri ECR_REPOSITORY_URI:latest \
  --region ap-northeast-1

# Container Refresh（Reserved Concurrency方式）
aws lambda put-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --reserved-concurrent-executions 0 \
  --region ap-northeast-1

sleep 10

aws lambda delete-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1
```

### 5. DynamoDB接続エラー

**症状**: DynamoDBテーブルへのアクセスが失敗

**診断手順**:
```bash
# 1. テーブルの存在確認
aws dynamodb describe-table \
  --table-name TokyoRegion-permission-aware-rag-prod-UserPrefs-V2 \
  --region ap-northeast-1

# 2. Lambda関数のVPC設定確認（VPC内配置の場合）
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1 \
  --query 'VpcConfig'

# 3. IAMロールの権限確認
aws iam get-role-policy \
  --role-name LAMBDA_EXECUTION_ROLE \
  --policy-name DynamoDBAccessPolicy
```

**解決方法**:
```bash
# DynamoDBテーブルの手動作成（必要に応じて）
aws dynamodb create-table \
  --table-name TokyoRegion-permission-aware-rag-prod-UserPrefs-V2 \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=settingKey,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=settingKey,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1

# VPC Endpointの確認（VPC内配置の場合）
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.ap-northeast-1.dynamodb" \
  --region ap-northeast-1
```

### 6. EventBridge統合エラー

**症状**: EventBridgeイベントが処理されない

**診断手順**:
```bash
# 1. EventBusの状態確認
aws events describe-event-bus \
  --name TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --region ap-northeast-1

# 2. EventBridgeルールの確認
aws events list-rules \
  --event-bus-name TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --region ap-northeast-1

# 3. ルールのターゲット確認
aws events list-targets-by-rule \
  --rule RULE_NAME \
  --event-bus-name TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --region ap-northeast-1
```

**解決方法**:
```bash
# テストイベントの送信
aws events put-events \
  --entries '[{
    "Source": "agentcore.test",
    "DetailType": "Test Event",
    "Detail": "{\"message\": \"test\", \"timestamp\": \"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\"}"
  }]' \
  --region ap-northeast-1

# EventBridgeメトリクスの確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name SuccessfulInvocations \
  --dimensions Name=EventBusName,Value=TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

## 🌐 フロントエンド統合の問題

### 7. Next.jsからLambda呼び出しエラー

**症状**: API Route `/api/agentcore/invoke` が失敗

**診断手順**:
```bash
# 1. API Routeの動作確認
curl -X POST "http://localhost:3000/api/agentcore/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "functionName": "TokyoRegion-permission-aware-rag-prod-AgentCore-V2",
    "payload": {"test": true}
  }'

# 2. Lambda関数の権限確認
aws lambda get-policy \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1
```

**解決方法**:
```bash
# Lambda関数に呼び出し権限を追加
aws lambda add-permission \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --statement-id allow-next-js-invoke \
  --action lambda:InvokeFunction \
  --principal YOUR_AWS_ACCOUNT_ID \
  --region ap-northeast-1

# または、IAMロールベースの権限設定
aws iam attach-role-policy \
  --role-name NextJsExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaRole
```

### 8. CORS（Cross-Origin Resource Sharing）エラー

**症状**: ブラウザでCORSエラーが発生

**解決方法**:
```typescript
// docker/nextjs/src/app/api/agentcore/invoke/route.ts
export async function POST(request: Request) {
  try {
    // Lambda呼び出し処理...
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

## 📊 監視・ログ分析

### CloudWatchログの効率的な確認方法

```bash
# 1. 最新のエラーログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR" \
  --region ap-northeast-1

# 2. 特定の時間範囲のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --start-time $(date -d '2026-01-08 02:00:00' +%s)000 \
  --end-time $(date -d '2026-01-08 03:00:00' +%s)000 \
  --region ap-northeast-1

# 3. リアルタイムログ監視
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --follow --region ap-northeast-1
```

### パフォーマンス監視

```bash
# Lambda関数のパフォーマンスメトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Average,Maximum,Minimum \
  --region ap-northeast-1

# DynamoDBのパフォーマンスメトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=TokyoRegion-permission-aware-rag-prod-UserPrefs-V2 \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Sum \
  --region ap-northeast-1
```

## 🔄 復旧手順

### 完全復旧フロー

```bash
# Step 1: 現在の状態をバックアップ
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1 > backup-stack-state.json

# Step 2: 問題のあるスタックを削除
aws cloudformation delete-stack \
  --stack-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1

# Step 3: 削除完了を待機
aws cloudformation wait stack-delete-complete \
  --stack-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1

# Step 4: 再デプロイ実行
DEPLOY_MODE=production CONFIG_ENV=production npx cdk deploy \
  TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-recovery-$(date +%Y%m%d-%H%M%S) \
  --require-approval never

# Step 5: 動作確認
echo '{"httpMethod": "GET", "rawPath": "/health"}' | base64 | tr -d '\n' > /tmp/recovery-payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --payload file:///tmp/recovery-payload.b64 \
  /tmp/recovery-response.json \
  --region ap-northeast-1

cat /tmp/recovery-response.json | jq '.'
```

## 📞 エスカレーション手順

### Level 1: 自動復旧（5分以内）
1. ヘルスチェック実行
2. Lambda関数の強制更新
3. Container Refresh実行

### Level 2: 手動介入（15分以内）
1. ログ分析とエラー特定
2. 設定の確認と修正
3. 部分的な再デプロイ

### Level 3: 完全復旧（30分以内）
1. スタック削除と再作成
2. データの整合性確認
3. 全機能の動作確認

### Level 4: 緊急対応（60分以内）
1. フォールバック環境への切り替え
2. データバックアップからの復旧
3. 根本原因分析と恒久対策

## 📚 関連ドキュメント

- **[AgentCore統合v2デプロイガイド](../AgentCore統合v2デプロイガイド.md)** - デプロイ手順とTIPS
- **[ハイブリッドアーキテクチャ実装ガイド](./hybrid-architecture-implementation-guide.md)** - アーキテクチャ詳細
- **[Lambda直接呼び出し実装ガイド](./lambda-direct-invocation-guide.md)** - API Gateway無効化実装
- **[フロントエンド統合ガイド](./frontend-integration-guide.md)** - Next.js統合詳細

## 🆘 緊急連絡先

問題が解決しない場合は、以下の方法でサポートを受けてください：

1. **GitHub Issues**: [緊急バグレポート](https://github.com/Yoshiki0705/RAG-FSxN-CDK/issues)
2. **ディスカッション**: 技術的な質問
3. **ドキュメント**: 詳細な技術文書

---

**重要**: このトラブルシューティングガイドは、実際のデプロイ経験と問題解決の実績に基づいて作成されています。記載された手順に従うことで、AgentCore統合v2システムの問題を効率的に解決できます。