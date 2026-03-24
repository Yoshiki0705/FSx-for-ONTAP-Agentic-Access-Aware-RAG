#!/bin/bash
set -euo pipefail

# ============================================================
# ユーザーアクセス（SID）データセットアップスクリプト
# ============================================================
# DynamoDB user-accessテーブルにユーザーごとのSID情報を登録する。
# SIDはNTFS ACLにおけるセキュリティ識別子で、
# ファイルアクセス権限の判定に使用される。
#
# SID構造:
#   S-1-5-21-{ドメインID}-{RID}
#   - S-1-1-0: Everyone（全ユーザー共通）
#   - S-1-5-21-...-500: Administrator
#   - S-1-5-21-...-512: Domain Admins グループ
#   - S-1-5-21-...-1001: 一般ユーザー
#   - S-1-5-21-...-1100: Engineering グループ
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 設定
TABLE_NAME="${USER_ACCESS_TABLE_NAME:?環境変数 USER_ACCESS_TABLE_NAME を設定してください}"
REGION="${AWS_REGION:-ap-northeast-1}"

# ユーザーID（アプリケーションのJWTではメールアドレスがuserIdとして使用される）
ADMIN_USER_ID="${ADMIN_USER_ID:-admin@example.com}"
REGULAR_USER_ID="${REGULAR_USER_ID:-user@example.com}"

# ドメインSID（テスト環境用の固定値）
DOMAIN_SID="S-1-5-21-0000000000-0000000000-0000000000"

echo "=========================================="
echo "ユーザーアクセス（SID）データセットアップ"
echo "=========================================="
echo "テーブル名: ${TABLE_NAME}"
echo "リージョン: ${REGION}"
echo "管理者ユーザーID: ${ADMIN_USER_ID}"
echo "一般ユーザーID: ${REGULAR_USER_ID}"
echo ""

# ========================================
# 管理者ユーザー（admin@example.com）
# ========================================
# SID割り当て:
#   - 個人SID: S-1-5-21-...-500 (Administrator)
#   - グループ: S-1-5-21-...-512 (Domain Admins)
#   - グループ: S-1-1-0 (Everyone)
# → confidential, restricted, public すべてのドキュメントにアクセス可能
echo "📝 管理者ユーザーのSIDデータを登録中..."
aws dynamodb put-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --item '{
    "userId": {"S": "'"${ADMIN_USER_ID}"'"},
    "userSID": {"S": "'"${DOMAIN_SID}-500"'"},
    "groupSIDs": {"L": [
      {"S": "'"${DOMAIN_SID}-512"'"},
      {"S": "S-1-1-0"}
    ]},
    "displayName": {"S": "Admin User"},
    "email": {"S": "admin@example.com"},
    "source": {"S": "Demo"},
    "createdAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},
    "updatedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'

echo "  ✅ admin@example.com"
echo "     個人SID: ${DOMAIN_SID}-500 (Administrator)"
echo "     グループ: ${DOMAIN_SID}-512 (Domain Admins), S-1-1-0 (Everyone)"
echo ""

# ========================================
# 一般ユーザー（user@example.com）
# ========================================
# SID割り当て:
#   - 個人SID: S-1-5-21-...-1001 (Regular User)
#   - グループ: S-1-1-0 (Everyone)
# → public ドキュメントのみアクセス可能
echo "📝 一般ユーザーのSIDデータを登録中..."
aws dynamodb put-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --item '{
    "userId": {"S": "'"${REGULAR_USER_ID}"'"},
    "userSID": {"S": "'"${DOMAIN_SID}-1001"'"},
    "groupSIDs": {"L": [
      {"S": "S-1-1-0"}
    ]},
    "displayName": {"S": "Regular User"},
    "email": {"S": "user@example.com"},
    "source": {"S": "Demo"},
    "createdAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},
    "updatedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'

echo "  ✅ user@example.com"
echo "     個人SID: ${DOMAIN_SID}-1001 (Regular User)"
echo "     グループ: S-1-1-0 (Everyone)"
echo ""

# ========================================
# 登録結果の確認
# ========================================
echo "=========================================="
echo "📊 登録データの確認"
echo "=========================================="

echo ""
echo "--- 管理者ユーザー ---"
aws dynamodb get-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --key '{"userId": {"S": "'"${ADMIN_USER_ID}"'"}}' \
  --output json | python3 -c "
import sys, json
item = json.load(sys.stdin).get('Item', {})
print(f'  userId: {item.get(\"userId\", {}).get(\"S\", \"N/A\")}')
print(f'  userSID: {item.get(\"userSID\", {}).get(\"S\", \"N/A\")}')
sids = [s.get('S','') for s in item.get('groupSIDs', {}).get('L', [])]
print(f'  groupSIDs: {sids}')
print(f'  displayName: {item.get(\"displayName\", {}).get(\"S\", \"N/A\")}')
" 2>/dev/null || echo "  (python3が利用できないため詳細表示をスキップ)"

echo ""
echo "--- 一般ユーザー ---"
aws dynamodb get-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --key '{"userId": {"S": "'"${REGULAR_USER_ID}"'"}}' \
  --output json | python3 -c "
import sys, json
item = json.load(sys.stdin).get('Item', {})
print(f'  userId: {item.get(\"userId\", {}).get(\"S\", \"N/A\")}')
print(f'  userSID: {item.get(\"userSID\", {}).get(\"S\", \"N/A\")}')
sids = [s.get('S','') for s in item.get('groupSIDs', {}).get('L', [])]
print(f'  groupSIDs: {sids}')
print(f'  displayName: {item.get(\"displayName\", {}).get(\"S\", \"N/A\")}')
" 2>/dev/null || echo "  (python3が利用できないため詳細表示をスキップ)"

echo ""
echo "=========================================="
echo "✅ ユーザーアクセスデータセットアップ完了"
echo "=========================================="
echo ""
echo "SIDとドキュメントの対応関係:"
echo "  public/     → allowed_group_sids: [S-1-1-0 (Everyone)]"
echo "               → admin: ✅  user: ✅"
echo "  confidential/ → allowed_group_sids: [${DOMAIN_SID}-512 (Domain Admins)]"
echo "               → admin: ✅  user: ❌"
echo "  restricted/ → allowed_group_sids: [${DOMAIN_SID}-1100 (Engineering), ${DOMAIN_SID}-512 (Domain Admins)]"
echo "               → admin: ✅  user: ❌"
