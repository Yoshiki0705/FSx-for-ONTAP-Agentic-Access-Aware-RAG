# Bedrock Agent Core Evaluations API仕様書

**バージョン**: 1.0.0  
**最終更新**: 2026-01-04

---

## 📋 概要

Bedrock Agent Core Evaluations APIは、Bedrock Agentの品質評価、A/Bテスト、パフォーマンス測定機能を提供します。

### 主な機能

1. **品質メトリクス評価**: 13の組み込み評価器による品質測定
2. **A/Bテスト**: トラフィック分割と統計的有意性検定
3. **パフォーマンス評価**: レイテンシ、スループット、コスト分析

---

## 🔧 Construct API

### BedrockAgentCoreEvaluationsConstruct

Bedrock Agent評価機能を提供するCDK Construct。

#### Props

```typescript
interface BedrockAgentCoreEvaluationsConstructProps {
  // 必須プロパティ
  enabled: boolean;
  projectName: string;
  environment: string;

  // オプションプロパティ
  qualityMetricsConfig?: QualityMetricsConfig;
  abTestConfig?: ABTestConfig;
  performanceEvaluationConfig?: PerformanceEvaluationConfig;
  resultsRetentionDays?: number;
  tags?: { [key: string]: string };
}
```

#### 使用例

```typescript
import { BedrockAgentCoreEvaluationsConstruct } from './constructs/bedrock-agent-core-evaluations-construct';

const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  qualityMetricsConfig: {
    enabled: true,
    accuracy: true,
    relevance: true,
    helpfulness: true,
  },
  abTestConfig: {
    enabled: true,
    trafficSplit: [50, 50],
  },
  performanceEvaluationConfig: {
    enabled: true,
    latencyThreshold: 1000,
    throughputThreshold: 100,
    costThreshold: 100,
  },
  resultsRetentionDays: 90,
});
```

#### パブリックプロパティ

| プロパティ | 型 | 説明 |
|-----------|---|------|
| `resultsBucket` | `s3.Bucket` | 評価結果保存用S3バケット |
| `resultsTable` | `dynamodb.Table` | 評価結果メタデータ保存用DynamoDBテーブル |
| `logGroup` | `logs.LogGroup` | CloudWatch Logsログループ |
| `dashboard` | `cloudwatch.Dashboard?` | CloudWatchダッシュボード（有効化時のみ） |

---

## 📊 品質メトリクス API

### QualityMetricsConfig

品質メトリクス評価の設定。

```typescript
interface QualityMetricsConfig {
  enabled: boolean;
  accuracy?: boolean;
  relevance?: boolean;
  helpfulness?: boolean;
  consistency?: boolean;
  completeness?: boolean;
  conciseness?: boolean;
  clarity?: boolean;
  grammar?: boolean;
  tone?: boolean;
  bias?: boolean;
  toxicity?: boolean;
  factuality?: boolean;
  citationQuality?: boolean;
  resultsBucket?: s3.IBucket;
  resultsPrefix?: string;
}
```

### 評価器一覧

| 評価器 | 説明 | スコア範囲 |
|-------|------|-----------|
| **Accuracy** | 回答の正確性 | 0.0 - 1.0 |
| **Relevance** | 質問との関連性 | 0.0 - 1.0 |
| **Helpfulness** | 回答の有用性 | 0.0 - 1.0 |
| **Consistency** | 回答の一貫性 | 0.0 - 1.0 |
| **Completeness** | 回答の完全性 | 0.0 - 1.0 |
| **Conciseness** | 回答の簡潔性 | 0.0 - 1.0 |
| **Clarity** | 回答の明瞭性 | 0.0 - 1.0 |
| **Grammar** | 文法の正確性 | 0.0 - 1.0 |
| **Tone** | トーンの適切性 | 0.0 - 1.0 |
| **Bias** | バイアスの有無 | 0.0 - 1.0 |
| **Toxicity** | 有害性の有無 | 0.0 - 1.0 |
| **Factuality** | 事実性 | 0.0 - 1.0 |
| **Citation Quality** | 引用品質 | 0.0 - 1.0 |

### Lambda Handler Actions

#### evaluate

全ての有効化された評価器を実行します。

**リクエスト**:
```json
{
  "action": "evaluate",
  "context": {
    "query": "ユーザーの質問",
    "response": "Agentの回答",
    "context": "追加コンテキスト",
    "expectedAnswer": "期待される回答（オプション）"
  },
  "enabledMetrics": ["accuracy", "relevance", "helpfulness"],
  "abTestId": "test-001",
  "variant": "A",
  "metadata": {
    "userId": "user-123",
    "sessionId": "session-456"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "evaluationId": "eval-uuid",
  "results": [
    {
      "metricName": "accuracy",
      "metricType": "quality",
      "score": 0.85,
      "reasoning": "回答は質問に対して正確です...",
      "timestamp": 1704326400000
    }
  ],
  "s3Uri": "s3://bucket/evaluations/eval-uuid.json",
  "savedCount": 3
}
```

#### evaluate-single

単一の評価器を実行します。

**リクエスト**:
```json
{
  "action": "evaluate-single",
  "metricName": "accuracy",
  "context": {
    "query": "ユーザーの質問",
    "response": "Agentの回答"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "evaluationId": "eval-uuid",
  "results": {
    "metricName": "accuracy",
    "score": 0.85,
    "reasoning": "..."
  },
  "s3Uri": "s3://bucket/evaluations/eval-uuid.json",
  "savedCount": 1
}
```

#### get-results

評価結果を取得します。

**リクエスト**:
```json
{
  "action": "get-results",
  "evaluationId": "eval-uuid"
}
```

**レスポンス**:
```json
{
  "success": true,
  "results": [
    {
      "metricName": "accuracy",
      "score": 0.85,
      "timestamp": 1704326400000
    }
  ]
}
```

#### get-statistics

統計情報を取得します。

**リクエスト**:
```json
{
  "action": "get-statistics",
  "metricType": "accuracy",
  "startTime": 1704240000000,
  "endTime": 1704326400000
}
```

**レスポンス**:
```json
{
  "success": true,
  "statistics": {
    "accuracy": {
      "average": 0.85,
      "median": 0.87,
      "min": 0.65,
      "max": 0.98,
      "count": 150
    }
  }
}
```

---

## 🧪 A/Bテスト API

### ABTestConfig

A/Bテストの設定。

```typescript
interface ABTestConfig {
  enabled: boolean;
  trafficSplit?: [number, number];
  significanceThreshold?: number;
  minSampleSize?: number;
  autoOptimization?: boolean;
  autoOptimizationThreshold?: number;
}
```

### Lambda Handler Actions

#### determine-variant

ユーザーに割り当てるバリアントを決定します。

**リクエスト**:
```json
{
  "action": "determine-variant",
  "userId": "user-123",
  "abTestConfig": {
    "testId": "test-001",
    "variantA": "Original",
    "variantB": "New Design",
    "trafficSplit": [50, 50],
    "significanceThreshold": 0.05,
    "minSampleSize": 100,
    "autoOptimization": true,
    "autoOptimizationThreshold": 0.95
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "results": {
    "userId": "user-123",
    "testId": "test-001",
    "variant": "A",
    "trafficSplit": [50, 50]
  }
}
```

#### analyze-ab-test

A/Bテスト結果を分析します。

**リクエスト**:
```json
{
  "action": "analyze-ab-test",
  "abTestId": "test-001",
  "startTime": 1704240000000,
  "endTime": 1704326400000,
  "abTestConfig": {
    "testId": "test-001",
    "variantA": "Original",
    "variantB": "New Design",
    "trafficSplit": [50, 50],
    "significanceThreshold": 0.05,
    "minSampleSize": 100,
    "autoOptimization": true,
    "autoOptimizationThreshold": 0.95
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "results": {
    "abTestId": "test-001",
    "analysis": {
      "testId": "test-001",
      "variantA": {
        "variant": "A",
        "sampleCount": 150,
        "averageScore": 0.85,
        "standardDeviation": 0.12,
        "confidenceInterval": [0.83, 0.87]
      },
      "variantB": {
        "variant": "B",
        "sampleCount": 145,
        "averageScore": 0.88,
        "standardDeviation": 0.10,
        "confidenceInterval": [0.86, 0.90]
      },
      "winner": "B",
      "confidence": 0.96,
      "pValue": 0.04,
      "isSignificant": true,
      "recommendation": "バリアントBが統計的に有意に優れています...",
      "shouldAutoOptimize": true
    },
    "report": {
      "testId": "test-001",
      "startDate": "2026-01-03T00:00:00.000Z",
      "endDate": "2026-01-04T00:00:00.000Z",
      "duration": "1 day",
      "summary": "A/Bテスト「test-001」の結果レポート"
    },
    "optimizedConfig": {
      "testId": "test-001",
      "trafficSplit": [0, 100]
    },
    "sampleSizes": {
      "variantA": 150,
      "variantB": 145
    }
  }
}
```

#### get-ab-test-results

A/Bテスト結果を取得します。

**リクエスト**:
```json
{
  "action": "get-ab-test-results",
  "abTestId": "test-001",
  "startTime": 1704240000000,
  "endTime": 1704326400000
}
```

**レスポンス**:
```json
{
  "success": true,
  "results": {
    "abTestId": "test-001",
    "variantA": {
      "sampleCount": 150,
      "statistics": {
        "accuracy": {
          "average": 0.85,
          "median": 0.87
        }
      }
    },
    "variantB": {
      "sampleCount": 145,
      "statistics": {
        "accuracy": {
          "average": 0.88,
          "median": 0.89
        }
      }
    }
  }
}
```

---

## 📈 パフォーマンス評価 API

### PerformanceEvaluationConfig

パフォーマンス評価の設定。

```typescript
interface PerformanceEvaluationConfig {
  enabled: boolean;
  latencyThreshold?: number;
  throughputThreshold?: number;
  costThreshold?: number;
  latencyMeasurement?: boolean;
  throughputMeasurement?: boolean;
  costAnalysis?: boolean;
}
```

### Lambda Handler Actions

#### evaluate-performance

パフォーマンスを評価します。

**リクエスト**:
```json
{
  "action": "evaluate-performance",
  "latencies": [120, 150, 180, 200, 250],
  "totalRequests": 1000,
  "successfulRequests": 980,
  "durationMinutes": 60,
  "costBreakdown": {
    "bedrockInvocations": 1000,
    "bedrockInputTokens": 500000,
    "bedrockOutputTokens": 200000,
    "lambdaInvocations": 1000,
    "lambdaDurationMs": 300000,
    "s3Storage": 1024,
    "s3Requests": 2000,
    "dynamodbReads": 5000,
    "dynamodbWrites": 1000,
    "cloudwatchLogs": 512
  },
  "thresholds": {
    "latency": 1000,
    "throughput": 100,
    "cost": 100
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "results": {
    "evaluation": {
      "latency": {
        "average": 180,
        "median": 180,
        "p95": 245,
        "p99": 250,
        "min": 120,
        "max": 250
      },
      "throughput": {
        "requestsPerMinute": 16.67,
        "requestsPerSecond": 0.28,
        "successRate": 98.0,
        "errorRate": 2.0
      },
      "cost": {
        "totalCost": 5.25,
        "breakdown": {
          "bedrock": 4.50,
          "lambda": 0.25,
          "s3": 0.10,
          "dynamodb": 0.30,
          "cloudwatch": 0.10
        }
      },
      "overallScore": 85,
      "recommendations": [
        "レイテンシは良好です。",
        "スループットが低いです。Lambda同時実行数を増やしてください。"
      ]
    },
    "report": {
      "summary": "パフォーマンス評価レポート",
      "latency": "平均: 180ms, P95: 245ms",
      "throughput": "16.67 req/min, 成功率: 98%",
      "cost": "総コスト: $5.25"
    }
  }
}
```

---

## 🗄️ データストレージ

### S3バケット

**バケット名**: `{projectName}-{environment}-evaluations-results-{accountId}`

**ディレクトリ構造**:
```
evaluations-results/
├── quality-metrics/
│   ├── {evaluationId}.json
│   └── ...
├── ab-tests/
│   ├── {testId}/
│   │   ├── {evaluationId}.json
│   │   └── ...
│   └── ...
└── performance/
    ├── {evaluationId}.json
    └── ...
```

### DynamoDBテーブル

**テーブル名**: `{projectName}-{environment}-evaluations-results`

**キースキーマ**:
- パーティションキー: `evaluationId` (String)
- ソートキー: `timestamp` (Number)

**GSI**:
1. **MetricTypeIndex**
   - パーティションキー: `metricType` (String)
   - ソートキー: `timestamp` (Number)

2. **ABTestIndex**
   - パーティションキー: `abTestId` (String)
   - ソートキー: `timestamp` (Number)

**属性**:
- `evaluationId`: 評価ID
- `timestamp`: タイムスタンプ
- `metricType`: メトリクスタイプ
- `metricName`: メトリクス名
- `score`: スコア
- `abTestId`: A/BテストID（オプション）
- `variant`: バリアント（オプション）
- `ttl`: TTL（Time To Live）

---

## 🔒 セキュリティ

### IAM権限

Evaluations Constructは以下のIAM権限を必要とします：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*:*:model/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::{bucketName}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:GetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/{tableName}",
        "arn:aws:dynamodb:*:*:table/{tableName}/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/bedrock/agent-core/*"
    }
  ]
}
```

### 暗号化

- **S3**: AES256サーバーサイド暗号化
- **DynamoDB**: AWS管理キーによる暗号化
- **CloudWatch Logs**: デフォルト暗号化

---

## 📚 関連ドキュメント

- [Evaluations設定ガイド](../guides/evaluations-configuration-guide.md)
- [Observability API仕様書](./bedrock-agent-core-observability-api.md)
- [Bedrock Agent実装ガイド](../guides/bedrock-agent-implementation-guide.md)

---

**最終更新**: 2026-01-04
