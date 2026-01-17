# Observability設定ガイド

**作成日**: 2026-01-04  
**バージョン**: 1.0.0

---

## 📋 概要

このガイドでは、BedrockAgentCoreObservabilityConstructを使用して、Bedrock Agentの監視・トレーシング・デバッグ機能を設定する方法を説明します。

---

## 🎯 主な機能

### 1. X-Ray統合
- 分散トレーシング
- カスタムサンプリングルール
- 詳細トレーシング

### 2. CloudWatch統合
- カスタムメトリクス
- ダッシュボード自動生成
- アラーム設定
- メトリクスフィルター

### 3. エラー追跡
- ログ集約
- エラーパターン分析
- 根本原因分析（RCA）

### 4. KMS暗号化
- ログの暗号化
- キー管理

---

## 🚀 基本的な使い方

### 最小限の設定

```typescript
import { BedrockAgentCoreObservabilityConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-observability-construct';

const observability = new BedrockAgentCoreObservabilityConstruct(this, 'Observability', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
});
```

### 完全な設定

```typescript
const observability = new BedrockAgentCoreObservabilityConstruct(this, 'Observability', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  
  // X-Ray設定
  xrayConfig: {
    enabled: true,
    samplingRate: 0.1,
    groupName: 'my-agent-core',
    filterExpression: 'service("agent-core")',
    detailedTracing: true,
    customSamplingRule: true,
    samplingRulePriority: 1000,
  },
  
  // CloudWatch設定
  cloudwatchConfig: {
    enabled: true,
    namespace: 'AWS/Bedrock/AgentCore',
    createDashboard: true,
    dashboardName: 'my-agent-core-observability',
    
    // カスタムメトリクス
    customMetrics: {
      executionLatency: true,
      errorRate: true,
      throughput: true,
      tokenUsage: true,
      costTracking: true,
    },
    
    // メトリクスフィルター
    metricFilters: {
      errorPatterns: true,
      warningPatterns: true,
      performanceDegradation: true,
    },
    
    // アラーム
    alarms: {
      errorRateThreshold: 5,
      latencyThreshold: 3000,
      throughputThreshold: 10,
      tokenUsageThreshold: 100000,
      snsTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:alerts',
    },
  },
  
  // エラー追跡設定
  errorTrackingConfig: {
    enabled: true,
    logRetentionDays: 30,
    patternAnalysis: true,
    rootCauseAnalysis: true,
  },
  
  // KMS暗号化設定
  kmsConfig: {
    enabled: true,
  },
  
  // タグ
  tags: {
    Team: 'Platform',
    CostCenter: 'Engineering',
  },
});
```

---

## 🔧 Lambda統合

### 個別のLambda関数に設定を適用

```typescript
// X-Ray統合
observability.enableXRayForLambda(myLambdaFunction);

// CloudWatchメトリクス統合
observability.addMetricsConfig(myLambdaFunction);

// CloudWatchログ統合
observability.addLoggingConfig(myLambdaFunction);
```

### 複数のLambda関数に一括設定

```typescript
const lambdaFunctions = [lambda1, lambda2, lambda3];
observability.configureObservabilityForLambdas(lambdaFunctions);
```

---

## 📊 CloudWatchダッシュボード

### 自動生成されるウィジェット

1. **エラー率ウィジェット**
   - エラー発生率の推移
   - 閾値アラート

2. **実行レイテンシウィジェット**
   - 平均・最大・最小レイテンシ
   - P50/P90/P99パーセンタイル

3. **スループットウィジェット**
   - リクエスト数の推移
   - 成功/失敗の内訳

4. **トークン使用量ウィジェット**
   - トークン消費量の推移
   - コスト推定

5. **推定コストウィジェット**
   - 時間別コスト推移
   - 累積コスト

6. **X-Rayトレースウィジェット**
   - トレース数の推移
   - エラートレース

7. **警告・パフォーマンス問題ウィジェット**
   - 警告パターンの検出
   - パフォーマンス低下の検出

---

## 🔔 アラーム設定

### エラー率アラーム

```typescript
cloudwatchConfig: {
  alarms: {
    errorRateThreshold: 5, // 5%以上でアラート
  },
}
```

### レイテンシアラーム

```typescript
cloudwatchConfig: {
  alarms: {
    latencyThreshold: 3000, // 3秒以上でアラート
  },
}
```

### スループット低下アラーム

```typescript
cloudwatchConfig: {
  alarms: {
    throughputThreshold: 10, // 10リクエスト/分以下でアラート
  },
}
```

### トークン使用量アラーム

```typescript
cloudwatchConfig: {
  alarms: {
    tokenUsageThreshold: 100000, // 100,000トークン/時以上でアラート
  },
}
```

---

## 🔍 X-Rayトレーシング

### サンプリングルール

```typescript
xrayConfig: {
  samplingRate: 0.1, // 10%のリクエストをサンプリング
  samplingRulePriority: 1000, // 優先度
}
```

### カスタムセグメント

Lambda関数内でカスタムセグメントを追加：

```typescript
import { addCustomSegment, addAnnotation, addMetadata } from './xray-helper';

// カスタムセグメント追加
await addCustomSegment('bedrock-invoke', async () => {
  // Bedrock API呼び出し
  const response = await bedrockClient.send(command);
  return response;
});

// アノテーション追加（検索可能）
addAnnotation('userId', userId);
addAnnotation('agentId', agentId);

// メタデータ追加（詳細情報）
addMetadata('request', { query, sessionId });
addMetadata('response', { answer, confidence });
```

---

## 📝 エラー追跡

### エラーパターン分析

```typescript
import { analyzeErrorPatterns } from './error-tracking-helper';

const patterns = await analyzeErrorPatterns(errors);
console.log('検出されたパターン:', patterns);
```

### 根本原因分析（RCA）

```typescript
import { performRCA } from './error-tracking-helper';

const rcaResult = await performRCA(error, context);
console.log('根本原因:', rcaResult.rootCause);
console.log('推奨アクション:', rcaResult.recommendedActions);
```

---

## 🔐 KMS暗号化

### 自動暗号化

KMS暗号化を有効化すると、以下が自動的に暗号化されます：

- CloudWatch Logsログストリーム
- X-Rayトレースデータ
- カスタムメトリクスデータ

### 既存のKMSキーを使用

```typescript
kmsConfig: {
  enabled: true,
  kmsKeyArn: 'arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012',
}
```

---

## 📈 メトリクス

### カスタムメトリクスの送信

Lambda関数内でカスタムメトリクスを送信：

```typescript
import { putMetric, putMetrics } from './cloudwatch-helper';

// 単一メトリクス
await putMetric('ExecutionLatency', latency, 'Milliseconds');

// 複数メトリクス
await putMetrics([
  { name: 'TokenUsage', value: tokens, unit: 'Count' },
  { name: 'EstimatedCost', value: cost, unit: 'None' },
]);
```

---

## 🎯 ベストプラクティス

### 1. サンプリングレートの調整

- **開発環境**: 100%（`samplingRate: 1.0`）
- **ステージング環境**: 50%（`samplingRate: 0.5`）
- **本番環境**: 10%（`samplingRate: 0.1`）

### 2. アラーム閾値の設定

- エラー率: 5%以上
- レイテンシ: 3秒以上
- スループット: 10リクエスト/分以下

### 3. ログ保持期間

- **開発環境**: 7日
- **ステージング環境**: 14日
- **本番環境**: 30日以上

### 4. タグ付け

必須タグ：
- `Environment`: 環境名（dev, staging, prod）
- `Project`: プロジェクト名
- `Team`: チーム名
- `CostCenter`: コストセンター

---

## 🔧 トラブルシューティング

### X-Rayトレースが表示されない

**原因**: Lambda関数にX-Ray権限がない

**解決策**:
```typescript
observability.enableXRayForLambda(myLambdaFunction);
```

### CloudWatchメトリクスが表示されない

**原因**: Lambda関数にCloudWatch権限がない

**解決策**:
```typescript
observability.addMetricsConfig(myLambdaFunction);
```

### アラームが発火しない

**原因**: SNSトピックが設定されていない

**解決策**:
```typescript
cloudwatchConfig: {
  alarms: {
    snsTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:alerts',
  },
}
```

---

## 📚 関連ドキュメント

- [運用・保守ガイド](./OPERATIONS_MAINTENANCE_GUIDE_JA.md)
- [デバッグ・トラブルシューティングガイド](./debugging-troubleshooting-guide.md)
- [AWS X-Ray公式ドキュメント](https://docs.aws.amazon.com/xray/)
- [AWS CloudWatch公式ドキュメント](https://docs.aws.amazon.com/cloudwatch/)

---

**このガイドは継続的に更新されます。**
