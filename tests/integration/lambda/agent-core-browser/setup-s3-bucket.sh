#!/bin/bash

###############################################################################
# Browser統合テスト用S3バケット作成スクリプト
#
# 用途: Browser Lambda Function統合テスト用のS3バケットを作成
# 作成者: Kiro AI
# 作成日: 2026-01-04
# バージョン: 1.0.0
###############################################################################

set -euo pipefail

# 色付きログ出力
log_info() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
log_warn() { echo -e "\033[0;33m[WARN]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# 設定
REGION="ap-northeast-1"
BUCKET_NAME="tokyoregion-permission-aware-rag-test-browser-screenshots"

log_info "Browser統合テスト用S3バケット作成を開始します"
log_info "バケット名: ${BUCKET_NAME}"
log_info "リージョン: ${REGION}"

# バケットの存在確認
if aws s3api head-bucket --bucket "${BUCKET_NAME}" --region "${REGION}" 2>/dev/null; then
  log_warn "S3バケット ${BUCKET_NAME} は既に存在します"
  log_info "既存のバケットを使用します"
else
  log_info "S3バケットを作成します..."
  
  # バケット作成
  aws s3api create-bucket \
    --bucket "${BUCKET_NAME}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
  
  log_info "S3バケット作成完了"
  
  # バージョニング有効化
  log_info "バージョニングを有効化します..."
  aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled \
    --region "${REGION}"
  
  # 暗号化設定
  log_info "暗号化を設定します..."
  aws s3api put-bucket-encryption \
    --bucket "${BUCKET_NAME}" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }]
    }' \
    --region "${REGION}"
  
  # ライフサイクルポリシー設定（テストデータは7日後に削除）
  log_info "ライフサイクルポリシーを設定します..."
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "${BUCKET_NAME}" \
    --lifecycle-configuration '{
      "Rules": [{
        "ID": "DeleteTestDataAfter7Days",
        "Status": "Enabled",
        "Prefix": "",
        "Expiration": {
          "Days": 7
        }
      }]
    }' \
    --region "${REGION}"
  
  log_info "S3バケット設定完了"
fi

# バケット情報表示
log_info "バケット情報:"
aws s3api get-bucket-location --bucket "${BUCKET_NAME}" --region "${REGION}"
aws s3api get-bucket-versioning --bucket "${BUCKET_NAME}" --region "${REGION}"

log_info "✅ Browser統合テスト用S3バケット準備完了"
log_info ""
log_info "次のステップ:"
log_info "1. cd tests/integration/lambda/agent-core-browser"
log_info "2. npm install"
log_info "3. npm test"
