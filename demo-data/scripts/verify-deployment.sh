#!/bin/bash
set -euo pipefail
#
# Permission-aware RAG デプロイ検証スクリプト
#
# CDKデプロイ + post-deploy-setup.sh 完了後に実行し、
# 全機能が正常に動作していることを自動検証します。
#
# 使用方法:
#   bash demo-data/scripts/verify-deployment.sh
#
# 出力:
#   - コンソールに検証結果を表示
#   - docs/test-results.md にテスト結果レポートを生成

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"
REPORT_FILE="docs/test-results.md"
PASS=0
FAIL=0
WARN=0
RESULTS=""

log_result() {
  local status="$1" test_name="$2" detail="$3"
  if [ "$status" = "PASS" ]; then
    echo "  ✅ $test_name"
    PASS=$((PASS + 1))
  elif [ "$status" = "FAIL" ]; then
    echo "  ❌ $test_name: $detail"
    FAIL=$((FAIL + 1))
  else
    echo "  ⚠️ $test_name: $detail"
    WARN=$((WARN + 1))
  fi
  RESULTS="${RESULTS}\n| ${status} | ${test_name} | ${detail} |"
}

echo "============================================"
echo "  Permission-aware RAG デプロイ検証"
echo "============================================"
echo "  Region: $REGION"
echo "  Stack: $STACK_PREFIX"
echo "  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ========================================
# 1. スタック状態チェック
# ========================================
echo "📋 1. スタック状態チェック..."
for STACK in Networking Security Storage AI WebApp; do
  STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${STACK} --region $REGION \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
  if [ "$STATUS" = "CREATE_COMPLETE" ] || [ "$STATUS" = "UPDATE_COMPLETE" ]; then
    log_result "PASS" "${STACK}Stack" "$STATUS"
  else
    log_result "FAIL" "${STACK}Stack" "$STATUS"
  fi
done
echo ""

# ========================================
# 2. リソース存在チェック
# ========================================
echo "📋 2. リソース存在チェック..."

LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text 2>/dev/null || echo "")
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null || echo "")
AGENT_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentId`].OutputValue' --output text 2>/dev/null || echo "")

[ -n "$LAMBDA_URL" ] && log_result "PASS" "Lambda Function URL" "$LAMBDA_URL" || log_result "FAIL" "Lambda Function URL" "Not found"
[ -n "$KB_ID" ] && log_result "PASS" "Knowledge Base" "$KB_ID" || log_result "FAIL" "Knowledge Base" "Not found"
if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "None" ]; then
  log_result "PASS" "Bedrock Agent" "$AGENT_ID"
else
  log_result "WARN" "Bedrock Agent" "Not deployed (enableAgent=false?)"
fi
echo ""

# ========================================
# 3. アプリケーション応答チェック
# ========================================
echo "📋 3. アプリケーション応答チェック..."

if [ -n "$LAMBDA_URL" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${LAMBDA_URL}ja/signin" 2>/dev/null || echo "000")
  [ "$HTTP_CODE" = "200" ] && log_result "PASS" "Signin page" "HTTP $HTTP_CODE" || log_result "FAIL" "Signin page" "HTTP $HTTP_CODE"
fi
echo ""

# ========================================
# 4. KBモード Permission-aware テスト
# ========================================
echo "📋 4. KBモード Permission-aware テスト..."

if [ -n "$LAMBDA_URL" ] && [ -n "$KB_ID" ]; then
  # Admin test
  ADMIN_RESP=$(curl -s --max-time 30 -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"財務状況\",\"userId\":\"admin@example.com\",\"knowledgeBaseId\":\"${KB_ID}\",\"region\":\"${REGION}\"}" 2>/dev/null || echo "{}")
  ADMIN_ALLOWED=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('filterLog',{}).get('allowedDocuments','?'))" 2>/dev/null || echo "?")
  ADMIN_TOTAL=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('filterLog',{}).get('totalDocuments','?'))" 2>/dev/null || echo "?")
  ADMIN_SUCCESS=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null || echo "False")

  if [ "$ADMIN_SUCCESS" = "True" ] && [ "$ADMIN_ALLOWED" != "0" ]; then
    log_result "PASS" "KB Admin SID filter" "${ADMIN_ALLOWED}/${ADMIN_TOTAL} allowed"
  else
    log_result "FAIL" "KB Admin SID filter" "success=$ADMIN_SUCCESS, allowed=$ADMIN_ALLOWED"
  fi

  # User test
  USER_RESP=$(curl -s --max-time 30 -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"財務状況\",\"userId\":\"user@example.com\",\"knowledgeBaseId\":\"${KB_ID}\",\"region\":\"${REGION}\"}" 2>/dev/null || echo "{}")
  USER_ALLOWED=$(echo "$USER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('filterLog',{}).get('allowedDocuments','?'))" 2>/dev/null || echo "?")
  USER_TOTAL=$(echo "$USER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('filterLog',{}).get('totalDocuments','?'))" 2>/dev/null || echo "?")

  if [ "$USER_ALLOWED" != "?" ] && [ "$USER_ALLOWED" -lt "$ADMIN_ALLOWED" ] 2>/dev/null; then
    log_result "PASS" "KB User SID filter" "${USER_ALLOWED}/${USER_TOTAL} allowed (< admin)"
  else
    log_result "FAIL" "KB User SID filter" "allowed=$USER_ALLOWED (expected < $ADMIN_ALLOWED)"
  fi
fi
echo ""

# ========================================
# 5. Agentモード Permission-aware テスト
# ========================================
echo "📋 5. Agentモード Permission-aware テスト..."

if [ -n "$LAMBDA_URL" ] && [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "None" ]; then
  # Admin Agent test
  AGENT_ADMIN=$(curl -s --max-time 60 -X POST "${LAMBDA_URL}api/bedrock/agent" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"財務状況\",\"userId\":\"admin@example.com\",\"sessionId\":\"verify-admin-$(date +%s)\",\"action\":\"invoke\"}" 2>/dev/null || echo "{}")
  AGENT_ADMIN_OK=$(echo "$AGENT_ADMIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null || echo "False")
  AGENT_ADMIN_LEN=$(echo "$AGENT_ADMIN" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('answer','')))" 2>/dev/null || echo "0")

  if [ "$AGENT_ADMIN_OK" = "True" ] && [ "$AGENT_ADMIN_LEN" -gt 10 ] 2>/dev/null; then
    log_result "PASS" "Agent Admin invoke" "Response length: $AGENT_ADMIN_LEN chars"
  else
    log_result "FAIL" "Agent Admin invoke" "success=$AGENT_ADMIN_OK, length=$AGENT_ADMIN_LEN"
  fi

  # Check Action Group Lambda logs
  AG_LOG=$(aws logs get-log-events --log-group-name /aws/lambda/${STACK_PREFIX}-perm-search \
    --log-stream-name $(aws logs describe-log-streams --log-group-name /aws/lambda/${STACK_PREFIX}-perm-search \
      --order-by LastEventTime --descending --limit 1 --region $REGION \
      --query 'logStreams[0].logStreamName' --output text 2>/dev/null) \
    --region $REGION --query 'events[-3:].message' --output text 2>/dev/null || echo "")
  AG_ALLOWED=$(echo "$AG_LOG" | grep -o "Allowed: [0-9]* / [0-9]*" | tail -1 || echo "")

  if [ -n "$AG_ALLOWED" ]; then
    log_result "PASS" "Action Group SID filter" "$AG_ALLOWED"
  else
    log_result "WARN" "Action Group SID filter" "Could not verify from logs"
  fi
else
  log_result "WARN" "Agent tests" "Agent not deployed, skipping"
fi
echo ""

# ========================================
# 6. S3 Access Point チェック
# ========================================
echo "📋 6. S3 Access Point チェック..."

S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text 2>/dev/null || echo "")
S3AP_STATUS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].Lifecycle" --output text 2>/dev/null || echo "")

if [ "$S3AP_STATUS" = "AVAILABLE" ]; then
  log_result "PASS" "S3 Access Point" "$S3AP_NAME ($S3AP_STATUS)"
else
  log_result "WARN" "S3 Access Point" "Status: ${S3AP_STATUS:-NOT_FOUND}"
fi
echo ""

# ========================================
# 7. エンタープライズAgent機能チェック（オプション）
# ========================================
echo "📋 7. エンタープライズAgent機能チェック..."

# S3共有Agentバケット
SHARED_BUCKET=$(aws lambda get-function-configuration --function-name ${STACK_PREFIX}-webapp --region $REGION \
  --query 'Environment.Variables.SHARED_AGENT_BUCKET' --output text 2>/dev/null || echo "")
if [ -n "$SHARED_BUCKET" ] && [ "$SHARED_BUCKET" != "None" ]; then
  aws s3api head-bucket --bucket "$SHARED_BUCKET" --region $REGION 2>/dev/null \
    && log_result "PASS" "Shared Agent Bucket" "$SHARED_BUCKET" \
    || log_result "FAIL" "Shared Agent Bucket" "$SHARED_BUCKET (not accessible)"
else
  log_result "WARN" "Shared Agent Bucket" "Not configured (enableAgentSharing=false?)"
fi

# DynamoDB実行履歴テーブル
EXEC_TABLE=$(aws lambda get-function-configuration --function-name ${STACK_PREFIX}-webapp --region $REGION \
  --query 'Environment.Variables.AGENT_EXECUTION_TABLE' --output text 2>/dev/null || echo "")
if [ -n "$EXEC_TABLE" ] && [ "$EXEC_TABLE" != "None" ]; then
  TABLE_STATUS=$(aws dynamodb describe-table --table-name "$EXEC_TABLE" --region $REGION \
    --query 'Table.TableStatus' --output text 2>/dev/null || echo "NOT_FOUND")
  [ "$TABLE_STATUS" = "ACTIVE" ] \
    && log_result "PASS" "Execution History Table" "$EXEC_TABLE ($TABLE_STATUS)" \
    || log_result "FAIL" "Execution History Table" "$EXEC_TABLE ($TABLE_STATUS)"
else
  log_result "WARN" "Execution History Table" "Not configured (enableAgentSchedules=false?)"
fi

# スケジューラLambda
SCHED_LAMBDA=$(aws lambda get-function-configuration --function-name ${STACK_PREFIX}-webapp --region $REGION \
  --query 'Environment.Variables.AGENT_SCHEDULER_LAMBDA_ARN' --output text 2>/dev/null || echo "")
if [ -n "$SCHED_LAMBDA" ] && [ "$SCHED_LAMBDA" != "None" ]; then
  SCHED_FN_NAME=$(echo "$SCHED_LAMBDA" | awk -F: '{print $NF}')
  SCHED_STATE=$(aws lambda get-function-configuration --function-name "$SCHED_FN_NAME" --region $REGION \
    --query 'State' --output text 2>/dev/null || echo "NOT_FOUND")
  [ "$SCHED_STATE" = "Active" ] \
    && log_result "PASS" "Scheduler Lambda" "$SCHED_FN_NAME ($SCHED_STATE)" \
    || log_result "FAIL" "Scheduler Lambda" "$SCHED_FN_NAME ($SCHED_STATE)"
else
  log_result "WARN" "Scheduler Lambda" "Not configured (enableAgentSchedules=false?)"
fi

# Agent Sharing API応答
if [ -n "$LAMBDA_URL" ] && [ -n "$SHARED_BUCKET" ] && [ "$SHARED_BUCKET" != "None" ]; then
  SHARING_RESP=$(curl -s --max-time 10 -X POST "${LAMBDA_URL}api/bedrock/agent-sharing" \
    -H "Content-Type: application/json" -d '{"action":"listSharedConfigs"}' 2>/dev/null || echo "{}")
  SHARING_OK=$(echo "$SHARING_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null || echo "False")
  [ "$SHARING_OK" = "True" ] \
    && log_result "PASS" "Agent Sharing API" "listSharedConfigs OK" \
    || log_result "FAIL" "Agent Sharing API" "Response: $SHARING_RESP"
fi

# Agent Schedules API応答
if [ -n "$LAMBDA_URL" ] && [ -n "$EXEC_TABLE" ] && [ "$EXEC_TABLE" != "None" ]; then
  SCHED_RESP=$(curl -s --max-time 10 -X POST "${LAMBDA_URL}api/bedrock/agent-schedules" \
    -H "Content-Type: application/json" -d '{"action":"listSchedules"}' 2>/dev/null || echo "{}")
  SCHED_OK=$(echo "$SCHED_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null || echo "False")
  [ "$SCHED_OK" = "True" ] \
    && log_result "PASS" "Agent Schedules API" "listSchedules OK" \
    || log_result "FAIL" "Agent Schedules API" "Response: $SCHED_RESP"
fi
echo ""

# ========================================
# 8. AgentCore Memory チェック（オプション）
# ========================================
echo "📋 8. AgentCore Memory チェック..."

MEMORY_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`MemoryId`].OutputValue' --output text 2>/dev/null || echo "")
ENABLE_MEMORY=$(aws lambda get-function-configuration --function-name ${STACK_PREFIX}-webapp --region $REGION \
  --query 'Environment.Variables.ENABLE_AGENTCORE_MEMORY' --output text 2>/dev/null || echo "")

if [ -n "$MEMORY_ID" ] && [ "$MEMORY_ID" != "None" ]; then
  log_result "PASS" "AgentCore Memory resource" "$MEMORY_ID"

  # Lambda環境変数チェック
  LAMBDA_MEMORY_ID=$(aws lambda get-function-configuration --function-name ${STACK_PREFIX}-webapp --region $REGION \
    --query 'Environment.Variables.AGENTCORE_MEMORY_ID' --output text 2>/dev/null || echo "")
  [ "$LAMBDA_MEMORY_ID" = "$MEMORY_ID" ] \
    && log_result "PASS" "Lambda AGENTCORE_MEMORY_ID" "$LAMBDA_MEMORY_ID" \
    || log_result "FAIL" "Lambda AGENTCORE_MEMORY_ID" "Expected: $MEMORY_ID, Got: $LAMBDA_MEMORY_ID"
  [ "$ENABLE_MEMORY" = "true" ] \
    && log_result "PASS" "Lambda ENABLE_AGENTCORE_MEMORY" "$ENABLE_MEMORY" \
    || log_result "FAIL" "Lambda ENABLE_AGENTCORE_MEMORY" "Expected: true, Got: $ENABLE_MEMORY"

  # Lambda IAM権限チェック（bedrock-agentcore:* ポリシーが含まれているか）
  ROLE_NAME=$(aws lambda get-function-configuration --function-name ${STACK_PREFIX}-webapp --region $REGION \
    --query 'Role' --output text 2>/dev/null | awk -F/ '{print $NF}')
  if [ -n "$ROLE_NAME" ]; then
    HAS_AGENTCORE_POLICY=$(aws iam list-role-policies --role-name "$ROLE_NAME" --region $REGION \
      --query 'PolicyNames' --output text 2>/dev/null || echo "")
    # インラインポリシーの内容を確認
    POLICY_HAS_AGENTCORE=false
    for POLICY in $HAS_AGENTCORE_POLICY; do
      POLICY_DOC=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY" --region $REGION \
        --query 'PolicyDocument' --output json 2>/dev/null || echo "{}")
      if echo "$POLICY_DOC" | grep -q "bedrock-agentcore"; then
        POLICY_HAS_AGENTCORE=true
        break
      fi
    done
    [ "$POLICY_HAS_AGENTCORE" = "true" ] \
      && log_result "PASS" "Lambda IAM bedrock-agentcore policy" "Found in role $ROLE_NAME" \
      || log_result "FAIL" "Lambda IAM bedrock-agentcore policy" "Missing in role $ROLE_NAME"
  fi

  # API応答チェック（501でないことを確認）
  if [ -n "$LAMBDA_URL" ]; then
    MEMORY_API_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${LAMBDA_URL}api/agentcore/memory/session" 2>/dev/null || echo "000")
    if [ "$MEMORY_API_CODE" != "501" ] && [ "$MEMORY_API_CODE" != "000" ]; then
      log_result "PASS" "AgentCore Memory API" "HTTP $MEMORY_API_CODE (enabled)"
    else
      log_result "FAIL" "AgentCore Memory API" "HTTP $MEMORY_API_CODE (expected non-501)"
    fi
  fi
else
  log_result "WARN" "AgentCore Memory" "Not deployed (enableAgentCoreMemory=false?)"
fi
echo ""

# ========================================
# 9. AD Federation チェック（オプション）
# ========================================
echo "📋 9. AD Federation チェック..."

# フェデレーション有効かどうかをCognito User Pool IdPで判定
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Security --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "None" ]; then
  # SAML IdP存在チェック
  SAML_PROVIDERS=$(aws cognito-idp list-identity-providers --user-pool-id "$USER_POOL_ID" --region $REGION \
    --query 'Providers[?ProviderType==`SAML`].ProviderName' --output text 2>/dev/null || echo "")

  if [ -n "$SAML_PROVIDERS" ] && [ "$SAML_PROVIDERS" != "None" ] && [ "$SAML_PROVIDERS" != "" ]; then
    log_result "PASS" "SAML IdP" "Provider: $SAML_PROVIDERS"

    # Post-Authentication Trigger接続チェック
    POST_AUTH_TRIGGER=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --region $REGION \
      --query 'UserPool.LambdaConfig.PostAuthentication' --output text 2>/dev/null || echo "")
    if [ -n "$POST_AUTH_TRIGGER" ] && [ "$POST_AUTH_TRIGGER" != "None" ] && [ "$POST_AUTH_TRIGGER" != "" ]; then
      TRIGGER_FN=$(echo "$POST_AUTH_TRIGGER" | awk -F: '{print $NF}')
      log_result "PASS" "Post-Auth Trigger" "$TRIGGER_FN"
    else
      log_result "FAIL" "Post-Auth Trigger" "Not connected"
    fi

    # SAML IdPメタデータURL形式チェック
    for PROVIDER in $SAML_PROVIDERS; do
      PROVIDER_DETAIL=$(aws cognito-idp describe-identity-provider --user-pool-id "$USER_POOL_ID" \
        --provider-name "$PROVIDER" --region $REGION \
        --query 'IdentityProvider.ProviderDetails.MetadataURL' --output text 2>/dev/null || echo "")
      if echo "$PROVIDER_DETAIL" | grep -q "portal.sso"; then
        log_result "PASS" "SAML Metadata (Managed AD)" "URL: portal.sso形式"
      elif [ -n "$PROVIDER_DETAIL" ] && [ "$PROVIDER_DETAIL" != "None" ]; then
        log_result "PASS" "SAML Metadata (Self-managed)" "URL: カスタムメタデータ"
      else
        log_result "WARN" "SAML Metadata" "メタデータURL取得不可"
      fi
    done
  else
    log_result "WARN" "AD Federation" "SAML IdP未設定（enableAdFederation=false?）"
  fi
fi
echo ""

# ========================================
# レポート生成
# ========================================
TOTAL=$((PASS + FAIL + WARN))
echo "============================================"
echo "  検証結果: $PASS/$TOTAL PASS, $FAIL FAIL, $WARN WARN"
echo "============================================"

# Markdownレポート生成
cat > "$REPORT_FILE" << EOF
# テスト結果レポート

**実行日時**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**リージョン**: $REGION
**スタック**: $STACK_PREFIX

## サマリー

| 結果 | 件数 |
|------|------|
| ✅ PASS | $PASS |
| ❌ FAIL | $FAIL |
| ⚠️ WARN | $WARN |
| **合計** | **$TOTAL** |

## 詳細結果

| Status | Test | Detail |
|--------|------|--------|$(echo -e "$RESULTS")

## 環境情報

| 項目 | 値 |
|------|-----|
| Lambda URL | $LAMBDA_URL |
| KB ID | $KB_ID |
| Agent ID | ${AGENT_ID:-N/A} |
| S3 AP | ${S3AP_NAME:-N/A} (${S3AP_STATUS:-N/A}) |

## KBモード検証詳細

### Admin (admin@example.com)
- SIDフィルタ: ${ADMIN_ALLOWED:-?}/${ADMIN_TOTAL:-?} allowed
- フィルタ方式: SID_MATCHING

### User (user@example.com)
- SIDフィルタ: ${USER_ALLOWED:-?}/${USER_TOTAL:-?} allowed
- フィルタ方式: SID_MATCHING

## Agentモード検証詳細

### Agent情報
- Agent ID: ${AGENT_ID:-N/A}
- Action Group Lambda: ${STACK_PREFIX}-perm-search
- Action Group SIDフィルタ: ${AG_ALLOWED:-N/A}

---
*Generated by verify-deployment.sh*
EOF

echo ""
echo "📄 レポート生成: $REPORT_FILE"

if [ "$FAIL" -gt 0 ]; then
  echo "❌ $FAIL 件のテストが失敗しました"
  exit 1
else
  echo "✅ 全テスト合格"
  exit 0
fi
