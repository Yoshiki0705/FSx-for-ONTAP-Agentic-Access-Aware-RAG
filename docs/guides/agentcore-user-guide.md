# Amazon Bedrock AgentCore - エンドユーザー向けガイド

**作成日**: 2026-01-07  
**最終更新**: 2026-01-07  
**対象読者**: エンドユーザー、開発者、システム管理者  
**目的**: AgentCore機能の使い方を理解し、効果的に活用する

---

## 📋 目次

1. [AgentCoreとは](#agentcoreとは)
2. [AgentCore Runtime - サーバーレス実行環境](#agentcore-runtime---サーバーレス実行環境)
3. [AgentCore Gateway - API/Lambda/MCP変換](#agentcore-gateway---apilambdamcp変換)
4. [AgentCore Memory - メモリ管理](#agentcore-memory---メモリ管理)
5. [AgentCore Identity - ID・アクセス管理](#agentcore-identity---idアクセス管理)
6. [AgentCore Browser - クラウドブラウザ](#agentcore-browser---クラウドブラウザ)
7. [AgentCore Code Interpreter - コード実行](#agentcore-code-interpreter---コード実行)
8. [AgentCore Observability - 監視・トレーシング](#agentcore-observability---監視トレーシング)
9. [AgentCore Evaluations - 品質評価](#agentcore-evaluations---品質評価)
10. [AgentCore Policy - ポリシー管理](#agentcore-policy---ポリシー管理)
11. [ベストプラクティス](#ベストプラクティス)
12. [制限事項と注意点](#制限事項と注意点)
13. [トラブルシューティング](#トラブルシューティング)

---

## AgentCoreとは

### 概要

Amazon Bedrock AgentCoreは、エンタープライズグレードのAIエージェントを構築・デプロイ・運用するための包括的なプラットフォームです。9つのコアサービスで構成され、それぞれが特定の機能を提供します。

### 9つのコアサービス

| サービス | 機能 | 主な用途 |
|---------|------|---------|
| **Runtime** | サーバーレス実行環境 | エージェントの実行・スケーリング |
| **Gateway** | API/Lambda/MCP変換 | 既存システムの統合 |
| **Memory** | メモリ管理 | 会話履歴・長期記憶 |
| **Identity** | ID・アクセス管理 | 認証・認可 |
| **Browser** | クラウドブラウザ | Web操作・スクレイピング |
| **Code Interpreter** | コード実行 | データ分析・計算 |
| **Observability** | 監視・トレーシング | パフォーマンス監視 |
| **Evaluations** | 品質評価 | エージェント品質測定 |
| **Policy** | ポリシー管理 | アクセス制御 |

### 利用可能リージョン

- **US East (N. Virginia)** - us-east-1
- **US West (Oregon)** - us-west-2
- **Asia Pacific (Sydney)** - ap-southeast-2
- **Europe (Frankfurt)** - eu-central-1


---

## AgentCore Runtime - サーバーレス実行環境

### 概要

AgentCore Runtimeは、AIエージェントをセキュアなサーバーレス環境で実行するための基盤です。イベント駆動型アーキテクチャ、自動スケーリング、セキュアな実行環境を提供します。

### 主な機能

#### 1. イベント駆動実行

**説明**: Lambda統合により、イベントに応じてエージェントを自動実行します。

**使い方**:
```typescript
// エージェント実行リクエスト
const request = {
  agentId: 'agent-12345',
  sessionId: 'session-67890',
  input: {
    text: 'こんにちは、今日の天気を教えてください',
    context: {
      location: 'Tokyo',
      language: 'ja'
    }
  }
};

// Lambda関数を呼び出し
const response = await lambda.invoke({
  FunctionName: 'AgentCoreRuntime',
  Payload: JSON.stringify(request)
}).promise();
```

**ユースケース**:
- チャットボットの応答生成
- 定期的なレポート作成
- イベント駆動のデータ処理

#### 2. 自動スケーリング

**説明**: 負荷に応じて自動的にLambda関数のインスタンス数を調整します。

**設定例**:
```json
{
  "bedrockAgentCore": {
    "runtime": {
      "autoScaling": {
        "enabled": true,
        "minCapacity": 1,
        "maxCapacity": 10,
        "targetUtilization": 0.7
      }
    }
  }
}
```

**メリット**:
- コスト最適化（使用量ベース課金）
- 高可用性（自動フェイルオーバー）
- パフォーマンス維持（負荷分散）

#### 3. セキュアな実行環境

**説明**: VPC統合、KMS暗号化、IAMロールによるセキュアな実行環境を提供します。

**セキュリティ機能**:
- **VPC統合**: プライベートネットワーク内で実行
- **KMS暗号化**: 環境変数の暗号化
- **IAMロール**: 最小権限の原則に基づくアクセス制御

### 実際の使用例

#### 例1: カスタマーサポートチャットボット

**シナリオ**: 顧客からの問い合わせに自動応答するチャットボット

**実装**:
```typescript
// 1. エージェント設定
const agentConfig = {
  agentId: 'customer-support-agent',
  model: 'anthropic.claude-3-sonnet',
  instructions: '顧客の問い合わせに丁寧に回答してください'
};

// 2. Runtime実行
const response = await runtimeClient.executeAgent({
  agentId: agentConfig.agentId,
  sessionId: customerId,
  input: {
    text: customerQuestion,
    context: {
      customerHistory: await getCustomerHistory(customerId),
      productCatalog: await getProductCatalog()
    }
  }
});

// 3. 応答を返す
return response.output.text;
```

**メリット**:
- 24時間365日対応
- 即座の応答
- コスト削減（人件費削減）

#### 例2: 定期レポート自動生成

**シナリオ**: 毎日午前9時に売上レポートを自動生成

**実装**:
```typescript
// EventBridge Ruleで定期実行
const rule = new events.Rule(this, 'DailyReportRule', {
  schedule: events.Schedule.cron({ hour: '0', minute: '0' }), // UTC 0:00 = JST 9:00
  targets: [new targets.LambdaFunction(runtimeLambda)]
});

// Lambda関数内でレポート生成
async function generateDailyReport() {
  const salesData = await getSalesData(yesterday);
  const report = await runtimeClient.executeAgent({
    agentId: 'report-generator-agent',
    input: {
      text: '昨日の売上データを分析してレポートを作成してください',
      context: { salesData }
    }
  });
  
  await sendReportEmail(report.output.text);
}
```

**メリット**:
- 自動化による工数削減
- 一貫性のあるレポート
- タイムリーな情報提供

#### 例3: リアルタイムデータ処理

**シナリオ**: IoTセンサーからのデータをリアルタイムで分析

**実装**:
```typescript
// IoTデータストリームからイベント受信
const iotRule = new iot.TopicRule(this, 'SensorDataRule', {
  sql: iot.IotSql.fromStringAsVer20160323(
    "SELECT * FROM 'sensors/+/data'"
  ),
  actions: [
    new actions.LambdaFunctionAction(runtimeLambda)
  ]
});

// Lambda関数内でデータ分析
async function analyzeSensorData(event) {
  const sensorData = JSON.parse(event.body);
  const analysis = await runtimeClient.executeAgent({
    agentId: 'sensor-analysis-agent',
    input: {
      text: 'センサーデータを分析して異常を検出してください',
      context: { sensorData }
    }
  });
  
  if (analysis.output.anomalyDetected) {
    await sendAlert(analysis.output.details);
  }
}
```

**メリット**:
- リアルタイム処理
- 異常の早期検出
- 自動アラート

### ベストプラクティス

1. **適切なタイムアウト設定**: 処理時間に応じて30-300秒の範囲で設定
2. **メモリサイズの最適化**: 1024MB-3008MBの範囲で調整
3. **エラーハンドリング**: DLQ（Dead Letter Queue）を設定
4. **ログ記録**: CloudWatch Logsで実行ログを記録
5. **コスト監視**: CloudWatch Metricsでコストを監視

### 制限事項

- **最大実行時間**: 15分（Lambda制限）
- **最大メモリ**: 10GB（Lambda制限）
- **同時実行数**: アカウント制限に依存（デフォルト1000）
- **ペイロードサイズ**: 6MB（同期）、256KB（非同期）


---

## AgentCore Gateway - API/Lambda/MCP変換

### 概要

AgentCore Gatewayは、既存のAPI、Lambda関数、MCPサーバーをBedrock Agent互換のツール定義に変換する機能です。既存システムを再利用し、統合を簡素化します。

### 主な機能

#### 1. REST API変換

**説明**: OpenAPI仕様からBedrock Agent Tool定義を自動生成します。

**使い方**:
```typescript
// OpenAPI仕様を用意
const openApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Weather API', version: '1.0.0' },
  paths: {
    '/weather': {
      get: {
        summary: '天気情報を取得',
        parameters: [
          { name: 'city', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: '成功' }
        }
      }
    }
  }
};

// Gateway経由で変換
const toolDefinition = await gatewayClient.convertRestApi({
  openApiSpec: JSON.stringify(openApiSpec),
  authentication: {
    type: 'API_KEY',
    secretArn: 'arn:aws:secretsmanager:...'
  }
});

// Bedrock Agentに登録
await bedrockAgent.addTool(toolDefinition);
```

**ユースケース**:
- 外部APIの統合（天気、ニュース、株価等）
- 社内APIの統合（CRM、ERP等）
- サードパーティサービスの統合

#### 2. Lambda関数変換

**説明**: 既存のLambda関数をBedrock Agent Toolに変換します。

**使い方**:
```typescript
// Lambda関数ARNを指定
const lambdaArn = 'arn:aws:lambda:ap-northeast-1:123456789012:function:MyFunction';

// Gateway経由で変換
const toolDefinition = await gatewayClient.convertLambdaFunction({
  functionArn: lambdaArn,
  autoDiscovery: true, // CloudFormationスタックから自動検出
  schemaGeneration: 'auto' // 自動スキーマ生成
});

// Bedrock Agentに登録
await bedrockAgent.addTool(toolDefinition);
```

**ユースケース**:
- 既存のビジネスロジックの再利用
- データベースアクセス機能の統合
- 複雑な計算処理の統合

#### 3. MCPサーバー統合

**説明**: Model Context Protocol（MCP）サーバーをBedrock Agentに統合します。

**使い方**:
```typescript
// MCPサーバーエンドポイントを指定
const mcpServerUrl = 'https://mcp-server.example.com';

// Gateway経由で統合
const toolDefinitions = await gatewayClient.integrateMcpServer({
  serverUrl: mcpServerUrl,
  authentication: {
    type: 'OAUTH2',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    tokenUrl: 'https://auth.example.com/token'
  },
  toolFilter: ['tool1', 'tool2'] // 特定のツールのみ統合
});

// Bedrock Agentに登録
for (const tool of toolDefinitions) {
  await bedrockAgent.addTool(tool);
}
```

**ユースケース**:
- MCPプロトコル対応ツールの統合
- 複数のMCPサーバーの統合
- カスタムツールの開発・統合

### 実際の使用例

#### 例1: 天気APIの統合

**シナリオ**: OpenWeatherMap APIをエージェントに統合

**実装**:
```typescript
// 1. OpenAPI仕様を定義
const weatherApiSpec = {
  openapi: '3.0.0',
  info: { title: 'OpenWeatherMap API', version: '1.0.0' },
  servers: [{ url: 'https://api.openweathermap.org/data/2.5' }],
  paths: {
    '/weather': {
      get: {
        summary: '現在の天気を取得',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: '都市名' },
          { name: 'appid', in: 'query', required: true, schema: { type: 'string' }, description: 'APIキー' }
        ]
      }
    }
  }
};

// 2. Gateway経由で変換
const weatherTool = await gatewayClient.convertRestApi({
  openApiSpec: JSON.stringify(weatherApiSpec),
  authentication: {
    type: 'API_KEY',
    secretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:openweathermap-api-key'
  }
});

// 3. エージェントで使用
const response = await agentClient.executeAgent({
  agentId: 'weather-agent',
  input: {
    text: '東京の天気を教えてください'
  }
});
// エージェントが自動的にweatherToolを呼び出し、天気情報を取得
```

**メリット**:
- コード不要でAPI統合
- 認証情報の安全な管理
- エージェントが自動的にツールを選択

#### 例2: 社内データベース検索機能の統合

**シナリオ**: 既存のLambda関数（顧客情報検索）をエージェントに統合

**実装**:
```typescript
// 既存のLambda関数
// lambda/customer-search/index.ts
export async function handler(event) {
  const { customerId } = event;
  const customer = await dynamodb.get({
    TableName: 'Customers',
    Key: { id: customerId }
  }).promise();
  return customer.Item;
}

// Gateway経由で変換
const customerSearchTool = await gatewayClient.convertLambdaFunction({
  functionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:CustomerSearch',
  schemaGeneration: 'tags', // Lambda関数のタグからスキーマ生成
  tags: {
    'tool:inputSchema': JSON.stringify({
      type: 'object',
      properties: {
        customerId: { type: 'string', description: '顧客ID' }
      },
      required: ['customerId']
    })
  }
});

// エージェントで使用
const response = await agentClient.executeAgent({
  agentId: 'customer-support-agent',
  input: {
    text: '顧客ID 12345の情報を教えてください'
  }
});
// エージェントが自動的にcustomerSearchToolを呼び出し、顧客情報を取得
```

**メリット**:
- 既存のLambda関数を再利用
- データベースアクセスロジックの統合
- セキュアなデータアクセス

#### 例3: 複数のMCPサーバーの統合

**シナリオ**: 社内の複数のMCPサーバー（CRM、ERP、在庫管理）を統合

**実装**:
```typescript
// 複数のMCPサーバーを統合
const mcpServers = [
  { name: 'CRM', url: 'https://crm-mcp.example.com' },
  { name: 'ERP', url: 'https://erp-mcp.example.com' },
  { name: 'Inventory', url: 'https://inventory-mcp.example.com' }
];

for (const server of mcpServers) {
  const tools = await gatewayClient.integrateMcpServer({
    serverUrl: server.url,
    authentication: {
      type: 'OAUTH2',
      clientId: process.env[`${server.name}_CLIENT_ID`],
      clientSecret: process.env[`${server.name}_CLIENT_SECRET`],
      tokenUrl: `https://auth.example.com/${server.name.toLowerCase()}/token`
    }
  });
  
  for (const tool of tools) {
    await bedrockAgent.addTool(tool);
  }
}

// エージェントで使用
const response = await agentClient.executeAgent({
  agentId: 'business-intelligence-agent',
  input: {
    text: '今月の売上と在庫状況を教えてください'
  }
});
// エージェントが自動的にCRM、ERP、在庫管理のツールを呼び出し、情報を統合
```

**メリット**:
- 複数システムの統合
- 統一されたインターフェース
- 自動的なツール選択

### ベストプラクティス

1. **OpenAPI仕様の詳細化**: 詳細な説明とパラメータ定義を記述
2. **認証情報の安全な管理**: Secrets Managerを使用
3. **エラーハンドリング**: API呼び出しのエラーを適切に処理
4. **レート制限の設定**: API呼び出しのレート制限を設定
5. **ツール名の命名規則**: 分かりやすいツール名を使用

### 制限事項

- **OpenAPI仕様**: OpenAPI 3.0以降のみサポート
- **Lambda関数**: Node.js 20.x、Python 3.11以降のみサポート
- **MCPサーバー**: HTTP/HTTPSエンドポイントのみサポート（WebSocketは制限あり）
- **認証**: API_KEY、OAuth2、NONEのみサポート


---

## AgentCore Memory - メモリ管理

### 概要

AgentCore Memoryは、AIエージェントの短期・長期メモリを管理する完全マネージドサービスです。会話履歴の保持、重要情報の長期記憶、セマンティック検索を提供します。

### 主な機能

#### 1. 短期メモリ（Events）

**説明**: セッション内の会話履歴を自動管理します。

**使い方**:
```typescript
// 会話メッセージを記録
await memoryClient.writeEvent({
  memoryId: 'memory-12345',
  actorId: 'user-67890',
  sessionId: 'session-abc',
  content: {
    text: 'こんにちは、今日の予定を教えてください',
    role: 'USER'
  }
});

// 最新の会話履歴を取得（最新5ターン）
const recentTurns = await memoryClient.getLastKTurns({
  memoryId: 'memory-12345',
  actorId: 'user-67890',
  sessionId: 'session-abc',
  k: 5
});
```

**ユースケース**:
- チャットボットの会話履歴管理
- コンテキストを保持した応答生成
- セッション内の情報共有

#### 2. 長期メモリ（Records）

**説明**: 重要な情報を自動抽出し、長期記憶として保存します。

**使い方**:
```typescript
// Memory Strategyを設定（自動抽出）
const memoryConfig = {
  name: 'customer-memory',
  strategies: [
    {
      type: 'SEMANTIC',
      name: 'customer-preferences',
      namespaces: ['/preferences', '/history']
    },
    {
      type: 'SUMMARY',
      name: 'conversation-summary',
      namespaces: ['/summaries']
    }
  ]
};

// Memory Resourceを作成
const memory = await memoryClient.createMemory(memoryConfig);

// 長期メモリを検索
const memories = await memoryClient.searchLongTermMemories({
  memoryId: memory.id,
  actorId: 'user-67890',
  query: '顧客の好みの商品カテゴリ',
  topK: 5
});
```

**ユースケース**:
- ユーザーの好みの記憶
- 過去の購入履歴の保存
- 重要な会話内容の記録

#### 3. Memory Strategies（組み込み戦略）

**説明**: 3つの組み込み戦略で自動的に情報を抽出・整理します。

**戦略の種類**:

1. **Semantic Strategy**: 事実情報を抽出
   ```typescript
   {
     type: 'SEMANTIC',
     name: 'facts-extraction',
     namespaces: ['/facts', '/entities']
   }
   ```

2. **Summary Strategy**: 会話を要約
   ```typescript
   {
     type: 'SUMMARY',
     name: 'session-summary',
     namespaces: ['/summaries']
   }
   ```

3. **User Preference Strategy**: ユーザーの好みを抽出
   ```typescript
   {
     type: 'USER_PREFERENCE',
     name: 'user-preferences',
     namespaces: ['/preferences']
   }
   ```

### 実際の使用例

#### 例1: パーソナライズされたショッピングアシスタント

**シナリオ**: ユーザーの好みを記憶し、パーソナライズされた商品推薦を提供

**実装**:
```typescript
// 1. Memory Resourceを作成
const shoppingMemory = await memoryClient.createMemory({
  name: 'shopping-assistant-memory',
  strategies: [
    {
      type: 'USER_PREFERENCE',
      name: 'product-preferences',
      namespaces: ['/preferences/products', '/preferences/brands']
    },
    {
      type: 'SEMANTIC',
      name: 'purchase-history',
      namespaces: ['/history/purchases']
    }
  ]
});

// 2. 会話を記録
await memoryClient.writeEvent({
  memoryId: shoppingMemory.id,
  actorId: userId,
  sessionId: sessionId,
  content: {
    text: 'スニーカーを探しています。Nikeが好きです。',
    role: 'USER'
  }
});

// 3. エージェントが自動的に好みを抽出・保存
// （Memory Strategyが自動実行）

// 4. 次回の会話で好みを活用
const preferences = await memoryClient.searchLongTermMemories({
  memoryId: shoppingMemory.id,
  actorId: userId,
  query: 'ユーザーの好きなブランド',
  topK: 3
});

// 5. パーソナライズされた推薦
const response = await agentClient.executeAgent({
  agentId: 'shopping-assistant',
  input: {
    text: '新しいスニーカーを見せてください',
    context: {
      userPreferences: preferences
    }
  }
});
// エージェントがNikeのスニーカーを優先的に推薦
```

**メリット**:
- ユーザー体験の向上
- 購入率の向上
- リピート率の向上

#### 例2: カスタマーサポートの履歴管理

**シナリオ**: 顧客の問い合わせ履歴を記録し、継続的なサポートを提供

**実装**:
```typescript
// 1. Memory Resourceを作成
const supportMemory = await memoryClient.createMemory({
  name: 'customer-support-memory',
  strategies: [
    {
      type: 'SEMANTIC',
      name: 'issue-tracking',
      namespaces: ['/issues', '/resolutions']
    },
    {
      type: 'SUMMARY',
      name: 'conversation-summary',
      namespaces: ['/summaries']
    }
  ]
});

// 2. 問い合わせを記録
await memoryClient.writeEvent({
  memoryId: supportMemory.id,
  actorId: customerId,
  sessionId: ticketId,
  content: {
    text: '商品が届きません。注文番号は12345です。',
    role: 'USER'
  }
});

// 3. サポート担当者の応答を記録
await memoryClient.writeEvent({
  memoryId: supportMemory.id,
  actorId: customerId,
  sessionId: ticketId,
  content: {
    text: '配送状況を確認します。現在、配送センターにあります。',
    role: 'ASSISTANT'
  }
});

// 4. 次回の問い合わせで履歴を参照
const issueHistory = await memoryClient.searchLongTermMemories({
  memoryId: supportMemory.id,
  actorId: customerId,
  query: '過去の配送問題',
  topK: 5
});

// 5. 継続的なサポート
const response = await agentClient.executeAgent({
  agentId: 'support-agent',
  input: {
    text: '前回の注文の件ですが...',
    context: {
      issueHistory: issueHistory
    }
  }
});
// エージェントが過去の問題を理解し、適切に対応
```

**メリット**:
- 顧客満足度の向上
- サポート効率の向上
- 問題の早期解決

#### 例3: 教育アシスタントの学習履歴管理

**シナリオ**: 学生の学習履歴を記録し、パーソナライズされた学習支援を提供

**実装**:
```typescript
// 1. Memory Resourceを作成
const learningMemory = await memoryClient.createMemory({
  name: 'learning-assistant-memory',
  strategies: [
    {
      type: 'SEMANTIC',
      name: 'knowledge-tracking',
      namespaces: ['/knowledge/mastered', '/knowledge/struggling']
    },
    {
      type: 'USER_PREFERENCE',
      name: 'learning-style',
      namespaces: ['/preferences/learning-style']
    }
  ]
});

// 2. 学習セッションを記録
await memoryClient.writeEvent({
  memoryId: learningMemory.id,
  actorId: studentId,
  sessionId: lessonId,
  content: {
    text: '二次方程式の解き方を教えてください',
    role: 'USER'
  }
});

// 3. 学習進捗を記録
await memoryClient.writeEvent({
  memoryId: learningMemory.id,
  actorId: studentId,
  sessionId: lessonId,
  content: {
    text: '二次方程式の解き方を理解しました。練習問題を解きます。',
    role: 'USER',
    metadata: {
      topic: '二次方程式',
      masteryLevel: 'intermediate'
    }
  }
});

// 4. 次回のレッスンで学習履歴を活用
const learningHistory = await memoryClient.searchLongTermMemories({
  memoryId: learningMemory.id,
  actorId: studentId,
  query: '学習済みのトピック',
  topK: 10
});

// 5. パーソナライズされた学習支援
const response = await agentClient.executeAgent({
  agentId: 'learning-assistant',
  input: {
    text: '次に何を学べばいいですか？',
    context: {
      learningHistory: learningHistory
    }
  }
});
// エージェントが学習履歴に基づいて次のトピックを提案
```

**メリット**:
- 学習効率の向上
- パーソナライズされた学習体験
- 学習進捗の可視化

### ベストプラクティス

1. **適切なMemory Strategyの選択**: ユースケースに応じて戦略を選択
2. **Namespaceの設計**: 情報を整理しやすいNamespace構造を設計
3. **定期的なメモリのクリーンアップ**: 不要な情報を削除
4. **セマンティック検索の活用**: 関連情報を効率的に取得
5. **プライバシーの考慮**: 個人情報の取り扱いに注意

### 制限事項

- **Event保持期間**: デフォルト90日（設定可能）
- **Record数**: アカウント制限に依存
- **検索結果数**: 最大100件
- **Namespace深さ**: 最大10階層


---

## AgentCore Identity - ID・アクセス管理

### 概要

AgentCore Identityは、エージェントの認証・認可を一元管理するサービスです。エージェントID管理、RBAC/ABAC、OAuth 2.0統合を提供します。

### 主な機能

#### 1. エージェントID管理

**説明**: 各エージェントに一意のIDを割り当て、メタデータを管理します。

**使い方**:
```typescript
// エージェントを作成
const agent = await identityClient.createAgent({
  name: 'customer-support-agent',
  description: 'カスタマーサポート用エージェント',
  metadata: {
    owner: 'support-team',
    project: 'customer-service',
    environment: 'production'
  }
});

// エージェントIDが自動生成される
console.log(agent.agentId); // 'agent-12345678-abcd-...'

// エージェント情報を取得
const agentInfo = await identityClient.getAgent(agent.agentId);
```

**ユースケース**:
- エージェントの一元管理
- エージェントの監査証跡
- エージェントのライフサイクル管理

#### 2. アクセス管理（RBAC/ABAC）

**説明**: ロールベース（RBAC）と属性ベース（ABAC）のアクセス制御を提供します。

**RBAC（ロールベースアクセス制御）**:
```typescript
// ロールを定義
const roles = {
  ADMIN: {
    permissions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE']
  },
  DEVELOPER: {
    permissions: ['READ', 'EXECUTE']
  },
  USER: {
    permissions: ['READ']
  }
};

// エージェントにロールを割り当て
await identityClient.assignRole({
  agentId: agent.agentId,
  role: 'DEVELOPER'
});

// アクセス権限をチェック
const hasPermission = await identityClient.checkPermission({
  agentId: agent.agentId,
  resource: 'customer-database',
  action: 'READ'
});
```

**ABAC（属性ベースアクセス制御）**:
```typescript
// 属性ベースのポリシーを定義
const policy = {
  effect: 'ALLOW',
  actions: ['READ'],
  resources: ['customer-database'],
  conditions: {
    'agent.department': 'support',
    'agent.environment': 'production',
    'resource.sensitivity': 'low'
  }
};

// ポリシーを適用
await identityClient.applyPolicy({
  agentId: agent.agentId,
  policy: policy
});
```

**ユースケース**:
- きめ細かなアクセス制御
- 部門別のアクセス管理
- 環境別のアクセス制御

#### 3. 認証統合（Cognito・JWT）

**説明**: Amazon CognitoとJWTトークンによる認証を提供します。

**使い方**:
```typescript
// Cognito User Poolを統合
const cognitoConfig = {
  userPoolId: 'ap-northeast-1_XXXXXXXXX',
  clientId: 'your-client-id',
  region: 'ap-northeast-1'
};

// ユーザー認証
const authResult = await identityClient.authenticateUser({
  username: 'user@example.com',
  password: 'password123',
  cognitoConfig: cognitoConfig
});

// JWTトークンを取得
const jwtToken = authResult.idToken;

// エージェント実行時にトークンを使用
const response = await agentClient.executeAgent({
  agentId: agent.agentId,
  input: { text: 'こんにちは' },
  authentication: {
    type: 'JWT',
    token: jwtToken
  }
});
```

**ユースケース**:
- ユーザー認証
- シングルサインオン（SSO）
- トークンベースの認証

### 実際の使用例

#### 例1: 部門別アクセス制御

**シナリオ**: 営業部門と開発部門で異なるデータへのアクセスを制御

**実装**:
```typescript
// 営業部門のエージェント
const salesAgent = await identityClient.createAgent({
  name: 'sales-agent',
  metadata: {
    department: 'sales',
    environment: 'production'
  }
});

// 営業部門のポリシー
await identityClient.applyPolicy({
  agentId: salesAgent.agentId,
  policy: {
    effect: 'ALLOW',
    actions: ['READ', 'UPDATE'],
    resources: ['customer-database', 'sales-reports'],
    conditions: {
      'agent.department': 'sales'
    }
  }
});

// 開発部門のエージェント
const devAgent = await identityClient.createAgent({
  name: 'dev-agent',
  metadata: {
    department: 'development',
    environment: 'development'
  }
});

// 開発部門のポリシー
await identityClient.applyPolicy({
  agentId: devAgent.agentId,
  policy: {
    effect: 'ALLOW',
    actions: ['READ'],
    resources: ['test-database', 'development-logs'],
    conditions: {
      'agent.department': 'development',
      'agent.environment': 'development'
    }
  }
});

// アクセス権限のチェック
const salesCanAccessCustomerDB = await identityClient.checkPermission({
  agentId: salesAgent.agentId,
  resource: 'customer-database',
  action: 'READ'
}); // true

const devCanAccessCustomerDB = await identityClient.checkPermission({
  agentId: devAgent.agentId,
  resource: 'customer-database',
  action: 'READ'
}); // false
```

**メリット**:
- 部門別のデータ分離
- セキュリティの向上
- コンプライアンスの遵守

#### 例2: 環境別アクセス制御

**シナリオ**: 本番環境と開発環境で異なるアクセス権限を設定

**実装**:
```typescript
// 本番環境のエージェント
const prodAgent = await identityClient.createAgent({
  name: 'prod-agent',
  metadata: {
    environment: 'production'
  }
});

// 本番環境のポリシー（読み取り専用）
await identityClient.applyPolicy({
  agentId: prodAgent.agentId,
  policy: {
    effect: 'ALLOW',
    actions: ['READ'],
    resources: ['production-database'],
    conditions: {
      'agent.environment': 'production'
    }
  }
});

// 開発環境のエージェント
const devAgent = await identityClient.createAgent({
  name: 'dev-agent',
  metadata: {
    environment: 'development'
  }
});

// 開発環境のポリシー（読み書き可能）
await identityClient.applyPolicy({
  agentId: devAgent.agentId,
  policy: {
    effect: 'ALLOW',
    actions: ['READ', 'UPDATE', 'DELETE'],
    resources: ['development-database'],
    conditions: {
      'agent.environment': 'development'
    }
  }
});
```

**メリット**:
- 本番環境の保護
- 開発環境での柔軟な操作
- 誤操作の防止

#### 例3: OAuth 2.0統合

**シナリオ**: 外部サービス（Google、GitHub等）の認証を統合

**実装**:
```typescript
// OAuth 2.0設定
const oauthConfig = {
  provider: 'google',
  clientId: 'your-google-client-id',
  clientSecret: 'your-google-client-secret',
  redirectUri: 'https://your-app.com/oauth/callback',
  scopes: ['openid', 'email', 'profile']
};

// OAuth 2.0認証フロー
const authUrl = await identityClient.getOAuthAuthorizationUrl(oauthConfig);
// ユーザーをauthUrlにリダイレクト

// コールバック処理
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  
  // トークンを取得
  const tokens = await identityClient.exchangeOAuthCode({
    code: code,
    config: oauthConfig
  });
  
  // ユーザー情報を取得
  const userInfo = await identityClient.getOAuthUserInfo({
    accessToken: tokens.accessToken,
    provider: 'google'
  });
  
  // エージェント実行
  const response = await agentClient.executeAgent({
    agentId: 'user-agent',
    input: { text: 'こんにちは' },
    authentication: {
      type: 'OAUTH2',
      accessToken: tokens.accessToken,
      userInfo: userInfo
    }
  });
  
  res.json(response);
});
```

**メリット**:
- 外部サービスとの統合
- ユーザー体験の向上
- セキュアな認証

### ベストプラクティス

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **定期的な権限レビュー**: 定期的にアクセス権限を見直し
3. **監査ログの記録**: 全ての認証・認可イベントを記録
4. **トークンの有効期限管理**: JWTトークンの有効期限を適切に設定
5. **多要素認証（MFA）**: 重要な操作にはMFAを要求

### 制限事項

- **エージェント数**: アカウント制限に依存
- **ポリシー数**: エージェントあたり最大100個
- **トークン有効期限**: 最大24時間
- **同時認証セッション数**: ユーザーあたり最大10セッション


---

## AgentCore Browser - クラウドブラウザ

### 概要

AgentCore Browserは、クラウドベースのヘッドレスブラウザランタイムを提供します。Webスクレイピング、スクリーンショット撮影、Web自動化を実現します。

### 主な機能

#### 1. ヘッドレスブラウザ

**説明**: Puppeteerを使用したヘッドレスChromeブラウザを提供します。

**使い方**:
```typescript
// Webページにアクセス
const result = await browserClient.navigate({
  url: 'https://example.com',
  waitFor: 'networkidle2', // ネットワークアイドル状態まで待機
  timeout: 30000 // 30秒タイムアウト
});

// ページのHTMLを取得
const html = result.html;

// ページのタイトルを取得
const title = result.title;
```

**ユースケース**:
- Webページの情報取得
- 動的コンテンツの取得
- JavaScriptレンダリング後のコンテンツ取得

#### 2. スクリーンショット撮影

**説明**: Webページのスクリーンショットを撮影し、FSx for ONTAPに保存します。

**使い方**:
```typescript
// スクリーンショットを撮影
const screenshot = await browserClient.takeScreenshot({
  url: 'https://example.com',
  format: 'png', // png, jpeg, webp
  fullPage: true, // ページ全体を撮影
  viewport: {
    width: 1920,
    height: 1080
  }
});

// スクリーンショットのS3 URLを取得
console.log(screenshot.url); // 's3://bucket/screenshots/...'

// スクリーンショットをダウンロード
const imageData = await s3.getObject({
  Bucket: 'bucket',
  Key: screenshot.key
}).promise();
```

**ユースケース**:
- Webページのアーカイブ
- レポート作成
- 視覚的な監視

#### 3. Webスクレイピング

**説明**: Webページから構造化データを抽出します。

**使い方**:
```typescript
// Webページをスクレイピング
const data = await browserClient.scrape({
  url: 'https://news.example.com',
  selectors: {
    title: 'h1.article-title',
    author: '.author-name',
    date: 'time.publish-date',
    content: '.article-content'
  },
  waitFor: 'h1.article-title' // 要素が表示されるまで待機
});

// 抽出されたデータ
console.log(data);
// {
//   title: 'ニュース記事のタイトル',
//   author: '著者名',
//   date: '2026-01-07',
//   content: '記事の本文...'
// }
```

**ユースケース**:
- ニュース記事の収集
- 価格情報の監視
- 競合分析

#### 4. Web自動化

**説明**: Webページ上での操作を自動化します。

**使い方**:
```typescript
// Web自動化ワークフロー
const result = await browserClient.automate({
  url: 'https://example.com/login',
  steps: [
    {
      type: 'TYPE',
      selector: '#username',
      value: 'user@example.com'
    },
    {
      type: 'TYPE',
      selector: '#password',
      value: 'password123'
    },
    {
      type: 'CLICK',
      selector: 'button[type="submit"]'
    },
    {
      type: 'WAIT',
      selector: '.dashboard',
      timeout: 5000
    },
    {
      type: 'SCREENSHOT',
      fullPage: true
    }
  ]
});

// 自動化の結果
console.log(result.success); // true
console.log(result.screenshot.url); // スクリーンショットのURL
```

**ユースケース**:
- フォーム入力の自動化
- E2Eテストの自動化
- 定期的なタスクの自動化

### 実際の使用例

#### 例1: ニュース記事の自動収集

**シナリオ**: 複数のニュースサイトから記事を自動収集し、要約を生成

**実装**:
```typescript
// ニュースサイトのリスト
const newsSites = [
  { name: 'Site A', url: 'https://news-a.com', selector: '.article' },
  { name: 'Site B', url: 'https://news-b.com', selector: '.news-item' },
  { name: 'Site C', url: 'https://news-c.com', selector: '.story' }
];

// 各サイトから記事を収集
const articles = [];
for (const site of newsSites) {
  const data = await browserClient.scrape({
    url: site.url,
    selectors: {
      title: `${site.selector} h2`,
      summary: `${site.selector} .summary`,
      link: `${site.selector} a`,
      date: `${site.selector} time`
    },
    multiple: true // 複数の記事を取得
  });
  
  articles.push(...data.map(article => ({
    ...article,
    source: site.name
  })));
}

// エージェントで要約を生成
const summaries = await agentClient.executeAgent({
  agentId: 'news-summarizer',
  input: {
    text: '以下のニュース記事を要約してください',
    context: { articles }
  }
});

// 要約をメールで送信
await sendEmail({
  to: 'user@example.com',
  subject: '今日のニュース要約',
  body: summaries.output.text
});
```

**メリット**:
- 情報収集の自動化
- 時間の節約
- 複数ソースの統合

#### 例2: 価格監視システム

**シナリオ**: ECサイトの商品価格を定期的に監視し、価格変動を通知

**実装**:
```typescript
// 監視する商品のリスト
const products = [
  { name: '商品A', url: 'https://shop.com/product-a', priceSelector: '.price' },
  { name: '商品B', url: 'https://shop.com/product-b', priceSelector: '.price' }
];

// 価格を取得
const prices = [];
for (const product of products) {
  const data = await browserClient.scrape({
    url: product.url,
    selectors: {
      price: product.priceSelector,
      availability: '.availability',
      rating: '.rating'
    }
  });
  
  // スクリーンショットを撮影
  const screenshot = await browserClient.takeScreenshot({
    url: product.url,
    format: 'png'
  });
  
  prices.push({
    ...product,
    ...data,
    screenshot: screenshot.url,
    timestamp: Date.now()
  });
}

// DynamoDBに保存
await dynamodb.batchWrite({
  RequestItems: {
    'PriceHistory': prices.map(p => ({
      PutRequest: { Item: p }
    }))
  }
}).promise();

// 価格変動をチェック
const priceChanges = await checkPriceChanges(prices);
if (priceChanges.length > 0) {
  await sendAlert({
    to: 'user@example.com',
    subject: '価格変動アラート',
    body: `以下の商品の価格が変動しました:\n${priceChanges.map(c => `${c.name}: ${c.oldPrice} → ${c.newPrice}`).join('\n')}`
  });
}
```

**メリット**:
- 価格変動の早期検出
- 購入タイミングの最適化
- コスト削減

#### 例3: Webアプリケーションの監視

**シナリオ**: Webアプリケーションの稼働状況を定期的に監視

**実装**:
```typescript
// 監視するページのリスト
const pages = [
  { name: 'ホームページ', url: 'https://app.example.com' },
  { name: 'ログインページ', url: 'https://app.example.com/login' },
  { name: 'ダッシュボード', url: 'https://app.example.com/dashboard' }
];

// 各ページを監視
const results = [];
for (const page of pages) {
  try {
    const startTime = Date.now();
    
    // ページにアクセス
    const result = await browserClient.navigate({
      url: page.url,
      waitFor: 'networkidle2',
      timeout: 10000
    });
    
    const loadTime = Date.now() - startTime;
    
    // スクリーンショットを撮影
    const screenshot = await browserClient.takeScreenshot({
      url: page.url,
      format: 'png'
    });
    
    results.push({
      name: page.name,
      url: page.url,
      status: 'UP',
      loadTime: loadTime,
      screenshot: screenshot.url,
      timestamp: Date.now()
    });
  } catch (error) {
    results.push({
      name: page.name,
      url: page.url,
      status: 'DOWN',
      error: error.message,
      timestamp: Date.now()
    });
    
    // アラートを送信
    await sendAlert({
      to: 'ops@example.com',
      subject: `[ALERT] ${page.name}がダウンしています`,
      body: `エラー: ${error.message}`
    });
  }
}

// CloudWatch Metricsに記録
for (const result of results) {
  await cloudwatch.putMetricData({
    Namespace: 'WebMonitoring',
    MetricData: [
      {
        MetricName: 'PageLoadTime',
        Value: result.loadTime || 0,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'PageName', Value: result.name }
        ]
      },
      {
        MetricName: 'PageStatus',
        Value: result.status === 'UP' ? 1 : 0,
        Unit: 'Count',
        Dimensions: [
          { Name: 'PageName', Value: result.name }
        ]
      }
    ]
  }).promise();
}
```

**メリット**:
- 稼働状況の可視化
- 障害の早期検出
- SLA遵守の確認

### ベストプラクティス

1. **レート制限の遵守**: robots.txtを尊重し、適切なレート制限を設定
2. **タイムアウトの設定**: 適切なタイムアウトを設定（10-30秒）
3. **エラーハンドリング**: ネットワークエラーやタイムアウトを適切に処理
4. **スクリーンショットの管理**: 定期的に古いスクリーンショットを削除
5. **User-Agentの設定**: 適切なUser-Agentを設定

### 制限事項

- **最大実行時間**: 5分（Lambda制限）
- **メモリサイズ**: 最大3GB
- **スクリーンショットサイズ**: 最大10MB
- **同時実行数**: アカウント制限に依存


---

## AgentCore Code Interpreter - コード実行

### 概要

AgentCore Code Interpreterは、サンドボックス環境でPythonとJavaScriptコードを安全に実行するサービスです。データ分析、計算、可視化を実現します。

### 主な機能

#### 1. サンドボックス環境

**説明**: 隔離されたECS Fargateコンテナでコードを実行します。

**セキュリティ機能**:
- **ファイルシステム制限**: /tmp以外は読み取り専用
- **ネットワーク制限**: ホワイトリストのエンドポイントのみアクセス可能
- **プロセス制限**: 最大10プロセス
- **リソース制限**: 2GB メモリ、1 vCPU、300秒タイムアウト

**使い方**:
```typescript
// Pythonコードを実行
const result = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import numpy as np
import pandas as pd

# データ分析
data = [1, 2, 3, 4, 5]
mean = np.mean(data)
std = np.std(data)

print(f"平均: {mean}, 標準偏差: {std}")
  `,
  timeout: 60 // 60秒タイムアウト
});

// 実行結果
console.log(result.output.stdout); // '平均: 3.0, 標準偏差: 1.4142135623730951'
console.log(result.metrics.executionTime); // 実行時間（ミリ秒）
```

**ユースケース**:
- データ分析
- 数値計算
- アルゴリズムの実行

#### 2. 多言語サポート

**説明**: Python 3.11とNode.js 20.xをサポートします。

**Python実行**:
```typescript
const pythonResult = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import matplotlib.pyplot as plt
import numpy as np

# グラフを作成
x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.plot(x, y)
plt.title('Sine Wave')
plt.savefig('/tmp/sine_wave.png')

print('グラフを作成しました')
  `,
  packages: ['matplotlib', 'numpy'] // 追加パッケージ
});
```

**JavaScript実行**:
```typescript
const jsResult = await codeInterpreterClient.execute({
  language: 'JAVASCRIPT',
  code: `
const lodash = require('lodash');

// データ処理
const data = [1, 2, 3, 4, 5];
const sum = lodash.sum(data);
const mean = lodash.mean(data);

console.log(\`合計: \${sum}, 平均: \${mean}\`);
  `,
  packages: ['lodash'] // 追加パッケージ
});
```

**ユースケース**:
- Python: データ分析、機械学習、科学計算
- JavaScript: Web API呼び出し、JSON処理、非同期処理

#### 3. パッケージ管理

**説明**: pipとnpmによる追加パッケージのインストールをサポートします。

**プリインストールパッケージ**:

**Python**:
- numpy: 数値計算
- pandas: データ分析
- matplotlib: グラフ作成
- scikit-learn: 機械学習
- requests: HTTP通信

**JavaScript**:
- lodash: ユーティリティ関数
- axios: HTTP通信
- moment: 日付処理
- uuid: UUID生成

**追加パッケージのインストール**:
```typescript
// Pythonパッケージを追加
const result = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import seaborn as sns
import pandas as pd

# データを可視化
data = pd.DataFrame({
    'x': [1, 2, 3, 4, 5],
    'y': [2, 4, 6, 8, 10]
})

sns.scatterplot(data=data, x='x', y='y')
plt.savefig('/tmp/scatter.png')
  `,
  packages: ['seaborn'] // seabornを追加インストール
});
```

**ユースケース**:
- 特定のライブラリを使用したデータ分析
- カスタムパッケージの利用

#### 4. FSx for ONTAPマウント

**説明**: 大規模データセットにアクセスするためにFSx for ONTAPをマウントします。

**使い方**:
```typescript
// FSx for ONTAPマウントを有効化
const result = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import pandas as pd

# FSx for ONTAPからデータを読み込み
data = pd.read_csv('/mnt/fsx/datasets/sales_data.csv')

# データ分析
summary = data.describe()
print(summary)

# 結果を保存
summary.to_csv('/mnt/fsx/results/summary.csv')
  `,
  fsxOntapMount: {
    enabled: true,
    mountPath: '/mnt/fsx',
    readOnly: false
  }
});
```

**ユースケース**:
- 大規模データセットの分析
- 複数のジョブ間でのデータ共有
- 結果の永続化

### 実際の使用例

#### 例1: 売上データの分析とレポート生成

**シナリオ**: 月次売上データを分析し、グラフ付きレポートを生成

**実装**:
```typescript
// 売上データを取得
const salesData = await getSalesData('2026-01');

// Pythonで分析
const analysisResult = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import pandas as pd
import matplotlib.pyplot as plt
import json

# データを読み込み
data = json.loads('${JSON.stringify(salesData)}')
df = pd.DataFrame(data)

# 分析
total_sales = df['amount'].sum()
avg_sales = df['amount'].mean()
top_products = df.groupby('product')['amount'].sum().sort_values(ascending=False).head(5)

# グラフを作成
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# 売上推移
df.groupby('date')['amount'].sum().plot(ax=ax1)
ax1.set_title('日次売上推移')
ax1.set_xlabel('日付')
ax1.set_ylabel('売上額')

# トップ5商品
top_products.plot(kind='bar', ax=ax2)
ax2.set_title('トップ5商品')
ax2.set_xlabel('商品')
ax2.set_ylabel('売上額')

plt.tight_layout()
plt.savefig('/tmp/sales_report.png')

# 結果を出力
print(json.dumps({
    'total_sales': float(total_sales),
    'avg_sales': float(avg_sales),
    'top_products': top_products.to_dict()
}))
  `,
  packages: ['pandas', 'matplotlib']
});

// 結果を解析
const analysis = JSON.parse(analysisResult.output.stdout);

// エージェントでレポートを生成
const report = await agentClient.executeAgent({
  agentId: 'report-generator',
  input: {
    text: '以下の売上分析結果からレポートを作成してください',
    context: {
      analysis: analysis,
      chartUrl: analysisResult.files['/tmp/sales_report.png']
    }
  }
});

// レポートをメールで送信
await sendEmail({
  to: 'manager@example.com',
  subject: '月次売上レポート',
  body: report.output.text,
  attachments: [
    { filename: 'sales_report.png', path: analysisResult.files['/tmp/sales_report.png'] }
  ]
});
```

**メリット**:
- 自動化されたレポート生成
- データ駆動の意思決定
- 時間の節約

#### 例2: 機械学習モデルの推論

**シナリオ**: 事前学習済みモデルを使用して顧客の離脱予測

**実装**:
```typescript
// 顧客データを取得
const customerData = await getCustomerData();

// Pythonで推論
const predictionResult = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import pandas as pd
import pickle
import json

# モデルを読み込み（FSx for ONTAPから）
with open('/mnt/fsx/models/churn_model.pkl', 'rb') as f:
    model = pickle.load(f)

# データを読み込み
data = json.loads('${JSON.stringify(customerData)}')
df = pd.DataFrame(data)

# 特徴量エンジニアリング
features = df[['age', 'tenure', 'monthly_charges', 'total_charges']]

# 推論
predictions = model.predict_proba(features)
churn_probability = predictions[:, 1]

# 結果を出力
results = []
for i, (customer_id, prob) in enumerate(zip(df['customer_id'], churn_probability)):
    results.append({
        'customer_id': customer_id,
        'churn_probability': float(prob),
        'risk_level': 'HIGH' if prob > 0.7 else 'MEDIUM' if prob > 0.4 else 'LOW'
    })

print(json.dumps(results))
  `,
  packages: ['pandas', 'scikit-learn'],
  fsxOntapMount: {
    enabled: true,
    mountPath: '/mnt/fsx',
    readOnly: true
  }
});

// 結果を解析
const predictions = JSON.parse(predictionResult.output.stdout);

// 高リスク顧客にアラート
const highRiskCustomers = predictions.filter(p => p.risk_level === 'HIGH');
if (highRiskCustomers.length > 0) {
  await sendAlert({
    to: 'retention-team@example.com',
    subject: '離脱リスクの高い顧客アラート',
    body: `以下の${highRiskCustomers.length}名の顧客が離脱リスクが高いです:\n${highRiskCustomers.map(c => `顧客ID: ${c.customer_id}, 確率: ${(c.churn_probability * 100).toFixed(1)}%`).join('\n')}`
  });
}
```

**メリット**:
- 予測分析の自動化
- 顧客離脱の早期検出
- 保持率の向上

#### 例3: データ変換とETL処理

**シナリオ**: 複数のデータソースからデータを抽出・変換・ロード

**実装**:
```typescript
// ETL処理
const etlResult = await codeInterpreterClient.execute({
  language: 'PYTHON',
  code: `
import pandas as pd
import json

# データソース1: CSV（FSx for ONTAP）
sales_data = pd.read_csv('/mnt/fsx/raw/sales.csv')

# データソース2: JSON（S3）
customer_data = pd.read_json('/mnt/fsx/raw/customers.json')

# データソース3: Parquet（FSx for ONTAP）
product_data = pd.read_parquet('/mnt/fsx/raw/products.parquet')

# データ変換
# 1. 日付型に変換
sales_data['date'] = pd.to_datetime(sales_data['date'])

# 2. 欠損値を処理
sales_data['amount'].fillna(0, inplace=True)

# 3. データを結合
merged_data = sales_data.merge(customer_data, on='customer_id', how='left')
merged_data = merged_data.merge(product_data, on='product_id', how='left')

# 4. 集計
summary = merged_data.groupby(['customer_segment', 'product_category']).agg({
    'amount': ['sum', 'mean', 'count']
}).reset_index()

# 5. 結果を保存
summary.to_csv('/mnt/fsx/processed/sales_summary.csv', index=False)
merged_data.to_parquet('/mnt/fsx/processed/sales_detailed.parquet', index=False)

print(json.dumps({
    'total_records': len(merged_data),
    'summary_records': len(summary),
    'total_sales': float(merged_data['amount'].sum())
}))
  `,
  packages: ['pandas', 'pyarrow'],
  fsxOntapMount: {
    enabled: true,
    mountPath: '/mnt/fsx',
    readOnly: false
  },
  timeout: 300 // 5分タイムアウト
});

// 結果を解析
const etlSummary = JSON.parse(etlResult.output.stdout);

// 処理完了を通知
await sendNotification({
  to: 'data-team@example.com',
  subject: 'ETL処理完了',
  body: `ETL処理が完了しました。\n総レコード数: ${etlSummary.total_records}\n総売上: ${etlSummary.total_sales}`
});
```

**メリット**:
- データ処理の自動化
- 複数データソースの統合
- データ品質の向上

### ベストプラクティス

1. **適切なタイムアウト設定**: 処理時間に応じて60-300秒の範囲で設定
2. **エラーハンドリング**: try-catchでエラーを適切に処理
3. **リソース管理**: 大規模データ処理時はメモリ使用量に注意
4. **セキュリティ**: 機密情報をコードに直接埋め込まない
5. **ログ記録**: 実行ログを記録し、デバッグに活用

### 制限事項

- **最大実行時間**: 300秒（5分）
- **最大メモリ**: 2GB
- **最大CPU**: 1 vCPU
- **ファイルシステム**: /tmp以外は読み取り専用
- **ネットワーク**: ホワイトリストのエンドポイントのみアクセス可能


---

## AgentCore Observability - 監視・トレーシング

### 概要

AgentCore Observabilityは、エージェントの実行フローを可視化し、パフォーマンスを監視するサービスです。X-Ray統合、CloudWatch統合、カスタムメトリクスを提供します。

### 主な機能

#### 1. 分散トレーシング（X-Ray）

**説明**: AWS X-Rayによる詳細な実行フローの可視化を提供します。

**使い方**:
```typescript
// X-Ray統合を有効化
const observabilityConfig = {
  tracing: {
    xrayIntegration: true,
    samplingRate: 0.1, // 10%のリクエストをトレース
    detailedTracing: true
  }
};

// エージェント実行（自動的にトレース）
const response = await agentClient.executeAgent({
  agentId: 'my-agent',
  input: { text: 'こんにちは' }
});

// X-Rayコンソールでトレースを確認
// - エージェント実行時間
// - 各ツール呼び出しの時間
// - 外部API呼び出しの時間
// - エラーの発生箇所
```

**トレース情報**:
- **セグメント**: エージェント実行全体
- **サブセグメント**: ツール呼び出し、API呼び出し
- **アノテーション**: agentId, sessionId, userId
- **メタデータ**: リクエスト/レスポンスペイロード

**ユースケース**:
- パフォーマンスボトルネックの特定
- エラーの根本原因分析
- 実行フローの可視化

#### 2. カスタムメトリクス（CloudWatch）

**説明**: CloudWatch Metricsによるカスタムメトリクスの記録を提供します。

**使い方**:
```typescript
// カスタムメトリクスを記録
await observabilityClient.putMetric({
  namespace: 'AWS/Bedrock/AgentCore',
  metricName: 'ExecutionLatency',
  value: 1234, // ミリ秒
  unit: 'Milliseconds',
  dimensions: [
    { name: 'AgentId', value: 'my-agent' },
    { name: 'Environment', value: 'production' }
  ]
});

// メトリクスを取得
const metrics = await observabilityClient.getMetrics({
  namespace: 'AWS/Bedrock/AgentCore',
  metricName: 'ExecutionLatency',
  startTime: new Date(Date.now() - 3600000), // 1時間前
  endTime: new Date(),
  period: 300, // 5分間隔
  statistics: ['Average', 'Maximum', 'Minimum']
});
```

**標準メトリクス**:
- **ExecutionLatency**: 実行時間（ミリ秒）
- **ErrorRate**: エラー率（エラー数/分）
- **TokenCount**: トークン使用量
- **Cost**: コスト（USD）

**ユースケース**:
- パフォーマンス監視
- コスト監視
- エラー率監視

#### 3. ダッシュボード（CloudWatch Dashboard）

**説明**: CloudWatch Dashboardによる可視化を提供します。

**使い方**:
```typescript
// ダッシュボードを作成
const dashboard = await observabilityClient.createDashboard({
  dashboardName: 'AgentCore-Production',
  widgets: [
    {
      type: 'metric',
      title: 'エージェント実行時間',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'ExecutionLatency', { stat: 'Average' }]
      ]
    },
    {
      type: 'metric',
      title: 'エラー率',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'ErrorRate', { stat: 'Sum' }]
      ]
    },
    {
      type: 'metric',
      title: 'トークン使用量',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'TokenCount', { stat: 'Sum' }]
      ]
    },
    {
      type: 'metric',
      title: 'コスト',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'Cost', { stat: 'Sum' }]
      ]
    }
  ]
});
```

**ダッシュボードウィジェット**:
- **メトリクスグラフ**: 時系列データの可視化
- **数値**: 現在の値の表示
- **ログインサイト**: ログクエリの結果表示

**ユースケース**:
- リアルタイム監視
- パフォーマンストレンドの分析
- 異常検知

#### 4. アラーム（CloudWatch Alarms）

**説明**: CloudWatch Alarmsによる自動アラートを提供します。

**使い方**:
```typescript
// アラームを作成
const alarm = await observabilityClient.createAlarm({
  alarmName: 'HighLatency',
  metricName: 'ExecutionLatency',
  namespace: 'AWS/Bedrock/AgentCore',
  statistic: 'Average',
  period: 300, // 5分
  evaluationPeriods: 2, // 2回連続
  threshold: 5000, // 5秒
  comparisonOperator: 'GreaterThanThreshold',
  actionsEnabled: true,
  alarmActions: [
    'arn:aws:sns:ap-northeast-1:123456789012:ops-alerts'
  ]
});
```

**標準アラーム**:
- **HighLatency**: 実行時間が5秒を超える
- **HighErrorRate**: エラー率が10エラー/分を超える
- **HighCost**: コストが$100/時を超える

**ユースケース**:
- 異常の早期検出
- 自動アラート
- SLA遵守の確認

### 実際の使用例

#### 例1: パフォーマンス監視ダッシュボード

**シナリオ**: エージェントのパフォーマンスをリアルタイムで監視

**実装**:
```typescript
// ダッシュボードを作成
const dashboard = await observabilityClient.createDashboard({
  dashboardName: 'AgentCore-Performance',
  widgets: [
    // レイテンシグラフ
    {
      type: 'metric',
      title: 'エージェント実行時間（P50, P90, P99）',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'ExecutionLatency', { stat: 'p50', label: 'P50' }],
        ['...', { stat: 'p90', label: 'P90' }],
        ['...', { stat: 'p99', label: 'P99' }]
      ],
      period: 300,
      yAxis: { left: { min: 0 } }
    },
    // スループットグラフ
    {
      type: 'metric',
      title: 'リクエスト数',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'RequestCount', { stat: 'Sum' }]
      ],
      period: 60
    },
    // エラー率グラフ
    {
      type: 'metric',
      title: 'エラー率',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'ErrorRate', { stat: 'Sum' }]
      ],
      period: 300
    },
    // コストグラフ
    {
      type: 'metric',
      title: '時間あたりコスト',
      metrics: [
        ['AWS/Bedrock/AgentCore', 'Cost', { stat: 'Sum' }]
      ],
      period: 3600
    }
  ]
});

// アラームを設定
const alarms = [
  {
    name: 'HighLatency-P99',
    metric: 'ExecutionLatency',
    statistic: 'p99',
    threshold: 10000, // 10秒
    evaluationPeriods: 2
  },
  {
    name: 'HighErrorRate',
    metric: 'ErrorRate',
    statistic: 'Sum',
    threshold: 10, // 10エラー/5分
    evaluationPeriods: 2
  },
  {
    name: 'HighCost',
    metric: 'Cost',
    statistic: 'Sum',
    threshold: 100, // $100/時
    evaluationPeriods: 1
  }
];

for (const alarmConfig of alarms) {
  await observabilityClient.createAlarm({
    alarmName: alarmConfig.name,
    metricName: alarmConfig.metric,
    namespace: 'AWS/Bedrock/AgentCore',
    statistic: alarmConfig.statistic,
    period: 300,
    evaluationPeriods: alarmConfig.evaluationPeriods,
    threshold: alarmConfig.threshold,
    comparisonOperator: 'GreaterThanThreshold',
    alarmActions: ['arn:aws:sns:ap-northeast-1:123456789012:ops-alerts']
  });
}
```

**メリット**:
- リアルタイム監視
- 異常の早期検出
- パフォーマンストレンドの把握

#### 例2: エラー追跡とデバッグ

**シナリオ**: エラーの根本原因を特定し、迅速に解決

**実装**:
```typescript
// X-Rayトレースからエラーを検索
const traces = await observabilityClient.getTraces({
  filterExpression: 'error = true AND service("bedrock-agent-core")',
  startTime: new Date(Date.now() - 3600000), // 1時間前
  endTime: new Date()
});

// エラーパターンを分析
const errorPatterns = {};
for (const trace of traces) {
  const errorType = trace.error.type;
  if (!errorPatterns[errorType]) {
    errorPatterns[errorType] = {
      count: 0,
      examples: []
    };
  }
  errorPatterns[errorType].count++;
  if (errorPatterns[errorType].examples.length < 5) {
    errorPatterns[errorType].examples.push({
      traceId: trace.id,
      timestamp: trace.timestamp,
      message: trace.error.message,
      stackTrace: trace.error.stackTrace
    });
  }
}

// エラーレポートを生成
const errorReport = Object.entries(errorPatterns)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([type, data]) => ({
    errorType: type,
    count: data.count,
    examples: data.examples
  }));

// エージェントでレポートを生成
const report = await agentClient.executeAgent({
  agentId: 'error-analyzer',
  input: {
    text: '以下のエラーパターンを分析し、解決策を提案してください',
    context: { errorReport }
  }
});

// レポートを送信
await sendEmail({
  to: 'dev-team@example.com',
  subject: 'エラー分析レポート',
  body: report.output.text
});
```

**メリット**:
- エラーの早期検出
- 根本原因の特定
- 迅速な問題解決

#### 例3: コスト最適化

**シナリオ**: エージェントのコストを監視し、最適化の機会を特定

**実装**:
```typescript
// コストメトリクスを取得
const costMetrics = await observabilityClient.getMetrics({
  namespace: 'AWS/Bedrock/AgentCore',
  metricName: 'Cost',
  startTime: new Date(Date.now() - 86400000 * 30), // 30日前
  endTime: new Date(),
  period: 86400, // 1日
  statistics: ['Sum'],
  dimensions: [
    { name: 'AgentId', value: '*' } // 全エージェント
  ]
});

// エージェント別コストを集計
const costByAgent = {};
for (const datapoint of costMetrics.datapoints) {
  const agentId = datapoint.dimensions.find(d => d.name === 'AgentId').value;
  if (!costByAgent[agentId]) {
    costByAgent[agentId] = 0;
  }
  costByAgent[agentId] += datapoint.value;
}

// コストが高いエージェントを特定
const topCostAgents = Object.entries(costByAgent)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

// 最適化提案を生成
const optimizationReport = await agentClient.executeAgent({
  agentId: 'cost-optimizer',
  input: {
    text: '以下のエージェントのコストを分析し、最適化の提案をしてください',
    context: { topCostAgents }
  }
});

// レポートを送信
await sendEmail({
  to: 'finance-team@example.com',
  subject: 'コスト最適化レポート',
  body: optimizationReport.output.text
});
```

**メリット**:
- コストの可視化
- 最適化の機会の特定
- コスト削減

### ベストプラクティス

1. **適切なサンプリングレート**: X-Rayのサンプリングレートを10-20%に設定
2. **メトリクスの定期的なレビュー**: 週次でメトリクスをレビュー
3. **アラームの適切な設定**: 誤検知を避けるため、適切な閾値を設定
4. **ログの保持期間**: 30日間のログ保持を推奨
5. **ダッシュボードの共有**: チーム全体でダッシュボードを共有

### 制限事項

- **X-Rayトレース保持期間**: 30日
- **CloudWatch Logsログ保持期間**: 設定可能（デフォルト30日）
- **カスタムメトリクス数**: アカウント制限に依存
- **ダッシュボード数**: リージョンあたり最大500個


---

## AgentCore Evaluations - 品質評価

### 概要

AgentCore Evaluationsは、エージェントの品質を定量的に評価するサービスです。13の組み込み評価器、A/Bテスト、パフォーマンス評価を提供します。

### 主な機能

#### 1. 13の組み込み評価器

**説明**: 多角的な品質測定を提供します。

**評価器の種類**:

1. **Accuracy（正確性）**: 回答の正確さ
2. **Relevance（関連性）**: 質問との関連度
3. **Helpfulness（有用性）**: ユーザーへの有用性
4. **Consistency（一貫性）**: 回答の一貫性
5. **Completeness（完全性）**: 情報の完全性
6. **Clarity（明確性）**: 回答の明確さ
7. **Conciseness（簡潔性）**: 回答の簡潔さ
8. **Tone（トーン）**: 回答のトーン
9. **Safety（安全性）**: 有害コンテンツの検出
10. **Bias（バイアス）**: バイアスの検出
11. **Factuality（事実性）**: 事実の正確性
12. **Coherence（一貫性）**: 論理的一貫性
13. **Fluency（流暢性）**: 言語の流暢さ

**使い方**:
```typescript
// エージェントの応答を評価
const evaluation = await evaluationsClient.evaluate({
  agentId: 'my-agent',
  input: '東京の人口を教えてください',
  output: '東京の人口は約1400万人です。',
  evaluators: [
    'Accuracy',
    'Relevance',
    'Helpfulness',
    'Completeness'
  ]
});

// 評価結果
console.log(evaluation.scores);
// {
//   Accuracy: { score: 0.95, confidence: 0.9 },
//   Relevance: { score: 1.0, confidence: 0.95 },
//   Helpfulness: { score: 0.9, confidence: 0.85 },
//   Completeness: { score: 0.8, confidence: 0.8 }
// }
```

**ユースケース**:
- エージェント品質の測定
- 品質トレンドの追跡
- 改善箇所の特定

#### 2. A/Bテスト

**説明**: 複数のエージェントバージョンを比較し、最適なバージョンを特定します。

**使い方**:
```typescript
// A/Bテストを開始
const abTest = await evaluationsClient.startABTest({
  name: 'Agent Model Comparison',
  variants: [
    {
      name: 'Variant A',
      agentId: 'agent-claude-3-sonnet',
      weight: 0.5 // 50%のトラフィック
    },
    {
      name: 'Variant B',
      agentId: 'agent-claude-3-opus',
      weight: 0.5 // 50%のトラフィック
    }
  ],
  sampleSize: 1000, // 1000リクエスト
  confidenceLevel: 0.95, // 95%信頼水準
  evaluators: ['Accuracy', 'Relevance', 'Helpfulness']
});

// テスト実行中...

// テスト結果を取得
const results = await evaluationsClient.getABTestResults(abTest.id);

// 統計的有意性をチェック
if (results.statisticalSignificance) {
  console.log(`勝者: ${results.winner.name}`);
  console.log(`改善率: ${results.improvement}%`);
  
  // 勝者を本番環境にデプロイ
  await deployToProduction(results.winner.agentId);
}
```

**ユースケース**:
- モデルの比較
- プロンプトの最適化
- パラメータチューニング

#### 3. パフォーマンス評価

**説明**: レイテンシ、スループット、コストを測定します。

**使い方**:
```typescript
// パフォーマンステストを実行
const perfTest = await evaluationsClient.runPerformanceTest({
  agentId: 'my-agent',
  testCases: [
    { input: '簡単な質問', expectedLatency: 1000 },
    { input: '複雑な質問で長い応答が必要', expectedLatency: 3000 }
  ],
  concurrency: 10, // 10並列リクエスト
  duration: 300 // 5分間
});

// パフォーマンスメトリクス
console.log(perfTest.metrics);
// {
//   latency: {
//     p50: 1234,
//     p90: 2345,
//     p99: 3456
//   },
//   throughput: 100, // リクエスト/秒
//   errorRate: 0.01, // 1%
//   cost: 0.05 // $0.05/リクエスト
// }
```

**ユースケース**:
- パフォーマンスベンチマーク
- スケーラビリティテスト
- コスト分析

### 実際の使用例

#### 例1: エージェント品質の継続的監視

**シナリオ**: 本番環境のエージェント品質を継続的に監視

**実装**:
```typescript
// 定期的に品質評価を実行（1時間ごと）
setInterval(async () => {
  // 最近のエージェント応答を取得
  const recentResponses = await getRecentResponses('my-agent', 100);
  
  // 各応答を評価
  const evaluations = [];
  for (const response of recentResponses) {
    const evaluation = await evaluationsClient.evaluate({
      agentId: 'my-agent',
      input: response.input,
      output: response.output,
      evaluators: [
        'Accuracy',
        'Relevance',
        'Helpfulness',
        'Safety',
        'Bias'
      ]
    });
    evaluations.push(evaluation);
  }
  
  // 平均スコアを計算
  const avgScores = {};
  for (const evaluator of ['Accuracy', 'Relevance', 'Helpfulness', 'Safety', 'Bias']) {
    const scores = evaluations.map(e => e.scores[evaluator].score);
    avgScores[evaluator] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  // CloudWatch Metricsに記録
  for (const [evaluator, score] of Object.entries(avgScores)) {
    await cloudwatch.putMetricData({
      Namespace: 'AgentCore/Quality',
      MetricData: [{
        MetricName: evaluator,
        Value: score,
        Unit: 'None',
        Dimensions: [
          { Name: 'AgentId', Value: 'my-agent' }
        ]
      }]
    }).promise();
  }
  
  // 品質が低下した場合はアラート
  if (avgScores.Accuracy < 0.8 || avgScores.Safety < 0.9) {
    await sendAlert({
      to: 'quality-team@example.com',
      subject: 'エージェント品質低下アラート',
      body: `エージェントの品質が低下しています:\n${JSON.stringify(avgScores, null, 2)}`
    });
  }
}, 3600000); // 1時間ごと
```

**メリット**:
- 品質の継続的監視
- 品質低下の早期検出
- データ駆動の改善

#### 例2: プロンプト最適化のA/Bテスト

**シナリオ**: 複数のプロンプトを比較し、最適なプロンプトを特定

**実装**:
```typescript
// プロンプトバリエーションを定義
const prompts = [
  {
    name: 'Prompt A - Simple',
    instructions: 'ユーザーの質問に簡潔に答えてください。'
  },
  {
    name: 'Prompt B - Detailed',
    instructions: 'ユーザーの質問に詳細に答えてください。具体例を含めてください。'
  },
  {
    name: 'Prompt C - Friendly',
    instructions: 'ユーザーの質問にフレンドリーに答えてください。絵文字を使ってください。'
  }
];

// 各プロンプトでエージェントを作成
const agents = [];
for (const prompt of prompts) {
  const agent = await bedrockAgent.createAgent({
    name: `test-agent-${prompt.name}`,
    instructions: prompt.instructions,
    model: 'anthropic.claude-3-sonnet'
  });
  agents.push({ name: prompt.name, agentId: agent.id });
}

// A/Bテストを開始
const abTest = await evaluationsClient.startABTest({
  name: 'Prompt Optimization',
  variants: agents.map(a => ({
    name: a.name,
    agentId: a.agentId,
    weight: 1 / agents.length
  })),
  sampleSize: 300, // 各バリアント100リクエスト
  confidenceLevel: 0.95,
  evaluators: ['Accuracy', 'Relevance', 'Helpfulness', 'Clarity']
});

// テスト実行（自動的にトラフィックを分散）
// ...

// テスト結果を取得
const results = await evaluationsClient.getABTestResults(abTest.id);

// 結果を分析
console.log('A/Bテスト結果:');
for (const variant of results.variants) {
  console.log(`${variant.name}:`);
  console.log(`  平均スコア: ${variant.avgScore}`);
  console.log(`  Accuracy: ${variant.scores.Accuracy}`);
  console.log(`  Relevance: ${variant.scores.Relevance}`);
  console.log(`  Helpfulness: ${variant.scores.Helpfulness}`);
  console.log(`  Clarity: ${variant.scores.Clarity}`);
}

if (results.statisticalSignificance) {
  console.log(`\n勝者: ${results.winner.name}`);
  console.log(`改善率: ${results.improvement}%`);
  
  // 勝者のプロンプトを本番環境に適用
  await updateProductionAgent({
    agentId: 'production-agent',
    instructions: prompts.find(p => p.name === results.winner.name).instructions
  });
}
```

**メリット**:
- データ駆動のプロンプト最適化
- 統計的に有意な改善の確認
- 継続的な品質向上

#### 例3: パフォーマンスベンチマーク

**シナリオ**: 複数のモデルのパフォーマンスを比較

**実装**:
```typescript
// テストするモデルのリスト
const models = [
  { name: 'Claude 3 Sonnet', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
  { name: 'Claude 3 Opus', modelId: 'anthropic.claude-3-opus-20240229-v1:0' },
  { name: 'Claude 3 Haiku', modelId: 'anthropic.claude-3-haiku-20240307-v1:0' }
];

// 各モデルでパフォーマンステストを実行
const benchmarkResults = [];
for (const model of models) {
  // エージェントを作成
  const agent = await bedrockAgent.createAgent({
    name: `benchmark-${model.name}`,
    model: model.modelId,
    instructions: 'ユーザーの質問に答えてください。'
  });
  
  // パフォーマンステストを実行
  const perfTest = await evaluationsClient.runPerformanceTest({
    agentId: agent.id,
    testCases: [
      { input: '簡単な質問', category: 'simple' },
      { input: '複雑な質問で長い応答が必要', category: 'complex' },
      { input: '技術的な質問', category: 'technical' }
    ],
    concurrency: 10,
    duration: 300 // 5分間
  });
  
  benchmarkResults.push({
    model: model.name,
    metrics: perfTest.metrics
  });
}

// 結果を比較
console.log('パフォーマンスベンチマーク結果:');
console.log('モデル\t\tP50\tP90\tP99\tスループット\tコスト');
for (const result of benchmarkResults) {
  console.log(`${result.model}\t${result.metrics.latency.p50}ms\t${result.metrics.latency.p90}ms\t${result.metrics.latency.p99}ms\t${result.metrics.throughput}req/s\t$${result.metrics.cost}/req`);
}

// 最適なモデルを選択
const bestModel = benchmarkResults.reduce((best, current) => {
  // コストパフォーマンスで比較（レイテンシ/コスト）
  const bestScore = best.metrics.latency.p90 / best.metrics.cost;
  const currentScore = current.metrics.latency.p90 / current.metrics.cost;
  return currentScore < bestScore ? current : best;
});

console.log(`\n最適なモデル: ${bestModel.model}`);
```

**メリット**:
- モデルの客観的比較
- コストパフォーマンスの最適化
- データ駆動のモデル選択

### ベストプラクティス

1. **定期的な品質評価**: 週次で品質評価を実施
2. **A/Bテストの適切な設計**: 十分なサンプルサイズと信頼水準を設定
3. **複数の評価器の使用**: 多角的な品質測定
4. **評価結果の記録**: DynamoDBやFSx for ONTAPに保存
5. **継続的な改善**: 評価結果に基づいて継続的に改善

### 制限事項

- **評価器数**: 最大13個
- **A/Bテストバリアント数**: 最大10個
- **パフォーマンステスト期間**: 最大1時間
- **同時実行数**: アカウント制限に依存


---

## AgentCore Policy - ポリシー管理

### 概要

AgentCore Policyは、自然言語でアクセスポリシーを定義し、Cedar統合による形式的検証を提供するサービスです。ポリシー作成の簡素化、形式的検証、一元管理を実現します。

### 主な機能

#### 1. 自然言語ポリシー

**説明**: 平易な言語でポリシーを定義し、自動的にCedar Policy Languageに変換します。

**使い方**:
```typescript
// 自然言語でポリシーを定義
const policy = await policyClient.createPolicy({
  name: 'read-only-policy',
  naturalLanguage: `
営業部門のユーザーは、顧客データベースを読み取ることができます。
ただし、機密情報フィールドは除外されます。
  `
});

// 自動的にCedarポリシーに変換される
console.log(policy.cedarPolicy);
// permit(
//   principal in Department::"sales",
//   action == Action::"read",
//   resource in Database::"customer"
// ) when {
//   resource.sensitivity != "confidential"
// };
```

**ユースケース**:
- 非技術者によるポリシー作成
- ポリシーの迅速な作成
- ポリシーの可読性向上

#### 2. ポリシーテンプレート

**説明**: 一般的なポリシーパターンのテンプレートを提供します。

**テンプレートの種類**:

1. **allow-read-only**: 読み取り専用アクセス
   ```typescript
   const policy = await policyClient.createFromTemplate({
     template: 'allow-read-only',
     parameters: {
       principal: 'Department::sales',
       resource: 'Database::customer'
     }
   });
   ```

2. **allow-admin**: 管理者アクセス
   ```typescript
   const policy = await policyClient.createFromTemplate({
     template: 'allow-admin',
     parameters: {
       principal: 'Role::admin',
       resource: 'System::*'
     }
   });
   ```

3. **deny-sensitive-data**: 機密データへのアクセス拒否
   ```typescript
   const policy = await policyClient.createFromTemplate({
     template: 'deny-sensitive-data',
     parameters: {
       principal: 'Department::*',
       resource: 'Database::customer',
       sensitivityLevel: 'confidential'
     }
   });
   ```

**ユースケース**:
- 標準的なポリシーの迅速な作成
- ポリシーの一貫性確保
- ベストプラクティスの適用

#### 3. Cedar統合

**説明**: Cedar Policy Languageによる形式的検証とポリシー管理を提供します。

**使い方**:
```typescript
// Cedarポリシーを検証
const validation = await policyClient.validatePolicy({
  cedarPolicy: `
permit(
  principal in Department::"sales",
  action == Action::"read",
  resource in Database::"customer"
);
  `
});

if (!validation.valid) {
  console.error('ポリシーエラー:', validation.errors);
}

// ポリシーの競合を検出
const conflicts = await policyClient.detectConflicts({
  policies: [policy1, policy2, policy3]
});

if (conflicts.length > 0) {
  console.warn('ポリシー競合:', conflicts);
}

// ポリシーを評価
const decision = await policyClient.evaluatePolicy({
  principal: 'User::john@example.com',
  action: 'read',
  resource: 'Database::customer::record-123',
  context: {
    department: 'sales',
    environment: 'production'
  }
});

console.log(decision.decision); // 'ALLOW' or 'DENY'
console.log(decision.reasons); // 決定理由
```

**ユースケース**:
- ポリシーの形式的検証
- ポリシー競合の検出
- アクセス決定の評価

#### 4. 監査ログ

**説明**: 全てのポリシー変更とアクセス決定を記録します。

**使い方**:
```typescript
// 監査ログを取得
const auditLogs = await policyClient.getAuditLogs({
  startTime: new Date(Date.now() - 86400000), // 24時間前
  endTime: new Date(),
  eventTypes: ['POLICY_CREATED', 'POLICY_UPDATED', 'POLICY_DELETED', 'ACCESS_DECISION']
});

// ログを分析
for (const log of auditLogs) {
  console.log(`${log.timestamp}: ${log.eventType}`);
  console.log(`  ユーザー: ${log.user}`);
  console.log(`  詳細: ${JSON.stringify(log.details)}`);
}
```

**ユースケース**:
- コンプライアンス監査
- セキュリティ調査
- ポリシー変更の追跡

### 実際の使用例

#### 例1: 部門別アクセスポリシー

**シナリオ**: 部門ごとに異なるデータアクセス権限を設定

**実装**:
```typescript
// 営業部門のポリシー
const salesPolicy = await policyClient.createPolicy({
  name: 'sales-department-policy',
  naturalLanguage: `
営業部門のユーザーは、顧客データベースと売上レポートを読み書きできます。
ただし、財務データは読み取り専用です。
  `
});

// 開発部門のポリシー
const devPolicy = await policyClient.createPolicy({
  name: 'dev-department-policy',
  naturalLanguage: `
開発部門のユーザーは、テストデータベースを読み書きできます。
本番データベースは読み取り専用です。
  `
});

// 財務部門のポリシー
const financePolicy = await policyClient.createPolicy({
  name: 'finance-department-policy',
  naturalLanguage: `
財務部門のユーザーは、財務データと売上レポートを読み書きできます。
顧客の個人情報は読み取り専用です。
  `
});

// ポリシーを適用
await policyClient.applyPolicies({
  policies: [salesPolicy, devPolicy, financePolicy]
});

// アクセス決定をテスト
const testCases = [
  {
    principal: 'User::john@sales.example.com',
    action: 'write',
    resource: 'Database::customer::record-123',
    context: { department: 'sales' }
  },
  {
    principal: 'User::jane@dev.example.com',
    action: 'write',
    resource: 'Database::production::table-xyz',
    context: { department: 'development' }
  },
  {
    principal: 'User::bob@finance.example.com',
    action: 'read',
    resource: 'Database::financial::report-456',
    context: { department: 'finance' }
  }
];

for (const testCase of testCases) {
  const decision = await policyClient.evaluatePolicy(testCase);
  console.log(`${testCase.principal} → ${testCase.action} → ${testCase.resource}: ${decision.decision}`);
}
```

**メリット**:
- 部門別のアクセス制御
- セキュリティの向上
- コンプライアンスの遵守

#### 例2: 環境別アクセスポリシー

**シナリオ**: 本番環境と開発環境で異なるアクセス権限を設定

**実装**:
```typescript
// 本番環境のポリシー
const prodPolicy = await policyClient.createPolicy({
  name: 'production-environment-policy',
  naturalLanguage: `
本番環境では、管理者のみがデータを変更できます。
一般ユーザーは読み取り専用です。
全ての操作は監査ログに記録されます。
  `
});

// 開発環境のポリシー
const devPolicy = await policyClient.createPolicy({
  name: 'development-environment-policy',
  naturalLanguage: `
開発環境では、開発者がデータを自由に変更できます。
テストデータのみアクセス可能です。
  `
});

// ステージング環境のポリシー
const stagingPolicy = await policyClient.createPolicy({
  name: 'staging-environment-policy',
  naturalLanguage: `
ステージング環境では、QAチームがデータを読み書きできます。
本番データのコピーにアクセス可能ですが、変更は本番に反映されません。
  `
});

// 環境ごとにポリシーを適用
await policyClient.applyPolicies({
  policies: [prodPolicy, devPolicy, stagingPolicy],
  scope: 'environment'
});

// アクセス決定をテスト
const testCases = [
  {
    principal: 'User::admin@example.com',
    action: 'write',
    resource: 'Database::production::table-xyz',
    context: { environment: 'production', role: 'admin' }
  },
  {
    principal: 'User::developer@example.com',
    action: 'write',
    resource: 'Database::production::table-xyz',
    context: { environment: 'production', role: 'developer' }
  },
  {
    principal: 'User::developer@example.com',
    action: 'write',
    resource: 'Database::development::table-xyz',
    context: { environment: 'development', role: 'developer' }
  }
];

for (const testCase of testCases) {
  const decision = await policyClient.evaluatePolicy(testCase);
  console.log(`${testCase.principal} → ${testCase.action} → ${testCase.resource} (${testCase.context.environment}): ${decision.decision}`);
}
```

**メリット**:
- 環境別のアクセス制御
- 本番環境の保護
- 開発環境での柔軟性

#### 例3: 時間ベースのアクセスポリシー

**シナリオ**: 営業時間内のみアクセスを許可

**実装**:
```typescript
// 時間ベースのポリシー
const timeBasedPolicy = await policyClient.createPolicy({
  name: 'business-hours-policy',
  naturalLanguage: `
ユーザーは、営業時間内（平日9:00-18:00）のみシステムにアクセスできます。
管理者は24時間アクセス可能です。
緊急時は、承認を得て営業時間外にアクセスできます。
  `
});

// Cedarポリシーを確認
console.log(timeBasedPolicy.cedarPolicy);
// permit(
//   principal,
//   action,
//   resource
// ) when {
//   context.role == "admin" ||
//   (context.dayOfWeek in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] &&
//    context.hour >= 9 && context.hour < 18) ||
//   context.emergencyApproval == true
// };

// アクセス決定をテスト
const now = new Date();
const testCases = [
  {
    principal: 'User::john@example.com',
    action: 'read',
    resource: 'System::dashboard',
    context: {
      role: 'user',
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      hour: now.getHours(),
      emergencyApproval: false
    }
  },
  {
    principal: 'User::admin@example.com',
    action: 'read',
    resource: 'System::dashboard',
    context: {
      role: 'admin',
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      hour: now.getHours(),
      emergencyApproval: false
    }
  }
];

for (const testCase of testCases) {
  const decision = await policyClient.evaluatePolicy(testCase);
  console.log(`${testCase.principal} (${testCase.context.role}) → ${testCase.action} → ${testCase.resource} (${testCase.context.dayOfWeek} ${testCase.context.hour}:00): ${decision.decision}`);
}
```

**メリット**:
- 時間ベースのアクセス制御
- セキュリティの向上
- コンプライアンスの遵守

### ベストプラクティス

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **ポリシーのバージョン管理**: 全てのポリシー変更をバージョン管理
3. **定期的なポリシーレビュー**: 四半期ごとにポリシーをレビュー
4. **ポリシーテストの実施**: 本番適用前にテスト環境でテスト
5. **監査ログの定期的なレビュー**: 月次で監査ログをレビュー

### 制限事項

- **ポリシー数**: アカウントあたり最大1000個
- **ポリシーサイズ**: 最大10KB
- **評価時間**: 最大100ms
- **監査ログ保持期間**: 1年


---

## ベストプラクティス

### 全般的なベストプラクティス

#### 1. セキュリティ

**原則**: 最小権限の原則を適用し、セキュアな設定を使用する

**推奨事項**:
- **IAMロール**: 最小権限のIAMロールを使用
- **暗号化**: KMS暗号化を有効化（環境変数、データ）
- **VPC統合**: プライベートリソースへのアクセスはVPC内で実行
- **認証**: 強力な認証メカニズムを使用（Cognito、OAuth 2.0）
- **監査ログ**: 全ての操作を監査ログに記録

**実装例**:
```typescript
// セキュアな設定
const secureConfig = {
  security: {
    vpcIntegration: true,
    kmsEncryption: true,
    iamRoleArn: 'arn:aws:iam::123456789012:role/MinimalPrivilegeRole'
  },
  authentication: {
    cognitoIntegration: true,
    mfaRequired: true
  },
  auditLogging: {
    enabled: true,
    retentionDays: 365
  }
};
```

#### 2. パフォーマンス

**原則**: 適切なリソース設定とキャッシング戦略を使用する

**推奨事項**:
- **タイムアウト**: 処理時間に応じて適切なタイムアウトを設定
- **メモリサイズ**: ワークロードに応じてメモリサイズを最適化
- **同時実行数**: Reserved/Provisioned Concurrencyを設定
- **キャッシング**: 頻繁にアクセスするデータをキャッシュ
- **非同期処理**: 長時間処理は非同期で実行

**実装例**:
```typescript
// パフォーマンス最適化設定
const performanceConfig = {
  runtime: {
    timeout: 60, // 60秒
    memorySize: 2048, // 2GB
    reservedConcurrency: 10,
    provisionedConcurrency: 5
  },
  caching: {
    enabled: true,
    ttl: 3600 // 1時間
  }
};
```

#### 3. コスト最適化

**原則**: 使用量を監視し、不要なリソースを削減する

**推奨事項**:
- **自動スケーリング**: 負荷に応じた自動スケーリングを設定
- **タイムアウト**: 適切なタイムアウトを設定し、無駄な実行を防ぐ
- **ログ保持期間**: 必要最小限のログ保持期間を設定
- **コスト監視**: CloudWatch Metricsでコストを監視
- **リソースのクリーンアップ**: 不要なリソースを定期的に削除

**実装例**:
```typescript
// コスト最適化設定
const costOptimizationConfig = {
  autoScaling: {
    enabled: true,
    minCapacity: 1,
    maxCapacity: 10,
    targetUtilization: 0.7
  },
  logging: {
    retentionDays: 30 // 30日
  },
  monitoring: {
    costAlerts: {
      enabled: true,
      threshold: 100 // $100/日
    }
  }
};
```

#### 4. 可観測性

**原則**: 詳細な監視とトレーシングを実装する

**推奨事項**:
- **X-Ray統合**: 分散トレーシングを有効化
- **カスタムメトリクス**: 重要なメトリクスを記録
- **ダッシュボード**: リアルタイムダッシュボードを作成
- **アラーム**: 適切なアラームを設定
- **ログ集約**: 全てのログを集約

**実装例**:
```typescript
// 可観測性設定
const observabilityConfig = {
  tracing: {
    xrayIntegration: true,
    samplingRate: 0.1
  },
  monitoring: {
    customMetrics: true,
    dashboardEnabled: true,
    alarmEnabled: true
  },
  logging: {
    logLevel: 'INFO',
    structuredLogging: true
  }
};
```

#### 5. エラーハンドリング

**原則**: 適切なエラーハンドリングとリトライ戦略を実装する

**推奨事項**:
- **エラーの分類**: エラーを適切に分類（一時的、永続的）
- **リトライ**: 一時的なエラーは指数バックオフでリトライ
- **DLQ**: 失敗したイベントをDead Letter Queueに送信
- **エラーログ**: 詳細なエラーログを記録
- **アラート**: 重大なエラーはアラートを送信

**実装例**:
```typescript
// エラーハンドリング設定
const errorHandlingConfig = {
  retry: {
    maxAttempts: 3,
    backoffRate: 2,
    initialInterval: 1000 // 1秒
  },
  dlq: {
    enabled: true,
    maxReceiveCount: 3
  },
  alerting: {
    enabled: true,
    errorThreshold: 10 // 10エラー/分
  }
};
```

### 機能別ベストプラクティス

#### Runtime

1. **適切なタイムアウト設定**: 処理時間に応じて30-300秒の範囲で設定
2. **メモリサイズの最適化**: 1024MB-3008MBの範囲で調整
3. **VPC統合**: プライベートリソースへのアクセスはVPC内で実行
4. **環境変数の暗号化**: KMS暗号化を使用
5. **DLQの設定**: 失敗したイベントをDLQに送信

#### Gateway

1. **OpenAPI仕様の詳細化**: 詳細な説明とパラメータ定義を記述
2. **認証情報の安全な管理**: Secrets Managerを使用
3. **エラーハンドリング**: API呼び出しのエラーを適切に処理
4. **レート制限の設定**: API呼び出しのレート制限を設定
5. **ツール名の命名規則**: 分かりやすいツール名を使用

#### Memory

1. **適切なMemory Strategyの選択**: ユースケースに応じて戦略を選択
2. **Namespaceの設計**: 情報を整理しやすいNamespace構造を設計
3. **定期的なメモリのクリーンアップ**: 不要な情報を削除
4. **セマンティック検索の活用**: 関連情報を効率的に取得
5. **プライバシーの考慮**: 個人情報の取り扱いに注意

#### Identity

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **定期的な権限レビュー**: 定期的にアクセス権限を見直し
3. **監査ログの記録**: 全ての認証・認可イベントを記録
4. **トークンの有効期限管理**: JWTトークンの有効期限を適切に設定
5. **多要素認証（MFA）**: 重要な操作にはMFAを要求

#### Browser

1. **レート制限の遵守**: robots.txtを尊重し、適切なレート制限を設定
2. **タイムアウトの設定**: 適切なタイムアウトを設定（10-30秒）
3. **エラーハンドリング**: ネットワークエラーやタイムアウトを適切に処理
4. **スクリーンショットの管理**: 定期的に古いスクリーンショットを削除
5. **User-Agentの設定**: 適切なUser-Agentを設定

#### Code Interpreter

1. **適切なタイムアウト設定**: 処理時間に応じて60-300秒の範囲で設定
2. **エラーハンドリング**: try-catchでエラーを適切に処理
3. **リソース管理**: 大規模データ処理時はメモリ使用量に注意
4. **セキュリティ**: 機密情報をコードに直接埋め込まない
5. **ログ記録**: 実行ログを記録し、デバッグに活用

#### Observability

1. **適切なサンプリングレート**: X-Rayのサンプリングレートを10-20%に設定
2. **メトリクスの定期的なレビュー**: 週次でメトリクスをレビュー
3. **アラームの適切な設定**: 誤検知を避けるため、適切な閾値を設定
4. **ログの保持期間**: 30日間のログ保持を推奨
5. **ダッシュボードの共有**: チーム全体でダッシュボードを共有

#### Evaluations

1. **定期的な品質評価**: 週次で品質評価を実施
2. **A/Bテストの適切な設計**: 十分なサンプルサイズと信頼水準を設定
3. **複数の評価器の使用**: 多角的な品質測定
4. **評価結果の記録**: DynamoDBやFSx for ONTAPに保存
5. **継続的な改善**: 評価結果に基づいて継続的に改善

#### Policy

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **ポリシーのバージョン管理**: 全てのポリシー変更をバージョン管理
3. **定期的なポリシーレビュー**: 四半期ごとにポリシーをレビュー
4. **ポリシーテストの実施**: 本番適用前にテスト環境でテスト
5. **監査ログの定期的なレビュー**: 月次で監査ログをレビュー

---

## 制限事項と注意点

### 全般的な制限事項

#### 1. リージョン制限

**制限**: AgentCoreは特定のリージョンでのみ利用可能

**利用可能リージョン**:
- US East (N. Virginia) - us-east-1
- US West (Oregon) - us-west-2
- Asia Pacific (Sydney) - ap-southeast-2
- Europe (Frankfurt) - eu-central-1

**注意点**:
- リージョン間のデータ転送には追加コストが発生
- レイテンシを考慮してリージョンを選択

#### 2. アカウント制限

**制限**: AWSアカウントごとに制限あり

**主な制限**:
- Lambda同時実行数: デフォルト1000（引き上げ可能）
- DynamoDBテーブル数: リージョンあたり256個
- S3バケット数: アカウントあたり100個
- CloudWatch Alarmsアラーム数: リージョンあたり5000個

**対応策**:
- Service Quotasで制限を確認
- 必要に応じて制限の引き上げをリクエスト

#### 3. コスト

**注意点**: 使用量に応じて課金される

**コスト要因**:
- Lambda実行時間・メモリ使用量
- DynamoDB読み書き容量
- S3ストレージ・リクエスト
- CloudWatch Logs・Metrics
- X-Rayトレース

**コスト最適化**:
- 不要なリソースを削除
- ログ保持期間を最適化
- 自動スケーリングを設定

### 機能別制限事項

#### Runtime

- **最大実行時間**: 15分（Lambda制限）
- **最大メモリ**: 10GB（Lambda制限）
- **同時実行数**: アカウント制限に依存（デフォルト1000）
- **ペイロードサイズ**: 6MB（同期）、256KB（非同期）

#### Gateway

- **OpenAPI仕様**: OpenAPI 3.0以降のみサポート
- **Lambda関数**: Node.js 20.x、Python 3.11以降のみサポート
- **MCPサーバー**: HTTP/HTTPSエンドポイントのみサポート（WebSocketは制限あり）
- **認証**: API_KEY、OAuth2、NONEのみサポート

#### Memory

- **Event保持期間**: デフォルト90日（設定可能）
- **Record数**: アカウント制限に依存
- **検索結果数**: 最大100件
- **Namespace深さ**: 最大10階層

#### Identity

- **エージェント数**: アカウント制限に依存
- **ポリシー数**: エージェントあたり最大100個
- **トークン有効期限**: 最大24時間
- **同時認証セッション数**: ユーザーあたり最大10セッション

#### Browser

- **最大実行時間**: 5分（Lambda制限）
- **メモリサイズ**: 最大3GB
- **スクリーンショットサイズ**: 最大10MB
- **同時実行数**: アカウント制限に依存

#### Code Interpreter

- **最大実行時間**: 300秒（5分）
- **最大メモリ**: 2GB
- **最大CPU**: 1 vCPU
- **ファイルシステム**: /tmp以外は読み取り専用
- **ネットワーク**: ホワイトリストのエンドポイントのみアクセス可能

#### Observability

- **X-Rayトレース保持期間**: 30日
- **CloudWatch Logsログ保持期間**: 設定可能（デフォルト30日）
- **カスタムメトリクス数**: アカウント制限に依存
- **ダッシュボード数**: リージョンあたり最大500個

#### Evaluations

- **評価器数**: 最大13個
- **A/Bテストバリアント数**: 最大10個
- **パフォーマンステスト期間**: 最大1時間
- **同時実行数**: アカウント制限に依存

#### Policy

- **ポリシー数**: アカウントあたり最大1000個
- **ポリシーサイズ**: 最大10KB
- **評価時間**: 最大100ms
- **監査ログ保持期間**: 1年

---

## トラブルシューティング

### 一般的な問題と解決策

#### 問題1: Lambda関数がタイムアウトする

**症状**: Lambda関数が設定されたタイムアウト時間内に完了しない

**原因**:
- 処理時間が長すぎる
- 外部APIの応答が遅い
- データベースクエリが遅い

**解決策**:
1. タイムアウト時間を延長（最大15分）
2. 処理を最適化（並列処理、キャッシング）
3. 非同期処理に変更
4. メモリサイズを増やす（CPU性能も向上）

```typescript
// タイムアウトを延長
const runtimeConfig = {
  timeout: 300, // 5分
  memorySize: 3008 // 3GB
};
```

#### 問題2: メモリ不足エラー

**症状**: Lambda関数がメモリ不足でクラッシュする

**原因**:
- 大規模データの処理
- メモリリーク
- 不適切なメモリサイズ設定

**解決策**:
1. メモリサイズを増やす
2. データをストリーミング処理
3. 不要なオブジェクトを削除
4. メモリ使用量を監視

```typescript
// メモリサイズを増やす
const runtimeConfig = {
  memorySize: 3008 // 3GB
};
```

#### 問題3: 認証エラー

**症状**: 認証が失敗する

**原因**:
- 認証情報が間違っている
- トークンが期限切れ
- IAMロールの権限不足

**解決策**:
1. 認証情報を確認
2. トークンを更新
3. IAMロールの権限を確認・追加

```typescript
// IAMロールの権限を確認
const policy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: [
        'bedrock:InvokeAgent',
        'bedrock:InvokeModel'
      ],
      Resource: '*'
    }
  ]
};
```

#### 問題4: API呼び出しが失敗する

**症状**: 外部APIの呼び出しが失敗する

**原因**:
- ネットワーク接続の問題
- APIキーが間違っている
- レート制限に達している

**解決策**:
1. ネットワーク接続を確認
2. APIキーを確認
3. レート制限を確認・調整
4. リトライロジックを実装

```typescript
// リトライロジックを実装
async function callApiWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

#### 問題5: コストが予想より高い

**症状**: 月次コストが予算を超える

**原因**:
- 不要なリソースが稼働している
- ログ保持期間が長すぎる
- 同時実行数が多すぎる

**解決策**:
1. 不要なリソースを削除
2. ログ保持期間を短縮
3. 自動スケーリングを最適化
4. コスト監視アラームを設定

```typescript
// コスト監視アラームを設定
const costAlarm = await cloudwatch.putMetricAlarm({
  AlarmName: 'HighCostAlert',
  MetricName: 'EstimatedCharges',
  Namespace: 'AWS/Billing',
  Statistic: 'Maximum',
  Period: 86400, // 1日
  EvaluationPeriods: 1,
  Threshold: 100, // $100
  ComparisonOperator: 'GreaterThanThreshold',
  AlarmActions: ['arn:aws:sns:ap-northeast-1:123456789012:cost-alerts']
}).promise();
```

### サポートリソース

#### 公式ドキュメント

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)

#### コミュニティ

- [AWS re:Post](https://repost.aws/)
- [AWS Developer Forums](https://forums.aws.amazon.com/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/amazon-bedrock)

#### AWSサポート

- **Basic Support**: 無料（ドキュメント、ホワイトペーパー）
- **Developer Support**: $29/月（技術サポート）
- **Business Support**: $100/月（24/7サポート）
- **Enterprise Support**: $15,000/月（専任TAM）

---

## まとめ

Amazon Bedrock AgentCoreは、エンタープライズグレードのAIエージェントを構築・デプロイ・運用するための包括的なプラットフォームです。9つのコアサービスを組み合わせることで、高度なAIエージェントを効率的に開発できます。

### 次のステップ

1. **環境構築**: AWS環境をセットアップ
2. **チュートリアル**: 基本的なエージェントを作成
3. **ユースケースの実装**: 実際のビジネス課題を解決
4. **最適化**: パフォーマンスとコストを最適化
5. **本番デプロイ**: 本番環境にデプロイ

### 追加リソース

- **デプロイガイド**: `docs/guides/agentcore-deployment-guide.md`
- **FAQ**: `docs/guides/agentcore-faq.md`
- **チュートリアル**: `docs/guides/agentcore-tutorials.md`
- **API仕様**: `docs/guides/bedrock-agentcore-implementation-guide.md`

---

**最終更新**: 2026-01-07  
**バージョン**: 1.0.0  
**フィードバック**: [GitHub Issues](https://github.com/your-repo/issues)

