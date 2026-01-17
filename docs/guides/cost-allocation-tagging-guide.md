# コスト配布タグ設定ガイド

## 概要

このプロジェクトでは、AWS リソースのコスト配布と管理を効率化するため、統一されたタグ戦略を実装しています。

## 主要なコスト配布タグ

### 必須タグ

| タグキー | 説明 | 例 |
|---------|------|-----|
| `cost` | **コスト配布の主要キー** | `permission-aware-rag` |
| `Environment` | 環境名 | `dev`, `staging`, `prod` |
| `Project` | プロジェクト名 | `permission-aware-rag` |
| `CDK-Application` | CDKアプリケーション名 | `Permission-aware-RAG-FSx for ONTAP` |
| `Management-Method` | 管理方法 | `AWS-CDK` |

### 推奨タグ

| タグキー | 説明 | 例 |
|---------|------|-----|
| `Department` | 部門名 | `AI-Engineering` |
| `Owner` | 所有者 | `RAG-Team` |
| `CreatedDate` | 作成日 | `2024-11-03` |
| `Application-Type` | アプリケーション種別 | `RAG-System` |
| `Technology-Stack` | 技術スタック | `CDK-TypeScript` |

## サービス固有タグ

### FSx for ONTAP

```typescript
{
  'Service-Type': 'FSx-for-NetApp-ONTAP',
  'Use-Case': 'RAG-Document-Storage',
  'Performance-Tier': 'High', // prod環境の場合
  'Backup-Required': 'true',
  'Encryption-Required': 'true'
}
```

### AWS Batch

```typescript
{
  'Service-Type': 'AWS-Batch',
  'Use-Case': 'Embedding-Processing',
  'Compute-Type': 'Batch-Jobs',
  'Auto-Scaling': 'true'
}
```

### OpenSearch Serverless

```typescript
{
  'Service-Type': 'OpenSearch-Serverless',
  'Use-Case': 'Vector-Search',
  'Data-Type': 'Embeddings',
  'Search-Type': 'Semantic-Search'
}
```

### Lambda

```typescript
{
  'Service-Type': 'AWS-Lambda',
  'Function-Purpose': 'embedding-processor', // 関数の目的
  'Runtime': 'nodejs20.x',
  'Architecture': 'x86_64'
}
```

## 環境別タグ設定

### 開発環境 (dev)

```typescript
{
  'Cost-Center': 'Development',
  'Auto-Shutdown': 'true',
  'Monitoring-Level': 'Basic'
}
```

### ステージング環境 (staging)

```typescript
{
  'Cost-Center': 'Testing',
  'Auto-Shutdown': 'false',
  'Monitoring-Level': 'Enhanced'
}
```

### 本番環境 (prod)

```typescript
{
  'Cost-Center': 'Production',
  'Auto-Shutdown': 'false',
  'Monitoring-Level': 'Full',
  'Backup-Required': 'true',
  'DR-Required': 'true'
}
```

## 使用方法

### 1. CDKスタックでの使用

```typescript
import { TaggingStrategy, PermissionAwareRAGTags } from '../config/tagging-config';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);

    // コスト配布タグの適用
    const taggingConfig = PermissionAwareRAGTags.getStandardConfig(
      props.projectName,
      props.environment
    );
    TaggingStrategy.applyTagsToStack(this, taggingConfig);
  }
}
```

### 2. 特定リソースへのタグ適用

```typescript
// FSx for ONTAP専用タグ
const fsxTags = TaggingStrategy.generateFSxTags(taggingConfig);
Object.entries(fsxTags).forEach(([key, value]) => {
  cdk.Tags.of(fsxFileSystem).add(key, value);
});

// AWS Batch専用タグ
const batchTags = TaggingStrategy.generateBatchTags(taggingConfig);
Object.entries(batchTags).forEach(([key, value]) => {
  cdk.Tags.of(batchJobQueue).add(key, value);
});
```

### 3. アプリケーションレベルでのタグ設定

```typescript
// bin/app.ts
const app = new cdk.App();

// 全体タグの適用
cdk.Tags.of(app).add('cost', 'permission-aware-rag');
cdk.Tags.of(app).add('Environment', 'prod');
cdk.Tags.of(app).add('CDK-Application', 'Permission-aware-RAG-FSx for ONTAP');
```

## 環境変数での設定

```bash
# プロジェクト名（コスト配布の主要キー）
export PROJECT_NAME="permission-aware-rag"

# 環境名
export ENVIRONMENT="prod"

# 部門名（オプション）
export DEPARTMENT="AI-Engineering"

# 所有者（オプション）
export OWNER="RAG-Team"
```

## Cost Explorer での活用

### 1. コスト配布レポート

AWS Cost Explorer で以下のフィルターを使用：

- **Group by**: `cost` タグ
- **Filter**: `Environment` = `prod`

### 2. 環境別コスト比較

- **Group by**: `Environment` タグ
- **Time period**: 月次

### 3. サービス別コスト分析

- **Group by**: `Service-Type` タグ
- **Filter**: `cost` = `permission-aware-rag`

## ベストプラクティス

### 1. タグの一貫性

- 全てのリソースに `cost` タグを必ず適用
- 命名規則を統一（kebab-case推奨）
- 値の形式を統一（小文字、ハイフン区切り）

### 2. 自動化

- CDKスタックレベルでの自動タグ適用
- CI/CDパイプラインでのタグ検証
- 定期的なタグ監査の実施

### 3. 監視とアラート

- タグなしリソースの検出
- 予算アラートの設定
- コスト異常の早期発見

## トラブルシューティング

### よくある問題

1. **タグが適用されない**
   - CDKスタックの再デプロイが必要
   - リソース固有の制限を確認

2. **Cost Explorer でタグが表示されない**
   - タグの有効化に最大24時間必要
   - Cost Allocation Tags の有効化を確認

3. **タグ値の不整合**
   - 命名規則の統一を確認
   - 環境変数の設定を確認

### 確認コマンド

```bash
# リソースのタグ確認
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=cost,Values=permission-aware-rag

# Cost Allocation Tags の確認
aws ce list-cost-category-definitions
```

## 参考資料

- [AWS Cost Allocation Tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html)
- [CDK Tagging](https://docs.aws.amazon.com/cdk/v2/guide/tagging.html)
- [AWS Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)