# Task 3.2: CDKデプロイメントノート

**作成日時**: 2026-01-07  
**対象**: 開発者・DevOpsエンジニア

---

## 📋 概要

このドキュメントでは、Task 3.2で実装した設定永続化システムのCDK実装について説明します。

---

## 🏗️ CDK実装概要

### 1. DynamoDBテーブル定義

**ファイル**: `lib/modules/database/constructs/user-preferences-table-construct.ts`

**テーブル設計**:
```typescript
{
  tableName: `${environment}-user-preferences`,
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'settingKey', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: environment === 'prod',
  removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
}
```

**特徴**:
- 複合キー（userId + settingKey）による柔軟な設定管理
- PAY_PER_REQUEST課金モード（コスト最適化）
- AWS管理暗号化（セキュリティ）
- 本番環境でのポイントインタイムリカバリ（データ保護）
- 環境別削除ポリシー（本番: RETAIN、開発: DESTROY）

---

### 2. DataStack統合

**ファイル**: `lib/stacks/integrated/data-stack.ts`

**実装箇所**:

#### インポート（行19）
```typescript
import { UserPreferencesTableConstruct } from '../../modules/database/constructs/user-preferences-table-construct';
```

#### プロパティ定義（行68）
```typescript
/** ユーザー設定用DynamoDBテーブル（Task 3.2） */
public userPreferencesTable?: dynamodb.Table;
```

#### テーブル作成（行237-243）
```typescript
// 2. ユーザー設定テーブル（機能復旧 - 要件2）
const userPreferencesTable = new UserPreferencesTableConstruct(this, 'UserPreferencesTable', {
  tableName: `${this.environmentName}-user-preferences`,
  environment: this.environmentName,
});
this.dynamoDbTableNames['userPreferences'] = userPreferencesTable.table.tableName;
this.userPreferencesTable = userPreferencesTable.table; // エクスポート（Task 3.2）
```

#### CloudFormation Output（行289-293）
```typescript
new cdk.CfnOutput(this, 'UserPreferencesTableName', {
  value: userPreferencesTable.table.tableName,
  description: 'User Preferences Table Name',
  exportName: `${this.stackName}-UserPreferencesTableName`,
});
```

---

### 3. WebAppStack統合

**ファイル**: `lib/stacks/integrated/webapp-stack.ts`

**実装箇所**:

#### Lambda環境変数（行471）
```typescript
environment: {
  // ...
  PREFERENCES_TABLE_NAME: props.dataStack?.userPreferencesTable?.tableName || 'permission-aware-rag-preferences',
  // ...
}
```

#### アクセス権限付与（行507-510）
```typescript
// UserPreferencesテーブルへのアクセス権限付与（Task 3.2）
if (props.dataStack?.userPreferencesTable) {
  props.dataStack.userPreferencesTable.grantReadWriteData(this.webAppFunction);
  console.log('✅ UserPreferencesTableへのアクセス権限付与完了');
}
```

---

## 🚀 デプロイ手順

### 方法1: CDKデプロイ（推奨）

```bash
# 1. DataStackをデプロイ（DynamoDBテーブル作成）
npx cdk deploy DataStack --region ap-northeast-1

# 2. WebAppStackをデプロイ（Lambda環境変数・IAM権限設定）
npx cdk deploy WebAppStack --region ap-northeast-1 \
  -c imageTag=task3.2-preferences-20260107-050000
```

### 方法2: 個別スタックデプロイ

```bash
# DataStackのみデプロイ
npx cdk deploy DataStack --region ap-northeast-1

# 確認
aws dynamodb describe-table \
  --table-name prod-user-preferences \
  --region ap-northeast-1
```

---

## 🔍 デプロイ検証

### 1. DynamoDBテーブル確認

```bash
aws dynamodb describe-table \
  --table-name prod-user-preferences \
  --region ap-northeast-1 \
  --query 'Table.[TableName,TableStatus,KeySchema]'
```

**期待結果**:
```json
[
  "prod-user-preferences",
  "ACTIVE",
  [
    { "AttributeName": "userId", "KeyType": "HASH" },
    { "AttributeName": "settingKey", "KeyType": "RANGE" }
  ]
]
```

### 2. Lambda環境変数確認

```bash
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query 'Environment.Variables.PREFERENCES_TABLE_NAME'
```

**期待結果**:
```
"prod-user-preferences"
```

### 3. IAMポリシー確認

```bash
aws iam get-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name WebAppExecutionRoleDefaultPolicy4CA0A1AC \
  --region ap-northeast-1 \
  --query 'PolicyDocument.Statement[?contains(Resource, `preferences`)].Resource'
```

**期待結果**:
```json
[
  [
    "arn:aws:dynamodb:ap-northeast-1:178625946981:table/prod-user-preferences",
    "arn:aws:dynamodb:ap-northeast-1:178625946981:table/prod-user-preferences/index/*"
  ]
]
```

---

## 🔧 トラブルシューティング

### エラー1: テーブルが作成されない

**症状**: CDKデプロイ後もテーブルが存在しない

**原因**: DataStackがデプロイされていない

**解決策**:
```bash
npx cdk deploy DataStack --region ap-northeast-1
```

### エラー2: Lambda環境変数が設定されない

**症状**: `PREFERENCES_TABLE_NAME`が設定されていない

**原因**: WebAppStackがDataStackを参照していない

**解決策**:
```bash
# bin/main-deployment-stack.tsでDataStackをWebAppStackに渡す
const webAppStack = new WebAppStack(app, 'WebAppStack', {
  // ...
  dataStack: {
    chatHistoryTable: dataStack.chatHistoryTable,
    userPreferencesTable: dataStack.userPreferencesTable, // 追加
  },
});
```

### エラー3: IAM権限が付与されない

**症状**: AccessDeniedExceptionが発生

**原因**: WebAppStackのIAM権限付与コードが実行されていない

**解決策**:
```bash
# WebAppStackを再デプロイ
npx cdk deploy WebAppStack --region ap-northeast-1 \
  -c imageTag=latest
```

---

## 📚 関連ファイル

### CDK実装
- `lib/modules/database/constructs/user-preferences-table-construct.ts`
- `lib/stacks/integrated/data-stack.ts`
- `lib/stacks/integrated/webapp-stack.ts`

### ドキュメント
- `docs/guides/task3.2-preferences-deployment-guide.md`
- `development/docs/reports/local/01-07-task3.2-api-verification-success.md`
- `development/docs/reports/local/01-07-task3.2-store-integration-implementation.md`

### API実装
- `docker/nextjs/src/app/api/preferences/route.ts`
- `docker/nextjs/src/hooks/usePreferences.ts`
- `docker/nextjs/src/hooks/usePreferencesSync.ts`

---

## 🎯 ベストプラクティス

### 1. 環境別設定

```typescript
// 本番環境
{
  pointInTimeRecovery: true,
  removalPolicy: RemovalPolicy.RETAIN,
  encryption: TableEncryption.CUSTOMER_MANAGED, // KMS使用
}

// 開発環境
{
  pointInTimeRecovery: false,
  removalPolicy: RemovalPolicy.DESTROY,
  encryption: TableEncryption.AWS_MANAGED,
}
```

### 2. コスト最適化

```typescript
// PAY_PER_REQUEST課金モード（推奨）
billingMode: BillingMode.PAY_PER_REQUEST,

// または、予測可能なワークロードの場合
billingMode: BillingMode.PROVISIONED,
readCapacity: 5,
writeCapacity: 5,
```

### 3. セキュリティ

```typescript
// KMS暗号化（本番環境推奨）
encryption: TableEncryption.CUSTOMER_MANAGED,
encryptionKey: kmsKey,

// AWS管理暗号化（開発環境）
encryption: TableEncryption.AWS_MANAGED,
```

---

**作成者**: Kiro AI  
**最終更新**: 2026-01-07
