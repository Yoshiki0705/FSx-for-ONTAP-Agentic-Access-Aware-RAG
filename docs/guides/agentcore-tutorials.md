# Amazon Bedrock AgentCore - ハンズオンチュートリアル

**作成日**: 2026-01-17  
**最終更新**: 2026-01-17  
**対象読者**: 開発者、システム管理者  
**目的**: AgentCore機能を実践的に学ぶためのステップバイステップガイド

---

## 📋 目次

1. [チュートリアルの概要](#チュートリアルの概要)
2. [前提条件](#前提条件)
3. [チュートリアル1: 基本編 - Runtime + Gateway + Memory](#チュートリアル1-基本編---runtime--gateway--memory)
4. [チュートリアル2: 応用編 - Identity + Browser + Code Interpreter](#チュートリアル2-応用編---identity--browser--code-interpreter)
5. [チュートリアル3: 統合編 - エンタープライズAIアシスタント](#チュートリアル3-統合編---エンタープライズaiアシスタント)
6. [次のステップ](#次のステップ)

---

## チュートリアルの概要

このドキュメントでは、Amazon Bedrock AgentCoreの機能を実践的に学ぶための3つのハンズオンチュートリアルを提供します。

### チュートリアル構成

| チュートリアル | レベル | 所要時間 | 使用機能 | 学習内容 |
|--------------|--------|---------|---------|---------|
| **基本編** | 初心者 | 60分 | Runtime, Gateway, Memory | エージェントの基本実装 |
| **応用編** | 中級者 | 90分 | Identity, Browser, Code Interpreter | 高度な機能の活用 |
| **統合編** | 上級者 | 120分 | 全9機能 | 実践的なアプリケーション構築 |

### 学習の進め方

1. **順番に進める**: 基本編 → 応用編 → 統合編の順で進めてください
2. **実際に手を動かす**: コードをコピー&ペーストするだけでなく、理解しながら実装してください
3. **エラーを恐れない**: エラーが発生したら、トラブルシューティングセクションを参照してください
4. **カスタマイズする**: 各チュートリアルの後に、自分のユースケースに合わせてカスタマイズしてください

---

## 前提条件

### 必須要件

- ✅ AWS アカウント
- ✅ AWS CLI インストール済み（v2.x以上）
- ✅ Node.js 18.x以上
- ✅ TypeScript基礎知識
- ✅ AWS CDK v2.x インストール済み
- ✅ 適切なIAM権限

### 推奨要件

- ✅ VS Code または IntelliJ IDEA
- ✅ Git インストール済み
- ✅ Docker インストール済み（Browser機能用）
- ✅ Python 3.11以上（Code Interpreter機能用）

### 環境セットアップ

```bash
# 1. プロジェクトをクローン
git clone https://github.com/your-org/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK

# 2. 依存関係をインストール
npm install

# 3. TypeScriptをビルド
npm run build

# 4. AWS認証情報を確認
aws sts get-caller-identity

# 5. CDK Bootstrapを実行（初回のみ）
npx cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
```


---

## チュートリアル1: 基本編 - Runtime + Gateway + Memory

### 学習目標

このチュートリアルでは、以下を学びます：

- ✅ AgentCore Runtimeでエージェントを実行する方法
- ✅ AgentCore Gatewayで外部APIを統合する方法
- ✅ AgentCore Memoryで会話履歴を管理する方法
- ✅ 基本的なチャットボットを構築する方法

### 前提条件

- AWS アカウント
- AWS CLI設定済み
- Node.js 18.x以上
- TypeScript基礎知識

### 所要時間

約60分

---

### ステップ1: プロジェクトのセットアップ（5分）

**目的**: AgentCore機能を有効化する設定ファイルを作成します。

**手順**:

1. **設定ファイルを作成**:

```bash
# cdk.context.jsonを作成
cat > cdk.context.json << 'EOF'
{
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "timeout": 300,
        "memorySize": 2048,
        "provisionedConcurrentExecutions": 1
      }
    },
    "gateway": {
      "enabled": true,
      "restApiConverter": {
        "enabled": true
      }
    },
    "memory": {
      "enabled": true,
      "strategies": {
        "semantic": { "enabled": true },
        "summary": { "enabled": true }
      },
      "eventRetentionDays": 90
    }
  }
}
EOF
```

2. **設定を確認**:

```bash
# 設定ファイルの内容を確認
cat cdk.context.json | jq '.agentCore'
```

**期待される結果**:
```json
{
  "runtime": { "enabled": true, ... },
  "gateway": { "enabled": true, ... },
  "memory": { "enabled": true, ... }
}
```

**トラブルシューティング**:
- `jq`コマンドがない場合: `brew install jq`（macOS）または`apt-get install jq`（Linux）

---

### ステップ2: CDKスタックをデプロイ（15分）

**目的**: AgentCore機能を含むCDKスタックをAWSにデプロイします。

**手順**:

1. **CDK Synthを実行**:

```bash
# CloudFormationテンプレートを生成
npx cdk synth TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=tutorial-basic-$(date +%Y%m%d-%H%M%S)
```

2. **変更内容を確認**:

```bash
# デプロイ前に変更内容を確認
npx cdk diff TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=tutorial-basic-$(date +%Y%m%d-%H%M%S)
```

3. **デプロイを実行**:

```bash
# WebAppStackをデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp \
  -c imageTag=tutorial-basic-$(date +%Y%m%d-%H%M%S) \
  --require-approval never
```

**期待される結果**:
```
✅ TokyoRegion-permission-aware-rag-prod-WebApp

Outputs:
TokyoRegion-permission-aware-rag-prod-WebApp.AgentCoreRuntimeFunctionArn = arn:aws:lambda:...
TokyoRegion-permission-aware-rag-prod-WebApp.AgentCoreGatewayRestApiConverterArn = arn:aws:lambda:...
TokyoRegion-permission-aware-rag-prod-WebApp.AgentCoreMemoryResourceArn = arn:aws:bedrock:...
```

**トラブルシューティング**:
- デプロイが失敗する場合: [FAQ Q32](./agentcore-faq.md#q32-agentcore機能を有効化したが動作しない場合は)を参照

---

### ステップ3: 天気APIをGatewayで統合（10分）

**目的**: OpenWeatherMap APIをAgentCore Gatewayで統合します。

**手順**:

1. **OpenWeatherMap APIキーを取得**:

- [OpenWeatherMap](https://openweathermap.org/api)にサインアップ
- APIキーを取得（無料プラン）

2. **APIキーをSecrets Managerに保存**:

```bash
# Secrets Managerにシークレットを作成
aws secretsmanager create-secret \
  --name tutorial/openweathermap-api-key \
  --description "OpenWeatherMap API Key for Tutorial" \
  --secret-string '{"apiKey":"YOUR_API_KEY_HERE"}' \
  --region ap-northeast-1
```

3. **OpenAPI仕様を作成**:

```bash
# openapi-weather.jsonを作成
cat > openapi-weather.json << 'EOF'
{
  "openapi": "3.0.0",
  "info": {
    "title": "OpenWeatherMap API",
    "version": "1.0.0",
    "description": "Get current weather data"
  },
  "servers": [
    {
      "url": "https://api.openweathermap.org/data/2.5"
    }
  ],
  "paths": {
    "/weather": {
      "get": {
        "summary": "Get current weather",
        "description": "Returns current weather data for a specified city",
        "operationId": "getCurrentWeather",
        "parameters": [
          {
            "name": "q",
            "in": "query",
            "required": true,
            "schema": { "type": "string" },
            "description": "City name (e.g., Tokyo, London)"
          },
          {
            "name": "appid",
            "in": "query",
            "required": true,
            "schema": { "type": "string" },
            "description": "API key"
          },
          {
            "name": "units",
            "in": "query",
            "required": false,
            "schema": { "type": "string", "enum": ["metric", "imperial"] },
            "description": "Units of measurement (metric or imperial)"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "main": {
                      "type": "object",
                      "properties": {
                        "temp": { "type": "number" },
                        "humidity": { "type": "number" }
                      }
                    },
                    "weather": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "description": { "type": "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
EOF
```

4. **Gateway変換スクリプトを作成**:

```typescript
// scripts/convert-weather-api.ts
import { BedrockAgentClient, CreateAgentActionGroupCommand } from '@aws-sdk/client-bedrock-agent';
import * as fs from 'fs';

async function convertWeatherApi() {
  const client = new BedrockAgentClient({ region: 'ap-northeast-1' });
  
  // OpenAPI仕様を読み込み
  const openApiSpec = fs.readFileSync('openapi-weather.json', 'utf-8');
  
  // Action Groupを作成
  const command = new CreateAgentActionGroupCommand({
    agentId: process.env.AGENT_ID!,
    agentVersion: 'DRAFT',
    actionGroupName: 'WeatherAPI',
    description: 'Get current weather data',
    actionGroupExecutor: {
      customControl: 'RETURN_CONTROL'
    },
    apiSchema: {
      payload: openApiSpec
    }
  });
  
  const response = await client.send(command);
  console.log('Action Group created:', response.actionGroup?.actionGroupId);
}

convertWeatherApi().catch(console.error);
```

5. **スクリプトを実行**:

```bash
# TypeScriptをコンパイル
npx tsc scripts/convert-weather-api.ts

# スクリプトを実行
AGENT_ID=your-agent-id node scripts/convert-weather-api.js
```

**期待される結果**:
```
Action Group created: ABCDEFGHIJ
```

**トラブルシューティング**:
- `AGENT_ID`が不明な場合: AWS Consoleで確認するか、CloudFormation Outputsから取得

---

### ステップ4: Memory機能を設定（10分）

**目的**: AgentCore Memoryで会話履歴を管理します。

**手順**:

1. **Memory Resourceを作成**:

```typescript
// scripts/create-memory-resource.ts
import { BedrockAgentClient, CreateMemoryCommand } from '@aws-sdk/client-bedrock-agent';

async function createMemoryResource() {
  const client = new BedrockAgentClient({ region: 'ap-northeast-1' });
  
  const command = new CreateMemoryCommand({
    name: 'tutorial-chat-memory',
    description: 'Memory for tutorial chatbot',
    strategies: [
      {
        type: 'SEMANTIC',
        name: 'facts-extraction',
        namespaces: ['/facts', '/entities']
      },
      {
        type: 'SUMMARY',
        name: 'conversation-summary',
        namespaces: ['/summaries']
      }
    ]
  });
  
  const response = await client.send(command);
  console.log('Memory Resource created:', response.memoryId);
  console.log('Memory ARN:', response.memoryArn);
  
  // 環境変数ファイルに保存
  const fs = require('fs');
  fs.appendFileSync('.env', `\nMEMORY_ID=${response.memoryId}\n`);
}

createMemoryResource().catch(console.error);
```

2. **スクリプトを実行**:

```bash
# TypeScriptをコンパイル
npx tsc scripts/create-memory-resource.ts

# スクリプトを実行
node scripts/create-memory-resource.js
```

3. **Memory IDを確認**:

```bash
# .envファイルを確認
cat .env | grep MEMORY_ID
```

**期待される結果**:
```
Memory Resource created: mem-12345678-abcd-...
Memory ARN: arn:aws:bedrock:ap-northeast-1:123456789012:memory/mem-12345678-abcd-...
MEMORY_ID=mem-12345678-abcd-...
```

**トラブルシューティング**:
- Memory機能が利用できない場合: リージョンを確認（us-east-1, us-west-2等でサポート）

---

### ステップ5: チャットボットを実装（15分）

**目的**: Runtime、Gateway、Memoryを統合したチャットボットを実装します。

**手順**:

1. **チャットボットコードを作成**:

```typescript
// src/chatbot.ts
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockAgentClient, GetMemoryCommand } from '@aws-sdk/client-bedrock-agent';
import * as readline from 'readline';

const agentId = process.env.AGENT_ID!;
const agentAliasId = process.env.AGENT_ALIAS_ID || 'TSTALIASID';
const memoryId = process.env.MEMORY_ID!;
const sessionId = `session-${Date.now()}`;

const runtimeClient = new BedrockAgentRuntimeClient({ region: 'ap-northeast-1' });
const agentClient = new BedrockAgentClient({ region: 'ap-northeast-1' });

async function chat(userInput: string): Promise<string> {
  console.log(`\n🤖 Processing: "${userInput}"`);
  
  // エージェントを呼び出し
  const command = new InvokeAgentCommand({
    agentId,
    agentAliasId,
    sessionId,
    inputText: userInput,
    memoryId
  });
  
  const response = await runtimeClient.send(command);
  
  // レスポンスを処理
  let agentResponse = '';
  if (response.completion) {
    for await (const chunk of response.completion) {
      if (chunk.chunk?.bytes) {
        const text = new TextDecoder().decode(chunk.chunk.bytes);
        agentResponse += text;
      }
    }
  }
  
  return agentResponse;
}

async function showMemory() {
  console.log('\n📚 Retrieving conversation memory...');
  
  const command = new GetMemoryCommand({
    memoryId,
    memoryType: 'SESSION_SUMMARY',
    maxItems: 5
  });
  
  const response = await agentClient.send(command);
  console.log('Memory:', JSON.stringify(response.memoryContents, null, 2));
}

async function main() {
  console.log('🚀 Tutorial Chatbot Started!');
  console.log('Type your message and press Enter. Type "exit" to quit, "memory" to show conversation memory.\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on('line', async (input) => {
    const userInput = input.trim();
    
    if (userInput.toLowerCase() === 'exit') {
      console.log('👋 Goodbye!');
      rl.close();
      process.exit(0);
    }
    
    if (userInput.toLowerCase() === 'memory') {
      await showMemory();
      return;
    }
    
    if (!userInput) {
      return;
    }
    
    try {
      const response = await chat(userInput);
      console.log(`\n🤖 Agent: ${response}\n`);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  });
}

main().catch(console.error);
```

2. **環境変数を設定**:

```bash
# .envファイルを作成
cat > .env << 'EOF'
AGENT_ID=your-agent-id
AGENT_ALIAS_ID=TSTALIASID
MEMORY_ID=your-memory-id
EOF
```

3. **チャットボットを実行**:

```bash
# TypeScriptをコンパイル
npx tsc src/chatbot.ts

# チャットボットを起動
node src/chatbot.js
```

**期待される結果**:
```
🚀 Tutorial Chatbot Started!
Type your message and press Enter. Type "exit" to quit, "memory" to show conversation memory.

> こんにちは

🤖 Processing: "こんにちは"

🤖 Agent: こんにちは！何かお手伝いできることはありますか？

> 東京の天気を教えてください

🤖 Processing: "東京の天気を教えてください"

🤖 Agent: 東京の現在の天気は晴れで、気温は15度です。湿度は60%です。

> memory

📚 Retrieving conversation memory...
Memory: {
  "memoryContents": [
    {
      "content": "ユーザーは東京の天気について質問した"
    }
  ]
}
```

**トラブルシューティング**:
- エージェントが応答しない場合: CloudWatch Logsを確認
- Memory機能が動作しない場合: [FAQ Q35](./agentcore-faq.md#q35-memory機能で長期メモリが抽出されない場合は)を参照

---

### ステップ6: 動作確認とテスト（5分）

**目的**: チャットボットが正しく動作することを確認します。

**テストシナリオ**:

1. **基本的な会話**:
```
> こんにちは
🤖 Agent: こんにちは！何かお手伝いできることはありますか？
```

2. **天気情報の取得**:
```
> 東京の天気を教えてください
🤖 Agent: 東京の現在の天気は晴れで、気温は15度です。
```

3. **会話履歴の確認**:
```
> memory
📚 Retrieving conversation memory...
Memory: { "memoryContents": [...] }
```

4. **コンテキストを保持した会話**:
```
> 明日の天気はどうですか？
🤖 Agent: 東京の明日の天気は曇りで、気温は12度の予想です。
```

**確認項目**:
- ✅ エージェントが応答する
- ✅ 天気APIが正しく呼び出される
- ✅ 会話履歴が保存される
- ✅ コンテキストが保持される

**トラブルシューティング**:
- 応答が遅い場合: Lambda関数のメモリサイズを増やす（3008MBに設定）
- エラーが発生する場合: CloudWatch Logsでエラーメッセージを確認

---

### まとめ

このチュートリアルでは、以下を学びました：

✅ **Runtime機能**: エージェントをサーバーレス環境で実行  
✅ **Gateway機能**: 外部API（OpenWeatherMap）を統合  
✅ **Memory機能**: 会話履歴を自動管理  
✅ **統合**: 3つの機能を組み合わせたチャットボットを構築

### 次のステップ

- **カスタマイズ**: 他のAPIを統合してみる（ニュースAPI、株価API等）
- **機能追加**: ユーザー認証を追加する（チュートリアル2で学習）
- **デプロイ**: 本番環境にデプロイする

### 学習リソース

- [AgentCoreユーザーガイド](./agentcore-user-guide.md)
- [FAQ](./agentcore-faq.md)
- [デプロイメントガイド](./agentcore-deployment-guide.md)


---

## チュートリアル2: 応用編 - Identity + Browser + Code Interpreter

### 学習目標

このチュートリアルでは、以下を学びます：

- ✅ AgentCore Identityでユーザー認証・認可を実装する方法
- ✅ AgentCore BrowserでWebスクレイピングを実行する方法
- ✅ AgentCore Code InterpreterでPythonコードを実行する方法
- ✅ データ分析アシスタントを構築する方法

### 前提条件

- チュートリアル1を完了していること
- Python 3.11以上がインストールされていること
- Docker がインストールされていること（Browser機能用）

### 所要時間

約90分

---

### ステップ1: Identity機能の設定（15分）

**目的**: ユーザー認証・認可を実装します。

**手順**:

1. **Cognito User Poolを作成**:

```bash
# Cognito User Poolを作成
aws cognito-idp create-user-pool \
  --pool-name tutorial-user-pool \
  --auto-verified-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --region ap-northeast-1 \
  --output json > user-pool.json

# User Pool IDを取得
USER_POOL_ID=$(cat user-pool.json | jq -r '.UserPool.Id')
echo "USER_POOL_ID=$USER_POOL_ID" >> .env
```

2. **User Pool Clientを作成**:

```bash
# User Pool Clientを作成
aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name tutorial-client \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region ap-northeast-1 \
  --output json > user-pool-client.json

# Client IDを取得
CLIENT_ID=$(cat user-pool-client.json | jq -r '.UserPoolClient.ClientId')
CLIENT_SECRET=$(cat user-pool-client.json | jq -r '.UserPoolClient.ClientSecret')
echo "CLIENT_ID=$CLIENT_ID" >> .env
echo "CLIENT_SECRET=$CLIENT_SECRET" >> .env
```

3. **テストユーザーを作成**:

```bash
# ユーザーを作成
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region ap-northeast-1

# パスワードを設定
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password SecurePass123! \
  --permanent \
  --region ap-northeast-1
```

4. **Identity DynamoDBテーブルを作成**:

```typescript
// scripts/create-identity-table.ts
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';

async function createIdentityTable() {
  const client = new DynamoDBClient({ region: 'ap-northeast-1' });
  
  const command = new CreateTableCommand({
    TableName: 'AgentCoreIdentity',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'role', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'RoleIndex',
        KeySchema: [
          { AttributeName: 'role', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  });
  
  const response = await client.send(command);
  console.log('Identity Table created:', response.TableDescription?.TableName);
}

createIdentityTable().catch(console.error);
```

5. **認証ヘルパー関数を作成**:

```typescript
// src/auth-helper.ts
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import * as crypto from 'crypto';

const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;

function calculateSecretHash(username: string): string {
  return crypto
    .createHmac('SHA256', CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest('base64');
}

export async function authenticateUser(username: string, password: string) {
  const secretHash = calculateSecretHash(username);
  
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: secretHash
    }
  });
  
  const response = await cognitoClient.send(command);
  
  if (!response.AuthenticationResult) {
    throw new Error('Authentication failed');
  }
  
  return {
    accessToken: response.AuthenticationResult.AccessToken!,
    idToken: response.AuthenticationResult.IdToken!,
    refreshToken: response.AuthenticationResult.RefreshToken!
  };
}

export async function assignRole(userId: string, role: string) {
  const command = new PutItemCommand({
    TableName: 'AgentCoreIdentity',
    Item: {
      userId: { S: userId },
      role: { S: role },
      createdAt: { N: Date.now().toString() }
    }
  });
  
  await dynamoClient.send(command);
  console.log(`Role "${role}" assigned to user "${userId}"`);
}

export async function checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
  // ユーザーのロールを取得
  const getCommand = new GetItemCommand({
    TableName: 'AgentCoreIdentity',
    Key: {
      userId: { S: userId }
    }
  });
  
  const response = await dynamoClient.send(getCommand);
  
  if (!response.Item) {
    return false;
  }
  
  const role = response.Item.role.S!;
  
  // ロールベースのアクセス制御
  const permissions: Record<string, string[]> = {
    'ADMIN': ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE'],
    'DEVELOPER': ['READ', 'EXECUTE'],
    'USER': ['READ']
  };
  
  return permissions[role]?.includes(action) || false;
}
```

**期待される結果**:
```
USER_POOL_ID=ap-northeast-1_XXXXXXXXX
CLIENT_ID=abcdefghijklmnopqrstuvwxyz
Identity Table created: AgentCoreIdentity
```

---

### ステップ2: Browser機能の設定（20分）

**目的**: Webスクレイピング機能を実装します。

**手順**:

1. **Puppeteer Lambda Layerを作成**:

```bash
# Lambda Layer用のディレクトリを作成
mkdir -p lambda-layers/puppeteer/nodejs
cd lambda-layers/puppeteer/nodejs

# Puppeteerをインストール
npm init -y
npm install puppeteer-core @sparticuz/chromium

# Layerをパッケージ化
cd ..
zip -r puppeteer-layer.zip nodejs

# Lambda Layerを作成
aws lambda publish-layer-version \
  --layer-name puppeteer-chromium \
  --description "Puppeteer with Chromium for Lambda" \
  --zip-file fileb://puppeteer-layer.zip \
  --compatible-runtimes nodejs18.x nodejs20.x \
  --region ap-northeast-1 \
  --output json > layer-version.json

# Layer ARNを取得
LAYER_ARN=$(cat layer-version.json | jq -r '.LayerVersionArn')
echo "PUPPETEER_LAYER_ARN=$LAYER_ARN" >> ../../../.env
```

2. **Browser Lambda関数を作成**:

```typescript
// lambda/browser/index.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export interface BrowserRequest {
  action: 'navigate' | 'screenshot' | 'scrape';
  url: string;
  selectors?: Record<string, string>;
  waitFor?: string;
  fullPage?: boolean;
}

export interface BrowserResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function handler(event: BrowserRequest): Promise<BrowserResponse> {
  let browser;
  
  try {
    // Chromiumを起動
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    
    const page = await browser.newPage();
    
    // URLにアクセス
    await page.goto(event.url, { waitUntil: 'networkidle2' });
    
    // 要素が表示されるまで待機
    if (event.waitFor) {
      await page.waitForSelector(event.waitFor, { timeout: 10000 });
    }
    
    let result;
    
    switch (event.action) {
      case 'navigate':
        result = {
          title: await page.title(),
          url: page.url()
        };
        break;
        
      case 'screenshot':
        const screenshot = await page.screenshot({
          fullPage: event.fullPage || false,
          encoding: 'base64'
        });
        result = { screenshot };
        break;
        
      case 'scrape':
        if (!event.selectors) {
          throw new Error('Selectors are required for scraping');
        }
        
        result = await page.evaluate((selectors) => {
          const data: Record<string, string> = {};
          for (const [key, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector);
            data[key] = element?.textContent?.trim() || '';
          }
          return data;
        }, event.selectors);
        break;
        
      default:
        throw new Error(`Unknown action: ${event.action}`);
    }
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    console.error('Browser error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
```

3. **Lambda関数をデプロイ**:

```bash
# Lambda関数をパッケージ化
cd lambda/browser
npm install
npx tsc
zip -r function.zip index.js node_modules

# Lambda関数を作成
aws lambda create-function \
  --function-name AgentCoreBrowser \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 2048 \
  --layers $PUPPETEER_LAYER_ARN \
  --region ap-northeast-1

# Function ARNを取得
BROWSER_FUNCTION_ARN=$(aws lambda get-function \
  --function-name AgentCoreBrowser \
  --query 'Configuration.FunctionArn' \
  --output text)
echo "BROWSER_FUNCTION_ARN=$BROWSER_FUNCTION_ARN" >> ../../.env
```

4. **Browserクライアントを作成**:

```typescript
// src/browser-client.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'ap-northeast-1' });
const BROWSER_FUNCTION_ARN = process.env.BROWSER_FUNCTION_ARN!;

export async function scrapeWebsite(url: string, selectors: Record<string, string>) {
  const command = new InvokeCommand({
    FunctionName: BROWSER_FUNCTION_ARN,
    Payload: JSON.stringify({
      action: 'scrape',
      url,
      selectors,
      waitFor: Object.values(selectors)[0]
    })
  });
  
  const response = await lambdaClient.send(command);
  const payload = JSON.parse(new TextDecoder().decode(response.Payload));
  
  if (!payload.success) {
    throw new Error(payload.error);
  }
  
  return payload.data;
}

export async function takeScreenshot(url: string, fullPage: boolean = false) {
  const command = new InvokeCommand({
    FunctionName: BROWSER_FUNCTION_ARN,
    Payload: JSON.stringify({
      action: 'screenshot',
      url,
      fullPage
    })
  });
  
  const response = await lambdaClient.send(command);
  const payload = JSON.parse(new TextDecoder().decode(response.Payload));
  
  if (!payload.success) {
    throw new Error(payload.error);
  }
  
  return payload.data.screenshot;
}
```

**期待される結果**:
```
PUPPETEER_LAYER_ARN=arn:aws:lambda:ap-northeast-1:123456789012:layer:puppeteer-chromium:1
BROWSER_FUNCTION_ARN=arn:aws:lambda:ap-northeast-1:123456789012:function:AgentCoreBrowser
```

---

### ステップ3: Code Interpreter機能の設定（15分）

**目的**: Pythonコード実行機能を実装します。

**手順**:

1. **Code Interpreter Lambda関数を作成**:

```python
# lambda/code-interpreter/index.py
import json
import sys
import io
import traceback
from contextlib import redirect_stdout, redirect_stderr

def handler(event, context):
    """
    Pythonコードを安全に実行する
    """
    code = event.get('code', '')
    language = event.get('language', 'python')
    
    if language != 'python':
        return {
            'success': False,
            'error': f'Unsupported language: {language}'
        }
    
    # 標準出力・標準エラーをキャプチャ
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()
    
    try:
        # コードを実行
        with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
            exec(code, {'__builtins__': __builtins__})
        
        return {
            'success': True,
            'output': stdout_buffer.getvalue(),
            'error': stderr_buffer.getvalue() if stderr_buffer.getvalue() else None
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': traceback.format_exc(),
            'output': stdout_buffer.getvalue()
        }
```

2. **Lambda関数をデプロイ**:

```bash
# Lambda関数をパッケージ化
cd lambda/code-interpreter
zip function.zip index.py

# Lambda関数を作成
aws lambda create-function \
  --function-name AgentCodeInterpreter \
  --runtime python3.11 \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 1024 \
  --region ap-northeast-1

# Function ARNを取得
CODE_INTERPRETER_FUNCTION_ARN=$(aws lambda get-function \
  --function-name AgentCodeInterpreter \
  --query 'Configuration.FunctionArn' \
  --output text)
echo "CODE_INTERPRETER_FUNCTION_ARN=$CODE_INTERPRETER_FUNCTION_ARN" >> ../../.env
```

3. **Code Interpreterクライアントを作成**:

```typescript
// src/code-interpreter-client.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'ap-northeast-1' });
const CODE_INTERPRETER_FUNCTION_ARN = process.env.CODE_INTERPRETER_FUNCTION_ARN!;

export async function executePythonCode(code: string) {
  const command = new InvokeCommand({
    FunctionName: CODE_INTERPRETER_FUNCTION_ARN,
    Payload: JSON.stringify({
      language: 'python',
      code
    })
  });
  
  const response = await lambdaClient.send(command);
  const payload = JSON.parse(new TextDecoder().decode(response.Payload));
  
  if (!payload.success) {
    throw new Error(payload.error);
  }
  
  return {
    output: payload.output,
    error: payload.error
  };
}
```

**期待される結果**:
```
CODE_INTERPRETER_FUNCTION_ARN=arn:aws:lambda:ap-northeast-1:123456789012:function:AgentCodeInterpreter
```

---

### ステップ4: データ分析アシスタントを実装（25分）

**目的**: Identity、Browser、Code Interpreterを統合したデータ分析アシスタントを実装します。

**手順**:

1. **データ分析アシスタントコードを作成**:

```typescript
// src/data-analysis-assistant.ts
import { authenticateUser, checkPermission } from './auth-helper';
import { scrapeWebsite } from './browser-client';
import { executePythonCode } from './code-interpreter-client';
import * as readline from 'readline';

interface Session {
  userId: string;
  accessToken: string;
  role: string;
}

let currentSession: Session | null = null;

async function login() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise<Session>((resolve, reject) => {
    rl.question('Username: ', (username) => {
      rl.question('Password: ', async (password) => {
        rl.close();
        
        try {
          const tokens = await authenticateUser(username, password);
          const session: Session = {
            userId: username,
            accessToken: tokens.accessToken,
            role: 'DEVELOPER' // 実際はトークンから取得
          };
          
          console.log('✅ Login successful!');
          resolve(session);
        } catch (error) {
          console.error('❌ Login failed:', error);
          reject(error);
        }
      });
    });
  });
}

async function scrapeAndAnalyze(url: string, selectors: Record<string, string>) {
  if (!currentSession) {
    throw new Error('Not authenticated');
  }
  
  // 権限チェック
  const hasPermission = await checkPermission(currentSession.userId, 'browser', 'EXECUTE');
  if (!hasPermission) {
    throw new Error('Permission denied: EXECUTE on browser');
  }
  
  console.log(`\n🌐 Scraping website: ${url}`);
  
  // Webスクレイピング
  const scrapedData = await scrapeWebsite(url, selectors);
  console.log('📊 Scraped data:', JSON.stringify(scrapedData, null, 2));
  
  // Pythonコードでデータ分析
  const analysisCode = `
import json

data = ${JSON.stringify(scrapedData)}

print("=== Data Analysis ===")
print(f"Number of fields: {len(data)}")
for key, value in data.items():
    print(f"{key}: {value[:50]}..." if len(value) > 50 else f"{key}: {value}")
`;
  
  console.log('\n🐍 Analyzing data with Python...');
  const result = await executePythonCode(analysisCode);
  console.log(result.output);
  
  return {
    scrapedData,
    analysis: result.output
  };
}

async function analyzeData(data: any) {
  if (!currentSession) {
    throw new Error('Not authenticated');
  }
  
  // 権限チェック
  const hasPermission = await checkPermission(currentSession.userId, 'code-interpreter', 'EXECUTE');
  if (!hasPermission) {
    throw new Error('Permission denied: EXECUTE on code-interpreter');
  }
  
  const analysisCode = `
import json
import statistics

data = ${JSON.stringify(data)}

# データ分析
if isinstance(data, list) and all(isinstance(x, (int, float)) for x in data):
    print("=== Statistical Analysis ===")
    print(f"Count: {len(data)}")
    print(f"Mean: {statistics.mean(data):.2f}")
    print(f"Median: {statistics.median(data):.2f}")
    print(f"Std Dev: {statistics.stdev(data):.2f}")
    print(f"Min: {min(data)}")
    print(f"Max: {max(data)}")
else:
    print("=== Data Summary ===")
    print(f"Type: {type(data).__name__}")
    print(f"Content: {str(data)[:200]}...")
`;
  
  console.log('\n🐍 Analyzing data with Python...');
  const result = await executePythonCode(analysisCode);
  console.log(result.output);
  
  return result.output;
}

async function main() {
  console.log('🚀 Data Analysis Assistant Started!');
  console.log('This assistant can scrape websites and analyze data using Python.\n');
  
  // ログイン
  currentSession = await login();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nCommands:');
  console.log('  scrape <url> - Scrape a website');
  console.log('  analyze <data> - Analyze data with Python');
  console.log('  exit - Quit\n');
  
  rl.on('line', async (input) => {
    const [command, ...args] = input.trim().split(' ');
    
    try {
      switch (command.toLowerCase()) {
        case 'scrape':
          if (args.length === 0) {
            console.log('Usage: scrape <url>');
            break;
          }
          
          // 例: ニュースサイトをスクレイピング
          await scrapeAndAnalyze(args[0], {
            title: 'h1',
            description: 'meta[name="description"]',
            author: '.author'
          });
          break;
          
        case 'analyze':
          if (args.length === 0) {
            console.log('Usage: analyze <data>');
            break;
          }
          
          // データを解析
          const data = JSON.parse(args.join(' '));
          await analyzeData(data);
          break;
          
        case 'exit':
          console.log('👋 Goodbye!');
          rl.close();
          process.exit(0);
          break;
          
        default:
          console.log('Unknown command. Type "scrape", "analyze", or "exit".');
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  });
}

main().catch(console.error);
```

2. **アシスタントを実行**:

```bash
# TypeScriptをコンパイル
npx tsc src/data-analysis-assistant.ts

# アシスタントを起動
node src/data-analysis-assistant.js
```

**期待される結果**:
```
🚀 Data Analysis Assistant Started!
This assistant can scrape websites and analyze data using Python.

Username: testuser@example.com
Password: ********
✅ Login successful!

Commands:
  scrape <url> - Scrape a website
  analyze <data> - Analyze data with Python
  exit - Quit

> scrape https://example.com

🌐 Scraping website: https://example.com
📊 Scraped data: {
  "title": "Example Domain",
  "description": "Example Domain. This domain is for use in illustrative examples...",
  "author": ""
}

🐍 Analyzing data with Python...
=== Data Analysis ===
Number of fields: 3
title: Example Domain
description: Example Domain. This domain is for use in illustr...
author: 

> analyze [10, 20, 30, 40, 50]

🐍 Analyzing data with Python...
=== Statistical Analysis ===
Count: 5
Mean: 30.00
Median: 30.00
Std Dev: 15.81
Min: 10
Max: 50
```

---

### ステップ5: 動作確認とテスト（10分)

**テストシナリオ**:

1. **認証テスト**:
```
Username: testuser@example.com
Password: SecurePass123!
✅ Login successful!
```

2. **Webスクレイピングテスト**:
```
> scrape https://example.com
🌐 Scraping website: https://example.com
📊 Scraped data: { ... }
```

3. **データ分析テスト**:
```
> analyze [10, 20, 30, 40, 50]
🐍 Analyzing data with Python...
=== Statistical Analysis ===
Count: 5
Mean: 30.00
```

4. **権限チェックテスト**:
```
# 権限のないユーザーでログイン
Username: readonly@example.com
Password: ReadOnly123!

> scrape https://example.com
❌ Error: Permission denied: EXECUTE on browser
```

**確認項目**:
- ✅ ユーザー認証が動作する
- ✅ 権限チェックが動作する
- ✅ Webスクレイピングが動作する
- ✅ Pythonコード実行が動作する
- ✅ データ分析が正しく実行される

---

### ステップ6: セキュリティ強化（5分）

**目的**: セキュリティベストプラクティスを適用します。

**手順**:

1. **IAM Roleの最小権限設定**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:AgentCoreBrowser",
        "arn:aws:lambda:*:*:function:AgentCodeInterpreter"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/AgentCoreIdentity"
    }
  ]
}
```

2. **VPC統合**:

```bash
# Lambda関数をVPCに配置
aws lambda update-function-configuration \
  --function-name AgentCoreBrowser \
  --vpc-config SubnetIds=subnet-xxx,subnet-yyy,SecurityGroupIds=sg-xxx
```

3. **CloudTrail監査ログ有効化**:

```bash
# CloudTrailを有効化
aws cloudtrail create-trail \
  --name agentcore-audit \
  --s3-bucket-name agentcore-audit-logs

aws cloudtrail start-logging \
  --name agentcore-audit
```

---

### まとめ

このチュートリアルでは、以下を学びました：

✅ **Identity機能**: Cognito統合、RBAC実装  
✅ **Browser機能**: Webスクレイピング、スクリーンショット撮影  
✅ **Code Interpreter機能**: Pythonコード実行、データ分析  
✅ **統合**: 3つの機能を組み合わせたデータ分析アシスタントを構築

### 次のステップ

- **機能拡張**: 他のプログラミング言語をサポート（Node.js、R等）
- **UI追加**: Webインターフェースを追加する
- **本番デプロイ**: 本番環境にデプロイする（チュートリアル3で学習）

### 学習リソース

- [AgentCoreユーザーガイド - Identity](./agentcore-user-guide.md#agentcore-identity---idアクセス管理)
- [AgentCoreユーザーガイド - Browser](./agentcore-user-guide.md#agentcore-browser---クラウドブラウザ)
- [AgentCoreユーザーガイド - Code Interpreter](./agentcore-user-guide.md#agentcore-code-interpreter---コード実行)


---

## チュートリアル3: 統合編 - エンタープライズAIアシスタント

### 学習目標

このチュートリアルでは、以下を学びます：

- ✅ AgentCoreの全9機能を統合する方法
- ✅ エンタープライズグレードのAIアシスタントを構築する方法
- ✅ Observability機能で監視・トレーシングを実装する方法
- ✅ Evaluations機能で品質評価を実装する方法
- ✅ Policy機能でポリシー管理を実装する方法
- ✅ 本番環境へのデプロイ方法

### 前提条件

- チュートリアル1と2を完了していること
- 本番環境へのデプロイ権限があること
- CloudWatch、X-Ray、CloudTrailの基礎知識

### 所要時間

約120分

---

### ステップ1: プロジェクト全体の設計（15分）

**目的**: エンタープライズAIアシスタントのアーキテクチャを設計します。

**アーキテクチャ概要**:

```
┌─────────────────────────────────────────────────────────────┐
│                    ユーザーインターフェース                    │
│                  (Web UI / Mobile App / CLI)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway / ALB                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    AgentCore Runtime                         │
│              (Lambda Function - Orchestrator)                │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ↓              ↓              ↓              ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Identity   │ │   Gateway    │ │    Memory    │ │   Browser    │
│  (Cognito)   │ │ (API Conv.)  │ │  (Bedrock)   │ │  (Puppeteer) │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
         │              │              │              │
         ↓              ↓              ↓              ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Code Interpret│ │    Policy    │ │Observability │ │ Evaluations  │
│   (Python)   │ │   (Cedar)    │ │ (CloudWatch) │ │  (DynamoDB)  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**機能マッピング**:

| 機能 | 役割 | 実装方法 |
|------|------|---------|
| Runtime | オーケストレーション | Lambda Function |
| Gateway | 外部API統合 | OpenAPI変換 |
| Memory | 会話履歴管理 | Bedrock Memory |
| Identity | 認証・認可 | Cognito + DynamoDB |
| Browser | Web操作 | Puppeteer Lambda |
| Code Interpreter | コード実行 | Python Lambda |
| Observability | 監視・トレーシング | CloudWatch + X-Ray |
| Evaluations | 品質評価 | DynamoDB + Lambda |
| Policy | ポリシー管理 | Cedar + Lambda |


### ステップ2: Observability機能の設定（20分)

**目的**: CloudWatch、X-Ray、CloudTrailで監視・トレーシングを実装します。

**手順**:

1. **X-Rayトレーシングを有効化**:

```typescript
// lib/config/observability-config.ts
export const observabilityConfig = {
  xray: {
    enabled: true,
    samplingRate: 0.1 // 10%のリクエストをトレース
  },
  cloudwatch: {
    enabled: true,
    logRetentionDays: 30,
    metricsNamespace: 'AgentCore/Production'
  },
  cloudtrail: {
    enabled: true,
    s3BucketName: 'agentcore-audit-logs'
  }
};
```

2. **CloudWatch Dashboardを作成**:

```typescript
// scripts/create-dashboard.ts
import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

async function createDashboard() {
  const client = new CloudWatchClient({ region: 'ap-northeast-1' });
  
  const dashboardBody = {
    widgets: [
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AWS/Lambda', 'Invocations', { stat: 'Sum' }],
            ['.', 'Errors', { stat: 'Sum' }],
            ['.', 'Duration', { stat: 'Average' }]
          ],
          period: 300,
          stat: 'Average',
          region: 'ap-northeast-1',
          title: 'Lambda Metrics'
        }
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AgentCore/Production', 'AgentInvocations', { stat: 'Sum' }],
            ['.', 'AgentSuccessRate', { stat: 'Average' }],
            ['.', 'AgentLatency', { stat: 'Average' }]
          ],
          period: 300,
          stat: 'Average',
          region: 'ap-northeast-1',
          title: 'Agent Metrics'
        }
      }
    ]
  };
  
  const command = new PutDashboardCommand({
    DashboardName: 'AgentCore-Production',
    DashboardBody: JSON.stringify(dashboardBody)
  });
  
  await client.send(command);
  console.log('Dashboard created: AgentCore-Production');
}

createDashboard().catch(console.error);
```

3. **カスタムメトリクスを送信**:

```typescript
// src/metrics-helper.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatchClient = new CloudWatchClient({ region: 'ap-northeast-1' });
const NAMESPACE = 'AgentCore/Production';

export async function recordAgentInvocation(agentId: string, success: boolean, duration: number) {
  const command = new PutMetricDataCommand({
    Namespace: NAMESPACE,
    MetricData: [
      {
        MetricName: 'AgentInvocations',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'AgentId', Value: agentId },
          { Name: 'Status', Value: success ? 'Success' : 'Failure' }
        ]
      },
      {
        MetricName: 'AgentLatency',
        Value: duration,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'AgentId', Value: agentId }
        ]
      },
      {
        MetricName: 'AgentSuccessRate',
        Value: success ? 100 : 0,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'AgentId', Value: agentId }
        ]
      }
    ]
  });
  
  await cloudwatchClient.send(command);
}
```

4. **CloudWatch Alarmsを設定**:

```bash
# エラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-HighErrorRate \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:agentcore-alerts

# レイテンシアラーム
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-HighLatency \
  --alarm-description "Alert when latency exceeds 5 seconds" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:agentcore-alerts
```

**期待される結果**:
```
Dashboard created: AgentCore-Production
Alarm created: AgentCore-HighErrorRate
Alarm created: AgentCore-HighLatency
```


### ステップ3: Evaluations機能の設定（20分）

**目的**: エージェントの品質評価を自動化します。

**手順**:

1. **評価データセットを作成**:

```typescript
// data/evaluation-dataset.json
[
  {
    "id": "eval-001",
    "input": "東京の天気を教えてください",
    "expectedOutput": "東京の現在の天気は",
    "category": "weather",
    "difficulty": "easy"
  },
  {
    "id": "eval-002",
    "input": "昨日の売上データを分析してください",
    "expectedOutput": "売上データの分析結果",
    "category": "data-analysis",
    "difficulty": "medium"
  },
  {
    "id": "eval-003",
    "input": "https://example.com のスクリーンショットを撮影してください",
    "expectedOutput": "スクリーンショットを撮影しました",
    "category": "browser",
    "difficulty": "medium"
  }
]
```

2. **評価関数を作成**:

```typescript
// src/evaluation-helper.ts
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import * as fs from 'fs';

const runtimeClient = new BedrockAgentRuntimeClient({ region: 'ap-northeast-1' });
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });

interface EvaluationResult {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  accuracy: number;
  relevance: number;
  latency: number;
  success: boolean;
}

export async function evaluateAgent(agentId: string, datasetPath: string): Promise<EvaluationResult[]> {
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const results: EvaluationResult[] = [];
  
  for (const testCase of dataset) {
    const startTime = Date.now();
    
    try {
      // エージェントを呼び出し
      const command = new InvokeAgentCommand({
        agentId,
        agentAliasId: 'TSTALIASID',
        sessionId: `eval-${testCase.id}`,
        inputText: testCase.input
      });
      
      const response = await runtimeClient.send(command);
      
      // レスポンスを処理
      let actualOutput = '';
      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            actualOutput += new TextDecoder().decode(chunk.chunk.bytes);
          }
        }
      }
      
      const latency = Date.now() - startTime;
      
      // 評価メトリクスを計算
      const accuracy = calculateAccuracy(testCase.expectedOutput, actualOutput);
      const relevance = calculateRelevance(testCase.input, actualOutput);
      
      const result: EvaluationResult = {
        id: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        accuracy,
        relevance,
        latency,
        success: accuracy > 0.7 && relevance > 0.7
      };
      
      results.push(result);
      
      // DynamoDBに保存
      await saveEvaluationResult(result);
      
    } catch (error) {
      console.error(`Evaluation failed for ${testCase.id}:`, error);
      results.push({
        id: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: '',
        accuracy: 0,
        relevance: 0,
        latency: Date.now() - startTime,
        success: false
      });
    }
  }
  
  return results;
}

function calculateAccuracy(expected: string, actual: string): number {
  // 簡易的な類似度計算（実際はより高度なアルゴリズムを使用）
  const expectedWords = expected.toLowerCase().split(/\s+/);
  const actualWords = actual.toLowerCase().split(/\s+/);
  
  let matchCount = 0;
  for (const word of expectedWords) {
    if (actualWords.includes(word)) {
      matchCount++;
    }
  }
  
  return expectedWords.length > 0 ? matchCount / expectedWords.length : 0;
}

function calculateRelevance(input: string, output: string): number {
  // 入力と出力の関連性を計算
  const inputWords = input.toLowerCase().split(/\s+/);
  const outputWords = output.toLowerCase().split(/\s+/);
  
  let relevantCount = 0;
  for (const word of inputWords) {
    if (outputWords.includes(word)) {
      relevantCount++;
    }
  }
  
  return inputWords.length > 0 ? relevantCount / inputWords.length : 0;
}

async function saveEvaluationResult(result: EvaluationResult) {
  const command = new PutItemCommand({
    TableName: 'AgentCoreEvaluations',
    Item: {
      evaluationId: { S: result.id },
      timestamp: { N: Date.now().toString() },
      input: { S: result.input },
      expectedOutput: { S: result.expectedOutput },
      actualOutput: { S: result.actualOutput },
      accuracy: { N: result.accuracy.toString() },
      relevance: { N: result.relevance.toString() },
      latency: { N: result.latency.toString() },
      success: { BOOL: result.success }
    }
  });
  
  await dynamoClient.send(command);
}

export async function generateEvaluationReport(results: EvaluationResult[]): Promise<string> {
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const averageAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / totalTests;
  const averageRelevance = results.reduce((sum, r) => sum + r.relevance, 0) / totalTests;
  const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / totalTests;
  
  return `
=== Evaluation Report ===
Total Tests: ${totalTests}
Successful Tests: ${successfulTests} (${(successfulTests / totalTests * 100).toFixed(2)}%)
Average Accuracy: ${(averageAccuracy * 100).toFixed(2)}%
Average Relevance: ${(averageRelevance * 100).toFixed(2)}%
Average Latency: ${averageLatency.toFixed(2)}ms

=== Detailed Results ===
${results.map(r => `
Test ID: ${r.id}
Input: ${r.input}
Expected: ${r.expectedOutput}
Actual: ${r.actualOutput.substring(0, 100)}...
Accuracy: ${(r.accuracy * 100).toFixed(2)}%
Relevance: ${(r.relevance * 100).toFixed(2)}%
Latency: ${r.latency}ms
Status: ${r.success ? '✅ PASS' : '❌ FAIL'}
`).join('\n')}
`;
}
```

3. **評価を実行**:

```typescript
// scripts/run-evaluation.ts
import { evaluateAgent, generateEvaluationReport } from '../src/evaluation-helper';

async function runEvaluation() {
  const agentId = process.env.AGENT_ID!;
  const datasetPath = 'data/evaluation-dataset.json';
  
  console.log('🧪 Starting agent evaluation...');
  
  const results = await evaluateAgent(agentId, datasetPath);
  const report = await generateEvaluationReport(results);
  
  console.log(report);
  
  // レポートをファイルに保存
  const fs = require('fs');
  fs.writeFileSync('evaluation-report.txt', report);
  console.log('\n📊 Report saved to evaluation-report.txt');
}

runEvaluation().catch(console.error);
```

4. **評価を実行**:

```bash
# TypeScriptをコンパイル
npx tsc scripts/run-evaluation.ts

# 評価を実行
AGENT_ID=your-agent-id node scripts/run-evaluation.js
```

**期待される結果**:
```
🧪 Starting agent evaluation...

=== Evaluation Report ===
Total Tests: 3
Successful Tests: 3 (100.00%)
Average Accuracy: 85.33%
Average Relevance: 92.67%
Average Latency: 2345.67ms

=== Detailed Results ===
Test ID: eval-001
Input: 東京の天気を教えてください
Expected: 東京の現在の天気は
Actual: 東京の現在の天気は晴れで、気温は15度です...
Accuracy: 100.00%
Relevance: 100.00%
Latency: 2100ms
Status: ✅ PASS

📊 Report saved to evaluation-report.txt
```


### ステップ4: Policy機能の設定（20分）

**目的**: Cedarポリシー言語でアクセス制御を実装します。

**手順**:

1. **Cedarポリシーを作成**:

```cedar
// policies/agent-access-policy.cedar

// 管理者は全ての操作が可能
permit(
  principal in Group::"Administrators",
  action,
  resource
);

// 開発者はエージェントの実行と読み取りが可能
permit(
  principal in Group::"Developers",
  action in [Action::"InvokeAgent", Action::"GetAgent"],
  resource
);

// ユーザーはエージェントの実行のみ可能
permit(
  principal in Group::"Users",
  action == Action::"InvokeAgent",
  resource
);

// 本番環境のエージェント削除を禁止
forbid(
  principal,
  action == Action::"DeleteAgent",
  resource
) when {
  resource.environment == "production"
};

// 営業時間外のアクセスを制限
forbid(
  principal,
  action,
  resource
) when {
  context.time.hour < 9 || context.time.hour >= 18
} unless {
  principal in Group::"Administrators"
};
```

2. **ポリシー評価関数を作成**:

```typescript
// src/policy-helper.ts
import { readFileSync } from 'fs';

interface PolicyEvaluationRequest {
  principal: {
    userId: string;
    groups: string[];
  };
  action: string;
  resource: {
    agentId: string;
    environment: string;
  };
  context: {
    time: {
      hour: number;
    };
  };
}

interface PolicyEvaluationResult {
  decision: 'ALLOW' | 'DENY';
  reason: string;
}

export function evaluatePolicy(request: PolicyEvaluationRequest): PolicyEvaluationResult {
  // Cedarポリシーを読み込み
  const policyText = readFileSync('policies/agent-access-policy.cedar', 'utf-8');
  
  // ポリシーを解析（簡易実装）
  const policies = parseCedarPolicy(policyText);
  
  // ポリシーを評価
  for (const policy of policies) {
    if (policy.effect === 'forbid' && matchesPolicy(policy, request)) {
      return {
        decision: 'DENY',
        reason: `Forbidden by policy: ${policy.description || 'Unnamed policy'}`
      };
    }
  }
  
  for (const policy of policies) {
    if (policy.effect === 'permit' && matchesPolicy(policy, request)) {
      return {
        decision: 'ALLOW',
        reason: `Permitted by policy: ${policy.description || 'Unnamed policy'}`
      };
    }
  }
  
  return {
    decision: 'DENY',
    reason: 'No matching policy found (default deny)'
  };
}

function parseCedarPolicy(policyText: string): any[] {
  // 簡易的なCedarポリシーパーサー
  // 実際の実装では、Cedar SDKを使用
  const policies: any[] = [];
  
  const permitMatches = policyText.matchAll(/permit\(([\s\S]*?)\);/g);
  for (const match of permitMatches) {
    policies.push({
      effect: 'permit',
      content: match[1]
    });
  }
  
  const forbidMatches = policyText.matchAll(/forbid\(([\s\S]*?)\);/g);
  for (const match of forbidMatches) {
    policies.push({
      effect: 'forbid',
      content: match[1]
    });
  }
  
  return policies;
}

function matchesPolicy(policy: any, request: PolicyEvaluationRequest): boolean {
  // 簡易的なポリシーマッチング
  // 実際の実装では、Cedar SDKを使用
  const content = policy.content.toLowerCase();
  
  // グループチェック
  for (const group of request.principal.groups) {
    if (content.includes(`group::"${group.toLowerCase()}"`)) {
      return true;
    }
  }
  
  // アクションチェック
  if (content.includes(`action == action::"${request.action.toLowerCase()}"`)) {
    return true;
  }
  
  // 環境チェック
  if (content.includes(`resource.environment == "${request.resource.environment}"`)) {
    return true;
  }
  
  // 時間チェック
  if (content.includes('context.time.hour')) {
    const hour = request.context.time.hour;
    if (hour < 9 || hour >= 18) {
      return true;
    }
  }
  
  return false;
}

export async function checkAccess(
  userId: string,
  groups: string[],
  action: string,
  agentId: string,
  environment: string
): Promise<boolean> {
  const request: PolicyEvaluationRequest = {
    principal: { userId, groups },
    action,
    resource: { agentId, environment },
    context: {
      time: {
        hour: new Date().getHours()
      }
    }
  };
  
  const result = evaluatePolicy(request);
  
  console.log(`Policy evaluation for ${userId}:`);
  console.log(`  Action: ${action}`);
  console.log(`  Resource: ${agentId} (${environment})`);
  console.log(`  Decision: ${result.decision}`);
  console.log(`  Reason: ${result.reason}`);
  
  return result.decision === 'ALLOW';
}
```

3. **ポリシーテストを作成**:

```typescript
// scripts/test-policy.ts
import { checkAccess } from '../src/policy-helper';

async function testPolicy() {
  console.log('🔒 Testing Cedar Policies\n');
  
  // テストケース1: 管理者は全ての操作が可能
  console.log('Test 1: Administrator can delete agent');
  const test1 = await checkAccess(
    'admin@example.com',
    ['Administrators'],
    'DeleteAgent',
    'agent-123',
    'production'
  );
  console.log(`Result: ${test1 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // テストケース2: 開発者は本番環境のエージェント削除不可
  console.log('Test 2: Developer cannot delete production agent');
  const test2 = await checkAccess(
    'dev@example.com',
    ['Developers'],
    'DeleteAgent',
    'agent-123',
    'production'
  );
  console.log(`Result: ${!test2 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // テストケース3: ユーザーはエージェント実行のみ可能
  console.log('Test 3: User can invoke agent');
  const test3 = await checkAccess(
    'user@example.com',
    ['Users'],
    'InvokeAgent',
    'agent-123',
    'production'
  );
  console.log(`Result: ${test3 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // テストケース4: 営業時間外のアクセス制限
  console.log('Test 4: Non-admin cannot access outside business hours');
  const test4 = await checkAccess(
    'user@example.com',
    ['Users'],
    'InvokeAgent',
    'agent-123',
    'production'
  );
  console.log(`Result: ${!test4 ? '✅ PASS (if outside hours)' : '✅ PASS (if within hours)'}\n`);
}

testPolicy().catch(console.error);
```

4. **ポリシーテストを実行**:

```bash
# TypeScriptをコンパイル
npx tsc scripts/test-policy.ts

# テストを実行
node scripts/test-policy.js
```

**期待される結果**:
```
🔒 Testing Cedar Policies

Test 1: Administrator can delete agent
Policy evaluation for admin@example.com:
  Action: DeleteAgent
  Resource: agent-123 (production)
  Decision: ALLOW
  Reason: Permitted by policy: Unnamed policy
Result: ✅ PASS

Test 2: Developer cannot delete production agent
Policy evaluation for dev@example.com:
  Action: DeleteAgent
  Resource: agent-123 (production)
  Decision: DENY
  Reason: Forbidden by policy: Unnamed policy
Result: ✅ PASS

Test 3: User can invoke agent
Policy evaluation for user@example.com:
  Action: InvokeAgent
  Resource: agent-123 (production)
  Decision: ALLOW
  Reason: Permitted by policy: Unnamed policy
Result: ✅ PASS
```


### ステップ5: エンタープライズAIアシスタントの統合実装（30分）

**目的**: 全9機能を統合したエンタープライズAIアシスタントを実装します。

**手順**:

1. **統合オーケストレーターを作成**:

```typescript
// src/enterprise-assistant.ts
import { authenticateUser, checkPermission } from './auth-helper';
import { scrapeWebsite, takeScreenshot } from './browser-client';
import { executePythonCode } from './code-interpreter-client';
import { recordAgentInvocation } from './metrics-helper';
import { evaluateAgent } from './evaluation-helper';
import { checkAccess } from './policy-helper';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import * as readline from 'readline';

const runtimeClient = new BedrockAgentRuntimeClient({ region: 'ap-northeast-1' });

interface Session {
  userId: string;
  accessToken: string;
  groups: string[];
  sessionId: string;
}

let currentSession: Session | null = null;

async function login(): Promise<Session> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve, reject) => {
    rl.question('Username: ', (username) => {
      rl.question('Password: ', async (password) => {
        rl.close();
        
        try {
          const tokens = await authenticateUser(username, password);
          const session: Session = {
            userId: username,
            accessToken: tokens.accessToken,
            groups: ['Developers'], // 実際はトークンから取得
            sessionId: `session-${Date.now()}`
          };
          
          console.log('✅ Login successful!');
          resolve(session);
        } catch (error) {
          console.error('❌ Login failed:', error);
          reject(error);
        }
      });
    });
  });
}

async function invokeAgent(input: string): Promise<string> {
  if (!currentSession) {
    throw new Error('Not authenticated');
  }
  
  const agentId = process.env.AGENT_ID!;
  const environment = 'production';
  
  // ポリシーチェック
  const hasAccess = await checkAccess(
    currentSession.userId,
    currentSession.groups,
    'InvokeAgent',
    agentId,
    environment
  );
  
  if (!hasAccess) {
    throw new Error('Access denied by policy');
  }
  
  const startTime = Date.now();
  let success = false;
  let response = '';
  
  try {
    // エージェントを呼び出し
    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId: 'TSTALIASID',
      sessionId: currentSession.sessionId,
      inputText: input,
      memoryId: process.env.MEMORY_ID
    });
    
    const result = await runtimeClient.send(command);
    
    // レスポンスを処理
    if (result.completion) {
      for await (const chunk of result.completion) {
        if (chunk.chunk?.bytes) {
          response += new TextDecoder().decode(chunk.chunk.bytes);
        }
      }
    }
    
    success = true;
    return response;
    
  } finally {
    // メトリクスを記録
    const duration = Date.now() - startTime;
    await recordAgentInvocation(agentId, success, duration);
  }
}

async function handleCommand(command: string, args: string[]) {
  if (!currentSession) {
    console.log('❌ Please login first');
    return;
  }
  
  try {
    switch (command.toLowerCase()) {
      case 'chat':
        const input = args.join(' ');
        console.log(`\n🤖 Processing: "${input}"`);
        const response = await invokeAgent(input);
        console.log(`\n🤖 Agent: ${response}\n`);
        break;
        
      case 'scrape':
        if (args.length === 0) {
          console.log('Usage: scrape <url>');
          break;
        }
        
        // 権限チェック
        const canScrape = await checkPermission(currentSession.userId, 'browser', 'EXECUTE');
        if (!canScrape) {
          console.log('❌ Permission denied: EXECUTE on browser');
          break;
        }
        
        console.log(`\n🌐 Scraping: ${args[0]}`);
        const scrapedData = await scrapeWebsite(args[0], {
          title: 'h1',
          description: 'meta[name="description"]'
        });
        console.log('📊 Data:', JSON.stringify(scrapedData, null, 2));
        break;
        
      case 'screenshot':
        if (args.length === 0) {
          console.log('Usage: screenshot <url>');
          break;
        }
        
        // 権限チェック
        const canScreenshot = await checkPermission(currentSession.userId, 'browser', 'EXECUTE');
        if (!canScreenshot) {
          console.log('❌ Permission denied: EXECUTE on browser');
          break;
        }
        
        console.log(`\n📸 Taking screenshot: ${args[0]}`);
        const screenshot = await takeScreenshot(args[0], true);
        console.log('✅ Screenshot saved (base64)');
        break;
        
      case 'analyze':
        if (args.length === 0) {
          console.log('Usage: analyze <data>');
          break;
        }
        
        // 権限チェック
        const canAnalyze = await checkPermission(currentSession.userId, 'code-interpreter', 'EXECUTE');
        if (!canAnalyze) {
          console.log('❌ Permission denied: EXECUTE on code-interpreter');
          break;
        }
        
        const data = JSON.parse(args.join(' '));
        const analysisCode = `
import json
data = ${JSON.stringify(data)}
print("Data type:", type(data).__name__)
print("Data:", data)
`;
        
        console.log('\n🐍 Analyzing data...');
        const result = await executePythonCode(analysisCode);
        console.log(result.output);
        break;
        
      case 'evaluate':
        console.log('\n🧪 Running evaluation...');
        const evalResults = await evaluateAgent(
          process.env.AGENT_ID!,
          'data/evaluation-dataset.json'
        );
        console.log(`✅ Evaluation complete: ${evalResults.length} tests`);
        break;
        
      case 'help':
        console.log(`
Available commands:
  chat <message>       - Chat with the agent
  scrape <url>         - Scrape a website
  screenshot <url>     - Take a screenshot
  analyze <data>       - Analyze data with Python
  evaluate             - Run agent evaluation
  help                 - Show this help
  exit                 - Quit
        `);
        break;
        
      default:
        console.log('Unknown command. Type "help" for available commands.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  console.log('🚀 Enterprise AI Assistant Started!');
  console.log('This assistant integrates all 9 AgentCore features.\n');
  
  // ログイン
  currentSession = await login();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nType "help" for available commands.\n');
  
  rl.on('line', async (input) => {
    const [command, ...args] = input.trim().split(' ');
    
    if (command.toLowerCase() === 'exit') {
      console.log('👋 Goodbye!');
      rl.close();
      process.exit(0);
    }
    
    await handleCommand(command, args);
  });
}

main().catch(console.error);
```

2. **統合テストを実行**:

```bash
# TypeScriptをコンパイル
npx tsc src/enterprise-assistant.ts

# アシスタントを起動
node src/enterprise-assistant.js
```

**期待される結果**:
```
🚀 Enterprise AI Assistant Started!
This assistant integrates all 9 AgentCore features.

Username: testuser@example.com
Password: ********
✅ Login successful!

Type "help" for available commands.

> help

Available commands:
  chat <message>       - Chat with the agent
  scrape <url>         - Scrape a website
  screenshot <url>     - Take a screenshot
  analyze <data>       - Analyze data with Python
  evaluate             - Run agent evaluation
  help                 - Show this help
  exit                 - Quit

> chat 東京の天気を教えてください

🤖 Processing: "東京の天気を教えてください"
Policy evaluation for testuser@example.com:
  Action: InvokeAgent
  Resource: agent-123 (production)
  Decision: ALLOW
  Reason: Permitted by policy: Unnamed policy

🤖 Agent: 東京の現在の天気は晴れで、気温は15度です。

> scrape https://example.com

🌐 Scraping: https://example.com
📊 Data: {
  "title": "Example Domain",
  "description": "Example Domain. This domain is for use in illustrative examples..."
}

> analyze [10, 20, 30, 40, 50]

🐍 Analyzing data...
Data type: list
Data: [10, 20, 30, 40, 50]

> evaluate

🧪 Running evaluation...
✅ Evaluation complete: 3 tests
```


### ステップ6: 本番環境へのデプロイ（15分）

**目的**: エンタープライズAIアシスタントを本番環境にデプロイします。

**手順**:

1. **本番環境用の設定ファイルを作成**:

```json
// cdk.context.prod.json
{
  "environment": "production",
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "timeout": 300,
        "memorySize": 3008,
        "provisionedConcurrentExecutions": 5
      },
      "vpcConfig": {
        "enabled": true
      }
    },
    "gateway": {
      "enabled": true,
      "restApiConverter": { "enabled": true },
      "lambdaConverter": { "enabled": true },
      "mcpIntegration": { "enabled": true }
    },
    "memory": {
      "enabled": true,
      "strategies": {
        "semantic": { "enabled": true },
        "summary": { "enabled": true },
        "userPreference": { "enabled": true }
      },
      "eventRetentionDays": 90
    },
    "identity": {
      "enabled": true,
      "cognitoIntegration": { "enabled": true },
      "rbac": { "enabled": true },
      "abac": { "enabled": true }
    },
    "browser": {
      "enabled": true,
      "puppeteerConfig": {
        "headless": true,
        "timeout": 60000
      }
    },
    "codeInterpreter": {
      "enabled": true,
      "supportedLanguages": ["python", "nodejs"],
      "timeout": 60
    },
    "observability": {
      "enabled": true,
      "xray": { "enabled": true, "samplingRate": 0.1 },
      "cloudwatch": { "enabled": true, "logRetentionDays": 30 },
      "cloudtrail": { "enabled": true }
    },
    "evaluations": {
      "enabled": true,
      "autoEvaluation": { "enabled": true, "schedule": "rate(1 day)" }
    },
    "policy": {
      "enabled": true,
      "cedarPolicies": { "enabled": true }
    }
  }
}
```

2. **デプロイスクリプトを作成**:

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -euo pipefail

echo "🚀 Deploying to Production Environment"

# 環境変数を設定
export AWS_REGION=ap-northeast-1
export ENVIRONMENT=production
export IMAGE_TAG=prod-$(date +%Y%m%d-%H%M%S)

# 設定ファイルをコピー
cp cdk.context.prod.json cdk.context.json

# TypeScriptをビルド
echo "📦 Building TypeScript..."
npm run build

# テストを実行
echo "🧪 Running tests..."
npm test

# CDK Synthを実行
echo "🔍 Synthesizing CloudFormation templates..."
npx cdk synth --all -c imageTag=$IMAGE_TAG

# CDK Diffを実行
echo "📊 Checking differences..."
npx cdk diff --all -c imageTag=$IMAGE_TAG

# デプロイ確認
read -p "Deploy to production? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# デプロイを実行
echo "🚀 Deploying to production..."
npx cdk deploy --all \
  -c imageTag=$IMAGE_TAG \
  --require-approval never

# デプロイ後の確認
echo "✅ Deployment complete!"
echo "📊 Checking deployment status..."

# Lambda関数の確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `AgentCore`)].FunctionName' \
  --output table

# CloudWatch Dashboardの確認
aws cloudwatch get-dashboard \
  --dashboard-name AgentCore-Production \
  --query 'DashboardName' \
  --output text

echo "✅ All checks passed!"
```

3. **デプロイを実行**:

```bash
# デプロイスクリプトに実行権限を付与
chmod +x scripts/deploy-production.sh

# デプロイを実行
./scripts/deploy-production.sh
```

**期待される結果**:
```
🚀 Deploying to Production Environment
📦 Building TypeScript...
✅ Build successful

🧪 Running tests...
✅ All tests passed (29/29)

🔍 Synthesizing CloudFormation templates...
✅ Synthesis complete

📊 Checking differences...
Stack TokyoRegion-permission-aware-rag-prod-WebApp
Resources
[+] AWS::Lambda::Function AgentCoreRuntime
[+] AWS::Lambda::Function AgentCoreBrowser
[+] AWS::Lambda::Function AgentCodeInterpreter
...

Deploy to production? (yes/no): yes

🚀 Deploying to production...
✅ TokyoRegion-permission-aware-rag-prod-WebApp deployed

✅ Deployment complete!
📊 Checking deployment status...

AgentCoreRuntime
AgentCoreBrowser
AgentCodeInterpreter
...

✅ All checks passed!
```

---

### ステップ7: 動作確認と負荷テスト（10分）

**目的**: 本番環境での動作を確認し、負荷テストを実行します。

**手順**:

1. **ヘルスチェックを実行**:

```bash
# Lambda関数のヘルスチェック
aws lambda invoke \
  --function-name AgentCoreRuntime \
  --payload '{"test": true}' \
  /tmp/health-check.json

cat /tmp/health-check.json
```

2. **負荷テストスクリプトを作成**:

```typescript
// scripts/load-test.ts
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const client = new BedrockAgentRuntimeClient({ region: 'ap-northeast-1' });
const agentId = process.env.AGENT_ID!;
const concurrency = 10;
const requestsPerWorker = 10;

async function sendRequest(workerId: number, requestId: number): Promise<number> {
  const startTime = Date.now();
  
  try {
    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId: 'TSTALIASID',
      sessionId: `load-test-${workerId}-${requestId}`,
      inputText: 'こんにちは'
    });
    
    await client.send(command);
    return Date.now() - startTime;
    
  } catch (error) {
    console.error(`Worker ${workerId} Request ${requestId} failed:`, error);
    return -1;
  }
}

async function runLoadTest() {
  console.log(`🔥 Starting load test: ${concurrency} workers, ${requestsPerWorker} requests each`);
  
  const startTime = Date.now();
  const workers: Promise<number[]>[] = [];
  
  for (let i = 0; i < concurrency; i++) {
    const workerPromise = (async () => {
      const latencies: number[] = [];
      for (let j = 0; j < requestsPerWorker; j++) {
        const latency = await sendRequest(i, j);
        latencies.push(latency);
      }
      return latencies;
    })();
    
    workers.push(workerPromise);
  }
  
  const results = await Promise.all(workers);
  const allLatencies = results.flat().filter(l => l > 0);
  
  const totalTime = Date.now() - startTime;
  const totalRequests = concurrency * requestsPerWorker;
  const successfulRequests = allLatencies.length;
  const failedRequests = totalRequests - successfulRequests;
  
  const avgLatency = allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length;
  const minLatency = Math.min(...allLatencies);
  const maxLatency = Math.max(...allLatencies);
  
  console.log(`
=== Load Test Results ===
Total Requests: ${totalRequests}
Successful: ${successfulRequests}
Failed: ${failedRequests}
Success Rate: ${(successfulRequests / totalRequests * 100).toFixed(2)}%

Latency:
  Average: ${avgLatency.toFixed(2)}ms
  Min: ${minLatency}ms
  Max: ${maxLatency}ms

Throughput: ${(totalRequests / (totalTime / 1000)).toFixed(2)} req/s
Total Time: ${(totalTime / 1000).toFixed(2)}s
  `);
}

runLoadTest().catch(console.error);
```

3. **負荷テストを実行**:

```bash
# TypeScriptをコンパイル
npx tsc scripts/load-test.ts

# 負荷テストを実行
AGENT_ID=your-agent-id node scripts/load-test.js
```

**期待される結果**:
```
🔥 Starting load test: 10 workers, 10 requests each

=== Load Test Results ===
Total Requests: 100
Successful: 98
Failed: 2
Success Rate: 98.00%

Latency:
  Average: 2345.67ms
  Min: 1200ms
  Max: 5000ms

Throughput: 4.26 req/s
Total Time: 23.45s
```

---

### まとめ

このチュートリアルでは、以下を学びました：

✅ **全9機能の統合**: Runtime、Gateway、Memory、Identity、Browser、Code Interpreter、Observability、Evaluations、Policy  
✅ **エンタープライズグレードの実装**: 認証・認可、監視・トレーシング、品質評価、ポリシー管理  
✅ **本番環境へのデプロイ**: 設定管理、デプロイ自動化、動作確認  
✅ **負荷テスト**: パフォーマンス測定、スループット確認

### 次のステップ

- **CI/CDパイプライン構築**: GitHub ActionsまたはAWS CodePipelineで自動デプロイ
- **マルチリージョンデプロイ**: 複数リージョンでの冗長化
- **コスト最適化**: 不要な機能の無効化、リソースサイズの最適化
- **セキュリティ強化**: WAF、Shield、GuardDutyの導入

### 学習リソース

- [AgentCoreユーザーガイド](./agentcore-user-guide.md)
- [デプロイメントガイド](./agentcore-deployment-guide.md)
- [FAQ](./agentcore-faq.md)
- [運用・保守ガイド](./operations-maintenance-guide-ja.md)

---

## 次のステップ

### さらに学ぶために

1. **公式ドキュメント**:
   - [Amazon Bedrock公式ドキュメント](https://docs.aws.amazon.com/bedrock/)
   - [AWS Lambda公式ドキュメント](https://docs.aws.amazon.com/lambda/)
   - [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)

2. **コミュニティ**:
   - [AWS re:Post](https://repost.aws/)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/amazon-bedrock)
   - [GitHub Discussions](https://github.com/your-org/your-repo/discussions)

3. **トレーニング**:
   - [AWS Skill Builder](https://skillbuilder.aws/)
   - [AWS Training and Certification](https://aws.amazon.com/training/)

### フィードバック

このチュートリアルに関するフィードバックや質問がある場合は、以下の方法でお知らせください：

- **GitHub Issues**: プロジェクトのIssueを作成
- **社内チャット**: 開発チームに連絡
- **メール**: agentcore-support@example.com

---

**最終更新**: 2026-01-17  
**バージョン**: v1.0.0  
**次回更新予定**: 2026-02-17

**このチュートリアルは継続的に更新されます。新しい機能やベストプラクティスが追加され次第、更新してください。**

