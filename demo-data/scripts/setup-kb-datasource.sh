#!/bin/bash
set -euo pipefail
#
# FSx ONTAP S3 Access Point → Bedrock KB データソース セットアップスクリプト
#
# 前提条件:
#   1. CDKデプロイ完了（Storage + AI スタック）
#   2. SVM が AD ドメインに参加済み
#   3. FSx ONTAP ボリュームにドキュメント + .metadata.json が配置済み
#
# 使用方法:
#   bash demo-data/scripts/setup-kb-datasource.sh
#
# このスクリプトが行うこと:
#   1. S3 Access Point を FSx ONTAP ボリュームにアタッチ
#   2. Bedrock KB に S3 AP データソースを追加
#   3. データソース同期（Ingestion Job）を開始

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"

echo "🔍 スタック出力から情報を取得中..."

# Storage スタックから情報取得
VOLUME_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`VolumeId`].OutputValue' --output text)
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)

# AI スタックから情報取得
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

echo "  Volume ID: $VOLUME_ID"
echo "  S3 AP Name: $S3AP_NAME"
echo "  KB ID: $KB_ID"

# ========================================
# Step 1: S3 Access Point の確認・作成
# ========================================
echo ""
echo "📎 S3 Access Point を確認中..."

# 既存の S3 AP を確認
EXISTING_AP=$(aws fsx describe-s3-access-point-attachments --region $REGION \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].{Lifecycle:Lifecycle,ARN:S3AccessPoint.ResourceARN,Alias:S3AccessPoint.Alias}" \
  --output json 2>/dev/null)

AP_COUNT=$(echo "$EXISTING_AP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$AP_COUNT" -gt "0" ]; then
  AP_LIFECYCLE=$(echo "$EXISTING_AP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['Lifecycle'])")
  S3AP_ARN=$(echo "$EXISTING_AP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['ARN'])")
  S3AP_ALIAS=$(echo "$EXISTING_AP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['Alias'])")
  echo "  ✅ S3 AP が既に存在します: $S3AP_NAME (Status: $AP_LIFECYCLE)"
  echo "  ARN: $S3AP_ARN"
  echo "  Alias: $S3AP_ALIAS"
else
  echo "  S3 AP が存在しません。作成します..."
  # UNIX ユーザータイプで作成（NTFS ACL不要の場合）
  # WINDOWS ユーザータイプの場合は SVM が AD 参加済みである必要がある
  CREATE_RESULT=$(aws fsx create-and-attach-s3-access-point \
    --name "$S3AP_NAME" \
    --volume-id "$VOLUME_ID" \
    --file-system-identity '{"Type":"UNIX","UnixUser":{"Name":"root"}}' \
    --region $REGION --output json 2>&1)

  echo "  作成結果: $CREATE_RESULT"

  # 作成完了を待機
  echo "  ⏳ S3 AP 作成完了を待機中（最大5分）..."
  for i in $(seq 1 30); do
    sleep 10
    AP_STATUS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
      --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].Lifecycle" --output text 2>/dev/null)
    if [ "$AP_STATUS" = "AVAILABLE" ]; then
      echo "  ✅ S3 AP 作成完了"
      break
    fi
    echo "  [$i/30] Status: $AP_STATUS"
  done

  # ARN と Alias を取得
  S3AP_ARN=$(aws fsx describe-s3-access-point-attachments --region $REGION \
    --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.ResourceARN" --output text)
  S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
    --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)
  echo "  ARN: $S3AP_ARN"
  echo "  Alias: $S3AP_ALIAS"
fi

if [ -z "$S3AP_ARN" ] || [ "$S3AP_ARN" = "None" ]; then
  echo "❌ S3 AP ARN を取得できませんでした。SVM の AD 参加状態を確認してください。"
  exit 1
fi

# ========================================
# Step 2: Bedrock KB データソース追加
# ========================================
echo ""
echo "📚 Bedrock KB にデータソースを追加中..."

# 既存データソースを確認
EXISTING_DS=$(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region $REGION \
  --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null)

if [ -n "$EXISTING_DS" ] && [ "$EXISTING_DS" != "None" ]; then
  echo "  ⚠️ 既存データソースが見つかりました: $EXISTING_DS"
  echo "  既存データソースを使用して同期します。"
  DS_ID="$EXISTING_DS"
else
  # S3 AP の ARN から S3 バケット ARN 形式に変換
  # Bedrock KB は S3 AP ARN をそのまま bucketArn として受け付ける
  DS_RESULT=$(aws bedrock-agent create-data-source \
    --knowledge-base-id $KB_ID \
    --name "${STACK_PREFIX}-s3ap-datasource" \
    --data-source-configuration "{
      \"type\": \"S3\",
      \"s3Configuration\": {
        \"bucketArn\": \"${S3AP_ARN}\"
      }
    }" \
    --region $REGION --output json 2>&1)

  DS_ID=$(echo "$DS_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['dataSource']['dataSourceId'])" 2>/dev/null)

  if [ -z "$DS_ID" ] || [ "$DS_ID" = "None" ]; then
    echo "❌ データソース作成に失敗しました:"
    echo "$DS_RESULT"
    exit 1
  fi

  echo "  ✅ データソース作成完了: $DS_ID"
fi

# ========================================
# Step 3: データソース同期
# ========================================
echo ""
echo "🔄 データソース同期を開始..."

SYNC_RESULT=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region $REGION --output json 2>&1)

JOB_ID=$(echo "$SYNC_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['ingestionJob']['ingestionJobId'])" 2>/dev/null)

echo "  Ingestion Job ID: $JOB_ID"
echo "  ⏳ 同期完了を待機中..."

for i in $(seq 1 60); do
  sleep 10
  JOB_STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID \
    --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID \
    --region $REGION \
    --query 'ingestionJob.status' --output text 2>/dev/null)

  if [ "$JOB_STATUS" = "COMPLETE" ]; then
    echo "  ✅ 同期完了"
    # 統計情報を表示
    aws bedrock-agent get-ingestion-job \
      --knowledge-base-id $KB_ID \
      --data-source-id $DS_ID \
      --ingestion-job-id $JOB_ID \
      --region $REGION \
      --query 'ingestionJob.statistics' --output table 2>/dev/null
    break
  elif [ "$JOB_STATUS" = "FAILED" ]; then
    echo "  ❌ 同期失敗"
    aws bedrock-agent get-ingestion-job \
      --knowledge-base-id $KB_ID \
      --data-source-id $DS_ID \
      --ingestion-job-id $JOB_ID \
      --region $REGION \
      --query 'ingestionJob.failureReasons' --output json 2>/dev/null
    exit 1
  fi
  echo "  [$i/60] Status: $JOB_STATUS"
done

echo ""
echo "========================================="
echo "✅ セットアップ完了"
echo "========================================="
echo "  KB ID: $KB_ID"
echo "  Data Source ID: $DS_ID"
echo "  S3 AP Name: $S3AP_NAME"
echo "  S3 AP Alias: $S3AP_ALIAS"
echo ""
echo "次のステップ:"
echo "  1. demo-data/scripts/setup-user-access.sh でユーザーSIDデータを登録"
echo "  2. demo-data/scripts/create-demo-users.sh でCognitoユーザーを作成"
echo "  3. ブラウザでアクセスしてPermission-aware RAGを検証"
