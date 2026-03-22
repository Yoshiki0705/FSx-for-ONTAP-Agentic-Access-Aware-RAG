#!/bin/bash
set -euo pipefail

# Bedrock KBデータソース同期スクリプト

# 設定
KB_ID="${BEDROCK_KB_ID:?環境変数 BEDROCK_KB_ID を設定してください}"
REGION="${AWS_REGION:-ap-northeast-1}"

echo "=========================================="
echo "Bedrock KB データソース同期"
echo "=========================================="
echo "Knowledge Base ID: ${KB_ID}"
echo "Region: ${REGION}"
echo ""

# データソースID取得
echo "📋 データソース一覧を取得中..."
DS_ID=$(aws bedrock-agent list-data-sources \
  --knowledge-base-id "${KB_ID}" \
  --region "${REGION}" \
  --query 'dataSourceSummaries[0].dataSourceId' \
  --output text)

if [ -z "${DS_ID}" ] || [ "${DS_ID}" = "None" ]; then
  echo "❌ データソースが見つかりません"
  exit 1
fi

echo "  データソースID: ${DS_ID}"

# 同期開始
echo ""
echo "🔄 データソース同期を開始中..."
INGESTION_JOB=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id "${KB_ID}" \
  --data-source-id "${DS_ID}" \
  --region "${REGION}" \
  --query 'ingestionJob.ingestionJobId' \
  --output text)

echo "  Ingestion Job ID: ${INGESTION_JOB}"

# 同期完了待ち
echo ""
echo "⏳ 同期完了を待機中..."
while true; do
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id "${KB_ID}" \
    --data-source-id "${DS_ID}" \
    --ingestion-job-id "${INGESTION_JOB}" \
    --region "${REGION}" \
    --query 'ingestionJob.status' \
    --output text)

  echo "  ステータス: ${STATUS}"

  if [ "${STATUS}" = "COMPLETE" ]; then
    break
  elif [ "${STATUS}" = "FAILED" ]; then
    echo "❌ 同期に失敗しました"
    exit 1
  fi

  sleep 10
done

echo ""
echo "=========================================="
echo "✅ データソース同期完了"
echo "=========================================="
