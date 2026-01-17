# Amazon Bedrock Knowledge Base 実装ガイド

**最終更新**: 2024-11-23  
**対象**: Bedrock Knowledge Base + RAGアプリケーション統合

## 目次

1. [概要](#概要)
2. [ベクトルストアの選択](#ベクトルストアの選択)
3. [OpenSearch Serverless実装](#opensearch-serverless実装)
4. [S3 Vectors実装](#s3-vectors実装)
5. [Knowledge Base設定](#knowledge-base設定)
6. [RAGアプリケーション統合](#ragアプリケーション統合)
7. [ベストプラクティス](#ベストプラクティス)

---

## 概要

Amazon Bedrock Knowledge Baseは、RAG（Retrieval-Augmented Generation）アプリケーションを構築するためのマネージドサービスです。

### 主な機能

- **自動ベクトル化**: ドキュメントを自動的にEmbeddingに変換
- **ベクトル検索**: 高速な類似度検索
- **マルチソース対応**: S3、Confluence、SharePoint等に対応
- **セキュリティ**: IAM、VPC、暗号化による保護

### アーキテクチャパターン

```
┌─────────────────┐
│  Data Sources   │
│  - S3           │
│  - FSx ONTAP    │
│  - Confluence   │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Bedrock Knowledge Base         │
│  ┌───────────────────────────┐  │
│  │  Embedding Model          │  │
│  │  - Titan Embed Text V2    │  │
│  │  - Cohere Embed           │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  Vector Store             │  │
│  │  - OpenSearch Serverless  │  │
│  │  - S3 Vectors (Preview)   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         ↓
┌─────────────────┐
│  RAG App        │
│  - Bedrock Agent│
│  - Lambda       │
│  - Next.js      │
└─────────────────┘
```

---

## ベクトルストアの選択

### OpenSearch Serverless vs S3 Vectors

| 特徴 | OpenSearch Serverless | S3 Vectors (Preview) |
|------|----------------------|---------------------|
| **コスト** | 中〜高（$0.24/OCU/時間） | 低（最大90%削減） |
| **クエリレイテンシ** | ミリ秒単位 | サブ秒単位 |
| **スケーラビリティ** | 高（自動スケール） | 非常に高 |
| **管理の複雑さ** | 中（インデックス管理） | 低（フルマネージド） |
| **本番環境対応** | GA | Preview |
| **最大ベクトル数** | 数千万件 | 数億件以上 |

### 選択ガイド

#### OpenSearch Serverlessを選択する場合

✅ **推奨シナリオ**:
- ミリ秒単位のクエリレイテンシが必要
- 複雑な検索クエリ（フィルタ、集計）が必要
- 本番環境で実績のある技術を使用したい
- リアルタイム検索が重要

❌ **非推奨シナリオ**:
- コスト最適化が最優先
- 数億件以上のベクトルデータ
- シンプルな類似度検索のみ

#### S3 Vectorsを選択する場合

✅ **推奨シナリオ**:
- コスト最適化が最優先
- 大規模なベクトルデータセット（数億件以上）
- サブ秒のレイテンシで十分
- FSx for ONTAPとの統合が必要

❌ **非推奨シナリオ**:
- ミリ秒単位のレイテンシが必要
- 複雑な検索クエリが必要
- Preview機能の使用が許容されない

---

## OpenSearch Serverless実装

### CDK実装

```typescript
import * as cdk from 'aws-cdk-lib';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';

export class OpenSearchServerlessStack extends cdk.Stack {
  public readonly collectionEndpoint: string;
  public readonly collectionArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // セキュリティポリシー
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'EncryptionPolicy',
      {
        name: 'kb-encryption-policy',
        type: 'encryption',
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: 'collection',
              Resource: ['collection/kb-collection'],
            },
          ],
          AWSOwnedKey: true,
        }),
      }
    );

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'NetworkPolicy',
      {
        name: 'kb-network-policy',
        type: 'network',
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: 'collection',
                Resource: ['collection/kb-collection'],
              },
            ],
            AllowFromPublic: true,
          },
        ]),
      }
    );

    // コレクション作成
    const collection = new opensearchserverless.CfnCollection(
      this,
      'Collection',
      {
        name: 'kb-collection',
        type: 'VECTORSEARCH',
        description: 'Knowledge Base vector collection',
      }
    );

    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);

    // データアクセスポリシー
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(
      this,
      'DataAccessPolicy',
      {
        name: 'kb-data-access-policy',
        type: 'data',
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: 'collection',
                Resource: [`collection/${collection.name}`],
                Permission: [
                  'aoss:CreateCollectionItems',
                  'aoss:UpdateCollectionItems',
                  'aoss:DescribeCollectionItems',
                ],
              },
              {
                ResourceType: 'index',
                Resource: [`index/${collection.name}/*`],
                Permission: [
                  'aoss:CreateIndex',
                  'aoss:UpdateIndex',
                  'aoss:DescribeIndex',
                  'aoss:ReadDocument',
                  'aoss:WriteDocument',
                ],
              },
            ],
            Principal: [
              `arn:aws:iam::${this.account}:role/BedrockKnowledgeBaseRole`,
            ],
          },
        ]),
      }
    );

    this.collectionEndpoint = collection.attrCollectionEndpoint;
    this.collectionArn = collection.attrArn;

    // Outputs
    new cdk.CfnOutput(this, 'CollectionEndpoint', {
      value: this.collectionEndpoint,
      exportName: 'OpenSearch-CollectionEndpoint',
    });
  }
}
```

### インデックス作成

```python
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
import boto3

# AWS認証
credentials = boto3.Session().get_credentials()
awsauth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    'us-east-1',
    'aoss',
    session_token=credentials.token
)

# OpenSearchクライアント
client = OpenSearch(
    hosts=[{'host': 'xxxxx.us-east-1.aoss.amazonaws.com', 'port': 443}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection
)

# インデックス作成
index_body = {
    "settings": {
        "index.knn": True
    },
    "mappings": {
        "properties": {
            "vector": {
                "type": "knn_vector",
                "dimension": 1024,
                "method": {
                    "name": "hnsw",
                    "space_type": "cosinesimil",
                    "engine": "faiss"
                }
            },
            "text": {"type": "text"},
            "metadata": {"type": "object"}
        }
    }
}

client.indices.create(index='bedrock-kb-index', body=index_body)
```

---

## S3 Vectors実装

### CDK実装

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';

export class S3VectorsStack extends cdk.Stack {
  public readonly vectorBucketArn: string;
  public readonly indexName: string;

  constructor(scope: Construct, id: string, props: S3VectorsStackProps) {
    super(scope, id, props);

    // Custom Resource Lambda
    const s3VectorsHandler = new lambda.Function(this, 'S3VectorsHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/s3-vectors-handler'),
      timeout: cdk.Duration.minutes(5),
    });

    // IAM権限
    s3VectorsHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3vectors:CreateVectorBucket',
        's3vectors:CreateVectorIndex',
        's3vectors:DeleteVectorBucket',
        's3vectors:DeleteVectorIndex',
        's3vectors:DescribeVectorBucket',
        's3vectors:DescribeVectorIndex',
      ],
      resources: ['*'],
    }));

    // Custom Resource
    const s3VectorsProvider = new cr.Provider(this, 'S3VectorsProvider', {
      onEventHandler: s3VectorsHandler,
    });

    const vectorBucket = new cdk.CustomResource(this, 'VectorBucket', {
      serviceToken: s3VectorsProvider.serviceToken,
      properties: {
        BucketName: props.vectorBucketName,
        Region: this.region,
      },
    });

    const vectorIndex = new cdk.CustomResource(this, 'VectorIndex', {
      serviceToken: s3VectorsProvider.serviceToken,
      properties: {
        BucketName: props.vectorBucketName,
        IndexName: props.indexName,
        Dimension: 1024,
        DistanceMetric: 'cosine',
      },
    });

    vectorIndex.node.addDependency(vectorBucket);

    this.vectorBucketArn = vectorBucket.getAttString('BucketArn');
    this.indexName = props.indexName;

    // Outputs
    new cdk.CfnOutput(this, 'VectorBucketArn', {
      value: this.vectorBucketArn,
      exportName: 'S3Vectors-BucketArn',
    });
  }
}
```

### Lambda Handler実装

```python
import boto3
import json

s3vectors = boto3.client('s3vectors')

def handler(event, context):
    request_type = event['RequestType']
    props = event['ResourceProperties']
    
    try:
        if request_type == 'Create':
            return create_resources(props)
        elif request_type == 'Update':
            return update_resources(props)
        elif request_type == 'Delete':
            return delete_resources(props)
    except Exception as e:
        print(f"Error: {str(e)}")
        raise

def create_resources(props):
    bucket_name = props['BucketName']
    
    # Vector Bucket作成
    response = s3vectors.create_vector_bucket(
        BucketName=bucket_name,
        Region=props['Region']
    )
    
    # Vector Index作成
    if 'IndexName' in props:
        s3vectors.create_vector_index(
            BucketName=bucket_name,
            IndexName=props['IndexName'],
            Dimension=int(props['Dimension']),
            DistanceMetric=props['DistanceMetric']
        )
    
    return {
        'PhysicalResourceId': bucket_name,
        'Data': {
            'BucketArn': response['BucketArn']
        }
    }

def delete_resources(props):
    bucket_name = props['BucketName']
    
    # Vector Index削除
    if 'IndexName' in props:
        try:
            s3vectors.delete_vector_index(
                BucketName=bucket_name,
                IndexName=props['IndexName']
            )
        except:
            pass
    
    # Vector Bucket削除
    try:
        s3vectors.delete_vector_bucket(BucketName=bucket_name)
    except:
        pass
    
    return {'PhysicalResourceId': bucket_name}
```

---

## Knowledge Base設定

### DataStackでの統合

```typescript
import { VectorStoreConfig, DEFAULT_VECTOR_STORE_CONFIG } from '../config/vector-store-config';

export interface DataStackConfig {
  readonly storage: StorageConfig;
  readonly database: DatabaseConfig;
  readonly vectorStore?: VectorStoreConfig;
}

export class DataStack extends cdk.Stack {
  public readonly knowledgeBaseId?: string;
  public readonly vectorStoreInfo?: {
    readonly type: 'OPENSEARCH_SERVERLESS' | 'S3_VECTORS';
    readonly endpoint?: string;
    readonly vectorBucketArn?: string;
  };

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // ベクトルストア設定（デフォルト: OpenSearch Serverless）
    const vectorStoreConfig = props.config.vectorStore || DEFAULT_VECTOR_STORE_CONFIG;

    if (vectorStoreConfig.type === 'OPENSEARCH_SERVERLESS') {
      this.createOpenSearchServerless(vectorStoreConfig);
    } else if (vectorStoreConfig.type === 'S3_VECTORS') {
      this.createS3Vectors(vectorStoreConfig);
    }
  }

  private createOpenSearchServerless(config: VectorStoreConfig): void {
    // OpenSearch Serverless実装
  }

  private createS3Vectors(config: VectorStoreConfig): void {
    // S3 Vectors実装
  }
}
```

### 使用例

```typescript
// OpenSearch Serverless（デフォルト）
const dataStack = new DataStack(app, 'DataStack', {
  config: {
    storage: storageConfig,
    database: databaseConfig,
    // vectorStoreは省略可能（デフォルト: OpenSearch Serverless）
  },
  projectName: 'my-rag-app',
  environment: 'prod',
});

// S3 Vectors
const dataStack = new DataStack(app, 'DataStack', {
  config: {
    storage: storageConfig,
    database: databaseConfig,
    vectorStore: {
      type: 'S3_VECTORS',
      s3Vectors: {
        vectorBucketName: 'my-vector-bucket',
        indexName: 'my-index',
        dimension: 1024,
        distanceMetric: 'cosine',
      },
    },
  },
  projectName: 'my-rag-app',
  environment: 'prod',
});
```

---

## RAGアプリケーション統合

### Lambda関数での使用

```typescript
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const client = new BedrockAgentRuntimeClient({ region: 'us-east-1' });

export const handler = async (event: any) => {
  const query = event.query;
  const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;

  // Knowledge Base検索
  const command = new RetrieveCommand({
    knowledgeBaseId,
    retrievalQuery: {
      text: query,
    },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: 5,
      },
    },
  });

  const response = await client.send(command);

  // 検索結果を処理
  const results = response.retrievalResults?.map(result => ({
    content: result.content?.text,
    score: result.score,
    metadata: result.metadata,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ results }),
  };
};
```

---

## ベストプラクティス

### セキュリティ

1. **IAMロール最小権限**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "bedrock:Retrieve",
           "bedrock:RetrieveAndGenerate"
         ],
         "Resource": "arn:aws:bedrock:*:*:knowledge-base/*"
       }
     ]
   }
   ```

2. **VPCエンドポイント使用**
   - Bedrockへのアクセスをプライベートネットワーク経由に

3. **暗号化**
   - ベクトルデータの暗号化（KMS）
   - 転送中の暗号化（TLS 1.2+）

### パフォーマンス

1. **チャンクサイズ最適化**
   - 推奨: 300-500トークン/チャンク
   - オーバーラップ: 50-100トークン

2. **検索結果数**
   - Top K: 3-10件推奨
   - 類似度閾値: 0.7以上

3. **キャッシング**
   - 頻繁なクエリ結果をキャッシュ
   - TTL: 5-15分

### コスト最適化

1. **Embedding料金**
   - Titan Embed Text V2: $0.0001/1000トークン
   - Cohere Embed: $0.0001/1000トークン

2. **ベクトルストア料金**
   - OpenSearch Serverless: $0.24/OCU/時間
   - S3 Vectors: ストレージ + API料金

3. **最適化戦略**
   - 不要なドキュメントの削除
   - インデックスの定期的な最適化
   - 適切なベクトルストアの選択

---

**最終更新**: 2024-11-23  
**メンテナ**: AWS Solutions Architecture Team
