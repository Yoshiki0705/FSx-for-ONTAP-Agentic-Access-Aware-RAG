# Configuration Guide

FSx for NetApp ONTAP Embedding Batch Workloadの設定ガイド

## 概要

このガイドでは、CDK Embeddingスタック統合対応の設定システムの使用方法について説明します。設定システムは、他の環境でも再現性のあるIaC（Infrastructure as Code）デプロイメントを可能にします。

## 設定テンプレート

### 利用可能なテンプレート

| テンプレート | 用途 | 特徴 |
|-------------|------|------|
| `basic-config.json` | 開発環境 | 最小限の設定、コスト最適化 |
| `enterprise-config.json` | 本番環境 | セキュリティ強化、監視充実 |
| `multi-region-config.json` | マルチリージョン | 地域分散、コンプライアンス対応 |
| `new-infrastructure-config.json` | 新規構築 | VPC・FSx新規作成 |

### テンプレート生成

```bash
# 対話モードで設定を作成
./scripts/generate-config.sh --interactive

# 基本テンプレートを生成
./scripts/generate-config.sh --template basic --project my-project --environment dev

# エンタープライズテンプレートを生成
./scripts/generate-config.sh --template enterprise --project prod-workload --environment prod --validate
```

## 設定構造

### 基本設定

```json
{
  "projectName": "my-embedding-workload",
  "environment": "dev",
  "region": "ap-northeast-1",
  "version": "1.0.0"
}
```

### CDK Embeddingスタック設定

```json
{
  "stackNaming": {
    "useAgentSteeringRules": true,
    "regionPrefix": "TokyoRegion",
    "stackPrefix": "permission-aware-rag"
  }
}
```

生成されるスタック名: `TokyoRegion-permission-aware-rag-dev-Embedding`

### AWS設定

```json
{
  "aws": {
    "account": "123456789012",
    "profile": "default",
    "assumeRoleArn": "arn:aws:iam::123456789012:role/DeploymentRole"
  }
}
```

### Bedrock設定

```json
{
  "bedrock": {
    "embeddingModel": {
      "modelId": "amazon.titan-embed-text-v1",
      "dimensions": 1536,
      "maxTokens": 8192
    },
    "textModel": {
      "modelId": "amazon.nova-pro-v1:0",
      "maxTokens": 4096,
      "temperature": 0.1
    },
    "region": "us-east-1"
  }
}
```

#### サポートされるモデル

**埋め込みモデル:**
- `amazon.titan-embed-text-v1` (1536次元)
- `amazon.titan-embed-text-v2:0` (1024次元)
- `cohere.embed-english-v3` (1024次元)
- `cohere.embed-multilingual-v3` (1024次元)

**テキストモデル:**
- `amazon.nova-pro-v1:0`
- `amazon.nova-lite-v1:0`
- `amazon.nova-pro-v1:0`

### VPC設定

#### 既存VPCを使用

```json
{
  "vpc": {
    "mode": "existing",
    "existing": {
      "vpcId": "vpc-xxxxxxxxx",
      "privateSubnetIds": ["subnet-xxxxxxxxx", "subnet-yyyyyyyyy"],
      "publicSubnetIds": ["subnet-zzzzzzzzz"],
      "securityGroupIds": ["sg-xxxxxxxxx"]
    }
  }
}
```

#### 新規VPCを作成

```json
{
  "vpc": {
    "mode": "create",
    "create": {
      "cidrBlock": "10.0.0.0/16",
      "availabilityZones": ["ap-northeast-1a", "ap-northeast-1c"],
      "enableNatGateway": true,
      "enableVpcFlowLogs": false
    }
  }
}
```

### FSx設定

#### 既存FSxを使用

```json
{
  "fsx": {
    "mode": "existing",
    "existing": {
      "fileSystemId": "fs-xxxxxxxxx",
      "svmId": "svm-xxxxxxxxx",
      "volumePath": "/rag-data",
      "mountPoint": "/mnt/fsx-rag-data"
    }
  }
}
```

#### 新規FSxを作成

```json
{
  "fsx": {
    "mode": "create",
    "create": {
      "storageCapacity": 1024,
      "throughputCapacity": 128,
      "deploymentType": "SINGLE_AZ_1",
      "volumePath": "/rag-data",
      "mountPoint": "/mnt/fsx-rag-data",
      "automaticBackupRetentionDays": 7,
      "dailyAutomaticBackupStartTime": "03:00"
    }
  }
}
```

### Batch設定

```json
{
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 1000,
      "minvCpus": 0,
      "desiredvCpus": 10,
      "instanceTypes": ["m5.xlarge", "c5.xlarge"],
      "useSpotInstances": true,
      "spotBidPercentage": 70
    },
    "jobQueue": {
      "priority": 100
    },
    "jobDefinitions": {
      "documentProcessing": {
        "vcpus": 4,
        "memoryMiB": 8192,
        "timeoutSeconds": 7200,
        "retryAttempts": 3
      },
      "embeddingGeneration": {
        "vcpus": 4,
        "memoryMiB": 8192,
        "timeoutSeconds": 14400,
        "retryAttempts": 3
      },
      "ragQueryProcessing": {
        "vcpus": 8,
        "memoryMiB": 16384,
        "timeoutSeconds": 7200,
        "retryAttempts": 3
      }
    }
  }
}
```

### 機能フラグ

```json
{
  "features": {
    "enableDocumentProcessing": true,
    "enableEmbeddingGeneration": true,
    "enableRagQueryProcessing": true,
    "enablePermissionFiltering": true,
    "enableMultiLanguageSupport": false,
    "enableAdvancedAnalytics": false
  }
}
```

### FSxファイルパス追跡システム設定

このシステムの重要な機能であるFSxファイルパス追跡システムの設定について説明します。

#### 基本設定

```json
{
  "filePathTracking": {
    "enabled": true,
    "preserveSourcePath": true,
    "opensearchIndex": "embeddings",
    "metadataFields": {
      "includeSource": true,
      "includeChunkInfo": true,
      "includeUserInfo": true,
      "includePermissions": true
    },
    "permissionCheck": {
      "enabled": true,
      "cacheEnabled": true,
      "cacheTtlSeconds": 300
    }
  }
}
```

#### 詳細設定

```json
{
  "filePathTracking": {
    "enabled": true,
    "preserveSourcePath": true,
    "opensearchIndex": "embeddings",
    "indexMapping": {
      "sourceUriField": "x-amz-bedrock-kb-source-uri",
      "titleField": "x-amz-bedrock-kb-title",
      "textChunkField": "AMAZON_BEDROCK_TEXT_CHUNK",
      "vectorField": "bedrock-knowledge-base-default-vector",
      "metadataField": "AMAZON_BEDROCK_METADATA"
    },
    "chunkProcessing": {
      "chunkSize": 1000,
      "chunkOverlap": 200,
      "preserveChunkBoundaries": true,
      "includeChunkPosition": true
    },
    "metadataFields": {
      "includeSource": true,
      "includeChunkInfo": true,
      "includeUserInfo": true,
      "includePermissions": true,
      "includeTimestamp": true,
      "includeFileSize": true,
      "includeFileType": true
    },
    "permissionCheck": {
      "enabled": true,
      "strategy": "path-based",
      "cacheEnabled": true,
      "cacheTtlSeconds": 300,
      "fallbackToOwner": true,
      "adminBypass": true
    },
    "pathMapping": {
      "fsxMountPath": "/mnt/fsx-data",
      "preserveFullPath": true,
      "normalizePathSeparators": true,
      "includeRelativePath": true
    }
  }
}
```

#### 権限チェック設定

```json
{
  "permissionSystem": {
    "enabled": true,
    "type": "path-based",
    "rules": [
      {
        "pattern": "/mnt/fsx-data/public/*",
        "permissions": ["read"],
        "users": ["*"]
      },
      {
        "pattern": "/mnt/fsx-data/department/{department}/*",
        "permissions": ["read", "write"],
        "users": ["department:{department}:*"]
      },
      {
        "pattern": "/mnt/fsx-data/users/{userId}/*",
        "permissions": ["read", "write", "delete"],
        "users": ["{userId}", "admin"]
      }
    ],
    "defaultDeny": true,
    "auditLog": true
  }
}
```

#### OpenSearch設定

```json
{
  "opensearch": {
    "endpoint": "https://search-embeddings-xxx.ap-northeast-1.es.amazonaws.com",
    "index": "embeddings",
    "indexSettings": {
      "numberOfShards": 3,
      "numberOfReplicas": 1,
      "refreshInterval": "1s"
    },
    "mapping": {
      "properties": {
        "x-amz-bedrock-kb-source-uri": {
          "type": "keyword",
          "index": true
        },
        "x-amz-bedrock-kb-title": {
          "type": "text",
          "analyzer": "standard"
        },
        "AMAZON_BEDROCK_TEXT_CHUNK": {
          "type": "text",
          "analyzer": "standard"
        },
        "bedrock-knowledge-base-default-vector": {
          "type": "dense_vector",
          "dims": 1536
        },
        "AMAZON_BEDROCK_METADATA": {
          "type": "object",
          "enabled": true
        }
      }
    }
  }
}
```

#### 環境変数設定

```bash
# FSxファイルパス追跡システム
export FSX_FILE_PATH_TRACKING_ENABLED="true"
export FSX_PRESERVE_SOURCE_PATH="true"
export FSX_MOUNT_PATH="/mnt/fsx-data"

# OpenSearch設定
export OPENSEARCH_ENDPOINT="https://search-embeddings-xxx.ap-northeast-1.es.amazonaws.com"
export OPENSEARCH_INDEX="embeddings"

# 権限チェック設定
export PERMISSION_CHECK_ENABLED="true"
export PERMISSION_CACHE_ENABLED="true"
export PERMISSION_CACHE_TTL="300"

# メタデータ設定
export INCLUDE_SOURCE_METADATA="true"
export INCLUDE_CHUNK_INFO="true"
export INCLUDE_USER_INFO="true"
export INCLUDE_PERMISSIONS="true"
```

#### 設定例: 開発環境

```json
{
  "projectName": "embedding-dev",
  "environment": "dev",
  "filePathTracking": {
    "enabled": true,
    "preserveSourcePath": true,
    "opensearchIndex": "embeddings-dev",
    "permissionCheck": {
      "enabled": false,
      "cacheEnabled": false
    },
    "metadataFields": {
      "includeSource": true,
      "includeChunkInfo": true,
      "includeUserInfo": false,
      "includePermissions": false
    }
  }
}
```

#### 設定例: 本番環境

```json
{
  "projectName": "embedding-prod",
  "environment": "prod",
  "filePathTracking": {
    "enabled": true,
    "preserveSourcePath": true,
    "opensearchIndex": "embeddings-prod",
    "permissionCheck": {
      "enabled": true,
      "strategy": "path-based",
      "cacheEnabled": true,
      "cacheTtlSeconds": 600,
      "auditLog": true
    },
    "metadataFields": {
      "includeSource": true,
      "includeChunkInfo": true,
      "includeUserInfo": true,
      "includePermissions": true,
      "includeTimestamp": true
    }
  }
}
```

## 環境変数による上書き

設定ファイルの値は環境変数で上書きできます：

```bash
# 基本設定
export PROJECT_NAME="my-project"
export ENVIRONMENT="prod"
export AWS_REGION="ap-northeast-1"
export VERSION="2.0.0"

# AWS設定
export AWS_ACCOUNT_ID="123456789012"
export AWS_PROFILE="production"
export AWS_ASSUME_ROLE_ARN="arn:aws:iam::123456789012:role/DeploymentRole"

# インフラ設定
export VPC_ID="vpc-xxxxxxxxx"
export PRIVATE_SUBNET_IDS="subnet-xxx,subnet-yyy"
export FSX_FILE_SYSTEM_ID="fs-xxxxxxxxx"

# Bedrock設定
export BEDROCK_REGION="us-east-1"
export BEDROCK_EMBEDDING_MODEL_ID="amazon.titan-embed-text-v1"
export BEDROCK_TEXT_MODEL_ID="amazon.nova-pro-v1:0"

# Batch設定
export BATCH_MAX_VCPUS="500"
export BATCH_USE_SPOT_INSTANCES="true"

# 機能フラグ
export ENABLE_DOCUMENT_PROCESSING="true"
export ENABLE_EMBEDDING_GENERATION="true"
export ENABLE_RAG_QUERY_PROCESSING="true"

# デバッグ設定
export ENABLE_DEBUG_LOGS="true"
```

## 設定の検証

### 自動検証

```bash
# 設定ファイルの検証
npm run validate-config

# CDKアプリケーションでの検証
npx cdk synth --context config=/path/to/config.json
```

### 手動検証

```typescript
import { ConfigurationValidator } from './lib/config/validators/config-validator';
import { loadDeploymentConfig } from './lib/config/deployment-config';

const config = loadDeploymentConfig({ validateConfig: true });
const result = ConfigurationValidator.validateConfig(config);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

## 環境別のベストプラクティス

### 開発環境 (dev)

- Spot インスタンスを使用してコスト削減
- デバッグログを有効化
- 小さなリソースサイズ
- 簡素化されたセキュリティ設定

```json
{
  "environment": "dev",
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 100,
      "useSpotInstances": true,
      "instanceTypes": ["m5.large"]
    }
  },
  "development": {
    "debugging": {
      "enableDebugLogs": true,
      "enableVerboseOutput": true
    }
  }
}
```

### ステージング環境 (staging)

- 本番に近い設定
- 監視とアラートを有効化
- 中程度のリソースサイズ

```json
{
  "environment": "staging",
  "monitoring": {
    "cloudWatch": {
      "enableDetailedMonitoring": true,
      "createDashboard": true
    },
    "alerting": {
      "enableAlerts": true,
      "emailEndpoints": ["staging-alerts@company.com"]
    }
  }
}
```

### 本番環境 (prod)

- 高可用性設定
- 完全なセキュリティ機能
- 包括的な監視
- バックアップとコンプライアンス

```json
{
  "environment": "prod",
  "fsx": {
    "create": {
      "deploymentType": "MULTI_AZ_1"
    }
  },
  "security": {
    "iam": {
      "enableMFA": true
    },
    "encryption": {
      "enableKMSEncryption": true
    },
    "compliance": {
      "enableGuardDuty": true,
      "enableCloudTrail": true
    }
  },
  "storage": {
    "dynamodb": {
      "enablePointInTimeRecovery": true
    }
  }
}
```

## トラブルシューティング

### よくある問題

#### 1. 設定検証エラー

```
Error: vpc.existing.vpcId is required when mode is "existing"
```

**解決方法:** VPC IDを正しく設定してください。

```json
{
  "vpc": {
    "mode": "existing",
    "existing": {
      "vpcId": "vpc-xxxxxxxxx"
    }
  }
}
```

#### 2. Bedrockモデルが利用できない

```
Error: Bedrock may not be available in region: ap-northeast-1
```

**解決方法:** Bedrockが利用可能なリージョンを使用してください。

```json
{
  "bedrock": {
    "region": "us-east-1"
  }
}
```

#### 3. FSxマウントエラー

**解決方法:** セキュリティグループでNFSトラフィック（ポート2049）を許可してください。

### デバッグ方法

```bash
# 詳細ログを有効化
export ENABLE_DEBUG_LOGS=true

# 設定の詳細表示
npx cdk synth --verbose

# 設定検証の実行
./scripts/generate-config.sh --template basic --validate
```

## 参考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Amazon FSx for NetApp ONTAP](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)
- [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/)
- [AWS Batch](https://docs.aws.amazon.com/batch/)

## サポート

問題が発生した場合は、以下の情報を含めてお問い合わせください：

1. 使用している設定ファイル
2. エラーメッセージの全文
3. 実行環境の詳細（OS、Node.js バージョンなど）
4. CDK バージョン
"