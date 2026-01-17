# Amazon Nova Multimodal Embeddings統合ガイド

## 概要

Amazon Nova Multimodal Embeddingsは、テキスト、画像、動画、音声、文書を単一のモデルで処理できる最先端のマルチモーダル埋め込みモデルです。このガイドでは、権限認識型RAGシステムにNova Multimodal Embeddingsを統合する方法を説明します。

## 主な特徴

### ✅ マルチモーダル対応
- **テキスト**: 最大8,192トークン、200言語対応
- **画像**: PNG, JPG, JPEG, GIF, WebP
- **動画**: MP4, MOV, MKV, WebM, FLV, MPEG, MPG, WMV, 3GP
- **音声**: MP3, WAV, FLAC, AAC, M4A
- **文書**: PDF, DOCX, TXT, MD, CSV, XLSX, HTML

### ✅ 柔軟な埋め込み次元
- **3,072次元**: 最高精度（詳細な表現）
- **1,024次元**: バランス型（推奨デフォルト）
- **384次元**: 高速処理
- **256次元**: 最小ストレージ

### ✅ 高度な機能
- **セグメンテーション**: 長いコンテンツを自動分割
- **クロスモーダル検索**: 異なるモダリティ間での検索
- **同期・非同期API**: 用途に応じた処理方式

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│      Nova Multimodal Embeddings with Multi-Compute Integration  │
├─────────────────────────────────────────────────────────────────┤
│  📁 FSx for NetApp ONTAP    │  🤖 Nova Multimodal Model          │
│  - Text Documents           │  - amazon.nova-embed-multimodal-v1 │
│  - Images (PNG, JPG, etc.)  │  - US East (N. Virginia)           │
│  - Videos (MP4, MOV, etc.)  │  - 4 Dimension Options             │
│  - Audio (MP3, WAV, etc.)   │  - Segmentation Support            │
│  - Mixed Content            │  - Cross-modal Retrieval           │
│  - NFS Mount (/mnt/fsx-data)│  - Permission-aware Processing     │
├─────────────────────────────────────────────────────────────────┤
│  🔄 Multi-Compute Pipeline │  📊 Vector Storage                 │
│  ┌─ AWS Batch (EC2)        │  - OpenSearch Serverless           │
│  ├─ Spot Fleet (EC2)       │  - OpenSearch Service              │
│  └─ ECS on EC2             │  - Aurora PostgreSQL + pgvector    │
│  - NFS Mount Access        │  - DynamoDB (metadata)             │
│  - Lambda Orchestration    │  - FSx Cache (/mnt/fsx-embeddings) │
│  - Auto Scaling            │  - S3 Backup Storage               │
│  - Cost Optimization       │                                     │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Search & Retrieval      │  ⚙️ Management & Monitoring        │
│  - Semantic Search          │  - CloudWatch Metrics              │
│  - Cross-modal Queries      │  - Cost Optimization               │
│  - Permission-aware Access  │  - Performance Monitoring          │
│  - FSx Path Tracking        │  - Error Handling                  │
│  - Real-time Results        │  - Multi-Compute Monitoring        │
└─────────────────────────────────────────────────────────────────┘
```

### 🚀 コンピュート統合オプション

#### **AWS Batch**
- **用途**: 大規模バッチ処理、スケジュール実行
- **特徴**: ジョブキュー管理、自動リトライ、依存関係処理
- **適用場面**: 定期的な大量ファイル処理

#### **Spot Fleet (EC2)**
- **用途**: コスト効率重視の継続処理
- **特徴**: スポットインスタンス活用、最大90%コスト削減
- **適用場面**: 継続的なファイル監視・処理

#### **ECS on EC2**
- **用途**: コンテナベースの柔軟な処理
- **特徴**: サービス管理、ヘルスチェック、ローリング更新
- **適用場面**: マイクロサービス型の処理アーキテクチャ

## セットアップ手順

### 1. 前提条件

#### AWS リージョン要件
```bash
# Nova Multimodal Embeddingsは現在US East (N. Virginia)でのみ利用可能
export NOVA_MULTIMODAL_REGION="us-east-1"
```

#### 必要な権限
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:ListFoundationModels"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-embed-multimodal-v1"
      ]
    }
  ]
}
```

### 2. 設定ファイルの作成

Nova Multimodal Embeddings用の設定ファイルを作成：

```bash
# 設定テンプレートをコピー
cp examples/nova-multimodal-config.json config/my-nova-config.json

# 設定ファイルの編集
nano config/my-nova-config.json
```

### 3. 主要設定項目

#### Nova Multimodal Embeddings設定
```json
{
  "novaMultimodalEmbeddings": {
    "enabled": true,
    "modelId": "amazon.nova-embed-multimodal-v1",
    "region": "us-east-1",
    "defaultDimensions": 1024,
    "features": {
      "textEmbedding": true,
      "imageEmbedding": true,
      "videoEmbedding": true,
      "audioEmbedding": true,
      "documentEmbedding": true,
      "segmentation": true
    }
  }
}
```

#### Vector Database統合
```json
{
  "vectorDatabases": {
    "opensearchServerless": {
      "enabled": true,
      "mode": "create",
      "create": {
        "collectionName": "nova-multimodal-embeddings",
        "indexName": "multimodal-index",
        "vectorDimensions": 1024
      }
    }
  }
}
```

### 4. デプロイメント

#### 設定の検証
```bash
# 設定ファイルの検証
./scripts/validate.sh --config config/my-nova-config.json
```

#### デプロイメント実行
```bash
# Nova Multimodal Embeddings統合をデプロイ
./scripts/deploy.sh --config config/my-nova-config.json --enable-nova-multimodal

# または環境変数で指定
export DEPLOYMENT_CONFIG=config/my-nova-config.json
export ENABLE_NOVA_MULTIMODAL=true
./scripts/deploy.sh
```

## 使用方法

### 1. テキスト埋め込み生成

```javascript
// Lambda関数での直接呼び出し
const payload = {
  action: "generate_nova_multimodal_embeddings",
  content: "This is a sample text for embedding generation.",
  contentType: "text",
  options: {
    dimensions: 1024,
    normalize: true
  }
};

const result = await lambda.invoke({
  FunctionName: "embedding-generator",
  Payload: JSON.stringify(payload)
}).promise();
```

### 2. FSx画像ファイルの埋め込み生成

```javascript
// FSxから画像ファイルを処理（AWS Batchジョブ投入）
const payload = {
  action: "submit_nova_multimodal_job",
  fsxFilePath: "/mnt/fsx-data/images/sample-image.jpg",
  options: {
    dimensions: 1024,
    contentType: "image",
    userId: "user123"
  }
};
```

### 3. FSx動画ファイルの埋め込み生成（セグメンテーション付き）

```javascript
// FSx動画をセグメントに分割して埋め込み生成（AWS Batchジョブ投入）
const payload = {
  action: "submit_nova_multimodal_job",
  fsxFilePath: "/mnt/fsx-data/videos/sample-video.mp4",
  options: {
    dimensions: 1024,
    contentType: "video",
    segmentation: true,
    segmentLength: 30,  // 30秒セグメント
    userId: "user123"
  }
};
```

### 4. FSxファイルのバッチ処理

```javascript
// FSx上の複数ファイルの一括処理（AWS Batchジョブ投入）
const payload = {
  action: "process_multimodal_batch",
  fsxFiles: [
    { 
      path: "/mnt/fsx-data/documents/document1.pdf",
      userId: "user123",
      contentType: "document"
    },
    { 
      path: "/mnt/fsx-data/images/image1.jpg",
      userId: "user123",
      contentType: "image"
    },
    { 
      path: "/mnt/fsx-data/videos/video1.mp4",
      userId: "user123",
      contentType: "video"
    }
  ],
  options: {
    dimensions: 1024,
    segmentation: true
  }
};
```

## テスト

### 1. 基本テスト

```bash
# Nova Multimodal Embeddingsの基本テスト
./scripts/test-nova-multimodal.sh \
  --function-name embedding-generator \
  --test-type text \
  --dimensions 1024
```

### 2. 全機能テスト

```bash
# すべてのモダリティをテスト
./scripts/test-nova-multimodal.sh \
  --function-name embedding-generator \
  --test-type all \
  --dimensions 1024 \
  --verbose
```

### 3. ヘルスチェック

```bash
# システム全体のヘルスチェック
aws lambda invoke \
  --function-name embedding-generator \
  --payload '{"action": "health_check"}' \
  /tmp/health-check-result.json

cat /tmp/health-check-result.json | jq '.body | fromjson'
```

## パフォーマンス最適化

### 1. 次元数の選択

| 次元数 | 用途 | 精度 | ストレージ | 処理速度 |
|--------|------|------|------------|----------|
| 3,072  | 最高精度が必要 | ★★★★★ | 大 | 遅い |
| 1,024  | バランス型（推奨） | ★★★★☆ | 中 | 普通 |
| 384    | 高速処理重視 | ★★★☆☆ | 小 | 速い |
| 256    | 最小ストレージ | ★★☆☆☆ | 最小 | 最速 |

### 2. セグメンテーション設定

```json
{
  "segmentation": {
    "enabled": true,
    "segmentLength": 1000,  // テキスト: トークン数
    "segmentLength": 30     // 動画/音声: 秒数
  }
}
```

### 3. バッチ処理最適化

```json
{
  "batch": {
    "maxConcurrency": 10,
    "batchSize": 100,
    "timeout": 3600
  }
}
```

## 監視とメトリクス

### 1. CloudWatch メトリクス

```bash
# 埋め込み生成メトリクスの確認
aws cloudwatch get-metric-statistics \
  --namespace "NovaMultimodal/Embeddings" \
  --metric-name "EmbeddingGenerationCount" \
  --dimensions Name=ContentType,Value=text \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### 2. コスト監視

```bash
# Nova Multimodal Embeddingsのコスト確認
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-02 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## トラブルシューティング

### 1. よくある問題

#### リージョンエラー
```
Error: Model amazon.nova-embed-multimodal-v1 not found in region ap-northeast-1
```

**解決方法**: Nova Multimodal Embeddingsはus-east-1でのみ利用可能
```bash
export NOVA_MULTIMODAL_REGION="us-east-1"
```

#### 次元数エラー
```
Error: Unsupported dimensions: 512
```

**解決方法**: サポートされている次元数を使用
```json
{
  "dimensions": 1024  // 256, 384, 1024, 3072のいずれか
}
```

#### ファイルサイズエラー
```
Error: File size exceeds maximum limit
```

**解決方法**: ファイルサイズ制限を確認
- コンピューターからアップロード: 25MB以下
- S3からアップロード: 2GB以下

### 2. デバッグ手順

```bash
# 1. Lambda関数のログ確認
aws logs tail /aws/lambda/embedding-generator --follow

# 2. Nova Multimodal Embeddingsテスト
./scripts/test-nova-multimodal.sh --function-name embedding-generator --verbose

# 3. 設定確認
aws lambda invoke \
  --function-name embedding-generator \
  --payload '{"action": "get_nova_multimodal_config"}' \
  /tmp/config-result.json
```

## ベストプラクティス

### 1. セキュリティ

- IAM権限を最小限に制限
- S3バケットの暗号化を有効化
- VPCエンドポイントの使用を検討

### 2. コスト最適化

- 適切な次元数の選択
- バッチ処理の活用
- 不要なファイルの定期削除

### 3. パフォーマンス

- 非同期処理の活用
- セグメンテーションの適切な設定
- キャッシュ戦略の実装

## 参考資料

- [Amazon Nova Multimodal Embeddings公式ブログ](https://aws.amazon.com/jp/blogs/aws/amazon-nova-multimodal-embeddings-now-available-in-amazon-bedrock/)
- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/)
- [Amazon Nova User Guide](https://docs.aws.amazon.com/nova/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/)

## サポート

問題が発生した場合は、以下の情報を含めてサポートにお問い合わせください：

1. エラーメッセージの詳細
2. 使用している設定ファイル
3. Lambda関数のログ
4. 処理しようとしているファイルの種類とサイズ
5. 使用している次元数とオプション
#
# 🔧 マルチコンピュート設定例

### 全コンピュートタイプ統合
```json
{
  "projectName": "permission-aware-rag",
  "environment": "production",
  "region": "us-east-1",
  "computeType": "all",
  "novaMultimodalEmbeddings": {
    "enabled": true,
    "modelId": "amazon.nova-embed-multimodal-v1",
    "region": "us-east-1",
    "defaultDimensions": 1024
  },
  "compute": {
    "batch": {
      "enabled": true,
      "jobQueue": {
        "name": "nova-multimodal-processing-queue"
      }
    },
    "spotFleet": {
      "enabled": true,
      "targetCapacity": 3,
      "maxCapacity": 20,
      "instanceTypes": ["c5.xlarge", "m5.xlarge"]
    },
    "ecs": {
      "enabled": true,
      "desiredCount": 3,
      "maxCapacity": 20,
      "enableAutoScaling": true
    }
  }
}
```

### 単一コンピュートタイプ（Spot Fleet）
```json
{
  "computeType": "spot-fleet",
  "compute": {
    "spotFleet": {
      "enabled": true,
      "targetCapacity": 5,
      "maxCapacity": 50,
      "allocationStrategy": "diversified"
    }
  }
}
```

### 単一コンピュートタイプ（ECS）
```json
{
  "computeType": "ecs",
  "compute": {
    "ecs": {
      "enabled": true,
      "clusterName": "nova-multimodal-cluster",
      "serviceName": "nova-multimodal-service",
      "desiredCount": 2,
      "maxCapacity": 10,
      "cpu": 2048,
      "memoryMiB": 4096,
      "enableAutoScaling": true
    }
  }
}
```

## 🚀 デプロイメント

### マルチコンピュート統合デプロイ
```bash
# 全コンピュートタイプでデプロイ
./scripts/deploy.sh --config examples/nova-multimodal-config.json --compute-type all

# Spot Fleetのみでデプロイ
./scripts/deploy.sh --config examples/nova-multimodal-config.json --compute-type spot-fleet

# ECSのみでデプロイ
./scripts/deploy.sh --config examples/nova-multimodal-config.json --compute-type ecs
```

### テスト実行
```bash
# 全コンピュートタイプのテスト
./scripts/test-nova-multimodal.sh \
  --function-name embedding-generator \
  --test-type all \
  --verbose

# Spot Fleetテスト
./scripts/test-nova-multimodal.sh \
  --function-name embedding-generator \
  --test-type spot-fleet

# ECSテスト
./scripts/test-nova-multimodal.sh \
  --function-name embedding-generator \
  --test-type ecs
```

## 📊 コンピュートタイプ比較

| 項目 | AWS Batch | Spot Fleet | ECS on EC2 |
|------|-----------|------------|-------------|
| **コスト** | 中 | 低（最大90%削減） | 中 |
| **管理複雑度** | 低 | 中 | 高 |
| **スケーラビリティ** | 高 | 高 | 高 |
| **可用性** | 高 | 中（スポット中断） | 高 |
| **適用場面** | バッチ処理 | コスト重視 | サービス型 |
| **起動時間** | 中 | 速い | 速い |
| **リトライ機能** | 自動 | 手動 | 自動 |

## 🔍 監視とメトリクス

### CloudWatch メトリクス
```bash
# Batch メトリクス
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Batch" \
  --metric-name "SubmittedJobs" \
  --dimensions Name=JobQueue,Value=nova-multimodal-processing-queue

# Spot Fleet メトリクス
aws cloudwatch get-metric-statistics \
  --namespace "SpotFleet/NovaMultimodal" \
  --metric-name "CPUUtilization"

# ECS メトリクス
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ECS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=ServiceName,Value=nova-multimodal-service
```

### コスト監視
```bash
# コンピュートタイプ別コスト分析
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-02 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter file://cost-filter.json
```