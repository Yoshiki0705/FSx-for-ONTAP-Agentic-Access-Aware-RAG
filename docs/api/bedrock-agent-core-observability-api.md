# BedrockAgentCoreObservability API仕様書

**作成日**: 2026-01-04  
**バージョン**: 1.0.0

---

## 📋 概要

BedrockAgentCoreObservabilityConstructのAPI仕様書です。

---

## 🏗️ Construct API

### BedrockAgentCoreObservabilityConstruct

**説明**: Bedrock Agentの監視・トレーシング・デバッグ機能を提供するConstruct

**インポート**:
```typescript
import { BedrockAgentCoreObservabilityConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-observability-construct';
```

**コンストラクタ**:
```typescript
new BedrockAgentCoreObservabilityConstruct(
  scope: Construct,
  id: string,
  props: BedrockAgentCoreObservabilityConstructProps
)
```

---

## 📝 インターフェース

### BedrockAgentCoreObservabilityConstructProps

**説明**: Constructのプロパティ

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `enabled` | `boolean` | ✅ | - | Observability機能を有効化 |
| `projectName` | `string` | ✅ | - | プロジェクト名 |
| `environment` | `string` | ✅ | - | 環境名（dev, staging, prod等） |
| `xrayConfig` | `XRayConfig` | ❌ | - | X-Ray設定 |
| `cloudwatchConfig` | `CloudWatchConfig` | ❌ | - | CloudWatch設定 |
| `errorTrackingConfig` | `ErrorTrackingConfig` | ❌ | - | エラー追跡設定 |
| `kmsConfig` | `KmsConfig` | ❌ | - | KMS暗号化設定 |
| `tags` | `{ [key: string]: string }` | ❌ | - | タグ |

---

### XRayConfig

**説明**: X-Ray設定

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `enabled` | `boolean` | ✅ | - | X-Ray統合を有効化 |
| `samplingRate` | `number` | ❌ | `0.1` | サンプリングレート（0.0-1.0） |
| `groupName` | `string` | ❌ | `${projectName}-${environment}-agent-core` | X-Ray Group名 |
| `filterExpression` | `string` | ❌ | `service("agent-core")` | フィルター式 |
| `detailedTracing` | `boolean` | ❌ | `true` | 詳細トレーシングを有効化 |
| `customSamplingRule` | `boolean` | ❌ | `true` | カスタムサンプリングルールを有効化 |
| `samplingRulePriority` | `number` | ❌ | `1000` | サンプリングルール優先度 |

---

### CloudWatchConfig

**説明**: CloudWatch設定

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `enabled` | `boolean` | ✅ | - | CloudWatch統合を有効化 |
| `namespace` | `string` | ❌ | `AWS/Bedrock/AgentCore` | カスタムメトリクスの名前空間 |
| `createDashboard` | `boolean` | ❌ | `true` | ダッシュボード自動生成 |
| `dashboardName` | `string` | ❌ | `${projectName}-${environment}-agent-core-observability` | ダッシュボード名 |
| `customMetrics` | `CustomMetricsConfig` | ❌ | - | カスタムメトリクス定義 |
| `metricFilters` | `MetricFiltersConfig` | ❌ | - | メトリクスフィルター設定 |
| `alarms` | `AlarmsConfig` | ❌ | - | アラーム設定 |

---

### CustomMetricsConfig

**説明**: カスタムメトリクス定義

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `executionLatency` | `boolean` | ❌ | `true` | エージェント実行レイテンシを追跡 |
| `errorRate` | `boolean` | ❌ | `true` | エラー率を追跡 |
| `throughput` | `boolean` | ❌ | `true` | スループットを追跡 |
| `tokenUsage` | `boolean` | ❌ | `true` | トークン使用量を追跡 |
| `costTracking` | `boolean` | ❌ | `true` | コスト追跡 |

---

### MetricFiltersConfig

**説明**: メトリクスフィルター設定

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `errorPatterns` | `boolean` | ❌ | `true` | エラーパターンフィルター |
| `warningPatterns` | `boolean` | ❌ | `true` | 警告パターンフィルター |
| `performanceDegradation` | `boolean` | ❌ | `true` | パフォーマンス低下パターンフィルター |

---

### AlarmsConfig

**説明**: アラーム設定

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `errorRateThreshold` | `number` | ❌ | `5` | エラー率アラーム閾値（%） |
| `latencyThreshold` | `number` | ❌ | `3000` | レイテンシアラーム閾値（ミリ秒） |
| `throughputThreshold` | `number` | ❌ | `10` | スループット低下アラーム閾値 |
| `tokenUsageThreshold` | `number` | ❌ | `100000` | トークン使用量アラーム閾値 |
| `snsTopicArn` | `string` | ❌ | - | SNSトピックARN（アラート通知先） |

---

### ErrorTrackingConfig

**説明**: エラー追跡設定

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `enabled` | `boolean` | ✅ | - | エラー追跡を有効化 |
| `logRetentionDays` | `number` | ❌ | `30` | ログ保持期間（日数） |
| `patternAnalysis` | `boolean` | ❌ | `true` | エラーパターン分析を有効化 |
| `rootCauseAnalysis` | `boolean` | ❌ | `true` | 根本原因分析（RCA）を有効化 |

---

### KmsConfig

**説明**: KMS暗号化設定

**プロパティ**:

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|----------|---|------|----------|------|
| `enabled` | `boolean` | ✅ | - | KMS暗号化を有効化 |
| `kmsKeyArn` | `string` | ❌ | - | 既存のKMSキーARN（指定しない場合は新規作成） |

---

## 🔧 メソッド

### enableXRayForLambda()

**説明**: Lambda関数にX-Ray権限を付与

**シグネチャ**:
```typescript
enableXRayForLambda(lambdaFunction: lambda.IFunction): void
```

**パラメータ**:
- `lambdaFunction`: X-Rayを有効化するLambda関数

**例**:
```typescript
observability.enableXRayForLambda(myLambdaFunction);
```

---

### enableXRayForLambdas()

**説明**: 複数のLambda関数にX-Ray権限を一括付与

**シグネチャ**:
```typescript
enableXRayForLambdas(lambdaFunctions: lambda.IFunction[]): void
```

**パラメータ**:
- `lambdaFunctions`: X-Rayを有効化するLambda関数の配列

**例**:
```typescript
observability.enableXRayForLambdas([lambda1, lambda2, lambda3]);
```

---

### addCustomSegmentConfig()

**説明**: Lambda関数にカスタムセグメント設定を追加

**シグネチャ**:
```typescript
addCustomSegmentConfig(
  lambdaFunction: lambda.IFunction,
  segmentName: string,
  annotations?: { [key: string]: string }
): void
```

**パラメータ**:
- `lambdaFunction`: 設定を追加するLambda関数
- `segmentName`: セグメント名
- `annotations`: アノテーション（オプション）

**例**:
```typescript
observability.addCustomSegmentConfig(
  myLambdaFunction,
  'bedrock-invoke',
  { service: 'bedrock', operation: 'invoke' }
);
```

---

### addMetricsConfig()

**説明**: Lambda関数にCloudWatchメトリクス権限を付与

**シグネチャ**:
```typescript
addMetricsConfig(lambdaFunction: lambda.IFunction): void
```

**パラメータ**:
- `lambdaFunction`: メトリクス権限を付与するLambda関数

**例**:
```typescript
observability.addMetricsConfig(myLambdaFunction);
```

---

### addLoggingConfig()

**説明**: Lambda関数にCloudWatchログ権限を付与

**シグネチャ**:
```typescript
addLoggingConfig(lambdaFunction: lambda.IFunction): void
```

**パラメータ**:
- `lambdaFunction`: ログ権限を付与するLambda関数

**例**:
```typescript
observability.addLoggingConfig(myLambdaFunction);
```

---

### configureObservabilityForLambdas()

**説明**: 複数のLambda関数にObservability設定を一括適用

**シグネチャ**:
```typescript
configureObservabilityForLambdas(lambdaFunctions: lambda.IFunction[]): void
```

**パラメータ**:
- `lambdaFunctions`: 設定を適用するLambda関数の配列

**例**:
```typescript
observability.configureObservabilityForLambdas([lambda1, lambda2, lambda3]);
```

---

### addErrorTrackingConfig()

**説明**: Lambda関数にエラー追跡設定を追加

**シグネチャ**:
```typescript
addErrorTrackingConfig(lambdaFunction: lambda.IFunction): void
```

**パラメータ**:
- `lambdaFunction`: エラー追跡設定を追加するLambda関数

**例**:
```typescript
observability.addErrorTrackingConfig(myLambdaFunction);
```

---

### configureErrorNotifications()

**説明**: エラー通知を設定

**シグネチャ**:
```typescript
configureErrorNotifications(snsTopicArn: string): void
```

**パラメータ**:
- `snsTopicArn`: SNSトピックARN

**例**:
```typescript
observability.configureErrorNotifications(
  'arn:aws:sns:ap-northeast-1:123456789012:alerts'
);
```

---

### getErrorTrackingFilters()

**説明**: エラー追跡メトリクスフィルターを取得

**シグネチャ**:
```typescript
getErrorTrackingFilters(): logs.MetricFilter[]
```

**戻り値**:
- エラー追跡メトリクスフィルターの配列

**例**:
```typescript
const filters = observability.getErrorTrackingFilters();
console.log('フィルター数:', filters.length);
```

---

## 📊 プロパティ

### xrayGroup

**説明**: X-Ray Group

**型**: `xray.CfnGroup | undefined`

**例**:
```typescript
const groupArn = observability.xrayGroup?.attrArn;
```

---

### dashboard

**説明**: CloudWatchダッシュボード

**型**: `cloudwatch.Dashboard | undefined`

**例**:
```typescript
const dashboardName = observability.dashboard?.dashboardName;
```

---

### logGroup

**説明**: CloudWatch Logsログループ

**型**: `logs.LogGroup`

**例**:
```typescript
const logGroupName = observability.logGroup.logGroupName;
```

---

### kmsKey

**説明**: KMSキー

**型**: `kms.Key | undefined`

**例**:
```typescript
const keyArn = observability.kmsKey?.keyArn;
```

---

## 📚 Lambda Helper関数

### X-Ray Helper

**ファイル**: `lambda/agent-core-observability/src/xray-helper.ts`

#### addCustomSegment()

```typescript
async function addCustomSegment<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T>
```

#### addAnnotation()

```typescript
function addAnnotation(key: string, value: string | number | boolean): void
```

#### addMetadata()

```typescript
function addMetadata(key: string, value: any): void
```

---

### CloudWatch Helper

**ファイル**: `lambda/agent-core-observability/src/cloudwatch-helper.ts`

#### putMetric()

```typescript
async function putMetric(
  metricName: string,
  value: number,
  unit: string
): Promise<void>
```

#### putMetrics()

```typescript
async function putMetrics(
  metrics: Array<{ name: string; value: number; unit: string }>
): Promise<void>
```

---

### Error Tracking Helper

**ファイル**: `lambda/agent-core-observability/src/error-tracking-helper.ts`

#### trackError()

```typescript
async function trackError(
  error: Error,
  context: any
): Promise<void>
```

#### analyzeErrorPatterns()

```typescript
async function analyzeErrorPatterns(
  errors: Error[]
): Promise<ErrorPattern[]>
```

#### performRCA()

```typescript
async function performRCA(
  error: Error,
  context: any
): Promise<RCAResult>
```

---

## 📝 使用例

### 基本的な使用例

```typescript
// Construct作成
const observability = new BedrockAgentCoreObservabilityConstruct(this, 'Observability', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
});

// Lambda関数に設定を適用
observability.configureObservabilityForLambdas([lambda1, lambda2]);
```

### Lambda関数内での使用例

```typescript
import { addCustomSegment, addAnnotation } from './xray-helper';
import { putMetric } from './cloudwatch-helper';
import { trackError } from './error-tracking-helper';

export const handler = async (event: any) => {
  try {
    // X-Rayトレーシング
    const result = await addCustomSegment('bedrock-invoke', async () => {
      addAnnotation('userId', event.userId);
      return await invokeBedrockAgent(event);
    });
    
    // メトリクス送信
    await putMetric('ExecutionLatency', Date.now() - startTime, 'Milliseconds');
    
    return result;
  } catch (error) {
    // エラー追跡
    await trackError(error, { event });
    throw error;
  }
};
```

---

**このAPI仕様書は継続的に更新されます。**
