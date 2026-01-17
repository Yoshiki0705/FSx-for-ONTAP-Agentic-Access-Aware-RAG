# FSx for NetApp ONTAP S3統合完全ガイド

**最終更新**: 2026年1月18日  
**バージョン**: 2.0  
**対象**: FSx for NetApp ONTAP S3 Access Points + AWS統合

---

## 目次

1. [概要](#1-概要)
2. [前提条件](#2-前提条件)
3. [アーキテクチャ](#3-アーキテクチャ)
4. [セットアップ手順](#4-セットアップ手順)
5. [Bedrock Knowledge Base統合](#5-bedrock-knowledge-base統合)
6. [CDK/CloudFormation実装](#6-cdkcloudformation実装)
7. [連携可能なAWSサービス](#7-連携可能なawsサービス)
8. [セキュリティ・認証モデル](#8-セキュリティ認証モデル)
9. [パフォーマンス特性](#9-パフォーマンス特性)
10. [コスト構造](#10-コスト構造)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [ベストプラクティス](#12-ベストプラクティス)

---

## 1. 概要

### 1.1 主な機能

Amazon FSx for NetApp ONTAPのS3 Access Points機能により、ファイルデータをS3互換APIで公開できます。

**主要な特徴**:
- **データ移動不要**: ファイルデータはFSx for ONTAP上に保持したまま、S3 APIでアクセス可能
- **デュアルプロトコル対応**: NFS/SMBとS3 APIの同時アクセスをサポート
- **低レイテンシ**: 数十ミリ秒のレイテンシでS3バケットと同等のパフォーマンス
- **デュアル認証モデル**: IAMポリシーとファイルシステムレベルの権限を組み合わせた認証
- **VPC制限**: VPCからのみアクセスを受け付ける設定が可能
- **Block Public Access**: デフォルトで有効（変更不可）
- **完全なIaC対応**: CDK/CloudFormationによる自動化

### 1.2 ユースケース

- 既存のNetApp ONTAPストレージをRAGシステムに統合
- オンプレミスデータをクラウドRAGに接続
- コスト効率の高いベクトル検索（OpenSearch Serverlessと比較して最大90%削減）
- AI/ML/分析サービスとの統合（データ移動なし）
- エンタープライズデータのガバナンス管理

### 1.3 対応リージョン（26リージョン）

#### アジア太平洋（10リージョン）
- ap-northeast-1 (東京) 🇯🇵
- ap-northeast-2 (ソウル) 🇰🇷
- ap-northeast-3 (大阪) 🇯🇵
- ap-south-1 (ムンバイ) 🇮🇳
- ap-south-2 (ハイデラバード) 🇮🇳
- ap-southeast-1 (シンガポール) 🇸🇬
- ap-southeast-2 (シドニー) 🇦🇺
- ap-southeast-3 (ジャカルタ) 🇮🇩
- ap-southeast-4 (メルボルン) 🇦🇺
- ap-east-1 (香港) 🇭🇰

#### 北米（6リージョン）
- us-east-1 (バージニア) 🇺🇸
- us-east-2 (オハイオ) 🇺🇸
- us-west-1 (北カリフォルニア) 🇺🇸
- us-west-2 (オレゴン) 🇺🇸
- ca-central-1 (カナダ中部) 🇨🇦
- ca-west-1 (カルガリー) 🇨🇦


#### ヨーロッパ（8リージョン）
- eu-west-1 (アイルランド) 🇮🇪
- eu-west-2 (ロンドン) 🇬🇧
- eu-west-3 (パリ) 🇫🇷
- eu-central-1 (フランクフルト) 🇩🇪
- eu-north-1 (ストックホルム) 🇸🇪
- eu-south-1 (ミラノ) 🇮🇹
- eu-south-2 (スペイン) 🇪🇸
- eu-central-2 (チューリッヒ) 🇨🇭

#### 中東・アフリカ（4リージョン）
- me-south-1 (バーレーン) 🇧🇭
- me-central-1 (UAE) 🇦🇪
- il-central-1 (テルアビブ) 🇮🇱
- af-south-1 (ケープタウン) 🇿🇦

#### 南米（1リージョン）
- sa-east-1 (サンパウロ) 🇧🇷

---

## 2. 前提条件

### 2.1 必須リソース

1. **FSx for NetApp ONTAPファイルシステム**
   - デプロイメントタイプ: Multi-AZ推奨
   - ONTAPバージョン: 9.13.1以降（S3 Access Points対応）
   - ストレージ容量: 最小1024 GiB

2. **AWS環境**
   - リージョン: 26リージョンで利用可能
   - VPC: FSx用のプライベートサブネット
   - IAMロール: 適切な権限設定

3. **開発環境**
   - AWS CLI v2
   - Node.js 20+
   - AWS CDK v2
   - TypeScript 5.3+

### 2.2 Private Beta登録（S3 Vectors使用時）

S3 Vectors機能はPrivate Betaです。以下の手順で登録してください：

1. AWSサポートケースを作成
2. 件名: "Request access to S3 Vectors Private Beta"
3. 本文に以下を記載：
   - AWSアカウントID
   - 使用予定のリージョン
   - ユースケースの説明

承認まで通常1-2営業日かかります。

---

## 3. アーキテクチャ

### 3.1 システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                    FSx for NetApp ONTAP                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SVM (Storage Virtual Machine)                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Volume: vol1                                  │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │  S3 Access Point                         │  │  │   │
│  │  │  │  Alias: s3ap-vol1-xxxxx-ext-s3alias     │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ S3 API
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Amazon Bedrock Knowledge Base                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vector Store: S3 Vectors (Preview)                  │   │
│  │  - Vector Bucket: fsx-ontap-kb-vectors              │   │
│  │  - Index: fsx-ontap-index                           │   │
│  │  - Dimension: 1024 (Titan Embed Text V2)           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Data Source: FSx S3 Access Point                    │   │
│  │  - S3 URI: s3://s3ap-vol1-xxxxx-ext-s3alias/        │   │
│  │  - Inclusion Prefixes: test-data/documents/         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Bedrock API
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    RAG Application                           │
│  - Next.js Frontend                                          │
│  - Lambda Backend                                            │
│  - Bedrock Agent/Runtime                                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 データフロー

1. **ドキュメント保存**: FSx ONTAPボリュームにドキュメントを保存
2. **S3 API経由アクセス**: S3 Access Point経由でドキュメントにアクセス
3. **Embedding生成**: Bedrock Titan Embed Text V2でベクトル化
4. **ベクトル保存**: S3 Vectorsに保存
5. **RAG検索**: ユーザークエリに対してベクトル検索を実行

---

## 4. セットアップ手順

### Phase 1: FSx for ONTAP S3 Access Points作成

#### 4.1 設定ファイルの準備

```bash
# テンプレートをコピー
cp development/configs/fsx-s3-access-points-config.env.template \
   development/configs/fsx-s3-access-points-config.env

# 設定ファイルを編集
vim development/configs/fsx-s3-access-points-config.env
```

**設定例**:

```bash
# FSx for ONTAP設定
FSX_FILESYSTEM_ID="fs-0123456789abcdef0"
FSX_SVM_ID="svm-0123456789abcdef0"
FSX_VOLUME_NAME="vol1"
FSX_JUNCTION_PATH="/vol1"

# S3 Access Point設定
S3_ACCESS_POINT_NAME="s3ap-vol1"
S3_BUCKET_POLICY_ENABLED="true"

# リージョン設定
AWS_REGION="us-east-1"
```

#### 4.2 S3 Access Point作成

```bash
# セットアップスクリプト実行
bash development/scripts/fsx-s3-access-points/setup-fsx-s3-access-points.sh

# 実行結果確認
# ✓ S3 Access Point作成完了
# ✓ Alias: s3ap-vol1-xxxxx-ext-s3alias
```

#### 4.3 動作確認

```bash
# S3 Access Point経由でファイル一覧取得
aws s3 ls s3://s3ap-vol1-xxxxx-ext-s3alias/ --region us-east-1

# テストファイルアップロード
echo "Test document" > test.txt
aws s3 cp test.txt s3://s3ap-vol1-xxxxx-ext-s3alias/test-data/documents/ \
  --region us-east-1

# ファイル確認
aws s3 ls s3://s3ap-vol1-xxxxx-ext-s3alias/test-data/documents/ \
  --region us-east-1
```

### Phase 2: テストデータ準備

```bash
# テストドキュメント作成スクリプト実行
bash development/scripts/fsx-ontap-integration/prepare-test-data-s3-only.sh

# 作成されるドキュメント:
# - test-data/documents/product-catalog.txt
# - test-data/documents/user-manual.txt
# - test-data/documents/faq.txt
```

---

## 5. Bedrock Knowledge Base統合

### Phase 3: S3 Vectors Knowledge Base作成

#### 5.1 AWS CLI経由での作成

```bash
# Knowledge Base作成スクリプト実行
bash development/scripts/fsx-ontap-integration/create-kb-s3-vectors.sh

# 実行内容:
# 1. S3 Vector Bucket作成
# 2. Vector Index作成
# 3. IAMロール作成
# 4. Knowledge Base作成
# 5. Data Source作成
```

#### 5.2 作成されるリソース

| リソース | 名前/ID | 説明 |
|---------|---------|------|
| S3 Vector Bucket | `{projectName}-{environment}-kb-vectors` | ベクトルデータ保存用 |
| Vector Index | `{projectName}-{environment}-index` | ベクトル検索インデックス |
| Knowledge Base | `KB-XXXXXXXXXX` | RAG用Knowledge Base |
| Data Source | `DS-XXXXXXXXXX` | FSx S3 Access Point接続 |
| IAM Role | CDK自動生成名 | 実行ロール（重複を防ぐため自動生成） |

#### 5.3 Ingestion Job実行

```bash
# データソース同期
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id KB-XXXXXXXXXX \
  --data-source-id DS-XXXXXXXXXX \
  --region us-east-1

# ジョブステータス確認
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id KB-XXXXXXXXXX \
  --data-source-id DS-XXXXXXXXXX \
  --ingestion-job-id IJ-XXXXXXXXXX \
  --region us-east-1
```

### Phase 4: 動作確認

```bash
# Knowledge Base検索テスト
bash development/scripts/fsx-ontap-integration/test-bedrock-integration.sh

# 期待される結果:
# ✓ Knowledge Base検索成功
# ✓ 関連ドキュメント取得
# ✓ 回答生成成功
```


---

## 6. CDK/CloudFormation実装

### Phase 5: IaC化

#### 6.1 S3 Vectors CDKスタック

**ファイル**: `lib/stacks/integrated/bedrock-kb-s3-vectors-stack.ts`

**主な特徴**:
- **動的命名**: プロジェクト名と環境を含む動的な命名により、重複を防止
- **IAMロール自動生成**: `roleName`を指定せず、CDKに自動生成させることで重複エラーを回避
- **環境変数対応**: `PROJECT_NAME`と`ENVIRONMENT`環境変数でリソース名をカスタマイズ可能

**リソース命名規則**:
```typescript
// プロジェクト名と環境を含む動的な命名（重複を防ぐため）
const projectName = process.env.PROJECT_NAME || 'permission-aware-rag';
const environment = process.env.ENVIRONMENT || 'prod';
const vectorBucketName = `${projectName}-${environment}-kb-vectors`;
const indexName = `${projectName}-${environment}-index`;
```

**IAMロール作成（自動生成）**:
```typescript
// IAMロール（Knowledge Base実行用）
const kbExecutionRole = new iam.Role(this, 'KBExecutionRole', {
  // roleName を削除してCDKに自動生成させる（重複を防ぐため）
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  description: 'Bedrock Knowledge Base実行ロール（S3 Vectors + FSx for ONTAP S3 Access Point）',
});

// S3 Vectors権限
kbExecutionRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3vectors:QueryVectors',
      's3vectors:PutVectors',
      's3vectors:GetVectors',
      's3vectors:DeleteVectors',
      's3vectors:ListVectors',
    ],
    resources: [vectorBucketArn, indexArn],
  })
);

// FSx for ONTAP S3 Access Pointへのアクセス権限
kbExecutionRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:GetObject', 's3:ListBucket'],
    resources: [
      `arn:aws:s3:::${s3AccessPointAlias}`,
      `arn:aws:s3:::${s3AccessPointAlias}/*`,
      `arn:aws:s3:${region}:${accountId}:accesspoint/s3ap-vol1`,
      `arn:aws:s3:${region}:${accountId}:accesspoint/s3ap-vol1/*`,
    ],
  })
);
```

**重要な改善点**:
1. **重複防止**: IAMロール名を自動生成することで、複数環境での重複エラーを回避
2. **環境分離**: プロジェクト名と環境を含む命名により、複数環境の並行運用が可能
3. **柔軟性**: 環境変数でリソース名をカスタマイズ可能

#### 6.2 DataStackへの統合

**ファイル**: `lib/stacks/integrated/data-stack.ts`

```typescript
import { VectorStoreConfig } from '../config/vector-store-config';
import { BedrockKnowledgeBaseS3VectorsStack } from './bedrock-kb-s3-vectors-stack';

export interface DataStackConfig {
  readonly storage: StorageConfig;
  readonly database: DatabaseConfig;
  readonly vectorStore?: VectorStoreConfig; // 新規追加
}

export class DataStack extends cdk.Stack {
  public readonly vectorStoreInfo?: {
    readonly type: 'OPENSEARCH_SERVERLESS' | 'S3_VECTORS';
    readonly endpoint?: string;
    readonly vectorBucketArn?: string;
    readonly knowledgeBaseId?: string;
  };

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // ベクトルストア作成
    if (props.config.vectorStore) {
      this.createVectorStore(props.config.vectorStore);
    }
  }

  private createVectorStore(config: VectorStoreConfig): void {
    if (config.type === 'S3_VECTORS' && config.s3Vectors) {
      // S3 Vectors Knowledge Base作成
      const s3VectorsStack = new BedrockKnowledgeBaseS3VectorsStack(
        this,
        'S3VectorsKB',
        {
          vectorBucketName: config.s3Vectors.vectorBucketName,
          indexName: config.s3Vectors.indexName,
          knowledgeBaseName: `${this.projectName}-kb`,
          dataSourceS3Uri: config.fsxS3AccessPoint?.accessPointAlias || '',
          inclusionPrefixes: config.fsxS3AccessPoint?.inclusionPrefixes,
        }
      );

      this.vectorStoreInfo = {
        type: 'S3_VECTORS',
        vectorBucketArn: s3VectorsStack.vectorBucketArn,
        knowledgeBaseId: s3VectorsStack.knowledgeBaseId,
      };
    } else {
      // OpenSearch Serverless（デフォルト）
      // 既存の実装
    }
  }
}
```

#### 6.3 デプロイ

```bash
# 環境変数の設定（オプション）
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=prod
export FSX_S3_ACCESS_POINT_ALIAS=s3ap-vol1-xxxxx-ext-s3alias

# S3 Vectors単体デプロイ
npx cdk deploy -a 'npx ts-node bin/bedrock-kb-s3-vectors-app.ts' \
  --region us-east-1

# DataStackでS3 Vectorsを使用
export VECTOR_STORE_TYPE=S3_VECTORS
npx cdk deploy DataStack --region us-east-1
```

**環境変数の説明**:
- `PROJECT_NAME`: プロジェクト名（デフォルト: `permission-aware-rag`）
- `ENVIRONMENT`: 環境名（デフォルト: `prod`）
- `FSX_S3_ACCESS_POINT_ALIAS`: FSx for ONTAP S3 Access Pointのエイリアス（必須）

**重要**: `FSX_S3_ACCESS_POINT_ALIAS`は必須環境変数です。設定されていない場合、デプロイは失敗します。

---

## 7. 連携可能なAWSサービス

### 7.1 AI・機械学習サービス

#### Amazon Bedrock
**ユースケース**: RAG（Retrieval Augmented Generation）アプリケーション

**統合方法**:
```typescript
// Bedrock Knowledge BaseのS3データソース設定
const knowledgeBaseConfig = {
  dataSourceConfiguration: {
    type: 'S3',
    s3Configuration: {
      bucketArn: 'arn:aws:s3:::my-fsx-access-point-alias',
      inclusionPrefixes: ['documents/']
    }
  }
};
```

**主要機能**:
- Knowledge Basesでのドキュメント取り込み
- マルチモーダルコンテンツ対応（テキスト、画像、音声、動画）
- 自動ベクトル化とインデックス作成
- RetrieveAndGenerate APIでの検索・生成

**メリット**:
- エンタープライズファイルデータを直接RAGに活用
- データ移動なしでナレッジベース構築
- ファイルシステムの権限管理を維持

#### Amazon SageMaker
**ユースケース**: 機械学習モデルのトレーニング

**統合方法**:
```python
from sagemaker.estimator import Estimator
from sagemaker.inputs import TrainingInput

# FSx Access PointをS3データソースとして指定
training_input = TrainingInput(
    s3_data='s3://my-fsx-access-point-alias/training-data/',
    input_mode='FastFile'  # ストリーミングアクセス
)

estimator = Estimator(
    image_uri='...',
    role=role_arn,
    instance_count=1,
    instance_type='ml.p3.2xlarge'
)

estimator.fit({'training': training_input})
```

**サポートされる入力モード**:
- **File Mode**: 全データをダウンロードしてからトレーニング開始
- **FastFile Mode**: ストリーミングアクセス、オンデマンドダウンロード
- **Pipe Mode**: 名前付きパイプ経由でストリーミング

**メリット**:
- 大規模トレーニングデータセットへの高速アクセス
- ストレージコストの削減
- データバージョニングとスナップショット機能の活用

#### Amazon Rekognition
**ユースケース**: 画像・動画分析

**統合方法**:
```python
import boto3

rekognition = boto3.client('rekognition')

# FSx Access Point経由で画像を分析
response = rekognition.detect_labels(
    Image={
        'S3Object': {
            'Bucket': 'my-fsx-access-point-alias',
            'Name': 'images/sample.jpg'
        }
    },
    MaxLabels=10,
    MinConfidence=75
)

for label in response['Labels']:
    print(f"{label['Name']}: {label['Confidence']:.2f}%")
```

**主要機能**:
- オブジェクト・シーン検出
- 顔検出・認識
- テキスト検出（OCR）
- 不適切なコンテンツ検出

#### Amazon Textract
**ユースケース**: ドキュメント分析

**統合方法**:
```python
import boto3

textract = boto3.client('textract')

# FSx Access Point経由でドキュメントを分析
response = textract.analyze_document(
    Document={
        'S3Object': {
            'Bucket': 'my-fsx-access-point-alias',
            'Name': 'documents/invoice.pdf'
        }
    },
    FeatureTypes=['TABLES', 'FORMS']
)

# テーブルとフォームデータの抽出
for block in response['Blocks']:
    if block['BlockType'] == 'TABLE':
        print(f"Table detected: {block}")
```

**主要機能**:
- テキスト抽出
- フォーム認識
- テーブル抽出
- 署名検出

### 7.2 データ分析・ETLサービス

#### AWS Glue
**ユースケース**: ETL（Extract, Transform, Load）処理

**統合方法**:
```python
import boto3

glue = boto3.client('glue')

# Glue Crawlerの作成
response = glue.create_crawler(
    Name='fsx-ontap-crawler',
    Role='GlueServiceRole',
    DatabaseName='fsx_database',
    Targets={
        'S3Targets': [
            {
                'Path': 's3://my-fsx-access-point-alias/data/',
                'Exclusions': []
            }
        ]
    }
)
```

**主要機能**:
- データカタログの自動作成
- スキーマ検出とメタデータ管理
- PySpark/Python Shellジョブでのデータ処理
- データ品質チェック

#### Amazon Athena
**ユースケース**: インタラクティブなSQLクエリ

**統合方法**:
```sql
-- 外部テーブルの作成
CREATE EXTERNAL TABLE fsx_logs (
    timestamp STRING,
    user_id STRING,
    action STRING,
    resource STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://my-fsx-access-point-alias/logs/';

-- クエリ実行
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as access_count,
    COUNT(DISTINCT user_id) as unique_users
FROM fsx_logs
WHERE action = 'READ'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

**主要機能**:
- 標準SQLでのアドホッククエリ
- Parquet、ORC、JSON、CSV等の形式サポート
- パーティション化によるクエリ最適化
- Glueデータカタログとの統合

#### Amazon EMR
**ユースケース**: ビッグデータ処理（Spark、Hadoop、Presto）

**統合方法**:
```python
import boto3

emr = boto3.client('emr')

# EMRクラスターの起動
response = emr.run_job_flow(
    Name='FSx-ONTAP-Processing',
    ReleaseLabel='emr-7.0.0',
    Applications=[
        {'Name': 'Spark'},
        {'Name': 'Hadoop'},
        {'Name': 'Hive'}
    ],
    Instances={
        'InstanceGroups': [
            {
                'Name': 'Master',
                'Market': 'ON_DEMAND',
                'InstanceRole': 'MASTER',
                'InstanceType': 'm5.xlarge',
                'InstanceCount': 1
            }
        ],
        'KeepJobFlowAliveWhenNoSteps': True
    }
)
```

**主要機能**:
- Apache Spark、Hadoop、Hive、Prestoでの大規模データ処理
- 分散処理による高速化
- スポットインスタンスによるコスト最適化

### 7.3 コンピュート・コンテナサービス

#### AWS Lambda
**ユースケース**: サーバーレスデータ処理

**統合方法**:
```python
import boto3
import json

s3 = boto3.client('s3')

def lambda_handler(event, context):
    # FSx Access Point経由でファイル読み込み
    bucket = 'my-fsx-access-point-alias'
    key = 'data/input.json'
    
    response = s3.get_object(Bucket=bucket, Key=key)
    data = json.loads(response['Body'].read())
    
    # データ処理
    processed_data = process_data(data)
    
    # FSx Access Point経由で結果を書き込み
    s3.put_object(
        Bucket=bucket,
        Key='data/output.json',
        Body=json.dumps(processed_data)
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps('Processing complete')
    }
```

**主要機能**:
- S3イベント通知によるトリガー
- 最大15分の実行時間
- 10GBまでのメモリ割り当て
- 512MBの一時ストレージ

### 7.4 データコラボレーション・データ共有サービス

#### AWS Data Exchange
**対応状況**: ✅ **完全対応**

AWS Data Exchangeは、S3 Access Pointsを**ネイティブにサポート**しています。

**統合方法**:
```typescript
// AWS Data Exchange S3DataAccessAsset
{
  "Bucket": "fsx-ontap-bucket",
  "S3AccessPointArn": "arn:aws:s3:us-east-1:123456789012:accesspoint/fsx-ontap-ap",
  "S3AccessPointAlias": "fsx-ontap-ap-alias",
  "KmsKeysToGrant": [
    {
      "KmsKeyArn": "arn:aws:kms:us-east-1:123456789012:key/xxxxx"
    }
  ]
}
```

**主要機能**:
- データプロバイダー: S3バケットまたはプレフィックスを共有
- データサブスクライバー: AWS Data Exchangeが自動的にS3 Access Pointを作成
- 直接アクセス: サブスクライバーはAccess Point経由でデータに直接アクセス
- ストレージコスト削減: データコピー不要、プロバイダーのS3バケットから直接読み取り

**FSx for ONTAP統合の利点**:
- FSx for ONTAP S3 Access Pointsを使用して、NetApp ONTAPデータを第三者に共有可能
- データ移動不要で、エンタープライズデータを外部パートナーと共有
- Requester Pays機能により、データアクセスコストをサブスクライバーに転嫁可能


---

## 8. セキュリティ・認証モデル

### 8.1 デュアル認証アーキテクチャ

S3 Access Points for FSx for ONTAPは、2段階の認証を実施します：

#### Phase 1: AWS IAM認証
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::account:user/data-scientist"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:us-east-1:account:accesspoint/my-fsx-access-point",
        "arn:aws:s3:us-east-1:account:accesspoint/my-fsx-access-point/object/*"
      ]
    }
  ]
}
```

#### Phase 2: ファイルシステムレベル認証

**UNIXセキュリティスタイル**:
```bash
# ファイルシステムユーザーの権限
uid=1001(datauser) gid=1001(datagroup)
drwxr-x--- 2 datauser datagroup 4096 Dec  6 10:00 /data/
-rw-r----- 1 datauser datagroup 1024 Dec  6 10:00 /data/file.txt
```

**Windowsセキュリティスタイル**:
```powershell
# ACL設定
icacls "D:\data" /grant "DOMAIN\DataUser:(OI)(CI)M"
```

### 8.2 VPC制限設定

```typescript
const accessPointConfig = {
  Name: 'secure-fsx-access-point',
  VpcConfiguration: {
    VpcId: 'vpc-12345678'
  },
  PublicAccessBlockConfiguration: {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true
  }
};
```

### 8.3 セキュリティベストプラクティス

1. **最小権限の原則**
   - IAMロールには必要最小限の権限のみ付与
   - S3 Access Pointにバケットポリシーを設定
   - IAMロール名を自動生成することで、重複エラーを防止

2. **暗号化**
   - FSx ONTAPボリュームの暗号化を有効化
   - S3 Vectorsの暗号化を有効化（KMS）

3. **ネットワーク分離**
   - FSxをプライベートサブネットに配置
   - VPCエンドポイント経由でBedrockにアクセス

4. **リソース命名規則**
   - プロジェクト名と環境を含む動的な命名により、環境分離を実現
   - 環境変数でリソース名をカスタマイズ可能

---

## 9. パフォーマンス特性

### 9.1 レイテンシ
- **S3 API経由**: 数十ミリ秒（S3バケットと同等）
- **NFS/SMB経由**: サブミリ秒

### 9.2 スループット
- FSx for ONTAPのプロビジョニングされたスループットに依存
- 最大数GB/秒のスループット
- 並列リクエストによるスケーリング

### 9.3 推奨事項
```typescript
// 大規模ファイルの並列アップロード
const uploadParams = {
  Bucket: 'my-fsx-access-point-alias',
  Key: 'large-file.dat',
  Body: fileStream,
  // マルチパートアップロード設定
  PartSize: 10 * 1024 * 1024, // 10MB
  QueueSize: 4 // 並列度
};

const upload = new AWS.S3.ManagedUpload({ params: uploadParams });
upload.promise();
```

---

## 10. コスト構造

### 10.1 課金要素

1. **FSx for ONTAP料金**
   - ストレージ容量（GB/月）
   - プロビジョニングされたスループット（MB/秒/月）
   - バックアップストレージ（GB/月）

2. **S3 Access Point料金**
   - リクエスト料金（GET、PUT、LIST等）
   - データ転送料金（アウトバウンド）

3. **データ転送料金**
   - リージョン間転送
   - インターネットへの転送

### 10.2 コスト最適化のベストプラクティス

```typescript
// キャッシング戦略
const s3 = new AWS.S3({
  maxRetries: 3,
  httpOptions: {
    timeout: 300000,
    connectTimeout: 5000
  }
});

// バッチ処理でリクエスト数を削減
const listParams = {
  Bucket: 'my-fsx-access-point-alias',
  MaxKeys: 1000 // 一度に多くのオブジェクトを取得
};
```

### 10.3 コスト比較

**S3 Vectors vs OpenSearch Serverless**:
- 大規模データセット（100万件以上）: S3 Vectors（最大90%削減）
- リアルタイム検索: OpenSearch Serverless

**FSxストレージ最適化**:
- 使用頻度の低いデータはS3にアーカイブ
- ストレージ効率化機能を有効化

**Bedrock料金**:
- Embedding: $0.0001/1000トークン
- 検索: $0.0001/クエリ

---

## 11. トラブルシューティング

### 11.1 よくある問題と解決方法

#### 問題1: S3 Access Point作成エラー

**エラー**: `InvalidRequest: S3 Access Points feature is not enabled`

**原因**: Private Beta未承認（S3 Vectors使用時）

**解決**:
1. AWSサポートケースでPrivate Beta承認を確認
2. 承認後、24時間待機
3. 再度作成を試行

#### 問題2: Knowledge Base作成エラー

**エラー**: `User is not authorized to perform: s3vectors:CreateVectorBucket`

**原因**: IAMロールに権限がない

**解決**:
```bash
# IAMロールに権限を追加
bash development/scripts/temp/update-kb-role-s3vectors.sh
```

#### 問題3: IAMロール重複エラー（最新版で解決済み）

**エラー**: `Role with name BedrockKBExecutionRole-S3Vectors already exists`

**原因**: 固定のIAMロール名を使用していた（旧バージョン）

**解決**: 最新版では自動的に解決されています
- **改善内容**: IAMロール名を指定せず、CDKに自動生成させることで重複を防止
- **対応バージョン**: 2024年11月28日以降のコード
- **確認方法**: `lib/stacks/integrated/bedrock-kb-s3-vectors-stack.ts`で`roleName`が削除されていることを確認

```typescript
// 旧バージョン（重複エラーが発生）
const kbExecutionRole = new iam.Role(this, 'KBExecutionRole', {
  roleName: 'BedrockKBExecutionRole-S3Vectors', // ← 固定名が原因
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

// 新バージョン（重複エラーを回避）
const kbExecutionRole = new iam.Role(this, 'KBExecutionRole', {
  // roleName を削除してCDKに自動生成させる（重複を防ぐため）
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  description: 'Bedrock Knowledge Base実行ロール（S3 Vectors + FSx for ONTAP S3 Access Point）',
});
```

#### 問題4: Ingestion Job失敗

**エラー**: `AccessDenied: Access Denied`

**原因**: S3 Access Pointへのアクセス権限がない

**解決**:
```bash
# S3 Access Point権限を追加
bash development/scripts/temp/update-kb-role-s3-access-point.sh
```

#### 問題5: ベクトル検索結果が空

**原因**: Ingestion Jobが完了していない

**解決**:
```bash
# Ingestion Jobステータス確認
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id KB-XXXXXXXXXX \
  --data-source-id DS-XXXXXXXXXX \
  --ingestion-job-id IJ-XXXXXXXXXX \
  --region us-east-1

# ステータスがCOMPLETEになるまで待機
```

---

## 12. ベストプラクティス

### 12.1 パフォーマンス

1. **ドキュメントサイズ**
   - 1ドキュメントあたり最大10MB
   - 大きなドキュメントは分割

2. **Ingestion Job**
   - バッチサイズ: 100-1000ドキュメント
   - 並列実行: 最大5ジョブ

3. **ベクトル検索**
   - Top K: 3-10件推奨
   - 類似度閾値: 0.7以上

### 12.2 実装ガイドライン

#### Step 1: FSx for ONTAPファイルシステムの作成

```typescript
import * as cdk from 'aws-cdk-lib';
import * as fsx from 'aws-cdk-lib/aws-fsx';

const fileSystem = new fsx.CfnFileSystem(this, 'FSxONTAP', {
  fileSystemType: 'ONTAP',
  storageCapacity: 1024,
  subnetIds: [subnet.subnetId],
  ontapConfiguration: {
    deploymentType: 'MULTI_AZ_1',
    throughputCapacity: 128,
    preferredSubnetId: subnet.subnetId,
    routeTableIds: [routeTable.routeTableId]
  }
});
```

#### Step 2: S3 Access Pointの作成

```bash
# AWS CLI
aws fsx create-and-attach-s3-access-point \
  --name my-fsx-access-point \
  --volume-id fsvol-0123456789abcdef0 \
  --file-system-user-identity '{"UnixUserId":1001,"UnixGroupId":1001}' \
  --network-configuration '{"VpcId":"vpc-12345678"}' \
  --region us-east-1
```

#### Step 3: IAMポリシーの設定

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:us-east-1:account:accesspoint/my-fsx-access-point",
        "arn:aws:s3:us-east-1:account:accesspoint/my-fsx-access-point/object/*"
      ]
    }
  ]
}
```

#### Step 4: アプリケーションからのアクセス

```python
import boto3

s3 = boto3.client('s3')

# ファイルのアップロード
s3.put_object(
    Bucket='my-fsx-access-point-alias',
    Key='data/sample.txt',
    Body=b'Hello from FSx for ONTAP!'
)

# ファイルのダウンロード
response = s3.get_object(
    Bucket='my-fsx-access-point-alias',
    Key='data/sample.txt'
)
content = response['Body'].read()

# ファイルのリスト
response = s3.list_objects_v2(
    Bucket='my-fsx-access-point-alias',
    Prefix='data/'
)
for obj in response.get('Contents', []):
    print(obj['Key'])
```

---

## 参考資料

### AWS公式ドキュメント

- [FSx for NetApp ONTAP](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)
- [S3 Access Points](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html)
- [Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [S3 Vectors](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)
- [AWS Blog: FSx for ONTAP S3 Integration](https://aws.amazon.com/blogs/aws/amazon-fsx-for-netapp-ontap-now-integrates-with-amazon-s3-for-seamless-data-access/)

### プロジェクト内ドキュメント

- [ベクトルストア設定ガイド](./vector-store-configuration-guide.md)
- [デプロイメント完全ガイド](./deployment-complete-guide.md)
- [マルチリージョンデプロイ](./multi-region-deployment-guide.md)

### API リファレンス

- [CreateAndAttachS3AccessPoint API](https://docs.aws.amazon.com/fsx/latest/APIReference/API_CreateAndAttachS3AccessPoint.html)
- [S3 API Operations](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)

---

**最終更新**: 2026年1月18日  
**バージョン**: 2.0  
**全体進捗**: 100% (2つのFSx統合ガイドを完全統合)
