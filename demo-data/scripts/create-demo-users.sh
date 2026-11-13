#!/bin/bash
set -euo pipefail

# テストユーザー作成スクリプト
# Cognito User Poolにadminユーザーとrestrictedユーザーを作成する
#
# 注意: AD Federation（enableAdFederation=true）有効時は、ADユーザーが
# SAML経由でCognito User Poolに自動作成されるため、本スクリプトの実行は不要です。
# メール/パスワード認証のデモ・テスト用途でのみ使用してください。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# A failing step must say which line stopped the script (set -e alone exits silently).
trap 'echo "❌ ${BASH_SOURCE[0]##*/}:${LINENO}: \"${BASH_COMMAND}\" が終了コード $? で失敗しました" >&2' ERR
if [ -f "${SCRIPT_DIR}/common.sh" ]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/common.sh"
fi

# 設定
USER_POOL_ID="${COGNITO_USER_POOL_ID:?環境変数 COGNITO_USER_POOL_ID を設定してください}"
REGION="${AWS_REGION:-ap-northeast-1}"

echo "=========================================="
echo "テストユーザー作成"
echo "=========================================="
echo "User Pool ID: ${USER_POOL_ID}"
echo "Region: ${REGION}"
echo ""

# A user that already exists is the only failure tolerated. Any other error from create or
# set-password stops the script with the line number (ERR trap above), instead of printing ✅.
create_user() {
  local email="$1" password="$2" label="$3" out
  echo "📝 ${label}ユーザーを作成中..."
  if ! out=$(aws cognito-idp admin-create-user \
      --user-pool-id "${USER_POOL_ID}" \
      --username "${email}" \
      --user-attributes Name=email,Value="${email}" Name=email_verified,Value=true \
      --temporary-password "TempPass123!" \
      --message-action SUPPRESS \
      --region "${REGION}" 2>&1); then
    if [[ "${out}" == *UsernameExistsException* ]]; then
      echo "  ⚠ ${label}ユーザーは既に存在します"
    else
      echo "❌ ${email} の作成に失敗しました: ${out}" >&2
      return 1
    fi
  fi
  if ! out=$(aws cognito-idp admin-set-user-password \
      --user-pool-id "${USER_POOL_ID}" \
      --username "${email}" \
      --password "${password}" \
      --permanent \
      --region "${REGION}" 2>&1); then
    echo "❌ ${email} のパスワード設定に失敗しました: ${out}" >&2
    return 1
  fi
  echo "  ✅ ${email} (パスワード: ${password})"
}

create_user "admin@example.com" "DemoAdmin123!" "admin"
create_user "user@example.com" "DemoUser123!" "restricted"
create_user "engineer@example.com" "DemoEngineer123!" "engineer"
create_user "finance@example.com" "DemoFinance123!" "finance"
create_user "auditor@example.com" "DemoAuditor123!" "auditor"
echo ""
echo "=========================================="
echo "✅ テストユーザー作成完了"
echo "=========================================="
echo ""
echo "ログイン情報:"
echo "  admin:    admin@example.com / DemoAdmin123!"
echo "  user:     user@example.com / DemoUser123!"
echo "  engineer: engineer@example.com / DemoEngineer123!"
echo "  finance:  finance@example.com / DemoFinance123!"
echo "  auditor:  auditor@example.com / DemoAuditor123!"
echo ""
echo "権限マトリクス:"
echo "  admin    → 全ドキュメント（Domain Admins）"
echo "  engineer → public + restricted（Engineering グループ）"
echo "  finance  → public + finance（Finance グループ）"
echo "  user     → public のみ（Everyone）"
echo "  auditor  → 全ドキュメント（監査用、全グループ所属）"
