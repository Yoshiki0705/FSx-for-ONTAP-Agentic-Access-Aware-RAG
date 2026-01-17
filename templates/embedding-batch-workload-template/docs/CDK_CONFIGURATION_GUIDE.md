# ⚙️ CDK 設定ガイド / CDK Configuration Guide

## 📋 概要 / Overview

このガイドでは、FSx for NetApp ONTAP Embedding Batch WorkloadのCDK設定について詳しく説明します。

This guide provides detailed information about CDK configuration for the FSx for NetApp ONTAP Embedding Batch Workload.

## 🎯 設定ファイル構造 / Configuration File Structure

### メイン設定ファイル / Main Configuration File

`config/deployment-config.json` - メインの設定ファイル
`config/deployment-config.json` - Main configuration file

```json
{
  "projectName": "string",
  "environment": "dev|staging|prod",
  "region": "aws-region",
  "vpc": { /* VPC設定 */ },
  "fsx": { /* FSx設定 */ },
  "batch": { /* Batch設定 */ },
  "storage": { /* ストレージ設定 */ },
  "monitoring": { /* 監視設定 */ },
  "security": { /* セキュリティ設定 */ }
}
```

## 🏗️ 基本設定 / Basic Configuration

### プロジェクト設定 / Project Settings

```json
{
  "projectName": "my-embedding-project",
  "environment": "dev",
  "region": "ap-northeast-1",
  "tags": {
    "Project": "EmbeddingBatchWorkload",
    "Environment": "dev",
    "Owner": "team@company.com"
  }
}
```

| パラメータ / Parameter | 説明 / Description | 制約 / Constraints |
|----------------------|-------------------|-------------------|
| `projectName` | プロジェクト名 | 英数字とハイフンのみ、3-20文字 |
| `environment` | 環境名 | dev, staging, prod |
| `region` | AWSリージョン | 有効なAWSリージョンコード |
| `tags` | リソースタグ | キー・バリューペア |

## 🌐 ネットワーク設定 / Network Configuration

### 既存VPC使用 / Using Existing VPC

```json
{
  "vpc": {
    "hasExisting": true,
    "vpcId": "vpc-0123456789abcdef0",
    "subnetIds": [
      "subnet-0123456789abcdef0",
      "subnet-0123456789abcdef1"
    ],
    "createNew": false
  }
}
```

### 新規VPC作成 / Creating New VPC

```json
{
  "vpc": {
    "hasExisting": false,
    "createNew": true,
    "cidr": "10.0.0.0/16",
    "availabilityZones": 2,
    "enableDnsHostnames": true,
    "enableDnsSupport": true,
    "natGateways": 1
  }
}
```

#### VPC設定パラメータ / VPC Configuration Parameters

| パラメータ / Parameter | 説明 / Description | デフォルト / Default |
|----------------------|-------------------|-------------------|
| `cidr` | VPC CIDRブロック | 10.0.0.0/16 |
| `availabilityZones` | AZ数 | 2 |
| `enableDnsHostnames` | DNS ホスト名有効化 | true |
| `enableDnsSupport` | DNS サポート有効化 | true |
| `natGateways` | NAT ゲートウェイ数 | 1 |

## 💾 FSx for NetApp ONTAP 設定 / FSx for NetApp ONTAP Configuration

### 既存FSx使用 / Using Existing FSx

```json
{
  "fsx": {
    "hasExisting": true,
    "fileSystemId": "fs-0123456789abcdef0",
    "svmId": "svm-0123456789abcdef0",
    "volumePath": "/rag-data",
    "createNew": false
  }
}
```

### 新規FSx作成 / Creating New FSx

```json
{
  "fsx": {
    "hasExisting": false,
    "createNew": true,
    "storageCapacity": 1024,
    "throughputCapacity": 128,
    "deploymentType": "MULTI_AZ_1",
    "volumePath": "/rag-data",
    "automaticBackupRetentionDays": 7,
    "dailyAutomaticBackupStartTime": "03:00",
    "weeklyMaintenanceStartTime": "1:03:00"
  }
}
```

#### FSx設定パラメータ / FSx Configuration Parameters

| パラメータ / Parameter | 説明 / Description | 選択肢 / Options |
|----------------------|-------------------|-----------------|
| `storageCapacity` | ストレージ容量 (GB) | 1024, 2048, 4096... |
| `throughputCapacity` | スループット容量 (MB/s) | 128, 256, 512, 1024, 2048 |
| `deploymentType` | デプロイメントタイプ | MULTI_AZ_1, SINGLE_AZ_1 |
| `automaticBackupRetentionDays` | 自動バックアップ保持日数 | 0-90 |

## ⚡ AWS Batch 設定 / AWS Batch Configuration

### EC2 コンピュート環境 / EC2 Compute Environment

```json
{
  "batch": {
    "computeEnvironmentType": "EC2",
    "instanceTypes": ["m5.large", "m5.xlarge", "m5.2xlarge"],
    "maxvCpus": 500,
    "desiredvCpus": 0,
    "minvCpus": 0,
    "enableSpotInstances": true,
    "spotFleetRequestRole": "arn:aws:iam::123456789012:role/aws-ec2-spot-fleet-tagging-role",
    "bidPercentage": 50,
    "ec2Configuration": {
      "imageType": "ECS_AL2"
    }
  }
}
```

### Fargate コンピュート環境 / Fargate Compute Environment

```json
{
  "batch": {
    "computeEnvironmentType": "FARGATE",
    "maxvCpus": 100,
    "desiredvCpus": 0,
    "platformVersion": "LATEST"
  }
}
```

#### Batch設定パラメータ / Batch Configuration Parameters

| パラメータ / Parameter | 説明 / Description | 推奨値 / Recommended |
|----------------------|-------------------|-------------------|
| `maxvCpus` | 最大vCPU数 | 開発:50, 本番:500+ |
| `desiredvCpus` | 希望vCPU数 | 0 (自動スケーリング) |
| `instanceTypes` | インスタンスタイプ | m5.large, m5.xlarge |
| `bidPercentage` | Spot入札率 | 50-80% |

## 🗄️ ストレージ設定 / Storage Configuration

### S3 設定 / S3 Configuration

```json
{
  "storage": {
    "s3": {
      "bucketName": "auto-generated",
      "versioning": true,
      "encryption": {
        "type": "SSE-S3"
      },
      "lifecycleRules": [
        {
          "id": "EmbeddingsTransition",
          "status": "Enabled",
          "transitions": [
            {
              "days": 30,
              "storageClass": "STANDARD_IA"
            },
            {
              "days": 90,
              "storageClass": "GLACIER"
            }
          ]
        }
      ]
    }
  }
}
```

### DynamoDB 設定 / DynamoDB Configuration

```json
{
  "storage": {
    "dynamodb": {
      "tableName": "auto-generated",
      "billingMode": "PAY_PER_REQUEST",
      "pointInTimeRecovery": true,
      "encryption": {
        "type": "AWS_MANAGED"
      },
      "globalSecondaryIndexes": [
        {
          "indexName": "UserIndex",
          "partitionKey": "userId",
          "sortKey": "timestamp"
        }
      ]
    }
  }
}
```

## 📊 監視設定 / Monitoring Configuration

### CloudWatch 設定 / CloudWatch Configuration

```json
{
  "monitoring": {
    "createDashboard": true,
    "enableDetailedMonitoring": true,
    "logRetentionDays": 30,
    "alarms": {
      "enabled": true,
      "snsTopicArn": "arn:aws:sns:region:account:alerts",
      "thresholds": {
        "jobFailureRate": 10,
        "queueDepth": 100,
        "fsxUtilization": 80
      }
    },
    "xray": {
      "enabled": true,
      "samplingRate": 0.1
    }
  }
}
```

#### 監視パラメータ / Monitoring Parameters

| パラメータ / Parameter | 説明 / Description | デフォルト / Default |
|----------------------|-------------------|-------------------|
| `logRetentionDays` | ログ保持日数 | 30 |
| `jobFailureRate` | ジョブ失敗率閾値 (%) | 10 |
| `queueDepth` | キュー深度閾値 | 100 |
| `fsxUtilization` | FSx使用率閾値 (%) | 80 |

## 🔒 セキュリティ設定 / Security Configuration

### IAM 設定 / IAM Configuration

```json
{
  "security": {
    "iam": {
      "createCustomRoles": true,
      "minimumPermissions": true,
      "crossAccountAccess": false,
      "mfaRequired": false
    },
    "encryption": {
      "s3": "SSE-S3",
      "dynamodb": "AWS_MANAGED",
      "fsx": "AWS_MANAGED",
      "ebs": "AWS_MANAGED"
    },
    "networkSecurity": {
      "restrictedAccess": true,
      "allowedCidrs": ["10.0.0.0/8"],
      "enableVpcEndpoints": true
    }
  }
}
```

### KMS 設定 / KMS Configuration

```json
{
  "security": {
    "kms": {
      "createCustomKey": false,
      "keyRotation": true,
      "keyPolicy": {
        "allowRootAccess": true,
        "allowServiceAccess": true
      }
    }
  }
}
```

## 🌍 マルチリージョン設定 / Multi-region Configuration

### プライマリ・セカンダリ構成 / Primary-Secondary Configuration

```json
{
  "multiRegion": {
    "enabled": true,
    "regions": [
      {
        "region": "ap-northeast-1",
        "isPrimary": true,
        "replicationEnabled": true
      },
      {
        "region": "us-east-1",
        "isPrimary": false,
        "replicationEnabled": true
      }
    ],
    "crossRegionReplication": {
      "s3": true,
      "dynamodb": true
    }
  }
}
```

## 🎛️ 環境別設定例 / Environment-specific Configuration Examples

### 開発環境 / Development Environment

```json
{
  "projectName": "embedding-dev",
  "environment": "dev",
  "region": "ap-northeast-1",
  "vpc": {
    "hasExisting": false,
    "createNew": true,
    "cidr": "10.0.0.0/16"
  },
  "fsx": {
    "hasExisting": false,
    "createNew": true,
    "storageCapacity": 1024,
    "throughputCapacity": 128
  },
  "batch": {
    "computeEnvironmentType": "EC2",
    "maxvCpus": 50,
    "instanceTypes": ["m5.large"]
  },
  "monitoring": {
    "createDashboard": false,
    "enableDetailedMonitoring": false
  }
}
```

### 本番環境 / Production Environment

```json
{
  "projectName": "embedding-prod",
  "environment": "prod",
  "region": "ap-northeast-1",
  "vpc": {
    "hasExisting": true,
    "vpcId": "vpc-prod123456",
    "subnetIds": ["subnet-prod1", "subnet-prod2"]
  },
  "fsx": {
    "hasExisting": true,
    "fileSystemId": "fs-prod123456",
    "svmId": "svm-prod123456"
  },
  "batch": {
    "computeEnvironmentType": "EC2",
    "maxvCpus": 1000,
    "instanceTypes": ["m5.xlarge", "m5.2xlarge", "m5.4xlarge"],
    "enableSpotInstances": true
  },
  "monitoring": {
    "createDashboard": true,
    "enableDetailedMonitoring": true,
    "alarms": {
      "enabled": true,
      "snsTopicArn": "arn:aws:sns:ap-northeast-1:123456789012:prod-alerts"
    }
  },
  "security": {
    "encryption": {
      "s3": "SSE-KMS",
      "dynamodb": "CUSTOMER_MANAGED"
    }
  }
}
```

## 🔧 カスタマイゼーション / Customization

### ジョブ定義カスタマイズ / Job Definition Customization

```json
{
  "jobDefinitions": {
    "documentProcessing": {
      "vcpus": 2,
      "memory": 4096,
      "timeout": 3600,
      "retryAttempts": 3,
      "environment": {
        "BATCH_SIZE": "100",
        "LOG_LEVEL": "INFO"
      }
    },
    "embeddingGeneration": {
      "vcpus": 4,
      "memory": 8192,
      "timeout": 7200,
      "retryAttempts": 2,
      "environment": {
        "MODEL_NAME": "amazon.titan-embed-text-v1",
        "BATCH_SIZE": "50"
      }
    },
    "ragQuery": {
      "vcpus": 2,
      "memory": 4096,
      "timeout": 1800,
      "retryAttempts": 3,
      "environment": {
        "MAX_RESULTS": "10",
        "SIMILARITY_THRESHOLD": "0.7"
      }
    }
  }
}
```

### コンテナイメージ設定 / Container Image Configuration

```json
{
  "containerImages": {
    "documentProcessor": {
      "repository": "your-account.dkr.ecr.region.amazonaws.com/doc-processor",
      "tag": "latest"
    },
    "embeddingGenerator": {
      "repository": "your-account.dkr.ecr.region.amazonaws.com/embedding-gen",
      "tag": "v1.0.0"
    },
    "ragProcessor": {
      "repository": "your-account.dkr.ecr.region.amazonaws.com/rag-processor",
      "tag": "latest"
    }
  }
}
```

## ✅ 設定検証 / Configuration Validation

### 設定ファイル検証スクリプト / Configuration Validation Script

```bash
# 設定ファイル構文チェック
jq empty config/deployment-config.json

# 必須フィールドチェック
./scripts/validate-config.sh config/deployment-config.json
```

### 設定テンプレート生成 / Configuration Template Generation

```bash
# 基本設定テンプレート生成
./scripts/generate-config.sh --template basic

# 本番環境設定テンプレート生成
./scripts/generate-config.sh --template production

# カスタム設定テンプレート生成
./scripts/generate-config.sh --template custom --interactive
```

## 📚 設定リファレンス / Configuration Reference

### 完全設定スキーマ / Complete Configuration Schema

設定ファイルの完全なスキーマは `config/schema.json` で確認できます。
The complete configuration schema is available in `config/schema.json`.

### 設定例集 / Configuration Examples

- `examples/basic-config.json` - 基本設定例
- `examples/enterprise-config.json` - エンタープライズ設定例
- `examples/multi-region-config.json` - マルチリージョン設定例
- `examples/existing-vpc-config.json` - 既存VPC使用例

## 🆘 設定トラブルシューティング / Configuration Troubleshooting

### よくある設定エラー / Common Configuration Errors

1. **無効なJSON形式 / Invalid JSON Format**
   ```bash
   # 構文チェック
   jq empty config/deployment-config.json
   ```

2. **必須フィールド不足 / Missing Required Fields**
   ```bash
   # 必須フィールドチェック
   ./scripts/validate-config.sh
   ```

3. **リソース名重複 / Resource Name Conflicts**
   ```bash
   # 既存リソースチェック
   aws cloudformation describe-stacks --stack-name STACK_NAME
   ```

### 設定デバッグ / Configuration Debugging

```bash
# 設定内容確認
cat config/deployment-config.json | jq .

# CDK コンテキスト確認
npx cdk context

# 生成されるリソース確認
npx cdk synth --verbose
```