# Task 3.2: 設定永続化システム デプロイガイド

**作成日時**: 2026-01-07  
**対象環境**: 全環境（dev/staging/prod）

---

## 📋 概要

このガイドでは、Task 3.2で実装した設定永続化システムを新しい環境にデプロイする手順を説明します。

---

## 🏗️ アーキテクチャ

### DynamoDBテーブル

**テーブル名**: `{environment}-user-preferences` または `permission-aware-rag-preferences`

**テーブル設計**:
- **パーティションキー**: `userId` (String) - ユーザーID
- **ソートキー**: `settingKey` (String) - 設定キー
- **属性**:
  - `settingValue` (Any) - 設定値（JSON形式）
  - `updatedAt` (String) - 更新日時（ISO 8601形式）
  - `createdAt` (String) - 作成日時（ISO 8601形式）

**設定例**:
```json
{
  "userId": "admin",
  "settingKey": "theme",
  "settingValue": "dark",
  "updatedAt": "2026-01-07T05:00:00.000Z",
  "createdAt": "2026-01-07T05:00:00.000Z"
}
```

### API Routes

**エンドポイント**: `/api/preferences`

**サポートメソッド**:
- `GET`: 全設定取得または特定設定取得
- `PUT`: 設定全体更新
- `PATCH`: 設定部分更新
- `DELETE`: 設定削除

---

## 🚀 デプロイ手順

### Step 1: DynamoDBテーブル作成

#### CDKデプロイの場合

CDKスタックをデプロイすると、自動的にテーブルが作成されます。

```bash
# DataStackをデプロイ
npx cdk deploy DataStack --region ap-northeast-1
```

#### 手動作成の場合

```bash
aws dynamodb create-table \
  --table-name permission-aware-rag-preferences \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=settingKey,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=settingKey,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

**確認**:
```bash
aws dynamodb describe-table \
  --table-name permission-aware-rag-preferences \
  --region ap-northeast-1 \
  --query 'Table.[TableName,TableStatus,KeySchema]'
```

---

### Step 2: IAMポリシー更新

Lambda実行ロールに、Preferencesテーブルへのアクセス権限を追加します。

#### CDKデプロイの場合

CDKスタックをデプロイすると、自動的に権限が付与されます。

```bash
# WebAppStackをデプロイ
npx cdk deploy WebAppStack --region ap-northeast-1
```

#### 手動更新の場合

**1. 現在のポリシーを取得**:
```bash
aws iam get-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name WebAppExecutionRoleDefaultPolicy4CA0A1AC \
  --region ap-northeast-1 \
  --query 'PolicyDocument' \
  --output json > current-policy.json
```

**2. ポリシーを編集**:

`current-policy.json`のDynamoDB Statementに以下を追加:

```json
{
  "Action": [
    "dynamodb:BatchGetItem",
    "dynamodb:BatchWriteItem",
    "dynamodb:DeleteItem",
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:Query",
    "dynamodb:Scan",
    "dynamodb:UpdateItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:ap-northeast-1:YOUR_ACCOUNT_ID:table/permission-aware-rag-preferences",
    "arn:aws:dynamodb:ap-northeast-1:YOUR_ACCOUNT_ID:table/permission-aware-rag-preferences/index/*"
  ],
  "Effect": "Allow"
}
```

**3. ポリシーを更新**:
```bash
aws iam put-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name WebAppExecutionRoleDefaultPolicy4CA0A1AC \
  --policy-document file://current-policy.json \
  --region ap-northeast-1
```

---

### Step 3: Lambda環境変数更新

Lambda関数に`PREFERENCES_TABLE_NAME`環境変数を追加します。

#### CDKデプロイの場合

CDKスタックをデプロイすると、自動的に環境変数が設定されます。

#### 手動更新の場合

```bash
aws lambda update-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --environment Variables="{
    SESSION_TABLE_NAME=permission-aware-rag-sessions,
    PREFERENCES_TABLE_NAME=permission-aware-rag-preferences,
    CHAT_HISTORY_TABLE_NAME=permission-aware-rag-chat-history,
    JWT_SECRET=your-super-secret-jwt-key-change-in-production,
    BEDROCK_AGENT_ID=YOUR_AGENT_ID,
    BEDROCK_AGENT_ALIAS_ID=YOUR_ALIAS_ID
  }" \
  --region ap-northeast-1
```

**確認**:
```bash
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query 'Environment.Variables' \
  --output json | jq '.PREFERENCES_TABLE_NAME'
```

---

### Step 4: Lambda関数再起動

新しいIAMポリシーを適用するため、Lambda関数を再起動します。

```bash
# Reserved Concurrency方式でコンテナキャッシュクリア
aws lambda put-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --reserved-concurrent-executions 0 \
  --region ap-northeast-1

# 10秒待機
sleep 10

# Reserved Concurrency削除
aws lambda delete-function-concurrency \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1

# ウォームアップ（30回）
for i in {1..30}; do
  aws lambda invoke \
    --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
    --payload '{"rawPath": "/health"}' \
    --region ap-northeast-1 \
    /tmp/response-${i}.json > /dev/null 2>&1
  echo -n "."
  sleep 1
done
echo ""
echo "✅ Lambda ウォームアップ完了"
```

---

## ✅ 検証手順

### 1. DynamoDBテーブル確認

```bash
aws dynamodb describe-table \
  --table-name permission-aware-rag-preferences \
  --region ap-northeast-1 \
  --query 'Table.[TableName,TableStatus]'
```

**期待結果**:
```json
[
  "permission-aware-rag-preferences",
  "ACTIVE"
]
```

---

### 2. IAMポリシー確認

```bash
aws iam get-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --policy-name WebAppExecutionRoleDefaultPolicy4CA0A1AC \
  --region ap-northeast-1 \
  --query 'PolicyDocument.Statement[?contains(Resource, `preferences`)].Resource' \
  --output json
```

**期待結果**:
```json
[
  [
    "arn:aws:dynamodb:ap-northeast-1:178625946981:table/permission-aware-rag-preferences",
    "arn:aws:dynamodb:ap-northeast-1:178625946981:table/permission-aware-rag-preferences/index/*"
  ]
]
```

---

### 3. Lambda環境変数確認

```bash
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query 'Environment.Variables.PREFERENCES_TABLE_NAME' \
  --output text
```

**期待結果**:
```
permission-aware-rag-preferences
```

---

### 4. API動作確認

#### GET /api/preferences（全設定取得）

```bash
curl -X GET https://YOUR_CLOUDFRONT_DOMAIN/api/preferences \
  -H "Content-Type: application/json" \
  -H "Cookie: session-token=YOUR_SESSION_TOKEN"
```

**期待結果**:
```json
{
  "preferences": {},
  "count": 0
}
```

#### PATCH /api/preferences（設定更新）

```bash
curl -X PATCH https://YOUR_CLOUDFRONT_DOMAIN/api/preferences \
  -H "Content-Type: application/json" \
  -H "Cookie: session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "key": "theme",
    "value": "dark"
  }'
```

**期待結果**:
```json
{
  "success": true,
  "message": "Preference updated successfully",
  "key": "theme",
  "value": "dark"
}
```

#### DELETE /api/preferences（設定削除）

```bash
curl -X DELETE "https://YOUR_CLOUDFRONT_DOMAIN/api/preferences?key=theme" \
  -H "Content-Type: application/json" \
  -H "Cookie: session-token=YOUR_SESSION_TOKEN"
```

**期待結果**:
```json
{
  "success": true,
  "message": "Preference deleted successfully",
  "key": "theme"
}
```

---

## 🐛 トラブルシューティング

### エラー1: AccessDeniedException

**症状**:
```
User: arn:aws:sts::ACCOUNT_ID:assumed-role/ROLE_NAME/FUNCTION_NAME is not authorized to perform: dynamodb:Query on resource: arn:aws:dynamodb:REGION:ACCOUNT_ID:table/permission-aware-rag-preferences
```

**原因**: Lambda実行ロールがPreferencesテーブルへのアクセス権限を持っていない

**解決策**: Step 2のIAMポリシー更新を実行

---

### エラー2: ValidationException: ExpressionAttributeValues must not be empty

**症状**:
```
ValidationException: ExpressionAttributeValues must not be empty
```

**原因**: DynamoDBテーブルが存在しない、またはテーブル名が間違っている

**解決策**: 
1. テーブル名を確認
2. Step 1のDynamoDBテーブル作成を実行

---

### エラー3: 500 Internal Server Error

**症状**: API呼び出しで500エラーが返される

**原因**: Lambda環境変数が設定されていない、またはIAM権限が不足

**解決策**:
1. CloudWatch Logsでエラー詳細を確認
2. Step 2とStep 3を実行
3. Step 4でLambda関数を再起動

---

## 📚 関連ドキュメント

- [Task 3.2実装計画](../../development/docs/reports/local/01-07-task3.2-implementation-plan.md)
- [Task 3.2 API検証成功レポート](../../development/docs/reports/local/01-07-task3.2-api-verification-success.md)
- [Task 3.2 Store統合実装レポート](../../development/docs/reports/local/01-07-task3.2-store-integration-implementation.md)

---

**作成者**: Kiro AI  
**最終更新**: 2026-01-07

