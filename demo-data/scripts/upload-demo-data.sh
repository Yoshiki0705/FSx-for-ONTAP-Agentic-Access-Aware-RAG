#!/bin/bash
set -euo pipefail

# サンプルドキュメントをS3にアップロードするスクリプト

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="${SCRIPT_DIR}/../documents"

# 設定
BUCKET_NAME="${DATA_BUCKET_NAME:?環境変数 DATA_BUCKET_NAME を設定してください}"
REGION="${AWS_REGION:-ap-northeast-1}"

echo "=========================================="
echo "デモデータアップロード"
echo "=========================================="
echo "Bucket: ${BUCKET_NAME}"
echo "Region: ${REGION}"
echo ""

# ドキュメントとメタデータをアップロード
for dir in public confidential restricted; do
  echo "📂 ${dir}/ をアップロード中..."
  aws s3 sync "${DOCS_DIR}/${dir}/" "s3://${BUCKET_NAME}/${dir}/" \
    --region "${REGION}"
  echo "  ✅ ${dir}/ アップロード完了"
done

echo ""
echo "=========================================="
echo "✅ デモデータアップロード完了"
echo "=========================================="
echo ""

# アップロード結果確認
echo "📊 アップロード済みファイル:"
aws s3 ls "s3://${BUCKET_NAME}/" --recursive --region "${REGION}"
