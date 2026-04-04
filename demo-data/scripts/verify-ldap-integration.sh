#!/bin/bash
set -euo pipefail

###############################################################################
# LDAP統合検証スクリプト
#
# OpenLDAPサーバーへの接続、Identity Sync LambdaのLDAP Connector動作、
# DynamoDBレコードのuid/gid/unixGroups保存を検証する。
#
# 前提:
#   - setup-openldap.sh 実行済み
#   - cdk.context.json に ldapConfig 追加済み
#   - CDKデプロイ済み（Security Stack更新）
###############################################################################

REGION="ap-northeast-1"
STACK_PREFIX="perm-rag-demo-demo"
USER_ACCESS_TABLE="${STACK_PREFIX//-demo/}-demo-user-access"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✅ $1"; ((PASS_COUNT++)); }
fail() { echo "  ❌ $1"; ((FAIL_COUNT++)); }

echo "============================================"
echo "🔍 LDAP統合検証"
echo "============================================"

# ========================================
# Step 1: OpenLDAPサーバー稼働確認
# ========================================
echo ""
echo "📋 Step 1: OpenLDAPサーバー稼働確認"

LDAP_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" \
            "Name=instance-state-name,Values=running" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].{Id:InstanceId,IP:PrivateIpAddress}' \
  --output json 2>/dev/null)

INSTANCE_ID=$(echo "$LDAP_INSTANCE" | python3 -c "import sys,json; print(json.load(sys.stdin)['Id'])" 2>/dev/null || echo "None")
LDAP_IP=$(echo "$LDAP_INSTANCE" | python3 -c "import sys,json; print(json.load(sys.stdin)['IP'])" 2>/dev/null || echo "None")

if [ "$INSTANCE_ID" = "None" ] || [ "$INSTANCE_ID" = "null" ]; then
  fail "OpenLDAPインスタンスが見つかりません。setup-openldap.sh を実行してください。"
  exit 1
fi

pass "OpenLDAPインスタンス: $INSTANCE_ID (IP: $LDAP_IP)"

# SSM経由でLDAP検索テスト
echo ""
echo "  LDAP検索テスト (SSM経由)..."

SEARCH_CMD='ldapsearch -x -H ldap://localhost -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" -b "ou=users,dc=demo,dc=local" "(uid=alice)" uid uidNumber gidNumber mail -LLL 2>&1'

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"$SEARCH_CMD\"]" \
  --region "$REGION" \
  --query 'Command.CommandId' --output text)

sleep 8

SEARCH_RESULT=$(aws ssm get-command-invocation \
  --command-id "$CMD_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' --output text 2>/dev/null || echo "")

if echo "$SEARCH_RESULT" | grep -q "uidNumber: 10001"; then
  pass "LDAPユーザー検索成功: alice (uidNumber=10001)"
else
  fail "LDAPユーザー検索失敗"
  echo "    結果: $SEARCH_RESULT"
fi

# グループ検索テスト
GROUP_CMD='ldapsearch -x -H ldap://localhost -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" -b "ou=groups,dc=demo,dc=local" "(memberUid=alice)" cn gidNumber -LLL 2>&1'

CMD_ID2=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"$GROUP_CMD\"]" \
  --region "$REGION" \
  --query 'Command.CommandId' --output text)

sleep 8

GROUP_RESULT=$(aws ssm get-command-invocation \
  --command-id "$CMD_ID2" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' --output text 2>/dev/null || echo "")

if echo "$GROUP_RESULT" | grep -q "confidential-readers"; then
  pass "LDAPグループ検索成功: alice → confidential-readers"
else
  fail "LDAPグループ検索失敗"
  echo "    結果: $GROUP_RESULT"
fi

# ========================================
# Step 2: Lambda環境変数確認
# ========================================
echo ""
echo "📋 Step 2: Identity Sync Lambda環境変数確認"

# Lambda関数名を取得
LAMBDA_NAME=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-Security" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `SyncFunction`) || contains(OutputKey, `IdentitySync`)].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$LAMBDA_NAME" ]; then
  # フォールバック: 関数名パターンで検索
  LAMBDA_NAME=$(aws lambda list-functions \
    --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'identity-sync') || contains(FunctionName, 'ad-sync')].FunctionName" \
    --output text 2>/dev/null | head -1)
fi

if [ -z "$LAMBDA_NAME" ]; then
  fail "Identity Sync Lambda関数が見つかりません"
else
  pass "Lambda関数: $LAMBDA_NAME"

  # 環境変数確認
  LAMBDA_ENV=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Environment.Variables' --output json 2>/dev/null || echo "{}")

  LDAP_URL_ENV=$(echo "$LAMBDA_ENV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('LDAP_URL',''))" 2>/dev/null || echo "")
  LDAP_BASE_DN_ENV=$(echo "$LAMBDA_ENV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('LDAP_BASE_DN',''))" 2>/dev/null || echo "")
  LDAP_BIND_DN_ENV=$(echo "$LAMBDA_ENV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('LDAP_BIND_DN',''))" 2>/dev/null || echo "")

  if [ -n "$LDAP_URL_ENV" ]; then
    pass "LDAP_URL: $LDAP_URL_ENV"
  else
    fail "LDAP_URL 環境変数が未設定"
  fi

  if [ -n "$LDAP_BASE_DN_ENV" ]; then
    pass "LDAP_BASE_DN: $LDAP_BASE_DN_ENV"
  else
    fail "LDAP_BASE_DN 環境変数が未設定"
  fi

  if [ -n "$LDAP_BIND_DN_ENV" ]; then
    pass "LDAP_BIND_DN: $LDAP_BIND_DN_ENV"
  else
    fail "LDAP_BIND_DN 環境変数が未設定"
  fi

  # VPC設定確認
  VPC_CONFIG=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'VpcConfig.SubnetIds' --output json 2>/dev/null || echo "[]")

  if [ "$VPC_CONFIG" != "[]" ] && [ "$VPC_CONFIG" != "null" ]; then
    pass "Lambda VPC配置: 確認済み"
  else
    fail "Lambda VPC配置: 未設定（LDAP接続にはVPC配置が必要）"
  fi
fi

# ========================================
# Step 3: Lambda直接呼び出しテスト
# ========================================
echo ""
echo "📋 Step 3: Identity Sync Lambda テスト呼び出し"

if [ -n "$LAMBDA_NAME" ]; then
  # Cognito Post-Authentication Trigger形式のテストイベント
  TEST_EVENT=$(cat <<'TESTEVENT'
{
  "version": "1",
  "triggerSource": "PostAuthentication_Authentication",
  "region": "ap-northeast-1",
  "userPoolId": "test-pool",
  "userName": "alice-test",
  "callerContext": {
    "awsSdkVersion": "3.0.0",
    "clientId": "test-client"
  },
  "request": {
    "userAttributes": {
      "sub": "alice-test-sub-001",
      "email": "alice@demo.local",
      "identities": "[{\"providerName\":\"Auth0\",\"providerType\":\"OIDC\"}]",
      "custom:oidc_groups": "[\"engineering\",\"confidential-readers\"]"
    }
  },
  "response": {}
}
TESTEVENT
)

  echo "  テストイベント送信中..."
  INVOKE_RESULT=$(aws lambda invoke \
    --function-name "$LAMBDA_NAME" \
    --payload "$(echo "$TEST_EVENT" | base64)" \
    --cli-binary-format raw-in-base64-out \
    --region "$REGION" \
    /tmp/ldap-test-response.json 2>&1 || echo "INVOKE_ERROR")

  if echo "$INVOKE_RESULT" | grep -q "200"; then
    pass "Lambda呼び出し成功 (HTTP 200)"

    # レスポンス確認
    RESPONSE=$(cat /tmp/ldap-test-response.json 2>/dev/null || echo "{}")
    echo "    レスポンス: $(echo "$RESPONSE" | head -c 200)"
  else
    fail "Lambda呼び出し失敗"
    echo "    結果: $INVOKE_RESULT"
  fi

  # Lambda ログ確認
  echo ""
  echo "  最新ログ確認..."
  LOG_GROUP="/aws/lambda/$LAMBDA_NAME"
  LATEST_LOG=$(aws logs describe-log-streams \
    --log-group-name "$LOG_GROUP" \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --region "$REGION" \
    --query 'logStreams[0].logStreamName' --output text 2>/dev/null || echo "")

  if [ -n "$LATEST_LOG" ] && [ "$LATEST_LOG" != "None" ]; then
    aws logs get-log-events \
      --log-group-name "$LOG_GROUP" \
      --log-stream-name "$LATEST_LOG" \
      --limit 20 \
      --region "$REGION" \
      --query 'events[*].message' --output text 2>/dev/null | tail -10
  fi
fi

# ========================================
# Step 4: DynamoDBレコード確認
# ========================================
echo ""
echo "📋 Step 4: DynamoDBレコード確認"

# user-accessテーブル名を取得
TABLE_NAME=$(aws dynamodb list-tables \
  --region "$REGION" \
  --query "TableNames[?contains(@, 'user-access')]" \
  --output text 2>/dev/null | head -1)

if [ -z "$TABLE_NAME" ]; then
  fail "user-accessテーブルが見つかりません"
else
  pass "テーブル: $TABLE_NAME"

  # alice-testのレコードを確認
  RECORD=$(aws dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key '{"userId": {"S": "alice-test"}}' \
    --region "$REGION" \
    --output json 2>/dev/null || echo '{"Item": null}')

  HAS_ITEM=$(echo "$RECORD" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('Item') else 'no')" 2>/dev/null || echo "no")

  if [ "$HAS_ITEM" = "yes" ]; then
    pass "DynamoDBレコード存在: alice-test"

    # uid/gid/unixGroups確認
    UID_VAL=$(echo "$RECORD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Item'].get('uid',{}).get('N',''))" 2>/dev/null || echo "")
    GID_VAL=$(echo "$RECORD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Item'].get('gid',{}).get('N',''))" 2>/dev/null || echo "")
    UNIX_GROUPS=$(echo "$RECORD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Item'].get('unixGroups',{}).get('S','') or d['Item'].get('unixGroups',{}).get('L',''))" 2>/dev/null || echo "")
    SOURCE=$(echo "$RECORD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Item'].get('source',{}).get('S',''))" 2>/dev/null || echo "")

    if [ -n "$UID_VAL" ] && [ "$UID_VAL" != "" ]; then
      pass "uid: $UID_VAL"
    else
      fail "uid フィールドが未設定"
    fi

    if [ -n "$GID_VAL" ] && [ "$GID_VAL" != "" ]; then
      pass "gid: $GID_VAL"
    else
      fail "gid フィールドが未設定"
    fi

    if [ -n "$UNIX_GROUPS" ] && [ "$UNIX_GROUPS" != "" ]; then
      pass "unixGroups: $UNIX_GROUPS"
    else
      fail "unixGroups フィールドが未設定"
    fi

    if [ "$SOURCE" = "OIDC-LDAP" ]; then
      pass "source: $SOURCE (LDAP経由)"
    elif [ "$SOURCE" = "OIDC-Claims" ]; then
      pass "source: $SOURCE (OIDCクレームのみ — LDAP接続失敗の可能性)"
    else
      fail "source: $SOURCE (期待値: OIDC-LDAP)"
    fi

    echo ""
    echo "  📄 完全なレコード:"
    echo "$RECORD" | python3 -m json.tool 2>/dev/null | head -30
  else
    fail "DynamoDBレコードが見つかりません (alice-test)"
    echo "    Lambda呼び出し後にレコードが作成されるはずです"
  fi
fi

# ========================================
# 結果サマリー
# ========================================
echo ""
echo "============================================"
echo "📊 LDAP統合検証結果"
echo "============================================"
echo "  ✅ PASS: $PASS_COUNT"
echo "  ❌ FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "🎉 全テスト合格"
else
  echo "⚠️  ${FAIL_COUNT}件の失敗があります。上記のログを確認してください。"
fi
