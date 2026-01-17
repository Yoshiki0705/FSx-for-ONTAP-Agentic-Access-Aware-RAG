# 🧩 モジュール開発ガイド

> **対象**: 新機能開発者、モジュール拡張担当者  
> **最終更新**: 2025年11月16日

---

## 📚 目次

<details>
<summary><strong>1. モジュラーアーキテクチャの理解</strong></summary>

- [1.1 モジュラーアーキテクチャとは](#11-モジュラーアーキテクチャとは)
- [1.2 10個のコアモジュール](#12-10個のコアモジュール)
- [1.3 モジュール間の依存関係](#13-モジュール間の依存関係)

</details>

<details>
<summary><strong>2. モジュール別開発ガイド</strong></summary>

- [2.1 Networkingモジュール](#21-networkingモジュール)
- [2.2 Securityモジュール](#22-securityモジュール)
- [2.3 Storageモジュール](#23-storageモジュール)
- [2.4 Databaseモジュール](#24-databaseモジュール)
- [2.5 Computeモジュール](#25-computeモジュール)
- [2.6 Embeddingモジュール](#26-embeddingモジュール)
- [2.7 AIモジュール](#27-aiモジュール)
- [2.8 APIモジュール](#28-apiモジュール)
- [2.9 Monitoringモジュール](#29-monitoringモジュール)
- [2.10 Enterpriseモジュール](#210-enterpriseモジュール)

</details>

<details>
<summary><strong>3. 新規モジュール作成</strong></summary>

- [3.1 モジュール作成手順](#31-モジュール作成手順)
- [3.2 インターフェース設計](#32-インターフェース設計)
- [3.3 Construct実装](#33-construct実装)
- [3.4 テスト作成](#34-テスト作成)

</details>

---

## 1. モジュラーアーキテクチャの理解

### 1.1 モジュラーアーキテクチャとは

モジュラーアーキテクチャは、システムを独立した機能単位（モジュール）に分割する設計手法です。

**利点**:
- **保守性**: 各モジュールが独立しているため、変更の影響範囲が限定的
- **再利用性**: モジュールを他のプロジェクトでも利用可能
- **テスト容易性**: モジュール単位でのテストが可能
- **並行開発**: 複数チームが異なるモジュールを同時開発可能

**原則**:
- **単一責任**: 各モジュールは1つの明確な責任を持つ
- **疎結合**: モジュール間の依存を最小限に
- **高凝集**: 関連する機能を1つのモジュールにまとめる

### 1.2 9つのコアモジュール

```
lib/modules/
├── 1. networking/      # ネットワーク基盤
├── 2. security/        # セキュリティ設定
├── 3. storage/         # ストレージ管理（S3、FSx、バックアップ）
├── 4. database/        # データベース管理
├── 5. compute/         # コンピュートリソース
├── 6. ai/              # AI・機械学習
├── 7. api/             # API・認証
├── 8. monitoring/      # 監視・ログ
└── 9. enterprise/      # エンタープライズ機能
```

#### 1. Networkingモジュール

**責任**: VPC、サブネット、ゲートウェイ、セキュリティグループの管理

**主要コンポーネント**:
- VPC Construct
- Subnet Construct
- Gateway Construct
- Security Group Construct

**使用例**:
```typescript
import { VpcConstruct } from './modules/networking/constructs/vpc-construct';

const vpc = new VpcConstruct(this, 'VPC', {
  cidr: '10.0.0.0/16',
  maxAzs: 2,
  natGateways: 1
});
```

#### 2. Securityモジュール

**責任**: IAM、KMS、WAF、GuardDutyの管理

**主要コンポーネント**:
- IAM Role Construct
- KMS Key Construct
- WAF WebACL Construct
- GuardDuty Detector Construct

**使用例**:
```typescript
import { KmsKeyConstruct } from './modules/security/constructs/kms-key-construct';

const kmsKey = new KmsKeyConstruct(this, 'EncryptionKey', {
  enableKeyRotation: true,
  description: 'RAGシステム用暗号化キー'
});
```

#### 3. Storageモジュール

**責任**: S3、FSx、バックアップの管理

**主要コンポーネント**:
- S3 Bucket Construct
- FSx File System Construct
- Backup Construct

**使用例**:
```typescript
import { S3BucketConstruct } from './modules/storage/constructs/s3-bucket-construct';

const bucket = new S3BucketConstruct(this, 'DocumentBucket', {
  bucketName: 'rag-documents',
  encryption: s3.BucketEncryption.KMS,
  versioned: true
});
```

#### 4. Databaseモジュール

**責任**: DynamoDB、OpenSearch、RDSの管理

**主要コンポーネント**:
- DynamoDB Table Construct
- OpenSearch Domain Construct
- RDS Instance Construct

**使用例**:
```typescript
import { DynamoDbTableConstruct } from './modules/database/constructs/dynamodb-table-construct';

const table = new DynamoDbTableConstruct(this, 'SessionTable', {
  tableName: 'rag-sessions',
  partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
});
```

#### 5. Computeモジュール

**責任**: Lambda、Batch、ECSの管理

**主要コンポーネント**:
- Lambda Function Construct
- Batch Job Definition Construct
- ECS Service Construct

**使用例**:
```typescript
import { LambdaFunctionConstruct } from './modules/compute/constructs/lambda-function-construct';

const lambdaFunction = new LambdaFunctionConstruct(this, 'ApiFunction', {
  functionName: 'rag-api-handler',
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/api')
});
```

#### 6. AIモジュール

**責任**: Bedrock、Embedding、モデル管理

**主要コンポーネント**:
- Bedrock Model Construct
- Embedding Pipeline Construct
- Model Registry Construct

**使用例**:
```typescript
import { BedrockModelConstruct } from './modules/ai/constructs/bedrock-model-construct';

const bedrockModel = new BedrockModelConstruct(this, 'NovaProModel', {
  modelId: 'amazon.nova-pro-v1:0',
  region: 'ap-northeast-1'
});
```

#### 7. APIモジュール

**責任**: API Gateway、Cognito、CloudFrontの管理

**主要コンポーネント**:
- API Gateway Construct
- Cognito User Pool Construct
- CloudFront Distribution Construct

**使用例**:
```typescript
import { ApiGatewayConstruct } from './modules/api/constructs/api-gateway-construct';

const api = new ApiGatewayConstruct(this, 'RestApi', {
  apiName: 'rag-api',
  deployOptions: {
    stageName: 'prod'
  }
});
```

#### 8. 