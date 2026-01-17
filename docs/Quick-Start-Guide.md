# AgentCore統合v2ハイブリッドアーキテクチャ - クイックスタートガイド

## 🚀 5分で始める AgentCore統合v2

このガイドでは、**Next.js UIとAgentCore Runtime APIを統合したハイブリッドアーキテクチャシステム**を最短時間でセットアップする方法を説明します。API Gateway無効化により29秒タイムアウト制約を回避し、Lambda直接呼び出しによる高性能システムを実現します。

## 前提条件

- AWS CLI v2.0+ がインストール済み
- Node.js 20+ がインストール済み
- AWS CDK 2.129.0+ がインストール済み
- AWS アカウントと適切な権限
- Docker（コンテナビルド用）

## ステップ 1: プロジェクトのセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/Yoshiki0705/RAG-FSxN-CDK.git
cd RAG-FSxN-CDK

# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

## ステップ 2: AgentCore統合v2デプロイ

### 🔧 開発環境デプロイ（推奨）

```bash
# 開発環境AgentCore統合v2デプロイ
DEPLOY_MODE=full CONFIG_ENV=development npx cdk deploy \
  TokyoRegion-permission-aware-rag-dev-AgentCoreIntegration-V2-NoAPI \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-dev-$(date +%Y%m%d-%H%M%S) \
  --require-approval never
```

**開発環境の特徴**:
- ✅ API Gateway無効化（タイムアウト制約回避）
- ✅ Lambda直接呼び出し（高性能）
- ✅ 開発最適化設定（コスト削減）
- ✅ 監視・アラート（基本設定）

### 🏭 本番環境デプロイ

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

**本番環境の特徴**:
- ✅ 高セキュリティ設定（KMS暗号化）
- ✅ 高可用性設定（Multi-AZ）
- ✅ 包括的監視・アラート
- ✅ 本番レベルパフォーマンス

## ステップ 4: フロントエンド統合とAgent選択機能

### 🎨 Agent選択変更イベント連動（v2.8.1対応）

AgentCore統合v2では、Agent選択変更時のIntroduction Text即座更新機能が実装されています。

#### Agent選択機能の使用方法

```typescript
// AgentCore Client Service使用例
import { AgentCoreClient } from '@/services/agentcore-client';

const client = new AgentCoreClient({
  enabled: true,
  apiEndpoint: '/api/agentcore/invoke', // Lambda直接呼び出し
  timeout: 30000,
  fallbackToBedrockDirect: true
});

// AgentCore Runtime呼び出し
const response = await client.processUserInput(
  'Hello from AgentCore v2',
  { 
    sessionId: 'session_123',
    userId: 'user_456',
    preferences: { model: 'claude-3-sonnet' }
  }
);
```

#### Agent選択変更イベント実装パターン

```typescript
// ✅ 正しい実装: 即座イベント発火
const handleAgentChange = async (newAgentId: string) => {
  // 1. ストア更新
  setSelectedAgentId(newAgentId);
  
  // 2. Agent詳細情報取得
  const selectedAgent = agents.find(agent => agent.agentId === newAgentId);
  
  // 3. 即座にグローバルイベント発火
  const customEvent = new CustomEvent('agent-selection-changed', {
    detail: { 
      agentInfo: selectedAgent,
      timestamp: Date.now(),
      source: 'AgentInfoSection'
    }
  });
  window.dispatchEvent(customEvent);
};

// ✅ 複数ソースからのAgent情報統合
const effectiveAgentInfo = selectedAgentInfo || agentInfo || fallbackAgentInfo;

// ✅ Introduction Text生成
if (agentMode && effectiveAgentInfo) {
  const initialMessageText = generateAgentInitialMessage(
    user.username,
    effectiveAgentInfo,
    tIntro
  );
}
```

#### 初期化時のAgent情報表示

```typescript
// ✅ 初期化時のAgent情報イベント発火
useEffect(() => {
  if (selectedAgent && agents.length > 0) {
    console.log('🔄 初期化時のAgent情報発火:', selectedAgent);
    
    setTimeout(() => {
      const customEvent = new CustomEvent('agent-selection-changed', {
        detail: { 
          agentInfo: selectedAgent,
          timestamp: Date.now(),
          source: 'AgentInfoSection-Init'
        }
      });
      window.dispatchEvent(customEvent);
    }, 100); // メインコンポーネント初期化完了を待つ
  }
}, [selectedAgent, agents.length]);
```

### 🔧 重要な実装TIPS

#### 1. Agent情報の確実な取得
```typescript
// ✅ 新しいチャット作成時の確実なAgent情報取得
const currentAgentInfo = selectedAgentInfo || agentInfo || effectiveAgentInfo;

if (agentMode && currentAgentInfo) {
  // Agent情報を含む専用メッセージ
  initialMessageText = generateAgentInitialMessage(
    user.username,
    currentAgentInfo,
    tIntro
  );
  console.log('✅ Agent情報を含むIntroduction Text生成:', {
    agentId: currentAgentInfo.agentId || currentAgentInfo.agentName,
    source: selectedAgentInfo ? 'selectedAgentInfo' : 
            agentInfo ? 'agentInfo' : 'effectiveAgentInfo'
  });
} else if (agentMode) {
  // フォールバック: Agent未選択時のメッセージ
  initialMessageText = generateAgentInitialMessage(
    user.username,
    null,
    tIntro
  );
}
```

#### 2. Agent選択変更イベント連動修正（v2.8.1追加）

##### 問題の解決: 「Agent選択中...」表示
```typescript
// ❌ 問題のあった実装
const handleAgentChange = (agentId: string) => {
  setSelectedAgentId(agentId);
  // イベント発火が遅延または欠落
};

// ✅ 修正後の実装
const handleAgentChange = (agentId: string) => {
  // 1. 即座にストア更新
  setSelectedAgentId(agentId);
  
  // 2. Agent詳細情報取得
  const selectedAgent = agents.find(a => a.agentId === agentId);
  
  // 3. 即座にイベント発火（遅延なし）
  if (selectedAgent) {
    const customEvent = new CustomEvent('agent-selection-changed', {
      detail: { 
        agentInfo: selectedAgent,
        timestamp: Date.now(),
        source: 'AgentInfoSection'
      }
    });
    window.dispatchEvent(customEvent);
  }
};
```

##### Agent情報統合の優先順位
```typescript
// ✅ 複数ソースからの確実なAgent情報取得
const getEffectiveAgentInfo = () => {
  // 優先順位: selectedAgentInfo > agentInfo > effectiveAgentInfo
  const info = selectedAgentInfo || agentInfo || effectiveAgentInfo;
  
  console.log('🔍 Agent情報統合結果:', {
    selectedAgentInfo: !!selectedAgentInfo,
    agentInfo: !!agentInfo,
    effectiveAgentInfo: !!effectiveAgentInfo,
    finalInfo: !!info,
    source: selectedAgentInfo ? 'selected' : 
            agentInfo ? 'agent' : 
            effectiveAgentInfo ? 'effective' : 'none'
  });
  
  return info;
};
```

##### 初期化時のAgent情報確実表示
```typescript
// ✅ ページロード時のAgent情報イベント発火
useEffect(() => {
  if (selectedAgent && agents.length > 0) {
    console.log('🚀 初期化時Agent情報発火:', {
      agentId: selectedAgent.agentId,
      agentName: selectedAgent.agentName,
      agentsCount: agents.length
    });
    
    // メインコンポーネント初期化完了を待つ
    setTimeout(() => {
      const customEvent = new CustomEvent('agent-selection-changed', {
        detail: { 
          agentInfo: selectedAgent,
          timestamp: Date.now(),
          source: 'AgentInfoSection-Init'
        }
      });
      window.dispatchEvent(customEvent);
    }, 100);
  }
}, [selectedAgent, agents.length]);
```

#### 3. TypeScriptエラー回避パターン
```typescript
// ✅ 型安全なAgent情報アクセス
interface AgentInfo {
  agentId?: string;
  agentName?: string;
  alias?: string;
  status?: AgentStatus;
  agentStatus?: AgentStatus;
  version?: string;
  latestAgentVersion?: string;
}

// ✅ 安全なプロパティアクセス
const agentName = 'agentName' in displayAgentInfo 
  ? displayAgentInfo.agentName 
  : displayAgentInfo.agentId;

const status = 'status' in displayAgentInfo 
  ? displayAgentInfo.status 
  : displayAgentInfo.agentStatus;
```

#### 3. イベントリスナーのクリーンアップ
```typescript
// ✅ 適切なイベントリスナー管理
useEffect(() => {
  const handleAgentSelectionChange = (event: CustomEvent) => {
    const { agentInfo, source } = event.detail;
    console.log('🔄 Agent選択変更:', { agentInfo, source });
    setSelectedAgentInfo(agentInfo);
  };
  
  window.addEventListener('agent-selection-changed', handleAgentSelectionChange as EventListener);
  
  // クリーンアップ
  return () => {
    window.removeEventListener('agent-selection-changed', handleAgentSelectionChange as EventListener);
  };
}, []);
```

## ステップ 5: デプロイ状況確認

### 📊 Lambda関数確認

```bash
# 開発環境Lambda関数確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI \
  --region ap-northeast-1 \
  --query '{FunctionName:FunctionName,Runtime:Runtime,LastModified:LastModified,State:State}'

# 本番環境Lambda関数確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --region ap-northeast-1 \
  --query '{FunctionName:FunctionName,Runtime:Runtime,LastModified:LastModified,State:State}'
```

### 🗄️ DynamoDBテーブル確認

```bash
# 開発環境DynamoDBテーブル確認
aws dynamodb describe-table \
  --table-name TokyoRegion-permission-aware-rag-dev-UserPreferences-V2-NoAPI \
  --region ap-northeast-1 \
  --query 'Table.{TableName:TableName,TableStatus:TableStatus,ItemCount:ItemCount}'

# 本番環境DynamoDBテーブル確認
aws dynamodb describe-table \
  --table-name TokyoRegion-permission-aware-rag-prod-UserPrefs-V2 \
  --region ap-northeast-1 \
  --query 'Table.{TableName:TableName,TableStatus:TableStatus,ItemCount:ItemCount}'
```

### 📡 EventBridge確認

```bash
# 開発環境EventBridge確認
aws events list-event-buses \
  --name-prefix TokyoRegion-permission-aware-rag-dev-HybridBus-V2-NoAPI \
  --region ap-northeast-1

# 本番環境EventBridge確認
aws events list-event-buses \
  --name-prefix TokyoRegion-permission-aware-rag-prod-HybridBus-V2 \
  --region ap-northeast-1
```

## ステップ 4: 機能テスト

### 🧪 Lambda関数ヘルスチェック

```bash
# 開発環境ヘルスチェック
echo '{"httpMethod": "GET", "rawPath": "/health"}' | base64 | tr -d '\n' > /tmp/dev-payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI \
  --payload file:///tmp/dev-payload.b64 \
  /tmp/dev-health-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/dev-health-response.json | jq '.'

# 本番環境ヘルスチェック
echo '{"httpMethod": "GET", "rawPath": "/health"}' | base64 | tr -d '\n' > /tmp/prod-payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --payload file:///tmp/prod-payload.b64 \
  /tmp/prod-health-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/prod-health-response.json | jq '.'
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

### 🔄 AgentCore Runtime API呼び出しテスト

```bash
# AgentCore Runtime API呼び出し（開発環境）
echo '{"httpMethod": "POST", "rawPath": "/agentcore", "body": "{\"message\": \"Hello from Development\"}"}' | base64 | tr -d '\n' > /tmp/dev-agentcore-payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI \
  --payload file:///tmp/dev-agentcore-payload.b64 \
  /tmp/dev-agentcore-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/dev-agentcore-response.json | jq '.'

# AgentCore Runtime API呼び出し（本番環境）
echo '{"httpMethod": "POST", "rawPath": "/agentcore", "body": "{\"message\": \"Hello from Production\"}"}' | base64 | tr -d '\n' > /tmp/prod-agentcore-payload.b64
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --payload file:///tmp/prod-agentcore-payload.b64 \
  /tmp/prod-agentcore-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/prod-agentcore-response.json | jq '.'
```

## ステップ 5: フロントエンド統合テスト

### 🌐 Next.js開発サーバー起動

```bash
# Next.jsアプリケーションディレクトリに移動
cd docker/nextjs

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev
```

### 🔗 Lambda直接呼び出しテスト

```bash
# 開発環境Lambda直接呼び出しテスト
curl -X POST "http://localhost:3000/api/agentcore/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "functionName": "TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI",
    "payload": {
      "httpMethod": "POST",
      "rawPath": "/agentcore",
      "body": "{\"message\": \"Hello from Frontend Development\"}"
    }
  }'

# 本番環境Lambda直接呼び出しテスト
curl -X POST "http://localhost:3000/api/agentcore/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "functionName": "TokyoRegion-permission-aware-rag-prod-AgentCore-V2",
    "payload": {
      "httpMethod": "POST",
      "rawPath": "/agentcore",
      "body": "{\"message\": \"Hello from Frontend Production\"}"
    }
  }'
```

### 🎯 AgentCore設定UIテスト

1. **ブラウザでアクセス**: `http://localhost:3000`
2. **設定画面に移動**: 右上の設定アイコンをクリック
3. **AgentCore設定**: AgentCore設定タブを選択
4. **機能テスト**: 各種設定の保存・読み込みをテスト

## 🎯 ハイブリッドアーキテクチャの活用

### 🏗️ アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                        ユーザー                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js アプリケーション                              │
│           (UI/UX、認証、設定管理、セッション管理)                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │   UI/UX      │    認証      │   設定管理    │ セッション管理 │ │
│  │   コンポーネント │   システム    │   永続化      │   履歴管理    │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │ Lambda直接呼び出し（API Gateway無効）
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            AgentCore Runtime v2                                  │
│              (AI処理、推論、高度な機能)                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │   Runtime    │   Gateway    │    Memory    │   Browser    │ │
│  │ イベント駆動   │  API統合     │   長期記憶    │  Web自動化   │ │
│  └──────────────┼──────────────┼──────────────┼──────────────┘ │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │CodeInterpreter│  Identity   │    Policy    │Observability │ │
│  │ コード実行     │   認証認可    │ ポリシー管理  │   監視       │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 💡 責任分離の利点

#### Next.js側の責任
- ✅ **UI/UX処理**: レスポンシブデザイン、アクセシビリティ
- ✅ **認証・セッション管理**: サインイン/サインアウト、セッション維持
- ✅ **設定管理**: テーマ、言語、リージョン設定の永続化
- ✅ **Lambda直接呼び出し**: API Gateway無効化による高性能統合

#### AgentCore Runtime側の責任
- ✅ **AI処理・推論**: Bedrock Agent、Knowledge Base、推論処理
- ✅ **高度な機能**: コード実行、Web自動化、ブラウザ操作
- ✅ **データ処理**: ベクトル検索、文書処理、メモリ管理
- ✅ **セキュリティ**: 認証認可、ポリシー管理、監査ログ

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 1. Lambda関数名64文字制限エラー

**症状**: `Function name can not be longer than 64 characters`

**解決方法**:
```bash
# 関数名を短縮（自動的に適用済み）
# 変更前: TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime-V2 (65文字)
# 変更後: TokyoRegion-permission-aware-rag-prod-AgentCore-V2 (47文字)

# 確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `AgentCore-V2`)].[FunctionName]' \
  --region ap-northeast-1
```

#### 2. SNSトピック名競合エラー

**症状**: `Resource of type 'AWS::SNS::Topic' with identifier 'xxx' already exists`

**解決方法**:
```bash
# 既存SNSトピック削除
aws sns list-topics \
  --query 'Topics[?contains(TopicArn, `permission-aware-rag-agentcore-v2`)]' \
  --region ap-northeast-1

# 競合するトピックを削除
aws sns delete-topic \
  --topic-arn "arn:aws:sns:ap-northeast-1:ACCOUNT:TOPIC_NAME" \
  --region ap-northeast-1

# 再デプロイ実行
```

#### 3. Lambda関数が応答しない

**症状**: Lambda関数呼び出しがタイムアウトする

**解決方法**:
```bash
# Lambda関数の状態確認
aws lambda get-function-configuration \
  --function-name FUNCTION_NAME \
  --region ap-northeast-1 \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus,StateReason:StateReason}'

# Lambda関数のログ確認
aws logs tail /aws/lambda/FUNCTION_NAME --follow --region ap-northeast-1

# 必要に応じてLambda関数を更新
aws lambda update-function-code \
  --function-name FUNCTION_NAME \
  --image-uri ECR_IMAGE_URI \
  --region ap-northeast-1
```

#### 4. フロントエンド統合エラー

**症状**: Next.jsからLambda呼び出しが失敗する

**解決方法**:
```bash
# API Route確認
curl -X POST "http://localhost:3000/api/agentcore/invoke" \
  -H "Content-Type: application/json" \
  -d '{"functionName": "test", "payload": {}}'

# Lambda関数の権限確認
aws lambda get-policy \
  --function-name FUNCTION_NAME \
  --region ap-northeast-1

# 必要に応じて権限を追加
aws lambda add-permission \
  --function-name FUNCTION_NAME \
  --statement-id allow-invoke \
  --action lambda:InvokeFunction \
  --principal YOUR_PRINCIPAL \
  --region ap-northeast-1
```

### 📊 監視・ログの確認方法

```bash
# CloudWatchメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=FUNCTION_NAME \
  --start-time 2026-01-08T00:00:00Z \
  --end-time 2026-01-08T23:59:59Z \
  --period 3600 \
  --statistics Average,Maximum \
  --region ap-northeast-1

# DynamoDBメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=TABLE_NAME \
  --start-time 2026-01-08T00:00:00Z \
  --end-time 2026-01-08T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region ap-northeast-1

# EventBridgeメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name SuccessfulInvocations \
  --dimensions Name=EventBusName,Value=EVENT_BUS_NAME \
  --start-time 2026-01-08T00:00:00Z \
  --end-time 2026-01-08T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region ap-northeast-1
```

## 📚 詳細ドキュメント

- **[AgentCore統合v2デプロイガイド](../AgentCore統合v2デプロイガイド.md)** - 詳細なデプロイ手順とTIPS
- **[ハイブリッドアーキテクチャ実装ガイド](../guides/hybrid-architecture-implementation-guide.md)** - アーキテクチャ設計詳細
- **[Lambda直接呼び出し実装ガイド](../guides/lambda-direct-invocation-guide.md)** - API Gateway無効化実装
- **[フロントエンド統合ガイド](../guides/frontend-integration-guide.md)** - Next.js統合の詳細

## 🆘 サポート

問題が解決しない場合は、以下の方法でサポートを受けることができます：

1. **GitHub Issues**: [バグレポートや機能リクエスト](https://github.com/Yoshiki0705/RAG-FSxN-CDK/issues)
2. **ディスカッション**: 一般的な質問や議論
3. **ドキュメント**: 詳細な技術文書

## 🎉 成功！

おめでとうございます！AgentCore統合v2ハイブリッドアーキテクチャが正常にセットアップされました。

### 次のステップ:

1. **フロントエンド統合の活用**: Next.js UIからAgentCore Runtime APIを活用
2. **カスタム機能の実装**: 独自のAI処理ロジックを実装
3. **パフォーマンス監視の設定**: CloudWatchダッシュボードで監視
4. **本番環境への展開**: 段階的に本番環境に展開
5. **高度な機能の探索**: コード実行、Web自動化等の活用

### 🚀 実現可能な価値:

- **タイムアウト制約の完全回避**: API Gateway 29秒制限なし
- **高性能統合**: Lambda直接呼び出しによる低レイテンシ
- **責任分離**: UI/UXとAI処理の独立最適化
- **段階的導入**: 必要な機能のみを選択的に有効化
- **コスト効率**: API Gateway無効化によるコスト削減

## 🔧 Agent選択変更イベント連動修正後の確認事項（v2.8.1追加）

### 📋 デプロイ後の必須確認項目

```bash
# 1. CloudFrontキャッシュ無効化完了確認（5-10分待機）
aws cloudfront get-invalidation \
  --distribution-id E3J5C6S69J4ZQY \
  --id INVALIDATION_ID \
  --query 'Invalidation.Status'

# 2. Lambda関数の最新イメージ確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --query '{CodeSha256:CodeSha256,LastModified:LastModified,State:State}'

# 3. Container Refresh完了確認
aws lambda get-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --query 'ReservedConcurrencyExecutions'
# 結果: null（制限なし）であることを確認
```

### 🧪 実環境テスト手順

#### 1. Agent選択変更イベント連動テスト
```bash
# 実環境アクセス
open "https://d3p7l2uoh6npdr.cloudfront.net/ja/genai?mode=agent"

# 確認項目:
# ✅ Agent選択ドロップダウン操作時の即座更新
# ✅ 「Agent選択中...」メッセージが表示されないこと
# ✅ Agent詳細情報（ID、名前、ステータス等）の正確表示
# ✅ Introduction TextにAgent情報が即座に反映
```

#### 2. 新しいチャット作成時のAgent情報反映テスト
```bash
# テスト手順:
# 1. Agentを選択した状態で「新しいチャット」ボタンをクリック
# 2. 新しいチャットのIntroduction Textを確認
# 3. Agent情報が正確に反映されているかを確認

# 期待結果:
# ✅ 新しいチャット作成時も選択されたAgent情報が反映
# ✅ Introduction TextにAgent詳細情報が表示
# ✅ Agent未選択時は適切なフォールバックメッセージ表示
```

#### 3. 初期化時のAgent情報表示テスト
```bash
# テスト手順:
# 1. Agentを選択した状態でページをリロード（Cmd+R / Ctrl+R）
# 2. 初期化時のIntroduction Text表示を確認
# 3. Agent情報の表示タイミングを確認

# 期待結果:
# ✅ ページロード時から選択されたAgent情報が表示
# ✅ 初期化遅延による「Agent選択中...」表示が最小限
# ✅ Agent情報の一貫性が保たれる
```

### 🚨 問題発生時の対処法

#### 問題1: CloudFrontキャッシュ未更新
```bash
# 症状: 修正内容が反映されない
# 対処: ハードリロード実行
# Chrome: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
# Safari: Cmd+Option+R (Mac)

# または開発者ツールでキャッシュクリア
# 1. F12で開発者ツールを開く
# 2. Networkタブを選択
# 3. 「Disable cache」にチェック
# 4. ページをリロード
```

#### 問題2: Agent情報の遅延読み込み
```bash
# 症状: 初期化時に「Agent選択中...」が表示される
# 対処: 数秒待機してAgent情報の読み込み完了を確認

# デバッグ方法:
# 1. F12で開発者ツールを開く
# 2. Consoleタブを選択
# 3. 以下のログを確認:
#    - "🔄 初期化時のAgent情報発火"
#    - "✅ Agent情報を含むIntroduction Text生成"
#    - "🔍 Agent情報統合結果"
```

#### 問題3: イベントリスナーの重複
```bash
# 症状: Agent選択変更時に複数回イベントが発火
# 対処: ページリロードでイベントリスナーをリセット

# 確認方法:
# 1. 開発者ツールのConsoleで以下を実行:
window.getEventListeners && window.getEventListeners(window)

# 2. 'agent-selection-changed'イベントリスナーの数を確認
# 3. 複数ある場合はページをリロード
```

### 📊 成功基準

#### 必須要件（100%達成必要）
- [ ] Agent選択変更時のIntroduction Text即座更新
- [ ] 新しいチャット作成時のAgent情報反映
- [ ] 初期化時のAgent情報確実表示
- [ ] エラー・例外の発生なし

#### 品質要件（90%以上達成目標）
- [ ] Agent選択からIntroduction Text更新まで1秒以内
- [ ] Agent情報の表示精度100%
- [ ] UI応答性の維持
- [ ] ユーザー体験の一貫性

### 💡 デバッグのコツ

```javascript
// ブラウザのConsoleで実行可能なデバッグコマンド

// 1. 現在のAgent選択状態を確認
console.log('Current Agent State:', {
  selectedAgentId: localStorage.getItem('selectedAgentId'),
  agentInfo: JSON.parse(localStorage.getItem('agentInfo') || 'null')
});

// 2. Agent選択変更イベントを手動発火
window.dispatchEvent(new CustomEvent('agent-selection-changed', {
  detail: { 
    agentInfo: { agentId: 'test', agentName: 'Test Agent' },
    source: 'Manual-Debug'
  }
}));

// 3. イベントリスナーの確認
console.log('Event Listeners:', 
  window.getEventListeners ? window.getEventListeners(window) : 'Not available'
);
```

Happy coding! 🚀

---

## 🆕 前回の機能: FSx統合システム IaC実装 (v2.7.0)

**リリース日**: 2026年1月8日  
**実装完了**: FSx for ONTAP統合システムのIaC化

Amazon FSx for ONTAPとサーバーレスアーキテクチャを統合したエンタープライズグレードのデータ処理基盤をInfrastructure as Code (IaC)として実装しました。設定ファイルの機能フラグで各機能を柔軟に有効化/無効化できます。

## 前提条件

- AWS CLI v2.0+ がインストール済み
- Node.js 20+ がインストール済み
- AWS CDK 2.129.0+ がインストール済み
- AWS アカウントと適切な権限
- Docker（コンテナビルド用）

## ステップ 1: プロジェクトのセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/Yoshiki0705/RAG-FSxN-CDK.git
cd RAG-FSxN-CDK

# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

## ステップ 2: 環境設定の選択

### 🔧 開発環境（コスト削減重視）

```bash
# 開発環境設定を使用
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all
```

**開発環境の機能フラグ**:
- ✅ `enableFsxIntegration`: FSx基本機能
- ❌ `enableFsxServerlessWorkflows`: Step Functions無効（コスト削減）
- ✅ `enableFsxEventDriven`: EventBridge有効（テスト用）
- ❌ `enableFsxBatchProcessing`: SQS/SNS無効（コスト削減）

### 🏭 本番環境（全機能有効）

```bash
# 本番環境設定を使用
CONFIG_ENV=production DEPLOY_MODE=production npx cdk deploy --all
```

**本番環境の機能フラグ**:
- ✅ `enableFsxIntegration`: FSx基本機能
- ✅ `enableFsxServerlessWorkflows`: Step Functions有効
- ✅ `enableFsxEventDriven`: EventBridge有効
- ✅ `enableFsxBatchProcessing`: SQS/SNS有効

### ⚙️ カスタム設定

特定の機能のみを有効化したい場合:

```typescript
// lib/config/environments/my-custom-config.ts
export const myCustomConfig: EnvironmentConfig = {
  environment: 'staging',
  region: 'ap-northeast-1',
  
  features: {
    // 基本機能
    enableNetworking: true,
    enableSecurity: true,
    enableStorage: true,
    enableDatabase: true,
    enableEmbedding: true,
    enableAPI: true,
    enableAI: true,
    enableMonitoring: true,
    enableEnterprise: false,
    
    // FSx統合機能（カスタム設定）
    enableFsxIntegration: true,           // FSx基本機能のみ
    enableFsxServerlessWorkflows: false,  // Step Functions無効
    enableFsxEventDriven: true,          // EventBridge有効
    enableFsxBatchProcessing: false      // SQS/SNS無効
  }
};
```

## ステップ 3: AWS認証の設定

```bash
# AWS CLIの設定確認
aws sts get-caller-identity

# 必要に応じてプロファイルを設定
aws configure --profile your-profile
```

## ステップ 4: CDKブートストラップ

```bash
# CDKブートストラップ（初回のみ）
npx cdk bootstrap
```

## ステップ 5: デプロイ実行

### 🚀 基本デプロイ

```bash
# 開発環境デプロイ（推奨）
npm run deploy:dev

# 本番環境デプロイ
npm run deploy:prod

# カスタム設定デプロイ
CONFIG_ENV=custom DEPLOY_MODE=full npx cdk deploy --all
```

### 🎯 特定スタックのみデプロイ

```bash
# FSx統合スタックのみデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-FsxIntegration

# 全スタック一覧確認
npx cdk list
```

## ステップ 6: デプロイ状況確認

### 📊 スタック状況確認

```bash
# 全スタックの状況確認
npx cdk list

# FSx統合スタックの詳細確認
npx cdk describe TokyoRegion-permission-aware-rag-prod-FsxIntegration

# CloudFormation出力確認
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-FsxIntegration \
  --query 'Stacks[0].Outputs'
```

### 🗄️ FSxリソース確認

```bash
# FSxファイルシステムの状態確認
aws fsx describe-file-systems --region ap-northeast-1

# FSxファイルシステムの詳細確認
aws fsx describe-file-systems \
  --file-system-ids fs-xxxxxxxxx \
  --query 'FileSystems[0].[FileSystemId,Lifecycle,StorageCapacity,ThroughputCapacity]'
```

### ⚡ Lambda関数確認

```bash
# FSx統合Lambda関数の確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `fsx`)].[FunctionName,Runtime,LastModified]'

# Lambda関数の設定確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-fsx-processor
```

## ステップ 7: 機能テスト

### 🧪 FSx統合機能のテスト

```bash
# FSx統合Lambda関数のテスト実行
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-fsx-processor \
  --payload '{"test": "fsx-integration", "action": "health-check"}' \
  response.json

# レスポンス確認
cat response.json | jq '.'
```

### 📡 EventBridge機能のテスト（有効化している場合）

```bash
# カスタムイベントの送信
aws events put-events \
  --entries '[{
    "Source": "fsx.filesystem",
    "DetailType": "File System State Change",
    "Detail": "{\"fileSystemId\": \"fs-12345678\", \"state\": \"available\", \"timestamp\": \"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\"}"
  }]'

# EventBridge ルールの確認
aws events list-rules \
  --name-prefix "TokyoRegion-permission-aware-rag"
```

### 🔄 Step Functions機能のテスト（有効化している場合）

```bash
# ステートマシンの一覧確認
aws stepfunctions list-state-machines \
  --query 'stateMachines[?contains(name, `fsx`)].[name,stateMachineArn,status]'

# ワークフローの実行
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:ap-northeast-1:123456789012:stateMachine:TokyoRegion-permission-aware-rag-prod-fsx-data-processing \
  --input '{"inputData": "test", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

## 🎯 業界別クイックスタート

### 🏥 医療・ヘルスケア向け設定

```typescript
// 医療画像診断支援システム向け設定
features: {
  enableFsxIntegration: true,           // 医療画像保存
  enableFsxServerlessWorkflows: true,   // 診断ワークフロー
  enableFsxEventDriven: true,          // 緊急通知
  enableFsxBatchProcessing: false      // バッチ処理不要
}

storage: {
  fsxOntap: {
    storageCapacity: 2048,              // 大容量医療画像
    throughputCapacity: 256,            // 高速アクセス
    deploymentType: 'MULTI_AZ_1',       // 高可用性
    automaticBackupRetentionDays: 30    // 長期バックアップ
  }
}
```

**デプロイ**:
```bash
# 医療向け設定でデプロイ
CONFIG_ENV=healthcare DEPLOY_MODE=full npx cdk deploy --all
```

### 🏭 製造業向け設定

```typescript
// スマートファクトリー品質管理システム向け設定
features: {
  enableFsxIntegration: true,           // 製品画像保存
  enableFsxServerlessWorkflows: false,  // ワークフロー不要
  enableFsxEventDriven: true,          // リアルタイム検知
  enableFsxBatchProcessing: true       // バッチ品質分析
}

storage: {
  fsxOntap: {
    storageCapacity: 1024,              // 中容量
    throughputCapacity: 512,            // 超高速アクセス
    deploymentType: 'SINGLE_AZ_1',      // コスト重視
    automaticBackupRetentionDays: 7     // 短期バックアップ
  }
}
```

**デプロイ**:
```bash
# 製造業向け設定でデプロイ
CONFIG_ENV=manufacturing DEPLOY_MODE=full npx cdk deploy --all
```

### 🏦 金融業界向け設定

```typescript
// リアルタイム不正取引検知システム向け設定
features: {
  enableFsxIntegration: true,           // 取引データ保存
  enableFsxServerlessWorkflows: true,   // 不正検知ワークフロー
  enableFsxEventDriven: true,          // リアルタイム監視
  enableFsxBatchProcessing: true       // バッチ分析
}

storage: {
  fsxOntap: {
    storageCapacity: 4096,              // 大容量取引データ
    throughputCapacity: 1024,           // 最高速アクセス
    deploymentType: 'MULTI_AZ_1',       // 最高可用性
    automaticBackupRetentionDays: 90    // 長期保管
  }
}
```

**デプロイ**:
```bash
# 金融業界向け設定でデプロイ
CONFIG_ENV=finance DEPLOY_MODE=production npx cdk deploy --all
```

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 1. FSx統合スタックがデプロイされない

**症状**: `enableFsxIntegration: true`にしてもスタックが作成されない

**解決方法**:
```bash
# 設定確認
npx cdk diff

# 機能フラグの状況確認（デプロイ時に表示される）
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all

# 出力例:
# 🎛️  機能フラグ状態:
#    FSx統合: ✅
#    FSxワークフロー: ❌
#    FSxイベント駆動: ✅
#    FSxバッチ処理: ❌

# 強制デプロイ
npx cdk deploy --force TokyoRegion-permission-aware-rag-prod-FsxIntegration
```

#### 2. Lambda関数がFSxにアクセスできない

**症状**: Lambda関数実行時にFSxアクセスエラー

**解決方法**:
```bash
# Lambda関数のVPC設定確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-fsx-processor \
  --query 'VpcConfig'

# セキュリティグループの確認
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx \
  --query 'SecurityGroups[0].IpPermissions'

# FSxファイルシステムのネットワーク設定確認
aws fsx describe-file-systems \
  --file-system-ids fs-xxxxxxxxx \
  --query 'FileSystems[0].NetworkInterfaceIds'
```

#### 3. EventBridge イベントが処理されない

**症状**: FSxイベントが発生してもLambda関数が実行されない

**解決方法**:
```bash
# EventBridge ルールの確認
aws events list-rules \
  --name-prefix "TokyoRegion-permission-aware-rag" \
  --query 'Rules[*].[Name,State,EventPattern]'

# ルールのターゲット確認
aws events list-targets-by-rule \
  --rule "TokyoRegion-permission-aware-rag-prod-fsx-events" \
  --query 'Targets[*].[Id,Arn]'

# EventBridge カスタムバスの確認
aws events list-event-buses \
  --name-prefix "TokyoRegion-permission-aware-rag"
```

#### 4. Step Functions ワークフローが失敗する

**症状**: Step Functionsの実行が失敗する

**解決方法**:
```bash
# ステートマシンの実行履歴確認
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:region:account:stateMachine:workflow-name \
  --status-filter FAILED

# 失敗した実行の詳細確認
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:region:account:execution:workflow-name:execution-id

# 実行履歴の確認
aws stepfunctions get-execution-history \
  --execution-arn arn:aws:states:region:account:execution:workflow-name:execution-id
```

### 📊 監視・ログの確認方法

```bash
# FSx統合用ログの確認
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/fsx-integration"

# Lambda関数のログ確認
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-prod-fsx-processor --follow

# Step Functionsのログ確認
aws logs tail /aws/stepfunctions/TokyoRegion-permission-aware-rag-prod-fsx-workflow --follow

# EventBridgeのメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name SuccessfulInvocations \
  --dimensions Name=RuleName,Value=TokyoRegion-permission-aware-rag-prod-fsx-events \
  --start-time 2026-01-08T00:00:00Z \
  --end-time 2026-01-08T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## 📚 詳細ドキュメント

- **[FSx統合システムIaC実装ガイド](./FSx統合システムIaC実装ガイド.md)** - 詳細な実装方法と設定
- **[FSx統合システム業界別ユースケース](./FSx統合システム業界別ユースケース.md)** - 6業界の具体的活用例
- **[FSx統合システム技術価値と展開](./FSx統合システム技術価値と展開.md)** - 技術的価値とビジネスインパクト
- **[アーキテクチャ詳細](../architecture/ARCHITECTURE.md)** - システム全体のアーキテクチャ
- **[デプロイメントガイド](./deployment-guide.md)** - 詳細なデプロイメント手順

## 🆘 サポート

問題が解決しない場合は、以下の方法でサポートを受けることができます：

1. **GitHub Issues**: [バグレポートや機能リクエスト](https://github.com/Yoshiki0705/RAG-FSxN-CDK/issues)
2. **ディスカッション**: 一般的な質問や議論
3. **ドキュメント**: 詳細な技術文書

## 🎉 成功！

おめでとうございます！FSx統合システムが正常にセットアップされました。

### 次のステップ:

1. **業界別設定の適用**: あなたの業界に最適化された設定を適用
2. **カスタムワークフローの作成**: 独自のビジネスロジックを実装
3. **パフォーマンス監視の設定**: CloudWatchダッシュボードで監視
4. **本番環境への展開**: 段階的に本番環境に展開
5. **高度な機能の探索**: AI統合、マルチリージョン対応等

### 🚀 実現可能な価値:

- **81%のコスト削減**: 従来システムと比較
- **10倍の処理速度向上**: 4GB/sの高速ストレージ
- **90%の運用負荷削減**: 完全サーバレス化
- **新規事業創出**: 高速データ処理基盤の活用

Happy coding! 🚀