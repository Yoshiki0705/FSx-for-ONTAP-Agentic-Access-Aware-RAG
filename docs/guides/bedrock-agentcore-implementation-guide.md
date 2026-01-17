# Amazon Bedrock AgentCore 実装ガイド

**最終更新**: 2026-01-04  
**バージョン**: 1.3.0  
**Phase 3完了**: Observability、Evaluations、Policy機能追加

---

## 📋 目次

1. [概要](#概要)
2. [AgentCore Runtime](#agentcore-runtime)
3. [AgentCore Gateway](#agentcore-gateway)
4. [AgentCore Memory](#agentcore-memory)
5. [AgentCore Identity](#agentcore-identity)
6. [AgentCore Browser](#agentcore-browser)
7. [AgentCore Code Interpreter](#agentcore-code-interpreter)
8. [AgentCore Observability](#agentcore-observability)
9. [AgentCore Evaluations](#agentcore-evaluations)
10. [トラブルシューティング](#トラブルシューティング)

---

## 概要

Amazon Bedrock AgentCoreは、Bedrock Agentの高度な機能を提供するモジュラーシステムです。以下の9つのコアコンポーネントで構成されています：

- **Runtime**: イベント駆動実行とスケーリング
- **Gateway**: REST API/Lambda/MCPサーバー統合
- **Memory**: フルマネージドメモリ管理
- **Identity**: 認証・認可（RBAC/ABAC）
- **Browser**: Headless Chromeによるブラウザ自動化
- **Code Interpreter**: Python/Node.jsコード実行環境
- **Observability**: X-Ray・CloudWatch統合監視
- **Evaluations**: 品質評価・A/Bテスト
- **Policy**: 自然言語ポリシー管理

---

## AgentCore Runtime

### 概要

Runtime Constructは、Bedrock Agentのイベント駆動実行とスケーリングを管理します。

### 主な機能

- **Lambda統合**: Node.js 22.x Lambda関数による実行
- **EventBridge統合**: 非同期イベント処理
- **自動スケーリング**: Reserved/Provisioned Concurrency
- **KMS暗号化**: 環境変数の暗号化

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true,
      "lambda": {
        "timeout": 30,
        "memorySize": 2048,
        "reservedConcurrency": 10,
        "provisionedConcurrency": 5
      },
      "eventBridge": {
        "enabled": true,
        "scheduleExpression": "rate(5 minutes)"
      },
      "kms": {
        "enabled": true
      }
    }
  }
}
```

#### CDKコード例

```typescript
import { BedrockAgentCoreRuntimeConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-runtime-construct';

const runtime = new BedrockAgentCoreRuntimeConstruct(this, 'Runtime', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  lambdaConfig: {
    timeout: cdk.Duration.seconds(30),
    memorySize: 2048,
    reservedConcurrency: 10,
    provisionedConcurrency: 5,
  },
  eventBridgeConfig: {
    enabled: true,
    scheduleExpression: 'rate(5 minutes)',
  },
  kmsConfig: {
    enabled: true,
  },
});
```

### Lambda関数の環境変数

Runtime Lambda関数には以下の環境変数が自動設定されます：

- `PROJECT_NAME`: プロジェクト名
- `ENVIRONMENT`: 環境名（dev, staging, prod）
- `BEDROCK_AGENT_ID`: Bedrock Agent ID
- `AWS_REGION`: AWSリージョン

### トラブルシューティング

#### Lambda関数がタイムアウトする

**原因**: タイムアウト設定が短すぎる

**解決策**:
```typescript
lambdaConfig: {
  timeout: cdk.Duration.seconds(60), // 60秒に延長
}
```

#### Reserved Concurrencyが不足する

**原因**: 同時実行数が設定値を超えている

**解決策**:
```typescript
lambdaConfig: {
  reservedConcurrency: 20, // 20に増加
}
```

---

## AgentCore Gateway

### 概要

Gateway Constructは、REST API、Lambda関数、MCPサーバーをBedrock Agent Toolに変換します。

### 主な機能

- **REST API変換**: OpenAPI仕様からTool定義を生成
- **Lambda関数変換**: Lambda関数メタデータからTool定義を生成
- **MCPサーバー統合**: MCP Tool定義をBedrock Agent Toolに変換

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "restApi": {
        "enabled": true,
        "openApiSpecPath": "s3://my-bucket/openapi.yaml"
      },
      "lambdaFunction": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function"
        ]
      },
      "mcpServer": {
        "enabled": true,
        "endpoint": "https://mcp.example.com",
        "authType": "API_KEY",
        "apiKeySecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-api-key"
      }
    }
  }
}
```

#### CDKコード例

```typescript
import { BedrockAgentCoreGatewayConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-gateway-construct';

const gateway = new BedrockAgentCoreGatewayConstruct(this, 'Gateway', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  restApiConfig: {
    enabled: true,
    openApiSpecPath: 's3://my-bucket/openapi.yaml',
  },
  lambdaFunctionConfig: {
    enabled: true,
    functionArns: [
      'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function',
    ],
  },
  mcpServerConfig: {
    enabled: true,
    endpoint: 'https://mcp.example.com',
    authType: 'API_KEY',
    apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-api-key',
  },
});
```

### REST API変換

#### OpenAPI仕様の準備

```yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /users/{userId}:
    get:
      summary: Get user by ID
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Successful response
```

#### Tool定義の生成

Gateway Constructは、OpenAPI仕様から自動的にBedrock Agent Tool定義を生成します：

```json
{
  "name": "get_users_userId",
  "description": "Get user by ID",
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": {
        "type": "string",
        "description": "User ID"
      }
    },
    "required": ["userId"]
  }
}
```

### Lambda関数変換

#### Lambda関数のタグ設定

Lambda関数にタグを設定することで、Tool定義を制御できます：

```typescript
const myFunction = new lambda.Function(this, 'MyFunction', {
  // ... 他の設定
  tags: {
    'bedrock:tool:name': 'my_custom_tool',
    'bedrock:tool:description': 'My custom tool description',
    'bedrock:tool:inputSchema': JSON.stringify({
      type: 'object',
      properties: {
        param1: { type: 'string' },
        param2: { type: 'number' },
      },
      required: ['param1'],
    }),
  },
});
```

### MCPサーバー統合

#### 認証タイプ

Gateway Constructは3つの認証タイプをサポートします：

1. **API_KEY**: API Keyによる認証
2. **OAuth2**: OAuth2トークンによる認証
3. **NONE**: 認証なし

#### API_KEY認証の設定

```typescript
mcpServerConfig: {
  enabled: true,
  endpoint: 'https://mcp.example.com',
  authType: 'API_KEY',
  apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-api-key',
}
```

#### OAuth2認証の設定

```typescript
mcpServerConfig: {
  enabled: true,
  endpoint: 'https://mcp.example.com',
  authType: 'OAuth2',
  oauth2Config: {
    tokenUrl: 'https://auth.example.com/token',
    clientIdSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oauth2-client-id',
    clientSecretSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oauth2-client-secret',
  },
}
```

### トラブルシューティング

#### OpenAPI仕様が読み込めない

**原因**: S3パスが間違っている、または権限がない

**解決策**:
1. S3パスを確認
2. Lambda関数にS3読み取り権限を付与

#### Lambda関数のメタデータが取得できない

**原因**: Lambda関数のARNが間違っている、または権限がない

**解決策**:
1. Lambda関数のARNを確認
2. Gateway Lambda関数にLambda読み取り権限を付与

#### MCPサーバーに接続できない

**原因**: エンドポイントが間違っている、または認証に失敗している

**解決策**:
1. エンドポイントURLを確認
2. 認証情報（API Key、OAuth2トークン）を確認
3. Secrets Managerのシークレットを確認

---

## AgentCore Memory

### 概要

Memory Constructは、Bedrock Agentのフルマネージドメモリ機能を提供します。

### 主な機能

- **Memory Resource**: フルマネージドメモリリソース
- **Memory Strategies**: Semantic, Summary, User Preference
- **短期メモリ**: 会話履歴（Events）
- **長期メモリ**: 重要情報の自動抽出（Records）

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "bedrockAgentCore": {
    "memory": {
      "enabled": true,
      "strategies": {
        "semantic": {
          "enabled": true,
          "maxTokens": 1000
        },
        "summary": {
          "enabled": true,
          "maxTokens": 500
        },
        "userPreference": {
          "enabled": true
        }
      },
      "kms": {
        "enabled": true
      }
    }
  }
}
```

#### CDKコード例

```typescript
import { BedrockAgentCoreMemoryConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-memory-construct';

const memory = new BedrockAgentCoreMemoryConstruct(this, 'Memory', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  memoryStrategies: {
    semantic: {
      enabled: true,
      maxTokens: 1000,
    },
    summary: {
      enabled: true,
      maxTokens: 500,
    },
    userPreference: {
      enabled: true,
    },
  },
  kmsConfig: {
    enabled: true,
  },
});
```

### Memory Strategies

#### Semantic Strategy

会話履歴から重要な情報を自動抽出し、エピソード記憶として保存します。

**用途**:
- 会話の文脈理解
- 過去の会話内容の参照
- ユーザーの意図の推測

#### Summary Strategy

会話を要約し、重要なポイントを保存します。

**用途**:
- 長い会話の要約
- 会話の主要トピックの抽出
- 会話の進行状況の追跡

#### User Preference Strategy

ユーザーの好みや設定を学習し、保存します。

**用途**:
- ユーザーの好みの記憶
- パーソナライズされた応答
- ユーザー固有の設定の保存

### Memory API

#### イベント書き込み

```typescript
// 短期メモリにイベントを書き込み
await memoryClient.writeEvent({
  memoryId: 'memory-123',
  sessionId: 'session-456',
  event: {
    type: 'user_message',
    content: 'こんにちは',
    timestamp: new Date().toISOString(),
  },
});
```

#### 短期メモリ取得

```typescript
// 最新のK件の会話を取得
const events = await memoryClient.getLastKTurns({
  memoryId: 'memory-123',
  sessionId: 'session-456',
  k: 10,
});
```

#### 長期メモリ検索

```typescript
// 長期メモリから関連情報を検索
const records = await memoryClient.searchLongTermMemories({
  memoryId: 'memory-123',
  query: 'ユーザーの好きな食べ物',
  maxResults: 5,
});
```

### トラブルシューティング

#### Memory Resourceが作成されない

**原因**: Memory機能が有効化されていない

**解決策**:
```typescript
memoryConfig: {
  enabled: true, // 有効化
}
```

#### Memory Strategiesが動作しない

**原因**: Strategy設定が間違っている

**解決策**:
```typescript
memoryStrategies: {
  semantic: {
    enabled: true,
    maxTokens: 1000, // トークン数を確認
  },
}
```

---

## AgentCore Identity

### 概要

Identity Constructは、Bedrock Agentの認証・認可機能を提供します。

### 主な機能

- **エージェントID管理**: 一意のエージェントIDの生成・管理
- **RBAC**: ロールベースのアクセス制御（Admin, User, ReadOnly）
- **ABAC**: 属性ベースのアクセス制御（部署、プロジェクト、機密度）
- **DynamoDB統合**: エージェント情報の永続化
- **KMS暗号化**: データの暗号化

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "bedrockAgentCore": {
    "identity": {
      "enabled": true,
      "dynamoDb": {
        "tableName": "agent-identity",
        "readCapacity": 5,
        "writeCapacity": 5
      },
      "rbac": {
        "enabled": true,
        "defaultRole": "User"
      },
      "abac": {
        "enabled": true,
        "requiredAttributes": ["department", "project"]
      },
      "kms": {
        "enabled": true
      }
    }
  }
}
```

#### CDKコード例

```typescript
import { BedrockAgentCoreIdentityConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-identity-construct';

const identity = new BedrockAgentCoreIdentityConstruct(this, 'Identity', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  dynamoDbConfig: {
    tableName: 'agent-identity',
    readCapacity: 5,
    writeCapacity: 5,
  },
  rbacConfig: {
    enabled: true,
    defaultRole: AgentRole.USER,
  },
  abacConfig: {
    enabled: true,
    requiredAttributes: ['department', 'project'],
  },
  kmsConfig: {
    enabled: true,
  },
});
```

### エージェントID管理

#### エージェントID作成

```typescript
// Lambda関数経由でエージェントIDを作成
const response = await lambda.invoke({
  FunctionName: 'identity-function',
  Payload: JSON.stringify({
    action: 'create',
    role: 'User',
    attributes: {
      department: 'engineering',
      project: 'rag-system',
      sensitivity: 'confidential',
    },
  }),
});

// レスポンス例
{
  "statusCode": 201,
  "body": {
    "message": "エージェントIDが作成されました",
    "agentId": "agent-1234567890-abc123",
    "record": {
      "agentId": "agent-1234567890-abc123",
      "timestamp": 0,
      "role": "User",
      "attributes": {
        "department": "engineering",
        "project": "rag-system",
        "sensitivity": "confidential"
      },
      "createdAt": "2026-01-03T00:00:00.000Z",
      "updatedAt": "2026-01-03T00:00:00.000Z",
      "status": "active"
    }
  }
}
```

#### エージェントID更新

```typescript
const response = await lambda.invoke({
  FunctionName: 'identity-function',
  Payload: JSON.stringify({
    action: 'update',
    agentId: 'agent-1234567890-abc123',
    role: 'Admin',
    attributes: {
      department: 'engineering',
      project: 'rag-system',
      sensitivity: 'secret',
    },
  }),
});
```

#### エージェントID削除

```typescript
const response = await lambda.invoke({
  FunctionName: 'identity-function',
  Payload: JSON.stringify({
    action: 'delete',
    agentId: 'agent-1234567890-abc123',
  }),
});
```

### RBAC（ロールベースアクセス制御）

#### 標準ロール

Identity Constructは3つの標準ロールを提供します：

1. **Admin**: 全権限
   - 全てのBedrock操作が可能
   - エージェント管理が可能

2. **User**: 実行・参照権限
   - Bedrock Agentの実行
   - エージェント情報の参照
   - エージェントリストの参照

3. **ReadOnly**: 参照のみ
   - エージェント情報の参照
   - エージェントリストの参照

#### ロール割り当て

```typescript
const response = await lambda.invoke({
  FunctionName: 'identity-function',
  Payload: JSON.stringify({
    action: 'assignRole',
    agentId: 'agent-1234567890-abc123',
    role: 'Admin',
  }),
});
```

#### 権限チェック

```typescript
const response = await lambda.invoke({
  FunctionName: 'identity-function',
  Payload: JSON.stringify({
    action: 'checkPermission',
    agentId: 'agent-1234567890-abc123',
    permission: 'bedrock:InvokeAgent',
  }),
});

// レスポンス例
{
  "statusCode": 200,
  "body": {
    "agentId": "agent-1234567890-abc123",
    "role": "User",
    "permission": "bedrock:InvokeAgent",
    "allowed": true
  }
}
```

### ABAC（属性ベースアクセス制御）

#### 属性定義

Identity Constructは以下の属性をサポートします：

- **department**: 部署（例: engineering, sales, hr）
- **project**: プロジェクト（例: rag-system, chatbot）
- **sensitivity**: 機密度レベル（public, internal, confidential, secret）
- **customAttributes**: カスタム属性（任意のキー・バリュー）

#### ポリシー評価

```typescript
const response = await lambda.invoke({
  FunctionName: 'identity-function',
  Payload: JSON.stringify({
    action: 'evaluatePolicy',
    agentId: 'agent-1234567890-abc123',
    policy: {
      resource: 'bedrock:agent:12345',
      action: 'bedrock:InvokeAgent',
      conditions: {
        department: 'engineering',
        project: 'rag-system',
        sensitivity: 'confidential',
        customAttributes: {
          region: 'ap-northeast-1',
        },
      },
    },
  }),
});

// レスポンス例
{
  "statusCode": 200,
  "body": {
    "agentId": "agent-1234567890-abc123",
    "policy": { ... },
    "allowed": true,
    "evaluationDetails": [
      "部署チェック: ✓ (要求: engineering, 実際: engineering)",
      "プロジェクトチェック: ✓ (要求: rag-system, 実際: rag-system)",
      "機密度チェック: ✓ (要求: confidential, 実際: secret)",
      "カスタム属性 region: ✓ (要求: ap-northeast-1, 実際: ap-northeast-1)"
    ],
    "agentAttributes": {
      "department": "engineering",
      "project": "rag-system",
      "sensitivity": "secret",
      "customAttributes": {
        "region": "ap-northeast-1"
      }
    }
  }
}
```

#### 機密度レベルの階層

機密度レベルは階層構造になっています：

```
public < internal < confidential < secret
```

例えば、`secret`レベルのエージェントは、`confidential`、`internal`、`public`レベルのリソースにアクセスできます。

### トラブルシューティング

#### エージェントIDが作成できない

**原因**: DynamoDBテーブルが作成されていない、または権限がない

**解決策**:
1. DynamoDBテーブルの存在を確認
2. Lambda関数にDynamoDB書き込み権限を付与

#### ロール割り当てが失敗する

**原因**: 無効なロール名を指定している

**解決策**:
有効なロール名（Admin, User, ReadOnly）を指定

#### ポリシー評価が常にfalseになる

**原因**: 属性が一致していない

**解決策**:
1. エージェントの属性を確認
2. ポリシーの条件を確認
3. 評価詳細レポートを確認

---

## AgentCore Browser

### 概要

Browser Constructは、Headless Chromeによるブラウザ自動化機能を提供します。Puppeteerを使用してWebページのスクリーンショット撮影、Webスクレイピング、ブラウザ自動化を実行できます。

### 主な機能

- **Headless Chrome統合**: Puppeteer + @sparticuz/chromium
- **スクリーンショット撮影**: PNG/JPEG/WebP形式
- **Webスクレイピング**: Cheerioによる HTML解析
- **ブラウザ自動化**: クリック、入力、待機、スクロール
- **FSx for ONTAP統合**: S3 Access Points経由での透過的アクセス

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "bedrockAgentCore": {
    "browser": {
      "enabled": true,
      "lambda": {
        "memorySize": 2048,
        "timeout": 300,
        "ephemeralStorageSize": 2048
      },
      "screenshot": {
        "format": "png",
        "retentionDays": 7,
        "generateThumbnail": true
      },
      "scraping": {
        "rateLimit": 10,
        "respectRobotsTxt": true,
        "userAgent": "BedrockAgentCore-Browser/1.0"
      },
      "fsxS3AccessPointArn": "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point"
    }
  }
}
```

#### CDKコード例

```typescript
import { BedrockAgentCoreBrowserConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-browser-construct';

const browser = new BedrockAgentCoreBrowserConstruct(this, 'Browser', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  lambdaConfig: {
    memorySize: 2048,
    timeout: 300,
    ephemeralStorageSize: 2048,
  },
  screenshotConfig: {
    format: 'png',
    retentionDays: 7,
    generateThumbnail: true,
  },
  scrapingConfig: {
    rateLimit: 10,
    respectRobotsTxt: true,
    userAgent: 'BedrockAgentCore-Browser/1.0',
  },
  // FSx for ONTAP S3 Access Point ARNを指定（オプション）
  fsxS3AccessPointArn: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
});
```

### FSx for ONTAP S3 Access Points統合

#### 概要

Browser ConstructはFSx for ONTAP S3 Access Pointsと統合されており、S3 APIを使用してFSx for ONTAPに透過的にアクセスできます。これにより、高性能ストレージを活用した大容量ファイル（スクリーンショット、PDF等）の保存・取得が可能になります。

#### サポートされるS3 API操作

FSx for ONTAP S3 Access Pointsを介して、以下の全てのS3 API操作が可能です：

| 操作 | S3 API | 説明 | 使用例 |
|------|--------|------|--------|
| **書き込み** | `PutObject` | スクリーンショット、PDFなどのアップロード | スクリーンショット保存 |
| **読み込み** | `GetObject` | 保存済みファイルの取得・ダウンロード | スクリーンショット取得 |
| **削除** | `DeleteObject` | 不要なファイルの削除 | 古いファイル削除 |
| **一覧取得** | `ListObjectsV2` | バケット内のファイル一覧取得 | ファイル検索 |
| **メタデータ取得** | `HeadObject` | ファイルのメタデータ取得 | ファイル情報確認 |
| **コピー** | `CopyObject` | ファイルのコピー | バックアップ作成 |

**重要**: S3 APIは透過的にFSx for ONTAPにアクセスするため、Lambda関数のコードは通常のS3操作と全く同じです。

#### 設定方法

**1. FSx for ONTAP S3 Access Point ARNを取得**

```bash
# FSx for ONTAP S3 Access Pointを作成（AWS Console or CLI）
aws s3control create-access-point \
  --account-id 123456789012 \
  --name my-fsx-access-point \
  --bucket my-fsx-bucket

# Access Point ARNを取得
aws s3control get-access-point \
  --account-id 123456789012 \
  --name my-fsx-access-point \
  --query 'AccessPointArn' \
  --output text
```

**2. CDK Constructで設定**

```typescript
const browser = new BedrockAgentCoreBrowserConstruct(this, 'Browser', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  
  // FSx for ONTAP S3 Access Point ARNを指定
  fsxS3AccessPointArn: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
});
```

**3. Lambda関数での使用**

Lambda関数は自動的にFSx for ONTAP S3 Access Pointsを使用します。コード変更は不要です。

#### コード例

**スクリーンショット保存（Put）**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由でアップロード
await s3Client.send(
  new PutObjectCommand({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Key: 'screenshots/example.png',
    Body: screenshotData,
    ContentType: 'image/png',
  })
);
```

**スクリーンショット取得（Get）**

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由で取得
const response = await s3Client.send(
  new GetObjectCommand({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Key: 'screenshots/example.png',
  })
);

// ファイルデータを取得
const imageData = await response.Body.transformToByteArray();
```

**ファイル一覧取得（List）**

```typescript
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由で一覧取得
const response = await s3Client.send(
  new ListObjectsV2Command({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Prefix: 'screenshots/',
  })
);

// ファイル一覧を取得
const files = response.Contents?.map(obj => obj.Key) || [];
```

**ファイル削除（Delete）**

```typescript
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由で削除
await s3Client.send(
  new DeleteObjectCommand({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Key: 'screenshots/example.png',
  })
);
```

#### IAM権限

FSx for ONTAP S3 Access Pointsを使用する場合、Lambda実行ロールに以下の権限が必要です：

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket",
    "s3:HeadObject",
    "s3:CopyObject"
  ],
  "Resource": [
    "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point",
    "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point/*"
  ]
}
```

これらの権限は、CDK Constructが自動的に設定します。

#### FSx for ONTAP S3 Access Pointsの利点

1. **透過的アクセス**: S3 APIで透過的にアクセス可能
2. **高性能**: FSx for ONTAPの高性能ストレージを活用
3. **スケーラビリティ**: 大容量ファイルにも対応
4. **互換性**: 既存のS3クライアントコードをそのまま使用
5. **柔軟性**: 環境変数による柔軟な設定（FSx/S3の切り替え）
6. **全API対応**: Get, Put, Delete, List等、全てのS3 API操作が可能
7. **コスト効率**: 高性能ストレージを必要な時だけ使用

### Lambda関数の環境変数

Browser Lambda関数には以下の環境変数が自動設定されます：

- `PROJECT_NAME`: プロジェクト名
- `ENVIRONMENT`: 環境名（dev, staging, prod）
- `SCREENSHOT_BUCKET`: 通常のS3バケット名（FSx未使用時）
- `FSX_S3_ACCESS_POINT_ARN`: FSx for ONTAP S3 Access Point ARN
- `SCREENSHOT_FORMAT`: スクリーンショット形式（png, jpeg, webp）
- `GENERATE_THUMBNAIL`: サムネイル生成フラグ
- `RATE_LIMIT`: レート制限（リクエスト/分/ドメイン）
- `RESPECT_ROBOTS_TXT`: robots.txt尊重フラグ
- `USER_AGENT`: ユーザーエージェント

### API仕様

#### リクエスト

```typescript
interface BrowserRequest {
  url: string;
  action: 'SCREENSHOT' | 'SCRAPE' | 'AUTOMATE';
  options?: {
    viewport?: { width: number; height: number };
    waitFor?: string;
    timeout?: number;
  };
  automation?: {
    steps: AutomationStep[];
  };
}
```

#### レスポンス

```typescript
interface BrowserResponse {
  requestId: string;
  status: 'SUCCESS' | 'FAILED';
  result?: {
    screenshot?: string; // S3 URL or FSx S3 Access Point URL
    html?: string;
    data?: Record<string, any>;
  };
  error?: {
    code: string;
    message: string;
  };
  metrics: {
    latency: number;
    pageLoadTime: number;
  };
}
```

### 使用例

#### スクリーンショット撮影

```json
{
  "url": "https://example.com",
  "action": "SCREENSHOT",
  "options": {
    "viewport": { "width": 1920, "height": 1080 },
    "timeout": 30000
  }
}
```

#### Webスクレイピング

```json
{
  "url": "https://example.com",
  "action": "SCRAPE",
  "options": {
    "timeout": 30000
  }
}
```

#### ブラウザ自動化

```json
{
  "url": "https://example.com",
  "action": "AUTOMATE",
  "automation": {
    "steps": [
      { "type": "CLICK", "selector": "#button" },
      { "type": "TYPE", "selector": "#input", "value": "test" },
      { "type": "WAIT", "selector": "#result", "timeout": 5000 }
    ]
  }
}
```

### トラブルシューティング

#### Lambda関数がタイムアウトする

**原因**: ページ読み込みに時間がかかっている

**解決策**:
1. タイムアウト値を増やす（最大300秒）
2. `waitFor`オプションを調整
3. ページの読み込み状態を確認

#### スクリーンショットが保存されない

**原因**: S3バケットまたはFSx S3 Access Pointへのアクセス権限がない

**解決策**:
1. Lambda実行ロールのIAM権限を確認
2. S3バケットまたはFSx S3 Access Point ARNが正しいか確認
3. CloudWatch Logsでエラーを確認

#### FSx for ONTAP S3 Access Pointsにアクセスできない

**原因**: Access Point ARNが間違っている、またはIAM権限が不足している

**解決策**:
1. Access Point ARNが正しいか確認
2. Lambda実行ロールに必要な権限があるか確認
3. FSx for ONTAP S3 Access Pointが作成されているか確認

---

## AgentCore Code Interpreter

### 概要

Code Interpreter Constructは、Python/Node.jsコードの実行環境を提供します。Bedrock Agent Runtime APIを使用して、安全なサンドボックス環境でコードを実行できます。

### 主な機能

- **コード実行**: Python/Node.jsコードの実行
- **パッケージ管理**: pip/npmパッケージのインストール
- **ファイル操作**: ファイルの作成・読み込み・削除
- **ターミナルコマンド実行**: シェルコマンドの実行
- **セッション管理**: セッションごとの状態管理
- **セキュリティ**: ホワイトリスト方式のパッケージ管理、危険なコマンドのブロック

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "bedrockAgentCore": {
    "codeInterpreter": {
      "enabled": true,
      "lambda": {
        "memorySize": 3008,
        "timeout": 300,
        "ephemeralStorageSize": 2048
      },
      "execution": {
        "timeout": 60,
        "maxFileSize": 10485760,
        "allowedPackages": ["numpy", "pandas", "matplotlib", "requests"]
      },
      "kms": {
        "enabled": true
      }
    }
  }
}
```

#### CDKコード例

```typescript
import { BedrockAgentCoreCodeInterpreterConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-code-interpreter-construct';

const codeInterpreter = new BedrockAgentCoreCodeInterpreterConstruct(this, 'CodeInterpreter', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  lambdaConfig: {
    memorySize: 3008,
    timeout: 300,
    ephemeralStorageSize: 2048,
  },
  executionConfig: {
    timeout: 60,
    maxFileSize: 10485760,
    allowedPackages: ['numpy', 'pandas', 'matplotlib', 'requests'],
  },
  kmsConfig: {
    enabled: true,
  },
});
```

### API仕様

Code Interpreter Lambda関数は以下のAPIを提供します：

#### 1. セッション作成

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'createSession',
    userId: 'user-123',
    options: {
      language: 'python',
      timeout: 60,
    },
  }),
});

// レスポンス例
{
  "requestId": "req-1234567890",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "message": "セッションが作成されました",
    "language": "python",
    "timeout": 60
  },
  "metrics": {
    "latency": 50
  }
}
```

#### 2. コード実行

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'executeCode',
    sessionId: 'session-abc123',
    code: 'print("Hello, World!")',
    language: 'python',
    options: {
      timeout: 30,
    },
  }),
});

// レスポンス例
{
  "requestId": "req-1234567891",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "output": "Hello, World!\n",
    "error": "",
    "executionTime": 125
  },
  "metrics": {
    "latency": 200,
    "executionTime": 125
  }
}
```

#### 3. ファイル作成

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'createFile',
    sessionId: 'session-abc123',
    path: '/tmp/data.txt',
    content: 'Hello, File!',
  }),
});

// レスポンス例
{
  "requestId": "req-1234567892",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "message": "ファイルが作成されました",
    "path": "/tmp/data.txt",
    "size": 12
  },
  "metrics": {
    "latency": 75
  }
}
```

#### 4. ファイル読み込み

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'readFile',
    sessionId: 'session-abc123',
    path: '/tmp/data.txt',
  }),
});

// レスポンス例
{
  "requestId": "req-1234567893",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "content": "Hello, File!",
    "size": 12
  },
  "metrics": {
    "latency": 60
  }
}
```

#### 5. ファイル削除

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'deleteFile',
    sessionId: 'session-abc123',
    path: '/tmp/data.txt',
  }),
});

// レスポンス例
{
  "requestId": "req-1234567894",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "message": "ファイルが削除されました",
    "path": "/tmp/data.txt"
  },
  "metrics": {
    "latency": 55
  }
}
```

#### 6. ターミナルコマンド実行

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'executeCommand',
    sessionId: 'session-abc123',
    command: 'ls -la /tmp',
    options: {
      timeout: 30,
    },
  }),
});

// レスポンス例
{
  "requestId": "req-1234567895",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "output": "total 8\ndrwxr-xr-x  2 root root 4096 Jan  4 10:00 .\ndrwxr-xr-x 18 root root 4096 Jan  4 09:00 ..\n"
  },
  "metrics": {
    "latency": 180,
    "executionTime": 95
  }
}
```

#### 7. パッケージインストール

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'installPackage',
    sessionId: 'session-abc123',
    packageName: 'numpy',
    packageVersion: '1.24.0',
    packageManager: 'pip',
  }),
});

// レスポンス例
{
  "requestId": "req-1234567896",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "message": "パッケージがインストールされました",
    "packageName": "numpy",
    "packageVersion": "1.24.0"
  },
  "metrics": {
    "latency": 15000,
    "executionTime": 14500
  }
}
```

#### 8. パッケージ一覧取得

```typescript
const response = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'listPackages',
    sessionId: 'session-abc123',
    packageManager: 'pip',
  }),
});

// レスポンス例
{
  "requestId": "req-1234567897",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "packages": [
      { "name": "numpy", "version": "1.24.0" },
      { "name": "pandas", "version": "2.0.0" }
    ]
  },
  "metrics": {
    "latency": 250
  }
}
```

### セキュリティ機能

#### 1. パッケージホワイトリスト

Code Interpreterは、インストール可能なパッケージをホワイトリスト方式で管理します。

```typescript
// 許可されたパッケージのみインストール可能
const allowedPackages = [
  'numpy',
  'pandas',
  'matplotlib',
  'requests',
  'scikit-learn',
];
```

#### 2. 危険なコマンドのブロック

以下のコマンドは実行がブロックされます：

- `rm -rf`: ファイルシステムの破壊
- `dd`: ディスクの上書き
- `mkfs`: ファイルシステムのフォーマット
- `:(){:|:&};:`: Fork爆弾

#### 3. タイムアウト制御

コード実行とコマンド実行には、タイムアウトが設定されます：

- デフォルト: 60秒
- 最大: 300秒（Lambda関数のタイムアウト）

#### 4. ファイルサイズ制限

ファイル作成時のサイズ制限：

- デフォルト: 10MB
- 最大: Lambda Ephemeral Storageのサイズ（2GB）

### 使用例

#### Pythonコードの実行

```python
# データ分析の例
import pandas as pd
import numpy as np

# データ作成
data = {
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'score': [85, 90, 95]
}

df = pd.DataFrame(data)

# 統計情報
print(df.describe())

# 平均スコア
print(f"Average score: {df['score'].mean()}")
```

#### Node.jsコードの実行

```javascript
// データ処理の例
const data = [
  { name: 'Alice', age: 25, score: 85 },
  { name: 'Bob', age: 30, score: 90 },
  { name: 'Charlie', age: 35, score: 95 }
];

// 平均スコア計算
const avgScore = data.reduce((sum, item) => sum + item.score, 0) / data.length;
console.log(`Average score: ${avgScore}`);

// フィルタリング
const highScorers = data.filter(item => item.score >= 90);
console.log('High scorers:', highScorers);
```

### トラブルシューティング

#### コード実行がタイムアウトする

**原因**: コードの実行時間が長すぎる

**解決策**:
1. タイムアウト設定を増やす（最大300秒）
2. コードを最適化する
3. 処理を分割する

#### パッケージがインストールできない

**原因**: パッケージがホワイトリストに含まれていない

**解決策**:
1. `allowedPackages`にパッケージを追加
2. CDKを再デプロイ

#### ファイルが作成できない

**原因**: ファイルサイズが制限を超えている

**解決策**:
1. `maxFileSize`設定を増やす
2. ファイルを分割する

#### コマンド実行が失敗する

**原因**: 危険なコマンドがブロックされている

**解決策**:
安全なコマンドを使用する

---

## トラブルシューティング

## AgentCore Observability

### 概要

Observability Constructは、X-RayとCloudWatchを統合した包括的な可観測性を提供します。

### 主な機能

- **X-Ray分散トレーシング**: カスタムセグメント、サンプリングルール
- **CloudWatchカスタムメトリクス**: レイテンシ、エラー率、スループット
- **ダッシュボード自動生成**: リアルタイム監視
- **アラーム設定**: しきい値ベース、異常検知
- **エラー追跡**: ログ集約、根本原因分析（RCA）

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "agentCore": {
    "observability": {
      "enabled": true,
      "xrayConfig": {
        "enabled": true,
        "samplingRate": 0.1,
        "customSegments": ["bedrock-agent", "lambda-execution"]
      },
      "cloudwatchConfig": {
        "enabled": true,
        "dashboardEnabled": true,
        "alarmEnabled": true,
        "customMetrics": ["AgentLatency", "AgentErrorRate", "AgentThroughput"]
      },
      "errorTrackingConfig": {
        "enabled": true,
        "rcaEnabled": true,
        "logRetentionDays": 30
      }
    }
  }
}
```

#### CDK Stackでの使用

```typescript
import { BedrockAgentCoreObservabilityConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-observability-construct';

const observability = new BedrockAgentCoreObservabilityConstruct(this, 'Observability', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  xrayConfig: {
    enabled: true,
    samplingRate: 0.1,
    customSegments: ['bedrock-agent', 'lambda-execution'],
  },
  cloudwatchConfig: {
    enabled: true,
    dashboardEnabled: true,
    alarmEnabled: true,
    customMetrics: ['AgentLatency', 'AgentErrorRate', 'AgentThroughput'],
  },
  errorTrackingConfig: {
    enabled: true,
    rcaEnabled: true,
    logRetentionDays: 30,
  },
});

// Lambda関数に統合
observability.addLambdaIntegration(myLambdaFunction);
```

### Lambda関数の使用例

```typescript
// X-Rayトレーシング
const traceRequest = {
  action: 'trace',
  traceId: 'trace-abc123',
  segmentName: 'bedrock-agent-execution',
  metadata: {
    agentId: 'agent-123',
    userId: 'user-456',
  },
};

// カスタムメトリクス送信
const metricsRequest = {
  action: 'sendMetrics',
  metrics: [
    { name: 'AgentLatency', value: 250, unit: 'Milliseconds' },
    { name: 'AgentErrorRate', value: 0.01, unit: 'Percent' },
  ],
};

// エラー追跡
const errorRequest = {
  action: 'trackError',
  error: {
    message: 'Agent execution failed',
    stack: '...',
    context: { agentId: 'agent-123' },
  },
};
```

---

## AgentCore Evaluations

### 概要

Evaluations Constructは、13の組み込み評価器とA/Bテスト機能を提供します。

### 主な機能

- **品質メトリクス**: 13の評価器（正確性、関連性、有用性、一貫性、完全性、簡潔性、明瞭性、文法、トーン、バイアス、有害性、事実性、引用品質）
- **A/Bテスト**: トラフィック分割、統計的有意性検定、自動最適化
- **パフォーマンス評価**: レイテンシ、スループット、コスト分析
- **評価結果保存**: S3 + DynamoDB
- **ダッシュボード可視化**: CloudWatch統合

### 設定方法

#### cdk.context.jsonの設定

```json
{
  "agentCore": {
    "evaluations": {
      "enabled": true,
      "qualityMetricsConfig": {
        "enabled": true,
        "evaluators": ["accuracy", "relevance", "helpfulness", "consistency"],
        "bedrockModelId": "anthropic.claude-3-sonnet-20240229-v1:0"
      },
      "abTestConfig": {
        "enabled": true,
        "trafficSplitRatio": 0.5,
        "minSampleSize": 100,
        "confidenceLevel": 0.95
      },
      "performanceEvaluationConfig": {
        "enabled": true,
        "latencyThreshold": 1000,
        "throughputThreshold": 100
      }
    }
  }
}
```

#### CDK Stackでの使用

```typescript
import { BedrockAgentCoreEvaluationsConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-evaluations-construct';

const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  qualityMetricsConfig: {
    enabled: true,
    evaluators: ['accuracy', 'relevance', 'helpfulness', 'consistency'],
    bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
  abTestConfig: {
    enabled: true,
    trafficSplitRatio: 0.5,
    minSampleSize: 100,
    confidenceLevel: 0.95,
  },
  performanceEvaluationConfig: {
    enabled: true,
    latencyThreshold: 1000,
    throughputThreshold: 100,
  },
});

// Lambda関数に評価権限を付与
evaluations.addEvaluationPermissionsToLambdas([myLambdaFunction]);
```

### Lambda関数の使用例

```typescript
// 品質評価
const evaluateRequest = {
  action: 'evaluate',
  evaluator: 'accuracy',
  input: 'ユーザーの質問',
  output: 'エージェントの回答',
  reference: '正解データ',
};

// A/Bテスト
const abTestRequest = {
  action: 'determineVariant',
  testId: 'test-123',
  userId: 'user-456',
};

// パフォーマンス評価
const performanceRequest = {
  action: 'evaluatePerformance',
  agentId: 'agent-123',
  metrics: {
    latency: 250,
    throughput: 150,
    errorRate: 0.01,
  },
};
```

---

## トラブルシューティング

### Phase 3関連の問題

#### Observability: X-Rayトレースが表示されない

**原因**: X-Rayが有効化されていない、またはサンプリングレートが低すぎる

**解決策**:
1. Lambda関数でX-Rayトレーシングが有効化されているか確認
2. サンプリングレートを上げる（例: 0.1 → 1.0）
3. X-Ray Groupが正しく作成されているか確認

#### Evaluations: 評価結果が保存されない

**原因**: S3バケットまたはDynamoDBテーブルへのアクセス権限が不足

**解決策**:
1. Lambda関数のIAMロールにS3/DynamoDB権限を付与
2. S3バケットとDynamoDBテーブルが正しく作成されているか確認
3. CloudWatch Logsでエラーを確認

#### Policy: Cedar検証が失敗する

**原因**: Cedar Policy Languageの構文エラー

**解決策**:
1. Cedar構文を確認（[Cedar Language Guide](https://docs.cedarpolicy.com/)）
2. ポリシーバリデーターでテスト
3. 自然言語ポリシーから再生成

### 共通の問題

#### CDKデプロイが失敗する

**原因**: 設定が間違っている、またはリソースが既に存在する

**解決策**:
1. `cdk.context.json`の設定を確認
2. `npx cdk diff`で差分を確認
3. 既存リソースを削除または名前を変更

#### Lambda関数が起動しない

**原因**: 環境変数が設定されていない、またはVPC設定が間違っている

**解決策**:
1. Lambda関数の環境変数を確認
2. VPC設定（サブネット、セキュリティグループ）を確認
3. CloudWatch Logsでエラーを確認

#### DynamoDBテーブルにアクセスできない

**原因**: IAM権限が不足している

**解決策**:
Lambda関数にDynamoDB読み書き権限を付与

### デバッグ方法

#### CloudWatch Logsの確認

```bash
# Lambda関数のログを確認
aws logs tail /aws/lambda/my-function --follow

# 特定のエラーを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --filter-pattern "ERROR"
```

#### X-Rayトレースの確認

```bash
# X-Rayトレースを確認
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)
```

---

## 📚 関連ドキュメント

- [クイックスタートガイド](./quick-start.md)
- [FAQ](./faq.md)
- [デプロイメントガイド](./deployment-guide.md)

---

**最終更新**: 2026-01-04


---

## 🎉 Phase 4: CDKスタック統合完了

**完了日**: 2026-01-04  
**ステータス**: ✅ 完了

### 統合概要

Amazon Bedrock AgentCoreの9つのConstructを3つのCDKスタックに統合し、本番環境デプロイの準備が完了しました。

### 統合されたスタック

#### 1. WebAppStack（5 Constructs）

**統合Constructs**:
- Runtime: イベント駆動実行
- Gateway: API/Lambda/MCP統合
- Memory: フルマネージドメモリ
- Browser: ヘッドレスChrome統合
- CodeInterpreter: コード実行環境

**CloudFormation Outputs**:
- `AgentCoreRuntimeFunctionArn`: Runtime Lambda関数ARN
- `AgentCoreGatewayRestApiConverterArn`: Gateway REST API変換関数ARN
- `AgentCoreMemoryResourceId`: Memory Resource ID
- `AgentCoreBrowserFunctionArn`: Browser Lambda関数ARN
- `AgentCoreCodeInterpreterFunctionArn`: Code Interpreter Lambda関数ARN

#### 2. SecurityStack（2 Constructs）

**統合Constructs**:
- Identity: 認証・認可（RBAC/ABAC）
- Policy: 自然言語ポリシー管理

**CloudFormation Outputs**:
- `AgentCoreIdentityFunctionArn`: Identity Lambda関数ARN
- `AgentCoreIdentityTableName`: Identity DynamoDBテーブル名
- `AgentCorePolicyFunctionArn`: Policy Lambda関数ARN
- `AgentCorePolicyTableName`: Policy DynamoDBテーブル名

#### 3. OperationsStack（2 Constructs）

**統合Constructs**:
- Observability: X-Ray/CloudWatch統合
- Evaluations: 品質評価・A/Bテスト

**CloudFormation Outputs**:
- `AgentCoreObservabilityFunctionArn`: Observability Lambda関数ARN
- `AgentCoreObservabilityDashboardName`: CloudWatchダッシュボード名
- `AgentCoreEvaluationsFunctionArn`: Evaluations Lambda関数ARN
- `AgentCoreEvaluationsTableName`: Evaluations DynamoDBテーブル名

### デプロイ方法

#### 1. 設定ファイルの選択

```bash
# 最小構成（Runtime + Memory のみ）
cp cdk.context.json.minimal cdk.context.json

# 完全構成（全9コンポーネント有効）
cp cdk.context.json.example cdk.context.json

# 本番推奨構成
cp cdk.context.json.production cdk.context.json
```

#### 2. 必要な機能を有効化

```json
{
  "agentCore": {
    "runtime": { "enabled": true },
    "gateway": { "enabled": true },
    "memory": { "enabled": true },
    "identity": { "enabled": true },
    "browser": { "enabled": true },
    "codeInterpreter": { "enabled": true },
    "observability": { "enabled": true },
    "evaluations": { "enabled": true },
    "policy": { "enabled": true }
  }
}
```

#### 3. デプロイ実行

```bash
# 全スタックデプロイ
npx cdk deploy --all

# 特定のスタックのみデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Security
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Operations
```

#### 4. デプロイ後の確認

```bash
# CloudFormation Outputsを確認
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs' \
  --output table

# Lambda関数の確認
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `TokyoRegion-permission-aware-rag-prod-AgentCore`)].FunctionName' \
  --output table

# DynamoDBテーブルの確認
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `AgentCore`)]' \
  --output table
```

### 検証結果

#### TypeScriptコンパイル

```bash
$ npm run build
# 結果: 0 errors ✅
```

#### CDK Synth

```bash
$ npx cdk synth --quiet
# 結果: 6スタック正常生成 ✅
# - NetworkingStack
# - SecurityStack
# - DataStack
# - EmbeddingStack
# - WebAppStack
# - OperationsStack
```

#### テスト結果

- **型定義バリデーション**: 25テスト合格 ✅
- **設定例バリデーション**: 4テスト合格 ✅
- **CloudFormation Outputs**: 18 Outputs実装 ✅

### 次のステップ

#### TASK-4.2: 本番環境デプロイ準備

1. **デプロイスクリプト作成**
   - 統合デプロイスクリプト
   - ロールバックスクリプト
   - ヘルスチェックスクリプト

2. **環境別設定**
   - 開発環境設定
   - ステージング環境設定
   - 本番環境設定

3. **デプロイ検証**
   - 統合テスト実行
   - パフォーマンステスト
   - セキュリティスキャン

### 完了レポート

詳細は以下のレポートを参照してください：
- [Phase 4 Task 4.1 完了レポート](../../development/docs/reports/local/01-04-phase-4-task-4-1-cdk-stack-integration-completion-report.md)

---

**最終更新**: 2026-01-04  
**Phase 4完了**: 2026-01-04
