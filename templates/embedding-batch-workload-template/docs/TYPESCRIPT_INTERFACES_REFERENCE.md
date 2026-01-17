# TypeScript インターフェース詳細リファレンス

## 📋 概要

このドキュメントは、Embedding Batch Workload Template で使用される全ての TypeScript インターフェースの詳細リファレンスです。型安全な設定管理とコード開発のための完全なガイドを提供します。

## 🎯 対象読者

- TypeScript/JavaScript 開発者
- CDK を使用したインフラ開発者
- カスタム実装を行う技術者
- 型定義を理解したい運用者

## 📁 インターフェース定義の場所

```
cdk/lib/config/interfaces/
└── deployment-config-interfaces.ts  # 全インターフェース定義
```

## 🏗️ 主要インターフェース

### DeploymentConfig

最上位の設定インターフェース。全ての設定を統合します。

```typescript
export interface DeploymentConfig {
  projectName: string;              // プロジェクト名（英数字のみ）
  environment: 'dev' | 'test' | 'staging' | 'prod';  // 環境名
  region: string;                   // AWS リージョン
  version?: string;                 // バージョン（オプション）
  
  aws: AwsConfig;                   // AWS 基本設定
  bedrock: BedrockConfig;           // Bedrock AI 設定
  vpc: VpcConfig;                   // VPC ネットワーク設定
  fsx: FsxConfig;                   // FSx ストレージ設定
  batch: BatchConfig;               // AWS Batch 設定
  storage: StorageConfig;           // ストレージ設定
  monitoring: MonitoringConfig;     // 監視設定
  security: SecurityConfig;         // セキュリティ設定
  costOptimization: CostOptimizationConfig;  // コスト最適化設定
  development: DevelopmentConfig;   // 開発設定
  features: FeatureFlags;           // 機能フラグ
  stackNaming: StackNamingConfig;   // スタック命名設定
}
```

**使用例:**

```typescript
const config: DeploymentConfig = {
  projectName: 'my-embedding-project',
  environment: 'dev',
  region: 'ap-northeast-1',
  // ... 他の設定
};
```


### AwsConfig

AWS 基本設定を定義します。

```typescript
export interface AwsConfig {
  account?: string;          // AWS アカウント ID（オプション）
  profile?: string;          // AWS CLI プロファイル名（オプション）
  assumeRoleArn?: string;    // AssumeRole ARN（オプション）
}
```

**使用例:**

```typescript
const awsConfig: AwsConfig = {
  account: '123456789012',
  profile: 'production',
  assumeRoleArn: 'arn:aws:iam::123456789012:role/DeploymentRole'
};
```

**注意事項:**
- `account` は CDK デプロイ時の検証に使用
- `profile` は AWS CLI の認証情報を指定
- `assumeRoleArn` はクロスアカウントデプロイ時に使用

---

### BedrockConfig

Amazon Bedrock AI サービスの設定を定義します。

```typescript
export interface BedrockConfig {
  region: string;                      // Bedrock リージョン
  modelId: string;                     // デフォルトモデル ID
  embeddingModel: EmbeddingModelConfig;  // 埋め込みモデル設定
  textModel: TextModelConfig;          // テキストモデル設定
}

export interface EmbeddingModelConfig {
  modelId: string;      // 埋め込みモデル ID
  dimensions: number;   // ベクトル次元数
  maxTokens: number;    // 最大トークン数
}

export interface TextModelConfig {
  modelId: string;      // テキストモデル ID
  temperature: number;  // 生成温度（0.0-1.0）
  maxTokens: number;    // 最大トークン数
}
```

**使用例:**

```typescript
const bedrockConfig: BedrockConfig = {
  region: 'us-east-1',
  modelId: 'amazon.nova-pro-v1:0',
  embeddingModel: {
    modelId: 'amazon.titan-embed-text-v2:0',
    dimensions: 256,
    maxTokens: 8192
  },
  textModel: {
    modelId: 'amazon.nova-pro-v1:0',
    temperature: 0.7,
    maxTokens: 4096
  }
};
```

**サポートされるモデル:**
- **埋め込みモデル**: `amazon.titan-embed-text-v1`, `amazon.titan-embed-text-v2:0`
- **テキストモデル**: `amazon.nova-pro-v1:0`, `anthropic.claude-3-5-sonnet-20241022-v2:0`

---

### VpcConfig

VPC ネットワーク設定を定義します。

```typescript
export interface VpcConfig {
  mode: 'existing' | 'create';      // VPC モード
  existing?: ExistingVpcConfig;     // 既存 VPC 設定
  create?: CreateVpcConfig;         // 新規 VPC 設定
}

export interface ExistingVpcConfig {
  vpcId: string;                    // VPC ID
  privateSubnetIds: string[];       // プライベートサブネット ID リスト
  publicSubnetIds?: string[];       // パブリックサブネット ID リスト（オプション）
}

export interface CreateVpcConfig {
  cidrBlock: string;                // CIDR ブロック
  availabilityZones: string[];      // アベイラビリティゾーン
  enableNatGateway: boolean;        // NAT ゲートウェイ有効化
}
```

**使用例（既存 VPC）:**

```typescript
const vpcConfig: VpcConfig = {
  mode: 'existing',
  existing: {
    vpcId: 'vpc-0123456789abcdef0',
    privateSubnetIds: [
      'subnet-0123456789abcdef0',
      'subnet-0123456789abcdef1'
    ],
    publicSubnetIds: [
      'subnet-0123456789abcdef2'
    ]
  }
};
```

**使用例（新規 VPC）:**

```typescript
const vpcConfig: VpcConfig = {
  mode: 'create',
  create: {
    cidrBlock: '10.0.0.0/16',
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
    enableNatGateway: true
  }
};
```

---

### FsxConfig

Amazon FSx for NetApp ONTAP 設定を定義します。

```typescript
export interface FsxConfig {
  mode: 'existing' | 'create';      // FSx モード
  existing?: ExistingFsxConfig;     // 既存 FSx 設定
  create?: CreateFsxConfig;         // 新規 FSx 設定
}

export interface ExistingFsxConfig {
  fileSystemId: string;             // ファイルシステム ID
  volumePath: string;               // ボリュームパス
  mountPoint: string;               // マウントポイント
}

export interface CreateFsxConfig {
  storageCapacity: number;          // ストレージ容量（GB）
  throughputCapacity: number;       // スループット容量（MB/s）
  deploymentType: 'SINGLE_AZ_1' | 'MULTI_AZ_1';  // デプロイメントタイプ
}
```

**使用例（既存 FSx）:**

```typescript
const fsxConfig: FsxConfig = {
  mode: 'existing',
  existing: {
    fileSystemId: 'fs-0123456789abcdef0',
    volumePath: '/vol1',
    mountPoint: '/mnt/fsx'
  }
};
```

**使用例（新規 FSx）:**

```typescript
const fsxConfig: FsxConfig = {
  mode: 'create',
  create: {
    storageCapacity: 1024,
    throughputCapacity: 128,
    deploymentType: 'SINGLE_AZ_1'
  }
};
```


### BatchConfig

AWS Batch 設定を定義します。

```typescript
export interface BatchConfig {
  computeEnvironment: ComputeEnvironmentConfig;  // コンピュート環境設定
  jobQueue: JobQueueConfig;                      // ジョブキュー設定
  jobDefinitions: JobDefinitionsConfig;          // ジョブ定義設定
}

export interface ComputeEnvironmentConfig {
  maxvCpus: number;              // 最大 vCPU 数
  minvCpus: number;              // 最小 vCPU 数
  desiredvCpus: number;          // 希望 vCPU 数
  instanceTypes: string[];       // インスタンスタイプリスト
  useSpotInstances: boolean;     // スポットインスタンス使用
  spotBidPercentage?: number;    // スポット入札率（オプション）
}

export interface JobQueueConfig {
  priority: number;              // ジョブキュー優先度
}

export interface JobDefinitionsConfig {
  documentProcessing: JobDefinitionConfig;    // 文書処理ジョブ定義
  embeddingGeneration: JobDefinitionConfig;   // 埋め込み生成ジョブ定義
  ragQueryProcessing: JobDefinitionConfig;    // RAG クエリ処理ジョブ定義
}

export interface JobDefinitionConfig {
  vcpus: number;                 // vCPU 数
  memoryMiB: number;             // メモリ（MiB）
  timeoutSeconds: number;        // タイムアウト（秒）
  retryAttempts: number;         // リトライ回数
}
```

**使用例:**

```typescript
const batchConfig: BatchConfig = {
  computeEnvironment: {
    maxvCpus: 256,
    minvCpus: 0,
    desiredvCpus: 0,
    instanceTypes: ['m5.large', 'm5.xlarge', 'm5.2xlarge'],
    useSpotInstances: true,
    spotBidPercentage: 70
  },
  jobQueue: {
    priority: 1
  },
  jobDefinitions: {
    documentProcessing: {
      vcpus: 2,
      memoryMiB: 4096,
      timeoutSeconds: 3600,
      retryAttempts: 3
    },
    embeddingGeneration: {
      vcpus: 4,
      memoryMiB: 8192,
      timeoutSeconds: 7200,
      retryAttempts: 2
    },
    ragQueryProcessing: {
      vcpus: 2,
      memoryMiB: 4096,
      timeoutSeconds: 1800,
      retryAttempts: 3
    }
  }
};
```

**推奨設定:**
- **開発環境**: maxvCpus: 64, スポットインスタンス有効
- **本番環境**: maxvCpus: 256+, スポット + オンデマンドの混合

---

### StorageConfig

ストレージ設定を定義します。

```typescript
export interface StorageConfig {
  s3: S3Config;                  // S3 設定
  dynamodb: DynamoDbConfig;      // DynamoDB 設定
}

export interface S3Config {
  bucketName?: string;           // バケット名（オプション）
  enableVersioning: boolean;     // バージョニング有効化
  lifecycleRules: S3LifecycleRules;  // ライフサイクルルール
}

export interface S3LifecycleRules {
  transitionToIA: number;        // IA への移行日数
  transitionToGlacier: number;   // Glacier への移行日数
  deleteAfter: number;           // 削除までの日数
}

export interface DynamoDbConfig {
  tableName?: string;            // テーブル名（オプション）
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';  // 課金モード
  provisionedThroughput?: ProvisionedThroughput;   // プロビジョンドスループット
  enablePointInTimeRecovery: boolean;  // ポイントインタイムリカバリ有効化
}

export interface ProvisionedThroughput {
  readCapacityUnits: number;     // 読み取りキャパシティユニット
  writeCapacityUnits: number;    // 書き込みキャパシティユニット
}
```

**使用例:**

```typescript
const storageConfig: StorageConfig = {
  s3: {
    bucketName: 'my-embedding-documents',
    enableVersioning: true,
    lifecycleRules: {
      transitionToIA: 30,
      transitionToGlacier: 90,
      deleteAfter: 365
    }
  },
  dynamodb: {
    tableName: 'embedding-metadata',
    billingMode: 'PAY_PER_REQUEST',
    enablePointInTimeRecovery: true
  }
};
```

---

### MonitoringConfig

監視設定を定義します。

```typescript
export interface MonitoringConfig {
  cloudWatch: CloudWatchConfig;  // CloudWatch 設定
  alerting: AlertingConfig;      // アラート設定
  xray: XRayConfig;              // X-Ray 設定
}

export interface CloudWatchConfig {
  logRetentionDays: number;      // ログ保持日数
  enableDetailedMonitoring: boolean;  // 詳細監視有効化
}

export interface AlertingConfig {
  enableAlerts: boolean;         // アラート有効化
  emailEndpoints: string[];      // メールエンドポイント
  snsTopicArn?: string;          // SNS トピック ARN（オプション）
  slackWebhookUrl?: string;      // Slack Webhook URL（オプション）
}

export interface XRayConfig {
  enableTracing: boolean;        // トレーシング有効化
  samplingRate: number;          // サンプリングレート（0.0-1.0）
}
```

**使用例:**

```typescript
const monitoringConfig: MonitoringConfig = {
  cloudWatch: {
    logRetentionDays: 30,
    enableDetailedMonitoring: true
  },
  alerting: {
    enableAlerts: true,
    emailEndpoints: ['ops-team@company.com'],
    slackWebhookUrl: 'https://hooks.slack.com/services/...'
  },
  xray: {
    enableTracing: true,
    samplingRate: 0.1
  }
};
```


### SecurityConfig

セキュリティ設定を定義します。

```typescript
export interface SecurityConfig {
  network: NetworkSecurityConfig;    // ネットワークセキュリティ設定
  encryption: EncryptionConfig;      // 暗号化設定
  compliance: ComplianceConfig;      // コンプライアンス設定
}

export interface NetworkSecurityConfig {
  allowedCIDRs: string[];            // 許可 CIDR ブロック
  enableWAF: boolean;                // WAF 有効化
}

export interface EncryptionConfig {
  enableKMSEncryption: boolean;      // KMS 暗号化有効化
  kmsKeyId?: string;                 // KMS キー ID（オプション）
}

export interface ComplianceConfig {
  enableGuardDuty: boolean;          // GuardDuty 有効化
  enableCloudTrail: boolean;         // CloudTrail 有効化
  enableConfig: boolean;             // AWS Config 有効化
}
```

**使用例:**

```typescript
const securityConfig: SecurityConfig = {
  network: {
    allowedCIDRs: ['10.0.0.0/8', '172.16.0.0/12'],
    enableWAF: true
  },
  encryption: {
    enableKMSEncryption: true,
    kmsKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012'
  },
  compliance: {
    enableGuardDuty: true,
    enableCloudTrail: true,
    enableConfig: true
  }
};
```

**セキュリティベストプラクティス:**
- 本番環境では全ての暗号化を有効化
- GuardDuty と CloudTrail は必須
- 最小権限の CIDR ブロックを設定

---

### CostOptimizationConfig

コスト最適化設定を定義します。

```typescript
export interface CostOptimizationConfig {
  autoScaling: AutoScalingConfig;        // 自動スケーリング設定
  budgets: BudgetConfig;                 // 予算設定
  resourceTagging: ResourceTaggingConfig;  // リソースタグ設定
}

export interface AutoScalingConfig {
  scaleDownDelay: number;                // スケールダウン遅延（秒）
  scaleUpThreshold: number;              // スケールアップ閾値（%）
}

export interface BudgetConfig {
  monthlyBudgetUSD: number;              // 月額予算（USD）
  alertThreshold: number;                // アラート閾値（%）
}

export interface ResourceTaggingConfig {
  costCenter: string;                    // コストセンター
  project: string;                       // プロジェクト名
  owner: string;                         // オーナー
}
```

**使用例:**

```typescript
const costOptimizationConfig: CostOptimizationConfig = {
  autoScaling: {
    scaleDownDelay: 300,
    scaleUpThreshold: 80
  },
  budgets: {
    monthlyBudgetUSD: 1000,
    alertThreshold: 80
  },
  resourceTagging: {
    costCenter: 'Engineering',
    project: 'EmbeddingPipeline',
    owner: 'ops-team@company.com'
  }
};
```

---

### DevelopmentConfig

開発設定を定義します。

```typescript
export interface DevelopmentConfig {
  deployment: DeploymentConfig;      // デプロイメント設定
  debugging: DebuggingConfig;        // デバッグ設定
  testing: TestingConfig;            // テスト設定
}

export interface DeploymentConfig {
  deploymentTimeout: number;         // デプロイメントタイムアウト（秒）
  enableRollback: boolean;           // ロールバック有効化
}

export interface DebuggingConfig {
  enableDebugLogs: boolean;          // デバッグログ有効化
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';  // ログレベル
}

export interface TestingConfig {
  enableTestMode: boolean;           // テストモード有効化
  testDataPath?: string;             // テストデータパス（オプション）
}
```

**使用例:**

```typescript
const developmentConfig: DevelopmentConfig = {
  deployment: {
    deploymentTimeout: 3600,
    enableRollback: true
  },
  debugging: {
    enableDebugLogs: true,
    logLevel: 'DEBUG'
  },
  testing: {
    enableTestMode: false,
    testDataPath: 's3://my-bucket/test-data/'
  }
};
```

---

### FeatureFlags

機能フラグを定義します。

```typescript
export interface FeatureFlags {
  enableDocumentProcessing: boolean;     // 文書処理有効化
  enableEmbeddingGeneration: boolean;    // 埋め込み生成有効化
  enableRagQueryProcessing: boolean;     // RAG クエリ処理有効化
  enablePermissionFiltering: boolean;    // 権限フィルタリング有効化
}
```

**使用例:**

```typescript
const featureFlags: FeatureFlags = {
  enableDocumentProcessing: true,
  enableEmbeddingGeneration: true,
  enableRagQueryProcessing: true,
  enablePermissionFiltering: true
};
```

---

### StackNamingConfig

スタック命名設定を定義します。

```typescript
export interface StackNamingConfig {
  regionPrefix: string;              // リージョンプレフィックス
  stackPrefix: string;               // スタックプレフィックス
  useAgentSteeringRules: boolean;    // Agent Steering ルール使用
}
```

**使用例:**

```typescript
const stackNamingConfig: StackNamingConfig = {
  regionPrefix: 'TokyoRegion',
  stackPrefix: 'embedding-batch',
  useAgentSteeringRules: true
};
```

---

## 🔍 設定検証

### ConfigValidationResult

設定検証結果を定義します。

```typescript
export interface ConfigValidationResult {
  isValid: boolean;                  // 検証結果
  errors: string[];                  // エラーリスト
  warnings: string[];                // 警告リスト
  recommendations: string[];         // 推奨事項リスト
}
```

**使用例:**

```typescript
import { validateConfig } from './config/validation';

const result: ConfigValidationResult = validateConfig(config);

if (!result.isValid) {
  console.error('設定エラー:', result.errors);
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn('警告:', result.warnings);
}

if (result.recommendations.length > 0) {
  console.info('推奨事項:', result.recommendations);
}
```

---

## 📚 完全な設定例

### 開発環境設定

```typescript
const devConfig: DeploymentConfig = {
  projectName: 'embedding-dev',
  environment: 'dev',
  region: 'ap-northeast-1',
  version: '1.0.0',
  
  aws: {
    profile: 'dev'
  },
  
  bedrock: {
    region: 'us-east-1',
    modelId: 'amazon.nova-pro-v1:0',
    embeddingModel: {
      modelId: 'amazon.titan-embed-text-v2:0',
      dimensions: 256,
      maxTokens: 8192
    },
    textModel: {
      modelId: 'amazon.nova-pro-v1:0',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  
  vpc: {
    mode: 'existing',
    existing: {
      vpcId: 'vpc-dev123',
      privateSubnetIds: ['subnet-dev1', 'subnet-dev2']
    }
  },
  
  fsx: {
    mode: 'existing',
    existing: {
      fileSystemId: 'fs-dev123',
      volumePath: '/vol1',
      mountPoint: '/mnt/fsx'
    }
  },
  
  batch: {
    computeEnvironment: {
      maxvCpus: 64,
      minvCpus: 0,
      desiredvCpus: 0,
      instanceTypes: ['m5.large'],
      useSpotInstances: true,
      spotBidPercentage: 70
    },
    jobQueue: {
      priority: 1
    },
    jobDefinitions: {
      documentProcessing: {
        vcpus: 2,
        memoryMiB: 4096,
        timeoutSeconds: 3600,
        retryAttempts: 3
      },
      embeddingGeneration: {
        vcpus: 2,
        memoryMiB: 4096,
        timeoutSeconds: 3600,
        retryAttempts: 2
      },
      ragQueryProcessing: {
        vcpus: 2,
        memoryMiB: 4096,
        timeoutSeconds: 1800,
        retryAttempts: 3
      }
    }
  },
  
  storage: {
    s3: {
      enableVersioning: false,
      lifecycleRules: {
        transitionToIA: 30,
        transitionToGlacier: 90,
        deleteAfter: 180
      }
    },
    dynamodb: {
      billingMode: 'PAY_PER_REQUEST',
      enablePointInTimeRecovery: false
    }
  },
  
  monitoring: {
    cloudWatch: {
      logRetentionDays: 7,
      enableDetailedMonitoring: false
    },
    alerting: {
      enableAlerts: false,
      emailEndpoints: []
    },
    xray: {
      enableTracing: false,
      samplingRate: 0.1
    }
  },
  
  security: {
    network: {
      allowedCIDRs: ['10.0.0.0/8'],
      enableWAF: false
    },
    encryption: {
      enableKMSEncryption: false
    },
    compliance: {
      enableGuardDuty: false,
      enableCloudTrail: false,
      enableConfig: false
    }
  },
  
  costOptimization: {
    autoScaling: {
      scaleDownDelay: 300,
      scaleUpThreshold: 80
    },
    budgets: {
      monthlyBudgetUSD: 500,
      alertThreshold: 80
    },
    resourceTagging: {
      costCenter: 'Engineering',
      project: 'EmbeddingDev',
      owner: 'dev-team@company.com'
    }
  },
  
  development: {
    deployment: {
      deploymentTimeout: 3600,
      enableRollback: true
    },
    debugging: {
      enableDebugLogs: true,
      logLevel: 'DEBUG'
    },
    testing: {
      enableTestMode: true
    }
  },
  
  features: {
    enableDocumentProcessing: true,
    enableEmbeddingGeneration: true,
    enableRagQueryProcessing: true,
    enablePermissionFiltering: true
  },
  
  stackNaming: {
    regionPrefix: 'TokyoRegion',
    stackPrefix: 'embedding-dev',
    useAgentSteeringRules: true
  }
};
```

### 本番環境設定

```typescript
const prodConfig: DeploymentConfig = {
  projectName: 'embedding-prod',
  environment: 'prod',
  region: 'ap-northeast-1',
  version: '1.0.0',
  
  aws: {
    account: '123456789012',
    profile: 'production'
  },
  
  bedrock: {
    region: 'us-east-1',
    modelId: 'amazon.nova-pro-v1:0',
    embeddingModel: {
      modelId: 'amazon.titan-embed-text-v2:0',
      dimensions: 1024,
      maxTokens: 8192
    },
    textModel: {
      modelId: 'amazon.nova-pro-v1:0',
      temperature: 0.5,
      maxTokens: 4096
    }
  },
  
  vpc: {
    mode: 'existing',
    existing: {
      vpcId: 'vpc-prod123',
      privateSubnetIds: ['subnet-prod1', 'subnet-prod2', 'subnet-prod3']
    }
  },
  
  fsx: {
    mode: 'existing',
    existing: {
      fileSystemId: 'fs-prod123',
      volumePath: '/vol1',
      mountPoint: '/mnt/fsx'
    }
  },
  
  batch: {
    computeEnvironment: {
      maxvCpus: 256,
      minvCpus: 0,
      desiredvCpus: 0,
      instanceTypes: ['m5.xlarge', 'm5.2xlarge', 'm5.4xlarge'],
      useSpotInstances: true,
      spotBidPercentage: 70
    },
    jobQueue: {
      priority: 1
    },
    jobDefinitions: {
      documentProcessing: {
        vcpus: 4,
        memoryMiB: 8192,
        timeoutSeconds: 7200,
        retryAttempts: 3
      },
      embeddingGeneration: {
        vcpus: 8,
        memoryMiB: 16384,
        timeoutSeconds: 14400,
        retryAttempts: 2
      },
      ragQueryProcessing: {
        vcpus: 4,
        memoryMiB: 8192,
        timeoutSeconds: 3600,
        retryAttempts: 3
      }
    }
  },
  
  storage: {
    s3: {
      enableVersioning: true,
      lifecycleRules: {
        transitionToIA: 30,
        transitionToGlacier: 90,
        deleteAfter: 365
      }
    },
    dynamodb: {
      billingMode: 'PAY_PER_REQUEST',
      enablePointInTimeRecovery: true
    }
  },
  
  monitoring: {
    cloudWatch: {
      logRetentionDays: 90,
      enableDetailedMonitoring: true
    },
    alerting: {
      enableAlerts: true,
      emailEndpoints: ['ops-team@company.com'],
      slackWebhookUrl: 'https://hooks.slack.com/services/...'
    },
    xray: {
      enableTracing: true,
      samplingRate: 0.1
    }
  },
  
  security: {
    network: {
      allowedCIDRs: ['10.0.0.0/8', '172.16.0.0/12'],
      enableWAF: true
    },
    encryption: {
      enableKMSEncryption: true,
      kmsKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012'
    },
    compliance: {
      enableGuardDuty: true,
      enableCloudTrail: true,
      enableConfig: true
    }
  },
  
  costOptimization: {
    autoScaling: {
      scaleDownDelay: 300,
      scaleUpThreshold: 80
    },
    budgets: {
      monthlyBudgetUSD: 5000,
      alertThreshold: 80
    },
    resourceTagging: {
      costCenter: 'Production',
      project: 'EmbeddingProd',
      owner: 'ops-team@company.com'
    }
  },
  
  development: {
    deployment: {
      deploymentTimeout: 7200,
      enableRollback: true
    },
    debugging: {
      enableDebugLogs: false,
      logLevel: 'INFO'
    },
    testing: {
      enableTestMode: false
    }
  },
  
  features: {
    enableDocumentProcessing: true,
    enableEmbeddingGeneration: true,
    enableRagQueryProcessing: true,
    enablePermissionFiltering: true
  },
  
  stackNaming: {
    regionPrefix: 'TokyoRegion',
    stackPrefix: 'embedding-prod',
    useAgentSteeringRules: true
  }
};
```

---

## 🔗 関連ドキュメント

- [設定パラメータ完全リファレンス](./CONFIGURATION_PARAMETERS_REFERENCE.md)
- [CDK 設定ガイド](./CDK_CONFIGURATION_GUIDE.md)
- [使用例とベストプラクティス](./USAGE_EXAMPLES_BEST_PRACTICES.md)
- [エラーハンドリングガイド](./ERROR_HANDLING_GUIDE.md)

---

**最終更新**: 2025年11月9日  
**バージョン**: 2.0.0
