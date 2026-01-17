# 外部 Vector Database 統合ガイド

## 概要

このガイドでは、CDK スタック管理下にない外部の OpenSearch Serverless や Aurora PostgreSQL Serverless v2 (pgvector)との連携方法を説明します。

## 現在の実装状況

✅ **AWS Batch 実装済み**:

- AWS Batch ジョブでの OpenSearch Serverless 連携（部分実装）
- DynamoDB（メタデータ管理）
- S3（文書・埋め込みストレージ）
- FSx for NetApp ONTAP（ファイルシステム）

⚠️ **未実装**:

- Aurora PostgreSQL Serverless v2 (pgvector) 連携
- 完全な OpenSearch Serverless 設定

## 外部データベース連携の実装が必要な項目

### 1. OpenSearch / OpenSearch Serverless 連携

#### 必要な設定パラメーター

```json
{
  "externalDatabases": {
    "opensearch": {
      "enabled": true,
      "mode": "external",
      "endpoint": "https://search-your-domain.region.es.amazonaws.com",
      "indexName": "embeddings",
      "authentication": {
        "type": "iam" | "basic" | "cognito",
        "roleArn": "arn:aws:iam::account:role/OpenSearchAccessRole",
        "username": "optional-for-basic-auth",
        "password": "optional-for-basic-auth"
      },
      "ssl": {
        "enabled": true,
        "certificateValidation": true
      },
      "connectionPool": {
        "maxConnections": 10,
        "timeout": 30000
      }
    }
  }
}
```

#### 必要な実装

1. **Lambda 関数の更新**

   - OpenSearch JavaScript SDK の追加
   - 接続設定の環境変数対応
   - エラーハンドリングの実装

2. **IAM ロールの権限追加**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "es:ESHttpPost",
           "es:ESHttpPut",
           "es:ESHttpGet",
           "es:ESHttpDelete"
         ],
         "Resource": "arn:aws:es:region:account:domain/domain-name/*"
       }
     ]
   }
   ```

### 2. Aurora PostgreSQL Serverless v2 連携

#### 必要な設定パラメーター

```json
{
  "externalDatabases": {
    "aurora": {
      "enabled": true,
      "mode": "external",
      "clusterEndpoint": "cluster-name.cluster-xxxxx.region.rds.amazonaws.com",
      "readerEndpoint": "cluster-name.cluster-ro-xxxxx.region.rds.amazonaws.com",
      "port": 5432,
      "databaseName": "embeddings",
      "authentication": {
        "type": "iam" | "password" | "rds-proxy",
        "username": "embedding_user",
        "secretArn": "arn:aws:secretsmanager:region:account:secret:rds-db-credentials/cluster-xxxxx",
        "proxyEndpoint": "optional-rds-proxy-endpoint"
      },
      "ssl": {
        "enabled": true,
        "mode": "require"
      },
      "connectionPool": {
        "maxConnections": 20,
        "idleTimeout": 300000,
        "acquireTimeout": 60000
      },
      "vectorExtension": {
        "enabled": true,
        "extension": "pgvector",
        "dimensions": 1536
      }
    }
  }
}
```

#### 必要な実装

1. **Lambda 関数の更新**

   - PostgreSQL Node.js ドライバーの追加
   - pgvector 拡張のサポート
   - 接続プールの実装

2. **IAM ロールの権限追加**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["rds-db:connect"],
         "Resource": "arn:aws:rds-db:region:account:dbuser:cluster-id/embedding_user"
       },
       {
         "Effect": "Allow",
         "Action": ["secretsmanager:GetSecretValue"],
         "Resource": "arn:aws:secretsmanager:region:account:secret:rds-db-credentials/*"
       }
     ]
   }
   ```

## デプロイメント手順

### 1. 設定ファイルの作成

外部データベース用の設定ファイルを作成：

```bash
# 設定ファイルのコピー
cp examples/enterprise-config.json config/external-db-config.json

# 設定ファイルの編集
nano config/external-db-config.json
```

### 2. 必要な設定の追加

```json
{
  "projectName": "your-project-name",
  "environment": "prod",
  "region": "ap-northeast-1",

  "externalDatabases": {
    "opensearch": {
      "enabled": true,
      "mode": "external",
      "endpoint": "https://search-your-domain.ap-northeast-1.es.amazonaws.com",
      "indexName": "embeddings",
      "authentication": {
        "type": "iam",
        "roleArn": "arn:aws:iam::123456789012:role/OpenSearchAccessRole"
      }
    },
    "aurora": {
      "enabled": true,
      "mode": "external",
      "clusterEndpoint": "your-cluster.cluster-xxxxx.ap-northeast-1.rds.amazonaws.com",
      "port": 5432,
      "databaseName": "embeddings",
      "authentication": {
        "type": "iam",
        "username": "embedding_user"
      },
      "vectorExtension": {
        "enabled": true,
        "extension": "pgvector",
        "dimensions": 1536
      }
    }
  },

  "features": {
    "enableDocumentProcessing": true,
    "enableEmbeddingGeneration": true,
    "enableRagQueryProcessing": true,
    "enableExternalDatabaseIntegration": true
  }
}
```

### 3. 環境変数の設定

Lambda 関数で使用する環境変数：

```bash
# OpenSearch設定
OPENSEARCH_ENDPOINT=https://search-your-domain.region.es.amazonaws.com
OPENSEARCH_INDEX_NAME=embeddings
OPENSEARCH_AUTH_TYPE=iam

# Aurora PostgreSQL設定
AURORA_CLUSTER_ENDPOINT=your-cluster.cluster-xxxxx.region.rds.amazonaws.com
AURORA_DATABASE_NAME=embeddings
AURORA_USERNAME=embedding_user
AURORA_AUTH_TYPE=iam
AURORA_SSL_MODE=require
```

### 3. デプロイメント実行

```bash
# CDKを使用したデプロイメント
cd cdk
npm install
npm run build
cdk deploy --context configFile=../config/my-external-vector-db-config.json

# または統一デプロイスクリプトを使用
cd ..
./scripts/unified-deploy.sh --config config/my-external-vector-db-config.json
```

### 4. デプロイメント検証

```bash
# デプロイメント状況の確認
aws cloudformation describe-stacks --stack-name your-stack-name

# Vector Database接続テスト
./scripts/validate.sh --config config/my-external-vector-db-config.json
```

## ✅ 実装済み機能

### 1. 設定インターフェース拡張

- ✅ `cdk/lib/config/interfaces/deployment-config-interfaces.ts` - Vector Database 設定インターフェース
- ✅ `examples/external-vector-db-config.json` - 外部 Vector Database 設定例

### 2. CDK 構成の実装

- ✅ `cdk/lib/constructs/vector-database-integration.ts` - Vector Database 統合コンストラクト
- ✅ `cdk/lib/stacks/embedding-workload-stack.ts` - スタック統合

### 3. AWS Batch 統合

- ✅ 環境変数の自動設定
- ✅ IAM 権限の自動付与
- ✅ 外部リソース接続サポート

### 4. サポートされる Vector Database

- ✅ **OpenSearch Serverless** - 外部コレクション接続・新規作成
- ✅ **OpenSearch** - 外部ドメイン接続・新規作成
- ✅ **Aurora PostgreSQL Serverless v2** - 外部クラスター接続・新規作成・pgvector 拡張

## 🚀 使用方法

### 外部 OpenSearch Serverless 使用例

```json
{
  "vectorDatabases": {
    "opensearchServerless": {
      "enabled": true,
      "mode": "external",
      "external": {
        "collectionEndpoint": "https://xxxxx.ap-northeast-1.aoss.amazonaws.com",
        "collectionId": "your-collection-id",
        "indexName": "embeddings",
        "authentication": {
          "type": "iam"
        }
      }
    }
  }
}
```

### 外部 Aurora PostgreSQL 使用例

```json
{
  "vectorDatabases": {
    "aurora": {
      "enabled": true,
      "mode": "external",
      "external": {
        "clusterEndpoint": "cluster.xxxxx.ap-northeast-1.rds.amazonaws.com",
        "clusterIdentifier": "embedding-cluster",
        "port": 5432,
        "databaseName": "embeddings",
        "authentication": {
          "type": "iam",
          "username": "embedding_user"
        }
      },
      "vectorExtension": {
        "enabled": true,
        "extension": "pgvector",
        "dimensions": 1536,
        "tableName": "document_embeddings",
        "vectorColumn": "embedding_vector",
        "textColumn": "text_content",
        "metadataColumn": "metadata_json"
      }
    }
  }
}
```

## 📋 環境変数

AWS Batch ジョブで自動的に設定される環境変数：

### OpenSearch Serverless

- `OPENSEARCH_SERVERLESS_ENDPOINT`
- `OPENSEARCH_SERVERLESS_COLLECTION_ID`
- `OPENSEARCH_SERVERLESS_INDEX`

### Aurora PostgreSQL

- `AURORA_CLUSTER_ENDPOINT`
- `AURORA_READER_ENDPOINT`
- `AURORA_DATABASE_NAME`
- `VECTOR_EXTENSION`
- `VECTOR_DIMENSIONS`
- `VECTOR_TABLE_NAME`

## 🔒 セキュリティ

### 自動設定される IAM 権限

- OpenSearch Serverless: `aoss:APIAccessAll`
- OpenSearch: `es:ESHttpGet`, `es:ESHttpPost`, `es:ESHttpPut`
- Aurora PostgreSQL: `rds-db:connect`, `secretsmanager:GetSecretValue`

## 🎯 次のステップ

1. **Lambda 関数の更新**: Vector Database SDK の統合
2. **テスト実装**: 統合テストの作成
3. **監視設定**: CloudWatch メトリクスの追加
4. **ドキュメント拡充**: 運用ガイドの作成

## Lambda関数のVector Database統合

### Embedding Generator Lambda の拡張機能

Lambda関数にVector Database統合機能を追加しました。

#### 新機能

1. **Vector Database設定の動的取得**
   - 環境変数からVector Database設定を自動取得
   - OpenSearch Serverless、OpenSearch、Aurora PostgreSQL対応

2. **接続テスト機能**
   - 各Vector Databaseへの接続テスト
   - ヘルスチェックにVector Database状態を含める

3. **環境変数の自動注入**
   - AWS BatchジョブにVector Database環境変数を自動注入
   - 文書処理、埋め込み生成、RAGクエリ処理ジョブに対応

#### Vector Database統合API

```javascript
// Vector Database設定の取得
{
  "action": "get_vector_db_config"
}

// Vector Database接続テスト
{
  "action": "test_vector_db"
}

// ヘルスチェック（Vector Database含む）
{
  "action": "health_check"
}
```

#### 環境変数

Lambda関数は以下の環境変数を使用してVector Databaseに接続します：

##### OpenSearch Serverless
- `OPENSEARCH_SERVERLESS_ENDPOINT`: コレクションエンドポイント
- `OPENSEARCH_SERVERLESS_COLLECTION_ID`: コレクションID
- `OPENSEARCH_SERVERLESS_INDEX`: インデックス名（デフォルト: embeddings）

##### OpenSearch
- `OPENSEARCH_ENDPOINT`: ドメインエンドポイント
- `OPENSEARCH_INDEX`: インデックス名（デフォルト: embeddings）
- `OPENSEARCH_USERNAME`: ユーザー名（Basic認証の場合）
- `OPENSEARCH_PASSWORD`: パスワード（Basic認証の場合）

##### Aurora PostgreSQL
- `AURORA_CLUSTER_ENDPOINT`: クラスターエンドポイント
- `AURORA_DATABASE_NAME`: データベース名
- `AURORA_USERNAME`: ユーザー名
- `AURORA_PASSWORD`: パスワード
- `AURORA_PORT`: ポート番号（デフォルト: 5432）
- `AURORA_TABLE_NAME`: テーブル名（デフォルト: document_embeddings）
- `AURORA_VECTOR_COLUMN`: ベクトル列名（デフォルト: embedding_vector）
- `AURORA_TEXT_COLUMN`: テキスト列名（デフォルト: text_content）
- `AURORA_METADATA_COLUMN`: メタデータ列名（デフォルト: metadata_json）

## テスト手順

### 1. Vector Database統合テストの実行

```bash
# テストスクリプトの実行
./scripts/test-vector-db-integration.sh
```

### 2. Lambda関数の直接テスト

```bash
# Vector Database設定の確認
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"action": "get_vector_db_config"}' \
  response.json

# Vector Database接続テスト
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"action": "test_vector_db"}' \
  response.json

# ヘルスチェック
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"action": "health_check"}' \
  response.json
```

### 3. AWS Batchジョブの環境変数確認

```bash
# ジョブ定義の環境変数確認
aws batch describe-job-definitions \
  --job-definition-name EmbeddingGenerationJobDefinition \
  --status ACTIVE \
  --query 'jobDefinitions[0].containerProperties.environment'
```

## トラブルシューティング

### Vector Database接続エラー

1. **設定確認**
   ```bash
   # 設定ファイルの確認
   cat config/deployment-config.json | jq '.vectorDatabases'
   ```

2. **環境変数確認**
   ```bash
   # Lambda関数の環境変数確認
   aws lambda get-function-configuration \
     --function-name <function-name> \
     --query 'Environment.Variables'
   ```

3. **IAM権限確認**
   - OpenSearch Serverless: `aoss:APIAccessAll`
   - OpenSearch: `es:ESHttpGet`, `es:ESHttpPost`
   - Aurora PostgreSQL: `rds-db:connect`

### パフォーマンス最適化

1. **接続プール設定**
   - Aurora PostgreSQLの場合、接続プールを適切に設定
   - Lambda関数のタイムアウト値を調整

2. **バッチサイズ調整**
   - 大量データ処理時のバッチサイズを最適化
   - メモリ使用量の監視

3. **並行実行制御**
   - Lambda関数の同時実行数制限
   - Vector Databaseの接続数制限を考慮