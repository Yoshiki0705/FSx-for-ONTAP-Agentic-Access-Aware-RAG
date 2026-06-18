#!/bin/bash
set -euo pipefail

# v4.2 デモ検証テストスクリプト
# 目的: 各ユースケースの動作確認ログを取得し、マスク済みで公開可能にする
#
# 前提条件:
#   - CDKスタックがデプロイ済み（enableTransferFamily=true, enableKbAutoSync=true）
#   - post-deploy-setup.sh 実行済み
#   - AWS CLI 認証済み
#
# 使用方法:
#   bash demo-data/scripts/v4.2-verification-test.sh [--stack-prefix PREFIX] [--region REGION]

STACK_PREFIX="${1:-v4-test-demo}"
REGION="${2:-ap-northeast-1}"
OUTPUT_DIR="docs/verification-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "============================================"
echo "v4.2 Verification Test Suite"
echo "Stack Prefix: ${STACK_PREFIX}"
echo "Region: ${REGION}"
echo "Timestamp: ${TIMESTAMP}"
echo "============================================"

mkdir -p "${OUTPUT_DIR}"

# ============================================
# Helper functions
# ============================================

mask_account_id() {
  sed -E 's/[0-9]{12}/XXXXXXXXXXXX/g'
}

mask_ip() {
  sed -E 's/([0-9]{1,3}\.){3}[0-9]{1,3}/xxx.xxx.xxx.xxx/g'
}

mask_all() {
  mask_account_id | mask_ip | sed -E 's/s-[a-f0-9]{17}/s-XXXXXXXXXXXXXXXXX/g' | sed -E 's/(ap-northeast-1_)[A-Za-z0-9]+/\1XXXXXXXXX/g'
}

log_step() {
  echo ""
  echo "--- [$1] $2 ---"
}

# ============================================
# Test 1: Smart Routing
# ============================================

log_step "1" "Smart Routing - CloudWatch Metrics"

WEBAPP_FUNCTION=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-WebApp" \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`FunctionName`)].OutputValue' \
  --output text --region "${REGION}" 2>/dev/null || echo "NOT_DEPLOYED")

if [ "${WEBAPP_FUNCTION}" != "NOT_DEPLOYED" ] && [ -n "${WEBAPP_FUNCTION}" ]; then
  echo "WebApp Lambda: ${WEBAPP_FUNCTION}"
  
  # Get Smart Routing metrics
  aws cloudwatch get-metric-statistics \
    --namespace SmartRouting \
    --metric-name RoutingCount \
    --dimensions Name=RoutingTier,Value=simple \
    --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
    --period 3600 \
    --statistics Sum \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/smart-routing-simple-metrics-${TIMESTAMP}.json" || echo "  No metrics found"

  aws cloudwatch get-metric-statistics \
    --namespace SmartRouting \
    --metric-name RoutingCount \
    --dimensions Name=RoutingTier,Value=complex \
    --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
    --period 3600 \
    --statistics Sum \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/smart-routing-complex-metrics-${TIMESTAMP}.json" || echo "  No metrics found"

  aws cloudwatch get-metric-statistics \
    --namespace SmartRouting \
    --metric-name RoutingCount \
    --dimensions Name=RoutingTier,Value=full-context \
    --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
    --period 3600 \
    --statistics Sum \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/smart-routing-fullcontext-metrics-${TIMESTAMP}.json" || echo "  No metrics found"

  echo "  ✅ Smart Routing metrics saved"
else
  echo "  ⚠️  WebApp stack not deployed, skipping Smart Routing test"
fi

# ============================================
# Test 2: Transfer Family IAM Deny
# ============================================

log_step "2" "Transfer Family - IAM Deny Verification"

TF_SERVER_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-TransferFamily" \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`ServerId`)].OutputValue' \
  --output text --region "${REGION}" 2>/dev/null || echo "NOT_DEPLOYED")

if [ "${TF_SERVER_ID}" != "NOT_DEPLOYED" ] && [ -n "${TF_SERVER_ID}" ]; then
  echo "Transfer Family Server: ${TF_SERVER_ID}"
  
  # Get server details
  aws transfer describe-server \
    --server-id "${TF_SERVER_ID}" \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/transfer-family-server-${TIMESTAMP}.json"

  # List users
  aws transfer list-users \
    --server-id "${TF_SERVER_ID}" \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/transfer-family-users-${TIMESTAMP}.json"

  # Generate ephemeral SSH key for testing
  TEST_KEY_DIR="/tmp/v42-test-keys-${TIMESTAMP}"
  mkdir -p "${TEST_KEY_DIR}"
  ssh-keygen -t ed25519 -f "${TEST_KEY_DIR}/test-key" -N "" -q

  # Get first user
  TF_USER=$(aws transfer list-users \
    --server-id "${TF_SERVER_ID}" \
    --region "${REGION}" \
    --query 'Users[0].UserName' --output text 2>/dev/null || echo "")

  if [ -n "${TF_USER}" ] && [ "${TF_USER}" != "None" ]; then
    # Import test SSH key
    KEY_ID=$(aws transfer import-ssh-public-key \
      --server-id "${TF_SERVER_ID}" \
      --user-name "${TF_USER}" \
      --ssh-public-key-body "$(cat ${TEST_KEY_DIR}/test-key.pub)" \
      --region "${REGION}" \
      --query 'SshPublicKeyId' --output text 2>/dev/null || echo "")

    if [ -n "${KEY_ID}" ]; then
      TF_ENDPOINT="${TF_SERVER_ID}.server.transfer.${REGION}.amazonaws.com"
      
      # Test 1: Normal file upload (should succeed)
      echo "test content for verification" > "${TEST_KEY_DIR}/test-doc.txt"
      echo '{"test": true}' > "${TEST_KEY_DIR}/fake-metadata.json"

      echo "  Testing normal file upload..."
      sftp -i "${TEST_KEY_DIR}/test-key" \
        -o StrictHostKeyChecking=no \
        -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
        -o PubkeyAcceptedAlgorithms=+ssh-rsa \
        -o ConnectTimeout=10 \
        -b - "${TF_USER}@${TF_ENDPOINT}" <<EOF > "${OUTPUT_DIR}/sftp-normal-upload-${TIMESTAMP}.log" 2>&1 || true
put ${TEST_KEY_DIR}/test-doc.txt /test-doc-${TIMESTAMP}.txt
EOF

      # Test 2: .metadata.json upload (should be denied)
      echo "  Testing .metadata.json upload (expect denial)..."
      sftp -i "${TEST_KEY_DIR}/test-key" \
        -o StrictHostKeyChecking=no \
        -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
        -o PubkeyAcceptedAlgorithms=+ssh-rsa \
        -o ConnectTimeout=10 \
        -b - "${TF_USER}@${TF_ENDPOINT}" <<EOF > "${OUTPUT_DIR}/sftp-metadata-deny-${TIMESTAMP}.log" 2>&1 || true
put ${TEST_KEY_DIR}/fake-metadata.json /test-doc-${TIMESTAMP}.txt.metadata.json
EOF

      # Mask and save results
      cat "${OUTPUT_DIR}/sftp-normal-upload-${TIMESTAMP}.log" | mask_all > "${OUTPUT_DIR}/sftp-normal-upload-masked-${TIMESTAMP}.log"
      cat "${OUTPUT_DIR}/sftp-metadata-deny-${TIMESTAMP}.log" | mask_all > "${OUTPUT_DIR}/sftp-metadata-deny-masked-${TIMESTAMP}.log"

      # Cleanup: remove test SSH key
      aws transfer delete-ssh-public-key \
        --server-id "${TF_SERVER_ID}" \
        --user-name "${TF_USER}" \
        --ssh-public-key-id "${KEY_ID}" \
        --region "${REGION}" 2>/dev/null || true

      echo "  ✅ Transfer Family IAM Deny test completed"
    else
      echo "  ⚠️  Could not import SSH key"
    fi
  else
    echo "  ⚠️  No Transfer Family users found"
  fi

  # Cleanup temp keys
  rm -rf "${TEST_KEY_DIR}"
else
  echo "  ⚠️  Transfer Family stack not deployed, skipping"
fi

# ============================================
# Test 3: KB Auto-Sync
# ============================================

log_step "3" "KB Auto-Sync - Lambda Logs"

KB_SYNC_FUNCTION=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-AI" \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`KbAutoSync`)].OutputValue' \
  --output text --region "${REGION}" 2>/dev/null || echo "NOT_DEPLOYED")

if [ "${KB_SYNC_FUNCTION}" == "NOT_DEPLOYED" ] || [ -z "${KB_SYNC_FUNCTION}" ]; then
  # Try to find by function name pattern
  KB_SYNC_FUNCTION=$(aws lambda list-functions \
    --region "${REGION}" \
    --query "Functions[?contains(FunctionName, 'kb-auto-sync')].FunctionName" \
    --output text 2>/dev/null || echo "")
fi

if [ -n "${KB_SYNC_FUNCTION}" ] && [ "${KB_SYNC_FUNCTION}" != "NOT_DEPLOYED" ]; then
  echo "KB Auto-Sync Lambda: ${KB_SYNC_FUNCTION}"
  
  # Get recent logs
  LOG_GROUP="/aws/lambda/${KB_SYNC_FUNCTION}"
  aws logs get-log-events \
    --log-group-name "${LOG_GROUP}" \
    --log-stream-name "$(aws logs describe-log-streams \
      --log-group-name "${LOG_GROUP}" \
      --order-by LastEventTime --descending --limit 1 \
      --query 'logStreams[0].logStreamName' --output text --region "${REGION}" 2>/dev/null)" \
    --limit 50 \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/kb-auto-sync-logs-${TIMESTAMP}.json" || echo "  No logs found"

  echo "  ✅ KB Auto-Sync logs saved"
else
  echo "  ⚠️  KB Auto-Sync Lambda not found, skipping"
fi

# ============================================
# Test 4: Capacity Guardrails
# ============================================

log_step "4" "Capacity Guardrails - CloudWatch Metrics"

GUARDRAIL_FUNCTION=$(aws lambda list-functions \
  --region "${REGION}" \
  --query "Functions[?contains(FunctionName, 'capacity-monitor') || contains(FunctionName, 'guardrail')].FunctionName" \
  --output text 2>/dev/null || echo "")

if [ -n "${GUARDRAIL_FUNCTION}" ]; then
  echo "Guardrails Lambda: ${GUARDRAIL_FUNCTION}"
  
  # Get guardrail metrics
  aws cloudwatch get-metric-statistics \
    --namespace "FSxNOps/Guardrails" \
    --metric-name GuardrailDecision \
    --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
    --period 3600 \
    --statistics Sum \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/guardrails-metrics-${TIMESTAMP}.json" || echo "  No metrics found"

  # Get recent logs
  LOG_GROUP="/aws/lambda/${GUARDRAIL_FUNCTION}"
  aws logs get-log-events \
    --log-group-name "${LOG_GROUP}" \
    --log-stream-name "$(aws logs describe-log-streams \
      --log-group-name "${LOG_GROUP}" \
      --order-by LastEventTime --descending --limit 1 \
      --query 'logStreams[0].logStreamName' --output text --region "${REGION}" 2>/dev/null)" \
    --limit 30 \
    --region "${REGION}" 2>/dev/null | mask_all > "${OUTPUT_DIR}/guardrails-logs-${TIMESTAMP}.json" || echo "  No logs found"

  echo "  ✅ Guardrails data saved"
else
  echo "  ⚠️  Guardrails Lambda not found, skipping"
fi

# ============================================
# Summary
# ============================================

echo ""
echo "============================================"
echo "Verification Test Complete"
echo "============================================"
echo ""
echo "Output directory: ${OUTPUT_DIR}/"
echo "Files generated:"
ls -la "${OUTPUT_DIR}/"*"${TIMESTAMP}"* 2>/dev/null || echo "  (no files generated - stacks not deployed)"
echo ""
echo "Next steps:"
echo "  1. Deploy the RAG system: npx cdk deploy --all -c enableTransferFamily=true -c enableKbAutoSync=true"
echo "  2. Run post-deploy setup: bash demo-data/scripts/post-deploy-setup.sh"
echo "  3. Re-run this script: bash demo-data/scripts/v4.2-verification-test.sh"
echo "  4. Review masked logs in ${OUTPUT_DIR}/"
echo "  5. Copy relevant screenshots to docs/screenshots/"
