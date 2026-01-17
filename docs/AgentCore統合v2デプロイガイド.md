# AgentCore統合v2デプロイガイド

**最終更新**: 2026-01-08  
**対象**: AgentCore統合システムv2のデプロイメント

## 📋 概要

AgentCore統合v2は、Next.js UIとAgentCore Runtimeの責任分離を実現するハイブリッドアーキテクチャシステムです。API Gateway無効化によりタイムアウト制約を回避し、Lambda直接呼び出しによる高性能な統合を提供します。

## 🏗️ アーキテクチャ概要

```
Next.js Frontend ←→ Lambda Direct Invocation ←→ AgentCore Runtime v2
       ↓                      ↓                        ↓
   UI/UX処理              API Route処理           AI処理・推論
   認証・セッション        Lambda呼び出し          モデル呼び出し
   設定管理               エラーハンドリング       レスポンス生成
```

### 責任分離
- **Next.js側**: UI/UX、認証、設定管理、Lambda直接呼び出し
- **AgentCore Runtime側**: AI処理、推論、ナレッジベースクエリ

## 🚨 重要な制限事項とTIPS

### 1. Lambda関数名64文字制限
**制限**: AWS Lambda関数名は64文字以内

**対策**:
```typescript
// ❌ 悪い例（65文字）
functionName: `${regionPrefix}-${projectName}-${environment}-AgentCore-Runtime-V2`

// ✅ 良い例（47文字）
functionName: `${regionPrefix}-${projectName}-${environment}-AgentCore-V2`
```

### 2. DynamoDBテーブル名制限
**制限**: 長いテーブル名による管理性の問題

**対策**:
```typescript
// ❌ 悪い例
tableName: `${regionPrefix}-${projectName}-${environment}-UserPreferences-V2`

// ✅ 良い例
tableName: `${regionPrefix}-${projectName}-${environment}-UserPrefs-V2`
```

### 3. SNSトピック名競合
**問題**: 環境間でのリソース名競合

**対策**:
```typescript
// ✅ 環境名を含める
topicName: `${projectName}-agentcore-v2-${environment}-alerts`
```

### 4. FSx統合機能の関数名制限
**問題**: FSx統合機能のLambda関数名も64文字制限を超過

**対策**: 本番環境では機能フラグで一時的に無効化
```typescript
// lib/config/environments/tokyo-production-config.ts
features: {
  enableFsxIntegration: false, // 一時的に無効化
  enableAgentCoreIntegration: true, // AgentCoreは有効
}
```

## 📦 デプロイ手順

### 前提条件
- AWS CLI設定済み
- Node.js 18以上
- CDK v2インストール済み
- 適切なIAM権限

### Step 1: 環境準備
```bash
# 依存関係インストール
npm install

# TypeScriptビルド
npm run build
```

### Step 2: 開発環境デプロイ
```bash
# 開発環境AgentCore統合スタックv2デプロイ
DEPLOY_MODE=full CONFIG_ENV=development npx cdk deploy \
  TokyoRegion-permission-aware-rag-dev-AgentCoreIntegration-V2-NoAPI \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-dev-$(date +%Y%m%d-%H%M%S) \
  --require-approval never
```

### Step 3: 本番環境デプロイ
```bash
# 本番環境synthテスト（必須）
DEPLOY_MODE=production CONFIG_ENV=production npx cdk synth \
  TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-prod-$(date +%Y%m%d-%H%M%S)

# 本番環境デプロイ
DEPLOY_MODE=production CONFIG_ENV=production npx cdk deploy \
  TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-prod-$(date +%Y%m%d-%H%M%S) \
  --require-approval never
```

## 🔍 デプロイ後検証

### 1. Lambda関数動作確認
```bash
# ヘルスチェック
echo '{"httpMethod": "GET", "rawPath": "/health"}' | base64 | tr -d '\n' > /tmp/payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --payload file:///tmp/payload.b64 \
  /tmp/response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/response.json
```

**期待される応答**:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"status\":\"healthy\",\"version\":\"2.0.0\",\"timestamp\":\"2026-01-08T02:28:56.455Z\",\"runtime\":\"agentcore-v2\"}"
}
```

### 2. DynamoDB動作確認
```bash
# テーブル状態確認
aws dynamodb describe-table \
  --table-name TokyoRegion-permission-aware-rag-prod-UserPrefs-V2 \
  --region ap-northeast-1 \
  --query 'Table.{TableName:TableName,TableStatus:TableStatus,ItemCount:ItemCount}' \
  --output table
```

### 3. EventBridge確認
```bash
# EventBus確認
aws events list-event-buses \
  --name-prefix TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --region ap-northeast-1
```

## 🚨 トラブルシューティング

### 問題1: SNSトピック既存エラー
**エラー**: `Resource of type 'AWS::SNS::Topic' with identifier 'xxx' already exists`

**解決策**:
```bash
# 既存SNSトピック削除
aws sns delete-topic \
  --topic-arn "arn:aws:sns:ap-northeast-1:ACCOUNT:TOPIC_NAME" \
  --region ap-northeast-1

# 失敗したスタック削除
aws cloudformation delete-stack \
  --stack-name STACK_NAME \
  --region ap-northeast-1

# 再デプロイ実行
```

### 問題2: Lambda関数名制限エラー
**エラー**: `Function name can not be longer than 64 characters`

**解決策**: 関数名を短縮（上記TIPS参照）

### 問題3: FSx統合機能の関数名制限
**エラー**: FSx統合機能のLambda関数名が64文字超過

**解決策**: 機能フラグで無効化
```typescript
// 本番環境設定
features: {
  enableFsxIntegration: false, // 一時的に無効化
}
```

## 🔧 フロントエンド統合

### Next.js API Route設定
```typescript
// docker/nextjs/src/app/api/agentcore/invoke/route.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export async function POST(request: Request) {
  const { functionName, payload } = await request.json();
  
  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: JSON.stringify(payload),
  });
  
  const response = await lambdaClient.send(command);
  // レスポンス処理...
}
```

### AgentCore Client Service
```typescript
// docker/nextjs/src/services/agentcore-client.ts
export class AgentCoreClient {
  private endpoint = '/api/agentcore/invoke';
  
  async invokeAgentCore(message: string, options?: AgentCoreOptions) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        functionName: 'TokyoRegion-permission-aware-rag-prod-AgentCore-V2',
        payload: {
          httpMethod: 'POST',
          rawPath: '/agentcore',
          body: JSON.stringify({ message, ...options })
        }
      })
    });
    
    return response.json();
  }
}
```

## 📊 監視・アラート

### CloudWatch Alarms
- **エラー率アラーム**: 5エラー/5分で通知
- **レイテンシアラーム**: 30秒超過で通知
- **DynamoDBスロットリング**: 1回でも発生で通知

### SNS通知設定
```bash
# メール通知設定
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:ACCOUNT:permission-aware-rag-agentcore-v2-prod-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ap-northeast-1
```

## 🎯 パフォーマンス最適化

### Lambda設定
- **Runtime**: Node.js 18.x
- **Architecture**: ARM64（コスト最適化）
- **Memory**: 1024MB
- **Timeout**: 300秒

### DynamoDB設定
- **Billing Mode**: PAY_PER_REQUEST
- **Encryption**: KMS Customer Managed Key
- **TTL**: 有効化（1年）

## 🔄 継続的デプロイメント

### 自動化スクリプト例
```bash
#!/bin/bash
# deploy-agentcore-v2.sh

set -euo pipefail

ENVIRONMENT=${1:-development}
IMAGE_TAG="agentcore-v2-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

echo "🚀 AgentCore v2 デプロイ開始: ${ENVIRONMENT}"

# ビルド
npm run build

# synthテスト
DEPLOY_MODE=${ENVIRONMENT} CONFIG_ENV=${ENVIRONMENT} npx cdk synth \
  TokyoRegion-permission-aware-rag-${ENVIRONMENT}-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=${IMAGE_TAG}

# デプロイ
DEPLOY_MODE=${ENVIRONMENT} CONFIG_ENV=${ENVIRONMENT} npx cdk deploy \
  TokyoRegion-permission-aware-rag-${ENVIRONMENT}-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=${IMAGE_TAG} \
  --require-approval never

echo "✅ AgentCore v2 デプロイ完了: ${ENVIRONMENT}"
```

## 📚 関連ドキュメント

- [AgentCore統合システム実装概要](./AgentCore統合システム実装概要.md)
- [ハイブリッドアーキテクチャ設計ガイド](./ハイブリッドアーキテクチャ設計ガイド.md)
- [Lambda直接呼び出し実装ガイド](./Lambda直接呼び出し実装ガイド.md)
- [トラブルシューティングガイド](./トラブルシューティングガイド.md)

---

**重要**: このガイドは実際のデプロイ経験に基づいて作成されており、記載されたTIPSと手順に従うことで、AgentCore統合v2の安全で確実なデプロイが可能です。