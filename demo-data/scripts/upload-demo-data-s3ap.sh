#!/bin/bash
set -euo pipefail
#
# FSx ONTAP S3 Access Point 経由でデモデータをアップロード
#
# 前提条件:
#   1. S3 Access Point が AVAILABLE 状態
#   2. demo-data/documents/ にドキュメント + .metadata.json が存在
#
# 使用方法:
#   bash demo-data/scripts/upload-demo-data-s3ap.sh

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"

echo "🔍 S3 Access Point 情報を取得中..."

S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)

S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text 2>/dev/null)

if [ -z "$S3AP_ALIAS" ] || [ "$S3AP_ALIAS" = "None" ]; then
  echo "❌ S3 AP Alias を取得できませんでした。"
  echo "   setup-kb-datasource.sh を先に実行してください。"
  exit 1
fi

echo "  S3 AP Name: $S3AP_NAME"
echo "  S3 AP Alias: $S3AP_ALIAS"

# S3 AP Alias を S3 バケット名として使用してアップロード
echo ""
echo "📤 デモデータをアップロード中..."
echo "   ソース: demo-data/documents/"
echo "   宛先: s3://${S3AP_ALIAS}/"

aws s3 sync demo-data/documents/ "s3://${S3AP_ALIAS}/" --region $REGION 2>&1

echo ""
echo "📂 アップロード済みファイル一覧:"
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region $REGION 2>&1

echo ""
echo "✅ デモデータのアップロード完了"
echo "   次のステップ: bash demo-data/scripts/setup-kb-datasource.sh"
