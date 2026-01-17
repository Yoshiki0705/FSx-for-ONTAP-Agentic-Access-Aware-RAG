# Evaluations設定ガイド

**バージョン**: 1.0.0  
**最終更新**: 2026-01-04

---

## 📋 概要

このガイドでは、Bedrock Agent Core Evaluations機能の設定方法を説明します。

### 対象読者

- CDK開発者
- DevOpsエンジニア
- システムアーキテクト

### 前提条件

- AWS CDK v2の基本知識
- TypeScriptの基本知識
- Amazon Bedrockの基本知識

---

## 🚀 クイックスタート

### 基本設定

```typescript
import { BedrockAgentCoreEvaluationsConstruct } from './constructs/bedrock-agent-core-evaluations-construct';

const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
});
```

### 品質メトリクス有効化

```typescript
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
});
```

### A/Bテスト有効化

```typescript
const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  abTestConfig: {
    enabled: true,
    trafficSplit: [50, 50],
    significanceThreshold: 0.05,
    minSampleSize: 100,
  },
});
```

### パフォーマンス評価有効化

```typescript
const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  performanceEvaluationConfig: {
    enabled: true,
    latencyThreshold: 1000,
    throughputThreshold: 100,
    costThreshold: 100,
  },
});
```

---

## 📊 品質メトリクス設定

### 全ての評価器を有効化

```typescript
qualityMetricsConfig: {
  enabled: true,
  accuracy: true,
  relevance: true,
  helpfulness: true,
  consistency: true,
  completeness: true,
  conciseness: true,
  clarity: true,
  grammar: true,
  tone: true,
  bias: true,
  toxicity: true,
  factuality: true,
  citationQuality: true,
}
```

### 特定の評価器のみ有効化

```typescript
qualityMetricsConfig: {
  enabled: true,
  accuracy: true,
  relevance: true,
  helpfulness: true,
  // 他の評価器は無効
}
```

### 評価器の説明

| 評価器 | 用途 | 推奨シナリオ |
|-------|------|-------------|
| **Accuracy** | 回答の正確性 | 事実確認が重要な場合 |
| **Relevance** | 質問との関連性 | 検索・推薦システム |
| **Helpfulness** | 回答の有用性 | カスタマーサポート |
| **Consistency** | 回答の一貫性 | 複数回の質問応答 |
| **Completeness** | 回答の完全性 | 詳細な説明が必要な場合 |
| **Conciseness** | 回答の簡潔性 | 短い回答が望ましい場合 |
| **Clarity** | 回答の明瞭性 | 技術文書生成 |
| **Grammar** | 文法の正確性 | 公式文書生成 |
| **Tone** | トーンの適切性 | ブランドイメージ維持 |
| **Bias** | バイアスの有無 | 公平性が重要な場合 |
| **Toxicity** | 有害性の有無 | ユーザー生成コンテンツ |
| **Factuality** | 事実性 | ニュース・レポート生成 |
| **Citation Quality** | 引用品質 | 学術・研究用途 |

---

## 🧪 A/Bテスト設定

### 基本設定

```typescript
abTestConfig: {
  enabled: true,
  trafficSplit: [50, 50],  // A:B = 50:50
  significanceThreshold: 0.05,  // p値 < 0.05で有意
  minSampleSize: 100,  // 最小100サンプル
}
```

### トラフィック分割パターン

#### 均等分割（50:50）
```typescript
trafficSplit: [50, 50]
```

#### 不均等分割（70:30）
```typescript
trafficSplit: [70, 30]
```

#### 段階的ロールアウト（90:10）
```typescript
trafficSplit: [90, 10]
```

### 統計的有意性設定

#### 標準設定（95%信頼度）
```typescript
significanceThreshold: 0.05  // p値 < 0.05
```

#### 厳格設定（99%信頼度）
```typescript
significanceThreshold: 0.01  // p値 < 0.01
```

#### 緩和設定（90%信頼度）
```typescript
significanceThreshold: 0.10  // p値 < 0.10
```

### 自動最適化

```typescript
abTestConfig: {
  enabled: true,
  trafficSplit: [50, 50],
  autoOptimization: true,
  autoOptimizationThreshold: 0.95,  // 95%信頼度で自動最適化
}
```

**動作**:
- 統計的に有意な勝者が検出される
- 信頼度が95%を超える
- → 自動的に勝者に100%トラフィックを割り当て

---

## 📈 パフォーマンス評価設定

### 基本設定

```typescript
performanceEvaluationConfig: {
  enabled: true,
  latencyThreshold: 1000,  // 1秒
  throughputThreshold: 100,  // 100 req/min
  costThreshold: 100,  // $100
}
```

### レイテンシ閾値

| 用途 | 推奨閾値 |
|------|---------|
| リアルタイムチャット | 500ms |
| 一般的なAPI | 1000ms |
| バッチ処理 | 5000ms |

```typescript
latencyThreshold: 500  // リアルタイムチャット
```

### スループット閾値

| 用途 | 推奨閾値 |
|------|---------|
| 小規模アプリ | 50 req/min |
| 中規模アプリ | 100 req/min |
| 大規模アプリ | 500 req/min |

```typescript
throughputThreshold: 100  // 中規模アプリ
```

### コスト閾値

| 用途 | 推奨閾値 |
|------|---------|
| 開発環境 | $50 |
| ステージング環境 | $100 |
| 本番環境 | $500 |

```typescript
costThreshold: 100  // ステージング環境
```

### 測定項目の選択

```typescript
performanceEvaluationConfig: {
  enabled: true,
  latencyMeasurement: true,  // レイテンシ測定
  throughputMeasurement: true,  // スループット測定
  costAnalysis: true,  // コスト分析
}
```

---

## 🗄️ データ保持設定

### 保持期間の設定

```typescript
resultsRetentionDays: 90  // 90日間保持
```

### 推奨保持期間

| 環境 | 推奨期間 |
|------|---------|
| 開発環境 | 30日 |
| ステージング環境 | 60日 |
| 本番環境 | 90日 |
| コンプライアンス要件あり | 365日 |

---

## 🏷️ タグ設定

### 基本タグ

```typescript
tags: {
  Project: 'MyProject',
  Environment: 'Production',
  Component: 'Evaluations',
  Owner: 'DevOps Team',
}
```

### コスト配分タグ

```typescript
tags: {
  CostCenter: 'Engineering',
  Department: 'AI/ML',
  Application: 'Bedrock Agent',
}
```

---

## 🔧 環境別設定例

### 開発環境

```typescript
const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'development',
  qualityMetricsConfig: {
    enabled: true,
    accuracy: true,
    relevance: true,
  },
  resultsRetentionDays: 30,
  tags: {
    Environment: 'Development',
  },
});
```

### ステージング環境

```typescript
const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'staging',
  qualityMetricsConfig: {
    enabled: true,
    accuracy: true,
    relevance: true,
    helpfulness: true,
    consistency: true,
  },
  abTestConfig: {
    enabled: true,
    trafficSplit: [50, 50],
  },
  resultsRetentionDays: 60,
  tags: {
    Environment: 'Staging',
  },
});
```

### 本番環境

```typescript
const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  qualityMetricsConfig: {
    enabled: true,
    accuracy: true,
    relevance: true,
    helpfulness: true,
    consistency: true,
    completeness: true,
    conciseness: true,
    clarity: true,
    grammar: true,
    tone: true,
    bias: true,
    toxicity: true,
    factuality: true,
    citationQuality: true,
  },
  abTestConfig: {
    enabled: true,
    trafficSplit: [50, 50],
    significanceThreshold: 0.05,
    minSampleSize: 200,
    autoOptimization: true,
    autoOptimizationThreshold: 0.95,
  },
  performanceEvaluationConfig: {
    enabled: true,
    latencyThreshold: 1000,
    throughputThreshold: 100,
    costThreshold: 500,
    latencyMeasurement: true,
    throughputMeasurement: true,
    costAnalysis: true,
  },
  resultsRetentionDays: 90,
  tags: {
    Environment: 'Production',
    CostCenter: 'Engineering',
  },
});
```

---

## 🔍 トラブルシューティング

### 問題: 評価結果が保存されない

**原因**: IAM権限不足

**解決策**:
```typescript
// Lambda関数にS3とDynamoDBへのアクセス権限を付与
evaluations.resultsBucket.grantReadWrite(lambdaFunction);
evaluations.resultsTable.grantReadWriteData(lambdaFunction);
```

### 問題: A/Bテストが統計的に有意にならない

**原因**: サンプルサイズ不足

**解決策**:
```typescript
abTestConfig: {
  minSampleSize: 500,  // サンプルサイズを増やす
}
```

### 問題: パフォーマンス評価のコストが高い

**原因**: Bedrockモデルの呼び出し回数が多い

**解決策**:
```typescript
qualityMetricsConfig: {
  enabled: true,
  accuracy: true,  // 必要な評価器のみ有効化
  relevance: true,
  // 他の評価器は無効化
}
```

---

## 📚 関連ドキュメント

- [Evaluations API仕様書](../api/bedrock-agent-core-evaluations-api.md)
- [Observability設定ガイド](./observability-configuration-guide.md)
- [Bedrock Agent実装ガイド](./bedrock-agent-implementation-guide.md)

---

**最終更新**: 2026-01-04
