# 使用例とベストプラクティス

## 📋 概要

このドキュメントは、Embedding Batch Workload Template の実践的な使用例とベストプラクティスを提供します。実際のユースケースに基づいた設定例と推奨事項を含みます。

## 🎯 対象読者

- 初めてテンプレートを使用する開発者
- 最適な設定を探している運用者
- ベストプラクティスを学びたい全てのユーザー

## 📚 目次

1. [基本的な使用例](#基本的な使用例)
2. [環境別設定例](#環境別設定例)
3. [ユースケース別設定](#ユースケース別設定)
4. [パフォーマンス最適化](#パフォーマンス最適化)
5. [コスト最適化](#コスト最適化)
6. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
7. [運用ベストプラクティス](#運用ベストプラクティス)

---

## 基本的な使用例

### 1. 最小構成でのデプロイ

既存の VPC と FSx を使用した最小構成の例です。

```json
{
  "projectName": "embedding-minimal",
  "environment": "dev",
  "region": "ap-northeast-1",
  
  "aws": {
    "profile": "default"
  },
  
  "bedrock": {
    "region": "us-east-1",
    "modelId": "amazon.nova-pro-v1:0",
    "embeddingModel": {
      "modelId": "amazon.titan-embed-text-v2:0",
      "dimensions": 256,
      "maxTokens": 8192
    },
    "textModel": {
      "modelId": "amazon.nova-pro-v1:0",
      "temperature": 0.7,
      "maxTokens": 4096
    }
  },
  
  "vpc": {
    "mode": "existing",
    "existing": {
      "vpcId": "vpc-0123456789abcdef0",
      "privateSubnetIds": ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
    }
  },
  
  "fsx": {
    "mode": "existing",
    "existing": {
      "fileSystemId": "fs-0123456789abcdef0",
      "volumePath": "/vol1",
      "mountPoint": "/mnt/fsx"
    }
  },
  
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 64,
      "minvCpus": 0,
      "desiredvCpus": 0,
      "instanceTypes": ["m5.large"],
      "useSpotInstances": true,
      "spotBidPercentage": 70
    },
    "jobQueue": {
      "priority": 1
    },
    "jobDefinitions": {
      "documentProcessing": {
        "vcpus": 2,
        "memoryMiB": 4096,
        "timeoutSeconds": 3600,
        "retryAttempts": 3
      },
      "embeddingGeneration": {
        "vcpus": 2,
        "memoryMiB": 4096,
        "timeoutSeconds": 3600,
        "retryAttempts": 2
      },
      "ragQueryProcessing": {
        "vcpus": 2,
        "memoryMiB": 4096,
        "timeoutSeconds": 1800,
        "retryAttempts": 3
      }
    }
  }
}
```

**デプロイ方法**:
```bash
./scripts/deploy.sh --config config/minimal.json --env dev
```

**ベストプラクティス**:
- ✅ 既存リソースを活用してコスト削減
- ✅ スポットインスタンスで最大 70% のコスト削減
- ✅ 最小限の vCPU 設定で無駄を削減

---

### 2. 新規環境の完全構築

VPC と FSx を新規作成する完全な構築例です。

```json
{
  "projectName": "embedding-new",
  "environment": "dev",
  "region": "ap-northeast-1",
  
  "vpc": {
    "mode": "create",
    "create": {
      "cidrBlock": "10.0.0.0/16",
      "availabilityZones": ["ap-northeast-1a", "ap-northeast-1c"],
      "enableNatGateway": true
    }
  },
  
  "fsx": {
    "mode": "create",
    "create": {
      "storageCapacity": 1024,
      "throughputCapacity": 128,
      "deploymentType": "SINGLE_AZ_1"
    }
  }
}
```

**デプロイ方法**:
```bash
./scripts/deploy.sh --config config/new-environment.json --env dev --validate
```

**ベストプラクティス**:
- ✅ 開発環境では SINGLE_AZ_1 でコスト削減
- ✅ NAT Gateway は必要な場合のみ有効化
- ✅ デプロイ前に必ず `--validate` で検証

---

## 環境別設定例

### 開発環境（Development）

**目的**: 開発・テスト用の低コスト環境

```json
{
  "projectName": "embedding-dev",
  "environment": "dev",
  
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 64,
      "useSpotInstances": true,
      "spotBidPercentage": 70
    }
  },
  
  "storage": {
    "s3": {
      "enableVersioning": false,
      "lifecycleRules": {
        "transitionToIA": 30,
        "transitionToGlacier": 90,
        "deleteAfter": 180
      }
    },
    "dynamodb": {
      "billingMode": "PAY_PER_REQUEST",
      "enablePointInTimeRecovery": false
    }
  },
  
  "monitoring": {
    "cloudWatch": {
      "logRetentionDays": 7,
      "enableDetailedMonitoring": false
    },
    "alerting": {
      "enableAlerts": false
    }
  },
  
  "security": {
    "encryption": {
      "enableKMSEncryption": false
    },
    "compliance": {
      "enableGuardDuty": false,
      "enableCloudTrail": false
    }
  }
}
```

**特徴**:
- 💰 コスト最適化重視
- ⚡ 迅速なデプロイ
- 🔓 セキュリティ要件は最小限

---

### 本番環境（Production）

**目的**: 高可用性・高セキュリティの本番環境

```json
{
  "projectName": "embedding-prod",
  "environment": "prod",
  
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 256,
      "useSpotInstances": true,
      "spotBidPercentage": 70,
      "instanceTypes": ["m5.xlarge", "m5.2xlarge", "m5.4xlarge"]
    }
  },
  
  "storage": {
    "s3": {
      "enableVersioning": true,
      "lifecycleRules": {
        "transitionToIA": 30,
        "transitionToGlacier": 90,
        "deleteAfter": 365
      }
    },
    "dynamodb": {
      "billingMode": "PAY_PER_REQUEST",
      "enablePointInTimeRecovery": true
    }
  },
  
  "monitoring": {
    "cloudWatch": {
      "logRetentionDays": 90,
      "enableDetailedMonitoring": true
    },
    "alerting": {
      "enableAlerts": true,
      "emailEndpoints": ["ops-team@company.com"],
      "slackWebhookUrl": "https://hooks.slack.com/services/..."
    },
    "xray": {
      "enableTracing": true,
      "samplingRate": 0.1
    }
  },
  
  "security": {
    "network": {
      "allowedCIDRs": ["10.0.0.0/8", "172.16.0.0/12"],
      "enableWAF": true
    },
    "encryption": {
      "enableKMSEncryption": true,
      "kmsKeyId": "arn:aws:kms:ap-northeast-1:123456789012:key/..."
    },
    "compliance": {
      "enableGuardDuty": true,
      "enableCloudTrail": true,
      "enableConfig": true
    }
  },
  
  "costOptimization": {
    "budgets": {
      "monthlyBudgetUSD": 5000,
      "alertThreshold": 80
    }
  }
}
```

**特徴**:
- 🛡️ 最高レベルのセキュリティ
- 📊 包括的な監視・アラート
- 💾 データ保護とバックアップ
- 📈 高いスケーラビリティ

---

## ユースケース別設定

### ユースケース 1: 大量文書の一括処理

**シナリオ**: 数万件の文書を一度に処理

```json
{
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 512,
      "instanceTypes": ["m5.2xlarge", "m5.4xlarge", "m5.8xlarge"],
      "useSpotInstances": true,
      "spotBidPercentage": 80
    },
    "jobDefinitions": {
      "documentProcessing": {
        "vcpus": 8,
        "memoryMiB": 16384,
        "timeoutSeconds": 14400,
        "retryAttempts": 3
      }
    }
  },
  
  "costOptimization": {
    "autoScaling": {
      "scaleDownDelay": 600,
      "scaleUpThreshold": 70
    }
  }
}
```

**ベストプラクティス**:
- ✅ 大きなインスタンスタイプで並列処理
- ✅ スポット入札率を高めに設定
- ✅ スケールダウン遅延を長めに設定

---

### ユースケース 2: リアルタイム処理

**シナリオ**: 低レイテンシが求められる処理

```json
{
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 128,
      "minvCpus": 16,
      "desiredvCpus": 32,
      "instanceTypes": ["m5.xlarge"],
      "useSpotInstances": false
    },
    "jobDefinitions": {
      "embeddingGeneration": {
        "vcpus": 4,
        "memoryMiB": 8192,
        "timeoutSeconds": 1800,
        "retryAttempts": 1
      }
    }
  },
  
  "monitoring": {
    "cloudWatch": {
      "enableDetailedMonitoring": true
    },
    "xray": {
      "enableTracing": true,
      "samplingRate": 1.0
    }
  }
}
```

**ベストプラクティス**:
- ✅ 最小 vCPU を設定してコールドスタート回避
- ✅ オンデマンドインスタンスで安定性確保
- ✅ 詳細監視で性能問題を早期発見

---

### ユースケース 3: コスト重視の処理

**シナリオ**: 処理時間よりもコスト削減を優先

```json
{
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 256,
      "minvCpus": 0,
      "desiredvCpus": 0,
      "instanceTypes": ["t3.large", "t3.xlarge"],
      "useSpotInstances": true,
      "spotBidPercentage": 50
    }
  },
  
  "storage": {
    "s3": {
      "lifecycleRules": {
        "transitionToIA": 7,
        "transitionToGlacier": 30,
        "deleteAfter": 90
      }
    }
  },
  
  "costOptimization": {
    "budgets": {
      "monthlyBudgetUSD": 500,
      "alertThreshold": 70
    }
  }
}
```

**ベストプラクティス**:
- ✅ T3 インスタンスでバースト性能活用
- ✅ 積極的なライフサイクル管理
- ✅ 厳格な予算管理

---

## パフォーマンス最適化

### 1. インスタンスタイプの選択

**推奨事項**:

| ワークロード | インスタンスタイプ | vCPU | メモリ | 用途 |
|---|---|---|---|---|
| 軽量処理 | t3.large | 2 | 8 GB | 小規模文書処理 |
| 標準処理 | m5.xlarge | 4 | 16 GB | 一般的な文書処理 |
| 重量処理 | m5.4xlarge | 16 | 64 GB | 大規模文書・画像処理 |
| メモリ集約 | r5.2xlarge | 8 | 64 GB | 大量データ処理 |

**設定例**:
```json
{
  "batch": {
    "computeEnvironment": {
      "instanceTypes": ["m5.xlarge", "m5.2xlarge", "m5.4xlarge"]
    }
  }
}
```

---

### 2. ジョブ定義の最適化

**推奨設定**:

```json
{
  "jobDefinitions": {
    "documentProcessing": {
      "vcpus": 4,
      "memoryMiB": 8192,
      "timeoutSeconds": 7200,
      "retryAttempts": 3
    }
  }
}
```

**ベストプラクティス**:
- ✅ vCPU とメモリのバランスを考慮
- ✅ タイムアウトは処理時間の 2-3 倍に設定
- ✅ リトライ回数は 2-3 回が適切

---

### 3. FSx パフォーマンス最適化

**推奨設定**:

```json
{
  "fsx": {
    "create": {
      "storageCapacity": 2048,
      "throughputCapacity": 256,
      "deploymentType": "MULTI_AZ_1"
    }
  }
}
```

**ベストプラクティス**:
- ✅ スループット容量は処理量に応じて調整
- ✅ 本番環境では MULTI_AZ_1 を推奨
- ✅ ストレージ容量は余裕を持って設定

---

## コスト最適化

### 1. スポットインスタンスの活用

**推奨設定**:

```json
{
  "batch": {
    "computeEnvironment": {
      "useSpotInstances": true,
      "spotBidPercentage": 70
    }
  }
}
```

**コスト削減効果**:
- 💰 最大 90% のコスト削減
- ⚡ 中断リスクは低い（70% 入札率）
- 🔄 自動フェイルオーバー機能

---

### 2. ライフサイクル管理

**推奨設定**:

```json
{
  "storage": {
    "s3": {
      "lifecycleRules": {
        "transitionToIA": 30,
        "transitionToGlacier": 90,
        "deleteAfter": 365
      }
    }
  }
}
```

**コスト削減効果**:
- 💰 ストレージコスト 50-70% 削減
- 📦 自動アーカイブ
- 🗑️ 不要データの自動削除

---

### 3. 自動スケーリング

**推奨設定**:

```json
{
  "batch": {
    "computeEnvironment": {
      "minvCpus": 0,
      "desiredvCpus": 0
    }
  },
  
  "costOptimization": {
    "autoScaling": {
      "scaleDownDelay": 300,
      "scaleUpThreshold": 80
    }
  }
}
```

**コスト削減効果**:
- 💰 未使用時のコストゼロ
- ⚡ 需要に応じた自動調整
- 📊 効率的なリソース利用

---

## セキュリティベストプラクティス

### 1. ネットワークセキュリティ

**推奨設定**:

```json
{
  "security": {
    "network": {
      "allowedCIDRs": ["10.0.0.0/8"],
      "enableWAF": true
    }
  }
}
```

**ベストプラクティス**:
- ✅ 最小限の CIDR ブロックのみ許可
- ✅ WAF で不正アクセスをブロック
- ✅ プライベートサブネットを使用

---

### 2. 暗号化

**推奨設定**:

```json
{
  "security": {
    "encryption": {
      "enableKMSEncryption": true,
      "kmsKeyId": "arn:aws:kms:..."
    }
  }
}
```

**ベストプラクティス**:
- ✅ 本番環境では必ず KMS 暗号化を有効化
- ✅ カスタマー管理キーを使用
- ✅ キーローテーションを有効化

---

### 3. コンプライアンス

**推奨設定**:

```json
{
  "security": {
    "compliance": {
      "enableGuardDuty": true,
      "enableCloudTrail": true,
      "enableConfig": true
    }
  }
}
```

**ベストプラクティス**:
- ✅ 全てのコンプライアンス機能を有効化
- ✅ ログは長期保存
- ✅ 定期的な監査を実施

---

## 運用ベストプラクティス

### 1. 監視・アラート

**推奨設定**:

```json
{
  "monitoring": {
    "cloudWatch": {
      "logRetentionDays": 90,
      "enableDetailedMonitoring": true
    },
    "alerting": {
      "enableAlerts": true,
      "emailEndpoints": ["ops-team@company.com"],
      "slackWebhookUrl": "https://hooks.slack.com/..."
    }
  }
}
```

**ベストプラクティス**:
- ✅ 複数の通知チャネルを設定
- ✅ 重要度に応じたアラート設定
- ✅ ログは最低 90 日保存

---

### 2. バックアップ・災害復旧

**推奨設定**:

```json
{
  "storage": {
    "s3": {
      "enableVersioning": true
    },
    "dynamodb": {
      "enablePointInTimeRecovery": true
    }
  }
}
```

**ベストプラクティス**:
- ✅ 本番環境では必ずバックアップを有効化
- ✅ 定期的なリストアテストを実施
- ✅ クロスリージョンレプリケーションを検討

---

### 3. タグ管理

**推奨設定**:

```json
{
  "costOptimization": {
    "resourceTagging": {
      "costCenter": "Engineering",
      "project": "EmbeddingPipeline",
      "owner": "ops-team@company.com",
      "environment": "prod"
    }
  }
}
```

**ベストプラクティス**:
- ✅ 全リソースに一貫したタグを適用
- ✅ コスト配分に必要なタグを設定
- ✅ 自動化されたタグ管理を実装

---

## 🔗 関連ドキュメント

- [TypeScript インターフェースリファレンス](./TYPESCRIPT_INTERFACES_REFERENCE.md)
- [設定パラメータリファレンス](./CONFIGURATION_PARAMETERS_REFERENCE.md)
- [CDK デプロイメントガイド](./CDK_DEPLOYMENT_GUIDE.md)
- [トラブルシューティングガイド](./TROUBLESHOOTING_GUIDE.md)

---

**最終更新**: 2025年11月9日  
**バージョン**: 2.0.0
