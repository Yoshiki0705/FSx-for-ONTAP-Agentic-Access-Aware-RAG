#!/bin/bash

# テスト用DynamoDBテーブル作成スクリプト
# 
# @author Kiro AI
# @date 2026-01-04
# @version 1.0.0

set -euo pipefail

# 設定
TABLE_NAME="TokyoRegion-permission-aware-rag-test-Identity-Table"
REGION="ap-northeast-1"

echo "========================================="
echo "テスト用DynamoDBテーブル作成"
echo "========================================="
echo "テーブル名: $TABLE_NAME"
echo "リージョン: $REGION"
echo ""

# テーブルが既に存在するか確認
if aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  >/dev/null 2>&1; then
  echo "✓ テーブルは既に存在します"
  exit 0
fi

echo "テーブルを作成中..."

# テーブル作成
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --attribute-definitions \
    AttributeName=agentId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=agentId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags \
    Key=Environment,Value=test \
    Key=Project,Value=permission-aware-rag \
    Key=Component,Value=agent-core-identity \
    Key=ManagedBy,Value=integration-tests

echo ""
echo "テーブル作成リクエスト送信完了"
echo "テーブルがアクティブになるまで待機中..."

# テーブルがアクティブになるまで待機
aws dynamodb wait table-exists \
  --table-name "$TABLE_NAME" \
  --region "$REGION"

echo ""
echo "✓ テーブル作成完了"
echo ""
echo "テーブル情報:"
aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}' \
  --output table

echo ""
echo "========================================="
echo "セットアップ完了"
echo "========================================="
