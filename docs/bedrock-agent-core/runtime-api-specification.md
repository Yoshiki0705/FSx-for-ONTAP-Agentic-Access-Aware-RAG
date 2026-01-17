# Amazon Bedrock AgentCore Runtime - API仕様書

**作成日**: 2026-01-03  
**最終更新**: 2026-01-03  
**バージョン**: 1.0.0  
**対象**: Phase 1 - Runtime Construct

---

## 📋 目次

1. [概要](#概要)
2. [Construct API](#construct-api)
3. [Lambda関数API](#lambda関数api)
4. [EventBridge仕様](#eventbridge仕様)
5. [エラーコード一覧](#エラーコード一覧)
6. [型定義](#型定義)

---

## 概要

このドキュメントは、Amazon Bedrock AgentCore Runtime Constructの完全なAPI仕様を提供します。

### APIバージョン

- **Construct API**: v1.0.0
- **Lambda API**: v1.0.0
- **EventBridge API**: v1.0.0

### 対応言語

- **TypeScript**: 5.3以上
- **Node.js**: 20.x以上

---

## Construct API

### BedrockAgentCoreRuntimeConstruct

#### クラス定義

```typescript
export class BedrockAgentCoreRuntimeConstruct extends Construct {
  public readonly lambdaFunction: lambda.Function;
  public readonly eventBridgeRule: events.Rule;
  public readonly kmsKey: kms.Key;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly executionRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: BedrockAgentCoreRuntimeConstructProps
  );
}
```

#### プロパティ

| プロパティ | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `enabled` | `boolean` | Runtime機能の有効化フラグ | ✅ |
| `projectName` | `string` | プロジェクト名 | ✅ |
| `environment` | `string` | 環境名（dev, staging, prod） | ✅ |
| `bedrockAgentId` | `string` | Bedrock Agent ID | ✅ |
| `bedrockAgentAliasId` | `string` | Bedrock Agent Alias ID | ✅ |
| `bedrockRegion` | `string` | Bedrockリージョン | ✅ |
| `lambda` | `LambdaConfig` | Lambda関数設定 | ❌ |
| `eventBridge` | `EventBridgeConfig` | EventBridge設定 | ❌ |
| `scaling` | `ScalingConfig` | スケーリング設定 | ❌ |
| `kms` | `KmsConfig` | KMS設定 | ❌ |
| `vpc` | `VpcConfig` | VPC設定 | ❌ |
| `dlq` | `DlqConfig` | DLQ設定 | ❌ |

#### メソッド

##### createLambdaFunction()

Lambda関数を作成します。

**シグネチャ**:
```typescript
private createLambdaFunction(): lambda.Function
```

**戻り値**:
- `lambda.Function`: 作成されたLambda関数

**例外**:
- `Error`: Lambda関数の作成に失敗した場合

---

##### createEventBridgeRule()

EventBridge Ruleを作成します。

**シグネチャ**:
```typescript
private createEventBridgeRule(): events.Rule
```

**戻り値**:
- `events.Rule`: 作成されたEventBridge Rule

**例外**:
- `Error`: EventBridge Ruleの作成に失敗した場合

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

##### createDeadLetterQueue()

Dead Letter Queueを作成します。

**シグネチャ**:
```typescript
private createDeadLetterQueue(): sqs.Queue
```

**戻り値**:
- `sqs.Queue`: 作成されたDead Letter Queue

**例外**:
- `Error`: Dead Letter Queueの作成に失敗した場合

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

##### configureAutoScaling()

自動スケーリングを設定します。

**シグネチャ**:
```typescript
private configureAutoScaling(): void
```

**戻り値**:
- `void`

**例外**:
- `Error`: 自動スケーリングの設定に失敗した場合

---

#### 使用例

```typescript
import { BedrockAgentCoreRuntimeConstruct } from './constructs/bedrock-agent-core-runtime-construct';

// Runtime Construct作成
const runtime = new BedrockAgentCoreRuntimeConstruct(this, 'Runtime', {
  enabled: true,
  projectName: 'permission-aware-rag',
  environment: 'prod',
  bedrockAgentId: 'AGENT_ID',
  bedrockAgentAliasId: 'ALIAS_ID',
  bedrockRegion: 'ap-northeast-1',
  lambda: {
    timeout: 60,
    memorySize: 4096,
    environment: {
      LOG_LEVEL: 'INFO',
    },
  },
  scaling: {
    reservedConcurrency: 20,
    provisionedConcurrency: 10,
  },
});

// Lambda関数ARNを取得
const lambdaArn = runtime.lambdaFunction.functionArn;
console.log(`Lambda ARN: ${lambdaArn}`);
```

---

## Lambda関数API

### handler()

Lambda関数のエントリーポイントです。

#### シグネチャ

```typescript
export async function handler(
  event: RuntimeEvent
): Promise<RuntimeResponse>
```

#### パラメータ

**event**: `RuntimeEvent`

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `agentId` | `string` | Bedrock Agent ID | ✅ |
| `agentAliasId` | `string` | Bedrock Agent Alias ID | ✅ |
| `sessionId` | `string` | セッションID | ✅ |
| `inputText` | `string` | 入力テキスト | ✅ |
| `enableTrace` | `boolean` | トレース有効化フラグ | ❌ |
| `sessionState` | `object` | セッション状態 | ❌ |

#### 戻り値

**RuntimeResponse**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | `boolean` | 成功フラグ |
| `sessionId` | `string` | セッションID |
| `completion` | `string` | 完了テキスト |
| `trace` | `object[]` | トレース情報（enableTrace=trueの場合） |
| `error` | `string` | エラーメッセージ（失敗時） |

#### 例外

- `Error`: Bedrock Agent実行エラー
- `ValidationError`: パラメータ検証エラー
- `TimeoutError`: タイムアウトエラー

#### 使用例

```typescript
// イベント作成
const event: RuntimeEvent = {
  agentId: 'AGENT_ID',
  agentAliasId: 'ALIAS_ID',
  sessionId: 'session-12345',
  inputText: 'こんにちは',
  enableTrace: true,
};

// Lambda関数呼び出し
const response = await handler(event);

// レスポンス確認
if (response.success) {
  console.log(`Completion: ${response.completion}`);
  console.log(`Trace: ${JSON.stringify(response.trace)}`);
} else {
  console.error(`Error: ${response.error}`);
}
```

---

### getEnvironmentVariables()

環境変数を取得します。

#### シグネチャ

```typescript
function getEnvironmentVariables(): {
  projectName: string;
  environment: string;
  bedrockAgentId: string;
  bedrockAgentAliasId: string;
  bedrockRegion: string;
}
```

#### 戻り値

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `projectName` | `string` | プロジェクト名 |
| `environment` | `string` | 環境名 |
| `bedrockAgentId` | `string` | Bedrock Agent ID |
| `bedrockAgentAliasId` | `string` | Bedrock Agent Alias ID |
| `bedrockRegion` | `string` | Bedrockリージョン |

#### 例外

- `Error`: 環境変数が設定されていない場合

---

### extractParameters()

イベントからパラメータを抽出します。

#### シグネチャ

```typescript
function extractParameters(event: RuntimeEvent): {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  inputText: string;
  enableTrace: boolean;
  sessionState?: object;
}
```

#### パラメータ

**event**: `RuntimeEvent`

#### 戻り値

抽出されたパラメータ

#### 例外

- `ValidationError`: パラメータ検証エラー

---

### invokeBedrockAgent()

Bedrock Agentを呼び出します。

#### シグネチャ

```typescript
async function invokeBedrockAgent(params: {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  inputText: string;
  enableTrace: boolean;
  sessionState?: object;
}): Promise<{
  completion: string;
  trace: object[];
}>
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `agentId` | `string` | Bedrock Agent ID | ✅ |
| `agentAliasId` | `string` | Bedrock Agent Alias ID | ✅ |
| `sessionId` | `string` | セッションID | ✅ |
| `inputText` | `string` | 入力テキスト | ✅ |
| `enableTrace` | `boolean` | トレース有効化フラグ | ✅ |
| `sessionState` | `object` | セッション状態 | ❌ |

#### 戻り値

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `completion` | `string` | 完了テキスト |
| `trace` | `object[]` | トレース情報 |

#### 例外

- `Error`: Bedrock Agent実行エラー

---

### createErrorResponse()

エラーレスポンスを作成します。

#### シグネチャ

```typescript
function createErrorResponse(
  sessionId: string,
  error: Error
): ErrorResponse
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `sessionId` | `string` | セッションID | ✅ |
| `error` | `Error` | エラーオブジェクト | ✅ |

#### 戻り値

**ErrorResponse**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | `boolean` | 成功フラグ（常にfalse） |
| `sessionId` | `string` | セッションID |
| `error` | `string` | エラーメッセージ |

---

### createSuccessResponse()

成功レスポンスを作成します。

#### シグネチャ

```typescript
function createSuccessResponse(
  sessionId: string,
  completion: string,
  trace: object[]
): SuccessResponse
```

#### パラメータ

| フィールド | 型 | 説明 | 必須 |
|-----------|-----|------|------|
| `sessionId` | `string` | セッションID | ✅ |
| `completion` | `string` | 完了テキスト | ✅ |
| `trace` | `object[]` | トレース情報 | ✅ |

#### 戻り値

**SuccessResponse**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | `boolean` | 成功フラグ（常にtrue） |
| `sessionId` | `string` | セッションID |
| `completion` | `string` | 完了テキスト |
| `trace` | `object[]` | トレース情報 |

---

## EventBridge仕様

### イベントパターン

#### デフォルトイベントパターン

```json
{
  "source": ["bedrock.agent"],
  "detail-type": ["Agent Execution Request"]
}
```

#### カスタムイベントパターン

```json
{
  "source": ["custom.bedrock.agent"],
  "detail-type": ["Agent Execution Request"],
  "detail": {
    "agentId": ["AGENT_ID"],
    "priority": ["high"]
  }
}
```

### イベント構造

#### Agent Execution Request

```json
{
  "version": "0",
  "id": "event-id",
  "detail-type": "Agent Execution Request",
  "source": "bedrock.agent",
  "account": "123456789012",
  "time": "2026-01-03T12:00:00Z",
  "region": "ap-northeast-1",
  "resources": [],
  "detail": {
    "agentId": "AGENT_ID",
    "agentAliasId": "ALIAS_ID",
    "sessionId": "session-12345",
    "inputText": "こんにちは",
    "enableTrace": true,
    "sessionState": {}
  }
}
```

### スケジュール実行

#### Rate式

```json
{
  "schedule": "rate(5 minutes)"
}
```

#### Cron式

```json
{
  "schedule": "cron(0 12 * * ? *)"
}
```

---

## エラーコード一覧

### Lambda関数エラー

| エラーコード | 説明 | HTTPステータス | 対処方法 |
|------------|------|---------------|---------|
| `MISSING_PARAMETER` | 必須パラメータが不足 | 400 | パラメータを確認 |
| `INVALID_PARAMETER` | パラメータが不正 | 400 | パラメータ形式を確認 |
| `AGENT_NOT_FOUND` | Bedrock Agentが見つからない | 404 | Agent IDを確認 |
| `AGENT_EXECUTION_ERROR` | Bedrock Agent実行エラー | 500 | Bedrock Logsを確認 |
| `TIMEOUT_ERROR` | タイムアウトエラー | 504 | タイムアウト設定を延長 |
| `INTERNAL_ERROR` | 内部エラー | 500 | Lambda Logsを確認 |

### Bedrock Agentエラー

| エラーコード | 説明 | 対処方法 |
|------------|------|---------|
| `AccessDeniedException` | アクセス拒否 | IAM権限を確認 |
| `ResourceNotFoundException` | リソースが見つからない | Agent IDを確認 |
| `ThrottlingException` | スロットリング | リトライ間隔を延長 |
| `ValidationException` | 検証エラー | パラメータを確認 |
| `InternalServerException` | 内部サーバーエラー | AWSサポートに連絡 |

### EventBridgeエラー

| エラーコード | 説明 | 対処方法 |
|------------|------|---------|
| `RuleNotFound` | Ruleが見つからない | Rule名を確認 |
| `TargetNotFound` | ターゲットが見つからない | Lambda ARNを確認 |
| `InvalidEventPattern` | イベントパターンが不正 | イベントパターンを確認 |

---

## 型定義

### RuntimeEvent

```typescript
export interface RuntimeEvent {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  inputText: string;
  enableTrace?: boolean;
  sessionState?: {
    sessionAttributes?: Record<string, string>;
    promptSessionAttributes?: Record<string, string>;
  };
}
```

### RuntimeResponse

```typescript
export type RuntimeResponse = SuccessResponse | ErrorResponse;
```

### SuccessResponse

```typescript
export interface SuccessResponse {
  success: true;
  sessionId: string;
  completion: string;
  trace?: TraceEvent[];
}
```

### ErrorResponse

```typescript
export interface ErrorResponse {
  success: false;
  sessionId: string;
  error: string;
  errorCode?: string;
}
```

### TraceEvent

```typescript
export interface TraceEvent {
  type: string;
  timestamp: string;
  data: Record<string, any>;
}
```

### BedrockAgentCoreRuntimeConstructProps

```typescript
export interface BedrockAgentCoreRuntimeConstructProps {
  enabled: boolean;
  projectName: string;
  environment: string;
  bedrockAgentId: string;
  bedrockAgentAliasId: string;
  bedrockRegion: string;
  lambda?: LambdaConfig;
  eventBridge?: EventBridgeConfig;
  scaling?: ScalingConfig;
  kms?: KmsConfig;
  vpc?: VpcConfig;
  dlq?: DlqConfig;
}
```

### LambdaConfig

```typescript
export interface LambdaConfig {
  timeout?: number;
  memorySize?: number;
  environment?: Record<string, string>;
}
```

### EventBridgeConfig

```typescript
export interface EventBridgeConfig {
  eventPattern?: {
    source?: string[];
    'detail-type'?: string[];
    detail?: Record<string, any>;
  };
  schedule?: string;
}
```

### ScalingConfig

```typescript
export interface ScalingConfig {
  reservedConcurrency?: number;
  provisionedConcurrency?: number;
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

### DlqConfig

```typescript
export interface DlqConfig {
  retentionDays?: number;
  maxReceiveCount?: number;
}
```

---

## バージョン履歴

### v1.0.0 (2026-01-03)

- 初版リリース
- Construct API定義
- Lambda関数API定義
- EventBridge仕様定義
- エラーコード一覧定義
- 型定義定義

---

## 参考リンク

### AWS公式ドキュメント

- [Amazon Bedrock AgentCore API Reference](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda API Reference](https://docs.aws.amazon.com/lambda/)
- [Amazon EventBridge API Reference](https://docs.aws.amazon.com/eventbridge/)

### プロジェクトドキュメント

- [runtime-configuration-guide.md](./runtime-configuration-guide.md) - 設定ガイド
- [requirements.md](../../.kiro/specs/bedrock-agent-core-features/requirements.md) - 完全な要件定義
- [tasks.md](../../.kiro/specs/bedrock-agent-core-features/tasks.md) - タスクリスト

---

**作成者**: Kiro AI  
**作成日**: 2026-01-03  
**ステータス**: ✅ 完成  
**バージョン**: 1.0.0
