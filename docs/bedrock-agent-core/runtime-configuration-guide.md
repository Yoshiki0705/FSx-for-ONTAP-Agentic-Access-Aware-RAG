# Amazon Bedrock AgentCore Runtime - 設定ガイド

**作成日**: 2026-01-03  
**最終更新**: 2026-01-03  
**バージョン**: 1.0.0  
**対象**: Phase 1 - Runtime Construct

---

## 📋 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [基本設定](#基本設定)
4. [詳細設定](#詳細設定)
5. [有効化/無効化](#有効化無効化)
6. [環境別設定例](#環境別設定例)
7. [トラブルシューティング](#トラブルシューティング)
8. [FAQ](#faq)

---

## 概要

Amazon Bedrock AgentCore Runtimeは、Bedrock Agentのイベント駆動実行を提供するコアコンポーネントです。Lambda関数とEventBridgeを使用して、非同期処理、自動スケーリング、KMS暗号化をサポートします。

### 主な機能

- **イベント駆動実行**: EventBridgeによる非同期処理
- **自動スケーリング**: Reserved/Provisioned Concurrency対応
- **KMS暗号化**: 環境変数の暗号化
- **VPC統合**: プライベートサブネット内での実行
- **Dead Letter Queue**: エラーハンドリング

---

## 前提条件

### 必須リソース

- **AWS CDK v2**: 2.100.0以上
- **Node.js**: 20.x以上
- **TypeScript**: 5.3以上
- **AWS Account**: Bedrock利用可能なリージョン

### 必須権限

- `bedrock:InvokeAgent`
- `bedrock:InvokeAgentWithResponseStream`
- `lambda:CreateFunction`
- `lambda:UpdateFunctionCode`
- `events:PutRule`
- `events:PutTargets`
- `kms:CreateKey`
- `kms:Encrypt`
- `kms:Decrypt`

---

## 基本設定

### Step 1: cdk.context.jsonの設定

`cdk.context.json`に以下の設定を追加します：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod",
      "bedrockAgentId": "YOUR_AGENT_ID",
      "bedrockAgentAliasId": "YOUR_ALIAS_ID",
      "bedrockRegion": "ap-northeast-1"
    }
  }
}
```

### Step 2: EmbeddingStackへの統合

`lib/stacks/integrated/embedding-stack.ts`で、Runtime Constructを有効化します：

```typescript
import { BedrockAgentCoreRuntimeConstruct } from '../../modules/ai/constructs/bedrock-agent-core-runtime-construct';

export class EmbeddingStack extends Stack {
  constructor(scope: Construct, id: string, props: EmbeddingStackProps) {
    super(scope, id, props);

    // Runtime Construct作成
    const runtimeConfig = this.node.tryGetContext('bedrockAgentCore')?.runtime;
    
    if (runtimeConfig?.enabled) {
      new BedrockAgentCoreRuntimeConstruct(this, 'Runtime', {
        enabled: true,
        projectName: runtimeConfig.projectName,
        environment: runtimeConfig.environment,
        bedrockAgentId: runtimeConfig.bedrockAgentId,
        bedrockAgentAliasId: runtimeConfig.bedrockAgentAliasId,
        bedrockRegion: runtimeConfig.bedrockRegion,
      });
    }
  }
}
```

### Step 3: デプロイ

```bash
# TypeScriptビルド
npm run build

# CDK Synth（テンプレート生成）
npx cdk synth

# デプロイ
npx cdk deploy EmbeddingStack
```

---

## 詳細設定

### Lambda関数設定

#### タイムアウト設定

デフォルト: 30秒

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "lambda": {
        "timeout": 60
      }
    }
  }
}
```

#### メモリ設定

デフォルト: 2048MB

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "lambda": {
        "memorySize": 4096
      }
    }
  }
}
```

#### 環境変数

カスタム環境変数を追加できます：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "lambda": {
        "environment": {
          "LOG_LEVEL": "DEBUG",
          "ENABLE_TRACING": "true"
        }
      }
    }
  }
}
```

### EventBridge設定

#### イベントパターン

デフォルトのイベントパターンをカスタマイズできます：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "eventBridge": {
        "eventPattern": {
          "source": ["custom.bedrock.agent"],
          "detail-type": ["Agent Execution Request"]
        }
      }
    }
  }
}
```

#### スケジュール実行

定期実行を設定できます：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "eventBridge": {
        "schedule": "rate(5 minutes)"
      }
    }
  }
}
```

### 自動スケーリング設定

#### Reserved Concurrency

同時実行数を制限します：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "scaling": {
        "reservedConcurrency": 10
      }
    }
  }
}
```

#### Provisioned Concurrency

事前にウォームアップされたインスタンスを確保します：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "scaling": {
        "provisionedConcurrency": 5
      }
    }
  }
}
```

### KMS暗号化設定

#### カスタムKMS Key

既存のKMS Keyを使用できます：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "kms": {
        "keyArn": "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
      }
    }
  }
}
```

#### 自動作成

設定を省略すると、自動的にKMS Keyが作成されます。

### VPC統合設定

#### VPC設定

プライベートサブネット内でLambda関数を実行します：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "vpc": {
        "vpcId": "vpc-12345678",
        "subnetIds": [
          "subnet-12345678",
          "subnet-87654321"
        ],
        "securityGroupIds": [
          "sg-12345678"
        ]
      }
    }
  }
}
```

### Dead Letter Queue設定

#### DLQ設定

エラー時のメッセージを保存します：

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "dlq": {
        "retentionDays": 14,
        "maxReceiveCount": 3
      }
    }
  }
}
```

---

## 有効化/無効化

### Runtime機能の有効化

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true
    }
  }
}
```

### Runtime機能の無効化

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": false
    }
  }
}
```

**注意**: 無効化すると、Runtime Constructは作成されません。既存のリソースは削除されます。

---

## 環境別設定例

### 開発環境（Development）

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "dev",
      "bedrockAgentId": "DEV_AGENT_ID",
      "bedrockAgentAliasId": "DEV_ALIAS_ID",
      "bedrockRegion": "ap-northeast-1",
      "lambda": {
        "timeout": 30,
        "memorySize": 2048,
        "environment": {
          "LOG_LEVEL": "DEBUG"
        }
      },
      "scaling": {
        "reservedConcurrency": 5
      }
    }
  }
}
```

### ステージング環境（Staging）

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "staging",
      "bedrockAgentId": "STAGING_AGENT_ID",
      "bedrockAgentAliasId": "STAGING_ALIAS_ID",
      "bedrockRegion": "ap-northeast-1",
      "lambda": {
        "timeout": 30,
        "memorySize": 2048,
        "environment": {
          "LOG_LEVEL": "INFO"
        }
      },
      "scaling": {
        "reservedConcurrency": 10,
        "provisionedConcurrency": 3
      }
    }
  }
}
```

### 本番環境（Production）

```json
{
  "bedrockAgentCore": {
    "runtime": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod",
      "bedrockAgentId": "PROD_AGENT_ID",
      "bedrockAgentAliasId": "PROD_ALIAS_ID",
      "bedrockRegion": "ap-northeast-1",
      "lambda": {
        "timeout": 60,
        "memorySize": 4096,
        "environment": {
          "LOG_LEVEL": "WARN",
          "ENABLE_TRACING": "true"
        }
      },
      "scaling": {
        "reservedConcurrency": 20,
        "provisionedConcurrency": 10
      },
      "vpc": {
        "vpcId": "vpc-prod-12345678",
        "subnetIds": [
          "subnet-prod-12345678",
          "subnet-prod-87654321"
        ],
        "securityGroupIds": [
          "sg-prod-12345678"
        ]
      },
      "dlq": {
        "retentionDays": 14,
        "maxReceiveCount": 3
      }
    }
  }
}
```

---

## トラブルシューティング

### 問題1: Lambda関数が起動しない

**症状**:
- Lambda関数が作成されない
- CDK deployが失敗する

**原因**:
- Bedrock Agent IDが無効
- IAM権限が不足

**解決策**:

1. Bedrock Agent IDを確認：
```bash
aws bedrock-agent get-agent \
  --agent-id YOUR_AGENT_ID \
  --region ap-northeast-1
```

2. IAM権限を確認：
```bash
aws iam get-role \
  --role-name TokyoRegion-permission-aware-rag-prod-Runtime-Execution-Role
```

3. CDK Synthでエラーを確認：
```bash
npx cdk synth --verbose
```

### 問題2: EventBridgeが動作しない

**症状**:
- イベントが発火しない
- Lambda関数が呼び出されない

**原因**:
- イベントパターンが不正
- Lambda関数のターゲット設定が不正

**解決策**:

1. EventBridge Ruleを確認：
```bash
aws events describe-rule \
  --name TokyoRegion-permission-aware-rag-prod-Runtime-Rule \
  --region ap-northeast-1
```

2. ターゲットを確認：
```bash
aws events list-targets-by-rule \
  --rule TokyoRegion-permission-aware-rag-prod-Runtime-Rule \
  --region ap-northeast-1
```

3. テストイベントを送信：
```bash
aws events put-events \
  --entries '[{"Source":"custom.bedrock.agent","DetailType":"Agent Execution Request","Detail":"{}"}]' \
  --region ap-northeast-1
```

### 問題3: KMS暗号化エラー

**症状**:
- Lambda関数が環境変数を読み込めない
- KMS復号化エラーが発生

**原因**:
- KMS Key権限が不足
- Lambda実行ロールにKMS権限がない

**解決策**:

1. KMS Key権限を確認：
```bash
aws kms describe-key \
  --key-id alias/TokyoRegion-permission-aware-rag-prod-Runtime-Key \
  --region ap-northeast-1
```

2. Lambda実行ロールにKMS権限を追加：
```bash
aws iam attach-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-Runtime-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser
```

### 問題4: VPC統合エラー

**症状**:
- Lambda関数がVPC内で起動しない
- タイムアウトエラーが発生

**原因**:
- サブネットが不正
- セキュリティグループが不正
- NAT Gatewayが設定されていない

**解決策**:

1. サブネットを確認：
```bash
aws ec2 describe-subnets \
  --subnet-ids subnet-12345678 \
  --region ap-northeast-1
```

2. セキュリティグループを確認：
```bash
aws ec2 describe-security-groups \
  --group-ids sg-12345678 \
  --region ap-northeast-1
```

3. NAT Gatewayを確認：
```bash
aws ec2 describe-nat-gateways \
  --region ap-northeast-1
```

### 問題5: Dead Letter Queueにメッセージが溜まる

**症状**:
- DLQにメッセージが大量に溜まる
- Lambda関数が繰り返しエラーを出す

**原因**:
- Bedrock Agent実行エラー
- Lambda関数のバグ
- タイムアウト設定が短すぎる

**解決策**:

1. DLQメッセージを確認：
```bash
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/TokyoRegion-permission-aware-rag-prod-Runtime-DLQ \
  --max-number-of-messages 10 \
  --region ap-northeast-1
```

2. Lambda Logsを確認：
```bash
aws logs tail /aws/lambda/TokyoRegion-permission-aware-rag-prod-Runtime-Function \
  --since 1h \
  --region ap-northeast-1
```

3. タイムアウトを延長：
```json
{
  "bedrockAgentCore": {
    "runtime": {
      "lambda": {
        "timeout": 60
      }
    }
  }
}
```

---

## FAQ

### Q1: Runtime機能は必須ですか？

**A1**: いいえ、オプションです。`enabled: false`に設定することで無効化できます。

### Q2: 複数のBedrock Agentを実行できますか？

**A2**: はい、複数のRuntime Constructを作成することで、複数のBedrock Agentを実行できます。

### Q3: Lambda関数のコードをカスタマイズできますか？

**A3**: はい、`lambda/agent-core-runtime/index.ts`を編集することでカスタマイズできます。

### Q4: EventBridgeのイベントパターンをカスタマイズできますか？

**A4**: はい、`cdk.context.json`の`eventBridge.eventPattern`を編集することでカスタマイズできます。

### Q5: VPC統合は必須ですか？

**A5**: いいえ、オプションです。VPC統合を設定しない場合、Lambda関数はパブリックサブネットで実行されます。

### Q6: KMS暗号化は必須ですか？

**A6**: いいえ、オプションです。ただし、セキュリティ要件に応じて有効化することを推奨します。

### Q7: Provisioned Concurrencyは必須ですか？

**A7**: いいえ、オプションです。コールドスタートを避けたい場合に有効化してください。

### Q8: Dead Letter Queueは必須ですか？

**A8**: いいえ、オプションです。ただし、エラーハンドリングのために有効化することを推奨します。

### Q9: Runtime機能のコストはどのくらいですか？

**A9**: Lambda関数の実行時間、EventBridge Ruleの実行回数、KMS Key使用料、DLQのメッセージ数に応じて課金されます。詳細はAWS料金表を参照してください。

### Q10: Runtime機能のパフォーマンスはどのくらいですか？

**A10**: Lambda起動時間は3秒以内、API応答時間は1秒以内を目標としています。Provisioned Concurrencyを有効化することで、コールドスタートを避けることができます。

---

## 参考リンク

### AWS公式ドキュメント

- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon EventBridge](https://docs.aws.amazon.com/eventbridge/)
- [AWS KMS](https://docs.aws.amazon.com/kms/)
- [Amazon SQS](https://docs.aws.amazon.com/sqs/)

### プロジェクトドキュメント

- [requirements.md](../../.kiro/specs/bedrock-agent-core-features/requirements.md) - 完全な要件定義
- [runtime-api-specification.md](./runtime-api-specification.md) - API仕様書
- [tasks.md](../../.kiro/specs/bedrock-agent-core-features/tasks.md) - タスクリスト

---

**作成者**: Kiro AI  
**作成日**: 2026-01-03  
**ステータス**: ✅ 完成  
**バージョン**: 1.0.0
