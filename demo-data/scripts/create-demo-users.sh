#!/bin/bash
set -euo pipefail

# テストユーザー作成スクリプト
# Cognito User Poolにadminユーザーとrestrictedユーザーを作成する
#
# 注意: AD Federation（enableAdFederation=true）有効時は、ADユーザーが
# SAML経由でCognito User Poolに自動作成されるため、本スクリプトの実行は不要です。
# メール/パスワード認証のデモ・テスト用途でのみ使用してください。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/common.sh" 2>/dev/null || true

# 設定
USER_POOL_ID="${COGNITO_USER_POOL_ID:?環境変数 COGNITO_USER_POOL_ID を設定してください}"
REGION="${AWS_REGION:-ap-northeast-1}"

echo "=========================================="
echo "テストユーザー作成"
echo "=========================================="
echo "User Pool ID: ${USER_POOL_ID}"
echo "Region: ${REGION}"
echo ""

# adminユーザー作成
echo "📝 adminユーザーを作成中..."
aws cognito-idp admin-create-user \
  --user-pool-id "${USER_POOL_ID}" \
  --username "admin@example.com" \
  --user-attributes \
    Name=email,Value="admin@example.com" \
    Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region "${REGION}" || echo "  ⚠️ adminユーザーは既に存在します"

# adminユーザーのパスワードを確定
aws cognito-idp admin-set-user-password \
  --user-pool-id "${USER_POOL_ID}" \
  --username "admin@example.com" \
  --password "DemoAdmin123!" \
  --permanent \
  --region "${REGION}" 2>/dev/null || true

echo "  ✅ admin@example.com (パスワード: DemoAdmin123!)"

# restrictedユーザー作成
echo "📝 restrictedユーザーを作成中..."
aws cognito-idp admin-create-user \
  --user-pool-id "${USER_POOL_ID}" \
  --username "user@example.com" \
  --user-attributes \
    Name=email,Value="user@example.com" \
    Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region "${REGION}" || echo "  ⚠️ restrictedユーザーは既に存在します"

aws cognito-idp admin-set-user-password \
  --user-pool-id "${USER_POOL_ID}" \
  --username "user@example.com" \
  --password "DemoUser123!" \
  --permanent \
  --region "${REGION}" 2>/dev/null || true

echo "  ✅ user@example.com (パスワード: DemoUser123!)"

echo ""
echo "=========================================="
echo "✅ テストユーザー作成完了"
echo "=========================================="
echo ""
echo "ログイン情報:"
echo "  admin: admin@example.com / DemoAdmin123!"
echo "  user:  user@example.com / DemoUser123!"
