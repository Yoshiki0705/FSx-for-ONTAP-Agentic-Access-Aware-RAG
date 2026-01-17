# Amazon Bedrock AgentCore Gateway - API仕様書

**作成日**: 2026-01-03  
**最終更新**: 2026-01-03  
**バージョン**: 1.0.0  
**対象**: Phase 1 - Gateway Construct

---

## 📋 目次

1. [概要](#概要)
2. [Construct API](#construct-api)
3. [REST API変換仕様](#rest-api変換仕様)
4. [Lambda関数変換仕様](#lambda関数変換仕様)
5. [MCPサーバー統合仕様](#mcpサーバー統合仕様)
6. [エラーコード一覧](#エラーコード一覧)
7. [型定義](#型定義)

---

## 概要

このドキュメントは、Amazon Bedrock AgentCore Gateway Constructの完全なAPI仕様を提供します。

### APIバージョン

- **Construct API**: v1.0.0
- **REST API Converter API**: v1.0.0
- **Lambda Function Converter API**: v1.0.0
- **MCP Server Integration API**: v1.0.0

### 対応言語

- **TypeScript**: 5.3以上
- **Node.js**: 20.x以上

---

## Construct API

### BedrockAgentCoreGatewayConstruct

#### クラス定義

```typescript
export class BedrockAgentCoreGatewayConstruct extends Construct {
  public readonly restApiConverterFunction?: lambda.Function;
  public readonly lambdaConverterFunction?: lambda.Function;
  public readonly mcpIntegrationFunction?: lambda.Function;
  public readonly kmsKey: kms.Key;
  public readonly executionRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: BedrockAgentCoreGatewayConstructProps
  );
}
```

#### プロパティ

| プロパティ | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `enabled` | `boolean` | Gateway機能の有効化フラグ | ✅ |
| `projectName` | `string` | プロジェクト名 | ✅ |
| `environment` | `string` | 環境名（dev, staging, prod） | ✅ |
| `restApiConversion` | `RestApiConversionConfig` | REST API変換設定 | ❌ |
| `lambdaFunctionConversion` | `LambdaFunctionConversionConfig` | Lambda関数変換設定 | ❌ |
| `mcpServerIntegration` | `McpServerIntegrationConfig` | MCPサーバー統合設定 | ❌ |
| `kms` | `KmsConfig` | KMS設定 | ❌ |
| `vpc` | `VpcConfig` | VPC設定 | ❌ |

#### メソッド

##### createRestApiConverterFunction()

REST API変換Lambda関数を作成します。

**シグネチャ**:
```typescript
private createRestApiConverterFunction(): lambda.Function
```

**戻り値**:
- `lambda.Function`: 作成されたLambda関数

**例外**:
- `Error`: Lambda関数の作成に失敗した場合

---

##### createLambdaConverterFunction()

Lambda関数変換Lambda関数を作成します。

**シグネチャ**:
```typescript
private createLambdaConverterFunction(): lambda.Function
```

**戻り値**:
- `lambda.Function`: 作成されたLambda関数

**例外**:
- `Error`: Lambda関数の作成に失敗した場合

---

##### createMcpIntegrationFunction()

MCPサーバー統合Lambda関数を作成します。

**シグネチャ**:
```typescript
private createMcpIntegrationFunction(): lambda.Function
```

**戻り値**:
- `lambda.Function`: 作成されたLambda関数

**例外**:
- `Error`: Lambda関数の作成に失敗した場合

---

##### createKmsKey()

KMS Keyを作成します。

**シグネチャ**:
```typescript
private createKmsKey(): kms.Key
```

**戻り値**:
- `kms.Key`: 作成されたKMS Key

**例外**:
- `Error`: KMS Keyの作成に失敗した場合

---

##### createExecutionRole()

Lambda実行ロールを作成します。

**シグネチャ**:
```typescript
private createExecutionRole(): iam.Role
```

**戻り値**:
- `iam.Role`: 作成されたLambda実行ロール

**例外**:
- `Error`: Lambda実行ロールの作成に失敗した場合

---

#### 使用例

```typescript
import { BedrockAgentCoreGatewayConstruct } from './constructs/bedrock-agent-core-gateway-construct';

// Gateway Construct作成
const gateway = new BedrockAgentCoreGatewayConstruct(this, 'Gateway', {
  enabled: true,
  projectName: 'permission-aware-rag',
  environment: 'prod',
  restApiConversion: {
    enabled: true,
    openApiSpecPath: 's3://my-bucket/openapi.yaml',
  },
  lambdaFunctionConversion: {
    enabled: true,
    functionArns: [
      'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function',
    ],
  },
  mcpServerIntegration: {
    enabled: true,
    serverEndpoint: 'https://mcp-server.example.com/tools',
    authentication: {
      type: 'API_KEY',
      apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-key',
    },
  },
});

// Lambda関数ARNを取得
const restApiConverterArn = gateway.restApiConverterFunction?.functionArn;
console.log(`REST API Converter ARN: ${restApiConverterArn}`);
```

---

## REST API変換仕様

### handler()

REST API変換Lambda関数のエントリーポイントです。

#### シグネチャ

```typescript
export async function handler(
  event: RestApiConverterEvent
): Promise<RestApiConverterResponse>
```

#### パラメータ

**event**: `RestApiConverterEvent`

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `openApiSpecPath` | `string` | OpenAPI仕様ファイルのパス（S3 URIまたはローカルパス） | ✅ |
| `toolNamePrefix` | `string` | Tool名プレフィックス | ❌ |
| `excludePatterns` | `string[]` | 除外するエンドポイントのパターン（正規表現） | ❌ |

#### 戻り値

**RestApiConverterResponse**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | `boolean` | 成功フラグ |
| `toolDefinitions` | `ToolDefinition[]` | 生成されたTool定義リスト |
| `error` | `string` | エラーメッセージ（失敗時） |

#### 例外

- `Error`: OpenAPI仕様の読み込みエラー
- `ValidationError`: パラメータ検証エラー
- `ConversionError`: Tool定義生成エラー

#### 使用例

```typescript
// イベント作成
const event: RestApiConverterEvent = {
  openApiSpecPath: 's3://my-bucket/openapi.yaml',
  toolNamePrefix: 'api_',
  excludePatterns: ['/internal/.*', '/admin/.*'],
};

// Lambda関数呼び出し
const response = await handler(event);

// レスポンス確認
if (response.success) {
  console.log(`Generated ${response.toolDefinitions.length} tool definitions`);
  response.toolDefinitions.forEach(tool => {
    console.log(`Tool: ${tool.name}`);
  });
} else {
  console.error(`Error: ${response.error}`);
}
```

---

### loadOpenApiSpec()

OpenAPI仕様を読み込みます。

#### シグネチャ

```typescript
async function loadOpenApiSpec(
  specPath: string
): Promise<OpenApiSpec>
```

#### パラメータ

**specPath**: `string`
- OpenAPI仕様ファイルのパス（S3 URI、S3 Access Point ARN、またはローカルパス）

#### 戻り値

**OpenApiSpec**
- 読み込まれたOpenAPI仕様オブジェクト

#### 例外

- `Error`: ファイルの読み込みエラー
- `ValidationError`: OpenAPI仕様の形式エラー

---

### convertOpenApiToToolDefinitions()

OpenAPI仕様からBedrock Agent Tool定義を生成します。

#### シグネチャ

```typescript
function convertOpenApiToToolDefinitions(
  spec: OpenApiSpec,
  options: {
    toolNamePrefix?: string;
    excludePatterns?: string[];
  }
): ToolDefinition[]
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `spec` | `OpenApiSpec` | OpenAPI仕様オブジェクト | ✅ |
| `options.toolNamePrefix` | `string` | Tool名プレフィックス | ❌ |
| `options.excludePatterns` | `string[]` | 除外パターン | ❌ |

#### 戻り値

**ToolDefinition[]**
- 生成されたTool定義リスト

---

## Lambda関数変換仕様

### handler()

Lambda関数変換Lambda関数のエントリーポイントです。

#### シグネチャ

```typescript
export async function handler(
  event: LambdaFunctionConverterEvent
): Promise<LambdaFunctionConverterResponse>
```

#### パラメータ

**event**: `LambdaFunctionConverterEvent`

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `functionArns` | `string[]` | 変換対象のLambda関数ARNリスト | ✅ |
| `toolNamePrefix` | `string` | Tool名プレフィックス | ❌ |
| `schemaGenerationMethod` | `'auto' \| 'tags' \| 'manual'` | Input Schema生成方法 | ❌ |

#### 戻り値

**LambdaFunctionConverterResponse**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | `boolean` | 成功フラグ |
| `toolDefinitions` | `ToolDefinition[]` | 生成されたTool定義リスト |
| `error` | `string` | エラーメッセージ（失敗時） |

#### 例外

- `Error`: Lambda関数メタデータ取得エラー
- `ValidationError`: パラメータ検証エラー
- `ConversionError`: Tool定義生成エラー

#### 使用例

```typescript
// イベント作成
const event: LambdaFunctionConverterEvent = {
  functionArns: [
    'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function-1',
    'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function-2',
  ],
  toolNamePrefix: 'lambda_',
  schemaGenerationMethod: 'tags',
};

// Lambda関数呼び出し
const response = await handler(event);

// レスポンス確認
if (response.success) {
  console.log(`Generated ${response.toolDefinitions.length} tool definitions`);
  response.toolDefinitions.forEach(tool => {
    console.log(`Tool: ${tool.name}`);
  });
} else {
  console.error(`Error: ${response.error}`);
}
```

---

### getLambdaFunctionMetadata()

Lambda関数のメタデータを取得します。

#### シグネチャ

```typescript
async function getLambdaFunctionMetadata(
  functionArn: string
): Promise<LambdaFunctionMetadata>
```

#### パラメータ

**functionArn**: `string`
- Lambda関数ARN

#### 戻り値

**LambdaFunctionMetadata**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `functionName` | `string` | 関数名 |
| `functionArn` | `string` | 関数ARN |
| `description` | `string` | 関数の説明 |
| `tags` | `Record<string, string>` | 関数のタグ |
| `environment` | `Record<string, string>` | 環境変数 |

#### 例外

- `Error`: Lambda関数が見つからない
- `AccessDeniedException`: アクセス権限がない

---

### generateInputSchema()

Lambda関数のInput Schemaを生成します。

#### シグネチャ

```typescript
function generateInputSchema(
  metadata: LambdaFunctionMetadata,
  method: 'auto' | 'tags' | 'manual'
): object
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `metadata` | `LambdaFunctionMetadata` | Lambda関数メタデータ | ✅ |
| `method` | `'auto' \| 'tags' \| 'manual'` | 生成方法 | ✅ |

**生成方法**:
- `auto`: 関数名と説明から自動生成
- `tags`: 関数のタグから生成
- `manual`: 環境変数から生成

#### 戻り値

**object**
- 生成されたInput Schema（JSON Schema形式）

---

## MCPサーバー統合仕様

### handler()

MCPサーバー統合Lambda関数のエントリーポイントです。

#### シグネチャ

```typescript
export async function handler(
  event: McpServerIntegrationEvent
): Promise<McpServerIntegrationResponse>
```

#### パラメータ

**event**: `McpServerIntegrationEvent`

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `serverEndpoint` | `string` | MCPサーバーのエンドポイントURL | ✅ |
| `authenticationType` | `'API_KEY' \| 'OAUTH2' \| 'NONE'` | 認証タイプ | ✅ |
| `apiKeySecretArn` | `string` | APIキー（Secrets Manager ARN） | ❌ |
| `oauth2Config` | `OAuth2Config` | OAuth2設定 | ❌ |
| `toolNamePrefix` | `string` | Tool名プレフィックス | ❌ |
| `filterToolNames` | `string[]` | フィルターするTool名リスト | ❌ |

#### 戻り値

**McpServerIntegrationResponse**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | `boolean` | 成功フラグ |
| `toolDefinitions` | `ToolDefinition[]` | 生成されたTool定義リスト |
| `error` | `string` | エラーメッセージ（失敗時） |

#### 例外

- `Error`: MCPサーバー接続エラー
- `AuthenticationError`: 認証エラー
- `ValidationError`: パラメータ検証エラー
- `ConversionError`: Tool定義生成エラー

#### 使用例

```typescript
// イベント作成（API Key認証）
const event: McpServerIntegrationEvent = {
  serverEndpoint: 'https://mcp-server.example.com/tools',
  authenticationType: 'API_KEY',
  apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-key',
  toolNamePrefix: 'mcp_',
  filterToolNames: ['search', 'analyze', 'summarize'],
};

// Lambda関数呼び出し
const response = await handler(event);

// レスポンス確認
if (response.success) {
  console.log(`Generated ${response.toolDefinitions.length} tool definitions`);
  response.toolDefinitions.forEach(tool => {
    console.log(`Tool: ${tool.name}`);
  });
} else {
  console.error(`Error: ${response.error}`);
}
```

---

### fetchMcpTools()

MCPサーバーからTool定義を取得します。

#### シグネチャ

```typescript
async function fetchMcpTools(
  endpoint: string,
  authConfig: {
    type: 'API_KEY' | 'OAUTH2' | 'NONE';
    apiKey?: string;
    oauth2Token?: string;
  }
): Promise<McpToolDefinition[]>
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `endpoint` | `string` | MCPサーバーエンドポイント | ✅ |
| `authConfig.type` | `'API_KEY' \| 'OAUTH2' \| 'NONE'` | 認証タイプ | ✅ |
| `authConfig.apiKey` | `string` | APIキー | ❌ |
| `authConfig.oauth2Token` | `string` | OAuth2トークン | ❌ |

#### 戻り値

**McpToolDefinition[]**
- MCPサーバーから取得したTool定義リスト

#### 例外

- `Error`: HTTP接続エラー
- `AuthenticationError`: 認証エラー

**重要**: MCPサーバーは `/tools` エンドポイントでTool定義を提供する必要があります。Lambda環境ではWebSocketの直接使用が制限されているため、HTTP/HTTPSエンドポイント経由でTool定義を取得します。

---

### convertMcpToolToBedrockTool()

MCP Tool定義をBedrock Agent Tool定義に変換します。

#### シグネチャ

```typescript
function convertMcpToolToBedrockTool(
  mcpTool: McpToolDefinition,
  options: {
    toolNamePrefix?: string;
  }
): ToolDefinition
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `mcpTool` | `McpToolDefinition` | MCP Tool定義 | ✅ |
| `options.toolNamePrefix` | `string` | Tool名プレフィックス | ❌ |

#### 戻り値

**ToolDefinition**
- 変換されたBedrock Agent Tool定義

---

### getOAuth2Token()

OAuth2トークンを取得します。

#### シグネチャ

```typescript
async function getOAuth2Token(
  config: {
    clientId: string;
    clientSecret: string;
    tokenEndpoint: string;
  }
): Promise<string>
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `config.clientId` | `string` | クライアントID | ✅ |
| `config.clientSecret` | `string` | クライアントシークレット | ✅ |
| `config.tokenEndpoint` | `string` | トークンエンドポイント | ✅ |

#### 戻り値

**string**
- OAuth2アクセストークン

#### 例外

- `Error`: トークン取得エラー
- `AuthenticationError`: 認証エラー

---

## エラーコード一覧

### REST API変換エラー

| エラーコード | 説明 | HTTPステータス | 対処方法 |
|------------|------|---------------|---------|
| `MISSING_PARAMETER` | 必須パラメータが不足 | 400 | パラメータを確認 |
| `INVALID_OPENAPI_SPEC` | OpenAPI仕様が不正 | 400 | OpenAPI仕様を確認 |
| `SPEC_NOT_FOUND` | OpenAPI仕様が見つからない | 404 | ファイルパスを確認 |
| `S3_ACCESS_DENIED` | S3アクセス拒否 | 403 | IAM権限を確認 |
| `CONVERSION_ERROR` | Tool定義生成エラー | 500 | Lambda Logsを確認 |
| `INTERNAL_ERROR` | 内部エラー | 500 | Lambda Logsを確認 |

### Lambda関数変換エラー

| エラーコード | 説明 | HTTPステータス | 対処方法 |
|------------|------|---------------|---------|
| `MISSING_PARAMETER` | 必須パラメータが不足 | 400 | パラメータを確認 |
| `INVALID_FUNCTION_ARN` | Lambda関数ARNが不正 | 400 | ARNを確認 |
| `FUNCTION_NOT_FOUND` | Lambda関数が見つからない | 404 | 関数名を確認 |
| `ACCESS_DENIED` | アクセス拒否 | 403 | IAM権限を確認 |
| `METADATA_NOT_FOUND` | メタデータが見つからない | 404 | タグ・環境変数を確認 |
| `CONVERSION_ERROR` | Tool定義生成エラー | 500 | Lambda Logsを確認 |
| `INTERNAL_ERROR` | 内部エラー | 500 | Lambda Logsを確認 |

### MCPサーバー統合エラー

| エラーコード | 説明 | HTTPステータス | 対処方法 |
|------------|------|---------------|---------|
| `MISSING_PARAMETER` | 必須パラメータが不足 | 400 | パラメータを確認 |
| `INVALID_ENDPOINT` | エンドポイントが不正 | 400 | エンドポイントを確認 |
| `CONNECTION_ERROR` | MCPサーバー接続エラー | 500 | エンドポイントを確認 |
| `AUTHENTICATION_ERROR` | 認証エラー | 401 | 認証情報を確認 |
| `TOOLS_NOT_FOUND` | Tool定義が見つからない | 404 | MCPサーバーを確認 |
| `CONVERSION_ERROR` | Tool定義生成エラー | 500 | Lambda Logsを確認 |
| `INTERNAL_ERROR` | 内部エラー | 500 | Lambda Logsを確認 |

---

## 型定義

### BedrockAgentCoreGatewayConstructProps

```typescript
export interface BedrockAgentCoreGatewayConstructProps {
  enabled: boolean;
  projectName: string;
  environment: string;
  restApiConversion?: RestApiConversionConfig;
  lambdaFunctionConversion?: LambdaFunctionConversionConfig;
  mcpServerIntegration?: McpServerIntegrationConfig;
  kms?: KmsConfig;
  vpc?: VpcConfig;
}
```

### RestApiConversionConfig

```typescript
export interface RestApiConversionConfig {
  readonly enabled: boolean;
  readonly openApiSpecPath: string;
  readonly apiGatewayIntegration?: {
    readonly apiId: string;
    readonly stageName: string;
    readonly authType?: 'IAM' | 'COGNITO' | 'API_KEY' | 'NONE';
  };
  readonly conversionOptions?: {
    readonly autoGenerateToolDefinitions?: boolean;
    readonly toolNamePrefix?: string;
    readonly excludePatterns?: string[];
  };
  readonly fsxIntegration?: {
    readonly enabled: boolean;
    readonly fileSystemId: string;
    readonly volumePath: string;
  };
}
```

### LambdaFunctionConversionConfig

```typescript
export interface LambdaFunctionConversionConfig {
  readonly enabled: boolean;
  readonly functionArns: string[];
  readonly metadataSource?: {
    readonly useTags?: boolean;
    readonly useEnvironmentVariables?: boolean;
    readonly customMetadataProvider?: string;
  };
  readonly conversionOptions?: {
    readonly autoGenerateToolDefinitions?: boolean;
    readonly toolNamePrefix?: string;
    readonly timeout?: number;
  };
}
```

### McpServerIntegrationConfig

```typescript
export interface McpServerIntegrationConfig {
  readonly enabled: boolean;
  readonly serverEndpoint: string;
  readonly authentication?: {
    readonly type: 'API_KEY' | 'OAUTH2' | 'NONE';
    readonly apiKeySecretArn?: string;
    readonly oauth2Config?: {
      readonly clientId: string;
      readonly clientSecretArn: string;
      readonly tokenEndpoint: string;
    };
  };
  readonly conversionOptions?: {
    readonly autoGenerateToolDefinitions?: boolean;
    readonly toolNamePrefix?: string;
    readonly filterToolNames?: string[];
  };
}
```

### ToolDefinition

```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### RestApiConverterEvent

```typescript
export interface RestApiConverterEvent {
  openApiSpecPath: string;
  toolNamePrefix?: string;
  excludePatterns?: string[];
}
```

### RestApiConverterResponse

```typescript
export type RestApiConverterResponse = 
  | {
      success: true;
      toolDefinitions: ToolDefinition[];
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    };
```

### LambdaFunctionConverterEvent

```typescript
export interface LambdaFunctionConverterEvent {
  functionArns: string[];
  toolNamePrefix?: string;
  schemaGenerationMethod?: 'auto' | 'tags' | 'manual';
}
```

### LambdaFunctionConverterResponse

```typescript
export type LambdaFunctionConverterResponse = 
  | {
      success: true;
      toolDefinitions: ToolDefinition[];
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    };
```

### McpServerIntegrationEvent

```typescript
export interface McpServerIntegrationEvent {
  serverEndpoint: string;
  authenticationType: 'API_KEY' | 'OAUTH2' | 'NONE';
  apiKeySecretArn?: string;
  oauth2Config?: {
    clientId: string;
    clientSecretArn: string;
    tokenEndpoint: string;
  };
  toolNamePrefix?: string;
  filterToolNames?: string[];
}
```

### McpServerIntegrationResponse

```typescript
export type McpServerIntegrationResponse = 
  | {
      success: true;
      toolDefinitions: ToolDefinition[];
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    };
```

### OpenApiSpec

```typescript
export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
  };
}
```

### LambdaFunctionMetadata

```typescript
export interface LambdaFunctionMetadata {
  functionName: string;
  functionArn: string;
  description: string;
  tags: Record<string, string>;
  environment: Record<string, string>;
}
```

### McpToolDefinition

```typescript
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}
```

### KmsConfig

```typescript
export interface KmsConfig {
  keyArn?: string;
}
```

### VpcConfig

```typescript
export interface VpcConfig {
  vpcId: string;
  subnetIds: string[];
  securityGroupIds: string[];
}
```

---

## バージョン履歴

### v1.0.0 (2026-01-03)

- 初版リリース
- Construct API定義
- REST API変換仕様定義
- Lambda関数変換仕様定義
- MCPサーバー統合仕様定義
- エラーコード一覧定義
- 型定義定義

---

## 参考リンク

### AWS公式ドキュメント

- [Amazon Bedrock AgentCore API Reference](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda API Reference](https://docs.aws.amazon.com/lambda/)
- [Amazon API Gateway API Reference](https://docs.aws.amazon.com/apigateway/)
- [AWS Secrets Manager API Reference](https://docs.aws.amazon.com/secretsmanager/)

### プロジェクトドキュメント

- [gateway-configuration-guide.md](./gateway-configuration-guide.md) - 設定ガイド
- [requirements.md](../../.kiro/specs/bedrock-agent-core-features/requirements.md) - 完全な要件定義
- [tasks.md](../../.kiro/specs/bedrock-agent-core-features/tasks.md) - タスクリスト

---

**作成者**: Kiro AI  
**作成日**: 2026-01-03  
**ステータス**: ✅ 完成  
**バージョン**: 1.0.0
