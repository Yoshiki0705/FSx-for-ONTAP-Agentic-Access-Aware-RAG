# AgentCore ユーザーガイド

**最終更新**: 2026-01-05  
**対象**: エンドユーザー、開発者、システム管理者  
**バージョン**: 1.0

---

## 📋 概要

このガイドは、Amazon Bedrock AgentCore機能をエンドユーザーの視点から説明します。AgentCoreは、AIエージェントの開発と運用を簡素化する9つの強力な機能を提供します。

### 対象読者

- **エンドユーザー**: AgentCore機能を使用してAIエージェントを構築したい方
- **開発者**: AgentCore機能を統合したアプリケーションを開発したい方
- **システム管理者**: AgentCore機能を運用・管理したい方

### 前提知識

- AWS基礎知識（Lambda、DynamoDB、S3等）
- Amazon Bedrock基礎知識
- TypeScript/JavaScript基礎知識（開発者向け）

---

## 🎯 AgentCore機能の全体像

AgentCoreは、AIエージェントの開発と運用を支援する9つの機能で構成されています：

| 機能 | 説明 | 主な用途 |
|------|------|---------|
| **Runtime** | エージェント実行環境 | エージェントの起動・実行・スケーリング |
| **Gateway** | 外部ツール統合 | REST API、Lambda、MCPサーバーの統合 |
| **Memory** | 記憶管理 | 会話履歴、長期記憶、ユーザー設定の保存 |
| **Identity** | 認証・認可 | エージェントID管理、RBAC、ABAC |
| **Browser** | Webブラウザ自動化 | Webスクレイピング、スクリーンショット |
| **Code Interpreter** | コード実行 | Python/Node.jsコードの実行、パッケージ管理 |
| **Observability** | 監視・トレーシング | X-Ray、CloudWatch、エラー追跡 |
| **Evaluations** | 品質評価 | 品質メトリクス、A/Bテスト、パフォーマンス評価 |
| **Policy** | ポリシー管理 | 自然言語ポリシー、Cedar統合、形式的検証 |

---

## 🚀 クイックスタート

### ステップ1: AgentCore機能の有効化

`cdk.context.json`で使用したい機能を有効化します：

```json
{
  "agentCore": {
    "runtime": {
      "enabled": true
    },
    "gateway": {
      "enabled": true
    },
    "memory": {
      "enabled": true
    }
  }
}
```

### ステップ2: デプロイ

```bash
# CDKスタックをデプロイ
npx cdk deploy --all
```


### ステップ3: 機能の使用

各機能は独立して使用できます。以下は基本的な使用例です。

---

## 📖 機能別ガイド

### 1. Runtime - エージェント実行環境

**概要**: Runtimeは、AIエージェントを実行するための基盤機能です。Lambda関数とEventBridgeを使用して、エージェントの起動、実行、スケーリングを自動化します。

**主な機能**:
- エージェントの自動起動・実行
- イベント駆動型の非同期処理
- 自動スケーリング（Reserved/Provisioned Concurrency）
- KMS暗号化による環境変数の保護

**使用例**:

```typescript
// cdk.context.jsonでの設定
{
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "timeout": 30,
        "memorySize": 2048,
        "reservedConcurrentExecutions": 5
      },
      "eventBridgeConfig": {
        "enabled": true,
        "scheduleExpression": "rate(5 minutes)"
      }
    }
  }
}
```

**ユースケース**:
1. **定期的なデータ処理**: EventBridgeスケジュールでエージェントを定期実行
2. **イベント駆動処理**: S3アップロード、DynamoDB更新等のイベントでエージェント起動
3. **バッチ処理**: 大量のデータを並列処理

**ベストプラクティス**:
- タイムアウトは処理時間の1.5倍に設定
- メモリサイズは実際の使用量の1.2倍に設定
- Reserved Concurrencyで同時実行数を制限

**制限事項**:
- Lambda関数の最大実行時間: 15分
- Reserved Concurrency: 1-1000インスタンス
- Provisioned Concurrency: 最大100インスタンス


---

### 2. Gateway - 外部ツール統合

**概要**: Gatewayは、REST API、Lambda関数、MCPサーバーをBedrock Agent Toolとして統合する機能です。既存のAPIやサービスをエージェントから簡単に呼び出せるようになります。

**主な機能**:
- REST API → Bedrock Agent Tool変換（OpenAPI仕様ベース）
- Lambda関数 → Bedrock Agent Tool変換（メタデータベース）
- MCPサーバー統合（HTTP/HTTPSエンドポイント経由）
- 認証・認可の自動設定（API Key、OAuth2、IAM）

**使用例**:

```typescript
// REST API変換の設定
{
  "agentCore": {
    "gateway": {
      "enabled": true,
      "restApiConversionConfig": {
        "openApiSpecPath": "s3://my-bucket/openapi.yaml",
        "apiGatewayIntegration": {
          "apiId": "abc123",
          "stageName": "prod",
          "authType": "IAM"
        }
      }
    }
  }
}
```

**ユースケース**:
1. **既存APIの統合**: 社内APIをエージェントから呼び出し
2. **サードパーティAPI統合**: 外部サービス（天気、ニュース等）の統合
3. **マイクロサービス統合**: 複数のLambda関数を統合

**ベストプラクティス**:
- OpenAPI仕様は最新版（3.0以上）を使用
- API Keyは必ずSecrets Managerで管理
- レート制限を設定してAPI呼び出しを制御

**制限事項**:
- OpenAPI仕様のサイズ: 最大1MB
- 同時API呼び出し数: Lambda Concurrencyに依存
- タイムアウト: 30秒（Lambda関数のタイムアウト）


---

### 3. Memory - 記憶管理

**概要**: Memoryは、エージェントの会話履歴と長期記憶を管理する機能です。フルマネージドサービスとして提供され、短期記憶（Events）と長期記憶（Records）を自動的に管理します。

**主な機能**:
- 短期記憶（Events）: 会話履歴の保存・取得
- 長期記憶（Records）: 重要な情報の自動抽出・保存
- Memory Strategies: Semantic、Summary、User Preferenceの3種類
- セッション管理: ユーザーごとの記憶の分離

**使用例**:

```typescript
// Memory設定
{
  "agentCore": {
    "memory": {
      "enabled": true,
      "memoryStrategyConfig": {
        "enableSemantic": true,
        "enableSummary": true,
        "enableUserPreference": true,
        "semanticNamespaces": ["conversation", "knowledge"],
        "summaryNamespaces": ["daily", "weekly"],
        "userPreferenceNamespaces": ["settings", "preferences"]
      }
    }
  }
}
```

**ユースケース**:
1. **会話履歴の保持**: ユーザーとの過去の会話を記憶
2. **ユーザー設定の保存**: 言語設定、表示設定等を記憶
3. **知識の蓄積**: 重要な情報を長期記憶として保存

**ベストプラクティス**:
- Semantic Strategyで重要な情報を自動抽出
- Summary Strategyで会話の要約を定期的に作成
- User Preference Strategyでユーザー設定を保存

**制限事項**:
- 短期記憶の保持期間: 最大30日
- 長期記憶のサイズ: 無制限（コストに注意）
- セッション数: 無制限


---

### 4. Identity - 認証・認可

**概要**: Identityは、エージェントの認証と認可を管理する機能です。RBAC（ロールベースアクセス制御）とABAC（属性ベースアクセス制御）をサポートします。

**主な機能**:
- エージェントID管理（一意のID生成・管理）
- RBAC: Admin、User、ReadOnlyの3つのロール
- ABAC: 部署、プロジェクト、機密度による動的権限制御
- DynamoDBによる高速なID検証

**使用例**:

```typescript
// Identity設定
{
  "agentCore": {
    "identity": {
      "enabled": true,
      "dynamoDbConfig": {
        "tableName": "AgentCoreIdentity",
        "readCapacity": 5,
        "writeCapacity": 5,
        "pointInTimeRecovery": true
      },
      "rbacConfig": {
        "defaultRole": "User",
        "customRoles": [
          {
            "name": "DataScientist",
            "permissions": ["read:data", "write:models"]
          }
        ]
      },
      "abacConfig": {
        "enableDepartmentAttribute": true,
        "enableProjectAttribute": true,
        "enableSensitivityAttribute": true
      }
    }
  }
}
```

**ユースケース**:
1. **マルチテナント環境**: 複数の組織でエージェントを共有
2. **権限管理**: ユーザーごとに異なる権限を設定
3. **監査ログ**: エージェントの操作履歴を記録

**ベストプラクティス**:
- 最小権限の原則を適用（必要最小限の権限のみ付与）
- ABACで動的な権限制御を実装
- DynamoDBのPoint-in-Time Recoveryを有効化

**制限事項**:
- エージェントID数: 無制限（DynamoDBの制限に依存）
- カスタムロール数: 最大100個
- 属性数: 最大50個


---

### 5. Browser - Webブラウザ自動化

**概要**: Browserは、Puppeteerを使用してWebブラウザを自動化する機能です。Webスクレイピング、スクリーンショット撮影、フォーム入力等が可能です。

**主な機能**:
- Headless Chrome統合（Puppeteer + @sparticuz/chromium）
- Webスクレイピング（HTML解析、データ抽出）
- スクリーンショット撮影（全画面、要素単位）
- FSx for ONTAP + S3 Access Points統合（大容量ファイル保存）

**使用例**:

```typescript
// Browser設定
{
  "agentCore": {
    "browser": {
      "enabled": true,
      "storageConfig": {
        "bucketName": "my-screenshots-bucket",
        "fsxS3AccessPointArn": "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-ap"
      },
      "puppeteerConfig": {
        "headless": true,
        "defaultViewport": {
          "width": 1920,
          "height": 1080
        },
        "timeout": 30000
      }
    }
  }
}
```

**ユースケース**:
1. **Webスクレイピング**: ニュースサイト、ECサイト等からデータ収集
2. **スクリーンショット撮影**: Webページの視覚的な記録
3. **フォーム自動入力**: 定型的なフォーム入力の自動化

**ベストプラクティス**:
- タイムアウトは30秒以上に設定（ページ読み込みに時間がかかる場合）
- FSx for ONTAPを使用して大容量ファイルを効率的に保存
- スクリーンショットはJPEG形式で圧縮（ファイルサイズ削減）

**制限事項**:
- Lambda Ephemeral Storage: 最大10GB
- スクリーンショットサイズ: 最大10MB（推奨）
- 同時ブラウザ数: Lambda Concurrencyに依存


---

### 6. Code Interpreter - コード実行

**概要**: Code Interpreterは、Python/Node.jsコードを安全に実行する機能です。Bedrock Agent Runtime APIを使用して、サンドボックス環境でコードを実行します。

**主な機能**:
- Python/Node.jsコード実行
- パッケージ管理（pip/npm）
- ファイル操作（書き込み、読み込み、削除）
- ターミナルコマンド実行
- セッション管理（開始、停止）

**使用例**:

```typescript
// Code Interpreter設定
{
  "agentCore": {
    "codeInterpreter": {
      "enabled": true,
      "executionConfig": {
        "timeout": 60,
        "maxConcurrentSessions": 10,
        "allowedLanguages": ["python", "nodejs"]
      },
      "packageManagementConfig": {
        "allowedPackages": ["numpy", "pandas", "matplotlib"],
        "packageWhitelist": ["requests", "beautifulsoup4"]
      }
    }
  }
}
```

**ユースケース**:
1. **データ分析**: Pandas、NumPyを使用したデータ分析
2. **グラフ作成**: Matplotlibを使用したグラフ作成
3. **スクリプト実行**: 定型的なスクリプトの実行

**ベストプラクティス**:
- ホワイトリスト方式でパッケージを制限（セキュリティ）
- タイムアウトは60秒以上に設定（複雑な処理の場合）
- セッションは使用後に必ず停止（リソース節約）

**制限事項**:
- コード実行時間: 最大5分
- セッション数: 最大100個
- パッケージサイズ: 最大500MB


---

### 7. Observability - 監視・トレーシング

**概要**: Observabilityは、エージェントの動作を監視・トレーシングする機能です。X-Ray、CloudWatch、エラー追跡を統合します。

**主な機能**:
- X-Ray分散トレーシング（サービスマップ、トレース詳細）
- CloudWatchカスタムメトリクス（ダッシュボード、アラーム）
- エラー追跡（ログ集約、根本原因分析）
- パフォーマンス監視（レイテンシ、スループット）

**使用例**:

```typescript
// Observability設定
{
  "agentCore": {
    "observability": {
      "enabled": true,
      "xrayConfig": {
        "samplingRate": 0.1,
        "enableActiveTracing": true
      },
      "cloudWatchConfig": {
        "dashboardName": "AgentCore-Dashboard",
        "alarmEmail": "ops-team@example.com",
        "logRetentionDays": 30
      },
      "errorTrackingConfig": {
        "enableRootCauseAnalysis": true,
        "errorThreshold": 5
      }
    }
  }
}
```

**ユースケース**:
1. **パフォーマンス監視**: レイテンシ、スループットの監視
2. **エラー追跡**: エラーの根本原因を特定
3. **コスト最適化**: リソース使用状況を可視化

**ベストプラクティス**:
- X-Rayサンプリングレートは10%に設定（コスト削減）
- CloudWatchアラームで異常を早期検知
- ログ保持期間は30日に設定（コンプライアンス）

**制限事項**:
- X-Rayトレース数: 無制限（コストに注意）
- CloudWatchメトリクス数: 最大10,000個
- ログサイズ: 無制限（コストに注意）


---

### 8. Evaluations - 品質評価

**概要**: Evaluationsは、エージェントの品質を評価する機能です。13の組み込み評価器、A/Bテスト、パフォーマンス評価をサポートします。

**主な機能**:
- 13の組み込み評価器（正確性、関連性、有用性等）
- A/Bテスト（トラフィック分割、統計的有意性検定）
- パフォーマンス評価（レイテンシ、スループット、コスト）
- 自動最適化（A/Bテスト結果に基づく自動調整）

**使用例**:

```typescript
// Evaluations設定
{
  "agentCore": {
    "evaluations": {
      "enabled": true,
      "qualityMetricsConfig": {
        "enabledMetrics": ["accuracy", "relevance", "helpfulness"],
        "evaluationFrequency": "hourly"
      },
      "abTestConfig": {
        "enableAutoOptimization": true,
        "minSampleSize": 100,
        "confidenceLevel": 0.95
      },
      "performanceEvaluationConfig": {
        "latencyThreshold": 5000,
        "throughputThreshold": 100,
        "costThreshold": 10.0
      }
    }
  }
}
```

**ユースケース**:
1. **品質監視**: エージェントの回答品質を継続的に監視
2. **A/Bテスト**: 複数のモデルやプロンプトを比較
3. **パフォーマンス最適化**: レイテンシ、コストを最適化

**ベストプラクティス**:
- 評価頻度は1時間に1回に設定（コスト削減）
- A/Bテストは最低100サンプル収集してから判定
- パフォーマンス閾値は実際の使用状況に基づいて設定

**制限事項**:
- 評価器数: 13個（組み込み）
- A/Bテスト数: 最大10個
- 評価結果の保持期間: 90日


---

### 9. Policy - ポリシー管理

**概要**: Policyは、エージェントのアクセス制御ポリシーを管理する機能です。自然言語ポリシー、Cedar統合、形式的検証をサポートします。

**主な機能**:
- 自然言語ポリシー作成（英語、日本語）
- Cedar変換（形式的検証可能なポリシー言語）
- ポリシーテンプレート（よくあるパターン）
- 競合検出（ポリシー間の矛盾を自動検出）

**使用例**:

```typescript
// Policy設定
{
  "agentCore": {
    "policy": {
      "enabled": true,
      "naturalLanguagePolicyConfig": {
        "enableAutoConversion": true,
        "defaultPolicyTemplate": "allow-read-only"
      },
      "cedarIntegrationConfig": {
        "enableFormalVerification": true,
        "enableConflictDetection": true
      }
    }
  }
}
```

**ユースケース**:
1. **アクセス制御**: ユーザーごとに異なるアクセス権限を設定
2. **コンプライアンス**: 規制要件に準拠したポリシーを作成
3. **セキュリティ**: 機密データへのアクセスを制限

**ベストプラクティス**:
- 自然言語ポリシーで簡単にポリシーを作成
- Cedar変換で形式的検証を実施（ポリシーの正確性を保証）
- 競合検出で矛盾するポリシーを早期発見

**制限事項**:
- ポリシー数: 最大1,000個
- ポリシーサイズ: 最大100KB
- 自然言語ポリシーの長さ: 最大1,000文字

---

## 🎓 チュートリアル

### チュートリアル1: 基本機能の統合（Runtime + Gateway + Memory）

このチュートリアルでは、Runtime、Gateway、Memoryの3つの基本機能を統合して、簡単なAIエージェントを構築します。

**目標**: 外部APIを呼び出し、会話履歴を保存するエージェントを作成

**ステップ1: 設定ファイルの作成**

```json
{
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "timeout": 30,
        "memorySize": 2048
      }
    },
    "gateway": {
      "enabled": true,
      "restApiConversionConfig": {
        "openApiSpecPath": "s3://my-bucket/weather-api.yaml"
      }
    },
    "memory": {
      "enabled": true,
      "memoryStrategyConfig": {
        "enableSemantic": true,
        "enableSummary": true
      }
    }
  }
}
```


**ステップ2: デプロイ**

```bash
# CDKスタックをデプロイ
npx cdk deploy --all

# デプロイ完了後、CloudFormation Outputsを確認
aws cloudformation describe-stacks \
  --stack-name WebAppStack \
  --query 'Stacks[0].Outputs'
```

**ステップ3: エージェントのテスト**

```bash
# Runtime Lambda関数を呼び出し
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --payload '{"action": "invoke", "input": "天気を教えて"}' \
  response.json

# レスポンスを確認
cat response.json
```

**期待される結果**:
- Gatewayが天気APIを呼び出し
- Runtimeがエージェントを実行
- Memoryが会話履歴を保存
- エージェントが天気情報を返す

---

### チュートリアル2: 応用機能の統合（Identity + Browser + Code Interpreter）

このチュートリアルでは、Identity、Browser、Code Interpreterの3つの応用機能を統合して、高度なAIエージェントを構築します。

**目標**: ユーザー認証を行い、Webスクレイピングとデータ分析を実行するエージェントを作成

**ステップ1: 設定ファイルの作成**

```json
{
  "agentCore": {
    "identity": {
      "enabled": true,
      "rbacConfig": {
        "defaultRole": "User"
      }
    },
    "browser": {
      "enabled": true,
      "storageConfig": {
        "bucketName": "my-screenshots-bucket"
      }
    },
    "codeInterpreter": {
      "enabled": true,
      "executionConfig": {
        "allowedLanguages": ["python"]
      },
      "packageManagementConfig": {
        "allowedPackages": ["pandas", "matplotlib"]
      }
    }
  }
}
```

**ステップ2: エージェントIDの作成**

```bash
# Identity Lambda関数を呼び出してエージェントIDを作成
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreIdentity-Function \
  --payload '{"action": "create", "agentName": "DataAnalysisAgent"}' \
  response.json

# エージェントIDを確認
cat response.json
```


**ステップ3: Webスクレイピングの実行**

```bash
# Browser Lambda関数を呼び出してWebスクレイピング
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --payload '{
    "action": "navigate",
    "url": "https://example.com/data",
    "agentId": "agent-12345"
  }' \
  response.json
```

**ステップ4: データ分析の実行**

```bash
# Code Interpreter Lambda関数を呼び出してデータ分析
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreCodeInterpreter-Function \
  --payload '{
    "action": "executeCode",
    "code": "import pandas as pd\ndf = pd.read_csv(\"data.csv\")\nprint(df.describe())",
    "language": "python",
    "sessionId": "session-12345"
  }' \
  response.json
```

**期待される結果**:
- Identityがエージェントを認証
- BrowserがWebページからデータを取得
- Code InterpreterがPandasでデータを分析
- 分析結果が返される

---

### チュートリアル3: 統合機能の活用（複数機能の組み合わせ）

このチュートリアルでは、複数のAgentCore機能を組み合わせて、エンドツーエンドのワークフローを構築します。

**目標**: Webスクレイピング → データ分析 → 品質評価 → ポリシー適用の完全なワークフローを実装

**ステップ1: ワークフロー設定**

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

**ステップ2: ワークフローの実行**

```typescript
// ワークフロー実行スクリプト
async function executeWorkflow() {
  // 1. Identity: エージェント認証
  const agentId = await createAgent("WorkflowAgent");
  
  // 2. Browser: Webスクレイピング
  const data = await scrapeWebsite("https://example.com/data");
  
  // 3. Code Interpreter: データ分析
  const analysis = await analyzeData(data);
  
  // 4. Evaluations: 品質評価
  const quality = await evaluateQuality(analysis);
  
  // 5. Policy: ポリシー適用
  const allowed = await checkPolicy(agentId, "read:data");
  
  // 6. Memory: 結果保存
  await saveToMemory(agentId, analysis);
  
  // 7. Observability: メトリクス記録
  await recordMetrics("workflow", quality);
  
  return analysis;
}
```


**期待される結果**:
- 全ての機能が連携して動作
- Observabilityで全体の動作を監視
- Evaluationsで品質を評価
- Policyでアクセス制御を実施

---

## ❓ よくある質問（FAQ）

### 一般的な質問

**Q1: AgentCore機能は全て有効化する必要がありますか？**

A: いいえ、必要な機能のみを有効化できます。各機能は独立しており、`cdk.context.json`で個別に有効化/無効化できます。最小構成はRuntime機能のみです。

---

**Q2: AgentCore機能のコストはどのくらいですか？**

A: コストは使用する機能と使用量によって異なります：
- Runtime: Lambda実行時間とEventBridge呼び出し
- Gateway: Lambda実行時間とAPI Gateway呼び出し
- Memory: Memory Resource使用量（フルマネージド）
- Identity: DynamoDB読み書き容量
- Browser: Lambda実行時間とS3ストレージ
- Code Interpreter: Bedrock Agent Runtime API呼び出し
- Observability: X-RayトレースとCloudWatchメトリクス
- Evaluations: Lambda実行時間とS3/DynamoDB使用量
- Policy: Lambda実行時間とS3ストレージ

詳細は`docs/guides/agentcore-cost-estimation.md`を参照してください。

---

**Q3: AgentCore機能は既存のアプリケーションに統合できますか？**

A: はい、AgentCore機能はCDK Constructとして提供されているため、既存のCDKスタックに簡単に統合できます。`lib/stacks/integrated/`のスタックファイルを参考にしてください。

---

**Q4: AgentCore機能はマルチリージョン対応していますか？**

A: はい、全ての機能はマルチリージョン対応しています。`cdk.context.json`でリージョンを指定してデプロイできます。

---

**Q5: AgentCore機能のセキュリティはどのように保証されていますか？**

A: 以下のセキュリティ機能が組み込まれています：
- KMS暗号化（環境変数、データ）
- IAM最小権限の原則
- VPC統合（オプション）
- セキュリティグループ設定
- ポリシーベースのアクセス制御


### Runtime機能に関する質問

**Q6: Runtime機能のタイムアウトはどのように設定すればよいですか？**

A: 処理時間の1.5倍を目安に設定してください。例えば、平均10秒で完了する処理の場合、タイムアウトは15秒に設定します。最大15分まで設定可能です。

---

**Q7: Reserved ConcurrencyとProvisioned Concurrencyの違いは何ですか？**

A: 
- **Reserved Concurrency**: 同時実行数の上限を設定（コスト削減）
- **Provisioned Concurrency**: 事前にウォームアップされたインスタンスを確保（レイテンシ削減）

高トラフィックの場合はProvisioned Concurrencyを使用してください。

---

### Gateway機能に関する質問

**Q8: OpenAPI仕様はどのバージョンをサポートしていますか？**

A: OpenAPI 3.0以上をサポートしています。OpenAPI 2.0（Swagger）は非推奨です。

---

**Q9: MCPサーバーとの統合はどのように行いますか？**

A: MCPサーバーはHTTP/HTTPSエンドポイント経由で統合します。WebSocketの直接使用はLambda環境の制約により非対応です。

---

### Memory機能に関する質問

**Q10: Memory Strategiesはどのように選択すればよいですか？**

A: 用途に応じて選択してください：
- **Semantic**: 会話から重要な情報を自動抽出（推奨）
- **Summary**: 会話の要約を定期的に作成
- **User Preference**: ユーザー設定を保存

複数のStrategyを同時に有効化できます。

---

**Q11: 短期記憶と長期記憶の違いは何ですか？**

A:
- **短期記憶（Events）**: 会話履歴を最大30日間保存
- **長期記憶（Records）**: 重要な情報を無期限保存

Memory Strategiesが自動的に短期記憶から長期記憶を抽出します。

---

### Identity機能に関する質問

**Q12: RBACとABACの違いは何ですか？**

A:
- **RBAC**: ロール（Admin、User、ReadOnly）に基づくアクセス制御
- **ABAC**: 属性（部署、プロジェクト、機密度）に基づく動的アクセス制御

ABACはより柔軟な権限制御が可能です。

---

**Q13: カスタムロールはどのように作成しますか？**

A: `cdk.context.json`の`rbacConfig.customRoles`で定義します：

```json
{
  "rbacConfig": {
    "customRoles": [
      {
        "name": "DataScientist",
        "permissions": ["read:data", "write:models", "execute:code"]
      }
    ]
  }
}
```


### Browser機能に関する質問

**Q14: Puppeteerのバージョンはどれを使用していますか？**

A: Puppeteer 22.x以上と@sparticuz/chromium 123.x以上を使用しています。最新の安定版を推奨します。

---

**Q15: スクリーンショットのサイズを最適化するにはどうすればよいですか？**

A: 以下の方法でサイズを削減できます：
- JPEG形式を使用（PNG比で50-70%削減）
- 品質を80-90%に設定
- 必要な部分のみをスクリーンショット

---

### Code Interpreter機能に関する質問

**Q16: パッケージのホワイトリストはどのように管理しますか？**

A: `cdk.context.json`の`packageManagementConfig.allowedPackages`で管理します。セキュリティのため、必要最小限のパッケージのみを許可してください。

---

**Q17: コード実行のタイムアウトはどのように設定すればよいですか？**

A: 処理の複雑さに応じて設定してください：
- 簡単な計算: 30秒
- データ分析: 60秒
- 機械学習: 300秒（最大5分）

---

### Observability機能に関する質問

**Q18: X-Rayサンプリングレートはどのように設定すればよいですか？**

A: トラフィック量とコストのバランスで決定します：
- 開発環境: 100%（全トレース）
- ステージング環境: 50%
- 本番環境: 10%（コスト削減）

---

**Q19: CloudWatchアラームの閾値はどのように設定すればよいですか？**

A: 実際の使用状況に基づいて設定してください。推奨値は`docs/guides/agentcore-monitoring-alert-guide.md`を参照してください。

---

### Evaluations機能に関する質問

**Q20: A/Bテストの最小サンプルサイズはどのくらいですか？**

A: 統計的有意性を確保するため、最低100サンプルを推奨します。信頼度95%の場合、各バリアントで50サンプル以上が必要です。

---

**Q21: 品質メトリクスの評価頻度はどのように設定すればよいですか？**

A: コストとリアルタイム性のバランスで決定します：
- リアルタイム: 全リクエストを評価（高コスト）
- 1時間ごと: サンプリング評価（推奨）
- 1日ごと: バッチ評価（低コスト）

---

### Policy機能に関する質問

**Q22: 自然言語ポリシーはどの言語をサポートしていますか？**

A: 英語と日本語をサポートしています。他の言語は英語に翻訳してから使用してください。

---

**Q23: Cedarポリシーの形式的検証とは何ですか？**

A: Cedarポリシーの論理的な正確性を数学的に証明する機能です。ポリシーの矛盾や抜け漏れを自動検出できます。

---

### トラブルシューティングFAQ

**Q24: Lambda関数がタイムアウトする場合はどうすればよいですか？**

A: 以下を確認してください：
1. タイムアウト設定を増やす
2. メモリサイズを増やす（CPU性能も向上）
3. 処理を並列化する
4. CloudWatch Logsでボトルネックを特定

詳細は`docs/guides/debugging-troubleshooting-guide.md`を参照してください。

---

**Q25: DynamoDBのスロットリングが発生する場合はどうすればよいですか？**

A: 以下の対策を実施してください：
1. Auto Scalingを有効化
2. Read/Write Capacityを増やす
3. バッチ処理を使用
4. リトライロジックを実装


### パフォーマンスFAQ

**Q26: Lambda関数のコールドスタートを削減するにはどうすればよいですか？**

A: 以下の方法でコールドスタートを削減できます：
1. Provisioned Concurrencyを使用
2. Lambda関数のサイズを最小化
3. VPC統合を避ける（必要な場合のみ使用）
4. 定期的なウォームアップ呼び出し

---

**Q27: エージェントのレスポンス時間を改善するにはどうすればよいですか？**

A: 以下の最適化を実施してください：
1. Memory機能で会話履歴をキャッシュ
2. Gateway機能でAPI呼び出しを並列化
3. Observability機能でボトルネックを特定
4. Code Interpreter機能で事前計算を実施

---

### セキュリティFAQ

**Q28: KMS暗号化キーはどのように管理すればよいですか？**

A: 以下のベストプラクティスに従ってください：
1. 環境ごとに異なるKMSキーを使用
2. キーローテーションを有効化（年1回）
3. キーポリシーで最小権限を設定
4. CloudTrailでキー使用を監査

---

**Q29: IAM権限はどのように設定すればよいですか？**

A: 最小権限の原則に従ってください：
1. 必要な権限のみを付与
2. リソースベースのポリシーを使用
3. 条件付きアクセスを設定
4. 定期的に権限を見直し

---

**Q30: VPC統合はどのような場合に必要ですか？**

A: 以下の場合にVPC統合が必要です：
1. プライベートサブネット内のリソースにアクセス
2. オンプレミスネットワークとの接続
3. セキュリティグループによるアクセス制御
4. ネットワークレベルの監査

---

## 📚 関連ドキュメント

### 技術ドキュメント

- **実装ガイド**: `docs/guides/bedrock-agentcore-implementation-guide.md`
  - AgentCore機能の詳細な実装方法
  - CDK Constructsの使用方法
  - 設定パラメータの詳細

- **デプロイガイド**: `docs/guides/agentcore-deployment-guide.md`
  - デプロイ手順
  - 環境別設定
  - トラブルシューティング

- **API仕様書**: `docs/api/`
  - 各機能のAPI仕様
  - リクエスト/レスポンス形式
  - エラーコード一覧

### 運用ドキュメント

- **運用手順書**: `docs/guides/agentcore-operations-manual.md`
  - 日次・週次・月次運用手順
  - バックアップ・リストア手順
  - スケーリング手順

- **監視・アラート設定ガイド**: `docs/guides/agentcore-monitoring-alert-guide.md`
  - CloudWatch Dashboard設定
  - CloudWatch Alarms設定
  - X-Ray設定

- **トラブルシューティングガイド**: `docs/guides/debugging-troubleshooting-guide.md`
  - よくある問題と解決策
  - エラーログの読み方
  - エスカレーション手順

### 計画ドキュメント

- **本番環境デプロイ計画**: `docs/guides/agentcore-production-deployment-plan.md`
  - デプロイスケジュール
  - リスク評価
  - ロールバック計画

- **ステージング環境テスト計画**: `docs/guides/agentcore-staging-test-plan.md`
  - テストシナリオ
  - 合格基準
  - テスト実施手順

- **コスト見積もり**: `docs/guides/agentcore-cost-estimation.md`
  - 機能別コスト見積もり
  - 使用量別コスト試算
  - コスト最適化の推奨事項


---

## 🎯 ベストプラクティス

### 設計のベストプラクティス

1. **段階的な機能有効化**
   - 最初はRuntime、Gateway、Memoryの基本機能のみを有効化
   - 動作確認後に追加機能を段階的に有効化
   - 各機能の影響を個別に評価

2. **適切な機能選択**
   - 要件に応じて必要な機能のみを有効化
   - 不要な機能は無効化してコスト削減
   - 機能間の依存関係を理解

3. **スケーラビリティの考慮**
   - Reserved Concurrencyで同時実行数を制限
   - DynamoDB Auto Scalingを有効化
   - CloudFront CDNでキャッシュを活用

### 開発のベストプラクティス

1. **型安全性の確保**
   - TypeScriptの厳格モードを使用
   - 全ての設定に型定義を適用
   - バリデーション関数でランタイムチェック

2. **テストの実施**
   - 単体テスト: 各機能の動作確認
   - 統合テスト: 機能間の連携確認
   - E2Eテスト: エンドツーエンドの動作確認

3. **ドキュメントの整備**
   - 設定ファイルにコメントを追加
   - カスタム実装はREADMEに記載
   - 変更履歴をCHANGELOG.mdに記録

### 運用のベストプラクティス

1. **監視の実施**
   - CloudWatch Dashboardで全体を監視
   - CloudWatch Alarmsで異常を検知
   - X-Rayでパフォーマンスを分析

2. **定期的なメンテナンス**
   - 週次: ログの確認、メトリクスの分析
   - 月次: コストの見直し、パフォーマンスの最適化
   - 四半期: セキュリティ監査、バックアップテスト

3. **インシデント対応**
   - トラブルシューティングガイドを参照
   - エスカレーション手順に従う
   - インシデント後のポストモーテムを実施

### セキュリティのベストプラクティス

1. **最小権限の原則**
   - IAM権限は必要最小限に設定
   - リソースベースのポリシーを使用
   - 定期的に権限を見直し

2. **暗号化の実施**
   - KMS暗号化を全てのデータに適用
   - 転送中の暗号化（TLS/SSL）
   - 保存時の暗号化（S3、DynamoDB）

3. **監査ログの記録**
   - CloudTrailで全てのAPI呼び出しを記録
   - CloudWatch Logsで操作ログを保存
   - 定期的にログを分析

---

## 🚨 制限事項と注意点

### 一般的な制限事項

1. **AWSサービスの制限**
   - Lambda: 最大実行時間15分、最大メモリ10GB
   - DynamoDB: 最大アイテムサイズ400KB
   - S3: 最大オブジェクトサイズ5TB

2. **AgentCore機能の制限**
   - Runtime: Reserved Concurrency 1-1000
   - Memory: 短期記憶保持期間30日
   - Code Interpreter: コード実行時間最大5分

3. **リージョン制限**
   - 一部の機能は特定リージョンでのみ利用可能
   - Bedrock Agent Runtime APIの利用可能リージョンを確認
   - マルチリージョンデプロイ時は各リージョンの制限を確認

### パフォーマンスに関する注意点

1. **コールドスタート**
   - Lambda関数の初回実行は遅い（1-3秒）
   - Provisioned Concurrencyで軽減可能
   - VPC統合時はさらに遅延が発生

2. **スロットリング**
   - Lambda: 同時実行数の制限
   - DynamoDB: Read/Write Capacityの制限
   - API Gateway: リクエストレートの制限

3. **タイムアウト**
   - Lambda関数のタイムアウト設定に注意
   - API Gatewayのタイムアウト（29秒）
   - Bedrock Agent Runtime APIのタイムアウト

### コストに関する注意点

1. **従量課金**
   - Lambda: 実行時間とメモリ使用量
   - DynamoDB: Read/Write Capacity Units
   - S3: ストレージとリクエスト数

2. **予期しないコスト**
   - X-Rayトレースの大量発生
   - CloudWatch Logsの大量保存
   - S3ストレージの増加

3. **コスト最適化**
   - 不要な機能は無効化
   - ログ保持期間を適切に設定
   - Reserved InstancesやSavings Plansを検討


---

## 📞 サポート

### コミュニティサポート

- **GitHub Issues**: バグ報告、機能リクエスト
- **GitHub Discussions**: 質問、ディスカッション
- **Stack Overflow**: タグ `amazon-bedrock-agentcore`

### 商用サポート

- **AWS Support**: AWS Supportプランに応じたサポート
- **AWS Professional Services**: 実装支援、コンサルティング
- **AWS Partner Network**: 認定パートナーによるサポート

### ドキュメントの改善

ドキュメントの改善提案は、GitHubのPull Requestで受け付けています。

---

## 📝 まとめ

このユーザーガイドでは、Amazon Bedrock AgentCoreの9つの機能について、エンドユーザーの視点から説明しました。

### 主要なポイント

1. **段階的な導入**: 基本機能から始めて、段階的に機能を追加
2. **適切な設定**: 要件に応じて各機能を適切に設定
3. **継続的な監視**: Observability機能で動作を監視
4. **品質の維持**: Evaluations機能で品質を評価
5. **セキュリティの確保**: Identity、Policy機能でアクセス制御

### 次のステップ

1. **クイックスタート**: 基本機能を有効化してデプロイ
2. **チュートリアル**: 3つのチュートリアルを実施
3. **本番環境デプロイ**: デプロイ計画に従って本番環境にデプロイ
4. **運用開始**: 運用手順書に従って運用を開始

### フィードバック

このガイドに関するフィードバックは、以下の方法で受け付けています：
- GitHub Issues: バグ報告、改善提案
- GitHub Discussions: 質問、ディスカッション
- Email: feedback@example.com

---

**最終更新**: 2026-01-05  
**バージョン**: 1.0  
**ライセンス**: MIT License

