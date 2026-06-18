#!/bin/bash
set -euo pipefail

# ============================================
# v4 デプロイ検証スクリプト
# 全機能フラグとAWSリソースの正常性を確認
# ============================================
# 使用方法: bash demo-data/scripts/verify-deployment.sh [stack-prefix]
# 例: bash demo-data/scripts/verify-deployment.sh v4-test-demo

STACK_PREFIX="${1:-v4-test-demo}"
REGION="${AWS_REGION:-ap-northeast-1}"
PASS=0
FAIL=0
SKIP=0

green() { echo -e "\033[32m✅ $1\033[0m"; PASS=$((PASS+1)); }
red()   { echo -e "\033[31m❌ $1\033[0m"; FAIL=$((FAIL+1)); }
yellow(){ echo -e "\033[33m⚠️  $1\033[0m"; SKIP=$((SKIP+1)); }
header(){ echo -e "\n\033[1;36m=== $1 ===\033[0m"; }

header "1. CloudFormation スタック状態"
for STACK in Waf Networking Storage Security AI WebApp; do
  if [[ "$STACK" == "Waf" ]]; then
    STACK_REGION="us-east-1"
  else
    STACK_REGION="$REGION"
  fi
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_PREFIX}-${STACK}" \
    --region "$STACK_REGION" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
  if [[ "$STATUS" == *"COMPLETE"* ]]; then
    green "${STACK_PREFIX}-${STACK}: $STATUS"
  else
    red "${STACK_PREFIX}-${STACK}: $STATUS"
  fi
done

header "2. Lambda 環境変数 (機能フラグ)"
LAMBDA_NAME="${STACK_PREFIX}-webapp"
ENV_JSON=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" --region "$REGION" \
  --query 'Environment.Variables' --output json 2>/dev/null || echo "{}")

check_env() {
  local key="$1" expected="$2"
  local actual
  actual=$(echo "$ENV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$key','(not set)'))" 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then
    green "$key = $actual"
  else
    red "$key = $actual (expected: $expected)"
  fi
}

check_env "VOICE_CHAT_ENABLED" "true"
check_env "AGENT_POLICY_ENABLED" "true"
check_env "POLICY_FAILURE_MODE" "fail-open"
check_env "EPISODIC_MEMORY_ENABLED" "true"
check_env "GUARDRAILS_ENABLED" "true"
check_env "ENABLE_AGENT_REGISTRY" "true"
check_env "AGENT_REGISTRY_REGION" "ap-northeast-1"

GUARDRAIL_ID=$(echo "$ENV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('GUARDRAIL_ID',''))" 2>/dev/null)
if [[ -n "$GUARDRAIL_ID" ]]; then
  green "GUARDRAIL_ID = $GUARDRAIL_ID"
else
  red "GUARDRAIL_ID is not set"
fi

SUPERVISOR_ID=$(echo "$ENV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('SUPERVISOR_AGENT_ID',''))" 2>/dev/null)
if [[ -n "$SUPERVISOR_ID" ]]; then
  green "SUPERVISOR_AGENT_ID = $SUPERVISOR_ID"
else
  red "SUPERVISOR_AGENT_ID is not set"
fi

header "3. Bedrock Agent 一覧"
AGENTS=$(aws bedrock-agent list-agents --region "$REGION" \
  --query "agentSummaries[?contains(agentName,'${STACK_PREFIX}')].{Name:agentName,Id:agentId,Status:agentStatus}" \
  --output json 2>/dev/null || echo "[]")
AGENT_COUNT=$(echo "$AGENTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)

if [[ "$AGENT_COUNT" -ge 6 ]]; then
  green "Bedrock Agents: $AGENT_COUNT 個検出"
  echo "$AGENTS" | python3 -c "
import sys,json
for a in json.load(sys.stdin):
    status = '✅' if a['Status'] == 'PREPARED' else '⚠️'
    print(f\"  {status} {a['Name']} ({a['Id']}) - {a['Status']}\")
" 2>/dev/null
else
  red "Bedrock Agents: $AGENT_COUNT 個 (6個以上期待)"
fi

header "4. AgentCore Memory"
AI_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-AI" --region "$REGION" \
  --query 'Stacks[0].Outputs' --output json 2>/dev/null || echo "[]")

MEMORY_ID=$(echo "$AI_OUTPUTS" | python3 -c "
import sys,json
for o in json.load(sys.stdin):
    if 'MemoryId' in o.get('OutputKey',''):
        print(o['OutputValue']); break
" 2>/dev/null)

if [[ -n "$MEMORY_ID" ]]; then
  green "AgentCore Memory ID: $MEMORY_ID"
else
  red "AgentCore Memory ID not found"
fi

EPISODIC=$(echo "$AI_OUTPUTS" | python3 -c "
import sys,json
for o in json.load(sys.stdin):
    if o.get('OutputKey','') == 'EpisodicMemoryEnabled':
        print(o['OutputValue']); break
" 2>/dev/null)

if [[ "$EPISODIC" == "true" ]]; then
  green "Episodic Memory: enabled"
else
  yellow "Episodic Memory: $EPISODIC"
fi

header "5. Guardrails"
if [[ -n "$GUARDRAIL_ID" ]]; then
  GR_STATUS=$(aws bedrock get-guardrail --guardrail-identifier "$GUARDRAIL_ID" \
    --region "$REGION" --query 'status' --output text 2>/dev/null || echo "ERROR")
  if [[ "$GR_STATUS" == "READY" ]]; then
    green "Guardrail $GUARDRAIL_ID: $GR_STATUS"
  else
    red "Guardrail $GUARDRAIL_ID: $GR_STATUS"
  fi
else
  yellow "Guardrail ID not set, skipping"
fi

header "6. CloudWatch ダッシュボード"
DASHBOARD=$(aws cloudwatch get-dashboard \
  --dashboard-name "${STACK_PREFIX}-monitoring" --region "$REGION" \
  --query 'DashboardBody' --output text 2>/dev/null || echo "")

if [[ -n "$DASHBOARD" ]]; then
  for SECTION in "Guardrails" "AgentCore Policy" "Lambda Overview" "CloudFront" "Bedrock"; do
    if echo "$DASHBOARD" | grep -q "$SECTION"; then
      green "Dashboard section: $SECTION"
    else
      red "Dashboard section missing: $SECTION"
    fi
  done
else
  red "Dashboard not found: ${STACK_PREFIX}-monitoring"
fi

header "7. CloudFront Distribution"
WEBAPP_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-WebApp" --region "$REGION" \
  --query 'Stacks[0].Outputs' --output json 2>/dev/null || echo "[]")

CF_URL=$(echo "$WEBAPP_OUTPUTS" | python3 -c "
import sys,json
for o in json.load(sys.stdin):
    if o.get('OutputKey','') == 'CloudFrontUrl':
        print(o['OutputValue']); break
" 2>/dev/null)

if [[ -n "$CF_URL" ]]; then
  green "CloudFront URL: $CF_URL"
else
  red "CloudFront URL not found"
fi

header "8. DynamoDB テーブル"
for TABLE in "user-access" "agent-teams"; do
  TABLE_STATUS=$(aws dynamodb describe-table \
    --table-name "${STACK_PREFIX}-${TABLE}" --region "$REGION" \
    --query 'Table.TableStatus' --output text 2>/dev/null || echo "NOT_FOUND")
  if [[ "$TABLE_STATUS" == "ACTIVE" ]]; then
    green "DynamoDB ${STACK_PREFIX}-${TABLE}: $TABLE_STATUS"
  else
    red "DynamoDB ${STACK_PREFIX}-${TABLE}: $TABLE_STATUS"
  fi
done

header "検証結果サマリー"
echo -e "\033[32m✅ PASS: $PASS\033[0m"
echo -e "\033[31m❌ FAIL: $FAIL\033[0m"
echo -e "\033[33m⚠️  SKIP: $SKIP\033[0m"
TOTAL=$((PASS+FAIL+SKIP))
echo "合計: $TOTAL チェック"

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n\033[1;32m🎉 全チェック合格！\033[0m"
  exit 0
else
  echo -e "\n\033[1;31m⚠️ $FAIL 件の問題があります\033[0m"
  exit 1
fi
