# Amazon Bedrock AgentCore - よくある質問（FAQ）

**作成日**: 2026-01-17  
**最終更新**: 2026-01-17  
**対象読者**: エンドユーザー、開発者、システム管理者  
**目的**: AgentCore機能に関するよくある質問と回答を提供

---

## 📋 目次

1. [一般的な質問](#一般的な質問)
2. [機能別FAQ](#機能別faq)
   - [Runtime](#runtime)
   - [Gateway](#gateway)
   - [Memory](#memory)
   - [Identity](#identity)
   - [Browser](#browser)
   - [Code Interpreter](#code-interpreter)
   - [Observability](#observability)
   - [Evaluations](#evaluations)
   - [Policy](#policy)
3. [トラブルシューティング](#トラブルシューティング)
4. [パフォーマンス](#パフォーマンス)
5. [セキュリティ](#セキュリティ)
6. [コスト](#コスト)
7. [デプロイメント](#デプロイメント)

---

## 一般的な質問

### Q1: AgentCoreとは何ですか？

**A**: Amazon Bedrock AgentCoreは、エンタープライズグレードのAIエージェントを構築・デプロイ・運用するための包括的なプラットフォームです。9つのコアサービス（Runtime、Gateway、Memory、Identity、Browser、Code Interpreter、Observability、Evaluations、Policy）で構成され、それぞれが特定の機能を提供します。

**詳細**: [AgentCoreユーザーガイド](./agentcore-user-guide.md#agentcoreとは)

---

### Q2: AgentCoreの9つの機能は全て必須ですか？

**A**: いいえ、全ての機能はオプションです。`cdk.context.json`で個別に有効化/無効化できます。最小限の構成では、Runtime + Memory のみで動作します。

**設定例**:
```json
{
  "agentCore": {
    "runtime": { "enabled": true },
    "memory": { "enabled": true },
    "gateway": { "enabled": false },
    "browser": { "enabled": false }
  }
}
```

**参考**: [デプロイメントガイド - 設定ファイルの選択](./agentcore-deployment-guide.md#設定ファイルの選択)

---

### Q3: AgentCoreはどのAWSリージョンで利用できますか？

**A**: AgentCoreは以下のリージョンで利用可能です：
- **US East (N. Virginia)** - us-east-1
- **US West (Oregon)** - us-west-2
- **Asia Pacific (Sydney)** - ap-southeast-2
- **Europe (Frankfurt)** - eu-central-1

**注意**: 一部の機能（Memory等）は特定のリージョンでのみ利用可能です。

---

### Q4: AgentCoreの導入にはどのくらいの時間がかかりますか？

**A**: 
- **最小構成（Runtime + Memory）**: 30-45分
- **完全構成（全9機能）**: 70-105分
- **カスタム構成**: 機能数に応じて変動

**デプロイ時間の内訳**:
| スタック | 時間 | AgentCore機能 |
|---------|------|--------------|
| WebAppStack | 20-30分 | Runtime, Gateway, Memory, Browser, CodeInterpreter |
| SecurityStack | 10-15分 | Identity, Policy |
| OperationsStack | 10-15分 | Observability, Evaluations |

**参考**: [デプロイメントガイド - デプロイメント時間](./agentcore-deployment-guide.md#4-デプロイメント時間)

---

### Q5: AgentCoreの料金体系はどうなっていますか？

**A**: AgentCoreは従量課金制です。主なコスト要素：

1. **Lambda実行コスト**: リクエスト数と実行時間に応じて課金
2. **DynamoDB**: 読み書きリクエスト数に応じて課金
3. **Bedrock Memory**: メモリストレージとAPI呼び出しに応じて課金
4. **S3ストレージ**: スクリーンショット等の保存に応じて課金
5. **CloudWatch Logs**: ログ保存量に応じて課金

**コスト最適化のヒント**:
- 不要な機能は無効化
- Provisioned Concurrencyは必要最小限に
- CloudWatch Logsの保持期間を30日に設定

**詳細**: [コストセクション](#コスト)

---

## 機能別FAQ

### Runtime

#### Q6: Runtime機能とは何ですか？

**A**: Runtime機能は、AIエージェントをセキュアなサーバーレス環境で実行するための基盤です。イベント駆動型アーキテクチャ、自動スケーリング、セキュアな実行環境を提供します。

**主な機能**:
- Lambda統合によるイベント駆動実行
- 自動スケーリング（1-10インスタンス）
- VPC統合、KMS暗号化、IAMロールによるセキュリティ

**ユースケース**:
- チャットボットの応答生成
- 定期的なレポート作成
- イベント駆動のデータ処理

**詳細**: [ユーザーガイド - Runtime](./agentcore-user-guide.md#agentcore-runtime---サーバーレス実行環境)

---

#### Q7: Runtime機能のタイムアウトはどのくらいですか？

**A**: デフォルトは300秒（5分）ですが、最大900秒（15分）まで延長可能です。

**設定方法**:
```json
{
  "agentCore": {
    "runtime": {
      "lambdaConfig": {
        "timeout": 600
      }
    }
  }
}
```

**推奨値**:
- 簡単なタスク: 60-120秒
- 複雑なタスク: 300-600秒
- 長時間実行: 600-900秒

---

#### Q8: Runtime機能のコールドスタートを削減するには？

**A**: Provisioned Concurrencyを設定することで、コールドスタートを削減できます。

**設定方法**:
```json
{
  "agentCore": {
    "runtime": {
      "lambdaConfig": {
        "provisionedConcurrentExecutions": 5
      }
    }
  }
}
```

**推奨値**:
- 低トラフィック: 1-2インスタンス
- 中トラフィック: 3-5インスタンス
- 高トラフィック: 5-10インスタンス

**注意**: Provisioned Concurrencyは追加コストが発生します。

---

### Gateway

#### Q9: Gateway機能で対応しているAPI仕様は？

**A**: Gateway機能は以下のAPI仕様に対応しています：
- **OpenAPI 3.0以降**: REST API変換
- **AWS Lambda**: 既存のLambda関数統合
- **MCP (Model Context Protocol)**: MCPサーバー統合

**対応していない仕様**:
- OpenAPI 2.0（Swagger）
- GraphQL（直接サポートなし、Lambda経由で可能）
- gRPC（直接サポートなし）

**詳細**: [ユーザーガイド - Gateway](./agentcore-user-guide.md#agentcore-gateway---apilambdamcp変換)

---

#### Q10: Gateway機能で外部APIの認証はどう設定しますか？

**A**: Gateway機能は以下の認証方式をサポートしています：

**1. API Key認証**:
```typescript
{
  authentication: {
    type: 'API_KEY',
    secretArn: 'arn:aws:secretsmanager:...'
  }
}
```

**2. OAuth 2.0認証**:
```typescript
{
  authentication: {
    type: 'OAUTH2',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    tokenUrl: 'https://auth.example.com/token'
  }
}
```

**3. 認証なし**:
```typescript
{
  authentication: {
    type: 'NONE'
  }
}
```

**推奨**: 認証情報はAWS Secrets Managerで管理してください。

---

#### Q11: Gateway機能でLambda関数を統合する際の制限は？

**A**: 以下の制限があります：
- **ランタイム**: Node.js 20.x、Python 3.11以降のみ
- **タイムアウト**: 最大900秒（15分）
- **ペイロードサイズ**: 最大6MB（同期）、256KB（非同期）
- **同時実行数**: アカウント制限に依存

**回避策**:
- 大きなペイロードはS3経由で渡す
- 長時間実行はStep Functions経由で実行
- 同時実行数制限はAWS Supportに引き上げ申請

---

### Memory

#### Q12: Memory機能の短期メモリと長期メモリの違いは？

**A**: 

**短期メモリ（Events）**:
- セッション内の会話履歴を保持
- デフォルト保持期間: 90日
- 用途: 会話のコンテキスト維持

**長期メモリ（Records）**:
- 重要な情報を永続的に保存
- 保持期間: 無期限（手動削除まで）
- 用途: ユーザーの好み、過去の購入履歴等

**例**:
```typescript
// 短期メモリ: 会話履歴
await memoryClient.writeEvent({
  content: { text: 'こんにちは', role: 'USER' }
});

// 長期メモリ: 自動抽出（Memory Strategy）
// ユーザーの好みが自動的に長期メモリに保存される
```

**詳細**: [ユーザーガイド - Memory](./agentcore-user-guide.md#agentcore-memory---メモリ管理)

---

#### Q13: Memory Strategyとは何ですか？

**A**: Memory Strategyは、会話から重要な情報を自動抽出し、長期メモリに保存する機能です。

**3つの組み込み戦略**:

1. **Semantic Strategy**: 事実情報を抽出
   - 例: 「ユーザーは東京在住」「好きな色は青」

2. **Summary Strategy**: 会話を要約
   - 例: 「ユーザーは商品Aについて質問し、購入を検討中」

3. **User Preference Strategy**: ユーザーの好みを抽出
   - 例: 「ユーザーはNikeブランドを好む」

**設定例**:
```json
{
  "agentCore": {
    "memory": {
      "strategies": {
        "semantic": { "enabled": true },
        "summary": { "enabled": true },
        "userPreference": { "enabled": true }
      }
    }
  }
}
```

---

#### Q14: Memory機能の保持期間は変更できますか？

**A**: はい、短期メモリ（Events）の保持期間は変更可能です。

**設定方法**:
```json
{
  "agentCore": {
    "memory": {
      "eventRetentionDays": 30
      }
  }
}
```

**推奨値**:
- 短期利用: 7-30日
- 標準利用: 30-90日
- 長期利用: 90-365日

**注意**: 長期メモリ（Records）は無期限保存されます。手動削除が必要です。

---

### Identity

#### Q15: Identity機能のRBACとABACの違いは？

**A**: 

**RBAC（ロールベースアクセス制御）**:
- ユーザーにロールを割り当て
- ロールに権限を紐付け
- シンプルで管理しやすい

**例**:
```typescript
// ユーザーに「Developer」ロールを割り当て
await identityClient.assignRole({
  userId: 'user-123',
  role: 'Developer'
});

// Developerロールは「READ」「EXECUTE」権限を持つ
```

**ABAC（属性ベースアクセス制御）**:
- ユーザー属性に基づいてアクセス制御
- きめ細かな制御が可能
- 複雑だが柔軟性が高い

**例**:
```typescript
// ポリシー: 「engineering部門」かつ「production環境」のユーザーのみ許可
{
  effect: 'ALLOW',
  conditions: {
    'user.department': 'engineering',
    'user.environment': 'production'
  }
}
```

**推奨**: 小規模システムはRBAC、大規模システムはABACを使用。

**詳細**: [ユーザーガイド - Identity](./agentcore-user-guide.md#agentcore-identity---idアクセス管理)

---

#### Q16: Identity機能でCognitoと統合するには？

**A**: Identity機能はAmazon Cognitoとシームレスに統合できます。

**設定手順**:

1. **Cognito User Poolを作成**:
```bash
aws cognito-idp create-user-pool \
  --pool-name agentcore-users \
  --auto-verified-attributes email
```

2. **CDK設定で統合**:
```json
{
  "agentCore": {
    "identity": {
      "cognitoIntegration": {
        "enabled": true,
        "userPoolId": "ap-northeast-1_XXXXXXXXX"
      }
    }
  }
}
```

3. **ユーザー認証**:
```typescript
const authResult = await identityClient.authenticateUser({
  username: 'user@example.com',
  password: 'password123'
});

// JWTトークンを取得
const jwtToken = authResult.idToken;
```

**メリット**:
- シングルサインオン（SSO）
- 多要素認証（MFA）
- ユーザー管理の簡素化

---

### Browser

#### Q17: Browser機能でどのようなWebサイトにアクセスできますか？

**A**: Browser機能は、ほとんどのWebサイトにアクセスできますが、以下の制限があります：

**アクセス可能**:
- 静的Webサイト
- JavaScriptレンダリングが必要なサイト
- ログインが必要なサイト（認証情報を提供）
- APIエンドポイント

**アクセス制限**:
- CAPTCHAで保護されたサイト（回避困難）
- ボット検出が厳しいサイト（User-Agent偽装が必要）
- 地域制限があるサイト（VPN経由で回避可能）

**推奨設定**:
```json
{
  "agentCore": {
    "browser": {
      "puppeteerConfig": {
        "headless": true,
        "args": [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage"
        ]
      }
    }
  }
}
```

**詳細**: [ユーザーガイド - Browser](./agentcore-user-guide.md#agentcore-browser---クラウドブラウザ)

---

#### Q18: Browser機能のスクリーンショットはどこに保存されますか？

**A**: スクリーンショットは以下の場所に保存されます：

**1. Lambda /tmp ディレクトリ（一時保存）**:
- 最大10GB（Ephemeral Storage設定に依存）
- Lambda実行終了後に削除

**2. FSx for ONTAP（永続保存）**:
- 無制限（ストレージ容量に依存）
- Lambda関数からマウント可能

**3. S3バケット（推奨）**:
- 無制限
- 低コスト
- 長期保存に最適

**設定例**:
```typescript
const screenshot = await browserClient.takeScreenshot({
  url: 'https://example.com',
  saveToS3: true,
  s3Bucket: 'agentcore-screenshots',
  s3Key: `screenshots/${Date.now()}.png`
});

console.log(screenshot.s3Url); // s3://agentcore-screenshots/screenshots/...
```

---

#### Q19: Browser機能でWebスクレイピングの頻度制限はありますか？

**A**: Browser機能自体に頻度制限はありませんが、以下の制限を考慮してください：

**Lambda制限**:
- 同時実行数: アカウント制限（デフォルト1000）
- リクエストレート: 無制限（ただしコストに注意）

**ターゲットサイト制限**:
- レート制限: サイトによって異なる
- ボット検出: 頻繁なアクセスで検出される可能性

**推奨設定**:
```typescript
// リトライロジックを実装
const maxRetries = 3;
const retryDelay = 5000; // 5秒

for (let i = 0; i < maxRetries; i++) {
  try {
    const result = await browserClient.scrape({ url });
    break;
  } catch (error) {
    if (i < maxRetries - 1) {
      await sleep(retryDelay);
    }
  }
}
```

**ベストプラクティス**:
- リクエスト間隔を1-5秒に設定
- User-Agentを適切に設定
- robots.txtを尊重

---

### Code Interpreter

#### Q20: Code Interpreter機能で実行できるプログラミング言語は？

**A**: Code Interpreter機能は以下の言語をサポートしています：

**完全サポート**:
- **Python 3.11**: データ分析、機械学習、科学計算
- **Node.js 20.x**: Web開発、API統合

**制限付きサポート**:
- **Bash**: シェルスクリプト実行（セキュリティ制限あり）

**サポート予定**:
- R: 統計分析
- Julia: 科学計算

**例**:
```typescript
// Python実行
const result = await codeInterpreterClient.execute({
  language: 'python',
  code: `
import pandas as pd
data = pd.DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]})
print(data.describe())
  `
});

// Node.js実行
const result = await codeInterpreterClient.execute({
  language: 'nodejs',
  code: `
const axios = require('axios');
const response = await axios.get('https://api.example.com/data');
console.log(response.data);
  `
});
```

**詳細**: [ユーザーガイド - Code Interpreter](./agentcore-user-guide.md#agentcore-code-interpreter---コード実行)

---

#### Q21: Code Interpreter機能で使用できるPythonパッケージは？

**A**: Code Interpreter機能は、以下のPythonパッケージを事前インストールしています：

**データ分析**:
- pandas
- numpy
- scipy
- matplotlib
- seaborn

**機械学習**:
- scikit-learn
- tensorflow
- pytorch

**その他**:
- requests
- beautifulsoup4
- pillow

**追加パッケージのインストール**:
```python
# 実行時にインストール（初回のみ時間がかかる）
import subprocess
subprocess.check_call(['pip', 'install', 'package-name'])

import package_name
```

**推奨**: よく使うパッケージはLambda Layerに事前インストールしてください。

---

#### Q22: Code Interpreter機能のセキュリティ対策は？

**A**: Code Interpreter機能は以下のセキュリティ対策を実施しています：

**1. サンドボックス実行**:
- Lambda関数内で隔離実行
- ファイルシステムアクセス制限（/tmpのみ）
- ネットワークアクセス制限（VPC内のみ）

**2. コード検証**:
- 危険なコードパターンの検出
- 実行前のサニタイゼーション
- タイムアウト設定（デフォルト60秒）

**3. リソース制限**:
- メモリ制限: 最大10GB
- CPU制限: Lambda制限に依存
- ディスク制限: /tmp最大10GB

**禁止されている操作**:
- システムコマンド実行（一部）
- ファイルシステムの変更（/tmp以外）
- ネットワークスキャン
- 暗号通貨マイニング

**例**:
```python
# ❌ 禁止: システムコマンド実行
import os
os.system('rm -rf /')  # エラー

# ✅ 許可: データ分析
import pandas as pd
df = pd.read_csv('/tmp/data.csv')
```

---

### Observability

#### Q23: Observability機能で監視できるメトリクスは？

**A**: Observability機能は以下のメトリクスを監視できます：

**Lambda関数メトリクス**:
- 実行時間（Duration）
- エラー率（Errors）
- スロットリング（Throttles）
- 同時実行数（ConcurrentExecutions）
- コールドスタート（InitDuration）

**Bedrock Agentメトリクス**:
- Agent呼び出し回数
- Agent応答時間
- Agent成功率
- Agent失敗率

**カスタムメトリクス**:
- ビジネスメトリクス（ユーザー数、売上等）
- アプリケーションメトリクス（API呼び出し数等）

**設定例**:
```json
{
  "agentCore": {
    "observability": {
      "metrics": {
        "lambda": true,
        "bedrock": true,
        "custom": true
      }
    }
  }
}
```

**詳細**: [ユーザーガイド - Observability](./agentcore-user-guide.md#agentcore-observability---監視トレーシング)

---

#### Q24: Observability機能のX-Rayトレーシングとは？

**A**: X-Rayトレーシングは、リクエストの流れを可視化する機能です。

**トレーシング対象**:
- Lambda関数の実行
- Bedrock Agent呼び出し
- DynamoDB操作
- S3操作
- 外部API呼び出し

**メリット**:
- ボトルネックの特定
- エラーの根本原因分析
- パフォーマンス最適化

**有効化方法**:
```json
{
  "agentCore": {
    "observability": {
      "xray": {
        "enabled": true,
        "samplingRate": 0.1
      }
    }
  }
}
```

**サンプリングレート**:
- 開発環境: 1.0（全リクエスト）
- 本番環境: 0.1（10%のリクエスト）

**コスト**: X-Rayトレースは100万トレースあたり$5.00

---

#### Q25: Observability機能でアラートを設定するには？

**A**: CloudWatch Alarmsを使用してアラートを設定できます。

**推奨アラート設定**:

**1. エラー率アラート**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-HighErrorRate \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

**2. レイテンシアラート**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-HighLatency \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

**3. スロットリングアラート**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Throttling \
  --metric-name Throttles \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

**通知設定**: SNSトピックを作成し、メール/SMS/Slackに通知

---

### Evaluations

#### Q26: Evaluations機能で測定できる品質メトリクスは？

**A**: Evaluations機能は以下の品質メトリクスを測定できます：

**正確性メトリクス**:
- **Accuracy**: 正解率
- **Precision**: 適合率
- **Recall**: 再現率
- **F1 Score**: 適合率と再現率の調和平均

**応答品質メトリクス**:
- **Relevance**: 応答の関連性
- **Coherence**: 応答の一貫性
- **Fluency**: 応答の流暢さ

**ビジネスメトリクス**:
- **User Satisfaction**: ユーザー満足度
- **Task Completion Rate**: タスク完了率
- **Response Time**: 応答時間

**設定例**:
```json
{
  "agentCore": {
    "evaluations": {
      "metrics": [
        "accuracy",
        "precision",
        "recall",
        "relevance",
        "userSatisfaction"
      ]
    }
  }
}
```

**詳細**: [ユーザーガイド - Evaluations](./agentcore-user-guide.md#agentcore-evaluations---品質評価)

---

#### Q27: Evaluations機能のA/Bテストとは？

**A**: A/Bテストは、2つのエージェントバージョンを比較する機能です。

**ユースケース**:
- 新しいプロンプトの効果測定
- 異なるモデルの比較（Claude 3 Sonnet vs Haiku）
- パラメータチューニング

**設定方法**:
```json
{
  "agentCore": {
    "evaluations": {
      "abTesting": {
        "enabled": true,
        "variants": {
          "A": {
            "agentId": "agent-v1",
            "trafficPercentage": 50
          },
          "B": {
            "agentId": "agent-v2",
            "trafficPercentage": 50
          }
        }
      }
    }
  }
}
```

**結果の確認**:
```bash
aws dynamodb query \
  --table-name AgentCoreEvaluations \
  --key-condition-expression "evaluationId = :id" \
  --expression-attribute-values '{":id":{"S":"ab-test-001"}}'
```

**推奨期間**: 最低7日間、1000リクエスト以上

---

#### Q28: Evaluations機能でカスタムメトリクスを追加するには？

**A**: カスタムメトリクスは以下の手順で追加できます：

**1. メトリクス計算関数を作成**:
```typescript
// lambda/evaluations/custom-metrics.ts
export function calculateCustomMetric(
  expected: string,
  actual: string
): number {
  // カスタムロジック
  const similarity = calculateSimilarity(expected, actual);
  return similarity;
}
```

**2. CDK設定で登録**:
```json
{
  "agentCore": {
    "evaluations": {
      "customMetrics": [
        {
          "name": "customSimilarity",
          "functionArn": "arn:aws:lambda:..."
        }
      ]
    }
  }
}
```

**3. 評価実行**:
```typescript
const result = await evaluationsClient.evaluate({
  agentId: 'agent-123',
  testData: testDataset,
  metrics: ['accuracy', 'customSimilarity']
});
```

---

### Policy

#### Q29: Policy機能のCedarポリシー言語とは？

**A**: Cedarは、Amazonが開発したポリシー言語で、人間が読みやすく、形式的に検証可能な特徴があります。

**Cedarポリシーの例**:
```cedar
// 許可ポリシー
permit(
  principal in Group::"engineering",
  action == Action::"InvokeAgent",
  resource == Agent::"customer-support-agent"
);

// 拒否ポリシー
forbid(
  principal,
  action == Action::"DeleteAgent",
  resource
) when {
  resource.environment == "production"
};
```

**メリット**:
- 人間が読みやすい
- 形式的検証が可能
- ポリシー競合の検出

**詳細**: [ユーザーガイド - Policy](./agentcore-user-guide.md#agentcore-policy---ポリシー管理)

---

#### Q30: Policy機能で自然言語からCedarポリシーを生成するには？

**A**: Policy機能は、自然言語からCedarポリシーを自動生成できます。

**例**:
```typescript
// 自然言語でポリシーを記述
const naturalLanguage = `
Allow users in the engineering department to invoke the customer support agent.
Deny all users from deleting agents in the production environment.
`;

// Cedarポリシーに変換
const cedarPolicy = await policyClient.convertPolicy({
  naturalLanguage: naturalLanguage
});

console.log(cedarPolicy);
// permit(principal in Group::"engineering", action == Action::"InvokeAgent", ...);
// forbid(principal, action == Action::"DeleteAgent", ...);
```

**サポートされている表現**:
- "Allow users in [group] to [action] [resource]"
- "Deny [principal] from [action] [resource]"
- "Permit [principal] to [action] [resource] when [condition]"

**制限**:
- 複雑な条件式は手動調整が必要
- 日本語は部分的にサポート（英語推奨）

---

#### Q31: Policy機能でポリシー競合を検出するには？

**A**: Policy機能は、ポリシー競合を自動検出できます。

**競合の種類**:

**1. 許可と拒否の競合**:
```cedar
// ポリシーA: 許可
permit(principal, action == Action::"InvokeAgent", resource);

// ポリシーB: 拒否
forbid(principal, action == Action::"InvokeAgent", resource);
```

**2. 条件の競合**:
```cedar
// ポリシーA: department=engineering のみ許可
permit(principal, action, resource) when { principal.department == "engineering" };

// ポリシーB: department=sales のみ許可
permit(principal, action, resource) when { principal.department == "sales" };
```

**競合検出**:
```typescript
const conflicts = await policyClient.checkConflicts({
  userId: 'user-123',
  action: 'InvokeAgent',
  resource: 'agent-456'
});

if (conflicts.length > 0) {
  console.log('ポリシー競合が検出されました:', conflicts);
}
```

**解決策**:
- ポリシー優先順位を設定（Explicit Deny > Explicit Allow > Default Deny）
- 条件を明確化
- 不要なポリシーを削除

---

## トラブルシューティング

### Q32: AgentCore機能を有効化したが動作しない場合は？

**A**: 以下の手順で確認してください：

**1. CDK設定ファイルの確認**:
```bash
cat cdk.context.json | jq '.agentCore'
```
→ `enabled: true`になっているか確認

**2. デプロイの確認**:
```bash
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].StackStatus'
```
→ `CREATE_COMPLETE`または`UPDATE_COMPLETE`になっているか確認

**3. Lambda関数の確認**:
```bash
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `AgentCore`)].FunctionName'
```
→ 該当するLambda関数が存在するか確認

**4. 環境変数の確認**:
```bash
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'Environment.Variables'
```
→ 必要な環境変数が設定されているか確認

**5. CloudWatch Logsの確認**:
```bash
aws logs tail /aws/lambda/[FUNCTION_NAME] --follow
```
→ エラーログを確認

**詳細**: [トラブルシューティングガイド](./debugging-troubleshooting-guide.md)

---

### Q33: Lambda関数のコールドスタートが遅い場合は？

**A**: 以下の対策を実施してください：

**1. Provisioned Concurrencyを設定**:
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name [FUNCTION_NAME] \
  --provisioned-concurrent-executions 5 \
  --qualifier prod
```

**2. メモリサイズを増加**:
```bash
aws lambda update-function-configuration \
  --function-name [FUNCTION_NAME] \
  --memory-size 3008
```

**3. 不要な依存関係を削除**:
- `package.json`から未使用のパッケージを削除
- Lambda Layersを活用

**4. 初期化処理を最適化**:
```typescript
// ❌ 悪い例: ハンドラー内で初期化
export const handler = async (event) => {
  const client = new BedrockClient(); // 毎回初期化
  // ...
};

// ✅ 良い例: ハンドラー外で初期化
const client = new BedrockClient(); // 一度だけ初期化

export const handler = async (event) => {
  // clientを再利用
};
```

**期待される改善**:
- コールドスタート: 5秒 → 1秒
- ウォームスタート: 500ms → 100ms

---

### Q34: DynamoDBのスロットリングエラーが発生する場合は？

**A**: 以下の対策を実施してください：

**1. Auto Scalingを有効化**:
```bash
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/AgentCoreIdentity \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100
```

**2. Read/Write Capacity Unitsを増加**:
```bash
aws dynamodb update-table \
  --table-name AgentCoreIdentity \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10
```

**3. On-Demand Modeに変更**:
```bash
aws dynamodb update-table \
  --table-name AgentCoreIdentity \
  --billing-mode PAY_PER_REQUEST
```

**4. GSI（Global Secondary Index）のキャパシティも確認**:
```bash
aws dynamodb describe-table \
  --table-name AgentCoreIdentity \
  --query 'Table.GlobalSecondaryIndexes[*].ProvisionedThroughput'
```

**推奨**: 本番環境ではOn-Demand Modeを使用

---

### Q35: Memory機能で長期メモリが抽出されない場合は？

**A**: 以下を確認してください：

**1. Memory Strategiesが有効化されているか**:
```bash
aws bedrock-agent get-memory \
  --memory-id [MEMORY_ID] \
  --query 'memoryConfiguration.strategies'
```

**2. イベントが正しく書き込まれているか**:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --filter-pattern "writeEvent" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

**3. Extraction Promptが適切か**:
```json
{
  "agentCore": {
    "memory": {
      "strategies": {
        "semantic": {
          "enabled": true,
          "extractionPrompt": "Extract key facts and entities from the conversation."
        }
      }
    }
  }
}
```

**4. 手動でメモリを確認**:
```bash
aws bedrock-agent-runtime get-memory \
  --agent-id [AGENT_ID] \
  --session-id [SESSION_ID] \
  --memory-type RECORDS \
  --max-items 10
```

**デバッグ**: CloudWatch Logsで`Memory Strategy execution`を検索

---

## パフォーマンス

### Q36: AgentCoreのレスポンス時間を改善するには？

**A**: 以下の最適化手法を実施してください：

**1. Lambda関数の最適化**:
```json
{
  "agentCore": {
    "runtime": {
      "lambdaConfig": {
        "memorySize": 3008,
        "timeout": 300,
        "provisionedConcurrentExecutions": 5
      }
    }
  }
}
```

**2. Bedrock Agentの最適化**:
- モデル選択: Claude 3 Haiku（高速）vs Sonnet（高品質）
- プロンプト最適化: 簡潔で明確な指示
- ツール数削減: 必要最小限のツールのみ有効化

**3. Memory機能の最適化**:
- 短期メモリのみ使用（長期メモリは必要時のみ）
- Memory Strategiesを選択的に有効化

**4. キャッシュの活用**:
```typescript
// DynamoDBでキャッシュ
const cachedResult = await dynamodb.get({
  TableName: 'AgentCache',
  Key: { requestHash: hash(request) }
}).promise();

if (cachedResult.Item) {
  return cachedResult.Item.response;
}
```

**期待される改善**:
- レスポンス時間: 5秒 → 1-2秒
- スループット: 10 req/s → 50 req/s

---

### Q37: AgentCoreの同時実行数を増やすには？

**A**: 以下の設定を調整してください：

**1. Lambda同時実行数の引き上げ**:
```bash
# アカウント制限の確認
aws service-quotas get-service-quota \
  --service-code lambda \
  --quota-code L-B99A9384

# 引き上げ申請
aws service-quotas request-service-quota-increase \
  --service-code lambda \
  --quota-code L-B99A9384 \
  --desired-value 5000
```

**2. Reserved Concurrencyの設定**:
```bash
aws lambda put-function-concurrency \
  --function-name [FUNCTION_NAME] \
  --reserved-concurrent-executions 100
```

**3. Provisioned Concurrencyの増加**:
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name [FUNCTION_NAME] \
  --provisioned-concurrent-executions 20 \
  --qualifier prod
```

**4. DynamoDBのキャパシティ増加**:
```bash
aws dynamodb update-table \
  --table-name AgentCoreIdentity \
  --billing-mode PAY_PER_REQUEST
```

**推奨設定**:
- 低トラフィック: 10-50同時実行
- 中トラフィック: 50-200同時実行
- 高トラフィック: 200-1000同時実行

---

### Q38: AgentCoreのコストを削減するには？

**A**: 以下のコスト最適化手法を実施してください：

**1. 不要な機能を無効化**:
```json
{
  "agentCore": {
    "runtime": { "enabled": true },
    "memory": { "enabled": true },
    "gateway": { "enabled": false },
    "browser": { "enabled": false },
    "codeInterpreter": { "enabled": false }
  }
}
```

**2. Provisioned Concurrencyを最小化**:
```json
{
  "agentCore": {
    "runtime": {
      "lambdaConfig": {
        "provisionedConcurrentExecutions": 1
      }
    }
  }
}
```

**3. CloudWatch Logsの保持期間を短縮**:
```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --retention-in-days 7
```

**4. S3ライフサイクルポリシーを設定**:
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket agentcore-screenshots \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldScreenshots",
      "Status": "Enabled",
      "Expiration": { "Days": 30 }
    }]
  }'
```

**5. DynamoDBをOn-Demandに変更**:
```bash
aws dynamodb update-table \
  --table-name AgentCoreIdentity \
  --billing-mode PAY_PER_REQUEST
```

**期待されるコスト削減**:
- Lambda: 30-50%削減
- CloudWatch Logs: 50-70%削減
- S3: 40-60%削減

---

## セキュリティ

### Q39: AgentCoreのセキュリティベストプラクティスは？

**A**: 以下のセキュリティ対策を実施してください：

**1. IAM Roleの最小権限設定**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "bedrock:InvokeAgent",
      "dynamodb:GetItem",
      "dynamodb:PutItem"
    ],
    "Resource": [
      "arn:aws:bedrock:*:*:agent/*",
      "arn:aws:dynamodb:*:*:table/AgentCore*"
    ]
  }]
}
```

**2. VPC統合**:
```json
{
  "agentCore": {
    "runtime": {
      "vpcConfig": {
        "enabled": true,
        "subnetIds": ["subnet-xxx", "subnet-yyy"],
        "securityGroupIds": ["sg-xxx"]
      }
    }
  }
}
```

**3. KMS暗号化**:
```json
{
  "agentCore": {
    "runtime": {
      "kmsKeyArn": "arn:aws:kms:ap-northeast-1:123456789012:key/xxx"
    }
  }
}
```

**4. Secrets Managerで認証情報管理**:
```typescript
const secret = await secretsManager.getSecretValue({
  SecretId: 'agentcore/api-keys'
}).promise();

const apiKey = JSON.parse(secret.SecretString).apiKey;
```

**5. CloudTrailで監査ログ記録**:
```bash
aws cloudtrail create-trail \
  --name agentcore-audit \
  --s3-bucket-name agentcore-audit-logs
```

---

### Q40: AgentCoreで個人情報を扱う際の注意点は？

**A**: 以下のガイドラインに従ってください：

**1. データ暗号化**:
- **保存時**: KMS暗号化を有効化
- **転送時**: TLS 1.2以上を使用

**2. アクセス制御**:
- RBAC/ABACで個人情報へのアクセスを制限
- 最小権限の原則を適用

**3. データ保持期間**:
```json
{
  "agentCore": {
    "memory": {
      "eventRetentionDays": 30,
      "piiDataRetentionDays": 7
    }
  }
}
```

**4. データマスキング**:
```typescript
// 個人情報をマスキング
function maskPII(text: string): string {
  return text
    .replace(/\d{3}-\d{4}-\d{4}/g, '***-****-****') // 電話番号
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '***@***.***'); // メールアドレス
}
```

**5. GDPR/CCPA対応**:
- ユーザーの同意取得
- データ削除リクエストへの対応
- データポータビリティの提供

**参考**: [AWS GDPR Center](https://aws.amazon.com/compliance/gdpr-center/)

---

### Q41: AgentCoreのセキュリティ監査を実施するには？

**A**: 以下の手順で監査を実施してください：

**1. CloudTrailログの確認**:
```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::Lambda::Function \
  --start-time $(date -u -d '7 days ago' --iso-8601) \
  --end-time $(date -u --iso-8601)
```

**2. IAM Access Analyzerの実行**:
```bash
aws accessanalyzer create-analyzer \
  --analyzer-name agentcore-analyzer \
  --type ACCOUNT
```

**3. AWS Configでコンプライアンスチェック**:
```bash
aws configservice put-config-rule \
  --config-rule '{
    "ConfigRuleName": "lambda-vpc-check",
    "Source": {
      "Owner": "AWS",
      "SourceIdentifier": "LAMBDA_INSIDE_VPC"
    }
  }'
```

**4. GuardDutyで脅威検出**:
```bash
aws guardduty create-detector \
  --enable
```

**5. Security Hubで統合監視**:
```bash
aws securityhub enable-security-hub
```

**推奨頻度**:
- 日次: CloudTrailログ確認
- 週次: IAM Access Analyzer実行
- 月次: 包括的なセキュリティ監査

---

## コスト

### Q42: AgentCoreの月額コストはどのくらいですか？

**A**: コストは使用量に応じて変動しますが、以下が目安です：

**最小構成（Runtime + Memory）**:
- Lambda実行: $10-50/月
- DynamoDB: $5-20/月
- Bedrock Memory: $20-100/月
- CloudWatch Logs: $5-10/月
- **合計**: $40-180/月

**完全構成（全9機能）**:
- Lambda実行: $50-200/月
- DynamoDB: $20-100/月
- Bedrock Memory: $50-300/月
- S3ストレージ: $10-50/月
- CloudWatch Logs: $10-30/月
- X-Ray: $5-20/月
- **合計**: $145-700/月

**高トラフィック環境（10,000 req/day）**:
- Lambda実行: $200-500/月
- Provisioned Concurrency: $100-300/月
- DynamoDB: $100-300/月
- Bedrock Memory: $300-1000/月
- **合計**: $700-2100/月

**コスト削減のヒント**: [Q38](#q38-agentcoreのコストを削減するには)を参照

---

### Q43: AgentCoreのコストを見積もるには？

**A**: AWS Pricing Calculatorを使用して見積もりができます。

**見積もり手順**:

**1. Lambda実行コスト**:
```
リクエスト数: 10,000 req/day × 30 days = 300,000 req/month
実行時間: 平均3秒
メモリ: 2048MB

コスト = (300,000 × $0.0000002) + (300,000 × 3 × 2048/1024 × $0.0000166667)
      = $0.06 + $30 = $30.06/month
```

**2. DynamoDB コスト**:
```
読み取り: 10,000 req/day × 30 days = 300,000 req/month
書き込み: 5,000 req/day × 30 days = 150,000 req/month

On-Demand Mode:
コスト = (300,000 × $0.25/million) + (150,000 × $1.25/million)
      = $0.075 + $0.1875 = $0.26/month
```

**3. Bedrock Memory コスト**:
```
イベント書き込み: 10,000 events/day × 30 days = 300,000 events/month
ストレージ: 1GB

コスト = (300,000 × $0.001) + (1 × $0.30)
      = $300 + $0.30 = $300.30/month
```

**4. S3 ストレージコスト**:
```
スクリーンショット: 100 screenshots/day × 30 days × 1MB = 3GB/month

コスト = 3 × $0.023 = $0.069/month
```

**合計**: $330.72/month

**AWS Pricing Calculator**: https://calculator.aws/

---

### Q44: AgentCoreのコストアラートを設定するには？

**A**: AWS Budgetsを使用してコストアラートを設定できます。

**設定手順**:

**1. 予算を作成**:
```bash
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "AgentCore-Monthly-Budget",
    "BudgetLimit": {
      "Amount": "500",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
      "TagKeyValue": ["Project$AgentCore"]
    }
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "admin@example.com"
    }]
  }]'
```

**2. コストエクスプローラーで分析**:
```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{
    "Tags": {
      "Key": "Project",
      "Values": ["AgentCore"]
    }
  }'
```

**3. CloudWatch Alarmsで監視**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-HighCost \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 500 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

**推奨アラート設定**:
- 80%到達: 警告メール
- 90%到達: 緊急メール + Slack通知
- 100%到達: 自動スケールダウン

---

## デプロイメント

### Q45: AgentCoreを本番環境にデプロイする前のチェックリストは？

**A**: 以下のチェックリストを確認してください：

**デプロイ前チェック**:
- [ ] TypeScriptコンパイル成功（`npm run build`）
- [ ] 全テスト合格（`npm test`）
- [ ] CDK構文チェック成功（`npx cdk synth --quiet`）
- [ ] 設定ファイル選択完了（`cdk.context.json`）
- [ ] AWS認証情報確認（`aws sts get-caller-identity`）
- [ ] IAM権限確認
- [ ] バックアップ作成

**セキュリティチェック**:
- [ ] VPC統合設定
- [ ] KMS暗号化設定
- [ ] Secrets Manager設定
- [ ] IAM Role最小権限設定
- [ ] CloudTrail有効化

**パフォーマンスチェック**:
- [ ] Lambda メモリサイズ設定（推奨: 2048MB以上）
- [ ] Lambda タイムアウト設定（推奨: 300秒）
- [ ] Provisioned Concurrency設定（必要に応じて）
- [ ] DynamoDB Auto Scaling設定

**コストチェック**:
- [ ] 不要な機能を無効化
- [ ] CloudWatch Logs保持期間設定（推奨: 30日）
- [ ] S3ライフサイクルポリシー設定
- [ ] コストアラート設定

**詳細**: [デプロイメントガイド](./agentcore-deployment-guide.md)

---

### Q46: AgentCoreのロールバック手順は？

**A**: 以下の手順でロールバックできます：

**緊急ロールバック（全スタック削除）**:
```bash
npx cdk destroy --all -c imageTag=agentcore-20260105-000000
```

**段階的ロールバック**:
```bash
# Step 1: OperationsStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Operations

# Step 2: WebAppStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-WebApp

# Step 3: SecurityStack削除
npx cdk destroy TokyoRegion-permission-aware-rag-prod-Security
```

**部分的ロールバック（特定機能のみ無効化）**:
```json
{
  "agentCore": {
    "runtime": { "enabled": false }
  }
}
```
```bash
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
```

**バックアップからの復元**:
```bash
# 設定ファイルのバックアップから復元
cp cdk.context.json.backup cdk.context.json

# 再デプロイ
npx cdk deploy --all
```

**注意**: ロールバック前にデータのバックアップを取得してください。

---

### Q47: AgentCoreを複数環境（dev/staging/prod）にデプロイするには？

**A**: 環境別の設定ファイルを作成し、デプロイ時に切り替えます。

**設定ファイルの作成**:

**1. 開発環境（`cdk.context.dev.json`）**:
```json
{
  "environment": "dev",
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "memorySize": 1024,
        "timeout": 60,
        "provisionedConcurrentExecutions": 0
      }
    },
    "memory": { "enabled": true },
    "gateway": { "enabled": false }
  }
}
```

**2. ステージング環境（`cdk.context.staging.json`）**:
```json
{
  "environment": "staging",
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "memorySize": 2048,
        "timeout": 300,
        "provisionedConcurrentExecutions": 2
      }
    },
    "memory": { "enabled": true },
    "gateway": { "enabled": true }
  }
}
```

**3. 本番環境（`cdk.context.prod.json`）**:
```json
{
  "environment": "prod",
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "memorySize": 3008,
        "timeout": 300,
        "provisionedConcurrentExecutions": 5
      }
    },
    "memory": { "enabled": true },
    "gateway": { "enabled": true },
    "observability": { "enabled": true }
  }
}
```

**デプロイスクリプト**:
```bash
#!/bin/bash
ENV=$1

if [ -z "$ENV" ]; then
  echo "Usage: ./deploy.sh [dev|staging|prod]"
  exit 1
fi

# 設定ファイルをコピー
cp cdk.context.$ENV.json cdk.context.json

# デプロイ
npx cdk deploy --all -c environment=$ENV

echo "Deployed to $ENV environment"
```

**使用方法**:
```bash
./deploy.sh dev      # 開発環境にデプロイ
./deploy.sh staging  # ステージング環境にデプロイ
./deploy.sh prod     # 本番環境にデプロイ
```

---

### Q48: AgentCoreのCI/CDパイプラインを構築するには？

**A**: GitHub ActionsまたはAWS CodePipelineを使用してCI/CDパイプラインを構築できます。

**GitHub Actions例**:

```yaml
# .github/workflows/deploy.yml
name: Deploy AgentCore

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      
      - name: CDK Deploy
        run: npx cdk deploy --all --require-approval never
```

**AWS CodePipeline例**:

```typescript
// lib/pipeline-stack.ts
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

const pipeline = new codepipeline.Pipeline(this, 'AgentCorePipeline', {
  pipelineName: 'AgentCore-CI-CD'
});

// Source Stage
const sourceOutput = new codepipeline.Artifact();
pipeline.addStage({
  stageName: 'Source',
  actions: [
    new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: 'your-org',
      repo: 'your-repo',
      oauthToken: cdk.SecretValue.secretsManager('github-token'),
      output: sourceOutput,
      branch: 'main'
    })
  ]
});

// Build Stage
const buildOutput = new codepipeline.Artifact();
pipeline.addStage({
  stageName: 'Build',
  actions: [
    new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput]
    })
  ]
});

// Deploy Stage
pipeline.addStage({
  stageName: 'Deploy',
  actions: [
    new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploy',
      templatePath: buildOutput.atPath('cdk.out/WebAppStack.template.json'),
      stackName: 'AgentCore-WebApp',
      adminPermissions: true
    })
  ]
});
```

**推奨**: 本番環境へのデプロイ前に手動承認ステージを追加

---

## 追加リソース

### Q49: AgentCoreの詳細なドキュメントはどこにありますか？

**A**: 以下のドキュメントを参照してください：

**ユーザー向けドキュメント**:
- [AgentCoreユーザーガイド](./agentcore-user-guide.md) - 機能の使い方
- [AgentCore FAQ](./agentcore-faq.md) - よくある質問（本ドキュメント）
- [クイックスタートガイド](./quick-start.md) - 初めての方向け

**開発者向けドキュメント**:
- [AgentCore実装ガイド](./bedrock-agentcore-implementation-guide.md) - 実装詳細
- [デプロイメントガイド](./agentcore-deployment-guide.md) - デプロイ手順
- [デバッグ・トラブルシューティングガイド](./debugging-troubleshooting-guide.md) - 問題解決

**運用者向けドキュメント**:
- [運用・保守ガイド](./operations-maintenance-guide-ja.md) - 運用手順
- [監視・アラート設定ガイド](./agentcore-monitoring-guide.md)（作成予定）

**外部リソース**:
- [Amazon Bedrock公式ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda公式ドキュメント](https://docs.aws.amazon.com/lambda/)
- [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)

---

### Q50: AgentCoreのサポートを受けるには？

**A**: 以下の方法でサポートを受けられます：

**1. 社内サポート**:
- チーム内エスカレーション
- シニア開発者への相談
- 社内ドキュメントの確認

**2. AWS Support**:
- **Developer Support**: 営業時間内のサポート
- **Business Support**: 24時間365日のサポート
- **Enterprise Support**: 専任のTechnical Account Manager

**AWS Support Case作成**:
```bash
aws support create-case \
  --subject "AgentCore Runtime Lambda function error" \
  --service-code "amazon-bedrock" \
  --category-code "using-aws" \
  --severity-code "urgent" \
  --communication-body "
    Error: Agent not found
    Function: TokyoRegion-project-name-prod-AgentCoreRuntime-Function
    Region: ap-northeast-1
    Logs: https://console.aws.amazon.com/cloudwatch/...
  "
```

**3. コミュニティサポート**:
- [AWS re:Post](https://repost.aws/) - AWS公式Q&Aフォーラム
- [Stack Overflow](https://stackoverflow.com/questions/tagged/amazon-bedrock) - タグ: amazon-bedrock
- [GitHub Issues](https://github.com/your-org/your-repo/issues) - プロジェクトのIssue

**4. トレーニング**:
- [AWS Skill Builder](https://skillbuilder.aws/) - 無料オンライントレーニング
- [AWS Training and Certification](https://aws.amazon.com/training/) - 有料トレーニング

**エスカレーション手順**: [トラブルシューティングガイド - エスカレーション手順](./debugging-troubleshooting-guide.md#12-エスカレーション手順)

---

## まとめ

このFAQドキュメントでは、Amazon Bedrock AgentCoreの9つの機能に関する50個のよくある質問と回答を提供しました。

### カテゴリ別質問数

| カテゴリ | 質問数 | 主なトピック |
|---------|--------|-------------|
| 一般的な質問 | 5 | 概要、リージョン、料金 |
| Runtime | 3 | タイムアウト、コールドスタート |
| Gateway | 3 | API仕様、認証、Lambda統合 |
| Memory | 3 | 短期/長期メモリ、Memory Strategy |
| Identity | 2 | RBAC/ABAC、Cognito統合 |
| Browser | 3 | Webアクセス、スクリーンショット、スクレイピング |
| Code Interpreter | 3 | 言語サポート、パッケージ、セキュリティ |
| Observability | 3 | メトリクス、X-Ray、アラート |
| Evaluations | 3 | 品質メトリクス、A/Bテスト、カスタムメトリクス |
| Policy | 3 | Cedar、自然言語変換、競合検出 |
| トラブルシューティング | 4 | 動作不良、コールドスタート、スロットリング |
| パフォーマンス | 3 | レスポンス時間、同時実行数、コスト削減 |
| セキュリティ | 3 | ベストプラクティス、個人情報、監査 |
| コスト | 3 | 月額コスト、見積もり、アラート |
| デプロイメント | 4 | チェックリスト、ロールバック、複数環境、CI/CD |
| 追加リソース | 2 | ドキュメント、サポート |
| **合計** | **50** | **全カテゴリ網羅** |

### 次のステップ

1. **初めての方**: [クイックスタートガイド](./quick-start.md)から始めてください
2. **実装する方**: [AgentCore実装ガイド](./bedrock-agentcore-implementation-guide.md)を参照してください
3. **デプロイする方**: [デプロイメントガイド](./agentcore-deployment-guide.md)を参照してください
4. **問題が発生した方**: [トラブルシューティングガイド](./debugging-troubleshooting-guide.md)を参照してください

### フィードバック

このFAQドキュメントに関するフィードバックや追加の質問がある場合は、以下の方法でお知らせください：

- **GitHub Issues**: プロジェクトのIssueを作成
- **社内チャット**: 開発チームに連絡
- **メール**: agentcore-support@example.com

---

**最終更新**: 2026-01-17  
**バージョン**: v1.0.0  
**次回更新予定**: 2026-02-17

**このドキュメントは継続的に更新されます。新しい質問や回答が追加され次第、更新してください。**

