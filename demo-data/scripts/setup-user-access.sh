#!/bin/bash
set -euo pipefail

# ============================================================
# ユーザーアクセス（SID）データセットアップスクリプト
# ============================================================
# DynamoDB user-accessテーブルにユーザーごとのSID情報を登録する。
# SIDはNTFS ACLにおけるセキュリティ識別子で、
# ファイルアクセス権限の判定に使用される。
#
# 注意: AD Federation + Post-Auth Trigger（enableAdFederation=true）有効時は、
# ADユーザーのサインイン時にPost-Authentication TriggerがAD Sync Lambdaを呼び出し、
# SIDデータがDynamoDBに自動登録されるため、本スクリプトの実行は不要です。
# 初回サインイン前のデモデータ事前登録用途でのみ使用してください。
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
# エンジニアリングユーザー（engineer@example.com）
# ========================================
# SID割り当て:
#   - 個人SID: S-1-5-21-...-1501 (Engineer)
#   - グループ: S-1-5-21-...-1100 (Engineering)
#   - グループ: S-1-1-0 (Everyone)
# → public + restricted（Engineering）ドキュメントにアクセス可能
echo "📝 エンジニアリングユーザーのSIDデータを登録中..."
aws dynamodb put-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --item '{
    "userId": {"S": "engineer@example.com"},
    "userSID": {"S": "'"${DOMAIN_SID}-1501"'"},
    "groupSIDs": {"L": [
      {"S": "'"${DOMAIN_SID}-1100"'"},
      {"S": "S-1-1-0"}
    ]},
    "displayName": {"S": "Engineer User"},
    "email": {"S": "engineer@example.com"},
    "source": {"S": "Demo"},
    "createdAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},
    "updatedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'

echo "  ✅ engineer@example.com"
echo "     個人SID: ${DOMAIN_SID}-1501 (Engineer)"
echo "     グループ: ${DOMAIN_SID}-1100 (Engineering), S-1-1-0 (Everyone)"
echo ""

# ========================================
# 財務ユーザー（finance@example.com）
# ========================================
# SID割り当て:
#   - 個人SID: S-1-5-21-...-1502 (Finance Staff)
#   - グループ: S-1-5-21-...-1200 (Finance)
#   - グループ: S-1-1-0 (Everyone)
# → public + finance ドキュメントにアクセス可能
echo "📝 財務ユーザーのSIDデータを登録中..."
aws dynamodb put-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --item '{
    "userId": {"S": "finance@example.com"},
    "userSID": {"S": "'"${DOMAIN_SID}-1502"'"},
    "groupSIDs": {"L": [
      {"S": "'"${DOMAIN_SID}-1200"'"},
      {"S": "S-1-1-0"}
    ]},
    "displayName": {"S": "Finance User"},
    "email": {"S": "finance@example.com"},
    "source": {"S": "Demo"},
    "createdAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},
    "updatedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'

echo "  ✅ finance@example.com"
echo "     個人SID: ${DOMAIN_SID}-1502 (Finance Staff)"
echo "     グループ: ${DOMAIN_SID}-1200 (Finance), S-1-1-0 (Everyone)"
echo ""

# ========================================
# 監査ユーザー（auditor@example.com）
# ========================================
# SID割り当て:
#   - 個人SID: S-1-5-21-...-1503 (Auditor)
#   - グループ: S-1-5-21-...-1900 (Auditors — 全ドキュメント読み取り可)
#   - グループ: S-1-5-21-...-512 (Domain Admins)
#   - グループ: S-1-5-21-...-1100 (Engineering)
#   - グループ: S-1-5-21-...-1200 (Finance)
#   - グループ: S-1-1-0 (Everyone)
# → 全ドキュメントにアクセス可能（監査目的の読み取り専用）
echo "📝 監査ユーザーのSIDデータを登録中..."
aws dynamodb put-item \
  --table-name "${TABLE_NAME}" \
  --region "${REGION}" \
  --item '{
    "userId": {"S": "auditor@example.com"},
    "userSID": {"S": "'"${DOMAIN_SID}-1503"'"},
    "groupSIDs": {"L": [
      {"S": "'"${DOMAIN_SID}-1900"'"},
      {"S": "'"${DOMAIN_SID}-512"'"},
      {"S": "'"${DOMAIN_SID}-1100"'"},
      {"S": "'"${DOMAIN_SID}-1200"'"},
      {"S": "S-1-1-0"}
    ]},
    "displayName": {"S": "Auditor User"},
    "email": {"S": "auditor@example.com"},
    "source": {"S": "Demo"},
    "createdAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},
    "updatedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'

echo "  ✅ auditor@example.com"
echo "     個人SID: ${DOMAIN_SID}-1503 (Auditor)"
echo "     グループ: ${DOMAIN_SID}-1900 (Auditors), -512 (DA), -1100 (Eng), -1200 (Fin), S-1-1-0 (Everyone)"
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
echo "  public/       → allowed_group_sids: [S-1-1-0 (Everyone)]"
echo "                 → admin: ✅  engineer: ✅  finance: ✅  user: ✅  auditor: ✅"
echo "  confidential/ → allowed_group_sids: [${DOMAIN_SID}-512 (Domain Admins)]"
echo "                 → admin: ✅  engineer: ❌  finance: ❌  user: ❌  auditor: ✅"
echo "  restricted/   → allowed_group_sids: [${DOMAIN_SID}-1100 (Engineering), ${DOMAIN_SID}-512 (Domain Admins)]"
echo "                 → admin: ✅  engineer: ✅  finance: ❌  user: ❌  auditor: ✅"
echo "  finance/      → allowed_group_sids: [${DOMAIN_SID}-1200 (Finance), ${DOMAIN_SID}-512 (Domain Admins)]"
echo "                 → admin: ✅  engineer: ❌  finance: ✅  user: ❌  auditor: ✅"
